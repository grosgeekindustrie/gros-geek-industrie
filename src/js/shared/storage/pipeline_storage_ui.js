'use strict';

(function initPipelineUIStorage(global) {
  global.PipelineUI = global.PipelineUI || {};

  const sharedConstants = global.PipelineUISharedConstants || {};
  const STORAGE_KEYS = sharedConstants.STORAGE_KEYS || {
    ROOT_PREFIX: 'pipeline.',
    APP_SETTINGS: 'pipeline.settings',
    PIPELINE_RULES: 'pipeline.rules',
    FORM_STATE_PREFIX: 'pipeline.form.',
  };

  let pendingRestore = null;

  const readStoredJSON = (key, fallback = null) => {
    try {
      const rawValue = localStorage.getItem(key);
      return rawValue ? JSON.parse(rawValue) : fallback;
    } catch (_error) {
      return fallback;
    }
  };

  const writeStoredJSON = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const updateStoredJSON = (key, fallback, updater) => {
    const nextValue = readStoredJSON(key, fallback);
    updater(nextValue);
    writeStoredJSON(key, nextValue);
    return nextValue;
  };

  const readAppSettings = () => readStoredJSON(STORAGE_KEYS.APP_SETTINGS, {});
  const writeAppSettings = (nextSettings) => writeStoredJSON(STORAGE_KEYS.APP_SETTINGS, nextSettings);
  const updateAppSettings = (updater) => updateStoredJSON(STORAGE_KEYS.APP_SETTINGS, {}, updater);
  const getFormStorageKey = (mode = '') => `${STORAGE_KEYS.FORM_STATE_PREFIX}${String(mode || '').trim()}`;
  const readPersistentRules = () => readStoredJSON(STORAGE_KEYS.PIPELINE_RULES, null);
  const writePersistentRules = (rules) => writeStoredJSON(STORAGE_KEYS.PIPELINE_RULES, rules);
  const getPipelineStorageKeys = () => Object.keys(localStorage).filter((key) => (
    key.startsWith(STORAGE_KEYS.ROOT_PREFIX)
  ));

  const clearPipelineStorage = () => {
    getPipelineStorageKeys().forEach((key) => {
      localStorage.removeItem(key);
    });
  };

  const setPendingRestore = ({ view = '', mode = '' } = {}) => {
    const normalizedView = String(view || '').trim();
    const normalizedMode = String(mode || '').trim();

    pendingRestore = normalizedView === 'form' && normalizedMode
      ? { view: normalizedView, mode: normalizedMode }
      : null;
  };

  const consumePendingRestore = () => {
    const restoreState = pendingRestore;
    pendingRestore = null;
    return restoreState;
  };

  global.PipelineUIStorage = {
    STORAGE_KEYS,
    readStoredJSON,
    writeStoredJSON,
    updateStoredJSON,
    readAppSettings,
    writeAppSettings,
    updateAppSettings,
    getFormStorageKey,
    readPersistentRules,
    writePersistentRules,
    getPipelineStorageKeys,
    clearPipelineStorage,
    setPendingRestore,
    consumePendingRestore,
  };

  global.PipelineUI.storage = global.PipelineUI.storage || {};
  Object.assign(global.PipelineUI.storage, global.PipelineUIStorage);
})(window);
