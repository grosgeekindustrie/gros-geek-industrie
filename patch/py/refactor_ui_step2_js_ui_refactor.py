from pathlib import Path
import re
import shutil

ROOT = Path('.')
OLD_PIPELINE = ROOT / 'src' / 'pipeline-ui.js'
NEW_PIPELINE = ROOT / 'src' / 'js' / 'pipeline-ui.js'
HTML = ROOT / 'src' / 'etsy-pipeline-dnd-v1_2.html'
UI_DIR = ROOT / 'src' / 'js' / 'ui'

EXISTING_UI_FILES = [
    UI_DIR / 'helper_ui.js',
    UI_DIR / 'render_ui.js',
    UI_DIR / 'modals_ui.js',
    UI_DIR / 'tags_ui.js',
    UI_DIR / 'title_ui.js',
]

NEW_UI_FILES = {
    'library_ui.js': UI_DIR / 'library_ui.js',
    'batch_ui.js': UI_DIR / 'batch_ui.js',
}


def backup(path: Path, suffix: str):
    if path.exists():
        bak = path.with_name(path.name + suffix)
        shutil.copy2(path, bak)
        return bak
    return None


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Pattern not found for {label}')
    return text.replace(old, new, 1)


def ensure_ui_namespace(text: str) -> str:
    if 'global.PipelineUI = global.PipelineUI || {};' in text:
        return text
    return re.sub(
        r'^(\(function\s+init[^\n]*\{)\n',
        r"\1\n  global.PipelineUI = global.PipelineUI || {};\n",
        text,
        count=1,
        flags=re.M,
    )


def patch_render_ui(text: str) -> str:
    text = ensure_ui_namespace(text)
    old = """    if (global.state?.outputs) {
      global.state.outputs.tags = normalized;
    }
"""
    new = """    const runtimeState = global.state || (typeof state !== 'undefined' ? state : null);
    if (runtimeState?.outputs) {
      runtimeState.outputs.tags = normalized;
    }
"""
    if old in text:
        text = text.replace(old, new, 1)
    return text


