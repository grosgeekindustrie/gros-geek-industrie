'use strict';

// Moteur pur de suggestion des prix FR par echelle.
// Il ne touche ni au DOM ni au formulaire : pricing_ui reste responsable de l'interface.
(function initPricingGridAssistant(global) {
  const STORAGE_KEY = 'figurinePricingReferenceGridsV1';
  const MAX_REFERENCE_GRIDS = 100;

  const readNumber = (value) => {
    const number = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(number) ? number : NaN;
  };

  const normalizeScaleKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '');

  const parseRatioDenominator = (value) => {
    const match = normalizeScaleKey(value).match(/^1[/:](\d+(?:[.,]\d+)?)$/);
    if (!match) return null;
    const denominator = Number(match[1].replace(',', '.'));
    return Number.isFinite(denominator) && denominator > 0 ? denominator : null;
  };

  const nominalPrice = (value) => {
    const price = readNumber(value);
    if (!Number.isFinite(price) || price <= 0) return null;
    const cents = Math.round((price - Math.floor(price)) * 100);
    return cents === 99 ? price + 0.01 : price;
  };

  const commercialPrice = (value) => {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.max(4.99, Math.round(value / 5) * 5 - 0.01);
  };

  const readAll = () => {
    try {
      const grids = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(grids) ? grids : [];
    } catch (error) {
      return [];
    }
  };

  const writeAll = (grids) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(grids.slice(-MAX_REFERENCE_GRIDS)));
  };

  const isSameScope = (grid, scope) => grid.shop === scope.shop && grid.mode === scope.mode;
  const getReferences = (scope) => readAll().filter((grid) => isSameScope(grid, scope));

  const median = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  const getAnchorPair = (target, anchors) => {
    const sorted = [...anchors].sort((a, b) => a.coordinate - b.coordinate);
    if (sorted.length < 2) return null;
    if (target.coordinate <= sorted[0].coordinate) return [sorted[0], sorted[1]];
    if (target.coordinate >= sorted.at(-1).coordinate) return [sorted.at(-2), sorted.at(-1)];

    for (let index = 0; index < sorted.length - 1; index += 1) {
      if (target.coordinate > sorted[index].coordinate && target.coordinate < sorted[index + 1].coordinate) {
        return [sorted[index], sorted[index + 1]];
      }
    }
    return null;
  };

  const predictFromReferences = (target, firstAnchor, secondAnchor, references) => {
    const targetKey = normalizeScaleKey(target.label);
    const firstKey = normalizeScaleKey(firstAnchor.label);
    const secondKey = normalizeScaleKey(secondAnchor.label);
    const positions = references.map((grid) => {
      const first = nominalPrice(grid.prices?.[firstKey]);
      const second = nominalPrice(grid.prices?.[secondKey]);
      const current = nominalPrice(grid.prices?.[targetKey]);
      if (![first, second, current].every(Number.isFinite) || Math.abs(second - first) < 0.01) return null;
      const position = (current - first) / (second - first);
      return Number.isFinite(position) && position > -5 && position < 5 ? position : null;
    }).filter(Number.isFinite);
    const historicalPosition = median(positions);
    if (!Number.isFinite(historicalPosition)) return null;
    return firstAnchor.price + historicalPosition * (secondAnchor.price - firstAnchor.price);
  };

  // Progression proportionnelle entre deux prix commerciaux. La coordonnee est le
  // denominateur de l'echelle, jamais une estimation physique du volume de la piece.
  const predictProportionally = (target, firstAnchor, secondAnchor) => {
    const span = secondAnchor.coordinate - firstAnchor.coordinate;
    if (!span || !(firstAnchor.price > 0) || !(secondAnchor.price > 0)) return null;
    const position = (target.coordinate - firstAnchor.coordinate) / span;
    return firstAnchor.price * ((secondAnchor.price / firstAnchor.price) ** position);
  };

  const calculate = ({ entries, rows, scope, useReferences = true }) => {
    const ratioEntries = entries.map((entry) => {
      const denominator = parseRatioDenominator(entry.label);
      const row = rows[entry.key] || {};
      return {
        ...entry,
        coordinate: Number.isFinite(denominator) ? -denominator : null,
        price: nominalPrice(row.priceFr),
        source: row.source || (row.priceFr ? 'manual' : ''),
      };
    }).filter((entry) => Number.isFinite(entry.coordinate));
    const anchors = ratioEntries.filter((entry) => Number.isFinite(entry.price) && entry.source !== 'calculated');
    if (anchors.length < 2) return { error: 'Saisis au moins deux prix de référence sur des échelles de type 1/x.' };

    const references = useReferences ? getReferences(scope) : [];
    const updates = {};
    let historyCount = 0;

    ratioEntries.forEach((entry) => {
      if (entry.source !== 'calculated' && Number.isFinite(entry.price)) return;
      const pair = getAnchorPair(entry, anchors);
      if (!pair) return;
      const historical = references.length ? predictFromReferences(entry, pair[0], pair[1], references) : null;
      const predicted = Number.isFinite(historical)
        ? historical
        : predictProportionally(entry, pair[0], pair[1]);
      const price = commercialPrice(predicted);
      if (!Number.isFinite(price)) return;
      updates[entry.key] = { priceFr: price.toFixed(2), source: 'calculated' };
      if (Number.isFinite(historical)) historyCount += 1;
    });

    return {
      updates,
      calculatedCount: Object.keys(updates).length,
      historyCount,
      ignoredCount: entries.length - ratioEntries.length,
    };
  };

  const saveReference = ({ entries, rows, scope }) => {
    const prices = {};
    entries.forEach((entry) => {
      const price = readNumber(rows[entry.key]?.priceFr);
      if (Number.isFinite(price) && price > 0) prices[normalizeScaleKey(entry.label)] = Number(price.toFixed(2));
    });
    if (Object.keys(prices).length < 2) return { error: 'Une référence doit contenir au moins deux prix valides.' };

    const signature = JSON.stringify(prices);
    const grids = readAll().filter((grid) => !(isSameScope(grid, scope) && JSON.stringify(grid.prices) === signature));
    grids.push({ ...scope, prices, createdAt: new Date().toISOString() });
    writeAll(grids);
    return { priceCount: Object.keys(prices).length, referenceCount: getReferences(scope).length };
  };

  const clearReferences = (scope) => {
    const count = getReferences(scope).length;
    if (count) writeAll(readAll().filter((grid) => !isSameScope(grid, scope)));
    return count;
  };

  global.PipelinePricingGridAssistant = {
    calculate,
    saveReference,
    clearReferences,
    getReferenceCount: (scope) => getReferences(scope).length,
  };
})(window);
