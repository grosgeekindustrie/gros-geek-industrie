# Prompt de transfert — chantier titres Etsy Collection

## Contexte
Projet : **Etsy Pipeline**  
Branche de référence : **`tags_agents_3`**

Mission du fil :
- travailler la **génération de titres Etsy Collection**
- avec **un seul agent titre**
- en s’appuyant sur une **bibliothèque de titres**
- avec objectif : obtenir des titres **plus premium, plus denses, plus naturels**, sans retomber dans les vieux polluants historiques

---

## Source de vérité
Pour ce chantier, considérer comme source de vérité :

1. **les fichiers locaux réellement fournis**
2. la branche locale / distante **`tags_agents_3`**
3. la biblio titres collection :
   - `biblios/collection/titres.md`

Important :
- il y a eu un souci de lecture côté distant/web : certains accès GitHub vus par l’assistant remontaient un **vieux snapshot**
- ce constat distant ancien est **caduc et obsolète**
- la vraie biblio a bien été enrichie
- ne surtout pas raisonner à partir de l’ancienne mini-biblio

---

## Ce qui a été établi

### 1. Flux titre = mono-agent
On ne part plus sur 3 agents titres.  
Le chantier actuel vise **un seul agent titre fixe**.

### 2. Les tags polluaient fortement le prompt titre
Quand `[[TAGS]]` était injecté :
- trop de dérives lexicales
- effet de collage SEO / fandom
- bruit inutile

Conclusion :
- pour le prompt titre, les tags ont été écartés du cœur du dispositif

### 3. La biblio titres améliore clairement la densité
Quand la biblio a été remise au centre :
- les titres sont devenus plus naturels
- plus “boutique”
- plus denses
- moins secs
- moins absurdes

Mais :
- la biblio réimporte aussi de vieux polluants :
  - `|`
  - `cadeau idéal`
  - `gaming`
  - vieux ton Etsy promo
  - formulations vieillies

Conclusion :
- la biblio doit servir de **guide de ton et de densité**
- mais pas être copiée aveuglément

### 4. Problème important repéré : les échelles inventées
Exemple observé :
- le modèle sortait des `1/8`, `1/10`, etc.
- alors qu’aucune échelle exacte n’était réellement fournie au prompt

Diagnostic :
- forte probabilité de **copie implicite depuis la biblio**
- le modèle voit que beaucoup de bons titres contiennent une échelle
- donc il en invente une

Règle décidée :
- **ne jamais afficher d’échelle si elle n’est pas explicitement fournie dans les données d’entrée**
- **si des échelles sont fournies, utiliser uniquement celles-ci, jamais une autre**

### 5. Le prompt long marchait, mais coûtait trop
Le prompt long :
- fonctionnait
- mais était trop bavard
- trop chargé
- trop coûteux en tokens
- trop sujet aux effets de sur-cadrage

Conclusion :
- on a basculé vers un **prompt court**
- plus économique
- plus stable
- assez bon pour servir de nouvelle base

---

## État du code : biblio titres
Le code a été relu sur ce point.

Constat :
- la **bibliothèque titres est injectée telle quelle** dans le prompt titre
- elle n’est pas joliment reformattée avant injection

Mais :
- le parseur historique titres semble encore surtout pensé pour un format simple de type :
  - `## VALIDÉS`
  - `## BLACKLISTÉS`

Conséquence :
- pour orienter le modèle, une biblio plus riche peut déjà aider si elle est injectée brute
- mais si on veut que le code “comprenne” structurellement plus de niveaux, il faudra peut-être adapter le parsing plus tard

---

## Travail réalisé sur la biblio

### 1. Tri partiel puis recentrage
Le besoin a été clarifié :
- l’utilisateur ne voulait pas une analyse théorique
- il voulait un **vrai tri exploitable de la biblio**

### 2. Refonte 2026 de masse
Une refonte 2026 a été produite sur un grand lot de titres, mais :
- elle a surtout fait de la **normalisation conservatrice**
- elle n’a pas assez “élevé” les titres individuellement
- elle n’est donc **pas** à considérer comme une vraie refonte premium finale

Conclusion :
- utile comme matériau de travail
- pas comme aboutissement boutique

### 3. Tri en top 30 puis top 20
Ensuite, la biblio a été resserrée :
- un **top 30**
- puis un **top 20 premium**

Retour utilisateur + tests :
- le **top 20** donne de meilleurs résultats que le top 30
- moins de mimétisme
- plus propre
- meilleur équilibre global

Conclusion :
- **garder le top 20**
- ne pas réduire plus pour l’instant

---

## Prompt court retenu comme base

