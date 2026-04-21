'use strict';

// Données déclaratives des modes pipeline.
// Source de vérité pour les labels, racines UI et mappings shell/tab/stepper.

(function initPipelineUIDataModes(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataModes = global.PipelineUIDataModes || {};

  const pipelineModeUi = {
    tabletop: {
      mode: 'tabletop',
      prefix: 'tt',
      formLabel: '🎲 Tabletop DnD',
      pageTitle: '🎲 Etsy Pipeline DnD v1.2',
      headerTitle: '🎲 Etsy Pipeline DnD',
      headerModeLabel: 'DnD Tabletop',
      uiRootId: 'ui-tt',
      panelIds: ['pipeline-tt', 'finalOutput-tt', 'socialSection-tt', 'socialOutput-tt', 'reseauxOnlySection-tt'],
      tabs: {
        initMethod: 'initDndSoloTabs',
        refreshMethod: 'refreshDndSoloTabs',
        activateMethod: 'activateDndSoloTab',
        resetMethod: 'resetDndSoloTabs',
        isResultAvailableMethod: 'isDndSoloResultAvailable',
      },
      stepper: {
        initMethod: 'initDndStepper',
        refreshMethod: 'refreshDndStepper',
        resetMethod: 'resetDndStepper',
      },
    },
    collection: {
      mode: 'collection',
      prefix: 'col',
      formLabel: '🖼️ Collection',
      pageTitle: '🖼️ Etsy Pipeline Collection v1.2',
      headerTitle: '🖼️ Etsy Pipeline Collection',
      headerModeLabel: 'Collection',
      uiRootId: 'ui-col',
      panelIds: ['pipeline-col', 'finalOutput-col', 'socialSection-col', 'socialOutput-col', 'reseauxOnlySection-col'],
      tabs: {
        initMethod: 'initCollectionSoloTabs',
        refreshMethod: 'refreshCollectionSoloTabs',
        activateMethod: 'activateCollectionSoloTab',
        resetMethod: 'resetCollectionSoloTabs',
        isResultAvailableMethod: 'isCollectionSoloResultAvailable',
      },
      stepper: {
        initMethod: 'initCollectionStepper',
        refreshMethod: 'refreshCollectionStepper',
        resetMethod: 'resetCollectionStepper',
      },
    },
  };

  const getPipelineModeKeyFromData = (mode = 'tabletop') => (mode === 'collection' ? 'collection' : 'tabletop');
  const getPipelineModesFromData = () => Object.keys(pipelineModeUi);
  const getPipelineModeUiConfigFromData = (mode = 'tabletop') => pipelineModeUi[getPipelineModeKeyFromData(mode)] || pipelineModeUi.tabletop;
  const getPipelineModePrefixFromData = (mode = 'tabletop') => getPipelineModeUiConfigFromData(mode).prefix;
  const getPipelineModeByPrefixFromData = (prefix = 'tt') => (
    getPipelineModesFromData().find((mode) => getPipelineModeUiConfigFromData(mode).prefix === prefix) || 'tabletop'
  );

  Object.assign(global.PipelineUIDataModes, {
    PIPELINE_MODE_UI: pipelineModeUi,
    getPipelineModeKeyFromData,
    getPipelineModesFromData,
    getPipelineModeUiConfigFromData,
    getPipelineModePrefixFromData,
    getPipelineModeByPrefixFromData,
  });

  Object.assign(global.PipelineUIData, {
    modes: global.PipelineUIDataModes,
  });
})(window);
