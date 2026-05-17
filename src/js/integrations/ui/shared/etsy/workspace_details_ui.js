(function initPipelineUIEtsyWorkspaceDetailsUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };

  function autoResizeDescription(prefix, deps = {}) {
    const textarea = deps.getNode?.(`etsyApiDescriptionInput-${prefix}`);
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 220)}px`;
  }

  function renderTitleCounter(prefix, deps = {}) {
    const titleInput = deps.getNode?.(`etsyApiTitleInput-${prefix}`);
    const countNode = deps.getNode?.(`etsyApiTitleCount-${prefix}`);
    const warningNode = deps.getNode?.(`etsyApiTitleWarning-${prefix}`);
    if (!titleInput || !countNode || !warningNode) return;

    const length = String(titleInput.value || '').trim().length;
    countNode.textContent = `${length} / 140`;
    const isOverflow = length > 140;
    countNode.classList.toggle('is-overflow', isOverflow);
    warningNode.classList.toggle('is-hidden', !isOverflow);
  }

  function updateDetailsDraft(prefix, patch, deps = {}) {
    const state = deps.getState?.(prefix);
    if (!state) return;

    const draft = deps.ensureDetailsDraft?.(state);
    state.detailsDraft = {
      ...draft,
      ...patch,
    };
    deps.applyDetailsDraftToPayload?.(state);
    deps.syncPayloadText?.(state);
    deps.syncWorkspacePayloadView?.(prefix);
  }

  function renderDetailsStep(prefix, deps = {}) {
    const state = deps.getState?.(prefix);
    if (!state) return;

    const draft = deps.ensureDetailsDraft?.(state);
    const categoryLabelNode = deps.getNode?.(`etsyApiCategoryLabel-${prefix}`);
    const categoryMetaNode = deps.getNode?.(`etsyApiCategoryMeta-${prefix}`);
    const categoryEditor = deps.getNode?.(`etsyApiCategoryEditor-${prefix}`);
    const categoryInput = deps.getNode?.(`etsyApiCategoryPath-${prefix}`);
    const titleInput = deps.getNode?.(`etsyApiTitleInput-${prefix}`);
    const descriptionInput = deps.getNode?.(`etsyApiDescriptionInput-${prefix}`);
    if (!draft || !categoryLabelNode || !categoryMetaNode || !categoryEditor || !categoryInput || !titleInput || !descriptionInput) {
      return;
    }

    const categoryParts = deps.splitCategoryPath?.(draft.categoryPathText || '') || [];
    const categoryLabel = String(categoryParts.at(-1) || draft.categoryLabel || 'Categorie a definir').trim();
    const categoryMetaParts = [];
    if (categoryParts.length > 1) categoryMetaParts.push(categoryParts.join(' > '));
    if (draft.taxonomyId) categoryMetaParts.push(`taxonomy_id ${draft.taxonomyId}`);

    categoryLabelNode.textContent = categoryLabel || 'Categorie a definir';
    categoryMetaNode.textContent = categoryMetaParts.join(' · ') || 'Aucune categorie detectee dans la fiche source.';
    categoryInput.value = draft.categoryPathText || '';
    categoryEditor.classList.toggle('is-hidden', !state.isEditingCategory);

    if (titleInput.value !== draft.title) titleInput.value = draft.title || '';
    if (descriptionInput.value !== draft.description) descriptionInput.value = draft.description || '';

    renderTitleCounter(prefix, deps);
    autoResizeDescription(prefix, deps);
    deps.resolveDraftCategoryLabel?.(prefix);
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.details = {
    ...(EtsyUI.shared.details || {}),
    autoResizeDescription,
    renderTitleCounter,
    updateDetailsDraft,
    renderDetailsStep,
  };

  global.PipelineUIEtsyUI = EtsyUI;
})(window);
