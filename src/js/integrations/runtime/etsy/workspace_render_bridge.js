(function initPipelineUIEtsyWorkspaceRenderBridge(global) {
  'use strict';

  // Workspace bridge for Etsy shared render modules: steps, details, attributes and media.
  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};

  const getUi = () => global.PipelineUIEtsyUI || {};
  const getSharedUi = () => getUi().shared || {};
  const getCoreUi = () => getSharedUi().core || {};
  const getMediaUi = () => getSharedUi().media || {};
  const getDetailsUi = () => getSharedUi().details || {};
  const getAttributesUi = () => getSharedUi().attributes || {};
  const getPublicationUi = () => getSharedUi().publication || {};
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
      renderAttributesStep: runtime.workspaceRenderAttributesStep,
      renderPublicationStep: runtime.workspaceRenderPublicationStep,
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
      getVideoPreviewSource: runtime.getVideoPreviewSource,
      togglePipelineAltMediaSelection: (targetPrefix, mediaKey) => runtime.togglePipelineAltMediaSelection?.(targetPrefix, mediaKey, {
        getState: runtime.getWorkspaceState,
        syncPayloadText: runtime.syncPayloadText,
      }),
      setAllPipelineAltMediaSelections: (targetPrefix, enabled) => runtime.setAllPipelineAltMediaSelections?.(targetPrefix, enabled, {
        getState: runtime.getWorkspaceState,
        syncPayloadText: runtime.syncPayloadText,
      }),
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

  function renderAttributesStep(prefix) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getAttributesUi().renderAttributesStep?.(prefix, {
      getState: runtime.getWorkspaceState,
      getNode: runtime.getNode,
      ensureAttributesDraft: runtime.ensureAttributesDraft,
      applyAttributesDraftToPayload: runtime.applyAttributesDraftToPayload,
      updateAttributesDraft: runtime.updateAttributesDraft,
      syncPayloadText: runtime.syncPayloadText,
      syncWorkspacePayloadView: runtime.workspaceSyncWorkspacePayloadView || runtime.syncWorkspacePayloadView,
    });
  }

  function renderPublicationStep(prefix) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getPublicationUi().renderPublicationStep?.(prefix, {
      getState: runtime.getWorkspaceState,
      getNode: runtime.getNode,
      buildPublicationPayloadSnapshot: runtime.buildPublicationPayloadSnapshot,
      getPublicationMode: runtime.getPublicationMode,
      setPublicationMode: runtime.setPublicationMode,
      publishDraftListing: runtime.workspacePublishDraftListing || runtime.publishDraftListing,
    });
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
    workspaceRenderAttributesStep: renderAttributesStep,
    workspaceRenderPublicationStep: renderPublicationStep,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
