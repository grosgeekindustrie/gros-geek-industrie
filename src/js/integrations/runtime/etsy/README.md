# Etsy Runtime

Ce dossier porte la couche d'execution Etsy.

## Responsabilites

- etat workspace Etsy
- appels API Etsy et routes serveur associees
- cache local
- bridges Filerobot et media
- orchestration workspace
- bridges entre runtime et modules UI shared

## Sous-blocs actuels

- `runtime_state.js`
  - source d'etat `tt` / `col`
- `runtime_api.js`
  - fetch listing, taxonomie, routes Etsy
- `runtime_cache.js`
  - cache reference, cache taxonomie, sync payload texte
- `runtime_editor.js`
  - ouverture editeur image et fallback de routes media cache
- `runtime_helpers.js`
  - helpers runtime partages: nodes, fichiers, medias, utilitaires browser
- `runtime_media.js`
  - reorder, ajout, suppression, lightbox selection
- `runtime_workspace.js`
  - drafts details/options, sync panels, category picker state
- `workspace_modals_bridge.js`
  - pont runtime -> modales/options shared
- `workspace_render_bridge.js`
  - pont runtime -> rendu shared steps/details/media
- `workspace_runtime_bridge.js`
  - pont runtime -> orchestration workspace finale
- `workspace_ui.js`
  - facade publique de compatibilite

## Regles

- pas de HTML inline de rendu metier ici
- si un module commence a produire du DOM complexe, il doit aller dans `ui/shared/etsy`
- les bridges runtime servent a sortir l'assemblage hors de la facade finale
