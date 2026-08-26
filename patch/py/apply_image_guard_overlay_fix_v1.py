#!/usr/bin/env python3
from __future__ import annotations
import sys
from pathlib import Path
from datetime import datetime

JS_MARKER = "/* === GGI IMAGE GUARD V1 === */"
CSS_MARKER = "/* === GGI IMAGE GUARD V1 CSS === */"

JS_PATCH = r'''

/* === GGI IMAGE GUARD V1 === */
;(() => {
  if (window.__GGI_IMAGE_GUARD_V1__) return;
  window.__GGI_IMAGE_GUARD_V1__ = true;

  const busyModes = new Set();

  function getDZ(p) { return document.getElementById(`dropZone-${p}`); }
  function getInput(p) { return document.getElementById(`imgInput-${p}`); }
  function getStrip(p) { return document.getElementById(`thumbStrip-${p}`); }
  function getPlaceholder(p) { return document.getElementById(`dzPlaceholder-${p}`); }
  function hasImages(p) {
    try { return !!(window.state && state.images && state.images[p] && state.images[p].length); }
    catch (_) { return false; }
  }

  function setBusy(p, on) {
    const dz = getDZ(p);
    const inp = getInput(p);
    if (dz) {
      dz.classList.toggle('is-busy', !!on);
      dz.setAttribute('aria-busy', on ? 'true' : 'false');
    }
    if (inp) inp.disabled = !!on;
  }

  function normalizeDropZone(p) {
    const dz = getDZ(p);
    const strip = getStrip(p);
    const ph = getPlaceholder(p);
    const present = hasImages(p);

    if (dz) {
      dz.classList.remove('dragover');
      dz.classList.toggle('has-images', present);
      dz.style.cursor = present ? 'default' : 'pointer';
    }

    if (ph) {
      ph.style.pointerEvents = 'none';
      ph.style.display = present ? 'none' : '';
    }

    if (strip) {
      strip.querySelectorAll('img, button').forEach(el => {
        if (el.dataset.ggiStopProp === '1') return;
        el.dataset.ggiStopProp = '1';
        el.addEventListener('click', ev => ev.stopPropagation(), true);
      });
    }
  }

  function releaseGlobalUI() {
    document.body.style.pointerEvents = '';
    document.body.style.cursor = '';
    document.querySelectorAll('.dragover').forEach(el => el.classList.remove('dragover'));

    document.querySelectorAll('.settings-overlay.visible, .lb-overlay.visible, .batch-modal-overlay.visible').forEach(el => {
      const ownsOpenPanel = !!el.querySelector('.visible, .lb-box, .batch-modal');
      if (!ownsOpenPanel || el.dataset.ggiAutoVisible === '1') {
        el.classList.remove('visible');
      }
    });
  }

  function bindDZClick(p) {
    const dz = getDZ(p);
    const inp = getInput(p);
    if (!dz || !inp || dz.dataset.ggiBoundClick === '1') return;
    dz.dataset.ggiBoundClick = '1';

    dz.addEventListener('click', ev => {
      const target = ev.target;
      if (target && target.closest && target.closest('button, img, .img-thumb')) return;
      if (busyModes.has(p)) return;
      if (hasImages(p)) return;
      inp.click();
    }, true);
  }

  function bindInputState(p) {
    const inp = getInput(p);
    if (!inp || inp.dataset.ggiBoundInput === '1') return;
    inp.dataset.ggiBoundInput = '1';
    inp.addEventListener('click', () => {
      const dz = getDZ(p);
      if (dz) dz.classList.remove('dragover');
    }, true);
  }

  const origProcessImages = window.processImages;
  if (typeof origProcessImages === 'function') {
    window.processImages = async function(files, p) {
      if (!p) return origProcessImages.apply(this, arguments);
      if (busyModes.has(p)) return;

      const cleanFiles = Array.from(files || [])
        .filter(f => f && ((f.type || '').startsWith('image/')))
        .slice(0, 4);

      busyModes.add(p);
      setBusy(p, true);

      try {
        return await origProcessImages.call(this, cleanFiles, p);
      } finally {
        const inp = getInput(p);
        if (inp) inp.value = '';
        setBusy(p, false);
        busyModes.delete(p);
        normalizeDropZone(p);
        releaseGlobalUI();
      }
    };
  }

  const origRenderThumbs = window.renderThumbs;
  if (typeof origRenderThumbs === 'function') {
    window.renderThumbs = function(p) {
      const out = origRenderThumbs.apply(this, arguments);
      normalizeDropZone(p);
      return out;
    };
  }

  const origRemoveImage = window.removeImage;
  if (typeof origRemoveImage === 'function') {
    window.removeImage = function() {
      const out = origRemoveImage.apply(this, arguments);
      const p = arguments[1];
      if (p) normalizeDropZone(p);
      return out;
    };
  }

  function install() {
    ['tt', 'col'].forEach(p => {
      bindDZClick(p);
      bindInputState(p);
      normalizeDropZone(p);
    });
  }

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      releaseGlobalUI();
      install();
    }
  }, true);

  window.__GGI_PANIC_UNFREEZE__ = function() {
    releaseGlobalUI();
    install();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
'''

CSS_PATCH = r'''

/* === GGI IMAGE GUARD V1 CSS === */
.drop-zone.is-busy {
  opacity: .72 !important;
  pointer-events: none !important;
}

.drop-zone.has-images {
  cursor: default !important;
}

.drop-zone.has-images:hover,
.drop-zone.has-images.dragover {
  background: var(--bg) !important;
}

.drop-zone .img-thumb,
.drop-zone img {
  cursor: pointer;
}

.drop-zone button {
  cursor: pointer;
}
'''


def backup(path: Path) -> Path:
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    bak = path.with_suffix(path.suffix + f'.bak_{stamp}')
    bak.write_text(path.read_text(encoding='utf-8'), encoding='utf-8')
    return bak


def main() -> int:
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
    js_path = root / 'src' / 'pipeline-ui.js'
    css_path = root / 'src' / 'pipeline.css'

    if not js_path.exists():
        print(f"Introuvable: {js_path}")
        return 1
    if not css_path.exists():
        print(f"Introuvable: {css_path}")
        return 1

    js = js_path.read_text(encoding='utf-8')
    css = css_path.read_text(encoding='utf-8')

    changed = False

    if JS_MARKER not in js:
        backup(js_path)
        js_path.write_text(js.rstrip() + JS_PATCH + "\n", encoding='utf-8')
        print(f"PATCH JS OK   -> {js_path}")
        changed = True
    else:
        print(f"JS déjà patché -> {js_path}")

    if CSS_MARKER not in css:
        backup(css_path)
        css_path.write_text(css.rstrip() + CSS_PATCH + "\n", encoding='utf-8')
        print(f"PATCH CSS OK  -> {css_path}")
        changed = True
    else:
        print(f"CSS déjà patché -> {css_path}")

    if not changed:
        print("Aucune modification nécessaire.")
    else:
        print("\nVérifie avec :")
        print("  git diff -- src/pipeline-ui.js src/pipeline.css")
        print("\nPuis redémarre / hard refresh le navigateur.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
