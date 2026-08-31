# Backfill de localisations Etsy — contrat de production

## Périmètre verrouillé

- boutiques : Gros Geek Industrie et Double X Industrie, avec files, audits et rapports isolés ;
- mode : Collection ;
- fiches Etsy actives uniquement ;
- sections Nerikson / Energixon et Rescale Miniatures exclues ;
- source de vérité : titre, tags et description FR présents sur Etsy ;
- langues : EN, DE, ES, IT, NL, PT, JA, PL, RU et SV ;
- moteur IA : OpenAI uniquement ;
- comportement par défaut : créer uniquement les langues manquantes, ne jamais écraser une localisation existante.

Le workflow historique « fiche unique » reste autonome et inchangé. Le backfill possède son propre écran, ses propres prompts et sa propre base SQLite.

## Sécurité du flux

```text
Audit Etsy (sans IA)
  → sélection des fiches et langues
  → création d’un lot persistant
  → génération séquentielle
  → aperçu prêt
  → validation humaine explicite
  → publication Etsy
```

Une génération ne publie jamais automatiquement. Le lot massif reste bloqué tant que les glossaires et blocs fixes sélectionnés portent encore `STATUS: DRAFT`.

Le lot test historique reste lisible dans la base pour traçabilité, mais ses commandes ont été retirées de l’interface de production.

## Persistance et idempotence

La base `.localization_backfill.sqlite3` conserve :

- les snapshots du catalogue ;
- les lots ;
- chaque paire fiche/langue ;
- le hash de la source FR ;
- la version agrégée des prompts ;
- les aperçus, usages, erreurs et tentatives.

Chaque lot terminé produit également une archive JSON dans `data/localization_backfill/reports/`. Cette archive contient les sources françaises, toutes les sorties du lot, les usages, les avertissements et les erreurs. Elle est conservée localement et ignorée par Git. Le bouton **Télécharger le rapport du lot** télécharge l’instantané du lot actuellement affiché, y compris lorsqu’il est encore partiel.

Au redémarrage, un job interrompu revient dans sa file. Une même fiche/langue ne peut pas être recréée avec le même hash source et la même version de prompt tant qu’un job exploitable existe déjà.

## Architecture éditoriale

Les couches injectées, dans l’ordre :

1. `prompts/gpt/localisation_backfill/common.md`
2. `prompts/gpt/localisation_backfill/modes/collection.md`
3. couche boutique active :
   - `prompts/gpt/localisation_backfill/shops/grosgeek.md`, ou
   - `prompts/gpt/localisation_backfill/shops/doublex.md`
4. `prompts/gpt/localisation_backfill/fields.md`
5. `prompts/gpt/localisation_backfill/glossaries/_shared.md`
6. `prompts/gpt/localisation_backfill/glossaries/<langue>.md`
7. `prompts/gpt/localisation_backfill/fixed_blocks/<langue>.md`
8. objet source JSON de la fiche

Le contenu des glossaires et le mode de conservation des blocs fixes ont été préparés avec ChatGPT puis validés sur quatre fiches représentatives.

## Brief à donner à ChatGPT

Pour chaque langue, ChatGPT doit compléter les deux fichiers correspondants sans modifier les autres couches.

### Glossaire

- terminologie réellement employée par les collectionneurs, peintres et amateurs de garage kits du marché cible ;
- distinction figurine, statue, miniature, garage kit, modèle non peint, assemblage et rendu 3D ;
- vocabulaire peinture, préparation, résine et collection ;
- formulations de recherche naturelles ;
- faux amis, traductions littérales à éviter et termes interdits ;
- aucune règle de structure déjà couverte par le socle commun.

### Blocs fixes

- localiser les blocs récurrents Collection de Gros Geek Industrie ;
- préserver intégralement faits, normes, sécurité, Fan Art, atelier, préparation et service client ;
- fournir une rédaction canonique, stable, destinée à être réutilisée à l’identique ;
- conserver une respiration lisible entre les blocs.

Après validation humaine, remplacer `STATUS: DRAFT` par `STATUS: VALIDATED` dans les deux fichiers de la langue.

## Étapes suivantes

1. choisir la stratégie de reprise des traductions existantes ;
2. lancer le backfill catalogue par lots persistants ;
3. contrôler les avertissements non bloquants et les éventuels rejets Etsy ;
4. conserver le futur audit des tags français pour un chantier ultérieur.

## Validation éditoriale du 28 août 2026

Le lot de quatre fiches et quarante localisations est validé avec une note globale de 8,5/10. Les glossaires et le mode de conservation des blocs fixes portent désormais `STATUS: VALIDATED`.

Décisions conservées :

- tags limités à 30 caractères par le pipeline, sans raccourcissement automatique à 20 caractères ;
- moins de 13 tags autorisés lorsque la source française en contient moins ;
- aucune invention automatique de tags supplémentaires ;
- conservation des emojis structurants contrôlée par un avertissement non bloquant ;
- recherche de quelques résidus français manifestes sous forme d’avertissement non bloquant ;
- futur audit des fiches françaises comportant moins de 13 tags explicitement reporté après le backfill.

