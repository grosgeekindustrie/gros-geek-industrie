#!/usr/bin/env python3
import re
from pathlib import Path
import shutil
import sys

TARGET = Path("src/pipeline-ui.js")

NEW_RUN_TAGS = r"""async function runTagsThreeAgents(ctx) {
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

  const finalOutput = formatTagsNumbered(merged.slice(0, 13));

  state.inputs.tags = [
    '===== TAGS / STEP 1 — EXPLORE / PROMPT =====',
    exploreInput.filled || '',
    '',
    '===== TAGS / STEP 1 — EXPLORE / RAW OUTPUT =====',
    rawExplore || '',
    '',
    '===== TAGS / STEP 1 — EXPLORE / PARSED CANDIDATES =====',
    exploreTags.map((t, i) => `${i + 1}. ${t}`).join('\\n'),
    '',
    '===== TAGS / STEP 2 — FILTER / PROMPT =====',
    filterInput.filled || '',
    '',
    '===== TAGS / STEP 2 — FILTER / RAW OUTPUT =====',
    rawFiltered || '',
    '',
    '===== TAGS / STEP 2 — FILTER / RETAINED POOL =====',
    pool.map((t, i) => `${i + 1}. ${t}`).join('\\n'),
    '',
    '===== TAGS / STEP 3 — SELECT / PROMPT =====',
    selectInput.filled || '',
    '',
    '===== TAGS / STEP 3 — SELECT / RAW OUTPUT =====',
    rawFinal || '',
    '',
    '===== TAGS / FINAL NORMALIZED =====',
    finalOutput
  ].join('\\n');

  return {
    output: finalOutput,
    debug: {
      explorePrompt: exploreInput.filled,
      exploreRaw: rawExplore,
      exploreTags,
      filterPrompt: filterInput.filled,
      filterRaw: rawFiltered,
      pool,
      selectPrompt: selectInput.filled,
      selectRaw: rawFinal,
      finalTags: merged.slice(0, 13)
    }
  };
}"""

def replace_function(src: str, func_name: str, new_func: str) -> str:
    marker = f"async function {func_name}("
    start = src.find(marker)
    if start == -1:
        raise RuntimeError(f"Function not found: {func_name}")
    brace_start = src.find("{", start)
    if brace_start == -1:
        raise RuntimeError(f"Opening brace not found for {func_name}")
    depth = 0
    i = brace_start
    in_str = None
    escape = False
    while i < len(src):
        ch = src[i]
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == in_str:
                in_str = None
        else:
            if ch in ("'", '"', "`"):
                in_str = ch
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    return src[:start] + new_func + src[end:]
        i += 1
    raise RuntimeError(f"Could not parse function body for {func_name}")

def patch_run_batch_agent(src: str) -> str:
    pattern = re.compile(
        r"(if\s*\(agent\.id\s*===\s*'tags'\)\s*\{\s*"
        r"const\s*\{\s*output,\s*debug\s*\}\s*=\s*await\s*runTagsThreeAgents\(ctx\);\s*"
        r"state\.outputs\.tags\s*=\s*output;\s*)"
        r"state\.inputs\.tags\s*=\s*\[[\s\S]*?\]\.join\('\\n'\);\s*"
        r"(return\s+true;\s*\})",
        re.M
    )
    repl = r"\1\2"
    new_src, n = pattern.subn(repl, src, count=1)
    if n == 0:
        # fallback: simpler special block replacement
        pattern2 = re.compile(
            r"if\s*\(agent\.id\s*===\s*'tags'\)\s*\{[\s\S]*?return\s+true;\s*\}",
            re.M
        )
        repl2 = """if (agent.id === 'tags') {
      const { output } = await runTagsThreeAgents(ctx);
      state.outputs.tags = output;
      return true;
    }"""
        new_src, n2 = pattern2.subn(repl2, src, count=1)
        if n2 == 0:
            raise RuntimeError("Could not patch runBatchAgent tags special-case")
    return new_src

def main():
    if not TARGET.exists():
        print(f"Missing file: {TARGET}", file=sys.stderr)
        sys.exit(1)

    src = TARGET.read_text(encoding="utf-8")
    original = src

    src = replace_function(src, "runTagsThreeAgents", NEW_RUN_TAGS)
    src = patch_run_batch_agent(src)

    if src == original:
        print("No changes made.")
        return

    backup = TARGET.with_suffix(".js.bak")
    shutil.copy2(TARGET, backup)
    TARGET.write_text(src, encoding="utf-8")
    print(f"Patched {TARGET}")
    print(f"Backup written to {backup}")

if __name__ == "__main__":
    main()
