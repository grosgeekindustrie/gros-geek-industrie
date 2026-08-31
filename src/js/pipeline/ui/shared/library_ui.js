(function initPipelineUILibrary(global) {

// Bibliothèques sémantiques et prompts.
// Ouvre les lightboxes d'édition et synchronise les contenus avec le backend fichier.
// Ne pas y ajouter de logique pipeline : ce module reste centré sur l'édition.
  global.PipelineUI = global.PipelineUI || {};

  const BIBLIO_MAP = {
    tags: { label: 'Tags' },
    accroches: { label: 'Accroches/CTAs' },
    objectif: { label: 'Objectif Global' },
    psycho: { label: 'Psychologie Client' },
    titres: { label: 'Titres validés / blacklist' },
    'bibliotheque-semantique': { label: 'Bibliothèque Sémantique' },
  };

  const getState = () => global.state;
  const getCurrentMode = () => global.currentMode;
  const getConfig = () => global.PipelineUIConfig;
  const getActiveShopKey = () => {
    try {
      const settings = JSON.parse(localStorage.getItem('pipeline.settings') || '{}');
      return String(settings.activeShop || '').trim() === 'doublex' ? 'doublex' : 'grosgeek';
    } catch (error) {
      return 'grosgeek';
    }
  };
  const shouldUseDoublexShopPrompts = () => {
    try {
      const settings = JSON.parse(localStorage.getItem('pipeline.settings') || '{}');
      return settings.doublexUseShopPrompts !== false;
    } catch (error) {
      return true;
    }
  };
  const getPromptFileMapForCurrentContext = (mode = getCurrentMode()) => (
    getConfig().resolvePromptFileMap?.(mode, getActiveShopKey(), { useDoublexShopPrompts: shouldUseDoublexShopPrompts() })
      || (mode === 'collection' ? getConfig().PROMPT_FILE_MAP_COLLECTION : getConfig().PROMPT_FILE_MAP)
  );
  const getPromptFolderForCurrentContext = (mode = getCurrentMode()) => (
    getConfig().resolvePromptFolder?.(mode, getActiveShopKey(), { useDoublexShopPrompts: shouldUseDoublexShopPrompts() })
      || `prompts/${mode}`
  );
  const getActivePromptProfile = () => global.PipelineUIAIProfiles?.snapshotActiveProfile?.()
    || global.PipelineUIAIProfiles?.getActiveProfile?.()
    || { provider: 'anthropic' };
  const getPromptBucket = (mode, profile) => global.PipelineUIPromptProfiles.ensurePipelinePromptBucket(getState(), {
    provider: profile?.provider,
    shopKey: getActiveShopKey(),
    mode,
  });

  let currentBiblioTab = 'tags';
  let currentLbAgentId = null;
  let currentLbPromptSpec = null;
  const getCustomPromptSpec = (id) => global.resolveCustomPromptLightboxSpec?.(id) || null;
  const ensureCustomPromptState = () => {
    const state = getState();
    state.customPrompts = state.customPrompts || {};
    return state.customPrompts;
  };

  function openBiblioLightbox() {
    switchBiblioTab('tags');
    document.getElementById('biblioLightbox').classList.add('visible');
  }

  function closeBiblioLightbox() {
    document.getElementById('biblioLightbox').classList.remove('visible');
  }

  function switchBiblioTab(tab) {
    currentBiblioTab = tab;
    document.querySelectorAll('.biblio-tab').forEach((b) => b.classList.remove('active'));
    document.getElementById(`btab-${tab}`).classList.add('active');
    document.getElementById('biblio-textarea').value = getState().bibliosByMode[getCurrentMode()][tab] || '';
  }

  async function saveBiblio() {
    const key = currentBiblioTab;
    const label = BIBLIO_MAP[key]?.label || key;
    const value = document.getElementById('biblio-textarea').value;
    const mode = getCurrentMode();

    try {
      const res = await fetch(`/files/biblios/${mode}/${key}.md`, { method: 'PUT', body: value });
      if (!res.ok) throw new Error((await res.json()).error);
      getState().bibliosByMode[mode][key] = value;
      closeBiblioLightbox();
      showToast(`${label} sauvegardé`);
    } catch (e) {
      showToast(`Erreur: ${e.message}`, '#ff4757');
    }
  }

  async function resetBiblio() {
    const key = currentBiblioTab;
    const label = BIBLIO_MAP[key]?.label || key;
    const mode = getCurrentMode();

    try {
      const res = await fetch(`/files/biblios/${mode}/${key}.md`);
      if (!res.ok) throw new Error((await res.json()).error);
      const txt = await res.text();
      getState().bibliosByMode[mode][key] = txt;
      document.getElementById('biblio-textarea').value = txt;
      showToast(`${label} rechargé`);
    } catch (e) {
      showToast(`Erreur: ${e.message}`, '#ff4757');
    }
  }

  async function openPromptLightbox(id) {
    currentLbAgentId = id;
    currentLbPromptSpec = null;
    const mode = getCurrentMode();
    const customPromptSpec = getCustomPromptSpec(id);
    if (customPromptSpec) {
      const promptProfile = getActivePromptProfile();
      currentLbPromptSpec = global.PipelineUIPromptProfiles.resolveCustomPromptSpec({
        id,
        label: String(customPromptSpec.label || id).trim() || id,
        path: String(customPromptSpec.path || '').trim(),
        stateKey: String(customPromptSpec.stateKey || id).trim() || id,
      }, promptProfile);

      if (!currentLbPromptSpec.path) {
        showToast('Erreur: chemin prompt custom manquant', '#ff4757');
        return;
      }

      const customPrompts = ensureCustomPromptState();
      if (!customPrompts[currentLbPromptSpec.stateKey]) {
        try {
          const res = await fetch(`/files/${currentLbPromptSpec.path}`);
          if (!res.ok) throw new Error((await res.json()).error);
          customPrompts[currentLbPromptSpec.stateKey] = await res.text();
        } catch (e) {
          showToast(`Erreur: ${e.message}`, '#ff4757');
          return;
        }
      }

      const customTitleEl = document.getElementById('lbTitle');
      global.PipelineUIIcons?.setIconLabel?.(customTitleEl, 'settings', `Prompt ${currentLbPromptSpec.familyLabel} — ${currentLbPromptSpec.label}`);
      document.getElementById('lbTextarea').value = customPrompts[currentLbPromptSpec.stateKey] || '';
      document.getElementById('promptLightbox').classList.add('visible');
      return;
    }

    const tagLabels = {
      tags: 'Axel · Explore Tags',
      tags_filter: 'Céline · Filter Tags',
      tags_select: 'Axel · Select Tags',
    };
    const agents = getConfig().getPipelineAgents();
    const label = tagLabels[id] || agents.find((a) => a.id === id)?.title || id;
    const promptProfile = getActivePromptProfile();
    const promptBucket = getPromptBucket(mode, promptProfile);
    let promptValue = promptBucket[id] || '';
    const map = getPromptFileMapForCurrentContext(mode);
    const canonicalPromptFolder = getPromptFolderForCurrentContext(mode);
    const promptFolder = global.PipelineUIPromptProfiles.resolvePromptFolder(canonicalPromptFolder, promptProfile);
    const fileName = (map && map[id]) || id;
    currentLbPromptSpec = {
      id,
      label,
      path: `${promptFolder}/${fileName}.md`,
      stateKey: id,
      provider: promptProfile.provider,
      familyLabel: global.PipelineUIPromptProfiles.getPromptFamilyLabel(promptProfile),
      promptBucket,
      isPipelinePrompt: true,
    };

    if (!promptValue) {
      try {
        const res = await fetch(`/files/${currentLbPromptSpec.path}`);
        if (!res.ok) throw new Error((await res.json()).error);
        promptValue = await res.text();
        promptBucket[id] = promptValue;
      } catch (e) {
        showToast(`Erreur: ${e.message}`, '#ff4757');
        return;
      }
    }

    const titleEl = document.getElementById('lbTitle');
    global.PipelineUIIcons?.setIconLabel?.(titleEl, 'settings', `Prompt ${currentLbPromptSpec.familyLabel} — ${label}`);
    document.getElementById('lbTextarea').value = promptValue;
    document.getElementById('promptLightbox').classList.add('visible');
  }

  function closePromptLightbox() {
    document.getElementById('promptLightbox').classList.remove('visible');
    currentLbAgentId = null;
    currentLbPromptSpec = null;
  }

  async function saveLbPrompt() {
    if (!currentLbAgentId) return;

    if (currentLbPromptSpec?.path) {
      if (!confirm(`Écraser ${currentLbPromptSpec.path} sur le disque ?`)) return;

      const customValue = document.getElementById('lbTextarea').value;
      try {
        const res = await fetch(`/files/${currentLbPromptSpec.path}`, { method: 'PUT', body: customValue });
        if (!res.ok) throw new Error((await res.json()).error);
        if (currentLbPromptSpec.isPipelinePrompt) {
          currentLbPromptSpec.promptBucket[currentLbAgentId] = customValue;
        } else {
          ensureCustomPromptState()[currentLbPromptSpec.stateKey] = customValue;
        }
        closePromptLightbox();
        showToast('Prompt sauvegardé');
      } catch (e) {
        showToast(`Erreur: ${e.message}`, '#ff4757');
      }
      return;
    }

    showToast('Erreur: contexte prompt manquant', '#ff4757');
  }

  async function resetLbPrompt() {
    if (!currentLbAgentId) return;

    if (currentLbPromptSpec?.path) {
      if (!confirm(`Recharger ${currentLbPromptSpec.path} depuis le disque ?`)) return;

      try {
        const res = await fetch(`/files/${currentLbPromptSpec.path}`);
        if (!res.ok) throw new Error((await res.json()).error);
        const txt = await res.text();
        if (currentLbPromptSpec.isPipelinePrompt) {
          currentLbPromptSpec.promptBucket[currentLbAgentId] = txt;
        } else {
          ensureCustomPromptState()[currentLbPromptSpec.stateKey] = txt;
        }
        document.getElementById('lbTextarea').value = txt;
        showToast('Rechargé depuis le fichier');
      } catch (e) {
        showToast(`Erreur: ${e.message}`, '#ff4757');
      }
      return;
    }

    showToast('Erreur: contexte prompt manquant', '#ff4757');
  }

  global.PipelineUILibrary = {
    openBiblioLightbox,
    closeBiblioLightbox,
    switchBiblioTab,
    saveBiblio,
    resetBiblio,
    openPromptLightbox,
    closePromptLightbox,
    saveLbPrompt,
    resetLbPrompt,
  };

  global.PipelineUI.library = global.PipelineUI.library || {};
  Object.assign(global.PipelineUI.library, global.PipelineUILibrary);
  Object.assign(global, global.PipelineUILibrary);
})(window);
