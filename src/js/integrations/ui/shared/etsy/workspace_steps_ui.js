(function initPipelineUIEtsyWorkspaceStepsUi(global) {
  'use strict';

  const EtsyUI = global.PipelineUIEtsyUI || { shared: {}, tabletop: {}, collection: {} };

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
    const progress = header?.querySelector('.etsy-api-progress');
    const body = panel.querySelector('.etsy-api-body');
    const sourceBlock = nodes.input?.closest?.('.fg.full');
    if (!header || !heading || !progress || !body || !sourceBlock) return;

    const title = heading.querySelector('.collection-stepper-title');
    const subtitle = heading.querySelector('.collection-stepper-subtitle');
    deps.setTextContent?.(title, 'Fiche source');
    deps.setTextContent?.(subtitle, 'Charge une fiche Etsy source une seule fois, puis laisse chaque step consommer les données dont il a besoin.');

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

    const stepSection = deps.ensureWorkspaceStepHeading?.(body);
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

    deps.renameWorkspaceLoadButton?.(prefix);
    deps.ensureWorkspaceDetailsSection?.(prefix);
    deps.ensureWorkspaceOptionsSection?.(prefix);
    configureWorkspaceProgress(prefix, deps);
  }

  EtsyUI.shared = EtsyUI.shared || {};
  EtsyUI.shared.steps = {
    ...(EtsyUI.shared.steps || {}),
    configureWorkspaceProgress,
    setWorkspaceActiveStep,
    ensureWorkspaceSourcePanel,
  };

  global.PipelineUIEtsyUI = EtsyUI;
})(window);
