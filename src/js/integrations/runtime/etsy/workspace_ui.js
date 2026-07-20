'use strict';

// Etsy compatibility facade.
// This file should stay small: public API + bootstrap only.
(function initPipelineUIEtsyWorkspace(global) {
  global.PipelineUI = global.PipelineUI || {};

  const getRuntime = () => global.PipelineUIEtsyRuntime || {};
  const getEtsyUi = () => global.PipelineUIEtsyUI || {};
  const getEtsyUiTabletop = () => getEtsyUi().tabletop || {};
  const getEtsyUiCollection = () => getEtsyUi().collection || {};

  const initEtsyWorkspaceContext = (prefix) => getRuntime().workspaceInitEtsyWorkspaceContext?.(prefix);
  const initEtsyAuditContext = (prefix) => getRuntime().initAuditContext?.(prefix);

  const loadEtsyWorkspaceMedia = (prefix) => getRuntime().workspaceLoadEtsyWorkspaceMedia?.(prefix);

  const copyEtsyWorkspacePayload = (prefix) => getRuntime().workspaceCopyEtsyWorkspacePayload?.(prefix);

  const closeMediaLightbox = () => getRuntime().workspaceCloseMediaLightbox?.();

  const initEtsyWorkspace = () => {
    getEtsyUiTabletop().initTabletopWorkspace?.({
      initWorkspaceContext: initEtsyWorkspaceContext,
      initAuditContext: initEtsyAuditContext,
    });
    getEtsyUiCollection().initCollectionWorkspace?.({
      initWorkspaceContext: initEtsyWorkspaceContext,
      initAuditContext: initEtsyAuditContext,
    });
  };

  const initEtsyWorkspaceTabletop = () => {
    initEtsyWorkspaceContext('tt');
    initEtsyAuditContext('tt');
  };

  const initEtsyWorkspaceCollection = () => {
    initEtsyWorkspaceContext('col');
    initEtsyAuditContext('col');
  };

  global.PipelineUIEtsyWorkspace = {
    ...(global.PipelineUIEtsyWorkspace || {}),
    initEtsyWorkspace,
    initEtsyWorkspaceContext,
    initEtsyAuditContext,
    initEtsyWorkspaceTabletop,
    initEtsyWorkspaceCollection,
    loadEtsyWorkspaceMedia,
    copyEtsyWorkspacePayload,
    closeMediaLightbox,
  };

  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.etsyWorkspace = global.PipelineUIEtsyWorkspace;
  Object.assign(global, global.PipelineUIEtsyWorkspace);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEtsyWorkspace, { once: true });
  } else {
    initEtsyWorkspace();
  }
})(window);
