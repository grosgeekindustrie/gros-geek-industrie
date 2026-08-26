(function initPipelineUIEtsyTaxonomyData(global) {
  'use strict';

  const EtsyData = global.PipelineUIEtsyData || {};
  const splitCategoryPath = EtsyData.splitCategoryPath || ((value = '') => String(value || '').split('>').map((part) => part.trim()).filter(Boolean));

  function normalizeTaxonomyEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;

    const taxonomyId = String(entry.taxonomy_id || entry.id || '').trim();
    if (!taxonomyId) return null;

    const path = Array.isArray(entry.path)
      ? entry.path.map((part) => String(part || '').trim()).filter(Boolean)
      : splitCategoryPath(entry.path_text || entry.category_path || entry.name || '');
    const name = String(entry.name || path.at(-1) || `Taxonomy ${taxonomyId}`).trim();
    const pathText = String(entry.path_text || path.join(' > ') || name).trim();

    return {
      taxonomy_id: taxonomyId,
      name,
      path,
      path_text: pathText,
      level: Number(entry.level || Math.max(path.length - 1, 0)) || 0,
    };
  }

  global.PipelineUIEtsyData = {
    ...EtsyData,
    normalizeTaxonomyEntry,
  };
})(window);
