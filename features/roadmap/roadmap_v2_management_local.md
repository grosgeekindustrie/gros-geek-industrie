# Roadmap V2 — Gros Geek Manager local

Date de cadrage initial : 25 août 2026  
Statut : **vision future documentée, chantier non démarré**

---

## 1. Objet du document

Ce document fixe la vision de la future V2 de Gros Geek Industrie.

La V2 ne doit pas être une simple réécriture esthétique du pipeline actuel. Elle doit constituer la fondation technique d'un véritable outil local de gestion de l'activité, capable de reprendre toutes les fonctions validées de la V1 puis d'évoluer vers :

- le pilotage des boutiques ;
- la gestion des produits et de leurs déclinaisons ;
- la publication multiréseaux ;
- les statistiques de vente et de communication ;
- le suivi des coûts, prix et marges ;
- la gestion de production et de stock ;
- la génération de rapports ;
- une assistance comptable progressive.

Ce document doit servir à préparer le futur cahier des charges, le dossier de migration et la mission longue de reconstruction.

Il ne donne aucune autorisation pour commencer la V2 tant que la V1 actuelle n'est pas terminée, stabilisée et figée comme référence fonctionnelle.

---

## 2. Vision produit

### 2.1 Cible

Construire une application locale unique permettant de gérer progressivement l'ensemble de l'activité Gros Geek Industrie et DoubleX Industrie.

À terme, l'outil ne doit plus être seulement un pipeline qui génère des fiches Etsy. Il doit devenir un centre de pilotage regroupant :

- le catalogue produit ;
- les données Etsy ;
- les médias ;
- les coûts de fabrication ;
- les grilles tarifaires ;
- les ventes et commandes ;
- les publications sociales ;
- les files d'attente ;
- les statistiques ;
- les rapports opérationnels et financiers.

### 2.2 Local-first

La V2 reste une application locale.

Décisions actuelles :

- aucun besoin d'hébergement public ;
- aucun besoin de rendu côté serveur pour un site public ;
- le navigateur peut servir d'interface ;
- un backend Node local reste actif indépendamment de l'onglet ;
- une application de zone de notification Windows contrôle le démarrage, le redémarrage et l'arrêt ;
- les données métier restent sous le contrôle de l'utilisateur sur sa machine ;
- les sauvegardes doivent pouvoir être copiées, archivées et restaurées sans service propriétaire.

L'architecture devra néanmoins rester assez propre pour qu'une exposition distante sécurisée puisse être étudiée un jour sans réécrire le domaine métier.

### 2.3 Deux boutiques, un même outil

Gros Geek Industrie et DoubleX Industrie partagent le même moteur.

Les différences doivent être portées par :

- la boutique active ;
- la charte visuelle ;
- les comptes externes ;
- les règles commerciales propres à la boutique ;
- les catalogues, produits et données associées.

Tabletop et Collection sont des modes ou familles métier, pas deux applications techniques différentes.

---

## 3. Décisions techniques déjà prises

### 3.1 Socle général

La cible de travail envisagée est :

- Node.js pour le backend local ;
- TypeScript strict côté serveur et côté client ;
- React pour l'interface ;
- npm et npm workspaces pour organiser le dépôt ;
- une base SQLite locale comme première base transactionnelle ;
- un design system intégré dès la fondation ;
- une séparation stricte entre domaine, persistance, intégrations, traitements de fond et UI.

Les versions exactes seront choisies au démarrage du chantier à partir des versions stables et maintenues à ce moment-là.

### 3.2 Choix explicitement refusés

Sauf décision future explicite de l'utilisateur :

- **pas de Vite** ;
- **pas de Next.js** ;
- pas de framework full-stack imposant des conventions inutiles à une application locale ;
- pas de dépendance à un hébergeur ;
- pas de base cloud obligatoire ;
- pas de secrets dans le frontend ;
- pas de copie ou déplacement des fichiers legacy dans le nouveau dépôt.

React pourra être assemblé avec Webpack ou un autre pipeline de build explicite, compréhensible et validé lors du cadrage. Le choix du bundler doit rester un choix d'outillage, pas dicter l'architecture métier.

### 3.3 Réécriture réelle

La V2 sera créée dans :

- un nouveau répertoire ;
- un nouveau dépôt Git ;
- un nouveau projet npm initialisé proprement.

Le code de la V1 ne devra pas être repris dans le nouveau projet.

La V1 servira uniquement de :

