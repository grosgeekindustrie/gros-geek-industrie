#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys

ROOT = Path.cwd()
UI_PATH = ROOT / 'src' / 'pipeline-ui.js'
CSS_PATH = ROOT / 'src' / 'pipeline.css'

if not UI_PATH.exists() or not CSS_PATH.exists():
    print('Erreur: lance ce script depuis la racine du projet (src/pipeline-ui.js introuvable).')
    sys.exit(1)

ui = UI_PATH.read_text(encoding='utf-8')
css = CSS_PATH.read_text(encoding='utf-8')

if 'libraryBlacklistModal' in ui:
    print('Patch déjà présent dans src/pipeline-ui.js')
    sys.exit(0)

shutil.copy2(UI_PATH, UI_PATH.with_suffix('.js.bak'))
shutil.copy2(CSS_PATH, CSS_PATH.with_suffix('.css.bak'))

def replace_between(text: str, start_pat: str, end_pat: str, replacement: str) -> str:
    start = text.find(start_pat)
    if start == -1:
        raise ValueError(f'Début introuvable: {start_pat[:80]}')
    end = text.find(end_pat, start)
    if end == -1:
        raise ValueError(f'Fin introuvable après {start_pat[:80]}: {end_pat[:80]}')
    return text[:start] + replacement + text[end:]

def insert_after(text: str, marker: str, insertion: str) -> str:
    idx = text.find(marker)
    if idx == -1:
        raise ValueError(f'Marqueur introuvable: {marker[:80]}')
    idx += len(marker)
    return text[:idx] + insertion + text[idx:]

