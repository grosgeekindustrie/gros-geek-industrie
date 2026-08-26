# Handoff Bootstrap - prochain agent

Date: 2026-04-25
Branche de travail: `bootstrap`
Etat: chantier courant cloture et committe

## 1. Contexte rapide

Le projet suit la roadmap de `features/roadmap/refonte_moderne.md`.
Le social n'est pas la priorite.
La priorite validee par l'utilisateur est:

1. assainir la codebase
2. stabiliser le fonctionnement
3. poursuivre le clean code en ES2022 minimum
4. continuer la refonte sans casser le vivant

Le gros deplacement d'architecture a deja ete fait avant ce chat.
Le chantier de ce chat etait un lot de consolidation/cleanup sur la branche `bootstrap`.

## 2. Topo global de la roadmap

La roadmap transmise au debut vise, dans cet ordre logique:

1. debrancher le batch du vivant
2. supprimer le code mort a partir du vivant reel
3. homogeniser le code en ES2022 minimum
4. poser des conventions claires de modules, imports, constantes et logs
5. consolider l'architecture par domaines (`app`, `pipeline`, `shared`, puis plus tard `social`)
6. stabiliser la base avant d'ouvrir le vrai chantier social

Philosophie de travail voulue:

- pas de gros patchs opaques
- pas de refonte "artistique"
- avancer par blocs coherents
- commit quand un lot est propre
- si un point roadmap est casse/traite, ouvrir un nouveau chat pour le suivant

## 3. Ce qui a ete fait dans ce chantier

### Bootstrap et structure

- consolidation des manifests bootstrap:
  - `src/js/index.js`
  - `src/js/app/index.js`
  - `src/js/pipeline/index.js`
  - `src/js/shared/index.js`
  - `src/js/social/index.js`
- ordre de chargement clarifie
- protection contre doublons de scripts
- manifest debug expose

### Batch / code mort / nettoyage initial

- suppression de la route batch serveur legacy dans `server.py`
- suppression de `BATCH_EXPORT_ROOT`
- suppression du helper mort `extractMarkdownSectionValue(...)` dans `src/js/pipeline/runtime/pipeline-api.js`
- correction de typo dev `descrition` -> `description` dans `src/js/pipeline/dev/pipeline_dev_data.js`

### Assainissement `pipeline-ui.js`

- nettoyage des helpers de reprise/relaunch
- extraction de petits helpers (`savePersistentRules`, `getOutputText`, `getCopyAllOutputAgents`, etc.)
- assainissement de `refreshRules`, `assembleFinal`, `copyOut`, `copyAllOutputs`
- neutralisation des textes mojibakes les plus genants dans cette zone

### Assainissement transverse shell/UI

- nettoyage de `src/js/app/shell/app_ui.js`
- nettoyage de `src/js/app/shell/shell_ui.js`
- extraction de labels/messages UI en constantes
- reduction des textes fragiles / encodage sensible
- timeline shell rendue plus robuste avec constantes dediees

### Assainissement `pipeline-api.js`

- `FILES_API_STATUS_CLASSES`
- `CACHE_FRESHNESS_CLASSES`
- `CACHE_FRESHNESS_CLASS_BY_STATE`
- `DEFAULT_PIPELINE_PREFIXES`
- `PIPELINE_LAUNCH_LABEL`
- `PIPELINE_LAUNCH_DEFAULT_SCOPE`
- `getPipelinePrefixesForLaunchPanels()`

Ces changements sont des cleanups locaux, sans changement volontaire du flow Anthropic.

## 4. Commits utiles deja presents

- `5bea892` - Consolidate bootstrap and clean runtime scaffolding
- `ce312be` - Clean pipeline API files-state constants
- `5af0be5` - Clean cache freshness state mapping
- `37f7b25` - Clean pipeline launch panel defaults
- `3362efa` - Clean UI shell and pipeline panel helpers

## 5. Ce qu'il reste a faire

### Reste global

- continuer le debranchement complet du legacy restant
- poursuivre l'inventaire vivant / legacy tolere / mort
- continuer le passage ES2022 sur les fichiers pivots
- sortir davantage de constantes et contrats implicites
- reduire la dette dans les gros fichiers pivots

### Zones encore sensibles

- `src/js/pipeline/runtime/pipeline-api.js`
- `src/js/app/boot/pipeline-ui.js`
- `src/js/pipeline/ui/shared/forms_ui.js`
- `src/js/app/shell/app_ui.js` et `shell_ui.js` sont plus propres, mais pas "finis"

### A ne pas faire

- ne pas ouvrir le chantier social maintenant
- ne pas lancer de tests pipeline reels qui consomment des appels Anthropic juste pour valider un refactor
- ne pas melanger contenu metier et cleanup technique dans le meme commit

## 6. Prochain point roadmap recommande

Point recommande pour le prochain chat:

**Poursuivre l'assainissement du vivant par un bloc coherent de clean code ES2022 + nettoyage legacy sur `src/js/pipeline/ui/shared/forms_ui.js`.**

Pourquoi ce choix:

- on vient de fermer un lot sur bootstrap + shell + pipeline-ui
- il est sain de repartir de facon transverse au lieu de retomber tout de suite dans `pipeline-api.js`
- `forms_ui.js` est un bon candidat pour continuer l'assainissement visible sans attaquer immediatement le coeur runtime

Alternative acceptable si besoin:

**prendre un vrai sous-bloc moyen de `src/js/pipeline/runtime/pipeline-api.js`, mais pas un micro-patch.**

## 7. Regles de travail pour le prochain agent

- resume court
- un seul point roadmap par chat
- commit en fin de lot coherent
- ne pas relire toute l'histoire si le fichier `codex/bootstrap_handoff.md` suffit
- pas de test pipeline Anthropic sauf demande explicite

## 8. Message de reprise conseille

Message suggere pour ouvrir le prochain chat:

`On reprend sur la branche bootstrap. Lis codex/bootstrap_handoff.md. Nouveau point roadmap: assainissement forms_ui.js. Resume court, commit en fin de lot.`
