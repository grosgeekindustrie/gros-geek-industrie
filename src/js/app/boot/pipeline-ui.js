'use strict';

// Bridge UI.
// Ce fichier consomme les modules window.PipelineUI* et sert de point d'assemblage.
// État actuel : la majorité du découpage UI est faite, mais quelques helpers runtime
// temporaires provenant de l'ancien coeur restent encore ici pour éviter une migration
// trop risquée en une seule passe.
// Objectif : garder pipeline-ui.js léger, lisible, et pousser le reliquat vers des
// modules dédiés quand la zone concernée est vraiment retestée.

window.PipelineUI = window.PipelineUI || {};

const {
  extractLastNumberedBlock,
  parseTagOutput,
  formatTagsNumbered,
  normalizeTagValue,
  normalizeTitreValue,
  sameTag,
  sameTitre,
  parseBulkLibraryEntries,
  getBlacklistedTerm,
} = window.PipelineUIHelpers;

const {
  syncSelectionField,
  syncFinalPre,
  syncTagsOutputFromUI,
} = window.PipelineUIRender;

const {
  ensureLibraryModals,
  setLibraryModalFeedback,
  openLibraryBlacklistModal,
  closeLibraryBlacklistModal,
  openLibraryValidatedModal,
  closeLibraryValidatedModal,
  confirmLibraryBlacklistModal,
  confirmLibraryValidatedModal,
  ensureZoneLibraryActionButton,
  ensureTagsManualAddButton,
  ensureTitresManualAddButton,
  ensureExplorerManualAddButton,
} = window.PipelineUIModals;

const { autoRegenTag, rerollTag } = window.PipelineUITags;
const { autoRegenTitre } = window.PipelineUITitles;
const {
  openBiblioLightbox,
  closeBiblioLightbox,
  switchBiblioTab,
  saveBiblio,
  resetBiblio,
  openPromptLightbox,
  closePromptLightbox,
  saveLbPrompt,
  resetLbPrompt,
} = window.PipelineUILibrary;
const {
  buildEchellesUI,
  toggleEch,
  getEchellesSelected,
  getDimsFromEchelles,
} = window.PipelineUIEchelles;

const {
  setupImageHandlers,
  processImages,
  renderThumbs,
  resizeImage,
  removeImage,
} = window.PipelineUIImages;
const {
  restoreWorkspaceImages,
} = window.PipelineUIIndexedDb || {};

const {
  buildPrompt,
  getBiblio,
  parseBiblioTags,
  buildBiblioTagsRaw,
  parseBiblioTitres,
  buildBiblioTitresRaw,
  getBiblioTagsFormatted,
} = window.PipelineUIPromptBiblio;

const {
  initDndStepper,
  refreshDndStepper,
} = window.PipelineUIDndStepper || {};
const {
  initCollectionStepper,
  refreshCollectionStepper,
} = window.PipelineUICollectionStepper || {};
const {
  initDndSoloTabs,
  refreshDndSoloTabs,
  activateDndSoloTab,
} = window.PipelineUIDndTabs || {};
const {
  initCollectionSoloTabs,
  refreshCollectionSoloTabs,
  activateCollectionSoloTab,
} = window.PipelineUICollectionTabs || {};

// ═══════════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/pipeline/ui/shared/prompt_biblio_ui.js
// Helpers now live in src/js/pipeline/ui/shared/helper_ui.js

// Flux tags : Collection et Tabletop utilisent désormais le même mono-agent.
// La future sélection manuelle UI viendra dans un second temps, sans réintroduire
// le trio explore → filter → select.

// ═══════════════════════════════════════════════════════════
// BIBLIOTHÈQUES
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/pipeline/ui/shared/prompt_biblio_ui.js

// ═══════════════════════════════════════════════════════════
// PROMPT LIGHTBOX
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// ÉCHELLES
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/shared/media/echelles_ui.js

// ═══════════════════════════════════════════════════════════
// IMAGES
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/shared/media/images_ui.js

// ═══════════════════════════════════════════════════════════
// ARCHÉTYPES & CHAMPS FORMULAIRE
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/pipeline/ui/shared/forms_ui.js

// ═══════════════════════════════════════════════════════════
// CONTEXT BUILDER
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/pipeline/ui/shared/forms_ui.js

// ═══════════════════════════════════════════════════════════
// BUILD PIPELINE UI
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/pipeline/ui/shared/cards_ui.js

// ═══════════════════════════════════════════════════════════
// TAGS — VALIDATION / EXPLORER
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/pipeline/ui/shared/selections_ui.js

// ═══════════════════════════════════════════════════════════
// TITRE SÉLECTION
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/pipeline/ui/shared/selections_ui.js

// ═══════════════════════════════════════════════════════════
// SÉLECTION ACCROCHE / CTA
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/pipeline/ui/shared/selections_ui.js

// ═══════════════════════════════════════════════════════════
// API CALL
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/app/shell/app_ui.js

// ═══════════════════════════════════════════════════════════
// INPUT BRUT LIGHTBOX
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/app/shell/app_ui.js

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// VIEW SYSTEM
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/app/shell/app_ui.js

// ═══════════════════════════════════════════════════════════
// SETTINGS PANEL
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/app/shell/app_ui.js

// ═══════════════════════════════════════════════════════════
// LOAD PERSISTED DATA
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/pipeline/ui/shared/forms_ui.js

// ═══════════════════════════════════════════════════════════
// CHARGEMENT FICHIERS MD
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/pipeline/ui/shared/forms_ui.js