modal_helpers = r'''
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
      .map(s => s.trim())
      .filter(Boolean)
  ));
}

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

  document.getElementById('libraryBlacklistModal').addEventListener('click', (e) => {
    if (e.target.id === 'libraryBlacklistModal') closeLibraryBlacklistModal();
  });

  document.getElementById('libraryValidatedModal').addEventListener('click', (e) => {
    if (e.target.id === 'libraryValidatedModal') closeLibraryValidatedModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeLibraryBlacklistModal();
    closeLibraryValidatedModal();
  });
}

function setLibraryModalFeedback(modalType, text = '', tone = '') {
  const id = modalType === 'blacklist' ? 'libraryBlacklistFeedback' : 'libraryValidatedFeedback';
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `library-modal-feedback${tone ? ' ' + tone : ''}`;
}

function openLibraryBlacklistModal({ kind, currentValue, itemId = null, source = 'main', agentId = 'titre' }) {
  ensureLibraryModals();

  window.__libraryBlacklistState = {
    kind,
    currentValue: String(currentValue || '').trim(),
    itemId,
    source,
    agentId
  };

  const modal = document.getElementById('libraryBlacklistModal');
  const title = document.getElementById('libraryBlacklistModalTitle');
  const current = document.getElementById('libraryBlacklistCurrent');
  const textarea = document.getElementById('libraryBlacklistTextarea');

  title.textContent = kind === 'tags' ? 'Blacklister des tags' : 'Blacklister des titres';
  current.textContent = window.__libraryBlacklistState.currentValue || '—';
  textarea.value = window.__libraryBlacklistState.currentValue || '';
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
  window.__libraryBlacklistState = null;
}

function openLibraryValidatedModal({ kind, source = 'main', agentId = 'titre' }) {
  ensureLibraryModals();

  window.__libraryValidatedState = {
    kind,
    source,
    agentId
  };

  const modal = document.getElementById('libraryValidatedModal');
  const title = document.getElementById('libraryValidatedModalTitle');
  const textarea = document.getElementById('libraryValidatedTextarea');

  title.textContent = kind === 'tags' ? 'Ajouter des tags validés' : 'Ajouter des titres validés';
  textarea.value = '';
  setLibraryModalFeedback('validated', '');

  modal.classList.add('visible');

  setTimeout(() => {
    textarea.focus();
  }, 0);
}

function closeLibraryValidatedModal() {
  const modal = document.getElementById('libraryValidatedModal');
  if (modal) modal.classList.remove('visible');
  window.__libraryValidatedState = null;
}

async function saveTagsLibrary(validated, blacklisted) {
  const updated = buildBiblioTagsRaw(validated, blacklisted);
  const res = await fetch(`/files/biblios/${currentMode}/tags.md`, { method: 'PUT', body: updated });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  state.bibliosByMode[currentMode]['tags'] = updated;
}

async function saveTitresLibrary(validated, blacklisted) {
  const updated = buildBiblioTitresRaw(validated, blacklisted);
  const res = await fetch(`/files/biblios/${currentMode}/titres.md`, { method: 'PUT', body: updated });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  state.bibliosByMode[currentMode]['titres'] = updated;
}

async function confirmLibraryBlacklistModal() {
  const s = window.__libraryBlacklistState;
  if (!s) return;

  const textarea = document.getElementById('libraryBlacklistTextarea');
  const rawEntries = parseBulkLibraryEntries(textarea?.value || '');
  const fallback = s.currentValue ? [s.currentValue] : [];
  const entries = rawEntries.length ? rawEntries : fallback;

  if (!entries.length) {
    closeLibraryBlacklistModal();
    return;
  }

  try {
    if (s.kind === 'tags') {
      const { validated, blacklisted } = parseBiblioTags(getBiblio('tags'));
      const added = [];

      for (const entry of entries.map(normalizeTagValue)) {
        if (!entry) continue;
        if (blacklisted.some(v => sameTag(v, entry))) continue;
        blacklisted.push(entry);
        added.push(entry);
      }

      if (added.length) {
        await saveTagsLibrary(validated, blacklisted);
      }

      if (s.itemId) {
        const el = document.getElementById(s.itemId);
        if (el) {
          el.classList.remove('validated');
          el.classList.add('invalidated');
          setTimeout(() => autoRegenTag(s.currentValue, added[0] || s.currentValue, el), 0);
        }
      }

      showToast(
        added.length ? `👎 ${added.length} tag(s) blacklisté(s)` : 'Déjà blacklisté',
        added.length ? undefined : '#7eb8f7'
      );
    } else {
      const { validated, blacklisted } = parseBiblioTitres(getBiblio('titres'));
      const added = [];

      for (const entry of entries.map(normalizeTitreValue)) {
        if (!entry) continue;
        if (blacklisted.some(v => sameTitre(v, entry))) continue;
        blacklisted.push(entry);
        added.push(entry);
      }

      if (added.length) {
        await saveTitresLibrary(validated, blacklisted);
      }

      if (s.itemId) {
        const el = document.getElementById(s.itemId);
        if (el) {
          el.classList.remove('validated');
          el.classList.add('invalidated');
          setTimeout(() => autoRegenTitre(s.currentValue, added[0] || s.currentValue, el, s.agentId || 'titre'), 0);
        }
      }

      showToast(
        added.length ? `👎 ${added.length} titre(s) blacklisté(s)` : 'Déjà blacklisté',
        added.length ? undefined : '#7eb8f7'
      );
    }

    closeLibraryBlacklistModal();
  } catch (e) {
    setLibraryModalFeedback('blacklist', 'Erreur de sauvegarde', 'error');
  }
}

async function confirmLibraryValidatedModal() {
  const s = window.__libraryValidatedState;
  if (!s) return;

  const textarea = document.getElementById('libraryValidatedTextarea');
  const entries = parseBulkLibraryEntries(textarea?.value || '');

  if (!entries.length) {
    closeLibraryValidatedModal();
    return;
  }

  try {
    if (s.kind === 'tags') {
      const { validated, blacklisted } = parseBiblioTags(getBiblio('tags'));
      const accepted = [];

      for (const raw of entries) {
        const value = normalizeTagValue(raw);
        if (!value) continue;
        if (validated.some(v => sameTag(v, value)) || accepted.some(v => sameTag(v, value))) continue;
        accepted.push(value);
      }

      if (accepted.length) {
        await saveTagsLibrary([...validated, ...accepted], blacklisted);
      }

      showToast(`✅ ${accepted.length} tag(s) validé(s) ajouté(s)`);
    } else {
      const { validated, blacklisted } = parseBiblioTitres(getBiblio('titres'));
      const accepted = [];

      for (const raw of entries) {
        const value = normalizeTitreValue(raw);
        if (!value) continue;
        if (validated.some(v => sameTitre(v, value)) || accepted.some(v => sameTitre(v, value))) continue;
        accepted.push(value);
      }

      if (accepted.length) {
        await saveTitresLibrary([...validated, ...accepted], blacklisted);
      }

      showToast(`✅ ${accepted.length} titre(s) validé(s) ajouté(s)`);
    }

    closeLibraryValidatedModal();
  } catch (e) {
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

  let btn = document.getElementById(buttonId);
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = buttonId;
    btn.className = 'library-action-btn';
    bar.appendChild(btn);
  }

  btn.textContent = label;
  btn.onclick = onClick;
}

function ensureTagsManualAddButton() {
  const zone = document.getElementById(`${pfx()}-sel-tags`);
  ensureZoneLibraryActionButton(
    zone,
    `${pfx()}-manual-valid-tags`,
    '➕ Ajouter des tags validés',
    () => openLibraryValidatedModal({ kind: 'tags', source: 'main' })
  );
}

function ensureTitresManualAddButton(agentId) {
  const zone = document.getElementById(`${pfx()}-sel-${agentId}`);
  ensureZoneLibraryActionButton(
    zone,
    `${pfx()}-manual-valid-${agentId}`,
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

  let btn = document.getElementById('explorerManualValidBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'explorerManualValidBtn';
    btn.className = 'library-action-btn';
    bar.appendChild(btn);
  }

  btn.textContent = kind === 'tags'
    ? '➕ Ajouter des tags validés'
    : '➕ Ajouter des titres validés';

  btn.onclick = () => openLibraryValidatedModal({
    kind,
    source: 'explorer',
    agentId
  });
}
'''

