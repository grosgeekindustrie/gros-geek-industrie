'use strict';

(function initPipelineUIRuntimeFormats(global) {
  global.PipelineUI = global.PipelineUI || {};

  const PIPELINE_RUN_META_DEFAULTS = Object.freeze({
    quality: 'brut',
    validation: 'non_valide',
    origin: 'auto',
  });

  const PIPELINE_RUN_ENTRY_DEFAULTS = Object.freeze({
    quality: 'net',
    validation: 'valide',
    origin: 'manuel',
  });

  const DEFAULT_PIPELINE_RUN_STATE = Object.freeze({
    formSnapshot: '',
    warmupHint: '',
    lastCacheAwareSignature: '',
    cumulativeEntries: [],
    cumulativeText: '',
  });

  const DEFAULT_FILES_API_DEBUG = Object.freeze({
    enabled: false,
    requestedImagesCount: 0,
    usedFilesCount: 0,
    localReuseCount: 0,
    serverCacheHitsCount: 0,
    filesReusedCount: 0,
    uploadCandidatesCount: 0,
    uploadedCount: 0,
    invalidatedCount: 0,
    unresolvedCount: 0,
    workspacePersisted: null,
    workspacePersistError: '',
    promptCacheBreakpointApplied: false,
    promptCacheBreakpointType: 'none',
    status: 'none',
    error: '',
  });

  function createPipelineRunState(overrides = {}) {
    const entries = Array.isArray(overrides?.cumulativeEntries) ? overrides.cumulativeEntries : [];
    return {
      ...DEFAULT_PIPELINE_RUN_STATE,
      ...overrides,
      cumulativeEntries: entries,
      cumulativeText: String(overrides?.cumulativeText || ''),
    };
  }

  function normalizePipelineRunEntryMeta(entry = {}, defaults = PIPELINE_RUN_META_DEFAULTS) {
    return {
      sourceAgentId: String(entry?.sourceAgentId || entry?.agentId || '').trim(),
      quality: String(entry?.quality || defaults.quality).trim(),
      validation: String(entry?.validation || defaults.validation).trim(),
      origin: String(entry?.origin || defaults.origin).trim(),
    };
  }

  function createPipelineRunEntry(entry = {}, defaults = PIPELINE_RUN_META_DEFAULTS) {
    return {
      agentId: String(entry?.agentId || '').trim(),
      content: String(entry?.content || '').trim(),
      ...normalizePipelineRunEntryMeta(entry, defaults),
    };
  }

  function createFilesApiDebug(overrides = {}) {
    return {
      ...DEFAULT_FILES_API_DEBUG,
      ...overrides,
    };
  }

  global.PipelineUIRuntimeFormats = {
    PIPELINE_RUN_META_DEFAULTS,
    PIPELINE_RUN_ENTRY_DEFAULTS,
    DEFAULT_PIPELINE_RUN_STATE,
    DEFAULT_FILES_API_DEBUG,
    createPipelineRunState,
    normalizePipelineRunEntryMeta,
    createPipelineRunEntry,
    createFilesApiDebug,
  };

  global.PipelineUI.runtimeFormats = global.PipelineUI.runtimeFormats || {};
  Object.assign(global.PipelineUI.runtimeFormats, global.PipelineUIRuntimeFormats);
})(window);
