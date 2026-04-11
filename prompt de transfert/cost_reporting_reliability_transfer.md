# Prompt de transfert — chantier coût / reporting fiable / traçabilité réelle

## Rôle

Tu es mon agent refonte **senior**, rigoureux, sobre, fiable.
Tu ne rouvres pas le chantier `files_api`.
Tu ouvres un **chantier ciblé métrique coût / tokens / reporting**.

Ton objectif n’est pas de “faire joli”.
Ton objectif est de rendre la **mesure de coût réellement fiable, lisible et vérifiable**.

Aujourd’hui, sans rapport exploitable, on tourne en rond.
Le bouton de rapport coût ne fonctionne plus correctement, la métrique semble encore imparfaite, et on doit pouvoir distinguer ce qui coûte réellement cher.

---

## Contexte actuel

Le chantier `files_api` est considéré comme **clos**.
On ne repart pas en refonte large.

Un chantier coût a déjà été fait récemment.
Il a **corrigé des choses réelles** :
- fin des coûts négatifs absurdes ;
- formule de coût global visiblement plus crédible qu’avant ;
- session cost plus proche du réel qu’auparavant.

Mais il reste un problème important :
- le **rapport de coût copiable** ne fonctionne plus correctement ;
- il manque encore de la **traçabilité fiable** pour comprendre ce qui compose vraiment le coût ;
- on doit pouvoir voir **coût + tokens** de manière claire ;
- on doit vérifier que **l’orchestrateur OFF est réellement à zéro** ;
- on doit faire entrer dans la métrique **Iris** et le **warmup** ;
- sans ça, impossible de comparer proprement l’app avec le solde Anthropic.

---

## Ce qu’on sait déjà

Test réel effectué :
- solde Anthropic avant : **4.31 $**
- solde Anthropic après : **4.13 $**
- dépense réelle observée : **18.00¢**
- coût affiché UI : **20.91¢**

Conclusion actuelle :
- l’ancien système sous-comptait probablement ;
- le nouveau système semble **plus proche du réel**, mais **surcompte encore** ;
- l’écart reste significatif ;
- sans rapport détaillé fonctionnel, on ne peut pas isoler la cause.

Ce chantier doit donc fermer la boucle :
**mesure détaillée -> rapport lisible -> comparaison réel / affiché -> confiance**.

---

## Mission

Tu dois produire **un seul patch ciblé** pour rendre la métrique coût/tokens réellement exploitable.

### Ce patch doit couvrir 4 objectifs :

1. **Réparer le rapport coût copiable**
2. **L’enrichir avec les tokens et les événements économiques utiles**
3. **Vérifier et corriger le périmètre de comptage**
4. **Rendre le total session traçable et auditable**

---

## Objectif 1 — Réparer le rapport copiable

Le bouton de rapport coût doit redevenir utile.

On veut pouvoir copier un rapport clair qui permette de répondre à des questions simples :
- combien a coûté la session ?
- quel agent a coûté combien ?
- combien de tokens input / output / cache read / cache write ?
- est-ce que l’orchestrateur a réellement coûté quelque chose ?
- est-ce que warmup et Iris sont inclus ?
- est-ce que le total correspond à la somme détaillée ?

Le rapport doit donc être **fonctionnel, stable, lisible, et exploitable par un humain**.

---

## Objectif 2 — Enrichir le rapport avec coût + tokens

Le rapport doit inclure au minimum, pour chaque entrée économique comptée :

- nom logique de l’événement / agent
- type d’événement
  - pipeline agent
  - orchestrateur
  - iris
  - warmup
  - autre si justifié
- modèle utilisé
- coût en cents
- `input_tokens`
- `cache_creation_input_tokens`
- `cache_read_input_tokens`
- `output_tokens`
- total tokens utiles affichés de manière lisible
- préfixe / contexte si pertinent pour distinguer collection / tabletop
- timestamp ou ordre d’exécution si ça aide à l’audit

Le total session doit être :
- visible en haut
- égal à la somme des lignes détaillées
- vérifiable sans ambiguïté

On veut aussi un petit résumé agrégé du type :
- total session
- total pipeline
- total iris
- total warmup
- total orchestrateur
- top 3 des postes les plus coûteux

Le but est de répondre rapidement à :
**qui coûte quoi ?**

---

## Objectif 3 — Vérifier et corriger le périmètre de comptage

