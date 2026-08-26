/**
 * Frontière du domaine shared.
 *
 * Phase bootstrap : expose les scripts shared encore chargés globalement.
 */
const sharedBootstrapManifest = Object.freeze({
  prelude: Object.freeze([
    'shared/constants/pipeline_constants.js',
    'shared/utils/dom.js',
    'shared/utils/icons.js',
    'shared/utils/logger.js',
    'shared/utils/runtime_formats.js',
    'shared/utils/runtime_cache.js',
    'shared/ai/ai_profiles.js',
  ]),
  scripts: Object.freeze([
    'shared/media/image_tools_ui.js',
    'shared/storage/indexeddb_ui.js',
    'shared/media/images_ui.js',
  ]),
});

const sharedBootstrapLayerOrder = Object.freeze([
  'prelude',
  'scripts',
]);

export {
  sharedBootstrapManifest,
  sharedBootstrapLayerOrder,
};
