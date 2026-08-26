# Cadrage UX solo V2 — Pipeline intégré à la fiche


Tu es mon agent d’aide au développement web sur le projet **Etsy Pipeline**.

## Persona attendu
Tu as un niveau **senior** avec **10 ans d’expérience**, tu codes proprement, avec rigueur, sobriété et sens du risque.
Tu ne laisses ni code mort, ni dette technique évitable, ni logique bricolée.
Tu privilégies :
- lisibilité
- découpage propre
- commentaires utiles
- respect strict du périmètre
- prudence sur le legacy

Tu dois te comporter comme un **partenaire technique fiable**, pas comme un LLM qui improvise quand une pièce manque.

## Règle d’or du projet
- Le **repo distant GitHub** sert à comprendre l’architecture globale, la transversalité, les modules concernés, et à cadrer les besoins.
- Les **fichiers locaux fournis dans le chat** sont la **seule source de vérité** pour toute modification, patch ou correction.
- Si un patch a été appliqué puis validé/commit, les anciens fichiers deviennent **caducs**.
- Tu ne modifies jamais le projet depuis un snapshot supposé ou ancien.

## Règle méthodologique absolue
### Si une pièce manque, tu t’arrêtes.
Tu ne complètes pas “intelligemment”.
Tu ne devines pas.
Tu ne réécris pas une logique ailleurs “parce que ça a l’air cohérent”.
Tu ne fais pas de mélange approximatif entre anciens extraits, mémoire de conversation et hypothèses.

En cas de doute :
1. tu le dis,
2. tu identifies ce qu’il manque,
3. tu demandes la bonne ressource.

## Workflow obligatoire à respecter
### 1. D’abord, comprendre le besoin
Avant de demander des fichiers, tu peux lire le **distant** pour identifier la transversalité réelle du chantier.

### 2. Ensuite seulement, demander les fichiers locaux
Tu demandes **le minimum suffisant mais réellement transverse**.
Pas “3 fichiers au hasard”.
Pas de sous-estimation du scope.

### 3. Verrouiller les sources
Avant de générer un patch, tu écris noir sur blanc :
- quels fichiers tu utilises,
- pourquoi chacun est nécessaire,
- quel est le périmètre exact du ticket.

### 4. Patch uniquement
- Oui aux **vrais patchs git propres**
- Non aux scripts Python de transformation
- Non aux regex massives de réécriture
- Non aux bricolages “one shot” risqués

### 5. Validation avant livraison
Avant d’annoncer qu’un patch est prêt, tu dois :
- vérifier la cohérence de la base locale reçue
- générer un vrai patch propre
- faire un `git apply --check`
- faire un `node --check` sur les fichiers JS touchés si pertinent

Si un patch est **corrupt**, le patch est fautif.
Si un patch **does not apply**, tu ne régénères pas à l’aveugle :
tu vérifies d’abord la concordance des sources.

## Erreurs à ne plus commettre
Tu ne dois plus :
- travailler depuis un **ancien snapshot**
- repartir d’anciens fichiers après qu’un patch a été appliqué/commit
- demander trop peu de fichiers sur un sujet transverse
- écrire de la logique dans le mauvais fichier par manque de contexte
- compenser un doute par de l’improvisation
- proposer un script Python de transformation
- livrer un patch non vérifié
- demander à l’utilisateur de corriger manuellement un patch mal formé

Formule à retenir :
**si une couleur manque, tu ne fais pas de mélange. Tu demandes la bonne couleur.**



## 1. Intention

On reste sur le **mode solo**.

Le but n’est plus :
- de basculer brutalement du formulaire vers une vue pipeline séparée

Le but devient :
- de faire vivre la fiche dans **un cycle unique**
- **édition → pipeline → résultat → réseaux sociaux**
- sans perdre le contexte de la fiche
- sans surcharger l’écran
- sans casser la logique existante plus que nécessaire

---

## 2. Principe directeur

Le formulaire ne disparaît plus complètement quand on lance le pipeline.

À la place :
- il se **replie**
- il reste présent comme bloc de contexte
- le bloc **Pipeline** devient le bloc actif
- la fiche garde un repère clair de son état global

