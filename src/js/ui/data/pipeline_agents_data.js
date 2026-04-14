'use strict';

// Données déclaratives des agents pipeline.

(function initPipelineUIDataAgents(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataAgents = global.PipelineUIDataAgents || {};

  const pipelineAgentsByMode = {
    tabletop: [
      { id:'marche',      title:'📊 01 — Sophie · Analyse de marché',     usesImages:true,  hasSelection:false },
      { id:'titre',       title:'🏷️ 02 — Maya · Titres SEO (×10)',        usesImages:false, hasSelection:true,  selectionType:'titre' },
      { id:'tags',        title:'🔖 03 — Karim · Tags (×13)',             usesImages:false, hasSelection:false },
      { id:'description', title:'📝 04 — Claire · Description',           usesImages:true,  hasSelection:true,  selectionType:'accroche_cta' },
      { id:'alt',         title:'🖼️ 05 — Nadia · Balise ALT finale',     usesImages:true,  hasSelection:false },
    ],
    collection: [
      { id:'marche',      title:'📊 01 — Luna · Analyse de marché',       usesImages:true,  hasSelection:false },
      { id:'titre',       title:'🏷️ 02 — Nova · Titres SEO (×10)',       usesImages:false, hasSelection:true,  selectionType:'titre' },
      { id:'tags',        title:'🔖 03 — Axel · Tags (×13)',              usesImages:false, hasSelection:false },
      { id:'description', title:'📝 04 — Eden · Description',             usesImages:true,  hasSelection:true,  selectionType:'accroche_cta' },
      { id:'analyse',     title:'🖼️ 05 — Jules · Balise ALT finale',     usesImages:true,  hasSelection:false },
    ],
  };

  const pipelineRuntimeAgentIds = {
    tabletop: ['marche', 'titre', 'tags', 'description', 'alt'],
    collection: ['marche', 'titre', 'tags', 'description', 'analyse'],
  };

  const pipelineTargetSteps = {
    tabletop: [
      { id:'marche',      label:'Sophie · Analyse de marché', stopAfterAgentId:'marche' },
      { id:'titre',       label:'Maya · Titres SEO (×10)',    stopAfterAgentId:'titre' },
      { id:'tags',        label:'Karim · Tags (×13)',         stopAfterAgentId:'tags' },
      { id:'description', label:'Claire · Description',       stopAfterAgentId:'description' },
      { id:'alt',         label:'Nadia · Balise ALT finale',  stopAfterAgentId:'alt' },
    ],
    collection: [
      { id:'marche',      label:'Luna · Analyse de marché', stopAfterAgentId:'marche' },
      { id:'titre',       label:'Nova · Titres SEO (×10)',  stopAfterAgentId:'titre' },
      { id:'tags',        label:'Axel · Tags (×13)',        stopAfterAgentId:'tags' },
      { id:'description', label:'Eden · Description',       stopAfterAgentId:'description' },
      { id:'alt',         label:'Jules · Balise ALT finale', stopAfterAgentId:'analyse' },
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
