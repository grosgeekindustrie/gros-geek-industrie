# Architecture — Etsy Pipeline

## 1. Objectif du document

Ce document décrit l’architecture actuelle de l’application **Etsy Pipeline** afin de cadrer le travail des agents et des futurs refactors.

Objectifs :

- expliquer la structure réelle du projet ;
- documenter les responsabilités HTML / CSS / JS ;
- préciser l’ordre de chargement et les dépendances ;
- fixer les règles de contribution pour éviter une nouvelle dérive de la base ;
- préparer une trajectoire compatible avec une future mise en production.

---

## 2. Vue d’ensemble

L’application est une interface front-end mono-page organisée autour de **trois vues principales** :

- **Home** : choix du mode de travail ;
- **Form** : saisie des données produit et options ;
- **Pipeline** : exécution et suivi des agents, affichage des sorties.

Le HTML contient également :

- un **header global** ;
- un **settings panel** ;
- plusieurs **lightboxes / modales** ;
- un **mode batch** distinct du flux standard.

Le chargement CSS est désormais découpé en **7 fichiers actifs**, avec un fichier dédié aux variables globales chargé en premier. Le chargement JS est également découpé : les modules `src/js/ui/*` sont chargés avant `pipeline-ui.js`, puis `pipeline-api.js` est chargé ensuite. Cette structure confirme que `pipeline-ui.js` doit rester un point d’orchestration et non redevenir un monolithe. Les variables CSS globales doivent être centralisées dans **`00-var.css` uniquement** ; elles ne doivent pas être redéclarées dans les autres couches. fileciteturn7file0turn7file1turn7file2turn7file3turn7file4turn7file5turn7file7turn7file8

---

## 3. Structure actuelle des responsabilités

### 3.1 HTML

Le fichier HTML actif est le point d’entrée de l’interface. Il contient encore l’intégralité du DOM principal, avec une structure par grandes zones :

- shell global ;
- header ;
- settings panel ;
- view home ;
- view form ;
- bloc tabletop ;
- bloc collection ;
- view pipeline ;
- lightboxes communes ;
- scripts ;
- batch modal + batch wrapper.

Le HTML repose encore fortement sur des `id` et des `onclick` inline comme contrats de liaison avec le JS. C’est l’état **actuel** de la base et il doit être respecté pour le legacy existant. fileciteturn7file0

### 3.2 CSS

Le CSS actif est découpé en 7 couches chargées dans un ordre fixe :

1. `00-var.css`
2. `01-legacy-base.css`
3. `02-ui-pro.css`
4. `03-header-settings.css`
5. `04-form-layout.css`
6. `05-library-gpt.css`
7. `06-inline-merged.css`

Chaque fichier correspond à une couche ou une famille de responsabilités, mais l’ordre de cascade reste important. `00-var.css` est le **point d’entrée unique** des variables CSS globales. `06-inline-merged.css` ne doit plus être vu comme une cible finale : c’est un résidu temporaire qui conserve les helpers transverses les plus sensibles après redistribution progressive. fileciteturn7file0turn7file1turn7file2turn7file3turn7file4turn7file5turn7file6

### 3.3 JS

Le JS est organisé en trois niveaux :

- **modules UI** : `src/js/ui/*`
- **orchestrateur UI** : `src/js/pipeline-ui.js`
- **exécution API / pipeline** : `src/js/pipeline-api.js`

`pipeline-ui.js` importe les helpers exposés sur `window.PipelineUI*` et compose les briques UI sans devoir les réimplémenter. `pipeline-api.js` porte l’appel à Anthropic, le pilotage du pipeline, l’orchestrateur qualité, les sorties sociales, le monitoring des coûts et une partie du flux d’exécution. fileciteturn7file7turn7file8

---

## 4. Chargement et dépendances

### 4.1 Ordre de chargement CSS

Le HTML charge explicitement les feuilles CSS dans cet ordre :

1. variables globales (`00-var.css`)
2. legacy base
3. UI pro
4. header / settings
5. form layout
6. library / gpt / lightbox helpers
7. inline merged résiduel

