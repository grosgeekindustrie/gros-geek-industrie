from pathlib import Path
import re
import shutil
from datetime import datetime

ROOT = Path('.')
SRC = ROOT / 'src'
UI_JS = SRC / 'pipeline-ui.js'
HTML = SRC / 'etsy-pipeline-dnd-v1_2.html'
UI_DIR = SRC / 'js' / 'ui'


def backup(path: Path) -> Path:
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    dest = path.with_name(path.name + f'.bak_ui_split_{stamp}')
    shutil.copy2(path, dest)
    return dest


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Pattern not found for {label}")
    return text.replace(old, new, 1)


def replace_regex_once(text: str, pattern: str, repl: str, label: str, flags: int = 0) -> str:
    new_text, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Pattern not found for {label}")
    return new_text


def replace_between(text: str, start_sig: str, end_sig: str, replacement: str, label: str) -> str:
    start = text.find(start_sig)
    if start < 0:
        raise RuntimeError(f"Start signature not found for {label}: {start_sig}")
    end = text.find(end_sig, start)
    if end < 0:
        raise RuntimeError(f"End signature not found for {label}: {end_sig}")
    return text[:start] + replacement + text[end:]


def replace_function_block(text: str, signature: str, replacement: str, label: str) -> str:
    start = text.find(signature)
    if start < 0:
        raise RuntimeError(f"Function signature not found for {label}: {signature}")
    brace_start = text.find('{', start)
    if brace_start < 0:
        raise RuntimeError(f"Opening brace not found for {label}")
    depth = 0
    i = brace_start
    in_single = False
    in_double = False
    in_template = False
    in_line_comment = False
    in_block_comment = False
    escaped = False
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ''
        if in_line_comment:
            if ch == '\n':
                in_line_comment = False
        elif in_block_comment:
            if ch == '*' and nxt == '/':
                in_block_comment = False
                i += 1
        elif in_single:
            if not escaped and ch == "'":
                in_single = False
            escaped = (ch == '\\' and not escaped)
        elif in_double:
            if not escaped and ch == '"':
                in_double = False
            escaped = (ch == '\\' and not escaped)
        elif in_template:
            if not escaped and ch == '`':
                in_template = False
            escaped = (ch == '\\' and not escaped)
        else:
            escaped = False
            if ch == '/' and nxt == '/':
                in_line_comment = True
                i += 1
            elif ch == '/' and nxt == '*':
                in_block_comment = True
                i += 1
            elif ch == "'":
                in_single = True
            elif ch == '"':
                in_double = True
            elif ch == '`':
                in_template = True
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        i += 1
    else:
        raise RuntimeError(f"Could not parse function block for {label}")

    suffix = text[end:]
    suffix = re.sub(r'^\s*\n', '\n', suffix, count=1)
    return text[:start] + replacement + suffix


INDEX_JS = r'''(function bootstrapPipelineUI(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUI.helpers = global.PipelineUI.helpers || {};
  global.PipelineUI.render = global.PipelineUI.render || {};
  global.PipelineUI.modals = global.PipelineUI.modals || {};
  global.PipelineUI.tags = global.PipelineUI.tags || {};
  global.PipelineUI.title = global.PipelineUI.title || {};
})(window);
'''

