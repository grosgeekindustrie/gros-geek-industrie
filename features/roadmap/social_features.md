# Social Features — Spécification complète pour les futurs agents réseaux sociaux

## 1. Objet du document

Ce document sert de **base de référence** pour la future couche Réseaux Sociaux du pipeline local.

Il doit permettre à un futur agent de comprendre :
- la vision produit
- le périmètre fonctionnel
- l’architecture recommandée
- la séparation des responsabilités entre LLM, rendu local et publication
- les objets de données attendus
- les statuts du workflow
- les contraintes UX, techniques et éditoriales
- la feuille de route de mise en œuvre

Ce document doit être considéré comme un **socle de travail** pour la suite du projet.

---

## 2. Vision générale

Le but n’est pas de produire un petit texte isolé par réseau puis de bricoler le reste à la main.

Le but est de transformer le local en **hub social** connecté au pipeline produit.

Le pipeline ne doit plus s’arrêter à :
- titre
- tags
- description
- alt

Il doit pouvoir déboucher aussi sur :
- contenu social maître
- rendu par plateforme
- preview
- validation humaine
- publication immédiate
- programmation
- archivage / historique

### Idée centrale

On ne veut pas :
- un prompt totalement indépendant pour chaque réseau
- un agent qui publie directement sans contrôle
- une logique éditoriale mélangée au code API

On veut :
1. **un package social maître** généré par agent
2. **des renderers par plateforme** côté local
3. **des publishers** séparés, pilotés par le local

---

## 3. Objectifs

### 3.1 Objectifs métier

- Réutiliser immédiatement une fiche produit validée pour créer du contenu social
- Gagner du temps sur la communication produit
- Garder une cohérence de marque sur tous les réseaux
- Réduire les manipulations manuelles répétitives
- Conserver une validation humaine avant publication
- Réutiliser le même contenu maître sur plusieurs plateformes

### 3.2 Objectifs techniques

- Séparer proprement génération, adaptation et publication
- Réduire le coût token en limitant les appels LLM à la seule partie éditoriale forte
- Permettre un fonctionnement local stable, contrôlable et débogable
- Conserver un historique exploitable de tout ce qui a été généré et publié
- Prévoir un système extensible à plusieurs réseaux sans casser l’existant

### 3.3 Objectifs UX

- Génération rapide depuis une fiche produit validée
- Preview simple, lisible, modifiable
- Choix clair du ou des réseaux
- Possibilité de publier maintenant ou programmer
- Visibilité immédiate sur les statuts, erreurs et succès

---

## 4. Périmètre

### 4.1 Inclus

- Génération d’un contenu social maître à partir d’une fiche produit
- Génération FR / EN si nécessaire
- Déclinaison automatique par réseau
- Prévisualisation des posts
- Édition légère avant publication
- Publication locale directe quand possible
- Mode semi-manuel / fallback si la publication directe n’est pas disponible
- Programmation de publication
- Historique et suivi des posts
- Duplication / repost / réutilisation d’un post existant

### 4.2 Hors périmètre initial

- Réponse automatique aux commentaires
- Analyse marketing avancée multi-réseaux
- A/B testing automatique à grande échelle
- Agent autonome qui publie sans validation humaine
- Inbox sociale / social CRM
- Attribution publicitaire ou suivi des conversions avancées

---

## 5. Principe architectural

Le système doit être pensé en **3 couches strictement séparées**.

### 5.1 Couche A — Génération éditoriale

Responsable : **agent LLM social**

Rôle : produire une matière éditoriale centrale, réutilisable.

Cette couche génère :
- hook
- caption longue
- caption courte
- CTA
- hashtags
- angle du post
- variantes linguistiques
- notes d’intention ou d’adaptation

Cette couche ne publie pas.

### 5.2 Couche B — Rendu par plateforme

Responsable : **code local**

Rôle : transformer le contenu maître en version adaptée à chaque plateforme.

Cette couche gère :
- coupes de longueur
- réorganisation du texte
- nombre de hashtags
- format du post
- éventuels préfixes / suffixes / mentions
- rendu d’aperçu

### 5.3 Couche C — Publication / programmation

Responsable : **publisher local**

Rôle :
- publier maintenant
- programmer
- retry en cas d’échec
- journaliser les opérations
- stocker les IDs / URLs de publication

Cette couche ne réécrit pas le contenu.

---

## 6. Source de vérité

La source de vérité du contenu social doit être :
- la fiche produit validée
- les images produit retenues
- les données techniques du listing
- le sculpteur
- les éventuelles sorties validées du pipeline (description, alt, etc.)

