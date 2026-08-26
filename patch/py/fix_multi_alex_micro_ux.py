#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

JS_MARKER = "// === MICRO UX PATCH: hover + tooltips + compact button labels ==="
CSS_MARKER = "/* === MICRO UX PATCH: hover + tooltips + compact button labels === */"

JS_APPEND = r'''

// === MICRO UX PATCH: hover + tooltips + compact button labels ===
(function initMicroUxPatch() {
  if (window.__microUxPatchInstalled) return;
  window.__microUxPatchInstalled = true;

  const ACTION_META = {
    rerunAgent:         { label: 'Relancer cet agent', icon: '🔁' },
    rerunSuite:         { label: 'Relancer la suite', icon: '⏩' },
    persistRule:        { label: 'Toujours appliquer', icon: '📌' },
    openPromptLightbox: { label: 'Ouvrir le prompt', icon: '⚙️' },
    stopAgent:          { label: 'Stopper l’agent', icon: '⏹' },
    copyOut:            { label: 'Copier la sortie', icon: '📋' },
    showRawInput:       { label: 'Voir l’input brut', icon: '</>' },
    runTagExplorer:     { label: 'Explorer les tags', icon: '🧭' },
    runTitreExplorer:   { label: 'Explorer les titres', icon: '🧭' },
    validateTitre:      { label: 'Valider ce titre', icon: '✅' },
    validateAccrocheCTA:{ label: 'Valider et assembler', icon: '✅' },
    pasteSelectedTitre: { label: 'Coller le titre sélectionné', icon: '📥' },
    validateTag:        { label: 'Valider ce tag', icon: '👍', variant: 'success' },
    invalidateTag:      { label: 'Blacklister ce tag', icon: '👎', variant: 'danger' },
    rerollTag:          { label: 'Régénérer ce tag', icon: '🔄', variant: 'accent' },
  };

  const TEXT_ONLY_ACTIONS = new Set([
    'rerunAgent', 'rerunSuite', 'persistRule', 'runTagExplorer', 'runTitreExplorer',
    'validateTitre', 'validateAccrocheCTA'
  ]);

  function getMetaFromButton(btn, indexInGroup = -1) {
    if (!btn) return null;

    const onclick = btn.getAttribute('onclick') || '';
    for (const [action, meta] of Object.entries(ACTION_META)) {
      if (onclick.includes(action + '(')) {
        return { ...meta, action };
      }
    }

    if (btn.classList.contains('titre-thumb')) {
      const order = [
        { label: 'Valider', icon: '👍', variant: 'success', action: 'validateTag' },
        { label: 'Blacklister', icon: '👎', variant: 'danger', action: 'invalidateTag' },
        { label: 'Régénérer', icon: '🔄', variant: 'accent', action: 'rerollTag' },
      ];
      return order[indexInGroup] || null;
    }

    if (btn.classList.contains('validate-btn')) {
      const txt = (btn.textContent || '').trim();
      if (/assembler/i.test(txt)) return { label: 'Valider et assembler', icon: '✅', action: 'validateAccrocheCTA' };
      return { label: 'Valider', icon: '✅', action: 'validateTitre' };
    }

    return null;
  }

  function normalizeIconButtonText(text) {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return t;
  }

  function applyMeta(btn, meta) {
    if (!btn || !meta) return;

    const current = normalizeIconButtonText(btn.textContent);
    const isIconOnly = !current || /^[⚙️⏹📋📥👍👎🔄🧭]+$/.test(current) || current === '</>';

    btn.setAttribute('title', meta.label);
    btn.setAttribute('aria-label', meta.label);
    btn.setAttribute('data-ui-tip', meta.label);
    btn.classList.add('ux-btn');

    if (meta.variant === 'success') btn.classList.add('ux-affirm');
    if (meta.variant === 'danger') btn.classList.add('ux-deny');
    if (meta.variant === 'accent') btn.classList.add('ux-reroll');

    if (isIconOnly) {
      btn.classList.add('icon-btn');
      btn.textContent = meta.icon;
    }

    if (!isIconOnly && TEXT_ONLY_ACTIONS.has(meta.action || '')) {
      btn.classList.remove('icon-btn');
    }
  }

  function enhanceAgentButtons(root) {
    root.querySelectorAll('.agent-actions button').forEach((btn) => {
      applyMeta(btn, getMetaFromButton(btn));
    });
  }

  function enhanceTagButtons(root) {
    root.querySelectorAll('.titre-actions').forEach((wrap) => {
      [...wrap.querySelectorAll('button')].forEach((btn, index) => {
        applyMeta(btn, getMetaFromButton(btn, index));
      });
    });
  }

  function enhanceManualTitreButtons(root) {
    root.querySelectorAll('.manual-titre-row button').forEach((btn) => {
      applyMeta(btn, getMetaFromButton(btn) || { label: 'Coller la sélection', icon: '📥', action: 'pasteSelectedTitre' });
    });
  }

  function enhanceInputs(root) {
    root.querySelectorAll('.fg input, .fg select, .fg textarea, .manual-titre-row input, .correction-area textarea').forEach((el) => {
      if (!el.getAttribute('title')) {
        const fromPlaceholder = (el.getAttribute('placeholder') || '').trim();
        const fromLabel = el.closest('.fg, .correction-area')?.querySelector('label')?.textContent?.trim() || '';
        const hint = fromLabel || fromPlaceholder;
        if (hint) el.setAttribute('title', hint);
      }
      el.classList.add('ux-field');
    });
  }

  function enhanceSelectionHeadings(root) {
    root.querySelectorAll('.sel-zone h4').forEach((h4) => {
      h4.classList.add('ux-heading');
    });
  }

  function enhance(root = document) {
    enhanceAgentButtons(root);
    enhanceTagButtons(root);
    enhanceManualTitreButtons(root);
    enhanceInputs(root);
    enhanceSelectionHeadings(root);
  }

  const originalBuildPipeline = typeof window.buildPipeline === 'function' ? window.buildPipeline : null;
  if (originalBuildPipeline && !originalBuildPipeline.__microUxWrapped) {
    const wrapped = function (...args) {
      const result = originalBuildPipeline.apply(this, args);
      requestAnimationFrame(() => enhance(document));
      return result;
    };
    wrapped.__microUxWrapped = true;
    window.buildPipeline = wrapped;
  }

  const mo = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes && mutation.addedNodes.length) {
        enhance(document);
        break;
      }
    }
  });

  if (document.documentElement) {
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enhance(document), { once: true });
  } else {
    enhance(document);
  }

  setTimeout(() => enhance(document), 0);
  setTimeout(() => enhance(document), 250);
})();
'''

