(function initPipelineUIEtsyRuntimeShipping(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};
  const EtsyData = global.PipelineUIEtsyData || {};

  function ensureShippingDraft(state) {
    if (!state) return null;
    if (!state.shippingDraft) {
      state.shippingDraft = EtsyData.buildShippingDraftFromPayload?.(state.mediaPayload) || null;
    }
    return state.shippingDraft;
  }

  function applyShippingDraftToPayload(state) {
    const data = state?.mediaPayload?.data;
    const draft = state?.shippingDraft;
    if (!data || !draft) return;
    EtsyData.applyShippingDraftToPayload?.(data, draft);
  }

  function updateShippingDraft(prefix, patchOrMutator, deps = {}) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const state = deps.getState?.(prefix) || runtime.getWorkspaceState?.(prefix);
    if (!state) return;

    const draft = ensureShippingDraft(state);
    if (!draft) return;

    if (typeof patchOrMutator === 'function') {
      patchOrMutator(draft);
    } else if (patchOrMutator && typeof patchOrMutator === 'object') {
      state.shippingDraft = {
        ...draft,
        ...patchOrMutator,
      };
    }

    const nextDraft = state.shippingDraft || draft;
    nextDraft.processingProfileId = EtsyData.normalizeShippingDraftId?.(nextDraft.processingProfileId);
    nextDraft.shippingProfileId = EtsyData.normalizeShippingDraftId?.(nextDraft.shippingProfileId);
    nextDraft.processingProfileLabel = String(nextDraft.processingProfileLabel || 'Profil de traitement source').trim();
    nextDraft.processingProfileMeta = String(nextDraft.processingProfileMeta || '').trim();
    nextDraft.processingProfiles = Array.isArray(nextDraft.processingProfiles) ? nextDraft.processingProfiles : [];
    nextDraft.shippingProfiles = Array.isArray(nextDraft.shippingProfiles) ? nextDraft.shippingProfiles : [];

    applyShippingDraftToPayload(state);
    runtime.syncPayloadText?.(state);
    runtime.syncWorkspacePayloadView?.(prefix);
  }

  function setShippingProfileEditorOpen(prefix, isOpen, deps = {}) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const state = deps.getState?.(prefix) || runtime.getWorkspaceState?.(prefix);
    if (!state) return;
    state.isEditingShippingProfile = !!isOpen;
    runtime.workspaceRenderShippingStep?.(prefix);
  }

  async function ensureShippingReferences(prefix, deps = {}) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const state = deps.getState?.(prefix) || runtime.getWorkspaceState?.(prefix);
    if (!state || state.shippingReferencesLoading) return;

    const draft = ensureShippingDraft(state);
    if (!draft) return;
    if ((draft.shippingProfiles || []).length && (draft.processingProfiles || []).length) return;

    state.shippingReferencesLoading = true;
    state.shippingReferencesError = '';

    try {
      const [shippingProfilesPayload, readinessStatesPayload] = await Promise.all([
        deps.fetchShopShippingProfiles?.(),
        deps.fetchShopReadinessStates?.(),
      ]);

      draft.shippingProfiles = EtsyData.normalizeShippingProfilesPayload?.(shippingProfilesPayload) || [];
      draft.processingProfiles = EtsyData.normalizeReadinessStatesPayload?.(readinessStatesPayload) || [];

      if (!draft.shippingProfileId && draft.shippingProfiles[0]?.id) {
        draft.shippingProfileId = draft.shippingProfiles[0].id;
      }
      if (!draft.processingProfileId && draft.processingProfiles[0]?.id) {
        draft.processingProfileId = draft.processingProfiles[0].id;
      }

      const selectedProcessingProfile = draft.processingProfiles.find((profile) => profile.id === draft.processingProfileId);
      if (selectedProcessingProfile) {
        draft.processingProfileLabel = selectedProcessingProfile.label;
        draft.processingProfileMeta = selectedProcessingProfile.meta || '';
      }

      applyShippingDraftToPayload(state);
      runtime.syncPayloadText?.(state);
      runtime.syncWorkspacePayloadView?.(prefix);
      runtime.workspaceRenderShippingStep?.(prefix);
    } catch (error) {
      state.shippingReferencesError = String(error?.message || 'Chargement livraison impossible');
      runtime.workspaceSetStatus?.(prefix, `Livraison : ${state.shippingReferencesError}`);
      runtime.workspaceRenderShippingStep?.(prefix);
    } finally {
      state.shippingReferencesLoading = false;
    }
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    ensureShippingDraft,
    applyShippingDraftToPayload,
    updateShippingDraft,
    setShippingProfileEditorOpen,
    ensureShippingReferences,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
