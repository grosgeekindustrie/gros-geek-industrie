#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys

ROOT = Path.cwd()
UI_JS = ROOT / "src" / "js" / "pipeline-ui.js"

def main():
    if not UI_JS.exists():
        raise SystemExit(f"Fichier introuvable: {UI_JS}")

    text = UI_JS.read_text(encoding="utf-8")

    anchor = "const { extractLastNumberedBlock,"
    idx = text.find(anchor)
    if idx == -1:
        raise SystemExit("Ancre introuvable dans src/js/pipeline-ui.js")

    new_head = (
        "'use strict';\n\n"
        "window.PipelineUI = window.PipelineUI || {};\n\n"
    )

    new_text = new_head + text[idx:].lstrip()

    backup = UI_JS.with_name(UI_JS.name + ".bak_fix_duplicate_state_runtime")
    if not backup.exists():
        shutil.copy2(UI_JS, backup)

    UI_JS.write_text(new_text, encoding="utf-8")

    print("OK: header nettoyé dans src/js/pipeline-ui.js")
    print(f"Backup: {backup}")

if __name__ == "__main__":
    main()
