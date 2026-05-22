(function initPipelineUIEtsySettingsData(global) {
  'use strict';

  const EtsyData = global.PipelineUIEtsyData || {};

  function normalizeSettingsDraftId(value) {
    return String(value || '').trim();
  }

  function normalizeSectionEntry(entry, index = 0) {
    if (!entry || typeof entry !== 'object') return null;
    const id = normalizeSettingsDraftId(entry.shop_section_id || entry.shopSectionId || entry.section_id || entry.id);
    if (!id) return null;

    return {
      id,
      title: String(entry.title || entry.name || `Section ${index + 1}`).trim() || `Section ${index + 1}`,
    };
  }

  function normalizeSectionsPayload(payload) {
    const results = Array.isArray(payload?.payload?.data?.results)
      ? payload.payload.data.results
      : Array.isArray(payload?.results)
        ? payload.results
        : [];

    return results
      .map(normalizeSectionEntry)
      .filter(Boolean);
  }

  function buildSettingsDraftFromPayload(mediaPayload) {
    const data = mediaPayload?.data || {};
    return {
      shopSectionId: normalizeSettingsDraftId(data.shop_section_id),
      shopSections: [],
      featured: Number(data.featured_rank || 0) > 0 || data.is_featured === true,
      advertise: data.should_advertise === true,
      renewalOption: data.should_auto_renew === false ? 'manual' : 'automatic',
    };
  }

  function applySettingsDraftToPayload(data, draft) {
    if (!data || typeof data !== 'object' || !draft || typeof draft !== 'object') return data;

    const sectionId = normalizeSettingsDraftId(draft.shopSectionId);
    if (sectionId) {
      const numericSectionId = Number(sectionId);
      data.shop_section_id = Number.isFinite(numericSectionId) ? numericSectionId : sectionId;
    }

    data.featured_rank = draft.featured ? 1 : 0;
    data.should_advertise = draft.advertise === true;
    data.should_auto_renew = draft.renewalOption !== 'manual';
    return data;
  }

  global.PipelineUIEtsyData = {
    ...EtsyData,
    normalizeSettingsDraftId,
    normalizeSectionEntry,
    normalizeSectionsPayload,
    buildSettingsDraftFromPayload,
    applySettingsDraftToPayload,
  };
})(window);
