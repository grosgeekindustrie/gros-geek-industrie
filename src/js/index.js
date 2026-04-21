/**
 * Point d'entrée JS unique.
 *
 * Phase bootstrap :
 * - charge l'existant dans l'ordre vivant actuel
 * - conserve les globals window déjà utilisés par le HTML inline
 * - prépare la transition vers un boot modulaire plus fin
 */
import {
  appBootPaths,
  appShellPreludePaths,
} from './app/index.js';
import {
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
  socialScriptPaths,
} from './social/index.js';
import {
  sharedScriptPaths,
} from './shared/index.js';

const SCRIPT_PATHS = [
  ...pipelineSharedPreludePaths,
  ...pipelinePrimaryDataPaths,
  ...pipelineDevPreludePaths,
  ...pipelineSecondaryDataPaths,
  ...pipelineRuntimePreludePaths,
  ...appShellPreludePaths,
  ...pipelinePromptPaths,
  ...sharedScriptPaths,
  ...pipelineUiNavigationPaths,
  ...appBootPaths,
  ...pipelineRuntimePaths,
  ...pipelineDevRuntimePaths,
  ...socialScriptPaths,
];

const loadedScriptUrls = new Set();

const getAbsoluteScriptUrl = (relativePath) => new URL(relativePath, import.meta.url).href;

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
  for (const relativePath of SCRIPT_PATHS) {
    await loadClassicScript(relativePath);
  }
};

await bootstrapClassicRuntime();
