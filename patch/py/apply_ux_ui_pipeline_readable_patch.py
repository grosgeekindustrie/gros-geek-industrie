from __future__ import annotations
import sys
from pathlib import Path
from datetime import datetime
import shutil
import textwrap

JS_MARKER = "// === UX/UI PATCH 2 — pipeline lisible ==="
CSS_MARKER = "/* === UX/UI PATCH 2 — pipeline lisible === */"

JS_BLOCK = r'''
// === UX/UI PATCH 2 — pipeline lisible ===
(function () {
  const PATCH_FLAG = '__ggiPipelineReadablePatchV2';
  if (window[PATCH_FLAG]) return;
  window[PATCH_FLAG] = true;

  const SECTION_COPY = {
    output: ['Résultat agent', 'sortie brute de l’agent'],
    choice: ['Décision', 'sélection / validation'],
    correction: ['Ajustement', 'correction locale à cette fiche'],
    actions: ['Actions', 'relance, outils et debug'],
    rules: ['Mémoire', 'règles permanentes actives']
  };

  function makeEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function ensureSection(node, key) {
    if (!node || !node.parentElement) return null;
    const existing = node.closest('.agent-section');
    if (existing) return existing;

    const [title, hint] = SECTION_COPY[key] || ['Bloc', ''];
    const section = makeEl('section', `agent-section agent-section-${key}`);
    const head = makeEl('div', 'agent-section-head');
    head.appendChild(makeEl('span', 'agent-section-title', title));
    head.appendChild(makeEl('span', 'agent-section-hint', hint));

    node.parentElement.insertBefore(section, node);
    section.appendChild(head);
    section.appendChild(node);
    return section;
  }

  function buildHeader(card) {
    const header = card.querySelector(':scope > .agent-header');
    if (!header || header.querySelector('.agent-header-main')) return;

    const num = header.querySelector('.agent-num');
    const title = header.querySelector('.agent-title');
    const badgeRules = header.querySelector('.badge-rules');
    const badgeImg = header.querySelector('.badge-img');
    const status = header.querySelector('.agent-status');
    const chevron = header.querySelector('.chevron');

    const main = makeEl('div', 'agent-header-main');
    const titleRow = makeEl('div', 'agent-title-row');
    const titleStack = makeEl('div', 'agent-title-stack');
    const badges = makeEl('div', 'agent-inline-badges');
    const right = makeEl('div', 'agent-header-right');
    const summary = makeEl('div', 'agent-summary');
    summary.id = `${card.id}-summary`;

    if (title) titleStack.appendChild(title);
    if (badgeRules) badges.appendChild(badgeRules);
    if (badgeImg) badges.appendChild(badgeImg);

    titleRow.appendChild(titleStack);
    if (badges.childNodes.length) titleRow.appendChild(badges);
    main.appendChild(titleRow);
    main.appendChild(summary);

    if (status) right.appendChild(status);
    if (chevron) right.appendChild(chevron);

    header.innerHTML = '';
    if (num) header.appendChild(num);
    header.appendChild(main);
    header.appendChild(right);
  }

  function buildSelectionStack(body) {
    const zones = [...body.querySelectorAll(':scope > .sel-zone')];
    if (!zones.length) return null;

    let stack = body.querySelector(':scope > .agent-selection-stack');
    if (!stack) {
      stack = makeEl('div', 'agent-selection-stack');
      body.insertBefore(stack, zones[0]);
    }

    zones.forEach(zone => stack.appendChild(zone));
    ensureSection(stack, 'choice');
    return stack;
  }

  function groupActions(body) {
    const actions = body.querySelector(':scope > .agent-actions') || body.querySelector('.agent-section-actions > .agent-actions');
    if (!actions) return;

    if (!actions.querySelector('.action-group')) {
      const buttons = [...actions.children];
      const primary = makeEl('div', 'action-group action-group-primary');
      const tools = makeEl('div', 'action-group action-group-tools');
      buttons.forEach((btn, idx) => (idx < 3 ? primary : tools).appendChild(btn));
      actions.innerHTML = '';
      if (primary.childElementCount) actions.appendChild(primary);
      if (tools.childElementCount) actions.appendChild(tools);
    }

    ensureSection(actions, 'actions');
  }

  function structureCard(card) {
    if (!card) return;
    buildHeader(card);

    const body = card.querySelector(':scope > .agent-body');
    if (!body) return;

    const output = body.querySelector(':scope > .output-box') || body.querySelector('.agent-section-output > .output-box');
    const correction = body.querySelector(':scope > .correction-area') || body.querySelector('.agent-section-correction > .correction-area');
    const rules = body.querySelector(':scope > .rules-display') || body.querySelector('.agent-section-rules > .rules-display');

    if (output) ensureSection(output, 'output');
    buildSelectionStack(body);
    if (correction) ensureSection(correction, 'correction');
    groupActions(body);
    if (rules) ensureSection(rules, 'rules');

    addHints(card);
    syncCardSummary(card);
  }

  function inferButtonLabel(btn) {
    const onclick = btn.getAttribute('onclick') || '';
    const text = (btn.textContent || '').replace(/\s+/g, ' ').trim();
    const rawTitle = btn.getAttribute('title');
    if (rawTitle && rawTitle.trim()) return rawTitle.trim();

    if (onclick.includes('rerunAgent')) return 'Relancer cet agent';
    if (onclick.includes('rerunSuite')) return 'Relancer cet agent puis la suite';
    if (onclick.includes('persistRule')) return 'Ajouter cette correction comme règle permanente';
    if (onclick.includes('openPromptLightbox(\'tags_filter\')')) return 'Ouvrir le prompt Filter';
    if (onclick.includes('openPromptLightbox(\'tags_select\')')) return 'Ouvrir le prompt Select';
    if (onclick.includes('openPromptLightbox(\'tags\')')) return 'Ouvrir le prompt Explore';
    if (onclick.includes('openPromptLightbox')) return 'Ouvrir le prompt de cet agent';
    if (onclick.includes('stopAgent')) return 'Stopper cet agent';
    if (onclick.includes('copyOut')) return 'Copier la sortie de l’agent';
    if (onclick.includes('showRawInput')) return 'Voir l’input brut envoyé à l’agent';
    if (onclick.includes('runTagExplorer')) return 'Explorer d’autres tags';
    if (onclick.includes('runTitreExplorer')) return 'Explorer d’autres titres';
    if (onclick.includes('pasteSelectedTitre')) return 'Coller le titre sélectionné dans le champ manuel';
    if (onclick.includes('validateAccrocheCTA')) return 'Valider la sélection et assembler';
    if (onclick.includes('validateTitre(')) return 'Valider ce titre';
    if (onclick.includes('validateTitreSegment')) return 'Ajouter ce titre à la bibliothèque validée';
    if (onclick.includes('invalidateTitreSegment')) return 'Blacklister un segment ou ce titre';
    if (onclick.includes('copyTitreLine')) return 'Copier cette proposition dans le presse-papiers';
    if (onclick.includes('validateTag')) return 'Valider ce tag';
    if (onclick.includes('invalidateTag')) return 'Blacklister ce tag ou un terme';
    if (onclick.includes('rerollTag')) return 'Régénérer un remplaçant';

    if (text === '📋') return 'Copier';
    if (text === '⚙️') return 'Réglages de prompt';
    if (text === '</>' || text === '< />') return 'Input brut';
    if (text === '⏹') return 'Stop';
    if (text === '👍') return 'Valider';
    if (text === '👎') return 'Invalider';
    if (text === '🔄') return 'Régénérer';
    if (text) return text;
    return 'Action';
  }

  function addHints(root) {
    if (!root) return;

    root.querySelectorAll('button').forEach(btn => {
      const label = inferButtonLabel(btn);
      if (!btn.getAttribute('title')) btn.setAttribute('title', label);
      if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', label);
      btn.dataset.uxHint = '1';
    });

    root.querySelectorAll('.badge-rules').forEach(el => {
      if (!el.getAttribute('title')) el.setAttribute('title', 'Règles permanentes');
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Règles permanentes');
    });
    root.querySelectorAll('.badge-img').forEach(el => {
      if (!el.getAttribute('title')) el.setAttribute('title', 'Cet agent utilise les images');
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Cet agent utilise les images');
    });
  }

  function statusTone(text) {
    const t = (text || '').toLowerCase();
    if (!t || t.includes('attente')) return 'muted';
    if (t.includes('erreur') || t.includes('alerte') || t.includes('stopp')) return 'danger';
    if (t.includes('sélection') || t.includes('requise')) return 'warning';
    if (t.includes('génération') || t.includes('audit') || t.includes('relance')) return 'accent';
    if (t.includes('done') || t.includes('valid')) return 'success';
    return 'info';
  }

  function getSummaryItems(card) {
    const items = [];
    const body = card.querySelector(':scope > .agent-body');
    const status = card.querySelector('.agent-status');
    const output = body?.querySelector('.output-box');
    const correction = body?.querySelector('textarea');
    const rules = body?.querySelectorAll('.rules-display span').length || 0;
    const selectionZones = body ? [...body.querySelectorAll('.sel-zone')] : [];
    const visibleSelection = selectionZones.filter(zone => {
      const style = window.getComputedStyle(zone);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    const visibleSelectionHasItems = visibleSelection.some(zone => zone.querySelector('.titre-item, .choice-item'));

    const statusText = status?.textContent?.trim() || '';
    if (statusText) items.push({ text: statusText, tone: statusTone(statusText) });

    const outputText = output?.textContent?.trim() || '';
    if (outputText && outputText !== '— pas encore généré —' && !outputText.startsWith('❌')) {
      items.push({ text: 'résultat prêt', tone: 'success' });
    } else if (!items.length) {
      items.push({ text: 'aucune sortie', tone: 'muted' });
    }

    if (visibleSelectionHasItems) {
      items.push({ text: 'choix à faire', tone: 'warning' });
    }

    if (correction?.value?.trim()) {
      items.push({ text: 'correction saisie', tone: 'info' });
    }

    if (rules > 0) {
      items.push({ text: `${rules} règle${rules > 1 ? 's' : ''}`, tone: 'info' });
    }

    const dedup = [];
    const seen = new Set();
    items.forEach(item => {
      const key = `${item.text}::${item.tone}`;
      if (seen.has(key)) return;
      seen.add(key);
      dedup.push(item);
    });
    return dedup.slice(0, 4);
  }

  function syncCardSummary(card) {
    if (!card) return;
    const body = card.querySelector(':scope > .agent-body');
    const summary = card.querySelector('.agent-summary');
    if (!body || !summary) return;

    card.classList.toggle('collapsed', !body.classList.contains('open'));

    const html = getSummaryItems(card)
      .map(item => `<span class="agent-summary-pill ${item.tone}">${item.text}</span>`)
      .join('');

    if (summary.innerHTML !== html) summary.innerHTML = html;
  }

  let refreshRaf = null;
  function scheduleRefresh(root) {
    if (!root) return;
    if (refreshRaf) cancelAnimationFrame(refreshRaf);
    refreshRaf = requestAnimationFrame(() => {
      root.querySelectorAll('.agent-card').forEach(syncCardSummary);
      addHints(root);
    });
  }

  function enhancePipelineReadability() {
    const p = typeof pfx === 'function' ? pfx() : 'tt';
    const root = document.getElementById(`pipeline-${p}`);
    if (!root) return;

    root.querySelectorAll('.pipe-arrow').forEach(arrow => {
      if (arrow.dataset.readableArrow === '1') return;
      arrow.dataset.readableArrow = '1';
      arrow.innerHTML = '<span class="pipe-arrow-line"></span><span class="pipe-arrow-icon">↓</span><span class="pipe-arrow-label">étape suivante</span><span class="pipe-arrow-line"></span>';
    });

    root.querySelectorAll('.agent-card').forEach(structureCard);

    root.querySelectorAll('input, textarea').forEach(el => {
      if (el.dataset.readableBound === '1') return;
      el.dataset.readableBound = '1';
      el.addEventListener('input', () => scheduleRefresh(root));
      el.addEventListener('change', () => scheduleRefresh(root));
    });

    if (root._readabilityObserver) root._readabilityObserver.disconnect();
    const observer = new MutationObserver(() => scheduleRefresh(root));
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    root._readabilityObserver = observer;

    scheduleRefresh(root);
  }

  function patchAfter(fnName) {
    const original = window[fnName];
    if (typeof original !== 'function' || original.__uxReadablePatched) return;
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      setTimeout(enhancePipelineReadability, 0);
      return result;
    };
    wrapped.__uxReadablePatched = true;
    window[fnName] = wrapped;
  }

  ['buildPipeline', 'buildTagsUI', 'buildTitreSelectionUI', 'buildAccrocheCTASelectionUI', 'refreshRules', 'toggleCard', 'openCard'].forEach(patchAfter);
  setTimeout(enhancePipelineReadability, 0);
})();
'''

