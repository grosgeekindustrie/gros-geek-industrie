#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys

ROOT = Path.cwd()

HTML = ROOT / "src" / "etsy-pipeline-dnd-v1_2.html"
API_OLD = ROOT / "src" / "pipeline-api.js"
API_NEW = ROOT / "src" / "js" / "pipeline-api.js"

PATCH_ROOT = ROOT / "patch"
PATCH_PY = PATCH_ROOT / "py"
PATCH_GIT = PATCH_ROOT / "git"


def backup_file(path: Path, suffix: str) -> None:
    backup = path.with_name(path.name + suffix)
    if not backup.exists():
        shutil.copy2(path, backup)


def ensure_dirs() -> None:
    PATCH_PY.mkdir(parents=True, exist_ok=True)
    PATCH_GIT.mkdir(parents=True, exist_ok=True)
    for keep in [PATCH_PY / ".gitkeep", PATCH_GIT / ".gitkeep"]:
        if not keep.exists():
            keep.write_text("", encoding="utf-8")

    readme = PATCH_ROOT / "README.md"
    if not readme.exists():
        readme.write_text(
            "# Patches\n\n"
            "Organisation recommandée :\n\n"
            "- `patch/py/` → scripts Python de migration / refactor / réparation\n"
            "- `patch/git/` → vrais fichiers `*.patch` pour les diffs ciblés\n\n"
            "Exemples :\n\n"
            "```bash\n"
            "python patch/py/nom_du_patch.py\n"
            "git apply --check patch/git/nom_du_patch.patch\n"
            "git apply patch/git/nom_du_patch.patch\n"
            "```\n",
            encoding="utf-8",
        )


def move_pipeline_api() -> None:
    if API_OLD.exists():
        API_NEW.parent.mkdir(parents=True, exist_ok=True)
        if API_NEW.exists():
            backup_file(API_NEW, ".bak_bonus_api_move")
            # Keep the newest content from src/pipeline-api.js as source of truth for the move
            API_NEW.write_text(API_OLD.read_text(encoding="utf-8"), encoding="utf-8")
            API_OLD.unlink()
        else:
            shutil.move(str(API_OLD), str(API_NEW))
    elif not API_NEW.exists():
        raise RuntimeError("Impossible de trouver pipeline-api.js ni dans src/ ni dans src/js/")

    backup_file(API_NEW, ".bak_bonus_api_move")


def patch_html() -> None:
    if not HTML.exists():
        raise RuntimeError("Fichier HTML introuvable : src/etsy-pipeline-dnd-v1_2.html")

    text = HTML.read_text(encoding="utf-8")
    original = text

    backup_file(HTML, ".bak_bonus_patch_dirs_api_move")

    text = text.replace('src="pipeline-api.js"', 'src="js/pipeline-api.js"')
    text = text.replace("src='pipeline-api.js'", "src='js/pipeline-api.js'")

    # If the file already points to js/pipeline-api.js, this is a no-op.
    if text != original:
        HTML.write_text(text, encoding="utf-8")


def main() -> None:
    ensure_dirs()
    move_pipeline_api()
    patch_html()

    print("OK: bonus infra appliqué")
    print("- patch/py créé")
    print("- patch/git créé")
    print("- src/pipeline-api.js déplacé vers src/js/pipeline-api.js")
    print("- HTML mis à jour pour charger js/pipeline-api.js")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERREUR: {e}", file=sys.stderr)
        sys.exit(1)
