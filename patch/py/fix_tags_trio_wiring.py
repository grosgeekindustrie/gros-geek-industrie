
from pathlib import Path
import re, sys

path = Path("src/pipeline-ui.js")
if not path.exists():
    raise SystemExit("src/pipeline-ui.js introuvable. Lance ce script à la racine du projet.")

text = path.read_text(encoding="utf-8")
original = text

pattern = re.compile(
    r"(const\s+PROMPT_FILE_MAP_COLLECTION\s*=\s*\{.*?analyse:\s*'jules',\s*"
    r"alt:\s*'iris',\s*"
    r"marche:\s*'luna',\s*"
    r")(.*?)(\n\s*titre:\s*'nova',)",
    re.S
)

replacement_middle = """
  // tags visible dans l’UI = étape explore
  tags:'axel-explore-tags',

  // prompts internes non visibles dans la pipeline
  tags_filter:'celine-filter-tags',
  tags_select:'axel-select-tags',"""

def repl(m):
    return m.group(1) + replacement_middle + m.group(3)

new_text, n = pattern.subn(repl, text, count=1)
if n != 1:
    raise SystemExit("Bloc PROMPT_FILE_MAP_COLLECTION non trouvé ou format inattendu.")

backup = path.with_suffix(path.suffix + ".bak")
backup.write_text(original, encoding="utf-8")
path.write_text(new_text, encoding="utf-8")
print("OK: src/pipeline-ui.js mis à jour")
print(f"Sauvegarde: {backup}")
