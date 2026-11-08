'use strict';

(function initRenewalWorkshop(global) {
  const state = {
    opened: false, tab: 'select', catalog: [], jobs: [], counts: {}, expandedId: '',
    selectedListings: new Set(), selectedJobs: new Set(), selectedImages: new Map(),
    drafts: new Map(), jobDrafts: new Map(), reviewDrafts: new Map(), reviewAutosaveTimers: new Map(), formAutosaveTimers: new Map(), deletedJobs: new Set(),
    processing: false, auditing: false, publishingJobs: new Set(), publicationDebug: new Map(), status: '',
  };

  const host = () => document.getElementById('renewalWorkspace');
  const shopKey = () => global.getActiveShopKey?.() || 'grosgeek';
  const clone = (value) => JSON.parse(JSON.stringify(value || {}));
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const payload = await response.json();
    if (!response.ok) {
      const message = typeof payload.error === 'string'
        ? payload.error
        : (payload.error?.message || `HTTP ${response.status}`);
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  const contextUrl = (path) => `${path}${path.includes('?') ? '&' : '?'}shop=${encodeURIComponent(shopKey())}`;
  const stateLabel = (value) => ({
    prepared: 'Préparée', queued: 'En attente', running: 'Génération en cours',
    review_ready: 'À valider', ready_to_publish: 'Prête à publier', publishing: 'Publication',
    published: 'Mise à jour', failed: 'Échec', cancelled: 'Annulée',
  }[value] || value);

  function inferMode(listing) {
    const haystack = `${listing.sectionName || ''} ${listing.title || ''}`.toLowerCase();
    return /(nerikson|rescale|tabletop|ttrpg|d&d|dnd|wargame|miniature)/.test(haystack) ? 'tabletop' : 'collection';
  }

  function defaultPricing() {
    return {
      calculator: { resinCost: '', supportVariable: '1.4', finalMultiplier: '10', plates: '1', tax: '1', total: 0 },
      rows: {}, gridAssistant: { useReferences: true },
    };
  }

  const normalizeScale = (value = '') => String(value || '').replace(/&(?:gt|#62);/gi, '>').replace(/\s+/g, '').replace(':', '/').toLowerCase();
  const imageKey = (image, index = 0) => String(image?.id || image?.listing_image_id || image?.image_id || image?.url || index);
  const readNumber = (value) => Number(String(value ?? '').replace(',', '.'));

  function parseDimensions(value = '') {
    const values = String(value || '').match(/\d+(?:[.,]\d+)?/g)?.map((item) => Number(item.replace(',', '.'))) || [];
    return values.length === 3 && values.every(Number.isFinite) ? values : null;
  }

  const formatDimensions = (values) => values.map((value) => `${Math.floor(value + 0.5)}mm`).join(' * ');

  function priceFromOffering(product = {}) {
    const offering = (product.offerings || []).find((item) => item?.is_enabled !== false && !item?.is_deleted) || product.offerings?.[0];
    const amount = Number(offering?.price?.amount); const divisor = Number(offering?.price?.divisor || 100);
    return Number.isFinite(amount) && divisor > 0 ? amount / divisor : null;
  }

  function buildOriginalPricing(inventory = {}, scales = []) {
    const rows = {}; const products = (inventory.products || []).filter((product) => !product?.is_deleted);
    products.forEach((product) => {
      const price = priceFromOffering(product); if (!(price > 0)) return;
      const values = (product.property_values || []).flatMap((property) => property?.values || []).map(String);
      const joined = values.join(' '); const productNumbers = joined.match(/\d+(?:[.,]\d+)?/g)?.map((item) => Number(item.replace(',', '.'))) || [];
      let entry = scales.find((scale) => values.some((value) => normalizeScale(value).includes(normalizeScale(scale.label))));
      if (!entry) entry = scales.find((scale) => {
        const height = parseDimensions(scale.dimension)?.[0] ?? Number(String(scale.dimension || '').match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.'));
        return Number.isFinite(height) && productNumbers.some((value) => Math.abs(value - height) < 0.6);
      });
      if (!entry && products.length === 1 && scales.length === 1) [entry] = scales;
      if (entry) rows[entry.key] = { priceFr: price.toFixed(2), compensation: '0', source: 'etsy' };
    });
    return rows;
  }

  function inferOriginScale(listing, scales) {
    const section = normalizeScale(listing.sectionName || '');
    return scales.find((entry) => section.includes(normalizeScale(entry.label))) || (scales.length === 1 ? scales[0] : scales[0]);
  }

  function inferSingleInventoryScale(listing, labels) {
    const products = (listing.inventory?.products || []).filter((product) => !product?.is_deleted);
    if (products.length !== 1 || !(priceFromOffering(products[0]) > 0)) return null;
    const clues = [listing.sectionName, products[0].sku, listing.title];
    for (const clue of clues) {
      const ratio = String(clue || '').match(/(?:^|\D)1\s*[/_:]\s*(\d{1,2})(?!\d)/);
      if (!ratio) continue;
      const index = labels.findIndex((label) => normalizeScale(label) === `1/${ratio[1]}`);
      if (index >= 0) return { key: `scale-${index}`, label: labels[index], dimension: '', isOrigin: true, dimensionSource: '' };
    }
    return null;
  }

  function getPrefill(listing) {
    const mode = inferMode(listing); const labels = getScaleLabels(mode);
    const built = global.PipelineUIListingRelaunchData?.buildFormPrefill?.({
      title: listing.title, description: listing.description, inventory: listing.inventory || {},
    }) || {};
    const builtScales = built.scales instanceof Map ? [...built.scales.values()] : [];
    const scales = builtScales.map((value, fallbackIndex) => {
      const index = labels.findIndex((label) => normalizeScale(label) === normalizeScale(value.label));
      return {
        key: `scale-${index >= 0 ? index : fallbackIndex}`, label: value.label || labels[index] || '',
        dimension: value.dimensions || value.dimension || '', isOrigin: false, dimensionSource: 'etsy',
      };
    });
    if (!scales.length) {
      const inferred = inferSingleInventoryScale(listing, labels);
      if (inferred) scales.push(inferred);
    }
    const origin = inferOriginScale(listing, scales); if (origin) origin.isOrigin = true;
    const pricing = defaultPricing(); pricing.rows = buildOriginalPricing(listing.inventory || {}, scales);
    return {
      name: built.fullName || '', shortName: built.shortName || '', universe: built.universe || '',
      sculptor: built.sculptor || '', pieces: built.pieces || '', instructions: '',
      scales, pricing,
    };
  }

  function getCatalogDraft(listing) {
    const id = String(listing.listingId);
    if (!state.drafts.has(id)) state.drafts.set(id, { ...getPrefill(listing), mode: inferMode(listing) });
    return state.drafts.get(id);
  }

  function getJobDraft(job) {
    if (!state.jobDrafts.has(job.jobId)) {
      const form = clone(job.form);
      const labels = getScaleLabels(job.mode);
      const keyMap = new Map();
      form.scales = (Array.isArray(form.scales) ? form.scales : []).map((entry, fallbackIndex) => {
        const index = labels.findIndex((label) => String(label).replace(/\s+/g, '').toLowerCase() === String(entry.label || '').replace(/\s+/g, '').toLowerCase());
        const key = `scale-${index >= 0 ? index : fallbackIndex}`; keyMap.set(entry.key, key);
        return {
          key,
          label: entry.label || labels[index] || '',
          dimension: entry.dimension || entry.dimensions || '',
          isOrigin: Boolean(entry.isOrigin),
          dimensionSource: entry.dimensionSource || (entry.dimension || entry.dimensions ? 'etsy' : ''),
        };
      });
      if (form.scales.length && !form.scales.some((entry) => entry.isOrigin)) form.scales[0].isOrigin = true;
      form.pricing = { ...defaultPricing(), ...(form.pricing || {}) };
      form.pricing.calculator = { ...defaultPricing().calculator, ...(form.pricing.calculator || {}) };
      const storedRows = form.pricing.rows || {}; form.pricing.rows = {};
      Object.entries(storedRows).forEach(([key, value]) => { form.pricing.rows[keyMap.get(key) || key] = value; });
      const listing = state.catalog.find((item) => String(item.listingId) === String(job.listingId));
      if (listing) {
        if (!form.scales.length) {
          const inferred = inferSingleInventoryScale(listing, labels);
          if (inferred) form.scales.push(inferred);
        }
        const originalRows = buildOriginalPricing(listing.inventory || {}, form.scales);
        Object.entries(originalRows).forEach(([key, value]) => { if (!form.pricing.rows[key]?.priceFr) form.pricing.rows[key] = value; });
      }
      form.pricing.gridAssistant = { useReferences: true, ...(form.pricing.gridAssistant || {}) };
      state.jobDrafts.set(job.jobId, { ...job, form });
    }
    return state.jobDrafts.get(job.jobId);
  }

  function getScaleLabels(mode) {
    const data = global.PipelineUIDataEchelles?.ECHELLES_BY_MODE || {};
    if (mode === 'collection') return [...(data.collection || [])];
    return [...((shopKey() === 'doublex' ? data.tabletop_doublex : data.tabletop) || data.tabletop || [])];
  }

  function renderMetrics() {
    const selected = state.selectedListings.size;
    const prepared = Number(state.counts.prepared || 0);
    const active = Number(state.counts.queued || 0) + Number(state.counts.running || 0);
    const review = Number(state.counts.review_ready || 0);
    return `<div class="renewal-metrics">
      <div><strong>${state.catalog.length}</strong><span>fiches expirées</span></div>
      <div><strong>${selected || prepared}</strong><span>${selected ? 'sélectionnées' : 'préparées'}</span></div>
      <div><strong>${active}</strong><span>en génération</span></div>
      <div><strong>${review}</strong><span>à valider</span></div>
    </div>`;
  }

  function renderHero() {
    const jobs = state.jobs.filter((job) => job.shopKey === shopKey());
    const hasRunnableJob = jobs.some((job) => ['queued', 'running'].includes(job.state));
    return `<header class="renewal-hero">
      <div class="renewal-hero-copy"><p class="renewal-kicker">ATELIER · REWORK</p><h1 id="renewalTitle">Renouvellements</h1><span>Sélectionne les fiches, prépare leurs échelles et leurs prix, puis valide chaque sortie sans quitter l’atelier.</span></div>
      <div class="renewal-hero-actions">
        <button class="ds-button ds-button-secondary renewal-audit-button" type="button" data-renewal-refresh ${state.auditing || state.processing ? 'disabled' : ''}>${state.auditing ? 'Audit en cours…' : 'Auditer les expirées'}</button>
        <button class="ds-button ds-button-primary renewal-start-button" type="button" data-renewal-start ${state.processing || !hasRunnableJob ? 'disabled' : ''}>${state.processing ? 'File en cours…' : 'Reprendre la file'}</button>
      </div>
    </header>`;
  }

  function renderTabs() {
    const tabs = [['select', '1 · Sélectionner'], ['prepare', '2 · Préparer'], ['generate', '3 · Générer'], ['review', '4 · Valider'], ['completed', '5 · Terminées']];
    return `<nav class="renewal-tabs">${tabs.map(([key, label]) => `<button class="${state.tab === key ? 'is-active' : ''}" data-renewal-tab="${key}">${label}</button>`).join('')}</nav>`;
  }

  function renderDeleteButton(job) {
    return `<button class="renewal-icon-button is-danger" type="button" data-renewal-delete="${escapeHtml(job.jobId)}" title="Supprimer ce dossier de l’atelier" aria-label="Supprimer ce dossier">×</button>`;
  }

  function renderCatalogCard(listing) {
    const id = String(listing.listingId);
    const expanded = state.expandedId === `listing:${id}`;
    const selected = state.selectedImages.get(id) || new Set();
    const draft = getCatalogDraft(listing);
    const images = listing.images || [];
    const existingJob = state.jobs.find((job) => job.shopKey === shopKey() && String(job.listingId) === id);
    const checked = state.selectedListings.has(id);
    return `<article class="renewal-card${expanded ? ' is-open' : ''}${checked ? ' is-selected' : ''}" data-renewal-listing="${escapeHtml(id)}">
      <div class="renewal-card-summary">
        <label class="renewal-pick" title="Sélectionner cette fiche"><input type="checkbox" data-renewal-listing-select="${escapeHtml(id)}" ${checked ? 'checked' : ''} ${existingJob ? 'disabled' : ''}><span></span></label>
        <button class="renewal-card-main" type="button" data-renewal-expand="listing:${escapeHtml(id)}">
          <img src="${escapeHtml(listing.imageUrl || images[0]?.thumbnailUrl || '')}" alt="">
          <span class="renewal-card-copy"><strong>${escapeHtml(listing.title || 'Sans titre')}</strong><small>${escapeHtml(listing.sectionName || 'Sans section')} · Etsy ${escapeHtml(id)}</small></span>
          <span class="renewal-card-count">${existingJob ? stateLabel(existingJob.state) : `${selected.size} image${selected.size > 1 ? 's' : ''}`}</span><span class="renewal-card-chevron">⌄</span>
        </button>${existingJob ? renderDeleteButton(existingJob) : ''}
      </div>
      ${expanded ? `<div class="renewal-card-body">${existingJob
        ? '<div class="renewal-inline-note">Cette fiche possède déjà un dossier dans l’atelier. Supprime-le pour repartir de zéro.</div>'
        : `<div class="renewal-image-grid">${images.map((image, index) => {
          const key = String(image.id || index); const imageChecked = selected.has(key);
          return `<label class="renewal-image${imageChecked ? ' is-selected' : ''}"><input type="checkbox" data-renewal-image="${escapeHtml(key)}" ${imageChecked ? 'checked' : ''}><img src="${escapeHtml(image.thumbnailUrl || image.url)}" alt="Image ${index + 1}"><span>${imageChecked ? 'Retenue' : `Image ${index + 1}`}</span></label>`;
        }).join('')}</div><p class="renewal-image-help">Sélection libre : une image minimum, autant que nécessaire pour représenter correctement la figurine.</p>
        <div class="renewal-form-grid">
          <label><span>Nom validé</span><input data-renewal-field="name" value="${escapeHtml(draft.name)}"></label><label><span>Nom court</span><input data-renewal-field="shortName" value="${escapeHtml(draft.shortName)}"></label><label><span>Univers</span><input data-renewal-field="universe" value="${escapeHtml(draft.universe)}"></label>
          <label><span>Sculpteur</span><input data-renewal-field="sculptor" value="${escapeHtml(draft.sculptor)}"></label><label><span>Nombre de pièces</span><input data-renewal-field="pieces" value="${escapeHtml(draft.pieces)}"></label><label><span>Mode</span><select data-renewal-field="mode"><option value="collection" ${draft.mode === 'collection' ? 'selected' : ''}>Collection</option><option value="tabletop" ${draft.mode === 'tabletop' ? 'selected' : ''}>Tabletop</option></select></label>
          <label class="is-wide"><span>Consigne ponctuelle</span><textarea data-renewal-field="instructions" rows="2">${escapeHtml(draft.instructions)}</textarea></label>
        </div>`}</div>` : ''}
    </article>`;
  }

  function renderSelectionStage() {
    return `${state.catalog.map(renderCatalogCard).join('') || '<div class="renewal-empty">Lance un audit frais pour charger les fiches expirées.</div>'}
      <div class="renewal-stage-action"><div><strong>${state.selectedListings.size} fiche(s) sélectionnée(s)</strong><span>Choisis au moins une image dans chaque fiche.</span></div><button class="ds-button ds-button-primary" type="button" data-renewal-prepare-selected ${state.selectedListings.size ? '' : 'disabled'}>Préparer la sélection</button></div>`;
  }

  function scaleByLabel(form) {
    return new Map((form.scales || []).map((entry) => [String(entry.label || ''), entry]));
  }

  function parseScaleDescriptor(label = '') {
    const normalized = normalizeScale(label);
    const ratio = normalized.match(/^1\/(\d+(?:[.,]\d+)?)$/);
    if (ratio) return { kind: 'ratio', value: Number(ratio[1].replace(',', '.')) };
    const millimeter = normalized.match(/^(\d+(?:[.,]\d+)?)mm$/);
    if (millimeter) return { kind: 'millimeter', value: Number(millimeter[1].replace(',', '.')) };
    const chibi = { 'chibi100%': 1, 'chibiupscale125%': 1.25, 'chibiupscale150%': 1.5 }[normalized];
    return Number.isFinite(chibi) ? { kind: 'chibi', value: chibi } : null;
  }

  function dimensionFactor(origin, target, originDimensions) {
    const from = parseScaleDescriptor(origin.label); const to = parseScaleDescriptor(target.label);
    if (!to || !originDimensions) return null;
    if (to.kind === 'millimeter') return to.value / originDimensions[0];
    if (!from || from.kind !== to.kind) return null;
    if (to.kind === 'ratio') return from.value / to.value;
    if (to.kind === 'chibi') return to.value / from.value;
    return null;
  }

  function recalculateDimensions(draft, { force = false } = {}) {
    const origin = draft.form.scales.find((entry) => entry.isOrigin); const originDimensions = parseDimensions(origin?.dimension);
    if (!origin || !originDimensions) return 0;
    let changed = 0;
    draft.form.scales.forEach((entry) => {
      if (entry.key === origin.key || (!force && entry.dimension && entry.dimensionSource !== 'auto')) return;
      const factor = dimensionFactor(origin, entry, originDimensions);
      if (!Number.isFinite(factor) || factor <= 0) return;
      entry.dimension = formatDimensions(originDimensions.map((value) => value * factor)); entry.dimensionSource = 'auto'; changed += 1;
    });
    return changed;
  }

  function refreshPricingRow(row, draft, key) {
    if (!row) return;
    const display = getPricingDisplay(draft.form.pricing.rows[key] || {});
    const natural = row.querySelector('[data-renewal-natural]'); const final = row.querySelector('[data-renewal-final]'); const copy = row.querySelector('[data-renewal-copy-price]');
    if (natural) natural.textContent = display.naturalUsd;
    if (final) final.textContent = display.finalUsd;
    if (copy) { copy.textContent = display.etsyEur; copy.dataset.renewalCopyPrice = display.etsyPlain; copy.disabled = !display.etsyPlain; }
  }

  function renderCalculator(job, draft) {
    const calc = draft.form.pricing.calculator;
    const total = Number(calc.total || 0);
    return `<div class="renewal-calculator" data-renewal-calculator="${escapeHtml(job.jobId)}">
      <div class="renewal-calculator-heading"><div><span>CALCULATEUR DE COÛT · V7</span><strong>Prix conseillé de l’échelle d’origine</strong></div><strong class="renewal-calculator-total">${total.toFixed(2).replace('.', ',')} €</strong></div>
      <div class="renewal-calculator-grid">
        <label>Coût résine (€)<input type="number" min="0" step="0.1" data-renewal-calc="resinCost" value="${escapeHtml(calc.resinCost)}"></label><label>Support<input type="number" min="0" step="0.1" data-renewal-calc="supportVariable" value="${escapeHtml(calc.supportVariable)}"></label>
        <label>Multiplicateur<select data-renewal-calc="finalMultiplier">${[10,9,8,7,6,5].map((value) => `<option value="${value}" ${String(calc.finalMultiplier) === String(value) ? 'selected' : ''}>× ${value}</option>`).join('')}</select></label>
        <label>Plateaux<select data-renewal-calc="plates">${Array.from({ length: 12 }, (_, index) => index + 1).map((value) => `<option value="${value}" ${String(calc.plates) === String(value) ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>Taxe / diviseur<input type="number" min="0.05" step="0.05" data-renewal-calc="tax" value="${escapeHtml(calc.tax)}"></label>
      </div><div class="renewal-calculator-actions"><button class="ds-button ds-button-secondary ds-button-small" type="button" data-renewal-calculate-cost="${escapeHtml(job.jobId)}">Calculer</button><button class="ds-button ds-button-secondary ds-button-small" type="button" data-renewal-transfer-origin="${escapeHtml(job.jobId)}" ${total > 0 ? '' : 'disabled'}>Transférer vers l’origine</button><button class="ds-button ds-button-secondary ds-button-small" type="button" data-renewal-calculate-grid="${escapeHtml(job.jobId)}">Calculer toute la grille</button></div>
    </div>`;
  }

  function renderScalePreparation(job, draft) {
    const labels = getScaleLabels(job.mode); const existing = scaleByLabel(draft.form); const rows = draft.form.pricing.rows || {};
    const missingDimensions = draft.form.scales.some((scale) => !parseDimensions(scale.dimension));
    return `<section class="renewal-preparation-panel"><div class="renewal-preparation-title"><strong>Échelles, dimensions et pricing</strong><span>Choisis l’échelle d’origine : les autres dimensions compatibles sont calculées automatiquement.</span></div>
      <div class="renewal-scale-table-wrap"><table class="renewal-scale-table"><thead><tr><th>Actif</th><th>Origine</th><th>Échelle</th><th>Dimensions</th><th>Prix FR</th><th>US naturel</th><th>Compensation</th><th>US final</th><th>EUR Etsy</th></tr></thead><tbody>${labels.map((label, index) => {
        const key = `scale-${index}`; const entry = existing.get(label); const price = rows[key] || {};
        const display = getPricingDisplay(price);
        return `<tr data-renewal-scale-row="${key}"><td><input type="checkbox" data-renewal-scale-toggle="${key}" data-scale-label="${escapeHtml(label)}" ${entry ? 'checked' : ''}></td><td><input type="radio" name="renewal-origin-${escapeHtml(job.jobId)}" data-renewal-scale-origin="${key}" ${entry?.isOrigin ? 'checked' : ''} ${entry ? '' : 'disabled'}></td><td><strong>${escapeHtml(label)}</strong></td><td><input type="text" data-renewal-scale-dimension="${key}" value="${escapeHtml(entry?.dimension || entry?.dimensions || '')}" ${entry ? '' : 'disabled'} placeholder="224mm × 200mm × 136mm"></td><td><input type="number" min="0" step="0.01" data-renewal-scale-price="${key}" value="${escapeHtml(price.priceFr || '')}" ${entry ? '' : 'disabled'}></td><td class="renewal-money-result" data-renewal-natural>${display.naturalUsd}</td><td><input type="number" min="0" step="5" data-renewal-scale-compensation="${key}" value="${escapeHtml(price.compensation || '0')}" ${entry ? '' : 'disabled'}></td><td class="renewal-money-result is-highlight" data-renewal-final>${display.finalUsd}</td><td><button class="renewal-copy-price" type="button" data-renewal-copy-price="${escapeHtml(display.etsyPlain)}" ${display.etsyPlain ? '' : 'disabled'}>${display.etsyEur}</button></td></tr>`;
      }).join('')}</tbody></table></div>${missingDimensions ? '<p class="renewal-dimension-warning">Dimensions absentes ou incomplètes dans la fiche Etsy : renseigne les trois mesures avant de générer.</p>' : ''}${renderCalculator(job, draft)}</section>`;
  }

  function getPricingDisplay(row = {}) {
    const read = (value) => Number(String(value ?? '').replace(',', '.'));
    const priceFr = read(row.priceFr); const compensation = read(row.compensation);
    const rate = Number(localStorage.getItem('figurineUsdToEurRate')) || 0.8559;
    const suggest = global.PipelineUIPricing?.suggestedUsdFromEuro;
    const natural = Number.isFinite(priceFr) && priceFr > 0 ? suggest?.(priceFr, rate)?.target : 0;
    const final = Number.isFinite(priceFr) && priceFr > 0 ? suggest?.(priceFr + (Number.isFinite(compensation) ? compensation : 0), rate)?.target : 0;
    const etsy = final ? final * rate : 0;
    return {
      naturalUsd: natural ? `${natural.toFixed(2)} $` : '—',
      finalUsd: final ? `${final.toFixed(2)} $` : '—',
      etsyEur: etsy ? `${etsy.toFixed(2).replace('.', ',')} €` : '—',
      etsyPlain: etsy ? etsy.toFixed(2) : '',
    };
  }

  function renderPricingSummary(job, sectionNumber = '', editable = true) {
    const draft = getJobDraft(job); const form = draft.form || {}; const rows = form.pricing?.rows || {}; const scales = Array.isArray(form.scales) ? form.scales : [];
    const content = scales.map((scale) => {
      const row = rows[scale.key] || {}; const display = getPricingDisplay(row); const priceFr = readNumber(row.priceFr);
      const dimensionsCell = editable ? `<input type="text" data-renewal-scale-dimension="${escapeHtml(scale.key)}" value="${escapeHtml(scale.dimension || scale.dimensions || '')}" placeholder="224mm × 200mm × 136mm">` : escapeHtml(scale.dimension || scale.dimensions || '—');
      const priceCell = editable ? `<input type="number" min="0" step="0.01" data-renewal-scale-price="${escapeHtml(scale.key)}" value="${Number.isFinite(priceFr) && priceFr > 0 ? escapeHtml(priceFr.toFixed(2)) : ''}">` : (Number.isFinite(priceFr) && priceFr > 0 ? `${escapeHtml(priceFr.toFixed(2).replace('.', ','))} €` : '—');
      const compensationCell = editable ? `<input type="number" min="0" step="5" data-renewal-scale-compensation="${escapeHtml(scale.key)}" value="${escapeHtml(String(row.compensation || '0'))}">` : escapeHtml(String(row.compensation || '0'));
      return `<tr data-renewal-scale-row="${escapeHtml(scale.key)}"><td><strong>${escapeHtml(scale.label || '')}</strong>${scale.isOrigin ? '<small class="renewal-origin-badge">Origine</small>' : ''}</td><td>${dimensionsCell}</td><td>${priceCell}</td><td class="renewal-money-result" data-renewal-natural>${escapeHtml(display.naturalUsd)}</td><td>${compensationCell}</td><td class="renewal-money-result is-highlight" data-renewal-final>${escapeHtml(display.finalUsd)}</td><td><button class="renewal-copy-price" type="button" data-renewal-copy-price="${escapeHtml(display.etsyPlain)}" ${display.etsyPlain ? '' : 'disabled'}>${escapeHtml(display.etsyEur)}</button></td></tr>`;
    }).join('');
    return `<section class="renewal-review-section renewal-pricing-summary"><div class="renewal-review-heading">${sectionNumber ? `<span>${escapeHtml(sectionNumber)}</span>` : ''}<div><strong>Échelles et prix</strong><small>${editable ? 'Prix FR, compensation et dimensions restent modifiables ; les conversions sont recalculées en direct.' : 'Pricing utilisé lors de la mise à jour Etsy.'}</small></div></div><div class="renewal-scale-table-wrap"><table class="renewal-scale-table"><thead><tr><th>Échelle</th><th>Dimensions</th><th>Prix FR</th><th>US naturel</th><th>Compensation</th><th>US final</th><th>EUR Etsy</th></tr></thead><tbody>${content || '<tr><td colspan="7">Aucune échelle préparée.</td></tr>'}</tbody></table></div>${editable ? renderCalculator(job, draft) : ''}</section>`;
  }

  function renderPreparedCard(job) {
    const draft = getJobDraft(job); const checked = state.selectedJobs.has(job.jobId);
    const expanded = state.expandedId === `prepare:${job.jobId}`;
    return `<article class="renewal-card renewal-prepared-card${expanded ? ' is-open' : ''}${checked ? ' is-selected' : ''}" data-renewal-job="${escapeHtml(job.jobId)}"><div class="renewal-card-summary"><label class="renewal-pick"><input type="checkbox" data-renewal-job-select="${escapeHtml(job.jobId)}" ${checked ? 'checked' : ''}><span></span></label><button class="renewal-card-main" type="button" data-renewal-expand="prepare:${escapeHtml(job.jobId)}" aria-expanded="${expanded}"><span class="renewal-job-thumb">02</span><span class="renewal-card-copy"><strong>${escapeHtml(draft.form.name || job.title)}</strong><small>${escapeHtml(job.mode)} · ${draft.images.length} image(s) · Etsy ${escapeHtml(job.listingId)}</small></span><span class="renewal-card-count">Préparation</span><span class="renewal-card-chevron">⌄</span></button>${renderDeleteButton(job)}</div>
      ${expanded ? `<div class="renewal-card-body"><div class="renewal-form-grid compact"><label><span>Nom</span><input data-renewal-job-field="name" value="${escapeHtml(draft.form.name)}"></label><label><span>Univers</span><input data-renewal-job-field="universe" value="${escapeHtml(draft.form.universe)}"></label><label><span>Sculpteur</span><input data-renewal-job-field="sculptor" value="${escapeHtml(draft.form.sculptor)}"></label></div>${renderScalePreparation(job, draft)}</div>` : ''}</article>`;
  }

  function renderPreparationStage(jobs) {
    const prepared = jobs.filter((job) => job.state === 'prepared');
    return `${prepared.map(renderPreparedCard).join('') || '<div class="renewal-empty">Les fiches sélectionnées apparaîtront ici pour régler leurs échelles et leurs prix.</div>'}<div class="renewal-stage-action"><div><strong>${state.selectedJobs.size} préparation(s) retenue(s)</strong><span>Enregistre les réglages et lance directement leur génération.</span></div><button class="ds-button ds-button-primary" type="button" data-renewal-generate-selected ${state.selectedJobs.size ? '' : 'disabled'}>Générer la sélection</button></div>`;
  }

  function renderGenerationCard(job) {
    return `<article class="renewal-job is-${escapeHtml(job.state)}" data-renewal-job="${escapeHtml(job.jobId)}"><div class="renewal-job-status"></div><div class="renewal-job-copy"><strong>${escapeHtml(job.form?.name || job.title)}</strong><span>${escapeHtml(job.mode)} · Etsy ${escapeHtml(job.listingId)}</span>${job.error ? `<small>${escapeHtml(job.error)}</small>` : ''}</div><span class="renewal-state">${escapeHtml(stateLabel(job.state))}</span><div class="renewal-job-actions">${job.state === 'failed' ? `<button class="ds-button ds-button-secondary ds-button-small" type="button" data-renewal-retry="${escapeHtml(job.jobId)}">Relancer</button>` : ''}${renderDeleteButton(job)}</div></article>`;
  }

  function parseTitles(raw) {
    return String(raw || '').split('\n').map((line) => line.trim()).filter((line) => /^\d+\.\s+/.test(line)).map((line) => line.replace(/^\d+\.\s*/, '').replace(/\s*[-–—]?\s*\(?\d+\s*car(?:\.|act[eè]res?)?\)?\.?\s*$/i, '').trim());
  }

  function parseChoices(raw, prefix) {
    return String(raw || '').split('\n').map((line) => line.trim()).map((line) => {
      const match = line.match(new RegExp(`^${prefix}(\\d+)\\s*[→:]\\s*(.+)`));
      return match ? { num: match[1], text: match[2].trim() } : null;
    }).filter(Boolean);
  }

  function buildRenewalFinalDescription(job, dynamicDescription) {
    const assembly = global.PipelineUIDescriptionAssembly || {};
    const templates = global.PipelineUIDataDescriptionTemplates || {};
    const prefix = job.mode === 'tabletop' ? 'tt' : 'col';
    const family = job.shopKey === 'doublex'
      ? (prefix === 'tt' ? 'tabletop_doublex' : 'collection_doublex')
      : (prefix === 'tt' ? 'tabletop' : 'collection');
    const echelles = (job.form?.scales || []).map((scale) => String(scale.label || '').trim()).filter(Boolean).join(', ');
    const dynamic = assembly.stripLeadingDescriptionHeading?.(dynamicDescription) || String(dynamicDescription || '').trim();
    if (!dynamic) return '';
    const introBlocks = family === 'collection'
      ? [assembly.buildWhatYouReceiveBlock?.({ echelles }) || '']
      : [...(templates.INTRO_FIXED_BLOCKS_BY_FAMILY_AND_LANGUAGE?.[family]?.fr || [])];
    const fixedBlocks = family === 'collection'
      ? [String(templates.EXPERIENCE_BLOCK || '').trim(), ...(templates.CLIENT_INFORMATION_BLOCKS || [])]
      : [...(templates.FIXED_BLOCKS_BY_FAMILY_AND_LANGUAGE?.[family]?.fr || [])];
    const blocks = [...introBlocks, dynamic, ...fixedBlocks].filter(Boolean);
    return assembly.joinTopLevelBlocks?.(blocks) || blocks.join('\n\n\n\n');
  }

  const parseFinalTags = (value = '') => String(value || '').split(/\r?\n|,/).map((tag) => tag.trim()).filter(Boolean);

  function getReviewDraft(job) {
    if (!state.reviewDrafts.has(job.jobId)) {
      const titles = parseTitles(job.outputs?.titre); const tags = global.PipelineUIHelpers?.parseTagOutput?.(job.outputs?.tags_raw || '') || []; const existing = job.review || {};
      const listing = state.catalog.find((item) => String(item.listingId) === String(job.listingId));
      const currentCommonTags = global.PipelineUIDataTagsCommon?.resolveCommonProductTags?.(job.mode, job.shopKey) || [];
      const defaultCommonTags = [...new Set([...(job.outputs?.commonTags || []), ...currentCommonTags].map(String))].sort((a, b) => a.localeCompare(b, 'fr'));
      const defaultCommonSet = new Set(defaultCommonTags);
      const defaultGeneratedTags = [...new Set(tags.map(String))].filter((tag) => !defaultCommonSet.has(tag)).sort((a, b) => a.localeCompare(b, 'fr'));
      const storedGroups = existing.tagGroups || {};
      const hasCurrentMediaWorkspace = Number(existing.mediaWorkspaceVersion || 0) >= 2 && Array.isArray(existing.images);
      const completeEtsyImages = Array.isArray(listing?.images) && listing.images.length ? listing.images : job.images;
      const initialImages = clone(hasCurrentMediaWorkspace ? existing.images : completeEtsyImages);
      const rawDescription = existing.rawDescription || job.outputs?.description || '';
      const selectedAccroche = existing.accroche || ''; const selectedCta = existing.cta || '';
      const migratedDescription = Number(existing.descriptionAssemblyVersion || 0) >= 1
        ? String(existing.description || '')
        : buildRenewalFinalDescription(job, assembleDescription(rawDescription, selectedAccroche, selectedCta));
      state.reviewDrafts.set(job.jobId, {
        title: existing.title || titles[0] || '',
        selectedTags: new Set(String(existing.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean)),
        commonTags: clone([...new Set([...(Array.isArray(storedGroups.commonTags) ? storedGroups.commonTags : defaultCommonTags), ...currentCommonTags].map(String))].sort((a, b) => a.localeCompare(b, 'fr'))),
        generatedTags: clone(Array.isArray(storedGroups.generatedTags) ? storedGroups.generatedTags : defaultGeneratedTags),
        rawDescription, accroche: selectedAccroche, cta: selectedCta, alt: existing.alt || job.outputs?.alt || '',
        finalDescription: migratedDescription,
        finalTagsText: String(existing.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).join('\n'),
        images: initialImages, candidates: { titles, tags },
      });
    }
    return state.reviewDrafts.get(job.jobId);
  }

  function buildReviewPayload(job, draft) {
    const dynamicDescription = assembleDescription(draft.rawDescription, draft.accroche, draft.cta);
    const assembledDescription = buildRenewalFinalDescription(job, dynamicDescription);
    const finalDescription = job.state === 'ready_to_publish' && String(draft.finalDescription || '').trim()
      ? String(draft.finalDescription).trim()
      : assembledDescription;
    const finalTags = job.state === 'ready_to_publish' ? parseFinalTags(draft.finalTagsText) : [...draft.selectedTags];
    return {
      title: draft.title.trim(), tags: finalTags.join(', '), rawDescription: draft.rawDescription,
      description: finalDescription, accroche: draft.accroche,
      cta: draft.cta, alt: draft.alt.trim(), images: clone(draft.images),
      descriptionAssemblyVersion: 1,
      mediaWorkspaceVersion: 2,
      tagGroups: { commonTags: clone(draft.commonTags), generatedTags: clone(draft.generatedTags) },
    };
  }

  async function persistReviewDraft(jobId) {
    const timer = state.reviewAutosaveTimers.get(jobId); if (timer) clearTimeout(timer);
    state.reviewAutosaveTimers.delete(jobId);
    const job = state.jobs.find((item) => item.jobId === jobId); if (!job) return;
    const review = buildReviewPayload(job, getReviewDraft(job));
    await fetchJson('/renewal-workshop/review', { method: 'POST', body: JSON.stringify({ jobId, review }) });
    job.review = review;
  }

  function scheduleReviewAutosave(jobId, delay = 350) {
    const previous = state.reviewAutosaveTimers.get(jobId); if (previous) clearTimeout(previous);
    state.reviewAutosaveTimers.set(jobId, global.setTimeout(() => {
      persistReviewDraft(jobId).catch((error) => global.showToast?.(`Sauvegarde automatique impossible : ${error.message}`, '#ff6376', 5000));
    }, delay));
  }

  async function persistJobForm(jobId) {
    const timer = state.formAutosaveTimers.get(jobId); if (timer) clearTimeout(timer);
    state.formAutosaveTimers.delete(jobId);
    const job = state.jobs.find((item) => item.jobId === jobId); const draft = job ? getJobDraft(job) : null;
    if (!job || !draft) return;
    const payload = await fetchJson('/renewal-workshop/form', { method: 'POST', body: JSON.stringify({ jobId, form: draft.form }) });
    job.form = clone(payload.form || draft.form);
  }

  function scheduleFormAutosave(jobId, delay = 350) {
    const previous = state.formAutosaveTimers.get(jobId); if (previous) clearTimeout(previous);
    state.formAutosaveTimers.set(jobId, global.setTimeout(() => {
      persistJobForm(jobId).catch((error) => global.showToast?.(`Sauvegarde du pricing impossible : ${error.message}`, '#ff6376', 5000));
    }, delay));
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Lecture impossible : ${file.name || 'image'}`)); reader.readAsDataURL(file);
    });
  }

  async function addReviewImageFiles(jobId, files) {
    const job = state.jobs.find((item) => item.jobId === jobId); if (!job) return;
    const images = files.filter((file) => file?.type?.startsWith('image/')); if (!images.length) return;
    const draft = getReviewDraft(job); state.status = `Ajout de ${images.length} image(s) dans ${job.form?.name || job.title}…`; render();
    try {
      for (const file of images) {
        const payload = await fetchJson('/renewal-workshop/media', { method: 'POST', body: JSON.stringify({ jobId, name: file.name, mediaType: file.type, dataUrl: await readFileAsDataUrl(file) }) });
        draft.images.push({ id: payload.id, name: payload.name, url: payload.url, thumbnailUrl: payload.url, isLocal: true });
      }
      await persistReviewDraft(jobId); state.status = `${images.length} image(s) ajoutée(s).`;
    } catch (error) { state.status = `Ajout impossible : ${error.message}`; global.showToast?.(state.status, '#ff6376', 5000); }
    render();
  }

  function assembleDescription(raw, accroche, cta) {
    const result = []; let aDone = false; let cDone = false;
    String(raw || '').split('\n').forEach((line) => {
      if (/^A\d+\s*[→:]/.test(line.trim())) { if (!aDone && accroche) result.push(accroche); aDone = true; return; }
      if (/^C\d+\s*[→:]/.test(line.trim())) { if (!cDone && cta) result.push(cta); cDone = true; return; }
      result.push(line);
    });
    return result.join('\n').trim();
  }

  function getReviewImagePool(job, draft) {
    const listing = state.catalog.find((item) => String(item.listingId) === String(job.listingId));
    const pool = [...(listing?.images || []), ...(job.images || []), ...(draft.images || [])]; const unique = new Map();
    pool.forEach((image, index) => { const key = imageKey(image, index); if (!unique.has(key)) unique.set(key, image); });
    return unique;
  }

  function renderReviewImages(job, draft) {
    const icon = (name, fallback) => global.PipelineUIIcons?.renderIcon?.(name) || fallback;
    const card = (image, index) => {
      const key = imageKey(image, index);
      return `<article class="renewal-review-image is-selected" data-renewal-review-image-card="${escapeHtml(key)}" data-image-key="${escapeHtml(key)}"><div class="renewal-review-image-visual"><img src="${escapeHtml(image.thumbnailUrl || image.url)}" alt="Image ${index + 1}" draggable="false"><span>Position ${index + 1}</span></div><button class="renewal-media-action is-remove" type="button" data-renewal-image-remove="${escapeHtml(key)}" aria-label="Retirer cette image" title="Retirer cette image">${icon('trash', '×')}</button></article>`;
    };
    return `<section class="renewal-review-section"><div class="renewal-review-heading"><span>01</span><div><strong>Images Etsy</strong><small>${draft.images.length} image(s) · ordre d’origine au chargement, glisser-déposer libre ensuite.</small></div></div><div class="renewal-review-images is-selected-grid${draft.images.length ? '' : ' is-empty'}" data-renewal-image-sort="${escapeHtml(job.jobId)}" data-renewal-image-drop="${escapeHtml(job.jobId)}">${draft.images.map(card).join('') || '<div class="renewal-media-drop-placeholder"><strong>Dépose tes images ici</strong><span>Les fichiers seront ajoutés dans leur ordre de dépôt.</span></div>'}</div><p class="renewal-image-help">Dépose de nouvelles images directement dans cette zone. Utilise la corbeille pour retirer et glisse les vignettes pour les réordonner.</p></section>`;
  }

  function renderTagGroup(groupKey, title, subtitle, tags, draft) {
    return `<div class="renewal-tag-group"><div class="renewal-tag-group-heading"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></div><div class="renewal-tag-grid">${tags.map((tag, index) => `<div class="renewal-tag-choice${draft.selectedTags.has(tag) ? ' is-selected' : ''}"><input type="checkbox" data-renewal-review-tag value="${escapeHtml(tag)}" ${draft.selectedTags.has(tag) ? 'checked' : ''}><input class="renewal-tag-edit" data-renewal-tag-edit data-tag-group="${groupKey}" data-tag-index="${index}" data-tag-original="${escapeHtml(tag)}" value="${escapeHtml(tag)}" maxlength="30" aria-label="Modifier le tag ${escapeHtml(tag)}"><small data-renewal-tag-length>${tag.length}</small></div>`).join('') || '<p class="renewal-tag-empty">Aucun tag dans ce groupe.</p>'}</div></div>`;
  }

  function renderReviewCard(job) {
    const draft = getReviewDraft(job); const expanded = state.expandedId === `review:${job.jobId}`; const accroches = parseChoices(job.outputs?.description, 'A'); const ctas = parseChoices(job.outputs?.description, 'C');
    return `<article class="renewal-card renewal-review-card${expanded ? ' is-open' : ''}" data-renewal-job="${escapeHtml(job.jobId)}"><div class="renewal-card-summary"><span class="renewal-step-dot">04</span><button class="renewal-card-main" type="button" data-renewal-expand="review:${escapeHtml(job.jobId)}"><span class="renewal-job-thumb">04</span><span class="renewal-card-copy"><strong>${escapeHtml(job.form?.name || job.title)}</strong><small>${escapeHtml(job.mode)} · Etsy ${escapeHtml(job.listingId)}</small></span><span class="renewal-card-count">Choix requis</span><span class="renewal-card-chevron">⌄</span></button>${renderDeleteButton(job)}</div>
      ${expanded ? `<div class="renewal-card-body renewal-review-body">
        ${renderReviewImages(job, draft)}
        <section class="renewal-review-section"><div class="renewal-review-heading"><span>02</span><div><strong>Titre</strong><small>Choisis un candidat ou modifie-le librement.</small></div></div><div class="renewal-choice-list">${draft.candidates.titles.map((title) => `<label class="renewal-choice"><input type="radio" name="renewal-title-${escapeHtml(job.jobId)}" data-renewal-review-title value="${escapeHtml(title)}" ${draft.title === title ? 'checked' : ''}><span>${escapeHtml(title)}</span><small>${title.length}/140</small></label>`).join('')}</div><input class="renewal-review-edit" data-renewal-review-field="title" value="${escapeHtml(draft.title)}" maxlength="140"></section>
        <section class="renewal-review-section"><div class="renewal-review-heading"><span>03</span><div><strong>Tags</strong><small>${draft.selectedTags.size}/13 sélectionnés · groupes séparés et classés.</small></div></div>${renderTagGroup('commonTags', 'Tags métier', 'Socle commun du produit', draft.commonTags, draft)}${renderTagGroup('generatedTags', 'Tags générés', 'Candidats proposés par l’agent', draft.generatedTags, draft)}<div class="renewal-tag-footer"><strong>${draft.selectedTags.size}/13 sélectionnés</strong><span>Les modifications et les choix sont sauvegardés automatiquement.</span></div></section>
        <section class="renewal-review-section"><div class="renewal-review-heading"><span>04</span><div><strong>Description</strong><small>Choisis l’accroche et le CTA, puis ajuste la rédaction si nécessaire.</small></div></div>${accroches.length ? `<div class="renewal-choice-group"><strong>Accroche</strong>${accroches.map((choice) => `<label><input type="radio" name="renewal-a-${escapeHtml(job.jobId)}" data-renewal-review-choice="accroche" value="${escapeHtml(choice.text)}" ${draft.accroche === choice.text ? 'checked' : ''}>${escapeHtml(choice.text)}</label>`).join('')}</div>` : ''}${ctas.length ? `<div class="renewal-choice-group"><strong>CTA</strong>${ctas.map((choice) => `<label><input type="radio" name="renewal-c-${escapeHtml(job.jobId)}" data-renewal-review-choice="cta" value="${escapeHtml(choice.text)}" ${draft.cta === choice.text ? 'checked' : ''}>${escapeHtml(choice.text)}</label>`).join('')}</div>` : ''}<textarea class="renewal-review-description" data-renewal-review-field="rawDescription" rows="18">${escapeHtml(draft.rawDescription)}</textarea></section>
        <section class="renewal-review-section"><div class="renewal-review-heading"><span>05</span><div><strong>Balises ALT</strong><small>Sortie modifiable jusqu’à la validation des choix.</small></div></div><textarea data-renewal-review-field="alt" rows="6">${escapeHtml(draft.alt)}</textarea></section>
        <div class="renewal-review-actions"><button class="ds-button ds-button-primary" type="button" data-renewal-save-review="${escapeHtml(job.jobId)}">Valider les choix</button></div>
      </div>` : ''}</article>`;
  }

  function renderCompletedImages(images = []) {
    return `<div class="renewal-review-images is-selected-grid">${images.map((image, index) => `<article class="renewal-review-image is-readonly"><div class="renewal-review-image-visual"><img src="${escapeHtml(image.thumbnailUrl || image.url)}" alt="Image ${index + 1}" draggable="false"><span>Position ${index + 1}</span></div></article>`).join('') || '<p>Aucune image enregistrée.</p>'}</div>`;
  }

  function renderCompletedCard(job) {
    const expanded = state.expandedId === `completed:${job.jobId}`; const review = job.review || {};
    const published = job.state === 'published';
    const draft = published ? null : getReviewDraft(job);
    const publishing = state.publishingJobs.has(job.jobId);
    const publicationDebug = state.publicationDebug.get(job.jobId) || null;
    const tags = String(review.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
    return `<article class="renewal-card renewal-completed-card${expanded ? ' is-open' : ''}" data-renewal-job="${escapeHtml(job.jobId)}"><div class="renewal-card-summary"><span class="renewal-step-dot">✓</span><button class="renewal-card-main" type="button" data-renewal-expand="completed:${escapeHtml(job.jobId)}"><span class="renewal-job-thumb">✓</span><span class="renewal-card-copy"><strong>${escapeHtml(job.form?.name || job.title)}</strong><small>${escapeHtml(job.mode)} · Etsy ${escapeHtml(job.listingId)}</small></span><span class="renewal-card-count">${published ? 'Réactivée sur Etsy' : 'À publier'}</span><span class="renewal-card-chevron">⌄</span></button>${publishing ? '' : renderDeleteButton(job)}</div>
      ${expanded ? `<div class="renewal-card-body renewal-review-body">
        ${publishing ? '<div class="renewal-publication-progress"><strong>Publication Etsy en cours…</strong><span>La fiche source est chargée, comparée puis mise à jour. Ne reclique pas sur le bouton.</span></div>' : ''}
        ${published ? `<section class="renewal-review-section"><div class="renewal-review-heading"><span>01</span><div><strong>Images publiées</strong><small>${(review.images || []).length} image(s) conservée(s) dans le dossier.</small></div></div>${renderCompletedImages(review.images || [])}</section>` : renderReviewImages(job, draft)}
        ${renderPricingSummary(job, '02', !published)}
        <section class="renewal-review-section"><div class="renewal-review-heading"><span>03</span><div><strong>Titre</strong><small>${published ? 'Valeur publiée et conservée dans le dossier.' : 'Dernière modification possible avant Etsy.'}</small></div></div>${published ? `<textarea readonly rows="3">${escapeHtml(review.title || '')}</textarea>` : `<input class="renewal-review-edit" data-renewal-review-field="title" value="${escapeHtml(draft.title)}" maxlength="140">`}</section>
        <section class="renewal-review-section"><div class="renewal-review-heading"><span>04</span><div><strong>Tags finaux</strong><small>${published ? `${tags.length} tag(s) publié(s).` : 'Un tag par ligne, 13 maximum et 30 caractères par tag.'}</small></div></div>${published ? `<div class="renewal-completed-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('') || '<span>Aucun tag enregistré.</span>'}</div>` : `<textarea data-renewal-final-tags rows="15">${escapeHtml(draft.finalTagsText)}</textarea><div class="renewal-tag-footer"><strong>${parseFinalTags(draft.finalTagsText).length}/13 tags</strong><span>Édition finale avant Etsy.</span></div>`}</section>
        <section class="renewal-review-section"><div class="renewal-review-heading"><span>05</span><div><strong>Description Etsy complète</strong><small>${published ? 'Texte final publié.' : 'Blocs fixes assemblés ; mise en page et contenu restent entièrement éditables avant publication.'}</small></div></div><textarea ${published ? 'readonly' : 'data-renewal-review-field="finalDescription"'} rows="24">${escapeHtml(published ? (review.description || review.rawDescription || '') : draft.finalDescription)}</textarea></section>
        <section class="renewal-review-section"><div class="renewal-review-heading"><span>06</span><div><strong>Balises ALT</strong><small>${published ? 'Sortie finale conservée.' : 'Dernière modification possible avant Etsy.'}</small></div></div><textarea ${published ? 'readonly' : 'data-renewal-review-field="alt"'} rows="6">${escapeHtml(published ? (review.alt || '') : draft.alt)}</textarea></section>
        ${published ? '' : `<div class="renewal-review-actions"><button class="ds-button ds-button-primary" type="button" data-renewal-publish="${escapeHtml(job.jobId)}" ${publishing ? 'disabled' : ''}>${publishing ? 'Publication Etsy en cours…' : 'Mettre à jour et réactiver la fiche sur Etsy'}</button></div>`}
        ${publicationDebug ? `<details class="renewal-publication-debug" open><summary>Diagnostic de la dernière tentative Etsy</summary><pre>${escapeHtml(JSON.stringify(publicationDebug, null, 2))}</pre><button class="ds-button ds-button-secondary" type="button" data-renewal-copy-debug="${escapeHtml(job.jobId)}">Copier le diagnostic</button></details>` : ''}
      </div>` : ''}</article>`;
  }

  function initializeReviewSortables() {
    if (typeof global.Sortable?.create !== 'function') return;
    host()?.querySelectorAll('[data-renewal-image-sort]').forEach((grid) => {
      global.Sortable.create(grid, {
        animation: 180, draggable: '.renewal-review-image[data-image-key]', filter: '.renewal-media-action',
        ghostClass: 'renewal-sort-ghost', chosenClass: 'renewal-sort-chosen',
        onEnd() {
          const jobId = grid.dataset.renewalImageSort; const job = state.jobs.find((item) => item.jobId === jobId); if (!job) return;
          const draft = getReviewDraft(job); const pool = getReviewImagePool(job, draft);
          draft.images = [...grid.querySelectorAll('.renewal-review-image[data-image-key]')].map((card) => pool.get(card.dataset.imageKey)).filter(Boolean);
          scheduleReviewAutosave(jobId, 50); render();
        },
      });
    });
  }

  function render() {
    if (!host()) return;
    const jobs = state.jobs.filter((job) => job.shopKey === shopKey()); let content = '';
    if (state.tab === 'select') content = renderSelectionStage();
    if (state.tab === 'prepare') content = renderPreparationStage(jobs);
    if (state.tab === 'generate') content = jobs.filter((job) => ['queued', 'running', 'failed'].includes(job.state)).map(renderGenerationCard).join('') || '<div class="renewal-empty">Aucune génération en cours. Prépare une fiche à l’étage précédent.</div>';
    if (state.tab === 'review') content = jobs.filter((job) => job.state === 'review_ready').map(renderReviewCard).join('') || '<div class="renewal-empty">Aucune fiche à valider. Les fiches dont les choix sont confirmés passent dans l’onglet Terminées.</div>';
    if (state.tab === 'completed') content = jobs.filter((job) => ['ready_to_publish', 'published'].includes(job.state)).map(renderCompletedCard).join('') || '<div class="renewal-empty">Les fiches validées apparaîtront ici pour finaliser leur pricing puis mettre à jour Etsy.</div>';
    host().innerHTML = `<section class="renewal-shell">${renderHero()}${renderMetrics()}${renderTabs()}<p class="renewal-status" aria-live="polite">${escapeHtml(state.status || 'Aucune opération en cours.')}</p><div class="renewal-list">${content}</div></section>`;
    initializeReviewSortables();
  }

  async function loadJobs() {
    const payload = await fetchJson(contextUrl('/renewal-workshop/jobs')); state.jobs = payload.jobs || []; state.counts = payload.counts || {};
    state.selectedJobs.forEach((id) => { if (!state.jobs.some((job) => job.jobId === id && job.state === 'prepared')) state.selectedJobs.delete(id); });
  }

  async function refreshCatalog() {
    if (state.auditing) return;
    state.auditing = true; state.status = 'Audit frais des fiches expirées…'; render();
    try { const payload = await fetchJson(contextUrl('/renewal-workshop/catalog?refresh=1')); state.catalog = payload.listings || []; state.drafts.clear(); state.selectedListings.clear(); state.selectedImages.clear(); state.status = `${state.catalog.length} fiche(s) expirée(s) chargée(s).`; await loadJobs(); }
    catch (error) { state.status = `Audit impossible : ${error.message}`; global.showToast?.(state.status, '#ff6376', 5000); }
    finally { state.auditing = false; render(); }
  }

  function buildPreparationPayload(listing) {
    const id = String(listing.listingId); const draft = getCatalogDraft(listing); const selected = state.selectedImages.get(id) || new Set();
    return { shopKey: shopKey(), listingId: id, title: listing.title || '', mode: draft.mode, images: (listing.images || []).filter((image, index) => selected.has(String(image.id || index))), form: clone(draft) };
  }

  async function prepareSelected() {
    const ids = [...state.selectedListings]; if (!ids.length) return;
    try {
      for (const id of ids) {
        const listing = state.catalog.find((item) => String(item.listingId) === id); if (!listing) continue;
        const payload = buildPreparationPayload(listing);
        if (!payload.images.length) throw new Error(`${payload.form.name || listing.title} : sélectionne au moins une image.`);
        if (!String(payload.form.name || '').trim()) throw new Error(`${listing.title} : le nom validé est requis.`);
        const job = await fetchJson('/renewal-workshop/prepare', { method: 'POST', body: JSON.stringify(payload) }); state.selectedJobs.add(job.jobId);
      }
      state.selectedListings.clear(); await loadJobs(); state.tab = 'prepare'; state.expandedId = `prepare:${[...state.selectedJobs].at(-1)}`; state.status = `${ids.length} fiche(s) envoyée(s) en préparation.`;
    } catch (error) { state.status = error.message; global.showToast?.(error.message, '#ff6376', 5000); }
    render();
  }

  function calculateCost(jobId) {
    const job = state.jobs.find((item) => item.jobId === jobId); if (!job) return;
    const calc = getJobDraft(job).form.pricing.calculator; const read = (value) => Number(String(value ?? '').replace(',', '.'));
    const cost = read(calc.resinCost); const support = read(calc.supportVariable); const multiplier = read(calc.finalMultiplier); const plates = read(calc.plates); const tax = read(calc.tax);
    if (![cost, support, multiplier, plates, tax].every(Number.isFinite) || support <= 0 || tax <= 0) { global.showToast?.('Complète les valeurs du calculateur.', '#e8c547'); return; }
    calc.total = ((cost * support * multiplier) + Math.max(0, plates - 1) * 5) / tax; scheduleFormAutosave(jobId, 50); render();
  }

  function transferCostToOrigin(jobId) {
    const job = state.jobs.find((item) => item.jobId === jobId); if (!job) return;
    const draft = getJobDraft(job); const origin = draft.form.scales.find((entry) => entry.isOrigin) || draft.form.scales[0]; const total = Number(draft.form.pricing.calculator.total || 0);
    if (!origin || !(total > 0)) { global.showToast?.('Sélectionne une échelle d’origine et calcule un prix.', '#e8c547'); return; }
    draft.form.pricing.rows[origin.key] = { ...(draft.form.pricing.rows[origin.key] || {}), priceFr: total.toFixed(2), compensation: draft.form.pricing.rows[origin.key]?.compensation || '0', source: 'manual' }; scheduleFormAutosave(jobId, 50); render();
  }

  function calculateGrid(jobId) {
    const job = state.jobs.find((item) => item.jobId === jobId); if (!job) return;
    const draft = getJobDraft(job); const result = global.PipelinePricingGridAssistant?.calculate?.({ entries: draft.form.scales, rows: draft.form.pricing.rows, scope: { shop: job.shopKey, mode: job.mode }, useReferences: draft.form.pricing.gridAssistant.useReferences !== false });
    if (result?.error) { global.showToast?.(result.error, '#e8c547', 4500); return; }
    Object.entries(result?.updates || {}).forEach(([key, update]) => { draft.form.pricing.rows[key] = { ...(draft.form.pricing.rows[key] || {}), ...update, compensation: draft.form.pricing.rows[key]?.compensation || '0' }; });
    state.status = `${result?.calculatedCount || 0} prix calculé(s).`; scheduleFormAutosave(jobId, 50); render();
  }

  async function queueSelectedAndRun() {
    const ids = [...state.selectedJobs]; if (!ids.length) return;
    try {
      for (const id of ids) {
        const original = state.jobs.find((job) => job.jobId === id && job.state === 'prepared'); if (!original) continue;
        const draft = getJobDraft(original); const saved = await fetchJson('/renewal-workshop/prepare', { method: 'POST', body: JSON.stringify({ shopKey: draft.shopKey, listingId: draft.listingId, title: draft.title, mode: draft.mode, images: draft.images, form: draft.form }) });
        await fetchJson('/renewal-workshop/action', { method: 'POST', body: JSON.stringify({ jobId: saved.jobId, action: 'queue' }) });
      }
      state.selectedJobs.clear(); await loadJobs(); state.tab = 'generate'; await runQueue();
    } catch (error) { state.status = `Génération impossible : ${error.message}`; global.showToast?.(state.status, '#ff6376', 5000); render(); }
  }

  function mapStoredScales(form) {
    const normalize = global.PipelineUIListingRelaunchData?.normalizeScaleLabel || ((value) => String(value || '').replace(/\s+/g, '').toLowerCase());
    return new Map((form.scales || []).map((item) => [normalize(item.label), { label: item.label, dimensions: item.dimension || item.dimensions || '' }]));
  }

  async function hydrateJob(job, imagesOverride = null, { syncImages = true } = {}) {
    global.setActiveShop?.(job.shopKey); if (global.currentMode !== job.mode) global.switchMode?.(job.mode);
    const prefix = job.mode === 'tabletop' ? 'tt' : 'col';
    global.applyListingPrefillToForm?.(prefix, { fullName: job.form.name, shortName: job.form.shortName || job.form.name, universe: job.form.universe, sculptor: job.form.sculptor, pieces: job.form.pieces, instructions: job.form.instructions, scales: mapStoredScales(job.form), originHeight: job.form.originHeight });
    const origin = (job.form.scales || []).find((entry) => entry.isOrigin);
    if (origin) {
      const labels = getScaleLabels(job.mode);
      const originIndex = labels.findIndex((label) => String(label).replace(/\s+/g, '').toLowerCase() === String(origin.label).replace(/\s+/g, '').toLowerCase());
      if (originIndex >= 0) global.PipelineUIEchelles?.setEchelleOrigin?.(originIndex, { shouldSave: false, recalculate: false });
    }
    global.PipelineUIPricing?.restore?.(prefix, job.form.pricing || null);
    if (syncImages) await global.PipelineUIListingRelaunch?.syncPipelineImagesFromUrls?.(prefix, Array.isArray(imagesOverride) ? imagesOverride : job.images);
    return prefix;
  }

  async function buildRenewalPublicationImages(images, alt) {
    const result = [];
    for (const [index, image] of images.entries()) {
      const url = String(image?.url || '').trim();
      const entry = {
        order: index + 1,
        filename: String(image?.name || `renewal-image-${index + 1}.jpg`),
        alt_text: String(alt || '').trim(),
      };
      if (url.startsWith('/etsy/media-cache/')) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Image locale ${index + 1} inaccessible`);
        result.push({ ...entry, mode: 'upload', data_url: await readFileAsDataUrl(await response.blob()) });
      } else if (url.startsWith('https://')) {
        result.push({ ...entry, mode: 'upload_remote', remote_url: url });
      } else {
        throw new Error(`URL de l’image ${index + 1} invalide`);
      }
    }
    return result;
  }

  async function processJob(job) {
    const originalShop = shopKey(); const originalMode = global.currentMode;
    try {
      const prefix = await hydrateJob(job); global.state.renewalWorkshopRun = { active: true, jobId: job.jobId };
      const profile = global.PipelineUIAIProfiles?.snapshotActiveProfile?.(); await global.loadAllFiles?.(true, { profile }); global.resetPipelineRunState?.(prefix);
      ['titre', 'titre_valide', 'tags', 'tags_raw', 'description', 'description_assembled', 'alt'].forEach((key) => { global.state.outputs[key] = ''; });
      const agents = (global.getPipelineAgents?.() || []).filter((agent) => ['titre', 'tags', 'description', 'alt'].includes(agent.id));
      for (const agent of agents) { if (state.deletedJobs.has(job.jobId)) return; state.status = `${job.form.name} · ${agent.title}`; render(); const ok = await global.runAgent?.(agent, '', { candidateFlow: true, aiProfileSnapshot: profile }); if (!ok) throw new Error(`Échec de l’agent ${agent.id}`); }
      if (state.deletedJobs.has(job.jobId)) return;
      const outputs = { titre: String(global.state.outputs.titre || ''), tags_raw: String(global.state.outputs.tags_raw || ''), description: String(global.state.outputs.description || ''), alt: String(global.state.outputs.alt || ''), commonTags: global.PipelineUISelections?.getCommonProductTags?.() || [], cumulative: String(global.state.pipelineRun?.[prefix]?.cumulativeText || '') };
      await fetchJson('/renewal-workshop/complete', { method: 'POST', body: JSON.stringify({ jobId: job.jobId, outputs, usage: {} }) });
    } catch (error) { if (!state.deletedJobs.has(job.jobId)) await fetchJson('/renewal-workshop/fail', { method: 'POST', body: JSON.stringify({ jobId: job.jobId, error: error.message }) }).catch(() => {}); }
    finally { global.state.renewalWorkshopRun = null; if (originalShop !== shopKey()) global.setActiveShop?.(originalShop); if (originalMode && originalMode !== global.currentMode) global.switchMode?.(originalMode); }
  }

  async function runQueue() {
    if (state.processing) return; state.processing = true; state.tab = 'generate'; render();
    try {
      await fetchJson('/renewal-workshop/resume', { method: 'POST', body: '{}' });
      while (true) { const payload = await fetchJson('/renewal-workshop/next'); if (!payload.job) break; await processJob(payload.job); await loadJobs(); render(); }
      state.status = 'File terminée. Les sorties attendent ta validation.'; state.tab = 'review';
    } catch (error) {
      state.status = `File interrompue : ${error.message}`;
      global.showToast?.(state.status, '#ff6376', 5000);
    } finally { state.processing = false; await loadJobs().catch(() => {}); render(); }
  }

  async function saveReview(jobId, { renderAfter = true } = {}) {
    const job = state.jobs.find((item) => item.jobId === jobId); const draft = job ? getReviewDraft(job) : null; if (!job || !draft) return;
    if (!draft.title.trim()) { global.showToast?.('Choisis ou saisis un titre.', '#e8c547'); return; }
    if (!draft.selectedTags.size) { global.showToast?.('Choisis au moins un tag.', '#e8c547'); return; }
    if (draft.selectedTags.size > 13) { global.showToast?.('Treize tags maximum.', '#e8c547'); return; }
    if (!draft.images.length) { global.showToast?.('Conserve au moins une image.', '#e8c547'); return; }
    const accroches = parseChoices(job.outputs?.description, 'A'); const ctas = parseChoices(job.outputs?.description, 'C');
    if (accroches.length && !draft.accroche) { global.showToast?.('Choisis une accroche.', '#e8c547'); return; }
    if (ctas.length && !draft.cta) { global.showToast?.('Choisis un CTA.', '#e8c547'); return; }
    const review = buildReviewPayload(job, draft);
    await fetchJson('/renewal-workshop/review', { method: 'POST', body: JSON.stringify({ jobId, review }) });
    job.review = review; draft.finalDescription = review.description; draft.finalTagsText = [...draft.selectedTags].join('\n');
    if (job.state === 'review_ready') await fetchJson('/renewal-workshop/action', { method: 'POST', body: JSON.stringify({ jobId, action: 'ready_to_publish' }) });
    await loadJobs(); state.status = `${job.form.name} est prête à finaliser son pricing puis à mettre à jour la fiche expirée.`; state.tab = 'completed'; state.expandedId = `completed:${jobId}`; if (renderAfter) render(); return true;
  }

  async function publishJob(jobId) {
    let job = state.jobs.find((item) => item.jobId === jobId); if (!job) return;
    if (job.state === 'review_ready') { const saved = await saveReview(jobId, { renderAfter: false }); if (!saved) return; job = state.jobs.find((item) => item.jobId === jobId); }
    if (job?.state !== 'ready_to_publish' || !job.review?.title) return;
    if (state.publishingJobs.has(jobId)) return;
    state.publishingJobs.add(jobId);
    state.publicationDebug.delete(jobId);
    state.status = `Préparation de la mise à jour Etsy de ${job.form.name}…`;
    render();
    try {
      const draft = getReviewDraft(job); const finalTags = parseFinalTags(draft.finalTagsText);
      const normalizedTags = finalTags.map((tag) => tag.toLocaleLowerCase('fr'));
      if (!draft.title.trim()) throw new Error('Le titre final est vide.');
      if (!draft.images.length) throw new Error('Conserve au moins une image.');
      if (!finalTags.length || finalTags.length > 13) throw new Error('Les tags finaux doivent contenir entre 1 et 13 tags.');
      if (finalTags.some((tag) => tag.length > 30)) throw new Error('Un tag final dépasse 30 caractères.');
      if (new Set(normalizedTags).size !== normalizedTags.length) throw new Error('Les tags finaux contiennent un doublon.');
      if (!String(draft.finalDescription || '').trim()) throw new Error('La description Etsy complète est vide.');
      await persistReviewDraft(jobId);
      await persistJobForm(jobId);
      await loadJobs(); job = state.jobs.find((item) => item.jobId === jobId);
      if (!job?.review?.title) throw new Error('Les choix finaux n’ont pas pu être sauvegardés.');
      const pricesByScale = {};
      for (const scale of job.form.scales || []) {
        const price = Number(getPricingDisplay(job.form.pricing?.rows?.[scale.key] || {}).etsyPlain);
        if (!(price > 0)) throw new Error(`Prix Etsy manquant pour ${scale.label}`);
        pricesByScale[normalizeScale(scale.label)] = price;
      }
      const publicationImages = await buildRenewalPublicationImages(job.review.images || [], job.review.alt);
      state.status = `Publication Etsy de ${job.form.name} en cours…`; render(); const prefix = await hydrateJob(job, null, { syncImages: false });
      global.state.outputs.titre_valide = String(job.review.title || ''); global.state.outputs.tags = String(job.review.tags || ''); global.state.outputs.description_final = String(job.review.description || ''); global.state.outputs.alt = String(job.review.alt || '');
      global.persistPipelineSeedSnapshot?.(prefix);
      const runtime = global.PipelineUIEtsyRuntime || {}; const nodes = runtime.getWorkspaceNodes?.(prefix); if (!nodes?.input) throw new Error('Workspace Etsy indisponible');
      nodes.input.value = job.listingId; await runtime.workspaceLoadEtsyWorkspaceMedia?.(prefix); runtime.workspaceImportPipelineSeedToWorkspace?.(prefix); runtime.setPublicationMode?.(prefix, 'update_expired_listing');
      await runtime.workspacePublishDraftListing?.(prefix, {
        targetShopKey: job.shopKey,
        modeOverride: 'update_expired_listing',
        renewalPayload: {
          listingId: job.listingId,
          title: job.review.title,
          description: job.review.description,
          tags: finalTags,
          images: publicationImages,
          pricesByScale,
        },
      });
      const workspaceState = runtime.getWorkspaceState?.(prefix);
      if (workspaceState?.publicationError) {
        const publicationError = new Error(workspaceState.publicationError);
        publicationError.payload = workspaceState.publicationResult?.payload || null;
        throw publicationError;
      }
      if (!workspaceState?.publicationResult?.ok) throw new Error('Aucune confirmation Etsy reçue.');
      await fetchJson('/renewal-workshop/action', { method: 'POST', body: JSON.stringify({ jobId, action: 'published' }) }).catch(() => {}); state.status = `${job.form.name} a été mise à jour et réactivée sur Etsy.`; await loadJobs(); state.tab = 'completed'; state.expandedId = `completed:${jobId}`; render();
    } catch (error) {
      const debug = error?.payload?.publication_debug
        ? {
          etsyError: error.payload.error || '',
          etsyResponseRaw: error.payload.publication_debug.etsyResponseRaw || '',
          ...error.payload.publication_debug,
        }
        : error?.payload || null;
      if (debug) state.publicationDebug.set(jobId, debug);
      state.status = `Publication impossible : ${error.message}`;
      global.showToast?.(state.status, '#ff6376', 6000);
    } finally {
      state.publishingJobs.delete(jobId);
      render();
    }
  }

  async function deleteJob(jobId) {
    const job = state.jobs.find((item) => item.jobId === jobId); if (!job) return;
    if (!global.confirm(`Supprimer « ${job.form?.name || job.title} » de l’atelier ?\n\nLa fiche Etsy ne sera pas touchée.`)) return;
    state.deletedJobs.add(jobId);
    for (const timers of [state.formAutosaveTimers, state.reviewAutosaveTimers]) {
      const timer = timers.get(jobId); if (timer) clearTimeout(timer); timers.delete(jobId);
    }
    try {
      await fetchJson('/renewal-workshop/delete', { method: 'POST', body: JSON.stringify({ jobId }) });
      state.selectedJobs.delete(jobId); state.jobDrafts.delete(jobId); state.reviewDrafts.delete(jobId); state.publicationDebug.delete(jobId);
      if (state.expandedId.endsWith(`:${jobId}`)) state.expandedId = '';
      await loadJobs(); state.status = 'Dossier supprimé de l’atelier. La fiche peut être sélectionnée à nouveau.'; render();
    } catch (error) {
      state.deletedJobs.delete(jobId);
      state.status = `Suppression impossible : ${error.message}`;
      global.showToast?.(state.status, '#ff6376', 5000);
      render();
    }
  }

  async function copyPrice(value) {
    const normalized = String(value || '').replace(',', '.');
    if (!normalized) return;
    await navigator.clipboard.writeText(normalized);
    global.showToast?.(`${normalized} copié`);
  }

  async function open() {
    state.opened = true;
    try { const [catalog] = await Promise.all([fetchJson(contextUrl('/renewal-workshop/catalog')), loadJobs()]); state.catalog = catalog.listings || []; render(); }
    catch (error) { state.status = error.message; render(); }
  }

  host()?.addEventListener('click', async (event) => {
    const tab = event.target.closest('[data-renewal-tab]'); if (tab) { state.tab = tab.dataset.renewalTab; render(); return; }
    if (event.target.closest('[data-renewal-refresh]')) { await refreshCatalog(); return; }
    if (event.target.closest('[data-renewal-start]')) { await runQueue(); return; }
    const expand = event.target.closest('[data-renewal-expand]'); if (expand) { state.expandedId = state.expandedId === expand.dataset.renewalExpand ? '' : expand.dataset.renewalExpand; render(); return; }
    if (event.target.closest('[data-renewal-prepare-selected]')) { await prepareSelected(); return; }
    if (event.target.closest('[data-renewal-generate-selected]')) { await queueSelectedAndRun(); return; }
    const remove = event.target.closest('[data-renewal-delete]'); if (remove) { await deleteJob(remove.dataset.renewalDelete); return; }
    const retry = event.target.closest('[data-renewal-retry]'); if (retry) { await fetchJson('/renewal-workshop/action', { method: 'POST', body: JSON.stringify({ jobId: retry.dataset.renewalRetry, action: 'retry' }) }); await loadJobs(); await runQueue(); return; }
    const calculate = event.target.closest('[data-renewal-calculate-cost]'); if (calculate) { calculateCost(calculate.dataset.renewalCalculateCost); return; }
    const transfer = event.target.closest('[data-renewal-transfer-origin]'); if (transfer) { transferCostToOrigin(transfer.dataset.renewalTransferOrigin); return; }
    const grid = event.target.closest('[data-renewal-calculate-grid]'); if (grid) { calculateGrid(grid.dataset.renewalCalculateGrid); return; }
    const copy = event.target.closest('[data-renewal-copy-price]'); if (copy) { await copyPrice(copy.dataset.renewalCopyPrice); return; }
    const copyDebug = event.target.closest('[data-renewal-copy-debug]');
    if (copyDebug) {
      const debug = state.publicationDebug.get(copyDebug.dataset.renewalCopyDebug);
      if (debug) {
        await navigator.clipboard.writeText(JSON.stringify(debug, null, 2));
        global.showToast?.('Diagnostic Etsy copié');
      }
      return;
    }
    const removeReviewImage = event.target.closest('[data-renewal-image-remove]');
    if (removeReviewImage) {
      const job = state.jobs.find((item) => item.jobId === removeReviewImage.closest('[data-renewal-job]')?.dataset.renewalJob); if (!job) return;
      const draft = getReviewDraft(job); draft.images = draft.images.filter((image) => imageKey(image) !== removeReviewImage.dataset.renewalImageRemove);
      scheduleReviewAutosave(job.jobId, 50); render(); return;
    }
    const saveReviewButton = event.target.closest('[data-renewal-save-review]');
    if (saveReviewButton) {
      try { await saveReview(saveReviewButton.dataset.renewalSaveReview); }
      catch (error) { state.status = `Validation impossible : ${error.message}`; global.showToast?.(state.status, '#ff6376', 6000); render(); }
      return;
    }
    const publish = event.target.closest('[data-renewal-publish]'); if (publish) await publishJob(publish.dataset.renewalPublish);
  });

  host()?.addEventListener('change', (event) => {
    const changedPrice = event.target.closest('[data-renewal-scale-price]');
    if (changedPrice) {
      const job = state.jobs.find((item) => item.jobId === changedPrice.closest('[data-renewal-job]')?.dataset.renewalJob);
      if (job) {
        const draft = getJobDraft(job); const key = changedPrice.dataset.renewalScalePrice;
        const numeric = Number(String(changedPrice.value || '').replace(',', '.'));
        const normalized = Number.isInteger(numeric) && numeric > 0 ? (numeric - 0.01).toFixed(2) : changedPrice.value;
        draft.form.pricing.rows[key] = { ...(draft.form.pricing.rows[key] || {}), priceFr: normalized, source: 'manual' };
        scheduleFormAutosave(job.jobId, 50);
        render();
      }
      return;
    }
    const listingSelect = event.target.closest('[data-renewal-listing-select]');
    if (listingSelect) { if (listingSelect.checked) state.selectedListings.add(listingSelect.dataset.renewalListingSelect); else state.selectedListings.delete(listingSelect.dataset.renewalListingSelect); render(); return; }
    const jobSelect = event.target.closest('[data-renewal-job-select]');
    if (jobSelect) { if (jobSelect.checked) state.selectedJobs.add(jobSelect.dataset.renewalJobSelect); else state.selectedJobs.delete(jobSelect.dataset.renewalJobSelect); render(); return; }
    const image = event.target.closest('[data-renewal-image]');
    if (image) { const id = image.closest('[data-renewal-listing]')?.dataset.renewalListing; const selected = state.selectedImages.get(id) || new Set(); if (image.checked) selected.add(image.dataset.renewalImage); else selected.delete(image.dataset.renewalImage); state.selectedImages.set(id, selected); render(); return; }
    const scaleToggle = event.target.closest('[data-renewal-scale-toggle]');
    if (scaleToggle) { const jobId = scaleToggle.closest('[data-renewal-job]')?.dataset.renewalJob; const job = state.jobs.find((item) => item.jobId === jobId); const draft = job && getJobDraft(job); if (!draft) return; const key = scaleToggle.dataset.renewalScaleToggle; const label = scaleToggle.dataset.scaleLabel; if (scaleToggle.checked) { draft.form.scales.push({ key, label, dimension: '', isOrigin: !draft.form.scales.length, dimensionSource: '' }); recalculateDimensions(draft); } else { draft.form.scales = draft.form.scales.filter((entry) => entry.key !== key); delete draft.form.pricing.rows[key]; if (draft.form.scales.length && !draft.form.scales.some((entry) => entry.isOrigin)) { draft.form.scales[0].isOrigin = true; recalculateDimensions(draft); } } scheduleFormAutosave(jobId, 50); render(); return; }
    const origin = event.target.closest('[data-renewal-scale-origin]');
    if (origin) { const jobId = origin.closest('[data-renewal-job]')?.dataset.renewalJob; const job = state.jobs.find((item) => item.jobId === jobId); const draft = job && getJobDraft(job); if (!draft) return; draft.form.scales.forEach((entry) => { entry.isOrigin = entry.key === origin.dataset.renewalScaleOrigin; }); recalculateDimensions(draft); scheduleFormAutosave(jobId, 50); render(); return; }
    const reviewTagEdit = event.target.closest('[data-renewal-tag-edit]');
    if (reviewTagEdit) {
      const job = state.jobs.find((item) => item.jobId === reviewTagEdit.closest('[data-renewal-job]')?.dataset.renewalJob); if (!job) return;
      const draft = getReviewDraft(job); const group = draft[reviewTagEdit.dataset.tagGroup]; const index = Number(reviewTagEdit.dataset.tagIndex); const previous = group?.[index]; const next = reviewTagEdit.value.trim();
      const allOtherTags = [...(draft.commonTags || []), ...(draft.generatedTags || [])].filter((tag) => tag !== previous);
      if (!next || allOtherTags.some((tag) => tag.toLocaleLowerCase('fr') === next.toLocaleLowerCase('fr'))) {
        reviewTagEdit.value = previous || ''; const length = reviewTagEdit.parentElement?.querySelector('[data-renewal-tag-length]'); if (length) length.textContent = String((previous || '').length);
        global.showToast?.(!next ? 'Un tag ne peut pas être vide.' : 'Ce tag existe déjà.', '#e8c547'); return;
      }
      group[index] = next; reviewTagEdit.value = next; reviewTagEdit.dataset.tagOriginal = next;
      if (draft.selectedTags.has(previous)) { draft.selectedTags.delete(previous); draft.selectedTags.add(next); }
      const checkbox = reviewTagEdit.parentElement?.querySelector('[data-renewal-review-tag]'); if (checkbox) checkbox.value = next;
      scheduleReviewAutosave(job.jobId, 50); render(); return;
    }
    const reviewTitle = event.target.closest('[data-renewal-review-title]');
    if (reviewTitle) { const job = state.jobs.find((item) => item.jobId === reviewTitle.closest('[data-renewal-job]')?.dataset.renewalJob); if (job) { getReviewDraft(job).title = reviewTitle.value; scheduleReviewAutosave(job.jobId, 50); } render(); return; }
    const reviewTag = event.target.closest('[data-renewal-review-tag]');
    if (reviewTag) { const job = state.jobs.find((item) => item.jobId === reviewTag.closest('[data-renewal-job]')?.dataset.renewalJob); if (!job) return; const draft = getReviewDraft(job); if (reviewTag.checked && draft.selectedTags.size >= 13) { reviewTag.checked = false; global.showToast?.('Treize tags maximum.', '#e8c547'); return; } if (reviewTag.checked) draft.selectedTags.add(reviewTag.value); else draft.selectedTags.delete(reviewTag.value); scheduleReviewAutosave(job.jobId, 50); render(); return; }
    const choice = event.target.closest('[data-renewal-review-choice]');
    if (choice) { const job = state.jobs.find((item) => item.jobId === choice.closest('[data-renewal-job]')?.dataset.renewalJob); if (job) { getReviewDraft(job)[choice.dataset.renewalReviewChoice] = choice.value; scheduleReviewAutosave(job.jobId, 50); } render(); }
  });

  host()?.addEventListener('input', (event) => {
    const listingField = event.target.closest('[data-renewal-field]');
    if (listingField) { const id = listingField.closest('[data-renewal-listing]')?.dataset.renewalListing; const listing = state.catalog.find((item) => String(item.listingId) === id); if (listing) getCatalogDraft(listing)[listingField.dataset.renewalField] = listingField.value; return; }
    const jobRoot = event.target.closest('[data-renewal-job]'); const job = state.jobs.find((item) => item.jobId === jobRoot?.dataset.renewalJob); if (!job) return;
    const finalTags = event.target.closest('[data-renewal-final-tags]');
    if (finalTags) {
      const draft = getReviewDraft(job); draft.finalTagsText = finalTags.value;
      const counter = finalTags.parentElement?.querySelector('.renewal-tag-footer strong'); if (counter) counter.textContent = `${parseFinalTags(finalTags.value).length}/13 tags`;
      scheduleReviewAutosave(job.jobId); return;
    }
    const reviewTagEdit = event.target.closest('[data-renewal-tag-edit]');
    if (reviewTagEdit) {
      const length = reviewTagEdit.parentElement?.querySelector('[data-renewal-tag-length]'); if (length) length.textContent = String(reviewTagEdit.value.length); return;
    }
    const draft = getJobDraft(job);
    const jobField = event.target.closest('[data-renewal-job-field]'); if (jobField) { draft.form[jobField.dataset.renewalJobField] = jobField.value; return; }
    const dimension = event.target.closest('[data-renewal-scale-dimension]'); if (dimension) { const entry = draft.form.scales.find((item) => item.key === dimension.dataset.renewalScaleDimension); if (entry) { entry.dimension = dimension.value; entry.dimensionSource = entry.isOrigin ? 'origin' : 'manual'; if (entry.isOrigin) { recalculateDimensions(draft); draft.form.scales.forEach((item) => { const input = jobRoot.querySelector(`[data-renewal-scale-dimension="${item.key}"]`); if (input && item.key !== entry.key) input.value = item.dimension || ''; }); } scheduleFormAutosave(job.jobId); } return; }
    const price = event.target.closest('[data-renewal-scale-price]'); if (price) { const key = price.dataset.renewalScalePrice; draft.form.pricing.rows[key] = { ...(draft.form.pricing.rows[key] || {}), priceFr: price.value, source: 'manual' }; refreshPricingRow(price.closest('[data-renewal-scale-row]'), draft, key); scheduleFormAutosave(job.jobId); return; }
    const compensation = event.target.closest('[data-renewal-scale-compensation]'); if (compensation) { const key = compensation.dataset.renewalScaleCompensation; draft.form.pricing.rows[key] = { ...(draft.form.pricing.rows[key] || {}), compensation: compensation.value }; refreshPricingRow(compensation.closest('[data-renewal-scale-row]'), draft, key); scheduleFormAutosave(job.jobId); return; }
    const calc = event.target.closest('[data-renewal-calc]'); if (calc) { draft.form.pricing.calculator[calc.dataset.renewalCalc] = calc.value; scheduleFormAutosave(job.jobId); return; }
    const reviewField = event.target.closest('[data-renewal-review-field]'); if (reviewField) { getReviewDraft(job)[reviewField.dataset.renewalReviewField] = reviewField.value; scheduleReviewAutosave(job.jobId); }
  });

  host()?.addEventListener('dragover', (event) => {
    const dropZone = event.target.closest('[data-renewal-image-drop]'); if (!dropZone) return;
    const hasImage = [...(event.dataTransfer?.items || [])].some((item) => item.kind === 'file' && item.type.startsWith('image/')); if (!hasImage) return;
    event.preventDefault(); dropZone.classList.add('is-dragover');
  });

  host()?.addEventListener('dragleave', (event) => {
    const dropZone = event.target.closest('[data-renewal-image-drop]'); if (dropZone && !dropZone.contains(event.relatedTarget)) dropZone.classList.remove('is-dragover');
  });

  host()?.addEventListener('drop', async (event) => {
    const dropZone = event.target.closest('[data-renewal-image-drop]'); if (!dropZone) return;
    const files = [...(event.dataTransfer?.files || [])].filter((file) => file.type.startsWith('image/')); dropZone.classList.remove('is-dragover'); if (!files.length) return;
    event.preventDefault(); await addReviewImageFiles(dropZone.dataset.renewalImageDrop, files);
  });

  global.addEventListener('pagehide', () => {
    state.reviewAutosaveTimers.forEach((timer) => clearTimeout(timer)); state.reviewAutosaveTimers.clear();
    state.formAutosaveTimers.forEach((timer) => clearTimeout(timer)); state.formAutosaveTimers.clear();
    state.jobDrafts.forEach((draft, jobId) => {
      fetch('/renewal-workshop/form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId, form: draft.form }), keepalive: true }).catch(() => {});
    });
    state.reviewDrafts.forEach((draft, jobId) => {
      const job = state.jobs.find((item) => item.jobId === jobId); if (!job) return;
      fetch('/renewal-workshop/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId, review: buildReviewPayload(job, draft) }), keepalive: true }).catch(() => {});
    });
  });

  global.PipelineUIRenewals = { open, render, refreshCatalog, runQueue };
})(window);
