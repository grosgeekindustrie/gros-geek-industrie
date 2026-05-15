/**
 * Frontiere du domaine integrations.
 *
 * Phase bootstrap : expose les integrations externes
 * sans les melanger au coeur pipeline.
 */
const integrationsBootstrapManifest = Object.freeze({
  data: Object.freeze([
    'integrations/data/integrations_data.js',
  ]),
  vendor: Object.freeze([
    'vendor/sortable.min.js',
  ]),
  runtime: Object.freeze([
    'integrations/runtime/etsy_oauth_ui.js',
    'integrations/runtime/etsy_workspace_ui.js',
  ]),
});

const integrationsBootstrapLayerOrder = Object.freeze([
  'data',
  'vendor',
  'runtime',
]);

export {
  integrationsBootstrapManifest,
  integrationsBootstrapLayerOrder,
};
