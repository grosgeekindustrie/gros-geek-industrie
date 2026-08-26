import { integrationsDataScriptPaths } from './data/index.js';
import { integrationsRuntimeScriptPaths } from './runtime/index.js';
import { integrationsUiScriptPaths } from './ui/index.js';

/**
 * Frontiere du domaine integrations.
 *
 * Phase bootstrap : aligne progressivement Etsy sur une structure
 * data / runtime / ui sans casser l'ordre de chargement vivant.
 */
const integrationsBootstrapManifest = Object.freeze({
  data: integrationsDataScriptPaths,
  vendor: Object.freeze([
    'vendor/filerobot-image-editor.min.js',
    'vendor/sortable.min.js',
  ]),
  runtime: integrationsRuntimeScriptPaths,
  ui: integrationsUiScriptPaths,
});

const integrationsBootstrapLayerOrder = Object.freeze([
  'data',
  'vendor',
  'runtime',
  'ui',
]);

export {
  integrationsBootstrapManifest,
  integrationsBootstrapLayerOrder,
};
