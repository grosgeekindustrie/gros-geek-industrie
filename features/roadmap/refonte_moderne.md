# Refonte moderne — topo complet

## 1. Objectif du chantier

Avant d’ouvrir le chantier social, la base actuelle doit être assainie et modernisée.

Le but n’est pas de faire une refonte “cosmétique”.
Le but est de préparer un socle :

- plus lisible
- plus modulaire
- plus moderne
- plus prévisible
- plus simple à maintenir
- plus simple à faire évoluer

La refonte doit permettre :

- de sortir définitivement des anciens restes du batch
- de supprimer le code mort
- de clarifier les responsabilités des modules
- de basculer sur un style **ECMAScript 2022 minimum**
- de repenser l’architecture fichiers / répertoires
- de préparer un terrain propre pour les futurs modules, notamment **social**

---

## 2. Philosophie générale

Cette refonte ne doit pas devenir un grand chantier abstrait.

Elle doit rester :

- pragmatique
- progressive
- testable
- pilotée par le vivant
- organisée par domaines fonctionnels
- compatible avec une stratégie de patch fiable

Le principe de base est :

- **d’abord assainir**
- **ensuite structurer**
- **ensuite moderniser**
- **ensuite brancher les nouveaux modules**

L’API, le social, les nouveaux flux ou de futurs agents ne doivent pas venir se coller sur une base encore bancale.

---

## 3. Les problèmes actuels à traiter

### 3.1 Batch encore présent ou encore suggéré
Le batch est abandonné comme logique métier.
Il ne doit plus influencer :

- l’UI
- le runtime
- les états internes
- les flux de lancement
- les mappings
- les flags
- les fallbacks
- les comportements conditionnels

### 3.2 Code mort
Le projet a grossi.
Il y a probablement :

- des fonctions jamais appelées
- des handlers orphelins
- des toggles obsolètes
- des blocs UI qui ne rendent plus rien
- des anciens formats de données
- des vieux chemins de compatibilité
- des prompts ou mappings non utilisés
- des branches de logique qui ne correspondent plus au projet actuel

### 3.3 Style de code hétérogène
Le projet commence à accumuler :
- du style moderne
- du style legacy
- des conventions mixtes
- des responsabilités mal réparties
- des noms de fichiers qui ne disent pas clairement ce qu’ils contiennent

### 3.4 Arborescence qui commence à se tasser
Quand le nombre de fichiers augmente, le risque est :
- une UI qui porte trop de logique métier
- des fichiers data qui deviennent des mini-moteurs
- des services implicites dispersés
- des zones “fourre-tout”
- une logique pipeline difficile à séparer du reste
- un futur module social sans place naturelle

### 3.5 Dette mentale
Même quand “ça marche”, une base trop chargée finit par coûter :
- du temps d’analyse
- des patchs qui fail
- de la peur de toucher certaines zones
- des régressions évitables
- une difficulté à onboarder un nouvel agent efficacement

---

## 4. Objectifs concrets de la refonte

Cette refonte doit atteindre les objectifs suivants :

### 4.1 Objectifs fonctionnels
- débrancher totalement le batch
- supprimer les chemins morts
- clarifier les flux réellement vivants
- stabiliser le pipeline actuel

### 4.2 Objectifs de code
- passer à une base **ECMAScript 2022 minimum**
- rendre les modules lisibles
- séparer plus proprement UI / métier / config / services
- réduire les chaînes magiques et conventions implicites

### 4.3 Objectifs structurels
- obtenir une arborescence plus moderne
- créer des domaines fonctionnels clairs
- préparer une place nette pour le module social
- rendre la maintenance plus simple

### 4.4 Objectifs méthodologiques
- ne pas casser le pipeline produit déjà stabilisé
- éviter les énormes patchs opaques
- avancer par blocs cohérents
- garder une politique de contrôle stricte

---

## 5. Priorité absolue : débrancher le batch

Le batch abandonné doit disparaître du vivant.

### À traiter
- boutons UI liés au batch
- états batch dans le runtime
- chemins de lancement
- branches conditionnelles
- toggles dev ou flags encore liés
- anciennes structures de données batch
- logique d’affichage ou de selection spécifique
- ancienne sémantique “multi-run” si elle traîne encore

### Résultat attendu
Après cette étape :
- aucune feature active ne suppose encore le batch
- aucun flux standard ne dépend d’un comportement batch
- la base ne transporte plus de logique fantôme à ce sujet

---

## 6. Deuxième priorité : suppression du code mort

### Principe
On ne supprime pas “au feeling”.
On supprime à partir du **vivant réel**.

### Typologie du code mort
- fonctions non appelées
- helpers jamais importés
- blocs UI plus utilisés
- anciens essais conservés “au cas où”
- flags obsolètes
- prompts orphelins
- anciens data maps devenus inutiles
- fallbacks hérités d’anciens chantiers
- logique de compatibilité qui ne sert plus

