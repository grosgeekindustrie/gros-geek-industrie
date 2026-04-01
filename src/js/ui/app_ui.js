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

    const backBtn = document.getElementById('appBackBtn');
    if (backBtn) {
      const isHome = name === 'home';
      backBtn.style.display = isHome ? 'none' : '';
      backBtn.classList.toggle('is-hidden', isHome);
    }

    updateHeaderContext(name);

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

    document.getElementById('btnStopGlobal')?.classList.remove('visible');
    document.getElementById('btnNewFiche')?.classList.remove('visible');
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
  }

  function selectModeBatch(mode) {
    pendingBatchMode = mode;
    global._pendingBatchMode = mode;
    const modalTitle = document.querySelector('#batchModal h2');
    if (modalTitle) modalTitle.textContent = mode === 'tabletop' ? '⚡ Batch Tabletop' : '⚡ Batch Collection';
    global.openBatchModal?.();
  }

  function cancelToHome() {
    const batchWrapper = document.getElementById('batchWrapper');
    if (batchWrapper && batchWrapper.parentNode && batchWrapper.parentNode.id === 'formViewBody') {
      document.body.appendChild(batchWrapper);
      batchWrapper.classList.remove('visible');
    }
    showView('home');
  }

  function backToForm() {
    const p = getPfx();
    document.getElementById(`pipeline-${p}`).style.display = 'none';
    document.getElementById(`finalOutput-${p}`).style.display = 'none';

    const btn = document.getElementById(`runBtn-${p}`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '▶ Lancer le pipeline';
    }

    document.getElementById('btnNewFiche').classList.remove('visible');
    document.getElementById('btnStopGlobal').classList.remove('visible');
    showView('form');
  }

  function stopAllAgents() {
    const agents = getAgents();
    const controllers = global.abortControllers || {};
    agents.forEach((agent) => {
      const controller = controllers[agent.id];
      if (controller) controller.abort();
    });
    showToast('⏹ Pipeline stoppé', '#ff4757');
    document.getElementById('btnStopGlobal').classList.remove('visible');
    document.getElementById('btnNewFiche').classList.add('visible');
  }

  function buildPipelineTimeline() {
    const timeline = document.getElementById('pipelineTimeline');
    if (!timeline) return;

    const agents = getAgents();
    timeline.innerHTML = agents.map((agent, i) =>
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
    cancelToHome,
    backToForm,
    stopAllAgents,
    buildPipelineTimeline,
    updatePipelineTimeline,
    openSettings,
    closeSettings,
    getCurrentView: () => currentView,
    getPendingBatchMode: () => pendingBatchMode,
  };

  global.PipelineUI.app = global.PipelineUI.app || {};
  Object.assign(global.PipelineUI.app, global.PipelineUIApp);
  Object.assign(global, global.PipelineUIApp);
})(window);
