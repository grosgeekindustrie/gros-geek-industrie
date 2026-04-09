# Impacts repo — refonte pipeline v2 sur branche iris

## Objet de ce document

Ce document cartographie les impacts techniques probables de la refonte pipeline v2 sur la branche `iris`.

Il ne s'agit pas encore d'un plan de patch détaillé.
C'est un **document de cadrage d'impact** destiné au prochain agent de refonte.

Le scope actuel est strict :
- restructuration du pipeline
- moteur commun Collection / Tabletop
- logique cumulative
- step final "Lancement"
- exécution par étape cible
- instrumentation cache / coût
- extraction de données déclaratives quand c'est pertinent

Les **prompts agents** ne sont **pas** le sujet principal à ce stade.

---

## Constat repo global

La branche `iris` est déjà assez modulaire côté UI, mais le runtime pipeline reste encore centralisé autour de quelques fichiers cœur.

Les points les plus structurants sont :
- `src/js/pipeline-api.js`
- `src/js/ui/config_ui.js`
- `src/js/ui/forms_ui.js`
- `src/js/ui/app_ui.js`
- `src/etsy-pipeline-dnd-v1_2.html`
- `server.py`

Le repo contient aussi encore du batch visible et branché, alors que le batch sort désormais de la roadmap produit.

---

## Règle d'architecture à respecter

Le prochain agent doit partir de cette règle :

**Collection** et **Tabletop** doivent partager le même moteur de bout en bout.

Seules différences autorisées :
- stepper
- agents
- données métier
- champs formulaire spécifiques

Conséquence :
- pas de duplication de logique pipeline
- pas de divergence de runtime
- pas de refonte "collection d'abord, tabletop plus tard" si cela crée deux moteurs différents

---

## Cartographie par zone d'impact

## 1. Cœur d'orchestration pipeline

### Fichier principal
- `src/js/pipeline-api.js`

### Raisons d'impact
Ce fichier est le cœur de la refonte.
Il gère encore aujourd'hui :
- l'appel Anthropic
- les images
- le cache partiel
- l'exécution des agents
- une partie du monitoring coût
- l'orchestration globale
- de la logique QA / orchestrateur
- des helpers annexes

### Impacts probables
- réordonner le pipeline canonique
- faire disparaître l'ancien couplage ALT trop tôt dans la chaîne
- implémenter la logique :
  `target step = rejouer la chaîne jusqu'à cette étape`
- gérer correctement les outputs intermédiaires cumulés
- exposer clairement les statuts cache / coût
- préparer éventuellement Files API plus tard
- éviter que Collection et Tabletop aient des chemins d'exécution divergents

### Niveau de risque
**Très élevé**

### Recommandation
Ne pas faire de gros refactor cosmétique.
D'abord clarifier les responsabilités :
- exécution pipeline
- runtime cache/coûts
- helpers annexes

---

## 2. Déclaration des agents et ordre canonique

### Fichier principal
- `src/js/ui/config_ui.js`

### Raisons d'impact
Ce fichier semble être la source de vérité pour :
- ordre des agents par mode
- labels
- liens vers prompts
- usage images
- configuration statique par mode

### Impacts probables
- aligner l'ordre canonique sur :
  marché → titre → tags → description → alt
- harmoniser Collection / Tabletop autour d'un même modèle déclaratif
- distinguer clairement :
  - agents métier
  - ordre d'exécution
  - étape cible lançable
- préparer une extraction plus déclarative des configs

### Niveau de risque
**Très élevé**

### Recommandation
Ce fichier doit probablement devenir la vraie source de vérité du pipeline par mode, mais dans une forme plus déclarative et plus lisible.

---

## 3. Construction du contexte cumulatif

### Fichier principal
- `src/js/ui/forms_ui.js`

### Raisons d'impact
Ce fichier participe déjà à :
- construction du contexte
- lecture des champs formulaire
- persistance
- fetch éventuel de source distante
- injection de données collection / tabletop
- préparation de certains blocs utilisés par les agents

### Impacts probables
- stabiliser le dossier cumulatif
- injecter toutes les données utiles dès le départ
- éviter les contextes trop pauvres
- réaligner les blocs de contexte entre Collection et Tabletop
- préparer un préfixe cacheable plus propre

### Niveau de risque
**Élevé**

### Recommandation
Garder une logique claire :
- données formulaire
- données enrichies
- blocs cumulés
- puis seulement agent courant

---

## 4. Injection des outputs dans les prompts / placeholders

