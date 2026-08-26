# Features multi-LLM — cadrage stratégique

## Objectif

Préparer Etsy Pipeline à fonctionner avec plusieurs fournisseurs de LLM et plusieurs modèles, sans enfermer le projet dans une intégration unique ni reconstruire l’architecture à chaque changement de provider.

Ce document ne cherche pas à coller trop fort à l’état actuel du code. Il part d’un principe simple : d’ici le vrai chantier, une grosse partie du code aura probablement bougé. L’objectif est donc de définir une direction solide, durable et compatible avec une future remise à plat plus professionnelle.

---

## Résumé exécutif

La bonne cible n’est pas « brancher GPT à la place d’Anthropic », mais **introduire une couche provider-agnostic** capable de piloter :

- plusieurs APIs cloud : Anthropic, OpenAI, éventuellement Gemini ou Mistral
- plusieurs backends locaux : LM Studio, Ollama, vLLM
- plusieurs modèles selon l’agent, le mode et le niveau de qualité attendu
- plusieurs stratégies d’exécution : qualité, vitesse, coût réduit, benchmark, fallback

Le plus important est de séparer clairement :

1. **l’orchestration métier** du pipeline
2. **la traduction provider** du prompt, des images, des modèles et des options runtime
3. **le monitoring** de coût / usage / latence / qualité
4. **la configuration des profils de modèles** par agent

La première version utile devrait viser un socle capable de faire tourner au minimum :

- Anthropic
- OpenAI
- un backend local compatible OpenAI ou Anthropic

---

## Pourquoi ce chantier vaut le coup

### 1. Réduire la dépendance à un seul provider
Aujourd’hui, si le fournisseur principal devient trop cher, trop limité ou moins bon sur certains types de tâches, le pipeline devient fragile.

### 2. Comparer les performances réelles par agent
Tous les agents n’ont pas besoin du même niveau de raisonnement ni de la même qualité visuelle. Un moteur local ou moins coûteux peut suffire pour certains agents, alors qu’un autre agent demandera un modèle plus fort.

### 3. Maîtriser les coûts
Un pipeline bien pensé pourrait faire par exemple :
- Jules / vision sur modèle plus fort
- tags sur modèle plus rapide
- CTA / accroches sur modèle intermédiaire
- benchmark ponctuel sur un modèle local

### 4. Ouvrir la voie à un vrai workspace de test
Avec une architecture multi-provider, il devient possible d’imaginer plus tard :
- des A/B tests de providers
- des comparaisons de sorties
- du fallback automatique
- des profils « qualité », « économique », « local only »

---

## État actuel du projet — contraintes observables

### Ce qui est déjà favorable
L’intégration provider semble aujourd’hui assez centralisée côté runtime, ce qui est un bon point de départ pour un futur refactor contrôlé.

### Ce qui est contraignant
Le runtime actuel reste couplé à des hypothèses provider-spécifiques :
- format de requête
- construction des messages
- gestion des images
- logique de retry
- logique de cache
- logique de coût / usage

### Conséquence
Le bon chantier n’est pas un simple « remplace fetch par un autre fetch », mais la création d’un contrat d’abstraction propre.

---

## Capacités à viser

## Niveau 1 — multi-provider simple
Permettre de choisir un provider courant :
- anthropic
- openai
- local compatible

Objectif :
- même pipeline
- même UI générale
- provider choisi via config

## Niveau 2 — multi-modèle par agent
Permettre de définir le modèle agent par agent :
- Jules → modèle vision fort
- Eden → modèle rédaction
- Axel → modèle rapide et économique

## Niveau 3 — profils d’exécution
Permettre des profils globaux :
- qualité max
- coût réduit
- local test
- benchmark mixte

## Niveau 4 — bench / comparaison
Permettre de lancer le même agent sur plusieurs providers / modèles et comparer :
- format
- temps
- coût
- cohérence
- qualité métier

---

## Providers cloud — évaluation

## Anthropic
### Forces
- très bon fit actuel avec le projet
- bon niveau rédaction / raisonnement
- support clair du prompt caching
- Messages API déjà en place dans le runtime existant

### Faiblesses
- couplage actuel fort dans le projet
- dépendance coût / crédits
- logique spécifique à Anthropic pour certains détails runtime

### Conclusion
Anthropic doit rester une cible de premier rang dans une architecture future.

## OpenAI
### Forces
- très bon intérêt stratégique comme second provider majeur
- Responses API moderne
- support texte + image input
- bon potentiel pour certains agents rédaction / généralistes
- écosystème immense

