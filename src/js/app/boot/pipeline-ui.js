'use strict';

// Bridge UI.
// Ce fichier rebranche les globals historiques attendues par le HTML inline et
// l'ancien runtime en les lisant depuis les modules window.PipelineUI*.
// Il ne porte plus le coeur fonctionnel : seulement l'assemblage de surface.

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
  processImages,
  renderThumbs,
  resizeImage,
  removeImage,
} = window.PipelineUIImages;

const {
  buildPrompt,
  getBiblio,
  parseBiblioTags,
  buildBiblioTagsRaw,
  parseBiblioTitres,
  buildBiblioTitresRaw,
  getBiblioTagsFormatted,
} = window.PipelineUIPromptBiblio;

const { activateDndSoloTab } = window.PipelineUIDndTabs || {};
const { activateCollectionSoloTab } = window.PipelineUICollectionTabs || {};

// Bridge surface:
// - helpers / parsing
// - rendu / modales / biblios
// - tags / titres / selections
// - media et echelles
// - prompts et tabs solo
// L'initialisation vivante passe par app/boot/pipeline_bootstrap_ui.js.

initializePipelineUi?.();
