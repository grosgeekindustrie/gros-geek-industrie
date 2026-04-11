#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys

ROOT = Path.cwd()

UI_JS = ROOT / "src" / "js" / "pipeline-ui.js"
HTML = ROOT / "src" / "etsy-pipeline-dnd-v1_2.html"
ECH_UI = ROOT / "src" / "js" / "ui" / "echelles_ui.js"


ECH_UI_CONTENT = ''''use strict';

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

    return lines.join('\n');
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
'''


def backup(path: Path, suffix: str) -> None:
    bak = path.with_name(path.name + suffix)
    if not bak.exists():
        shutil.copy2(path, bak)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Bloc introuvable pour {label}")
    return text.replace(old, new, 1)


def patch_pipeline_ui(text: str) -> str:
    alias_anchor = """const {
  showBatchCountPicker,"""

    echelles_alias = """const {
  ECHELLES,
  ECHELLES_COLLECTION,
  CUSTOM_COLLECTION_COUNT,
  buildEchellesUI,
  toggleEch,
  getEchellesSelected,
  getDimsFromEchelles,
} = window.PipelineUIEchelles;

"""

    if "window.PipelineUIEchelles" not in text:
        text = replace_once(
            text,
            alias_anchor,
            echelles_alias + alias_anchor,
            "injection aliases echelles_ui",
        )

    start_marker = """// ═══════════════════════════════════════════════════════════
// ÉCHELLES
// ═══════════════════════════════════════════════════════════
"""
    end_marker = """
// ═══════════════════════════════════════════════════════════
// IMAGES
// ═══════════════════════════════════════════════════════════
"""

    start = text.find(start_marker)
    if start == -1:
        raise RuntimeError("Début du bloc ÉCHELLES introuvable dans src/js/pipeline-ui.js")

    end = text.find(end_marker, start)
    if end == -1:
        raise RuntimeError("Fin du bloc ÉCHELLES introuvable dans src/js/pipeline-ui.js")

    replacement = """// ═══════════════════════════════════════════════════════════
// ÉCHELLES
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/echelles_ui.js
"""
    text = text[:start] + replacement + text[end:]

    return text


def patch_html(text: str) -> str:
    script_tag = '<script src="js/ui/echelles_ui.js"></script>\n'
    if script_tag in text:
        return text

    anchor = '<script src="js/ui/shell_ui.js"></script>\n'
    if anchor not in text:
        raise RuntimeError("Ancre shell_ui.js introuvable dans le HTML")

    return text.replace(anchor, anchor + script_tag, 1)


def main() -> None:
    if not UI_JS.exists():
        raise SystemExit(f"Fichier introuvable: {UI_JS}")
    if not HTML.exists():
        raise SystemExit(f"Fichier introuvable: {HTML}")

    ui_text = UI_JS.read_text(encoding="utf-8")
    html_text = HTML.read_text(encoding="utf-8")

    backup(UI_JS, ".bak_extract_echelles_ui")
    backup(HTML, ".bak_extract_echelles_ui")

    ECH_UI.parent.mkdir(parents=True, exist_ok=True)
    if ECH_UI.exists():
        backup(ECH_UI, ".bak_extract_echelles_ui")
    ECH_UI.write_text(ECH_UI_CONTENT, encoding="utf-8")

    UI_JS.write_text(patch_pipeline_ui(ui_text), encoding="utf-8")
    HTML.write_text(patch_html(html_text), encoding="utf-8")

    print("OK: extraction ÉCHELLES vers src/js/ui/echelles_ui.js")
    print("Backups créés avec suffixe .bak_extract_echelles_ui")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERREUR: {exc}", file=sys.stderr)
        sys.exit(1)
