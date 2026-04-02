# Cadrage V2 — Collection multi-fiches unifiée

## 1. Contexte

Le form Collection single actuel est désormais considéré comme **la base UI validée**.

Le mode batch visuel actuel n’est plus la direction cible à long terme.  
Il a créé une divergence d’UI et de logique qui complexifie :

- la maintenance ;
- l’évolution des features ;
- la cohérence UX entre les modes ;
- la future adaptation à DnD.

L’objectif n’est donc plus de “sauver” le batch tel quel, mais de **faire évoluer le mode Collection standard vers un éditeur mono ou multi-fiches**.

---

## 2. Pivot stratégique validé

### Ancienne logique
- un mode single ;
- un mode batch ;
- deux surfaces UI distinctes ;
- des règles spécifiques au batch ;
- une logique de lancement liée à la position dans le parcours.

### Nouvelle logique cible
Il n’y a plus, à terme, un “single” et un “batch” en tant que produits UI distincts.

Il y a :

- un mode **Collection**
- un mode **DnD**

Et dans chacun :
- une fiche
- ou plusieurs fiches

Autrement dit :
le mode single devient un **éditeur de fiches** capable d’en gérer une ou plusieurs.

---

## 3. Décision produit majeure

### Le batch visuel actuel n’est plus la cible finale

La direction retenue est :

- on commence par **Collection**
- on y ajoute la capacité **multi-fiches**
- on teste cette logique
- on l’adapte ensuite à **DnD**
- si le nouveau modèle tient, on pourra alors supprimer l’ancien mode batch visuel

Important :
- la purge ne concerne pas immédiatement toute la logique JS ;
- une partie de la logique batch existante pourra être recyclée ;
- ce qui doit disparaître à terme, c’est surtout la **surface UI batch parallèle** et la duplication de parcours.

---

## 4. Philosophie UX retenue

### 4.1 Une fiche = une unité autonome

Chaque fiche doit être pensée comme une unité de travail autonome :

- sa propre saisie ;
- sa propre navigation ;
- son propre lancement pipeline ;
- son propre état ;
- ses propres résultats.

### 4.2 Le lancement n’est plus lié à la position dans le stepper

La règle suivante a été explicitement validée :

- **le bouton de lancement n’est plus conditionné par le dernier step**
- l’utilisateur peut lancer le pipeline d’une fiche même si les informations sont incomplètes
- les validations bloquantes seront définies plus tard, quand le chantier de structure sera terminé

Conséquence :
- le stepper organise la saisie
- il ne contrôle plus le droit de lancer

### 4.3 Responsabilisation de l’utilisateur

La logique ne doit pas trop “penser à la place” de l’utilisateur.

On évite donc :
- les mécanismes batch trop automatiques ;
- les décisions implicites sur les fiches à lancer ;
- les règles de lancement globales difficiles à comprendre.

L’utilisateur :
- choisit sa fiche ;
- l’ouvre ;
- la modifie ;
- la lance s’il le souhaite ;
- assume sa progression.

---

## 5. Structure cible de l’interface

## 5.1 Une seule card ouverte à la fois

C’est une règle validée.

À un instant donné :
- une seule fiche est dépliée
- toutes les autres sont repliées

Objectifs :
- réduire la charge visuelle ;
- éviter les longues piles de formulaires ouverts ;
- garder un focus clair ;
- rendre l’interface viable même avec beaucoup de fiches.

## 5.2 Les cards repliées doivent rester informatives

Une card repliée ne doit pas être réduite à un simple “Fiche 04”.

Elle doit rester utile et lisible.

Format de référence discuté :

`04 | Mario Bros | Identité -------------------------------- [▶]`

Puis enrichi en version plus complète :

`[☐] | 04 | Mario Bros | Identité --------------------- | barre de progression si le pipe est lancé | [▶]`

Donc une card repliée doit donner au minimum :
- un index de fiche ;
- un nom / intitulé utile ;
- le step actif ou le dernier step consulté ;
- un indicateur d’état / progression si pertinent ;
- un bouton de lancement à droite.

---

## 6. Modèle de navigation retenu

### 6.1 Une liste de fiches + une fiche active

L’éditeur multi-fiches doit être pensé comme :

- une liste de fiches ;
- une fiche active ;
- une seule fiche ouverte à la fois.

