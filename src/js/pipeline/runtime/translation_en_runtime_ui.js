'use strict';

(function initPipelineUITranslationEnRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};

  const TRANSLATION_MAPPING_AGENT_ID = 'traduction_en';
  const TRANSLATION_LISTING_AGENT_ID = 'traduction_listing_en';
  const TRANSLATION_MAPPING_PROMPT_PATH = 'prompts/traduction/traduction_en.md';
  const TRANSLATION_LISTING_PROMPT_PATH = 'prompts/traduction/traduction_listing_en.md';
  const STORAGE_KEY_PREFIX = 'pipeline.translation.en.';
  const PREFIXES = ['tt', 'col'];
  const TRANSLATION_LANGUAGES = ['en', 'de', 'es', 'it', 'nl', 'pt'];
  const UPDATE_TRANSLATION_LANGUAGES = ['it', 'nl', 'pt'];
  const TRANSLATION_SUBTABS = ['fr', ...TRANSLATION_LANGUAGES];
  const TITLE_MAX_LENGTH = 140;
  const TAG_MAX_LENGTH = 30;
  const TRANSLATION_MODEL = 'claude-sonnet-4-6';
  const DEFAULT_BULK_STATUS = 'En attente d’un lancement global EN / DE / ES / IT / NL / PT.';
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

  const createEmptyBulkState = () => ({
    running: false,
    cancelRequested: false,
    status: '',
    languages: {
      en: 'idle',
      de: 'idle',
      es: 'idle',
      it: 'idle',
      nl: 'idle',
      pt: 'idle',
    },
    retryCounts: {
      en: 0,
      de: 0,
      es: 0,
      it: 0,
      nl: 0,
      pt: 0,
    },
    timers: {
      en: { startedAt: 0, lastDurationMs: 0 },
      de: { startedAt: 0, lastDurationMs: 0 },
      es: { startedAt: 0, lastDurationMs: 0 },
      it: { startedAt: 0, lastDurationMs: 0 },
      nl: { startedAt: 0, lastDurationMs: 0 },
      pt: { startedAt: 0, lastDurationMs: 0 },
    },
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
    bulk: createEmptyBulkState(),
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
        activeSubtab: TRANSLATION_LANGUAGES.includes(parsed.activeSubtab) ? parsed.activeSubtab : 'fr',
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
      const bulk = parsed.bulk && typeof parsed.bulk === 'object' ? parsed.bulk : {};
      entry.bulk = {
        ...createEmptyBulkState(),
        running: bulk.running === true,
        cancelRequested: bulk.cancelRequested === true,
        status: String(bulk.status || ''),
        languages: {
          en: ['idle', 'running', 'success', 'error'].includes(bulk.languages?.en) ? bulk.languages.en : 'idle',
          de: ['idle', 'running', 'success', 'error'].includes(bulk.languages?.de) ? bulk.languages.de : 'idle',
          es: ['idle', 'running', 'success', 'error'].includes(bulk.languages?.es) ? bulk.languages.es : 'idle',
          it: ['idle', 'running', 'success', 'error'].includes(bulk.languages?.it) ? bulk.languages.it : 'idle',
          nl: ['idle', 'running', 'success', 'error'].includes(bulk.languages?.nl) ? bulk.languages.nl : 'idle',
          pt: ['idle', 'running', 'success', 'error'].includes(bulk.languages?.pt) ? bulk.languages.pt : 'idle',
        },
        retryCounts: {
          en: Number.isFinite(Number(bulk.retryCounts?.en)) ? Number(bulk.retryCounts.en) : 0,
          de: Number.isFinite(Number(bulk.retryCounts?.de)) ? Number(bulk.retryCounts.de) : 0,
          es: Number.isFinite(Number(bulk.retryCounts?.es)) ? Number(bulk.retryCounts.es) : 0,
          it: Number.isFinite(Number(bulk.retryCounts?.it)) ? Number(bulk.retryCounts.it) : 0,
          nl: Number.isFinite(Number(bulk.retryCounts?.nl)) ? Number(bulk.retryCounts.nl) : 0,
          pt: Number.isFinite(Number(bulk.retryCounts?.pt)) ? Number(bulk.retryCounts.pt) : 0,
        },
        timers: {
          en: {
            startedAt: Number.isFinite(Number(bulk.timers?.en?.startedAt)) ? Number(bulk.timers.en.startedAt) : 0,
            lastDurationMs: Number.isFinite(Number(bulk.timers?.en?.lastDurationMs)) ? Number(bulk.timers.en.lastDurationMs) : 0,
          },
          de: {
            startedAt: Number.isFinite(Number(bulk.timers?.de?.startedAt)) ? Number(bulk.timers.de.startedAt) : 0,
            lastDurationMs: Number.isFinite(Number(bulk.timers?.de?.lastDurationMs)) ? Number(bulk.timers.de.lastDurationMs) : 0,
          },
          es: {
            startedAt: Number.isFinite(Number(bulk.timers?.es?.startedAt)) ? Number(bulk.timers.es.startedAt) : 0,
            lastDurationMs: Number.isFinite(Number(bulk.timers?.es?.lastDurationMs)) ? Number(bulk.timers.es.lastDurationMs) : 0,
          },
          it: {
            startedAt: Number.isFinite(Number(bulk.timers?.it?.startedAt)) ? Number(bulk.timers.it.startedAt) : 0,
            lastDurationMs: Number.isFinite(Number(bulk.timers?.it?.lastDurationMs)) ? Number(bulk.timers.it.lastDurationMs) : 0,
          },
          nl: {
            startedAt: Number.isFinite(Number(bulk.timers?.nl?.startedAt)) ? Number(bulk.timers.nl.startedAt) : 0,
            lastDurationMs: Number.isFinite(Number(bulk.timers?.nl?.lastDurationMs)) ? Number(bulk.timers.nl.lastDurationMs) : 0,
          },
          pt: {
            startedAt: Number.isFinite(Number(bulk.timers?.pt?.startedAt)) ? Number(bulk.timers.pt.startedAt) : 0,
            lastDurationMs: Number.isFinite(Number(bulk.timers?.pt?.lastDurationMs)) ? Number(bulk.timers.pt.lastDurationMs) : 0,
          },
        },
      };
    } catch (error) {}
    return entry;
  };

  const getBulkState = (prefix) => {
    const entry = ensurePrefixState(prefix);
    entry.bulk = entry.bulk || createEmptyBulkState();
    entry.bulk.languages = entry.bulk.languages || createEmptyBulkState().languages;
    entry.bulk.retryCounts = entry.bulk.retryCounts || createEmptyBulkState().retryCounts;
    entry.bulk.timers = entry.bulk.timers || {
      en: { startedAt: 0, lastDurationMs: 0 },
      de: { startedAt: 0, lastDurationMs: 0 },
      es: { startedAt: 0, lastDurationMs: 0 },
      it: { startedAt: 0, lastDurationMs: 0 },
      nl: { startedAt: 0, lastDurationMs: 0 },
      pt: { startedAt: 0, lastDurationMs: 0 },
    };
    return entry.bulk;
  };

  let translationTimerIntervalId = 0;

  const formatTranslationDuration = (durationMs = 0) => {
    const totalSeconds = Math.max(0, Math.floor((Number(durationMs) || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const getTranslationTimerDisplay = (prefix, language) => {
    const bulk = getBulkState(prefix);
    const timer = bulk.timers?.[language] || { startedAt: 0, lastDurationMs: 0 };
    const isRunning = bulk.languages?.[language] === 'running';
    const activeDurationMs = isRunning && timer.startedAt > 0
      ? Math.max(0, Date.now() - timer.startedAt)
      : Math.max(0, Number(timer.lastDurationMs) || 0);
    return activeDurationMs > 0 ? formatTranslationDuration(activeDurationMs) : '';
  };

  const hasAnyRunningTranslationTimer = () => PREFIXES.some((prefix) => {
    const bulk = getBulkState(prefix);
    return TRANSLATION_LANGUAGES.some((language) => bulk.languages?.[language] === 'running');
  });

  const renderTranslationSubtabs = (prefix) => {
    const entry = ensurePrefixState(prefix);
    const bulk = getBulkState(prefix);
    TRANSLATION_SUBTABS.forEach((subtab) => {
      const tabButton = readField(prefix, `translation-subtab-${subtab}`);
      const panel = readField(prefix, `translation-subpanel-${subtab}`);
      const isActive = entry.activeSubtab === subtab;
      if (tabButton) {
        tabButton.classList.toggle('is-active', isActive);
        tabButton.classList.remove('is-running', 'is-success', 'is-error');
        if (subtab !== 'fr') {
          const statusClass = getLanguageStatusClass(bulk.languages?.[subtab] || 'idle');
          if (statusClass) tabButton.classList.add(statusClass);
          const retryCount = Math.max(0, Number(bulk.retryCounts?.[subtab] || 0));
          const durationLabel = getTranslationTimerDisplay(prefix, subtab);
          const retryLabel = retryCount > 0 ? ` +${retryCount}` : '';
          tabButton.textContent = [
            subtab.toUpperCase(),
            durationLabel ? ` ${durationLabel}` : '',
            retryLabel,
          ].join('');
        } else {
          tabButton.textContent = 'FR source';
        }
        tabButton.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
      if (panel) {
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
      }
    });
  };

  const refreshTranslationTabTimers = () => {
    PREFIXES.forEach((prefix) => renderTranslationSubtabs(prefix));
  };

  const syncTranslationTimerTicker = () => {
    const shouldRun = hasAnyRunningTranslationTimer();
    if (shouldRun && !translationTimerIntervalId) {
      translationTimerIntervalId = window.setInterval(refreshTranslationTabTimers, 1000);
      return;
    }
    if (!shouldRun && translationTimerIntervalId) {
      window.clearInterval(translationTimerIntervalId);
      translationTimerIntervalId = 0;
    }
  };

  const getLanguageStatusClass = (status = '') => {
    if (status === 'running') return 'is-running';
    if (status === 'success') return 'is-success';
    if (status === 'error') return 'is-error';
    return '';
  };

  const resetBulkTranslationState = (prefix) => {
    const bulk = getBulkState(prefix);
    bulk.running = false;
    bulk.cancelRequested = false;
    bulk.status = '';
    TRANSLATION_LANGUAGES.forEach((language) => {
      bulk.languages[language] = 'idle';
      bulk.retryCounts[language] = 0;
      bulk.timers[language] = { startedAt: 0, lastDurationMs: 0 };
    });
    syncTranslationTimerTicker();
    persistPrefixState(prefix);
    renderPrefixState(prefix);
  };

  const resetTranslationLanguageRunState = (prefix, language) => {
    const bulk = getBulkState(prefix);
    const normalizedLanguage = TRANSLATION_LANGUAGES.includes(language) ? language : '';
    if (!normalizedLanguage) return;
    bulk.languages[normalizedLanguage] = 'idle';
    bulk.retryCounts[normalizedLanguage] = 0;
    bulk.timers[normalizedLanguage] = { startedAt: 0, lastDurationMs: 0 };
    syncTranslationTimerTicker();
    persistPrefixState(prefix);
    renderPrefixState(prefix);
  };

  const setBulkTranslationStatus = (prefix, message = '') => {
    const bulk = getBulkState(prefix);
    bulk.status = String(message || '');
    persistPrefixState(prefix);
    renderPrefixState(prefix);
  };

  const setBulkTranslationRunning = (prefix, isRunning) => {
    const bulk = getBulkState(prefix);
    bulk.running = isRunning === true;
    if (bulk.running) bulk.cancelRequested = false;
    persistPrefixState(prefix);
    renderPrefixState(prefix);
  };

  const requestBulkTranslationStop = (prefix) => {
    const bulk = getBulkState(prefix);
    bulk.cancelRequested = true;
    persistPrefixState(prefix);
    renderPrefixState(prefix);
  };

  const isBulkTranslationStopRequested = (prefix) => getBulkState(prefix).cancelRequested === true;

  const setTranslationLanguageStatus = (prefix, language, status) => {
    const bulk = getBulkState(prefix);
    const normalizedLanguage = TRANSLATION_LANGUAGES.includes(language) ? language : '';
    const normalizedStatus = ['idle', 'running', 'success', 'error'].includes(status) ? status : 'idle';
    if (!normalizedLanguage) return;
    const timer = bulk.timers?.[normalizedLanguage] || { startedAt: 0, lastDurationMs: 0 };
    if (normalizedStatus === 'running') {
      timer.startedAt = Date.now();
      timer.lastDurationMs = 0;
    } else if (timer.startedAt > 0) {
      timer.lastDurationMs = Math.max(0, Date.now() - timer.startedAt);
      timer.startedAt = 0;
    } else if (normalizedStatus === 'idle') {
      timer.lastDurationMs = 0;
    }
    bulk.timers[normalizedLanguage] = timer;
    bulk.languages[normalizedLanguage] = normalizedStatus;
    if (normalizedStatus === 'running' || normalizedStatus === 'success' || normalizedStatus === 'idle') {
      bulk.retryCounts[normalizedLanguage] = normalizedStatus === 'running' ? bulk.retryCounts[normalizedLanguage] : 0;
    }
    syncTranslationTimerTicker();
    persistPrefixState(prefix);
    renderPrefixState(prefix);
  };

  const incrementTranslationRetryCount = (prefix, language) => {
    const bulk = getBulkState(prefix);
    const normalizedLanguage = TRANSLATION_LANGUAGES.includes(language) ? language : '';
    if (!normalizedLanguage) return;
    bulk.retryCounts[normalizedLanguage] = Math.max(0, Number(bulk.retryCounts[normalizedLanguage] || 0)) + 1;
    persistPrefixState(prefix);
    renderPrefixState(prefix);
  };

  const countTranslationLanguageStatuses = (prefix) => {
    const bulk = getBulkState(prefix);
    const statuses = Object.values(bulk.languages || {});
    return {
      idle: statuses.filter((value) => value === 'idle').length,
      running: statuses.filter((value) => value === 'running').length,
      success: statuses.filter((value) => value === 'success').length,
      error: statuses.filter((value) => value === 'error').length,
    };
  };

  const canPublishAllTranslations = (prefix) => {
    const bulk = getBulkState(prefix);
    const counts = countTranslationLanguageStatuses(prefix);
    return !bulk.running && counts.success > 0;
  };

  const beginTranslationCacheRun = (prefix, launchScope, agentIds = []) => {
    const activeRun = global.getActiveCacheDebugRun?.(prefix);
    if (activeRun) return false;
    global.beginCacheDebugRun?.(
      prefix,
      agentIds.map((id) => ({ id })),
      {
        launchScope,
        cacheAwareEnabled: true,
      },
    );
    return true;
  };

  const buildTranslationCacheWarmupPromptData = (prefix, listingDraft) => {
    const filled = [
      'PHASE TECHNIQUE — CACHE-AWARE TRADUCTION',
      'Objectif : amorcer SOURCE_FR_LISTING avant les traductions EN / DE / ES / IT / NL / PT.',
      'Réponds uniquement : CACHE_TRANSLATION_READY',
    ].join('\n\n');
    const fixedContentBlocks = buildTranslationCacheBlocks(prefix, listingDraft);
    return {
      filled,
      fixedContentBlocks,
      runtimeAgentId: 'cache_aware',
      promptDebug: {
        agentId: 'cache_aware',
        promptChars: filled.length,
        fixedBlocks: fixedContentBlocks,
        source: 'cache-aware-prelaunch',
      },
    };
  };

  async function runTranslationCacheWarmup(prefix, listingDraft) {
    const promptData = buildTranslationCacheWarmupPromptData(prefix, listingDraft);
    const response = await global.callClaude('cache_aware', promptData, false);
    global.showAgentCost?.('cache_aware', response?.usage || null, {
      prefix,
      source: 'cache-aware-prelaunch',
    });
    global.syncCacheIndicator?.(response?.usage || null);
    return response;
  }

  const finalizeTranslationCacheRun = (prefix, finalStatus, ownsRun) => {
    if (!ownsRun) return;
    global.finalizeCacheDebugRun?.(prefix, finalStatus);
  };

  const validatePublishedTranslationDraft = (draft) => {
    const title = String(draft?.translatedTitle || '').trim();
    const description = String(draft?.translatedDescription || '');
    const tags = Array.isArray(draft?.translatedTags) ? draft.translatedTags : [];
    const normalizedTags = tags
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const reasons = [];

    if (!title) reasons.push('titre vide');
    if (title.length > TITLE_MAX_LENGTH) reasons.push(`titre > ${TITLE_MAX_LENGTH}`);
    if (!description.trim()) reasons.push('description vide');
    if (!normalizedTags.length) reasons.push('tags vides');
    if (normalizedTags.length > 13) reasons.push('plus de 13 tags');
    if (normalizedTags.some((tag) => tag.length > TAG_MAX_LENGTH)) {
      reasons.push(`tag > ${TAG_MAX_LENGTH}`);
    }

    return {
      ok: reasons.length === 0,
      reasons,
      title,
      description,
      tags: normalizedTags,
    };
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
      const tags = Array.isArray(parsed.tags_en)
        ? parsed.tags_en
        : Array.isArray(parsed.tagsEn)
          ? parsed.tagsEn
          : Array.isArray(parsed.tags)
            ? parsed.tags
            : typeof parsed.tags_en === 'string'
              ? parsed.tags_en.split(',')
              : typeof parsed.tagsEn === 'string'
                ? parsed.tagsEn.split(',')
                : typeof parsed.tags === 'string'
                  ? parsed.tags.split(',')
                  : [];
      return {
        title: String(parsed.title_en || parsed.titleEn || parsed.title || '').trim(),
        description: String(parsed.description_en || parsed.descriptionEn || parsed.description || ''),
        tags,
      };
    }

    return {
      title: extractLooseJsonString(rawText, 'title_en') || extractLooseJsonString(rawText, 'title'),
      description: extractLooseJsonString(rawText, 'description_en') || extractLooseJsonString(rawText, 'description'),
      tags: extractLooseJsonTags(rawText, 'tags_en').length
        ? extractLooseJsonTags(rawText, 'tags_en')
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
    entry.characterFr = getTrimmedValue(prefix, 'translation-en-character-fr');
    entry.universeFr = getTrimmedValue(prefix, 'translation-en-universe-fr');
    entry.characterEn = getTrimmedValue(prefix, 'translation-en-character-en');
    entry.universeEn = getTrimmedValue(prefix, 'translation-en-universe-en');
    persistPrefixState(prefix);
  };

  const setActiveSubtab = (prefix, subtab = 'fr') => {
    const entry = ensurePrefixState(prefix);
    entry.activeSubtab = TRANSLATION_LANGUAGES.includes(subtab) ? subtab : 'fr';
    renderPrefixState(prefix);
    persistPrefixState(prefix);
  };

  const updateListingStateFromFields = (prefix, options = {}) => {
    const rerender = options?.rerender !== false;
    const listingDraft = ensurePrefixState(prefix).listingDraft;
    listingDraft.listingRef = getTrimmedValue(prefix, 'translation-en-listing-ref');
    listingDraft.sourceTitle = String(readField(prefix, 'translation-en-source-title')?.value || '');
    listingDraft.sourceDescription = String(readField(prefix, 'translation-en-source-description')?.value || '');
    listingDraft.translatedTitle = String(readField(prefix, 'translation-en-translated-title')?.value || '');
    listingDraft.translatedDescription = String(readField(prefix, 'translation-en-translated-description')?.value || '');
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
    const bulk = getBulkState(prefix);
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

    renderTranslationSubtabs(prefix);

    const sourceStatusNode = readField(prefix, 'translation-en-source-status');
    if (sourceStatusNode) sourceStatusNode.textContent = listingDraft.sourceStatus || DEFAULT_SOURCE_STATUS;

    const translationOutputNode = readField(prefix, 'out-traduction_listing_en');
    if (translationOutputNode) {
      translationOutputNode.textContent = listingDraft.translationOutput || DEFAULT_TRANSLATION_OUTPUT;
      translationOutputNode.classList.toggle('empty', !String(listingDraft.translationOutput || '').trim());
    }
    const translationDebugNode = readField(prefix, 'translation-en-debug');
    if (translationDebugNode) {
      translationDebugNode.textContent = String(listingDraft.translationDebug || 'Aucun debug disponible.');
    }

    const translationStatusNode = readField(prefix, 'translation-en-translation-status');
    if (translationStatusNode) translationStatusNode.textContent = listingDraft.translationStatus || DEFAULT_TRANSLATION_STATUS;

    const bulkTranslateButton = readField(prefix, 'translation-bulk-translate');
    if (bulkTranslateButton) bulkTranslateButton.disabled = bulk.running === true;
    const updateTranslateButton = readField(prefix, 'translation-update-translate');
    if (updateTranslateButton) updateTranslateButton.disabled = bulk.running === true;
    const bulkStopButton = readField(prefix, 'translation-bulk-stop');
    if (bulkStopButton) bulkStopButton.disabled = bulk.running !== true;
    const bulkPublishButton = readField(prefix, 'translation-bulk-publish');
    if (bulkPublishButton) bulkPublishButton.disabled = !canPublishAllTranslations(prefix);
    const updatePublishButton = readField(prefix, 'translation-update-publish');
    if (updatePublishButton) {
      updatePublishButton.disabled = bulk.running === true
        || !UPDATE_TRANSLATION_LANGUAGES.some((language) => bulk.languages?.[language] === 'success');
    }
    const bulkStatusNode = readField(prefix, 'translation-bulk-status');
    if (bulkStatusNode) bulkStatusNode.textContent = bulk.status || DEFAULT_BULK_STATUS;

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
      return { ok: false, reason: 'missing_source' };
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
      resetBulkTranslationState(prefix);
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
          listingRef: listingDraft.listingRef,
          sourceTitle: listingDraft.sourceTitle,
          sourceDescription: listingDraft.sourceDescription,
          sourceTags: [...listingDraft.sourceTags],
          pendingSourceTagsInput: '',
          sourceStatus: listingDraft.sourceStatus,
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
          listingRef: listingDraft.listingRef,
          sourceTitle: listingDraft.sourceTitle,
          sourceDescription: listingDraft.sourceDescription,
          sourceTags: [...listingDraft.sourceTags],
          pendingSourceTagsInput: '',
          sourceStatus: listingDraft.sourceStatus,
          translatedTitle: '',
          translatedDescription: '',
          translatedTags: [],
          pendingTranslatedTagsInput: '',
          translationOutput: '',
          translationInput: '',
          translationStatus: '',
        };
      }
      [
        [global.PipelineUITranslationItRuntime, 'ensureTranslationItState'],
        [global.PipelineUITranslationNlRuntime, 'ensureTranslationNlState'],
        [global.PipelineUITranslationPtRuntime, 'ensureTranslationPtState'],
      ].forEach(([runtime, ensureStateMethod]) => {
        const targetEntry = runtime?.[ensureStateMethod]?.(prefix);
        if (!targetEntry) return;
        Object.assign(targetEntry, {
          characterFr: '',
          universeFr: '',
          characterEn: '',
          universeEn: '',
          output: '',
          status: '',
          lastInput: '',
          listingDraft: {
            ...targetEntry.listingDraft,
            listingRef: listingDraft.listingRef,
            sourceTitle: listingDraft.sourceTitle,
            sourceDescription: listingDraft.sourceDescription,
            sourceTags: [...listingDraft.sourceTags],
            pendingSourceTagsInput: '',
            sourceStatus: listingDraft.sourceStatus,
            translatedTitle: '',
            translatedDescription: '',
            translatedTags: [],
            pendingTranslatedTagsInput: '',
            translationOutput: '',
            translationInput: '',
            translationStatus: '',
          },
        });
      });
      setSourceStatus(prefix, `Fiche source ${listingId} chargee.`);
      renderPrefixState(prefix);
      persistPrefixState(prefix);
      global.PipelineUITranslationDeRuntime?.renderTranslationDeState?.(prefix);
      global.PipelineUITranslationDeRuntime?.persistTranslationDeState?.(prefix);
      global.PipelineUITranslationEsRuntime?.renderTranslationEsState?.(prefix);
      global.PipelineUITranslationEsRuntime?.persistTranslationEsState?.(prefix);
      global.PipelineUITranslationItRuntime?.renderTranslationItState?.(prefix);
      global.PipelineUITranslationItRuntime?.persistTranslationItState?.(prefix);
      global.PipelineUITranslationNlRuntime?.renderTranslationNlState?.(prefix);
      global.PipelineUITranslationNlRuntime?.persistTranslationNlState?.(prefix);
      global.PipelineUITranslationPtRuntime?.renderTranslationPtState?.(prefix);
      global.PipelineUITranslationPtRuntime?.persistTranslationPtState?.(prefix);
      global.showToast('Fiche source EN chargee');
    } catch (error) {
      setSourceStatus(prefix, `Lecture Etsy impossible : ${error.message}`);
      global.showToast(`Etsy API : ${error.message}`, '#ff4757');
    } finally {
      if (loadButton) loadButton.disabled = false;
    }
  }

  async function runTranslationEnListing(prefix = global.pfx(), options = {}) {
    updateMappingStateFromFields(prefix);
    updateListingStateFromFields(prefix);
    const silent = options?.silent === true;
    const ownsCacheRun = beginTranslationCacheRun(prefix, 'traduction EN', [TRANSLATION_LISTING_AGENT_ID]);

    const entry = ensurePrefixState(prefix);
    const listingDraft = entry.listingDraft;
    const translateButton = readField(prefix, 'translation-en-translate');
    const sourceTagsCsv = (getEtsyData().normalizeAttributeTags?.(listingDraft.sourceTags || []) || listingDraft.sourceTags || []).join(', ');

    if (!listingDraft.sourceTitle || !listingDraft.sourceDescription || !sourceTagsCsv) {
      setTranslationStatus(prefix, 'Traduction impossible : charge puis complète titre, tags et description source.');
      setTranslationLanguageStatus(prefix, 'en', 'error');
      if (!silent) global.showToast('Titre, tags et description source requis', '#ff4757');
      return;
    }

    if (translateButton) translateButton.disabled = true;
    resetTranslationLanguageRunState(prefix, 'en');
    setTranslationLanguageStatus(prefix, 'en', 'running');
    try {
      await ensurePromptLoaded(TRANSLATION_LISTING_AGENT_ID, TRANSLATION_LISTING_PROMPT_PATH);
      const template = String(getPromptCache()[TRANSLATION_LISTING_AGENT_ID] || '').trim();
      const fixedContentBlocks = buildTranslationCacheBlocks(prefix, listingDraft);
      const filled = template
        .replace(/\[\[CHARACTER_FR\]\]/g, entry.characterFr)
        .replace(/\[\[UNIVERSE_FR\]\]/g, entry.universeFr)
        .replace(/\[\[CHARACTER_EN\]\]/g, entry.characterEn)
        .replace(/\[\[UNIVERSE_EN\]\]/g, entry.universeEn)
        .replace(/\[\[SOURCE_TITLE\]\]/g, '[voir TITLE dans SOURCE_FR_LISTING mis en cache]')
        .replace(/\[\[SOURCE_TAGS\]\]/g, '[voir TAGS dans SOURCE_FR_LISTING mis en cache]')
        .replace(/\[\[SOURCE_DESCRIPTION\]\]/g, '[voir bloc SOURCE_FR_LISTING mis en cache]');
      const filledWithInjectionNote = `${filled}\n\nNOTE TECHNIQUE:\n- Traduis uniquement la partie variable de la description.\n- Les blocs fixes de fin sont injectes automatiquement apres traduction.\n- Ne reecris pas les blocs fixes de fin dans description_en.`;

      listingDraft.translationInput = filledWithInjectionNote;
      getState().inputs[`${prefix}:${TRANSLATION_LISTING_AGENT_ID}`] = filledWithInjectionNote;
      setTranslationStatus(prefix, `Traduction EN en cours (${getModel(TRANSLATION_LISTING_AGENT_ID)})...`);

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
      listingDraft.translatedDescription = buildInjectedTranslationDescription(prefix, 'en', extracted.description || '');
      listingDraft.translatedTags = getEtsyData().normalizeAttributeTags?.(extracted.tags || []) || extracted.tags || [];
      listingDraft.pendingTranslatedTagsInput = '';
      const descriptionField = readField(prefix, 'translation-en-translated-description');
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
      setTranslationStatus(prefix, 'Traduction EN terminee.');
      renderPrefixState(prefix);
      persistPrefixState(prefix);
      setTranslationLanguageStatus(prefix, 'en', 'success');
      if (!silent) global.showToast('Traduction EN terminee');
      finalizeTranslationCacheRun(prefix, 'Traduction EN terminee', ownsCacheRun);
      return { ok: true };
    } catch (error) {
      listingDraft.translationOutput = '';
      listingDraft.translationDebug = '';
      setTranslationStatus(prefix, `Erreur traduction EN : ${error.message}`);
      setTranslationLanguageStatus(prefix, 'en', 'error');
      if (!silent) global.showToast(`Erreur traduction EN: ${error.message}`, '#ff4757');
      finalizeTranslationCacheRun(prefix, `Erreur traduction EN : ${error.message}`, ownsCacheRun);
      return { ok: false, reason: error.message };
    } finally {
      if (translateButton) translateButton.disabled = false;
    }
  }

  async function runAllTranslations(prefix = global.pfx(), targetLanguages = TRANSLATION_LANGUAGES) {
    const selectedLanguages = TRANSLATION_LANGUAGES.filter((language) => targetLanguages.includes?.(language));
    const languageLabel = selectedLanguages.map((language) => language.toUpperCase()).join(' / ');
    if (!selectedLanguages.length) return { ok: false, successCount: 0, errorCount: 0 };
    const entry = ensurePrefixState(prefix);
    const listingDraft = entry.listingDraft;
    if (!listingDraft.sourceTitle || !listingDraft.sourceDescription || !(Array.isArray(listingDraft.sourceTags) && listingDraft.sourceTags.length)) {
      setBulkTranslationStatus(prefix, 'Source FR incomplete : charge la fiche puis corrige titre, tags et description.');
      global.showToast('Source FR incomplete pour la traduction globale', '#ff4757');
      return { ok: false, successCount: 0, errorCount: selectedLanguages.length };
    }

    resetBulkTranslationState(prefix);
    const listingAgentByLanguage = {
      en: TRANSLATION_LISTING_AGENT_ID,
      de: 'traduction_listing_de',
      es: 'traduction_listing_es',
      it: 'traduction_listing_it',
      nl: 'traduction_listing_nl',
      pt: 'traduction_listing_pt',
    };
    const ownsCacheRun = beginTranslationCacheRun(
      prefix,
      `traduction ${languageLabel}`,
      selectedLanguages.map((language) => listingAgentByLanguage[language]),
    );
    setBulkTranslationRunning(prefix, true);
    setBulkTranslationStatus(prefix, 'Warmup cache traduction en cours...');

    try {
      await runTranslationCacheWarmup(prefix, listingDraft);
    } catch (error) {
      setBulkTranslationRunning(prefix, false);
      const message = `Warmup cache traduction impossible : ${error.message}`;
      setBulkTranslationStatus(prefix, message);
      global.showToast(message, '#ff4757');
      finalizeTranslationCacheRun(prefix, message, ownsCacheRun);
      return { ok: false, successCount: 0, errorCount: selectedLanguages.length, warmupFailed: true };
    }

    setBulkTranslationStatus(prefix, `Traduction ${languageLabel} en cours...`);

    const results = [];
    const jobs = [
      ['en', () => runTranslationEnListing(prefix, { silent: true })],
      ['de', () => global.runTranslationDeListing?.(prefix, { silent: true })],
      ['es', () => global.runTranslationEsListing?.(prefix, { silent: true })],
      ['it', () => global.runTranslationItListing?.(prefix, { silent: true })],
      ['nl', () => global.runTranslationNlListing?.(prefix, { silent: true })],
      ['pt', () => global.runTranslationPtListing?.(prefix, { silent: true })],
    ].filter(([language]) => selectedLanguages.includes(language));

    for (const [language, job] of jobs) {
      if (isBulkTranslationStopRequested(prefix)) {
        results.push({ language, ok: false, stopped: true });
        break;
      }
      setTranslationLanguageStatus(prefix, language, 'running');
      try {
        const result = await job();
        const ok = result?.ok === true;
        setTranslationLanguageStatus(prefix, language, ok ? 'success' : 'error');
        results.push({ language, ok });
        if (isBulkTranslationStopRequested(prefix)) break;
      } catch (error) {
        setTranslationLanguageStatus(prefix, language, 'error');
        results.push({ language, ok: false });
        if (isBulkTranslationStopRequested(prefix)) break;
      }
    }

    setBulkTranslationRunning(prefix, false);
    const successCount = results.filter((entryResult) => entryResult.ok).length;
    const errorCount = results.length - successCount;
    const summary = isBulkTranslationStopRequested(prefix)
      ? `Traductions stoppees : ${successCount} succes, ${errorCount} erreur(s).`
      : `Traductions terminees : ${successCount} succes, ${errorCount} erreur(s).`;
    setBulkTranslationStatus(prefix, summary);
    global.showToast(summary, errorCount ? '#e8c547' : undefined);
    finalizeTranslationCacheRun(prefix, summary, ownsCacheRun);
    return { ok: successCount > 0, successCount, errorCount };
  }

  async function runUpdateTranslations(prefix = global.pfx()) {
    return runAllTranslations(prefix, UPDATE_TRANSLATION_LANGUAGES);
  }

  function stopAllTranslations(prefix = global.pfx()) {
    requestBulkTranslationStop(prefix);
    TRANSLATION_LANGUAGES.forEach((language) => {
      if (getBulkState(prefix).languages?.[language] === 'running') {
        setTranslationLanguageStatus(prefix, language, 'idle');
      }
    });
    [
      'traduction_en',
      'traduction_listing_en',
      'traduction_de',
      'traduction_listing_de',
      'traduction_es',
      'traduction_listing_es',
      'traduction_it',
      'traduction_listing_it',
      'traduction_nl',
      'traduction_listing_nl',
      'traduction_pt',
      'traduction_listing_pt',
    ].forEach((agentId) => {
      const controller = global.abortControllers?.[agentId];
      if (controller) controller.abort();
      if (global.abortControllers) delete global.abortControllers[agentId];
    });
    setBulkTranslationRunning(prefix, false);
    setBulkTranslationStatus(prefix, 'Traductions stoppees manuellement.');
    global.finalizeCacheDebugRun?.(prefix, 'Traductions stoppees manuellement.');
    global.showToast('Traductions stoppees');
  }

  function handleClaudeRetryEvent(event = {}) {
    const prefix = String(event?.prefix || '').trim();
    const agentId = String(event?.agentId || '').trim();
    if (!prefix || !agentId) return;

    const language = ({
      traduction_listing_en: 'en',
      traduction_listing_de: 'de',
      traduction_listing_es: 'es',
      traduction_listing_it: 'it',
      traduction_listing_nl: 'nl',
      traduction_listing_pt: 'pt',
    })[agentId] || '';
    if (!language) return;
    incrementTranslationRetryCount(prefix, language);
  }

  async function publishAllTranslations(prefix = global.pfx(), targetLanguages = TRANSLATION_LANGUAGES) {
    const selectedLanguages = TRANSLATION_LANGUAGES.filter((language) => targetLanguages.includes?.(language));
    const languageLabel = selectedLanguages.map((language) => language.toUpperCase()).join(' / ');
    const hasReadyTranslation = selectedLanguages.some(
      (language) => getBulkState(prefix).languages?.[language] === 'success',
    );
    if (!selectedLanguages.length || !hasReadyTranslation) {
      global.showToast('Aucune traduction publiable pour le moment', '#ff4757');
      return { ok: false };
    }
    const etsyRuntime = getEtsyRuntime();
    const extractListingId = getEtsyData().extractListingId;
    const entry = ensurePrefixState(prefix);
    const listingId = extractListingId?.(entry.listingDraft.listingRef);
    if (!listingId) {
      global.showToast('Listing Etsy introuvable pour publier les traductions', '#ff4757');
      return { ok: false, reason: 'missing_listing_id' };
    }
    if (!etsyRuntime.publishListingTranslation) {
      global.showToast('API Etsy traduction indisponible', '#ff4757');
      return { ok: false, reason: 'missing_runtime_api' };
    }

    setBulkTranslationRunning(prefix, true);
    setBulkTranslationStatus(prefix, `Publication des traductions ${languageLabel} en cours...`);

    const deEntry = global.PipelineUITranslationDeRuntime?.ensureTranslationDeState?.(prefix);
    const esEntry = global.PipelineUITranslationEsRuntime?.ensureTranslationEsState?.(prefix);
    const itEntry = global.PipelineUITranslationItRuntime?.ensureTranslationItState?.(prefix);
    const nlEntry = global.PipelineUITranslationNlRuntime?.ensureTranslationNlState?.(prefix);
    const ptEntry = global.PipelineUITranslationPtRuntime?.ensureTranslationPtState?.(prefix);
    const jobs = [
      {
        language: 'en',
        state: getBulkState(prefix).languages.en,
        draft: entry.listingDraft,
      },
      {
        language: 'de',
        state: getBulkState(prefix).languages.de,
        draft: deEntry?.listingDraft || null,
      },
      {
        language: 'es',
        state: getBulkState(prefix).languages.es,
        draft: esEntry?.listingDraft || null,
      },
      {
        language: 'it',
        state: getBulkState(prefix).languages.it,
        draft: itEntry?.listingDraft || null,
      },
      {
        language: 'nl',
        state: getBulkState(prefix).languages.nl,
        draft: nlEntry?.listingDraft || null,
      },
      {
        language: 'pt',
        state: getBulkState(prefix).languages.pt,
        draft: ptEntry?.listingDraft || null,
      },
    ].filter((job) => selectedLanguages.includes(job.language));

    const results = [];
    for (const job of jobs) {
      if (job.state !== 'success' || !job.draft) {
        results.push({ language: job.language, ok: false, skipped: true, reason: 'langue non prete' });
        continue;
      }

      const validated = validatePublishedTranslationDraft(job.draft);
      if (!validated.ok) {
        setTranslationLanguageStatus(prefix, job.language, 'error');
        results.push({
          language: job.language,
          ok: false,
          skipped: false,
          reason: validated.reasons.join(', '),
        });
        continue;
      }

      try {
        await etsyRuntime.publishListingTranslation({
          listingId,
          language: job.language,
          title: validated.title,
          description: validated.description,
          tags: validated.tags,
        });
        results.push({ language: job.language, ok: true });
      } catch (error) {
        setTranslationLanguageStatus(prefix, job.language, 'error');
        const apiMessage = String(
          error?.payload?.error
            || error?.payload?.message
            || error?.message
            || 'erreur Etsy inconnue',
        ).trim();
        console.error(`[translations] publish ${job.language} failed`, {
          language: job.language,
          listingId,
          route: error?.route || etsyRuntime.getListingTranslationRoute?.() || '',
          error,
          payload: error?.payload,
        });
        results.push({
          language: job.language,
          ok: false,
          skipped: false,
          reason: apiMessage || 'erreur Etsy inconnue',
        });
      }
    }

    setBulkTranslationRunning(prefix, false);
    const successCount = results.filter((result) => result.ok).length;
    const errorCount = results.filter((result) => !result.ok && !result.skipped).length;
    const skippedCount = results.filter((result) => result.skipped).length;
    const errorDetails = results
      .filter((result) => !result.ok && !result.skipped && result.reason)
      .map((result) => `${String(result.language || '').toUpperCase()}: ${result.reason}`)
      .join(' | ');
    const summary = `Publication traductions terminee : ${successCount} succes, ${errorCount} erreur(s), ${skippedCount} ignoree(s).`;
    setBulkTranslationStatus(prefix, summary);
    if (errorDetails) {
      setBulkTranslationStatus(prefix, `${summary} ${errorDetails}`);
    }
    global.showToast(summary, errorCount ? '#e8c547' : undefined);
    return { ok: successCount > 0, successCount, errorCount, skippedCount, results };
  }

  async function publishUpdateTranslations(prefix = global.pfx()) {
    return publishAllTranslations(prefix, UPDATE_TRANSLATION_LANGUAGES);
  }

  async function publishSingleTranslation(prefix = global.pfx(), language = 'en', draftOverride = null) {
    const etsyRuntime = getEtsyRuntime();
    const extractListingId = getEtsyData().extractListingId;
    const entry = ensurePrefixState(prefix);
    const listingId = extractListingId?.(entry.listingDraft.listingRef);
    if (!listingId) {
      global.showToast('Listing Etsy introuvable pour publier la traduction', '#ff4757');
      return { ok: false, reason: 'missing_listing_id' };
    }
    if (!etsyRuntime.publishListingTranslation) {
      global.showToast('API Etsy traduction indisponible', '#ff4757');
      return { ok: false, reason: 'missing_runtime_api' };
    }

    const normalizedLanguage = TRANSLATION_LANGUAGES.includes(String(language || '').trim().toLowerCase())
      ? String(language || '').trim().toLowerCase()
      : 'en';
    const draft = draftOverride && typeof draftOverride === 'object' ? draftOverride : entry.listingDraft;
    const validated = validatePublishedTranslationDraft(draft);
    if (!validated.ok) {
      setTranslationLanguageStatus(prefix, normalizedLanguage, 'error');
      const message = `${normalizedLanguage.toUpperCase()} non publiable : ${validated.reasons.join(', ')}`;
      global.showToast(message, '#ff4757');
      return { ok: false, reason: validated.reasons.join(', ') };
    }

    try {
      await etsyRuntime.publishListingTranslation({
        listingId,
        language: normalizedLanguage,
        title: validated.title,
        description: validated.description,
        tags: validated.tags,
      });
      setTranslationLanguageStatus(prefix, normalizedLanguage, 'success');
      global.showToast(`Traduction ${normalizedLanguage.toUpperCase()} publiee`);
      return { ok: true };
    } catch (error) {
      setTranslationLanguageStatus(prefix, normalizedLanguage, 'error');
      const apiMessage = String(
        error?.payload?.error
          || error?.payload?.message
          || error?.message
          || 'erreur Etsy inconnue',
      ).trim();
      console.error(`[translations] publish ${normalizedLanguage} failed`, {
        language: normalizedLanguage,
        listingId,
        route: error?.route || etsyRuntime.getListingTranslationRoute?.() || '',
        error,
        payload: error?.payload,
      });
      global.showToast(`Erreur publication ${normalizedLanguage.toUpperCase()} : ${apiMessage}`, '#ff4757');
      return { ok: false, reason: apiMessage };
    }
  }

  async function publishTranslationEn(prefix = global.pfx()) {
    return publishSingleTranslation(prefix, 'en', ensurePrefixState(prefix).listingDraft);
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
      ? '</> INPUT - Traduction EN'
      : '</> INPUT - Traduction fiche EN';
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
    const raw = String(
      ensurePrefixState(prefix).listingDraft.translationInput
      || getState().inputs[`${prefix}:${TRANSLATION_LISTING_AGENT_ID}`]
      || '',
    ).trim();
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
    TRANSLATION_SUBTABS.forEach((subtab) => {
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
      field.addEventListener('input', () => updateListingStateFromFields(prefix, { rerender: false }));
      if (suffix === 'translation-en-source-title' || suffix === 'translation-en-translated-title') {
        field.addEventListener('input', () => {
          const isSourceTitle = suffix === 'translation-en-source-title';
          const metricNode = readField(prefix, isSourceTitle ? 'translation-en-source-title-meta' : 'translation-en-translated-title-meta');
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
    syncTranslationTimerTicker();
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
    runAllTranslations,
    runUpdateTranslations,
    publishAllTranslations,
    publishUpdateTranslations,
    publishSingleTranslation,
    publishTranslationEn,
    stopAllTranslations,
    beginTranslationCacheRun,
    finalizeTranslationCacheRun,
    handleClaudeRetryEvent,
    setTranslationLanguageStatus,
    resetTranslationLanguageRunState,
    canPublishAllTranslations,
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

  const previousClaudeRetryHandler = global.handleClaudeRetryEvent;
  global.handleClaudeRetryEvent = function handleClaudeRetryEventChain(event = {}) {
    global.PipelineUITranslationEnRuntime?.handleClaudeRetryEvent?.(event);
    previousClaudeRetryHandler?.(event);
  };

  initAllTranslationEnPanels();
})(window);