### Faiblesses
- adaptation non triviale depuis une intégration pensée d’abord pour Anthropic
- sémantiques d’API et d’usage différentes
- coûts et retours d’usage à remapper proprement

### Conclusion
OpenAI est le meilleur second provider cloud à prévoir.

## Gemini
### Forces
- multimodal crédible
- intéressant pour certains usages vision / contexte étendu

### Faiblesses
- ajout d’un troisième provider trop tôt risque de disperser l’effort
- intérêt à confirmer plus tard selon besoins réels

### Conclusion
À garder comme piste secondaire, pas comme cible du premier chantier.

## Mistral
### Forces
- intéressant en Europe
- écosystème utile à surveiller

### Faiblesses
- probablement moins prioritaire qu’OpenAI ou Anthropic pour le cœur du pipeline

### Conclusion
Piste secondaire, pas cible prioritaire de la première itération.

---

## Backends locaux — évaluation

## LM Studio
### Forces
- très bon candidat pour un POC local
- endpoints compatibles OpenAI
- endpoints compatibles Anthropic
- ergonomie très simple en local
- bon fit pour du test rapide

### Faiblesses
- dépend des modèles chargés localement
- qualité variable selon le matériel et les modèles

### Conclusion
Excellent candidat local pour démarrer.

## Ollama
### Forces
- très simple à utiliser
- très bon pour lancer vite des tests locaux
- compatibilité OpenAI
- gros écosystème de modèles facilement testables

### Faiblesses
- compatibilité fonctionnelle à vérifier selon les besoins précis
- vision / structured output / tools à tester au cas par cas selon les modèles

### Conclusion
Très bon candidat local, surtout pour expérimenter vite.

## vLLM
### Forces
- plus proche d’un vrai serveur d’inférence robuste
- API compatible OpenAI
- intéressant si un jour le local devient un vrai axe lourd

### Faiblesses
- plus technique
- moins simple comme première marche pour un usage artisanal / rapide

### Conclusion
Plutôt une cible avancée qu’une première étape.

## LiteLLM
### Forces
- peut servir de gateway / proxy multi-provider
- intéressant pour routing, fallback, A/B tests
- standardisation possible du point d’entrée

### Faiblesses
- couche supplémentaire
- à introduire quand le besoin de routage devient réel, pas juste « parce que ça existe »

### Conclusion
Très intéressant à terme, mais pas obligatoire dès la première itération.

---

## Architecture cible recommandée

## 1. Contrat provider-agnostic

Créer une couche d’abstraction explicite, par exemple conceptuellement :

- `runModelCall(request)`
- `providerAdapter.execute(request)`
- `normalizeProviderResponse(response)`

La couche amont ne doit plus connaître directement :
- les URLs fournisseur
- les headers spécifiques
- la forme exacte du body
- la structure brute de réponse

## 2. Requête canonique interne

Définir une structure interne unique, par exemple avec ces familles d’informations :
- agentId
- prompt variable
- contenu fixe
- inputs image
- paramètres runtime
- modèle logique demandé
- options de cache
- timeout / retry
- métadonnées de session

Chaque provider adapte ensuite cette structure vers son propre format API.

## 3. Réponse canonique interne

Définir un format interne unique pour ce que le pipeline récupère :
- texte final
- usage normalisé
- temps d’exécution
- provider
- modèle réel
- drapeaux de cache
- erreurs normalisées

## 4. Registry de modèles

Au lieu d’un simple mapping figé, viser un registre plus riche :
- provider
- model
- capacités vision oui/non
- structured output oui/non
- coût estimé
- niveau attendu
- rôle recommandé

Exemple conceptuel :

```js
{
  "jules": {
    "provider": "anthropic",
    "model": "claude-sonnet",
    "vision": true,
    "tier": "quality"
  },
  "axel": {
    "provider": "openai",
    "model": "gpt-5-mini",
    "vision": false,
    "tier": "fast"
  }
}
```

## 5. Profils de runtime

Permettre plus tard des profils globaux :
- `quality`
- `balanced`
- `budget`
- `local`

Le profil choisit les modèles effectifs via le registre.

---

## Ce qu’il faudra vraiment séparer proprement

## A. Orchestration métier
Doit rester indépendante du provider.

## B. Adaptateurs provider
Un fichier / module par provider, avec un contrat strict.

## C. Normalisation coût / usage
Très important. Chaque provider renvoie des métriques différentes.

