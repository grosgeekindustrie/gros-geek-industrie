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
  const getConfig = () => global.PipelineUIConfig || {};

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
      const res = await fetch(`/files/biblios/${mode}/${key}.md`, { method: 'PUT', body: value });
      if (!res.ok) throw new Error((await res.json()).error);
      getState().bibliosByMode[mode][key] = value;
      closeBiblioLightbox();
      showToast(`${label} sauvegardé ✓`);
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
      showToast(`${label} rechargé ✓`);
    } catch (e) {
      showToast(`Erreur: ${e.message}`, '#ff4757');
    }
  }

  function openPromptLightbox(id) {
    currentLbAgentId = id;
    const tagLabels = {
      tags: 'Axel · Explore Tags',
      tags_filter: 'Céline · Filter Tags',
      tags_select: 'Axel · Select Tags',
      alias_lookup: 'Alias Lookup · Terminologie locale',
      translate_listing: 'Translate Listing · Traduction fiche nette',
    };
    const agents = getConfig().getPipelineAgents ? getConfig().getPipelineAgents() : [];
    const label = id === 'orchestrateur'
      ? 'Orchestrateur'
      : (tagLabels[id] || agents.find((a) => a.id === id)?.title || id);

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
    const agentKey = currentLbAgentId === 'orchestrateur' ? (mode === 'collection' ? 'rex' : 'felix') : currentLbAgentId;
        const fname = (map && map[agentKey]) || agentKey;
    if (!confirm(`Écraser prompts/${mode}/${fname}.md sur le disque ?`)) return;

    const val = document.getElementById('lbTextarea').value;
    try {
      const res = await fetch(`/files/prompts/${mode}/${fname}.md`, { method: 'PUT', body: val });
      if (!res.ok) throw new Error((await res.json()).error);
      getState().promptsByMode[mode][currentLbAgentId] = val;
      closePromptLightbox();
      showToast('Prompt sauvegardé ✓');
    } catch (e) {
      showToast(`Erreur: ${e.message}`, '#ff4757');
    }
  }

  async function resetLbPrompt() {
    if (!currentLbAgentId) return;

    const config = getConfig();
    const mode = getCurrentMode();
    const map = mode === 'collection' ? config.PROMPT_FILE_MAP_COLLECTION : config.PROMPT_FILE_MAP;
    const agentKey = currentLbAgentId === 'orchestrateur' ? (mode === 'collection' ? 'rex' : 'felix') : currentLbAgentId;
    const fname = (map && map[agentKey]) || agentKey;
    if (!confirm(`Recharger prompts/${mode}/${fname}.md depuis le disque ?`)) return;

    try {
      const res = await fetch(`/files/prompts/${mode}/${fname}.md`);
      if (!res.ok) throw new Error((await res.json()).error);
      const txt = await res.text();
      getState().promptsByMode[mode][currentLbAgentId] = txt;
      document.getElementById('lbTextarea').value = txt;
      showToast('Rechargé depuis le fichier ✓');
    } catch (e) {
      showToast(`Erreur: ${e.message}`, '#ff4757');
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
