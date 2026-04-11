
from pathlib import Path
import re
import shutil
import sys

ROOT = Path.cwd()
HTML = ROOT / 'src' / 'etsy-pipeline-dnd-v1_2.html'
PIPELINE_CANDIDATES = [
    ROOT / 'src' / 'js' / 'pipeline-ui.js',
    ROOT / 'src' / 'pipeline-ui.js',
]
UI_DIR = ROOT / 'src' / 'js' / 'ui'


def fail(msg: str) -> None:
    raise RuntimeError(msg)


def backup(path: Path, suffix: str) -> None:
    if path.exists():
        bak = path.with_name(path.name + suffix)
        if not bak.exists():
            shutil.copy2(path, bak)


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def ensure_pipeline_path() -> Path:
    for p in PIPELINE_CANDIDATES:
        if p.exists():
            return p
    fail("Impossible de trouver src/js/pipeline-ui.js ni src/pipeline-ui.js")


def replace_first(text: str, pattern: str, repl: str, label: str) -> str:
    new, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        fail(f"Pattern not found for {label}")
    return new


def extract_once(text: str, pattern: str, label: str) -> str:
    m = re.search(pattern, text, flags=re.S)
    if not m:
        fail(f"Block not found for {label}")
    return m.group(0)


def convert_first_decl(block: str, old: str, new: str) -> str:
    return re.sub(rf'\b{old}\b', new, block, count=1)


def build_config_file(agents_block: str, prompt_map_block: str) -> str:
    agents_block = convert_first_decl(agents_block, 'const', 'var')
    prompt_map_block = convert_first_decl(prompt_map_block, 'const', 'var')
    prompt_map_block = convert_first_decl(prompt_map_block, 'const', 'var')
    return (
        "'use strict';\n\n"
        "window.PipelineUI = window.PipelineUI || {};\n"
        "window.PipelineUIConfig = window.PipelineUIConfig || {};\n\n"
        f"{agents_block.strip()}\n\n"
        f"{prompt_map_block.strip()}\n\n"
        "Object.assign(window.PipelineUIConfig, {\n"
        "  PIPELINE_AGENTS,\n"
        "  PIPELINE_AGENTS_COLLECTION,\n"
        "  getPipelineAgents,\n"
        "  PROMPT_FILE_MAP,\n"
        "  PROMPT_FILE_MAP_COLLECTION,\n"
        "});\n"
    )


def build_shell_file(mode_state_block: str) -> str:
    block = mode_state_block
    block = re.sub(r'\blet\s+currentMode\b', 'var currentMode', block, count=1)
    block = re.sub(r'\bconst\s+state\b', 'var state', block, count=1)
    return (
        "'use strict';\n\n"
        "window.PipelineUI = window.PipelineUI || {};\n"
        "window.PipelineUIShell = window.PipelineUIShell || {};\n\n"
        f"{block.strip()}\n\n"
        "Object.assign(window.PipelineUIShell, {\n"
        "  get currentMode() { return currentMode; },\n"
        "  get state() { return state; },\n"
        "  pfx,\n"
        "  switchMode,\n"
        "});\n"
    )


def patch_html(html: str) -> str:
    config_tag = '<script src="js/ui/config_ui.js"></script>'
    shell_tag = '<script src="js/ui/shell_ui.js"></script>'
    if config_tag in html and shell_tag in html:
        return html

    candidates = [
        r'<script\s+src="js/pipeline-ui\.js"></script>',
        r'<script\s+src="pipeline-ui\.js"></script>',
    ]
    for pat in candidates:
        m = re.search(pat, html)
        if m:
            replacement = f"{config_tag}\n{shell_tag}\n{m.group(0)}"
            return html[:m.start()] + replacement + html[m.end():]

    fail("Impossible de trouver le script pipeline-ui.js dans le HTML")


def main() -> None:
    pipeline = ensure_pipeline_path()
    if not HTML.exists():
        fail("Impossible de trouver src/etsy-pipeline-dnd-v1_2.html")

    ui_dir = UI_DIR
    ui_dir.mkdir(parents=True, exist_ok=True)

    pipeline_text = read(pipeline)
    html_text = read(HTML)

    if (ui_dir / 'config_ui.js').exists() and (ui_dir / 'shell_ui.js').exists() and 'config_ui.js' in html_text and 'shell_ui.js' in html_text:
        print("Step 3 semble déjà appliqué. Rien à faire.")
        return

    backup(pipeline, '.bak_step3_shell_config')
    backup(HTML, '.bak_step3_shell_config')

    config_path = ui_dir / 'config_ui.js'
    shell_path = ui_dir / 'shell_ui.js'
    backup(config_path, '.bak_step3_shell_config')
    backup(shell_path, '.bak_step3_shell_config')

    mode_state_block = extract_once(
        pipeline_text,
        r"let\s+currentMode\s*=\s*'tabletop';.*?window\.state\s*=\s*state;\s*window\.currentMode\s*=\s*currentMode;\s*"
        'mode/state block'
    )
    agents_block = extract_once(
        pipeline_text,
        r"const\s+PIPELINE_AGENTS\s*=\s*\[.*?function\s+getPipelineAgents\s*\(\)\s*\{.*?\}\s*",
        'agents block'
    )
    prompt_map_block = extract_once(
        pipeline_text,
        r"const\s+PROMPT_FILE_MAP\s*=\s*\{.*?const\s+PROMPT_FILE_MAP_COLLECTION\s*=\s*\{.*?\};\s*",
        'prompt map block'
    )

    pipeline_text = replace_first(
        pipeline_text,
        r"let\s+currentMode\s*=\s*'tabletop';.*?window\.currentMode\s*=\s*currentMode;\s*",
        "// Extracted to src/js/ui/shell_ui.js\n",
        'remove mode/state block'
    )
    pipeline_text = replace_first(
        pipeline_text,
        r"const\s+PIPELINE_AGENTS\s*=\s*\[.*?function\s+getPipelineAgents\s*\(\)\s*\{.*?\}\s*",
        "// Extracted to src/js/ui/config_ui.js\n",
        'remove agents block'
    )
    pipeline_text = replace_first(
        pipeline_text,
        r"const\s+PROMPT_FILE_MAP\s*=\s*\{.*?const\s+PROMPT_FILE_MAP_COLLECTION\s*=\s*\{.*?\};\s*",
        "// Extracted to src/js/ui/config_ui.js\n",
        'remove prompt map block'
    )

    write(config_path, build_config_file(agents_block, prompt_map_block))
    write(shell_path, build_shell_file(mode_state_block))
    write(pipeline, pipeline_text)
    write(HTML, patch_html(html_text))

    print("Step 3 appliqué : config_ui.js + shell_ui.js")
    print(f"Pipeline patché : {pipeline}")
    print(f"HTML patché : {HTML}")
    print(f"Nouveaux fichiers : {config_path}, {shell_path}")


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
