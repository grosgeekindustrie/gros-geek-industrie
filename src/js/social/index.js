/**
 * Frontière du domaine social existant.
 *
 * Phase bootstrap : aucun script social autonome à charger ici pour l'instant.
 */
const socialScriptPaths = Object.freeze([]);

const socialBootstrapGroups = Object.freeze([
  Object.freeze({
    id: 'social:runtime',
    paths: socialScriptPaths,
  }),
]);

export {
  socialScriptPaths,
  socialBootstrapGroups,
};
