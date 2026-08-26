from pathlib import Path
import re
import shutil

ROOT = Path.cwd()
PIPE = ROOT / 'src' / 'js' / 'pipeline-ui.js'
LIB = ROOT / 'src' / 'js' / 'ui' / 'library_ui.js'
HTML = ROOT / 'src' / 'etsy-pipeline-dnd-v1_2.html'

BACKUP_SUFFIX = '.bak_repair_ui_runtime_breakage_step3'

CACHE_MARKER = """// ═══════════════════════════════════════════════════════════
// CACHE FIXED
// ═══════════════════════════════════════════════════════════
"""

PIPE_HEADER = """'use strict';

const state = window.state;
const { pfx, switchMode } = window.PipelineUIShell;
const {
  getPipelineAgents,
  PROMPT_FILE_MAP,
  PROMPT_FILE_MAP_COLLECTION,
} = window.PipelineUIConfig;

"""

LIB_CONTENT = """(function initPipelineUILibrary(global) {
  global.PipelineUI = global.PipelineUI || {};

  const BIBLIO_MAP = {
    tags: { label: 'Tags' },
    accroches: { label: 'Accroches/CTAs' },
    objectif: { label: 'Objectif Global' },
    psycho: { label: 'Psychologie Client' },
    titres: { label: 'Titres validés / blacklist' },
    'bibliotheque-semantique': { label: 'Bibliothèque Sémantique' },
  };

  const getState = () => global.state;
  const getCurrentMode = () => global.currentMode;
  const getConfig = () => global.PipelineUIConfig || {};

  let currentBiblioTab = 'tags';
  let currentLbAgentId = null;

  function openBiblioLightbox() {
    switchBiblioTab('tags');
    document.getElementById('biblioLightbox').classList.add('visible');
  }

  function closeBiblioLightbox() {
    document.getElementById('biblioLightbox').classList.remove('visible');
  }

  function switchBiblioTab(tab) {
    currentBiblioTab = tab;
    document.querySelectorAll('.biblio-tab').forEach((b) => b.classList.remove('active'));
    document.getElementById(`btab-${tab}`).classList.add('active');
    document.getElementById('biblio-textarea').value = getState().bibliosByMode[getCurrentMode()][tab] || '';
  }

  async function saveBiblio() {
    const key = currentBiblioTab;
    const label = BIBLIO_MAP[key]?.label || key;
    const value = document.getElementById('biblio-textarea').value;
    const mode = getCurrentMode();

    try {
      const res = await fetch(`/files/biblios/${mode}/${key}.md`, { method: 'PUT', body: value });
      if (!res.ok) throw new Error((await res.json()).error);
      getState().bibliosByMode[mode][key] = value;
      closeBiblioLightbox();
      showToast(`${label} sauvegardé ✓`);
    } catch (e) {
      showToast(`Erreur: ${e.message}`, '#ff4757');
    }
  }

  async function resetBiblio() {
    const key = currentBiblioTab;
    const label = BIBLIO_MAP[key]?.label || key;
    const mode = getCurrentMode();

    try {
      const res = await fetch(`/files/biblios/${mode}/${key}.md`);
      if (!res.ok) throw new Error((await res.json()).error);
      const txt = await res.text();
      getState().bibliosByMode[mode][key] = txt;
      document.getElementById('biblio-textarea').value = txt;
      showToast(`${label} rechargé ✓`);
    } catch (e) {
      showToast(`Erreur: ${e.message}`, '#ff4757');
    }
  }

  function openPromptLightbox(id) {
    currentLbAgentId = id;
    const tagLabels = {
      tags: 'Axel · Explore Tags',
      tags_filter: 'Céline · Filter Tags',
      tags_select: 'Axel · Select Tags',
    };
    const agents = getConfig().getPipelineAgents ? getConfig().getPipelineAgents() : [];
    const label = id === 'orchestrateur'
      ? 'Orchestrateur'
      : (tagLabels[id] || agents.find((a) => a.id === id)?.title || id);

    document.getElementById('lbTitle').textContent = `⚙️ PROMPT — ${label}`;
    document.getElementById('lbTextarea').value = getState().promptsByMode[getCurrentMode()][id] || '';
    document.getElementById('promptLightbox').classList.add('visible');
  }

  function closePromptLightbox() {
    document.getElementById('promptLightbox').classList.remove('visible');
    currentLbAgentId = null;
  }

  async function saveLbPrompt() {
    if (!currentLbAgentId) return;

    const config = getConfig();
    const mode = getCurrentMode();
    const map = mode === 'collection' ? config.PROMPT_FILE_MAP_COLLECTION : config.PROMPT_FILE_MAP;
    const agentKey = currentLbAgentId === 'orchestrateur' ? (mode === 'collection' ? 'rex' : 'felix') : currentLbAgentId;
    const fname = (map and map.get(agentKey)) if False else None
  }
})(window);
"""
# Replace Python-only placeholder above with final JS safely.
LIB_CONTENT = LIB_CONTENT.replace(
    "const fname = (map and map.get(agentKey)) if False else None\n  }\n})(window);\n",
    """    const fname = (map && map[agentKey]) || agentKey;
    if (!confirm(`Écraser prompts/${mode}/${fname}.md sur le disque ?`)) return;

    const val = document.getElementById('lbTextarea').value;
    try {
      const res = await fetch(`/files/prompts/${mode}/${fname}.md`, { method: 'PUT', body: val });
      if (!res.ok) throw new Error((await res.json()).error);
      getState().promptsByMode[mode][currentLbAgentId] = val;
      closePromptLightbox();
      showToast('Prompt sauvegardé ✓');
    } catch (e) {
      showToast(`Erreur: ${e.message}`, '#ff4757');
    }
  }

  async function resetLbPrompt() {
    if (!currentLbAgentId) return;

    const config = getConfig();
    const mode = getCurrentMode();
    const map = mode === 'collection' ? config.PROMPT_FILE_MAP_COLLECTION : config.PROMPT_FILE_MAP;
    const agentKey = currentLbAgentId === 'orchestrateur' ? (mode === 'collection' ? 'rex' : 'felix') : currentLbAgentId;
    const fname = (map && map[agentKey]) || agentKey;
    if (!confirm(`Recharger prompts/${mode}/${fname}.md depuis le disque ?`)) return;

    try {
      const res = await fetch(`/files/prompts/${mode}/${fname}.md`);
      if (!res.ok) throw new Error((await res.json()).error);
      const txt = await res.text();
      getState().promptsByMode[mode][currentLbAgentId] = txt;
      document.getElementById('lbTextarea').value = txt;
      showToast('Rechargé depuis le fichier ✓');
    } catch (e) {
      showToast(`Erreur: ${e.message}`, '#ff4757');
    }
  }

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
})(window);
"""
)

