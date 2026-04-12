'use strict';

// Définitions déclaratives des steppers par mode.

window.PipelineUI = window.PipelineUI || {};
window.PipelineUIData = window.PipelineUIData || {};
window.PipelineUIDataStepperSteps = window.PipelineUIDataStepperSteps || {};

const STEPPER_STEP_DEFINITIONS = {
  tabletop: [
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
  ],
  collection: [
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
  ],
};

Object.assign(window.PipelineUIDataStepperSteps, {
  STEPPER_STEP_DEFINITIONS,
});

Object.assign(window.PipelineUIData, {
  stepperSteps: window.PipelineUIDataStepperSteps,
});
