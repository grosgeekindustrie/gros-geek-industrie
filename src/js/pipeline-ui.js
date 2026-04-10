'use strict';

// Orchestrateur / bridge UI.
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
  ECHELLES,
  ECHELLES_COLLECTION,
  CUSTOM_COLLECTION_COUNT,
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
  showBatchCountPicker,
  initBatchInline,
  openBatchModal,
  closeBatchModal,
  initBatch,
  buildBatchFiche,
  batchToggleEch,
  batchAddImages,
  stopBatch,
  startBatch,
  updateBatchProgress,
  getBatchCtx,
  runBatchFiche,
  runBatchAgent,
  exportBatch,
} = window.PipelineUIBatch;

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
// Extracted to src/js/ui/prompt_biblio_ui.js

// Extracted to src/js/ui/helper_ui.js

// Flow tags 3 agents.
// Ce helper reste ici car il consomme à la fois le prompt builder et callClaude.
// Si on l'extrait plus tard, il devra garder la même séquence explore → filter → select.

const formatTagsCsvLine = (tags = []) => {
  const uniqueTags = [];
  const seen = new Set();

  for (const rawTag of tags) {
    const normalizedTag = normalizeTagValue(String(rawTag || ''));
    if (!normalizedTag) continue;

    const normalizedKey = normalizedTag.toLowerCase();
    if (seen.has(normalizedKey)) continue;

    seen.add(normalizedKey);
    uniqueTags.push(normalizedTag);
  }

  return uniqueTags.join(', ');
};

const formatTagsDebugCsvBlock = (exploreTags = [], filteredTags = []) => {
  const sections = [];
  const exploreCsv = formatTagsCsvLine(exploreTags);
  const filterCsv = formatTagsCsvLine(filteredTags);

  if (exploreCsv) sections.push(`EXPLORE (${exploreTags.length})\n${exploreCsv}`);
  if (filterCsv) sections.push(`FILTER (${filteredTags.length})\n${filterCsv}`);

  return sections.join('\n\n');
};

async function runTagsThreeAgents(ctx) {
  const mergeUsage = (...usages) => usages.reduce((acc, usage) => {
    Object.entries(usage || {}).forEach(([key, value]) => {
      acc[key] = (acc[key] || 0) + (Number(value) || 0);
    });

    return acc;
  }, {});
  const buildTagsRuntimeInput = (prompt, filled, runtimeAgentId) => ({
    filled,
    fixedContent: prompt.fixedContent,
    fixedContentBlocks: prompt.fixedContentBlocks,
    runtimeAgentId,
    promptDebug: {
      ...(prompt.promptDebug || {}),
      promptChars: filled.length,
    },
  });

  // 1) EXPLORE
  const explorePrompt = buildPrompt('tags', ctx);
  const exploreInput = buildTagsRuntimeInput(explorePrompt, explorePrompt.filled, 'tags.explore');
  const { text: rawExplore, usage: exploreUsage } = await callClaude('tags', exploreInput, false);

  const exploreTags = parseTagOutput(rawExplore).filter((tag) => tag.length <= 30).slice(0, 80);
  if (!exploreTags.length) throw new Error('Aucun tag candidat généré');

  // 2) FILTER
  const filterPrompt = buildPrompt('tags_filter', ctx);
  const filterFilled =
    `${filterPrompt.filled}\n\n` +
    `CANDIDATS À FILTRER :\n` +
    `${exploreTags.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
  const filterInput = buildTagsRuntimeInput(filterPrompt, filterFilled, 'tags.filtre');

  const { text: rawFiltered, usage: filterUsage } = await callClaude('tags', filterInput, false);
  const filteredTags = parseTagOutput(rawFiltered).slice(0, 28);

  const pool = filteredTags.length ? filteredTags : exploreTags;

  // 3) SELECT
  const selectPrompt = buildPrompt('tags_select', ctx);
  const selectFilled =
    `${selectPrompt.filled}\n\n` +
    `CANDIDATS RETENUS :\n` +
    `${pool.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
  const selectInput = buildTagsRuntimeInput(selectPrompt, selectFilled, 'tags.select');

  const { text: rawFinal, usage: selectUsage } = await callClaude('tags', selectInput, false);
  const finalTagsRaw = parseTagOutput(rawFinal);

  // sécurisation douce : si le sélecteur renvoie moins de 13 tags,
  // on complète avec le pool filtré sans doublons
  const merged = [];
  const seen = new Set();

  for (const tag of [...finalTagsRaw, ...pool]) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(tag);
    if (merged.length === 13) break;
  }

  if (!merged.length) throw new Error('Aucun tag final généré');

  const finalTags = merged.slice(0, 13);

  return {
    output: formatTagsNumbered(finalTags),
    outputFinalCsv: formatTagsCsvLine(finalTags),
    outputDebugCsv: formatTagsDebugCsvBlock(exploreTags, filteredTags),
    usage: mergeUsage(exploreUsage, filterUsage, selectUsage),
    debug: {
      exploreInput: exploreInput.filled,
      explore: rawExplore,
      filterInput: filterInput.filled,
      filter: rawFiltered,
      selectInput: selectInput.filled,
      select: rawFinal
    }
  };
}

