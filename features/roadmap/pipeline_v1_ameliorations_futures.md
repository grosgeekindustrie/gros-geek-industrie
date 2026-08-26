# Pipeline V1 — idées d'amélioration futures

Date de création : 26 août 2026  
Statut : **réserve d'idées, hors chantier Design System en cours**

## Objet

Cette roadmap conserve les améliorations encore intéressantes après la stabilisation fonctionnelle de la V1. Elles ne remettent pas en cause le workflow actuel et ne doivent pas retarder la refonte progressive de l'interface par le Design System.

L'ordre ci-dessous exprime une priorité produit indicative, pas une autorisation d'implémentation immédiate.

## 1. Profils par sculpteur — priorité fonctionnelle

Créer une fiche de configuration réutilisable par sculpteur afin de préremplir automatiquement les données qui se répètent d'une figurine à l'autre.

Données candidates :

- nom canonique et diminutif utilisé pour les SKU ;
- échelles habituellement proposées ;
- échelle d'origine la plus fréquente ;
- règles de pricing ou paramètres de coût récurrents ;
- conventions de dimensions et de nombre de pièces ;
- informations de licence ou de crédit ;
- préférences de présentation réellement stables ;
- exceptions connues.

Contraintes :

- le profil suggère et préremplit, il ne doit jamais empêcher une correction par fiche ;
- les données propres au produit restent prioritaires ;
- les profils Gros Geek et DoubleX doivent pouvoir partager le même moteur sans mélanger leurs règles commerciales ;
- aucune génération IA n'est nécessaire pour appliquer ces règles déterministes.

Bénéfice attendu : réduire les saisies répétitives et fiabiliser les échelles, les SKU et les paramètres habituels sans rigidifier le formulaire.

## 2. Espaces de travail persistants par produit

Permettre de conserver plusieurs fiches en préparation en parallèle, chacune avec ses propres :

- données de formulaire ;
- médias et ordre des médias ;
- résultats d'agents ;
- traductions ;
- pricing ;
- état de publication ;
- historique minimal.

L'ouverture d'une autre fiche ou le redémarrage du serveur ne doit pas écraser le travail en cours. Cette évolution doit éviter de recréer un système batch complexe : il s'agit de plusieurs dossiers de travail indépendants, pas d'un lancement massif d'agents.

## 3. Contrôle final déterministe avant publication

Ajouter un préflight lisible juste avant l'envoi en brouillon ou la publication.

Contrôles candidats :

- champs obligatoires ;
- cohérence entre échelles, dimensions, variations et prix ;
- présence et ordre des médias ;
- limites de caractères par plateforme ;
- absence de valeurs temporaires ou de placeholders ;
- destination réelle : boutique, page et compte ;
- doublon probable ;
- état des connexions et tokens nécessaires.

Le contrôle doit distinguer les erreurs bloquantes des avertissements et conduire directement vers le champ à corriger.

## 4. Historique et versions des générations

Conserver plusieurs versions utiles d'une génération afin de pouvoir :

- comparer deux résultats ;
- restaurer une version précédente ;
- identifier la version finalement publiée ;
- préserver séparément le contenu manuel et le contenu généré ;
- éviter qu'une relance correcte soit perdue par une génération moins bonne.

La conservation doit rester bornée et compréhensible pour ne pas accumuler indéfiniment des payloads lourds.

## 5. Rôles explicites et déduplication des médias

Permettre d'attribuer un rôle métier aux images :

- image principale ;
- vue de détail ;
- vue d'échelle ;
- couverture Reel ou vidéo ;
- média social ;
- média Pinterest ;
- référence non publiable.

Ajouter une empreinte de fichier pour repérer les doublons réels malgré des noms ou emplacements différents. Le système doit suggérer, pas supprimer silencieusement.

## 6. Boîte de préparation des produits

Créer une entrée légère pour déposer plusieurs dossiers produits à préparer, puis les ouvrir un par un dans le pipeline normal.

Objectifs :

- inventorier le travail à faire ;
- voir les données minimales manquantes ;
- ordonner les priorités ;
- reprendre facilement la fiche suivante ;
- ne jamais déclencher automatiquement une génération ou une publication en masse.

Cette idée peut ultérieurement exploiter une convention de nommage de dossier, tout en laissant une validation humaine avant l'entrée dans le pipeline.

## 7. Mode simulation avant appels externes

Prévoir un mode de contrôle qui construit les payloads finaux sans appeler Etsy, Meta, Pinterest, TikTok ou un fournisseur IA.

Le mode doit afficher :

- les données qui seraient envoyées ;
- la destination exacte ;
- les transformations appliquées ;
- les champs ignorés ou non supportés ;
- les erreurs détectables localement.

Les secrets et tokens doivent être masqués. Ce mode vise surtout les futures modifications sensibles des publications et intégrations.

## Ordre recommandé si ces idées sont reprises

1. Profils par sculpteur.
2. Contrôle final déterministe.
3. Espaces de travail persistants par produit.
4. Historique et versions.
5. Rôles et déduplication des médias.
6. Boîte de préparation.
7. Mode simulation.

## Frontière avec les autres chantiers

- Pinterest et TikTok restent suivis dans les roadmaps sociales dédiées.
- La refonte écran par écran relève du chantier Design System.
- La reconstruction React, TypeScript, Node et SQLite relève de la roadmap V2 management local.
- Ces idées peuvent nourrir la V2, mais aucune ne doit être développée deux fois si la reconstruction est déjà imminente.