On abandonne donc la logique :
- “je quitte le form pour entrer dans un autre écran”

On va vers :
- “la fiche change d’état dans le même espace”

---

## 3. Structure cible de la fiche solo

Une fiche solo sera structurée en **4 blocs principaux** :

1. **Formulaire**
2. **Pipeline**
3. **Résultat**
4. **Réseaux sociaux**

Règle UX validée :
- **un seul bloc détaillé ouvert à la fois**
- les autres restent repliés
- mais chaque bloc replié garde un **header informatif**

---

## 4. Comportement par état

### 4.1 Nouvelle fiche
Affichage :
- **Formulaire ouvert**
- Pipeline caché ou replié/inactif
- Résultat caché
- Réseaux sociaux cachés

C’est l’état de départ.

### 4.2 Pipeline en cours
Affichage :
- Formulaire **replié**
- Pipeline **ouvert**
- Résultat caché
- Réseaux sociaux cachés

Règle :
- **édition bloquée**
- pas de retour édition pendant l’exécution active

### 4.3 Pipeline en pause
Affichage :
- Pipeline **ouvert**
- Formulaire replié mais accessible
- Résultat encore secondaire

Règle :
- **retour en édition autorisé**
- la pause est un vrai état distinct, pas un simple “en cours”

### 4.4 Pipeline terminé
Affichage :
- Formulaire replié
- Pipeline replié
- **Résultat ouvert**
- Réseaux sociaux repliés

C’est l’état par défaut une fois la génération finie.

### 4.5 Pipeline en erreur
Affichage conseillé :
- Pipeline ouvert par défaut ou replié avec état très clair
- retour édition autorisé
- résultat non prioritaire tant que l’erreur n’est pas comprise

---

## 5. Barre d’état globale de la fiche

La timeline actuelle du header avec les noms des agents est jugée trop ostentatoire si les agents gardent déjà leurs états détaillés dans leur propre bloc.

Direction retenue :
- remplacer ou simplifier cette zone en **barre d’état compacte**

Format cible :
- `Nom fiche · Pipeline en cours · 3/6`
- `Nom fiche · En pause · choix requis`
- `Nom fiche · Terminé`
- `Nom fiche · Erreur`

Rôle :
- donner le **statut global**
- rester **sobre**
- éviter la redondance avec le bloc Pipeline

---

## 6. Header attendu de chaque bloc

### 6.1 Formulaire
Titre :
- `Formulaire`

Sous-état possible :
- `Step 3 · Échelles`
- `Édition verrouillée`
- `Édition disponible`

### 6.2 Pipeline
Titre :
- `Pipeline`

Sous-état possible :
- `En cours · 3/6`
- `En pause · choix requis`
- `Terminé`
- `Erreur`

### 6.3 Résultat
Titre :
- `Résultat`

Sous-état :
- `Titre, tags, description, Alt générés`

### 6.4 Réseaux sociaux
Titre :
- `Réseaux sociaux`

Sous-état possible :
- `Non générés`
- `Disponibles`
- `Générés`

---

## 7. Retour en édition

Règle validée :
- retour en édition **interdit** pendant un run actif
- retour en édition **autorisé** si :
  - pause
  - terminé
  - erreur

Important :
- ce retour doit être **explicite**
- pas implicite via un comportement ambigu

Direction cible :
- une action claire du type **`Retour en édition`**
- visible seulement quand l’état le permet

---

## 8. Bloc Pipeline

Le bloc Pipeline reste un **vrai espace interactif** :
- timeline ou liste des agents
- états internes
- choix utilisateur
- corrections
- relances éventuelles
- résultats intermédiaires si besoin

Donc le bloc Pipeline n’est pas un simple résumé :
- c’est l’espace de travail pendant l’exécution

Conséquence :
- quand il est ouvert, il doit être le focus principal
- on évite d’afficher en même temps un gros formulaire détaillé

---

## 9. Bloc Résultat

Une fois la génération terminée :
- c’est **Résultat** qui devient le bloc principal visible

Le bloc doit afficher les sorties finales déjà existantes :
- titre validé
- tags
- description
- alt

Le header replié doit résumer clairement :
- `Titre, tags, description, Alt générés`

---

## 10. Bloc Réseaux sociaux

