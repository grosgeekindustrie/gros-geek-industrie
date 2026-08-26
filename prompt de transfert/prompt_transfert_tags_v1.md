# Prompt de transfert — Etsy Pipeline — chantier TAGS V1

## Rôle attendu du prochain agent
Tu as un niveau **senior** avec **10 ans d’expérience**, tu codes proprement, avec rigueur, sobriété et sens du risque. Tu ne laisses ni code mort, ni dette technique évitable, ni logique bricolée. Tu privilégies : - lisibilité - découpage propre - commentaires utiles - respect strict du périmètre - prudence sur le legacy Tu dois te comporter comme un **partenaire technique fiable**, pas comme un LLM qui improvise quand une pièce manque.
Tes specialité secondaire au vu de ton experience, le référencement et le SEO


Tu dois privilégier :
- lisibilité
- périmètre strict
- cohérence avec l’UI réelle
- prudence sur le legacy
- corrections localisées

Tu ne dois pas improviser quand une pièce manque.
Si une ressource manque, tu le dis, tu identifies précisément ce qu’il faut, puis tu demandes la bonne ressource.

---

## Règle d’or absolue
Le repo distant sert à comprendre.
Les fichiers locaux du message courant sont la seule base patchable.

Pour tout patch code :
- tout ce qui précède est caduc
- les anciens snapshots ne valent plus rien
- le repo distant sert seulement à lire l’architecture et le contexte
- les fichiers locaux transmis sont la seule source de vérité

Si un patch ne s’applique pas, ne reroll pas à l’aveugle.
Il faut d’abord considérer que la base utilisée est mauvaise tant que les hashes n’ont pas été reverrouillés.

---

## Règle technique obligatoire sur les hashes
Toujours utiliser :

```bash
for f in \
<liste de fichiers>
do
  printf "%s  %s\n" "$(git hash-object --no-filters "$f")" "$f"
done
```

Jamais `git hash-object` simple.
Toujours `--no-filters`.

Si les hashes ne matchent pas, l’erreur vient du côté agent jusqu’à preuve du contraire.

---

## Workflow obligatoire
1. Relire le distant pour comprendre la transversalité réelle du ticket.
2. Demander uniquement les fichiers locaux réellement nécessaires.
3. Reverrouiller les hashes.
4. Écrire noir sur blanc :
   - quels fichiers sont utilisés
   - pourquoi chacun est nécessaire
   - quel est le périmètre exact
5. Générer un vrai patch git propre.
6. Vérifier au minimum :
   - `git apply --check`
   - `node --check` sur les JS touchés
7. Livrer seulement après validation.

---

## Ce qu’il ne faut plus refaire
- travailler depuis un ancien snapshot
- mélanger mémoire de conversation et fichiers locaux récents
- sous-estimer la transversalité
- repartir dans une grosse refonte alors que le besoin est ciblé
- empiler trop de règles dans un prompt jusqu’à le dégrader
- produire du texte “à recoller” quand un vrai `*.patch` est demandé
- oublier les commandes git d’application / rollback
- restituer les prompts dans un ordre différent de l’UI

Formule à retenir :
**si une couleur manque, tu demandes la bonne couleur. Tu ne fais pas de mélange.**

---

# Branches et base de réflexion
## Branches relues pendant ce chantier
- `dev`
- `tags_agents`
- `tags_agents_1`

## Conclusion actuelle sur les branches
- `dev` donne une bonne philosophie de prompts : prompts plutôt légers, spécialisés, lisibles.
- `tags_agents` est une bonne base de travail concrète pour la logique TAGS, avec un trio E / F / S déjà exploitable.
- `tags_agents_1` a servi de bench sur les prompts, mais le chantier a dérivé plusieurs fois vers des prompts trop longs.

### Cap retenu
Quand ça dérive, **repartir de `dev` ou de `tags_agents`**, pas d’une version gonflée par couches successives.

---

# Ordre réel du pipeline TAGS
L’ordre réel et utile est celui de l’UI :

