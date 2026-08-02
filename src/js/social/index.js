/**
 * Frontiere du domaine social.
 *
 * Phase bootstrap : expose les scripts sociaux deja vivants
 * sans les laisser accroches au domaine pipeline.
 */
const socialBootstrapManifest = Object.freeze({
  runtime: Object.freeze([
    'social/runtime/social_runtime_ui.js',
    'social/pinterest/pinterest_ui.js',
  ]),
});

const socialBootstrapLayerOrder = Object.freeze([
  'runtime',
]);

export {
  socialBootstrapManifest,
  socialBootstrapLayerOrder,
};
