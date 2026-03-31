(function initPipelineUITitle(global) {
  global.PipelineUI = global.PipelineUI || {};
  const helpers = () => global.PipelineUIHelpers || {};

  async function autoRegenTitre(text, matchedTerm, itemEl, agentId) {
    if (itemEl.classList.contains('regen-pending')) return;

    itemEl.classList.add('regen-pending');
    const textSpan = itemEl.querySelector('.titre-text');
    const charSpan = itemEl.querySelector('.titre-char');
    const originalText = textSpan.textContent;
    textSpan.textContent = '⟳ remplacement…';

    try {
      const ctx = global.buildCtx('titre');
      const prompt = global.buildPrompt('titre', ctx);
      const regenPrompt = {
        filled: `${prompt.filled}\n\n---\nMODE REMPLACEMENT UNIQUE:\nLe titre "${text}" contient un terme blacklisté ("${matchedTerm}"). Génère UN SEUL titre de remplacement. Idéalement 128-140 caractères, naturel, SEO Etsy.\nFormat: juste le titre, sans numérotation, sans compteur de caractères.`,
        fixedContent: prompt.fixedContent,
      };

      const { text: result } = await global.callClaude('titre', regenPrompt, false, 2);
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
      const charColor = chars > 140
        ? 'var(--error)'
        : chars >= 128
          ? 'var(--success)'
          : chars >= 110
            ? 'var(--accent)'
            : 'var(--muted)';
      if (charSpan) {
        charSpan.textContent = chars;
        charSpan.style.color = charColor;
      }

      const safe = helpers().escapeForInlineSingleQuote(newTitre);
      const itemId = itemEl.id;
      const buttons = itemEl.querySelectorAll('.titre-thumb');
      if (buttons[0]) buttons[0].setAttribute('onclick', `event.stopPropagation();validateTitreSegment('${safe}','valid')`);
      if (buttons[1]) buttons[1].setAttribute('onclick', `event.stopPropagation();invalidateTitreSegment('${safe}','${itemId}','${agentId}')`);

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
