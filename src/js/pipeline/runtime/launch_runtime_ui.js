'use strict';

(function initPipelineUILaunchRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};
  const sharedConstants = global.PipelineUISharedConstants || {};
  const runtimeFormats = global.PipelineUIRuntimeFormats || {};
  const PIPELINE_MODES = sharedConstants.PIPELINE_MODES || {
    TABLETOP: 'tabletop',
    COLLECTION: 'collection',
  };
  const PIPELINE_PREFIXES = sharedConstants.PIPELINE_PREFIXES || {
    TABLETOP: 'tt',
    COLLECTION: 'col',
  };
  const PIPELINE_TIMELINE_STATUS = sharedConstants.PIPELINE_TIMELINE_STATUS || {
    ACTIVE: 'active',
    DONE: 'done',
    ERROR: 'error',
  };
  const PIPELINE_RUN_STATUS = sharedConstants.PIPELINE_RUN_STATUS || {
    RUNNING: 'en cours',
    DONE: 'termine',
    ERROR: 'erreur',
    SELECTION_REQUIRED: 'en pause · selection requise',
  };
  const PIPELINE_AGENT_STATUS_TEXT = sharedConstants.PIPELINE_AGENT_STATUS_TEXT || {
    WAITING: 'en attente',
    GENERATING: 'generation...',
    SELECTION_REQUIRED: 'selection requise',
    DONE: 'done',
    STOPPED: 'stoppe',
    ERROR: 'erreur',
    EMPTY_OUTPUT: 'pas encore genere',
  };
  const PIPELINE_STATUS_DONE = 'terminÃ©';
  const PIPELINE_STATUS_ERROR = 'erreur';
  const PIPELINE_STATUS_SELECTION_REQUIRED = 'en pause Â· sÃ©lection requise';
  const PIPELINE_STATUS_RUNNING = 'en cours';
  const PIPELINE_RUN_ENTRY_DEFAULTS = runtimeFormats.PIPELINE_RUN_ENTRY_DEFAULTS || Object.freeze({
    quality: 'net',
    validation: 'valide',
    origin: 'manuel',
  });
  const CACHE_AWARE_PRELAUNCH_LABEL = 'cache-aware pré-pipeline';
  const CACHE_AWARE_PRELAUNCH_SCOPE = `${CACHE_AWARE_PRELAUNCH_LABEL} + pipeline complet`;
  const CACHE_AWARE_SKIPPED_STATUS = 'cache-aware saute';
  const CACHE_AWARE_DIRECT_FALLBACK_STATUS = 'cache-aware indisponible';

  function refreshSoloTabs(prefix) {
    const mode = global.getPipelineModeByPrefix(prefix);
    const refreshMethodName = global.getPipelineUiConfig(mode).tabs.refreshMethod;
    global[refreshMethodName]();
  }

  function activateSoloTab(prefix, tabId, options = {}) {
    const mode = global.getPipelineModeByPrefix(prefix);
    const activateMethodName = global.getPipelineUiConfig(mode).tabs.activateMethod;
    global[activateMethodName](tabId, options);
  }

  function getPipelineAgentDomRefs(prefix, agentId) {
    return {
      card: document.getElementById(`${prefix}-card-${agentId}`),
      stat: document.getElementById(`${prefix}-stat-${agentId}`),
      out: document.getElementById(`${prefix}-out-${agentId}`),
      stopBtn: document.getElementById(`${prefix}-bstop-${agentId}`),
      rerunBtn: document.getElementById(`${prefix}-br-${agentId}`),
      saveBtn: document.getElementById(`${prefix}-bs-${agentId}`),
      promptBtn: document.getElementById(`${prefix}-bp-${agentId}`),
    };
  }

  function clearAgentSelectionUi(prefix, agent) {
    if (!agent?.hasSelection) return;

    global.state.selectedAccroche = null;
    global.state.selectedCTA = null;
    global.state.selectedTitre = null;
    global.state.selectedTags = [];

    [`${prefix}-sel-${agent.id}`, `${prefix}-sel-accroche-${agent.id}`, `${prefix}-sel-cta-${agent.id}`].forEach((id) => {
      const container = document.getElementById(id);
      if (!container) return;

      container.classList.remove('visible');
      if (agent.selectionType === 'tags' && id === `${prefix}-sel-${agent.id}`) {
        container.style.display = 'none';
        const runtimeRoot = document.getElementById(`${prefix}-sel-tags-runtime`);
        if (runtimeRoot) runtimeRoot.innerHTML = '';
        const validateBtn = document.getElementById(`${prefix}-validate-tags`);
        if (validateBtn) validateBtn.disabled = true;
        return;
      }

      const contentRoot = container.querySelector('[id]');
      if (contentRoot) contentRoot.innerHTML = '';
    });
  }

  function setAgentHeaderContext(agent) {
    const ctxEl = document.getElementById('headerContext');
    if (!ctxEl || !agent?.title) return;

    ctxEl.textContent = agent.title.trim();
  }

  function beginAgentExecution(prefix, agent, { isRetry = false } = {}) {
    const refs = getPipelineAgentDomRefs(prefix, agent.id);

    if (refs.card) refs.card.className = 'agent-card active';
    global.updatePipelineTimeline(agent.id, PIPELINE_TIMELINE_STATUS.ACTIVE);
    refreshSoloTabs(prefix);
    if (refs.stat) {
      refs.stat.className = 'agent-status s-run';
      refs.stat.textContent = 'generation...';
    }

    setAgentHeaderContext(agent);

    if (refs.out) {
      refs.out.className = 'output-box';
      refs.out.textContent = '';
    }

    if (refs.stopBtn) refs.stopBtn.style.display = 'inline-flex';
    if (!['alt', 'marche'].includes(agent.id)) global.openCard(`${prefix}-${agent.id}`);
    if (!isRetry) clearAgentSelectionUi(prefix, agent);

    return refs;
  }

  function enableAgentRuntimeActions(refs = {}, agent) {
    if (refs.rerunBtn) refs.rerunBtn.disabled = false;
    if (refs.saveBtn) refs.saveBtn.disabled = false;
    if (refs.promptBtn) refs.promptBtn.disabled = false;

    if (agent?.id === 'tags') {
      const exploreBtn = document.getElementById(`${global.pfx()}-bexplore-tags`);
      if (exploreBtn) exploreBtn.disabled = false;
    }

    if (agent?.id === 'titre') {
      const exploreBtn = document.getElementById(`${global.pfx()}-bexplore-titre`);
      if (exploreBtn) exploreBtn.disabled = false;
    }
  }

  function renderAgentSelectionUi(agent, result) {
    if (!agent?.hasSelection) return false;

    if (agent.selectionType === 'titre') global.buildTitreSelectionUI(agent.id, result);
    else if (agent.selectionType === 'tags') global.buildTagsUI(result);
    else global.buildAccrocheCTASelectionUI(agent.id, result);
    return true;
  }

  function finalizeAgentSuccess(prefix, agent, refs, result, usage, { isRetry = false } = {}) {
    if (refs.out) refs.out.textContent = result;
    global.showAgentCost(agent.id, usage, { prefix, source: isRetry ? 'rerun' : 'pipeline' });
    global.syncCacheIndicator(usage);
    if (refs.card) refs.card.className = 'agent-card done';
    global.updatePipelineTimeline(agent.id, PIPELINE_TIMELINE_STATUS.DONE);

    if (renderAgentSelectionUi(agent, result)) {
      if (refs.stat) {
        refs.stat.className = 'agent-status s-run';
        refs.stat.textContent = 'selection requise';
      }
    } else if (refs.stat) {
      refs.stat.className = 'agent-status s-done';
      refs.stat.textContent = 'done';
    }

    enableAgentRuntimeActions(refs, agent);
    if (refs.stopBtn) refs.stopBtn.style.display = 'none';
    refreshSoloTabs(prefix);
  }

  function finalizeAgentError(prefix, agent, refs, error) {
    if (refs.out) refs.out.textContent = `Erreur: ${error.message}`;
    if (refs.card) refs.card.className = 'agent-card error';
    global.updatePipelineTimeline(agent.id, PIPELINE_TIMELINE_STATUS.ERROR);
    if (refs.stat) {
      refs.stat.className = 'agent-status s-err';
      refs.stat.textContent = error.message.includes('stoppée') ? 'stoppe' : 'erreur';
    }
    if (refs.rerunBtn) refs.rerunBtn.disabled = false;
    if (refs.stopBtn) refs.stopBtn.style.display = 'none';
    refreshSoloTabs(prefix);
  }

  function resetPipelineAgentCard(prefix, agentId, runtimeAgentIds) {
    global.state.outputs[agentId] = '';
    const refs = getPipelineAgentDomRefs(prefix, agentId);

    if (refs.card) {
      refs.card.className = 'agent-card';
      refs.card.style.display = runtimeAgentIds.has(agentId) ? '' : 'none';
    }

    if (refs.stat) {
      refs.stat.className = 'agent-status s-wait';
      refs.stat.textContent = PIPELINE_AGENT_STATUS_TEXT.WAITING;
    }

    if (refs.out) {
      refs.out.className = 'output-box empty';
      refs.out.textContent = '— pas encore généré —';
    }

    if (refs.rerunBtn) refs.rerunBtn.disabled = true;
    if (refs.saveBtn) refs.saveBtn.disabled = true;
    if (refs.promptBtn) refs.promptBtn.disabled = true;

    global.clearAgentFilesApiVisualState(prefix, agentId);
  }

  function finalizePipelineExecution(prefix, {
    hasError = false,
    isSelectionPause = false,
    lastCompletedAgentId = '',
    finalAgentId = '',
    button = null,
    isSoloTabsFlow = false,
  } = {}) {
    global.assembleFinal();

    if (button) {
      button.disabled = false;
      global.PipelineUIIcons?.setIconLabel?.(button, 'play', global.PIPELINE_LAUNCH_LABEL);
    }

    global.setPipelineExecutionActive(false);

    const finalStatus = hasError
      ? 'erreur'
      : isSelectionPause
        ? 'en pause · sélection requise'
        : 'terminé';

    setPipelineLaunchState(prefix, {
      currentStepId: global.getPipelineDisplayStepIdForRuntimeAgent(prefix, lastCompletedAgentId || finalAgentId),
      isRunning: false,
      lastStatus: finalStatus,
    });
    global.finalizeCacheDebugRun(prefix, finalStatus);

    if (isSoloTabsFlow) {
      refreshSoloTabs(prefix);
      const hasResult = prefix === PIPELINE_PREFIXES.TABLETOP
        ? global.isDndSoloResultAvailable()
        : global.isCollectionSoloResultAvailable();
      if (hasResult) {
        activateSoloTab(prefix, 'result', { force: true });
      } else {
        activateSoloTab(prefix, 'pipeline', { force: true });
      }
    }

    return finalStatus;
  }

  function renderPipelineLaunchPanel(prefix) {
    const statusNode = document.getElementById(`launchStatus-${prefix}`);

    if (!statusNode) return;

    statusNode.textContent = global.getPipelineLaunchSummary(prefix);
    global.syncStandaloneLaunchButtons(prefix);
  }

  function refreshPipelineLaunchPanelState(prefix) {
    renderPipelineLaunchPanel(prefix);
  }

  function refreshPipelineLaunchPanels() {
    const prefixes = global.getPipelinePrefixesForLaunchPanels();
    prefixes.forEach((prefix) => renderPipelineLaunchPanel(prefix));
  }

  function setPipelineLaunchState(prefix, nextState = {}) {
    const launchState = global.getPipelineLaunchState(prefix);
    Object.assign(launchState, nextState);
    refreshPipelineLaunchPanelState(prefix);
  }

  function buildPipelineFormSnapshot(prefix) {
    const relaunchSnapshot = global.buildListingRelaunchFormSnapshot?.(prefix);
    if (relaunchSnapshot) return relaunchSnapshot;

    const mode = global.getPipelineLaunchMode(prefix);
    const echelles = global.PipelineUIEchelles.getEchellesSelected();
    const dimensions = global.PipelineUIEchelles.getDimsFromEchelles();
    const collectionData = mode === PIPELINE_MODES.COLLECTION
      ? global.getCollectionData()
      : {};
    const lines = [];
    const pushSnapshotLine = (label, value) => {
      const normalizedValue = String(value || '').trim();
      if (!normalizedValue) return;
      lines.push(`${label}: ${normalizedValue}`);
    };

    pushSnapshotLine('Mode', mode);
    pushSnapshotLine('Nom', document.getElementById(`${prefix}-fNom`)?.value);
    pushSnapshotLine('Nom court', document.getElementById(`${prefix}-fNomCourt`)?.value);
    pushSnapshotLine('Univers', document.getElementById(`${prefix}-fUnivers`)?.value);
    pushSnapshotLine('Sculpteur', document.getElementById(`${prefix}-fSculpteur`)?.value);
    pushSnapshotLine('Échelles', echelles);
    pushSnapshotLine('Dimensions', dimensions);
    pushSnapshotLine('Pièces', document.getElementById(`${prefix}-fPieces`)?.value);
    pushSnapshotLine('Pose', document.getElementById(`${prefix}-fPose`)?.value);

    if (mode === PIPELINE_MODES.TABLETOP) {
      pushSnapshotLine('Type', document.getElementById('tt-fType')?.value);
      pushSnapshotLine('Version', document.getElementById('tt-fVersion')?.value);
      pushSnapshotLine('Archétypes', global.getArchetypes());
      pushSnapshotLine('SEO élargies', document.getElementById('tt-fArchSeo')?.value);
      pushSnapshotLine('Particularités', document.getElementById('tt-fParticularites')?.value);
      pushSnapshotLine('Consignes externes', document.getElementById('tt-fConsignesExternes')?.value);
      pushSnapshotLine('Notes', document.getElementById('tt-fNotes')?.value);
    } else {
      pushSnapshotLine('Medium', collectionData.medium || global.getMediums());
      pushSnapshotLine('Sous-catégories medium', collectionData.mediumSubcategories || collectionData.medium_subcategories || '');
      pushSnapshotLine('Genres transverses', collectionData.genresTransverses || collectionData.genres_transverses || collectionData.genres || '');
      pushSnapshotLine('Contexte medium', collectionData.mediumContext || collectionData.medium_context || '');
      pushSnapshotLine('Archétypes', global.getArchetypes());
      pushSnapshotLine('SEO élargies', document.getElementById('col-fArchSeo')?.value);
      pushSnapshotLine('License sensible', document.getElementById('col-fLicense')?.checked ? 'oui' : 'non');
      pushSnapshotLine('Particularités', document.getElementById('col-fParticularites')?.value);
      pushSnapshotLine('Consignes externes', document.getElementById('col-fConsignesExternes')?.value);
      pushSnapshotLine('Description figurine', document.getElementById('col-fDescriptionFigurine')?.value);
      pushSnapshotLine('Résumé personnage', document.getElementById('col-fResumePersonnage')?.value);
      pushSnapshotLine('Connexes prioritaires', document.getElementById('col-fConnexesPrioritaires')?.value);
      pushSnapshotLine('Lien perso', document.getElementById('col-fLienPerso')?.value);
    }

    return lines.join('\n');
  }

  function getPipelineRunState(prefix) {
    global.state.pipelineRun = global.state.pipelineRun || {};
    global.state.pipelineRun[prefix] = global.state.pipelineRun[prefix] || (
      runtimeFormats.createPipelineRunState
        ? runtimeFormats.createPipelineRunState()
        : {
          formSnapshot: '',
          warmupHint: '',
          lastCacheAwareSignature: '',
          cumulativeEntries: [],
          cumulativeText: '',
        }
    );
    return global.state.pipelineRun[prefix];
  }

  function resetPipelineRunState(prefix) {
    const runState = getPipelineRunState(prefix);
    const warmupStepId = global.getPipelineWarmupStepId(global.getPipelineLaunchMode(prefix));
    const formSnapshot = buildPipelineFormSnapshot(prefix);

    runState.formSnapshot = formSnapshot;
    runState.warmupHint = `Warmup stable avant ${warmupStepId}`;
    runState.cumulativeEntries = [];
    runState.cumulativeText = '';

    return runState;
  }

  function refreshPipelineRunCumulativeText(runState) {
    runState.cumulativeText = runState.cumulativeEntries
      .map((entry) => `## ${entry.agentId}\n${entry.content}`)
      .join('\n\n');
  }

  function appendPipelineRunEntry(prefix, agentId, content, meta = {}) {
    const trimmed = String(content || '').trim();
    if (!trimmed) return;

    const runState = getPipelineRunState(prefix);
    const normalizedMeta = global.normalizePipelineRunEntryMeta({
      agentId,
      ...meta,
    });
    const entry = runtimeFormats.createPipelineRunEntry
      ? runtimeFormats.createPipelineRunEntry({
        agentId,
        content: trimmed,
        ...normalizedMeta,
      }, PIPELINE_RUN_ENTRY_DEFAULTS)
      : {
        agentId,
        content: trimmed,
        ...normalizedMeta,
      };
    runState.cumulativeEntries.push(entry);
    refreshPipelineRunCumulativeText(runState);
    global.persistPipelineRuntimeState?.(prefix);
  }

  function setPipelineRunEntry(prefix, agentId, content, meta = {}) {
    const trimmed = String(content || '').trim();
    const runState = getPipelineRunState(prefix);
    const previousEntry = runState.cumulativeEntries.find((entry) => entry.agentId === agentId) || {};
    runState.cumulativeEntries = runState.cumulativeEntries
      .filter((entry) => entry.agentId !== agentId);

    if (trimmed) {
      const normalizedMeta = global.normalizePipelineRunEntryMeta({
        agentId,
        sourceAgentId: previousEntry.sourceAgentId || agentId,
        quality: previousEntry.quality || PIPELINE_RUN_ENTRY_DEFAULTS.quality,
        validation: previousEntry.validation || PIPELINE_RUN_ENTRY_DEFAULTS.validation,
        origin: previousEntry.origin || PIPELINE_RUN_ENTRY_DEFAULTS.origin,
        ...meta,
      });

      const entry = runtimeFormats.createPipelineRunEntry
        ? runtimeFormats.createPipelineRunEntry({
          agentId,
          content: trimmed,
          ...normalizedMeta,
        }, PIPELINE_RUN_ENTRY_DEFAULTS)
        : {
          agentId,
          content: trimmed,
          ...normalizedMeta,
        };

      runState.cumulativeEntries.push(entry);
    }

    refreshPipelineRunCumulativeText(runState);
    global.persistPipelineRuntimeState?.(prefix);
  }

  function getResolvedTargetStep(prefix) {
    const mode = global.getPipelineLaunchMode(prefix);
    return global.normalizePipelineTargetStepId(mode);
  }

  function buildPipelineCacheAwareSharedBlocks(prefix) {
    const runState = getPipelineRunState(prefix);
    const formSnapshot = String(runState.formSnapshot || buildPipelineFormSnapshot(prefix) || '').trim();

    if (!formSnapshot) return [];

    return [{
      key: 'cache_aware_form_snapshot',
      text: `=== CONTEXTE FORMULAIRE STABLE ===\n${formSnapshot}`,
      cacheable: true,
    }];
  }

  function buildCacheAwareSignature(prefix, pipelineAgents = []) {
    const firstAgentId = pipelineAgents.find(Boolean)?.id || '';
    const resolvedStepId = getResolvedTargetStep(prefix);
    const runState = getPipelineRunState(prefix);
    const formSnapshot = String(runState.formSnapshot || buildPipelineFormSnapshot(prefix) || '').trim();
    return [resolvedStepId, firstAgentId, formSnapshot].join('\n---\n').trim();
  }

  function markCacheAwarePrelaunchSuccess(prefix, pipelineAgents = []) {
    const runState = getPipelineRunState(prefix);
    runState.lastCacheAwareSignature = buildCacheAwareSignature(prefix, pipelineAgents);
  }

  function shouldSkipCacheAwarePrelaunch(prefix, pipelineAgents = []) {
    const freshness = global.getPromptCacheFreshnessInfo?.(prefix);
    const runState = getPipelineRunState(prefix);
    const currentSignature = buildCacheAwareSignature(prefix, pipelineAgents);

    return Boolean(
      currentSignature &&
      runState.lastCacheAwareSignature &&
      currentSignature === runState.lastCacheAwareSignature &&
      freshness?.state === 'hot'
    );
  }

  function withPipelineCacheAwarePromptData(prefix, promptData, options = {}) {
    if (!promptData || typeof promptData === 'string') return promptData;

    const sharedBlocks = buildPipelineCacheAwareSharedBlocks(prefix);
    const runtimeSource = String(options.source || promptData.runtimeSource || 'pipeline');
    const promptChars = Number(promptData?.promptDebug?.promptChars) || global.getPromptTextCharCount(promptData.filled);

    return {
      ...promptData,
      fixedContentBlocks: [
        ...sharedBlocks,
        ...(Array.isArray(promptData.fixedContentBlocks) ? promptData.fixedContentBlocks : []),
      ],
      runtimeSource,
      promptDebug: {
        ...(promptData.promptDebug || {}),
        promptChars,
        source: runtimeSource,
      },
    };
  }

  function buildCacheAwarePrelaunchPromptData(prefix, firstAgent) {
    const ctx = global.buildCtx(firstAgent.id);
    const basePrompt = global.buildPrompt(firstAgent.id, ctx);
    const prelaunchFilled = [
      'PHASE TECHNIQUE — CACHE-AWARE PRÉ-PIPELINE',
      'Objectif : amorcer le préfixe commun stable partagé avant le pipeline standard.',
      'Réponds uniquement : CACHE_AWARE_READY',
    ].join('\n\n');

    return withPipelineCacheAwarePromptData(prefix, {
      filled: prelaunchFilled,
      fixedContent: basePrompt.fixedContent,
      fixedContentBlocks: Array.isArray(basePrompt.fixedContentBlocks) ? basePrompt.fixedContentBlocks : [],
      runtimeAgentId: global.CACHE_AWARE_RUNTIME_AGENT_ID,
      promptDebug: {
        ...(basePrompt.promptDebug || {}),
        promptChars: prelaunchFilled.length,
      },
    }, { source: 'cache-aware-prelaunch' });
  }

  async function runCacheAwarePrelaunch(prefix, pipelineAgents = []) {
    const firstAgent = pipelineAgents.find(Boolean);
    if (!firstAgent) return null;

    setPipelineLaunchState(prefix, {
      currentStepId: global.CACHE_AWARE_STEP_ID,
      isRunning: true,
      lastStatus: CACHE_AWARE_PRELAUNCH_LABEL,
    });

    const promptData = buildCacheAwarePrelaunchPromptData(prefix, firstAgent);
    const response = await global.callAI('cache_aware', promptData, global.shouldUseImagesForAgent(firstAgent));
    global.showAgentCost('cache_aware', response.usage || null, {
      prefix,
      source: 'cache-aware-prelaunch',
    });
    global.syncCacheIndicator(response.usage || null);
    markCacheAwarePrelaunchSuccess(prefix, pipelineAgents);

    return response;
  }

  async function runPipelineWithCacheAware(prefix) {
    global.beginAIExecution?.(prefix);
    const resolvedStepId = getResolvedTargetStep(prefix);
    const pipelineAgents = global.getPipelineRuntimeAgentsForTarget(prefix, resolvedStepId);

    resetPipelineRunState(prefix);
    global.beginCacheDebugRun(prefix, pipelineAgents, {
      launchScope: CACHE_AWARE_PRELAUNCH_SCOPE,
      cacheAwareEnabled: true,
    });

    if (shouldSkipCacheAwarePrelaunch(prefix, pipelineAgents)) {
      const activeRun = global.getActiveCacheDebugRun?.(prefix);
      if (activeRun) {
        activeRun.cacheAwareSkipped = true;
        activeRun.cacheAwareSkipReason = 'cache chaud';
        activeRun.launchScope = `${global.PIPELINE_LAUNCH_DEFAULT_SCOPE} � cache chaud`;
      }

      setPipelineLaunchState(prefix, {
        currentStepId: global.CACHE_AWARE_STEP_ID,
        isRunning: false,
        lastStatus: `${CACHE_AWARE_SKIPPED_STATUS} � cache chaud`,
      });
      global.showToast('Cache chaud detecte - prechauffage saute', '#7eb8f7', 1800);

      return startPipeline(prefix, {
        skipCacheRunInit: true,
        preserveRunState: true,
        preserveCacheStatus: true,
      });
    }

    try {
      await runCacheAwarePrelaunch(prefix, pipelineAgents);
    } catch (error) {
      const activeRun = global.getActiveCacheDebugRun?.(prefix);
      if (activeRun) {
        activeRun.cacheAwareSkipped = true;
        activeRun.cacheAwareSkipReason = error.message;
        activeRun.cacheAwareEnabled = false;
        activeRun.launchScope = `${global.PIPELINE_LAUNCH_DEFAULT_SCOPE} � fallback direct`;
      }

      setPipelineLaunchState(prefix, {
        currentStepId: global.CACHE_AWARE_STEP_ID,
        isRunning: false,
        lastStatus: `${CACHE_AWARE_DIRECT_FALLBACK_STATUS} � lancement direct`,
      });
      global.showToast(`Warmup indisponible - lancement direct (${error.message})`, '#e8c547', 2600);

      return startPipeline(prefix, {
        skipCacheRunInit: true,
        preserveRunState: true,
      });
    }

    return startPipeline(prefix, {
      skipCacheRunInit: true,
      preserveRunState: true,
      preserveCacheStatus: true,
    });
  }

  async function startPipeline(prefix, options = {}) {
    const skipCacheRunInit = Boolean(options.skipCacheRunInit);
    const preserveRunState = Boolean(options.preserveRunState);
    const preserveCacheStatus = Boolean(options.preserveCacheStatus);
    const resolvedStepId = getResolvedTargetStep(prefix);
    const finalStepMeta = global.getPipelineTargetStepMetaForPrefix(prefix, resolvedStepId);
    const pipelineAgents = global.getPipelineRuntimeAgentsForTarget(prefix, resolvedStepId);
    const finalAgentId = finalStepMeta?.stopAfterAgentId || pipelineAgents[pipelineAgents.length - 1]?.id || '';
    const runtimeAgentIds = new Set(pipelineAgents.map((agent) => agent.id));
    const knownAgentIds = ['marche', 'titre', 'tags', 'description', 'alt'];
    const warningBox = document.getElementById(`imgWarning-${prefix}`);
    const button = document.getElementById(`runBtn-${prefix}`);

    if (global.state.images[prefix].length === 0) {
      if (warningBox) warningBox.style.display = 'block';
      global.showToast('Charge au moins une image', '#ff4757');
      return;
    }

    if (warningBox) warningBox.style.display = 'none';
    if (!preserveCacheStatus) global.setLastCacheStatus('—');
    global.resetSocialRuntimePanels(prefix);
    global.resetFinalOutputPanels(prefix);
    global.clearPipelineRuntimeState?.(prefix);

    ['titre_valide', 'description_assembled', 'description_final', 'tags', 'tags_raw', 'alt'].forEach((key) => {
      global.state.outputs[key] = '';
    });

    if (button) {
      button.disabled = true;
      global.PipelineUIIcons?.setIconLabel?.(button, 'refresh', 'Pipeline en cours...');
    }

    setPipelineLaunchState(prefix, {
      currentStepId: '',
      isRunning: true,
      lastStatus: PIPELINE_STATUS_RUNNING,
    });

    const isSoloTabsFlow = prefix === PIPELINE_PREFIXES.TABLETOP || prefix === PIPELINE_PREFIXES.COLLECTION;

    if (isSoloTabsFlow) {
      const pipelineEl = document.getElementById(`pipeline-${prefix}`);
      if (pipelineEl) pipelineEl.style.display = '';
      global.setPipelineExecutionActive(true);
      activateSoloTab(prefix, 'pipeline', { force: true });
      refreshSoloTabs(prefix);
      global.showView('form');
    } else {
      const pipelineBody = document.getElementById('pipelineViewBody');
      if (pipelineBody) {
        const pipelineEl = document.getElementById(`pipeline-${prefix}`);
        if (pipelineEl) {
          pipelineEl.style.display = '';
          pipelineBody.appendChild(pipelineEl);
        }
        global.moveFinalOutputPanelToPipelineBody(prefix, pipelineBody);
        global.moveSocialPanelsToPipelineBody(prefix, pipelineBody);
      }

      const titleEl = document.getElementById('pipelineViewTitle');
      if (titleEl) {
        const iconName = global.currentMode === 'tabletop' ? 'tabletop' : 'collection';
        const label = global.currentMode === 'tabletop' ? 'Pipeline Tabletop' : 'Pipeline Collection';
        global.PipelineUIIcons?.setIconLabel?.(titleEl, iconName, label);
      }

      const timeline = document.getElementById('pipelineTimeline');
      if (timeline) timeline.style.display = '';

      const ctx = document.getElementById('headerContext');
      if (ctx) {
        ctx.className = 'app-context mode-pipeline';
        ctx.textContent = 'Pipeline en cours...';
      }
      global.buildPipelineTimeline();
      global.setPipelineExecutionActive(true);
      global.showView('pipeline');
    }

    global.state.selectedAccroche = null;
    global.state.selectedCTA = null;
    global.state.selectedTitre = null;
    global.state.selectedTags = [];
    global.state.outputs.iris = '';
    global.clearPipelineSeedSnapshot?.(prefix);
    if (!preserveRunState) resetPipelineRunState(prefix);
    if (!skipCacheRunInit) {
      global.beginCacheDebugRun(prefix, pipelineAgents, {
        launchScope: global.PIPELINE_LAUNCH_DEFAULT_SCOPE,
        cacheAwareEnabled: false,
      });
    }

    knownAgentIds.forEach((agentId) => {
      resetPipelineAgentCard(prefix, agentId, runtimeAgentIds);
    });

    refreshSoloTabs(prefix);

    let hasError = false;
    let isSelectionPause = false;
    let lastCompletedAgentId = '';

    for (const agent of pipelineAgents) {
      setPipelineLaunchState(prefix, {
        currentStepId: global.getPipelineDisplayStepIdForRuntimeAgent(prefix, agent.id),
        isRunning: true,
        lastStatus: `${PIPELINE_STATUS_RUNNING} · ${global.getPipelineDisplayStepIdForRuntimeAgent(prefix, agent.id)}`,
      });

      const ok = await global.runAgent(agent);
      if (!ok) {
        hasError = true;
        break;
      }

      lastCompletedAgentId = agent.id;

      if (agent.hasSelection) {
        isSelectionPause = true;
        break;
      }

      if (agent.id === finalAgentId) break;
    }

    finalizePipelineExecution(prefix, {
      hasError,
      isSelectionPause,
      lastCompletedAgentId,
      finalAgentId,
      button,
      isSoloTabsFlow,
    });
  }

  const prefixes = global.getPipelinePrefixes();
  prefixes.forEach((prefix) => getPipelineRunState(prefix));
  refreshPipelineLaunchPanels();

  global.PipelineUILaunchRuntime = {
    refreshSoloTabs,
    activateSoloTab,
    getPipelineAgentDomRefs,
    beginAgentExecution,
    finalizeAgentSuccess,
    finalizeAgentError,
    resetPipelineAgentCard,
    finalizePipelineExecution,
    refreshPipelineLaunchPanelState,
    refreshPipelineLaunchPanels,
    setPipelineLaunchState,
    buildPipelineFormSnapshot,
    getPipelineRunState,
    resetPipelineRunState,
    appendPipelineRunEntry,
    setPipelineRunEntry,
    getResolvedTargetStep,
    withPipelineCacheAwarePromptData,
    buildCacheAwarePrelaunchPromptData,
    runCacheAwarePrelaunch,
    runPipelineWithCacheAware,
    startPipeline,
  };

  global.PipelineUI.runtimeLaunch = global.PipelineUI.runtimeLaunch || {};
  Object.assign(global.PipelineUI.runtimeLaunch, global.PipelineUILaunchRuntime);
  Object.assign(global, global.PipelineUILaunchRuntime);
})(window);
