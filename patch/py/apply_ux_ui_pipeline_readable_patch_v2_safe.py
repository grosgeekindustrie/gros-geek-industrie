
from __future__ import annotations
import sys
from pathlib import Path
from datetime import datetime
import shutil
import textwrap
import hashlib

JS_MARKER = "// === UX/UI PATCH 2B — pipeline lisible (safe) ==="
CSS_MARKER = "/* === UX/UI PATCH 2B — pipeline lisible (safe) === */"

JS_BLOCK = r"""
// === UX/UI PATCH 2B — pipeline lisible (safe) ===
(function () {
  const PATCH_FLAG = '__ggiPipelineReadablePatchV2B';
  if (window[PATCH_FLAG]) return;
  window[PATCH_FLAG] = true;

  function txt(el) { return (el?.textContent || '').replace(/\s+/g, ' ').trim(); }
  function make(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  function inferLabel(btn) {
    const onclick = btn.getAttribute('onclick') || '';
    const current = txt(btn);
    if (btn.getAttribute('title')) return btn.getAttribute('title');

    if (onclick.includes('copyOut')) return 'Copier la sortie';
    if (onclick.includes('showRawInput')) return 'Voir l’input brut';
    if (onclick.includes('openPromptLightbox')) return 'Ouvrir le prompt';
    if (onclick.includes('stopAgent')) return 'Stopper';
    if (onclick.includes('rerunSuite')) return 'Relancer depuis ici';
    if (onclick.includes('rerunAgent')) return 'Relancer cet agent';
    if (onclick.includes('persistRule')) return 'Sauver comme règle';
    if (onclick.includes('validateTitre')) return 'Valider ce titre';
    if (onclick.includes('validateAccrocheCTA')) return 'Valider cette sélection';
    if (onclick.includes('pasteSelectedTitre')) return 'Copier la sélection dans le champ manuel';
    if (onclick.includes('validateTag')) return 'Valider ce tag';
    if (onclick.includes('invalidateTag')) return 'Blacklister ce tag';
    if (onclick.includes('rerollTag')) return 'Régénérer ce tag';

    if (current === '⚙️') return 'Prompt';
    if (current === '⏹') return 'Stop';
    if (current === '</>' || current === '< />') return 'Input brut';
    if (current === '📋') return 'Copier';
    if (current === '👍') return 'Valider';
    if (current === '👎') return 'Invalider';
    if (current === '🔄') return 'Régénérer';
    return current || 'Action';
  }

  function decorateButtons(root) {
    root.querySelectorAll('button').forEach(btn => {
      const label = inferLabel(btn);
      if (!btn.getAttribute('title')) btn.setAttribute('title', label);
      if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', label);

      const onclick = btn.getAttribute('onclick') || '';
      if (!txt(btn)) {
        if (onclick.includes('copyOut')) btn.textContent = '📋';
        else if (onclick.includes('pasteSelectedTitre')) btn.textContent = '↩';
        else if (onclick.includes('validateTag')) btn.textContent = '👍';
        else if (onclick.includes('invalidateTag')) btn.textContent = '👎';
        else if (onclick.includes('rerollTag')) btn.textContent = '🔄';
      }
    });
  }

  function summarize(card) {
    const header = card.querySelector(':scope > .agent-header');
    if (!header) return;

    let row = header.querySelector('.agent-inline-summary');
    if (!row) {
      row = make('div', 'agent-inline-summary');
      header.appendChild(row);
    }

    const body = card.querySelector(':scope > .agent-body');
    const status = txt(card.querySelector('.agent-status'));
    const out = txt(body?.querySelector('.output-box'));
    const hasOutput = out && out !== '— pas encore généré —' && !out.startsWith('❌');
    const hasSelection = !!body?.querySelector('.titre-item, .choice-item');
    const correction = txt(body?.querySelector('textarea'));
    const rules = body?.querySelectorAll('.rules-display span').length || 0;

    const pills = [];
    if (status) pills.push(['status', status]);
    pills.push([hasOutput ? 'ok' : 'muted', hasOutput ? 'résultat prêt' : 'aucune sortie']);
    if (hasSelection) pills.push(['warn', 'choix à faire']);
    if (correction) pills.push(['info', 'correction saisie']);
    if (rules) pills.push(['info', `${rules} règle${rules > 1 ? 's' : ''}`]);

    row.innerHTML = pills.slice(0, 4).map(([tone, label]) =>
      `<span class="agent-inline-pill ${tone}">${label}</span>`
    ).join('');
  }

  function structure(root) {
    root.querySelectorAll('.pipe-arrow').forEach(arrow => {
      if (arrow.dataset.pipeReadable === '1') return;
      arrow.dataset.pipeReadable = '1';
      arrow.innerHTML = '<span class="pipe-arrow-line"></span><span class="pipe-arrow-icon">↓</span><span class="pipe-arrow-label">étape suivante</span><span class="pipe-arrow-line"></span>';
    });

    root.querySelectorAll('.agent-card').forEach(card => summarize(card));
    decorateButtons(root);
  }

  function run() {
    const ids = ['pipeline-tt', 'pipeline-col'];
    ids.forEach(id => {
      const root = document.getElementById(id);
      if (!root) return;
      structure(root);

      if (root._uxuiReadableObserver) return;
      const obs = new MutationObserver(() => structure(root));
      obs.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
      root._uxuiReadableObserver = obs;
    });
  }

  ['buildPipeline', 'buildTagsUI', 'buildTitreSelectionUI', 'buildAccrocheCTASelectionUI', 'refreshRules', 'toggleCard', 'openCard']
    .forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__uxReadableWrapped) return;
      const wrapped = function (...args) {
        const res = original.apply(this, args);
        setTimeout(run, 0);
        return res;
      };
      wrapped.__uxReadableWrapped = true;
      window[name] = wrapped;
    });

  setTimeout(run, 0);
})();
"""

