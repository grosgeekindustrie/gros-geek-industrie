'use strict';

(function initPipelineUICollectionTabs(global) {

// Navigation solo Collection par onglets.
// Cette couche remplace l'empilement de 4 zones par un seul panneau courant.
// Step 2 : les états globaux remontent maintenant dans les onglets + une barre compacte.
  global.PipelineUI = global.PipelineUI || {};

  const TAB_IDS = ['form', 'pipeline', 'result', 'social'];
  const TAB_STATE_CLASSNAMES = [
    'is-state-idle',
    'is-state-running',
    'is-state-paused',
    'is-state-error',
    'is-state-done',
    'is-state-available',
    'is-state-generated',
    'is-state-locked',
    'is-state-stopped',
  ];
  let activeTabId = 'form';
  let isBound = false;

  const getRoot = () => document.querySelector('[data-js="collection-solo-tabs"]');
  const getTabButton = (tabId) => getRoot()?.querySelector(`[data-collection-tab="${tabId}"]`) || null;
  const getTabState = (tabId) => getRoot()?.querySelector(`[data-collection-tab-state="${tabId}"]`) || null;
  const getTabPanel = (tabId) => getRoot()?.querySelector(`[data-collection-tab-panel="${tabId}"]`) || null;
  const getStatusBox = () => document.querySelector('[data-js="collection-solo-status"]');
  const getStatusText = () => document.querySelector('[data-js="collection-solo-status-text"]');
  const getCurrentMode = () => global.currentMode || 'tabletop';

  const getNameField = () => document.getElementById('col-fNomCourt') || document.getElementById('col-fNom');
  const getFullNameField = () => document.getElementById('col-fNom') || document.getElementById('col-fNomCourt');

  function isVisible(element) {
    return !!element && window.getComputedStyle(element).display !== 'none';
  }

  function getAgents() {
    return typeof global.getPipelineAgents === 'function' ? global.getPipelineAgents() : [];
  }

  function getAgentStatusEntries() {
    return getAgents().map((agent) => ({
      id: agent.id,
      text: document.getElementById(`col-stat-${agent.id}`)?.textContent?.trim().toLowerCase() || '',
    }));
  }

  function getDisplayName() {
    const shortName = getNameField()?.value?.trim();
    const fullName = getFullNameField()?.value?.trim();
    return shortName || fullName || 'Nouvelle fiche';
  }

  function hasPipelinePanel() {
    return isVisible(document.getElementById('pipeline-col'));
  }

  function hasResultPanel() {
    return isVisible(document.getElementById('finalOutput-col'));
  }

  function hasSocialOutput() {
    return isVisible(document.getElementById('socialOutput-col'));
  }

  function hasSocialPanel() {
    return [
      document.getElementById('socialSection-col'),
      document.getElementById('socialOutput-col'),
      document.getElementById('reseauxOnlySection-col'),
    ].some(Boolean);
  }

  function ensureSocialTabContentVisibility(tabId) {
    if (tabId !== 'social') return;

    const socialSection = document.getElementById('socialSection-col');
    const socialOutput = document.getElementById('socialOutput-col');
    const reseauxOnlySection = document.getElementById('reseauxOnlySection-col');
    const hasVisibleContent = [socialSection, socialOutput, reseauxOnlySection].some(isVisible);

    if (!hasVisibleContent && socialSection) {
      socialSection.style.display = 'block';
    }
  }

  function isPipelineRunning() {
    return getCurrentMode() === 'collection' && !!global.isPipelineExecutionActive?.();
  }

  function hasPipelineError() {
    return getAgentStatusEntries().some(({ text }) => text.includes('erreur') || text.includes('alerte'));
  }

  function hasPipelinePause() {
    if (isPipelineRunning()) return false;
    return getAgentStatusEntries().some(({ text }) => text.includes('sélection requise'));
  }

  function hasPipelineStopped() {
    if (isPipelineRunning()) return false;
    return getAgentStatusEntries().some(({ text }) => text.includes('stoppé'));
  }

  function getPipelineProgress() {
    const statuses = getAgentStatusEntries();
    const total = statuses.length;
    if (!total) return { current: 0, total: 0 };

    const activeIndex = statuses.findIndex(({ text }) => text.includes('génération') || text.includes('audit') || text.includes('relance'));
    const pauseIndex = statuses.findIndex(({ text }) => text.includes('sélection requise'));
    const errorIndex = statuses.findIndex(({ text }) => text.includes('erreur') || text.includes('alerte'));
    const stoppedIndex = statuses.findIndex(({ text }) => text.includes('stoppé'));
    const doneCount = statuses.filter(({ text }) => text.includes('done')).length;

    if (activeIndex !== -1) return { current: Math.max(doneCount + 1, activeIndex + 1), total };
    if (pauseIndex !== -1) return { current: Math.max(doneCount, pauseIndex + 1), total };
    if (errorIndex !== -1) return { current: Math.max(doneCount, errorIndex + 1), total };
    if (stoppedIndex !== -1) return { current: Math.max(doneCount, stoppedIndex + 1), total };
    if (hasResultPanel()) return { current: total, total };
    return { current: doneCount, total };
  }

  function getPipelineState() {
    if (!hasPipelinePanel()) return { code: 'idle', label: 'À lancer' };
    if (hasPipelineError()) return { code: 'error', label: 'Erreur' };
    if (hasPipelinePause()) return { code: 'paused', label: 'En pause' };
    if (hasPipelineStopped()) return { code: 'stopped', label: 'Interrompu' };
    if (isPipelineRunning()) {
      const progress = getPipelineProgress();
      const suffix = progress.total ? ` · ${progress.current}/${progress.total}` : '';
      return { code: 'running', label: `En cours${suffix}` };
    }
    if (hasResultPanel()) return { code: 'done', label: 'Terminé' };
    return { code: 'available', label: 'Prêt' };
  }

  function getTabPresentation(tabId) {
    if (tabId === 'form') {
      return isPipelineRunning()
        ? { label: 'Édition verrouillée', code: 'locked' }
        : { label: 'Prêt', code: 'idle' };
    }

    if (tabId === 'pipeline') return getPipelineState();
    if (tabId === 'result') return hasResultPanel()
      ? { label: 'Disponible', code: 'available' }
      : { label: 'Indispo', code: 'idle' };
    if (tabId === 'social') {
      if (hasSocialOutput()) return { label: 'Généré', code: 'generated' };
      return hasSocialPanel()
        ? { label: 'Disponible', code: 'available' }
        : { label: 'Indispo', code: 'idle' };
    }

    return { label: '', code: 'idle' };
  }

  function isTabEnabled(tabId) {
    if (tabId === 'form') return !isPipelineRunning();
    if (tabId === 'pipeline') return hasPipelinePanel();
    if (tabId === 'result') return hasResultPanel();
    if (tabId === 'social') return hasSocialPanel();
    return false;
  }

  function getFallbackTab() {
    if (isPipelineRunning() || hasPipelinePause() || hasPipelineError() || hasPipelineStopped()) return 'pipeline';
    if (hasResultPanel()) return 'result';
    return 'form';
  }

  function applyFormPanelState() {
    const formPanel = getTabPanel('form');
    if (!formPanel) return;
    formPanel.classList.toggle('is-locked', isPipelineRunning());
  }

  function applyStateClasses(element, stateCode) {
    if (!element) return;
    TAB_STATE_CLASSNAMES.forEach((className) => element.classList.remove(className));
    if (stateCode) element.classList.add(`is-state-${stateCode}`);
  }

  function renderStatusLine() {
    const statusBox = getStatusBox();
    const statusText = getStatusText();
    if (!statusBox || !statusText) return;

    const displayName = getDisplayName();
    const pipelineState = getPipelineState();
    let text = `${displayName} · Formulaire prêt`;
    let stateCode = 'idle';

    if (hasPipelineError()) {
      text = `${displayName} · Erreur`;
      stateCode = 'error';
    } else if (hasPipelinePause()) {
      text = `${displayName} · En pause · choix requis`;
      stateCode = 'paused';
    } else if (hasPipelineStopped()) {
      text = `${displayName} · Interrompu`;
      stateCode = 'stopped';
    } else if (isPipelineRunning()) {
      text = `${displayName} · Pipeline ${pipelineState.label.toLowerCase()}`;
      stateCode = 'running';
    } else if (hasResultPanel()) {
      text = `${displayName} · Terminé`;
      stateCode = 'done';
    } else if (hasPipelinePanel()) {
      text = `${displayName} · Pipeline prêt`;
      stateCode = 'available';
    }

    statusText.textContent = text;
    applyStateClasses(statusBox, stateCode);
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
      const presentation = getTabPresentation(tabId);

      if (button) {
        button.classList.toggle('is-active', isActive);
        button.classList.toggle('is-disabled', !isEnabled);
        button.classList.toggle('is-locked', tabId === 'form' && isPipelineRunning());
        button.disabled = !isEnabled;
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        applyStateClasses(button, presentation.code);
      }

      if (state) {
        state.textContent = presentation.label;
        applyStateClasses(state, presentation.code);
      }

      if (panel) {
        panel.hidden = !isActive;
        panel.classList.toggle('is-active', isActive);
      }

      if (isActive) {
        ensureSocialTabContentVisibility(tabId);
      }
    });

    applyFormPanelState();
    renderStatusLine();
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

    ['col-fNomCourt', 'col-fNom'].forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      field?.addEventListener('input', refreshCollectionSoloTabs);
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
