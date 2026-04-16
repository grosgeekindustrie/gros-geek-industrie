(function initPipelineUISelections(global) {

// Sélections tags / titres / accroches / CTA.
// Regroupe les flows de validation utilisateur, explorers et assemblage des sorties.
// Zone sensible car fortement couplée au DOM des cartes pipeline.
  global.PipelineUI = global.PipelineUI || {};

  const helpers = () => global.PipelineUIHelpers || {};
  const modals = () => global.PipelineUIModals || {};
  const tagsApi = () => global.PipelineUITags || {};
  const titlesApi = () => global.PipelineUITitles || {};
  const getPfx = () => (typeof global.pfx === 'function' ? global.pfx() : (global.currentMode === 'collection' ? 'col' : 'tt'));
  const getAgents = () => (typeof global.getPipelineAgents === 'function' ? global.getPipelineAgents() : []);

  const continueAfterSelection = async (agentId) => {
    if (typeof global.continuePipelineAfterSelection === 'function') {
      await global.continuePipelineAfterSelection(agentId);
      return;
    }

    const agents = getAgents();
    const currentIndex = agents.findIndex((agent) => agent.id === agentId);
    const continuationAgents = currentIndex === -1 ? [] : agents.slice(currentIndex + 1);

    for (const agent of continuationAgents) {
      if (agent.optional) break;
      const ok = await global.runAgent(agent);
      if (!ok || agent.hasSelection) break;
    }

    global.assembleFinal?.();
  };

  const TAG_SELECTION_MAX = 13;

  function getTagLibraryState() {
    const parsed = global.parseBiblioTags ? global.parseBiblioTags(global.getBiblio?.('tags')) : {};
    return {
      validated: parsed.validated || [],
      blacklisted: parsed.blacklisted || [],
    };
  }

  function getTagVisualState(tag, libraryState) {
    const validated = libraryState?.validated || [];
    const blacklisted = libraryState?.blacklisted || [];
    const isValidated = helpers().isExactTagInList ? helpers().isExactTagInList(tag, validated) : false;
    const isExactBlacklisted = helpers().isExactTagInList ? helpers().isExactTagInList(tag, blacklisted) : false;
    const matchedTerm = !isExactBlacklisted && helpers().getBlacklistedTerm
      ? helpers().getBlacklistedTerm(tag, blacklisted, { minTermLength: 2 })
      : null;

    return {
      isValidated,
      isExactBlacklisted,
      matchedTerm,
    };
  }

  function filterExplorerTags(tags, libraryState) {
    const seen = new Set();
    return tags.filter((tag) => {
      const normalized = helpers().normalizeTagValue
        ? helpers().normalizeTagValue(tag)
        : String(tag || '').trim().toLowerCase();
      if (!normalized || seen.has(normalized)) return false;

      const tagState = getTagVisualState(tag, libraryState);
      if (tagState.isValidated || tagState.isExactBlacklisted || tagState.matchedTerm) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
  }

  function getTagsSelectionZone() {
    return document.getElementById(`${getPfx()}-sel-tags`);
  }

  function getTagsSelectionRuntimeRoot() {
    return document.getElementById(`${getPfx()}-sel-tags-runtime`);
  }

  function getTagsSelectionRows() {
    return [...document.querySelectorAll(`#${getPfx()}-sel-tags .tags-selection-item`)];
  }

  function normalizeTagInputValue(value) {
    return helpers().normalizeTagValue
      ? helpers().normalizeTagValue(value)
      : String(value || '').trim();
  }

  function getTagsSelectionRowValue(row) {
    const input = row?.querySelector('.tags-selection-input');
    return normalizeTagInputValue(input?.value || '');
  }

  function getTagsSelectionRowState(row, rows = getTagsSelectionRows(), libraryState = getTagLibraryState()) {
    const value = getTagsSelectionRowValue(row);
    const key = value.toLowerCase();
    const duplicateCount = rows.reduce((count, candidate) => {
      if (candidate === row) return count;
      return getTagsSelectionRowValue(candidate).toLowerCase() === key && key ? count + 1 : count;
    }, 0);
    const libraryVisualState = getTagVisualState(value, libraryState);
    const hasLengthError = value.length > 30;
    const hasEmptyError = !value;
    const hasDuplicateError = duplicateCount > 0;
    const isRowValid = !hasEmptyError && !hasLengthError && !hasDuplicateError && !libraryVisualState.isExactBlacklisted && !libraryVisualState.matchedTerm;

    return {
      value,
      duplicateCount,
      hasLengthError,
      hasEmptyError,
      hasDuplicateError,
      isRowValid,
      ...libraryVisualState,
    };
  }

  function buildTagsSelectionRowMarkup(tag, index) {
    const escapedValue = helpers().escapeHtml ? helpers().escapeHtml(tag) : String(tag || '');
    return `
      <article class="tags-selection-item titre-item" id="${getPfx()}-tags-item-${index}" data-tags-item>
        <label class="tags-selection-checkbox-wrap">
          <input class="tags-selection-checkbox" type="checkbox" aria-label="Sélectionner ce tag" />
        </label>
        <input class="tags-selection-input" type="text" value="${escapedValue}" maxlength="60" spellcheck="false" />
        <span class="tags-selection-length" data-tags-length>0</span>
        <button class="btn btn-muted tags-selection-row-btn" type="button" data-tags-action="validate-library" aria-label="Ajouter aux tags validés" title="Ajouter aux tags validés">✓</button>
        <button class="btn btn-muted tags-selection-row-btn tags-selection-row-btn-danger" type="button" data-tags-action="blacklist-library" aria-label="Blacklister ce tag" title="Blacklister ce tag">✕</button>
      </article>`;
  }

  function splitTagsIntoColumns(tags = []) {
    const left = [];
    const right = [];

    tags.forEach((tag, index) => {
      if (index % 2 === 0) {
        left.push(tag);
      } else {
        right.push(tag);
      }
    });

    return [left, right];
  }

  function getTagsSelectedValues({ onlyValid = false } = {}) {
    const rows = getTagsSelectionRows();
    const libraryState = getTagLibraryState();

    return rows
      .filter((row) => row.querySelector('.tags-selection-checkbox')?.checked)
      .map((row) => ({ row, state: getTagsSelectionRowState(row, rows, libraryState) }))
      .filter(({ state }) => (onlyValid ? state.isRowValid : true))
      .map(({ state }) => state.value)
      .filter(Boolean);
  }

  function copyTagsSelectionValues(values, successMessage) {
    navigator.clipboard.writeText(values.join(', '));
    global.showToast?.(successMessage);
  }

  function copyTagsSelectionColumn(columnIndex) {
    const column = document.getElementById(`${getPfx()}-tags-column-${columnIndex}`);
    if (!column) return;

    const values = [...column.querySelectorAll('.tags-selection-input')]
      .map((input) => normalizeTagInputValue(input.value))
      .filter(Boolean);

    if (!values.length) {
      global.showToast?.('Aucun tag à copier dans cette liste', '#ff4757');
      return;
    }

    copyTagsSelectionValues(values, `Liste brute ${columnIndex} copiée ✓`);
  }

  function copyTagsSelectionFinalOutput() {
    const values = getTagsSelectedValues();
    if (!values.length) {
      global.showToast?.('Aucun tag sélectionné à copier', '#ff4757');
      return;
    }

    copyTagsSelectionValues(values, 'Sortie finale tags copiée ✓');
  }

  function updateTagsSelectionSummary() {
    const p = getPfx();
    const rows = getTagsSelectionRows();
    const libraryState = getTagLibraryState();
    let checkedCount = 0;
    let validSelectedCount = 0;
    let invalidSelectedCount = 0;

    rows.forEach((row) => {
      const rowState = getTagsSelectionRowState(row, rows, libraryState);
      const checkbox = row.querySelector('.tags-selection-checkbox');
      const lengthNode = row.querySelector('[data-tags-length]');
      const isChecked = Boolean(checkbox?.checked);

      row.classList.toggle('is-checked', isChecked);
      row.classList.toggle('is-invalid', !rowState.isRowValid);
      row.classList.toggle('is-library-validated', rowState.isValidated);
      row.classList.toggle('is-library-blacklisted', rowState.isExactBlacklisted || Boolean(rowState.matchedTerm));
      row.dataset.tagsValid = rowState.isRowValid ? 'true' : 'false';

      if (lengthNode) {
        lengthNode.textContent = String(rowState.value.length);
        lengthNode.className = `tags-selection-length ${rowState.hasLengthError ? 'is-invalid' : ''}`.trim();
      }

      let rowTitle = 'Tag valide';
      if (rowState.hasEmptyError) {
        rowTitle = 'Tag vide';
      } else if (rowState.hasLengthError) {
        rowTitle = 'Tag trop long';
      } else if (rowState.hasDuplicateError) {
        rowTitle = 'Tag en doublon';
      } else if (rowState.isExactBlacklisted) {
        rowTitle = 'Tag blacklisté';
      } else if (rowState.matchedTerm) {
        rowTitle = 'Tag contenant un terme exclu';
      } else if (rowState.isValidated) {
        rowTitle = 'Tag déjà validé en bibliothèque';
      }
      row.title = rowTitle;

      if (isChecked) {
        checkedCount += 1;
        if (rowState.isRowValid) validSelectedCount += 1;
        else invalidSelectedCount += 1;
      }
    });

    const summaryNodes = {
      total: document.getElementById(`${p}-tags-stat-total`),
      selected: document.getElementById(`${p}-tags-stat-selected`),
      valid: document.getElementById(`${p}-tags-stat-valid`),
      invalid: document.getElementById(`${p}-tags-stat-invalid`),
      counter: document.getElementById(`${p}-tags-selected-counter`),
    };

    if (summaryNodes.total) summaryNodes.total.textContent = String(rows.length);
    if (summaryNodes.selected) summaryNodes.selected.textContent = `${checkedCount} / ${TAG_SELECTION_MAX}`;
    if (summaryNodes.valid) summaryNodes.valid.textContent = String(validSelectedCount);
    if (summaryNodes.invalid) summaryNodes.invalid.textContent = String(invalidSelectedCount);
    if (summaryNodes.counter) summaryNodes.counter.textContent = `${checkedCount} sélectionné(s)`;

    const validateButton = document.getElementById(`${p}-validate-tags`);
    if (validateButton) {
      validateButton.disabled = checkedCount === 0 || checkedCount > TAG_SELECTION_MAX || invalidSelectedCount > 0;
    }

    global.PipelineUIRender?.syncTagsOutputFromUI?.();
  }

  function bindTagsSelectionEvents() {
    const zone = getTagsSelectionZone();
    if (!zone || zone.dataset.tagsUiBound === 'true') return;

    zone.dataset.tagsUiBound = 'true';

    zone.addEventListener('change', (event) => {
      if (!event.target.classList.contains('tags-selection-checkbox')) return;

      if (event.target.checked) {
        const checkedCount = getTagsSelectionRows().filter((row) => row.querySelector('.tags-selection-checkbox')?.checked).length;
        if (checkedCount > TAG_SELECTION_MAX) {
          event.target.checked = false;
          global.showToast?.(`Tu ne peux pas sélectionner plus de ${TAG_SELECTION_MAX} tags.`, '#ff4757');
        }
      }

      updateTagsSelectionSummary();
    });

    zone.addEventListener('input', (event) => {
      if (!event.target.classList.contains('tags-selection-input')) return;
      updateTagsSelectionSummary();
    });

    zone.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-tags-action], [data-tags-copy]');
      if (!button) return;

      if (button.dataset.tagsCopy) {
        if (button.dataset.tagsCopy === 'final') {
          copyTagsSelectionFinalOutput();
        } else {
          copyTagsSelectionColumn(button.dataset.tagsCopy);
        }
        return;
      }

      const row = button.closest('.tags-selection-item');
      const rowValue = getTagsSelectionRowValue(row);
      if (!rowValue) {
        global.showToast?.('Tag vide : impossible de lancer cette action', '#ff4757');
        return;
      }

      if (button.dataset.tagsAction === 'validate-library') {
        await validateTag(rowValue);
        updateTagsSelectionSummary();
        return;
      }

      if (button.dataset.tagsAction === 'blacklist-library') {
        await invalidateTag(rowValue, null, 'main');
      }
    });

    document.addEventListener('pipeline:tags-library-updated', () => {
      updateTagsSelectionSummary();
    });
  }

  function buildTagsUI(output) {
    const p = getPfx();
    const tags = helpers().parseTagOutput ? helpers().parseTagOutput(output) : [];
    const zone = getTagsSelectionZone();
    const runtimeRoot = getTagsSelectionRuntimeRoot();
    if (!zone || !runtimeRoot) return;

    global.state.outputs.tags_raw = output;
    global.state.outputs.tags = '';
    global.state.selectedTags = [];

    if (!tags.length) {
      runtimeRoot.innerHTML = '<div class="tags-selection-empty">Aucun tag généré.</div>';
      zone.style.display = 'block';
      const validateButton = document.getElementById(`${p}-validate-tags`);
      if (validateButton) validateButton.disabled = true;
      return;
    }

    const [leftColumn, rightColumn] = splitTagsIntoColumns(tags);

    runtimeRoot.innerHTML = `
      <div class="tags-selection-shell">
        <div class="tags-selection-topbar">
          <div class="tags-selection-heading">
            <div class="tags-selection-title">🔖 Sélection manuelle</div>
            <div class="tags-selection-subtitle">2 colonnes · ${TAG_SELECTION_MAX} tags max · une ligne par tag.</div>
          </div>
          <div class="tags-selection-toolbar">
            <button class="btn btn-muted" type="button" data-tags-copy="1">📋 Liste 1</button>
            <button class="btn btn-muted" type="button" data-tags-copy="2">📋 Liste 2</button>
            <button class="btn btn-accent" type="button" data-tags-copy="final">📋 Sortie finale</button>
          </div>
        </div>
        <div class="tags-selection-stats">
          <div class="tags-selection-stat">
            <span class="tags-selection-stat-label">Candidats</span>
            <span class="tags-selection-stat-value" id="${p}-tags-stat-total">0</span>
          </div>
          <div class="tags-selection-stat">
            <span class="tags-selection-stat-label">Sélection</span>
            <span class="tags-selection-stat-value" id="${p}-tags-stat-selected">0 / ${TAG_SELECTION_MAX}</span>
          </div>
          <div class="tags-selection-stat">
            <span class="tags-selection-stat-label">Valides</span>
            <span class="tags-selection-stat-value" id="${p}-tags-stat-valid">0</span>
          </div>
          <div class="tags-selection-stat">
            <span class="tags-selection-stat-label">Invalides</span>
            <span class="tags-selection-stat-value" id="${p}-tags-stat-invalid">0</span>
          </div>
        </div>
        <div class="tags-selection-columns">
          <section class="tags-selection-column" id="${p}-tags-column-1">
            <div class="tags-selection-column-head">
              <span class="tags-selection-column-title">Liste 1</span>
              <span class="tags-selection-column-meta" id="${p}-tags-selected-counter">0 sélectionné(s)</span>
            </div>
            <div class="tags-selection-grid-head" aria-hidden="true">
              <span>☑</span>
              <span>Tag</span>
              <span>Long.</span>
              <span>Valid</span>
              <span>Invalid</span>
            </div>
            <div class="tags-selection-list">${leftColumn.map(buildTagsSelectionRowMarkup).join('')}</div>
          </section>
          <section class="tags-selection-column" id="${p}-tags-column-2">
            <div class="tags-selection-column-head">
              <span class="tags-selection-column-title">Liste 2</span>
              <span class="tags-selection-column-meta">Édition live</span>
            </div>
            <div class="tags-selection-grid-head" aria-hidden="true">
              <span>☑</span>
              <span>Tag</span>
              <span>Long.</span>
              <span>Valid</span>
              <span>Invalid</span>
            </div>
            <div class="tags-selection-list">${rightColumn.map((tag, index) => buildTagsSelectionRowMarkup(tag, index + leftColumn.length)).join('')}</div>
          </section>
        </div>
        <section class="tags-selection-preview">
          <div class="tags-selection-preview-head">
            <span class="tags-selection-preview-title">Sortie finale</span>
          </div>
          <pre class="tags-selection-preview-output" id="${p}-tags-final-output">— aucun tag sélectionné —</pre>
        </section>
      </div>`;

    zone.style.display = 'block';
    modals().ensureLibraryModals?.();
    modals().ensureTagsManualAddButton?.();
    bindTagsSelectionEvents();
    updateTagsSelectionSummary();

    const exploreBtn = document.getElementById(`${p}-bexplore-tags`);
    if (exploreBtn) exploreBtn.disabled = false;
  }

  async function validateTag(tag) {
    const parsed = global.parseBiblioTags(global.getBiblio('tags'));
    const validated = parsed.validated || [];
    const blacklisted = parsed.blacklisted || [];
    const normalizedTag = normalizeTagInputValue(tag);

    if (!normalizedTag) return;

    if (validated.some((entry) => helpers().sameTag ? helpers().sameTag(entry, normalizedTag) : entry === normalizedTag)) {
      global.showToast?.('Déjà validé');
      return;
    }

    validated.push(normalizedTag);
    const updated = global.buildBiblioTagsRaw(validated, blacklisted);
    try {
      const res = await fetch(`/files/biblios/${global.currentMode}/tags.md`, { method: 'PUT', body: updated });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      global.state.bibliosByMode[global.currentMode].tags = updated;
      document.dispatchEvent(new CustomEvent('pipeline:tags-library-updated'));
      global.showToast?.(`👍 "${normalizedTag}" validé`);
    } catch (error) {
      global.showToast?.('Erreur sauvegarde', '#ff4757');
    }
  }

  async function invalidateTag(tag, itemId = null, source = 'main') {
    modals().openLibraryBlacklistModal?.({
      kind: 'tags',
      currentValue: normalizeTagInputValue(tag),
      itemId,
      source,
    });
  }

  async function validateTags(agentId) {
    const p = getPfx();
    const selectedTags = getTagsSelectedValues({ onlyValid: true });
    const invalidSelectedCount = getTagsSelectionRows().filter((row) => {
      const checkbox = row.querySelector('.tags-selection-checkbox');
      if (!checkbox?.checked) return false;
      return row.dataset.tagsValid !== 'true';
    }).length;

    if (!selectedTags.length) {
      alert('Choisis au moins un tag valide.');
      return;
    }

    if (invalidSelectedCount > 0) {
      alert('Corrige les tags invalides avant de valider.');
      return;
    }

    if (selectedTags.length > TAG_SELECTION_MAX) {
      alert(`Tu ne peux pas valider plus de ${TAG_SELECTION_MAX} tags.`);
      return;
    }

    const finalCsv = selectedTags.join(', ');
    global.state.selectedTags = selectedTags;
    global.state.outputs.tags = finalCsv;
    global.setPipelineRunEntry?.(p, agentId, finalCsv, { quality: 'net', validation: 'valide', origin: 'manuel', sourceAgentId: agentId });
    global.PipelineUIRender?.syncSelectionField?.('tags', finalCsv, p);
    global.PipelineUIRender?.syncFinalPre?.('tags', finalCsv, p);

    const zone = getTagsSelectionZone();
    const status = document.getElementById(`${p}-stat-${agentId}`);
    if (zone) zone.style.display = 'none';
    if (status) {
      status.textContent = '✓ sélection validée';
      status.className = 'agent-status s-done';
    }

    await continueAfterSelection(agentId);
  }

  async function runTagExplorer() {
    const p = getPfx();
    const btn = document.getElementById(`${p}-bexplore-tags`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⟳ Exploration...';
    }

    const ctx = global.buildCtx('tags');
    const prompt = global.buildPrompt('tags', ctx);

    try {
      const { text: result } = await global.callClaude('tags', {
        filled: prompt.filled,
        fixedContent: prompt.fixedContent,
      }, false);

      const tags = helpers().parseTagOutput ? helpers().parseTagOutput(result) : [];
      const libraryState = getTagLibraryState();
      const filteredTags = filterExplorerTags(tags, libraryState);
      const excludedCount = tags.length - filteredTags.length;

      document.getElementById('explorerTitle').textContent = '🔭 EXPLORATION TAGS';
      document.getElementById('explorerCount').textContent = `${filteredTags.length} tags`;
      document.getElementById('explorerListLabel').textContent = 'Tags générés hors biblio — 👍 valider · 👎 blacklister';
      document.getElementById('explorerConversation').value = result;

      modals().ensureLibraryModals?.();
      modals().ensureExplorerManualAddButton?.('tags');

      const list = document.getElementById('explorerList');
      list.innerHTML = filteredTags.length ? filteredTags.map((tag, i) => {
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
      }).join('') : '<div class="titre-item"><span class="titre-text">Aucun tag exploitable hors biblio.</span></div>';

      document.getElementById('explorerLightbox').classList.add('visible');
      global.showToast?.(excludedCount > 0 ? `Exploration terminée ✓ (${excludedCount} exclus via biblio)` : 'Exploration terminée ✓', '#e8c547');
    } catch (error) {
      global.showToast?.(`Erreur: ${error.message}`, '#ff4757');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔭 Explorer';
      }
    }
  }

  function closeExplorer() {
    document.getElementById('explorerLightbox').classList.remove('visible');
  }

  function buildTitreSelectionUI(agentId, output) {
    const p = getPfx();
    const lines = output.split('\n').filter((line) => line.match(/^\d+\.\s+/));
    const zone = document.getElementById(`${p}-sel-${agentId}`);
    const list = document.getElementById(`${p}-sel-list-${agentId}`);
    if (!zone || !list) return;

    zone.classList.add('visible');
    modals().ensureLibraryModals?.();
    modals().ensureTitresManualAddButton?.(agentId);

    list.innerHTML = lines.map((line, i) => {
      const text = line.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '').trim();
      const charMatch = line.match(/\((\d+)\s*car/i);
      const chars = charMatch ? parseInt(charMatch[1], 10) : text.length;
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

    const parsed = global.parseBiblioTitres ? global.parseBiblioTitres(global.getBiblio?.('titres')) : { blacklisted: [] };
    const blacklisted = parsed.blacklisted || [];
    if (blacklisted.length) {
      lines.forEach((line, i) => {
        const text = line.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '').trim();
        const term = helpers().getBlacklistedTerm ? helpers().getBlacklistedTerm(text, blacklisted) : null;
        if (term) {
          const el = document.getElementById(`ti-${i}`);
          if (el) setTimeout(() => titlesApi().autoRegenTitre?.(text, term, el, agentId), i * 300);
        }
      });
    }
  }

  function selectTitre(i, agentId, el) {
    el.parentElement.querySelectorAll('.titre-item').forEach((node) => node.classList.remove('selected'));
    el.classList.add('selected');
    el.querySelector('input').checked = true;
    const selectedTitre = el.querySelector('.titre-text').textContent.trim();
    global.state.selectedTitre = selectedTitre;
    const p = getPfx();
    const input = document.getElementById(`${p}-titre-manual-${agentId}`);
    if (input) {
      input.value = selectedTitre;
      updateTitreCounter(agentId);
    }
  }

  function updateTitreCounter(agentId) {
    const p = getPfx();
    const input = document.getElementById(`${p}-titre-manual-${agentId}`);
    const counter = document.getElementById(`${p}-titre-counter-${agentId}`);
    if (!input || !counter) return;

    const len = input.value.length;
    counter.textContent = `${len} / 140`;
    counter.style.color = len > 140 ? 'var(--error)' : len > 130 ? 'var(--accent)' : 'var(--muted)';
    input.style.borderColor = len > 140 ? 'var(--error)' : len > 130 ? 'var(--accent)' : '';
  }

  function pasteSelectedTitre(agentId) {
    const p = getPfx();
    if (global.state.selectedTitre) {
      document.getElementById(`${p}-titre-manual-${agentId}`).value = global.state.selectedTitre;
      updateTitreCounter(agentId);
    }
  }

  async function validateTitreSegment(text) {
    const parsed = global.parseBiblioTitres(global.getBiblio('titres'));
    const validated = parsed.validated || [];
    const blacklisted = parsed.blacklisted || [];
    if (validated.includes(text)) return;

    validated.push(text);
    const updated = global.buildBiblioTitresRaw(validated, blacklisted);
    try {
      const res = await fetch(`/files/biblios/${global.currentMode}/titres.md`, { method: 'PUT', body: updated });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      global.state.bibliosByMode[global.currentMode].titres = updated;
      global.showToast?.('👍 Titre ajouté aux exemples validés');
    } catch (error) {
      global.showToast?.('Erreur sauvegarde titres', '#ff4757');
    }
  }

  async function invalidateTitreSegment(text, itemId, agentId, source = 'main') {
    modals().openLibraryBlacklistModal?.({
      kind: 'titres',
      currentValue: helpers().normalizeTitreValue ? helpers().normalizeTitreValue(text) : String(text || '').trim(),
      itemId,
      source,
      agentId: agentId || 'titre',
    });
  }

  function copyTitreLine(text) {
    navigator.clipboard.writeText(text);
    global.showToast?.('Titre copié ✓');
  }

  async function validateTitre(agentId) {
    const p = getPfx();
    const input = document.getElementById(`${p}-titre-manual-${agentId}`);
    const titre = input?.value.trim() || '';
    const selectedTitre = String(global.state.selectedTitre || '').trim();
    if (!titre) {
      alert('Choisis ou saisis un titre.');
      return;
    }

    global.state.selectedTitre = titre;
    global.state.outputs.titre_valide = titre;
    global.setPipelineRunEntry?.(p, agentId, titre, { quality: 'net', validation: 'valide', origin: 'manuel', sourceAgentId: agentId });
    if (titre !== selectedTitre) {
      validateTitreSegment(titre);
      global.showToast?.('✅ Titre manuel ajouté aux exemples validés');
    }

    document.getElementById(`${p}-sel-${agentId}`).classList.remove('visible');
    document.getElementById(`${p}-stat-${agentId}`).textContent = '✓ titre validé';
    document.getElementById(`${p}-stat-${agentId}`).className = 'agent-status s-done';

    await continueAfterSelection(agentId);
  }

  function parseChoices(output, prefix) {
    const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
    const choices = [];

    for (const line of lines) {
      const match = line.match(new RegExp(`^${prefix}(\\d+)\\s*[→:]\\s*(.+)`));
      if (match) choices.push({ num: match[1], text: match[2].trim() });
    }
    if (choices.length > 0) return choices;

    if (prefix === 'A') {
      let pastTechnique = false;
      for (const line of lines) {
        if (line.startsWith('•') || line.startsWith('🛠️')) {
          pastTechnique = true;
          continue;
        }
        if (!pastTechnique) continue;
        const hasEmoji = /^[\u{1F300}-\u{1FFFF}⚡🎯⚔️🎨🏆💫🎁🔥✨🏅💎🌑👀⏳🎲🖌️🎭]/u.test(line);
        if (hasEmoji && choices.length < 5) choices.push({ num: String(choices.length + 1), text: line });
        if (line.includes('Conseils de peinture')) break;
      }
    }

    if (prefix === 'C') {
      let pastConseils = false;
      let count = 0;
      for (const line of lines) {
        if (line.includes('Conseils de peinture') || line.startsWith('🎨 Conseils')) {
          pastConseils = true;
          continue;
        }
        if (!pastConseils) continue;
        if (line.startsWith('🎭') || line.includes('Fan Art')) break;
        const hasEmoji = /^[\u{1F300}-\u{1FFFF}⚡🎯⚔️🎨🏆💫🎁🔥✨🏅💎🌑👀⏳🎲🖌️🎭]/u.test(line);
        if (hasEmoji && count < 5) {
          choices.push({ num: String(count + 1), text: line });
          count++;
        }
      }
    }

    return choices;
  }

  function buildAccrocheCTASelectionUI(agentId, output) {
    const p = getPfx();
    const accroches = parseChoices(output, 'A');
    const ctas = parseChoices(output, 'C');

    if (accroches.length > 0) {
      const zone = document.getElementById(`${p}-sel-accroche-${agentId}`);
      const list = document.getElementById(`${p}-sel-list-accroche-${agentId}`);
      if (zone && list) {
        zone.classList.add('visible');
        list.innerHTML = accroches.map((choice) => `<div class="choice-item" onclick="selectChoice('accroche','${agentId}','${choice.num}',this)"><input type="radio" name="acc-${agentId}"/><label>${choice.text}</label></div>`).join('');
      }
    }

    if (ctas.length > 0) {
      const zone = document.getElementById(`${p}-sel-cta-${agentId}`);
      const list = document.getElementById(`${p}-sel-list-cta-${agentId}`);
      if (zone && list) {
        zone.classList.add('visible');
        list.innerHTML = ctas.map((choice) => `<div class="choice-item" onclick="selectChoice('cta','${agentId}','${choice.num}',this)"><input type="radio" name="cta-${agentId}"/><label>${choice.text}</label></div>`).join('');
      }
    }
  }

  function selectChoice(type, agentId, num, el) {
    el.parentElement.querySelectorAll('.choice-item').forEach((node) => node.classList.remove('selected'));
    el.classList.add('selected');
    el.querySelector('input').checked = true;
    const text = el.querySelector('label').textContent.trim();
    if (type === 'accroche') global.state.selectedAccroche = { num, text };
    if (type === 'cta') global.state.selectedCTA = { num, text };
  }

  async function validateAccrocheCTA(agentId) {
    const p = getPfx();
    if (!global.state.selectedAccroche || !global.state.selectedCTA) {
      alert('Choisis une accroche et un CTA.');
      return;
    }

    const output = global.state.outputs[agentId];
    const lines = output.split('\n');
    const result = [];
    let accrocheDone = false;
    let ctaDone = false;

    for (const line of lines) {
      if (line.match(/^A\d+\s*[→:]/)) {
        if (!accrocheDone) {
          result.push(global.state.selectedAccroche.text);
          accrocheDone = true;
        }
        continue;
      }
      if (line.match(/^C\d+\s*[→:]/)) {
        if (!ctaDone) {
          result.push(global.state.selectedCTA.text);
          ctaDone = true;
        }
        continue;
      }
      result.push(line);
    }

    global.state.outputs[`${agentId}_assembled`] = result.join('\n').trim();
    document.getElementById(`${p}-sel-accroche-${agentId}`).classList.remove('visible');
    document.getElementById(`${p}-sel-cta-${agentId}`).classList.remove('visible');
    document.getElementById(`${p}-stat-${agentId}`).textContent = '✓ sélection validée';
    document.getElementById(`${p}-stat-${agentId}`).className = 'agent-status s-done';

    await continueAfterSelection(agentId);
  }

  async function runTitreExplorer() {
    const p = getPfx();
    const btn = document.getElementById(`${p}-bexplore-titre`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⟳ Exploration...';
    }

    const ctx = global.buildCtx('titre');
    const prompt = global.buildPrompt('titre', ctx);
    const explorerPrompt = `${prompt.filled}\n\nMODE EXPLORATION: Génère environ 30 titres. Format : liste numérotée avec compteur de caractères.`;

    try {
      const { text: result } = await global.callClaude('titre', {
        filled: explorerPrompt,
        fixedContent: prompt.fixedContent,
      }, false);

      const lines = result.split('\n').filter((line) => line.match(/^\d+\.\s+/));
      const titres = lines.map((line) => {
        const text = line.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '').trim();
        const charMatch = line.match(/\((\d+)\s*car/i);
        const chars = charMatch ? parseInt(charMatch[1], 10) : text.length;
        return { text, chars };
      });

      document.getElementById('explorerTitle').textContent = '🔭 EXPLORATION TITRES';
      document.getElementById('explorerCount').textContent = `${titres.length} titres`;
      document.getElementById('explorerListLabel').textContent = 'Titres générés — 👍 valider · 👎 blacklister';
      document.getElementById('explorerConversation').value = result;

      modals().ensureLibraryModals?.();
      modals().ensureExplorerManualAddButton?.('titres', 'titre');

      const list = document.getElementById('explorerList');
      list.innerHTML = titres.map((titre, i) => {
        const charColor = titre.chars > 140 ? 'var(--error)' : titre.chars >= 128 ? 'var(--success)' : titre.chars >= 110 ? 'var(--accent)' : 'var(--muted)';
        const safe = titre.text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `<div class="titre-item" id="exp-titre-${i}">
        <span class="titre-text">${titre.text}</span>
        <span class="titre-char" style="color:${charColor};">${titre.chars}</span>
        <div class="titre-actions">
          <button class="titre-thumb" onclick="event.stopPropagation();validateTitreSegment('${safe}');document.getElementById('exp-titre-${i}').classList.add('validated')">👍</button>
          <button class="titre-thumb" onclick="event.stopPropagation();invalidateTitreSegment('${safe}','exp-titre-${i}','titre','explorer');document.getElementById('exp-titre-${i}').classList.add('invalidated')">👎</button>
          <button class="titre-copy" onclick="event.stopPropagation();copyTitreLine('${safe}')">📋</button>
        </div>
      </div>`;
      }).join('');

      document.getElementById('explorerLightbox').classList.add('visible');
      global.showToast?.('Exploration terminée ✓', '#e8c547');
    } catch (error) {
      global.showToast?.(`Erreur: ${error.message}`, '#ff4757');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔭 Explorer';
      }
    }
  }

  global.PipelineUISelections = {
    buildTagsUI,
    validateTag,
    invalidateTag,
    validateTags,
    runTagExplorer,
    closeExplorer,
    buildTitreSelectionUI,
    selectTitre,
    updateTitreCounter,
    pasteSelectedTitre,
    validateTitreSegment,
    invalidateTitreSegment,
    copyTitreLine,
    validateTitre,
    parseChoices,
    buildAccrocheCTASelectionUI,
    selectChoice,
    validateAccrocheCTA,
    runTitreExplorer,
  };

  global.PipelineUI.selections = global.PipelineUI.selections || {};
  Object.assign(global.PipelineUI.selections, global.PipelineUISelections);
  Object.assign(global, global.PipelineUISelections);
})(window);