CSS_APPEND = r'''

/* === MICRO UX PATCH: hover + tooltips + compact button labels === */
.agent-card:hover {
  border-color: rgba(232,197,71,.24);
  box-shadow: 0 10px 24px rgba(0,0,0,.14);
}

.ux-field,
.fg input,
.fg select,
.fg textarea,
.manual-titre-row input,
.correction-area textarea {
  transition: border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .18s ease;
}

.ux-field:hover,
.fg input:hover,
.fg select:hover,
.fg textarea:hover,
.manual-titre-row input:hover,
.correction-area textarea:hover {
  border-color: rgba(232,197,71,.28);
  background: rgba(255,255,255,.02);
}

.ux-field:focus,
.ux-field:focus-visible,
.fg input:focus-visible,
.fg select:focus-visible,
.fg textarea:focus-visible,
.manual-titre-row input:focus-visible,
.correction-area textarea:focus-visible,
.btn:focus-visible,
.validate-btn:focus-visible,
.titre-thumb:focus-visible,
.titre-copy:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(232,197,71,.18), 0 0 0 4px rgba(232,197,71,.08);
}

.btn,
.validate-btn,
.titre-thumb,
.titre-copy {
  position: relative;
}

.btn:hover,
.validate-btn:hover,
.titre-thumb:hover,
.titre-copy:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(0,0,0,.16);
}

.btn:active,
.validate-btn:active,
.titre-thumb:active,
.titre-copy:active {
  transform: translateY(0);
}

.icon-btn,
.titre-thumb {
  min-width: 34px;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
}

.titre-thumb {
  background: rgba(255,255,255,.025);
  color: var(--text2, var(--muted));
}

.titre-actions .titre-thumb:nth-child(1):hover {
  border-color: rgba(62,207,142,.45);
  color: var(--success);
  background: rgba(62,207,142,.08);
}

.titre-actions .titre-thumb:nth-child(2):hover {
  border-color: rgba(245,66,74,.4);
  color: var(--error);
  background: rgba(245,66,74,.08);
}

.titre-actions .titre-thumb:nth-child(3):hover {
  border-color: rgba(232,197,71,.4);
  color: var(--accent);
  background: rgba(232,197,71,.08);
}

.ux-btn.ux-affirm {
  border-color: rgba(62,207,142,.3);
}

.ux-btn.ux-deny {
  border-color: rgba(245,66,74,.25);
}

.ux-btn.ux-reroll {
  border-color: rgba(232,197,71,.25);
}

.btn[data-ui-tip]::after,
.validate-btn[data-ui-tip]::after,
.titre-thumb[data-ui-tip]::after,
.titre-copy[data-ui-tip]::after {
  content: attr(data-ui-tip);
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translate(-50%, 4px);
  opacity: 0;
  pointer-events: none;
  white-space: nowrap;
  background: rgba(10,10,11,.96);
  color: var(--text);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 7px;
  padding: 6px 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  line-height: 1.2;
  box-shadow: 0 10px 24px rgba(0,0,0,.28);
  z-index: 60;
  transition: opacity .14s ease, transform .14s ease;
}

.btn[data-ui-tip]:hover::after,
.btn[data-ui-tip]:focus-visible::after,
.validate-btn[data-ui-tip]:hover::after,
.validate-btn[data-ui-tip]:focus-visible::after,
.titre-thumb[data-ui-tip]:hover::after,
.titre-thumb[data-ui-tip]:focus-visible::after,
.titre-copy[data-ui-tip]:hover::after,
.titre-copy[data-ui-tip]:focus-visible::after {
  opacity: 1;
  transform: translate(-50%, 0);
}

.ux-heading {
  letter-spacing: .2px;
}
'''