CSS_BLOCK = r'''
/* === UX/UI PATCH 2 — pipeline lisible === */
.agent-card {
  position: relative;
}

.agent-header {
  align-items: flex-start;
}

.agent-header-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.agent-title-stack {
  flex: 1 1 auto;
  min-width: 0;
}

.agent-title-stack .agent-title {
  display: block;
  margin: 0;
  line-height: 1.35;
}

.agent-inline-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.agent-header-right {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-shrink: 0;
}

.agent-status {
  white-space: nowrap;
  font-weight: 700;
}

.agent-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 24px;
}

.agent-summary-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.03);
  color: var(--muted);
  font-family: 'JetBrains Mono', 'Space Mono', monospace;
  font-size: 10px;
  line-height: 1;
}

.agent-summary-pill.success {
  color: var(--success);
  border-color: rgba(76,175,125,.24);
  background: rgba(76,175,125,.10);
}

.agent-summary-pill.warning {
  color: var(--accent);
  border-color: rgba(232,197,71,.24);
  background: rgba(232,197,71,.10);
}

.agent-summary-pill.danger {
  color: var(--error);
  border-color: rgba(255,71,87,.24);
  background: rgba(255,71,87,.10);
}

.agent-summary-pill.info {
  color: var(--accent2);
  border-color: rgba(255,107,53,.24);
  background: rgba(255,107,53,.10);
}

.agent-summary-pill.accent {
  color: var(--text);
  border-color: rgba(126,184,247,.24);
  background: rgba(126,184,247,.10);
}

.agent-summary-pill.muted {
  color: var(--muted);
}

.agent-card.collapsed .agent-header {
  padding-bottom: 16px;
}

.pipe-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  margin: 2px 0 6px;
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
  font-family: 'JetBrains Mono', 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--muted);
}

.agent-section {
  margin-top: 12px;
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 12px;
  background: rgba(255,255,255,.015);
  overflow: hidden;
}

.agent-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,.05);
  background: rgba(255,255,255,.02);
}

.agent-section-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--text);
}

.agent-section-hint {
  font-family: 'JetBrains Mono', 'Space Mono', monospace;
  font-size: 10px;
  color: var(--muted);
  text-align: right;
}

.agent-section > .output-box,
.agent-section > .agent-selection-stack,
.agent-section > .correction-area,
.agent-section > .agent-actions,
.agent-section > .rules-display {
  margin: 0;
  padding: 12px;
}

.agent-section-output > .output-box {
  min-height: 72px;
  max-height: 340px;
}

.agent-selection-stack {
  display: grid;
  gap: 10px;
}

.agent-selection-stack .sel-zone {
  margin: 0;
}

.agent-selection-stack .sel-zone.visible,
.agent-selection-stack .sel-zone[style*="display: block"] {
  display: block;
}

.agent-selection-stack .sel-zone h4 {
  margin-bottom: 10px;
}

.agent-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.action-group-primary .btn {
  flex: 1 1 150px;
}

.action-group-tools .btn {
  min-width: 42px;
}

.agent-section-rules .rules-display {
  line-height: 1.9;
}

.agent-section-correction textarea {
  min-height: 84px;
  resize: vertical;
}

.agent-section-correction label {
  display: inline-block;
  margin-bottom: 8px;
  font-size: 11px;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--muted);
}

.choice-item,
.titre-item {
  border-radius: 10px;
}

.titre-item {
  transition: transform .14s ease, border-color .18s ease, background .18s ease;
}

.titre-item:hover {
  transform: translateY(-1px);
}

.titre-actions {
  gap: 6px;
}

.titre-thumb,
.titre-copy {
  min-width: 34px;
  min-height: 34px;
}

@media (max-width: 900px) {
  .agent-header {
    gap: 12px;
  }

  .agent-header-right {
    flex-direction: column;
    align-items: flex-end;
  }

  .pipe-arrow-label {
    display: none;
  }

  .pipe-arrow-line {
    max-width: 36px;
  }
}

@media (max-width: 680px) {
  .agent-title-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .agent-header {
    flex-wrap: wrap;
  }

  .agent-header-right {
    width: 100%;
    justify-content: space-between;
    flex-direction: row;
    align-items: center;
  }

  .agent-summary {
    gap: 5px;
  }

  .agent-summary-pill {
    font-size: 9px;
  }

  .action-group-primary .btn,
  .action-group-tools .btn {
    flex: 1 1 calc(50% - 8px);
  }

  .agent-section-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .agent-section-hint {
    text-align: left;
  }
}
'''


