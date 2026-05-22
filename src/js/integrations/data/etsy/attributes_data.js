(function initPipelineUIEtsyAttributesData(global) {
  'use strict';

  const EtsyData = global.PipelineUIEtsyData || {};

  const ETSY_MAX_TAGS = 13;
  const ETSY_MAX_TAG_LENGTH = 30;
  const ATTRIBUTE_DIMENSION_UNITS = Object.freeze([
    { value: 'mm', label: 'Millimetres (mm)' },
    { value: 'cm', label: 'Centimetres (cm)' },
  ]);
  const ATTRIBUTE_OCCASION_OPTIONS = Object.freeze([
    { value: '', label: 'Aucune fete' },
    { value: 'christmas', label: 'Noel' },
    { value: 'halloween', label: 'Halloween' },
    { value: 'birthday', label: 'Anniversaire' },
  ]);

  function normalizeAttributeTag(value = '') {
    const normalized = String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized || normalized.length > ETSY_MAX_TAG_LENGTH) return '';
    return normalized;
  }

  function normalizeAttributeTags(values = []) {
    const source = Array.isArray(values) ? values : [values];
    return source
      .map((value) => normalizeAttributeTag(value))
      .filter(Boolean)
      .slice(0, ETSY_MAX_TAGS);
  }

  function parseAttributeTagsInput(value = '') {
    return normalizeAttributeTags(String(value || '').split(','));
  }

  function normalizeDimensionValue(value) {
    if (value === null || value === undefined || value === '') return '';
    const parsed = Number.parseFloat(String(value).replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return '';
    return String(parsed);
  }

  function normalizeDimensionUnit(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    return ATTRIBUTE_DIMENSION_UNITS.some((option) => option.value === normalized)
      ? normalized
      : ATTRIBUTE_DIMENSION_UNITS[0].value;
  }

  function normalizeOccasion(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    return ATTRIBUTE_OCCASION_OPTIONS.some((option) => option.value === normalized)
      ? normalized
      : '';
  }

  function inferOccasionFromListingData(data = {}) {
    const tags = Array.isArray(data.tags)
      ? data.tags.map((value) => String(value || '').trim().toLowerCase())
      : [];
    const haystack = [
      ...tags,
      String(data.title || '').trim().toLowerCase(),
      String(data.description || '').trim().toLowerCase(),
    ].join(' \n ');

    if (!haystack) return '';
    if (/\b(halloween|haloween)\b/.test(haystack)) return 'halloween';
    if (/\b(noel|noël|christmas|xmas)\b/.test(haystack)) return 'christmas';
    if (/\b(anniversaire|birthday)\b/.test(haystack)) return 'birthday';
    return '';
  }

  function buildAttributesDraftFromPayload(mediaPayload) {
    const data = EtsyData.normalizeEtsyListingPayload?.(mediaPayload)?.data || {};
    const tags = Array.isArray(data.tags)
      ? data.tags
      : typeof data.tags === 'string'
        ? data.tags.split(',')
        : [];

    return {
      tags: normalizeAttributeTags(tags),
      pendingTagsInput: '',
      dimensions: {
        height: normalizeDimensionValue(data.item_height),
        width: normalizeDimensionValue(data.item_width),
        depth: normalizeDimensionValue(data.item_length),
        unit: normalizeDimensionUnit(data.item_dimensions_unit),
      },
      occasion: inferOccasionFromListingData(data),
    };
  }

  function applyAttributesDraftToPayload(data, draft) {
    if (!data || typeof data !== 'object' || !draft || typeof draft !== 'object') return data;

    data.tags = normalizeAttributeTags(draft.tags);

    const height = normalizeDimensionValue(draft.dimensions?.height);
    const width = normalizeDimensionValue(draft.dimensions?.width);
    const depth = normalizeDimensionValue(draft.dimensions?.depth);
    const hasDimensions = !!(height || width || depth);

    data.item_height = height ? Number(height) : null;
    data.item_width = width ? Number(width) : null;
    data.item_length = depth ? Number(depth) : null;
    data.item_dimensions_unit = hasDimensions
      ? normalizeDimensionUnit(draft.dimensions?.unit)
      : null;

    return data;
  }

  global.PipelineUIEtsyData = {
    ...EtsyData,
    ETSY_MAX_TAGS,
    ETSY_MAX_TAG_LENGTH,
    ATTRIBUTE_DIMENSION_UNITS,
    ATTRIBUTE_OCCASION_OPTIONS,
    normalizeAttributeTag,
    normalizeAttributeTags,
    parseAttributeTagsInput,
    normalizeDimensionValue,
    normalizeDimensionUnit,
    normalizeOccasion,
    inferOccasionFromListingData,
    buildAttributesDraftFromPayload,
    applyAttributesDraftToPayload,
  };
})(window);
