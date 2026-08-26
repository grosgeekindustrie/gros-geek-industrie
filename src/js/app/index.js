/**
 * Frontière du domaine app.
 *
 * Phase bootstrap : expose les scripts app dans leur ordre vivant actuel.
 */
const appBootstrapManifest = Object.freeze({
  shellPrelude: Object.freeze([
    'app/shell/shell_ui.js',
  ]),
  boot: Object.freeze([
    'app/shell/app_ui.js',
    'app/shell/ai_profile_ui.js',
    'app/boot/integrations_bootstrap_ui.js',
    'app/boot/pipeline_bootstrap_ui.js',
    'app/boot/pipeline-ui.js',
  ]),
});

const appBootstrapLayerOrder = Object.freeze([
  'shellPrelude',
  'boot',
]);

export {
  appBootstrapManifest,
  appBootstrapLayerOrder,
};