// ═══════════════════════════════════════════════════════════
// BIBLIOTHÈQUES
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/prompt_biblio_ui.js

// ═══════════════════════════════════════════════════════════
// PROMPT LIGHTBOX
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// ÉCHELLES
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/echelles_ui.js

// ═══════════════════════════════════════════════════════════
// IMAGES
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/images_ui.js

// ═══════════════════════════════════════════════════════════
// ARCHÉTYPES & CHAMPS FORMULAIRE
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/forms_ui.js

// ═══════════════════════════════════════════════════════════
// CONTEXT BUILDER
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/forms_ui.js

// ═══════════════════════════════════════════════════════════
// BUILD PIPELINE UI
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/cards_ui.js

// ═══════════════════════════════════════════════════════════
// TAGS — VALIDATION / EXPLORER
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/selections_ui.js

// ═══════════════════════════════════════════════════════════
// TITRE SÉLECTION
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/selections_ui.js

// ═══════════════════════════════════════════════════════════
// SÉLECTION ACCROCHE / CTA
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/selections_ui.js

// ═══════════════════════════════════════════════════════════
// API CALL
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/app_ui.js

// ═══════════════════════════════════════════════════════════
// INPUT BRUT LIGHTBOX
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/app_ui.js

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// VIEW SYSTEM
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/app_ui.js

// ═══════════════════════════════════════════════════════════
// SETTINGS PANEL
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/app_ui.js

// ═══════════════════════════════════════════════════════════
// LOAD PERSISTED DATA
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/forms_ui.js

// ═══════════════════════════════════════════════════════════
// CHARGEMENT FICHIERS MD
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/forms_ui.js

// Reliquat runtime déplacé depuis pipeline-api.
// État actuel : ces helpers ont été ramenés ici pour alléger pipeline-api sans casser le
// runtime. Objectif à terme : les redistribuer dans des modules dédiés quand la zone sera
// suffisamment stabilisée et retestée.

// ═══ MOVED FROM API ═══
// ═══ MOVED FROM API ═══
const abortControllers = {};
window.abortControllers = abortControllers;
const AGENT_MODELS = {
  analyse:'claude-sonnet-4-20250514', alt:'claude-sonnet-4-20250514',
  marche:'claude-sonnet-4-20250514', tags:'claude-sonnet-4-20250514',
  titre:'claude-sonnet-4-20250514', description:'claude-sonnet-4-20250514',
  social:'claude-sonnet-4-20250514', camille:'claude-sonnet-4-20250514',
  iris:'claude-sonnet-4-20250514', orchestrateur:'claude-sonnet-4-20250514',
};

function stopAgent(agentId, _p) {
  if (abortControllers[agentId]) { abortControllers[agentId].abort(); delete abortControllers[agentId]; }
}

