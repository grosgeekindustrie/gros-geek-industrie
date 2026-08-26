# Agent Guidelines

## Objectif
Ce document cadre les interventions des agents sur le projet Etsy Pipeline.

Le but est de garder une base propre, stable, lisible, et prête à évoluer vers la production.

## 1. Règle générale
Toujours privilégier :
- des patchs ciblés
- des changements lisibles
- un impact limité
- la stabilité visuelle et fonctionnelle

Ne jamais lancer de refactor large non demandé.


### 1.1 Règle de priorité
Quand une règle ancienne du projet entre en tension avec une règle plus récente explicitement ajoutée dans les docs :
- la **règle la plus récente** prévaut ;
- elle s’applique surtout aux **nouveaux développements** ;
- le legacy existant n’est pas réécrit globalement pour “rattraper” cette nouvelle norme.

### 1.2 Modern first / legacy by exception
À partir de maintenant :
- toute **nouvelle feature** doit tirer le projet vers une écriture plus moderne et plus lisible ;
- le legacy n’est modifié que **localement**, dans la zone réellement touchée ;
- on ne réécrit pas un bloc legacy stable uniquement pour le moderniser ;
- on n’ajoute plus de nouvelle dette “old school” par habitude.

## 2. Principes d’architecture
- `pipeline-ui.js` reste un orchestrateur.
- La logique doit rester distribuée dans `src/js/ui/`.
- Un module JS = une responsabilité dominante.
- `pipeline-api.js` gère les appels API et le pilotage d’exécution réseau/pipeline.
- Le HTML conserve les hooks legacy existants tant qu’ils ne sont pas migrés proprement.
- Le CSS actif est réparti dans `src/css/`.
- Ne pas recréer de gros fichier CSS actif monolithique.

## 3. Legacy vs nouvelle norme
- Le legacy existant peut rester tant qu’il fonctionne.
- Aucune nouvelle feature ne doit réutiliser les mauvaises habitudes legacy.
- Toute zone legacy peut être migrée localement si elle est réellement touchée par le patch.
- Ne jamais lancer un “grand nettoyage opportuniste” juste parce qu’une zone semble ancienne.
- La règle projet est simple :
  - legacy toléré
  - nouvelle dette interdite
  - migration progressive uniquement quand on touche la zone

## 4. Règles HTML
- Ne pas renommer un `id` existant sans audit complet d’impact JS.
- Ne pas modifier l’ordre DOM si cela peut casser les injections ou déplacements dynamiques.
- Garder les blocs Tabletop et Collection séparés tant qu’aucune abstraction stable n’a été validée.
- Tout nouveau bloc HTML doit être lisible, multi-lignes, et structuré clairement.
- Éviter les `onclick` inline pour les nouveaux développements.
- Les `onclick` legacy peuvent rester tant qu’ils ne sont pas migrés proprement.

## 5. Règles CSS
- Les classes servent au style uniquement.
- Pas de CSS mono-ligne.
- Respecter le découpage actuel dans `src/css/`.
- Ne pas déplacer une règle entre fichiers sans raison claire.
- `06-inline-merged.css` est un résidu temporaire : ne pas y ajouter de nouvelles règles sauf nécessité exceptionnelle et documentée.
- Ne pas réintroduire de styles inline dans le HTML.
- Une nouvelle feature UI doit choisir un fichier CSS principal clair.
- Éviter de disperser une même feature CSS dans plusieurs fichiers sans raison réelle.

## 6. Règles JS
- Ne pas utiliser les classes CSS comme hooks JS pour les nouvelles features.
- Ne pas utiliser les `id` comme hooks JS pour les nouveaux développements, sauf contrainte legacy forte.
- Pour tout nouveau hook JS, utiliser `data-js="..."`.
- Les classes restent la source de vérité du style.
- Les attributs `data-*` servent aux intentions, rôles et hooks stables.
- Ne pas recentraliser de logique métier dans `pipeline-ui.js`.
- Une nouvelle feature JS doit avoir un module dominant clair.
- Ne pas ajouter une logique “un peu partout” jusqu’à ce que ça marche.

## 7. Convention cible pour les nouveaux développements
Exemple de structure :

`<div class="agent-card" data-agent="social" data-view="tt">`
`  <button class="btn btn-accent" data-js="run-social">▶ Générer</button>`
`</div>`

