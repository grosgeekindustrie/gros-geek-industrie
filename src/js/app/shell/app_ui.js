(function initPipelineUIApp(global) {

// Couche application transverse.
// Navigation des vues, toasts, header context, settings panel et actions globales.
// À garder orienté shell / UX, sans réembarquer le coeur pipeline.
  global.PipelineUI = global.PipelineUI || {};
  const sharedConstants = global.PipelineUISharedConstants || {};
  const dom = global.PipelineUIDom || {};
  const PIPELINE_MODES = sharedConstants.PIPELINE_MODES || {
    TABLETOP: 'tabletop',
    COLLECTION: 'collection',
  };
  const PIPELINE_TIMELINE_STATUS = sharedConstants.PIPELINE_TIMELINE_STATUS || {
    WAIT: 'wait',
  };
  const STORAGE_KEYS = sharedConstants.STORAGE_KEYS || {
    APP_SETTINGS: 'pipeline.settings',
  };

  const getState = () => global.state;
  const getCurrentMode = () => global.currentMode;
  const getPfx = () => global.pfx();
  const getAgents = () => global.getPipelineAgents();
  const getModeUiConfig = (mode = getCurrentMode()) => global.getPipelineUiConfig(mode);
  const getModes = () => global.getPipelineModes();

  const callModeUiMethod = (mode, section, action, ...args) => {
    const methodName = getModeUiConfig(mode)[section][`${action}Method`];
    return global[methodName](...args);
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
  let uiActionDelegationBound = false;

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
  const APP_SETTINGS_STORAGE_KEY = STORAGE_KEYS.APP_SETTINGS;

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
    global.handlePipelineActionRequest(buildPipelineActionRequest(trigger));
  };

  const bindPipelineActionDelegation = () => {
    if (pipelineActionDelegationBound) return;

    document.addEventListener('click', handleDelegatedPipelineActionClick);
    pipelineActionDelegationBound = true;
  };

  const readActionArgs = (trigger) => ([
    trigger.dataset.actionArg,
    trigger.dataset.actionArg2,
    trigger.dataset.actionArg3,
  ].filter((value) => typeof value !== 'undefined'));

  const getUiActionHandlers = () => ({
    'cancel-to-home': () => cancelToHome(),
    'copy-token-report': () => global.copyTokenReport?.(),
    'copy-cache-debug-report': () => global.copyCacheDebugReport?.(),
    'open-settings': () => openSettings(),
    'close-settings': () => closeSettings(),
    'open-biblio-from-settings': () => {
      global.openBiblioLightbox?.();
      closeSettings();
    },
    'copy-token-report-from-settings': () => {
      global.copyTokenReport?.();
      closeSettings();
    },
    'clear-storage': () => clearAllStorage(),
    'select-mode': (mode) => selectMode(mode),
    'open-prompt-lightbox': (agentId) => global.openPromptLightbox?.(agentId),
    'copy-section': (key) => global.copySection?.(key),
    'copy-all-outputs': () => global.copyAllOutputs?.(),
    'export-final-outputs': (prefix) => global.exportFinalOutputs?.(prefix),
    'copy-all-final': () => global.copyAll?.(),
    'toggle-reseaux-only': (prefix) => global.toggleReseauxOnly?.(prefix),
    'run-leo-agent': (prefix) => global.runLeoAgent?.(prefix),
    'run-camille-agent': (prefix) => global.runCamilleAgent?.(prefix),
    'run-reseaux-only': (type, prefix) => global.runReseauxOnly?.(type, prefix),
    'copy-social': () => global.copySocial?.(),
    'copy-social-section': (sectionId) => global.copySocialSection?.(sectionId),
    'open-biblio-lightbox': () => global.openBiblioLightbox?.(),
    'close-biblio-lightbox': () => global.closeBiblioLightbox?.(),
    'switch-biblio-tab': (tabId) => global.switchBiblioTab?.(tabId),
    'save-biblio': () => global.saveBiblio?.(),
    'reset-biblio': () => global.resetBiblio?.(),
    'close-prompt-lightbox': () => global.closePromptLightbox?.(),
    'save-prompt-lightbox': () => global.saveLbPrompt?.(),
    'reset-prompt-lightbox': () => global.resetLbPrompt?.(),
    'close-raw-input': () => closeRawInput(),
    'copy-raw-input': () => copyRawInput(),
    'close-explorer': () => global.closeExplorer?.(),
    'run-iris': (prefix) => (
      prefix === 'col'
        ? global.runCollectionIrisSemanticSearch?.()
        : global.runTabletopIrisSemanticSearch?.()
    ),
    'fetch-personnage': () => global.fetchPersonnage?.(),
  });

  const getUiChangeHandlers = () => ({
    'toggle-dynamic-echelles': (prefix) => global.toggleDynamicEchelles?.(prefix),
    'toggle-buzz': (prefix) => global.toggleBuzz?.(prefix),
    'toggle-buzz-collection': () => global.toggleBuzzCollection?.(),
    'toggle-license': () => global.toggleLicense?.(),
  });

  const readAppSettings = () => {
    try {
      return JSON.parse(localStorage.getItem(APP_SETTINGS_STORAGE_KEY) || '{}');
    } catch (_error) {
      return {};
    }
  };

  const writeAppSettings = (nextSettings) => {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  };

  const handleDelegatedUiActionClick = (event) => {
    const overlay = dom.getClosestByData?.(event.target, 'overlayClose');
    if (overlay && event.target === overlay) {
      const closeAction = overlay.dataset.overlayClose;
      getUiActionHandlers()[closeAction]?.();
      return;
    }

    const trigger = dom.getClosestByData?.(event.target, 'uiAction');
    if (!trigger || trigger.disabled) return;

    event.preventDefault();
    const action = String(trigger.dataset.uiAction || '').trim();
    const handler = getUiActionHandlers()[action];
    if (!handler) return;
    handler(...readActionArgs(trigger));
  };

  const handleDelegatedUiActionChange = (event) => {
    const trigger = dom.getClosestByData?.(event.target, 'uiChange');
    if (!trigger || trigger !== event.target) return;

    const action = String(trigger.dataset.uiChange || '').trim();
    const handler = getUiChangeHandlers()[action];
    if (!handler) return;
    handler(...readActionArgs(trigger));
  };

  const bindUiActionDelegation = () => {
    if (uiActionDelegationBound) return;

    document.addEventListener('click', handleDelegatedUiActionClick);
    document.addEventListener('change', handleDelegatedUiActionChange);
    uiActionDelegationBound = true;
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
    if (typeof global.refreshPipelineLaunchPanels === 'function') {
      global.refreshPipelineLaunchPanels();
    }
  }

  function setPipelineExecutionActive(isActive) {
    pipelineExecutionActive = !!isActive;
    syncHeaderBackAction();
    getModes().forEach((mode) => refreshModeTabs(mode));
    refreshPipelineLaunchPanels();
  }
  function syncHeaderBackAction() {
    const backBtn = dom.getByData?.('js', 'app-back-btn') || document.getElementById('appBackBtn');
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
    const existing = dom.getAllByData?.('js', 'toast-item') || document.querySelectorAll('.toast-item');
    const offset = 20 + existing.length * 56;
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.dataset.js = 'toast-item';
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
      (dom.getAllByData?.('js', 'toast-item') || document.querySelectorAll('.toast-item')).forEach((el, i) => {
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
    getAgents().forEach((agent) => global.refreshRules(agent.id));
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
    (dom.getByData?.('js', 'raw-input-title') || document.getElementById('rawInputTitle')).textContent = `</> INPUT - ${label}`;
    (dom.getByData?.('js', 'raw-input-textarea') || document.getElementById('rawInputTextarea')).value = raw;
    (dom.getByData?.('js', 'raw-input-count') || document.getElementById('rawInputCount')).textContent = `${raw.length.toLocaleString()} car.`;
    (dom.getByData?.('js', 'raw-input-lightbox') || document.getElementById('rawInputLightbox')).classList.add('visible');
  }

  function closeRawInput() {
    (dom.getByData?.('js', 'raw-input-lightbox') || document.getElementById('rawInputLightbox')).classList.remove('visible');
  }

  function copyRawInput() {
    navigator.clipboard.writeText((dom.getByData?.('js', 'raw-input-textarea') || document.getElementById('rawInputTextarea')).value);
    showToast(RAW_INPUT_COPIED_MESSAGE);
  }

  function showView(name) {
    currentView = name;
    (dom.getAllByData?.('js', 'view') || document.querySelectorAll('.view')).forEach((view) => view.classList.remove('active'));

    const view = dom.getByData?.('view', name) || document.getElementById(`view-${name}`);
    if (view) view.classList.add('active');

    updateHeaderContext(name);
    syncHeaderBackAction();

    if (name !== 'pipeline') {
      const settings = readAppSettings();
      settings.view = name;
      writeAppSettings(settings);
    }
  }

  function updateHeaderContext(viewName) {
    const ctx = dom.getByData?.('js', 'header-context') || document.getElementById('headerContext');
    if (!ctx) return;

    ctx.className = 'app-context';
    if (viewName === 'home') {
      ctx.textContent = HOME_HEADER_CONTEXT;
    } else if (viewName === 'form') {
      const label = (dom.getByData?.('js', 'form-mode-label') || document.getElementById('formModeLabel'))?.textContent || '';
      ctx.textContent = label;
      ctx.classList.add(getCurrentMode() === PIPELINE_MODES.TABLETOP ? 'mode-tt' : 'mode-col');
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
    if (mode !== getCurrentMode()) global.switchMode(mode);

    const modeUiConfig = getModeUiConfig(mode);
    const tabletopUiConfig = getModeUiConfig(PIPELINE_MODES.TABLETOP);
    const collectionUiConfig = getModeUiConfig(PIPELINE_MODES.COLLECTION);
    const label = dom.getByData?.('js', 'form-mode-label') || document.getElementById('formModeLabel');
    const tabletopRoot = document.getElementById(tabletopUiConfig.uiRootId);
    const collectionRoot = document.getElementById(collectionUiConfig.uiRootId);

    if (tabletopRoot) tabletopRoot.style.display = mode === PIPELINE_MODES.TABLETOP ? '' : 'none';
    if (collectionRoot) collectionRoot.style.display = mode === PIPELINE_MODES.COLLECTION ? '' : 'none';
    if (label) label.textContent = modeUiConfig.formLabel;

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
    const timeline = dom.getByData?.('js', 'pipeline-timeline') || document.getElementById('pipelineTimeline');
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
    if (getCurrentMode() === PIPELINE_MODES.COLLECTION && currentView !== 'pipeline') return;

    const timeline = dom.getByData?.('js', 'pipeline-timeline') || document.getElementById('pipelineTimeline');
    if (!timeline) return;

    const agents = getAgents();
    const meta = metaLabel
      ? `<span class="pipeline-step active"><span class="pipeline-step-label">${metaLabel}</span></span><span class="pipeline-step-sep">${PIPELINE_META_SEPARATOR}</span>`
      : '';

    timeline.innerHTML = meta + agents.map((agent, i) =>
      (i > 0 ? `<span class="pipeline-step-sep">${PIPELINE_STEP_SEPARATOR}</span>` : '') +
      `<span class="pipeline-step" id="tl-step-${agent.id}" data-timeline-step="${agent.id}">` +
      `<span class="pipeline-step-dot" id="tl-dot-${agent.id}" data-timeline-dot="${agent.id}"></span>` +
      `<span class="pipeline-step-label">${agent.title.replace(AGENT_TITLE_PREFIX_PATTERN, '').split(AGENT_TITLE_PART_SEPARATOR)[0].replace(AGENT_TITLE_EMOJI_PATTERN, '').trim()}</span>` +
      '</span>'
    ).join('');
  }

  function updatePipelineTimeline(agentId, status) {
    if (getCurrentMode() === PIPELINE_MODES.COLLECTION && currentView !== 'pipeline') return;

    const timeline = dom.getByData?.('js', 'pipeline-timeline') || document.getElementById('pipelineTimeline');
    const dot = dom.getByData?.('timelineDot', agentId, timeline) || document.getElementById(`tl-dot-${agentId}`);
    const step = dom.getByData?.('timelineStep', agentId, timeline) || document.getElementById(`tl-step-${agentId}`);
    if (!dot || !step) return;

    dot.className = `pipeline-step-dot${status !== PIPELINE_TIMELINE_STATUS.WAIT ? ` ${status}` : ''}`;
    step.className = `pipeline-step${status !== PIPELINE_TIMELINE_STATUS.WAIT ? ` ${status}` : ''}`;
  }

  function openSettings() {
    (dom.getByData?.('js', 'settings-overlay') || document.getElementById('settingsOverlay')).classList.add('visible');
    (dom.getByData?.('js', 'settings-panel') || document.getElementById('settingsPanel')).classList.add('visible');
  }

  function closeSettings() {
    (dom.getByData?.('js', 'settings-overlay') || document.getElementById('settingsOverlay')).classList.remove('visible');
    (dom.getByData?.('js', 'settings-panel') || document.getElementById('settingsPanel')).classList.remove('visible');

    const apiKey = (dom.getByData?.('js', 'api-key-input') || document.getElementById('apiKey'))?.value;
    if (!apiKey) return;

    const settings = readAppSettings();
    settings.apiKey = apiKey;
    writeAppSettings(settings);
  }


  bindPipelineActionDelegation();
  bindUiActionDelegation();

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
    bindUiActionDelegation,
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
