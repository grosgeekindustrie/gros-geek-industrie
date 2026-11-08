# Atelier de renouvellement

L’atelier traite les fiches Etsy expirées sans réinjecter leur ancien contenu
rédactionnel dans le pipeline.

## Flux de l’atelier

1. **Sélectionner** : audit frais Etsy, choix des fiches et des images de
   référence envoyées aux agents. Cette sélection ne limite jamais les médias
   disponibles lors de la validation finale.
2. **Préparer** : validation des données structurées, des échelles, des
   dimensions, du calculateur et du pricing. Les prix Etsy existants sont
   préchargés lorsque l’inventaire permet de les rattacher à une échelle. Les
   dimensions compatibles et les conversions de prix sont recalculées en direct.
3. **Générer** : file persistante et séquentielle. Les agents reçoivent les
   mêmes prompts que le pipeline unitaire, précédés du contrat de rework.
4. **Valider** : chargement de toutes les images de la fiche Etsy dans leur
   ordre Etsy d’origine (et pas seulement des images de référence envoyées aux
   agents), ajout de fichiers par dépôt direct dans la grille, retrait par
   corbeille et réorganisation libre par glisser-déposer,
   sélection humaine et édition des tags métier et générés séparément, choix du
   titre, de l’accroche et du CTA, édition de la description et des ALT. Chaque
   changement est sauvegardé automatiquement dans le dossier. La validation des
   choix déplace ensuite la fiche dans l’étage `Terminées` sans publier sur Etsy.
5. **Terminées** : finalisation des dimensions, prix, compensations et paramètres
   du calculateur, avec recalcul et copie des prix Etsy. C’est uniquement depuis
   cet étage que la description Etsy complète est assemblée avec les blocs fixes.
   Les médias, le titre, les tags, la description complète et les balises ALT y
   restent entièrement éditables avant que l’utilisateur déclenche la mise à
   jour de la fiche expirée. Après publication, le dossier conserve toutes ces
   valeurs en lecture seule.

Un dossier peut être supprimé à chaque étage. Cette suppression ne touche
jamais la fiche Etsy et la rend de nouveau sélectionnable dans l’atelier.

### Variations et prix régionaux Etsy

Lorsqu’une fiche utilise les prix « domestic & global », Etsy peut refuser par
API l’ajout ou le retrait d’options de variation. Le renouvellement conserve
les variations secondaires existantes (par exemple les deux matières de Graves)
pour chaque nouvelle échelle, mais ne peut pas forcer le changement de structure
si Etsy répond `To edit variations for listings with domestic & global pricing,
open Etsy.com in a mobile or desktop browser`. Dans ce cas, modifier les
variations et leurs prix dans l’éditeur Etsy avant de reprendre le dossier.
Le diagnostic de publication identifie l’appel d’inventaire concerné.

## Isolation du legacy

Le catalogue peut afficher l’ancien titre et analyser les champs structurés
pour aider à préparer le formulaire. Une fois la préparation enregistrée, le
job ne contient que :

- l’identifiant administratif Etsy ;
- la boutique et le mode ;
- les images choisies ;
- les champs structurés explicitement validés.

L’ancien titre brut, les anciens tags et l’ancienne description ne sont jamais
stockés dans le job ni envoyés aux agents.

## Contexte cumulatif

Le mode candidat ne fait aucun choix provisoire. Les agents suivants reçoivent
des blocs nommés :

- `TITRES_CANDIDATS` ;
- `TAGS_CANDIDATS` ;
- `TAGS_METIER`.

La sélection définitive reste humaine et intervient après la génération de la
fiche complète.