Le réseau social ne doit jamais devenir la source de vérité du contenu.

Le contenu social doit être stocké localement dans des objets internes maîtrisés par l’application.

---

## 7. Concept central : `social_post_package`

Le cœur du système est un objet unique :

`social_post_package`

C’est la représentation canonique d’un post avant déclinaison réseau.

### 7.1 Rôle du package

Le package doit contenir :
- l’identité du produit
- les contenus éditoriaux maîtres
- les variantes linguistiques
- les médias associés
- les notes d’adaptation
- l’état du workflow

### 7.2 Exemple de structure

```json
{
  "id": "social_pkg_lieren_75mm_001",
  "listing_id": "lieren_75mm",
  "source_mode": "tabletop",
  "post_family": "product_launch",
  "product": {
    "name": "Lieren",
    "universe": "Fantasy",
    "sculptor": "Nerikson",
    "positioning": "tabletop",
    "version": "MINIATURES",
    "scales": ["75mm"],
    "material": "Résine"
  },
  "media": {
    "selected_media_ids": ["img_1", "img_2", "img_3"],
    "cover_media_id": "img_1"
  },
  "master": {
    "angle": "assassine elfe noire dark fantasy en miniature à peindre",
    "hook": "...",
    "caption_long": "...",
    "caption_short": "...",
    "cta": "...",
    "hashtags": ["...", "..."],
    "artist_tag": "@...",
    "notes": "..."
  },
  "localized": {
    "fr": {
      "hook": "...",
      "caption_long": "...",
      "caption_short": "...",
      "cta": "...",
      "hashtags": ["..."],
      "artist_tag": "@..."
    },
    "en": {
      "hook": "...",
      "caption_long": "...",
      "caption_short": "...",
      "cta": "...",
      "hashtags": ["..."],
      "artist_tag": "@..."
    }
  },
  "platform_notes": {
    "instagram": "...",
    "facebook": "...",
    "x": "...",
    "tiktok": "...",
    "pinterest": "..."
  },
  "workflow": {
    "status": "draft",
    "created_at": "...",
    "updated_at": "...",
    "approved_at": null,
    "published_at": null
  }
}
```

---

## 8. Familles de posts à prévoir

Le système doit pouvoir gérer plusieurs types de campagnes.

### 8.1 `product_launch`

Post standard de lancement produit.

Usage :
- nouvelle figurine
- nouvelle taille
- nouvelle fiche mise en ligne

### 8.2 `product_relaunch`

Post de remise en avant.

Usage :
- remise en avant d’une fiche plus ancienne
- repost saisonnier
- rappel produit après une baisse de visibilité

### 8.3 `comparison`

Comparer :
- deux échelles
- deux usages
- deux variantes
- deux versions d’une même sculpture

### 8.4 `artist_spotlight`

Mettre en avant le sculpteur.

### 8.5 `wip_or_bts`

Behind the scenes / atelier / préparation / impression / finition.

### 8.6 `promo_or_event`

Offre, promo, événement, lancement spécial, période commerciale.

### 8.7 `brand_evergreen`

Post marque, univers, vision, hobby, pas forcément lié à un listing unique.

---

## 9. Workflow complet

### 9.1 Déclenchement

Depuis une fiche validée :
- bouton **Créer contenu social**

### 9.2 Construction du package

Le système récupère les données produit utiles et crée un `social_post_package`.

### 9.3 Génération éditoriale

L’agent social remplit les champs éditoriaux du package.

### 9.4 Rendu réseau

Le local génère les variantes par plateforme.

### 9.5 Preview

L’utilisateur voit :
- texte final
- hashtags
- médias
- ordre des images
- type de post
- version FR / EN

### 9.6 Validation

L’utilisateur peut :
- modifier le texte
- changer les médias
- changer la plateforme ciblée
- approuver
- programmer
- publier immédiatement

### 9.7 Publication

Le publisher local publie ou programme.

### 9.8 Historique

Le package garde la trace de :
- publication réussie
- publication échouée
- tentative(s)
- URL / ID du post si disponible

---

## 10. Statuts à gérer

Statuts minimum :
- `draft`
- `generated`
- `rendered`
- `approved`
- `scheduled`
- `publishing`
- `published`
- `failed`
- `cancelled`

### Transitions recommandées

- draft → generated
- generated → rendered
- rendered → approved
- approved → scheduled
- approved → publishing
- scheduled → publishing
- publishing → published
- publishing → failed
- scheduled → cancelled