Cet ordre est contractuel. Une règle peut sembler redondante d’un fichier à l’autre mais être nécessaire à la cascade finale. **Les variables CSS globales doivent être déclarées uniquement dans `00-var.css`, chargé en premier**. Aucun autre fichier ne doit contenir un nouveau bloc `:root` global ou une redéclaration opportuniste de tokens déjà centralisés. Aucun refactor CSS ne doit changer cet ordre sans validation visuelle complète. fileciteturn7file0turn7file1turn7file2turn7file3turn7file4turn7file5turn7file6

### 4.2 Ordre de chargement JS

Le HTML charge d’abord les modules UI, puis `pipeline-ui.js`, puis `pipeline-api.js`. Cela implique :

- les modules UI doivent exposer leurs API sur `window.PipelineUI*` ;
- `pipeline-ui.js` consomme ces exports et orchestre la composition UI ;
- `pipeline-api.js` dépend de fonctions, état et conventions disponibles après chargement UI.

Cet ordre ne doit pas être modifié sans audit global. fileciteturn7file0turn7file7turn7file8

---

## 5. Cartographie CSS

### `00-var.css`

Rôle : **source unique des variables CSS globales**.

Contient notamment :

- les custom properties globales de thème ;
- les couleurs, surfaces, bordures, textes et états globaux ;
- les rayons, espacements et tokens réutilisables ;
- les variables spécifiques au stepper ou à une couche transverse si elles doivent être partagées.

Règles impératives :

- **toute nouvelle variable CSS globale doit être déclarée ici, et uniquement ici** ;
- les autres fichiers CSS consomment les variables, mais ne doivent pas créer de nouveau bloc `:root` global concurrent ;
- pas de duplication de tokens entre `01-legacy-base.css`, `02-ui-pro.css` et les autres couches ;
- si une variable devient globale, elle doit être déplacée vers `00-var.css` avant d’être réutilisée ailleurs ;
- l’ordre de chargement doit toujours laisser `00-var.css` en première position.

### `01-legacy-base.css`

Rôle : couche historique large.

**Ne doit plus héberger de variables globales** maintenant que `00-var.css` est la source unique des tokens.

Contient notamment :

- tokens legacy ;
- styles génériques `body`, `form-section`, `fg`, `drop-zone`, `agent-card`, `output-box`, `lightboxes`, `batch`, `views`, home, pipeline ;
- une base visuelle ancienne encore utile à la compatibilité.

Règle : ne pas supprimer ou fusionner agressivement cette couche sans vérifier les overrides ultérieurs. fileciteturn7file6

### `02-ui-pro.css`

Rôle : couche visuelle moderne / overrides principaux.

**Ne doit plus redéclarer les variables globales** : il consomme `00-var.css` et se concentre sur les composants / overrides.

Contient notamment :

- tokens UI pro ;
- app header visuel ;
- home screen premium ;
- sections de formulaire modernisées ;
- boutons ;
- agent cards ;
- timeline pipeline ;
- final output ;
- lightboxes ;
- batch cards ;
- helpers home batch.

Règle : toute amélioration visuelle globale doit être étudiée ici avant d’aller modifier le legacy. fileciteturn7file1

### `03-header-settings.css`

Rôle : header applicatif, panneau de réglages, titre du pipeline.

Règle : toute feature liée au shell supérieur, au contexte visuel ou au panneau settings doit arriver ici, sauf dépendance explicite à une autre couche. fileciteturn7file2

### `04-form-layout.css`

Rôle : mise en page des formulaires, helpers de champs, sections sociales, panneaux de sortie finaux, variantes Pinterest.

Règle : dès qu’un ajout concerne le layout des vues de formulaire ou les sections sociales/finales, ce fichier est la cible privilégiée. fileciteturn7file3

### `05-library-gpt.css`

Rôle : bibliothèques, lightbox helpers, explorer helpers.

Règle : les futures modales et zones d’exploration doivent être cohérentes avec ce fichier, pas dispersées ailleurs sans raison. fileciteturn7file4

### `06-inline-merged.css`

Rôle : reliquat temporaire.

Contient aujourd’hui seulement quelques helpers transverses (`.is-hidden`, variantes de boutons compacts). Ce fichier ne doit pas redevenir une nouvelle zone de dépôt fourre-tout. Toute nouvelle règle ajoutée ici doit être justifiée et marquée comme temporaire. fileciteturn7file5

---

## 6. Cartographie HTML

### 6.1 Shell global

