# Patch Workflow

## Objectif
Ce document explique comment préparer, générer, vérifier et appliquer un fichier `*.patch` propre dans le projet.

Le but est d’éviter :
- les patchs générés sur un mauvais état de branche
- les patchs théoriques basés sur un fichier différent du local
- les erreurs de format de patch
- les erreurs liées aux fins de ligne (LF / CRLF)
- les gros patchs illisibles ou fragiles

---

## 1. Règle n°1
Un patch doit toujours être généré à partir de l’état exact de la branche cible.

Ne jamais supposer :
- qu’une branche est identique à une autre
- qu’un patch précédent est appliqué
- qu’un fichier local est identique à celui déjà envoyé dans un autre fil

---

## 2. Avant de générer un patch
Toujours vérifier :

```bash
git branch --show-current
git status --short
git diff -- <fichier1> <fichier2>
```

Si besoin :

```bash
git log --oneline --graph --decorate -10
```

Objectif :
- savoir sur quelle branche on travaille
- savoir si le fichier local a changé
- savoir si le patch doit être recalé sur un nouvel état

### 2.1 Si des ressources probables manquent
Avant de demander des fichiers “au hasard”, l’agent doit :

1. lire le repo sur la **branche de travail** si elle est push ;
2. sinon lire la **branche source / de création** ;
3. utiliser cette lecture pour repérer les fichiers probablement nécessaires ;
4. demander ensuite à l’utilisateur le **lot minimal utile**.

Important :
- cette lecture repo sert à **repérer** les ressources utiles ;
- elle ne remplace jamais les **fichiers locaux réellement fournis** ;
- tenir compte de la limite pratique de **20 fichiers transmis** côté utilisateur ;
- si le besoin n’est pas encore cadré, faire d’abord un **débrief du périmètre technique** avant de générer le patch.

---

## 3. Règle de périmètre
Un patch = un objectif dominant.

Exemples :
- cleanup HTML structurel
- commentaires CSS
- commentaires JS
- fix modal tags
- migration d’un bloc inline vers classe CSS

Éviter :
- un patch qui mélange HTML + CSS + JS + refactor de structure + renommage

Si plusieurs couches sont touchées :
- soit découper en plusieurs patchs
- soit cadrer clairement l’objectif

---

## 4. Générer un patch propre
Méthode recommandée :

1. modifier localement les fichiers
2. vérifier le diff
3. générer le patch depuis Git

Chemin projet recommandé :
- `patch/git/`

Exemple :

```bash
git diff -- src/etsy-pipeline-dnd-v1_2.html src/css/ > patch/git/mon_patch.patch
```

Ou sur un seul fichier :

```bash
git diff -- src/js/pipeline-ui.js > patch/git/comments_pipeline_ui.patch
```

---

## 5. Toujours relire le diff avant usage
Avant de livrer un patch :

```bash
git diff -- src/etsy-pipeline-dnd-v1_2.html src/css/
```

Vérifier :
- le bon fichier
- le bon périmètre
- pas de suppression involontaire
- pas de refactor parasite
- pas de bloc dupliqué
- pas de changement logique caché si le patch est censé être “safe”

---

## 6. Vérifier le patch avant apply
Toujours faire :

```bash
git apply --check patch/git/mon_patch.patch
```

Si ça passe :

```bash
git apply patch/git/mon_patch.patch
```

Puis contrôler :

```bash
git diff --stat
git diff
```

---

## 7. Si `git apply --check` échoue
Il y a 4 causes classiques.

### 7.1 Mauvais état de branche
Le patch a été généré depuis un autre état du fichier.

Solution :
- repartir des fichiers exacts de la branche cible
- régénérer le patch

### 7.2 Mauvais format de patch
Le patch est mal formé.

Exemple :
- `patch fragment without header`
- hunk `@@` invalide
- patch bricolé manuellement

Solution :
- ne pas écrire le patch à la main
- régénérer via un vrai diff Git

### 7.3 Fins de ligne différentes
Le patch a été généré en LF alors que les fichiers locaux sont en CRLF, ou inversement.

Solution :
- vérifier l’état réel local
- régénérer le patch sur le même type de fin de ligne que les fichiers ciblés

### 7.4 Périmètre trop large
Le patch touche trop de blocs et devient fragile.

Solution :
- réduire le patch
- faire une version minimale
- viser un patch plus ciblé

---

## 8. Cas classique : `patch does not apply`
Quand Git dit :

- `patch failed`
- `patch does not apply`

cela veut souvent dire :
“le contexte attendu par le patch n’existe plus exactement dans le fichier local”.

Ce n’est pas forcément un bug Git.
C’est souvent un décalage d’état.

Réflexe :
- vérifier la branche
- vérifier le fichier réel
- régénérer le patch à partir du fichier courant

---

## 9. Cas classique : `patch fragment without header`
Quand Git dit :

- `patch fragment without header`

le patch est mal formé.

En général :
- hunk `@@` sans vrai header
- patch bricolé à la main
- patch partiel exporté n’importe comment

Solution :
- jeter le patch
- repartir d’un diff Git propre

---

## 10. Bonnes pratiques de rédaction
Un bon patch doit être :
- ciblé
- lisible
- testable
- basé sur l’état réel
- cohérent avec la branche cible

Éviter :
- les patchs “théoriques”
- les patchs générés depuis une autre branche
- les patchs géants si un patch minimal suffit
- les patchs qui font plus que ce qui a été demandé

---

## 11. Workflow recommandé dans ce projet
Ordre conseillé :

1. confirmer la branche
2. confirmer les fichiers réels
3. si besoin, repérer les ressources manquantes probables via le repo
4. débriefer le périmètre si le besoin n’est pas encore verrouillé
5. modifier localement
6. relire le diff
7. générer le patch dans `patch/git/`
8. `git apply --check`
9. `git apply`
10. check visuel ou technique selon le type de patch

---

## 12. Checklists rapides

### Patch UI
- [ ] bon fichier
- [ ] bon état de branche
- [ ] diff relu
- [ ] `git apply --check`
- [ ] check visuel après apply

### Patch JS
- [ ] bon fichier
- [ ] pas de logique parasite
- [ ] diff relu
- [ ] `git apply --check`
- [ ] test manuel minimal

### Patch commentaires
- [ ] aucun changement logique
- [ ] diff propre
- [ ] commentaires vrais et utiles
- [ ] patch ciblé
- [ ] `git apply --check`

---

## 13. Règle finale
Un patch propre ne se juge pas seulement à son contenu.

Il doit aussi :
- viser la bonne branche
- cibler les bons fichiers
- correspondre à l’état exact du code local
- passer au `git apply --check`