CSS_BLOCK = r"""
/* === UX/UI PATCH 2B — pipeline lisible (safe) === */
.agent-header {
  position: relative;
  gap: 10px;
}

.agent-inline-summary {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.agent-inline-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.03);
  color: var(--muted);
  font-family: 'JetBrains Mono','Space Mono',monospace;
  font-size: 10px;
  line-height: 1;
}

.agent-inline-pill.ok {
  color: var(--success);
  border-color: rgba(76,175,125,.24);
  background: rgba(76,175,125,.10);
}

.agent-inline-pill.warn {
  color: var(--accent);
  border-color: rgba(232,197,71,.24);
  background: rgba(232,197,71,.10);
}

.agent-inline-pill.info {
  color: var(--accent2);
  border-color: rgba(255,107,53,.24);
  background: rgba(255,107,53,.10);
}

.agent-inline-pill.status {
  color: var(--text);
  border-color: rgba(126,184,247,.24);
  background: rgba(126,184,247,.10);
}

.pipe-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  margin: 2px 0 8px;
}

.pipe-arrow-line {
  flex: 1 1 auto;
  max-width: 72px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent);
}

.pipe-arrow-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.03);
  font-size: 12px;
}

.pipe-arrow-label {
  font-family: 'JetBrains Mono','Space Mono',monospace;
  font-size: 10px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--muted);
}
"""

def sha1(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()

def backup(path: Path) -> Path:
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    bak = path.with_suffix(path.suffix + f'.bak.{stamp}')
    shutil.copy2(path, bak)
    return bak

def append_if_missing(path: Path, marker: str, block: str) -> tuple[bool, str, str]:
    before = sha1(path)
    text = path.read_text(encoding='utf-8', errors='replace')
    changed = False
    if marker not in text:
      if not text.endswith('\n'):
          text += '\n'
      text += '\n' + textwrap.dedent(block).strip('\n') + '\n'
      path.write_text(text, encoding='utf-8', newline='')
      changed = True
    after = sha1(path)
    return changed, before, after

def main() -> int:
    repo = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
    ui = repo / 'src' / 'pipeline-ui.js'
    css = repo / 'src' / 'pipeline.css'
    if not ui.exists() or not css.exists():
        print('ERREUR: repo introuvable ou mauvais dossier')
        print(f'Attendu: {ui}')
        print(f'Attendu: {css}')
        return 1

    print(f'Repo         : {repo}')
    print(f'JS cible     : {ui}')
    print(f'CSS cible    : {css}')

    bak_js = backup(ui)
    bak_css = backup(css)
    print(f'Backup JS    : {bak_js.name}')
    print(f'Backup CSS   : {bak_css.name}')

    js_changed, js_before, js_after = append_if_missing(ui, JS_MARKER, JS_BLOCK)
    css_changed, css_before, css_after = append_if_missing(css, CSS_MARKER, CSS_BLOCK)

    print('')
    print(f'JS changé    : {js_changed}')
    print(f'CSS changé   : {css_changed}')
    print(f'JS sha1      : {js_before} -> {js_after}')
    print(f'CSS sha1     : {css_before} -> {css_after}')
    print('')
    print('Vérification rapide :')
    print(f'  JS marker  : {"OK" if JS_MARKER in ui.read_text(encoding="utf-8", errors="replace") else "ABSENT"}')
    print(f'  CSS marker : {"OK" if CSS_MARKER in css.read_text(encoding="utf-8", errors="replace") else "ABSENT"}')
    print('')
    print('Ensuite, lance :')
    print('  git diff -- src/pipeline-ui.js src/pipeline.css')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
