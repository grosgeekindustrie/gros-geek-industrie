/**
 * Frontière du domaine shared.
 *
 * Phase bootstrap : expose les scripts shared encore chargés globalement.
 */
const sharedBootstrapManifest = Object.freeze({
  scripts: Object.freeze([
    'shared/media/echelles_ui.js',
    'shared/media/image_tools_ui.js',
    'shared/storage/indexeddb_ui.js',
    'shared/media/images_ui.js',
  ]),
});

const sharedBootstrapLayerOrder = Object.freeze([
  'scripts',
]);

export {
  sharedBootstrapManifest,
  sharedBootstrapLayerOrder,
};
