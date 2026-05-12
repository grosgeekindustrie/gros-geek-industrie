'use strict';

// Tags transverses réutilisables dans la sélection manuelle.

(function initPipelineUIDataTagsCommon(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataTagsCommon = global.PipelineUIDataTagsCommon || {};

  const commonProductTags = Object.freeze([
    'impression 3D en résine',
    'figurine de collection',
    'statue de collection',
    'garage kit de collection',
    'figurine à peindre',
    'statue à peindre',
    'garage kit à peindre',
    'figurine non peinte',
    'statue non peinte',
    'garage kit non peint',
    'figurine prête à peindre',
    'statue prête à peindre',
    'garage kit prêt à peindre',
    'figurine en résine',
    'statue en résine',
    'garage kit en résine',
    'garage kit résine',
    'cadeau peintre',
    'cadeau geek',
    'cadeau collectionneur',
  ]);

  Object.assign(global.PipelineUIDataTagsCommon, {
    COMMON_PRODUCT_TAGS: commonProductTags,
  });

  Object.assign(global.PipelineUIData, {
    tagsCommon: global.PipelineUIDataTagsCommon,
  });
})(window);