Le patch doit contrôler les points suivants.

### A. Orchestrateur

L’orchestrateur est censé être **OFF** dans le cas actuel.
Il faut vérifier :
- s’il s’exécute encore malgré le OFF ;
- s’il est compté alors qu’il ne devrait pas ;
- si OFF signifie réellement **zéro exécution** et donc **zéro coût**.

Résultat attendu :
- si orchestrateur OFF -> aucune entrée coût réelle ;
- s’il y a une entrée, elle doit être justifiée ;
- pas de faux comptage fantôme.

### B. Iris

Iris est **hors pipe**, mais doit rentrer dans la métrique session.
Il faut vérifier :
- que son appel crée bien une entrée coût ;
- qu’il apparaît dans le rapport ;
- que son coût se cumule proprement avec la session.

### C. Warmup

Le warmup doit être compté lui aussi.
Il faut trancher proprement son statut :
- soit comme événement économique autonome ;
- soit comme partie d’un autre événement, mais alors il faut qu’il soit identifiable.

Le besoin métier ici est clair :
on veut pouvoir savoir **ce que coûte le warmup**.
Donc si le design actuel le noie dans un autre poste, il faut améliorer ça.

### D. Pipeline standard

Vérifier que tous les agents réellement lancés :
- créent une entrée coût correcte ;
- se cumulent correctement ;
- ne sont ni oubliés ni doublés.

---

## Objectif 4 — Rendre le total session réellement auditable

Aujourd’hui, on a eu un cas où l’UI affichait **20.91¢** alors que le delta réel Anthropic semblait plutôt autour de **18¢**.

Le patch doit permettre de comprendre ce genre d’écart.

Le résultat attendu n’est pas forcément une précision comptable absolue au milli-cent près.
Mais il faut au minimum :
- supprimer les surcomptages évidents ;
- éviter tout doublon de ledger ;
- éviter les entrées fantômes ;
- garantir que le total affiché correspond aux entrées réelles du système.

En clair :
le coût session doit devenir **explicable**.

---

## Contraintes absolues

Tu ne fais pas :
- de refonte large du moteur ;
- de retour sur `files_api` ;
- de refonte prompts ;
- de chantier UI secondaire hors besoin du rapport ;
- de bench large inutile ;
- de patchs dispersés sans cap.

Tu fais un **patch ciblé métrique / reporting / traçabilité**.

---

## Fichiers probablement concernés

À auditer en priorité, sans élargir inutilement :

- `src/js/pipeline-api.js`
- `src/js/pipeline-ui.js`
- `src/etsy-pipeline-dnd-v1_2.html`

Et uniquement d’autres fichiers si tu peux justifier un couplage réel.

---

## Ce que tu dois produire

### 1. Diagnostic court avant patch

Tu dois commencer par dire clairement :
- ce qui est déjà bon ;
- ce qui surcompte encore ;
- ce qui n’est pas compté ;
- pourquoi le rapport actuel n’est plus exploitable.

### 2. Un seul patch Git

Nom clair, par exemple :
`patch/git/cost_reporting_reliability.patch`

### 3. Note de validation

À fournir avec le patch :
- périmètre exact ;
- fichiers modifiés ;
- logique retenue pour warmup / iris / orchestrateur ;
- ce qui reste volontairement hors scope.

### 4. Checklist de test ciblée

Max 8 à 10 cas, par exemple :
- pipeline simple sans Iris ;
- pipeline avec Iris ;
- orchestrateur OFF ;
- orchestrateur ON ;
- warmup présent ;
- warmup absent / cache hit direct ;
- rapport copié ;
- total session = somme des lignes ;
- comparaison rapide avec le delta crédit Anthropic.

---

## Critères d’acceptation

Le patch est bon seulement si :

- le rapport coût est de nouveau utilisable ;
- coût + tokens sont lisibles par entrée ;
- Iris est compté correctement ;
- warmup est identifiable dans la métrique ;
- orchestrateur OFF = zéro coût réel ;
- le total session est traçable et cohérent ;
- le patch reste strictement dans le scope.

---

## Rappel de posture

Tu es un senior fiable.
Tu ne brodes pas.
Tu ne fais pas de cosmétique.
Tu répares la **mesure**.

Le but business est simple :
**avoir enfin une métrique coût/tokens fiable pour savoir ce qui consomme vraiment le plus.**
