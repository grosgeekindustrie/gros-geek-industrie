(function initPipelineUIEtsyWorkspaceModalsUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };
  const LIGHTBOX_ID = 'etsyMediaLightbox';
  const IMAGE_EDITOR_OVERLAY_ID = 'etsyImageEditorOverlay';
  const CATEGORY_PICKER_OVERLAY_ID = 'etsyCategoryPickerOverlay';
  const OPTIONS_MODAL_ID = 'etsyOptionsModal';
  const OPTIONS_TYPE_PICKER_ID = 'etsyOptionsTypePicker';
  const OPTIONS_EDITOR_ID = 'etsyOptionsEditor';
  const getNode = (deps, id) => deps.getNode?.(id) || document.getElementById(id);
  const getModalIds = (deps) => ({
    lightboxId: deps.LIGHTBOX_ID || LIGHTBOX_ID,
    imageEditorOverlayId: deps.IMAGE_EDITOR_OVERLAY_ID || IMAGE_EDITOR_OVERLAY_ID,
    categoryPickerOverlayId: deps.CATEGORY_PICKER_OVERLAY_ID || CATEGORY_PICKER_OVERLAY_ID,
    optionsModalId: deps.OPTIONS_MODAL_ID || OPTIONS_MODAL_ID,
    optionsTypePickerId: deps.OPTIONS_TYPE_PICKER_ID || OPTIONS_TYPE_PICKER_ID,
    optionsEditorId: deps.OPTIONS_EDITOR_ID || OPTIONS_EDITOR_ID,
  });

  function closeOverlayById(id, deps = {}) {
    const overlay = getNode(deps, id);
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function closeCategoryPickerOverlay(deps = {}) {
    closeOverlayById(getModalIds(deps).categoryPickerOverlayId, deps);
    if (global.PipelineUIEtsyWorkspace) {
      global.PipelineUIEtsyWorkspace.categoryPickerState = null;
    }
  }

  function closeOptionsOverlays(deps = {}) {
    const modalState = deps.getOptionsModalState?.();
    const modalIds = getModalIds(deps);
    if (modalState?.optionSortable?.destroy) {
      try {
        modalState.optionSortable.destroy();
      } catch (error) {}
    }

    [modalIds.optionsModalId, modalIds.optionsTypePickerId, modalIds.optionsEditorId].forEach((id) => {
      closeOverlayById(id, deps);
    });

    if (global.PipelineUIEtsyWorkspace) {
      global.PipelineUIEtsyWorkspace.optionsModalState = null;
    }
  }

  function closeImageEditorOverlay(deps = {}) {
    const overlay = getNode(deps, getModalIds(deps).imageEditorOverlayId);
    const editorHost = getNode(deps, 'etsyImageEditorHost');
    const session = deps.getActiveEditorSession?.();

    if (session?.instance?.terminate) {
      try {
        session.instance.terminate();
      } catch (error) {}
    }

    deps.setActiveEditorSession?.(null);

    if (editorHost) {
      editorHost.innerHTML = '';
    }

    if (overlay) {
      overlay.classList.remove('visible');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  function closeMediaLightbox(deps = {}) {
    const overlay = getNode(deps, getModalIds(deps).lightboxId);
    if (!overlay) return;

    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');

    const active = deps.getActiveMediaSelection?.();
    if (!active) return;

    const state = deps.getState?.(active.prefix);
    if (!state) return;
    state.activeMediaKey = '';
  }

  function ensureMediaLightbox(deps = {}) {
    const { lightboxId } = getModalIds(deps);
    const existing = getNode(deps, lightboxId);
    if (existing) {
      const hasEditButton = existing.querySelector('[data-js="etsy-media-lightbox-edit-image"]');
      const hasHeaderActions = existing.querySelector('#etsyMediaLightboxHeaderActions');
      if (hasEditButton && hasHeaderActions) return;
      existing.remove();
    }

    const host = document.createElement('div');
    host.innerHTML = `
<div id="${lightboxId}" class="lb-overlay etsy-media-lightbox" aria-hidden="true">
  <div class="lb-box lb-box-wide etsy-media-lightbox-box" role="dialog" aria-modal="true" aria-labelledby="etsyMediaLightboxTitle">
    <div class="lb-header">
      <h3 id="etsyMediaLightboxTitle"><span data-svg-icon="image"></span><span class="ui-icon-label">MEDIA ETSY</span></h3>
      <div class="etsy-media-lightbox-header-actions">
        <div id="etsyMediaLightboxHeaderActions" class="field-action-row etsy-media-lightbox-header-buttons">
          <button class="btn btn-muted btn-xs-inline" type="button" data-js="etsy-media-lightbox-edit-image-header"><span data-svg-icon="crop"></span><span class="ui-icon-label">Editer image</span></button>
          <button class="btn btn-muted btn-xs-inline" type="button" data-js="etsy-media-lightbox-reset-image-header"><span data-svg-icon="refresh"></span><span class="ui-icon-label">Reinitialiser</span></button>
        </div>
        <button class="lb-close" type="button" data-js="etsy-media-lightbox-close"><span data-svg-icon="close"></span></button>
      </div>
    </div>
    <div class="lb-body etsy-media-lightbox-body">
      <div class="etsy-media-lightbox-stage">
        <div id="etsyMediaLightboxPreview" class="etsy-media-lightbox-preview"></div>
      </div>
      <div class="etsy-media-lightbox-side">
        <div class="etsy-media-lightbox-meta">
          <div class="etsy-media-lightbox-meta-item">
            <span class="etsy-media-lightbox-meta-label">Type</span>
            <span id="etsyMediaLightboxType" class="etsy-media-lightbox-meta-value">-</span>
          </div>
          <div class="etsy-media-lightbox-meta-item">
            <span class="etsy-media-lightbox-meta-label">ID</span>
            <span id="etsyMediaLightboxId" class="etsy-media-lightbox-meta-value">-</span>
          </div>
          <div class="etsy-media-lightbox-meta-item">
            <span class="etsy-media-lightbox-meta-label">Resolution</span>
            <span id="etsyMediaLightboxResolution" class="etsy-media-lightbox-meta-value">-</span>
          </div>
          <div class="etsy-media-lightbox-meta-item">
            <span class="etsy-media-lightbox-meta-label">Source</span>
            <span id="etsyMediaLightboxSource" class="etsy-media-lightbox-meta-value">-</span>
          </div>
        </div>
        <div id="etsyMediaLightboxAltGroup" class="fg full etsy-media-lightbox-alt-group">
          <label for="etsyMediaLightboxAltInput">Balise ALT</label>
          <textarea id="etsyMediaLightboxAltInput" class="textarea-md" placeholder="Balise ALT de l image"></textarea>
          <div class="field-action-row etsy-media-lightbox-alt-actions">
            <button class="btn btn-muted" type="button" data-js="etsy-media-lightbox-clear-alt"><span data-svg-icon="refresh"></span><span class="ui-icon-label">Vider ALT</span></button>
          </div>
        </div>
        <div id="etsyMediaLightboxImageActions" class="field-action-row etsy-media-lightbox-image-actions">
          <button class="btn btn-muted" type="button" data-js="etsy-media-lightbox-edit-image"><span data-svg-icon="crop"></span><span class="ui-icon-label">Editer image</span></button>
          <button class="btn btn-muted" type="button" data-js="etsy-media-lightbox-reset-image"><span data-svg-icon="refresh"></span><span class="ui-icon-label">Reinitialiser image</span></button>
        </div>
      </div>
    </div>
  </div>
</div>`;

    document.body.appendChild(host);
    global.PipelineUIIcons?.hydrateIcons?.(host);

    const overlay = getNode(deps, lightboxId);
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) deps.closeMediaLightbox?.();
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-close"]')?.addEventListener('click', deps.closeMediaLightbox);

    getNode(deps, 'etsyMediaLightboxAltInput')?.addEventListener('input', (event) => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.setMediaAltText?.(active.prefix, active.mediaKey, String(event.target.value || ''));
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-clear-alt"]')?.addEventListener('click', () => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.setMediaAltText?.(active.prefix, active.mediaKey, '');
      const input = getNode(deps, 'etsyMediaLightboxAltInput');
      if (input) {
        input.value = '';
        input.focus();
      }
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-edit-image"]')?.addEventListener('click', () => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.openImageEditor?.(active.prefix, active.mediaKey);
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-reset-image"]')?.addEventListener('click', () => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.resetEditedImage?.(active.prefix, active.mediaKey);
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-edit-image-header"]')?.addEventListener('click', () => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.openImageEditor?.(active.prefix, active.mediaKey);
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-reset-image-header"]')?.addEventListener('click', () => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.resetEditedImage?.(active.prefix, active.mediaKey);
    });
  }

  function fillMediaLightbox(prefix, mediaKey, deps = {}) {
    const state = deps.getState?.(prefix);
    const mediaItem = deps.getMediaItemByKey?.(state, mediaKey);
    if (!state || !mediaItem) return false;

    deps.ensureMediaLightbox?.();
    const overlay = getNode(deps, getModalIds(deps).lightboxId);
    const previewHost = getNode(deps, 'etsyMediaLightboxPreview');
    const typeNode = getNode(deps, 'etsyMediaLightboxType');
    const idNode = getNode(deps, 'etsyMediaLightboxId');
    const resolutionNode = getNode(deps, 'etsyMediaLightboxResolution');
    const sourceNode = getNode(deps, 'etsyMediaLightboxSource');
    const altGroup = getNode(deps, 'etsyMediaLightboxAltGroup');
    const altInput = getNode(deps, 'etsyMediaLightboxAltInput');
    const imageActions = getNode(deps, 'etsyMediaLightboxImageActions');
    const headerActions = getNode(deps, 'etsyMediaLightboxHeaderActions');
    const resetImageButton = overlay?.querySelector('[data-js="etsy-media-lightbox-reset-image"]');
    const resetImageHeaderButton = overlay?.querySelector('[data-js="etsy-media-lightbox-reset-image-header"]');
    if (!overlay || !previewHost || !typeNode || !idNode || !resolutionNode || !sourceNode || !altGroup || !altInput || !imageActions || !headerActions || !resetImageButton || !resetImageHeaderButton) {
      return false;
    }

    previewHost.innerHTML = '';
    state.activeMediaKey = mediaKey;

    if (mediaItem.kind === 'image') {
      const preview = document.createElement('img');
      preview.className = 'etsy-media-lightbox-preview-image';
      preview.src = deps.getDisplayImageSource?.(prefix, mediaKey, mediaItem.value, mediaItem.isLocal) || '';
      preview.alt = mediaItem.value.alt_text || 'Image Etsy';
      previewHost.appendChild(preview);

      typeNode.textContent = mediaItem.isLocal ? 'Image locale' : 'Image Etsy';
      idNode.textContent = mediaItem.isLocal ? String(mediaItem.value.local_id || '-') : deps.getImageId?.(mediaItem.value);
      resolutionNode.textContent = deps.formatResolution?.(
        mediaItem.isLocal
          ? { width: mediaItem.value.width || 0, height: mediaItem.value.height || 0 }
          : deps.getImageResolution?.(mediaItem.value)
      ) || '-';
      sourceNode.textContent = mediaItem.isLocal ? 'Ajoutee au workspace' : (deps.getImageEditorSource?.(mediaItem) || '');
      altGroup.style.display = '';
      imageActions.style.display = '';
      headerActions.style.display = '';
      altInput.disabled = false;
      altInput.value = mediaItem.value.alt_text || '';
      const hasEditedVersion = !!deps.getEditedImageDataUrl?.(prefix, mediaKey);
      resetImageButton.disabled = !hasEditedVersion;
      resetImageHeaderButton.disabled = !hasEditedVersion;
    } else {
      const preview = document.createElement('video');
      preview.className = 'etsy-media-lightbox-preview-video';
      preview.src = mediaItem.value.video_url || '';
      preview.poster = mediaItem.value.thumbnail_url || '';
      preview.controls = true;
      preview.preload = 'metadata';
      previewHost.appendChild(preview);

      typeNode.textContent = 'Video Etsy';
      idNode.textContent = deps.getVideoId?.(mediaItem.value);
      resolutionNode.textContent = deps.formatResolution?.(deps.getVideoResolution?.(mediaItem.value)) || '-';
      sourceNode.textContent = 'Chargee depuis Etsy';
      altGroup.style.display = 'none';
      imageActions.style.display = 'none';
      headerActions.style.display = 'none';
      altInput.disabled = true;
      altInput.value = '';
    }

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    return true;
  }

  function ensureImageEditorOverlay(deps = {}) {
    const { imageEditorOverlayId } = getModalIds(deps);
    if (getNode(deps, imageEditorOverlayId)) return;

    const host = document.createElement('div');
    host.innerHTML = `
<div id="${imageEditorOverlayId}" class="lb-overlay etsy-image-editor-overlay" aria-hidden="true">
  <div class="lb-box lb-box-wide etsy-image-editor-box" role="dialog" aria-modal="true" aria-labelledby="etsyImageEditorTitle">
    <div class="lb-header">
      <h3 id="etsyImageEditorTitle"><span data-svg-icon="crop"></span><span class="ui-icon-label">EDITEUR IMAGE ETSY</span></h3>
      <button class="lb-close" type="button" data-js="etsy-image-editor-close"><span data-svg-icon="close"></span></button>
    </div>
    <div class="etsy-image-editor-stage">
      <div id="etsyImageEditorHost" class="etsy-image-editor-host"></div>
    </div>
  </div>
</div>`;

    document.body.appendChild(host);
    global.PipelineUIIcons?.hydrateIcons?.(host);

    const overlay = getNode(deps, imageEditorOverlayId);
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) deps.closeImageEditorOverlay?.();
    });

    overlay?.querySelector('[data-js="etsy-image-editor-close"]')?.addEventListener('click', deps.closeImageEditorOverlay);
  }

  function ensureCategoryPickerOverlay(deps = {}) {
    const { categoryPickerOverlayId } = getModalIds(deps);
    if (getNode(deps, categoryPickerOverlayId)) return;

    const host = document.createElement('div');
    host.innerHTML = `
<div id="${categoryPickerOverlayId}" class="lb-overlay etsy-category-picker-overlay" aria-hidden="true">
  <div class="lb-box etsy-category-picker-box" role="dialog" aria-modal="true" aria-labelledby="etsyCategoryPickerTitle">
    <div class="lb-header">
      <h3 id="etsyCategoryPickerTitle"><span data-svg-icon="search"></span><span class="ui-icon-label">CATEGORIE ETSY</span></h3>
      <button class="lb-close" type="button" data-js="etsy-category-picker-close"><span data-svg-icon="close"></span></button>
    </div>
    <div class="lb-body etsy-category-picker-body">
      <div class="fg full">
        <label for="etsyCategoryPickerInput">Rechercher une categorie</label>
        <input type="text" id="etsyCategoryPickerInput" placeholder="ex: figurine, jouet, miniature"/>
        <p id="etsyCategoryPickerStatus" class="etsy-api-field-hint">Tapez un mot-cle pour obtenir des suggestions Etsy.</p>
      </div>
      <div id="etsyCategoryPickerResults" class="etsy-category-picker-results"></div>
    </div>
  </div>
</div>`;

    document.body.appendChild(host);
    global.PipelineUIIcons?.hydrateIcons?.(host);

    const overlay = getNode(deps, categoryPickerOverlayId);
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) deps.closeCategoryPickerOverlay?.();
    });
    overlay?.querySelector('[data-js="etsy-category-picker-close"]')?.addEventListener('click', deps.closeCategoryPickerOverlay);
    overlay?.querySelector('#etsyCategoryPickerInput')?.addEventListener('input', async (event) => {
      await deps.runCategoryPickerSearch?.(String(event.target.value || ''));
    });
  }

  function ensureOptionsOverlays(deps = {}) {
    const modalIds = getModalIds(deps);
    if (!getNode(deps, modalIds.optionsModalId)) {
      const host = document.createElement('div');
      host.innerHTML = `
<div id="${modalIds.optionsModalId}" class="lb-overlay etsy-options-overlay" aria-hidden="true">
  <div class="lb-box etsy-options-modal-box" role="dialog" aria-modal="true" aria-labelledby="etsyOptionsModalTitle">
    <div class="lb-header">
      <h3 id="etsyOptionsModalTitle"><span data-svg-icon="settings"></span><span class="ui-icon-label">GERER LES VARIATIONS</span></h3>
      <button class="lb-close" type="button" data-js="etsy-options-close"><span data-svg-icon="close"></span></button>
    </div>
    <div class="lb-body etsy-options-modal-body">
      <div class="etsy-options-modal-toolbar">
        <button class="btn btn-muted" type="button" data-js="etsy-options-add-variation"><span data-svg-icon="plus"></span><span class="ui-icon-label">Ajouter une variation</span></button>
      </div>
      <div id="etsyOptionsModalContent" class="etsy-options-modal-content"></div>
      <div class="etsy-options-modal-footer">
        <button class="btn btn-muted" type="button" data-js="etsy-options-cancel">Annuler</button>
        <button class="btn btn-accent" type="button" data-js="etsy-options-apply">Appliquer</button>
      </div>
    </div>
  </div>
</div>
<div id="${modalIds.optionsTypePickerId}" class="lb-overlay etsy-options-overlay" aria-hidden="true">
  <div class="lb-box etsy-options-type-box" role="dialog" aria-modal="true" aria-labelledby="etsyOptionsTypeTitle">
    <div class="lb-header">
      <h3 id="etsyOptionsTypeTitle"><span data-svg-icon="search"></span><span class="ui-icon-label">AJOUTER UNE VARIATION</span></h3>
      <button class="lb-close" type="button" data-js="etsy-options-type-close"><span data-svg-icon="close"></span></button>
    </div>
    <div class="lb-body etsy-options-type-body">
      <div id="etsyOptionsTypeContent" class="etsy-options-type-list"></div>
      <div class="etsy-options-type-footer">
        <button class="btn btn-muted" type="button" data-js="etsy-options-open-custom">Créer votre propre variation</button>
      </div>
    </div>
  </div>
</div>
<div id="${modalIds.optionsEditorId}" class="lb-overlay etsy-options-overlay" aria-hidden="true">
  <div class="lb-box etsy-options-editor-box" role="dialog" aria-modal="true" aria-labelledby="etsyOptionsEditorTitle">
    <div class="lb-header">
      <h3 id="etsyOptionsEditorTitle"><span data-svg-icon="settings"></span><span class="ui-icon-label">VARIATION PERSONNALISEE</span></h3>
      <button class="lb-close" type="button" data-js="etsy-options-editor-close"><span data-svg-icon="close"></span></button>
    </div>
    <div class="lb-body etsy-options-editor-body">
      <div class="fg full">
        <label for="etsyOptionsEditorName">Nom</label>
        <input type="text" id="etsyOptionsEditorName" placeholder="Nom de la variation"/>
      </div>
      <label class="social-check etsy-options-editor-toggle">
        <input type="checkbox" id="etsyOptionsEditorPhotos"/>
        <span>Associer des photos à cette variation</span>
      </label>
      <div class="etsy-options-editor-divider"></div>
      <div class="etsy-options-editor-options-head">
        <div>
          <h4>Options</h4>
          <p>Ajoutez au moins une option et reordonnez-les si besoin.</p>
        </div>
      </div>
      <div class="etsy-options-editor-option-add">
        <input type="text" id="etsyOptionsEditorOptionInput" placeholder="Indiquez une option..."/>
        <button class="btn btn-muted" type="button" data-js="etsy-options-editor-add-option">Ajouter</button>
      </div>
      <div id="etsyOptionsEditorOptions" class="etsy-options-editor-options-list"></div>
      <div id="etsyOptionsEditorPhotoAssignments" class="etsy-options-editor-photo-assignments" hidden></div>
      <div class="etsy-options-editor-footer">
        <button class="btn btn-error" type="button" data-js="etsy-options-editor-delete">Supprimer la variation</button>
        <div class="etsy-options-editor-footer-actions">
          <button class="btn btn-muted" type="button" data-js="etsy-options-editor-cancel">Annuler</button>
          <button class="btn btn-accent" type="button" data-js="etsy-options-editor-save">Terminé</button>
        </div>
      </div>
    </div>
  </div>
</div>`;
      document.body.appendChild(host);
      global.PipelineUIIcons?.hydrateIcons?.(host);
    }

    [modalIds.optionsModalId, modalIds.optionsTypePickerId, modalIds.optionsEditorId].forEach((id) => {
      const overlay = getNode(deps, id);
      if (!overlay || overlay.dataset.bound === 'true') return;
      overlay.dataset.bound = 'true';
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) deps.closeOptionsOverlays?.();
      });
    });

    const modalOverlay = getNode(deps, modalIds.optionsModalId);
    if (modalOverlay && modalOverlay.dataset.controlsBound !== 'true') {
      modalOverlay.dataset.controlsBound = 'true';
      modalOverlay.querySelector('[data-js="etsy-options-close"]')?.addEventListener('click', deps.closeOptionsOverlays);
      modalOverlay.querySelector('[data-js="etsy-options-cancel"]')?.addEventListener('click', deps.closeOptionsOverlays);
      modalOverlay.querySelector('[data-js="etsy-options-apply"]')?.addEventListener('click', deps.closeOptionsOverlays);
      modalOverlay.querySelector('[data-js="etsy-options-add-variation"]')?.addEventListener('click', deps.openOptionTypePicker);
    }

    const typeOverlay = getNode(deps, modalIds.optionsTypePickerId);
    if (typeOverlay && typeOverlay.dataset.controlsBound !== 'true') {
      typeOverlay.dataset.controlsBound = 'true';
      typeOverlay.querySelector('[data-js="etsy-options-type-close"]')?.addEventListener('click', deps.closeOptionsOverlays);
      typeOverlay.querySelector('[data-js="etsy-options-open-custom"]')?.addEventListener('click', () => deps.openOptionEditor?.());
    }

    const editorOverlay = getNode(deps, modalIds.optionsEditorId);
    if (editorOverlay && editorOverlay.dataset.controlsBound !== 'true') {
      editorOverlay.dataset.controlsBound = 'true';
      editorOverlay.querySelector('[data-js="etsy-options-editor-close"]')?.addEventListener('click', deps.closeOptionsOverlays);
      editorOverlay.querySelector('[data-js="etsy-options-editor-cancel"]')?.addEventListener('click', deps.closeOptionsOverlays);
      editorOverlay.querySelector('[data-js="etsy-options-editor-add-option"]')?.addEventListener('click', () => {
        const modalState = deps.getOptionsModalState?.();
        const optionInput = getNode(deps, 'etsyOptionsEditorOptionInput');
        if (!modalState || !optionInput) return;
        const value = String(optionInput.value || '').trim();
        if (!value) return;
        modalState.workingVariation.options.push(deps.createDefaultOptionValue?.(value));
        optionInput.value = '';
        deps.renderOptionEditorState?.();
      });
      getNode(deps, 'etsyOptionsEditorName')?.addEventListener('input', (event) => {
        const modalState = deps.getOptionsModalState?.();
        if (!modalState?.workingVariation) return;
        modalState.workingVariation.name = String(event.target.value || '');
        deps.renderOptionEditorState?.();
      });
      getNode(deps, 'etsyOptionsEditorPhotos')?.addEventListener('change', (event) => {
        const modalState = deps.getOptionsModalState?.();
        if (!modalState?.workingVariation) return;
        modalState.workingVariation.photosEnabled = !!event.target.checked;
        deps.renderOptionEditorState?.();
      });
      getNode(deps, 'etsyOptionsEditorOptionInput')?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        getNode(deps, modalIds.optionsEditorId)?.querySelector('[data-js="etsy-options-editor-add-option"]')?.click();
      });
      getNode(deps, modalIds.optionsEditorId)?.querySelector('[data-js="etsy-options-editor-delete"]')?.addEventListener('click', () => {
        const modalState = deps.getOptionsModalState?.();
        const prefix = modalState?.prefix;
        const variationId = modalState?.workingVariation?.id;
        if (!prefix || !variationId) return;
        deps.updateOptionsDraft?.(prefix, (draft) => {
          draft.variations = (draft.variations || []).filter((item) => item.id !== variationId);
        });
        deps.closeOptionsOverlays?.();
        deps.renderOptionsStep?.(prefix);
      });
      getNode(deps, modalIds.optionsEditorId)?.querySelector('[data-js="etsy-options-editor-save"]')?.addEventListener('click', () => {
        const modalState = deps.getOptionsModalState?.();
        const prefix = modalState?.prefix;
        const variation = modalState?.workingVariation;
        if (!prefix || !variation) return;

        const nameInput = deps.getNode?.('etsyOptionsEditorName');
        const photosInput = deps.getNode?.('etsyOptionsEditorPhotos');
        variation.name = String(nameInput?.value || '').trim();
        variation.photosEnabled = !!photosInput?.checked;
        variation.options = (variation.options || []).filter((option) => String(option.label || '').trim());
        if (!variation.name || !variation.options.length) return;

        deps.updateOptionsDraft?.(prefix, (draft) => {
          const existingIndex = (draft.variations || []).findIndex((item) => item.id === variation.id);
          if (existingIndex >= 0) {
            draft.variations.splice(existingIndex, 1, variation);
          } else {
            draft.variations.push(variation);
          }
          if (draft.variations.length > 2) {
            draft.variations = draft.variations.slice(0, 2);
          }
        });
        deps.closeOptionsOverlays?.();
        deps.renderOptionsStep?.(prefix);
      });
    }
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.modals = {
    ...(EtsyUI.shared.modals || {}),
    ensureMediaLightbox,
    fillMediaLightbox,
    ensureImageEditorOverlay,
    ensureCategoryPickerOverlay,
    ensureOptionsOverlays,
    closeOverlayById,
    closeCategoryPickerOverlay,
    closeOptionsOverlays,
    closeImageEditorOverlay,
    closeMediaLightbox,
  };

  global.PipelineUIEtsyUI = EtsyUI;
})(window);
