'use strict';

(function initPipelineUITranslationEsRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};

  const TRANSLATION_MAPPING_AGENT_ID = 'traduction_es';
  const TRANSLATION_LISTING_AGENT_ID = 'traduction_listing_es';
  const TRANSLATION_MAPPING_PROMPT_PATH = 'prompts/traduction/traduction_es.md';
  const TRANSLATION_LISTING_PROMPT_PATH = 'prompts/traduction/traduction_listing_es.md';
  const STORAGE_KEY_PREFIX = 'pipeline.translation.es.';
  const PREFIXES = ['tt', 'col'];
  const TITLE_MAX_LENGTH = 140;
  const TAG_MAX_LENGTH = 30;
  const DEFAULT_MAPPING_OUTPUT = '— pas encore vérifié —';
  const DEFAULT_MAPPING_STATUS = 'En attente d’un check FR -> ES.';
  const DEFAULT_SOURCE_STATUS = 'En attente d’une fiche Etsy source.';
  const DEFAULT_TRANSLATION_OUTPUT = '— pas encore traduit —';
  const DEFAULT_TRANSLATION_STATUS = 'En attente d’une traduction ES.';

  const getState = () => global.state;
  const getPromptCache = () => {
    const state = getState();
    state.customPrompts = state.customPrompts || {};
    return state.customPrompts;
  };
  const getEtsyRuntime = () => global.PipelineUIEtsyRuntime || {};
  const getEtsyData = () => global.PipelineUIEtsyData || {};
  const getModel = (agentId) => global.getActiveAgentModel?.(agentId) || 'claude-sonnet-4-5';
  const readField = (prefix, suffix) => document.getElementById(`${prefix}-${suffix}`);
  const getTrimmedValue = (prefix, suffix) => readField(prefix, suffix)?.value?.trim?.() || '';
  const getStorageKey = (prefix) => `${STORAGE_KEY_PREFIX}${prefix}`;

  const createEmptyListingDraft = () => ({
    listingRef: '',
    sourceTitle: '',
    sourceDescription: '',
    sourceTags: [],
    pendingSourceTagsInput: '',
    sourceStatus: '',
    translatedTitle: '',
    translatedDescription: '',
    translatedTags: [],
    pendingTranslatedTagsInput: '',
    translationOutput: '',
    translationStatus: '',
    translationInput: '',
    translationDebug: '',
  });

  const createEmptyPrefixState = () => ({
    activeSubtab: 'fr',
    characterFr: '',
    universeFr: '',
    characterEn: '',
    universeEn: '',
    output: '',
    status: '',
    lastInput: '',
    listingDraft: createEmptyListingDraft(),
  });

  const ensurePrefixState = (prefix) => {
    const state = getState();
    state.translationEsByPrefix = state.translationEsByPrefix || {};
    state.translationEsByPrefix[prefix] = state.translationEsByPrefix[prefix] || createEmptyPrefixState();
    const entry = state.translationEsByPrefix[prefix];
    entry.listingDraft = entry.listingDraft || createEmptyListingDraft();
    return entry;
  };

  const persistPrefixState = (prefix) => {
    try {
      localStorage.setItem(getStorageKey(prefix), JSON.stringify(ensurePrefixState(prefix)));
    } catch (error) {}
  };

  const loadPrefixState = (prefix) => {
    const entry = ensurePrefixState(prefix);
    try {
      const parsed = JSON.parse(localStorage.getItem(getStorageKey(prefix)) || '{}');
      Object.assign(entry, {
        activeSubtab: parsed.activeSubtab === 'es' ? 'es' : 'fr',
        characterFr: String(parsed.characterFr || ''),
        universeFr: String(parsed.universeFr || ''),
        characterEn: String(parsed.characterEn || ''),
        universeEn: String(parsed.universeEn || ''),
        output: String(parsed.output || ''),
        status: String(parsed.status || ''),
        lastInput: String(parsed.lastInput || ''),
      });
      const listingDraft = parsed.listingDraft && typeof parsed.listingDraft === 'object'
        ? parsed.listingDraft
        : {};
      entry.listingDraft = {
        ...createEmptyListingDraft(),
        listingRef: String(listingDraft.listingRef || ''),
        sourceTitle: String(listingDraft.sourceTitle || ''),
        sourceDescription: String(listingDraft.sourceDescription || ''),
        sourceTags: Array.isArray(listingDraft.sourceTags)
          ? listingDraft.sourceTags.map((value) => String(value || '').trim()).filter(Boolean)
          : [],
        pendingSourceTagsInput: String(listingDraft.pendingSourceTagsInput || ''),
        sourceStatus: String(listingDraft.sourceStatus || ''),
        translatedTitle: String(listingDraft.translatedTitle || ''),
        translatedDescription: String(listingDraft.translatedDescription || ''),
        translatedTags: Array.isArray(listingDraft.translatedTags)
          ? listingDraft.translatedTags.map((value) => String(value || '').trim()).filter(Boolean)
          : [],
        pendingTranslatedTagsInput: String(listingDraft.pendingTranslatedTagsInput || ''),
        translationOutput: String(listingDraft.translationOutput || ''),
        translationStatus: String(listingDraft.translationStatus || ''),
        translationInput: String(listingDraft.translationInput || ''),
        translationDebug: String(listingDraft.translationDebug || ''),
      };
    } catch (error) {}
    return entry;
  };

  const ensurePromptLoaded = async (agentId, promptPath) => {
    const prompts = getPromptCache();
    if (prompts[agentId]) return prompts[agentId];

    const res = await fetch(`/files/${promptPath}`);
    if (!res.ok) throw new Error((await res.json()).error);
    prompts[agentId] = await res.text();
    return prompts[agentId];
  };

  const normalizeJsonBlock = (rawText = '') => {
    const trimmed = String(rawText || '').trim();
    if (!trimmed) return '';
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return fencedMatch ? String(fencedMatch[1] || '').trim() : trimmed;
  };

  const parseAgentOutput = (rawText = '') => {
    const jsonText = normalizeJsonBlock(rawText);
    if (!jsonText) return null;
    try {
      return JSON.parse(jsonText);
    } catch (error) {
      return null;
    }
  };

  const extractLooseJsonString = (rawText = '', key = '') => {
    const match = String(rawText || '').match(new RegExp(`"${key}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`, 'is'));
    if (!match) return '';
    try {
      return JSON.parse(String(match[1] || ''));
    } catch (error) {
      return String(match[1] || '')
        .replace(/^"/, '')
        .replace(/"$/, '')
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .trim();
    }
  };

  const extractLooseJsonTags = (rawText = '', key = '') => {
    const match = String(rawText || '').match(new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'i'));
    if (!match) return [];
    return String(match[1] || '')
      .split(',')
      .map((chunk) => String(chunk || '').trim().replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '"'))
      .filter(Boolean);
  };

  const extractTranslationFields = (rawText = '') => {
    const parsed = parseAgentOutput(rawText);
    if (parsed && typeof parsed === 'object') {
      const tags = Array.isArray(parsed.tags_es)
        ? parsed.tags_es
        : Array.isArray(parsed.tagsEs)
          ? parsed.tagsEs
          : Array.isArray(parsed.tags)
            ? parsed.tags
            : typeof parsed.tags_es === 'string'
              ? parsed.tags_es.split(',')
              : typeof parsed.tagsEs === 'string'
                ? parsed.tagsEs.split(',')
                : typeof parsed.tags === 'string'
                  ? parsed.tags.split(',')
                  : [];
      return {
        title: String(parsed.title_es || parsed.titleEs || parsed.title || parsed.title_en || parsed.titleEn || '').trim(),
        description: String(parsed.description_es || parsed.descriptionEs || parsed.description || parsed.description_en || parsed.descriptionEn || ''),
        tags,
      };
    }

    return {
      title: extractLooseJsonString(rawText, 'title_es') || extractLooseJsonString(rawText, 'title'),
      description: extractLooseJsonString(rawText, 'description_es') || extractLooseJsonString(rawText, 'description'),
      tags: extractLooseJsonTags(rawText, 'tags_es').length
        ? extractLooseJsonTags(rawText, 'tags_es')
        : extractLooseJsonTags(rawText, 'tags'),
    };
  };

  const updateMappingStateFromFields = (prefix) => {
    const entry = ensurePrefixState(prefix);
    entry.characterFr = getTrimmedValue(prefix, 'translation-es-character-fr');
    entry.universeFr = getTrimmedValue(prefix, 'translation-es-universe-fr');
    entry.characterEn = getTrimmedValue(prefix, 'translation-es-character-en');
    entry.universeEn = getTrimmedValue(prefix, 'translation-es-universe-en');
    persistPrefixState(prefix);
  };

  const updateListingStateFromFields = (prefix) => {
    const listingDraft = ensurePrefixState(prefix).listingDraft;
    listingDraft.listingRef = getTrimmedValue(prefix, 'translation-en-listing-ref');
    listingDraft.sourceTitle = String(readField(prefix, 'translation-en-source-title')?.value || '');
    listingDraft.sourceDescription = String(readField(prefix, 'translation-en-source-description')?.value || '');
    listingDraft.translatedTitle = String(readField(prefix, 'translation-es-translated-title')?.value || '');
    listingDraft.translatedDescription = String(readField(prefix, 'translation-es-translated-description')?.value || '');
    persistPrefixState(prefix);
  };

  const escapeHtml = (value = '') => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const syncTextareaHeight = (element) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.max(element.scrollHeight, 320)}px`;
  };

  const buildTagsMeta = (tags = []) => {
    const normalizedTags = Array.isArray(tags) ? tags : [];
    const overLimitCount = normalizedTags.filter((tag) => String(tag || '').length > TAG_MAX_LENGTH).length;
    return {
      text: `${normalizedTags.length} tag(s) · ${overLimitCount} hors limite`,
      isValid: overLimitCount === 0,
    };
  };

  const setMetricNode = (node, text, isValid) => {
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('translation-en-metric-ok', Boolean(isValid));
    node.classList.toggle('translation-en-metric-over', !isValid);
  };

  const renderTagsList = (prefix, kind) => {
    const listingDraft = ensurePrefixState(prefix).listingDraft;
    const isSource = kind === 'source';
    const tagsHost = readField(prefix, `translation-es-${kind}-tags-list`);
    const tagInput = readField(prefix, `translation-es-${kind}-tags-input`);
    const data = getEtsyData();
    const tags = isSource ? listingDraft.sourceTags : listingDraft.translatedTags;
    const pendingInput = isSource ? listingDraft.pendingSourceTagsInput : listingDraft.pendingTranslatedTagsInput;
    const removeAction = isSource ? 'translation-es-source-tag-remove' : 'translation-es-translated-tag-remove';
    const editAction = isSource ? 'translation-es-source-tag-edit' : 'translation-es-translated-tag-edit';
    const emptyLabel = isSource ? 'Aucun tag source pour le moment.' : 'Aucun tag ES genere pour le moment.';
    if (!tagsHost) return;

    if (tagInput && tagInput.value !== pendingInput) {
      tagInput.value = pendingInput || '';
    }

    tagsHost.innerHTML = tags.length
      ? tags.map((tag, index) => `
        <div class="etsy-api-attribute-tag-item">
          <input
            type="text"
            maxlength="${data.ETSY_MAX_TAG_LENGTH || 30}"
            data-js="${editAction}"
            data-prefix="${prefix}"
            data-tag-index="${index}"
            class="${String(tag || '').length > TAG_MAX_LENGTH ? 'translation-en-tag-over' : ''}"
            value="${escapeHtml(tag)}"
          />
          <button class="etsy-api-attribute-tag-remove" type="button" data-js="${removeAction}" data-prefix="${prefix}" data-tag-index="${index}" aria-label="Supprimer le tag">
            ${global.PipelineUIIcons?.renderIcon?.('close') || 'x'}
          </button>
        </div>
      `).join('')
      : `<p class="etsy-api-attributes-empty">${emptyLabel}</p>`;

    tagsHost.querySelectorAll(`[data-js="${removeAction}"]`).forEach((button) => {
      button.addEventListener('click', () => {
        const tagIndex = Number.parseInt(String(button.dataset.tagIndex || '-1'), 10);
        if (tagIndex < 0) return;
        const nextTags = tags.filter((_, index) => index !== tagIndex);
        if (isSource) {
          listingDraft.sourceTags = nextTags;
        } else {
          listingDraft.translatedTags = nextTags;
        }
        persistPrefixState(prefix);
        renderTagsList(prefix, kind);
      });
    });

    tagsHost.querySelectorAll(`[data-js="${editAction}"]`).forEach((input) => {
      input.addEventListener('input', (event) => {
        const tagIndex = Number.parseInt(String(input.dataset.tagIndex || '-1'), 10);
        if (tagIndex < 0) return;
        const targetTags = isSource ? listingDraft.sourceTags : listingDraft.translatedTags;
        targetTags[tagIndex] = String(event.target.value || '').slice(0, data.ETSY_MAX_TAG_LENGTH || 30);
        persistPrefixState(prefix);
      });
      input.addEventListener('blur', (event) => {
        const tagIndex = Number.parseInt(String(input.dataset.tagIndex || '-1'), 10);
        if (tagIndex < 0) return;
        const normalized = data.normalizeAttributeTag?.(event.target.value || '') || '';
        let targetTags = isSource ? [...listingDraft.sourceTags] : [...listingDraft.translatedTags];
        if (!normalized) {
          targetTags = targetTags.filter((_, index) => index !== tagIndex);
        } else {
          targetTags[tagIndex] = normalized;
        }
        targetTags = data.normalizeAttributeTags?.(targetTags || []) || targetTags;
        if (isSource) {
          listingDraft.sourceTags = targetTags;
        } else {
          listingDraft.translatedTags = targetTags;
        }
        persistPrefixState(prefix);
        renderTagsList(prefix, kind);
      });
    });
  };

  const commitSourceTagsInput = (prefix, rawValue) => {
    const listingDraft = ensurePrefixState(prefix).listingDraft;
    const data = getEtsyData();
    const nextTags = data.parseAttributeTagsInput?.(rawValue) || [];
    listingDraft.sourceTags = nextTags;
    listingDraft.pendingSourceTagsInput = '';
    persistPrefixState(prefix);
    renderTagsList(prefix, 'source');
  };

  const commitTranslatedTagsInput = (prefix, rawValue) => {
    const listingDraft = ensurePrefixState(prefix).listingDraft;
    const data = getEtsyData();
    const nextTags = data.parseAttributeTagsInput?.(rawValue) || [];
    listingDraft.translatedTags = nextTags;
    listingDraft.pendingTranslatedTagsInput = '';
    persistPrefixState(prefix);
    renderTagsList(prefix, 'translated');
  };

  const renderPrefixState = (prefix) => {
    const entry = ensurePrefixState(prefix);
    const listingDraft = entry.listingDraft;
    const fieldValues = {
      'translation-es-character-fr': entry.characterFr,
      'translation-es-universe-fr': entry.universeFr,
      'translation-es-character-en': entry.characterEn,
      'translation-es-universe-en': entry.universeEn,
      'translation-es-listing-ref': listingDraft.listingRef,
      'translation-es-source-title': listingDraft.sourceTitle,
      'translation-es-source-description': listingDraft.sourceDescription,
      'translation-es-translated-title': listingDraft.translatedTitle,
      'translation-es-translated-description': listingDraft.translatedDescription,
    };

    Object.entries(fieldValues).forEach(([suffix, value]) => {
      const field = readField(prefix, suffix);
      if (!field) return;
      if (field.tagName === 'TEXTAREA') {
        field.value = value;
        field.defaultValue = value;
        field.textContent = value;
        return;
      }
      if (field.value !== value) field.value = value;
    });

    const mappingOutputNode = readField(prefix, 'out-traduction_es');
    if (mappingOutputNode) {
      mappingOutputNode.textContent = entry.output || DEFAULT_MAPPING_OUTPUT;
      mappingOutputNode.classList.toggle('empty', !String(entry.output || '').trim());
    }

    const mappingStatusNode = readField(prefix, 'translation-es-status');
    if (mappingStatusNode) mappingStatusNode.textContent = entry.status || DEFAULT_MAPPING_STATUS;

    const sourceStatusNode = readField(prefix, 'translation-es-source-status');
    if (sourceStatusNode) sourceStatusNode.textContent = listingDraft.sourceStatus || DEFAULT_SOURCE_STATUS;

    const translationOutputNode = readField(prefix, 'out-traduction_listing_es');
    if (translationOutputNode) {
      translationOutputNode.textContent = listingDraft.translationOutput || DEFAULT_TRANSLATION_OUTPUT;
      translationOutputNode.classList.toggle('empty', !String(listingDraft.translationOutput || '').trim());
    }

    const translationDebugNode = readField(prefix, 'translation-es-debug');
    if (translationDebugNode) {
      translationDebugNode.textContent = String(listingDraft.translationDebug || 'Aucun debug disponible.');
    }

    const translationStatusNode = readField(prefix, 'translation-es-translation-status');
    if (translationStatusNode) translationStatusNode.textContent = listingDraft.translationStatus || DEFAULT_TRANSLATION_STATUS;

    setMetricNode(
      readField(prefix, 'translation-es-source-title-meta'),
      `${listingDraft.sourceTitle.length} / ${TITLE_MAX_LENGTH}`,
      listingDraft.sourceTitle.length <= TITLE_MAX_LENGTH,
    );
    setMetricNode(
      readField(prefix, 'translation-es-translated-title-meta'),
      `${listingDraft.translatedTitle.length} / ${TITLE_MAX_LENGTH}`,
      listingDraft.translatedTitle.length <= TITLE_MAX_LENGTH,
    );

    const sourceTagsMeta = buildTagsMeta(listingDraft.sourceTags);
    setMetricNode(readField(prefix, 'translation-es-source-tags-meta'), sourceTagsMeta.text, sourceTagsMeta.isValid);

    const translatedTagsMeta = buildTagsMeta(listingDraft.translatedTags);
    setMetricNode(readField(prefix, 'translation-es-translated-tags-meta'), translatedTagsMeta.text, translatedTagsMeta.isValid);

    renderTagsList(prefix, 'source');
    renderTagsList(prefix, 'translated');
    syncTextareaHeight(readField(prefix, 'translation-es-source-description'));
    syncTextareaHeight(readField(prefix, 'translation-es-translated-description'));
  };

  const setMappingStatus = (prefix, message) => {
    ensurePrefixState(prefix).status = message;
    renderPrefixState(prefix);
    persistPrefixState(prefix);
  };

  const setSourceStatus = (prefix, message) => {
    ensurePrefixState(prefix).listingDraft.sourceStatus = message;
    renderPrefixState(prefix);
    persistPrefixState(prefix);
  };

  const setTranslationStatus = (prefix, message) => {
    ensurePrefixState(prefix).listingDraft.translationStatus = message;
    renderPrefixState(prefix);
    persistPrefixState(prefix);
  };

  async function runTranslationEsCheck(prefix = global.pfx()) {
    updateMappingStateFromFields(prefix);
    const entry = ensurePrefixState(prefix);

    if (!entry.characterFr || !entry.universeFr) {
      setMappingStatus(prefix, 'Check impossible : renseigne le personnage FR et l’univers FR.');
      global.showToast('Renseigne le personnage FR et l’univers FR', '#ff4757');
      return;
    }

    const runButton = readField(prefix, 'translation-es-run');
    if (runButton) runButton.disabled = true;

    try {
      await ensurePromptLoaded(TRANSLATION_MAPPING_AGENT_ID, TRANSLATION_MAPPING_PROMPT_PATH);
      const template = String(getPromptCache()[TRANSLATION_MAPPING_AGENT_ID] || '').trim();
      const filled = template
        .replace(/\[\[CHARACTER_FR\]\]/g, entry.characterFr)
        .replace(/\[\[UNIVERSE_FR\]\]/g, entry.universeFr)
        .replace(/\[\[CHARACTER_ES_CURRENT\]\]/g, entry.characterEn)
        .replace(/\[\[UNIVERSE_ES_CURRENT\]\]/g, entry.universeEn)
        .replace(/\[\[CHARACTER_EN_CURRENT\]\]/g, entry.characterEn)
        .replace(/\[\[UNIVERSE_EN_CURRENT\]\]/g, entry.universeEn);

      entry.lastInput = filled;
      getState().inputs[`${prefix}:${TRANSLATION_MAPPING_AGENT_ID}`] = filled;
      setMappingStatus(prefix, `Verification ES en cours (${getModel(TRANSLATION_MAPPING_AGENT_ID)})...`);

      const response = await global.callClaude(TRANSLATION_MAPPING_AGENT_ID, {
        filled,
        promptDebug: {
          agentId: TRANSLATION_MAPPING_AGENT_ID,
          promptChars: filled.length,
          fixedBlocks: [],
        },
      }, false);

      entry.output = String(response?.text || '').trim();
      global.showAgentCost?.(TRANSLATION_MAPPING_AGENT_ID, response?.usage || null, { prefix, source: 'translation' });
      global.syncCacheIndicator?.(response?.usage || null);
      const parsed = parseAgentOutput(entry.output);
      if (parsed && typeof parsed === 'object') {
        entry.characterEn = String(parsed.character_es || parsed.characterNameEs || parsed.character_en || parsed.characterNameEn || entry.characterEn || '').trim();
        entry.universeEn = String(parsed.universe_es || parsed.licenseEs || parsed.universe_en || parsed.licenseEn || entry.universeEn || '').trim();
      }

      setMappingStatus(prefix, 'Check FR -> ES termine.');
      renderPrefixState(prefix);
      persistPrefixState(prefix);
      global.showToast('Check traduction ES termine');
    } catch (error) {
      entry.output = '';
      setMappingStatus(prefix, `Erreur check ES : ${error.message}`);
      global.showToast(`Erreur traduction ES: ${error.message}`, '#ff4757');
    } finally {
      if (runButton) runButton.disabled = false;
    }
  }

  async function loadTranslationEsSource(prefix = global.pfx()) {
    updateListingStateFromFields(prefix);
    const entry = ensurePrefixState(prefix);
    const listingDraft = entry.listingDraft;
    const loadButton = readField(prefix, 'translation-es-load-source');
    const extractListingId = getEtsyData().extractListingId;
    const fetchListingPayload = getEtsyRuntime().fetchListingPayload;
    const normalizeListingPayload = getEtsyData().normalizeEtsyListingPayload;

    const listingId = extractListingId?.(listingDraft.listingRef);
    if (!listingId) {
      setSourceStatus(prefix, 'Listing ID introuvable dans la référence fournie.');
      global.showToast('Listing Etsy introuvable', '#ff4757');
      return;
    }

    if (loadButton) loadButton.disabled = true;
    try {
      setSourceStatus(prefix, `Chargement de la fiche source ${listingId}...`);
      const payload = await fetchListingPayload?.(listingId);
      const normalized = normalizeListingPayload?.(payload?.payload || null) || {};
      const data = normalized.data || {};
      const sourceTags = Array.isArray(data.tags)
        ? data.tags
        : typeof data.tags === 'string'
          ? data.tags.split(',')
          : [];
      const normalizedTags = getEtsyData().normalizeAttributeTags?.(sourceTags) || sourceTags;

      listingDraft.sourceTitle = String(data.title || '').trim();
      listingDraft.sourceDescription = String(data.description || '');
      listingDraft.sourceTags = normalizedTags;
      listingDraft.pendingSourceTagsInput = '';
      entry.characterFr = '';
      entry.universeFr = '';
      entry.characterEn = '';
      entry.universeEn = '';
      entry.output = '';
      entry.status = '';
      entry.lastInput = '';
      listingDraft.translatedTitle = '';
      listingDraft.translatedDescription = '';
      listingDraft.translatedTags = [];
      listingDraft.pendingTranslatedTagsInput = '';
      listingDraft.translationOutput = '';
      listingDraft.translationInput = '';
      listingDraft.translationStatus = '';
      entry.activeSubtab = 'fr';
      setSourceStatus(prefix, `Fiche source ${listingId} chargee.`);
      renderPrefixState(prefix);
      persistPrefixState(prefix);
      global.showToast('Fiche source ES chargee');
    } catch (error) {
      setSourceStatus(prefix, `Lecture Etsy impossible : ${error.message}`);
      global.showToast(`Etsy API : ${error.message}`, '#ff4757');
    } finally {
      if (loadButton) loadButton.disabled = false;
    }
  }

  async function runTranslationEsListing(prefix = global.pfx()) {
    updateMappingStateFromFields(prefix);
    updateListingStateFromFields(prefix);

    const entry = ensurePrefixState(prefix);
    const listingDraft = entry.listingDraft;
    const translateButton = readField(prefix, 'translation-es-translate');
    const sharedSourceDraft = global.PipelineUITranslationEnRuntime?.ensureTranslationEnState?.(prefix)?.listingDraft || null;
    if (sharedSourceDraft) {
      listingDraft.listingRef = String(sharedSourceDraft.listingRef || '');
      listingDraft.sourceTitle = String(sharedSourceDraft.sourceTitle || '');
      listingDraft.sourceDescription = String(sharedSourceDraft.sourceDescription || '');
      listingDraft.sourceTags = Array.isArray(sharedSourceDraft.sourceTags) ? [...sharedSourceDraft.sourceTags] : [];
    }
    const sourceTagsCsv = (getEtsyData().normalizeAttributeTags?.(listingDraft.sourceTags || []) || listingDraft.sourceTags || []).join(', ');

    if (!listingDraft.sourceTitle || !listingDraft.sourceDescription || !sourceTagsCsv) {
      setTranslationStatus(prefix, 'Traduction impossible : charge puis complète titre, tags et description source.');
      global.showToast('Titre, tags et description source requis', '#ff4757');
      return;
    }

    if (translateButton) translateButton.disabled = true;
    try {
      await ensurePromptLoaded(TRANSLATION_LISTING_AGENT_ID, TRANSLATION_LISTING_PROMPT_PATH);
      const template = String(getPromptCache()[TRANSLATION_LISTING_AGENT_ID] || '').trim();
      const filled = template
        .replace(/\[\[CHARACTER_FR\]\]/g, entry.characterFr)
        .replace(/\[\[UNIVERSE_FR\]\]/g, entry.universeFr)
        .replace(/\[\[CHARACTER_ES\]\]/g, entry.characterEn)
        .replace(/\[\[UNIVERSE_ES\]\]/g, entry.universeEn)
        .replace(/\[\[CHARACTER_EN\]\]/g, entry.characterEn)
        .replace(/\[\[UNIVERSE_EN\]\]/g, entry.universeEn)
        .replace(/\[\[SOURCE_TITLE\]\]/g, listingDraft.sourceTitle)
        .replace(/\[\[SOURCE_TAGS\]\]/g, sourceTagsCsv)
        .replace(/\[\[SOURCE_DESCRIPTION\]\]/g, listingDraft.sourceDescription);

      listingDraft.translationInput = filled;
      getState().inputs[`${prefix}:${TRANSLATION_LISTING_AGENT_ID}`] = filled;
      setTranslationStatus(prefix, `Traduction ES en cours (${getModel(TRANSLATION_LISTING_AGENT_ID)})...`);

      const response = await global.callClaude(TRANSLATION_LISTING_AGENT_ID, {
        filled,
        promptDebug: {
          agentId: TRANSLATION_LISTING_AGENT_ID,
          promptChars: filled.length,
          fixedBlocks: [],
        },
      }, false);

      listingDraft.translationOutput = String(response?.text || '').trim();
      global.showAgentCost?.(TRANSLATION_LISTING_AGENT_ID, response?.usage || null, { prefix, source: 'translation' });
      global.syncCacheIndicator?.(response?.usage || null);
      const parsed = parseAgentOutput(listingDraft.translationOutput);
      const extracted = extractTranslationFields(listingDraft.translationOutput);
      listingDraft.translatedTitle = String(extracted.title || '').trim();
      listingDraft.translatedDescription = String(extracted.description || '');
      listingDraft.translatedTags = getEtsyData().normalizeAttributeTags?.(extracted.tags || []) || extracted.tags || [];
      listingDraft.pendingTranslatedTagsInput = '';
      const descriptionField = readField(prefix, 'translation-es-translated-description');
      if (descriptionField) {
        descriptionField.value = listingDraft.translatedDescription;
        descriptionField.defaultValue = listingDraft.translatedDescription;
        descriptionField.textContent = listingDraft.translatedDescription;
      }
      listingDraft.translationDebug = JSON.stringify({
        parsedType: parsed ? typeof parsed : 'null',
        parsedKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : [],
        rawLength: String(listingDraft.translationOutput || '').length,
        extractedTitleLength: String(listingDraft.translatedTitle || '').length,
        extractedTagsCount: Array.isArray(listingDraft.translatedTags) ? listingDraft.translatedTags.length : 0,
        extractedDescriptionLength: String(listingDraft.translatedDescription || '').length,
        extractedDescriptionPreview: String(listingDraft.translatedDescription || '').slice(0, 220),
      }, null, 2);
      setTranslationStatus(prefix, 'Traduction ES terminee.');
      renderPrefixState(prefix);
      persistPrefixState(prefix);
      global.showToast('Traduction ES terminee');
    } catch (error) {
      listingDraft.translationOutput = '';
      listingDraft.translationDebug = '';
      setTranslationStatus(prefix, `Erreur traduction ES : ${error.message}`);
      global.showToast(`Erreur traduction ES: ${error.message}`, '#ff4757');
    } finally {
      if (translateButton) translateButton.disabled = false;
    }
  }

  function copyTranslationEsOutput(prefix = global.pfx()) {
    const output = String(ensurePrefixState(prefix).output || '').trim();
    if (!output) {
      global.showToast('Aucune sortie a copier', '#ff4757');
      return;
    }
    navigator.clipboard.writeText(output);
    global.showToast('Sortie copiee');
  }

  function showTranslationEsInput(prefix = global.pfx()) {
    const raw = String(getState().inputs[`${prefix}:${TRANSLATION_MAPPING_AGENT_ID}`] || '').trim();
    if (!raw) {
      global.showToast("Pas encore d'input brut genere", '#e8c547');
      return;
    }
    document.getElementById('rawInputTitle').textContent = '</> INPUT - Traduction ES';
    document.getElementById('rawInputTextarea').value = raw;
    document.getElementById('rawInputCount').textContent = `${raw.length.toLocaleString()} car.`;
    document.getElementById('rawInputLightbox').classList.add('visible');
  }

  function copyTranslationEsListingOutput(prefix = global.pfx()) {
    const output = String(ensurePrefixState(prefix).listingDraft.translationOutput || '').trim();
    if (!output) {
      global.showToast('Aucune sortie a copier', '#ff4757');
      return;
    }
    navigator.clipboard.writeText(output);
    global.showToast('Sortie copiee');
  }

  function showTranslationEsListingInput(prefix = global.pfx()) {
    const raw = String(ensurePrefixState(prefix).listingDraft.translationInput || '').trim();
    if (!raw) {
      global.showToast("Pas encore d'input brut genere", '#e8c547');
      return;
    }
    document.getElementById('rawInputTitle').textContent = '</> INPUT - Traduction fiche ES';
    document.getElementById('rawInputTextarea').value = raw;
    document.getElementById('rawInputCount').textContent = `${raw.length.toLocaleString()} car.`;
    document.getElementById('rawInputLightbox').classList.add('visible');
  }

  function copyTranslationEsField(prefix = global.pfx(), fieldKey = '') {
    const listingDraft = ensurePrefixState(prefix).listingDraft;
    const valueMap = {
      'source-title': listingDraft.sourceTitle,
      'source-tags': (listingDraft.sourceTags || []).join(', '),
      'source-description': listingDraft.sourceDescription,
      'translated-title': listingDraft.translatedTitle,
      'translated-tags': (listingDraft.translatedTags || []).join(', '),
      'translated-description': listingDraft.translatedDescription,
    };
    const value = String(valueMap[String(fieldKey || '').trim()] || '').trim();
    if (!value) {
      global.showToast('Aucune valeur a copier', '#ff4757');
      return;
    }
    navigator.clipboard.writeText(value);
    global.showToast('Valeur copiee');
  }

  function resolveTranslationEsPromptLightboxSpec(id = '') {
    const normalizedId = String(id).trim();
    if (normalizedId === TRANSLATION_MAPPING_AGENT_ID) {
      return {
        label: 'Traduction ES',
        path: TRANSLATION_MAPPING_PROMPT_PATH,
        stateKey: TRANSLATION_MAPPING_AGENT_ID,
      };
    }
    if (normalizedId === TRANSLATION_LISTING_AGENT_ID) {
      return {
        label: 'Traduction fiche ES',
        path: TRANSLATION_LISTING_PROMPT_PATH,
        stateKey: TRANSLATION_LISTING_AGENT_ID,
      };
    }
    return null;
  }

  function bindPrefixInputs(prefix) {
    [
      'translation-es-character-fr',
      'translation-es-universe-fr',
      'translation-es-character-en',
      'translation-es-universe-en',
    ].forEach((suffix) => {
      const field = readField(prefix, suffix);
      if (!field || field.dataset.translationEnMappingBound === 'true') return;
      field.addEventListener('input', () => updateMappingStateFromFields(prefix));
      field.dataset.translationEnMappingBound = 'true';
    });

    [
      'translation-es-listing-ref',
      'translation-es-source-title',
      'translation-es-source-description',
      'translation-es-translated-title',
      'translation-es-translated-description',
    ].forEach((suffix) => {
      const field = readField(prefix, suffix);
      if (!field || field.dataset.translationEnListingBound === 'true') return;
      field.addEventListener('input', () => updateListingStateFromFields(prefix));
      if (field.tagName === 'TEXTAREA') {
        field.addEventListener('input', () => syncTextareaHeight(field));
      }
      field.dataset.translationEnListingBound = 'true';
    });

    const tagsInput = readField(prefix, 'translation-es-source-tags-input');
    if (tagsInput && tagsInput.dataset.translationEnTagsBound !== 'true') {
      tagsInput.addEventListener('input', (event) => {
        ensurePrefixState(prefix).listingDraft.pendingSourceTagsInput = String(event.target.value || '');
        persistPrefixState(prefix);
      });
      tagsInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        commitSourceTagsInput(prefix, event.target.value || '');
      });
      tagsInput.dataset.translationEnTagsBound = 'true';
    }

    const translatedTagsInput = readField(prefix, 'translation-es-translated-tags-input');
    if (translatedTagsInput && translatedTagsInput.dataset.translationEnTagsBound !== 'true') {
      translatedTagsInput.addEventListener('input', (event) => {
        ensurePrefixState(prefix).listingDraft.pendingTranslatedTagsInput = String(event.target.value || '');
        persistPrefixState(prefix);
      });
      translatedTagsInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        commitTranslatedTagsInput(prefix, event.target.value || '');
      });
      translatedTagsInput.dataset.translationEnTagsBound = 'true';
    }
  }

  function initTranslationEsPanel(prefix) {
    loadPrefixState(prefix);
    bindPrefixInputs(prefix);
    renderPrefixState(prefix);
  }

  function initAllTranslationEsPanels() {
    PREFIXES.forEach((prefix) => initTranslationEsPanel(prefix));
  }

  global.PipelineUITranslationEsRuntime = {
    TRANSLATION_MAPPING_AGENT_ID,
    TRANSLATION_LISTING_AGENT_ID,
    ensureTranslationEsState: ensurePrefixState,
    persistTranslationEsState: persistPrefixState,
    renderTranslationEsState: renderPrefixState,
    initTranslationEsPanel,
    initAllTranslationEsPanels,
    runTranslationEsCheck,
    loadTranslationEsSource,
    runTranslationEsListing,
    copyTranslationEsOutput,
    showTranslationEsInput,
    copyTranslationEsListingOutput,
    copyTranslationEsField,
    showTranslationEsListingInput,
    resolveTranslationEsPromptLightboxSpec,
  };

  global.PipelineUI.translationEs = global.PipelineUI.translationEs || {};
  Object.assign(global.PipelineUI.translationEs, global.PipelineUITranslationEsRuntime);
  Object.assign(global, global.PipelineUITranslationEsRuntime);

  const previousCustomPromptResolver = global.resolveCustomPromptLightboxSpec;
  global.resolveCustomPromptLightboxSpec = function resolveCustomPromptLightboxSpec(id = '') {
    return resolveTranslationEsPromptLightboxSpec(id) || previousCustomPromptResolver?.(id) || null;
  };

  initAllTranslationEsPanels();
})(window);