- spécification fonctionnelle vivante ;
- référence UX ;
- inventaire des règles métier ;
- catalogue des intégrations ;
- source d'exemples et de scénarios de vérification.

Interdictions :

- copier les modules existants puis les renommer ;
- importer le HTML monolithique ;
- déplacer le serveur Python dans le nouveau dépôt comme solution définitive ;
- reproduire les globals, hooks DOM implicites et dépendances de chargement historiques ;
- recréer la dette legacy sous une syntaxe TypeScript.

---

## 4. Architecture cible de principe

La structure exacte sera décidée pendant le cadrage, mais la séparation suivante constitue la direction actuelle :

```text
gros-geek-manager/
├── apps/
│   ├── client/              # React + TypeScript
│   ├── server/              # Backend Node local
│   └── tray/                # Cycle de vie Windows si application distincte
├── packages/
│   ├── domain/              # Règles métier pures
│   ├── application/         # Cas d'usage et orchestration métier
│   ├── integrations/        # Etsy, Meta, Pinterest, TikTok, etc.
│   ├── database/            # SQLite, migrations et repositories
│   ├── jobs/                # Files, planification et reprises
│   ├── reporting/           # Statistiques et rapports
│   ├── shared/              # Contrats techniques réellement transverses
│   └── ui/                  # Design system et composants partagés
├── storage/                 # Médias et exports locaux hors Git
├── config/                  # Configuration non secrète
├── package.json
└── README.md
```

Cette arborescence est une hypothèse de départ. Elle ne doit pas être transformée en multiplication artificielle de packages minuscules. Un package doit exister uniquement lorsqu'il porte une responsabilité stable et utile.

### 4.1 Frontend

Le client React est responsable de :

- l'affichage ;
- la navigation ;
- l'édition des formulaires ;
- les prévisualisations ;
- la validation ergonomique ;
- l'affichage des statuts et erreurs ;
- la communication avec l'API locale.

Le client ne doit pas :

- posséder les secrets ;
- appeler directement les APIs externes sensibles ;
- décider seul des règles financières ;
- devenir la source de vérité des jobs ;
- conserver l'unique copie d'un brouillon ou d'une file d'attente.

### 4.2 Backend Node

Le backend est responsable de :

- l'API locale ;
- l'authentification OAuth ;
- la conservation sécurisée des tokens ;
- les intégrations externes ;
- les opérations sur la base ;
- les files d'attente persistantes ;
- les tâches planifiées ;
- le stockage des médias ;
- les exports ;
- les statistiques et rapports ;
- les règles métier critiques ;
- les journaux techniques exploitables.

Le backend continue à fonctionner lorsque l'interface est fermée.

### 4.3 Domaine métier

Le domaine ne doit dépendre ni de React, ni d'Etsy, ni de Meta, ni de la base choisie.

Il doit exprimer les concepts de l'activité avec des contrats compréhensibles :

- boutique ;
- produit ;
- fiche commerciale ;
- personnage et univers ;
- sculpteur ;
- variante ;
- échelle ;
- dimensions ;
- média ;
- coût ;
- prix ;
- marge ;
- commande ;
- client ;
- canal de vente ;
- brouillon social ;
- publication ;
- rapport ;
- événement d'audit.

---

## 5. Modèle de données envisagé

La base locale doit progressivement devenir la source de vérité métier interne.

Etsy, Instagram, Pinterest et les autres plateformes deviennent des systèmes externes synchronisés, pas les propriétaires du modèle interne.

### 5.1 Catalogue

- boutiques ;
- produits ;
- versions ;
- familles et collections ;
- personnages ;
- univers ;
- artistes et sculpteurs ;
- échelles ;
- dimensions ;
- variantes ;
- médias ;
- textes et traductions ;
- fiches externes et identifiants de plateforme.

### 5.2 Coûts et pricing

- matières ;
- résine consommée ;
- temps machine ;
- consommables ;
- temps humain ;
- compensation logistique ;
- frais de plateforme ;
- taux de change ;
- coûts par échelle ;
- prix FR et internationaux ;
- historique des calculs ;
- marges théoriques et constatées.

### 5.3 Vente et relation client

- commandes ;
- lignes de commande ;
- clients ;
- pays et devises ;
- remises ;
- taxes ;
- frais ;
- remboursements ;
- statuts de traitement ;
- canaux de vente ;
- historique de synchronisation.

### 5.4 Réseaux sociaux

