# Feature roadmap — Traduction multilingue Etsy

## Statut

**Feature ajournée / à reprendre plus tard**.

La traduction multilingue reste une feature à fort potentiel, mais la tentative d’intégration a montré qu’il ne fallait **pas** la forcer par-dessus le socle actuel tant que le point d’ancrage exact du **résultat FR net** n’est pas parfaitement maîtrisé.

Le chantier est donc **mis de côté volontairement**.

Priorité immédiate :
- revenir sur la branche de travail stable **`fix_alt`**
- reprendre les **benchs du pipe** avec de nouvelles fiches produit
- rouvrir la traduction plus tard, avec une approche plus sèche et mieux bornée

---

## Pourquoi cette feature reste importante

Etsy permet d’ajouter des **traductions manuelles** aux fiches produits. Quand elles existent, elles remplacent utilement la traduction automatique, ce qui permet de mieux contrôler :
- le sens
- la terminologie
- les noms de personnages / univers
- la qualité perçue par les clients
- le rendu SEO/commercial selon les marchés

Objectif final :
- garder le **FR** comme source de vérité
- générer des versions traduites propres pour les marchés les plus utiles
- préparer à terme un **export direct vers Etsy**, où la gestion de plusieurs langues deviendra alors beaucoup plus naturelle

---

## Vision produit validée

### Langues cibles

Architecture prévue pour :
- **FR** = langue source / vérité
- **EN**
- **DE**
- **ES**

Stratégie de déploiement validée :
- **bench initial sur 1 seule langue** : **EN**
- puis extension possible à **DE** et **ES**
- ne pas ouvrir trop de langues d’un coup pour éviter une surcharge de gestion

### Portée

La feature doit s’appliquer à :
- **Collection**
- **DnD / Tabletop**

Elle ne s’applique pas à :
- **Batch** (feature abandonnée)

### Principe central

La traduction ne doit **pas** faire partie du pipe principal.

Elle doit être pensée comme un **module post-pipeline** :
- le pipe génère la **fiche nette FR**
- ensuite seulement, l’utilisateur peut demander la traduction
- ce module doit aussi pouvoir être réutilisé pour :
  - traduire une ancienne fiche
  - retraduire une fiche hors pipeline
  - retravailler un export/import structuré plus tard

---

## Ce qui doit être traduit

Uniquement les **sorties net** de la fiche produit après fin de pipe.

Pas les données brutes, pas les sorties intermédiaires, pas les brouillons agents.

Champs concernés en priorité :
- **Titre net**
- **Tags nets**
- **Description nette**

Éventuellement plus tard :
- **ALT nette**, mais ce point n’est pas prioritaire

Règle absolue :
- **jamais traduire le brut**
- **jamais brancher la traduction avant la fin du pipe**

---

## UX / UI validée

### Barre d’actions

Disposition validée :

- **À gauche**
  - bouton **Traduire**
  - bouton **Importer**
  - **icône type roue / settings / prompt** dans l’esprit du pipe actuel
- **À droite**
  - bouton **Export**

Schéma :

```text
A gauche ------------------------------------------------------------------- A droite
[Traduire] [Importer] [⚙️ prompt/options]                                     [Export]
```

Règles :
- pas de gros bouton "Injecter le prompt"
- pas de bouton centré
- l’accès au prompt/options doit être **discret**, dans l’esprit actuel du pipe

### Bloc alias

Le bloc alias ne doit **pas** être dans un panneau latéral.

Il doit être placé **au-dessus** des onglets résultat, sur toute la largeur, sous la barre d’actions.

Structure validée :
- **4 colonnes par langue**
- une colonne pour chaque langue active
- chaque colonne contient :
  - **alias nom**
  - **alias univers**

Schéma cible :

```text
|   FR   |   EN   |   DE   |   ES   |
| nom    | nom    | nom    | nom    |
| univers| univers| univers| univers|
```

Techniquement :
- préférence pour **CSS Grid**
- pas un bricolage en lignes séparées
- responsive propre plus tard si nécessaire

### Onglets résultat

Sous le bloc alias :
- onglet **FR**
- onglet **EN**
- onglet **DE**
- onglet **ES**

Mais règle importante :
- **n’afficher que les langues activées dans les paramètres**

Exemples :
- si seul **EN** est activé → afficher **FR + EN**
- si **EN + DE** → afficher **FR + EN + DE**
- si **EN + DE + ES** → afficher les 4

Cette règle s’applique à :
- onglets
- bloc alias
- export
- import
- actions de traduction

### Zone résultat

Sous les onglets :
- afficher la fiche de la langue active
- champs **éditables**
- possibilité de **copier / coller**
- logique proche de l’UI résultat actuelle, mais en version édition/travail