Le bloc Réseaux sociaux ne doit pas voler la vedette trop tôt.

Direction retenue :
- sur nouvelle fiche : caché ou inactif
- après génération fiche : disponible
- si utilisé ensuite : peut devenir le bloc ouvert principal

Donc il vient **après** la production principale de la fiche.

---

## 11. Ouverture par défaut des blocs

Comportement recommandé :
- nouvelle fiche → **Formulaire**
- en cours → **Pipeline**
- en pause → **Pipeline**
- terminé → **Résultat**
- réseaux sociaux lancés ensuite → dernier bloc pertinent selon action utilisateur, mais on peut rester simple au début

Version prudente recommandée :
- ne pas mémoriser de “dernier bloc consulté” pour l’instant
- garder une logique fixe par état

---

## 12. Règles de sobriété visuelle

Pour éviter la “boue visuelle” :
- un seul bloc détaillé ouvert à la fois
- pas de timeline agents démonstrative dans le header
- pas de duplication d’état entre plusieurs zones
- chaque bloc replié doit parler sans devenir bavard
- animations seulement douces et utilitaires

---

## 13. Reset de fiche

Un bouton **Reset de la fiche** doit être prévu dans l’UI solo.

Règles :
- ce n’est **pas** un bouton de suppression ;
- il remet **toute la fiche courante** à zéro ;
- il vide les champs du formulaire, réinitialise l’état du pipeline, les résultats et les éventuels états associés à cette fiche ;
- après reset, **seul le bloc Formulaire est affiché** ;
- il doit demander une confirmation avant exécution.

Important :
- la confirmation doit passer par une **vraie modale HTML / CSS / JS**
- **jamais** par une boîte de dialogue navigateur native (`alert`, `confirm`, `prompt`)

Objectif UX :
- permettre à l’utilisateur de repartir proprement sur une fiche
- sans ambiguïté avec une suppression
- avec une action volontaire et confirmée

---

## 14. Ce qu’on ne fait pas dans ce chantier

On reporte :
- la vraie validation bloquante des champs
- la définition des champs obligatoires
- la refonte multi-fiches
- la purge profonde de l’ancien batch
- les grands refactors d’architecture non nécessaires au nouveau comportement solo

---

## 15. Découpage recommandé en steps

Vu le risque de casse, je recommande ce phasage.

### Step 1 — Cadrage UI structurel solo
Objectif :
- poser la structure des 4 blocs
- décider lequel est visible selon l’état
- conserver le form replié au lieu de le masquer complètement

Sans encore retravailler finement le contenu des agents/résultats.

### Step 2 — Remplacement du header pipeline
Objectif :
- simplifier la timeline actuelle
- introduire la barre d’état compacte
- garder les états détaillés dans le bloc Pipeline

### Step 3 — Verrouillage / retour édition
Objectif :
- bloquer l’édition pendant run actif
- autoriser le retour en édition sur pause / terminé / erreur
- rendre ce point d’entrée explicite

### Step 4 — Accordéon des 4 blocs
Objectif :
- un seul bloc détaillé ouvert à la fois
- headers repliés riches
- comportement d’ouverture par défaut selon état

### Step 5 — Finition résultats / réseaux sociaux
Objectif :
- faire atterrir proprement le flux sur le bloc Résultat
- rendre les réseaux sociaux secondaires mais accessibles

### Step 6 — Consolidation
Objectif :
- smoke tests
- vérifs de régression
- préparation du report vers DnD

---

## 16. Règles à transmettre aux futurs agents

1. On reste sur le **solo**
2. Le form ne disparaît plus totalement après lancement
3. Le pipeline devient un bloc de la fiche, pas une vue séparée dominante
4. Un seul bloc détaillé ouvert à la fois
5. Le bloc Pipeline reste interactif
6. La progression globale doit être discrète
7. Le résultat devient le focus par défaut après génération
8. L’édition est bloquée pendant run actif
9. Le retour en édition n’est autorisé qu’en pause / terminé / erreur
10. Le reset de fiche doit passer par une vraie modale HTML/CSS/JS
11. Après reset, seul le Formulaire est affiché
12. On steppe le chantier pour limiter les régressions