Le shell global regroupe :

- `app-shell`
- header
- settings panel
- vues principales
- lightboxes communes
- zone scripts
- zone batch

Règle : conserver une lecture claire par grandes sections commentées. fileciteturn7file0

### 6.2 Vues

Les vues principales sont :

- `#view-home`
- `#view-form`
- `#view-pipeline`

Le système d’affichage repose sur des classes `view` et `active`, avec des déplacements de blocs dans la vue pipeline effectués par le JS lors du lancement du pipeline. Il ne faut pas modifier la structure de ces vues sans audit des manipulations DOM associées. fileciteturn7file0turn7file7

### 6.3 Deux blocs métier parallèles : Tabletop / Collection

Le HTML conserve deux branches parallèles :

- `#ui-tt`
- `#ui-col`

Ces branches partagent des patterns proches mais restent distinctes. C’est volontaire à ce stade pour garder une maintenance pragmatique. Une modification structurelle sur l’une doit toujours poser la question : **faut-il aussi l’appliquer à l’autre ?** fileciteturn7file0

### 6.4 Lightboxes communes

Les lightboxes documentées à ce stade sont :

- bibliothèques sémantiques ;
- prompt agent ;
- input brut ;
- explorer.

Leur structure est homogène : overlay, box, header, body, footer éventuel. Toute nouvelle lightbox doit reprendre ce pattern. fileciteturn7file0turn7file4

### 6.5 Batch

Le mode batch est séparé du flux standard et contient :

- une modal d’initialisation ;
- un wrapper principal ;
- une barre de progression ;
- un conteneur de fiches batch ;
- un bouton d’export.

Le batch a sa propre logique et ne doit pas être traité comme une simple extension cosmétique du pipeline classique. fileciteturn7file0turn7file6turn7file7

---

## 7. Cartographie JS (niveau 1)

### 7.1 `pipeline-ui.js`

Rôle attendu : **orchestrateur UI**.

Constats actuels :

- le fichier récupère les exports des modules via `window.PipelineUI*` ;
- il compose les briques de rendu, modales, batch, prompts, échelles, images, etc. ;
- il contient encore certaines fonctions restantes et un bootstrap de fin de fichier.

Règle structurante : **aucune nouvelle logique lourde ne doit être recentralisée dans `pipeline-ui.js` si elle peut vivre dans un module dédié**. fileciteturn7file8

### 7.2 `pipeline-api.js`

Rôle actuel : couche d’exécution opérationnelle.

Contient notamment :

- `callClaude()` ;
- l’orchestrateur qualité (`toggleOrchestrator`, `runOrchestrator`, badge) ;
- le `runAgent()` ;
- le contrôle du pipeline (`startPipeline`) ;
- les flux réseaux sociaux ;
- l’assemblage final ;
- le monitoring des coûts ;
- certaines actions utilisateur liées au rerun et à la persistance des règles.

Remarque : ce fichier concentre encore beaucoup de responsabilités. Il n’est pas à refactorer brutalement dans cette phase de doc, mais cela devra être surveillé pour la prod. fileciteturn7file7

### 7.3 Modules UI

Les modules UI sont chargés avant `pipeline-ui.js`, ce qui montre une architecture modulaire déjà engagée. Les noms observés dans le HTML sont :

- `helper_ui.js`
- `render_ui.js`
- `modals_ui.js`
- `tags_ui.js`
- `title_ui.js`
- `library_ui.js`
- `batch_ui.js`
- `config_ui.js`
- `shell_ui.js`
- `prompt_biblio_ui.js`
- `echelles_ui.js`
- `images_ui.js`
- `forms_ui.js`
- `cards_ui.js`
- `selections_ui.js`
- `app_ui.js`

La documentation fine par module sera complétée dans un second temps lorsque l’ensemble de `src/js/ui/*` aura été analysé. fileciteturn7file0turn7file8

---

## 8. Flux principaux

### 8.1 Flux standard

1. L’utilisateur choisit un mode sur la home.
2. Il remplit le formulaire correspondant.
3. Il lance le pipeline.
4. Le JS déplace les blocs utiles vers la vue pipeline.
5. Les agents s’exécutent dans l’ordre.
6. Les sorties finales sont assemblées.
7. Les réseaux sociaux peuvent être générés ensuite.

