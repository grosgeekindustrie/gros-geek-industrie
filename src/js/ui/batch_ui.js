(function initPipelineUIBatch(global) {
  // Compatibilité batch temporaire.
  // Objectif du step courant : retirer toute la logique métier batch côté JS
  // sans toucher à l'UI HTML/CSS, qui reste visible comme repère.
  global.PipelineUI = global.PipelineUI || {};

  const BATCH_DISABLED_MESSAGE =
    "Le batch est temporairement désactivé pendant la refonte. Utilise le mode solo Collection ou Tabletop.";

  const getElement = (id) => document.getElementById(id);

  const notifyBatchDisabled = () => {
    if (typeof global.showToast === 'function') {
      global.showToast(BATCH_DISABLED_MESSAGE, '#ff9f43', 5000);
      return;
    }

    console.warn(`[batch] ${BATCH_DISABLED_MESSAGE}`);
  };

  const resetBatchUiState = () => {
    getElement('batchWrapper')?.classList.remove('is-running');
    getElement('batchExportBtn')?.classList.remove('visible');
    getElement('batchProgress')?.classList.remove('visible');
    document
      .querySelector('[data-js="batch-current-pipeline"]')
      ?.classList.add('is-hidden');
    document
      .querySelector('[data-js="batch-selection"]')
      ?.classList.add('is-hidden');
  };

  const createPlaceholderCard = (message = BATCH_DISABLED_MESSAGE) => {
    const host = document.createElement('div');
    host.className = 'batch-fiche';
    host.innerHTML = `
      <div class="batch-fiche-inner">
        <strong>Batch désactivé</strong>
        <p>${message}</p>
      </div>
    `;

    return host;
  };

  const preventBatchRuntime = () => {
    resetBatchUiState();
    notifyBatchDisabled();
    return false;
  };

  const showBatchCountPicker = () => preventBatchRuntime();
  const initBatchInline = () => preventBatchRuntime();

  const openBatchModal = () => {
    getElement('batchModal')?.classList.add('visible');
  };

  const closeBatchModal = () => {
    getElement('batchModal')?.classList.remove('visible');
  };

  const initBatch = () => {
    closeBatchModal();
    return preventBatchRuntime();
  };

  const buildBatchFiche = () => createPlaceholderCard();
  const batchToggleEch = () => false;
  const batchAddImages = () => preventBatchRuntime();
  const isBatchRunning = () => false;
  const stopBatch = () => {
    resetBatchUiState();
    return false;
  };
  const startBatch = () => preventBatchRuntime();
  const updateBatchProgress = () => false;
  const getBatchCtx = () => null;
  const runBatchFiche = async () => false;
  const runBatchAgent = async () => false;
  const exportBatch = async () => preventBatchRuntime();

  global.PipelineUIBatch = {
    showBatchCountPicker,
    initBatchInline,
    openBatchModal,
    closeBatchModal,
    initBatch,
    buildBatchFiche,
    batchToggleEch,
    batchAddImages,
    isBatchRunning,
    stopBatch,
    startBatch,
    updateBatchProgress,
    getBatchCtx,
    runBatchFiche,
    runBatchAgent,
    exportBatch,
  };

  global.PipelineUI.batch = global.PipelineUI.batch || {};
  Object.assign(global.PipelineUI.batch, global.PipelineUIBatch);
  Object.assign(global, global.PipelineUIBatch);
})(window);
