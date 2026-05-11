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
    'tt-fType',
    'tt-fVersion',
    'tt-fPresentationVisuelle',
    'tt-fNatureSujet',
    'tt-fPieces',
    'tt-fPose',
    'tt-fArchetypes',
    'tt-fArchSeo',
    'tt-fParticularites',
    'tt-fResumePersonnage',
    'tt-fConnexesPrioritaires',
    'tt-fLienPerso',
    'tt-fDescriptionFigurine',
    'tt-fNotes',
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
    'col-fArchetypes',
    'col-fArchSeo',
  ];

  Object.assign(global.PipelineUIDataFormFields, {
    TABLETOP_FORM_FIELDS: tabletopFormFields,
    COLLECTION_FORM_FIELDS: collectionFormFields,
  });

  Object.assign(global.PipelineUIData, {
    formFields: global.PipelineUIDataFormFields,
  });
})(window);
