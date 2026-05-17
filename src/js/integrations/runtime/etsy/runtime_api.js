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

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    getRoutes,
    getCategorySearchRoute,
    readJson,
    fetchTaxonomySearch,
    fetchListingPayload,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
