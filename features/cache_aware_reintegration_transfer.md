# Prompt de transfert — réintégration du vrai cache-aware pré-pipeline

## Rôle

Tu es mon agent refonte **senior**, rigoureux, sobre, fiable.  
Tu ne réécris pas le moteur.  
Tu ne touches ni aux prompts, ni au triple agent tags, ni à la logique métier des agents.  
Tu fais un **patch ciblé** pour **réintégrer le vrai cache-aware pré-pipeline** qui semble avoir sauté sur la branche `files_api`.

---

## Contexte validé

Le chantier `files_api` est considéré comme **clos**.  
Le chantier `cost` est désormais **globalement crédible** : le ledger coût/tokens colle enfin au débit réel Anthropic sur les tests récents.

Mais un trou structurel important est remonté :

### Le vrai cache-aware pré-pipeline ne semble plus présent

Constats observables sur la branche distante `files_api` :

- l’action `launch` part **directement** sur `startPipeline(activePrefix)` dans `pipeline-ui.js`
- le rapport cache indique `launchScope: 'pipeline complet'`
- la notion de “warmup” actuelle est seulement une **détection a posteriori** du premier `write` suivi du premier `hit`
- aucune trace visible d’une phase `cache-aware` dédiée avant le pipeline
- aucune occurrence visible de `cacheAware` dans `pipeline-api.js`

Autrement dit :

### Ce qui existe aujourd’hui
- premier agent pipeline écrit le cache
- agent(s) suivant(s) font hit
- le rapport appelle ça “warmup”

### Ce qui était visé
- utiliser **formulaire + données communes + Files API** pour **amorcer le cache avant le pipeline**
- faire en sorte que **le premier vrai agent pipeline** parte déjà en `hit`

Ce décalage est important car il peut :
- dégrader le bénéfice cache
- gonfler le coût du premier agent pipeline
- rendre trompeur le vocabulaire `warmup`
- masquer l’absence du vrai chantier cache-aware

---

## Preuves de l’état actuel

### Lancement direct du pipeline
Dans `pipeline-ui.js`, l’action `launch` appelle directement `startPipeline(activePrefix)`.

### Le rapport cache est toujours cadré en "pipeline complet"
Dans `pipeline-api.js`, le `runRecord` est créé avec :
- `launchScope: 'pipeline complet'`

### Le "warmup" actuel est seulement dérivé des événements cache
Dans `pipeline-api.js`, `getCacheWarmupDetails(events)` :
- cherche le premier événement `write`
- puis le premier événement `hit`
- et déduit `enabled = Boolean(firstWriteOrder && firstHitOrder)`

Donc aujourd’hui :
- **warmup != priming pré-pipeline**
- **warmup = premier write interne au pipeline suivi d’un premier hit**

---

## Mission exacte

Produire un patch ciblé qui **réintroduit le vrai cache-aware avant le pipeline**, sans rouvrir le chantier Files API et sans casser la mesure coût/tokens qui vient d’être remise sur les rails.

---

## Objectif fonctionnel

Quand l’utilisateur lance le pipeline :

1. la logique prépare un **appel cache-aware pré-pipeline**
2. cet appel utilise :
   - les **données formulaire**
   - la **data commune stable**
   - les éléments utiles de contexte
   - les **images via Files API** si cela fait partie du préfixe stable visé
3. cet appel écrit le cache **avant** le premier agent pipeline
4. ensuite le pipeline standard démarre
5. le **premier agent pipeline** doit idéalement partir déjà avec un `hit`
6. le reporting doit distinguer clairement :
   - **cache-aware pré-pipeline**
   - **pipeline standard**
   - **warmup intra-pipeline éventuel** s’il existe encore
   - **Iris**
   - **orchestrateur**
   - **social** le cas échéant

---

## Règle de conception

Tu ne fais pas un bricolage "cosmétique".

Tu dois restaurer une vraie logique de **priming cache-aware**.

### Important
Le social, Iris et le pipeline standard pourront rester des périmètres séparés.  
Mais le **cache-aware pré-pipeline** doit redevenir un **événement économique et runtime identifiable**.

---

## Ce qu’il faut préserver

- le ledger coût/tokens actuel, qui redevient crédible
- la prise en compte de Iris
- la prise en compte de l’orchestrateur seulement s’il est réellement exécuté
- le reporting coût détaillé
- le reporting cache détaillé
- la logique Files API actuelle
- la persistance images / `anthropicFileId` / `contentHash`

