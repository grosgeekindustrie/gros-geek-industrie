'use strict';

// Configuration statique du pipeline.
// Source de vérité pour les agents par mode et pour la résolution des prompts disque.
// À garder déclaratif : pas de logique UI métier ici.

window.PipelineUI = window.PipelineUI || {};
window.PipelineUIConfig = window.PipelineUIConfig || {};

var PIPELINE_AGENTS = [
  { id:'analyse',     title:'🔍 01 — Marcus · Analyse visuelle',    usesImages:true,  hasSelection:false },
  { id:'alt',         title:'🖼️ 02 — Nadia · Balise ALT',           usesImages:false, hasSelection:false },
  { id:'marche',      title:'📊 03 — Sophie · Analyse de marché',   usesImages:false, hasSelection:false },
  { id:'tags',        title:'🔖 04 — Karim · Tags (×13)',           usesImages:false, hasSelection:false },
  { id:'titre',       title:'🏷️ 05 — Maya · Titres SEO (×10)',      usesImages:false, hasSelection:true,  selectionType:'titre' },
  { id:'description', title:'📝 06 — Claire · Description',         usesImages:false, hasSelection:true,  selectionType:'accroche_cta' },
];

const PIPELINE_AGENTS_COLLECTION = [
  { id:'analyse',     title:'🔍 01 — Jules · Analyse visuelle + ALT', usesImages:true,  hasSelection:false },
  { id:'marche',      title:'📊 02 — Luna · Analyse de marché',       usesImages:false, hasSelection:false },
  { id:'tags',        title:'🔖 03 — Axel · Tags (×13)',              usesImages:false, hasSelection:false },
  { id:'titre',       title:'🏷️ 04 — Nova · Titres SEO (×10)',       usesImages:false, hasSelection:true,  selectionType:'titre' },
  { id:'description', title:'📝 05 — Eden · Description',            usesImages:false, hasSelection:true,  selectionType:'accroche_cta' },
];

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

const getPipelineTargetSteps = (mode = currentMode) => (
  getPipelineAgentsForMode(mode).map((agent) => ({
    id: agent.id,
    label: getPipelineLaunchLabel(agent),
  }))
);

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
  getPipelineModeKey,
  getPipelineAgents,
  getPipelineAgentsForMode,
  getPipelineLaunchLabel,
  getPipelineTargetSteps,
  PROMPT_FILE_MAP,
  PROMPT_FILE_MAP_COLLECTION,
});
