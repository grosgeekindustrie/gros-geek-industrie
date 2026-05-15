'use strict';

(function initPipelineUIDndTabs(global) {

// Navigation solo DnD par onglets.
// Le markup reste dédié au mode Tabletop, mais la logique d'état est désormais
// mutualisée via le core partagé pour converger avec Collection.
  global.PipelineUI = global.PipelineUI || {};

  const createSoloTabsController = global.PipelineUISoloTabsCore?.createSoloTabsController;
  if (typeof createSoloTabsController !== 'function') return;

  const isVisible = (element) => Boolean(element) && window.getComputedStyle(element).display !== 'none';
  const getAgents = () => global.getPipelineRuntimeAgentsForPrefix('tt');
  const getNameField = () => document.getElementById('tt-fNomCourt') || document.getElementById('tt-fNom');
  const getFullNameField = () => document.getElementById('tt-fNom') || document.getElementById('tt-fNomCourt');

  const controller = createSoloTabsController({
    pipelinePrefix: 'tt',
    getRoot: () => document.querySelector('[data-js="dnd-solo-tabs"]'),
    getTabButton: (tabId) => document.querySelector('[data-js="dnd-solo-tabs"]')?.querySelector(`[data-dnd-tab="${tabId}"]`) || null,
    getTabState: (tabId) => document.querySelector('[data-js="dnd-solo-tabs"]')?.querySelector(`[data-dnd-tab-state="${tabId}"]`) || null,
    getTabPanel: (tabId) => document.querySelector('[data-js="dnd-solo-tabs"]')?.querySelector(`[data-dnd-tab-panel="${tabId}"]`) || null,
    getStatusBox: () => document.querySelector('[data-js="dnd-solo-status"]'),
    getStatusText: () => document.querySelector('[data-js="dnd-solo-status-text"]'),
    getLaunchState: () => global.getPipelineLaunchState?.('tt') || null,
    getDisplayName: () => {
      const shortName = getNameField()?.value?.trim();
      const fullName = getFullNameField()?.value?.trim();
      return shortName || fullName || 'Nouvelle fiche';
    },
    getAgentStatusEntries: () => getAgents().map((agent) => ({
      id: agent.id,
      text: document.getElementById(`tt-stat-${agent.id}`)?.textContent?.trim().toLowerCase() || '',
    })),
    hasPipelinePanel: () => isVisible(document.getElementById('pipeline-tt')),
    hasResultPanel: () => isVisible(document.getElementById('finalOutput-tt')),
    hasSocialOutput: () => isVisible(document.getElementById('socialOutput-tt')),
    hasSocialPanel: () => [
      document.getElementById('socialSection-tt'),
      document.getElementById('socialOutput-tt'),
      document.getElementById('reseauxOnlySection-tt'),
    ].some(isVisible),
    hasEtsyPanel: () => Boolean(document.getElementById('etsyApiPanel-tt')),
    nameFieldIds: ['tt-fNomCourt', 'tt-fNom'],
  });

  const {
    init: initDndSoloTabs,
    refresh: refreshDndSoloTabs,
    activate: activateDndSoloTab,
    reset: resetDndSoloTabs,
    isResultAvailable: isDndSoloResultAvailable,
  } = controller;

  global.PipelineUIDndTabs = {
    initDndSoloTabs,
    refreshDndSoloTabs,
    activateDndSoloTab,
    resetDndSoloTabs,
    isDndSoloResultAvailable,
  };

  global.PipelineUI.dndTabs = global.PipelineUI.dndTabs || {};
  Object.assign(global.PipelineUI.dndTabs, global.PipelineUIDndTabs);
  Object.assign(global, global.PipelineUIDndTabs);
})(window);
