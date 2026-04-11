from pathlib import Path
import re
import shutil

p = Path('src/pipeline-ui.js')
if not p.exists():
    raise SystemExit('Erreur: lance ce script à la racine du projet (src/pipeline-ui.js introuvable).')

text = p.read_text(encoding='utf-8')
orig = text

# 1) Ensure state.tagsDebug exists
if 'tagsDebug:' not in text:
    text = text.replace(
        "  agentUsage: {},\n};",
        "  agentUsage: {},\n  tagsDebug: {\n    explore: { prompt:'', output:'', parsed:[] },\n    filter:  { prompt:'', output:'', pool:[] },\n    select:  { prompt:'', output:'', final:[] },\n  },\n};"
    )

# 2) Normalize collection prompt map for the 3-step tags flow
new_map = """const PROMPT_FILE_MAP_COLLECTION = {
  analyse:'jules',
  alt:'iris',
  marche:'luna',
  tags:'axel-explore-tags',
  tags_filter:'celine-filter-tags',
  tags_select:'axel-select-tags',
  titre:'nova',
  description:'eden',
  social:'theo',
  camille:'zoe',
  orchestrateur:'rex',
};"""
text = re.sub(
    r"const PROMPT_FILE_MAP_COLLECTION = \{.*?\n\};",
    new_map,
    text,
    flags=re.S,
)

# 3) Replace runTagsThreeAgents with a logged version
start = text.find('async function runTagsThreeAgents(ctx) {')
if start == -1:
    raise SystemExit('Erreur: runTagsThreeAgents(ctx) introuvable.')

brace = text.find('{', start)
level = 0
end = None
for i in range(brace, len(text)):
    if text[i] == '{':
        level += 1
    elif text[i] == '}':
        level -= 1
        if level == 0:
            end = i + 1
            break
if end is None:
    raise SystemExit('Erreur: impossible de localiser la fin de runTagsThreeAgents(ctx).')

new_fn = r'''async function runTagsThreeAgents(ctx) {
  // 1) EXPLORE
  const explorePrompt = buildPrompt('tags', ctx);
  const exploreInput = {
    filled: explorePrompt.filled,
    fixedContent: explorePrompt.fixedContent
  };
  const { text: rawExplore } = await callClaude('tags', exploreInput, false);
  const exploreTags = parseTagOutput(rawExplore).slice(0, 60);
  if (!exploreTags.length) throw new Error('Aucun tag candidat généré');

  // 2) FILTER
  const filterPrompt = buildPrompt('tags_filter', ctx);
  const filterInput = {
    filled:
      `${filterPrompt.filled}\n\n` +
      `CANDIDATS À FILTRER :\n` +
      `${exploreTags.map((t, i) => `${i + 1}. ${t}`).join('\n')}`,
    fixedContent: filterPrompt.fixedContent
  };
  const { text: rawFiltered } = await callClaude('tags', filterInput, false);
  const filteredTags = parseTagOutput(rawFiltered);
  const pool = filteredTags.length ? filteredTags : exploreTags;

  // 3) SELECT
  const selectPrompt = buildPrompt('tags_select', ctx);
  const selectInput = {
    filled:
      `${selectPrompt.filled}\n\n` +
      `CANDIDATS RETENUS :\n` +
      `${pool.map((t, i) => `${i + 1}. ${t}`).join('\n')}`,
    fixedContent: selectPrompt.fixedContent
  };
  const { text: rawFinal } = await callClaude('tags', selectInput, false);
  const finalTagsRaw = parseTagOutput(rawFinal);

  // sécurisation douce : si le sélecteur renvoie moins de 13 tags,
  // on complète avec le pool filtré sans doublons
  const merged = [];
  const seen = new Set();
  for (const tag of [...finalTagsRaw, ...pool]) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(tag);
    if (merged.length === 13) break;
  }
  if (!merged.length) throw new Error('Aucun tag final généré');

  const output = formatTagsNumbered(merged.slice(0, 13));

  state.tagsDebug = {
    explore: {
      prompt: exploreInput.filled,
      output: rawExplore,
      parsed: exploreTags,
    },
    filter: {
      prompt: filterInput.filled,
      output: rawFiltered,
      pool,
    },
    select: {
      prompt: selectInput.filled,
      output: rawFinal,
      final: merged.slice(0, 13),
    },
  };

  window.__tagsDebug = state.tagsDebug;

  state.inputs.tags = [
    '===== TAGS EXPLORE — PROMPT =====',
    state.tagsDebug.explore.prompt || '',
    '',
    '===== TAGS EXPLORE — OUTPUT =====',
    state.tagsDebug.explore.output || '',
    '',
    '===== TAGS EXPLORE — PARSÉ =====',
    (state.tagsDebug.explore.parsed || []).map((t, i) => `${i + 1}. ${t}`).join('\n'),
    '',
    '===== TAGS FILTER — PROMPT =====',
    state.tagsDebug.filter.prompt || '',
    '',
    '===== TAGS FILTER — OUTPUT =====',
    state.tagsDebug.filter.output || '',
    '',
    '===== TAGS FILTER — RETENUS =====',
    (state.tagsDebug.filter.pool || []).map((t, i) => `${i + 1}. ${t}`).join('\n'),
    '',
    '===== TAGS SELECT — PROMPT =====',
    state.tagsDebug.select.prompt || '',
    '',
    '===== TAGS SELECT — OUTPUT =====',
    state.tagsDebug.select.output || '',
    '',
    '===== TAGS FINAL — NORMALISÉ =====',
    output,
  ].join('\n');

  return {
    output,
    debug: {
      explore: rawExplore,
      filter: rawFiltered,
      select: rawFinal
    }
  };
}'''

