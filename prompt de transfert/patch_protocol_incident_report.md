# Incident report — pourquoi les patchs échouaient après le premier patch sur Etsy Pipeline

## Objectif
Ce document explique **de A à Z** le problème rencontré sur les patchs successifs dans le projet Etsy Pipeline, afin que le prochain agent ne reparte pas dans de mauvais diagnostics.

Il complète les guidelines existantes du projet, qui rappellent déjà que :
- le repo distant sert à comprendre l’architecture,
- les fichiers locaux fournis par l’utilisateur sont la seule source de vérité pour écrire un patch,
- après chaque patch validé et commit, tous les anciens fichiers deviennent caducs,
- en cas de `patch does not apply`, il faut d’abord vérifier la concordance avant de régénérer. fileciteturn8file0

---

## 1. Symptôme observé

Le premier patch d’un fil passe généralement bien.

Ensuite :
- l’utilisateur commit,
- push,
- change parfois de branche pour isoler le chantier suivant,
- n’édite plus les fichiers,
- envoie des « fichiers frais » pour le patch suivant,
- et pourtant le second patch échoue avec :
  - `patch does not apply`,
  - parfois dès la ligne 1,
  - sur plusieurs fichiers en même temps.

Ce comportement donnait l’impression :
- soit que les fichiers envoyés n’étaient pas les bons,
- soit que le patch était construit sur un snapshot périmé,
- soit qu’un fichier avait été modifié localement entre-temps.

---

## 2. Ce qui a été diagnostiqué au début — et qui n’allait pas assez loin

Les premiers diagnostics se sont trop concentrés sur :
- une possible divergence entre repo distant et local,
- un éventuel mauvais lot de fichiers,
- un mauvais état de branche,
- une supposition de snapshot ancien,
- ou un problème de fins de ligne/CRLF uniquement côté contenu.

Ces pistes n’étaient pas absurdes, mais elles étaient **incomplètes**.

Le vrai problème n’était pas seulement « quel fichier a été envoyé ? », mais aussi **comment on comparait les fichiers**.

---

## 3. Cause racine réelle

### 3.1 Les fichiers n’étaient pas forcément différents en contenu brut

Sur un fichier test isolé (`collection_stepper_ui.js`), les comparaisons suivantes ont montré que le fichier local de l’utilisateur et le fichier reçu dans le chat avaient les **mêmes octets bruts** :
- même taille en bytes,
- même début hex,
- même fin hex,
- même nombre de CRLF.

Donc, à ce stade, le contenu binaire du fichier était bien identique.

### 3.2 Le faux coupable : `git hash-object` utilisé sans précaution

Le point critique découvert est le suivant :

Quand l’utilisateur exécutait :

```bash
 git hash-object _share/collection_stepper_ui.js
```

le fichier étant **dans le repo**, Git pouvait appliquer :
- les filtres Git,
- `core.autocrlf`,
- `.gitattributes`,
- d’éventuels clean filters.

Donc ce hash pouvait être celui de la **version normalisée pour Git**, et non celui des **octets bruts exacts du fichier sur disque**.

De l’autre côté, le fichier reçu dans le chat était hashé hors repo, donc **sans filtres Git**.

Résultat :
- même fichier brut,
- hash `git hash-object` différent,
- impression trompeuse que les fichiers ne correspondaient pas.

### 3.3 Confirmation décisive

La preuve a été apportée quand l’utilisateur a lancé :

```bash
 git hash-object --no-filters _share/collection_stepper_ui.js
```

et a obtenu **exactement** le même hash que celui calculé sur le fichier reçu côté assistant.

Donc la divergence venait bien de :
- `git hash-object` **avec filtres**,
- comparé à un hash calculé sur le **fichier brut**.

---

## 4. Cause secondaire qui complique les patchs

Même avec le bon fichier, un patch peut encore échouer si :
- les fichiers sont en **CRLF**,
- et que `git apply --check` est utilisé de manière trop stricte,
- surtout sur des fichiers HTML/CSS déjà remaniés visuellement.

Dans ce contexte, un patch peut être correct en contenu métier mais échouer sans les options de tolérance adaptées.

Commande plus robuste dans ce projet quand on sait que le contenu est bon mais qu’on est en contexte CRLF :

```bash
 git apply --check --ignore-space-change --ignore-whitespace <patch>
 git apply --ignore-space-change --ignore-whitespace <patch>
```

Cette tolérance n’est **pas** une excuse pour patcher à l’aveugle.
Elle ne doit être utilisée qu’après avoir verrouillé la concordance des fichiers sources.

---

## 5. Ce qu’il faut désormais considérer comme vrai

### Vrai
- Le repo distant sert à comprendre l’architecture globale. fileciteturn8file0
- Les fichiers locaux fournis par l’utilisateur sont la seule source de vérité pour le patch. fileciteturn8file0
- Après un patch validé + commit, tous les anciens fichiers d’un fil sont caducs. fileciteturn8file0
- `git hash-object` simple **dans le repo** n’est pas un test fiable de comparaison brute si des filtres Git interviennent.
- Le bon test de concordance brute est `git hash-object --no-filters`.

### Faux / insuffisant
- Comparer `git hash-object` simple entre l’utilisateur et l’assistant.
- Conclure trop vite que « les fichiers reçus sont différents » sans vérifier en `--no-filters`.
- Régénérer un patch avant d’avoir validé la concordance brute.

