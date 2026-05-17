(function initPipelineUIDataIntegrations(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};

  const etsyAuth = Object.freeze({
    routes: Object.freeze({
      status: '/etsy/auth/status',
      start: '/etsy/auth/start',
      ping: '/etsy/test/ping',
      identity: '/etsy/test/oauth-identity',
      shop: '/etsy/test/shop',
      listings: '/etsy/test/listings',
      sections: '/etsy/test/sections',
      sellerTaxonomySearch: '/etsy/test/seller-taxonomy/search',
      listing: '/etsy/test/listing',
      listingProperties: '/etsy/test/listing/properties',
      listingVariationImages: '/etsy/test/listing/variation-images',
      mediaCachePrepare: '/etsy/media-cache/prepare',
    }),
    queryParam: 'etsy_oauth',
    statusLabels: Object.freeze({
      configuredYes: 'Configuration valide',
      configuredNo: 'Configuration incomplète',
      connectedYes: 'Boutique autorisée',
      connectedNo: 'Aucune boutique autorisée',
      pendingYes: 'Autorisation en attente',
      pendingNo: 'Aucune autorisation en attente',
    }),
  });

  function extractListingId(value = '') {
    const source = String(value || '').trim();
    if (!source) return '';
    if (/^\d+$/.test(source)) return source;

    const pathMatch = source.match(/\/listing\/(\d+)/i);
    if (pathMatch?.[1]) return pathMatch[1];

    const queryMatch = source.match(/(?:\?|&)listing_id=(\d+)/i);
    if (queryMatch?.[1]) return queryMatch[1];

    return '';
  }

  function getMoneyNumber(value) {
    const raw = Number(value);
    return Number.isFinite(raw) ? raw : 0;
  }

  function formatMoneyInput(value) {
    const amount = getMoneyNumber(value);
    return amount ? amount.toFixed(2).replace('.', ',') : '';
  }

  function parseMoneyInput(value) {
    const normalized = String(value || '').replace(/\s+/g, '').replace(',', '.');
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  global.PipelineUIDataIntegrations = Object.freeze({
    etsyAuth,
  });

  global.PipelineUIEtsyData = {
    ...(global.PipelineUIEtsyData || {}),
    extractListingId,
    getMoneyNumber,
    formatMoneyInput,
    parseMoneyInput,
  };

  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.data = global.PipelineUIEtsyData;
})(window);
