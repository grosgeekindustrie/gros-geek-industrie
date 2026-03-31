'use strict';

(function (global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIEchelles = global.PipelineUIEchelles || {};

  const ECHELLES = ['28mm', '32mm', '50mm', '54mm', '75mm', '90mm', '120mm', '140mm', '1/10', '1/8', '1/6'];
  const ECHELLES_COLLECTION = ['140mm', '1/12', '1/10', '1/9', '1/8', '1/7', '1/6'];
  const CUSTOM_COLLECTION_COUNT = 3;

  function getPfx() {
    return global.PipelineUIShell?.pfx ? global.PipelineUIShell.pfx() : (global.currentMode === 'collection' ? 'col' : 'tt');
  }

  function getCurrentMode() {
    return global.currentMode || global.PipelineUIShell?.currentMode || 'tabletop';
  }

  function buildEchellesUI() {
    const p = getPfx();
    const isTT = getCurrentMode() === 'tabletop';
    const list = isTT ? ECHELLES : ECHELLES_COLLECTION;

    let html = list.map((e, i) => `
    <div class="ech-item" id="${p}-ei${i}">
      <input type="checkbox" id="${p}-ec${i}" onchange="toggleEch(${i})"/>
      <span class="ech-label">${e}</span>
      <input type="text" id="${p}-ed${i}" placeholder="dim" disabled/>
    </div>`).join('');

    if (!isTT) {
      for (let c = 0; c < CUSTOM_COLLECTION_COUNT; c++) {
        const idx = list.length + c;
        html += `
    <div class="ech-item" id="${p}-ei${idx}">
      <input type="checkbox" id="${p}-ec${idx}" onchange="toggleEch(${idx})"/>
      <input
        type="text"
        id="${p}-elabel${idx}"
        placeholder="ex: 1/5"
        style="flex:0 0 52px;background:transparent;border:none;border-right:1px solid var(--border);padding:0 6px;font-size:11px;font-family:'Space Mono',monospace;color:var(--text);"
        oninput="saveFormState()"
      />
      <input type="text" id="${p}-ed${idx}" placeholder="dim" disabled/>
    </div>`;
      }
    }

    const grid = document.getElementById(`echellesGrid-${p}`);
    if (grid) grid.innerHTML = html;
  }

  function toggleEch(i) {
    const p = getPfx();
    const checkbox = document.getElementById(`${p}-ec${i}`);
    const dim = document.getElementById(`${p}-ed${i}`);
    const row = document.getElementById(`${p}-ei${i}`);

    if (!checkbox || !dim || !row) return;

    const on = checkbox.checked;
    dim.disabled = !on;
    row.classList.toggle('on', on);

    if (typeof global.saveFormState === 'function') {
      global.saveFormState();
    }
  }

  function getEchellesSelected() {
    const p = getPfx();
    const mode = getCurrentMode();
    const list = mode === 'tabletop' ? ECHELLES : ECHELLES_COLLECTION;

    const standard = list.filter((_, i) => document.getElementById(`${p}-ec${i}`)?.checked);

    if (mode === 'tabletop') return standard.join(', ');

    const customs = [];
    for (let c = 0; c < CUSTOM_COLLECTION_COUNT; c++) {
      const idx = list.length + c;
      const cb = document.getElementById(`${p}-ec${idx}`);
      const label = document.getElementById(`${p}-elabel${idx}`);
      if (cb?.checked && label?.value) customs.push(label.value.trim());
    }

    return [...standard, ...customs].join(', ');
  }

  function getDimsFromEchelles() {
    const p = getPfx();
    const mode = getCurrentMode();
    const list = mode === 'tabletop' ? ECHELLES : ECHELLES_COLLECTION;

    const lines = list.map((e, i) => {
      const cb = document.getElementById(`${p}-ec${i}`);
      const dim = document.getElementById(`${p}-ed${i}`);
      return (cb?.checked && dim?.value) ? `${e} ⇒ ${dim.value}` : null;
    }).filter(Boolean);

    if (mode === 'collection') {
      for (let c = 0; c < CUSTOM_COLLECTION_COUNT; c++) {
        const idx = list.length + c;
        const cb = document.getElementById(`${p}-ec${idx}`);
        const label = document.getElementById(`${p}-elabel${idx}`);
        const dim = document.getElementById(`${p}-ed${idx}`);
        if (cb?.checked && label?.value && dim?.value) {
          lines.push(`${label.value.trim()} ⇒ ${dim.value}`);
        }
      }
    }

    return lines.join(`\n`);
  }

  Object.assign(global.PipelineUIEchelles, {
    ECHELLES,
    ECHELLES_COLLECTION,
    CUSTOM_COLLECTION_COUNT,
    buildEchellesUI,
    toggleEch,
    getEchellesSelected,
    getDimsFromEchelles,
  });

  global.buildEchellesUI = buildEchellesUI;
  global.toggleEch = toggleEch;
})(window);
