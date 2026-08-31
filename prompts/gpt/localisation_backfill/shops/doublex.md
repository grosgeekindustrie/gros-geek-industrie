STATUS: VALIDATED

# Couche boutique — Double X Industrie

Cette couche complète le socle Collection commun. Elle ne le remplace pas.

## Contrat impératif

- La source française fait foi. Si et seulement si ses tags contiennent exactement `mature`, conserve ce tag en minuscules et sans traduction dans la langue cible. S'il est absent des tags sources, ne l'ajoute jamais, même si la fiche appartient à Double X ou emploie ailleurs `NSFW`, `nude`, `topless` ou un autre vocabulaire adulte.
- Lorsque `mature` est présent dans la source, il remplace l'un des 13 emplacements : il ne constitue jamais un quatorzième tag.
- Vise exactement 13 tags distincts. Si des tags sources redondants sont fusionnés, crée de nouvelles intentions SEO pertinentes à partir des seules informations de la fiche. Ne complète toutefois jamais une place manquante avec `mature` lorsque celui-ci est absent de la source.
- Distingue strictement `NSFW`, `waifu`, `pin-up`, `sexy`, `nude` et `topless`. Ils ne sont jamais interchangeables.
- N'ajoute jamais une nudité absente de la source ou des variantes proposées.
- Limite le titre à une ou deux intentions adultes utiles. La rédaction reste élégante, commerciale et centrée sur la sculpture, la peinture et la collection.
- Ne sexualise jamais un personnage mineur ou d'apparence mineure.
- Préserve `mature`, `NSFW`, `waifu` et `pin-up` selon les règles ci-dessous.

## Jetons internationaux

- `mature` : exact et non traduit lorsqu'il existe dans les tags sources ; marqueur Etsy, jamais déduit du seul contexte.
- `NSFW` : acronyme international, uniquement si la source ou la variante le justifie.
- `waifu` : alphabet latin dans toutes les langues, uniquement pour une femme adulte du registre anime/manga/jeu japonais.
- `pin-up` : graphie internationale, uniquement pour une esthétique réellement pin-up.

## Lexique adulte préféré par langue

| Langue | sexy | nude | topless | sensuelle | lingerie | bikini | version NSFW |
|---|---|---|---|---|---|---|---|
| Français | sexy | nue | seins nus / topless | sensuelle | lingerie | bikini | version NSFW |
| Anglais | sexy | nude | topless | sensual | lingerie | bikini | NSFW version |
| Allemand | sexy | nackt | oben ohne | sinnlich | Dessous | Bikini | NSFW-Version |
| Espagnol | sexy | desnuda | topless | sensual | lencería | bikini | versión NSFW |
| Italien | sexy | nuda | topless | sensuale | lingerie | bikini | versione NSFW |
| Néerlandais | sexy | naakt | topless | sensueel | lingerie | bikini | NSFW-versie |
| Portugais | sexy | nua | topless | sensual | lingerie | biquíni | versão NSFW |
| Japonais | セクシー | ヌード | トップレス | 官能的 | ランジェリー | ビキニ | NSFW版 |
| Polonais | seksowna | naga | topless | zmysłowa | bielizna | bikini | wersja NSFW |
| Russe | сексуальная | обнажённая | топлес | чувственная | нижнее бельё | бикини | NSFW-версия |
| Suédois | sexig | naken | topless | sensuell | underkläder | bikini | NSFW-version |

## Sélection sémantique

- `sexy` : présentation séduisante ou glamour, avec ou sans nudité.
- `pin-up` : pose, tenue ou mise en scène réellement pin-up ; ne pas l'ajouter à toute figurine féminine.
- `waifu` : femme adulte du registre anime/manga/jeu japonais ; ne décrit pas un degré de nudité.
- `nude` : uniquement si la figurine ou une variante proposée est nue ; emploie la forme locale.
- `topless` : poitrine nue sans nécessairement être entièrement nue ; emploie la forme locale naturelle.
- `NSFW` : version adulte impropre à un affichage public ordinaire ; peut coexister avec `mature`, sans le remplacer.

## Vocabulaire interdit

Ne génère jamais `porn`, `porno`, `pornographic`, `pornographique`, leurs traductions, `hentai`, ni de terme décrivant explicitement un acte sexuel, des fluides sexuels, un fétiche ou une destination de stimulation sexuelle.

Préfère un vocabulaire de collection et de sculpture, tel que `adult collectible`, `NSFW version`, `nude figure` ou `pin-up statue`, uniquement lorsque ces termes sont exacts.

## Contrôles attendus

- `mature` apparaît exactement une fois si la source le contient, sinon zéro fois.
- Il existe au maximum 13 tags distincts. Une fiche marquée `mature` doit en comporter exactement 13 ; une fiche non mature peut exceptionnellement en comporter moins et produire un avertissement non bloquant.
- Aucun terme interdit n'apparaît.
- Les termes `nude`, `topless`, `waifu`, `NSFW` ou leurs équivalents locaux restent factuellement justifiés par la source.

La contrainte Etsy sur l'image principale (masquage ou recadrage du contenu mature) relève du média et non de cette localisation textuelle.
