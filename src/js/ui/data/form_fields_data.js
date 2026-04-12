'use strict';

// Champs déclaratifs des formulaires.

window.PipelineUI = window.PipelineUI || {};
window.PipelineUIData = window.PipelineUIData || {};
window.PipelineUIDataFormFields = window.PipelineUIDataFormFields || {};

const TABLETOP_FORM_FIELDS = [
  'tt-fNom',
  'tt-fNomCourt',
  'tt-fUnivers',
  'tt-fSculpteur',
  'tt-fPieces',
  'tt-fNotes',
  'tt-fPose',
  'tt-fType',
  'tt-fVersion',
  'tt-fArchPrincipal',
  'tt-fArchSeo',
];

const COLLECTION_FORM_FIELDS = [
  'col-fType',
  'col-fNomCourt',
  'col-fNom',
  'col-fUnivers',
  'col-fSculpteur',
  'col-fPieces',
  'col-fDescriptionFigurine',
  'col-fPose',
];

Object.assign(window.PipelineUIDataFormFields, {
  TABLETOP_FORM_FIELDS,
  COLLECTION_FORM_FIELDS,
});

Object.assign(window.PipelineUIData, {
  formFields: window.PipelineUIDataFormFields,
});
