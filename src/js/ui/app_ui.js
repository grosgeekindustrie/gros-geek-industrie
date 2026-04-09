(function initPipelineUIApp(global) {

// Couche application transverse.
// Navigation des vues, toasts, header context, settings panel et actions globales.
// À garder orienté shell / UX, sans réembarquer le coeur pipeline.
  global.PipelineUI = global.PipelineUI || {};

  const getState = () => global.state;
  const getCurrentMode = () => global.currentMode || 'tabletop';
  const getPfx = () => (typeof global.pfx === 'function' ? global.pfx() : (getCurrentMode() === 'collection' ? 'col' : 'tt'));
  const getAgents = () => (typeof global.getPipelineAgents === 'function' ? global.getPipelineAgents() : []);
  const getPipelineLaunchTargets = (mode) => (typeof global.getPipelineLaunchTargets === 'function' ? global.getPipelineLaunchTargets(mode) : []);
  const getPipelineDefaultTargetStepId = (mode) => (typeof global.getPipelineDefaultTargetStepId === 'function' ? global.getPipelineDefaultTargetStepId(mode) : '');
  const getPipelineTargetLabel = (targetStepId, mode) => (typeof global.getPipelineTargetLabel === 'function' ? global.getPipelineTargetLabel(targetStepId, mode) : '');

  let currentView = 'home';
  let pendingBatchMode = null;
  let pipelineExecutionActive = false;

  function getBatchWrapper() {
    return document.getElementById('batchWrapper');
  }

  function getBatchHomeHost() {
    return document.querySelector('.app-shell') || document.body;
  }

  function hasActiveAgentControllers() {
    return Object.values(global.abortControllers || {}).some((controller) => !!controller);
  }

  function isPipelineExecutionActive() {
    return !!(
      pipelineExecutionActive ||
      hasActiveAgentControllers() ||
      global.isBatchRunning?.()
    );
  }

  function refreshDndStepper() {
    global.refreshDndStepper?.();
  }

  function refreshDndTabs() {
    global.refreshDndSoloTabs?.();
  }

  function refreshCollectionTabs() {
    global.refreshCollectionSoloTabs?.();
  }

  function getModeFromPrefix(prefix = getPfx()) {
    return prefix === 'col' ? 'collection' : 'tabletop';
  }

  function getPipelineLaunchNodes(prefix = getPfx()) {
    const root = document.querySelector(`[data-js="pipeline-launch-panel"][data-prefix="${prefix}"]`);

    return {
      root,
      controls: root?.querySelector('[data-js="pipeline-launch-controls"]') || null,
      status: root?.querySelector('[data-js="pipeline-launch-status"]') || null,
      meta: root?.querySelector('[data-js="pipeline-launch-meta"]') || null,
    };
  }

  function getPipelineLaunchStore(prefix = getPfx()) {
    const state = getState();
    const fallbackState = {
      status: 'idle',
      targetStepId: '',
      lastTargetStepId: '',
      currentAgentId: '',
      currentStepIndex: 0,
      totalSteps: 0,
      lastCacheStatus: '—',
      lastCostCents: 0,
    };

    if (!state) return fallbackState;

    state.pipelineLaunch = state.pipelineLaunch || {};
    state.pipelineLaunch[prefix] = state.pipelineLaunch[prefix] || { ...fallbackState };

    return state.pipelineLaunch[prefix];
  }

  function buildLaunchStatusText(prefix = getPfx()) {
    const mode = getModeFromPrefix(prefix);
    const launchState = getPipelineLaunchStore(prefix);
    const fallbackTargetId = getPipelineDefaultTargetStepId(mode);
    const targetStepId = launchState.targetStepId || launchState.lastTargetStepId || fallbackTargetId;
    const targetLabel = getPipelineTargetLabel(targetStepId, mode) || 'Pipeline complet';
    const currentLabel = getPipelineTargetLabel(launchState.currentAgentId, mode);

    if (launchState.status === 'running') {
      const progressLabel = launchState.totalSteps
        ? ` · ${launchState.currentStepIndex}/${launchState.totalSteps}`
        : '';
      const currentStepLabel = currentLabel ? ` · en cours : ${currentLabel}` : '';

      return `Cible : ${targetLabel}${progressLabel}${currentStepLabel}`;
    }

    if (launchState.status === 'paused') return `Pipeline en pause · sélection requise sur ${currentLabel || targetLabel}`;
    if (launchState.status === 'error') return `Dernière exécution en erreur · ${currentLabel || targetLabel}`;
    if (launchState.status === 'stopped') return `Exécution interrompue · ${currentLabel || targetLabel}`;
    if (launchState.status === 'done') return `Dernière cible atteinte : ${targetLabel}`;

    return 'Choisis une étape cible. Le pipeline rejouera l’amont utile puis s’arrêtera à cette étape.';
  }

  function buildLaunchMetaText(prefix = getPfx()) {
    const launchState = getPipelineLaunchStore(prefix);
    const sessionCost = Number(getState()?.sessionCost || 0).toFixed(2);

    return `Cache : ${launchState.lastCacheStatus || '—'} · Coût session : ${sessionCost}¢`;
  }

  function refreshPipelineLaunchPanelState(prefix = getPfx()) {
    const { root, status, meta, controls } = getPipelineLaunchNodes(prefix);
    if (!root) return;

    const launchState = getPipelineLaunchStore(prefix);
    const isRunning = isPipelineExecutionActive();
    const mode = getModeFromPrefix(prefix);

    if (status) status.textContent = buildLaunchStatusText(prefix);
    if (meta) meta.textContent = buildLaunchMetaText(prefix);

    controls?.querySelectorAll('[data-js="pipeline-launch-button"]').forEach((button) => {
      const targetStepId = button.dataset.targetStepId || '';
      const isLastTarget = targetStepId && targetStepId === (launchState.targetStepId || launchState.lastTargetStepId);
      const isDefaultTarget = targetStepId === getPipelineDefaultTargetStepId(mode);

      button.disabled = isRunning;
      button.classList.toggle('btn-accent', isLastTarget || isDefaultTarget);
      button.classList.toggle('btn-muted', !(isLastTarget || isDefaultTarget));
    });
  }

  function createLaunchButton(prefix, label, targetStepId, isFullPipeline = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn ${isFullPipeline ? 'btn-accent' : 'btn-muted'}`;
    button.dataset.js = 'pipeline-launch-button';
    button.dataset.targetStepId = targetStepId;
    button.textContent = label;
    button.addEventListener('click', () => {
      global.startPipeline?.(prefix, { targetStepId });
    });

    return button;
  }

  function renderPipelineLaunchPanel(prefix = getPfx()) {
    const { controls } = getPipelineLaunchNodes(prefix);
    if (!controls) return;

    const mode = getModeFromPrefix(prefix);
    const launchTargets = getPipelineLaunchTargets(mode);
    const defaultTargetStepId = getPipelineDefaultTargetStepId(mode);
    const defaultTargetLabel = getPipelineTargetLabel(defaultTargetStepId, mode);
    const fullPipelineLabel = defaultTargetLabel
      ? `▶ Pipeline complet · ${defaultTargetLabel}`
      : '▶ Pipeline complet';

    controls.innerHTML = '';
    controls.appendChild(createLaunchButton(prefix, fullPipelineLabel, defaultTargetStepId, true));

    launchTargets.forEach((target) => {
      if (target.id === defaultTargetStepId) return;
      controls.appendChild(createLaunchButton(prefix, `▶ Jusqu’à ${target.launchLabel}`, target.id));
    });

    refreshPipelineLaunchPanelState(prefix);
  }

  function refreshPipelineLaunchPanels() {
    renderPipelineLaunchPanel('tt');
    renderPipelineLaunchPanel('col');
  }

  function setPipelineExecutionActive(isActive) {
    pipelineExecutionActive = !!isActive;
    syncHeaderBackAction();
    refreshDndTabs();
    refreshCollectionTabs();
    refreshPipelineLaunchPanels();
  }
  function syncHeaderBackAction() {
    const backBtn = document.getElementById('appBackBtn');
    if (!backBtn) return;

    const stopBtn = document.getElementById('btnStopGlobal');
    if (stopBtn) stopBtn.classList.remove('visible');

    const isHome = currentView === 'home';
    backBtn.style.display = isHome ? 'none' : '';
    backBtn.classList.toggle('is-hidden', isHome);
    if (isHome) {
      backBtn.classList.remove('is-cancel');
      return;
    }

    const isExecuting = isPipelineExecutionActive();
    backBtn.classList.toggle('is-cancel', isExecuting);
    backBtn.textContent = isExecuting ? '✕ Annuler' : '↩️ Retour';
    backBtn.title = isExecuting
      ? 'Annuler l’exécution et revenir à l’accueil'
      : 'Revenir à l’accueil';
  }

  function isBatchFlowInForm() {
    const batchWrapper = getBatchWrapper();
    return !!(batchWrapper && batchWrapper.classList.contains('visible') && batchWrapper.parentNode?.id === 'formViewBody');
  }

  function isBatchFlowInPipeline() {
    const batchWrapper = getBatchWrapper();
    return !!(batchWrapper && batchWrapper.classList.contains('visible') && batchWrapper.parentNode?.id === 'pipelineViewBody');
  }

  function moveBatchWrapperToForm() {
    const batchWrapper = getBatchWrapper();
    const formBody = document.getElementById('formViewBody');
    if (!batchWrapper || !formBody) return;
    document.getElementById('pipelineViewBody')?.classList.remove('pipeline-view-body-batch');
    formBody.appendChild(batchWrapper);
    batchWrapper.classList.add('visible');
  }

  function moveBatchWrapperToPipeline() {
    const batchWrapper = getBatchWrapper();
    const pipelineBody = document.getElementById('pipelineViewBody');
    if (!batchWrapper || !pipelineBody) return;
    pipelineBody.classList.add('pipeline-view-body-batch');
    pipelineBody.appendChild(batchWrapper);
    batchWrapper.classList.add('visible');
  }

  function restoreBatchWrapperToShell() {
    const batchWrapper = getBatchWrapper();
    if (!batchWrapper) return;
    document.getElementById('pipelineViewBody')?.classList.remove('pipeline-view-body-batch');
    getBatchHomeHost().appendChild(batchWrapper);
    batchWrapper.classList.remove('visible');
  }

  function showToast(msg, color = '#4caf7d', duration = 2500) {
    const existing = document.querySelectorAll('.toast-item');
    const offset = 20 + existing.length * 56;
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.style.cssText = `position:fixed;bottom:${offset}px;right:20px;background:${color};color:#0f0f0f;padding:10px 14px 10px 16px;border-radius:8px;font-family:Syne,sans-serif;font-size:13px;font-weight:700;z-index:9999;display:flex;align-items:center;gap:10px;max-width:420px;transition:bottom .2s;`;

    const text = document.createElement('span');
    text.textContent = msg;

    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = 'background:none;border:none;color:inherit;cursor:pointer;font-size:14px;font-weight:700;padding:0;opacity:.7;flex-shrink:0;';

    toast.appendChild(text);
    toast.appendChild(close);
    document.body.appendChild(toast);

    const remove = () => {
      clearTimeout(timer);
      toast.remove();
      document.querySelectorAll('.toast-item').forEach((el, i) => {
        el.style.bottom = `${20 + i * 56}px`;
      });
    };

    const timer = setTimeout(remove, duration);
    close.onclick = remove;
  }

  function clearAllStorage() {
    if (!confirm('Vider le cache local ?\n(règles persistantes, formulaire)')) return;
    localStorage.clear();
    getState().persistentRules = {};
    getAgents().forEach((agent) => global.refreshRules?.(agent.id));
    showToast('Cache vidé ✓ — rechargement...');
    setTimeout(() => location.reload(), 800);
  }

  function showRawInput(agentId) {
    const raw = getState().inputs[agentId];
    if (!raw) {
      showToast("Pas encore généré — lance d'abord cet agent", '#e8c547');
      return;
    }

    const agent = getAgents().find((entry) => entry.id === agentId);
    const label = agent ? agent.title : agentId;
    document.getElementById('rawInputTitle').textContent = `</> INPUT — ${label}`;
    document.getElementById('rawInputTextarea').value = raw;
    document.getElementById('rawInputCount').textContent = `${raw.length.toLocaleString()} car.`;
    document.getElementById('rawInputLightbox').classList.add('visible');
  }

  function closeRawInput() {
    document.getElementById('rawInputLightbox').classList.remove('visible');
  }

  function copyRawInput() {
    navigator.clipboard.writeText(document.getElementById('rawInputTextarea').value);
    showToast('Input copié ✓');
  }

  function showView(name) {
    currentView = name;
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));

    const view = document.getElementById(`view-${name}`);
    if (view) view.classList.add('active');

    updateHeaderContext(name);
    syncHeaderBackAction();

    if (name !== 'pipeline') {
      try {
        const settings = JSON.parse(localStorage.getItem('pipeline.settings') || '{}');
        settings.view = name;
        localStorage.setItem('pipeline.settings', JSON.stringify(settings));
      } catch (error) {}
    }
  }

  function updateHeaderContext(viewName) {
    const ctx = document.getElementById('headerContext');
    if (!ctx) return;

    ctx.className = 'app-context';
    if (viewName === 'home') {
      ctx.textContent = 'Etsy Pipeline · Génération de fiches produit IA';
    } else if (viewName === 'form') {
      const label = document.getElementById('formModeLabel')?.textContent || '';
      ctx.textContent = label;
      ctx.classList.add(getCurrentMode() === 'tabletop' ? 'mode-tt' : 'mode-col');
    } else if (viewName === 'pipeline') {
      ctx.textContent = '⟳ Pipeline en cours...';
      ctx.classList.add('mode-pipeline');
    }
  }

  // Entrée depuis la home vers un flow unitaire.
  // Objectif stepper : afficher uniquement le formulaire tant que le pipeline
  // n'a pas été lancé, même si certains panneaux ont gardé un état visible.
  function resetSingleFlowPanels(mode) {
    const suffix = mode === 'collection' ? 'col' : 'tt';

    ['pipeline', 'finalOutput', 'socialSection', 'socialOutput', 'reseauxOnlySection'].forEach((prefix) => {
      const element = document.getElementById(`${prefix}-${suffix}`);
      if (element) element.style.display = 'none';
    });

    setPipelineExecutionActive(false);
    syncHeaderBackAction();

    if (mode === 'tabletop') {
      global.resetDndSoloTabs?.();
      refreshDndTabs();
    }

    if (mode === 'collection') {
      global.resetCollectionSoloTabs?.();
      refreshCollectionTabs();
    }
  }

  function selectMode(mode) {
    if (mode === 'batch') {
      global.openBatchModal?.();
      return;
    }

    if (mode !== getCurrentMode()) global.switchMode?.(mode);

    const label = document.getElementById('formModeLabel');
    if (mode === 'tabletop') {
      document.getElementById('ui-tt').style.display = '';
      document.getElementById('ui-col').style.display = 'none';
      if (label) label.textContent = '🎲 Tabletop DnD';
    } else {
      document.getElementById('ui-tt').style.display = 'none';
      document.getElementById('ui-col').style.display = '';
      if (label) label.textContent = '🖼️ Collection';
    }

    resetSingleFlowPanels(mode);
    showView('form');
    refreshPipelineLaunchPanel(mode === 'collection' ? 'col' : 'tt');
    refreshDndStepper();
    refreshDndTabs();
    global.refreshCollectionStepper?.();
    refreshCollectionTabs();
  }

  function selectModeBatch(mode) {
    pendingBatchMode = mode;
    global._pendingBatchMode = mode;
    const modalTitle = document.querySelector('#batchModal h2');
    if (modalTitle) modalTitle.textContent = mode === 'tabletop' ? '⚡ Batch Tabletop' : '⚡ Batch Collection';
    global.openBatchModal?.();
  }

  function cancelToHome() {
    const executionRunning = isPipelineExecutionActive();
    if (executionRunning) {
      stopAllAgents({ silent: true });
      showToast('⏹ Exécution annulée', '#ff4757');
      return;
    }
    if (isBatchFlowInForm() || isBatchFlowInPipeline()) restoreBatchWrapperToShell();

    const timeline = document.getElementById('pipelineTimeline');
    if (timeline) timeline.style.display = '';

    showView('home');
  }

  function stopAllAgents(options = {}) {
    const { silent = false } = options;

    if (isBatchFlowInPipeline()) {
      global.stopBatch?.({ silent });
      setPipelineExecutionActive(false);
      syncHeaderBackAction();
      return;
    }

    const agents = getAgents();
    const controllers = global.abortControllers || {};
    agents.forEach((agent) => {
      const controller = controllers[agent.id];
      if (controller) controller.abort();
      delete controllers[agent.id];
    });
    if (!silent) showToast('⏹ Pipeline stoppé', '#ff4757');
    setPipelineExecutionActive(false);
    syncHeaderBackAction();
  }

  function buildPipelineTimeline(metaLabel = '') {
    if (getCurrentMode() === 'collection' && currentView !== 'pipeline') return;

    const timeline = document.getElementById('pipelineTimeline');
    if (!timeline) return;

    const agents = getAgents();
    const meta = metaLabel
      ? `<span class="pipeline-step active"><span class="pipeline-step-label">${metaLabel}</span></span><span class="pipeline-step-sep">•</span>`
      : '';

    timeline.innerHTML = meta + agents.map((agent, i) =>
      (i > 0 ? '<span class="pipeline-step-sep">›</span>' : '') +
      `<span class="pipeline-step" id="tl-step-${agent.id}">` +
      `<span class="pipeline-step-dot" id="tl-dot-${agent.id}"></span>` +
      `<span class="pipeline-step-label">${agent.title.replace(/^[^—]+— /, '').split(' · ')[0].replace(/[🔍🖼️📊🔖🏷️📝]/u, '').trim()}</span>` +
      '</span>'
    ).join('');
  }

  function updatePipelineTimeline(agentId, status) {
    if (getCurrentMode() === 'collection' && currentView !== 'pipeline') return;

    const dot = document.getElementById(`tl-dot-${agentId}`);
    const step = document.getElementById(`tl-step-${agentId}`);
    if (!dot || !step) return;

    dot.className = `pipeline-step-dot${status !== 'wait' ? ` ${status}` : ''}`;
    step.className = `pipeline-step${status !== 'wait' ? ` ${status}` : ''}`;
  }

  function openSettings() {
    document.getElementById('settingsOverlay').classList.add('visible');
    document.getElementById('settingsPanel').classList.add('visible');
  }

  function closeSettings() {
    document.getElementById('settingsOverlay').classList.remove('visible');
    document.getElementById('settingsPanel').classList.remove('visible');

    const apiKey = document.getElementById('apiKey')?.value;
    if (!apiKey) return;

    try {
      const settings = JSON.parse(localStorage.getItem('pipeline.settings') || '{}');
      settings.apiKey = apiKey;
      localStorage.setItem('pipeline.settings', JSON.stringify(settings));
    } catch (error) {}
  }


  refreshPipelineLaunchPanels();

  global.PipelineUIApp = {
    showToast,
    clearAllStorage,
    showRawInput,
    closeRawInput,
    copyRawInput,
    showView,
    updateHeaderContext,
    selectMode,
    selectModeBatch,
    moveBatchWrapperToForm,
    moveBatchWrapperToPipeline,
    restoreBatchWrapperToShell,
    isBatchFlowInForm,
    isBatchFlowInPipeline,
    cancelToHome,
    stopAllAgents,
    setPipelineExecutionActive,
    isPipelineExecutionActive,
    syncHeaderBackAction,
    buildPipelineTimeline,
    updatePipelineTimeline,
    getPipelineLaunchStore,
    renderPipelineLaunchPanel,
    refreshPipelineLaunchPanelState,
    refreshPipelineLaunchPanels,
    openSettings,
    closeSettings,
    getCurrentView: () => currentView,
    getPendingBatchMode: () => pendingBatchMode,
  };

  global.PipelineUI.app = global.PipelineUI.app || {};
  Object.assign(global.PipelineUI.app, global.PipelineUIApp);
  Object.assign(global, global.PipelineUIApp);
})(window);