const getResumePipelineAgents = (prefix) => {
  const launchState = typeof getPipelineLaunchState === 'function'
    ? getPipelineLaunchState(prefix)
    : null;
  const targetStepId = launchState?.targetStepId || '';
  const runtimeAgents = typeof getPipelineRuntimeAgentsForTarget === 'function'
    ? getPipelineRuntimeAgentsForTarget(prefix, targetStepId)
    : [];

  return runtimeAgents.length ? runtimeAgents : getPipelineAgents();
};

const getDisplayStepIdForAgent = (prefix, agentId) => {
  if (typeof getPipelineDisplayStepIdForRuntimeAgent !== 'function') return agentId;
  return getPipelineDisplayStepIdForRuntimeAgent(prefix, agentId);
};

const setResumeLaunchState = (prefix, agentId, nextState = {}) => {
  if (typeof setPipelineLaunchState !== 'function') return;

  const launchState = typeof getPipelineLaunchState === 'function'
    ? getPipelineLaunchState(prefix)
    : null;
  const displayStepId = getDisplayStepIdForAgent(prefix, agentId);

  setPipelineLaunchState(prefix, {
    targetStepId: launchState?.targetStepId || '',
    currentStepId: displayStepId,
    isRunning: true,
    lastStatus: `en cours · ${displayStepId}`,
    ...nextState,
  });
};

const finalizeResumeLaunchState = (prefix, agentId, lastStatus) => {
  if (typeof setPipelineLaunchState !== 'function') return;

  const launchState = typeof getPipelineLaunchState === 'function'
    ? getPipelineLaunchState(prefix)
    : null;
  const displayStepId = getDisplayStepIdForAgent(prefix, agentId);

  setPipelineLaunchState(prefix, {
    targetStepId: launchState?.targetStepId || '',
    currentStepId: displayStepId,
    isRunning: false,
    lastStatus,
  });
};

const syncResumeResultTab = (prefix, lastStatus) => {
  if (lastStatus === 'terminé') {
    const hasResult = prefix === 'tt'
      ? window.isDndSoloResultAvailable?.()
      : window.isCollectionSoloResultAvailable?.();

    if (hasResult) {
      activateSoloTab(prefix, 'result', { force: true });
      return;
    }
  }

  activateSoloTab(prefix, 'pipeline', { force: true });
};

const getContinuationAgentsAfterSelection = (prefix, agentId) => {
  const agents = getResumePipelineAgents(prefix);
  const currentIndex = agents.findIndex(({ id }) => id === agentId);

  return currentIndex === -1 ? [] : agents.slice(currentIndex + 1);
};

const finalizePipelineContinuation = (prefix, agentId, lastStatus = 'terminé') => {
  window.setPipelineExecutionActive?.(false);
  finalizeResumeLaunchState(prefix, agentId, lastStatus);
  assembleFinal();
  syncResumeResultTab(prefix, lastStatus);
};

async function continuePipelineAfterSelection(agentId) {
  const prefix = pfx();
  const continuationAgents = getContinuationAgentsAfterSelection(prefix, agentId);

  if (!continuationAgents.length) {
    finalizePipelineContinuation(prefix, agentId, 'terminé');
    return;
  }

  let lastAgentId = agentId;
  let lastStatus = 'terminé';

  window.setPipelineExecutionActive?.(true);

  try {
    for (const agent of continuationAgents) {
      setResumeLaunchState(prefix, agent.id);
      state.orchAttempts[agent.id] = 0;

      const ok = await runAgent(agent);
      lastAgentId = agent.id;

      if (!ok) {
        lastStatus = 'erreur';
        break;
      }

      if (agent.hasSelection) {
        lastStatus = 'en pause · sélection requise';
        break;
      }
    }
  } finally {
    finalizePipelineContinuation(prefix, lastAgentId, lastStatus);
  }
}

