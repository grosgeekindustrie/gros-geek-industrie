/**
 * Frontière du domaine app.
 *
 * Phase bootstrap : expose les scripts app dans leur ordre vivant actuel.
 */
const appShellPreludePaths = [
  'app/shell/shell_ui.js',
];

const appBootPaths = [
  'app/shell/app_ui.js',
  'app/boot/pipeline-ui.js',
];

export {
  appShellPreludePaths,
  appBootPaths,
};