- packages éditoriaux ;
- versions anglaises et contrôles français ;
- médias ;
- rendus par plateforme ;
- comptes et pages cibles ;
- brouillons manuels ;
- programmations ;
- tentatives ;
- identifiants de conteneurs ;
- publications finales ;
- erreurs ;
- reprises ;
- métriques récupérées ultérieurement.

### 5.5 Reporting et finance

- événements de vente ;
- mouvements financiers importés ou calculés ;
- périodes ;
- agrégats ;
- indicateurs ;
- rapports générés ;
- exports ;
- traces des corrections manuelles.

Le schéma définitif ne doit pas être inventé avant l'audit des données réellement disponibles dans Etsy et les autres plateformes.

---

## 6. SQLite, fichiers et sauvegardes

SQLite est la base envisagée pour la première version car elle est :

- locale ;
- transactionnelle ;
- robuste ;
- simple à sauvegarder ;
- interrogeable ;
- adaptée à une application mono-utilisateur ;
- indépendante d'un service distant.

La base ne doit pas contenir les fichiers médias volumineux eux-mêmes. Elle conserve leurs métadonnées, identités, empreintes et chemins contrôlés.

La V2 devra prévoir :

- des migrations de schéma versionnées ;
- une sauvegarde cohérente de la base et des médias ;
- une restauration contrôlée ;
- une politique de rétention ;
- une détection des fichiers orphelins ;
- des empreintes pour éviter les duplications inutiles ;
- des exports lisibles indépendamment de l'application.

Une suppression métier importante doit être récupérable ou explicitement confirmée.

---

## 7. Intégrations externes

Chaque plateforme doit être isolée derrière un adaptateur dédié.

### 7.1 Principes

- un connecteur par plateforme ;
- aucune logique éditoriale dans les clients HTTP ;
- aucune logique de plateforme dans le domaine ;
- tokens et refresh côté serveur uniquement ;
- erreurs normalisées sans perdre les détails utiles ;
- quotas et délais respectés ;
- journalisation des tentatives ;
- idempotence lorsque la plateforme le permet ;
- fallback manuel possible ;
- reprise sûre après redémarrage.

### 7.2 Plateformes envisagées

- Etsy ;
- fournisseur LLM retenu pour les agents ;
- Instagram ;
- Facebook ;
- Threads ;
- Pinterest ;
- TikTok ;
- YouTube ;
- X si l'accès API reste pertinent ;
- services de taux de change et autres données métier validées ultérieurement.

Les contrats internes doivent empêcher une plateforme de contaminer tout le projet avec ses noms de champs ou ses particularités OAuth.

---

## 8. Jobs, files d'attente et automatisation

La V2 doit posséder un vrai moteur de tâches persistantes.

Exemples :

- file Pinterest ;
- programmation sociale ;
- rafraîchissement des tokens ;
- synchronisation Etsy ;
- récupération de statistiques ;
- génération périodique de rapports ;
- sauvegardes ;
- nettoyage contrôlé des médias temporaires.

Propriétés nécessaires :

- statut persistant ;
- priorité ;
- date de prochaine tentative ;
- nombre de tentatives ;
- erreur normalisée ;
- verrou de traitement ;
- clé d'idempotence ;
- reprise après crash ;
- pause globale ou par famille ;
- annulation ;
- historique ;
- visibilité complète depuis l'interface.

Un redémarrage du PC ne doit ni perdre une tâche, ni déclencher une rafale de publications en retard.

---

## 9. Sécurité et confidentialité

### 9.1 Secrets

- jamais dans le frontend ;
- jamais dans Git ;
- jamais affichés en clair dans les journaux ;
- stockage local protégé autant que raisonnablement possible sous Windows ;
- rotation et révocation documentées ;
- séparation des environnements Sandbox et production.

### 9.2 API locale

Même locale, l'API doit :

- écouter uniquement sur les interfaces nécessaires ;
- contrôler les chemins de fichiers ;
- refuser les traversées de répertoire ;
- valider les payloads ;
- limiter les téléchargements ;
- protéger les callbacks OAuth ;
- éviter les appels réseau arbitraires ;
- normaliser les erreurs sans exposer les secrets.

### 9.3 Audit

Les opérations importantes doivent laisser une trace exploitable :

- publication ;
- modification de prix ;
- synchronisation ;
- suppression ;
- import ;
- génération ;
- opération financière ;
- correction manuelle.

---

## 10. Design system et UX

La V2 intègre le design system dès son premier écran. Elle ne doit pas recréer une seconde couche legacy avant de commencer la migration visuelle.

Principes :