---

## 11. Validation humaine

La validation humaine doit être **obligatoire** avant publication.

### Raisons

- éviter les erreurs publiques
- vérifier les médias
- vérifier les mentions et hashtags
- vérifier le ton
- éviter une dérive entre contenu produit et réseau ciblé

### Cas autorisés plus tard

Une automatisation plus forte pourra exister, mais seulement sur des flux très sûrs et explicitement validés.

---

## 12. Renderers par plateforme

Chaque plateforme a son renderer dédié.

### 12.1 Instagram

Formats à prévoir :
- image unique
- carousel
- reel caption

Spécificités :
- hook fort dans les premières lignes
- hashtags utiles mais pas envahissants
- mention du sculpteur si nécessaire
- texte potentiellement plus éditorial
- importance des visuels

### 12.2 Facebook

Spécificités :
- ton un peu plus naturel / conversationnel
- hashtags plus limités
- texte plus explicatif possible
- bon support des liens selon stratégie

### 12.3 X

Spécificités :
- condensation forte
- peu de hashtags
- punch immédiat
- formats très courts privilégiés

### 12.4 TikTok

Spécificités :
- hook très court
- légende simple
- hashtags ciblés
- texte secondaire par rapport au média

### 12.5 Pinterest

Spécificités :
- description plus descriptive et searchable
- logique plus visuelle / SEO
- moins conversationnelle

---

## 13. Publishers locaux

Le système doit séparer :
- génération du texte
- publication réelle

### 13.1 Rôle des publishers

Chaque publisher reçoit :
- texte final
- médias
- schedule éventuel
- paramètres plateforme

Et renvoie :
- succès / échec
- id de publication
- URL si disponible
- message d’erreur
- timestamp

### 13.2 Recommandation de déploiement

Commencer petit :
- d’abord **preview + export/copie manuelle propre**
- ensuite **publication directe** sur un ou deux réseaux seulement
- enfin extension à d’autres plateformes

---

## 14. Stratégie agent / code

### 14.1 Ce qui doit être généré par LLM

- angle éditorial
- hook
- caption longue
- caption courte
- CTA
- hashtags
- variantes linguistiques

### 14.2 Ce qui doit être géré par le code local

- adaptation longueur par réseau
- sélection version longue / courte
- ordre texte / hashtags / mentions
- rendu preview
- publication / scheduling
- stockage / historique / logs

### 14.3 Pourquoi cette séparation

- moins de coût token
- plus de robustesse
- plus de contrôle
- moins d’effets de bord
- meilleure maintenabilité

---

## 15. Types d’agents sociaux à prévoir

### 15.1 Agent `social_master`

Agent principal.

Mission : produire le package social maître à partir d’une fiche produit validée.

Sorties attendues :
- hook
- caption longue
- caption courte
- CTA
- hashtags
- angle éditorial
- variantes FR / EN si utile

### 15.2 Agents spécialisés optionnels

À envisager plus tard si besoin réel :
- `social_instagram`
- `social_facebook`
- `social_x`
- `social_tiktok`
- `social_pinterest`

Mais idéalement, ces spécialisations doivent rester **minimales**. Le rendu local doit faire le gros du travail d’adaptation.

---

## 16. Structure de données recommandée côté projet

```text
social/
  prompts/
    social_master.md
    instagram.md
    facebook.md
    x.md
    tiktok.md
    pinterest.md

  js/
    social_package_builder.js
    social_renderers.js
    social_publishers.js
    social_scheduler.js
    social_storage.js
    social_queue.js
    social_ui.js
    social_validators.js
    social_history.js

  data/
    drafts/
    scheduled/
    published/
    failed/
```

---

## 17. UI locale recommandée

### 17.1 Entrée

Depuis une fiche produit validée :
- bouton **Créer contenu social**

### 17.2 Écran principal social

Sections recommandées :
- identité du produit
- visuels sélectionnés
- package maître
- variantes par plateforme
- preview
- scheduling / publication
- historique

### 17.3 Actions utilisateur

- générer
- régénérer
- éditer
- sélectionner images
- choisir réseau
- approuver
- publier maintenant
- programmer
- copier le texte
- exporter le package

---

## 18. Scheduling / programmation

### 18.1 Minimum viable

Permettre :
- publication immédiate
- programmation à date/heure

### 18.2 Évolutions possibles

- calendrier hebdo
- file multi-posts
- règles simples d’espacement
- rappels de validation

### 18.3 Principes

