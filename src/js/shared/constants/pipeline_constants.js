'use strict';

(function initPipelineUISharedConstants(global) {
  global.PipelineUI = global.PipelineUI || {};

  const PIPELINE_MODES = Object.freeze({
    TABLETOP: 'tabletop',
    COLLECTION: 'collection',
  });

  const PIPELINE_PREFIXES = Object.freeze({
    TABLETOP: 'tt',
    COLLECTION: 'col',
  });

  const PIPELINE_MODE_SEQUENCE = Object.freeze([
    PIPELINE_MODES.TABLETOP,
    PIPELINE_MODES.COLLECTION,
  ]);

  const PIPELINE_PREFIX_SEQUENCE = Object.freeze([
    PIPELINE_PREFIXES.TABLETOP,
    PIPELINE_PREFIXES.COLLECTION,
  ]);

  const PIPELINE_MODE_BY_PREFIX = Object.freeze({
    [PIPELINE_PREFIXES.TABLETOP]: PIPELINE_MODES.TABLETOP,
    [PIPELINE_PREFIXES.COLLECTION]: PIPELINE_MODES.COLLECTION,
  });

  const PIPELINE_PREFIX_BY_MODE = Object.freeze({
    [PIPELINE_MODES.TABLETOP]: PIPELINE_PREFIXES.TABLETOP,
    [PIPELINE_MODES.COLLECTION]: PIPELINE_PREFIXES.COLLECTION,
  });

  const PIPELINE_TIMELINE_STATUS = Object.freeze({
    WAIT: 'wait',
    ACTIVE: 'active',
    DONE: 'done',
    ERROR: 'error',
  });

  const STORAGE_KEYS = Object.freeze({
    APP_SETTINGS: 'pipeline.settings',
  });

  const APP_DEFAULTS = Object.freeze({
    SHOP_URL: 'https://grosgeekindustrie.etsy.com',
  });

  const PIPELINE_RUN_STATUS = Object.freeze({
    RUNNING: 'en cours',
    DONE: 'termine',
    ERROR: 'erreur',
    SELECTION_REQUIRED: 'en pause · selection requise',
    STOPPED: 'interrompu',
  });

  const PIPELINE_AGENT_STATUS_TEXT = Object.freeze({
    WAITING: 'en attente',
    GENERATING: 'generation...',
    SELECTION_REQUIRED: 'selection requise',
    DONE: 'done',
    STOPPED: 'stoppe',
    ERROR: 'erreur',
    EMPTY_OUTPUT: 'pas encore genere',
  });

  const LOG_PREFIXES = Object.freeze({
    APP: 'app',
    MEDIA: 'media',
    PIPELINE: 'pipeline',
    STORAGE: 'storage',
    UI: 'ui',
  });

  global.PipelineUISharedConstants = {
    PIPELINE_MODES,
    PIPELINE_PREFIXES,
    PIPELINE_MODE_SEQUENCE,
    PIPELINE_PREFIX_SEQUENCE,
    PIPELINE_MODE_BY_PREFIX,
    PIPELINE_PREFIX_BY_MODE,
    PIPELINE_TIMELINE_STATUS,
    STORAGE_KEYS,
    APP_DEFAULTS,
    PIPELINE_RUN_STATUS,
    PIPELINE_AGENT_STATUS_TEXT,
    LOG_PREFIXES,
  };

  global.PipelineUI.constants = global.PipelineUI.constants || {};
  Object.assign(global.PipelineUI.constants, global.PipelineUISharedConstants);
})(window);
