# Etsy Front Architecture

Cette documentation couvre l'organisation du domaine Etsy dans `src/js/integrations`.

## Objectif

Le refactor Etsy isole maintenant trois couches stables:

- `data/etsy`: transformations pures et normalisation du payload Etsy
- `runtime/etsy`: etat, services, bridges runtime et orchestration
- `ui/**/etsy`: rendu et bootstrap UI par zone fonctionnelle et par contexte

Le but est de preparer l'ajout d'autres integrations sans remettre des fichiers Etsy a la racine de chaque domaine.

## Regles structurelles

- pas de bundler
- JS moderne ES2022
- hooks DOM via `data-*`
- UI/CSS existants conserves
- points d'entree par `index.js`

## Arborescence Etsy

- `data/etsy`
  - helpers purs pour listings, taxonomie, options, variations, inventory
- `runtime/etsy`
  - etat workspace, appels API, cache local, bridges Filerobot, orchestration workspace
- `ui/shared/etsy`
  - rendu commun Etsy: steps, details, media, modales, options
- `ui/tabletop/etsy`
  - bootstrap Etsy pour le contexte tabletop
- `ui/collection/etsy`
  - bootstrap Etsy pour le contexte collection

## Fichier de compatibilite

`runtime/etsy/workspace_ui.js` est maintenant une facade courte de compatibilite.
Les bridges workspace associes vivent dans `runtime/etsy/workspace_*_bridge.js`.

Responsabilites restantes:

- exposer l'API publique globale `PipelineUIEtsyWorkspace`
- deleguer l'init vers les bridges runtime deja decoupes
- conserver le bootstrap global existant

Le metier Etsy ne doit plus etre reintroduit dans cette facade.

## Conventions de maintenance

- si une logique manipule seulement des donnees Etsy: `data/etsy`
- si une logique touche fetch, cache, editeur, etat ou orchestration: `runtime/etsy`
- si une logique rend du DOM Etsy ou bind des interactions UI: `ui/**/etsy`
- si un nouveau fichier Etsy est ajoute, il doit vivre dans un sous-repertoire `etsy/` du domaine correspondant