- le scheduling ne doit pas modifier le contenu
- il ne fait qu’orchestrer le moment de publication
- il doit être journalisé proprement

---

## 19. Logs et historique

Le système doit garder :
- package source
- rendu par plateforme
- médias utilisés
- statut courant
- historique des tentatives
- erreurs de publication
- id/url de post si disponible
- timestamps de création, approbation, programmation et publication

### Utilité

- débug
- repost
- duplication
- correction
- audit rapide

---

## 20. Sécurité et credentials

Les accès API réseaux ne doivent jamais être codés en dur dans le code source.

### Recommandations

- `.env` local
- secrets séparés par plateforme
- stockage chiffré si possible
- journaliser sans exposer les credentials
- messages d’erreur propres

---

## 21. Gestion d’erreurs

Erreurs à prévoir :
- contenu vide ou invalide
- média manquant
- média refusé par la plateforme
- token expiré
- API indisponible
- longueur non conforme
- quota dépassé
- publication partielle

### Bon comportement

- ne pas perdre le package
n- garder les logs
- conserver l’état `failed`
- proposer retry
- permettre correction manuelle

---

## 22. Règles éditoriales globales

Les futurs agents sociaux doivent respecter la ligne éditoriale de la marque.

### Principes

- ton premium sans bullshit
- désir visuel sans exagération creuse
- valorisation du sculpteur
- angle produit clair
- CTA doux
- cohérence avec Etsy et la marque

### À éviter

- survente
- urgence artificielle
- promesses creuses
- jargon social inutile
- formatage trop automatique d’une plateforme à l’autre

---

## 23. Données d’entrée pour `social_master`

L’agent social maître devrait recevoir au minimum :
- nom du produit
- univers
- sculpteur
- type de produit
- usage (tabletop / vitrine / hybride si utile)
- description validée
- éléments techniques clés
- visuels sélectionnés
- angle marketing si déjà défini
- langue(s) souhaitée(s)
- famille de post

---

## 24. Contenus de sortie attendus du `social_master`

Le package doit idéalement contenir :

### Champ éditorial principal
- `master_angle`

### FR
- `hook`
- `caption_long`
- `caption_short`
- `cta`
- `hashtags`
- `artist_tag`

### EN
- `hook`
- `caption_long`
- `caption_short`
- `cta`
- `hashtags`
- `artist_tag`

### Notes
- `platform_notes`
- `media_suggestion`
- `post_family`

---

## 25. Prévisualisation

La preview doit être pensée comme un vrai outil de décision.

### La preview doit montrer
- texte rendu final
- coupe éventuelle
- médias sélectionnés
- ordre du carrousel
- hashtags finaux
- mentions / tags
- avertissements éventuels

### La preview doit permettre
- éditer avant publication
- changer de réseau
- changer la version courte / longue
- permuter les médias
- désactiver certains hashtags

---

## 26. MVP recommandé

### Phase 1 — contenu seulement
- génération du package maître
- preview
- copie manuelle
- export Markdown / JSON

### Phase 2 — rendu réseau
- render Instagram
- render Facebook
- render X

### Phase 3 — publication directe
- publication immédiate depuis le local
- scheduling simple
- historique de base

### Phase 4 — montée en puissance
- TikTok
- Pinterest
- queue
- retry
- duplication de campagnes

---

## 27. Ce qu’il ne faut pas faire

- ne pas coupler génération éditoriale et publication dans une même fonction
- ne pas publier sans preview
- ne pas multiplier les prompts très divergents par réseau si le code peut adapter
- ne pas laisser l’API réseau devenir la source de vérité
- ne pas rendre le système trop magique ou opaque
- ne pas perdre l’historique local

---

## 28. Recommandation finale d’architecture

La meilleure approche pour le projet est :

### Les agents font
- l’idée
- l’angle
- la matière éditoriale

### Le local fait
- l’adaptation réseau
- la preview
- la validation
- la publication
- le scheduling
- le stockage
- l’historique

C’est le meilleur compromis entre :
- qualité
- coût token
- robustesse
- contrôle
- évolutivité

---

## 29. Résumé ultra court

Le futur système social doit fonctionner comme ceci :

**fiche produit validée**  
→ **package social maître**  
→ **rendu par plateforme**  
→ **preview**  
→ **validation humaine**  
→ **publication locale / programmation**  
→ **historique et logs**

Le cœur du système n’est pas la publication directe par l’agent.  
Le cœur du système est le **package social maître**, réutilisable et décliné proprement par le local.
