# Prompt de transfert — agent refonte (branche `refonte_step4`)

## Contexte

Tu reprends un chantier de refonte du pipeline sur la branche **`refonte_step4`**.

Le cap global a déjà été défini.  
Le projet pivote vers une architecture :

**mono + séquentielle + cumulative + append-only + cache-aware + target-step**

Le but n'est **pas** de refaire les prompts maintenant.  
Le but est de **stabiliser le moteur**, corriger les écarts visibles, et continuer proprement la refonte.

Important :
- le **batch n'est plus la priorité produit**
- les **prompts agents seront retravaillés plus tard**
- la logique **tags en triple sous-agent** n'est **pas** à défaire maintenant
- la priorité actuelle = **fixer ce qui est cassé / bancal**, puis poursuivre la refonte moteur

---

## Ce qui est déjà validé

### 1. Même moteur pour Collection et Tabletop
C'est une règle forte.

**Collection** et **Tabletop** doivent partager :
- le même moteur de pipeline
- la même logique cumulative
- la même logique cache
- la même logique target-step
- la même logique UI de lancement
- la même télémétrie runtime/cost/cache

Seuls peuvent différer :
- le **stepper**
- la **liste des agents**
- certaines **datas métier**
- certains **champs formulaire**

**Il ne faut pas recréer deux pipelines divergents.**

---

### 2. Ordre canonique visé
Ordre métier cible :

1. marche
2. titre
3. tags
4. description
5. alt

---

### 3. Step final "Lancement"
Le stepper doit finir sur un step **Lancement**.

Ce step doit permettre :
- de lancer le **pipeline complet**
- de lancer une **étape cible**
- de montrer clairement l'état du runtime

Sémantique validée :
- lancer `titre` = rejouer `marche -> titre`
- lancer `tags` = rejouer `marche -> titre -> tags`
- lancer `description` = rejouer `marche -> titre -> tags -> description`
- lancer `alt` = rejouer tout le pipe

En résumé :
**cliquer une étape = amener le pipeline jusqu'à cette étape cible**, pas lancer un agent isolé dans le vide.

---

### 4. Cumulatif append-only
Le pipeline doit construire un **dossier cumulatif**.

Chaque étape :
1. lit le cumul existant
2. exécute son rôle
3. ajoute son résultat à la fin
4. transmet le nouveau cumul enrichi à la suivante

On n'écrase pas les anciennes sections.  
On n'en réécrit pas le contenu entre les étapes.

---

## État observé sur `refonte_step4`

## Point positif majeur
La refonte commence à produire des effets réels :
- baisse du coût observé
- cache actif et visible
- step de lancement présent
- logique target-step déjà engagée
- comportement plus cohérent qu'avant

Le chantier a donc **avancé**.  
Il ne faut pas repartir de zéro.

---

## Point important sur le cache

Un rapport cache a été ajouté, ce qui est une très bonne chose.

Un exemple observé :

- `marche = write`
- `titre = hit`
- `description = hit`
- `analyse = write`

Cela montre que :
- le **shared prefix** commence à fonctionner
- le cache n'est plus théorique
- la refonte va dans le bon sens

Mais attention :
- le premier `hit` visible n'est pas encore une preuve absolue d'un **warmup réel implémenté**
- cela peut encore être influencé par un cache déjà présent dans la fenêtre TTL

Le système est aujourd'hui **warmup-compatible**, mais pas forcément encore **warmup-implémenté**.

---

## Point important sur les 529

Des erreurs console de type :

`POST https://api.anthropic.com/v1/messages 529`

ont été observées.

À ce stade :
- ce n'est **pas** un bug métier du pipeline
- c'est un **overload temporaire Anthropic**
- le front gère déjà un retry
- ce sujet ne doit pas détourner la refonte du vrai cap

Donc :
- **ne pas traiter le 529 comme un bug pipeline principal**
- **ne pas repartir dans un faux chantier là-dessus**
- si besoin, on améliorera plus tard le runtime/proxy, mais ce n'est pas la priorité immédiate

---

## Priorité fix immédiate

## Corriger l'instrumentation / naming runtime

Actuellement, il y a un problème de lisibilité / cohérence dans le reporting runtime.

### Problème constaté
L'étape **tags** est aujourd'hui composite :
- `explore`
- `filtre`
- `select`

Ce n'est pas un problème en soi.

Le vrai problème est :
- le reporting affiche des labels faux ou bancals
- certaines lignes remontent comme `titre` alors qu'on est dans un autre bloc
- le rapport runtime/cache n'est pas suffisamment fidèle à la réalité interne

### Ce qu'il faut faire maintenant
- **ne pas supprimer le triple agent tags**
- **ne pas refondre la stratégie tags maintenant**
- corriger **uniquement** la représentation runtime / reporting / labels

### Cible
À l'extérieur :
- une seule étape métier visible : **tags**

À l'intérieur :
- des sous-phases correctement traçables du type :
  - `tags.explore`
  - `tags.filtre`
  - `tags.select`

Objectif :
- rendre le rapport compréhensible
- rendre le runtime lisible
- préparer la future simplification tags sans casser l'architecture

En résumé :
**Tags peut rester composite, mais ne doit plus être opaque ni mal étiqueté.**

---

## Ce qu'il reste à faire après le fix

## 1. Finir la convergence Collection / Tabletop
Le plus gros écart structurel restant semble être :

