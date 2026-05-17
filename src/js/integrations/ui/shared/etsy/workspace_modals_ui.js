(function initPipelineUIEtsyWorkspaceModalsUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };

  function closeOverlayById(id, deps = {}) {
    const overlay = deps.getNode?.(id) || document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function closeCategoryPickerOverlay(deps = {}) {
    closeOverlayById(deps.CATEGORY_PICKER_OVERLAY_ID, deps);
    if (global.PipelineUIEtsyWorkspace) {
      global.PipelineUIEtsyWorkspace.categoryPickerState = null;
    }
  }

  function closeOptionsOverlays(deps = {}) {
    const modalState = deps.getOptionsModalState?.();
    if (modalState?.optionSortable?.destroy) {
      try {
        modalState.optionSortable.destroy();
      } catch (error) {}
    }

    [deps.OPTIONS_MODAL_ID, deps.OPTIONS_TYPE_PICKER_ID, deps.OPTIONS_EDITOR_ID].forEach((id) => {
      closeOverlayById(id, deps);
    });

    if (global.PipelineUIEtsyWorkspace) {
      global.PipelineUIEtsyWorkspace.optionsModalState = null;
    }
  }

  function closeImageEditorOverlay(deps = {}) {
    const overlay = deps.getNode?.(deps.IMAGE_EDITOR_OVERLAY_ID);
    const editorHost = deps.getNode?.('etsyImageEditorHost');
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
    const overlay = deps.getNode?.(deps.LIGHTBOX_ID);
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
    const existing = deps.getNode?.(deps.LIGHTBOX_ID);
    if (existing) {
      const hasEditButton = existing.querySelector('[data-js="etsy-media-lightbox-edit-image"]');
      const hasHeaderActions = existing.querySelector('#etsyMediaLightboxHeaderActions');
      if (hasEditButton && hasHeaderActions) return;
      existing.remove();
    }

    const host = document.createElement('div');
    host.innerHTML = `
<div id="${deps.LIGHTBOX_ID}" class="lb-overlay etsy-media-lightbox" aria-hidden="true">
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

    const overlay = deps.getNode?.(deps.LIGHTBOX_ID);
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) deps.closeMediaLightbox?.();
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-close"]')?.addEventListener('click', deps.closeMediaLightbox);

    deps.getNode?.('etsyMediaLightboxAltInput')?.addEventListener('input', (event) => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.setMediaAltText?.(active.prefix, active.mediaKey, String(event.target.value || ''));
    });

    overlay?.querySelector('[data-js="etsy-media-lightbox-clear-alt"]')?.addEventListener('click', () => {
      const active = deps.getActiveMediaSelection?.();
      if (!active) return;
      deps.setMediaAltText?.(active.prefix, active.mediaKey, '');
      const input = deps.getNode?.('etsyMediaLightboxAltInput');
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

  function ensureImageEditorOverlay(deps = {}) {
    if (deps.getNode?.(deps.IMAGE_EDITOR_OVERLAY_ID)) return;

    const host = document.createElement('div');
    host.innerHTML = `
<div id="${deps.IMAGE_EDITOR_OVERLAY_ID}" class="lb-overlay etsy-image-editor-overlay" aria-hidden="true">
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

    const overlay = deps.getNode?.(deps.IMAGE_EDITOR_OVERLAY_ID);
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) deps.closeImageEditorOverlay?.();
    });

    overlay?.querySelector('[data-js="etsy-image-editor-close"]')?.addEventListener('click', deps.closeImageEditorOverlay);
  }

  function ensureCategoryPickerOverlay(deps = {}) {
    if (deps.getNode?.(deps.CATEGORY_PICKER_OVERLAY_ID)) return;

    const host = document.createElement('div');
    host.innerHTML = `
<div id="${deps.CATEGORY_PICKER_OVERLAY_ID}" class="lb-overlay etsy-category-picker-overlay" aria-hidden="true">
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

    const overlay = deps.getNode?.(deps.CATEGORY_PICKER_OVERLAY_ID);
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) deps.closeCategoryPickerOverlay?.();
    });
    overlay?.querySelector('[data-js="etsy-category-picker-close"]')?.addEventListener('click', deps.closeCategoryPickerOverlay);
    overlay?.querySelector('#etsyCategoryPickerInput')?.addEventListener('input', async (event) => {
      await deps.runCategoryPickerSearch?.(String(event.target.value || ''));
    });
  }

  function ensureOptionsOverlays(deps = {}) {
    if (!deps.getNode?.(deps.OPTIONS_MODAL_ID)) {
      const host = document.createElement('div');
      host.innerHTML = `
<div id="${deps.OPTIONS_MODAL_ID}" class="lb-overlay etsy-options-overlay" aria-hidden="true">
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
<div id="${deps.OPTIONS_TYPE_PICKER_ID}" class="lb-overlay etsy-options-overlay" aria-hidden="true">
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
<div id="${deps.OPTIONS_EDITOR_ID}" class="lb-overlay etsy-options-overlay" aria-hidden="true">
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

    [deps.OPTIONS_MODAL_ID, deps.OPTIONS_TYPE_PICKER_ID, deps.OPTIONS_EDITOR_ID].forEach((id) => {
      const overlay = deps.getNode?.(id);
      if (!overlay || overlay.dataset.bound === 'true') return;
      overlay.dataset.bound = 'true';
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) deps.closeOptionsOverlays?.();
      });
    });

    const modalOverlay = deps.getNode?.(deps.OPTIONS_MODAL_ID);
    if (modalOverlay && modalOverlay.dataset.controlsBound !== 'true') {
      modalOverlay.dataset.controlsBound = 'true';
      modalOverlay.querySelector('[data-js="etsy-options-close"]')?.addEventListener('click', deps.closeOptionsOverlays);
      modalOverlay.querySelector('[data-js="etsy-options-cancel"]')?.addEventListener('click', deps.closeOptionsOverlays);
      modalOverlay.querySelector('[data-js="etsy-options-apply"]')?.addEventListener('click', deps.closeOptionsOverlays);
      modalOverlay.querySelector('[data-js="etsy-options-add-variation"]')?.addEventListener('click', deps.openOptionTypePicker);
    }

    const typeOverlay = deps.getNode?.(deps.OPTIONS_TYPE_PICKER_ID);
    if (typeOverlay && typeOverlay.dataset.controlsBound !== 'true') {
      typeOverlay.dataset.controlsBound = 'true';
      typeOverlay.querySelector('[data-js="etsy-options-type-close"]')?.addEventListener('click', deps.closeOptionsOverlays);
      typeOverlay.querySelector('[data-js="etsy-options-open-custom"]')?.addEventListener('click', () => deps.openOptionEditor?.());
    }

    const editorOverlay = deps.getNode?.(deps.OPTIONS_EDITOR_ID);
    if (editorOverlay && editorOverlay.dataset.controlsBound !== 'true') {
      editorOverlay.dataset.controlsBound = 'true';
      editorOverlay.querySelector('[data-js="etsy-options-editor-close"]')?.addEventListener('click', deps.closeOptionsOverlays);
      editorOverlay.querySelector('[data-js="etsy-options-editor-cancel"]')?.addEventListener('click', deps.closeOptionsOverlays);
      editorOverlay.querySelector('[data-js="etsy-options-editor-add-option"]')?.addEventListener('click', () => {
        const modalState = deps.getOptionsModalState?.();
        const optionInput = deps.getNode?.('etsyOptionsEditorOptionInput');
        if (!modalState || !optionInput) return;
        const value = String(optionInput.value || '').trim();
        if (!value) return;
        modalState.workingVariation.options.push(deps.createDefaultOptionValue?.(value));
        optionInput.value = '';
        deps.renderOptionEditorState?.();
      });
      deps.getNode?.('etsyOptionsEditorName')?.addEventListener('input', (event) => {
        const modalState = deps.getOptionsModalState?.();
        if (!modalState?.workingVariation) return;
        modalState.workingVariation.name = String(event.target.value || '');
        deps.renderOptionEditorState?.();
      });
      deps.getNode?.('etsyOptionsEditorPhotos')?.addEventListener('change', (event) => {
        const modalState = deps.getOptionsModalState?.();
        if (!modalState?.workingVariation) return;
        modalState.workingVariation.photosEnabled = !!event.target.checked;
        deps.renderOptionEditorState?.();
      });
      deps.getNode?.('etsyOptionsEditorOptionInput')?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        deps.getNode?.(deps.OPTIONS_EDITOR_ID)?.querySelector('[data-js="etsy-options-editor-add-option"]')?.click();
      });
      deps.getNode?.(deps.OPTIONS_EDITOR_ID)?.querySelector('[data-js="etsy-options-editor-delete"]')?.addEventListener('click', () => {
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
      deps.getNode?.(deps.OPTIONS_EDITOR_ID)?.querySelector('[data-js="etsy-options-editor-save"]')?.addEventListener('click', () => {
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
