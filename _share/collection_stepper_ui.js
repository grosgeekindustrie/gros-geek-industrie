'use strict';

(function initPipelineUICollectionStepper(global) {

// Stepper Collection.
// Cette couche réorganise le formulaire Collection en étapes lisibles sans renommer
// les champs déjà branchés au pipeline, à la persistance locale ou aux fetchs.
// V1 : pas de validation bloquante forte. Le parcours guide l'utilisateur mais ne
// remplace pas encore les règles métier futures (obligatoires, batch, imports, etc.).
  global.PipelineUI = global.PipelineUI || {};

  const STEP_DEFINITIONS = [
    {
      title: 'Images',
      subtitle: 'Ajoute les visuels qui serviront à l\'analyse du pipeline.',
      footerLabel: 'Étape 1 sur 4 · Visuels de référence',
    },
    {
      title: 'Identité',
      subtitle: 'Cadre le personnage, l\'univers, le sculpteur et les signaux SEO de base.',
      footerLabel: 'Étape 2 sur 4 · Identité de la fiche',
    },
    {
      title: 'Échelles',
      subtitle: 'Choisis les formats proposés et renseigne les dimensions utiles.',
      footerLabel: 'Étape 3 sur 4 · Offre produit',
    },
    {
      title: 'Détails & contexte',
      subtitle: 'Ajoute les particularités, le contexte personnage et les signaux marché qui aident les agents.',
      footerLabel: 'Étape 4 sur 4 · Prêt pour le pipeline',
    },
  ];

  const uiState = {
    activeStepIndex: 0,
    maxVisitedStepIndex: 0,
    isInitialized: false,
  };

  const getRoot = () => document.querySelector('[data-js="collection-stepper"]');
  const getSteps = () => Array.from(document.querySelectorAll('[data-js="collection-step"]'));
  const getJumpButtons = () => Array.from(document.querySelectorAll('[data-js="collection-stepper-jump"]'));
  const getPrevButton = () => document.querySelector('[data-js="collection-stepper-prev"]');
  const getNextButton = () => document.querySelector('[data-js="collection-stepper-next"]');
  const getRunButton = () => document.querySelector('[data-js="collection-stepper"] #runBtn-col');
  const getWarningBox = () => document.getElementById('imgWarning-col');
  const getFooterLabel = () => document.querySelector('[data-js="collection-stepper-footer-label"]');
  const getTitle = () => document.querySelector('[data-js="collection-stepper-title"]');
  const getSubtitle = () => document.querySelector('[data-js="collection-stepper-subtitle"]');

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
      const isAccessible = stepIndex <= uiState.maxVisitedStepIndex;

      button.classList.toggle('is-current', isCurrent);
      button.classList.toggle('is-complete', isComplete);
      button.disabled = !isAccessible && !isCurrent;
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

    if (prevButton) {
      prevButton.disabled = uiState.activeStepIndex === 0;
      prevButton.classList.toggle('is-hidden', uiState.activeStepIndex === 0);
    }

    if (nextButton) nextButton.classList.toggle('is-hidden', isLastStep());
    if (runButton) runButton.classList.toggle('is-hidden', !isLastStep());
    if (warningBox) warningBox.classList.toggle('is-hidden', !isLastStep());
  }

  function renderCollectionStepper() {
    if (!getRoot()) return;
    syncStepPanels();
    syncHeader();
    syncFooterActions();
  }

  function goToCollectionStep(stepIndex) {
    const nextStepIndex = clampStepIndex(stepIndex);

    if (nextStepIndex > uiState.maxVisitedStepIndex) return;

    uiState.activeStepIndex = nextStepIndex;
    renderCollectionStepper();
  }

  function goToNextCollectionStep() {
    if (isLastStep()) return;

    const nextStepIndex = clampStepIndex(uiState.activeStepIndex + 1);
    uiState.maxVisitedStepIndex = Math.max(uiState.maxVisitedStepIndex, nextStepIndex);
    uiState.activeStepIndex = nextStepIndex;
    renderCollectionStepper();
  }

  function goToPreviousCollectionStep() {
    if (uiState.activeStepIndex === 0) return;

    uiState.activeStepIndex = clampStepIndex(uiState.activeStepIndex - 1);
    renderCollectionStepper();
  }

  function bindStepperEvents() {
    const root = getRoot();
    const prevButton = getPrevButton();
    const nextButton = getNextButton();

    if (!root || uiState.isInitialized) return;

    prevButton?.addEventListener('click', goToPreviousCollectionStep);
    nextButton?.addEventListener('click', goToNextCollectionStep);

    root.addEventListener('click', (event) => {
      const jumpButton = event.target.closest('[data-js="collection-stepper-jump"]');
      if (!jumpButton) return;

      goToCollectionStep(Number(jumpButton.dataset.stepIndex || 0));
    });

    uiState.isInitialized = true;
  }

  function refreshCollectionStepper() {
    renderCollectionStepper();
  }

  function resetCollectionStepper() {
    uiState.activeStepIndex = 0;
    uiState.maxVisitedStepIndex = 0;
    renderCollectionStepper();
  }

  function initCollectionStepper() {
    if (!getRoot()) return;

    bindStepperEvents();
    renderCollectionStepper();
  }

  global.PipelineUICollectionStepper = {
    STEP_DEFINITIONS,
    initCollectionStepper,
    refreshCollectionStepper,
    goToCollectionStep,
    goToNextCollectionStep,
    goToPreviousCollectionStep,
    resetCollectionStepper,
  };

  global.PipelineUI.collectionStepper = global.PipelineUI.collectionStepper || {};
  Object.assign(global.PipelineUI.collectionStepper, global.PipelineUICollectionStepper);
  Object.assign(global, global.PipelineUICollectionStepper);
})(window);
