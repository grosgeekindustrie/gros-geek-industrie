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

// Les reliquats runtime historiques ont été redistribués dans les modules UI/runtime
// dédiés. Ce boot reste un point d’assemblage et d’initialisation.

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
