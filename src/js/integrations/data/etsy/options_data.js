(function initPipelineUIEtsyOptionsData(global) {
  'use strict';

  const EtsyData = global.PipelineUIEtsyData || {};
  const CUSTOM_VARIATION_PROPERTY_IDS = Object.freeze(['513', '514']);

  const getMoneyNumber = EtsyData.getMoneyNumber || ((value) => {
    if (value && typeof value === 'object') {
      const amount = Number(value.amount);
      const divisor = Number(value.divisor);
      if (Number.isFinite(amount) && Number.isFinite(divisor) && divisor > 0) {
        return amount / divisor;
      }

      const fallbackValue = Number(
        value.value
        ?? value.price
        ?? value.amount_with_divisor
        ?? value.amount_including_tax
        ?? NaN
      );
      return Number.isFinite(fallbackValue) ? fallbackValue : 0;
    }

    const raw = Number(value);
    return Number.isFinite(raw) ? raw : 0;
  });

  function formatMoneyInput(value) {
    const amount = getMoneyNumber(value);
    return amount ? amount.toFixed(2).replace('.', ',') : '';
  }

  function parseMoneyInput(value) {
    const normalized = String(value || '').replace(/\s+/g, '').replace(',', '.');
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function buildOptionValueLabel(propertyValue) {
    if (!propertyValue || typeof propertyValue !== 'object') return '';

    const values = Array.isArray(propertyValue.values) ? propertyValue.values : [];
    if (values.length) {
      return values.map((item) => String(item || '').trim()).filter(Boolean).join(' / ');
    }

    if (typeof propertyValue.value === 'string' && propertyValue.value.trim()) {
      return propertyValue.value.trim();
    }

    return '';
  }

  function buildOptionVariationName(propertyValue, index) {
    if (!propertyValue || typeof propertyValue !== 'object') {
      return `Variation ${index + 1}`;
    }

    return String(
      propertyValue.property_name
      || propertyValue.name
      || propertyValue.formatted_name
      || `Variation ${index + 1}`
    ).trim();
  }

  function createDefaultOptionValue(label = '') {
    return {
      id: `opt-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      label: String(label || '').trim(),
      enabled: true,
      imageUrl: '',
      imageKey: '',
    };
  }

  function buildOptionComboKey(variationSelections) {
    return (Array.isArray(variationSelections) ? variationSelections : [])
      .map((selection) => `${selection.variationId}:${selection.optionId}`)
      .join('|');
  }

  function cartesianProduct(groups) {
    if (!Array.isArray(groups) || !groups.length) return [[]];
    return groups.reduce((accumulator, group) => {
      const next = [];
      accumulator.forEach((base) => {
        (Array.isArray(group) ? group : []).forEach((entry) => {
          next.push([...base, entry]);
        });
      });
      return next;
    }, [[]]);
  }

  function normalizeVariationRuleIds(ids, variations) {
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
  }

  function resolveVariationRuleIds(values, variations) {
    const normalizedValues = (Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean);
    const propertyIds = new Set(normalizedValues);
    const directIds = new Set(normalizedValues);

    return normalizeVariationRuleIds(
      (variations || [])
        .filter((variation) => (
          propertyIds.has(String(variation.propertyId || '').trim())
          || directIds.has(String(variation.id || '').trim())
        ))
        .map((variation) => variation.id),
      variations,
    );
  }

  function serializeVariationRuleIds(ids, variations) {
    return normalizeVariationRuleIds(ids, variations).join('|');
  }

  function parseVariationRuleValue(value, variations) {
    return normalizeVariationRuleIds(
      String(value || '').split('|').map((item) => item.trim()).filter(Boolean),
      variations,
    );
  }

  function getVariationRuleLabel(ids, variations) {
    const normalizedIds = normalizeVariationRuleIds(ids, variations);
    if (!normalizedIds.length) return 'Aucune';
    return normalizedIds
      .map((id) => (variations || []).find((variation) => variation.id === id)?.name || id)
      .join(' et ');
  }

  function buildVariationRuleOptions(variations) {
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
  }

  function buildOptionsDraftFromPayload(mediaPayload) {
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
      autoRenew: data.should_auto_renew !== false,
    };
  }

  function buildProductScopeKey(product, scopeIds, variations) {
    const normalizedIds = normalizeVariationRuleIds(scopeIds, variations);
    if (!normalizedIds.length) return '__all__';

    const selectionMap = new Map((product?.selections || []).map((selection) => [String(selection.variationId || '').trim(), selection]));
    return normalizedIds.map((variationId) => {
      const selection = selectionMap.get(variationId);
      return `${variationId}:${String(selection?.optionId || '').trim()}`;
    }).join('|');
  }

  function updateScopedProducts(draft, sourceProductId, scopeIds, updater) {
    const sourceProduct = (draft?.products || []).find((product) => product.id === sourceProductId);
    if (!sourceProduct) return;

    const scopeKey = buildProductScopeKey(sourceProduct, scopeIds, draft.variations || []);
    (draft.products || []).forEach((product) => {
      if (buildProductScopeKey(product, scopeIds, draft.variations || []) !== scopeKey) return;
      updater(product, sourceProduct);
    });
  }

  function getProductSelection(product, variationId) {
    return (product?.selections || []).find((selection) => (
      String(selection.variationId || '').trim() === String(variationId || '').trim()
    )) || null;
  }

  function rebuildOptionProducts(draft) {
    if (!draft) return draft;

    const activeVariations = (draft.variations || [])
      .map((variation) => ({
        ...variation,
        options: (variation.options || []).filter((option) => option.enabled !== false && String(option.label || '').trim()),
      }))
      .filter((variation) => variation.options.length);

    if (!activeVariations.length) {
      draft.products = [];
      return draft;
    }

    const existingMap = new Map((draft.products || []).map((product) => [product.comboKey, product]));
    const combinations = cartesianProduct(activeVariations.map((variation) => (
      variation.options.map((option) => ({
        variationId: variation.id,
        propertyId: variation.propertyId,
        variationName: variation.name,
        optionId: option.id,
        label: option.label,
      }))
    )));

    draft.products = combinations.map((combination, index) => {
      const comboKey = buildOptionComboKey(combination);
      const existing = existingMap.get(comboKey);
      return {
        id: existing?.id || `product-${index + 1}`,
        comboKey,
        selections: combination.map((item) => ({
          variationId: item.variationId,
          optionId: item.optionId,
          label: item.label,
        })),
        sku: existing?.sku || '',
        prices: {
          fr: existing?.prices?.fr ?? draft.basePrice ?? 0,
          us: existing?.prices?.us ?? draft.basePrice ?? 0,
          other: existing?.prices?.other ?? draft.basePrice ?? 0,
        },
        enabled: existing?.enabled ?? true,
        quantity: existing?.quantity ?? draft.baseQuantity ?? 0,
      };
    });

    if (!Array.isArray(draft.priceVariesByIds) || !draft.priceVariesByIds.length) {
      draft.priceVariesByIds = activeVariations[0]?.id ? [activeVariations[0].id] : [];
    }
    if (!Array.isArray(draft.skuVariesByIds) || !draft.skuVariesByIds.length) {
      draft.skuVariesByIds = activeVariations[0]?.id ? [activeVariations[0].id] : [];
    }

    return draft;
  }

  function applyOptionsDraftToPayload(data, draft) {
    if (!data || typeof data !== 'object' || !draft || typeof draft !== 'object') return data;

    rebuildOptionProducts(draft);

    const inventory = data.inventory && typeof data.inventory === 'object' ? data.inventory : {};
    const variationMap = new Map((draft.variations || []).map((variation) => [variation.id, variation]));

    inventory.products = (draft.products || []).map((product) => {
      const priceValue = getMoneyNumber(product.prices?.fr);
      return {
        sku: String(product.sku || '').trim(),
        property_values: (product.selections || []).map((selection) => {
          const variation = variationMap.get(selection.variationId);
          return {
            property_id: Number(variation?.propertyId || selection.variationId) || selection.variationId,
            property_name: variation?.name || 'Variation',
            values: [selection.label],
          };
        }),
        offerings: [{
          price: priceValue,
          quantity: Number(product.quantity || 0) || 0,
          is_enabled: product.enabled !== false,
        }],
      };
    });

    inventory.price_on_property = normalizeVariationRuleIds(draft.priceVariesByIds, draft.variations || [])
      .map((variationId) => Number(variationMap.get(variationId)?.propertyId || variationId) || variationId);
    inventory.sku_on_property = normalizeVariationRuleIds(draft.skuVariesByIds, draft.variations || [])
      .map((variationId) => Number(variationMap.get(variationId)?.propertyId || variationId) || variationId);
    inventory.quantity_on_property = normalizeVariationRuleIds(draft.quantityVariesByIds, draft.variations || [])
      .map((variationId) => Number(variationMap.get(variationId)?.propertyId || variationId) || variationId);

    data.inventory = inventory;
    data.should_auto_renew = draft.autoRenew !== false;
    return data;
  }

  global.PipelineUIEtsyData = {
    ...EtsyData,
    CUSTOM_VARIATION_PROPERTY_IDS,
    getMoneyNumber,
    formatMoneyInput,
    parseMoneyInput,
    buildOptionValueLabel,
    buildOptionVariationName,
    createDefaultOptionValue,
    buildOptionComboKey,
    cartesianProduct,
    normalizeVariationRuleIds,
    resolveVariationRuleIds,
    serializeVariationRuleIds,
    parseVariationRuleValue,
    getVariationRuleLabel,
    buildVariationRuleOptions,
    buildProductScopeKey,
    updateScopedProducts,
    getProductSelection,
    buildOptionsDraftFromPayload,
    rebuildOptionProducts,
    applyOptionsDraftToPayload,
  };
})(window);
