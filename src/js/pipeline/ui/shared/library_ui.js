(function initPipelineUILibrary(global) {

// Bibliothèques sémantiques et prompts.
// Ouvre les lightboxes d'édition et synchronise les contenus avec le backend fichier.
// Ne pas y ajouter de logique pipeline : ce module reste centré sur l'édition.
  global.PipelineUI = global.PipelineUI || {};
  const files = global.PipelineUIFiles || {};

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
  const getConfig = () => global.PipelineUIConfig || {};
  const readLibraryMarkdown = files.readLibraryMarkdown;
  const writeLibraryMarkdown = files.writeLibraryMarkdown;
  const readPromptMarkdown = files.readPromptMarkdown;
  const writePromptMarkdown = files.writePromptMarkdown;

  let currentBiblioTab = 'tags';
  let currentLbAgentId = null;

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
      await writeLibraryMarkdown(mode, key, value);
      getState().bibliosByMode[mode][key] = value;
      closeBiblioLightbox();
      global.showToast?.(`${label} sauvegardé ✓`);
    } catch (e) {
      global.showToast?.(`Erreur: ${e.message}`, '#ff4757');
    }
  }

  async function resetBiblio() {
    const key = currentBiblioTab;
    const label = BIBLIO_MAP[key]?.label || key;
    const mode = getCurrentMode();

    try {
      const txt = await readLibraryMarkdown(mode, key);
      getState().bibliosByMode[mode][key] = txt;
      document.getElementById('biblio-textarea').value = txt;
      global.showToast?.(`${label} rechargé ✓`);
    } catch (e) {
      global.showToast?.(`Erreur: ${e.message}`, '#ff4757');
    }
  }

  function openPromptLightbox(id) {
    currentLbAgentId = id;
    const tagLabels = {
      tags: 'Axel · Explore Tags',
      tags_filter: 'Céline · Filter Tags',
      tags_select: 'Axel · Select Tags',
    };
    const agents = typeof getConfig().getPipelineAgents === 'function'
      ? getConfig().getPipelineAgents()
      : [];
    const label = tagLabels[id] || agents.find((a) => a.id === id)?.title || id;

    document.getElementById('lbTitle').textContent = `⚙️ PROMPT — ${label}`;
    document.getElementById('lbTextarea').value = getState().promptsByMode[getCurrentMode()][id] || '';
    document.getElementById('promptLightbox').classList.add('visible');
  }

  function closePromptLightbox() {
    document.getElementById('promptLightbox').classList.remove('visible');
    currentLbAgentId = null;
  }

  async function saveLbPrompt() {
    if (!currentLbAgentId) return;

    const config = getConfig();
    const mode = getCurrentMode();
    const map = mode === 'collection' ? config.PROMPT_FILE_MAP_COLLECTION : config.PROMPT_FILE_MAP;
    const fname = (map && map[currentLbAgentId]) || currentLbAgentId;
    if (!confirm(`Écraser prompts/${mode}/${fname}.md sur le disque ?`)) return;

    const val = document.getElementById('lbTextarea').value;
    try {
      await writePromptMarkdown(mode, fname, val);
      getState().promptsByMode[mode][currentLbAgentId] = val;
      closePromptLightbox();
      global.showToast?.('Prompt sauvegardé ✓');
    } catch (e) {
      global.showToast?.(`Erreur: ${e.message}`, '#ff4757');
    }
  }

  async function resetLbPrompt() {
    if (!currentLbAgentId) return;

    const config = getConfig();
    const mode = getCurrentMode();
    const map = mode === 'collection' ? config.PROMPT_FILE_MAP_COLLECTION : config.PROMPT_FILE_MAP;
    const fname = (map && map[currentLbAgentId]) || currentLbAgentId;
    if (!confirm(`Recharger prompts/${mode}/${fname}.md depuis le disque ?`)) return;

    try {
      const txt = await readPromptMarkdown(mode, fname);
      getState().promptsByMode[mode][currentLbAgentId] = txt;
      document.getElementById('lbTextarea').value = txt;
      global.showToast?.('Rechargé depuis le fichier ✓');
    } catch (e) {
      global.showToast?.(`Erreur: ${e.message}`, '#ff4757');
    }
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
