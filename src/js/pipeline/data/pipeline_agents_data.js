'use strict';

// Donnees declaratives des agents pipeline.

(function initPipelineUIDataAgents(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataAgents = global.PipelineUIDataAgents || {};

  const getActiveShopKey = () => {
    try {
      const settings = JSON.parse(localStorage.getItem('pipeline.settings') || '{}');
      return String(settings.activeShop || '').trim() === 'doublex' ? 'doublex' : 'grosgeek';
    } catch (error) {
      return 'grosgeek';
    }
  };

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

  const DOUBLEX_AGENT_TITLE_OVERRIDES = Object.freeze({
    tabletop: Object.freeze({
      titre: '01 - Mario · Titres SEO (x5)',
      tags: '02 - Bowser · Tags (x13)',
      description: '03 - Peach · Description',
      alt: '04 - Luigi · Balise ALT finale',
    }),
    collection: Object.freeze({
      titre: '01 - Maelle · Titres SEO (x5)',
      tags: '02 - Verso · Tags (x13)',
      description: '03 - Renoir · Description',
      alt: '04 - Lune · Balise ALT finale',
    }),
  });

  const DOUBLEX_STEP_LABEL_OVERRIDES = Object.freeze({
    tabletop: Object.freeze({
      titre: 'Mario · Titres SEO (x5)',
      tags: 'Bowser · Tags (x13)',
      description: 'Peach · Description',
      alt: 'Luigi · Balise ALT finale',
    }),
    collection: Object.freeze({
      titre: 'Maelle · Titres SEO (x5)',
      tags: 'Verso · Tags (x13)',
      description: 'Renoir · Description',
      alt: 'Lune · Balise ALT finale',
    }),
  });

  const cloneAgentWithShopLabel = (mode = 'tabletop', agent = {}) => {
    const shopKey = getActiveShopKey();
    if (shopKey !== 'doublex') return { ...agent };
    const titleOverride = DOUBLEX_AGENT_TITLE_OVERRIDES[mode]?.[agent.id];
    return titleOverride ? { ...agent, title: titleOverride } : { ...agent };
  };

  const cloneStepWithShopLabel = (mode = 'tabletop', step = {}) => {
    const shopKey = getActiveShopKey();
    if (shopKey !== 'doublex') return { ...step };
    const labelOverride = DOUBLEX_STEP_LABEL_OVERRIDES[mode]?.[step.id];
    return labelOverride ? { ...step, label: labelOverride } : { ...step };
  };

  const getPipelineAgentsForShop = (mode = 'tabletop') => (
    (pipelineAgentsByMode[mode] || []).map((agent) => cloneAgentWithShopLabel(mode, agent))
  );

  const getPipelineTargetStepsForShop = (mode = 'tabletop') => (
    (pipelineTargetSteps[mode] || []).map((step) => cloneStepWithShopLabel(mode, step))
  );

  Object.assign(global.PipelineUIDataAgents, {
    PIPELINE_AGENTS_BY_MODE: pipelineAgentsByMode,
    PIPELINE_RUNTIME_AGENT_IDS: pipelineRuntimeAgentIds,
    PIPELINE_TARGET_STEPS: pipelineTargetSteps,
    getPipelineAgentsForShop,
    getPipelineTargetStepsForShop,
  });

  Object.assign(global.PipelineUIData, {
    agents: global.PipelineUIDataAgents,
  });
})(window);
