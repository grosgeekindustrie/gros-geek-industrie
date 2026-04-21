# Architecture — Etsy Pipeline (post-batch)

## Base de référence

Document rédigé à partir de l’état réel du projet au commit :

`ef3fc42b939c7876f8549db5c6932be3608baa58`

Objectif : disposer d’un état des lieux **utile, court et à jour** après la sortie du batch du flux vivant.

---

## 1. Vue d’ensemble

L’application est une **SPA front-end** organisée autour de **3 vues principales** :

- **Home** : choix du mode de travail
- **Form** : saisie et navigation par onglets/stepper
- **Pipeline** : exécution, timeline et affichage dynamique des sorties

Le shell principal contient aussi :

- un **header global**
- un **settings panel**
- plusieurs **lightboxes communes**
- les deux blocs métier séparés : **Tabletop** et **Collection**

### Point important

Le **batch n’est plus un flux vivant**.
Il n’y a plus de point d’entrée batch dans la home, plus de module batch chargé par le HTML, et plus de documentation utile à maintenir autour de ce flux dans l’architecture courante.

---

## 2. Point d’entrée HTML

Le point d’entrée principal reste :

`src/etsy-pipeline-dnd-v1_2.html`

Ce fichier porte encore l’essentiel du DOM applicatif et sert de contrat de liaison avec le runtime JS.

### Structure principale du DOM

- `div.app-shell`
- `header#appHeader`
- `div#view-home`
- `div#view-form`
  - `div#ui-tt`
  - `div#ui-col`
- `div#view-pipeline`
- lightboxes communes
- scripts chargés en bas de page

### Contrat legacy encore en place

Le HTML repose encore fortement sur :

- des `id`
- des `onclick` inline
- des blocs DOM attendus par les helpers UI

Tant qu’aucune abstraction stable n’est validée, ces contrats doivent être considérés comme **sensibles**.

---

## 3. Modes métier vivants

## 3.1 Tabletop

Bloc principal :

`#ui-tt`

Organisation actuelle :

- navigation par onglets solo
- stepper 5 étapes
- pipeline dédié
- résultat final
- bloc réseaux sociaux

Étapes du formulaire :

1. Images
2. Identité
3. Échelles
4. Détails & contexte
5. Lancement

Éléments métier notables :

- gestion du type produit, version, présentation visuelle, nature du sujet
- archétypes, SEO élargies, connexes prioritaires
- recherche sémantique **IRIS** hors pipeline global
- production finale : titre, tags, description, ALT
- extension sociale : Léo + Camille

## 3.2 Collection

Bloc principal :

`#ui-col`

Organisation actuelle :

- navigation par onglets solo
- stepper 5 étapes
- pipeline dédié
- résultat final
- bloc réseaux sociaux

Étapes du formulaire :

1. Images
2. Identité
3. Échelles
4. Détails & contexte
5. Lancement

Éléments métier notables :

- licence sensible
- type de pièce
- medium
- fetch personnage
- IRIS hors pipeline global
- production finale : titre, tags, description, ALT
- extension sociale : Theo + Zoe

---

## 4. Vue Pipeline

Bloc principal :

`#view-pipeline`

Rôle :

- afficher le contexte de run
- afficher la timeline pipeline
- accueillir dynamiquement les panneaux déplacés depuis la vue formulaire

Le pipeline view body est alimenté par le JS, ce n’est pas une vue autonome totalement déclarative.

---

## 5. Lightboxes communes

Les lightboxes encore vivantes dans le HTML sont :

- **Biblio Lightbox**
- **Prompt Lightbox**
- **Raw Input Lightbox**
- **Explorer Lightbox**

Elles sont partagées entre les deux modes métier.
Leur structure DOM est consommée par plusieurs helpers UI.

---

## 6. Chargement CSS réel

Le chargement CSS actif est désormais découpé en **8 fichiers** :

1. `css/00-var.css`
2. `css/01-legacy-base.css`
3. `css/02-ui-pro.css`
4. `css/03-header-settings.css`
5. `css/04-form-layout.css`
6. `css/05-library-gpt.css`
7. `css/06-inline-merged.css`
8. `css/07-tags-selection.css`

### Règle importante

`00-var.css` reste le **point d’entrée des variables globales**.
Les autres couches doivent consommer ces variables, pas les redéfinir sans nécessité.

### Lecture actuelle de la cascade

- `00-var.css` : variables globales
- `01-legacy-base.css` : base historique encore vivante
- `02-ui-pro.css` : surcouche UI moderne
- `03-header-settings.css` : header + settings
- `04-form-layout.css` : layout des formulaires
- `05-library-gpt.css` : lightboxes / library
- `06-inline-merged.css` : résidu inline consolidé
- `07-tags-selection.css` : UI spécifique sélection tags