const normalizePipelineActionRequest = (request = {}) => ({
  action: String(request.action || '').trim(),
  prefix: String(request.prefix || '').trim(),
  stepId: String(request.stepId || '').trim(),
  agentId: String(request.agentId || '').trim(),
});

async function handlePipelineActionRequest(request = {}) {
  const { action, prefix, stepId, agentId } = normalizePipelineActionRequest(request);
  const activePrefix = prefix || pfx();
  const actionHandlers = {
    launch: () => startPipeline(activePrefix, { targetStepId: stepId }),
    'rerun-agent': () => rerunAgent(agentId),
    'rerun-suite': () => rerunSuite(agentId),
    'stop-agent': () => stopAgent(agentId, activePrefix),
    'validate-title': () => validateTitre(agentId),
    'validate-selection': () => validateAccrocheCTA(agentId),
  };
  const actionHandler = actionHandlers[action];

  if (!actionHandler) return;
  return actionHandler();
}

async function rerunAgent(agentId) {
  const p = pfx();
  const agents = getResumePipelineAgents(p);
  const agent = agents.find(({ id }) => id === agentId) || getPipelineAgents().find(({ id }) => id === agentId);
  if (!agent) return;

  const cor = document.getElementById(`${p}-cor-${agentId}`).value;
  state.orchAttempts[agentId] = 0;
  window.setPipelineExecutionActive?.(true);
  setResumeLaunchState(p, agent.id);

  let lastStatus = 'terminé';

  try {
    const ok = await runAgent(agent, cor);
    if (!ok) {
      lastStatus = 'erreur';
    } else if (agent.hasSelection) {
      lastStatus = 'en pause · sélection requise';
    }
  } finally {
    window.setPipelineExecutionActive?.(false);
    finalizeResumeLaunchState(p, agent.id, lastStatus);
    assembleFinal();
    syncResumeResultTab(p, lastStatus);
  }
}

async function rerunSuite(agentId) {
  const p = pfx();
  const agents = getResumePipelineAgents(p);
  const idx = agents.findIndex(({ id }) => id === agentId);
  if (idx === -1) return;

  const cor = document.getElementById(`${p}-cor-${agentId}`).value;
  let lastAgentId = agents[idx].id;
  let lastStatus = 'terminé';

  window.setPipelineExecutionActive?.(true);

  try {
    for (let i = idx; i < agents.length; i++) {
      const agent = agents[i];
      if (agent.optional) break;

      setResumeLaunchState(p, agent.id);
      state.orchAttempts[agent.id] = 0;

      const ok = await runAgent(agent, i === idx ? cor : '');
      lastAgentId = agent.id;

      if (!ok) {
        lastStatus = 'erreur';
        break;
      }

      if (agent.hasSelection) {
        lastStatus = 'en pause · sélection requise';
        break;
      }
    }
  } finally {
    window.setPipelineExecutionActive?.(false);
    finalizeResumeLaunchState(p, lastAgentId, lastStatus);
    assembleFinal();
    syncResumeResultTab(p, lastStatus);
  }
}

function persistRule(agentId) {
  const p = pfx();
  const cor = document.getElementById(`${p}-cor-${agentId}`).value.trim();
  if (!cor) return;
  if (!state.persistentRules[agentId]) state.persistentRules[agentId] = [];
  state.persistentRules[agentId].push(cor);
  document.getElementById(`${p}-cor-${agentId}`).value = '';
  refreshRules(agentId);
  localStorage.setItem('pipeline.rules', JSON.stringify(state.persistentRules));
}
function removeRule(agentId, i) {
  state.persistentRules[agentId].splice(i, 1);
  refreshRules(agentId);
  localStorage.setItem('pipeline.rules', JSON.stringify(state.persistentRules));
}
function refreshRules(agentId) {
  const p = pfx();
  const rules = state.persistentRules[agentId] || [];
  const badge = document.getElementById(`${p}-brul-${agentId}`);
  const disp = document.getElementById(`${p}-rd-${agentId}`);
  if (!badge || !disp) return;
  if (rules.length === 0) { badge.style.display = 'none'; disp.innerHTML = ''; }
  else {
    badge.style.display = 'inline';
    disp.innerHTML = '📌 Règles permanentes:<br>' + rules.map((r, i) =>
      `<span onclick="removeRule('${agentId}',${i})" title="Supprimer">✕ ${r}</span>`).join('');
  }
}

