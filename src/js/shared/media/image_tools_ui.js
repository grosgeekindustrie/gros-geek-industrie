(function initPipelineUIImageTools(global) {
  'use strict';

// Outils d'image dédiés.
// Gère le crop interactif, les exports de variants et le debug du payload image.
// Le module reste volontairement centré sur l'édition / inspection locale des images.
  global.PipelineUI = global.PipelineUI || {};

  const TOOLS_STATE_KEY = '__pipelineImageToolsState';
  const DEFAULT_EXPORT_MEDIA_TYPE = 'image/png';
  const CROP_EXPORT_WIDTH = 512;

  const getToolsState = () => {
    if (!global[TOOLS_STATE_KEY]) {
      global[TOOLS_STATE_KEY] = {
        activeCrop: null,
        drag: null,
      };
    }

    return global[TOOLS_STATE_KEY];
  };

  const getImageDataUrl = (base64, mediaType = DEFAULT_EXPORT_MEDIA_TYPE) => (
    `data:${mediaType};base64,${base64}`
  );

  const splitDataUrl = (dataUrl) => {
    const match = String(dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/);
    if (!match) throw new Error('Data URL image invalide');

    return {
      mediaType: match[1],
      base64: match[2],
    };
  };

  const loadImageFromDataUrl = (dataUrl) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Chargement image impossible'));
    image.src = dataUrl;
  });

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const getDefaultExportMediaType = () => DEFAULT_EXPORT_MEDIA_TYPE;

  const estimateBase64Bytes = (base64) => {
    const normalized = String(base64 || '').replace(/=+$/, '');
    return Math.floor((normalized.length * 3) / 4);
  };

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const ensureImageToolsModal = () => {
    if (document.getElementById('imageCropModal')) return;

    const host = document.createElement('div');
    host.innerHTML = `
<div id="imageCropModal" class="image-tools-modal" aria-hidden="true">
  <div class="image-tools-modal-card image-tools-modal-card-crop" role="dialog" aria-modal="true" aria-labelledby="imageCropModalTitle">
    <div class="image-tools-modal-header">
      <div class="image-tools-modal-title-group">
        <h3 id="imageCropModalTitle" class="image-tools-modal-title">Crop image</h3>
        <div id="imageCropModalMeta" class="image-tools-modal-meta"></div>
      </div>
      <button type="button" class="lb-close" data-js="image-crop-close">✕</button>
    </div>
    <div class="image-tools-modal-body image-tools-modal-body-crop">
      <div class="image-crop-stage">
        <div id="imageCropViewport" class="image-crop-viewport">
          <img id="imageCropPreview" class="image-crop-preview" alt="Prévisualisation crop" />
        </div>
      </div>
      <div class="image-crop-toolbar">
        <div class="image-crop-zoom-group">
          <button type="button" class="btn btn-muted" data-js="image-crop-zoom-out">−</button>
          <input id="imageCropZoomRange" class="image-crop-zoom-range" type="range" min="100" max="500" step="1" value="100" />
          <button type="button" class="btn btn-muted" data-js="image-crop-zoom-in">+</button>
          <span id="imageCropZoomValue" class="image-crop-zoom-value">100%</span>
        </div>
        <div id="imageCropInfo" class="image-crop-info"></div>
      </div>
    </div>
    <div class="image-tools-modal-footer image-tools-modal-footer-split">
      <button type="button" class="btn btn-muted" data-js="image-crop-reset">Réinitialiser</button>
      <div class="image-tools-modal-actions">
        <button type="button" class="btn btn-muted" data-js="image-crop-cancel">Annuler</button>
        <button type="button" class="btn btn-accent" data-js="image-crop-confirm">Valider le crop</button>
      </div>
    </div>
  </div>
</div>
<div id="imagePayloadDebugModal" class="image-tools-modal" aria-hidden="true">
  <div class="image-tools-modal-card image-tools-modal-card-debug" role="dialog" aria-modal="true" aria-labelledby="imagePayloadDebugTitle">
    <div class="image-tools-modal-header">
      <div class="image-tools-modal-title-group">
        <h3 id="imagePayloadDebugTitle" class="image-tools-modal-title">Debug images envoyées</h3>
        <div id="imagePayloadDebugMeta" class="image-tools-modal-meta"></div>
      </div>
      <button type="button" class="lb-close" data-js="image-debug-close">✕</button>
    </div>
    <div class="image-tools-modal-body image-tools-modal-body-debug">
      <div id="imagePayloadDebugList" class="image-payload-debug-list"></div>
    </div>
    <div class="image-tools-modal-footer">
      <button type="button" class="btn btn-muted" data-js="image-debug-close-alt">Fermer</button>
    </div>
  </div>
</div>
`;

    document.body.appendChild(host);

    const cropModal = document.getElementById('imageCropModal');
    const debugModal = document.getElementById('imagePayloadDebugModal');

    cropModal.addEventListener('click', (event) => {
      if (event.target === cropModal) closeImageCropModal();
    });
    debugModal.addEventListener('click', (event) => {
      if (event.target === debugModal) closeImagePayloadDebugModal();
    });

    document.querySelectorAll('[data-js="image-crop-close"],[data-js="image-crop-cancel"]').forEach((button) => {
      button.addEventListener('click', closeImageCropModal);
    });
    document.querySelectorAll('[data-js="image-debug-close"],[data-js="image-debug-close-alt"]').forEach((button) => {
      button.addEventListener('click', closeImagePayloadDebugModal);
    });

    document.querySelector('[data-js="image-crop-reset"]').addEventListener('click', resetCropView);
    document.querySelector('[data-js="image-crop-confirm"]').addEventListener('click', confirmCropModal);
    document.querySelector('[data-js="image-crop-zoom-in"]').addEventListener('click', () => nudgeCropZoom(0.1));
    document.querySelector('[data-js="image-crop-zoom-out"]').addEventListener('click', () => nudgeCropZoom(-0.1));
    document.getElementById('imageCropZoomRange').addEventListener('input', handleCropZoomRangeInput);

    const viewport = document.getElementById('imageCropViewport');
    viewport.addEventListener('pointerdown', startCropDrag);
    viewport.addEventListener('pointermove', handleCropDrag);
    viewport.addEventListener('pointerup', endCropDrag);
    viewport.addEventListener('pointerleave', endCropDrag);
    viewport.addEventListener('pointercancel', endCropDrag);
    viewport.addEventListener('wheel', handleCropWheel, { passive: false });

    global.addEventListener('keydown', handleImageToolsKeydown);
    global.addEventListener('resize', handleCropResize);
  };

  const handleImageToolsKeydown = (event) => {
    if (event.key !== 'Escape') return;
    closeImageCropModal();
    closeImagePayloadDebugModal();
  };

  const handleCropResize = () => {
    const state = getToolsState();
    if (!state.activeCrop) return;

    fitCropViewport();
    resetCropView();
  };

  const fitCropViewport = () => {
    const state = getToolsState();
    const activeCrop = state.activeCrop;
    if (!activeCrop) return;

    const viewport = document.getElementById('imageCropViewport');
    const stage = viewport?.parentElement;
    if (!viewport || !stage) return;

    const imageAspect = activeCrop.originalWidth / activeCrop.originalHeight;
    const stageWidth = Math.max(stage.clientWidth - 8, 240);
    const stageHeight = Math.max(stage.clientHeight - 8, 240);

    let viewportWidth = Math.min(stageWidth, 820);
    let viewportHeight = viewportWidth / imageAspect;

    if (viewportHeight > stageHeight) {
      viewportHeight = stageHeight;
      viewportWidth = viewportHeight * imageAspect;
    }

    viewport.style.width = `${Math.round(viewportWidth)}px`;
    viewport.style.height = `${Math.round(viewportHeight)}px`;
    activeCrop.viewportWidth = Math.round(viewportWidth);
    activeCrop.viewportHeight = Math.round(viewportHeight);
    activeCrop.aspectRatio = viewportWidth / viewportHeight;
  };

  const getCropMinScale = (activeCrop) => Math.max(
    activeCrop.viewportWidth / activeCrop.originalWidth,
    activeCrop.viewportHeight / activeCrop.originalHeight,
  );

  const constrainCrop = (activeCrop) => {
    const renderedWidth = activeCrop.originalWidth * activeCrop.scale;
    const renderedHeight = activeCrop.originalHeight * activeCrop.scale;
    const minX = activeCrop.viewportWidth - renderedWidth;
    const minY = activeCrop.viewportHeight - renderedHeight;

    activeCrop.translateX = clamp(activeCrop.translateX, minX, 0);
    activeCrop.translateY = clamp(activeCrop.translateY, minY, 0);
  };

  const syncCropPreview = () => {
    const state = getToolsState();
    const activeCrop = state.activeCrop;
    if (!activeCrop) return;

    constrainCrop(activeCrop);

    const preview = document.getElementById('imageCropPreview');
    const range = document.getElementById('imageCropZoomRange');
    const zoomValue = document.getElementById('imageCropZoomValue');
    const info = document.getElementById('imageCropInfo');
    if (!preview || !range || !zoomValue || !info) return;

    preview.style.width = `${Math.round(activeCrop.originalWidth * activeCrop.scale)}px`;
    preview.style.height = `${Math.round(activeCrop.originalHeight * activeCrop.scale)}px`;
    preview.style.transform = `translate(${Math.round(activeCrop.translateX)}px, ${Math.round(activeCrop.translateY)}px)`;

    const zoomPercent = Math.round((activeCrop.scale / activeCrop.minScale) * 100);
    range.value = String(clamp(zoomPercent, 100, 500));
    zoomValue.textContent = `${range.value}%`;
    info.textContent = `${activeCrop.viewportWidth} × ${activeCrop.viewportHeight}px → export ${CROP_EXPORT_WIDTH}px de large`;
  };

  const resetCropView = () => {
    const state = getToolsState();
    const activeCrop = state.activeCrop;
    if (!activeCrop) return;

    activeCrop.minScale = getCropMinScale(activeCrop);
    activeCrop.scale = activeCrop.minScale;
    activeCrop.translateX = Math.round((activeCrop.viewportWidth - (activeCrop.originalWidth * activeCrop.scale)) / 2);
    activeCrop.translateY = Math.round((activeCrop.viewportHeight - (activeCrop.originalHeight * activeCrop.scale)) / 2);
    syncCropPreview();
  };

  const setCropScale = (nextScale, anchorX = null, anchorY = null) => {
    const state = getToolsState();
    const activeCrop = state.activeCrop;
    if (!activeCrop) return;

    const minScale = activeCrop.minScale;
    const maxScale = minScale * 5;
    const clampedScale = clamp(nextScale, minScale, maxScale);
    if (clampedScale === activeCrop.scale) {
      syncCropPreview();
      return;
    }

    const pivotX = anchorX ?? activeCrop.viewportWidth / 2;
    const pivotY = anchorY ?? activeCrop.viewportHeight / 2;
    const ratio = clampedScale / activeCrop.scale;

    activeCrop.translateX = pivotX - ((pivotX - activeCrop.translateX) * ratio);
    activeCrop.translateY = pivotY - ((pivotY - activeCrop.translateY) * ratio);
    activeCrop.scale = clampedScale;
    syncCropPreview();
  };

  const nudgeCropZoom = (deltaFactor) => {
    const state = getToolsState();
    const activeCrop = state.activeCrop;
    if (!activeCrop) return;

    setCropScale(activeCrop.scale * (1 + deltaFactor));
  };

  const handleCropZoomRangeInput = (event) => {
    const state = getToolsState();
    const activeCrop = state.activeCrop;
    if (!activeCrop) return;

    const ratio = Number(event.target.value || 100) / 100;
    setCropScale(activeCrop.minScale * ratio);
  };

  const startCropDrag = (event) => {
    const state = getToolsState();
    const activeCrop = state.activeCrop;
    const viewport = document.getElementById('imageCropViewport');
    if (!activeCrop || !viewport) return;

    state.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: activeCrop.translateX,
      originY: activeCrop.translateY,
    };

    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-dragging');
  };

  const handleCropDrag = (event) => {
    const state = getToolsState();
    const activeCrop = state.activeCrop;
    const drag = state.drag;
    if (!activeCrop || !drag || drag.pointerId !== event.pointerId) return;

    activeCrop.translateX = drag.originX + (event.clientX - drag.startX);
    activeCrop.translateY = drag.originY + (event.clientY - drag.startY);
    syncCropPreview();
  };

  const endCropDrag = (event) => {
    const state = getToolsState();
    const drag = state.drag;
    const viewport = document.getElementById('imageCropViewport');
    if (viewport) viewport.classList.remove('is-dragging');
    if (!drag) return;
    if (event && drag.pointerId !== event.pointerId) return;

    state.drag = null;
  };

  const handleCropWheel = (event) => {
    event.preventDefault();
    const state = getToolsState();
    const activeCrop = state.activeCrop;
    if (!activeCrop) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const anchorX = event.clientX - rect.left;
    const anchorY = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.08 : 0.92;

    setCropScale(activeCrop.scale * factor, anchorX, anchorY);
  };

  const exportVariantFromSource = async ({
    sourceBase64,
    sourceMediaType,
    sourceWidth,
    sourceHeight,
    crop,
    targetWidth,
    outputMediaType = DEFAULT_EXPORT_MEDIA_TYPE,
  }) => {
    const sourceDataUrl = getImageDataUrl(sourceBase64, sourceMediaType);
    const image = await loadImageFromDataUrl(sourceDataUrl);

    const cropWidth = crop?.width || sourceWidth || image.naturalWidth || image.width;
    const cropHeight = crop?.height || sourceHeight || image.naturalHeight || image.height;
    const cropX = crop?.x || 0;
    const cropY = crop?.y || 0;

    const exportWidth = Math.min(Math.round(targetWidth || cropWidth), Math.round(cropWidth));
    const exportScale = exportWidth / cropWidth;
    const exportHeight = Math.round(cropHeight * exportScale);

    const canvas = document.createElement('canvas');
    canvas.width = exportWidth;
    canvas.height = exportHeight;

    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      exportWidth,
      exportHeight,
    );

    const dataUrl = outputMediaType === 'image/png'
      ? canvas.toDataURL(outputMediaType)
      : canvas.toDataURL(outputMediaType, 1);
    const split = splitDataUrl(dataUrl);

    return {
      base64: split.base64,
      mediaType: split.mediaType,
      width: exportWidth,
      height: exportHeight,
    };
  };

  const openImageCropModal = async ({ imageRecord, onConfirm }) => {
    ensureImageToolsModal();

    const sourceBase64 = imageRecord.originalBase64 || imageRecord.base64;
    const sourceMediaType = imageRecord.originalMediaType || imageRecord.mediaType || DEFAULT_EXPORT_MEDIA_TYPE;
    const sourceWidth = imageRecord.originalWidth || imageRecord.width;
    const sourceHeight = imageRecord.originalHeight || imageRecord.height;
    if (!sourceBase64 || !sourceWidth || !sourceHeight) throw new Error('Source image indisponible pour le crop');

    const state = getToolsState();
    state.activeCrop = {
      imageRecord,
      onConfirm,
      sourceBase64,
      sourceMediaType,
      sourceDataUrl: getImageDataUrl(sourceBase64, sourceMediaType),
      originalWidth: sourceWidth,
      originalHeight: sourceHeight,
      viewportWidth: 0,
      viewportHeight: 0,
      minScale: 1,
      scale: 1,
      translateX: 0,
      translateY: 0,
      aspectRatio: sourceWidth / sourceHeight,
    };

    const preview = document.getElementById('imageCropPreview');
    const meta = document.getElementById('imageCropModalMeta');
    preview.src = state.activeCrop.sourceDataUrl;
    meta.textContent = `${imageRecord.name || 'Image'} · source ${sourceWidth} × ${sourceHeight}px`;

    document.getElementById('imageCropModal').classList.add('visible');
    document.body.classList.add('image-tools-modal-open');

    requestAnimationFrame(() => {
      fitCropViewport();
      resetCropView();
    });
  };

  const confirmCropModal = async () => {
    const state = getToolsState();
    const activeCrop = state.activeCrop;
    if (!activeCrop) return;

    const crop = {
      x: Math.max(0, Math.round((-activeCrop.translateX) / activeCrop.scale)),
      y: Math.max(0, Math.round((-activeCrop.translateY) / activeCrop.scale)),
      width: Math.round(activeCrop.viewportWidth / activeCrop.scale),
      height: Math.round(activeCrop.viewportHeight / activeCrop.scale),
    };

    const variant = await exportVariantFromSource({
      sourceBase64: activeCrop.sourceBase64,
      sourceMediaType: activeCrop.sourceMediaType,
      sourceWidth: activeCrop.originalWidth,
      sourceHeight: activeCrop.originalHeight,
      crop,
      targetWidth: CROP_EXPORT_WIDTH,
      outputMediaType: DEFAULT_EXPORT_MEDIA_TYPE,
    });

    if (typeof activeCrop.onConfirm === 'function') {
      activeCrop.onConfirm({
        ...variant,
        crop,
      });
    }

    closeImageCropModal();
  };

  const closeImageCropModal = () => {
    const modal = document.getElementById('imageCropModal');
    if (modal) modal.classList.remove('visible');

    const preview = document.getElementById('imageCropPreview');
    if (preview) preview.removeAttribute('src');

    document.body.classList.remove('image-tools-modal-open');
    const state = getToolsState();
    state.activeCrop = null;
    state.drag = null;
  };

  const buildDebugCardHtml = (imageRecord, index) => {
    const sentBytes = formatBytes(estimateBase64Bytes(imageRecord.base64));
    const sourceBytes = imageRecord.originalBase64
      ? formatBytes(estimateBase64Bytes(imageRecord.originalBase64))
      : sentBytes;
    const isCropped = Boolean(imageRecord.cropRect);

    return `
<article class="image-payload-debug-card">
  <div class="image-payload-debug-preview-wrap">
    <img class="image-payload-debug-preview" src="${getImageDataUrl(imageRecord.base64, imageRecord.mediaType)}" alt="Preview payload ${index + 1}" />
  </div>
  <div class="image-payload-debug-body">
    <div class="image-payload-debug-name">${imageRecord.name || `Image ${index + 1}`}</div>
    <dl class="image-payload-debug-meta-list">
      <div><dt>Payload</dt><dd>${imageRecord.width || '?'} × ${imageRecord.height || '?'} px</dd></div>
      <div><dt>Format</dt><dd>${imageRecord.mediaType || DEFAULT_EXPORT_MEDIA_TYPE}</dd></div>
      <div><dt>Taille</dt><dd>${sentBytes}</dd></div>
      <div><dt>Source</dt><dd>${imageRecord.originalWidth || imageRecord.width || '?'} × ${imageRecord.originalHeight || imageRecord.height || '?'} px</dd></div>
      <div><dt>Source taille</dt><dd>${sourceBytes}</dd></div>
      <div><dt>Crop</dt><dd>${isCropped ? 'Oui' : 'Non'}</dd></div>
    </dl>
  </div>
</article>
`;
  };

  const openImagePayloadDebugModal = ({ prefix, images }) => {
    ensureImageToolsModal();

    const modal = document.getElementById('imagePayloadDebugModal');
    const list = document.getElementById('imagePayloadDebugList');
    const meta = document.getElementById('imagePayloadDebugMeta');
    if (!modal || !list || !meta) return;

    const records = Array.isArray(images) ? images : [];
    meta.textContent = `${prefix === 'col' ? 'Collection' : 'Tabletop'} · ${records.length} image(s) exactement envoyée(s) à l'API`;
    list.innerHTML = records.length
      ? records.map(buildDebugCardHtml).join('')
      : '<div class="image-payload-debug-empty">Aucune image dans le payload actuel.</div>';

    modal.classList.add('visible');
    document.body.classList.add('image-tools-modal-open');
  };

  const closeImagePayloadDebugModal = () => {
    const modal = document.getElementById('imagePayloadDebugModal');
    if (modal) modal.classList.remove('visible');
    document.body.classList.remove('image-tools-modal-open');
  };

  global.PipelineUIImageTools = {
    ensureImageToolsModal,
    getImageDataUrl,
    splitDataUrl,
    loadImageFromDataUrl,
    getDefaultExportMediaType,
    exportVariantFromSource,
    openImageCropModal,
    openImagePayloadDebugModal,
  };

  global.PipelineUI.imageTools = global.PipelineUI.imageTools || {};
  Object.assign(global.PipelineUI.imageTools, global.PipelineUIImageTools);
})(window);
