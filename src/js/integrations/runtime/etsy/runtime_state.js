(function initPipelineUIEtsyRuntimeState(global) {
  'use strict';

  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};

  function createDefaultWorkspaceBranchState(prefix = '') {
    return {
      prefix: String(prefix || '').trim(),
      payloadText: '',
      listingId: '',
      sourceShopKey: '',
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
      localVideos: [],
      activeMediaKey: '',
      editedImageDataUrls: {},
      editorDesignStates: {},
      editorSourceUrls: {},
    };
  }

  function createDefaultAuditBranchState(prefix = '') {
    return {
      prefix: String(prefix || '').trim(),
      items: [],
      rawItems: [],
      sections: [],
      loading: false,
      error: '',
      lastAuditAt: '',
      sortKey: 'score',
      sortDir: 'desc',
      timeWindow: 'lifetime',
      statusFilter: 'all',
      salesFilter: 'all',
      discountFilter: 'all',
      sectionFilter: 'all',
      pageSize: 20,
      page: 1,
      shopKey: '',
      totalCount: 0,
      pagesFetched: 0,
    };
  }

  const workspaceState = EtsyRuntime.workspaceState || {
    tt: createDefaultWorkspaceBranchState('tt'),
    col: createDefaultWorkspaceBranchState('col'),
  };

  const auditState = EtsyRuntime.auditState || {
    tt: createDefaultAuditBranchState('tt'),
    col: createDefaultAuditBranchState('col'),
  };

  function getWorkspaceState(prefix) {
    return workspaceState[prefix] || null;
  }

  function getAuditState(prefix) {
    return auditState[prefix] || null;
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    createDefaultWorkspaceBranchState,
    createDefaultAuditBranchState,
    workspaceState,
    auditState,
    getWorkspaceState,
    getAuditState,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
