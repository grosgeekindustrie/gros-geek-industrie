'use strict';

// Tags transverses reutilisables dans la selection manuelle.

(function initPipelineUIDataTagsCommon(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataTagsCommon = global.PipelineUIDataTagsCommon || {};

  const tabletopCommonProductTags = Object.freeze([
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

  const doublexNsfwCommonProductTags = Object.freeze([
    'impression 3D en r\u00e9sine',
    'figurine de collection',
    'statue de collection',
    'garage kit de collection',
    'figurine \u00e0 peindre',
    'statue \u00e0 peindre',
    'garage kit \u00e0 peindre',
    'figurine non peinte',
    'statue non peinte',
    'garage kit en r\u00e9sine',
    'mature',
    'figurine nsfw',
    'statue nsfw',
    'figurine sexy',
    'pin up \u00e0 peindre',
    'cadeau no\u00ebl peintres',
    'cadeau anniversaire hobby',
  ]);

  function resolveCommonProductTags(mode = 'tabletop', shopKey = 'grosgeek') {
    if (String(shopKey || '').trim() === 'doublex') return doublexNsfwCommonProductTags;
    return String(mode || '').trim() === 'collection'
      ? collectionCommonProductTags
      : tabletopCommonProductTags;
  }

  Object.assign(global.PipelineUIDataTagsCommon, {
    TABLETOP_COMMON_PRODUCT_TAGS: tabletopCommonProductTags,
    COLLECTION_COMMON_PRODUCT_TAGS: collectionCommonProductTags,
    DOUBLEX_NSFW_COMMON_PRODUCT_TAGS: doublexNsfwCommonProductTags,
    COMMON_PRODUCT_TAGS: tabletopCommonProductTags,
    resolveCommonProductTags,
  });

  Object.assign(global.PipelineUIData, {
    tagsCommon: global.PipelineUIDataTagsCommon,
  });
})(window);