Règle :
- CSS → `.agent-card`, `.btn`, `.btn-accent`
- JS → `[data-js="run-social"]`

## 8. Règles de commentaires
- Commenter les blocs, pas chaque ligne.
- Commenter les contrats, dépendances, zones fragiles et comportements implicites.
- Commenter les zones injectées, déplacées ou pilotées par JS.
- Ne pas écrire de commentaires décoratifs qui répètent simplement le code.
- Toute zone temporaire doit être explicitement documentée :
  - pourquoi elle existe
  - où elle doit finir
  - si on peut encore y ajouter des choses ou non

## 9. Documentation des features
- Pendant le développement : documenter seulement le contrat minimal.
- Quand la feature est validée : ajouter une doc locale courte si elle crée un flux, une convention ou un module réutilisable.
- Une règle ne rejoint la doc d’architecture ou les standards qu’après stabilisation.
- On documente tout de suite ce qui évite de casser.
- On documente durablement ce qui a prouvé qu’il allait rester.

## 10. Règles de patch et de validation
- Un patch = un objectif dominant.
- Ne jamais supposer qu’un patch précédent est déjà appliqué.
- Toujours travailler à partir des fichiers réellement fournis ou d’un état confirmé.
- Si l’UI est touchée : check visuel obligatoire.
- Si le DOM est touché : vérifier les hooks JS.
- Si le CSS est touché : vérifier les thèmes Tabletop / Collection.
- Si une feature touche plusieurs couches, le patch doit rester cadré et lisible.

## 11. Obligatoire
- Travailler à partir de l’état réel du code, jamais d’un état supposé.
- Garder `pipeline-ui.js` comme orchestrateur.
- Garder la logique métier/UI répartie dans `src/js/ui/`.
- Utiliser `data-js` pour tout nouveau hook JS.
- Garder les classes pour le style et le layout.
- Écrire le HTML et le CSS en multi-lignes lisibles.
- Commenter les contrats de blocs, zones sensibles et conventions temporaires.
- Faire un patch avec un objectif dominant clair.
- Faire un check visuel dès qu’une couche UI est touchée.
- Respecter le split CSS actuel dans `src/css/`.
- Documenter minimalement toute nouvelle convention qui risque de survivre à la feature.

## 12. Interdit
- Recentraliser de la logique dans `pipeline-ui.js`.
- Utiliser une classe CSS comme hook JS pour une nouvelle feature.
- Utiliser un `id` comme hook JS pour une nouvelle feature, sauf contrainte legacy forte.
- Réintroduire des styles inline dans le HTML.
- Recréer un gros fichier CSS actif monolithique.
- Lancer un refactor large non demandé.
- Renommer massivement des `id`, classes ou clés d’état sans audit d’impact.
- Mélanger style, structure et comportement dans un même patch sans le cadrer.
- Ajouter de nouvelles règles dans `06-inline-merged.css` sauf exception documentée.
- Supposer qu’un ancien patch est appliqué sans vérification.
- Toucher à l’ordre DOM ou à l’ordre de chargement sans raison claire et documentée.

## 13. Toléré temporairement
- Les `onclick` inline legacy.
- Les `id` legacy déjà câblés côté JS.
- Les sélecteurs JS legacy fondés sur `id` ou structure DOM existante.
- Le contenu résiduel de `06-inline-merged.css`.
- Les zones HTML dupliquées Tabletop / Collection tant qu’aucune abstraction stable n’a été validée.
- Les morceaux runtime encore présents dans `pipeline-api.js` tant qu’une migration claire n’a pas été décidée.
- Les conventions historiques du projet, tant qu’elles ne sont pas réutilisées pour de nouveaux développements.

## 14. Règle de migration
- On ne casse pas le legacy juste pour “faire propre”.
- On n’ajoute plus de nouvelle dette legacy.
- On migre seulement la zone qu’on touche.
- Toute migration doit rester locale, lisible et vérifiable.

## 15. Checklist avant livraison
- patch ciblé
- diff relu
- check visuel si UI touchée
- aucun hook cassé
- aucun renommage non documenté
- commentaires ajoutés si nouvelle zone sensible
- nouvelle feature alignée sur les conventions modernes si la zone n’est pas purement legacy
- erreur exploitable remontée si un nouveau flow async est touché
