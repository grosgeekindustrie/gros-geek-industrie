'use strict';

// Mapping déclaratif des prompts disque.

(function initPipelineUIDataPromptMaps(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataPromptMaps = global.PipelineUIDataPromptMaps || {};

  const promptFileMaps = {
    tabletop: {
      analyse:'marcus', alt:'nadia', marche:'sophie', tags:'karim',
      titre:'maya', description:'claire', social:'leo', camille:'camille', orchestrateur:'felix',
      alias_lookup:'alias_lookup', translate_listing:'translate_listing',
    },
    collection: {
      alt:'jules',
      iris:'iris',
      marche:'luna',
      tags:'tags',
      titre:'nova',
      description:'eden',
      social:'theo',
      camille:'zoe',
      orchestrateur:'rex',
      alias_lookup:'alias_lookup',
      translate_listing:'translate_listing',
    },
  };

  Object.assign(global.PipelineUIDataPromptMaps, {
    PROMPT_FILE_MAPS: promptFileMaps,
  });

  Object.assign(global.PipelineUIData, {
    promptMaps: global.PipelineUIDataPromptMaps,
  });
})(window);
