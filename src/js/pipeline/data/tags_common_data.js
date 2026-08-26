'use strict';

// Tags transverses reutilisables dans la selection manuelle.

(function initPipelineUIDataTagsCommon(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataTagsCommon = global.PipelineUIDataTagsCommon || {};

  const tabletopCommonProductTags = Object.freeze([
    'miniature tabletop',
    'miniature ttrpg',
    'miniature dnd',
    'figurine dnd',
    'figurine jdr',
    'figurine rpg',
    'figurine tabletop',
    'figurine wargame',
    'figurine wargaming',
    'miniature fantasy',
    'miniature de jeu',
    'miniature \u00e0 peindre',
    'miniature non peinte',
    'miniature en r\u00e9sine',
    'figurine \u00e0 peindre',
    'figurine non peinte',
    'figurine en r\u00e9sine',
    'donjons et dragons',
    'cadeau donjon dragon',
    'cadeau Dungeon Master',
  ]);

  const collectionCommonProductTags = Object.freeze([
    'impression 3D en r\u00e9sine',
    'figurine de collection',
    'statue de collection',
    'garage kit de collection',
    'figurine \u00e0 peindre',
    'statue \u00e0 peindre',
    'garage kit \u00e0 peindre',
    'figurine non peinte',
    'statue non peinte',
    'garage kit non peint',
    'figurine pr\u00eate \u00e0 peindre',
    'statue pr\u00eate \u00e0 peindre',
    'garage kit pr\u00eat \u00e0 peindre',
    'figurine en r\u00e9sine',
    'statue en r\u00e9sine',
    'garage kit en r\u00e9sine',
    'garage kit r\u00e9sine',
    'cadeau peintre',
    'cadeau geek',
    'cadeau collectionneur',
  ]);

  const doublexTabletopCommonProductTags = Object.freeze([
    'cadeau donjon dragon',
    'cadeau Dungeon Master',
    'donjons et dragons',
    'figurine \u00e0 peindre',
    'figurine dnd',
    'figurine jdr',
    'figurine NSFW',
    'figurine non peinte',
    'figurine pin-up',
    'figurine rpg',
    'figurine sexy',
    'figurine tabletop',
    'figurine waifu',
    'figurine wargame',
    'figurine wargaming',
    'garage kit NSFW',
    'mature',
    'miniature \u00e0 peindre',
    'miniature de jeu',
    'miniature dnd',
    'miniature en r\u00e9sine',
    'miniature fantasy',
    'miniature mature',
    'miniature non peinte',
    'miniature NSFW',
    'miniature pin-up',
    'miniature sexy',
    'miniature tabletop',
    'miniature ttrpg',
    'NSFW \u00e0 peindre',
    'pin-up \u00e0 peindre',
    'waifu miniature',
  ]);

  const doublexCollectionCommonProductTags = Object.freeze([
    'mature',
    'impression 3D',
    'impression 3D en r\u00e9sine',
    'figurine en r\u00e9sine',
    'statue en r\u00e9sine',
    'garage kit en r\u00e9sine',
    'figurine de collection',
    'statue de collection',
    'garage kit de collection',
    'figurine \u00e0 peindre',
    'statue \u00e0 peindre',
    'garage kit \u00e0 peindre',
    'figurine non peinte',
    'statue non peinte',
    'figurine nsfw',
    'statue nsfw',
    'garage kit nsfw',
    'figurine waifu',
    'statue waifu',
    'garage kit waifu',
    'figurine sexy',
    'statue sexy',
    'figurine pin-up',
    'statue pin-up',
    'pin up \u00e0 peindre',
    'cadeau geek',
    'cadeau collectionneur',
  ]);

  function resolveCommonProductTags(mode = 'tabletop', shopKey = 'grosgeek') {
    if (String(shopKey || '').trim() === 'doublex') {
      return String(mode || '').trim() === 'collection'
        ? doublexCollectionCommonProductTags
        : doublexTabletopCommonProductTags;
    }
    return String(mode || '').trim() === 'collection'
      ? collectionCommonProductTags
      : tabletopCommonProductTags;
  }

  Object.assign(global.PipelineUIDataTagsCommon, {
    TABLETOP_COMMON_PRODUCT_TAGS: tabletopCommonProductTags,
    COLLECTION_COMMON_PRODUCT_TAGS: collectionCommonProductTags,
    DOUBLEX_TABLETOP_COMMON_PRODUCT_TAGS: doublexTabletopCommonProductTags,
    DOUBLEX_COLLECTION_COMMON_PRODUCT_TAGS: doublexCollectionCommonProductTags,
    DOUBLEX_NSFW_COMMON_PRODUCT_TAGS: doublexCollectionCommonProductTags,
    COMMON_PRODUCT_TAGS: tabletopCommonProductTags,
    resolveCommonProductTags,
  });

  Object.assign(global.PipelineUIData, {
    tagsCommon: global.PipelineUIDataTagsCommon,
  });
})(window);
