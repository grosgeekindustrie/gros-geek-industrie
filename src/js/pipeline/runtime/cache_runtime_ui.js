'use strict';

(function initPipelineUICacheRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};
  const runtimeFormats = global.PipelineUIRuntimeFormats || {};
  const PIPELINE_LAUNCH_STATUS_IDLE = 'pret';
  const PIPELINE_RUN_META_DEFAULTS = runtimeFormats.PIPELINE_RUN_META_DEFAULTS || Object.freeze({
    quality: 'brut',
    validation: 'non_valide',
    origin: 'auto',
  });

  function getPipelineLaunchState(prefix) {
    global.state.pipelineLaunch = global.state.pipelineLaunch || {};
    global.state.pipelineLaunch[prefix] = global.state.pipelineLaunch[prefix] || {
      currentStepId: '',
      isRunning: false,
      lastStatus: PIPELINE_LAUNCH_STATUS_IDLE,
    };
    return global.state.pipelineLaunch[prefix];
  }

  function getPromptCachePrefix(prefix = '') {
    if (prefix) return prefix;
    return global.pfx();
  }

  function formatPromptCacheTime(value) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function getRuntimeDebugState() {
    global.state.runtimeDebug = global.state.runtimeDebug || {};
    global.state.runtimeDebug.lastCacheStatus = global.state.runtimeDebug.lastCacheStatus || '-';
    global.state.runtimeDebug.activeCacheRuns = global.state.runtimeDebug.activeCacheRuns || {};
    global.state.runtimeDebug.cacheRunHistory = global.state.runtimeDebug.cacheRunHistory || {};
    global.state.runtimeDebug.promptCacheByPrefix = global.state.runtimeDebug.promptCacheByPrefix || {};
    global.state.runtimeDebug.tokenCountCache = global.state.runtimeDebug.tokenCountCache || {};

    if (!global.state.runtimeDebug.promptCacheTickerId && typeof window !== 'undefined') {
      global.state.runtimeDebug.promptCacheTickerId = window.setInterval(() => {
        renderPromptCacheIndicator();
        global.refreshPipelineLaunchPanels?.();
      }, global.PROMPT_CACHE_UI_REFRESH_MS || 5000);
    }

    return global.state.runtimeDebug;
  }

  function getPromptCacheEntry(prefix = '', createIfMissing = false) {
    const runtimeDebug = getRuntimeDebugState();
    const resolvedPrefix = getPromptCachePrefix(prefix);

    if (!runtimeDebug.promptCacheByPrefix[resolvedPrefix] && createIfMissing) {
      runtimeDebug.promptCacheByPrefix[resolvedPrefix] = {
        status: '-',
        lastConfirmedAtMs: 0,
        lastConfirmedAt: '',
        expiresAtMs: 0,
        expiresAt: '',
      };
    }

    return runtimeDebug.promptCacheByPrefix[resolvedPrefix] || null;
  }

  function getPromptCacheFreshnessInfo(prefix = '', nowMs = Date.now()) {
    const entry = getPromptCacheEntry(prefix, false);
    if (!entry?.lastConfirmedAtMs) {
      return {
        hasEstimate: false,
        state: 'none',
        label: '',
        lastConfirmedAt: '',
        expiresAt: '',
        lastConfirmedAtLabel: '-',
        expiresAtLabel: '-',
        remainingMs: 0,
      };
    }

    const expiresAtMs = entry.expiresAtMs || (entry.lastConfirmedAtMs + global.PROMPT_CACHE_TTL_MS);
    const remainingMs = expiresAtMs - nowMs;
    let state = 'stale';
    let label = 'probablement expire';

    if (remainingMs > global.PROMPT_CACHE_ZONE_GRISE_MS) {
      state = 'hot';
      label = 'chaud probable';
    } else if (remainingMs > 0) {
      state = 'gray';
      label = 'zone grise';
    }

    return {
      hasEstimate: true,
      state,
      label,
      lastConfirmedAt: entry.lastConfirmedAt || new Date(entry.lastConfirmedAtMs).toISOString(),
      expiresAt: entry.expiresAt || new Date(expiresAtMs).toISOString(),
      lastConfirmedAtLabel: formatPromptCacheTime(entry.lastConfirmedAt || entry.lastConfirmedAtMs),
      expiresAtLabel: formatPromptCacheTime(entry.expiresAt || expiresAtMs),
      remainingMs,
    };
  }

  function updatePromptCacheCheckpoint(prefix = '', status = '-') {
    const resolvedPrefix = getPromptCachePrefix(prefix);
    const entry = getPromptCacheEntry(resolvedPrefix, true);
    const now = new Date();
    entry.status = status;
    entry.lastConfirmedAtMs = now.getTime();
    entry.lastConfirmedAt = now.toISOString();
    entry.expiresAtMs = entry.lastConfirmedAtMs + global.PROMPT_CACHE_TTL_MS;
    entry.expiresAt = new Date(entry.expiresAtMs).toISOString();
  }

  function getLastCacheStatus(prefix = '') {
    const resolvedPrefix = getPromptCachePrefix(prefix);
    const entry = getPromptCacheEntry(resolvedPrefix, false);
    const baseStatus = String(entry?.status || getRuntimeDebugState().lastCacheStatus || '-');
    const freshness = getPromptCacheFreshnessInfo(resolvedPrefix);

    if (!freshness.hasEstimate) return baseStatus;
    if (baseStatus === '-') return freshness.label;
    return `${baseStatus} · ${freshness.label}`;
  }

  function renderPromptCacheIndicator(prefix = '') {
    const resolvedPrefix = getPromptCachePrefix(prefix);
    const cacheNode = document.getElementById('session-cache');
    if (!cacheNode) return;

    const freshness = getPromptCacheFreshnessInfo(resolvedPrefix);
    const status = getLastCacheStatus(resolvedPrefix);
    cacheNode.classList.remove(...(global.CACHE_FRESHNESS_CLASSES || []));
    global.PipelineUIIcons?.setIconLabel?.(cacheNode, 'layers', `cache ${status}`);

    if (!freshness.hasEstimate) {
      cacheNode.title = `Cliquer pour copier le rapport cache complet · dernier statut : ${status}`;
      return;
    }

    const stateClass = global.CACHE_FRESHNESS_CLASS_BY_STATE?.[freshness.state] || 'cache-freshness-stale';
    cacheNode.classList.add(stateClass);
    cacheNode.title = [
      `Cliquer pour copier le rapport cache complet · dernier statut : ${status}`,
      `Dernier refresh confirme : ${freshness.lastConfirmedAtLabel}`,
      `Expiration estimee si inactif : ${freshness.expiresAtLabel}`,
      `Fraicheur estimee : ${freshness.label}`,
    ].join(' · ');
  }

  function setLastCacheStatus(status, options = {}) {
    const runtimeDebug = getRuntimeDebugState();
    const resolvedPrefix = getPromptCachePrefix(options.prefix);
    const entry = getPromptCacheEntry(resolvedPrefix, true);

    entry.status = status;
    runtimeDebug.lastCacheStatus = status;

    if (status.startsWith('hit') || status.startsWith('write')) {
      updatePromptCacheCheckpoint(resolvedPrefix, status);
      runtimeDebug.lastCacheStatus = getLastCacheStatus(resolvedPrefix);
    }

    renderPromptCacheIndicator(resolvedPrefix);
  }

  function getActiveCacheDebugRun(prefix) {
    return getRuntimeDebugState().activeCacheRuns[prefix] || null;
  }

  function beginCacheDebugRun(prefix, pipelineAgents = [], options = {}) {
    const runtimeDebug = getRuntimeDebugState();
    const launchState = getPipelineLaunchState(prefix);
    const pipelineRunState = global.getPipelineRunState(prefix);
    const runRecord = {
      prefix,
      mode: global.getPipelineLaunchMode(prefix),
      launchScope: String(options.launchScope || global.PIPELINE_LAUNCH_DEFAULT_SCOPE),
      cacheAwareEnabled: Boolean(options.cacheAwareEnabled),
      startedAt: new Date().toISOString(),
      finishedAt: '',
      finalStatus: 'running',
      pipelineAgents: pipelineAgents.map((agent) => agent.id),
      events: [],
      lastHeaderStatus: runtimeDebug.lastCacheStatus || '-',
      launchStatus: launchState.lastStatus || PIPELINE_LAUNCH_STATUS_IDLE,
      warmupEnabled: false,
      warmupHint: pipelineRunState.warmupHint || 'Warmup non defini',
    };

    runtimeDebug.activeCacheRuns[prefix] = runRecord;
    return runRecord;
  }

  function finalizeCacheDebugRun(prefix, finalStatus = '') {
    const runtimeDebug = getRuntimeDebugState();
    const activeRun = runtimeDebug.activeCacheRuns[prefix];
    if (!activeRun) return;

    const pipelineRunState = global.getPipelineRunState(prefix);
    activeRun.finishedAt = new Date().toISOString();
    activeRun.finalStatus = finalStatus || activeRun.finalStatus || 'done';
    activeRun.lastHeaderStatus = runtimeDebug.lastCacheStatus || '-';
    activeRun.launchStatus = getPipelineLaunchState(prefix).lastStatus || activeRun.launchStatus || PIPELINE_LAUNCH_STATUS_IDLE;
    activeRun.warmupHint = pipelineRunState.warmupHint || activeRun.warmupHint || 'Warmup non defini';

    const warmupDetails = getCacheWarmupDetails(activeRun.events);
    activeRun.warmupEnabled = warmupDetails.enabled;
    activeRun.firstWriteOrder = warmupDetails.firstWriteOrder;
    activeRun.firstHitOrder = warmupDetails.firstHitOrder;
    runtimeDebug.cacheRunHistory[prefix] = activeRun;
  }

  function getLatestCacheDebugRun(prefix = global.pfx()) {
    const runtimeDebug = getRuntimeDebugState();
    return runtimeDebug.activeCacheRuns[prefix] || runtimeDebug.cacheRunHistory[prefix] || null;
  }

  function getCacheStatusFromUsage(usage = {}) {
    const cacheRead = usage.cache_read_input_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;

    if (cacheRead > 0) return 'hit';
    if (cacheWrite > 0) return 'write';
    return 'miss';
  }

  function getCacheWarmupDetails(events = []) {
    let firstWriteOrder = 0;
    let firstHitOrder = 0;

    const pipelineEvents = events.filter((event) => String(event?.source || 'pipeline') === 'pipeline');

    for (const event of pipelineEvents) {
      if (!firstWriteOrder && event.status === 'write') {
        firstWriteOrder = event.order || 0;
        continue;
      }

      if (firstWriteOrder && event.status === 'hit') {
        firstHitOrder = event.order || 0;
        break;
      }
    }

    return {
      enabled: Boolean(firstWriteOrder && firstHitOrder),
      firstWriteOrder,
      firstHitOrder,
    };
  }

  function normalizePipelineRunEntryMeta(entry = {}) {
    return runtimeFormats.normalizePipelineRunEntryMeta
      ? runtimeFormats.normalizePipelineRunEntryMeta(entry, PIPELINE_RUN_META_DEFAULTS)
      : {
        sourceAgentId: String(entry?.sourceAgentId || entry?.agentId || '').trim(),
        quality: String(entry?.quality || PIPELINE_RUN_META_DEFAULTS.quality).trim(),
        validation: String(entry?.validation || PIPELINE_RUN_META_DEFAULTS.validation).trim(),
        origin: String(entry?.origin || PIPELINE_RUN_META_DEFAULTS.origin).trim(),
      };
  }

  function hashTokenCountContent(text = '') {
    let hash = 2166136261;
    const input = String(text || '');

    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(16);
  }

  function getTokenCountCacheKey(model = '', text = '') {
    const normalizedText = String(text || '');
    return [String(model || ''), normalizedText.length, hashTokenCountContent(normalizedText)].join('::');
  }

  async function countTokensForSectionText(model = '', text = '') {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return 0;

    const runtimeDebug = getRuntimeDebugState();
    const resolvedModel = String(model || 'claude-sonnet-4-5').trim();
    const cacheKey = getTokenCountCacheKey(resolvedModel, normalizedText);
    const cachedValue = runtimeDebug.tokenCountCache[cacheKey];
    if (typeof cachedValue === 'number') return cachedValue;

    const response = await fetch('/anthropic/messages/count_tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: normalizedText }],
        }],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || `count_tokens HTTP ${response.status}`);
    }

    const totalInputTokens = Number(data?.input_tokens);
    if (!Number.isFinite(totalInputTokens)) {
      throw new Error('count_tokens sans input_tokens');
    }

    runtimeDebug.tokenCountCache[cacheKey] = totalInputTokens;
    return totalInputTokens;
  }

  function buildSectionTextFromBlocks(blocks = []) {
    return blocks
      .map((block) => String(block?.text || '').trim())
      .filter(Boolean)
      .join('\n\n');
  }

  function getEventSectionTexts(event = {}) {
    const fixedBlocks = Array.isArray(event.fixedBlocks) ? event.fixedBlocks : [];
    const cumulativeBlocks = fixedBlocks.filter((block) => (block.cacheGroup || '').trim() === 'cumulative_append_only'
      || String(block.key || '').startsWith('cumulative_append_only'));
    const sharedBlocks = fixedBlocks.filter((block) => block.key === 'shared_prefix');
    const snapshotBlocks = fixedBlocks.filter((block) => block.key === 'cache_aware_form_snapshot');
    const cacheableBlocks = fixedBlocks.filter((block) => block.cacheable);
    const cacheAppliedBlocks = fixedBlocks.filter((block) => block.cacheApplied);
    const cumulativeNetBlocks = cumulativeBlocks.filter((block) => String(block?.validation || '') === 'valide');
    const cumulativeBrutBlocks = cumulativeBlocks.filter((block) => (
      String(block?.quality || '') === PIPELINE_RUN_META_DEFAULTS.quality
      || String(block?.validation || '') === PIPELINE_RUN_META_DEFAULTS.validation
    ));
    const cumulativeDerivedBlocks = cumulativeBlocks.filter((block) => String(block?.quality || '') === 'derive');
    const cumulativeManualBlocks = cumulativeBlocks.filter((block) => String(block?.origin || '') === 'manuel');
    const cumulativeAutoBlocks = cumulativeBlocks.filter((block) => String(block?.origin || '') === PIPELINE_RUN_META_DEFAULTS.origin);

    return {
      fixedTotal: buildSectionTextFromBlocks(fixedBlocks),
      sharedPrefix: buildSectionTextFromBlocks(sharedBlocks),
      snapshot: buildSectionTextFromBlocks(snapshotBlocks),
      cumulativeTotal: buildSectionTextFromBlocks(cumulativeBlocks),
      cumulativeNet: buildSectionTextFromBlocks(cumulativeNetBlocks),
      cumulativeBrut: buildSectionTextFromBlocks(cumulativeBrutBlocks),
      cumulativeDerived: buildSectionTextFromBlocks(cumulativeDerivedBlocks),
      cumulativeManual: buildSectionTextFromBlocks(cumulativeManualBlocks),
      cumulativeAuto: buildSectionTextFromBlocks(cumulativeAutoBlocks),
      cacheableFixed: buildSectionTextFromBlocks(cacheableBlocks),
      cacheAppliedFixed: buildSectionTextFromBlocks(cacheAppliedBlocks),
    };
  }

  async function buildEventTokenSections(event = {}) {
    const sectionTexts = getEventSectionTexts(event);
    const model = global.getActiveAgentModel?.(event.agentId) || global.AGENT_MODELS?.[event.agentId] || 'claude-sonnet-4-5';
    const sectionEntries = Object.entries(sectionTexts);
    const tokenSections = {};

    await Promise.all(sectionEntries.map(async ([key, value]) => {
      tokenSections[key] = value ? await countTokensForSectionText(model, value) : 0;
    }));

    return tokenSections;
  }

  function recordCacheDebugEvent(prefix, agentId, usage = {}, promptDebug = null) {
    const activeRun = getActiveCacheDebugRun(prefix);
    if (!activeRun) return;

    const promptFixedBlocks = Array.isArray(promptDebug?.fixedBlocks) ? promptDebug.fixedBlocks : [];
    const runState = global.getPipelineRunState(prefix);
    const cumulativeMetaByAgent = new Map(
      (Array.isArray(runState?.cumulativeEntries) ? runState.cumulativeEntries : []).map((entry) => [
        String(entry?.agentId || '').trim(),
        normalizePipelineRunEntryMeta(entry),
      ])
    );
    const fixedBlocks = promptFixedBlocks.map((block) => {
      if ((block.cacheGroup || '').trim() !== 'cumulative_append_only' && !String(block.key || '').startsWith('cumulative_append_only')) {
        return block;
      }

      const meta = cumulativeMetaByAgent.get(String(block.cacheLabel || '').trim()) || normalizePipelineRunEntryMeta({ agentId: block.cacheLabel || block.key });
      return {
        ...block,
        sourceAgentId: meta.sourceAgentId,
        quality: meta.quality,
        validation: meta.validation,
        origin: meta.origin,
      };
    });
    const sharedBlock = fixedBlocks.find((block) => block.key === 'shared_prefix');
    const cumulativeBlocks = fixedBlocks.filter((block) => (block.cacheGroup || '').trim() === 'cumulative_append_only'
      || String(block.key || '').startsWith('cumulative_append_only'));
    const launchState = getPipelineLaunchState(prefix);
    const cacheAppliedBlocks = fixedBlocks.filter((block) => block.cacheApplied);
    const filesApiDebug = promptDebug?.filesApiDebug && typeof promptDebug.filesApiDebug === 'object'
      ? global.createFilesApiDebug(promptDebug.filesApiDebug)
      : null;
    const event = {
      order: activeRun.events.length + 1,
      agentId,
      status: getCacheStatusFromUsage(usage),
      cacheReadTokens: usage.cache_read_input_tokens || 0,
      cacheWriteTokens: usage.cache_creation_input_tokens || 0,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      promptChars: Number(promptDebug?.promptChars) || global.getPromptTextCharCount(promptDebug?.promptText || ''),
      fixedChars: fixedBlocks.reduce((sum, block) => sum + (block.chars || 0), 0),
      sharedPrefixChars: sharedBlock?.chars || 0,
      cumulativeChars: cumulativeBlocks.reduce((sum, block) => sum + (block.chars || 0), 0),
      cumulativeCacheAppliedChars: cumulativeBlocks.reduce((sum, block) => sum + (block.cacheApplied ? (block.chars || 0) : 0), 0),
      cumulativeBlockCount: cumulativeBlocks.length,
      cacheAppliedChars: cacheAppliedBlocks.reduce((sum, block) => sum + (block.chars || 0), 0),
      fixedBlocks,
      filesApiDebug,
      source: String(promptDebug?.source || 'pipeline'),
      displayStepId: launchState.currentStepId || global.getPipelineDisplayStepIdForRuntimeAgent(prefix, agentId),
      timestamp: new Date().toISOString(),
    };

    activeRun.events.push(event);
    activeRun.lastHeaderStatus = getRuntimeDebugState().lastCacheStatus || activeRun.lastHeaderStatus || '-';
  }

  async function buildCacheDebugReport(prefix = global.pfx()) {
    const run = getLatestCacheDebugRun(prefix);
    if (!run) return 'Aucun rapport cache disponible.';

    const warmupDetails = getCacheWarmupDetails(run.events);
    const warmupStatus = warmupDetails.enabled
      ? `ON (#${warmupDetails.firstWriteOrder} -> #${warmupDetails.firstHitOrder})`
      : 'OFF';
    const cacheAwareEvents = run.events.filter((event) => String(event?.source || '') === 'cache-aware-prelaunch');
    const lines = [
      '=== RAPPORT CACHE PIPELINE ===',
      `Mode: ${run.mode}`,
      `Prefixe: ${run.prefix}`,
      `Lancement: ${run.launchScope || global.PIPELINE_LAUNCH_DEFAULT_SCOPE}`,
      `Ordre: ${run.pipelineAgents.join(' -> ') || '-'}`,
      `Demarre: ${run.startedAt || '-'}`,
      `Termine: ${run.finishedAt || '-'}`,
      `Statut final: ${run.finalStatus || '-'}`,
      `Header cache: ${run.lastHeaderStatus || '-'}`,
      `Cache-aware pre-pipeline: ${cacheAwareEvents.length ? `ON (${cacheAwareEvents.length} evenement(s))` : 'OFF'}`,
      `Warmup intra-pipeline reel: ${warmupStatus}`,
      `Warmup hint: ${run.warmupHint || '-'}`,
    ];

    const freshness = getPromptCacheFreshnessInfo(prefix);
    if (freshness.hasEstimate) {
      lines.push(`Dernier refresh confirme: ${freshness.lastConfirmedAtLabel}`);
      lines.push(`Expiration estimee si inactif: ${freshness.expiresAtLabel}`);
      lines.push(`Fraicheur estimee: ${freshness.label}`);
    } else {
      lines.push('Dernier refresh confirme: -');
      lines.push('Expiration estimee si inactif: -');
      lines.push('Fraicheur estimee: -');
    }

    lines.push('');

    if (!run.events.length) {
      lines.push('Aucun evenement cache enregistre.');
      return lines.join('\n');
    }

    for (const event of run.events) {
      lines.push(`#${event.order} ${event.agentId} (${event.displayStepId || event.agentId})`);
      lines.push(`- source: ${event.source || 'pipeline'}`);
      lines.push(`- cache: ${event.status}`);
      lines.push(`- lu API reel: ${event.cacheReadTokens.toLocaleString()} tok`);
      lines.push(`- ecrit API reel: ${event.cacheWriteTokens.toLocaleString()} tok`);
      lines.push(`- input API reel: ${event.inputTokens.toLocaleString()} tok`);
      lines.push(`- output API reel: ${event.outputTokens.toLocaleString()} tok`);
      lines.push(`- prompt variable: ${event.promptChars.toLocaleString()} chars`);
      lines.push(`- bloc fixe total: ${event.fixedChars.toLocaleString()} chars`);
      lines.push(`- bloc fixe active: ${event.cacheAppliedChars.toLocaleString()} chars`);
      lines.push(`- bloc commun: ${event.sharedPrefixChars.toLocaleString()} chars`);
      lines.push(`- cumulatif transmis: ${event.cumulativeChars.toLocaleString()} chars (${(event.cumulativeBlockCount || 0).toLocaleString()} bloc(s))`);
      if (event.cumulativeCacheAppliedChars > 0) {
        lines.push(`- cumulatif cache: ${event.cumulativeCacheAppliedChars.toLocaleString()} chars`);
      }

      try {
        const tokenSections = await buildEventTokenSections(event);
        lines.push(`- bloc fixe total (count_tokens): ${Number(tokenSections.fixedTotal || 0).toLocaleString()} tok`);
        lines.push(`- bloc commun (count_tokens): ${Number(tokenSections.sharedPrefix || 0).toLocaleString()} tok`);
        lines.push(`- snapshot formulaire (count_tokens): ${Number(tokenSections.snapshot || 0).toLocaleString()} tok`);
        lines.push(`- cumulatif net valide (count_tokens): ${Number(tokenSections.cumulativeNet || 0).toLocaleString()} tok`);
        lines.push(`- cumulatif brut / non valide (count_tokens): ${Number(tokenSections.cumulativeBrut || 0).toLocaleString()} tok`);
        if (Number(tokenSections.cumulativeDerived || 0) > 0) {
          lines.push(`- cumulatif derive (count_tokens): ${Number(tokenSections.cumulativeDerived || 0).toLocaleString()} tok`);
        }
        lines.push(`- cumulatif manuel (count_tokens): ${Number(tokenSections.cumulativeManual || 0).toLocaleString()} tok`);
        lines.push(`- cumulatif auto (count_tokens): ${Number(tokenSections.cumulativeAuto || 0).toLocaleString()} tok`);
        lines.push(`- bloc fixe cacheable (count_tokens): ${Number(tokenSections.cacheableFixed || 0).toLocaleString()} tok`);
        lines.push(`- bloc fixe cache (count_tokens): ${Number(tokenSections.cacheAppliedFixed || 0).toLocaleString()} tok`);
      } catch (error) {
        lines.push(`- count_tokens sections: indisponible (${error.message})`);
      }

      if (event.filesApiDebug?.enabled) {
        const filesApiStatus = global.formatFilesApiStatusLabel(event.filesApiDebug.status);
        lines.push(`- files api: ${filesApiStatus}`);
        lines.push(`- images demandees: ${(event.filesApiDebug.requestedImagesCount || 0).toLocaleString()}`);
        lines.push(`- files utilises: ${(event.filesApiDebug.usedFilesCount || 0).toLocaleString()}`);
        lines.push(`- reuses locaux: ${(event.filesApiDebug.localReuseCount || 0).toLocaleString()}`);
        lines.push(`- reuses cache serveur: ${(event.filesApiDebug.serverCacheHitsCount || 0).toLocaleString()}`);
        lines.push(`- uploads reels: ${(event.filesApiDebug.uploadedCount || 0).toLocaleString()}`);
        lines.push(`- invalidations: ${(event.filesApiDebug.invalidatedCount || 0).toLocaleString()}`);
        lines.push(`- images non resolues: ${(event.filesApiDebug.unresolvedCount || 0).toLocaleString()}`);
        if (event.filesApiDebug.promptCacheBreakpointApplied) {
          lines.push('- breakpoint images: ON');
        }
        if (event.filesApiDebug.workspacePersisted === true) {
          lines.push('- persistance workspace: OK');
        } else if (event.filesApiDebug.workspacePersisted === false) {
          lines.push('- persistance workspace: ERREUR');
        }
        if (event.filesApiDebug.workspacePersistError) {
          lines.push(`- erreur workspace: ${event.filesApiDebug.workspacePersistError}`);
        }
        if (event.filesApiDebug.error) {
          lines.push(`- erreur files api: ${event.filesApiDebug.error}`);
        }
      }
      event.fixedBlocks.forEach((block) => {
        const cacheLabel = block.cacheable
          ? (block.cacheApplied
              ? ` · cache ON (prefixe ${Number(block.prefixChars || block.chars || 0).toLocaleString()} chars)`
              : ` · cache OFF (prefixe < ${Number(global.CACHEABLE_BLOCK_MIN_CHARS || 4096).toLocaleString()} chars)`)
          : '';
        const blockLabel = block.cacheLabel ? ` - ${block.cacheLabel}` : '';
        const metaParts = [];
        if (block.validation) metaParts.push(block.validation);
        if (block.origin) metaParts.push(block.origin);
        if (block.quality && block.quality !== PIPELINE_RUN_META_DEFAULTS.quality) metaParts.push(block.quality);
        const metaLabel = metaParts.length ? ` · ${metaParts.join(' / ')}` : '';
        lines.push(`  * ${block.key}${blockLabel}: ${block.chars.toLocaleString()} chars${cacheLabel}${metaLabel}`);
      });
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  async function copyCacheDebugReport(prefix = global.pfx()) {
    const report = await buildCacheDebugReport(prefix);
    await navigator.clipboard.writeText(report);
    global.showToast('Rapport cache copie');
  }

  function syncCacheIndicator(usage = {}) {
    const cacheRead = usage.cache_read_input_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;
    const cacheStatus = cacheRead > 0
      ? `hit · ${cacheRead.toLocaleString()} tok`
      : cacheWrite > 0
        ? `write · ${cacheWrite.toLocaleString()} tok`
        : 'miss';
    const prefix = getPromptCachePrefix();

    setLastCacheStatus(cacheStatus, { prefix });
    const activeRun = getActiveCacheDebugRun(prefix);
    if (activeRun) activeRun.lastHeaderStatus = getLastCacheStatus(prefix);
    global.refreshPipelineLaunchPanels?.();
  }

  function getPipelineLaunchSummary(prefix) {
    const launchState = getPipelineLaunchState(prefix);
    const steps = global.getPipelineTargetStepsForPrefix(prefix);
    const currentStep = steps.find((step) => step.id === launchState.currentStepId);
    const currentStepLabel = launchState.currentStepId === global.CACHE_AWARE_STEP_ID
      ? 'Cache-aware pre-pipeline'
      : (currentStep ? currentStep.label : '-');

    return [
      'Pipeline : complet',
      `Etape courante : ${currentStepLabel}`,
      `Etat : ${launchState.lastStatus || PIPELINE_LAUNCH_STATUS_IDLE}`,
      `Cache : ${getLastCacheStatus()}`,
    ].join('\n');
  }

  function getPipelinePrefixesForLaunchPanels() {
    return global.getPipelinePrefixes();
  }

  function syncStandaloneLaunchButtons(prefix) {
    const launchState = getPipelineLaunchState(prefix);
    const buttons = document.querySelectorAll(`[data-pipeline-action="launch"][data-pipeline-prefix="${prefix}"]`);

    buttons.forEach((button) => {
      button.disabled = launchState.isRunning;
      if (button.id === `runBtn-${prefix}`) {
        button.title = global.PIPELINE_LAUNCH_LABEL;
        button.setAttribute('aria-label', global.PIPELINE_LAUNCH_LABEL);
        return;
      }

      global.PipelineUIIcons?.setIconLabel?.(button, 'play', global.PIPELINE_LAUNCH_LABEL);
    });
  }

  global.PipelineUICacheRuntime = {
    getPipelineLaunchState,
    getPromptCachePrefix,
    formatPromptCacheTime,
    getRuntimeDebugState,
    getPromptCacheEntry,
    getPromptCacheFreshnessInfo,
    updatePromptCacheCheckpoint,
    getLastCacheStatus,
    renderPromptCacheIndicator,
    setLastCacheStatus,
    getActiveCacheDebugRun,
    beginCacheDebugRun,
    finalizeCacheDebugRun,
    getLatestCacheDebugRun,
    getCacheStatusFromUsage,
    getCacheWarmupDetails,
    normalizePipelineRunEntryMeta,
    hashTokenCountContent,
    getTokenCountCacheKey,
    countTokensForSectionText,
    buildSectionTextFromBlocks,
    getEventSectionTexts,
    buildEventTokenSections,
    recordCacheDebugEvent,
    buildCacheDebugReport,
    copyCacheDebugReport,
    syncCacheIndicator,
    getPipelineLaunchSummary,
    getPipelinePrefixesForLaunchPanels,
    syncStandaloneLaunchButtons,
  };

  global.PipelineUI.cacheRuntime = global.PipelineUI.cacheRuntime || {};
  Object.assign(global.PipelineUI.cacheRuntime, global.PipelineUICacheRuntime);
  Object.assign(global, global.PipelineUICacheRuntime);
})(window);
