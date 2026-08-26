import { integrationsUiSharedScriptPaths } from './shared/index.js';
import { integrationsUiTabletopScriptPaths } from './tabletop/index.js';
import { integrationsUiCollectionScriptPaths } from './collection/index.js';

const integrationsUiScriptPaths = Object.freeze([
  ...integrationsUiSharedScriptPaths,
  ...integrationsUiTabletopScriptPaths,
  ...integrationsUiCollectionScriptPaths,
]);

export {
  integrationsUiScriptPaths,
};
