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
const abortControllers = {};
window.abortControllers = abortControllers;
const AGENT_MODELS = {
  alt:'claude-sonnet-4-20250514',
  marche:'claude-sonnet-4-20250514', tags:'claude-sonnet-4-20250514',
  titre:'claude-sonnet-4-20250514', description:'claude-sonnet-4-20250514',
  social:'claude-sonnet-4-20250514', camille:'claude-sonnet-4-20250514',
  iris:'claude-sonnet-4-20250514', orchestrateur:'claude-sonnet-4-20250514',
  cache_aware:'claude-sonnet-4-20250514',
};

const PIPELINE_STATUS_DONE = 'terminé';
const PIPELINE_STATUS_ERROR = 'erreur';
const PIPELINE_STATUS_SELECTION_REQUIRED = 'en pause · sélection requise';

function stopAgent(agentId) {
  if (abortControllers[agentId]) { abortControllers[agentId].abort(); delete abortControllers[agentId]; }
}

const getResumePipelineAgents = (prefix) => {
  const runtimeAgents = typeof getPipelineRuntimeAgentsForTarget === 'function'
    ? getPipelineRuntimeAgentsForTarget(prefix)
    : [];

  return runtimeAgents.length ? runtimeAgents : getPipelineAgents();
};

const getDisplayStepIdForAgent = (prefix, agentId) => {
  if (typeof getPipelineDisplayStepIdForRuntimeAgent !== 'function') return agentId;
  return getPipelineDisplayStepIdForRuntimeAgent(prefix, agentId);
};

const setResumeLaunchState = (prefix, agentId, nextState = {}) => {
  if (typeof setPipelineLaunchState !== 'function') return;

  const displayStepId = getDisplayStepIdForAgent(prefix, agentId);

  setPipelineLaunchState(prefix, {
    currentStepId: displayStepId,
    isRunning: true,
    lastStatus: `en cours · ${displayStepId}`,
    ...nextState,
  });
};

