'use strict';

(function initPipelineUILaunchRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};

  function refreshSoloTabs(prefix) {
    const mode = typeof global.getPipelineModeByPrefix === 'function'
      ? global.getPipelineModeByPrefix(prefix)
      : (prefix === 'col' ? 'collection' : 'tabletop');
    const refreshMethodName = typeof global.getPipelineUiConfig === 'function'
      ? global.getPipelineUiConfig(mode)?.tabs?.refreshMethod
      : (prefix === 'col' ? 'refreshCollectionSoloTabs' : 'refreshDndSoloTabs');
    const refreshMethod = refreshMethodName ? global[refreshMethodName] : null;
    refreshMethod?.();
  }

  function activateSoloTab(prefix, tabId, options = {}) {
    const mode = typeof global.getPipelineModeByPrefix === 'function'
      ? global.getPipelineModeByPrefix(prefix)
      : (prefix === 'col' ? 'collection' : 'tabletop');
    const activateMethodName = typeof global.getPipelineUiConfig === 'function'
      ? global.getPipelineUiConfig(mode)?.tabs?.activateMethod
      : (prefix === 'col' ? 'activateCollectionSoloTab' : 'activateDndSoloTab');
    const activateMethod = activateMethodName ? global[activateMethodName] : null;
    activateMethod?.(tabId, options);
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

    ctxEl.textContent = agent.title.replace(/^[🔍🖼️📊🔖🏷️📝]/u, '').trim();
  }

  function beginAgentExecution(prefix, agent, { isRetry = false } = {}) {
    const refs = getPipelineAgentDomRefs(prefix, agent.id);

    if (refs.card) refs.card.className = 'agent-card active';
    global.updatePipelineTimeline(agent.id, 'active');
    refreshSoloTabs(prefix);
    if (refs.stat) {
      refs.stat.className = 'agent-status s-run';
      refs.stat.textContent = '⟳ génération...';
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
    global.updatePipelineTimeline(agent.id, 'done');

    if (renderAgentSelectionUi(agent, result)) {
      if (refs.stat) {
        refs.stat.className = 'agent-status s-run';
        refs.stat.textContent = '⏳ sélection requise';
      }
    } else if (refs.stat) {
      refs.stat.className = 'agent-status s-done';
      refs.stat.textContent = '✓ done';
    }

    enableAgentRuntimeActions(refs, agent);
    if (refs.stopBtn) refs.stopBtn.style.display = 'none';
    refreshSoloTabs(prefix);
  }

  function finalizeAgentError(prefix, agent, refs, error) {
    if (refs.out) refs.out.textContent = `❌ ${error.message}`;
    if (refs.card) refs.card.className = 'agent-card error';
    global.updatePipelineTimeline(agent.id, 'error');
    if (refs.stat) {
      refs.stat.className = 'agent-status s-err';
      refs.stat.textContent = error.message.includes('stoppée') ? '⏹ stoppé' : '✗ erreur';
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
      refs.stat.textContent = 'en attente';
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
      button.innerHTML = '▶ Relancer tout';
    }

    global.setPipelineExecutionActive?.(false);

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
      const hasResult = prefix === 'tt'
        ? global.isDndSoloResultAvailable?.()
        : global.isCollectionSoloResultAvailable?.();
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
    global.syncStandaloneLaunchButtons?.(prefix);
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
    const mode = global.getPipelineLaunchMode(prefix);
    const echelles = typeof global.PipelineUIEchelles?.getEchellesSelected === 'function'
      ? global.PipelineUIEchelles.getEchellesSelected()
      : '';
    const dimensions = typeof global.PipelineUIEchelles?.getDimsFromEchelles === 'function'
      ? global.PipelineUIEchelles.getDimsFromEchelles()
      : '';
    const collectionData = mode === 'collection' && typeof global.getCollectionData === 'function'
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

    if (mode === 'tabletop') {
      pushSnapshotLine('Type', document.getElementById('tt-fType')?.value);
      pushSnapshotLine('Version', document.getElementById('tt-fVersion')?.value);
      pushSnapshotLine('Archétypes', typeof global.getArchetypes === 'function' ? global.getArchetypes() : '');
      pushSnapshotLine('Notes', document.getElementById('tt-fNotes')?.value);
    } else {
      pushSnapshotLine('Medium', collectionData.medium || (typeof global.getMediums === 'function' ? global.getMediums() : ''));
      pushSnapshotLine('Sous-catégories medium', collectionData.mediumSubcategories || collectionData.medium_subcategories || '');
      pushSnapshotLine('Genres transverses', collectionData.genresTransverses || collectionData.genres_transverses || collectionData.genres || '');
      pushSnapshotLine('Contexte medium', collectionData.mediumContext || collectionData.medium_context || '');
      pushSnapshotLine('License sensible', document.getElementById('col-fLicense')?.checked ? 'oui' : 'non');
      pushSnapshotLine('Particularités', document.getElementById('col-fParticularites')?.value);
      pushSnapshotLine('Description figurine', document.getElementById('col-fDescriptionFigurine')?.value);
      pushSnapshotLine('Résumé personnage', document.getElementById('col-fResumePersonnage')?.value);
      pushSnapshotLine('Connexes prioritaires', document.getElementById('col-fConnexesPrioritaires')?.value);
      pushSnapshotLine('Lien perso', document.getElementById('col-fLienPerso')?.value);
    }

    return lines.join('\n');
  }

  function getPipelineRunState(prefix) {
    global.state.pipelineRun = global.state.pipelineRun || {};
    global.state.pipelineRun[prefix] = global.state.pipelineRun[prefix] || {
      formSnapshot: '',
      warmupHint: '',
      cumulativeEntries: [],
      cumulativeText: '',
    };
    return global.state.pipelineRun[prefix];
  }

  function resetPipelineRunState(prefix) {
    const runState = getPipelineRunState(prefix);
    const warmupStepId = global.getPipelineWarmupStepId?.(global.getPipelineLaunchMode(prefix)) || 'marche';
    const formSnapshot = buildPipelineFormSnapshot(prefix);

    runState.formSnapshot = formSnapshot;
    runState.warmupHint = `Warmup compatible: préfixe stable avant ${warmupStepId}`;
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
    }, agentId);
    runState.cumulativeEntries.push({
      agentId,
      content: trimmed,
      ...normalizedMeta,
    });
    refreshPipelineRunCumulativeText(runState);
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
        quality: previousEntry.quality || 'net',
        validation: previousEntry.validation || 'valide',
        origin: previousEntry.origin || 'manuel',
        ...meta,
      }, agentId);

      runState.cumulativeEntries.push({
        agentId,
        content: trimmed,
        ...normalizedMeta,
      });
    }

    refreshPipelineRunCumulativeText(runState);
  }

  function getResolvedTargetStep(prefix) {
    const mode = global.getPipelineLaunchMode(prefix);

    if (typeof global.normalizePipelineTargetStepId === 'function') {
      return global.normalizePipelineTargetStepId(mode);
    }

    if (typeof global.getPipelineFinalTargetStepId === 'function') {
      return global.getPipelineFinalTargetStepId(mode);
    }

    return '';
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
      runtimeAgentId: global.CACHE_AWARE_RUNTIME_AGENT_ID || 'cache_aware_prelaunch',
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
      currentStepId: global.CACHE_AWARE_STEP_ID || 'cache_aware',
      isRunning: true,
      lastStatus: 'cache-aware pré-pipeline',
    });

    const promptData = buildCacheAwarePrelaunchPromptData(prefix, firstAgent);
    const response = await global.callClaude('cache_aware', promptData, global.shouldUseImagesForAgent(firstAgent));
    global.showAgentCost('cache_aware', response.usage || null, {
      prefix,
      source: 'cache-aware-prelaunch',
    });
    global.syncCacheIndicator(response.usage || null);

    return response;
  }

  async function runPipelineWithCacheAware(prefix) {
    const resolvedStepId = getResolvedTargetStep(prefix);
    const pipelineAgents = global.getPipelineRuntimeAgentsForTarget(prefix, resolvedStepId);

    resetPipelineRunState(prefix);
    global.beginCacheDebugRun(prefix, pipelineAgents, {
      launchScope: 'cache-aware pré-pipeline + pipeline complet',
      cacheAwareEnabled: true,
    });

    try {
      await runCacheAwarePrelaunch(prefix, pipelineAgents);
    } catch (error) {
      global.finalizeCacheDebugRun(prefix, 'erreur cache-aware');
      setPipelineLaunchState(prefix, {
        currentStepId: global.CACHE_AWARE_STEP_ID || 'cache_aware',
        isRunning: false,
        lastStatus: 'erreur cache-aware',
      });
      global.showToast(`❌ Cache-aware pré-pipeline: ${error.message}`, '#ff4757');
      return false;
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
      global.showToast('⚠️ Charge au moins une image !', '#ff4757');
      return;
    }

    if (warningBox) warningBox.style.display = 'none';
    if (!preserveCacheStatus) global.setLastCacheStatus('—');
    global.resetSocialRuntimePanels?.(prefix);
    global.resetFinalOutputPanels?.(prefix);

    ['titre_valide', 'description_assembled', 'tags', 'tags_raw', 'alt'].forEach((key) => {
      global.state.outputs[key] = '';
    });

    if (button) {
      button.disabled = true;
      button.textContent = '⟳ Pipeline en cours...';
    }

    setPipelineLaunchState(prefix, {
      currentStepId: '',
      isRunning: true,
      lastStatus: 'en cours',
    });

    const isSoloTabsFlow = prefix === 'tt' || prefix === 'col';

    if (isSoloTabsFlow) {
      const pipelineEl = document.getElementById(`pipeline-${prefix}`);
      if (pipelineEl) pipelineEl.style.display = '';
      global.setPipelineExecutionActive?.(true);
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
        global.moveFinalOutputPanelToPipelineBody?.(prefix, pipelineBody);
        global.moveSocialPanelsToPipelineBody?.(prefix, pipelineBody);
      }

      const titleEl = document.getElementById('pipelineViewTitle');
      if (titleEl) titleEl.textContent = global.currentMode === 'tabletop' ? '🎲 Pipeline Tabletop' : '🖼️ Pipeline Collection';

      const timeline = document.getElementById('pipelineTimeline');
      if (timeline) timeline.style.display = '';

      const ctx = document.getElementById('headerContext');
      if (ctx) {
        ctx.className = 'app-context mode-pipeline';
        ctx.textContent = '⟳ Pipeline en cours...';
      }
      global.buildPipelineTimeline();
      global.setPipelineExecutionActive?.(true);
      global.showView('pipeline');
    }

    global.state.selectedAccroche = null;
    global.state.selectedCTA = null;
    global.state.selectedTitre = null;
    global.state.selectedTags = [];
    global.state.outputs.iris = '';
    if (!preserveRunState) resetPipelineRunState(prefix);
    if (!skipCacheRunInit) {
      global.beginCacheDebugRun(prefix, pipelineAgents, {
        launchScope: 'pipeline complet',
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
        lastStatus: `en cours · ${global.getPipelineDisplayStepIdForRuntimeAgent(prefix, agent.id)}`,
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

  if (typeof global.state !== 'undefined') {
    const prefixes = typeof global.getPipelinePrefixes === 'function' ? global.getPipelinePrefixes() : ['tt', 'col'];
    prefixes.forEach((prefix) => getPipelineRunState(prefix));
    refreshPipelineLaunchPanels();
  }

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
