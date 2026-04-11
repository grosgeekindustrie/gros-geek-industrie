
from pathlib import Path
import re
import sys

path = Path("src/pipeline-ui.js")
if not path.exists():
    print("Erreur: src/pipeline-ui.js introuvable")
    sys.exit(1)

src = path.read_text(encoding="utf-8")
bak = path.with_suffix(path.suffix + ".bak")
bak.write_text(src, encoding="utf-8")

orig = src

# 1) state.tagsDebug
src = src.replace(
    "  agentUsage: {},\n};",
    "  agentUsage: {},\n  tagsDebug: {\n    explore: { prompt:'', output:'', parsed:[] },\n    filter:  { prompt:'', output:'', pool:[] },\n    select:  { prompt:'', output:'', final:[] },\n  },\n};"
)

# 2) prompt map wiring
src = re.sub(
    r"const PROMPT_FILE_MAP_COLLECTION = \{.*?\};",
    """const PROMPT_FILE_MAP_COLLECTION = {
  analyse:'jules',
  alt:'iris',
  marche:'luna',
  // trio tags
  tags:'axel-explore-tags',
  tags_filter:'celine-filter-tags',
  tags_select:'axel-select-tags',
  titre:'nova',
  description:'eden',
  social:'theo',
  camille:'zoe',
  orchestrateur:'rex',
};""",
    src,
    flags=re.S
)

# 3) replace runTagsThreeAgents
new_run = r"""async function runTagsThreeAgents(ctx) {
  state.tagsDebug = {
    explore: { prompt:'', output:'', parsed:[] },
    filter:  { prompt:'', output:'', pool:[] },
    select:  { prompt:'', output:'', final:[] },
  };

  // 1) EXPLORE
  const explorePrompt = buildPrompt('tags', ctx);
  state.tagsDebug.explore.prompt = explorePrompt.filled;
  const { text: rawExplore } = await callClaude('tags', {
    filled: explorePrompt.filled,
    fixedContent: explorePrompt.fixedContent
  }, false);

  const exploreTags = parseTagOutput(rawExplore).slice(0, 60);
  state.tagsDebug.explore.output = rawExplore;
  state.tagsDebug.explore.parsed = [...exploreTags];
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
  state.tagsDebug.filter.prompt = filterInput.filled;

  const { text: rawFiltered } = await callClaude('tags', filterInput, false);
  const filteredTags = parseTagOutput(rawFiltered);
  const pool = filteredTags.length ? filteredTags : exploreTags;
  state.tagsDebug.filter.output = rawFiltered;
  state.tagsDebug.filter.pool = [...pool];

  // 3) SELECT
  const selectPrompt = buildPrompt('tags_select', ctx);
  const selectInput = {
    filled:
      `${selectPrompt.filled}\n\n` +
      `CANDIDATS RETENUS :\n` +
      `${pool.map((t, i) => `${i + 1}. ${t}`).join('\n')}`,
    fixedContent: selectPrompt.fixedContent
  };
  state.tagsDebug.select.prompt = selectInput.filled;

  const { text: rawFinal } = await callClaude('tags', selectInput, false);
  const finalTagsRaw = parseTagOutput(rawFinal);

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

  state.tagsDebug.select.output = rawFinal;
  state.tagsDebug.select.final = [...merged.slice(0, 13)];
  window.__tagsDebug = state.tagsDebug;

  state.inputs.tags = [
    '===== EXPLORE · PROMPT =====',
    state.tagsDebug.explore.prompt || '',
    '',
    '===== EXPLORE · OUTPUT =====',
    state.tagsDebug.explore.output || '',
    '',
    '===== EXPLORE · PARSED =====',
    (state.tagsDebug.explore.parsed || []).map((t, i) => `${i + 1}. ${t}`).join('\n'),
    '',
    '===== FILTER · PROMPT =====',
    state.tagsDebug.filter.prompt || '',
    '',
    '===== FILTER · OUTPUT =====',
    state.tagsDebug.filter.output || '',
    '',
    '===== FILTER · POOL =====',
    (state.tagsDebug.filter.pool || []).map((t, i) => `${i + 1}. ${t}`).join('\n'),
    '',
    '===== SELECT · PROMPT =====',
    state.tagsDebug.select.prompt || '',
    '',
    '===== SELECT · OUTPUT =====',
    state.tagsDebug.select.output || '',
    '',
    '===== FINAL =====',
    (state.tagsDebug.select.final || []).map((t, i) => `${i + 1}. ${t}`).join('\n')
  ].join('\n');

  return {
    output: formatTagsNumbered(merged.slice(0, 13)),
    debug: {
      explore: rawExplore,
      filter: rawFiltered,
      select: rawFinal
    }
  };
}"""
src = re.sub(r"async function runTagsThreeAgents\(ctx\) \{.*?\n\}", new_run, src, flags=re.S)

# 4) add prompt buttons in buildPipeline card actions for tags
old_btn_line = """          <button class="btn btn-muted" onclick="openPromptLightbox('${a.id}')">⚙️</button>"""
new_btn_line = """          <button class="btn btn-muted" onclick="openPromptLightbox('${a.id}')">⚙️</button>
          ${a.id === 'tags' ? `<button class="btn btn-muted" title="Prompt Explore" onclick="openPromptLightbox('tags')">⚙️E</button>
          <button class="btn btn-muted" title="Prompt Filter" onclick="openPromptLightbox('tags_filter')">⚙️F</button>
          <button class="btn btn-muted" title="Prompt Select" onclick="openPromptLightbox('tags_select')">⚙️S</button>` : ''}"""
src = src.replace(old_btn_line, new_btn_line)

# 5) better labels for internal prompts
src = src.replace(
    "  const label = id === 'orchestrateur' ? 'Orchestrateur' : (getPipelineAgents().find(a => a.id === id)?.title || id);",
    """  const internalLabels = {
    tags: 'Axel · Explore Tags',
    tags_filter: 'Céline · Filter Tags',
    tags_select: 'Axel · Select Tags',
  };
  const label = id === 'orchestrateur' ? 'Orchestrateur' : (internalLabels[id] || getPipelineAgents().find(a => a.id === id)?.title || id);"""
)

# 6) ensure loadAllFiles uses byMode state
src = src.replace("state.prompts[agentId] = await res.text();", "state.promptsByMode[mode][agentId] = await res.text();")
src = src.replace("state.biblios[key] = await res.text();", "state.bibliosByMode[mode][key] = await res.text();")

# 7) prompt lightbox mapping for internal keys
src = src.replace(
    "  const agentKey = currentLbAgentId === 'orchestrateur' ? (currentMode === 'collection' ? 'rex' : 'felix') : currentLbAgentId;\n  const fname = map[agentKey] || agentKey;",
    "  const agentKey = currentLbAgentId === 'orchestrateur' ? 'orchestrateur' : currentLbAgentId;\n  const fname = map[agentKey] || agentKey;"
)

if src == orig:
    print("Aucune modification appliquée. Le fichier ne correspond pas aux motifs attendus.")
    sys.exit(2)

out = Path("/mnt/data/fix_multi_alex_tags_debug_buttons.py")
out.write_text(script, encoding="utf-8")
print(out)
