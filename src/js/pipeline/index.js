/**
 * Frontière du domaine pipeline.
 *
 * Phase bootstrap : expose les scripts pipeline dans leur ordre vivant actuel.
 */
const pipelineSharedPreludePaths = Object.freeze([
  'pipeline/ui/shared/helper_ui.js',
  'pipeline/ui/shared/render_ui.js',
  'pipeline/ui/shared/modals_ui.js',
  'pipeline/ui/shared/rules_ui.js',
  'pipeline/ui/shared/tags_ui.js',
  'pipeline/ui/shared/title_ui.js',
  'pipeline/ui/shared/library_ui.js',
]);

const pipelinePrimaryDataPaths = Object.freeze([
  'pipeline/data/pipeline_modes_data.js',
  'pipeline/data/pipeline_agents_data.js',
  'pipeline/data/prompt_maps_data.js',
]);

const pipelineDevPreludePaths = Object.freeze([
  'pipeline/dev/pipeline_dev_data.js',
]);

const pipelineSecondaryDataPaths = Object.freeze([
  'pipeline/data/form_fields_data.js',
  'pipeline/data/stepper_steps_data.js',
  'pipeline/data/echelles_data.js',
  'pipeline/data/form_catalogs_data.js',
]);

const pipelineRuntimePreludePaths = Object.freeze([
  'pipeline/runtime/config_ui.js',
]);

const pipelinePromptPaths = Object.freeze([
  'pipeline/ui/shared/prompt_biblio_ui.js',
]);

const pipelineUiNavigationPaths = Object.freeze([
  'pipeline/ui/shared/forms_ui.js',
  'pipeline/ui/shared/stepper_core_ui.js',
  'pipeline/ui/shared/solo_tabs_core_ui.js',
  'pipeline/ui/tabletop/dnd_stepper_ui.js',
  'pipeline/ui/tabletop/dnd_tabs_ui.js',
  'pipeline/ui/collection/collection_stepper_ui.js',
  'pipeline/ui/collection/collection_tabs_ui.js',
  'pipeline/ui/shared/cards_ui.js',
  'pipeline/ui/shared/selections_ui.js',
]);

const pipelineRuntimePaths = Object.freeze([
  'pipeline/runtime/pipeline-api.js',
  'pipeline/runtime/pipeline_target_runtime_ui.js',
  'pipeline/runtime/anthropic_runtime_api.js',
  'pipeline/runtime/agent_runtime_ui.js',
  'pipeline/runtime/cache_runtime_ui.js',
  'pipeline/runtime/cost_runtime_ui.js',
  'pipeline/runtime/iris_runtime_ui.js',
  'pipeline/runtime/launch_runtime_ui.js',
  'pipeline/runtime/output_runtime_ui.js',
  'pipeline/runtime/social_runtime_ui.js',
]);

const pipelineDevRuntimePaths = Object.freeze([
  'pipeline/dev/pipeline_dev_runtime_ui.js',
]);

const pipelineBootstrapManifest = Object.freeze({
  sharedPrelude: pipelineSharedPreludePaths,
  primaryData: pipelinePrimaryDataPaths,
  devPrelude: pipelineDevPreludePaths,
  secondaryData: pipelineSecondaryDataPaths,
  runtimePrelude: pipelineRuntimePreludePaths,
  prompts: pipelinePromptPaths,
  uiNavigation: pipelineUiNavigationPaths,
  runtime: pipelineRuntimePaths,
  devRuntime: pipelineDevRuntimePaths,
});

const pipelineBootstrapLayerOrder = Object.freeze([
  'sharedPrelude',
  'primaryData',
  'devPrelude',
  'secondaryData',
  'runtimePrelude',
  'prompts',
  'uiNavigation',
  'runtime',
  'devRuntime',
]);

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
  pipelineBootstrapManifest,
  pipelineBootstrapLayerOrder,
};
