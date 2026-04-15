(function initPipelineUICards(global) {

// Construction des cartes agents.
// Génère le markup pipeline par agent et expose les helpers d'ouverture / fermeture.
// Dépend de la structure HTML/CSS actuelle : éviter les changements diffus non cadrés.
  global.PipelineUI = global.PipelineUI || {};

  const getPfx = () => (typeof global.pfx === 'function' ? global.pfx() : (global.getPipelinePrefix?.(global.currentMode) || (global.currentMode === 'collection' ? 'col' : 'tt')));
  const getAgents = () => (typeof global.getPipelineAgents === 'function' ? global.getPipelineAgents() : []);

  function buildPipeline() {
    const p = getPfx();
    const container = document.getElementById(`pipeline-${p}`);
    if (!container) return;

    container.innerHTML = '';
    getAgents().forEach((agent, index) => {
      if (index > 0) {
        const arrow = document.createElement('div');
        arrow.className = 'pipe-arrow';
        arrow.textContent = '↓';
        container.appendChild(arrow);
      }

      const card = document.createElement('div');
      card.className = 'agent-card';
      card.id = `${p}-card-${agent.id}`;
      card.innerHTML = `
      <div class="agent-header" onclick="toggleCard('${p}-${agent.id}')">
        <span class="agent-num">${String(index + 1).padStart(2, '0')}</span>
        <span class="agent-title">${agent.title}</span>
        <span class="badge-rules" id="${p}-brul-${agent.id}">📌</span>
        ${agent.usesImages ? `<span class="badge-img" id="${p}-bimg-${agent.id}" title="Images activées · en attente" aria-label="Images activées">📷</span>` : ''}
        <span class="agent-status s-wait" id="${p}-stat-${agent.id}">en attente</span>
        <span class="chevron" id="${p}-chev-${agent.id}">▾</span>
      </div>
      <div class="agent-body" id="${p}-body-${agent.id}">
        <div class="output-box empty" id="${p}-out-${agent.id}">— pas encore généré —</div>
        ${buildSelectionHTML(agent, p)}
        <div class="correction-area"><label>💬 Correction ponctuelle</label><textarea id="${p}-cor-${agent.id}" placeholder="Pour cette fiche uniquement..."></textarea></div>
        <div class="agent-actions">
          <button class="btn btn-accent" id="${p}-br-${agent.id}" type="button" data-pipeline-action="rerun-agent" data-pipeline-prefix="${p}" data-pipeline-agent="${agent.id}" disabled>🔄 Relancer</button>
          <button class="btn btn-success" id="${p}-bs-${agent.id}" type="button" data-pipeline-action="rerun-suite" data-pipeline-prefix="${p}" data-pipeline-agent="${agent.id}" disabled>⏩ Suite</button>
          <button class="btn btn-orange" id="${p}-bp-${agent.id}" onclick="persistRule('${agent.id}')" disabled>📌 Toujours</button>
          <button class="btn btn-muted" onclick="openPromptLightbox('${agent.id}')">⚙️</button>
          <button class="btn" id="${p}-bstop-${agent.id}" type="button" data-pipeline-action="stop-agent" data-pipeline-prefix="${p}" data-pipeline-agent="${agent.id}" style="display:none;background:rgba(255,71,87,.1);border:1px solid rgba(255,71,87,.3);color:var(--error);">⏹</button>
          <button class="btn btn-muted" onclick="copyOut('${agent.id}')">📋</button>
          <button class="btn btn-muted" onclick="showRawInput('${agent.id}')">&lt;/&gt;</button>
          ${agent.id === 'tags' ? `<button class="btn btn-orange" id="${p}-bexplore-tags" onclick="runTagExplorer()" disabled>🔭 Explorer</button>` : ''}
          ${agent.id === 'titre' ? `<button class="btn btn-orange" id="${p}-bexplore-titre" onclick="runTitreExplorer()" disabled>🔭 Explorer</button>` : ''}
        </div>
        <div class="rules-display" id="${p}-rd-${agent.id}"></div>
      </div>`;
      container.appendChild(card);
    });
  }

  function buildSelectionHTML(agent, p) {
    if (agent.id === 'tags') {
      return `
    <div class="sel-zone tags-selection-zone" id="${p}-sel-tags" style="display:none;">
      <div id="${p}-sel-tags-runtime"></div>
      <div class="tags-selection-footer">
        <button class="validate-btn tags-validate-btn" id="${p}-validate-tags" type="button" data-pipeline-action="validate-tags" data-pipeline-prefix="${p}" data-pipeline-agent="${agent.id}" disabled>✅ Valider les tags sélectionnés</button>
      </div>
    </div>`;
    }
    if (!agent.hasSelection) return '';
    if (agent.selectionType === 'titre') {
      return `
    <div class="sel-zone" id="${p}-sel-${agent.id}">
      <h4>🏷️ Choisir un titre</h4>
      <div id="${p}-sel-list-${agent.id}"></div>
      <div style="margin-top:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <label style="font-size:11px;color:var(--muted);font-family:'Space Mono',monospace;">OU saisir manuellement :</label>
          <span id="${p}-titre-counter-${agent.id}" style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);">0 / 140</span>
        </div>
        <div class="manual-titre-row">
          <input type="text" id="${p}-titre-manual-${agent.id}" placeholder="Titre personnalisé..." maxlength="140" oninput="updateTitreCounter('${agent.id}')"/>
          <button class="btn btn-muted" onclick="pasteSelectedTitre('${agent.id}')">📋</button>
        </div>
      </div>
      <button class="validate-btn" type="button" data-pipeline-action="validate-title" data-pipeline-prefix="${p}" data-pipeline-agent="${agent.id}">✅ Valider ce titre</button>
    </div>`;
    }
    return `
    <div class="sel-zone" id="${p}-sel-accroche-${agent.id}"><h4>🎯 Choisir une accroche</h4><div id="${p}-sel-list-accroche-${agent.id}"></div></div>
    <div class="sel-zone" id="${p}-sel-cta-${agent.id}"><h4>💬 Choisir un CTA</h4><div id="${p}-sel-list-cta-${agent.id}"></div><button class="validate-btn" type="button" data-pipeline-action="validate-selection" data-pipeline-prefix="${p}" data-pipeline-agent="${agent.id}">✅ Valider et assembler</button></div>`;
  }

  function resolveCardEls(id) {
    const knownPfx = ['tt', 'col'];
    const parts = id.split('-');
    if (knownPfx.includes(parts[0])) {
      const p = parts[0];
      const aid = parts.slice(1).join('-');
      return [
        document.getElementById(`${p}-body-${aid}`),
        document.getElementById(`${p}-chev-${aid}`),
      ];
    }
    return [
      document.getElementById(`body-${id}`),
      document.getElementById(`chev-${id}`),
    ];
  }

  function toggleCard(id) {
    const [bodyEl, chevEl] = resolveCardEls(id);
    bodyEl?.classList.toggle('open');
    chevEl?.classList.toggle('open');
  }

  function openCard(id) {
    const [bodyEl, chevEl] = resolveCardEls(id);
    bodyEl?.classList.add('open');
    chevEl?.classList.add('open');
  }

  global.PipelineUICards = {
    buildPipeline,
    buildSelectionHTML,
    toggleCard,
    openCard,
  };

  global.PipelineUI.cards = global.PipelineUI.cards || {};
  Object.assign(global.PipelineUI.cards, global.PipelineUICards);
  Object.assign(global, global.PipelineUICards);
})(window);