HELPER_UI = r'''(function initPipelineUIHelpers(global) {
  function normalizeTagValue(tag) {
    return String(tag || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeTitreValue(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function sameTag(a, b) {
    return normalizeTagValue(a).toLowerCase() === normalizeTagValue(b).toLowerCase();
  }

  function sameTitre(a, b) {
    return normalizeTitreValue(a).toLowerCase() === normalizeTitreValue(b).toLowerCase();
  }

  function parseBulkLibraryEntries(raw) {
    return Array.from(new Set(
      String(raw || '')
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean)
    ));
  }

  function extractLastNumberedBlock(raw) {
    const lines = String(raw || '').split('\n');
    const blocks = [];
    let current = [];

    for (const originalLine of lines) {
      const line = originalLine.trim();
      if (!line) {
        if (current.length) {
          blocks.push(current);
          current = [];
        }
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        current.push(line);
        continue;
      }

      if (current.length) {
        blocks.push(current);
        current = [];
      }
    }

    if (current.length) blocks.push(current);
    return blocks.length ? blocks[blocks.length - 1] : null;
  }

  function parseTagOutput(raw) {
    if (!raw) return [];

    const lastNumberedBlock = extractLastNumberedBlock(raw);
    const sourceLines = lastNumberedBlock || String(raw || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const cleaned = sourceLines
      .flatMap((line) => {
        if (line.includes(',') && !/^\d+\.\s/.test(line)) {
          return line.split(',').map((value) => value.trim()).filter(Boolean);
        }
        return [line];
      })
      .map((line) => line.replace(/^\d+\.\s*/, ''))
      .map((line) => line.replace(/^[-•+]\s*/, ''))
      .map((line) => line.trim())
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
    return tags.map((tag, index) => `${index + 1}. ${tag}`).join('\n');
  }

  function getBlacklistedTerm(text, blacklist) {
    const lc = String(text || '').toLowerCase();
    return (blacklist || []).find((term) => term && lc.includes(String(term).toLowerCase())) || null;
  }

  function escapeForInlineSingleQuote(text) {
    return String(text || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  global.PipelineUIHelpers = {
    normalizeTagValue,
    normalizeTitreValue,
    sameTag,
    sameTitre,
    parseBulkLibraryEntries,
    extractLastNumberedBlock,
    parseTagOutput,
    formatTagsNumbered,
    getBlacklistedTerm,
    escapeForInlineSingleQuote,
  };

  global.PipelineUI.helpers = global.PipelineUI.helpers || {};
  Object.assign(global.PipelineUI.helpers, global.PipelineUIHelpers);
})(window);
'''

RENDER_UI = r'''(function initPipelineUIRender(global) {
  function setNodeText(node, text) {
    if (!node) return;
    if ('value' in node) node.value = text;
    else node.textContent = text;
  }

  function syncSelectionField(agentId, text, modePrefix) {
    const p = modePrefix || (typeof global.pfx === 'function' ? global.pfx() : 'col');
    const directIds = [
      `${p}-out-${agentId}`,
      `${p}-raw-${agentId}`,
      `${p}-selected-${agentId}`,
      `${p}-selection-${agentId}`,
    ];

    for (const id of directIds) {
      const node = document.getElementById(id);
      if (node) {
        setNodeText(node, text);
        return node;
      }
    }

    const zone = document.getElementById(`${p}-sel-${agentId}`);
    if (!zone) return null;

    const candidate = zone.querySelector(
      '.selection-output, .sel-output, .agent-output, textarea, pre, input[type="text"]'
    );
    if (candidate) setNodeText(candidate, text);
    return candidate || null;
  }

  function syncFinalPre(key, text, modePrefix) {
    const p = modePrefix || (typeof global.pfx === 'function' ? global.pfx() : 'col');
    const contentIdMap = {
      tags: `fc-tags-${p}`,
      titre_valide: `fc-titre-${p}`,
      description_assembled: `fc-description-${p}`,
      alt: `fc-alt-${p}`,
    };
    const sectionIdMap = {
      tags: `fs-tags-${p}`,
      titre_valide: `fs-titre-${p}`,
      description_assembled: `fs-description-${p}`,
      alt: `fs-alt-${p}`,
    };

    const contentNode = document.getElementById(contentIdMap[key] || '');
    if (contentNode) contentNode.textContent = text;

    const sectionNode = document.getElementById(sectionIdMap[key] || '');
    if (sectionNode) sectionNode.style.display = text ? '' : 'none';

    const finalOutput = document.getElementById(`finalOutput-${p}`);
    if (finalOutput && text) finalOutput.style.display = '';
  }

  function collectTagsFromSelection(modePrefix) {
    const p = modePrefix || (typeof global.pfx === 'function' ? global.pfx() : 'col');
    const selectors = [
      `#${p}-sel-tags .titre-item .titre-text`,
      `#${p}-sel-tags .titre-text`,
      `#${p}-sel-list-tags .titre-item .titre-text`,
      `#${p}-sel-list-tags .titre-text`,
    ];

    for (const selector of selectors) {
      const nodes = [...document.querySelectorAll(selector)]
        .map((node) => node.textContent.trim())
        .filter(Boolean);
      if (nodes.length) return nodes;
    }
    return [];
  }

  function syncTagsOutputFromUI() {
    const helpers = global.PipelineUIHelpers || {};
    const p = typeof global.pfx === 'function' ? global.pfx() : 'col';
    const tags = collectTagsFromSelection(p)
      .map((tag) => (helpers.normalizeTagValue ? helpers.normalizeTagValue(tag) : String(tag || '').trim()))
      .filter(Boolean);

    if (!tags.length) return '';

    const deduped = [];
    const seen = new Set();
    for (const tag of tags) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(tag);
    }

    const normalized = helpers.formatTagsNumbered
      ? helpers.formatTagsNumbered(deduped)
      : deduped.map((tag, index) => `${index + 1}. ${tag}`).join('\n');

    if (global.state?.outputs) {
      global.state.outputs.tags = normalized;
    }

    syncSelectionField('tags', normalized, p);
    syncFinalPre('tags', normalized, p);
    return normalized;
  }

  global.PipelineUIRender = {
    syncSelectionField,
    syncFinalPre,
    syncTagsOutputFromUI,
  };

  global.PipelineUI.render = global.PipelineUI.render || {};
  Object.assign(global.PipelineUI.render, global.PipelineUIRender);
})(window);
'''

