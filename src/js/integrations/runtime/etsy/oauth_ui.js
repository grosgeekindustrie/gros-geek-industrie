(function initPipelineUIEtsyAuth(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};

  const CONFIG = global.PipelineUIDataIntegrations?.etsyAuth || {};
  const EtsyData = global.PipelineUIEtsyData || {};
  const ROUTES = CONFIG.routes || {};
  const STATUS_LABELS = CONFIG.statusLabels || {};
  const QUERY_PARAM = CONFIG.queryParam || 'etsy_oauth';

  let initialized = false;
  let lastRenderedOutput = '';

  const getNode = (id) => document.getElementById(id);

  function getNodes() {
    return {
      panel: getNode('etsyAuthHomePanel'),
      configured: getNode('etsyAuthConfigured'),
      connected: getNode('etsyAuthConnected'),
      pending: getNode('etsyAuthPending'),
      redirect: getNode('etsyAuthRedirectUri'),
      scopes: getNode('etsyAuthScopes'),
      expires: getNode('etsyAuthExpiresAt'),
      details: getNode('etsyAuthDetails'),
      startButton: getNode('etsyAuthStartBtn'),
      refreshButton: getNode('etsyAuthRefreshBtn'),
      pingButton: getNode('etsyPingBtn'),
      identityButton: getNode('etsyIdentityBtn'),
      shopButton: getNode('etsyShopBtn'),
      listingsButton: getNode('etsyListingsBtn'),
      sectionsButton: getNode('etsySectionsBtn'),
      listingReferenceInput: getNode('etsyListingReferenceInput'),
      listingButton: getNode('etsyListingBtn'),
      listingPropertiesButton: getNode('etsyListingPropertiesBtn'),
      listingVariationImagesButton: getNode('etsyListingVariationImagesBtn'),
      output: getNode('etsyAuthOutput'),
    };
  }

  async function readJson(url, options = {}) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(String(payload?.error || `HTTP ${response.status}`));
    }

    return payload;
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  const extractListingId = EtsyData.extractListingId;

  function buildRouteWithListingId(routeKey) {
    const route = ROUTES[routeKey];
    if (!route) {
      throw new Error(`Route Etsy inconnue: ${routeKey}`);
    }

    const nodes = getNodes();
    const listingId = extractListingId(nodes.listingReferenceInput?.value);
    if (!listingId) {
      throw new Error('Listing ID Etsy introuvable dans la référence fournie');
    }

    const params = new URLSearchParams({ listing_id: listingId });
    return `${route}?${params.toString()}`;
  }

  function buildDetailsLines(status = {}) {
    const lines = [];

    const missing = Array.isArray(status.missingConfig) ? status.missingConfig : [];
    if (missing.length) {
      lines.push(`Configuration manquante : ${missing.join(', ')}`);
    }

    if (status.error) {
      lines.push(`Erreur : ${status.error}`);
    }

    if (status.shopUserId) {
      lines.push(`User Etsy autorisé : ${status.shopUserId}`);
    }

    if (status.tokenType) {
      lines.push(`Type de token : ${status.tokenType}`);
    }

    if (status.lastAuthAt) {
      lines.push(`Dernière autorisation : ${formatDateTime(status.lastAuthAt)}`);
    }

    if (status.pendingCreatedAt) {
      lines.push(`Demande OAuth préparée : ${formatDateTime(status.pendingCreatedAt)}`);
    }

    if (status.localHttpsEnabled) {
      lines.push(`HTTPS local : port ${status.localHttpsPort || '—'}`);
      if (!status.localHttpsFilesReady) {
        lines.push('HTTPS local : certificat ou clé introuvable');
      }
    }

    return lines.length ? lines.join('\n') : 'En attente de la première autorisation OAuth Etsy.';
  }

  function renderAuthStatus(status = {}) {
    const nodes = getNodes();
    if (!nodes.panel) return;

    nodes.configured.textContent = status.configured
      ? STATUS_LABELS.configuredYes
      : STATUS_LABELS.configuredNo;
    nodes.connected.textContent = status.connected
      ? STATUS_LABELS.connectedYes
      : STATUS_LABELS.connectedNo;
    nodes.pending.textContent = status.pending
      ? STATUS_LABELS.pendingYes
      : STATUS_LABELS.pendingNo;
    nodes.redirect.textContent = status.redirectUri || '—';
    nodes.scopes.textContent = Array.isArray(status.scopes) && status.scopes.length
      ? status.scopes.join(', ')
      : '—';
    nodes.expires.textContent = formatDateTime(status.expiresAt);
    nodes.details.textContent = buildDetailsLines(status);

    const canStart = !!status.configured;
    const canReadPrivateData = !!status.connected;
    if (nodes.startButton) nodes.startButton.disabled = !canStart;
    if (nodes.pingButton) nodes.pingButton.disabled = !status.configured;
    if (nodes.identityButton) nodes.identityButton.disabled = !canReadPrivateData;
    if (nodes.shopButton) nodes.shopButton.disabled = !canReadPrivateData;
    if (nodes.listingsButton) nodes.listingsButton.disabled = !canReadPrivateData;
    if (nodes.sectionsButton) nodes.sectionsButton.disabled = !canReadPrivateData;

    const hasListingReference = !!extractListingId(nodes.listingReferenceInput?.value);
    if (nodes.listingButton) nodes.listingButton.disabled = !(canReadPrivateData && hasListingReference);
    if (nodes.listingPropertiesButton) nodes.listingPropertiesButton.disabled = !(canReadPrivateData && hasListingReference);
    if (nodes.listingVariationImagesButton) nodes.listingVariationImagesButton.disabled = !(canReadPrivateData && hasListingReference);
  }

  function renderJsonOutput(payload) {
    const nodes = getNodes();
    if (!nodes.output) return;
    lastRenderedOutput = JSON.stringify(payload, null, 2);
    nodes.output.textContent = lastRenderedOutput;
  }

  async function runEtsyProbe(routeKey) {
    const route = ROUTES[routeKey];
    if (!route) {
      throw new Error(`Route Etsy inconnue: ${routeKey}`);
    }

    const payload = await readJson(route);
    renderJsonOutput(payload);
    return payload;
  }

  async function runEtsyListingProbeRequest(routeKey) {
    const payload = await readJson(buildRouteWithListingId(routeKey));
    renderJsonOutput(payload);
    return payload;
  }

  async function refreshEtsyAuthStatus(options = {}) {
    const { silent = false } = options;

    try {
      const payload = await readJson(ROUTES.status);
      renderAuthStatus(payload);
      return payload;
    } catch (error) {
      if (!silent) {
        global.showToast?.(`OAuth Etsy : ${error.message}`, '#ff4757');
      }
      return null;
    }
  }

  async function startEtsyAuth() {
    try {
      const payload = await readJson(ROUTES.start);
      if (!payload?.authUrl) {
        throw new Error('URL d’autorisation Etsy manquante');
      }
      window.location.assign(payload.authUrl);
    } catch (error) {
      global.showToast?.(`OAuth Etsy : ${error.message}`, '#ff4757');
    }
  }

  async function runEtsyPingProbe() {
    try {
      await runEtsyProbe('ping');
      global.showToast?.('Ping Etsy réussi');
    } catch (error) {
      global.showToast?.(`Ping Etsy : ${error.message}`, '#ff4757');
    }
  }

  async function runEtsyIdentityProbe() {
    try {
      await runEtsyProbe('identity');
      global.showToast?.('Identité OAuth Etsy lue');
    } catch (error) {
      global.showToast?.(`Identité OAuth Etsy : ${error.message}`, '#ff4757');
    }
  }

  async function runEtsyShopProbe() {
    try {
      await runEtsyProbe('shop');
      global.showToast?.('Boutique Etsy lue');
    } catch (error) {
      global.showToast?.(`Boutique Etsy : ${error.message}`, '#ff4757');
    }
  }

  async function runEtsyListingsProbe() {
    try {
      await runEtsyProbe('listings');
      global.showToast?.('Listings Etsy lus');
    } catch (error) {
      global.showToast?.(`Listings Etsy : ${error.message}`, '#ff4757');
    }
  }

  async function runEtsySectionsProbe() {
    try {
      await runEtsyProbe('sections');
      global.showToast?.('Sections Etsy lues');
    } catch (error) {
      global.showToast?.(`Sections Etsy : ${error.message}`, '#ff4757');
    }
  }

  async function runEtsyListingProbe() {
    try {
      await runEtsyListingProbeRequest('listing');
      global.showToast?.('Fiche Etsy lue');
    } catch (error) {
      global.showToast?.(`Fiche Etsy : ${error.message}`, '#ff4757');
    }
  }

  async function runEtsyListingPropertiesProbe() {
    try {
      await runEtsyListingProbeRequest('listingProperties');
      global.showToast?.('Attributs Etsy lus');
    } catch (error) {
      global.showToast?.(`Attributs Etsy : ${error.message}`, '#ff4757');
    }
  }

  async function runEtsyListingVariationImagesProbe() {
    try {
      await runEtsyListingProbeRequest('listingVariationImages');
      global.showToast?.('Images de variations Etsy lues');
    } catch (error) {
      global.showToast?.(`Images de variations Etsy : ${error.message}`, '#ff4757');
    }
  }

  async function copyEtsyOutput() {
    if (!lastRenderedOutput) {
      global.showToast?.('Aucune sortie API à copier', '#ff4757');
      return;
    }

    try {
      await navigator.clipboard.writeText(lastRenderedOutput);
      global.showToast?.('Sortie API copiée');
    } catch (error) {
      global.showToast?.(`Copie API Etsy : ${error.message}`, '#ff4757');
    }
  }

  function handleOAuthReturnMessage() {
    const url = new URL(window.location.href);
    const result = url.searchParams.get(QUERY_PARAM);
    const message = url.searchParams.get('etsy_message');

    if (!result) return;

    if (result === 'success') {
      global.showToast?.(message || 'OAuth Etsy connecté');
    } else {
      global.showToast?.(message || 'OAuth Etsy échoué', '#ff4757');
    }

    url.searchParams.delete(QUERY_PARAM);
    url.searchParams.delete('etsy_message');
    window.history.replaceState({}, document.title, url.toString());
  }

  function initEtsyAuthHomePanel() {
    if (initialized) return;
    initialized = true;

    handleOAuthReturnMessage();
    refreshEtsyAuthStatus({ silent: true });
    getNodes().listingReferenceInput?.addEventListener('input', () => {
      refreshEtsyAuthStatus({ silent: true });
    });
  }

  global.PipelineUIEtsyAuth = {
    initEtsyAuthHomePanel,
    refreshEtsyAuthStatus,
    startEtsyAuth,
    runEtsyPingProbe,
    runEtsyIdentityProbe,
    runEtsyShopProbe,
    runEtsyListingsProbe,
    runEtsySectionsProbe,
    runEtsyListingProbe,
    runEtsyListingPropertiesProbe,
    runEtsyListingVariationImagesProbe,
    copyEtsyOutput,
  };

  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.etsyAuth = global.PipelineUIEtsyAuth;

  Object.assign(global, {
    initEtsyAuthHomePanel,
    refreshEtsyAuthStatus,
    startEtsyAuth,
    runEtsyPingProbe,
    runEtsyIdentityProbe,
    runEtsyShopProbe,
    runEtsyListingsProbe,
    runEtsySectionsProbe,
    runEtsyListingProbe,
    runEtsyListingPropertiesProbe,
    runEtsyListingVariationImagesProbe,
    copyEtsyOutput,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEtsyAuthHomePanel, { once: true });
  } else {
    initEtsyAuthHomePanel();
  }
})(window);
