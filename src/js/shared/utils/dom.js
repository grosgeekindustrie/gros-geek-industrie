'use strict';

(function initPipelineUIDomUtils(global) {
  global.PipelineUI = global.PipelineUI || {};

  const toDataAttributeName = (name = '') => String(name || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();

  const buildDataSelector = (name, value = null) => (
    typeof value === 'string'
      ? `[data-${toDataAttributeName(name)}="${value}"]`
      : `[data-${toDataAttributeName(name)}]`
  );

  const getByData = (name, value = null, root = document) => (
    root?.querySelector?.(buildDataSelector(name, value)) || null
  );

  const getAllByData = (name, value = null, root = document) => (
    Array.from(root?.querySelectorAll?.(buildDataSelector(name, value)) || [])
  );

  const getClosestByData = (target, name, value = null) => (
    target?.closest?.(buildDataSelector(name, value)) || null
  );

  global.PipelineUIDom = {
    toDataAttributeName,
    buildDataSelector,
    getByData,
    getAllByData,
    getClosestByData,
  };

  global.PipelineUI.dom = global.PipelineUI.dom || {};
  Object.assign(global.PipelineUI.dom, global.PipelineUIDom);
})(window);
