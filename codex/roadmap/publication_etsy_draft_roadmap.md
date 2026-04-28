# Roadmap — Publication Draft Etsy

## Statut

Roadmap de cadrage pour la future feature **Publication Draft Etsy** du projet Etsy Pipeline.

Cette roadmap doit être lue avec la roadmap Localisation.

Ordre fonctionnel validé :

```text
PIPE
↓
LOCALISATION
↓
PUBLICATION DRAFT ETSY
```

La publication ne doit donc intervenir qu'après validation de la fiche FR et de la localisation EN.

---

## Objectif produit

Créer un **brouillon Etsy complet** à partir d'une fiche pipeline localisée, sans jamais publier automatiquement une fiche active.

La V1 doit permettre :

```text
Fiche FR validée
+
Fiche EN validée
+
Médias globaux
+
Paramètres marketplace Etsy
↓
Création d'une draft Etsy
```

La validation finale et la mise en ligne restent manuelles dans Etsy.

---

## Principe de sécurité

La publication V1 n'est pas une publication réelle.

Elle doit uniquement créer un brouillon.

Interdictions V1 :

```text
pas de state=active
pas de publication automatique
pas d'update de fiche active
pas de delete API
pas d'import catalogue complet
pas d'explorateur de boutique
```

Si une draft créée est mauvaise, elle sera supprimée ou corrigée manuellement dans Etsy.

---

## Périmètre V1

### Inclus

- création de draft uniquement
- contenu FR + EN
- template listing par URL ou ID
- lecture d'une seule fiche template
- médias : images + vidéo
- ALT globales
- variations / pricing / SKU
- contraintes marketplace Etsy
- review finale avant création draft

### Exclu

- update draft existante
- update active listing
- publish active
- delete via API
- import catalogue
- listing browser Etsy
- multi-marketplace eBay
- DE / ES / IT

---

## READ template — décision importante

Le READ n'est pas un import catalogue en V1.

Il est limité à une lecture de fiche modèle.

### Pourquoi

Le workflow réel part souvent d'une copie de fiche existante.

Mais lire toute la boutique impliquerait une UI lourde :

- liste des fiches
- recherche
- filtres
- classement
- pagination
- choix de template
- états active/draft/expired

Ce chantier est explicitement hors V1.

### Solution V1

Sélection manuelle du template :

```text
URL Etsy de la fiche modèle
ou
listing_id
```

Puis :

```text
Lire uniquement ce listing
↓
Extraire les paramètres marketplace utiles
↓
Préremplir l'UI publication
↓
Créer une nouvelle draft avec le contenu pipeline/localisation
```

### Règle absolue

Le template peut préremplir les contraintes marketplace, mais ne doit jamais écraser le contenu éditorial validé.

Toujours remplacés par le pipeline/localisation :

- titre FR
- description FR
- tags FR
- titre EN
- description EN
- tags EN
- images produit
- vidéo produit
- ALT produit

Réutilisables depuis le template :

- taxonomy/category
- shipping profile
- processing profile
- who_made
- when_made
- is_supply
- type physique/digital
- variations si structure compatible
- prix par défaut
- quantité par défaut
- SKU pattern si pertinent
- matériaux / attributs si compatibles

À valider manuellement :

- prix
- quantité
- variations
- SKU
- catégorie exacte
- attributs marketplace
- profils livraison / processing

---

## Stepper Publication

La publication doit probablement prendre la forme d'un **stepper** plutôt qu'une grande page unique.

Une spec UX/UI dédiée sera faite plus tard, mais le flow produit est validé ici.

### Précondition

Avant d'entrer dans le stepper :

```text
FR validé
EN validé
```

Si EN n'est pas validé, le stepper peut s'ouvrir mais doit afficher un warning bloquant ou fort selon décision UX future.

---

## Step 1 — Titres / tags / contenu

Objectif : vérifier le contenu éditorial qui sera envoyé vers Etsy.

