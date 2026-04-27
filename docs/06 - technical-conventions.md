# Conventions techniques

Socle minimal a respecter pendant la refonte moderne.

## Portee

- ES2022 minimum.
- `const` par defaut, `let` seulement si mutation reelle.
- Pas de nouveau legacy implicite dans `window`.
- Pas de logique metier lourde dans les modules UI shell.

## Constantes partagees

- Les modes et prefixes pipeline vivent dans `src/js/shared/constants/pipeline_constants.js`.
- Les statuts runtime/timeline partages doivent venir de ce socle avant d'introduire une nouvelle chaine magique.
- Les modules vivants doivent preferer les helpers `getPipeline*` quand ils existent deja.

## Logs

- Utiliser `PipelineUILogger.createLogger(...)` plutot que `console.*` brut.
- Prefixes courants: `app`, `ui`, `pipeline`, `storage`, `media`.
- Garder des messages courts, actionnables, et lies au domaine.

## Responsabilites

- `app/`: shell, navigation, orchestration globale.
- `pipeline/data/`: config declarative, labels, mappings.
- `pipeline/runtime/`: execution, etat runtime, integrations.
- `shared/`: constantes, helpers techniques, stockage, media.

## Regle de refonte

- Homogeneiser d'abord les modules vivants.
- Eviter les patchs purement cosmetiques sans gain de lisibilite ou de contrat.
- Si une chaine magique devient transverse, la sortir du module avant d'etendre son usage.
