'use strict';

(function initPipelineUICollectionStepper(global) {

// Stepper Collection.
// Le markup reste spécifique au mode, mais la mécanique est maintenant mutualisée
// via le core partagé pour réduire les écarts de comportement avec Tabletop.
  global.PipelineUI = global.PipelineUI || {};

  const stepperData = global.PipelineUIDataStepperSteps || {};
  const STEP_DEFINITIONS = stepperData.STEPPER_STEP_DEFINITIONS?.collection || [];

  const createStepperController = global.PipelineUIStepperCore?.createStepperController;
  if (typeof createStepperController !== 'function') return;

  const controller = createStepperController({
    stepDefinitions: STEP_DEFINITIONS,
    getRoot: () => document.querySelector('[data-js="collection-stepper"]'),
    getSteps: () => Array.from(document.querySelectorAll('[data-js="collection-step"]')),
    getJumpButtons: () => Array.from(document.querySelectorAll('[data-js="collection-stepper-jump"]')),
    getPrevButton: () => document.querySelector('[data-js="collection-stepper-prev"]'),
    getNextButton: () => document.querySelector('[data-js="collection-stepper-next"]'),
    getRunButton: () => document.querySelector('[data-js="collection-stepper"] #runBtn-col'),
    getWarningBox: () => document.getElementById('imgWarning-col'),
    getFooterLabel: () => document.querySelector('[data-js="collection-stepper-footer-label"]'),
    getTitle: () => document.querySelector('[data-js="collection-stepper-title"]'),
    getSubtitle: () => document.querySelector('[data-js="collection-stepper-subtitle"]'),
  });

  const {
    init: initCollectionStepper,
    refresh: refreshCollectionStepper,
    reset: resetCollectionStepper,
  } = controller;

  global.PipelineUICollectionStepper = {
    initCollectionStepper,
    refreshCollectionStepper,
    resetCollectionStepper,
  };

  global.PipelineUI.collectionStepper = global.PipelineUI.collectionStepper || {};
  Object.assign(global.PipelineUI.collectionStepper, global.PipelineUICollectionStepper);
  Object.assign(global, global.PipelineUICollectionStepper);
})(window);
