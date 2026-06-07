'use strict';

(function initPipelineUIListingRelaunchRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};

  const PIPELINE_PREFIXES = Object.freeze(['tt', 'col']);
  const DEFAULT_STATUS = "En attente d'une fiche Etsy source et d'une selection media.";

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

  function buildListingRelaunchNom(title = '') {
    const normalized = String(title || '').trim();
    if (!normalized) return 'Figurine';
    const head = normalized.replace(/\s+/g, ' ').split(/[,:|/-]/)[0].trim();
    return head.slice(0, 80) || normalized;
  }

  function buildListingRelaunchContext(prefix, options = {}) {
    const state = getPrefixState(prefix);
    if (!state?.active || !state.source) return null;

    const source = state.source;
    const sourceTags = Array.isArray(source.tags) ? source.tags : [];
    const sourceTagsCsv = sourceTags.join(', ');
    const fallbackNom = buildListingRelaunchNom(source.title);
    const fallbackNomCourt = fallbackNom.split(/\s+/)[0] || fallbackNom;
    const description = String(source.description || '');
    const mode = String(options.mode || global.getPipelineModeByPrefix?.(prefix) || '').trim();

    return {
      nom: fallbackNom,
      nomCourt: fallbackNomCourt,
      univers: '',
      sculpteur: '',
      echelles: '',
      pieces: '',
      dimensions: '',
      pose: '',
      notes: description,
      descriptionFigurine: description,
      resumePersonnage: description,
      particularites: sourceTagsCsv,
      consignesExternes: '',
      consignes_externes: '',
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
    const description = String(source.description || '').trim();
    if (description) lines.push(`Description source: ${description}`);
    return lines.join('\n');
  }

  async function runEtsyListingRelaunch(prefix) {
    const normalizedPrefix = String(prefix || '').trim();
    const prefixState = getPrefixState(normalizedPrefix);
    if (!prefixState) return;

    try {
      setStatus(normalizedPrefix, 'Preparation de la relance pipeline depuis Etsy...');
      const source = readWorkspaceListingSource(normalizedPrefix);
      await syncPipelineImagesFromWorkspace(normalizedPrefix, source);

      prefixState.active = true;
      prefixState.source = source;
      setStatus(
        normalizedPrefix,
        source.usedSelection
          ? `Relance prete - ${source.selectedImageCount} image(s) selectionnee(s) envoyee(s) au pipeline.`
          : `Relance prete - ${source.selectedImageCount} image(s) visible(s) envoyee(s) au pipeline.`
      );

      await global.runPipelineWithCacheAware?.(normalizedPrefix);
    } catch (error) {
      prefixState.active = false;
      prefixState.source = null;
      setStatus(normalizedPrefix, `Relance impossible : ${error.message}`);
      global.showToast?.(`Relance pipeline impossible : ${error.message}`, '#ff4757', 4000);
    }
  }

  global.PipelineUIListingRelaunch = {
    createEmptyListingRelaunchState,
    getListingRelaunchState: getPrefixState,
    clearListingRelaunchContext,
    buildListingRelaunchContext,
    buildListingRelaunchFormSnapshot,
    runEtsyListingRelaunch,
  };

  Object.assign(global, global.PipelineUIListingRelaunch);
})(window);