Important :
- cette zone doit finir par devenir la **vraie vue de travail multilingue**
- mais la tentative précédente a montré qu’il ne faut **pas** masquer/takeover l’ancien résultat tant que le branchement n’est pas parfaitement fiable

---

## Alias / terminologie locale

### Problème identifié

Selon les marchés / langues, les noms peuvent varier :
- **Gally** → **Alita**
- **Gunm** → **Battle Angel Alita**

Ce n’est pas une simple traduction mot à mot. C’est une question de **terminologie locale / d’usage marché**.

### Solution validée

Mettre en place une **surcouche d’alias par langue**.

Le FR reste la vérité source.
Les langues traduites peuvent avoir :
- un **alias nom**
- un **alias univers**

Par langue :
- FR : alias nom / alias univers
- EN : alias nom / alias univers
- DE : alias nom / alias univers
- ES : alias nom / alias univers

### Règles

- les alias ne doivent **pas** écraser la fiche FR source
- ils sont une **surcouche locale par langue**
- ils doivent pouvoir être modifiés manuellement
- ils doivent servir de **glossaire prioritaire** au traducteur

---

## Agent alias dédié

### Besoin validé

Il faut **dissocier l’agent alias** de l’agent traducteur.

### Rôle de l’agent alias

Le mini-agent alias doit :
- vérifier si le **nom personnage** et le **nom univers** changent selon la langue
- remplir automatiquement les champs alias
- même si les noms sont **identiques**, il doit remplir les champs avec la valeur FR le cas échéant
- ne pas inventer des alias fantaisistes

Son job :
- détecter
- vérifier
- pré-remplir
- laisser l’utilisateur corriger si besoin

### UI associée

Dans la zone alias, prévoir un bouton du type :
- **Détecter les alias**
- ou **Remplir les alias**

Le nom peut être ajusté, mais la logique est validée.

---

## Agent traducteur dédié

### Besoin validé

Il faut un **agent traducteur dédié**, déclenché par le bouton **Traduire**.

Il ne doit pas être fusionné avec Eden ni avec l’agent alias.

### Principe

- le pipe produit la fiche nette FR
- la fiche nette FR devient la source de vérité
- l’agent traducteur prend cette base
- il traduit vers la langue cible
- il doit utiliser les alias comme **terminologie locale prioritaire**

### Prompt

Un **prompt maître unique**, paramétrable par langue, est préférable à 3 prompts différents.

Donc :
- un seul prompt maître
- variable `target_language`
- prompt court mais strict

### Contraintes du prompt traducteur

Le traducteur doit :
- traduire fidèlement
- ne rien inventer
- ne rien supprimer
- ne pas réécrire “marketing”
- conserver la structure
- conserver les retours ligne
- conserver listes / emojis / blocs
- conserver les faits techniques
- conserver les noms propres, noms de sculpteurs, licences, noms alternatifs sécurisés
- utiliser les alias comme terminologie prioritaire

Il ne doit pas :
- optimiser de lui-même
- embellir
- résumer
- improviser
- faire un simple replace idiot hors contexte

Conclusion validée :
- **oui**, il faut un vrai prompt de traduction
- **non**, une simple consigne du type “traduis en X sans rien modifier” n’est pas suffisante en prod

---

## Paramètres / configuration

Les langues doivent s’activer dans les **paramètres**, au même endroit que la clé API.

Règles validées :
- la sélection des langues doit être pilotée par les paramètres
- EN / DE / ES activables
- l’UI multilingue ne doit afficher que les langues activées

---

## Import / Export

### Export

Le bouton **Export** doit pouvoir sortir :
- la fiche **FR**
- toutes les langues effectivement traduites

Format souhaité :
- **Markdown structuré**, propre, importable plus tard

Objectifs :
- réutiliser les fiches traduites plus tard
- préparer un futur export Etsy
- permettre l’archivage et la reprise

### Import

Le bouton **Importer** doit permettre :
- de reprendre un ancien pack markdown exporté
- d’importer une ancienne fiche créée avant l’émergence du pipeline
- de relancer la traduction plus tard sur une base existante

### Règle de conception

Le format MD doit être pensé comme un **format d’échange interne stable**.

Il doit pouvoir servir à :
- traduction future
- reprise d’anciennes fiches
- export plus tard vers Etsy

---

## Coûts / ledger / bench

Point crucial identifié :
- tant que la traduction n’est pas reliée correctement à la logique de **suivi de coûts**, il est impossible de décider sereinement si la feature vaut le coup

### Ce qui devra être suivi

Pour une fiche donnée :
- 1 appel **alias_lookup**
- 1 appel **translate_listing** par langue active

Donc en bench initial **EN uniquement** :
- sans alias auto → **1 appel**
- avec alias auto → **2 appels**

### Exigence validée

