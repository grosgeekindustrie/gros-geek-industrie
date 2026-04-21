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

const sharedBootstrapGroups = Object.freeze([
  Object.freeze({
    id: 'shared:runtime',
    paths: sharedScriptPaths,
  }),
]);

export {
  sharedScriptPaths,
  sharedBootstrapGroups,
};