## Explore → Filter → Select

À respecter dans :
- l’analyse
- la conception des règles
- la restitution des prompts

Ne pas raisonner dans un autre ordre.
Le dernier agent est **Select**.
Si Select n’est pas bon, tout le reste perd beaucoup de valeur.

---

# Objectif métier actuel
Le but n’est pas d’obtenir un résultat parfait dans le prompt.
Le but est d’obtenir une **pipeline TAGS V1 exploitable rapidement**, sachant que :
- le système de validation / invalidation utilisateur existe
- l’utilisateur corrigera ensuite manuellement
- il reste beaucoup d’autres chantiers après TAGS

Il faut donc :
- améliorer la direction générale
- éviter les sorties trop nulles
- ne pas transformer les prompts en usine à gaz

---

# Ce que l’on cherche à faire sur les TAGS
## Objectif principal
Faire sortir des tags Etsy FR plus utiles, plus naturels et moins mécaniques.

## Direction métier validée
On cherche à obtenir :
- moins de spam `figurine / statue / garage kit / résine`
- au moins **un** tag avec `impression 3d` dans le final quand c’est crédible
- plus de connexes de lore du **premier cercle** quand c’est pertinent
- plus de vraie longue traîne utile
- moins de remplissage faible ou décoratif

## Important
Le système ne doit pas être overfitté sur Jinx.
Jinx a servi de bench principal, mais toute règle doit rester valable pour les futures figurines.

---

# État réel des essais prompt
## Ce qui a été tenté
Plusieurs essais ont été faits sur Axel Explore pour pousser :
- anti-spam
- longue traîne
- lore / personnages connexes
- `impression 3d`

## Ce qui a été compris
### 1. La biblio validée structure trop
Quand la bibliothèque de tags validés est complète, l’agent a tendance à recopier la mécanique des exemples :
- `figurine + terme`
- `statue + terme`
- `garage kit + terme`
- `terme + résine`

### 2. Sans tags validés, l’agent part parfois dans le vide
Quand on retire les tags validés et qu’on garde surtout les exclusions, on évite certains moules, mais l’agent peut aussi retomber sur :
- tags très courts
- tags trop génériques
- bruit faible

### 3. Trop de règles dégrade le prompt
Empiler trop de blocs finit par nuire :
- le prompt devient trop long
- l’agent suit mal les priorités
- on retombe dans un comportement confus

### 4. La longueur minimale a été une fausse bonne idée
Une tentative avec une contrainte du type `20 caractères minimum` a poussé le modèle à rallonger artificiellement les tags avec des mots peu utiles.
Conclusion : ne pas piloter la qualité par une longueur minimale rigide.

---

# Résultats observés sur les sorties
## Problèmes encore fréquents
L’agent sort encore souvent :
- trop de permutations produit (`figurine`, `statue`, `garage kit`)
- trop peu de vrais usages
- du vocabulaire descriptif de personnage peu utile (`blue hair`, `nattes`, etc.)
- des formulations FR/EN bancales (`vi and jinx`)
- des tags faibles sur le studio / sculpteur (`bulkamancer`)
- des tags vagues (`figurine animation`, `steampunk`, `collection fantasy`)

## Point positif réel
Le bloc lore a commencé à faire émerger quelques connexes de premier cercle.
C’est un axe utile, mais il ne doit pas être trop détaillé ni spécifique à un seul univers.

---

# Ce que l’on cherche maintenant côté prompts
## Ligne stratégique
Le prochain agent doit rechercher un **point d’équilibre** :
- assez de cadre pour éviter les sorties nulles
- pas assez de règles pour étouffer ou rendre le prompt illisible

## Ce qu’il faut probablement garder comme cap
### Explore
Le rôle d’Explore est d’ouvrir large, mais sans trop de spam et sans dériver vers des tags absurdes.
Il doit favoriser :
- quelques tags produit utiles
- quelques tags lore / connexes du premier cercle
- quelques tags longue traîne vraiment utiles
- un angle `impression 3d` quand crédible

