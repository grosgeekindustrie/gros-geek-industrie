'use strict';

// Shell global legacy contrôlé.
// Contient le mode courant, le state runtime principal et les helpers de préfixe.
// Tant que la migration complète n'est pas faite, cette zone reste la source de vérité.

window.PipelineUI = window.PipelineUI || {};
window.PipelineUIShell = window.PipelineUIShell || {};

var currentMode = 'tabletop'; // 'tabletop' | 'collection'
const MODE_PREFIX = { tabletop: 'tt', collection: 'col' };
function pfx() { return MODE_PREFIX[currentMode]; }

function switchMode(mode) {
  if (mode === currentMode) return;
  currentMode = mode;
  state.mode = mode;
  window.currentMode = currentMode;
  const isTT = mode === 'tabletop';
  document.body.classList.toggle('mode-collection', !isTT);
  const titles = {
    tabletop:   { h1: '🎲 Etsy Pipeline DnD', page: '🎲 Etsy Pipeline DnD v1.2' },
    collection: { h1: '🖼️ Etsy Pipeline Collection', page: '🖼️ Etsy Pipeline Collection v1.2' },
  };
  document.getElementById('headerTitle')?.textContent !== undefined && (document.getElementById('headerTitle').textContent = titles[mode].h1);
  document.getElementById('headerMode') && (document.getElementById('headerMode').textContent = isTT ? 'DnD Tabletop' : 'Collection');
  document.title = titles[mode].page;
  document.getElementById('modeTabletop')?.classList.toggle('active', isTT);
  document.getElementById('modeCollection')?.classList.toggle('active', !isTT);
  document.getElementById('ui-tt')?.style && (document.getElementById('ui-tt').style.display = isTT ? '' : 'none');
  document.getElementById('ui-col')?.style && (document.getElementById('ui-col').style.display = isTT ? 'none' : '');
  buildEchellesUI();
  buildPipeline();
  loadFormState();
  loadAllFiles(true);
  showToast(`Mode ${isTT ? 'Tabletop DnD' : 'Collection'} ✓`, isTT ? '#e8c547' : '#7eb8f7');
  // Persist mode
  try { const s = JSON.parse(localStorage.getItem('pipeline.settings') || '{}'); s.mode = mode; localStorage.setItem('pipeline.settings', JSON.stringify(s)); } catch(e) {}
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
