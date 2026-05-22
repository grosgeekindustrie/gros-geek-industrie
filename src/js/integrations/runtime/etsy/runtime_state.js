(function initPipelineUIEtsyRuntimeState(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};

  function createDefaultWorkspaceBranchState() {
    return {
      payloadText: '',
      listingId: '',
      mediaPayload: null,
      payloadEnvelope: null,
      listingPropertiesPayload: null,
      listingPropertiesError: '',
      activeStep: 'media',
      detailsDraft: null,
      optionsDraft: null,
      attributesDraft: null,
      shippingDraft: null,
      settingsDraft: null,
      isEditingCategory: false,
      isEditingShippingProfile: false,
      shippingReferencesLoading: false,
      shippingReferencesError: '',
      settingsReferencesLoading: false,
      settingsReferencesError: '',
      publicationSubmitting: false,
      publicationResult: null,
      publicationError: '',
      taxonomyLookup: {},
      taxonomySearchResults: [],
      taxonomySearchQuery: '',
      sortable: null,
      mediaOrder: [],
      localImages: [],
      activeMediaKey: '',
      editedImageDataUrls: {},
      editorDesignStates: {},
      editorSourceUrls: {},
    };
  }

  const workspaceState = EtsyRuntime.workspaceState || {
    tt: createDefaultWorkspaceBranchState(),
    col: createDefaultWorkspaceBranchState(),
  };

  function getWorkspaceState(prefix) {
    return workspaceState[prefix] || null;
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    createDefaultWorkspaceBranchState,
    workspaceState,
    getWorkspaceState,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
