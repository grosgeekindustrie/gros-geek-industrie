# Audit UX et CSS — Gros Geek Industrie

Date de référence : 21 août 2026  
Périmètre : application complète (`Home`, pipelines Tabletop et Collection, exécution, traductions, Pinterest, studio social, intégrations, calculateur, réglages et lightboxes).

## Décision

La refonte ne sera pas menée écran par écran avec des styles locaux supplémentaires. Le laboratoire accessible depuis la tuile **Design System** sert de contrat visuel avant toute migration.

Les règles du laboratoire sont isolées sous `.design-system-workspace` et le préfixe `.ds-`. Elles ne remplacent aucune règle historique tant que les composants n’ont pas été validés.

## État actuel

- 14 feuilles CSS avant le laboratoire.
- Environ 197,6 Ko de CSS historique.
- Les plus gros blocs sont `04-form-layout.css` (46,7 Ko), `11-instagram-test.css` (35,1 Ko), `02-ui-pro.css` (29,9 Ko) et `01-legacy-base.css` (22,8 Ko).
- 15 déclarations `!important`.
- 8 attributs `style` résiduels dans le document HTML principal.
- Un document HTML central de plus de 2 700 lignes porte plusieurs applications internes.
- Les variables de thème existent déjà dans `00-var.css`, ce qui constitue une bonne fondation.

## Risques confirmés

### Cascade et redéfinitions

Plusieurs composants transverses sont définis dans plusieurs couches :

- `.btn` : base legacy puis redéfinition UI Pro ;
- `.home-card` : base legacy puis UI Pro et variantes de fonctionnalités ;
- `.form-section` : base legacy, UI Pro et variantes de stepper ;
- `.agent-card` : base legacy puis UI Pro ;
- `.output-box` : base legacy puis UI Pro ;
- `.collection-stepper-pill` : deux générations dans le même fichier ;
- `.app-header` : base legacy, UI Pro et couche header dédiée ;
- champs `.fg input`, `.fg select`, `.fg textarea` : base legacy puis UI Pro et nombreuses variantes locales.

Une modification d’un sélecteur générique peut donc affecter plusieurs vues sans que le fichier modifié semble lié à ces vues.

### Couplage JavaScript / présentation

L’application récente utilise majoritairement des attributs fonctionnels (`data-js`, `data-ui-action`, `data-pipeline-action`, attributs propres aux fonctionnalités). C’est la voie à généraliser.

Des classes restent néanmoins manipulées ou générées par JavaScript :

- états génériques : `.active`, `.visible`, `.is-active`, `.is-current`, `.is-complete`, `.is-hidden` ;
- agents : `.agent-card`, `.agent-status`, `.output-box` ;
- médias : `.image-thumb-*`, classes Sortable ;
- réseaux sociaux : états Instagram et Pinterest ;
- modales : `.visible`, `.is-visible` et classes placées sur `body`.

Règle de migration : aucune classe historique n’est renommée ou supprimée avant une recherche dans tout `src/js`. Les nouveaux hooks fonctionnels devront être des attributs `data-*`; les classes devront redevenir purement visuelles.

### Thèmes

Les thèmes actuels reposent sur deux axes qui se recouvrent :

- `body.mode-collection` change encore les couleurs du mode Collection ;
- `body.shop-doublex` change les couleurs de la boutique active.

À terme, Tabletop et Collection ne doivent plus constituer deux chartes. La boutique choisit la charte ; le mode choisit uniquement le contenu et éventuellement une icône ou un libellé.

## Fondations proposées

### Tokens sémantiques

Le design system ne doit pas demander « quelle couleur utiliser ? », mais « quel rôle joue cette couleur ? » :

- canvas ;
- surface ;
- surface surélevée ;
- bordure discrète et bordure forte ;
- texte principal, secondaire et atténué ;
- accent de marque et accent secondaire ;
- succès, information, avertissement et danger ;
- ombres, rayons, espacements et typographie.

La charte Gros Geek et la charte DoubleX fourniront seulement les valeurs de ces rôles.

### Typographie

- Police display : titres majeurs et noms de sections.
- Police système lisible : contenu, formulaires et actions.
- Monospace : identifiants, métriques, coûts, statuts techniques et petites étiquettes.
- Le monospace ne doit plus porter tous les paragraphes de l’application.

### Densité

- Une densité confortable par défaut.
- Des composants compacts uniquement pour les barres d’outils et tableaux denses.
- Textareas longues ouvertes par défaut, redimensionnables ou auto-ajustées.
- Une action primaire maximum par panneau.

## Catalogue initial des composants

1. Boutons : primaire, secondaire, discret, succès, danger, désactivé et trois tailles.
2. Formulaires : input, recherche, select, textarea, erreur, aide, checkbox, radio, toggle et compteur numérique.
3. Navigation : breadcrumb, tabs, stepper et navigation latérale.
4. Feedback : status pills, alertes, progression, toast et dialogue de confirmation.
5. Surfaces : panneau, carte interactive, carte sélectionnée et zone technique.
6. Données : tableau, ligne mise en avant, valeur monétaire et statut.

Ces composants sont visibles dans le laboratoire `#design-system`.

## Architecture de migration

### Phase 0 — Laboratoire

- Valider visuellement les deux chartes.
- Corriger les composants sans toucher à la production.
- Définir les états clavier, hover, focus, disabled, erreur et chargement.

### Phase 1 — Fondation globale

- Stabiliser les tokens dans `00-var.css`.
- Introduire des couches explicites : tokens, reset, primitives, composants, layouts, fonctionnalités, compatibilité legacy.
- Ne modifier aucun comportement JavaScript.

### Phase 2 — Composants transverses

- Header et navigation.
- Boutons et champs.
- Panneaux, cartes, badges, alertes et modales.
- Tableaux et zones de sortie.

Une seule migration de composant doit bénéficier simultanément à Tabletop, Collection et aux outils qui utilisent ce composant.

### Phase 3 — Layouts métier

- Home.
- Formulaire et exécution pipeline.
- Traductions.
- Social Network et Pinterest.
- Intégrations et réglages.

### Phase 4 — Nettoyage

- Prouver qu’une règle n’est plus utilisée avant suppression.
- Retirer les doublons et les `!important` progressivement.
- Déplacer les derniers styles inline.
- Ajouter une vérification visuelle des routes principales.

## Critères de sécurité

- Les IDs et attributs `data-*` fonctionnels restent stables.
- Une migration ne mélange pas refonte CSS et logique métier.
- Chaque famille de composants est vérifiée sous Gros Geek et DoubleX.
- Tabletop et Collection sont testés après chaque composant transverse.
- Les routes Home, pipeline, traductions, Pinterest, Instagram, calculateur et réglages sont contrôlées.
- Le commit `58996f3` reste le point de restauration précédant le chantier de design system.

