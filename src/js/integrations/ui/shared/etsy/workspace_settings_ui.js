(function initPipelineUIEtsyWorkspaceSettingsUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };
  const getNodeById = (id) => document.getElementById(id);
  const getNode = (deps, id) => deps.getNode?.(id) || getNodeById(id);
  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function renderSettingsStep(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    const host = getNode(deps, `etsyApiSettingsContent-${prefix}`);
    if (!state || !host) return;
    if (!state.mediaPayload) {
      host.innerHTML = '';
      return;
    }

    const draft = deps.ensureSettingsDraft?.(state);
    if (!draft) return;

    deps.applySettingsDraftToPayload?.(state);
    deps.syncPayloadText?.(state);

    const sections = Array.isArray(draft.shopSections) ? draft.shopSections : [];
    const isLoading = state.settingsReferencesLoading === true;
    const errorMessage = String(state.settingsReferencesError || '').trim();

    host.innerHTML = `
      <div class="etsy-api-settings-layout">
        <section class="etsy-api-settings-card">
          <div class="etsy-api-settings-card-head">
            <div>
              <h4>Sections de la boutique</h4>
              <p>Choisissez la section Etsy dans laquelle ranger le futur draft.</p>
            </div>
          </div>
          <div class="fg full">
            <label for="etsyApiSettingsSection-${prefix}">Section</label>
            <select id="etsyApiSettingsSection-${prefix}" data-js="etsy-settings-section" ${isLoading && !sections.length ? 'disabled' : ''}>
              ${sections.length ? sections.map((section) => `
                <option value="${escapeHtml(section.id)}" ${section.id === draft.shopSectionId ? 'selected' : ''}>${escapeHtml(section.title)}</option>
              `).join('') : `<option value="${escapeHtml(draft.shopSectionId || '')}">${isLoading ? 'Chargement des sections...' : 'Section source'}</option>`}
            </select>
          </div>
          ${errorMessage ? `<p class="etsy-api-field-hint">${escapeHtml(errorMessage)}</p>` : ''}
        </section>

        <section class="etsy-api-settings-card">
          <div class="etsy-api-settings-card-head">
            <div>
              <h4>Visibilite</h4>
              <p>Parametres simples de mise en avant et de promotion Etsy.</p>
            </div>
          </div>
          <div class="etsy-api-settings-switch-row">
            <div>
              <label>Mettre cette fiche produit a la une</label>
            </div>
            <label class="etsy-api-options-switch" aria-label="Mettre cette fiche produit a la une">
              <input type="checkbox" data-js="etsy-settings-featured" ${draft.featured ? 'checked' : ''}>
              <span class="etsy-api-options-switch-ui" aria-hidden="true"></span>
            </label>
          </div>
          <div class="etsy-api-settings-switch-row">
            <div>
              <label>Publicite sur Etsy</label>
            </div>
            <label class="etsy-api-options-switch" aria-label="Activer la publicite sur Etsy">
              <input type="checkbox" data-js="etsy-settings-advertise" ${draft.advertise ? 'checked' : ''}>
              <span class="etsy-api-options-switch-ui" aria-hidden="true"></span>
            </label>
          </div>
        </section>

        <section class="etsy-api-settings-card">
          <div class="etsy-api-settings-card-head">
            <div>
              <h4>Option de renouvellement</h4>
              <p>Choisissez si la fiche doit se renouveler automatiquement ou manuellement.</p>
            </div>
          </div>
          <div class="etsy-api-settings-radio-row">
            <label class="etsy-api-settings-radio-option">
              <input type="radio" name="etsySettingsRenewal-${prefix}" value="automatic" data-js="etsy-settings-renewal" ${draft.renewalOption !== 'manual' ? 'checked' : ''}>
              <span>Automatique</span>
            </label>
            <label class="etsy-api-settings-radio-option">
              <input type="radio" name="etsySettingsRenewal-${prefix}" value="manual" data-js="etsy-settings-renewal" ${draft.renewalOption === 'manual' ? 'checked' : ''}>
              <span>Manuel</span>
            </label>
          </div>
        </section>
      </div>
    `;

    host.querySelector('[data-js="etsy-settings-section"]')?.addEventListener('change', (event) => {
      deps.updateSettingsDraft?.(prefix, (nextDraft) => {
        nextDraft.shopSectionId = String(event.target.value || '');
      });
    });

    host.querySelector('[data-js="etsy-settings-featured"]')?.addEventListener('change', (event) => {
      deps.updateSettingsDraft?.(prefix, (nextDraft) => {
        nextDraft.featured = !!event.target.checked;
      });
    });

    host.querySelector('[data-js="etsy-settings-advertise"]')?.addEventListener('change', (event) => {
      deps.updateSettingsDraft?.(prefix, (nextDraft) => {
        nextDraft.advertise = !!event.target.checked;
      });
    });

    host.querySelectorAll('[data-js="etsy-settings-renewal"]').forEach((input) => {
      input.addEventListener('change', (event) => {
        deps.updateSettingsDraft?.(prefix, (nextDraft) => {
          nextDraft.renewalOption = String(event.target.value || 'automatic');
        });
      });
    });
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.settings = {
    ...(EtsyUI.shared.settings || {}),
    renderSettingsStep,
  };

  global.PipelineUIEtsyUI = EtsyUI;
})(window);
