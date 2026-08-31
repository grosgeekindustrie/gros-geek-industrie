'use strict';

(function initPipelineUIDescriptionResearchRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};

  const RESEARCH_AGENT_ID = 'description_research';
  const DESCRIPTION_IMAGE_LIMIT = 4;
  const PHASE_MARKERS = Object.freeze({
    common: ['<!-- GGI_DESCRIPTION_COMMON_START -->', '<!-- GGI_DESCRIPTION_COMMON_END -->'],
    research: ['<!-- GGI_DESCRIPTION_RESEARCH_START -->', '<!-- GGI_DESCRIPTION_RESEARCH_END -->'],
    writing: ['<!-- GGI_DESCRIPTION_WRITING_START -->', '<!-- GGI_DESCRIPTION_WRITING_END -->'],
  });

  const readPipelineSettings = () => {
    try {
      return JSON.parse(localStorage.getItem('pipeline.settings') || '{}');
    } catch (error) {
      return {};
    }
  };

  const resolveDescriptionPromptSource = (profile = {}) => {
    const settings = readPipelineSettings();
    const shopKey = String(settings.activeShop || '').trim() === 'doublex' ? 'doublex' : 'grosgeek';
    const mode = String(global.currentMode || '').trim() === 'collection' ? 'collection' : 'tabletop';
    const contextOptions = { useDoublexShopPrompts: settings.doublexUseShopPrompts !== false };
    const config = global.PipelineUIConfig || global.PipelineUIDataPromptMaps || {};
    const promptMap = config.resolvePromptFileMap?.(mode, shopKey, contextOptions) || {};
    const canonicalFolder = config.resolvePromptFolder?.(mode, shopKey, contextOptions) || `prompts/${mode}`;
    const provider = String(profile?.provider || '').trim().toLowerCase() === 'openai' ? 'openai' : 'anthropic';
    const promptFolder = global.PipelineUIPromptProfiles?.resolvePromptFolder?.(canonicalFolder, provider)
      || canonicalFolder;
    const fileName = String(promptMap.description || 'description').trim();
    return {
      path: `${promptFolder}/${fileName}.md`,
      fileName,
      provider,
      familyLabel: provider === 'openai' ? 'GPT' : 'Claude',
      shopKey,
      mode,
    };
  };

  const findMarkerPositions = (source = '', marker = '') => {
    const positions = [];
    let offset = 0;
    while (marker && offset < source.length) {
      const position = source.indexOf(marker, offset);
      if (position === -1) break;
      positions.push(position);
      offset = position + marker.length;
    }
    return positions;
  };

  const getSection = (template, markers) => {
    const start = template.indexOf(markers[0]);
    const end = template.indexOf(markers[1]);
    if (start === -1 || end === -1 || end <= start) return '';
    return template.slice(start + markers[0].length, end).trim();
  };

  const parseDescriptionPromptPhases = (template = '') => {
    const source = String(template || '').trim();
    const markerPositions = Object.fromEntries(Object.entries(PHASE_MARKERS).map(([phase, markers]) => [phase, {
      start: findMarkerPositions(source, markers[0]),
      end: findMarkerPositions(source, markers[1]),
    }]));
    const commonStart = markerPositions.common.start[0] ?? -1;
    const writingEnd = markerPositions.writing.end[0] ?? -1;
    const common = getSection(source, PHASE_MARKERS.common);
    const research = getSection(source, PHASE_MARKERS.research);
    const writing = getSection(source, PHASE_MARKERS.writing);
    const markersAreUnique = Object.values(markerPositions).every((positions) => (
      positions.start.length === 1 && positions.end.length === 1
    ));
    const markersAreOrdered = markersAreUnique
      && markerPositions.common.start[0] < markerPositions.common.end[0]
      && markerPositions.common.end[0] < markerPositions.research.start[0]
      && markerPositions.research.start[0] < markerPositions.research.end[0]
      && markerPositions.research.end[0] < markerPositions.writing.start[0]
      && markerPositions.writing.start[0] < markerPositions.writing.end[0];
    const hasExplicitPhases = Boolean(common && research && writing && markersAreOrdered);
    const preamble = hasExplicitPhases && commonStart > 0 ? source.slice(0, commonStart).trim() : '';
    const trailing = hasExplicitPhases && writingEnd >= 0
      ? source.slice(writingEnd + PHASE_MARKERS.writing[1].length).trim()
      : '';
    return {
      source,
      preamble,
      common,
      research,
      writing,
      trailing,
      hasExplicitPhases,
      markerDiagnostics: {
        positions: markerPositions,
        markersAreUnique,
        markersAreOrdered,
        commonChars: common.length,
        researchChars: research.length,
        writingChars: writing.length,
      },
    };
  };

  const buildResearchPrompt = (filledPrompt = '', imageCount = 0) => {
    const phases = parseDescriptionPromptPhases(filledPrompt);
    if (!phases.hasExplicitPhases) return phases.source;
    return [phases.preamble, phases.common, phases.research].filter(Boolean).join('\n\n');
  };

  const buildWritingPrompt = (filledPrompt = '', researchBrief = '') => {
    const phases = parseDescriptionPromptPhases(filledPrompt);
    const promptContract = phases.hasExplicitPhases
      ? [phases.preamble, phases.common, phases.writing, phases.trailing].filter(Boolean).join('\n\n')
      : phases.source;
    return [
      promptContract,
      '',
      'BRIEF DE RECHERCHE WEB FOURNI PAR LA PHASE RECHERCHE :',
      String(researchBrief || '').trim(),
      '',
      'Utilise ce brief comme contexte factuel complémentaire. Les images restent la source prioritaire pour tout détail visuel.',
      'Ne mentionne ni la recherche, ni le modèle de recherche, ni le brief dans la sortie. Respecte exclusivement le format final du prompt de rédaction.',
    ].join('\n');
  };

  const hashText = (value = '') => {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  };

  const getImageFingerprint = (image = {}, index = 0) => {
    const base64 = String(image.base64 || '');
    return [
      index,
      image.contentHash || hashText(base64),
      image.name || '',
      image.mediaType || '',
      base64.length,
    ].join(':');
  };

  const getResearchCache = () => {
    global.state.descriptionResearchCache = global.state.descriptionResearchCache || {};
    return global.state.descriptionResearchCache;
  };

  const buildResearchSignature = ({ prefix, promptText, promptSource = null, config, images }) => hashText(JSON.stringify({
    prefix,
    promptText,
    promptSource: String(promptSource?.path || ''),
    model: config.model,
    reasoningEffort: config.reasoningEffort,
    maxToolCalls: config.maxToolCalls,
    searchContextSize: config.searchContextSize,
    images: images.map(getImageFingerprint),
  }));

  const appendSources = (brief, sources = []) => {
    const cleanSources = Array.isArray(sources) ? sources.filter((source) => source?.url) : [];
    if (!cleanSources.length) return String(brief || '').trim();
    const sourceLines = cleanSources.map((source) => `- ${source.title || source.url} — ${source.url}`);
    return `${String(brief || '').trim()}\n\nSOURCES TECHNIQUES RETOURNÉES PAR L’API :\n${sourceLines.join('\n')}`;
  };

  async function prepareDescriptionPrompt({ prefix, prompt, aiProfileSnapshot }) {
    const profile = global.PipelineUIAIProfiles.normalizeConfig(aiProfileSnapshot);
    const config = global.PipelineUIAIProfiles.normalizeDescriptionResearch(profile.descriptionResearch, profile.provider);
    const basePrompt = { ...prompt, imageLimit: DESCRIPTION_IMAGE_LIMIT };
    if (profile.provider !== 'openai' || !config.enabled) return { prompt: basePrompt, research: null };

    const images = Array.isArray(global.state?.images?.[prefix])
      ? global.state.images[prefix].slice(0, DESCRIPTION_IMAGE_LIMIT)
      : [];
    if (!images.length) throw new Error('Recherche Description impossible : aucune image disponible');

    const promptSource = resolveDescriptionPromptSource(profile);
    const phases = parseDescriptionPromptPhases(prompt.filled);
    if (!phases.hasExplicitPhases) {
      const sourcePath = String(promptSource.path || 'chemin inconnu');
      throw new Error(`Recherche Description impossible : marqueurs de phases absents, dupliqués ou désordonnés dans ${sourcePath}`);
    }
    const researchPrompt = buildResearchPrompt(prompt.filled, images.length);
    const signature = buildResearchSignature({
      prefix,
      promptText: researchPrompt,
      promptSource,
      config,
      images,
    });
    const cache = getResearchCache();
    const cached = cache[prefix];
    if (config.reuseIdentical && cached?.signature === signature && String(cached?.brief || '').trim()) {
      const reusedResearch = {
        ...cached,
        lastUsedAt: new Date().toISOString(),
        lastRunReused: true,
      };
      cache[prefix] = reusedResearch;
      global.persistPipelineRuntimeState?.(prefix);
      return {
        prompt: { ...basePrompt, filled: buildWritingPrompt(prompt.filled, cached.brief) },
        research: { ...reusedResearch, reused: true },
      };
    }

    const execution = {
      provider: 'openai',
      model: config.model,
      reasoningEffort: config.reasoningEffort,
      task: 'description_research',
      profileId: profile.id,
      profileLabel: global.PipelineUIAIProfiles.getProfileLabel(profile),
    };
    const response = await global.callOpenAI(RESEARCH_AGENT_ID, {
      filled: researchPrompt,
      fixedContent: '',
      fixedContentBlocks: [],
      workspacePrefix: prefix,
      runtimeAgentId: RESEARCH_AGENT_ID,
      aiExecution: execution,
      imageLimit: DESCRIPTION_IMAGE_LIMIT,
      responsesOptions: {
        tools: [{ type: 'web_search', search_context_size: config.searchContextSize }],
        maxToolCalls: config.maxToolCalls,
        include: ['web_search_call.action.sources'],
        maxOutputTokens: 2400,
        verbosity: 'low',
      },
      promptDebug: { agentId: RESEARCH_AGENT_ID, promptChars: researchPrompt.length, fixedBlocks: [] },
    }, true, 2);
    const brief = appendSources(response.text, response.sources);
    const research = {
      signature,
      brief,
      model: config.model,
      reasoningEffort: config.reasoningEffort,
      maxToolCalls: config.maxToolCalls,
      searchContextSize: config.searchContextSize,
      webSearchCalls: Math.max(0, Number(response.usage?.web_search_calls) || 0),
      webSearchCallDetails: Array.isArray(response.webSearchCallDetails) ? response.webSearchCallDetails : [],
      sources: Array.isArray(response.sources) ? response.sources : [],
      responseId: String(response.responseId || ''),
      requestDebug: response.requestDebug && typeof response.requestDebug === 'object' ? response.requestDebug : {},
      responseDebug: response.responseDebug && typeof response.responseDebug === 'object' ? response.responseDebug : {},
      usage: response.usage && typeof response.usage === 'object' ? { ...response.usage } : {},
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      lastRunReused: false,
      reused: false,
      researchInput: researchPrompt,
      promptSource: { ...promptSource },
      phaseExtraction: phases.markerDiagnostics && typeof phases.markerDiagnostics === 'object'
        ? JSON.parse(JSON.stringify(phases.markerDiagnostics))
        : {},
    };
    cache[prefix] = research;
    global.showAgentCost?.(RESEARCH_AGENT_ID, response.usage, {
      prefix,
      source: 'description-web-research',
      execution,
    });
    global.persistPipelineRuntimeState?.(prefix);
    return {
      prompt: { ...basePrompt, filled: buildWritingPrompt(prompt.filled, brief) },
      research,
    };
  }

  const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('fr-FR');
  };

  function showDescriptionResearchDebug(prefix = global.pfx?.() || 'tt') {
    const research = getResearchCache()[prefix];
    if (!research?.brief) {
      global.showToast?.('Aucune recherche Description disponible pour ce workspace', '#e8c547');
      return;
    }

    const sourceLines = Array.isArray(research.sources) && research.sources.length
      ? research.sources.map((source) => `- ${source.title || source.url}\n  ${source.url}`).join('\n')
      : '— aucune source structurée retournée —';
    const usage = research.usage && typeof research.usage === 'object' ? research.usage : {};
    const toolCalls = Array.isArray(research.webSearchCallDetails) ? research.webSearchCallDetails : [];
    const toolCallLines = toolCalls.length
      ? toolCalls.flatMap((call) => {
          const target = call.query
            || (Array.isArray(call.queries) && call.queries.length ? call.queries.join(' | ') : '')
            || call.url
            || call.pattern
            || '—';
          return [
            `OBJET #${call.index || '?'} · ${call.id || 'ID absent'}${call.duplicateOf ? ` · doublon de l’objet #${call.duplicateOf}, non recompté` : ' · comptabilisé'}`,
            `Action : ${call.actionType || 'non renseignée'} · Statut : ${call.status || '—'}`,
            `Requête / URL / motif : ${target}`,
            'Élément web_search_call brut :',
            JSON.stringify(call.raw || {}, null, 2),
            '',
          ];
        }).join('\n')
      : '— aucun élément web_search_call brut enregistré —';
    const maxToolCallsSent = Number(research.requestDebug?.maxToolCallsSent) || 0;
    const maxToolCallsEchoed = Number(research.responseDebug?.maxToolCallsEchoed) || 0;
    const rawWebSearchObjects = Math.max(0, Number(research.responseDebug?.rawWebSearchObjects) || toolCalls.length);
    const promptSource = research.promptSource && typeof research.promptSource === 'object' ? research.promptSource : {};
    const phaseExtraction = research.phaseExtraction && typeof research.phaseExtraction === 'object' ? research.phaseExtraction : {};
    const exactResearchInput = String(research.requestDebug?.promptTextSent || research.researchInput || '').trim();
    const debugText = [
      'MÉTADONNÉES DE LA DERNIÈRE UTILISATION',
      `Contrôle limite : ${research.responseDebug?.toolCallLimitExceeded ? '⚠ ANOMALIE — plus d’appels retournés que la limite envoyée' : 'OK'}`,
      `Statut : ${research.lastRunReused ? 'brief réutilisé depuis le cache' : 'nouvelle recherche exécutée'}`,
      `Modèle de recherche : ${research.model || '—'}`,
      `Modèle réellement envoyé : ${research.requestDebug?.modelSent || '—'}`,
      `Niveau de réflexion : ${research.reasoningEffort || '—'}`,
      `Contexte Web : ${research.searchContextSize || '—'}`,
      `Budget configuré : ${research.maxToolCalls || '—'} appel(s) outil`,
      `max_tool_calls réellement envoyé : ${maxToolCallsSent || 'absent'}`,
      `max_tool_calls retourné par l’API : ${maxToolCallsEchoed || 'absent'}`,
      `Images envoyées : ${Number(research.requestDebug?.imageCountSent) || 0}`,
      `Objets web_search_call bruts retournés : ${rawWebSearchObjects}`,
      `Appels Web uniques comptabilisés : ${Number(research.webSearchCalls) || 0}`,
      `Statut Responses API : ${research.responseDebug?.status || '—'}`,
      `Détail incomplete : ${research.responseDebug?.incompleteDetails ? JSON.stringify(research.responseDebug.incompleteDetails) : '—'}`,
      `Création du brief : ${formatDateTime(research.createdAt)}`,
      `Dernière utilisation : ${formatDateTime(research.lastUsedAt || research.createdAt)}`,
      `Signature cache : ${research.signature || '—'}`,
      `Response ID : ${research.responseId || '—'}`,
      '',
      'PROMPT ACTIF ET EXTRACTION',
      `Chemin exact : ${promptSource.path || '—'}`,
      `Famille : ${promptSource.familyLabel || promptSource.provider || '—'} · Boutique : ${promptSource.shopKey || '—'} · Mode : ${promptSource.mode || '—'}`,
      `Marqueurs uniques : ${phaseExtraction.markersAreUnique ? 'oui' : 'non'} · ordre valide : ${phaseExtraction.markersAreOrdered ? 'oui' : 'non'}`,
      `Tailles extraites : commun ${Number(phaseExtraction.commonChars) || 0} · recherche ${Number(phaseExtraction.researchChars) || 0} · rédaction ${Number(phaseExtraction.writingChars) || 0} caractères`,
      '',
      'TOKENS DE LA PHASE RECHERCHE',
      `Entrants bruts : ${Number(usage.raw_input_tokens) || 0}`,
      `Entrants hors cache facturés au tarif normal : ${Number(usage.input_tokens) || 0}`,
      `Lus depuis le cache : ${Number(usage.cache_read_input_tokens) || 0}`,
      `Écrits en cache : ${Number(usage.cache_creation_input_tokens) || 0}`,
      `Sortants : ${Number(usage.output_tokens) || 0}`,
      `Raisonnement (inclus dans les sortants) : ${Number(usage.reasoning_tokens) || 0}`,
      `Total déclaré par l’API : ${Number(usage.total_tokens) || 0}`,
      '',
      'APPELS WEB BRUTS',
      toolCallLines,
      '',
      'INPUT TEXTE EXACT ENVOYÉ À LA PHASE RECHERCHE',
      exactResearchInput || '— indisponible pour cet ancien brief ; forcer une nouvelle recherche —',
      '',
      'SOURCES STRUCTURÉES',
      sourceLines,
      '',
      'BRIEF BRUT TRANSMIS AU RÉDACTEUR',
      research.brief,
    ].join('\n');
    const title = document.getElementById('rawInputTitle');
    const textarea = document.getElementById('rawInputTextarea');
    const count = document.getElementById('rawInputCount');
    const lightbox = document.getElementById('rawInputLightbox');
    if (!title || !textarea || !count || !lightbox) return;
    title.textContent = '🌐 DEBUG RECHERCHE DESCRIPTION';
    textarea.value = debugText;
    count.textContent = `${debugText.length.toLocaleString()} car.`;
    lightbox.classList.add('visible');
  }

  const api = Object.freeze({
    RESEARCH_AGENT_ID,
    DESCRIPTION_IMAGE_LIMIT,
    PHASE_MARKERS,
    parseDescriptionPromptPhases,
    buildResearchPrompt,
    buildWritingPrompt,
    buildResearchSignature,
    resolveDescriptionPromptSource,
    prepareDescriptionPrompt,
    showDescriptionResearchDebug,
  });

  global.PipelineUIDescriptionResearchRuntime = api;
  global.PipelineUI.runtimeDescriptionResearch = api;
})(window);
