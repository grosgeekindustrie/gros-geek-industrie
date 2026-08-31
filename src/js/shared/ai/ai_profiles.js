(function initPipelineUIAIProfiles(global) {
  'use strict';

  const SETTINGS_KEY = 'pipeline.settings';
  const PROFILE_VERSION = 3;
  const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5';
  const TRANSLATION_CLAUDE_MODEL = 'claude-sonnet-4-6';
  const DEFAULT_OPENAI_MODEL = 'gpt-5.6-sol';
  const DEFAULT_OPENAI_REASONING_EFFORT = 'medium';
  const DEFAULT_DESCRIPTION_RESEARCH = Object.freeze({
    enabled: true,
    model: 'gpt-5.6-luna',
    reasoningEffort: 'low',
    maxToolCalls: 2,
    searchContextSize: 'low',
    reuseIdentical: true,
  });
  const PROFILE_IDS = Object.freeze({
    LEGACY: 'claude-legacy', CUSTOM: 'claude-custom',
    CLAUDE_LEGACY: 'claude-legacy', CLAUDE_CUSTOM: 'claude-custom',
    OPENAI_STANDARD: 'openai-standard', OPENAI_CUSTOM: 'openai-custom',
  });
  const TASK_IDS = Object.freeze(['title', 'tags', 'description', 'alt', 'translations', 'social']);
  const SUPPORTED_CLAUDE_MODELS = Object.freeze([
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { value: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
    { value: 'claude-sonnet-4-0', label: 'Claude Sonnet 4.0' },
    { value: 'claude-opus-4-1', label: 'Claude Opus 4.1' },
    { value: 'claude-opus-4-0', label: 'Claude Opus 4.0' },
    { value: 'claude-3-7-sonnet-latest', label: 'Claude Sonnet 3.7' },
    { value: 'claude-3-5-sonnet-latest', label: 'Claude Sonnet 3.5' },
  ].map(Object.freeze));
  const SUPPORTED_OPENAI_MODELS = Object.freeze([
    { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
    { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
  ].map(Object.freeze));
  const SUPPORTED_OPENAI_REASONING_EFFORTS = Object.freeze([
    { value: 'none', label: 'Aucun' }, { value: 'low', label: 'Faible' },
    { value: 'medium', label: 'Moyen' }, { value: 'high', label: 'Élevé' },
    { value: 'xhigh', label: 'Très élevé' }, { value: 'max', label: 'Maximum' },
  ].map(Object.freeze));
  const CLAUDE_MODEL_IDS = new Set(SUPPORTED_CLAUDE_MODELS.map(({ value }) => value));
  const OPENAI_MODEL_IDS = new Set(SUPPORTED_OPENAI_MODELS.map(({ value }) => value));
  const OPENAI_EFFORT_IDS = new Set(SUPPORTED_OPENAI_REASONING_EFFORTS.map(({ value }) => value));
  const SEARCH_CONTEXT_SIZES = new Set(['low', 'medium', 'high']);
  const KNOWN_PROFILE_IDS = new Set(Object.values(PROFILE_IDS));
  const clone = (value) => JSON.parse(JSON.stringify(value));

  const readSettings = () => {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(SETTINGS_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) { return {}; }
  };
  const writeSettings = (settings) => global.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  const normalizeClaudeModel = (value, fallback = DEFAULT_CLAUDE_MODEL) => {
    const candidate = String(value || '').trim();
    return CLAUDE_MODEL_IDS.has(candidate) ? candidate : fallback;
  };
  const normalizeOpenAIModel = (value, fallback = DEFAULT_OPENAI_MODEL) => {
    const candidate = String(value || '').trim();
    return OPENAI_MODEL_IDS.has(candidate) ? candidate : fallback;
  };
  const normalizeOpenAIReasoningEffort = (value, fallback = DEFAULT_OPENAI_REASONING_EFFORT) => {
    const candidate = String(value || '').trim();
    return OPENAI_EFFORT_IDS.has(candidate) ? candidate : fallback;
  };
  const getProviderForProfileId = (profileId = '') => String(profileId).startsWith('openai-') ? 'openai' : 'anthropic';
  const buildUniformRoutes = (model) => Object.fromEntries(TASK_IDS.map((task) => [task, model]));
  const buildUniformEfforts = (effort = '') => Object.fromEntries(TASK_IDS.map((task) => [task, effort]));
  const buildLegacyRoutes = (model) => ({ ...buildUniformRoutes(model), translations: TRANSLATION_CLAUDE_MODEL });

  const buildDefaultConfigForId = (requestedId, settings = readSettings()) => {
    const id = KNOWN_PROFILE_IDS.has(requestedId) ? requestedId : PROFILE_IDS.CLAUDE_LEGACY;
    const provider = getProviderForProfileId(id);
    const baseModel = provider === 'openai' ? DEFAULT_OPENAI_MODEL : normalizeClaudeModel(settings.selectedClaudeModel);
    const baseReasoningEffort = provider === 'openai' ? DEFAULT_OPENAI_REASONING_EFFORT : '';
    return {
      version: PROFILE_VERSION, id, provider, baseModel, baseReasoningEffort,
      routes: id === PROFILE_IDS.CLAUDE_LEGACY ? buildLegacyRoutes(baseModel) : buildUniformRoutes(baseModel),
      reasoningEfforts: buildUniformEfforts(baseReasoningEffort),
      imageDefaults: { first: 'high', rest: 'economy' },
      descriptionResearch: clone(DEFAULT_DESCRIPTION_RESEARCH),
    };
  };

  const normalizeDescriptionResearch = (value, provider) => {
    const source = value && typeof value === 'object' ? value : {};
    return {
      enabled: provider === 'openai' && source.enabled !== false,
      model: normalizeOpenAIModel(source.model, DEFAULT_DESCRIPTION_RESEARCH.model),
      reasoningEffort: normalizeOpenAIReasoningEffort(source.reasoningEffort, DEFAULT_DESCRIPTION_RESEARCH.reasoningEffort),
      maxToolCalls: Math.min(3, Math.max(1, Math.round(Number(source.maxToolCalls) || DEFAULT_DESCRIPTION_RESEARCH.maxToolCalls))),
      searchContextSize: SEARCH_CONTEXT_SIZES.has(String(source.searchContextSize || ''))
        ? String(source.searchContextSize)
        : DEFAULT_DESCRIPTION_RESEARCH.searchContextSize,
      reuseIdentical: source.reuseIdentical !== false,
    };
  };
  const buildDefaultConfig = (settings = readSettings()) => buildDefaultConfigForId(PROFILE_IDS.CLAUDE_LEGACY, settings);

  const normalizeRoutes = (routes, baseModel, id, provider) => {
    const source = routes && typeof routes === 'object' ? routes : {};
    const fallbacks = id === PROFILE_IDS.CLAUDE_LEGACY ? buildLegacyRoutes(baseModel) : buildUniformRoutes(baseModel);
    return Object.fromEntries(TASK_IDS.map((task) => {
      const raw = typeof source[task] === 'object' ? source[task]?.model : source[task];
      return [task, provider === 'openai'
        ? normalizeOpenAIModel(raw, fallbacks[task])
        : normalizeClaudeModel(raw, fallbacks[task])];
    }));
  };
  const normalizeEfforts = (efforts, legacyRoutes, baseEffort, provider) => {
    if (provider !== 'openai') return buildUniformEfforts('');
    const source = efforts && typeof efforts === 'object' ? efforts : {};
    return Object.fromEntries(TASK_IDS.map((task) => {
      const migrated = typeof legacyRoutes?.[task] === 'object' ? legacyRoutes[task]?.reasoningEffort : '';
      return [task, normalizeOpenAIReasoningEffort(source[task] || migrated, baseEffort)];
    }));
  };

  const normalizeConfig = (value, settings = readSettings()) => {
    const source = value && typeof value === 'object' ? value : buildDefaultConfig(settings);
    const id = KNOWN_PROFILE_IDS.has(source.id) ? source.id : PROFILE_IDS.CLAUDE_LEGACY;
    const provider = getProviderForProfileId(id);
    const baseModel = provider === 'openai'
      ? normalizeOpenAIModel(source.baseModel)
      : normalizeClaudeModel(source.baseModel || settings.selectedClaudeModel);
    const baseReasoningEffort = provider === 'openai'
      ? normalizeOpenAIReasoningEffort(source.baseReasoningEffort)
      : '';
    const routes = id === PROFILE_IDS.CLAUDE_LEGACY
      ? buildLegacyRoutes(baseModel)
      : normalizeRoutes(source.routes, baseModel, id, provider);
    const reasoningEfforts = id === PROFILE_IDS.OPENAI_STANDARD
      ? buildUniformEfforts(baseReasoningEffort)
      : normalizeEfforts(source.reasoningEfforts, source.routes, baseReasoningEffort, provider);
    const defaults = buildDefaultConfigForId(id, settings);
    const imageDefaults = source.imageDefaults && typeof source.imageDefaults === 'object' ? source.imageDefaults : defaults.imageDefaults;
    const descriptionResearch = normalizeDescriptionResearch(source.descriptionResearch, provider);
    return {
      version: PROFILE_VERSION, id, provider, baseModel, baseReasoningEffort, routes, reasoningEfforts,
      imageDefaults: {
        first: imageDefaults.first === 'economy' ? 'economy' : 'high',
        rest: imageDefaults.rest === 'high' ? 'high' : 'economy',
      },
      descriptionResearch,
    };
  };

  const getStoredProfiles = (settings = readSettings()) => {
    const stored = settings.aiProfiles && typeof settings.aiProfiles === 'object' ? { ...settings.aiProfiles } : {};
    if (settings.aiProfile?.id && !stored[settings.aiProfile.id]) stored[settings.aiProfile.id] = settings.aiProfile;
    return stored;
  };
  const getActiveProfile = () => { const settings = readSettings(); return normalizeConfig(settings.aiProfile, settings); };
  const getProfileForId = (id) => {
    const settings = readSettings();
    return normalizeConfig(getStoredProfiles(settings)[id] || buildDefaultConfigForId(id, settings), settings);
  };
  const saveActiveProfile = (nextConfig, { notify = true } = {}) => {
    const settings = readSettings();
    const previous = normalizeConfig(settings.aiProfile, settings);
    const normalized = normalizeConfig(nextConfig, settings);
    const stored = getStoredProfiles(settings);
    stored[normalized.id] = normalized;
    settings.aiProfile = normalized;
    settings.aiProfiles = stored;
    if (normalized.provider === 'anthropic') settings.selectedClaudeModel = normalized.baseModel;
    writeSettings(settings);
    if (notify) global.dispatchEvent(new CustomEvent('pipeline:ai-profile-change', { detail: {
      previous, current: clone(normalized), providerChanged: previous.provider !== normalized.provider,
      profileChanged: JSON.stringify(previous) !== JSON.stringify(normalized),
    } }));
    return clone(normalized);
  };

  const getTaskForAgent = (agentId = '') => {
    const id = String(agentId || '').trim().toLowerCase();
    if (id === 'titre' || id === 'titre_explorer') return 'title';
    if (id === 'tags') return 'tags';
    if (id === 'description') return 'description';
    if (id === 'alt') return 'alt';
    if (id.startsWith('traduction_') || id === 'cache_aware') return 'translations';
    if (['social', 'instagram', 'pinterest', 'camille'].includes(id)) return 'social';
    return 'utility';
  };
  const getModelsForProvider = (provider = 'anthropic') => provider === 'openai' ? SUPPORTED_OPENAI_MODELS : SUPPORTED_CLAUDE_MODELS;
  const getModelLabel = (id = '') => [...SUPPORTED_CLAUDE_MODELS, ...SUPPORTED_OPENAI_MODELS]
    .find(({ value }) => value === id)?.label || id || 'IA';
  const getReasoningEffortLabel = (effort = '') => SUPPORTED_OPENAI_REASONING_EFFORTS
    .find(({ value }) => value === effort)?.label || effort || '—';
  const getProfileLabel = (profile = getActiveProfile()) => {
    if (profile.id === PROFILE_IDS.CLAUDE_LEGACY) return `Claude actuel · ${getModelLabel(profile.baseModel)}`;
    if (profile.id === PROFILE_IDS.OPENAI_STANDARD) return `GPT uniforme · ${getModelLabel(profile.baseModel)} · ${getReasoningEffortLabel(profile.baseReasoningEffort)}`;
    const unique = [...new Set(Object.values(profile.routes || {}))];
    if (profile.provider === 'anthropic') return unique.length === 1 ? `Claude personnalisé · ${getModelLabel(unique[0])}` : 'Claude · Profil personnalisé';
    return unique.length === 1 ? `GPT personnalisé · ${getModelLabel(unique[0])}` : 'GPT · Profil personnalisé';
  };
  const snapshotActiveProfile = () => clone(getActiveProfile());
  const resolveExecution = (agentId, options = {}) => {
    const profile = normalizeConfig(options.profile || getActiveProfile());
    const task = String(options.task || getTaskForAgent(agentId));
    const fallback = profile.baseModel;
    const model = task === 'utility' ? fallback : (profile.routes?.[task] || fallback);
    const reasoningEffort = profile.provider === 'openai'
      ? normalizeOpenAIReasoningEffort(task === 'utility' ? profile.baseReasoningEffort : profile.reasoningEfforts?.[task], profile.baseReasoningEffort)
      : '';
    return Object.freeze({ provider: profile.provider, model, reasoningEffort, task, profileId: profile.id, profileLabel: getProfileLabel(profile) });
  };

  global.PipelineUIAIProfiles = Object.freeze({
    PROFILE_IDS, TASK_IDS, SUPPORTED_CLAUDE_MODELS, SUPPORTED_OPENAI_MODELS,
    SUPPORTED_OPENAI_REASONING_EFFORTS, DEFAULT_CLAUDE_MODEL, TRANSLATION_CLAUDE_MODEL,
    DEFAULT_OPENAI_MODEL, DEFAULT_OPENAI_REASONING_EFFORT, DEFAULT_DESCRIPTION_RESEARCH, normalizeClaudeModel,
    normalizeOpenAIModel, normalizeOpenAIReasoningEffort, getProviderForProfileId,
    normalizeDescriptionResearch, buildDefaultConfig, buildDefaultConfigForId, normalizeConfig, getActiveProfile,
    getProfileForId, saveActiveProfile, getTaskForAgent, getModelsForProvider,
    getModelLabel, getReasoningEffortLabel, getProfileLabel, snapshotActiveProfile, resolveExecution,
  });
})(window);
