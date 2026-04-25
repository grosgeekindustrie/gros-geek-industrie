'use strict';

// Configuration statique du pipeline.
// Ce module consomme désormais les sources déclaratives de src/js/ui/data.

(function initPipelineUIConfig(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIConfig = global.PipelineUIConfig || {};

  const modeData = global.PipelineUIDataModes || {};
  const agentsData = global.PipelineUIDataAgents || {};
  const promptMapsData = global.PipelineUIDataPromptMaps || {};
  const devData = global.PipelineUIDataDev || {};

  const pipelineModeUi = modeData.PIPELINE_MODE_UI || {};
  const pipelineDevConfig = devData.PIPELINE_DEV_CONFIG || global.PIPELINE_DEV_CONFIG || {};
  const pipelineAgents = agentsData.PIPELINE_AGENTS_BY_MODE?.tabletop || [];
  const pipelineAgentsCollection = agentsData.PIPELINE_AGENTS_BY_MODE?.collection || [];
  const pipelineRuntimeAgentIds = agentsData.PIPELINE_RUNTIME_AGENT_IDS || {};
  const pipelineTargetSteps = agentsData.PIPELINE_TARGET_STEPS || {};

  const getPipelineModeKey = (mode = global.currentMode) => (
    typeof modeData.getPipelineModeKeyFromData === 'function'
      ? modeData.getPipelineModeKeyFromData(mode)
      : (mode === 'collection' ? 'collection' : 'tabletop')
  );
  const getPipelineModes = () => (
    typeof modeData.getPipelineModesFromData === 'function'
      ? modeData.getPipelineModesFromData()
      : Object.keys(pipelineModeUi)
  );
  const getPipelineUiConfig = (mode = global.currentMode) => (
    typeof modeData.getPipelineModeUiConfigFromData === 'function'
      ? modeData.getPipelineModeUiConfigFromData(mode)
      : pipelineModeUi[getPipelineModeKey(mode)] || pipelineModeUi.tabletop
  );
  const getPipelinePrefix = (mode = global.currentMode) => (
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

  const getPipelineAgentsForMode = (mode = global.currentMode) => (
    getPipelineModeKey(mode) === 'collection'
      ? pipelineAgentsCollection
      : pipelineAgents
  );

  const getPipelineAgents = () => getPipelineAgentsForMode(global.currentMode);
  const getPipelineAgentsForPrefix = (prefix = 'tt') => (
    getPipelineAgentsForMode(getPipelineModeByPrefix(prefix))
  );

  const getPipelineLaunchLabel = (agent) => {
    const title = String(agent?.title || '');
    return title.replace(/^[^—]+—\s*/, '').trim() || String(agent?.id || '');
  };

  const getPipelineRuntimeAgentIds = (mode = global.currentMode) => (
    pipelineRuntimeAgentIds[getPipelineModeKey(mode)] || []
  );

  const getPipelineTargetSteps = (mode = global.currentMode) => (
    (pipelineTargetSteps[getPipelineModeKey(mode)] || []).map((step) => ({
      id: step.id,
      label: step.label,
    }))
  );

  const getPipelineTargetStepMeta = (mode = global.currentMode, stepId = '') => {
    const steps = pipelineTargetSteps[getPipelineModeKey(mode)] || [];
    return steps.find((step) => step.id === stepId) || steps[steps.length - 1] || null;
  };

  const getPipelineFinalTargetStepId = (mode = global.currentMode) => {
    const steps = pipelineTargetSteps[getPipelineModeKey(mode)] || [];
    return steps[steps.length - 1]?.id || '';
  };

  const getPipelineDevStopAfterStepId = (mode = global.currentMode) => {
    const modeKey = getPipelineModeKey(mode);
    return String(pipelineDevConfig.stopAfterByMode?.[modeKey] || '').trim();
  };

  const normalizePipelineTargetStepId = (mode = global.currentMode, stepId = '') => {
    const steps = pipelineTargetSteps[getPipelineModeKey(mode)] || [];
    const finalStepId = steps[steps.length - 1]?.id || '';
    const requestedStepId = String(stepId || '').trim();
    const devStopAfterStepId = getPipelineDevStopAfterStepId(mode);
    const candidateStepId = requestedStepId || devStopAfterStepId || finalStepId;

    return steps.some((step) => step.id === candidateStepId) ? candidateStepId : finalStepId;
  };

  const getPipelineRuntimeAgentIdsForTarget = (mode = global.currentMode, stepId = '') => {
    const runtimeAgentIds = getPipelineRuntimeAgentIds(mode).slice();
    const steps = pipelineTargetSteps[getPipelineModeKey(mode)] || [];
    const resolvedStepId = normalizePipelineTargetStepId(mode, stepId);
    const targetStepMeta = steps.find((step) => step.id === resolvedStepId) || steps[steps.length - 1] || null;
    const stopAfterAgentId = String(targetStepMeta?.stopAfterAgentId || '').trim();
    const stopAfterAgentIndex = runtimeAgentIds.indexOf(stopAfterAgentId);

    return stopAfterAgentIndex === -1 ? runtimeAgentIds : runtimeAgentIds.slice(0, stopAfterAgentIndex + 1);
  };

  const getPipelineRuntimeAgentsForMode = (mode = global.currentMode, stepId = '') => {
    const runtimeAgentIds = getPipelineRuntimeAgentIdsForTarget(mode, stepId);
    const agentMap = new Map(getPipelineAgentsForMode(mode).map((agent) => [agent.id, agent]));
    return runtimeAgentIds.map((agentId) => agentMap.get(agentId)).filter(Boolean);
  };

  const getPipelineRuntimeAgentsForPrefix = (prefix = 'tt', stepId = '') => (
    getPipelineRuntimeAgentsForMode(getPipelineModeByPrefix(prefix), stepId)
  );

  const getPipelineWarmupStepId = (mode = global.currentMode) => {
    const steps = pipelineTargetSteps[getPipelineModeKey(mode)] || [];
    return steps[0]?.id || '';
  };

  const promptFileMap = promptMapsData.PROMPT_FILE_MAPS?.tabletop || {};
  const promptFileMapCollection = promptMapsData.PROMPT_FILE_MAPS?.collection || {};

  Object.assign(global.PipelineUIConfig, {
    PIPELINE_AGENTS: pipelineAgents,
    PIPELINE_AGENTS_COLLECTION: pipelineAgentsCollection,
    PIPELINE_RUNTIME_AGENT_IDS: pipelineRuntimeAgentIds,
    PIPELINE_TARGET_STEPS: pipelineTargetSteps,
    PIPELINE_MODE_UI: pipelineModeUi,
    getPipelineModeKey,
    getPipelineModes,
    getPipelineUiConfig,
    getPipelinePrefix,
    getPipelineModeByPrefix,
    getPipelinePrefixes,
    getPipelineAgents,
    getPipelineAgentsForMode,
    getPipelineAgentsForPrefix,
    getPipelineLaunchLabel,
    getPipelineRuntimeAgentIds,
    getPipelineRuntimeAgentsForMode,
    getPipelineRuntimeAgentsForPrefix,
    getPipelineTargetSteps,
    getPipelineTargetStepMeta,
    getPipelineFinalTargetStepId,
    getPipelineDevStopAfterStepId,
    normalizePipelineTargetStepId,
    getPipelineRuntimeAgentIdsForTarget,
    getPipelineWarmupStepId,
    PROMPT_FILE_MAP: promptFileMap,
    PROMPT_FILE_MAP_COLLECTION: promptFileMapCollection,
  });

  Object.assign(global, {
    getPipelineModeKey,
    getPipelineModes,
    getPipelineUiConfig,
    getPipelinePrefix,
    getPipelineModeByPrefix,
    getPipelinePrefixes,
    getPipelineAgents,
    getPipelineAgentsForMode,
    getPipelineAgentsForPrefix,
    getPipelineLaunchLabel,
    getPipelineRuntimeAgentIds,
    getPipelineRuntimeAgentsForMode,
    getPipelineRuntimeAgentsForPrefix,
    getPipelineTargetSteps,
    getPipelineTargetStepMeta,
    getPipelineFinalTargetStepId,
    getPipelineDevStopAfterStepId,
    normalizePipelineTargetStepId,
    getPipelineRuntimeAgentIdsForTarget,
    getPipelineWarmupStepId,
    PROMPT_FILE_MAP: promptFileMap,
    PROMPT_FILE_MAP_COLLECTION: promptFileMapCollection,
  });
})(window);
