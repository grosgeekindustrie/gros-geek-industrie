(function initPipelineUISelections(global) {

// Sélections tags / titres / accroches / CTA.
// Regroupe les flows de validation utilisateur, explorers et assemblage des sorties.
// Zone sensible car fortement couplée au DOM des cartes pipeline.
  global.PipelineUI = global.PipelineUI || {};
  const dom = global.PipelineUIDom || {};
  const runtimeCache = global.PipelineUIRuntimeCache || {};

  const helpers = () => global.PipelineUIHelpers || {};
  const modals = () => global.PipelineUIModals || {};
  const titlesApi = () => global.PipelineUITitles || {};
  const getPfx = () => global.pfx();
  let selectionDelegationBound = false;

  const continueAfterSelection = async (agentId) => {
    await global.continuePipelineAfterSelection(agentId);
  };

  const TAG_SELECTION_MAX = 13;
  const AUXILIARY_RETRY_COUNT = 1;
  const COMMON_PRODUCT_TAGS = global.PipelineUIDataTagsCommon?.COMMON_PRODUCT_TAGS || [];
  const PIPELINE_SEED_STORAGE_PREFIX = 'pipeline.seed.';

  function getPipelineSeedStorageKey(prefix = getPfx()) {
    return `${PIPELINE_SEED_STORAGE_PREFIX}${String(prefix || '').trim()}`;
  }

  function buildPipelineSeedSnapshot(prefix = getPfx()) {
    const outputs = global.state?.outputs || {};
    return {
      prefix: String(prefix || '').trim(),
      title: String(outputs.titre_valide || '').trim(),
      tagsCsv: String(outputs.tags || '').trim(),
      descriptionText: String(outputs.description_final || outputs.description_assembled || '').trim(),
      altText: String(outputs.alt || '').trim(),
      updatedAt: new Date().toISOString(),
    };
  }

  function persistPipelineSeedSnapshot(prefix = getPfx()) {
    const snapshot = buildPipelineSeedSnapshot(prefix);
    try {
      localStorage.setItem(getPipelineSeedStorageKey(prefix), JSON.stringify(snapshot));
    } catch (error) {}
    return snapshot;
  }

  function readPipelineSeedSnapshot(prefix = getPfx()) {
    try {
      const raw = localStorage.getItem(getPipelineSeedStorageKey(prefix));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function clearPipelineSeedSnapshot(prefix = getPfx()) {
    try {
      localStorage.removeItem(getPipelineSeedStorageKey(prefix));
    } catch (error) {}
  }

  function escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function getSelectionText(trigger) {
    return String(trigger?.dataset.selectionText || '').trim();
  }

  function getSelectionItem(trigger) {
    return dom.getClosestByData?.(trigger, 'selectionItem');
  }

  function getSelectionItemById(itemId) {
    if (!itemId) return null;
    return dom.getByData?.('itemId', itemId) || document.getElementById(itemId);
  }

  function getScopedSelectionZone(kind, agentId = '') {
    return dom.getAllByData?.('selectionZone', kind, document)
      ?.find((node) => node.dataset.prefix === getPfx() && (!agentId || node.dataset.agentId === agentId))
      || null;
  }

  function getSelectionList(kind, agentId = '') {
    return dom.getByData?.('selectionList', kind, getScopedSelectionZone(kind, agentId)) || null;
  }

  function getTitreManualInput(agentId) {
    return dom.getByData?.('selectionManualInput', 'titre', getScopedSelectionZone('titre', agentId))
      || document.getElementById(`${getPfx()}-titre-manual-${agentId}`);
  }

  function getTitreCounter(agentId) {
    return dom.getByData?.('selectionCounter', 'titre', getScopedSelectionZone('titre', agentId))
      || document.getElementById(`${getPfx()}-titre-counter-${agentId}`);
  }

  function getSelectionExplorerButton(kind) {
    return dom.getAllByData?.('selectionExplore', kind, document)
      ?.find((node) => node.dataset.prefix === getPfx())
      || null;
  }

  function getExplorerNodes() {
    const root = dom.getByData?.('js', 'explorer-lightbox') || document.getElementById('explorerLightbox');
    return {
      root,
      title: dom.getByData?.('js', 'explorer-title', root) || document.getElementById('explorerTitle'),
      count: dom.getByData?.('js', 'explorer-count', root) || document.getElementById('explorerCount'),
      conversation: dom.getByData?.('js', 'explorer-conversation', root) || document.getElementById('explorerConversation'),
      listLabel: dom.getByData?.('js', 'explorer-list-label', root) || document.getElementById('explorerListLabel'),
      list: dom.getByData?.('js', 'explorer-list', root) || document.getElementById('explorerList'),
    };
  }

  function buildAuxiliaryPromptKey(kind, filled, fixedContent = '') {
    return runtimeCache.buildCacheKey?.(
      global.currentMode,
      getPfx(),
      kind,
      fixedContent,
      filled
    ) || `${kind}:${filled}`;
  }

  async function runCachedAuxiliaryPrompt(scope, key, factory) {
    const cachedValue = runtimeCache.readCacheValue?.(scope, key);
    if (typeof cachedValue !== 'undefined') {
      return { ...cachedValue, cached: true };
    }

    const value = await runtimeCache.runWithSharedRequest?.(scope, key, factory);
    return { ...value, cached: false };
  }

  const TAG_SEMANTIC_STOPWORDS = new Set([
    'de', 'du', 'des', 'd', 'l', 'le', 'la', 'les', 'un', 'une',
    'a', 'à', 'en', 'et', 'pour', 'of', 'the',
  ]);

  function normalizeTagSemanticText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, ' ')
      .replace(/\b(a collectionner|de collection|collection)\b/g, ' collection ')
      .replace(/\b(imprimee en 3d|imprime en 3d|impression 3d)\b/g, ' impression3d ')
      .replace(/[^a-z0-9&]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getTagSemanticKey(value) {
    const tokens = normalizeTagSemanticText(value)
      .split(' ')
      .filter((token) => token && !TAG_SEMANTIC_STOPWORDS.has(token));
    return [...new Set(tokens)].sort().join(' ');
  }

  function getSelectedSemanticDuplicates(rows) {
    const groups = new Map();

    rows.forEach((row) => {
      const checkbox = dom.getByData?.('tags-checkbox', null, row);
      if (!checkbox?.checked) return;

      const value = getTagsSelectionRowValue(row);
      const key = getTagSemanticKey(value);
      if (!key) return;

      const group = groups.get(key) || [];
      group.push({ row, value });
      groups.set(key, group);
    });

    return groups;
  }

  function getSemanticDuplicatePeer(row, semanticGroups) {
    const value = getTagsSelectionRowValue(row);
    const key = getTagSemanticKey(value);
    const group = key ? semanticGroups.get(key) || [] : [];
    const peer = group.find((entry) => entry.row !== row);
    return peer?.value || '';
  }

  function getTagLibraryState() {
    const parsed = global.parseBiblioTags(global.getBiblio('tags'));
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
    return getScopedSelectionZone('tags', 'tags') || document.getElementById(`${getPfx()}-sel-tags`);
  }

  function getTagsSelectionRuntimeRoot() {
    return dom.getByData?.('tagsRuntimeRoot', null, getTagsSelectionZone()) || document.getElementById(`${getPfx()}-sel-tags-runtime`);
  }

  function getTagsSelectionRows() {
    return dom.getAllByData?.('tagsItem', null, getTagsSelectionZone()) || [];
  }

  function normalizeTagInputValue(value) {
    return helpers().normalizeTagValue
      ? helpers().normalizeTagValue(value)
      : String(value || '').trim();
  }

  function getTagsSelectionRowValue(row) {
    const input = dom.getByData?.('tags-input', null, row);
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

  function buildTagsSelectionRowMarkup(tag, index, source = 'generated') {
    const escapedValue = helpers().escapeHtml ? helpers().escapeHtml(tag) : String(tag || '');
    const validateIcon = global.PipelineUIIcons?.renderIcon('check') || 'Valider';
    const blacklistIcon = global.PipelineUIIcons?.renderIcon('close') || 'Blacklister';
    return `
      <article class="tags-selection-item titre-item" id="${getPfx()}-tags-item-${index}" data-tags-item data-tags-source="${escapeAttr(source)}">
        <label class="tags-selection-checkbox-wrap">
          <input class="tags-selection-checkbox" type="checkbox" aria-label="Sélectionner ce tag" data-tags-checkbox />
        </label>
        <input class="tags-selection-input" type="text" value="${escapedValue}" maxlength="60" spellcheck="false" data-tags-input />
        <span class="tags-selection-length" data-tags-length>0</span>
        <button class="btn btn-muted tags-selection-row-btn" type="button" data-tags-action="validate-library" aria-label="Ajouter aux tags validés" title="Ajouter aux tags validés">${validateIcon}</button>
        <button class="btn btn-muted tags-selection-row-btn tags-selection-row-btn-danger" type="button" data-tags-action="blacklist-library" aria-label="Blacklister ce tag" title="Blacklister ce tag">${blacklistIcon}</button>
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
      .filter((row) => dom.getByData?.('tagsCheckbox', null, row)?.checked)
      .map((row) => ({ row, state: getTagsSelectionRowState(row, rows, libraryState) }))
      .filter(({ state }) => (onlyValid ? state.isRowValid : true))
      .map(({ state }) => state.value)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' }));
  }

  function getAllGeneratedTagValues() {
    return getTagsSelectionRows()
      .filter((row) => String(row?.dataset?.tagsSource || 'generated') === 'generated')
      .map((row) => getTagsSelectionRowValue(row))
      .filter(Boolean);
  }

  function copyTagsSelectionValues(values, successMessage) {
    navigator.clipboard.writeText(values.join(', '));
    global.showToast(successMessage);
  }

  function copyAllGeneratedTags() {
    const values = getAllGeneratedTagValues();
    if (!values.length) {
      global.showToast('Aucun tag généré à copier', '#ff4757');
      return;
    }

    copyTagsSelectionValues(values, 'Tous les tags générés copiés');
  }

  function updateTagsSelectionSummary() {
    const p = getPfx();
    const rows = getTagsSelectionRows();
    const libraryState = getTagLibraryState();
    let checkedCount = 0;
    let validSelectedCount = 0;
    let invalidSelectedCount = 0;
    const semanticGroups = getSelectedSemanticDuplicates(rows);

    rows.forEach((row) => {
      const rowState = getTagsSelectionRowState(row, rows, libraryState);
      const checkbox = dom.getByData?.('tags-checkbox', null, row);
      const lengthNode = dom.getByData?.('tagsLength', null, row);
      const isChecked = Boolean(checkbox?.checked);
      const semanticDuplicatePeer = isChecked && !rowState.hasDuplicateError
        ? getSemanticDuplicatePeer(row, semanticGroups)
        : '';
      const hasSemanticDuplicate = Boolean(semanticDuplicatePeer);

      row.classList.toggle('is-checked', isChecked);
      row.classList.toggle('is-invalid', !rowState.isRowValid);
      row.classList.toggle('is-semantic-duplicate', hasSemanticDuplicate);
      row.classList.toggle('is-library-validated', rowState.isValidated);
      row.classList.toggle('is-library-blacklisted', rowState.isExactBlacklisted || Boolean(rowState.matchedTerm));
      row.dataset.tagsValid = rowState.isRowValid ? 'true' : 'false';
      row.dataset.tagsSemanticDuplicate = hasSemanticDuplicate ? 'true' : 'false';

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
      } else if (hasSemanticDuplicate) {
        rowTitle = `Tag proche déjà sélectionné : ${semanticDuplicatePeer}`;
      }
      row.title = rowTitle;

      if (isChecked) {
        checkedCount += 1;
        if (rowState.isRowValid) validSelectedCount += 1;
        else invalidSelectedCount += 1;
      }
    });

    const runtimeRoot = getTagsSelectionRuntimeRoot();
    const summaryNodes = {
      total: dom.getByData?.('tagsStat', 'total', runtimeRoot) || document.getElementById(`${p}-tags-stat-total`),
      selected: dom.getByData?.('tagsStat', 'selected', runtimeRoot) || document.getElementById(`${p}-tags-stat-selected`),
      valid: dom.getByData?.('tagsStat', 'valid', runtimeRoot) || document.getElementById(`${p}-tags-stat-valid`),
      invalid: dom.getByData?.('tagsStat', 'invalid', runtimeRoot) || document.getElementById(`${p}-tags-stat-invalid`),
      counter: dom.getByData?.('tagsSelectedCounter', null, runtimeRoot) || document.getElementById(`${p}-tags-selected-counter`),
    };

    if (summaryNodes.total) summaryNodes.total.textContent = String(rows.length);
    if (summaryNodes.selected) summaryNodes.selected.textContent = `${checkedCount} / ${TAG_SELECTION_MAX}`;
    if (summaryNodes.valid) summaryNodes.valid.textContent = String(validSelectedCount);
    if (summaryNodes.invalid) summaryNodes.invalid.textContent = String(invalidSelectedCount);
    if (summaryNodes.counter) summaryNodes.counter.textContent = `${checkedCount} sélectionné(s)`;

    const validateButton = dom.getByData?.('tagsValidateButton', null, getTagsSelectionZone()) || document.getElementById(`${p}-validate-tags`);
    if (validateButton) {
      validateButton.disabled = checkedCount === 0 || checkedCount > TAG_SELECTION_MAX || invalidSelectedCount > 0;
    }

    global.PipelineUIRender.syncTagsOutputFromUI();
  }

  function bindTagsSelectionEvents() {
    const zone = getTagsSelectionZone();
    if (!zone || zone.dataset.tagsUiBound === 'true') return;

    zone.dataset.tagsUiBound = 'true';

    zone.addEventListener('change', (event) => {
      const checkbox = dom.getClosestByData?.(event.target, 'tags-checkbox');
      if (!checkbox || checkbox !== event.target) return;

      if (event.target.checked) {
        const checkedCount = getTagsSelectionRows().filter((row) => dom.getByData?.('tags-checkbox', null, row)?.checked).length;
        if (checkedCount > TAG_SELECTION_MAX) {
          event.target.checked = false;
          global.showToast(`Tu ne peux pas sélectionner plus de ${TAG_SELECTION_MAX} tags.`, '#ff4757');
        }
      }

      updateTagsSelectionSummary();
    });

    zone.addEventListener('input', (event) => {
      const input = dom.getClosestByData?.(event.target, 'tags-input');
      if (!input || input !== event.target) return;
      updateTagsSelectionSummary();
    });

    zone.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-tags-action], [data-tags-copy]');
      if (!button) return;

      if (button.dataset.tagsCopy) {
        copyAllGeneratedTags();
        return;
      }

      const row = dom.getClosestByData?.(button, 'tags-item');
      const rowValue = getTagsSelectionRowValue(row);
      if (!rowValue) {
        global.showToast('Tag vide : impossible de lancer cette action', '#ff4757');
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
      const validateButton = dom.getByData?.('tagsValidateButton', null, zone) || document.getElementById(`${p}-validate-tags`);
      if (validateButton) validateButton.disabled = true;
      return;
    }

    const [commonLeftColumn, commonRightColumn] = splitTagsIntoColumns(COMMON_PRODUCT_TAGS);
    const [leftColumn, rightColumn] = splitTagsIntoColumns(tags);
    const commonTagStartIndex = tags.length;

    runtimeRoot.innerHTML = `
      <div class="tags-selection-shell">
        <div class="tags-selection-topbar">
          <div class="tags-selection-heading">
            <div class="tags-selection-title">Selection manuelle</div>
            <div class="tags-selection-subtitle">2 colonnes · ${TAG_SELECTION_MAX} tags max · une ligne par tag.</div>
          </div>
          <div class="tags-selection-toolbar">
            <button class="btn btn-accent" type="button" data-tags-copy="all">Copier tous les tags</button>
          </div>
        </div>
        <div class="tags-selection-stats">
          <div class="tags-selection-stat">
            <span class="tags-selection-stat-label">Candidats</span>
            <span class="tags-selection-stat-value" id="${p}-tags-stat-total" data-tags-stat="total">0</span>
          </div>
          <div class="tags-selection-stat">
            <span class="tags-selection-stat-label">Sélection</span>
            <span class="tags-selection-stat-value" id="${p}-tags-stat-selected" data-tags-stat="selected">0 / ${TAG_SELECTION_MAX}</span>
          </div>
          <div class="tags-selection-stat">
            <span class="tags-selection-stat-label">Valides</span>
            <span class="tags-selection-stat-value" id="${p}-tags-stat-valid" data-tags-stat="valid">0</span>
          </div>
          <div class="tags-selection-stat">
            <span class="tags-selection-stat-label">Invalides</span>
            <span class="tags-selection-stat-value" id="${p}-tags-stat-invalid" data-tags-stat="invalid">0</span>
          </div>
        </div>
        <section class="tags-selection-common">
          <div class="tags-selection-common-head">
            <span class="tags-selection-common-title">Tronc commun à toutes les fiches produits</span>
            <span class="tags-selection-common-meta">Sélection manuelle prioritaire</span>
          </div>
          <div class="tags-selection-columns tags-selection-columns-common">
            <section class="tags-selection-column">
              <div class="tags-selection-list">${commonLeftColumn.map((tag, index) => buildTagsSelectionRowMarkup(tag, commonTagStartIndex + index, 'common')).join('')}</div>
            </section>
            <section class="tags-selection-column">
              <div class="tags-selection-list">${commonRightColumn.map((tag, index) => buildTagsSelectionRowMarkup(tag, commonTagStartIndex + commonLeftColumn.length + index, 'common')).join('')}</div>
            </section>
          </div>
        </section>
        <div class="tags-selection-columns">
          <section class="tags-selection-column" id="${p}-tags-column-1" data-tags-column="1">
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
            <div class="tags-selection-list">${leftColumn.map((tag, index) => buildTagsSelectionRowMarkup(tag, index, 'generated')).join('')}</div>
          </section>
          <section class="tags-selection-column" id="${p}-tags-column-2" data-tags-column="2">
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
            <div class="tags-selection-list">${rightColumn.map((tag, index) => buildTagsSelectionRowMarkup(tag, index + leftColumn.length, 'generated')).join('')}</div>
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
    modals().ensureLibraryModals();
    modals().ensureTagsManualAddButton();
    bindTagsSelectionEvents();
    updateTagsSelectionSummary();

    const exploreBtn = getSelectionExplorerButton('tags');
    if (exploreBtn) exploreBtn.disabled = false;
  }

  async function validateTag(tag) {
    const parsed = global.parseBiblioTags(global.getBiblio('tags'));
    const validated = parsed.validated || [];
    const blacklisted = parsed.blacklisted || [];
    const normalizedTag = normalizeTagInputValue(tag);

    if (!normalizedTag) return;

    if (validated.some((entry) => helpers().sameTag ? helpers().sameTag(entry, normalizedTag) : entry === normalizedTag)) {
      global.showToast('Déjà validé');
      return;
    }

    validated.push(normalizedTag);
    const updated = global.buildBiblioTagsRaw(validated, blacklisted);
    try {
      const res = await fetch(`/files/biblios/${global.currentMode}/tags.md`, { method: 'PUT', body: updated });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      global.state.bibliosByMode[global.currentMode].tags = updated;
      document.dispatchEvent(new CustomEvent('pipeline:tags-library-updated'));
      global.showToast(`"${normalizedTag}" validé`);
    } catch (error) {
      global.showToast('Erreur sauvegarde', '#ff4757');
    }
  }

  async function invalidateTag(tag, itemId = null, source = 'main') {
    modals().openLibraryBlacklistModal({
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
      const checkbox = dom.getByData?.('tags-checkbox', null, row);
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
    global.setPipelineRunEntry(p, agentId, finalCsv, { quality: 'net', validation: 'valide', origin: 'manuel', sourceAgentId: agentId });
    persistPipelineSeedSnapshot(p);
    global.PipelineUIRender.syncSelectionField('tags', finalCsv, p);
    global.PipelineUIRender.syncFinalPre('tags', finalCsv, p);

    const zone = getTagsSelectionZone();
    const status = document.getElementById(`${p}-stat-${agentId}`);
    if (zone) {
      zone.style.display = 'block';
      zone.classList.add('is-validated');
    }
    if (status) {
      status.textContent = 'sélection validée';
      status.className = 'agent-status s-done';
    }

    await continueAfterSelection(agentId);
  }

  function getCharTone(chars, thresholds = {}) {
    const {
      danger = 140,
      success = 128,
      accent = 110,
    } = thresholds;

    if (chars > danger) return 'danger';
    if (chars >= success) return 'success';
    if (chars >= accent) return 'accent';
    return 'muted';
  }

  function buildExplorerTagMarkup(tag, index) {
    const itemId = `exp-tag-${index}`;
    const safeTag = escapeAttr(tag);
    const validateIcon = global.PipelineUIIcons?.renderIcon('check') || 'Valider';
    const blacklistIcon = global.PipelineUIIcons?.renderIcon('close') || 'Blacklister';
    const rerollIcon = global.PipelineUIIcons?.renderIcon('refresh') || 'Relancer';
    return `<div class="titre-item" id="${itemId}" data-selection-item="tag-explorer">
        <span class="titre-text" data-selection-text-node>${tag}</span>
        <span class="titre-char" data-selection-char data-char-tone="${tag.length > 30 ? 'danger' : 'success'}">${tag.length}</span>
        <div class="titre-actions">
          <button class="titre-thumb" type="button" data-selection-role="validate" data-selection-action="validate-tag-explorer" data-selection-text="${safeTag}" data-item-id="${itemId}">${validateIcon}</button>
          <button class="titre-thumb" type="button" data-selection-role="blacklist" data-selection-action="blacklist-tag-explorer" data-selection-text="${safeTag}" data-item-id="${itemId}">${blacklistIcon}</button>
          <button class="titre-thumb" type="button" data-selection-role="reroll" data-selection-action="reroll-tag-explorer" data-selection-text="${safeTag}" data-item-id="${itemId}">${rerollIcon}</button>
        </div>
      </div>`;
  }

  function buildTitreSelectionItemMarkup(text, chars, agentId, index) {
    const itemId = `${getPfx()}-ti-${agentId}-${index}`;
    const safeText = escapeAttr(text);
    return `<div class="titre-item" id="${itemId}" data-selection-item="titre" data-item-id="${itemId}" data-selection-action="select-titre" data-selection-index="${index}" data-agent-id="${agentId}">
      <input class="titre-radio-input" type="radio" name="titre-${agentId}" />
      <span class="titre-text" data-selection-text-node>${text}</span>
      <span class="titre-char" data-selection-char data-char-tone="${getCharTone(chars)}">${chars}</span>
      <div class="titre-actions">
        <button class="titre-copy" type="button" data-selection-role="copy" data-selection-action="copy-titre-line" data-selection-text="${safeText}" aria-label="Copier ce titre">Copier</button>
        <button class="titre-copy" type="button" data-selection-role="reroll" data-selection-action="reroll-titre-segment" data-selection-text="${safeText}" data-item-id="${itemId}" data-agent-id="${agentId}" aria-label="Regenerer ce titre">Relance</button>
      </div></div>`;
  }

  function buildChoiceItemMarkup(type, agentId, choice) {
    return `<div class="choice-item" data-selection-item="choice" data-selection-action="select-choice" data-selection-type="${type}" data-agent-id="${agentId}" data-selection-num="${choice.num}">
      <input type="radio" name="${type === 'accroche' ? 'acc' : 'cta'}-${agentId}"/>
      <label>${choice.text}</label>
    </div>`;
  }

  function buildExplorerTitreMarkup(titre, index) {
    const itemId = `exp-titre-${index}`;
    const safeText = escapeAttr(titre.text);
    return `<div class="titre-item" id="${itemId}" data-selection-item="titre-explorer" data-item-id="${itemId}">
        <span class="titre-text" data-selection-text-node>${titre.text}</span>
        <span class="titre-char" data-selection-char data-char-tone="${getCharTone(titre.chars)}">${titre.chars}</span>
        <div class="titre-actions">
          <button class="titre-copy" type="button" data-selection-role="copy" data-selection-action="copy-titre-line" data-selection-text="${safeText}" aria-label="Copier ce titre">Copier</button>
          <button class="titre-copy" type="button" data-selection-role="reroll" data-selection-action="reroll-titre-explorer" data-selection-text="${safeText}" data-item-id="${itemId}" data-agent-id="titre" aria-label="Regenerer ce titre">Relance</button>
        </div>
      </div>`;
  }

  function bindSelectionDelegation() {
    if (selectionDelegationBound) return;

    document.addEventListener('click', async (event) => {
      const trigger = dom.getClosestByData?.(event.target, 'selectionAction');
      if (!trigger || trigger.disabled) return;

      const action = String(trigger.dataset.selectionAction || '').trim();
      const item = getSelectionItem(trigger);

      if (action === 'validate-tag-explorer') {
        await validateTag(getSelectionText(trigger));
        item?.classList.add('validated');
        return;
      }
      if (action === 'blacklist-tag-explorer') {
        item?.classList.add('invalidated');
        await invalidateTag(getSelectionText(trigger), trigger.dataset.itemId || null, 'explorer');
        return;
      }
      if (action === 'reroll-tag-explorer') {
        global.PipelineUITags?.rerollTag?.(getSelectionText(trigger), trigger.dataset.itemId || '');
        return;
      }
      if (action === 'select-titre') {
        selectTitre(Number(trigger.dataset.selectionIndex || 0), trigger.dataset.agentId || 'titre', trigger);
        return;
      }
      if (action === 'reroll-titre-segment' || action === 'reroll-titre-explorer') {
        titlesApi().rerollTitre?.(
          getSelectionText(trigger),
          trigger.dataset.itemId || '',
          trigger.dataset.agentId || 'titre'
        );
        return;
      }
      if (action === 'copy-titre-line') {
        copyTitreLine(getSelectionText(trigger));
        return;
      }
      if (action === 'paste-selected-titre') {
        pasteSelectedTitre(trigger.dataset.agentId || 'titre');
        return;
      }
      if (action === 'select-choice') {
        selectChoice(
          trigger.dataset.selectionType || 'accroche',
          trigger.dataset.agentId || '',
          trigger.dataset.selectionNum || '',
          trigger
        );
        return;
      }
      if (action === 'run-tag-explorer') {
        runTagExplorer();
        return;
      }
      if (action === 'run-titre-explorer') {
        runTitreExplorer();
      }
    });

    document.addEventListener('input', (event) => {
      const trigger = dom.getClosestByData?.(event.target, 'selectionInput', 'titre-counter');
      if (!trigger || trigger !== event.target) return;
      updateTitreCounter(trigger.dataset.agentId || 'titre');
    });

    selectionDelegationBound = true;
  }

  async function runTagExplorer() {
    const p = getPfx();
    const btn = getSelectionExplorerButton('tags');
    if (btn) {
      btn.disabled = true;
      global.PipelineUIIcons?.setIconLabel?.(btn, 'refresh', 'Exploration...');
    }

    const ctx = global.buildCtx('tags');
    const prompt = global.buildPrompt('tags', ctx);
    const cacheKey = buildAuxiliaryPromptKey('tags-explorer', prompt.filled, prompt.fixedContent);

    try {
      const { text: result, cached } = await runCachedAuxiliaryPrompt('aux-explorer', cacheKey, async () => {
        const response = await global.callClaude('tags', {
          filled: prompt.filled,
          fixedContent: prompt.fixedContent,
        }, false, AUXILIARY_RETRY_COUNT);
        return { text: response.text };
      });

      const tags = helpers().parseTagOutput ? helpers().parseTagOutput(result) : [];
      const libraryState = getTagLibraryState();
      const filteredTags = filterExplorerTags(tags, libraryState);
      const excludedCount = tags.length - filteredTags.length;

      const explorerNodes = getExplorerNodes();
      if (explorerNodes.title) explorerNodes.title.textContent = 'Exploration tags';
      if (explorerNodes.count) explorerNodes.count.textContent = `${filteredTags.length} tags`;
      if (explorerNodes.listLabel) explorerNodes.listLabel.textContent = 'Tags générés hors biblio — valider, blacklister ou relancer';
      if (explorerNodes.conversation) explorerNodes.conversation.value = result;

      modals().ensureLibraryModals();
      modals().ensureExplorerManualAddButton('tags');

      const list = explorerNodes.list;
      if (list) list.innerHTML = filteredTags.length
        ? filteredTags.map((tag, i) => buildExplorerTagMarkup(tag, i)).join('')
        : '<div class="titre-item"><span class="titre-text">Aucun tag exploitable hors biblio.</span></div>';

      explorerNodes.root?.classList.add('visible');
      global.showToast(excludedCount > 0 ? `Exploration terminée (${excludedCount} exclus via biblio)` : 'Exploration terminée', '#e8c547');
    } catch (error) {
      global.showToast(`Erreur: ${error.message}`, '#ff4757');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Explorer';
      }
    }
  }

  function closeExplorer() {
    getExplorerNodes().root?.classList.remove('visible');
  }

  function buildTitreSelectionUI(agentId, output) {
    const p = getPfx();
    const lines = output.split('\n').filter((line) => line.match(/^\d+\.\s+/));
    const zone = getScopedSelectionZone('titre', agentId) || document.getElementById(`${p}-sel-${agentId}`);
    const list = getSelectionList('titre', agentId) || document.getElementById(`${p}-sel-list-${agentId}`);
    if (!zone || !list) return;

    zone.classList.add('visible');
    modals().ensureLibraryModals();
    modals().ensureTitresManualAddButton(agentId);

    list.innerHTML = lines.map((line, i) => {
      const text = line.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '').trim();
      const charMatch = line.match(/\((\d+)\s*car/i);
      const chars = charMatch ? parseInt(charMatch[1], 10) : text.length;
      return buildTitreSelectionItemMarkup(text, chars, agentId, i);
    }).join('');

    const parsed = global.parseBiblioTitres(global.getBiblio('titres'));
    const blacklisted = parsed.blacklisted || [];
    if (blacklisted.length) {
      lines.forEach((line, i) => {
        const text = line.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '').trim();
        const term = helpers().getBlacklistedTerm ? helpers().getBlacklistedTerm(text, blacklisted) : null;
        if (term) {
          const el = getSelectionItemById(`${p}-ti-${agentId}-${i}`);
          if (el) setTimeout(() => titlesApi().autoRegenTitre(text, term, el, agentId), i * 300);
        }
      });
    }
  }

  function selectTitre(i, agentId, el) {
    el.parentElement.querySelectorAll('[data-selection-item="titre"]').forEach((node) => node.classList.remove('selected'));
    el.classList.add('selected');
    const radio = el.querySelector('input');
    if (radio) radio.checked = true;
    const selectedTitre = (dom.getByData?.('selection-text-node', null, el) || el.querySelector('.titre-text'))?.textContent.trim();
    global.state.selectedTitre = selectedTitre;
    const p = getPfx();
    const input = getTitreManualInput(agentId);
    if (input) {
      input.value = selectedTitre;
      updateTitreCounter(agentId);
    }
  }

  function updateTitreCounter(agentId) {
    const p = getPfx();
    const input = getTitreManualInput(agentId);
    const counter = getTitreCounter(agentId);
    if (!input || !counter) return;

    const len = input.value.length;
    counter.textContent = `${len} / 140`;
    counter.style.color = len > 140 ? 'var(--error)' : len > 130 ? 'var(--accent)' : 'var(--muted)';
    input.style.borderColor = len > 140 ? 'var(--error)' : len > 130 ? 'var(--accent)' : '';
  }

  function pasteSelectedTitre(agentId) {
    const p = getPfx();
    if (global.state.selectedTitre) {
      const input = getTitreManualInput(agentId);
      if (input) input.value = global.state.selectedTitre;
      updateTitreCounter(agentId);
    }
  }

  function copyTitreLine(text) {
    navigator.clipboard.writeText(text);
    global.showToast('Titre copié');
  }

  async function validateTitre(agentId) {
    const p = getPfx();
    const input = getTitreManualInput(agentId);
    const titre = input?.value.trim() || '';
    if (!titre) {
      alert('Choisis ou saisis un titre.');
      return;
    }

    global.state.selectedTitre = titre;
    global.state.outputs.titre_valide = titre;
    global.setPipelineRunEntry(p, agentId, titre, { quality: 'net', validation: 'valide', origin: 'manuel', sourceAgentId: agentId });
    persistPipelineSeedSnapshot(p);

    document.getElementById(`${p}-sel-${agentId}`).classList.remove('visible');
    document.getElementById(`${p}-stat-${agentId}`).textContent = 'titre validé';
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
        const hasEmoji = /^\p{Extended_Pictographic}/u.test(line);
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
        const hasEmoji = /^\p{Extended_Pictographic}/u.test(line);
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
      const zone = getScopedSelectionZone('accroche', agentId) || document.getElementById(`${p}-sel-accroche-${agentId}`);
      const list = getSelectionList('accroche', agentId) || document.getElementById(`${p}-sel-list-accroche-${agentId}`);
      if (zone && list) {
        zone.classList.add('visible');
        list.innerHTML = accroches.map((choice) => buildChoiceItemMarkup('accroche', agentId, choice)).join('');
      }
    }

    if (ctas.length > 0) {
      const zone = getScopedSelectionZone('cta', agentId) || document.getElementById(`${p}-sel-cta-${agentId}`);
      const list = getSelectionList('cta', agentId) || document.getElementById(`${p}-sel-list-cta-${agentId}`);
      if (zone && list) {
        zone.classList.add('visible');
        list.innerHTML = ctas.map((choice) => buildChoiceItemMarkup('cta', agentId, choice)).join('');
      }
    }
  }

  function selectChoice(type, agentId, num, el) {
    el.parentElement.querySelectorAll('[data-selection-item="choice"]').forEach((node) => node.classList.remove('selected'));
    el.classList.add('selected');
    const radio = el.querySelector('input');
    if (radio) radio.checked = true;
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

    const assembledDescription = result.join('\n').trim();

    global.state.outputs[`${agentId}_assembled`] = assembledDescription;
    global.setPipelineRunEntry(p, agentId, assembledDescription, {
      quality: 'net',
      validation: 'valide',
      origin: 'manuel',
      sourceAgentId: agentId,
    });
    document.getElementById(`${p}-sel-accroche-${agentId}`).classList.remove('visible');
    document.getElementById(`${p}-sel-cta-${agentId}`).classList.remove('visible');
    document.getElementById(`${p}-stat-${agentId}`).textContent = 'sélection validée';
    document.getElementById(`${p}-stat-${agentId}`).className = 'agent-status s-done';

    await continueAfterSelection(agentId);
  }

  async function runTitreExplorer() {
    const p = getPfx();
    const btn = getSelectionExplorerButton('titre');
    if (btn) {
      btn.disabled = true;
      global.PipelineUIIcons?.setIconLabel?.(btn, 'refresh', 'Exploration...');
    }

    const ctx = global.buildCtx('titre');
    const prompt = global.buildPrompt('titre', ctx);
    const explorerPrompt = `${prompt.filled}\n\nMODE EXPLORATION: Génère environ 30 titres. Format : liste numérotée avec compteur de caractères.`;
    const cacheKey = buildAuxiliaryPromptKey('titre-explorer', explorerPrompt, prompt.fixedContent);

    try {
      const { text: result, usage, cached } = await runCachedAuxiliaryPrompt('aux-explorer', cacheKey, async () => {
        const response = await global.callClaude('titre', {
          filled: explorerPrompt,
          fixedContent: prompt.fixedContent,
        }, false, AUXILIARY_RETRY_COUNT);
        return {
          text: response.text,
          usage: response.usage || null,
        };
      });

      if (usage) {
        global.showAgentCost('titre_explorer', usage, { prefix: p, source: 'titre-explorer' });
        global.syncCacheIndicator(usage);
      }

      const lines = result.split('\n').filter((line) => line.match(/^\d+\.\s+/));
      const titres = lines.map((line) => {
        const text = line.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '').trim();
        const charMatch = line.match(/\((\d+)\s*car/i);
        const chars = charMatch ? parseInt(charMatch[1], 10) : text.length;
        return { text, chars };
      });

      const explorerNodes = getExplorerNodes();
      if (explorerNodes.title) explorerNodes.title.textContent = 'Exploration titres';
      if (explorerNodes.count) explorerNodes.count.textContent = `${titres.length} titres`;
      if (explorerNodes.listLabel) explorerNodes.listLabel.textContent = 'Titres générés — copier ou relancer';
      if (explorerNodes.conversation) explorerNodes.conversation.value = result;

      modals().ensureLibraryModals();
      modals().ensureExplorerManualAddButton('titres', 'titre');

      const list = explorerNodes.list;
      if (list) list.innerHTML = titres.map((titre, i) => buildExplorerTitreMarkup(titre, i)).join('');

      explorerNodes.root?.classList.add('visible');
      global.showToast(cached ? 'Exploration titres reusée depuis la session' : 'Exploration terminée', cached ? '#7eb8f7' : '#e8c547');
    } catch (error) {
      global.showToast(`Erreur: ${error.message}`, '#ff4757');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Explorer';
      }
    }
  }

  bindSelectionDelegation();

  global.PipelineUISelections = {
    getPipelineSeedStorageKey,
    buildPipelineSeedSnapshot,
    persistPipelineSeedSnapshot,
    readPipelineSeedSnapshot,
    clearPipelineSeedSnapshot,
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
