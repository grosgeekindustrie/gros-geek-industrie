'use strict';

(function initPipelineUITranslationNlRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};

  const TRANSLATION_MAPPING_AGENT_ID = 'traduction_nl';
  const TRANSLATION_LISTING_AGENT_ID = 'traduction_listing_nl';
  const TRANSLATION_MAPPING_PROMPT_PATH = 'prompts/traduction/traduction_nl.md';
  const TRANSLATION_LISTING_PROMPT_PATH = 'prompts/traduction/traduction_listing_nl.md';
  const STORAGE_KEY_PREFIX = 'pipeline.translation.nl.';
  const PREFIXES = ['tt', 'col'];
  const TITLE_MAX_LENGTH = 140;
  const TAG_MAX_LENGTH = 30;
  const TRANSLATION_MODEL = 'claude-sonnet-4-6';
  const DEFAULT_MAPPING_OUTPUT = '— pas encore vérifié —';
  const DEFAULT_MAPPING_STATUS = 'En attente d’un check FR -> NL.';
  const DEFAULT_SOURCE_STATUS = 'En attente d’une fiche Etsy source.';
  const DEFAULT_TRANSLATION_OUTPUT = '— pas encore traduit —';
  const DEFAULT_TRANSLATION_STATUS = 'En attente d’une traduction NL.';

  const getState = () => global.state;
  const getPromptCache = () => {
    const state = getState();
    state.customPrompts = state.customPrompts || {};
    return state.customPrompts;
  };
  const getEtsyRuntime = () => global.PipelineUIEtsyRuntime || {};
  const getEtsyData = () => global.PipelineUIEtsyData || {};
  const getDescriptionAssembly = () => global.PipelineUIDescriptionAssembly || {};
  const getModel = () => TRANSLATION_MODEL;
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
    state.translationNlByPrefix = state.translationNlByPrefix || {};
    state.translationNlByPrefix[prefix] = state.translationNlByPrefix[prefix] || createEmptyPrefixState();
    const entry = state.translationNlByPrefix[prefix];
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
        activeSubtab: parsed.activeSubtab === 'nl' ? 'nl' : 'fr',
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
      if (entry.listingDraft.translatedDescription) {
        entry.listingDraft.translatedDescription = buildInjectedTranslationDescription(
          prefix,
          'nl',
          entry.listingDraft.translatedDescription,
        );
        localStorage.setItem(getStorageKey(prefix), JSON.stringify(entry));
      }
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
      const tags = Array.isArray(parsed.tags_nl)
        ? parsed.tags_nl
        : Array.isArray(parsed.tagsNl)
          ? parsed.tagsNl
          : Array.isArray(parsed.tags)
            ? parsed.tags
            : typeof parsed.tags_nl === 'string'
              ? parsed.tags_nl.split(',')
              : typeof parsed.tagsNl === 'string'
                ? parsed.tagsNl.split(',')
                : typeof parsed.tags === 'string'
                  ? parsed.tags.split(',')
                  : [];
      return {
        title: String(parsed.title_nl || parsed.titleNl || parsed.title || parsed.title_en || parsed.titleEn || '').trim(),
        description: String(parsed.description_nl || parsed.descriptionNl || parsed.description || parsed.description_en || parsed.descriptionEn || ''),
        tags,
      };
    }

    return {
      title: extractLooseJsonString(rawText, 'title_nl') || extractLooseJsonString(rawText, 'title'),
      description: extractLooseJsonString(rawText, 'description_nl') || extractLooseJsonString(rawText, 'description'),
      tags: extractLooseJsonTags(rawText, 'tags_nl').length
        ? extractLooseJsonTags(rawText, 'tags_nl')
        : extractLooseJsonTags(rawText, 'tags'),
    };
  };

  const resolveTranslationFamily = (prefix) => getDescriptionAssembly().resolveDescriptionFamilyFromPrefix?.(prefix) || 'collection';

  const normalizeSourceDescriptionForTranslation = (prefix, rawDescription) => {
    const family = resolveTranslationFamily(prefix);
    const stripped = getDescriptionAssembly().stripDecorativeFixedBlocks?.(rawDescription, family, 'fr')
      || getDescriptionAssembly().stripTrailingFixedBlocks?.(rawDescription, family, 'fr');
    return {
      family,
      description: String(stripped?.description ?? rawDescription ?? '').replace(/\r\n?/g, '\n'),
      stripped: Boolean(stripped?.stripped),
    };
  };

  const buildInjectedTranslationDescription = (prefix, language, dynamicDescription) => {
    const family = resolveTranslationFamily(prefix);
    return getDescriptionAssembly().buildTranslatedDescriptionWithFixedBlocks?.(dynamicDescription, family, language)
      || String(dynamicDescription || '').replace(/\r\n?/g, '\n');
  };

  const buildTranslationCacheBlocks = (prefix, listingDraft) => {
    const title = String(listingDraft?.sourceTitle || '').trim();
    const tags = (getEtsyData().normalizeAttributeTags?.(listingDraft?.sourceTags || []) || listingDraft?.sourceTags || []).join(', ');
    const description = normalizeSourceDescriptionForTranslation(prefix, listingDraft?.sourceDescription).description;
    return [{
      key: 'translation_source_fr_listing',
      text: [
        '## SOURCE_FR_LISTING',
        `TITLE: ${title}`,
        `TAGS: ${tags}`,
        'DESCRIPTION:',
        description,
      ].filter(Boolean).join('\n'),
      cacheable: true,
      cacheGroup: 'translation_source_fr_listing',
      cacheLabel: 'source_fr_listing',
    }];
  };

  const updateMappingStateFromFields = (prefix) => {
    const entry = ensurePrefixState(prefix);
    entry.characterFr = getTrimmedValue(prefix, 'translation-nl-character-fr');
    entry.universeFr = getTrimmedValue(prefix, 'translation-nl-universe-fr');
    entry.characterEn = getTrimmedValue(prefix, 'translation-nl-character-en');
    entry.universeEn = getTrimmedValue(prefix, 'translation-nl-universe-en');
    persistPrefixState(prefix);
  };

  const updateListingStateFromFields = (prefix, options = {}) => {
    const rerender = options?.rerender !== false;
    const listingDraft = ensurePrefixState(prefix).listingDraft;
    listingDraft.listingRef = getTrimmedValue(prefix, 'translation-en-listing-ref');
    listingDraft.sourceTitle = String(readField(prefix, 'translation-en-source-title')?.value || '');
    listingDraft.sourceDescription = String(readField(prefix, 'translation-en-source-description')?.value || '');
    listingDraft.translatedTitle = String(readField(prefix, 'translation-nl-translated-title')?.value || '');
    listingDraft.translatedDescription = String(readField(prefix, 'translation-nl-translated-description')?.value || '');
    persistPrefixState(prefix);
    if (rerender) renderPrefixState(prefix);
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

  const buildTagMetricText = (tag = '') => `${String(tag || '').length} / ${TAG_MAX_LENGTH}`;

  const renderTagMetricNode = (node, tag = '') => {
    setMetricNode(node, buildTagMetricText(tag), String(tag || '').length <= TAG_MAX_LENGTH);
  };

  const renderTagsList = (prefix, kind) => {
    const listingDraft = ensurePrefixState(prefix).listingDraft;
    const isSource = kind === 'source';
    const tagsHost = readField(prefix, `translation-nl-${kind}-tags-list`);
    const tagInput = readField(prefix, `translation-nl-${kind}-tags-input`);
    const data = getEtsyData();
    const tags = isSource ? listingDraft.sourceTags : listingDraft.translatedTags;
    const pendingInput = isSource ? listingDraft.pendingSourceTagsInput : listingDraft.pendingTranslatedTagsInput;
    const removeAction = isSource ? 'translation-nl-source-tag-remove' : 'translation-nl-translated-tag-remove';
    const editAction = isSource ? 'translation-nl-source-tag-edit' : 'translation-nl-translated-tag-edit';
    const emptyLabel = isSource ? 'Aucun tag source pour le moment.' : 'Aucun tag NL genere pour le moment.';
    if (!tagsHost) return;

    if (tagInput && tagInput.value !== pendingInput) {
      tagInput.value = pendingInput || '';
    }

    tagsHost.innerHTML = tags.length
      ? tags.map((tag, index) => `
        <div class="etsy-api-attribute-tag-item">
          <div class="etsy-api-attribute-tag-edit-wrap">
            <input
              type="text"
              maxlength="${data.ETSY_MAX_TAG_LENGTH || 30}"
              data-js="${editAction}"
              data-prefix="${prefix}"
              data-tag-index="${index}"
              class="${String(tag || '').length > TAG_MAX_LENGTH ? 'translation-en-tag-over' : ''}"
              value="${escapeHtml(tag)}"
            />
            <span class="translation-en-metric ${String(tag || '').length > TAG_MAX_LENGTH ? 'translation-en-metric-over' : 'translation-en-metric-ok'}">
              ${buildTagMetricText(tag)}
            </span>
          </div>
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
        const nextValue = String(event.target.value || '').slice(0, data.ETSY_MAX_TAG_LENGTH || 30);
        const targetTags = isSource ? listingDraft.sourceTags : listingDraft.translatedTags;
        targetTags[tagIndex] = nextValue;
        input.classList.toggle('translation-en-tag-over', nextValue.length > TAG_MAX_LENGTH);
        renderTagMetricNode(input.parentElement?.querySelector('.translation-en-metric'), nextValue);
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
      'translation-nl-character-fr': entry.characterFr,
      'translation-nl-universe-fr': entry.universeFr,
      'translation-nl-character-en': entry.characterEn,
      'translation-nl-universe-en': entry.universeEn,
      'translation-nl-listing-ref': listingDraft.listingRef,
      'translation-nl-source-title': listingDraft.sourceTitle,
      'translation-nl-source-description': listingDraft.sourceDescription,
      'translation-nl-translated-title': listingDraft.translatedTitle,
      'translation-nl-translated-description': listingDraft.translatedDescription,
    };

    Object.entries(fieldValues).forEach(([suffix, value]) => {
      const field = readField(prefix, suffix);
      if (!field) return;
      if (field.tagName === 'TEXTAREA') {
        if (field.value !== value) {
          field.value = value;
          field.defaultValue = value;
          field.textContent = value;
        }
        return;
      }
      if (field.value !== value) field.value = value;
    });

    const mappingOutputNode = readField(prefix, 'out-traduction_nl');
    if (mappingOutputNode) {
      mappingOutputNode.textContent = entry.output || DEFAULT_MAPPING_OUTPUT;
      mappingOutputNode.classList.toggle('empty', !String(entry.output || '').trim());
    }

    const mappingStatusNode = readField(prefix, 'translation-nl-status');
    if (mappingStatusNode) mappingStatusNode.textContent = entry.status || DEFAULT_MAPPING_STATUS;

    const sourceStatusNode = readField(prefix, 'translation-nl-source-status');
    if (sourceStatusNode) sourceStatusNode.textContent = listingDraft.sourceStatus || DEFAULT_SOURCE_STATUS;

    const translationOutputNode = readField(prefix, 'out-traduction_listing_nl');
    if (translationOutputNode) {
      translationOutputNode.textContent = listingDraft.translationOutput || DEFAULT_TRANSLATION_OUTPUT;
      translationOutputNode.classList.toggle('empty', !String(listingDraft.translationOutput || '').trim());
    }

    const translationDebugNode = readField(prefix, 'translation-nl-debug');
    if (translationDebugNode) {
      translationDebugNode.textContent = String(listingDraft.translationDebug || 'Aucun debug disponible.');
    }

    const translationStatusNode = readField(prefix, 'translation-nl-translation-status');
    if (translationStatusNode) translationStatusNode.textContent = listingDraft.translationStatus || DEFAULT_TRANSLATION_STATUS;

    setMetricNode(
      readField(prefix, 'translation-nl-source-title-meta'),
      `${listingDraft.sourceTitle.length} / ${TITLE_MAX_LENGTH}`,
      listingDraft.sourceTitle.length <= TITLE_MAX_LENGTH,
    );
    setMetricNode(
      readField(prefix, 'translation-nl-translated-title-meta'),
      `${listingDraft.translatedTitle.length} / ${TITLE_MAX_LENGTH}`,
      listingDraft.translatedTitle.length <= TITLE_MAX_LENGTH,
    );

    const sourceTagsMeta = buildTagsMeta(listingDraft.sourceTags);
    setMetricNode(readField(prefix, 'translation-nl-source-tags-meta'), sourceTagsMeta.text, sourceTagsMeta.isValid);

    const translatedTagsMeta = buildTagsMeta(listingDraft.translatedTags);
    setMetricNode(readField(prefix, 'translation-nl-translated-tags-meta'), translatedTagsMeta.text, translatedTagsMeta.isValid);

    renderTagsList(prefix, 'source');
    renderTagsList(prefix, 'translated');
    syncTextareaHeight(readField(prefix, 'translation-nl-source-description'));
    syncTextareaHeight(readField(prefix, 'translation-nl-translated-description'));
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

  async function runTranslationNlCheck(prefix = global.pfx()) {
    updateMappingStateFromFields(prefix);
    const entry = ensurePrefixState(prefix);

    if (!entry.characterFr || !entry.universeFr) {
      setMappingStatus(prefix, 'Check impossible : renseigne le personnage FR et l’univers FR.');
      global.showToast('Renseigne le personnage FR et l’univers FR', '#ff4757');
      return;
    }

    const runButton = readField(prefix, 'translation-nl-run');
    if (runButton) runButton.disabled = true;

    try {
      await ensurePromptLoaded(TRANSLATION_MAPPING_AGENT_ID, TRANSLATION_MAPPING_PROMPT_PATH);
      const template = String(getPromptCache()[TRANSLATION_MAPPING_AGENT_ID] || '').trim();
      const filled = template
        .replace(/\[\[CHARACTER_FR\]\]/g, entry.characterFr)
        .replace(/\[\[UNIVERSE_FR\]\]/g, entry.universeFr)
        .replace(/\[\[CHARACTER_NL_CURRENT\]\]/g, entry.characterEn)
        .replace(/\[\[UNIVERSE_NL_CURRENT\]\]/g, entry.universeEn)
        .replace(/\[\[CHARACTER_EN_CURRENT\]\]/g, entry.characterEn)
        .replace(/\[\[UNIVERSE_EN_CURRENT\]\]/g, entry.universeEn);

      entry.lastInput = filled;
      getState().inputs[`${prefix}:${TRANSLATION_MAPPING_AGENT_ID}`] = filled;
      setMappingStatus(prefix, `Verification NL en cours (${getModel(TRANSLATION_MAPPING_AGENT_ID)})...`);

      const response = await global.callClaude(TRANSLATION_MAPPING_AGENT_ID, {
        overrideModel: TRANSLATION_MODEL,
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
        entry.characterEn = String(parsed.character_nl || parsed.characterNameNl || parsed.character_en || parsed.characterNameEn || entry.characterEn || '').trim();
        entry.universeEn = String(parsed.universe_nl || parsed.licenseNl || parsed.universe_en || parsed.licenseEn || entry.universeEn || '').trim();
      }

      setMappingStatus(prefix, 'Check FR -> NL termine.');
      renderPrefixState(prefix);
      persistPrefixState(prefix);
      global.showToast('Check traduction NL termine');
    } catch (error) {
      entry.output = '';
      setMappingStatus(prefix, `Erreur check NL : ${error.message}`);
      global.showToast(`Erreur traduction NL: ${error.message}`, '#ff4757');
    } finally {
      if (runButton) runButton.disabled = false;
    }
  }

  async function loadTranslationNlSource(prefix = global.pfx()) {
    updateListingStateFromFields(prefix);
    const entry = ensurePrefixState(prefix);
    const listingDraft = entry.listingDraft;
    const loadButton = readField(prefix, 'translation-nl-load-source');
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
      global.showToast('Fiche source NL chargee');
    } catch (error) {
      setSourceStatus(prefix, `Lecture Etsy impossible : ${error.message}`);
      global.showToast(`Etsy API : ${error.message}`, '#ff4757');
    } finally {
      if (loadButton) loadButton.disabled = false;
    }
  }

  async function runTranslationNlListing(prefix = global.pfx(), options = {}) {
    updateMappingStateFromFields(prefix);
    updateListingStateFromFields(prefix);
    const silent = options?.silent === true;
    const ownsCacheRun = global.PipelineUITranslationEnRuntime?.beginTranslationCacheRun?.(
      prefix,
      'traduction NL',
      [TRANSLATION_LISTING_AGENT_ID],
    ) === true;

    const entry = ensurePrefixState(prefix);
    const listingDraft = entry.listingDraft;
    const translateButton = readField(prefix, 'translation-nl-translate');
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
      global.PipelineUITranslationEnRuntime?.setTranslationLanguageStatus?.(prefix, 'nl', 'error');
      if (!silent) global.showToast('Titre, tags et description source requis', '#ff4757');
      return { ok: false, reason: 'missing_source' };
    }

    if (translateButton) translateButton.disabled = true;
    global.PipelineUITranslationEnRuntime?.resetTranslationLanguageRunState?.(prefix, 'nl');
    global.PipelineUITranslationEnRuntime?.setTranslationLanguageStatus?.(prefix, 'nl', 'running');
    try {
      await ensurePromptLoaded(TRANSLATION_LISTING_AGENT_ID, TRANSLATION_LISTING_PROMPT_PATH);
      const template = String(getPromptCache()[TRANSLATION_LISTING_AGENT_ID] || '').trim();
      const fixedContentBlocks = buildTranslationCacheBlocks(prefix, listingDraft);
      const filled = template
        .replace(/\[\[CHARACTER_FR\]\]/g, entry.characterFr)
        .replace(/\[\[UNIVERSE_FR\]\]/g, entry.universeFr)
        .replace(/\[\[CHARACTER_NL\]\]/g, entry.characterEn)
        .replace(/\[\[UNIVERSE_NL\]\]/g, entry.universeEn)
        .replace(/\[\[CHARACTER_EN\]\]/g, entry.characterEn)
        .replace(/\[\[UNIVERSE_EN\]\]/g, entry.universeEn)
        .replace(/\[\[SOURCE_TITLE\]\]/g, '[voir TITLE dans SOURCE_FR_LISTING mis en cache]')
        .replace(/\[\[SOURCE_TAGS\]\]/g, '[voir TAGS dans SOURCE_FR_LISTING mis en cache]')
        .replace(/\[\[SOURCE_DESCRIPTION\]\]/g, '[voir bloc SOURCE_FR_LISTING mis en cache]');
      const filledWithInjectionNote = `${filled}\n\nNOTE TECHNIQUE:\n- Traduis uniquement la partie variable de la description.\n- Les blocs fixes traduits sont injectes automatiquement apres traduction.\n- Ne reecris pas les blocs fixes dans description_nl.`;

      listingDraft.translationInput = filledWithInjectionNote;
      getState().inputs[`${prefix}:${TRANSLATION_LISTING_AGENT_ID}`] = filledWithInjectionNote;
      setTranslationStatus(prefix, `Traduction NL en cours (${getModel(TRANSLATION_LISTING_AGENT_ID)})...`);

      const response = await global.callClaude(TRANSLATION_LISTING_AGENT_ID, {
        overrideModel: TRANSLATION_MODEL,
        filled: filledWithInjectionNote,
        fixedContentBlocks,
        promptDebug: {
          agentId: TRANSLATION_LISTING_AGENT_ID,
          promptChars: filledWithInjectionNote.length,
          fixedBlocks: fixedContentBlocks,
        },
      }, false);

      listingDraft.translationOutput = String(response?.text || '').trim();
      global.showAgentCost?.(TRANSLATION_LISTING_AGENT_ID, response?.usage || null, { prefix, source: 'translation' });
      global.syncCacheIndicator?.(response?.usage || null);
      const parsed = parseAgentOutput(listingDraft.translationOutput);
      const extracted = extractTranslationFields(listingDraft.translationOutput);
      listingDraft.translatedTitle = String(extracted.title || '').trim();
      listingDraft.translatedDescription = buildInjectedTranslationDescription(prefix, 'nl', extracted.description || '');
      listingDraft.translatedTags = getEtsyData().normalizeAttributeTags?.(extracted.tags || []) || extracted.tags || [];
      listingDraft.pendingTranslatedTagsInput = '';
      const descriptionField = readField(prefix, 'translation-nl-translated-description');
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
      setTranslationStatus(prefix, 'Traduction NL terminee.');
      renderPrefixState(prefix);
      persistPrefixState(prefix);
      global.PipelineUITranslationEnRuntime?.setTranslationLanguageStatus?.(prefix, 'nl', 'success');
      if (!silent) global.showToast('Traduction NL terminee');
      global.PipelineUITranslationEnRuntime?.finalizeTranslationCacheRun?.(prefix, 'Traduction NL terminee', ownsCacheRun);
      return { ok: true };
    } catch (error) {
      listingDraft.translationOutput = '';
      listingDraft.translationDebug = '';
      setTranslationStatus(prefix, `Erreur traduction NL : ${error.message}`);
      global.PipelineUITranslationEnRuntime?.setTranslationLanguageStatus?.(prefix, 'nl', 'error');
      if (!silent) global.showToast(`Erreur traduction NL: ${error.message}`, '#ff4757');
      global.PipelineUITranslationEnRuntime?.finalizeTranslationCacheRun?.(prefix, `Erreur traduction NL : ${error.message}`, ownsCacheRun);
      return { ok: false, reason: error.message };
    } finally {
      if (translateButton) translateButton.disabled = false;
    }
  }

  function copyTranslationNlOutput(prefix = global.pfx()) {
    const output = String(ensurePrefixState(prefix).output || '').trim();
    if (!output) {
      global.showToast('Aucune sortie a copier', '#ff4757');
      return;
    }
    navigator.clipboard.writeText(output);
    global.showToast('Sortie copiee');
  }

  function showTranslationNlInput(prefix = global.pfx()) {
    const raw = String(
      getState().inputs[`${prefix}:${TRANSLATION_MAPPING_AGENT_ID}`]
      || ensurePrefixState(prefix).listingDraft.translationInput
      || '',
    ).trim();
    if (!raw) {
      global.showToast("Pas encore d'input brut genere", '#e8c547');
      return;
    }
    const hasMappingInput = Boolean(String(getState().inputs[`${prefix}:${TRANSLATION_MAPPING_AGENT_ID}`] || '').trim());
    document.getElementById('rawInputTitle').textContent = hasMappingInput
      ? '</> INPUT - Traduction NL'
      : '</> INPUT - Traduction fiche NL';
    document.getElementById('rawInputTextarea').value = raw;
    document.getElementById('rawInputCount').textContent = `${raw.length.toLocaleString()} car.`;
    document.getElementById('rawInputLightbox').classList.add('visible');
  }

  function copyTranslationNlListingOutput(prefix = global.pfx()) {
    const output = String(ensurePrefixState(prefix).listingDraft.translationOutput || '').trim();
    if (!output) {
      global.showToast('Aucune sortie a copier', '#ff4757');
      return;
    }
    navigator.clipboard.writeText(output);
    global.showToast('Sortie copiee');
  }

  function showTranslationNlListingInput(prefix = global.pfx()) {
    const raw = String(
      ensurePrefixState(prefix).listingDraft.translationInput
      || getState().inputs[`${prefix}:${TRANSLATION_LISTING_AGENT_ID}`]
      || '',
    ).trim();
    if (!raw) {
      global.showToast("Pas encore d'input brut genere", '#e8c547');
      return;
    }
    document.getElementById('rawInputTitle').textContent = '</> INPUT - Traduction fiche NL';
    document.getElementById('rawInputTextarea').value = raw;
    document.getElementById('rawInputCount').textContent = `${raw.length.toLocaleString()} car.`;
    document.getElementById('rawInputLightbox').classList.add('visible');
  }

  function copyTranslationNlField(prefix = global.pfx(), fieldKey = '') {
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

  async function publishTranslationNl(prefix = global.pfx()) {
    return global.PipelineUITranslationEnRuntime?.publishSingleTranslation?.(
      prefix,
      'nl',
      ensurePrefixState(prefix).listingDraft,
    ) || { ok: false, reason: 'missing_publish_helper' };
  }

  function resolveTranslationNlPromptLightboxSpec(id = '') {
    const normalizedId = String(id).trim();
    if (normalizedId === TRANSLATION_MAPPING_AGENT_ID) {
      return {
        label: 'Traduction NL',
        path: TRANSLATION_MAPPING_PROMPT_PATH,
        stateKey: TRANSLATION_MAPPING_AGENT_ID,
      };
    }
    if (normalizedId === TRANSLATION_LISTING_AGENT_ID) {
      return {
        label: 'Traduction fiche NL',
        path: TRANSLATION_LISTING_PROMPT_PATH,
        stateKey: TRANSLATION_LISTING_AGENT_ID,
      };
    }
    return null;
  }

  function bindPrefixInputs(prefix) {
    [
      'translation-nl-character-fr',
      'translation-nl-universe-fr',
      'translation-nl-character-en',
      'translation-nl-universe-en',
    ].forEach((suffix) => {
      const field = readField(prefix, suffix);
      if (!field || field.dataset.translationEnMappingBound === 'true') return;
      field.addEventListener('input', () => updateMappingStateFromFields(prefix));
      field.dataset.translationEnMappingBound = 'true';
    });

    [
      'translation-nl-listing-ref',
      'translation-nl-source-title',
      'translation-nl-source-description',
      'translation-nl-translated-title',
      'translation-nl-translated-description',
    ].forEach((suffix) => {
      const field = readField(prefix, suffix);
      if (!field || field.dataset.translationEnListingBound === 'true') return;
      field.addEventListener('input', () => updateListingStateFromFields(prefix, { rerender: false }));
      if (suffix === 'translation-nl-source-title' || suffix === 'translation-nl-translated-title') {
        field.addEventListener('input', () => {
          const isSourceTitle = suffix === 'translation-nl-source-title';
          const metricNode = readField(prefix, isSourceTitle ? 'translation-nl-source-title-meta' : 'translation-nl-translated-title-meta');
          const value = String(field.value || '');
          setMetricNode(metricNode, `${value.length} / ${TITLE_MAX_LENGTH}`, value.length <= TITLE_MAX_LENGTH);
        });
      }
      field.addEventListener('blur', () => renderPrefixState(prefix));
      if (field.tagName === 'TEXTAREA') {
        field.addEventListener('input', () => syncTextareaHeight(field));
      }
      field.dataset.translationEnListingBound = 'true';
    });

    const tagsInput = readField(prefix, 'translation-nl-source-tags-input');
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

    const translatedTagsInput = readField(prefix, 'translation-nl-translated-tags-input');
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

  function initTranslationNlPanel(prefix) {
    loadPrefixState(prefix);
    bindPrefixInputs(prefix);
    renderPrefixState(prefix);
  }

  function initAllTranslationNlPanels() {
    PREFIXES.forEach((prefix) => initTranslationNlPanel(prefix));
  }

  global.PipelineUITranslationNlRuntime = {
    TRANSLATION_MAPPING_AGENT_ID,
    TRANSLATION_LISTING_AGENT_ID,
    ensureTranslationNlState: ensurePrefixState,
    persistTranslationNlState: persistPrefixState,
    renderTranslationNlState: renderPrefixState,
    initTranslationNlPanel,
    initAllTranslationNlPanels,
    runTranslationNlCheck,
    loadTranslationNlSource,
    runTranslationNlListing,
    copyTranslationNlOutput,
    showTranslationNlInput,
    copyTranslationNlListingOutput,
    copyTranslationNlField,
    publishTranslationNl,
    showTranslationNlListingInput,
    resolveTranslationNlPromptLightboxSpec,
  };

  global.PipelineUI.translationNl = global.PipelineUI.translationNl || {};
  Object.assign(global.PipelineUI.translationNl, global.PipelineUITranslationNlRuntime);
  Object.assign(global, global.PipelineUITranslationNlRuntime);

  const previousCustomPromptResolver = global.resolveCustomPromptLightboxSpec;
  global.resolveCustomPromptLightboxSpec = function resolveCustomPromptLightboxSpec(id = '') {
    return resolveTranslationNlPromptLightboxSpec(id) || previousCustomPromptResolver?.(id) || null;
  };

  initAllTranslationNlPanels();
})(window);