// Reliquat runtime déplacé depuis pipeline-api.
// État actuel : ces helpers ont été ramenés ici pour alléger pipeline-api sans casser le
// runtime. Objectif à terme : les redistribuer dans des modules dédiés quand la zone sera
// suffisamment stabilisée et retestée.

// ═══ MOVED FROM API ═══
// ═══ MOVED FROM API ═══
// Moved to pipeline/runtime/agent_runtime_ui.js.

const savePersistentRules = () => {
  localStorage.setItem('pipeline.rules', JSON.stringify(state.persistentRules));
};


const renderPersistentRules = (agentId, rules) => (
  'Regles permanentes:<br>' + rules.map((rule, index) =>
    `<span onclick="removeRule('${agentId}',${index})" title="Supprimer">x ${rule}</span>`
  ).join('')
);

function persistRule(agentId) {
  const p = pfx();
  const cor = document.getElementById(`${p}-cor-${agentId}`).value.trim();
  if (!cor) return;
  if (!state.persistentRules[agentId]) state.persistentRules[agentId] = [];
  state.persistentRules[agentId].push(cor);
  document.getElementById(`${p}-cor-${agentId}`).value = '';
  refreshRules(agentId);
  savePersistentRules();
}
function removeRule(agentId, i) {
  state.persistentRules[agentId].splice(i, 1);
  refreshRules(agentId);
  savePersistentRules();
}
function refreshRules(agentId) {
  const p = pfx();
  const rules = state.persistentRules[agentId] || [];
  const badge = document.getElementById(`${p}-brul-${agentId}`);
  const disp = document.getElementById(`${p}-rd-${agentId}`);

  if (!badge || !disp) return;
  if (rules.length === 0) {
    badge.style.display = 'none';
    disp.innerHTML = '';
    return;
  }

  badge.style.display = 'inline';
  disp.innerHTML = renderPersistentRules(agentId, rules);
}

async function runTitreExplorer() {
  const p = pfx();
  const btn = document.getElementById(`${p}-bexplore-titre`);
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Exploration...'; }
  const ctx = buildCtx('titre');
  const prompt = buildPrompt('titre', ctx);
  const explorerPrompt = prompt.filled + '\n\nMODE EXPLORATION: Génère environ 30 titres. Format : liste numérotée avec compteur de caractères.';
  try {
    const { text: result, usage } = await callClaude('titre', { filled: explorerPrompt, fixedContent: prompt.fixedContent }, false);
    showAgentCost('titre_explorer', usage, { prefix: p, source: 'titre-explorer' });
    syncCacheIndicator(usage);
    const lines = result.split('\n').filter(l => l.match(/^\d+\.\s+/));
    const titres = lines.map(l => {
      const text = l.replace(/^\d+\.\s*/, '').replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '').trim();
      const charMatch = l.match(/\((\d+)\s*car/i);
      const chars = charMatch ? parseInt(charMatch[1]) : text.length;
      return { text, chars };
    });
    document.getElementById('explorerTitle').textContent = '🔭 EXPLORATION TITRES';
    document.getElementById('explorerCount').textContent = `${titres.length} titres`;
    document.getElementById('explorerListLabel').textContent = 'Titres générés — 👍 valider · 👎 blacklister';
    document.getElementById('explorerConversation').value = result;
    ensureLibraryModals();
    ensureExplorerManualAddButton('titres', 'titre');
    const list = document.getElementById('explorerList');
    list.innerHTML = titres.map((t, i) => {
      const charColor = t.chars > 140 ? 'var(--error)' : t.chars >= 128 ? 'var(--success)' : t.chars >= 110 ? 'var(--accent)' : 'var(--muted)';
      const safe = t.text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return `<div class="titre-item" id="exp-titre-${i}">
        <span class="titre-text">${t.text}</span>
        <span class="titre-char" style="color:${charColor};">${t.chars}</span>
        <div class="titre-actions">
          <button class="titre-thumb" onclick="event.stopPropagation();validateTitreSegment('${safe}');document.getElementById('exp-titre-${i}').classList.add('validated')">👍</button>
          <button class="titre-thumb" onclick="event.stopPropagation();invalidateTitreSegment('${safe}','exp-titre-${i}','titre','explorer');document.getElementById('exp-titre-${i}').classList.add('invalidated')">👎</button>
          <button class="titre-copy" onclick="event.stopPropagation();copyTitreLine('${safe}')">📋</button>
        </div>
      </div>`;
    }).join('');
    document.getElementById('explorerLightbox').classList.add('visible');
    showToast('Exploration terminée ✓', '#e8c547');
  } catch(e) { showToast(`Erreur: ${e.message}`, '#ff4757'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '🔭 Explorer'; } }
}

// ═══════════════════════════════════════════════════════════

const pipelinePrefixes = typeof getPipelinePrefixes === 'function' ? getPipelinePrefixes() : ['tt', 'col'];
pipelinePrefixes.forEach((prefix) => {
  setupImageHandlers(prefix);
  restoreWorkspaceImages?.(prefix);
});
loadPersistedData();
renderDeclarativeFormCatalogs?.({ shouldSave: false });
buildPipeline();
buildEchellesUI();
loadFormState();
attachFormPersistence();
initDndStepper?.();
refreshDndStepper?.();
initCollectionStepper?.();
refreshCollectionStepper?.();
initDndSoloTabs?.();
refreshDndSoloTabs?.();
initCollectionSoloTabs?.();
refreshCollectionSoloTabs?.();
loadAllFiles();
// Restore view after init — immediate, no flash
if (window._restoreView === 'form' && window._restoreMode) {
  selectMode(window._restoreMode);
  window._restoreView = null;
}
// Reveal body after view is set
document.body.classList.add('ready');
