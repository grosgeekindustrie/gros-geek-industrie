(function initPipelineUIEtsyAuditData(global) {
  'use strict';

  const EtsyData = global.PipelineUIEtsyData || {};
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const AUDIT_WINDOWS = Object.freeze([
    { key: 'lifetime', label: 'Depuis l ouverture' },
  ]);
  const MARKETING_STATUS = Object.freeze({
    recent: { key: 'recent', label: 'Trop recent', rank: 0, tone: 'neutral' },
    observation: { key: 'observation', label: 'En observation', rank: 1, tone: 'neutral' },
    rework: { key: 'rework', label: 'A retravailler', rank: 2, tone: 'danger' },
    promote: { key: 'promote', label: 'A promouvoir', rank: 3, tone: 'warning' },
    validated: { key: 'validated', label: 'Validee', rank: 4, tone: 'success' },
  });

  function normalizeAuditCollection(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const nested = source.payload && typeof source.payload === 'object' ? source.payload : source;
    const data = nested.data && typeof nested.data === 'object' ? nested.data : nested;
    const results = Array.isArray(data.results)
      ? data.results
      : Array.isArray(data)
        ? data
        : [];

    return {
      count: Number(data.count || results.length || 0) || 0,
      results,
      params: data.params && typeof data.params === 'object'
        ? data.params
        : data.query && typeof data.query === 'object'
          ? data.query
          : {},
    };
  }

  function normalizeAuditSections(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const nested = source.payload && typeof source.payload === 'object' ? source.payload : source;
    const data = nested.data && typeof nested.data === 'object' ? nested.data : nested;
    const results = Array.isArray(data.results)
      ? data.results
      : Array.isArray(data)
        ? data
        : [];

    return results
      .map((section) => {
        const sectionId = Number(section?.shop_section_id ?? section?.section_id ?? 0) || 0;
        const title = String(section?.title || section?.name || '').trim();
        if (!sectionId || !title) return null;
        return {
          sectionId: String(sectionId),
          title,
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.title.localeCompare(right.title, 'fr-FR', { sensitivity: 'base', numeric: true }));
  }

  function parseAuditDate(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number' && Number.isFinite(value)) {
      const timestamp = value > 1e12 ? value : value * 1000;
      const date = new Date(timestamp);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const text = String(value || '').trim();
    if (!text) return null;

    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
      const timestamp = numeric > 1e12 ? numeric : numeric * 1000;
      const date = new Date(timestamp);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function extractListingLevelSalesCount(rawListing = {}) {
    const candidateKeys = [
      'sold_count',
      'sales_count',
      'transaction_sold_count',
      'quantity_sold',
      'num_sold',
      'sales',
    ];

    for (const key of candidateKeys) {
      if (!Object.prototype.hasOwnProperty.call(rawListing, key)) continue;
      const rawValue = rawListing[key];
      if (rawValue === null || rawValue === undefined || rawValue === '') return {
        value: null,
        source: key,
      };
      const numericValue = Number(rawValue);
      if (Number.isFinite(numericValue)) {
        return {
          value: numericValue,
          source: key,
        };
      }
    }

    return {
      value: null,
      source: '',
    };
  }

  function getDaysSince(value, now = new Date()) {
    const date = parseAuditDate(value);
    if (!date) return null;
    const diff = now.getTime() - date.getTime();
    if (!Number.isFinite(diff) || diff < 0) return 0;
    return Math.floor(diff / MS_PER_DAY);
  }

  function normalizeAuditListing(rawListing = {}, options = {}) {
    const now = options.now instanceof Date ? options.now : new Date();
    const listingId = String(rawListing.listing_id || rawListing.id || '').trim();
    const title = String(rawListing.title || '').trim();
    const state = String(rawListing.state || '').trim().toLowerCase();
    const url = String(rawListing.url || rawListing.listing_url || '').trim();
    const views = Number(rawListing.views || rawListing.view_count || 0) || 0;
    const favorers = Number(rawListing.num_favorers || rawListing.favorers || 0) || 0;
    const salesCandidate = extractListingLevelSalesCount(rawListing);
    const salesCount = Number.isFinite(Number(salesCandidate.value)) ? Number(salesCandidate.value) : null;
    const quantity = Number(rawListing.quantity || 0) || 0;
    const price = Number(EtsyData.getMoneyNumber?.(rawListing.price ?? 0) || 0);
    const sectionId = Number(rawListing.shop_section_id ?? rawListing.section_id ?? 0) || 0;
    const createdAt = parseAuditDate(
      rawListing.original_creation_tsz
      ?? rawListing.original_creation_timestamp
      ?? rawListing.created_timestamp
      ?? rawListing.creation_tsz
      ?? rawListing.created_tsz
      ?? rawListing.create_date
      ?? ''
    );
    const updatedAt = parseAuditDate(
      rawListing.last_modified_tsz
      ?? rawListing.updated_timestamp
      ?? rawListing.modified_tsz
      ?? rawListing.modified_timestamp
      ?? rawListing.update_date
      ?? ''
    );
    const favoriteRate = views > 0 ? favorers / views : 0;
    const normalizedSalesCount = Number.isFinite(Number(salesCount)) ? Number(salesCount) : 0;
    const buyerPrice = rawListing.buyer_price && typeof rawListing.buyer_price === 'object'
      ? rawListing.buyer_price
      : rawListing.buyerPrice && typeof rawListing.buyerPrice === 'object'
        ? rawListing.buyerPrice
        : {};
    const hasDiscount = buyerPrice.has_discount === true;
    const discountPercentage = Number(buyerPrice.discount_percentage || 0) || 0;

    return {
      listingId,
      title,
      state,
      url,
      views,
      favorers,
      salesCount,
      salesWindows: {
        '7d': 0,
        '30d': 0,
        lifetime: normalizedSalesCount,
      },
      favoriteRate,
      favoriteRatePercent: favoriteRate * 100,
      quantity,
      sectionId: sectionId ? String(sectionId) : '',
      price: Number.isFinite(price) ? price : 0,
      hasDiscount,
      discountPercentage: hasDiscount ? discountPercentage : 0,
      currencyCode: String(rawListing.currency_code || '').trim(),
      createdAt: createdAt ? createdAt.toISOString() : '',
      updatedAt: updatedAt ? updatedAt.toISOString() : '',
      ageDays: createdAt ? getDaysSince(createdAt, now) : null,
      staleDays: updatedAt ? getDaysSince(updatedAt, now) : null,
      raw: rawListing,
      salesSource: salesCandidate.source || '',
      auditWindow: 'lifetime',
      auditWindowSales: 0,
      marketingStatusKey: MARKETING_STATUS.observation.key,
      marketingStatusLabel: MARKETING_STATUS.observation.label,
      marketingStatusRank: MARKETING_STATUS.observation.rank,
      marketingStatusTone: MARKETING_STATUS.observation.tone,
      promoRecommendationPct: 0,
      promoSignalScore: 0,
      score: 0,
      scoreBreakdown: {
          sales: 0,
          views: 0,
          favorers: 0,
          favoriteRate: 0,
          age: 0,
      },
    };
  }

  function clamp(value, min = 0, max = 1) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  function getAuditWindowSales(item = {}, timeWindow = 'lifetime') {
    const normalizedWindow = String(timeWindow || 'lifetime').trim() || 'lifetime';
    const salesWindows = item?.salesWindows && typeof item.salesWindows === 'object'
      ? item.salesWindows
      : {};

    if (normalizedWindow === '7d') return Number(salesWindows['7d'] || 0) || 0;
    if (normalizedWindow === '30d') return Number(salesWindows['30d'] || 0) || 0;
    return Number(item.salesCount ?? salesWindows.lifetime ?? 0) || 0;
  }

  function getAuditWindowWeights(timeWindow = 'lifetime') {
    const normalizedWindow = String(timeWindow || 'lifetime').trim() || 'lifetime';
    if (normalizedWindow === '7d') {
      return {
        sales: 45,
        views: 15,
        favorers: 15,
        favoriteRate: 15,
        age: 10,
      };
    }
    if (normalizedWindow === 'lifetime') {
      return {
        sales: 20,
        views: 30,
        favorers: 25,
        favoriteRate: 15,
        age: 10,
      };
    }
    return {
      sales: 35,
      views: 20,
      favorers: 20,
      favoriteRate: 15,
      age: 10,
    };
  }

  function getAuditSmoothingDays(ageDays = 0) {
    const numericAgeDays = Number(ageDays || 0) || 0;
    return Math.max(21, numericAgeDays);
  }

  function getAuditConfidenceFactor(item = {}) {
    const views = Number(item.views || 0) || 0;
    return 0.35 + (clamp(views / 250) * 0.65);
  }

  function scoreAgainstTarget(value, target, weight) {
    const normalizedValue = Number(value || 0) || 0;
    const normalizedTarget = Number(target || 0) || 0;
    const normalizedWeight = Number(weight || 0) || 0;
    if (normalizedTarget <= 0 || normalizedWeight <= 0) return 0;
    return clamp(normalizedValue / normalizedTarget) * normalizedWeight;
  }

  function getPercentile(sortedValues = [], percentile = 0.5) {
    const values = Array.isArray(sortedValues)
      ? sortedValues.map((value) => Number(value || 0)).filter((value) => Number.isFinite(value)).sort((left, right) => left - right)
      : [];
    if (!values.length) return 0;
    const normalizedPercentile = clamp(Number(percentile || 0), 0, 1);
    const position = (values.length - 1) * normalizedPercentile;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    if (lowerIndex === upperIndex) return values[lowerIndex];
    const weight = position - lowerIndex;
    return (values[lowerIndex] * (1 - weight)) + (values[upperIndex] * weight);
  }

  function scoreMetricRelative(value, stats = {}, options = {}) {
    const numericValue = Math.max(0, Number(value || 0) || 0);
    const median = Math.max(0, Number(stats.median || 0) || 0);
    const p75 = Math.max(median, Number(stats.p75 || 0) || 0);
    const p90 = Math.max(p75, Number(stats.p90 || 0) || 0);
    const ceiling = Math.max(p90, Number(stats.max || 0) || 0);
    const floorTop = Math.max(p90, ceiling);
    const lowCap = Number(options.lowCap || 40) || 40;
    const midCap = Number(options.midCap || 70) || 70;
    const highCap = Number(options.highCap || 90) || 90;

    if (numericValue <= 0) return 0;
    if (median <= 0) {
      return clamp(numericValue / Math.max(1, floorTop)) * 100;
    }
    if (numericValue <= median) {
      return clamp(numericValue / median) * lowCap;
    }
    if (numericValue <= p75 && p75 > median) {
      return lowCap + (clamp((numericValue - median) / (p75 - median)) * (midCap - lowCap));
    }
    if (numericValue <= p90 && p90 > p75) {
      return midCap + (clamp((numericValue - p75) / (p90 - p75)) * (highCap - midCap));
    }
    if (floorTop > p90) {
      return highCap + (clamp((numericValue - p90) / (floorTop - p90)) * (100 - highCap));
    }
    return 100;
  }

  function computeAuditScores(items = [], options = {}) {
    const source = Array.isArray(items) ? items : [];
    const timeWindow = String(options.timeWindow || 'lifetime').trim() || 'lifetime';
    const matureNonValidatedItems = source.filter((item) => {
      const ageDays = Number(item?.ageDays || 0) || 0;
      const lifetimeSales = Number(item?.salesCount || 0) || 0;
      return ageDays >= 21 && lifetimeSales < 3;
    });

    const cohortStats = {
      viewsPer30: {
        median: getPercentile(matureNonValidatedItems.map((item) => ((Number(item?.views || 0) || 0) / getAuditSmoothingDays(item?.ageDays || 0)) * 30), 0.5),
        p75: getPercentile(matureNonValidatedItems.map((item) => ((Number(item?.views || 0) || 0) / getAuditSmoothingDays(item?.ageDays || 0)) * 30), 0.75),
        p90: getPercentile(matureNonValidatedItems.map((item) => ((Number(item?.views || 0) || 0) / getAuditSmoothingDays(item?.ageDays || 0)) * 30), 0.9),
        max: getPercentile(matureNonValidatedItems.map((item) => ((Number(item?.views || 0) || 0) / getAuditSmoothingDays(item?.ageDays || 0)) * 30), 1),
      },
      favorersPer30: {
        median: getPercentile(matureNonValidatedItems.map((item) => ((Number(item?.favorers || 0) || 0) / getAuditSmoothingDays(item?.ageDays || 0)) * 30), 0.5),
        p75: getPercentile(matureNonValidatedItems.map((item) => ((Number(item?.favorers || 0) || 0) / getAuditSmoothingDays(item?.ageDays || 0)) * 30), 0.75),
        p90: getPercentile(matureNonValidatedItems.map((item) => ((Number(item?.favorers || 0) || 0) / getAuditSmoothingDays(item?.ageDays || 0)) * 30), 0.9),
        max: getPercentile(matureNonValidatedItems.map((item) => ((Number(item?.favorers || 0) || 0) / getAuditSmoothingDays(item?.ageDays || 0)) * 30), 1),
      },
      favoriteRatePercent: {
        median: getPercentile(matureNonValidatedItems.map((item) => Number(item?.favoriteRatePercent || 0) || 0), 0.5),
        p75: getPercentile(matureNonValidatedItems.map((item) => Number(item?.favoriteRatePercent || 0) || 0), 0.75),
        p90: getPercentile(matureNonValidatedItems.map((item) => Number(item?.favoriteRatePercent || 0) || 0), 0.9),
        max: getPercentile(matureNonValidatedItems.map((item) => Number(item?.favoriteRatePercent || 0) || 0), 1),
      },
    };

    const scoredItems = source.map((item) => {
      const windowSales = getAuditWindowSales(item, timeWindow);
      const ageDays = Number(item.ageDays || 0) || 0;
      const smoothingDays = getAuditSmoothingDays(ageDays);
      const views = Number(item.views || 0) || 0;
      const favorers = Number(item.favorers || 0) || 0;
      const favoriteRatePercent = Number(item.favoriteRatePercent || 0) || 0;
      const viewsPerDay = views / smoothingDays;
      const favorersPerDay = favorers / smoothingDays;
      const salesPer30Days = (windowSales / smoothingDays) * 30;
      const viewsPer30 = viewsPerDay * 30;
      const favorersPer30 = favorersPerDay * 30;
      const confidenceFactor = getAuditConfidenceFactor(item);
      const viewsScore = (scoreMetricRelative(viewsPer30, cohortStats.viewsPer30) * 0.25) * confidenceFactor;
      const favorersScore = (scoreMetricRelative(favorersPer30, cohortStats.favorersPer30) * 0.30) * confidenceFactor;
      const favoriteRateScore = (scoreMetricRelative(favoriteRatePercent, cohortStats.favoriteRatePercent) * 0.35) * confidenceFactor;
      const salesScore = scoreAgainstTarget(salesPer30Days, 3, 6) * confidenceFactor;
      const lifetimeSalesScore = scoreAgainstTarget(windowSales, 2, 4);
      const ageScore = clamp(ageDays / 90) * 10;
      const score = Math.round((viewsScore + favorersScore + favoriteRateScore + salesScore + lifetimeSalesScore + ageScore) * 10) / 10;

      return {
        ...item,
        auditWindow: timeWindow,
        auditWindowSales: windowSales,
        marketingStatusKey: MARKETING_STATUS.observation.key,
        marketingStatusLabel: MARKETING_STATUS.observation.label,
        marketingStatusRank: MARKETING_STATUS.observation.rank,
        marketingStatusTone: MARKETING_STATUS.observation.tone,
        score,
        scoreBreakdown: {
          sales: Math.round(salesScore * 10) / 10,
          views: Math.round(viewsScore * 10) / 10,
          favorers: Math.round(favorersScore * 10) / 10,
          favoriteRate: Math.round(favoriteRateScore * 10) / 10,
          age: Math.round(ageScore * 10) / 10,
          lifetimeSales: Math.round(lifetimeSalesScore * 10) / 10,
          confidence: Math.round(confidenceFactor * 100) / 100,
          viewsPer30: Math.round(viewsPer30 * 100) / 100,
          favorersPer30: Math.round(favorersPer30 * 100) / 100,
          viewsPerDay: Math.round(viewsPerDay * 100) / 100,
          favorersPerDay: Math.round(favorersPerDay * 100) / 100,
          salesPer30Days: Math.round(salesPer30Days * 100) / 100,
        },
      };
    });

    const matureSorted = scoredItems
      .filter((item) => {
        const ageDays = Number(item?.ageDays || 0) || 0;
        const lifetimeSales = Number(item?.salesCount || 0) || 0;
        return ageDays >= 21 && lifetimeSales < 3;
      })
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0));

    const matureCount = matureSorted.length;
    const promoteTargetCount = Math.max(1, Math.round(matureCount * 0.22));
    const reworkTargetCount = Math.max(1, Math.round(matureCount * 0.28));
    const absolutePromoteCandidates = matureSorted.filter((item) => {
      const score = Number(item?.score || 0) || 0;
      return score >= 50;
    });
    const relativePromoteCandidates = matureSorted
      .filter((item, index) => {
        if (index >= promoteTargetCount) return false;
        const views = Number(item?.views || 0) || 0;
        const favorers = Number(item?.favorers || 0) || 0;
        const favoriteRatePercent = Number(item?.favoriteRatePercent || 0) || 0;
        return views >= 80 || favorers >= 4 || favoriteRatePercent >= 3.5;
      });
    const promoteSet = new Set(
      [...absolutePromoteCandidates, ...relativePromoteCandidates]
        .map((item) => String(item.listingId || '').trim())
        .filter(Boolean)
    );
    const reworkCandidates = [...matureSorted]
      .reverse()
      .filter((item) => {
        const ageDays = Number(item?.ageDays || 0) || 0;
        const lifetimeSales = Number(item?.salesCount || 0) || 0;
        const score = Number(item?.score || 0) || 0;
        const favorers = Number(item?.favorers || 0) || 0;
        const favoriteRatePercent = Number(item?.favoriteRatePercent || 0) || 0;
        const views = Number(item?.views || 0) || 0;
        const hasMeaningfulInterestSignal = (
          score >= 35
          || favorers >= 8
          || favoriteRatePercent >= 6
          || views >= 250
        );
        return ageDays >= 120 && lifetimeSales <= 1 && !hasMeaningfulInterestSignal;
      })
      .slice(0, reworkTargetCount);
    const reworkSet = new Set(
      reworkCandidates
        .map((item) => String(item.listingId || '').trim())
        .filter(Boolean)
    );

    return scoredItems.map((item) => {
      const listingId = String(item?.listingId || '').trim();
      const ageDays = Number(item?.ageDays || 0) || 0;
      const lifetimeSales = Number(item?.salesCount || 0) || 0;
      const isZeroSaleLegacy = ageDays >= 180 && lifetimeSales === 0;
      let marketingStatus = MARKETING_STATUS.observation;
      if (ageDays < 21) {
        marketingStatus = MARKETING_STATUS.recent;
      } else if (lifetimeSales >= 3) {
        marketingStatus = MARKETING_STATUS.validated;
      } else if (isZeroSaleLegacy) {
        marketingStatus = MARKETING_STATUS.rework;
      } else if (listingId && promoteSet.has(listingId)) {
        marketingStatus = MARKETING_STATUS.promote;
      } else if (listingId && reworkSet.has(listingId)) {
        marketingStatus = MARKETING_STATUS.rework;
      }
      return {
        ...item,
        marketingStatusKey: marketingStatus.key,
        marketingStatusLabel: marketingStatus.label,
        marketingStatusRank: marketingStatus.rank,
        marketingStatusTone: marketingStatus.tone,
      };
    }).map((item) => {
      const statusKey = String(item?.marketingStatusKey || '').trim();
      const score = Number(item?.score || 0) || 0;
      const views = Number(item?.views || 0) || 0;
      const favorers = Number(item?.favorers || 0) || 0;
      const favoriteRatePercent = Number(item?.favoriteRatePercent || 0) || 0;
      const salesCount = Number(item?.salesCount || 0) || 0;
      const ageDays = Number(item?.ageDays || 0) || 0;

      let promoSignalScore = 0;

      if (score >= 75) promoSignalScore += 3;
      else if (score >= 60) promoSignalScore += 2;
      else if (score >= 45) promoSignalScore += 1;

      if (views >= 300) promoSignalScore += 2;
      else if (views >= 150) promoSignalScore += 1;

      if (favorers >= 12) promoSignalScore += 2;
      else if (favorers >= 6) promoSignalScore += 1;

      if (favoriteRatePercent >= 6) promoSignalScore += 2;
      else if (favoriteRatePercent >= 3.5) promoSignalScore += 1;

      const statusWeight = statusKey === MARKETING_STATUS.promote.key
        ? 45
        : statusKey === MARKETING_STATUS.rework.key
          ? 30
          : statusKey === MARKETING_STATUS.observation.key
            ? 18
            : statusKey === MARKETING_STATUS.validated.key
              ? 8
              : 0;

      const scoreWeight = score >= 80
        ? 20
        : score >= 65
          ? 15
          : score >= 50
            ? 10
            : score >= 35
              ? 5
              : 0;

      const viewsWeight = views >= 500
        ? 10
        : views >= 250
          ? 7
          : views >= 100
            ? 4
            : 0;

      const favorersWeight = favorers >= 20
        ? 10
        : favorers >= 10
          ? 7
          : favorers >= 5
            ? 4
            : 0;

      const favoriteRateWeight = favoriteRatePercent >= 8
        ? 10
        : favoriteRatePercent >= 5
          ? 7
          : favoriteRatePercent >= 3
            ? 4
            : 0;

      const salesWeight = salesCount === 0
        ? 8
        : salesCount === 1
          ? 3
          : salesCount === 2
            ? -4
            : salesCount >= 6
              ? -18
              : -12;

      const ageWeight = ageDays >= 180
        ? 6
        : ageDays >= 90
          ? 3
          : ageDays >= 21
            ? 0
            : -15;

      const promoDecisionScore = Math.max(
        0,
        statusWeight
          + scoreWeight
          + viewsWeight
          + favorersWeight
          + favoriteRateWeight
          + salesWeight
          + ageWeight
      );

      let promoRecommendationPct = 10;
      if (promoDecisionScore >= 65) {
        promoRecommendationPct = 25;
      } else if (promoDecisionScore >= 45) {
        promoRecommendationPct = 20;
      } else if (promoDecisionScore >= 25) {
        promoRecommendationPct = 15;
      }

      return {
        ...item,
        promoSignalScore,
        promoDecisionScore,
        promoRecommendationPct,
      };
    });
  }

  function formatAuditNumber(value) {
    if (value === null || value === undefined || value === '') return '-';
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString('fr-FR') : '-';
  }

  function formatAuditPercent(value, digits = 1) {
    if (value === null || value === undefined || value === '') return '-';
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? `${numeric.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`
      : '-';
  }

  function formatAuditMoney(value, currencyCode = 'EUR') {
    if (value === null || value === undefined || value === '') return '-';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    try {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: String(currencyCode || 'EUR').trim() || 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric);
    } catch (error) {
      return `${numeric.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode || 'EUR'}`;
    }
  }

  global.PipelineUIEtsyData = {
    ...EtsyData,
    AUDIT_WINDOWS,
    MARKETING_STATUS,
    normalizeAuditCollection,
    normalizeAuditSections,
    normalizeAuditListing,
    getAuditWindowSales,
    computeAuditScores,
    formatAuditNumber,
    formatAuditPercent,
    formatAuditMoney,
  };
})(window);
