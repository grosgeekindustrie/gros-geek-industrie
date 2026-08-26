# Prompt de transfert — chantier COST / métrique coût fiable

## Rôle

Tu es mon agent refonte **senior**, rigoureux, sobre, fiable.

Tu interviens sur un chantier **ciblé** :
**fiabiliser complètement la métrique coût / tokens** dans le pipeline.

Tu ne réouvres **pas** le chantier `files_api`.
Tu ne touches **pas** aux prompts.
Tu ne touches **pas** au triple agent tags.
Tu ne relances **pas** une refonte large du moteur.

Tu fais un travail **strictement focalisé** sur :
- le calcul du coût,
- le cumul des coûts,
- la cohérence du reporting,
- la prise en compte correcte de tous les événements pertinents,
- la lisibilité runtime de cette métrique.

---

## Contexte projet

Le chantier `files_api` est considéré comme **clos**.
On ne cherche pas la petite bête sur cette partie.

Le vrai sujet restant est la **fiabilité de la métrique coût**.
Aujourd’hui, plusieurs signaux montrent que cette métrique n’est pas fiable :

- un coût apparaît au launch,
- ce coût semble correspondre au cache warm / warmup,
- quand l’agent `marche` se lance puis se termine, les coûts ne semblent pas se cumuler correctement,
- au moins un agent affiche un **coût négatif**, ce qui est un signal de calcul faux,
- le champ `détails et contexte` du formulaire peut lancer `iris`, et son coût doit pouvoir se cumuler avec le cache warm et le pipeline,
- la métrique coût doit devenir **fiable, précise et exploitable**.

Le besoin business est clair :
**on doit pouvoir mesurer avec confiance le coût réel d’une session**, en incluant les événements pertinents, sans écrasement, sans double soustraction, sans incohérence entre header, agents et rapport copiable.

---

## Diagnostic actuel à garder en tête

L’audit du code actuel fait ressortir au moins deux problèmes majeurs.

### 1. Bug de formule de coût
Dans `showAgentCost()`, le code lit :
- `input_tokens`
- `cache_read_input_tokens`
- `cache_creation_input_tokens`
- `output_tokens`

Puis il calcule un `normalIn` de type :

`input_tokens - cacheRead - cacheWrite`

Ce calcul est faux.

Le bon modèle Anthropic est :
- `input_tokens` = tokens d’entrée facturés au tarif normal,
- `cache_creation_input_tokens` = tokens facturés au tarif cache write,
- `cache_read_input_tokens` = tokens facturés au tarif cache read,
- `output_tokens` = tokens facturés au tarif output.

Donc il ne faut **pas** resoustraire les tokens cache à `input_tokens`.

Conséquence actuelle probable :
- coûts négatifs,
- coûts trop faibles,
- incohérences entre agents.

### 2. Bug de cumul / écrasement
Le système semble accumuler le coût session avec une logique du type :

`state.sessionCost += costCents`

Mais en parallèle, le détail agent est stocké sous une forme du type :

`state.agentUsage[agentId] = ...`

Donc si un même agent est rejoué ou si plusieurs événements liés au même agent / à la même session surviennent, le total session peut accumuler alors que le détail stocké est **écrasé**.

Conséquences probables :
- le header session et le rapport détaillé ne racontent pas la même histoire,
- warmup + pipeline + relance peuvent devenir incohérents,
- un même agent peut masquer un passage antérieur,
- `iris` peut mal cohabiter avec le reste si la structure n’est pas pensée comme un ledger d’événements.

### 3. Besoin de cumul transverse
La métrique session doit pouvoir inclure proprement :
- le coût du cache warm / warmup,
- le coût des agents pipeline,
- le coût éventuel d’`iris` lancé depuis le formulaire,
- d’éventuelles relances d’un même agent,
- sans écrasement,
- sans double comptage,
- avec un reporting fidèle.

---

## Mission exacte

Tu dois produire **un patch ciblé COST** qui rend la métrique coût :

- **correcte mathématiquement**, 
- **cumulative proprement**,
- **fidèle dans le header**,
- **fidèle dans les cartes agents**,
- **fidèle dans le rapport copiable**,
- **compatible avec warmup + pipeline + iris + relances**.

---

## Objectifs fonctionnels à atteindre

### A. Corriger la formule de coût
Le calcul doit être aligné avec les usages Anthropic :

- coût input normal = `input_tokens * rate_input`
- coût cache write = `cache_creation_input_tokens * rate_cache_write`
- coût cache read = `cache_read_input_tokens * rate_cache_read`
- coût output = `output_tokens * rate_output`

Puis total = somme de ces 4 composantes.

