# Handoff Refonte Moderne - prochain fil

Date: 2026-04-27  
Branche: `bootstrap`  
Objectif: reprendre la roadmap `features/roadmap/refonte_moderne.md` sans recharger tout l'historique du fil.

## 1) Etat global

- Step `bootstrap / contracts / legacy cleanup`: termine.
- Step `audit / purge vivant / legacy / mort`: termine.
- Correctifs hors-roadmap recents deja traites:
  - harmonisation des echelles dynamiques TT/COL + toggle dans le stepper
  - fix regression `switchMode` (null-safe sur les boutons mode)

## 2) Commits recents utiles

- `831f9bd` Guard shell mode toggle elements
- `15c4cde` Harmonize dynamic scale workflow
- `b098de8` Trim target runtime export surface
- `ef019b5` Trim runtime feature exports
- `26e1caa` Trim utility runtime helper exports
- `c8227f3` Trim shared UI helper exports
- `0e766c2` Trim unused stepper and rules exports

## 3) Fichiers touches dans le dernier lot echelles

- `src/js/shared/media/echelles_ui.js`
- `src/js/pipeline/ui/shared/forms_ui.js`
- `src/etsy-pipeline-dnd-v1_2.html`
- `src/css/04-form-layout.css`

## 4) Contrainte de run pour le prochain fil

- Avancer par lots transverses coherents (pas de micro-patch mono-fichier).
- Commiter en fin de lot sans attendre validation intermediaire.
- Resume court a chaque checkpoint.
- Ne pas relancer des refactors bootstrap deja clos, sauf bug.

## 5) Point d'attention

- Si un changement casse la home/shell, prioriser un fix court immediat puis reprendre la roadmap.
- Garder la surface globale `window` en reduction progressive, sans casser les callsites HTML existants.

## 6) Prochain axe recommande (roadmap globale)

Reprendre `refonte_moderne.md` sur le bloc suivant:

1. conventions transverses restantes (naming/contracts/labels)
2. homogenisation technique des modules vivants encore heterogenes
3. checkpoint de statut global `fait / partiel / a faire` apres ce bloc

## 7) Definition de done pour le prochain bloc

- Pas de regression shell/home/pipeline visible.
- `node --check` passe sur tous les JS touches.
- 1 commit checkpoint propre par lot.
- topo court de progression roadmap en fin de lot.

