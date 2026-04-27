'use strict';

(function initPipelineUIDndStepper(global) {

// Stepper Tabletop / DnD.
// Le markup reste spécifique au mode, mais la mécanique est maintenant mutualisée
// via le core partagé pour limiter les divergences TT / Collection.
  global.PipelineUI = global.PipelineUI || {};

  const stepperData = global.PipelineUIDataStepperSteps || {};
  const STEP_DEFINITIONS = stepperData.STEPPER_STEP_DEFINITIONS?.tabletop || [];

  const createStepperController = global.PipelineUIStepperCore?.createStepperController;
  if (typeof createStepperController !== 'function') return;

  const controller = createStepperController({
    stepDefinitions: STEP_DEFINITIONS,
    getRoot: () => document.querySelector('[data-js="dnd-stepper"]'),
    getSteps: () => Array.from(document.querySelectorAll('[data-js="dnd-step"]')),
    getJumpButtons: () => Array.from(document.querySelectorAll('[data-js="dnd-stepper-jump"]')),
    getPrevButton: () => document.querySelector('[data-js="dnd-stepper-prev"]'),
    getNextButton: () => document.querySelector('[data-js="dnd-stepper-next"]'),
    getRunButton: () => document.querySelector('[data-js="dnd-stepper"] #runBtn-tt'),
    getWarningBox: () => document.getElementById('imgWarning-tt'),
    getFooterLabel: () => document.querySelector('[data-js="dnd-stepper-footer-label"]'),
    getTitle: () => document.querySelector('[data-js="dnd-stepper-title"]'),
    getSubtitle: () => document.querySelector('[data-js="dnd-stepper-subtitle"]'),
  });

  const {
    init: initDndStepper,
    refresh: refreshDndStepper,
    reset: resetDndStepper,
  } = controller;

  global.PipelineUIDndStepper = {
    initDndStepper,
    refreshDndStepper,
    resetDndStepper,
  };

  global.PipelineUI.dndStepper = global.PipelineUI.dndStepper || {};
  Object.assign(global.PipelineUI.dndStepper, global.PipelineUIDndStepper);
  Object.assign(global, global.PipelineUIDndStepper);
})(window);
