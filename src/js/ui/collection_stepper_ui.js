'use strict';

(function initPipelineUICollectionStepper(global) {

// Stepper Collection.
// Le markup reste spécifique au mode, mais la mécanique est maintenant mutualisée
// via le core partagé pour réduire les écarts de comportement avec Tabletop.
  global.PipelineUI = global.PipelineUI || {};

  const STEP_DEFINITIONS = [
    {
      title: 'Images',
      subtitle: "Ajoute les visuels qui serviront à l'analyse du pipeline.",
      footerLabel: 'Étape 1 sur 5 · Visuels de référence',
    },
    {
      title: 'Identité',
      subtitle: "Cadre le personnage, l'univers, le sculpteur et les signaux SEO de base.",
      footerLabel: 'Étape 2 sur 5 · Identité de la fiche',
    },
    {
      title: 'Échelles',
      subtitle: 'Choisis les formats proposés et renseigne les dimensions utiles.',
      footerLabel: 'Étape 3 sur 5 · Offre produit',
    },
    {
      title: 'Détails & contexte',
      subtitle: 'Ajoute les particularités, le contexte personnage et les signaux marché qui aident les agents.',
      footerLabel: 'Étape 4 sur 5 · Contexte métier',
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
    goToStep: goToCollectionStep,
    goToNextStep: goToNextCollectionStep,
    goToPreviousStep: goToPreviousCollectionStep,
    reset: resetCollectionStepper,
  } = controller;

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
