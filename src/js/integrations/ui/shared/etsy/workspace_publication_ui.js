(function initPipelineUIEtsyWorkspacePublicationUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };
  const getNodeById = (id) => document.getElementById(id);
  const getNode = (deps, id) => deps.getNode?.(id) || getNodeById(id);
  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const MAX_DEBUG_STRING_LENGTH = 250;

  function getDisplayPayloadValue(value, keyPath = []) {
    if (typeof value === 'string') {
      const currentKey = String(keyPath[keyPath.length - 1] || '').trim().toLowerCase();
      const shouldKeepFull = currentKey === 'description';
      if (!shouldKeepFull && value.length > MAX_DEBUG_STRING_LENGTH) {
        return `${value.slice(0, MAX_DEBUG_STRING_LENGTH)}… [${value.length} chars]`;
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((entry, index) => getDisplayPayloadValue(entry, [...keyPath, String(index)]));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, entryValue]) => [
          key,
          getDisplayPayloadValue(entryValue, [...keyPath, key]),
        ])
      );
    }

    return value;
  }

  function renderPublicationStep(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    const host = getNode(deps, `etsyApiPublicationContent-${prefix}`);
    if (!state || !host) return;

    const snapshot = deps.buildPublicationPayloadSnapshot?.(state) || {};
    const payloadText = JSON.stringify(getDisplayPayloadValue(snapshot.payload || {}), null, 2);
    const validationErrors = Array.isArray(snapshot.validationErrors) ? snapshot.validationErrors : [];
    const warnings = Array.isArray(snapshot.warnings) ? snapshot.warnings : [];
    const publicationResult = state.publicationResult ? JSON.stringify(getDisplayPayloadValue(state.publicationResult), null, 2) : '';
    const publicationError = String(state.publicationError || '').trim();

    host.innerHTML = `
      <div class="etsy-api-publication-layout">
        <section class="etsy-api-publication-card">
          <div class="etsy-api-publication-card-head">
            <div>
              <h4>Plan de publication Etsy</h4>
              <p>Creation du draft puis enrichissement progressif. Le listing source n est jamais ecrase.</p>
            </div>
            <button class="btn btn-accent" type="button" data-js="etsy-publication-submit" ${state.publicationSubmitting ? 'disabled' : ''}>${state.publicationSubmitting ? 'Publication...' : 'Publier en draft'}</button>
          </div>
          <div class="etsy-api-publication-meta">
            <span class="etsy-api-publication-meta-item">Listing source: ${escapeHtml(snapshot.sourceListingId || 'aucun')}</span>
            <span class="etsy-api-publication-meta-item">Mode: duplication en draft</span>
          </div>
          ${warnings.length ? `<div class="etsy-api-publication-notes">${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join('')}</div>` : ''}
          ${validationErrors.length ? `<div class="etsy-api-publication-errors">${validationErrors.map((error) => `<p>${escapeHtml(error)}</p>`).join('')}</div>` : ''}
          <pre class="etsy-api-publication-json">${escapeHtml(payloadText)}</pre>
        </section>

        <section class="etsy-api-publication-card">
          <div class="etsy-api-publication-card-head">
            <div>
              <h4>Retour publication</h4>
              <p>Reponse brute Etsy ou erreur backend pour la duplication draft.</p>
            </div>
          </div>
          ${publicationError ? `<div class="etsy-api-publication-errors"><p>${escapeHtml(publicationError)}</p></div>` : ''}
          <pre class="etsy-api-publication-json">${escapeHtml(publicationResult || 'Aucune publication envoyee pour le moment.')}</pre>
        </section>
      </div>
    `;

    host.querySelector('[data-js="etsy-publication-submit"]')?.addEventListener('click', () => {
      deps.publishDraftListing?.(prefix);
    });
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.publication = {
    ...(EtsyUI.shared.publication || {}),
    renderPublicationStep,
  };

  global.PipelineUIEtsyUI = EtsyUI;
})(window);
