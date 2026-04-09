# Roadmap v2 — refonte pipeline mono cumulatif avec cache Anthropic

## Statut de cette roadmap

Cette version remplace la version précédente comme **base de travail actuelle**.

Elle conserve les décisions déjà validées, mais intègre désormais 3 contraintes supplémentaires majeures :

1. **Collection** et **Tabletop** doivent fonctionner de la même manière de bout en bout
2. le stepper doit intégrer un **step final "Lancement"**
3. le lancement d'un agent ne signifie pas "run isolé", mais **"amener le pipeline jusqu'à cette étape cible"**

---

## Contexte

Le projet **n'est plus orienté batch**.

Le batch sort officiellement de la roadmap produit.

Le besoin réel actuel est un **workflow mono**, utilisé fiche par fiche, avec un objectif simple :

**générer une fiche Etsy solide puis, à terme, une variante eBay, avec un coût maîtrisé et une fiabilité élevée.**

Le pipeline actuel a montré plusieurs limites :
- mauvaise qualité sur certaines lectures visuelles
- agents trop pauvres en contexte en amont
- ordre d'exécution peu adapté
- coût API qui peut dépasser la valeur réelle produite
- architecture trop pensée pour le batch alors que l'usage réel redevient mono
- divergences potentielles entre Collection et Tabletop
- pilotage des agents encore trop dispersé dans l'UI

Le nouvel objectif n'est donc pas de sauver le pipeline actuel tel quel, mais de **repartir sur une architecture plus réaliste, plus rentable, et alignée avec l'usage mono**.

---

## Décisions produit et architecture déjà validées

### 1. Le batch est abandonné
Le batch ne fait plus partie de la roadmap produit actuelle.

### 2. Retour à une logique séquentielle cumulative
Ordre cible validé :

1. Analyse de marché
2. Titre
3. Tags
4. Description
5. ALT

### 3. Chaque agent reçoit tout le cumul précédent
Le pipeline cible repose sur un **dossier cumulatif append-only** :
- les données du formulaire sont injectées dès le départ
- chaque sortie agent est ajoutée au cumul
- l'agent suivant reçoit tout ce cumul enrichi
- on n'écrase pas les anciennes sections
- on n'en réécrit pas le contenu entre étapes

### 4. Les agents doivent reprendre les éléments utiles des étapes précédentes
Logique métier attendue :
- les **tags** doivent pouvoir reprendre des mots-clés utiles du **titre**
- la **description** doit pouvoir reprendre des mots-clés utiles des **tags** et du **titre**
- la **balise ALT** arrive en dernier et s'appuie sur tout le reste
- l'ALT peut être moyenne si nécessaire, car elle ne pollue plus les autres agents en amont

### 5. L'analyse image ne doit plus être la première sortie sensible
L'erreur perçue du pipeline actuel n'est pas seulement dans la qualité visuelle, mais aussi dans le fait d'avoir trop tôt demandé à des briques sensibles de travailler avec trop peu de contexte.

### 6. Le cache Anthropic devient une brique centrale du design
Le cache doit être exploité consciemment dans un workflow mono court.

L'idée validée :
- la première grosse requête arme le cache
- les suivantes profitent du cache
- à chaque étape, le cumul s'agrandit
- le cache doit suivre cette croissance

### 7. Files API reste une piste sérieuse
Important :
- ce n'est **pas** une nouvelle clé API
- c'est une autre API / un autre endpoint dans le même univers Anthropic
- la clé API reste la même
- l'intérêt principal est la réutilisation propre des assets via `file_id`

---

## Nouvelle contrainte structurante n°1

## Collection et Tabletop doivent partager le même moteur

C'est désormais une règle d'architecture forte.

### Ce qui doit être commun
- le moteur d'exécution du pipeline
- la logique cumulative append-only
- le modèle de lancement
- la gestion du cache
- la télémétrie coûts / tokens / cache
- le contrat d'output final
- la logique d'état UI globale
- la structure des configurations
- la gestion des fichiers / images
- la stratégie de relance jusqu'à une étape cible

### Ce qui peut différer
- le **stepper**
- la **déclaration des agents**
- certaines données métier propres au mode
- certains champs de formulaire propres au mode
- certaines bibliothèques / prompts propres au mode