### Méthode recommandée
- identifier le vivant
- marquer le legacy toléré
- isoler le mort
- supprimer progressivement
- valider après chaque suppression

### Résultat attendu
- moins de bruit
- moins de confusion
- moins de dépendances cachées
- moins de risques lors des futurs patchs

---

## 7. Troisième priorité : modernisation ES2022

L’objectif n’est pas de “faire moderne pour faire moderne”.
L’objectif est de rendre le code plus sûr et plus lisible.

### Standard souhaité
- `const` par défaut
- `let` seulement si mutation réelle
- arrow functions quand pertinent
- objets et tableaux déclarés clairement au début des fonctions si utile
- early returns
- destructuring propre
- helpers petits et lisibles
- suppression des styles verbeux inutiles
- code sans bricolage implicite

### Ce qu’il faut éviter
- réécriture artistique inutile
- modernisation de zones mortes
- gros patchs purement stylistiques sans gain fonctionnel
- changements qui mélangent style + logique + architecture dans un seul bloc

### Résultat attendu
- style homogène
- lecture plus rapide
- onboarding plus facile
- futur code plus simple à maintenir

---

## 8. Repenser l’architecture fichiers / répertoires

### Pourquoi
Le projet a assez grandi pour justifier une vraie logique de domaines.
Il faut sortir progressivement d’une logique :
- “beaucoup de fichiers côte à côte”
- “UI qui transporte du métier”
- “data qui sert parfois de config, parfois de runtime, parfois de mapping”

### Cible
Aller vers une organisation plus moderne par **domaines fonctionnels**.

### Exemple de direction cible
```text
src/
  app/
    boot/
    routing/
    state/

  pipeline/
    core/
    runtime/
    agents/
    prompts/
    renderers/
    ui/
    data/

  social/
    core/
    agents/
    renderers/
    publishers/
    ui/
    data/

  shared/
    utils/
    services/
    storage/
    components/
    constants/

  assets/
```

### Important
Cette arborescence n’est pas un ordre absolu.
C’est une direction :
- séparer le pipeline
- prévoir le social
- isoler le partagé
- éviter les dossiers fourre-tout

---

## 9. Domaines fonctionnels à faire émerger

### 9.1 `pipeline`
Tout ce qui concerne :
- moteur pipeline
- runtime
- agents
- prompts
- mappings pipeline
- UI pipeline

### 9.2 `social`
Tout ce qui concerne :
- package social maître
- renderers sociaux
- publishers
- UI social
- file d’attente sociale
- scheduling
- stockage des drafts et posts

### 9.3 `shared`
Tout ce qui est transversal :
- utilitaires
- services techniques
- stockage
- composants réutilisables
- constantes
- types / schémas

### 9.4 `app`
Tout ce qui touche à :
- boot
- orchestration globale
- initialisation
- état applicatif global

---

## 10. Convention de modules à poser avant même les déplacements

Avant de déplacer les fichiers, il faut poser une convention simple.

Un fichier doit appartenir principalement à une catégorie claire :

- UI
- runtime
- data/config
- service
- renderer
- publisher
- helper partagé

L’objectif est d’éviter :
- les modules “couteau suisse”
- les fichiers UI qui embarquent trop de logique métier
- les services cachés dans des fichiers data
- les renderers qui deviennent des mini-moteurs

---

## 11. Inventaire du vivant

Avant de nettoyer ou déplacer, il faut produire un vrai inventaire.

### Catégories utiles
- **vivant**
- **legacy toléré**
- **mort**
- **à migrer plus tard**
- **transverse critique**

### Pourquoi c’est utile
Ça permet :
- de ne pas toucher au hasard
- d’éviter de supprimer un vieux bloc encore utilisé
- d’éviter de garder des morceaux morts juste par peur
- d’avoir un plan clair par fichier

---

## 12. Règles de dépendances / imports

Une fois la nouvelle structure en place, il faut éviter le spaghetti.

### Règles recommandées
- `shared` ne dépend de personne
- `pipeline` peut dépendre de `shared`
- `social` peut dépendre de `shared`
- `app` orchestre
- `ui` ne doit pas contenir la logique métier profonde si elle peut vivre ailleurs

### Résultat attendu
- moins de dépendances croisées
- moins de circularité
- meilleure lisibilité
- patchs plus sûrs

---

## 13. Extraire les constantes et schémas implicites

Tout ce qui ressemble à un schéma transversal doit quitter la logique dispersée.

### Exemples
- ids agents
- noms de statuts
- familles de posts
- modes pipeline
- noms d’étapes
- mappings de rendu
- clés d’état
- formats d’objets partagés

