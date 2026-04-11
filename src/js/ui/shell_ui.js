'use strict';

// Shell global legacy contrôlé.
// Contient le mode courant, le state runtime principal et les helpers de préfixe.
// Tant que la migration complète n'est pas faite, cette zone reste la source de vérité.

window.PipelineUI = window.PipelineUI || {};
window.PipelineUIShell = window.PipelineUIShell || {};

var currentMode = 'tabletop'; // 'tabletop' | 'collection'
const FALLBACK_MODE_PREFIX = { tabletop: 'tt', collection: 'col' };
const getModeUiConfig = (mode = currentMode) => (
  typeof getPipelineUiConfig === 'function' ? getPipelineUiConfig(mode) : null
);
const getModePrefix = (mode = currentMode) => (
  typeof getPipelinePrefix === 'function'
    ? getPipelinePrefix(mode)
    : (FALLBACK_MODE_PREFIX[mode] || FALLBACK_MODE_PREFIX.tabletop)
);

function pfx() {
  return getModePrefix(currentMode);
}

function switchMode(mode) {
  if (mode === currentMode) return;

  currentMode = mode;
  state.mode = mode;
  window.currentMode = currentMode;

  const isTabletop = mode === 'tabletop';
  const modeUiConfig = getModeUiConfig(mode);
  const tabletopUiConfig = getModeUiConfig('tabletop');
  const collectionUiConfig = getModeUiConfig('collection');

  document.body.classList.toggle('mode-collection', !isTabletop);

  const titles = {
    tabletop: { h1: '🎲 Etsy Pipeline DnD', page: '🎲 Etsy Pipeline DnD v1.2' },
    collection: { h1: '🖼️ Etsy Pipeline Collection', page: '🖼️ Etsy Pipeline Collection v1.2' },
  };

  const headerTitle = document.getElementById('headerTitle');
  if (headerTitle?.textContent !== undefined) {
    headerTitle.textContent = titles[mode].h1;
  }

  const headerMode = document.getElementById('headerMode');
  if (headerMode) {
    headerMode.textContent = isTabletop ? 'DnD Tabletop' : 'Collection';
  }

  document.title = modeUiConfig?.pageTitle || titles[mode].page;
  document.getElementById('modeTabletop')?.classList.toggle('active', isTabletop);
  document.getElementById('modeCollection')?.classList.toggle('active', !isTabletop);

  const tabletopRoot = document.getElementById(tabletopUiConfig?.uiRootId || 'ui-tt');
  const collectionRoot = document.getElementById(collectionUiConfig?.uiRootId || 'ui-col');

  if (tabletopRoot?.style) tabletopRoot.style.display = isTabletop ? '' : 'none';
  if (collectionRoot?.style) collectionRoot.style.display = isTabletop ? 'none' : '';

  buildEchellesUI();
  buildPipeline();
  loadFormState();
  loadAllFiles(true);
  showToast(`Mode ${isTabletop ? 'Tabletop DnD' : 'Collection'} ✓`, isTabletop ? '#e8c547' : '#7eb8f7');

  try {
    const settings = JSON.parse(localStorage.getItem('pipeline.settings') || '{}');
    settings.mode = mode;
    localStorage.setItem('pipeline.settings', JSON.stringify(settings));
  } catch (error) {}
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
  orchestrateurActif: false,
  orchAttempts: {},
  socialSections: {},
  _lastOrchProblems: {},
  sessionCost: 0,
  mode: 'tabletop',
  agentUsage: {},
};

window.PipelineUI = window.PipelineUI || {};
window.state = state;
window.currentMode = currentMode;

Object.assign(window.PipelineUIShell, {
  get currentMode() { return currentMode; },
  get state() { return state; },
  pfx,
  switchMode,
});