### Conséquence
Il ne faut **pas** créer deux pipelines parallèles.
Il faut créer :

**un core partagé**
+  
**des variantes déclaratives par mode**

---

## Nouvelle contrainte structurante n°2

## Ajouter un step final "Lancement"

Le stepper ne doit plus s'arrêter à la collecte de données.

Il doit intégrer un dernier step :
**Lancement**

### Rôle de ce step
Ce step n'est pas décoratif.
Il devient un **poste de commande du pipeline**.

Il doit permettre :
- de lancer le **pipeline complet**
- de lancer une **étape cible**
- de voir les **prérequis**
- de voir les **états**
- de voir les **informations de coût / cache** utiles au pilotage

### Ordre cible côté stepper
Exemple de principe :

- Images
- Identité
- Échelles
- Détails / contexte
- **Lancement**

Le nom exact des steps peut différer légèrement selon Collection et Tabletop, mais la logique finale doit être la même :
**un step final de pilotage**

---

## Nouvelle contrainte structurante n°3

## Lancer un agent = amener le pipeline jusqu'à l'étape cible

C'est désormais la sémantique d'exécution attendue.

### Règle UX / exécution
Le clic sur un agent ne signifie pas :
- "exécuter cet agent seul dans le vide"

Il signifie :
- **"rejouer le pipeline depuis le début utile jusqu'à cette étape, puis s'arrêter là"**

### Exemples
- **Lancer Marché** → exécute **Marché**
- **Lancer Titre** → exécute **Marché → Titre**
- **Lancer Tags** → exécute **Marché → Titre → Tags**
- **Lancer Description** → exécute **Marché → Titre → Tags → Description**
- **Lancer ALT** → exécute **Marché → Titre → Tags → Description → ALT**

### Conséquence
**Lancer ALT revient donc à lancer tout le pipeline.**

### Politique de rerun retenue
Version retenue pour la phase de refonte :
- on **rejoue l'amont nécessaire**
- on **reconstruit la chaîne**
- on **s'arrête exactement à l'étape demandée**

Cette règle est plus simple, plus fiable et plus cohérente avec un pipeline cumulatif.

Plus tard, une logique "réutiliser l'amont existant" pourra éventuellement être discutée, mais ce n'est pas la priorité actuelle.

---

## Principe général d'architecture cible

Le pipeline devient :

**mono + séquentiel + cumulatif + append-only + cache-aware + target-step driven**

### Dossier cumulatif cible
Le pipeline doit construire un dossier cumulatif structuré du type :

- Données formulaire
- Images / fichiers
- Contexte produit / source éventuelle
- Analyse de marché
- Titre
- Tags
- Description
- ALT

Chaque étape :
1. lit le cumul existant
2. exécute son rôle
3. ajoute son résultat à la fin
4. transmet un nouveau cumul enrichi à l'étape suivante

---

## Point critique sur le cache

Le prochain agent doit partir de cette hypothèse de travail :

- le cache ne sert pas sur la première requête
- la première requête sert à **écrire** le cache
- la première vraie réutilisation arrive sur la requête suivante
- donc la première requête utile doit être suffisamment riche / lourde pour justifier l'écriture du cache

Conséquence directe :
- **les données du formulaire doivent être présentes dès la première requête**
- l'**analyse de marché** est pressentie comme la première requête qui arme le cache
- le **titre** devient alors le premier agent à réellement profiter du cache

---

## Point critique sur les prompts agents

Le prochain agent doit bien séparer :

### A. Le préfixe commun cacheable
Contient uniquement :
- les règles communes stables
- les données du formulaire
- les images / fichiers
- le contexte produit
- les sorties cumulées précédentes

### B. La consigne spécifique de l'agent courant
Par exemple :
- générer le titre
- générer les tags
- générer la description
- générer la balise ALT

Cette partie ne doit pas polluer inutilement le préfixe commun.

Objectif :
- éviter que les prompts spécifiques de chaque agent dégradent la réutilisation du cache
- garder un socle commun stable entre les étapes

---

## Scope actuel de la refonte

Très important :

### Ce chantier porte sur :
- la **restructuration du pipeline**
- l'ordre des étapes
- la logique cumulative
- le moteur commun Collection / Tabletop
- le stepper
- le step de lancement
- la logique target-step
- le cache / debug cache
- l'instrumentation coût
- la structure de configuration / données