- tokens sémantiques ;
- chartes Gros Geek et DoubleX ;
- composants accessibles ;
- états clavier, hover, focus, disabled, chargement et erreur ;
- textareas longues réellement lisibles ;
- densité confortable ;
- composants compacts réservés aux tableaux et barres d'outils ;
- une action primaire maximum par panneau ;
- séparation visuelle nette entre saisie, processus et résultat ;
- comportement cohérent sur toutes les fonctionnalités.

Le laboratoire Design System de la V1 sert de référence visuelle, pas de source de code à copier.

---

## 11. Stratégie de reconstruction « one shot »

### 11.1 Définition

« One shot » signifie :

- une mission agent longue ;
- un objectif global unique ;
- une reconstruction autonome du nouveau dépôt ;
- une livraison fonctionnelle complète ou aussi complète que possible ;
- aucune nécessité de redévelopper manuellement chaque écran sur plusieurs mois.

« One shot » ne signifie pas :

- un commit gigantesque non vérifié ;
- aucune étape interne ;
- aucune sauvegarde ;
- aucune compilation intermédiaire ;
- aucune possibilité de reprendre après interruption de quota ;
- mélanger la parité V1 et toutes les futures ambitions comptables dans le même premier run.

L'agent peut et doit créer des checkpoints internes, relire son travail, compiler et vérifier les parcours pendant la mission.

### 11.2 Préparation obligatoire

Avant la mission, produire un dossier de migration comprenant :

- inventaire exhaustif des vues ;
- inventaire des fonctionnalités ;
- inventaire des intégrations ;
- inventaire des routes locales ;
- variables de configuration ;
- formats de données ;
- états persistants ;
- prompts et contrats d'agents ;
- files d'attente ;
- règles par boutique ;
- règles Tabletop et Collection ;
- captures des écrans ;
- exemples de parcours ;
- erreurs connues et comportements attendus ;
- matrice de parité V1/V2 ;
- critères de réussite mesurables.

Cette préparation est le principal facteur de réussite. La lecture brute du legacy ne suffit pas à révéler tous les comportements implicites appris au fil des mois.

### 11.3 Mission de reconstruction

La mission future devra explicitement demander à l'agent de :

1. lire le dossier de migration ;
2. auditer la V1 comme référence uniquement ;
3. créer le nouveau dépôt ;
4. poser l'architecture ;
5. implémenter la parité fonctionnelle ;
6. compiler et vérifier régulièrement ;
7. documenter les écarts ;
8. poursuivre tant que les critères de complétion ne sont pas satisfaits ou qu'un blocage réel n'est pas démontré ;
9. livrer un bilan de couverture fonctionnelle ;
10. ne jamais modifier la V1.

Une coupure de quota ne doit pas invalider la mission. Le dépôt conserve ses checkpoints et le même objectif peut être repris.

### 11.4 Résultat attendu

La première livraison V2 vise la parité fonctionnelle avec la V1 stabilisée.

Elle n'a pas pour obligation d'implémenter immédiatement :

- la comptabilité complète ;
- un ERP ;
- la gestion exhaustive des stocks ;
- toutes les statistiques futures ;
- toutes les automatisations imaginables.

Elle doit en revanche offrir une architecture où ces évolutions peuvent être ajoutées sans troisième réécriture.

---

## 12. Philosophie de vérification

L'objectif n'est pas de produire une suite de tests plus volumineuse que l'application.

### 12.1 Pour la reconstruction initiale

Privilégier :

- compilation TypeScript stricte ;
- vérifications navigateur ;
- scénarios de contrôle exécutés par l'agent ;
- comparaisons avec la V1 ;
- scripts temporaires supprimables ;
- quelques contrôles permanents uniquement lorsqu'ils protègent un contrat critique.

### 12.2 Tests permanents réellement justifiés

Des tests ciblés deviennent nécessaires pour :

- calculs de prix et de marge ;
- conversions monétaires ;
- règles fiscales ;
- opérations comptables ;
- migrations de base ;
- idempotence des publications ;
- reprise des files après crash ;
- renouvellement des tokens ;
- sauvegarde et restauration.

Une erreur visuelle peut être contrôlée manuellement. Une erreur financière, une double publication ou une perte de données doit être protégée par du code vérifiable.

---

## 13. Trajectoire fonctionnelle après la parité V1

### Phase V2.0 — Parité propre

- toutes les fonctions validées de la V1 ;
- backend Node ;
- frontend React ;
- base locale ;
- design system ;
- intégrations existantes ;
- persistance robuste ;
- cycle de vie Windows ;
- sauvegarde minimale.

