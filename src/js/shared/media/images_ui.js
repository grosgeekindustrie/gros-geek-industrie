(function initPipelineUIImages(global) {
  'use strict';

// Gestion locale des images.
// Upload, normalisation locale, rendu des miniatures et actions de crop / debug.
// Le payload envoyé aux agents reste contenu dans state.images[p].
  global.PipelineUI = global.PipelineUI || {};
  const sharedConstants = global.PipelineUISharedConstants || {};
  const logger = global.PipelineUILogger?.createLogger?.(sharedConstants.LOG_PREFIXES?.MEDIA || 'media');

  const getState = () => global.state;
  const imageTools = () => global.PipelineUIImageTools || {};
  const imageDb = () => global.PipelineUIIndexedDb || {};
  const sortableByPrefix = new Map();
  const getSortableCtor = () => global.Sortable || null;

  const stopEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const getAutomaticQualityForIndex = (imageIndex) => (imageIndex === 0 ? 'high' : 'economy');

  const getEffectiveAnalysisQuality = (imageRecord, imageIndex) => {
    const configured = String(imageRecord?.aiAnalysisQuality || 'auto');
    return configured === 'auto' ? getAutomaticQualityForIndex(imageIndex) : configured;
  };

  const getTargetWidthForQuality = (quality) => (quality === 'high' ? 1024 : 512);

  const getTargetWidthForNextImage = (prefix) => {
    const state = getState();
    const currentCount = state?.images?.[prefix]?.length || 0;
    return getTargetWidthForQuality(getAutomaticQualityForIndex(currentCount));
  };

  const persistImages = async (prefix) => {
    const state = getState();
    if (!state?.images?.[prefix]) return;

    try {
      const normalized = await imageDb().saveWorkspaceImages?.(prefix, state.images[prefix]);
      if (Array.isArray(normalized) && normalized.length) {
        state.images[prefix] = normalized;
      }
    } catch (error) {
      logger?.warn?.(`Persist images failed for ${prefix}`, error);
    }
  };

  const destroyThumbSortable = (prefix) => {
    const sortable = sortableByPrefix.get(prefix);
    if (!sortable) return;

    sortable.destroy();
    sortableByPrefix.delete(prefix);
  };

  const buildDuplicateName = (name) => {
    const rawName = String(name || 'Image').trim();
    if (!rawName) return 'Image · copie';
    if (/· copie(?: \d+)?$/i.test(rawName)) return rawName;
    return `${rawName} · copie`;
  };

  const clearAnthropicImageFileState = (imageRecord, { keepContentHash = false } = {}) => {
    if (!imageRecord || typeof imageRecord !== 'object') return;

    if (!keepContentHash) imageRecord.contentHash = '';
    imageRecord.anthropicFileId = '';
    imageRecord.anthropicContentHash = '';
    imageRecord.anthropicUploadedAt = '';
  };

  const ensureOriginalSource = async (file) => {
    const originalDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(String(event.target?.result || ''));
      reader.onerror = () => reject(new Error('Lecture image impossible'));
      reader.readAsDataURL(file);
    });

    const { splitDataUrl, loadImageFromDataUrl } = imageTools();
    const split = splitDataUrl(originalDataUrl);
    const loadedImage = await loadImageFromDataUrl(originalDataUrl);

    return {
      originalBase64: split.base64,
      originalMediaType: split.mediaType,
      originalWidth: loadedImage.naturalWidth || loadedImage.width,
      originalHeight: loadedImage.naturalHeight || loadedImage.height,
    };
  };

  const buildImageRecordFromFile = async (file, prefix) => {
    const tools = imageTools();
    const original = await ensureOriginalSource(file);
    const variant = await tools.exportVariantFromSource({
      sourceBase64: original.originalBase64,
      sourceMediaType: original.originalMediaType,
      sourceWidth: original.originalWidth,
      sourceHeight: original.originalHeight,
      targetWidth: getTargetWidthForNextImage(prefix),
      outputMediaType: tools.getDefaultExportMediaType(),
    });

    return {
      id: imageDb().createImageId?.() || `${Date.now()}`,
      name: file.name,
      base64: variant.base64,
      mediaType: variant.mediaType,
      width: variant.width,
      height: variant.height,
      originalBase64: original.originalBase64,
      originalMediaType: original.originalMediaType,
      originalWidth: original.originalWidth,
      originalHeight: original.originalHeight,
      cropRect: null,
      aiAnalysisQuality: 'auto',
      contentHash: '',
      anthropicFileId: '',
      anthropicContentHash: '',
      anthropicUploadedAt: '',
    };
  };

  const setupImageHandlers = (prefix) => {
    const dropZone = document.getElementById(`dropZone-${prefix}`);
    const input = document.getElementById(`imgInput-${prefix}`);
    if (!dropZone || !input) return;

    imageTools().ensureImageToolsModal?.();

    dropZone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('click', (event) => {
      if (event.target === input) return;
      input.click();
    });

    dropZone.addEventListener('drop', async (event) => {
      event.preventDefault();
      dropZone.classList.remove('dragover');
      const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
      await processImages(files, prefix);
    });

    input.addEventListener('change', async (event) => {
      await processImages(Array.from(event.target.files || []), prefix);
      input.value = '';
    });
  };

  const processImages = async (files, prefix) => {
    const state = getState();
    if (!state?.images?.[prefix]) return;

    for (const file of files) {
      if (!file?.type?.startsWith('image/')) continue;

      const imageRecord = await buildImageRecordFromFile(file, prefix);
      state.images[prefix].push(imageRecord);
    }

    renderThumbs(prefix);
    await persistImages(prefix);
  };

  const updateImageRecordFromCrop = async (prefix, imageIndex, cropVariant) => {
    const state = getState();
    const currentImage = state?.images?.[prefix]?.[imageIndex];
    if (!currentImage) return;

    if (!currentImage.originalBase64) currentImage.originalBase64 = currentImage.base64;
    if (!currentImage.originalMediaType) currentImage.originalMediaType = currentImage.mediaType;
    if (!currentImage.originalWidth) currentImage.originalWidth = currentImage.width;
    if (!currentImage.originalHeight) currentImage.originalHeight = currentImage.height;

    currentImage.cropRect = cropVariant.crop;
    const rebuiltVariant = await imageTools().exportVariantFromSource({
      sourceBase64: currentImage.originalBase64,
      sourceMediaType: currentImage.originalMediaType,
      sourceWidth: currentImage.originalWidth,
      sourceHeight: currentImage.originalHeight,
      crop: currentImage.cropRect,
      targetWidth: getTargetWidthForQuality(getEffectiveAnalysisQuality(currentImage, imageIndex)),
      outputMediaType: imageTools().getDefaultExportMediaType(),
    });
    currentImage.base64 = rebuiltVariant.base64;
    currentImage.mediaType = rebuiltVariant.mediaType;
    currentImage.width = rebuiltVariant.width;
    currentImage.height = rebuiltVariant.height;
    clearAnthropicImageFileState(currentImage);

    renderThumbs(prefix);
    await persistImages(prefix);
  };

  const openCropForImage = (prefix, imageIndex) => {
    const state = getState();
    const imageRecord = state?.images?.[prefix]?.[imageIndex];
    if (!imageRecord) return;

    imageTools().openImageCropModal?.({
      imageRecord,
      onConfirm: (cropVariant) => updateImageRecordFromCrop(prefix, imageIndex, cropVariant),
    });
  };

  const openPayloadDebug = (prefix) => {
    const state = getState();
    imageTools().openImagePayloadDebugModal?.({
      prefix,
      images: state?.images?.[prefix] || [],
    });
  };

  const duplicateImageAt = async (imageIndex, prefix) => {
    const state = getState();
    const imageRecord = state?.images?.[prefix]?.[imageIndex];
    if (!imageRecord) return;

    const duplicateRecord = imageDb().normalizeImageRecord?.({
      ...imageRecord,
      id: imageDb().createImageId?.(),
      name: buildDuplicateName(imageRecord.name),
    }) || {
      ...imageRecord,
      id: imageDb().createImageId?.() || `${Date.now()}`,
      name: buildDuplicateName(imageRecord.name),
    };

    clearAnthropicImageFileState(duplicateRecord, {
      keepContentHash: Boolean(imageRecord.contentHash),
    });

    state.images[prefix].splice(imageIndex + 1, 0, duplicateRecord);
    renderThumbs(prefix);
    await persistImages(prefix);
  };

  const updateImageAnalysisQuality = async (prefix, imageIndex, quality) => {
    const state = getState();
    const imageRecord = state?.images?.[prefix]?.[imageIndex];
    if (!imageRecord || !['auto', 'economy', 'high'].includes(quality)) return;

    imageRecord.aiAnalysisQuality = quality;
    const variant = await imageTools().exportVariantFromSource({
      sourceBase64: imageRecord.originalBase64 || imageRecord.base64,
      sourceMediaType: imageRecord.originalMediaType || imageRecord.mediaType,
      sourceWidth: imageRecord.originalWidth || imageRecord.width,
      sourceHeight: imageRecord.originalHeight || imageRecord.height,
      crop: imageRecord.cropRect,
      targetWidth: getTargetWidthForQuality(getEffectiveAnalysisQuality(imageRecord, imageIndex)),
      outputMediaType: imageTools().getDefaultExportMediaType(),
    });
    imageRecord.base64 = variant.base64;
    imageRecord.mediaType = variant.mediaType;
    imageRecord.width = variant.width;
    imageRecord.height = variant.height;
    clearAnthropicImageFileState(imageRecord);
    renderThumbs(prefix);
    await persistImages(prefix);
  };

  const resetAIAnalysisDefaults = async ({ notify = false } = {}) => {
    const prefixes = ['tt', 'col'];
    let resetCount = 0;

    for (const prefix of prefixes) {
      const images = getState()?.images?.[prefix];
      if (!Array.isArray(images) || !images.length) continue;
      for (let index = 0; index < images.length; index += 1) {
        if (images[index].aiAnalysisQuality !== 'auto') resetCount += 1;
        await updateImageAnalysisQuality(prefix, index, 'auto');
      }
    }

    if (notify && resetCount > 0) global.showToast?.(`${resetCount} réglage(s) image réinitialisé(s)`);
    return resetCount;
  };

  const renderThumbCard = (imageRecord, imageIndex, prefix) => {
    const card = document.createElement('article');
    card.className = 'image-thumb-card';
    card.dataset.imageThumbId = String(imageRecord.id || `${prefix}-${imageIndex}`);
    card.addEventListener('click', stopEvent);

    const previewWrap = document.createElement('div');
    previewWrap.className = 'image-thumb-preview-wrap';

    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'image-thumb-ai-options';
    const optionsButton = document.createElement('button');
    optionsButton.type = 'button';
    optionsButton.className = 'image-thumb-options-btn';
    optionsButton.textContent = '•••';
    optionsButton.title = 'Options d’analyse IA';
    optionsButton.setAttribute('aria-label', 'Options d’analyse IA');
    optionsButton.setAttribute('aria-expanded', 'false');
    const optionsMenu = document.createElement('div');
    optionsMenu.className = 'image-thumb-options-menu';
    optionsMenu.hidden = true;
    optionsMenu.innerHTML = `
      <strong>Qualité d’analyse IA</strong>
      <button type="button" data-image-ai-quality="auto">Automatique</button>
      <button type="button" data-image-ai-quality="economy">Économique · 512 px</button>
      <button type="button" data-image-ai-quality="high">Haute · 1024 px</button>`;
    optionsButton.addEventListener('click', (event) => {
      stopEvent(event);
      optionsMenu.hidden = !optionsMenu.hidden;
      optionsButton.setAttribute('aria-expanded', String(!optionsMenu.hidden));
    });
    optionsMenu.addEventListener('click', async (event) => {
      stopEvent(event);
      const qualityButton = event.target.closest('[data-image-ai-quality]');
      if (!qualityButton) return;
      optionsMenu.hidden = true;
      await updateImageAnalysisQuality(prefix, imageIndex, qualityButton.dataset.imageAiQuality);
    });
    optionsWrap.appendChild(optionsButton);
    optionsWrap.appendChild(optionsMenu);

    const preview = document.createElement('img');
    preview.className = 'image-thumb-preview';
    preview.src = imageTools().getImageDataUrl?.(imageRecord.base64, imageRecord.mediaType);
    preview.alt = imageRecord.name || `Image ${imageIndex + 1}`;
    preview.title = imageRecord.name || '';

    previewWrap.appendChild(preview);
    previewWrap.appendChild(optionsWrap);

    const body = document.createElement('div');
    body.className = 'image-thumb-body';

    const name = document.createElement('div');
    name.className = 'image-thumb-name';
    name.textContent = imageRecord.name || `Image ${imageIndex + 1}`;

    const meta = document.createElement('div');
    meta.className = 'image-thumb-meta';
    const configuredQuality = String(imageRecord.aiAnalysisQuality || 'auto');
    const effectiveQuality = getEffectiveAnalysisQuality(imageRecord, imageIndex);
    const qualityLabel = configuredQuality === 'auto'
      ? `Auto → ${effectiveQuality === 'high' ? 'haute' : 'éco'}`
      : effectiveQuality === 'high' ? 'Haute' : 'Éco';
    meta.textContent = `${imageRecord.width || '?'} × ${imageRecord.height || '?'} · ${qualityLabel}`;

    const actions = document.createElement('div');
    actions.className = 'image-thumb-actions';

    const cropButton = document.createElement('button');
    cropButton.type = 'button';
    cropButton.className = 'btn btn-muted image-thumb-action-btn';
    cropButton.textContent = 'Cropper';
    cropButton.addEventListener('click', (event) => {
      stopEvent(event);
      openCropForImage(prefix, imageIndex);
    });

    const duplicateButton = document.createElement('button');
    duplicateButton.type = 'button';
    duplicateButton.className = 'btn btn-accent image-thumb-action-btn';
    duplicateButton.textContent = 'Dupliquer';
    duplicateButton.addEventListener('click', (event) => {
      stopEvent(event);
      duplicateImageAt(imageIndex, prefix);
    });

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'btn btn-error image-thumb-action-btn image-thumb-action-btn-danger';
    removeButton.innerHTML = global.PipelineUIIcons?.renderIcon('close') || 'Retirer';
    removeButton.title = 'Retirer';
    removeButton.addEventListener('click', (event) => {
      stopEvent(event);
      removeImageAt(imageIndex, prefix);
    });

    actions.appendChild(cropButton);
    actions.appendChild(duplicateButton);
    actions.appendChild(removeButton);
    body.appendChild(name);
    body.appendChild(meta);
    body.appendChild(actions);
    card.appendChild(previewWrap);
    card.appendChild(body);

    return card;
  };

  const clearAllImages = async (prefix) => {
    const state = getState();
    if (!state?.images?.[prefix]) return;
    if (!state.images[prefix].length) return;

    destroyThumbSortable(prefix);
    state.images[prefix] = [];
    renderThumbs(prefix);
    await imageDb().clearWorkspaceImages?.(prefix);
  };

  const reorderImagesFromGrid = async (prefix, grid) => {
    const state = getState();
    const images = Array.isArray(state?.images?.[prefix]) ? state.images[prefix] : [];
    if (!grid || images.length < 2) return false;

    const imageMap = new Map(
      images.map((imageRecord, index) => [
        String(imageRecord.id || `${prefix}-${index}`),
        imageRecord,
      ])
    );

    const orderedIds = [...grid.querySelectorAll('[data-image-thumb-id]')]
      .map((node) => String(node.dataset.imageThumbId || '').trim())
      .filter(Boolean);

    if (orderedIds.length !== images.length) return false;

    const nextImages = orderedIds
      .map((id) => imageMap.get(id))
      .filter(Boolean);

    if (nextImages.length !== images.length) return false;

    state.images[prefix] = nextImages;
    const autoIndexes = nextImages
      .map((imageRecord, index) => (String(imageRecord.aiAnalysisQuality || 'auto') === 'auto' ? index : -1))
      .filter((index) => index >= 0);
    if (autoIndexes.length) {
      for (const index of autoIndexes) {
        await updateImageAnalysisQuality(prefix, index, 'auto');
      }
    } else {
      await persistImages(prefix);
    }
    return true;
  };

  const setupThumbSortable = (prefix, grid) => {
    const state = getState();
    const SortableCtor = getSortableCtor();
    const imageCount = Array.isArray(state?.images?.[prefix]) ? state.images[prefix].length : 0;

    destroyThumbSortable(prefix);
    if (!grid || !SortableCtor || imageCount < 2) return;

    grid.classList.add('is-sortable');
    const sortable = SortableCtor.create(grid, {
      animation: 180,
      draggable: '.image-thumb-card[data-image-thumb-id]',
      ghostClass: 'image-thumb-sortable-ghost',
      chosenClass: 'image-thumb-sortable-chosen',
      dragClass: 'image-thumb-sortable-drag',
      onEnd: async () => {
        const didReorder = await reorderImagesFromGrid(prefix, grid);
        if (!didReorder) return;
        global.showToast?.('Ordre des images mis a jour');
        renderThumbs(prefix);
      },
    });

    sortableByPrefix.set(prefix, sortable);
  };

  const renderThumbs = (prefix) => {
    const state = getState();
    if (!state?.images?.[prefix]) return;

    const strip = document.getElementById(`thumbStrip-${prefix}`);
    const placeholder = document.getElementById(`dzPlaceholder-${prefix}`);
    if (!strip) return;

    strip.innerHTML = '';
    strip.classList.add('image-thumb-strip');

    const hasImages = state.images[prefix].length > 0;
    if (placeholder) placeholder.style.display = hasImages ? 'none' : '';
    if (!hasImages) {
      destroyThumbSortable(prefix);
      return;
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'image-thumb-toolbar';
    toolbar.addEventListener('click', stopEvent);

    const count = document.createElement('span');
    count.className = 'image-thumb-toolbar-count';
    count.textContent = `${state.images[prefix].length} image(s)`;

    const toolbarActions = document.createElement('div');
    toolbarActions.className = 'image-thumb-toolbar-actions';
    toolbarActions.addEventListener('click', stopEvent);

    const debugButton = document.createElement('button');
    debugButton.type = 'button';
    debugButton.className = 'btn btn-muted btn-xs-inline image-thumb-debug-btn';
    debugButton.textContent = 'Debug payload';
    debugButton.addEventListener('click', (event) => {
      stopEvent(event);
      openPayloadDebug(prefix);
    });

    const clearAllButton = document.createElement('button');
    clearAllButton.type = 'button';
    clearAllButton.className = 'btn btn-error btn-xs-inline image-thumb-clear-all-btn';
    clearAllButton.textContent = 'Tout supprimer';
    clearAllButton.addEventListener('click', async (event) => {
      stopEvent(event);
      await clearAllImages(prefix);
    });

    toolbar.appendChild(count);
    toolbarActions.appendChild(debugButton);
    toolbarActions.appendChild(clearAllButton);
    toolbar.appendChild(toolbarActions);

    const grid = document.createElement('div');
    grid.className = 'image-thumb-grid';
    grid.addEventListener('click', stopEvent);

    state.images[prefix].forEach((imageRecord, imageIndex) => {
      grid.appendChild(renderThumbCard(imageRecord, imageIndex, prefix));
    });

    strip.appendChild(toolbar);
    strip.appendChild(grid);
    setupThumbSortable(prefix, grid);
  };

  const removeImageAt = async (imageIndex, prefix) => {
    const state = getState();
    if (!state?.images?.[prefix]) return;

    state.images[prefix].splice(imageIndex, 1);
    renderThumbs(prefix);

    if (state.images[prefix].length === 0) {
      await imageDb().clearWorkspaceImages?.(prefix);
      return;
    }

    await persistImages(prefix);
  };

  global.PipelineUIImages = {
    clearAllImages,
    setupImageHandlers,
    processImages,
    renderThumbs,
    resetAIAnalysisDefaults,
    updateImageAnalysisQuality,
  };

  global.PipelineUI.images = global.PipelineUI.images || {};
  Object.assign(global.PipelineUI.images, global.PipelineUIImages);
  global.addEventListener('pipeline:ai-profile-change', () => {
    resetAIAnalysisDefaults({ notify: true }).catch((error) => {
      logger?.warn?.('Reset AI image settings failed', error);
    });
  });
})(window);
