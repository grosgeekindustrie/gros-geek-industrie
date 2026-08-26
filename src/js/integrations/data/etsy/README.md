# Etsy Data

Ce dossier contient uniquement des helpers purs et idempotents pour Etsy.

## Contenu

- `listing_data.js`
  - normalisation de payload listing
  - construction des drafts details/options
- `taxonomy_data.js`
  - normalisation et helpers de taxonomie
- `options_data.js`
  - variations, combinaisons, inventory, money helpers

## Regles

- aucun acces DOM
- aucun bind d'evenement
- aucun effet de bord runtime
- transformations rejouables sans casser l'etat

## Quand ajouter ici

Ajoutez ici toute logique Etsy qui peut etre testee sans navigateur ni etat workspace.
