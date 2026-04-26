/**
 * Frontière du domaine social existant.
 *
 * Phase bootstrap : aucun script social autonome à charger ici pour l'instant.
 */
const socialScriptPaths = Object.freeze([]);

const socialBootstrapManifest = Object.freeze({
  scripts: socialScriptPaths,
});

const socialBootstrapLayerOrder = Object.freeze([
  'scripts',
]);

export {
  socialScriptPaths,
  socialBootstrapManifest,
  socialBootstrapLayerOrder,
};
