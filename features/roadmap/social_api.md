# social_api.md

## Objectif

Recap opérationnel des contraintes API pour publier depuis le local sur :
- Instagram
- Facebook
- Pinterest

Ce document sert de base pour les futurs agents et pour l'implémentation locale.
Il ne décrit pas le wording marketing des posts. Il décrit :
- les prérequis
- les contraintes techniques
- les flux de publication
- les points de vigilance
- le MVP conseillé

---

## 1. Principe général

Pour ce projet, il faut distinguer clairement 3 couches :

### 1. Génération éditoriale
Le LLM produit un **package social maître** :
- hook
- caption longue
- caption courte
- CTA
- hashtags
- langues
- notes d'intention
- médias pressentis

### 2. Rendu plateforme
Le local transforme ce package en version :
- Instagram
- Facebook
- Pinterest

### 3. Publication API
Le local gère :
- l'authentification
- le choix du compte / de la page / du board
- l'upload média
- la création du post ou du pin
- le suivi du statut
- les erreurs

Le LLM ne doit pas piloter directement la publication API.
Le LLM produit le contenu. Le code local gère le publish.

---

## 2. Choix MVP recommandé

### Plateformes à brancher en premier
1. **Facebook**
2. **Instagram**
3. **Pinterest**

### Pourquoi cet ordre
- Facebook et Instagram partagent l'écosystème Meta
- Pinterest a son propre système mais reste cohérent pour du contenu visuel produit
- ce trio correspond déjà aux réseaux actifs de la marque

### MVP réaliste
Le MVP doit faire :
- génération d'un package social maître
- rendu par plateforme
- preview locale
- validation humaine
- publication directe
- stockage du statut

Le MVP ne doit pas essayer de faire dès le départ :
- analytics avancées
- réponses aux commentaires
- automation sans validation
- batch complexe multi-réseaux

---

## 3. Meta : Facebook + Instagram

## 3.1 Vue d'ensemble
Meta doit être pensé comme un **connecteur commun**, avec deux publishers :
- Facebook Publisher
- Instagram Publisher

Le local doit pouvoir :
- se connecter à Meta
- récupérer les Pages disponibles
- récupérer le compte Instagram professionnel lié si nécessaire
- publier soit sur Facebook, soit sur Instagram

---

## 3.2 Facebook API — contraintes principales

### Usage visé
Publication sur une **Page Facebook**.

### Ce que l'API doit permettre
- créer un post de Page
- publier du contenu texte
- publier des médias selon le flux choisi
- éventuellement programmer
- lire le statut / récupérer l'identifiant du post

### Permissions à prévoir
La permission la plus directement liée à la publication est :
- `pages_manage_posts`

Selon les workflows, il faut aussi prévoir que l'app puisse avoir besoin de scopes liés à la découverte et la gestion des Pages, par exemple :
- `pages_show_list`
- `pages_read_engagement`
- éventuellement d'autres permissions Pages selon les besoins exacts du connecteur

### Token
Le système doit être capable de travailler avec :
- un token utilisateur Meta pour le login
- puis un **Page Access Token** pour publier sur la Page cible

### Risques
- permissions insuffisantes
- mauvais token
- Page non sélectionnée
- contenu refusé ou erreur de payload
- quotas / rate limits

---

## 3.3 Instagram API — contraintes principales

### Usage visé
Publication sur un **compte Instagram professionnel**.

### Point important
Meta propose aujourd'hui plusieurs manières d'intégrer Instagram.
Pour le projet, il faut viser une intégration simple et robuste, alignée avec le compte pro réellement utilisé.

### Ce que l'API doit permettre
- publier image simple
- publier vidéo / reel si besoin plus tard
- publier carrousel plus tard si nécessaire
- récupérer l'identifiant de publication
- gérer le statut du publish

### Permissions à prévoir
La permission centrale à prévoir pour publier est :
- `instagram_business_content_publish`

Selon la méthode de login et le compte utilisé, d'autres permissions liées à l'accès au compte pro seront nécessaires.

