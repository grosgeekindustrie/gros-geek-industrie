# Prompt de transfert — branche `archi` — état, roadmap, méthode patch, premier step

## 1. Contexte général

Le chantier en cours est la **refonte d’architecture JS** du projet Etsy Pipeline.

Le batch a déjà été retiré du vivant.
La nouvelle arbo JS par domaines a été mise en place progressivement.
Le HTML charge désormais **un seul point d’entrée JS** :

```html
<script type="module" src="js/index.js"></script>
```

Mais un **dernier patch de consolidation interne du bootstrap** reste à faire proprement.

---

## 2. État stable confirmé

### Branche de travail
- Branche : `archi`

### Dernier état stable confirmé
- Commit stable confirmé après rollback du patch bootstrap foireux :

```bash
a5dd676c961e8976dee873a51f957f9c5c7d8354
```

**Point important :**
Les tentatives de patch suivantes sur la consolidation bootstrap ont **échoué à l’application**.
Elles ne doivent **pas** être considérées comme base de travail.

Donc :
- tout vieux snapshot assistant est **caduc et obsolète**
- la base à relire doit être **le repo distant réel**, branche `archi`
- si le commit courant a changé entre-temps, il faut **reverrouiller le SHA exact** avant de patcher

---

## 3. Ce qui a déjà été fait

### Batch
- logique métier batch supprimée
- résidus JS batch supprimés
- CSS batch supprimé
- HTML batch supprimé
- fichier orphelin batch retiré

### Réarchitecture JS
La nouvelle charpente sous `src/js/` a été créée.

Arbo cible déjà amorcée :

```text
src/
  css/
  etsy-pipeline-dnd-v1_2.html
  js/
    index.js
    app/
      index.js
      boot/
      shell/
    pipeline/
      index.js
      runtime/
      ui/
        shared/
        tabletop/
        collection/
      data/
      dev/
    social/
      index.js
      runtime/
      ui/
        shared/
        tabletop/
        collection/
      data/
      publishers/
    shared/
      index.js
      utils/
      storage/
      media/
      constants/
```

### Vagues de déplacement déjà réalisées
- `src/js/ui/data/*` → `src/js/pipeline/data/`
- `pipeline_dev_data.js` → `src/js/pipeline/dev/`
- `pipeline_dev_runtime_ui.js` → `src/js/pipeline/dev/`
- wave stepper/tabs → `src/js/pipeline/ui/shared|tabletop|collection/`
- wave `pipeline/ui/shared` → fichiers UI partagés déplacés
- wave `app/shell` → `app_ui.js`, `shell_ui.js`
- wave `shared/media|storage` → `echelles_ui.js`, `images_ui.js`, `image_tools_ui.js`, `indexeddb_ui.js`
- wave `config/forms`
- wave `boot/runtime`
- bascule HTML vers un seul `script type="module"` sur `js/index.js`

### Conclusion
La **phase de déplacement d’architecture** est globalement faite.

---

## 4. Ce qu’il reste à faire sur la roadmap

La phase actuelle n’est **plus** “déplacer les fichiers”.
Le prochain bloc est :

## A. Consolider le bootstrap
C’est le **premier step restant**, et le plus immédiat.

## B. Bench avec de vraies fiches produits
Une fois le bootstrap consolidé, il faut bencher sur de vraies fiches pour vérifier que :
- le chargement est stable
- l’ordre des scripts reste correct
- aucune régression silencieuse n’a été introduite
- la nouvelle arbo ne casse rien en conditions réelles

## C. Ensuite seulement : gros chantier suivant
Après bench validé :
- nettoyage plus profond du code mort
- refactor ES2022 plus large
- modularisation interne plus propre
- vraie consolidation de domaines
- plus tard : gros chantier social séparé du module actuel

---

## 5. Le problème actuel exact

Le dernier step qui bloque est :

# Consolider le bootstrap interne

Attention :
Le **HTML est déjà consolidé fonctionnellement** car il ne charge plus qu’un seul fichier : `js/index.js`.

La consolidation restante concerne **l’intérieur du bootstrap**, c’est-à-dire les fichiers :
- `src/js/index.js`
- `src/js/app/index.js`
- `src/js/pipeline/index.js`
- `src/js/shared/index.js`
- `src/js/social/index.js`

### But de cette consolidation
- rendre les manifests plus propres
- structurer les groupes de chargement par domaine
- figer les listes de scripts (`Object.freeze` si utile)
- exposer éventuellement un manifest debug
- ajouter une détection de doublons de chemins
- **sans changer le comportement vivant du loader**

### Règle absolue
Ne **pas** modifier l’ordre réel de chargement.

L’ordre vivant doit rester strictement celui qui fonctionne déjà.

En particulier :
- `shared` doit rester chargé **avant** `app/boot/pipeline-ui.js`
- sinon `window.PipelineUIEchelles` devient `undefined`
- et l’UI casse avec écran noir