### Pourquoi
Les chaînes magiques sont une grosse source de fragilité.
Les sortir dans des constantes ou schémas améliore :
- la lecture
- la maintenance
- la robustesse
- la cohérence entre modules

---

## 14. Prévoir un socle de logs unifié

Pas besoin d’un énorme framework.
Mais il faut une discipline.

### Niveaux minimums
- info
- warn
- error
- debug

### Préfixes recommandés
- `pipeline:`
- `social:`
- `publish:`
- `storage:`
- `ui:`

### Pourquoi
Quand le projet grossit, les logs dispersés ou incohérents deviennent un enfer.
Un minimum d’unification est très rentable.

---

## 15. Legacy explicite

Tout ce qui ne peut pas être nettoyé immédiatement doit être clairement marqué.

### Options possibles
- dossier `legacy/`
- commentaire explicite `legacy`
- bloc clairement isolé
- convention de nommage temporaire

### But
Éviter que :
- quelqu’un “améliore” par erreur une zone tolérée mais bientôt supprimée
- du vieux code soit pris pour du code cible

---

## 16. Formats de données communs

Le projet doit commencer à expliciter les grands objets échangés entre domaines.

### Exemples
- `pipeline_result`
- `social_post_package`
- `publish_result`
- `publish_error`

### Pourquoi
Même si c’est léger au départ, ça apporte :
- cohérence
- lisibilité
- interopérabilité entre modules
- moins de bricolage implicite

---

## 17. Renommage des fichiers

Parfois, un vrai gain de clarté vient simplement du nommage.

### Objectif
Que le nom d’un fichier dise clairement :
- s’il est UI
- s’il est runtime
- s’il est data
- s’il est service
- s’il est renderer
- s’il est publisher

### Effet
Même sans migration lourde, ça améliore déjà :
- la lecture
- la navigation
- la compréhension du projet

---

## 18. Mode “safe cleanup”

Plutôt que supprimer brutalement certaines choses, on peut prévoir une approche progressive.

### Logique
- débrancher la feature
- loguer si elle est encore appelée
- observer
- supprimer ensuite

### Bénéfice
Moins de risque qu’une branche morte supposée soit en fait encore accrochée à un flux réel.

---

## 19. Document court de conventions techniques

Il faut aussi poser une convention simple pour éviter de resalir la base pendant la refonte.

### Exemples
- ES2022 minimum
- `const` par défaut
- arrow functions quand pertinent
- pas de logique métier lourde dans l’UI
- pas de strings magiques
- pas de nouveau legacy
- modules courts et lisibles
- séparation claire des responsabilités

---

## 20. Ordre de chantier recommandé

### Phase 1 — Assainissement fonctionnel
- débrancher batch
- couper les chemins encore actifs
- stabiliser le runtime vivant

### Phase 2 — Inventaire
- lister vivant / legacy / mort / transverse
- cartographier les responsabilités
- identifier les zones à migrer en priorité

### Phase 3 — Nettoyage
- supprimer le mort
- isoler le legacy
- retirer les anciens flags et chemins obsolètes

### Phase 4 — Conventions
- conventions modules
- règles d’import
- constantes / schémas
- conventions logs
- conventions techniques ES2022

### Phase 5 — Réarchitecture fichiers / répertoires
- définir l’arborescence cible
- migrer par blocs cohérents
- éviter les gros déplacements globaux sans contrôle

### Phase 6 — Refactor ES2022
- moderniser module par module
- sans changer le comportement
- avec validation systématique

### Phase 7 — Préparation du terrain social
- réserver la place du domaine `social`
- préparer les formats partagés
- s’assurer que le pipeline vit dans un cadre propre

---

## 21. Ce qu’il ne faut pas faire

- ne pas commencer par les APIs sociales
- ne pas lancer une refonte artistique globale
- ne pas déplacer des fichiers sans avoir clarifié leur rôle
- ne pas mélanger suppression du mort, refactor logique et migration structurelle dans un même patch géant
- ne pas moderniser les zones mortes
- ne pas garder des fallbacks anciens “au cas où” sans justification
- ne pas laisser l’UI devenir la zone fourre-tout

---

## 22. Résultat final visé

À la fin de cette refonte, la base doit être :

- débarrassée du batch
- allégée du code mort
- modernisée en ES2022
- mieux découpée en domaines
- plus claire sur les responsabilités
- plus simple à patcher
- plus simple à maintenir
- prête à accueillir proprement le module social

---

## 23. Résumé ultra-court

Le pré-chantier complet doit couvrir :

1. **débrancher le batch**
2. **supprimer le code mort**
3. **standardiser en ES2022**
4. **poser des conventions modules / imports / logs**
5. **clarifier les formats partagés**
6. **repenser l’arborescence**
7. **préparer la place du social**

Le but n’est pas de “faire joli”.  
Le but est de transformer un projet qui a grandi vite en une base moderne, lisible et durable.
