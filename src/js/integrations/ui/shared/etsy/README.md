# Etsy Shared UI

Ce dossier contient le rendu UI commun Etsy, partage entre `tabletop` et `collection`.

## Modules

- `workspace_core_ui.js`
  - helpers UI de base, texte, status
- `workspace_steps_ui.js`
  - source panel, progress, steps, sections details/options
- `workspace_details_ui.js`
  - categorie, titre, description, affichage details, category picker
- `workspace_media_ui.js`
  - summary, toolbar, grid media, cartes image/video, lightbox, image editor overlay
- `workspace_options_ui.js`
  - tableau options/produits

## Regles

- hooks JS via `data-*`
- classes CSS reservees au visuel
- modules shared sans connaissance directe du contexte tabletop/collection
- le wiring contextuel vit dans `ui/tabletop/etsy` et `ui/collection/etsy`