build_tags_ui = r'''function buildTagsUI(output) {
  const p = pfx();
  let tags = [];
  const numbered = output.match(/^\d+\.\s+(.+)$/mg);
  if (numbered) tags = numbered.map(l => l.replace(/^\d+\.\s+/, '').trim());
  else tags = output.split(',').map(t => t.trim()).filter(Boolean);
  if (!tags.length) return;
  const zone = document.getElementById(`${p}-sel-tags`);
  const list = document.getElementById(`${p}-sel-list-tags`);
  if (!zone || !list) return;
  zone.style.display = 'block';
  ensureLibraryModals();
  ensureTagsManualAddButton();
  list.innerHTML = tags.map((tag, i) => {
    const safe = tag.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const len = tag.length;
    const lenColor = len > 30 ? 'var(--error)' : 'var(--success)';
    return `<div class="titre-item" id="tag-item-${i}">
      <span class="titre-text">${tag}</span>
      <span class="titre-char" style="color:${lenColor};">${len}</span>
      <div class="titre-actions">
        <button class="titre-thumb" onclick="event.stopPropagation();validateTag('${safe}')">👍</button>
        <button class="titre-thumb" onclick="event.stopPropagation();invalidateTag('${safe}','tag-item-${i}','main')">👎</button>
        <button class="titre-thumb" onclick="event.stopPropagation();rerollTag('${safe}','tag-item-${i}')">🔄</button>
      </div></div>`;
  }).join('');
  // Auto-check blacklist après génération
  const { blacklisted: blTags } = parseBiblioTags(getBiblio('tags'));
  if (blTags.length) {
    tags.forEach((tag, i) => {
      const term = getBlacklistedTerm(tag, blTags);
      if (term) {
        const el = document.getElementById(`tag-item-${i}`);
        if (el) setTimeout(() => autoRegenTag(tag, term, el), i * 300);
      }
    });
  }
  const bex = document.getElementById(`${p}-bexplore-tags`);
  if (bex) bex.disabled = false;
}

'''

invalidate_tag = r'''async function invalidateTag(tag, itemId = null, source = 'main') {
  openLibraryBlacklistModal({
    kind: 'tags',
    currentValue: normalizeTagValue(tag),
    itemId,
    source
  });
}

'''

run_tag_explorer = r'''async function runTagExplorer() {
  const p = pfx();
  const btn = document.getElementById(`${p}-bexplore-tags`);
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Exploration...'; }

  const ctx = buildCtx('tags');
  const prompt = buildPrompt('tags', ctx);

  try {
    const { text: result } = await callClaude('tags', {
      filled: prompt.filled,
      fixedContent: prompt.fixedContent
    }, false);

    const tags = parseTagOutput(result);

    document.getElementById('explorerTitle').textContent = '🔭 EXPLORATION TAGS';
    document.getElementById('explorerCount').textContent = `${tags.length} tags`;
    document.getElementById('explorerListLabel').textContent = 'Tags générés — 👍 valider · 👎 blacklister';
    document.getElementById('explorerConversation').value = result;
    ensureLibraryModals();
    ensureExplorerManualAddButton('tags');

    const list = document.getElementById('explorerList');
    list.innerHTML = tags.map((tag, i) => {
      const len = tag.length;
      const lenColor = len > 30 ? 'var(--error)' : 'var(--success)';
      const safe = tag.replace(/'/g, "\\'").replace(/"/g, '&quot;');

      return `<div class="titre-item" id="exp-tag-${i}">
        <span class="titre-text">${tag}</span>
        <span class="titre-char" style="color:${lenColor};">${len}</span>
        <div class="titre-actions">
          <button class="titre-thumb" onclick="event.stopPropagation();validateTag('${safe}');document.getElementById('exp-tag-${i}').classList.add('validated')">👍</button>
          <button class="titre-thumb" onclick="event.stopPropagation();invalidateTag('${safe}','exp-tag-${i}','explorer');document.getElementById('exp-tag-${i}').classList.add('invalidated')">👎</button>
          <button class="titre-thumb" onclick="event.stopPropagation();rerollTag('${safe}','exp-tag-${i}')">🔄</button>
        </div>
      </div>`;
    }).join('');

    document.getElementById('explorerLightbox').classList.add('visible');
    showToast('Exploration terminée ✓', '#e8c547');
  } catch(e) {
    showToast(`Erreur: ${e.message}`, '#ff4757');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔭 Explorer'; }
  }
}

'''

