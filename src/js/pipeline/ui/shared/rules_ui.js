(function initPipelineUIRules(global) {

// Regles persistantes attachees aux cartes agents.
// Petit bridge DOM/localStorage volontairement isole pour eviter de laisser ce reliquat
// dans le boot principal.
  global.PipelineUI = global.PipelineUI || {};

  function savePersistentRules() {
    localStorage.setItem('pipeline.rules', JSON.stringify(global.state.persistentRules));
  }

  function renderPersistentRules(agentId, rules) {
    return 'Regles permanentes:<br>' + rules.map((rule, index) =>
      `<span onclick="removeRule('${agentId}',${index})" title="Supprimer">x ${rule}</span>`
    ).join('');
  }

  function persistRule(agentId) {
    const prefix = typeof global.pfx === 'function' ? global.pfx() : (global.currentMode === 'collection' ? 'col' : 'tt');
    const input = document.getElementById(`${prefix}-cor-${agentId}`);
    const value = String(input?.value || '').trim();
    if (!value) return;

    global.state.persistentRules[agentId] = global.state.persistentRules[agentId] || [];
    global.state.persistentRules[agentId].push(value);

    if (input) input.value = '';
    refreshRules(agentId);
    savePersistentRules();
  }

  function removeRule(agentId, index) {
    const rules = global.state.persistentRules[agentId];
    if (!Array.isArray(rules)) return;

    rules.splice(index, 1);
    refreshRules(agentId);
    savePersistentRules();
  }

  function refreshRules(agentId) {
    const prefix = typeof global.pfx === 'function' ? global.pfx() : (global.currentMode === 'collection' ? 'col' : 'tt');
    const rules = global.state.persistentRules[agentId] || [];
    const badge = document.getElementById(`${prefix}-brul-${agentId}`);
    const display = document.getElementById(`${prefix}-rd-${agentId}`);

    if (!badge || !display) return;
    if (!rules.length) {
      badge.style.display = 'none';
      display.innerHTML = '';
      return;
    }

    badge.style.display = 'inline';
    display.innerHTML = renderPersistentRules(agentId, rules);
  }

  global.PipelineUIRules = {
    savePersistentRules,
    renderPersistentRules,
    persistRule,
    removeRule,
    refreshRules,
  };

  global.PipelineUI.rules = global.PipelineUI.rules || {};
  Object.assign(global.PipelineUI.rules, global.PipelineUIRules);
  Object.assign(global, global.PipelineUIRules);
})(window);
