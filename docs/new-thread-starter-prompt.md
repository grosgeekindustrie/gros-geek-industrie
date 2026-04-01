# New Thread Starter Prompt

Copie-colle ce prompt au début d’un nouveau fil quand tu veux reprendre le projet sans refaire tout le contexte.

---

## Prompt de reprise

Tu travailles sur le projet **Etsy Pipeline** de **Gros Geek Industrie**.

### 1. Source de vérité
La **source de vérité principale** est toujours :
1. **les fichiers locaux réellement fournis dans ce fil**
2. les fichiers `docs/` du projet
3. le repo GitHub **uniquement comme source d’architecture, de comparaison ou pour comprendre les parties non transmises**

Important :
- ne jamais supposer qu’un patch précédent est déjà appliqué
- ne jamais supposer qu’un fichier GitHub est identique au fichier local
- si un fichier local est fourni, **il prime toujours** sur le repo GitHub
- le GitHub sert surtout à comprendre l’architecture globale ou les parties non envoyées

Repo de référence :
`https://github.com/grosgeekindustrie/gros-geek-industrie`

---

### 2. Docs à lire en priorité
Avant de proposer un patch, prendre en compte en priorité :
- `docs/01-architecture.md`
- `docs/02-agent-guidelines.md`
- `docs/03-patch-workflow.md`
- `docs/04-commenting-standard.md`
- `docs/05-prod-readiness.md`

Ces docs cadrent :
- l’architecture générale
- les responsabilités par couche
- les conventions HTML / CSS / JS
- les règles de commentaires
- les règles de patch
- les garde-fous pour éviter les refactors inutiles

---

### 3. Architecture actuelle à respecter
Le projet est organisé autour de :

#### HTML
- un fichier HTML principal :
  - `src/etsy-pipeline-dnd-v1_2.html`
- structure multi-vues :
  - home
  - form
  - pipeline
  - lightboxes
  - batch

#### CSS
CSS découpé en couches dans `src/css/` :
- `01-legacy-base.css`
- `02-ui-pro.css`
- `03-header-settings.css`
- `04-form-layout.css`
- `05-library-gpt.css`
- `06-inline-merged.css`

Règle :
- ne pas recréer un gros monolithe CSS
- ne pas réintroduire de styles inline HTML
- `06-inline-merged.css` est une couche résiduelle temporaire, pas une destination par défaut

#### JS
Le JS a déjà été découpé.
- `src/js/pipeline-ui.js` = orchestrateur / bridge
- `src/js/pipeline-api.js` = runtime hybride encore temporaire
- modules UI dans `src/js/ui/`

Exemples de modules :
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

---

### 4. Règles d’architecture à respecter
Toujours respecter ces règles :

- `pipeline-ui.js` reste un orchestrateur
- un module JS = une responsabilité dominante
- ne pas recentraliser la logique dans `pipeline-ui.js`
- ne pas faire de refactor large non demandé
- garder les patchs ciblés
- viser la stabilité visuelle et fonctionnelle

#### Convention DOM / JS
Pour les nouveaux développements :
- **classes = style**
- **`data-js` = hooks JS**
- **`data-*` = intention / rôle / sémantique stable**
- éviter d’utiliser classes ou `id` comme hooks JS pour les nouvelles features
- les hooks legacy existants peuvent rester tant qu’ils ne sont pas migrés localement

#### Legacy
- le legacy existant peut rester s’il fonctionne
- ne pas ajouter de nouvelle dette legacy
- ne migrer que la zone réellement touchée
- pas de “grand nettoyage opportuniste”

---

### 5. État particulier de `pipeline-api.js`
Important :
`pipeline-api.js` **ne contient pas seulement les appels API**.

Il contient encore un mélange de :
- call API Anthropic
- orchestrateur qualité
- exécution du pipeline
- logique sociale
- sorties finales
- monitoring des coûts

Donc :
- ne pas le découper brutalement
- ne pas lancer de gros refactor sur ce fichier sans vraie nécessité
- si un découpage futur est envisagé, il doit être **progressif**, **ciblé** et **retesté**
- si tu ajoutes des commentaires, bien préciser que c’est un **runtime hybride temporaire**

---

### 6. Nouveau fichier ou fichier existant ?
Ne jamais supposer que “tout existe déjà” **ni** créer de nouveaux fichiers automatiquement sans réflexion.

