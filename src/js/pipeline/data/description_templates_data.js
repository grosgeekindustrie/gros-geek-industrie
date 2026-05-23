'use strict';

// Blocs fixes utilises pour assembler la description Etsy finale autour de la sortie pipeline.

(function initPipelineUIDataDescriptionTemplates(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataDescriptionTemplates = global.PipelineUIDataDescriptionTemplates || {};

  const WHAT_YOU_RECEIVE_LINES = Object.freeze([
    '✅ Ce que tu reçois:',
    '• Une figurine physique en résine à peindre (garage kit)',
    '• Kit non peint : les visuels colorés sont des rendus 3D présentés à titre d’inspiration',
    '• Nettoyée et préparée : prête pour sous-couche et peinture',
    '• Emballage sécurisé + protection des pièces fines',
  ]);

  const EXPERIENCE_BLOCK = Object.freeze([
    '🏆 L’expérience Gros Geek Industrie',
    '',
    'Plusieurs centaines d’avis 5 étoiles témoignent de la qualité et du sérieux de notre atelier.',
    'Chaque figurine est préparée, nettoyée et testée à sec pour garantir un montage propre et agréable.',
    'Les pièces fines ou fragiles sont fournies en double lorsque nécessaire, afin d’assurer une expérience sans stress et parfaitement adaptée aux peintres passionnés.',
  ].join('\n'));

  const CLIENT_INFORMATION_BLOCKS = Object.freeze([
    Object.freeze([
      'ℹ️ Modèle à peindre – Garage kit à assembler',
      '',
      '✔️ Nos figurines sont livrées sous forme de garage kits : à monter et à peindre soi-même.',
      '🎨 Les visuels colorés sont des rendus 3D présentés à titre d’inspiration.',
      '🖌️ Exprime ta créativité et donne vie à ta pièce avec ta propre palette de couleurs.',
    ].join('\n')),
    Object.freeze([
      '🎨 Résine 14K HD – Détails nets, structure fiable',
      '',
      'Chaque modèle est imprimé en résine 14K haute définition pour capturer les plus fines textures, gravures et expressions.',
      'Notre mélange exclusif 14K + résine renforcée améliore la solidité tout en offrant une légère flexibilité sur les pièces fines - un équilibre idéal entre précision et durabilité.',
    ].join('\n')),
    Object.freeze([
      '🖌️ Résine pensée pour la peinture',
      '',
      'Résine photopolymère premium, parfaitement compatible avec les peintures acryliques.',
      'Surface lisse et propre pour une accroche optimale des primers, lavis, glacis et dégradés.',
      'Chaque kit est conçu pour offrir une expérience de peinture fluide et agréable, quel que soit ton niveau.',
    ].join('\n')),
    Object.freeze([
      '✅ Contrôle qualité exigeant',
      '',
      'Chaque tirage est inspecté pièce par pièce avant expédition.',
      'Aucune figurine ne quitte l’atelier sans respecter nos standards de finition élevés :',
      'zéro bulle, zéro déformation, ajustements testés à sec.',
    ].join('\n')),
    Object.freeze([
      '⚙️ Préparée, nettoyée, prête à peindre',
      '',
      '• Supports retirés proprement',
      '• Nettoyage + post-traitement UV complet',
      '• Un léger ponçage de surface suffit avant sous-couche',
      '🧼 Fini les longues étapes de préparation : tu peux passer directement à la peinture.',
    ].join('\n')),
    Object.freeze([
      '🧩 Montage simple et intuitif',
      '',
      'Les points de jonction sont pensés pour s’aligner naturellement.',
      'Un léger ajustement peut être nécessaire selon les kits.',
      '💡 Colle recommandée : superglue (cyanoacrylate).',
    ].join('\n')),
    Object.freeze([
      '🎭 Poses équilibrées et expressives',
      '',
      'Chaque sculpture est sélectionnée pour son impact visuel :',
      'posture maîtrisée, lignes fluides, expressivité juste - au service de ta vitrine ou de ton diorama.',
    ].join('\n')),
    Object.freeze([
      '📏 Échelles disponibles',
      '',
      'Nos modèles sont proposés dans plusieurs formats standards (1:6, 1:8, 1:10...) pour s’adapter à tous les espaces : vitrines, décors ou jeux de rôle.',
      '🛠️ Besoin d’une échelle personnalisée ? Il suffit de nous contacter.',
    ].join('\n')),
    Object.freeze([
      '🎁 Un projet personnel ou un cadeau unique',
      '',
      'Idéal pour les hobbyistes, peintres et collectionneurs.',
      'À offrir ou à monter soi-même pour enrichir ta collection et ton expérience de peinture.',
    ].join('\n')),
    Object.freeze([
      '♻️ Fan Art - Soutien aux artistes indépendants',
      '',
      'Nos modèles sont des Fan Arts non officiels, créés par des sculpteurs indépendants.',
      'Nous soutenons leur travail via des plateformes comme Patreon ou MyMiniFactory, afin de valoriser la création originale.',
    ].join('\n')),
    Object.freeze([
      '💰 Une alternative artisanale et qualitative',
      '',
      'Certaines figurines officielles sont rares ou coûteuses.',
      'Nous proposons des modèles inspirés et accessibles, produits en France, avec la même exigence de finition qu’un tirage professionnel.',
    ].join('\n')),
    Object.freeze([
      '📩 Service client réactif',
      '',
      'Une question ? Une demande de personnalisation ?',
      '📬 Écris-nous directement sur Etsy - réponse rapide garantie, avant ou après ta commande.',
    ].join('\n')),
    Object.freeze([
      '⚖️ Usage et sécurité',
      '',
      '• Produit destiné aux collectionneurs et modélistes',
      '• Non adapté aux enfants de moins de 14 ans',
      '• Résines conformes RoHS & REACH',
      '• Fabrication additive selon la norme ISO / ASTM 52900',
    ].join('\n')),
  ]);

  Object.assign(global.PipelineUIDataDescriptionTemplates, {
    WHAT_YOU_RECEIVE_LINES,
    EXPERIENCE_BLOCK,
    CLIENT_INFORMATION_BLOCKS,
  });

  Object.assign(global.PipelineUIData, {
    descriptionTemplates: global.PipelineUIDataDescriptionTemplates,
  });
})(window);
