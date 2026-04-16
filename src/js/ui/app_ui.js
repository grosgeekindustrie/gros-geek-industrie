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
  let pendingBatchMode = null;
  let pipelineExecutionActive = false;
  let pipelineActionDelegationBound = false;

  const PIPELINE_ACTION_SELECTOR = '[data-pipeline-action]';

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
    const modeUiConfig = getModeUiConfig(mode);
    const fallbackPrefix = mode === 'collection' ? 'col' : 'tt';
    const panelIds = modeUiConfig?.panelIds || [
      `pipeline-${fallbackPrefix}`,
      `finalOutput-${fallbackPrefix}`,
      `socialSection-${fallbackPrefix}`,
      `socialOutput-${fallbackPrefix}`,
      `reseauxOnlySection-${fallbackPrefix}`,
    ];

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
    if (mode === 'batch') {
      global.openBatchModal?.();
      return;
    }

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

  function selectModeBatch(mode) {
    pendingBatchMode = mode;
    global._pendingBatchMode = mode;
    const modalTitle = document.querySelector('#batchModal h2');
    if (modalTitle) {
      const modeUiConfig = getModeUiConfig(mode);
      modalTitle.textContent = modeUiConfig?.batchTitle || (mode === 'tabletop' ? '⚡ Batch Tabletop' : '⚡ Batch Collection');
    }
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

  const SETTINGS_STORAGE_KEY = 'pipeline.settings';
  const SETTINGS_DEFAULT_SHOP_URL = 'https://grosgeekindustrie.etsy.com';
  const SETTINGS_TRANSLATION_INPUT_SELECTOR = 'input[data-translation-language]';

  const readStoredSettings = () => {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  };

  const writeStoredSettings = (nextSettings = {}) => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    return nextSettings;
  };

  const getTranslationRuntime = () => global.PipelineUITranslationsRuntime || global.PipelineUI?.translationsRuntime || null;

  const getTranslationLanguageOptions = () => {
    const supportedLanguages = getTranslationRuntime()?.SUPPORTED_TRANSLATION_LANGUAGES || {};

    return Object.entries(supportedLanguages)
      .filter(([language]) => language !== 'fr')
      .map(([language, meta]) => ({
        language,
        label: String(meta?.label || language).trim(),
      }));
  };

  const getTranslationSettingsModeLabel = (mode = getCurrentMode()) => {
    if (mode === 'collection') return 'Mode Collection';
    if (mode === 'tabletop') return 'Mode DnD';
    return 'Mode courant';
  };

  const createTranslationLanguageOption = ({ language, label, isChecked }) => {
    const option = document.createElement('label');
    option.className = 'settings-language-option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = language;
    input.checked = isChecked;
    input.setAttribute('data-translation-language', language);

    const copy = document.createElement('span');
    copy.className = 'settings-language-copy';

    const code = document.createElement('span');
    code.className = 'settings-language-code';
    code.textContent = language.toUpperCase();

    const text = document.createElement('span');
    text.className = 'settings-language-label';
    text.textContent = label;

    copy.append(code, text);
    option.append(input, copy);
    return option;
  };

  const renderTranslationLanguageSettings = (mode = getCurrentMode()) => {
    const section = document.getElementById('translationSettingsSection');
    const group = document.getElementById('translationLanguagesGroup');
    const hint = document.getElementById('translationSettingsHint');

    if (!section || !group) return;

    const isSupportedMode = mode === 'tabletop' || mode === 'collection';
    section.hidden = !isSupportedMode;
    if (!isSupportedMode) return;

    const runtime = getTranslationRuntime();
    const enabledLanguages = runtime?.getEnabledTranslationLanguages?.(mode) || [];
    const options = getTranslationLanguageOptions();

    group.replaceChildren(...options.map((entry) => createTranslationLanguageOption({
      ...entry,
      isChecked: enabledLanguages.includes(entry.language),
    })));

    if (hint) {
      hint.textContent = `FR reste la source · ${getTranslationSettingsModeLabel(mode)}`;
    }
  };

  const getSelectedTranslationLanguages = () => {
    const group = document.getElementById('translationLanguagesGroup');
    if (!group) return [];

    return Array.from(group.querySelectorAll(SETTINGS_TRANSLATION_INPUT_SELECTOR))
      .filter((input) => input.checked)
      .map((input) => String(input.value || '').trim().toLowerCase())
      .filter(Boolean);
  };

  const loadSettingsPanelValues = (mode = getCurrentMode()) => {
    const settings = readStoredSettings();
    const apiKeyInput = document.getElementById('apiKey');
    const shopUrlInput = document.getElementById('shopUrl');

    if (apiKeyInput) {
      apiKeyInput.value = String(settings.apiKey || '').trim();
    }

    if (shopUrlInput) {
      shopUrlInput.value = String(settings.shopUrl || shopUrlInput.value || SETTINGS_DEFAULT_SHOP_URL).trim();
    }

    renderTranslationLanguageSettings(mode);
  };

  const persistSettingsPanelValues = (mode = getCurrentMode()) => {
    const settings = readStoredSettings();
    const apiKey = String(document.getElementById('apiKey')?.value || '').trim();
    const shopUrl = String(document.getElementById('shopUrl')?.value || '').trim();

    if (apiKey) {
      settings.apiKey = apiKey;
    }

    settings.shopUrl = shopUrl || SETTINGS_DEFAULT_SHOP_URL;
    settings.translationLanguagesByMode = settings.translationLanguagesByMode || {};
    settings.translationLanguagesByMode[mode] = getSelectedTranslationLanguages();
    writeStoredSettings(settings);
  };

  function openSettings() {
    loadSettingsPanelValues(getCurrentMode());
    document.getElementById('settingsOverlay').classList.add('visible');
    document.getElementById('settingsPanel').classList.add('visible');
  }

  function closeSettings() {
    persistSettingsPanelValues(getCurrentMode());
    document.getElementById('settingsOverlay').classList.remove('visible');
    document.getElementById('settingsPanel').classList.remove('visible');
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
    openSettings,
    closeSettings,
    bindPipelineActionDelegation,
    getCurrentView: () => currentView,
    getPendingBatchMode: () => pendingBatchMode,
  };

  global.PipelineUI.app = global.PipelineUI.app || {};
  Object.assign(global.PipelineUI.app, global.PipelineUIApp);
  Object.assign(global, global.PipelineUIApp);
})(window);