Règle :
- **préférer écrire dans les fichiers existants** si la responsabilité est claire
- **proposer un nouveau fichier seulement si cela améliore réellement l’architecture**
- tout nouveau fichier doit être :
  - justifié
  - cohérent avec le split actuel
  - nommé de manière claire
  - limité à une responsabilité dominante

Avant de créer un nouveau fichier, vérifier :
- si un module existant couvre déjà cette responsabilité
- si le changement est temporaire ou durable
- si créer un nouveau fichier évite réellement de polluer un fichier sensible

---

### 7. Méthode de travail attendue
Quand tu travailles sur ce projet :

1. lire les fichiers réellement fournis
2. comparer si besoin avec l’architecture du repo
3. proposer une approche ciblée
4. éviter les hypothèses d’état
5. générer un patch propre
6. donner les commandes de check après apply
7. rappeler les points de test visuel si l’UI est touchée

---

### 8. Règles de patch
Toujours respecter ceci :

- un patch = un objectif dominant
- jamais de patch théorique basé sur un état ancien
- ne jamais supposer qu’une branche est identique à une autre
- si un patch a déjà échoué, repartir des fichiers exacts du fil courant
- toujours fournir :
  - le patch
  - `git apply --check`
  - `git apply`
  - les checks post-apply

Exemple de checks attendus :
```bash
git apply --check patch/git/mon_patch.patch
git apply patch/git/mon_patch.patch
git diff --stat
git diff
```

Si UI touchée :
- demander ou recommander un check visuel
- rappeler de vérifier home / tabletop / collection / pipeline / batch / lightboxes selon la zone touchée

---

### 9. Style de code attendu
#### HTML
- multi-lignes lisibles
- structure claire
- pas d’inline style nouveau
- pas de `onclick` inline nouveau sauf contrainte legacy forte

#### CSS
- pas de CSS mono-ligne
- sections commentées
- règles regroupées proprement
- pas de destination “poubelle” dans `06-inline-merged.css`

#### JS
- templates strings préférés aux concaténations fragiles
- commentaires utiles aux agents
- pas de mélange inutile entre réseau, DOM et logique métier
- exports cohérents via `window.PipelineUI*` pour les modules UI

---

### 10. Commentaires attendus
Quand tu ajoutes des commentaires :
- commenter les blocs
- commenter les contrats
- commenter les zones sensibles
- commenter les zones temporaires
- ne pas commenter chaque ligne
- ne pas faire de commentaire décoratif inutile

Si une zone est temporaire, préciser :
- pourquoi elle existe
- si elle accepte encore des ajouts
- où elle devrait finir plus tard

---

### 11. Réponse attendue dans un nouveau fil
Quand je t’envoie des fichiers ou une demande, je veux en priorité :

- un diagnostic basé sur **les fichiers réels fournis**
- une proposition de travail ciblée
- un patch propre si on avance
- les commandes de check post-apply
- pas de refactor large surprise
- pas de supposition floue sur l’état du repo

Si un doute subsiste entre les fichiers fournis et GitHub :
- les fichiers fournis gagnent
- GitHub ne sert qu’à contextualiser

---

### 12. Formulation pratique
Quand je redémarre un fil, considère ce prompt comme mon cadre de travail par défaut pour le projet Etsy Pipeline.

Si je fournis des fichiers locaux, base-toi dessus en priorité.
Si je mentionne une branche GitHub, utilise-la seulement pour comprendre l’architecture ou les parties non transmises.
Ne repars jamais de zéro sur l’architecture si les docs du projet existent déjà.

---

## Version courte ultra-pratique

Projet : **Etsy Pipeline**  
Source de vérité : **fichiers locaux > docs/ > GitHub**  
GitHub : `https://github.com/grosgeekindustrie/gros-geek-industrie`

Docs à respecter :
- `docs/01-architecture.md`
- `docs/02-agent-guidelines.md`
- `docs/03-patch-workflow.md`
- `docs/04-commenting-standard.md`
- `docs/05-prod-readiness.md`

Règles :
- `pipeline-ui.js` = orchestrateur
- modules `ui/*` = responsabilités séparées
- `pipeline-api.js` = runtime hybride temporaire, ne pas refactorer brutalement
- classes = style
- `data-js` = hooks JS des nouvelles features
- pas de CSS mono-ligne
- pas de patch théorique
- patchs ciblés uniquement
- toujours fournir les commandes `git apply --check` + checks post-apply

Important :
- préférer modifier les fichiers existants
- ne créer un nouveau fichier que si c’est justifié et cohérent avec l’architecture actuelle
