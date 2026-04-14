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
    },
    collection: {
      analyse:'jules',
      iris:'iris',
      marche:'luna',
      tags:'axel-explore-tags',
      tags_explore:'axel-explore-tags',
      tags_filter:'celine-filter-tags',
      tags_select:'axel-select',
      titre:'nova',
      description:'eden',
      social:'theo',
      camille:'zoe',
      orchestrateur:'rex',
    },
  };

  Object.assign(global.PipelineUIDataPromptMaps, {
    PROMPT_FILE_MAPS: promptFileMaps,
  });

  Object.assign(global.PipelineUIData, {
    promptMaps: global.PipelineUIDataPromptMaps,
  });
})(window);
