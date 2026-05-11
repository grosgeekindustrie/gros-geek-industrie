'use strict';

// Donnees declaratives des agents pipeline.

(function initPipelineUIDataAgents(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataAgents = global.PipelineUIDataAgents || {};

  const pipelineAgentsByMode = {
    tabletop: [
      { id:'titre', title:'01 - Maya · Titres SEO (x5)', usesImages:false, hasSelection:true, selectionType:'titre' },
      { id:'tags', title:'02 - Karim · Tags (x13)', usesImages:false, hasSelection:true, selectionType:'tags' },
      { id:'description', title:'03 - Claire · Description', usesImages:true, hasSelection:true, selectionType:'accroche_cta' },
      { id:'alt', title:'04 - Nadia · Balise ALT finale', usesImages:true, hasSelection:false },
    ],
    collection: [
      { id:'titre', title:'01 - Nova · Titres SEO (x5)', usesImages:false, hasSelection:true, selectionType:'titre' },
      { id:'tags', title:'02 - Axel · Tags (x13)', usesImages:false, hasSelection:true, selectionType:'tags' },
      { id:'description', title:'03 - Eden · Description', usesImages:true, hasSelection:true, selectionType:'accroche_cta' },
      { id:'alt', title:'04 - Jules · Balise ALT finale', usesImages:true, hasSelection:false },
    ],
  };

  const pipelineRuntimeAgentIds = {
    tabletop: ['titre', 'tags', 'description', 'alt'],
    collection: ['titre', 'tags', 'description', 'alt'],
  };

  const pipelineTargetSteps = {
    tabletop: [
      { id:'titre', label:'Maya · Titres SEO (x5)', stopAfterAgentId:'titre' },
      { id:'tags', label:'Karim · Tags (x13)', stopAfterAgentId:'tags' },
      { id:'description', label:'Claire · Description', stopAfterAgentId:'description' },
      { id:'alt', label:'Nadia · Balise ALT finale', stopAfterAgentId:'alt' },
    ],
    collection: [
      { id:'titre', label:'Nova · Titres SEO (x5)', stopAfterAgentId:'titre' },
      { id:'tags', label:'Axel · Tags (x13)', stopAfterAgentId:'tags' },
      { id:'description', label:'Eden · Description', stopAfterAgentId:'description' },
      { id:'alt', label:'Jules · Balise ALT finale', stopAfterAgentId:'alt' },
    ],
  };

  Object.assign(global.PipelineUIDataAgents, {
    PIPELINE_AGENTS_BY_MODE: pipelineAgentsByMode,
    PIPELINE_RUNTIME_AGENT_IDS: pipelineRuntimeAgentIds,
    PIPELINE_TARGET_STEPS: pipelineTargetSteps,
  });

  Object.assign(global.PipelineUIData, {
    agents: global.PipelineUIDataAgents,
  });
})(window);
