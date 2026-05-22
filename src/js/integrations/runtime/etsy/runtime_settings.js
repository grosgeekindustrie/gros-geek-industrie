(function initPipelineUIEtsyRuntimeSettings(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};
  const EtsyData = global.PipelineUIEtsyData || {};

  function ensureSettingsDraft(state) {
    if (!state) return null;
    if (!state.settingsDraft) {
      state.settingsDraft = EtsyData.buildSettingsDraftFromPayload?.(state.mediaPayload) || null;
    }
    return state.settingsDraft;
  }

  function applySettingsDraftToPayload(state) {
    const data = state?.mediaPayload?.data;
    const draft = state?.settingsDraft;
    if (!data || !draft) return;
    EtsyData.applySettingsDraftToPayload?.(data, draft);
  }

  function updateSettingsDraft(prefix, patchOrMutator, deps = {}) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const state = deps.getState?.(prefix) || runtime.getWorkspaceState?.(prefix);
    if (!state) return;

    const draft = ensureSettingsDraft(state);
    if (!draft) return;

    if (typeof patchOrMutator === 'function') {
      patchOrMutator(draft);
    } else if (patchOrMutator && typeof patchOrMutator === 'object') {
      state.settingsDraft = {
        ...draft,
        ...patchOrMutator,
      };
    }

    const nextDraft = state.settingsDraft || draft;
    nextDraft.shopSectionId = EtsyData.normalizeSettingsDraftId?.(nextDraft.shopSectionId);
    nextDraft.shopSections = Array.isArray(nextDraft.shopSections) ? nextDraft.shopSections : [];
    nextDraft.featured = nextDraft.featured === true;
    nextDraft.advertise = nextDraft.advertise === true;
    nextDraft.renewalOption = nextDraft.renewalOption === 'manual' ? 'manual' : 'automatic';

    if (state.optionsDraft) {
      state.optionsDraft.autoRenew = nextDraft.renewalOption !== 'manual';
    }

    applySettingsDraftToPayload(state);
    runtime.syncPayloadText?.(state);
    runtime.syncWorkspacePayloadView?.(prefix);
  }

  async function ensureSettingsReferences(prefix, deps = {}) {
    const runtime = global.PipelineUIEtsyRuntime || {};
    const state = deps.getState?.(prefix) || runtime.getWorkspaceState?.(prefix);
    if (!state || state.settingsReferencesLoading) return;

    const draft = ensureSettingsDraft(state);
    if (!draft) return;
    if ((draft.shopSections || []).length) return;

    state.settingsReferencesLoading = true;
    state.settingsReferencesError = '';

    try {
      const sectionsPayload = await deps.fetchShopSections?.();
      draft.shopSections = EtsyData.normalizeSectionsPayload?.(sectionsPayload) || [];
      if (!draft.shopSectionId && draft.shopSections[0]?.id) {
        draft.shopSectionId = draft.shopSections[0].id;
      }
      applySettingsDraftToPayload(state);
      runtime.syncPayloadText?.(state);
      runtime.syncWorkspacePayloadView?.(prefix);
      runtime.workspaceRenderSettingsStep?.(prefix);
    } catch (error) {
      state.settingsReferencesError = String(error?.message || 'Chargement des sections impossible');
      runtime.workspaceSetStatus?.(prefix, `Parametres : ${state.settingsReferencesError}`);
      runtime.workspaceRenderSettingsStep?.(prefix);
    } finally {
      state.settingsReferencesLoading = false;
    }
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    ensureSettingsDraft,
    applySettingsDraftToPayload,
    updateSettingsDraft,
    ensureSettingsReferences,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