### Préconditions de compte
Le compte doit être un **compte professionnel Instagram**.
Selon le setup Meta choisi, le compte peut aussi devoir être lié à une Page Facebook ou à une configuration Meta compatible avec le mode de login retenu.

### Limitations utiles à garder en tête
- Meta applique une limite de publication API sur fenêtre glissante de 24h
- les carrousels sont gérés comme un type particulier de publication
- certaines publications nécessitent un flux en 2 temps : création du container puis publication
- certaines contraintes peuvent dépendre du format média choisi

### Risques
- compte non éligible
- permissions manquantes
- container média créé mais publish final refusé
- limite de publication atteinte
- problème de format média
- problème de workflow image / vidéo / carousel

---

## 3.4 Ce qu'il faut modéliser côté Meta

### Connecteur Meta
État minimal :
- non connecté
- connecté
- permissions insuffisantes
- page non sélectionnée
- prêt à publier

### Ressources à stocker
- user meta id
- page id
- page access token
- instagram account id si disponible
- permissions accordées
- date d'expiration / refresh si applicable

### Publishers distincts
Même si l'auth est commune, il faut deux publishers distincts :
- `publishFacebookPost()`
- `publishInstagramPost()`

---

## 4. Pinterest API

## 4.1 Vue d'ensemble
Pinterest doit être un connecteur séparé.

### Usage visé
Créer un **Pin** sur un **board** ou une **section de board**.

### Ce que l'API doit permettre
- authentifier l'utilisateur Pinterest
- récupérer les boards disponibles
- créer un Pin
- éventuellement uploader / référencer le média selon le flux choisi
- récupérer l'identifiant du Pin

---

## 4.2 Contraintes principales

### Authentification
Pinterest repose sur OAuth 2.0.
L'app doit obtenir un access token valide avant d'appeler l'API au nom de l'utilisateur.

### Scopes
Pour un MVP publication, les scopes à prévoir tournent autour de :
- `pins:write`
- `pins:read`
- et potentiellement `boards:read` / `boards:write` selon le besoin de lister ou créer des boards

### Publication
Le flux de base est :
- choisir un board
- fournir les données du Pin
- créer le Pin

### Risques
- token invalide ou expiré
- board absent / mauvais board
- scope insuffisant
- payload média invalide
- contraintes de format ou d'upload non respectées

---

## 4.3 Ce qu'il faut modéliser côté Pinterest

### Connecteur Pinterest
État minimal :
- non connecté
- connecté
- scopes insuffisants
- board non sélectionné
- prêt à publier

### Ressources à stocker
- user pinterest id
- access token
- refresh token si disponible
- boards accessibles
- board par défaut éventuel

### Publisher
- `publishPinterestPin()`

---

## 5. Contraintes médias communes

Le contenu social étant visuel, le vrai point de friction n'est pas seulement le texte, c'est le média.

Le local doit prévoir un vrai pipeline média.

### Ce qu'il faut stocker pour chaque draft social
- liste des médias source
- ordre des médias
- type média : image / vidéo
- format final retenu
- variante par plateforme si nécessaire

### Pourquoi c'est important
Instagram, Facebook et Pinterest ne manipulent pas exactement le média de la même manière.
Donc le système doit pouvoir dire pour chaque plateforme :
- quel média publier
- dans quel ordre
- avec quel format

### Recommandation
Le package social maître doit référencer des `media_ids`, pas des chemins bricolés en dur dans le texte.

---

## 6. Contraintes de workflow

Le local ne doit pas traiter la publication comme un simple bouton unique.

### Workflow conseillé
1. génération du package social maître
2. rendu plateforme
3. preview
4. validation humaine
5. publication
6. stockage du résultat

### Statuts recommandés
- `draft`
- `rendered`
- `approved`
- `publishing`
- `published`
- `failed`
- `scheduled`
- `cancelled`

### Pourquoi
Certaines plateformes utilisent des flows synchrones, d'autres non.
Même quand le publish semble simple, il faut garder un état local propre.

---

## 7. Contraintes de sécurité

### À ne jamais faire
- stocker les tokens en dur dans le code front
- loguer les tokens dans la console sans protection
- mélanger texte, credentials et logique API dans un seul module

