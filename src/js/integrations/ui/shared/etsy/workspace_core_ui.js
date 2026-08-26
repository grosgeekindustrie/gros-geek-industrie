(function initPipelineUIEtsyWorkspaceCoreUi(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };

  function setTextContent(node, value) {
    if (!node) return;
    node.textContent = String(value || '');
  }

  function setStatus(prefix, message, deps = {}) {
    const nodes = deps.getNodes?.(prefix);
    if (nodes?.status) {
      nodes.status.textContent = String(message || '');
    }
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.core = {
    ...(EtsyUI.shared.core || {}),
    setTextContent,
    setStatus,
  };

  global.PipelineUIEtsyUI = EtsyUI;
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.ui = global.PipelineUIEtsyUI;
})(window);
