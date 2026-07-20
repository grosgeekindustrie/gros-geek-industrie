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
  const SHOP_LABELS = Object.freeze({
    grosgeek: 'Gros Geek Industrie',
    doublex: 'DoubleXindustrie',
  });

  function normalizeShopKey(shopKey = '') {
    return String(shopKey || '').trim() === 'doublex' ? 'doublex' : 'grosgeek';
  }

  function getShopLabel(shopKey = '') {
    return SHOP_LABELS[normalizeShopKey(shopKey)] || SHOP_LABELS.grosgeek;
  }

  function getDisplayPayloadValue(value, keyPath = []) {
    if (typeof value === 'string') {
      const currentKey = String(keyPath[keyPath.length - 1] || '').trim().toLowerCase();
      if (currentKey === 'data_url' || currentKey === 'remote_url') {
        return `[omitted ${currentKey} - ${value.length} chars]`;
      }
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
    const publicationMode = deps.getPublicationMode?.(state) || 'create_draft';
    const isUpdateMode = publicationMode === 'update_listing';
    const isExpiredUpdateMode = publicationMode === 'update_expired_listing';
    const isDirectUpdateMode = isUpdateMode || isExpiredUpdateMode;
    const sourceShopKey = normalizeShopKey(state.sourceShopKey || deps.getActiveShopKey?.() || 'grosgeek');
    const primaryPublishShopKey = normalizeShopKey(
      deps.getPublicationTargetShopKey?.(state, {
        getActiveShopKey: deps.getActiveShopKey,
      }) || sourceShopKey
    );
    const canTransferToDoublex = sourceShopKey === 'grosgeek';
    const transferTargetShopKey = 'doublex';
    const transferDisabled = state.publicationSubmitting || publicationMode !== 'create_draft';
    const sourceListingState = String(snapshot.sourceListingState || state.sourceListingState || '').trim().toLowerCase();
    const publishButtonLabel = state.publicationSubmitting
      ? (isDirectUpdateMode ? 'Mise a jour...' : 'Publication...')
      : (isExpiredUpdateMode ? 'Mettre a jour la fiche expiree' : (isUpdateMode ? 'Mettre a jour la fiche' : 'Publier en draft'));
    const transferButtonLabel = state.publicationSubmitting ? 'Publication DoubleXindustrie...' : 'Publier en draft sur DoubleXindustrie';
    const modeNotes = isDirectUpdateMode
      ? [
        isExpiredUpdateMode
          ? 'Mode fiche expiree : met a jour la fiche expiree chargee, sans publication automatique.'
          : 'Mode mise a jour : cible la fiche chargee et non un nouveau draft.',
        'Scope actuel : titre, description, tags, images, video et ALT.',
      ]
      : [
        'Mode creation draft : duplique la fiche chargee vers un nouveau draft Etsy.',
        ...(canTransferToDoublex ? ['Transfert inter-boutique : ce contexte Gros Geek peut aussi creer un draft sur DoubleXindustrie.'] : []),
      ];
    const payloadText = JSON.stringify(getDisplayPayloadValue(snapshot.payload || {}), null, 2);
    const validationErrors = Array.isArray(snapshot.validationErrors) ? snapshot.validationErrors : [];
    const warnings = [...modeNotes, ...(Array.isArray(snapshot.warnings) ? snapshot.warnings : [])];
    const publicationResult = state.publicationResult ? JSON.stringify(getDisplayPayloadValue(state.publicationResult), null, 2) : '';
    const publicationError = String(state.publicationError || '').trim();

    host.innerHTML = `
      <div class="etsy-api-publication-layout ${isDirectUpdateMode ? 'etsy-api-publication-layout-update' : 'etsy-api-publication-layout-create'}">
        <section class="etsy-api-publication-card ${isDirectUpdateMode ? 'etsy-api-publication-card-update' : ''}">
          <div class="etsy-api-publication-card-head">
            <div>
              <h4>Plan de publication Etsy</h4>
              <p>${isDirectUpdateMode ? 'Mise a jour editoriale et media de la fiche chargee.' : 'Creation du draft puis enrichissement progressif. Le listing source n est jamais ecrase.'}</p>
            </div>
            <div class="etsy-api-publication-actions">
              <button class="btn ${isDirectUpdateMode ? 'btn-warn' : 'btn-accent'}" type="button" data-js="etsy-publication-submit" data-target-shop="${escapeHtml(primaryPublishShopKey)}" ${state.publicationSubmitting ? 'disabled' : ''}>${publishButtonLabel}</button>
              ${canTransferToDoublex ? `<button class="btn btn-muted" type="button" data-js="etsy-publication-transfer-submit" data-target-shop="${transferTargetShopKey}" ${transferDisabled ? 'disabled' : ''}>${transferButtonLabel}</button>` : ''}
            </div>
          </div>
          <div class="etsy-api-publication-mode-switch" role="group" aria-label="Mode publication Etsy">
            <button class="btn ${!isDirectUpdateMode ? 'btn-accent' : 'btn-muted'}" type="button" data-js="etsy-publication-mode" data-mode="create_draft">Creation draft</button>
            <button class="btn ${isUpdateMode ? 'btn-warn' : 'btn-muted'}" type="button" data-js="etsy-publication-mode" data-mode="update_listing">Mise a jour fiche</button>
            <button class="btn ${isExpiredUpdateMode ? 'btn-warn' : 'btn-muted'}" type="button" data-js="etsy-publication-mode" data-mode="update_expired_listing">Mise a jour fiche expiree</button>
          </div>
          ${isDirectUpdateMode ? `<div class="etsy-api-publication-mode-banner">${isExpiredUpdateMode ? 'Mode fiche expiree actif : la fiche Etsy expiree chargee sera modifiee sans publication automatique.' : 'Mode mise a jour actif : la fiche Etsy chargee sera modifiee directement.'}</div>` : ''}
          <div class="etsy-api-publication-meta">
            <span class="etsy-api-publication-meta-item">Listing source: ${escapeHtml(snapshot.sourceListingId || 'aucun')}</span>
            <span class="etsy-api-publication-meta-item">Boutique source: ${escapeHtml(getShopLabel(sourceShopKey))}</span>
            <span class="etsy-api-publication-meta-item">Boutique publication: ${escapeHtml(getShopLabel(primaryPublishShopKey))}</span>
            <span class="etsy-api-publication-meta-item">Etat source: ${escapeHtml(sourceListingState || 'inconnu')}</span>
            <span class="etsy-api-publication-meta-item">Mode: ${isExpiredUpdateMode ? 'mise a jour de fiche expiree' : (isUpdateMode ? 'mise a jour de fiche' : 'duplication en draft')}</span>
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

    host.querySelectorAll('[data-js="etsy-publication-mode"]').forEach((button) => {
      button.addEventListener('click', () => {
        deps.setPublicationMode?.(prefix, String(button.dataset.mode || 'create_draft'));
      });
    });
    host.querySelector('[data-js="etsy-publication-submit"]')?.addEventListener('click', () => {
      const targetShopKey = host.querySelector('[data-js="etsy-publication-submit"]')?.dataset.targetShop || primaryPublishShopKey;
      deps.publishDraftListing?.(prefix, { targetShopKey });
    });
    host.querySelector('[data-js="etsy-publication-transfer-submit"]')?.addEventListener('click', () => {
      deps.publishDraftListing?.(prefix, {
        targetShopKey: transferTargetShopKey,
        modeOverride: 'create_draft',
      });
    });
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.publication = {
    ...(EtsyUI.shared.publication || {}),
    renderPublicationStep,
  };

  global.PipelineUIEtsyUI = EtsyUI;
})(window);
