'use strict';

// Définitions déclaratives des steppers par mode.

(function initPipelineUIDataStepperSteps(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataStepperSteps = global.PipelineUIDataStepperSteps || {};

  const stepperStepDefinitions = {
    tabletop: [
      {
        title: 'Images',
        subtitle: "Ajoute les visuels qui serviront à l'analyse du pipeline.",
        footerLabel: 'Étape 1 sur 6 · Visuels de référence',
      },
      {
        title: 'Identité',
        subtitle: 'Cadre la miniature, son univers, le sculpteur et les signaux produit de base.',
        footerLabel: 'Étape 2 sur 6 · Identité de la fiche',
      },
      {
        title: 'Échelles',
        subtitle: 'Renseigne les formats proposés et les dimensions de vente.',
        footerLabel: 'Étape 3 sur 6 · Offre produit',
      },
      {
        title: 'Détails & contexte',
        subtitle: 'Ajoute les détails produit, les archétypes et les signaux de contexte utiles aux agents.',
        footerLabel: 'Étape 4 sur 6 · Contexte métier',
      },
      {
        title: 'Pricing',
        subtitle: 'Calcule le coût, positionne chaque échelle aux États-Unis et prépare les montants Etsy.',
        footerLabel: 'Étape 5 sur 6 · Pricing France et USA',
      },
      {
        title: 'Lancement',
        subtitle: "Lance le pipeline complet et suis l’état, le cache et le coût de la session.",
        footerLabel: 'Étape 6 sur 6 · Pilotage du pipeline',
      },
    ],
    collection: [
      {
        title: 'Images',
        subtitle: "Ajoute les visuels qui serviront à l'analyse du pipeline.",
        footerLabel: 'Étape 1 sur 6 · Visuels de référence',
      },
      {
        title: 'Identité',
        subtitle: "Cadre le personnage, l'univers, le sculpteur et les signaux SEO de base.",
        footerLabel: 'Étape 2 sur 6 · Identité de la fiche',
      },
      {
        title: 'Échelles',
        subtitle: 'Choisis les formats proposés et renseigne les dimensions utiles.',
        footerLabel: 'Étape 3 sur 6 · Offre produit',
      },
      {
        title: 'Détails & contexte',
        subtitle: 'Ajoute les particularités, le contexte personnage et les signaux marché qui aident les agents.',
        footerLabel: 'Étape 4 sur 6 · Contexte métier',
      },
      {
        title: 'Pricing',
        subtitle: 'Calcule le coût, positionne chaque échelle aux États-Unis et prépare les montants Etsy.',
        footerLabel: 'Étape 5 sur 6 · Pricing France et USA',
      },
      {
        title: 'Lancement',
        subtitle: "Lance le pipeline complet et suis l’état, le cache et le coût de la session.",
        footerLabel: 'Étape 6 sur 6 · Pilotage du pipeline',
      },
    ],
  };

  Object.assign(global.PipelineUIDataStepperSteps, {
    STEPPER_STEP_DEFINITIONS: stepperStepDefinitions,
  });

  Object.assign(global.PipelineUIData, {
    stepperSteps: global.PipelineUIDataStepperSteps,
  });
})(window);