## Premier lot de production

Le premier lot produit 170 localisations exploitables sur 172, soit 98,8 %. Les deux rejets proviennent exclusivement de tags supérieurs à la limite interne de 30 caractères. Les sorties de ce lot ne sont pas corrigées automatiquement.

Règles générales ajoutées pour les lots suivants :

- localisation obligatoire du libellé `Sculpteur:` dans les dix langues ;
- portugais : employer `renderizações 3D`, jamais `rendimentos 3D` ;
- suppression de toute phrase dépendant d’une donnée dynamique vide ;
- diagnostic précis des titres et tags hors limite, avec valeur et longueur ;
- conservation de la réponse brute lorsqu’une sortie est rejetée par le parseur.

## Deuxième lot de production

Le deuxième lot publie 172 localisations sur 175, soit 98,3 %. Les trois rejets proviennent encore exclusivement de tags supérieurs à 30 caractères. Aucun reliquat `Sculpteur`, aucune perte d’emoji ou de bloc, aucune phrase à donnée vide et aucune régression sur `renderizações 3D` ne sont détectés.

Calibrations générales ajoutées :

- suédois : `Målningstips`, jamais `Målingstips`, et pas d’anglicisme `statue` ;
- portugais : `renderizações 3D apresentadas` avec accord féminin ;
- néerlandais : `verzamelfiguur`, jamais `verzameliguur` ;
- polonais : `Niepomalowany zestaw`, jamais `Niezamalowany zestaw`, et pas d’anglicisme `statue` ;
- japonais et contrat commun : conservation stricte des barres obliques dans les échelles telles que `1/6` et `1/8`.

## Troisième lot de production

Le troisième lot publie 191 localisations sur 202, soit 94,6 %. Dix écritures Etsy échouent avec une réponse HTTP 400 dont le corps n’était pas encore conservé, et une sortie russe contient un caractère de contrôle JSON invalide. Le contenu publié reste évalué autour de 8/10.

Renforcements généraux :

- normalisation déterministe des coquilles déjà validées en PL, SV, PT et NL, même lorsque le modèle ignore le glossaire ;
- déduplication déterministe des tags avant validation ;
- lecture tolérante des caractères de contrôle JSON non échappés ;
- avertissement lorsque les échelles ou notations techniques du titre sont altérées ;
- conservation du corps détaillé des futurs rejets HTTP Etsy ;
- suppression des seuls libellés d’univers vides, sans toucher aux autres rubriques comme les dimensions.

## Clôture Collection Gros Geek — 29 août 2026

Le backfill Collection de Gros Geek Industrie est terminé.

- 297 fiches actives relues lors de l’audit Etsy final ;
- 241 fiches éligibles après exclusion de Nerikson, Energixon et Rescale Miniatures ;
- 241 fiches éligibles complètes dans les dix langues cibles ;
- zéro fiche éligible et zéro langue encore manquante ;
- 1 984 localisations générées et publiées au cours des dix lots de production ;
- les quatre dernières absences ont été réparées individuellement : Evie/PT,
  Sora vs Roxas/ES et A2/IT+NL.

Le double contrôle de clôture reconstruit les sorties finales depuis les rapports
de lots puis applique chronologiquement tous les journaux de réparation. Son
rapport durable est écrit dans
`data/localization_backfill/audits/collection-grosgeek-closure-20260829.json`.

État après contrôle et réparations :

- 1 984 sorties finales retrouvées sur 1 984 attendues ;
- zéro contrôle qualité bloquant ;
- zéro reliquat parmi les coquilles déterministes déjà connues ;
- les avertissements `incomplete_tag_count` restent non bloquants, conformément
  à la décision produit de ne pas inventer automatiquement des tags ;
- la perte d’un emoji structurant isolé reste un avertissement non bloquant ;
- plusieurs emojis perdus, une échelle absente, un alphabet parasite ou une
  description anormalement courte restent bloquants.

Les scripts de clôture et leurs journaux sont conservés pour assurer la
traçabilité des publications correctives, sans modifier l’historique des lots.

## Extension Collection Double X — 29 août 2026

Double X réutilise le socle Collection, les glossaires linguistiques, les blocs
fixes et les garde-fous techniques validés lors du backfill Gros Geek. Une
surcouche boutique séparée ajoute le lexique adulte et les contraintes Etsy :

- tag exact `mature`, non traduit, uniquement lorsque la source française le
  contient déjà et toujours inclus dans le maximum de 13 tags ;
- jusqu'à 13 tags distincts ; une source non mature peut rester sous 13 plutôt
  que de recevoir artificiellement le tag `mature` ;
- distinction stricte entre `NSFW`, `waifu`, `pin-up`, `sexy`, `nude` et
  `topless` ;
- vocabulaire pornographique interdit ;
- rédaction élégante centrée sur la sculpture, la peinture et la collection.

Le changement de boutique dans l'interface recharge désormais le catalogue,
la configuration éditoriale et le dernier lot de cette boutique uniquement.
Un lot Gros Geek ne peut donc pas apparaître ni être repris depuis Double X, et
inversement.

### Premier lot Double X

