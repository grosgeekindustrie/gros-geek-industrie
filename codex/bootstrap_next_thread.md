# Handoff Bootstrap - prochain fil

Date: 2026-04-26
Branche de travail: `bootstrap`
Etat: dernier lot runtime committe, checks JS OK

## 1. Resume tres court

Le chantier bootstrap a continue a vider `src/js/pipeline/runtime/pipeline-api.js` par lots transverses reels, sans big-bang.

Les derniers lots valides ont sorti du fichier:

- le flux `launch / cache-aware prelaunch / pipeline control`
- le bloc `cache/debug/launch-summary`

Le runtime est maintenant branche ainsi:

- `src/js/pipeline/runtime/pipeline-api.js`
- `src/js/pipeline/runtime/cache_runtime_ui.js`
- `src/js/pipeline/runtime/launch_runtime_ui.js`

## 2. Commits recents utiles

- `3a27874` - Bootstrap runtime launch module
- `892b782` - Extract pipeline launch control
- `3c185e7` - Introduce pipeline cache runtime module
- `009f821` - Prune pipeline cache runtime duplicates

## 3. Ce qui est deja fait

### `pipeline-api.js`

Ce qui n'est plus dans `pipeline-api.js`:

- le pilotage UI de lancement
- le cache-aware prelaunch
- le launch panel state
- le bloc `cache/debug/launch-summary`

Ce qui reste encore principalement dedans:

- `callClaude`
- retries / requetes Anthropic
- Files API / images
- `runAgent`
- exports / costs
- le bloc `social`

### Runtime transverse

Modules runtime deja poses:

- `src/js/pipeline/runtime/cache_runtime_ui.js`
- `src/js/pipeline/runtime/launch_runtime_ui.js`

Coutures deja raccordees:

- `src/js/pipeline/index.js`
- `src/js/app/boot/pipeline-ui.js`
- `src/js/pipeline/dev/pipeline_dev_runtime_ui.js`
- `src/js/pipeline/ui/collection/collection_tabs_ui.js`
- `src/js/pipeline/ui/tabletop/dnd_tabs_ui.js`
- `src/js/app/shell/app_ui.js`

## 4. Incident recent a connaitre

Une regression de branchement a existe juste apres l'extraction launch:

- `syncStandaloneLaunchButtons` pas exposee correctement
- appel nu a `refreshPipelineLaunchPanels()` reste dans `pipeline-api.js`

Elle a ete corrigee ensuite et l'utilisateur a confirme:

- plus d'erreur console

Les verifs faites sur les derniers lots:

- `node --check src/js/pipeline/runtime/pipeline-api.js`
- `node --check src/js/pipeline/runtime/cache_runtime_ui.js`
- `node --check src/js/pipeline/runtime/launch_runtime_ui.js`
- `node --check src/js/pipeline/index.js`
- `node --check src/js/app/boot/pipeline-ui.js`

## 5. Regles de travail confirmees par l'utilisateur

- avancer par lots transverses coherents
- ne pas faire un lot mono-fichier artificiel
- prendre aussi les coutures directes dans les autres fichiers
- resume court
- commit en fin de lot
- pas de tests Anthropic reels sauf demande explicite

## 6. Zones a ne pas retoucher sans demande explicite

Le bug Collection autour de l'echelle custom a ete volontairement laisse de cote.

Ne pas repartir dessus sans demande claire.

Ne pas modifier:

- `src/js/pipeline/ui/shared/forms_ui.js`
- `src/js/shared/media/echelles_ui.js`
- `src/css/04-form-layout.css`

## 7. Etat du worktree a respecter

Il y a des changements hors lot a ne pas toucher:

- `biblios/tabletop/titres.md` modifie
- `codex/` contient les fichiers de handoff

## 8. Prochain lot recommande

Le candidat le plus coherent maintenant:

**sortir le bloc `social` de `pipeline-api.js` dans un module runtime dedie, avec ses coutures UI directes**

Pourquoi:

- `launch` et `cache/debug` sont deja dehors
- `social` reste un sous-flux vivant assez autonome
- cela evite d'attaquer tout de suite le noyau le plus risqué `callClaude / runAgent / Files API`

Forme conseillee du lot:

- extraire `runReseauxOnly`
- prendre ses helpers immediats
- reprendre les boutons / outputs / disabled states lies au flux
- laisser pour plus tard le coeur `callClaude`, images, retries, couts

## 9. Starter prompt conseille

`On reprend sur bootstrap. Lis codex/bootstrap_next_thread.md. Les lots launch et cache runtime sont deja sortis de pipeline-api.js et testes OK. On continue la roadmap par un lot transverse coherent autour du prochain gros flux vivant restant, plutot sur social, avec ses coutures directes et pas en mono-fichier. Resume court, commit en fin de lot.`
