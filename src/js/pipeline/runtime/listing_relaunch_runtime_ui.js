'use strict';

(function initPipelineUIListingRelaunchRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};
  const RelaunchData = global.PipelineUIListingRelaunchData || {};

  const PIPELINE_PREFIXES = Object.freeze(['tt', 'col']);
  const DEFAULT_STATUS = "En attente d'une fiche Etsy source et d'une selection media.";
  const RELAUNCH_DESCRIPTION_PARTICULARITES_INSTRUCTION = [
    'Mode relance de fiche existante :',
    '- Ne jamais convertir les tags en "particularites".',
    '- Si aucune particularite n existe dans la fiche source, ne cree aucune particularite.',
    '- Si une particularite existe dans la fiche source, reprendre uniquement cette information, eventuellement reformulee.',
    '- Ne pas inventer de nouvelles particularites.',
    '- En cas de doute : aucune particularite.',
  ].join('\n');

  function ensureRootState() {
    global.state.pipelineListingRelaunch = global.state.pipelineListingRelaunch || {};
    PIPELINE_PREFIXES.forEach((prefix) => {
      if (!global.state.pipelineListingRelaunch[prefix]) {
        global.state.pipelineListingRelaunch[prefix] = createEmptyListingRelaunchState();
      }
    });
    return global.state.pipelineListingRelaunch;
  }

  function createEmptyListingRelaunchState() {
    return {
      active: false,
      source: null,
      status: DEFAULT_STATUS,
    };
  }

  function getPrefixState(prefix) {
    const root = ensureRootState();
    return root[String(prefix || '').trim()] || null;
  }

  function setStatus(prefix, message) {
    const state = getPrefixState(prefix);
    if (state) state.status = String(message || DEFAULT_STATUS);
    const node = document.getElementById(`etsyApiRelaunchStatus-${prefix}`);
    if (node) node.textContent = String(message || DEFAULT_STATUS);
  }

  function clearListingRelaunchContext(prefix) {
    const state = getPrefixState(prefix);
    if (!state) return;
    state.active = false;
    state.source = null;
    setStatus(prefix, DEFAULT_STATUS);
  }

  function getSelectedWorkspaceImages(prefix) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const workspace = runtime.getWorkspaceState?.(prefix);
    if (!workspace?.mediaPayload?.data) return [];

    const orderedItems = runtime.getOrderedMediaItems?.(workspace) || [];
    const selectedKeys = new Set(runtime.getSelectedPipelineAltMediaKeys?.(prefix) || []);
    const imageItems = orderedItems.filter((item) => item.kind === 'image');
    if (!imageItems.length) return [];

    return selectedKeys.size > 0
      ? imageItems.filter((item) => selectedKeys.has(item.key))
      : imageItems;
  }

  function getRelaunchOverrides(prefix) {
    const getValue = (field) => String(document.getElementById(`etsyApiRelaunch${field}-${prefix}`)?.value || '').trim();
    return {
      nom: getValue('Nom'),
      univers: getValue('Univers'),
      instructions: getValue('Instructions'),
    };
  }

  function readWorkspaceListingSource(prefix) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const etsyData = global.PipelineUIEtsyData || {};
    const workspace = runtime.getWorkspaceState?.(prefix);
    if (!workspace?.mediaPayload?.data) {
      throw new Error("Charge d'abord une fiche Etsy source.");
    }

    const detailsDraft = workspace.detailsDraft || etsyData.buildDetailsDraftFromPayload?.(workspace.mediaPayload) || {};
    const attributesDraft = workspace.attributesDraft || etsyData.buildAttributesDraftFromPayload?.(workspace.mediaPayload) || {};
    const images = getSelectedWorkspaceImages(prefix);
    if (!images.length) {
      throw new Error("Aucune image exploitable dans le workspace Etsy.");
    }

    const data = workspace.mediaPayload?.data || {};
    const propertyDimensions = etsyData.inferDimensionOverridesFromProperties?.(
      workspace.listingPropertiesPayload
    ) || {};

    return {
      listingId: String(workspace.listingId || workspace.mediaPayload?.data?.listing_id || '').trim(),
      title: String(detailsDraft.title || workspace.mediaPayload?.data?.title || '').trim(),
      description: String(detailsDraft.description || workspace.mediaPayload?.data?.description || ''),
      tags: Array.isArray(attributesDraft.tags)
        ? attributesDraft.tags.map((value) => String(value || '').trim()).filter(Boolean)
        : Array.isArray(workspace.mediaPayload?.data?.tags)
          ? workspace.mediaPayload.data.tags.map((value) => String(value || '').trim()).filter(Boolean)
          : [],
      images,
      selectedImageCount: images.length,
      usedSelection: (runtime.getSelectedPipelineAltMediaKeys?.(prefix) || []).length > 0,
      overrides: getRelaunchOverrides(prefix),
      inventory: data.inventory && typeof data.inventory === 'object' ? data.inventory : {},
      originHeight: Number(propertyDimensions.item_height || data.item_height || 0) || null,
    };
  }

  function dataUrlFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(String(event.target?.result || ''));
      reader.onerror = () => reject(new Error('Conversion image impossible'));
      reader.readAsDataURL(blob);
    });
  }

  async function resolveImageDataUrl(prefix, imageItem) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const source = runtime.getDisplayImageSource?.(prefix, imageItem.key, imageItem.value, imageItem.isLocal)
      || runtime.getImagePreviewSource?.(imageItem.value, imageItem.isLocal)
      || '';
    const normalizedSource = String(source || '').trim();
    if (!normalizedSource) throw new Error('Source image introuvable');
    if (/^data:/i.test(normalizedSource)) return normalizedSource;

    const sameOriginSource = imageItem.isLocal
      ? normalizedSource
      : await runtime.resolveRemoteEditorSource?.(prefix, imageItem.key, normalizedSource, {
        getState: runtime.getWorkspaceState,
        routes: runtime.getRoutes?.() || global.PipelineUIDataIntegrations?.etsyAuth?.routes || {},
      }) || normalizedSource;

    const response = await fetch(sameOriginSource);
    if (!response.ok) throw new Error(`Lecture image impossible (${response.status})`);
    const blob = await response.blob();
    return dataUrlFromBlob(blob);
  }

  async function convertWorkspaceImageToPipelineRecord(prefix, imageItem, index) {
    const imageTools = global.PipelineUIImageTools || {};
    const indexedDb = global.PipelineUIIndexedDb || {};
    const dataUrl = await resolveImageDataUrl(prefix, imageItem);
    const split = imageTools.splitDataUrl?.(dataUrl);
    if (!split?.base64 || !split?.mediaType) throw new Error('Data URL image invalide');

    const loadedImage = await imageTools.loadImageFromDataUrl?.(dataUrl);
    const targetWidth = index === 0 ? 1024 : 512;
    const variant = await imageTools.exportVariantFromSource?.({
      sourceBase64: split.base64,
      sourceMediaType: split.mediaType,
      sourceWidth: loadedImage?.naturalWidth || loadedImage?.width || 0,
      sourceHeight: loadedImage?.naturalHeight || loadedImage?.height || 0,
      targetWidth,
      outputMediaType: imageTools.getDefaultExportMediaType?.() || 'image/png',
    });

    return {
      id: indexedDb.createImageId?.() || `${Date.now()}-${index}`,
      name: String(imageItem.value?.name || `Etsy image ${index + 1}`),
      base64: variant.base64,
      mediaType: variant.mediaType,
      width: variant.width,
      height: variant.height,
      originalBase64: split.base64,
      originalMediaType: split.mediaType,
      originalWidth: loadedImage?.naturalWidth || loadedImage?.width || 0,
      originalHeight: loadedImage?.naturalHeight || loadedImage?.height || 0,
      cropRect: null,
      contentHash: '',
      anthropicFileId: '',
      anthropicContentHash: '',
      anthropicUploadedAt: '',
    };
  }

  async function syncPipelineImagesFromWorkspace(prefix, source) {
    const nextImages = [];
    for (let index = 0; index < source.images.length; index += 1) {
      nextImages.push(await convertWorkspaceImageToPipelineRecord(prefix, source.images[index], index));
    }

    global.state.images[prefix] = nextImages;
    global.PipelineUIImages?.renderThumbs?.(prefix);
    try {
      await global.PipelineUIIndexedDb?.saveWorkspaceImages?.(prefix, nextImages);
    } catch (error) {}
    return nextImages;
  }

  function buildListingRelaunchContext(prefix, options = {}) {
    const state = getPrefixState(prefix);
    if (!state?.active || !state.source) return null;

    const source = state.source;
    const sourceTags = Array.isArray(source.tags) ? source.tags : [];
    const sourceTagsCsv = sourceTags.join(', ');
    const overrides = source.overrides || {};
    const fallbackNom = String(overrides.nom || '').trim() || RelaunchData.buildListingNameFromTitle?.(source.title) || 'Figurine';
    const fallbackNomCourt = fallbackNom.split(/\s+/)[0] || fallbackNom;
    const description = String(source.description || '');
    const mode = String(options.mode || global.getPipelineModeByPrefix?.(prefix) || '').trim();
    const agentId = String(options.agentId || '').trim();

    const context = {
      nom: fallbackNom,
      nomCourt: fallbackNomCourt,
      univers: String(overrides.univers || '').trim(),
      sculpteur: '',
      echelles: '',
      pieces: '',
      dimensions: '',
      pose: '',
      notes: description,
      descriptionFigurine: description,
      resumePersonnage: description,
      particularites: sourceTagsCsv,
      consignesExternes: String(overrides.instructions || '').trim(),
      consignes_externes: String(overrides.instructions || '').trim(),
      relaunch_user_instruction: String(overrides.instructions || '').trim(),
      archetypes: '',
      seoElargies: '',
      medium: '',
      mediumSubcategories: '',
      medium_subcategories: '',
      genres: '',
      genresTransverses: '',
      genres_transverses: '',
      mediumContext: '',
      medium_context: '',
      license: 'non',
      type: '',
      typePiece: '',
      version: '',
      imageCount: Array.isArray(global.state?.images?.[prefix]) ? global.state.images[prefix].length : source.selectedImageCount,
      listing_source_mode: mode,
      listing_source_origin: 'etsy_relaunch',
      listing_source_listing_id: source.listingId,
      listing_source_title: source.title,
      listing_source_description: description,
      listing_source_tags: sourceTagsCsv,
      listing_source_tags_csv: sourceTagsCsv,
      listing_source_tags_count: sourceTags.length,
      listing_source_selected_images: String(source.selectedImageCount || 0),
      listing_source_selection_mode: source.usedSelection ? 'selected_only' : 'all_visible',
    };

    if (agentId === 'description') {
      context.relaunch_internal_instruction = RELAUNCH_DESCRIPTION_PARTICULARITES_INSTRUCTION;
    }

    return context;
  }

  function buildListingRelaunchFormSnapshot(prefix) {
    const state = getPrefixState(prefix);
    if (!state?.active || !state.source) return '';

    const source = state.source;
    const lines = [
      'Mode: relance_listing_etsy',
      `Listing Etsy: ${source.listingId || '-'}`,
      `Titre source: ${source.title || '-'}`,
      `Tags source: ${(source.tags || []).join(', ') || '-'}`,
      `Images source retenues: ${source.selectedImageCount || 0}`,
      `Selection images: ${source.usedSelection ? 'selection utilisateur' : 'toutes les images visibles'}`,
    ];
    if (source.overrides?.nom) lines.push(`Nom impose: ${source.overrides.nom}`);
    if (source.overrides?.univers) lines.push(`Univers impose: ${source.overrides.univers}`);
    if (source.overrides?.instructions) lines.push(`Instructions de relance: ${source.overrides.instructions}`);
    const description = String(source.description || '').replace(/\r\n?/g, '\n');
    if (description) lines.push(`Description source: ${description}`);
    return lines.join('\n');
  }

  function getPipelineScaleLabels(prefix) {
    const scalesApi = global.PipelineUIEchelles || {};
    if (prefix === 'col') return scalesApi.ECHELLES_COLLECTION || [];
    const shopKey = global.PipelineUIForms?.getActiveShopKey?.() || 'grosgeek';
    return shopKey === 'doublex'
      ? (scalesApi.ECHELLES_TABLETOP_DOUBLEX || scalesApi.ECHELLES || [])
      : (scalesApi.ECHELLES || []);
  }

  function clearRelaunchFormFields(prefix) {
    const suffixes = [
      'fNom',
      'fNomCourt',
      'fUnivers',
      'fSculpteur',
      'fPieces',
      'fDescriptionFigurine',
      'fNotes',
      'fResumePersonnage',
      'fPose',
      'fArchetypes',
      'fArchSeo',
      'fParticularites',
      'fConsignesExternes',
      'fConnexesPrioritaires',
      'fLienPerso',
    ];
    suffixes.forEach((suffix) => {
      const field = document.getElementById(`${prefix}-${suffix}`);
      if (field && !['SELECT', 'BUTTON'].includes(field.tagName)) field.value = '';
    });

    const checkboxSelectors = prefix === 'col'
      ? ['#col-fMediumGroup input', '#col-fMediumSubcategoriesGroup input', '#col-fGenreGroup input']
      : ['#tt-fGenreGroup input'];
    checkboxSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((checkbox) => {
        checkbox.checked = false;
      });
    });

    if (prefix === 'col') {
      const license = document.getElementById('col-fLicense');
      const buzz = document.getElementById('col-fBuzzCollection');
      if (license) license.checked = false;
      if (buzz) buzz.checked = false;
      global.toggleLicense?.({ shouldSave: false });
      global.toggleBuzzCollection?.({ shouldSave: false });
      global.renderCollectionMediumMeta?.({ shouldSave: false });
    } else {
      const buzz = document.getElementById('tt-fBuzz');
      if (buzz) buzz.checked = false;
      global.toggleBuzz?.('tt');
    }
  }

  function setFormValue(prefix, suffix, value = '') {
    const field = document.getElementById(`${prefix}-${suffix}`);
    if (field) field.value = String(value || '').trim();
  }

  function applyScalePrefill(prefix, prefill) {
    const scalesApi = global.PipelineUIEchelles || {};
    const labels = getPipelineScaleLabels(prefix);
    scalesApi.setDynamicEchellesEnabled?.(false, { shouldSave: false });

    labels.forEach((_, index) => {
      const checkbox = document.getElementById(`${prefix}-ec${index}`);
      const dimensionInput = document.getElementById(`${prefix}-ed${index}`);
      if (checkbox) checkbox.checked = false;
      if (dimensionInput) dimensionInput.value = '';
      scalesApi.setRowDimensionSource?.(index, '');
      scalesApi.toggleEch?.(index, { shouldSave: false, autoFill: false });
    });

    const selectedRows = [];
    labels.forEach((label, index) => {
      const scale = prefill.scales.get(RelaunchData.normalizeScaleLabel?.(label));
      if (!scale) return;
      const checkbox = document.getElementById(`${prefix}-ec${index}`);
      const dimensionInput = document.getElementById(`${prefix}-ed${index}`);
      if (!checkbox || !dimensionInput) return;

      checkbox.checked = true;
      dimensionInput.value = scale.dimensions;
      scalesApi.toggleEch?.(index, { shouldSave: false, autoFill: false });
      scalesApi.setRowDimensionSource?.(index, 'manual');
      selectedRows.push({ index, dimensions: scale.dimensions });
    });

    scalesApi.setDynamicEchellesEnabled?.(true, { shouldSave: false });

    if (prefill.originHeight) {
      const origin = selectedRows.find((entry) => {
        const height = Number.parseFloat(String(entry.dimensions || '').replace(',', '.'));
        return Number.isFinite(height) && Math.abs(height - prefill.originHeight) <= 1;
      });
      if (origin) {
        scalesApi.setEchelleOrigin?.(origin.index, { shouldSave: false, recalculate: false });
      }
    }

    const pricingState = global.PipelineUIPricing?.serialize?.(prefix) || {};
    global.PipelineUIPricing?.restore?.(prefix, {
      calculator: pricingState.calculator || {},
      rows: {},
    });

    return selectedRows.length;
  }

  function applyListingPrefillToForm(prefix, prefill) {
    clearRelaunchFormFields(prefix);
    setFormValue(prefix, 'fNom', prefill.fullName);
    setFormValue(prefix, 'fNomCourt', prefill.shortName);
    setFormValue(prefix, 'fUnivers', prefill.universe);
    setFormValue(prefix, 'fSculpteur', prefill.sculptor);
    setFormValue(prefix, 'fPieces', prefill.pieces);
    setFormValue(prefix, 'fConsignesExternes', prefill.instructions);
    const selectedScaleCount = applyScalePrefill(prefix, prefill);
    global.saveFormState?.();
    return selectedScaleCount;
  }

  async function runEtsyListingRelaunch(prefix) {
    const normalizedPrefix = String(prefix || '').trim();
    const prefixState = getPrefixState(normalizedPrefix);
    if (!prefixState) return;

    try {
      setStatus(normalizedPrefix, 'Preparation du formulaire depuis Etsy...');
      const source = readWorkspaceListingSource(normalizedPrefix);
      if (!source.usedSelection || source.selectedImageCount !== 4) {
        throw new Error('Selectionne exactement 4 images dans le workspace Etsy.');
      }

      const prefill = RelaunchData.buildFormPrefill?.(source);
      if (!prefill) throw new Error('Extracteur de fiche Etsy indisponible.');
      await syncPipelineImagesFromWorkspace(normalizedPrefix, source);
      const route = normalizedPrefix === 'col' ? 'collection' : 'tabletop';
      global.openAppRoute?.(route);
      const selectedScaleCount = applyListingPrefillToForm(normalizedPrefix, prefill);

      prefixState.active = false;
      prefixState.source = null;
      setStatus(
        normalizedPrefix,
        `Formulaire prepare - 4 images et ${selectedScaleCount} echelle(s) recuperees.`
      );
      global.showToast?.(
        `Formulaire pre-rempli depuis Etsy : verifie les champs avant de lancer le pipeline.`,
        '#4caf7d',
        5000
      );
      global.scrollTo?.({ top: 0, behavior: 'smooth' });
    } catch (error) {
      prefixState.active = false;
      prefixState.source = null;
      setStatus(normalizedPrefix, `Preparation impossible : ${error.message}`);
      global.showToast?.(`Preparation du formulaire impossible : ${error.message}`, '#ff4757', 4000);
    }
  }

  global.PipelineUIListingRelaunch = {
    createEmptyListingRelaunchState,
    getListingRelaunchState: getPrefixState,
    clearListingRelaunchContext,
    buildListingRelaunchContext,
    buildListingRelaunchFormSnapshot,
    buildFormPrefill: RelaunchData.buildFormPrefill,
    applyListingPrefillToForm,
    runEtsyListingRelaunch,
  };

  Object.assign(global, global.PipelineUIListingRelaunch);
})(window);