---

## 7. Chargement JS réel

Le chargement JS suit encore une logique simple :

1. modules UI
2. bridge / orchestration front
3. moteur pipeline
4. runtime dev pipeline

### Ordre actuel des scripts chargés

#### UI core et rendering

- `js/ui/helper_ui.js`
- `js/ui/render_ui.js`
- `js/ui/modals_ui.js`
- `js/ui/tags_ui.js`
- `js/ui/title_ui.js`
- `js/ui/library_ui.js`

#### Data UI

- `js/ui/data/pipeline_modes_data.js`
- `js/ui/data/pipeline_agents_data.js`
- `js/ui/data/prompt_maps_data.js`
- `js/ui/data/pipeline_dev_data.js`
- `js/ui/data/form_fields_data.js`
- `js/ui/data/stepper_steps_data.js`
- `js/ui/data/echelles_data.js`
- `js/ui/data/form_catalogs_data.js`

#### Configuration / shell / formulaires

- `js/ui/config_ui.js`
- `js/ui/shell_ui.js`
- `js/ui/prompt_biblio_ui.js`
- `js/ui/echelles_ui.js`
- `js/ui/image_tools_ui.js`
- `js/ui/indexeddb_ui.js`
- `js/ui/images_ui.js`
- `js/ui/forms_ui.js`

#### Stepper / tabs / cards / selections

- `js/ui/stepper_core_ui.js`
- `js/ui/solo_tabs_core_ui.js`
- `js/ui/dnd_stepper_ui.js`
- `js/ui/dnd_tabs_ui.js`
- `js/ui/collection_stepper_ui.js`
- `js/ui/collection_tabs_ui.js`
- `js/ui/cards_ui.js`
- `js/ui/selections_ui.js`
- `js/ui/app_ui.js`

#### Pipeline

- `js/pipeline-ui.js`
- `js/pipeline-api.js`
- `js/ui/pipeline_dev_runtime_ui.js`

### Conséquence architecturale

`pipeline-ui.js` doit rester un **bridge / orchestrateur front**, pas un fichier fourre-tout.
`pipeline-api.js` porte le runtime pipeline.
Les modules `ui/*` doivent rester les plus spécialisés possible.

---

## 8. Responsabilités actuelles par couche

## 8.1 HTML

Responsable de :

- la structure du shell
- la présence des vues
- les contrats DOM
- les points d’entrée utilisateurs
- la liste réelle des assets chargés

## 8.2 CSS

Responsable de :

- la cascade visuelle
- les couches layout / UI / lightboxes / tags
- le maintien d’un socle encore partiellement legacy

## 8.3 JS UI

Responsable de :

- l’initialisation UI
- la navigation home / form / pipeline
- les formulaires
- les images
- les stepper/tabs
- les cartes agents
- les sélections finales
- les modales communes

## 8.4 Pipeline

Responsable de :

- l’orchestration front des runs
- l’exécution réelle du pipeline
- les statuts
- les sorties
- le runtime dev associé

---

## 9. Conventions de prudence

Tant que le clean global n’est pas terminé :

- ne pas renommer un `id` sans audit JS complet
- ne pas supprimer un `onclick` inline sans vérifier le bridge associé
- ne pas fusionner trop tôt `#ui-tt` et `#ui-col`
- ne pas faire de refacto de style en même temps qu’un changement de logique
- ne pas supposer qu’un fichier legacy est mort sans vérifier qu’il est chargé ou appelé

---

## 10. État post-batch

Le batch est désormais **hors flux vivant**.
Cela signifie en pratique :

- pas d’entrée batch sur la home
- pas de script batch chargé dans le HTML
- pas de couche CSS batch encore active dans le chargement courant
- plus de batch documenté comme voie d’usage normale

Le prochain travail ne doit donc plus porter sur le batch, mais sur le **clean code transverse**.

---

## 11. Chantiers suivants recommandés

Ordre conseillé :

1. audit des fichiers réellement vivants
2. suppression des fichiers orphelins restants
3. audit des helpers morts / exports inutiles
4. audit des sélecteurs CSS non référencés
5. harmonisation documentaire
6. ensuite seulement, modernisation ES2022 ciblée

---

## 12. Résumé court

L’architecture actuelle est maintenant centrée sur :

- un shell unique
- trois vues principales
- deux modes métier vivants : Tabletop et Collection
- un pipeline solo, pas batch
- un chargement CSS en 8 couches
- un chargement JS modulaire avant `pipeline-ui.js` puis `pipeline-api.js`

Le chantier prioritaire n’est plus la purge batch.
Le chantier prioritaire devient : **inventaire du vivant, suppression du mort, puis modernisation ciblée**.
