'use strict';

(function initPipelineUIEtsyWorkspace(global) {
  global.PipelineUI = global.PipelineUI || {};

  const EtsyData = global.PipelineUIEtsyData || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};
  const ROUTES = EtsyRuntime.getRoutes?.() || global.PipelineUIDataIntegrations?.etsyAuth?.routes || {};
  const LIGHTBOX_ID = 'etsyMediaLightbox';
  const IMAGE_EDITOR_OVERLAY_ID = 'etsyImageEditorOverlay';
  const CATEGORY_PICKER_OVERLAY_ID = 'etsyCategoryPickerOverlay';
  const OPTIONS_MODAL_ID = 'etsyOptionsModal';
  const OPTIONS_TYPE_PICKER_ID = 'etsyOptionsTypePicker';
  const OPTIONS_EDITOR_ID = 'etsyOptionsEditor';
  const CUSTOM_VARIATION_PROPERTY_IDS = EtsyData.CUSTOM_VARIATION_PROPERTY_IDS || ['513', '514'];
  const OPTION_TYPE_SUGGESTIONS = [
    'Couleur principale',
    'Couleur secondaire',
    'Largeur',
    'Hauteur',
    'Profondeur',
  ];
  const getEtsyUi = () => global.PipelineUIEtsyUI || {};
  const getEtsyUiCore = () => getEtsyUi().shared?.core || {};
  const getEtsyUiMedia = () => getEtsyUi().shared?.media || {};
  const getEtsyUiDetails = () => getEtsyUi().shared?.details || {};
  const getEtsyUiOptions = () => getEtsyUi().shared?.options || {};
  const getEtsyUiSteps = () => getEtsyUi().shared?.steps || {};
  const getEtsyUiModals = () => getEtsyUi().shared?.modals || {};
  const getEtsyUiTabletop = () => getEtsyUi().tabletop || {};
  const getEtsyUiCollection = () => getEtsyUi().collection || {};
  const workspaceState = EtsyRuntime.workspaceState || {};

  const getNode = (id) => document.getElementById(id);
  const getState = EtsyRuntime.getWorkspaceState || ((prefix) => workspaceState[prefix] || null);
  const getFilerobotCtor = EtsyRuntime.getFilerobotCtor || (() => global.FilerobotImageEditor || null);
  const getImageEditorSourceRuntime = EtsyRuntime.getImageEditorSource;
  const resolveRemoteEditorSourceRuntime = EtsyRuntime.resolveRemoteEditorSource;
  const resolveImageEditorSourceRuntime = EtsyRuntime.resolveImageEditorSource;
  const getImageEditorFileNameRuntime = EtsyRuntime.getImageEditorFileName;
  const resetEditedImageRuntime = EtsyRuntime.resetEditedImage;
  const openImageEditorRuntime = EtsyRuntime.openImageEditor;
  const getSortableCtor = () => global.Sortable || null;
  const getImageTools = () => global.PipelineUIImageTools || {};

  const getNodes = (prefix) => ({
    panel: getNode(`etsyApiPanel-${prefix}`),
    input: getNode(`etsyApiListingRef-${prefix}`),
    uploadInput: getNode(`etsyApiUploadInput-${prefix}`),
    status: getNode(`etsyApiStatus-${prefix}`),
    summary: getNode(`etsyApiSummary-${prefix}`),
    strip: getNode(`etsyApiMediaStrip-${prefix}`),
    payload: getNode(`etsyApiPayload-${prefix}`),
  });

  const getCategoryPickerState = () => global.PipelineUIEtsyWorkspace?.categoryPickerState || null;

  const extractListingId = EtsyData.extractListingId;
  const saveListingReference = EtsyRuntime.saveListingReference;
  const restoreListingReference = EtsyRuntime.restoreListingReference;

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

  const buildLocalImagePayload = EtsyRuntime.buildLocalImagePayload;

  const splitCategoryPath = EtsyData.splitCategoryPath;

  const getCategoryPathParts = EtsyData.getCategoryPathParts;

  const buildDetailsDraftFromPayload = (mediaPayload) => {
    const data = mediaPayload?.data || {};
    const categoryPathParts = getCategoryPathParts(data);
    const categoryLabel = String(
      categoryPathParts.at(-1)
      || data.item_type
      || data.category_name
      || (data.taxonomy_id ? `Taxonomy ${data.taxonomy_id}` : 'Categorie a definir')
    ).trim();
    const categoryMetaParts = [];
    const categoryPathText = categoryPathParts.join(' > ');

    if (categoryPathText && categoryPathText !== categoryLabel) {
      categoryMetaParts.push(categoryPathText);
    }

    if (data.taxonomy_id) {
      categoryMetaParts.push(`taxonomy_id ${data.taxonomy_id}`);
    }

    return {
      categoryLabel,
      categoryPathText: categoryPathText || categoryLabel,
      categoryMeta: categoryMetaParts.join(' Â· '),
      taxonomyId: String(data.taxonomy_id || '').trim(),
      title: String(data.title || '').trim(),
      description: String(data.description || ''),
    };
  };

  const applyDetailsDraftToPayload = (state) => {
    const data = state?.mediaPayload?.data;
    const draft = state?.detailsDraft;
    if (!data || !draft) return;

    data.title = String(draft.title || '').trim();
    data.description = String(draft.description || '');

    const categoryPathParts = splitCategoryPath(draft.categoryPathText || '');
    if (categoryPathParts.length) {
      data.taxonomy_path = [...categoryPathParts];
      if (Array.isArray(data.category_path) || typeof data.category_path === 'string') {
        data.category_path = [...categoryPathParts];
      }
    }
  };

  const ensureDetailsDraft = (state) => {
    if (!state) return null;
    if (!state.detailsDraft) {
      state.detailsDraft = EtsyData.buildDetailsDraftFromPayload(state.mediaPayload);
      applyDetailsDraftToPayload(state);
    }
    return state.detailsDraft;
  };

  const getMoneyNumber = (value) => {
    const raw = Number(value);
    return Number.isFinite(raw) ? raw : 0;
  };

  const formatMoneyInput = (value) => {
    const amount = getMoneyNumber(value);
    return amount ? amount.toFixed(2).replace('.', ',') : '';
  };

  const parseMoneyInput = (value) => {
    const normalized = String(value || '').replace(/\s+/g, '').replace(',', '.');
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const buildOptionValueLabel = (propertyValue) => {
    if (!propertyValue || typeof propertyValue !== 'object') return '';

    const values = Array.isArray(propertyValue.values) ? propertyValue.values : [];
    if (values.length) {
      return values.map((item) => String(item || '').trim()).filter(Boolean).join(' / ');
    }

    if (typeof propertyValue.value === 'string' && propertyValue.value.trim()) {
      return propertyValue.value.trim();
    }

    return '';
  };

  const buildOptionVariationName = (propertyValue, index) => {
    if (!propertyValue || typeof propertyValue !== 'object') {
      return `Variation ${index + 1}`;
    }

    return String(
      propertyValue.property_name
      || propertyValue.name
      || propertyValue.formatted_name
      || `Variation ${index + 1}`
    ).trim();
  };

  const createDefaultOptionValue = (label = '') => ({
    id: `opt-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    label: String(label || '').trim(),
    enabled: true,
    imageUrl: '',
    imageKey: '',
  });

  const buildOptionComboKey = (variationSelections) => (
    variationSelections
      .map((selection) => `${selection.variationId}:${selection.optionId}`)
      .join('|')
  );

  const cartesianProduct = (groups) => {
    if (!groups.length) return [[]];
    return groups.reduce((accumulator, group) => {
      const next = [];
      accumulator.forEach((base) => {
        group.forEach((entry) => {
          next.push([...base, entry]);
        });
      });
      return next;
    }, [[]]);
  };

  const normalizeVariationRuleIds = (ids, variations) => {
    const allowedIds = new Set((variations || []).map((variation) => String(variation.id || '').trim()).filter(Boolean));
    const requestedIds = Array.isArray(ids) ? ids : [];
    const normalized = [];
    requestedIds.forEach((value) => {
      const id = String(value || '').trim();
      if (!id || !allowedIds.has(id) || normalized.includes(id)) return;
      normalized.push(id);
    });
    return (variations || [])
      .map((variation) => String(variation.id || '').trim())
      .filter((id) => normalized.includes(id))
      .slice(0, 2);
  };

  const resolveVariationRuleIds = (values, variations) => {
    const propertyIds = new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean));
    const directIds = new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean));
    return normalizeVariationRuleIds(
      (variations || [])
        .filter((variation) => (
          propertyIds.has(String(variation.propertyId || '').trim())
          || directIds.has(String(variation.id || '').trim())
        ))
        .map((variation) => variation.id),
      variations,
    );
  };

  const serializeVariationRuleIds = (ids, variations) => normalizeVariationRuleIds(ids, variations).join('|');

  const parseVariationRuleValue = (value, variations) => normalizeVariationRuleIds(
    String(value || '').split('|').map((item) => item.trim()).filter(Boolean),
    variations,
  );

  const getVariationRuleLabel = (ids, variations) => {
    const normalizedIds = normalizeVariationRuleIds(ids, variations);
    if (!normalizedIds.length) return 'Aucune';
    return normalizedIds
      .map((id) => (variations || []).find((variation) => variation.id === id)?.name || id)
      .join(' et ');
  };

  const buildVariationRuleOptions = (variations) => {
    const activeVariations = Array.isArray(variations) ? variations.filter(Boolean) : [];
    const options = [{
      value: '',
      label: 'Aucune',
    }];

    activeVariations.forEach((variation) => {
      options.push({
        value: variation.id,
        label: variation.name,
      });
    });

    if (activeVariations.length > 1) {
      options.push({
        value: serializeVariationRuleIds(activeVariations.map((variation) => variation.id), activeVariations),
        label: activeVariations.map((variation) => variation.name).join(' et '),
      });
    }

    return options;
  };

  const buildProductScopeKey = (product, scopeIds, variations) => {
    const normalizedIds = normalizeVariationRuleIds(scopeIds, variations);
    if (!normalizedIds.length) return '__all__';

    const selectionMap = new Map((product?.selections || []).map((selection) => [String(selection.variationId || '').trim(), selection]));
    return normalizedIds.map((variationId) => {
      const selection = selectionMap.get(variationId);
      return `${variationId}:${String(selection?.optionId || '').trim()}`;
    }).join('|');
  };

  const updateScopedProducts = (draft, sourceProductId, scopeIds, updater) => {
    const sourceProduct = (draft?.products || []).find((product) => product.id === sourceProductId);
    if (!sourceProduct) return;

    const scopeKey = buildProductScopeKey(sourceProduct, scopeIds, draft.variations || []);
    (draft.products || []).forEach((product) => {
      if (buildProductScopeKey(product, scopeIds, draft.variations || []) !== scopeKey) return;
      updater(product, sourceProduct);
    });
  };

  const getProductSelection = (product, variationId) => (
    (product?.selections || []).find((selection) => String(selection.variationId || '').trim() === String(variationId || '').trim()) || null
  );

  const getWorkspaceImageChoices = (prefix) => {
    const state = getState(prefix);
    if (!state) return [];

    return getOrderedMediaItems(state)
      .filter((item) => item.kind === 'image')
      .map((item, index) => ({
        key: item.key,
        label: item.isLocal
          ? String(item.value.name || `Image ${index + 1}`).trim()
          : `Image ${index + 1}`,
        previewSrc: getDisplayImageSource(prefix, item.key, item.value, item.isLocal),
      }));
  };

  const getOptionAssignedImage = (prefix, option) => {
    const imageKey = String(option?.imageKey || '').trim();
    if (!imageKey) return null;
    const choice = getWorkspaceImageChoices(prefix).find((item) => item.key === imageKey);
    return choice || null;
  };

  const getProductAssignedImage = (prefix, draft, product) => {
    const photoVariation = (draft?.variations || []).find((variation) => variation.photosEnabled);
    if (!photoVariation) return null;

    const selection = getProductSelection(product, photoVariation.id);
    if (!selection) return null;

    const option = (photoVariation.options || []).find((entry) => entry.id === selection.optionId);
    if (!option) return null;

    return getOptionAssignedImage(prefix, option);
  };

  const buildOptionsDraftFromPayload = (mediaPayload) => {
    const data = mediaPayload?.data || {};
    const inventory = data.inventory || {};
    const products = Array.isArray(inventory.products) ? inventory.products : [];
    const variationByProperty = new Map();
    const variationOrder = [];
    const productDrafts = [];
    const baseOffering = products[0]?.offerings?.[0] || {};
    const basePrice = getMoneyNumber(baseOffering.price || data.price || 0);

    products.forEach((product, productIndex) => {
      const propertyValues = Array.isArray(product.property_values) ? product.property_values : [];
      const selections = [];

      propertyValues.forEach((propertyValue, valueIndex) => {
        const propertyId = String(propertyValue.property_id || CUSTOM_VARIATION_PROPERTY_IDS[valueIndex] || `${valueIndex + 1}`).trim();
        const variationName = buildOptionVariationName(propertyValue, valueIndex);
        const optionLabel = buildOptionValueLabel(propertyValue) || `Option ${valueIndex + 1}`;

        if (!variationByProperty.has(propertyId)) {
          variationByProperty.set(propertyId, {
            id: propertyId,
            propertyId,
            name: variationName,
            photosEnabled: false,
            options: [],
          });
          variationOrder.push(propertyId);
        }

        const variation = variationByProperty.get(propertyId);
        let option = variation.options.find((item) => item.label === optionLabel);
        if (!option) {
          option = createDefaultOptionValue(optionLabel);
          variation.options.push(option);
        }

        selections.push({
          variationId: propertyId,
          optionId: option.id,
          label: option.label,
        });
      });

      if (!selections.length) return;

      const offering = Array.isArray(product.offerings) && product.offerings.length ? product.offerings[0] : {};
      productDrafts.push({
        id: `product-${productIndex + 1}`,
        comboKey: buildOptionComboKey(selections),
        selections,
        sku: String(product.sku || '').trim(),
        prices: {
          fr: getMoneyNumber(offering.price || basePrice),
          us: getMoneyNumber(offering.price || basePrice),
          other: getMoneyNumber(offering.price || basePrice),
        },
        enabled: Boolean(offering.is_enabled ?? product.is_deleted !== true),
        quantity: Number(offering.quantity || product.quantity || 0) || 0,
      });
    });

    const variations = variationOrder.map((propertyId, index) => {
      const variation = variationByProperty.get(propertyId);
      return {
        id: variation.id,
        propertyId: variation.propertyId,
        slot: index,
        name: variation.name,
        photosEnabled: variation.photosEnabled,
        isCustom: CUSTOM_VARIATION_PROPERTY_IDS.includes(String(variation.propertyId)),
        options: variation.options,
      };
    });

    const priceVariesByIds = resolveVariationRuleIds(inventory.price_on_property, variations);
    const skuVariesByIds = resolveVariationRuleIds(inventory.sku_on_property, variations);
    const quantityVariesByIds = resolveVariationRuleIds(inventory.quantity_on_property, variations);

    return {
      variations,
      products: productDrafts,
      priceVariesByIds: priceVariesByIds.length ? priceVariesByIds : (variations[0] ? [variations[0].id] : []),
      skuVariesByIds: skuVariesByIds.length ? skuVariesByIds : (variations[0] ? [variations[0].id] : []),
      quantityVariesByIds,
      processingProfileVariesByIds: [],
      basePrice,
      baseQuantity: Number(baseOffering.quantity || 0) || 0,
    };
  };

  const ensureOptionsDraft = (state) => {
    if (!state) return null;
    if (!state.optionsDraft) {
      state.optionsDraft = EtsyData.buildOptionsDraftFromPayload(state.mediaPayload);
    }
    return state.optionsDraft;
  };

  const normalizeTaxonomyEntry = EtsyData.normalizeTaxonomyEntry;
  const cacheTaxonomyEntries = EtsyRuntime.cacheTaxonomyEntries;
  const fetchTaxonomySearch = EtsyRuntime.fetchTaxonomySearch;

  const resolveDraftCategoryLabel = async (prefix) => {
    const state = getState(prefix);
    const draft = state?.detailsDraft;
    if (!state || !draft || !draft.taxonomyId) return;
    if (draft.categoryPathText && draft.categoryPathText.includes('>')) return;
    if (draft.categoryLabel && !/^Taxonomy\s+\d+$/i.test(draft.categoryLabel)) return;

    try {
      const [entry] = await fetchTaxonomySearch(prefix, {
        taxonomyId: draft.taxonomyId,
        limit: 1,
      });
      if (!entry) return;

      state.detailsDraft = {
        ...draft,
        categoryLabel: entry.name,
        categoryPathText: entry.path_text,
      };
      applyDetailsDraftToPayload(state);
      syncPayloadText(state);
      syncWorkspacePayloadView(prefix);
      renderDetailsStep(prefix);
    } catch (error) {}
  };

  const syncPayloadText = EtsyRuntime.syncPayloadText;

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

  const setTextContent = (node, value) => getEtsyUiCore().setTextContent?.(node, value);

  const setStatusShared = (prefix, message) => getEtsyUiCore().setStatus?.(prefix, message, {
    getNodes,
  });

  const configureWorkspaceProgressShared = (prefix) => getEtsyUiSteps().configureWorkspaceProgress?.(prefix, {
    getNodes,
  });

  const setWorkspaceActiveStepShared = (prefix, nextStep) => getEtsyUiSteps().setWorkspaceActiveStep?.(prefix, nextStep, {
    getNodes,
    getState,
    syncPayloadText,
    syncWorkspacePayloadView,
    renderDetailsStep,
    renderOptionsStep: renderOptionsStepV2,
  });

  const ensureWorkspaceSourcePanelShared = (prefix) => getEtsyUiSteps().ensureWorkspaceSourcePanel?.(prefix, {
    getNodes,
    setTextContent,
    renameWorkspaceLoadButton,
    ensureWorkspaceStepHeading,
    ensureWorkspaceDetailsSection,
    ensureWorkspaceOptionsSection,
  });

  const renderPlaceholderShared = (prefix, message) => getEtsyUiMedia().renderPlaceholder?.(prefix, message, {
    getNodes,
    destroySortable,
    createToolbarButton: (...args) => getEtsyUiMedia().createToolbarButton?.(...args),
    triggerAddImages,
  });

  const renderSummaryShared = (prefix, mediaPayload) => getEtsyUiMedia().renderSummary?.(prefix, mediaPayload, {
    getNodes,
    getState,
  });

  const renderMediaGridShared = (prefix, mediaPayload) => getEtsyUiMedia().renderMediaGrid?.(prefix, mediaPayload, {
    getNodes,
    getState,
    getOrderedMediaItems,
    getLocalImageKey,
    getImageKey,
    getVideoKey,
    getDisplayImageSource,
    removeMediaByKeyInline,
    openMediaLightbox,
    triggerAddImages,
    clearAllMedia,
    setupSortable,
  });

  const closeCategoryPickerOverlayShared = () => getEtsyUiModals().closeCategoryPickerOverlay?.({
    getNode,
    CATEGORY_PICKER_OVERLAY_ID,
  });

  const ensureMediaLightboxShared = () => getEtsyUiModals().ensureMediaLightbox?.({
    getNode,
    LIGHTBOX_ID,
    closeMediaLightbox: closeMediaLightboxShared,
    getActiveMediaSelection,
    setMediaAltText,
    openImageEditor,
    resetEditedImage,
  });

  const ensureImageEditorOverlayShared = () => getEtsyUiModals().ensureImageEditorOverlay?.({
    getNode,
    IMAGE_EDITOR_OVERLAY_ID,
    closeImageEditorOverlay: closeImageEditorOverlayShared,
  });

  const ensureCategoryPickerOverlayShared = () => getEtsyUiModals().ensureCategoryPickerOverlay?.({
    getNode,
    CATEGORY_PICKER_OVERLAY_ID,
    closeCategoryPickerOverlay: closeCategoryPickerOverlayShared,
    runCategoryPickerSearch,
  });

  const ensureOptionsOverlaysShared = () => getEtsyUiModals().ensureOptionsOverlays?.({
    getNode,
    OPTIONS_MODAL_ID,
    OPTIONS_TYPE_PICKER_ID,
    OPTIONS_EDITOR_ID,
    closeOptionsOverlays: closeOptionsOverlaysShared,
    openOptionTypePicker,
    openOptionEditor,
    getOptionsModalState,
    createDefaultOptionValue,
    renderOptionEditorState,
    updateOptionsDraft,
    renderOptionsStep: renderOptionsStepV2,
  });

  const closeOptionsOverlaysShared = () => getEtsyUiModals().closeOptionsOverlays?.({
    getNode,
    getOptionsModalState,
    OPTIONS_MODAL_ID,
    OPTIONS_TYPE_PICKER_ID,
    OPTIONS_EDITOR_ID,
  });

  const closeImageEditorOverlayShared = () => getEtsyUiModals().closeImageEditorOverlay?.({
    getNode,
    IMAGE_EDITOR_OVERLAY_ID,
    getActiveEditorSession: () => activeEditorSession,
    setActiveEditorSession: (session) => {
      activeEditorSession = session;
    },
  });

  const closeMediaLightboxShared = () => getEtsyUiModals().closeMediaLightbox?.({
    getNode,
    LIGHTBOX_ID,
    getActiveMediaSelection,
    getState,
  });

  const autoResizeDescriptionShared = (prefix) => getEtsyUiDetails().autoResizeDescription?.(prefix, {
    getNode,
  });

  const renderTitleCounterShared = (prefix) => getEtsyUiDetails().renderTitleCounter?.(prefix, {
    getNode,
  });

  const updateDetailsDraftShared = (prefix, patch) => getEtsyUiDetails().updateDetailsDraft?.(prefix, patch, {
    getState,
    ensureDetailsDraft,
    applyDetailsDraftToPayload,
    syncPayloadText,
    syncWorkspacePayloadView,
  });

  const renderDetailsStepShared = (prefix) => getEtsyUiDetails().renderDetailsStep?.(prefix, {
    getState,
    ensureDetailsDraft,
    getNode,
    splitCategoryPath,
    renderTitleCounter: renderTitleCounterShared,
    autoResizeDescription: autoResizeDescriptionShared,
    resolveDraftCategoryLabel,
  });

  function setOptionsModalState(nextState) {
    global.PipelineUIEtsyWorkspace.optionsModalState = nextState;
  }

  const openOptionsModalShared = (prefix) => getEtsyUiOptions().openOptionsModal?.(prefix, {
    ensureOptionsOverlays,
    getNode,
    OPTIONS_MODAL_ID,
    setOptionsModalState,
    renderOptionsModalState: renderOptionsModalStateV2,
  });

  const openOptionTypePickerShared = () => getEtsyUiOptions().openOptionTypePicker?.({
    getOptionsModalState,
    ensureOptionsOverlays,
    getNode,
    OPTIONS_TYPE_PICKER_ID,
    optionTypeSuggestions: OPTION_TYPE_SUGGESTIONS,
    openOptionEditor,
  });

  const renderOptionEditorPhotosShared = (prefix, workingVariation, photoAssignments) => getEtsyUiOptions().renderOptionEditorPhotos?.(
    prefix,
    workingVariation,
    photoAssignments,
    {
      getWorkspaceImageChoices,
      getOptionAssignedImage,
      renderOptionEditorPhotos: renderOptionEditorPhotosShared,
    }
  );

  const renderOptionEditorStateShared = () => getEtsyUiOptions().renderOptionEditorState?.({
    getOptionsModalState,
    getNode,
    OPTIONS_EDITOR_ID,
    getSortableCtor,
    renderOptionEditorState: renderOptionEditorStateShared,
    renderOptionEditorPhotos: renderOptionEditorPhotosShared,
  });

  const openOptionEditorShared = (variationId = '', presetName = '') => getEtsyUiOptions().openOptionEditor?.(
    variationId,
    presetName,
    {
      getOptionsModalState,
      getState,
      ensureOptionsDraft,
      customVariationPropertyIds: CUSTOM_VARIATION_PROPERTY_IDS,
      setOptionsModalState,
      ensureOptionsOverlays,
      getNode,
      OPTIONS_EDITOR_ID,
      renderOptionEditorState: renderOptionEditorStateShared,
    }
  );

  const renderOptionsModalStateShared = (prefix) => getEtsyUiOptions().renderOptionsModalState?.(prefix, {
    getState,
    ensureOptionsDraft,
    getNode,
    buildVariationRuleOptions,
    serializeVariationRuleIds,
    normalizeVariationRuleIds,
    openOptionEditor: openOptionEditorShared,
    updateOptionsDraft,
    parseVariationRuleValue,
    renderOptionsModalState: renderOptionsModalStateShared,
    renderOptionsStep: renderOptionsStepV2,
  });

  const renderOptionsStepShared = (prefix) => getEtsyUiOptions().renderOptionsStep?.(prefix, {
    getState,
    getNode,
    ensureOptionsDraft,
    applyOptionsDraftToPayload,
    syncPayloadText,
    syncWorkspacePayloadView,
    getVariationRuleLabel,
    getProductAssignedImage,
    getProductSelection,
    formatMoneyInput,
    updateOptionsDraft,
    updateScopedProducts,
    parseMoneyInput,
  });

  const renameWorkspaceLoadButton = (prefix) => {
    const nodes = getNodes(prefix);
    const loadButton = nodes.panel?.querySelector?.(`[data-ui-action="load-etsy-workspace-media"][data-action-arg="${prefix}"]`);
    const label = loadButton?.querySelector?.('.ui-icon-label');
    if (label) {
      label.textContent = 'Charger la fiche source';
    }
  };

  const ensureWorkspaceStepHeading = (body) => {
    if (!body) return null;

    let stepSection = body.querySelector('.etsy-api-step-section');
    if (!stepSection) {
      stepSection = document.createElement('div');
      stepSection.className = 'etsy-api-step-section';
      stepSection.dataset.etsyStep = 'media';
      body.appendChild(stepSection);
    }
    stepSection.dataset.etsyStep = 'media';
    stepSection.hidden = false;

    let heading = stepSection.querySelector('.etsy-api-step-heading');
    if (!heading) {
      heading = document.createElement('div');
      heading.className = 'etsy-api-step-heading';
      heading.innerHTML = `
        <span class="collection-stepper-kicker">Step 01 Â· DonnÃ©es dÃ©jÃ  chargÃ©es</span>
        <h3 class="etsy-api-step-title">Photo et vidÃ©o</h3>
        <p class="etsy-api-step-subtitle">Ce step liste simplement les mÃ©dias dÃ©jÃ  chargÃ©s depuis la fiche source Etsy.</p>
      `;
      stepSection.prepend(heading);
    }

    return stepSection;
  };

  const ensureWorkspaceDetailsSection = (prefix) => {
    const nodes = getNodes(prefix);
    const body = nodes.panel?.querySelector?.('.etsy-api-body');
    if (!body) return null;

    let detailsSection = body.querySelector(`.etsy-api-step-section[data-etsy-step="details"]`);
    if (!detailsSection) {
      detailsSection = document.createElement('section');
      detailsSection.className = 'etsy-api-step-section';
      detailsSection.dataset.etsyStep = 'details';
      detailsSection.innerHTML = `
        <div class="etsy-api-step-heading">
          <span class="collection-stepper-kicker">Step 02 Â· DÃ©tails de l'article</span>
          <h3 class="etsy-api-step-title">DÃ©tails de l'article</h3>
          <p class="etsy-api-step-subtitle">Aidez les acheteurs Ã  mieux comprendre l'article source Etsy avant la future duplication draft.</p>
        </div>
        <div class="form-section etsy-api-details-panel">
          <div class="fg full">
            <label>Categorie selectionnee</label>
            <div class="etsy-api-category-card">
              <div class="etsy-api-category-copy">
                <div id="etsyApiCategoryLabel-${prefix}" class="etsy-api-category-label">Categorie a definir</div>
                <div id="etsyApiCategoryMeta-${prefix}" class="etsy-api-category-meta">Aucune categorie detectee dans la fiche source.</div>
              </div>
              <button class="btn btn-muted btn-xs-inline" type="button" data-js="etsy-category-edit-toggle" data-prefix="${prefix}">Modifier</button>
            </div>
            <div id="etsyApiCategoryEditor-${prefix}" class="etsy-api-category-editor is-hidden">
              <label for="etsyApiCategoryPath-${prefix}">Chemin categorie</label>
              <input type="text" id="etsyApiCategoryPath-${prefix}" placeholder="ex: Figurines > Science-fiction > Astronaute"/>
              <div class="field-action-row">
                <button class="btn btn-accent btn-xs-inline" type="button" data-js="etsy-category-apply" data-prefix="${prefix}">Appliquer</button>
                <button class="btn btn-muted btn-xs-inline" type="button" data-js="etsy-category-cancel" data-prefix="${prefix}">Annuler</button>
              </div>
            </div>
          </div>
          <div class="fg full">
            <label for="etsyApiTitleInput-${prefix}">Titre</label>
            <p class="etsy-api-field-hint">Le titre Etsy est limit&eacute; &agrave; 140 caract&egrave;res.</p>
            <input type="text" id="etsyApiTitleInput-${prefix}" maxlength="220" placeholder="Titre Etsy source"/>
            <div class="etsy-api-title-meta">
              <span id="etsyApiTitleCount-${prefix}" class="etsy-api-title-count">0 / 140</span>
              <span id="etsyApiTitleWarning-${prefix}" class="etsy-api-title-warning is-hidden">Le titre depasse 140 caracteres.</span>
            </div>
          </div>
          <div class="fg full">
            <label for="etsyApiDescriptionInput-${prefix}">Description</label>
            <p class="etsy-api-field-hint">La description chargee depuis Etsy reste editable localement dans ce workspace.</p>
            <textarea id="etsyApiDescriptionInput-${prefix}" class="etsy-api-description-input" placeholder="Description Etsy source"></textarea>
          </div>
        </div>
      `;
      body.appendChild(detailsSection);
    }

    detailsSection.hidden = true;

    return detailsSection;
  };

  const ensureWorkspaceOptionsSection = (prefix) => {
    const nodes = getNodes(prefix);
    const body = nodes.panel?.querySelector?.('.etsy-api-body');
    if (!body) return null;

    let section = body.querySelector(`.etsy-api-step-section[data-etsy-step="options"]`);
    if (!section) {
      section = document.createElement('section');
      section.className = 'etsy-api-step-section';
      section.dataset.etsyStep = 'options';
      section.innerHTML = `
        <div class="etsy-api-step-heading">
          <span class="collection-stepper-kicker">Step 03 Â· Options de l'article</span>
          <h3 class="etsy-api-step-title">Options de l'article</h3>
          <p class="etsy-api-step-subtitle">PrÃ©sentez les variations disponibles et prÃ©parez les rÃ©fÃ©rences, prix et visibilitÃ©s du futur draft.</p>
        </div>
        <div class="form-section etsy-api-options-panel">
          <div class="etsy-api-options-header">
            <div>
              <h4 class="etsy-api-options-heading">Variations</h4>
              <p class="etsy-api-options-copy">Ajoutez les options disponibles, de taille et de couleur par exemple.</p>
            </div>
            <button class="btn btn-muted" type="button" data-js="etsy-options-manage" data-prefix="${prefix}">GÃ©rer les variations</button>
          </div>
          <div id="etsyApiOptionsContent-${prefix}" class="etsy-api-options-content"></div>
        </div>
      `;
      body.appendChild(section);
    }

    section.hidden = true;
    return section;
  };

  const configureWorkspaceProgress = (prefix) => {
    const nodes = getNodes(prefix);
    const progress = nodes.panel?.querySelector?.('.etsy-api-progress');
    if (!progress) return;

    const labels = [
      'Photo et vidÃ©o',
      "DÃ©tails de l'article",
      'Options',
      'Attributs',
      'Prix et stock',
      'Livraison',
      'ParamÃ¨tres',
    ];
    const buttons = Array.from(progress.querySelectorAll('.collection-stepper-pill'));

    buttons.forEach((button, index) => {
      if (index >= labels.length) {
        button.remove();
        return;
      }

      const labelNode = button.querySelector('.collection-stepper-pill-label');
      const indexNode = button.querySelector('.collection-stepper-pill-index');
      if (labelNode) labelNode.textContent = labels[index];
      if (indexNode) indexNode.textContent = String(index + 1).padStart(2, '0');

      if (index < 3) {
        button.disabled = false;
        button.dataset.etsyStep = index === 0 ? 'media' : (index === 1 ? 'details' : 'options');
        button.classList.remove('is-disabled');
      } else {
        button.disabled = true;
        button.removeAttribute('data-etsy-step');
      }
    });
  };

  const setWorkspaceActiveStep = (prefix, nextStep) => {
    const state = getState(prefix);
    const nodes = getNodes(prefix);
    const panel = nodes.panel;
    if (!state || !panel) return;

    const allowedStep = String(nextStep || '').trim();
    const step = allowedStep === 'details' || allowedStep === 'options' ? allowedStep : 'media';
    state.activeStep = step;
    syncPayloadText(state);
    syncWorkspacePayloadView(prefix);

    const sections = panel.querySelectorAll('.etsy-api-step-section[data-etsy-step]');
    sections.forEach((section) => {
      const isActive = section.dataset.etsyStep === step;
      section.hidden = !isActive;
      section.classList.toggle('is-active', isActive);
    });

    const pills = panel.querySelectorAll('.etsy-api-progress .collection-stepper-pill');
    pills.forEach((pill) => {
      const isCurrent = pill.dataset.etsyStep === step;
      pill.classList.toggle('is-current', isCurrent);
      if (pill.dataset.etsyStep) {
        pill.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
      }
    });

    if (step === 'details') {
      renderDetailsStep(prefix);
    }

    if (step === 'options') {
      renderOptionsStepV2(prefix);
    }
  };

  const ensureWorkspaceSourcePanel = (prefix) => {
    const nodes = getNodes(prefix);
    const panel = nodes.panel;
    if (!panel) return;

    const header = panel.querySelector('.etsy-api-header');
    const heading = header?.querySelector('.collection-stepper-heading');
    const progress = header?.querySelector('.etsy-api-progress');
    const body = panel.querySelector('.etsy-api-body');
    const sourceBlock = nodes.input?.closest?.('.fg.full');
    if (!header || !heading || !progress || !body || !sourceBlock) return;

    const title = heading.querySelector('.collection-stepper-title');
    const subtitle = heading.querySelector('.collection-stepper-subtitle');
    setTextContent(title, 'Fiche source');
    setTextContent(subtitle, 'Charge une fiche Etsy source une seule fois, puis laisse chaque step consommer les donnÃ©es dont il a besoin.');

    let sourcePanel = panel.querySelector('.etsy-api-source-panel');
    if (!sourcePanel) {
      sourcePanel = document.createElement('div');
      sourcePanel.className = 'etsy-api-source-panel';
      header.insertAdjacentElement('afterend', sourcePanel);
    }

    if (sourceBlock.parentElement !== sourcePanel) {
      sourcePanel.appendChild(sourceBlock);
    }

    if (progress.parentElement !== sourcePanel) {
      sourcePanel.appendChild(progress);
    }

    const stepSection = ensureWorkspaceStepHeading(body);
    if (!stepSection) return;

    const summary = nodes.summary;
    const strip = nodes.strip;
    const payloadDetails = nodes.payload?.closest?.('details.form-optional');

    if (summary && summary.parentElement !== stepSection) {
      stepSection.appendChild(summary);
    }

    if (strip && strip.parentElement !== stepSection) {
      stepSection.appendChild(strip);
    }

    if (payloadDetails && payloadDetails.parentElement !== stepSection) {
      stepSection.appendChild(payloadDetails);
    }

    renameWorkspaceLoadButton(prefix);
    ensureWorkspaceDetailsSection(prefix);
    ensureWorkspaceOptionsSection(prefix);
    configureWorkspaceProgressShared(prefix);
  };

  const destroySortable = (prefix) => {
    const state = getState(prefix);
    if (!state?.sortable) return;

    state.sortable.destroy();
    state.sortable = null;
  };

  const getEditedImageDataUrl = (prefix, mediaKey) => {
    const state = getState(prefix);
    return String(state?.editedImageDataUrls?.[mediaKey] || '');
  };

  const getSavedEditorDesignState = (prefix, mediaKey) => {
    const state = getState(prefix);
    return state?.editorDesignStates?.[mediaKey] || null;
  };

  const setEditedImageState = (prefix, mediaKey, imageDataUrl, designState) => {
    const state = getState(prefix);
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
  };

  const clearEditedImageState = (prefix, mediaKey) => {
    setEditedImageState(prefix, mediaKey, '', null);
    const state = getState(prefix);
    if (state?.editorSourceUrls) {
      delete state.editorSourceUrls[mediaKey];
    }
  };

  const resetWorkspaceEditedImages = (prefix) => {
    const state = getState(prefix);
    if (!state) return;
    state.editedImageDataUrls = {};
    state.editorDesignStates = {};
    state.editorSourceUrls = {};
  };

  const getDisplayImageSource = (prefix, mediaKey, image, isLocal) => (
    getEditedImageDataUrl(prefix, mediaKey) || getImagePreviewSource(image, isLocal)
  );

  const ensureMediaLightbox = () => ensureMediaLightboxShared();

  const ensureImageEditorOverlay = () => ensureImageEditorOverlayShared();

  const ensureCategoryPickerOverlay = () => ensureCategoryPickerOverlayShared();

  function closeCategoryPickerOverlay() {
    return closeCategoryPickerOverlayShared();
  }

  const renderCategoryPickerResults = (entries) => {
    const state = getCategoryPickerState();
    const resultsNode = getNode('etsyCategoryPickerResults');
    const statusNode = getNode('etsyCategoryPickerStatus');
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
        const workspaceState = getState(prefix);
        if (!prefix || !workspaceState) return;

        const entry = workspaceState.taxonomyLookup[String(button.dataset.taxonomyId || '').trim()];
        if (!entry) return;

        updateDetailsDraft(prefix, {
          taxonomyId: entry.taxonomy_id,
          categoryLabel: entry.name,
          categoryPathText: entry.path_text,
        });
        workspaceState.isEditingCategory = false;
        renderDetailsStep(prefix);
        closeCategoryPickerOverlay();
      });
    });
  };

  const runCategoryPickerSearch = async (query) => {
    const pickerState = getCategoryPickerState();
    const prefix = pickerState?.prefix;
    const statusNode = getNode('etsyCategoryPickerStatus');
    if (!prefix || !statusNode) return;

    const state = getState(prefix);
    if (!state) return;
    state.taxonomySearchQuery = String(query || '').trim();
    statusNode.textContent = 'Recherche des categories Etsy...';

    try {
      const entries = await fetchTaxonomySearch(prefix, {
        query: state.taxonomySearchQuery,
        limit: 18,
      });
      state.taxonomySearchResults = entries;
      renderCategoryPickerResults(entries);
    } catch (error) {
      const resultsNode = getNode('etsyCategoryPickerResults');
      if (resultsNode) {
        resultsNode.innerHTML = '<div class="etsy-category-picker-empty">Recherche categorie impossible.</div>';
      }
      statusNode.textContent = `Recherche impossible : ${error.message}`;
    }
  };

  const openCategoryPicker = async (prefix) => {
    ensureCategoryPickerOverlay();
    const overlay = getNode(CATEGORY_PICKER_OVERLAY_ID);
    const input = getNode('etsyCategoryPickerInput');
    const state = getState(prefix);
    const draft = state?.detailsDraft || ensureDetailsDraft(state);
    if (!overlay || !input || !state || !draft) return;

    global.PipelineUIEtsyWorkspace.categoryPickerState = { prefix };
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');

    input.value = draft.categoryLabel || draft.categoryPathText || '';
    input.focus();
    input.select();
    await runCategoryPickerSearch(input.value);
  };

  const getOptionsModalState = () => global.PipelineUIEtsyWorkspace?.optionsModalState || null;

  const closeOptionsOverlays = () => closeOptionsOverlaysShared();

  const ensureOptionsOverlays = () => ensureOptionsOverlaysShared();

  const renderOptionsModalState = (prefix) => renderOptionsModalStateShared(prefix);

  function openOptionsModal(prefix) {
    return openOptionsModalShared(prefix);
  }

  function openOptionTypePicker() {
    return openOptionTypePickerShared();
  }

  const renderOptionEditorPhotos = (prefix, workingVariation, photoAssignments) => {
    return renderOptionEditorPhotosShared(prefix, workingVariation, photoAssignments);
  };

  const renderOptionEditorState = () => {
    return renderOptionEditorStateShared();
  };

  function openOptionEditor(variationId = '', presetName = '') {
    return openOptionEditorShared(variationId, presetName);
  }

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

  let activeEditorSession = null;

  function closeImageEditorOverlay() {
    return closeImageEditorOverlayShared();
  }

  function closeMediaLightbox() {
    return closeMediaLightboxShared();
  }

  const getImageEditorSource = (mediaItem) => getImageEditorSourceRuntime?.(mediaItem, {
    getImagePreviewSource,
  }) || '';

  const resolveRemoteEditorSource = (prefix, mediaKey, remoteUrl) => resolveRemoteEditorSourceRuntime?.(prefix, mediaKey, remoteUrl, {
    getState,
    routes: ROUTES,
  });

  const resolveImageEditorSource = (prefix, mediaKey, mediaItem) => resolveImageEditorSourceRuntime?.(prefix, mediaKey, mediaItem, {
    getImagePreviewSource,
    getState,
    routes: ROUTES,
  });

  const getImageEditorFileName = (mediaItem) => getImageEditorFileNameRuntime?.(mediaItem, {
    getImagePreviewSource,
    getImageId,
  }) || 'etsy-image';

  const resetEditedImage = (prefix, mediaKey) => resetEditedImageRuntime?.(prefix, mediaKey, {
    getState,
    getMediaItemByKey,
    clearEditedImageState,
    renderWorkspace,
    fillMediaLightbox,
  });

  const openImageEditor = (prefix, mediaKey) => openImageEditorRuntime?.(prefix, mediaKey, {
    getState,
    getMediaItemByKey,
    getFilerobotCtor,
    getImagePreviewSource,
    routes: ROUTES,
    ensureImageEditorOverlay,
    closeImageEditorOverlay,
    getNode,
    IMAGE_EDITOR_OVERLAY_ID,
    getSavedEditorDesignState,
    setEditedImageState,
    renderWorkspace,
    fillMediaLightbox,
    setActiveEditorSession: (session) => {
      activeEditorSession = session;
    },
    getImageId,
  });

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
    const imageActions = getNode('etsyMediaLightboxImageActions');
    const headerActions = getNode('etsyMediaLightboxHeaderActions');
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
      preview.src = getDisplayImageSource(prefix, mediaKey, mediaItem.value, mediaItem.isLocal);
      preview.alt = mediaItem.value.alt_text || 'Image Etsy';
      previewHost.appendChild(preview);

      typeNode.textContent = mediaItem.isLocal ? 'Image locale' : 'Image Etsy';
      idNode.textContent = mediaItem.isLocal ? String(mediaItem.value.local_id || '-') : getImageId(mediaItem.value);
      resolutionNode.textContent = formatResolution(
        mediaItem.isLocal
          ? { width: mediaItem.value.width || 0, height: mediaItem.value.height || 0 }
          : getImageResolution(mediaItem.value)
      );
      sourceNode.textContent = mediaItem.isLocal ? 'Ajoutee au workspace' : getImageEditorSource(mediaItem);
      altGroup.style.display = '';
      imageActions.style.display = '';
      headerActions.style.display = '';
      altInput.disabled = false;
      altInput.value = mediaItem.value.alt_text || '';
      const hasEditedVersion = !!getEditedImageDataUrl(prefix, mediaKey);
      resetImageButton.disabled = !hasEditedVersion;
      resetImageHeaderButton.disabled = !hasEditedVersion;
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
      imageActions.style.display = 'none';
      headerActions.style.display = 'none';
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

  const createToolbarButton = (className, iconName, label, onClick) => (
    getEtsyUiMedia().createToolbarButton?.(className, iconName, label, onClick)
  );

  const createInlineRemoveButton = (prefix, mediaKey) => getEtsyUiMedia().createInlineRemoveButton?.(prefix, mediaKey, {
    removeMediaByKeyInline,
  });

  const bindPreviewLightbox = (node, prefix, mediaKey) => getEtsyUiMedia().bindPreviewLightbox?.(node, prefix, mediaKey, {
    openMediaLightbox,
  });

  const createTextBlock = (className, text) => {
    const node = document.createElement('div');
    node.className = className;
    node.textContent = text;
    return node;
  };

  const createImageCard = (image, index, mediaKey, prefix, isLocal) => getEtsyUiMedia().createImageCard?.(image, index, mediaKey, prefix, isLocal, {
    getLocalImageKey,
    getImageKey,
    getDisplayImageSource,
    removeMediaByKeyInline,
    openMediaLightbox,
  });

  const createVideoCard = (video, index, mediaKey, prefix) => getEtsyUiMedia().createVideoCard?.(video, index, mediaKey, prefix, {
    getVideoKey,
    removeMediaByKeyInline,
  });

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
      setStatusShared(prefix, `Ordre des medias mis a jour - ${imageCount + localImageCount} image(s) - ${videoCount} video(s).`);
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
    setStatusShared(prefix, `${state.localImages.length} image(s) locale(s) ajoutee(s) au workspace.`);
    global.showToast?.('Images ajoutees au workspace Etsy');
  };

  const removeMediaByKey = (prefix, mediaKey) => {
    const state = getState(prefix);
    const mediaItem = getMediaItemByKey(state, mediaKey);
    if (!state || !mediaItem) return;

    if (activeEditorSession?.prefix === prefix && activeEditorSession?.mediaKey === mediaKey) {
      closeImageEditorOverlay();
    }

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
    clearEditedImageState(prefix, mediaKey);
    if (state.activeMediaKey === mediaKey) closeMediaLightbox();
    syncPayloadText(state);
    renderWorkspace(prefix);
    global.showToast?.('Media retire du workspace Etsy');
  };

  const removeMediaByKeyInline = (prefix, mediaKey, cardNode) => {
    const state = getState(prefix);
    const mediaItem = getMediaItemByKey(state, mediaKey);
    if (!state || !mediaItem) return;

    if (activeEditorSession?.prefix === prefix && activeEditorSession?.mediaKey === mediaKey) {
      closeImageEditorOverlay();
    }

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
    clearEditedImageState(prefix, mediaKey);
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

    if (activeEditorSession?.prefix === prefix) {
      closeImageEditorOverlay();
    }
    closeOptionsOverlays();

    if (state.mediaPayload?.data) {
      state.mediaPayload.data.images = [];
      state.mediaPayload.data.videos = [];
    }

    state.localImages = [];
    state.mediaOrder = [];
    state.optionsDraft = null;
    resetWorkspaceEditedImages(prefix);
    if (state.activeMediaKey) closeMediaLightbox();
    syncPayloadText(state);
    renderWorkspace(prefix);
    setStatusShared(prefix, 'Tous les medias du workspace Etsy ont ete supprimes.');
    global.showToast?.('Workspace Etsy vide');
  };

  const renderPlaceholder = (prefix, message) => renderPlaceholderShared(prefix, message);

  const renderSummary = (prefix, mediaPayload) => renderSummaryShared(prefix, mediaPayload);

  const autoResizeDescription = (prefix) => autoResizeDescriptionShared(prefix);

  const renderTitleCounter = (prefix) => renderTitleCounterShared(prefix);

  const syncWorkspacePayloadView = (prefix) => {
    const state = getState(prefix);
    const nodes = getNodes(prefix);
    if (!state || !nodes.payload) return;
    ensureWorkspaceSourcePanelShared(prefix);
    nodes.payload.textContent = state.payloadText || 'Aucun payload charge.';
  };

  const updateDetailsDraft = (prefix, patch) => updateDetailsDraftShared(prefix, patch);

  const rebuildOptionProducts = (draft) => {
    EtsyData.rebuildOptionProducts(draft);
  };

  const applyOptionsDraftToPayload = (state) => {
    const data = state?.mediaPayload?.data;
    const draft = state?.optionsDraft;
    if (!data || !draft) return;
    EtsyData.applyOptionsDraftToPayload(data, draft);
  };

  const updateOptionsDraft = (prefix, mutator) => {
    const state = getState(prefix);
    if (!state) return;

    const draft = ensureOptionsDraft(state);
    if (!draft) return;
    mutator(draft);
    draft.variations = (draft.variations || []).slice(0, 2);
    draft.variations = draft.variations.map((variation, index) => ({
      ...variation,
      slot: index,
      options: (variation.options || []).map((option) => ({
        ...option,
        imageKey: String(option.imageKey || '').trim(),
      })),
    }));
    draft.priceVariesByIds = normalizeVariationRuleIds(draft.priceVariesByIds, draft.variations || []);
    draft.skuVariesByIds = normalizeVariationRuleIds(draft.skuVariesByIds, draft.variations || []);
    draft.quantityVariesByIds = normalizeVariationRuleIds(draft.quantityVariesByIds, draft.variations || []);
    draft.processingProfileVariesByIds = normalizeVariationRuleIds(draft.processingProfileVariesByIds, draft.variations || []);

    const validImageKeys = new Set(getWorkspaceImageChoices(prefix).map((item) => item.key));
    draft.variations.forEach((variation) => {
      variation.options = (variation.options || []).filter((option) => String(option.label || '').trim());
      variation.options.forEach((option) => {
        if (option.imageKey && !validImageKeys.has(option.imageKey)) {
          option.imageKey = '';
        }
      });
    });

    applyOptionsDraftToPayload(state);
    syncPayloadText(state);
    syncWorkspacePayloadView(prefix);
  };

  const renderDetailsStep = (prefix) => renderDetailsStepShared(prefix);

  const getVariationOptionBySelection = (draft, selection) => {
    const variation = (draft?.variations || []).find((item) => item.id === selection.variationId);
    const option = variation?.options?.find((item) => item.id === selection.optionId) || null;
    return { variation, option };
  };

  const renderOptionsStep = (prefix) => renderOptionsStepShared(prefix);

  const renderOptionsModalStateV2 = (prefix) => {
    return renderOptionsModalStateShared(prefix);
  };

  const renderOptionsStepV2 = (prefix) => {
    return renderOptionsStepShared(prefix);
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
    renderDetailsStep(prefix);
    renderOptionsStepV2(prefix);
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
    return renderMediaGridShared(prefix, mediaPayload);
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
      renderPlaceholder(prefix, 'Charge une fiche source Etsy, puis exploite ici les mÃ©dias dÃ©jÃ  prÃ©sents dans le workspace.');
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

  const setStatus = (prefix, message) => setStatusShared(prefix, message);

  const renderWorkspace = (prefix) => {
    const state = getState(prefix);
    const nodes = getNodes(prefix);
    if (!state || !nodes.panel) return;

    ensureWorkspaceSourcePanelShared(prefix);
    nodes.payload.textContent = state.payloadText || 'Aucun payload charge.';
    renderSummary(prefix, state.mediaPayload);
    renderDetailsStep(prefix);
    renderOptionsStepV2(prefix);

    if (state.mediaPayload || state.localImages.length) {
      renderMediaGrid(prefix, state.mediaPayload);
      setWorkspaceActiveStepShared(prefix, state.activeStep || 'media');
      const activeItem = state.activeMediaKey ? getMediaItemByKey(state, state.activeMediaKey) : null;
      if (activeItem) fillMediaLightbox(prefix, state.activeMediaKey);
      return;
    }

    renderPlaceholder(prefix, 'Charge une fiche source Etsy, puis exploite ici les mÃ©dias dÃ©jÃ  prÃ©sents dans le workspace.');
  };

  const loadEtsyWorkspaceMedia = async (prefix) => {
    const state = getState(prefix);
    const nodes = getNodes(prefix);
    if (!state || !nodes.input) return;

    const listingId = extractListingId(nodes.input.value);
    if (!listingId) {
      setStatusShared(prefix, 'Listing ID introuvable dans la reference fournie.');
      global.showToast?.('Listing Etsy introuvable', '#ff4757');
      renderWorkspace(prefix);
      return;
    }

    setStatusShared(prefix, `Chargement de la fiche source ${listingId}...`);

    try {
      const payload = await EtsyRuntime.fetchListingPayload(listingId);
      if (activeEditorSession?.prefix === prefix) closeImageEditorOverlay();
      closeCategoryPickerOverlay();
      closeOptionsOverlays();
      state.listingId = listingId;
      state.payloadEnvelope = payload || null;
      state.mediaPayload = EtsyData.normalizeEtsyListingPayload(payload?.payload || null);
      state.activeStep = 'media';
      state.detailsDraft = EtsyData.buildDetailsDraftFromPayload(state.mediaPayload);
      state.optionsDraft = EtsyData.buildOptionsDraftFromPayload(state.mediaPayload);
      state.isEditingCategory = false;
      state.mediaOrder = [];
      state.localImages = [];
      state.activeMediaKey = '';
      resetWorkspaceEditedImages(prefix);
      applyDetailsDraftToPayload(state);
      applyOptionsDraftToPayload(state);
      state.mediaOrder = buildDefaultMediaOrder(state);
      syncPayloadText(state);

      const imageCount = Array.isArray(state.mediaPayload?.data?.images) ? state.mediaPayload.data.images.length : 0;
      const videoCount = Array.isArray(state.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos.length : 0;
      setStatusShared(prefix, `Fiche source ${listingId} chargee - ${imageCount} image(s) - ${videoCount} video(s).`);
      renderWorkspace(prefix);
      global.showToast?.('Fiche Etsy source chargÃ©e');
    } catch (error) {
      destroySortable(prefix);
      if (activeEditorSession?.prefix === prefix) closeImageEditorOverlay();
      closeCategoryPickerOverlay();
      closeOptionsOverlays();
      state.payloadEnvelope = null;
      state.mediaPayload = null;
      state.payloadText = '';
      state.activeStep = 'media';
      state.detailsDraft = null;
      state.optionsDraft = null;
      state.isEditingCategory = false;
      state.mediaOrder = [];
      state.localImages = [];
      state.activeMediaKey = '';
      resetWorkspaceEditedImages(prefix);
      setStatusShared(prefix, `Lecture Etsy impossible : ${error.message}`);
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

  const initEtsyWorkspaceContext = (prefix) => {
    const nodes = getNodes(prefix);
    if (!nodes.panel || !nodes.input) return;

    if (nodes.panel.dataset.etsyWorkspaceBound === 'true') {
      renderWorkspace(prefix);
      return;
    }
    nodes.panel.dataset.etsyWorkspaceBound = 'true';

    ensureWorkspaceSourcePanelShared(prefix);
    configureWorkspaceProgressShared(prefix);

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
        setStatusShared(prefix, 'En attente dune fiche source.');
        return;
      }
      setStatusShared(prefix, `Reference detectee - listing ${listingId}`);
    });

    nodes.input.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      await loadEtsyWorkspaceMedia(prefix);
    });

    nodes.panel.addEventListener('click', async (event) => {
      const stepTrigger = event.target.closest('[data-js="etsy-step-trigger"][data-etsy-step]');
      if (stepTrigger && nodes.panel.contains(stepTrigger)) {
        setWorkspaceActiveStepShared(prefix, stepTrigger.dataset.etsyStep || 'media');
        return;
      }

      const categoryToggle = event.target.closest('[data-js="etsy-category-edit-toggle"]');
      if (categoryToggle && nodes.panel.contains(categoryToggle)) {
        await openCategoryPicker(prefix);
        return;
      }

      const optionsManage = event.target.closest('[data-js="etsy-options-manage"]');
      if (optionsManage && nodes.panel.contains(optionsManage)) {
        openOptionsModal(prefix);
      }
    });

    nodes.panel.addEventListener('input', (event) => {
      const titleInput = event.target.closest(`#etsyApiTitleInput-${prefix}`);
      if (titleInput && nodes.panel.contains(titleInput)) {
        updateDetailsDraft(prefix, { title: String(titleInput.value || '') });
        renderTitleCounter(prefix);
        return;
      }

      const descriptionInput = event.target.closest(`#etsyApiDescriptionInput-${prefix}`);
      if (descriptionInput && nodes.panel.contains(descriptionInput)) {
        updateDetailsDraft(prefix, { description: String(descriptionInput.value || '') });
        autoResizeDescription(prefix);
      }
    });

    const savedReference = restoreListingReference(prefix);
    if (savedReference) {
      nodes.input.value = savedReference;
      const listingId = extractListingId(savedReference);
      if (listingId) {
        setStatusShared(prefix, `Reference detectee - listing ${listingId}`);
      }
    }

    renderWorkspace(prefix);
  };

  const initEtsyWorkspace = () => {
    getEtsyUiTabletop().initTabletopWorkspace?.({
      initWorkspaceContext: initEtsyWorkspaceContext,
    });
    getEtsyUiCollection().initCollectionWorkspace?.({
      initWorkspaceContext: initEtsyWorkspaceContext,
    });
  };

  const initEtsyWorkspaceTabletop = () => {
    initEtsyWorkspaceContext('tt');
  };

  const initEtsyWorkspaceCollection = () => {
    initEtsyWorkspaceContext('col');
  };

  global.PipelineUIEtsyWorkspace = {
    initEtsyWorkspace,
    initEtsyWorkspaceContext,
    initEtsyWorkspaceTabletop,
    initEtsyWorkspaceCollection,
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


