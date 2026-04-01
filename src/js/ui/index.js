(function bootstrapPipelineUI(global) {

// Bootstrap minimal des namespaces UI.
// Fichier de sécurité pour garantir l'existence des espaces window.PipelineUI* avant
// le chargement des modules spécialisés.
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUI.helpers = global.PipelineUI.helpers || {};
  global.PipelineUI.render = global.PipelineUI.render || {};
  global.PipelineUI.modals = global.PipelineUI.modals || {};
  global.PipelineUI.tags = global.PipelineUI.tags || {};
  global.PipelineUI.title = global.PipelineUI.title || {};
})(window);