### 6.2 Le stepper reste local à la fiche ouverte

Le stepper validé du form Collection doit être réutilisé comme structure interne d’une fiche.

Il sert à organiser :
- images
- identité
- échelles
- détails & contexte

Mais il ne sert plus à débloquer le lancement.

---

## 7. Lancement pipeline

### 7.1 Lancement individuel par fiche

Décision validée :
- chaque fiche se lance individuellement
- il n’y a plus de logique “lancer tout le batch” comme pivot UX principal

Conséquences positives :
- plus besoin de raisonner en “dernière fiche”
- plus besoin de décider automatiquement quelles fiches sont prêtes
- plus besoin de logique globale compliquée sur l’inclusion/exclusion de fiches
- le modèle mental redevient simple

### 7.2 Le bouton de lancement reste local à la fiche

Le bouton de lancement doit être disponible comme action propre à la fiche.

Discussion retenue :
- il peut être visible même si la fiche n’est pas au dernier step
- il peut même être accessible directement depuis la card repliée
- il doit donc être traité comme une action primaire locale

### 7.3 Pas de blocage fort pour l’instant

Lancement possible même si :
- certains champs sont vides ;
- la fiche est incomplète ;
- l’utilisateur n’a pas visité tous les steps.

La validation forte sera cadrée plus tard.

---

## 8. Suppression de fiches

## 8.1 Pas de bouton supprimer unitaire sur chaque card comme cible principale

La piste “un bouton supprimer sur chaque card” a été challengée.

Direction préférée :
- une **checkbox** par card
- une **action globale de suppression**
- une **confirmation obligatoire**

Cette approche est jugée meilleure car :
- plus propre visuellement ;
- plus scalable ;
- plus cohérente si le nombre de fiches est élevé ;
- moins agressive visuellement qu’une multiplication d’actions destructrices.

## 8.2 Modèle retenu

Sur chaque card repliée :
- une checkbox de sélection

Au niveau de la liste :
- une action globale du type `Supprimer la sélection`

Avec une confirmation explicite :
- “Êtes-vous sûr ?”

## 8.3 Règle impérative : il doit toujours rester au moins une fiche

On ne peut jamais se retrouver avec zéro fiche.

Formulation validée :
- il doit toujours y avoir au moins une card présente

Ce point peut être implémenté de deux façons :
1. bloquer la suppression de la dernière fiche ;
2. supprimer normalement mais recréer immédiatement une fiche vide si la liste devient vide.

La règle fonctionnelle à retenir est :
- **à la fin de l’action, il doit toujours rester au moins une fiche**.

---

## 9. États visuels des fiches

Il a été explicitement demandé que les fiches soient visuellement différenciées selon leur état.

Au minimum, les états suivants doivent être distingués :

- **brouillon / jamais lancée**
- **en cours**
- **succès / déjà générée**
- **échec**

Point important challengé et jugé pertinent :
- il faut aussi penser à l’état **modifiée depuis la dernière génération**

Pourquoi :
- une fiche peut avoir été générée avec succès ;
- puis être modifiée ensuite ;
- elle ne doit plus apparaître comme “succès propre et à jour”.

### États recommandés à retenir

- **brouillon** : neutre
- **en cours** : accent / progression
- **succès** : teinte succès
- **échec** : teinte erreur
- **modifiée depuis la dernière génération** : teinte warning

---

## 10. Progression et lecture d’une card repliée

La ligne repliée doit pouvoir porter plusieurs informations condensées :

- la sélection éventuelle pour suppression ;
- l’index ;
- le nom ;
- le step actif ;
- une progression si le pipeline a déjà été lancé ;
- l’action de lancement.

Exemple de cible :

`[☐] | 04 | Mario Bros | Identité --------------------- | progression | [▶]`

Il faut que cette ligne soit :
- lisible ;
- cliquable pour ouvrir la fiche ;
- exploitable sans ouvrir la fiche si l’utilisateur veut juste lancer.

---

## 11. Cas extrêmes discutés

### 11.1 Cas des très gros volumes

Un scénario de type :
- 100 fiches
- 200 fiches

a été explicitement évoqué.

