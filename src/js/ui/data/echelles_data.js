'use strict';

// Échelles déclaratives et paramètres associés.

window.PipelineUI = window.PipelineUI || {};
window.PipelineUIData = window.PipelineUIData || {};
window.PipelineUIDataEchelles = window.PipelineUIDataEchelles || {};

const ECHELLES_BY_MODE = {
  tabletop: ['28mm', '32mm', '50mm', '54mm', '75mm', '90mm', '120mm', '140mm', '1/10', '1/8', '1/6'],
  collection: ['140mm', '1/12', '1/10', '1/9', '1/8', '1/7', '1/6'],
};

const CUSTOM_COLLECTION_COUNT = 3;
const DIMENSION_PLACEHOLDER = '224mm * 200mm * 136mm';

Object.assign(window.PipelineUIDataEchelles, {
  ECHELLES_BY_MODE,
  CUSTOM_COLLECTION_COUNT,
  DIMENSION_PLACEHOLDER,
});

Object.assign(window.PipelineUIData, {
  echelles: window.PipelineUIDataEchelles,
});
