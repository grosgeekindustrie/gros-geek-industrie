#!/usr/bin/env python3
from pathlib import Path
import sys

target = Path("src/pipeline-ui.js")
if not target.exists():
    print("Erreur: src/pipeline-ui.js introuvable. Lance ce script a la racine du projet.")
    sys.exit(1)

src = target.read_text(encoding="utf-8")
original = src

# 1) Add sync helper if absent
if "function syncTagsOutputFromUI()" not in src:
    anchor = "function closeExplorer() { document.getElementById('explorerLightbox').classList.remove('visible'); }"
    helper = '''

function syncTagsOutputFromUI() {
  const p = pfx();
  const list = document.getElementById(`${p}-sel-list-tags`);
  if (!list) return;
  const tags = [...list.querySelectorAll('.titre-item .titre-text')]
    .map(el => el.textContent.trim())
    .filter(Boolean);
  if (!tags.length) return;

  const normalized = tags.map((t, i) => `${i + 1}. ${t}`).join('\\n');
  state.outputs.tags = normalized;

  const outEl = document.getElementById(`${p}-out-tags`);
  if (outEl) outEl.textContent = normalized;
}
'''
    if anchor in src:
        src = src.replace(anchor, anchor + helper, 1)

# 2) Sync after autoRegenTag
old_auto = """    itemEl.classList.remove('regen-pending');
    if (stillBad) { autoRegenTag(newTag, stillBad, itemEl); }
    else { showToast(`Tag remplace : "${newTag}"`, '#7eb8f7'); }"""
new_auto = """    itemEl.classList.remove('regen-pending');
    syncTagsOutputFromUI();
    if (stillBad) { autoRegenTag(newTag, stillBad, itemEl); }
    else { showToast(`Tag remplace : "${newTag}"`, '#7eb8f7'); }"""
if old_auto in src:
    src = src.replace(old_auto, new_auto, 1)
else:
    old_auto_alt = """    itemEl.classList.remove('regen-pending');
    if (stillBad) { autoRegenTag(newTag, stillBad, itemEl); }
    else { showToast(`♻️ Tag remplacé : "${newTag}"`, '#7eb8f7'); }"""
    new_auto_alt = """    itemEl.classList.remove('regen-pending');
    syncTagsOutputFromUI();
    if (stillBad) { autoRegenTag(newTag, stillBad, itemEl); }
    else { showToast(`♻️ Tag remplacé : "${newTag}"`, '#7eb8f7'); }"""
    if old_auto_alt in src:
        src = src.replace(old_auto_alt, new_auto_alt, 1)

# 3) Sync after rerollTag if present
old_reroll = """    el.classList.remove('regen-pending');
    showToast(`Tag remplace : "${newTag}"`, '#7eb8f7');"""
new_reroll = """    el.classList.remove('regen-pending');
    syncTagsOutputFromUI();
    showToast(`Tag remplace : "${newTag}"`, '#7eb8f7');"""
if old_reroll in src:
    src = src.replace(old_reroll, new_reroll, 1)
else:
    old_reroll_alt = """    el.classList.remove('regen-pending');
    showToast(`♻️ Tag remplacé : "${newTag}"`, '#7eb8f7');"""
    new_reroll_alt = """    el.classList.remove('regen-pending');
    syncTagsOutputFromUI();
    showToast(`♻️ Tag remplacé : "${newTag}"`, '#7eb8f7');"""
    if old_reroll_alt in src:
        src = src.replace(old_reroll_alt, new_reroll_alt, 1)

# 4) Remove generic prompt button on tags and keep E/F/S only
generic = """          <button class="btn btn-muted" onclick="openPromptLightbox('${a.id}')">⚙️</button>"""
if generic in src:
    replacement = """          ${a.id === 'tags'
            ? `<button class="btn btn-muted" title="Prompt Explore" onclick="openPromptLightbox('tags')">⚙️E</button>
               <button class="btn btn-muted" title="Prompt Filter" onclick="openPromptLightbox('tags_filter')">⚙️F</button>
               <button class="btn btn-muted" title="Prompt Select" onclick="openPromptLightbox('tags_select')">⚙️S</button>`
            : `<button class="btn btn-muted" onclick="openPromptLightbox('${a.id}')">⚙️</button>`}"""
    src = src.replace(generic, replacement, 1)

    duplicate_efs = """          ${a.id === 'tags' ? `<button class="btn btn-muted" title="Prompt Explore" onclick="openPromptLightbox('tags')">⚙️E</button>` : ''}
          ${a.id === 'tags' ? `<button class="btn btn-muted" title="Prompt Filter" onclick="openPromptLightbox('tags_filter')">⚙️F</button>` : ''}
          ${a.id === 'tags' ? `<button class="btn btn-muted" title="Prompt Select" onclick="openPromptLightbox('tags_select')">⚙️S</button>` : ''}
"""
    if duplicate_efs in src:
        src = src.replace(duplicate_efs, "", 1)

if src == original:
    print("Aucune modification appliquee. Le fichier est peut-etre deja patche ou a trop change.")
    sys.exit(2)

backup = target.with_suffix(target.suffix + ".bak")
backup.write_text(original, encoding="utf-8")
target.write_text(src, encoding="utf-8")

print("OK: patch tags final applique")
print(f"Sauvegarde: {backup}")
print("Effets: sync de la box du haut apres reroll/swap + suppression du bouton prompt generique sur tags.")