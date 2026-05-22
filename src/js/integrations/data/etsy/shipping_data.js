(function initPipelineUIEtsyShippingData(global) {
  'use strict';

  const EtsyData = global.PipelineUIEtsyData || {};

  function normalizeShippingDraftId(value) {
    const normalized = String(value || '').trim();
    return normalized;
  }

  function normalizeNumericId(value) {
    const normalized = normalizeShippingDraftId(value);
    if (!normalized) return '';
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : normalized;
  }

  function extractResults(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      if (Array.isArray(value.results)) return value.results;
      if (Array.isArray(value.data)) return value.data;
      if (Array.isArray(value.items)) return value.items;
      if (value.payload && typeof value.payload === 'object') {
        return extractResults(value.payload.data || value.payload.results || value.payload);
      }
    }
    return [];
  }

  function normalizeShippingProfileEntry(entry, index = 0) {
    if (!entry || typeof entry !== 'object') return null;
    const id = normalizeShippingDraftId(entry.shipping_profile_id || entry.shippingProfileId || entry.profile_id || entry.id);
    if (!id) return null;

    const title = String(entry.title || entry.name || `Profil livraison ${index + 1}`).trim();
    return {
      id,
      title: title || `Profil livraison ${index + 1}`,
    };
  }

  function normalizeReadinessStateEntry(entry, index = 0) {
    if (!entry || typeof entry !== 'object') return null;
    const id = normalizeShippingDraftId(entry.readiness_state_id || entry.readinessStateId || entry.id);
    if (!id) return null;

    const stateLabel = String(entry.readiness_state || entry.readinessState || '').trim();
    const minProcessingTime = Number(
      entry.min_processing_days
      || entry.min_processing_time
      || entry.minProcessingDays
      || entry.minProcessingTime
      || 0
    ) || 0;
    const maxProcessingTime = Number(
      entry.max_processing_days
      || entry.max_processing_time
      || entry.maxProcessingDays
      || entry.maxProcessingTime
      || 0
    ) || 0;
    const displayLabel = String(entry.processing_days_display_label || entry.processingDaysDisplayLabel || '').trim();
    const timingLabel = translateProcessingDisplayLabel(displayLabel) || formatProcessingTimeLabel(minProcessingTime, maxProcessingTime, 'days');

    return {
      id,
      label: formatProcessingStateLabel(stateLabel) || `Profil traitement ${index + 1}`,
      meta: timingLabel,
    };
  }

  function normalizeShippingProfilesPayload(payload) {
    return extractResults(payload)
      .map(normalizeShippingProfileEntry)
      .filter(Boolean);
  }

  function normalizeReadinessStatesPayload(payload) {
    return extractResults(payload)
      .map(normalizeReadinessStateEntry)
      .filter(Boolean);
  }

  function formatProcessingStateLabel(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'made_to_order') return 'Realise sur commande';
    if (normalized === 'ready_to_ship') return 'Pret a expédier';
    return normalized
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function formatProcessingTimeLabel(minValue, maxValue, unitValue) {
    const min = Number(minValue || 0) || 0;
    const max = Number(maxValue || 0) || 0;
    const unit = String(unitValue || '').trim().toLowerCase();
    if (!min && !max) return '';

    const rangeLabel = min && max
      ? `${min}-${max}`
      : String(min || max);

    if (unit === 'weeks') return `${rangeLabel} semaine(s)`;
    if (unit === 'days') return `${rangeLabel} jour(s)`;
    return `${rangeLabel}`;
  }

  function translateProcessingDisplayLabel(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    return normalized
      .replace(/\bweeks\b/g, 'semaines')
      .replace(/\bweek\b/g, 'semaine')
      .replace(/\bdays\b/g, 'jours')
      .replace(/\bday\b/g, 'jour');
  }

  function buildProcessingProfileSummary(data) {
    const shipping = data?.shipping && typeof data.shipping === 'object' ? data.shipping : {};
    const readinessState = String(
      data?.readiness_state
      || shipping.readiness_state
      || ''
    ).trim();

    const minProcessingTime = data?.min_processing_time
      ?? data?.min_processing_days
      ?? shipping.min_processing_time
      ?? shipping.min_processing_days
      ?? '';
    const maxProcessingTime = data?.max_processing_time
      ?? data?.max_processing_days
      ?? shipping.max_processing_time
      ?? shipping.max_processing_days
      ?? '';
    const displayLabel = String(
      data?.processing_days_display_label
      || shipping.processing_days_display_label
      || ''
    ).trim();
    const processingTimeUnit = data?.processing_time_unit
      || shipping.processing_time_unit
      || (shipping.min_processing_days || shipping.max_processing_days ? 'days' : '');

    const label = formatProcessingStateLabel(readinessState) || 'Profil de traitement source';
    const meta = translateProcessingDisplayLabel(displayLabel) || formatProcessingTimeLabel(minProcessingTime, maxProcessingTime, processingTimeUnit);

    return {
      label,
      meta,
    };
  }

  function buildShippingDraftFromPayload(mediaPayload) {
    const data = mediaPayload?.data || {};
    const processingSummary = buildProcessingProfileSummary(data);
    return {
      processingProfileId: normalizeShippingDraftId(data.readiness_state_id),
      processingProfileLabel: processingSummary.label,
      processingProfileMeta: processingSummary.meta,
      shippingProfileId: normalizeShippingDraftId(data.shipping_profile_id),
      processingProfiles: [],
      shippingProfiles: [],
    };
  }

  function applyShippingDraftToPayload(data, draft) {
    if (!data || typeof data !== 'object' || !draft || typeof draft !== 'object') return data;

    const readinessStateId = normalizeNumericId(draft.processingProfileId);
    const shippingProfileId = normalizeNumericId(draft.shippingProfileId);

    if (readinessStateId) {
      data.readiness_state_id = readinessStateId;
    }
    if (shippingProfileId) {
      data.shipping_profile_id = shippingProfileId;
    }

    return data;
  }

  global.PipelineUIEtsyData = {
    ...EtsyData,
    normalizeShippingDraftId,
    normalizeNumericId,
    normalizeShippingProfileEntry,
    normalizeReadinessStateEntry,
    normalizeShippingProfilesPayload,
    normalizeReadinessStatesPayload,
    formatProcessingStateLabel,
    formatProcessingTimeLabel,
    translateProcessingDisplayLabel,
    buildProcessingProfileSummary,
    buildShippingDraftFromPayload,
    applyShippingDraftToPayload,
  };
})(window);
