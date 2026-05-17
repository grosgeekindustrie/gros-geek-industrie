(function initPipelineUIEtsyWorkspaceMediaUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };

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
      deps.createToolbarButton?.('btn btn-muted btn-xs-inline', 'image', 'Ajouter images', () => deps.triggerAddImages?.(prefix))
    );
    empty.appendChild(actions);

    nodes.strip.appendChild(empty);
    global.PipelineUIIcons?.hydrateIcons?.(empty);
  }

  function renderSummary(prefix, mediaPayload, deps = {}) {
    const nodes = deps.getNodes?.(prefix);
    const state = deps.getState?.(prefix);
    if (!nodes?.summary) return;

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
    const card = document.createElement('article');
    card.className = 'image-thumb-card etsy-api-media-card etsy-api-media-card-visual';
    card.dataset.etsyMediaKind = 'image';
    card.dataset.etsyMediaKey = mediaKey || (isLocal ? deps.getLocalImageKey?.(image) : deps.getImageKey?.(image, index));

    const previewWrap = document.createElement('div');
    previewWrap.className = 'image-thumb-preview-wrap';

    const preview = document.createElement('img');
    preview.className = 'image-thumb-preview';
    preview.src = deps.getDisplayImageSource?.(prefix, card.dataset.etsyMediaKey, image, isLocal) || '';
    preview.alt = image.alt_text || `Image Etsy ${index + 1}`;
    preview.loading = 'lazy';
    previewWrap.appendChild(preview);
    previewWrap.appendChild(createInlineRemoveButton(prefix, card.dataset.etsyMediaKey, deps));
    bindPreviewLightbox(previewWrap, prefix, card.dataset.etsyMediaKey, deps);

    card.appendChild(previewWrap);
    return card;
  }

  function createVideoCard(video, index, mediaKey, prefix, deps = {}) {
    const card = document.createElement('article');
    card.className = 'image-thumb-card etsy-api-media-card etsy-api-media-card-visual';
    card.dataset.etsyMediaKind = 'video';
    card.dataset.etsyMediaKey = mediaKey || deps.getVideoKey?.(video, index);

    const previewWrap = document.createElement('div');
    previewWrap.className = 'image-thumb-preview-wrap etsy-api-video-card-preview';

    const preview = document.createElement('video');
    preview.className = 'image-thumb-preview etsy-api-video-preview';
    preview.src = video.video_url || '';
    preview.poster = video.thumbnail_url || '';
    preview.preload = 'metadata';
    preview.muted = true;
    preview.playsInline = true;
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

    nodes.strip.innerHTML = '';

    if (!images.length && !videos.length && !localImages.length) {
      renderPlaceholder(prefix, 'Charge une fiche source Etsy, puis exploite ici les médias déjà présents dans le workspace.', deps);
      return;
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'image-thumb-toolbar';

    const toolbarCount = document.createElement('div');
    toolbarCount.className = 'image-thumb-toolbar-count';
    toolbarCount.textContent = `${images.length + localImages.length} image(s) - ${videos.length} video(s)`;
    toolbar.appendChild(toolbarCount);

    const toolbarActions = document.createElement('div');
    toolbarActions.className = 'image-thumb-toolbar-actions';
    toolbarActions.appendChild(createToolbarButton('btn btn-muted btn-xs-inline', 'image', 'Ajouter images', () => deps.triggerAddImages?.(prefix)));
    toolbarActions.appendChild(createToolbarButton('btn btn-error btn-xs-inline', 'trash', 'Tout supprimer', () => deps.clearAllMedia?.(prefix)));
    toolbar.appendChild(toolbarActions);

    const grid = document.createElement('div');
    grid.className = 'image-thumb-grid etsy-api-media-grid';

    deps.getOrderedMediaItems?.(state).forEach((item, index) => {
      if (item.kind === 'image') {
        grid.appendChild(createImageCard(item.value, index, item.key, prefix, item.isLocal, deps));
        return;
      }

      if (item.kind === 'video') {
        grid.appendChild(createVideoCard(item.value, index, item.key, prefix, deps));
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
    bindPreviewLightbox,
    createImageCard,
    createVideoCard,
    renderPlaceholder,
    renderSummary,
    renderMediaGrid,
  };

  global.PipelineUIEtsyUI = EtsyUI;
})(window);