const finalizeResumeLaunchState = (prefix, agentId, lastStatus) => {
  if (typeof setPipelineLaunchState !== 'function') return;

  const displayStepId = getDisplayStepIdForAgent(prefix, agentId);

  setPipelineLaunchState(prefix, {
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

const resetAgentOrchestratorAttempts = (agentId) => {
  state.orchAttempts[agentId] = 0;
};

const resolveAgentRunStatus = (ok, agent) => {
  if (!ok) return PIPELINE_STATUS_ERROR;
  if (agent?.hasSelection) return PIPELINE_STATUS_SELECTION_REQUIRED;
  return PIPELINE_STATUS_DONE;
};

async function continuePipelineAfterSelection(agentId) {
  const prefix = pfx();
  const continuationAgents = getContinuationAgentsAfterSelection(prefix, agentId);

  if (!continuationAgents.length) {
    finalizePipelineContinuation(prefix, agentId, PIPELINE_STATUS_DONE);
    return;
  }

  let lastAgentId = agentId;
  let lastStatus = PIPELINE_STATUS_DONE;

  window.setPipelineExecutionActive?.(true);

  try {
    for (const agent of continuationAgents) {
      setResumeLaunchState(prefix, agent.id);
      resetAgentOrchestratorAttempts(agent.id);

      const ok = await runAgent(agent);
      lastAgentId = agent.id;
      lastStatus = resolveAgentRunStatus(ok, agent);

      if (lastStatus !== PIPELINE_STATUS_DONE) {
        break;
      }
    }
  } catch (error) {
    lastStatus = PIPELINE_STATUS_ERROR;
    console.error('continuePipelineAfterSelection failed', error);
    showToast(`❌ Suite du pipeline: ${error.message}`, '#ff4757');
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
    launch: () => (window.runPipelineWithCacheAware ? window.runPipelineWithCacheAware(activePrefix) : startPipeline(activePrefix)),
    'rerun-agent': () => rerunAgent(agentId),
    'rerun-suite': () => rerunSuite(agentId),
    'stop-agent': () => stopAgent(agentId, activePrefix),
    'validate-title': () => validateTitre(agentId),
    'validate-tags': () => validateTags(agentId),
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
  resetAgentOrchestratorAttempts(agentId);
  window.setPipelineExecutionActive?.(true);
  setResumeLaunchState(p, agent.id);

  let lastStatus = PIPELINE_STATUS_DONE;

  try {
    const ok = await runAgent(agent, cor);
    lastStatus = resolveAgentRunStatus(ok, agent);
  } catch (error) {
    lastStatus = PIPELINE_STATUS_ERROR;
    console.error('rerunAgent failed', error);
    showToast(`❌ Relance agent: ${error.message}`, '#ff4757');
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
  let lastStatus = PIPELINE_STATUS_DONE;

  window.setPipelineExecutionActive?.(true);

  try {
    for (let i = idx; i < agents.length; i++) {
      const agent = agents[i];
      if (agent.optional) break;

      setResumeLaunchState(p, agent.id);
      resetAgentOrchestratorAttempts(agent.id);

      const ok = await runAgent(agent, i === idx ? cor : '');
      lastAgentId = agent.id;
      lastStatus = resolveAgentRunStatus(ok, agent);

      if (lastStatus !== PIPELINE_STATUS_DONE) {
        break;
      }
    }
  } catch (error) {
    lastStatus = PIPELINE_STATUS_ERROR;
    console.error('rerunSuite failed', error);
    showToast(`❌ Suite agents: ${error.message}`, '#ff4757');
  } finally {
    window.setPipelineExecutionActive?.(false);
    finalizeResumeLaunchState(p, lastAgentId, lastStatus);
    assembleFinal();
    syncResumeResultTab(p, lastStatus);
  }
}

const savePersistentRules = () => {
  localStorage.setItem('pipeline.rules', JSON.stringify(state.persistentRules));
};

const getOutputText = (prefix, agentId) => {
  const outputNode = document.getElementById(`${prefix}-out-${agentId}`);
  return outputNode?.textContent || state.outputs[agentId] || '';
};

const getCopyAllOutputAgents = (prefix) => (
  prefix === 'col'
    ? [
        { id:'tags', label:'01 - TAGS' },
        { id:'titre', label:'02 - TITRES' },
        { id:'description', label:'03 - DESCRIPTION' },
        { id:'alt', label:'04 - BALISE ALT' },
      ]
    : [
        { id:'marche', label:'01 - ANALYSE MARCHE' },
        { id:'tags', label:'02 - TAGS' },
        { id:'titre', label:'03 - TITRES' },
        { id:'description', label:'04 - DESCRIPTION' },
        { id:'alt', label:'05 - BALISE ALT' },
      ]
);

const renderPersistentRules = (agentId, rules) => (
  'Regles permanentes:<br>' + rules.map((rule, index) =>
    `<span onclick="removeRule('${agentId}',${index})" title="Supprimer">x ${rule}</span>`
  ).join('')
);

const setFinalSectionContent = (sectionId, contentId, content, key = '') => {
  if (!content) return;

  document.getElementById(sectionId).style.display = 'block';
  const contentNode = document.getElementById(contentId);
  if (!contentNode) return;

  contentNode.textContent = window.PipelineUIRender?.formatFinalOutputText
    ? window.PipelineUIRender.formatFinalOutputText(key, content)
    : content;
};

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
  const tags = state.outputs.tags || '';
  const desc = state.outputs['description_assembled'] || state.outputs.description || '';
  const alt = state.outputs.alt || '';
  if (!titre && !tags && !desc && !alt) return;
  const show = (sectionId, contentId, content, key = '') => {
    if (!content) return;
    document.getElementById(sectionId).style.display = 'block';
    const contentNode = document.getElementById(contentId);
    if (!contentNode) return;
    contentNode.textContent = window.PipelineUIRender?.formatFinalOutputText
      ? window.PipelineUIRender.formatFinalOutputText(key, content)
      : content;
  };
  show(`fs-titre-${p}`, `fc-titre-${p}`, titre, 'titre_valide');
  show(`fs-tags-${p}`, `fc-tags-${p}`, tags, 'tags');
  show(`fs-description-${p}`, `fc-description-${p}`, desc, 'description_assembled');
  show(`fs-alt-${p}`, `fc-alt-${p}`, alt, 'alt');
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

function copyOut(agentId) {
  const prefix = pfx();
  const text = getOutputText(prefix, agentId);

  navigator.clipboard.writeText(text);
  showToast('Copié ✓');
}

function copyAllOutputs() {
  const p = pfx();
  const agents = getCopyAllOutputAgents(p);
  const parts = agents.map((agent) => {
    const out = state.outputs[agent.id] || '';
    return out ? `${'═'.repeat(50)}\n${agent.label}\n${'═'.repeat(50)}\n${out}` : null;
  }).filter(Boolean);
  if (!parts.length) { showToast('Aucun output à copier', '#ff4757'); return; }
  navigator.clipboard.writeText(parts.join('\n\n'));
  showToast(`Review globale copiée — ${parts.length} blocs ✓`);
}

const COPY_ALL_OUTPUTS_DIVIDER = '='.repeat(50);
const COPY_ALL_OUTPUTS_EMPTY_MESSAGE = 'Aucun output a copier';
const COPY_ALL_OUTPUTS_SUCCESS = (count) => `Review globale copiee - ${count} blocs`;

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

function assembleFinal() {
  const p = pfx();
  const titre = state.outputs.titre_valide || '';
  const tags = state.outputs.tags || '';
  const desc = state.outputs['description_assembled'] || state.outputs.description || '';
  const alt = state.outputs.alt || '';

  if (!titre && !tags && !desc && !alt) return;

  setFinalSectionContent(`fs-titre-${p}`, `fc-titre-${p}`, titre, 'titre_valide');
  setFinalSectionContent(`fs-tags-${p}`, `fc-tags-${p}`, tags, 'tags');
  setFinalSectionContent(`fs-description-${p}`, `fc-description-${p}`, desc, 'description_assembled');
  setFinalSectionContent(`fs-alt-${p}`, `fc-alt-${p}`, alt, 'alt');

  const finalOutput = document.getElementById(`finalOutput-${p}`);
  if (finalOutput) {
    finalOutput.style.display = 'flex';
    finalOutput.style.flexDirection = 'column';
  }

  if (alt) {
    document.getElementById(`socialSection-${p}`).style.display = 'block';
  }

  if (p === 'tt') {
    refreshDndSoloTabs?.();
    if (!window.isPipelineExecutionActive?.()) activateDndSoloTab?.('result', { force: true });
  }

  if (p === 'col') {
    refreshCollectionSoloTabs?.();
    if (!window.isPipelineExecutionActive?.()) activateCollectionSoloTab?.('result', { force: true });
  }
}

function copyOut(agentId) {
  const prefix = pfx();
  const text = getOutputText(prefix, agentId);

  navigator.clipboard.writeText(text);
  showToast('Copie OK');
}

function copyAllOutputs() {
  const p = pfx();
  const agents = getCopyAllOutputAgents(p);
  const parts = agents
    .map((agent) => {
      const out = state.outputs[agent.id] || '';
      return out
        ? `${COPY_ALL_OUTPUTS_DIVIDER}\n${agent.label}\n${COPY_ALL_OUTPUTS_DIVIDER}\n${out}`
        : null;
    })
    .filter(Boolean);

  if (!parts.length) {
    showToast(COPY_ALL_OUTPUTS_EMPTY_MESSAGE, '#ff4757');
    return;
  }

  navigator.clipboard.writeText(parts.join('\n\n'));
  showToast(COPY_ALL_OUTPUTS_SUCCESS(parts.length));
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