Le coût de :
- `alias_lookup`
- `translate_listing`

... doit remonter dans le ledger / monitoring coût comme le reste du pipe.

### Stratégie bench

Ne surtout pas bench à l’aveugle.

Bench recommandé :
1. EN uniquement
2. vérifier qualité alias
3. vérifier qualité trad
4. vérifier charge utilisateur réelle
5. vérifier coût réel par fiche

---

## Leçons de la tentative abandonnée

### Ce qu’il ne faut pas refaire

- ne pas pousser trop de couches d’un coup
- ne pas empiler settings + UI finale + traduction + alias + import/export + takeover en un seul chantier
- ne pas corriger patch après patch sur une base déjà dévoyée
- ne pas s’acharner sur un vieux snapshot ou une branche morte
- ne pas masquer l’ancien résultat tant que la nouvelle couche n’est pas 100 % fiable
- ne pas réinventer la roue si une donnée existe déjà dans le legacy
- ne pas multiplier les surcouches juste pour déplacer une donnée existante

### Diagnostic méthodologique validé

Le workflow patch était bon :
- les patchs passaient proprement
- `git apply --check` passait
- `git apply` passait
- les tests mécaniques sandbox passaient

Le problème venait de l’**intégration fonctionnelle réelle**, pas du protocole patch.

### Hypothèse forte retenue

Quand un patch n’atteint pas le résultat attendu, il ne faut pas forcément “corriger le patch précédent”.

Il faut souvent :
- revenir à une base propre
- repartir de zéro sur l’objectif ciblé
- éviter l’incrémental toxique sur de vieux snapshots

### Dette technique : vigilance

Le pipe fonctionne déjà avec un socle pas toujours très clean.
Il ne faut pas transformer la traduction en monstre de dette technique.

Règle validée :
- si la feature ne se branche pas proprement, **on arrête** au lieu de forcer

---

## Exigences techniques pour une reprise future

### Code

- **ECMAScript 2022 minimum**
- code propre et documenté
- pas de surcouche gratuite
- pas de duplication inutile du legacy
- réutiliser l’existant quand c’est pertinent

### DOM / UI

Quand une nouvelle UI est nécessaire :
- préférer des hooks stables en `data-*`
- exemples : `data-role`, `data-lang`, `data-field`, `data-action`
- éviter les sélecteurs fragiles sur texte / classes purement visuelles

### Architecture

- une seule source de vérité claire
- si le FR net existe déjà, l’exploiter proprement
- éviter de scraper le DOM comme stratégie principale, sauf fallback exceptionnel et documenté

### Stratégie de reprise technique

La prochaine reprise ne devra pas redémarrer sur la branche traduction abandonnée.

Elle devra repartir :
- depuis une branche stable (ex. `fix_alt`)
- sans reprise des anciens patches traduction
- avec un plan beaucoup plus strict et borné

---

## Feuille de route de reprise future

### Phase 0 — Observation

Avant toute nouvelle implémentation :
- identifier précisément **où vit la fiche FR nette**
- à quel moment elle est **figée**
- quel composant / quel state / quel render fait foi

### Phase 1 — Spike minimal

Faire un spike ultra simple pour valider :
- qu’une seconde vue peut consommer proprement le FR net existant
- sans takeover
- sans masquage
- sans traduction
- sans alias
- sans import/export

### Phase 2 — Bench EN uniquement

Une fois le pont FR validé :
- traduction EN seulement
- alias EN seulement
- coût tracké
- bench réel sur de vraies fiches

### Phase 3 — UI complète

Seulement si phase 2 validée :
- UI complète multilingue
- autres langues activables
- import/export finalisé

### Phase 4 — Export direct Etsy

Grosse feature structurante envisagée plus tard :
- export direct vers Etsy

À ce moment-là, le support de plusieurs langues deviendra beaucoup plus stratégique et plus naturel à exploiter.

---

## Résumé ultra court

- Feature traduction : **très intéressante**, mais **ajournée**
- Cible : **Collection + DnD**, pas Batch
- Langues prévues : **FR / EN / DE / ES**
- Déploiement : **EN d’abord**
- Traduction uniquement des **sorties net**
- Agent **alias** séparé
- Agent **traducteur** séparé
- Bloc alias en **4 colonnes par langue**
- Onglets résultat selon **langues activées**
- Import/export **markdown structuré**
- Coûts à suivre impérativement
- Ne pas reprendre la branche traduction abandonnée
- Repartir plus tard depuis une base stable avec une approche plus sèche

---

## Décision actuelle

**On abandonne la feature pour l’instant.**

Le sujet est documenté ici pour reprise ultérieure.

Maintenant :
- retour sur la branche stable
- reprise des **benchs du pipe** avec de nouvelles fiches produit

