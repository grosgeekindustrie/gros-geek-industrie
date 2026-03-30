#!/usr/bin/env python3
from pathlib import Path
import re
import sys

target = Path("src/pipeline-ui.js")
if not target.exists():
    print("Erreur: src/pipeline-ui.js introuvable. Lance ce script à la racine du projet.")
    sys.exit(1)

src = target.read_text(encoding="utf-8")
original = src

# 1) Fix autoRegenTag: keep reroll button in sync after replacement
old = """    if (btns[0]) btns[0].setAttribute('onclick', `event.stopPropagation();validateTag('${safe}')`);
    if (btns[1]) btns[1].setAttribute('onclick', `event.stopPropagation();invalidateTag('${safe}','${itemId}')`);
    itemEl.classList.remove('regen-pending');"""
new = """    if (btns[0]) btns[0].setAttribute('onclick', `event.stopPropagation();validateTag('${safe}')`);
    if (btns[1]) btns[1].setAttribute('onclick', `event.stopPropagation();invalidateTag('${safe}','${itemId}')`);
    if (btns[2]) btns[2].setAttribute('onclick', `event.stopPropagation();rerollTag('${safe}','${itemId}')`);
    itemEl.classList.remove('regen-pending');"""
if old in src:
    src = src.replace(old, new, 1)

# 2) Add 3 prompt buttons on tags card if absent
needle = """          <button class="btn btn-muted" onclick="openPromptLightbox('${a.id}')">⚙️</button>"""
replacement = """          <button class="btn btn-muted" onclick="openPromptLightbox('${a.id}')">⚙️</button>
          ${a.id === 'tags' ? `<button class="btn btn-muted" title="Prompt Explore" onclick="openPromptLightbox('tags')">⚙️E</button>` : ''}
          ${a.id === 'tags' ? `<button class="btn btn-muted" title="Prompt Filter" onclick="openPromptLightbox('tags_filter')">⚙️F</button>` : ''}
          ${a.id === 'tags' ? `<button class="btn btn-muted" title="Prompt Select" onclick="openPromptLightbox('tags_select')">⚙️S</button>` : ''}"""
if "⚙️E" not in src and needle in src:
    src = src.replace(needle, replacement, 1)

# 3) Better labels for hidden tag prompts
pattern = r"""function openPromptLightbox\(id\) \{
  currentLbAgentId = id;
  const label = id === 'orchestrateur' \? 'Orchestrateur' : \(getPipelineAgents\(\)\.find\(a => a\.id === id\)\?\.title \|\| id\);
  document\.getElementById\('lbTitle'\)\.textContent = `⚙️ PROMPT — \$\{label\}`;"""
repl = """function openPromptLightbox(id) {
  currentLbAgentId = id;
  const tagLabels = {
    tags: 'Axel · Explore Tags',
    tags_filter: 'Céline · Filter Tags',
    tags_select: 'Axel · Select Tags',
  };
  const label = id === 'orchestrateur'
    ? 'Orchestrateur'
    : (tagLabels[id] || getPipelineAgents().find(a => a.id === id)?.title || id);
  document.getElementById('lbTitle').textContent = `⚙️ PROMPT — ${label}`;"""
src = re.sub(pattern, repl, src, count=1)

if src == original:
    print("Aucune modification appliquée. Le fichier est peut-être déjà patché ou a trop changé.")
    sys.exit(2)

backup = target.with_suffix(target.suffix + ".bak")
backup.write_text(original, encoding="utf-8")
target.write_text(src, encoding="utf-8")

print("OK: src/pipeline-ui.js modifié")
print(f"Sauvegarde: {backup}")
print("Pense à recharger l'app après relance du serveur si nécessaire.")
