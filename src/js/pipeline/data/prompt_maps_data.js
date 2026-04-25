'use strict';

// Mapping déclaratif des prompts disque.

(function initPipelineUIDataPromptMaps(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataPromptMaps = global.PipelineUIDataPromptMaps || {};

  const promptFileMaps = {
    tabletop: {
      analyse:'marcus', alt:'nadia', marche:'sophie', tags:'karim',
      titre:'maya', description:'claire', social:'leo', camille:'camille', iris:'iris',
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
    },
  };

  Object.assign(global.PipelineUIDataPromptMaps, {
    PROMPT_FILE_MAPS: promptFileMaps,
  });

  Object.assign(global.PipelineUIData, {
    promptMaps: global.PipelineUIDataPromptMaps,
  });
})(window);
