(function initPipelineUIEtsyWorkspaceAttributesUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };
  const getData = () => global.PipelineUIEtsyData || {};
  const getNodeById = (id) => document.getElementById(id);
  const getNode = (deps, id) => deps.getNode?.(id) || getNodeById(id);
  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const getTagLengthTone = (length, maxLength) => (length > maxLength ? ' is-overflow' : ' is-valid');

  function commitTagsInput(prefix, rawValue, deps = {}) {
    const data = getData();
    const nextTags = data.parseAttributeTagsInput?.(rawValue) || [];
    deps.updateAttributesDraft?.(prefix, (draft) => {
      draft.tags = nextTags;
      draft.pendingTagsInput = '';
    });
    renderAttributesStep(prefix, deps);
  }

  function renderAttributesStep(prefix, deps = {}) {
    const data = getData();
    const state = deps.getState?.(prefix);
    const host = getNode(deps, `etsyApiAttributesContent-${prefix}`);
    if (!state || !host) return;

    const draft = deps.ensureAttributesDraft?.(state);
    if (!draft) return;

    deps.applyAttributesDraftToPayload?.(state);
    deps.syncPayloadText?.(state);

    host.innerHTML = `
      <div class="etsy-api-attributes-layout">
        <section class="etsy-api-attributes-card">
          <div class="etsy-api-attributes-card-head">
            <div>
              <h4>Tags</h4>
              <p>13 tags maximum, 30 caracteres par tag, separes par des virgules.</p>
            </div>
            <span class="etsy-api-attributes-meta">${draft.tags.length} / ${(data.ETSY_MAX_TAGS || 13)}</span>
          </div>
          <div class="fg full">
            <label for="etsyApiAttributesTagsInput-${prefix}">Saisie tags</label>
            <input
              type="text"
              id="etsyApiAttributesTagsInput-${prefix}"
              data-js="etsy-attributes-tags-input"
              placeholder="ex: miniature, decor halloween, cadeau geek"
              value="${escapeHtml(draft.pendingTagsInput || '')}"
            />
            <p class="etsy-api-field-hint">Appuyez sur Entree pour valider la liste. Les tags trop longs sont ignores, seuls les 13 premiers valides sont conserves.</p>
            <div class="etsy-api-title-meta">
              <span class="etsy-api-title-count${getTagLengthTone(String(draft.pendingTagsInput || '').length, data.ETSY_MAX_TAG_LENGTH || 30)}" data-js="etsy-attributes-pending-tags-count">${String(draft.pendingTagsInput || '').length} / ${data.ETSY_MAX_TAG_LENGTH || 30}</span>
            </div>
          </div>
          <div class="etsy-api-attribute-tags" id="etsyApiAttributesTagsList-${prefix}">
            ${draft.tags.length ? draft.tags.map((tag, index) => `
              <div class="etsy-api-attribute-tag-item">
                <div class="etsy-api-attribute-tag-edit-wrap">
                  <input
                    type="text"
                    maxlength="${data.ETSY_MAX_TAG_LENGTH || 30}"
                    data-js="etsy-attributes-tag-edit"
                    data-tag-index="${index}"
                    value="${escapeHtml(tag || '')}"
                  />
                  <span class="etsy-api-title-count${getTagLengthTone(String(tag || '').length, data.ETSY_MAX_TAG_LENGTH || 30)}" data-js="etsy-attributes-tag-count" data-tag-index="${index}">${String(tag || '').length} / ${data.ETSY_MAX_TAG_LENGTH || 30}</span>
                </div>
                <button class="etsy-api-attribute-tag-remove" type="button" data-js="etsy-attributes-tag-remove" data-tag-index="${index}" aria-label="Supprimer le tag">
                  ${global.PipelineUIIcons?.renderIcon?.('close') || 'x'}
                </button>
              </div>
            `).join('') : '<p class="etsy-api-attributes-empty">Aucun tag valide pour le moment.</p>'}
          </div>
        </section>

        <section class="etsy-api-attributes-card" hidden>
          <div class="etsy-api-attributes-card-head">
            <div>
              <h4>Dimensions</h4>
              <p>Structure alignee sur les champs Etsy de dimensions produit.</p>
            </div>
          </div>
          <div class="etsy-api-attributes-dimensions">
            <div class="fg">
              <label for="etsyApiAttributeHeight-${prefix}">Hauteur</label>
              <input type="number" min="0" step="0.1" id="etsyApiAttributeHeight-${prefix}" data-js="etsy-attributes-dimension" data-dimension-field="height" value="${draft.dimensions?.height || ''}" />
            </div>
            <div class="fg">
              <label for="etsyApiAttributeWidth-${prefix}">Largeur</label>
              <input type="number" min="0" step="0.1" id="etsyApiAttributeWidth-${prefix}" data-js="etsy-attributes-dimension" data-dimension-field="width" value="${draft.dimensions?.width || ''}" />
            </div>
            <div class="fg">
              <label for="etsyApiAttributeDepth-${prefix}">Profondeur</label>
              <input type="number" min="0" step="0.1" id="etsyApiAttributeDepth-${prefix}" data-js="etsy-attributes-dimension" data-dimension-field="depth" value="${draft.dimensions?.depth || ''}" />
            </div>
            <div class="fg">
              <label for="etsyApiAttributeUnit-${prefix}">Unite</label>
              <select id="etsyApiAttributeUnit-${prefix}" data-js="etsy-attributes-dimension-unit">
                ${(data.ATTRIBUTE_DIMENSION_UNITS || []).map((option) => `
                  <option value="${option.value}" ${option.value === draft.dimensions?.unit ? 'selected' : ''}>${option.label}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </section>

        <section class="etsy-api-attributes-card">
          <div class="etsy-api-attributes-card-head">
            <div>
              <h4>Fete</h4>
              <p>Champ local de preparation avant branchement complet aux proprietes de taxonomie Etsy.</p>
            </div>
          </div>
          <div class="fg full">
            <label for="etsyApiAttributeOccasion-${prefix}">Fete principale</label>
            <select id="etsyApiAttributeOccasion-${prefix}" data-js="etsy-attributes-occasion">
              ${(data.ATTRIBUTE_OCCASION_OPTIONS || []).map((option) => `
                <option value="${option.value}" ${option.value === draft.occasion ? 'selected' : ''}>${option.label}</option>
              `).join('')}
            </select>
          </div>
        </section>
      </div>
    `;

    const tagsInput = host.querySelector('[data-js="etsy-attributes-tags-input"]');
    tagsInput?.addEventListener('input', (event) => {
      deps.updateAttributesDraft?.(prefix, (nextDraft) => {
        nextDraft.pendingTagsInput = String(event.target.value || '');
      });
      const countNode = host.querySelector('[data-js="etsy-attributes-pending-tags-count"]');
      if (countNode) {
        const length = String(event.target.value || '').length;
        countNode.textContent = `${length} / ${data.ETSY_MAX_TAG_LENGTH || 30}`;
        countNode.classList.toggle('is-overflow', length > (data.ETSY_MAX_TAG_LENGTH || 30));
        countNode.classList.toggle('is-valid', length <= (data.ETSY_MAX_TAG_LENGTH || 30));
      }
    });
    tagsInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commitTagsInput(prefix, event.target.value || '', deps);
    });

    host.querySelectorAll('[data-js="etsy-attributes-tag-remove"]').forEach((button) => {
      button.addEventListener('click', () => {
        const tagIndex = Number.parseInt(String(button.dataset.tagIndex || '-1'), 10);
        if (tagIndex < 0) return;
        deps.updateAttributesDraft?.(prefix, (nextDraft) => {
          nextDraft.tags = (nextDraft.tags || []).filter((_, index) => index !== tagIndex);
        });
        renderAttributesStep(prefix, deps);
      });
    });

    host.querySelectorAll('[data-js="etsy-attributes-tag-edit"]').forEach((input) => {
      input.addEventListener('input', (event) => {
        const tagIndex = Number.parseInt(String(input.dataset.tagIndex || '-1'), 10);
        if (tagIndex < 0) return;
        const normalized = String(event.target.value || '').slice(0, data.ETSY_MAX_TAG_LENGTH || 30);
        deps.updateAttributesDraft?.(prefix, (nextDraft) => {
          nextDraft.tags[tagIndex] = normalized;
        });
        const countNode = host.querySelector(`[data-js="etsy-attributes-tag-count"][data-tag-index="${tagIndex}"]`);
        if (countNode) {
          countNode.textContent = `${normalized.length} / ${data.ETSY_MAX_TAG_LENGTH || 30}`;
          countNode.classList.toggle('is-overflow', normalized.length > (data.ETSY_MAX_TAG_LENGTH || 30));
          countNode.classList.toggle('is-valid', normalized.length <= (data.ETSY_MAX_TAG_LENGTH || 30));
        }
      });
      input.addEventListener('blur', (event) => {
        const tagIndex = Number.parseInt(String(input.dataset.tagIndex || '-1'), 10);
        if (tagIndex < 0) return;
        deps.updateAttributesDraft?.(prefix, (nextDraft) => {
          const normalized = data.normalizeAttributeTag?.(event.target.value || '') || '';
          if (!normalized) {
            nextDraft.tags = (nextDraft.tags || []).filter((_, index) => index !== tagIndex);
            return;
          }
          nextDraft.tags[tagIndex] = normalized;
        });
        renderAttributesStep(prefix, deps);
      });
    });

    host.querySelectorAll('[data-js="etsy-attributes-dimension"]').forEach((input) => {
      input.addEventListener('input', (event) => {
        const fieldName = String(event.target.dataset.dimensionField || '').trim();
        if (!fieldName) return;
        deps.updateAttributesDraft?.(prefix, (nextDraft) => {
          nextDraft.dimensions[fieldName] = String(event.target.value || '');
        });
      });
    });

    host.querySelector('[data-js="etsy-attributes-dimension-unit"]')?.addEventListener('change', (event) => {
      deps.updateAttributesDraft?.(prefix, (nextDraft) => {
        nextDraft.dimensions.unit = String(event.target.value || '');
      });
    });

    host.querySelector('[data-js="etsy-attributes-occasion"]')?.addEventListener('change', (event) => {
      deps.updateAttributesDraft?.(prefix, (nextDraft) => {
        nextDraft.occasion = String(event.target.value || '');
      });
    });
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.attributes = {
    ...(EtsyUI.shared.attributes || {}),
    commitTagsInput,
    renderAttributesStep,
  };

  global.PipelineUIEtsyUI = EtsyUI;
})(window);
