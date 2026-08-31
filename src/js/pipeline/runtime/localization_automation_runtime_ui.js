'use strict';

(function initLocalizationAutomationRuntime(global) {
  const LANGUAGE_CODES = Object.freeze(['en', 'de', 'es', 'it', 'nl', 'pt', 'ja', 'pl', 'ru', 'sv']);
  const state = {
    shopKey: 'grosgeek',
    active: false,
    filter: 'open',
    payload: null,
    pollTimer: 0,
    initialized: false,
  };

  const query = (hook) => document.querySelector(`[data-js="${hook}"]`);
  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const shopLabel = () => (state.shopKey === 'doublex' ? 'Double X Industrie' : 'Gros Geek Industrie');
  const shopUrl = (path) => `${path}${path.includes('?') ? '&' : '?'}shop=${encodeURIComponent(state.shopKey)}`;
  const statusLabel = (value) => ({
    waiting_activation: 'En attente de publication Etsy',
    stabilizing: 'Délai de stabilité',
    verification: 'Vérification de la source',
    generating: 'Localisation en cours',
    publishing: 'Publication en cours',
    completed: 'Terminée',
    attention: 'Intervention requise',
    error: 'Erreur technique',
  }[value] || value || 'En attente');
  const languageStateLabel = (value) => ({
    waiting: 'pas encore commencée',
    pending: 'en attente',
    generating: 'traduction en cours',
    preview_ready: 'prête',
    publish_pending: 'publication en attente',
    publishing: 'publication en cours',
    published: 'publiée',
    failed: 'échec',
    cancelled: 'annulée',
  }[value] || value);
  const languageClass = (value) => ({
    waiting: 'is-waiting',
    pending: 'is-running',
    generating: 'is-running',
    preview_ready: 'is-ready',
    publish_pending: 'is-ready',
    publishing: 'is-running',
    published: 'is-published',
    failed: 'is-failed',
    cancelled: 'is-waiting',
  }[value] || 'is-waiting');

  const setStatus = (message, isError = false) => {
    const node = query('localization-automation-status');
    if (!node) return;
    node.textContent = String(message || '');
    node.classList.toggle('error', isError);
  };

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || payload.error || `HTTP ${response.status}`);
    return payload;
  };

  const formatDuration = (seconds) => {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return minutes ? `${minutes} min ${String(secs).padStart(2, '0')} s` : `${secs} s`;
  };

  const stableTimeLabel = (entry) => {
    if (entry.state !== 'stabilizing' || !entry.stableSince) return '';
    const elapsed = Math.max(0, (Date.now() - Date.parse(entry.stableSince)) / 1000);
    const remaining = Math.max(0, Number(state.payload?.stabilitySeconds || 0) - elapsed);
    return ` · lancement dans environ ${formatDuration(remaining)}`;
  };

  const activityLabel = (entry) => {
    const parts = [];
    if (Number(entry.processingSeconds) > 0) parts.push(`traitement ${formatDuration(entry.processingSeconds)}`);
    const totalTokens = Number(entry.usage?.inputTokens || 0) + Number(entry.usage?.outputTokens || 0);
    if (totalTokens > 0) parts.push(`${totalTokens.toLocaleString('fr-FR')} tokens`);
    if (Number(entry.estimatedCostUsd) > 0) parts.push(`coût estimé $${Number(entry.estimatedCostUsd).toFixed(3)}`);
    return parts.length ? ` · ${parts.join(' · ')}` : '';
  };

  const filteredEntries = () => (state.payload?.entries || []).filter((entry) => {
    if (state.filter === 'all') return true;
    if (state.filter === 'completed') return entry.state === 'completed';
    if (state.filter === 'attention') return entry.hasErrors || ['attention', 'error'].includes(entry.state);
    return entry.state !== 'completed';
  });

  const renderLanguageChips = (entry) => (entry.languages || LANGUAGE_CODES.map((code) => ({ code, state: 'waiting' })))
    .map((language) => `
      <span class="localization-automation-language ${languageClass(language.state)}"
            title="${escapeHtml(language.label || language.code.toUpperCase())} · ${escapeHtml(languageStateLabel(language.state))}">
        ${escapeHtml(String(language.code || '').toUpperCase())}
      </span>
    `).join('');

  const renderEntryHead = (entry) => `
    <div class="localization-automation-entry-head">
      ${entry.imageUrl
        ? `<img src="${escapeHtml(entry.imageUrl)}" alt="" loading="lazy">`
        : '<div class="localization-automation-image-placeholder" aria-hidden="true"></div>'}
      <div class="localization-automation-entry-copy">
        <strong>${escapeHtml(entry.title || `Fiche Etsy ${entry.listingId}`)}</strong>
        <span>${escapeHtml(statusLabel(entry.state))}${escapeHtml(stableTimeLabel(entry))}${escapeHtml(activityLabel(entry))}</span>
        <div class="localization-automation-languages" aria-label="État des langues">
          ${renderLanguageChips(entry)}
        </div>
      </div>
      <span class="localization-automation-state is-${escapeHtml(entry.state)}">${escapeHtml(statusLabel(entry.state))}</span>
    </div>
  `;

  const renderErrors = (entry) => `
    <div class="localization-automation-errors">
      ${(entry.errors || []).map((error) => `
        <article class="localization-automation-error">
          <div class="localization-automation-error-title">
            <strong>${escapeHtml(error.label || String(error.language || '').toUpperCase() || 'Automatisation')}</strong>
            <span>${escapeHtml(error.error || 'Erreur sans message détaillé')}</span>
          </div>
          ${(error.qualityWarnings || []).length
            ? `<ul>${error.qualityWarnings.map((warning) => `<li><code>${escapeHtml(warning.code)}</code> ${escapeHtml(warning.message)}</li>`).join('')}</ul>`
            : ''}
          ${error.output && Object.keys(error.output).length
            ? `<details class="localization-automation-output"><summary>Sortie générée</summary><pre>${escapeHtml(JSON.stringify(error.output, null, 2))}</pre></details>`
            : ''}
          ${error.language ? `<button class="btn btn-muted" type="button" data-automation-action="retry_language" data-automation-id="${escapeHtml(entry.automationId)}" data-language="${escapeHtml(error.language)}">Relancer ${escapeHtml(String(error.language).toUpperCase())}</button>` : ''}
        </article>
      `).join('')}
      <div class="localization-automation-entry-actions">
        ${(entry.errors || []).some((error) => error.language)
          ? `<button class="btn btn-accent" type="button" data-automation-action="retry_failed" data-automation-id="${escapeHtml(entry.automationId)}">Relancer toutes les langues échouées</button>`
          : `<button class="btn btn-accent" type="button" data-automation-action="check_now" data-automation-id="${escapeHtml(entry.automationId)}">Vérifier maintenant</button>`}
        <button class="btn btn-muted" type="button" data-automation-action="open_single" data-automation-id="${escapeHtml(entry.automationId)}" data-listing-id="${escapeHtml(entry.listingId)}">Ouvrir dans la fiche unique</button>
        <button class="btn btn-muted" type="button" data-automation-action="export" data-automation-id="${escapeHtml(entry.automationId)}">Télécharger le rapport</button>
        ${entry.url ? `<a class="btn btn-muted" href="${escapeHtml(entry.url)}" target="_blank" rel="noopener">Ouvrir sur Etsy</a>` : ''}
      </div>
    </div>
  `;

  const renderEntries = () => {
    const container = query('localization-automation-list');
    if (!container) return;
    const entries = filteredEntries();
    if (!entries.length) {
      container.innerHTML = '<p class="localization-automation-empty">Aucune fiche dans cette vue.</p>';
      return;
    }
    container.innerHTML = entries.map((entry) => {
      if (!entry.hasErrors) {
        return `
          <article class="localization-automation-entry">
            ${renderEntryHead(entry)}
            <div class="localization-automation-entry-links">
              ${entry.url ? `<a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener">Ouvrir sur Etsy</a>` : `<span>Listing ${escapeHtml(entry.listingId)}</span>`}
            </div>
          </article>
        `;
      }
      return `
        <details class="localization-automation-entry has-errors">
          <summary>${renderEntryHead(entry)}</summary>
          ${renderErrors(entry)}
        </details>
      `;
    }).join('');
  };

  const renderMetrics = () => {
    const node = query('localization-automation-metrics');
    if (!node) return;
    const entries = state.payload?.entries || [];
    const attention = entries.filter((entry) => entry.hasErrors || ['attention', 'error'].includes(entry.state)).length;
    const active = entries.filter((entry) => !['completed', 'attention', 'error'].includes(entry.state)).length;
    const completed = entries.filter((entry) => entry.state === 'completed').length;
    node.innerHTML = `
      <span>${entries.length} fiche${entries.length > 1 ? 's' : ''} suivie${entries.length > 1 ? 's' : ''}</span>
      <span>${active} en cours</span>
      <span>${attention} à contrôler</span>
      <span>${completed} terminée${completed > 1 ? 's' : ''}</span>
      <span>Contrôle Etsy : ${formatDuration(state.payload?.pollSeconds || 0)} · stabilité : ${formatDuration(state.payload?.stabilitySeconds || 0)}</span>
    `;
  };

  const render = () => {
    const kicker = query('localization-automation-kicker');
    if (kicker) kicker.textContent = `Automatisation · Collection ${shopLabel()}`;
    document.querySelectorAll('[data-js="localization-automation-filter"]').forEach((button) => {
      const selected = button.dataset.filter === state.filter;
      button.classList.toggle('is-active', selected);
      button.classList.toggle('btn-accent', selected);
      button.classList.toggle('btn-muted', !selected);
    });
    renderMetrics();
    renderEntries();
  };

  const loadDashboard = async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setStatus('Chargement de la file automatique…');
      state.payload = await fetchJson(shopUrl('/localization-automation/dashboard'));
      render();
      const attention = (state.payload.entries || []).filter((entry) => entry.hasErrors).length;
      setStatus(attention
        ? `${attention} fiche${attention > 1 ? 's nécessitent' : ' nécessite'} une intervention.`
        : 'Aucune erreur nécessitant une intervention.');
    } catch (error) {
      setStatus(`Lecture de l’automatisation impossible : ${error.message}`, true);
    }
  };

  const schedulePoll = () => {
    global.clearTimeout(state.pollTimer);
    if (!state.active) return;
    state.pollTimer = global.setTimeout(async () => {
      await loadDashboard({ quiet: true });
      schedulePoll();
    }, 5000);
  };

  const postAction = async (automationId, action, language = '') => {
    setStatus('Action en cours…');
    await fetchJson('/localization-automation/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automationId, action, language }),
    });
    await loadDashboard({ quiet: true });
  };

  const downloadReport = async (automationId) => {
    const report = await fetchJson(`/localization-automation/entry/export?id=${encodeURIComponent(automationId)}`);
    const listingId = report.automation?.listingId || automationId;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `localization-automation-${listingId}.json`;
    anchor.click();
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openSingleWorkflow = (listingId) => {
    global.PipelineUILocalizationBackfill?.switchView?.('single');
    const input = document.getElementById('col-translation-en-listing-ref');
    if (input) {
      input.value = String(listingId || '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
  };

  const handleClick = async (event) => {
    const filter = event.target.closest('[data-js="localization-automation-filter"]');
    if (filter) {
      state.filter = filter.dataset.filter || 'open';
      render();
      return;
    }
    if (event.target.closest('[data-js="localization-automation-refresh"]')) {
      await loadDashboard();
      return;
    }
    const actionButton = event.target.closest('[data-automation-action]');
    if (!actionButton) return;
    const action = actionButton.dataset.automationAction;
    try {
      if (action === 'export') await downloadReport(actionButton.dataset.automationId);
      else if (action === 'open_single') openSingleWorkflow(actionButton.dataset.listingId);
      else await postAction(actionButton.dataset.automationId, action, actionButton.dataset.language || '');
    } catch (error) {
      setStatus(`Action impossible : ${error.message}`, true);
    }
  };

  const activate = async (shopKey = state.shopKey) => {
    state.shopKey = shopKey === 'doublex' ? 'doublex' : 'grosgeek';
    state.active = true;
    await loadDashboard();
    schedulePoll();
  };

  const deactivate = () => {
    state.active = false;
    global.clearTimeout(state.pollTimer);
  };

  const init = () => {
    if (state.initialized || !query('localization-automation')) return;
    state.initialized = true;
    document.addEventListener('click', handleClick);
    global.addEventListener('pipeline:localization-view-changed', (event) => {
      if (event.detail?.view === 'automation') activate(event.detail?.shopKey).catch(() => {});
      else deactivate();
    });
    global.addEventListener('pipeline:shop-changed', (event) => {
      state.shopKey = event.detail?.shopKey === 'doublex' ? 'doublex' : 'grosgeek';
      if (state.active) activate(state.shopKey).catch(() => {});
    });
  };

  global.PipelineUILocalizationAutomation = Object.freeze({ init, activate, loadDashboard });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
