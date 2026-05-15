(function initPipelineUIDataIntegrations(global) {
  'use strict';

  const etsyAuth = Object.freeze({
    routes: Object.freeze({
      status: '/etsy/auth/status',
      start: '/etsy/auth/start',
      ping: '/etsy/test/ping',
      identity: '/etsy/test/oauth-identity',
      shop: '/etsy/test/shop',
      listings: '/etsy/test/listings',
      sections: '/etsy/test/sections',
      listing: '/etsy/test/listing',
      listingProperties: '/etsy/test/listing/properties',
      listingVariationImages: '/etsy/test/listing/variation-images',
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

  global.PipelineUIDataIntegrations = Object.freeze({
    etsyAuth,
  });
})(window);
