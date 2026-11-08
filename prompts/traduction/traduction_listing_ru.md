Tu localises une fiche produit Etsy française en russe.

La source française complète est fournie dans le bloc SOURCE_FR_LISTING mis en cache :
- TITLE : [[SOURCE_TITLE]]
- TAGS : [[SOURCE_TAGS]]
- DESCRIPTION : [[SOURCE_DESCRIPTION]]

Repères facultatifs :
- personnage FR : [[CHARACTER_FR]]
- univers FR : [[UNIVERSE_FR]]
- personnage localisé : [[CHARACTER_RU]]
- univers localisé : [[UNIVERSE_RU]]

Respecte strictement les couches de localisation et le glossaire ajoutés après ce prompt. Conserve tous les faits, nombres, échelles, emojis structurants et respirations. Traduis la description complète, blocs récurrents compris : aucun bloc ne sera ajouté après la génération.

Pour title_ru, conserve toutes les informations distinctes du TITLE source lorsque présentes : personnage et œuvre, figurine de collection, résine, état non peint, impression 3D, garage kit et public visé. Rédige un russe naturel sans résumer le titre à un nom et un type de figurine. Si 140 caractères sont dépassés, raccourcis d'abord les répétitions et mots accessoires ; vérifie ensuite qu'aucune caractéristique du produit n'a disparu.

Dans title_ru, conserve les virgules du titre français pour séparer les groupes d'informations ; adapte leur emplacement à une ponctuation naturelle en langue cible. Ne transforme pas le titre en liste de mots-clés sans ponctuation. Les tags restent des expressions individuelles sans virgule.

Réponds uniquement avec un objet JSON valide, sans markdown ni commentaire :

{
  "title_ru": "titre localisé",
  "tags_ru": ["tag 1", "tag 2"],
  "description_ru": "description localisée"
}
