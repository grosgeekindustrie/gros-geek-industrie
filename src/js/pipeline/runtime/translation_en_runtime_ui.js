'use strict';

(function initPipelineUITranslationEnRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};

  const TRANSLATION_MAPPING_AGENT_ID = 'traduction_en';
  const TRANSLATION_LISTING_AGENT_ID = 'traduction_listing_en';
  const TRANSLATION_MAPPING_PROMPT_PATH = 'prompts/traduction/traduction_en.md';
  const TRANSLATION_LISTING_PROMPT_PATH = 'prompts/traduction/traduction_listing_en.md';
  const STORAGE_KEY_PREFIX = 'pipeline.translation.en.';
  const PREFIXES = ['tt', 'col'];
  const TITLE_MAX_LENGTH = 140;
  const TAG_MAX_LENGTH = 30;
  const DEFAULT_MAPPING_OUTPUT = '— pas encore vérifié —';
  const DEFAULT_MAPPING_STATUS = 'En attente d’un check FR -> EN.';
  const DEFAULT_SOURCE_STATUS = 'En attente d’une fiche Etsy source.';
  const DEFAULT_TRANSLATION_OUTPUT = '— pas encore traduit —';
  const DEFAULT_TRANSLATION_STATUS = 'En attente d’une traduction EN.';

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
    state.translationEnByPrefix = state.translationEnByPrefix || {};
    state.translationEnByPrefix[prefix] = state.translationEnByPrefix[prefix] || createEmptyPrefixState();
    const entry = state.translationEnByPrefix[prefix];
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
        activeSubtab: ['en', 'de', 'es'].includes(parsed.activeSubtab) ? parsed.activeSubtab : 'fr',
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

  const updateMappingStateFromFields = (prefix) => {
    const entry = ensurePrefixState(prefix);
    entry.characterFr = getTrimmedValue(prefix, 'translation-en-character-fr');
    entry.universeFr = getTrimmedValue(prefix, 'translation-en-universe-fr');
    entry.characterEn = getTrimmedValue(prefix, 'translation-en-character-en');
    entry.universeEn = getTrimmedValue(prefix, 'translation-en-universe-en');
    persistPrefixState(prefix);
  };

  const setActiveSubtab = (prefix, subtab = 'fr') => {
    const entry = ensurePrefixState(prefix);
    entry.activeSubtab = ['en', 'de', 'es'].includes(subtab) ? subtab : 'fr';
    renderPrefixState(prefix);
    persistPrefixState(prefix);
  };

  const updateListingStateFromFields = (prefix) => {
    const listingDraft = ensurePrefixState(prefix).listingDraft;
    listingDraft.listingRef = getTrimmedValue(prefix, 'translation-en-listing-ref');
    listingDraft.sourceTitle = String(readField(prefix, 'translation-en-source-title')?.value || '');
    listingDraft.sourceDescription = String(readField(prefix, 'translation-en-source-description')?.value || '');
    listingDraft.translatedTitle = String(readField(prefix, 'translation-en-translated-title')?.value || '');
    listingDraft.translatedDescription = String(readField(prefix, 'translation-en-translated-description')?.value || '');
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
    const tagsHost = readField(prefix, `translation-en-${kind}-tags-list`);
    const tagInput = readField(prefix, `translation-en-${kind}-tags-input`);
    const data = getEtsyData();
    const tags = isSource ? listingDraft.sourceTags : listingDraft.translatedTags;
    const pendingInput = isSource ? listingDraft.pendingSourceTagsInput : listingDraft.pendingTranslatedTagsInput;
    const removeAction = isSource ? 'translation-en-source-tag-remove' : 'translation-en-translated-tag-remove';
    const editAction = isSource ? 'translation-en-source-tag-edit' : 'translation-en-translated-tag-edit';
    const emptyLabel = isSource ? 'Aucun tag source pour le moment.' : 'Aucun tag EN genere pour le moment.';
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
      'translation-en-character-fr': entry.characterFr,
      'translation-en-universe-fr': entry.universeFr,
      'translation-en-character-en': entry.characterEn,
      'translation-en-universe-en': entry.universeEn,
      'translation-en-listing-ref': listingDraft.listingRef,
      'translation-en-source-title': listingDraft.sourceTitle,
      'translation-en-source-description': listingDraft.sourceDescription,
      'translation-en-translated-title': listingDraft.translatedTitle,
      'translation-en-translated-description': listingDraft.translatedDescription,
    };

    Object.entries(fieldValues).forEach(([suffix, value]) => {
      const field = readField(prefix, suffix);
      if (field && field.value !== value) field.value = value;
    });

    const mappingOutputNode = readField(prefix, 'out-traduction_en');
    if (mappingOutputNode) {
      mappingOutputNode.textContent = entry.output || DEFAULT_MAPPING_OUTPUT;
      mappingOutputNode.classList.toggle('empty', !String(entry.output || '').trim());
    }

    const mappingStatusNode = readField(prefix, 'translation-en-status');
    if (mappingStatusNode) mappingStatusNode.textContent = entry.status || DEFAULT_MAPPING_STATUS;

    ['fr', 'en', 'de', 'es'].forEach((subtab) => {
      const tabButton = readField(prefix, `translation-subtab-${subtab}`);
      const panel = readField(prefix, `translation-subpanel-${subtab}`);
      const isActive = entry.activeSubtab === subtab;
      if (tabButton) {
        tabButton.classList.toggle('is-active', isActive);
        tabButton.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
      if (panel) {
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
      }
    });

    const sourceStatusNode = readField(prefix, 'translation-en-source-status');
    if (sourceStatusNode) sourceStatusNode.textContent = listingDraft.sourceStatus || DEFAULT_SOURCE_STATUS;

    const translationOutputNode = readField(prefix, 'out-traduction_listing_en');
    if (translationOutputNode) {
      translationOutputNode.textContent = listingDraft.translationOutput || DEFAULT_TRANSLATION_OUTPUT;
      translationOutputNode.classList.toggle('empty', !String(listingDraft.translationOutput || '').trim());
    }

    const translationStatusNode = readField(prefix, 'translation-en-translation-status');
    if (translationStatusNode) translationStatusNode.textContent = listingDraft.translationStatus || DEFAULT_TRANSLATION_STATUS;

    setMetricNode(
      readField(prefix, 'translation-en-source-title-meta'),
      `${listingDraft.sourceTitle.length} / ${TITLE_MAX_LENGTH}`,
      listingDraft.sourceTitle.length <= TITLE_MAX_LENGTH,
    );
    setMetricNode(
      readField(prefix, 'translation-en-translated-title-meta'),
      `${listingDraft.translatedTitle.length} / ${TITLE_MAX_LENGTH}`,
      listingDraft.translatedTitle.length <= TITLE_MAX_LENGTH,
    );

    const sourceTagsMeta = buildTagsMeta(listingDraft.sourceTags);
    setMetricNode(readField(prefix, 'translation-en-source-tags-meta'), sourceTagsMeta.text, sourceTagsMeta.isValid);

    const translatedTagsMeta = buildTagsMeta(listingDraft.translatedTags);
    setMetricNode(readField(prefix, 'translation-en-translated-tags-meta'), translatedTagsMeta.text, translatedTagsMeta.isValid);

    renderTagsList(prefix, 'source');
    renderTagsList(prefix, 'translated');
    syncTextareaHeight(readField(prefix, 'translation-en-source-description'));
    syncTextareaHeight(readField(prefix, 'translation-en-translated-description'));
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

  async function runTranslationEnCheck(prefix = global.pfx()) {
    updateMappingStateFromFields(prefix);
    const entry = ensurePrefixState(prefix);

    if (!entry.characterFr || !entry.universeFr) {
      setMappingStatus(prefix, 'Check impossible : renseigne le personnage FR et l’univers FR.');
      global.showToast('Renseigne le personnage FR et l’univers FR', '#ff4757');
      return;
    }

    const runButton = readField(prefix, 'translation-en-run');
    if (runButton) runButton.disabled = true;

    try {
      await ensurePromptLoaded(TRANSLATION_MAPPING_AGENT_ID, TRANSLATION_MAPPING_PROMPT_PATH);
      const template = String(getPromptCache()[TRANSLATION_MAPPING_AGENT_ID] || '').trim();
      const filled = template
        .replace(/\[\[CHARACTER_FR\]\]/g, entry.characterFr)
        .replace(/\[\[UNIVERSE_FR\]\]/g, entry.universeFr)
        .replace(/\[\[CHARACTER_EN_CURRENT\]\]/g, entry.characterEn)
        .replace(/\[\[UNIVERSE_EN_CURRENT\]\]/g, entry.universeEn);

      entry.lastInput = filled;
      getState().inputs[`${prefix}:${TRANSLATION_MAPPING_AGENT_ID}`] = filled;
      setMappingStatus(prefix, `Verification EN en cours (${getModel(TRANSLATION_MAPPING_AGENT_ID)})...`);

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
        entry.characterEn = String(parsed.character_en || parsed.characterNameEn || entry.characterEn || '').trim();
        entry.universeEn = String(parsed.universe_en || parsed.licenseEn || entry.universeEn || '').trim();
      }

      setMappingStatus(prefix, 'Check FR -> EN termine.');
      renderPrefixState(prefix);
      persistPrefixState(prefix);
      global.showToast('Check traduction EN termine');
    } catch (error) {
      entry.output = '';
      setMappingStatus(prefix, `Erreur check EN : ${error.message}`);
      global.showToast(`Erreur traduction EN: ${error.message}`, '#ff4757');
    } finally {
      if (runButton) runButton.disabled = false;
    }
  }

  async function loadTranslationEnSource(prefix = global.pfx()) {
    updateListingStateFromFields(prefix);
    const entry = ensurePrefixState(prefix);
    const listingDraft = entry.listingDraft;
    const loadButton = readField(prefix, 'translation-en-load-source');
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
      const deEntry = global.PipelineUITranslationDeRuntime?.ensureTranslationDeState?.(prefix);
      if (deEntry) {
        deEntry.characterFr = '';
        deEntry.universeFr = '';
        deEntry.characterEn = '';
        deEntry.universeEn = '';
        deEntry.output = '';
        deEntry.status = '';
        deEntry.lastInput = '';
        deEntry.listingDraft = {
          ...deEntry.listingDraft,
          translatedTitle: '',
          translatedDescription: '',
          translatedTags: [],
          pendingTranslatedTagsInput: '',
          translationOutput: '',
          translationInput: '',
          translationStatus: '',
        };
      }
      const esEntry = global.PipelineUITranslationEsRuntime?.ensureTranslationEsState?.(prefix);
      if (esEntry) {
        esEntry.characterFr = '';
        esEntry.universeFr = '';
        esEntry.characterEn = '';
        esEntry.universeEn = '';
        esEntry.output = '';
        esEntry.status = '';
        esEntry.lastInput = '';
        esEntry.listingDraft = {
          ...esEntry.listingDraft,
          translatedTitle: '',
          translatedDescription: '',
          translatedTags: [],
          pendingTranslatedTagsInput: '',
          translationOutput: '',
          translationInput: '',
          translationStatus: '',
        };
      }
      setSourceStatus(prefix, `Fiche source ${listingId} chargee.`);
      renderPrefixState(prefix);
      persistPrefixState(prefix);
      global.PipelineUITranslationDeRuntime?.renderTranslationDeState?.(prefix);
      global.PipelineUITranslationDeRuntime?.persistTranslationDeState?.(prefix);
      global.PipelineUITranslationEsRuntime?.renderTranslationEsState?.(prefix);
      global.PipelineUITranslationEsRuntime?.persistTranslationEsState?.(prefix);
      global.showToast('Fiche source EN chargee');
    } catch (error) {
      setSourceStatus(prefix, `Lecture Etsy impossible : ${error.message}`);
      global.showToast(`Etsy API : ${error.message}`, '#ff4757');
    } finally {
      if (loadButton) loadButton.disabled = false;
    }
  }

  async function runTranslationEnListing(prefix = global.pfx()) {
    updateMappingStateFromFields(prefix);
    updateListingStateFromFields(prefix);

    const entry = ensurePrefixState(prefix);
    const listingDraft = entry.listingDraft;
    const translateButton = readField(prefix, 'translation-en-translate');
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
        .replace(/\[\[CHARACTER_EN\]\]/g, entry.characterEn)
        .replace(/\[\[UNIVERSE_EN\]\]/g, entry.universeEn)
        .replace(/\[\[SOURCE_TITLE\]\]/g, listingDraft.sourceTitle)
        .replace(/\[\[SOURCE_TAGS\]\]/g, sourceTagsCsv)
        .replace(/\[\[SOURCE_DESCRIPTION\]\]/g, listingDraft.sourceDescription);

      listingDraft.translationInput = filled;
      getState().inputs[`${prefix}:${TRANSLATION_LISTING_AGENT_ID}`] = filled;
      setTranslationStatus(prefix, `Traduction EN en cours (${getModel(TRANSLATION_LISTING_AGENT_ID)})...`);

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
      if (parsed && typeof parsed === 'object') {
        listingDraft.translatedTitle = String(parsed.title_en || parsed.titleEn || '').trim();
        listingDraft.translatedDescription = String(parsed.description_en || parsed.descriptionEn || '');
        const translatedTags = Array.isArray(parsed.tags_en)
          ? parsed.tags_en
          : Array.isArray(parsed.tagsEn)
            ? parsed.tagsEn
            : typeof parsed.tags_en === 'string'
              ? parsed.tags_en.split(',')
              : typeof parsed.tagsEn === 'string'
                ? parsed.tagsEn.split(',')
                : [];
        listingDraft.translatedTags = getEtsyData().normalizeAttributeTags?.(translatedTags) || translatedTags;
        listingDraft.pendingTranslatedTagsInput = '';
      }
      setTranslationStatus(prefix, 'Traduction EN terminee.');
      renderPrefixState(prefix);
      persistPrefixState(prefix);
      global.showToast('Traduction EN terminee');
    } catch (error) {
      listingDraft.translationOutput = '';
      setTranslationStatus(prefix, `Erreur traduction EN : ${error.message}`);
      global.showToast(`Erreur traduction EN: ${error.message}`, '#ff4757');
    } finally {
      if (translateButton) translateButton.disabled = false;
    }
  }

  function copyTranslationEnOutput(prefix = global.pfx()) {
    const output = String(ensurePrefixState(prefix).output || '').trim();
    if (!output) {
      global.showToast('Aucune sortie a copier', '#ff4757');
      return;
    }
    navigator.clipboard.writeText(output);
    global.showToast('Sortie copiee');
  }

  function showTranslationEnInput(prefix = global.pfx()) {
    const raw = String(getState().inputs[`${prefix}:${TRANSLATION_MAPPING_AGENT_ID}`] || '').trim();
    if (!raw) {
      global.showToast("Pas encore d'input brut genere", '#e8c547');
      return;
    }
    document.getElementById('rawInputTitle').textContent = '</> INPUT - Traduction EN';
    document.getElementById('rawInputTextarea').value = raw;
    document.getElementById('rawInputCount').textContent = `${raw.length.toLocaleString()} car.`;
    document.getElementById('rawInputLightbox').classList.add('visible');
  }

  function copyTranslationEnListingOutput(prefix = global.pfx()) {
    const output = String(ensurePrefixState(prefix).listingDraft.translationOutput || '').trim();
    if (!output) {
      global.showToast('Aucune sortie a copier', '#ff4757');
      return;
    }
    navigator.clipboard.writeText(output);
    global.showToast('Sortie copiee');
  }

  function showTranslationEnListingInput(prefix = global.pfx()) {
    const raw = String(ensurePrefixState(prefix).listingDraft.translationInput || '').trim();
    if (!raw) {
      global.showToast("Pas encore d'input brut genere", '#e8c547');
      return;
    }
    document.getElementById('rawInputTitle').textContent = '</> INPUT - Traduction fiche EN';
    document.getElementById('rawInputTextarea').value = raw;
    document.getElementById('rawInputCount').textContent = `${raw.length.toLocaleString()} car.`;
    document.getElementById('rawInputLightbox').classList.add('visible');
  }

  function copyTranslationEnField(prefix = global.pfx(), fieldKey = '') {
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

  function resolveCustomPromptLightboxSpec(id = '') {
    const normalizedId = String(id).trim();
    if (normalizedId === TRANSLATION_MAPPING_AGENT_ID) {
      return {
        label: 'Traduction EN',
        path: TRANSLATION_MAPPING_PROMPT_PATH,
        stateKey: TRANSLATION_MAPPING_AGENT_ID,
      };
    }
    if (normalizedId === TRANSLATION_LISTING_AGENT_ID) {
      return {
        label: 'Traduction fiche EN',
        path: TRANSLATION_LISTING_PROMPT_PATH,
        stateKey: TRANSLATION_LISTING_AGENT_ID,
      };
    }
    return null;
  }

  function bindPrefixInputs(prefix) {
    ['fr', 'en', 'de', 'es'].forEach((subtab) => {
      const button = readField(prefix, `translation-subtab-${subtab}`);
      if (!button || button.dataset.translationSubtabBound === 'true') return;
      button.addEventListener('click', () => setActiveSubtab(prefix, subtab));
      button.dataset.translationSubtabBound = 'true';
    });

    [
      'translation-en-character-fr',
      'translation-en-universe-fr',
      'translation-en-character-en',
      'translation-en-universe-en',
    ].forEach((suffix) => {
      const field = readField(prefix, suffix);
      if (!field || field.dataset.translationEnMappingBound === 'true') return;
      field.addEventListener('input', () => updateMappingStateFromFields(prefix));
      field.dataset.translationEnMappingBound = 'true';
    });

    [
      'translation-en-listing-ref',
      'translation-en-source-title',
      'translation-en-source-description',
      'translation-en-translated-title',
      'translation-en-translated-description',
    ].forEach((suffix) => {
      const field = readField(prefix, suffix);
      if (!field || field.dataset.translationEnListingBound === 'true') return;
      field.addEventListener('input', () => updateListingStateFromFields(prefix));
      if (field.tagName === 'TEXTAREA') {
        field.addEventListener('input', () => syncTextareaHeight(field));
      }
      field.dataset.translationEnListingBound = 'true';
    });

    const tagsInput = readField(prefix, 'translation-en-source-tags-input');
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

    const translatedTagsInput = readField(prefix, 'translation-en-translated-tags-input');
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

  function initTranslationEnPanel(prefix) {
    loadPrefixState(prefix);
    bindPrefixInputs(prefix);
    renderPrefixState(prefix);
  }

  function initAllTranslationEnPanels() {
    PREFIXES.forEach((prefix) => initTranslationEnPanel(prefix));
  }

  global.PipelineUITranslationEnRuntime = {
    TRANSLATION_MAPPING_AGENT_ID,
    TRANSLATION_LISTING_AGENT_ID,
    ensureTranslationEnState: ensurePrefixState,
    initTranslationEnPanel,
    initAllTranslationEnPanels,
    runTranslationEnCheck,
    loadTranslationEnSource,
    runTranslationEnListing,
    copyTranslationEnOutput,
    showTranslationEnInput,
    copyTranslationEnListingOutput,
    copyTranslationEnField,
    showTranslationEnListingInput,
    resolveCustomPromptLightboxSpec,
  };

  global.PipelineUI.translationEn = global.PipelineUI.translationEn || {};
  Object.assign(global.PipelineUI.translationEn, global.PipelineUITranslationEnRuntime);
  Object.assign(global, global.PipelineUITranslationEnRuntime);

  initAllTranslationEnPanels();
})(window);
