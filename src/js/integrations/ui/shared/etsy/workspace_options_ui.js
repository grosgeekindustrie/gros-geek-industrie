(function initPipelineUIEtsyWorkspaceOptionsUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };

  function openOptionsModal(prefix, deps = {}) {
    deps.ensureOptionsOverlays?.();
    const overlay = deps.getNode?.(deps.OPTIONS_MODAL_ID);
    if (!overlay) return;

    deps.setOptionsModalState?.({
      prefix,
      workingVariation: null,
    });
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    deps.renderOptionsModalState?.(prefix);
  }

  function openOptionTypePicker(deps = {}) {
    const modalState = deps.getOptionsModalState?.();
    const prefix = modalState?.prefix;
    if (!prefix) return;

    deps.ensureOptionsOverlays?.();
    const overlay = deps.getNode?.(deps.OPTIONS_TYPE_PICKER_ID);
    const host = deps.getNode?.('etsyOptionsTypeContent');
    if (!overlay || !host) return;

    host.innerHTML = (deps.optionTypeSuggestions || []).map((label) => `
      <button class="etsy-options-type-item" type="button" data-js="etsy-options-preset" data-label="${label}">
        <span>${label}</span>
      </button>
    `).join('');
    host.querySelectorAll('[data-js="etsy-options-preset"]').forEach((button) => {
      button.addEventListener('click', () => deps.openOptionEditor?.('', button.dataset.label || ''));
    });

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function renderOptionEditorPhotos(prefix, workingVariation, photoAssignments, deps = {}) {
    const imageChoices = deps.getWorkspaceImageChoices?.(prefix) || [];

    if (!workingVariation.photosEnabled) {
      photoAssignments.innerHTML = '';
      photoAssignments.hidden = true;
      return;
    }

    if (!(workingVariation.options || []).length) {
      photoAssignments.hidden = false;
      photoAssignments.innerHTML = '<p class="etsy-options-editor-empty-copy">Ajoutez au moins une option avant d\'associer des photos.</p>';
      return;
    }

    if (!imageChoices.length) {
      photoAssignments.hidden = false;
      photoAssignments.innerHTML = '<p class="etsy-options-editor-empty-copy">Chargez d\'abord des images dans le step Photo et video.</p>';
      return;
    }

    photoAssignments.hidden = false;
    photoAssignments.innerHTML = `
      <div class="etsy-options-editor-photo-head">
        <div>
          <h4>Photos associees</h4>
          <p>Choisissez une image de la fiche source pour chaque option.</p>
        </div>
      </div>
      <div class="etsy-options-editor-photo-list">
        ${(workingVariation.options || []).map((option) => {
          const assignedImage = deps.getOptionAssignedImage?.(prefix, option);
          return `
            <div class="etsy-options-editor-photo-row">
              <div class="etsy-options-editor-photo-copy">
                <span class="etsy-options-editor-photo-label">${option.label}</span>
                ${assignedImage ? `<img class="etsy-options-editor-photo-preview" src="${assignedImage.previewSrc}" alt="${option.label}">` : '<span class="etsy-options-editor-photo-empty">Aucune photo</span>'}
              </div>
              <select data-js="etsy-options-editor-option-photo" data-option-id="${option.id}">
                <option value="">Aucune photo</option>
                ${imageChoices.map((choice) => `<option value="${choice.key}" ${choice.key === option.imageKey ? 'selected' : ''}>${choice.label}</option>`).join('')}
              </select>
            </div>
          `;
        }).join('')}
      </div>
    `;

    photoAssignments.querySelectorAll('[data-js="etsy-options-editor-option-photo"]').forEach((select) => {
      select.addEventListener('change', (event) => {
        const option = (workingVariation.options || []).find((item) => item.id === select.dataset.optionId);
        if (!option) return;
        option.imageKey = String(event.target.value || '').trim();
        deps.renderOptionEditorPhotos?.(prefix, workingVariation, photoAssignments);
      });
    });
  }

  function renderOptionEditorState(deps = {}) {
    const modalState = deps.getOptionsModalState?.();
    const prefix = modalState?.prefix;
    const workingVariation = modalState?.workingVariation;
    const list = deps.getNode?.('etsyOptionsEditorOptions');
    const photoAssignments = deps.getNode?.('etsyOptionsEditorPhotoAssignments');
    const addButton = deps.getNode?.(deps.OPTIONS_EDITOR_ID)?.querySelector('[data-js="etsy-options-editor-save"]');
    const deleteButton = deps.getNode?.(deps.OPTIONS_EDITOR_ID)?.querySelector('[data-js="etsy-options-editor-delete"]');
    if (!prefix || !workingVariation || !list || !photoAssignments) return;

    if (modalState.optionSortable?.destroy) {
      try {
        modalState.optionSortable.destroy();
      } catch (error) {}
      modalState.optionSortable = null;
    }

    list.innerHTML = (workingVariation.options || []).map((option) => `
      <div class="etsy-options-editor-option-row" data-option-id="${option.id}">
        <div class="etsy-options-editor-option-main">
          <button class="etsy-options-editor-drag-handle" type="button" data-js="etsy-options-editor-drag" aria-label="Reordonner l'option">
            ${global.PipelineUIIcons?.renderIcon?.('grip') || '::'}
          </button>
          <span class="etsy-options-editor-option-label">${option.label}</span>
        </div>
        <button class="btn btn-error btn-xs-inline" type="button" data-js="etsy-options-editor-remove-option" data-option-id="${option.id}">Supprimer</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-js="etsy-options-editor-remove-option"]').forEach((button) => {
      button.addEventListener('click', () => {
        workingVariation.options = (workingVariation.options || []).filter((option) => option.id !== button.dataset.optionId);
        deps.renderOptionEditorState?.();
      });
    });

    deps.renderOptionEditorPhotos?.(prefix, workingVariation, photoAssignments);

    if (deleteButton) {
      deleteButton.style.display = modalState?.isNewVariation ? 'none' : '';
    }

    if (addButton) {
      addButton.disabled = !String(workingVariation.name || '').trim() || !(workingVariation.options || []).length;
    }

    const SortableCtor = deps.getSortableCtor?.();
    if (SortableCtor && workingVariation.options.length > 1) {
      modalState.optionSortable = SortableCtor.create(list, {
        animation: 160,
        draggable: '.etsy-options-editor-option-row',
        handle: '[data-js="etsy-options-editor-drag"]',
        dataIdAttr: 'data-option-id',
        ghostClass: 'etsy-options-editor-sortable-ghost',
        chosenClass: 'etsy-options-editor-sortable-chosen',
        dragClass: 'etsy-options-editor-sortable-drag',
        onEnd: (event) => {
          const fromIndex = Number(event.oldDraggableIndex);
          const toIndex = Number(event.newDraggableIndex);
          if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex === toIndex) return;

          const nextOptions = [...workingVariation.options];
          const [movedOption] = nextOptions.splice(fromIndex, 1);
          if (!movedOption) return;
          nextOptions.splice(toIndex, 0, movedOption);
          workingVariation.options = nextOptions;
          deps.renderOptionEditorPhotos?.(prefix, workingVariation, photoAssignments);
        },
      });
    }
  }

  function openOptionEditor(variationId = '', presetName = '', deps = {}) {
    const modalState = deps.getOptionsModalState?.();
    const prefix = modalState?.prefix;
    if (!prefix) return;

    const state = deps.getState?.(prefix);
    const draft = deps.ensureOptionsDraft?.(state);
    if (!draft) return;

    let workingVariation = variationId
      ? JSON.parse(JSON.stringify((draft.variations || []).find((item) => item.id === variationId) || null))
      : null;
    const isNewVariation = !workingVariation;

    if (!workingVariation) {
      const slot = (draft.variations || []).length;
      if (slot >= 2) return;
      workingVariation = {
        id: `variation-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        propertyId: deps.customVariationPropertyIds?.[slot] || `${slot + 1}`,
        slot,
        name: String(presetName || '').trim(),
        photosEnabled: false,
        isCustom: true,
        options: [],
      };
    }

    deps.setOptionsModalState?.({
      prefix,
      workingVariation,
      isNewVariation,
    });

    deps.ensureOptionsOverlays?.();
    const overlay = deps.getNode?.(deps.OPTIONS_EDITOR_ID);
    const nameInput = deps.getNode?.('etsyOptionsEditorName');
    const photosInput = deps.getNode?.('etsyOptionsEditorPhotos');
    const optionInput = deps.getNode?.('etsyOptionsEditorOptionInput');
    if (!overlay || !nameInput || !photosInput || !optionInput) return;

    nameInput.value = workingVariation.name || '';
    photosInput.checked = !!workingVariation.photosEnabled;
    optionInput.value = '';
    deps.renderOptionEditorState?.();

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    nameInput.focus();
  }

  function renderOptionsModalState(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    const draft = deps.ensureOptionsDraft?.(state);
    const host = deps.getNode?.('etsyOptionsModalContent');
    if (!host || !draft) return;

    const variations = Array.isArray(draft.variations) ? draft.variations : [];
    const ruleOptions = deps.buildVariationRuleOptions?.(variations) || [];
    if (!variations.length) {
      host.innerHTML = `
        <div class="etsy-options-empty-state">
          <p class="etsy-options-empty-title">Vous n'avez aucune variation</p>
          <p class="etsy-options-empty-copy">Utilisez des variations si votre article est propose en differentes couleurs, tailles ou materiaux.</p>
        </div>
      `;
      return;
    }

    const cards = variations.map((variation) => `
      <div class="etsy-options-variation-card">
        <div class="etsy-options-variation-copy">
          <h4>${variation.name}</h4>
          <p>${variation.options.length} option(s)</p>
          ${variation.photosEnabled ? '<p class="etsy-options-variation-flag">Photos associees</p>' : ''}
          <div class="etsy-options-variation-chips">${variation.options.map((option) => `<span class="etsy-options-chip">${option.label}</span>`).join('')}</div>
        </div>
        <div class="etsy-options-variation-actions">
          <button class="btn btn-muted btn-xs-inline" type="button" data-js="etsy-options-edit-variation" data-variation-id="${variation.id}">Modifier</button>
          <button class="btn btn-error btn-xs-inline" type="button" data-js="etsy-options-delete-variation" data-variation-id="${variation.id}">Supprimer</button>
        </div>
      </div>
    `).join('');

    const buildRuleRow = (label, toggleId, selectId, values) => `
      <div class="etsy-options-setting-row">
        <label class="etsy-options-setting-main">
          <input type="checkbox" id="${toggleId}" ${values.length ? 'checked' : ''}/>
          <span>${label}</span>
        </label>
        <select id="${selectId}" ${values.length ? '' : 'disabled'}>
          ${ruleOptions.map((option) => `<option value="${option.value}" ${deps.serializeVariationRuleIds?.(values, variations) === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
        </select>
      </div>
    `;

    host.innerHTML = `
      <div class="etsy-options-variation-list">${cards}</div>
      <div class="etsy-options-settings">
        ${buildRuleRow('Les prix varient pour chaque', 'etsyOptionsPriceVaryEnabled', 'etsyOptionsPriceVary', deps.normalizeVariationRuleIds?.(draft.priceVariesByIds, variations) || [])}
        ${buildRuleRow('Les profils de traitement varient', 'etsyOptionsProcessingVaryEnabled', 'etsyOptionsProcessingVary', deps.normalizeVariationRuleIds?.(draft.processingProfileVariesByIds, variations) || [])}
        ${buildRuleRow('Les quantites varient', 'etsyOptionsQuantityVaryEnabled', 'etsyOptionsQuantityVary', deps.normalizeVariationRuleIds?.(draft.quantityVariesByIds, variations) || [])}
        ${buildRuleRow('Les references varient pour chaque', 'etsyOptionsSkuVaryEnabled', 'etsyOptionsSkuVary', deps.normalizeVariationRuleIds?.(draft.skuVariesByIds, variations) || [])}
      </div>
    `;

    host.querySelectorAll('[data-js="etsy-options-edit-variation"]').forEach((button) => {
      button.addEventListener('click', () => deps.openOptionEditor?.(button.dataset.variationId || ''));
    });

    host.querySelectorAll('[data-js="etsy-options-delete-variation"]').forEach((button) => {
      button.addEventListener('click', () => {
        deps.updateOptionsDraft?.(prefix, (nextDraft) => {
          nextDraft.variations = (nextDraft.variations || []).filter((item) => item.id !== button.dataset.variationId);
        });
        deps.renderOptionsModalState?.(prefix);
        deps.renderOptionsStep?.(prefix);
      });
    });

    const bindRuleToggle = (toggleSelector, selectSelector, fieldName) => {
      host.querySelector(toggleSelector)?.addEventListener('change', (event) => {
        deps.updateOptionsDraft?.(prefix, (nextDraft) => {
          nextDraft[fieldName] = event.target.checked
            ? deps.parseVariationRuleValue?.(host.querySelector(selectSelector)?.value || variations[0]?.id || '', variations)
            : [];
        });
        deps.renderOptionsModalState?.(prefix);
        deps.renderOptionsStep?.(prefix);
      });

      host.querySelector(selectSelector)?.addEventListener('change', (event) => {
        deps.updateOptionsDraft?.(prefix, (nextDraft) => {
          nextDraft[fieldName] = deps.parseVariationRuleValue?.(event.target.value || '', variations);
        });
        deps.renderOptionsModalState?.(prefix);
        deps.renderOptionsStep?.(prefix);
      });
    };

    bindRuleToggle('#etsyOptionsPriceVaryEnabled', '#etsyOptionsPriceVary', 'priceVariesByIds');
    bindRuleToggle('#etsyOptionsProcessingVaryEnabled', '#etsyOptionsProcessingVary', 'processingProfileVariesByIds');
    bindRuleToggle('#etsyOptionsQuantityVaryEnabled', '#etsyOptionsQuantityVary', 'quantityVariesByIds');
    bindRuleToggle('#etsyOptionsSkuVaryEnabled', '#etsyOptionsSkuVary', 'skuVariesByIds');
  }

  function renderOptionsStep(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    const host = deps.getNode?.(`etsyApiOptionsContent-${prefix}`);
    if (!state || !host) return;

    const draft = deps.ensureOptionsDraft?.(state);
    deps.applyOptionsDraftToPayload?.(state);
    deps.syncPayloadText?.(state);
    deps.syncWorkspacePayloadView?.(prefix);

    const variations = Array.isArray(draft?.variations) ? draft.variations : [];
    if (!variations.length) {
      host.innerHTML = `
        <div class="etsy-api-options-empty">
          <p class="etsy-api-options-empty-title">Aucune variation pour le moment</p>
          <p class="etsy-api-options-empty-copy">Utilisez "Gerer les variations" pour ajouter vos options personnalisees.</p>
        </div>
      `;
      return;
    }

    const products = Array.isArray(draft.products) ? draft.products : [];
    const summaryCards = variations.map((variation) => `
      <article class="etsy-api-options-summary-card">
        <div class="etsy-api-options-summary-head">
          <div>
            <h5>${variation.name}</h5>
            <p>${variation.options.length} option(s)</p>
          </div>
          ${variation.photosEnabled ? '<span class="etsy-api-options-summary-flag">Photos</span>' : ''}
        </div>
        <div class="etsy-options-variation-chips">${variation.options.map((option) => `<span class="etsy-options-chip">${option.label}</span>`).join('')}</div>
      </article>
    `).join('');

    const showPhotoColumn = variations.some((variation) => variation.photosEnabled);
    const rulesSummary = [
      `Prix : ${deps.getVariationRuleLabel?.(draft.priceVariesByIds, variations)}`,
      `References : ${deps.getVariationRuleLabel?.(draft.skuVariesByIds, variations)}`,
      `Quantites : ${deps.getVariationRuleLabel?.(draft.quantityVariesByIds, variations)}`,
      `Traitement : ${deps.getVariationRuleLabel?.(draft.processingProfileVariesByIds, variations)}`,
    ].map((label) => `<span class="etsy-options-chip">${label}</span>`).join('');

    const tableHead = `
      <tr>
        ${variations.map((variation) => `<th>${variation.name}</th>`).join('')}
        ${showPhotoColumn ? '<th>Photo</th>' : ''}
        <th>Reference</th>
        <th>Prix France</th>
        <th>Prix Etats-Unis</th>
        <th>Prix autres pays</th>
        <th>Quantite</th>
        <th>Actif</th>
      </tr>
    `;

    const rows = products.map((product) => {
      const assignedImage = deps.getProductAssignedImage?.(prefix, draft, product);
      const rowClassName = product.enabled !== false ? '' : ' class="is-disabled"';
      return `
        <tr data-product-id="${product.id}"${rowClassName}>
          ${variations.map((variation) => `<td class="etsy-api-options-static-cell">${deps.getProductSelection?.(product, variation.id)?.label || '-'}</td>`).join('')}
          ${showPhotoColumn ? `<td class="etsy-api-options-edit-cell">${assignedImage ? `<img class="etsy-api-options-photo-thumb" src="${assignedImage.previewSrc}" alt="Photo variation">` : '<span class="etsy-api-options-photo-empty">-</span>'}</td>` : ''}
          <td class="etsy-api-options-edit-cell"><input type="text" data-js="etsy-option-product-sku-v2" data-product-id="${product.id}" value="${product.sku || ''}"></td>
          <td class="etsy-api-options-edit-cell"><input type="text" data-js="etsy-option-product-price-v2" data-price-scope="fr" data-product-id="${product.id}" value="${deps.formatMoneyInput?.(product.prices?.fr)}"></td>
          <td class="etsy-api-options-edit-cell"><input type="text" data-js="etsy-option-product-price-v2" data-price-scope="us" data-product-id="${product.id}" value="${deps.formatMoneyInput?.(product.prices?.us)}"></td>
          <td class="etsy-api-options-edit-cell"><input type="text" data-js="etsy-option-product-price-v2" data-price-scope="other" data-product-id="${product.id}" value="${deps.formatMoneyInput?.(product.prices?.other)}"></td>
          <td class="etsy-api-options-edit-cell"><input type="text" data-js="etsy-option-product-quantity-v2" data-product-id="${product.id}" value="${String(product.quantity ?? '')}"></td>
          <td class="etsy-api-options-toggle-cell">
            <label class="etsy-api-options-switch" aria-label="Activer ou desactiver cette variation">
              <input type="checkbox" data-js="etsy-option-product-enabled-v2" data-product-id="${product.id}" ${product.enabled !== false ? 'checked' : ''}>
              <span class="etsy-api-options-switch-ui" aria-hidden="true"></span>
            </label>
          </td>
        </tr>
      `;
    }).join('');

    host.innerHTML = `
      <div class="etsy-api-options-overview">${summaryCards}</div>
      <div class="etsy-api-options-rules">${rulesSummary}</div>
      <section class="etsy-api-options-group">
        <div class="etsy-api-options-group-head">
          <div>
            <h5>Variations appliquees</h5>
            <p>${products.length} ligne(s) produit generee(s)</p>
          </div>
        </div>
        <div class="etsy-api-options-table-wrap">
          <table class="etsy-api-options-table etsy-api-options-products-table">
            <thead>${tableHead}</thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;

    host.querySelectorAll('[data-js="etsy-option-product-enabled-v2"]').forEach((input) => {
      input.addEventListener('change', (event) => {
        const productId = String(event.target.dataset.productId || '').trim();
        deps.updateOptionsDraft?.(prefix, (nextDraft) => {
          const product = (nextDraft.products || []).find((item) => item.id === productId);
          if (product) product.enabled = !!event.target.checked;
        });
      });
    });

    host.querySelectorAll('[data-js="etsy-option-product-sku-v2"]').forEach((input) => {
      input.addEventListener('input', (event) => {
        const productId = String(event.target.dataset.productId || '').trim();
        deps.updateOptionsDraft?.(prefix, (nextDraft) => {
          deps.updateScopedProducts?.(nextDraft, productId, nextDraft.skuVariesByIds, (product) => {
            product.sku = String(event.target.value || '');
          });
        });
      });
    });

    host.querySelectorAll('[data-js="etsy-option-product-price-v2"]').forEach((input) => {
      input.addEventListener('input', (event) => {
        const productId = String(event.target.dataset.productId || '').trim();
        const scope = String(event.target.dataset.priceScope || 'fr').trim();
        deps.updateOptionsDraft?.(prefix, (nextDraft) => {
          deps.updateScopedProducts?.(nextDraft, productId, nextDraft.priceVariesByIds, (product) => {
            product.prices[scope] = deps.parseMoneyInput?.(event.target.value);
          });
        });
      });
    });

    host.querySelectorAll('[data-js="etsy-option-product-quantity-v2"]').forEach((input) => {
      input.addEventListener('input', (event) => {
        const productId = String(event.target.dataset.productId || '').trim();
        deps.updateOptionsDraft?.(prefix, (nextDraft) => {
          deps.updateScopedProducts?.(nextDraft, productId, nextDraft.quantityVariesByIds, (product) => {
            product.quantity = Math.max(0, Number.parseInt(String(event.target.value || '0'), 10) || 0);
          });
        });
      });
    });
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.options = {
    ...(EtsyUI.shared.options || {}),
    openOptionsModal,
    openOptionTypePicker,
    renderOptionEditorPhotos,
    renderOptionEditorState,
    openOptionEditor,
    renderOptionsModalState,
    renderOptionsStep,
  };

  global.PipelineUIEtsyUI = EtsyUI;
})(window);
