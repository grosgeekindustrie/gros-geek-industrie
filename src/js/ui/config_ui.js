'use strict';

// Configuration statique du pipeline.
// Source de vérité pour les agents par mode et pour la résolution des prompts disque.
// À garder déclaratif : pas de logique UI métier ici.

window.PipelineUI = window.PipelineUI || {};
window.PipelineUIConfig = window.PipelineUIConfig || {};

const PIPELINE_AGENTS = [
  { id:'marche',      title:'📊 01 — Sophie · Analyse de marché',     usesImages:false, hasSelection:false },
  { id:'titre',       title:'🏷️ 02 — Maya · Titres SEO (×10)',        usesImages:false, hasSelection:true,  selectionType:'titre' },
  { id:'tags',        title:'🔖 03 — Karim · Tags (×13)',             usesImages:false, hasSelection:false },
  { id:'description', title:'📝 04 — Claire · Description',           usesImages:false, hasSelection:true,  selectionType:'accroche_cta' },
  { id:'alt',         title:'🖼️ 05 — Nadia · Balise ALT finale',     usesImages:true,  hasSelection:false },
];

const PIPELINE_AGENTS_COLLECTION = [
  { id:'marche',      title:'📊 01 — Luna · Analyse de marché',       usesImages:false, hasSelection:false },
  { id:'titre',       title:'🏷️ 02 — Nova · Titres SEO (×10)',       usesImages:false, hasSelection:true,  selectionType:'titre' },
  { id:'tags',        title:'🔖 03 — Axel · Tags (×13)',              usesImages:false, hasSelection:false },
  { id:'description', title:'📝 04 — Eden · Description',            usesImages:false, hasSelection:true,  selectionType:'accroche_cta' },
  { id:'analyse',     title:'🖼️ 05 — Jules · Balise ALT finale',     usesImages:true,  hasSelection:false },
];

const PIPELINE_RUNTIME_AGENT_IDS = {
  tabletop: ['marche', 'titre', 'tags', 'description', 'alt'],
  collection: ['marche', 'titre', 'tags', 'description', 'analyse'],
};

const PIPELINE_TARGET_STEPS = {
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

const getPipelineModeKey = (mode = currentMode) => (mode === 'collection' ? 'collection' : 'tabletop');

const getPipelineAgentsForMode = (mode = currentMode) => (
  getPipelineModeKey(mode) === 'collection'
    ? PIPELINE_AGENTS_COLLECTION
    : PIPELINE_AGENTS
);

function getPipelineAgents() {
  return getPipelineAgentsForMode(currentMode);
}

const getPipelineLaunchLabel = (agent) => {
  const title = String(agent?.title || '');
  return title.replace(/^[^—]+—\s*/, '').trim() || String(agent?.id || '');
};

const getPipelineRuntimeAgentIds = (mode = currentMode) => (
  PIPELINE_RUNTIME_AGENT_IDS[getPipelineModeKey(mode)] || []
);

const getPipelineTargetSteps = (mode = currentMode) => (
  (PIPELINE_TARGET_STEPS[getPipelineModeKey(mode)] || []).map((step) => ({
    id: step.id,
    label: step.label,
  }))
);

const getPipelineTargetStepMeta = (mode = currentMode, targetStepId = '') => {
  const steps = PIPELINE_TARGET_STEPS[getPipelineModeKey(mode)] || [];
  return steps.find((step) => step.id === targetStepId) || steps[steps.length - 1] || null;
};

const getPipelineFinalTargetStepId = (mode = currentMode) => {
  const steps = PIPELINE_TARGET_STEPS[getPipelineModeKey(mode)] || [];
  return steps[steps.length - 1]?.id || '';
};

const normalizePipelineTargetStepId = (mode = currentMode, _targetStepId = '') => (
  getPipelineFinalTargetStepId(mode)
);

const getPipelineRuntimeAgentIdsForTarget = (mode = currentMode, _targetStepId = '') => (
  getPipelineRuntimeAgentIds(mode).slice()
);

const getPipelineWarmupStepId = (mode = currentMode) => {
  const steps = PIPELINE_TARGET_STEPS[getPipelineModeKey(mode)] || [];
  return steps[0]?.id || '';
};

var PROMPT_FILE_MAP = {
  analyse:'marcus', alt:'nadia', marche:'sophie', tags:'karim',
  titre:'maya', description:'claire', social:'leo', camille:'camille', orchestrateur:'felix',
};

var PROMPT_FILE_MAP_COLLECTION = {
  analyse:'jules',
  iris:'iris',
  marche:'luna',

  // tags visible dans l’UI + sélection finale = même prompt
  tags:'axel-explore-tags',

  // prompts internes du trio tags
  tags_explore:'axel-explore-tags',
  tags_filter:'celine-filter-tags',
  tags_select:'axel-select',

  titre:'nova',
  description:'eden',
  social:'theo',
  camille:'zoe',
  orchestrateur:'rex',
};

Object.assign(window.PipelineUIConfig, {
  PIPELINE_AGENTS,
  PIPELINE_AGENTS_COLLECTION,
  PIPELINE_RUNTIME_AGENT_IDS,
  PIPELINE_TARGET_STEPS,
  getPipelineModeKey,
  getPipelineAgents,
  getPipelineAgentsForMode,
  getPipelineLaunchLabel,
  getPipelineRuntimeAgentIds,
  getPipelineTargetSteps,
  getPipelineTargetStepMeta,
  getPipelineFinalTargetStepId,
  normalizePipelineTargetStepId,
  getPipelineRuntimeAgentIdsForTarget,
  getPipelineWarmupStepId,
  PROMPT_FILE_MAP,
  PROMPT_FILE_MAP_COLLECTION,
});
