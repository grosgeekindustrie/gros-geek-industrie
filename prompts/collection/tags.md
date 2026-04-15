# AGENT TAGS — EXPLORE

## Mission

Génère exactement 26 tags candidats Etsy en français.

## Objectif

Créer un réservoir SEO pour une figurine, statue ou miniature à peindre.

Les tags doivent suivre une logique proche de tags Etsy réels : courts, tapables, précis, exploitables.

## Données prioritaires

Personnage : `[[NOM]]`  
Nom court : `[[NOM_COURT]]`  
Univers : `[[UNIVERS]]`  
Medium : `[[MEDIUM]]`  
Sous-catégories medium : `[[MEDIUM_SUBCATEGORIES]]`  
Genres transverses : `[[GENRES_TRANSVERSES]]`  
Contexte medium : `[[MEDIUM_CONTEXT]]`  
Licence protégée : `[[LICENSE]]`  
Connexes prioritaires : `[[CONNEXES_PRIORITAIRES]]`  
Titre validé : `[[TITRE_VALIDE]]`  
Exclusions tags : `[[BIBLIO_TAGS]]`

## Lien titre → tags

Le titre validé sert de base SEO principale.

Les éléments importants du titre doivent se retrouver dans les tags candidats, sous forme de recherches Etsy naturelles.

Priorité aux éléments suivants s’ils sont présents dans le titre :

• personnage  
• univers  
• produit  
• finition  
• fabrication  
• garage kit  
• cible client  
• intention d’achat  
• medium  
• sous-catégories medium  
• les termes exacts issus de `[[GENRES_TRANSVERSES]]`, sans invention  
• les termes exacts issus de `[[MEDIUM_CONTEXT]]`, sans invention

Ne copie pas le titre entier.  
Transforme ses éléments en tags courts, lisibles et complémentaires.

## Règles absolues

• Exactement 26 tags  
• 30 caractères maximum par tag, espaces compris  
• Si un tag dépasse 30 caractères espaces compris, reformule-le ou abandonne-le immédiatement  
• Français uniquement  
• Pas d’échelle  
• Pas de phrase anglaise  
• Pas de studio / éditeur si non fourni comme sculpteur  
• Pas de détail visuel, décor, pose ou scène  
• Pas de rôle ou lore, même évident ou culturellement connu, sauf si le terme est présent dans les données fournies  
• Pas de tag abstrait  
• Pas de slogan  
• Pas de doublon proche  
• Pas de `fan art`  
• Tous les tags doivent être directement tapables par un acheteur Etsy  
• Tout mot ajouté doit venir textuellement des données fournies ou des éléments autorisés ci-dessous  
• N’invente rien  
• Ne reformule rien  
• Ne résume rien  
• N’ajoute jamais un matériau, un nom de sculpteur, un nom de studio ou un autre mot parasite s’il n’est pas explicitement fourni dans un champ dédié ou listé dans les éléments autorisés  
• Hors tags commençant par `cadeau`, chaque tag doit contenir un produit explicite

## Construction et enrichissement des tags

Objectif :
produire des tags entre 24 et 30 caractères espaces compris dès que possible,
sans dépasser 30 caractères.

Règle de construction :
1. construis d’abord un tag avec un produit explicite
2. ajoute ensuite `[[UNIVERS]]`, `[[NOM]]`, `[[NOM_COURT]]` ou un connexe exact selon ce qui est pertinent
3. si le tag reste trop court, ajoute ensuite des termes exacts issus de `[[MEDIUM_CONTEXT]]` ou/et de `[[GENRES_TRANSVERSES]]`
4. si le tag atteint une forme naturelle entre 24 et 30 caractères, garde-le
5. si l’ajout d’un terme dépasse 30 caractères, n’utilise pas ce terme

Règles absolues :
• hors tags commençant par `cadeau`, chaque tag doit contenir un produit explicite
• les termes exacts issus de `[[MEDIUM_CONTEXT]]` et de `[[GENRES_TRANSVERSES]]` ont le même statut
• utilise ceux qui tiennent naturellement dans le tag, sans priorité systématique de l’un sur l’autre
• quand plusieurs termes exacts fournis tiennent naturellement dans le tag, tu peux en utiliser plusieurs
• n’invente rien
• ne reformule rien
• ne résume rien
• tout mot ajouté doit venir textuellement des données fournies ou des éléments autorisés
• ne garde pas un tag court si un enrichissement exact fourni tient naturellement dans la limite
• moins de 20 caractères = généralement insuffisant
• 20 à 23 caractères = acceptable seulement si aucun enrichissement exact fourni ne tient naturellement
• 24 à 30 caractères = zone cible

## Ordre naturel des mots

Construis les tags comme de petites requêtes françaises naturelles.

Quand un tag contient un produit, le produit doit ouvrir le tag, sauf si le tag commence par `cadeau`.

Priorité d’ordre :

• produit + personnage + univers  
• produit + personnage + finition  
• produit + univers + finition  
• produit + univers + fabrication  
• produit + univers + intention  
• produit + connexe + univers  
• produit + connexe + fabrication  
• connexe + produit + univers  
• personnage + produit + univers  
• cadeau + produit + personnage  
• cadeau + produit + univers  
• cadeau + intention + univers

