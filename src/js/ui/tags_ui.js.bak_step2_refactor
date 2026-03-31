(function initPipelineUITags(global) {
  const helpers = () => global.PipelineUIHelpers || {};
  const render = () => global.PipelineUIRender || {};

  async function autoRegenTag(tag, matchedTerm, itemEl) {
    if (itemEl.classList.contains('regen-pending')) return;

    itemEl.classList.add('regen-pending');
    const textSpan = itemEl.querySelector('.titre-text');
    const lenSpan = itemEl.querySelector('.titre-char');
    const originalText = textSpan.textContent;
    textSpan.textContent = '⟳ remplacement…';

    try {
      const ctx = global.buildCtx('tags');
      const prompt = global.buildPrompt('tags_select', ctx);
      const regenPrompt = {
        filled: `${prompt.filled}\n\n---\nMODE REMPLACEMENT UNIQUE:\nLe tag "${tag}" contient le terme blacklisté "${matchedTerm}". Génère UN SEUL tag de remplacement. Max 30 caractères, français, naturel, ancré au produit.\nFormat: juste le tag, sans numérotation, sans ponctuation finale.`,
        fixedContent: prompt.fixedContent,
      };

      const { text: result } = await global.callClaude('tags', regenPrompt, false, 2);
      const newTag = result
        .trim()
        .replace(/^\d+\.\s*/, '')
        .replace(/^[-+•]\s*/, '')
        .split('\n')[0]
        .trim();

      const { blacklisted } = global.parseBiblioTags(global.getBiblio('tags'));
      const stillBad = helpers().getBlacklistedTerm(newTag, blacklisted);

      textSpan.textContent = newTag;
      if (lenSpan) {
        lenSpan.textContent = newTag.length;
        lenSpan.style.color = newTag.length > 30 ? 'var(--error)' : 'var(--success)';
      }

      const safe = helpers().escapeForInlineSingleQuote(newTag);
      const itemId = itemEl.id;
      const buttons = itemEl.querySelectorAll('.titre-thumb');
      if (buttons[0]) buttons[0].setAttribute('onclick', `event.stopPropagation();validateTag('${safe}')`);
      if (buttons[1]) buttons[1].setAttribute('onclick', `event.stopPropagation();invalidateTag('${safe}','${itemId}')`);
      if (buttons[2]) buttons[2].setAttribute('onclick', `event.stopPropagation();rerollTag('${safe}','${itemId}')`);

      itemEl.classList.remove('regen-pending');
      render().syncTagsOutputFromUI?.();

      if (stillBad) {
        autoRegenTag(newTag, stillBad, itemEl);
      } else {
        global.showToast(`♻️ Tag remplacé : "${newTag}"`, '#7eb8f7');
      }
    } catch (error) {
      itemEl.classList.remove('regen-pending');
      textSpan.textContent = originalText;
      global.showToast('Erreur remplacement tag', '#ff4757');
    }
  }

  function rerollTag(tag, itemId) {
    const itemEl = document.getElementById(itemId);
    if (!itemEl) return;
    autoRegenTag(tag, 'remplacement manuel', itemEl);
  }

  global.PipelineUITags = { autoRegenTag, rerollTag };
  global.PipelineUI.tags = global.PipelineUI.tags || {};
  Object.assign(global.PipelineUI.tags, global.PipelineUITags);
})(window);
