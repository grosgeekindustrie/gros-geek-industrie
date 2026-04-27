/**
 * Frontière du domaine pipeline.
 *
 * Phase bootstrap : expose les scripts pipeline dans leur ordre vivant actuel.
 */
const pipelineBootstrapManifest = Object.freeze({
  sharedPrelude: Object.freeze([
    'pipeline/ui/shared/helper_ui.js',
    'pipeline/ui/shared/render_ui.js',
    'pipeline/ui/shared/modals_ui.js',
    'pipeline/ui/shared/rules_ui.js',
    'pipeline/ui/shared/tags_ui.js',
    'pipeline/ui/shared/title_ui.js',
    'pipeline/ui/shared/library_ui.js',
  ]),
  primaryData: Object.freeze([
    'pipeline/data/pipeline_modes_data.js',
    'pipeline/data/pipeline_agents_data.js',
    'pipeline/data/prompt_maps_data.js',
  ]),
  devPrelude: Object.freeze([
    'pipeline/dev/pipeline_dev_data.js',
  ]),
  secondaryData: Object.freeze([
    'pipeline/data/form_fields_data.js',
    'pipeline/data/stepper_steps_data.js',
    'pipeline/data/echelles_data.js',
    'pipeline/data/form_catalogs_data.js',
  ]),
  runtimePrelude: Object.freeze([
    'pipeline/runtime/config_ui.js',
  ]),
  prompts: Object.freeze([
    'pipeline/ui/shared/prompt_biblio_ui.js',
  ]),
  uiNavigation: Object.freeze([
    'pipeline/ui/shared/forms_ui.js',
    'pipeline/ui/shared/stepper_core_ui.js',
    'pipeline/ui/shared/solo_tabs_core_ui.js',
    'pipeline/ui/tabletop/dnd_stepper_ui.js',
    'pipeline/ui/tabletop/dnd_tabs_ui.js',
    'pipeline/ui/collection/collection_stepper_ui.js',
    'pipeline/ui/collection/collection_tabs_ui.js',
    'pipeline/ui/shared/cards_ui.js',
    'pipeline/ui/shared/selections_ui.js',
  ]),
  runtime: Object.freeze([
    'pipeline/runtime/pipeline_target_runtime_ui.js',
    'pipeline/runtime/anthropic_runtime_api.js',
    'pipeline/runtime/agent_runtime_ui.js',
    'pipeline/runtime/cache_runtime_ui.js',
    'pipeline/runtime/cost_runtime_ui.js',
    'pipeline/runtime/iris_runtime_ui.js',
    'pipeline/runtime/launch_runtime_ui.js',
    'pipeline/runtime/output_runtime_ui.js',
    'pipeline/runtime/social_runtime_ui.js',
  ]),
  devRuntime: Object.freeze([
    'pipeline/dev/pipeline_dev_runtime_ui.js',
  ]),
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
  pipelineBootstrapManifest,
  pipelineBootstrapLayerOrder,
};
