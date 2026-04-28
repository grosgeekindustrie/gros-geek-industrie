'use strict';

// Shell global contrôlé.
// Contient le mode courant, le state runtime principal et les helpers de préfixe.
// Cette zone reste la source de vérité du shell partagé tant que le runtime window existe.

window.PipelineUI = window.PipelineUI || {};
window.PipelineUIShell = window.PipelineUIShell || {};
const sharedConstants = window.PipelineUISharedConstants || {};
const PIPELINE_MODES = sharedConstants.PIPELINE_MODES || {
  TABLETOP: 'tabletop',
  COLLECTION: 'collection',
};
const STORAGE_KEYS = sharedConstants.STORAGE_KEYS || {
  APP_SETTINGS: 'pipeline.settings',
};
const APP_SETTINGS_STORAGE_KEY = STORAGE_KEYS.APP_SETTINGS;

var currentMode = PIPELINE_MODES.TABLETOP;
const MODE_SUCCESS_SUFFIX = 'OK';
const getModeUiConfig = (mode = currentMode) => (
  getPipelineUiConfig(mode)
);
const getModePrefix = (mode = currentMode) => getPipelinePrefix(mode);
const readAppSettings = () => {
  try {
    return JSON.parse(localStorage.getItem(APP_SETTINGS_STORAGE_KEY) || '{}');
  } catch (_error) {
    return {};
  }
};
const writeAppSettings = (nextSettings) => {
  localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
};

function pfx() {
  return getModePrefix(currentMode);
}

function switchMode(mode) {
  if (mode === currentMode) return;

  currentMode = mode;
  state.mode = mode;
  window.currentMode = currentMode;

  const isTabletop = mode === PIPELINE_MODES.TABLETOP;
  const modeUiConfig = getModeUiConfig(mode);
  const tabletopUiConfig = getModeUiConfig(PIPELINE_MODES.TABLETOP);
  const collectionUiConfig = getModeUiConfig(PIPELINE_MODES.COLLECTION);

  document.body.classList.toggle('mode-collection', !isTabletop);

  const modeTitle = modeUiConfig.headerTitle;
  const pageTitle = modeUiConfig.pageTitle;
  const headerModeLabel = modeUiConfig.headerModeLabel || (isTabletop ? 'DnD Tabletop' : 'Collection');

  const headerTitle = document.getElementById('headerTitle');
  if (headerTitle) {
    headerTitle.textContent = modeTitle;
  }

  const headerMode = document.getElementById('headerMode');
  if (headerMode) {
    headerMode.textContent = headerModeLabel;
  }

  document.title = pageTitle;
  const modeTabletop = document.getElementById('modeTabletop');
  const modeCollection = document.getElementById('modeCollection');
  if (modeTabletop) modeTabletop.classList.toggle('active', isTabletop);
  if (modeCollection) modeCollection.classList.toggle('active', !isTabletop);

  const tabletopRoot = document.getElementById(tabletopUiConfig.uiRootId);
  const collectionRoot = document.getElementById(collectionUiConfig.uiRootId);

  if (tabletopRoot) tabletopRoot.style.display = isTabletop ? '' : 'none';
  if (collectionRoot) collectionRoot.style.display = isTabletop ? 'none' : '';

  rebuildModeUi({
    silentFileLoad: true,
    refreshCatalogs: true,
    rebuildPipeline: true,
    rebuildEchelles: true,
    reloadFormState: true,
    showModeToast: true,
    modeToastMessage: `Mode ${isTabletop ? 'Tabletop DnD' : 'Collection'} ${MODE_SUCCESS_SUFFIX}`,
    modeToastColor: isTabletop ? '#e8c547' : '#7eb8f7',
  });

  const settings = readAppSettings();
  settings.mode = mode;
  writeAppSettings(settings);
}

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
var state = {
  images: { tt: [], col: [] },
  outputs: {},
  inputs: {},
  persistentRules: {},
  promptsByMode: { tabletop: {}, collection: {} },
  bibliosByMode: { tabletop: {}, collection: {} },
  selectedAccroche: null,
  selectedCTA: null,
  selectedTitre: null,
  socialSections: {},
  sessionCost: 0,
  mode: PIPELINE_MODES.TABLETOP,
  agentUsage: {},
};

window.state = state;
window.currentMode = currentMode;

Object.assign(window.PipelineUIShell, {
  get currentMode() { return currentMode; },
  get state() { return state; },
  pfx,
  switchMode,
});