### Filter
Filter doit rester assez sobre, mais solide.
Il doit éliminer :
- tags trop faibles
- tags mécaniques
- tags descriptifs pauvres
- tags studio / échelle / bruit faible

### Select
C’est la pièce la plus importante.
Il faut probablement concentrer les vrais arbitrages ici :
- réduire les variantes produit trop proches
- laisser passer 1 ou 2 connexes s’ils sont meilleurs qu’une permutation générique
- garder 1 tag `impression 3d` quand il existe un bon candidat
- pousser un peu plus les tags utiles que les tags décoratifs

---

# Position actuelle sur la “longue traîne”
## Ce qu’on veut
On veut davantage de tags qui ajoutent un angle utile, par exemple :
- usage
- contexte
- lien d’univers
- relation connexe
- lieu
- élément emblématique

## Ce qu’on ne veut pas
On ne veut pas caractériser la longue traîne avec des exemples trop spécifiques à un personnage donné.
On ne veut pas non plus imposer une longueur minimale rigide.

## Conclusion
La bonne approche semble être :
- définir la longue traîne comme un **angle utile**, pas comme une question de longueur
- garder cela en peu de lignes
- éviter les listes d’exemples trop spécifiques

---

# Position actuelle sur le lore / connexes
## Ce qu’on veut
Faire émerger le **premier cercle narratif** du personnage ou de l’univers quand c’est naturel :
- allié important
- antagoniste principal
- rival
- mentor
- compagnon majeur
- faction
- lieu emblématique
- objet fort
- menace marquante

## Ce qu’on ne veut pas
- pas de liens lointains
- pas d’overfit sur Jinx
- pas d’exemples trop nombreux dans le prompt final

---

# Bug UI déjà corrigé pendant ce fil
Un bug distinct a été identifié et corrigé côté UI :

## Problème
Le bouton d’exploration massive des tags dans l’UI n’excluait pas correctement les tags déjà présents dans la biblio (validés / invalidés / blacklistés).

## Fichier touché
- `src/js/ui/selections_ui.js`

## Résultat
Un patch a été fourni et l’utilisateur a confirmé :
**“ok parfait ça marche !!!”**

Ce point est donc considéré comme **corrigé localement**.
Si le sujet revient, repartir de ce fichier et vérifier l’état local avant toute autre modif.

---

# Ce que le prochain agent doit faire maintenant
## Priorité
Ne pas repartir dans une grosse réécriture complète.
Le besoin immédiat est :
- stabiliser les prompts TAGS
- trouver un meilleur équilibre sur Explore / Filter / Select
- avancer vite, car il reste beaucoup de travail ensuite

## Attendu concret
Le prochain agent doit :
1. repartir d’une base saine (`dev` ou `tags_agents`)
2. garder les prompts courts
3. éviter d’empiler des règles
4. raisonner dans l’ordre **Explore → Filter → Select**
5. considérer que **Select est la pièce maîtresse** du rendu final
6. chercher un compromis réaliste, pas la perfection

## À éviter absolument
- prompts trop longs
- exemples trop spécifiques à un bench Jinx
- overfitting à un seul univers
- règles de longueur minimale rigides
- multiplication de blocs “anti-quelque chose” jusqu’à saturation

---

# Résumé ultra-court pour reprise rapide
- priorité actuelle = **stabiliser TAGS V1**
- ordre réel = **Explore → Filter → Select**
- quand ça dérive, repartir de **`dev`** ou **`tags_agents`**
- la biblio validée complète structure trop les sorties
- les exclusions restent utiles
- trop de règles dégradent les prompts
- le bug UI du bouton explorer tags a été corrigé localement dans `selections_ui.js`
- objectif métier :
  - moins de spam produit
  - plus de connexes de premier cercle
  - 1 tag `impression 3d` crédible
  - plus de vraie longue traîne utile
  - sans overfitter sur Jinx
