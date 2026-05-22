import { etsyDataScriptPaths } from './etsy/index.js';

const integrationsDataScriptPaths = Object.freeze([
  'integrations/data/integrations_data.js',
  ...etsyDataScriptPaths,
]);

export {
  integrationsDataScriptPaths,
};
