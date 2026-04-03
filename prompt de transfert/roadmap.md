# Roadmap — polissage pré-prod

Ce document recense les chantiers de finition à traiter **après l’implémentation des features principales**, avant une phase de production plus stable.

---

## 1. Enrichir les cards du pipeline batch courant

### Constat
Le batch affiche aujourd’hui :
- le pipeline de la fiche en cours,
- les cards des fiches batch en dessous.

Mais les cards du **pipeline batch courant** restent encore une version simplifiée de supervision :
- header,
- numéro,
- titre,
- statut.

Elles ne reprennent pas encore toute la richesse des cards du mode stand alone.

### Objectif
Faire converger progressivement les cards batch vers les cards stand alone, pour retrouver les mêmes outils de travail directement dans le batch.

### Éléments à réintégrer plus tard
- relancer un agent
- relancer la suite
- copier la sortie d’un agent
- afficher l’input brut
- ajouter une correction ponctuelle sur la fiche en cours
- injecter une directive persistante à un agent
- retrouver les actions de validation / invalidation sur les titres
- retrouver les actions de validation / invalidation sur les tags
- éventuellement réintroduire certaines actions d’exploration utiles

### Intention UX
Le batch ne doit pas rester un simple moniteur passif.
À terme, il doit devenir un **pipeline supervisé riche**, au plus proche du confort du stand alone.

---

## 2. Hard stop commun stand alone + batch

### Constat
Les arrêts explicites sont déjà en partie gérés :
- annulation via le header
- arrêt global
- stop batch
- usage d’`AbortController` sur les appels réseau

Mais il faut sécuriser davantage les cas suivants :
- fermeture d’onglet
- fermeture navigateur
- refresh
- navigation forcée
- plantage ou fermeture brutale de fenêtre

### Objectif
Mettre en place un **best effort maximal** pour que le pipeline soit stoppé immédiatement côté navigateur dès qu’on quitte la page ou qu’on annule, et qu’il ne continue pas inutilement en tâche de fond.

### Important
Ce chantier vise un **best effort solide**, pas une garantie absolue côté Anthropic.

Pourquoi :
- l’application appelle Anthropic directement depuis le navigateur,
- donc si une requête est déjà arrivée côté serveur au moment de la fermeture, on ne peut pas garantir à 100% l’arrêt du calcul distant avec l’architecture actuelle.

Une garantie totale demanderait une architecture backend intermédiaire avec gestion explicite des jobs annulables.

### Pistes de travail
- créer un hard stop central commun
- brancher ce hard stop sur :
  - `pagehide`
  - `beforeunload`
- éviter d’utiliser `visibilitychange` pour ne pas tuer le pipeline lors d’un simple changement d’onglet
- rendre aussi les attentes de retry interrompables proprement

### Intention produit
Assurer un comportement runtime plus propre, plus sûr, et plus rassurant avant mise en production.

---

## 3. Positionnement de ces chantiers

Ces sujets relèvent de la **phase de polissage pré-prod** :
- stabilité runtime
- homogénéité UX
- réduction des comportements ambigus
- rapprochement entre batch et stand alone

Ils doivent intervenir **une fois les features principales terminées**, afin d’éviter de polir trop tôt une base encore mouvante.

---

## 4. Priorité actuelle

Ordre recommandé :
1. terminer les features principales
2. enrichir les cards batch si besoin opérationnel
3. implémenter le hard stop commun
4. lancer une phase de retest complète avant prod
