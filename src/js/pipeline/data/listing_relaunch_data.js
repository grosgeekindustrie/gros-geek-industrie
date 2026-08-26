'use strict';

(function initPipelineUIListingRelaunchData(global) {
  global.PipelineUI = global.PipelineUI || {};

  function buildListingNameFromTitle(title = '') {
    const normalized = String(title || '').trim();
    if (!normalized) return 'Figurine';
    const head = normalized.replace(/\s+/g, ' ').split(/[,:|/-]/)[0].trim();
    return head.slice(0, 80) || normalized;
  }

  function normalizeScaleLabel(value = '') {
    return String(value || '')
      .replace(/&(?:gt|#62);/gi, '>')
      .replace(/\s+/g, '')
      .replace(':', '/')
      .toLowerCase();
  }

  function extractDescriptionField(description = '', labels = []) {
    const normalizedDescription = String(description || '').replace(/\r\n?/g, '\n');
    for (const label of labels) {
      const escapedLabel = String(label || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = normalizedDescription.match(new RegExp(
        `(?:^|\\n)\\s*(?:[•*+-]\\s*)?${escapedLabel}\\s*:\\s*([^\\n]+)`,
        'i'
      ));
      if (match?.[1]) return match[1].trim();
    }
    return '';
  }

  function parseDescriptionScales(description = '') {
    const scales = new Map();
    const lines = String(description || '').replace(/\r\n?/g, '\n').split('\n');
    const dimensionPattern = /^\s*(?:[•*+-]\s*)?([^:=⇒→]{1,40}?)\s*(?:=>|⇒|→)\s*(\d+(?:[.,]\d+)?)\s*mm(?:\s*[×x*]\s*(\d+(?:[.,]\d+)?)\s*mm)?(?:\s*[×x*]\s*(\d+(?:[.,]\d+)?)\s*mm)?\s*$/i;

    lines.forEach((line) => {
      const match = line.match(dimensionPattern);
      if (!match) return;
      const label = String(match[1] || '').trim();
      const dimensions = [match[2], match[3], match[4]]
        .filter(Boolean)
        .map((value) => `${String(value).replace(',', '.')}mm`)
        .join(' * ');
      if (label && dimensions) scales.set(normalizeScaleLabel(label), { label, dimensions });
    });
    return scales;
  }

  function mergeInventoryScales(scales, inventory = {}) {
    const products = Array.isArray(inventory.products) ? inventory.products : [];
    products.forEach((product) => {
      const properties = Array.isArray(product?.property_values) ? product.property_values : [];
      const scaleProperty = properties.find((property) => (
        Number(property?.property_id || 0) === 513
        || /choose your scale|echelle|échelle/i.test(String(property?.property_name || ''))
      ));
      const rawValue = String(scaleProperty?.values?.[0] || '')
        .replace(/&(?:gt|#62);/gi, '>')
        .trim();
      const match = rawValue.match(/^(.+?)\s*(?:=>|⇒|→)\s*(\d+(?:[.,]\d+)?)\s*mm/i);
      if (!match) return;
      const label = String(match[1] || '').trim();
      const key = normalizeScaleLabel(label);
      if (!key || scales.has(key)) return;
      scales.set(key, {
        label,
        dimensions: `${String(match[2]).replace(',', '.')}mm`,
      });
    });
    return scales;
  }

  function buildFormPrefill(source = {}) {
    const description = String(source.description || '');
    const overrides = source.overrides || {};
    const fullName = String(
      overrides.nom
      || extractDescriptionField(description, ['Personnage', 'Character'])
      || buildListingNameFromTitle(source.title)
    ).trim();
    const scales = mergeInventoryScales(parseDescriptionScales(description), source.inventory);

    return {
      fullName,
      shortName: fullName,
      universe: String(
        overrides.univers
        || extractDescriptionField(description, ['Univers', 'Universe'])
      ).trim(),
      sculptor: extractDescriptionField(description, ['Sculpteur', 'Sculptor', 'Sculpté par', 'Sculpted by']),
      pieces: extractDescriptionField(description, ['Nombre de pièces', 'Number of pieces', 'Number of parts', 'Pieces', 'Parts']),
      instructions: String(overrides.instructions || '').trim(),
      scales,
      originHeight: Number(source.originHeight || 0) || null,
    };
  }

  global.PipelineUIListingRelaunchData = {
    buildListingNameFromTitle,
    normalizeScaleLabel,
    extractDescriptionField,
    parseDescriptionScales,
    mergeInventoryScales,
    buildFormPrefill,
  };
  global.PipelineUI.data = global.PipelineUI.data || {};
  global.PipelineUI.data.listingRelaunch = global.PipelineUIListingRelaunchData;
})(window);
