# Instructions pour calibrer le prompt GPT de l’agent Description

Copier le bloc ci-dessous dans GPT avec le prompt Description actuel à retravailler.

```text
Tu dois réécrire et calibrer le prompt unique de l’agent Description de Gros Geek Industrie pour GPT.

Contrainte d’architecture impérative : il ne doit exister qu’un seul fichier de prompt Description par mode et par boutique. Ne crée surtout pas un second prompt de recherche.

Le code exécute ce même fichier en deux phases :

1. RECHERCHE : GPT-5.6 Luna reçoit les quatre images de la figurine et peut utiliser le Web. Il doit identifier le personnage et son univers, vérifier le lore utile, examiner la tenue, les accessoires et la pose visibles, rechercher si la représentation rappelle une scène ou une référence connue, lever les doutes et produire un brief factuel compact. Il ne rédige jamais la fiche produit.

2. RÉDACTION : le modèle Description choisi dans l’application (Sol, Terra ou Luna) reçoit lui aussi les quatre images, ainsi que le brief produit par la phase RECHERCHE. Il reste seul responsable de la rédaction commerciale et du format final.

Structure obligatoirement le prompt avec exactement ces six marqueurs, chacun présent une seule fois et dans cet ordre :

<!-- GGI_DESCRIPTION_COMMON_START -->
[données reçues, définitions, hiérarchie des sources et garde-fous réellement communs aux deux phases]
<!-- GGI_DESCRIPTION_COMMON_END -->

<!-- GGI_DESCRIPTION_RESEARCH_START -->
[mission et format du brief factuel de recherche ; aucune rédaction commerciale]
<!-- GGI_DESCRIPTION_RESEARCH_END -->

<!-- GGI_DESCRIPTION_WRITING_START -->
[mission éditoriale, ton, règles métier, contrôles et format final de la fiche]
<!-- GGI_DESCRIPTION_WRITING_END -->

Le code n’envoie à Luna que COMMON + RESEARCH. Il n’envoie au rédacteur que COMMON + WRITING, puis injecte automatiquement le brief de recherche à la fin. N’ajoute donc aucun nouveau placeholder pour ce brief.

Règles à respecter :

- Conserve tous les placeholders [[...]] existants et leur orthographe exacte.
- Ne change pas le contrat de sortie attendu par l’application, les libellés, le nombre d’accroches, le nombre de CTA ni les autres éléments parsés.
- Place dans COMMON uniquement ce qui est nécessaire aux deux phases. Ne duplique pas le prompt complet dans RESEARCH et WRITING.
- La phase RESEARCH doit séparer explicitement : faits vérifiés, observations visuelles, scène ou référence possible avec niveau de confiance, doutes levés, éléments à ne pas affirmer et sources.
- Les quatre images représentent la même figurine sous plusieurs angles. Il faut les confronter entre elles, jamais les traiter comme quatre produits.
- Le Web peut confirmer le personnage, le lore et une scène connue, mais il ne prouve jamais qu’un détail est visible sur la figurine. Pour le visuel, les images restent prioritaires.
- Une ressemblance avec une scène iconique reste une hypothèse tant que les indices visuels et les sources ne permettent pas de la confirmer.
- La phase RESEARCH doit rester compacte et ciblée afin de limiter les tokens et les appels Web.
- La phase WRITING ne doit jamais mentionner Luna, la recherche Web, le brief ou les sources dans la fiche finale.
- Le rédacteur doit confronter le brief aux quatre images et ignorer toute affirmation du brief qui contredit clairement le visuel.
- Supprime les règles uniquement destinées à compenser les défauts propres à Claude lorsqu’elles brident inutilement GPT, mais conserve tous les garde-fous métier réellement utiles.

Retourne uniquement le prompt complet final, prêt à remplacer le fichier actuel, sans explication avant ou après.
```

Le même contrat de marqueurs s’applique aux prompts Description Tabletop, Collection et à leurs variantes de boutique.
