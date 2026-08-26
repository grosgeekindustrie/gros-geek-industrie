# Guidelines patching — projet Etsy Pipeline

## 1. Source de vérité
- Le repo distant sert à comprendre l’architecture et la transversalité.
- Les fichiers locaux fournis par l’utilisateur sont la seule source de vérité pour écrire un patch.

## 2. Règle d’arrêt
- S’il manque une information structurelle, arrêter immédiatement le raisonnement.
- Ne jamais “compléter” une pièce manquante par intuition.
- Ne jamais déplacer de logique dans un autre fichier “parce que ça semble marcher”.

## 3. Avant de demander des fichiers
- Si le ticket est local et évident, demander directement les fichiers utiles.
- Si le ticket semble transverse, demander d’abord à l’utilisateur de push, puis lire le distant pour identifier :
  - où vit la logique métier,
  - où vit la logique shell,
  - où vit la logique de sélection,
  - où vit le host HTML/CSS.

## 4. Verrouillage explicite
Avant de générer un patch, écrire noir sur blanc :
- quels fichiers locaux sont utilisés,
- pourquoi chacun est nécessaire,
- et quel est le périmètre exact du ticket.

## 5. Après chaque patch validé
- Si l’utilisateur applique le patch puis commit, tous les anciens fichiers envoyés deviennent caducs.
- Pour le step suivant, repartir des nouveaux fichiers locaux exacts.

## 6. Échec de patch

### Si `patch does not apply`
- Ne pas régénérer immédiatement.
- Vérifier d’abord la concordance :
  - branche courante,
  - état git,
  - présence de 1 ou 2 marqueurs attendus dans les fichiers ciblés.

### Si `corrupt patch`
- Considérer que le patch est mal formé.
- Ne pas demander à l’utilisateur de le corriger manuellement, sauf faute triviale avérée.
- Régénérer un patch propre.

## 7. Choix des fichiers
- Ne pas demander “le minimum théorique”.
- Demander le minimum suffisant pour couvrir les contrats transverses.
- Exemple typique :
  - fichier feature principal,
  - fichier de sélection,
  - fichier shell/header,
  - fichier bridge/imports,
  - HTML host,
  - CSS du layout,
  - CSS de composants si nécessaire.

## 8. Hiérarchie des responsabilités
Sur ce projet :
- `batch_ui.js` = runtime batch / glue batch
- `selections_ui.js` = logique de validation utilisateur / sélection
- `app_ui.js` = shell / vues / header / annulation
- `pipeline-api.js` = runtime d’exécution des agents
- `pipeline-ui.js` = bridge / point d’assemblage
- HTML/CSS = contrats DOM et couches de rendu

## 9. Interdits
- Pas de script Python de transformation.
- Pas de regex massives pour réécrire des fichiers.
- Pas de refactor opportuniste hors scope.
- Pas de patch généré sur un snapshot supposé.

## 10. Validation avant livraison
Avant d’envoyer un patch :
- `git apply --check`
- check syntaxe des fichiers JS touchés
- relire le diff pour vérifier qu’il respecte le scope
- ne rien annoncer comme “bon” tant que ces vérifications n’ont pas passé

## 11. Principe directeur
**Si une pièce manque, on s’arrête.  
On ne mélange pas les couleurs pour inventer celle qui manque.**