### Ce chantier ne porte pas encore sur :
- la refonte fine des **prompts agents**
- l'optimisation rédactionnelle détaillée agent par agent
- les réglages sémantiques précis des prompts

Les prompts viendront **après**.

---

## Données / config : direction validée

La refonte doit aussi profiter du chantier pour **sortir de la donnée du code** quand c'est pertinent.

Candidats évidents :
- échelles
- mediums
- listes / ordre / labels d'agents
- certaines options formulaire
- certaines constantes d'UI

Objectif :
- rendre le système plus déclaratif
- éviter les hardcodes dispersés
- faciliter l'alignement Collection / Tabletop

Le format exact reste à choisir :
- JSON si le runtime serveur le permet proprement
- ou modules JS déclaratifs si c'est plus simple / plus sûr à court terme

---

## Vision produit validée

Le pipeline n'est plus pensé comme :
- un orchestrateur batch
- un gros prototype multi-agent abstrait
- une usine à gaz conçue pour plus tard

Il est désormais pensé comme :

**une chaîne mono rentable par fiche**

Objectif court terme :
- générer une fiche Etsy solide
- avec coût maîtrisé
- avec bon niveau de fiabilité
- sans devoir relancer plusieurs fois des blocs coûteux

Objectif moyen terme :
- dériver une version eBay à partir du même socle produit

---

## Contraintes business à respecter

### 1. Le coût doit redevenir viable
Le pipeline actuel fait perdre de l'argent s'il dérive trop souvent.

Le budget cible évoqué est :
- environ **0,30 € maximum par fiche**
- seulement si la fiabilité devient réellement élevée

### 2. Pas de bullshit technique
Le prochain agent ne doit pas relancer :
- une énorme phase de bench
- une refonte théorique sans ROI
- un nouveau grand projet abstrait
- une architecture pensée pour le batch
- deux pipelines distincts Collection / Tabletop

### 3. Le temps de dev doit être justifié
Tout effort doit être orienté vers :
- le gain réel
- la stabilité
- la fiabilité
- la lisibilité du coût

---

## UI / instrumentation à ajouter

### 1. Ajouter un debug cache dans l'UI
Minimum souhaité :
- indicateur visible type point / badge
- statut lisible du cache

Version conseillée :
- `cache miss`
- `cache write`
- `cache hit`

Le debug cache doit aider à comprendre :
- si le cache s'est bien armé
- si l'étape suivante a réellement hit
- si le cumul continue à bénéficier du cache

### 2. Ajouter un vrai panneau de lancement
Le step "Lancement" doit afficher au minimum :
- bouton pipeline complet
- liste des étapes cibles lançables
- statut de l'étape courante
- étape cible choisie
- éventuellement coût / dernier coût
- éventuellement statut cache du dernier appel

### 3. Logs / métriques souhaités
À terme, il serait pertinent de logger au moins :
- mode courant (Collection / Tabletop)
- étape cible demandée
- étape courante réellement exécutée
- modèle utilisé
- cache status
- tokens input
- tokens cache read
- tokens cache write
- coût estimé par étape
- coût total par fiche

---

## Phases de travail recommandées

## Phase 1 — Cadrage du core partagé
Objectif :
- définir le **socle commun** Collection / Tabletop
- séparer le moteur commun des spécificités mode
- définir le contrat commun de pipeline

Livrables attendus :
- schéma core partagé / adaptateurs mode
- contrat d'entrée / sortie commun
- structure de config commune

## Phase 2 — Modèle d'exécution target-step
Objectif :
- formaliser la logique :
  "cliquer une étape = amener le pipeline jusqu'à cette étape"

Livrables attendus :
- ordre canonique des étapes
- règle de rerun amont
- comportement ALT = full pipe
- mapping UI → target step → agents réellement joués

## Phase 3 — Dossier cumulatif + cache
Objectif :
- valider le design mono séquentiel cumulatif
- définir le format exact du dossier cumulatif
- définir ce qui est append-only
- définir ce qui est stable / cacheable
- définir ce qui est spécifique à chaque agent

Livrables attendus :
- schéma de pipeline
- structure du cumul
- responsabilités par agent

