'use strict';

(function initPipelineUIAgentRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};

  const abortControllers = {};
  const AGENT_MODELS = {
    alt: 'claude-sonnet-4-20250514',
    marche: 'claude-sonnet-4-20250514',
    tags: 'claude-sonnet-4-20250514',
    titre: 'claude-sonnet-4-20250514',
    description: 'claude-sonnet-4-20250514',
    social: 'claude-sonnet-4-20250514',
    camille: 'claude-sonnet-4-20250514',
    iris: 'claude-sonnet-4-20250514',
    cache_aware: 'claude-sonnet-4-20250514',
  };

  const PIPELINE_STATUS_DONE = 'terminé';
  const PIPELINE_STATUS_ERROR = 'erreur';
  const PIPELINE_STATUS_SELECTION_REQUIRED = 'en pause · sélection requise';
  const PIPELINE_RUN_AUTO_ENTRY_DEFAULTS = Object.freeze({
    quality: 'brut',
    validation: 'non_valide',
    origin: 'auto',
  });

  function stopAgent(agentId) {
    if (abortControllers[agentId]) {
      abortControllers[agentId].abort();
      delete abortControllers[agentId];
    }
  }

  function getResumePipelineAgents(prefix) {
    return global.getPipelineRuntimeAgentsForPrefix(prefix);
  }

  function getDisplayStepIdForAgent(prefix, agentId) {
    return global.getPipelineDisplayStepIdForRuntimeAgent(prefix, agentId);
  }

  function setResumeLaunchState(prefix, agentId, nextState = {}) {
    const displayStepId = getDisplayStepIdForAgent(prefix, agentId);
    global.setPipelineLaunchState(prefix, {
      currentStepId: displayStepId,
      isRunning: true,
      lastStatus: `en cours · ${displayStepId}`,
      ...nextState,
    });
  }

  function finalizeResumeLaunchState(prefix, agentId, lastStatus) {
    const displayStepId = getDisplayStepIdForAgent(prefix, agentId);
    global.setPipelineLaunchState(prefix, {
      currentStepId: displayStepId,
      isRunning: false,
      lastStatus,
    });
  }

  function syncResumeResultTab(prefix, lastStatus) {
    if (lastStatus === PIPELINE_STATUS_DONE) {
      const hasResult = prefix === 'tt'
        ? global.isDndSoloResultAvailable?.()
        : global.isCollectionSoloResultAvailable?.();

      if (hasResult) {
        global.activateSoloTab?.(prefix, 'result', { force: true });
        return;
      }
    }

    global.activateSoloTab?.(prefix, 'pipeline', { force: true });
  }

  function getAgentCorrectionInputValue(prefix, agentId) {
    return document.getElementById(`${prefix}-cor-${agentId}`)?.value || '';
  }

  function setResumePipelineExecutionActive(isActive) {
    global.setPipelineExecutionActive?.(isActive);
  }

  function getContinuationAgentsAfterSelection(prefix, agentId) {
    const agents = getResumePipelineAgents(prefix);
    const currentIndex = agents.findIndex(({ id }) => id === agentId);
    return currentIndex === -1 ? [] : agents.slice(currentIndex + 1);
  }

  function finalizePipelineContinuation(prefix, agentId, lastStatus = PIPELINE_STATUS_DONE) {
    setResumePipelineExecutionActive(false);
    finalizeResumeLaunchState(prefix, agentId, lastStatus);
    global.assembleFinal();
    syncResumeResultTab(prefix, lastStatus);
  }

  function resolveAgentRunStatus(ok, agent) {
    if (!ok) return PIPELINE_STATUS_ERROR;
    if (agent?.hasSelection) return PIPELINE_STATUS_SELECTION_REQUIRED;
    return PIPELINE_STATUS_DONE;
  }

  async function runResumeAgentSequence(prefix, agents, {
    initialCorrectionByAgentId = {},
    stopBeforeOptional = false,
  } = {}) {
    let lastAgentId = '';
    let lastStatus = PIPELINE_STATUS_DONE;

    for (const agent of agents) {
      if (stopBeforeOptional && agent.optional) break;

      setResumeLaunchState(prefix, agent.id);
      const correction = Object.prototype.hasOwnProperty.call(initialCorrectionByAgentId, agent.id)
        ? initialCorrectionByAgentId[agent.id]
        : '';
      const ok = await runAgent(agent, correction);

      lastAgentId = agent.id;
      lastStatus = resolveAgentRunStatus(ok, agent);

      if (lastStatus !== PIPELINE_STATUS_DONE) break;
    }

    return { lastAgentId, lastStatus };
  }

  async function continuePipelineAfterSelection(agentId) {
    const prefix = global.pfx();
    const continuationAgents = getContinuationAgentsAfterSelection(prefix, agentId);

    if (!continuationAgents.length) {
      finalizePipelineContinuation(prefix, agentId, PIPELINE_STATUS_DONE);
      return;
    }

    let lastAgentId = agentId;
    let lastStatus = PIPELINE_STATUS_DONE;

    setResumePipelineExecutionActive(true);

    try {
      ({ lastAgentId, lastStatus } = await runResumeAgentSequence(prefix, continuationAgents));
    } catch (error) {
      lastStatus = PIPELINE_STATUS_ERROR;
      console.error('continuePipelineAfterSelection failed', error);
      global.showToast(`❌ Suite du pipeline: ${error.message}`, '#ff4757');
    } finally {
      finalizePipelineContinuation(prefix, lastAgentId, lastStatus);
    }
  }

  function normalizePipelineActionRequest(request = {}) {
    return {
      action: String(request.action || '').trim(),
      prefix: String(request.prefix || '').trim(),
      stepId: String(request.stepId || '').trim(),
      agentId: String(request.agentId || '').trim(),
    };
  }

  async function handlePipelineActionRequest(request = {}) {
    const { action, prefix, stepId, agentId } = normalizePipelineActionRequest(request);
    const activePrefix = prefix || global.pfx();
    const actionHandlers = {
      launch: () => (global.runPipelineWithCacheAware ? global.runPipelineWithCacheAware(activePrefix) : global.startPipeline(activePrefix)),
      'rerun-agent': () => rerunAgent(agentId, activePrefix),
      'rerun-suite': () => rerunSuite(agentId, activePrefix),
      'stop-agent': () => stopAgent(agentId, activePrefix),
      'validate-title': () => global.validateTitre(agentId),
      'validate-tags': () => global.validateTags(agentId),
      'validate-selection': () => global.validateAccrocheCTA(agentId),
    };
    const actionHandler = actionHandlers[action];

    if (!actionHandler) return;
    return actionHandler(stepId);
  }

  async function rerunAgent(agentId, prefix = global.pfx()) {
    const agents = getResumePipelineAgents(prefix);
    const agent = agents.find(({ id }) => id === agentId);
    if (!agent) return;

    const correction = getAgentCorrectionInputValue(prefix, agentId);
    setResumePipelineExecutionActive(true);
    setResumeLaunchState(prefix, agent.id);

    let lastStatus = PIPELINE_STATUS_DONE;

    try {
      const ok = await runAgent(agent, correction);
      lastStatus = resolveAgentRunStatus(ok, agent);
    } catch (error) {
      lastStatus = PIPELINE_STATUS_ERROR;
      console.error('rerunAgent failed', error);
      global.showToast(`❌ Relance agent: ${error.message}`, '#ff4757');
    } finally {
      setResumePipelineExecutionActive(false);
      finalizeResumeLaunchState(prefix, agent.id, lastStatus);
      global.assembleFinal();
      syncResumeResultTab(prefix, lastStatus);
    }
  }

  async function rerunSuite(agentId, prefix = global.pfx()) {
    const agents = getResumePipelineAgents(prefix);
    const index = agents.findIndex(({ id }) => id === agentId);
    if (index === -1) return;

    const correction = getAgentCorrectionInputValue(prefix, agentId);
    let lastAgentId = agents[index].id;
    let lastStatus = PIPELINE_STATUS_DONE;

    setResumePipelineExecutionActive(true);

    try {
      ({ lastAgentId, lastStatus } = await runResumeAgentSequence(prefix, agents.slice(index), {
        initialCorrectionByAgentId: { [agentId]: correction },
        stopBeforeOptional: true,
      }));
    } catch (error) {
      lastStatus = PIPELINE_STATUS_ERROR;
      console.error('rerunSuite failed', error);
      global.showToast(`❌ Suite agents: ${error.message}`, '#ff4757');
    } finally {
      setResumePipelineExecutionActive(false);
      finalizeResumeLaunchState(prefix, lastAgentId, lastStatus);
      global.assembleFinal();
      syncResumeResultTab(prefix, lastStatus);
    }
  }

  async function runAgent(agent, correction = '', isRetry = false) {
    const prefix = global.pfx();
    const refs = global.beginAgentExecution(prefix, agent, { isRetry });

    try {
      const ctx = global.buildCtx(agent.id, correction);
      const prompt = global.buildPrompt(agent.id, ctx);
      const rawFixed = prompt.fixedContent ? `── CACHE FIXE ──\n${prompt.fixedContent}\n\n── VARIABLE ──\n` : '';
      global.state.inputs[agent.id] = rawFixed + prompt.filled;

      const runtimePrompt = global.withPipelineCacheAwarePromptData(prefix, prompt, {
        source: isRetry ? 'rerun' : 'pipeline',
      });
      const response = await global.callClaude(agent.id, runtimePrompt, global.shouldUseImagesForAgent(agent));
      const result = response.text;
      const usage = response.usage || null;

      if (agent.selectionType === 'tags') {
        global.state.outputs.tags_raw = result;
        global.state.outputs.tags = '';
      } else {
        global.state.outputs[agent.id] = result;
      }

      if (!agent.hasSelection) {
        global.appendPipelineRunEntry(prefix, agent.id, result, {
          quality: PIPELINE_RUN_AUTO_ENTRY_DEFAULTS.quality,
          validation: PIPELINE_RUN_AUTO_ENTRY_DEFAULTS.validation,
          origin: PIPELINE_RUN_AUTO_ENTRY_DEFAULTS.origin,
          sourceAgentId: agent.id,
        });
      }

      global.finalizeAgentSuccess(prefix, agent, refs, result, usage, { isRetry });
      return true;
    } catch (error) {
      global.finalizeAgentError(prefix, agent, refs, error);
      return false;
    }
  }

  global.abortControllers = abortControllers;
  global.AGENT_MODELS = AGENT_MODELS;
  global.PipelineUIAgentRuntime = {
    abortControllers,
    AGENT_MODELS,
    PIPELINE_STATUS_DONE,
    PIPELINE_STATUS_ERROR,
    PIPELINE_STATUS_SELECTION_REQUIRED,
    stopAgent,
    getResumePipelineAgents,
    getDisplayStepIdForAgent,
    setResumeLaunchState,
    finalizeResumeLaunchState,
    syncResumeResultTab,
    getAgentCorrectionInputValue,
    setResumePipelineExecutionActive,
    getContinuationAgentsAfterSelection,
    finalizePipelineContinuation,
    resolveAgentRunStatus,
    runResumeAgentSequence,
    continuePipelineAfterSelection,
    normalizePipelineActionRequest,
    handlePipelineActionRequest,
    rerunAgent,
    rerunSuite,
    runAgent,
  };

  global.PipelineUI.runtimeAgent = global.PipelineUI.runtimeAgent || {};
  Object.assign(global.PipelineUI.runtimeAgent, global.PipelineUIAgentRuntime);
  Object.assign(global, global.PipelineUIAgentRuntime);
})(window);
