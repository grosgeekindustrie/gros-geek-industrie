'use strict';

// Mapping déclaratif des prompts disque.

window.PipelineUI = window.PipelineUI || {};
window.PipelineUIData = window.PipelineUIData || {};
window.PipelineUIDataPromptMaps = window.PipelineUIDataPromptMaps || {};

const PROMPT_FILE_MAPS = {
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

Object.assign(window.PipelineUIDataPromptMaps, {
  PROMPT_FILE_MAPS,
});

Object.assign(window.PipelineUIData, {
  promptMaps: window.PipelineUIDataPromptMaps,
});
