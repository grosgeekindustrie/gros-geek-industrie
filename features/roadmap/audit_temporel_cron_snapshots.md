# Roadmap - Audit temporel Etsy par snapshots

## Statut

Feature réfléchie à court ou moyen terme, non prioritaire dans l'immédiat.

Ce document conserve les décisions et les pistes déjà discutées. Il ne constitue pas encore une spécification d'implémentation définitive. La base de données et les contraintes de l'API devront être auditées avant de coder.

## Problème actuel

L'audit Etsy sait exploiter l'état courant d'une fiche :

- nombre cumulé de vues
- nombre cumulé de favoris
- nombre cumulé de ventes
- prix
- promotion active et pourcentage
- âge de la fiche
- score, statut marketing et recommandation de promotion calculés localement

L’API publique ne fournit pas directement l’historique daté des vues et des favoris. L’audit ne permet donc pas encore de savoir proprement si une fiche accélère, ralentit ou ne convertit plus sur les 7 ou 30 derniers jours.

La situation est différente pour les ventes : Etsy expose des transactions datées par boutique et par listing avec notamment `transaction_id`, `listing_id`, `quantity`, `created_timestamp` et `paid_timestamp`. Les ventes peuvent donc être historisées précisément et rétroactivement sans attendre plusieurs semaines de snapshots.

L’association `BuyerPrice` permet également de lire l’état courant d’une promotion appliquée à une fiche : prix remisé, pourcentage, date de début et date de fin. L’Open API publique ne fournit en revanche aucun endpoint permettant de lister les campagnes ou codes promotionnels, ni d’y rattacher des listings.

## Objectif

Construire progressivement notre propre historique temporel en enregistrant à intervalles réguliers l'état des fiches Etsy.

Après une période d'accumulation suffisante, cet historique devra permettre de :

- calculer les variations de vues, favoris et ventes sur une période choisie
- importer et conserver les transactions Etsy avec leur date réelle
- calculer les ventes sur une période depuis les transactions plutôt que depuis un simple delta de compteur
- suivre les changements de prix et de promotion
- comparer les performances avant, pendant et après une promotion
- identifier les tendances récentes sans être pollué par tout l’historique de la fiche
- produire plus tard des graphiques et des analyses temporelles fiables

Les nouvelles données ne devront pas modifier immédiatement les recommandations actuelles. Une phase d'observation de 30 à 45 jours est souhaitable avant de les intégrer aux calculs marketing.

## Périmètre initial

Le premier périmètre utile concerne Gros Geek Industrie, dont l'historique et le volume permettent une analyse pertinente.

Double X Industrie devra être supportée par l'architecture dès le départ, mais ses données ne devront pas être interprétées trop tôt : la boutique est encore trop récente pour produire des conclusions solides.

Les boutiques doivent être identifiées par leur clé interne et leur véritable `shop_id` Etsy. Aucun état global de boutique active ne doit décider silencieusement de la destination d'un relevé.

## Fréquence envisagée

Position de départ recommandée : un relevé automatique toutes les heures pour les données qui n’ont pas d’historique natif exploitable, principalement les vues, les favoris, les prix et les promotions observées.

Cette fréquence offre une fenêtre suffisamment précise pour détecter les évolutions sans multiplier inutilement les appels. Un passage à 30 minutes pourra être évalué ensuite à partir des limites QPS et QPD réellement retournées par Etsy, du nombre exact de requêtes nécessaires par audit et du temps total d'exécution.

Les transactions ne nécessitent pas un snapshot horaire complet : elles pourront être importées séparément, dédupliquées par `transaction_id` et rapprochées des snapshots de prix et de promotion. Un relevé quotidien serait trop grossier pour situer correctement l’évolution des favoris ou le contexte promotionnel autour d’une vente. Un relevé toutes les quelques minutes serait disproportionné pour le besoin actuel.

Le planificateur sera local : il ne fonctionnera que lorsque la machine et le service requis seront actifs. Ce comportement devra être explicite dans l'interface et dans les logs.

## Architecture technique pressentie