Ce flux dépend à la fois du DOM existant, des `id` de sortie et des helpers d’assemblage. fileciteturn7file0turn7file7

### 8.2 Flux batch

1. L’utilisateur ouvre la modal batch.
2. Il choisit le nombre de fiches.
3. Le système construit les fiches batch.
4. Le batch exécute les agents dans un flux autonome.
5. Une progression est affichée.
6. Un export final est proposé.

Le batch ne doit pas être couplé trop étroitement au flux standard lors des futures features. fileciteturn7file0turn7file7

---

## 9. Conventions actuelles vs conventions cibles

### 9.1 État actuel

Le codebase actuel utilise encore largement :

- des `id` comme points d’ancrage JS ;
- des `onclick` inline dans le HTML ;
- des classes servant à la fois au style et parfois à la structuration de blocs manipulés.

C’est le **legacy actif**. Il ne faut pas lancer de migration globale à chaud. fileciteturn7file0turn7file7turn7file8

### 9.2 Convention cible à partir de maintenant

Pour tous les **nouveaux développements**, la règle cible devient :

- **classes** → style / layout / états visuels ;
- **`data-js`** → hooks JS stables ;
- **autres `data-*` sémantiques** → rôle métier ou intention de bloc si utile ;
- **`id`** → unicité réelle, accessibilité, ou compatibilité legacy déjà existante.

- **`addEventListener()`** → nouveau binding d’événements ;
- **méthodes DOM modernes** → à privilégier quand elles clarifient l’intention (`append()`, `prepend()`, `before()`, `after()`, `replaceChildren()`, `insertAdjacentElement()`) ;
- **state structuré** → regroupé par domaine ou flux quand un nouvel état durable est introduit ;
- **erreurs UI exploitables** → un nouveau flow asynchrone doit remonter un message utile, pas seulement un booléen d’échec.

Exemple cible :

```html
<div class="agent-card" data-agent="social" data-view="tt">
  <button class="btn btn-accent" data-js="run-social">▶ Générer</button>
</div>
```

Avec cette convention :

- le CSS sélectionne les **classes** ;
- le JS sélectionne les **`data-js`** ;
- les `id` sont limités aux cas nécessaires.

Règle de transition :

- **ne pas migrer toute la base d’un coup** ;
- appliquer cette convention aux **nouvelles features** ;
- migrer progressivement les zones legacy lorsqu’elles sont retravaillées. fileciteturn7file0turn7file7turn7file8

- si une règle récente de modernisation entre en conflit avec une habitude plus ancienne du projet, la règle récente prévaut pour le nouveau code ;
- le legacy stable reste toléré tant qu’il n’est pas dans le périmètre direct du changement. fileciteturn7file0turn7file7turn7file8

---

### 9.3 Pratiques modernes impératives pour le nouveau code

À partir de maintenant, les nouvelles contributions doivent suivre une écriture **moderne, lisible et actuelle**, sans réintroduire de patterns old school par habitude.

#### CSS

- variables globales dans `00-var.css` uniquement ;
- unités en `rem` par défaut pour les dimensions ;
- sélecteurs ciblés, sans duplication opportuniste de tokens ;
- pas de bloc `:root` concurrent dans les autres couches ;
- pas de styles “vite fait” laissés dans une mauvaise couche.

#### JS

- `const` / `let`, jamais `var` ;
- fonctions fléchées quand approprié ;
- objets, tableaux et constantes locales déclarés proprement en tête de fonction ;
- responsabilités courtes et lisibles ;
- priorité à la clarté sur les astuces compactes ;
- pas de logique cachée dans des handlers inline pour du nouveau code.

#### HTML

- hooks `data-js` pour le JS nouveau ;
- classes pour le style ;
- `id` conservés pour le legacy ou les vrais besoins d’unicité ;
- structure lisible, stable et commentée quand la zone est sensible.

Règle de fond : **le nouveau code doit tirer la base vers le haut**. On tolère le legacy stable hors périmètre, mais on n’introduit plus volontairement de style ancien dans les nouvelles modifications.

## 10. Bonnes pratiques de contribution

### HTML

