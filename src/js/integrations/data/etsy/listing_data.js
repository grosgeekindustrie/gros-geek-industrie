(function initPipelineUIEtsyListingData(global) {
  'use strict';

  const EtsyData = global.PipelineUIEtsyData || {};

  function splitCategoryPath(value = '') {
    return String(value || '')
      .split('>')
      .map((part) => part.trim())
      .filter(Boolean);
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

    return {
      ...payload,
      data: {
        ...data,
        listing_id: data.listing_id || rawData.listing_id || payload.listing_id || '',
        inventory,
        images,
        videos,
      },
    };
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
    getCategoryPathParts,
    normalizeEtsyListingPayload,
    buildDetailsDraftFromPayload,
    applyDetailsDraftToPayload,
  };
})(window);
