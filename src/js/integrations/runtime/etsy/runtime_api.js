(function initPipelineUIEtsyRuntimeApi(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};

  function getRoutes() {
    return global.PipelineUIDataIntegrations?.etsyAuth?.routes || {};
  }

  function getActiveShopKey() {
    return global.PipelineUIApp?.getActiveShopKey?.() || 'grosgeek';
  }

  function withActiveShopQuery(route = '', shopKeyOverride = '') {
    const normalizedRoute = String(route || '').trim();
    if (!normalizedRoute) return '';
    const separator = normalizedRoute.includes('?') ? '&' : '?';
    const normalizedShopKey = String(shopKeyOverride || getActiveShopKey()).trim() || 'grosgeek';
    return `${normalizedRoute}${separator}shop=${encodeURIComponent(normalizedShopKey)}`;
  }

  async function readJson(url) {
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(payload?.error || `HTTP ${response.status}`));
    }
    return payload;
  }

  function getCategorySearchRoute() {
    return String(getRoutes().sellerTaxonomySearch || '').trim();
  }

  function getDraftListingRoute() {
    return String(getRoutes().draftListing || '').trim();
  }

  function getListingPropertiesRoute() {
    return String(getRoutes().listingProperties || '').trim();
  }

  function getListingTranslationRoute() {
    return String(getRoutes().listingTranslation || '').trim();
  }

  function getListingsRoute() {
    return String(getRoutes().listings || '').trim();
  }

  function getListingSalesRoute() {
    return String(getRoutes().listingSales || '').trim();
  }

  function getSectionsRoute() {
    return String(getRoutes().sections || '').trim();
  }

  function extractApiErrorMessage(payload, fallbackStatus) {
    if (!payload || typeof payload !== 'object') {
      return fallbackStatus ? `HTTP ${fallbackStatus}` : 'Erreur API inconnue';
    }

    const directError = String(payload.error || '').trim();
    if (directError) return directError;

    const description = String(payload.error_description || payload.errorDescription || '').trim();
    if (description) return description;

    const details = Array.isArray(payload.details) ? payload.details : [];
    const detailMessage = details
      .map((item) => String(item?.message || item?.detail || '').trim())
      .filter(Boolean)
      .join(' | ');
    if (detailMessage) return detailMessage;

    const message = String(payload.message || '').trim();
    if (message) return message;

    return fallbackStatus ? `HTTP ${fallbackStatus}` : 'Erreur API inconnue';
  }

  async function fetchTaxonomySearch(prefix, options = {}) {
    const route = getCategorySearchRoute();
    if (!route) throw new Error('Route taxonomie Etsy indisponible');

    const params = new URLSearchParams();
    const query = String(options.query || '').trim();
    const taxonomyId = String(options.taxonomyId || '').trim();
    const limit = Number(options.limit || 20) || 20;

    if (query) params.set('q', query);
    if (taxonomyId) params.set('taxonomy_id', taxonomyId);
    params.set('limit', String(limit));

    const payload = await readJson(`${route}?${params.toString()}`);
    const results = Array.isArray(payload?.payload?.results) ? payload.payload.results : [];
    return (global.PipelineUIEtsyRuntime?.cacheTaxonomyEntries || (() => []))(prefix, results);
  }

  async function fetchListingPayload(listingId, options = {}) {
    const route = String(getRoutes().listing || '').trim();
    if (!route) throw new Error('Route listing Etsy indisponible');
    const shopKey = String(options?.shopKey || '').trim();
    return readJson(`${withActiveShopQuery(route, shopKey)}&listing_id=${encodeURIComponent(String(listingId || '').trim())}`);
  }

  async function fetchListingPropertiesPayload(listingId, options = {}) {
    const route = getListingPropertiesRoute();
    if (!route) throw new Error('Route attributs Etsy indisponible');
    const shopKey = String(options?.shopKey || '').trim();
    return readJson(`${withActiveShopQuery(route, shopKey)}&listing_id=${encodeURIComponent(String(listingId || '').trim())}`);
  }

  async function fetchShopListingsPage(options = {}) {
    const route = getListingsRoute();
    if (!route) throw new Error('Route listings Etsy indisponible');

    const params = new URLSearchParams();
    const state = String(options.state || 'active').trim().toLowerCase() || 'active';
    const limit = Number(options.limit || 5) || 5;
    const offset = Number(options.offset || 0) || 0;
    const shopKey = String(options.shopKey || '').trim();

    params.set('state', state);
    params.set('limit', String(limit));
    params.set('offset', String(Math.max(0, offset)));

    return readJson(`${withActiveShopQuery(route, shopKey)}&${params.toString()}`);
  }

  async function fetchShopSections(options = {}) {
    const route = getSectionsRoute();
    if (!route) throw new Error('Route sections Etsy indisponible');
    const shopKey = String(options.shopKey || '').trim();
    return readJson(withActiveShopQuery(route, shopKey));
  }

  async function fetchListingSalesMap(listingIds = [], options = {}) {
    const route = getListingSalesRoute();
    if (!route) throw new Error('Route ventes Etsy indisponible');

    const normalizedListingIds = (Array.isArray(listingIds) ? listingIds : [])
      .map((listingId) => String(listingId || '').trim())
      .filter(Boolean);
    if (!normalizedListingIds.length) return {};

    const shopKey = String(options.shopKey || '').trim();
    const params = new URLSearchParams();
    params.set('listing_ids', normalizedListingIds.join(','));
    const payload = await readJson(`${withActiveShopQuery(route, shopKey)}&${params.toString()}`);
    const salesByListing = payload?.payload?.sales_by_listing;
    const salesWindowsByListing = payload?.payload?.sales_windows_by_listing;
    const coverageByListing = payload?.payload?.coverage_by_listing;
    return {
      salesByListing: salesByListing && typeof salesByListing === 'object' ? salesByListing : {},
      salesWindowsByListing: salesWindowsByListing && typeof salesWindowsByListing === 'object' ? salesWindowsByListing : {},
      coverageByListing: coverageByListing && typeof coverageByListing === 'object' ? coverageByListing : {},
    };
  }

  async function submitListingPublication(publicationRequest) {
    const route = getDraftListingRoute();
    if (!route) throw new Error('Route publication draft Etsy indisponible');
    const normalizedRequest = publicationRequest && typeof publicationRequest === 'object'
      ? {
          mode: String(publicationRequest.mode || 'create_draft').trim() || 'create_draft',
          targetListingId: String(publicationRequest.targetListingId || '').trim(),
          payload: publicationRequest.createPayload || publicationRequest.payload || {},
          updatePayload: publicationRequest.updatePayload || {},
          inventory: publicationRequest.inventory || {},
          images: Array.isArray(publicationRequest.images) ? publicationRequest.images : [],
          videos: Array.isArray(publicationRequest.videos) ? publicationRequest.videos : [],
          mediaPlan: publicationRequest.mediaPlan || {},
          attributes: publicationRequest.attributes || {},
          shopKey: String(publicationRequest.shopKey || getActiveShopKey()).trim() || 'grosgeek',
          sourceShopKey: String(publicationRequest.sourceShopKey || '').trim(),
        }
      : { mode: 'create_draft', targetListingId: '', payload: {}, updatePayload: {}, inventory: {}, images: [], videos: [], mediaPlan: {}, attributes: {}, shopKey: getActiveShopKey(), sourceShopKey: '' };

    const response = await fetch(withActiveShopQuery(route, normalizedRequest.shopKey), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(normalizedRequest),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(extractApiErrorMessage(data, response.status));
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data;
  }

  async function createDraftListing(publicationRequest) {
    return submitListingPublication({
      ...(publicationRequest && typeof publicationRequest === 'object' ? publicationRequest : {}),
      mode: 'create_draft',
    });
  }

  async function updateExistingListing(publicationRequest) {
    return submitListingPublication({
      ...(publicationRequest && typeof publicationRequest === 'object' ? publicationRequest : {}),
      mode: 'update_listing',
    });
  }

  async function updateExpiredListing(publicationRequest) {
    return submitListingPublication({
      ...(publicationRequest && typeof publicationRequest === 'object' ? publicationRequest : {}),
      mode: 'update_expired_listing',
    });
  }

  async function publishListingTranslation(translationRequest) {
    const route = getListingTranslationRoute();
    if (!route) throw new Error('Route traduction Etsy indisponible');
    const normalizedRequest = translationRequest && typeof translationRequest === 'object'
      ? {
          listingId: String(translationRequest.listingId || '').trim(),
          language: String(translationRequest.language || '').trim().toLowerCase(),
          title: String(translationRequest.title || '').trim(),
          description: String(translationRequest.description || ''),
          tags: Array.isArray(translationRequest.tags) ? translationRequest.tags : [],
          shopKey: String(translationRequest.shopKey || getActiveShopKey()).trim() || 'grosgeek',
        }
      : { listingId: '', language: '', title: '', description: '', tags: [], shopKey: getActiveShopKey() };

    const response = await fetch(withActiveShopQuery(route, normalizedRequest.shopKey), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(normalizedRequest),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const rawMessage = extractApiErrorMessage(data, response.status);
      const routeMissing = response.status === 404
        && String(data?.error || '').trim().toLowerCase() === 'route inconnue';
      const error = new Error(
        routeMissing
          ? `Route backend absente pour la publication des traductions (${route}) - redemarre server.py`
          : rawMessage
      );
      error.status = response.status;
      error.payload = data;
      error.route = route;
      throw error;
    }
    return data;
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    getRoutes,
    getCategorySearchRoute,
    getDraftListingRoute,
    getListingPropertiesRoute,
    getListingTranslationRoute,
    getListingsRoute,
    getListingSalesRoute,
    getSectionsRoute,
    extractApiErrorMessage,
    readJson,
    fetchTaxonomySearch,
    fetchListingPayload,
    fetchListingPropertiesPayload,
    fetchShopListingsPage,
    fetchShopSections,
    fetchListingSalesMap,
    submitListingPublication,
    createDraftListing,
    updateExistingListing,
    updateExpiredListing,
    publishListingTranslation,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
