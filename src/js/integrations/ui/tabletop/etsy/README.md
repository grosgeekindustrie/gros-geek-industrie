# Etsy Tabletop UI

Bootstrap Etsy pour le contexte `tabletop`.

## Role

- trouver le panel tabletop
- deleguer l'init au runtime/facade Etsy
- ne pas embarquer de logique metier Etsy supplementaire

Si une logique devient partagee avec `collection`, elle doit remonter vers `ui/shared/etsy` ou `runtime/etsy`.
