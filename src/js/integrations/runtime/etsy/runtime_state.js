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
      attributesDraft: null,
      isEditingCategory: false,
      publicationMode: 'create_draft',
      publicationSubmitting: false,
      publicationResult: null,
      publicationError: '',
      sourceListingState: '',
      taxonomyLookup: {},
      taxonomySearchResults: [],
      taxonomySearchQuery: '',
      sortable: null,
      mediaOrder: [],
      selectedPipelineAltMediaKeys: [],
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
