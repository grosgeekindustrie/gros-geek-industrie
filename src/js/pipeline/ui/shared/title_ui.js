(function initPipelineUITitle(global) {

// Remplacement automatique des titres invalides.
// Même rôle que tags_ui.js mais pour les titres, avec contraintes longueur / blacklist.
  global.PipelineUI = global.PipelineUI || {};
  const dom = global.PipelineUIDom || {};
  const runtimeCache = global.PipelineUIRuntimeCache || {};
  const helpers = () => global.PipelineUIHelpers || {};
  const AUXILIARY_RETRY_COUNT = 1;

  function buildTitreRegenCacheKey(promptData, agentId, text, matchedTerm) {
    return runtimeCache.buildCacheKey?.(
      global.currentMode,
      global.pfx(),
      'titre-regen',
      agentId,
      text,
      matchedTerm,
      promptData.fixedContent || '',
      promptData.filled || ''
    ) || promptData.filled;
  }

  async function autoRegenTitre(text, matchedTerm, itemEl, agentId) {
    if (itemEl.classList.contains('regen-pending')) return;

    itemEl.classList.add('regen-pending');
    const textSpan = dom.getByData?.('selection-text-node', null, itemEl) || itemEl.querySelector('.titre-text');
    const charSpan = dom.getByData?.('selection-char', null, itemEl) || itemEl.querySelector('.titre-char');
    const originalText = textSpan.textContent;
    textSpan.textContent = '⟳ remplacement…';

    try {
      const ctx = global.buildCtx('titre');
      const prompt = global.buildPrompt('titre', ctx);
      const regenPrompt = {
        filled: `${prompt.filled}\n\n---\nMODE REMPLACEMENT UNIQUE:\nLe titre "${text}" contient un terme blacklisté ("${matchedTerm}"). Génère UN SEUL titre de remplacement. Idéalement 128-140 caractères, naturel, SEO Etsy.\nFormat: juste le titre, sans numérotation, sans compteur de caractères.`,
        fixedContent: prompt.fixedContent,
      };

      const cacheKey = buildTitreRegenCacheKey(regenPrompt, agentId, text, matchedTerm);
      const response = await runtimeCache.runWithSharedRequest?.('aux-regen', cacheKey, async () => (
        global.callClaude('titre', regenPrompt, false, AUXILIARY_RETRY_COUNT)
      ));
      const result = response.text;
      const newTitre = result
        .trim()
        .replace(/^\d+\.\s*/, '')
        .replace(/\s*\(\d+\s*car(?:actères?)?\).*$/i, '')
        .split('\n')[0]
        .trim();

      const { blacklisted } = global.parseBiblioTitres(global.getBiblio('titres'));
      const stillBad = helpers().getBlacklistedTerm(newTitre, blacklisted);

      textSpan.textContent = newTitre;
      const chars = newTitre.length;
      if (charSpan) {
        charSpan.textContent = chars;
        charSpan.dataset.charTone = chars > 140
          ? 'danger'
          : chars >= 128
            ? 'success'
            : chars >= 110
              ? 'accent'
              : 'muted';
      }

      const itemId = itemEl.id;
      const validateButton = dom.getByData?.('selection-role', 'validate', itemEl);
      const blacklistButton = dom.getByData?.('selection-role', 'blacklist', itemEl);
      if (validateButton) validateButton.dataset.selectionText = newTitre;
      if (blacklistButton) {
        blacklistButton.dataset.selectionText = newTitre;
        blacklistButton.dataset.itemId = itemId;
        blacklistButton.dataset.agentId = agentId;
      }

      itemEl.classList.remove('regen-pending');
      if (stillBad) {
        autoRegenTitre(newTitre, stillBad, itemEl, agentId);
      } else {
        global.showToast('♻️ Titre remplacé', '#7eb8f7');
      }
    } catch (error) {
      itemEl.classList.remove('regen-pending');
      textSpan.textContent = originalText;
      global.showToast('Erreur remplacement titre', '#ff4757');
    }
  }

  global.PipelineUITitles = { autoRegenTitre };
  global.PipelineUI.title = global.PipelineUI.title || {};
  Object.assign(global.PipelineUI.title, global.PipelineUITitles);
})(window);

