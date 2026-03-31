(function initPipelineUIPromptBiblio(global) {
  global.PipelineUI = global.PipelineUI || {};

  const getState = () => global.state;
  const getCurrentMode = () => global.currentMode || 'tabletop';

  function getBiblio(key) {
    return getState().bibliosByMode[getCurrentMode()][key] || '';
  }

  const CACHE_FIXED = {
    marche:      () => `CONTEXTE GLOBAL:\n${getBiblio('objectif')}\n\nPSYCHOLOGIE CLIENT:\n${getBiblio('psycho')}`,
    titre:       () => `BIBLIOTHÈQUE TITRES:\n${getBiblio('titres')}`,
    description: () => `CONTEXTE GLOBAL:\n${getBiblio('objectif')}\n\nPSYCHOLOGIE CLIENT:\n${getBiblio('psycho')}`,
  };

  function parseBiblioTags(raw) {
    const validated = [];
    const blacklisted = [];
    let section = null;

    for (const line of String(raw || '').split('\n')) {
      const text = line.trim();
      if (text === '## VALIDÉS') { section = 'v'; continue; }
      if (text === '## BLACKLISTÉS') { section = 'b'; continue; }
      if (section === 'v' && text.startsWith('+ ')) validated.push(text.slice(2));
      if (section === 'b' && text.startsWith('- ')) blacklisted.push(text.slice(2));
    }

    return { validated, blacklisted };
  }

  function buildBiblioTagsRaw(validated, blacklisted) {
    return `## VALIDÉS\n${validated.map((tag) => `+ ${tag}`).join('\n')}\n\n## BLACKLISTÉS\n${blacklisted.map((tag) => `- ${tag}`).join('\n')}\n`;
  }

  function parseBiblioTitres(raw) {
    const validated = [];
    const blacklisted = [];
    let section = null;

    for (const line of String(raw || '').split('\n')) {
      const text = line.trim();
      if (text === '## VALIDÉS') { section = 'v'; continue; }
      if (text === '## BLACKLISTÉS') { section = 'b'; continue; }
      if (section === 'v' && text.startsWith('+ ')) validated.push(text.slice(2));
      if (section === 'b' && text.startsWith('- ')) blacklisted.push(text.slice(2));
    }

    return { validated, blacklisted };
  }

  function buildBiblioTitresRaw(validated, blacklisted) {
    return `## VALIDÉS\n${validated.map((title) => `+ ${title}`).join('\n')}\n\n## BLACKLISTÉS\n${blacklisted.map((title) => `- ${title}`).join('\n')}\n`;
  }

  function getBiblioTagsFormatted() {
    const { validated, blacklisted } = parseBiblioTags(getBiblio('tags'));
    if (!validated.length && !blacklisted.length) return '';

    const parts = [];
    if (validated.length) {
      parts.push(`Tags validés (exemples de qualité à imiter) :\n${validated.map((tag) => `+ ${tag}`).join('\n')}`);
    }
    if (blacklisted.length) {
      parts.push(`Termes blacklistés (interdits sans exception) :\n${blacklisted.map((tag) => `- ${tag}`).join('\n')}`);
    }
    return parts.join('\n\n');
  }

  function buildPrompt(agentId, ctx) {
    const state = getState();
    const currentMode = getCurrentMode();
    const template = state.promptsByMode[currentMode][agentId] || '';

    const filled = template
      .replace(/\[\[NOM_COURT\]\]/g, ctx.nomCourt || ctx.nom)
      .replace(/\[\[NOM\]\]/g, ctx.nom)
      .replace(/\[\[UNIVERS\]\]/g, ctx.univers)
      .replace(/\[\[SCULPTEUR\]\]/g, ctx.sculpteur)
      .replace(/\[\[ECHELLES\]\]/g, ctx.echelles)
      .replace(/\[\[PIECES\]\]/g, ctx.pieces)
      .replace(/\[\[DIMENSIONS\]\]/g, ctx.dimensions || '')
      .replace(/\[\[POSE\]\]/g, ctx.pose)
      .replace(/\[\[VERSION\]\]/g, ctx.version || '')
      .replace(/\[\[TYPE\]\]/g, ctx.type || '')
      .replace(/\[\[BUZZ\]\]/g, ctx.buzz ? `OUI${ctx.buzzNote ? ' — ' + ctx.buzzNote : ''}` : 'NON')
      .replace(/\[\[ANALYSE\]\]/g, ctx.outputs.analyse || '')
      .replace(/\[\[MARCHE\]\]/g, ctx.outputs.marche || '')
      .replace(/\[\[TAGS\]\]/g, ctx.outputs.tags || '')
      .replace(/\[\[TITRE_VALIDE\]\]/g, ctx.outputs.titre_valide || '')
      .replace(/\[\[DESCRIPTION\]\]/g, ctx.outputs.description_assembled || ctx.outputs.description || '')
      .replace(/\[\[ARCHETYPES\]\]/g, ctx.archetypes || '')
      .replace(/\[\[OBJECTIF\]\]/g, getBiblio('objectif'))
      .replace(/\[\[PSYCHO\]\]/g, getBiblio('psycho'))
      .replace(/\[\[BIBLIO_SEMANTIQUE\]\]/g, getBiblio('bibliotheque-semantique'))
      .replace(/\[\[BIBLIO_TITRES\]\]/g, getBiblio('titres'))
      .replace(/\[\[BIBLIO_TAGS\]\]/g, getBiblioTagsFormatted() || '_(aucun retour enregistré)_')
      .replace(/\[\[MEDIUM\]\]/g, ctx.medium || '')
      .replace(/\[\[LICENSE\]\]/g, ctx.license || 'non')
      .replace(/\[\[PARTICULARITES\]\]/g, ctx.particularites || '')
      .replace(/\[\[CONTEXTE_PERSO\]\]/g, ctx.contextePerso || '')
      .replace(/\[\[LIEN_PERSO\]\]/g, ctx.lienPerso || '')
      .replace(/\[\[BUZZ_COLLECTION\]\]/g, ctx.buzzCollection ? `OUI${ctx.buzzCollectionNote ? ' — ' + ctx.buzzCollectionNote : ''}` : 'NON')
      .replace(/\[\[ACCROCHE\]\]/g, ctx.selectedAccrocheText || '')
      .replace(/\[\[CTA\]\]/g, ctx.selectedCTAText || '')
      .replace(/\[\[NOTES\]\]/g, ctx.notes || '')
      .replace(/\[\[DESC_P1\]\]/g, ctx.desc_p1 || '')
      .replace(/\[\[URL\]\]/g, ctx.url_boutique || '')
      .replace(/\[\[PROFIL_DOMINANT\]\]/g, ctx.profil_dominant || 'hobbyiste')
      .replace(/\[\[SOCIAL_FORMATS\]\]/g, ctx.social_formats || '')
      .replace(/\[\[AGENT_ID\]\]/g, ctx.agent_id || agentId)
      .replace(/\[\[TENTATIVE\]\]/g, String(ctx.tentative || 1))
      .replace(/\[\[OUTPUT\]\]/g, (ctx.output_to_validate || '').substring(0, 3000))
      + (ctx.rules ? `\nRègles permanentes:\n${ctx.rules}` : '')
      + (ctx.correction ? `\nInstruction ponctuelle: ${ctx.correction}` : '');

    const fixedContent = CACHE_FIXED[agentId] ? CACHE_FIXED[agentId]() : null;
    return { filled, fixedContent };
  }

  global.PipelineUIPromptBiblio = {
    buildPrompt,
    getBiblio,
    parseBiblioTags,
    buildBiblioTagsRaw,
    parseBiblioTitres,
    buildBiblioTitresRaw,
    getBiblioTagsFormatted,
  };

  global.PipelineUI.promptBiblio = global.PipelineUI.promptBiblio || {};
  Object.assign(global.PipelineUI.promptBiblio, global.PipelineUIPromptBiblio);
})(window);
