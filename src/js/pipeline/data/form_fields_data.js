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
    'tt-fConsignesExternes',
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

  const promptFlagByFieldId = Object.freeze({
    'tt-fNom': '[[NOM]]',
    'tt-fNomCourt': '[[NOM_COURT]]',
    'tt-fUnivers': '[[UNIVERS]]',
    'tt-fSculpteur': '[[SCULPTEUR]]',
    'tt-fType': '[[TYPE]]',
    'tt-fVersion': '[[VERSION]]',
    'tt-fPresentationVisuelle': '[[PRESENTATION_VISUELLE]]',
    'tt-fNatureSujet': '[[NATURE_SUJET]]',
    'tt-fGenreGroup': '[[GENRES_TRANSVERSES]]',
    'tt-fPieces': '[[PIECES]]',
    'tt-fPose': '[[POSE]]',
    'tt-fArchetypes': '[[ARCHETYPES]]',
    'tt-fArchSeo': '[[SEO_ELARGIES]]',
    'tt-fParticularites': '[[PARTICULARITES]]',
    'tt-fConsignesExternes': '[[CONSIGNES_EXTERNES]]',
    'tt-fResumePersonnage': '[[RESUME_PERSONNAGE]]',
    'tt-fConnexesPrioritaires': '[[CONNEXES_PRIORITAIRES]]',
    'tt-fLienPerso': '[[LIEN_PERSO]]',
    'tt-fDescriptionFigurine': '[[DESCRIPTION_FIGURINE]]',
    'tt-fNotes': '[[NOTES]]',
    'col-fType': '[[TYPE]]',
    'col-fNomCourt': '[[NOM_COURT]]',
    'col-fNom': '[[NOM]]',
    'col-fUnivers': '[[UNIVERS]]',
    'col-fSculpteur': '[[SCULPTEUR]]',
    'col-fMediumGroup': '[[MEDIUM]]',
    'col-fMediumSubcategoriesGroup': '[[MEDIUM_SUBCATEGORIES]]',
    'col-fGenreGroup': '[[GENRES_TRANSVERSES]]',
    'col-fPieces': '[[PIECES]]',
    'col-fDescriptionFigurine': '[[DESCRIPTION_FIGURINE]]',
    'col-fPose': '[[POSE]]',
    'col-fParticularites': '[[PARTICULARITES]]',
    'col-fConsignesExternes': '[[CONSIGNES_EXTERNES]]',
    'col-fResumePersonnage': '[[RESUME_PERSONNAGE]]',
    'col-fConnexesPrioritaires': '[[CONNEXES_PRIORITAIRES]]',
    'col-fArchetypes': '[[ARCHETYPES]]',
    'col-fArchSeo': '[[SEO_ELARGIES]]',
    'col-fLienPerso': '[[LIEN_PERSO]]',
    'col-fLicense': '[[LICENSE]]',
    'col-fBuzzCollection': '[[BUZZ_COLLECTION]]',
  });

  Object.assign(global.PipelineUIDataFormFields, {
    TABLETOP_FORM_FIELDS: tabletopFormFields,
    COLLECTION_FORM_FIELDS: collectionFormFields,
    PROMPT_FLAG_BY_FIELD_ID: promptFlagByFieldId,
  });

  Object.assign(global.PipelineUIData, {
    formFields: global.PipelineUIDataFormFields,
  });
})(window);
