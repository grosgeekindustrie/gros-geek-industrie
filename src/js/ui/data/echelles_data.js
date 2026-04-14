'use strict';

// Échelles déclaratives et paramètres associés.

(function initPipelineUIDataEchelles(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataEchelles = global.PipelineUIDataEchelles || {};

  const echellesByMode = {
    tabletop: ['28mm', '32mm', '50mm', '54mm', '75mm', '90mm', '120mm', '140mm', '1/10', '1/8', '1/6'],
    collection: ['140mm', '1/12', '1/10', '1/9', '1/8', '1/7', '1/6'],
  };

  const customCollectionCount = 3;
  const dimensionPlaceholder = '224mm * 200mm * 136mm';

  Object.assign(global.PipelineUIDataEchelles, {
    ECHELLES_BY_MODE: echellesByMode,
    CUSTOM_COLLECTION_COUNT: customCollectionCount,
    DIMENSION_PLACEHOLDER: dimensionPlaceholder,
  });

  Object.assign(global.PipelineUIData, {
    echelles: global.PipelineUIDataEchelles,
  });
})(window);