### À faire
- stocker les credentials dans une config locale sécurisée
- séparer auth / render / publish / storage
- prévoir un mécanisme de refresh ou de reconnexion
- garder un log d'erreurs propre sans exposer les secrets

---

## 8. Contraintes UX locales

L'interface locale doit rendre les statuts évidents.

### Minimum utile
- plateforme sélectionnée
- compte connecté
- page / compte IG / board sélectionné
- média retenu
- preview texte
- bouton publier
- bouton programmer
- statut final
- message d'erreur lisible

### Pourquoi
Les API sociales échouent souvent pour des raisons banales :
- mauvais compte
- mauvaise permission
- média non compatible
- token expiré
- page ou board non choisi

L'UX doit permettre de comprendre ça sans fouiller dans le code.

---

## 9. Structure logicielle recommandée

```text
social/
  js/
    social-package-builder.js
    social-renderers.js
    social-storage.js
    social-ui.js

    connectors/
      meta-auth.js
      meta-facebook-publisher.js
      meta-instagram-publisher.js
      pinterest-auth.js
      pinterest-publisher.js

    queue/
      social-queue.js
      social-status.js
```

---

## 10. Package social maître — minimum viable

Le package social maître doit rester indépendant des APIs.

### Champs minimums
- `listing_id`
- `product_name`
- `sculptor`
- `post_family`
- `positioning`
- `media_ids`
- `fr.hook`
- `fr.caption_long`
- `fr.caption_short`
- `fr.cta`
- `fr.hashtags[]`
- `en.hook`
- `en.caption_long`
- `en.caption_short`
- `en.cta`
- `en.hashtags[]`
- `status`

### Pourquoi
Le LLM produit une matière réutilisable.
Les connecteurs convertissent cette matière en payload API.

---

## 11. Stratégie d'implémentation recommandée

### Phase 1
- package social maître
- renderers Instagram / Facebook / Pinterest
- preview locale
- validation humaine
- copie manuelle possible

### Phase 2
- auth Meta
- auth Pinterest
- publication Facebook
- publication Instagram
- publication Pinterest

### Phase 3
- scheduling
- retry
- historique complet
- duplication / repost

### Phase 4
- optimisation UX
- logs détaillés
- éventuellement analytics plus tard

---

## 12. Limites à accepter dès le départ

### 1. Les APIs changent
Permissions, flows, quotas et prérequis évoluent.
Il faudra toujours re-vérifier les docs officielles avant l'implémentation finale.

### 2. Le même post ne doit pas être poussé tel quel partout
Le package est commun, mais les renderers restent obligatoires.

### 3. Les médias sont aussi importants que le texte
Un bon texte ne suffit pas si le flux média est bancal.

### 4. L'automatisation totale n'est pas le bon premier objectif
Le meilleur compromis est :
- génération automatique
- preview
- validation humaine
- publication directe contrôlée

---

## 13. Décisions à prendre avant développement

### Meta
- méthode de login retenue
- compte Facebook / Page cible
- compte Instagram pro cible
- permissions demandées au MVP

### Pinterest
- compte cible
- boards à utiliser
- board par défaut ou sélection manuelle
- scopes du MVP

### Produit
- publication immédiate uniquement ou scheduling dès V1
- image unique seulement ou carrousel dès le départ
- FR uniquement au publish ou FR + EN selon plateforme

---

## 14. Résumé opérationnel

### Facebook
- probablement le plus simple pour valider le premier publisher
- publier sur une Page avec permissions adaptées
- bon candidat pour démarrer le publish direct

### Instagram
- très important pour le business
- flux plus sensible côté compte pro, permissions et média
- à brancher juste après Facebook dans le connecteur Meta

### Pinterest
- très pertinent pour du visuel produit evergreen
- connecteur séparé, plus simple conceptuellement que Meta mais avec sa propre auth
- bon troisième publisher du MVP

---

## 15. Ligne de conduite

Ne jamais faire du publisher social le centre du système.

Le centre du système doit rester :
1. la fiche produit validée
2. le package social maître
3. les renderers par plateforme
4. les publishers API

Le texte reste piloté par le pipeline.
L'API reste un canal de diffusion.
