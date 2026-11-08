'use strict';

(function initLocalizationBackfillRuntime(global) {
  const state = {
    shopKey: 'grosgeek',
    mode: 'collection',
    config: null,
    catalog: null,
    selectedIds: new Set(),
    selectedLanguages: new Set(),
    page: 1,
    pageSize: 25,
    activeRun: null,
    pollTimer: 0,
    timingTimer: 0,
    estimateTimer: 0,
    estimateKey: '',
    estimate: null,
    catalogRefreshId: 0,
    viewByMode: { collection: 'single', tabletop: 'single' },
    initialized: false,
  };

  const query = (hook) => document.querySelector(`[data-js="${hook}"]`);
  const queryAll = (hook) => [...document.querySelectorAll(`[data-js="${hook}"]`)];
  const getActiveShopKey = () => global.PipelineUIApp?.getActiveShopKey?.() || 'grosgeek';
  const shopLabel = () => (state.shopKey === 'doublex' ? 'Double X Industrie' : 'Gros Geek Industrie');
  const modeLabel = () => (state.mode === 'tabletop' ? 'Tabletop / JDR / wargame' : 'Collection');
  const contextUrl = (path) => {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}shop=${encodeURIComponent(state.shopKey)}&mode=${encodeURIComponent(state.mode)}`;
  };
  const languageLabel = (code) => state.config?.languages?.find((item) => item.code === code)?.label || code.toUpperCase();
  const jobStateLabel = (value) => ({
    pending: 'en attente',
    generating: 'localisation en cours',
    preview_ready: 'localisation prête',
    publish_pending: 'publication en attente',
    publishing: 'publication en cours',
    published: 'publiée',
    failed: 'échec',
    skipped: 'ignorée',
    cancelled: 'annulée',
  }[value] || value);

  const secondsBetween = (start, end = Date.now()) => {
    const startMs = Date.parse(start || '');
    const endMs = typeof end === 'number' ? end : Date.parse(end || '');
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
    return Math.max(0, Math.round((endMs - startMs) / 1000));
  };

  const formatDuration = (seconds) => {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
    if (minutes) return `${minutes} min ${String(secs).padStart(2, '0')} s`;
    return `${secs} s`;
  };

  const setStatus = (message, isError = false) => {
    const node = query('localization-backfill-status');
    if (!node) return;
    node.textContent = String(message || '');
    node.classList.toggle('error', isError);
  };

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload.error === 'string'
        ? payload.error
        : payload.error?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  };

  const getFilters = () => ({
    search: String(query('localization-filter-search')?.value || '').trim().toLocaleLowerCase('fr'),
    section: String(query('localization-filter-section')?.value || ''),
    language: String(query('localization-filter-language')?.value || ''),
    missingOnly: !!query('localization-filter-missing-only')?.checked,
  });

  const getFilteredListings = () => {
    const filters = getFilters();
    return (state.catalog?.listings || []).filter((listing) => {
      if (listing.excluded) return false;
      if (filters.section && listing.sectionName !== filters.section) return false;
      if (filters.language && !(listing.missingLanguages || []).includes(filters.language)) return false;
      if (filters.missingOnly && !(listing.missingLanguages || []).length) return false;
      if (filters.search) {
        const haystack = `${listing.listingId} ${listing.title}`.toLocaleLowerCase('fr');
        if (!haystack.includes(filters.search)) return false;
      }
      return true;
    });
  };

  const getPagedListings = () => {
    const listings = getFilteredListings();
    const totalPages = Math.max(1, Math.ceil(listings.length / state.pageSize));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const start = (state.page - 1) * state.pageSize;
    return { listings: listings.slice(start, start + state.pageSize), total: listings.length, totalPages };
  };

  const createLanguageChips = (codes, missing = false) => {
    const container = document.createElement('div');
    container.className = 'localization-language-chips';
    (codes || []).forEach((code) => {
      const chip = document.createElement('span');
      chip.className = `localization-language-chip${missing ? ' is-missing' : ''}`;
      chip.textContent = code;
      chip.title = languageLabel(code);
      container.append(chip);
    });
    if (!codes?.length) {
      const empty = document.createElement('span');
      empty.textContent = '—';
      container.append(empty);
    }
    return container;
  };

  const renderCatalogRows = () => {
    const tbody = query('localization-catalog-rows');
    if (!tbody) return;
    const { listings, total, totalPages } = getPagedListings();
    tbody.replaceChildren();
    if (!listings.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.textContent = state.catalog ? 'Aucune fiche ne correspond aux filtres.' : 'Lance l’audit pour charger le catalogue.';
      row.append(cell);
      tbody.append(row);
    }

    listings.forEach((listing) => {
      const row = document.createElement('tr');
      const selectionCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = state.selectedIds.has(listing.listingId);
      checkbox.dataset.js = 'localization-listing-checkbox';
      checkbox.dataset.listingId = listing.listingId;
      checkbox.setAttribute('aria-label', `Sélectionner ${listing.title}`);
      selectionCell.append(checkbox);

      const listingCell = document.createElement('td');
      const listingWrap = document.createElement('div');
      listingWrap.className = 'localization-listing-cell';
      if (listing.imageUrl) {
        const image = document.createElement('img');
        image.src = listing.imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        listingWrap.append(image);
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'localization-listing-placeholder';
        listingWrap.append(placeholder);
      }
      const identity = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = listing.title || `Fiche ${listing.listingId}`;
      const id = document.createElement('small');
      id.textContent = `#${listing.listingId}`;
      identity.append(title, id);
      listingWrap.append(identity);
      listingCell.append(listingWrap);

      const sectionCell = document.createElement('td');
      sectionCell.textContent = listing.sectionName || 'Sans section';
      const presentCell = document.createElement('td');
      presentCell.append(createLanguageChips(listing.translations, false));
      const missingCell = document.createElement('td');
      missingCell.append(createLanguageChips(listing.missingLanguages, true));
      row.append(selectionCell, listingCell, sectionCell, presentCell, missingCell);
      tbody.append(row);
    });

    const pageLabel = query('localization-page-label');
    if (pageLabel) pageLabel.textContent = `Page ${state.page} / ${totalPages} · ${total} fiche(s)`;
    const previous = query('localization-page-previous');
    const next = query('localization-page-next');
    if (previous) previous.disabled = state.page <= 1;
    if (next) next.disabled = state.page >= totalPages;
    renderSelectionState();
  };

  const countPlannedJobs = () => {
    const byId = new Map((state.catalog?.listings || []).map((listing) => [listing.listingId, listing]));
    let jobs = 0;
    state.selectedIds.forEach((listingId) => {
      const listing = byId.get(listingId);
      if (!listing || listing.excluded) return;
      state.selectedLanguages.forEach((language) => {
        if ((listing.missingLanguages || []).includes(language)) jobs += 1;
      });
    });
    return jobs;
  };

  const renderSelectionState = () => {
    const selectedCount = state.selectedIds.size;
    const jobs = countPlannedJobs();
    const missingListings = (state.catalog?.listings || []).filter(
      (listing) => !listing.excluded && (listing.missingLanguages || []).length > 0,
    ).length;
    const metrics = query('localization-catalog-metrics');
    if (metrics) {
      metrics.replaceChildren();
      [
        `${state.catalog?.count || 0} fiche(s) auditée(s)`,
        `${missingListings} fiche(s) avec au moins une langue manquante`,
        `${selectedCount} fiche(s) sélectionnée(s)`,
        `${jobs} localisation(s) prévues dans la sélection`,
        state.estimate?.jobs
          ? `≈ $${Number(state.estimate.estimatedCostUsd || 0).toFixed(2)} direct · $${Number(state.estimate.economicBatchEstimateUsd || 0).toFixed(2)} Batch`
          : 'Estimation : —',
        'Chaque lot terminé est aussi archivé en JSON sur le PC',
      ].forEach((label) => {
        const node = document.createElement('span');
        node.textContent = label;
        metrics.append(node);
      });
    }
    const summary = query('localization-selection-summary');
    if (summary) summary.textContent = selectedCount
      ? `${selectedCount} fiche(s), ${state.selectedLanguages.size} langue(s), ${jobs} job(s) manquant(s).`
      : 'Aucune fiche sélectionnée.';
    const hasCatalog = !!state.catalog?.listings?.length;
    const selectPage = query('localization-select-page');
    const selectFiltered = query('localization-select-filtered');
    const clear = query('localization-clear-selection');
    const create = query('localization-create-run');
    const createFull = query('localization-create-full-run');
    const refresh = query('localization-catalog-refresh');
    const start = query('localization-run-start');
    const runIsBusy = state.activeRun?.state === 'running';
    if (refresh) refresh.disabled = runIsBusy;
    if (selectPage) selectPage.disabled = !hasCatalog || runIsBusy;
    if (selectFiltered) selectFiltered.disabled = !hasCatalog || runIsBusy;
    if (clear) clear.disabled = selectedCount === 0 || runIsBusy;
    if (create) create.disabled = jobs === 0 || runIsBusy;
    if (createFull) createFull.disabled = selectedCount === 0 || runIsBusy;
    if (start) {
      const hasPreparedRun = !!state.activeRun?.runId
        && Number(state.activeRun?.totalJobs || 0) > 0
        && ['draft', 'paused', 'failed'].includes(state.activeRun?.state);
      start.disabled = !hasPreparedRun;
    }
  };

  const renderLanguagePicker = () => {
    const container = query('localization-language-picker');
    const filter = query('localization-filter-language');
    if (!container || !state.config) return;
    container.replaceChildren();
    if (filter) {
      filter.replaceChildren(new Option('Toutes les langues', ''));
    }
    if (!state.selectedLanguages.size) {
      state.config.languages.forEach(({ code }) => state.selectedLanguages.add(code));
    }
    state.config.languages.forEach(({ code, label }) => {
      const glossary = state.config.glossaries?.[code] || {};
      const editorialReady = glossary.ready && glossary.fixedBlocksReady;
      const choice = document.createElement('label');
      choice.className = `localization-language-choice${editorialReady ? '' : ' is-draft'}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = state.selectedLanguages.has(code);
      checkbox.dataset.js = 'localization-language-checkbox';
      checkbox.value = code;
      const name = document.createElement('span');
      name.textContent = `${code.toUpperCase()} · ${label}`;
      const status = document.createElement('small');
      const glossaryLabel = glossary.status === 'CANDIDATE' ? 'glossaire candidat' : `glossaire ${(glossary.status || 'draft').toLowerCase()}`;
      const fixedLabel = glossary.fixedBlocksReady ? 'blocs fixes validés' : 'blocs fixes brouillon';
      status.textContent = editorialReady ? 'validé' : `${glossaryLabel} · ${fixedLabel}`;
      choice.append(checkbox, name, status);
      container.append(choice);
      if (filter) filter.append(new Option(`${code.toUpperCase()} · ${label}`, code));
    });
  };

  const renderCatalogConfig = () => {
    const section = query('localization-filter-section');
    if (section) {
      section.replaceChildren(new Option('Toutes les sections autorisées', ''));
      (state.catalog?.sections || []).forEach((name) => section.append(new Option(name, name)));
    }
    renderCatalogRows();
  };

  const getActiveTranslationExecution = () => {
    const execution = global.PipelineUIAIProfiles?.resolveExecution?.('traduction_listing_en') || {};
    if (execution.provider === 'openai') {
      return { model: execution.model, reasoningEffort: execution.reasoningEffort };
    }
    return { model: 'gpt-5.6-terra', reasoningEffort: 'low' };
  };

  const refreshEstimate = async () => {
    const execution = getActiveTranslationExecution();
    const signature = JSON.stringify({
      shopKey: state.shopKey,
      mode: state.mode,
      listingIds: [...state.selectedIds].sort(),
      languages: [...state.selectedLanguages].sort(),
      model: execution.model,
    });
    if (signature === state.estimateKey) return;
    state.estimateKey = signature;
    if (!state.selectedIds.size || !state.selectedLanguages.size) {
      state.estimate = null;
      renderSelectionState();
      return;
    }
    try {
      const baseOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };
      const estimatePromise = fetchJson('/localization-backfill/estimate', {
        ...baseOptions,
        body: signature,
      });
      state.estimate = await estimatePromise;
      renderSelectionState();
    } catch (error) {
      state.estimate = null;
      renderSelectionState();
    }
  };

  const scheduleEstimate = () => {
    global.clearTimeout(state.estimateTimer);
    state.estimateTimer = global.setTimeout(refreshEstimate, 250);
  };

  const refreshCatalog = async () => {
    const refreshId = ++state.catalogRefreshId;
    const refreshContext = `${state.shopKey}:${state.mode}`;
    setStatus('Audit Etsy en cours… Cette lecture ne lance aucun modèle IA.');
    const button = query('localization-catalog-refresh');
    if (button) button.disabled = true;
    try {
      const catalog = await fetchJson(contextUrl('/localization-backfill/catalog?refresh=1'));
      if (refreshId !== state.catalogRefreshId || refreshContext !== `${state.shopKey}:${state.mode}`) return;
      state.catalog = catalog;
      state.selectedIds.clear();
      state.estimate = null;
      state.estimateKey = '';
      state.page = 1;
      renderCatalogConfig();
      setStatus(`${shopLabel()} · ${state.catalog.count} fiche(s) active(s) auditée(s), ${state.catalog.eligibleCount} éligible(s).`);
    } catch (error) {
      if (refreshId !== state.catalogRefreshId || refreshContext !== `${state.shopKey}:${state.mode}`) return;
      const cachedCatalogLoaded = await loadCachedCatalog({
        renderStatus: false,
        expectedRefreshId: refreshId,
        expectedContext: refreshContext,
      });
      if (cachedCatalogLoaded) {
        setStatus(`Audit Etsy impossible : ${error.message}. Snapshot local du ${state.catalog.scannedAt || 'dernier audit'} affiché en secours.`, true);
      } else {
        setStatus(`Audit impossible : ${error.message}`, true);
      }
    } finally {
      if (button && refreshId === state.catalogRefreshId) button.disabled = false;
    }
  };

  const loadCachedCatalog = async ({
    renderStatus = true,
    expectedRefreshId = state.catalogRefreshId,
    expectedContext = `${state.shopKey}:${state.mode}`,
  } = {}) => {
    try {
      const catalog = await fetchJson(contextUrl('/localization-backfill/catalog'));
      if (expectedRefreshId !== state.catalogRefreshId || expectedContext !== `${state.shopKey}:${state.mode}`) return false;
      state.catalog = catalog;
      if (catalog.count) {
        renderCatalogConfig();
        if (renderStatus) {
          setStatus(`Snapshot local du ${state.catalog.scannedAt || 'dernier audit'} chargé en secours · ${state.catalog.count} fiche(s).`, true);
        }
        return true;
      }
    } catch (error) {}
    return false;
  };

  const createRun = async () => {
    const jobs = countPlannedJobs();
    if (!jobs) return;
    const execution = getActiveTranslationExecution();
    setStatus(`Préparation du lot · ${jobs} traduction(s) · ${execution.model}…`);
    try {
      state.activeRun = await fetchJson('/localization-backfill/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopKey: state.shopKey,
          mode: state.mode,
          listingIds: [...state.selectedIds],
          languages: [...state.selectedLanguages],
          model: execution.model,
          reasoningEffort: execution.reasoningEffort,
        }),
      });
      renderRun();
      setStatus(`Lot préparé : ${state.activeRun.createdJobs || state.activeRun.totalJobs} traduction(s) en attente. Clique sur Lancer les traductions quand tu es prêt.`);
    } catch (error) {
      setStatus(`Création du lot impossible : ${error.message}`, true);
    }
  };

  const createFullRun = async () => {
    if (!state.selectedIds.size) return;
    const jobCount = state.selectedIds.size * Number(state.config?.languages?.length || 10);
    const confirmed = global.confirm(
      `Retraduire intégralement ${state.selectedIds.size} fiche(s), soit ${jobCount} traductions ?\n\nLes résultats resteront en aperçu et le rapport sera téléchargeable dès la fin. Rien ne sera publié automatiquement sur Etsy.`,
    );
    if (!confirmed) return;
    const execution = getActiveTranslationExecution();
    setStatus(`Retraduction complète · ${jobCount} traduction(s) · ${execution.model}…`);
    try {
      const preparedRun = await fetchJson('/localization-backfill/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopKey: state.shopKey,
          mode: state.mode,
          listingIds: [...state.selectedIds],
          languages: (state.config?.languages || []).map(({ code }) => code),
          model: execution.model,
          reasoningEffort: execution.reasoningEffort,
          forceExisting: true,
        }),
      });
      state.activeRun = await fetchJson('/localization-backfill/run/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: preparedRun.runId, action: 'start' }),
      });
      renderRun();
      scheduleRunPoll();
      setStatus(`Retraduction complète lancée : ${jobCount} aperçu(s) à générer. Les traductions Etsy existantes restent intactes jusqu'à la publication séparée.`);
    } catch (error) {
      setStatus(`Retraduction complète impossible : ${error.message}`, true);
    }
  };

  const downloadRunExport = async () => {
    const run = state.activeRun;
    if (!run?.runId) return;
    try {
      const payload = await fetchJson(`/localization-backfill/run/export?id=${encodeURIComponent(run.runId)}`);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `localization-run-${run.runId.slice(0, 8)}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus(`Rapport JSON du lot ${run.runId.slice(0, 8)} téléchargé. L’archive complète reste aussi conservée sur le PC.`);
    } catch (error) {
      setStatus(`Export JSON impossible : ${error.message}`, true);
    }
  };

  const runAction = async (action) => {
    if (!state.activeRun?.runId) return;
    if (action === 'approve_publish') {
      const previewCount = Number(state.activeRun.counts?.preview_ready || 0);
      const confirmed = global.confirm(`Publier ${previewCount} localisation(s) validée(s) sur Etsy ?\n\nCette action écrit réellement dans la boutique.`);
      if (!confirmed) return;
    }
    try {
      state.activeRun = await fetchJson('/localization-backfill/run/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: state.activeRun.runId, action }),
      });
      renderRun();
      scheduleRunPoll();
    } catch (error) {
      setStatus(`Action impossible : ${error.message}`, true);
    }
  };

  const createRunMetric = (label, value, tone = '') => {
    const metric = document.createElement('div');
    metric.className = `localization-run-metric${tone ? ` is-${tone}` : ''}`;
    const title = document.createElement('strong');
    title.textContent = String(value);
    const caption = document.createElement('div');
    caption.textContent = label;
    metric.append(title, caption);
    return metric;
  };

  const updateTimingDisplays = () => {
    document.querySelectorAll('[data-localization-job-timer]').forEach((node) => {
      const startedAt = node.dataset.startedAt || '';
      const completedAt = node.dataset.completedAt || '';
      const stateLabel = node.dataset.state || '';
      if (!startedAt) {
        node.textContent = stateLabel === 'pending' ? ' · en attente' : '';
        return;
      }
      const seconds = secondsBetween(startedAt, completedAt || Date.now());
      node.textContent = ` · ${completedAt ? 'durée' : 'en cours'} ${formatDuration(seconds)}`;
    });

    const run = state.activeRun;
    const timing = query('localization-run-timing');
    if (!run || !timing) return;
    const jobs = run.jobs || [];
    const publishingCount = Number(run.counts?.publish_pending || 0)
      + Number(run.counts?.publishing || 0)
      + Number(run.counts?.published || 0);
    const isPublishingPhase = publishingCount > 0
      && Number(run.counts?.pending || 0) === 0
      && Number(run.counts?.generating || 0) === 0;
    const phaseJobs = isPublishingPhase
      ? jobs.filter((job) => ['publishing', 'published'].includes(job.state))
      : jobs;
    const phaseTimingJobs = isPublishingPhase
      ? jobs.filter((job) => ['publish_pending', 'publishing', 'published'].includes(job.state))
      : phaseJobs;
    const phaseStart = phaseTimingJobs
      .map((job) => Date.parse(
        isPublishingPhase && job.state === 'publish_pending'
          ? (job.updatedAt || '')
          : (job.startedAt || ''),
      ))
      .filter(Number.isFinite)
      .sort((left, right) => left - right)[0];
    const elapsed = secondsBetween(
      phaseStart ? new Date(phaseStart).toISOString() : (run.startedAt || run.createdAt),
      run.state === 'running' ? Date.now() : (run.completedAt || Date.now()),
    );
    const finishedJobs = phaseJobs.filter((job) => job.completedAt && job.startedAt && (
      !isPublishingPhase || job.state === 'published'
    ));
    const measuredSeconds = finishedJobs.reduce(
      (total, job) => total + secondsBetween(job.startedAt, job.completedAt),
      0,
    );
    const completedCount = isPublishingPhase
      ? Number(run.counts?.published || 0)
      : Number(run.counts?.preview_ready || 0)
        + Number(run.counts?.published || 0)
        + Number(run.counts?.failed || 0);
    const averageSeconds = finishedJobs.length
      ? measuredSeconds / finishedJobs.length
      : (completedCount > 0 ? elapsed / completedCount : 0);
    const remaining = isPublishingPhase
      ? Number(run.counts?.publish_pending || 0) + Number(run.counts?.publishing || 0)
      : Number(run.counts?.pending || 0) + Number(run.counts?.generating || 0);
    const eta = run.state === 'running' && averageSeconds > 0
      ? ` · moyenne ${formatDuration(averageSeconds)}/traduction · fin estimée dans ${formatDuration(averageSeconds * remaining)}`
      : '';
    timing.textContent = `${isPublishingPhase ? 'Publication Etsy' : 'Génération'} : ${formatDuration(elapsed)}${eta}`;
  };

  const renderRun = () => {
    const run = state.activeRun;
    const container = query('localization-run');
    if (!container || !run) return;
    const isRunning = run.state === 'running';
    const workspace = query('localization-catalog-workspace');
    if (workspace) workspace.hidden = isRunning;
    container.hidden = false;
    const title = query('localization-run-title');
    const summary = query('localization-run-summary');
    const runKind = run.testMode ? 'TEST 4 × 10' : (run.forceExisting ? 'Retraduction complète' : 'Lot');
    if (title) title.textContent = `${runKind} ${run.runId.slice(0, 8)} · ${run.state}`;
    if (summary) summary.textContent = `${run.totalJobs} job(s) · ${run.model} · réflexion ${run.reasoningEffort} · prompt ${run.promptVersion}${run.testMode ? ' · publication verrouillée' : ''}`;
    const completion = query('localization-run-completion');
    if (completion) {
      const previewReadyCount = Number(run.counts?.preview_ready || 0);
      const publishedCount = Number(run.counts?.published || 0);
      const isCompleted = run.state === 'completed';
      const isFailed = run.state === 'failed';
      completion.hidden = !isCompleted && !isFailed;
      completion.classList.toggle('is-error', isFailed);
      completion.textContent = isFailed
        ? `Traitement du lot terminé avec ${Number(run.counts?.failed || 0)} erreur(s) · ${previewReadyCount} aperçu(s) prêt(s).`
        : (previewReadyCount > 0
          ? `Traduction du lot terminée · ${previewReadyCount} aperçu(s) prêt(s) à contrôler.`
          : (publishedCount > 0 ? `Publication du lot terminée · ${publishedCount} traduction(s) publiée(s).` : 'Traitement du lot terminé.'));
    }
    const progress = query('localization-run-progress');
    if (progress) {
      progress.replaceChildren(
        createRunMetric('En attente', run.counts?.pending || 0, 'pending'),
        createRunMetric('Génération', run.counts?.generating || 0, 'generating'),
        createRunMetric('Aperçus prêts', run.counts?.preview_ready || 0, 'ready'),
        createRunMetric('À publier', run.counts?.publish_pending || 0, 'publish-pending'),
        createRunMetric('Publication', run.counts?.publishing || 0, 'publishing'),
        createRunMetric('Publiées', run.counts?.published || 0, 'published'),
        createRunMetric('Erreurs', run.counts?.failed || 0, 'failed'),
      );
    }
    const jobList = query('localization-job-list');
    if (jobList) {
      jobList.replaceChildren();
      (run.jobs || []).forEach((job) => {
        const card = document.createElement('details');
        card.className = `localization-job-card is-${String(job.state || 'pending').replaceAll('_', '-')}`;
        const header = document.createElement('summary');
        const headerLabel = document.createElement('span');
        headerLabel.textContent = `${job.listingTitle || job.listingId} · ${job.language.toUpperCase()} · ${jobStateLabel(job.state)}`;
        const timer = document.createElement('span');
        timer.dataset.localizationJobTimer = '';
        timer.dataset.startedAt = job.startedAt || '';
        timer.dataset.completedAt = job.completedAt || '';
        timer.dataset.state = job.state;
        header.append(headerLabel, timer);
        card.append(header);
        if (job.output?.title) {
          const output = document.createElement('div');
          output.className = 'localization-job-output';
          const createField = (label, value) => {
            const field = document.createElement('div');
            field.className = 'localization-job-field';
            const heading = document.createElement('strong');
            heading.textContent = label;
            const content = document.createElement('p');
            content.textContent = value || '—';
            field.append(heading, content);
            return field;
          };
          output.append(
            createField('Titre français', job.listingTitle || ''),
            createField(`Titre ${job.language.toUpperCase()} · ${job.output.title.length}/140`, job.output.title),
            createField(`Tags ${job.language.toUpperCase()} · ${(job.output.tags || []).length}`, (job.output.tags || []).join(' · ')),
          );
          const descriptionField = document.createElement('div');
          descriptionField.className = 'localization-job-field';
          const descriptionLabel = document.createElement('strong');
          descriptionLabel.textContent = `Description ${job.language.toUpperCase()}`;
          const outputDescription = document.createElement('pre');
          outputDescription.className = 'output-box';
          outputDescription.textContent = job.output.description || '';
          descriptionField.append(descriptionLabel, outputDescription);
          output.append(descriptionField);
          card.append(output);
        }
        if (job.error) {
          const error = document.createElement('div');
          error.className = 'localization-job-error';
          error.textContent = job.error;
          card.append(error);
        }
        if (job.state === 'failed' && job.rawOutput) {
          const raw = document.createElement('details');
          raw.className = 'localization-job-raw';
          const rawSummary = document.createElement('summary');
          rawSummary.textContent = 'Afficher la réponse brute rejetée';
          const rawContent = document.createElement('pre');
          rawContent.className = 'output-box';
          rawContent.textContent = job.rawOutput;
          raw.append(rawSummary, rawContent);
          card.append(raw);
        }
        if (job.qualityWarnings?.length) {
          const warnings = document.createElement('div');
          warnings.className = 'localization-job-warning';
          warnings.textContent = job.qualityWarnings
            .map((warning) => `${warning.message}${warning.values?.length ? ` : ${warning.values.join(', ')}` : ''}`)
            .join(' · ');
          card.append(warnings);
        }
        jobList.append(card);
      });
    }
    const start = query('localization-run-start');
    const pause = query('localization-run-pause');
    const retry = query('localization-run-retry');
    const exportButton = query('localization-run-export');
    const publish = query('localization-run-publish');
    const previewReady = Number(run.counts?.preview_ready || 0);
    const failed = Number(run.counts?.failed || 0);
    if (start) start.disabled = isRunning || !['draft', 'paused', 'failed'].includes(run.state);
    if (pause) pause.disabled = !isRunning;
    if (retry) retry.disabled = isRunning || failed === 0;
    if (exportButton) exportButton.disabled = isRunning || !run.runId;
    if (publish) {
      publish.hidden = !!run.testMode;
      publish.disabled = !!run.testMode || isRunning || previewReady === 0;
    }
    renderSelectionState();
    updateTimingDisplays();
  };

  const pollRun = async () => {
    if (!state.activeRun?.runId) return;
    try {
      state.activeRun = await fetchJson(`/localization-backfill/run?id=${encodeURIComponent(state.activeRun.runId)}`);
      renderRun();
      if (state.activeRun.state === 'running') {
        scheduleRunPoll();
      } else if (state.activeRun.state === 'completed' && Number(state.activeRun.counts?.preview_ready || 0) > 0) {
        setStatus('Tous les aperçus sont prêts et le rapport JSON a été archivé sur le PC. Contrôle-les avant d’autoriser la publication Etsy.');
      }
    } catch (error) {
      setStatus(`Suivi du lot impossible : ${error.message}`, true);
    }
  };

  const scheduleRunPoll = () => {
    global.clearTimeout(state.pollTimer);
    if (state.activeRun?.state === 'running') state.pollTimer = global.setTimeout(pollRun, 2500);
  };

  const mountCatalogPanel = (mode) => {
    const catalog = query('localization-backfill');
    const host = queryAll('localization-backfill-host')
      .find((node) => node.dataset.localizationMode === mode);
    if (catalog && host && catalog.parentElement !== host) host.append(catalog);
  };

  const applyView = (mode, view) => {
    const normalizedView = ['single', 'catalog', 'automation'].includes(view) ? view : 'single';
    const normalizedMode = mode === 'tabletop' ? 'tabletop' : 'collection';
    const effectiveView = normalizedMode === 'tabletop' && normalizedView === 'automation'
      ? 'single'
      : normalizedView;
    state.viewByMode[normalizedMode] = effectiveView;
    mountCatalogPanel(normalizedMode);
    const catalog = query('localization-backfill');
    const automation = query('localization-automation');
    queryAll('localization-single-workflow').forEach((workflow) => {
      if (workflow.dataset.localizationMode === normalizedMode) {
        workflow.hidden = effectiveView !== 'single';
      }
    });
    if (catalog) catalog.hidden = effectiveView !== 'catalog';
    if (automation) automation.hidden = !(normalizedMode === 'collection' && effectiveView === 'automation');
    queryAll('localization-view-switch').forEach((button) => {
      const buttonMode = button.dataset.localizationMode || 'collection';
      const active = button.dataset.localizationView === state.viewByMode[buttonMode];
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    global.dispatchEvent(new CustomEvent('pipeline:localization-view-changed', {
      detail: { view: effectiveView, shopKey: state.shopKey, mode: normalizedMode },
    }));
  };

  const switchView = async (view, mode = state.mode) => {
    const normalizedMode = mode === 'tabletop' ? 'tabletop' : 'collection';
    if (state.mode !== normalizedMode) await loadContext(state.shopKey, normalizedMode);
    applyView(normalizedMode, view);
    if (view === 'catalog' && state.activeRun?.state !== 'running') await refreshCatalog();
  };

  const handleClick = (event) => {
    const translationTab = event.target.closest('[data-collection-tab="translation"], [data-dnd-tab="translation"]');
    if (translationTab) {
      const mode = translationTab.hasAttribute('data-dnd-tab') ? 'tabletop' : 'collection';
      if (state.viewByMode[mode] === 'catalog') {
        switchView('catalog', mode).catch((error) => {
          setStatus(`Ouverture du backfill impossible : ${error.message}`, true);
        });
      }
    }
    const trigger = event.target.closest('[data-js]');
    if (!trigger) return;
    const hook = trigger.dataset.js;
    if (hook === 'localization-view-switch') {
      switchView(trigger.dataset.localizationView, trigger.dataset.localizationMode).catch((error) => {
        setStatus(`Ouverture du backfill impossible : ${error.message}`, true);
      });
    }
    if (hook === 'localization-catalog-refresh') refreshCatalog();
    if (hook === 'localization-select-page') {
      getPagedListings().listings.forEach((listing) => state.selectedIds.add(listing.listingId));
      renderCatalogRows();
      scheduleEstimate();
    }
    if (hook === 'localization-select-filtered') {
      getFilteredListings().forEach((listing) => state.selectedIds.add(listing.listingId));
      renderCatalogRows();
      scheduleEstimate();
    }
    if (hook === 'localization-clear-selection') {
      state.selectedIds.clear();
      renderCatalogRows();
      scheduleEstimate();
    }
    if (hook === 'localization-create-full-run') createFullRun();
    if (hook === 'localization-create-run') createRun();
    if (hook === 'localization-run-start') runAction(state.activeRun?.state === 'paused' ? 'resume' : 'start');
    if (hook === 'localization-run-pause') runAction('pause');
    if (hook === 'localization-run-retry') runAction('retry');
    if (hook === 'localization-run-export') downloadRunExport();
    if (hook === 'localization-run-publish') runAction('approve_publish');
    if (hook === 'localization-page-previous') {
      state.page -= 1;
      renderCatalogRows();
    }
    if (hook === 'localization-page-next') {
      state.page += 1;
      renderCatalogRows();
    }
  };

  const handleChange = (event) => {
    const trigger = event.target;
    const hook = trigger?.dataset?.js;
    if (hook === 'localization-listing-checkbox') {
      if (trigger.checked) state.selectedIds.add(trigger.dataset.listingId);
      else state.selectedIds.delete(trigger.dataset.listingId);
      renderSelectionState();
      scheduleEstimate();
    }
    if (hook === 'localization-language-checkbox') {
      if (trigger.checked) state.selectedLanguages.add(trigger.value);
      else state.selectedLanguages.delete(trigger.value);
      renderSelectionState();
      scheduleEstimate();
    }
    if (['localization-filter-section', 'localization-filter-language', 'localization-filter-missing-only'].includes(hook)) {
      state.page = 1;
      renderCatalogRows();
    }
    if (hook === 'localization-page-size') {
      state.pageSize = Number(trigger.value) || 25;
      state.page = 1;
      renderCatalogRows();
    }
  };

  const handleInput = (event) => {
    if (event.target?.dataset?.js !== 'localization-filter-search') return;
    state.page = 1;
    renderCatalogRows();
  };

  const restoreLatestRun = async () => {
    try {
      const payload = await fetchJson(contextUrl('/localization-backfill/runs'));
      const latest = payload.runs?.[0];
      if (!latest) return;
      state.activeRun = await fetchJson(`/localization-backfill/run?id=${encodeURIComponent(latest.runId)}`);
      renderRun();
      scheduleRunPoll();
    } catch (error) {}
  };

  const loadContext = async (shopKey = getActiveShopKey(), mode = state.mode) => {
    state.catalogRefreshId += 1;
    state.shopKey = shopKey === 'doublex' ? 'doublex' : 'grosgeek';
    state.mode = mode === 'tabletop' ? 'tabletop' : 'collection';
    state.catalog = null;
    state.selectedIds.clear();
    state.selectedLanguages.clear();
    state.activeRun = null;
    state.estimate = null;
    state.estimateKey = '';
    state.page = 1;
    global.clearTimeout(state.pollTimer);
    const runContainer = query('localization-run');
    if (runContainer) runContainer.hidden = true;
    const catalogWorkspace = query('localization-catalog-workspace');
    if (catalogWorkspace) catalogWorkspace.hidden = false;
    const kicker = query('localization-backfill-kicker');
    if (kicker) kicker.textContent = `Localisation · ${modeLabel()} · ${shopLabel()}`;
    mountCatalogPanel(state.mode);
    try {
      state.config = await fetchJson(contextUrl('/localization-backfill/config'));
      renderLanguagePicker();
      renderSelectionState();
      await restoreLatestRun();
    } catch (error) {
      setStatus(`Initialisation backfill impossible : ${error.message}`, true);
    }
  };

  const init = async () => {
    if (state.initialized || !query('localization-backfill')) return;
    state.initialized = true;
    state.timingTimer = global.setInterval(updateTimingDisplays, 1000);
    document.addEventListener('click', handleClick);
    document.addEventListener('change', handleChange);
    document.addEventListener('input', handleInput);
    global.addEventListener('pipeline:shop-changed', (event) => {
      loadContext(event.detail?.shopKey, state.mode)
        .then(() => {
          if (state.viewByMode[state.mode] === 'catalog' && state.activeRun?.state !== 'running') return refreshCatalog();
          return null;
        })
        .catch(() => {});
    });
    await loadContext();
    applyView('collection', state.viewByMode.collection);
    applyView('tabletop', state.viewByMode.tabletop);
    mountCatalogPanel(state.mode);
  };

  global.PipelineUILocalizationBackfill = Object.freeze({ init, refreshCatalog, switchView });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
