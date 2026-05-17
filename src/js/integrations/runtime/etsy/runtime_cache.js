(function initPipelineUIEtsyRuntimeCache(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};
  const EtsyData = global.PipelineUIEtsyData || {};
  const LISTING_REF_STORAGE_PREFIX = 'etsy.workspace.listingRef.';

  function getListingRefStorageKey(prefix) {
    return `${LISTING_REF_STORAGE_PREFIX}${prefix}`;
  }

  function saveListingReference(prefix, value) {
    try {
      localStorage.setItem(getListingRefStorageKey(prefix), String(value || '').trim());
    } catch (error) {}
  }

  function restoreListingReference(prefix) {
    try {
      return String(localStorage.getItem(getListingRefStorageKey(prefix)) || '').trim();
    } catch (error) {
      return '';
    }
  }

  function buildLocalImagePayload(state) {
    return Array.isArray(state?.localImages)
      ? state.localImages.map((image) => ({
          local_id: image.local_id,
          name: image.name,
          width: image.width,
          height: image.height,
          media_type: image.media_type,
          alt_text: image.alt_text || '',
          pending_upload: true,
        }))
      : [];
  }

  function cacheTaxonomyEntries(prefix, entries) {
    const state = global.PipelineUIEtsyRuntime?.getWorkspaceState?.(prefix);
    if (!state || !Array.isArray(entries)) return [];

    const normalizedEntries = entries.map(EtsyData.normalizeTaxonomyEntry).filter(Boolean);
    normalizedEntries.forEach((entry) => {
      state.taxonomyLookup[entry.taxonomy_id] = entry;
    });
    return normalizedEntries;
  }

  function syncPayloadText(state) {
    if (!state) return;
    if (!state.payloadEnvelope) {
      state.payloadText = '';
      return;
    }

    state.payloadText = JSON.stringify({
      ...state.payloadEnvelope,
      payload: state.mediaPayload,
      ui_state: {
        media_order: state.mediaOrder,
        local_images: buildLocalImagePayload(state),
        active_step: state.activeStep || 'media',
        details_draft: state.detailsDraft || null,
        options_draft: state.optionsDraft || null,
      },
    }, null, 2);
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    getListingRefStorageKey,
    saveListingReference,
    restoreListingReference,
    buildLocalImagePayload,
    cacheTaxonomyEntries,
    syncPayloadText,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