Conclusion :
- l’interface doit éviter les piles de formulaires ouverts ;
- une seule card ouverte à la fois est indispensable ;
- une liste de fiches compactes est plus viable qu’une longue série de blocs affichés intégralement.

### 11.2 Cas de préparation partielle

Exemple discuté :
- l’utilisateur prépare 100 fiches sur 200
- puis veut avancer sans gérer immédiatement les autres

La réflexion a conduit à abandonner la logique “lancement global intelligent” au profit du lancement individuel par fiche.

Cela évite :
- les règles trop implicites ;
- les arbitrages automatiques ;
- les conflits mentaux sur ce qui doit partir ou non.

---

## 12. Différences avec la logique batch précédente

Ce qui est abandonné comme pivot :
- le lancement global du batch comme centre de la logique ;
- la contrainte “dernier step de la dernière fiche” ;
- la nécessité de définir automatiquement quelles fiches sont prêtes ;
- l’idée d’un batch visuellement séparé du single.

Ce qui est conservé dans l’esprit :
- la possibilité de gérer plusieurs fiches ;
- certaines logiques JS réutilisables ;
- les états de progression / exécution ;
- une éventuelle partie de l’orchestration existante.

---

## 13. Stratégie de migration retenue

### 13.1 Nouvelle branche recommandée

Ce chantier doit partir sur une **branche dédiée v2**, car il ne s’agit plus d’un simple ajustement batch, mais d’une évolution structurante avant purge de l’ancien code.

### 13.2 Ordre recommandé

1. Ajouter la logique multi-fiches dans **Collection**
2. Tester le workflow réel
3. Adapter ensuite la même logique à **DnD**
4. Tester
5. Puis seulement engager la purge de l’ancien batch visuel

### 13.3 Attention importante

Il ne faut pas confondre :
- **suppression du batch visuel**
- et **suppression immédiate de toute logique batch JS**

Une partie du JS ancien pourra rester utile au nouveau modèle.

---

## 14. Ce qui est volontairement reporté

Les points suivants ne doivent pas polluer le chantier courant :

- la définition des champs obligatoires ;
- la validation bloquante avant lancement ;
- la politique exacte de contrôle de complétude ;
- le nettoyage complet de l’ancien code ;
- la purge complète des structures batch existantes ;
- la normalisation finale DnD.

Ces sujets viendront **après** la stabilisation du nouveau modèle multi-fiches Collection.

---

## 15. Points déjà challengés ensemble

### Rejetés ou relativisés
- garder un vrai mode batch séparé comme cible long terme ;
- lier le lancement à la dernière fiche / dernier step ;
- ouvrir plusieurs cards simultanément ;
- laisser des cards repliées sans information utile ;
- multiplier les boutons supprimer destructifs sur chaque card comme solution principale ;
- trop automatiser la logique de sélection des fiches à lancer.

### Validés
- unifier progressivement mono + multi-fiches ;
- une seule card ouverte à la fois ;
- lancement individuel par fiche ;
- cards repliées informatives ;
- sélection par checkbox pour suppression ;
- confirmation avant suppression ;
- au moins une fiche toujours présente ;
- différenciation visuelle claire des états.

---

## 16. Règles à transmettre aux futurs agents

1. Ne pas repartir de l’ancienne logique batch comme si elle devait être simplement “corrigée”.
2. La direction cible est un **éditeur multi-fiches unifié**, pas deux interfaces parallèles.
3. Une fiche reste une unité autonome.
4. Le stepper organise la saisie mais ne bloque pas le lancement.
5. Une seule fiche ouverte à la fois.
6. Une fiche repliée doit rester informative.
7. La suppression doit passer par une sélection + confirmation.
8. Il doit toujours rester au moins une fiche.
9. Les états visuels de fiche sont essentiels et non décoratifs.
10. Collection est la zone pilote ; DnD viendra ensuite.
11. La purge de l’ancien batch visuel viendra après validation, pas avant.

---

## 17. Étape suivante prévue

Le prochain chantier doit cadrer **l’affichage des agents et des résultats** dans ce nouveau modèle multi-fiches.

Questions à traiter ensuite :
- comment afficher les agents par fiche ;
- où vivent les résultats ;
- comment distinguer une fiche jamais lancée, en cours, déjà générée ou en échec ;
- comment organiser visuellement les sorties sans recréer une interface batch parallèle.