```md
AGENT 05 — TITRES SEO ETSY COLLECTION

Mission :
Génère exactement 10 titres Etsy pour une figurine de collection.

Données :
- Personnage : [[NOM]]
- Univers / second bloc utile : [[UNIVERS]]
- Medium : [[MEDIUM]]
- Bibliothèque titres : [[BIBLIO_TITRES]]

Règle principale :
Produis des titres naturels, denses et crédibles, dans le ton de la boutique, sans copier mécaniquement la bibliothèque.

Structure attendue :
[Personnage - second bloc utile], [figurine|statue|figurine de collection|statue de collection], [résine à peindre|à peindre en résine], garage kit[, enrichissement utile]

Contraintes :
- Le bloc identité est obligatoire : Personnage - second bloc utile
- Si [[UNIVERS]] duplique le personnage, évite le doublon
- Chaque titre doit contenir au moins 2 termes parmi : figurine, statue, garage kit
- "figurine" = choix par défaut
- "statue" seulement si cela correspond réellement au positionnement de la pièce
- "14K HD" est autorisé seulement si cela sonne naturel
- Une échelle ou précision simple (1/7, 1/8, 1/10, 1/12, chibi, pose muséum) est autorisée uniquement si elle est explicitement présente dans [[MEDIUM]]
- N’invente jamais d’échelle

Enrichissements autorisés :
- 1 angle large max : fantasy, dark fantasy, survival horror, anime, manga, jeu vidéo, JDR, science-fiction, gothique, mythologique, cyberpunk, etc.
- 1 cible large max : pour collectionneurs, pour peintres, pour fans de jeux vidéo, pour fans d’anime, pour fans de fantasy, pour fans de dark fantasy, pour fans de JDR

Interdits :
- Ne jamais afficher d’échelle si elle n’est pas explicitement fournie dans les données d’entrée
- Si des échelles sont fournies, utiliser uniquement celles-ci, jamais une autre
- copier la bibliothèque
- pipe |
- slogan ou ton promo
- "cadeau idéal"
- "gaming"
- premium / incroyable / magnifique / exceptionnel / luxe
- rôle du personnage
- détail de scène, pose, décor, arme, base, sculpture
- qualificatif inventé du type héros culte, personnage iconique, survivant, agent spécial

Longueur :
- vise 125 à 140 caractères
- légèrement plus court si le titre est déjà fort
- n’ajoute jamais un bloc faible juste pour remplir

Style :
- titres variés mais dans la même famille
- ton boutique 2026
- dense mais pas bavard
- lisible et SEO

Sortie :
- liste numérotée uniquement
- un titre par ligne
- aucune explication
```

---

## Résultats observés avec le prompt court
Le prompt court a donné de bien meilleurs résultats que prévu :
- plus de pollution débile
- plus d’échelles inventées
- plus de `Resident Evil` / `Requiem` mélangés au hasard
- plus de vieux polluants
- structure très stable
- densité crédible

Exemple de bon résultat-type :
- `Leon Kennedy - Resident Evil Requiem, figurine en résine à peindre 14K HD, garage kit pour collectionneurs et fans de survival horror`

Le vrai problème restant n’est plus le chaos, mais :
- **la redondance**
- **les permutations propres mais un peu mécaniques**
- **certaines fins qui sonnent encore légèrement forcées**

---

## Ce qui reste à faire

### Priorité 1 — garder le top 20 comme biblio active
Le top 20 semble être le meilleur compromis actuel :
- moins de mimétisme que le top 30
- assez de variété
- meilleures structures de référence

### Priorité 2 — polir la grammaire des fins
Le plus gros point faible restant, ce sont certaines formulations finales encore un peu forcées.

Exemples de formulations jugées faibles :
- `collectionneurs de survival horror`
- `collectionneurs de jeux vidéo`
- `peintres de jeux vidéo`
- `collectionneurs et peintres de ...`

Direction retenue :
- privilégier uniquement des fins naturelles du type :
  - `pour collectionneurs et fans de ...`
  - `pour peintres et collectionneurs`
  - `pour peintres et fans de ...`
  - `pour fans de ... et collectionneurs`

### Priorité 3 — vérifier encore le comportement “10 titres exacts”
Un problème a été observé plusieurs fois :
- sortie de seulement 7 titres au lieu de 10

Il faut donc revérifier :
- si c’est un problème de prompt
- ou un problème de parsing / récupération / pipeline dans le code

### Priorité 4 — ne pas repartir dans une refonte massive
Si une vraie montée en gamme boutique doit être faite plus tard :
- la faire **par petits lots**
- avec vraie réécriture premium
- pas via une normalisation de masse trop générique

---

## Ce qu’il ne faut pas refaire
- ne pas repartir dans un prompt énorme de 300 règles
- ne pas réinjecter les tags bruts comme source principale
- ne pas laisser le modèle inventer des échelles
- ne pas recopier la biblio servilement
- ne pas refaire une refonte massive “propre mais plate”
- ne pas revenir aux vieux polluants legacy

---

## But concret du prochain fil
Obtenir un prompt titre :
- léger
- moins coûteux
- stable
- nourri par le top 20 de la biblio
- sans imitation servile
- sans hallucination d’échelle
- avec des fins plus naturelles
- capable de sortir **10 titres boutique crédibles, variés et propres**
