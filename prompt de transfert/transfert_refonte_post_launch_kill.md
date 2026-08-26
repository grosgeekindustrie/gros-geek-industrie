# Prompt de transfert — refonte pipeline après abandon du launch ciblé

## Contexte immédiat

Le chantier de refonte a avancé, mais une feature secondaire a consommé beaucoup trop de temps :

**la feature "lancer jusqu’à X agent / X étape" est abandonnée pour l’instant.**

Décision validée :
- on **tue complètement** cette feature
- on **oublie** le launch ciblé
- on revient à un **seul lancement réel : pipeline complet**
- on garde le step **Lancement**, mais il redevient simple, lisible et fiable

Le projet doit maintenant reprendre la roadmap **de la bonne manière**, sans se laisser détourner par des micro-features coûteuses en temps.

---

## Règle de recadrage

À partir de maintenant, le cap est :

**stabiliser le moteur utile**
et
**continuer la refonte structurante**

Pas :
- bricoler des features secondaires
- repartir dans des patchs en boucle
- complexifier le runtime pour une UX non prioritaire

---

## Ce qui est officiellement sorti du scope

### Feature abandonnée
La feature suivante est **gelée / supprimée** :

- sélectionner une étape cible
- lancer le pipeline jusqu’à cette étape
- gérer un `targetStepId` dans le flux normal de lancement
- dupliquer les boutons entre "sélection" et "launch"
- maintenir une UI de type "launch jusqu’à titre/tags/description/alt"

### Conséquence
Le runtime doit redevenir simple :

- **un seul bouton de lancement utile**
- **un seul comportement**
- **pipeline complet**

Le step **Lancement** reste pertinent, mais comme panneau de contrôle simple :
- état
- coût/cache
- lancement complet
- éventuellement debug plus tard

Pas comme cockpit multi-cibles.

---

## Ce qui reste valide dans la refonte

### 1. Workflow mono
Le projet reste orienté :

**une fiche à la fois**

Le batch n’est plus le moteur du produit.

### 2. Cumulatif append-only
La logique cible reste :

- chaque agent reçoit le cumul précédent
- chaque sortie est ajoutée
- on ne réécrit pas les anciennes sections
- on ne détruit pas le dossier cumulatif entre étapes

### 3. Ordre canonique
Ordre métier conservé :

1. marche
2. titre
3. tags
4. description
5. alt

### 4. Même moteur Collection / Tabletop
Règle forte toujours valide :

**Collection** et **Tabletop** doivent partager :
- le même moteur pipeline
- la même logique cumulative
- la même logique cache
- la même logique de monitoring
- la même logique de lancement global

Seuls peuvent différer :
- le stepper
- les agents
- certaines données métier
- certains champs formulaire

### 5. Step final "Lancement"
Le step **Lancement** reste dans le stepper.

Mais il doit maintenant être pensé comme :
- un point d’entrée simple
- un affichage d’état
- un affichage cache / coût
- un bouton de lancement complet

Et non comme une UX avancée de lancement partiel.

### 6. Le triple agent tags reste en place
Très important :

- **ne pas défaire le triple agent tags maintenant**
- **ne pas refondre les prompts tags maintenant**
- ce chantier viendra plus tard, quand la refonte prompts sera relancée

Pour l’instant :
- tags peut rester composite
- il faut seulement que le runtime / reporting reste lisible

---

## État de lecture actuel

Le chantier a produit de vrais résultats :
- le coût a baissé
- le cache commence à produire des hits utiles
- le step Lancement existe déjà
- la logique cumulatif / cache-aware avance
- la refonte est donc **réelle**, pas théorique

Mais plusieurs écarts restent à fermer.

---

## Priorités actuelles du chantier

## Priorité 1 — Recentrer le lancement
Maintenant que le launch ciblé est abandonné :

- enlever toute logique résiduelle liée à la sélection d’étape cible
- revenir à un lancement complet propre
- simplifier le step Lancement
- éviter toute ambiguïté dans l’UI

Objectif :
**zéro confusion sur ce que fait le bouton lancer**

---

## Priorité 2 — Continuer la convergence Collection / Tabletop
Le moteur doit continuer à converger.

Point de vigilance connu :
- **Tabletop** termine sur un vrai `alt`
- **Collection** garde encore des différences autour de `analyse` / `alt`

