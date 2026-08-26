'use strict';

// Configuration statique du pipeline.
// Ce module consomme désormais les sources déclaratives de src/js/ui/data.

(function initPipelineUIConfig(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIConfig = global.PipelineUIConfig || {};
  const sharedConstants = global.PipelineUISharedConstants || {};
  const PIPELINE_MODES = sharedConstants.PIPELINE_MODES || {
    TABLETOP: 'tabletop',
    COLLECTION: 'collection',
  };
  const PIPELINE_PREFIXES = sharedConstants.PIPELINE_PREFIXES || {
    TABLETOP: 'tt',
    COLLECTION: 'col',
  };

  const modeData = global.PipelineUIDataModes;
  const agentsData = global.PipelineUIDataAgents;
  const promptMapsData = global.PipelineUIDataPromptMaps;
  const devData = global.PipelineUIDataDev;

  const pipelineModeUi = modeData.PIPELINE_MODE_UI;
  const pipelineDevConfig = devData.PIPELINE_DEV_CONFIG;
  const pipelineAgents = agentsData.PIPELINE_AGENTS_BY_MODE?.tabletop || [];
  const pipelineAgentsCollection = agentsData.PIPELINE_AGENTS_BY_MODE?.collection || [];
  const pipelineRuntimeAgentIds = agentsData.PIPELINE_RUNTIME_AGENT_IDS || {};
  const pipelineTargetSteps = agentsData.PIPELINE_TARGET_STEPS || {};
  const getPipelineAgentsForShopFromData = agentsData.getPipelineAgentsForShop
    || ((mode = global.currentMode) => ((String(mode || '').trim() === PIPELINE_MODES.COLLECTION ? pipelineAgentsCollection : pipelineAgents).map((agent) => ({ ...agent }))));
  const getPipelineTargetStepsForShopFromData = agentsData.getPipelineTargetStepsForShop
    || ((mode = global.currentMode) => ((pipelineTargetSteps[getPipelineModeKey(mode)] || []).map((step) => ({ ...step }))));

  const getPipelineModeKey = (mode = global.currentMode) => modeData.getPipelineModeKeyFromData(mode);
  const getPipelineModes = () => modeData.getPipelineModesFromData();
  const getPipelineUiConfig = (mode = global.currentMode) => modeData.getPipelineModeUiConfigFromData(mode);
  const getPipelinePrefix = (mode = global.currentMode) => modeData.getPipelineModePrefixFromData(mode);
  const getPipelineModeByPrefix = (prefix = PIPELINE_PREFIXES.TABLETOP) => modeData.getPipelineModeByPrefixFromData(prefix);
  const getPipelinePrefixes = () => getPipelineModes().map((mode) => getPipelinePrefix(mode));

  const getPipelineAgentsForMode = (mode = global.currentMode) => (
    getPipelineAgentsForShopFromData(getPipelineModeKey(mode))
  );

  const getPipelineAgents = () => getPipelineAgentsForMode(global.currentMode);
  const getPipelineAgentsForPrefix = (prefix = PIPELINE_PREFIXES.TABLETOP) => (
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
    getPipelineTargetStepsForShopFromData(getPipelineModeKey(mode)).map((step) => ({
      id: step.id,
      label: step.label,
    }))
  );

  const getPipelineTargetStepMeta = (mode = global.currentMode, stepId = '') => {
    const steps = getPipelineTargetStepsForShopFromData(getPipelineModeKey(mode));
    return steps.find((step) => step.id === stepId) || steps[steps.length - 1] || null;
  };

  const getPipelineFinalTargetStepId = (mode = global.currentMode) => {
    const steps = getPipelineTargetStepsForShopFromData(getPipelineModeKey(mode));
    return steps[steps.length - 1]?.id || '';
  };

  const getPipelineDevStopAfterStepId = (mode = global.currentMode) => {
    const modeKey = getPipelineModeKey(mode);
    return String(pipelineDevConfig.stopAfterByMode?.[modeKey] || '').trim();
  };

  const normalizePipelineTargetStepId = (mode = global.currentMode, stepId = '') => {
    const steps = getPipelineTargetStepsForShopFromData(getPipelineModeKey(mode));
    const finalStepId = steps[steps.length - 1]?.id || '';
    const requestedStepId = String(stepId || '').trim();
    const devStopAfterStepId = getPipelineDevStopAfterStepId(mode);
    const candidateStepId = requestedStepId || devStopAfterStepId || finalStepId;

    return steps.some((step) => step.id === candidateStepId) ? candidateStepId : finalStepId;
  };

  const getPipelineRuntimeAgentIdsForTarget = (mode = global.currentMode, stepId = '') => {
    const runtimeAgentIds = getPipelineRuntimeAgentIds(mode).slice();
    const steps = getPipelineTargetStepsForShopFromData(getPipelineModeKey(mode));
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

  const getPipelineRuntimeAgentsForPrefix = (prefix = PIPELINE_PREFIXES.TABLETOP, stepId = '') => (
    getPipelineRuntimeAgentsForMode(getPipelineModeByPrefix(prefix), stepId)
  );

  const getPipelineWarmupStepId = (mode = global.currentMode) => {
    const steps = getPipelineTargetStepsForShopFromData(getPipelineModeKey(mode));
    return steps[0]?.id || '';
  };

  const promptFileMap = promptMapsData.PROMPT_FILE_MAPS?.tabletop || {};
  const promptFileMapCollection = promptMapsData.PROMPT_FILE_MAPS?.collection || {};
  const resolvePromptFileMapFromData = promptMapsData.resolvePromptFileMap
    || ((mode = global.currentMode) => (String(mode || '').trim() === 'collection' ? promptFileMapCollection : promptFileMap));
  const resolvePromptFolderFromData = promptMapsData.resolvePromptFolder
    || ((mode = global.currentMode) => `prompts/${String(mode || '').trim() === 'collection' ? 'collection' : 'tabletop'}`);

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
    resolvePromptFileMap: resolvePromptFileMapFromData,
    resolvePromptFolder: resolvePromptFolderFromData,
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
    resolvePromptFileMap: resolvePromptFileMapFromData,
    resolvePromptFolder: resolvePromptFolderFromData,
    PROMPT_FILE_MAP: promptFileMap,
    PROMPT_FILE_MAP_COLLECTION: promptFileMapCollection,
  });
})(window);
