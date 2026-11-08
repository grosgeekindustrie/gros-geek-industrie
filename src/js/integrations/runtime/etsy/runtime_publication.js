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
      inventory: originalPayload.inventory && typeof originalPayload.inventory === 'object'
        ? originalPayload.inventory
        : {},
      images: Array.isArray(originalPayload.images) ? originalPayload.images : [],
      videos: Array.isArray(originalPayload.videos) ? originalPayload.videos : [],
      mediaPlan: originalPayload.mediaPlan || {},
      attributes: originalPayload.attributes && typeof originalPayload.attributes === 'object'
        ? originalPayload.attributes
        : {},
    };

    return {
      ...normalizedSnapshot,
      payload,
      validationErrors: Array.isArray(normalizedSnapshot.validationErrors)
        ? [...normalizedSnapshot.validationErrors]
        : [],
      sourceListingId,
      sourceListingState,
      warnings: [
        publicationMode === 'update_expired_listing'
          ? 'Mode fiche expiree : contenu, tarifs, variations, dimensions, attributs et medias seront remis a jour, puis la fiche sera reactivee sur Etsy.'
          : 'Mode mise a jour : contenu, tarifs, variations, dimensions, attributs et medias seront remis a jour.',
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

    const activeShopKey = String(
      deps.getActiveShopKey?.()
      || global.PipelineUIApp?.getActiveShopKey?.()
      || ''
    ).trim();
    if (activeShopKey) return normalizeShopKey(activeShopKey);

    const sourceShopKey = String(state?.sourceShopKey || '').trim();
    if (sourceShopKey) return normalizeShopKey(sourceShopKey);
    return 'grosgeek';
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
    if (publicationMode === 'update_expired_listing' && options.renewalPayload) {
      const renewal = options.renewalPayload;
      const errors = snapshot.validationErrors;
      if (String(snapshot.sourceListingId || '') !== String(renewal.listingId || '')) {
        errors.push('la fiche Etsy chargée ne correspond pas au dossier de renouvellement');
      }
      snapshot.payload.createPayload = {
        title: String(renewal.title || '').trim(),
        description: String(renewal.description || ''),
      };
      snapshot.payload.updatePayload = {
        tags: Array.isArray(renewal.tags) ? renewal.tags : [],
      };
      snapshot.payload.images = Array.isArray(renewal.images) ? renewal.images : [];
      snapshot.payload.mediaPlan = {
        ...(snapshot.payload.mediaPlan || {}),
        plannedImageCount: snapshot.payload.images.length,
        plannedVideoCount: snapshot.payload.videos.length,
        orderedMediaCount: snapshot.payload.images.length + snapshot.payload.videos.length,
      };
      if (!snapshot.payload.createPayload.title) errors.push('titre final manquant');
      if (!snapshot.payload.createPayload.description.trim()) errors.push('description finale manquante');
      if (!snapshot.payload.images.length) errors.push('images finales manquantes');

      const products = snapshot.payload.inventory?.products || [];
      const prices = renewal.pricesByScale || {};
      if (!products.length) errors.push('variations Etsy manquantes');
      const inventoryScales = new Set();
      products.forEach((product) => {
        const value = String(product.property_values?.[0]?.values?.[0] || '');
        const label = value.split(/=>|⇒|→/)[0].replace(/\s+/g, '').replace(':', '/').toLowerCase();
        if (label) inventoryScales.add(label);
        const price = Number(prices[label]);
        if (!(price > 0)) {
          errors.push(`prix Etsy final introuvable pour ${value || 'une variation'}`);
          return;
        }
        (product.offerings || []).forEach((offering) => { offering.price = price; });
      });
      if (inventoryScales.size !== Object.keys(prices).length) {
        errors.push('le nombre de variations Etsy ne correspond pas aux échelles préparées');
      }
    }
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
          pipelineMode: String(prefix || '').trim() === 'col' ? 'collection' : 'tabletop',
        })
        : publicationMode === 'update_expired_listing'
          ? await deps.updateExpiredListing?.({
          ...(snapshot.payload || {}),
          targetListingId: String(snapshot.sourceListingId || '').trim(),
          mode: 'update_expired_listing',
          shopKey: targetShopKey,
          sourceShopKey: String(state.sourceShopKey || '').trim() || '',
          pipelineMode: String(prefix || '').trim() === 'col' ? 'collection' : 'tabletop',
        })
          : await deps.createDraftListing?.({
            ...(snapshot.payload || {}),
            mode: 'create_draft',
            shopKey: targetShopKey,
            sourceShopKey: String(state.sourceShopKey || '').trim() || '',
            pipelineMode: String(prefix || '').trim() === 'col' ? 'collection' : 'tabletop',
          });
      if (!response?.ok) {
        throw new Error('Aucune confirmation de publication reçue du backend Etsy');
      }
      state.publicationResult = response || null;
      state.publicationError = '';
      const successMessage = publicationMode === 'update_expired_listing'
          ? `Fiche Etsy expiree mise a jour et reactivee sur ${targetShopLabel}.`
          : (publicationMode === 'update_listing' ? `Fiche Etsy mise a jour sur ${targetShopLabel}.` : `Draft Etsy cree sur ${targetShopLabel}.`);
      runtime.workspaceSetStatus?.(prefix, successMessage);
      global.showToast?.(successMessage);
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
      global.showToast?.(`Publication Etsy : ${state.publicationError}`, '#ff4757');
    } finally {
      state.publicationSubmitting = false;
      runtime.workspaceRenderPublicationStep?.(prefix);
    }
  }

  function refreshPublicationSnapshot(prefix = '') {
    const normalizedPrefix = String(prefix || '').trim();
    const runtime = global.PipelineUIEtsyRuntime || {};
    const state = runtime.getWorkspaceState?.(normalizedPrefix);
    if (!state || state.publicationSubmitting) return;

    if (String(state.publicationError || '').startsWith('Publication impossible:')) {
      const snapshot = buildPublicationPayloadSnapshot(state);
      state.publicationError = snapshot.validationErrors.length
        ? `Publication impossible: ${snapshot.validationErrors.join(', ')}`
        : '';
    }

    runtime.workspaceRenderPublicationStep?.(normalizedPrefix);
  }

  document.addEventListener('pipeline:pricing-changed', (event) => {
    refreshPublicationSnapshot(event.detail?.prefix);
  });

  document.addEventListener('pipeline:scales-changed', (event) => {
    refreshPublicationSnapshot(event.detail?.prefix);
  });

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    buildPublicationPayloadSnapshot,
    getPublicationMode,
    getPublicationTargetShopKey,
    setPublicationMode,
    publishDraftListing,
    refreshPublicationSnapshot,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