Le premier lot publie 173 localisations sur 175, soit 98,9 %, avec une qualité
éditoriale évaluée à 8,5/10. Les 173 sorties publiées possèdent exactement 13
tags distincts et le tag réglementaire exact `mature` une seule fois.

- Purah/PL est bloquée pour description vide ;
- Crimson Pilot/IT est bloquée pour absence de `mature` ;
- le glossaire néerlandais impose désormais `figuur` ou `verzamelfiguur` à la
  place du nom commun français `figurine` ;
- le terme international `nude` reste autorisé lorsqu'il est pertinent.

Contrôle néerlandais consécutif au lot : trois fiches Double X contenaient encore
le nom commun français `figurine` (Albedo, La Rose fatale et Selena). Elles ont
été régénérées et publiées individuellement après renforcement du glossaire ;
les trois nouvelles sorties contiennent zéro occurrence générique résiduelle.

Le même contrôle local, sans appel IA, a identifié puis fait reprendre onze
sorties néerlandaises Gros Geek, sans confondre les noms propres protégés comme
`Neko Figurines` avec le nom commun français :

- `4559626640`, `4483396543`, `4445514424`, `4443830239` ;
- `4443824604`, `4424185622`, `4389624076`, `4359141433` ;
- `4358561840`, `4334263632`, `4324233643`.

La réparation est terminée et publiée pour ces onze localisations NL. Le
contrôle final constate zéro occurrence générique de `figurine` et confirme que
`Neko Figurines` est conservé exactement. Une normalisation déterministe protège
désormais les noms propres connus avant de remplacer le nom commun néerlandais,
puis restaure leur graphie officielle. Aucun nouveau backfill complet et aucune
autre langue n'ont été régénérés.

### Deuxième lot Double X et réparation de la politique `mature`

Le deuxième lot a révélé 27 rejets, dont 24 provenaient d'une règle erronée :
le validateur imposait `mature` à toute la boutique et certaines sorties
l'ajoutaient comme quatorzième tag. La source française fait désormais seule
autorité : `mature` doit être conservé exactement une fois s'il est présent et
ne doit jamais être inventé s'il est absent.

Une reprise idempotente a contrôlé les deux premiers lots, retiré les tags
`mature` indus et normalisé les dépassements sans appel IA. Elle a republié 138
localisations. Les trois véritables anomalies restantes (Lara Croft/IT,
Maruzensky/SV et Ghishlaine/RU) ont été régénérées puis publiées séparément.

Audit final : 368 localisations effectives sur 368 attendues, zéro langue
manquante, zéro désaccord avec la politique `mature`, zéro doublon et aucun lot
de plus de 13 tags. Le journal durable est conservé dans
`data/localization_backfill/repairs/doublex-mature-policy-ledger.json`.

### Clôture Collection Double X

Le dernier lot a publié 62 localisations sur 66. Les quatre rejets étaient
uniquement dus à un tag localisé de 31 ou 32 caractères. Ils ont été remplacés
manuellement par des formulations naturelles de la même intention SEO, sans
troncature et sans doublon, puis publiés individuellement.

Le contrat commun demande désormais au modèle de reformuler entièrement tout
tag qui dépasserait 30 caractères, en conservant son intention et en vérifiant
qu'il ne duplique aucun autre tag. L'audit effectif du dernier lot confirme 66
publications sur 66, aucun tag trop long, aucun doublon et aucune divergence de
la politique `mature`. Le journal de clôture est conservé dans
`data/localization_backfill/repairs/doublex-final-collection-overlong-tags.json`.

## Automatisation après création d'un brouillon Collection

La publication d'un nouveau brouillon Collection, sur Gros Geek ou Double X,
enregistre désormais sa fiche dans une file persistante. Tabletop reste
explicitement exclu tant que son corpus éditorial n'est pas validé.

Le surveillant ne relit jamais tout le catalogue : il interroge uniquement les
identifiants présents dans la file, regroupés dans une requête Etsy toutes les
cinq minutes. Lorsqu'une fiche devient active, son titre, sa description et ses
tags français doivent rester inchangés pendant vingt minutes avant génération.
Toute modification Etsy remet ce délai à zéro.

Le traitement réutilise exactement les prompts, glossaires, validateurs et
blocs fixes du backfill Collection de la boutique concernée. Juste avant la
publication des dix langues, la source Etsy est relue une dernière fois. Si son
empreinte a changé, les sorties devenues obsolètes ne sont pas publiées et la
fiche repart dans la phase de stabilité.

La base SQLite conserve les états et permet la reprise après redémarrage :

```text
attente d'activation → stabilité → génération → publication → terminé
                                         ↘ intervention requise
```

Le troisième écran **Automatisation** de l'onglet Traduction affiche les dix
langues séparément. Une ligne saine reste compacte ; une ligne ne devient
dépliable que lorsqu'une intervention est nécessaire. Les erreurs conservent
le détail du validateur ou le corps de la réponse Etsy, la sortie générée et
les usages. Les actions permettent de relancer une langue, toutes les langues
échouées, de préparer la fiche dans le traducteur individuel et de télécharger
un rapport JSON ciblé.
