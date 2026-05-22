(function initPipelineUIEtsyRuntimeApi(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};

  function getRoutes() {
    return global.PipelineUIDataIntegrations?.etsyAuth?.routes || {};
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

  function getShippingProfilesRoute() {
    return String(getRoutes().shippingProfiles || '').trim();
  }

  function getReadinessStatesRoute() {
    return String(getRoutes().readinessStates || '').trim();
  }

  function getSectionsRoute() {
    return String(getRoutes().sections || '').trim();
  }

  function getDraftListingRoute() {
    return String(getRoutes().draftListing || '').trim();
  }

  function getListingPropertiesRoute() {
    return String(getRoutes().listingProperties || '').trim();
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

  async function fetchListingPayload(listingId) {
    const route = String(getRoutes().listing || '').trim();
    if (!route) throw new Error('Route listing Etsy indisponible');
    return readJson(`${route}?listing_id=${encodeURIComponent(String(listingId || '').trim())}`);
  }

  async function fetchListingPropertiesPayload(listingId) {
    const route = getListingPropertiesRoute();
    if (!route) throw new Error('Route attributs Etsy indisponible');
    return readJson(`${route}?listing_id=${encodeURIComponent(String(listingId || '').trim())}`);
  }

  async function fetchShopShippingProfiles() {
    const route = getShippingProfilesRoute();
    if (!route) throw new Error('Route profils livraison Etsy indisponible');
    return readJson(route);
  }

  async function fetchShopReadinessStates() {
    const route = getReadinessStatesRoute();
    if (!route) throw new Error('Route profils traitement Etsy indisponible');
    return readJson(route);
  }

  async function fetchShopSections() {
    const route = getSectionsRoute();
    if (!route) throw new Error('Route sections Etsy indisponible');
    return readJson(route);
  }

  async function createDraftListing(publicationRequest) {
    const route = getDraftListingRoute();
    if (!route) throw new Error('Route publication draft Etsy indisponible');
    const normalizedRequest = publicationRequest && typeof publicationRequest === 'object'
      ? {
          payload: publicationRequest.createPayload || publicationRequest.payload || {},
          updatePayload: publicationRequest.updatePayload || {},
          inventory: publicationRequest.inventory || {},
          images: Array.isArray(publicationRequest.images) ? publicationRequest.images : [],
          attributes: publicationRequest.attributes || {},
        }
      : { payload: {}, updatePayload: {}, inventory: {}, images: [], attributes: {} };

    const response = await fetch(route, {
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

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    getRoutes,
    getCategorySearchRoute,
    getShippingProfilesRoute,
    getReadinessStatesRoute,
    getSectionsRoute,
    getDraftListingRoute,
    getListingPropertiesRoute,
    extractApiErrorMessage,
    readJson,
    fetchTaxonomySearch,
    fetchListingPayload,
    fetchListingPropertiesPayload,
    fetchShopShippingProfiles,
    fetchShopReadinessStates,
    fetchShopSections,
    createDraftListing,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
