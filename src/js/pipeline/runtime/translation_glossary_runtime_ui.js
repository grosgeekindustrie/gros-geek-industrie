'use strict';

(function initPipelineUITranslationGlossaryRuntime(global) {
  const PROMPT_ROOT = 'prompts/gpt/localisation_backfill';
  const SUPPORTED_LANGUAGES = new Set(['en', 'de', 'es', 'it', 'nl', 'pt', 'ja', 'pl', 'ru', 'sv']);
  const layerCache = new Map();

  const normalizeLanguage = (language) => {
    const normalized = String(language || '').trim().toLowerCase();
    if (!SUPPORTED_LANGUAGES.has(normalized)) {
      throw new Error(`Glossaire de localisation non supporté : ${normalized || 'langue absente'}`);
    }
    return normalized;
  };

  const resolveContext = (prefix) => ({
    mode: String(prefix || '').trim().toLowerCase() === 'col' ? 'collection' : 'tabletop',
    shopKey: global.PipelineUIForms?.getActiveShopKey?.() === 'doublex' ? 'doublex' : 'grosgeek',
  });

  const resolveLayerPaths = (prefix, language) => {
    const normalizedLanguage = normalizeLanguage(language);
    const { mode, shopKey } = resolveContext(prefix);
    const shopPath = mode === 'tabletop'
      ? `${PROMPT_ROOT}/shops/tabletop/${shopKey}.md`
      : `${PROMPT_ROOT}/shops/${shopKey}.md`;

    return [
      `${PROMPT_ROOT}/common.md`,
      `${PROMPT_ROOT}/modes/${mode}.md`,
      shopPath,
      `${PROMPT_ROOT}/glossaries/_shared.md`,
      `${PROMPT_ROOT}/glossaries/${normalizedLanguage}.md`,
      `${PROMPT_ROOT}/fixed_blocks/${normalizedLanguage}.md`,
    ];
  };

  const loadLayer = async (path) => {
    if (!layerCache.has(path)) {
      layerCache.set(path, fetch(`/files/${path}`).then(async (response) => {
        if (!response.ok) {
          let detail = '';
          try {
            detail = String((await response.json())?.error || '').trim();
          } catch (_error) {
            detail = '';
          }
          throw new Error(detail || `Chargement impossible : ${path}`);
        }
        return response.text();
      }).catch((error) => {
        layerCache.delete(path);
        throw error;
      }));
    }
    return layerCache.get(path);
  };

  async function enrichIndividualPrompt(basePrompt, { prefix, language, fullDescription = false } = {}) {
    const normalizedBasePrompt = String(basePrompt || '').trim();
    if (!normalizedBasePrompt) throw new Error('Prompt individuel de traduction vide');

    const paths = resolveLayerPaths(prefix, language);
    const layers = await Promise.all(paths.map(loadLayer));
    const sharedContract = layers
      .map((content, index) => `### Couche partagée ${index + 1} — ${paths[index]}\n${String(content || '').trim()}`)
      .join('\n\n');

    const descriptionRule = fullDescription
      ? '- Traduis la description source complète, y compris tous les blocs récurrents ; aucun bloc fixe ne sera ajouté après la génération.'
      : '- Traduis uniquement la partie variable demandée : les blocs fixes restent injectés algorithmiquement par le pipeline.';

    return `${normalizedBasePrompt}\n\n` +
      `=== CONTRAT PARTAGÉ DE LOCALISATION ===\n${sharedContract}\n\n` +
      '=== RÈGLE D\'INTÉGRATION FICHE UNIQUE ===\n' +
      '- Le schéma JSON et les noms de champs exigés par le prompt individuel restent obligatoires.\n' +
      '- Les couches partagées complètent le prompt individuel et sont prioritaires pour la terminologie.\n' +
      descriptionRule;
  }

  global.PipelineUITranslationGlossaryRuntime = Object.freeze({
    enrichIndividualPrompt,
    resolveLayerPaths,
    clearCache: () => layerCache.clear(),
  });
})(window);
