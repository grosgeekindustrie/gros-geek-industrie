(function initPipelineUIEtsyWorkspaceRenderBridge(global) {
  'use strict';

  // Workspace bridge for Etsy shared render modules: steps, details and media.
  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};

  const getUi = () => global.PipelineUIEtsyUI || {};
  const getSharedUi = () => getUi().shared || {};
  const getCoreUi = () => getSharedUi().core || {};
  const getMediaUi = () => getSharedUi().media || {};
  const getDetailsUi = () => getSharedUi().details || {};
  const getStepsUi = () => getSharedUi().steps || {};

  function setTextContent(node, value) {
    return getCoreUi().setTextContent?.(node, value);
  }

  function setStatus(prefix, message) {
    return getCoreUi().setStatus?.(prefix, message, {
      getNodes: global.PipelineUIEtsyRuntime?.getWorkspaceNodes,
    });
  }

  function configureWorkspaceProgress(prefix) {
    return getStepsUi().configureWorkspaceProgress?.(prefix, {
      getNodes: global.PipelineUIEtsyRuntime?.getWorkspaceNodes,
    });
  }

  function setWorkspaceActiveStep(prefix, nextStep) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getStepsUi().setWorkspaceActiveStep?.(prefix, nextStep, {
      getNodes: runtime.getWorkspaceNodes,
      getState: runtime.getWorkspaceState,
      syncPayloadText: runtime.syncPayloadText,
      syncWorkspacePayloadView: runtime.syncWorkspacePayloadView,
      renderDetailsStep: runtime.workspaceRenderDetailsStep,
      renderOptionsStep: runtime.workspaceRenderOptionsStep,
    });
  }

  function ensureWorkspaceSourcePanel(prefix) {
    return getStepsUi().ensureWorkspaceSourcePanel?.(prefix, {
      getNodes: global.PipelineUIEtsyRuntime?.getWorkspaceNodes,
      setTextContent,
    });
  }

  function renderPlaceholder(prefix, message) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getMediaUi().renderPlaceholder?.(prefix, message, {
      getNodes: runtime.getWorkspaceNodes,
      destroySortable: runtime.destroySortable,
      triggerAddImages: runtime.workspaceTriggerAddImages,
    });
  }

  function renderSummary(prefix, mediaPayload) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getMediaUi().renderSummary?.(prefix, mediaPayload, {
      getNodes: runtime.getWorkspaceNodes,
      getState: runtime.getWorkspaceState,
    });
  }

  function renderMediaGrid(prefix, mediaPayload) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getMediaUi().renderMediaGrid?.(prefix, mediaPayload, {
      getNodes: runtime.getWorkspaceNodes,
      getState: runtime.getWorkspaceState,
      getOrderedMediaItems: runtime.getOrderedMediaItems,
      getDisplayImageSource: runtime.getDisplayImageSource,
      removeMediaByKeyInline: runtime.workspaceRemoveMediaByKeyInline || runtime.removeMediaByKeyInline,
      openMediaLightbox: runtime.workspaceOpenMediaLightbox || runtime.openMediaLightbox,
      triggerAddImages: runtime.workspaceTriggerAddImages,
      clearAllMedia: runtime.workspaceClearAllMedia || runtime.clearAllMedia,
      setupSortable: runtime.workspaceSetupSortable || runtime.setupSortable,
    });
  }

  function autoResizeDescription(prefix) {
    return getDetailsUi().autoResizeDescription?.(prefix);
  }

  function renderTitleCounter(prefix) {
    return getDetailsUi().renderTitleCounter?.(prefix);
  }

  function updateDetailsDraft(prefix, patch) {
    return getDetailsUi().updateDetailsDraft?.(prefix, patch);
  }

  function renderDetailsStep(prefix) {
    return getDetailsUi().renderDetailsStep?.(prefix);
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    workspaceSetTextContent: setTextContent,
    workspaceSetStatus: setStatus,
    workspaceConfigureWorkspaceProgress: configureWorkspaceProgress,
    workspaceSetWorkspaceActiveStep: setWorkspaceActiveStep,
    workspaceEnsureWorkspaceSourcePanel: ensureWorkspaceSourcePanel,
    workspaceRenderPlaceholder: renderPlaceholder,
    workspaceRenderSummary: renderSummary,
    workspaceRenderMediaGrid: renderMediaGrid,
    workspaceAutoResizeDescription: autoResizeDescription,
    workspaceRenderTitleCounter: renderTitleCounter,
    workspaceUpdateDetailsDraft: updateDetailsDraft,
    workspaceRenderDetailsStep: renderDetailsStep,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
