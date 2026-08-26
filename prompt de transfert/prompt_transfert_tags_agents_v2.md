# Prompt de transfert — Etsy Pipeline — chantier TAGS (`tags_agents_2`)

## Rôle attendu du prochain agent
Tu es un partenaire technique senior, rigoureux, sobre, fiable.
Tu ne fais pas de refonte inutile.
Tu respectes strictement le rôle de chaque agent.
Tu ne mélanges jamais Explore, Filter et Select.
Tu ne rajoutes pas des règles juste pour te rassurer.
Tu avances localement, proprement, avec des changements ciblés.

Tu dois te comporter comme un vrai partenaire de maintenance :
- tu lis l’existant avant de proposer
- tu ne sur-prompts pas un agent quand le problème vient peut-être d’un autre étage
- tu ne pars pas dans une refonte globale si un réglage local suffit
- tu n’ouvres pas un chantier code lourd sans raison claire

---

## Source de vérité
### Très important
- **Les fichiers locaux sont la seule source de vérité pour modifier ou patcher.**
- Le **repo distant/public sert à comprendre l’architecture**, relire les prompts, chercher un fichier, mais **pas** à générer un patch définitif.
- L’utilisateur a déjà rappelé plusieurs fois qu’il faut **faire confiance au local**.
- Les noms de commit peuvent être dupliqués ; **le hash fait foi, pas le message**.

### Vérifications Git utiles
Quand il y a doute sur un état réel :
```bash
git log --oneline --decorate -n 5
git show --name-only --stat <HASH>
git grep -n "ConnexesPrioritaires\|CONNEXES_PRIORITAIRES" src/
```

Ne jamais conclure trop vite à partir du seul repo distant.

---

## Branche actuelle
- Branche de travail : `tags_agents_2`

---

## Contexte projet
Nous travaillons sur le pipeline TAGS de l’Etsy Pipeline.

Le trio d’agents :
- **AXEL Explore** → génère un gros pool de tags candidats
- **CÉLINE Filter** → filtre sévèrement le pool sans casser les bons angles
- **AXEL Select** → choisit les 13 tags finaux

Le sujet du moment n’est plus une refonte globale.
Le sujet est maintenant :
1. stabiliser le comportement du trio
2. garder Explore simple mais utile
3. garder Céline stricte sans la surcharger
4. vérifier que Select reste cohérent avec la structure réelle des tags

---

## Ce qui a été fait

### 1. AXEL Explore
Explore a déjà été énormément cadré.
Le cœur validé :
- structure des tags prioritaire
- pas de physique, coiffure, armes, psychologie, esthétique vague, etc.
- classes fermées
- rôle clair : produire un gros pool, pas les 13 finaux

Un essai a été fait avec :
- **fallbacks de longueur**
- structures courtes de secours très détaillées

Résultat :
- le prompt est devenu trop lourd
- Explore a commencé à bricoler n’importe quoi (`collection`, `figure`, `sculpture`, `peindre` sans `à peindre`, ordre inversé, etc.)
- **ce sur-cadrage n’a pas donné un meilleur résultat**

### Conclusion actuelle sur Explore
- L’utilisateur est revenu à une version d’Explore **qui fonctionnait mieux avant**.
- Il ne faut **pas** repartir dans une surenchère de logique de fallback ultra détaillée.
- Le problème des longueurs ne doit pas faire exploser le prompt.

**À ce stade, Explore doit rester simple, structuré, et produire assez de bon grain.**

---

### 2. CÉLINE Filter
Céline a beaucoup progressé.
Les gains déjà obtenus :
- meilleure hiérarchie
- meilleure conservation des angles forts (`à peindre`, `résine`, `impression 3d`, design officiel, cadeau fort)
- meilleur tri des connexes
- prise en compte des `CONNEXES_PRIORITAIRES`

Mais le prompt a été alourdi avec trop de couches de rejet :
- `Rejeter immédiatement`
- `Rejet dur de conformité`
- `Rejeter en priorité`

Ces blocs étaient utiles dans l’intention, mais finissent par se recouvrir.

Une version **allégée et restructurée** de Céline a été rédigée et fournie à l’utilisateur dans un fichier séparé :
- `celine_tags_filter_v2.md`

### Conclusion actuelle sur Céline
- **Céline est le vrai filet de sécurité.**
- Si Explore dégueule des tags moyens, Céline doit faire le tri.
- C’est le bon endroit pour les **rejets durs de conformité** :
  - > 30 caractères
  - `collectible`
  - `figure`
  - `sculpture`
  - `collection` à la place de `à collectionner`
  - `peindre` sans `à peindre`
  - ordre bancal
- Il faut **éviter de réempiler les blocs de rejet**.
- La tendance actuelle est de **simplifier Céline**, pas de l’alourdir encore.

---

### 3. AXEL Select
Select était historiquement trop orienté :
- “couleur d’univers”
- “lore”
- diversité sémantique un peu abstraite

Il a été recadré pour :
- choisir les meilleurs tags selon la **structure réelle validée**
- privilégier le produit, le personnage, l’usage, la matière, les angles forts, puis les connexes prioritaires
- éviter le lore pour le lore

Les derniers tests sur **Jinx** étaient plutôt bons :
- meilleure sélection finale
- bons connexes business (`Vi`, `Isha`, `Ekko`)
- bon maintien de `à peindre`, `résine`, `impression 3d`

### Conclusion actuelle sur Select
- Select a l’air **globalement crédible**.
- Il ne faut pas le casser maintenant.
- On touche Select seulement si Céline stabilisée continue à produire des pools mal arbitré.

