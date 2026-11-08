(function initPipelineUIAIProfiles(global) {
  'use strict';

  const SETTINGS_KEY = 'pipeline.settings';
  const PROFILE_VERSION = 4;
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
    OPENAI_6_STANDARD: 'openai-6-standard', OPENAI_6_CUSTOM: 'openai-6-custom',
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
    { value: 'gpt-6-astra', label: 'GPT-6 Astra' },
    { value: 'gpt-6-sol', label: 'GPT-6 Sol' },
    { value: 'gpt-6-luna', label: 'GPT-6 Luna' },
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
  const ASTRA_REASONING_EFFORT_IDS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
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
  const getReasoningEffortsForModel = (model = '') => String(model || '').trim() === 'gpt-6-astra'
    ? SUPPORTED_OPENAI_REASONING_EFFORTS.filter(({ value }) => ASTRA_REASONING_EFFORT_IDS.has(value))
    : SUPPORTED_OPENAI_REASONING_EFFORTS;
  const normalizeOpenAIReasoningEffort = (value, fallback = DEFAULT_OPENAI_REASONING_EFFORT, model = '') => {
    const candidate = String(value || '').trim();
    const allowed = String(model || '').trim() === 'gpt-6-astra' ? ASTRA_REASONING_EFFORT_IDS : OPENAI_EFFORT_IDS;
    if (allowed.has(candidate)) return candidate;
    const normalizedFallback = String(fallback || '').trim();
    return allowed.has(normalizedFallback) ? normalizedFallback : (allowed.has('medium') ? 'medium' : [...allowed][0]);
  };
  const getProviderForProfileId = (profileId = '') => String(profileId).startsWith('openai-') ? 'openai' : 'anthropic';
  const buildUniformRoutes = (model) => Object.fromEntries(TASK_IDS.map((task) => [task, model]));
  const buildUniformEfforts = (effort = '') => Object.fromEntries(TASK_IDS.map((task) => [task, effort]));
  const buildLegacyRoutes = (model) => ({ ...buildUniformRoutes(model), translations: TRANSLATION_CLAUDE_MODEL });

  const buildDefaultConfigForId = (requestedId, settings = readSettings()) => {
    const id = KNOWN_PROFILE_IDS.has(requestedId) ? requestedId : PROFILE_IDS.CLAUDE_LEGACY;
    const provider = getProviderForProfileId(id);
    const isGPT6Preset = [PROFILE_IDS.OPENAI_6_STANDARD, PROFILE_IDS.OPENAI_6_CUSTOM].includes(id);
    const baseModel = provider === 'openai'
      ? (isGPT6Preset ? 'gpt-6-sol' : DEFAULT_OPENAI_MODEL)
      : normalizeClaudeModel(settings.selectedClaudeModel);
    const baseReasoningEffort = provider === 'openai' ? DEFAULT_OPENAI_REASONING_EFFORT : '';
    const descriptionResearch = clone(DEFAULT_DESCRIPTION_RESEARCH);
    if (isGPT6Preset) descriptionResearch.model = 'gpt-6-sol';
    return {
      version: PROFILE_VERSION, id, provider, baseModel, baseReasoningEffort,
      routes: id === PROFILE_IDS.CLAUDE_LEGACY ? buildLegacyRoutes(baseModel) : buildUniformRoutes(baseModel),
      reasoningEfforts: buildUniformEfforts(baseReasoningEffort),
      imageDefaults: { first: 'high', rest: 'economy' },
      descriptionResearch,
    };
  };

  const normalizeDescriptionResearch = (value, provider) => {
    const source = value && typeof value === 'object' ? value : {};
    return {
      enabled: provider === 'openai' && source.enabled !== false,
      model: normalizeOpenAIModel(source.model, DEFAULT_DESCRIPTION_RESEARCH.model),
      reasoningEffort: normalizeOpenAIReasoningEffort(source.reasoningEffort, DEFAULT_DESCRIPTION_RESEARCH.reasoningEffort, normalizeOpenAIModel(source.model, DEFAULT_DESCRIPTION_RESEARCH.model)),
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
  const normalizeEfforts = (efforts, legacyRoutes, baseEffort, provider, routes = {}) => {
    if (provider !== 'openai') return buildUniformEfforts('');
    const source = efforts && typeof efforts === 'object' ? efforts : {};
    return Object.fromEntries(TASK_IDS.map((task) => {
      const migrated = typeof legacyRoutes?.[task] === 'object' ? legacyRoutes[task]?.reasoningEffort : '';
      return [task, normalizeOpenAIReasoningEffort(source[task] || migrated, baseEffort, routes[task])];
    }));
  };

  const normalizeConfig = (value, settings = readSettings()) => {
    const source = value && typeof value === 'object' ? value : buildDefaultConfig(settings);
    const id = KNOWN_PROFILE_IDS.has(source.id) ? source.id : PROFILE_IDS.CLAUDE_LEGACY;
    const provider = getProviderForProfileId(id);
    const defaults = buildDefaultConfigForId(id, settings);
    const baseModel = provider === 'openai'
      ? normalizeOpenAIModel(source.baseModel, defaults.baseModel)
      : normalizeClaudeModel(source.baseModel || settings.selectedClaudeModel);
    const baseReasoningEffort = provider === 'openai'
      ? normalizeOpenAIReasoningEffort(source.baseReasoningEffort, DEFAULT_OPENAI_REASONING_EFFORT, baseModel)
      : '';
    const isUniformOpenAI = [PROFILE_IDS.OPENAI_STANDARD, PROFILE_IDS.OPENAI_6_STANDARD].includes(id);
    const routes = id === PROFILE_IDS.CLAUDE_LEGACY
      ? buildLegacyRoutes(baseModel)
      : (isUniformOpenAI ? buildUniformRoutes(baseModel) : normalizeRoutes(source.routes, baseModel, id, provider));
    const reasoningEfforts = isUniformOpenAI
      ? buildUniformEfforts(baseReasoningEffort)
      : normalizeEfforts(source.reasoningEfforts, source.routes, baseReasoningEffort, provider, routes);
    const imageDefaults = source.imageDefaults && typeof source.imageDefaults === 'object' ? source.imageDefaults : defaults.imageDefaults;
    const descriptionResearch = normalizeDescriptionResearch(source.descriptionResearch || defaults.descriptionResearch, provider);
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
  const normalizePresetName = (value) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const createPresetId = () => global.crypto?.randomUUID?.() || `ai-preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const getRawNamedPresets = (settings) => Array.isArray(settings.aiNamedPresets) ? settings.aiNamedPresets : [];
  const normalizeNamedPreset = (value, settings = readSettings()) => {
    const name = normalizePresetName(value?.name);
    const id = String(value?.id || '').trim();
    if (!id || !name) return null;
    return { id, name, config: normalizeConfig(value?.config, settings), createdAt: String(value?.createdAt || ''), updatedAt: String(value?.updatedAt || '') };
  };
  const ensureNamedPresets = (settings) => {
    let presets = getRawNamedPresets(settings).map((item) => normalizeNamedPreset(item, settings)).filter(Boolean);
    if (!settings.aiNamedPresetsSeededV4) {
      const storedProfiles = getStoredProfiles(settings);
      const current = normalizeConfig(settings.aiProfile, settings);
      const initial = current.provider === 'openai'
        ? current
        : normalizeConfig(storedProfiles[PROFILE_IDS.OPENAI_CUSTOM] || buildDefaultConfigForId(PROFILE_IDS.OPENAI_CUSTOM, settings), settings);
      const now = new Date().toISOString();
      presets = [{ id: createPresetId(), name: 'GPT 5.6', config: initial, createdAt: now, updatedAt: now }, ...presets];
      settings.aiNamedPresetsSeededV4 = true;
      settings.aiNamedPresets = presets;
      writeSettings(settings);
    }
    return presets;
  };
  const getNamedPresets = () => { const settings = readSettings(); return clone(ensureNamedPresets(settings)); };
  const getNamedPreset = (presetId) => getNamedPresets().find(({ id }) => id === String(presetId || '')) || null;
  const createNamedPreset = (name, config) => {
    const normalizedName = normalizePresetName(name);
    if (!normalizedName) throw new Error('Donne un nom au preset');
    const settings = readSettings();
    const presets = ensureNamedPresets(settings);
    const now = new Date().toISOString();
    const preset = { id: createPresetId(), name: normalizedName, config: normalizeConfig(config, settings), createdAt: now, updatedAt: now };
    settings.aiNamedPresets = [...presets, preset];
    writeSettings(settings);
    return clone(preset);
  };
  const updateNamedPreset = (presetId, { name, config } = {}) => {
    const settings = readSettings();
    const presets = ensureNamedPresets(settings);
    const index = presets.findIndex(({ id }) => id === String(presetId || ''));
    if (index < 0) throw new Error('Preset IA introuvable');
    const normalizedName = normalizePresetName(name ?? presets[index].name);
    if (!normalizedName) throw new Error('Donne un nom au preset');
    const updated = { ...presets[index], name: normalizedName, config: normalizeConfig(config || presets[index].config, settings), updatedAt: new Date().toISOString() };
    presets[index] = updated;
    settings.aiNamedPresets = presets;
    writeSettings(settings);
    return clone(updated);
  };
  const deleteNamedPreset = (presetId) => {
    const settings = readSettings();
    const presets = ensureNamedPresets(settings);
    const remaining = presets.filter(({ id }) => id !== String(presetId || ''));
    if (remaining.length === presets.length) return false;
    settings.aiNamedPresets = remaining;
    if (settings.aiActiveNamedPresetId === String(presetId || '')) delete settings.aiActiveNamedPresetId;
    writeSettings(settings);
    return true;
  };
  const getActiveProfile = () => {
    const settings = readSettings();
    const profile = normalizeConfig(settings.aiProfile, settings);
    const preset = ensureNamedPresets(settings).find(({ id }) => id === String(settings.aiActiveNamedPresetId || ''));
    return preset ? { ...profile, namedPresetId: preset.id, namedPresetName: preset.name } : profile;
  };
  const getProfileForId = (id) => {
    const settings = readSettings();
    return normalizeConfig(getStoredProfiles(settings)[id] || buildDefaultConfigForId(id, settings), settings);
  };
  const saveActiveProfile = (nextConfig, { notify = true, namedPresetId = '' } = {}) => {
    const settings = readSettings();
    const previous = normalizeConfig(settings.aiProfile, settings);
    const normalized = normalizeConfig(nextConfig, settings);
    const stored = getStoredProfiles(settings);
    stored[normalized.id] = normalized;
    settings.aiProfile = normalized;
    settings.aiProfiles = stored;
    if (namedPresetId && ensureNamedPresets(settings).some(({ id }) => id === namedPresetId)) settings.aiActiveNamedPresetId = namedPresetId;
    else delete settings.aiActiveNamedPresetId;
    if (normalized.provider === 'anthropic') settings.selectedClaudeModel = normalized.baseModel;
    writeSettings(settings);
    if (notify) global.dispatchEvent(new CustomEvent('pipeline:ai-profile-change', { detail: {
      previous, current: clone(normalized), providerChanged: previous.provider !== normalized.provider,
      profileChanged: JSON.stringify(previous) !== JSON.stringify(normalized),
    } }));
    return clone(normalized);
  };
  const applyNamedPreset = (presetId, options = {}) => {
    const preset = getNamedPreset(presetId);
    if (!preset) throw new Error('Preset IA introuvable');
    return saveActiveProfile(preset.config, { ...options, namedPresetId: preset.id });
  };
  const configsEqual = (left, right) => JSON.stringify(normalizeConfig(left)) === JSON.stringify(normalizeConfig(right));

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
    if (profile.namedPresetName) return profile.namedPresetName;
    if (profile.id === PROFILE_IDS.CLAUDE_LEGACY) return `Claude actuel · ${getModelLabel(profile.baseModel)}`;
    if ([PROFILE_IDS.OPENAI_STANDARD, PROFILE_IDS.OPENAI_6_STANDARD].includes(profile.id)) return `GPT uniforme · ${getModelLabel(profile.baseModel)} · ${getReasoningEffortLabel(profile.baseReasoningEffort)}`;
    const unique = [...new Set(Object.values(profile.routes || {}))];
    if (profile.provider === 'anthropic') return unique.length === 1 ? `Claude personnalisé · ${getModelLabel(unique[0])}` : 'Claude · Profil personnalisé';
    if (profile.id === PROFILE_IDS.OPENAI_6_CUSTOM) return unique.length === 1 ? `GPT-6 personnalisé · ${getModelLabel(unique[0])}` : 'GPT-6 · Profil personnalisé';
    return unique.length === 1 ? `GPT personnalisé · ${getModelLabel(unique[0])}` : 'GPT · Profil personnalisé';
  };
  const snapshotActiveProfile = () => clone(getActiveProfile());
  const resolveExecution = (agentId, options = {}) => {
    const profile = normalizeConfig(options.profile || getActiveProfile());
    const task = String(options.task || getTaskForAgent(agentId));
    const fallback = profile.baseModel;
    const model = task === 'utility' ? fallback : (profile.routes?.[task] || fallback);
    const reasoningEffort = profile.provider === 'openai'
      ? normalizeOpenAIReasoningEffort(task === 'utility' ? profile.baseReasoningEffort : profile.reasoningEfforts?.[task], profile.baseReasoningEffort, model)
      : '';
    return Object.freeze({ provider: profile.provider, model, reasoningEffort, task, profileId: profile.id, profileLabel: getProfileLabel(profile) });
  };

  global.PipelineUIAIProfiles = Object.freeze({
    PROFILE_IDS, TASK_IDS, SUPPORTED_CLAUDE_MODELS, SUPPORTED_OPENAI_MODELS,
    SUPPORTED_OPENAI_REASONING_EFFORTS, DEFAULT_CLAUDE_MODEL, TRANSLATION_CLAUDE_MODEL,
    DEFAULT_OPENAI_MODEL, DEFAULT_OPENAI_REASONING_EFFORT, DEFAULT_DESCRIPTION_RESEARCH, normalizeClaudeModel,
    normalizeOpenAIModel, normalizeOpenAIReasoningEffort, getReasoningEffortsForModel, getProviderForProfileId,
    normalizeDescriptionResearch, buildDefaultConfig, buildDefaultConfigForId, normalizeConfig, getActiveProfile,
    getProfileForId, saveActiveProfile, getNamedPresets, getNamedPreset, createNamedPreset, updateNamedPreset,
    deleteNamedPreset, applyNamedPreset, configsEqual, getTaskForAgent, getModelsForProvider,
    getModelLabel, getReasoningEffortLabel, getProfileLabel, snapshotActiveProfile, resolveExecution,
  });
})(window);
