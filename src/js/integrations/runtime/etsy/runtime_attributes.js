(function initPipelineUIEtsyRuntimeAttributes(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};
  const EtsyData = global.PipelineUIEtsyData || {};

  function ensureAttributesDraft(state) {
    if (!state) return null;
    if (!state.attributesDraft) {
      state.attributesDraft = EtsyData.buildAttributesDraftFromPayload?.(state.mediaPayload) || null;
    }
    return state.attributesDraft;
  }

  function applyAttributesDraftToPayload(state) {
    const data = state?.mediaPayload?.data;
    const draft = state?.attributesDraft;
    if (!data || !draft) return;
    EtsyData.applyAttributesDraftToPayload?.(data, draft);
  }

  function updateAttributesDraft(prefix, patchOrMutator, deps = {}) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const state = deps.getState?.(prefix) || runtime.getWorkspaceState?.(prefix);
    if (!state) return;

    const draft = ensureAttributesDraft(state);
    if (!draft) return;

    if (typeof patchOrMutator === 'function') {
      patchOrMutator(draft);
    } else if (patchOrMutator && typeof patchOrMutator === 'object') {
      state.attributesDraft = {
        ...draft,
        ...patchOrMutator,
      };
    }

    const nextDraft = state.attributesDraft || draft;
    nextDraft.tags = EtsyData.normalizeAttributeTags?.(nextDraft.tags || []) || [];
    nextDraft.pendingTagsInput = String(nextDraft.pendingTagsInput || '');
    nextDraft.dimensions = {
      height: EtsyData.normalizeDimensionValue?.(nextDraft.dimensions?.height) || '',
      width: EtsyData.normalizeDimensionValue?.(nextDraft.dimensions?.width) || '',
      depth: EtsyData.normalizeDimensionValue?.(nextDraft.dimensions?.depth) || '',
      unit: EtsyData.normalizeDimensionUnit?.(nextDraft.dimensions?.unit),
    };
    nextDraft.occasion = EtsyData.normalizeOccasion?.(nextDraft.occasion);

    applyAttributesDraftToPayload(state);
    runtime.syncPayloadText?.(state);
    runtime.syncWorkspacePayloadView?.(prefix);
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    ensureAttributesDraft,
    applyAttributesDraftToPayload,
    updateAttributesDraft,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
