(function initPipelineUICards(global) {

// Construction des cartes agents.
// Génère le markup pipeline par agent et expose les helpers d'ouverture / fermeture.
// Dépend de la structure HTML/CSS actuelle : éviter les changements diffus non cadrés.
  global.PipelineUI = global.PipelineUI || {};
  const dom = global.PipelineUIDom || {};
  const icons = () => global.PipelineUIIcons || {};

  const getPfx = () => global.pfx();
  const getAgents = () => global.getPipelineAgents();
  const renderIcon = (name, className = '') => icons().renderIcon?.(name, { className }) || '';

  function buildPipeline() {
    const p = getPfx();
    const container = document.getElementById(`pipeline-${p}`);
    if (!container) return;

    container.innerHTML = '';
    getAgents().forEach((agent, index) => {
      if (index > 0) {
        const arrow = document.createElement('div');
        arrow.className = 'pipe-arrow';
        arrow.innerHTML = renderIcon('arrowDown', 'pipe-arrow-icon');
        container.appendChild(arrow);
      }

      const card = document.createElement('div');
      card.className = 'agent-card';
      card.id = `${p}-card-${agent.id}`;
      card.dataset.agentCard = `${p}:${agent.id}`;
      card.dataset.pipelinePrefix = p;
      card.dataset.agentId = agent.id;
      card.innerHTML = `
      <div class="agent-header" data-card-toggle="${p}-${agent.id}">
        <span class="agent-num">${String(index + 1).padStart(2, '0')}</span>
        <span class="agent-title">${agent.title}</span>
        <span class="badge-rules" id="${p}-brul-${agent.id}">${renderIcon('pin', 'badge-rules-icon')}</span>
        ${agent.usesImages ? `<span class="badge-img" id="${p}-bimg-${agent.id}" title="Images activées · en attente" aria-label="Images activées">${renderIcon('image', 'badge-img-icon')}</span>` : ''}
        <span class="agent-status s-wait" id="${p}-stat-${agent.id}" data-agent-status="${agent.id}">en attente</span>
        <span class="chevron" id="${p}-chev-${agent.id}" data-agent-chevron="${agent.id}">${renderIcon('chevronDown', 'chevron-icon')}</span>
      </div>
      <div class="agent-body" id="${p}-body-${agent.id}" data-agent-body="${agent.id}">
        ${agent.id === 'tags' ? '' : `<div class="output-box empty" id="${p}-out-${agent.id}" data-agent-output="${agent.id}">— pas encore généré —</div>`}
        ${buildSelectionHTML(agent, p)}
        <div class="correction-area"><label>${renderIcon('message', 'correction-area-icon')}<span class="ui-icon-label">Correction ponctuelle</span></label><textarea id="${p}-cor-${agent.id}" placeholder="Pour cette fiche uniquement..."></textarea></div>
        <div class="agent-actions">
          <button class="btn btn-accent" id="${p}-br-${agent.id}" type="button" data-pipeline-action="rerun-agent" data-pipeline-prefix="${p}" data-pipeline-agent="${agent.id}" data-agent-rerun="${agent.id}" disabled>${renderIcon('refresh')}<span class="ui-icon-label">Relancer</span></button>
          <button class="btn btn-success" id="${p}-bs-${agent.id}" type="button" data-pipeline-action="rerun-suite" data-pipeline-prefix="${p}" data-pipeline-agent="${agent.id}" data-agent-suite="${agent.id}" disabled>${renderIcon('fastForward')}<span class="ui-icon-label">Suite</span></button>
          <button class="btn btn-orange" id="${p}-bp-${agent.id}" type="button" data-rule-action="persist" data-agent-id="${agent.id}" data-agent-persist="${agent.id}" disabled>${renderIcon('pin')}<span class="ui-icon-label">Toujours</span></button>
          <button class="btn btn-muted" type="button" data-ui-action="open-prompt-lightbox" data-action-arg="${agent.id}">${renderIcon('settings')}</button>
          <button class="btn agent-stop-btn" id="${p}-bstop-${agent.id}" type="button" data-pipeline-action="stop-agent" data-pipeline-prefix="${p}" data-pipeline-agent="${agent.id}" data-agent-stop="${agent.id}">${renderIcon('stop')}</button>
          <button class="btn btn-muted" type="button" data-output-action="copy" data-agent-id="${agent.id}">${renderIcon('copy')}</button>
          <button class="btn btn-muted" type="button" data-output-action="raw-input" data-agent-id="${agent.id}">&lt;/&gt;</button>
          ${agent.id === 'tags' ? `<button class="btn btn-orange" id="${p}-bexplore-tags" type="button" data-selection-action="run-tag-explorer" data-selection-explore="tags" data-agent-id="${agent.id}" data-prefix="${p}" disabled>${renderIcon('search')}<span class="ui-icon-label">Explorer</span></button>` : ''}
          ${agent.id === 'titre' ? `<button class="btn btn-orange" id="${p}-bexplore-titre" type="button" data-selection-action="run-titre-explorer" data-selection-explore="titre" data-agent-id="${agent.id}" data-prefix="${p}" disabled>${renderIcon('search')}<span class="ui-icon-label">Explorer</span></button>` : ''}
        </div>
        <div class="rules-display" id="${p}-rd-${agent.id}"></div>
      </div>`;
      container.appendChild(card);
    });
  }

  function buildSelectionHTML(agent, p) {
    if (agent.id === 'tags') {
      return `
    <div class="sel-zone sel-zone-hidden tags-selection-zone" id="${p}-sel-tags" data-selection-zone="tags" data-prefix="${p}" data-agent-id="${agent.id}">
      <div id="${p}-sel-tags-runtime" data-tags-runtime-root></div>
      <div class="tags-selection-footer">
        <button class="validate-btn tags-validate-btn" id="${p}-validate-tags" type="button" data-pipeline-action="validate-tags" data-pipeline-prefix="${p}" data-pipeline-agent="${agent.id}" data-tags-validate-button disabled>${renderIcon('check')}<span class="ui-icon-label">Valider les tags sélectionnés</span></button>
      </div>
    </div>`;
    }
    if (!agent.hasSelection) return '';
    if (agent.selectionType === 'titre') {
      return `
    <div class="sel-zone" id="${p}-sel-${agent.id}" data-selection-zone="titre" data-prefix="${p}" data-agent-id="${agent.id}">
      <h4>${renderIcon('tag')}<span class="ui-icon-label">Choisir un titre</span></h4>
      <div id="${p}-sel-list-${agent.id}" data-selection-list="titre"></div>
      <div class="titre-manual-shell">
        <div class="titre-manual-head">
          <label class="titre-manual-label">OU saisir manuellement :</label>
          <span id="${p}-titre-counter-${agent.id}" class="titre-manual-counter" data-selection-counter="titre">0 / 140</span>
        </div>
        <div class="manual-titre-row">
          <input type="text" id="${p}-titre-manual-${agent.id}" placeholder="Titre personnalisé..." maxlength="140" data-selection-input="titre-counter" data-selection-manual-input="titre" data-agent-id="${agent.id}"/>
          <button class="btn btn-muted" type="button" data-selection-action="paste-selected-titre" data-agent-id="${agent.id}">${renderIcon('copy')}</button>
        </div>
      </div>
      <button class="validate-btn" type="button" data-pipeline-action="validate-title" data-pipeline-prefix="${p}" data-pipeline-agent="${agent.id}">${renderIcon('check')}<span class="ui-icon-label">Valider ce titre</span></button>
    </div>`;
    }
    return `
    <div class="sel-zone" id="${p}-sel-accroche-${agent.id}" data-selection-zone="accroche" data-prefix="${p}" data-agent-id="${agent.id}"><h4>${renderIcon('target')}<span class="ui-icon-label">Choisir une accroche</span></h4><div id="${p}-sel-list-accroche-${agent.id}" data-selection-list="accroche"></div></div>
    <div class="sel-zone" id="${p}-sel-cta-${agent.id}" data-selection-zone="cta" data-prefix="${p}" data-agent-id="${agent.id}"><h4>${renderIcon('message')}<span class="ui-icon-label">Choisir un CTA</span></h4><div id="${p}-sel-list-cta-${agent.id}" data-selection-list="cta"></div><button class="validate-btn" type="button" data-pipeline-action="validate-selection" data-pipeline-prefix="${p}" data-pipeline-agent="${agent.id}">${renderIcon('check')}<span class="ui-icon-label">Valider et assembler</span></button></div>`;
  }

  function resolveCardEls(id) {
    const knownPfx = ['tt', 'col'];
    const parts = id.split('-');
    if (knownPfx.includes(parts[0])) {
      const p = parts[0];
      const aid = parts.slice(1).join('-');
      const cardRoot = dom.getByData?.('agentCard', `${p}:${aid}`);
      return [
        dom.getByData?.('agentBody', aid, cardRoot) || document.getElementById(`${p}-body-${aid}`),
        dom.getByData?.('agentChevron', aid, cardRoot) || document.getElementById(`${p}-chev-${aid}`),
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
    toggleCard,
    openCard,
  };

  global.PipelineUI.cards = global.PipelineUI.cards || {};
  Object.assign(global.PipelineUI.cards, global.PipelineUICards);
  Object.assign(global, global.PipelineUICards);

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-card-toggle]');
    if (toggle) {
      toggleCard(toggle.dataset.cardToggle);
      return;
    }

    const outputAction = event.target.closest('[data-output-action]');
    if (!outputAction || outputAction.disabled) return;

    const agentId = outputAction.dataset.agentId;
    if (outputAction.dataset.outputAction === 'copy') global.copyOut?.(agentId);
    if (outputAction.dataset.outputAction === 'raw-input') global.showRawInput?.(agentId);
  });
})(window);

