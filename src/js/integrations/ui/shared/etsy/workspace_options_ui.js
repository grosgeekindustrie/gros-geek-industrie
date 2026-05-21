(function initPipelineUIEtsyWorkspaceOptionsUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };
  const getData = () => global.PipelineUIEtsyData || {};
  const getNodeById = (id) => document.getElementById(id);
  const getNode = (deps, id) => deps.getNode?.(id) || getNodeById(id);

  function renderOptionsStep(prefix, deps = {}) {
    const data = getData();
    const state = deps.getState?.(prefix);
    const host = getNode(deps, `etsyApiOptionsContent-${prefix}`);
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
      `Prix : ${deps.getVariationRuleLabel?.(draft.priceVariesByIds, variations) || data.getVariationRuleLabel?.(draft.priceVariesByIds, variations)}`,
      `References : ${deps.getVariationRuleLabel?.(draft.skuVariesByIds, variations) || data.getVariationRuleLabel?.(draft.skuVariesByIds, variations)}`,
      `Quantites : ${deps.getVariationRuleLabel?.(draft.quantityVariesByIds, variations) || data.getVariationRuleLabel?.(draft.quantityVariesByIds, variations)}`,
      `Traitement : ${deps.getVariationRuleLabel?.(draft.processingProfileVariesByIds, variations) || data.getVariationRuleLabel?.(draft.processingProfileVariesByIds, variations)}`,
    ].map((label) => `<span class="etsy-options-chip">${label}</span>`).join('');

    const tableHead = `
      <tr>
        ${variations.map((variation) => `<th>${variation.name}</th>`).join('')}
        ${showPhotoColumn ? '<th data-column="photo">Photo</th>' : ''}
        <th data-column="sku">Reference</th>
        <th data-column="price">Prix France</th>
        <th data-column="price">Prix Etats-Unis</th>
        <th data-column="price">Prix autres pays</th>
        <th data-column="quantity">Quantite</th>
        <th>Actif</th>
      </tr>
    `;

    const rows = products.map((product) => {
      const assignedImage = deps.getProductAssignedImage?.(prefix, draft, product);
      const rowClassName = product.enabled !== false ? '' : ' class="is-disabled"';
      return `
        <tr data-product-id="${product.id}"${rowClassName}>
          ${variations.map((variation) => `<td class="etsy-api-options-static-cell">${(deps.getProductSelection?.(product, variation.id) || data.getProductSelection?.(product, variation.id))?.label || '-'}</td>`).join('')}
          ${showPhotoColumn ? `<td class="etsy-api-options-edit-cell" data-column="photo">${assignedImage ? `<img class="etsy-api-options-photo-thumb" src="${assignedImage.previewSrc}" alt="Photo variation">` : '<span class="etsy-api-options-photo-empty">-</span>'}</td>` : ''}
          <td class="etsy-api-options-edit-cell" data-column="sku"><input type="text" data-js="etsy-option-product-sku-v2" data-product-id="${product.id}" value="${product.sku || ''}"></td>
          <td class="etsy-api-options-edit-cell" data-column="price"><input type="text" data-js="etsy-option-product-price-v2" data-price-scope="fr" data-product-id="${product.id}" value="${(deps.formatMoneyInput || data.formatMoneyInput)?.(product.prices?.fr)}"></td>
          <td class="etsy-api-options-edit-cell" data-column="price"><input type="text" data-js="etsy-option-product-price-v2" data-price-scope="us" data-product-id="${product.id}" value="${(deps.formatMoneyInput || data.formatMoneyInput)?.(product.prices?.us)}"></td>
          <td class="etsy-api-options-edit-cell" data-column="price"><input type="text" data-js="etsy-option-product-price-v2" data-price-scope="other" data-product-id="${product.id}" value="${(deps.formatMoneyInput || data.formatMoneyInput)?.(product.prices?.other)}"></td>
          <td class="etsy-api-options-edit-cell" data-column="quantity"><input type="text" data-js="etsy-option-product-quantity-v2" data-product-id="${product.id}" value="${String(product.quantity ?? '')}"></td>
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
          (deps.updateScopedProducts || data.updateScopedProducts)?.(nextDraft, productId, nextDraft.skuVariesByIds, (product) => {
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
          (deps.updateScopedProducts || data.updateScopedProducts)?.(nextDraft, productId, nextDraft.priceVariesByIds, (product) => {
            product.prices[scope] = (deps.parseMoneyInput || data.parseMoneyInput)?.(event.target.value);
          });
        });
      });
    });

    host.querySelectorAll('[data-js="etsy-option-product-quantity-v2"]').forEach((input) => {
      input.addEventListener('input', (event) => {
        const productId = String(event.target.dataset.productId || '').trim();
        deps.updateOptionsDraft?.(prefix, (nextDraft) => {
          (deps.updateScopedProducts || data.updateScopedProducts)?.(nextDraft, productId, nextDraft.quantityVariesByIds, (product) => {
            product.quantity = Math.max(0, Number.parseInt(String(event.target.value || '0'), 10) || 0);
          });
        });
      });
    });
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.options = {
    ...(EtsyUI.shared.options || {}),
    renderOptionsStep,
  };

  global.PipelineUIEtsyUI = EtsyUI;
})(window);