Erreur déjà rencontrée :

```js
Uncaught TypeError: Cannot destructure property 'buildEchellesUI' of 'window.PipelineUIEchelles' as it is undefined.
```

Donc :
**toute consolidation qui change l’ordre réel de bootstrap est mauvaise.**

---

## 6. Pourquoi les derniers patchs ont échoué

Les patchs de consolidation bootstrap générés par l’assistant ont échoué pour deux raisons :

### 1. Mauvaise base patchée
L’assistant est reparti de lectures ou reconstructions imparfaites au lieu de repartir d’une vraie base repo identique.

### 2. Mauvaise méthode de test
Le test a parfois été fait sur des fichiers reconstruits ou sur une sandbox incomplète, alors qu’il fallait tester sur **une vraie copie git propre du repo**.

Conséquence :
- `git apply` fail côté user
- ou pire, patch qui s’applique mais casse le bootstrap

---

## 7. Bonne méthode patch à partir du distant

## Source de vérité
Pour ce chantier :
- lire le **repo distant réel** sur la branche `archi`
- verrouiller le **SHA exact** avant tout patch
- ne jamais repartir d’un ancien snapshot assistant
- ne jamais corriger un patch précédent à la marge
- toujours recommencer **from scratch** depuis la bonne base

## Méthode correcte
### Étape 1 — verrouiller la base
Demander ou lire le SHA exact de `HEAD` sur la branche `archi`.

### Étape 2 — préparer une vraie base de test
Cloner le repo ou préparer une **copie git propre** du repo sur ce SHA exact.

Important :
la sandbox doit servir à tester sur **un clone/copie du repo**, pas juste sur quelques fichiers isolés.

### Étape 3 — générer le patch
Le patch doit être généré **depuis cette base propre**.

### Étape 4 — tests obligatoires
Toujours faire dans cet ordre :

```bash
git apply --check patch/git/<patch>.patch
```

```bash
git apply patch/git/<patch>.patch
```

Puis les checks syntaxiques utiles.

Puis rollback :

```bash
git apply -R --check patch/git/<patch>.patch
```

### Étape 5 — livrer
Livrer seulement si :
- apply OK
- test OK
- rollback check OK

## Règle critique
Si un patch fail à l’application, **on ne corrige pas le patch précédent**.
On repart **de zéro** depuis la vraie base distante.

---

## 8. Le tout premier step à reprendre

# STEP 1 = PATCH FINAL DE CONSOLIDATION BOOTSTRAP

### Fichiers concernés uniquement
- `src/js/index.js`
- `src/js/app/index.js`
- `src/js/pipeline/index.js`
- `src/js/shared/index.js`
- `src/js/social/index.js`

### Ce qu’il faut faire
- nettoyer et clarifier la structure interne des manifests de chargement
- regrouper les scripts par domaine / groupe lisible
- éventuellement geler les listes
- éventuellement exposer un manifest debug global
- éventuellement détecter les doublons de chemins
- **ne pas changer le loader vivant**
- **ne pas changer l’ordre réel de chargement**
- **ne pas toucher au HTML**
- **ne pas toucher au runtime métier**

### Ce qu’il ne faut surtout pas faire
- ne pas changer l’ordre réel `pipeline / shared / app / social` si c’est l’ordre vivant
- ne pas introduire de logique “intelligente” de chargement déjà présent / déjà chargé
- ne pas modifier `loadClassicScript` si ce n’est pas indispensable
- ne pas mélanger ce patch avec refactor, ES2022 large, nettoyage métier, bench, ou autres moves

### Définition du succès
Le patch est bon si :
- il s’applique sur la vraie base `archi`
- il ne casse pas l’UI
- il ne provoque pas d’écran noir
- il ne change pas le comportement du chargement
- il améliore seulement la lisibilité / robustesse interne du bootstrap

---

## 9. Après ce patch

Une fois ce patch validé :

### Step 2
Bench complet avec de vraies fiches produits.

### Step 3
Si le bench est bon, ouvrir le gros chantier suivant :
- nettoyage plus profond
- modernisation ES2022
- consolidation plus fine des modules
- dette technique restante

---

## 10. Résumé ultra-court pour le prochain agent

- La phase de moves d’architecture est faite.
- Le HTML charge déjà un seul fichier : `js/index.js`.
- Le bootstrap fonctionnel existe déjà.
- Le **dernier patch restant** est une **consolidation interne du bootstrap**.
- Les derniers patchs ont fail parce qu’ils n’étaient pas faits/testés sur une vraie base repo identique.
- Il faut repartir **from scratch** depuis le distant `archi`, SHA verrouillé.
- Il faut tester sur **une vraie copie git du repo**.
- Ne surtout pas modifier l’ordre réel du bootstrap.
- Après ce patch : bench réel, puis gros chantier suivant.