Le prochain agent doit poursuivre la convergence sans casser le runtime existant.

---

## Priorité 3 — Fiabiliser le step Lancement
Le step Lancement doit maintenant être :
- propre
- simple
- fiable
- aligné avec le lancement complet uniquement

À fiabiliser :
- libellés
- états
- statut final
- affichage du cache
- lisibilité coût/runtime

---

## Priorité 4 — Continuer le travail cache / cumulatif
Le cache commence à marcher, mais le chantier n’est pas terminé.

Le prochain agent doit continuer à travailler sur :
- cohérence du shared prefix
- cohérence du cumulatif append-only
- homogénéité des chemins runtime importants
- compatibilité avec un futur warmup invisible

Important :
- le **warmup réel** n’est pas forcément la priorité immédiate
- mais l’architecture doit rester compatible avec cette idée

---

## Priorité 5 — Garder le reporting runtime lisible
Le triple agent tags reste temporairement.

Donc il faut :
- distinguer clairement l’étape métier `tags`
- et les sous-phases techniques internes
- sans casser l’architecture

Objectif :
- reporting lisible
- labels cohérents
- pas de confusion entre `titre`, `tags`, `description`, etc.

---

## Priorité 6 — Ne pas rouvrir les prompts maintenant
La refonte prompts viendra plus tard.

Le prochain agent refonte ne doit pas partir sur :
- une réécriture de prompts
- une optimisation éditoriale des agents
- une nouvelle stratégie tags
- une nouvelle stratégie titres
- une nouvelle stratégie description

Le scope reste :
**moteur / runtime / structure / UI utile**

---

## Ce qu’il reste à faire ensuite dans la roadmap

Une fois le moteur recentré, il restera à poursuivre :

1. convergence Collection / Tabletop
2. stabilisation complète du step Lancement
3. homogénéisation du cache / cumulatif
4. amélioration progressive du reporting runtime
5. nettoyage batch hors du cœur produit
6. extraction de données déclaratives quand le runtime sera stabilisé
7. ensuite seulement, refonte prompts agents
8. puis reprise des optimisations plus fines

---

## Ce qu’il ne faut surtout plus faire

- ne pas rouvrir la feature "launch jusqu’à X"
- ne pas réintroduire un `targetStepId` UX dans le flux normal
- ne pas repartir dans des micro-patches de plusieurs heures pour une feature secondaire
- ne pas casser la refonte utile pour une UX non critique
- ne pas recréer deux moteurs divergents
- ne pas toucher aux prompts maintenant
- ne pas supprimer le triple agent tags maintenant
- ne pas relancer une grosse phase de bench inutile

---

## Discipline patch à respecter

### Règle de vérité
- Le repo distant GitHub sert à comprendre l’architecture
- Les fichiers locaux fournis dans le chat sont la seule base patchable

### Vérification obligatoire
Toujours utiliser :

`git hash-object --no-filters <fichier>`

### EOL / patch
Être prudent avec :
- LF / CRLF
- vieux snapshots
- patchs générés sur base obsolète
- chemins de fichiers exacts

### Répertoire patch
Quand un patch est produit :
- `patch/git/...` pour les patches git
- `patch/py/...` si un helper script est nécessaire

### Méthode attendue
1. lire le distant pour comprendre
2. demander les bons fichiers locaux
3. vérifier les hashes
4. patcher petit mais juste
5. ne pas élargir le scope sans le dire

---

## Mission du prochain agent refonte

Tu reprends le chantier **après abandon du launch ciblé**.

Ta mission :

1. repartir sur la roadmap utile
2. considérer le launch ciblé comme **hors scope**
3. simplifier / stabiliser le step Lancement autour du **pipeline complet**
4. poursuivre la convergence moteur Collection / Tabletop
5. continuer le travail sur cache / cumulatif / reporting
6. ne pas toucher aux prompts agents maintenant
7. ne pas défaire le triple agent tags maintenant

---

## Résumé ultra court

- le launch jusqu’à X est abandonné
- on revient à un **launch pipeline complet uniquement**
- on garde le step **Lancement**, mais simplifié
- la refonte utile continue :
  - moteur commun Collection / Tabletop
  - cumulatif append-only
  - cache-aware
  - reporting runtime lisible
- prompts et stratégie tags plus tard

