'use strict';

(function initPipelineUISocialRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};
  const sharedConstants = global.PipelineUISharedConstants || {};
  const STORAGE_KEYS = sharedConstants.STORAGE_KEYS || {
    APP_SETTINGS: 'pipeline.settings',
  };
  const APP_DEFAULTS = sharedConstants.APP_DEFAULTS || {
    SHOP_URL: 'https://grosgeekindustrie.etsy.com',
  };
  const APP_SETTINGS_STORAGE_KEY = STORAGE_KEYS.APP_SETTINGS;
  const DEFAULT_SHOP_URL = APP_DEFAULTS.SHOP_URL;
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

  const readAppSettings = () => {
    try {
      return JSON.parse(localStorage.getItem(APP_SETTINGS_STORAGE_KEY) || '{}');
    } catch (_error) {
      return {};
    }
  };

  const writeAppSettings = (nextSettings) => {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  };

  function refreshSocialTabs(prefix, { activate = false } = {}) {
    if (prefix !== 'tt' && prefix !== 'col') return;
    global.refreshSoloTabs?.(prefix);
    if (activate) global.activateSoloTab?.(prefix, 'social', { force: true });
  }

  function resetSocialContentSections(prefix) {
    [
      `ss-insta-${prefix}`,
      `ss-fb-${prefix}`,
      `ss-marketplace-${prefix}`,
      `ss-pinterest-${prefix}`,
      `sc-pinterest-titre-${prefix}`,
      `sc-pinterest-desc-wrap-${prefix}`,
      `sc-pinterest-alt-wrap-${prefix}`,
    ].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.style.display = 'none';
    });
  }

  function resetSocialRuntimePanels(prefix) {
    [
      `socialSection-${prefix}`,
      `socialOutput-${prefix}`,
      `reseauxOnlySection-${prefix}`,
    ].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.style.display = 'none';
    });

    resetSocialContentSections(prefix);
    const toggleButton = document.getElementById(`toggleReseauxOnlyBtn-${prefix}`);
    if (toggleButton) toggleButton.textContent = 'ðŸ“‹ Fiche dÃ©jÃ  publiÃ©e';
    global.state.socialSections = {};
  }

  function showSocialEntryPanel(prefix) {
    const section = document.getElementById(`socialSection-${prefix}`);
    if (section) section.style.display = 'block';
    refreshSocialTabs(prefix);
  }

  function moveSocialPanelsToPipelineBody(prefix, pipelineBody) {
    if (!pipelineBody) return;

    [
      `socialSection-${prefix}`,
      `socialOutput-${prefix}`,
      `reseauxOnlySection-${prefix}`,
    ].forEach((id) => {
      const element = document.getElementById(id);
      if (element) pipelineBody.appendChild(element);
    });
  }

  function getSocialSelectedFormats(prefix) {
    const formats = [];
    if (document.getElementById(`soc-insta-${prefix}`)?.checked) formats.push(SOCIAL_FORMAT_LABELS.instagram);
    if (document.getElementById(`soc-fb-${prefix}`)?.checked) formats.push(SOCIAL_FORMAT_LABELS.facebook);
    if (document.getElementById(`soc-marketplace-${prefix}`)?.checked) formats.push(SOCIAL_FORMAT_LABELS.marketplace);
    return formats;
  }

  function getSocialAgentRefs(prefix, agentId) {
    return {
      card: document.getElementById(`card-${agentId}-${prefix}`),
      stat: document.getElementById(`stat-${agentId}-${prefix}`),
      out: document.getElementById(`out-${agentId}-${prefix}`),
      stopBtn: document.getElementById(`bstop-${agentId}-${prefix}`),
    };
  }

  function beginSocialAgentRun(prefix, agentId, buttonId) {
    const refs = getSocialAgentRefs(prefix, agentId);
    const button = document.getElementById(buttonId);

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
      global.showToast('Coche au moins un rÃ©seau !', '#ff4757');
      return;
    }

    const { refs, button } = beginSocialAgentRun(prefix, 'social', `runLeoBtn-${prefix}`);
    const correction = document.getElementById(`cor-social-${prefix}`)?.value || '';
    const ctx = buildSocialAgentContext('social', formats, correction, options);
    const prompt = global.buildPrompt('social', ctx);
    global.state.inputs.social = prompt.filled;

    try {
      const { text: result, usage } = await global.callClaude('social', prompt, false);
      finalizeSocialAgentSuccess(prefix, 'social', refs, result);
      global.showAgentCost('social', usage, { prefix, source: 'social' });
      global.syncCacheIndicator(usage);
      displaySocialOutput(result, prefix);
      global.showToast('Posts gÃ©nÃ©rÃ©s âœ“');
    } catch (error) {
      finalizeSocialAgentError(prefix, refs, error);
      global.showToast(`âŒ ${error.message}`, '#ff4757');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'â–¶ GÃ©nÃ©rer';
      }
      if (refs.stopBtn) refs.stopBtn.style.display = 'none';
    }
  }

  async function runCamilleAgent(prefix, options = {}) {
    if (!document.getElementById(`soc-pinterest-${prefix}`)?.checked) {
      global.showToast(`Active Pinterest pour ${global.currentMode === 'collection' ? 'Zoe' : 'Camille'} !`, '#ff4757');
      return;
    }

    const { refs, button } = beginSocialAgentRun(prefix, 'camille', `runCamilleBtn-${prefix}`);
    const correction = document.getElementById(`cor-camille-${prefix}`)?.value || '';
    const ctx = buildSocialAgentContext('camille', [], correction, options);
    const prompt = global.buildPrompt('camille', ctx);
    global.state.inputs.camille = prompt.filled;

    try {
      const { text: result, usage } = await global.callClaude('camille', prompt, false);
      finalizeSocialAgentSuccess(prefix, 'camille', refs, result);
      global.showAgentCost('camille', usage, { prefix, source: 'camille' });
      global.syncCacheIndicator(usage);
      displayCamilleOutput(result, prefix);
      global.showToast('Pinterest gÃ©nÃ©rÃ© âœ“');
    } catch (error) {
      finalizeSocialAgentError(prefix, refs, error);
      global.showToast(`âŒ ${error.message}`, '#ff4757');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'â–¶ GÃ©nÃ©rer';
      }
      if (refs.stopBtn) refs.stopBtn.style.display = 'none';
    }
  }

  function toggleReseauxOnly(prefix) {
    const section = document.getElementById(`reseauxOnlySection-${prefix}`);
    const button = document.getElementById(`toggleReseauxOnlyBtn-${prefix}`);
    if (!section) return;

    const isVisible = section.style.display !== 'none';
    section.style.display = isVisible ? 'none' : 'block';
    if (button) button.textContent = isVisible ? 'ðŸ“‹ Fiche dÃ©jÃ  publiÃ©e' : 'âœ• Fermer';
    refreshSocialTabs(prefix, { activate: !isVisible });
  }

  function displaySocialOutput(result, prefix) {
    const sections = parseSocialSections(result);
    global.state.socialSections = sections;
    resetSocialContentSections(prefix);

    const socialOutput = document.getElementById(`socialOutput-${prefix}`);
    if (socialOutput) {
      socialOutput.style.display = 'flex';
      socialOutput.style.flexDirection = 'column';
    }

    const showSection = (id, content) => {
      if (!content) return;
      const wrap = document.getElementById(`ss-${id}-${prefix}`);
      if (wrap) wrap.style.display = 'block';
      const element = document.getElementById(`sc-${id}-${prefix}`);
      if (element) element.textContent = content;
    };

    showSection('insta', sections.insta);
    showSection('fb', sections.fb);
    showSection('marketplace', sections.marketplace);

    if (sections.pinterest || sections.pinterestTitre || sections.pinterestDesc || sections.pinterestAlt) {
      const wrap = document.getElementById(`ss-pinterest-${prefix}`);
      if (wrap) wrap.style.display = 'block';

      if (sections.pinterestTitre) {
        const titleWrap = document.getElementById(`sc-pinterest-titre-${prefix}`);
        const titleContent = document.getElementById(`sc-pinterest-t-${prefix}`);
        if (titleWrap) titleWrap.style.display = 'block';
        if (titleContent) titleContent.textContent = sections.pinterestTitre;
      }

      if (sections.pinterestDesc) {
        const descWrap = document.getElementById(`sc-pinterest-desc-wrap-${prefix}`);
        const descContent = document.getElementById(`sc-pinterest-d-${prefix}`);
        if (descWrap) descWrap.style.display = 'block';
        if (descContent) descContent.textContent = sections.pinterestDesc;
      }

      if (sections.pinterestAlt) {
        const altWrap = document.getElementById(`sc-pinterest-alt-wrap-${prefix}`);
        const altContent = document.getElementById(`sc-pinterest-a-${prefix}`);
        if (altWrap) altWrap.style.display = 'block';
        if (altContent) altContent.textContent = sections.pinterestAlt;
      }

      if (!sections.pinterestTitre && !sections.pinterestDesc) {
        const descWrap = document.getElementById(`sc-pinterest-desc-wrap-${prefix}`);
        const descContent = document.getElementById(`sc-pinterest-d-${prefix}`);
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
    const nom = document.getElementById(`ro-nom-${prefix}`)?.value || '';
    const sculpteur = document.getElementById(`ro-sculpteur-${prefix}`)?.value || '';
    const url = document.getElementById(`ro-url-${prefix}`)?.value || '';
    const echelles = document.getElementById(`ro-echelles-${prefix}`)?.value || '';
    const accroche = document.getElementById(`ro-accroche-${prefix}`)?.value || '';
    const cta = document.getElementById(`ro-cta-${prefix}`)?.value || '';
    const titre = document.getElementById(`ro-titre-${prefix}`)?.value || '';

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
      const settings = readAppSettings();
      settings.shopUrl = url;
      writeAppSettings(settings);
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
        const settings = readAppSettings();
        settings.shopUrl = previousUrl || DEFAULT_SHOP_URL;
        writeAppSettings(settings);
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
    navigator.clipboard.writeText(global.state.socialSections?.[SOCIAL_SECTION_KEY_MAP[id]] || '');
    global.showToast('CopiÃ© âœ“');
  }

  function copySocial() {
    navigator.clipboard.writeText(global.state.outputs.social || '');
    global.showToast('Posts copiÃ©s âœ“');
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
