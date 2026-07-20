(function initPipelineUIEtsyWorkspaceAuditUi(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };

  const SORTABLE_COLUMNS = Object.freeze([
    { key: 'score', label: 'Score' },
    { key: 'marketingStatusRank', label: 'Statut' },
    { key: 'title', label: 'Titre' },
    { key: 'views', label: 'Vues' },
    { key: 'favorers', label: 'Favoris' },
    { key: 'auditWindowSales', label: 'Ventes' },
    { key: 'favoriteRatePercent', label: 'Ratio fav' },
    { key: 'price', label: 'Prix' },
    { key: 'discountPercentage', label: 'Promo' },
    { key: 'promoRecommendationPct', label: 'Promo reco' },
    { key: 'ageDays', label: 'Age' },
  ]);

  function formatAuditDate(value) {
    const text = String(value || '').trim();
    if (!text) return '-';
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderMarketingStatusBadge(item) {
    const tone = String(item?.marketingStatusTone || 'neutral').trim() || 'neutral';
    const label = String(item?.marketingStatusLabel || 'En observation').trim() || 'En observation';
    return `<span class="etsy-audit-status-badge is-${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
  }

  function isPromotionPriorityRow(item) {
    const salesCount = Number(item?.salesCount || 0) || 0;
    return salesCount === 0;
  }

  function getDiscountToneClass(item) {
    const percentage = Number(item?.discountPercentage || 0) || 0;
    if (percentage >= 25) return 'is-discount-gold';
    if (percentage >= 20) return 'is-discount-green';
    if (percentage >= 15) return 'is-discount-blue';
    if (percentage >= 10) return 'is-discount-violet';
    return '';
  }

  function getAuditTitleSearchSnippet(title, limit = 25) {
    return String(title || '')
      .trim()
      .slice(0, Math.max(1, Number(limit) || 25))
      .trim();
  }

  function renderAuditPanel(prefix) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const data = global.PipelineUIEtsyData || {};
    const nodes = runtime.getAuditNodes?.(prefix);
    const state = runtime.getAuditState?.(prefix);
    if (!nodes?.content || !state) return;

    const paged = runtime.getPagedAuditItems?.(prefix) || {
      items: [],
      totalItems: 0,
      page: 1,
      pageSize: 20,
      pageCount: 1,
      startIndex: 0,
    };
    const shopLabel = String(state.shopKey || '').trim() === 'doublex' ? 'DoubleXindustrie' : 'Gros Geek Industrie';
    const loadingClassName = state.loading ? ' is-loading' : '';
    const activeStatusFilter = String(state.statusFilter || 'all').trim() || 'all';
    const activeSalesFilter = String(state.salesFilter || 'all').trim() || 'all';
    const activeDiscountFilter = String(state.discountFilter || 'all').trim() || 'all';
    const activeSectionFilter = String(state.sectionFilter || 'all').trim() || 'all';
    const marketingStatuses = data.MARKETING_STATUS && typeof data.MARKETING_STATUS === 'object'
      ? Object.values(data.MARKETING_STATUS)
      : [];
    const sections = Array.isArray(state.sections) ? state.sections : [];

    const metricsHtml = `
      <div class="etsy-audit-metrics">
        <div class="etsy-audit-metric">
          <span class="etsy-audit-metric-label">Boutique</span>
          <strong class="etsy-audit-metric-value">${escapeHtml(shopLabel)}</strong>
        </div>
        <div class="etsy-audit-metric">
          <span class="etsy-audit-metric-label">Fiches scorees</span>
          <strong class="etsy-audit-metric-value">${data.formatAuditNumber?.(paged.totalItems) || paged.totalItems}</strong>
        </div>
        <div class="etsy-audit-metric">
          <span class="etsy-audit-metric-label">Pages API</span>
          <strong class="etsy-audit-metric-value">${data.formatAuditNumber?.(state.pagesFetched || 0) || state.pagesFetched || 0}</strong>
        </div>
        <div class="etsy-audit-metric">
          <span class="etsy-audit-metric-label">Dernier audit</span>
          <strong class="etsy-audit-metric-value">${escapeHtml(formatAuditDate(state.lastAuditAt))}</strong>
        </div>
      </div>
    `;

    const pageSizeButtonsHtml = (runtime.PAGE_SIZE_OPTIONS || [10, 20, 50, 100]).map((pageSize) => `
      <button
        class="etsy-audit-chip${Number(state.pageSize) === Number(pageSize) ? ' is-active' : ''}"
        type="button"
        data-js="etsy-audit-page-size"
        data-page-size="${pageSize}"
      >${pageSize}</button>
    `).join('');

    const statusOptionsHtml = [
      '<option value="all">Tous les statuts</option>',
      ...marketingStatuses.map((entry) => {
        const key = String(entry?.key || '').trim();
        const label = String(entry?.label || key).trim();
        return `<option value="${escapeHtml(key)}"${key === activeStatusFilter ? ' selected' : ''}>${escapeHtml(label)}</option>`;
      }),
    ].join('');

    const salesOptionsHtml = [
      { key: 'all', label: 'Toutes les ventes' },
      { key: 'zero', label: '0 vente' },
      { key: 'one_to_five', label: '1 a 5 ventes' },
      { key: 'six_plus', label: '6 ventes et plus' },
    ].map((entry) => (
      `<option value="${escapeHtml(entry.key)}"${entry.key === activeSalesFilter ? ' selected' : ''}>${escapeHtml(entry.label)}</option>`
    )).join('');

    const discountOptionsHtml = [
      { key: 'all', label: 'Toutes les promos' },
      { key: '10', label: '10 %' },
      { key: '15', label: '15 %' },
      { key: '20', label: '20 %' },
      { key: '25_plus', label: '25 % et plus' },
    ].map((entry) => (
      `<option value="${escapeHtml(entry.key)}"${entry.key === activeDiscountFilter ? ' selected' : ''}>${escapeHtml(entry.label)}</option>`
    )).join('');

    const sectionOptionsHtml = [
      '<option value="all">Toutes les sections Etsy</option>',
      ...sections.map((entry) => {
        const sectionId = String(entry?.sectionId || '').trim();
        const title = String(entry?.title || '').trim();
        return `<option value="${escapeHtml(sectionId)}"${sectionId === activeSectionFilter ? ' selected' : ''}>${escapeHtml(title)}</option>`;
      }),
    ].join('');

    const sortHeadersHtml = SORTABLE_COLUMNS.map((column) => {
      const isActive = state.sortKey === column.key;
      const arrow = !isActive ? '<>' : (state.sortDir === 'asc' ? '^' : 'v');
      return `
        <th scope="col">
          <button
            class="etsy-audit-sort${isActive ? ' is-active' : ''}"
            type="button"
            data-js="etsy-audit-sort"
            data-sort-key="${column.key}"
          >
            <span>${escapeHtml(column.label)}</span>
            <span class="etsy-audit-sort-arrow" aria-hidden="true">${arrow}</span>
          </button>
        </th>
      `;
    }).join('');

    const rowsHtml = paged.items.length
      ? paged.items.map((item, index) => {
        const listingTitle = escapeHtml(item.title || 'Sans titre');
        const titleSearchSnippet = getAuditTitleSearchSnippet(item.title, 25);
        const rowIndex = paged.startIndex + index + 1;
        const rowClassName = isPromotionPriorityRow(item) ? ' class="etsy-audit-row-priority"' : '';
        const discountToneClass = item.hasDiscount ? getDiscountToneClass(item) : '';
        const titleLinkHtml = item.url
          ? `<a class="etsy-audit-title-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${listingTitle}</a>`
          : `<span class="etsy-audit-title-link">${listingTitle}</span>`;
        const titleCopyHtml = titleSearchSnippet
          ? `
            <button
              class="etsy-audit-copy-btn"
              type="button"
              data-js="etsy-audit-copy-title"
              data-copy-value="${escapeHtml(titleSearchSnippet)}"
              title="Copier les 25 premiers caracteres"
              aria-label="Copier les 25 premiers caracteres"
            >
              <span class="etsy-audit-copy-icon" aria-hidden="true"></span>
            </button>
          `
          : '';
        const titleHtml = `
          <div class="etsy-audit-title-inline">
            ${titleLinkHtml}
            ${titleCopyHtml}
          </div>
        `;

        return `
          <tr${rowClassName}>
            <td>${rowIndex}</td>
            <td><span class="etsy-audit-score-badge${discountToneClass ? ` ${discountToneClass}` : ''}">${data.formatAuditNumber?.(item.score) || item.score}</span></td>
            <td>${renderMarketingStatusBadge(item)}</td>
            <td class="etsy-audit-title-cell">${titleHtml}</td>
            <td>${data.formatAuditNumber?.(item.views) || item.views}</td>
            <td>${data.formatAuditNumber?.(item.favorers) || item.favorers}</td>
            <td>${data.formatAuditNumber?.(item.auditWindowSales) || item.auditWindowSales}</td>
            <td>${data.formatAuditPercent?.(item.favoriteRatePercent, 1) || item.favoriteRatePercent}</td>
            <td>${data.formatAuditMoney?.(item.price, item.currencyCode || 'EUR') || item.price}</td>
            <td><span class="etsy-audit-discount-value${discountToneClass ? ` ${discountToneClass}` : ''}">${item.hasDiscount ? `${data.formatAuditNumber?.(item.discountPercentage) || item.discountPercentage} %` : '-'}</span></td>
            <td>${data.formatAuditNumber?.(item.promoRecommendationPct) || item.promoRecommendationPct} %</td>
            <td>${data.formatAuditNumber?.(item.ageDays) || item.ageDays}</td>
          </tr>
        `;
      }).join('')
      : `
        <tr>
          <td colspan="12" class="etsy-audit-empty-cell">
            ${state.loading ? 'Lecture Etsy en cours...' : 'Aucune fiche analysee pour l instant.'}
          </td>
        </tr>
      `;

    const paginationButtons = Array.from({ length: paged.pageCount }, (_, index) => index + 1)
      .slice(Math.max(0, paged.page - 3), Math.max(0, paged.page - 3) + 7)
      .map((page) => `
        <button
          class="etsy-audit-page-btn${page === paged.page ? ' is-active' : ''}"
          type="button"
          data-js="etsy-audit-page"
          data-page="${page}"
        >${page}</button>
      `).join('');

    const errorHtml = state.error
      ? `<div class="etsy-audit-error">${escapeHtml(state.error)}</div>`
      : '';

    nodes.content.innerHTML = `
      <div class="etsy-audit-shell${loadingClassName}">
        <div class="collection-stepper-heading">
          <span class="collection-stepper-kicker">Audit Etsy - Scoring local</span>
          <h2 class="collection-stepper-title">Produits a pousser en promotion</h2>
          <p class="collection-stepper-subtitle">Audit batch de la boutique complete en lecture lifetime.</p>
        </div>

        <div class="field-action-row etsy-audit-toolbar">
          <button class="btn btn-accent" type="button" data-js="etsy-audit-run"${state.loading ? ' disabled' : ''}>
            <span data-svg-icon="play"></span>
            <span class="ui-icon-label">${state.loading ? 'Audit en cours...' : 'Lancer l audit'}</span>
          </button>
          <label class="field-label etsy-audit-window-control">
            <span>Statut</span>
            <select class="field-input" data-js="etsy-audit-status-filter"${state.loading ? ' disabled' : ''}>
              ${statusOptionsHtml}
            </select>
          </label>
          <label class="field-label etsy-audit-window-control">
            <span>Ventes</span>
            <select class="field-input" data-js="etsy-audit-sales-filter"${state.loading ? ' disabled' : ''}>
              ${salesOptionsHtml}
            </select>
          </label>
          <label class="field-label etsy-audit-window-control">
            <span>Promo</span>
            <select class="field-input" data-js="etsy-audit-discount-filter"${state.loading ? ' disabled' : ''}>
              ${discountOptionsHtml}
            </select>
          </label>
          <label class="field-label etsy-audit-window-control">
            <span>Section Etsy</span>
            <select class="field-input" data-js="etsy-audit-section-filter"${state.loading ? ' disabled' : ''}>
              ${sectionOptionsHtml}
            </select>
          </label>
          <div class="etsy-audit-page-size-group" aria-label="Taille de page">
            ${pageSizeButtonsHtml}
          </div>
        </div>

        ${metricsHtml}
        ${errorHtml}

        <div class="etsy-audit-table-wrap">
          <table class="etsy-audit-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                ${sortHeadersHtml}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <div class="etsy-audit-pagination">
          <div class="etsy-audit-pagination-copy">
            <button class="etsy-audit-export-btn" type="button" data-js="etsy-audit-copy-json"${state.loading ? ' disabled' : ''}>Extraire JSON</button>
            <span class="etsy-audit-pagination-copy-text">
              ${paged.totalItems ? `Affichage ${paged.startIndex + 1}-${Math.min(paged.startIndex + paged.pageSize, paged.totalItems)} sur ${paged.totalItems}` : 'Aucun resultat'}
            </span>
          </div>
          <div class="etsy-audit-pagination-actions">
            ${paginationButtons}
          </div>
        </div>
      </div>
    `;
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.audit = {
    ...(EtsyUI.shared.audit || {}),
    renderAuditPanel,
  };

  global.PipelineUIEtsyUI = EtsyUI;
  global.PipelineUIEtsyRuntime = {
    ...(global.PipelineUIEtsyRuntime || {}),
    renderAuditPanel,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.ui = global.PipelineUIEtsyUI;
})(window);
