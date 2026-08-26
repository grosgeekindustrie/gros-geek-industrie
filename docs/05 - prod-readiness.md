# Prod Readiness

## Objectif
Ce document sert de checklist légère pour guider la montée en qualité du projet jusqu’à un état exploitable en production.

Il ne décrit pas une cible théorique parfaite.
Il sert à suivre ce qui doit être :
- stabilisé
- sécurisé
- clarifié
- testé
- documenté

## 1. Principe général
Le projet ne doit pas chercher à être “parfait” trop tôt.

L’objectif est de progresser dans cet ordre :
1. base stable
2. conventions claires
3. nouvelles features utiles
4. réduction de la dette technique
5. durcissement prod
6. validation finale

## 2. État actuel visé
Avant de parler production, le projet doit déjà respecter durablement :
- architecture CSS découpée et stable
- HTML lisible et maintenable
- JS modulaire avec responsabilités claires
- conventions projet écrites et suivies
- nouvelle dette legacy bloquée
- patchs vérifiables
- checks visuels systématiques sur les zones UI

## 3. Critères de stabilité
Une zone peut être considérée comme stable quand :
- elle a déjà servi plusieurs fois
- elle ne change plus à chaque feature
- son comportement est compris
- ses hooks sont clairs
- ses points fragiles sont identifiés
- sa structure est documentée au bon niveau

Tant qu’une zone n’est pas stable, éviter d’en faire une norme projet.

## 4. Dette technique à surveiller
Les éléments suivants doivent être surveillés jusqu’à disparition ou stabilisation :

### 4.1 Hooks legacy
- `onclick` inline encore présents
- sélecteurs JS fondés sur `id`
- dépendances DOM historiques

### 4.2 Couche CSS résiduelle
- présence de `06-inline-merged.css`
- règles provisoires qui n’ont pas encore trouvé leur destination définitive

### 4.3 Runtime encore centralisé
- logique encore présente dans les couches historiques
- points de couplage entre orchestration, DOM et exécution

### 4.4 Duplications structurelles volontaires
- blocs Tabletop / Collection gardés séparés
- duplications encore tolérées tant qu’aucune abstraction stable n’est validée

## 5. Axes de préparation production

### 5.1 Structure
- garder une architecture compréhensible
- éviter les effets de bord implicites
- réduire les couplages fragiles
- garder des responsabilités de fichiers nettes

### 5.2 DOM et hooks
- utiliser `data-js` pour tout nouveau hook JS
- réserver les classes au style
- limiter les nouveaux usages d’`id` côté JS
- documenter les hooks legacy tant qu’ils existent
- préférer `addEventListener()` pour tout nouveau binding
- préférer les méthodes DOM modernes quand elles clarifient l’intention
- réserver `appendChild()` et équivalents plus anciens au legacy ou aux cas simples déjà cohérents avec la zone touchée

### 5.3 UI
- vérifier le rendu Tabletop
- vérifier le rendu Collection
- vérifier les lightboxes
- vérifier les outputs finaux
- vérifier les blocs réseaux
- vérifier le batch

### 5.4 Robustesse
- gérer proprement les erreurs
- gérer proprement les arrêts manuels
- éviter les états UI incohérents
- limiter les hypothèses cachées sur le DOM ou l’ordre de chargement
- faire remonter des erreurs UI exploitables dans tout nouveau flow asynchrone

### 5.5 Documentation
Le projet doit au minimum conserver à jour :
- `architecture.md`
- `agent-guidelines.md`
- `commenting-standard.md`

Les docs doivent rester courtes, vraies et utiles.

## 6. Quand documenter une feature
Règle projet :
- pendant le dev : contrat minimal
- après validation : doc locale courte si nécessaire
- après stabilisation : intégration dans les docs maîtres

Une feature récente n’a pas besoin d’une grosse doc finale tant qu’elle bouge encore.

## 7. Critères avant mise en prod
Avant de considérer le projet “prod-ready”, vérifier :

### 7.1 Architecture
- les conventions sont stables
- les modules dominants sont identifiés
- l’orchestrateur reste léger
- la nouvelle dette n’entre plus dans le projet

### 7.2 Front
- les vues principales sont stables
- les thèmes Tabletop / Collection restent cohérents
- les blocs critiques n’ont plus de comportement surprenant
- le batch reste fonctionnel après nouvelles features

### 7.3 Code
- les zones legacy critiques sont identifiées
- les commentaires sensibles sont en place
- les points temporaires encore présents sont explicitement assumés
- les nouvelles features respectent les guidelines

### 7.4 Workflow
- les patchs sont ciblés
- les checks visuels sont faits
- les changements structurels sont documentés
- les règles de contribution sont suivies

## 8. Ce qui ne doit pas bloquer la prod
Ne pas retarder indéfiniment la mise en prod pour :
- un legacy connu mais stable
- une duplication volontaire encore utile
- une doc non exhaustive
- une architecture non parfaite mais comprise

La prod n’exige pas la perfection.
Elle exige :
- de la stabilité
- des conventions
- de la compréhension
- un niveau de risque maîtrisé

## 9. Ce qui doit bloquer la prod
Doit bloquer une mise en prod :
- une architecture devenue incompréhensible
- des hooks trop fragiles
- une UI qui casse régulièrement selon les modes
- des changements non vérifiables
- des zones critiques sans compréhension claire
- une dette technique qui continue à croître sans contrôle

## 10. Checklist légère de suivi

### Stable
- [ ] conventions projet respectées
- [ ] architecture encore compréhensible
- [ ] split CSS maintenu proprement
- [ ] orchestrateur non rechargé en logique métier

### UI
- [ ] home OK
- [ ] Tabletop OK
- [ ] Collection OK
- [ ] pipeline view OK
- [ ] lightboxes OK
- [ ] réseaux OK
- [ ] batch OK

### Hooks
- [ ] nouveaux hooks en `data-js`
- [ ] pas de nouvelle dépendance classe → JS
- [ ] legacy identifié quand encore présent

### Dette
- [ ] pas de nouveau inline HTML
- [ ] pas de nouveau monolithe CSS actif
- [ ] `06-inline-merged.css` n’absorbe pas de nouvelle dette
- [ ] migrations locales seulement

### Docs
- [ ] architecture encore vraie
- [ ] guidelines encore vraies
- [ ] standard de commentaires respecté

## 11. Règle finale
Un projet devient prêt pour la production quand il cesse d’accumuler du flou.

La cible n’est pas “tout refaire”.
La cible est :
- savoir comment le projet est structuré
- savoir où ajouter la suite
- savoir ce qui est legacy
- savoir ce qui est la norme
- pouvoir faire évoluer le projet sans devoir le nettoyer à chaque fois