MODALS_UI = r'''(function initPipelineUIModals(global) {
  const helpers = () => global.PipelineUIHelpers || {};

  function ensureLibraryModals() {
    if (document.getElementById('libraryBlacklistModal')) return;

    const host = document.createElement('div');
    host.innerHTML = `
<div id="libraryBlacklistModal" class="library-modal">
  <div class="library-modal-card" role="dialog" aria-modal="true" aria-labelledby="libraryBlacklistModalTitle">
    <h3 id="libraryBlacklistModalTitle" class="library-modal-title">Blacklister</h3>
    <div class="library-modal-subtitle">Élément actuel</div>
    <div id="libraryBlacklistCurrent" class="library-modal-current"></div>
    <textarea
      id="libraryBlacklistTextarea"
      class="library-modal-textarea"
      placeholder="Valeur à blacklister. Tu peux en mettre plusieurs séparées par des virgules."
    ></textarea>
    <div class="library-modal-hint">
      Si le champ est vide, le tag ou le titre du bouton sera blacklisté.<br>
      Tu peux saisir un segment, le texte complet, ou plusieurs entrées séparées par des virgules.
    </div>
    <div id="libraryBlacklistFeedback" class="library-modal-feedback"></div>
    <div class="library-modal-actions">
      <button type="button" class="library-modal-btn" onclick="closeLibraryBlacklistModal()">Annuler</button>
      <button type="button" class="library-modal-btn primary" onclick="confirmLibraryBlacklistModal()">OK</button>
    </div>
  </div>
</div>
<div id="libraryValidatedModal" class="library-modal">
  <div class="library-modal-card" role="dialog" aria-modal="true" aria-labelledby="libraryValidatedModalTitle">
    <h3 id="libraryValidatedModalTitle" class="library-modal-title">Ajouter aux validés</h3>
    <div class="library-modal-subtitle">Ajout manuel</div>
    <div class="library-modal-current">
      Saisis une ou plusieurs valeurs séparées par des virgules.
    </div>
    <textarea
      id="libraryValidatedTextarea"
      class="library-modal-textarea"
      placeholder="Ex: figurine résine à peindre, garage kit anime"
    ></textarea>
    <div class="library-modal-hint">
      Si le champ est vide et que tu cliques sur OK, rien ne se passe.
    </div>
    <div id="libraryValidatedFeedback" class="library-modal-feedback"></div>
    <div class="library-modal-actions">
      <button type="button" class="library-modal-btn" onclick="closeLibraryValidatedModal()">Annuler</button>
      <button type="button" class="library-modal-btn primary" onclick="confirmLibraryValidatedModal()">OK</button>
    </div>
  </div>
</div>
`;

    document.body.appendChild(host);

    document.getElementById('libraryBlacklistModal').addEventListener('click', (event) => {
      if (event.target.id === 'libraryBlacklistModal') closeLibraryBlacklistModal();
    });
    document.getElementById('libraryValidatedModal').addEventListener('click', (event) => {
      if (event.target.id === 'libraryValidatedModal') closeLibraryValidatedModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      closeLibraryBlacklistModal();
      closeLibraryValidatedModal();
    });
  }

  function setLibraryModalFeedback(modalType, text = '', tone = '') {
    const id = modalType === 'blacklist' ? 'libraryBlacklistFeedback' : 'libraryValidatedFeedback';
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = text;
    node.className = `library-modal-feedback${tone ? ` ${tone}` : ''}`;
  }

  function openLibraryBlacklistModal({ kind, currentValue, itemId = null, source = 'main', agentId = 'titre' }) {
    ensureLibraryModals();
    global.__libraryBlacklistState = {
      kind,
      currentValue: String(currentValue || '').trim(),
      itemId,
      source,
      agentId,
    };

    const modal = document.getElementById('libraryBlacklistModal');
    const title = document.getElementById('libraryBlacklistModalTitle');
    const current = document.getElementById('libraryBlacklistCurrent');
    const textarea = document.getElementById('libraryBlacklistTextarea');

    title.textContent = kind === 'tags' ? 'Blacklister des tags' : 'Blacklister des titres';
    current.textContent = global.__libraryBlacklistState.currentValue || '—';
    textarea.value = global.__libraryBlacklistState.currentValue || '';
    setLibraryModalFeedback('blacklist', '');
    modal.classList.add('visible');

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
    }, 0);
  }

  function closeLibraryBlacklistModal() {
    const modal = document.getElementById('libraryBlacklistModal');
    if (modal) modal.classList.remove('visible');
    global.__libraryBlacklistState = null;
  }

  function openLibraryValidatedModal({ kind, source = 'main', agentId = 'titre' }) {
    ensureLibraryModals();
    global.__libraryValidatedState = { kind, source, agentId };

    const modal = document.getElementById('libraryValidatedModal');
    const title = document.getElementById('libraryValidatedModalTitle');
    const textarea = document.getElementById('libraryValidatedTextarea');

    title.textContent = kind === 'tags' ? 'Ajouter des tags validés' : 'Ajouter des titres validés';
    textarea.value = '';
    setLibraryModalFeedback('validated', '');
    modal.classList.add('visible');

    setTimeout(() => textarea.focus(), 0);
  }

  function closeLibraryValidatedModal() {
    const modal = document.getElementById('libraryValidatedModal');
    if (modal) modal.classList.remove('visible');
    global.__libraryValidatedState = null;
  }

  async function saveTagsLibrary(validated, blacklisted) {
    const updated = global.buildBiblioTagsRaw(validated, blacklisted);
    const response = await fetch(`/files/biblios/${global.currentMode}/tags.md`, {
      method: 'PUT',
      body: updated,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    global.state.bibliosByMode[global.currentMode].tags = updated;
  }

  async function saveTitresLibrary(validated, blacklisted) {
    const updated = global.buildBiblioTitresRaw(validated, blacklisted);
    const response = await fetch(`/files/biblios/${global.currentMode}/titres.md`, {
      method: 'PUT',
      body: updated,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    global.state.bibliosByMode[global.currentMode].titres = updated;
  }

  async function confirmLibraryBlacklistModal() {
    const state = global.__libraryBlacklistState;
    if (!state) return;

    const textarea = document.getElementById('libraryBlacklistTextarea');
    const rawEntries = helpers().parseBulkLibraryEntries(textarea?.value || '');
    const fallback = state.currentValue ? [state.currentValue] : [];
    const entries = rawEntries.length ? rawEntries : fallback;

    if (!entries.length) {
      closeLibraryBlacklistModal();
      return;
    }

    try {
      if (state.kind === 'tags') {
        const { validated, blacklisted } = global.parseBiblioTags(global.getBiblio('tags'));
        const added = [];

        for (const entry of entries.map(helpers().normalizeTagValue)) {
          if (!entry) continue;
          if (blacklisted.some((value) => helpers().sameTag(value, entry))) continue;
          blacklisted.push(entry);
          added.push(entry);
        }

        if (added.length) {
          await saveTagsLibrary(validated, blacklisted);
        }

        if (state.itemId) {
          const item = document.getElementById(state.itemId);
          if (item) {
            item.classList.remove('validated');
            item.classList.add('invalidated');
            setTimeout(() => global.autoRegenTag(state.currentValue, added[0] || state.currentValue, item), 0);
          }
        }

        global.showToast(
          added.length ? ` ${added.length} tag(s) blacklisté(s)` : 'Déjà blacklisté',
          added.length ? undefined : '#7eb8f7'
        );
      } else {
        const { validated, blacklisted } = global.parseBiblioTitres(global.getBiblio('titres'));
        const added = [];

        for (const entry of entries.map(helpers().normalizeTitreValue)) {
          if (!entry) continue;
          if (blacklisted.some((value) => helpers().sameTitre(value, entry))) continue;
          blacklisted.push(entry);
          added.push(entry);
        }

        if (added.length) {
          await saveTitresLibrary(validated, blacklisted);
        }

        if (state.itemId) {
          const item = document.getElementById(state.itemId);
          if (item) {
            item.classList.remove('validated');
            item.classList.add('invalidated');
            setTimeout(() => global.autoRegenTitre(state.currentValue, added[0] || state.currentValue, item, state.agentId || 'titre'), 0);
          }
        }

        global.showToast(
          added.length ? ` ${added.length} titre(s) blacklisté(s)` : 'Déjà blacklisté',
          added.length ? undefined : '#7eb8f7'
        );
      }

      closeLibraryBlacklistModal();
    } catch (error) {
      setLibraryModalFeedback('blacklist', 'Erreur de sauvegarde', 'error');
    }
  }

  async function confirmLibraryValidatedModal() {
    const state = global.__libraryValidatedState;
    if (!state) return;

    const textarea = document.getElementById('libraryValidatedTextarea');
    const entries = helpers().parseBulkLibraryEntries(textarea?.value || '');
    if (!entries.length) {
      closeLibraryValidatedModal();
      return;
    }

    try {
      if (state.kind === 'tags') {
        const { validated, blacklisted } = global.parseBiblioTags(global.getBiblio('tags'));
        const accepted = [];
        for (const raw of entries) {
          const value = helpers().normalizeTagValue(raw);
          if (!value) continue;
          if (validated.some((entry) => helpers().sameTag(entry, value))) continue;
          if (accepted.some((entry) => helpers().sameTag(entry, value))) continue;
          accepted.push(value);
        }
        if (accepted.length) {
          await saveTagsLibrary([...validated, ...accepted], blacklisted);
        }
        global.showToast(`✅ ${accepted.length} tag(s) validé(s) ajouté(s)`);
      } else {
        const { validated, blacklisted } = global.parseBiblioTitres(global.getBiblio('titres'));
        const accepted = [];
        for (const raw of entries) {
          const value = helpers().normalizeTitreValue(raw);
          if (!value) continue;
          if (validated.some((entry) => helpers().sameTitre(entry, value))) continue;
          if (accepted.some((entry) => helpers().sameTitre(entry, value))) continue;
          accepted.push(value);
        }
        if (accepted.length) {
          await saveTitresLibrary([...validated, ...accepted], blacklisted);
        }
        global.showToast(`✅ ${accepted.length} titre(s) validé(s) ajouté(s)`);
      }

      closeLibraryValidatedModal();
    } catch (error) {
      setLibraryModalFeedback('validated', 'Erreur de sauvegarde', 'error');
    }
  }

  function ensureZoneLibraryActionButton(zoneEl, buttonId, label, onClick) {
    if (!zoneEl) return;

    let bar = zoneEl.querySelector('.library-actions-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'library-actions-bar';
      zoneEl.prepend(bar);
    }

    let button = document.getElementById(buttonId);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = buttonId;
      button.className = 'library-action-btn';
      bar.appendChild(button);
    }

    button.textContent = label;
    button.onclick = onClick;
  }

  function ensureTagsManualAddButton() {
    const zone = document.getElementById(`${global.pfx()}-sel-tags`);
    ensureZoneLibraryActionButton(
      zone,
      `${global.pfx()}-manual-valid-tags`,
      '➕ Ajouter des tags validés',
      () => openLibraryValidatedModal({ kind: 'tags', source: 'main' })
    );
  }

  function ensureTitresManualAddButton(agentId) {
    const zone = document.getElementById(`${global.pfx()}-sel-${agentId}`);
    ensureZoneLibraryActionButton(
      zone,
      `${global.pfx()}-manual-valid-${agentId}`,
      '➕ Ajouter des titres validés',
      () => openLibraryValidatedModal({ kind: 'titres', source: 'main', agentId })
    );
  }

  function ensureExplorerManualAddButton(kind, agentId = 'titre') {
    const label = document.getElementById('explorerListLabel');
    if (!label) return;

    let bar = document.getElementById('explorerLibraryActions');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'explorerLibraryActions';
      bar.className = 'explorer-library-actions';
      label.insertAdjacentElement('afterend', bar);
    }

    let button = document.getElementById('explorerManualValidBtn');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'explorerManualValidBtn';
      button.className = 'library-action-btn';
      bar.appendChild(button);
    }

    button.textContent = kind === 'tags'
      ? '➕ Ajouter des tags validés'
      : '➕ Ajouter des titres validés';
    button.onclick = () => openLibraryValidatedModal({ kind, source: 'explorer', agentId });
  }

  global.PipelineUIModals = {
    ensureLibraryModals,
    setLibraryModalFeedback,
    openLibraryBlacklistModal,
    closeLibraryBlacklistModal,
    openLibraryValidatedModal,
    closeLibraryValidatedModal,
    confirmLibraryBlacklistModal,
    confirmLibraryValidatedModal,
    saveTagsLibrary,
    saveTitresLibrary,
    ensureZoneLibraryActionButton,
    ensureTagsManualAddButton,
    ensureTitresManualAddButton,
    ensureExplorerManualAddButton,
  };

  global.PipelineUI.modals = global.PipelineUI.modals || {};
  Object.assign(global.PipelineUI.modals, global.PipelineUIModals);
})(window);
'''