def append_once(path: Path, marker: str, block: str) -> bool:
    content = path.read_text(encoding='utf-8')
    if marker in content:
        return False
    if not content.endswith('\n'):
        content += '\n'
    content += '\n' + textwrap.dedent(block).strip('\n') + '\n'
    path.write_text(content, encoding='utf-8')
    return True


def backup(path: Path) -> Path:
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backup_path = path.with_suffix(path.suffix + f'.bak.{stamp}')
    shutil.copy2(path, backup_path)
    return backup_path


def main() -> int:
    repo = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    ui = repo / 'src' / 'pipeline-ui.js'
    css = repo / 'src' / 'pipeline.css'

    missing = [str(p) for p in (ui, css) if not p.exists()]
    if missing:
        print('Fichiers introuvables :')
        for m in missing:
            print(f' - {m}')
        return 1

    print(f'Repo : {repo}')
    b1 = backup(ui)
    b2 = backup(css)
    print(f'Backup JS  : {b1.name}')
    print(f'Backup CSS : {b2.name}')

    js_changed = append_once(ui, JS_MARKER, JS_BLOCK)
    css_changed = append_once(css, CSS_MARKER, CSS_BLOCK)

    print('')
    print(f'JS  : {"patch ajouté" if js_changed else "déjà présent"}')
    print(f'CSS : {"patch ajouté" if css_changed else "déjà présent"}')
    print('')
    print('Patch 2 appliqué : pipeline lisible')
    print('- résumé d’état dans le header des cartes')
    print('- sections visuelles Résultat / Décision / Ajustement / Actions / Mémoire')
    print('- actions regroupées et tooltips ajoutés')
    print('- connecteurs de pipeline plus lisibles')
    print('')
    print('Recharge la page après exécution.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