Champs affichés :

```text
Titre FR
Tags FR
Description FR
Titre EN
Tags EN
Description EN
```

Règles :

- champs éditables ou en lecture avec retour vers localisation selon choix UX futur
- affichage des limites Etsy si connues
- warning si tags manquants / trop nombreux / trop longs
- warning si EN stale

Ce step ne gère pas les contraintes marketplace.

---

## Step 2 — Images / vidéo / ALT

Objectif : préparer le manifest média.

V1 médias :

```text
jusqu'à 20 images
1 vidéo
ALT produit globale
ALT images informatives globales
```

Décisions :

- les images informatives sont globales
- pas de version FR/EN des images informatives en V1
- les ALT ne sont pas localisées en V1
- une ALT produit globale peut s'appliquer aux images produit
- chaque image informative peut avoir une ALT globale propre

Types d'images :

```text
product
informative
variation
```

La catégorie `variation` est importante pour préparer l'association photos/variations.

Concept manifest :

```js
const mediaManifest = {
  images: [
    {
      slot: 1,
      type: 'product',
      file: '...',
      altTextKey: 'product'
    },
    {
      slot: 8,
      type: 'informative',
      preset: 'scaleGuide',
      altTextKey: 'scaleGuide'
    }
  ],
  video: {
    file: '...',
    enabled: true
  }
};
```

---

## Step 3 — Variations / pricing / SKU

Objectif : préparer la partie commerciale de la fiche.

Champs possibles :

```text
variations
prix par variation
quantité par variation
SKU par variation
image associée à une variation
```

Cas métier connus :

```text
échelles : 28mm / 32mm / 75mm / 90mm / 140mm
pricing FR / US / autres si nécessaire
stock par variation
SKU selon gamme / sculpteur / taille
```

Ce step est sensible, car une erreur peut créer une fiche vendable mais incorrecte.

Règles :

- préremplir depuis le template quand c'est compatible
- afficher clairement les variations reprises du template
- permettre d'ajuster prix / stock / SKU
- ne pas masquer les valeurs critiques
- prévoir l'association image ↔ variation

Architecture :

```text
Données internes produit
↓
Mapping variations Etsy
↓
Offerings / price / quantity / SKU
```

---

## Step 4 — Contraintes marketplace Etsy

Objectif : gérer les champs spécifiques à Etsy.

Champs principaux :

```text
template listing URL / ID
taxonomy / category
shipping profile
processing profile
shop section
who_made
when_made
is_supply
physical/digital
materials
attributes Etsy obligatoires
```

Ce step doit être conçu comme une UI spécifique Etsy.

Important : si plus tard une intégration eBay existe, elle aura son propre adapter et ses propres contraintes.

Le modèle interne ne doit donc pas être pollué partout par des champs Etsy.

Architecture attendue :

```text
InternalListing
↓
EtsyPublicationSettings
↓
EtsyDraftPayload
```

---

## Step 5 — Review / Create Draft

Objectif : dernier contrôle avant appel API.

Résumé affiché :

```text
FR OK / EN OK
nombre de tags FR / EN
nombre d'images
vidéo oui/non
ALT présentes
variations OK
pricing OK
template chargé OK
contraintes marketplace OK
warnings restants
```

Bouton final :

```text
Créer brouillon Etsy
```

Ne jamais utiliser le libellé `Publier` pour cette action.

Après succès :

```text
Draft créée
Lien Etsy vers la draft
Contrôle final manuel dans Etsy
Publication manuelle depuis Etsy
```

---

## Modes techniques

V1 recommandée :

```text
DRY_RUN
DRAFT_CREATE
```

### DRY_RUN

Construit le payload complet, affiche/log le résultat, mais n'appelle pas l'API d'écriture.

### DRAFT_CREATE

Crée une nouvelle draft Etsy.

### Plus tard