TAGS_UI = r'''(function initPipelineUITags(global) {
  const helpers = () => global.PipelineUIHelpers || {};
  const render = () => global.PipelineUIRender || {};

  async function autoRegenTag(tag, matchedTerm, itemEl) {
    if (itemEl.classList.contains('regen-pending')) return;

    itemEl.classList.add('regen-pending');
    const textSpan = itemEl.querySelector('.titre-text');
    const lenSpan = itemEl.querySelector('.titre-char');
    const originalText = textSpan.textContent;
    textSpan.textContent = '⟳ remplacement…';

    try {
      const ctx = global.buildCtx('tags');
      const prompt = global.buildPrompt('tags_select', ctx);
      const regenPrompt = {
        filled: `${prompt.filled}\n\n---\nMODE REMPLACEMENT UNIQUE:\nLe tag "${tag}" contient le terme blacklisté "${matchedTerm}". Génère UN SEUL tag de remplacement. Max 30 caractères, français, naturel, ancré au produit.\nFormat: juste le tag, sans numérotation, sans ponctuation finale.`,
        fixedContent: prompt.fixedContent,
      };

      const { text: result } = await global.callClaude('tags', regenPrompt, false, 2);
      const newTag = result
        .trim()
        .replace(/^\d+\.\s*/, '')
        .replace(/^[-+•]\s*/, '')
        .split('\n')[0]
        .trim();

      const { blacklisted } = global.parseBiblioTags(global.getBiblio('tags'));
      const stillBad = helpers().getBlacklistedTerm(newTag, blacklisted);

      textSpan.textContent = newTag;
      if (lenSpan) {
        lenSpan.textContent = newTag.length;
        lenSpan.style.color = newTag.length > 30 ? 'var(--error)' : 'var(--success)';
      }

      const safe = helpers().escapeForInlineSingleQuote(newTag);
      const itemId = itemEl.id;
      const buttons = itemEl.querySelectorAll('.titre-thumb');
      if (buttons[0]) buttons[0].setAttribute('onclick', `event.stopPropagation();validateTag('${safe}')`);
      if (buttons[1]) buttons[1].setAttribute('onclick', `event.stopPropagation();invalidateTag('${safe}','${itemId}')`);
      if (buttons[2]) buttons[2].setAttribute('onclick', `event.stopPropagation();rerollTag('${safe}','${itemId}')`);

      itemEl.classList.remove('regen-pending');
      render().syncTagsOutputFromUI?.();

      if (stillBad) {
        autoRegenTag(newTag, stillBad, itemEl);
      } else {
        global.showToast(`♻️ Tag remplacé : "${newTag}"`, '#7eb8f7');
      }
    } catch (error) {
      itemEl.classList.remove('regen-pending');
      textSpan.textContent = originalText;
      global.showToast('Erreur remplacement tag', '#ff4757');
    }
  }

  function rerollTag(tag, itemId) {
    const itemEl = document.getElementById(itemId);
    if (!itemEl) return;
    autoRegenTag(tag, 'remplacement manuel', itemEl);
  }

  global.PipelineUITags = { autoRegenTag, rerollTag };
  global.PipelineUI.tags = global.PipelineUI.tags || {};
  Object.assign(global.PipelineUI.tags, global.PipelineUITags);
})(window);
'''

