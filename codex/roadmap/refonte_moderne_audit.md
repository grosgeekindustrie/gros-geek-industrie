# Audit Vivant / Legacy / Mort

## Statut

Cette note sert de checkpoint apres la fermeture du chantier `bootstrap / contracts / legacy cleanup`.

Etat actuel:

- `vivant stabilise`: bootstrap app/pipeline, runtime pipeline, UI partagee, social runtime
- `legacy tolere`: quelques fallbacks fonctionnels de contenu ou de DOM, pas de doubles chemins structurels
- `mort deja retire`: anciens restes batch vivants, stub `pipeline-api.js`, vieux chemins storage `pipeline_form_*` / `pipeline_rules`

## Vivant

- `src/js/index.js`: loader bootstrap unique.
- `src/js/app/**`: shell et orchestration app
- `src/js/pipeline/data/**`: sources declaratives pipeline
- `src/js/pipeline/runtime/**`: runtime vivant par domaines
- `src/js/pipeline/ui/**`: UI pipeline partagee + tabs/steppers
- `src/js/shared/**`: images, indexeddb, echelles

## Legacy Tolere

- guards DOM ponctuelles sur des noeuds HTML qui peuvent manquer selon la vue
- fallbacks metier d export si des champs sont vides
- quelques comportements de secours locaux dans des flows image/echelles/modals

Ces points ne relevent plus de l ancien monolithe ni du batch; ce sont des tolerances d execution normales.

## Mort Retire

- chargement bootstrap de `src/js/pipeline/runtime/pipeline-api.js`
- fichier `src/js/pipeline/runtime/pipeline-api.js`
- compat localStorage `pipeline_form_*`
- compat localStorage `pipeline_rules`
- compat formulaire collection `_contextePerso`
- compat formulaire collection `col-fNotes` comme secours de description
- plusieurs chemins globaux optionnels historiques entre shell, launch, output, selections et bootstrap

## Prochain Axe

- etendre l audit au reste du repo hors coeur pipeline si necessaire
- supprimer d autres reliquats seulement quand ils sont confirmes morts
- ne pas rouvrir de chantier bootstrap sauf regression
