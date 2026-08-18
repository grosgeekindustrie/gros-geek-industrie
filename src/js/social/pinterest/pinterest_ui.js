'use strict';

(function initPipelineUIPinterest(global) {
  global.PipelineUI = global.PipelineUI || {};

  const AGENT_ID = 'pinterest';
  const PROMPT_SPEC_ID = 'pinterest-publisher';
  const PROMPT_STATE_KEY = 'pinterestPublisher';
  const PROMPT_PATH = 'prompts/pinterest/pinterest.md';
  const DRAFT_KEY = 'pinterest-poc-draft-v2';
  const SHOP_LABELS = Object.freeze({ grosgeek: 'Gros Geek Industrie', doublex: 'Double X Industrie' });
  const SHOP_URLS = Object.freeze({
    grosgeek: 'https://grosgeekindustrie.etsy.com',
    doublex: 'https://doublexindustrie.etsy.com',
  });
  const STEPS = ['product', 'media', 'boards', 'content', 'queue'];

  function emptyContent() {
    return {
      titlesEn: ['', '', '', ''], titlesFr: ['', '', '', ''],
      descriptionEn: '', descriptionFr: '', altEn: '', altFr: '', link: '',
    };
  }

  const state = {
    activeStep: 'product', shopKey: 'grosgeek', listingId: '', listing: null, rawPayload: null,
    images: [], sortable: null, boards: [], assignments: {}, content: emptyContent(),
    running: false, connected: false, environment: 'sandbox', queue: null,
    queueTimer: null, clientBatchId: '', lastRawInput: '', draftImageOrder: [], draftListingId: '',
  };

  const el = (id) => document.getElementById(id);
  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const getActiveShopKey = () => global.PipelineUIApp?.getActiveShopKey?.() === 'doublex' ? 'doublex' : 'grosgeek';
  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  };
  const postJson = (url, payload) => requestJson(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}),
  });
  const getImageUrl = (image = {}) => String(
    image.url_fullxfull || image.url_570xN || image.url_570xn || image.url_170x135
    || image.full_url || image.src || image.url || ''
  ).trim();

  const autoGrowTextarea = (textarea) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.overflowY = 'hidden';
    const rows = Math.max(2, Number(textarea.getAttribute('rows')) || 2);
    const lineHeight = Number.parseFloat(global.getComputedStyle(textarea).lineHeight) || 20;
    textarea.style.height = `${Math.max(rows * lineHeight + 28, textarea.scrollHeight + 2)}px`;
  };
  const autoGrowAll = (container = document) => global.requestAnimationFrame(() => {
    container.querySelectorAll('textarea').forEach(autoGrowTextarea);
  });
  const setStatus = (id, message, type = '') => {
    const node = el(id);
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-error', type === 'error');
    node.classList.toggle('is-success', type === 'success');
  };
  const setAgentState = (message, type = '') => {
    const node = el('pinterestAgentState');
    if (!node) return;
    node.textContent = message;
    node.className = 'pinterest-agent-state';
    if (type) node.classList.add(`is-${type}`);
  };
  const normalizeImages = (images = []) => images.map((image, index) => ({
    id: String(image?.listing_image_id || image?.image_id || `etsy-image-${index + 1}`),
    url: getImageUrl(image), source: image,
  })).filter((image) => image.url);

  const cleanDescription = (value = '') => {
    const description = String(value || '').replace(/\r\n?/g, '\n').trim();
    const assembly = global.PipelineUIDescriptionAssembly;
    if (!description || !assembly?.stripDecorativeFixedBlocks) return description;
    const families = state.shopKey === 'doublex'
      ? ['collection_doublex', 'tabletop_doublex', 'collection', 'tabletop']
      : ['collection', 'tabletop'];
    let shortest = description;
    families.forEach((family) => {
      const result = assembly.stripDecorativeFixedBlocks(description, family, 'fr');
      const candidate = String(result?.description || '').trim();
      if (result?.stripped && candidate && candidate.length < shortest.length) shortest = candidate;
    });
    return shortest.replace(/\n{5,}/g, '\n\n\n\n').trim();
  };

  const collectContent = () => {
    const titles = (language) => [...document.querySelectorAll(`[data-pinterest-title-language="${language}"]`)]
      .map((node) => node.value.trim());
    if (document.querySelector('[data-pinterest-title-language]')) {
      state.content = {
        titlesEn: titles('en'), titlesFr: titles('fr'),
        descriptionEn: el('pinterestDescriptionEn')?.value || '',
        descriptionFr: el('pinterestDescriptionFr')?.value || '',
        altEn: el('pinterestAltEn')?.value || '', altFr: el('pinterestAltFr')?.value || '',
        link: el('pinterestLink')?.value || '',
      };
    }
    return state.content;
  };
  const createClientBatchId = () => global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const renewClientBatchId = () => {
    const content = collectContent();
    state.clientBatchId = content.titlesEn.some((title) => title.trim()) && content.descriptionEn.trim()
      ? createClientBatchId()
      : '';
  };
  const saveDraft = () => {
    const draft = {
      shopKey: state.shopKey, listingId: state.listingId,
      imageOrder: state.images.map(({ id }) => id), assignments: state.assignments,
      content: collectContent(), activeStep: state.activeStep, clientBatchId: state.clientBatchId,
    };
    try { global.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (error) {}
  };
  const restoreDraftShell = () => {
    let draft = {};
    try { draft = JSON.parse(global.localStorage.getItem(DRAFT_KEY) || '{}'); } catch (error) {}
    state.shopKey = draft.shopKey === 'doublex' ? 'doublex' : getActiveShopKey();
    state.assignments = draft.assignments && typeof draft.assignments === 'object' ? draft.assignments : {};
    state.content = draft.content && typeof draft.content === 'object' ? { ...emptyContent(), ...draft.content } : emptyContent();
    state.clientBatchId = String(draft.clientBatchId || '');
    state.draftImageOrder = Array.isArray(draft.imageOrder) ? draft.imageOrder.map(String) : [];
    state.draftListingId = String(draft.listingId || '');
  };

  const showStep = (step) => {
    if (!STEPS.includes(step)) return;
    state.activeStep = step;
    document.querySelectorAll('[data-pinterest-stage]').forEach((node) => node.classList.toggle('is-active', node.dataset.pinterestStage === step));
    document.querySelectorAll('[data-pinterest-step]').forEach((button) => {
      const index = STEPS.indexOf(button.dataset.pinterestStep);
      button.classList.toggle('is-active', button.dataset.pinterestStep === step);
      button.classList.toggle('is-complete', index < STEPS.indexOf(step));
    });
    if (step === 'boards') renderAssignments();
    if (step === 'content') renderContent();
    if (step === 'queue') { renderStaging(); refreshQueue(); }
    autoGrowAll(document.querySelector(`[data-pinterest-stage="${step}"]`) || document);
    saveDraft();
  };
  const setSubtab = (kind, name) => {
    const cap = `${kind[0].toUpperCase()}${kind.slice(1)}`;
    document.querySelectorAll(`[data-pinterest-${kind}-tab]`).forEach((button) => {
      button.classList.toggle('is-active', button.dataset[`pinterest${cap}Tab`] === name);
    });
    document.querySelectorAll(`[data-pinterest-${kind}-panel]`).forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset[`pinterest${cap}Panel`] === name);
    });
  };
  const syncControls = () => {
    const hasListing = Boolean(state.listing);
    const hasImages = Boolean(state.images.length);
    const assignmentsReady = hasImages && state.images.every((image) => Boolean(boardById(state.assignments[image.id]?.boardId)));
    const content = collectContent();
    const contentReady = content.titlesEn.some((title) => title.trim())
      && content.descriptionEn.trim() && content.altEn.trim() && content.link.trim();
    document.querySelectorAll('[data-pinterest-next="media"]').forEach((button) => { button.disabled = !hasListing; });
    document.querySelectorAll('[data-pinterest-next="boards"]').forEach((button) => { button.disabled = !hasImages; });
    document.querySelectorAll('[data-pinterest-next="content"]').forEach((button) => { button.disabled = !assignmentsReady; });
    document.querySelectorAll('[data-pinterest-next="queue"]').forEach((button) => { button.disabled = !contentReady; });
    if (el('pinterestGenerateBtn')) el('pinterestGenerateBtn').disabled = !hasListing || !hasImages || state.running;
    if (el('pinterestStopBtn')) el('pinterestStopBtn').disabled = !state.running;
    if (el('pinterestLoadBtn')) el('pinterestLoadBtn').disabled = state.running;
    if (el('pinterestDataBtn')) el('pinterestDataBtn').disabled = !state.rawPayload;
    if (el('pinterestEnqueueBtn')) el('pinterestEnqueueBtn').disabled = !assignmentsReady || !contentReady || !state.clientBatchId;
  };
  const syncShop = () => {
    const active = getActiveShopKey();
    if (active !== state.shopKey && state.listing) resetListing();
    state.shopKey = active;
    if (el('pinterestShopBadge')) el('pinterestShopBadge').textContent = SHOP_LABELS[state.shopKey];
  };
  const renderData = () => {
    const panel = el('pinterestDataPanel');
    if (!panel) return;
    panel.textContent = state.rawPayload ? JSON.stringify({
      shopKey: state.shopKey, listingId: state.listingId, normalized: state.listing,
      orderedImages: state.images.map(({ id, url }, index) => ({ position: index + 1, id, url })),
    }, null, 2) : 'Aucune donnée chargée.';
  };

  const syncImageOrderFromDom = () => {
    const order = [...el('pinterestImageGrid').querySelectorAll('[data-pinterest-image-id]')].map((node) => node.dataset.pinterestImageId);
    const byId = new Map(state.images.map((image) => [image.id, image]));
    state.images = order.map((id) => byId.get(id)).filter(Boolean);
    renewClientBatchId(); renderImages(); renderAssignments(); saveDraft();
  };
  const initializeSortable = () => {
    state.sortable?.destroy?.(); state.sortable = null;
    const grid = el('pinterestImageGrid');
    if (!grid || !state.images.length || typeof global.Sortable !== 'function') return;
    state.sortable = new global.Sortable(grid, { animation: 170, ghostClass: 'pinterest-sort-ghost', filter: 'button,input,textarea,select', onEnd: syncImageOrderFromDom });
  };
  const renderImages = () => {
    const grid = el('pinterestImageGrid');
    if (!grid) return;
    el('pinterestImageCount').textContent = `${state.images.length} image${state.images.length > 1 ? 's' : ''}`;
    grid.classList.toggle('is-empty', !state.images.length);
    if (!state.images.length) {
      grid.innerHTML = '<p class="pinterest-empty">Aucune image sélectionnée.</p>';
      initializeSortable(); syncControls(); return;
    }
    grid.innerHTML = state.images.map((image, index) => `
      <article class="pinterest-image-card" data-pinterest-image-id="${escapeHtml(image.id)}">
        <img src="${escapeHtml(image.url)}" alt="Image Etsy ${index + 1}" loading="lazy">
        <div class="pinterest-image-card-meta"><span><span data-svg-icon="grip"></span>Épingle ${index + 1}</span><button type="button" class="pinterest-image-remove" data-pinterest-remove-image="${escapeHtml(image.id)}" title="Retirer cette image">×</button></div>
      </article>`).join('');
    global.PipelineUIIcons?.hydrateIcons?.(grid); initializeSortable(); syncControls();
  };
  const resetListing = () => {
    state.listingId = ''; state.listing = null; state.rawPayload = null; state.images = [];
    state.assignments = {}; state.content = emptyContent(); state.clientBatchId = '';
    if (el('pinterestSourceFields')) el('pinterestSourceFields').hidden = true;
    ['pinterestSourceTitle', 'pinterestSourceDescription', 'pinterestSourceTags'].forEach((id) => { if (el(id)) el(id).value = ''; });
    renderImages(); renderData(); renderAssignments(); renderContent(); syncControls();
  };
  const loadListing = async () => {
    const listingId = String(el('pinterestListingId')?.value || '').trim();
    if (!/^\d+$/.test(listingId)) {
      setStatus('pinterestLoadStatus', 'Entre un listing_id Etsy numérique, sans URL.', 'error'); el('pinterestListingId')?.focus(); return;
    }
    syncShop(); setStatus('pinterestLoadStatus', `Chargement de la fiche ${listingId}…`);
    try {
      const envelope = await global.PipelineUIEtsyRuntime.fetchListingPayload(listingId, { shopKey: state.shopKey });
      const normalized = global.PipelineUIEtsyData.normalizeEtsyListingPayload(envelope?.payload || null);
      const listing = normalized?.data || null;
      if (!listing) throw new Error('La réponse Etsy ne contient aucune fiche exploitable.');
      const previousOrder = state.draftListingId === listingId ? state.draftImageOrder : [];
      const images = normalizeImages(listing.images);
      const orderIndex = new Map(previousOrder.map((id, index) => [id, index]));
      if (previousOrder.length) images.sort((a, b) => (orderIndex.get(a.id) ?? 9999) - (orderIndex.get(b.id) ?? 9999));
      state.listingId = listingId; state.rawPayload = envelope; state.listing = listing; state.images = images;
      if (state.draftListingId !== listingId) { state.assignments = {}; state.content = emptyContent(); state.clientBatchId = ''; }
      el('pinterestSourceTitle').value = String(listing.title || '').trim();
      el('pinterestSourceDescription').value = cleanDescription(listing.description || '');
      el('pinterestSourceTags').value = Array.isArray(listing.tags) ? listing.tags.join(', ') : '';
      el('pinterestSourceFields').hidden = false;
      state.content.link = state.content.link || String(listing.url || `https://www.etsy.com/listing/${listingId}`);
      renderImages(); renderAssignments(); renderData(); renderContent(); autoGrowAll(el('pinterestSourceFields'));
      setStatus('pinterestLoadStatus', `Fiche chargée · ${images.length} image${images.length > 1 ? 's' : ''} disponible${images.length > 1 ? 's' : ''}.`, 'success');
      state.draftListingId = listingId; saveDraft();
    } catch (error) { setStatus('pinterestLoadStatus', `Erreur Etsy : ${error.message}`, 'error'); }
    finally { syncControls(); }
  };
  const toggleData = () => { const panel = el('pinterestDataPanel'); if (panel) { panel.hidden = !panel.hidden; if (!panel.hidden) renderData(); } };

  const verifyConnection = async () => {
    const node = el('pinterestConnectionState');
    if (!node) return false;
    node.textContent = 'Pinterest : vérification…'; node.className = 'pinterest-connection-state';
    try {
      const payload = await requestJson('/pinterest/status');
      state.environment = payload.environment || 'sandbox'; state.connected = Boolean(payload.connected && !payload.connectionError);
      if (!payload.connected) {
        node.textContent = `Configuration incomplète : ${(payload.missingConfig || []).join(', ')}`; node.classList.add('is-error');
      } else if (payload.connectionError) {
        node.textContent = `Jeton refusé : ${payload.connectionError}`; node.classList.add('is-error');
      } else {
        const profile = payload.profile || {};
        node.textContent = `${state.environment === 'sandbox' ? 'Sandbox' : 'Production'} connectée · ${profile.username || profile.business_name || 'compte autorisé'}`; node.classList.add('is-success');
      }
      setupIntervals(); if (state.connected) await refreshBoards(); return state.connected;
    } catch (error) { node.textContent = `Pinterest : ${error.message}`; node.classList.add('is-error'); return false; }
  };
  const connectPinterest = async () => {
    try {
      const payload = await requestJson('/pinterest/oauth/start');
      const popup = global.open(payload.authUrl, '_blank');
      if (!popup) throw new Error('Le navigateur a bloqué la fenêtre Pinterest');
      setStatus('pinterestConnectionState', 'Autorisation Pinterest ouverte dans un nouvel onglet…');
    } catch (error) { global.showToast?.(error.message, '#ff4757'); }
  };

  const refreshBoards = async () => {
    setStatus('pinterestBoardStatus', 'Synchronisation des tableaux Pinterest…');
    try {
      const payload = await requestJson('/pinterest/boards');
      state.boards = Array.isArray(payload.boards) ? payload.boards : [];
      renderAssignments(); renderBoardManager();
      setStatus('pinterestBoardStatus', `${state.boards.length} tableau${state.boards.length > 1 ? 'x' : ''} synchronisé${state.boards.length > 1 ? 's' : ''}.`, 'success');
      syncControls();
    } catch (error) { setStatus('pinterestBoardStatus', `Synchronisation impossible : ${error.message}`, 'error'); }
  };
  const boardById = (id) => state.boards.find((board) => String(board.id) === String(id));
  const sectionById = (board, id) => (board?.sections || []).find((section) => String(section.id) === String(id));
  const boardOptions = (selected) => ['<option value="">Choisir un tableau…</option>'].concat(
    state.boards.map((board) => `<option value="${escapeHtml(board.id)}" ${String(board.id) === String(selected) ? 'selected' : ''}>${escapeHtml(board.name)}</option>`)
  ).join('');
  const sectionOptions = (board, selected) => ['<option value="">Racine du tableau</option>'].concat(
    (board?.sections || []).map((section) => `<option value="${escapeHtml(section.id)}" ${String(section.id) === String(selected) ? 'selected' : ''}>${escapeHtml(section.name)}</option>`)
  ).join('');
  const renderAssignments = () => {
    const container = el('pinterestAssignmentList');
    if (!container) return;
    if (!state.images.length) { container.innerHTML = '<p class="pinterest-empty">Sélectionne d’abord les images à publier.</p>'; return; }
    container.innerHTML = state.images.map((image, index) => {
      const assignment = state.assignments[image.id] || {}; const board = boardById(assignment.boardId);
      return `<article class="pinterest-assignment-row" data-pinterest-assignment-id="${escapeHtml(image.id)}">
        <div class="pinterest-assignment-image"><img src="${escapeHtml(image.url)}" alt="Épingle ${index + 1}"><span>#${index + 1}</span></div>
        <select data-pinterest-assignment-board aria-label="Tableau pour l’épingle ${index + 1}">${boardOptions(assignment.boardId)}</select>
        <select data-pinterest-assignment-section aria-label="Section pour l’épingle ${index + 1}" ${board ? '' : 'disabled'}>${sectionOptions(board, assignment.sectionId)}</select>
      </article>`;
    }).join(''); syncControls();
  };
  const renderBoardManager = () => {
    const container = el('pinterestBoardManager'); if (!container) return;
    if (!state.boards.length) { container.innerHTML = '<p class="pinterest-empty">Aucun tableau. Crée le premier tableau Sandbox ci-dessus.</p>'; return; }
    container.innerHTML = state.boards.map((board) => `
      <article class="pinterest-board-card" data-pinterest-board-id="${escapeHtml(board.id)}">
        <div class="pinterest-board-card-header"><input type="text" value="${escapeHtml(board.name)}" maxlength="180" data-pinterest-board-name aria-label="Nom du tableau"><input type="text" value="${escapeHtml(board.description || '')}" maxlength="500" data-pinterest-board-description aria-label="Description du tableau"><div class="pinterest-board-actions"><button class="btn btn-muted" type="button" data-pinterest-update-board>Enregistrer</button><button class="btn btn-error" type="button" data-pinterest-delete-board>Supprimer</button></div></div>
        <div class="pinterest-section-list">${(board.sections || []).map((section) => `<div class="pinterest-section-row" data-pinterest-section-id="${escapeHtml(section.id)}"><input type="text" value="${escapeHtml(section.name)}" maxlength="180" data-pinterest-section-name aria-label="Nom de la section"><div class="pinterest-board-actions"><button class="btn btn-muted" type="button" data-pinterest-update-section>Renommer</button><button class="btn btn-error" type="button" data-pinterest-delete-section>Supprimer</button></div></div>`).join('')}<div class="pinterest-section-create"><input type="text" maxlength="180" data-pinterest-new-section placeholder="Nouvelle section"><button class="btn btn-muted" type="button" data-pinterest-create-section>Ajouter</button></div></div>
      </article>`).join('');
  };
  const createBoard = async () => {
    const name = String(el('pinterestNewBoardName')?.value || '').trim(); if (!name) return el('pinterestNewBoardName')?.focus();
    try {
      await postJson('/pinterest/boards/create', { name, description: el('pinterestNewBoardDescription')?.value || '', privacy: 'PUBLIC' });
      el('pinterestNewBoardName').value = ''; el('pinterestNewBoardDescription').value = '';
      await refreshBoards(); global.showToast?.('Tableau Pinterest créé');
    } catch (error) { global.showToast?.(error.message, '#ff4757'); }
  };
  const handleBoardManagerClick = async (event) => {
    const card = event.target.closest('[data-pinterest-board-id]'); if (!card) return;
    const boardId = card.dataset.pinterestBoardId; const board = boardById(boardId); const sectionRow = event.target.closest('[data-pinterest-section-id]');
    try {
      if (event.target.closest('[data-pinterest-update-board]')) {
        await postJson('/pinterest/boards/update', { boardId, name: card.querySelector('[data-pinterest-board-name]').value, description: card.querySelector('[data-pinterest-board-description]').value });
      } else if (event.target.closest('[data-pinterest-delete-board]')) {
        if (!global.confirm(`Supprimer le tableau « ${board?.name || boardId} » sur Pinterest ? Cette action est définitive.`)) return;
        await postJson('/pinterest/boards/delete', { boardId });
      } else if (event.target.closest('[data-pinterest-create-section]')) {
        const input = card.querySelector('[data-pinterest-new-section]'); if (!input.value.trim()) return input.focus();
        await postJson('/pinterest/sections/create', { boardId, name: input.value });
      } else if (sectionRow && event.target.closest('[data-pinterest-update-section]')) {
        await postJson('/pinterest/sections/update', { boardId, sectionId: sectionRow.dataset.pinterestSectionId, name: sectionRow.querySelector('[data-pinterest-section-name]').value });
      } else if (sectionRow && event.target.closest('[data-pinterest-delete-section]')) {
        const name = sectionRow.querySelector('[data-pinterest-section-name]').value;
        if (!global.confirm(`Supprimer la section « ${name} » du tableau « ${board?.name || boardId} » ?`)) return;
        await postJson('/pinterest/sections/delete', { boardId, sectionId: sectionRow.dataset.pinterestSectionId });
      } else return;
      await refreshBoards();
    } catch (error) { global.showToast?.(error.message, '#ff4757'); }
  };

  const getCustomPromptState = () => { global.state.customPrompts = global.state.customPrompts || {}; return global.state.customPrompts; };
  const loadPrompt = async () => {
    const prompts = getCustomPromptState(); if (prompts[PROMPT_STATE_KEY]) return prompts[PROMPT_STATE_KEY];
    const response = await fetch(`/files/${PROMPT_PATH}`); if (!response.ok) throw new Error('Prompt Pinterest introuvable.');
    prompts[PROMPT_STATE_KEY] = await response.text(); return prompts[PROMPT_STATE_KEY];
  };
  const replacePromptValue = (prompt, placeholder, value) => prompt.split(`[[${placeholder}]]`).join(String(value ?? ''));
  const buildAgentPrompt = (template) => {
    const replacements = {
      SHOP_NAME: SHOP_LABELS[state.shopKey], SHOP_URL: SHOP_URLS[state.shopKey], ETSY_LISTING_ID: state.listingId,
      ETSY_URL: state.content.link || `https://www.etsy.com/listing/${state.listingId}`,
      TITLE: el('pinterestSourceTitle')?.value || '', TAGS: el('pinterestSourceTags')?.value || '',
      DESCRIPTION: el('pinterestSourceDescription')?.value || '', IMAGE_COUNT: state.images.length,
      ADDITIONAL_INSTRUCTION: el('pinterestAgentCorrection')?.value || '',
    };
    return Object.entries(replacements).reduce((prompt, [key, value]) => replacePromptValue(prompt, key, value), template);
  };
  const parseAgentResult = (raw) => {
    const clean = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(clean); const titles = Array.isArray(parsed.titles) ? parsed.titles.slice(0, 6) : [];
    if (!titles.length || !parsed.description?.en || !parsed.alt_text?.en) throw new Error('La réponse Pinterest ne respecte pas le format attendu.');
    return {
      titlesEn: titles.map((entry) => String(entry?.en || '')).filter(Boolean), titlesFr: titles.map((entry) => String(entry?.fr || '')),
      descriptionEn: String(parsed.description.en || ''), descriptionFr: String(parsed.description.fr || ''),
      altEn: String(parsed.alt_text.en || ''), altFr: String(parsed.alt_text.fr || ''),
      link: state.content.link || String(state.listing?.url || `https://www.etsy.com/listing/${state.listingId}`),
    };
  };
  const runAgent = async () => {
    if (state.running || !state.listing || !state.images.length) return;
    state.running = true; syncControls(); setAgentState('Génération en cours', 'running');
    try {
      const template = await loadPrompt(); const filled = buildAgentPrompt(template); state.lastRawInput = filled;
      global.state.inputs = global.state.inputs || {}; global.state.inputs[AGENT_ID] = filled;
      const response = await global.callClaude(AGENT_ID, { filled, fixedContent: '', runtimeAgentId: AGENT_ID }, false);
      state.content = parseAgentResult(response.text);
      state.clientBatchId = createClientBatchId();
      renderContent(); setAgentState('Génération terminée', 'success'); global.showToast?.('Contenu Pinterest généré'); saveDraft();
    } catch (error) {
      const stopped = /stopp|arrêt/i.test(String(error.message || ''));
      setAgentState(stopped ? 'Génération stoppée' : 'Erreur', stopped ? '' : 'error'); global.showToast?.(error.message, stopped ? '#e8c547' : '#ff4757');
    } finally { state.running = false; syncControls(); }
  };
  const stopAgent = () => { if (state.running) { global.stopAgent?.(AGENT_ID); setAgentState('Arrêt demandé'); } };
  const renderTitleList = (containerId, values, language) => {
    const container = el(containerId); if (!container) return;
    const normalized = values.length ? values : ['', '', '', ''];
    container.innerHTML = normalized.map((value, index) => `<label class="pinterest-title-item"><span>${index + 1}</span><textarea rows="2" maxlength="100" data-pinterest-title-language="${language}" data-pinterest-title-index="${index}" placeholder="Variante de titre ${index + 1}">${escapeHtml(value)}</textarea></label>`).join('');
  };
  const updateCounts = () => {
    if (el('pinterestDescriptionEnCount')) el('pinterestDescriptionEnCount').textContent = `${el('pinterestDescriptionEn')?.value.length || 0} / 800`;
    if (el('pinterestAltEnCount')) el('pinterestAltEnCount').textContent = `${el('pinterestAltEn')?.value.length || 0} / 500`;
  };
  const renderContent = () => {
    renderTitleList('pinterestTitlesEn', state.content.titlesEn || [], 'en'); renderTitleList('pinterestTitlesFr', state.content.titlesFr || [], 'fr');
    const values = {
      pinterestDescriptionEn: state.content.descriptionEn, pinterestDescriptionFr: state.content.descriptionFr,
      pinterestAltEn: state.content.altEn, pinterestAltFr: state.content.altFr,
      pinterestLink: state.content.link || (state.listingId ? `https://www.etsy.com/listing/${state.listingId}` : ''),
    };
    Object.entries(values).forEach(([id, value]) => { if (el(id)) el(id).value = value || ''; });
    updateCounts(); autoGrowAll(el('pinterestAgentTitle')?.closest('.pinterest-stage') || document); syncControls();
  };

  const buildStagingItems = () => {
    const content = collectContent(); const titles = content.titlesEn.filter((title) => title.trim()); if (!titles.length) return [];
    return state.images.map((image, index) => {
      const assignment = state.assignments[image.id] || {}; const board = boardById(assignment.boardId); const section = sectionById(board, assignment.sectionId);
      return {
        imageUrl: image.url, boardId: String(board?.id || ''), boardName: String(board?.name || ''),
        sectionId: String(section?.id || ''), sectionName: String(section?.name || ''),
        title: titles[index % titles.length], description: content.descriptionEn.trim(), altText: content.altEn.trim(), link: content.link.trim(),
      };
    });
  };
  const formatDuration = (seconds) => {
    const value = Math.max(0, Number(seconds) || 0); const days = Math.floor(value / 86400);
    const hours = Math.floor((value % 86400) / 3600); const minutes = Math.floor((value % 3600) / 60);
    return [days ? `${days} j` : '', hours ? `${hours} h` : '', minutes || (!days && !hours) ? `${minutes} min` : ''].filter(Boolean).join(' ');
  };
  const renderStaging = () => {
    const items = buildStagingItems(); const list = el('pinterestStagingList'); if (!list) return;
    el('pinterestStagingCount').textContent = `${items.length} épingle${items.length > 1 ? 's' : ''}`;
    const seconds = Number(el('pinterestIntervalSelect')?.value || 0); const totalSeconds = items.length > 1 ? (items.length - 1) * seconds : 0;
    el('pinterestStagingDuration').textContent = items.length ? `Lot étalé sur environ ${formatDuration(totalSeconds)}` : 'Aucun lot préparé';
    el('pinterestStagingSummary').textContent = items.length ? 'Aperçu exact du lot. L’ordre ci-dessous sera conservé dans la file persistante.' : 'Génère le contenu et attribue chaque image à un tableau.';
    list.innerHTML = items.map((item, index) => `<article class="pinterest-staging-row"><img src="${escapeHtml(item.imageUrl)}" alt="Aperçu épingle ${index + 1}"><div class="pinterest-staging-content"><strong>${index + 1}. ${escapeHtml(item.title)}</strong><span>${escapeHtml(item.boardName)}${item.sectionName ? ` › ${escapeHtml(item.sectionName)}` : ''}</span><p>${escapeHtml(item.description)}</p><span>ALT · ${escapeHtml(item.altText)}</span><span>${escapeHtml(item.link)}</span></div></article>`).join('');
    syncControls();
  };
  const setupIntervals = (settings = null) => {
    const select = el('pinterestIntervalSelect'); if (!select) return;
    const sandbox = state.environment === 'sandbox';
    const options = sandbox ? [[60, '1 minute · test'], [120, '2 minutes · test'], [300, '5 minutes · test']] : [[3600, '1 heure'], [7200, '2 heures'], [10800, '3 heures'], [14400, '4 heures'], [21600, '6 heures'], [28800, '8 heures']];
    const selected = Number(settings?.intervalSeconds || select.value || (sandbox ? 120 : 10800));
    select.innerHTML = options.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
    el('pinterestIntervalLabel').textContent = sandbox ? 'Intervalle de test Sandbox' : 'Intervalle de publication';
    el('pinterestIntervalHelp').textContent = sandbox ? 'POC uniquement : ces intervalles courts sont techniquement indisponibles en production.' : 'La production impose au minimum une heure entre deux épingles.';
  };
  const saveInterval = async () => {
    try { await postJson('/pinterest/settings', { intervalSeconds: Number(el('pinterestIntervalSelect').value) }); renderStaging(); await refreshQueue(); }
    catch (error) { global.showToast?.(error.message, '#ff4757'); }
  };
  const enqueueBatch = async () => {
    const items = buildStagingItems(); if (!items.length || !state.clientBatchId) return;
    if (!global.confirm(`Ajouter ${items.length} épingle${items.length > 1 ? 's' : ''} à la fin de la file Pinterest ?`)) return;
    const button = el('pinterestEnqueueBtn'); button.disabled = true; button.textContent = 'Sécurisation des images…';
    try {
      const payload = await postJson('/pinterest/queue/enqueue', { clientBatchId: state.clientBatchId, shopKey: state.shopKey, listingId: state.listingId, listingTitle: el('pinterestSourceTitle')?.value || '', items });
      if (payload.result?.duplicate) global.showToast?.('Ce lot était déjà dans la file', '#e8c547'); else global.showToast?.(`${items.length} épingle${items.length > 1 ? 's' : ''} ajoutée${items.length > 1 ? 's' : ''}`);
      state.clientBatchId = ''; saveDraft(); setSubtab('queue', 'active'); await refreshQueue();
    } catch (error) { global.showToast?.(error.message, '#ff4757'); }
    finally { button.textContent = 'Ajouter le lot à la file'; syncControls(); }
  };
  const refreshQueue = async () => {
    try { const payload = await requestJson('/pinterest/queue'); state.queue = payload; state.environment = payload.settings?.environment || state.environment; setupIntervals(payload.settings); renderQueue(); }
    catch (error) { if (el('pinterestQueueOverview')) el('pinterestQueueOverview').textContent = `File indisponible : ${error.message}`; }
  };
  const statusLabel = (status) => ({ queued: 'En attente', publishing: 'Publication', retry_wait: 'Nouvel essai', needs_review: 'À vérifier', failed: 'Erreur', published: 'Publiée', skipped: 'Ignorée' }[status] || status);
  const queueItemActions = (item) => {
    if (['failed', 'needs_review', 'retry_wait'].includes(item.status)) return `<button class="btn btn-muted" type="button" data-pinterest-queue-action="retry" data-pinterest-job-id="${escapeHtml(item.id)}">Réessayer</button><button class="btn btn-muted" type="button" data-pinterest-queue-action="skip" data-pinterest-job-id="${escapeHtml(item.id)}">Ignorer</button>`;
    if (item.status === 'queued') return `<button class="btn btn-error" type="button" data-pinterest-queue-action="delete_job" data-pinterest-job-id="${escapeHtml(item.id)}">Retirer</button>`;
    return '';
  };
  const renderQueue = () => {
    const queue = state.queue || { batches: [], counts: {}, settings: {} };
    const activeCount = ['queued', 'publishing', 'retry_wait', 'needs_review', 'failed'].reduce((total, key) => total + Number(queue.counts?.[key] || 0), 0);
    el('pinterestQueueCount').textContent = `${activeCount} en attente`;
    const settings = queue.settings || {}; const due = settings.nextDueAt ? new Date(settings.nextDueAt) : null;
    el('pinterestQueueOverview').textContent = settings.paused ? 'File en pause. Aucune nouvelle épingle ne sera publiée.' : due ? `Prochaine publication autorisée : ${due.toLocaleString('fr-FR')}` : 'La prochaine épingle partira dès que la file sera alimentée.';
    el('pinterestPauseQueueBtn').textContent = settings.paused ? 'Reprendre la file' : 'Mettre en pause';
    const container = el('pinterestActiveQueue');
    if (!queue.batches?.length) { container.innerHTML = '<p class="pinterest-empty">La file Pinterest est vide.</p>'; return; }
    container.innerHTML = queue.batches.map((batch) => {
      const items = batch.items || []; const completed = items.filter((item) => item.status === 'published').length;
      return `<details class="pinterest-queue-batch"><summary><strong>${escapeHtml(batch.listing_title || `Fiche ${batch.listing_id}`)}</strong><span>${completed} publiée${completed > 1 ? 's' : ''} · ${items.length - completed} restante${items.length - completed > 1 ? 's' : ''}</span></summary><div class="pinterest-queue-items">${items.map((item) => `<article class="pinterest-queue-item"><img src="${escapeHtml(item.imageUrl)}" alt="Épingle ${item.position}" loading="lazy"><div class="pinterest-queue-item-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.board_name)}${item.section_name ? ` › ${escapeHtml(item.section_name)}` : ''}</span><span class="pinterest-status-pill is-${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span>${item.last_error ? `<span>${escapeHtml(item.last_error)}</span>` : ''}</div><div class="pinterest-board-actions">${queueItemActions(item)}</div></article>`).join('')}<button class="btn btn-error" type="button" data-pinterest-queue-action="delete_batch" data-pinterest-batch-id="${escapeHtml(batch.id)}">Retirer le lot restant</button></div></details>`;
    }).join('');
  };
  const handleQueueAction = async (event) => {
    const button = event.target.closest('[data-pinterest-queue-action]'); if (!button) return;
    const action = button.dataset.pinterestQueueAction;
    if (action.startsWith('delete') && !global.confirm('Retirer définitivement cet élément de la file Pinterest ?')) return;
    if (action === 'retry' && !global.confirm('As-tu vérifié sur Pinterest que cette épingle n’a pas déjà été créée ?')) return;
    try { await postJson('/pinterest/queue/action', { action, jobId: button.dataset.pinterestJobId || '', batchId: button.dataset.pinterestBatchId || '' }); await refreshQueue(); }
    catch (error) { global.showToast?.(error.message, '#ff4757'); }
  };
  const toggleQueuePause = async () => {
    try { await postJson('/pinterest/settings', { paused: !Boolean(state.queue?.settings?.paused) }); await refreshQueue(); }
    catch (error) { global.showToast?.(error.message, '#ff4757'); }
  };
  const showRawInput = async () => {
    if (!state.lastRawInput) { try { state.lastRawInput = buildAgentPrompt(await loadPrompt()); } catch (error) {} }
    global.state.inputs = global.state.inputs || {}; global.state.inputs[AGENT_ID] = state.lastRawInput; global.showRawInput?.(AGENT_ID);
  };

  const bindEvents = () => {
    el('pinterestLoadBtn')?.addEventListener('click', loadListing);
    el('pinterestListingId')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadListing(); });
    el('pinterestDataBtn')?.addEventListener('click', toggleData); el('pinterestConnectBtn')?.addEventListener('click', connectPinterest);
    el('pinterestRefreshBoardsBtn')?.addEventListener('click', refreshBoards); el('pinterestCreateBoardBtn')?.addEventListener('click', createBoard);
    el('pinterestBoardManager')?.addEventListener('click', handleBoardManagerClick); el('pinterestGenerateBtn')?.addEventListener('click', runAgent);
    el('pinterestStopBtn')?.addEventListener('click', stopAgent); el('pinterestRawInputBtn')?.addEventListener('click', showRawInput);
    el('pinterestEnqueueBtn')?.addEventListener('click', enqueueBatch); el('pinterestIntervalSelect')?.addEventListener('change', saveInterval);
    el('pinterestPauseQueueBtn')?.addEventListener('click', toggleQueuePause); el('pinterestActiveQueue')?.addEventListener('click', handleQueueAction);
    document.querySelectorAll('[data-pinterest-step]').forEach((button) => button.addEventListener('click', () => showStep(button.dataset.pinterestStep)));
    document.querySelectorAll('[data-pinterest-next]').forEach((button) => button.addEventListener('click', () => showStep(button.dataset.pinterestNext)));
    document.querySelectorAll('[data-pinterest-back]').forEach((button) => button.addEventListener('click', () => showStep(button.dataset.pinterestBack)));
    document.querySelectorAll('[data-pinterest-board-tab]').forEach((button) => button.addEventListener('click', () => setSubtab('board', button.dataset.pinterestBoardTab)));
    document.querySelectorAll('[data-pinterest-queue-tab]').forEach((button) => button.addEventListener('click', () => setSubtab('queue', button.dataset.pinterestQueueTab)));
    el('pinterestImageGrid')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-pinterest-remove-image]'); if (!button) return;
      const id = button.dataset.pinterestRemoveImage; state.images = state.images.filter((image) => image.id !== id); delete state.assignments[id];
      renewClientBatchId(); renderImages(); renderAssignments(); saveDraft();
    });
    el('pinterestAssignmentList')?.addEventListener('change', (event) => {
      const row = event.target.closest('[data-pinterest-assignment-id]'); if (!row) return;
      const imageId = row.dataset.pinterestAssignmentId; const boardSelect = row.querySelector('[data-pinterest-assignment-board]'); const sectionSelect = row.querySelector('[data-pinterest-assignment-section]');
      if (event.target.matches('[data-pinterest-assignment-board]')) {
        state.assignments[imageId] = { boardId: boardSelect.value, sectionId: '' }; const board = boardById(boardSelect.value);
        sectionSelect.innerHTML = sectionOptions(board, ''); sectionSelect.disabled = !board;
      } else state.assignments[imageId] = { boardId: boardSelect.value, sectionId: sectionSelect.value };
      renewClientBatchId(); syncControls(); saveDraft();
    });
    document.querySelector('[data-pinterest-stage="content"]')?.addEventListener('input', (event) => {
      if (event.target.matches('textarea')) autoGrowTextarea(event.target);
      collectContent(); renewClientBatchId(); updateCounts(); syncControls(); saveDraft();
    });
    el('pinterestSourceFields')?.addEventListener('input', (event) => { if (event.target.matches('textarea')) autoGrowTextarea(event.target); state.clientBatchId = ''; saveDraft(); });
  };

  const previousPromptResolver = global.resolveCustomPromptLightboxSpec;
  global.resolveCustomPromptLightboxSpec = (id) => id === PROMPT_SPEC_ID
    ? { label: 'Pinterest · génération bilingue', path: PROMPT_PATH, stateKey: PROMPT_STATE_KEY }
    : previousPromptResolver?.(id) || null;
  const open = () => {
    syncShop(); global.showView?.('pinterest'); showStep(state.activeStep || 'product');
    global.scrollTo({ top: 0, behavior: 'instant' }); verifyConnection(); refreshQueue();
  };

  restoreDraftShell(); bindEvents(); syncShop(); setupIntervals(); renderImages(); renderAssignments(); renderContent(); showStep('product'); syncControls();
  verifyConnection(); refreshQueue();
  if (/^\d+$/.test(state.draftListingId)) { el('pinterestListingId').value = state.draftListingId; global.setTimeout(loadListing, 0); }
  state.queueTimer = global.setInterval(() => { if (document.getElementById('view-pinterest')?.classList.contains('active')) refreshQueue(); }, 15000);

  global.PipelineUIPinterest = { open, loadListing, refreshBoards, refreshQueue, runAgent, stopAgent, getState: () => state };
  global.PipelineUI.social = global.PipelineUI.social || {};
  global.PipelineUI.social.pinterest = global.PipelineUIPinterest;
})(window);