## Phase 4 — UI / stepper / lancement
Objectif :
- ajouter le step final "Lancement"
- harmoniser Collection et Tabletop dans la logique de pilotage
- exposer clairement le modèle target-step

Livrables attendus :
- nouveau stepper
- panneau de lancement
- statut lisible des étapes
- base du debug cache visible

## Phase 5 — Instrumentation coût / cache
Objectif :
- brancher un vrai suivi de cache
- visualiser hit / miss / write
- mesurer la taille réelle des requêtes
- éviter le pilotage à l'aveugle

Livrables attendus :
- debug UI cache
- remontées de métriques minimales
- méthode simple de lecture du coût réel

## Phase 6 — Extraction des données déclaratives
Objectif :
- sortir les hardcodes évidents du code
- préparer un socle plus propre pour Collection / Tabletop

Livrables attendus :
- échelles externalisées
- mediums externalisés
- agents / labels / ordre externalisés
- stratégie choisie pour JSON ou modules déclaratifs

## Phase 7 — Intégration Files API
Objectif :
- éviter de retraiter / réuploader inutilement les images
- rendre le flux image plus propre

Livrables attendus :
- upload fichiers
- stockage `file_id`
- réutilisation dans les requêtes suivantes

## Phase 8 — Test métier court
Objectif :
- tester sur un petit panel seulement
- mesurer coût réel
- mesurer stabilité
- mesurer qualité

Panel conseillé :
- quelques fiches simples
- quelques fiches plus complexes visuellement
- quelques fiches connues pour avoir posé problème

---

## Ce qu'il ne faut pas faire

Le prochain agent ne doit pas :
- repartir sur une logique batch
- proposer une usine à gaz
- multiplier les appels image sans justification
- réécrire le cumul entre chaque agent
- supposer que la première requête profite déjà du cache
- polluer le préfixe commun avec des consignes agents inutiles
- dupliquer la logique pipeline entre Collection et Tabletop
- concevoir un step "Lancement" purement décoratif
- vendre une phase de bench massive et coûteuse sans preuve de ROI

---

## Hypothèses importantes à vérifier techniquement

Le prochain agent devra vérifier précisément, sans improviser :

1. le seuil réel minimal de tokens pour que le cache soit activé sur le modèle utilisé
2. si le socle `data + images + analyse marché` suffit à atteindre ce seuil
3. la meilleure manière de structurer le préfixe cacheable
4. comment intégrer proprement Files API au flux existant
5. comment afficher le statut réel du cache dans l'UI
6. comment compter ou estimer proprement le coût par agent et par fiche
7. comment structurer proprement le moteur commun Collection / Tabletop
8. comment brancher le step "Lancement" sans casser les flows existants
9. si JSON est faisable proprement côté runtime actuel ou si un module déclaratif JS est préférable

---

## Critères de validation de la refonte

La refonte sera considérée comme allant dans le bon sens si :

- le workflow mono est plus simple à comprendre
- Collection et Tabletop partagent réellement le même moteur
- le cache devient observable dans l'UI
- les étapes suivantes hit réellement le cache
- les agents lisent bien le cumul enrichi
- les descriptions sont plus cohérentes
- l'ALT n'empoisonne plus le reste
- le step "Lancement" clarifie vraiment le pilotage
- le coût par fiche devient mesurable et acceptable
- le système est plus rentable que le pipeline actuel

---

## Mission du prochain agent

Le prochain agent ne doit pas repartir de zéro.

Sa mission est :

1. prendre cette roadmap v2 comme base validée
2. transformer cela en plan d'implémentation concret
3. découper le chantier en blocs réalistes
4. identifier les fichiers probablement concernés
5. préciser l'ordre d'exécution du chantier
6. proposer une instrumentation simple et utile
7. rester strictement dans une logique :
   **mono + cumulatif + cache-aware + core partagé + target-step**

---

## Résumé ultra court

Le projet pivote vers :

**workflow mono**
→ **ordre séquentiel fixe**
→ **cumul append-only**
→ **cache Anthropic exploité consciemment**
→ **core partagé Collection / Tabletop**
→ **step final Lancement**
→ **lancement par étape cible**
→ **debug cache visible**
→ **coût traçable**
→ **objectif Etsy d'abord, eBay ensuite**
