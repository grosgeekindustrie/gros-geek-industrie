/**
 * Frontière du domaine app.
 *
 * Phase bootstrap : expose les scripts app dans leur ordre vivant actuel.
 */
const appShellPreludePaths = Object.freeze([
  'app/shell/shell_ui.js',
]);

const appBootPaths = Object.freeze([
  'app/shell/app_ui.js',
  'app/boot/pipeline_bootstrap_ui.js',
  'app/boot/pipeline-ui.js',
]);

const appBootstrapManifest = Object.freeze({
  shellPrelude: appShellPreludePaths,
  boot: appBootPaths,
});

export {
  appShellPreludePaths,
  appBootPaths,
  appBootstrapManifest,
};
