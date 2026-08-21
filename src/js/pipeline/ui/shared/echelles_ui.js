'use strict';

// Gestion des echelles et dimensions.
// Responsable de la construction DOM des cases d'echelles et des aides de calcul.
// Cette logique est specifique au pipeline produit et ne doit plus vivre dans shared/media.

(function initPipelineUIEchelles(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIEchelles = global.PipelineUIEchelles || {};

  const echellesData = global.PipelineUIDataEchelles || {};
  const TABLETOP_MODE = 'tabletop';
  const COLLECTION_MODE = 'collection';
  const TABLETOP_SCALES = echellesData.ECHELLES_BY_MODE?.tabletop || ['28mm', '32mm', '40mm', '50mm', '54mm', '75mm', '90mm', '140mm', '1/10', '1/8', '1/6', '1/5', 'Custom base'];
  const TABLETOP_DOUBLEX_SCALES = echellesData.ECHELLES_BY_MODE?.tabletop_doublex || TABLETOP_SCALES;
  const COLLECTION_SCALES = echellesData.ECHELLES_BY_MODE?.collection || ['Chibi 100%', 'Chibi upscale 125%', 'Chibi upscale 150%', 'Buste', '75mm', '140mm', '1/12', '1/10', '1/9', '1/8', '1/7', '1/6', '1/5', '1/4', '1/3'];
  const CUSTOM_COLLECTION_COUNT = Number.isInteger(echellesData.CUSTOM_COLLECTION_COUNT) ? echellesData.CUSTOM_COLLECTION_COUNT : 3;
  const DIMENSION_PLACEHOLDER = echellesData.DIMENSION_PLACEHOLDER || '224mm * 200mm * 136mm';
  const MANUAL_COLLECTION_SCALE_LABELS = new Set(['buste', '75mm']);
  const CHIBI_SCALE_FACTORS = Object.freeze({
    'chibi100%': 1,
    'chibiupscale125%': 1.25,
    'chibiupscale150%': 1.5,
  });

  const getPfx = () => global.PipelineUIShell.pfx();
  const getCurrentMode = () => global.currentMode;
  const resolveMode = (prefix = getPfx()) => (prefix === 'col' ? COLLECTION_MODE : TABLETOP_MODE);
  const isCollectionMode = (mode = getCurrentMode()) => mode === COLLECTION_MODE;
  const getActiveShopKey = () => global.PipelineUIForms?.getActiveShopKey?.() || 'grosgeek';
  const getScaleList = (mode = getCurrentMode()) => {
    if (isCollectionMode(mode)) return COLLECTION_SCALES;
    return getActiveShopKey() === 'doublex' ? TABLETOP_DOUBLEX_SCALES : TABLETOP_SCALES;
  };
  const getRowCount = (mode = getCurrentMode()) => getScaleList(mode).length + (isCollectionMode(mode) ? CUSTOM_COLLECTION_COUNT : 0);
  const getDynamicToggle = (prefix = getPfx()) => document.getElementById(`${prefix}-fDynamicEchelles`);
  const isDynamicScaleEnabled = (prefix = getPfx()) => Boolean(getDynamicToggle(prefix)?.checked);

  const notifyScaleSelectionChanged = (prefix = getPfx()) => {
    document.dispatchEvent(new CustomEvent('pipeline:scales-changed', {
      detail: { prefix },
    }));
  };

  const getRowEls = (index) => {
    const prefix = getPfx();

    return {
      row: document.getElementById(`${prefix}-ei${index}`),
      checkbox: document.getElementById(`${prefix}-ec${index}`),
      dimInput: document.getElementById(`${prefix}-ed${index}`),
      originRadio: document.getElementById(`${prefix}-eo${index}`),
      customLabel: document.getElementById(`${prefix}-elabel${index}`),
    };
  };

  const normalizeScaleLabel = (value = '') => String(value || '').replace(/\s+/g, '');
  const normalizeManualScaleLabel = (value = '') => normalizeScaleLabel(value).toLowerCase();
  const isManualCollectionScaleLabel = (label = '') => MANUAL_COLLECTION_SCALE_LABELS.has(normalizeManualScaleLabel(label));
  const isManualCollectionScale = (index, mode = getCurrentMode()) => isCollectionMode(mode) && isManualCollectionScaleLabel(getScaleLabel(index, mode));

  const parseScaleDescriptor = (label = '') => {
    const normalizedLabel = normalizeScaleLabel(label);
    const chibiFactor = CHIBI_SCALE_FACTORS[normalizedLabel.toLowerCase()];
    if (Number.isFinite(chibiFactor)) return { kind: 'chibi', value: chibiFactor };

    const ratioMatch = normalizedLabel.match(/^1[/:](\d+(?:[.,]\d+)?)$/i);
    if (ratioMatch) {
      const denominator = Number(ratioMatch[1].replace(',', '.'));
      return Number.isFinite(denominator)
        ? { kind: 'ratio', value: denominator }
        : null;
    }

    const millimeterMatch = normalizedLabel.match(/^(\d+(?:[.,]\d+)?)mm$/i);
    if (millimeterMatch) {
      const millimeters = Number(millimeterMatch[1].replace(',', '.'));
      return Number.isFinite(millimeters)
        ? { kind: 'millimeter', value: millimeters }
        : null;
    }

    return null;
  };

  const getScaleFactor = (originLabel = '', targetLabel = '') => {
    const originDescriptor = parseScaleDescriptor(originLabel);
    const targetDescriptor = parseScaleDescriptor(targetLabel);

    if (!originDescriptor || !targetDescriptor) return null;
    if (originDescriptor.kind !== targetDescriptor.kind) return null;

    if (originDescriptor.kind === 'ratio') return originDescriptor.value / targetDescriptor.value;
    if (originDescriptor.kind === 'millimeter') return targetDescriptor.value / originDescriptor.value;
    if (originDescriptor.kind === 'chibi') return targetDescriptor.value / originDescriptor.value;
    return null;
  };

  const parseDimensions = (value = '') => {
    const matches = String(value || '').match(/\d+(?:[.,]\d+)?/g) || [];
    const dimensions = matches.map((entry) => Number(entry.replace(',', '.')));

    if (dimensions.length !== 3 || dimensions.some((dimension) => !Number.isFinite(dimension))) {
      return null;
    }

    return dimensions;
  };

  const roundHalfUp = (value) => Math.floor(value + 0.5);
  const formatDimensions = (dimensions) => dimensions.map((dimension) => `${dimension}mm`).join(' * ');

  const getScaleLabel = (index, mode = getCurrentMode()) => {
    const list = getScaleList(mode);
    if (index < list.length) return list[index];
    return getRowEls(index).customLabel?.value?.trim() || '';
  };

  const supportsOriginSelection = (index, mode = getCurrentMode()) => {
    const label = getScaleLabel(index, mode);
    if (!label) return false;
    if (isManualCollectionScale(index, mode)) return false;
    return Boolean(parseScaleDescriptor(label));
  };

  const getOriginIndex = (prefix = getPfx(), mode = getCurrentMode()) => {
    if (!isDynamicScaleEnabled(prefix)) return null;

    const checked = document.querySelector(`input[name="${prefix}-origin-scale"]:checked`);
    if (!checked) return null;

    const index = Number(checked.value);
    return Number.isInteger(index) && supportsOriginSelection(index, mode) ? index : null;
  };

  const getRowDimensionSource = (index) => getRowEls(index).row?.dataset.dimensionSource || '';

  const setRowDimensionSource = (index, source = '') => {
    const { row } = getRowEls(index);
    if (!row) return;

    if (source) {
      row.dataset.dimensionSource = source;
      return;
    }

    delete row.dataset.dimensionSource;
  };

  const getFirstCheckedIndex = (mode = getCurrentMode()) => {
    for (let index = 0; index < getRowCount(mode); index += 1) {
      const { checkbox, originRadio } = getRowEls(index);
      if (checkbox?.checked && originRadio && supportsOriginSelection(index, mode)) {
        return index;
      }
    }

    return null;
  };

  const getOriginScaleDimensions = (prefix = getPfx(), mode = resolveMode(prefix)) => {
    const preferredOriginIndex = getOriginIndex(prefix, mode);
    const fallbackIndex = preferredOriginIndex ?? getFirstCheckedIndex(mode);
    if (!Number.isInteger(fallbackIndex)) return null;

    const label = String(getScaleLabel(fallbackIndex, mode) || '').trim();
    const dimensionsText = String(getRowEls(fallbackIndex).dimInput?.value || '').trim();
    const dimensions = parseDimensions(dimensionsText);
    if (!dimensions) return null;

    const [height, width, depth] = dimensions;
    return {
      index: fallbackIndex,
      label,
      height,
      width,
      depth,
      unit: 'mm',
      raw: dimensionsText,
    };
  };

  const updateOriginState = (prefix = getPfx(), mode = getCurrentMode()) => {
    const autoEnabled = isDynamicScaleEnabled(prefix);
    const originIndex = getOriginIndex(prefix, mode);

    for (let index = 0; index < getRowCount(mode); index += 1) {
      const { row, originRadio, checkbox } = getRowEls(index);
      if (!row) continue;

      const isManualScale = isManualCollectionScale(index, mode);
      const canUseOrigin = supportsOriginSelection(index, mode);
      const originToggle = originRadio?.closest('.ech-origin-toggle');
      row.classList.toggle('is-manual-scale', isManualScale);
      row.classList.toggle('is-auto-enabled', autoEnabled && canUseOrigin);

      if (originToggle) {
        originToggle.hidden = !autoEnabled || !canUseOrigin;
        originToggle.classList.toggle('is-disabled', !autoEnabled || !checkbox?.checked);
      }

      const isOrigin = autoEnabled && canUseOrigin && originIndex === index;
      row.classList.toggle('is-origin', isOrigin);
      row.dataset.origin = isOrigin ? 'true' : 'false';

      if (isOrigin && checkbox?.checked) {
        setRowDimensionSource(index, 'origin');
      } else if (getRowDimensionSource(index) === 'origin') {
        setRowDimensionSource(index);
      }

      if (originRadio) {
        originRadio.disabled = !autoEnabled || !checkbox?.checked || !canUseOrigin;
        originRadio.setAttribute('aria-checked', String(isOrigin));
      }
    }
  };

  const isAutoManagedRow = (index, mode = getCurrentMode()) => {
    if (isManualCollectionScale(index, mode)) return false;

    const { dimInput } = getRowEls(index);
    const source = getRowDimensionSource(index);
    return source !== 'manual' || !String(dimInput?.value || '').trim();
  };

  const applyAutoDimensions = (index, { shouldSave = true, force = false } = {}) => {
    const prefix = getPfx();
    const mode = getCurrentMode();
    if (!isDynamicScaleEnabled(prefix)) return false;

    const originIndex = getOriginIndex(prefix, mode);
    if (originIndex === null || originIndex === index || isManualCollectionScale(index, mode)) return false;

    const { row, dimInput: targetDimInput, checkbox: targetCheckbox } = getRowEls(index);
    if (!targetCheckbox?.checked || !targetDimInput || !row) return false;
    if (!force && !isAutoManagedRow(index)) return false;

    const originLabel = getScaleLabel(originIndex, mode);
    const targetLabel = getScaleLabel(index, mode);
    const originDimensions = parseDimensions(getRowEls(originIndex).dimInput?.value || '');
    const scaleFactor = getScaleFactor(originLabel, targetLabel);
    if (!originDimensions || !Number.isFinite(scaleFactor)) return false;

    const scaledDimensions = originDimensions.map((dimension) => roundHalfUp(dimension * scaleFactor));
    targetDimInput.value = formatDimensions(scaledDimensions);
    setRowDimensionSource(index, 'auto');

    if (shouldSave) global.saveFormState();
    return true;
  };

  const recalculateCollectionDimensions = ({ shouldSave = true, force = false } = {}) => {
    const prefix = getPfx();
    const mode = getCurrentMode();
    if (!isDynamicScaleEnabled(prefix)) {
      updateOriginState(prefix, mode);
      if (shouldSave) global.saveFormState();
      return;
    }

    updateOriginState(prefix, mode);

    for (let index = 0; index < getRowCount(mode); index += 1) {
      if (getOriginIndex(prefix, mode) === index) continue;
      applyAutoDimensions(index, { shouldSave: false, force });
    }

    if (shouldSave) global.saveFormState();
  };

  const setEchelleOrigin = (index, { shouldSave = true, recalculate = true } = {}) => {
    const prefix = getPfx();
    const mode = getCurrentMode();
    if (!isDynamicScaleEnabled(prefix)) return;

    const { checkbox, originRadio } = getRowEls(index);
    if (!checkbox?.checked || !originRadio || !supportsOriginSelection(index, mode)) return;

    originRadio.checked = true;
    updateOriginState(prefix, mode);

    if (recalculate) {
      recalculateCollectionDimensions({ shouldSave: false });
    }

    notifyScaleSelectionChanged(prefix);
    if (shouldSave) global.saveFormState();
  };

  const buildStandardRow = ({ index, label, isCollection }) => {
    const prefix = getPfx();
    const mode = isCollection ? COLLECTION_MODE : TABLETOP_MODE;
    const isManualScale = isCollection && isManualCollectionScaleLabel(label);
    const supportsOrigin = supportsOriginSelection(index, mode);
    const originControl = supportsOrigin
      ? `
      <label class="ech-origin-toggle" for="${prefix}-eo${index}">
        <input
          type="radio"
          id="${prefix}-eo${index}"
          name="${prefix}-origin-scale"
          value="${index}"
          class="ech-origin-radio"
          disabled
        />
        <span class="ech-origin-text">Origine</span>
      </label>`
      : '';
    const manualClass = isManualScale ? ' is-manual-scale' : '';

    return `
    <div class="ech-item${manualClass}" id="${prefix}-ei${index}" data-origin="false">
      <input type="checkbox" id="${prefix}-ec${index}" />
      <span class="ech-label">${label}</span>
      ${originControl}
      <input
        type="text"
        id="${prefix}-ed${index}"
        class="ech-dim-input"
        placeholder="${DIMENSION_PLACEHOLDER}"
        disabled
      />
    </div>`;
  };

  const buildCustomRow = (index) => {
    const prefix = getPfx();

    return `
    <div class="ech-item" id="${prefix}-ei${index}" data-origin="false">
      <input type="checkbox" id="${prefix}-ec${index}" />
      <input
        type="text"
        id="${prefix}-elabel${index}"
        class="ech-custom-label"
        placeholder="ex: 1/5"
      />
      <label class="ech-origin-toggle" for="${prefix}-eo${index}">
        <input
          type="radio"
          id="${prefix}-eo${index}"
          name="${prefix}-origin-scale"
          value="${index}"
          class="ech-origin-radio"
          disabled
        />
        <span class="ech-origin-text">Origine</span>
      </label>
      <input
        type="text"
        id="${prefix}-ed${index}"
        class="ech-dim-input"
        placeholder="${DIMENSION_PLACEHOLDER}"
        disabled
      />
    </div>`;
  };

  const bindRowEvents = ({ index, isCollection, isCustom }) => {
    const { checkbox, dimInput, originRadio, customLabel } = getRowEls(index);

    checkbox?.addEventListener('change', () => {
      toggleEch(index);
    });

    dimInput?.addEventListener('input', () => {
      if (isDynamicScaleEnabled()) {
        if (getOriginIndex() === index) {
          setRowDimensionSource(index, 'origin');
          recalculateCollectionDimensions({ shouldSave: false });
        } else {
          setRowDimensionSource(index, 'manual');
        }
      }

      global.saveFormState();
    });

    if (!isCollection) return;

    originRadio?.addEventListener('change', () => {
      if (originRadio.checked) setEchelleOrigin(index);
    });

    if (isCustom && customLabel) {
      customLabel.addEventListener('input', () => {
        if (getOriginIndex() === index) {
          recalculateCollectionDimensions({ shouldSave: false });
        } else {
          applyAutoDimensions(index, { shouldSave: false, force: true });
        }

        notifyScaleSelectionChanged(getPfx());
        global.saveFormState();
      });
    }
  };

  const bindEchellesUI = ({ list, isCollection }) => {
    list.forEach((_, index) => {
      bindRowEvents({ index, isCollection, isCustom: false });
    });

    if (!isCollection) return;

    for (let customOffset = 0; customOffset < CUSTOM_COLLECTION_COUNT; customOffset += 1) {
      const index = list.length + customOffset;
      bindRowEvents({ index, isCollection: true, isCustom: true });
    }
  };

  function buildEchellesUI() {
    const prefix = getPfx();
    const mode = getCurrentMode();
    const isTabletop = mode === TABLETOP_MODE;
    const list = getScaleList(mode);

    let html = list.map((label, index) => buildStandardRow({
      index,
      label,
      isCollection: !isTabletop,
    })).join('');

    if (!isTabletop) {
      for (let customOffset = 0; customOffset < CUSTOM_COLLECTION_COUNT; customOffset += 1) {
        html += buildCustomRow(list.length + customOffset);
      }
    }

    const grid = document.getElementById(`echellesGrid-${prefix}`);
    if (!grid) return;

    grid.innerHTML = html;
    bindEchellesUI({ list, isCollection: !isTabletop });
    updateOriginState(prefix, mode);
    notifyScaleSelectionChanged(prefix);
  }

  function toggleEch(index, options = {}) {
    const { shouldSave = true, autoFill = true } = options;
    const { checkbox, dimInput, row, originRadio } = getRowEls(index);
    if (!checkbox || !dimInput || !row) return;

    const isEnabled = checkbox.checked;
    dimInput.disabled = !isEnabled;
    row.classList.toggle('on', isEnabled);

    if (originRadio && !isEnabled && originRadio.checked) {
      originRadio.checked = false;
    }

    if (isDynamicScaleEnabled()) {
      if (!isEnabled) setRowDimensionSource(index);

      if (isEnabled && getOriginIndex() === null && originRadio && supportsOriginSelection(index)) {
        originRadio.checked = true;
      }

      if (getOriginIndex() === null) {
        const fallbackOriginIndex = getFirstCheckedIndex();
        if (fallbackOriginIndex !== null) {
          const fallbackOriginRadio = getRowEls(fallbackOriginIndex).originRadio;
          if (fallbackOriginRadio) fallbackOriginRadio.checked = true;
        }
      }

      updateOriginState();

      if (isEnabled && autoFill && !originRadio?.checked && supportsOriginSelection(index)) {
        applyAutoDimensions(index, { shouldSave: false, force: true });
      }

      recalculateCollectionDimensions({ shouldSave: false });
    } else {
      updateOriginState();
    }

    notifyScaleSelectionChanged(getPfx());
    if (shouldSave) global.saveFormState();
  }

  function setDynamicEchellesEnabled(enabled, { shouldSave = true } = {}) {
    const toggle = getDynamicToggle();
    if (!toggle) return;

    toggle.checked = Boolean(enabled);
    updateOriginState();
    if (toggle.checked) {
      if (getOriginIndex() === null) {
        const fallbackOriginIndex = getFirstCheckedIndex();
        if (fallbackOriginIndex !== null) {
          const fallbackOriginRadio = getRowEls(fallbackOriginIndex).originRadio;
          if (fallbackOriginRadio) fallbackOriginRadio.checked = true;
        }
      }
      recalculateCollectionDimensions({ shouldSave: false });
    }

    if (shouldSave) global.saveFormState();
  }

  function toggleDynamicEchelles(prefix = getPfx()) {
    const toggle = getDynamicToggle(prefix);
    if (!toggle) return;
    setDynamicEchellesEnabled(toggle.checked, { shouldSave: true });
  }

  function getEchellesSelected() {
    const prefix = getPfx();
    const mode = getCurrentMode();
    const list = getScaleList(mode);

    const standard = list.filter((_, index) => document.getElementById(`${prefix}-ec${index}`)?.checked);
    if (mode === TABLETOP_MODE) return standard.join(', ');

    const customs = [];
    for (let customOffset = 0; customOffset < CUSTOM_COLLECTION_COUNT; customOffset += 1) {
      const index = list.length + customOffset;
      const { checkbox, customLabel } = getRowEls(index);
      if (checkbox?.checked && customLabel?.value) customs.push(customLabel.value.trim());
    }

    return [...standard, ...customs].join(', ');
  }

  function getSelectedScaleEntries(prefix = getPfx()) {
    const mode = resolveMode(prefix);
    const list = getScaleList(mode);
    const origin = document.querySelector(`input[name="${prefix}-origin-scale"]:checked`);
    const originIndex = origin ? Number(origin.value) : null;
    const entries = [];

    for (let index = 0; index < list.length; index += 1) {
      const checkbox = document.getElementById(`${prefix}-ec${index}`);
      if (!checkbox?.checked) continue;
      entries.push({
        key: `scale-${index}`,
        index,
        label: String(list[index] || '').trim(),
        dimension: String(document.getElementById(`${prefix}-ed${index}`)?.value || '').trim(),
        isOrigin: originIndex === index,
      });
    }

    if (mode === COLLECTION_MODE) {
      for (let customOffset = 0; customOffset < CUSTOM_COLLECTION_COUNT; customOffset += 1) {
        const index = list.length + customOffset;
        const checkbox = document.getElementById(`${prefix}-ec${index}`);
        const label = String(document.getElementById(`${prefix}-elabel${index}`)?.value || '').trim();
        if (!checkbox?.checked || !label) continue;
        entries.push({
          key: `scale-${index}`,
          index,
          label,
          dimension: String(document.getElementById(`${prefix}-ed${index}`)?.value || '').trim(),
          isOrigin: originIndex === index,
        });
      }
    }

    if (entries.length && !entries.some((entry) => entry.isOrigin)) entries[0].isOrigin = true;
    return entries;
  }

  function getDimsFromEchelles() {
    const prefix = getPfx();
    const mode = getCurrentMode();
    const list = getScaleList(mode);

    const lines = list.map((label, index) => {
      const checkbox = document.getElementById(`${prefix}-ec${index}`);
      const dimInput = document.getElementById(`${prefix}-ed${index}`);
      return (checkbox?.checked && dimInput?.value) ? `${label} â‡’ ${dimInput.value}` : null;
    }).filter(Boolean);

    if (mode === COLLECTION_MODE) {
      for (let customOffset = 0; customOffset < CUSTOM_COLLECTION_COUNT; customOffset += 1) {
        const index = list.length + customOffset;
        const { checkbox, customLabel, dimInput } = getRowEls(index);
        if (checkbox?.checked && customLabel?.value && dimInput?.value) {
          lines.push(`${customLabel.value.trim()} â‡’ ${dimInput.value}`);
        }
      }
    }

    return lines.join('\n');
  }

  Object.assign(global.PipelineUIEchelles, {
    ECHELLES: TABLETOP_SCALES,
    ECHELLES_TABLETOP_DOUBLEX: TABLETOP_DOUBLEX_SCALES,
    ECHELLES_COLLECTION: COLLECTION_SCALES,
    CUSTOM_COLLECTION_COUNT,
    buildEchellesUI,
    toggleEch,
    toggleDynamicEchelles,
    setDynamicEchellesEnabled,
    isDynamicScaleEnabled,
    setRowDimensionSource,
    setEchelleOrigin,
    getEchellesSelected,
    getSelectedScaleEntries,
    getDimsFromEchelles,
    getOriginScaleDimensions,
    refreshCollectionAutoDimensions: recalculateCollectionDimensions,
  });

  global.buildEchellesUI = buildEchellesUI;
  global.toggleEch = toggleEch;
  global.toggleDynamicEchelles = toggleDynamicEchelles;
  global.setEchelleOrigin = setEchelleOrigin;
})(window);
