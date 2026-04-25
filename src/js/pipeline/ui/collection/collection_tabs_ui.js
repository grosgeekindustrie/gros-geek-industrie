'use strict';

(function initPipelineUICollectionTabs(global) {

// Navigation solo Collection par onglets.
// Le markup reste dédié au mode Collection, mais la logique d'état est désormais
// mutualisée via le core partagé pour converger avec Tabletop.
  global.PipelineUI = global.PipelineUI || {};

  const createSoloTabsController = global.PipelineUISoloTabsCore?.createSoloTabsController;
  if (typeof createSoloTabsController !== 'function') return;

  const isVisible = (element) => Boolean(element) && window.getComputedStyle(element).display !== 'none';
  const getAgents = () => (
    typeof global.getPipelineRuntimeAgentsForPrefix === 'function'
      ? global.getPipelineRuntimeAgentsForPrefix('col')
      : (typeof global.getPipelineAgentsForPrefix === 'function'
          ? global.getPipelineAgentsForPrefix('col')
          : [])
  );
  const getNameField = () => document.getElementById('col-fNomCourt') || document.getElementById('col-fNom');
  const getFullNameField = () => document.getElementById('col-fNom') || document.getElementById('col-fNomCourt');

  const ensureSocialTabContentVisibility = () => {
    const socialSection = document.getElementById('socialSection-col');
    const socialOutput = document.getElementById('socialOutput-col');
    const reseauxOnlySection = document.getElementById('reseauxOnlySection-col');
    const hasVisibleContent = [socialSection, socialOutput, reseauxOnlySection].some(isVisible);

    if (!hasVisibleContent && socialSection) {
      socialSection.style.display = 'block';
    }
  };

  const controller = createSoloTabsController({
    pipelinePrefix: 'col',
    getRoot: () => document.querySelector('[data-js="collection-solo-tabs"]'),
    getTabButton: (tabId) => document.querySelector('[data-js="collection-solo-tabs"]')?.querySelector(`[data-collection-tab="${tabId}"]`) || null,
    getTabState: (tabId) => document.querySelector('[data-js="collection-solo-tabs"]')?.querySelector(`[data-collection-tab-state="${tabId}"]`) || null,
    getTabPanel: (tabId) => document.querySelector('[data-js="collection-solo-tabs"]')?.querySelector(`[data-collection-tab-panel="${tabId}"]`) || null,
    getStatusBox: () => document.querySelector('[data-js="collection-solo-status"]'),
    getStatusText: () => document.querySelector('[data-js="collection-solo-status-text"]'),
    getLaunchState: () => global.getPipelineLaunchState?.('col') || null,
    getDisplayName: () => {
      const shortName = getNameField()?.value?.trim();
      const fullName = getFullNameField()?.value?.trim();
      return shortName || fullName || 'Nouvelle fiche';
    },
    getAgentStatusEntries: () => getAgents().map((agent) => ({
      id: agent.id,
      text: document.getElementById(`col-stat-${agent.id}`)?.textContent?.trim().toLowerCase() || '',
    })),
    hasPipelinePanel: () => isVisible(document.getElementById('pipeline-col')),
    hasResultPanel: () => isVisible(document.getElementById('finalOutput-col')),
    hasSocialOutput: () => isVisible(document.getElementById('socialOutput-col')),
    hasSocialPanel: () => [
      document.getElementById('socialSection-col'),
      document.getElementById('socialOutput-col'),
      document.getElementById('reseauxOnlySection-col'),
    ].some(Boolean),
    onActiveTabChange: ({ tabId }) => {
      if (tabId === 'social') ensureSocialTabContentVisibility();
    },
    nameFieldIds: ['col-fNomCourt', 'col-fNom'],
  });

  const {
    init: initCollectionSoloTabs,
    refresh: refreshCollectionSoloTabs,
    activate: activateCollectionSoloTab,
    reset: resetCollectionSoloTabs,
    isResultAvailable: isCollectionSoloResultAvailable,
  } = controller;

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
