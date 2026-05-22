/**
 * Point d'entrée JS unique.
 *
 * Phase bootstrap :
 * - charge l'existant dans l'ordre vivant actuel
 * - conserve les globals window déjà utilisés par le HTML inline
 * - prépare la transition vers un boot modulaire plus fin
 */
import {
  appBootstrapManifest,
  appBootstrapLayerOrder,
} from './app/index.js';
import {
  integrationsBootstrapManifest,
  integrationsBootstrapLayerOrder,
} from './integrations/index.js';
import {
  pipelineBootstrapManifest,
  pipelineBootstrapLayerOrder,
} from './pipeline/index.js';
import {
  sharedBootstrapManifest,
  sharedBootstrapLayerOrder,
} from './shared/index.js';
import {
  socialBootstrapManifest,
  socialBootstrapLayerOrder,
} from './social/index.js';

const createDomainBootstrapGroups = (domain, manifest, layerOrder) => layerOrder.map((group) => Object.freeze({
  domain,
  group,
  paths: manifest[group] || Object.freeze([]),
}));

const pickBootstrapLayers = (layerOrder, allowedGroups) => layerOrder.filter((group) => allowedGroups.includes(group));

const BOOTSTRAP_GROUPS = Object.freeze([
  ...createDomainBootstrapGroups('shared', sharedBootstrapManifest, pickBootstrapLayers(
    sharedBootstrapLayerOrder,
    ['prelude']
  )),
  ...createDomainBootstrapGroups('pipeline', pipelineBootstrapManifest, pickBootstrapLayers(
    pipelineBootstrapLayerOrder,
    ['sharedPrelude', 'primaryData', 'devPrelude', 'secondaryData', 'runtimePrelude']
  )),
  ...createDomainBootstrapGroups('app', appBootstrapManifest, pickBootstrapLayers(
    appBootstrapLayerOrder,
    ['shellPrelude']
  )),
  ...createDomainBootstrapGroups('pipeline', pipelineBootstrapManifest, pickBootstrapLayers(
    pipelineBootstrapLayerOrder,
    ['prompts', 'uiNavigation']
  )),
  ...createDomainBootstrapGroups('shared', sharedBootstrapManifest, pickBootstrapLayers(
    sharedBootstrapLayerOrder,
    ['scripts']
  )),
  ...createDomainBootstrapGroups('integrations', integrationsBootstrapManifest, pickBootstrapLayers(
    integrationsBootstrapLayerOrder,
    ['data', 'vendor', 'runtime', 'ui']
  )),
  ...createDomainBootstrapGroups('app', appBootstrapManifest, pickBootstrapLayers(
    appBootstrapLayerOrder,
    ['boot']
  )),
  ...createDomainBootstrapGroups('pipeline', pipelineBootstrapManifest, pickBootstrapLayers(
    pipelineBootstrapLayerOrder,
    ['runtime', 'devRuntime']
  )),
  ...createDomainBootstrapGroups('social', socialBootstrapManifest, pickBootstrapLayers(
    socialBootstrapLayerOrder,
    ['runtime']
  )),
]);

const SCRIPT_PATHS = Object.freeze(
  BOOTSTRAP_GROUPS.flatMap(({ paths }) => paths)
);

const loadedScriptUrls = new Set();

const getAbsoluteScriptUrl = (relativePath) => new URL(relativePath, import.meta.url).href;

const getDuplicateBootstrapPaths = (paths) => {
  const counts = new Map();

  paths.forEach((path) => {
    counts.set(path, (counts.get(path) || 0) + 1);
  });

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([path]) => path);
};

const assertBootstrapPathsAreUnique = (paths) => {
  const duplicates = getDuplicateBootstrapPaths(paths);
  if (!duplicates.length) return;

  throw new Error(`Bootstrap manifest contient des doublons: ${duplicates.join(', ')}`);
};

const bootstrapDebugManifest = Object.freeze({
  domains: Object.freeze({
    app: appBootstrapManifest,
    integrations: integrationsBootstrapManifest,
    pipeline: pipelineBootstrapManifest,
    social: socialBootstrapManifest,
    shared: sharedBootstrapManifest,
  }),
  groups: Object.freeze(
    BOOTSTRAP_GROUPS.map(({ domain, group, paths }) => Object.freeze({
      domain,
      group,
      paths,
    }))
  ),
  scriptPaths: SCRIPT_PATHS,
});

if (typeof window !== 'undefined') {
  window.__PIPELINE_BOOTSTRAP_MANIFEST__ = bootstrapDebugManifest;
}

const loadClassicScript = (relativePath) => new Promise((resolve, reject) => {
  const absoluteUrl = getAbsoluteScriptUrl(relativePath);
  if (loadedScriptUrls.has(absoluteUrl)) {
    resolve();
    return;
  }
  const existing = document.querySelector(`script[data-pipeline-bootstrap="${absoluteUrl}"]`);
  if (existing) {
    existing.addEventListener('load', () => resolve(), { once: true });
    existing.addEventListener('error', () => reject(new Error(`Bootstrap script déjà présent en erreur: ${relativePath}`)), { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = absoluteUrl;
  script.async = false;
  script.dataset.pipelineBootstrap = absoluteUrl;
  script.addEventListener('load', () => {
    loadedScriptUrls.add(absoluteUrl);
    resolve();
  }, { once: true });
  script.addEventListener('error', () => {
    reject(new Error(`Impossible de charger ${relativePath}`));
  }, { once: true });
  document.body.appendChild(script);
});

const bootstrapClassicRuntime = async () => {
  assertBootstrapPathsAreUnique(SCRIPT_PATHS);

  for (const relativePath of SCRIPT_PATHS) {
    await loadClassicScript(relativePath);
  }
};

await bootstrapClassicRuntime();