def append_once(path: Path, marker: str, payload: str) -> bool:
    text = path.read_text(encoding='utf-8')
    if marker in text:
        return False
    if not text.endswith('\n'):
        text += '\n'
    text += payload
    path.write_text(text, encoding='utf-8')
    return True


def resolve_root(argv: list[str]) -> Path:
    if len(argv) > 1:
        return Path(argv[1]).expanduser().resolve()
    return Path.cwd().resolve()


def main() -> int:
    root = resolve_root(sys.argv)
    src = root / 'src'
    js_path = src / 'pipeline-ui.js'
    css_path = src / 'pipeline.css'

    missing = [str(p.relative_to(root)) for p in (js_path, css_path) if not p.exists()]
    if missing:
        print('Fichiers introuvables :')
        for item in missing:
            print(f' - {item}')
        print('\nLance le script depuis la racine du dépôt ou passe le chemin du dépôt en argument.')
        return 1

    changed_js = append_once(js_path, JS_MARKER, JS_APPEND)
    changed_css = append_once(css_path, CSS_MARKER, CSS_APPEND)

    if not changed_js and not changed_css:
        print('Patch déjà présent, rien à faire.')
        return 0

    print('Patch micro UX appliqué :')
    print(f' - {js_path.relative_to(root)}: {"modifié" if changed_js else "déjà patché"}')
    print(f' - {css_path.relative_to(root)}: {"modifié" if changed_css else "déjà patché"}')
    print('\nPense à recharger ton serveur / onglet pour voir les effets.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
