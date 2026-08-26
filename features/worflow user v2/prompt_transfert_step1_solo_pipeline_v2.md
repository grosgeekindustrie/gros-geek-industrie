# Prompt de transfert — Step 1 UX solo V2

Tu reprends le projet **Etsy Pipeline**.

## Règles absolues
- Les **fichiers locaux fournis dans le message courant** sont la seule source de vérité.
- Le repo distant sert uniquement à comprendre l’architecture globale.
- Si une pièce manque, tu t’arrêtes.
- Tu ne supposes rien depuis un ancien snapshot.
- Avant patch :
  1. lister les fichiers réellement utilisés,
  2. verrouiller les hashes avec `git hash-object --no-filters`,
  3. confirmer le périmètre exact,
  4. seulement ensuite générer un vrai patch git dans `patch/git/...`
- Pas de script Python de transformation pour modifier le projet.
- Toujours vérifier `git apply --check` avant livraison.
- `node --check` sur les JS touchés si pertinent.

## Contexte produit validé
Le chantier multi-fiches / batch visuel a été **mis de côté**.
La décision prise est de **consolider le mode solo** d’abord, car c’est plus sain, plus court, et moins risqué.

Le solo doit évoluer selon ce cadrage UX :
- le form ne disparaît plus complètement au lancement du pipeline ;
- il se replie ;
- la fiche vit dans un cycle unique : **édition → pipeline → résultat → réseaux sociaux** ;
- il y a **4 blocs** :
  1. Formulaire
  2. Pipeline
  3. Résultat
  4. Réseaux sociaux
- **un seul bloc détaillé ouvert à la fois** ;
- les autres restent repliés avec header informatif ;
- la timeline actuelle du header avec les noms des agents est jugée trop ostentatoire ;
- elle doit tendre vers une **barre d’état compacte** et sobre ;
- le bloc Pipeline reste interactif ;
- l’édition est bloquée pendant un run actif ;
- retour en édition autorisé seulement si :
  - pause
  - terminé
  - erreur
- après génération terminée :
  - Formulaire replié
  - Pipeline replié
  - Résultat visible
  - Réseaux sociaux repliés
- sur nouvelle fiche : seul le Formulaire est visible.

Un bouton **Reset de fiche** est aussi prévu :
- ce n’est pas une suppression ;
- il remet toute la fiche à zéro ;
- confirmation via vraie modale HTML/CSS/JS ;
- jamais via une boîte navigateur native ;
- après reset, **seul le Formulaire est affiché**.

## Step à traiter maintenant
On passe au **Step 1 — Cadrage UI structurel solo**.

### Objectif exact du Step 1
- poser la structure des **4 blocs** dans le solo ;
- décider lequel est visible selon l’état ;
- conserver le form **replié** au lieu de le masquer complètement ;
- ne pas encore refaire finement les agents / résultats / réseaux sociaux ;
- ne pas encore traiter le remplacement complet du header pipeline ;
- ne pas encore attaquer les validations métier.

### Intention du Step 1
Le Step 1 doit surtout :
- faire sauter la logique binaire actuelle “vue form / vue pipeline” ;
- installer la structure de la fiche solo comme espace unique ;
- préparer les steps suivants sans gros refactor brutal.

## Style de code attendu
Le projet veut désormais des pratiques modernes :
- CSS en **rem** par défaut, pas en px sauf exception justifiée ;
- JS lisible et moderne ;
- fonctions fléchées quand approprié ;
- `const` / objets / tableaux déclarés proprement ;
- HTML / CSS / JS propres et lisibles ;
- ne toucher au legacy que localement et prudemment.

## Ce qu’il faut demander avant patch
Pour démarrer Step 1, demande uniquement les fichiers locaux **réellement nécessaires** au solo :
- le HTML actif
- les CSS qui pilotent la vue form / pipeline / layout solo
- les JS UI réellement impliqués dans la bascule actuelle form → pipeline et dans l’affichage des sorties

Ne sous-estime pas la transversalité.
Ne pars pas d’un souvenir de conversation.
