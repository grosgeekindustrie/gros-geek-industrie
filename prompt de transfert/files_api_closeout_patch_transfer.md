# Prompt de transfert — patch unique de clôture Files API

## Rôle

Tu es mon agent refonte **senior**, rigoureux, sobre, fiable.  
Tu n’improvises pas.  
Tu ne réécris pas le moteur.  
Tu fais **un seul patch cohérent** pour fermer **les deux feedbacks restants** autour du chantier `files_api`.

Tu dois respecter strictement le cadre de supervision déjà défini : pas de dérive de scope, pas de faux chantier, pas de retouche prompts/tags, pas de micro-patches dispersés.

---

## Source de vérité

- Le **repo distant `files_api`** sert uniquement à comprendre l’état actuel et les couplages.
- Les **fichiers locaux fournis dans le chat** seront la **seule base patchable**.
- Tout ancien snapshot est **caduc et obsolète**.
- Avant tout patch, exiger les hashes locaux avec :
  `git hash-object --no-filters <fichier>`

---

## Mission unique

Produire **un seul patch Git** qui clôture à la fois :

### Feedback A — Fiabilité finale Files API
Fermer proprement les 4 sujets suivants :

1. **Invalidation réelle des images**
2. **Fallback propre en cas d’erreur réseau / upload**
3. **Garantie que seuls les bons agents paient le coût image**
4. **Persistance workspace de bout en bout**

### Feedback B — Hygiène de branche / dépôt
Nettoyer les artefacts et incohérences de dépôt liés au chantier Files API.

---

## Constat actuel à partir de la branche

Le code actuel montre déjà plusieurs briques utiles, qu’il faut **conserver** et **durcir sans réécriture** :

- invalidation si `anthropicContentHash !== contentHash` ;
- mutation des métadonnées image après upload valide puis persistance via `saveWorkspaceImages` ;
- reset de `contentHash`, `anthropicFileId`, `anthropicContentHash`, `anthropicUploadedAt` après crop ;
- restauration `restoreWorkspaceImages('tt')` et `restoreWorkspaceImages('col')` au démarrage ;
- statut `error` remonté dans le chemin d’échec upload ;
- beta Files API séparée du beta prompt caching.

La branche suit aussi encore des artefacts racine qui ne doivent pas vivre dans le dépôt produit :
- `.anthropic_files_cache.json`
- `FETCH_HEAD`
- `server.py.bak_20260331_015751`

Et `.gitignore` contient `*.py` tout en ne contenant pas `.anthropic_files_cache.json`, ce qui est incohérent pour ce repo.

---

## Ce que tu dois faire exactement

## Bloc 1 — Fermer vraiment la fiabilité Files API

Tu ne repars pas de zéro.  
Tu audites le code actuel et tu fais **uniquement les renforcements manquants**.

### 1. Invalidation image
Vérifier et compléter si nécessaire :

- remplacement image ;
- crop / recrop ;
- réordonnancement ;
- suppression / duplication ;
- changement de variante ;
- reprocessing éventuel.

Objectif :

- aucune image ne doit conserver un `anthropicFileId` valide si son contenu utile a changé ;
- aucun `contentHash`, `anthropicContentHash`, `anthropicFileId`, `anthropicUploadedAt` ne doit survivre à tort ;
- la logique doit rester simple, localisée, lisible.

### 2. Fallback upload / réseau
Verrouiller le chemin d’erreur pour garantir :

- pas de faux état “prêt” ;
- pas de `file_id` zombie ;
- pas de mutation partielle silencieuse ;
- pas de pipeline qui continue avec un état image incohérent ;
- état UX/rapport lisible quand l’upload échoue.

Si le comportement actuel est déjà sain, tu ajoutes seulement les garde-fous ou reporting manquants.

### 3. Coût image limité aux bons agents
Confirmer et verrouiller que :

- seuls les agents réellement image-aware déclenchent la logique Files API ;
- aucun autre agent ne pousse un upload ou un header Files API par erreur ;
- le reporting permet de voir clairement si un agent a utilisé des fichiers ou non.

### 4. Persistance workspace bout en bout
Fermer le cycle :

- upload réussi → persistance locale correcte ;
- refresh navigateur → restauration correcte ;
- relance pipeline → réutilisation correcte ;
- image modifiée → invalidation correcte puis nouvelle persistance.

S’il manque de la traçabilité minimale pour vérifier ça, ajoute-la dans le reporting/cache report, sans alourdir l’UI.

---

## Bloc 2 — Fermer l’hygiène de branche / dépôt

Dans le même patch, tu dois aussi nettoyer le dépôt :

- retirer du versionning les artefacts runtime/backup non légitimes ;
- corriger `.gitignore` pour refléter la réalité du repo ;
- ne surtout pas casser le suivi légitime de `server.py`.

Le résultat attendu :

- `.anthropic_files_cache.json` ignoré proprement ;
- backup serveur supprimé du dépôt si c’est bien un artefact ;
- `FETCH_HEAD` retiré si c’est bien un résidu ;
- `.gitignore` cohérent avec le fait que le repo versionne du Python réel.

---

## Contraintes absolues

Tu ne fais **pas** :

- de refonte moteur ;
- de chantier prompts ;
- de retouche triple agent tags ;
- de séparation Collection / Tabletop ;
- de nouvelle feature UX secondaire ;
- de campagne de bench large ;
- de série de micro-patches.

Tu fais **un seul patch**, propre, lisible, ciblé.

---

## Fichiers probablement concernés

À auditer en priorité, sans élargir inutilement :

- `src/js/pipeline-api.js`
- `src/js/ui/images_ui.js`
- `src/js/pipeline-ui.js`
- `server.py`
- `.gitignore`

Et uniquement les autres fichiers si tu peux justifier un couplage réel.

---

## Livrables attendus

### 1. Diagnostic court avant patch
Tu dois commencer par un diagnostic net :

- ce qui est déjà bon ;
- ce qui est seulement partiellement couvert ;
- ce qui manque vraiment ;
- quels fichiers locaux exacts tu demandes pour patcher.

### 2. Un seul patch Git
Nom clair, par exemple :
`patch/git/files_api_closeout_reliability_and_repo_hygiene.patch`

### 3. Note de validation
À fournir avec le patch :

- périmètre exact ;
- fichiers modifiés ;
- pourquoi chaque modif existe ;
- ce qui a été volontairement laissé hors scope.

### 4. Checklist de test ciblée
Mini checklist concrète, centrée sur 6 à 10 cas max :

- upload normal ;
- refresh après upload ;
- crop puis relance ;
- remplacement image puis relance ;
- erreur upload simulée ;
- agent non image-aware ;
- restauration workspace ;
- cache report lisible.

---

## Critères d’acceptation

Le patch est bon seulement si :

- il ne réécrit pas le moteur ;
- il ferme les 4 sujets Files API de manière crédible ;
- il nettoie les artefacts de dépôt ;
- il garde le reporting et la lecture runtime compréhensibles ;
- il reste strictement dans le scope ;
- il aide à **clore** `files_api`, pas à rouvrir un chantier.

---

## Rappel de posture

Tu te comportes comme un senior fiable.  
Tu coupes le gras.  
Tu ne fais pas “un peu de l’un et un peu de l’autre”.  
Tu fermes **les deux feedbacks en un seul patch cohérent**.
