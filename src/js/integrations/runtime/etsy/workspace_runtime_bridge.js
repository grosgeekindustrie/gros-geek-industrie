(function initPipelineUIEtsyWorkspaceRuntimeBridge(global) {
  'use strict';

  // Final Etsy workspace orchestration bridge.
  // Keeps workspace_ui.js thin by hosting the remaining runtime assembly.
  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};

  function getRuntime() {
    return global.PipelineUIEtsyRuntime || {};
  }

  function getWorkspaceUiDeps() {
    const runtime = getRuntime();
    return {
      getState: runtime.getWorkspaceState,
      getNodes: runtime.getWorkspaceNodes,
      renderWorkspace,
    };
  }

  function triggerAddImages(prefix) {
    const input = getRuntime().ensureUploadInput?.(prefix);
    input?.click();
  }

  function openCategoryPicker(prefix) {
    const runtime = getRuntime();
    return runtime.openCategoryPicker?.(prefix, {
      ensureCategoryPickerOverlay: runtime.workspaceEnsureCategoryPickerOverlay,
      getNode: runtime.getNode,
      getState: runtime.getWorkspaceState,
      ensureDetailsDraft: runtime.ensureDetailsDraft,
      runCategoryPickerSearch,
    });
  }

  function renderCategoryPickerResults(entries) {
    const runtime = getRuntime();
    return runtime.renderCategoryPickerResults?.(entries, {
      getNode: runtime.getNode,
      getState: runtime.getWorkspaceState,
      updateDetailsDraft: runtime.workspaceUpdateDetailsDraft,
      renderDetailsStep: runtime.workspaceRenderDetailsStep,
      closeCategoryPickerOverlay: runtime.workspaceCloseCategoryPickerOverlay,
    });
  }

  function runCategoryPickerSearch(query) {
    const runtime = getRuntime();
    return runtime.runCategoryPickerSearch?.(query, {
      getNode: runtime.getNode,
      getState: runtime.getWorkspaceState,
      fetchTaxonomySearch: runtime.fetchTaxonomySearch,
      renderCategoryPickerResults,
    });
  }

  function resetEditedImage(prefix, mediaKey) {
    const runtime = getRuntime();
    return runtime.resetEditedImage?.(prefix, mediaKey, {
      ...getWorkspaceUiDeps(),
      getMediaItemByKey: runtime.getMediaItemByKey,
      clearEditedImageState: runtime.clearEditedImageState,
      fillMediaLightbox: runtime.workspaceFillMediaLightbox,
    });
  }

  function openImageEditor(prefix, mediaKey) {
    const runtime = getRuntime();
    return runtime.openImageEditor?.(prefix, mediaKey, {
      ...getWorkspaceUiDeps(),
      getMediaItemByKey: runtime.getMediaItemByKey,
      getFilerobotCtor: runtime.getFilerobotCtor,
      getImagePreviewSource: runtime.getImagePreviewSource,
      routes: runtime.getRoutes?.() || global.PipelineUIDataIntegrations?.etsyAuth?.routes || {},
      ensureImageEditorOverlay: runtime.workspaceEnsureImageEditorOverlay,
      closeImageEditorOverlay: runtime.workspaceCloseImageEditorOverlay,
      getNode: runtime.getNode,
      IMAGE_EDITOR_OVERLAY_ID: 'etsyImageEditorOverlay',
      getSavedEditorDesignState: runtime.getSavedEditorDesignState,
      setEditedImageState: runtime.setEditedImageState,
      fillMediaLightbox: runtime.workspaceFillMediaLightbox,
      getActiveEditorSession: runtime.getActiveEditorSession,
      setActiveEditorSession: runtime.setActiveEditorSession,
      getImageId: runtime.getImageId,
    });
  }

  function setMediaAltText(prefix, mediaKey, nextAltText) {
    const runtime = getRuntime();
    return runtime.setMediaAltText?.(prefix, mediaKey, nextAltText, {
      getState: runtime.getWorkspaceState,
      getMediaItemByKey: runtime.getMediaItemByKey,
      syncPayloadText: runtime.syncPayloadText,
    });
  }

  function openMediaLightbox(prefix, mediaKey) {
    return getRuntime().openMediaLightbox?.(prefix, mediaKey, {
      fillMediaLightbox: getRuntime().workspaceFillMediaLightbox,
    });
  }

  function setupSortable(prefix, grid) {
    const runtime = getRuntime();
    return runtime.setupSortable?.(prefix, grid, {
      getState: runtime.getWorkspaceState,
      getSortableCtor: runtime.getSortableCtor,
      destroySortable: runtime.destroySortable,
      syncPayloadText: runtime.syncPayloadText,
      setStatus: runtime.workspaceSetStatus,
    });
  }

  function addLocalImages(prefix, files) {
    const runtime = getRuntime();
    return runtime.addLocalImages?.(prefix, files, {
      getState: runtime.getWorkspaceState,
      readFileAsDataUrl: runtime.readFileAsDataUrl,
      loadImageFromDataUrl: runtime.loadImageFromDataUrl,
      appendMediaKeysToOrder: runtime.appendMediaKeysToOrder,
      getLocalImageKey: runtime.getLocalImageKey,
      getLocalVideoKey: runtime.getLocalVideoKey,
      syncPayloadText: runtime.syncPayloadText,
      renderWorkspace,
      setStatus: runtime.workspaceSetStatus,
    });
  }

  function removeMediaByKey(prefix, mediaKey) {
    const runtime = getRuntime();
    return runtime.removeMediaByKey?.(prefix, mediaKey, {
      ...getWorkspaceUiDeps(),
      getMediaItemByKey: runtime.getMediaItemByKey,
      getActiveEditorSession: runtime.getActiveEditorSession,
      closeImageEditorOverlay: runtime.workspaceCloseImageEditorOverlay,
      getImageKey: runtime.getImageKey,
      getVideoKey: runtime.getVideoKey,
      getLocalImageKey: runtime.getLocalImageKey,
      removeMediaKeyFromOrder: runtime.removeMediaKeyFromOrder,
      clearEditedImageState: runtime.clearEditedImageState,
      closeMediaLightbox: runtime.workspaceCloseMediaLightbox,
      syncPayloadText: runtime.syncPayloadText,
    });
  }

  function removeMediaByKeyInline(prefix, mediaKey, cardNode) {
    const runtime = getRuntime();
    return runtime.removeMediaByKeyInline?.(prefix, mediaKey, cardNode, {
      ...getWorkspaceUiDeps(),
      getMediaItemByKey: runtime.getMediaItemByKey,
      getActiveEditorSession: runtime.getActiveEditorSession,
      closeImageEditorOverlay: runtime.workspaceCloseImageEditorOverlay,
      getImageKey: runtime.getImageKey,
      getVideoKey: runtime.getVideoKey,
      getLocalImageKey: runtime.getLocalImageKey,
      removeMediaKeyFromOrder: runtime.removeMediaKeyFromOrder,
      clearEditedImageState: runtime.clearEditedImageState,
      closeMediaLightbox: runtime.workspaceCloseMediaLightbox,
      syncPayloadText: runtime.syncPayloadText,
      getOrderedMediaItems: runtime.getOrderedMediaItems,
      syncWorkspacePanels,
      refreshSortableBinding,
    });
  }

  function clearAllMedia(prefix) {
    const runtime = getRuntime();
    return runtime.clearAllMedia?.(prefix, {
      ...getWorkspaceUiDeps(),
      getActiveEditorSession: runtime.getActiveEditorSession,
      closeImageEditorOverlay: runtime.workspaceCloseImageEditorOverlay,
      resetWorkspaceEditedImages: runtime.resetWorkspaceEditedImages,
      closeMediaLightbox: runtime.workspaceCloseMediaLightbox,
      syncPayloadText: runtime.syncPayloadText,
      setStatus: runtime.workspaceSetStatus,
    });
  }

  function syncWorkspacePayloadView(prefix) {
    const runtime = getRuntime();
    return runtime.syncWorkspacePayloadView?.(prefix, {
      getState: runtime.getWorkspaceState,
      getNodes: runtime.getWorkspaceNodes,
      ensureWorkspaceSourcePanel: runtime.workspaceEnsureWorkspaceSourcePanel,
    });
  }

  function syncWorkspacePanels(prefix) {
    const runtime = getRuntime();
    return runtime.syncWorkspacePanels?.(prefix, {
      getState: runtime.getWorkspaceState,
      getNodes: runtime.getWorkspaceNodes,
      renderSummary: runtime.workspaceRenderSummary,
      renderDetailsStep: runtime.workspaceRenderDetailsStep,
      renderAttributesStep: runtime.workspaceRenderAttributesStep,
      renderPublicationStep: runtime.workspaceRenderPublicationStep,
    });
  }

  function refreshSortableBinding(prefix) {
    const runtime = getRuntime();
    return runtime.refreshSortableBinding?.(prefix, {
      getState: runtime.getWorkspaceState,
      getNodes: runtime.getWorkspaceNodes,
      destroySortable: runtime.destroySortable,
      setupSortable,
    });
  }

  function renderWorkspace(prefix) {
    const runtime = getRuntime();
    return runtime.renderWorkspace?.(prefix, {
      getState: runtime.getWorkspaceState,
      getNodes: runtime.getWorkspaceNodes,
      ensureWorkspaceSourcePanel: runtime.workspaceEnsureWorkspaceSourcePanel,
      renderSummary: runtime.workspaceRenderSummary,
      renderDetailsStep: runtime.workspaceRenderDetailsStep,
      renderAttributesStep: runtime.workspaceRenderAttributesStep,
      renderPublicationStep: runtime.workspaceRenderPublicationStep,
      renderMediaGrid: runtime.workspaceRenderMediaGrid,
      setWorkspaceActiveStep: runtime.workspaceSetWorkspaceActiveStep,
      getMediaItemByKey: runtime.getMediaItemByKey,
      fillMediaLightbox: runtime.workspaceFillMediaLightbox,
      renderPlaceholder: runtime.workspaceRenderPlaceholder,
    });
  }

  function loadEtsyWorkspaceMedia(prefix) {
    const runtime = getRuntime();
    return runtime.loadEtsyWorkspaceMedia?.(prefix, {
      ...getWorkspaceUiDeps(),
      extractListingId: global.PipelineUIEtsyData?.extractListingId,
      setStatus: runtime.workspaceSetStatus,
      fetchListingPayload: runtime.fetchListingPayload,
      fetchListingPropertiesPayload: runtime.fetchListingPropertiesPayload,
      getActiveEditorSession: runtime.getActiveEditorSession,
      closeImageEditorOverlay: runtime.workspaceCloseImageEditorOverlay,
      closeCategoryPickerOverlay: runtime.workspaceCloseCategoryPickerOverlay,
      normalizeListingPayload: global.PipelineUIEtsyData?.normalizeEtsyListingPayload,
      applyListingPropertyOverrides: global.PipelineUIEtsyData?.applyListingPropertyOverrides,
      buildDetailsDraftFromPayload: global.PipelineUIEtsyData?.buildDetailsDraftFromPayload,
      buildAttributesDraftFromPayload: global.PipelineUIEtsyData?.buildAttributesDraftFromPayload,
      getPipelineSeedForEtsy: runtime.getPipelineSeedForEtsy,
      resetWorkspaceEditedImages: runtime.resetWorkspaceEditedImages,
      applyDetailsDraftToPayload: runtime.applyDetailsDraftToPayload,
      applyAttributesDraftToPayload: runtime.applyAttributesDraftToPayload,
      buildDefaultMediaOrder: runtime.buildDefaultMediaOrder,
      syncPayloadText: runtime.syncPayloadText,
      destroySortable: runtime.destroySortable,
    });
  }

  function importPipelineSeedToWorkspace(prefix) {
    const runtime = getRuntime();
    return runtime.importPipelineSeedToWorkspace?.(prefix, {
      getState: runtime.getWorkspaceState,
      getPipelineSeedForEtsy: runtime.getPipelineSeedForEtsy,
      getSelectedPipelineAltMediaKeys: runtime.getSelectedPipelineAltMediaKeys,
      getMediaItemByKey: runtime.getMediaItemByKey,
      applyDetailsDraftToPayload: runtime.applyDetailsDraftToPayload,
      applyAttributesDraftToPayload: runtime.applyAttributesDraftToPayload,
      syncPayloadText: runtime.syncPayloadText,
      renderWorkspace,
      setStatus: runtime.workspaceSetStatus,
    });
  }

  function copyEtsyWorkspacePayload(prefix) {
    return getRuntime().copyEtsyWorkspacePayload?.(prefix, {
      getState: getRuntime().getWorkspaceState,
    });
  }

  function publishDraftListing(prefix) {
    const runtime = getRuntime();
    return runtime.publishDraftListing?.(prefix, {
      getState: runtime.getWorkspaceState,
      createDraftListing: runtime.createDraftListing,
      updateExistingListing: runtime.updateExistingListing,
      updateExpiredListing: runtime.updateExpiredListing,
      applyAttributesDraftToPayload: runtime.applyAttributesDraftToPayload,
    });
  }

  function initEtsyWorkspaceContext(prefix) {
    const runtime = getRuntime();
    return runtime.initEtsyWorkspaceContext?.(prefix, {
      getNodes: runtime.getWorkspaceNodes,
      renderWorkspace,
      ensureWorkspaceSourcePanel: runtime.workspaceEnsureWorkspaceSourcePanel,
      configureWorkspaceProgress: runtime.workspaceConfigureWorkspaceProgress,
      ensureUploadInput: runtime.ensureUploadInput,
      addLocalImages,
      saveListingReference: runtime.saveListingReference,
      extractListingId: global.PipelineUIEtsyData?.extractListingId,
      setStatus: runtime.workspaceSetStatus,
      loadEtsyWorkspaceMedia,
      importPipelineSeedToWorkspace,
      setWorkspaceActiveStep: runtime.workspaceSetWorkspaceActiveStep,
      openCategoryPicker,
      updateDetailsDraft: runtime.workspaceUpdateDetailsDraft,
      renderTitleCounter: runtime.workspaceRenderTitleCounter,
      autoResizeDescription: runtime.workspaceAutoResizeDescription,
      restoreListingReference: runtime.restoreListingReference,
      publishDraftListing,
    });
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    workspaceTriggerAddImages: triggerAddImages,
    workspaceRenderCategoryPickerResults: renderCategoryPickerResults,
    workspaceRunCategoryPickerSearch: runCategoryPickerSearch,
    workspaceOpenCategoryPicker: openCategoryPicker,
    workspaceResetEditedImage: resetEditedImage,
    workspaceOpenImageEditor: openImageEditor,
    workspaceSetMediaAltText: setMediaAltText,
    workspaceOpenMediaLightbox: openMediaLightbox,
    workspaceSetupSortable: setupSortable,
    workspaceAddLocalImages: addLocalImages,
    workspaceRemoveMediaByKey: removeMediaByKey,
    workspaceRemoveMediaByKeyInline: removeMediaByKeyInline,
    workspaceClearAllMedia: clearAllMedia,
    workspaceSyncWorkspacePayloadView: syncWorkspacePayloadView,
    workspaceSyncWorkspacePanels: syncWorkspacePanels,
    workspaceRefreshSortableBinding: refreshSortableBinding,
    workspaceRenderWorkspace: renderWorkspace,
    workspaceLoadEtsyWorkspaceMedia: loadEtsyWorkspaceMedia,
    workspaceImportPipelineSeedToWorkspace: importPipelineSeedToWorkspace,
    workspaceCopyEtsyWorkspacePayload: copyEtsyWorkspacePayload,
    workspacePublishDraftListing: publishDraftListing,
    workspaceInitEtsyWorkspaceContext: initEtsyWorkspaceContext,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
