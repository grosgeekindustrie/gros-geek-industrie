/**
 * Frontière du domaine pipeline.
 *
 * Phase bootstrap : expose les scripts pipeline dans leur ordre vivant actuel.
 */
const pipelineSharedPreludePaths = [
  'pipeline/ui/shared/helper_ui.js',
  'pipeline/ui/shared/render_ui.js',
  'pipeline/ui/shared/modals_ui.js',
  'pipeline/ui/shared/tags_ui.js',
  'pipeline/ui/shared/title_ui.js',
  'pipeline/ui/shared/library_ui.js',
];

const pipelinePrimaryDataPaths = [
  'pipeline/data/pipeline_modes_data.js',
  'pipeline/data/pipeline_agents_data.js',
  'pipeline/data/prompt_maps_data.js',
];

const pipelineDevPreludePaths = [
  'pipeline/dev/pipeline_dev_data.js',
];

const pipelineSecondaryDataPaths = [
  'pipeline/data/form_fields_data.js',
  'pipeline/data/stepper_steps_data.js',
  'pipeline/data/echelles_data.js',
  'pipeline/data/form_catalogs_data.js',
];

const pipelineRuntimePreludePaths = [
  'pipeline/runtime/config_ui.js',
];

const pipelinePromptPaths = [
  'pipeline/ui/shared/prompt_biblio_ui.js',
];

const pipelineUiNavigationPaths = [
  'pipeline/ui/shared/forms_ui.js',
  'pipeline/ui/shared/stepper_core_ui.js',
  'pipeline/ui/shared/solo_tabs_core_ui.js',
  'pipeline/ui/tabletop/dnd_stepper_ui.js',
  'pipeline/ui/tabletop/dnd_tabs_ui.js',
  'pipeline/ui/collection/collection_stepper_ui.js',
  'pipeline/ui/collection/collection_tabs_ui.js',
  'pipeline/ui/shared/cards_ui.js',
  'pipeline/ui/shared/selections_ui.js',
];

const pipelineRuntimePaths = [
  'pipeline/runtime/pipeline-api.js',
];

const pipelineDevRuntimePaths = [
  'pipeline/dev/pipeline_dev_runtime_ui.js',
];

export {
  pipelineSharedPreludePaths,
  pipelinePrimaryDataPaths,
  pipelineDevPreludePaths,
  pipelineSecondaryDataPaths,
  pipelineRuntimePreludePaths,
  pipelinePromptPaths,
  pipelineUiNavigationPaths,
  pipelineRuntimePaths,
  pipelineDevRuntimePaths,
};