TITLE_UI = r'''(function initPipelineUITitle(global) {
  const helpers = () => global.PipelineUIHelpers || {};

  async function autoRegenTitre(text, matchedTerm, itemEl, agentId) {
    if (itemEl.classList.contains('regen-pending')) return;

    itemEl.classList.add('regen-pending');
    const textSpan = itemEl.querySelector('.titre-text');
    const charSpan = itemEl.querySelector('.titre-char');
    const originalText = textSpan.textContent;
    textSpan.textContent = '⟳ remplacement…';

    try {
      const ctx = global.buildCtx('titre');
      const prompt = global.buildPrompt('titre', ctx);
      const regenPrompt = {
        filled: `${prompt.filled}\n\n---\nMODE REMPLACEMENT UNIQUE:\nLe titre "${text}" contient un terme blacklisté ("${matchedTerm}"). Génère UN SEUL titre de remplacement. Idéalement 128-140 caractères, naturel, SEO Etsy.\nFormat: juste le titre, sans numérotation, sans compteur de caractères.`,
        fixedContent: prompt.fixedContent,
      };

      const { text: result } = await global.callClaude('titre', regenPrompt, false, 2);
      const newTitre = result
        .trim()
        .replace(/^\d+\.\s*/, '')
        .replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '')
        .split('\n')[0]
        .trim();

      const { blacklisted } = global.parseBiblioTitres(global.getBiblio('titres'));
      const stillBad = helpers().getBlacklistedTerm(newTitre, blacklisted);

      textSpan.textContent = newTitre;
      const chars = newTitre.length;
      const charColor = chars > 140
        ? 'var(--error)'
        : chars >= 128
          ? 'var(--success)'
          : chars >= 110
            ? 'var(--accent)'
            : 'var(--muted)';
      if (charSpan) {
        charSpan.textContent = chars;
        charSpan.style.color = charColor;
      }

      const safe = helpers().escapeForInlineSingleQuote(newTitre);
      const itemId = itemEl.id;
      const buttons = itemEl.querySelectorAll('.titre-thumb');
      if (buttons[0]) buttons[0].setAttribute('onclick', `event.stopPropagation();validateTitreSegment('${safe}','valid')`);
      if (buttons[1]) buttons[1].setAttribute('onclick', `event.stopPropagation();invalidateTitreSegment('${safe}','${itemId}','${agentId}')`);

      itemEl.classList.remove('regen-pending');
      if (stillBad) {
        autoRegenTitre(newTitre, stillBad, itemEl, agentId);
      } else {
        global.showToast('♻️ Titre remplacé', '#7eb8f7');
      }
    } catch (error) {
      itemEl.classList.remove('regen-pending');
      textSpan.textContent = originalText;
      global.showToast('Erreur remplacement titre', '#ff4757');
    }
  }

  global.PipelineUITitles = { autoRegenTitre };
  global.PipelineUI.title = global.PipelineUI.title || {};
  Object.assign(global.PipelineUI.title, global.PipelineUITitles);
})(window);
'''


