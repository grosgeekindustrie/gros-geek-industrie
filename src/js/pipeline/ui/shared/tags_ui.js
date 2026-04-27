(function initPipelineUITags(global) {

// Remplacement automatique des tags invalides.
// Module spécialisé dans le reroll / regen de tags après blacklist ou action manuelle.
  global.PipelineUI = global.PipelineUI || {};
  const dom = global.PipelineUIDom || {};
  const helpers = () => global.PipelineUIHelpers || {};
  const render = () => global.PipelineUIRender || {};
  const AUTO_REGEN_MAX_ATTEMPTS = 3;

  function extractGeneratedTag(result) {
    return String(result || '')
      .trim()
      .replace(/^\d+\.\s*/, '')
      .replace(/^[-+•]\s*/, '')
      .split('\n')[0]
      .trim();
  }

  function collectSiblingTags(itemEl) {
    const container = itemEl?.parentElement;
    if (!container) return [];

    return [...container.querySelectorAll('[data-selection-item]')]
      .filter((node) => node !== itemEl)
      .map((node) => (dom.getByData?.('selection-text-node', null, node) || node.querySelector('.titre-text'))?.textContent || '')
      .map((value) => helpers().normalizeTagValue ? helpers().normalizeTagValue(value) : String(value || '').trim())
      .filter(Boolean);
  }

  function isDuplicateCandidate(candidate, itemEl, originalTag) {
    const normalizedCandidate = helpers().normalizeTagValue
      ? helpers().normalizeTagValue(candidate)
      : String(candidate || '').trim();

    if (!normalizedCandidate) return true;
    if (helpers().sameTag?.(normalizedCandidate, originalTag)) return true;

    return collectSiblingTags(itemEl).some((existingTag) => helpers().sameTag?.(existingTag, normalizedCandidate));
  }

  function updateTagItemUI(itemEl, newTag) {
    const textSpan = dom.getByData?.('selection-text-node', null, itemEl) || itemEl.querySelector('.titre-text');
    const lenSpan = dom.getByData?.('selection-char', null, itemEl) || itemEl.querySelector('.titre-char');
    const itemId = itemEl.id;
    const source = itemId.startsWith('exp-') ? 'explorer' : 'main';
    const validateButton = dom.getByData?.('selection-role', 'validate', itemEl);
    const blacklistButton = dom.getByData?.('selection-role', 'blacklist', itemEl);
    const rerollButton = dom.getByData?.('selection-role', 'reroll', itemEl);

    if (textSpan) textSpan.textContent = newTag;
    if (lenSpan) {
      lenSpan.textContent = newTag.length;
      lenSpan.dataset.charTone = newTag.length > 30 ? 'danger' : 'success';
    }

    if (validateButton) validateButton.dataset.selectionText = newTag;
    if (blacklistButton) {
      blacklistButton.dataset.selectionText = newTag;
      blacklistButton.dataset.itemId = itemId;
      blacklistButton.dataset.selectionSource = source;
    }
    if (rerollButton) {
      rerollButton.dataset.selectionText = newTag;
      rerollButton.dataset.itemId = itemId;
    }
  }

  function buildReplacementPrompt(basePrompt, tag, matchedTerm, excludedTags) {
    const exclusionBlock = excludedTags.length
      ? `\nTags interdits pour ce remplacement :\n${excludedTags.map((value) => `- ${value}`).join('\n')}`
      : '';
    const reason = matchedTerm && matchedTerm !== 'remplacement manuel'
      ? `Le tag "${tag}" contient le terme blacklisté "${matchedTerm}".`
      : `Remplace le tag "${tag}".`;

    return {
      filled: `${basePrompt.filled}\n\n---\nMODE REMPLACEMENT UNIQUE:\n${reason}\nGénère UN SEUL tag de remplacement.\nContraintes supplémentaires :\n- le nouveau tag doit être inédit dans la liste actuelle\n- ne réutilise jamais le tag d'origine\n- max 30 caractères\n- français, naturel, ancré au produit\n- sans numérotation\n- sans ponctuation finale${exclusionBlock}`,
      fixedContent: basePrompt.fixedContent,
    };
  }

  async function autoRegenTag(tag, matchedTerm, itemEl) {
    if (!itemEl || itemEl.classList.contains('regen-pending')) return;

    itemEl.classList.add('regen-pending');
    const textSpan = itemEl.querySelector('.titre-text');
    const originalText = textSpan?.textContent || tag;
    if (textSpan) textSpan.textContent = '⟳ remplacement…';

    try {
      const ctx = global.buildCtx('tags');
      const prompt = global.buildPrompt('tags', ctx);
      const { blacklisted } = global.parseBiblioTags(global.getBiblio('tags'));
      const rejectedTags = [originalText];
      let replacementTag = '';
      let replacementReason = '';

      for (let attempt = 0; attempt < AUTO_REGEN_MAX_ATTEMPTS; attempt += 1) {
        const regenPrompt = buildReplacementPrompt(prompt, tag, matchedTerm, rejectedTags);
        const { text: result } = await global.callClaude('tags', regenPrompt, false, 2);
        const candidateTag = extractGeneratedTag(result);

        if (!candidateTag) {
          replacementReason = 'Réponse vide';
          continue;
        }

        if (candidateTag.length > 30) {
          replacementReason = 'Tag trop long';
          rejectedTags.push(candidateTag);
          continue;
        }

        if (isDuplicateCandidate(candidateTag, itemEl, originalText)) {
          replacementReason = 'Doublon détecté';
          rejectedTags.push(candidateTag);
          continue;
        }

        const stillBad = helpers().getBlacklistedTerm(candidateTag, blacklisted, { minTermLength: 2 });
        if (stillBad) {
          replacementReason = `Terme blacklisté : ${stillBad}`;
          rejectedTags.push(candidateTag);
          continue;
        }

        replacementTag = candidateTag;
        break;
      }

      if (!replacementTag) throw new Error(replacementReason || 'Aucun remplacement valide');

      updateTagItemUI(itemEl, replacementTag);
      itemEl.classList.remove('regen-pending');
      render().syncTagsOutputFromUI?.();
      global.showToast(`♻️ Tag remplacé : "${replacementTag}"`, '#7eb8f7');
    } catch (error) {
      itemEl.classList.remove('regen-pending');
      updateTagItemUI(itemEl, originalText);
      render().syncTagsOutputFromUI?.();
      global.showToast(`Erreur remplacement tag: ${error.message}`, '#ff4757');
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
