'use strict';

(function initPipelineUIIrisRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};
  let irisOutputEditingBound = false;

  function getIrisRuntimeRefs(prefix = 'col') {
    return {
      button: document.getElementById(`runIrisBtn-${prefix}`),
      output: document.getElementById(`out-iris-${prefix}`),
    };
  }

  function syncIrisOutputState(prefix = 'col') {
    const refs = getIrisRuntimeRefs(prefix);
    if (!refs.output) return;
    global.state.outputs.iris = refs.output.textContent || '';
  }

  function bindIrisOutputEditing() {
    if (irisOutputEditingBound) return;
    irisOutputEditingBound = true;

    document.addEventListener('input', (event) => {
      const editor = event.target.closest?.('[data-iris-output-editor]');
      if (!editor) return;
      syncIrisOutputState(editor.dataset.prefix || 'col');
    });
  }

  function beginIrisSemanticSearch(prefix = 'col') {
    const refs = getIrisRuntimeRefs(prefix);

    if (refs.button) {
      refs.button.disabled = true;
      global.PipelineUIIcons?.setIconLabel?.(refs.button, 'refresh', 'Recherche...');
    }

    if (refs.output) {
      refs.output.classList.remove('empty');
      refs.output.textContent = '';
    }

    return refs;
  }

  function finalizeIrisSemanticSearch(prefix = 'col', refs = {}, response = null) {
    global.state.outputs.iris = response?.text || '';
    global.showAgentCost('iris', response?.usage || null, { prefix, source: 'iris' });
    global.syncCacheIndicator(response?.usage || null);

    if (refs.output) refs.output.textContent = response?.text || '';
    global.showToast('Recherche sémantique Iris générée');
  }

  function finalizeIrisSemanticSearchError(refs = {}, error) {
    if (refs.output) refs.output.textContent = `Erreur: ${error.message}`;
    global.showToast(`Erreur: ${error.message}`, '#ff4757');
  }

  function endIrisSemanticSearch(refs = {}) {
    if (refs.button) {
      refs.button.disabled = false;
      global.PipelineUIIcons?.setIconLabel?.(refs.button, 'play', 'Lancer Iris');
    }
  }

  async function runIrisSemanticSearch(prefix = 'col') {
    const refs = beginIrisSemanticSearch(prefix);

    try {
      const ctx = global.buildCtx('iris');
      const prompt = global.buildPrompt('iris', ctx);
      const rawFixed = prompt.fixedContent
        ? `── CACHE FIXE ──\n${prompt.fixedContent}\n\n── VARIABLE ──\n`
        : '';

      global.state.inputs.iris = rawFixed + prompt.filled;

      const response = await global.callClaude('iris', prompt, false);
      finalizeIrisSemanticSearch(prefix, refs, response);
      return response;
    } catch (error) {
      finalizeIrisSemanticSearchError(refs, error);
      throw error;
    } finally {
      endIrisSemanticSearch(refs);
    }
  }

  async function runCollectionIrisSemanticSearch() {
    return runIrisSemanticSearch('col');
  }

  async function runTabletopIrisSemanticSearch() {
    return runIrisSemanticSearch('tt');
  }

  global.PipelineUIIrisRuntime = {
    runCollectionIrisSemanticSearch,
    runTabletopIrisSemanticSearch,
  };

  bindIrisOutputEditing();

  global.PipelineUI.runtimeIris = global.PipelineUI.runtimeIris || {};
  Object.assign(global.PipelineUI.runtimeIris, global.PipelineUIIrisRuntime);
  Object.assign(global, global.PipelineUIIrisRuntime);
})(window);