### Fichier principal probable
- `src/js/ui/prompt_biblio_ui.js`

### Raisons d'impact
Si ce module gère l'assemblage des placeholders et des sorties amont, il est directement concerné par la logique cumulative.

### Impacts probables
- garantir que chaque étape lit tout le cumul amont utile
- éviter les trous de contexte
- aligner Collection / Tabletop sur un même contrat
- ne pas dépendre trop tôt de prompts spécifiques

### Niveau de risque
**Moyen à élevé**

### Recommandation
Le prochain agent doit vérifier précisément ce qui est injecté automatiquement et à quel moment.

---

## 5. UI shell / navigation / visibilité des zones

### Fichiers principaux
- `src/js/ui/app_ui.js`
- `src/js/ui/collection_tabs_ui.js`
- probablement l'équivalent tabs côté tabletop
- `src/js/ui/render_ui.js`

### Raisons d'impact
La refonte ne touche pas qu'aux agents.
Elle modifie aussi :
- le point de lancement
- l'état des tabs
- la visibilité des colonnes
- la progression UI
- la sémantique "prêt à lancer / en cours / terminé"

### Impacts probables
- intégrer le step final "Lancement"
- harmoniser la logique de pilotage Collection / Tabletop
- afficher clairement les étapes réellement jouées
- aligner les tabs sur le nouveau runtime
- intégrer le debug cache visible
- éviter les états contradictoires

### Niveau de risque
**Élevé**

### Recommandation
Ne pas traiter l'UI comme un simple décor.
Le step "Lancement" devient une vraie brique métier.

---

## 6. Stepper Collection / Stepper Tabletop

### Fichiers principaux probables
- `src/js/ui/collection_stepper_ui.js`
- stepper tabletop équivalent s'il existe

### Raisons d'impact
Le nouveau pipeline exige un dernier step commun :
**Lancement**

### Impacts probables
- ajouter un step final de pilotage
- conserver des steppers distincts par mode
- mais partager la même logique métier derrière
- refléter les prérequis de lancement

### Niveau de risque
**Moyen**

### Recommandation
Séparer clairement :
- structure visuelle du stepper
- logique métier de lancement

---

## 7. HTML principal / points d'entrée visibles

### Fichier principal
- `src/etsy-pipeline-dnd-v1_2.html`

### Raisons d'impact
Le HTML porte encore :
- éléments batch visibles
- labels produits / agents
- certains champs hardcodés
- certains mediums hardcodés
- les sections finales
- les zones réseaux / pipeline / résultats

### Impacts probables
- retirer ou neutraliser le batch dans l'UX visible
- préparer le step final "Lancement"
- ajouter le debug cache visible
- revoir les libellés liés à l'ordre agents
- préparer une structure plus cohérente Collection / Tabletop

### Niveau de risque
**Élevé**

### Recommandation
Traiter ce fichier comme un point de vérité produit important, pas comme une simple coquille HTML.

---

## 8. Données déclaratives (échelles, mediums, agents, options)

### Fichiers principaux
- `src/js/ui/echelles_ui.js`
- `src/js/ui/config_ui.js`
- HTML principal
- éventuellement nouveaux fichiers dédiés

### Raisons d'impact
Une partie de la donnée métier est encore hardcodée dans :
- des modules JS
- du HTML
- des constantes dispersées

### Impacts probables
- sortir les échelles dans une couche déclarative
- sortir les mediums dans une couche déclarative
- sortir les agents / labels / ordre dans une couche déclarative
- préparer une source de vérité plus propre pour Collection / Tabletop

### Niveau de risque
**Moyen**

### Recommandation
Ne pas forcément forcer du JSON tout de suite si le runtime actuel le complique.
Des modules JS déclaratifs peuvent être une étape propre et pragmatique.

---

## 9. Images / fichiers / Files API

### Fichier principal probable
- `src/js/ui/images_ui.js`
- plus tard `src/js/pipeline-api.js`

### Raisons d'impact
Aujourd'hui, les images semblent encore fortement branchées au flux runtime actuel.
L'intégration Files API viendra toucher :
- l'upload
- la représentation image
- la réutilisation des assets
- potentiellement une partie du cache effectif

### Impacts probables
- faire évoluer la structure d'image stockée côté state
- gérer des `file_id`
- conserver éventuellement un fallback actuel
- éviter de casser le crop / preview / UX existants

### Niveau de risque
**Élevé mais décalable**

### Recommandation
Traiter ce chantier après la refonte du moteur pipeline.
Ne pas le mélanger trop tôt à la simple réorganisation du pipe.

