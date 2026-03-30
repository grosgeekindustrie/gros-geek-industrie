from pathlib import Path
import shutil
import sys
from datetime import datetime

MARKER_START = '/* === UX_UI FOUNDATION PATCH v1 START === */'
MARKER_END = '/* === UX_UI FOUNDATION PATCH v1 END === */'

CSS_BLOCK = r'''

/* === UX_UI FOUNDATION PATCH v1 START === */
/* Local, reversible UI-only override layer.
   Scope: src/pipeline.css only.
   No business logic, prompt mapping, parsing or tags workflow touched. */

.btn,
.run-btn,
.validate-btn,
.titre-copy,
.titre-thumb,
.rules-display span,
.manual-titre-row button {
  transition:
    transform .16s ease,
    border-color .16s ease,
    background-color .16s ease,
    color .16s ease,
    box-shadow .16s ease,
    opacity .16s ease;
}

.btn {
  min-height: 34px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  line-height: 1.1;
}

.btn:hover:not(:disabled),
.run-btn:hover:not(:disabled),
.validate-btn:hover:not(:disabled),
.titre-copy:hover,
.titre-thumb:hover {
  transform: translateY(-1px);
}

.btn:focus-visible,
.run-btn:focus-visible,
.validate-btn:focus-visible,
.titre-copy:focus-visible,
.titre-thumb:focus-visible,
.manual-titre-row button:focus-visible,
.fg input:focus-visible,
.fg select:focus-visible,
.fg textarea:focus-visible,
.manual-titre-row input:focus-visible,
.correction-area textarea:focus-visible,
.choice-item:focus-within,
.titre-item:focus-within {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(232,197,71,.14);
}

.btn:disabled,
.run-btn:disabled,
.validate-btn:disabled {
  opacity: .38;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-muted {
  background: rgba(255,255,255,.045);
  border-color: var(--border);
  color: var(--text2);
}

.btn-muted:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--border2);
  background: rgba(255,255,255,.075);
}

.btn-accent,
.btn-success,
.btn-error,
.btn-orange,
.validate-btn,
.run-btn {
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
}

.btn-accent:hover:not(:disabled) {
  background: rgba(232,197,71,.18);
  border-color: rgba(232,197,71,.42);
}

.btn-success:hover:not(:disabled),
.validate-btn:hover:not(:disabled) {
  background: rgba(76,175,125,.22);
  border-color: rgba(76,175,125,.42);
}

.btn-error:hover:not(:disabled) {
  background: rgba(255,71,87,.16);
  border-color: rgba(255,71,87,.34);
}

.btn-orange:hover:not(:disabled) {
  background: rgba(255,107,53,.16);
  border-color: rgba(255,107,53,.34);
}

.agent-card {
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0,0,0,.18);
}

.agent-card:hover {
  border-color: var(--border2);
}

.agent-card.active {
  box-shadow: 0 14px 34px rgba(0,0,0,.24);
}

.agent-header {
  padding: 14px 16px;
  gap: 12px;
}

.agent-header:hover {
  background: rgba(255,255,255,.03);
}

.agent-num {
  min-width: 30px;
  border-radius: 999px;
}

.agent-title {
  letter-spacing: .2px;
}

.agent-status {
  border: 1px solid rgba(255,255,255,.05);
}

.badge-rules,
.badge-img {
  border-radius: 999px;
  padding: 3px 7px;
}

.chevron {
  opacity: .72;
}

.output-box,
.sel-zone,
.correction-area textarea,
.manual-titre-row input,
.fg input,
.fg select,
.fg textarea {
  box-shadow: inset 0 1px 0 rgba(255,255,255,.02);
}

.output-box {
  border-radius: 10px;
  padding: 14px;
}

.output-box.empty {
  opacity: .9;
}

.sel-zone {
  border-radius: 10px;
  padding: 13px;
}

.sel-zone h4,
.correction-area label,
.fg label {
  letter-spacing: .9px;
}

.choice-item,
.titre-item {
  border-radius: 8px;
}

.choice-item:hover,
.titre-item:hover {
  background: rgba(232,197,71,.05);
  border-color: rgba(232,197,71,.12);
}

.choice-item.selected,
.titre-item.selected {
  background: rgba(232,197,71,.09);
  border-color: rgba(232,197,71,.28);
  box-shadow: inset 0 0 0 1px rgba(232,197,71,.06);
}

.titre-item.validated {
  background: rgba(76,175,125,.05);
}

.titre-item.invalidated {
  background: rgba(255,71,87,.04);
}

.titre-actions {
  gap: 6px;
}

.titre-thumb,
.titre-copy {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.manual-titre-row {
  gap: 8px;
  align-items: stretch;
}

.manual-titre-row input,
.correction-area textarea,
.fg input,
.fg select,
.fg textarea {
  transition:
    border-color .16s ease,
    background-color .16s ease,
    box-shadow .16s ease;
}

.manual-titre-row input:hover,
.correction-area textarea:hover,
.fg input:hover,
.fg select:hover,
.fg textarea:hover {
  border-color: var(--border2);
  background: rgba(255,255,255,.018);
}

.agent-actions {
  gap: 8px;
  margin-top: 10px;
  align-items: center;
}

.agent-actions .btn,
.agent-actions .validate-btn {
  min-height: 36px;
}

.rules-display {
  margin-top: 10px;
  line-height: 1.9;
}

.rules-display span {
  border-radius: 999px;
  padding: 3px 8px;
}

.rules-display span:hover {
  background: rgba(255,107,53,.18);
  border-color: rgba(255,107,53,.3);
}

@media (max-width: 720px) {
  .agent-header {
    flex-wrap: wrap;
    align-items: center;
  }

  .agent-status,
  .badge-rules,
  .badge-img {
    order: 3;
  }

  .agent-actions {
    gap: 6px;
  }

  .agent-actions .btn,
  .validate-btn {
    flex: 1 1 calc(50% - 6px);
    justify-content: center;
  }

  .manual-titre-row {
    flex-direction: column;
  }
}
/* === UX_UI FOUNDATION PATCH v1 END === */
'''


def main():
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
    css_path = root / 'src' / 'pipeline.css'

    if not css_path.exists():
        print(f'[ERREUR] Fichier introuvable: {css_path}')
        sys.exit(1)

    original = css_path.read_text(encoding='utf-8')

    if MARKER_START in original:
        print('[OK] Le patch UX/UI foundation est déjà présent. Aucun changement.')
        return

    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backup_path = css_path.with_suffix(css_path.suffix + f'.bak-{stamp}')
    shutil.copy2(css_path, backup_path)

    updated = original.rstrip() + '\n' + CSS_BLOCK + '\n'
    css_path.write_text(updated, encoding='utf-8', newline='\n')

    print('[OK] Patch UX/UI foundation appliqué.')
    print(f'[BACKUP] {backup_path}')
    print(f'[FILE]   {css_path}')
    print('Étape suivante conseillée: vérifier visuellement la vue pipeline, les hover/focus et le responsive des cartes agents.')


if __name__ == '__main__':
    main()
