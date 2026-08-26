#!/usr/bin/env python3
from pathlib import Path
import shutil
import re
import sys

ROOT = Path.cwd()
UI_JS = ROOT / "src" / "js" / "pipeline-ui.js"

def main():
    if not UI_JS.exists():
        raise SystemExit(f"Fichier introuvable: {UI_JS}")

    text = UI_JS.read_text(encoding="utf-8")

    # Find the real start of the orchestrator/aliases block, with a tolerant regex.
    m = re.search(r"const\s*\{\s*extractLastNumberedBlock\s*,", text)
    if not m:
        raise SystemExit(
            "Impossible de trouver le début du bloc aliases dans src/js/pipeline-ui.js\n"
            "Cherché via regex: const\\s*\\{\\s*extractLastNumberedBlock\\s*,"
        )

    start = m.start()

    new_head = (
        "'use strict';\n\n"
        "window.PipelineUI = window.PipelineUI || {};\n\n"
    )

    new_text = new_head + text[start:].lstrip()

    if new_text == text:
        print("Aucun changement : le header semble déjà nettoyé.")
        return

    backup = UI_JS.with_name(UI_JS.name + ".bak_fix_duplicate_state_runtime_v3")
    if not backup.exists():
        shutil.copy2(UI_JS, backup)

    UI_JS.write_text(new_text, encoding="utf-8")

    print("OK: header shell résiduel supprimé dans src/js/pipeline-ui.js")
    print(f"Backup: {backup}")

if __name__ == "__main__":
    main()
