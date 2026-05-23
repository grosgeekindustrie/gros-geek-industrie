(function initPipelineUIEtsyRuntimePublication(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};
  const EtsyData = global.PipelineUIEtsyData || {};

  function buildPublicationPayloadSnapshot(state) {
    return EtsyData.buildDraftPublicationPayload?.(state) || {
      payload: {},
      validationErrors: ['payload publication introuvable'],
      sourceListingId: '',
      warnings: [],
    };
  }

  async function publishDraftListing(prefix, deps = {}) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const state = deps.getState?.(prefix) || runtime.getWorkspaceState?.(prefix);
    if (!state) return;

    deps.applyAttributesDraftToPayload?.(state);
    runtime.syncPayloadText?.(state);

    const snapshot = buildPublicationPayloadSnapshot(state);
    state.publicationSubmitting = true;
    state.publicationResult = null;
    state.publicationError = '';
    runtime.workspaceRenderPublicationStep?.(prefix);

    if (snapshot.validationErrors.length) {
      state.publicationSubmitting = false;
      state.publicationError = `Publication impossible: ${snapshot.validationErrors.join(', ')}`;
      runtime.workspaceRenderPublicationStep?.(prefix);
      return;
    }

    try {
      const response = await deps.createDraftListing?.(snapshot.payload || {});
      state.publicationResult = response || null;
      state.publicationError = '';
      runtime.workspaceSetStatus?.(prefix, 'Draft Etsy cree.');
    } catch (error) {
      state.publicationResult = null;
      const errorParts = [];
      if (error?.status) errorParts.push(`HTTP ${error.status}`);
      if (error?.message) errorParts.push(String(error.message));
      state.publicationError = errorParts.join(' - ') || 'Publication draft impossible';
      if (error?.payload && typeof error.payload === 'object') {
        state.publicationResult = {
          ok: false,
          error: error.message || 'Publication draft impossible',
          status: error.status || null,
          payload: error.payload,
        };
      }
      runtime.workspaceSetStatus?.(prefix, `Publication : ${state.publicationError}`);
    } finally {
      state.publicationSubmitting = false;
      runtime.workspaceRenderPublicationStep?.(prefix);
    }
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    buildPublicationPayloadSnapshot,
    publishDraftListing,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