---

## Ce qu’il faut corriger

### 1. Réintroduire une vraie phase cache-aware avant `startPipeline`
Le launch ne doit plus être uniquement :

- `launch -> startPipeline(activePrefix)`

Il faut une phase intermédiaire explicite du type :

- préparer le priming cache-aware
- exécuter ce priming
- ensuite seulement lancer le pipeline

### 2. Définir clairement le périmètre du priming
Le priming doit être construit à partir de ce qui est **stable et partagé** entre les agents du pipeline :

- données formulaire stables
- data commune
- contexte commun
- blocs prompt stables
- Files API / images si utile pour le préfixe partagé

Tu dois être sobre :
- pas de duplication géante inutile
- pas de réécriture moteur
- pas de désynchronisation avec le vrai préfixe utilisé par les agents

### 3. Corriger le vocabulaire runtime / reporting
Le mot `warmup` est actuellement trompeur.

Le reporting doit distinguer proprement :
- **cache-aware pré-pipeline**
- **premier write intra-pipeline**
- **premier hit intra-pipeline**
- **pipeline standard**

But :
- éviter de faire croire qu’un vrai cache priming existe quand il n’existe pas
- rendre lisible ce qui coûte quoi

### 4. Intégrer correctement les coûts
Le cache-aware pré-pipeline doit :
- apparaître dans le ledger coût
- apparaître dans le rapport copiable
- être agrégé dans une rubrique dédiée
- ne pas se mélanger de manière ambiguë avec le pipeline standard

Le but est de pouvoir répondre à des questions comme :
- combien coûte le cache-aware ?
- combien coûte le pipeline hors cache-aware ?
- combien le premier hit fait gagner ensuite ?

### 5. Vérifier l’impact attendu
Après patch, en run réel :

- le premier agent pipeline ne doit plus être celui qui écrit le cache si le cache-aware a bien tourné
- il doit idéalement être `hit`
- le rapport cache doit le montrer clairement
- le rapport coût doit isoler le priming

---

## Contraintes absolues

Tu ne fais pas :

- de refonte moteur générale
- de nouveau chantier Files API
- de retouche prompts agents
- de simplification/destruction du triple tags
- de patch dispersé sans stratégie
- de changement business hors sujet

Tu fais un patch **strictement centré** sur :
- réintégration du cache-aware
- cohérence runtime
- cohérence coût/reporting
- lisibilité du diagnostic

---

## Fichiers probablement concernés

À auditer en priorité :

- `src/js/pipeline-ui.js`
- `src/js/pipeline-api.js`

Et seulement les autres fichiers si un couplage réel l’impose.

---

## Livrables attendus

### 1. Diagnostic court avant patch
Tu dois expliquer clairement :

- ce qui confirme que le cache-aware pré-pipeline n’est plus actif
- où tu vas le réinsérer
- pourquoi ce n’est pas juste un renommage de `warmup`

### 2. Un seul patch Git
Nom conseillé :
`patch/git/reintroduce_cache_aware_prelaunch.patch`

### 3. Note de validation
Avec :
- périmètre exact
- fichiers modifiés
- logique ajoutée
- éléments volontairement laissés hors scope

### 4. Mini checklist de test
Ciblée, concrète, courte :

- lancement sans Iris
- lancement avec Iris séparé
- rapport coût copiable
- rapport cache copiable
- premier agent pipeline en `hit`
- cache-aware bien visible comme événement séparé
- orchestrateur OFF bien à zéro
- coût total cohérent avec le solde Anthropic

---

## Critères d’acceptation

Le patch est bon seulement si :

- le cache-aware pré-pipeline existe réellement
- le premier vrai agent pipeline ne sert plus d’amorce cache par défaut
- le reporting distingue cache-aware et pipeline
- la mesure coût reste crédible
- le scope reste strict
- on ne rouvre pas `files_api`
- on ne casse pas `cost`

---

## Résumé ultra court

Le problème n’est pas le mot `warmup`.

Le problème est que le **vrai cache-aware pré-pipeline semble avoir disparu**.

Ta mission est de :
- le réintégrer proprement
- le rendre visible dans le runtime
- l’isoler dans le reporting coût/cache
- faire en sorte que le **premier agent pipeline profite déjà du hit**
