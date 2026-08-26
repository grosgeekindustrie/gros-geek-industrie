(function initPipelineUIAIRuntime(global) {
  'use strict';

  const executionSnapshots = new Map();
  const PIPELINE_TASKS = new Set(['title', 'tags', 'description', 'alt']);
  const PIPELINE_AGENT_IDS = new Set(['titre', 'tags', 'marche', 'description', 'alt', 'cache_aware']);

  const profiles = () => global.PipelineUIAIProfiles;

  const cloneProfile = (profile) => JSON.parse(JSON.stringify(profile));

  const getWorkspacePrefix = (promptData = {}) => {
    const explicitPrefix = String(promptData?.workspacePrefix || '').trim();
    if (explicitPrefix) return explicitPrefix;
    return typeof global.pfx === 'function' ? global.pfx() : 'tt';
  };

  const beginAIExecution = (prefix = getWorkspacePrefix()) => {
    const normalizedPrefix = String(prefix || 'tt').trim() || 'tt';
    const snapshot = profiles().snapshotActiveProfile();
    executionSnapshots.set(normalizedPrefix, snapshot);
    return cloneProfile(snapshot);
  };

  const getAIExecutionSnapshot = (prefix = getWorkspacePrefix()) => {
    const snapshot = executionSnapshots.get(String(prefix || 'tt').trim() || 'tt');
    return snapshot ? cloneProfile(snapshot) : null;
  };

  const resolveProfileForCall = (agentId, promptData = {}) => {
    if (promptData?.aiProfileSnapshot) return promptData.aiProfileSnapshot;

    const explicitTask = String(promptData?.aiTask || '').trim();
    const task = explicitTask || profiles().getTaskForAgent(agentId);
    const canUsePipelineSnapshot = PIPELINE_TASKS.has(task)
      || (PIPELINE_AGENT_IDS.has(String(agentId)) && !explicitTask);
    if (!canUsePipelineSnapshot) return profiles().getActiveProfile();

    return getAIExecutionSnapshot(getWorkspacePrefix(promptData)) || profiles().getActiveProfile();
  };

  const attachExecutionToUsage = (usage, execution) => ({
    ...(usage && typeof usage === 'object' ? usage : {}),
    ai_execution: { ...execution },
  });

  async function callAI(agentId, promptData, useImages, retries = 3) {
    const normalizedPromptData = promptData && typeof promptData === 'object'
      ? { ...promptData }
      : promptData;
    const profile = resolveProfileForCall(agentId, normalizedPromptData || {});
    const execution = profiles().resolveExecution(agentId, {
      profile,
      task: normalizedPromptData?.aiTask,
    });

    const requestPromptData = normalizedPromptData && typeof normalizedPromptData === 'object'
      ? {
          ...normalizedPromptData,
          overrideModel: execution.model,
          aiExecution: execution,
        }
      : {
          filled: String(normalizedPromptData || ''),
          overrideModel: execution.model,
          aiExecution: execution,
        };
    const adapter = execution.provider === 'openai' ? global.callOpenAI : global.callClaude;
    if (typeof adapter !== 'function') {
      throw new Error(`Fournisseur IA non pris en charge: ${execution.provider}`);
    }
    const response = await adapter(agentId, requestPromptData, useImages, retries);
    const normalizedResponse = response && typeof response === 'object' ? response : { text: String(response || '') };

    return {
      ...normalizedResponse,
      usage: attachExecutionToUsage(normalizedResponse.usage, execution),
      execution: { ...execution },
    };
  }

  const resolveActiveAgentModel = (agentId = '') => profiles().resolveExecution(agentId).model;

  const api = Object.freeze({
    beginAIExecution,
    getAIExecutionSnapshot,
    resolveActiveAgentModel,
    callAI,
  });

  global.PipelineUIAIRuntime = api;
  global.beginAIExecution = beginAIExecution;
  global.getAIExecutionSnapshot = getAIExecutionSnapshot;
  global.callAI = callAI;
})(window);
