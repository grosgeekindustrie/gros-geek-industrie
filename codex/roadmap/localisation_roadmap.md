# Roadmap — Localisation Etsy Pipeline

## Statut

Roadmap de cadrage pour la future feature **Localisation** du projet Etsy Pipeline.

Cette roadmap remplace les anciennes ébauches de traduction. Le terme important est désormais **localisation**, pas traduction.

Ordre fonctionnel validé :

```text
PIPE
↓
LOCALISATION
↓
PUBLICATION DRAFT ETSY
```

La localisation doit donc intervenir **après** le pipe et **avant** la publication Etsy.

---

## Objectif produit

Transformer la fiche FR nette issue du pipeline en une fiche multilingue prête à être publiée en brouillon Etsy.

La V1 cible :

```text
FR source validée
+
EN localisé validé
```

La localisation doit produire des contenus exploitables pour Etsy :

- titre localisé
- tags localisés
- description localisée
- alias personnage / univers si nécessaire

Elle ne doit pas faire du Google Trad amélioré. Elle doit adapter le texte au marché cible, aux habitudes de recherche et au vocabulaire hobby local.

---

## Périmètre V1

### Langues

V1 :

```text
FR = source / vérité
EN = langue cible
```

Autres langues prévues plus tard :

```text
DE
ES
IT éventuellement
```

Le code doit rester dynamique : ajouter une langue plus tard ne doit pas obliger à réécrire toute la logique ou les agents.

La V1 n'active que FR + EN, mais l'architecture doit être pensée avec un objet de configuration des langues.

Exemple conceptuel :

```js
const LOCALIZATION_LOCALES = {
  fr: {
    label: 'Français',
    source: true,
    enabled: true
  },
  en: {
    label: 'English',
    source: false,
    enabled: true,
    targetMarket: 'international'
  }
};
```

---

## Principe central

La localisation ne doit jamais partir :

- des données brutes
- des brouillons agents
- des sorties intermédiaires
- d'un DOM scrapé au hasard

Elle doit partir uniquement de la **fiche FR nette validée**.

Flow validé :

```text
Pipeline génère la fiche FR nette
↓
Utilisateur édite / valide la fiche FR
↓
Localisation EN depuis la fiche FR validée
↓
Utilisateur édite / valide la version EN
↓
Publication Draft Etsy
```

Si la fiche FR est modifiée après génération EN, la localisation EN doit être considérée comme potentiellement obsolète.

Statuts utiles :

```text
pending
localized
edited
validated
stale
```

---

## Champs concernés

### Champs localisés en V1

Priorité V1 :

```text
title
description
tags
```

Ces champs doivent exister en FR et EN.

### Champs non localisés en V1

Les ALT images ne sont pas localisées en V1.

Décision :

```text
ALT produit = globale
ALT images informatives = globales
```

Les ALT seront gérées côté publication / médias, pas comme une traduction listing par langue.

---

## Localisation marketplace, pas traduction littérale

La localisation doit adapter les formulations au marché cible.

Exemple de logique attendue :

FR :

```text
Sorcier Mort-Vivant - Nerikson, miniatures sorcier, faucheuse 28mm 32mm 75mm 90mm en résine à peindre pour Dnd TTRPG, figurine Tabletop
```

EN localisé attendu :

```text
Undead Warlock - Nerikson, unpainted resin wizard miniature, reaper figure 28mm 32mm 75mm 90mm for D&D TTRPG, tabletop miniature
```

Le titre EN ne doit pas traduire segment par segment. Il doit conserver les faits produit, mais réordonner les mots-clés selon les usages de recherche anglophones.

Règles :

- conserver le sculpteur
- conserver les échelles
- conserver le matériau
- conserver les informations techniques
- adapter les mots-clés au marché cible
- éviter les tournures littérales non naturelles
- éviter le keyword stuffing sale
- ne rien inventer

---

## Alias / identité locale

### Problème

Certaines licences ont des noms différents selon les langues ou marchés.

Exemple :

```text
FR : Gally / Gunnm
EN : Alita / Battle Angel Alita
```

Ce point est crucial pour les fiches licence safe.

Il est moins utile pour les produits tabletop génériques.

### Décision

La localisation doit intégrer une étape d'identité locale / alias.

Cette étape doit identifier :

- nom personnage FR
- nom univers FR
- nom personnage EN
- nom univers EN
- termes à conserver
- termes à ne pas traduire littéralement

### Agent alias dédié

L'agent alias doit être séparé de l'agent localisateur.

Rôle :