def extract_function(text: str, name: str) -> str:
    m = re.search(rf'^(async\s+function|function)\s+{re.escape(name)}\s*\(', text, flags=re.M)
    if not m:
        raise RuntimeError(f'Function not found: {name}')
    start = m.start()
    brace = text.find('{', m.end())
    depth = 0
    i = brace
    while i < len(text):
        c = text[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                # consume trailing newlines
                while end < len(text) and text[end] == '\n':
                    end += 1
                return text[start:end]
        i += 1
    raise RuntimeError(f'Could not extract function body: {name}')


def remove_block(text: str, block: str, label: str) -> str:
    if block not in text:
        raise RuntimeError(f'Block not found for removal: {label}')
    return text.replace(block, '', 1)


def extract_const_block(text: str, const_name: str) -> str:
    m = re.search(rf'^const\s+{re.escape(const_name)}\s*=\s*\{{', text, flags=re.M)
    if not m:
        raise RuntimeError(f'Const block not found: {const_name}')
    start = m.start()
    brace = text.find('{', m.end() - 1)
    depth = 0
    i = brace
    while i < len(text):
        c = text[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                while end < len(text) and text[end] in ' \t':
                    end += 1
                if end < len(text) and text[end] == ';':
                    end += 1
                while end < len(text) and text[end] == '\n':
                    end += 1
                return text[start:end]
        i += 1
    raise RuntimeError(f'Could not extract const block: {const_name}')


def extract_line(text: str, pattern: str, label: str) -> str:
    m = re.search(pattern, text, flags=re.M)
    if not m:
        raise RuntimeError(f'Line not found: {label}')
    return m.group(0) + '\n'


def build_library_module(parts: dict) -> str:
    order = [
        'BIBLIO_MAP',
        'currentBiblioTab',
        'openBiblioLightbox',
        'closeBiblioLightbox',
        'switchBiblioTab',
        'currentLbAgentId',
        'openPromptLightbox',
        'closePromptLightbox',
        'saveLbPrompt',
        'resetLbPrompt',
    ]
    body = '\n'.join(parts[name].rstrip() for name in order)
    exposed = """
  global.PipelineUILibrary = {
    openBiblioLightbox,
    closeBiblioLightbox,
    switchBiblioTab,
    saveBiblio,
    resetBiblio,
    openPromptLightbox,
    closePromptLightbox,
    saveLbPrompt,
    resetLbPrompt,
  };

  global.PipelineUI.library = global.PipelineUI.library || {};
  Object.assign(global.PipelineUI.library, global.PipelineUILibrary);
  Object.assign(global, global.PipelineUILibrary);
"""
    return f"""(function initPipelineUILibrary(global) {{
  global.PipelineUI = global.PipelineUI || {{}};

{body}
{exposed}}})(window);
"""


def build_batch_module(parts: dict) -> str:
    order = [
        'batchState',
        'batchImages',
        'showBatchCountPicker',
        'initBatchInline',
        'openBatchModal',
        'closeBatchModal',
        'initBatch',
        'buildBatchFiche',
        'batchToggleEch',
        'batchAddImages',
        'stopBatch',
        'startBatch',
        'updateBatchProgress',
        'getBatchCtx',
        'runBatchFiche',
        'runBatchAgent',
        'exportBatch',
    ]
    body = '\n'.join(parts[name].rstrip() for name in order)
    exposed = """
  global.PipelineUIBatch = {
    showBatchCountPicker,
    initBatchInline,
    openBatchModal,
    closeBatchModal,
    initBatch,
    buildBatchFiche,
    batchToggleEch,
    batchAddImages,
    stopBatch,
    startBatch,
    updateBatchProgress,
    getBatchCtx,
    runBatchFiche,
    runBatchAgent,
    exportBatch,
  };

  global.PipelineUI.batch = global.PipelineUI.batch || {};
  Object.assign(global.PipelineUI.batch, global.PipelineUIBatch);
  Object.assign(global, global.PipelineUIBatch);
"""
    return f"""(function initPipelineUIBatch(global) {{
  global.PipelineUI = global.PipelineUI || {{}};

{body}
{exposed}}})(window);
"""


def patch_pipeline_ui(text: str) -> str:
    # remove extracted library blocks
    library_parts = {
        'BIBLIO_MAP': extract_const_block(text, 'BIBLIO_MAP'),
        'currentBiblioTab': extract_line(text, r"^let\s+currentBiblioTab\s*=.*;$", 'currentBiblioTab'),
        'openBiblioLightbox': extract_function(text, 'openBiblioLightbox'),
        'closeBiblioLightbox': extract_function(text, 'closeBiblioLightbox'),
        'switchBiblioTab': extract_function(text, 'switchBiblioTab'),
        'saveBiblio': extract_function(text, 'saveBiblio'),
        'resetBiblio': extract_function(text, 'resetBiblio'),
        'currentLbAgentId': extract_line(text, r"^let\s+currentLbAgentId\s*=.*;$", 'currentLbAgentId'),
        'openPromptLightbox': extract_function(text, 'openPromptLightbox'),
        'closePromptLightbox': extract_function(text, 'closePromptLightbox'),
        'saveLbPrompt': extract_function(text, 'saveLbPrompt'),
        'resetLbPrompt': extract_function(text, 'resetLbPrompt'),
    }
    for name, block in library_parts.items():
        text = remove_block(text, block, f'library:{name}')

    # remove extracted batch blocks
    batch_parts = {
        'batchState': extract_line(text, r"^let\s+batchState\s*=.*;$", 'batchState'),
        'batchImages': extract_line(text, r"^let\s+batchImages\s*=.*;$", 'batchImages'),
        'showBatchCountPicker': extract_function(text, 'showBatchCountPicker'),
        'initBatchInline': extract_function(text, 'initBatchInline'),
        'openBatchModal': extract_function(text, 'openBatchModal'),
        'closeBatchModal': extract_function(text, 'closeBatchModal'),
        'initBatch': extract_function(text, 'initBatch'),
        'buildBatchFiche': extract_function(text, 'buildBatchFiche'),
        'batchToggleEch': extract_function(text, 'batchToggleEch'),
        'batchAddImages': extract_function(text, 'batchAddImages'),
        'stopBatch': extract_function(text, 'stopBatch'),
        'startBatch': extract_function(text, 'startBatch'),
        'updateBatchProgress': extract_function(text, 'updateBatchProgress'),
        'getBatchCtx': extract_function(text, 'getBatchCtx'),
        'runBatchFiche': extract_function(text, 'runBatchFiche'),
        'runBatchAgent': extract_function(text, 'runBatchAgent'),
        'exportBatch': extract_function(text, 'exportBatch'),
    }
    for name, block in batch_parts.items():
        text = remove_block(text, block, f'batch:{name}')

    # bootstrap namespace and shared state on window
    state_anchor = "const state = {\n"
    if "window.PipelineUI = window.PipelineUI || {};" not in text:
        inject = "const state = {\n"
        # insert after state object closes
        m = re.search(r"const state = \{[\s\S]*?\n\};\n", text)
        if not m:
            raise RuntimeError('state block not found')
        state_block = m.group(0)
        patched_state_block = state_block + "\nwindow.PipelineUI = window.PipelineUI || {};\nwindow.state = state;\nwindow.currentMode = currentMode;\n"
        text = text.replace(state_block, patched_state_block, 1)

    # keep window.currentMode updated
    switch_snippet = "  currentMode = mode;\n  state.mode = mode;\n"
    if switch_snippet in text and "window.currentMode = currentMode;" not in text[text.find('function switchMode'):text.find('function switchMode')+300]:
        text = text.replace(switch_snippet, switch_snippet + "  window.currentMode = currentMode;\n", 1)

    # alias newly extracted modules
    alias_anchor = "const { autoRegenTitre } = window.PipelineUITitles;\n\n"
    alias_block = """const { autoRegenTitre } = window.PipelineUITitles;
const {
  openBiblioLightbox,
  closeBiblioLightbox,
  switchBiblioTab,
  saveBiblio,
  resetBiblio,
  openPromptLightbox,
  closePromptLightbox,
  saveLbPrompt,
  resetLbPrompt,
} = window.PipelineUILibrary;
const {
  showBatchCountPicker,
  initBatchInline,
  openBatchModal,
  closeBatchModal,
  initBatch,
  buildBatchFiche,
  batchToggleEch,
  batchAddImages,
  stopBatch,
  startBatch,
  updateBatchProgress,
  getBatchCtx,
  runBatchFiche,
  runBatchAgent,
  exportBatch,
} = window.PipelineUIBatch;

"""
    if alias_anchor in text:
        text = text.replace(alias_anchor, alias_block, 1)
    else:
        raise RuntimeError('Alias anchor not found')

    # tidy consecutive extractions comments / blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text, library_parts, batch_parts


def patch_html(text: str) -> str:
    old = '<script src="pipeline-ui.js"></script>\n<script src="pipeline-api.js"></script>'
    new = '''<script src="js/ui/helper_ui.js"></script>
<script src="js/ui/render_ui.js"></script>
<script src="js/ui/modals_ui.js"></script>
<script src="js/ui/tags_ui.js"></script>
<script src="js/ui/title_ui.js"></script>
<script src="js/ui/library_ui.js"></script>
<script src="js/ui/batch_ui.js"></script>
<script src="js/pipeline-ui.js"></script>
<script src="pipeline-api.js"></script>'''
    return replace_once(text, old, new, 'html script stack')


def main():
    if not OLD_PIPELINE.exists():
        raise SystemExit('src/pipeline-ui.js introuvable')
    if not HTML.exists():
        raise SystemExit('src/etsy-pipeline-dnd-v1_2.html introuvable')
    for p in EXISTING_UI_FILES:
        if not p.exists():
            raise SystemExit(f'Fichier UI manquant: {p}')

    pipeline_text = OLD_PIPELINE.read_text(encoding='utf-8')
    html_text = HTML.read_text(encoding='utf-8')

    patched_pipeline, library_parts, batch_parts = patch_pipeline_ui(pipeline_text)
    patched_html = patch_html(html_text)

    library_module = build_library_module(library_parts)
    batch_module = build_batch_module(batch_parts)

    UI_DIR.mkdir(parents=True, exist_ok=True)
    NEW_PIPELINE.parent.mkdir(parents=True, exist_ok=True)

    backup(OLD_PIPELINE, '.bak_step2_refactor')
    backup(HTML, '.bak_step2_refactor')
    for p in EXISTING_UI_FILES:
        backup(p, '.bak_step2_refactor')
    for p in NEW_UI_FILES.values():
        if p.exists():
            backup(p, '.bak_step2_refactor')

    # Patch existing UI modules
    for p in EXISTING_UI_FILES:
        text = p.read_text(encoding='utf-8')
        if p.name == 'render_ui.js':
            text = patch_render_ui(text)
        else:
            text = ensure_ui_namespace(text)
        p.write_text(text, encoding='utf-8')

    # Write new modules
    NEW_UI_FILES['library_ui.js'].write_text(library_module, encoding='utf-8')
    NEW_UI_FILES['batch_ui.js'].write_text(batch_module, encoding='utf-8')

    # Move pipeline-ui.js under src/js/
    NEW_PIPELINE.write_text(patched_pipeline, encoding='utf-8')
    OLD_PIPELINE.unlink()

    HTML.write_text(patched_html, encoding='utf-8')

    print('Step 2 UI refactor applied.')
    print(f'Moved: {OLD_PIPELINE} -> {NEW_PIPELINE}')
    print('Created: src/js/ui/library_ui.js')
    print('Created: src/js/ui/batch_ui.js')
    print('Updated: src/etsy-pipeline-dnd-v1_2.html')


if __name__ == '__main__':
    main()
