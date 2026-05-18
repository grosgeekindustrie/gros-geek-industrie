(function initPipelineUIEtsyWorkspaceModalsBridge(global) {
  'use strict';

  // Workspace bridge for Etsy shared modals and options UI modules.
  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};

  const getUi = () => global.PipelineUIEtsyUI || {};
  const getSharedUi = () => getUi().shared || {};
  const getModalsUi = () => getSharedUi().modals || {};
  const getOptionsUi = () => getSharedUi().options || {};
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
    return getModalsUi().closeCategoryPickerOverlay?.({ getNode });
  }

  function ensureMediaLightbox() {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getModalsUi().ensureMediaLightbox?.({
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
    return getModalsUi().ensureImageEditorOverlay?.({
      getNode,
      closeImageEditorOverlay,
      getActiveEditorSession: runtime.getActiveEditorSession,
      setActiveEditorSession: runtime.setActiveEditorSession,
    });
  }

  function ensureCategoryPickerOverlay() {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getModalsUi().ensureCategoryPickerOverlay?.({
      getNode,
      closeCategoryPickerOverlay,
      runCategoryPickerSearch: runtime.runCategoryPickerSearch,
    });
  }

  function ensureOptionsOverlays() {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getModalsUi().ensureOptionsOverlays?.({
      getNode,
      closeOptionsOverlays,
      openOptionTypePicker,
      openOptionEditor,
      getOptionsModalState: runtime.getOptionsModalState,
      renderOptionEditorState,
      updateOptionsDraft: runtime.updateOptionsDraft,
      renderOptionsStep,
    });
  }

  function closeOptionsOverlays() {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getModalsUi().closeOptionsOverlays?.({
      getNode,
      getOptionsModalState: runtime.getOptionsModalState,
    });
  }

  function closeImageEditorOverlay() {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getModalsUi().closeImageEditorOverlay?.({
      getNode,
      getActiveEditorSession: runtime.getActiveEditorSession,
      setActiveEditorSession: runtime.setActiveEditorSession,
    });
  }

  function closeMediaLightbox() {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getModalsUi().closeMediaLightbox?.({
      getNode,
      getActiveMediaSelection: runtime.getActiveMediaSelection,
      getState,
    });
  }

  function fillMediaLightbox(prefix, mediaKey) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getModalsUi().fillMediaLightbox?.(prefix, mediaKey, {
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

  function openOptionsModal(prefix) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getOptionsUi().openOptionsModal?.(prefix, {
      ensureOptionsOverlays,
      getNode,
      setOptionsModalState: runtime.setOptionsModalState,
      renderOptionsModalState,
    });
  }

  function openOptionTypePicker() {
    return getOptionsUi().openOptionTypePicker?.({
      ensureOptionsOverlays,
      openOptionEditor,
    });
  }

  function renderOptionEditorState() {
    return getOptionsUi().renderOptionEditorState?.();
  }

  function openOptionEditor(variationId = '', presetName = '') {
    const runtime = global.PipelineUIEtsyRuntime || {};
    return getOptionsUi().openOptionEditor?.(variationId, presetName, {
      setOptionsModalState: runtime.setOptionsModalState,
      ensureOptionsOverlays,
    });
  }

  function renderOptionsModalState(prefix) {
    return getOptionsUi().renderOptionsModalState?.(prefix, {
      renderOptionsModalState,
      renderOptionsStep,
    });
  }

  function renderOptionsStep(prefix) {
    return getOptionsUi().renderOptionsStep?.(prefix);
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    workspaceCloseCategoryPickerOverlay: closeCategoryPickerOverlay,
    workspaceEnsureMediaLightbox: ensureMediaLightbox,
    workspaceEnsureImageEditorOverlay: ensureImageEditorOverlay,
    workspaceEnsureCategoryPickerOverlay: ensureCategoryPickerOverlay,
    workspaceEnsureOptionsOverlays: ensureOptionsOverlays,
    workspaceCloseOptionsOverlays: closeOptionsOverlays,
    workspaceCloseImageEditorOverlay: closeImageEditorOverlay,
    workspaceCloseMediaLightbox: closeMediaLightbox,
    workspaceFillMediaLightbox: fillMediaLightbox,
    workspaceOpenOptionsModal: openOptionsModal,
    workspaceOpenOptionTypePicker: openOptionTypePicker,
    workspaceRenderOptionEditorState: renderOptionEditorState,
    workspaceOpenOptionEditor: openOptionEditor,
    workspaceRenderOptionsModalState: renderOptionsModalState,
    workspaceRenderOptionsStep: renderOptionsStep,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
