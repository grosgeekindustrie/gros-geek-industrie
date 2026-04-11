'use strict';

(function initPipelineUIDndStepper(global) {

// Stepper Tabletop / DnD.
// Le markup reste spécifique au mode, mais la mécanique est maintenant mutualisée
// via le core partagé pour limiter les divergences TT / Collection.
  global.PipelineUI = global.PipelineUI || {};

  const STEP_DEFINITIONS = [
    {
      title: 'Images',
      subtitle: "Ajoute les visuels qui serviront à l'analyse du pipeline.",
      footerLabel: 'Étape 1 sur 5 · Visuels de référence',
    },
    {
      title: 'Identité & archétypes',
      subtitle: 'Cadre la miniature, son univers, le sculpteur et les archétypes utiles aux agents.',
      footerLabel: 'Étape 2 sur 5 · Identité de la fiche',
    },
    {
      title: 'Échelles',
      subtitle: 'Renseigne les formats proposés et les dimensions de vente.',
      footerLabel: 'Étape 3 sur 5 · Offre produit',
    },
    {
      title: 'Paramètres & options',
      subtitle: 'Finalise la pose, le type produit, la version et les options avancées.',
      footerLabel: 'Étape 4 sur 5 · Réglages produit',
    },
    {
      title: 'Lancement',
      subtitle: "Lance le pipeline complet et suis l’état, le cache et le coût de la session.",
      footerLabel: 'Étape 5 sur 5 · Pilotage du pipeline',
    },
  ];

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
    goToStep: goToDndStep,
    goToNextStep: goToNextDndStep,
    goToPreviousStep: goToPreviousDndStep,
    reset: resetDndStepper,
  } = controller;

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
