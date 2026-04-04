(function initPipelineUISelections(global) {

// Sélections tags / titres / accroches / CTA.
// Regroupe les flows de validation utilisateur, explorers et assemblage des sorties.
// Zone sensible car fortement couplée au DOM des cartes pipeline.
  global.PipelineUI = global.PipelineUI || {};

  const helpers = () => global.PipelineUIHelpers || {};
  const modals = () => global.PipelineUIModals || {};
  const tagsApi = () => global.PipelineUITags || {};
  const titlesApi = () => global.PipelineUITitles || {};
  const getPfx = () => (typeof global.pfx === 'function' ? global.pfx() : (global.currentMode === 'collection' ? 'col' : 'tt'));
  const getAgents = () => (typeof global.getPipelineAgents === 'function' ? global.getPipelineAgents() : []);


  function getTagLibraryState() {
    const parsed = global.parseBiblioTags ? global.parseBiblioTags(global.getBiblio?.('tags')) : {};
    return {
      validated: parsed.validated || [],
      blacklisted: parsed.blacklisted || [],
    };
  }

  function getTagVisualState(tag, libraryState) {
    const validated = libraryState?.validated || [];
    const blacklisted = libraryState?.blacklisted || [];
    const isValidated = helpers().isExactTagInList ? helpers().isExactTagInList(tag, validated) : false;
    const isExactBlacklisted = helpers().isExactTagInList ? helpers().isExactTagInList(tag, blacklisted) : false;
    const matchedTerm = !isExactBlacklisted && helpers().getBlacklistedTerm
      ? helpers().getBlacklistedTerm(tag, blacklisted, { minTermLength: 2 })
      : null;

    return {
      isValidated,
      isExactBlacklisted,
      matchedTerm,
    };
  }

  function buildTagTextHtml(tag, tagState) {
    if (tagState.isExactBlacklisted) {
      return helpers().escapeHtml ? helpers().escapeHtml(tag) : tag;
    }
    if (tagState.matchedTerm && helpers().highlightTermInText) {
      return helpers().highlightTermInText(tag, tagState.matchedTerm, 'tag-term-highlight');
    }
    return helpers().escapeHtml ? helpers().escapeHtml(tag) : tag;
  }

  function buildTagStateBadge(tagState) {
    if (tagState.isExactBlacklisted) {
      return '<span class="tag-state-badge is-blacklisted">⚠ tag exclu</span>';
    }
    if (tagState.matchedTerm) {
      return '<span class="tag-state-badge is-warning">⚠ terme exclu</span>';
    }
    if (tagState.isValidated) {
      return '<span class="tag-state-badge is-validated">✓ validé</span>';
    }
    return '';
  }

  function buildTagItemMarkup(tag, itemId, source, libraryState) {
    const safe = tag.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const len = tag.length;
    const lenColor = len > 30 ? 'var(--error)' : 'var(--success)';
    const tagState = getTagVisualState(tag, libraryState);
    const itemClasses = [
      'titre-item',
      tagState.isValidated ? 'tag-is-validated' : '',
      tagState.isExactBlacklisted ? 'tag-is-blacklisted' : '',
      !tagState.isExactBlacklisted && tagState.matchedTerm ? 'tag-has-blacklisted-term' : '',
    ].filter(Boolean).join(' ');

    return `<div class="${itemClasses}" id="${itemId}">
      <div class="titre-main">
        <span class="titre-text">${buildTagTextHtml(tag, tagState)}</span>
        ${buildTagStateBadge(tagState)}
      </div>
      <span class="titre-char" style="color:${lenColor};">${len}</span>
      <div class="titre-actions">
        <button class="titre-thumb" onclick="event.stopPropagation();validateTag('${safe}')">👍</button>
        <button class="titre-thumb" onclick="event.stopPropagation();invalidateTag('${safe}','${itemId}','${source}')">👎</button>
        <button class="titre-thumb" onclick="event.stopPropagation();rerollTag('${safe}','${itemId}')">🔄</button>
      </div>
    </div>`;
  }

  function buildTagsUI(output) {
    const p = getPfx();
    const tags = helpers().parseTagOutput ? helpers().parseTagOutput(output) : [];
    if (!tags.length) return;

    const zone = document.getElementById(`${p}-sel-tags`);
    const list = document.getElementById(`${p}-sel-list-tags`);
    if (!zone || !list) return;

    zone.style.display = 'block';
    modals().ensureLibraryModals?.();
    modals().ensureTagsManualAddButton?.();

    list.innerHTML = tags.map((tag, i) => {
      const safe = tag.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const len = tag.length;
      const lenColor = len > 30 ? 'var(--error)' : 'var(--success)';
      return `<div class="titre-item" id="tag-item-${i}">
      <span class="titre-text">${tag}</span>
      <span class="titre-char" style="color:${lenColor};">${len}</span>
      <div class="titre-actions">
        <button class="titre-thumb" onclick="event.stopPropagation();validateTag('${safe}')">👍</button>
        <button class="titre-thumb" onclick="event.stopPropagation();invalidateTag('${safe}','tag-item-${i}','main')">👎</button>
        <button class="titre-thumb" onclick="event.stopPropagation();rerollTag('${safe}','tag-item-${i}')">🔄</button>
      </div></div>`;
    }).join('');

    const parsed = global.parseBiblioTags ? global.parseBiblioTags(global.getBiblio?.('tags')) : { blacklisted: [] };
    const blacklisted = parsed.blacklisted || [];
    if (blacklisted.length) {
      tags.forEach((tag, i) => {
        const term = helpers().getBlacklistedTerm ? helpers().getBlacklistedTerm(tag, blacklisted, { minTermLength: 2 }) : null;
        if (term) {
          const el = document.getElementById(`tag-item-${i}`);
          if (el) setTimeout(() => tagsApi().autoRegenTag?.(tag, term, el), i * 300);
        }
      });
    }

    const exploreBtn = document.getElementById(`${p}-bexplore-tags`);
    if (exploreBtn) exploreBtn.disabled = false;
  }

  async function validateTag(tag) {
    const parsed = global.parseBiblioTags(global.getBiblio('tags'));
    const validated = parsed.validated || [];
    const blacklisted = parsed.blacklisted || [];

    if (validated.includes(tag)) {
      global.showToast?.('Déjà validé');
      return;
    }

    validated.push(tag);
    const updated = global.buildBiblioTagsRaw(validated, blacklisted);
    try {
      const res = await fetch(`/files/biblios/${global.currentMode}/tags.md`, { method: 'PUT', body: updated });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      global.state.bibliosByMode[global.currentMode].tags = updated;
      global.showToast?.(`👍 "${tag}" validé`);
    } catch (error) {
      global.showToast?.('Erreur sauvegarde', '#ff4757');
    }
  }

  async function invalidateTag(tag, itemId = null, source = 'main') {
    modals().openLibraryBlacklistModal?.({
      kind: 'tags',
      currentValue: helpers().normalizeTagValue ? helpers().normalizeTagValue(tag) : String(tag || '').trim(),
      itemId,
      source,
    });
  }

  async function runTagExplorer() {
    const p = getPfx();
    const btn = document.getElementById(`${p}-bexplore-tags`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⟳ Exploration...';
    }

    const ctx = global.buildCtx('tags');
    const prompt = global.buildPrompt('tags', ctx);

    try {
      const { text: result } = await global.callClaude('tags', {
        filled: prompt.filled,
        fixedContent: prompt.fixedContent,
      }, false);

      const tags = helpers().parseTagOutput ? helpers().parseTagOutput(result) : [];
      document.getElementById('explorerTitle').textContent = '🔭 EXPLORATION TAGS';
      document.getElementById('explorerCount').textContent = `${tags.length} tags`;
      document.getElementById('explorerListLabel').textContent = 'Tags générés — 👍 valider · 👎 blacklister';
      document.getElementById('explorerConversation').value = result;

      modals().ensureLibraryModals?.();
      modals().ensureExplorerManualAddButton?.('tags');

      const list = document.getElementById('explorerList');
      list.innerHTML = tags.map((tag, i) => {
        const len = tag.length;
        const lenColor = len > 30 ? 'var(--error)' : 'var(--success)';
        const safe = tag.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `<div class="titre-item" id="exp-tag-${i}">
        <span class="titre-text">${tag}</span>
        <span class="titre-char" style="color:${lenColor};">${len}</span>
        <div class="titre-actions">
          <button class="titre-thumb" onclick="event.stopPropagation();validateTag('${safe}');document.getElementById('exp-tag-${i}').classList.add('validated')">👍</button>
          <button class="titre-thumb" onclick="event.stopPropagation();invalidateTag('${safe}','exp-tag-${i}','explorer');document.getElementById('exp-tag-${i}').classList.add('invalidated')">👎</button>
          <button class="titre-thumb" onclick="event.stopPropagation();rerollTag('${safe}','exp-tag-${i}')">🔄</button>
        </div>
      </div>`;
      }).join('');

      document.getElementById('explorerLightbox').classList.add('visible');
      global.showToast?.('Exploration terminée ✓', '#e8c547');
    } catch (error) {
      global.showToast?.(`Erreur: ${error.message}`, '#ff4757');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔭 Explorer';
      }
    }
  }

  function closeExplorer() {
    document.getElementById('explorerLightbox').classList.remove('visible');
  }

  function buildTitreSelectionUI(agentId, output) {
    const p = getPfx();
    const lines = output.split('\n').filter((line) => line.match(/^\d+\.\s+/));
    const zone = document.getElementById(`${p}-sel-${agentId}`);
    const list = document.getElementById(`${p}-sel-list-${agentId}`);
    if (!zone || !list) return;

    zone.classList.add('visible');
    modals().ensureLibraryModals?.();
    modals().ensureTitresManualAddButton?.(agentId);

    list.innerHTML = lines.map((line, i) => {
      const text = line.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '').trim();
      const charMatch = line.match(/\((\d+)\s*car/i);
      const chars = charMatch ? parseInt(charMatch[1], 10) : text.length;
      const charColor = chars > 140 ? 'var(--error)' : chars >= 128 ? 'var(--success)' : chars >= 110 ? 'var(--accent)' : 'var(--muted)';
      const safeText = text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return `<div class="titre-item" id="ti-${i}" onclick="selectTitre(${i},'${agentId}',this)">
      <input type="radio" name="titre-${agentId}" style="flex-shrink:0;margin-top:3px;accent-color:var(--accent);"/>
      <span class="titre-text">${text}</span>
      <span class="titre-char" style="color:${charColor};">${chars}</span>
      <div class="titre-actions">
        <button class="titre-thumb" onclick="event.stopPropagation();validateTitreSegment('${safeText}','valid')">👍</button>
        <button class="titre-thumb" onclick="event.stopPropagation();invalidateTitreSegment('${safeText}','ti-${i}','${agentId}','main')">👎</button>
        <button class="titre-copy" onclick="event.stopPropagation();copyTitreLine('${safeText}')">📋</button>
      </div></div>`;
    }).join('');

    const parsed = global.parseBiblioTitres ? global.parseBiblioTitres(global.getBiblio?.('titres')) : { blacklisted: [] };
    const blacklisted = parsed.blacklisted || [];
    if (blacklisted.length) {
      lines.forEach((line, i) => {
        const text = line.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '').trim();
        const term = helpers().getBlacklistedTerm ? helpers().getBlacklistedTerm(text, blacklisted) : null;
        if (term) {
          const el = document.getElementById(`ti-${i}`);
          if (el) setTimeout(() => titlesApi().autoRegenTitre?.(text, term, el, agentId), i * 300);
        }
      });
    }
  }

  function selectTitre(i, agentId, el) {
    el.parentElement.querySelectorAll('.titre-item').forEach((node) => node.classList.remove('selected'));
    el.classList.add('selected');
    el.querySelector('input').checked = true;
    global.state.selectedTitre = el.querySelector('.titre-text').textContent.trim();
    const p = getPfx();
    document.getElementById(`${p}-titre-manual-${agentId}`).value = '';
  }

  function updateTitreCounter(agentId) {
    const p = getPfx();
    const input = document.getElementById(`${p}-titre-manual-${agentId}`);
    const counter = document.getElementById(`${p}-titre-counter-${agentId}`);
    if (!input || !counter) return;

    const len = input.value.length;
    counter.textContent = `${len} / 140`;
    counter.style.color = len > 140 ? 'var(--error)' : len > 130 ? 'var(--accent)' : 'var(--muted)';
    input.style.borderColor = len > 140 ? 'var(--error)' : len > 130 ? 'var(--accent)' : '';
  }

  function pasteSelectedTitre(agentId) {
    const p = getPfx();
    if (global.state.selectedTitre) {
      document.getElementById(`${p}-titre-manual-${agentId}`).value = global.state.selectedTitre;
      updateTitreCounter(agentId);
    }
  }

  async function validateTitreSegment(text) {
    const parsed = global.parseBiblioTitres(global.getBiblio('titres'));
    const validated = parsed.validated || [];
    const blacklisted = parsed.blacklisted || [];
    if (validated.includes(text)) return;

    validated.push(text);
    const updated = global.buildBiblioTitresRaw(validated, blacklisted);
    try {
      const res = await fetch(`/files/biblios/${global.currentMode}/titres.md`, { method: 'PUT', body: updated });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      global.state.bibliosByMode[global.currentMode].titres = updated;
      global.showToast?.('👍 Titre ajouté aux exemples validés');
    } catch (error) {
      global.showToast?.('Erreur sauvegarde titres', '#ff4757');
    }
  }

  async function invalidateTitreSegment(text, itemId, agentId, source = 'main') {
    modals().openLibraryBlacklistModal?.({
      kind: 'titres',
      currentValue: helpers().normalizeTitreValue ? helpers().normalizeTitreValue(text) : String(text || '').trim(),
      itemId,
      source,
      agentId: agentId || 'titre',
    });
  }

  function copyTitreLine(text) {
    navigator.clipboard.writeText(text);
    global.showToast?.('Titre copié ✓');
  }

  function validateTitre(agentId) {
    const p = getPfx();
    const manual = document.getElementById(`${p}-titre-manual-${agentId}`).value.trim();
    const titre = manual || global.state.selectedTitre;
    if (!titre) {
      alert('Choisis ou saisis un titre.');
      return;
    }

    global.state.outputs.titre_valide = titre;
    if (manual) {
      validateTitreSegment(manual);
      global.showToast?.('✅ Titre manuel ajouté aux exemples validés');
    }

    document.getElementById(`${p}-sel-${agentId}`).classList.remove('visible');
    document.getElementById(`${p}-stat-${agentId}`).textContent = '✓ titre validé';
    document.getElementById(`${p}-stat-${agentId}`).className = 'agent-status s-done';

    const agents = getAgents();
    const idx = agents.findIndex((agent) => agent.id === agentId);
    (async () => {
      for (let i = idx + 1; i < agents.length; i++) {
        if (agents[i].optional) break;
        const ok = await global.runAgent(agents[i]);
        if (!ok) break;
        if (agents[i].hasSelection) break;
      }
    })();
  }

  function parseChoices(output, prefix) {
    const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
    const choices = [];

    for (const line of lines) {
      const match = line.match(new RegExp(`^${prefix}(\\d+)\\s*[→:]\\s*(.+)`));
      if (match) choices.push({ num: match[1], text: match[2].trim() });
    }
    if (choices.length > 0) return choices;

    if (prefix === 'A') {
      let pastTechnique = false;
      for (const line of lines) {
        if (line.startsWith('•') || line.startsWith('🛠️')) {
          pastTechnique = true;
          continue;
        }
        if (!pastTechnique) continue;
        const hasEmoji = /^[\u{1F300}-\u{1FFFF}⚡🎯⚔️🎨🏆💫🎁🔥✨🏅💎🌑👀⏳🎲🖌️🎭]/u.test(line);
        if (hasEmoji && choices.length < 5) choices.push({ num: String(choices.length + 1), text: line });
        if (line.includes('Conseils de peinture')) break;
      }
    }

    if (prefix === 'C') {
      let pastConseils = false;
      let count = 0;
      for (const line of lines) {
        if (line.includes('Conseils de peinture') || line.startsWith('🎨 Conseils')) {
          pastConseils = true;
          continue;
        }
        if (!pastConseils) continue;
        if (line.startsWith('🎭') || line.includes('Fan Art')) break;
        const hasEmoji = /^[\u{1F300}-\u{1FFFF}⚡🎯⚔️🎨🏆💫🎁🔥✨🏅💎🌑👀⏳🎲🖌️🎭]/u.test(line);
        if (hasEmoji && count < 5) {
          choices.push({ num: String(count + 1), text: line });
          count++;
        }
      }
    }

    return choices;
  }

  function buildAccrocheCTASelectionUI(agentId, output) {
    const p = getPfx();
    const accroches = parseChoices(output, 'A');
    const ctas = parseChoices(output, 'C');

    if (accroches.length > 0) {
      const zone = document.getElementById(`${p}-sel-accroche-${agentId}`);
      const list = document.getElementById(`${p}-sel-list-accroche-${agentId}`);
      if (zone && list) {
        zone.classList.add('visible');
        list.innerHTML = accroches.map((choice) => `<div class="choice-item" onclick="selectChoice('accroche','${agentId}','${choice.num}',this)"><input type="radio" name="acc-${agentId}"/><label>${choice.text}</label></div>`).join('');
      }
    }

    if (ctas.length > 0) {
      const zone = document.getElementById(`${p}-sel-cta-${agentId}`);
      const list = document.getElementById(`${p}-sel-list-cta-${agentId}`);
      if (zone && list) {
        zone.classList.add('visible');
        list.innerHTML = ctas.map((choice) => `<div class="choice-item" onclick="selectChoice('cta','${agentId}','${choice.num}',this)"><input type="radio" name="cta-${agentId}"/><label>${choice.text}</label></div>`).join('');
      }
    }
  }

  function selectChoice(type, agentId, num, el) {
    el.parentElement.querySelectorAll('.choice-item').forEach((node) => node.classList.remove('selected'));
    el.classList.add('selected');
    el.querySelector('input').checked = true;
    const text = el.querySelector('label').textContent.trim();
    if (type === 'accroche') global.state.selectedAccroche = { num, text };
    if (type === 'cta') global.state.selectedCTA = { num, text };
  }

  function validateAccrocheCTA(agentId) {
    const p = getPfx();
    if (!global.state.selectedAccroche || !global.state.selectedCTA) {
      alert('Choisis une accroche et un CTA.');
      return;
    }

    const output = global.state.outputs[agentId];
    const lines = output.split('\n');
    const result = [];
    let accrocheDone = false;
    let ctaDone = false;

    for (const line of lines) {
      if (line.match(/^A\d+\s*[→:]/)) {
        if (!accrocheDone) {
          result.push(global.state.selectedAccroche.text);
          accrocheDone = true;
        }
        continue;
      }
      if (line.match(/^C\d+\s*[→:]/)) {
        if (!ctaDone) {
          result.push(global.state.selectedCTA.text);
          ctaDone = true;
        }
        continue;
      }
      result.push(line);
    }

    global.state.outputs[`${agentId}_assembled`] = result.join('\n').trim();
    document.getElementById(`${p}-sel-accroche-${agentId}`).classList.remove('visible');
    document.getElementById(`${p}-sel-cta-${agentId}`).classList.remove('visible');
    document.getElementById(`${p}-stat-${agentId}`).textContent = '✓ sélection validée';
    document.getElementById(`${p}-stat-${agentId}`).className = 'agent-status s-done';

    const agents = getAgents();
    const idx = agents.findIndex((agent) => agent.id === agentId);
    (async () => {
      for (let i = idx + 1; i < agents.length; i++) {
        if (agents[i].optional) break;
        const ok = await global.runAgent(agents[i]);
        if (!ok) break;
      }
      global.assembleFinal?.();
    })();
  }

  async function runTitreExplorer() {
    const p = getPfx();
    const btn = document.getElementById(`${p}-bexplore-titre`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⟳ Exploration...';
    }

    const ctx = global.buildCtx('titre');
    const prompt = global.buildPrompt('titre', ctx);
    const explorerPrompt = `${prompt.filled}\n\nMODE EXPLORATION: Génère environ 30 titres. Format : liste numérotée avec compteur de caractères.`;

    try {
      const { text: result } = await global.callClaude('titre', {
        filled: explorerPrompt,
        fixedContent: prompt.fixedContent,
      }, false);

      const lines = result.split('\n').filter((line) => line.match(/^\d+\.\s+/));
      const titres = lines.map((line) => {
        const text = line.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '').trim();
        const charMatch = line.match(/\((\d+)\s*car/i);
        const chars = charMatch ? parseInt(charMatch[1], 10) : text.length;
        return { text, chars };
      });

      document.getElementById('explorerTitle').textContent = '🔭 EXPLORATION TITRES';
      document.getElementById('explorerCount').textContent = `${titres.length} titres`;
      document.getElementById('explorerListLabel').textContent = 'Titres générés — 👍 valider · 👎 blacklister';
      document.getElementById('explorerConversation').value = result;

      modals().ensureLibraryModals?.();
      modals().ensureExplorerManualAddButton?.('titres', 'titre');

      const list = document.getElementById('explorerList');
      list.innerHTML = titres.map((titre, i) => {
        const charColor = titre.chars > 140 ? 'var(--error)' : titre.chars >= 128 ? 'var(--success)' : titre.chars >= 110 ? 'var(--accent)' : 'var(--muted)';
        const safe = titre.text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `<div class="titre-item" id="exp-titre-${i}">
        <span class="titre-text">${titre.text}</span>
        <span class="titre-char" style="color:${charColor};">${titre.chars}</span>
        <div class="titre-actions">
          <button class="titre-thumb" onclick="event.stopPropagation();validateTitreSegment('${safe}');document.getElementById('exp-titre-${i}').classList.add('validated')">👍</button>
          <button class="titre-thumb" onclick="event.stopPropagation();invalidateTitreSegment('${safe}','exp-titre-${i}','titre','explorer');document.getElementById('exp-titre-${i}').classList.add('invalidated')">👎</button>
          <button class="titre-copy" onclick="event.stopPropagation();copyTitreLine('${safe}')">📋</button>
        </div>
      </div>`;
      }).join('');

      document.getElementById('explorerLightbox').classList.add('visible');
      global.showToast?.('Exploration terminée ✓', '#e8c547');
    } catch (error) {
      global.showToast?.(`Erreur: ${error.message}`, '#ff4757');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔭 Explorer';
      }
    }
  }

  global.PipelineUISelections = {
    buildTagsUI,
    validateTag,
    invalidateTag,
    runTagExplorer,
    closeExplorer,
    buildTitreSelectionUI,
    selectTitre,
    updateTitreCounter,
    pasteSelectedTitre,
    validateTitreSegment,
    invalidateTitreSegment,
    copyTitreLine,
    validateTitre,
    parseChoices,
    buildAccrocheCTASelectionUI,
    selectChoice,
    validateAccrocheCTA,
    runTitreExplorer,
  };

  global.PipelineUI.selections = global.PipelineUI.selections || {};
  Object.assign(global.PipelineUI.selections, global.PipelineUISelections);
  Object.assign(global, global.PipelineUISelections);
})(window);
