(function initPipelineUIEtsyRuntimeEditor(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};
  const IMAGE_EDITOR_OVERLAY_ID = 'etsyImageEditorOverlay';

  function getFilerobotCtor() {
    return global.FilerobotImageEditor || null;
  }

  function getRoutes(deps = {}) {
    return deps.routes || global.PipelineUIEtsyRuntime?.getRoutes?.() || global.PipelineUIDataIntegrations?.etsyAuth?.routes || {};
  }

  function getImageEditorSource(mediaItem, deps = {}) {
    if (!mediaItem || mediaItem.kind !== 'image') return '';
    return deps.getImagePreviewSource?.(mediaItem.value, mediaItem.isLocal) || '';
  }

  async function resolveRemoteEditorSource(prefix, mediaKey, remoteUrl, deps = {}) {
    const state = deps.getState?.(prefix);
    if (!state) throw new Error('Workspace Etsy introuvable');

    const cached = String(state.editorSourceUrls?.[mediaKey] || '').trim();
    if (cached) return cached;

    const prepareRoute = String(getRoutes(deps).mediaCachePrepare || '').trim();
    if (!prepareRoute) throw new Error('Route cache image indisponible');

    const response = await fetch(prepareRoute, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: remoteUrl }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(payload?.error || `HTTP ${response.status}`));
    }

    const cachedUrl = String(payload?.cachedUrl || '').trim();
    if (!cachedUrl) {
      throw new Error('URL cache image introuvable');
    }

    state.editorSourceUrls[mediaKey] = cachedUrl;
    return cachedUrl;
  }

  async function resolveImageEditorSource(prefix, mediaKey, mediaItem, deps = {}) {
    const source = getImageEditorSource(mediaItem, deps);
    if (!source) return '';
    if (mediaItem?.isLocal) return source;
    return resolveRemoteEditorSource(prefix, mediaKey, source, deps);
  }

  function getImageEditorFileName(mediaItem, deps = {}) {
    if (!mediaItem || mediaItem.kind !== 'image') return 'etsy-image';

    if (mediaItem.isLocal) {
      return String(mediaItem.value.name || 'etsy-local-image');
    }

    const source = deps.getImagePreviewSource?.(mediaItem.value, false) || '';
    try {
      const pathname = new URL(source).pathname || '';
      const filename = pathname.split('/').filter(Boolean).pop();
      return filename || `etsy-${deps.getImageId?.(mediaItem.value)}`;
    } catch (error) {
      return `etsy-${deps.getImageId?.(mediaItem.value)}`;
    }
  }

  function resetEditedImage(prefix, mediaKey, deps = {}) {
    const state = deps.getState?.(prefix);
    const mediaItem = deps.getMediaItemByKey?.(state, mediaKey);
    if (!state || !mediaItem || mediaItem.kind !== 'image') return;

    deps.clearEditedImageState?.(prefix, mediaKey);
    deps.renderWorkspace?.(prefix);
    if (state.activeMediaKey === mediaKey) deps.fillMediaLightbox?.(prefix, mediaKey);
    global.showToast?.('Image reinitialisee');
  }

  async function openImageEditor(prefix, mediaKey, deps = {}) {
    const state = deps.getState?.(prefix);
    const mediaItem = deps.getMediaItemByKey?.(state, mediaKey);
    const FilerobotCtor = deps.getFilerobotCtor?.();
    if (!state || !mediaItem || mediaItem.kind !== 'image') return;

    if (!FilerobotCtor) {
      global.showToast?.('Filerobot indisponible', '#ff4757');
      return;
    }

    try {
      const source = await resolveImageEditorSource(prefix, mediaKey, mediaItem, deps);
      if (!source) {
        global.showToast?.('URL image introuvable', '#ff4757');
        return;
      }

      deps.ensureImageEditorOverlay?.();
      deps.closeImageEditorOverlay?.();

      const overlay = deps.getNode?.(deps.IMAGE_EDITOR_OVERLAY_ID || IMAGE_EDITOR_OVERLAY_ID);
      const editorHost = deps.getNode?.('etsyImageEditorHost');
      if (!overlay || !editorHost) {
        global.showToast?.('Ouverture editeur impossible', '#ff4757');
        return;
      }

      const tabs = FilerobotCtor.TABS || {};
      const config = {
        source,
        loadableDesignState: deps.getSavedEditorDesignState?.(prefix, mediaKey) || null,
        defaultTabId: tabs.ADJUST || 'Adjust',
        resetOnImageSourceChange: true,
        showBackButton: true,
        avoidChangesNotSavedAlertOnLeave: true,
        disableSaveIfNoChanges: true,
        closeAfterSave: true,
        defaultSavedImageName: getImageEditorFileName(mediaItem, deps),
        defaultSavedImageQuality: 1,
        useBackendTranslations: false,
        Crop: {
          minWidth: 24,
          minHeight: 24,
        },
        tabsIds: [
          tabs.ADJUST,
          tabs.FILTERS,
          tabs.FINETUNE,
          tabs.RESIZE,
          tabs.ANNOTATE,
        ].filter(Boolean),
        onSave: (editedImageObject, designState) => {
          const editedImageBase64 = String(editedImageObject?.imageBase64 || '');
          if (!editedImageBase64) {
            global.showToast?.('Sauvegarde image vide', '#ff4757');
            return;
          }

          deps.setEditedImageState?.(prefix, mediaKey, editedImageBase64, designState || null);
          deps.renderWorkspace?.(prefix);
          if (state.activeMediaKey === mediaKey) deps.fillMediaLightbox?.(prefix, mediaKey);
          global.showToast?.('Image Etsy editee');
        },
        onClose: () => {
          deps.closeImageEditorOverlay?.();
        },
      };

      const editor = new FilerobotCtor(editorHost, config);
      deps.setActiveEditorSession?.({
        prefix,
        mediaKey,
        instance: editor,
      });

      overlay.classList.add('visible');
      overlay.setAttribute('aria-hidden', 'false');
      editor.render();
    } catch (error) {
      global.showToast?.(`Chargement image impossible : ${error.message}`, '#ff4757');
    }
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    getFilerobotCtor,
    getImageEditorSource,
    resolveRemoteEditorSource,
    resolveImageEditorSource,
    getImageEditorFileName,
    resetEditedImage,
    openImageEditor,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
