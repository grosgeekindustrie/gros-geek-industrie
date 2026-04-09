'use strict';

// Configuration statique du pipeline.
// Source de vérité pour les agents par mode, les étapes lançables et la résolution des
// prompts disque. La logique runtime doit rester minimale et déclarative ici.

(function initPipelineUIConfig(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIConfig = global.PipelineUIConfig || {};

  const TABLETOP_PIPELINE_AGENTS = [
    { id: 'analyse', title: '🔍 01 — Marcus · Analyse visuelle', usesImages: true, hasSelection: false },
    { id: 'alt', title: '🖼️ 02 — Nadia · Balise ALT', usesImages: false, hasSelection: false },
    { id: 'marche', title: '📊 03 — Sophie · Analyse de marché', usesImages: false, hasSelection: false },
    { id: 'tags', title: '🔖 04 — Karim · Tags (×13)', usesImages: false, hasSelection: false },
    { id: 'titre', title: '🏷️ 05 — Maya · Titres SEO (×10)', usesImages: false, hasSelection: true, selectionType: 'titre' },
    { id: 'description', title: '📝 06 — Claire · Description', usesImages: false, hasSelection: true, selectionType: 'accroche_cta' },
  ];

  const COLLECTION_PIPELINE_AGENTS = [
    { id: 'analyse', title: '🔍 01 — Jules · Analyse visuelle + ALT', usesImages: true, hasSelection: false },
    { id: 'marche', title: '📊 02 — Luna · Analyse de marché', usesImages: false, hasSelection: false },
    { id: 'tags', title: '🔖 03 — Axel · Tags (×13)', usesImages: false, hasSelection: false },
    { id: 'titre', title: '🏷️ 04 — Nova · Titres SEO (×10)', usesImages: false, hasSelection: true, selectionType: 'titre' },
    { id: 'description', title: '📝 05 — Eden · Description', usesImages: false, hasSelection: true, selectionType: 'accroche_cta' },
  ];

  const MODE_CONFIG = {
    tabletop: {
      prefix: 'tt',
      defaultTargetStepId: 'description',
      pipelineAgents: TABLETOP_PIPELINE_AGENTS,
    },
    collection: {
      prefix: 'col',
      defaultTargetStepId: 'description',
      pipelineAgents: COLLECTION_PIPELINE_AGENTS,
    },
  };

  const PROMPT_FILE_MAP = {
    analyse: 'marcus',
    alt: 'nadia',
    marche: 'sophie',
    tags: 'karim',
    titre: 'maya',
    description: 'claire',
    social: 'leo',
    camille: 'camille',
    orchestrateur: 'felix',
  };

  const PROMPT_FILE_MAP_COLLECTION = {
    analyse: 'jules',
    iris: 'iris',
    marche: 'luna',

    // tags visible dans l’UI + sélection finale = même prompt
    tags: 'axel-explore-tags',

    // prompts internes du trio tags
    tags_explore: 'axel-explore-tags',
    tags_filter: 'celine-filter-tags',
    tags_select: 'axel-select',

    titre: 'nova',
    description: 'eden',
    social: 'theo',
    camille: 'zoe',
    orchestrateur: 'rex',
  };

  const sanitizeMode = (mode = global.currentMode || 'tabletop') => (
    mode === 'collection' ? 'collection' : 'tabletop'
  );

  const getModeConfig = (mode) => MODE_CONFIG[sanitizeMode(mode)];
  const getPipelineAgents = (mode) => getModeConfig(mode).pipelineAgents;
  const getPipelineDefaultTargetStepId = (mode) => getModeConfig(mode).defaultTargetStepId;

  const getPipelineAgentById = (agentId, mode) => (
    getPipelineAgents(mode).find((agent) => agent.id === agentId) || null
  );

  const getPipelineTargetAgents = (targetStepId, mode) => {
    const pipelineAgents = getPipelineAgents(mode);
    const targetIndex = pipelineAgents.findIndex((agent) => agent.id === targetStepId);

    if (targetIndex === -1) return [...pipelineAgents];
    return pipelineAgents.slice(0, targetIndex + 1);
  };

  const getPipelineLaunchLabel = (title = '') => {
    const normalizedTitle = String(title || '')
      .replace(/^[^—]+—\s*/, '')
      .replace(/[🔍🖼️📊🔖🏷️📝]/gu, '')
      .trim();

    return normalizedTitle || title;
  };

  const getPipelineLaunchTargets = (mode) => getPipelineAgents(mode).map((agent) => ({
    ...agent,
    launchLabel: getPipelineLaunchLabel(agent.title),
  }));

  const getPipelineTargetLabel = (targetStepId, mode) => {
    const agent = getPipelineAgentById(targetStepId, mode);
    return agent ? getPipelineLaunchLabel(agent.title) : '';
  };

  Object.assign(global.PipelineUIConfig, {
    MODE_CONFIG,
    PIPELINE_AGENTS: TABLETOP_PIPELINE_AGENTS,
    PIPELINE_AGENTS_COLLECTION: COLLECTION_PIPELINE_AGENTS,
    getModeConfig,
    getPipelineAgents,
    getPipelineAgentById,
    getPipelineTargetAgents,
    getPipelineLaunchTargets,
    getPipelineTargetLabel,
    getPipelineDefaultTargetStepId,
    getPipelineLaunchLabel,
    PROMPT_FILE_MAP,
    PROMPT_FILE_MAP_COLLECTION,
  });
})(window);