build_titre_selection = r'''function buildTitreSelectionUI(agentId, output) {
  const p = pfx();
  const lines = output.split('\n').filter(l => l.match(/^\d+\.\s+/));
  const zone = document.getElementById(`${p}-sel-${agentId}`);
  const list = document.getElementById(`${p}-sel-list-${agentId}`);
  if (!zone || !list) return;
  zone.classList.add('visible');
  ensureLibraryModals();
  ensureTitresManualAddButton(agentId);
  list.innerHTML = lines.map((l, i) => {
    const text = l.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '').trim();
    const charMatch = l.match(/\((\d+)\s*car/i);
    const chars = charMatch ? parseInt(charMatch[1]) : text.length;
    const charColor = chars > 140 ? 'var(--error)' : chars >= 128 ? 'var(--success)' : chars >= 110 ? 'var(--accent)' : 'var(--muted)';
    const safeText = text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `<div class="titre-item" id="ti-${i}" onclick="selectTitre(${i},'${agentId}',this)">
      <input type="radio" name="titre-${agentId}" style="flex-shrink:0;margin-top:3px;accent-color:var(--accent);"/>
      <span class="titre-text">${text}</span>
      <span class="titre-char" style="color:${charColor};">${chars}</span>
      <div class="titre-actions">
        <button class="titre-thumb" onclick="event.stopPropagation();validateTitreSegment('${safeText}','valid')">👍</button>
        <button class="titre-thumb" onclick="event.stopPropagation();invalidateTitreSegment('${safeText}','ti-${i}','${agentId}','main')">👎</button>
        <button class="titre-copy" onclick="event.stopPropagation();copyTitreLine('${safeText}')">📋</button>
      </div></div>`;
  }).join('');
  // Auto-check blacklist après génération
  const { blacklisted: blTitres } = parseBiblioTitres(getBiblio('titres'));
  if (blTitres.length) {
    lines.forEach((l, i) => {
      const text = l.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '').trim();
      const term = getBlacklistedTerm(text, blTitres);
      if (term) {
        const el = document.getElementById(`ti-${i}`);
        if (el) setTimeout(() => autoRegenTitre(text, term, el, agentId), i * 300);
      }
    });
  }
}

'''

invalidate_titre = r'''async function invalidateTitreSegment(text, itemId, agentId, source = 'main') {
  openLibraryBlacklistModal({
    kind: 'titres',
    currentValue: normalizeTitreValue(text),
    itemId,
    source,
    agentId: agentId || 'titre'
  });
}

'''

run_titre_explorer = r'''async function runTitreExplorer() {
  const p = pfx();
  const btn = document.getElementById(`${p}-bexplore-titre`);
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Exploration...'; }
  const ctx = buildCtx('titre');
  const prompt = buildPrompt('titre', ctx);
  const explorerPrompt = prompt.filled + '\n\nMODE EXPLORATION: Génère environ 30 titres. Format : liste numérotée avec compteur de caractères.';
  try {
    const { text: result } = await callClaude('titre', { filled: explorerPrompt, fixedContent: prompt.fixedContent }, false);
    const lines = result.split('\n').filter(l => l.match(/^\d+\.\s+/));
    const titres = lines.map(l => {
      const text = l.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '').trim();
      const charMatch = l.match(/\((\d+)\s*car/i);
      const chars = charMatch ? parseInt(charMatch[1]) : text.length;
      return { text, chars };
    });
    document.getElementById('explorerTitle').textContent = '🔭 EXPLORATION TITRES';
    document.getElementById('explorerCount').textContent = `${titres.length} titres`;
    document.getElementById('explorerListLabel').textContent = 'Titres générés — 👍 valider · 👎 blacklister';
    document.getElementById('explorerConversation').value = result;
    ensureLibraryModals();
    ensureExplorerManualAddButton('titres', 'titre');
    const list = document.getElementById('explorerList');
    list.innerHTML = titres.map((t, i) => {
      const charColor = t.chars > 140 ? 'var(--error)' : t.chars >= 128 ? 'var(--success)' : t.chars >= 110 ? 'var(--accent)' : 'var(--muted)';
      const safe = t.text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return `<div class="titre-item" id="exp-titre-${i}">
        <span class="titre-text">${t.text}</span>
        <span class="titre-char" style="color:${charColor};">${t.chars}</span>
        <div class="titre-actions">
          <button class="titre-thumb" onclick="event.stopPropagation();validateTitreSegment('${safe}');document.getElementById('exp-titre-${i}').classList.add('validated')">👍</button>
          <button class="titre-thumb" onclick="event.stopPropagation();invalidateTitreSegment('${safe}','exp-titre-${i}','titre','explorer');document.getElementById('exp-titre-${i}').classList.add('invalidated')">👎</button>
          <button class="titre-copy" onclick="event.stopPropagation();copyTitreLine('${safe}')">📋</button>
        </div>
      </div>`;
    }).join('');
    document.getElementById('explorerLightbox').classList.add('visible');
    showToast('Exploration terminée ✓', '#e8c547');
  } catch(e) { showToast(`Erreur: ${e.message}`, '#ff4757'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '🔭 Explorer'; } }
}

'''

