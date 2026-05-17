(function initPipelineUIEtsyTabletopUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };

  function initTabletopWorkspace(deps = {}) {
    deps.initWorkspaceContext?.('tt');
  }

  function bootstrapTabletopWorkspaceWhenReady() {
    const init = global.PipelineUIEtsyWorkspace?.initEtsyWorkspaceTabletop;
    if (typeof init !== 'function') return;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => init(), { once: true });
      return;
    }

    init();
  }

  EtsyUI.tabletop = {
    ...(EtsyUI.tabletop || {}),
    initTabletopWorkspace,
  };

  global.PipelineUIEtsyUI = EtsyUI;
  bootstrapTabletopWorkspaceWhenReady();
})(window);
