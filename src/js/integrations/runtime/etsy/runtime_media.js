(function initPipelineUIEtsyRuntimeMedia(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};
  const getRuntime = () => global.PipelineUIEtsyRuntime || {};

  function resolveImageKey(deps, image, index) {
    return deps.getImageKey?.(image, index)
      || getRuntime().getImageKey?.(image, index)
      || `image:${String(image?.listing_image_id || image?.image_id || index)}`;
  }

  function resolveVideoKey(deps, video, index) {
    return deps.getVideoKey?.(video, index)
      || getRuntime().getVideoKey?.(video, index)
      || `video:${String(video?.video_id || video?.listing_video_id || index)}`;
  }

  function resolveLocalImageKey(deps, image) {
    return deps.getLocalImageKey?.(image)
      || getRuntime().getLocalImageKey?.(image)
      || `local-image:${String(image?.local_id)}`;
  }

  function resolveDisplayImageSource(deps, prefix, mediaKey, image, isLocal) {
    return deps.getDisplayImageSource?.(prefix, mediaKey, image, isLocal)
      || getRuntime().getDisplayImageSource?.(prefix, mediaKey, image, isLocal)
      || (isLocal
        ? String(image?.data_url || '')
        : String(image?.url_170x135 || image?.url_75x75 || image?.url_570xN || image?.url_570xn || image?.url_fullxfull || image?.full_url || image?.src || image?.url || ''));
  }

  function resolveProductSelection(deps, product, variationId) {
    return deps.getProductSelection?.(product, variationId)
      || global.PipelineUIEtsyData?.getProductSelection?.(product, variationId)
      || null;
  }

  function buildDefaultMediaOrder(state, deps = {}) {
    const data = state?.mediaPayload?.data || {};
    const images = Array.isArray(data.images) ? data.images : [];
    const videos = Array.isArray(data.videos) ? data.videos : [];
    const localImages = Array.isArray(state?.localImages) ? state.localImages : [];

    return [
      ...images.map((image, index) => resolveImageKey(deps, image, index)),
      ...videos.map((video, index) => resolveVideoKey(deps, video, index)),
      ...localImages.map((image) => resolveLocalImageKey(deps, image)),
    ];
  }

  function buildMediaMaps(state, deps = {}) {
    const data = state?.mediaPayload?.data || {};
    const images = Array.isArray(data.images) ? data.images : [];
    const videos = Array.isArray(data.videos) ? data.videos : [];
    const localImages = Array.isArray(state?.localImages) ? state.localImages : [];

    const imageMap = new Map(images.map((image, index) => [resolveImageKey(deps, image, index), image]));
    const videoMap = new Map(videos.map((video, index) => [resolveVideoKey(deps, video, index), video]));
    const localImageMap = new Map(localImages.map((image) => [resolveLocalImageKey(deps, image), image]));

    return {
      images,
      videos,
      localImages,
      imageMap,
      videoMap,
      localImageMap,
    };
  }

  function getOrderedMediaItems(state, deps = {}) {
    const maps = buildMediaMaps(state, deps);
    const defaultOrder = buildDefaultMediaOrder(state, deps);
    const activeOrder = Array.isArray(state?.mediaOrder) && state.mediaOrder.length ? state.mediaOrder : defaultOrder;
    const seen = new Set();
    const items = [];

    activeOrder.forEach((key) => {
      if (seen.has(key)) return;

      if (maps.imageMap.has(key)) {
        items.push({ kind: 'image', key, value: maps.imageMap.get(key), isLocal: false });
        seen.add(key);
        return;
      }

      if (maps.localImageMap.has(key)) {
        items.push({ kind: 'image', key, value: maps.localImageMap.get(key), isLocal: true });
        seen.add(key);
        return;
      }

      if (maps.videoMap.has(key)) {
        items.push({ kind: 'video', key, value: maps.videoMap.get(key), isLocal: false });
        seen.add(key);
      }
    });

    defaultOrder.forEach((key) => {
      if (seen.has(key)) return;
      if (maps.imageMap.has(key)) items.push({ kind: 'image', key, value: maps.imageMap.get(key), isLocal: false });
      if (maps.localImageMap.has(key)) items.push({ kind: 'image', key, value: maps.localImageMap.get(key), isLocal: true });
      if (maps.videoMap.has(key)) items.push({ kind: 'video', key, value: maps.videoMap.get(key), isLocal: false });
    });

    state.mediaOrder = items.map((item) => item.key);
    return items;
  }

  function getMediaItemByKey(state, mediaKey, deps = {}) {
    if (!state || !mediaKey) return null;

    const maps = buildMediaMaps(state, deps);
    if (maps.imageMap.has(mediaKey)) return { kind: 'image', key: mediaKey, value: maps.imageMap.get(mediaKey), isLocal: false };
    if (maps.localImageMap.has(mediaKey)) return { kind: 'image', key: mediaKey, value: maps.localImageMap.get(mediaKey), isLocal: true };
    if (maps.videoMap.has(mediaKey)) return { kind: 'video', key: mediaKey, value: maps.videoMap.get(mediaKey), isLocal: false };
    return null;
  }

  function removeMediaKeyFromOrder(state, mediaKey) {
    if (!state) return;
    state.mediaOrder = (state.mediaOrder || []).filter((key) => key !== mediaKey);
  }

  function appendMediaKeysToOrder(state, mediaKeys) {
    if (!state || !Array.isArray(mediaKeys) || !mediaKeys.length) return;
    const existing = Array.isArray(state.mediaOrder) ? state.mediaOrder.filter(Boolean) : [];
    state.mediaOrder = [...existing, ...mediaKeys];
  }

  function getSelectedPipelineAltMediaKeys(prefix, deps = {}) {
    const state = deps.getState?.(prefix) || getRuntime().getWorkspaceState?.(prefix);
    if (!state) return [];
    return Array.isArray(state.selectedPipelineAltMediaKeys)
      ? state.selectedPipelineAltMediaKeys.filter(Boolean)
      : [];
  }

  function togglePipelineAltMediaSelection(prefix, mediaKey, deps = {}) {
    const state = deps.getState?.(prefix) || getRuntime().getWorkspaceState?.(prefix);
    if (!state || !mediaKey) return;

    const selected = new Set(getSelectedPipelineAltMediaKeys(prefix, deps));
    if (selected.has(mediaKey)) selected.delete(mediaKey);
    else selected.add(mediaKey);
    state.selectedPipelineAltMediaKeys = [...selected];
    deps.syncPayloadText?.(state);
  }

  function setAllPipelineAltMediaSelections(prefix, enabled, deps = {}) {
    const state = deps.getState?.(prefix) || getRuntime().getWorkspaceState?.(prefix);
    if (!state) return;

    if (!enabled) {
      state.selectedPipelineAltMediaKeys = [];
      deps.syncPayloadText?.(state);
      return;
    }

    const selectedKeys = getOrderedMediaItems(state, deps)
      .filter((item) => item.kind === 'image')
      .map((item) => item.key);
    state.selectedPipelineAltMediaKeys = selectedKeys;
    deps.syncPayloadText?.(state);
  }

  function getWorkspaceImageChoices(prefix, deps = {}) {
    const state = deps.getState?.(prefix) || getRuntime().getWorkspaceState?.(prefix);
    if (!state) return [];

    return getOrderedMediaItems(state, deps)
      .filter((item) => item.kind === 'image')
      .map((item, index) => ({
        key: item.key,
        label: item.isLocal
          ? String(item.value.name || `Image ${index + 1}`).trim()
          : `Image ${index + 1}`,
        previewSrc: resolveDisplayImageSource(deps, prefix, item.key, item.value, item.isLocal),
      }));
  }

  function getOptionAssignedImage(prefix, option, deps = {}) {
    const imageKey = String(option?.imageKey || '').trim();
    if (!imageKey) return null;
    const choice = getWorkspaceImageChoices(prefix, deps).find((item) => item.key === imageKey);
    return choice || null;
  }

  function getProductAssignedImage(prefix, draft, product, deps = {}) {
    const photoVariation = (draft?.variations || []).find((variation) => variation.photosEnabled);
    if (!photoVariation) return null;

    const selection = resolveProductSelection(deps, product, photoVariation.id);
    if (!selection) return null;

    const option = (photoVariation.options || []).find((entry) => entry.id === selection.optionId);
    if (!option) return null;

    return getOptionAssignedImage(prefix, option, deps);
  }

  function getActiveMediaSelection(deps = {}) {
    const getState = deps.getState || getRuntime().getWorkspaceState;
    for (const prefix of ['tt', 'col']) {
      const state = getState?.(prefix);
      if (state?.activeMediaKey) {
        return {
          prefix,
          mediaKey: state.activeMediaKey,
        };
      }
    }
    return null;
  }

  function setMediaAltText(prefix, mediaKey, nextAltText, deps = {}) {
    const runtime = getRuntime();
    const state = deps.getState?.(prefix) || runtime.getWorkspaceState?.(prefix);
    const mediaItem = deps.getMediaItemByKey?.(state, mediaKey) || runtime.getMediaItemByKey?.(state, mediaKey);
    if (!state || !mediaItem || mediaItem.kind !== 'image') return;

    mediaItem.value.alt_text = nextAltText;
    (deps.syncPayloadText || runtime.syncPayloadText)?.(state);
  }

  function openMediaLightbox(prefix, mediaKey, deps = {}) {
    deps.fillMediaLightbox?.(prefix, mediaKey);
  }

  function reorderMediaFromGrid(prefix, grid, deps = {}) {
    const state = deps.getState?.(prefix);
    if (!state || !grid) return false;

    const orderedKeys = [...grid.querySelectorAll('[data-etsy-media-key]')]
      .map((node) => String(node.dataset.etsyMediaKey || '').trim())
      .filter(Boolean);

    if (!orderedKeys.length) return false;

    state.mediaOrder = orderedKeys;
    deps.syncPayloadText?.(state);
    return true;
  }

  function setupSortable(prefix, grid, deps = {}) {
    const state = deps.getState?.(prefix);
    const SortableCtor = deps.getSortableCtor?.();
    const imageCount = Array.isArray(state?.mediaPayload?.data?.images) ? state.mediaPayload.data.images.length : 0;
    const localImageCount = Array.isArray(state?.localImages) ? state.localImages.length : 0;
    const videoCount = Array.isArray(state?.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos.length : 0;

    deps.destroySortable?.(prefix);
    if (!state || !grid || !SortableCtor || (imageCount + localImageCount + videoCount) < 2) return;

    grid.classList.add('is-sortable');
    state.sortable = SortableCtor.create(grid, {
      animation: 180,
      draggable: '.etsy-api-media-card[data-etsy-media-key]',
      ghostClass: 'etsy-api-sortable-ghost',
      chosenClass: 'etsy-api-sortable-chosen',
      dragClass: 'etsy-api-sortable-drag',
      onEnd: () => {
        if (!reorderMediaFromGrid(prefix, grid, deps)) return;
        deps.setStatus?.(
          prefix,
          `Ordre des medias mis a jour - ${imageCount + localImageCount} image(s) - ${videoCount} video(s).`
        );
      },
    });
  }

  async function buildLocalImageFromFile(file, deps = {}) {
    const dataUrl = await deps.readFileAsDataUrl?.(file);
    const image = await deps.loadImageFromDataUrl?.(dataUrl);
    return {
      local_id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
      name: file.name || 'Image locale',
      data_url: dataUrl,
      media_type: file.type || 'image/png',
      width: image.naturalWidth || image.width || 0,
      height: image.naturalHeight || image.height || 0,
      alt_text: '',
    };
  }

  async function addLocalImages(prefix, files, deps = {}) {
    const state = deps.getState?.(prefix);
    if (!state || !files.length) return;

    const nextImages = [];
    for (const file of files) {
      if (!file?.type?.startsWith('image/')) continue;
      nextImages.push(await buildLocalImageFromFile(file, deps));
    }

    if (!nextImages.length) return;

    state.localImages.push(...nextImages);
    deps.appendMediaKeysToOrder?.(state, nextImages.map((image) => resolveLocalImageKey(deps, image)));
    deps.syncPayloadText?.(state);
    deps.renderWorkspace?.(prefix);
    deps.setStatus?.(prefix, `${state.localImages.length} image(s) locale(s) ajoutee(s) au workspace.`);
    global.showToast?.('Images ajoutees au workspace Etsy');
  }

  function removeMediaByKey(prefix, mediaKey, deps = {}) {
    const state = deps.getState?.(prefix);
    const mediaItem = deps.getMediaItemByKey?.(state, mediaKey);
    if (!state || !mediaItem) return;

    if (deps.getActiveEditorSession?.()?.prefix === prefix && deps.getActiveEditorSession?.()?.mediaKey === mediaKey) {
      deps.closeImageEditorOverlay?.();
    }

    if (mediaItem.kind === 'image' && mediaItem.isLocal) {
      state.localImages = state.localImages.filter((image) => resolveLocalImageKey(deps, image) !== mediaKey);
    } else if (mediaItem.kind === 'image') {
      const images = Array.isArray(state.mediaPayload?.data?.images) ? state.mediaPayload.data.images : [];
      state.mediaPayload.data.images = images.filter((image, index) => resolveImageKey(deps, image, index) !== mediaKey);
    } else {
      const videos = Array.isArray(state.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos : [];
      state.mediaPayload.data.videos = videos.filter((video, index) => resolveVideoKey(deps, video, index) !== mediaKey);
    }

    deps.removeMediaKeyFromOrder?.(state, mediaKey);
    if (state?.selectedPipelineAltMediaKeys?.length) {
      state.selectedPipelineAltMediaKeys = state.selectedPipelineAltMediaKeys.filter((key) => key !== mediaKey);
    }
    deps.clearEditedImageState?.(prefix, mediaKey);
    if (state.activeMediaKey === mediaKey) deps.closeMediaLightbox?.();
    deps.syncPayloadText?.(state);
    deps.renderWorkspace?.(prefix);
    global.showToast?.('Media retire du workspace Etsy');
  }

  function removeMediaByKeyInline(prefix, mediaKey, cardNode, deps = {}) {
    const state = deps.getState?.(prefix);
    const mediaItem = deps.getMediaItemByKey?.(state, mediaKey);
    if (!state || !mediaItem) return;

    if (deps.getActiveEditorSession?.()?.prefix === prefix && deps.getActiveEditorSession?.()?.mediaKey === mediaKey) {
      deps.closeImageEditorOverlay?.();
    }

    if (mediaItem.kind === 'image' && mediaItem.isLocal) {
      state.localImages = state.localImages.filter((image) => resolveLocalImageKey(deps, image) !== mediaKey);
    } else if (mediaItem.kind === 'image') {
      const images = Array.isArray(state.mediaPayload?.data?.images) ? state.mediaPayload.data.images : [];
      state.mediaPayload.data.images = images.filter((image, index) => resolveImageKey(deps, image, index) !== mediaKey);
    } else {
      const videos = Array.isArray(state.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos : [];
      state.mediaPayload.data.videos = videos.filter((video, index) => resolveVideoKey(deps, video, index) !== mediaKey);
    }

    deps.removeMediaKeyFromOrder?.(state, mediaKey);
    deps.clearEditedImageState?.(prefix, mediaKey);
    if (state.activeMediaKey === mediaKey) deps.closeMediaLightbox?.();
    deps.syncPayloadText?.(state);

    const remainingItems = deps.getOrderedMediaItems?.(state);
    if (!remainingItems?.length) {
      deps.renderWorkspace?.(prefix);
      global.showToast?.('Media retire du workspace Etsy');
      return;
    }

    if (state?.selectedPipelineAltMediaKeys?.length) {
      state.selectedPipelineAltMediaKeys = state.selectedPipelineAltMediaKeys.filter((key) => key !== mediaKey);
    }

    cardNode?.remove();
    deps.syncWorkspacePanels?.(prefix);
    deps.refreshSortableBinding?.(prefix);
    global.showToast?.('Media retire du workspace Etsy');
  }

  function clearAllMedia(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    if (!state) return;

    if (deps.getActiveEditorSession?.()?.prefix === prefix) {
      deps.closeImageEditorOverlay?.();
    }

    if (state.mediaPayload?.data) {
      state.mediaPayload.data.images = [];
      state.mediaPayload.data.videos = [];
    }

    state.localImages = [];
    state.mediaOrder = [];
    state.selectedPipelineAltMediaKeys = [];
    deps.resetWorkspaceEditedImages?.(prefix);
    if (state.activeMediaKey) deps.closeMediaLightbox?.();
    deps.syncPayloadText?.(state);
    deps.renderWorkspace?.(prefix);
    deps.setStatus?.(prefix, 'Tous les medias du workspace Etsy ont ete supprimes.');
    global.showToast?.('Workspace Etsy vide');
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    buildDefaultMediaOrder,
    buildMediaMaps,
    getOrderedMediaItems,
    getMediaItemByKey,
    removeMediaKeyFromOrder,
    appendMediaKeysToOrder,
    getSelectedPipelineAltMediaKeys,
    togglePipelineAltMediaSelection,
    setAllPipelineAltMediaSelections,
    getWorkspaceImageChoices,
    getOptionAssignedImage,
    getProductAssignedImage,
    getActiveMediaSelection,
    setMediaAltText,
    openMediaLightbox,
    reorderMediaFromGrid,
    setupSortable,
    buildLocalImageFromFile,
    addLocalImages,
    removeMediaByKey,
    removeMediaByKeyInline,
    clearAllMedia,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
