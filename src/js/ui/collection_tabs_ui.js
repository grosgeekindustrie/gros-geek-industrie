'use strict';

(function initPipelineUICollectionTabs(global) {

// Navigation solo Collection par onglets.
// Cette couche remplace l'empilement de 4 zones par un seul panneau courant.
// Clean futur : si le pattern est validé, il pourra remplacer plus proprement les
// anciennes tentatives d'accordéon solo.
  global.PipelineUI = global.PipelineUI || {};

  const TAB_IDS = ['form', 'pipeline', 'result', 'social'];
  let activeTabId = 'form';
  let isBound = false;

  const getRoot = () => document.querySelector('[data-js="collection-solo-tabs"]');
  const getTabButton = (tabId) => getRoot()?.querySelector(`[data-collection-tab="${tabId}"]`) || null;
  const getTabState = (tabId) => getRoot()?.querySelector(`[data-collection-tab-state="${tabId}"]`) || null;
  const getTabPanel = (tabId) => getRoot()?.querySelector(`[data-collection-tab-panel="${tabId}"]`) || null;
  const getCurrentMode = () => global.currentMode || 'tabletop';

  function isVisible(element) {
    return !!element && window.getComputedStyle(element).display !== 'none';
  }

  function getAgentStatusTexts() {
    const agents = typeof global.getPipelineAgents === 'function' ? global.getPipelineAgents() : [];
    return agents
      .map((agent) => document.getElementById(`col-stat-${agent.id}`)?.textContent?.trim().toLowerCase() || '')
      .filter(Boolean);
  }

  function hasPipelinePanel() {
    return isVisible(document.getElementById('pipeline-col'));
  }

  function hasResultPanel() {
    return isVisible(document.getElementById('finalOutput-col'));
  }

  function hasSocialPanel() {
    return [
      document.getElementById('socialSection-col'),
      document.getElementById('socialOutput-col'),
      document.getElementById('reseauxOnlySection-col'),
    ].some(isVisible);
  }

  function isPipelineRunning() {
    return getCurrentMode() === 'collection' && !!global.isPipelineExecutionActive?.();
  }

  function hasPipelineError() {
    return getAgentStatusTexts().some((text) => text.includes('erreur'));
  }

  function hasPipelinePause() {
    if (isPipelineRunning()) return false;
    return getAgentStatusTexts().some((text) => text.includes('sélection requise'));
  }

  function getPipelineStateLabel() {
    if (!hasPipelinePanel()) return 'À lancer';
    if (hasPipelineError()) return 'Erreur';
    if (hasPipelinePause()) return 'Choix requis';
    if (isPipelineRunning()) return 'En cours';
    if (hasResultPanel()) return 'Terminé';
    return 'Prêt';
  }

  function getTabStateLabel(tabId) {
    if (tabId === 'form') return isPipelineRunning() ? 'Verrouillé' : 'Prêt';
    if (tabId === 'pipeline') return getPipelineStateLabel();
    if (tabId === 'result') return hasResultPanel() ? 'Disponible' : 'Indispo';
    if (tabId === 'social') {
      if (isVisible(document.getElementById('socialOutput-col'))) return 'Généré';
      return hasSocialPanel() ? 'Disponible' : 'Indispo';
    }
    return '';
  }

  function isTabEnabled(tabId) {
    if (tabId === 'form') return !isPipelineRunning();
    if (tabId === 'pipeline') return hasPipelinePanel();
    if (tabId === 'result') return hasResultPanel();
    if (tabId === 'social') return hasSocialPanel();
    return false;
  }

  function getFallbackTab() {
    if (isPipelineRunning() || hasPipelinePause() || hasPipelineError()) return 'pipeline';
    if (hasResultPanel()) return 'result';
    return 'form';
  }

  function applyFormPanelState() {
    const formPanel = getTabPanel('form');
    if (!formPanel) return;
    formPanel.classList.toggle('is-locked', isPipelineRunning());
  }

  function renderCollectionSoloTabs() {
    const root = getRoot();
    if (!root) return;

    if (!TAB_IDS.includes(activeTabId) || (activeTabId !== 'form' && !isTabEnabled(activeTabId))) {
      activeTabId = getFallbackTab();
    }

    TAB_IDS.forEach((tabId) => {
      const button = getTabButton(tabId);
      const state = getTabState(tabId);
      const panel = getTabPanel(tabId);
      const isActive = tabId === activeTabId;
      const isEnabled = isActive ? true : isTabEnabled(tabId);

      if (button) {
        button.classList.toggle('is-active', isActive);
        button.classList.toggle('is-disabled', !isEnabled);
        button.classList.toggle('is-locked', tabId === 'form' && isPipelineRunning());
        button.disabled = !isEnabled;
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }

      if (state) state.textContent = getTabStateLabel(tabId);

      if (panel) {
        panel.hidden = !isActive;
        panel.classList.toggle('is-active', isActive);
      }
    });

    applyFormPanelState();
  }

  function activateCollectionSoloTab(tabId, options = {}) {
    const { force = false } = options;
    if (!TAB_IDS.includes(tabId)) return;
    if (!force && !isTabEnabled(tabId)) return;
    activeTabId = tabId;
    renderCollectionSoloTabs();
  }

  function refreshCollectionSoloTabs() {
    renderCollectionSoloTabs();
  }

  function resetCollectionSoloTabs() {
    activeTabId = 'form';
    renderCollectionSoloTabs();
  }

  function bindCollectionSoloTabs() {
    const root = getRoot();
    if (!root || isBound) return;

    root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-collection-tab]');
      if (!button) return;
      activateCollectionSoloTab(button.dataset.collectionTab);
    });

    isBound = true;
  }

  function initCollectionSoloTabs() {
    if (!getRoot()) return;
    bindCollectionSoloTabs();
    renderCollectionSoloTabs();
  }

  function isCollectionSoloResultAvailable() {
    return hasResultPanel();
  }

  global.PipelineUICollectionTabs = {
    initCollectionSoloTabs,
    refreshCollectionSoloTabs,
    activateCollectionSoloTab,
    resetCollectionSoloTabs,
    isCollectionSoloResultAvailable,
  };

  global.PipelineUI.collectionTabs = global.PipelineUI.collectionTabs || {};
  Object.assign(global.PipelineUI.collectionTabs, global.PipelineUICollectionTabs);
  Object.assign(global, global.PipelineUICollectionTabs);
})(window);
