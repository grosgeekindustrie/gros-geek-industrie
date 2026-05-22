(function initPipelineUIEtsyWorkspaceShippingUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };
  const getNodeById = (id) => document.getElementById(id);
  const getNode = (deps, id) => deps.getNode?.(id) || getNodeById(id);
  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function findOptionLabel(options, selectedId, fallbackLabel) {
    const selected = (Array.isArray(options) ? options : []).find((option) => option.id === selectedId);
    if (selected?.title) return selected.title;
    if (selected?.label) return selected.label;
    return fallbackLabel || (selectedId ? `ID ${selectedId}` : 'Aucun profil selectionne');
  }

  function renderShippingStep(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    const host = getNode(deps, `etsyApiShippingContent-${prefix}`);
    if (!state || !host) return;
    if (!state.mediaPayload) {
      host.innerHTML = '';
      return;
    }

    const draft = deps.ensureShippingDraft?.(state);
    if (!draft) return;

    deps.applyShippingDraftToPayload?.(state);
    deps.syncPayloadText?.(state);

    const processingProfiles = Array.isArray(draft.processingProfiles) ? draft.processingProfiles : [];
    const shippingProfiles = Array.isArray(draft.shippingProfiles) ? draft.shippingProfiles : [];
    const currentProcessingLabel = String(draft.processingProfileLabel || 'Profil de traitement source').trim();
    const currentProcessingMeta = String(draft.processingProfileMeta || '').trim();
    const currentShippingLabel = findOptionLabel(shippingProfiles, draft.shippingProfileId, 'Profil livraison de la fiche source');
    const isLoading = state.shippingReferencesLoading === true;
    const errorMessage = String(state.shippingReferencesError || '').trim();

    host.innerHTML = `
      <div class="etsy-api-shipping-layout">
        <section class="etsy-api-shipping-card">
          <div class="etsy-api-shipping-card-head">
            <div>
              <h4>Profil de traitement</h4>
              <p>Valeur chargee depuis la fiche source. Le changement de profil passera plus tard par un parcours dedie.</p>
            </div>
            <button class="btn btn-muted btn-xs-inline" type="button" data-js="etsy-shipping-processing-change">Changer de profil</button>
          </div>
          <div class="etsy-api-shipping-current">
            <span class="etsy-api-shipping-current-label">Profil source</span>
            <strong class="etsy-api-shipping-current-value">${escapeHtml(currentProcessingLabel)}</strong>
            ${currentProcessingMeta ? `<span class="etsy-api-shipping-current-meta">${escapeHtml(currentProcessingMeta)}</span>` : ''}
          </div>
        </section>

        <section class="etsy-api-shipping-card">
          <div class="etsy-api-shipping-card-head">
            <div>
              <h4>Option de livraison</h4>
              <p>Choix d'un profil de livraison existant. L'edition complete du profil reste dans Etsy.</p>
            </div>
            <button class="btn btn-muted btn-xs-inline" type="button" data-js="etsy-shipping-profile-toggle">${state.isEditingShippingProfile ? 'Fermer' : 'Modifier'}</button>
          </div>
          <div class="etsy-api-shipping-current">
            <span class="etsy-api-shipping-current-label">Profil selectionne</span>
            <strong class="etsy-api-shipping-current-value">${escapeHtml(currentShippingLabel)}</strong>
          </div>
          <div class="fg full ${state.isEditingShippingProfile ? '' : 'is-hidden'}">
            <label for="etsyApiShippingProfile-${prefix}">Profils disponibles</label>
            <select id="etsyApiShippingProfile-${prefix}" data-js="etsy-shipping-profile-select" ${isLoading && !shippingProfiles.length ? 'disabled' : ''}>
              ${shippingProfiles.length ? shippingProfiles.map((profile) => `
                <option value="${escapeHtml(profile.id)}" ${profile.id === draft.shippingProfileId ? 'selected' : ''}>${escapeHtml(profile.title)}</option>
              `).join('') : `<option value="${escapeHtml(draft.shippingProfileId || '')}">${isLoading ? 'Chargement des profils...' : 'Profil source'}</option>`}
            </select>
          </div>
          ${errorMessage ? `<p class="etsy-api-field-hint">${escapeHtml(errorMessage)}</p>` : ''}
        </section>
      </div>
    `;

    host.querySelector('[data-js="etsy-shipping-processing-change"]')?.addEventListener('click', () => {
      global.showToast?.('Changement de profil de traitement a brancher dans un parcours dedie.');
    });

    host.querySelector('[data-js="etsy-shipping-profile-toggle"]')?.addEventListener('click', () => {
      deps.setShippingProfileEditorOpen?.(prefix, !state.isEditingShippingProfile);
    });

    host.querySelector('[data-js="etsy-shipping-profile-select"]')?.addEventListener('change', (event) => {
      deps.updateShippingDraft?.(prefix, (nextDraft) => {
        nextDraft.shippingProfileId = String(event.target.value || '');
      });
    });
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.shipping = {
    ...(EtsyUI.shared.shipping || {}),
    renderShippingStep,
  };

  global.PipelineUIEtsyUI = EtsyUI;
})(window);
