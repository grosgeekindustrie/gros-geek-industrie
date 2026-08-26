(function initPipelineUIEtsyWorkspaceMediaUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };
  const getRuntime = () => global.PipelineUIEtsyRuntime || {};
  const getData = () => global.PipelineUIEtsyData || {};
  const LIGHTBOX_ID = 'etsyMediaLightbox';
  const IMAGE_EDITOR_OVERLAY_ID = 'etsyImageEditorOverlay';
  const getImageKey = (deps, image, index) => deps.getImageKey?.(image, index) || getData().getImageKey?.(image, index) || `image:${String(image?.listing_image_id || image?.image_id || index)}`;
  const getVideoKey = (deps, video, index) => deps.getVideoKey?.(video, index) || getData().getVideoKey?.(video, index) || `video:${String(video?.video_id || video?.listing_video_id || index)}`;
  const getLocalImageKey = (deps, image) => deps.getLocalImageKey?.(image) || getData().getLocalImageKey?.(image) || `local-image:${String(image?.local_id)}`;
  const getNodeById = (id) => document.getElementById(id);
  const getNode = (deps, id) => deps.getNode?.(id) || getNodeById(id);
  const getModalIds = (deps) => ({
    lightboxId: deps.LIGHTBOX_ID || LIGHTBOX_ID,
    imageEditorOverlayId: deps.IMAGE_EDITOR_OVERLAY_ID || IMAGE_EDITOR_OVERLAY_ID,
  });
  const getDisplayImageSource = (deps, prefix, mediaKey, image, isLocal) => (
    deps.getDisplayImageSource?.(prefix, mediaKey, image, isLocal)
    || getRuntime().getDisplayImageSource?.(prefix, mediaKey, image, isLocal)
    || (
      isLocal
        ? String(image?.data_url || '')
        : String(
            image?.url_fullxfull
            || image?.full_url
            || image?.url_570xN
            || image?.url_570xn
            || image?.src
            || image?.url
            || image?.url_170x135
            || image?.url_75x75
            || ''
          )
    )
  );
  const getOrderedMediaItems = (deps, state) => deps.getOrderedMediaItems?.(state) || getRuntime().getOrderedMediaItems?.(state) || [];
  const getCreateToolbarButton = (deps) => deps.createToolbarButton || createToolbarButton;

  function closeImageEditorOverlay(deps = {}) {
    const overlay = getNode(deps, getModalIds(deps).imageEditorOverlayId);
    const editorHost = getNode(deps, 'etsyImageEditorHost');
    const session = deps.getActiveEditorSession?.();

    if (session?.instance?.terminate) {
      try {
        session.instance.terminate();
      } catch (error) {}
    }

    deps.setActiveEditorSession?.(null);

    if (editorHost) {
      editorHost.innerHTML = '';
    }

    if (overlay) {
      overlay.classList.remove('visible');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  function closeMediaLightbox(deps = {}) {
    const overlay = getNode(deps, getModalIds(deps).lightboxId);
    if (!overlay) return;

    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');

    const active = deps.getActiveMediaSelection?.();
    if (!active) return;

    const state = deps.getState?.(active.prefix);
    if (!state) return;
    state.activeMediaKey = '';
  }

  function ensureMediaLightbox(deps = {}) {
    const { lightboxId } = getModalIds(deps);
    const existing = getNode(deps, lightboxId);
    if (existing) {
      const hasEditButton = existing.querySelector('[data-js="etsy-media-lightbox-edit-image"]');
      const hasHeaderActions = existing.querySelector('#etsyMediaLightboxHeaderActions');
      if (hasEditButton && hasHeaderActions) return;
      existing.remove();
    }

    const host = document.createElement('div');
    host.innerHTML = `
<div id="${lightboxId}" class="lb-overlay etsy-media-lightbox" aria-hidden="true">
  <div class="lb-box lb-box-wide etsy-media-lightbox-box" role="dialog" aria-modal="true" aria-labelledby="etsyMediaLightboxTitle">
    <div class="lb-header">
      <h3 id="etsyMediaLightboxTitle"><span data-svg-icon="image"></span><span class="ui-icon-label">MEDIA ETSY</span></h3>
      <div class="etsy-media-lightbox-header-actions">
        <div id="etsyMediaLightboxHeaderActions" class="field-action-row etsy-media-lightbox-header-buttons">
          <button class="btn btn-muted btn-xs-inline" type="button" data-js="etsy-media-lightbox-edit-image-header"><span data-svg-icon="crop"></span><span class="ui-icon-label">Editer image</span></button>
          <button class="btn btn-muted btn-xs-inline" type="button" data-js="etsy-media-lightbox-reset-image-header"><span data-svg-icon="refresh"></span><span class="ui-icon-label">Reinitialiser</span></button>
        </div>
        <button class="lb-close" type="button" data-js="etsy-media-lightbox-close"><span data-svg-icon="close"></span></button>
      </div>
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
        <div id="etsyMediaLightboxImageActions" class="field-action-row etsy-media-lightbox-image-actions">
          <button class="btn btn-muted" type="button" data-js="etsy-media-lightbox-edit-image"><span data-svg-icon="crop"></span><span class="ui-icon-label">Editer image</span></button>
          <button class="btn btn-muted" type="button" data-js="etsy-media-lightbox-reset-image"><span data-svg-icon="refresh"></span><span class="ui-icon-label">Reinitialiser image</span></button>
        </div>
      </div>
    </div>
  </div>
</div>`;

    document.body.appendChild(host);
    global.PipelineUIIcons?.hydrateIcons?.(host);

    const overlay = getNode(deps, lightboxId);
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) deps.closeMediaLightbox?.();
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-close"]')?.addEventListener('click', deps.closeMediaLightbox);

    getNode(deps, 'etsyMediaLightboxAltInput')?.addEventListener('input', (event) => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.setMediaAltText?.(active.prefix, active.mediaKey, String(event.target.value || ''));
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-clear-alt"]')?.addEventListener('click', () => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.setMediaAltText?.(active.prefix, active.mediaKey, '');
      const input = getNode(deps, 'etsyMediaLightboxAltInput');
      if (input) {
        input.value = '';
        input.focus();
      }
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-edit-image"]')?.addEventListener('click', () => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.openImageEditor?.(active.prefix, active.mediaKey);
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-reset-image"]')?.addEventListener('click', () => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.resetEditedImage?.(active.prefix, active.mediaKey);
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-edit-image-header"]')?.addEventListener('click', () => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.openImageEditor?.(active.prefix, active.mediaKey);
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-reset-image-header"]')?.addEventListener('click', () => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.resetEditedImage?.(active.prefix, active.mediaKey);
    });
  }

  function fillMediaLightbox(prefix, mediaKey, deps = {}) {
    const state = deps.getState?.(prefix);
    const mediaItem = deps.getMediaItemByKey?.(state, mediaKey);
    if (!state || !mediaItem) return false;

    deps.ensureMediaLightbox?.();
    const overlay = getNode(deps, getModalIds(deps).lightboxId);
    const previewHost = getNode(deps, 'etsyMediaLightboxPreview');
    const typeNode = getNode(deps, 'etsyMediaLightboxType');
    const idNode = getNode(deps, 'etsyMediaLightboxId');
    const resolutionNode = getNode(deps, 'etsyMediaLightboxResolution');
    const sourceNode = getNode(deps, 'etsyMediaLightboxSource');
    const altGroup = getNode(deps, 'etsyMediaLightboxAltGroup');
    const altInput = getNode(deps, 'etsyMediaLightboxAltInput');
    const imageActions = getNode(deps, 'etsyMediaLightboxImageActions');
    const headerActions = getNode(deps, 'etsyMediaLightboxHeaderActions');
    const resetImageButton = overlay?.querySelector('[data-js="etsy-media-lightbox-reset-image"]');
    const resetImageHeaderButton = overlay?.querySelector('[data-js="etsy-media-lightbox-reset-image-header"]');
    if (!overlay || !previewHost || !typeNode || !idNode || !resolutionNode || !sourceNode || !altGroup || !altInput || !imageActions || !headerActions || !resetImageButton || !resetImageHeaderButton) {
      return false;
    }

    previewHost.innerHTML = '';
    state.activeMediaKey = mediaKey;

    if (mediaItem.kind === 'image') {
      const preview = document.createElement('img');
      preview.className = 'etsy-media-lightbox-preview-image';
      preview.src = deps.getDisplayImageSource?.(prefix, mediaKey, mediaItem.value, mediaItem.isLocal) || '';
      preview.alt = mediaItem.value.alt_text || 'Image Etsy';
      previewHost.appendChild(preview);

      typeNode.textContent = mediaItem.isLocal ? 'Image locale' : 'Image Etsy';
      idNode.textContent = mediaItem.isLocal ? String(mediaItem.value.local_id || '-') : deps.getImageId?.(mediaItem.value);
      resolutionNode.textContent = deps.formatResolution?.(
        mediaItem.isLocal
          ? { width: mediaItem.value.width || 0, height: mediaItem.value.height || 0 }
          : deps.getImageResolution?.(mediaItem.value)
      ) || '-';
      sourceNode.textContent = mediaItem.isLocal ? 'Ajoutee au workspace' : (deps.getImageEditorSource?.(mediaItem) || '');
      altGroup.style.display = '';
      imageActions.style.display = '';
      headerActions.style.display = '';
      altInput.disabled = false;
      altInput.value = mediaItem.value.alt_text || '';
      const hasEditedVersion = !!deps.getEditedImageDataUrl?.(prefix, mediaKey);
      resetImageButton.disabled = !hasEditedVersion;
      resetImageHeaderButton.disabled = !hasEditedVersion;
    } else {
      const preview = document.createElement('video');
      preview.className = 'etsy-media-lightbox-preview-video';
      preview.src = deps.getVideoPreviewSource?.(mediaItem.value, mediaItem.isLocal) || mediaItem.value.video_url || '';
      preview.poster = mediaItem.isLocal ? '' : (mediaItem.value.thumbnail_url || '');
      preview.controls = true;
      preview.preload = 'metadata';
      previewHost.appendChild(preview);

      typeNode.textContent = mediaItem.isLocal ? 'Video locale' : 'Video Etsy';
      idNode.textContent = mediaItem.isLocal ? String(mediaItem.value.local_id || '-') : deps.getVideoId?.(mediaItem.value);
      resolutionNode.textContent = deps.formatResolution?.(deps.getVideoResolution?.(mediaItem.value)) || '-';
      sourceNode.textContent = mediaItem.isLocal ? 'Ajoutee au workspace' : 'Chargee depuis Etsy';
      altGroup.style.display = 'none';
      imageActions.style.display = 'none';
      headerActions.style.display = 'none';
      altInput.disabled = true;
      altInput.value = '';
    }

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    return true;
  }

  function ensureImageEditorOverlay(deps = {}) {
    const { imageEditorOverlayId } = getModalIds(deps);
    if (getNode(deps, imageEditorOverlayId)) return;

    const host = document.createElement('div');
    host.innerHTML = `
<div id="${imageEditorOverlayId}" class="lb-overlay etsy-image-editor-overlay" aria-hidden="true">
  <div class="lb-box lb-box-wide etsy-image-editor-box" role="dialog" aria-modal="true" aria-labelledby="etsyImageEditorTitle">
    <div class="lb-header">
      <h3 id="etsyImageEditorTitle"><span data-svg-icon="crop"></span><span class="ui-icon-label">EDITEUR IMAGE ETSY</span></h3>
      <button class="lb-close" type="button" data-js="etsy-image-editor-close"><span data-svg-icon="close"></span></button>
    </div>
    <div class="etsy-image-editor-stage">
      <div id="etsyImageEditorHost" class="etsy-image-editor-host"></div>
    </div>
  </div>
</div>`;

    document.body.appendChild(host);
    global.PipelineUIIcons?.hydrateIcons?.(host);

    const overlay = getNode(deps, imageEditorOverlayId);
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) deps.closeImageEditorOverlay?.();
    });

    overlay?.querySelector('[data-js="etsy-image-editor-close"]')?.addEventListener('click', deps.closeImageEditorOverlay);
  }

  function renderPlaceholder(prefix, message, deps = {}) {
    const nodes = deps.getNodes?.(prefix);
    if (!nodes?.strip) return;
    deps.destroySortable?.(prefix);

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
    actions.appendChild(
      getCreateToolbarButton(deps)?.('btn btn-muted btn-xs-inline', 'image', 'Ajouter medias', () => deps.triggerAddImages?.(prefix))
    );
    empty.appendChild(actions);

    nodes.strip.appendChild(empty);
    global.PipelineUIIcons?.hydrateIcons?.(empty);
  }

  function renderSummary(prefix, mediaPayload, deps = {}) {
    const nodes = deps.getNodes?.(prefix);
    const state = deps.getState?.(prefix);
    if (!nodes?.summary) return;

    if (!mediaPayload && !(state?.localImages?.length) && !(state?.localVideos?.length)) {
      nodes.summary.innerHTML = '';
      return;
    }

    const data = mediaPayload?.data || {};
    const images = Array.isArray(data.images) ? data.images : [];
    const videos = Array.isArray(data.videos) ? data.videos : [];
    const localImages = Array.isArray(state?.localImages) ? state.localImages : [];
    const localVideos = Array.isArray(state?.localVideos) ? state.localVideos : [];
    const totalImages = images.length + localImages.length;
    const totalVideos = videos.length + localVideos.length;

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
        <span class="etsy-api-summary-value">${totalVideos} / 1</span>
      </div>
    `;
  }

  function createToolbarButton(className, iconName, label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.innerHTML = global.PipelineUIIcons?.renderIconLabel?.(iconName, label) || label;
    button.addEventListener('click', onClick);
    return button;
  }

  function createInlineRemoveButton(prefix, mediaKey, deps = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'etsy-api-media-inline-action';
    button.innerHTML = global.PipelineUIIcons?.renderIcon?.('trash') || 'X';
    button.title = 'Supprimer';
    button.setAttribute('aria-label', 'Supprimer ce media');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      deps.removeMediaByKeyInline?.(prefix, mediaKey, event.currentTarget.closest('[data-etsy-media-key]'));
    });
    return button;
  }

  function updatePipelineAltSelectionSummary(prefix, deps = {}) {
    const nodes = deps.getNodes?.(prefix);
    const state = deps.getState?.(prefix);
    const strip = nodes?.strip;
    if (!strip || !state) return;

    const data = state.mediaPayload?.data || {};
    const images = Array.isArray(data.images) ? data.images : [];
    const videos = Array.isArray(data.videos) ? data.videos : [];
    const localImages = Array.isArray(state.localImages) ? state.localImages : [];
    const localVideos = Array.isArray(state.localVideos) ? state.localVideos : [];
    const selectedAltCount = Array.isArray(state.selectedPipelineAltMediaKeys) ? state.selectedPipelineAltMediaKeys.length : 0;
    const countNode = strip.querySelector('[data-js="etsy-media-toolbar-count"]');
    if (countNode) {
      countNode.textContent = `${images.length + localImages.length} image(s) - ${videos.length + localVideos.length} video(s) - ${selectedAltCount} selectionnee(s)`;
    }
  }

  function syncPipelineAltCheckboxes(prefix, deps = {}) {
    const nodes = deps.getNodes?.(prefix);
    const state = deps.getState?.(prefix);
    const strip = nodes?.strip;
    if (!strip || !state) return;

    const selected = new Set(Array.isArray(state.selectedPipelineAltMediaKeys) ? state.selectedPipelineAltMediaKeys : []);
    strip.querySelectorAll('[data-js="etsy-media-pipeline-alt-select"]').forEach((input) => {
      const mediaKey = String(input.dataset.mediaKey || '').trim();
      input.checked = selected.has(mediaKey);
    });
    updatePipelineAltSelectionSummary(prefix, deps);
  }

  function createPipelineAltCheckbox(prefix, mediaKey, checked, deps = {}) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'etsy-api-media-select-input';
    input.checked = checked;
    input.dataset.js = 'etsy-media-pipeline-alt-select';
    input.dataset.mediaKey = mediaKey;
    input.setAttribute('aria-label', 'Selectionner cette image');
    input.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    input.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    input.addEventListener('change', (event) => {
      event.stopPropagation();
      deps.togglePipelineAltMediaSelection?.(prefix, mediaKey);
      syncPipelineAltCheckboxes(prefix, deps);
    });
    return input;
  }

  function bindPreviewLightbox(node, prefix, mediaKey, deps = {}) {
    node.classList.add('etsy-api-media-preview-clickable');
    node.tabIndex = 0;
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', 'Ouvrir le media');
    node.addEventListener('click', () => deps.openMediaLightbox?.(prefix, mediaKey));
    node.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      deps.openMediaLightbox?.(prefix, mediaKey);
    });
  }

  function createImageCard(image, index, mediaKey, prefix, isLocal, deps = {}) {
    const state = deps.getState?.(prefix);
    const selectedKeys = Array.isArray(state?.selectedPipelineAltMediaKeys) ? state.selectedPipelineAltMediaKeys : [];
    const card = document.createElement('article');
    card.className = 'image-thumb-card etsy-api-media-card etsy-api-media-card-visual';
    card.dataset.etsyMediaKind = 'image';
    card.dataset.etsyMediaKey = mediaKey || (isLocal ? getLocalImageKey(deps, image) : getImageKey(deps, image, index));

    const previewWrap = document.createElement('div');
    previewWrap.className = 'image-thumb-preview-wrap';

    const preview = document.createElement('img');
    preview.className = 'image-thumb-preview';
    preview.src = getDisplayImageSource(deps, prefix, card.dataset.etsyMediaKey, image, isLocal);
    preview.alt = image.alt_text || `Image Etsy ${index + 1}`;
    preview.loading = 'lazy';
    previewWrap.appendChild(preview);
    previewWrap.appendChild(createPipelineAltCheckbox(prefix, card.dataset.etsyMediaKey, selectedKeys.includes(card.dataset.etsyMediaKey), deps));
    previewWrap.appendChild(createInlineRemoveButton(prefix, card.dataset.etsyMediaKey, deps));
    bindPreviewLightbox(previewWrap, prefix, card.dataset.etsyMediaKey, deps);

    card.appendChild(previewWrap);
    return card;
  }

  function createVideoCard(video, index, mediaKey, prefix, isLocal, deps = {}) {
    const card = document.createElement('article');
    card.className = 'image-thumb-card etsy-api-media-card etsy-api-media-card-visual';
    card.dataset.etsyMediaKind = 'video';
    card.dataset.etsyMediaKey = mediaKey || getVideoKey(deps, video, index);

    const previewWrap = document.createElement('div');
    previewWrap.className = 'image-thumb-preview-wrap etsy-api-video-card-preview';

    const preview = document.createElement('video');
    preview.className = 'image-thumb-preview etsy-api-video-preview';
    preview.src = deps.getVideoPreviewSource?.(video, isLocal) || video.video_url || '';
    preview.poster = isLocal ? '' : (video.thumbnail_url || '');
    preview.preload = 'metadata';
    preview.muted = true;
    preview.playsInline = true;
    preview.controls = true;
    preview.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    preview.addEventListener('keydown', (event) => {
      event.stopPropagation();
    });
    previewWrap.appendChild(preview);
    previewWrap.appendChild(createInlineRemoveButton(prefix, card.dataset.etsyMediaKey, deps));
    bindPreviewLightbox(previewWrap, prefix, card.dataset.etsyMediaKey, deps);

    card.appendChild(previewWrap);
    return card;
  }

  function renderMediaGrid(prefix, mediaPayload, deps = {}) {
    const nodes = deps.getNodes?.(prefix);
    const state = deps.getState?.(prefix);
    if (!nodes?.strip || !state) return;

    const data = mediaPayload?.data || {};
    const images = Array.isArray(data.images) ? data.images : [];
    const videos = Array.isArray(data.videos) ? data.videos : [];
    const localImages = Array.isArray(state.localImages) ? state.localImages : [];
    const localVideos = Array.isArray(state.localVideos) ? state.localVideos : [];
    const selectedAltCount = Array.isArray(state.selectedPipelineAltMediaKeys) ? state.selectedPipelineAltMediaKeys.length : 0;

    nodes.strip.innerHTML = '';

    if (!images.length && !videos.length && !localImages.length && !localVideos.length) {
      renderPlaceholder(prefix, 'Charge une fiche source Etsy, puis exploite ici les médias déjà présents dans le workspace.', deps);
      return;
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'image-thumb-toolbar';

    const toolbarCount = document.createElement('div');
    toolbarCount.className = 'image-thumb-toolbar-count';
    toolbarCount.dataset.js = 'etsy-media-toolbar-count';
    toolbarCount.textContent = `${images.length + localImages.length} image(s) - ${videos.length + localVideos.length} video(s) - ${selectedAltCount} selectionnee(s)`;
    toolbar.appendChild(toolbarCount);

    const toolbarActions = document.createElement('div');
    toolbarActions.className = 'image-thumb-toolbar-actions';
    toolbarActions.appendChild(createToolbarButton('btn btn-muted btn-xs-inline', 'check', 'Tout selectionner', () => {
      deps.setAllPipelineAltMediaSelections?.(prefix, true);
      syncPipelineAltCheckboxes(prefix, deps);
    }));
    toolbarActions.appendChild(createToolbarButton('btn btn-muted btn-xs-inline', 'refresh', 'Tout deselectionner', () => {
      deps.setAllPipelineAltMediaSelections?.(prefix, false);
      syncPipelineAltCheckboxes(prefix, deps);
    }));
    toolbarActions.appendChild(createToolbarButton('btn btn-muted btn-xs-inline', 'image', 'Ajouter medias', () => deps.triggerAddImages?.(prefix)));
    toolbarActions.appendChild(createToolbarButton('btn btn-error btn-xs-inline', 'trash', 'Tout supprimer', () => deps.clearAllMedia?.(prefix)));
    toolbar.appendChild(toolbarActions);

    const grid = document.createElement('div');
    grid.className = 'image-thumb-grid etsy-api-media-grid';

    getOrderedMediaItems(deps, state).forEach((item, index) => {
      if (item.kind === 'image') {
        grid.appendChild(createImageCard(item.value, index, item.key, prefix, item.isLocal, deps));
        return;
      }

      if (item.kind === 'video') {
        grid.appendChild(createVideoCard(item.value, index, item.key, prefix, item.isLocal, deps));
      }
    });

    nodes.strip.appendChild(toolbar);
    nodes.strip.appendChild(grid);
    deps.setupSortable?.(prefix, grid);
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.media = {
    ...(EtsyUI.shared.media || {}),
    createToolbarButton,
    createInlineRemoveButton,
    updatePipelineAltSelectionSummary,
    syncPipelineAltCheckboxes,
    createPipelineAltCheckbox,
    bindPreviewLightbox,
    createImageCard,
    createVideoCard,
    renderPlaceholder,
    renderSummary,
    renderMediaGrid,
    closeImageEditorOverlay,
    closeMediaLightbox,
    ensureMediaLightbox,
    fillMediaLightbox,
    ensureImageEditorOverlay,
  };

  global.PipelineUIEtsyUI = EtsyUI;
})(window);
