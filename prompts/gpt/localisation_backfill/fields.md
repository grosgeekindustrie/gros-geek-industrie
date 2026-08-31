# Contrat des champs Etsy

## Titre

- Maximum 140 caractères.
- Naturel et utile pour la recherche locale.
- Conserver personnage, univers, sculpteur et informations produit présents dans la source.
- Utiliser uniquement lettres, chiffres, espaces, tirets simples, apostrophes simples et underscores.

## Tags

- Produire exactement 13 tags distincts selon la stratégie éditoriale du glossaire partagé.
- Localiser les intentions SEO utiles des tags sources, sans imposer une correspondance artificielle un tag source pour un tag cible.
- Fusionner les doublons ou formulations strictement redondantes, puis réutiliser chaque emplacement libéré pour une variante pertinente et complémentaire.
- Préserver les intentions propres au personnage, à la licence et au sculpteur lorsqu'elles sont pertinentes.
- Pour compléter jusqu'à 13, rester exclusivement dans les faits de la fiche : personnage, univers, type de produit, résine, peinture, assemblage, collection ou cadeau lorsque ces notions sont réellement présentes.
- N'inventer aucune licence, aucun personnage, matériau, usage, scène ou caractéristique absent de la source.
- Maximum 30 caractères par tag, espaces compris.
- Si une localisation naturelle dépasse 30 caractères, réécris entièrement ce
  tag avec une formulation locale plus concise qui conserve la même intention
  SEO. Ne tronque jamais un mot ou une expression. Vérifie que la nouvelle
  formulation ne duplique aucun autre tag de la sortie.
- Utiliser uniquement lettres, chiffres, espaces, tirets simples, apostrophes simples et underscores.

## Description

- Conserver les paragraphes, listes, emojis et lignes vides utiles.
- Localiser les passages commerciaux naturellement ; conserver les passages techniques avec une fidélité stricte.
- Ne pas ajouter ni retirer de bloc métier.

## Sortie

Format exact :

{
  "title": "Titre localisé",
  "tags": ["tag 1", "... exactement 13 tags distincts ...", "tag 13"],
  "description": "Description localisée complète"
}
