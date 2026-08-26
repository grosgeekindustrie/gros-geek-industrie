'use strict';

(function initPipelineUICostRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};
  const CACHE_AWARE_PRELAUNCH_LABEL = 'cache-aware pré-pipeline';

  function getCostRatesForAgent(agentId = '', modelOverride = '', providerOverride = '') {
    const model = String(modelOverride || global.getActiveAgentModel?.(agentId) || global.AGENT_MODELS[agentId] || '');
    const provider = String(providerOverride || '').trim().toLowerCase();
    const normalizedModel = String(provider === 'openai' ? model : (global.normalizeClaudeModelId?.(model) || model)).trim().toLowerCase();

    if (provider === 'openai' || normalizedModel.startsWith('gpt-')) {
      if (normalizedModel.includes('luna')) {
        return { input: 0.20 / 1_000_000, cacheWrite: 0.25 / 1_000_000, cacheRead: 0.02 / 1_000_000, output: 1.20 / 1_000_000 };
      }
      if (normalizedModel.includes('terra')) {
        return { input: 2.00 / 1_000_000, cacheWrite: 2.50 / 1_000_000, cacheRead: 0.20 / 1_000_000, output: 12.00 / 1_000_000 };
      }
      return { input: 4.00 / 1_000_000, cacheWrite: 5.00 / 1_000_000, cacheRead: 0.40 / 1_000_000, output: 20.00 / 1_000_000 };
    }

    if (normalizedModel.includes('haiku')) {
      return {
        input: 0.80 / 1_000_000,
        cacheWrite: 1.00 / 1_000_000,
        cacheRead: 0.08 / 1_000_000,
        output: 4.00 / 1_000_000,
      };
    }

    if (
      normalizedModel.includes('opus-4-5')
      || normalizedModel.includes('opus-4-6')
      || normalizedModel.includes('opus-4-7')
      || normalizedModel.includes('opus-4-8')
    ) {
      return {
        input: 5.00 / 1_000_000,
        cacheWrite: 6.25 / 1_000_000,
        cacheRead: 0.50 / 1_000_000,
        output: 25.00 / 1_000_000,
      };
    }

    if (normalizedModel.includes('opus')) {
      return {
        input: 15.00 / 1_000_000,
        cacheWrite: 18.75 / 1_000_000,
        cacheRead: 1.50 / 1_000_000,
        output: 75.00 / 1_000_000,
      };
    }

    return {
      input: 3.00 / 1_000_000,
      cacheWrite: 3.75 / 1_000_000,
      cacheRead: 0.30 / 1_000_000,
      output: 15.00 / 1_000_000,
    };
  }

  function toSafeTokenCount(value) {
    return Math.max(0, Number(value) || 0);
  }

  function getCostTrackingState() {
    global.state.costTracking = global.state.costTracking || {
      entries: [],
      nextOrder: 1,
      aggregatesByKey: {},
      totals: {
        inputTok: 0,
        outputTok: 0,
        cacheRead: 0,
        cacheWrite: 0,
        reasoningTok: 0,
        costCents: 0,
      },
    };
    global.state.agentUsage = global.state.agentUsage || {};
    global.state.sessionCost = Number(global.state.sessionCost) || 0;

    return global.state.costTracking;
  }

  function getCostModeLabel(prefix = '') {
    return prefix === 'col' ? 'Collection' : 'Tabletop';
  }

  function getCostModeShortLabel(prefix = '') {
    return prefix === 'col' ? 'COL' : 'TT';
  }

  function getCostAgentLabel(prefix = '', agentId = '') {
    const labelsByPrefix = {
      tt: {
        titre: '01 Maya',
        titre_explorer: '01b Maya Explorer',
        tags: '02 Karim',
        marche: '03 Sophie',
        description: '04 Claire',
        alt: '05 Nadia',
        traduction_en: 'EN Mapping',
        traduction_listing_en: 'EN Listing',
        traduction_de: 'DE Mapping',
        traduction_listing_de: 'DE Listing',
        traduction_es: 'ES Mapping',
        traduction_listing_es: 'ES Listing',
        traduction_it: 'IT Mapping',
        traduction_listing_it: 'IT Listing',
        traduction_nl: 'NL Mapping',
        traduction_listing_nl: 'NL Listing',
        traduction_pt: 'PT Mapping',
        traduction_listing_pt: 'PT Listing',
        social: '06 Léo',
        instagram: 'Instagram',
        camille: '07 Camille',
        iris: 'Iris',
        cache_aware: '00 Cache-aware',
      },
      col: {
        titre: '01 Nova',
        titre_explorer: '01b Nova Explorer',
        tags: '02 Axel',
        description: '03 Eden',
        alt: '04 Jules ALT',
        traduction_en: 'EN Mapping',
        traduction_listing_en: 'EN Listing',
        traduction_de: 'DE Mapping',
        traduction_listing_de: 'DE Listing',
        traduction_es: 'ES Mapping',
        traduction_listing_es: 'ES Listing',
        traduction_it: 'IT Mapping',
        traduction_listing_it: 'IT Listing',
        traduction_nl: 'NL Mapping',
        traduction_listing_nl: 'NL Listing',
        traduction_pt: 'PT Mapping',
        traduction_listing_pt: 'PT Listing',
        social: '05 Theo',
        instagram: 'Instagram',
        camille: '06 Zoe',
        iris: 'Iris',
        cache_aware: '00 Cache-aware',
      },
    };

    return labelsByPrefix[prefix]?.[agentId] || agentId;
  }

  function getCostModelAgentId(agentId = '') {
    if (agentId === 'titre_explorer') return 'titre';
    return agentId;
  }

  function getCostModelName(agentId = '', execution = null) {
    const rawModel = String(execution?.model || global.getActiveAgentModel?.(getCostModelAgentId(agentId)) || global.AGENT_MODELS[getCostModelAgentId(agentId)] || '—');
    return execution?.provider === 'openai' ? rawModel : String(global.normalizeClaudeModelId?.(rawModel) || rawModel);
  }

  function getCostEntryType(entry = {}) {
    if (entry.source === 'cache-aware-prelaunch' || entry.agentId === 'cache_aware') return 'cache_aware_prelaunch';
    if (entry.isWarmupEvent) return 'warmup';
    if (entry.source === 'iris' || entry.agentId === 'iris') return 'iris';
    if (entry.source === 'translation' || ['traduction_en', 'traduction_listing_en', 'traduction_de', 'traduction_listing_de', 'traduction_es', 'traduction_listing_es', 'traduction_it', 'traduction_listing_it', 'traduction_nl', 'traduction_listing_nl', 'traduction_pt', 'traduction_listing_pt'].includes(entry.agentId)) return 'translation';
    if (entry.source === 'social' || entry.source === 'camille') return 'social';
    if (entry.source === 'titre-explorer' || entry.agentId === 'titre_explorer') return 'explorer';
    if (entry.source === 'rerun') return 'rerun';
    if (entry.source === 'pipeline') return 'pipeline';
    return 'other';
  }

  function getCostEntryTypeLabel(entry = {}) {
    const labels = {
      pipeline: 'pipeline agent',
      rerun: 'rerun',
      iris: 'iris',
      translation: 'translation',
      social: 'social',
      explorer: 'explorer',
      cache_aware_prelaunch: CACHE_AWARE_PRELAUNCH_LABEL,
      warmup: 'warmup',
      other: 'autre',
    };

    return labels[getCostEntryType(entry)] || 'autre';
  }

  function getCostEntryTotalTokens(entry = {}) {
    return toSafeTokenCount(entry.inputTok)
      + toSafeTokenCount(entry.cacheWrite)
      + toSafeTokenCount(entry.cacheRead)
      + toSafeTokenCount(entry.outputTok);
  }

  function buildCostTypeTotals(entries = []) {
    const totals = {
      pipeline: { count: 0, costCents: 0 },
      rerun: { count: 0, costCents: 0 },
      iris: { count: 0, costCents: 0 },
      translation: { count: 0, costCents: 0 },
      cache_aware_prelaunch: { count: 0, costCents: 0 },
      warmup: { count: 0, costCents: 0 },
      social: { count: 0, costCents: 0 },
      explorer: { count: 0, costCents: 0 },
      other: { count: 0, costCents: 0 },
    };

    entries.forEach((entry) => {
      const type = getCostEntryType(entry);
      if (!totals[type]) totals[type] = { count: 0, costCents: 0 };
      totals[type].count += 1;
      totals[type].costCents += Number(entry.costCents) || 0;
    });

    return totals;
  }

  function buildUsageCostSnapshot(agentId, usage = {}, execution = null) {
    const rates = getCostRatesForAgent(agentId, execution?.model, execution?.provider);
    const inputTok = toSafeTokenCount(usage.input_tokens);
    const outputTok = toSafeTokenCount(usage.output_tokens);
    const cacheRead = toSafeTokenCount(usage.cache_read_input_tokens);
    const cacheWrite = toSafeTokenCount(usage.cache_creation_input_tokens);
    const reasoningTok = toSafeTokenCount(usage.reasoning_tokens);
    const inputCostCents = inputTok * rates.input * 100;
    const cacheWriteCostCents = cacheWrite * rates.cacheWrite * 100;
    const cacheReadCostCents = cacheRead * rates.cacheRead * 100;
    const outputCostCents = outputTok * rates.output * 100;
    const costCents = inputCostCents + cacheWriteCostCents + cacheReadCostCents + outputCostCents;

    return {
      inputTok,
      outputTok,
      cacheRead,
      cacheWrite,
      reasoningTok,
      inputCostCents,
      cacheWriteCostCents,
      cacheReadCostCents,
      outputCostCents,
      costCents,
    };
  }

  function getAgentCostAggregateKey(prefix = '', agentId = '') {
    return `${prefix || 'tt'}::${agentId}`;
  }

  function recomputeCostTracking() {
    const tracking = getCostTrackingState();
    const aggregatesByKey = {};
    const totals = {
      inputTok: 0,
      outputTok: 0,
      cacheRead: 0,
      cacheWrite: 0,
      reasoningTok: 0,
      costCents: 0,
    };

    tracking.entries.forEach((entry) => {
      totals.inputTok += entry.inputTok;
      totals.outputTok += entry.outputTok;
      totals.cacheRead += entry.cacheRead;
      totals.cacheWrite += entry.cacheWrite;
      totals.reasoningTok += entry.reasoningTok || 0;
      totals.costCents += entry.costCents;

      const aggregateKey = getAgentCostAggregateKey(entry.prefix, entry.agentId);
      if (!aggregatesByKey[aggregateKey]) {
        aggregatesByKey[aggregateKey] = {
          key: aggregateKey,
          prefix: entry.prefix,
          mode: entry.mode,
          agentId: entry.agentId,
          label: entry.label,
          source: entry.source,
          executionCount: 0,
          inputTok: 0,
          outputTok: 0,
          cacheRead: 0,
          cacheWrite: 0,
          reasoningTok: 0,
          costCents: 0,
          firstOrder: entry.order,
          lastOrder: entry.order,
          lastEntry: entry,
        };
      }

      const aggregate = aggregatesByKey[aggregateKey];
      aggregate.executionCount += 1;
      aggregate.inputTok += entry.inputTok;
      aggregate.outputTok += entry.outputTok;
      aggregate.cacheRead += entry.cacheRead;
      aggregate.cacheWrite += entry.cacheWrite;
      aggregate.reasoningTok += entry.reasoningTok || 0;
      aggregate.costCents += entry.costCents;
      aggregate.lastOrder = entry.order;
      aggregate.lastEntry = entry;
    });

    tracking.aggregatesByKey = aggregatesByKey;
    tracking.totals = totals;
    global.state.sessionCost = totals.costCents;
    global.state.agentUsage = Object.fromEntries(
      Object.entries(aggregatesByKey).map(([key, aggregate]) => [key, { ...aggregate }]),
    );

    return {
      tracking,
      aggregatesByKey,
      totals,
    };
  }

  function refreshSessionCostDisplay() {
    const { tracking, totals } = recomputeCostTracking();
    const sessionEl = document.getElementById('session-cost');
    if (!sessionEl) return;

    global.PipelineUIIcons?.setIconLabel?.(sessionEl, 'coins', `${totals.costCents.toFixed(2)}¢`);
    sessionEl.style.color = '';
    if (totals.costCents > 10) sessionEl.style.color = 'var(--accent)';
    if (totals.costCents > 20) sessionEl.style.color = 'var(--error)';
    sessionEl.title = [
      'Cliquer pour copier le rapport coûts/tokens session',
      `Total session : ${totals.costCents.toFixed(3)}¢`,
      `Événements : ${Array.isArray(tracking.entries) ? tracking.entries.length : 0}`,
    ].join(' · ');
    sessionEl.setAttribute('aria-label', `Copier le rapport coûts/tokens session · total ${totals.costCents.toFixed(2)} cents`);
  }

  function getAgentCostBodyElement(prefix, agentId) {
    return document.getElementById(`${prefix}-body-${agentId}`) || document.getElementById(`body-${agentId}-${prefix}`);
  }

  function renderAgentCostBadge(prefix, agentId) {
    const { aggregatesByKey } = recomputeCostTracking();
    const aggregate = aggregatesByKey[getAgentCostAggregateKey(prefix, agentId)];
    const body = getAgentCostBodyElement(prefix, agentId);
    if (!aggregate || !body) return;

    const badgeId = `cost-badge-${prefix}-${agentId}`;
    const existing = document.getElementById(badgeId);
    if (existing) existing.remove();

    const badge = document.createElement('div');
    badge.id = badgeId;
    badge.style.cssText = 'margin:4px 0 6px;padding:4px 10px;border-radius:4px;font-family:Space Mono,monospace;font-size:10px;color:var(--muted);background:rgba(255,255,255,.03);border:1px solid var(--border);display:flex;gap:12px;flex-wrap:wrap;';

    const lastEntry = aggregate.lastEntry || aggregate;
    const parts = [
      `Σ ${aggregate.costCents.toFixed(3)}¢`,
      `run ${lastEntry.costCents.toFixed(3)}¢`,
      `x${aggregate.executionCount}`,
      `📥 ${lastEntry.inputTok.toLocaleString()} tok`,
      `📤 ${lastEntry.outputTok.toLocaleString()} tok`,
    ];

    if (lastEntry.cacheWrite > 0) parts.push(`✍️ ${lastEntry.cacheWrite.toLocaleString()} tok`);
    if (lastEntry.cacheRead > 0) parts.push(`⚡ ${lastEntry.cacheRead.toLocaleString()} tok`);
    if (lastEntry.reasoningTok > 0) parts.push(`🧠 ${lastEntry.reasoningTok.toLocaleString()} tok`);

    badge.innerHTML = parts.join('<span class="cost-badge-separator">|</span>');
    badge.title = [
      `${getCostAgentLabel(prefix, agentId)} · ${getCostModeLabel(prefix)}`,
      `Cumul session agent: ${aggregate.costCents.toFixed(3)}¢`,
      `Dernière exécution: ${lastEntry.costCents.toFixed(3)}¢`,
      `Exécutions: ${aggregate.executionCount}`,
    ].join(' · ');
    body.insertBefore(badge, body.firstChild);
  }

  function recordSessionCostEvent(agentId, usage, options = {}) {
    if (!usage) return null;

    const resolvedPrefix = String(options.prefix || global.pfx());
    const resolvedAgentId = String(agentId || '').trim();
    if (!resolvedAgentId) return null;

    const tracking = getCostTrackingState();
    const execution = options.execution || usage.ai_execution || null;
    const snapshot = buildUsageCostSnapshot(resolvedAgentId, usage, execution);
    const activeCacheRun = global.getActiveCacheDebugRun(resolvedPrefix);
    const activeCacheEvents = Array.isArray(activeCacheRun?.events) ? activeCacheRun.events : [];
    const matchingCacheEvents = activeCacheEvents.filter((event) => {
      return event.agentId === resolvedAgentId || event.displayStepId === resolvedAgentId;
    });
    const lastCacheEvent = matchingCacheEvents[matchingCacheEvents.length - 1] || null;
    const warmupDetails = global.getCacheWarmupDetails(activeCacheEvents);
    const cacheStatus = lastCacheEvent?.status || (snapshot.cacheRead > 0 ? 'hit' : snapshot.cacheWrite > 0 ? 'write' : 'miss');
    const isWarmupEvent = Boolean(
      String(options.source || 'agent') === 'pipeline'
      && lastCacheEvent
      && lastCacheEvent.status === 'write'
      && warmupDetails.firstWriteOrder === lastCacheEvent.order
    );
    const entry = {
      order: tracking.nextOrder++,
      prefix: resolvedPrefix,
      mode: global.getPipelineLaunchMode(resolvedPrefix),
      agentId: resolvedAgentId,
      label: getCostAgentLabel(resolvedPrefix, resolvedAgentId),
      provider: String(execution?.provider || 'anthropic'),
      model: getCostModelName(resolvedAgentId, execution),
      task: String(execution?.task || global.PipelineUIAIProfiles?.getTaskForAgent?.(resolvedAgentId) || ''),
      profileId: String(execution?.profileId || ''),
      source: String(options.source || 'agent'),
      timestamp: new Date().toISOString(),
      totalTokens: getCostEntryTotalTokens(snapshot),
      cacheStatus,
      isWarmupEvent,
      cacheEventOrder: lastCacheEvent?.order || 0,
      ...snapshot,
    };

    tracking.entries.push(entry);
    recomputeCostTracking();
    return entry;
  }

  function showAgentCost(agentId, usage, options = {}) {
    const entry = recordSessionCostEvent(agentId, usage, options);
    if (!entry) return null;

    refreshSessionCostDisplay();
    renderAgentCostBadge(entry.prefix, entry.agentId);
    return entry;
  }

  function copyTokenReport() {
    const { tracking, totals, aggregatesByKey } = recomputeCostTracking();
    const entries = Array.isArray(tracking.entries) ? tracking.entries : [];
    if (!entries.length) {
      global.showToast('Aucun coût session à copier', '#ff4757');
      return;
    }

    const categoryTotals = buildCostTypeTotals(entries);
    const linesSum = entries.reduce((sum, entry) => sum + (Number(entry.costCents) || 0), 0);
    const topEntries = [...entries].sort((left, right) => right.costCents - left.costCents).slice(0, 3);
    const latestRuns = ['tt', 'col']
      .map((prefix) => global.getLatestCacheDebugRun(prefix))
      .filter(Boolean);
    const warmupSummaries = latestRuns.length
      ? latestRuns.map((run) => {
          const details = global.getCacheWarmupDetails(run.events || []);
          return `${getCostModeShortLabel(run.prefix)} ${details.enabled ? `ON (#${details.firstWriteOrder} → #${details.firstHitOrder})` : 'OFF'}`;
        }).join(' | ')
      : '—';
    const lines = [
      '═══ RAPPORT SESSION COÛTS / TOKENS ═══',
      `Généré: ${new Date().toLocaleString('fr-FR')}`,
      `Événements économiques: ${entries.length}`,
      `Total session (ledger): ${totals.costCents.toFixed(3)}¢`,
      `Somme des lignes: ${linesSum.toFixed(3)}¢`,
      `Écart ledger/somme: ${(totals.costCents - linesSum).toFixed(6)}¢`,
      `Input: ${totals.inputTok.toLocaleString()} tok`,
      `Cache write: ${totals.cacheWrite.toLocaleString()} tok`,
      `Cache read: ${totals.cacheRead.toLocaleString()} tok`,
      `Output: ${totals.outputTok.toLocaleString()} tok`,
      `Raisonnement (inclus dans output): ${totals.reasoningTok.toLocaleString()} tok`,
      '',
      '── Totaux par périmètre ──',
      `${CACHE_AWARE_PRELAUNCH_LABEL}: ${categoryTotals.cache_aware_prelaunch.costCents.toFixed(3)}¢ (${categoryTotals.cache_aware_prelaunch.count} événement(s))`,
      `Pipeline standard: ${categoryTotals.pipeline.costCents.toFixed(3)}¢ (${categoryTotals.pipeline.count} événement(s))`,
      `Warmup identifiable: ${categoryTotals.warmup.costCents.toFixed(3)}¢ (${categoryTotals.warmup.count} événement(s), sous-ensemble pipeline)`,
      `Reruns: ${categoryTotals.rerun.costCents.toFixed(3)}¢ (${categoryTotals.rerun.count} événement(s))`,
      `Iris: ${categoryTotals.iris.costCents.toFixed(3)}¢ (${categoryTotals.iris.count} événement(s))`,
      `Social: ${categoryTotals.social.costCents.toFixed(3)}¢ (${categoryTotals.social.count} événement(s))`,
      `Explorer: ${categoryTotals.explorer.costCents.toFixed(3)}¢ (${categoryTotals.explorer.count} événement(s))`,
      `Autre: ${categoryTotals.other.costCents.toFixed(3)}¢ (${categoryTotals.other.count} événement(s))`,
      `Warmup cache détecté: ${warmupSummaries}`,
      '',
      '── Top 3 des postes les plus coûteux ──',
    ];

    topEntries.forEach((entry, index) => {
      lines.push(
        `${index + 1}. #${entry.order} ${getCostModeShortLabel(entry.prefix)} · ${entry.label}`
        + ` | ${entry.costCents.toFixed(3)}¢`
        + ` | ${getCostEntryTypeLabel(entry)}`
        + ` | ${entry.model}`,
      );
    });

    lines.push('');
    lines.push('── Agrégat par agent ──');

    Object.values(aggregatesByKey)
      .sort((left, right) => left.firstOrder - right.firstOrder)
      .forEach((aggregate) => {
        const lastEntry = aggregate.lastEntry || aggregate;
        const cacheParts = [];
        if (aggregate.cacheWrite > 0) cacheParts.push(`write ${aggregate.cacheWrite.toLocaleString()}`);
        if (aggregate.cacheRead > 0) cacheParts.push(`read ${aggregate.cacheRead.toLocaleString()}`);
        const cacheLabel = cacheParts.length ? ` | ${cacheParts.join(' | ')}` : '';
        const model = lastEntry.model || getCostModelName(aggregate.agentId);

        lines.push(
          `${getCostModeShortLabel(aggregate.prefix)} · ${aggregate.label} | ${model} | x${aggregate.executionCount}`
          + ` | ${aggregate.costCents.toFixed(3)}¢`
          + ` | in ${aggregate.inputTok.toLocaleString()}`
          + ` | out ${aggregate.outputTok.toLocaleString()}`
          + (aggregate.reasoningTok > 0 ? ` | raisonnement ${aggregate.reasoningTok.toLocaleString()}` : '')
          + cacheLabel
          + ` | dernier type ${getCostEntryTypeLabel(lastEntry)}`,
        );
      });

    lines.push('');
    lines.push('── Ledger détaillé ──');

    entries.forEach((entry) => {
      lines.push(
        `#${entry.order} | ${entry.timestamp} | ${getCostModeShortLabel(entry.prefix)} | ${entry.label}`
        + ` | ${getCostEntryTypeLabel(entry)}`
        + ` | ${entry.model}`
        + ` | source ${entry.source}`,
      );
      lines.push(
        `   coût: ${entry.costCents.toFixed(3)}¢`
        + ` (in ${entry.inputCostCents.toFixed(3)}¢ | write ${entry.cacheWriteCostCents.toFixed(3)}¢ | read ${entry.cacheReadCostCents.toFixed(3)}¢ | out ${entry.outputCostCents.toFixed(3)}¢)`,
      );
      lines.push(
        `   tok : input ${entry.inputTok.toLocaleString()} | cache write ${entry.cacheWrite.toLocaleString()} | cache read ${entry.cacheRead.toLocaleString()} | output ${entry.outputTok.toLocaleString()} | raisonnement ${entry.reasoningTok.toLocaleString()} (inclus dans output) | total ${entry.totalTokens.toLocaleString()}`,
      );
      lines.push(
        `   cache: ${entry.cacheStatus || '—'} | warmup: ${entry.isWarmupEvent ? 'oui' : 'non'} | contexte: ${entry.mode} / ${entry.prefix}`,
      );
    });

    navigator.clipboard.writeText(lines.join('\n'));
    global.showToast('Rapport coûts/tokens copié');
  }

  global.PipelineUICostRuntime = {
    showAgentCost,
    copyTokenReport,
  };

  global.PipelineUI.runtimeCost = global.PipelineUI.runtimeCost || {};
  Object.assign(global.PipelineUI.runtimeCost, global.PipelineUICostRuntime);
  Object.assign(global, global.PipelineUICostRuntime);
})(window);
