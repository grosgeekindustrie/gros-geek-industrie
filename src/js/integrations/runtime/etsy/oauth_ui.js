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
  let lastRenderedOutputDoublex = '';

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
      doublexPanel: getNode('etsyAuthHomePanelDoublex'),
      doublexConfigured: getNode('etsyAuthConfiguredDoublex'),
      doublexConnected: getNode('etsyAuthConnectedDoublex'),
      doublexPending: getNode('etsyAuthPendingDoublex'),
      doublexRedirect: getNode('etsyAuthRedirectUriDoublex'),
      doublexScopes: getNode('etsyAuthScopesDoublex'),
      doublexExpires: getNode('etsyAuthExpiresAtDoublex'),
      doublexDetails: getNode('etsyAuthDetailsDoublex'),
      doublexStartButton: getNode('etsyAuthStartBtnDoublex'),
      doublexRefreshButton: getNode('etsyAuthRefreshBtnDoublex'),
      doublexPingButton: getNode('etsyPingBtnDoublex'),
      doublexIdentityButton: getNode('etsyIdentityBtnDoublex'),
      doublexShopButton: getNode('etsyShopBtnDoublex'),
      doublexListingsButton: getNode('etsyListingsBtnDoublex'),
      doublexSectionsButton: getNode('etsySectionsBtnDoublex'),
      doublexListingReferenceInput: getNode('etsyListingReferenceInputDoublex'),
      doublexListingButton: getNode('etsyListingBtnDoublex'),
      doublexListingPropertiesButton: getNode('etsyListingPropertiesBtnDoublex'),
      doublexListingVariationImagesButton: getNode('etsyListingVariationImagesBtnDoublex'),
      doublexOutput: getNode('etsyAuthOutputDoublex'),
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

  function resolveTargetShopKey(target = 'primary') {
    return target === 'doublex' ? 'doublex' : 'grosgeek';
  }

  function buildScopedRoute(route = '', target = 'primary') {
    const normalizedRoute = String(route || '').trim();
    if (!normalizedRoute) return '';
    const separator = normalizedRoute.includes('?') ? '&' : '?';
    return `${normalizedRoute}${separator}shop=${encodeURIComponent(resolveTargetShopKey(target))}`;
  }

  function buildRouteWithListingId(routeKey, target = 'primary') {
    const route = ROUTES[routeKey];
    if (!route) {
      throw new Error(`Route Etsy inconnue: ${routeKey}`);
    }

    const nodes = getNodes();
    const rawListingReference = target === 'doublex'
      ? nodes.doublexListingReferenceInput?.value
      : nodes.listingReferenceInput?.value;
    const listingId = extractListingId(rawListingReference);
    if (!listingId) {
      throw new Error('Listing ID Etsy introuvable dans la référence fournie');
    }

    const params = new URLSearchParams({
      shop: resolveTargetShopKey(target),
      listing_id: listingId,
    });
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

    if (nodes.doublexPanel) {
      nodes.doublexConfigured.textContent = status.configured
        ? STATUS_LABELS.configuredYes
        : STATUS_LABELS.configuredNo;
      nodes.doublexConnected.textContent = status.connected
        ? STATUS_LABELS.connectedYes
        : STATUS_LABELS.connectedNo;
      nodes.doublexPending.textContent = status.pending
        ? STATUS_LABELS.pendingYes
        : STATUS_LABELS.pendingNo;
      nodes.doublexRedirect.textContent = status.redirectUri || '—';
      nodes.doublexScopes.textContent = Array.isArray(status.scopes) && status.scopes.length
        ? status.scopes.join(', ')
        : '—';
      nodes.doublexExpires.textContent = formatDateTime(status.expiresAt);
      nodes.doublexDetails.textContent = buildDetailsLines(status);
      if (nodes.doublexStartButton) nodes.doublexStartButton.disabled = !canStart;
      if (nodes.doublexPingButton) nodes.doublexPingButton.disabled = !status.configured;
      if (nodes.doublexIdentityButton) nodes.doublexIdentityButton.disabled = !canReadPrivateData;
      if (nodes.doublexShopButton) nodes.doublexShopButton.disabled = !canReadPrivateData;
      if (nodes.doublexListingsButton) nodes.doublexListingsButton.disabled = !canReadPrivateData;
      if (nodes.doublexSectionsButton) nodes.doublexSectionsButton.disabled = !canReadPrivateData;
      const hasDoublexListingReference = !!extractListingId(nodes.doublexListingReferenceInput?.value);
      if (nodes.doublexListingButton) nodes.doublexListingButton.disabled = !(canReadPrivateData && hasDoublexListingReference);
      if (nodes.doublexListingPropertiesButton) nodes.doublexListingPropertiesButton.disabled = !(canReadPrivateData && hasDoublexListingReference);
      if (nodes.doublexListingVariationImagesButton) nodes.doublexListingVariationImagesButton.disabled = !(canReadPrivateData && hasDoublexListingReference);
    }
  }

  function renderJsonOutput(payload, target = 'primary') {
    const nodes = getNodes();
    const serialized = JSON.stringify(payload, null, 2);
    if (target === 'doublex') {
      if (!nodes.doublexOutput) return;
      lastRenderedOutputDoublex = serialized;
      nodes.doublexOutput.textContent = serialized;
      return;
    }
    if (!nodes.output) return;
    lastRenderedOutput = serialized;
    nodes.output.textContent = serialized;
  }

  async function runEtsyProbe(routeKey, target = 'primary') {
    const route = ROUTES[routeKey];
    if (!route) {
      throw new Error(`Route Etsy inconnue: ${routeKey}`);
    }

    const payload = await readJson(buildScopedRoute(route, target));
    renderJsonOutput(payload, target);
    return payload;
  }

  async function runEtsyListingProbeRequest(routeKey, target = 'primary') {
    const payload = await readJson(buildRouteWithListingId(routeKey, target));
    renderJsonOutput(payload, target);
    return payload;
  }

  async function refreshEtsyAuthStatus(options = {}) {
    const { silent = false } = options;

    try {
      const primaryPayload = await readJson(buildScopedRoute(ROUTES.status, 'primary'));
      const doublexPayload = await readJson(buildScopedRoute(ROUTES.status, 'doublex'));
      renderAuthStatus(primaryPayload);
      const nodes = getNodes();
      if (nodes.doublexPanel) {
        nodes.doublexConfigured.textContent = doublexPayload.configured ? STATUS_LABELS.configuredYes : STATUS_LABELS.configuredNo;
        nodes.doublexConnected.textContent = doublexPayload.connected ? STATUS_LABELS.connectedYes : STATUS_LABELS.connectedNo;
        nodes.doublexPending.textContent = doublexPayload.pending ? STATUS_LABELS.pendingYes : STATUS_LABELS.pendingNo;
        nodes.doublexRedirect.textContent = doublexPayload.redirectUri || '—';
        nodes.doublexScopes.textContent = Array.isArray(doublexPayload.scopes) && doublexPayload.scopes.length ? doublexPayload.scopes.join(', ') : '—';
        nodes.doublexExpires.textContent = formatDateTime(doublexPayload.expiresAt);
        nodes.doublexDetails.textContent = buildDetailsLines(doublexPayload);
      }
      return { primary: primaryPayload, doublex: doublexPayload };
    } catch (error) {
      if (!silent) {
        global.showToast?.(`OAuth Etsy : ${error.message}`, '#ff4757');
      }
      return null;
    }
  }

  async function startEtsyAuth() {
    try {
      const payload = await readJson(buildScopedRoute(ROUTES.start, 'primary'));
      if (!payload?.authUrl) {
        throw new Error('URL d’autorisation Etsy manquante');
      }
      window.location.assign(payload.authUrl);
    } catch (error) {
      global.showToast?.(`OAuth Etsy : ${error.message}`, '#ff4757');
    }
  }

  async function startEtsyAuthDoublex() {
    try {
      const payload = await readJson(`${buildScopedRoute(ROUTES.start, 'doublex')}&browser=opera`);
      if (!payload?.authUrl) {
        throw new Error('URL d’autorisation Etsy manquante');
      }
      global.showToast?.('Autorisation DoubleXindustrie ouverte dans Opera');
    } catch (error) {
      global.showToast?.(`OAuth Etsy DoubleXindustrie : ${error.message}`, '#ff4757');
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

  async function runEtsyPingProbeDoublex() {
    try {
      await runEtsyProbe('ping', 'doublex');
      global.showToast?.('Ping Etsy DoubleXindustrie réussi');
    } catch (error) {
      global.showToast?.(`Ping Etsy DoubleXindustrie : ${error.message}`, '#ff4757');
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

  async function runEtsyIdentityProbeDoublex() {
    try {
      await runEtsyProbe('identity', 'doublex');
      global.showToast?.('Identité OAuth DoubleXindustrie lue');
    } catch (error) {
      global.showToast?.(`Identité OAuth DoubleXindustrie : ${error.message}`, '#ff4757');
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

  async function runEtsyShopProbeDoublex() {
    try {
      await runEtsyProbe('shop', 'doublex');
      global.showToast?.('Boutique DoubleXindustrie lue');
    } catch (error) {
      global.showToast?.(`Boutique DoubleXindustrie : ${error.message}`, '#ff4757');
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

  async function runEtsyListingsProbeDoublex() {
    try {
      await runEtsyProbe('listings', 'doublex');
      global.showToast?.('Listings DoubleXindustrie lus');
    } catch (error) {
      global.showToast?.(`Listings DoubleXindustrie : ${error.message}`, '#ff4757');
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

  async function runEtsySectionsProbeDoublex() {
    try {
      await runEtsyProbe('sections', 'doublex');
      global.showToast?.('Sections DoubleXindustrie lues');
    } catch (error) {
      global.showToast?.(`Sections DoubleXindustrie : ${error.message}`, '#ff4757');
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

  async function runEtsyListingProbeDoublex() {
    try {
      await runEtsyListingProbeRequest('listing', 'doublex');
      global.showToast?.('Fiche DoubleXindustrie lue');
    } catch (error) {
      global.showToast?.(`Fiche DoubleXindustrie : ${error.message}`, '#ff4757');
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

  async function runEtsyListingPropertiesProbeDoublex() {
    try {
      await runEtsyListingProbeRequest('listingProperties', 'doublex');
      global.showToast?.('Attributs DoubleXindustrie lus');
    } catch (error) {
      global.showToast?.(`Attributs DoubleXindustrie : ${error.message}`, '#ff4757');
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

  async function runEtsyListingVariationImagesProbeDoublex() {
    try {
      await runEtsyListingProbeRequest('listingVariationImages', 'doublex');
      global.showToast?.('Images de variations DoubleXindustrie lues');
    } catch (error) {
      global.showToast?.(`Images de variations DoubleXindustrie : ${error.message}`, '#ff4757');
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

  async function copyEtsyOutputDoublex() {
    if (!lastRenderedOutputDoublex) {
      global.showToast?.('Aucune sortie API DoubleXindustrie à copier', '#ff4757');
      return;
    }

    try {
      await navigator.clipboard.writeText(lastRenderedOutputDoublex);
      global.showToast?.('Sortie API DoubleXindustrie copiée');
    } catch (error) {
      global.showToast?.(`Copie API Etsy DoubleXindustrie : ${error.message}`, '#ff4757');
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
    getNodes().doublexListingReferenceInput?.addEventListener('input', () => {
      refreshEtsyAuthStatus({ silent: true });
    });
  }

  global.PipelineUIEtsyAuth = {
    initEtsyAuthHomePanel,
    refreshEtsyAuthStatus,
    startEtsyAuth,
    startEtsyAuthDoublex,
    runEtsyPingProbe,
    runEtsyPingProbeDoublex,
    runEtsyIdentityProbe,
    runEtsyIdentityProbeDoublex,
    runEtsyShopProbe,
    runEtsyShopProbeDoublex,
    runEtsyListingsProbe,
    runEtsyListingsProbeDoublex,
    runEtsySectionsProbe,
    runEtsySectionsProbeDoublex,
    runEtsyListingProbe,
    runEtsyListingProbeDoublex,
    runEtsyListingPropertiesProbe,
    runEtsyListingPropertiesProbeDoublex,
    runEtsyListingVariationImagesProbe,
    runEtsyListingVariationImagesProbeDoublex,
    copyEtsyOutput,
    copyEtsyOutputDoublex,
  };

  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.etsyAuth = global.PipelineUIEtsyAuth;

  Object.assign(global, {
    initEtsyAuthHomePanel,
    refreshEtsyAuthStatus,
    startEtsyAuth,
    startEtsyAuthDoublex,
    runEtsyPingProbe,
    runEtsyPingProbeDoublex,
    runEtsyIdentityProbe,
    runEtsyIdentityProbeDoublex,
    runEtsyShopProbe,
    runEtsyShopProbeDoublex,
    runEtsyListingsProbe,
    runEtsyListingsProbeDoublex,
    runEtsySectionsProbe,
    runEtsySectionsProbeDoublex,
    runEtsyListingProbe,
    runEtsyListingProbeDoublex,
    runEtsyListingPropertiesProbe,
    runEtsyListingPropertiesProbeDoublex,
    runEtsyListingVariationImagesProbe,
    runEtsyListingVariationImagesProbeDoublex,
    copyEtsyOutput,
    copyEtsyOutputDoublex,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEtsyAuthHomePanel, { once: true });
  } else {
    initEtsyAuthHomePanel();
  }
})(window);