- Python pour le planificateur et l'accès aux données
- SQLite pour le stockage local
- aucune dépendance npm ni refonte du projet uniquement pour cette feature
- intégration avec le client Etsy et les règles de limitation déjà présents
- exécution indépendante de l'onglet actuellement ouvert dans le navigateur
- journalisation exploitable des débuts, fins, erreurs, reprises et limites API

L'implémentation ne doit pas être un script isolé branché à côté de l'application. Le déclenchement, la collecte Etsy, la persistance et les calculs dérivés doivent rester des responsabilités séparées.

## Modèle de données à étudier

La base ne doit pas reposer sur une table fourre-tout. Le schéma devra être relationnel et distinguer au minimum :

### `shops`

- identité interne de la boutique
- `shop_id` Etsy
- nom et clé applicative
- état d'activation du suivi

### `etsy_sections`

- section Etsy
- boutique propriétaire
- libellé courant

### `listings`

- `listing_id` Etsy
- boutique propriétaire
- section Etsy courante
- titre courant et URL utile à l'interface
- dates Etsy disponibles
- état courant du listing

### `listing_snapshots`

- fiche concernée
- date et heure du relevé en UTC
- compteurs cumulés bruts : vues et favoris
- total de ventes observé, conservé comme valeur de contrôle mais non comme unique source de vérité
- prix observé
- promotion observée, pourcentage, prix remisé et dates de début/fin lorsqu’elles sont disponibles
- autres valeurs brutes réellement utiles et disponibles
- identifiant du run de collecte

### `transactions`

- boutique propriétaire
- `transaction_id` Etsy unique
- `receipt_id` Etsy
- `listing_id` Etsy
- quantité vendue
- date de création de la transaction
- date de paiement, utilisée en priorité comme date métier de vente
- prix enregistré au moment de la transaction
- montants de coupon boutique et acheteur disponibles
- statut du reçu associé
- indicateurs d’annulation ou de remboursement disponibles
- dates de première et dernière observation locale

Cette table devra permettre un backfill de l’historique existant. Les transactions brutes ne devront pas être remplacées par de simples agrégats journaliers.

### `receipts` et données financières futures

À étudier dans un chantier séparé mais compatible avec le même socle :

- état du reçu : payé, terminé, annulé, remboursé partiellement ou totalement
- montants bruts, remises, taxes, TVA, livraison et remboursement
- rapprochement avec les paiements et entrées de ledger Etsy lorsque les endpoints le permettent
- séparation claire entre ventes brutes, ventes annulées, remboursements et ventes nettes

Ce futur volet pourra alimenter une aide à la comptabilité, mais ne devra pas être présenté comme une comptabilité légale complète sans validation des règles fiscales et des exports nécessaires.

### `audit_runs`

- boutique auditée
- début et fin du run
- état du run
- nombre de fiches attendues, traitées et échouées
- compteurs de requêtes et informations de limitation API utiles

Les deltas et indicateurs marketing devront de préférence être calculés depuis les snapshots ou stockés dans des structures dérivées séparées. Ils ne doivent pas remplacer les données brutes.

Le stock ou `quantity` n'est pas une métrique métier utile ici : la production est réalisée à la demande et la quantité Etsy ne représente pas une capacité réelle de vente.

## Règles de collecte

- conserver les compteurs tels qu'ils sont reçus, sans correction destructive
- dater les snapshots en UTC et convertir uniquement pour l'affichage
- rendre un run idempotent afin d'éviter les doublons sur un même créneau
- ne pas effacer un ancien snapshot lorsqu'une valeur Etsy change
- tolérer l'échec d'une fiche sans perdre tout le run
- appliquer le contrôle de débit centralisé de l'application
- lire les limites Etsy retournées par les en-têtes plutôt que figer une capacité supposée
- prévoir une reprise propre après interruption du serveur ou expiration d'authentification
- tracer explicitement la boutique, le listing, la route et le statut HTTP lors d’un échec
- dédupliquer les transactions par leur identifiant Etsy
- préférer `paid_timestamp` comme date de vente et conserver les autres timestamps bruts
- ne pas compter silencieusement une transaction annulée ou remboursée comme une vente nette définitive
- séparer le collecteur de snapshots du collecteur de transactions
- prévoir un backfill initial des transactions avant le fonctionnement incrémental

## Calculs temporels futurs