Quand un tag contient aussi personnage, univers, connexe, fabrication ou intention, l’ordre prioritaire est :
produit + personnage/univers/connexe + finition/fabrication/intention

Évite :
• les inversions artificielles  
• les assemblages mécaniques faibles  
• les tags où un style, une intention ou un univers flotte sans produit clair  
• les tags qui commencent par un univers, un style, une cible ou un connexe si un produit est présent  
• les tags qui commencent par `collection` si un produit peut ouvrir naturellement le tag

## Accords grammaticaux

Respecte les accords en français.

• `figurine` et `statue` → `imprimée en 3D`  
• `garage kit` → `imprimé en 3D`  
• `impression 3D` reste nominal et ne s’accorde pas  
• n’utilise jamais `imprimé` ou `imprimée` seul en fin de tag  
• n’utilise jamais `3d` seul comme fabrication raccourcie  
• si `imprimé en 3d` ou `imprimée en 3d` ne tient pas en entier, n’utilise pas la fabrication

## Éléments autorisés

• Produit : `figurine`, `statue`, `garage kit`, `miniature`, `impression 3d`  
• Personnage : `[[NOM]]` ou `[[NOM_COURT]]`  
• Univers : `[[UNIVERS]]`  
• Finition : `à peindre`  
• Fabrication : `imprimé en 3d`, `imprimée en 3d`  
• Intention : `cadeau`, `collection`, `à collectionner`, `de collection`  
• Cible : `fan`, `collectionneur`, `peintre`, `geek`  
• Genres transverses autorisés : termes exacts issus de `[[GENRES_TRANSVERSES]]`  
• Contexte medium autorisé : termes exacts issus de `[[MEDIUM_CONTEXT]]`  
• Connexes prioritaires fournis

## Contrôle des termes génériques

• `miniature` est autorisé seulement si le produit est présenté comme miniature, tabletop, 75mm, JDR, DnD ou petit format  
• `geek` est autorisé pour les tags cadeau / cible  
• `gaming` est évité en français ; préférer `jeux vidéo`  
• `kit peinture` est évité sauf si le produit inclut réellement un kit de peinture  
• Évite les tags trop larges sans personnage ni univers  
• Hors tags commençant par `cadeau`, un tag sans produit explicite est interdit  
• Un tag sans `[[NOM]]`, sans `[[UNIVERS]]` et sans connexe exact est à éviter  
• Un tag générique n’est acceptable que s’il contient un produit explicite et une intention d’achat claire  
• Les tags style / collection / jeux vidéo doivent rester rattachés à un produit clair quand le personnage ou l’univers n’apparaissent pas  
• des termes de genre ou de contexte ne doivent pas remplacer un produit explicite si ce produit tient naturellement dans le tag  
• des termes de genre ou de contexte peuvent servir d’enrichissement principal s’ils sont textuellement fournis, qu’ils restent naturels en français et qu’un produit explicite est présent dans le tag  
• n’utilise jamais un nom de sculpteur ou de studio s’il n’existe pas de champ dédié de sculpteur dans les données fournies  
• quand un tag utilise des termes exacts issus de `[[GENRES_TRANSVERSES]]` ou de `[[MEDIUM_CONTEXT]]`, il doit garder un ancrage fort avec un produit explicite et, si cela tient naturellement, avec `[[UNIVERS]]`, `[[NOM]]`, `[[NOM_COURT]]` ou un connexe exact

## Connexes

Utilise uniquement les mots exacts fournis dans `[[CONNEXES_PRIORITAIRES]]`.

Règles :

• Ne jamais inventer de connexes  
• Ne jamais déduire de connexe depuis le personnage principal  
• Ne jamais transformer le personnage principal en rôle ou thème  
• Ne jamais empiler plusieurs connexes dans le même tag  
• Ne jamais associer le personnage principal avec un personnage connexe dans le même tag  
• Si le connexe est un personnage, l’associer uniquement à l’univers ou au produit  
• Si le connexe est un thème, il peut être associé à l’univers, au produit ou à la fabrication  
• Ne jamais combiner deux personnages connexes dans le même tag

## Expressions naturelles obligatoires

• Quand un tag contient `collection`, `fan` ou `collectionneur`, il doit former une mini-requête naturelle.
• une formule avec `collection` doit commencer par un produit explicite si un produit tient naturellement dans le tag

Formes autorisées :

• `figurine [univers] de collection`  
• `statue [univers] de collection`  
• `cadeau fan [univers]`  
• `cadeau collectionneur [univers]`  
• `cadeau [produit] [personnage]`

Évite les formes mécaniques comme :

• produit + univers + `collection`  
• produit + `fan` + univers  
• produit + `collectionneur` + univers  
• produit ajouté en fin de tag juste pour rallonger une formule déjà naturelle

Si `collection`, `fan` ou `collectionneur` rendent le tag moins naturel, préfère une autre formulation.

## Usage du mot peintre

