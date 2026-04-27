'use strict';

// Gestion des échelles et dimensions.
// Responsable de la construction DOM des cases d'échelles et des aides de calcul.
// Cette zone reste localisée : on améliore le flux Collection sans refactorer le reste du formulaire.

(function (global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIEchelles = global.PipelineUIEchelles || {};

  const echellesData = global.PipelineUIDataEchelles || {};
  const ECHELLES = echellesData.ECHELLES_BY_MODE?.tabletop || ['28mm', '32mm', '50mm', '54mm', '75mm', '90mm', '120mm', '140mm', '1/10', '1/8', '1/6'];
  const ECHELLES_COLLECTION = echellesData.ECHELLES_BY_MODE?.collection || ["Buste", "75mm", '140mm', '1/12', '1/10', '1/9', '1/8', '1/7', '1/6'];
  const CUSTOM_COLLECTION_COUNT = Number.isInteger(echellesData.CUSTOM_COLLECTION_COUNT) ? echellesData.CUSTOM_COLLECTION_COUNT : 3;
  const DIMENSION_PLACEHOLDER = echellesData.DIMENSION_PLACEHOLDER || '224mm * 200mm * 136mm';
  const MANUAL_COLLECTION_SCALE_LABELS = new Set(['buste', '75mm']);

  const getPfx = () => global.PipelineUIShell.pfx();

  const getCurrentMode = () => global.currentMode;
  const isCollectionMode = () => getCurrentMode() === 'collection';
  const getCollectionRowCount = () => ECHELLES_COLLECTION.length + CUSTOM_COLLECTION_COUNT;

  const getRowEls = (index) => {
    const p = getPfx();

    return {
      row: document.getElementById(`${p}-ei${index}`),
      checkbox: document.getElementById(`${p}-ec${index}`),
      dimInput: document.getElementById(`${p}-ed${index}`),
      originRadio: document.getElementById(`${p}-eo${index}`),
      customLabel: document.getElementById(`${p}-elabel${index}`),
    };
  };

  const normalizeScaleLabel = (value = '') => String(value || '').replace(/\s+/g, '');
  const normalizeManualScaleLabel = (value = '') => normalizeScaleLabel(value).toLowerCase();
  const isManualCollectionScaleLabel = (label = '') => MANUAL_COLLECTION_SCALE_LABELS.has(normalizeManualScaleLabel(label));
  const isManualCollectionScale = (index) => isCollectionMode() && isManualCollectionScaleLabel(getCollectionScaleLabel(index));

  const parseScaleDescriptor = (label = '') => {
    const normalizedLabel = normalizeScaleLabel(label);
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

    if (originDescriptor.kind === 'ratio') {
      return originDescriptor.value / targetDescriptor.value;
    }

    if (originDescriptor.kind === 'millimeter') {
      return targetDescriptor.value / originDescriptor.value;
    }

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

  const getCollectionScaleLabel = (index) => {
    if (index < ECHELLES_COLLECTION.length) return ECHELLES_COLLECTION[index];
    return getRowEls(index).customLabel?.value?.trim() || '';
  };

  const getOriginIndex = () => {
    if (!isCollectionMode()) return null;

    const p = getPfx();
    const checked = document.querySelector(`input[name="${p}-origin-scale"]:checked`);
    if (!checked) return null;

    const index = Number(checked.value);
    return Number.isInteger(index) ? index : null;
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

  const getFirstCheckedIndex = () => {
    if (!isCollectionMode()) return null;

    for (let index = 0; index < getCollectionRowCount(); index += 1) {
      const { checkbox, originRadio } = getRowEls(index);
      if (checkbox?.checked && originRadio && !isManualCollectionScale(index)) {
        return index;
      }
    }

    return null;
  };

  const updateOriginState = () => {
    if (!isCollectionMode()) return;

    const originIndex = getOriginIndex();

    for (let index = 0; index < getCollectionRowCount(); index += 1) {
      const { row, originRadio, checkbox } = getRowEls(index);
      if (!row) continue;

      const isManualScale = isManualCollectionScale(index);
      row.classList.toggle('is-manual-scale', isManualScale);

      const isOrigin = !isManualScale && originIndex === index;
      row.classList.toggle('is-origin', isOrigin);
      row.dataset.origin = isOrigin ? 'true' : 'false';

      if (isOrigin && checkbox?.checked) {
        setRowDimensionSource(index, 'origin');
      } else if (getRowDimensionSource(index) === 'origin') {
        setRowDimensionSource(index);
      }

      if (originRadio) {
        originRadio.setAttribute('aria-checked', String(isOrigin));
      }
    }
  };

  const isAutoManagedRow = (index) => {
    if (isManualCollectionScale(index)) return false;

    const { dimInput } = getRowEls(index);
    const source = getRowDimensionSource(index);

    return source !== 'manual' || !String(dimInput?.value || '').trim();
  };

  const applyAutoDimensions = (index, { shouldSave = true, force = false } = {}) => {
    if (!isCollectionMode()) return false;

    const originIndex = getOriginIndex();
    if (originIndex === null || originIndex === index || isManualCollectionScale(index)) return false;

    const {
      row,
      dimInput: targetDimInput,
      checkbox: targetCheckbox,
    } = getRowEls(index);

    if (!targetCheckbox?.checked || !targetDimInput || !row) return false;
    if (!force && !isAutoManagedRow(index)) return false;

    const originLabel = getCollectionScaleLabel(originIndex);
    const targetLabel = getCollectionScaleLabel(index);
    const originDimensions = parseDimensions(getRowEls(originIndex).dimInput?.value || '');
    const scaleFactor = getScaleFactor(originLabel, targetLabel);

    if (!originDimensions || !Number.isFinite(scaleFactor)) return false;

    const scaledDimensions = originDimensions.map((dimension) => roundHalfUp(dimension * scaleFactor));
    targetDimInput.value = formatDimensions(scaledDimensions);
    setRowDimensionSource(index, 'auto');

    if (shouldSave && typeof global.saveFormState === 'function') {
      global.saveFormState();
    }

    return true;
  };

  const recalculateCollectionDimensions = ({ shouldSave = true, force = false } = {}) => {
    if (!isCollectionMode()) return;

    updateOriginState();

    for (let index = 0; index < getCollectionRowCount(); index += 1) {
      if (getOriginIndex() === index) continue;
      applyAutoDimensions(index, { shouldSave: false, force });
    }

    if (shouldSave && typeof global.saveFormState === 'function') {
      global.saveFormState();
    }
  };

  const setEchelleOrigin = (index, { shouldSave = true, recalculate = true } = {}) => {
    if (!isCollectionMode()) return;

    const { checkbox, originRadio } = getRowEls(index);
    if (!checkbox?.checked || !originRadio) return;

    originRadio.checked = true;
    updateOriginState();

    if (recalculate) {
      recalculateCollectionDimensions({ shouldSave: false });
    }

    if (shouldSave && typeof global.saveFormState === 'function') {
      global.saveFormState();
    }
  };

  const buildStandardRow = ({ index, label, isCollection }) => {
    const p = getPfx();
    const isManualScale = isCollection && isManualCollectionScaleLabel(label);
    const originControl = isCollection && !isManualScale
      ? `
      <label class="ech-origin-toggle" for="${p}-eo${index}">
        <input
          type="radio"
          id="${p}-eo${index}"
          name="${p}-origin-scale"
          value="${index}"
          class="ech-origin-radio"
          disabled
        />
        <span class="ech-origin-text">Origine</span>
      </label>`
      : '';
    const manualClass = isManualScale ? ' is-manual-scale' : '';

    return `
    <div class="ech-item${manualClass}" id="${p}-ei${index}" data-origin="false">
      <input type="checkbox" id="${p}-ec${index}" />
      <span class="ech-label">${label}</span>
      ${originControl}
      <input
        type="text"
        id="${p}-ed${index}"
        class="ech-dim-input"
        placeholder="${DIMENSION_PLACEHOLDER}"
        disabled
      />
    </div>`;
  };

  const buildCustomRow = (index) => {
    const p = getPfx();

    return `
    <div class="ech-item" id="${p}-ei${index}" data-origin="false">
      <input type="checkbox" id="${p}-ec${index}" />
      <input
        type="text"
        id="${p}-elabel${index}"
        class="ech-custom-label"
        placeholder="ex: 1/5"
      />
      <label class="ech-origin-toggle" for="${p}-eo${index}">
        <input
          type="radio"
          id="${p}-eo${index}"
          name="${p}-origin-scale"
          value="${index}"
          class="ech-origin-radio"
          disabled
        />
        <span class="ech-origin-text">Origine</span>
      </label>
      <input
        type="text"
        id="${p}-ed${index}"
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
      if (isCollectionMode()) {
        if (getOriginIndex() === index) {
          setRowDimensionSource(index, 'origin');
          recalculateCollectionDimensions({ shouldSave: false });
        } else {
          setRowDimensionSource(index, 'manual');
        }
      }

      global.saveFormState?.();
    });

    if (!isCollection) return;

    originRadio?.addEventListener('change', () => {
      if (originRadio.checked) {
        setEchelleOrigin(index);
      }
    });

    if (isCustom && customLabel) {
      customLabel.addEventListener('input', () => {
        if (getOriginIndex() === index) {
          recalculateCollectionDimensions({ shouldSave: false });
        } else {
          applyAutoDimensions(index, { shouldSave: false, force: true });
        }

        global.saveFormState?.();
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
    const p = getPfx();
    const isTT = getCurrentMode() === 'tabletop';
    const list = isTT ? ECHELLES : ECHELLES_COLLECTION;

    let html = list.map((label, index) => buildStandardRow({
      index,
      label,
      isCollection: !isTT,
    })).join('');

    if (!isTT) {
      for (let customOffset = 0; customOffset < CUSTOM_COLLECTION_COUNT; customOffset += 1) {
        html += buildCustomRow(list.length + customOffset);
      }
    }

    const grid = document.getElementById(`echellesGrid-${p}`);
    if (!grid) return;

    grid.innerHTML = html;
    bindEchellesUI({ list, isCollection: !isTT });
    updateOriginState();
  }

  function toggleEch(index, options = {}) {
    const { shouldSave = true, autoFill = true } = options;
    const {
      checkbox,
      dimInput,
      row,
      originRadio,
    } = getRowEls(index);

    if (!checkbox || !dimInput || !row) return;

    const isEnabled = checkbox.checked;
    dimInput.disabled = !isEnabled;
    row.classList.toggle('on', isEnabled);

    if (originRadio) {
      originRadio.disabled = !isEnabled;
      if (!isEnabled && originRadio.checked) {
        originRadio.checked = false;
      }
    }

    if (isCollectionMode()) {
      if (!isEnabled) {
        setRowDimensionSource(index);
      }

      if (isEnabled && getOriginIndex() === null && originRadio) {
        originRadio.checked = true;
      }

      if (getOriginIndex() === null) {
        const fallbackOriginIndex = getFirstCheckedIndex();
        if (fallbackOriginIndex !== null) {
          const fallbackOriginRadio = getRowEls(fallbackOriginIndex).originRadio;
          if (fallbackOriginRadio) {
            fallbackOriginRadio.checked = true;
          }
        }
      }

      updateOriginState();

      if (isEnabled && autoFill && !originRadio?.checked && !isManualCollectionScale(index)) {
        applyAutoDimensions(index, { shouldSave: false, force: true });
      }

      recalculateCollectionDimensions({ shouldSave: false });
    }

    if (shouldSave && typeof global.saveFormState === 'function') {
      global.saveFormState();
    }
  }

  function getEchellesSelected() {
    const p = getPfx();
    const mode = getCurrentMode();
    const list = mode === 'tabletop' ? ECHELLES : ECHELLES_COLLECTION;

    const standard = list.filter((_, index) => document.getElementById(`${p}-ec${index}`)?.checked);

    if (mode === 'tabletop') return standard.join(', ');

    const customs = [];
    for (let customOffset = 0; customOffset < CUSTOM_COLLECTION_COUNT; customOffset += 1) {
      const index = list.length + customOffset;
      const { checkbox, customLabel } = getRowEls(index);
      if (checkbox?.checked && customLabel?.value) {
        customs.push(customLabel.value.trim());
      }
    }

    return [...standard, ...customs].join(', ');
  }

  function getDimsFromEchelles() {
    const p = getPfx();
    const mode = getCurrentMode();
    const list = mode === 'tabletop' ? ECHELLES : ECHELLES_COLLECTION;

    const lines = list.map((label, index) => {
      const checkbox = document.getElementById(`${p}-ec${index}`);
      const dimInput = document.getElementById(`${p}-ed${index}`);
      return (checkbox?.checked && dimInput?.value) ? `${label} ⇒ ${dimInput.value}` : null;
    }).filter(Boolean);

    if (mode === 'collection') {
      for (let customOffset = 0; customOffset < CUSTOM_COLLECTION_COUNT; customOffset += 1) {
        const index = list.length + customOffset;
        const { checkbox, customLabel, dimInput } = getRowEls(index);
        if (checkbox?.checked && customLabel?.value && dimInput?.value) {
          lines.push(`${customLabel.value.trim()} ⇒ ${dimInput.value}`);
        }
      }
    }

    return lines.join('\n');
  }

  Object.assign(global.PipelineUIEchelles, {
    ECHELLES,
    ECHELLES_COLLECTION,
    CUSTOM_COLLECTION_COUNT,
    buildEchellesUI,
    toggleEch,
    setEchelleOrigin,
    getEchellesSelected,
    getDimsFromEchelles,
    refreshCollectionAutoDimensions: recalculateCollectionDimensions,
  });

  global.buildEchellesUI = buildEchellesUI;
  global.toggleEch = toggleEch;
  global.setEchelleOrigin = setEchelleOrigin;
})(window);