function assembleFinal() {
  const p = pfx();
  const titre = state.outputs.titre_valide || '';
  const tags = p === 'col' ? (state.outputs.tags_final_csv || state.outputs.tags || '') : (state.outputs.tags || '');
  const tagsDebug = p === 'col' ? (state.outputs.tags_debug_csv || '') : '';
  const desc = state.outputs['description_assembled'] || state.outputs.description || '';
  const alt = state.outputs.alt || '';
  if (!titre && !tags && !tagsDebug && !desc && !alt) return;
  const show = (sectionId, contentId, content) => {
    if (!content) return;
    document.getElementById(sectionId).style.display = 'block';
    document.getElementById(contentId).textContent = content;
  };
  show(`fs-titre-${p}`, `fc-titre-${p}`, titre);
  show(`fs-tags-${p}`, `fc-tags-${p}`, tags);
  if (p === 'col') show('fs-tags-debug-col', 'fc-tags-debug-col', tagsDebug);
  show(`fs-description-${p}`, `fc-description-${p}`, desc);
  show(`fs-alt-${p}`, `fc-alt-${p}`, alt);
  const fo = document.getElementById(`finalOutput-${p}`);
  fo.style.display = 'flex'; fo.style.flexDirection = 'column';
  if (alt) document.getElementById(`socialSection-${p}`).style.display = 'block';
  if (p === 'tt') {
    refreshDndSoloTabs?.();
    if (!window.isPipelineExecutionActive?.()) activateDndSoloTab?.('result', { force: true });
  }
  if (p === 'col') {
    refreshCollectionSoloTabs?.();
    if (!window.isPipelineExecutionActive?.()) activateCollectionSoloTab?.('result', { force: true });
  }
}

function copyOut(agentId) { navigator.clipboard.writeText(state.outputs[agentId] || ''); showToast('Copié ✓'); }
function copyAllOutputs() {
  const agents = [
    { id:'analyse', label:'01 — ANALYSE VISUELLE' }, { id:'alt', label:'02 — BALISE ALT' },
    { id:'marche', label:'03 — ANALYSE MARCHÉ' }, { id:'tags', label:'04 — TAGS' },
    { id:'titre', label:'05 — TITRES' }, { id:'description', label:'06 — DESCRIPTION' },
  ];
  const parts = agents.map(a => { const out = state.outputs[a.id] || ''; return out ? `${'═'.repeat(50)}\n${a.label}\n${'═'.repeat(50)}\n${out}` : null; }).filter(Boolean);
  if (!parts.length) { showToast('Aucun output à copier', '#ff4757'); return; }
  navigator.clipboard.writeText(parts.join('\n\n'));
  showToast(`Review globale copiée — ${parts.length} agents ✓`);
}

async function runTitreExplorer() {
  const p = pfx();
  const btn = document.getElementById(`${p}-bexplore-titre`);
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Exploration...'; }
  const ctx = buildCtx('titre');
  const prompt = buildPrompt('titre', ctx);
  const explorerPrompt = prompt.filled + '\n\nMODE EXPLORATION: Génère environ 30 titres. Format : liste numérotée avec compteur de caractères.';
  try {
    const { text: result } = await callClaude('titre', { filled: explorerPrompt, fixedContent: prompt.fixedContent }, false);
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

setupImageHandlers('tt');
setupImageHandlers('col');
restoreWorkspaceImages?.('tt');
restoreWorkspaceImages?.('col');
loadPersistedData();
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

// ═══════════════════════════════════════════════════════════
// BATCH
// ═══════════════════════════════════════════════════════════

