(function initPipelineUIEtsyListingData(global) {
  'use strict';

  const EtsyData = global.PipelineUIEtsyData || {};

  function splitCategoryPath(value = '') {
    return String(value || '')
      .split('>')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function decodeHtmlEntities(value = '') {
    const text = String(value || '');
    if (!text || !/[&]/.test(text)) return text;

    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  function getCategoryPathParts(data) {
    if (!data || typeof data !== 'object') return [];

    if (Array.isArray(data.taxonomy_path) && data.taxonomy_path.length) {
      return data.taxonomy_path.map((part) => String(part || '').trim()).filter(Boolean);
    }

    if (Array.isArray(data.category_path) && data.category_path.length) {
      return data.category_path.map((part) => String(part || '').trim()).filter(Boolean);
    }

    if (typeof data.category_path === 'string' && data.category_path.trim()) {
      return splitCategoryPath(data.category_path);
    }

    if (typeof data.taxonomy_path === 'string' && data.taxonomy_path.trim()) {
      return splitCategoryPath(data.taxonomy_path);
    }

    return [];
  }

  function normalizeEtsyListingPayload(mediaPayload) {
    const payload = mediaPayload && typeof mediaPayload === 'object' ? mediaPayload : {};
    const rawData = payload.data && typeof payload.data === 'object' ? payload.data : {};
    const data = Array.isArray(rawData.results) ? (rawData.results[0] || {}) : rawData;
    const normalizeAssociationCollection = (value) => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') {
        if (Array.isArray(value.results)) return value.results;
        if (Array.isArray(value.data)) return value.data;
        if (Array.isArray(value.items)) return value.items;
      }
      return [];
    };
    const images = (
      normalizeAssociationCollection(data.images).length ? normalizeAssociationCollection(data.images)
      : normalizeAssociationCollection(data.Images).length ? normalizeAssociationCollection(data.Images)
      : []
    );
    const videos = (
      normalizeAssociationCollection(data.videos).length ? normalizeAssociationCollection(data.videos)
      : normalizeAssociationCollection(data.Videos).length ? normalizeAssociationCollection(data.Videos)
      : []
    );
    const inventory = (
      data.inventory && typeof data.inventory === 'object' ? data.inventory
      : data.Inventory && typeof data.Inventory === 'object' ? data.Inventory
      : rawData.inventory && typeof rawData.inventory === 'object' ? rawData.inventory
      : rawData.Inventory && typeof rawData.Inventory === 'object' ? rawData.Inventory
      : {}
    );

    const normalizedTitle = decodeHtmlEntities(data.title || rawData.title || '');
    const normalizedDescription = decodeHtmlEntities(data.description || rawData.description || '');
    const rawTags = Array.isArray(data.tags)
      ? data.tags
      : Array.isArray(rawData.tags)
        ? rawData.tags
        : [];
    const normalizedTags = rawTags.map((tag) => decodeHtmlEntities(tag));

    return {
      ...payload,
      data: {
        ...data,
        listing_id: data.listing_id || rawData.listing_id || payload.listing_id || '',
        title: normalizedTitle,
        description: normalizedDescription,
        tags: normalizedTags,
        inventory,
        images,
        videos,
      },
    };
  }

  function extractListingPropertyEntries(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const candidates = [
      source?.payload?.data?.results,
      source?.payload?.data?.properties,
      source?.payload?.data,
      source?.payload?.results,
      source?.results,
      source?.data,
      source?.properties,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate.filter((entry) => entry && typeof entry === 'object');
      if (candidate && typeof candidate === 'object') {
        if (Array.isArray(candidate.results)) return candidate.results.filter((entry) => entry && typeof entry === 'object');
        if (Array.isArray(candidate.properties)) return candidate.properties.filter((entry) => entry && typeof entry === 'object');
        if (Array.isArray(candidate.items)) return candidate.items.filter((entry) => entry && typeof entry === 'object');
      }
    }

    return [];
  }

  function getListingPropertyLabel(entry) {
    return String(
      entry?.property_name
      || entry?.name
      || entry?.display_name
      || entry?.formatted_name
      || ''
    ).trim();
  }

  function getListingPropertyScale(entry) {
    return String(
      entry?.scale_name
      || entry?.selected_scale_name
      || entry?.scale?.display_name
      || entry?.scale?.name
      || ''
    ).trim();
  }

  function getListingPropertyFirstValue(entry) {
    const directValues = Array.isArray(entry?.values) ? entry.values : [];
    if (directValues.length) {
      const firstValue = directValues[0];
      if (firstValue && typeof firstValue === 'object') {
        return String(
          firstValue.value
          || firstValue.name
          || firstValue.formatted_name
          || firstValue.display_name
          || ''
        ).trim();
      }
      return String(firstValue || '').trim();
    }

    const valueObjects = Array.isArray(entry?.property_values) ? entry.property_values : [];
    if (valueObjects.length) {
      const firstValue = valueObjects[0];
      if (firstValue && typeof firstValue === 'object') {
        const nestedValues = Array.isArray(firstValue.values) ? firstValue.values : [];
        if (nestedValues.length) {
          const nestedFirst = nestedValues[0];
          if (nestedFirst && typeof nestedFirst === 'object') {
            return String(
              nestedFirst.value
              || nestedFirst.name
              || nestedFirst.formatted_name
              || nestedFirst.display_name
              || ''
            ).trim();
          }
          return String(nestedFirst || '').trim();
        }

        return String(
          firstValue.value
          || firstValue.name
          || firstValue.formatted_name
          || firstValue.display_name
          || ''
        ).trim();
      }
    }

    return String(entry?.value || '').trim();
  }

  function getListingPropertyNumber(entry) {
    const rawValue = getListingPropertyFirstValue(entry).replace(',', '.');
    const parsed = Number.parseFloat(rawValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function inferDimensionOverridesFromProperties(payload) {
    const entries = extractListingPropertyEntries(payload);
    if (!entries.length) return {};

    const overrides = {};
    const unitCandidates = [];

    entries.forEach((entry) => {
      const label = getListingPropertyLabel(entry).toLowerCase();
      if (!label) return;

      const numericValue = getListingPropertyNumber(entry);
      const scaleName = getListingPropertyScale(entry).toLowerCase();
      if (scaleName) unitCandidates.push(scaleName);

      if (numericValue !== null) {
        if (!Number.isFinite(overrides.item_height) && (label.includes('height') || label.includes('hauteur'))) {
          overrides.item_height = numericValue;
        } else if (!Number.isFinite(overrides.item_width) && (label.includes('width') || label.includes('largeur'))) {
          overrides.item_width = numericValue;
        } else if (!Number.isFinite(overrides.item_length) && (
          label.includes('depth')
          || label.includes('profondeur')
          || label.includes('length')
          || label.includes('longueur')
        )) {
          overrides.item_length = numericValue;
        }
      }
    });

    const normalizedUnit = unitCandidates
      .map((value) => value.toLowerCase())
      .find((value) => ['mm', 'millimetre', 'millimetres', 'millimeter', 'millimeters', 'cm', 'centimetre', 'centimetres', 'centimeter', 'centimeters'].includes(value));

    if (normalizedUnit) {
      overrides.item_dimensions_unit = normalizedUnit.startsWith('mm') || normalizedUnit.startsWith('milli') ? 'mm' : 'cm';
    }

    return overrides;
  }

  function applyListingPropertyOverrides(mediaPayload, propertiesPayload) {
    const normalizedPayload = normalizeEtsyListingPayload(mediaPayload);
    const data = normalizedPayload?.data;
    if (!data || !propertiesPayload) return normalizedPayload;

    const overrides = inferDimensionOverridesFromProperties(propertiesPayload);
    const hasDimensionValue = (value) => (
      value !== null
      && value !== undefined
      && String(value).trim() !== ''
      && Number.isFinite(Number(value))
      && Number(value) > 0
    );

    if (Object.prototype.hasOwnProperty.call(overrides, 'item_height') && !hasDimensionValue(data.item_height)) {
      data.item_height = overrides.item_height;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, 'item_width') && !hasDimensionValue(data.item_width)) {
      data.item_width = overrides.item_width;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, 'item_length') && !hasDimensionValue(data.item_length)) {
      data.item_length = overrides.item_length;
    }
    if (overrides.item_dimensions_unit && !String(data.item_dimensions_unit || '').trim()) {
      data.item_dimensions_unit = overrides.item_dimensions_unit;
    }

    return normalizedPayload;
  }

  function buildDetailsDraftFromPayload(mediaPayload) {
    const normalizedPayload = normalizeEtsyListingPayload(mediaPayload);
    const data = normalizedPayload.data || {};
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
      categoryMeta: categoryMetaParts.join(' · '),
      taxonomyId: String(data.taxonomy_id || '').trim(),
      title: String(data.title || '').trim(),
      description: String(data.description || ''),
    };
  }

  function applyDetailsDraftToPayload(data, draft) {
    if (!data || typeof data !== 'object' || !draft || typeof draft !== 'object') return data;

    data.title = String(draft.title || '').trim();
    data.description = String(draft.description || '');
    data.taxonomy_id = String(draft.taxonomyId || '').trim()
      ? Number(draft.taxonomyId)
      : null;

    const categoryPathParts = splitCategoryPath(draft.categoryPathText || '');
    if (categoryPathParts.length) {
      data.taxonomy_path = [...categoryPathParts];
      if (Array.isArray(data.category_path) || typeof data.category_path === 'string') {
        data.category_path = [...categoryPathParts];
      }
    }

    return data;
  }

  global.PipelineUIEtsyData = {
    ...EtsyData,
    splitCategoryPath,
    decodeHtmlEntities,
    getCategoryPathParts,
    normalizeEtsyListingPayload,
    extractListingPropertyEntries,
    inferDimensionOverridesFromProperties,
    applyListingPropertyOverrides,
    buildDetailsDraftFromPayload,
    applyDetailsDraftToPayload,
  };
})(window);
