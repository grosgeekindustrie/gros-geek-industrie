'use strict';

(function initPipelineUIPinterest(global) {
  global.PipelineUI = global.PipelineUI || {};

  const AGENT_ID = 'pinterest';
  const PROMPT_SPEC_ID = 'pinterest-publisher';
  const PROMPT_STATE_KEY = 'pinterestPublisher';
  const PROMPT_PATH = 'prompts/pinterest/pinterest.md';
  const SHOP_LABELS = Object.freeze({
    grosgeek: 'Gros Geek Industrie',
    doublex: 'Double X Industrie',
  });

  const workspaceState = {
    listingId: '',
    shopKey: 'grosgeek',
    rawPayload: null,
    listing: null,
    images: [],
    sortable: null,
    running: false,
  };

  const getElement = (id) => document.getElementById(id);
  const getActiveShopKey = () => (
    global.PipelineUIApp?.getActiveShopKey?.() === 'doublex' ? 'doublex' : 'grosgeek'
  );

  const getImageUrl = (image = {}) => String(
    image.url_fullxfull
    || image.url_570xN
    || image.url_570xn
    || image.url_170x135
    || image.full_url
    || image.src
    || image.url
    || ''
  ).trim();

  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const setStatus = (message, type = '') => {
    const status = getElement('pinterestLoadStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', type === 'error');
    status.classList.toggle('is-success', type === 'success');
  };

  const setAgentState = (message, type = '') => {
    const state = getElement('pinterestAgentState');
    if (!state) return;
    state.textContent = message;
    state.className = 'pinterest-agent-state';
    if (type) state.classList.add(`is-${type}`);
  };

  const syncControls = () => {
    const hasListing = Boolean(workspaceState.listing && workspaceState.images.length);
    const loadButton = getElement('pinterestLoadBtn');
    const dataButton = getElement('pinterestDataBtn');
    const generateButton = getElement('pinterestGenerateBtn');
    const stopButton = getElement('pinterestStopBtn');

    if (loadButton) loadButton.disabled = workspaceState.running;
    if (dataButton) dataButton.disabled = !workspaceState.rawPayload;
    if (generateButton) generateButton.disabled = !hasListing || workspaceState.running;
    if (stopButton) stopButton.disabled = !workspaceState.running;
  };

  const syncShopBadge = () => {
    workspaceState.shopKey = getActiveShopKey();
    const badge = getElement('pinterestShopBadge');
    if (badge) badge.textContent = SHOP_LABELS[workspaceState.shopKey];
  };

  const renderData = () => {
    const panel = getElement('pinterestDataPanel');
    if (!panel) return;
    panel.textContent = workspaceState.rawPayload
      ? JSON.stringify({
          shopKey: workspaceState.shopKey,
          listingId: workspaceState.listingId,
          orderedImages: workspaceState.images.map(({ id, url }, index) => ({
            position: index + 1,
            id,
            url,
          })),
          normalized: workspaceState.listing,
          api: workspaceState.rawPayload,
        }, null, 2)
      : 'Aucune donnee chargee.';
  };

  const syncImageOrderFromDom = () => {
    const grid = getElement('pinterestImageGrid');
    if (!grid) return;
    const order = [...grid.querySelectorAll('[data-pinterest-image-id]')]
      .map((item) => item.dataset.pinterestImageId);
    const imagesById = new Map(workspaceState.images.map((image) => [image.id, image]));
    workspaceState.images = order.map((id) => imagesById.get(id)).filter(Boolean);
    [...grid.querySelectorAll('.pinterest-image-card-meta span:last-child')]
      .forEach((label, index) => {
        label.textContent = `Épingle ${index + 1}`;
      });
    renderData();
  };

  const initializeSortable = () => {
    workspaceState.sortable?.destroy?.();
    workspaceState.sortable = null;
    const grid = getElement('pinterestImageGrid');
    if (!grid || !workspaceState.images.length || typeof global.Sortable !== 'function') return;
    workspaceState.sortable = new global.Sortable(grid, {
      animation: 160,
      ghostClass: 'pinterest-sort-ghost',
      onEnd: syncImageOrderFromDom,
    });
  };

  const renderImages = () => {
    const grid = getElement('pinterestImageGrid');
    const count = getElement('pinterestImageCount');
    if (!grid || !count) return;

    count.textContent = `${workspaceState.images.length} image${workspaceState.images.length > 1 ? 's' : ''}`;
    grid.classList.toggle('is-empty', !workspaceState.images.length);
    if (!workspaceState.images.length) {
      grid.innerHTML = '<p class="pinterest-empty">Aucune image exploitable dans cette fiche Etsy.</p>';
      initializeSortable();
      return;
    }

    grid.innerHTML = workspaceState.images.map((image, index) => `
      <article class="pinterest-image-card" data-pinterest-image-id="${escapeHtml(image.id)}">
        <img src="${escapeHtml(image.url)}" alt="Image Etsy ${index + 1}" loading="lazy">
        <div class="pinterest-image-card-meta">
          <span data-svg-icon="grip"></span>
          <span>Épingle ${index + 1}</span>
        </div>
      </article>
    `).join('');
    global.PipelineUIIcons?.hydrateIcons?.(grid);
    initializeSortable();
  };

  const normalizeImages = (images = []) => images
    .map((image, index) => ({
      id: String(image?.listing_image_id || image?.image_id || `etsy-image-${index + 1}`),
      url: getImageUrl(image),
      source: image,
    }))
    .filter((image) => image.url);

  const resetLoadedListing = () => {
    workspaceState.listingId = '';
    workspaceState.rawPayload = null;
    workspaceState.listing = null;
    workspaceState.images = [];
    const output = getElement('pinterestOutput');
    if (output) output.value = '';
    setAgentState('En attente');
    renderImages();
    renderData();
    syncControls();
  };

  const loadListing = async () => {
    const input = getElement('pinterestListingId');
    const listingId = String(input?.value || '').trim();
    if (!/^\d+$/.test(listingId)) {
      setStatus('Entre un listing_id Etsy numerique, sans URL.', 'error');
      input?.focus();
      return;
    }

    syncShopBadge();
    resetLoadedListing();
    setStatus(`Chargement de la fiche ${listingId}...`);
    const loadButton = getElement('pinterestLoadBtn');
    if (loadButton) loadButton.disabled = true;

    try {
      const envelope = await global.PipelineUIEtsyRuntime.fetchListingPayload(listingId, {
        shopKey: workspaceState.shopKey,
      });
      const normalized = global.PipelineUIEtsyData.normalizeEtsyListingPayload(envelope?.payload || null);
      const listing = normalized?.data || null;
      if (!listing) throw new Error('La reponse Etsy ne contient aucune fiche exploitable.');

      workspaceState.listingId = listingId;
      workspaceState.rawPayload = envelope;
      workspaceState.listing = listing;
      workspaceState.images = normalizeImages(listing.images);
      renderImages();
      renderData();
      setStatus(
        `Fiche ${listingId} chargee : ${workspaceState.images.length} image${workspaceState.images.length > 1 ? 's' : ''}.`,
        'success'
      );
    } catch (error) {
      resetLoadedListing();
      setStatus(`Erreur Etsy : ${error.message}`, 'error');
    } finally {
      syncControls();
    }
  };

  const toggleData = () => {
    const panel = getElement('pinterestDataPanel');
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) renderData();
  };

  const getCustomPromptState = () => {
    global.state.customPrompts = global.state.customPrompts || {};
    return global.state.customPrompts;
  };

  const loadPrompt = async () => {
    const prompts = getCustomPromptState();
    if (prompts[PROMPT_STATE_KEY]) return prompts[PROMPT_STATE_KEY];
    const response = await fetch(`/files/${PROMPT_PATH}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Prompt Pinterest introuvable.');
    }
    prompts[PROMPT_STATE_KEY] = await response.text();
    return prompts[PROMPT_STATE_KEY];
  };

  const replacePromptValue = (prompt, placeholder, value) => (
    prompt.split(`[[${placeholder}]]`).join(String(value ?? ''))
  );

  const buildAgentPrompt = (template) => {
    const listing = workspaceState.listing || {};
    const etsyUrl = String(listing.url || `https://www.etsy.com/listing/${workspaceState.listingId}`);
    const imageLines = workspaceState.images
      .map((image, index) => `${index + 1}. ${image.url}`)
      .join('\n');
    const replacements = {
      SHOP_NAME: SHOP_LABELS[workspaceState.shopKey],
      ETSY_LISTING_ID: workspaceState.listingId,
      ETSY_URL: etsyUrl,
      TITLE: listing.title || '',
      TAGS: Array.isArray(listing.tags) ? listing.tags.join(', ') : '',
      DESCRIPTION: listing.description || '',
      IMAGE_COUNT: workspaceState.images.length,
      IMAGES: imageLines,
    };
    return Object.entries(replacements).reduce(
      (prompt, [placeholder, value]) => replacePromptValue(prompt, placeholder, value),
      template
    );
  };

  const generatePins = async () => {
    if (!workspaceState.listing || !workspaceState.images.length || workspaceState.running) return;
    workspaceState.running = true;
    syncControls();
    setAgentState('Generation en cours', 'running');

    const output = getElement('pinterestOutput');
    if (output) output.value = 'Generation en cours...';

    try {
      const template = await loadPrompt();
      const filled = buildAgentPrompt(template);
      const result = await global.callClaude(AGENT_ID, {
        filled,
        fixedContent: '',
        runtimeAgentId: AGENT_ID,
      }, false);
      if (output) output.value = result.text || '';
      setAgentState('Generation terminee', 'success');
      global.showToast?.('Paquet Pinterest genere');
    } catch (error) {
      const stopped = /stopp/i.test(String(error.message || ''));
      if (output && output.value === 'Generation en cours...') output.value = '';
      setAgentState(stopped ? 'Generation stoppee' : 'Erreur', stopped ? '' : 'error');
      global.showToast?.(error.message, stopped ? '#e8c547' : '#ff4757');
    } finally {
      workspaceState.running = false;
      syncControls();
    }
  };

  const stopGeneration = () => {
    if (!workspaceState.running) return;
    global.stopAgent?.(AGENT_ID);
    setAgentState('Arret demande');
  };

  const open = () => {
    const shopChanged = getActiveShopKey() !== workspaceState.shopKey;
    syncShopBadge();
    if (shopChanged && workspaceState.listing) {
      resetLoadedListing();
      setStatus(`Boutique active changée : ${SHOP_LABELS[workspaceState.shopKey]}. Charge une fiche de cette boutique.`);
    }
    global.showView?.('pinterest');
    syncControls();
  };

  const bindEvents = () => {
    getElement('pinterestLoadBtn')?.addEventListener('click', loadListing);
    getElement('pinterestDataBtn')?.addEventListener('click', toggleData);
    getElement('pinterestGenerateBtn')?.addEventListener('click', generatePins);
    getElement('pinterestStopBtn')?.addEventListener('click', stopGeneration);
    getElement('pinterestListingId')?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      loadListing();
    });
  };

  const previousPromptResolver = global.resolveCustomPromptLightboxSpec;
  global.resolveCustomPromptLightboxSpec = (id) => {
    if (id === PROMPT_SPEC_ID) {
      return {
        label: 'Pinterest - Generation des epingles',
        path: PROMPT_PATH,
        stateKey: PROMPT_STATE_KEY,
      };
    }
    return previousPromptResolver?.(id) || null;
  };

  bindEvents();
  syncShopBadge();
  renderImages();
  syncControls();

  global.PipelineUIPinterest = {
    open,
    loadListing,
    generatePins,
    stopGeneration,
    getState: () => workspaceState,
  };
  global.PipelineUI.social = global.PipelineUI.social || {};
  global.PipelineUI.social.pinterest = global.PipelineUIPinterest;
})(window);
