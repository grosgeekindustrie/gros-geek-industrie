'use strict';

// Configuration locale de développement du pipeline.
// Objectif : permettre de stopper le pipeline après un agent précis sans patcher le moteur.
// Valeurs possibles : '', 'marche', 'titre', 'tags', 'description', 'alt', 'analyse'.
// Mettre '' pour laisser le pipeline aller jusqu'à sa cible finale normale.

(function initPipelineUIDevData(global) {
  global.PipelineUIDataDev = global.PipelineUIDataDev || {};

  const PIPELINE_DEV_CONFIG = {
    stopAfterByMode: {
      tabletop: 'marche',
      collection: 'marche',
    },

    // Pour les tests agent par agent, on coupe le pré-lancement cache-aware afin
    // d'éviter un appel supplémentaire avant l'agent travaillé.
    cacheAwarePrelaunch: false,

    promptBiblio: {
      includeObjectif: false,
      includePsycho: false,
      includeBiblioTitres: false,
      includeBiblioTags: false,
    },
  };

  Object.assign(global.PipelineUIDataDev, {
    PIPELINE_DEV_CONFIG,
  });

  Object.assign(global, {
    PIPELINE_DEV_CONFIG,
  });
})(window);