def patch_html(text: str) -> str:
    pattern = r'<script src="pipeline-ui\.js"></script>\s*\n\s*<script src="pipeline-api\.js"></script>'
    new = '\n'.join([
        '<script src="js/ui/index.js"></script>',
        '<script src="js/ui/helper_ui.js"></script>',
        '<script src="js/ui/render_ui.js"></script>',
        '<script src="js/ui/modals_ui.js"></script>',
        '<script src="js/ui/tags_ui.js"></script>',
        '<script src="js/ui/title_ui.js"></script>',
        '<script src="pipeline-ui.js"></script>',
        '<script src="pipeline-api.js"></script>',
    ])
    return replace_regex_once(text, pattern, new, 'html script stack', flags=re.MULTILINE)


ALIAS_BLOCK = r'''
const {
  extractLastNumberedBlock,
  parseTagOutput,
  formatTagsNumbered,
  normalizeTagValue,
  normalizeTitreValue,
  sameTag,
  sameTitre,
  parseBulkLibraryEntries,
  getBlacklistedTerm,
} = window.PipelineUIHelpers;

const {
  syncSelectionField,
  syncFinalPre,
  syncTagsOutputFromUI,
} = window.PipelineUIRender;

const {
  ensureLibraryModals,
  setLibraryModalFeedback,
  openLibraryBlacklistModal,
  closeLibraryBlacklistModal,
  openLibraryValidatedModal,
  closeLibraryValidatedModal,
  confirmLibraryBlacklistModal,
  confirmLibraryValidatedModal,
  ensureZoneLibraryActionButton,
  ensureTagsManualAddButton,
  ensureTitresManualAddButton,
  ensureExplorerManualAddButton,
} = window.PipelineUIModals;

const { autoRegenTag, rerollTag } = window.PipelineUITags;
const { autoRegenTitre } = window.PipelineUITitles;

'''


