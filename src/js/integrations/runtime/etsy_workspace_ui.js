'use strict';

(function initPipelineUIEtsyWorkspace(global) {
  global.PipelineUI = global.PipelineUI || {};

  const ROUTES = global.PipelineUIDataIntegrations?.etsyAuth?.routes || {};
  const LIGHTBOX_ID = 'etsyMediaLightbox';
  const LISTING_REF_STORAGE_PREFIX = 'etsy.workspace.listingRef.';
  const workspaceState = {
    tt: {
      payloadText: '',
      listingId: '',
      mediaPayload: null,
      payloadEnvelope: null,
      sortable: null,
      mediaOrder: [],
      localImages: [],
      activeMediaKey: '',
    },
    col: {
      payloadText: '',
      listingId: '',
      mediaPayload: null,
      payloadEnvelope: null,
      sortable: null,
      mediaOrder: [],
      localImages: [],
      activeMediaKey: '',
    },
  };

  const getNode = (id) => document.getElementById(id);
  const getState = (prefix) => workspaceState[prefix] || null;
  const getSortableCtor = () => global.Sortable || null;
  const getImageTools = () => global.PipelineUIImageTools || {};
  const getListingRefStorageKey = (prefix) => `${LISTING_REF_STORAGE_PREFIX}${prefix}`;

  const getNodes = (prefix) => ({
    panel: getNode(`etsyApiPanel-${prefix}`),
    input: getNode(`etsyApiListingRef-${prefix}`),
    uploadInput: getNode(`etsyApiUploadInput-${prefix}`),
    status: getNode(`etsyApiStatus-${prefix}`),
    summary: getNode(`etsyApiSummary-${prefix}`),
    strip: getNode(`etsyApiMediaStrip-${prefix}`),
    payload: getNode(`etsyApiPayload-${prefix}`),
  });

  const extractListingId = (value = '') => {
    const source = String(value || '').trim();
    if (!source) return '';
    if (/^\d+$/.test(source)) return source;

    const pathMatch = source.match(/\/listing\/(\d+)/i);
    if (pathMatch?.[1]) return pathMatch[1];

    const queryMatch = source.match(/(?:\?|&)listing_id=(\d+)/i);
    if (queryMatch?.[1]) return queryMatch[1];

    return '';
  };

  const readJson = async (url) => {
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(payload?.error || `HTTP ${response.status}`));
    }
    return payload;
  };

  const saveListingReference = (prefix, value) => {
    try {
      localStorage.setItem(getListingRefStorageKey(prefix), String(value || '').trim());
    } catch (error) {}
  };

  const restoreListingReference = (prefix) => {
    try {
      return String(localStorage.getItem(getListingRefStorageKey(prefix)) || '').trim();
    } catch (error) {
      return '';
    }
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ''));
    reader.onerror = () => reject(new Error('Lecture image impossible'));
    reader.readAsDataURL(file);
  });

  const loadImageFromDataUrl = (dataUrl) => {
    const helper = getImageTools().loadImageFromDataUrl;
    if (typeof helper === 'function') return helper(dataUrl);

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Chargement image impossible'));
      image.src = dataUrl;
    });
  };

  const getImageKey = (image, index) => `image:${String(image.listing_image_id || image.image_id || index)}`;
  const getVideoKey = (video, index) => `video:${String(video.video_id || video.listing_video_id || index)}`;
  const getLocalImageKey = (image) => `local-image:${String(image.local_id)}`;

  const getImageId = (image, index) => String(image.listing_image_id || image.image_id || index || '-');
  const getVideoId = (video, index) => String(video.video_id || video.listing_video_id || index || '-');
  const getImagePreviewSource = (image, isLocal) => (
    isLocal
      ? image?.data_url || ''
      : image?.url_fullxfull || image?.url_570xN || image?.url_170x135 || image?.url_75x75 || ''
  );

  const getImageResolution = (image) => ({
    width: Number(image.full_width || image.width || image.original_width || image.w || 0) || 0,
    height: Number(image.full_height || image.height || image.original_height || image.h || 0) || 0,
  });

  const getVideoResolution = (video) => ({
    width: Number(video.width || video.video_width || 0) || 0,
    height: Number(video.height || video.video_height || 0) || 0,
  });

  const formatResolution = ({ width, height }) => (
    width > 0 && height > 0 ? `${width} x ${height}` : '-'
  );

  const buildLocalImagePayload = (state) => (
    Array.isArray(state?.localImages)
      ? state.localImages.map((image) => ({
          local_id: image.local_id,
          name: image.name,
          width: image.width,
          height: image.height,
          media_type: image.media_type,
          alt_text: image.alt_text || '',
          pending_upload: true,
        }))
      : []
  );

  const syncPayloadText = (state) => {
    if (!state) return;
    if (!state.payloadEnvelope) {
      state.payloadText = '';
      return;
    }

    const localImages = buildLocalImagePayload(state);
    state.payloadText = JSON.stringify({
      ...state.payloadEnvelope,
      payload: state.mediaPayload,
      ui_state: {
        media_order: state.mediaOrder,
        local_images: localImages,
      },
    }, null, 2);
  };

  const buildDefaultMediaOrder = (state) => {
    const data = state?.mediaPayload?.data || {};
    const images = Array.isArray(data.images) ? data.images : [];
    const videos = Array.isArray(data.videos) ? data.videos : [];
    const localImages = Array.isArray(state?.localImages) ? state.localImages : [];

    return [
      ...images.map((image, index) => getImageKey(image, index)),
      ...videos.map((video, index) => getVideoKey(video, index)),
      ...localImages.map((image) => getLocalImageKey(image)),
    ];
  };

  const buildMediaMaps = (state) => {
    const data = state?.mediaPayload?.data || {};
    const images = Array.isArray(data.images) ? data.images : [];
    const videos = Array.isArray(data.videos) ? data.videos : [];
    const localImages = Array.isArray(state?.localImages) ? state.localImages : [];

    const imageMap = new Map(images.map((image, index) => [getImageKey(image, index), image]));
    const videoMap = new Map(videos.map((video, index) => [getVideoKey(video, index), video]));
    const localImageMap = new Map(localImages.map((image) => [getLocalImageKey(image), image]));

    return {
      images,
      videos,
      localImages,
      imageMap,
      videoMap,
      localImageMap,
    };
  };

  const getOrderedMediaItems = (state) => {
    const maps = buildMediaMaps(state);
    const defaultOrder = buildDefaultMediaOrder(state);
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
  };

  const getMediaItemByKey = (state, mediaKey) => {
    if (!state || !mediaKey) return null;

    const maps = buildMediaMaps(state);
    if (maps.imageMap.has(mediaKey)) return { kind: 'image', key: mediaKey, value: maps.imageMap.get(mediaKey), isLocal: false };
    if (maps.localImageMap.has(mediaKey)) return { kind: 'image', key: mediaKey, value: maps.localImageMap.get(mediaKey), isLocal: true };
    if (maps.videoMap.has(mediaKey)) return { kind: 'video', key: mediaKey, value: maps.videoMap.get(mediaKey), isLocal: false };
    return null;
  };

  const removeMediaKeyFromOrder = (state, mediaKey) => {
    if (!state) return;
    state.mediaOrder = (state.mediaOrder || []).filter((key) => key !== mediaKey);
  };

  const appendMediaKeysToOrder = (state, mediaKeys) => {
    if (!state || !Array.isArray(mediaKeys) || !mediaKeys.length) return;
    const existing = Array.isArray(state.mediaOrder) ? state.mediaOrder.filter(Boolean) : [];
    state.mediaOrder = [...existing, ...mediaKeys];
  };

  const ensureUploadInput = (prefix) => {
    const nodes = getNodes(prefix);
    if (!nodes.panel) return null;
    if (nodes.uploadInput) return nodes.uploadInput;

    const input = document.createElement('input');
    input.type = 'file';
    input.id = `etsyApiUploadInput-${prefix}`;
    input.className = 'input-file-hidden';
    input.accept = 'image/*';
    input.multiple = true;
    nodes.panel.appendChild(input);
    return input;
  };

  const destroySortable = (prefix) => {
    const state = getState(prefix);
    if (!state?.sortable) return;

    state.sortable.destroy();
    state.sortable = null;
  };

  const ensureMediaLightbox = () => {
    if (getNode(LIGHTBOX_ID)) return;

    const host = document.createElement('div');
    host.innerHTML = `
<div id="${LIGHTBOX_ID}" class="lb-overlay etsy-media-lightbox" aria-hidden="true">
  <div class="lb-box lb-box-wide etsy-media-lightbox-box" role="dialog" aria-modal="true" aria-labelledby="etsyMediaLightboxTitle">
    <div class="lb-header">
      <h3 id="etsyMediaLightboxTitle"><span data-svg-icon="image"></span><span class="ui-icon-label">MEDIA ETSY</span></h3>
      <button class="lb-close" type="button" data-js="etsy-media-lightbox-close"><span data-svg-icon="close"></span></button>
    </div>
    <div class="lb-body etsy-media-lightbox-body">
      <div class="etsy-media-lightbox-stage">
        <div id="etsyMediaLightboxPreview" class="etsy-media-lightbox-preview"></div>
      </div>
      <div class="etsy-media-lightbox-side">
        <div class="etsy-media-lightbox-meta">
          <div class="etsy-media-lightbox-meta-item">
            <span class="etsy-media-lightbox-meta-label">Type</span>
            <span id="etsyMediaLightboxType" class="etsy-media-lightbox-meta-value">-</span>
          </div>
          <div class="etsy-media-lightbox-meta-item">
            <span class="etsy-media-lightbox-meta-label">ID</span>
            <span id="etsyMediaLightboxId" class="etsy-media-lightbox-meta-value">-</span>
          </div>
          <div class="etsy-media-lightbox-meta-item">
            <span class="etsy-media-lightbox-meta-label">Resolution</span>
            <span id="etsyMediaLightboxResolution" class="etsy-media-lightbox-meta-value">-</span>
          </div>
          <div class="etsy-media-lightbox-meta-item">
            <span class="etsy-media-lightbox-meta-label">Source</span>
            <span id="etsyMediaLightboxSource" class="etsy-media-lightbox-meta-value">-</span>
          </div>
        </div>
        <div id="etsyMediaLightboxAltGroup" class="fg full etsy-media-lightbox-alt-group">
          <label for="etsyMediaLightboxAltInput">Balise ALT</label>
          <textarea id="etsyMediaLightboxAltInput" class="textarea-md" placeholder="Balise ALT de l image"></textarea>
          <div class="field-action-row etsy-media-lightbox-alt-actions">
            <button class="btn btn-muted" type="button" data-js="etsy-media-lightbox-clear-alt"><span data-svg-icon="refresh"></span><span class="ui-icon-label">Vider ALT</span></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

    document.body.appendChild(host);
    global.PipelineUIIcons?.hydrateIcons?.(host);

    const overlay = getNode(LIGHTBOX_ID);
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) closeMediaLightbox();
    });

    const closeButton = overlay?.querySelector('[data-js="etsy-media-lightbox-close"]');
    closeButton?.addEventListener('click', closeMediaLightbox);

    const altInput = getNode('etsyMediaLightboxAltInput');
    altInput?.addEventListener('input', (event) => {
      const active = getActiveMediaSelection();
      if (!active) return;
      setMediaAltText(active.prefix, active.mediaKey, String(event.target.value || ''));
    });

    const clearAltButton = overlay?.querySelector('[data-js="etsy-media-lightbox-clear-alt"]');
    clearAltButton?.addEventListener('click', () => {
      const active = getActiveMediaSelection();
      if (!active) return;
      setMediaAltText(active.prefix, active.mediaKey, '');
      const input = getNode('etsyMediaLightboxAltInput');
      if (input) {
        input.value = '';
        input.focus();
      }
    });

  };

  const getActiveMediaSelection = () => {
    for (const prefix of ['tt', 'col']) {
      const state = getState(prefix);
      if (state?.activeMediaKey) {
        return {
          prefix,
          mediaKey: state.activeMediaKey,
        };
      }
    }
    return null;
  };

  function closeMediaLightbox() {
    const overlay = getNode(LIGHTBOX_ID);
    if (!overlay) return;

    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');

    const previewHost = getNode('etsyMediaLightboxPreview');
    if (previewHost) previewHost.innerHTML = '';

    Object.keys(workspaceState).forEach((prefix) => {
      const state = getState(prefix);
      if (state) state.activeMediaKey = '';
    });
  }

  const setMediaAltText = (prefix, mediaKey, nextAltText) => {
    const state = getState(prefix);
    const mediaItem = getMediaItemByKey(state, mediaKey);
    if (!state || !mediaItem || mediaItem.kind !== 'image') return;

    mediaItem.value.alt_text = nextAltText;
    syncPayloadText(state);
  };

  const fillMediaLightbox = (prefix, mediaKey) => {
    const state = getState(prefix);
    const mediaItem = getMediaItemByKey(state, mediaKey);
    if (!state || !mediaItem) return false;

    ensureMediaLightbox();
    const overlay = getNode(LIGHTBOX_ID);
    const previewHost = getNode('etsyMediaLightboxPreview');
    const typeNode = getNode('etsyMediaLightboxType');
    const idNode = getNode('etsyMediaLightboxId');
    const resolutionNode = getNode('etsyMediaLightboxResolution');
    const sourceNode = getNode('etsyMediaLightboxSource');
    const altGroup = getNode('etsyMediaLightboxAltGroup');
    const altInput = getNode('etsyMediaLightboxAltInput');
    if (!overlay || !previewHost || !typeNode || !idNode || !resolutionNode || !sourceNode || !altGroup || !altInput) {
      return false;
    }

    previewHost.innerHTML = '';
    state.activeMediaKey = mediaKey;

    if (mediaItem.kind === 'image') {
      const preview = document.createElement('img');
      preview.className = 'etsy-media-lightbox-preview-image';
      preview.src = getImagePreviewSource(mediaItem.value, mediaItem.isLocal);
      preview.alt = mediaItem.value.alt_text || 'Image Etsy';
      previewHost.appendChild(preview);

      typeNode.textContent = mediaItem.isLocal ? 'Image locale' : 'Image Etsy';
      idNode.textContent = mediaItem.isLocal ? String(mediaItem.value.local_id || '-') : getImageId(mediaItem.value);
      resolutionNode.textContent = formatResolution(
        mediaItem.isLocal
          ? { width: mediaItem.value.width || 0, height: mediaItem.value.height || 0 }
          : getImageResolution(mediaItem.value)
      );
      sourceNode.textContent = mediaItem.isLocal ? 'Ajoutee au workspace' : 'Chargee depuis Etsy';
      altGroup.style.display = '';
      altInput.disabled = false;
      altInput.value = mediaItem.value.alt_text || '';
    } else {
      const preview = document.createElement('video');
      preview.className = 'etsy-media-lightbox-preview-video';
      preview.src = mediaItem.value.video_url || '';
      preview.poster = mediaItem.value.thumbnail_url || '';
      preview.controls = true;
      preview.preload = 'metadata';
      previewHost.appendChild(preview);

      typeNode.textContent = 'Video Etsy';
      idNode.textContent = getVideoId(mediaItem.value);
      resolutionNode.textContent = formatResolution(getVideoResolution(mediaItem.value));
      sourceNode.textContent = 'Chargee depuis Etsy';
      altGroup.style.display = 'none';
      altInput.disabled = true;
      altInput.value = '';
    }

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    return true;
  };

  const openMediaLightbox = (prefix, mediaKey) => {
    if (!fillMediaLightbox(prefix, mediaKey)) return;
  };

  const createToolbarButton = (className, iconName, label, onClick) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.innerHTML = global.PipelineUIIcons?.renderIconLabel?.(iconName, label) || label;
    button.addEventListener('click', onClick);
    return button;
  };

  const createInlineRemoveButton = (prefix, mediaKey) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'etsy-api-media-inline-action';
    button.innerHTML = global.PipelineUIIcons?.renderIcon?.('trash') || 'X';
    button.title = 'Supprimer';
    button.setAttribute('aria-label', 'Supprimer ce media');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeMediaByKeyInline(prefix, mediaKey, event.currentTarget.closest('[data-etsy-media-key]'));
    });
    return button;
  };

  const bindPreviewLightbox = (node, prefix, mediaKey) => {
    node.classList.add('etsy-api-media-preview-clickable');
    node.tabIndex = 0;
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', 'Ouvrir le media');
    node.addEventListener('click', () => openMediaLightbox(prefix, mediaKey));
    node.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openMediaLightbox(prefix, mediaKey);
    });
  };

  const createTextBlock = (className, text) => {
    const node = document.createElement('div');
    node.className = className;
    node.textContent = text;
    return node;
  };

  const createImageCard = (image, index, mediaKey, prefix, isLocal) => {
    const card = document.createElement('article');
    card.className = 'image-thumb-card etsy-api-media-card etsy-api-media-card-visual';
    card.dataset.etsyMediaKind = 'image';
    card.dataset.etsyMediaKey = mediaKey || (isLocal ? getLocalImageKey(image) : getImageKey(image, index));

    const previewWrap = document.createElement('div');
    previewWrap.className = 'image-thumb-preview-wrap';

    const preview = document.createElement('img');
    preview.className = 'image-thumb-preview';
    preview.src = getImagePreviewSource(image, isLocal);
    preview.alt = image.alt_text || `Image Etsy ${index + 1}`;
    preview.loading = 'lazy';
    previewWrap.appendChild(preview);
    previewWrap.appendChild(createInlineRemoveButton(prefix, card.dataset.etsyMediaKey));
    bindPreviewLightbox(previewWrap, prefix, card.dataset.etsyMediaKey);

    card.appendChild(previewWrap);
    return card;
  };

  const createVideoCard = (video, index, mediaKey, prefix) => {
    const card = document.createElement('article');
    card.className = 'image-thumb-card etsy-api-media-card etsy-api-media-card-visual';
    card.dataset.etsyMediaKind = 'video';
    card.dataset.etsyMediaKey = mediaKey || getVideoKey(video, index);

    const previewWrap = document.createElement('div');
    previewWrap.className = 'image-thumb-preview-wrap etsy-api-video-card-preview';

    const preview = document.createElement('video');
    preview.className = 'image-thumb-preview etsy-api-video-preview';
    preview.src = video.video_url || '';
    preview.poster = video.thumbnail_url || '';
    preview.controls = true;
    preview.preload = 'metadata';
    previewWrap.appendChild(preview);
    previewWrap.appendChild(createInlineRemoveButton(prefix, card.dataset.etsyMediaKey));

    card.appendChild(previewWrap);
    return card;
  };

  const reorderMediaFromGrid = (prefix, grid) => {
    const state = getState(prefix);
    if (!state || !grid) return false;

    const orderedKeys = [...grid.querySelectorAll('[data-etsy-media-key]')]
      .map((node) => String(node.dataset.etsyMediaKey || '').trim())
      .filter(Boolean);

    if (!orderedKeys.length) return false;

    state.mediaOrder = orderedKeys;
    syncPayloadText(state);
    return true;
  };

  const setupSortable = (prefix, grid) => {
    const state = getState(prefix);
    const SortableCtor = getSortableCtor();
    const imageCount = Array.isArray(state?.mediaPayload?.data?.images) ? state.mediaPayload.data.images.length : 0;
    const localImageCount = Array.isArray(state?.localImages) ? state.localImages.length : 0;
    const videoCount = Array.isArray(state?.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos.length : 0;

    destroySortable(prefix);
    if (!state || !grid || !SortableCtor || (imageCount + localImageCount + videoCount) < 2) return;

    grid.classList.add('is-sortable');
    state.sortable = SortableCtor.create(grid, {
      animation: 180,
      draggable: '.etsy-api-media-card[data-etsy-media-key]',
      ghostClass: 'etsy-api-sortable-ghost',
      chosenClass: 'etsy-api-sortable-chosen',
      dragClass: 'etsy-api-sortable-drag',
      onEnd: () => {
        if (!reorderMediaFromGrid(prefix, grid)) return;
        setStatus(prefix, `Ordre des medias mis a jour - ${imageCount + localImageCount} image(s) - ${videoCount} video(s).`);
      },
    });
  };

  const triggerAddImages = (prefix) => {
    const input = ensureUploadInput(prefix);
    input?.click();
  };

  const buildLocalImageFromFile = async (file) => {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImageFromDataUrl(dataUrl);
    return {
      local_id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
      name: file.name || 'Image locale',
      data_url: dataUrl,
      media_type: file.type || 'image/png',
      width: image.naturalWidth || image.width || 0,
      height: image.naturalHeight || image.height || 0,
      alt_text: '',
    };
  };

  const addLocalImages = async (prefix, files) => {
    const state = getState(prefix);
    if (!state || !files.length) return;

    const nextImages = [];
    for (const file of files) {
      if (!file?.type?.startsWith('image/')) continue;
      nextImages.push(await buildLocalImageFromFile(file));
    }

    if (!nextImages.length) return;

    state.localImages.push(...nextImages);
    appendMediaKeysToOrder(state, nextImages.map((image) => getLocalImageKey(image)));
    syncPayloadText(state);
    renderWorkspace(prefix);
    setStatus(prefix, `${state.localImages.length} image(s) locale(s) ajoutee(s) au workspace.`);
    global.showToast?.('Images ajoutees au workspace Etsy');
  };

  const removeMediaByKey = (prefix, mediaKey) => {
    const state = getState(prefix);
    const mediaItem = getMediaItemByKey(state, mediaKey);
    if (!state || !mediaItem) return;

    if (mediaItem.kind === 'image' && mediaItem.isLocal) {
      state.localImages = state.localImages.filter((image) => getLocalImageKey(image) !== mediaKey);
    } else if (mediaItem.kind === 'image') {
      const images = Array.isArray(state.mediaPayload?.data?.images) ? state.mediaPayload.data.images : [];
      state.mediaPayload.data.images = images.filter((image, index) => getImageKey(image, index) !== mediaKey);
    } else {
      const videos = Array.isArray(state.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos : [];
      state.mediaPayload.data.videos = videos.filter((video, index) => getVideoKey(video, index) !== mediaKey);
    }

    removeMediaKeyFromOrder(state, mediaKey);
    if (state.activeMediaKey === mediaKey) closeMediaLightbox();
    syncPayloadText(state);
    renderWorkspace(prefix);
    global.showToast?.('Media retire du workspace Etsy');
  };

  const removeMediaByKeyInline = (prefix, mediaKey, cardNode) => {
    const state = getState(prefix);
    const mediaItem = getMediaItemByKey(state, mediaKey);
    if (!state || !mediaItem) return;

    if (mediaItem.kind === 'image' && mediaItem.isLocal) {
      state.localImages = state.localImages.filter((image) => getLocalImageKey(image) !== mediaKey);
    } else if (mediaItem.kind === 'image') {
      const images = Array.isArray(state.mediaPayload?.data?.images) ? state.mediaPayload.data.images : [];
      state.mediaPayload.data.images = images.filter((image, index) => getImageKey(image, index) !== mediaKey);
    } else {
      const videos = Array.isArray(state.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos : [];
      state.mediaPayload.data.videos = videos.filter((video, index) => getVideoKey(video, index) !== mediaKey);
    }

    removeMediaKeyFromOrder(state, mediaKey);
    if (state.activeMediaKey === mediaKey) closeMediaLightbox();
    syncPayloadText(state);

    const remainingItems = getOrderedMediaItems(state);
    if (!remainingItems.length) {
      renderWorkspace(prefix);
      global.showToast?.('Media retire du workspace Etsy');
      return;
    }

    cardNode?.remove();
    syncWorkspacePanels(prefix);
    refreshSortableBinding(prefix);
    global.showToast?.('Media retire du workspace Etsy');
  };

  const clearAllMedia = (prefix) => {
    const state = getState(prefix);
    if (!state) return;

    if (state.mediaPayload?.data) {
      state.mediaPayload.data.images = [];
      state.mediaPayload.data.videos = [];
    }

    state.localImages = [];
    state.mediaOrder = [];
    if (state.activeMediaKey) closeMediaLightbox();
    syncPayloadText(state);
    renderWorkspace(prefix);
    setStatus(prefix, 'Tous les medias du workspace Etsy ont ete supprimes.');
    global.showToast?.('Workspace Etsy vide');
  };

  const renderPlaceholder = (prefix, message) => {
    const nodes = getNodes(prefix);
    if (!nodes.strip) return;
    destroySortable(prefix);

    nodes.strip.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'drop-zone etsy-api-empty-state';
    empty.innerHTML = `
      <div class="dz-placeholder">
        <div class="di" data-svg-icon="image"></div>
        <p>${message}</p>
      </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'field-action-row etsy-api-empty-actions';
    actions.appendChild(createToolbarButton('btn btn-muted', 'image', 'Ajouter images', () => triggerAddImages(prefix)));
    empty.appendChild(actions);

    nodes.strip.appendChild(empty);
    global.PipelineUIIcons?.hydrateIcons?.(empty);
  };

  const renderSummary = (prefix, mediaPayload) => {
    const nodes = getNodes(prefix);
    const state = getState(prefix);
    if (!nodes.summary) return;

    if (!mediaPayload && !(state?.localImages?.length)) {
      nodes.summary.innerHTML = '';
      return;
    }

    const data = mediaPayload?.data || {};
    const images = Array.isArray(data.images) ? data.images : [];
    const videos = Array.isArray(data.videos) ? data.videos : [];
    const localImages = Array.isArray(state?.localImages) ? state.localImages : [];
    const totalImages = images.length + localImages.length;

    nodes.summary.innerHTML = `
      <div class="etsy-api-summary-card">
        <span class="etsy-api-summary-label">Listing</span>
        <span class="etsy-api-summary-value">${String(data.listing_id || mediaPayload?.listing_id || state?.listingId || '-')}</span>
      </div>
      <div class="etsy-api-summary-card">
        <span class="etsy-api-summary-label">Images</span>
        <span class="etsy-api-summary-value">${totalImages} / 20</span>
      </div>
      <div class="etsy-api-summary-card">
        <span class="etsy-api-summary-label">Video</span>
        <span class="etsy-api-summary-value">${videos.length} / 1</span>
      </div>
    `;
  };

  const updateToolbarCount = (prefix) => {
    const state = getState(prefix);
    const nodes = getNodes(prefix);
    const countNode = nodes.strip?.querySelector?.('.image-thumb-toolbar-count');
    if (!state || !countNode) return;

    const images = Array.isArray(state.mediaPayload?.data?.images) ? state.mediaPayload.data.images : [];
    const videos = Array.isArray(state.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos : [];
    const localImages = Array.isArray(state.localImages) ? state.localImages : [];
    countNode.textContent = `${images.length + localImages.length} image(s) - ${videos.length} video(s)`;
  };

  const syncWorkspacePanels = (prefix) => {
    const state = getState(prefix);
    const nodes = getNodes(prefix);
    if (!state || !nodes.panel) return;

    if (nodes.payload) nodes.payload.textContent = state.payloadText || 'Aucun payload charge.';
    renderSummary(prefix, state.mediaPayload);
    updateToolbarCount(prefix);
  };

  const refreshSortableBinding = (prefix) => {
    const state = getState(prefix);
    const nodes = getNodes(prefix);
    const grid = nodes.strip?.querySelector?.('.etsy-api-media-grid');
    const imageCount = Array.isArray(state?.mediaPayload?.data?.images) ? state.mediaPayload.data.images.length : 0;
    const localImageCount = Array.isArray(state?.localImages) ? state.localImages.length : 0;
    const videoCount = Array.isArray(state?.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos.length : 0;
    const mediaCount = imageCount + localImageCount + videoCount;

    if (!grid || mediaCount < 2) {
      destroySortable(prefix);
      return;
    }

    if (!state?.sortable) setupSortable(prefix, grid);
  };

  const renderMediaGrid = (prefix, mediaPayload) => {
    const nodes = getNodes(prefix);
    const state = getState(prefix);
    if (!nodes.strip || !state) return;

    const data = mediaPayload?.data || {};
    const images = Array.isArray(data.images) ? data.images : [];
    const videos = Array.isArray(data.videos) ? data.videos : [];
    const localImages = Array.isArray(state.localImages) ? state.localImages : [];
    const mediaItems = getOrderedMediaItems(state);

    nodes.strip.innerHTML = '';

    if (!images.length && !videos.length && !localImages.length) {
      renderPlaceholder(prefix, 'Colle un listing_id ou une URL Etsy, puis charge ou ajoute les medias du workspace.');
      return;
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'image-thumb-toolbar';
    toolbar.appendChild(createTextBlock('image-thumb-toolbar-count', `${images.length + localImages.length} image(s) - ${videos.length} video(s)`));

    const toolbarActions = document.createElement('div');
    toolbarActions.className = 'image-thumb-toolbar-actions';

    toolbarActions.appendChild(createToolbarButton('btn btn-muted btn-xs-inline', 'image', 'Ajouter images', () => triggerAddImages(prefix)));
    toolbarActions.appendChild(createToolbarButton('btn btn-error btn-xs-inline', 'trash', 'Tout supprimer', () => clearAllMedia(prefix)));
    toolbar.appendChild(toolbarActions);

    const grid = document.createElement('div');
    grid.className = 'image-thumb-grid etsy-api-media-grid';

    mediaItems.forEach((item, index) => {
      if (item.kind === 'image') {
        grid.appendChild(createImageCard(item.value, index, item.key, prefix, item.isLocal));
        return;
      }
      grid.appendChild(createVideoCard(item.value, index, item.key, prefix));
    });

    nodes.strip.appendChild(toolbar);
    nodes.strip.appendChild(grid);
    setupSortable(prefix, grid);
  };

  const setStatus = (prefix, message) => {
    const nodes = getNodes(prefix);
    if (nodes.status) nodes.status.textContent = message;
  };

  const renderWorkspace = (prefix) => {
    const state = getState(prefix);
    const nodes = getNodes(prefix);
    if (!state || !nodes.panel) return;

    nodes.payload.textContent = state.payloadText || 'Aucun payload charge.';
    renderSummary(prefix, state.mediaPayload);

    if (state.mediaPayload || state.localImages.length) {
      renderMediaGrid(prefix, state.mediaPayload);
      const activeItem = state.activeMediaKey ? getMediaItemByKey(state, state.activeMediaKey) : null;
      if (activeItem) fillMediaLightbox(prefix, state.activeMediaKey);
      return;
    }

    renderPlaceholder(prefix, 'Colle un listing_id ou une URL Etsy, puis charge ou ajoute les medias du workspace.');
  };

  const loadEtsyWorkspaceMedia = async (prefix) => {
    const state = getState(prefix);
    const nodes = getNodes(prefix);
    if (!state || !nodes.input) return;

    const listingId = extractListingId(nodes.input.value);
    if (!listingId) {
      setStatus(prefix, 'Listing ID introuvable dans la reference fournie.');
      global.showToast?.('Listing Etsy introuvable', '#ff4757');
      renderWorkspace(prefix);
      return;
    }

    setStatus(prefix, `Chargement des medias de la fiche ${listingId}...`);

    try {
      const payload = await readJson(`${ROUTES.listing}?listing_id=${encodeURIComponent(listingId)}`);
      state.listingId = listingId;
      state.payloadEnvelope = payload || null;
      state.mediaPayload = payload?.payload || null;
      state.mediaOrder = [];
      state.localImages = [];
      state.activeMediaKey = '';
      state.mediaOrder = buildDefaultMediaOrder(state);
      syncPayloadText(state);

      const imageCount = Array.isArray(state.mediaPayload?.data?.images) ? state.mediaPayload.data.images.length : 0;
      const videoCount = Array.isArray(state.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos.length : 0;
      setStatus(prefix, `Fiche ${listingId} chargee - ${imageCount} image(s) - ${videoCount} video(s).`);
      renderWorkspace(prefix);
      global.showToast?.('Medias Etsy charges');
    } catch (error) {
      destroySortable(prefix);
      state.payloadEnvelope = null;
      state.mediaPayload = null;
      state.payloadText = '';
      state.mediaOrder = [];
      state.localImages = [];
      state.activeMediaKey = '';
      setStatus(prefix, `Lecture Etsy impossible : ${error.message}`);
      renderWorkspace(prefix);
      global.showToast?.(`Etsy API : ${error.message}`, '#ff4757');
    }
  };

  const copyEtsyWorkspacePayload = async (prefix) => {
    const state = getState(prefix);
    if (!state?.payloadText) {
      global.showToast?.('Aucun payload Etsy a copier', '#ff4757');
      return;
    }

    try {
      await navigator.clipboard.writeText(state.payloadText);
      global.showToast?.('Payload Etsy copie');
    } catch (error) {
      global.showToast?.(`Copie Etsy : ${error.message}`, '#ff4757');
    }
  };

  const initEtsyWorkspace = () => {
    ensureMediaLightbox();

    ['tt', 'col'].forEach((prefix) => {
      const nodes = getNodes(prefix);
      if (!nodes.panel || !nodes.input) return;

      const uploadInput = ensureUploadInput(prefix);
      uploadInput?.addEventListener('change', async (event) => {
        const files = Array.from(event.target.files || []);
        await addLocalImages(prefix, files);
        event.target.value = '';
      });

      const dropTarget = nodes.strip || nodes.panel;
      dropTarget?.addEventListener('dragover', (event) => {
        const hasImageFile = Array.from(event.dataTransfer?.items || []).some((item) => item.kind === 'file' && item.type.startsWith('image/'));
        if (!hasImageFile) return;
        event.preventDefault();
        dropTarget.classList.add('is-dragover');
      });

      dropTarget?.addEventListener('dragleave', () => {
        dropTarget.classList.remove('is-dragover');
      });

      dropTarget?.addEventListener('drop', async (event) => {
        const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith('image/'));
        dropTarget.classList.remove('is-dragover');
        if (!files.length) return;
        event.preventDefault();
        await addLocalImages(prefix, files);
      });

      nodes.input.addEventListener('input', () => {
        saveListingReference(prefix, nodes.input.value);
        const listingId = extractListingId(nodes.input.value);
        if (!listingId) {
          setStatus(prefix, 'En attente dune fiche source.');
          return;
        }
        setStatus(prefix, `Reference detectee - listing ${listingId}`);
      });

      nodes.input.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        await loadEtsyWorkspaceMedia(prefix);
      });

      const savedReference = restoreListingReference(prefix);
      if (savedReference) {
        nodes.input.value = savedReference;
        const listingId = extractListingId(savedReference);
        if (listingId) {
          setStatus(prefix, `Reference detectee - listing ${listingId}`);
        }
      }

      renderWorkspace(prefix);
    });
  };

  global.PipelineUIEtsyWorkspace = {
    initEtsyWorkspace,
    loadEtsyWorkspaceMedia,
    copyEtsyWorkspacePayload,
    closeMediaLightbox,
  };

  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.etsyWorkspace = global.PipelineUIEtsyWorkspace;
  Object.assign(global, global.PipelineUIEtsyWorkspace);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEtsyWorkspace, { once: true });
  } else {
    initEtsyWorkspace();
  }
})(window);