SCRIPT_STACK_RE = re.compile(
    r'<script src="js/ui/index\.js"></script>[\s\S]*?<script src="pipeline-api\.js"></script>',
    re.MULTILINE,
)

SCRIPT_STACK = """<script src="js/ui/index.js"></script>
<script src="js/ui/helper_ui.js"></script>
<script src="js/ui/render_ui.js"></script>
<script src="js/ui/modals_ui.js"></script>
<script src="js/ui/tags_ui.js"></script>
<script src="js/ui/title_ui.js"></script>
<script src="js/ui/config_ui.js"></script>
<script src="js/ui/shell_ui.js"></script>
<script src="js/ui/library_ui.js"></script>
<script src="js/ui/batch_ui.js"></script>
<script src="js/pipeline-ui.js"></script>
<script src="pipeline-api.js"></script>"""


def ensure_file(path: Path):
    if not path.exists():
        raise FileNotFoundError(f'Fichier introuvable: {path}')


def backup(path: Path):
    backup_path = path.with_name(path.name + BACKUP_SUFFIX)
    if not backup_path.exists():
        shutil.copy2(path, backup_path)


def patch_pipeline_ui() -> bool:
    text = PIPE.read_text(encoding='utf-8')
    idx = text.find(CACHE_MARKER)
    if idx == -1:
        raise RuntimeError('Marker CACHE FIXED introuvable dans src/js/pipeline-ui.js')
    new_text = PIPE_HEADER + text[idx:]
    if new_text == text:
        return False
    backup(PIPE)
    PIPE.write_text(new_text, encoding='utf-8')
    return True


def patch_library_ui() -> bool:
    text = LIB.read_text(encoding='utf-8')
    if text == LIB_CONTENT:
        return False
    backup(LIB)
    LIB.write_text(LIB_CONTENT, encoding='utf-8')
    return True


def patch_html() -> bool:
    text = HTML.read_text(encoding='utf-8')
    new_text, count = SCRIPT_STACK_RE.subn(SCRIPT_STACK, text, count=1)
    if count != 1:
        raise RuntimeError('Bloc des scripts UI introuvable dans src/etsy-pipeline-dnd-v1_2.html')
    if new_text == text:
        return False
    backup(HTML)
    HTML.write_text(new_text, encoding='utf-8')
    return True


def main():
    for path in (PIPE, LIB, HTML):
        ensure_file(path)

    changed = []
    if patch_pipeline_ui():
        changed.append(str(PIPE))
    if patch_library_ui():
        changed.append(str(LIB))
    if patch_html():
        changed.append(str(HTML))

    if changed:
        print('Réparation appliquée :')
        for item in changed:
            print(f' - {item}')
        print('\nVérifie ensuite :')
        print('node --check src/js/pipeline-ui.js')
        print('for f in src/js/ui/*.js; do node --check "$f"; done')
    else:
        print('Aucun changement nécessaire.')


if __name__ == '__main__':
    main()