- ne pas casser les `id` existants sans audit JS ;
- ne pas déplacer une section entière sans vérifier les déplacements DOM opérés par le JS ;
- conserver une structure lisible par sections commentées ;
- éviter les blocs compactés sur une seule ligne ;
- pour les nouvelles features, préparer des hooks `data-js` plutôt que de nouveaux `onclick` inline ;
- pour le nouveau code, privilégier un HTML sémantique, lisible et stable plutôt qu’un assemblage opportuniste centré sur le visuel ;
- pour les icônes, préférer des SVG intégrés propres plutôt qu’un caractère texte ambigu quand cela améliore la robustesse.

### CSS

- respecter l’ordre des 7 fichiers actifs ;
- déclarer les variables CSS globales **uniquement** dans `00-var.css` ;
- privilégier les **unités `rem`** pour les dimensions, espacements, rayons et tailles de police ;
- réserver `px` aux cas vraiment justifiés et localisés (hairlines, contraintes externes ou valeurs techniques incompressibles) ;
- ne pas réintroduire de monolignes ;
- ne pas utiliser `06-inline-merged.css` comme zone fourre-tout ;
- ranger une règle dans le fichier correspondant à sa responsabilité dominante ;
- éviter les “nettoyages intelligents” non validés visuellement.

### JS

- `pipeline-ui.js` reste un orchestrateur ;
- un module = une responsabilité dominante ;
- les exports UI passent par `window.PipelineUI*` tant que cette architecture est en place ;
- toute nouvelle logique conséquente doit être placée dans un module dédié, pas dans un fichier central par facilité ;
- toute dépendance DOM doit être explicitée dans les commentaires ;
- pour le nouveau code, éviter de recréer des chemins parallèles quand un contrat partagé existe déjà ;
- pour le nouveau code, préférer des objets multi-lignes lisibles aux états compactés difficiles à relire ;
- utiliser `const` par défaut et `let` uniquement en cas de réassignation réelle ; `var` est interdit pour le nouveau code ;
- préférer les **fonctions fléchées** quand elles clarifient le code, en particulier pour les helpers, callbacks et petits adaptateurs ;
- déclarer en début de fonction les constantes, objets, tableaux et dépendances locales nécessaires au bloc courant ;
- privilégier les **early returns** plutôt que des imbrications profondes ;
- utiliser des noms explicites et un état regroupé proprement, pas des variables jetables ambiguës ;
- privilégier les API DOM modernes (`closest`, `append`, `prepend`, `replaceChildren`, `insertAdjacentElement`) quand elles améliorent la lisibilité.

### Patches

- patch ciblé, pas refactor large non demandé ;
- ne jamais supposer qu’un patch précédent est appliqué ;
- toujours vérifier l’état actuel avant génération ;
- après patch : check + test visuel.

---

## 11. Dette technique identifiée

Points encore sensibles :

- forte dépendance aux `id` et `onclick` inline dans le legacy HTML ;
- `pipeline-api.js` reste chargé en responsabilités ;
- présence d’une couche legacy CSS encore importante ;
- `06-inline-merged.css` existe encore comme reliquat ;
- duplication structurelle volontaire entre TT et Collection, acceptable pour l’instant mais à surveiller.

Ce ne sont pas des urgences à casser maintenant. Ce sont des points à suivre en vue de la prod. fileciteturn7file0turn7file5turn7file6turn7file7turn7file8

---

## 12. Règles à retenir pour les agents

1. Ne pas retransformer `pipeline-ui.js` en monolithe.
2. Respecter l’ordre de cascade CSS existant.
3. Pour les nouvelles features : **JS via `data-js`, CSS via classes, variables globales via `00-var.css`**.
4. Ne pas casser les hooks legacy sans audit.
5. Tout changement structurel doit rester compréhensible par un autre agent.
6. Préférer les petits patches traçables aux gros refactors “ambitieux”.
7. Toujours laisser le code plus lisible qu’avant.
8. Pour le nouveau code, utiliser des pratiques modernes actuelles ; ne pas réintroduire du old school par défaut.

---

## 13. Suite prévue

Cette V1 couvre :

- la structure générale HTML / CSS / JS ;
- l’ordre de chargement ;
- les conventions de contribution ;
- la nouvelle règle de hooks JS via `data-js` pour la suite.

La prochaine étape consiste à compléter cette doc avec l’analyse détaillée de `src/js/ui/*`, afin d’ajouter une cartographie précise module par module.