Entre deux snapshots successifs :

- `delta_views = views_n - views_n-1`
- `delta_favorers = favorers_n - favorers_n-1`

Pour les ventes, la source privilégiée sera la table `transactions`. Les deltas du compteur cumulé ne serviront que de contrôle de cohérence ou de fallback en cas d’échec temporaire de la collecte détaillée.

Une transaction datée peut être rapprochée du dernier snapshot connu avant la vente afin d’identifier le prix affiché, la promotion observée, le nombre de vues et le nombre de favoris disponibles à cet instant.

Cette association reste une corrélation et non une preuve de causalité : la transaction donne l’instant de la vente, mais elle ne prouve pas que la promotion, les favoris ou une hausse récente des vues l’ont provoquée. Plus les snapshots sont réguliers et proches de la transaction, plus le contexte reconstitué est précis.

Les baisses de compteurs, changements de listing, renouvellements ou anomalies Etsy devront être conservés et signalés. Ils ne doivent pas être transformés automatiquement en deltas négatifs interprétés comme une perte réelle de vues, favoris ou ventes.

## Exploitations prévues

Lorsque l'historique sera suffisant :

- tendances sur 7, 30 et 90 jours
- vues, favoris et ventes réellement fenêtrés
- vitesse de progression par jour ou par semaine
- évolution du taux favoris / vues
- évolution du taux ventes / vues
- comparaison des périodes avec et sans promotion
- détection des fiches qui accélèrent malgré leur faible ancienneté
- détection des anciennes fiches dont le signal s'éteint
- graphiques par fiche, section et boutique
- aide à la décision marketing fondée sur les deltas plutôt que sur les seuls cumuls historiques
- date de dernière vente et nombre de jours sans vente par fiche
- chronologie des transactions avec quantité, prix et contexte promotionnel
- distinction entre ventes brutes, annulations, remboursements et ventes nettes

## Fenêtre de statistiques détaillées par fiche

À terme, un clic sur une ligne de l’audit devra pouvoir ouvrir une fenêtre dédiée à la fiche sélectionnée.

Cette fenêtre pourra présenter :

- courbes de vues et de favoris issues des snapshots
- dates et quantités des transactions réelles
- date de dernière vente et périodes sans vente
- historique des prix observés
- périodes de promotion, pourcentages et prix remisés
- évolution des taux favoris / vues et ventes / vues
- comparaison avant, pendant et après promotion
- changements de section, statut ou prix utiles à l’interprétation
- avertissements lorsque les données sont trop rares ou discontinues

L’interface devra distinguer explicitement :

- les événements exacts fournis par Etsy, comme les transactions
- les événements seulement situés dans un intervalle, comme l’apparition d’un nouveau favori entre deux snapshots
- les corrélations calculées localement
- les hypothèses ou prévisions produites par un agent

## Agent d’analyse statistique et de recommandation tarifaire

Une extension future pourra envoyer à un agent spécialisé uniquement des données statistiques structurées et non les données personnelles des acheteurs.

Entrées possibles :

- historique de vues, favoris et ventes
- périodes promotionnelles et prix réellement affichés
- prix actuel
- coûts réels connus de production, matière, emballage, commissions et expédition
- méthode de calcul tarifaire définie par l’application
- marge minimale souhaitée
- ancienneté, section, échelle et famille produit

Sorties possibles :

- synthèse de tendance
- prévision prudente de ventes avec niveau de confiance
- détection d’un prix potentiellement trop haut ou trop bas
- recommandation de prix ou de plage de prix
- recommandation d’expérimentation promotionnelle
- explication des facteurs ayant conduit à la recommandation

Garde-fous :

- aucune modification automatique du prix
- aucune publication automatique d’une promotion
- validation humaine obligatoire
- calcul déterministe de la marge présenté à côté de l’avis de l’agent
- avertissement clair lorsque l’échantillon est insuffisant
- conservation des données et de la version de la méthode utilisées pour chaque recommandation

## Promotions : possibilités et limites

L’application peut lire la promotion actuellement visible par un acheteur via `BuyerPrice`, notamment :

- présence d’une remise
- pourcentage
- prix original et prix remisé
- date de début et date de fin

