'use strict';

(function initPipelineUIDndStepper(global) {

// Stepper Tabletop / DnD.
// Cette couche réorganise le formulaire DnD en étapes lisibles sans renommer
// les champs déjà branchés au pipeline, à la persistance locale ou aux helpers.
// V1 : même philosophie que Collection, sans validation bloquante forte.
  global.PipelineUI = global.PipelineUI || {};

  const STEP_DEFINITIONS = [
    {
      title: 'Images',
      subtitle: 'Ajoute les visuels qui serviront à l\'analyse du pipeline.',
      footerLabel: 'Étape 1 sur 4 · Visuels de référence',
    },
    {
      title: 'Identité & archétypes',
      subtitle: 'Cadre la miniature, son univers, le sculpteur et les archétypes utiles aux agents.',
      footerLabel: 'Étape 2 sur 4 · Identité de la fiche',
    },
    {
      title: 'Échelles',
      subtitle: 'Renseigne les formats proposés et les dimensions de vente.',
      footerLabel: 'Étape 3 sur 4 · Offre produit',
    },
    {
      title: 'Paramètres & options',
      subtitle: 'Finalise la pose, le type produit, la version et les options avancées.',
      footerLabel: 'Étape 4 sur 4 · Prêt pour le pipeline',
    },
  ];

  const uiState = {
    activeStepIndex: 0,
    maxVisitedStepIndex: 0,
    isInitialized: false,
  };

  const getRoot = () => document.querySelector('[data-js="dnd-stepper"]');
  const getSteps = () => Array.from(document.querySelectorAll('[data-js="dnd-step"]'));
  const getJumpButtons = () => Array.from(document.querySelectorAll('[data-js="dnd-stepper-jump"]'));
  const getPrevButton = () => document.querySelector('[data-js="dnd-stepper-prev"]');
  const getNextButton = () => document.querySelector('[data-js="dnd-stepper-next"]');
  const getRunButton = () => document.querySelector('[data-js="dnd-stepper"] #runBtn-tt');
  const getWarningBox = () => document.getElementById('imgWarning-tt');
  const getFooterLabel = () => document.querySelector('[data-js="dnd-stepper-footer-label"]');
  const getTitle = () => document.querySelector('[data-js="dnd-stepper-title"]');
  const getSubtitle = () => document.querySelector('[data-js="dnd-stepper-subtitle"]');

  const clampStepIndex = (index) => Math.min(Math.max(index, 0), STEP_DEFINITIONS.length - 1);

  function isLastStep() {
    return uiState.activeStepIndex === STEP_DEFINITIONS.length - 1;
  }

  function syncHeader() {
    const title = getTitle();
    const subtitle = getSubtitle();
    const footerLabel = getFooterLabel();
    const stepDef = STEP_DEFINITIONS[uiState.activeStepIndex];

    if (title) title.textContent = stepDef.title;
    if (subtitle) subtitle.textContent = stepDef.subtitle;
    if (footerLabel) footerLabel.textContent = stepDef.footerLabel;

    getJumpButtons().forEach((button) => {
      const stepIndex = Number(button.dataset.stepIndex || 0);
      const isCurrent = stepIndex === uiState.activeStepIndex;
      const isComplete = stepIndex < uiState.activeStepIndex;
      const isAccessible = true;

      button.classList.toggle('is-current', isCurrent);
      button.classList.toggle('is-complete', isComplete);
      button.disabled = !isAccessible;
      button.setAttribute('aria-current', isCurrent ? 'step' : 'false');
    });
  }

  function syncStepPanels() {
    getSteps().forEach((panel) => {
      const stepIndex = Number(panel.dataset.stepIndex || 0);
      panel.classList.toggle('is-active', stepIndex === uiState.activeStepIndex);
    });
  }

  function syncFooterActions() {
    const prevButton = getPrevButton();
    const nextButton = getNextButton();
    const runButton = getRunButton();
    const warningBox = getWarningBox();
    const lastStep = isLastStep();

    if (prevButton) {
      prevButton.disabled = uiState.activeStepIndex === 0;
      prevButton.classList.remove('is-hidden');
      prevButton.setAttribute('aria-disabled', prevButton.disabled ? 'true' : 'false');
    }

    if (nextButton) {
      nextButton.classList.toggle('is-hidden', lastStep);
      nextButton.setAttribute('aria-hidden', lastStep ? 'true' : 'false');
    }

    if (runButton) {
      runButton.classList.toggle('is-hidden', !lastStep);
      runButton.setAttribute('aria-hidden', lastStep ? 'false' : 'true');
    }

    if (warningBox) warningBox.classList.toggle('is-hidden', !lastStep);
  }

  function renderDndStepper() {
    if (!getRoot()) return;
    syncStepPanels();
    syncHeader();
    syncFooterActions();
  }

  function goToDndStep(stepIndex) {
    const nextStepIndex = clampStepIndex(stepIndex);

    uiState.maxVisitedStepIndex = Math.max(uiState.maxVisitedStepIndex, nextStepIndex);
    uiState.activeStepIndex = nextStepIndex;
    renderDndStepper();
  }

  function goToNextDndStep() {
    if (isLastStep()) return;

    const nextStepIndex = clampStepIndex(uiState.activeStepIndex + 1);
    uiState.maxVisitedStepIndex = Math.max(uiState.maxVisitedStepIndex, nextStepIndex);
    uiState.activeStepIndex = nextStepIndex;
    renderDndStepper();
  }

  function goToPreviousDndStep() {
    if (uiState.activeStepIndex === 0) return;

    uiState.activeStepIndex = clampStepIndex(uiState.activeStepIndex - 1);
    renderDndStepper();
  }

  function bindStepperEvents() {
    const root = getRoot();
    const prevButton = getPrevButton();
    const nextButton = getNextButton();

    if (!root || uiState.isInitialized) return;

    prevButton?.addEventListener('click', goToPreviousDndStep);
    nextButton?.addEventListener('click', goToNextDndStep);

    root.addEventListener('click', (event) => {
      const jumpButton = event.target.closest('[data-js="dnd-stepper-jump"]');
      if (!jumpButton) return;

      goToDndStep(Number(jumpButton.dataset.stepIndex || 0));
    });

    uiState.isInitialized = true;
  }

  function refreshDndStepper() {
    renderDndStepper();
  }

  function resetDndStepper() {
    uiState.activeStepIndex = 0;
    uiState.maxVisitedStepIndex = 0;
    renderDndStepper();
  }

  function initDndStepper() {
    if (!getRoot()) return;

    bindStepperEvents();
    renderDndStepper();
  }

  global.PipelineUIDndStepper = {
    STEP_DEFINITIONS,
    initDndStepper,
    refreshDndStepper,
    goToDndStep,
    goToNextDndStep,
    goToPreviousDndStep,
    resetDndStepper,
  };

  global.PipelineUI.dndStepper = global.PipelineUI.dndStepper || {};
  Object.assign(global.PipelineUI.dndStepper, global.PipelineUIDndStepper);
  Object.assign(global, global.PipelineUIDndStepper);
})(window);
