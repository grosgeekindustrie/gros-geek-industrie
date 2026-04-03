(function initPipelineUIApp(global) {

// Couche application transverse.
// Navigation des vues, toasts, header context, settings panel et actions globales.
// À garder orienté shell / UX, sans réembarquer le coeur pipeline.
  global.PipelineUI = global.PipelineUI || {};

  const getState = () => global.state;
  const getCurrentMode = () => global.currentMode || 'tabletop';
  const getPfx = () => (typeof global.pfx === 'function' ? global.pfx() : (getCurrentMode() === 'collection' ? 'col' : 'tt'));
  const getAgents = () => (typeof global.getPipelineAgents === 'function' ? global.getPipelineAgents() : []);

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

  function setPipelineExecutionActive(isActive) {
    pipelineExecutionActive = !!isActive;
    syncHeaderBackAction();
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


  const SOLO_BLOCK_IDS = ['form', 'pipeline', 'result', 'social'];

  function getSoloPrefix(mode = getCurrentMode()) {
    return mode === 'collection' ? 'col' : 'tt';
  }

  function getSoloFlowRoot(prefix) {
    return document.querySelector(`[data-solo-flow="${prefix}"]`);
  }

  function isSoloElementVisible(element) {
    return !!element && window.getComputedStyle(element).display !== 'none';
  }

  function hasSoloResult(prefix) {
    return isSoloElementVisible(document.getElementById(`finalOutput-${prefix}`));
  }

  function hasSoloSocial(prefix) {
    return [
      document.getElementById(`socialSection-${prefix}`),
      document.getElementById(`socialOutput-${prefix}`),
      document.getElementById(`reseauxOnlySection-${prefix}`),
    ].some(isSoloElementVisible);
  }

  function getCollectionSoloFormMeta(status) {
    const activeStep = document.querySelector('#ui-col .collection-step.is-active');
    const stepIndex = Number(activeStep?.dataset.stepIndex || 0) + 1;
    const stepTitle = document.querySelector('[data-js="collection-stepper-title"]')?.textContent?.trim() || 'Images';
    const editionLabel = status === 'running' ? 'Édition verrouillée' : 'Édition disponible';

    return `Step ${stepIndex} · ${stepTitle} · ${editionLabel}`;
  }

  function getSoloBlockAvailability(prefix, status) {
    return {
      form: true,
      pipeline: status !== 'editing',
      result: hasSoloResult(prefix) || status === 'done',
      social: hasSoloSocial(prefix) || status === 'done',
    };
  }

  function getSoloPipelineMeta(prefix, status) {
    if (status === 'editing') return 'En attente';

    const agents = getAgents();
    const total = agents.length;
    let doneCount = 0;
    let selectionRequired = false;

    agents.forEach((agent) => {
      const statText = document.getElementById(`${prefix}-stat-${agent.id}`)?.textContent?.trim().toLowerCase() || '';
      if (statText.includes('done') || statText.includes('✓')) doneCount += 1;
      if (statText.includes('sélection requise')) selectionRequired = true;
    });

    if (status === 'running') return total ? `En cours · ${doneCount}/${total}` : 'En cours';
    if (status === 'paused') return selectionRequired ? 'En pause · choix requis' : 'En pause';
    if (status === 'error') return 'Erreur';
    if (status === 'done') return 'Terminé';

    return 'En attente';
  }

  function getSoloBlockMeta(prefix, blockId, status) {
    if (blockId === 'form') {
      return prefix === 'col'
        ? getCollectionSoloFormMeta(status)
        : (status === 'running' ? 'Édition verrouillée' : 'Édition disponible');
    }

    if (blockId === 'pipeline') return getSoloPipelineMeta(prefix, status);
    if (blockId === 'result') return hasSoloResult(prefix) ? 'Titre, tags, description, Alt générés' : 'Non généré';

    const socialOutput = document.getElementById(`socialOutput-${prefix}`);
    if (isSoloElementVisible(socialOutput)) return 'Générés';
    if (hasSoloSocial(prefix)) return 'Disponibles';
    return 'Non générés';
  }

  function getSoloBlockStateLabel(prefix, blockId, status, isOpen, availability) {
    if (blockId === 'form') {
      if (status === 'running') return 'Verrouillé';
      return isOpen ? 'Ouvert' : 'Replié';
    }

    if (!availability[blockId]) return 'Indisponible';

    if (blockId === 'pipeline') {
      if (status === 'running') return 'En cours';
      if (status === 'paused') return 'En pause';
      if (status === 'error') return 'Erreur';
      return isOpen ? 'Ouvert' : 'Replié';
    }

    return isOpen ? 'Ouvert' : 'Disponible';
  }

  function getDefaultSoloOpenBlock(prefix, status, availability) {
    if (status === 'running' || status === 'paused' || status === 'error') return 'pipeline';
    if (status === 'done') {
      if (availability.result) return 'result';
      if (availability.social) return 'social';
      if (availability.pipeline) return 'pipeline';
    }

    return 'form';
  }

  function refreshSoloFlow(prefix) {
    const flowRoot = getSoloFlowRoot(prefix);
    if (!flowRoot) return;

    let status = flowRoot.dataset.soloStatus || 'editing';
    if ((status === 'running' || status === 'paused') && hasSoloResult(prefix) && !isPipelineExecutionActive()) {
      status = 'done';
      flowRoot.dataset.soloStatus = status;
    }

    const availability = getSoloBlockAvailability(prefix, status);
    let openBlock = flowRoot.dataset.soloOpenBlock || getDefaultSoloOpenBlock(prefix, status, availability);

    if (!availability[openBlock] || (status === 'running' && openBlock === 'form')) {
      openBlock = getDefaultSoloOpenBlock(prefix, status, availability);
    }

    flowRoot.dataset.soloOpenBlock = openBlock;

    SOLO_BLOCK_IDS.forEach((blockId) => {
      const section = flowRoot.querySelector(`[data-solo-block="${blockId}"]`);
      const header = flowRoot.querySelector(`[data-solo-toggle="${blockId}"]`);
      const body = flowRoot.querySelector(`[data-solo-body="${blockId}"]`);
      const meta = flowRoot.querySelector(`[data-solo-meta="${blockId}"]`);
      const state = flowRoot.querySelector(`[data-solo-state="${blockId}"]`);
      const isOpen = blockId === openBlock;
      const isAvailable = availability[blockId];

      if (!section || !header || !body || !meta || !state) return;

      section.classList.toggle('is-open', isOpen);
      section.classList.toggle('is-unavailable', !isAvailable);
      header.classList.toggle('is-unavailable', !isAvailable);
      header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      header.setAttribute('aria-disabled', isAvailable ? 'false' : 'true');
      body.hidden = !isOpen;
      meta.textContent = getSoloBlockMeta(prefix, blockId, status);
      state.textContent = getSoloBlockStateLabel(prefix, blockId, status, isOpen, availability);
    });
  }

  function setSoloFlowState(prefix, status, openBlock = '') {
    const flowRoot = getSoloFlowRoot(prefix);
    if (!flowRoot) return;

    flowRoot.dataset.soloStatus = status;
    if (openBlock) flowRoot.dataset.soloOpenBlock = openBlock;
    refreshSoloFlow(prefix);
  }

  function setSoloFlowOpenBlock(prefix, blockId) {
    const flowRoot = getSoloFlowRoot(prefix);
    if (!flowRoot) return;

    const status = flowRoot.dataset.soloStatus || 'editing';
    if (status === 'running' && blockId === 'form') return;

    flowRoot.dataset.soloOpenBlock = blockId;
    refreshSoloFlow(prefix);
  }

  function bindSoloFlow(prefix) {
    const flowRoot = getSoloFlowRoot(prefix);
    if (!flowRoot || flowRoot.dataset.soloBound === 'true') return;

    flowRoot.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-solo-toggle]');
      if (!toggle) return;

      const blockId = toggle.dataset.soloToggle;
      const status = flowRoot.dataset.soloStatus || 'editing';
      const availability = getSoloBlockAvailability(prefix, status);

      if (!availability[blockId]) return;
      if (status === 'running' && blockId === 'form') return;

      setSoloFlowOpenBlock(prefix, blockId);
    });

    const observerTargets = [
      document.getElementById(`finalOutput-${prefix}`),
      document.getElementById(`socialSection-${prefix}`),
      document.getElementById(`socialOutput-${prefix}`),
      document.getElementById(`reseauxOnlySection-${prefix}`),
    ].filter(Boolean);

    observerTargets.forEach((target) => {
      const observer = new MutationObserver(() => {
        refreshSoloFlow(prefix);
      });

      observer.observe(target, { attributes: true, attributeFilter: ['class', 'style'] });
    });

    flowRoot.dataset.soloBound = 'true';
  }

  function initSoloFlows() {
    ['tt', 'col'].forEach((prefix) => {
      bindSoloFlow(prefix);
      refreshSoloFlow(prefix);
    });
  }

  // Entrée depuis la home vers un flow unitaire.
  // Objectif stepper : afficher uniquement le formulaire tant que le pipeline
  // n'a pas été lancé, même si certains panneaux ont gardé un état visible.
  function resetSingleFlowPanels(mode) {
    const suffix = mode === 'collection' ? 'col' : 'tt';

    ['finalOutput', 'socialSection', 'socialOutput', 'reseauxOnlySection'].forEach((prefix) => {
      const element = document.getElementById(`${prefix}-${suffix}`);
      if (element) element.style.display = 'none';
    });

    setPipelineExecutionActive(false);
    setSoloFlowState(suffix, 'editing', 'form');
    syncHeaderBackAction();
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

    initSoloFlows();
    resetSingleFlowPanels(mode);
    showView('form');
    global.refreshCollectionStepper?.();
    refreshSoloFlow(getSoloPrefix(mode));
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
    syncHeaderBackAction,
    buildPipelineTimeline,
    updatePipelineTimeline,
    openSettings,
    closeSettings,
    initSoloFlows,
    refreshSoloFlow,
    setSoloFlowState,
    setSoloFlowOpenBlock,
    getCurrentView: () => currentView,
    getPendingBatchMode: () => pendingBatchMode,
  };

  initSoloFlows();

  global.PipelineUI.app = global.PipelineUI.app || {};
  Object.assign(global.PipelineUI.app, global.PipelineUIApp);
  Object.assign(global, global.PipelineUIApp);
})(window);
