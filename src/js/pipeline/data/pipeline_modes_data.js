'use strict';

// Donnees declaratives des modes pipeline.
// Source de verite pour les labels, racines UI et mappings shell/tab/stepper.

(function initPipelineUIDataModes(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataModes = global.PipelineUIDataModes || {};
  const sharedConstants = global.PipelineUISharedConstants || {};
  const PIPELINE_MODES = sharedConstants.PIPELINE_MODES || {
    TABLETOP: 'tabletop',
    COLLECTION: 'collection',
  };
  const PIPELINE_PREFIXES = sharedConstants.PIPELINE_PREFIXES || {
    TABLETOP: 'tt',
    COLLECTION: 'col',
  };

  const pipelineModeUi = {
    [PIPELINE_MODES.TABLETOP]: {
      mode: PIPELINE_MODES.TABLETOP,
      prefix: PIPELINE_PREFIXES.TABLETOP,
      formLabel: 'Tabletop DnD',
      pageTitle: 'Etsy Pipeline DnD v1.2',
      headerTitle: 'Etsy Pipeline DnD',
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
    [PIPELINE_MODES.COLLECTION]: {
      mode: PIPELINE_MODES.COLLECTION,
      prefix: PIPELINE_PREFIXES.COLLECTION,
      formLabel: 'Collection',
      pageTitle: 'Etsy Pipeline Collection v1.2',
      headerTitle: 'Etsy Pipeline Collection',
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

  const getPipelineModeKeyFromData = (mode = PIPELINE_MODES.TABLETOP) => (
    mode === PIPELINE_MODES.COLLECTION ? PIPELINE_MODES.COLLECTION : PIPELINE_MODES.TABLETOP
  );
  const getPipelineModesFromData = () => Object.keys(pipelineModeUi);
  const getPipelineModeUiConfigFromData = (mode = PIPELINE_MODES.TABLETOP) => (
    pipelineModeUi[getPipelineModeKeyFromData(mode)] || pipelineModeUi[PIPELINE_MODES.TABLETOP]
  );
  const getPipelineModePrefixFromData = (mode = PIPELINE_MODES.TABLETOP) => getPipelineModeUiConfigFromData(mode).prefix;
  const getPipelineModeByPrefixFromData = (prefix = PIPELINE_PREFIXES.TABLETOP) => (
    getPipelineModesFromData().find((mode) => getPipelineModeUiConfigFromData(mode).prefix === prefix) || PIPELINE_MODES.TABLETOP
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
