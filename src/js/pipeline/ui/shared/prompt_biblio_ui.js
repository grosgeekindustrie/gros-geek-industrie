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

  const getPromptBiblioDevConfig = () => global.PIPELINE_DEV_CONFIG?.promptBiblio || {};

  const isPromptBiblioEnabled = (key) => {
    const config = getPromptBiblioDevConfig();
    const disabledByKey = {
      objectif: config.includeObjectif === false,
      psycho: config.includePsycho === false,
      titres: config.includeBiblioTitres === false,
      tags: config.includeBiblioTags === false,
    };

    return !disabledByKey[key];
  };

  const getOptionalBiblio = (key) => (
    isPromptBiblioEnabled(key) ? getBiblio(key) : ''
  );

  const getOptionalBiblioTagsForPrompt = (agentId) => {
    if (agentId !== 'tags') return '';
    return getBiblioTagsFormatted() || '_(aucun retour enregistré)_';
  };

  const inferUsagePositioningFromScales = (rawScales = '') => {
    const matches = Array.from(String(rawScales || '').matchAll(/(\d+(?:[.,]\d+)?)\s*mm/gi));
    const values = matches
      .map((match) => Number(String(match[1] || '').replace(',', '.')))
      .filter((value) => Number.isFinite(value));

    if (!values.length) return '';
    if (values.every((value) => value <= 75)) return 'tabletop';
    if (values.every((value) => value > 75)) return 'vitrine';
    return 'hybride';
  };

  const buildPipelineSharedFixedContent = (ctx = {}) => {
    const objectif = getOptionalBiblio('objectif');
    const psycho = getOptionalBiblio('psycho');

    const sections = [
      `SNAPSHOT FORMULAIRE:\n${ctx.pipeline_form_snapshot || 'Aucun snapshot disponible'}`,
      objectif ? `CONTEXTE GLOBAL:\n${objectif}` : '',
      psycho ? `PSYCHOLOGIE CLIENT:\n${psycho}` : '',
      // `BIBLIOTHÈQUE TITRES:\n${getOptionalBiblio('titres')}`,
      // `BIBLIOTHÈQUE TAGS:\n${getOptionalBiblioTagsForPrompt()}`,
    ];

    return sections.filter(Boolean).join('\n\n');
  };

  const parsePipelineCumulativeEntries = (ctx = {}) => {
    const explicitEntries = Array.isArray(ctx.pipeline_cumulative_entries)
      ? ctx.pipeline_cumulative_entries
          .map((entry) => ({
            agentId: String(entry?.agentId || '').trim(),
            content: String(entry?.content || '').trim(),
          }))
          .filter((entry) => entry.agentId && entry.content)
      : [];

    if (explicitEntries.length) return explicitEntries;

    const raw = String(ctx.pipeline_cumulatif || '').trim();
    if (!raw) return [];

    return raw
      .split(/\n(?=##\s+)/)
      .map((section) => String(section || '').trim())
      .filter(Boolean)
      .map((section, index) => {
        const match = section.match(/^##\s+([^\n]+)\n([\s\S]*)$/);
        if (match) {
          return {
            agentId: String(match[1] || '').trim(),
            content: String(match[2] || '').trim(),
          };
        }

        return {
          agentId: `step_${index + 1}`,
          content: section,
        };
      })
      .filter((entry) => entry.agentId && entry.content);
  };

  const buildPipelineCumulativeFixedBlocks = (ctx = {}) => {
    const entries = parsePipelineCumulativeEntries(ctx);

    return entries.map((entry, index) => ({
      key: `cumulative_append_only_${String(index + 1).padStart(2, '0')}`,
      text: `## ${entry.agentId}\n${entry.content}`,
      cacheable: index === entries.length - 1,
      cacheGroup: 'cumulative_append_only',
      cacheLabel: entry.agentId,
    }));
  };

  const buildFixedContentText = (blocks = []) => (
    blocks
      .map((block) => String(block?.text || '').trim())
      .filter(Boolean)
      .join('\n\n')
  );

  const buildSharedBlocks = (ctx = {}, includeCumulative = true) => {
    const shared = buildPipelineSharedFixedContent(ctx);
    const cumulativeBlocks = includeCumulative ? buildPipelineCumulativeFixedBlocks(ctx) : [];
    return [
      { key: 'shared_prefix', text: shared, cacheable: true, cacheGroup: 'shared_prefix' },
      ...cumulativeBlocks,
    ];
  };

  const buildPromptDebug = (agentId, filled, fixedContentBlocks = []) => ({
    agentId,
    promptChars: String(filled || '').length,
    fixedBlocks: fixedContentBlocks.map((block, index) => ({
      index,
      key: block?.key || `block_${index + 1}`,
      cacheable: Boolean(block?.cacheable),
      cacheGroup: String(block?.cacheGroup || ''),
      cacheLabel: String(block?.cacheLabel || ''),
      chars: String(block?.text || '').trim().length,
    })),
  });

  const CACHE_FIXED = {
    marche: (ctx = {}) => ({
      blocks: buildSharedBlocks(ctx, true),
    }),
    titre: (ctx = {}) => ({
      blocks: buildSharedBlocks(ctx, true),
    }),
    tags: (ctx = {}) => ({
      blocks: buildSharedBlocks(ctx, true),
    }),
    description: (ctx = {}) => ({
      blocks: buildSharedBlocks(ctx, true),
    }),
    alt: (ctx = {}) => ({
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
      .replace(/\[\[POSITIONNEMENT_USAGE\]\]/g, ctx.positionnementUsage || inferUsagePositioningFromScales(ctx.echelles) || '')
      .replace(/\[\[PIECES\]\]/g, ctx.pieces)
      .replace(/\[\[DIMENSIONS\]\]/g, ctx.dimensions || '')
      .replace(/\[\[POSE\]\]/g, ctx.pose)
      .replace(/\[\[VERSION\]\]/g, ctx.version || '')
      .replace(/\[\[TYPE\]\]/g, ctx.type || '')
      .replace(/\[\[PRESENTATION_VISUELLE\]\]/g, ctx.presentationVisuelle || '')
      .replace(/\[\[NATURE_SUJET\]\]/g, ctx.natureSujet || '')
      .replace(/\[\[BUZZ\]\]/g, ctx.buzz ? `OUI${ctx.buzzNote ? ' — ' + ctx.buzzNote : ''}` : 'NON')
      .replace(/\[\[ANALYSE\]\]/g, ctx.outputs.analyse || '')
      .replace(/\[\[ALT\]\]/g, ctx.outputs.alt || '')
      .replace(/\[\[MARCHE\]\]/g, ctx.outputs.marche || '')
      .replace(/\[\[TAGS\]\]/g, ctx.outputs.tags || '')
      .replace(/\[\[TITRE_VALIDE\]\]/g, ctx.outputs.titre_valide || '')
      .replace(/\[\[DESCRIPTION\]\]/g, ctx.outputs.description_assembled || ctx.outputs.description || '')
      .replace(/\[\[ARCHETYPES\]\]/g, ctx.archetypes || '')
      .replace(/\[\[ARCHETYPES_MANUELS\]\]/g, ctx.archetypesManuels || '')
      .replace(/\[\[SEO_ELARGIES\]\]/g, ctx.seoElargies || '')
      .replace(/\[\[OBJECTIF\]\]/g, getOptionalBiblio('objectif'))
      .replace(/\[\[PSYCHO\]\]/g, getOptionalBiblio('psycho'))
      .replace(/\[\[BIBLIO_SEMANTIQUE\]\]/g, getBiblio('bibliotheque-semantique'))
      .replace(/\[\[BIBLIO_TITRES\]\]/g, getOptionalBiblio('titres'))
      .replace(/\[\[BIBLIO_TAGS\]\]/g, getOptionalBiblioTagsForPrompt(agentId))
      .replace(/\[\[MEDIUM\]\]/g, ctx.medium || '')
      .replace(/\[\[MEDIUM_SUBCATEGORIES\]\]/g, ctx.mediumSubcategories || ctx.medium_subcategories || '')
      .replace(/\[\[GENRES\]\]/g, ctx.genres || ctx.genresTransverses || ctx.genres_transverses || '')
      .replace(/\[\[GENRES_TRANSVERSES\]\]/g, ctx.genresTransverses || ctx.genres_transverses || ctx.genres || '')
      .replace(/\[\[MEDIUM_CONTEXT\]\]/g, ctx.mediumContext || ctx.medium_context || '')
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