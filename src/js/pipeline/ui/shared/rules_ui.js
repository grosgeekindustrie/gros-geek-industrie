(function initPipelineUIRules(global) {

// Regles persistantes attachees aux cartes agents.
// Petit bridge DOM/localStorage volontairement isole pour eviter de laisser ce reliquat
// dans le boot principal.
  global.PipelineUI = global.PipelineUI || {};
  const storage = global.PipelineUIStorage || {};
  const writePersistentRules = storage.writePersistentRules || ((rules) => {
    localStorage.setItem('pipeline.rules', JSON.stringify(rules));
  });
  let rulesDelegationBound = false;

  function savePersistentRules() {
    writePersistentRules(global.state.persistentRules);
  }

  function renderPersistentRules(agentId, rules) {
    return 'Regles permanentes:<br>' + rules.map((rule, index) =>
      `<button type="button" data-rule-action="remove" data-agent-id="${agentId}" data-rule-index="${index}" title="Supprimer">x ${rule}</button>`
    ).join('');
  }

  function persistRule(agentId) {
    const prefix = global.pfx();
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
    const prefix = global.pfx();
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
    persistRule,
    removeRule,
    refreshRules,
  };

  global.PipelineUI.rules = global.PipelineUI.rules || {};
  Object.assign(global.PipelineUI.rules, global.PipelineUIRules);
  Object.assign(global, global.PipelineUIRules);

  if (!rulesDelegationBound) {
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-rule-action]');
      if (!trigger || trigger.disabled) return;

      const action = trigger.dataset.ruleAction;
      const agentId = trigger.dataset.agentId;
      if (action === 'persist') {
        persistRule(agentId);
        return;
      }
      if (action === 'remove') {
        removeRule(agentId, Number(trigger.dataset.ruleIndex || -1));
      }
    });
    rulesDelegationBound = true;
  }
})(window);
