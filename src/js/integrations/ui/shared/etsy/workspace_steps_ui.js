(function initPipelineUIEtsyWorkspaceStepsUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };

  function renameWorkspaceLoadButton(prefix, deps = {}) {
    const nodes = deps.getNodes?.(prefix);
    const loadButton = nodes?.panel?.querySelector?.(`[data-ui-action="load-etsy-workspace-media"][data-action-arg="${prefix}"]`);
    const label = loadButton?.querySelector?.('.ui-icon-label');
    if (label) {
      label.textContent = 'Charger la fiche source';
    }
  }

  function ensureWorkspaceStepHeading(body) {
    if (!body) return null;

    let stepSection = body.querySelector('.etsy-api-step-section');
    if (!stepSection) {
      stepSection = document.createElement('div');
      stepSection.className = 'etsy-api-step-section';
      stepSection.dataset.etsyStep = 'media';
      body.appendChild(stepSection);
    }
    stepSection.dataset.etsyStep = 'media';
    stepSection.hidden = false;

    let heading = stepSection.querySelector('.etsy-api-step-heading');
    if (!heading) {
      heading = document.createElement('div');
      heading.className = 'etsy-api-step-heading';
      heading.innerHTML = `
        <span class="collection-stepper-kicker">Step 01 · Données déjà chargées</span>
        <h3 class="etsy-api-step-title">Photo et vidéo</h3>
        <p class="etsy-api-step-subtitle">Ce step liste simplement les médias déjà chargés depuis la fiche source Etsy.</p>
      `;
      stepSection.prepend(heading);
    }

    return stepSection;
  }

  function ensureWorkspaceDetailsSection(prefix, deps = {}) {
    const nodes = deps.getNodes?.(prefix);
    const body = nodes?.panel?.querySelector?.('.etsy-api-body');
    if (!body) return null;

    let detailsSection = body.querySelector(`.etsy-api-step-section[data-etsy-step="details"]`);
    if (!detailsSection) {
      detailsSection = document.createElement('section');
      detailsSection.className = 'etsy-api-step-section';
      detailsSection.dataset.etsyStep = 'details';
      detailsSection.innerHTML = `
        <div class="etsy-api-step-heading">
          <span class="collection-stepper-kicker">Step 02 · Détails de l'article</span>
          <h3 class="etsy-api-step-title">Détails de l'article</h3>
          <p class="etsy-api-step-subtitle">Aidez les acheteurs à mieux comprendre l'article source Etsy avant la future duplication draft.</p>
        </div>
        <div class="form-section etsy-api-details-panel">
          <div class="fg full">
            <label>Categorie selectionnee</label>
            <div class="etsy-api-category-card">
              <div class="etsy-api-category-copy">
                <div id="etsyApiCategoryLabel-${prefix}" class="etsy-api-category-label">Categorie a definir</div>
                <div id="etsyApiCategoryMeta-${prefix}" class="etsy-api-category-meta">Aucune categorie detectee dans la fiche source.</div>
              </div>
              <button class="btn btn-muted btn-xs-inline" type="button" data-js="etsy-category-edit-toggle" data-prefix="${prefix}">Modifier</button>
            </div>
            <div id="etsyApiCategoryEditor-${prefix}" class="etsy-api-category-editor is-hidden">
              <label for="etsyApiCategoryPath-${prefix}">Chemin categorie</label>
              <input type="text" id="etsyApiCategoryPath-${prefix}" placeholder="ex: Figurines > Science-fiction > Astronaute"/>
              <div class="field-action-row">
                <button class="btn btn-accent btn-xs-inline" type="button" data-js="etsy-category-apply" data-prefix="${prefix}">Appliquer</button>
                <button class="btn btn-muted btn-xs-inline" type="button" data-js="etsy-category-cancel" data-prefix="${prefix}">Annuler</button>
              </div>
            </div>
          </div>
          <div class="fg full">
            <label for="etsyApiTitleInput-${prefix}">Titre</label>
            <p class="etsy-api-field-hint">Le titre Etsy est limit&eacute; &agrave; 140 caract&egrave;res.</p>
            <input type="text" id="etsyApiTitleInput-${prefix}" maxlength="220" placeholder="Titre Etsy source"/>
            <div class="etsy-api-title-meta">
              <span id="etsyApiTitleCount-${prefix}" class="etsy-api-title-count">0 / 140</span>
              <span id="etsyApiTitleWarning-${prefix}" class="etsy-api-title-warning is-hidden">Le titre depasse 140 caracteres.</span>
            </div>
          </div>
          <div class="fg full">
            <label for="etsyApiDescriptionInput-${prefix}">Description</label>
            <p class="etsy-api-field-hint">La description chargee depuis Etsy reste editable localement dans ce workspace.</p>
            <textarea id="etsyApiDescriptionInput-${prefix}" class="etsy-api-description-input" placeholder="Description Etsy source"></textarea>
          </div>
        </div>
      `;
      body.appendChild(detailsSection);
    }

    detailsSection.hidden = true;

    return detailsSection;
  }

  function ensureWorkspaceOptionsSection(prefix, deps = {}) {
    const nodes = deps.getNodes?.(prefix);
    const body = nodes?.panel?.querySelector?.('.etsy-api-body');
    if (!body) return null;

    let section = body.querySelector(`.etsy-api-step-section[data-etsy-step="options"]`);
    if (!section) {
      section = document.createElement('section');
      section.className = 'etsy-api-step-section';
      section.dataset.etsyStep = 'options';
      section.innerHTML = `
        <div class="etsy-api-step-heading">
          <span class="collection-stepper-kicker">Step 03 · Options de l'article</span>
          <h3 class="etsy-api-step-title">Options de l'article</h3>
          <p class="etsy-api-step-subtitle">Présentez les variations disponibles et préparez les références, prix et visibilités du futur draft.</p>
        </div>
        <div class="form-section etsy-api-options-panel">
          <div class="etsy-api-options-header">
            <div>
              <h4 class="etsy-api-options-heading">Variations</h4>
              <p class="etsy-api-options-copy">Ajoutez les options disponibles, de taille et de couleur par exemple.</p>
            </div>
            <button class="btn btn-muted" type="button" data-js="etsy-options-manage" data-prefix="${prefix}">Gérer les variations</button>
          </div>
          <div id="etsyApiOptionsContent-${prefix}" class="etsy-api-options-content"></div>
        </div>
      `;
      body.appendChild(section);
    }

    section.hidden = true;
    return section;
  }

  function configureWorkspaceProgress(prefix, deps = {}) {
    const nodes = deps.getNodes?.(prefix);
    const progress = nodes?.panel?.querySelector?.('.etsy-api-progress');
    if (!progress) return;

    const labels = [
      'Photo et vidéo',
      "Détails de l'article",
      'Options',
      'Attributs',
      'Prix et stock',
      'Livraison',
      'Paramètres',
    ];
    const buttons = Array.from(progress.querySelectorAll('.collection-stepper-pill'));

    buttons.forEach((button, index) => {
      if (index >= labels.length) {
        button.remove();
        return;
      }

      const labelNode = button.querySelector('.collection-stepper-pill-label');
      const indexNode = button.querySelector('.collection-stepper-pill-index');
      if (labelNode) labelNode.textContent = labels[index];
      if (indexNode) indexNode.textContent = String(index + 1).padStart(2, '0');

      if (index < 3) {
        button.disabled = false;
        button.dataset.js = 'etsy-step-trigger';
        button.dataset.etsyStep = index === 0 ? 'media' : (index === 1 ? 'details' : 'options');
        button.classList.remove('is-disabled');
      } else {
        button.disabled = true;
        delete button.dataset.js;
        button.removeAttribute('data-etsy-step');
      }
    });
  }

  function setWorkspaceActiveStep(prefix, nextStep, deps = {}) {
    const state = deps.getState?.(prefix);
    const nodes = deps.getNodes?.(prefix);
    const panel = nodes?.panel;
    if (!state || !panel) return;

    const allowedStep = String(nextStep || '').trim();
    const step = allowedStep === 'details' || allowedStep === 'options' ? allowedStep : 'media';
    state.activeStep = step;
    deps.syncPayloadText?.(state);
    deps.syncWorkspacePayloadView?.(prefix);

    const sections = panel.querySelectorAll('.etsy-api-step-section[data-etsy-step]');
    sections.forEach((section) => {
      const isActive = section.dataset.etsyStep === step;
      section.hidden = !isActive;
      section.classList.toggle('is-active', isActive);
    });

    const pills = panel.querySelectorAll('.etsy-api-progress .collection-stepper-pill');
    pills.forEach((pill) => {
      const isCurrent = pill.dataset.etsyStep === step;
      pill.classList.toggle('is-current', isCurrent);
      if (pill.dataset.etsyStep) {
        pill.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
      }
    });

    if (step === 'details') {
      deps.renderDetailsStep?.(prefix);
    }

    if (step === 'options') {
      deps.renderOptionsStep?.(prefix);
    }
  }

  function ensureWorkspaceSourcePanel(prefix, deps = {}) {
    const nodes = deps.getNodes?.(prefix);
    const panel = nodes?.panel;
    if (!panel) return;

    const header = panel.querySelector('.etsy-api-header');
    const heading = header?.querySelector('.collection-stepper-heading');
    const progress = panel.querySelector('.etsy-api-progress');
    const body = panel.querySelector('.etsy-api-body');
    const sourceBlock = nodes.input?.closest?.('.fg.full');
    if (!header || !heading || !progress || !body || !sourceBlock) return;

    const title = heading.querySelector('.collection-stepper-title');
    const subtitle = heading.querySelector('.collection-stepper-subtitle');
    const kicker = heading.querySelector('.collection-stepper-kicker');
    const sourceLabel = sourceBlock.querySelector('label');
    deps.setTextContent?.(title, 'Fiche source');
    deps.setTextContent?.(kicker, 'Etsy API · Chantier parallèle');
    deps.setTextContent?.(subtitle, 'Charge une fiche Etsy source une seule fois, puis laisse chaque step consommer les données dont il a besoin.');
    deps.setTextContent?.(sourceLabel, 'Référence fiche Etsy');

    let sourcePanel = panel.querySelector('.etsy-api-source-panel');
    if (!sourcePanel) {
      sourcePanel = document.createElement('div');
      sourcePanel.className = 'etsy-api-source-panel';
      header.insertAdjacentElement('afterend', sourcePanel);
    }

    if (sourceBlock.parentElement !== sourcePanel) {
      sourcePanel.appendChild(sourceBlock);
    }

    if (progress.parentElement !== sourcePanel) {
      sourcePanel.appendChild(progress);
    }

    const stepSection = ensureWorkspaceStepHeading(body);
    if (!stepSection) return;

    const summary = nodes.summary;
    const strip = nodes.strip;
    const payloadDetails = nodes.payload?.closest?.('details.form-optional');

    if (summary && summary.parentElement !== stepSection) {
      stepSection.appendChild(summary);
    }

    if (strip && strip.parentElement !== stepSection) {
      stepSection.appendChild(strip);
    }

    if (payloadDetails && payloadDetails.parentElement !== stepSection) {
      stepSection.appendChild(payloadDetails);
    }

    renameWorkspaceLoadButton(prefix, deps);
    ensureWorkspaceDetailsSection(prefix, deps);
    ensureWorkspaceOptionsSection(prefix, deps);
    configureWorkspaceProgress(prefix, deps);
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.steps = {
    ...(EtsyUI.shared.steps || {}),
    renameWorkspaceLoadButton,
    ensureWorkspaceStepHeading,
    ensureWorkspaceDetailsSection,
    ensureWorkspaceOptionsSection,
    configureWorkspaceProgress,
    setWorkspaceActiveStep,
    ensureWorkspaceSourcePanel,
  };

  global.PipelineUIEtsyUI = EtsyUI;
})(window);
