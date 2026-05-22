(function initPipelineUIEtsyWorkspaceModalsBridge(global) {
  'use strict';

  // Workspace bridge for Etsy shared modals and options UI modules.
  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};

  const getUi = () => global.PipelineUIEtsyUI || {};
  const getSharedUi = () => getUi().shared || {};
  const getMediaUi = () => getSharedUi().media || {};
  const getDetailsUi = () => getSharedUi().details || {};
  const getNode = (id) => global.PipelineUIEtsyRuntime?.getNode?.(id) || document.getElementById(id);
  const getState = (prefix) => global.PipelineUIEtsyRuntime?.getWorkspaceState?.(prefix) || null;

  function getLightboxImageSource(prefix, mediaKey, image, isLocal) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const edited = runtime.getEditedImageDataUrl?.(prefix, mediaKey);
    if (edited) return edited;
    if (isLocal) return String(image?.data_url || '');
    return String(
      image?.url_fullxfull
      || image?.full_url
      || image?.url_570xN
      || image?.url_570xn
      || image?.url
      || image?.src
      || image?.url_170x135
      || image?.url_75x75
      || ''
    );
  }

  function getLightboxImageSourceLabel(mediaItem) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return runtime.getImageEditorSource?.(mediaItem, {
      getImagePreviewSource: (image, isLocal) => getLightboxImageSource('', '', image, isLocal),
    }) || '';
  }

  function closeCategoryPickerOverlay() {
    return getDetailsUi().closeCategoryPickerOverlay?.({ getNode });
  }

  function ensureMediaLightbox() {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getMediaUi().ensureMediaLightbox?.({
      getNode,
      closeMediaLightbox,
      getActiveMediaSelection: runtime.getActiveMediaSelection,
      setMediaAltText: runtime.workspaceSetMediaAltText || runtime.setMediaAltText,
      openImageEditor: runtime.workspaceOpenImageEditor || runtime.openImageEditor,
      resetEditedImage: runtime.workspaceResetEditedImage || runtime.resetEditedImage,
    });
  }

  function ensureImageEditorOverlay() {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getMediaUi().ensureImageEditorOverlay?.({
      getNode,
      closeImageEditorOverlay,
      getActiveEditorSession: runtime.getActiveEditorSession,
      setActiveEditorSession: runtime.setActiveEditorSession,
    });
  }

  function ensureCategoryPickerOverlay() {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getDetailsUi().ensureCategoryPickerOverlay?.({
      getNode,
      closeCategoryPickerOverlay,
      runCategoryPickerSearch: runtime.runCategoryPickerSearch,
    });
  }

  function closeImageEditorOverlay() {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getMediaUi().closeImageEditorOverlay?.({
      getNode,
      getActiveEditorSession: runtime.getActiveEditorSession,
      setActiveEditorSession: runtime.setActiveEditorSession,
    });
  }

  function closeMediaLightbox() {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getMediaUi().closeMediaLightbox?.({
      getNode,
      getActiveMediaSelection: runtime.getActiveMediaSelection,
      getState,
    });
  }

  function fillMediaLightbox(prefix, mediaKey) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getMediaUi().fillMediaLightbox?.(prefix, mediaKey, {
      getState,
      getMediaItemByKey: runtime.getMediaItemByKey,
      ensureMediaLightbox,
      getNode,
      getDisplayImageSource: (activePrefix, activeMediaKey, image, isLocal) => (
        getLightboxImageSource(activePrefix, activeMediaKey, image, isLocal)
      ),
      getImageId: runtime.getImageId,
      getImageResolution: runtime.getImageResolution,
      getImageEditorSource: getLightboxImageSourceLabel,
      getEditedImageDataUrl: runtime.getEditedImageDataUrl,
      formatResolution: runtime.formatResolution,
      getVideoId: runtime.getVideoId,
      getVideoResolution: runtime.getVideoResolution,
    });
  }

  function renderOptionsStep(prefix) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getSharedUi().options?.renderOptionsStep?.(prefix, {
      getState: runtime.getWorkspaceState,
      getNode,
      ensureOptionsDraft: runtime.ensureOptionsDraft,
      applyOptionsDraftToPayload: runtime.applyOptionsDraftToPayload,
      syncPayloadText: runtime.syncPayloadText,
      syncWorkspacePayloadView: runtime.workspaceSyncWorkspacePayloadView || runtime.syncWorkspacePayloadView,
      getProductAssignedImage: runtime.getProductAssignedImage,
      updateOptionsDraft: runtime.updateOptionsDraft,
    });
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    workspaceCloseCategoryPickerOverlay: closeCategoryPickerOverlay,
    workspaceEnsureMediaLightbox: ensureMediaLightbox,
    workspaceEnsureImageEditorOverlay: ensureImageEditorOverlay,
    workspaceEnsureCategoryPickerOverlay: ensureCategoryPickerOverlay,
    workspaceCloseImageEditorOverlay: closeImageEditorOverlay,
    workspaceCloseMediaLightbox: closeMediaLightbox,
    workspaceFillMediaLightbox: fillMediaLightbox,
    workspaceRenderOptionsStep: renderOptionsStep,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
