# Plan de réduction des coûts pipeline — post-roadmap

## Objectif
Réduire le coût moyen d’un run complet sans dégrader la qualité perçue, la stabilité du pipeline, ni la lisibilité du debug.

Ordre de priorité :
1. réduire les sorties inutiles
2. réduire le nombre d’appels
3. compresser le contexte variable
4. auditer les prompts fixes et les bibliothèques

---

## 1. Réduire les sorties inutiles

### Pourquoi
Plusieurs agents génèrent davantage que ce qui est réellement conservé ensuite.
Exemples :
- l’agent **titre** sort plusieurs propositions alors qu’une seule version validée est gardée à la fin
- les blocs **accroches / CTA** servent surtout à la sélection puis à l’assemblage
- certains agents restent trop verbeux par rapport à leur utilité réelle

### Actions
- réduire le nombre de variantes générées par défaut
- raccourcir les formats de sortie intermédiaires
- imposer des plafonds de sortie par agent
- éviter les formulations longues quand une structure compacte suffit

### Gains attendus
- baisse directe du coût
- baisse de latence
- moins de texte à transporter dans les étapes suivantes

---

## 2. Réduire le nombre d’appels

### Pourquoi
Le plus gros levier structurel est le nombre total de requêtes modèle.
Le cas principal aujourd’hui est le trio **tags** :
- explore
- filter
- select

Si un seul agent, ou deux agents, permettent d’obtenir un résultat assez bon, le gain sera important.

### Actions
- tester une version **tags mono-agent**
- si insuffisant, tester une version **tags 2 agents**
- ne conserver le trio complet que si le gain qualité est réellement mesuré

### Gains attendus
- économie sur input + output
- économie sur la latence
- réduction de la complexité runtime
- réduction du contexte cumulatif

---

## 3. Compresser le contexte variable

### Pourquoi
Le bloc fixe partagé est déjà bien géré par le cache.
Le vrai danger est ce qui grossit au fil du run : sorties intermédiaires, contexte cumulatif, brut réinjecté trop largement.

### Actions
- remplacer les gros blocs bruts par des résumés structurés
- éviter de réinjecter des listes complètes quand un condensé suffit
- raccourcir le contexte transmis aux agents tardifs
- privilégier les synthèses utiles plutôt que les verbatims complets

### Gains attendus
- baisse du coût sur les étapes tardives
- pipeline plus stable
- moins de dérive verbale

---

## 4. Auditer les prompts fixes et les bibliothèques

### Pourquoi
Les blocs comme `objectif.md`, `psyco.md` et certaines biblios peuvent peser lourd, surtout sur les runs froids ou après expiration du cache.
Ils doivent être jugés sur leur impact réel, pas sur leur confort théorique.

### Actions
- auditer chaque bloc fixe selon le ratio **poids / utilité réelle**
- supprimer ce qui rassure mais n’améliore pas clairement la qualité
- ne garder que les biblios qui influencent vraiment le résultat
- charger certaines biblios uniquement pour certains agents, pas pour tout le pipeline

### Gains attendus
- baisse du coût des runs froids
- prompts plus nets
- meilleur contrôle du système

---

## Ordre d’exécution recommandé

### Phase A
Réduire les sorties et poser des caps de sortie par agent.

### Phase B
Tester une version simplifiée des tags :
- 1 agent
- puis 2 agents si nécessaire

### Phase C
Compresser le contexte variable des étapes tardives.

### Phase D
Auditer `objectif.md`, `psyco.md` et les bibliothèques.

---

## Règle de décision
Toute optimisation doit passer ce test :
- coût en baisse
- qualité stable ou quasi stable
- latence en baisse ou stable
- debug pas plus complexe

Si un gain économique abîme trop la qualité ou rend le pipeline illisible, on ne garde pas.

---

## Cible réaliste
Point de départ observé : **18 à 22 ct** le run complet.

Cible réaliste à moyen terme :
- première baisse par réduction des sorties inutiles
- deuxième baisse par simplification du trio tags
- troisième baisse par caps de sortie et compression du contexte
- quatrième baisse par audit des prompts fixes

---

## Conclusion
Le chantier de réduction de coût ne doit pas commencer par une refonte large.
Le bon ordre est :
1. couper ce qui sort pour rien
2. couper les appels inutiles
3. compresser le variable
4. alléger le fixe

C’est ce plan qui devra être repris **après la roadmap**.
