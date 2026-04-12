'use strict';

// Configuration statique du pipeline.
// Ce module consomme désormais les sources déclaratives de src/js/ui/data.

window.PipelineUI = window.PipelineUI || {};
window.PipelineUIConfig = window.PipelineUIConfig || {};

const modeData = window.PipelineUIDataModes || {};
const agentsData = window.PipelineUIDataAgents || {};
const promptMapsData = window.PipelineUIDataPromptMaps || {};

const PIPELINE_MODE_UI = modeData.PIPELINE_MODE_UI || {};
const PIPELINE_AGENTS = agentsData.PIPELINE_AGENTS_BY_MODE?.tabletop || [];
const PIPELINE_AGENTS_COLLECTION = agentsData.PIPELINE_AGENTS_BY_MODE?.collection || [];
const PIPELINE_RUNTIME_AGENT_IDS = agentsData.PIPELINE_RUNTIME_AGENT_IDS || {};
const PIPELINE_TARGET_STEPS = agentsData.PIPELINE_TARGET_STEPS || {};

const getPipelineModeKey = (mode = currentMode) => (
  typeof modeData.getPipelineModeKeyFromData === 'function'
    ? modeData.getPipelineModeKeyFromData(mode)
    : (mode === 'collection' ? 'collection' : 'tabletop')
);
const getPipelineModes = () => (
  typeof modeData.getPipelineModesFromData === 'function'
    ? modeData.getPipelineModesFromData()
    : Object.keys(PIPELINE_MODE_UI)
);
const getPipelineUiConfig = (mode = currentMode) => (
  typeof modeData.getPipelineModeUiConfigFromData === 'function'
    ? modeData.getPipelineModeUiConfigFromData(mode)
    : PIPELINE_MODE_UI[getPipelineModeKey(mode)] || PIPELINE_MODE_UI.tabletop
);
const getPipelinePrefix = (mode = currentMode) => (
  typeof modeData.getPipelineModePrefixFromData === 'function'
    ? modeData.getPipelineModePrefixFromData(mode)
    : getPipelineUiConfig(mode).prefix
);
const getPipelineModeByPrefix = (prefix = 'tt') => (
  typeof modeData.getPipelineModeByPrefixFromData === 'function'
    ? modeData.getPipelineModeByPrefixFromData(prefix)
    : (getPipelineModes().find((mode) => getPipelineUiConfig(mode).prefix === prefix) || 'tabletop')
);
const getPipelinePrefixes = () => getPipelineModes().map((mode) => getPipelinePrefix(mode));

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

const getPipelineTargetStepMeta = (mode = currentMode, stepId = '') => {
  const steps = PIPELINE_TARGET_STEPS[getPipelineModeKey(mode)] || [];
  return steps.find((step) => step.id === stepId) || steps[steps.length - 1] || null;
};

const getPipelineFinalTargetStepId = (mode = currentMode) => {
  const steps = PIPELINE_TARGET_STEPS[getPipelineModeKey(mode)] || [];
  return steps[steps.length - 1]?.id || '';
};

const normalizePipelineTargetStepId = (mode = currentMode, _stepId = '') => (
  getPipelineFinalTargetStepId(mode)
);

const getPipelineRuntimeAgentIdsForTarget = (mode = currentMode, _stepId = '') => (
  getPipelineRuntimeAgentIds(mode).slice()
);

const getPipelineWarmupStepId = (mode = currentMode) => {
  const steps = PIPELINE_TARGET_STEPS[getPipelineModeKey(mode)] || [];
  return steps[0]?.id || '';
};

var PROMPT_FILE_MAP = promptMapsData.PROMPT_FILE_MAPS?.tabletop || {};
var PROMPT_FILE_MAP_COLLECTION = promptMapsData.PROMPT_FILE_MAPS?.collection || {};

Object.assign(window.PipelineUIConfig, {
  PIPELINE_AGENTS,
  PIPELINE_AGENTS_COLLECTION,
  PIPELINE_RUNTIME_AGENT_IDS,
  PIPELINE_TARGET_STEPS,
  PIPELINE_MODE_UI,
  getPipelineModeKey,
  getPipelineModes,
  getPipelineUiConfig,
  getPipelinePrefix,
  getPipelineModeByPrefix,
  getPipelinePrefixes,
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
