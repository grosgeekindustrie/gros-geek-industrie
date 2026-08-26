# Commenting Standard

## Objectif
Ce document définit comment commenter le code du projet Etsy Pipeline.

Le but n’est pas d’ajouter du bruit.
Le but est d’aider un agent ou un humain à comprendre rapidement :
- le rôle d’un fichier
- le contrat d’un bloc
- les points fragiles
- les dépendances
- ce qu’il ne faut pas casser

## 1. Règle générale
Un commentaire doit apporter une information que le code seul ne donne pas clairement.

Un commentaire utile explique :
- pourquoi un bloc existe
- à quoi il sert
- ce qu’il dépend
- ce qui est temporaire
- ce qu’il ne faut pas casser

Un commentaire inutile répète juste le code.

## 2. Ce qu’il faut commenter
Commenter en priorité :
- les en-têtes de fichiers
- les sections importantes
- les contrats DOM
- les zones pilotées par JS
- les couches CSS et leur rôle
- les fonctions JS publiques ou sensibles
- les zones temporaires / legacy / résiduelles
- les migrations partielles
- les comportements implicites
- les points de couplage entre HTML, CSS et JS

## 3. Ce qu’il ne faut pas commenter
Éviter :
- les commentaires ligne par ligne sans valeur ajoutée
- les commentaires décoratifs
- les commentaires qui paraphrasent simplement le code
- les commentaires obsolètes après modification du code
- les commentaires trop vagues du type “gestion”, “logique”, “bloc important”

## 4. Granularité recommandée
Le standard du projet est :
- commenter les blocs
- commenter les contrats
- commenter les zones sensibles
- ne pas commenter chaque instruction

En cas de doute :
mieux vaut un bon commentaire de bloc que dix petits commentaires inutiles.

## 5. Standard par type de fichier

### 5.1 HTML
Dans le HTML, commenter :
- les grandes zones de page
- les blocs fonctionnels
- les zones injectées ou déplacées par JS
- les zones legacy
- les paires structurelles importantes comme Tabletop / Collection

Exemples de commentaires utiles :
- zone commune visible sur plusieurs vues
- bloc déplacé dans la vue pipeline par JS
- hooks legacy conservés pour compatibilité
- structure dupliquée volontairement entre deux modes

Ne pas commenter chaque `div`.

### 5.2 CSS
Dans le CSS, commenter :
- le rôle du fichier
- la responsabilité de la couche
- les sections principales
- les zones temporaires
- les helpers sensibles
- les overrides

Un fichier CSS doit expliquer :
- pourquoi il existe
- ce qui doit rester dedans
- ce qui ne doit pas y être ajouté
- si c’est une couche stable ou temporaire

Exemple :
`06-inline-merged.css` doit être clairement présenté comme résidu temporaire, pas comme cible normale d’ajout.

### 5.3 JS
Dans le JS, commenter :
- le rôle du fichier
- les fonctions publiques
- les fonctions critiques
- les effets de bord
- les dépendances à l’état global
- les dépendances DOM
- les conventions attendues
- les migrations en cours

Pour une fonction, commenter si nécessaire :
- les entrées importantes
- les sorties
- les effets secondaires
- les éléments DOM touchés
- les objets globaux utilisés
- les raisons d’un comportement non évident

## 6. Format recommandé

### 6.1 En-tête de fichier
Chaque fichier important devrait commencer par un en-tête court indiquant :
- son rôle
- son périmètre
- sa responsabilité dominante
- les limites à respecter

### 6.2 Commentaire de section
Avant un gros bloc, utiliser un commentaire qui dit :
- ce que gère la section
- son périmètre
- son intention

### 6.3 Commentaire de contrat
Utiliser ce type de commentaire quand un bloc dépend :
- d’un `id`
- d’une structure DOM précise
- d’un ordre de chargement
- d’un nom d’attribut
- d’une convention de projet

### 6.4 Commentaire temporaire
Toute zone temporaire doit préciser :
- pourquoi elle existe
- si elle accepte encore des ajouts ou non
- vers quoi elle doit migrer
- dans quel contexte elle peut être supprimée

## 7. Règles par contexte

### 7.1 Legacy
Si une zone legacy reste en place, le commentaire doit dire :
- qu’elle est conservée pour compatibilité
- qu’elle ne constitue pas la norme cible
- qu’elle ne doit pas être recopiée dans les nouvelles features
- si une convention plus moderne est désormais la norme pour le nouveau code

### 7.2 Migration partielle
Si une migration est en cours, le commentaire doit dire :
- ce qui a déjà été migré
- ce qui ne l’est pas encore
- la règle à suivre pour la suite

### 7.3 Hooks JS
Quand une zone HTML ou JS dépend d’un hook important, le commentaire doit rappeler la convention projet :
- nouveaux hooks JS = `data-js`
- classes = style
- `id` = unicité / accessibilité / legacy

## 8. Style d’écriture
Un bon commentaire doit être :
- court
- précis
- stable
- concret
- actionnable

Éviter :
- les phrases trop longues
- les formulations floues
- l’humour dans les commentaires techniques
- les commentaires émotionnels
- les commentaires datés si la date n’apporte rien

## 9. Exemples de bons commentaires

### HTML
`<!-- VIEW PIPELINE : zone de rendu principale pendant l’exécution ; certains blocs form sont déplacés ici par JS -->`

`<!-- BLOC COLLECTION : structure volontairement séparée du mode Tabletop ; ne pas fusionner sans abstraction validée -->`

### CSS
`/* INLINE MERGED LAYER : résidu temporaire. Les blocs stables ont été redistribués. Ne pas utiliser ce fichier comme destination par défaut pour une nouvelle feature. */`

`/* SOCIAL SECTIONS : styles structurels des blocs réseaux communs aux vues Tabletop et Collection */`

### JS
`// Orchestrateur principal : coordonne les modules UI sans recentraliser leur logique métier.`

`// Hook legacy conservé pour compatibilité DOM actuelle. Ne pas reproduire ce pattern dans une nouvelle feature.`

`// Effet de bord : déplace les blocs pipeline et outputs dans la vue pipeline pendant l’exécution.`

## 10. Exemples de mauvais commentaires
À éviter :
- `/* bouton */`
- `/* styles */`
- `// fait quelque chose`
- `// important`
- `// logique`
- `// temporaire` sans explication
- `// ne pas toucher` sans justification

## 11. Mise à jour des commentaires
Toute modification d’un bloc commenté doit vérifier que le commentaire reste vrai.

Règle :
- si le code change et que le commentaire devient faux, il faut corriger ou supprimer le commentaire dans le même patch

Un vieux commentaire faux est pire que pas de commentaire du tout.

## 12. Niveau minimum attendu par couche

### Minimum pour HTML
- commentaire d’en-tête par grande zone
- commentaire sur les blocs déplacés/injectés par JS
- commentaire sur les duplications volontaires

### Minimum pour CSS
- commentaire d’en-tête par fichier
- commentaire par grande section
- commentaire explicite sur toute couche temporaire ou résiduelle

### Minimum pour JS
- commentaire d’en-tête par module
- commentaire sur toute fonction publique ou critique
- commentaire sur les effets de bord non évidents

## 13. Règle finale
Commenter moins, mais commenter mieux.

Le commentaire doit aider un agent à intervenir sans casser le projet.
S’il n’aide pas à comprendre, cadrer ou sécuriser, il n’a probablement pas besoin d’exister.
