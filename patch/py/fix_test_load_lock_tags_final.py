#!/usr/bin/env python3
from pathlib import Path
import sys

target = Path("src/pipeline-ui.js")
if not target.exists():
    print("Erreur: src/pipeline-ui.js introuvable. Lance ce script a la racine du projet.")
    sys.exit(1)

src = target.read_text(encoding="utf-8")
original = src

# 1) Rewire tags trio in collection map
src = src.replace("tags:'axel-select',", "tags:'axel-explore-tags',")
src = src.replace("tags_select:'axel-select',", "tags_select:'axel-select',")

# 2) Harden parseTagOutput to keep only the last coherent numbered block
old_parse = '''function parseTagOutput(raw) {
  if (!raw) return [];

  const cleaned = raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .flatMap(line => {
      // si le modèle renvoie une seule ligne CSV
      if (line.includes(',') && !/^\d+\.\s/.test(line)) {
        return line.split(',').map(x => x.trim()).filter(Boolean);
      }
      return [line];
    })
    .map(l => l.replace(/^\d+\.\s*/, ''))
    .map(l => l.replace(/^[-•+]\s*/, ''))
    .map(l => l.trim())
    .filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const tag of cleaned) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}'''
new_parse = '''function parseTagOutput(raw) {
  if (!raw) return [];

  const lines = raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const numbered = lines.filter(l => /^\d+\.\s+/.test(l));
  if (numbered.length) {
    const blocks = [];
    let current = [];

    for (const line of numbered) {
      const m = line.match(/^(\d+)\.\s+(.+)$/);
      if (!m) continue;
      const num = parseInt(m[1], 10);
      const text = m[2].trim();

      if (num === 1 && current.length) {
        blocks.push(current);
        current = [];
      }
      current.push({ num, text });
    }
    if (current.length) blocks.push(current);

    const last = blocks[blocks.length - 1] || [];
    const cleaned = last
      .map(x => x.text)
      .map(l => l.replace(/^[-•+]\s*/, '').trim())
      .filter(Boolean);

    const seen = new Set();
    const out = [];
    for (const tag of cleaned) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
      if (out.length === 13) break;
    }
    return out;
  }

  const cleaned = lines
    .flatMap(line => {
      if (line.includes(',') && !/^\d+\.\s/.test(line)) {
        return line.split(',').map(x => x.trim()).filter(Boolean);
      }
      return [line];
    })
    .map(l => l.replace(/^[-•+]\s*/, '').trim())
    .filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const tag of cleaned) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length === 13) break;
  }
  return out;
}'''
if old_parse in src:
    src = src.replace(old_parse, new_parse, 1)

# 3) Add sync helper if absent
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

  const normalized = tags.map((t, i) => `${i + 1}. ${t}`).join('\n');
  state.outputs.tags = normalized;

  const outEl = document.getElementById(`${p}-out-tags`);
  if (outEl) outEl.textContent = normalized;
}
'''
    if anchor in src:
        src = src.replace(anchor, anchor + helper, 1)

# 4) buildTagsUI should reuse parseTagOutput
old_build = '''function buildTagsUI(output) {
  const p = pfx();
  let tags = [];
  const numbered = output.match(/^\d+\.\s+(.+)$/mg);
  if (numbered) tags = numbered.map(l => l.replace(/^\d+\.\s+/, '').trim());
  else tags = output.split(',').map(t => t.trim()).filter(Boolean);
  if (!tags.length) return;'''
new_build = '''function buildTagsUI(output) {
  const p = pfx();
  const tags = parseTagOutput(output);
  if (!tags.length) return;'''
if old_build in src:
    src = src.replace(old_build, new_build, 1)

# 5) autoRegenTag should use select prompt for single replacement
src = src.replace("const prompt = buildPrompt('tags', ctx);", "const prompt = buildPrompt('tags_select', ctx);", 1)

# 6) sync top output after auto-reroll
old_auto = '''    if (btns[0]) btns[0].setAttribute('onclick', `event.stopPropagation();validateTag('${safe}')`);
    if (btns[1]) btns[1].setAttribute('onclick', `event.stopPropagation();invalidateTag('${safe}','${itemId}')`);
    if (btns[2]) btns[2].setAttribute('onclick', `event.stopPropagation();rerollTag('${safe}','${itemId}')`);
    itemEl.classList.remove('regen-pending');
    if (stillBad) { autoRegenTag(newTag, stillBad, itemEl); }
    else { showToast(`♻️ Tag remplacé : "${newTag}"`, '#7eb8f7'); }'''
new_auto = '''    if (btns[0]) btns[0].setAttribute('onclick', `event.stopPropagation();validateTag('${safe}')`);
    if (btns[1]) btns[1].setAttribute('onclick', `event.stopPropagation();invalidateTag('${safe}','${itemId}')`);
    if (btns[2]) btns[2].setAttribute('onclick', `event.stopPropagation();rerollTag('${safe}','${itemId}')`);
    itemEl.classList.remove('regen-pending');
    syncTagsOutputFromUI();
    if (stillBad) { autoRegenTag(newTag, stillBad, itemEl); }
    else { showToast(`♻️ Tag remplacé : "${newTag}"`, '#7eb8f7'); }'''
if old_auto in src:
    src = src.replace(old_auto, new_auto, 1)

# 7) Remove generic prompt button on tags card and keep only E/F/S
old_buttons = '''          <button class="btn btn-muted" onclick="openPromptLightbox('${a.id}')">⚙️</button>
          ${a.id === 'tags' ? `<button class="btn btn-muted" title="Prompt Explore" onclick="openPromptLightbox('tags')">⚙️E</button>` : ''}
          ${a.id === 'tags' ? `<button class="btn btn-muted" title="Prompt Filter" onclick="openPromptLightbox('tags_filter')">⚙️F</button>` : ''}
          ${a.id === 'tags' ? `<button class="btn btn-muted" title="Prompt Select" onclick="openPromptLightbox('tags_select')">⚙️S</button>` : ''}'''
new_buttons = '''          ${a.id === 'tags'
            ? `<button class="btn btn-muted" title="Prompt Explore" onclick="openPromptLightbox('tags')">⚙️E</button>
               <button class="btn btn-muted" title="Prompt Filter" onclick="openPromptLightbox('tags_filter')">⚙️F</button>
               <button class="btn btn-muted" title="Prompt Select" onclick="openPromptLightbox('tags_select')">⚙️S</button>`
            : `<button class="btn btn-muted" onclick="openPromptLightbox('${a.id}')">⚙️</button>`}'''
if old_buttons in src:
    src = src.replace(old_buttons, new_buttons, 1)

if src == original:
    print("Aucune modification appliquee. Le fichier est peut-etre deja corrige ou a trop change.")
    sys.exit(2)

backup = target.with_suffix(target.suffix + ".bak")
backup.write_text(original, encoding="utf-8")
target.write_text(src, encoding="utf-8")

print("OK: patch applique a src/pipeline-ui.js")
print("Sauvegarde:", backup)
print("- tags -> explore")
print("- parser garde le dernier bloc coherent")
print("- sync de la box du haut apres reroll")
print("- plus de bouton prompt generique en trop sur tags")
print("- autoRegenTag utilise le prompt select")
