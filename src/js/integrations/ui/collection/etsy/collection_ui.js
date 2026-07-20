(function initPipelineUIEtsyCollectionUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };

  function initCollectionWorkspace(deps = {}) {
    deps.initWorkspaceContext?.('col');
    deps.initAuditContext?.('col');
  }

  function bootstrapCollectionWorkspaceWhenReady() {
    const init = global.PipelineUIEtsyWorkspace?.initEtsyWorkspaceCollection;
    if (typeof init !== 'function') return;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => init(), { once: true });
      return;
    }

    init();
  }

  EtsyUI.collection = {
    ...(EtsyUI.collection || {}),
    initCollectionWorkspace,
  };

  global.PipelineUIEtsyUI = EtsyUI;
  bootstrapCollectionWorkspaceWhenReady();
})(window);