---

## Nouveau champ ajouté : `CONNEXES_PRIORITAIRES`
L’utilisateur a ajouté un nouveau champ pour guider Explore et Céline sur les personnages connexes à privilégier.

### Intention métier
Le modèle ne peut pas deviner proprement les vrais connexes business / fandom pour chaque licence.
Exemple Jinx :
- connexes business forts : `Vi, Isha, Ekko`
- puis éventuellement `Silco`
- d’autres persos sont plus du fan service que de vrais leviers vendeurs

### Champ UI
Le champ a été ajouté dans la section **Contexte personnage**, entre le contexte et le lien.

Nom logique :
- HTML : `col-fConnexesPrioritaires`
- placeholder prompt : `[[CONNEXES_PRIORITAIRES]]`

### Câblage local déjà confirmé
Le champ a été branché localement dans :
- HTML
- `getCollectionData()`
- `saveFormState()`
- `loadFormState()`
- listeners autosave
- `buildPrompt()`

Vérification locale faite par :
```bash
git grep -n "ConnexesPrioritaires\|CONNEXES_PRIORITAIRES" src/
```

### Rôle attendu
- Explore ne doit piocher des connexes que dans cette liste
- Céline doit privilégier les connexes présents dans cette liste
- si le champ est vide, le comportement “normal” restera à cadrer plus tard

**Important : pour l’instant, le focus est le cas où ce champ est renseigné.**
Ne pas rouvrir le cas “champ vide” maintenant, sauf nécessité absolue.

---

## Problèmes actuels à régler

### Problème 1 — Longueur > 30
Le vrai plantage du moment n’est pas seulement SEO mais **budget caractères**.
Exemple avec `Leon Kennedy` et `Resident Evil` :
- plein de structures deviennent mécaniquement intenables en 30 caractères
- Explore, quand il est trop chargé, se met à bricoler des horreurs

### Ce qu’on a appris
- surcharger Explore avec une grosse logique de fallback ne marche pas bien
- demander seulement “30 caractères max” ne suffit pas toujours
- **Céline doit rejeter en dur les tags hors cadre**

### Ligne stratégique actuelle
- Explore doit rester relativement simple
- Céline doit couper fort ce qui est hors format
- on n’essaie plus de transformer Explore en parseur intelligent de longueur à tout prix

---

### Problème 2 — Reroll probablement hors pipeline complet
Il existe un doute fort sur le reroll slot par slot :
- le run normal du bloc tags passe bien par les 3 agents
- le reroll individuel semble probablement plus léger / différent
- il peut donc pousser des résultats hors cadre

Des indices :
- comportements incohérents avec les règles Explore/Céline/Select
- suspicion que le reroll ne repasse pas réellement par les 3 agents à coût égal

### Décision actuelle
- **ne pas ouvrir ce chantier maintenant**
- trop risqué, trop large, trop fatigue
- noter simplement qu’il faudra un mini chantier séparé : **audit reroll tags**

### Point d’entrée probable
Le bouton de reroll passe par :
- `src/js/ui/selections_ui.js` → `rerollTag(...)`
- `src/js/pipeline-ui.js` importe `window.PipelineUITags`

Mais **ne pas creuser maintenant** sauf demande explicite.

---

## Ce qu’il ne faut pas refaire
- ne pas retransformer Explore en usine à gaz
- ne pas empiler encore 4 couches de fallback dans Explore
- ne pas casser Select alors qu’il donne enfin de bons résultats
- ne pas croire que le repo distant reflète toujours l’état local réel
- ne pas rouvrir le chantier “champ vide pour les connexes” tant que le cas simple n’est pas stabilisé
- ne pas traiter le reroll maintenant sauf si l’utilisateur le demande clairement

---

## Direction recommandée au prochain agent

### Axe 1 — Stabiliser Céline
Point prioritaire.
Prendre la version simplifiée/allégée de Céline comme base.
Objectif :
- faire de Céline un filtre dur mais lisible
- garder le trio suivant :
  1. conformité dure
  2. tri qualité
  3. hiérarchie / arbitrage
- éviter les redondances de blocs de rejet

### Axe 2 — Ne pas sur-optimiser Explore
Ne pas repartir dans une logique de secours ultra détaillée tant que ça ne prouve pas son efficacité.
Le plus important est qu’Explore sorte un pool avec suffisamment de bons candidats.

### Axe 3 — Laisser Select respirer
Ne pas le toucher sans preuve claire.
Le dernier état testé sur Jinx était enfin bon.

---

## État mental / lecture correcte du chantier
Le chantier a convergé sur plusieurs points importants.
Il ne faut plus repartir dans un grand nettoyage théorique.
La suite doit être :
- locale
- ciblée
- disciplinée
- sobre

Le vrai objectif n’est pas la perfection absolue.
Le vrai objectif est :
- un Explore assez bon
- une Céline solide
- un Select crédible
- sans exploser le coût en tokens
- sans ouvrir un chantier code lourd sur le reroll maintenant

---

## Résumé ultra-court
- Branche : `tags_agents_2`
- Local = vérité, distant = lecture / architecture
- Explore a été surchargé puis partiellement “revenu en arrière”
- Céline est maintenant le vrai levier de conformité
- Select est globalement crédible
- `CONNEXES_PRIORITAIRES` a été ajouté et branché localement
- Le cas “champ vide” est à traiter plus tard
- Le reroll semble suspect mais **hors chantier actuel**
- Priorité suivante : **stabiliser la version allégée de Céline**