• `peintre` ne doit jamais être collé directement après un produit comme s’il était un adjectif.
• Dans une formule `cadeau peintre ...`, termine par `[[UNIVERS]]`, `[[NOM]]` ou `[[NOM_COURT]]`, jamais par un produit ajouté ensuite

Évite les formes mécaniques :

• `figurine peintre [univers]`  
• `statue peintre [univers]`  
• `garage kit peintre [univers]`

Formes naturelles autorisées :

• `cadeau peintre [univers]`  
• `figurine [univers] à peindre`  
• `statue [univers] à peindre`  
• `garage kit [univers] à peindre`

Si `peintre` rend le tag moins naturel, utilise plutôt `à peindre`.

## Tags génériques interdits

Évite les tags génériques qui ne portent pas assez d’intention.

À éviter :

• `garage kit de collection`  
• `garage kit jeux vidéo`  
• `impression 3d [univers]` sans produit si une version plus précise tient en 30 caractères espaces compris  
• `[univers] jeux vidéo collection`  
• `collection jeux vidéo [produit]`

Préférer une formulation avec produit + univers + intention quand c’est possible.

## Qualité de formulation prioritaire

Chaque tag doit être une mini-requête française naturelle, réellement tapable sur Etsy.

Tu n’assembles pas des mots-clés.  
Tu rédiges une recherche courte, fluide et crédible.

Règles :
• n’ajoute jamais un mot non fourni, non autorisé, ou non présent textuellement dans les données fournies  
• respecte les accords grammaticaux entre produit, fabrication et finition  
• utilise l’espace disponible seulement si l’ajout rend la recherche plus naturelle, plus précise ou plus utile  
• n’ajoute jamais un mot décoratif, narratif ou matériau parasite pour “remplir”  
• entre deux formulations, choisis toujours la plus naturelle en français

Avant de garder un tag, vérifie :
• est-ce qu’un acheteur Etsy francophone pourrait vraiment taper cela ?  
• est-ce que chaque mot est autorisé ou fourni ?  
• est-ce que les mots sont bien accordés entre eux ?  
• est-ce que le remplissage améliore la recherche au lieu de la casser ?

## Exclusions bibliothèque

Respecte strictement la bibliothèque d’exclusions tags.

N’utilise jamais un terme exclu, même s’il semble pertinent.  
Si un tag contient un terme exclu, remplace-le par une formulation plus précise avec produit + personnage + univers.

## Répartition attendue

• 7 tags produit + personnage + univers  
• 4 tags finition / fabrication  
• 4 tags connexes prioritaires  
• 3 tags cadeau / cible, dont au moins 1 avec produit explicite  
• 3 tags univers / style

## Auto-contrôle avant sortie

Avant de répondre, vérifie mentalement :

• 26 tags exactement  
• aucun tag au-dessus de 30 caractères, espaces compris  
• aucun doublon proche  
• aucun rôle/lore non fourni  
• aucune combinaison personnage principal + personnage connexe  
• aucun tag trop générique sans lien direct  
• les éléments importants du titre sont bien représentés dans les tags  
• chaque tag utilise au mieux les 30 caractères, espaces compris disponibles quand cela reste naturel  
• aucun tag n’est raccourci inutilement  
• le produit ouvre le tag quand un produit est présent, sauf si le tag commence par `cadeau`  
• l’ordre des mots est naturel en français  
• mini phrase avec une syntaxe cohérente en français  
• aucun tag avec `collection`, `fan` ou `collectionneur` n’a une structure mécanique  
• aucun tag produit + cible brute du type `figurine fan univers`  
• aucun tag produit + `peintre` + univers  
• aucun tag ne se termine par un produit ajouté seulement pour rallonger  
• aucun tag n’utilise `3d` seul  
• aucun tag n’utilise `imprimé` ou `imprimée` seul en fin de tag  
• les tags courts restent minoritaires et ne sont conservés que lorsqu’aucun enrichissement naturel n’est possible  
• tout mot ajouté vient textuellement des données fournies ou des éléments autorisés  
• aucun tag ne commence par `collection` si un produit peut ouvrir naturellement le tag  
• aucun tag hors `cadeau` n’est conservé s’il ne contient pas un produit explicite  
• aucun tag trop générique n’est conservé s’il ne contient qu’un produit + des termes de genre ou de contexte  
• si un tag reste trop court ou trop nu, utilise des termes exacts utiles issus de `[[MEDIUM_CONTEXT]]` et de `[[GENRES_TRANSVERSES]]` selon ce qui tient naturellement dans le tag

## Doublons de sens

Ne garde pas deux tags qui expriment la même recherche avec un simple changement d’ordre.

Si deux tags veulent dire la même chose, conserve uniquement la version la plus naturelle en français.

## Ordre de sortie

Trie les 26 tags finaux par ordre alphabétique strict avant de répondre.

Règles :
• compare les tags lettre par lettre
• ignore la numérotation pendant le tri
• une fois le tri terminé, renumérote la liste de 1 à 26
• ne regroupe pas par thème, par produit ou par qualité : seul l’ordre alphabétique compte

## Sortie

Liste numérotée uniquement.

Exactement 26 tags.

1 tag par ligne.

Aucune explication.
