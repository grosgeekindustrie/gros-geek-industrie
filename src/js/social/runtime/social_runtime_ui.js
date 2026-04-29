'use strict';

(function initPipelineUISocialRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};
  const sharedConstants = global.PipelineUISharedConstants || {};
  const storage = global.PipelineUIStorage || {};
  const STORAGE_KEYS = sharedConstants.STORAGE_KEYS || {
    APP_SETTINGS: 'pipeline.settings',
  };
  const updateAppSettings = storage.updateAppSettings || ((updater) => {
    let settings = {};
    try {
      settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.APP_SETTINGS) || '{}');
    } catch (_error) {}
    updater(settings);
    localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(settings));
  });
  const SOCIAL_FORMAT_LABELS = Object.freeze({
    instagram: 'INSTAGRAM/TIKTOK',
    facebook: 'FACEBOOK',
    marketplace: 'FACEBOOK MARKETPLACE',
  });
  const SOCIAL_SECTION_KEY_MAP = Object.freeze({
    insta: 'insta',
    fb: 'fb',
    marketplace: 'marketplace',
    pinterest: 'pinterest',
    pinterestTitre: 'pinterestTitre',
    pinterestDesc: 'pinterestDesc',
    pinterestAlt: 'pinterestAlt',
  });
  const SOCIAL_TOGGLE_CLOSED_LABEL = '📋 Fiche déjà publiée';
  const SOCIAL_TOGGLE_OPEN_LABEL = '✕ Fermer';

  function getSocialNode(prefix, role, root = document) {
    return root.querySelector?.(`[data-social-role="${role}"][data-prefix="${prefix}"]`) || null;
  }

  function getSocialAgentNode(prefix, agentId, part, root = document) {
    return root.querySelector?.(
      `[data-social-agent="${part}"][data-agent-id="${agentId}"][data-prefix="${prefix}"]`,
    ) || null;
  }

  function getSocialRunButton(prefix, buttonId) {
    if (buttonId === `runLeoBtn-${prefix}`) {
      return document.querySelector(`[data-ui-action="run-leo-agent"][data-action-arg="${prefix}"]`);
    }
    if (buttonId === `runCamilleBtn-${prefix}`) {
      return document.querySelector(`[data-ui-action="run-camille-agent"][data-action-arg="${prefix}"]`);
    }
    return document.getElementById(buttonId);
  }

  function refreshSocialTabs(prefix, { activate = false } = {}) {
    if (prefix !== 'tt' && prefix !== 'col') return;
    global.refreshSoloTabs?.(prefix);
    if (activate) global.activateSoloTab?.(prefix, 'social', { force: true });
  }

  function resetSocialContentSections(prefix) {
    [
      'ss-insta',
      'ss-fb',
      'ss-marketplace',
      'ss-pinterest',
      'sc-pinterest-titre',
      'sc-pinterest-desc-wrap',
      'sc-pinterest-alt-wrap',
    ].forEach((role) => {
      const element = getSocialNode(prefix, role);
      if (element) element.style.display = 'none';
    });
  }

  function resetSocialRuntimePanels(prefix) {
    [
      'section',
      'social-output',
      'reseaux-only',
    ].forEach((role) => {
      const element = getSocialNode(prefix, role);
      if (element) element.style.display = 'none';
    });

    resetSocialContentSections(prefix);
    const toggleButton = getSocialNode(prefix, 'toggle-reseaux-only');
    if (toggleButton) toggleButton.textContent = SOCIAL_TOGGLE_CLOSED_LABEL;
    global.state.socialSections = {};
  }

  function showSocialEntryPanel(prefix) {
    const section = getSocialNode(prefix, 'section');
    if (section) section.style.display = 'block';
    refreshSocialTabs(prefix);
  }

  function moveSocialPanelsToPipelineBody(prefix, pipelineBody) {
    if (!pipelineBody) return;

    [
      'section',
      'social-output',
      'reseaux-only',
    ].forEach((role) => {
      const element = getSocialNode(prefix, role);
      if (element) pipelineBody.appendChild(element);
    });
  }

  function getSocialSelectedFormats(prefix) {
    const formats = [];
    if (getSocialNode(prefix, 'soc-insta')?.checked) formats.push(SOCIAL_FORMAT_LABELS.instagram);
    if (getSocialNode(prefix, 'soc-fb')?.checked) formats.push(SOCIAL_FORMAT_LABELS.facebook);
    if (getSocialNode(prefix, 'soc-marketplace')?.checked) formats.push(SOCIAL_FORMAT_LABELS.marketplace);
    return formats;
  }

  function getSocialAgentRefs(prefix, agentId) {
    return {
      card: getSocialAgentNode(prefix, agentId, 'card'),
      stat: getSocialAgentNode(prefix, agentId, 'stat'),
      out: getSocialAgentNode(prefix, agentId, 'out'),
      stopBtn: getSocialAgentNode(prefix, agentId, 'stop'),
    };
  }

  function beginSocialAgentRun(prefix, agentId, buttonId) {
    const refs = getSocialAgentRefs(prefix, agentId);
    const button = getSocialRunButton(prefix, buttonId);

    if (refs.card) refs.card.className = 'agent-card active';
    if (refs.stat) {
      refs.stat.className = 'agent-status s-run';
      refs.stat.textContent = 'âŸ³ gÃ©nÃ©ration...';
    }
    if (refs.out) {
      refs.out.className = 'output-box';
      refs.out.textContent = '';
    }
    if (button) button.disabled = true;
    if (refs.stopBtn) refs.stopBtn.style.display = 'inline-flex';
    global.toggleCard?.(`${agentId}-${prefix}`);

    return { refs, button };
  }

  function finalizeSocialAgentSuccess(prefix, agentId, refs, result) {
    global.state.outputs[agentId] = result;
    if (refs.out) refs.out.textContent = result;
    if (refs.card) refs.card.className = 'agent-card done';
    if (refs.stat) {
      refs.stat.className = 'agent-status s-done';
      refs.stat.textContent = 'âœ“ done';
    }
    refreshSocialTabs(prefix);
  }

  function finalizeSocialAgentError(prefix, refs, error) {
    if (refs.out) refs.out.textContent = `âŒ ${error.message}`;
    if (refs.card) refs.card.className = 'agent-card error';
    if (refs.stat) {
      refs.stat.className = 'agent-status s-err';
      refs.stat.textContent = 'âœ— erreur';
    }
    refreshSocialTabs(prefix);
  }

  function buildSocialAgentContext(agentId, formats = [], correction = '', overrides = {}) {
    const ctx = global.buildCtx(agentId);
    if (formats.length > 0) ctx.social_formats = formats.join(', ');
    if (correction) ctx.correction = correction;
    if (overrides.nom) {
      ctx.nom = overrides.nom;
      ctx.nomCourt = overrides.nom;
    }
    if (overrides.sculpteur) ctx.sculpteur = overrides.sculpteur;
    if (overrides.echelles) ctx.echelles = overrides.echelles;
    if (overrides.url) ctx.url_boutique = overrides.url;
    return ctx;
  }

  async function runLeoAgent(prefix, options = {}) {
    const formats = getSocialSelectedFormats(prefix);
    if (formats.length === 0) {
      global.showToast('Coche au moins un reseau', '#ff4757');
      return;
    }

    const { refs, button } = beginSocialAgentRun(prefix, 'social', `runLeoBtn-${prefix}`);
    const correction = getSocialNode(prefix, 'cor-social')?.value || '';
    const ctx = buildSocialAgentContext('social', formats, correction, options);
    const prompt = global.buildPrompt('social', ctx);
    global.state.inputs.social = prompt.filled;

    try {
      const { text: result, usage } = await global.callClaude('social', prompt, false);
      finalizeSocialAgentSuccess(prefix, 'social', refs, result);
      global.showAgentCost('social', usage, { prefix, source: 'social' });
      global.syncCacheIndicator(usage);
      displaySocialOutput(result, prefix);
      global.showToast('Generation OK');
    } catch (error) {
      finalizeSocialAgentError(prefix, refs, error);
      global.showToast(`Erreur: ${error.message}`, '#ff4757');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'â–¶ GÃ©nÃ©rer';
      }
      if (refs.stopBtn) refs.stopBtn.style.display = 'none';
    }
  }

  async function runCamilleAgent(prefix, options = {}) {
    if (!getSocialNode(prefix, 'soc-pinterest')?.checked) {
      global.showToast(`Active Pinterest pour ${global.currentMode === 'collection' ? 'Zoe' : 'Camille'} !`, '#ff4757');
      return;
    }

    const { refs, button } = beginSocialAgentRun(prefix, 'camille', `runCamilleBtn-${prefix}`);
    const correction = getSocialNode(prefix, 'cor-camille')?.value || '';
    const ctx = buildSocialAgentContext('camille', [], correction, options);
    const prompt = global.buildPrompt('camille', ctx);
    global.state.inputs.camille = prompt.filled;

    try {
      const { text: result, usage } = await global.callClaude('camille', prompt, false);
      finalizeSocialAgentSuccess(prefix, 'camille', refs, result);
      global.showAgentCost('camille', usage, { prefix, source: 'camille' });
      global.syncCacheIndicator(usage);
      displayCamilleOutput(result, prefix);
      global.showToast('Generation OK');
    } catch (error) {
      finalizeSocialAgentError(prefix, refs, error);
      global.showToast(`Erreur: ${error.message}`, '#ff4757');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'â–¶ GÃ©nÃ©rer';
      }
      if (refs.stopBtn) refs.stopBtn.style.display = 'none';
    }
  }

  function toggleReseauxOnly(prefix) {
    const section = getSocialNode(prefix, 'reseaux-only');
    const button = getSocialNode(prefix, 'toggle-reseaux-only');
    if (!section) return;

    const isVisible = section.style.display !== 'none';
    section.style.display = isVisible ? 'none' : 'block';
    if (button) button.textContent = isVisible ? SOCIAL_TOGGLE_CLOSED_LABEL : SOCIAL_TOGGLE_OPEN_LABEL;
    refreshSocialTabs(prefix, { activate: !isVisible });
  }

  function displaySocialOutput(result, prefix) {
    const sections = parseSocialSections(result);
    global.state.socialSections = sections;
    resetSocialContentSections(prefix);

    const socialOutput = getSocialNode(prefix, 'social-output');
    if (socialOutput) {
      socialOutput.style.display = 'flex';
      socialOutput.style.flexDirection = 'column';
    }

    const showSection = (id, content) => {
      if (!content) return;
      const wrap = getSocialNode(prefix, `ss-${id}`);
      if (wrap) wrap.style.display = 'block';
      const element = getSocialNode(prefix, `sc-${id}`);
      if (element) element.textContent = content;
    };

    showSection('insta', sections.insta);
    showSection('fb', sections.fb);
    showSection('marketplace', sections.marketplace);

    if (sections.pinterest || sections.pinterestTitre || sections.pinterestDesc || sections.pinterestAlt) {
      const wrap = getSocialNode(prefix, 'ss-pinterest');
      if (wrap) wrap.style.display = 'block';

      if (sections.pinterestTitre) {
        const titleWrap = getSocialNode(prefix, 'sc-pinterest-titre');
        const titleContent = getSocialNode(prefix, 'sc-pinterest-t');
        if (titleWrap) titleWrap.style.display = 'block';
        if (titleContent) titleContent.textContent = sections.pinterestTitre;
      }

      if (sections.pinterestDesc) {
        const descWrap = getSocialNode(prefix, 'sc-pinterest-desc-wrap');
        const descContent = getSocialNode(prefix, 'sc-pinterest-d');
        if (descWrap) descWrap.style.display = 'block';
        if (descContent) descContent.textContent = sections.pinterestDesc;
      }

      if (sections.pinterestAlt) {
        const altWrap = getSocialNode(prefix, 'sc-pinterest-alt-wrap');
        const altContent = getSocialNode(prefix, 'sc-pinterest-a');
        if (altWrap) altWrap.style.display = 'block';
        if (altContent) altContent.textContent = sections.pinterestAlt;
      }

      if (!sections.pinterestTitre && !sections.pinterestDesc) {
        const descWrap = getSocialNode(prefix, 'sc-pinterest-desc-wrap');
        const descContent = getSocialNode(prefix, 'sc-pinterest-d');
        if (descWrap) descWrap.style.display = 'block';
        if (descContent) descContent.textContent = sections.pinterest;
      }
    }

    refreshSocialTabs(prefix, { activate: true });
  }

  function displayCamilleOutput(result, prefix) {
    displaySocialOutput(result, prefix);
  }

  async function runReseauxOnly(type, prefix) {
    const nom = getSocialNode(prefix, 'ro-nom')?.value || '';
    const sculpteur = getSocialNode(prefix, 'ro-sculpteur')?.value || '';
    const url = getSocialNode(prefix, 'ro-url')?.value || '';
    const echelles = getSocialNode(prefix, 'ro-echelles')?.value || '';
    const accroche = getSocialNode(prefix, 'ro-accroche')?.value || '';
    const cta = getSocialNode(prefix, 'ro-cta')?.value || '';
    const titre = getSocialNode(prefix, 'ro-titre')?.value || '';

    const previousAccroche = global.state.selectedAccroche;
    const previousCTA = global.state.selectedCTA;
    const previousTitre = global.state.outputs.titre_valide;
    const nomInput = document.getElementById(`${prefix}-fNom`);
    const sculpteurInput = document.getElementById(`${prefix}-fSculpteur`);
    const shopUrlInput = document.getElementById('shopUrl');
    const nomCourtInput = document.getElementById(`${prefix}-fNomCourt`);
    const previousNom = nomInput?.value || '';
    const previousSculpteur = sculpteurInput?.value || '';
    const previousUrl = shopUrlInput?.value || '';
    const previousNomCourt = nomCourtInput?.value || '';

    if (accroche) global.state.selectedAccroche = { text: accroche };
    if (cta) global.state.selectedCTA = { text: cta };
    if (titre) global.state.outputs.titre_valide = titre;
    if (nom && nomInput) nomInput.value = nom;
    if (sculpteur && sculpteurInput) sculpteurInput.value = sculpteur;
    if (nom && nomCourtInput) nomCourtInput.value = nom;

    if (url && shopUrlInput) {
      shopUrlInput.value = url;
      updateAppSettings((settings) => {
        settings.shopUrl = url;
      });
    }

    try {
      const socialOverrides = { nom, sculpteur, echelles, url };
      if (type === 'leo' || type === 'both') await runLeoAgent(prefix, socialOverrides);
      if (type === 'camille' || type === 'both') await runCamilleAgent(prefix, socialOverrides);
    } finally {
      global.state.selectedAccroche = previousAccroche;
      global.state.selectedCTA = previousCTA;
      global.state.outputs.titre_valide = previousTitre;
      if (nomInput) nomInput.value = previousNom;
      if (nomCourtInput) nomCourtInput.value = previousNomCourt;
      if (sculpteurInput) sculpteurInput.value = previousSculpteur;
      if (shopUrlInput) {
        shopUrlInput.value = previousUrl;
        updateAppSettings((settings) => {
          settings.shopUrl = previousUrl || 'https://grosgeekindustrie.etsy.com';
        });
      }
    }
  }

  function parseSocialSections(output) {
    const sections = {
      insta: '',
      fb: '',
      marketplace: '',
      pinterest: '',
      pinterestTitre: '',
      pinterestDesc: '',
      pinterestAlt: '',
    };
    const clean = String(output || '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^\s{0,3}#{1,3}\s+/gm, '');
    const parts = clean.split(/(?:^|\n)\s*(INSTAGRAM(?:\/TIKTOK)?|TIKTOK|FACEBOOK MARKETPLACE|FACEBOOK|PINTEREST)\s*\n/im);

    for (let index = 1; index < parts.length; index += 2) {
      const marker = (parts[index] || '').trim().toLowerCase();
      const content = (parts[index + 1] || '').trim();
      if (marker.includes('instagram') || marker === 'tiktok') sections.insta = content;
      else if (marker.includes('facebook marketplace')) sections.marketplace = content;
      else if (marker.includes('facebook')) sections.fb = content;
      else if (marker.includes('pinterest')) {
        sections.pinterest = content;
        const pinterestBlocks = content.split(/\n---+\n/);
        if (pinterestBlocks[0]) sections.pinterestTitre = pinterestBlocks[0].replace(/^TITRE PINTEREST\s*:\s*/i, '').trim();
        if (pinterestBlocks[1]) sections.pinterestDesc = pinterestBlocks[1].replace(/^DESCRIPTION PINTEREST\s*:\s*/i, '').trim();
        if (pinterestBlocks[2]) sections.pinterestAlt = pinterestBlocks[2].replace(/^BALISE ALT PINTEREST\s*:\s*/i, '').trim();
      }
    }

    if (!sections.insta && parts[0] && parts[0].trim().length > 20) sections.insta = parts[0].trim();
    if (!sections.insta && !sections.fb && !sections.pinterest) sections.insta = clean.trim();
    return sections;
  }

  function copySocialSection(id) {
    navigator.clipboard.writeText(global.state.socialSections?.[SOCIAL_SECTION_KEY_MAP[id]] || '')
      .then(() => global.showToast('Copie OK'))
      .catch(() => global.showToast('Copie impossible', '#ff4757'));
  }

  function copySocial() {
    navigator.clipboard.writeText(global.state.outputs.social || '')
      .then(() => global.showToast('Copie OK'))
      .catch(() => global.showToast('Copie impossible', '#ff4757'));
  }

  global.PipelineUISocialRuntime = {
    resetSocialContentSections,
    resetSocialRuntimePanels,
    showSocialEntryPanel,
    moveSocialPanelsToPipelineBody,
    buildSocialAgentContext,
    getSocialSelectedFormats,
    runLeoAgent,
    runCamilleAgent,
    toggleReseauxOnly,
    displaySocialOutput,
    displayCamilleOutput,
    runReseauxOnly,
    parseSocialSections,
    copySocialSection,
    copySocial,
  };

  global.PipelineUI.runtimeSocial = global.PipelineUI.runtimeSocial || {};
  Object.assign(global.PipelineUI.runtimeSocial, global.PipelineUISocialRuntime);
  Object.assign(global, global.PipelineUISocialRuntime);
})(window);
