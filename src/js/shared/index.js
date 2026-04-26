/**
 * Frontière du domaine shared.
 *
 * Phase bootstrap : expose les scripts shared encore chargés globalement.
 */
const sharedScriptPaths = Object.freeze([
  'shared/media/echelles_ui.js',
  'shared/media/image_tools_ui.js',
  'shared/storage/indexeddb_ui.js',
  'shared/media/images_ui.js',
]);

const sharedBootstrapManifest = Object.freeze({
  scripts: sharedScriptPaths,
});

const sharedBootstrapLayerOrder = Object.freeze([
  'scripts',
]);

export {
  sharedScriptPaths,
  sharedBootstrapManifest,
  sharedBootstrapLayerOrder,
};
