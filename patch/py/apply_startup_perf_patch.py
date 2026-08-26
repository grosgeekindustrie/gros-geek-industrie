#!/usr/bin/env python3
from __future__ import annotations
import sys
from pathlib import Path
from datetime import datetime
import shutil

def backup(path: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    bak = path.with_name(f"{path.name}.bak_{stamp}")
    shutil.copy2(path, bak)
    return bak

def patch_server(server_path: Path) -> str:
    text = server_path.read_text(encoding="utf-8")
    original = text

    if "ThreadingLocalServer(http.server.ThreadingHTTPServer)" not in text:
        marker = "def main():"
        if marker not in text:
            raise RuntimeError("Impossible de trouver def main() dans server.py")
        inject = (
            "class ThreadingLocalServer(http.server.ThreadingHTTPServer):\n"
            "    daemon_threads = True\n"
            "    allow_reuse_address = True\n\n"
        )
        text = text.replace(marker, inject + marker, 1)

    text = text.replace(
        "server = http.server.HTTPServer(('localhost', PORT), Handler)",
        "server = ThreadingLocalServer(('localhost', PORT), Handler)"
    )

    if text == original:
        return "server.py déjà patché ou aucune modif nécessaire"

    server_path.write_text(text, encoding="utf-8")
    return "server.py patché (serveur local multithread)"

def patch_ui(ui_path: Path) -> str:
    text = ui_path.read_text(encoding="utf-8")
    original = text

    old = (
        "setupImageHandlers('tt');\n"
        "setupImageHandlers('col');\n"
        "loadPersistedData();\n"
        "buildPipeline();\n"
        "buildEchellesUI();\n"
        "loadFormState();\n"
        "attachFormPersistence();\n"
        "loadAllFiles();\n"
        "\n"
        "// Restore view after init — immediate, no flash\n"
        "if (window._restoreView === 'form' && window._restoreMode) {\n"
        "  selectMode(window._restoreMode);\n"
        "  window._restoreView = null;\n"
        "}\n"
        "\n"
        "// Reveal body after view is set\n"
        "document.body.classList.add('ready');"
    )

    new = (
        "setupImageHandlers('tt');\n"
        "setupImageHandlers('col');\n"
        "loadPersistedData();\n"
        "buildPipeline();\n"
        "buildEchellesUI();\n"
        "loadFormState();\n"
        "attachFormPersistence();\n"
        "\n"
        "// Évite un double chargement au boot :\n"
        "// - chargement immédiat en mode par défaut\n"
        "// - puis second chargement déclenché par le mode restauré\n"
        "const shouldDeferInitialLoad = (\n"
        "  window._restoreView === 'form' &&\n"
        "  window._restoreMode &&\n"
        "  window._restoreMode !== currentMode\n"
        ");\n"
        "\n"
        "if (!shouldDeferInitialLoad) {\n"
        "  loadAllFiles();\n"
        "}\n"
        "\n"
        "// Restore view after init — immediate, no flash\n"
        "if (window._restoreView === 'form' && window._restoreMode) {\n"
        "  selectMode(window._restoreMode);\n"
        "  window._restoreView = null;\n"
        "}\n"
        "\n"
        "// Reveal body after view is set\n"
        "document.body.classList.add('ready');"
    )

    if old in text:
        text = text.replace(old, new, 1)
    elif "const shouldDeferInitialLoad" in text:
        return "pipeline-ui.js déjà patché (boot anti-double-load)"
    else:
        raise RuntimeError(
            "Impossible de trouver le bloc de boot attendu dans pipeline-ui.js. "
            "Le fichier a peut-être divergé."
        )

    if text == original:
        return "pipeline-ui.js déjà patché ou aucune modif nécessaire"

    ui_path.write_text(text, encoding="utf-8")
    return "pipeline-ui.js patché (boot anti-double-load)"

def main():
    repo = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
    server_path = repo / "server.py"
    ui_path = repo / "src" / "pipeline-ui.js"

    if not server_path.exists():
        raise SystemExit(f"server.py introuvable: {server_path}")
    if not ui_path.exists():
        raise SystemExit(f"pipeline-ui.js introuvable: {ui_path}")

    print(f"Repo: {repo}")
    print(f"Backup server: {backup(server_path)}")
    print(f"Backup ui: {backup(ui_path)}")

    print(patch_server(server_path))
    print(patch_ui(ui_path))

    print("\nVérification conseillée :")
    print("  git diff -- server.py src/pipeline-ui.js")

if __name__ == "__main__":
    main()
