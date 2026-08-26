(function initPipelineUIAIProfiles(global) {
  'use strict';

  const SETTINGS_KEY = 'pipeline.settings';
  const PROFILE_VERSION = 1;
  const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5';
  const TRANSLATION_CLAUDE_MODEL = 'claude-sonnet-4-6';
  const PROFILE_IDS = Object.freeze({
    LEGACY: 'claude-legacy',
    CUSTOM: 'claude-custom',
  });
  const TASK_IDS = Object.freeze([
    'title',
    'tags',
    'description',
    'alt',
    'translations',
    'social',
  ]);
  const SUPPORTED_CLAUDE_MODELS = Object.freeze([
    Object.freeze({ value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' }),
    Object.freeze({ value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' }),
    Object.freeze({ value: 'claude-opus-4-8', label: 'Claude Opus 4.8' }),
    Object.freeze({ value: 'claude-opus-4-7', label: 'Claude Opus 4.7' }),
    Object.freeze({ value: 'claude-opus-4-6', label: 'Claude Opus 4.6' }),
    Object.freeze({ value: 'claude-opus-4-5', label: 'Claude Opus 4.5' }),
    Object.freeze({ value: 'claude-sonnet-4-0', label: 'Claude Sonnet 4.0' }),
    Object.freeze({ value: 'claude-opus-4-1', label: 'Claude Opus 4.1' }),
    Object.freeze({ value: 'claude-opus-4-0', label: 'Claude Opus 4.0' }),
    Object.freeze({ value: 'claude-3-7-sonnet-latest', label: 'Claude Sonnet 3.7' }),
    Object.freeze({ value: 'claude-3-5-sonnet-latest', label: 'Claude Sonnet 3.5' }),
  ]);
  const SUPPORTED_MODEL_IDS = new Set(SUPPORTED_CLAUDE_MODELS.map(({ value }) => value));

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const readSettings = () => {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(SETTINGS_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  };

  const writeSettings = (settings) => {
    global.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  };

  const normalizeClaudeModel = (value, fallback = DEFAULT_CLAUDE_MODEL) => {
    const candidate = String(value || '').trim();
    return SUPPORTED_MODEL_IDS.has(candidate) ? candidate : fallback;
  };

  const buildLegacyRoutes = (baseModel) => ({
    title: baseModel,
    tags: baseModel,
    description: baseModel,
    alt: baseModel,
    translations: TRANSLATION_CLAUDE_MODEL,
    social: baseModel,
  });

  const buildDefaultConfig = (settings = readSettings()) => {
    const baseModel = normalizeClaudeModel(settings.selectedClaudeModel);
    return {
      version: PROFILE_VERSION,
      id: PROFILE_IDS.LEGACY,
      provider: 'anthropic',
      baseModel,
      routes: buildLegacyRoutes(baseModel),
      imageDefaults: {
        first: 'high',
        rest: 'economy',
      },
    };
  };

  const normalizeRoutes = (routes, baseModel, profileId) => {
    const source = routes && typeof routes === 'object' ? routes : {};
    const legacyRoutes = buildLegacyRoutes(baseModel);
    return Object.fromEntries(TASK_IDS.map((taskId) => {
      const fallback = profileId === PROFILE_IDS.LEGACY ? legacyRoutes[taskId] : baseModel;
      return [taskId, normalizeClaudeModel(source[taskId], fallback)];
    }));
  };

  const normalizeConfig = (value, settings = readSettings()) => {
    const fallback = buildDefaultConfig(settings);
    const source = value && typeof value === 'object' ? value : fallback;
    const id = source.id === PROFILE_IDS.CUSTOM ? PROFILE_IDS.CUSTOM : PROFILE_IDS.LEGACY;
    const baseModel = normalizeClaudeModel(source.baseModel || settings.selectedClaudeModel);
    const routes = id === PROFILE_IDS.LEGACY
      ? buildLegacyRoutes(baseModel)
      : normalizeRoutes(source.routes, baseModel, id);
    const imageDefaults = source.imageDefaults && typeof source.imageDefaults === 'object'
      ? source.imageDefaults
      : fallback.imageDefaults;

    return {
      version: PROFILE_VERSION,
      id,
      provider: 'anthropic',
      baseModel,
      routes,
      imageDefaults: {
        first: imageDefaults.first === 'economy' ? 'economy' : 'high',
        rest: imageDefaults.rest === 'high' ? 'high' : 'economy',
      },
    };
  };

  const getActiveProfile = () => {
    const settings = readSettings();
    return normalizeConfig(settings.aiProfile, settings);
  };

  const saveActiveProfile = (nextConfig, { notify = true } = {}) => {
    const settings = readSettings();
    const previous = normalizeConfig(settings.aiProfile, settings);
    const normalized = normalizeConfig(nextConfig, settings);
    settings.aiProfile = normalized;
    settings.selectedClaudeModel = normalized.baseModel;
    writeSettings(settings);

    if (notify) {
      global.dispatchEvent(new CustomEvent('pipeline:ai-profile-change', {
        detail: {
          previous,
          current: clone(normalized),
          providerChanged: previous.provider !== normalized.provider,
          profileChanged: JSON.stringify(previous) !== JSON.stringify(normalized),
        },
      }));
    }

    return clone(normalized);
  };

  const getTaskForAgent = (agentId = '') => {
    const normalized = String(agentId || '').trim().toLowerCase();
    if (normalized === 'titre' || normalized === 'titre_explorer') return 'title';
    if (normalized === 'tags') return 'tags';
    if (normalized === 'description') return 'description';
    if (normalized === 'alt') return 'alt';
    if (normalized.startsWith('traduction_')) return 'translations';
    if (['social', 'instagram', 'pinterest', 'camille'].includes(normalized)) return 'social';
    return 'utility';
  };

  const getModelLabel = (modelId = '') => (
    SUPPORTED_CLAUDE_MODELS.find(({ value }) => value === modelId)?.label || modelId || 'Claude'
  );

  const getProfileLabel = (profile = getActiveProfile()) => {
    if (profile.id === PROFILE_IDS.LEGACY) return `Claude actuel · ${getModelLabel(profile.baseModel)}`;
    const uniqueModels = [...new Set(Object.values(profile.routes || {}))];
    if (uniqueModels.length === 1) return `Claude personnalisé · ${getModelLabel(uniqueModels[0])}`;
    return 'Claude · Profil personnalisé';
  };

  const snapshotActiveProfile = () => clone(getActiveProfile());

  const resolveExecution = (agentId, options = {}) => {
    const profile = normalizeConfig(options.profile || getActiveProfile());
    const task = String(options.task || getTaskForAgent(agentId));
    const fallbackModel = profile.baseModel || DEFAULT_CLAUDE_MODEL;
    const resolvedModel = task === 'utility'
      ? fallbackModel
      : normalizeClaudeModel(profile.routes?.[task], fallbackModel);

    return Object.freeze({
      provider: 'anthropic',
      model: resolvedModel,
      task,
      profileId: profile.id,
      profileLabel: getProfileLabel(profile),
    });
  };

  const api = Object.freeze({
    PROFILE_IDS,
    TASK_IDS,
    SUPPORTED_CLAUDE_MODELS,
    DEFAULT_CLAUDE_MODEL,
    TRANSLATION_CLAUDE_MODEL,
    normalizeClaudeModel,
    buildDefaultConfig,
    normalizeConfig,
    getActiveProfile,
    saveActiveProfile,
    getTaskForAgent,
    getModelLabel,
    getProfileLabel,
    snapshotActiveProfile,
    resolveExecution,
  });

  global.PipelineUIAIProfiles = api;
})(window);