Aucun coût négatif ne doit pouvoir apparaître.

### B. Rendre le cumul session fiable
Le coût session ne doit plus dépendre d’un simple incrément fragile si, en parallèle, le détail est écrasé.

Le système doit devenir **idempotent et traçable**.

Deux approches sont acceptables si elles restent sobres :

#### Option 1 — Ledger d’événements
Chaque exécution produit une entrée indépendante.
Le total session est recalculé à partir de ce ledger.

#### Option 2 — Structure stable + recomputation
Le stockage par agent / événement est normalisé de manière à éviter l’écrasement dangereux, puis le total session est recalculé depuis cette structure.

Dans tous les cas :
- pas de dépendance fragile à `+=` seul,
- pas de divergence entre total session et détail,
- pas d’écrasement silencieux.

### C. Intégrer `iris` proprement
Le coût d’`iris` lancé depuis le formulaire doit :
- être pris en compte dans la métrique session,
- se cumuler avec le warmup éventuel,
- se cumuler avec le pipeline,
- apparaître proprement dans le reporting.

### D. Rendre le reporting cohérent partout
Les trois vues suivantes doivent raconter la même histoire :

1. **header / session summary**
2. **carte agent / affichage agent**
3. **rapport copiable / token report / cache report si concerné**

On doit éviter les écarts du type :
- total session qui monte mais détail qui n’en garde qu’une partie,
- agent affiché à un coût négatif,
- warmup visible d’un côté mais absent du rapport,
- `iris` compté quelque part mais pas ailleurs.

### E. Conserver la sobriété UX
Le but n’est pas d’ajouter une usine à gaz visuelle.

Tu peux améliorer la lisibilité du reporting si nécessaire, mais :
- pas de grosse refonte UI,
- pas de nouvelle feature parasite,
- pas d’enrichissement cosmétique hors sujet.

---

## Contraintes absolues

Tu ne fais **pas** :

- de refonte globale du runtime,
- de modification prompts,
- de retouche du chantier `files_api` hors stricte nécessité liée au coût,
- de refonte Collection / Tabletop,
- de micro-patches dispersés,
- de bench large sans objectif.

Tu fais **un patch ciblé métrique coût**.

---

## Fichiers probablement concernés

À auditer en priorité :

- `src/js/pipeline-api.js`
- `src/js/pipeline-ui.js`
- `src/etsy-pipeline-dnd-v1_2.html`

Éventuellement d’autres fichiers si et seulement si tu peux justifier un couplage réel lié au reporting coût ou au déclenchement `iris`.

---

## Ce que j’attends de toi avant patch

Avant de patcher, tu dois fournir un **diagnostic court et froid** :

1. Où se fait aujourd’hui le calcul exact du coût ?
2. Où se fait aujourd’hui le cumul session ?
3. Où le reporting lit ses données ?
4. Où `iris` injecte ou n’injecte pas sa contribution ?
5. Quelle structure minimale tu choisis pour rendre le tout fiable ?

Tu dois aussi demander les **fichiers locaux exacts** à patcher avec leurs hashes :

`git hash-object --no-filters <fichier>`

Tout ancien snapshot est caduc.
Les fichiers locaux fournis dans le chat seront la seule base patchable.

---

## Livrables attendus

### 1. Un patch Git unique
Nom recommandé :

`patch/git/cost_metrics_reliability.patch`

### 2. Une note de patch courte
Elle doit dire :
- ce qui était faux,
- ce qui a été corrigé,
- ce qui est désormais garanti,
- ce qui a été laissé hors scope volontairement.

### 3. Une checklist de validation ciblée
Max 8 à 10 cas.
Exemples attendus :

- launch avec warmup seul,
- warmup puis pipeline complet,
- exécution de `marche`,
- agent avec cache read,
- agent avec cache write,
- agent sans image,
- lancement `iris` depuis le formulaire,
- relance d’un même agent,
- vérification qu’aucun coût négatif n’apparaît,
- vérification que header / agent / rapport copiable concordent.

---

## Critères d’acceptation

Le patch est bon seulement si :

- aucun coût négatif ne peut apparaître,
- le calcul respecte les composantes Anthropic,
- le total session est fiable,
- `warmup + pipeline + iris` peuvent coexister dans une même session,
- le détail et le total racontent la même histoire,
- le patch reste ciblé,
- il n’ouvre pas un faux chantier adjacent.

---

## Rappel de posture

Tu te comportes comme un senior fiable.
Tu ne t’éparpilles pas.
Tu ne fais pas une demi-correction.
Tu fermes proprement la métrique coût.

Le but est simple :
**faire de la métrique coût un indicateur fiable, précis et cumulatif.**