```text
DRAFT_UPDATE
IMPORT_EXISTING
LIVE_WRITE éventuellement, mais non prioritaire et dangereux
```

`LIVE_WRITE` ne doit pas être implémenté en V1.

---

## Relation avec la localisation

La publication consomme une fiche localisée.

Elle ne doit pas refaire la localisation.

Elle doit recevoir :

```text
FR title / description / tags
EN title / description / tags
statut validation FR
statut validation EN
```

Si EN est absent ou stale : warning.

Si la V1 décide de bloquer la publication sans EN validé, cette règle doit être appliquée dans le stepper.

---

## Relation avec les médias

Les médias sont globaux en V1.

La publication doit recevoir :

```text
images produit
images informatives globales
vidéo
ALT produit globale
ALT informatives globales
association images/variations si nécessaire
```

À ne pas faire en V1 :

- générer des images informatives par langue
- localiser les ALT par langue
- remplacer automatiquement des images d'une fiche active

---

## Architecture attendue

Objets conceptuels :

```text
PipelineListingFR
LocalizedListingFR_EN
MediaManifest
EtsyTemplateListing
EtsyPublicationSettings
EtsyDraftPayload
```

Flow :

```text
PipelineListingFR
↓
LocalizedListingFR_EN
↓
Publication Stepper
↓
MediaManifest + EtsyPublicationSettings
↓
EtsyDraftPayload
↓
Create Draft Etsy
```

Le code doit séparer :

```text
contenu éditorial
médias
variations/pricing
contraintes marketplace
payload API Etsy
```

---

## Futur READ / import

Un import complet des fiches Etsy existantes est un besoin futur.

Objectifs futurs :

- relire les fiches existantes
- les retraduire / relocaliser
- préparer une mise à jour
- reclasser les templates
- importer une ancienne fiche dans le pipeline

Mais en V1 :

```text
pas d'import catalogue
pas de listing browser
pas de classification des fiches existantes
```

Seul le READ template par URL/ID est autorisé.

---

## UX / UI — cadrage léger

Une spec UX/UI dédiée sera nécessaire.

Principes déjà actés :

- utiliser un stepper
- éviter une page géante
- ne pas cloner le back-office Etsy
- guider la validation par étapes
- distinguer clairement contenu, médias, variations, contraintes marketplace, review
- afficher les warnings avant l'appel API
- bouton final = `Créer brouillon Etsy`
- jamais `Publier`

Le stepper doit rester orienté assistant de publication, pas gestionnaire complet de boutique.

---

## Risques principaux

- complexité UI marketplace
- mapping variations Etsy
- association images ↔ variations
- reliquats du template
- création d'une draft incorrecte
- erreurs API / quotas
- payload trop lié à Etsy et difficile à adapter à d'autres marketplaces

Mitigations :

- create draft only
- template filtré
- review finale
- dry-run
- séparation modèle interne / adapter Etsy
- pas de live write
- pas d'import catalogue en V1

---

## Critères d'acceptation V1

La V1 Publication Draft Etsy est acceptable si :

- l'utilisateur peut fournir une URL/ID de template
- l'application lit uniquement cette fiche template
- les paramètres marketplace utiles sont préremplis
- le contenu FR/EN validé est conservé et prioritaire
- les médias et ALT globales sont préparés
- les variations/pricing/SKU sont visibles et validables
- les contraintes Etsy sont visibles et validables
- un dry-run payload est possible
- la création d'une draft Etsy fonctionne
- aucune fiche active n'est modifiée
- aucune publication active n'est possible
- aucun delete API n'existe dans la V1

---

## Décision finale

La publication Etsy V1 doit être une création de brouillon contrôlée, basée sur :

```text
fiche FR validée
fiche EN validée
template Etsy par URL/ID
médias globaux
paramètres marketplace validés
```

Le but n'est pas de remplacer Etsy, mais de préparer une draft propre que l'utilisateur publiera manuellement après contrôle final.
