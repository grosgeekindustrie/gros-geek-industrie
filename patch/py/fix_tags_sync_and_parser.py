#!/usr/bin/env python3
from pathlib import Path
import re
import sys

TARGET = Path('src/pipeline-ui.js')

if not TARGET.exists():
    print('Erreur: src/pipeline-ui.js introuvable. Lance ce script a la racine du projet.')
    sys.exit(1)

src = TARGET.read_text(encoding='utf-8')
original = src

parse_pattern = re.compile(
    r"function parseTagOutput\(raw\) \{.*?\n\}\n\nfunction formatTagsNumbered\(tags\) \{.*?\n\}",
    re.DOTALL,
)

parse_replacement = """function extractLastNumberedTagBlock(raw) {
  const lines = String(raw || '').split('\\n');
  const blocks = [];
  let current = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^\\d+[.)]\\s+/.test(trimmed)) {
      current.push(trimmed);
      continue;
    }

    if (current.length) {
      if (!trimmed) continue;
      blocks.push(current.slice());
      current = [];
    }
  }

  if (current.length) blocks.push(current.slice());
  return blocks.length ? blocks[blocks.length - 1] : [];
}

function parseTagOutput(raw) {
  if (!raw) return [];

  const lastNumberedBlock = extractLastNumberedTagBlock(raw);
  const sourceLines = lastNumberedBlock.length
    ? lastNumberedBlock
    : String(raw).split('\\n');

  const cleaned = sourceLines
    .map(line => line.trim())
    .filter(Boolean)
    .flatMap(line => {
      if (line.includes(',') && !/^\\d+[.)]\\s/.test(line)) {
        return line.split(',').map(x => x.trim()).filter(Boolean);
      }
      return [line];
    })
    .map(line => line.replace(/^\\d+[.)]\\s*/, ''))
    .map(line => line.replace(/^[-•+]\\s*/, ''))
    .map(line => line.trim())
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
}

function formatTagsNumbered(tags) {
  return tags.map((t, i) => `${i + 1}. ${t}`).join('\\n');
}"""

src, parse_count = parse_pattern.subn(lambda m: parse_replacement, src, count=1)
if parse_count != 1:
    print('Erreur: bloc parseTagOutput introuvable ou inattendu.')
    sys.exit(2)

sync_pattern = re.compile(
    r"function syncTagsOutputFromUI\(\) \{.*?\n\}\n\n\n// ═══════════════════════════════════════════════════════════\n// TITRE SÉLECTION",
    re.DOTALL,
)

sync_replacement = """function syncTagsOutputFromUI() {
  const p = pfx();
  const list = document.getElementById(`${p}-sel-list-tags`);
  if (!list) return;

  const tags = [...list.querySelectorAll('.titre-item .titre-text')]
    .map(el => el.textContent.trim())
    .filter(Boolean);
  if (!tags.length) return;

  const normalized = formatTagsNumbered(tags);
  state.outputs.tags = normalized;

  const outEl = document.getElementById(`${p}-out-tags`);
  if (outEl) outEl.textContent = normalized;

  const finalTagsEl = document.getElementById(`fc-tags-${p}`);
  if (finalTagsEl) finalTagsEl.textContent = normalized;

  if (typeof assembleFinal === 'function') assembleFinal();
}


// ═══════════════════════════════════════════════════════════
// TITRE SÉLECTION"""

src, sync_count = sync_pattern.subn(lambda m: sync_replacement, src, count=1)
if sync_count != 1:
    print('Erreur: bloc syncTagsOutputFromUI introuvable ou inattendu.')
    sys.exit(3)

if src == original:
    print('Aucune modification appliquée.')
    sys.exit(4)

backup = TARGET.with_suffix(TARGET.suffix + '.bak_fix_tags_sync_parser')
backup.write_text(original, encoding='utf-8')
TARGET.write_text(src, encoding='utf-8')

print('OK: fix tags sync + parser appliqué')
print(f'Sauvegarde: {backup}')
print('Effets:')
print('- correction du join cassé dans syncTagsOutputFromUI')
print('- resync de state.outputs.tags, de la box tags, et de la sortie finale après reroll')
print('- parseTagOutput centré sur le dernier bloc numéroté avec fallback sur le comportement existant')
