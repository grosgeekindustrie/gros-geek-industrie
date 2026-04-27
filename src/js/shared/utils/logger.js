'use strict';

(function initPipelineUISharedLogger(global) {
  global.PipelineUI = global.PipelineUI || {};

  const sharedConstants = global.PipelineUISharedConstants || {};
  const LOG_PREFIXES = sharedConstants.LOG_PREFIXES || Object.freeze({
    APP: 'app',
    MEDIA: 'media',
    PIPELINE: 'pipeline',
    STORAGE: 'storage',
    UI: 'ui',
  });

  const formatMessage = (prefix, message) => `[${prefix}] ${message}`;

  const writeLog = (level, prefix, message, detail) => {
    const method = typeof console?.[level] === 'function' ? console[level] : console.log;
    const formattedMessage = formatMessage(prefix, String(message || '').trim() || 'event');

    if (typeof detail === 'undefined') {
      method(formattedMessage);
      return;
    }

    method(formattedMessage, detail);
  };

  const createLogger = (prefix = LOG_PREFIXES.UI) => ({
    debug: (message, detail) => writeLog('debug', prefix, message, detail),
    info: (message, detail) => writeLog('log', prefix, message, detail),
    warn: (message, detail) => writeLog('warn', prefix, message, detail),
    error: (message, detail) => writeLog('error', prefix, message, detail),
  });

  global.PipelineUILogger = {
    LOG_PREFIXES,
    createLogger,
    writeLog,
  };

  global.PipelineUI.logger = global.PipelineUI.logger || {};
  Object.assign(global.PipelineUI.logger, global.PipelineUILogger);
})(window);