L’Open API Etsy publique ne permet actuellement ni de lister les campagnes ou codes promotionnels existants, ni d’associer des listings à une campagne.

Une automatisation future de l’interface Etsy Shop Manager par navigateur pourra être étudiée séparément. Elle devra être considérée comme expérimentale et fragile, avec au minimum :

- exécution locale volontaire
- confirmation humaine avant application
- contrôle de la boutique, de la campagne et des listings sélectionnés
- capture du résultat et des erreurs
- arrêt immédiat si l’interface Etsy ne correspond plus au scénario attendu
- aucun stockage de mot de passe dans le dépôt
- aucune dépendance de l’audit ou du cron à cette automatisation

Modifier directement les prix via l’API de listings ou d’inventaire ne doit pas être présenté comme une promotion Etsy : cela ne crée ni campagne, ni code promotionnel, ni signal de fiche en promotion dans la recherche Etsy.

## Garde-fous

- ne pas intégrer les nouvelles métriques au score ou aux statuts dès les premiers relevés
- ne pas réécrire l'audit actuel avant d'avoir un historique suffisant et vérifié
- ne pas attribuer automatiquement une vente à une promotion sans afficher la limite de cette inférence
- ne pas mélanger les données de Gros Geek Industrie et de Double X Industrie
- ne pas dépendre du toggle visuel pour choisir la boutique collectée
- ne pas lancer plusieurs collectes concurrentes pour une même boutique et un même créneau
- ne pas stocker uniquement des agrégats : les snapshots bruts sont la source de vérité locale
- prévoir sauvegarde, migration et inspection de la base avant une utilisation durable
- ne jamais envoyer à un agent les identités, adresses ou coordonnées des acheteurs
- ne pas confondre prévision statistique, recommandation marketing et donnée comptable

## Décisions encore ouvertes

- ordonnanceur interne au serveur ou tâche Windows dédiée
- fréquence définitive : 60 minutes ou 30 minutes
- routes Etsy exactes et coût réel en requêtes pour un relevé complet
- stratégie de rattrapage après plusieurs heures ou jours d'arrêt
- durée de conservation des snapshots détaillés
- besoin éventuel d'agrégats quotidiens après plusieurs mois
- format et emplacement définitifs de la base SQLite
- politique de sauvegarde et de migration du schéma
- stratégie de backfill des transactions Etsy et import facultatif des CSV pour contrôle ou données complémentaires
- seuil minimal d’historique avant activation des analyses temporelles
- définition métier exacte d’une vente brute, annulée, remboursée et nette
- contenu et ergonomie de la fenêtre de statistiques détaillées
- méthode tarifaire déterministe à fournir au futur agent de recommandation
- périmètre d’une éventuelle aide comptable locale
- faisabilité et niveau de risque acceptable d’une automatisation navigateur de Shop Manager

## Ordre de réalisation proposé

1. Auditer précisément les routes, les compteurs disponibles et le coût API d’un relevé complet.
2. Valider les routes de transactions par boutique et par listing, ainsi que la gestion des annulations et remboursements.
3. Concevoir et valider le schéma relationnel SQLite et sa stratégie de migration.
4. Réaliser un backfill manuel des transactions sur une seule boutique.
5. Réaliser un collecteur manuel de snapshots sur cette boutique, sans cron ni impact sur l’audit actuel.
6. Vérifier les transactions, snapshots et deltas sur plusieurs jours.
7. Ajouter l’ordonnancement horaire, le verrouillage et les logs de supervision.
8. Accumuler 30 à 45 jours de vues, favoris, prix et promotions sans modifier les décisions marketing.
9. Concevoir la fenêtre de statistiques par fiche et les graphiques à partir des données réellement observées.
10. Évaluer ensuite l’agent statistique, la recommandation tarifaire et le volet comptable.

## Critères de validation

- aucun mélange entre boutiques
- aucun doublon de snapshot sur un même créneau
- reprise après interruption sans corruption de données
- respect démontré des limites Etsy
- deltas reproductibles depuis les données brutes
- audit manuel possible d'un run et de chaque erreur
- absence d'impact sur les publications, traductions et pipelines existants
- schéma évolutif sans table monolithique
