(function initPipelineUIPromptBiblio(global) {

// Construction des prompts et lecture des bibliothèques.
// Responsable du template filling, des blocs fixes cachables et du parsing des fichiers
// VALIDÉS / BLACKLISTÉS. À garder cohérent avec la structure des prompts disque.
  global.PipelineUI = global.PipelineUI || {};

  const getState = () => global.state;
  const getCurrentMode = () => global.currentMode || 'tabletop';

  function getBiblio(key) {
    return getState().bibliosByMode[getCurrentMode()][key] || '';
  }

  const buildPipelineSharedFixedContent = (ctx = {}) => {
    const sections = [
      `PIPELINE WARMUP:\n${ctx.pipeline_warmup_hint || 'Warmup non défini'}`,
      `SNAPSHOT FORMULAIRE:\n${ctx.pipeline_form_snapshot || 'Aucun snapshot disponible'}`,
      `CONTEXTE GLOBAL:\n${getBiblio('objectif')}`,
      `PSYCHOLOGIE CLIENT:\n${getBiblio('psycho')}`,
      `BIBLIOTHÈQUE TITRES:\n${getBiblio('titres')}`,
      `BIBLIOTHÈQUE TAGS:\n${getBiblioTagsFormatted() || '_(aucun retour enregistré)_'}`,
    ];

    return sections.filter(Boolean).join('\n\n');
  };

  const buildPipelineCumulativeFixedContent = (ctx = {}) => {
    const cumulative = String(ctx.pipeline_cumulatif || '').trim();
    return cumulative ? `CUMULATIF APPEND-ONLY:\n${cumulative}` : '';
  };

  const buildFixedContentText = (blocks = []) => (
    blocks
      .map((block) => String(block?.text || '').trim())
      .filter(Boolean)
      .join('\n\n')
  );

  const buildSharedBlocks = (ctx = {}, includeCumulative = true) => {
    const shared = buildPipelineSharedFixedContent(ctx);
    const cumulative = includeCumulative ? buildPipelineCumulativeFixedContent(ctx) : '';
    return [
      { key: 'shared_prefix', text: shared, cacheable: true },
      { key: 'cumulative_append_only', text: cumulative, cacheable: false },
    ];
  };

  const buildPromptDebug = (agentId, filled, fixedContentBlocks = []) => ({
    agentId,
    promptChars: String(filled || '').length,
    fixedBlocks: fixedContentBlocks.map((block, index) => ({
      index,
      key: block?.key || `block_${index + 1}`,
      cacheable: Boolean(block?.cacheable),
      chars: String(block?.text || '').trim().length,
    })),
  });

  const CACHE_FIXED = {
    marche: (ctx = {}) => ({
      blocks: buildSharedBlocks(ctx, false),
    }),
    titre: (ctx = {}) => ({
      blocks: buildSharedBlocks(ctx, true),
    }),
    tags: (ctx = {}) => ({
      blocks: buildSharedBlocks(ctx, true),
    }),
    tags_filter: (ctx = {}) => ({
      blocks: buildSharedBlocks(ctx, true),
    }),
    tags_select: (ctx = {}) => ({
      blocks: buildSharedBlocks(ctx, true),
    }),
    description: (ctx = {}) => ({
      blocks: buildSharedBlocks(ctx, true),
    }),
    alt: (ctx = {}) => ({
      blocks: buildSharedBlocks(ctx, true),
    }),
    analyse: (ctx = {}) => ({
      blocks: buildSharedBlocks(ctx, true),
    }),
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
      .replace(/\[\[DESCRIPTION_FIGURINE\]\]/g, ctx.descriptionFigurine || ctx.notes || '')
      .replace(/\[\[RESUME_PERSONNAGE\]\]/g, ctx.resumePersonnage || ctx.contextePerso || '')
      .replace(/\[\[CONTEXTE_PERSO\]\]/g, ctx.resumePersonnage || ctx.contextePerso || '')
      .replace(/\[\[CONNEXES_PRIORITAIRES\]\]/g, ctx.connexesPrioritaires || '')
      .replace(/\[\[LIEN_PERSO\]\]/g, ctx.lienPerso || '')
      .replace(/\[\[BUZZ_COLLECTION\]\]/g, ctx.buzzCollection ? `OUI${ctx.buzzCollectionNote ? ' — ' + ctx.buzzCollectionNote : ''}` : 'NON')
      .replace(/\[\[ACCROCHE\]\]/g, ctx.selectedAccrocheText || '')
      .replace(/\[\[CTA\]\]/g, ctx.selectedCTAText || '')
      .replace(/\[\[NOTES\]\]/g, ctx.notes || ctx.descriptionFigurine || '')
      .replace(/\[\[DESC_P1\]\]/g, ctx.desc_p1 || '')
      .replace(/\[\[URL\]\]/g, ctx.url_boutique || '')
      .replace(/\[\[PROFIL_DOMINANT\]\]/g, ctx.profil_dominant || 'hobbyiste')
      .replace(/\[\[SOCIAL_FORMATS\]\]/g, ctx.social_formats || '')
      .replace(/\[\[AGENT_ID\]\]/g, ctx.agent_id || agentId)
      .replace(/\[\[TENTATIVE\]\]/g, String(ctx.tentative || 1))
      .replace(/\[\[OUTPUT\]\]/g, (ctx.output_to_validate || '').substring(0, 3000))
      .replace(/\[\[PIPELINE_FORM_SNAPSHOT\]\]/g, ctx.pipeline_form_snapshot || '')
      .replace(/\[\[PIPELINE_CUMULATIF\]\]/g, ctx.pipeline_cumulatif || '')
      .replace(/\[\[PIPELINE_WARMUP_HINT\]\]/g, ctx.pipeline_warmup_hint || '')
      + (ctx.rules ? `\nRègles permanentes:\n${ctx.rules}` : '')
      + (ctx.correction ? `\nInstruction ponctuelle: ${ctx.correction}` : '');

    const fixedConfig = CACHE_FIXED[agentId] ? CACHE_FIXED[agentId](ctx) : null;
    const fixedContentBlocks = fixedConfig?.blocks || [];
    const fixedContent = buildFixedContentText(fixedContentBlocks) || null;
    const promptDebug = buildPromptDebug(agentId, filled, fixedContentBlocks);

    return { filled, fixedContent, fixedContentBlocks, promptDebug };
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
  Object.assign(global, global.PipelineUIPromptBiblio);
})(window);