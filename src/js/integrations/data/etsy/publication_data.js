(function initPipelineUIEtsyPublicationData(global) {
  'use strict';

  const EtsyData = global.PipelineUIEtsyData || {};
  const DEFAULT_WHO_MADE = 'i_did';
  const DEFAULT_WHEN_MADE = 'made_to_order';
  const DEFAULT_IS_SUPPLY = false;
  const CREATE_PAYLOAD_EXCLUDED_KEYS = new Set([
    'listing_id',
    'shop_id',
    'user_id',
    'state',
    'images',
    'videos',
    'inventory',
    'featured_data',
    'collections',
    'translations',
    'products',
    'offerings',
    'results',
    'taxonomy_path',
    'category_path',
    'category_name',
    'item_type',
    'legacy_state',
    'main_image_id',
    'favorers',
  ]);
  const CREATE_PAYLOAD_EXCLUDED_KEY_PATTERNS = [
    /^url$/i,
    /^url_/i,
    /_url$/i,
    /^image_/i,
    /^video_/i,
    /_image_id$/i,
    /_video_id$/i,
    /_path$/i,
    /_name$/i,
    /(?:^|_)(?:created|creation|modified|updated|ending|original)_/i,
    /(?:^|_)(?:tsz|timestamp)$/i,
    /(?:^|_)(?:views|view_count|num_favorers|favorers|is_favorite)$/i,
  ];

  function isPrimitivePublicationValue(value) {
    const valueType = typeof value;
    return value === null
      || valueType === 'string'
      || valueType === 'number'
      || valueType === 'boolean';
  }

  function isCreatableListingKey(key = '') {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return false;
    if (CREATE_PAYLOAD_EXCLUDED_KEYS.has(normalizedKey)) return false;
    return !CREATE_PAYLOAD_EXCLUDED_KEY_PATTERNS.some((pattern) => pattern.test(normalizedKey));
  }

  function normalizeCreatableListingValue(value) {
    if (isPrimitivePublicationValue(value)) return value;
    if (Array.isArray(value)) {
      const normalizedEntries = value.filter(isPrimitivePublicationValue);
      return normalizedEntries.length ? normalizedEntries : undefined;
    }
    return undefined;
  }

  function extractCreatableListingPayload(data) {
    if (!data || typeof data !== 'object') return {};

    const createPayload = {};
    Object.entries(data).forEach(([key, rawValue]) => {
      if (!isCreatableListingKey(key)) return;
      const normalizedValue = normalizeCreatableListingValue(rawValue);
      if (typeof normalizedValue === 'undefined') return;
      createPayload[key] = normalizedValue;
    });

    const sectionId = Number(data.shop_section_id || 0) || 0;
    if (sectionId) createPayload.section_id = sectionId;
    delete createPayload.shop_section_id;

    return createPayload;
  }

  function getPublicationBasePrice(data) {
    const inventoryProduct = Array.isArray(data?.inventory?.products) ? data.inventory.products[0] : null;
    const inventoryOffering = Array.isArray(inventoryProduct?.offerings) ? inventoryProduct.offerings[0] : null;
    const moneyValue = EtsyData.getMoneyNumber?.(inventoryOffering?.price ?? data?.price ?? 0);
    return Number.isFinite(moneyValue) ? moneyValue : 0;
  }

  function getPublicationBaseQuantity(data) {
    const inventoryProduct = Array.isArray(data?.inventory?.products) ? data.inventory.products[0] : null;
    const inventoryOffering = Array.isArray(inventoryProduct?.offerings) ? inventoryProduct.offerings[0] : null;
    const quantity = Number(inventoryOffering?.quantity ?? data?.quantity ?? 0);
    return Number.isFinite(quantity) ? quantity : 0;
  }

  function resolveRemoteImageKey(image, index) {
    return `image:${String(image?.listing_image_id || image?.image_id || index)}`;
  }

  function resolveRemoteVideoKey(video, index) {
    return `video:${String(video?.video_id || video?.listing_video_id || index)}`;
  }

  function resolveLocalImageKey(image) {
    return `local-image:${String(image?.local_id || '')}`;
  }

  function resolveLocalVideoKey(video) {
    return `local-video:${String(video?.local_id || '')}`;
  }

  function resolvePublicationRemoteImageUrl(image) {
    const directUrl = String(
      image?.url_fullxfull
      || image?.full_url
      || image?.url_570xN
      || image?.url_570xn
      || image?.url_170x135
      || image?.url_75x75
      || image?.src
      || image?.url
      || ''
    ).trim();
    if (directUrl) return directUrl;

    const sources = Array.isArray(image?.sources) ? image.sources : [];
    const sourceUrl = [...sources]
      .reverse()
      .map((entry) => String(entry?.url || entry?.src || '').trim())
      .find(Boolean);
    if (sourceUrl) return sourceUrl;

    const sizes = Array.isArray(image?.sizes) ? image.sizes : [];
    const sizedUrl = [...sizes]
      .reverse()
      .map((entry) => String(entry?.url || entry?.src || '').trim())
      .find(Boolean);
    if (sizedUrl) return sizedUrl;

    return '';
  }

  function getOrderedPublicationMedia(state) {
    const data = state?.mediaPayload?.data || {};
    const remoteImages = Array.isArray(data.images) ? data.images : [];
    const remoteVideos = Array.isArray(data.videos) ? data.videos : [];
    const localImages = Array.isArray(state?.localImages) ? state.localImages : [];
    const localVideos = Array.isArray(state?.localVideos) ? state.localVideos : [];
    const editedImageDataUrls = state?.editedImageDataUrls || {};
    const remoteMap = new Map(remoteImages.map((image, index) => [resolveRemoteImageKey(image, index), image]));
    const videoMap = new Map(remoteVideos.map((video, index) => [resolveRemoteVideoKey(video, index), video]));
    const localMap = new Map(localImages.map((image) => [resolveLocalImageKey(image), image]));
    const localVideoMap = new Map(localVideos.map((video) => [resolveLocalVideoKey(video), video]));
    const defaultOrder = [
      ...remoteImages.map((image, index) => resolveRemoteImageKey(image, index)),
      ...remoteVideos.map((video, index) => resolveRemoteVideoKey(video, index)),
      ...localImages.map((image) => resolveLocalImageKey(image)),
      ...localVideos.map((video) => resolveLocalVideoKey(video)),
    ];
    const activeOrder = Array.isArray(state?.mediaOrder) && state.mediaOrder.length ? state.mediaOrder : defaultOrder;
    const seen = new Set();
    const ordered = [];

    [...activeOrder, ...defaultOrder].forEach((key) => {
      if (!key || seen.has(key)) return;
      if (remoteMap.has(key)) {
        ordered.push({
          key,
          kind: 'image',
          value: remoteMap.get(key),
          editedDataUrl: String(editedImageDataUrls[key] || '').trim(),
        });
        seen.add(key);
        return;
      }
      if (videoMap.has(key)) {
        ordered.push({
          key,
          kind: 'video',
          value: videoMap.get(key),
        });
        seen.add(key);
        return;
      }
      if (localMap.has(key)) {
        ordered.push({
          key,
          kind: 'local-image',
          value: localMap.get(key),
          editedDataUrl: String(editedImageDataUrls[key] || '').trim(),
        });
        seen.add(key);
        return;
      }
      if (localVideoMap.has(key)) {
        ordered.push({
          key,
          kind: 'local-video',
          value: localVideoMap.get(key),
        });
        seen.add(key);
      }
    });

    return ordered;
  }

  function buildPublicationImagesPlan(state) {
    const orderedEntries = getOrderedPublicationMedia(state);
    const sourceImages = Array.isArray(state?.mediaPayload?.data?.images) ? state.mediaPayload.data.images : [];
    const sourceVideos = Array.isArray(state?.mediaPayload?.data?.videos) ? state.mediaPayload.data.videos : [];
    const localImages = Array.isArray(state?.localImages) ? state.localImages : [];
    const localVideos = Array.isArray(state?.localVideos) ? state.localVideos : [];

    const images = orderedEntries.flatMap((entry, orderedIndex) => {
      if (entry.kind !== 'image' && entry.kind !== 'local-image') return [];
      const image = entry.value;
      const altText = String(image?.alt_text || '').trim();
      const filename = String(
        image?.name
        || image?.filename
        || image?.title
        || `etsy-image-${orderedIndex + 1}.jpg`
      ).trim() || `etsy-image-${orderedIndex + 1}.jpg`;

      if (entry.editedDataUrl) {
        return [{
          order: orderedIndex + 1,
          mode: 'upload',
          filename,
          alt_text: altText,
          data_url: entry.editedDataUrl,
        }];
      }

      if (entry.kind === 'local-image') {
        return [{
          order: orderedIndex + 1,
          mode: 'upload',
          filename,
          alt_text: altText,
          data_url: String(image?.data_url || ''),
        }];
      }

      return [{
        order: orderedIndex + 1,
        mode: 'upload_remote',
        filename,
        alt_text: altText,
        remote_url: resolvePublicationRemoteImageUrl(image),
      }];
    }).filter((imagePlan) => {
      if (imagePlan.mode === 'upload') return !!imagePlan.data_url;
      if (imagePlan.mode === 'upload_remote') return !!imagePlan.remote_url;
      return false;
    });

    const videos = orderedEntries.flatMap((entry, orderedIndex) => {
      if (entry.kind !== 'video' && entry.kind !== 'local-video') return [];
      const video = entry.value;
      if (entry.kind === 'local-video') {
        return [{
          order: orderedIndex + 1,
          mode: 'upload',
          filename: String(
            video?.name
            || video?.filename
            || video?.title
            || `etsy-video-${orderedIndex + 1}.mp4`
          ).trim() || `etsy-video-${orderedIndex + 1}.mp4`,
          data_url: String(video?.data_url || '').trim(),
        }];
      }
      return [{
        order: orderedIndex + 1,
        mode: 'upload_remote',
        filename: String(
          video?.name
          || video?.filename
          || video?.title
          || `etsy-video-${orderedIndex + 1}.mp4`
        ).trim() || `etsy-video-${orderedIndex + 1}.mp4`,
        remote_url: String(video?.video_url || '').trim(),
      }];
    }).filter((videoPlan) => (videoPlan.mode === 'upload' ? !!videoPlan.data_url : !!videoPlan.remote_url));

    return {
      images,
      videos,
      mediaPlan: {
        sourceImageCount: sourceImages.length,
        sourceVideoCount: sourceVideos.length,
        localImageCount: localImages.length,
        localVideoCount: localVideos.length,
        orderedMediaCount: orderedEntries.length,
        plannedImageCount: images.length,
        plannedVideoCount: videos.length,
        skippedVideoCount: Math.max(0, sourceVideos.length - videos.length),
      },
    };
  }

  function buildPublicationInventoryPayload(data) {
    const inventory = data?.inventory && typeof data.inventory === 'object' ? data.inventory : {};
    const products = Array.isArray(inventory.products) ? inventory.products : [];
    const listingReadinessStateId = Number(data?.readiness_state_id || 0) || 0;

    if (!products.length) return null;

    return {
      products: products.map((product) => ({
        sku: String(product?.sku || '').trim(),
        property_values: (Array.isArray(product?.property_values) ? product.property_values : [])
          .map((propertyValue) => ({
            property_id: Number(propertyValue?.property_id || 0) || 0,
            property_name: String(propertyValue?.property_name || '').trim(),
            scale_id: Number(propertyValue?.scale_id || 0) || undefined,
            value_ids: Array.isArray(propertyValue?.value_ids)
              ? propertyValue.value_ids.map((value) => Number(value || 0)).filter((value) => value > 0)
              : undefined,
            values: Array.isArray(propertyValue?.values)
              ? propertyValue.values.map((value) => String(value || '').trim()).filter(Boolean)
              : [],
          }))
          .filter((propertyValue) => propertyValue.property_id || propertyValue.values.length),
        offerings: (Array.isArray(product?.offerings) ? product.offerings : [])
          .map((offering) => ({
            price: EtsyData.getMoneyNumber?.(offering?.price ?? 0) || 0,
            quantity: Number(offering?.quantity ?? 0) || 0,
            is_enabled: offering?.is_enabled !== false,
            readiness_state_id: Number(offering?.readiness_state_id || listingReadinessStateId || 0) || undefined,
          }))
          .filter((offering) => offering.price > 0 || offering.quantity >= 0),
      })).filter((product) => product.offerings.length),
      price_on_property: Array.isArray(inventory.price_on_property)
        ? inventory.price_on_property.map((value) => Number(value || 0)).filter((value) => value > 0)
        : [],
      sku_on_property: Array.isArray(inventory.sku_on_property)
        ? inventory.sku_on_property.map((value) => Number(value || 0)).filter((value) => value > 0)
        : [],
      quantity_on_property: Array.isArray(inventory.quantity_on_property)
        ? inventory.quantity_on_property.map((value) => Number(value || 0)).filter((value) => value > 0)
        : [],
      readiness_state_on_property: Array.isArray(inventory.readiness_state_on_property)
        ? inventory.readiness_state_on_property.map((value) => Number(value || 0)).filter((value) => value > 0)
        : [],
    };
  }

  function getListingPropertyResults(state) {
    const results = state?.listingPropertiesPayload?.payload?.data?.results;
    return Array.isArray(results) ? results.filter((entry) => entry && typeof entry === 'object') : [];
  }

  function buildPublicationDimensionProperties(state, attributesDraft) {
    const requestedDimensions = {
      height: String(attributesDraft?.dimensions?.height || '').trim(),
      width: String(attributesDraft?.dimensions?.width || '').trim(),
      depth: String(attributesDraft?.dimensions?.depth || '').trim(),
    };
    const dimensionProperties = [];

    getListingPropertyResults(state).forEach((entry) => {
      const propertyName = String(entry.property_name || entry.name || '').trim().toLowerCase();
      let dimensionKey = '';
      if (propertyName.includes('height') || propertyName.includes('hauteur')) dimensionKey = 'height';
      else if (propertyName.includes('width') || propertyName.includes('largeur')) dimensionKey = 'width';
      else if (propertyName.includes('depth') || propertyName.includes('profondeur') || propertyName.includes('length') || propertyName.includes('longueur')) dimensionKey = 'depth';
      if (!dimensionKey) return;

      const requestedValue = requestedDimensions[dimensionKey];
      if (!requestedValue) return;

      const valueIds = Array.isArray(entry.value_ids)
        ? entry.value_ids.map((value) => Number(value || 0)).filter((value) => value > 0)
        : [];
      const propertyId = Number(entry.property_id || 0) || 0;
      const scaleId = Number(entry.scale_id || 0) || 0;
      if (!propertyId) return;

      dimensionProperties.push({
        property_id: propertyId,
        property_name: String(entry.property_name || entry.name || '').trim(),
        scale_id: scaleId || null,
        value_ids: valueIds,
        values: [requestedValue],
      });
    });

    return dimensionProperties;
  }

  function getOriginScaleDimensionFallback(state) {
    const prefix = String(state?.prefix || '').trim();
    const originDimensions = global.PipelineUIEchelles?.getOriginScaleDimensions?.(prefix);
    if (!originDimensions) return null;

    return {
      height: Number.isFinite(Number(originDimensions.height)) && Number(originDimensions.height) > 0
        ? Number(originDimensions.height)
        : null,
      width: Number.isFinite(Number(originDimensions.width)) && Number(originDimensions.width) > 0
        ? Number(originDimensions.width)
        : null,
      depth: Number.isFinite(Number(originDimensions.depth)) && Number(originDimensions.depth) > 0
        ? Number(originDimensions.depth)
        : null,
      unit: String(originDimensions.unit || '').trim() || 'mm',
    };
  }

  function buildDraftPublicationPayload(state) {
    const data = state?.mediaPayload?.data || {};
    const attributesDraft = state?.attributesDraft || null;
    const hasVideos = Array.isArray(data.videos) && data.videos.length > 0;
    const originDimensionFallback = getOriginScaleDimensionFallback(state);

    const createPayload = {
      ...extractCreatableListingPayload(data),
      quantity: getPublicationBaseQuantity(data),
      title: String(data.title || '').trim(),
      description: String(data.description || ''),
      price: getPublicationBasePrice(data),
      who_made: String(data.who_made || '').trim() || DEFAULT_WHO_MADE,
      when_made: String(data.when_made || '').trim() || DEFAULT_WHEN_MADE,
      taxonomy_id: Number(data.taxonomy_id || 0) || 0,
      shipping_profile_id: Number(data.shipping_profile_id || 0) || 0,
      readiness_state_id: Number(data.readiness_state_id || 0) || 0,
      is_supply: data.is_supply === true ? true : DEFAULT_IS_SUPPLY,
      type: String(data.type || 'physical').trim() || 'physical',
    };

    const heightValue = attributesDraft?.dimensions?.height !== undefined && attributesDraft?.dimensions?.height !== null && String(attributesDraft.dimensions.height).trim() !== ''
      ? Number(attributesDraft.dimensions.height)
      : (data.item_height ?? originDimensionFallback?.height ?? null);
    const widthValue = attributesDraft?.dimensions?.width !== undefined && attributesDraft?.dimensions?.width !== null && String(attributesDraft.dimensions.width).trim() !== ''
      ? Number(attributesDraft.dimensions.width)
      : (data.item_width ?? originDimensionFallback?.width ?? null);
    const depthValue = attributesDraft?.dimensions?.depth !== undefined && attributesDraft?.dimensions?.depth !== null && String(attributesDraft.dimensions.depth).trim() !== ''
      ? Number(attributesDraft.dimensions.depth)
      : (data.item_length ?? originDimensionFallback?.depth ?? null);
    const dimensionUnitValue = String(
      attributesDraft?.dimensions?.unit
      || data.item_dimensions_unit
      || originDimensionFallback?.unit
      || ''
    ).trim() || null;

    const updatePayload = {
      tags: Array.isArray(data.tags) ? data.tags : [],
      item_height: Number.isFinite(Number(heightValue)) && Number(heightValue) > 0 ? Number(heightValue) : null,
      item_width: Number.isFinite(Number(widthValue)) && Number(widthValue) > 0 ? Number(widthValue) : null,
      item_length: Number.isFinite(Number(depthValue)) && Number(depthValue) > 0 ? Number(depthValue) : null,
      item_dimensions_unit: dimensionUnitValue,
      section_id: data.shop_section_id ?? null,
      featured_rank: data.featured_rank ?? 0,
      should_auto_renew: data.should_auto_renew !== false,
      should_advertise: data.should_advertise === true,
    };

    if (updatePayload.item_height) createPayload.item_height = updatePayload.item_height;
    if (updatePayload.item_width) createPayload.item_width = updatePayload.item_width;
    if (updatePayload.item_length) createPayload.item_length = updatePayload.item_length;
    if (updatePayload.item_dimensions_unit) createPayload.item_dimensions_unit = updatePayload.item_dimensions_unit;

    const inventory = buildPublicationInventoryPayload(data);
    const imagePlan = buildPublicationImagesPlan(state);
    const images = imagePlan.images;
    const videos = imagePlan.videos;
    const dimensionProperties = buildPublicationDimensionProperties(state, attributesDraft);
    const validationErrors = [];
    const oversizedAltImageIndexes = images
      .map((image, index) => (String(image?.alt_text || '').length > 500 ? index + 1 : 0))
      .filter(Boolean);

    if (!Number.isFinite(createPayload.quantity)) validationErrors.push('quantity manquante');
    if (!createPayload.title) validationErrors.push('title manquant');
    if (!createPayload.description) validationErrors.push('description manquante');
    if (!createPayload.price) validationErrors.push('price manquant');
    if (!createPayload.who_made) validationErrors.push('who_made manquant');
    if (!createPayload.when_made) validationErrors.push('when_made manquant');
    if (!createPayload.taxonomy_id) validationErrors.push('taxonomy_id manquant');
    if (createPayload.type !== 'download') {
      if (!createPayload.shipping_profile_id) validationErrors.push('shipping_profile_id manquant');
      if (!createPayload.readiness_state_id) validationErrors.push('readiness_state_id manquant');
    }

    if (inventory && !inventory.products.length) {
      validationErrors.push('inventory.products vide');
    }
    if (oversizedAltImageIndexes.length) {
      validationErrors.push(`ALT Etsy superieure a 500 caracteres sur image(s) ${oversizedAltImageIndexes.join(' ')}`);
    }

    const warnings = [];

    if (!images.length) {
      warnings.push('Aucune image ne sera envoyee sur ce test de duplication.');
    }
    if (hasVideos) {
      if (!videos.length) {
        warnings.push('Aucune video publishable n a ete preparee depuis la fiche source.');
      }
    }
    if (attributesDraft?.occasion) {
      warnings.push(`Fete locale preparee pour publication : ${attributesDraft.occasion}.`);
    }

    return {
      payload: {
        createPayload,
        updatePayload,
        inventory,
        images,
        videos,
        mediaPlan: imagePlan.mediaPlan,
        attributes: {
          occasion: String(attributesDraft?.occasion || '').trim(),
          dimension_properties: dimensionProperties,
        },
      },
      validationErrors,
      sourceListingId: String(data.listing_id || '').trim(),
      sourceListingState: String(data.state || '').trim().toLowerCase(),
      warnings,
    };
  }

  global.PipelineUIEtsyData = {
    ...EtsyData,
    getPublicationBasePrice,
    getPublicationBaseQuantity,
    extractCreatableListingPayload,
    buildPublicationInventoryPayload,
    buildDraftPublicationPayload,
  };
})(window);
