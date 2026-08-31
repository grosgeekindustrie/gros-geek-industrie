(function initPipelineUIPromptProfiles(global) {
  'use strict';

  const PROMPT_ROOT = 'prompts';
  const GPT_ROOT = `${PROMPT_ROOT}/gpt`;

  const normalizeProvider = (provider = '') => (
    String(provider || '').trim().toLowerCase() === 'openai' ? 'openai' : 'anthropic'
  );

  const getProvider = (profile = null) => normalizeProvider(
    typeof profile === 'string'
      ? profile
      : (profile?.provider || global.PipelineUIAIProfiles?.getActiveProfile?.()?.provider),
  );

  const normalizePromptPath = (path = '') => String(path || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');

  const resolvePromptPath = (canonicalPath = '', profileOrProvider = null) => {
    const path = normalizePromptPath(canonicalPath);
    if (!path.startsWith(`${PROMPT_ROOT}/`)) return path;
    if (path.startsWith(`${GPT_ROOT}/`)) return path;
    const provider = typeof profileOrProvider === 'string'
      ? normalizeProvider(profileOrProvider)
      : getProvider(profileOrProvider);
    return provider === 'openai' ? `${GPT_ROOT}/${path.slice(PROMPT_ROOT.length + 1)}` : path;
  };

  const resolvePromptFolder = (canonicalFolder = '', profileOrProvider = null) => (
    resolvePromptPath(normalizePromptPath(canonicalFolder).replace(/\/$/, ''), profileOrProvider)
  );

  const getPromptFamilyLabel = (profileOrProvider = null) => {
    const provider = typeof profileOrProvider === 'string'
      ? normalizeProvider(profileOrProvider)
      : getProvider(profileOrProvider);
    return provider === 'openai' ? 'GPT' : 'Claude';
  };

  const getPipelineContextKey = ({ provider, shopKey = 'grosgeek', mode = 'tabletop' } = {}) => [
    normalizeProvider(provider || getProvider()),
    String(shopKey || 'grosgeek').trim().toLowerCase() === 'doublex' ? 'doublex' : 'grosgeek',
    String(mode || 'tabletop').trim().toLowerCase() === 'collection' ? 'collection' : 'tabletop',
  ].join(':');

  const ensurePipelinePromptBucket = (state, context = {}) => {
    if (!state || typeof state !== 'object') return {};
    state.promptsByContext = state.promptsByContext && typeof state.promptsByContext === 'object'
      ? state.promptsByContext
      : {};
    const key = getPipelineContextKey(context);
    state.promptsByContext[key] = state.promptsByContext[key] && typeof state.promptsByContext[key] === 'object'
      ? state.promptsByContext[key]
      : {};
    return state.promptsByContext[key];
  };

  const getCustomPromptStateKey = (baseKey = '', profileOrProvider = null) => (
    `${normalizePromptPath(baseKey)}::${getProvider(profileOrProvider)}`
  );

  const resolveCustomPromptSpec = (spec = {}, profileOrProvider = null) => {
    const provider = typeof profileOrProvider === 'string'
      ? normalizeProvider(profileOrProvider)
      : getProvider(profileOrProvider);
    return {
      ...spec,
      canonicalPath: normalizePromptPath(spec.canonicalPath || spec.path),
      path: resolvePromptPath(spec.canonicalPath || spec.path, provider),
      stateKey: getCustomPromptStateKey(spec.baseStateKey || spec.stateKey || spec.id, provider),
      provider,
      familyLabel: getPromptFamilyLabel(provider),
    };
  };

  global.PipelineUIPromptProfiles = Object.freeze({
    normalizeProvider,
    getProvider,
    normalizePromptPath,
    resolvePromptPath,
    resolvePromptFolder,
    getPromptFamilyLabel,
    getPipelineContextKey,
    ensurePipelinePromptBucket,
    getCustomPromptStateKey,
    resolveCustomPromptSpec,
  });
})(window);