- détecter si le nom du personnage change en EN
- détecter si le nom de l'univers change en EN
- proposer les alias locaux
- remplir les champs même si les noms sont identiques
- ne pas inventer d'alias fantaisistes
- laisser l'utilisateur corriger

Sortie conceptuelle :

```js
const identityAliases = {
  fr: {
    characterName: 'Gally',
    universeName: 'Gunnm'
  },
  en: {
    characterName: 'Alita',
    universeName: 'Battle Angel Alita'
  }
};
```

---

## Agent localisateur

### Rôle

L'agent localisateur produit la version EN depuis la fiche FR validée et les alias validés.

Il doit produire :

- titre EN
- tags EN
- description EN

Il doit utiliser les alias comme glossaire prioritaire.

### Contraintes

L'agent doit :

- localiser, pas traduire littéralement
- préserver tous les faits techniques
- préserver les dimensions
- préserver les échelles
- préserver le sculpteur
- préserver le matériau
- préserver le positionnement produit
- respecter les contraintes Etsy
- garder un anglais naturel pour le marché miniature / tabletop / garage kit

Il ne doit pas :

- inventer des caractéristiques
- changer le produit
- ajouter des promesses commerciales abusives
- supprimer des informations techniques
- transformer le ton en marketing creux
- faire un simple replace mot à mot

---

## QA localisation

Une passe QA est souhaitable, mais elle peut être légère en V1.

Objectifs QA :

- vérifier que les faits FR sont conservés
- vérifier que les alias sont correctement utilisés
- vérifier que les tags EN sont naturels
- vérifier que le titre EN est lisible et orienté recherche
- vérifier qu'aucune info technique n'a disparu
- signaler les doutes

Statut final attendu avant publication :

```text
EN validated
```

Sans validation EN, la publication doit afficher un warning.

---

## UX / UI — cadrage léger

Une spec UX/UI dédiée sera faite plus tard.

Pour cette roadmap, on acte seulement les principes.

### Vue source FR

La fiche FR issue du pipe devient éditable :

- titre FR
- tags FR
- description FR

La localisation ne peut être lancée proprement qu'après validation de cette fiche FR.

### Bloc alias

Le bloc alias doit être visible avant la localisation EN.

Champs V1 :

```text
FR character name
FR universe name
EN character alias
EN universe alias
```

Actions possibles :

```text
Détecter alias
Valider alias
Modifier manuellement
```

### Onglets ou panneaux de langue

V1 :

```text
FR
EN
```

Les champs EN doivent être éditables après génération.

### États visibles

L'UI doit afficher clairement :

```text
FR non validé
FR validé
EN non généré
EN généré
EN modifié
EN validé
EN stale si FR modifié après génération
```

---

## Coûts / ledger

Les appels localisation doivent être suivis dans le ledger coûts.

Appels V1 possibles :

```text
alias_lookup_en
localize_listing_en
localization_qa_en éventuellement
```

Bench initial recommandé :

```text
FR + EN uniquement
1 fiche licence safe
1 fiche tabletop générique
1 fiche collection simple
```

Objectif : mesurer le coût réel avant d'ouvrir DE / ES.

---

## Architecture attendue

La localisation doit consommer un objet propre, pas un DOM fragile.

Objets conceptuels :

```text
PipelineListingFR
IdentityAliases
LocalizedListing
LocalizationStatus
```

La publication Etsy doit consommer ensuite l'objet localisé validé.

Architecture cible :

```text
PipelineListingFR
↓
LocalizedListing FR+EN
↓
EtsyDraftPreparation
```

---

## Interdictions V1

Ne pas faire en V1 :

- DE / ES / IT
- traduction de toutes les langues d'un coup
- agent par champ et par langue
- ALT localisées
- publication directe Etsy active
- update de fiches actives
- import catalogue Etsy
- reprise de vieille branche traduction abandonnée
- branchement sur des snapshots anciens

---

## Critères d'acceptation V1

La V1 Localisation est acceptable si :

- la fiche FR nette est éditable
- la fiche FR peut être validée
- l'alias EN peut être détecté ou rempli manuellement
- la localisation EN est générée depuis le FR validé
- titre / description / tags EN sont éditables
- l'utilisateur peut valider EN
- les statuts FR/EN sont clairs
- le coût des appels remonte dans le ledger
- la publication Draft Etsy peut consommer FR + EN validés

---

## Décision finale

La localisation est une étape obligatoire entre le pipeline et la publication Etsy.

V1 :

```text
FR validé
↓
EN localisé validé
↓
Publication Draft Etsy
```

La feature doit rester dynamique, mais la V1 reste volontairement limitée à EN pour éviter de créer une usine à gaz.
