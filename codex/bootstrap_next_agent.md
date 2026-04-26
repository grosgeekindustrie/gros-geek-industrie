# Handoff Bootstrap - prochain agent

Date: 2026-04-26
Branche de travail: `bootstrap`
Etat: dernier lot teste par l'utilisateur et valide

## 1. Resume tres court

Le chantier bootstrap a avance par lots coherents et committe.
Les derniers lots sur le pipeline runtime et ses coutures UI ont ete testes par l'utilisateur et juges OK.

Commits recents utiles:

- `0bd74eb` - Clean pipeline files API image helpers
- `0586df7` - Refactor Claude request assembly helpers
- `a72a565` - Remove unused pipeline orchestrator
- `c78bc8d` - Refactor pipeline agent execution flow
- `0674a86` - Refactor pipeline launch state flow

## 2. Ce qui est deja fait

### `pipeline-api.js`

- assainissement du sous-bloc Files API / images Anthropic
- factorisation de la preparation de requete Claude
- nettoyage du flow `runAgent + startPipeline`
- centralisation de morceaux launch/runtime lies au pipeline
- suppression du bloc orchestrateur mort

### Transverse runtime / UI

- nettoyage des coutures `launch state / reprise / rerun`
- resolution des agents runtime par prefixe
- tabs solo et selections raccordes aux bons agents runtime

Fichiers touches dans le dernier lot transverse:

- `src/js/pipeline/runtime/config_ui.js`
- `src/js/app/boot/pipeline-ui.js`
- `src/js/pipeline/ui/shared/selections_ui.js`
- `src/js/pipeline/ui/collection/collection_tabs_ui.js`
- `src/js/pipeline/ui/tabletop/dnd_tabs_ui.js`

Verification faite pendant ce lot:

- `node --check src/js/pipeline/runtime/config_ui.js`
- `node --check src/js/app/boot/pipeline-ui.js`
- `node --check src/js/pipeline/ui/shared/selections_ui.js`
- `node --check src/js/pipeline/ui/collection/collection_tabs_ui.js`
- `node --check src/js/pipeline/ui/tabletop/dnd_tabs_ui.js`

## 3. Regles de travail confirmees par l'utilisateur

- ne pas travailler sur un fichier isole seulement
- prendre des lots fonctionnels coherents
- inclure les fichiers transverses directement relies au flux traite
- resume court
- commit en fin de lot
- pas de tests pipeline Anthropic reels sauf demande explicite

En clair:

un lot peut etre centre sur `pipeline-api.js`, mais il doit embarquer les autres fichiers du flux si la couture les concerne vraiment

## 4. Point explicitement abandonne pour l'instant

Le bug Collection sur l'echelle custom `1/5` a ete regarde puis laisse de cote.
Les tentatives de fix ont ete rollbackees a la demande de l'utilisateur.

Donc pour le prochain agent:

- ne pas repartir sur ce bug maintenant
- ne pas reintroduire de modifications sur:
  - `src/js/pipeline/ui/shared/forms_ui.js`
  - `src/js/shared/media/echelles_ui.js`
  - `src/css/04-form-layout.css`

sauf demande explicite de l'utilisateur

## 5. Etat du worktree a respecter

Il existe des changements non lies a ne pas toucher:

- `biblios/tabletop/titres.md` modifie
- `codex/` contient les fichiers de handoff

## 6. Prochain point roadmap recommande

Le step bootstrap suivant devrait rester **transverse** et continuer a reduire la complexite autour du coeur pipeline sans repartir sur un micro-lot.

Le candidat le plus logique:

**poursuivre l'assainissement du flux runtime restant autour de `pipeline-api.js`, avec ses coutures directes, probablement sur le bloc `pipeline control / launch panels / run state / cache-aware bridge` si ce n'est pas deja suffisamment stabilise, ou passer au bloc fonctionnel suivant le plus proche et encore dense**

Important:

- ne pas retomber sur un lot mono-fichier artificiel
- prendre le flux complet utile
- si le centre est `pipeline-api.js`, embarquer les consommateurs directs

## 7. Starter prompt conseille

`On reprend sur bootstrap. Lis codex/bootstrap_next_agent.md. Le dernier lot launch state / rerun / tabs a ete teste OK. On continue la roadmap par un lot transverse coherent autour du prochain gros flux vivant restant. Pas de fichier isole, prends aussi les coutures directes dans les autres fichiers. Resume court, commit en fin de lot.`