---

## 10. Server / static serving / JSON éventuel

### Fichier principal
- `server.py`

### Raisons d'impact
Si la refonte veut externaliser des données en JSON, il faut vérifier si le runtime serveur actuel les sert proprement.

### Impacts probables
- servir de nouveaux assets statiques
- autoriser ou non des fichiers JSON depuis `src`
- éventuellement ajouter des endpoints utilitaires
- éviter de casser le flux actuel de fichiers / prompts / fetch

### Niveau de risque
**Moyen**

### Recommandation
Ne toucher `server.py` que si l'architecture déclarative choisie l'exige vraiment.

---

## Packs de chantier recommandés

## Pack A — Recentrage pipeline produit
Objectif :
- sortir mentalement du batch
- réaligner l'ordre canonique
- préparer le modèle target-step
- supprimer les promesses UI contraires au nouveau produit
- casser les vieux couplages ALT / ordre agents

Fichiers les plus probables :
- `src/js/ui/config_ui.js`
- `src/js/pipeline-api.js`
- `src/js/ui/app_ui.js`
- `src/js/ui/collection_tabs_ui.js`
- `src/etsy-pipeline-dnd-v1_2.html`

Niveau de cohérence du pack :
**Très bon**

---

## Pack B — Cumulatif propre + contrat commun Collection / Tabletop
Objectif :
- stabiliser le dossier cumulatif
- vérifier l'injection amont
- harmoniser les deux modes
- préparer le moteur partagé

Fichiers les plus probables :
- `src/js/ui/forms_ui.js`
- `src/js/ui/prompt_biblio_ui.js`
- `src/js/pipeline-api.js`
- `src/js/ui/render_ui.js`

Niveau de cohérence du pack :
**Très bon**

---

## Pack C — Stepper + panneau Lancement + debug cache
Objectif :
- ajouter le step final
- clarifier le pilotage
- rendre visible le statut cache / coût / étape cible

Fichiers les plus probables :
- stepper collection
- stepper tabletop
- `src/js/ui/app_ui.js`
- `src/js/ui/collection_tabs_ui.js`
- HTML principal
- `src/js/pipeline-api.js`

Niveau de cohérence du pack :
**Bon**
À faire après clarification du moteur target-step

---

## Pack D — Données déclaratives
Objectif :
- nettoyer les hardcodes les plus évidents
- externaliser la donnée utile

Fichiers les plus probables :
- `src/js/ui/echelles_ui.js`
- `src/js/ui/config_ui.js`
- HTML principal
- éventuellement nouveaux fichiers dédiés
- éventuellement `server.py`

Niveau de cohérence du pack :
**Bon**
À éviter de mélanger trop tôt au runtime si le chantier moteur n'est pas stabilisé

---

## Pack E — Files API
Objectif :
- réutiliser proprement les images
- réduire les frictions futures
- préparer un flux image plus propre

Fichiers les plus probables :
- `src/js/ui/images_ui.js`
- `src/js/pipeline-api.js`
- éventuellement UI / state / upload helpers

Niveau de cohérence du pack :
**Moyen**
À traiter après la refonte du moteur et après instrumentation du coût

---

## Risques majeurs à surveiller

1. recréer deux moteurs divergents Collection / Tabletop
2. ajouter le step "Lancement" sans clarifier le runtime réel
3. mélanger en un seul patch :
   - ordre agents
   - moteur target-step
   - cache
   - Files API
   - data déclarative
4. casser l'export final ou les tabs en modifiant les clés d'outputs
5. nettoyer "pour faire propre" sans préserver les contrats runtime existants

---

## Recommandation d'ordre pour le prochain agent refonte

1. clarifier le **core partagé** et le **contrat target-step**
2. réaligner l'ordre canonique + la config agents
3. stabiliser le **cumulatif append-only**
4. intégrer le step **Lancement**
5. exposer le **debug cache**
6. nettoyer les données déclaratives
7. traiter Files API plus tard

---

## Conclusion

La refonte v2 est faisable sur la branche `iris`, mais elle est **transverse**.

Le prochain agent doit raisonner :
- **architecture d'abord**
- **contrats runtime ensuite**
- **UI de pilotage ensuite**
- **clean code / data déclarative après stabilisation**
- **Files API en chantier séparé**

Le repo semble déjà assez modulaire pour supporter cette refonte, mais les zones cœur restent fortement couplées.
Il faudra donc privilégier des packs cohérents plutôt qu'un patch total.
