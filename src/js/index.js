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
  appBootPaths,
  appShellPreludePaths,
} from './app/index.js';
import {
  pipelineBootstrapManifest,
  pipelineDevPreludePaths,
  pipelineDevRuntimePaths,
  pipelinePrimaryDataPaths,
  pipelinePromptPaths,
  pipelineRuntimePaths,
  pipelineRuntimePreludePaths,
  pipelineSecondaryDataPaths,
  pipelineSharedPreludePaths,
  pipelineUiNavigationPaths,
} from './pipeline/index.js';
import {
  socialBootstrapManifest,
  socialScriptPaths,
} from './social/index.js';
import {
  sharedBootstrapManifest,
  sharedScriptPaths,
} from './shared/index.js';

const BOOTSTRAP_GROUPS = Object.freeze([
  Object.freeze({ domain: 'pipeline', group: 'sharedPrelude', paths: pipelineSharedPreludePaths }),
  Object.freeze({ domain: 'pipeline', group: 'primaryData', paths: pipelinePrimaryDataPaths }),
  Object.freeze({ domain: 'pipeline', group: 'devPrelude', paths: pipelineDevPreludePaths }),
  Object.freeze({ domain: 'pipeline', group: 'secondaryData', paths: pipelineSecondaryDataPaths }),
  Object.freeze({ domain: 'pipeline', group: 'runtimePrelude', paths: pipelineRuntimePreludePaths }),
  Object.freeze({ domain: 'app', group: 'shellPrelude', paths: appShellPreludePaths }),
  Object.freeze({ domain: 'pipeline', group: 'prompts', paths: pipelinePromptPaths }),
  Object.freeze({ domain: 'shared', group: 'scripts', paths: sharedScriptPaths }),
  Object.freeze({ domain: 'pipeline', group: 'uiNavigation', paths: pipelineUiNavigationPaths }),
  Object.freeze({ domain: 'app', group: 'boot', paths: appBootPaths }),
  Object.freeze({ domain: 'pipeline', group: 'runtime', paths: pipelineRuntimePaths }),
  Object.freeze({ domain: 'pipeline', group: 'devRuntime', paths: pipelineDevRuntimePaths }),
  Object.freeze({ domain: 'social', group: 'scripts', paths: socialScriptPaths }),
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
    pipeline: pipelineBootstrapManifest,
    shared: sharedBootstrapManifest,
    social: socialBootstrapManifest,
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
