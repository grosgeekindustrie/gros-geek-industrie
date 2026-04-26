'use strict';

(function initPipelineUITargetRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};

  function getPipelineLaunchMode(prefix) {
    if (typeof global.getPipelineModeByPrefix === 'function') {
      return global.getPipelineModeByPrefix(prefix);
    }

    return prefix === 'col' ? 'collection' : 'tabletop';
  }

  function getSafePipelineAgentsFallback() {
    if (typeof global.getPipelineAgents === 'function') {
      const agents = global.getPipelineAgents();
      return Array.isArray(agents) ? agents : [];
    }

    return [];
  }

  function getPipelineTargetStepsForPrefix(prefix) {
    const mode = getPipelineLaunchMode(prefix);

    if (typeof global.getPipelineTargetSteps === 'function') {
      return global.getPipelineTargetSteps(mode);
    }

    return getSafePipelineAgentsFallback().map((agent) => ({
      id: agent.id,
      label: agent.title,
    }));
  }

  function getPipelineTargetStepMetaForPrefix(prefix, stepId = '') {
    const mode = getPipelineLaunchMode(prefix);

    if (typeof global.getPipelineTargetStepMeta === 'function') {
      return global.getPipelineTargetStepMeta(mode, stepId);
    }

    return null;
  }

  function getPipelineRuntimeAgentIdsForPrefix(prefix, stepId = '') {
    const mode = getPipelineLaunchMode(prefix);
    const resolvedStepId = String(stepId || '').trim();

    if (typeof global.getPipelineRuntimeAgentIdsForTarget === 'function') {
      return global.getPipelineRuntimeAgentIdsForTarget(mode, resolvedStepId);
    }

    if (typeof global.getPipelineRuntimeAgentIds === 'function') {
      return global.getPipelineRuntimeAgentIds(mode);
    }

    return getSafePipelineAgentsFallback().map((agent) => agent.id);
  }

  function getPipelineRuntimeAgentsForTarget(prefix, stepId = '') {
    const runtimeAgentIds = getPipelineRuntimeAgentIdsForPrefix(prefix, stepId);
    const availableAgents = getSafePipelineAgentsFallback();
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
    getSafePipelineAgentsFallback,
    getPipelineTargetStepsForPrefix,
    getPipelineTargetStepMetaForPrefix,
    getPipelineRuntimeAgentIdsForPrefix,
    getPipelineRuntimeAgentsForTarget,
    getPipelineDisplayStepIdForRuntimeAgent,
  };

  global.PipelineUI.runtimeTarget = global.PipelineUI.runtimeTarget || {};
  Object.assign(global.PipelineUI.runtimeTarget, global.PipelineUITargetRuntime);
  Object.assign(global, global.PipelineUITargetRuntime);
})(window);