def patch_pipeline_ui(text: str) -> str:
    text = replace_regex_once(
        text,
        r'(^const CACHE_FIXED = \{)',
        ALIAS_BLOCK + '\n\\1',
        'ui alias injection',
        flags=re.MULTILINE
    )

    text = replace_between(
        text,
        'function extractLastNumberedTagBlock(raw) {',
        'async function runTagsThreeAgents(ctx) {',
        '// Extracted to src/js/ui/helper_ui.js\n\n',
        'parse/tag helpers extraction'
    )

    text = replace_between(
        text,
        'function normalizeTagValue(tag) {',
        'function ensureLibraryModals() {',
        '// Extracted to src/js/ui/helper_ui.js\n\n',
        'normalize helpers extraction'
    )

    text = replace_between(
        text,
        'function ensureLibraryModals() {',
        'function getBlacklistedTerm(text, blacklist) {',
        '// Extracted to src/js/ui/modals_ui.js\n\n',
        'modal extraction'
    )

    text = replace_between(
        text,
        'function getBlacklistedTerm(text, blacklist) {',
        'function getBiblioTagsFormatted() {',
        '// Extracted to src/js/ui/tags_ui.js and src/js/ui/title_ui.js\n\n',
        'tags/title regen extraction'
    )

    text = replace_function_block(
        text,
        'function syncTagsOutputFromUI()',
        '// Extracted to src/js/ui/render_ui.js\n',
        'syncTagsOutputFromUI extraction'
    )

    return text


