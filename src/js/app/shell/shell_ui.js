'use strict';

// Shell global contrôlé.
// Contient le mode courant, le state runtime principal et les helpers de préfixe.
// Cette zone reste la source de vérité du shell partagé tant que le runtime window existe.

window.PipelineUI = window.PipelineUI || {};
window.PipelineUIShell = window.PipelineUIShell || {};
const sharedConstants = window.PipelineUISharedConstants || {};
const storage = window.PipelineUIStorage || {};
const PIPELINE_MODES = sharedConstants.PIPELINE_MODES || {
  TABLETOP: 'tabletop',
  COLLECTION: 'collection',
};
const STORAGE_KEYS = sharedConstants.STORAGE_KEYS || {
  APP_SETTINGS: 'pipeline.settings',
};
const updateAppSettings = storage.updateAppSettings || ((updater) => {
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.APP_SETTINGS) || '{}');
  } catch (_error) {}
  updater(settings);
  localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(settings));
});

var currentMode = PIPELINE_MODES.TABLETOP;
const MODE_SUCCESS_SUFFIX = 'OK';
const getModeUiConfig = (mode = currentMode) => {
  if (typeof window.getPipelineUiConfig !== 'function') {
    return {
      headerTitle: 'Etsy Pipeline',
      pageTitle: document.title || 'Etsy Pipeline',
      headerModeLabel: mode === PIPELINE_MODES.COLLECTION ? 'Collection' : 'DnD Tabletop',
      uiRootId: mode === PIPELINE_MODES.COLLECTION ? 'collectionRoot' : 'tabletopRoot',
    };
  }
  return window.getPipelineUiConfig(mode);
};
const getModePrefix = (mode = currentMode) => {
  if (typeof window.getPipelinePrefix !== 'function') {
    return mode === PIPELINE_MODES.COLLECTION ? 'col' : 'tt';
  }
  return window.getPipelinePrefix(mode);
};
const normalizeMode = (mode) => (
  mode === PIPELINE_MODES.COLLECTION ? PIPELINE_MODES.COLLECTION : PIPELINE_MODES.TABLETOP
);

function pfx() {
  return getModePrefix(currentMode);
}

function applyModeState(mode) {
  currentMode = normalizeMode(mode);
  state.mode = currentMode;
  window.currentMode = currentMode;

  const isTabletop = currentMode === PIPELINE_MODES.TABLETOP;
  const modeUiConfig = getModeUiConfig(currentMode);
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
}

function switchMode(mode) {
  const nextMode = normalizeMode(mode);
  if (nextMode === currentMode) return;
  if (typeof window.rebuildModeUi !== 'function') return;

  applyModeState(nextMode);
  const isTabletop = nextMode === PIPELINE_MODES.TABLETOP;

  window.rebuildModeUi({
    silentFileLoad: true,
    refreshCatalogs: true,
    rebuildPipeline: true,
    rebuildEchelles: true,
    reloadFormState: true,
    showModeToast: true,
    modeToastMessage: `Mode ${isTabletop ? 'Tabletop DnD' : 'Collection'} ${MODE_SUCCESS_SUFFIX}`,
    modeToastColor: isTabletop ? '#e8c547' : '#7eb8f7',
  });

  updateAppSettings((settings) => {
    settings.mode = nextMode;
  });
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
  applyModeState,
  switchMode,
});

Object.assign(window, {
  pfx,
  applyModeState,
  switchMode,
});
