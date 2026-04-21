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
  'app/boot/pipeline-ui.js',
]);

const appBootstrapGroups = Object.freeze([
  Object.freeze({
    id: 'app:shell-prelude',
    paths: appShellPreludePaths,
  }),
  Object.freeze({
    id: 'app:boot',
    paths: appBootPaths,
  }),
]);

export {
  appShellPreludePaths,
  appBootPaths,
  appBootstrapGroups,
};
