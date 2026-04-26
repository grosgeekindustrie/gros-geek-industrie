(function initPipelineUIApp(global) {

// Couche application transverse.
// Navigation des vues, toasts, header context, settings panel et actions globales.
// À garder orienté shell / UX, sans réembarquer le coeur pipeline.
  global.PipelineUI = global.PipelineUI || {};

  const getState = () => global.state;
  const getCurrentMode = () => global.currentMode || 'tabletop';
  const getPfx = () => (typeof global.pfx === 'function' ? global.pfx() : (global.getPipelinePrefix?.(getCurrentMode()) || (getCurrentMode() === 'collection' ? 'col' : 'tt')));
  const getAgents = () => (typeof global.getPipelineAgents === 'function' ? global.getPipelineAgents() : []);
  const getModeUiConfig = (mode = getCurrentMode()) => global.getPipelineUiConfig?.(mode) || null;
  const getModes = () => global.getPipelineModes?.() || ['tabletop', 'collection'];

  const callModeUiMethod = (mode, section, action, ...args) => {
    const methodName = getModeUiConfig(mode)?.[section]?.[`${action}Method`];
    const method = methodName ? global[methodName] : null;
    if (typeof method !== 'function') return undefined;
    return method(...args);
  };

  const refreshModeStepper = (mode) => {
    callModeUiMethod(mode, 'stepper', 'refresh');
  };

  const refreshModeTabs = (mode) => {
    callModeUiMethod(mode, 'tabs', 'refresh');
  };

  const resetModeTabs = (mode) => {
    callModeUiMethod(mode, 'tabs', 'reset');
  };

  let currentView = 'home';
  let pipelineExecutionActive = false;
  let pipelineActionDelegationBound = false;

  const PIPELINE_ACTION_SELECTOR = '[data-pipeline-action]';
  const BACK_BUTTON_LABELS = {
    cancel: 'Annuler',
    back: 'Retour',
  };
  const BACK_BUTTON_TITLES = {
    cancel: 'Annuler execution et revenir a l accueil',
    back: 'Revenir a l accueil',
  };
  const TOAST_CLOSE_LABEL = 'x';
  const STORAGE_CLEAR_CONFIRM = 'Vider le cache local ?\n(regles persistantes, formulaire)';
  const STORAGE_CLEAR_SUCCESS = 'Cache vide - rechargement...';
  const RAW_INPUT_MISSING_MESSAGE = "Pas encore genere - lance d abord cet agent";
  const RAW_INPUT_COPIED_MESSAGE = 'Input copie';
  const HOME_HEADER_CONTEXT = 'Etsy Pipeline - Generation de fiches produit IA';
  const PIPELINE_RUNNING_CONTEXT = 'Pipeline en cours...';
  const FLOW_CANCELLED_MESSAGE = 'Execution annulee';
  const PIPELINE_STOPPED_MESSAGE = 'Pipeline stoppe';
  const PIPELINE_META_SEPARATOR = '&bull;';
  const PIPELINE_STEP_SEPARATOR = '&rsaquo;';
  const AGENT_TITLE_PREFIX_PATTERN = /^[^\u2014]+\u2014 /;
  const AGENT_TITLE_PART_SEPARATOR = ' \u00B7 ';
  const AGENT_TITLE_EMOJI_PATTERN = /[🔍🖼️📊🔖🏷️📝]/gu;

  const buildPipelineActionRequest = (trigger) => ({
    action: String(trigger.dataset.pipelineAction || '').trim(),
    prefix: String(trigger.dataset.pipelinePrefix || '').trim(),
    stepId: String(trigger.dataset.pipelineStep || '').trim(),
    agentId: String(trigger.dataset.pipelineAgent || '').trim(),
  });

  const handleDelegatedPipelineActionClick = (event) => {
    const trigger = event.target.closest(PIPELINE_ACTION_SELECTOR);
    if (!trigger || trigger.disabled) return;

    event.preventDefault();
    global.handlePipelineActionRequest?.(buildPipelineActionRequest(trigger));
  };

  const bindPipelineActionDelegation = () => {
    if (pipelineActionDelegationBound) return;

    document.addEventListener('click', handleDelegatedPipelineActionClick);
    pipelineActionDelegationBound = true;
  };

  function hasActiveAgentControllers() {
    return Object.values(global.abortControllers || {}).some((controller) => !!controller);
  }

  function isPipelineExecutionActive() {
    return !!(
      pipelineExecutionActive ||
      hasActiveAgentControllers()
    );
  }

  function refreshPipelineLaunchPanels() {
    global.refreshPipelineLaunchPanels?.();
  }

  function setPipelineExecutionActive(isActive) {
    pipelineExecutionActive = !!isActive;
    syncHeaderBackAction();
    getModes().forEach((mode) => refreshModeTabs(mode));
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
    backBtn.textContent = isExecuting ? BACK_BUTTON_LABELS.cancel : BACK_BUTTON_LABELS.back;
    backBtn.title = isExecuting
      ? BACK_BUTTON_TITLES.cancel
      : BACK_BUTTON_TITLES.back;
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
    close.textContent = TOAST_CLOSE_LABEL;
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
    if (!confirm(STORAGE_CLEAR_CONFIRM)) return;
    localStorage.clear();
    getState().persistentRules = {};
    getAgents().forEach((agent) => global.refreshRules?.(agent.id));
    showToast(STORAGE_CLEAR_SUCCESS);
    setTimeout(() => location.reload(), 800);
  }

  function showRawInput(agentId) {
    const raw = getState().inputs[agentId];
    if (!raw) {
      showToast(RAW_INPUT_MISSING_MESSAGE, '#e8c547');
      return;
    }

    const agent = getAgents().find((entry) => entry.id === agentId);
    const label = agent ? agent.title : agentId;
    document.getElementById('rawInputTitle').textContent = `</> INPUT - ${label}`;
    document.getElementById('rawInputTextarea').value = raw;
    document.getElementById('rawInputCount').textContent = `${raw.length.toLocaleString()} car.`;
    document.getElementById('rawInputLightbox').classList.add('visible');
  }

  function closeRawInput() {
    document.getElementById('rawInputLightbox').classList.remove('visible');
  }

  function copyRawInput() {
    navigator.clipboard.writeText(document.getElementById('rawInputTextarea').value);
    showToast(RAW_INPUT_COPIED_MESSAGE);
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
      ctx.textContent = HOME_HEADER_CONTEXT;
    } else if (viewName === 'form') {
      const label = document.getElementById('formModeLabel')?.textContent || '';
      ctx.textContent = label;
      ctx.classList.add(getCurrentMode() === 'tabletop' ? 'mode-tt' : 'mode-col');
    } else if (viewName === 'pipeline') {
      ctx.textContent = PIPELINE_RUNNING_CONTEXT;
      ctx.classList.add('mode-pipeline');
    }
  }

  // Entrée depuis la home vers un flow unitaire.
  // Objectif stepper : afficher uniquement le formulaire tant que le pipeline
  // n'a pas été lancé, même si certains panneaux ont gardé un état visible.
  function resetSingleFlowPanels(mode) {
    const modeUiConfig = getModeUiConfig(mode);
    const panelIds = modeUiConfig.panelIds;

    panelIds.forEach((panelId) => {
      const element = document.getElementById(panelId);
      if (element) element.style.display = 'none';
    });

    setPipelineExecutionActive(false);
    syncHeaderBackAction();
    resetModeTabs(mode);
    refreshModeTabs(mode);
    refreshPipelineLaunchPanels();
  }

  function selectMode(mode) {
    if (mode !== getCurrentMode()) global.switchMode?.(mode);

    const modeUiConfig = getModeUiConfig(mode);
    const tabletopUiConfig = getModeUiConfig('tabletop');
    const collectionUiConfig = getModeUiConfig('collection');
    const label = document.getElementById('formModeLabel');
    const tabletopRoot = document.getElementById(tabletopUiConfig?.uiRootId || 'ui-tt');
    const collectionRoot = document.getElementById(collectionUiConfig?.uiRootId || 'ui-col');

    if (tabletopRoot) tabletopRoot.style.display = mode === 'tabletop' ? '' : 'none';
    if (collectionRoot) collectionRoot.style.display = mode === 'collection' ? '' : 'none';
    if (label) label.textContent = modeUiConfig?.formLabel || (mode === 'tabletop' ? '🎲 Tabletop DnD' : '🖼️ Collection');

    resetSingleFlowPanels(mode);
    showView('form');
    getModes().forEach((knownMode) => {
      refreshModeStepper(knownMode);
      refreshModeTabs(knownMode);
    });
    refreshPipelineLaunchPanels();
  }


  function cancelToHome() {
    const executionRunning = isPipelineExecutionActive();
    if (executionRunning) {
      stopAllAgents({ silent: true });
      showToast(FLOW_CANCELLED_MESSAGE, '#ff4757');
      return;
    }
    const timeline = document.getElementById('pipelineTimeline');
    if (timeline) timeline.style.display = '';

    showView('home');
  }

  function stopAllAgents(options = {}) {
    const { silent = false } = options;

    const agents = getAgents();
    const controllers = global.abortControllers || {};
    agents.forEach((agent) => {
      const controller = controllers[agent.id];
      if (controller) controller.abort();
      delete controllers[agent.id];
    });
    if (!silent) showToast(PIPELINE_STOPPED_MESSAGE, '#ff4757');
    setPipelineExecutionActive(false);
    syncHeaderBackAction();
  }

  function buildPipelineTimeline(metaLabel = '') {
    if (getCurrentMode() === 'collection' && currentView !== 'pipeline') return;

    const timeline = document.getElementById('pipelineTimeline');
    if (!timeline) return;

    const agents = getAgents();
    const meta = metaLabel
      ? `<span class="pipeline-step active"><span class="pipeline-step-label">${metaLabel}</span></span><span class="pipeline-step-sep">${PIPELINE_META_SEPARATOR}</span>`
      : '';

    timeline.innerHTML = meta + agents.map((agent, i) =>
      (i > 0 ? `<span class="pipeline-step-sep">${PIPELINE_STEP_SEPARATOR}</span>` : '') +
      `<span class="pipeline-step" id="tl-step-${agent.id}">` +
      `<span class="pipeline-step-dot" id="tl-dot-${agent.id}"></span>` +
      `<span class="pipeline-step-label">${agent.title.replace(AGENT_TITLE_PREFIX_PATTERN, '').split(AGENT_TITLE_PART_SEPARATOR)[0].replace(AGENT_TITLE_EMOJI_PATTERN, '').trim()}</span>` +
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


  bindPipelineActionDelegation();

  global.PipelineUIApp = {
    showToast,
    clearAllStorage,
    showRawInput,
    closeRawInput,
    copyRawInput,
    showView,
    updateHeaderContext,
    selectMode,
    cancelToHome,
    stopAllAgents,
    setPipelineExecutionActive,
    isPipelineExecutionActive,
    syncHeaderBackAction,
    buildPipelineTimeline,
    updatePipelineTimeline,
    openSettings,
    closeSettings,
    bindPipelineActionDelegation,
    getCurrentView: () => currentView,
  };

  global.PipelineUI.app = global.PipelineUI.app || {};
  Object.assign(global.PipelineUI.app, global.PipelineUIApp);
  Object.assign(global, {
    showToast,
    clearAllStorage,
    showRawInput,
    closeRawInput,
    copyRawInput,
    showView,
    selectMode,
    cancelToHome,
    stopAllAgents,
    setPipelineExecutionActive,
    isPipelineExecutionActive,
    buildPipelineTimeline,
    updatePipelineTimeline,
    openSettings,
    closeSettings,
  });
})(window);