---

## 6. Protocole corrigé à appliquer pour tous les prochains patchs

### Étape 1 — verrouiller l’état local courant
L’utilisateur fournit :

```bash
 git branch --show-current
 git rev-parse --short HEAD
 git status --short
```

Objectif :
- connaître la branche,
- connaître le commit de départ,
- vérifier qu’il n’y a pas de modifications locales non prévues.

### Étape 2 — créer un dossier de partage dédié
Créer un dossier `_share` depuis le repo courant :

```bash
 rm -rf _share
 mkdir _share

 cp src/etsy-pipeline-dnd-v1_2.html _share/
 cp src/css/02-ui-pro.css _share/
 cp src/css/04-form-layout.css _share/
 cp src/js/ui/forms_ui.js _share/
 cp src/js/ui/collection_stepper_ui.js _share/
```

Important :
- l’utilisateur doit uploader **uniquement les fichiers depuis `_share`**, pas depuis les onglets VS Code ni un autre clone du repo.

### Étape 3 — comparer les hashes correctement
La comparaison doit se faire avec **`--no-filters`** :

```bash
 git hash-object --no-filters _share/etsy-pipeline-dnd-v1_2.html
 git hash-object --no-filters _share/02-ui-pro.css
 git hash-object --no-filters _share/04-form-layout.css
 git hash-object --no-filters _share/forms_ui.js
 git hash-object --no-filters _share/collection_stepper_ui.js
```

L’assistant doit comparer ces valeurs avec les hashes calculés de son côté sur les fichiers reçus.

### Étape 4 — règle absolue avant patch
**Pas de patch tant que les hashes `--no-filters` ne matchent pas.**

Si un hash diverge :
- on s’arrête,
- on n’écrit pas de patch,
- on identifie quel fichier diverge,
- on ne reroll pas.

### Étape 5 — validation du patch
Une fois les fichiers concordants :

```bash
 git apply --check --ignore-space-change --ignore-whitespace patch/git/<nom_du_patch>.patch
 git apply --ignore-space-change --ignore-whitespace patch/git/<nom_du_patch>.patch
```

Puis :

```bash
 node --check <fichiers_js_touchés>
 git diff --stat
 git diff
```

---

## 7. Ce que le prochain agent doit faire dès le début

1. Lire les guidelines projet. fileciteturn8file0
2. Comprendre le ticket via le repo distant **si le sujet est transverse**. fileciteturn8file0
3. Demander les fichiers locaux exacts nécessaires.
4. Exiger les contrôles suivants avant tout patch :

```bash
 git branch --show-current
 git rev-parse --short HEAD
 git status --short
 git hash-object --no-filters <chaque_fichier_partagé>
```

5. Ne plus jamais utiliser `git hash-object` simple comme preuve absolue de concordance brute.
6. En cas de CRLF, privilégier `git apply --check --ignore-space-change --ignore-whitespace`.
7. Ne jamais reroller un patch sans avoir d’abord identifié si l’échec vient :
   - du contenu,
   - des filtres Git,
   - ou des fins de ligne / whitespace.

---

## 8. Résumé ultra-court à transmettre au prochain agent

> Le problème n’était pas seulement “mauvais fichier / vieux snapshot”.
> Le vrai piège venait de la comparaison avec `git hash-object` dans le repo, qui peut appliquer les filtres Git.
> À partir de maintenant, toute comparaison de fichiers pour patch doit se faire avec `git hash-object --no-filters`.
> Et pour appliquer les patchs sur ce projet en contexte CRLF, utiliser `git apply --check --ignore-space-change --ignore-whitespace` puis `git apply --ignore-space-change --ignore-whitespace`.
> Tant que les hashes `--no-filters` ne matchent pas, on ne patch pas.

---

## 9. Commandes de référence prêtes à copier

### Contrôle avant envoi des fichiers

```bash
 git branch --show-current
 git rev-parse --short HEAD
 git status --short
```

### Préparer le dossier de partage

```bash
 rm -rf _share
 mkdir _share

 cp src/etsy-pipeline-dnd-v1_2.html _share/
 cp src/css/02-ui-pro.css _share/
 cp src/css/04-form-layout.css _share/
 cp src/js/ui/forms_ui.js _share/
 cp src/js/ui/collection_stepper_ui.js _share/
```

### Hashes corrects à comparer

```bash
 git hash-object --no-filters _share/etsy-pipeline-dnd-v1_2.html
 git hash-object --no-filters _share/02-ui-pro.css
 git hash-object --no-filters _share/04-form-layout.css
 git hash-object --no-filters _share/forms_ui.js
 git hash-object --no-filters _share/collection_stepper_ui.js
```

### Vérification patch

```bash
 git apply --check --ignore-space-change --ignore-whitespace patch/git/<nom>.patch
 git apply --ignore-space-change --ignore-whitespace patch/git/<nom>.patch
```

### Vérifications post-apply

```bash
 node --check src/js/ui/forms_ui.js
 node --check src/js/ui/collection_stepper_ui.js
 git diff --stat
 git diff
```

---

## 10. Principe final

Le projet disait déjà :

> Si une pièce manque, on s’arrête. On ne mélange pas les couleurs pour inventer celle qui manque. fileciteturn8file0

La version enrichie après cet incident devient :

> Si les hashes bruts `--no-filters` ne matchent pas, on s’arrête.  
> On ne patch pas sur une illusion de concordance.
