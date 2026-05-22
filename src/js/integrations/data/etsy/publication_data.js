(function initPipelineUIEtsyPublicationData(global) {
  'use strict';

  const EtsyData = global.PipelineUIEtsyData || {};

  function getPublicationBasePrice(data, optionsDraft) {
    const basePrice = Number(optionsDraft?.basePrice);
    if (Number.isFinite(basePrice) && basePrice > 0) return basePrice;

    const inventoryProduct = Array.isArray(data?.inventory?.products) ? data.inventory.products[0] : null;
    const inventoryOffering = Array.isArray(inventoryProduct?.offerings) ? inventoryProduct.offerings[0] : null;
    const moneyValue = EtsyData.getMoneyNumber?.(inventoryOffering?.price ?? data?.price ?? 0);
    return Number.isFinite(moneyValue) ? moneyValue : 0;
  }

  function getPublicationBaseQuantity(data, optionsDraft) {
    const baseQuantity = Number(optionsDraft?.baseQuantity);
    if (Number.isFinite(baseQuantity) && baseQuantity >= 0) return baseQuantity;

    const inventoryProduct = Array.isArray(data?.inventory?.products) ? data.inventory.products[0] : null;
    const inventoryOffering = Array.isArray(inventoryProduct?.offerings) ? inventoryProduct.offerings[0] : null;
    const quantity = Number(inventoryOffering?.quantity ?? data?.quantity ?? 0);
    return Number.isFinite(quantity) ? quantity : 0;
  }

  function resolveRemoteImageKey(image, index) {
    return `image:${String(image?.listing_image_id || image?.image_id || index)}`;
  }

  function resolveLocalImageKey(image) {
    return `local-image:${String(image?.local_id || '')}`;
  }

  function getOrderedPublicationImages(state) {
    const data = state?.mediaPayload?.data || {};
    const remoteImages = Array.isArray(data.images) ? data.images : [];
    const localImages = Array.isArray(state?.localImages) ? state.localImages : [];
    const editedImageDataUrls = state?.editedImageDataUrls || {};
    const remoteMap = new Map(remoteImages.map((image, index) => [resolveRemoteImageKey(image, index), image]));
    const localMap = new Map(localImages.map((image) => [resolveLocalImageKey(image), image]));
    const defaultOrder = [
      ...remoteImages.map((image, index) => resolveRemoteImageKey(image, index)),
      ...localImages.map((image) => resolveLocalImageKey(image)),
    ];
    const activeOrder = Array.isArray(state?.mediaOrder) && state.mediaOrder.length ? state.mediaOrder : defaultOrder;
    const seen = new Set();
    const ordered = [];

    [...activeOrder, ...defaultOrder].forEach((key) => {
      if (!key || seen.has(key)) return;
      if (remoteMap.has(key)) {
        ordered.push({
          key,
          kind: 'remote',
          image: remoteMap.get(key),
          editedDataUrl: String(editedImageDataUrls[key] || '').trim(),
        });
        seen.add(key);
        return;
      }
      if (localMap.has(key)) {
        ordered.push({
          key,
          kind: 'local',
          image: localMap.get(key),
          editedDataUrl: String(editedImageDataUrls[key] || '').trim(),
        });
        seen.add(key);
      }
    });

    return ordered;
  }

  function buildPublicationImagesPlan(state) {
    return getOrderedPublicationImages(state).map((entry, index) => {
      const altText = String(entry.image?.alt_text || '').trim();
      const filename = String(
        entry.image?.name
        || entry.image?.filename
        || entry.image?.title
        || `etsy-image-${index + 1}.jpg`
      ).trim() || `etsy-image-${index + 1}.jpg`;

      if (entry.editedDataUrl) {
        return {
          order: index + 1,
          mode: 'upload',
          filename,
          alt_text: altText,
          data_url: entry.editedDataUrl,
        };
      }

      if (entry.kind === 'local') {
        return {
          order: index + 1,
          mode: 'upload',
          filename,
          alt_text: altText,
          data_url: String(entry.image?.data_url || ''),
        };
      }

      return {
        order: index + 1,
        mode: 'upload_remote',
        filename,
        alt_text: altText,
        remote_url: String(
          entry.image?.url_fullxfull
          || entry.image?.full_url
          || entry.image?.url_570xN
          || entry.image?.url_570xn
          || entry.image?.src
          || entry.image?.url
          || ''
        ).trim(),
      };
    }).filter((imagePlan) => {
      if (imagePlan.mode === 'upload') return !!imagePlan.data_url;
      if (imagePlan.mode === 'upload_remote') return !!imagePlan.remote_url;
      return false;
    });
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

  function buildDraftPublicationPayload(state) {
    const data = state?.mediaPayload?.data || {};
    const optionsDraft = state?.optionsDraft || null;
    const attributesDraft = state?.attributesDraft || null;
    const settingsDraft = state?.settingsDraft || null;
    const hasVideos = Array.isArray(data.videos) && data.videos.length > 0;

    const createPayload = {
      quantity: getPublicationBaseQuantity(data, optionsDraft),
      title: String(data.title || '').trim(),
      description: String(data.description || ''),
      price: getPublicationBasePrice(data, optionsDraft),
      who_made: String(data.who_made || '').trim(),
      when_made: String(data.when_made || '').trim(),
      taxonomy_id: Number(data.taxonomy_id || 0) || 0,
      shipping_profile_id: Number(data.shipping_profile_id || 0) || 0,
      readiness_state_id: Number(data.readiness_state_id || 0) || 0,
      is_supply: Boolean(data.is_supply),
      type: String(data.type || 'physical').trim() || 'physical',
    };

    const heightValue = attributesDraft?.dimensions?.height !== undefined && attributesDraft?.dimensions?.height !== null && String(attributesDraft.dimensions.height).trim() !== ''
      ? Number(attributesDraft.dimensions.height)
      : data.item_height;
    const widthValue = attributesDraft?.dimensions?.width !== undefined && attributesDraft?.dimensions?.width !== null && String(attributesDraft.dimensions.width).trim() !== ''
      ? Number(attributesDraft.dimensions.width)
      : data.item_width;
    const depthValue = attributesDraft?.dimensions?.depth !== undefined && attributesDraft?.dimensions?.depth !== null && String(attributesDraft.dimensions.depth).trim() !== ''
      ? Number(attributesDraft.dimensions.depth)
      : data.item_length;
    const dimensionUnitValue = String(attributesDraft?.dimensions?.unit || data.item_dimensions_unit || '').trim() || null;

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
    const images = buildPublicationImagesPlan(state);
    const dimensionProperties = buildPublicationDimensionProperties(state, attributesDraft);
    const hasRegionalPriceDiff = Array.isArray(optionsDraft?.products) && optionsDraft.products.some((product) => {
      const fr = Number(product?.prices?.fr);
      const us = Number(product?.prices?.us);
      const other = Number(product?.prices?.other);
      if (!Number.isFinite(fr)) return false;
      return (Number.isFinite(us) && us !== fr) || (Number.isFinite(other) && other !== fr);
    });
    const validationErrors = [];

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

    const warnings = [
      'Le listing_id source n est jamais renvoye a Etsy pour la creation du draft.',
      'Le draft est cree sur une nouvelle fiche, puis enrichi via inventory et images.',
    ];

    if (!images.length) {
      warnings.push('Aucune image ne sera envoyee sur ce test de duplication.');
    }
    if (hasVideos) {
      warnings.push('Les videos de la fiche source ne sont pas encore republiees.');
    }
    if (attributesDraft?.occasion) {
      warnings.push(`Fete locale preparee pour publication : ${attributesDraft.occasion}.`);
    }
    if (optionsDraft?.variations?.some((variation) => variation.photosEnabled)) {
      warnings.push('Les associations images de variations ne sont pas encore recopiees sur cette passe.');
    }
    if (hasRegionalPriceDiff) {
      warnings.push('Des prix US/autres pays differents de FR existent dans le draft local, mais l inventaire Etsy publie un seul price par offering.');
    }

    return {
      payload: {
        createPayload,
        updatePayload,
        inventory,
        images,
        attributes: {
          occasion: String(attributesDraft?.occasion || '').trim(),
          dimension_properties: dimensionProperties,
        },
      },
      validationErrors,
      sourceListingId: String(data.listing_id || '').trim(),
      warnings,
    };
  }

  global.PipelineUIEtsyData = {
    ...EtsyData,
    getPublicationBasePrice,
    getPublicationBaseQuantity,
    buildPublicationInventoryPayload,
    buildDraftPublicationPayload,
  };
})(window);
