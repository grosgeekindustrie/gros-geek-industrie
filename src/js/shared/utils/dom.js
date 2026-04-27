'use strict';

(function initPipelineUIDomUtils(global) {
  global.PipelineUI = global.PipelineUI || {};

  const buildDataSelector = (name, value = null) => (
    typeof value === 'string'
      ? `[data-${name}="${value}"]`
      : `[data-${name}]`
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
    buildDataSelector,
    getByData,
    getAllByData,
    getClosestByData,
  };

  global.PipelineUI.dom = global.PipelineUI.dom || {};
  Object.assign(global.PipelineUI.dom, global.PipelineUIDom);
})(window);
