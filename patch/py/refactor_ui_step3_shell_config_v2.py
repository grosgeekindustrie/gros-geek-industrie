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


def maybe_extract(text: str, pattern: str):
    m = re.search(pattern, text, flags=re.S)
    return m.group(0) if m else None


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
    tags = [
        '<script src="js/ui/config_ui.js"></script>',
        '<script src="js/ui/shell_ui.js"></script>',
    ]
    out = html
    if tags[0] in out and tags[1] in out:
        return out

    candidates = [
        r'<script\s+src="js/pipeline-ui\.js"></script>',
        r'<script\s+src="pipeline-ui\.js"></script>',
    ]
    for pat in candidates:
        m = re.search(pat, out)
        if m:
            replacement = "\n".join(tags + [m.group(0)])
            return out[:m.start()] + replacement + out[m.end():]

    fail("Impossible de trouver le script pipeline-ui.js dans le HTML")


MODE_STATE_PATTERN = r"let\s+currentMode\s*=\s*'tabletop';.*?window\.state\s*=\s*state;\s*window\.currentMode\s*=\s*currentMode;\s*"
AGENTS_PATTERN = r"const\s+PIPELINE_AGENTS\s*=\s*\[.*?function\s+getPipelineAgents\s*\(\)\s*\{.*?\}\s*"
PROMPT_MAP_PATTERN = r"const\s+PROMPT_FILE_MAP\s*=\s*\{.*?const\s+PROMPT_FILE_MAP_COLLECTION\s*=\s*\{.*?\};\s*"


def find_source_text(primary: str, backup_path: Path, pattern: str, label: str) -> str:
    block = maybe_extract(primary, pattern)
    if block:
        return primary
    if backup_path.exists():
        backup_text = read(backup_path)
        if maybe_extract(backup_text, pattern):
            return backup_text
    fail(f"Impossible de retrouver le bloc source pour {label} ni dans le fichier courant ni dans le backup {backup_path.name}")


def main() -> None:
    pipeline = ensure_pipeline_path()
    if not HTML.exists():
        fail("Impossible de trouver src/etsy-pipeline-dnd-v1_2.html")

    ui_dir = UI_DIR
    ui_dir.mkdir(parents=True, exist_ok=True)

    pipeline_text = read(pipeline)
    html_text = read(HTML)

    pipeline_backup = pipeline.with_name(pipeline.name + '.bak_step3_shell_config')
    html_backup = HTML.with_name(HTML.name + '.bak_step3_shell_config')
    config_path = ui_dir / 'config_ui.js'
    shell_path = ui_dir / 'shell_ui.js'

    backup(pipeline, '.bak_step3_shell_config_v2')
    backup(HTML, '.bak_step3_shell_config_v2')
    backup(config_path, '.bak_step3_shell_config_v2')
    backup(shell_path, '.bak_step3_shell_config_v2')

    source_for_mode = find_source_text(pipeline_text, pipeline_backup, MODE_STATE_PATTERN, 'mode/state')
    source_for_agents = find_source_text(pipeline_text, pipeline_backup, AGENTS_PATTERN, 'agents')
    source_for_prompt = find_source_text(pipeline_text, pipeline_backup, PROMPT_MAP_PATTERN, 'prompt maps')

    mode_state_block = extract_once(source_for_mode, MODE_STATE_PATTERN, 'mode/state block')
    agents_block = extract_once(source_for_agents, AGENTS_PATTERN, 'agents block')
    prompt_map_block = extract_once(source_for_prompt, PROMPT_MAP_PATTERN, 'prompt map block')

    if re.search(MODE_STATE_PATTERN, pipeline_text, flags=re.S):
        pipeline_text = replace_first(
            pipeline_text,
            MODE_STATE_PATTERN,
            "// Extracted to src/js/ui/shell_ui.js\n",
            'remove mode/state block'
        )
    if re.search(AGENTS_PATTERN, pipeline_text, flags=re.S):
        pipeline_text = replace_first(
            pipeline_text,
            AGENTS_PATTERN,
            "// Extracted to src/js/ui/config_ui.js\n",
            'remove agents block'
        )
    if re.search(PROMPT_MAP_PATTERN, pipeline_text, flags=re.S):
        pipeline_text = replace_first(
            pipeline_text,
            PROMPT_MAP_PATTERN,
            "// Extracted to src/js/ui/config_ui.js\n",
            'remove prompt map block'
        )

    write(config_path, build_config_file(agents_block, prompt_map_block))
    write(shell_path, build_shell_file(mode_state_block))
    write(pipeline, pipeline_text)
    write(HTML, patch_html(html_text))

    print("Step 3 v2 appliqué : réparation/écriture de config_ui.js + shell_ui.js")
    print(f"Pipeline : {pipeline}")
    print(f"HTML : {HTML}")
    print(f"Fichiers UI : {config_path}, {shell_path}")
    if pipeline_backup.exists():
        print(f"Backup source utilisé si nécessaire : {pipeline_backup}")


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
