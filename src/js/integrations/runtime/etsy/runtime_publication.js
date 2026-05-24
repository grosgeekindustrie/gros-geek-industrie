(function initPipelineUIEtsyRuntimePublication(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};
  const EtsyData = global.PipelineUIEtsyData || {};

  function filterSnapshotForMode(snapshot, state) {
    const normalizedSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const publicationMode = getPublicationMode(state);
    if (publicationMode !== 'update_listing') {
      return normalizedSnapshot;
    }

    const sourceListingId = String(normalizedSnapshot.sourceListingId || '').trim();
    const sourceListingState = String(normalizedSnapshot.sourceListingState || '').trim().toLowerCase();
    const originalPayload = normalizedSnapshot.payload && typeof normalizedSnapshot.payload === 'object'
      ? normalizedSnapshot.payload
      : {};
    const createPayload = originalPayload.createPayload && typeof originalPayload.createPayload === 'object'
      ? originalPayload.createPayload
      : {};
    const payload = {
      createPayload: {
        title: createPayload.title,
        description: createPayload.description,
      },
      updatePayload: {
        tags: Array.isArray(originalPayload.updatePayload?.tags) ? originalPayload.updatePayload.tags : [],
      },
      images: Array.isArray(originalPayload.images) ? originalPayload.images : [],
      videos: Array.isArray(originalPayload.videos) ? originalPayload.videos : [],
      mediaPlan: originalPayload.mediaPlan || {},
      attributes: {},
    };

    return {
      ...normalizedSnapshot,
      payload,
      validationErrors: [
        ...(!String(createPayload.title || '').trim() ? ['title manquant'] : []),
        ...(!String(createPayload.description || '').trim() ? ['description manquante'] : []),
      ],
      sourceListingId,
      sourceListingState,
      warnings: [
        'Mode mise a jour : seuls le titre, la description, les tags, les images, la video et les ALT seront renvoyes.',
        ...(Array.isArray(normalizedSnapshot.warnings) ? normalizedSnapshot.warnings : []),
      ],
    };
  }

  function buildPublicationPayloadSnapshot(state) {
    const snapshot = EtsyData.buildDraftPublicationPayload?.(state) || {
      payload: {},
      validationErrors: ['payload publication introuvable'],
      sourceListingId: '',
      sourceListingState: '',
      warnings: [],
    };
    return filterSnapshotForMode(snapshot, state);
  }

  function getPublicationMode(state) {
    return state?.publicationMode === 'update_listing' ? 'update_listing' : 'create_draft';
  }

  function setPublicationMode(prefix, nextMode, deps = {}) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const state = deps.getState?.(prefix) || runtime.getWorkspaceState?.(prefix);
    if (!state) return;
    state.publicationMode = nextMode === 'update_listing' ? 'update_listing' : 'create_draft';
    runtime.workspaceRenderPublicationStep?.(prefix);
  }

  async function publishDraftListing(prefix, deps = {}) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const state = deps.getState?.(prefix) || runtime.getWorkspaceState?.(prefix);
    if (!state) return;

    deps.applyAttributesDraftToPayload?.(state);
    runtime.syncPayloadText?.(state);

    const snapshot = buildPublicationPayloadSnapshot(state);
    const publicationMode = getPublicationMode(state);
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
    if (publicationMode === 'update_listing' && !String(snapshot.sourceListingId || '').trim()) {
      state.publicationSubmitting = false;
      state.publicationError = 'Publication impossible: listing source introuvable pour la mise a jour.';
      runtime.workspaceRenderPublicationStep?.(prefix);
      return;
    }

    try {
      const response = publicationMode === 'update_listing'
        ? await deps.updateExistingListing?.({
          ...(snapshot.payload || {}),
          targetListingId: String(snapshot.sourceListingId || '').trim(),
          mode: 'update_listing',
        })
        : await deps.createDraftListing?.({
          ...(snapshot.payload || {}),
          mode: 'create_draft',
        });
      state.publicationResult = response || null;
      state.publicationError = '';
      runtime.workspaceSetStatus?.(
        prefix,
        publicationMode === 'update_listing'
          ? 'Fiche Etsy mise a jour.'
          : 'Draft Etsy cree.'
      );
    } catch (error) {
      state.publicationResult = null;
      const errorParts = [];
      if (error?.status) errorParts.push(`HTTP ${error.status}`);
      if (error?.message) errorParts.push(String(error.message));
      state.publicationError = errorParts.join(' - ') || 'Publication draft impossible';
      if (error?.payload && typeof error.payload === 'object') {
        state.publicationResult = {
          ok: false,
          error: error.message || (publicationMode === 'update_listing' ? 'Mise a jour Etsy impossible' : 'Publication draft impossible'),
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
    getPublicationMode,
    setPublicationMode,
    publishDraftListing,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