- **Tabletop** termine sur un vrai `alt`
- **Collection** termine encore sur `analyse` avec un alias fonctionnel vers `alt`

Ce n'est pas la cible finale.

Il faut tendre vers :
- un vrai dernier maillon cohérent par mode
- un moteur partagé
- une symétrie runtime plus propre

---

## 2. Stabiliser complètement le step Lancement
Le step **Lancement** existe déjà / a commencé à être intégré.

Il faut encore fiabiliser :
- les bons états
- les bons labels
- le bon statut final
- l'affichage clair des sous-phases composites
- la lisibilité target-step

---

## 3. Raccorder tous les chemins au même modèle cache/cumulatif
Le cache commence à marcher, mais tous les chemins ne semblent pas encore passer par la même autoroute logique.

Objectif :
- shared prefix homogène
- cumulatif append-only homogène
- même logique de lecture / écriture cache sur tous les chemins importants

---

## 4. Warmup réel (pas forcément maintenant)
Le système doit rester **compatible** avec un futur modèle de warmup invisible.

Cap visé à terme :
- requête technique invisible de warmup
- premier agent visible qui peut hit le cache

Ce n'est pas forcément le prochain move immédiat, mais il faut éviter toute refonte qui rendrait ça sale ou difficile.

---

## 5. Batch : ne plus structurer le cœur produit
Le batch n'est plus la priorité produit.  
Il ne faut plus qu'il dicte les choix d'architecture du cœur pipeline.

On peut le laisser survivre temporairement si besoin, mais il ne doit plus contraindre le design principal.

---

## 6. Extraction de données déclaratives (plus tard)
Il y a encore de la donnée hardcodée :
- agents
- labels
- ordre
- échelles
- mediums
- etc.

C'est pertinent à sortir plus proprement plus tard, mais **pas au prix d'un brouillage du runtime actuel**.

---

## Ce qu'il ne faut pas faire

- ne pas repartir de zéro
- ne pas casser le cap target-step
- ne pas recréer deux moteurs différents Collection / Tabletop
- ne pas traiter le triple agent tags comme priorité à supprimer
- ne pas refaire les prompts maintenant
- ne pas dériver dans une énorme phase de bench
- ne pas "faire propre" en cassant les contrats runtime existants
- ne pas mélanger en un seul patch :
  - fix labels tags
  - convergence moteur complète
  - warmup réel
  - refonte prompts
  - externalisation totale des données

---

## Ordre de priorité conseillé

### Bloc 1 — Fix immédiat
- corriger le naming / reporting runtime
- rendre lisible la nature composite de l'étape tags
- fiabiliser les labels / statuts dans le rapport

### Bloc 2 — Recentrage moteur
- continuer la convergence Collection / Tabletop
- fiabiliser le step Lancement
- stabiliser les états finaux et les target-step

### Bloc 3 — Cache / cumulatif
- homogénéiser les chemins runtime
- garder l'architecture compatible avec un warmup invisible futur

### Bloc 4 — Nettoyage futur
- batch hors du cœur produit
- extraction déclarative
- refonte prompts
- simplification future de tags

---

## Rappel critique sur la discipline patch

Tu travailles sur un projet où la discipline patch est **obligatoire**.

### Règles de base
- Le **repo distant GitHub** sert à comprendre l'architecture, la transversalité et les impacts
- Les **fichiers locaux transmis dans le chat** seront la **seule source de vérité** pour produire un patch
- Tout ce qui précède un nouvel envoi de fichiers locaux devient potentiellement **caduc**
- Ne jamais patcher à partir d'un vieux snapshot

### Vérification des fichiers
Toujours comparer avec :

`git hash-object --no-filters <fichier>`

et **jamais** avec `git hash-object` simple.

### EOL
Le projet a déjà eu des problèmes de fins de ligne.  
Il faut être extrêmement prudent avec :
- LF / CRLF
- patches qui n'appliquent plus
- fichiers devenus caducs après commit

### Approche attendue
1. lire le distant pour comprendre
2. identifier les fichiers transverses à demander
3. travailler **uniquement** à partir des fichiers locaux réellement envoyés
4. générer un patch propre
5. faire vérifier l'applicabilité du patch

### Répertoire patch
Quand un patch est produit, il doit aller dans :
- `patch/git/...` pour les patches git
- éventuellement `patch/py/...` pour un helper script si besoin

### Ne surtout pas faire
- ne pas improviser un patch sur la base d'une ancienne version
- ne pas supposer qu'un fichier distant = vérité patchable
- ne pas reroll un patch en boucle sans vérifier la base exacte
- ne pas étendre le scope sans le dire

---

## Mission de cet agent

Tu reprends le chantier à partir de `refonte_step4`.

Ta mission immédiate :
1. corriger le **fix raté** sur l'instrumentation / reporting runtime
2. rendre l'étape **tags** lisible comme étape composite
3. conserver la direction générale de la refonte
4. ne pas toucher aux prompts agents pour l'instant
5. préparer la suite sans casser :
   - le moteur partagé
   - la logique target-step
   - le step Lancement
   - la compatibilité warmup

---

## Résumé ultra court

- le chantier avance
- le cache commence à marcher
- le coût baisse
- **le triple agent tags n'est pas à défaire maintenant**
- le fix immédiat = **instrumentation / labels / reporting**
- ensuite il faut continuer :
  - convergence Collection/Tabletop
  - fiabilisation du step Lancement
  - homogénéisation du modèle cache/cumulatif
