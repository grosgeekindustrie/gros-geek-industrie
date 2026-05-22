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
  const getShippingUi = () => getSharedUi().shipping || {};
  const getSettingsUi = () => getSharedUi().settings || {};
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
      renderOptionsStep: runtime.workspaceRenderOptionsStep,
      renderAttributesStep: runtime.workspaceRenderAttributesStep,
      renderShippingStep: runtime.workspaceRenderShippingStep,
      ensureShippingReferences: runtime.workspaceEnsureShippingReferences || runtime.ensureShippingReferences,
      renderSettingsStep: runtime.workspaceRenderSettingsStep,
      ensureSettingsReferences: runtime.workspaceEnsureSettingsReferences || runtime.ensureSettingsReferences,
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

  function renderShippingStep(prefix) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getShippingUi().renderShippingStep?.(prefix, {
      getState: runtime.getWorkspaceState,
      getNode: runtime.getNode,
      ensureShippingDraft: runtime.ensureShippingDraft,
      applyShippingDraftToPayload: runtime.applyShippingDraftToPayload,
      updateShippingDraft: runtime.updateShippingDraft,
      setShippingProfileEditorOpen: runtime.setShippingProfileEditorOpen,
      ensureShippingReferences: runtime.workspaceEnsureShippingReferences || runtime.ensureShippingReferences,
      syncPayloadText: runtime.syncPayloadText,
    });
  }

  function renderSettingsStep(prefix) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getSettingsUi().renderSettingsStep?.(prefix, {
      getState: runtime.getWorkspaceState,
      getNode: runtime.getNode,
      ensureSettingsDraft: runtime.ensureSettingsDraft,
      applySettingsDraftToPayload: runtime.applySettingsDraftToPayload,
      updateSettingsDraft: runtime.updateSettingsDraft,
      ensureSettingsReferences: runtime.workspaceEnsureSettingsReferences || runtime.ensureSettingsReferences,
      syncPayloadText: runtime.syncPayloadText,
    });
  }

  function renderPublicationStep(prefix) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getPublicationUi().renderPublicationStep?.(prefix, {
      getState: runtime.getWorkspaceState,
      getNode: runtime.getNode,
      buildPublicationPayloadSnapshot: runtime.buildPublicationPayloadSnapshot,
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
    workspaceRenderShippingStep: renderShippingStep,
    workspaceRenderSettingsStep: renderSettingsStep,
    workspaceRenderPublicationStep: renderPublicationStep,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
