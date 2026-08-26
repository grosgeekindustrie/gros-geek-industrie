'use strict';

(function initPipelineUIRuntimeCache(global) {
  global.PipelineUI = global.PipelineUI || {};

  const ensureRuntimeCacheRoot = () => {
    global.state = global.state || {};
    global.state.runtimeCache = global.state.runtimeCache || {};
    return global.state.runtimeCache;
  };

  const ensureScopeStore = (scope = 'default') => {
    const root = ensureRuntimeCacheRoot();
    root[scope] = root[scope] || {
      values: {},
      pending: {},
    };
    return root[scope];
  };

  const buildCacheKey = (...parts) => parts
    .flat()
    .map((part) => String(part || '').trim())
    .join('::');

  const readCacheValue = (scope, key) => ensureScopeStore(scope).values[key];

  const writeCacheValue = (scope, key, value) => {
    ensureScopeStore(scope).values[key] = value;
    return value;
  };

  const clearCacheValue = (scope, key) => {
    const store = ensureScopeStore(scope);
    delete store.values[key];
    delete store.pending[key];
  };

  const runWithSharedRequest = async (scope, key, factory) => {
    const store = ensureScopeStore(scope);
    if (Object.prototype.hasOwnProperty.call(store.values, key)) {
      return store.values[key];
    }
    if (store.pending[key]) {
      return store.pending[key];
    }

    const pending = Promise.resolve()
      .then(factory)
      .then((value) => {
        store.values[key] = value;
        delete store.pending[key];
        return value;
      })
      .catch((error) => {
        delete store.pending[key];
        throw error;
      });

    store.pending[key] = pending;
    return pending;
  };

  global.PipelineUIRuntimeCache = {
    ensureRuntimeCacheRoot,
    ensureScopeStore,
    buildCacheKey,
    readCacheValue,
    writeCacheValue,
    clearCacheValue,
    runWithSharedRequest,
  };

  global.PipelineUI.runtimeCache = global.PipelineUI.runtimeCache || {};
  Object.assign(global.PipelineUI.runtimeCache, global.PipelineUIRuntimeCache);
})(window);
