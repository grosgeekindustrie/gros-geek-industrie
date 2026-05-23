(function initPipelineUIEtsyRuntimeWorkspace(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};
  const EtsyData = global.PipelineUIEtsyData || {};
  const CATEGORY_PICKER_OVERLAY_ID = 'etsyCategoryPickerOverlay';

  function applyPipelineSeedToWorkspaceState(state, seed) {
    if (!state?.mediaPayload?.data) return;
    if (!seed) return;

    if (seed.title && state.detailsDraft) {
      state.detailsDraft = {
        ...state.detailsDraft,
        title: seed.title,
      };
    }

    if (seed.tagsCsv && state.attributesDraft) {
      state.attributesDraft = {
        ...state.attributesDraft,
        tags: EtsyData.parseAttributeTagsInput?.(seed.tagsCsv) || state.attributesDraft.tags || [],
      };
    }

    if (seed.descriptionText && state.detailsDraft) {
      state.detailsDraft = {
        ...state.detailsDraft,
        description: String(seed.descriptionText || '').trim(),
      };
    }
  }

  function importPipelineSeedToWorkspace(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    if (!state?.mediaPayload?.data) {
      deps.setStatus?.(prefix, 'Charge d abord une fiche source avant de recuperer les donnees du pipeline.');
      global.showToast?.('Charge d abord une fiche source', '#ff4757');
      return;
    }

    const seed = deps.getPipelineSeedForEtsy?.(prefix);
    if (!seed) {
      deps.setStatus?.(prefix, 'Aucune sortie pipeline persistante detectee pour ce contexte.');
      global.showToast?.('Aucune donnee pipeline disponible', '#ff4757');
      return;
    }

    const selectedMediaKeys = deps.getSelectedPipelineAltMediaKeys?.(prefix) || [];
    applyPipelineSeedToWorkspaceState(state, seed);
    let appliedAltCount = 0;
    if (seed.altText && selectedMediaKeys.length) {
      selectedMediaKeys.forEach((mediaKey) => {
        const mediaItem = deps.getMediaItemByKey?.(state, mediaKey);
        if (!mediaItem || mediaItem.kind !== 'image') return;
        mediaItem.value.alt_text = seed.altText;
        appliedAltCount += 1;
      });
    }
    deps.applyDetailsDraftToPayload?.(state);
    deps.applyAttributesDraftToPayload?.(state);
    deps.syncPayloadText?.(state);
    deps.renderWorkspace?.(prefix);
    deps.setStatus?.(prefix, appliedAltCount > 0
      ? `Titre, tags, description et ALT recuperes depuis le pipeline (${appliedAltCount} image(s)).`
      : 'Titre, tags et description recuperes depuis le pipeline.'
    );
    global.showToast?.(appliedAltCount > 0 ? 'Donnees pipeline injectees avec ALT' : 'Donnees pipeline injectees');
  }

  function applyDetailsDraftToPayload(state) {
    const data = state?.mediaPayload?.data;
    const draft = state?.detailsDraft;
    if (!data || !draft) return;

    data.title = String(draft.title || '').trim();
    data.description = String(draft.description || '');

    const categoryPathParts = EtsyData.splitCategoryPath?.(draft.categoryPathText || '') || [];
    if (categoryPathParts.length) {
      data.taxonomy_path = [...categoryPathParts];
      if (Array.isArray(data.category_path) || typeof data.category_path === 'string') {
        data.category_path = [...categoryPathParts];
      }
    }
  }

  function ensureDetailsDraft(state) {
    if (!state) return null;
    if (!state.detailsDraft) {
      state.detailsDraft = EtsyData.buildDetailsDraftFromPayload?.(state.mediaPayload) || null;
      applyDetailsDraftToPayload(state);
    }
    return state.detailsDraft;
  }

  function updateDetailsDraft(prefix, patch, deps = {}) {
    const state = deps.getState?.(prefix) || global.PipelineUIEtsyRuntime?.getWorkspaceState?.(prefix);
    if (!state) return;

    const draft = ensureDetailsDraft(state);
    state.detailsDraft = {
      ...draft,
      ...patch,
    };
    applyDetailsDraftToPayload(state);
    (deps.syncPayloadText || global.PipelineUIEtsyRuntime?.syncPayloadText)?.(state);
    (deps.syncWorkspacePayloadView || global.PipelineUIEtsyRuntime?.syncWorkspacePayloadView)?.(prefix);
  }

  function destroySortable(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    if (!state?.sortable) return;

    state.sortable.destroy();
    state.sortable = null;
  }

  function getEditedImageDataUrl(prefix, mediaKey, deps = {}) {
    const state = deps.getState?.(prefix);
    return String(state?.editedImageDataUrls?.[mediaKey] || '');
  }

  function getSavedEditorDesignState(prefix, mediaKey, deps = {}) {
    const state = deps.getState?.(prefix);
    return state?.editorDesignStates?.[mediaKey] || null;
  }

  function setEditedImageState(prefix, mediaKey, imageDataUrl, designState, deps = {}) {
    const state = deps.getState?.(prefix);
    if (!state || !mediaKey) return;

    if (imageDataUrl) {
      state.editedImageDataUrls[mediaKey] = imageDataUrl;
    } else {
      delete state.editedImageDataUrls[mediaKey];
    }

    if (designState) {
      state.editorDesignStates[mediaKey] = designState;
    } else {
      delete state.editorDesignStates[mediaKey];
    }
  }

  function clearEditedImageState(prefix, mediaKey, deps = {}) {
    setEditedImageState(prefix, mediaKey, '', null, deps);
    const state = deps.getState?.(prefix);
    if (state?.editorSourceUrls) {
      delete state.editorSourceUrls[mediaKey];
    }
  }

  function resetWorkspaceEditedImages(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    if (!state) return;
    state.editedImageDataUrls = {};
    state.editorDesignStates = {};
    state.editorSourceUrls = {};
  }

  function getDisplayImageSource(prefix, mediaKey, image, isLocal, deps = {}) {
    return getEditedImageDataUrl(prefix, mediaKey, deps) || deps.getImagePreviewSource?.(image, isLocal) || '';
  }

  function syncWorkspacePayloadView(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    const nodes = deps.getNodes?.(prefix);
    if (!state || !nodes?.payload) return;
    deps.ensureWorkspaceSourcePanel?.(prefix);
    nodes.payload.textContent = state.payloadText || 'Aucun payload charge.';
  }

  function updateToolbarCount(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    const nodes = deps.getNodes?.(prefix);
    const countNode = nodes?.strip?.querySelector?.('.image-thumb-toolbar-count');
    if (!state || !countNode) return;

    const images = Array.isArray(state.mediaPayload?.data?.images) ? state.mediaPayload.data.images : [];
    const videos = Array.isArray(state.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos : [];
    const localImages = Array.isArray(state.localImages) ? state.localImages : [];
    countNode.textContent = `${images.length + localImages.length} image(s) - ${videos.length} video(s)`;
  }

  function syncWorkspacePanels(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    const nodes = deps.getNodes?.(prefix);
    if (!state || !nodes?.panel) return;

    if (nodes.payload) nodes.payload.textContent = state.payloadText || 'Aucun payload charge.';
    deps.renderSummary?.(prefix, state.mediaPayload);
    deps.renderDetailsStep?.(prefix);
    deps.renderAttributesStep?.(prefix);
    deps.renderPublicationStep?.(prefix);
    updateToolbarCount(prefix, deps);
  }

  function refreshSortableBinding(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    const nodes = deps.getNodes?.(prefix);
    const grid = nodes?.strip?.querySelector?.('.etsy-api-media-grid');
    const imageCount = Array.isArray(state?.mediaPayload?.data?.images) ? state.mediaPayload.data.images.length : 0;
    const localImageCount = Array.isArray(state?.localImages) ? state.localImages.length : 0;
    const videoCount = Array.isArray(state?.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos.length : 0;
    const mediaCount = imageCount + localImageCount + videoCount;

    if (!grid || mediaCount < 2) {
      deps.destroySortable?.(prefix);
      return;
    }

    if (!state?.sortable) deps.setupSortable?.(prefix, grid);
  }

  async function resolveDraftCategoryLabel(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    const draft = state?.detailsDraft;
    if (!state || !draft || !draft.taxonomyId) return;
    if (draft.categoryPathText && draft.categoryPathText.includes('>')) return;
    if (draft.categoryLabel && !/^Taxonomy\\s+\\d+$/i.test(draft.categoryLabel)) return;

    try {
      const [entry] = await deps.fetchTaxonomySearch?.(prefix, {
        taxonomyId: draft.taxonomyId,
        limit: 1,
      }) || [];
      if (!entry) return;

      state.detailsDraft = {
        ...draft,
        categoryLabel: entry.name,
        categoryPathText: entry.path_text,
      };
      deps.applyDetailsDraftToPayload?.(state);
      deps.syncPayloadText?.(state);
      deps.syncWorkspacePayloadView?.(prefix);
      deps.renderDetailsStep?.(prefix);
    } catch (error) {}
  }

  function getCategoryPickerState() {
    return global.PipelineUIEtsyWorkspace?.categoryPickerState || null;
  }

  function renderCategoryPickerResults(entries, deps = {}) {
    const resultsNode = deps.getNode?.('etsyCategoryPickerResults');
    const statusNode = deps.getNode?.('etsyCategoryPickerStatus');
    if (!resultsNode || !statusNode) return;

    if (!entries.length) {
      resultsNode.innerHTML = '<div class="etsy-category-picker-empty">Aucune categorie Etsy trouvee pour cette recherche.</div>';
      statusNode.textContent = 'Aucune categorie correspondante.';
      return;
    }

    resultsNode.innerHTML = entries.map((entry) => `
      <button class="etsy-category-picker-item" type="button" data-js="etsy-category-picker-select" data-taxonomy-id="${entry.taxonomy_id}">
        <span class="etsy-category-picker-item-title">${entry.name}</span>
        <span class="etsy-category-picker-item-meta">${entry.path_text}</span>
      </button>
    `).join('');
    statusNode.textContent = `${entries.length} suggestion(s) Etsy.`;

    resultsNode.querySelectorAll('[data-js="etsy-category-picker-select"]').forEach((button) => {
      button.addEventListener('click', () => {
        const pickerState = getCategoryPickerState();
        const prefix = pickerState?.prefix;
        const workspaceState = deps.getState?.(prefix);
        if (!prefix || !workspaceState) return;

        const entry = workspaceState.taxonomyLookup[String(button.dataset.taxonomyId || '').trim()];
        if (!entry) return;

        deps.updateDetailsDraft?.(prefix, {
          taxonomyId: entry.taxonomy_id,
          categoryLabel: entry.name,
          categoryPathText: entry.path_text,
        });
        workspaceState.isEditingCategory = false;
        deps.renderDetailsStep?.(prefix);
        deps.closeCategoryPickerOverlay?.();
      });
    });
  }

  async function runCategoryPickerSearch(query, deps = {}) {
    const pickerState = getCategoryPickerState();
    const prefix = pickerState?.prefix;
    const statusNode = deps.getNode?.('etsyCategoryPickerStatus');
    if (!prefix || !statusNode) return;

    const state = deps.getState?.(prefix);
    if (!state) return;
    state.taxonomySearchQuery = String(query || '').trim();
    statusNode.textContent = 'Recherche des categories Etsy...';

    try {
      const entries = await deps.fetchTaxonomySearch?.(prefix, {
        query: state.taxonomySearchQuery,
        limit: 18,
      });
      state.taxonomySearchResults = entries;
      renderCategoryPickerResults(entries, deps);
    } catch (error) {
      const resultsNode = deps.getNode?.('etsyCategoryPickerResults');
      if (resultsNode) {
        resultsNode.innerHTML = '<div class="etsy-category-picker-empty">Recherche categorie impossible.</div>';
      }
      statusNode.textContent = `Recherche impossible : ${error.message}`;
    }
  }

  async function openCategoryPicker(prefix, deps = {}) {
    deps.ensureCategoryPickerOverlay?.();
    const overlay = deps.getNode?.(deps.CATEGORY_PICKER_OVERLAY_ID || CATEGORY_PICKER_OVERLAY_ID);
    const input = deps.getNode?.('etsyCategoryPickerInput');
    const state = deps.getState?.(prefix);
    const draft = state?.detailsDraft || deps.ensureDetailsDraft?.(state);
    if (!overlay || !input || !state || !draft) return;

    global.PipelineUIEtsyWorkspace.categoryPickerState = { prefix };
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');

    input.value = draft.categoryLabel || draft.categoryPathText || '';
    input.focus();
    input.select();
    await runCategoryPickerSearch(input.value, deps);
  }

  function renderWorkspace(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    const nodes = deps.getNodes?.(prefix);
    if (!state || !nodes?.panel) return;

    deps.ensureWorkspaceSourcePanel?.(prefix);
    if (nodes.payload) {
      nodes.payload.textContent = state.payloadText || 'Aucun payload charge.';
    }
    deps.renderSummary?.(prefix, state.mediaPayload);
    deps.renderDetailsStep?.(prefix);
    deps.renderAttributesStep?.(prefix);
    deps.renderPublicationStep?.(prefix);

    if (state.mediaPayload || state.localImages.length) {
      deps.renderMediaGrid?.(prefix, state.mediaPayload);
      deps.setWorkspaceActiveStep?.(prefix, state.activeStep || 'media');
      const activeItem = state.activeMediaKey ? deps.getMediaItemByKey?.(state, state.activeMediaKey) : null;
      if (activeItem) deps.fillMediaLightbox?.(prefix, state.activeMediaKey);
      return;
    }

    deps.renderPlaceholder?.(
      prefix,
      'Charge une fiche source Etsy, puis exploite ici les medias deja presents dans le workspace.'
    );
  }

  async function loadEtsyWorkspaceMedia(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    const nodes = deps.getNodes?.(prefix);
    if (!state || !nodes?.input) return;

    const listingId = deps.extractListingId?.(nodes.input.value);
    if (!listingId) {
      deps.setStatus?.(prefix, 'Listing ID introuvable dans la reference fournie.');
      global.showToast?.('Listing Etsy introuvable', '#ff4757');
      deps.renderWorkspace?.(prefix);
      return;
    }

    deps.setStatus?.(prefix, `Chargement de la fiche source ${listingId}...`);

    try {
      const payload = await deps.fetchListingPayload?.(listingId);
      let listingPropertiesPayload = null;
      let listingPropertiesError = '';
      try {
        listingPropertiesPayload = await deps.fetchListingPropertiesPayload?.(listingId);
      } catch (error) {
        listingPropertiesError = String(error?.message || 'Lecture listing/properties impossible');
      }
      if (deps.getActiveEditorSession?.()?.prefix === prefix) deps.closeImageEditorOverlay?.();
      deps.closeCategoryPickerOverlay?.();
      state.listingId = listingId;
      state.payloadEnvelope = payload || null;
      state.listingPropertiesPayload = listingPropertiesPayload || null;
      state.listingPropertiesError = listingPropertiesError;
      state.mediaPayload = deps.normalizeListingPayload?.(payload?.payload || null);
      if (listingPropertiesPayload) {
        state.mediaPayload = deps.applyListingPropertyOverrides?.(state.mediaPayload, listingPropertiesPayload) || state.mediaPayload;
      }
      state.activeStep = 'media';
      state.detailsDraft = deps.buildDetailsDraftFromPayload?.(state.mediaPayload);
      state.attributesDraft = deps.buildAttributesDraftFromPayload?.(state.mediaPayload);
      state.isEditingCategory = false;
      state.publicationSubmitting = false;
      state.publicationResult = null;
      state.publicationError = '';
      state.mediaOrder = [];
      state.localImages = [];
      state.activeMediaKey = '';
      deps.resetWorkspaceEditedImages?.(prefix);
      deps.applyDetailsDraftToPayload?.(state);
      deps.applyAttributesDraftToPayload?.(state);
      state.mediaOrder = deps.buildDefaultMediaOrder?.(state) || [];
      deps.syncPayloadText?.(state);

      const imageCount = Array.isArray(state.mediaPayload?.data?.images) ? state.mediaPayload.data.images.length : 0;
      const videoCount = Array.isArray(state.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos.length : 0;
      deps.setStatus?.(prefix, `Fiche source ${listingId} chargee - ${imageCount} image(s) - ${videoCount} video(s).`);
      deps.renderWorkspace?.(prefix);
      global.showToast?.('Fiche Etsy source chargee');
    } catch (error) {
      deps.destroySortable?.(prefix);
      if (deps.getActiveEditorSession?.()?.prefix === prefix) deps.closeImageEditorOverlay?.();
      deps.closeCategoryPickerOverlay?.();
      state.payloadEnvelope = null;
      state.mediaPayload = null;
      state.payloadText = '';
      state.listingPropertiesPayload = null;
      state.listingPropertiesError = '';
      state.activeStep = 'media';
      state.detailsDraft = null;
      state.attributesDraft = null;
      state.isEditingCategory = false;
      state.publicationSubmitting = false;
      state.publicationResult = null;
      state.publicationError = '';
      state.mediaOrder = [];
      state.localImages = [];
      state.activeMediaKey = '';
      deps.resetWorkspaceEditedImages?.(prefix);
      deps.setStatus?.(prefix, `Lecture Etsy impossible : ${error.message}`);
      deps.renderWorkspace?.(prefix);
      global.showToast?.(`Etsy API : ${error.message}`, '#ff4757');
    }
  }

  async function copyEtsyWorkspacePayload(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
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
  }

  function initEtsyWorkspaceContext(prefix, deps = {}) {
    const nodes = deps.getNodes?.(prefix);
    if (!nodes?.panel || !nodes?.input) return;

    if (nodes.panel.dataset.etsyWorkspaceBound === 'true') {
      deps.renderWorkspace?.(prefix);
      return;
    }
    nodes.panel.dataset.etsyWorkspaceBound = 'true';

    deps.ensureWorkspaceSourcePanel?.(prefix);
    deps.configureWorkspaceProgress?.(prefix);

    const uploadInput = deps.ensureUploadInput?.(prefix);
    uploadInput?.addEventListener('change', async (event) => {
      const files = Array.from(event.target.files || []);
      await deps.addLocalImages?.(prefix, files);
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
      await deps.addLocalImages?.(prefix, files);
    });

    nodes.input.addEventListener('input', () => {
      deps.saveListingReference?.(prefix, nodes.input.value);
      const listingId = deps.extractListingId?.(nodes.input.value);
      if (!listingId) {
        deps.setStatus?.(prefix, 'En attente dune fiche source.');
        return;
      }
      deps.setStatus?.(prefix, `Reference detectee - listing ${listingId}`);
    });

    nodes.input.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      await deps.loadEtsyWorkspaceMedia?.(prefix);
    });

    nodes.panel.addEventListener('click', async (event) => {
      const stepTrigger = event.target.closest('[data-js="etsy-step-trigger"][data-etsy-step]');
      if (stepTrigger && nodes.panel.contains(stepTrigger)) {
        deps.setWorkspaceActiveStep?.(prefix, stepTrigger.dataset.etsyStep || 'media');
        return;
      }

      const categoryToggle = event.target.closest('[data-js="etsy-category-edit-toggle"]');
      if (categoryToggle && nodes.panel.contains(categoryToggle)) {
        await deps.openCategoryPicker?.(prefix);
        return;
      }

      const importPipelineButton = event.target.closest('[data-js="etsy-pipeline-import"]');
      if (importPipelineButton && nodes.panel.contains(importPipelineButton)) {
        deps.importPipelineSeedToWorkspace?.(prefix);
        return;
      }

    });

    nodes.panel.addEventListener('input', (event) => {
      const titleInput = event.target.closest(`#etsyApiTitleInput-${prefix}`);
      if (titleInput && nodes.panel.contains(titleInput)) {
        deps.updateDetailsDraft?.(prefix, { title: String(titleInput.value || '') });
        deps.renderTitleCounter?.(prefix);
        return;
      }

      const descriptionInput = event.target.closest(`#etsyApiDescriptionInput-${prefix}`);
      if (descriptionInput && nodes.panel.contains(descriptionInput)) {
        deps.updateDetailsDraft?.(prefix, { description: String(descriptionInput.value || '') });
        deps.autoResizeDescription?.(prefix);
      }
    });

    const savedReference = deps.restoreListingReference?.(prefix);
    if (savedReference) {
      nodes.input.value = savedReference;
      const listingId = deps.extractListingId?.(savedReference);
      if (listingId) {
        deps.setStatus?.(prefix, `Reference detectee - listing ${listingId}`);
      }
    } else {
      deps.setStatus?.(prefix, 'En attente d\'une fiche source.');
    }

    deps.renderWorkspace?.(prefix);
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    destroySortable,
    getEditedImageDataUrl,
    getSavedEditorDesignState,
    setEditedImageState,
    clearEditedImageState,
    resetWorkspaceEditedImages,
    getDisplayImageSource,
    syncWorkspacePayloadView,
    updateToolbarCount,
    syncWorkspacePanels,
    refreshSortableBinding,
    applyDetailsDraftToPayload,
    ensureDetailsDraft,
    updateDetailsDraft,
    applyPipelineSeedToWorkspaceState,
    importPipelineSeedToWorkspace,
    resolveDraftCategoryLabel,
    getCategoryPickerState,
    renderCategoryPickerResults,
    runCategoryPickerSearch,
    openCategoryPicker,
    renderWorkspace,
    loadEtsyWorkspaceMedia,
    copyEtsyWorkspacePayload,
    initEtsyWorkspaceContext,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
