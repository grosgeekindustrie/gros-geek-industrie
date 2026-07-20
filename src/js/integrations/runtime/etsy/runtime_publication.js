(function initPipelineUIEtsyRuntimePublication(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};
  const EtsyData = global.PipelineUIEtsyData || {};

  function isUpdatePublicationMode(mode) {
    return mode === 'update_listing' || mode === 'update_expired_listing';
  }

  function filterSnapshotForMode(snapshot, state) {
    const normalizedSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const publicationMode = getPublicationMode(state);
    if (!isUpdatePublicationMode(publicationMode)) {
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
        publicationMode === 'update_expired_listing'
          ? 'Mode fiche expiree : la fiche chargee mettra a jour titre, description, tags, images, video et ALT, sans publication automatique.'
          : 'Mode mise a jour : seuls le titre, la description, les tags, les images, la video et les ALT seront renvoyes.',
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
    if (state?.publicationMode === 'update_listing') return 'update_listing';
    if (state?.publicationMode === 'update_expired_listing') return 'update_expired_listing';
    return 'create_draft';
  }

  function normalizeShopKey(shopKey = '') {
    return String(shopKey || '').trim() === 'doublex' ? 'doublex' : 'grosgeek';
  }

  function getPublicationTargetShopKey(state, deps = {}, options = {}) {
    const explicitTarget = String(options?.targetShopKey || '').trim();
    if (explicitTarget) return normalizeShopKey(explicitTarget);

    const sourceShopKey = String(state?.sourceShopKey || '').trim();
    if (sourceShopKey) return normalizeShopKey(sourceShopKey);

    return normalizeShopKey(deps.getActiveShopKey?.() || global.PipelineUIApp?.getActiveShopKey?.() || 'grosgeek');
  }

  function getPublicationModeFromRequest(state, options = {}) {
    const requestedMode = String(options?.modeOverride || '').trim();
    if (requestedMode === 'update_listing') return 'update_listing';
    if (requestedMode === 'update_expired_listing') return 'update_expired_listing';
    if (requestedMode === 'create_draft') return 'create_draft';
    return getPublicationMode(state);
  }

  function getShopLabel(shopKey = '') {
    return normalizeShopKey(shopKey) === 'doublex' ? 'DoubleXindustrie' : 'Gros Geek Industrie';
  }

  function setPublicationMode(prefix, nextMode, deps = {}) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const state = deps.getState?.(prefix) || runtime.getWorkspaceState?.(prefix);
    if (!state) return;
    state.publicationMode = nextMode === 'update_listing'
      ? 'update_listing'
      : (nextMode === 'update_expired_listing' ? 'update_expired_listing' : 'create_draft');
    runtime.workspaceRenderPublicationStep?.(prefix);
  }

  async function publishDraftListing(prefix, deps = {}, options = {}) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const state = deps.getState?.(prefix) || runtime.getWorkspaceState?.(prefix);
    if (!state) return;

    deps.applyAttributesDraftToPayload?.(state);
    runtime.syncPayloadText?.(state);

    const snapshot = buildPublicationPayloadSnapshot(state);
    const publicationMode = getPublicationModeFromRequest(state, options);
    const targetShopKey = getPublicationTargetShopKey(state, deps, options);
    const targetShopLabel = getShopLabel(targetShopKey);
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
    if (isUpdatePublicationMode(publicationMode) && !String(snapshot.sourceListingId || '').trim()) {
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
          shopKey: targetShopKey,
          sourceShopKey: String(state.sourceShopKey || '').trim() || '',
        })
        : publicationMode === 'update_expired_listing'
          ? await deps.updateExpiredListing?.({
          ...(snapshot.payload || {}),
          targetListingId: String(snapshot.sourceListingId || '').trim(),
          mode: 'update_expired_listing',
          shopKey: targetShopKey,
          sourceShopKey: String(state.sourceShopKey || '').trim() || '',
        })
          : await deps.createDraftListing?.({
            ...(snapshot.payload || {}),
            mode: 'create_draft',
            shopKey: targetShopKey,
            sourceShopKey: String(state.sourceShopKey || '').trim() || '',
          });
      state.publicationResult = response || null;
      state.publicationError = '';
      runtime.workspaceSetStatus?.(
        prefix,
        publicationMode === 'update_expired_listing'
          ? `Fiche Etsy expiree mise a jour sur ${targetShopLabel}.`
          : (publicationMode === 'update_listing' ? `Fiche Etsy mise a jour sur ${targetShopLabel}.` : `Draft Etsy cree sur ${targetShopLabel}.`)
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
          error: error.message || (isUpdatePublicationMode(publicationMode) ? 'Mise a jour Etsy impossible' : 'Publication draft impossible'),
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
    getPublicationTargetShopKey,
    setPublicationMode,
    publishDraftListing,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
