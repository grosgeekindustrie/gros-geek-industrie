/**
 * Point d'entrée JS unique.
 *
 * Phase bootstrap :
 * - charge l'existant dans l'ordre vivant actuel
 * - conserve les globals window déjà utilisés par le HTML inline
 * - prépare la transition vers un boot modulaire plus fin
 */
import { appBootstrapGroups } from './app/index.js';
import { pipelineBootstrapGroups } from './pipeline/index.js';
import { socialBootstrapGroups } from './social/index.js';
import { sharedBootstrapGroups } from './shared/index.js';

const BOOTSTRAP_GROUPS = Object.freeze([
  ...pipelineBootstrapGroups,
  ...appBootstrapGroups,
  ...sharedBootstrapGroups,
  ...socialBootstrapGroups,
]);

const loadedScriptUrls = new Set();
const SCRIPT_DATASET_KEY = 'pipelineBootstrap';
const SCRIPT_STATE_DATASET_KEY = 'pipelineBootstrapState';
const SCRIPT_STATE_LOADING = 'loading';
const SCRIPT_STATE_LOADED = 'loaded';
const SCRIPT_STATE_ERROR = 'error';

const getAbsoluteScriptUrl = (relativePath) => new URL(relativePath, import.meta.url).href;

const getBootstrapScriptSelector = (absoluteUrl) => `script[data-${SCRIPT_DATASET_KEY}="${absoluteUrl}"]`;

const getBootstrapContainer = () => document.body || document.head || document.documentElement;

const validateBootstrapGroups = () => {
  const seenRelativePaths = new Map();

  BOOTSTRAP_GROUPS.forEach(({ id, paths }) => {
    if (!id || !Array.isArray(paths)) {
      throw new Error(`Bootstrap group invalide: ${String(id || 'sans-id')}`);
    }

    paths.forEach((relativePath) => {
      if (typeof relativePath !== 'string' || !relativePath.trim()) {
        throw new Error(`Chemin bootstrap invalide dans ${id}`);
      }

      const normalizedPath = relativePath.trim();
      const previousGroupId = seenRelativePaths.get(normalizedPath);
      if (previousGroupId) {
        throw new Error(`Chemin bootstrap dupliqué: ${normalizedPath} (${previousGroupId} / ${id})`);
      }

      seenRelativePaths.set(normalizedPath, id);
    });
  });
};

const getOrderedBootstrapPaths = () => BOOTSTRAP_GROUPS.flatMap(({ paths }) => paths);

const waitForExistingScript = (existing, relativePath) => new Promise((resolve, reject) => {
  const currentState = existing.dataset[SCRIPT_STATE_DATASET_KEY];

  if (currentState === SCRIPT_STATE_LOADED) {
    resolve();
    return;
  }

  if (currentState === SCRIPT_STATE_ERROR) {
    reject(new Error(`Bootstrap script déjà présent en erreur: ${relativePath}`));
    return;
  }

  existing.addEventListener('load', () => resolve(), { once: true });
  existing.addEventListener('error', () => reject(new Error(`Bootstrap script déjà présent en erreur: ${relativePath}`)), { once: true });
});

const loadClassicScript = (relativePath) => new Promise((resolve, reject) => {
  const absoluteUrl = getAbsoluteScriptUrl(relativePath);

  if (loadedScriptUrls.has(absoluteUrl)) {
    resolve();
    return;
  }

  const existing = document.querySelector(getBootstrapScriptSelector(absoluteUrl));
  if (existing) {
    waitForExistingScript(existing, relativePath).then(resolve).catch(reject);
    return;
  }

  const script = document.createElement('script');
  script.src = absoluteUrl;
  script.async = false;
  script.dataset[SCRIPT_DATASET_KEY] = absoluteUrl;
  script.dataset[SCRIPT_STATE_DATASET_KEY] = SCRIPT_STATE_LOADING;
  script.addEventListener('load', () => {
    script.dataset[SCRIPT_STATE_DATASET_KEY] = SCRIPT_STATE_LOADED;
    loadedScriptUrls.add(absoluteUrl);
    resolve();
  }, { once: true });
  script.addEventListener('error', () => {
    script.dataset[SCRIPT_STATE_DATASET_KEY] = SCRIPT_STATE_ERROR;
    reject(new Error(`Impossible de charger ${relativePath}`));
  }, { once: true });

  const container = getBootstrapContainer();
  if (!container) {
    reject(new Error(`Aucun conteneur DOM disponible pour charger ${relativePath}`));
    return;
  }

  container.appendChild(script);
});

const bootstrapClassicRuntime = async () => {
  validateBootstrapGroups();

  const orderedPaths = getOrderedBootstrapPaths();
  window.__PIPELINE_BOOTSTRAP_MANIFEST__ = Object.freeze({
    groups: BOOTSTRAP_GROUPS,
    paths: orderedPaths,
  });

  for (const relativePath of orderedPaths) {
    await loadClassicScript(relativePath);
  }
};

await bootstrapClassicRuntime();