ui = insert_after(
    ui,
    "function buildBiblioTitresRaw(validated, blacklisted) {\n  return `## VALIDÉS\\n${validated.map(t => `+ ${t}`).join('\\n')}\\n\\n## BLACKLISTÉS\\n${blacklisted.map(t => `- ${t}`).join('\\n')}\\n`;\n}\n",
    "\n" + modal_helpers + "\n"
)
ui = replace_between(ui, 'function buildTagsUI(output) {', 'async function validateTag(tag) {', build_tags_ui)
ui = replace_between(ui, 'async function invalidateTag(tag, itemId) {', 'async function runTagExplorer() {', invalidate_tag)
ui = replace_between(ui, 'async function runTagExplorer() {', 'function closeExplorer() {', run_tag_explorer)
ui = replace_between(ui, 'function buildTitreSelectionUI(agentId, output) {', 'function selectTitre(i, agentId, el) {', build_titre_selection)
ui = replace_between(ui, 'async function invalidateTitreSegment(text, itemId, agentId) {', 'function copyTitreLine(text) {', invalidate_titre)
ui = replace_between(ui, 'async function runTitreExplorer() {', 'const FORM_FIELDS_TT =', run_titre_explorer)

css_block = '''

.library-actions-bar,
.explorer-library-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin: 8px 0 10px;
}

.library-action-btn {
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  color: var(--text, #fff);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: .18s ease;
}

.library-action-btn:hover {
  background: rgba(255,255,255,.12);
  transform: translateY(-1px);
}

.library-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0,0,0,.62);
  backdrop-filter: blur(3px);
}

.library-modal.visible {
  display: flex;
}

.library-modal-card {
  width: min(680px, 100%);
  background: #16181d;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,.35);
  padding: 18px;
}

.library-modal-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 700;
}

.library-modal-subtitle {
  margin: 0 0 8px;
  color: var(--muted, #a7afba);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.library-modal-current {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255,255,255,.05);
  color: var(--text, #fff);
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
}

.library-modal-textarea {
  width: 100%;
  min-height: 110px;
  resize: vertical;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  color: var(--text, #fff);
  padding: 12px;
  font: inherit;
  outline: none;
}

.library-modal-textarea:focus {
  border-color: rgba(126,184,247,.55);
  box-shadow: 0 0 0 3px rgba(126,184,247,.12);
}

.library-modal-hint {
  margin-top: 8px;
  color: var(--muted, #a7afba);
  font-size: 12px;
  line-height: 1.45;
}

.library-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.library-modal-btn {
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  color: var(--text, #fff);
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
}

.library-modal-btn.primary {
  background: rgba(126,184,247,.18);
  border-color: rgba(126,184,247,.32);
}

.library-modal-btn:hover {
  filter: brightness(1.08);
}

.library-modal-feedback {
  min-height: 18px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--muted, #a7afba);
}

.library-modal-feedback.error {
  color: #ff6b6b;
}
'''

if '.library-modal {' not in css:
    css += css_block

UI_PATH.write_text(ui, encoding='utf-8')
CSS_PATH.write_text(css, encoding='utf-8')

print('Patch appliqué.')
print(f'Backup JS : {UI_PATH.with_suffix(".js.bak")}')
print(f'Backup CSS: {CSS_PATH.with_suffix(".css.bak")}')