text = text[:start] + new_fn + text[end:]

# 4) Add 3 prompt buttons on tags card, next to existing Explorer button
old_btn = "${a.id === 'tags' ? `<button class=\"btn btn-orange\" id=\"${p}-bexplore-tags\" onclick=\"runTagExplorer()\" disabled>🔭 Explorer</button>` : ''}"
new_btn = "${a.id === 'tags' ? `\n          <button class=\"btn btn-muted\" title=\"Prompt Explore\" onclick=\"openPromptLightbox('tags')\">⚙️E</button>\n          <button class=\"btn btn-muted\" title=\"Prompt Filter\" onclick=\"openPromptLightbox('tags_filter')\">⚙️F</button>\n          <button class=\"btn btn-muted\" title=\"Prompt Select\" onclick=\"openPromptLightbox('tags_select')\">⚙️S</button>\n          <button class=\"btn btn-orange\" id=\"${p}-bexplore-tags\" onclick=\"runTagExplorer()\" disabled>🔭 Explorer</button>` : ''}"
if old_btn in text:
    text = text.replace(old_btn, new_btn)
else:
    # tolerate formatting differences
    text = re.sub(
        r"\$\{a\.id === 'tags' \? `<button class=\\\"btn btn-orange\\\" id=\\\"\$\{p\}-bexplore-tags\\\" onclick=\\\"runTagExplorer\(\)\\\" disabled>🔭 Explorer</button>` : ''\}",
        new_btn,
        text,
    )

# 5) Prevent batch from overwriting the detailed tags log
text = text.replace(
    """      state.outputs.tags = output;
      state.inputs.tags = [
        '===== TAGS EXPLORE =====',
        debug.explore || '',
        '',
        '===== TAGS FILTER =====',
        debug.filter || '',
        '',
        '===== TAGS SELECT =====',
        debug.select || ''
      ].join('\\n');

      return true;""",
    """      state.outputs.tags = output;
      // state.inputs.tags est déjà rempli en détail par runTagsThreeAgents(ctx)
      return true;"""
)

if text == orig:
    raise SystemExit('Aucune modification appliquée. Le fichier est peut-être déjà patché.')

backup = p.with_suffix('.js.bak')
if not backup.exists():
    shutil.copy2(p, backup)

p.write_text(text, encoding='utf-8')
print('Patch appliqué avec succès à src/pipeline-ui.js')
print(f'Sauvegarde créée : {backup}')
