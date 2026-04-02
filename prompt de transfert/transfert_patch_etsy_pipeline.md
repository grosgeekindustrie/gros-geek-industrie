# Transfert patch — Etsy Pipeline

## Règles impératives
- Utilise uniquement les fichiers envoyés dans le message courant.
- Tout ce qui précède est caduc.
- Le repo distant sert uniquement à comprendre l’architecture.
- Les fichiers locaux transmis sont la seule source de vérité.
- Compare toujours les fichiers avec `git hash-object --no-filters`, jamais avec `git hash-object` simple.
- Ne reroll jamais un patch si `patch does not apply` sans vérifier d’abord la base exacte.

## Ce qui a été débunké
- Le décalage principal venait des fins de ligne et de la comparaison de hash avec filtres Git.
- `git hash-object` dans le repo pouvait donner un hash différent du contenu brut.
- `git hash-object --no-filters` a permis de vérifier le vrai contenu envoyé.
- Un smoke test patch HTML a marché.
- Une normalisation EOL a été faite avec succès.

## État Git / EOL
- `.gitattributes` présent à la racine avec `eol=lf` pour `js/css/html/md/json/yml/yaml`.
- Config locale Git validée :
  - `core.autocrlf=false`
  - `core.eol=lf`
  - `core.safecrlf=warn`
- Bulk rewrite réussi :
  - `git ls-files -z '*.js' '*.css' '*.html' '*.md' '*.json' '*.yml' '*.yaml' | xargs -0 sed -i 's/\r$//'`
  - `git add --renormalize .`

## Fichier manquant restauré
Le fichier qui avait disparu localement était :
- `src/js/ui/collection_stepper_ui.js`

Vérifier après remise en place :
```bash
git ls-files --eol src/js/ui/collection_stepper_ui.js
node --check src/js/ui/collection_stepper_ui.js
```

## Scope patch à reprendre
1. Stabiliser la position des boutons du stepper d’un step à l’autre
2. Garder `Précédent` visible mais désactivé au step 1
3. Rendre la checkbox licence plus compacte
4. Supprimer l’accordéon du step 4
5. Mettre `Notes libres` en pleine largeur
6. Éloigner visuellement `Lancer le pipeline` pour limiter les miss-clicks

## Fichiers à utiliser pour ce scope
- `src/etsy-pipeline-dnd-v1_2.html`
- `src/css/02-ui-pro.css`
- `src/css/04-form-layout.css`
- `src/js/ui/collection_stepper_ui.js`

## Protocole patch
Avant de patcher :
1. Lister les fichiers réellement utilisés
2. Verrouiller les hashes `--no-filters`
3. Confirmer le scope exact
4. Générer le patch dans `patch/git/...`

## Commandes de contrôle
```bash
git branch --show-current
git rev-parse --short HEAD
git status --short

git hash-object --no-filters src/etsy-pipeline-dnd-v1_2.html
git hash-object --no-filters src/css/02-ui-pro.css
git hash-object --no-filters src/css/04-form-layout.css
git hash-object --no-filters src/js/ui/collection_stepper_ui.js
```

## Commandes d’application patch
```bash
git apply --check patch/git/mon_patch.patch
git apply patch/git/mon_patch.patch
node --check src/js/ui/collection_stepper_ui.js
git diff --stat
git diff
```

## Rappel important
Si `patch does not apply`, ne pas supposer que le patch est faux :
- vérifier d’abord les hashes `--no-filters`
- vérifier que seuls les fichiers du message courant sont utilisés
- vérifier le scope exact
