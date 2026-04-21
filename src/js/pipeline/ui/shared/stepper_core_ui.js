'use strict';

(function initPipelineUIStepperCore(global) {

// Core partagé des steppers solo.
// Mutualise la navigation, le header, le footer et le pilotage visuel sans toucher
// aux champs métier ni aux contrats DOM spécifiques à chaque mode.
  global.PipelineUI = global.PipelineUI || {};

  const createStepperController = (options = {}) => {
    const {
      stepDefinitions = [],
      getRoot = () => null,
      getSteps = () => [],
      getJumpButtons = () => [],
      getPrevButton = () => null,
      getNextButton = () => null,
      getRunButton = () => null,
      getWarningBox = () => null,
      getFooterLabel = () => null,
      getTitle = () => null,
      getSubtitle = () => null,
      onRender = null,
    } = options;

    const uiState = {
      activeStepIndex: 0,
      maxVisitedStepIndex: 0,
      isInitialized: false,
    };

    const getLastStepIndex = () => Math.max(stepDefinitions.length - 1, 0);
    const clampStepIndex = (index) => {
      const normalizedIndex = Number(index) || 0;
      return Math.min(Math.max(normalizedIndex, 0), getLastStepIndex());
    };

    const isLastStep = () => uiState.activeStepIndex >= getLastStepIndex();

    const syncHeader = () => {
      const title = getTitle();
      const subtitle = getSubtitle();
      const footerLabel = getFooterLabel();
      const stepDefinition = stepDefinitions[uiState.activeStepIndex] || stepDefinitions[0];

      if (!stepDefinition) return;

      if (title) title.textContent = stepDefinition.title;
      if (subtitle) subtitle.textContent = stepDefinition.subtitle;
      if (footerLabel) footerLabel.textContent = stepDefinition.footerLabel;

      getJumpButtons().forEach((button) => {
        const stepIndex = Number(button.dataset.stepIndex || 0);
        const isCurrent = stepIndex == uiState.activeStepIndex;
        const isComplete = stepIndex < uiState.activeStepIndex;

        button.classList.toggle('is-current', isCurrent);
        button.classList.toggle('is-complete', isComplete);
        button.disabled = false;
        button.setAttribute('aria-current', isCurrent ? 'step' : 'false');
      });
    };

    const syncStepPanels = () => {
      getSteps().forEach((panel) => {
        const stepIndex = Number(panel.dataset.stepIndex || 0);
        panel.classList.toggle('is-active', stepIndex == uiState.activeStepIndex);
      });
    };

    const syncFooterActions = () => {
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

      if (warningBox) {
        warningBox.classList.toggle('is-hidden', !lastStep);
      }
    };

    const render = () => {
      if (!getRoot()) return;

      syncStepPanels();
      syncHeader();
      syncFooterActions();
      global.refreshPipelineLaunchPanels?.();
      onRender?.({ ...uiState });
    };

    const goToStep = (stepIndex) => {
      const nextStepIndex = clampStepIndex(stepIndex);

      uiState.maxVisitedStepIndex = Math.max(uiState.maxVisitedStepIndex, nextStepIndex);
      uiState.activeStepIndex = nextStepIndex;
      render();
    };

    const goToNextStep = () => {
      if (isLastStep()) return;
      goToStep(uiState.activeStepIndex + 1);
    };

    const goToPreviousStep = () => {
      if (uiState.activeStepIndex === 0) return;
      goToStep(uiState.activeStepIndex - 1);
    };

    const bindEvents = () => {
      const root = getRoot();
      const prevButton = getPrevButton();
      const nextButton = getNextButton();

      if (!root || uiState.isInitialized) return;

      prevButton?.addEventListener('click', goToPreviousStep);
      nextButton?.addEventListener('click', goToNextStep);

      root.addEventListener('click', (event) => {
        const jumpButton = event.target.closest('[data-js$="stepper-jump"]');
        if (!jumpButton) return;

        goToStep(jumpButton.dataset.stepIndex);
      });

      uiState.isInitialized = true;
    };

    const refresh = () => {
      render();
    };

    const reset = () => {
      uiState.activeStepIndex = 0;
      uiState.maxVisitedStepIndex = 0;
      render();
    };

    const init = () => {
      if (!getRoot()) return;
      bindEvents();
      render();
    };

    return {
      stepDefinitions,
      init,
      refresh,
      reset,
      goToStep,
      goToNextStep,
      goToPreviousStep,
    };
  };

  global.PipelineUIStepperCore = {
    createStepperController,
  };

  global.PipelineUI.stepperCore = global.PipelineUI.stepperCore || {};
  Object.assign(global.PipelineUI.stepperCore, global.PipelineUIStepperCore);
})(window);
