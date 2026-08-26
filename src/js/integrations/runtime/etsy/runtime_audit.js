(function initPipelineUIEtsyRuntimeAudit(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};
  const getRuntime = () => global.PipelineUIEtsyRuntime || {};
  const getData = () => global.PipelineUIEtsyData || {};

  const DEFAULT_AUDIT_PAGE_SIZE = 20;
  const LISTINGS_PAGE_LIMIT = 100;
  const PAGE_SIZE_OPTIONS = Object.freeze([10, 20, 50, 100]);
  const NUMERIC_SORT_KEYS = new Set(['score', 'views', 'favorers', 'salesCount', 'auditWindowSales', 'favoriteRatePercent', 'price', 'discountPercentage', 'promoRecommendationPct', 'promoSignalScore', 'quantity', 'ageDays', 'marketingStatusRank']);

  function getAuditNodes(prefix) {
    return {
      panel: document.getElementById(`etsyAuditPanel-${prefix}`),
      content: document.getElementById(`etsyAuditContent-${prefix}`),
      status: document.getElementById(`etsyAuditStatus-${prefix}`),
    };
  }

  function getDefaultSortDir(sortKey = '') {
    return NUMERIC_SORT_KEYS.has(String(sortKey || '').trim()) ? 'desc' : 'asc';
  }

  function setAuditStatus(prefix, message) {
    const nodes = getAuditNodes(prefix);
    if (nodes.status) nodes.status.textContent = String(message || '');
  }

  function setAuditState(prefix, patch = {}) {
    const state = getRuntime().getAuditState?.(prefix);
    if (!state) return null;
    Object.assign(state, patch || {});
    return state;
  }

  function compareAuditItems(left, right, sortKey, sortDir) {
    const direction = sortDir === 'asc' ? 1 : -1;
    const leftValue = left?.[sortKey];
    const rightValue = right?.[sortKey];

    if (NUMERIC_SORT_KEYS.has(sortKey)) {
      const a = Number(leftValue ?? -Infinity);
      const b = Number(rightValue ?? -Infinity);
      return (a - b) * direction;
    }

    const a = String(leftValue || '').trim().toLocaleLowerCase('fr-FR');
    const b = String(rightValue || '').trim().toLocaleLowerCase('fr-FR');
    return a.localeCompare(b, 'fr-FR', { sensitivity: 'base', numeric: true }) * direction;
  }

  function getSortedAuditItems(prefix) {
    const state = getRuntime().getAuditState?.(prefix);
    const items = getRuntime().getFilteredAuditItems?.(prefix) || [];
    const sortKey = String(state?.sortKey || 'score').trim() || 'score';
    const sortDir = String(state?.sortDir || 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';

    return items.sort((left, right) => {
      const result = compareAuditItems(left, right, sortKey, sortDir);
      if (result !== 0) return result;
      return compareAuditItems(left, right, 'title', 'asc');
    });
  }

  function matchesAuditStatusFilter(item, statusFilter) {
    const normalizedFilter = String(statusFilter || 'all').trim();
    if (!normalizedFilter || normalizedFilter === 'all') return true;
    return String(item?.marketingStatusKey || '').trim() === normalizedFilter;
  }

  function matchesAuditSalesFilter(item, salesFilter) {
    const normalizedFilter = String(salesFilter || 'all').trim();
    const salesCount = Number(item?.salesCount || 0) || 0;
    if (!normalizedFilter || normalizedFilter === 'all') return true;
    if (normalizedFilter === 'zero') return salesCount === 0;
    if (normalizedFilter === 'one_to_five') return salesCount >= 1 && salesCount <= 5;
    if (normalizedFilter === 'six_plus') return salesCount >= 6;
    return true;
  }

  function matchesAuditSectionFilter(item, sectionFilter) {
    const normalizedFilter = String(sectionFilter || 'all').trim();
    if (!normalizedFilter || normalizedFilter === 'all') return true;
    return String(item?.sectionId || '').trim() === normalizedFilter;
  }

  function matchesAuditDiscountFilter(item, discountFilter) {
    const normalizedFilter = String(discountFilter || 'all').trim();
    const discountPercentage = Number(item?.discountPercentage || 0) || 0;
    if (!normalizedFilter || normalizedFilter === 'all') return true;
    if (normalizedFilter === '10') return discountPercentage === 10;
    if (normalizedFilter === '15') return discountPercentage === 15;
    if (normalizedFilter === '20') return discountPercentage === 20;
    if (normalizedFilter === '25_plus') return discountPercentage >= 25;
    return true;
  }

  function getFilteredAuditItems(prefix) {
    const state = getRuntime().getAuditState?.(prefix);
    const items = Array.isArray(state?.items) ? [...state.items] : [];
    const statusFilter = String(state?.statusFilter || 'all').trim() || 'all';
    const salesFilter = String(state?.salesFilter || 'all').trim() || 'all';
    const discountFilter = String(state?.discountFilter || 'all').trim() || 'all';
    const sectionFilter = String(state?.sectionFilter || 'all').trim() || 'all';

    return items.filter((item) => (
      matchesAuditStatusFilter(item, statusFilter)
      && matchesAuditSalesFilter(item, salesFilter)
      && matchesAuditDiscountFilter(item, discountFilter)
      && matchesAuditSectionFilter(item, sectionFilter)
    ));
  }

  function getPagedAuditItems(prefix) {
    const state = getRuntime().getAuditState?.(prefix);
    const sortedItems = getRuntime().getSortedAuditItems?.(prefix) || [];
    const pageSize = PAGE_SIZE_OPTIONS.includes(Number(state?.pageSize)) ? Number(state.pageSize) : DEFAULT_AUDIT_PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(sortedItems.length / pageSize));
    const page = Math.min(Math.max(1, Number(state?.page || 1) || 1), pageCount);
    const startIndex = (page - 1) * pageSize;

    return {
      items: sortedItems.slice(startIndex, startIndex + pageSize),
      totalItems: sortedItems.length,
      page,
      pageSize,
      pageCount,
      startIndex,
    };
  }

  async function enrichAuditItemsWithSales(items = [], shopKey = '') {
    const sourceItems = Array.isArray(items) ? items : [];
    const listingIds = sourceItems
      .map((item) => String(item?.listingId || '').trim())
      .filter(Boolean);

    if (!listingIds.length) return sourceItems;

    const salesPayload = await getRuntime().fetchListingSalesMap?.(listingIds, { shopKey }) || {};
    const salesByListing = salesPayload?.salesByListing && typeof salesPayload.salesByListing === 'object'
      ? salesPayload.salesByListing
      : {};
    const salesWindowsByListing = salesPayload?.salesWindowsByListing && typeof salesPayload.salesWindowsByListing === 'object'
      ? salesPayload.salesWindowsByListing
      : {};

    return sourceItems.map((item) => {
      const listingId = String(item?.listingId || '').trim();
      if (!listingId) return item;
      const rawSalesCount = Object.prototype.hasOwnProperty.call(salesByListing, listingId)
        ? salesByListing[listingId]
        : null;
      const salesCount = rawSalesCount === null || rawSalesCount === undefined || rawSalesCount === ''
        ? null
        : Number(rawSalesCount);

      return {
        ...item,
        salesCount: Number.isFinite(salesCount) ? salesCount : null,
        salesWindows: salesWindowsByListing[listingId] && typeof salesWindowsByListing[listingId] === 'object'
          ? salesWindowsByListing[listingId]
          : { '7d': 0, '30d': 0, lifetime: Number.isFinite(salesCount) ? salesCount : 0 },
      };
    });
  }

  function scoreAuditItems(items = [], timeWindow = 'lifetime') {
    return getData().computeAuditScores?.(items, { timeWindow }) || items;
  }

  async function fetchAllActiveListingsForAudit(prefix) {
    const shopKey = global.PipelineUIApp?.getActiveShopKey?.() || 'grosgeek';
    const sectionsPayload = await getRuntime().fetchShopSections?.({ shopKey });
    const sections = getData().normalizeAuditSections?.(sectionsPayload) || [];
    const allResults = [];
    let offset = 0;
    let pageCount = 0;
    let expectedCount = 0;

    while (true) {
      pageCount += 1;
      setAuditStatus(prefix, `Audit Etsy en cours... lecture des listings page ${pageCount}...`);
      const pagePayload = await getRuntime().fetchShopListingsPage?.({
        shopKey,
        state: 'active',
        limit: LISTINGS_PAGE_LIMIT,
        offset,
      });
      const collection = getData().normalizeAuditCollection?.(pagePayload) || { count: 0, results: [] };
      const rawResults = Array.isArray(collection.results) ? collection.results : [];
      expectedCount = Math.max(expectedCount, Number(collection.count || 0) || 0);
      allResults.push(...rawResults);
      offset += rawResults.length;

      if (!rawResults.length) break;
      if (rawResults.length < LISTINGS_PAGE_LIMIT) break;
      if (expectedCount > 0 && offset >= expectedCount) break;
    }

    const normalizedItems = allResults
      .map((listing) => getData().normalizeAuditListing?.(listing, { now: new Date() }) || null)
      .filter(Boolean);

    setAuditStatus(prefix, `Audit Etsy en cours... ${normalizedItems.length} fiche(s) chargee(s), lecture des ventes via transactions...`);
    const enrichedItems = await enrichAuditItemsWithSales(normalizedItems, shopKey);

    return {
      items: enrichedItems,
      sections,
      shopKey,
      totalCount: enrichedItems.length,
      pagesFetched: pageCount,
    };
  }

  async function runAudit(prefix) {
    const state = getRuntime().getAuditState?.(prefix);
    if (!state || state.loading) return;

    setAuditState(prefix, {
      loading: true,
      error: '',
      items: [],
      rawItems: [],
      sections: [],
      totalCount: 0,
      pagesFetched: 0,
      page: 1,
      shopKey: global.PipelineUIApp?.getActiveShopKey?.() || 'grosgeek',
    });
    getRuntime().renderAuditPanel?.(prefix);
    setAuditStatus(prefix, 'Audit Etsy en cours...');

    try {
      const result = await fetchAllActiveListingsForAudit(prefix);
      const timeWindow = String(state.timeWindow || 'lifetime').trim() || 'lifetime';
      const scoredItems = scoreAuditItems(result.items, timeWindow);
      const nowIso = new Date().toISOString();
      setAuditState(prefix, {
        loading: false,
        error: '',
        items: scoredItems,
        rawItems: result.items,
        sections: result.sections,
        totalCount: result.totalCount,
        pagesFetched: result.pagesFetched,
        page: 1,
        shopKey: result.shopKey,
        lastAuditAt: nowIso,
      });
      setAuditStatus(prefix, `Audit termine - ${scoredItems.length} fiche(s) actives analysee(s).`);
    } catch (error) {
      setAuditState(prefix, {
        loading: false,
        error: String(error?.message || 'Audit Etsy impossible'),
        items: [],
        rawItems: [],
        sections: [],
        totalCount: 0,
        pagesFetched: 0,
      });
      setAuditStatus(prefix, `Audit impossible : ${error?.message || 'erreur inconnue'}`);
      global.showToast?.(`Audit Etsy : ${error?.message || 'erreur inconnue'}`, '#ff4757');
    }

    getRuntime().renderAuditPanel?.(prefix);
  }

  function updateAuditSort(prefix, sortKey) {
    const state = getRuntime().getAuditState?.(prefix);
    if (!state) return;
    const normalizedSortKey = String(sortKey || '').trim();
    if (!normalizedSortKey) return;

    const nextSortDir = state.sortKey === normalizedSortKey
      ? (state.sortDir === 'asc' ? 'desc' : 'asc')
      : getDefaultSortDir(normalizedSortKey);

    setAuditState(prefix, {
      sortKey: normalizedSortKey,
      sortDir: nextSortDir,
      page: 1,
    });
    getRuntime().renderAuditPanel?.(prefix);
  }

  function updateAuditPageSize(prefix, pageSize) {
    const numericPageSize = Number(pageSize);
    if (!PAGE_SIZE_OPTIONS.includes(numericPageSize)) return;

    setAuditState(prefix, {
      pageSize: numericPageSize,
      page: 1,
    });
    getRuntime().renderAuditPanel?.(prefix);
  }

  function updateAuditPage(prefix, page) {
    const state = getRuntime().getAuditState?.(prefix);
    if (!state) return;
    const numericPage = Math.max(1, Number(page) || 1);
    const pageCount = Math.max(1, Math.ceil((state.items?.length || 0) / (Number(state.pageSize) || DEFAULT_AUDIT_PAGE_SIZE)));

    setAuditState(prefix, {
      page: Math.min(numericPage, pageCount),
    });
    getRuntime().renderAuditPanel?.(prefix);
  }

  function updateAuditStatusFilter(prefix, statusFilter) {
    setAuditState(prefix, {
      statusFilter: String(statusFilter || 'all').trim() || 'all',
      page: 1,
    });
    getRuntime().renderAuditPanel?.(prefix);
  }

  function updateAuditSalesFilter(prefix, salesFilter) {
    setAuditState(prefix, {
      salesFilter: String(salesFilter || 'all').trim() || 'all',
      page: 1,
    });
    getRuntime().renderAuditPanel?.(prefix);
  }

  function updateAuditDiscountFilter(prefix, discountFilter) {
    setAuditState(prefix, {
      discountFilter: String(discountFilter || 'all').trim() || 'all',
      page: 1,
    });
    getRuntime().renderAuditPanel?.(prefix);
  }

  function buildAuditExportFilename(state) {
    const shopName = String(state?.shopKey || '').trim() === 'doublex'
      ? 'doublexindustrie'
      : 'gros-geek-industrie';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `audit-etsy-${shopName}-${timestamp}.json`;
  }

  function copyAuditJson(prefix) {
    const state = getRuntime().getAuditState?.(prefix);
    if (!state) {
      global.showToast?.('Aucune donnee d audit a extraire', '#ff4757');
      return;
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      shopKey: String(state.shopKey || '').trim(),
      lastAuditAt: String(state.lastAuditAt || '').trim(),
      filters: {
        status: String(state.statusFilter || 'all').trim() || 'all',
        sales: String(state.salesFilter || 'all').trim() || 'all',
        discount: String(state.discountFilter || 'all').trim() || 'all',
        section: String(state.sectionFilter || 'all').trim() || 'all',
      },
      sort: {
        key: String(state.sortKey || 'score').trim() || 'score',
        dir: String(state.sortDir || 'desc').trim() || 'desc',
      },
      pagination: {
        page: Math.max(1, Number(state.page || 1) || 1),
        pageSize: Number(state.pageSize || DEFAULT_AUDIT_PAGE_SIZE) || DEFAULT_AUDIT_PAGE_SIZE,
      },
      counts: {
        totalCount: Number(state.totalCount || 0) || 0,
        pagesFetched: Number(state.pagesFetched || 0) || 0,
        scoredItems: Array.isArray(state.items) ? state.items.length : 0,
      },
      items: Array.isArray(state.items) ? state.items : [],
    };

    try {
      const json = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildAuditExportFilename(state);
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      global.showToast?.('Fichier JSON audit téléchargé');
    } catch (error) {
      global.showToast?.(`Export JSON impossible : ${error?.message || 'erreur inconnue'}`, '#ff4757');
    }
  }

  async function copyAuditTitlePrefix(button) {
    const value = String(button?.dataset?.copyValue || '').trim();
    if (!value) {
      global.showToast?.('Aucun titre a copier', '#ff4757');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      global.showToast?.('Prefixe titre copie');
    } catch (error) {
      global.showToast?.(`Copie impossible : ${error?.message || 'erreur inconnue'}`, '#ff4757');
    }
  }

  function updateAuditSectionFilter(prefix, sectionFilter) {
    setAuditState(prefix, {
      sectionFilter: String(sectionFilter || 'all').trim() || 'all',
      page: 1,
    });
    getRuntime().renderAuditPanel?.(prefix);
  }

  function initAuditContext(prefix) {
    const nodes = getAuditNodes(prefix);
    if (!nodes.panel || !nodes.content) return;
    if (nodes.panel.dataset.etsyAuditBound === 'true') {
      getRuntime().renderAuditPanel?.(prefix);
      return;
    }
    nodes.panel.dataset.etsyAuditBound = 'true';

    nodes.panel.addEventListener('click', (event) => {
      const runButton = event.target.closest('[data-js="etsy-audit-run"]');
      if (runButton) {
        runAudit(prefix);
        return;
      }

      const copyTitleButton = event.target.closest('[data-js="etsy-audit-copy-title"]');
      if (copyTitleButton) {
        copyAuditTitlePrefix(copyTitleButton);
        return;
      }

      const copyJsonButton = event.target.closest('[data-js="etsy-audit-copy-json"]');
      if (copyJsonButton) {
        copyAuditJson(prefix);
        return;
      }

      const sortButton = event.target.closest('[data-js="etsy-audit-sort"]');
      if (sortButton) {
        updateAuditSort(prefix, sortButton.dataset.sortKey || '');
        return;
      }

      const pageSizeButton = event.target.closest('[data-js="etsy-audit-page-size"]');
      if (pageSizeButton) {
        updateAuditPageSize(prefix, pageSizeButton.dataset.pageSize || '');
        return;
      }

      const pageButton = event.target.closest('[data-js="etsy-audit-page"]');
      if (pageButton) {
        updateAuditPage(prefix, pageButton.dataset.page || '');
      }
    });

    nodes.panel.addEventListener('change', (event) => {
      const statusFilterSelect = event.target.closest('[data-js="etsy-audit-status-filter"]');
      if (statusFilterSelect) {
        updateAuditStatusFilter(prefix, statusFilterSelect.value || '');
        return;
      }

      const salesFilterSelect = event.target.closest('[data-js="etsy-audit-sales-filter"]');
      if (salesFilterSelect) {
        updateAuditSalesFilter(prefix, salesFilterSelect.value || '');
        return;
      }

      const discountFilterSelect = event.target.closest('[data-js="etsy-audit-discount-filter"]');
      if (discountFilterSelect) {
        updateAuditDiscountFilter(prefix, discountFilterSelect.value || '');
        return;
      }

      const sectionFilterSelect = event.target.closest('[data-js="etsy-audit-section-filter"]');
      if (sectionFilterSelect) {
        updateAuditSectionFilter(prefix, sectionFilterSelect.value || '');
      }
    });

    setAuditStatus(prefix, 'Audit inactif. Lance une lecture complete des fiches actives pour calculer le score.');
    getRuntime().renderAuditPanel?.(prefix);
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    PAGE_SIZE_OPTIONS,
    getAuditNodes,
    setAuditStatus,
    setAuditState,
    getFilteredAuditItems,
    getSortedAuditItems,
    getPagedAuditItems,
    runAudit,
    updateAuditStatusFilter,
    updateAuditSalesFilter,
    updateAuditDiscountFilter,
    updateAuditSectionFilter,
    copyAuditJson,
    updateAuditSort,
    updateAuditPageSize,
    updateAuditPage,
    initAuditContext,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