### Phase V2.1 — Pilotage commercial

- synchronisation périodique des ventes ;
- dashboard par boutique ;
- chiffre d'affaires par période ;
- performances par produit, univers, sculpteur et échelle ;
- frais et remboursements ;
- marges estimées ;
- exports et rapports.

### Phase V2.2 — Catalogue et production

- catalogue interne indépendant d'Etsy ;
- suivi des fichiers et médias ;
- coûts réels par fabrication ;
- planning de production ;
- statuts de commande ;
- consommables et stocks utiles ;
- historique des prix.

### Phase V2.3 — Marketing et analyse sociale

- statistiques par réseau ;
- rapprochement publication/produit ;
- campagnes ;
- meilleurs formats et horaires ;
- historique des créations ;
- rapports marketing ;
- recommandations assistées sans publication autonome incontrôlée.

### Phase V2.4 — Finance et assistance comptable

- consolidation des ventes et frais ;
- catégories de mouvements ;
- rapprochements ;
- exports comptables ;
- rapports périodiques ;
- préparation de TVA et autres éléments selon les règles applicables ;
- traçabilité des corrections.

La V2 ne devra pas être présentée comme un logiciel comptable certifié sans audit juridique et comptable approprié. Elle peut d'abord préparer, consolider, contrôler et exporter les données destinées au professionnel compétent.

---

## 14. Hors périmètre initial

Ne pas inclure automatiquement dans le premier run de reconstruction :

- hébergement public ;
- multi-utilisateur distant ;
- application mobile ;
- comptabilité certifiée ;
- paiement ;
- CRM complet ;
- gestion d'entrepôt complexe ;
- microservices ;
- Kubernetes ;
- dépendances cloud obligatoires ;
- refonte des règles métier encore non validées dans la V1.

---

## 15. Conditions de démarrage de la V2

La V2 peut être lancée lorsque :

- la V1 est fonctionnellement terminée ;
- Pinterest, TikTok et les réseaux retenus sont stabilisés ou explicitement reportés ;
- le design system est suffisamment validé ;
- les fonctionnalités vivantes sont inventoriées ;
- les bugs connus importants sont documentés ;
- la V1 possède un commit et une branche de référence stables ;
- le dossier de migration est complet ;
- le périmètre de parité est figé ;
- le nouveau stack et le bundler sont décidés ;
- la stratégie de base et de sauvegarde est validée.

---

## 16. Questions à trancher lors du cadrage final

- Webpack ou autre outil de build explicite pour React ?
- Backend HTTP minimal interne ou framework Node dédié ?
- ORM, query builder ou accès SQLite maîtrisé directement ?
- Processus unique ou séparation serveur/tray ?
- Distribution sous forme de scripts locaux ou exécutable Windows emballé ?
- Chiffrement local des tokens avec les mécanismes Windows ?
- Format des sauvegardes et fréquence ?
- Stratégie d'import initial depuis la V1 et Etsy ?
- Niveau exact de persistance des prompts et générations ?
- Fournisseur LLM principal et abstraction multi-fournisseurs ?
- Limites de la future assistance comptable ?
- Données financières à importer depuis Etsy, banques ou exports manuels ?

Ces choix doivent être fondés sur les besoins réels au moment de la V2, pas sur la mode technique du moment.

---

## 17. Ordre général des chantiers

1. Terminer les fonctionnalités de la V1.
2. Terminer les réseaux sociaux prioritaires.
3. Stabiliser le design system.
4. Corriger les derniers défauts fonctionnels importants.
5. Figer une version de référence de la V1.
6. Produire le dossier de migration V2.
7. Valider stack, architecture et périmètre.
8. Créer le nouveau dépôt.
9. Lancer la mission longue de reconstruction.
10. Comparer la V2 à la matrice de parité.
11. Corriger les écarts bloquants.
12. Basculer progressivement vers la V2.
13. Conserver la V1 en lecture seule jusqu'à validation complète.
14. Développer ensuite les fonctions de management, reporting et finance.

---

## 18. Principe directeur

La V1 sert à découvrir et valider le métier.

La V2 doit transformer ces apprentissages en une architecture durable.

Le but n'est pas de réécrire pour le plaisir de réécrire. Le but est de disposer d'une base locale solide, compréhensible par l'utilisateur, capable de devenir progressivement l'outil central de gestion de Gros Geek Industrie et DoubleX Industrie.

