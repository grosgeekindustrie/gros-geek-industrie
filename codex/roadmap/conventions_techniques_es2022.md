# Conventions techniques ES2022 (courtes)

## Objectif

Garder une base lisible, stable et patchable pendant la refonte moderne.

## Règles de code

- ES2022 minimum sur tout nouveau code.
- `const` par défaut, `let` seulement si mutation réelle.
- Fonctions petites, centrées sur une responsabilité.
- Early return pour éviter les blocs imbriqués.
- Nommage explicite (pas d’abréviations ambiguës).
- Pas de nouvelle chaîne magique si une constante partagée existe.

## Règles runtime / UI

- La logique métier reste dans les modules runtime, pas dans les handlers UI.
- Les accès DOM sont guardés quand un nœud peut manquer selon la vue.
- Les erreurs doivent être contextualisées (agent, préfixe, étape) pour faciliter le debug.
- Aucun fallback legacy ajouté sans justification explicite.

## Règles structurelles

- Un module = un rôle principal (`ui`, `runtime`, `data`, `service`, `shared`).
- `shared` ne dépend pas de `pipeline` ni `social`.
- Pas de dépendances circulaires entre domaines.

## Règles patch

- Travailler par lots cohérents et testables.
- Éviter les patchs “style only” sur de gros périmètres.
- Avant suppression: confirmer `mort` via scan usages + flux vivant.
- Après patch: mini non-régression locale (`rg` ciblé + diff lisible).

## Do / Don’t

- Do: corriger les points fragiles à fort impact (guard, état, erreurs, ordre de chargement).
- Do: documenter les conventions quand elles guident plusieurs lots.
- Don’t: réintroduire du batch ou des chemins compat obsolètes.
- Don’t: mélanger refonte structurelle, logique métier et nettoyage massif dans un seul patch.
