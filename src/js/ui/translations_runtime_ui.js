'use strict';

// Fondation runtime traduction/alias.
// Step 1 volontairement sans grosse UI : état, prompts, coûts et helpers publics.
// Collection + DnD uniquement. Batch exclu.

(function initPipelineUITranslationsRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUITranslationsRuntime = global.PipelineUITranslationsRuntime || {};

  const SUPPORTED_TRANSLATION_LANGUAGES = Object.freeze({
    fr: { label: 'Français' },
    en: { label: 'English' },
    de: { label: 'Deutsch' },
    es: { label: 'Español' },
  });

  const TRANSLATION_AGENT_IDS = Object.freeze({
    alias: 'alias_lookup',
    translate: 'translate_listing',
  });

  const getState = () => global.state || {};
  const getCurrentMode = () => global.currentMode || 'tabletop';
  const getCurrentPrefix = () => (typeof global.pfx === 'function' ? global.pfx() : 'tt');
  const getModeFromPrefix = (prefix = 'tt') => (
    typeof global.getPipelineModeByPrefix === 'function'
      ? global.getPipelineModeByPrefix(prefix)
      : (prefix === 'col' ? 'collection' : 'tabletop')
  );

  const createEmptyLanguageResult = () => ({
    title: '',
    tags: '',
    description: '',
    alt: '',
    rawResponse: '',
  });

  const createEmptyWorkspace = () => ({
    source: {
      title: '',
      tags: '',
      description: '',
      alt: '',
      name: '',
      universe: '',
    },
    aliases: {
      fr: { name: '', universe: '' },
      en: { name: '', universe: '' },
      de: { name: '', universe: '' },
      es: { name: '', universe: '' },
    },
    results: {
      fr: createEmptyLanguageResult(),
      en: createEmptyLanguageResult(),
      de: createEmptyLanguageResult(),
      es: createEmptyLanguageResult(),
    },
    meta: {
      sourceCapturedAt: '',
      aliasLookupAt: '',
      translatedAtByLanguage: {},
    },
  });

  const normalizeLanguage = (language = '') => {
    const normalized = String(language || '').trim().toLowerCase();
    return SUPPORTED_TRANSLATION_LANGUAGES[normalized] ? normalized : '';
  };

  const normalizeLanguages = (languages = []) => Array.from(new Set(
    (Array.isArray(languages) ? languages : [languages])
      .map(normalizeLanguage)
      .filter((language) => language && language !== 'fr'),
  ));

  const getSettings = () => {
    try {
      return JSON.parse(localStorage.getItem('pipeline.settings') || '{}');
    } catch (error) {
      return {};
    }
  };

  const setSettings = (nextSettings = {}) => {
    localStorage.setItem('pipeline.settings', JSON.stringify(nextSettings));
    return nextSettings;
  };

  const ensureTranslationState = (prefix = getCurrentPrefix()) => {
    const state = getState();
    state.translations = state.translations || {};
    if (!state.translations[prefix]) state.translations[prefix] = createEmptyWorkspace();
    return state.translations[prefix];
  };

  const getEnabledTranslationLanguages = (mode = getCurrentMode()) => {
    const settings = getSettings();
    const byMode = settings.translationLanguagesByMode || {};
    return normalizeLanguages(byMode[mode] || []);
  };

  const setEnabledTranslationLanguages = (mode = getCurrentMode(), languages = []) => {
    const settings = getSettings();
    settings.translationLanguagesByMode = settings.translationLanguagesByMode || {};
    settings.translationLanguagesByMode[mode] = normalizeLanguages(languages);
    setSettings(settings);
    return settings.translationLanguagesByMode[mode];
  };

  const getVisibleTranslationLanguages = (mode = getCurrentMode()) => ['fr', ...getEnabledTranslationLanguages(mode)];

  const getFieldValue = (fieldId = '') => document.getElementById(fieldId)?.value?.trim() || '';

  const getSourceIdentity = (prefix = getCurrentPrefix()) => ({
    name: getFieldValue(`${prefix}-fNomCourt`) || getFieldValue(`${prefix}-fNom`) || '',
    universe: getFieldValue(`${prefix}-fUnivers`) || '',
  });

  const syncSourceAliases = (prefix = getCurrentPrefix(), options = {}) => {
    const workspace = ensureTranslationState(prefix);
    const identity = getSourceIdentity(prefix);
    const sourceOverride = options.sourceOverride || {};

    const sourceName = String(sourceOverride.name || workspace.source.name || identity.name || '').trim();
    const sourceUniverse = String(sourceOverride.universe || workspace.source.universe || identity.universe || '').trim();

    workspace.source.name = sourceName;
    workspace.source.universe = sourceUniverse;
    workspace.aliases.fr = {
      name: sourceName,
      universe: sourceUniverse,
    };
    return workspace;
  };

  const mergeAliasesIntoWorkspace = (workspace, aliasesOverride = {}, languages = []) => {
    const normalizedLanguages = ['fr', ...normalizeLanguages(languages.length ? languages : Object.keys(aliasesOverride))];

    normalizedLanguages.forEach((language) => {
      const incoming = aliasesOverride?.[language];
      if (!incoming) return;

      workspace.aliases[language] = {
        name: String(incoming.name || workspace.aliases[language]?.name || '').trim(),
        universe: String(incoming.universe || workspace.aliases[language]?.universe || '').trim(),
      };
    });

    return workspace;
  };

  const captureTranslationSource = (prefix = getCurrentPrefix(), options = {}) => {
    const workspace = syncSourceAliases(prefix, options);
    const state = getState();
    const sourceOverride = options.sourceOverride || {};
    const description = state.outputs?.description_assembled || state.outputs?.description || '';

    mergeAliasesIntoWorkspace(workspace, options.aliasesOverride || {}, Object.keys(options.aliasesOverride || {}));

    workspace.source = {
      ...workspace.source,
      title: String(sourceOverride.title || state.outputs?.titre_valide || workspace.source.title || '').trim(),
      tags: String(sourceOverride.tags || state.outputs?.tags || workspace.source.tags || '').trim(),
      description: String(sourceOverride.description || description || workspace.source.description || '').trim(),
      alt: String(sourceOverride.alt || state.outputs?.alt || workspace.source.alt || '').trim(),
      name: String(sourceOverride.name || workspace.aliases.fr?.name || workspace.source.name || '').trim(),
      universe: String(sourceOverride.universe || workspace.aliases.fr?.universe || workspace.source.universe || '').trim(),
    };

    workspace.results.fr = {
      title: workspace.source.title,
      tags: workspace.source.tags,
      description: workspace.source.description,
      alt: workspace.source.alt,
      rawResponse: '',
    };
    workspace.meta.sourceCapturedAt = new Date().toISOString();
    return workspace;
  };

  const getPromptFileMapForMode = (mode = getCurrentMode()) => {
    const config = global.PipelineUIConfig || {};
    return mode === 'collection' ? config.PROMPT_FILE_MAP_COLLECTION || {} : config.PROMPT_FILE_MAP || {};
  };

  const ensurePromptTemplate = async (mode = getCurrentMode(), agentId = '') => {
    const state = getState();
    state.promptsByMode = state.promptsByMode || { tabletop: {}, collection: {} };
    state.promptsByMode[mode] = state.promptsByMode[mode] || {};

    const existing = String(state.promptsByMode[mode][agentId] || '').trim();
    if (existing) return existing;

    const fileMap = getPromptFileMapForMode(mode);
    const fileName = fileMap[agentId] || agentId;
    const response = await fetch(`/files/prompts/${mode}/${fileName}.md`);
    if (!response.ok) throw new Error(`Prompt introuvable: ${mode}/${fileName}.md`);

    const template = await response.text();
    state.promptsByMode[mode][agentId] = template;
    return template;
  };

  const fillTemplate = (template = '', replacements = {}) => {
    return Object.entries(replacements).reduce((output, [key, value]) => {
      const safeValue = value == null ? '' : String(value);
      const token = new RegExp(`\\[\\[${key}\\]\\]`, 'g');
      return output.replace(token, safeValue);
    }, String(template || ''));
  };

  const parseJsonResponse = (raw = '') => {
    const input = String(raw || '').trim();
    if (!input) return null;

    const fencedMatch = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonCandidate = fencedMatch?.[1]?.trim() || input;

    try {
      return JSON.parse(jsonCandidate);
    } catch (error) {
      return null;
    }
  };

  const serializeKnownAliases = (aliases = {}, languages = []) => {
    const allLanguages = ['fr', ...normalizeLanguages(languages)];
    return allLanguages
      .map((language) => {
        const entry = aliases[language] || {};
        return `${language.toUpperCase()} | nom: ${entry.name || '—'} | univers: ${entry.universe || '—'}`;
      })
      .join('\n');
  };

  const normalizeAliasLookupResult = (parsed, workspace, activeLanguages) => {
    const normalized = {};
    const sourceName = workspace.source.name || workspace.aliases.fr?.name || '';
    const sourceUniverse = workspace.source.universe || workspace.aliases.fr?.universe || '';

    ['fr', ...normalizeLanguages(activeLanguages)].forEach((language) => {
      const incoming = parsed?.[language] || {};
      normalized[language] = {
        name: String(incoming.name || sourceName).trim() || sourceName,
        universe: String(incoming.universe || sourceUniverse).trim() || sourceUniverse,
      };
    });

    return normalized;
  };

  const runAliasLookup = async (prefix = getCurrentPrefix(), options = {}) => {
    const mode = getModeFromPrefix(prefix);
    const activeLanguages = normalizeLanguages(options.languages || getEnabledTranslationLanguages(mode));
    const workspace = captureTranslationSource(prefix, options);
    mergeAliasesIntoWorkspace(workspace, options.aliasesOverride || {}, activeLanguages);

    if (!activeLanguages.length) {
      return workspace;
    }

    const template = await ensurePromptTemplate(mode, TRANSLATION_AGENT_IDS.alias);
    const prompt = fillTemplate(template, {
      ACTIVE_LANGUAGES: activeLanguages.join(', '),
      SOURCE_NAME: workspace.source.name,
      SOURCE_UNIVERS: workspace.source.universe,
      KNOWN_ALIASES: serializeKnownAliases(workspace.aliases, activeLanguages),
    });

    const response = await global.callClaude(TRANSLATION_AGENT_IDS.alias, prompt, false, 2);
    global.showAgentCost?.(TRANSLATION_AGENT_IDS.alias, response?.usage || null, { prefix, source: 'translation' });

    const parsed = parseJsonResponse(response?.text || '');
    const normalized = normalizeAliasLookupResult(parsed, workspace, activeLanguages);

    Object.entries(normalized).forEach(([language, entry]) => {
      workspace.aliases[language] = entry;
    });

    workspace.meta.aliasLookupAt = new Date().toISOString();
    return workspace;
  };

  const normalizeTranslationResult = (parsed, workspace, targetLanguage, rawResponse = '') => {
    const fallback = workspace.results.fr || workspace.source;
    return {
      title: String(parsed?.title || fallback.title || '').trim(),
      tags: String(parsed?.tags || fallback.tags || '').trim(),
      description: String(parsed?.description || fallback.description || '').trim(),
      alt: String(parsed?.alt || fallback.alt || '').trim(),
      rawResponse: String(rawResponse || '').trim(),
    };
  };

  const runTranslation = async (prefix = getCurrentPrefix(), targetLanguage = 'en', options = {}) => {
    const mode = getModeFromPrefix(prefix);
    const language = normalizeLanguage(targetLanguage);
    const workspace = captureTranslationSource(prefix, options);
    mergeAliasesIntoWorkspace(workspace, options.aliasesOverride || {}, [language]);

    if (!language || language === 'fr') {
      return workspace;
    }

    const template = await ensurePromptTemplate(mode, TRANSLATION_AGENT_IDS.translate);
    const aliases = workspace.aliases[language] || {};
    const prompt = fillTemplate(template, {
      TARGET_LANGUAGE: language,
      TARGET_LANGUAGE_LABEL: SUPPORTED_TRANSLATION_LANGUAGES[language]?.label || language,
      SOURCE_TITLE: workspace.source.title,
      SOURCE_TAGS: workspace.source.tags,
      SOURCE_DESCRIPTION: workspace.source.description,
      SOURCE_ALT: workspace.source.alt,
      SOURCE_NAME: workspace.source.name,
      SOURCE_UNIVERS: workspace.source.universe,
      TARGET_ALIAS_NAME: aliases.name || workspace.source.name,
      TARGET_ALIAS_UNIVERS: aliases.universe || workspace.source.universe,
      TRANSLATION_FORMAT: '{"title":"...","tags":"...","description":"...","alt":"..."}',
    });

    const response = await global.callClaude(TRANSLATION_AGENT_IDS.translate, prompt, false, 2);
    global.showAgentCost?.(TRANSLATION_AGENT_IDS.translate, response?.usage || null, { prefix, source: 'translation' });

    const parsed = parseJsonResponse(response?.text || '');
    workspace.results[language] = normalizeTranslationResult(parsed, workspace, language, response?.text || '');
    workspace.meta.translatedAtByLanguage[language] = new Date().toISOString();
    return workspace;
  };

  const resetTranslationWorkspace = (prefix = getCurrentPrefix()) => {
    const state = getState();
    state.translations = state.translations || {};
    state.translations[prefix] = createEmptyWorkspace();
    return state.translations[prefix];
  };

  global.PipelineUITranslationsRuntime = {
    SUPPORTED_TRANSLATION_LANGUAGES,
    TRANSLATION_AGENT_IDS,
    ensureTranslationState,
    getEnabledTranslationLanguages,
    setEnabledTranslationLanguages,
    getVisibleTranslationLanguages,
    captureTranslationSource,
    runAliasLookup,
    runTranslation,
    resetTranslationWorkspace,
  };

  global.PipelineUI.translationsRuntime = global.PipelineUI.translationsRuntime || {};
  Object.assign(global.PipelineUI.translationsRuntime, global.PipelineUITranslationsRuntime);
  Object.assign(global, global.PipelineUITranslationsRuntime);
})(window);
