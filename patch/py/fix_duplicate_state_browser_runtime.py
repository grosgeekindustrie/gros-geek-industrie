#!/usr/bin/env python3
from pathlib import Path
import re
import shutil
import sys

ROOT = Path('.')
UI_JS = ROOT / 'src' / 'js' / 'pipeline-ui.js'
HTML = ROOT / 'src' / 'etsy-pipeline-dnd-v1_2.html'

BACKUP_SUFFIX = '.bak_fix_state_duplicate'

def backup(path: Path):
    bak = path.with_name(path.name + BACKUP_SUFFIX)
    if not bak.exists():
        shutil.copy2(path, bak)

def fail(msg: str):
    raise RuntimeError(msg)

def patch_pipeline_ui(text: str) -> str:
    anchor = "const { extractLastNumberedBlock,"
    idx = text.find(anchor)
    if idx == -1:
        if "const isTT = mode === 'tabletop';" not in text and "const state = {" not in text:
            return text
        fail("Anchor not found in src/js/pipeline-ui.js")
    rebuilt = "'use strict';\n\nwindow.PipelineUI = window.PipelineUI || {};\n\n" + text[idx:].lstrip()
    rebuilt = rebuilt.replace("window.PipelineUI = window.PipelineUI || {}; window.PipelineUI = window.PipelineUI || {};", "window.PipelineUI = window.PipelineUI || {};")
    return rebuilt

def patch_html(text: str) -> str:
    # Normalize the end-of-body script stack so shell/config are loaded before pipeline-ui.
    pattern = re.compile(
        r'(?s)<script\s+src="js/ui/helper_ui\.js"></script>\s*'
        r'<script\s+src="js/ui/render_ui\.js"></script>\s*'
        r'<script\s+src="js/ui/modals_ui\.js"></script>\s*'
        r'<script\s+src="js/ui/tags_ui\.js"></script>\s*'
        r'<script\s+src="js/ui/title_ui\.js"></script>\s*'
        r'<script\s+src="js/ui/library_ui\.js"></script>\s*'
        r'<script\s+src="js/ui/batch_ui\.js"></script>\s*'
        r'<script\s+src="js/ui/config_ui\.js"></script>\s*'
        r'<script\s+src="js/ui/shell_ui\.js"></script>\s*'
        r'<script\s+src="js/pipeline-ui\.js"></script>\s*'
        r'<script\s+src="pipeline-api\.js"></script>'
    )
    desired = """<script src="js/ui/helper_ui.js"></script>
<script src="js/ui/render_ui.js"></script>
<script src="js/ui/modals_ui.js"></script>
<script src="js/ui/tags_ui.js"></script>
<script src="js/ui/title_ui.js"></script>
<script src="js/ui/library_ui.js"></script>
<script src="js/ui/batch_ui.js"></script>
<script src="js/ui/config_ui.js"></script>
<script src="js/ui/shell_ui.js"></script>
<script src="js/pipeline-ui.js"></script>
<script src="pipeline-api.js"></script>"""
    if pattern.search(text):
        return pattern.sub(desired, text, count=1)

    # Fallback: replace any script stack ending with pipeline-api.js near bottom.
    alt = re.compile(r'(?s)(<script\s+src="[^"]+"></script>\s*){3,}.*?<script\s+src="pipeline-api\.js"></script>')
    if alt.search(text):
        return alt.sub(desired, text, count=1)
    return text

def main():
    if not UI_JS.exists():
        fail(f"Missing file: {UI_JS}")
    backup(UI_JS)
    ui_text = UI_JS.read_text(encoding='utf-8')
    new_ui = patch_pipeline_ui(ui_text)
    UI_JS.write_text(new_ui, encoding='utf-8')

    if HTML.exists():
        backup(HTML)
        html_text = HTML.read_text(encoding='utf-8')
        HTML.write_text(patch_html(html_text), encoding='utf-8')

    print("Repaired duplicate state/global shell contamination in src/js/pipeline-ui.js")

if __name__ == '__main__':
    main()
