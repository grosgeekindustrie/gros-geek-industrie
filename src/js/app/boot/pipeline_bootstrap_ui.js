'use strict';

(function initPipelineUIBootstrap(global) {

// Orchestration legere du bootstrap pipeline.
// Partagee entre le boot initial et les rebuilds au switch de mode pour eviter
// que plusieurs points d'entree rejouent l'init chacun de leur cote.
  global.PipelineUI = global.PipelineUI || {};

  function getBootstrapPipelinePrefixes() {
    return typeof global.getPipelinePrefixes === 'function' ? global.getPipelinePrefixes() : ['tt', 'col'];
  }

  function restoreBootstrapImages() {
    const setupImageHandlers = global.PipelineUIImages?.setupImageHandlers;
    const restoreWorkspaceImages = global.PipelineUIIndexedDb?.restoreWorkspaceImages;
    if (typeof setupImageHandlers !== 'function') return;

    getBootstrapPipelinePrefixes().forEach((prefix) => {
      setupImageHandlers(prefix);
      restoreWorkspaceImages?.(prefix);
    });
  }

  function initializeNavigationUis() {
    global.initDndStepper?.();
    global.refreshDndStepper?.();
    global.initCollectionStepper?.();
    global.refreshCollectionStepper?.();
    global.initDndSoloTabs?.();
    global.refreshDndSoloTabs?.();
    global.initCollectionSoloTabs?.();
    global.refreshCollectionSoloTabs?.();
  }

  function restoreBootstrapView() {
    if (global._restoreView === 'form' && global._restoreMode) {
      global.selectMode(global._restoreMode);
      global._restoreView = null;
    }
  }

  function revealBootstrapUi() {
    document.body.classList.add('ready');
  }

  function rebuildModeUi(options = {}) {
    const {
      silentFileLoad = true,
      refreshCatalogs = true,
      rebuildPipeline = true,
      rebuildEchelles = true,
      reloadFormState = true,
      showModeToast = false,
      modeToastMessage = '',
      modeToastColor = '#4caf7d',
    } = options;

    if (refreshCatalogs) global.renderDeclarativeFormCatalogs?.({ shouldSave: false });
    if (rebuildPipeline) global.buildPipeline?.();
    if (rebuildEchelles) global.buildEchellesUI?.();
    if (reloadFormState) global.loadFormState?.();
    global.loadAllFiles?.(silentFileLoad);

    if (showModeToast && modeToastMessage) {
      global.showToast?.(modeToastMessage, modeToastColor);
    }
  }

  function initializePipelineUi() {
    restoreBootstrapImages();
    global.loadPersistedData?.();
    global.renderDeclarativeFormCatalogs?.({ shouldSave: false });
    global.buildPipeline?.();
    global.buildEchellesUI?.();
    global.loadFormState?.();
    global.attachFormPersistence?.();
    initializeNavigationUis();
    global.loadAllFiles?.();
    restoreBootstrapView();
    revealBootstrapUi();
  }

  global.PipelineUIBootstrap = {
    restoreBootstrapImages,
    initializeNavigationUis,
    restoreBootstrapView,
    revealBootstrapUi,
    rebuildModeUi,
    initializePipelineUi,
  };

  global.PipelineUI.bootstrap = global.PipelineUI.bootstrap || {};
  Object.assign(global.PipelineUI.bootstrap, global.PipelineUIBootstrap);
  Object.assign(global, {
    rebuildModeUi,
    initializePipelineUi,
  });
})(window);
