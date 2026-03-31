(function initPipelineUILibrary(global) {
  global.PipelineUI = global.PipelineUI || {};

const BIBLIO_MAP = {
  tags: { label: 'Tags' }, accroches: { label: 'Accroches/CTAs' },
  objectif: { label: 'Objectif Global' }, psycho: { label: 'Psychologie Client' },
  titres: { label: 'Titres validés / blacklist' },
  'bibliotheque-semantique': { label: 'Bibliothèque Sémantique' },
};
let currentBiblioTab = 'tags';
function openBiblioLightbox() { switchBiblioTab('tags'); document.getElementById('biblioLightbox').classList.add('visible'); }
function closeBiblioLightbox() { document.getElementById('biblioLightbox').classList.remove('visible'); }
function switchBiblioTab(tab) {
  currentBiblioTab = tab;
  document.querySelectorAll('.biblio-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(`btab-${tab}`).classList.add('active');
  document.getElementById('biblio-textarea').value = state.bibliosByMode[currentMode][tab] || '';
}
let currentLbAgentId = null;
function openPromptLightbox(id) {
  currentLbAgentId = id;
  const tagLabels = {
    tags: 'Axel · Explore Tags',
    tags_filter: 'Céline · Filter Tags',
    tags_select: 'Axel · Select Tags',
  };
  const label = id === 'orchestrateur'
    ? 'Orchestrateur'
    : (tagLabels[id] || getPipelineAgents().find(a => a.id === id)?.title || id);
  document.getElementById('lbTitle').textContent = `⚙️ PROMPT — ${label}`;
  document.getElementById('lbTextarea').value = state.promptsByMode[currentMode][id] || '';
  document.getElementById('promptLightbox').classList.add('visible');
}
function closePromptLightbox() { document.getElementById('promptLightbox').classList.remove('visible'); currentLbAgentId = null; }
async function saveLbPrompt() {
  if (!currentLbAgentId) return;
  const map = currentMode === 'collection' ? PROMPT_FILE_MAP_COLLECTION : PROMPT_FILE_MAP;
  const agentKey = currentLbAgentId === 'orchestrateur' ? (currentMode === 'collection' ? 'rex' : 'felix') : currentLbAgentId;
  const fname = map[agentKey] || agentKey;
  if (!confirm(`Écraser prompts/${currentMode}/${fname}.md sur le disque ?`)) return;
  const val = document.getElementById('lbTextarea').value;
  try {
    const res = await fetch(`/files/prompts/${currentMode}/${fname}.md`, { method:'PUT', body:val });
    if (!res.ok) throw new Error((await res.json()).error);
    state.promptsByMode[currentMode][currentLbAgentId] = val;
    closePromptLightbox();
    showToast('Prompt sauvegardé ✓');
  } catch(e) { showToast(`Erreur: ${e.message}`, '#ff4757'); }
}
async function resetLbPrompt() {
  if (!currentLbAgentId) return;
  const map = currentMode === 'collection' ? PROMPT_FILE_MAP_COLLECTION : PROMPT_FILE_MAP;
  const agentKey = currentLbAgentId === 'orchestrateur' ? (currentMode === 'collection' ? 'rex' : 'felix') : currentLbAgentId;
  const fname = map[agentKey] || agentKey;
  if (!confirm(`Recharger prompts/${currentMode}/${fname}.md depuis le disque ?`)) return;
  try {
    const res = await fetch(`/files/prompts/${currentMode}/${fname}.md`);
    if (!res.ok) throw new Error((await res.json()).error);
    const txt = await res.text();
    state.promptsByMode[currentMode][currentLbAgentId] = txt;
    document.getElementById('lbTextarea').value = txt;
    showToast('Rechargé depuis le fichier ✓');
  } catch(e) { showToast(`Erreur: ${e.message}`, '#ff4757'); }
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