## D. Gestion des images
Le pipeline actuel dépend de prompts + images. La couche provider devra normaliser l’envoi image, car chaque API a ses propres conventions.

## E. Cache
Ne jamais supposer que les mécanismes sont identiques entre providers.
Il faut plutôt une abstraction d’intention :
- contenu stable
- contenu variable
- préférence de cache
puis laisser le provider traduire comme il peut.

---

## Structured outputs, tools, vision, local — points de vigilance

## Vision
Tous les providers ou modèles locaux ne se valent pas sur la vision.
Le système doit exprimer explicitement si un agent requiert :
- vision obligatoire
- vision optionnelle
- texte only

## Structured outputs
Très important si un jour certains agents deviennent plus fortement structurés.
Il faut prévoir une capacité « structured output preferred / required ».

## Tools / function calling
Pas critique immédiatement pour Etsy Pipeline, mais à prévoir dans le design.
Une bonne abstraction future évitera une refonte le jour où tu voudras brancher plus d’outils.

## Local
Le local ne doit pas être pensé comme « même qualité que le cloud par défaut ».
Il doit être vu comme :
- banc de test
- option économique
- comparaison
- parfois option pratique pour certains agents simples

---

## Stratégies de migration possibles

## Option A — patch minimal
Ajouter OpenAI rapidement dans le runtime actuel.

### Avantages
- rapide
- peu cher en refactor immédiat

### Inconvénients
- dette quasi garantie
- architecture plus sale
- local plus difficile ensuite

### Verdict
À éviter sauf urgence extrême.

## Option B — socle multi-provider propre
Faire d’abord l’abstraction provider, puis brancher Anthropic et OpenAI, puis plus tard un local.

### Avantages
- fondation saine
- futur local facilité
- bench plus simple

### Inconvénients
- investissement initial plus élevé

### Verdict
Meilleure option.

## Option C — grande refonte globale
Profiter de la future remise à plat du projet pour intégrer le multi-provider dans la nouvelle architecture propre.

### Avantages
- meilleure cohérence finale
- pas de rustines

### Inconvénients
- plus lent
- nécessite vraie discipline de chantier

### Verdict
Probablement la meilleure trajectoire si la refonte « code pro sans dette » arrive réellement bientôt.

---

## Recommandation pragmatique

## Court terme
Ne rien brancher tout de suite.
Documenter proprement les besoins.

## Moyen terme
Quand le chantier partira vraiment :
1. créer la couche provider-agnostic
2. porter Anthropic dedans sans changer le comportement métier
3. ajouter OpenAI
4. ajouter un backend local simple, idéalement LM Studio ou Ollama
5. seulement après envisager benchmark / fallback / profils avancés

## Long terme
Si le projet est fortement professionnalisé :
- registry de modèles avancé
- profils par agent
- bench intégré
- export des comparaisons
- fallback intelligent
- éventuellement gateway type LiteLLM si le besoin apparaît

---

## Ce que ce chantier ouvrira ensuite

Si le multi-provider est bien conçu, il ouvrira directement la voie à :
- A/B tests de modèles
- comparaison qualité/coût/latence
- mode local de test
- profils de production
- bench agent par agent
- éventuel fallback automatique
- meilleure maîtrise budgétaire

---

## Priorités recommandées

### Priorité 1
Socle provider-agnostic.

### Priorité 2
Anthropic + OpenAI.

### Priorité 3
Un backend local simple compatible.

### Priorité 4
Registry de modèles et profils d’exécution.

### Priorité 5
Bench / comparaison / fallback.

---

## Conclusion

La bonne stratégie n’est pas de “rajouter GPT” dans le code actuel, mais de préparer une architecture où :

- le pipeline métier ne dépend plus directement d’Anthropic
- les providers deviennent interchangeables
- les modèles deviennent configurables
- le local devient une option naturelle
- les comparaisons deviennent possibles

Si la future refonte du projet vise vraiment un code propre et professionnel, alors le multi-LLM ne doit pas être traité comme une feature annexe : il doit être pensé comme un **socle d’inférence** à part entière.

---

## Sources utiles à relire plus tard

### Docs / APIs
- Anthropic prompt caching
- OpenAI Responses API + image inputs
- LM Studio OpenAI / Anthropic compatibility
- Ollama OpenAI compatibility
- vLLM OpenAI-compatible server
- LiteLLM proxy / gateway

### Note
Les détails exacts des APIs, modèles et compatibilités évoluent. Revalider la documentation officielle au moment du chantier effectif.
