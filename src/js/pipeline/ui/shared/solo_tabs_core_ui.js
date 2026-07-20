'use strict';

(function initPipelineUISoloTabsCore(global) {

// Core partagé des onglets solo Tabletop / Collection.
// Mutualise les états, les badges et la logique d'activation sans changer les
// sélecteurs ni les spécificités DOM propres à chaque mode.
  global.PipelineUI = global.PipelineUI || {};
  const sharedConstants = global.PipelineUISharedConstants || {};
  const PIPELINE_RUN_STATUS = sharedConstants.PIPELINE_RUN_STATUS || {
    ERROR: 'erreur',
    STOPPED: 'interrompu',
  };
  const PIPELINE_AGENT_STATUS_TEXT = sharedConstants.PIPELINE_AGENT_STATUS_TEXT || {
    GENERATING: 'generation...',
    SELECTION_REQUIRED: 'selection requise',
    STOPPED: 'stoppe',
    ERROR: 'erreur',
    DONE: 'done',
  };
  const PIPELINE_PREFIXES = sharedConstants.PIPELINE_PREFIXES || {
    COLLECTION: 'col',
  };

  const TAB_IDS = ['form', 'pipeline', 'result', 'social', 'etsy', 'translation', 'audit'];
  const TAB_STATE_CLASSNAMES = [
    'is-state-idle',
    'is-state-running',
    'is-state-paused',
    'is-state-error',
    'is-state-done',
    'is-state-available',
    'is-state-generated',
    'is-state-locked',
    'is-state-stopped',
  ];

  const createSoloTabsController = (options = {}) => {
    const {
      tabIds = TAB_IDS,
      pipelinePrefix = '',
      getRoot = () => null,
      getTabButton = () => null,
      getTabState = () => null,
      getTabPanel = () => null,
      getStatusBox = () => null,
      getStatusText = () => null,
      getLaunchState = () => null,
      getDisplayName = () => 'Nouvelle fiche',
      getAgentStatusEntries = () => [],
      hasPipelinePanel = () => false,
      hasResultPanel = () => false,
      hasSocialOutput = () => false,
      hasSocialPanel = () => false,
      hasEtsyPanel = () => false,
      hasTranslationPanel = () => false,
      hasAuditPanel = () => false,
      onActiveTabChange = null,
      nameFieldIds = [],
    } = options;

    let activeTabId = 'form';
    let isBound = false;

    const getLaunchStatus = () => String(getLaunchState()?.lastStatus || '').trim().toLowerCase();

    const isPipelineRunning = () => {
      const launchState = getLaunchState();
      if (launchState) return Boolean(launchState.isRunning);
      return Boolean(global.isPipelineExecutionActive?.());
    };

    const hasPipelineError = () => {
      const launchStatus = getLaunchStatus();
      if (launchStatus) return launchStatus.includes(PIPELINE_RUN_STATUS.ERROR);
      return getAgentStatusEntries().some(({ text }) => text.includes(PIPELINE_AGENT_STATUS_TEXT.ERROR) || text.includes('alerte'));
    };

    const hasPipelinePause = () => {
      const launchStatus = getLaunchStatus();
      if (launchStatus) return launchStatus.includes('en pause');
      if (isPipelineRunning()) return false;
      return getAgentStatusEntries().some(({ text }) => text.includes('sélection requise'));
    };

    const hasPipelineStopped = () => {
      const launchStatus = getLaunchStatus();
      if (launchStatus) return launchStatus.includes(PIPELINE_RUN_STATUS.STOPPED) || launchStatus.includes('stopp');
      if (isPipelineRunning()) return false;
      return getAgentStatusEntries().some(({ text }) => text.includes('stoppé'));
    };

    const getPipelineProgress = () => {
      const statuses = getAgentStatusEntries();
      const total = statuses.length;
      if (!total) return { current: 0, total: 0 };

      const activeIndex = statuses.findIndex(({ text }) => text.includes('génération') || text.includes('audit') || text.includes('relance'));
      const pauseIndex = statuses.findIndex(({ text }) => text.includes('sélection requise'));
      const errorIndex = statuses.findIndex(({ text }) => text.includes(PIPELINE_AGENT_STATUS_TEXT.ERROR) || text.includes('alerte'));
      const stoppedIndex = statuses.findIndex(({ text }) => text.includes('stoppé'));
      const doneCount = statuses.filter(({ text }) => text.includes(PIPELINE_AGENT_STATUS_TEXT.DONE)).length;

      if (activeIndex !== -1) return { current: Math.max(doneCount + 1, activeIndex + 1), total };
      if (pauseIndex !== -1) return { current: Math.max(doneCount, pauseIndex + 1), total };
      if (errorIndex !== -1) return { current: Math.max(doneCount, errorIndex + 1), total };
      if (stoppedIndex !== -1) return { current: Math.max(doneCount, stoppedIndex + 1), total };
      if (hasResultPanel()) return { current: total, total };
      return { current: doneCount, total };
    };

    const getPipelineState = () => {
      if (!hasPipelinePanel()) return { code: 'idle', label: 'À lancer' };
      if (hasPipelineError()) return { code: 'error', label: 'Erreur' };
      if (hasPipelinePause()) return { code: 'paused', label: 'En pause' };
      if (hasPipelineStopped()) return { code: 'stopped', label: 'Interrompu' };
      if (isPipelineRunning()) {
        const progress = getPipelineProgress();
        const suffix = progress.total ? ` · ${progress.current}/${progress.total}` : '';
        return { code: 'running', label: `En cours${suffix}` };
      }
      if (hasResultPanel()) return { code: 'done', label: 'Terminé' };
      return { code: 'available', label: 'Prêt' };
    };

    const getTabPresentation = (tabId) => {
      if (tabId === 'form') {
        return isPipelineRunning()
          ? { label: 'Édition verrouillée', code: 'locked' }
          : { label: 'Prêt', code: 'idle' };
      }

      if (tabId === 'pipeline') return getPipelineState();
      if (tabId === 'result') {
        return hasResultPanel()
          ? { label: 'Disponible', code: 'available' }
          : { label: 'Indispo', code: 'idle' };
      }
      if (tabId === 'social') {
        if (hasSocialOutput()) return { label: 'Généré', code: 'generated' };
        return hasSocialPanel()
          ? { label: 'Disponible', code: 'available' }
          : { label: 'Indispo', code: 'idle' };
      }
      if (tabId === 'etsy') {
        return hasEtsyPanel()
          ? { label: 'Disponible', code: 'available' }
          : { label: 'Indispo', code: 'idle' };
      }
      if (tabId === 'translation') {
        return hasTranslationPanel()
          ? { label: 'Disponible', code: 'available' }
          : { label: 'Indispo', code: 'idle' };
      }
      if (tabId === 'audit') {
        return hasAuditPanel()
          ? { label: 'Disponible', code: 'available' }
          : { label: 'Indispo', code: 'idle' };
      }

      return { label: '', code: 'idle' };
    };

    const isTabEnabled = (tabId) => {
      if (tabId === 'form') return !isPipelineRunning();
      if (tabId === 'pipeline') return hasPipelinePanel();
      if (tabId === 'result') return hasResultPanel();
      if (tabId === 'social') return hasSocialPanel();
      if (tabId === 'etsy') return hasEtsyPanel();
      if (tabId === 'translation') return hasTranslationPanel();
      if (tabId === 'audit') return hasAuditPanel();
      return false;
    };

    const getFallbackTab = () => {
      if (isPipelineRunning() || hasPipelinePause() || hasPipelineError() || hasPipelineStopped()) return 'pipeline';
      if (hasResultPanel()) return 'result';
      return 'form';
    };

    const applyFormPanelState = () => {
      const formPanel = getTabPanel('form');
      if (!formPanel) return;
      formPanel.classList.toggle('is-locked', isPipelineRunning());
    };

    const applyStateClasses = (element, stateCode) => {
      if (!element) return;
      TAB_STATE_CLASSNAMES.forEach((className) => element.classList.remove(className));
      if (stateCode) element.classList.add(`is-state-${stateCode}`);
    };

    const renderStatusLine = () => {
      const statusBox = getStatusBox();
      const statusText = getStatusText();
      if (!statusBox || !statusText) return;

      const displayName = getDisplayName();
      const pipelineState = getPipelineState();
      let text = `${displayName} · Formulaire prêt`;
      let stateCode = 'idle';

      if (hasPipelineError()) {
        text = `${displayName} · Erreur`;
        stateCode = 'error';
      } else if (hasPipelinePause()) {
        text = `${displayName} · En pause · choix requis`;
        stateCode = 'paused';
      } else if (hasPipelineStopped()) {
        text = `${displayName} · Interrompu`;
        stateCode = 'stopped';
      } else if (isPipelineRunning()) {
        text = `${displayName} · Pipeline ${pipelineState.label.toLowerCase()}`;
        stateCode = 'running';
      } else if (hasResultPanel()) {
        text = `${displayName} · Terminé`;
        stateCode = 'done';
      } else if (hasPipelinePanel()) {
        text = `${displayName} · Pipeline prêt`;
        stateCode = 'available';
      }

      statusText.textContent = text;
      applyStateClasses(statusBox, stateCode);
    };

    const render = () => {
      const root = getRoot();
      if (!root) return;

      if (!tabIds.includes(activeTabId) || (activeTabId !== 'form' && !isTabEnabled(activeTabId))) {
        activeTabId = getFallbackTab();
      }

      tabIds.forEach((tabId) => {
        const button = getTabButton(tabId);
        const state = getTabState(tabId);
        const panel = getTabPanel(tabId);
        const isActive = tabId === activeTabId;
        const isEnabled = isActive ? true : isTabEnabled(tabId);
        const presentation = getTabPresentation(tabId);

        if (button) {
          button.classList.toggle('is-active', isActive);
          button.classList.toggle('is-disabled', !isEnabled);
          button.classList.toggle('is-locked', tabId === 'form' && isPipelineRunning());
          button.disabled = !isEnabled;
          button.setAttribute('aria-selected', isActive ? 'true' : 'false');
          applyStateClasses(button, presentation.code);
        }

        if (state) {
          state.textContent = presentation.label;
          applyStateClasses(state, presentation.code);
        }

        if (panel) {
          panel.hidden = !isActive;
          panel.classList.toggle('is-active', isActive);
        }

        if (isActive) {
          onActiveTabChange?.({ tabId, pipelinePrefix });
        }
      });

      applyFormPanelState();
      renderStatusLine();
    };

    const activate = (tabId, options = {}) => {
      const { force = false } = options;
      if (!tabIds.includes(tabId)) return;
      if (!force && !isTabEnabled(tabId)) return;
      activeTabId = tabId;
      render();
    };

    const refresh = () => {
      render();
    };

    const reset = () => {
      activeTabId = 'form';
      render();
    };

    const bindEvents = () => {
      const root = getRoot();
      if (!root || isBound) return;

      root.addEventListener('click', (event) => {
        const button = event.target.closest(`[data-${pipelinePrefix === PIPELINE_PREFIXES.COLLECTION ? 'collection' : 'dnd'}-tab]`);
        if (!button) return;

        const tabId = pipelinePrefix === PIPELINE_PREFIXES.COLLECTION
          ? button.dataset.collectionTab
          : button.dataset.dndTab;
        activate(tabId);
      });

      nameFieldIds.forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        field?.addEventListener('input', refresh);
      });

      isBound = true;
    };

    const init = () => {
      if (!getRoot()) return;
      bindEvents();
      render();
    };

    return {
      init,
      refresh,
      activate,
      reset,
      isResultAvailable: () => hasResultPanel(),
    };
  };

  global.PipelineUISoloTabsCore = {
    TAB_IDS,
    TAB_STATE_CLASSNAMES,
    createSoloTabsController,
  };

  global.PipelineUI.soloTabsCore = global.PipelineUI.soloTabsCore || {};
  Object.assign(global.PipelineUI.soloTabsCore, global.PipelineUISoloTabsCore);
})(window);
