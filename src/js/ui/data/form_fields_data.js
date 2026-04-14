'use strict';

// Champs déclaratifs des formulaires.

(function initPipelineUIDataFormFields(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataFormFields = global.PipelineUIDataFormFields || {};

  const tabletopFormFields = [
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

  const collectionFormFields = [
    'col-fType',
    'col-fNomCourt',
    'col-fNom',
    'col-fUnivers',
    'col-fSculpteur',
    'col-fPieces',
    'col-fDescriptionFigurine',
    'col-fPose',
  ];

  Object.assign(global.PipelineUIDataFormFields, {
    TABLETOP_FORM_FIELDS: tabletopFormFields,
    COLLECTION_FORM_FIELDS: collectionFormFields,
  });

  Object.assign(global.PipelineUIData, {
    formFields: global.PipelineUIDataFormFields,
  });
})(window);
