'use strict';

(function initPipelineUITargetRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};

  function getPipelineLaunchMode(prefix) {
    return global.getPipelineModeByPrefix(prefix);
  }

  function getPipelineTargetStepsForPrefix(prefix) {
    return global.getPipelineTargetSteps(getPipelineLaunchMode(prefix));
  }

  function getPipelineTargetStepMetaForPrefix(prefix, stepId = '') {
    return global.getPipelineTargetStepMeta(getPipelineLaunchMode(prefix), stepId);
  }

  function getPipelineRuntimeAgentIdsForPrefix(prefix, stepId = '') {
    const resolvedStepId = String(stepId || '').trim();
    return global.getPipelineRuntimeAgentIdsForTarget(getPipelineLaunchMode(prefix), resolvedStepId);
  }

  function getPipelineRuntimeAgentsForTarget(prefix, stepId = '') {
    const runtimeAgentIds = getPipelineRuntimeAgentIdsForPrefix(prefix, stepId);
    const availableAgents = global.getPipelineAgentsForPrefix(prefix);
    const agentMap = new Map(availableAgents.map((agent) => [agent.id, agent]));

    return runtimeAgentIds.map((agentId) => agentMap.get(agentId)).filter(Boolean);
  }

  function getPipelineDisplayStepIdForRuntimeAgent(prefix, runtimeAgentId = '') {
    const targetSteps = getPipelineTargetStepsForPrefix(prefix);
    if (targetSteps.some((step) => step.id === runtimeAgentId)) return runtimeAgentId;

    const altTargetMeta = getPipelineTargetStepMetaForPrefix(prefix, 'alt');
    if (altTargetMeta?.stopAfterAgentId === runtimeAgentId) return altTargetMeta.id;

    return runtimeAgentId;
  }

  global.PipelineUITargetRuntime = {
    getPipelineLaunchMode,
    getPipelineTargetStepsForPrefix,
    getPipelineTargetStepMetaForPrefix,
    getPipelineRuntimeAgentsForTarget,
    getPipelineDisplayStepIdForRuntimeAgent,
  };

  global.PipelineUI.runtimeTarget = global.PipelineUI.runtimeTarget || {};
  Object.assign(global.PipelineUI.runtimeTarget, global.PipelineUITargetRuntime);
  Object.assign(global, global.PipelineUITargetRuntime);
})(window);