def main() -> None:
    if not UI_JS.exists():
        raise SystemExit(f'Missing file: {UI_JS}')
    if not HTML.exists():
        raise SystemExit(f'Missing file: {HTML}')

    ui_backup = backup(UI_JS)
    html_backup = backup(HTML)

    ui_text = UI_JS.read_text(encoding='utf-8')
    html_text = HTML.read_text(encoding='utf-8')

    UI_DIR.mkdir(parents=True, exist_ok=True)
    (UI_DIR / 'index.js').write_text(INDEX_JS, encoding='utf-8')
    (UI_DIR / 'helper_ui.js').write_text(HELPER_UI, encoding='utf-8')
    (UI_DIR / 'render_ui.js').write_text(RENDER_UI, encoding='utf-8')
    (UI_DIR / 'modals_ui.js').write_text(MODALS_UI, encoding='utf-8')
    (UI_DIR / 'tags_ui.js').write_text(TAGS_UI, encoding='utf-8')
    (UI_DIR / 'title_ui.js').write_text(TITLE_UI, encoding='utf-8')

    UI_JS.write_text(patch_pipeline_ui(ui_text), encoding='utf-8')
    HTML.write_text(patch_html(html_text), encoding='utf-8')

    print('UI split refactor applied.')
    print(f'Backup UI   : {ui_backup}')
    print(f'Backup HTML : {html_backup}')
    print('Created files:')
    for path in [
        UI_DIR / 'index.js',
        UI_DIR / 'helper_ui.js',
        UI_DIR / 'render_ui.js',
        UI_DIR / 'modals_ui.js',
        UI_DIR / 'tags_ui.js',
        UI_DIR / 'title_ui.js',
    ]:
        print(f' - {path}')


if __name__ == '__main__':
    main()
