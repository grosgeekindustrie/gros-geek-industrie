'use strict';

(function initPipelineUIOpenAIRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};
  const OPENAI_PROMPT_CACHE_TTL_MS = 30 * 60 * 1000;
  const OPENAI_PROMPT_CACHE_ZONE_GRISE_MS = 5 * 60 * 1000;
  const MAX_OUTPUT_TOKENS = Object.freeze({
    pinterest: 8000, instagram: 5000,
    traduction_listing_en: 10000, traduction_listing_de: 10000,
    traduction_listing_es: 10000, traduction_listing_it: 12000,
    traduction_listing_nl: 12000, traduction_listing_pt: 12000,
  });

  const getMaxOutputTokens = (agentId = '') => Number(MAX_OUTPUT_TOKENS[String(agentId).trim()]) || 8000;
  const getRetryDelayMs = (attempt) => Math.min(30000, 2000 * (2 ** Math.max(attempt - 1, 0))) + Math.floor(Math.random() * 800);
  const isRetryableStatus = (status) => [408, 409, 429, 500, 502, 503, 504].includes(Number(status));
  const getImageDetail = (image, index) => {
    const quality = String(image?.aiAnalysisQuality || 'auto');
    const effective = quality === 'auto' ? (index === 0 ? 'high' : 'economy') : quality;
    return effective === 'high' ? 'high' : 'low';
  };
  const getImageDataUrl = (image) => {
    const base64 = String(image?.base64 || '').trim();
    return base64 ? `data:${String(image?.mediaType || 'image/png')};base64,${base64}` : '';
  };
  const normalizePromptDataForOpenAI = (agentId, promptData) => ({
    promptText: String(promptData?.filled || ''),
    fixedContent: String(promptData?.fixedContent || ''),
    fixedContentBlocks: Array.isArray(promptData?.fixedContentBlocks) ? promptData.fixedContentBlocks : [],
    promptDebug: promptData?.promptDebug || null,
    runtimeAgentId: String(promptData?.runtimeAgentId || '').trim() || agentId,
    workspacePrefix: String(promptData?.workspacePrefix || '').trim(),
    aiExecution: promptData?.aiExecution && typeof promptData.aiExecution === 'object' ? { ...promptData.aiExecution } : null,
  });

  const normalizeFixedBlocks = (fixedContent, fixedContentBlocks) => {
    const runtime = global.PipelineUIAnthropicRuntime;
    const explicit = runtime?.normalizeClaudeFixedContentBlocks?.(fixedContentBlocks) || [];
    if (explicit.length) return explicit;
    const text = String(fixedContent || '').trim();
    if (!text) return [];
    const chars = text.length;
    const cacheable = chars >= Number(global.CACHEABLE_BLOCK_MIN_CHARS || 4096);
    return [{ key: 'fixed_content', text, chars, prefixChars: chars, cacheable, cacheApplied: cacheable, cacheGroup: 'fixed_content', cacheLabel: 'fixed_content' }];
  };

  const buildInputContent = ({ promptText, fixedBlocks, images }) => {
    const content = [];
    let breakpointCount = 0;
    fixedBlocks.forEach((block) => {
      const inputBlock = { type: 'input_text', text: block.text };
      if (block.cacheApplied && breakpointCount < 4) {
        inputBlock.prompt_cache_breakpoint = { mode: 'explicit' };
        breakpointCount += 1;
      }
      content.push(inputBlock);
    });
    images.forEach((image, index) => {
      const imageUrl = getImageDataUrl(image);
      if (imageUrl) content.push({ type: 'input_image', image_url: imageUrl, detail: getImageDetail(image, index) });
    });
    content.push({ type: 'input_text', text: String(promptText || '') });
    return { content, breakpointCount };
  };

  const buildPromptCacheKey = (prefix, execution) => {
    const safe = (value) => String(value || '').replace(/[^a-zA-Z0-9._:-]+/g, '-').slice(0, 80);
    return `ggi:${safe(prefix)}:${safe(execution?.profileId)}:${safe(execution?.model)}`;
  };

  const buildResponsesPayload = ({ agentId, promptData, useImages }) => {
    const normalized = normalizePromptDataForOpenAI(agentId, promptData);
    const prefix = normalized.workspacePrefix || global.pfx();
    const execution = normalized.aiExecution || {};
    const images = useImages && Array.isArray(global.state?.images?.[prefix]) ? global.state.images[prefix] : [];
    const fixedBlocks = normalizeFixedBlocks(normalized.fixedContent, normalized.fixedContentBlocks);
    const { content, breakpointCount } = buildInputContent({ promptText: normalized.promptText, fixedBlocks, images });
    const payload = {
      model: execution.model || global.PipelineUIAIProfiles?.DEFAULT_OPENAI_MODEL || 'gpt-5.6-sol',
      input: [{ role: 'user', content }],
      reasoning: { effort: execution.reasoningEffort || 'medium' },
      text: { verbosity: 'medium' },
      max_output_tokens: getMaxOutputTokens(agentId),
      store: false,
    };
    if (breakpointCount > 0) {
      payload.prompt_cache_key = buildPromptCacheKey(prefix, execution);
      payload.prompt_cache_options = { mode: 'explicit', ttl: '30m' };
    }
    const filesApiDebug = global.createFilesApiDebug?.({ enabled: false }) || { enabled: false };
    const promptDebug = global.PipelineUIAnthropicRuntime?.buildClaudeRuntimePromptDebug?.(
      normalized.promptDebug, fixedBlocks, filesApiDebug, normalized.promptText,
    ) || normalized.promptDebug;
    return { payload, prefix, runtimeAgentId: normalized.runtimeAgentId, execution, promptDebug, imageCount: images.length };
  };

  const extractResponseText = (data = {}) => {
    if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
    return (Array.isArray(data.output) ? data.output : [])
      .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
      .filter((item) => item?.type === 'output_text' || typeof item?.text === 'string')
      .map((item) => String(item.text || ''))
      .filter(Boolean)
      .join('\n');
  };

  const normalizeOpenAIUsage = (usage = {}, execution = null) => {
    const rawInput = Math.max(0, Number(usage.input_tokens) || 0);
    const details = usage.input_tokens_details || {};
    const cached = Math.max(0, Number(details.cached_tokens) || 0);
    const cacheWrite = Math.max(0, Number(details.cache_write_tokens) || 0);
    const ordinaryInput = Math.max(0, rawInput - cached - cacheWrite);
    const reasoningTokens = Math.max(0, Number(usage.output_tokens_details?.reasoning_tokens) || 0);
    return {
      input_tokens: ordinaryInput,
      raw_input_tokens: rawInput,
      output_tokens: Math.max(0, Number(usage.output_tokens) || 0),
      reasoning_tokens: reasoningTokens,
      cache_read_input_tokens: cached,
      cache_creation_input_tokens: cacheWrite,
      total_tokens: Math.max(0, Number(usage.total_tokens) || rawInput + (Number(usage.output_tokens) || 0)),
      ...(execution ? { ai_execution: { ...execution } } : {}),
    };
  };

  const getErrorMessage = (data, status) => data?.error?.message || data?.message || `OpenAI HTTP ${status}`;
  const updateRetryMessage = (prefix, agentId, attempt, retries, delayMs) => {
    const out = document.getElementById(`${prefix}-out-${agentId}`) || document.getElementById(`out-${agentId}`);
    if (out) out.textContent = `⏳ OpenAI temporairement indisponible · tentative ${Math.min(attempt + 1, retries)}/${retries} dans ${(delayMs / 1000).toFixed(1)}s...`;
  };

  async function callOpenAI(agentId, promptData, useImages, retries = 3) {
    const controller = new AbortController();
    const request = buildResponsesPayload({ agentId, promptData, useImages });
    global.abortControllers[agentId] = controller;
    try {
      for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
          const response = await fetch('/openai/responses', {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.payload),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            const error = new Error(getErrorMessage(data, response.status));
            error.status = response.status;
            throw error;
          }
          if (data.status === 'incomplete') throw new Error(`Réponse GPT incomplète (${data.incomplete_details?.reason || 'raison inconnue'})`);
          const text = extractResponseText(data);
          if (!text.trim()) throw new Error('OpenAI a retourné une réponse sans texte exploitable');
          const usage = normalizeOpenAIUsage(data.usage, request.execution);
          global.recordCacheDebugEvent?.(request.prefix, request.runtimeAgentId, usage, request.promptDebug);
          return { text, usage, responseId: String(data.id || '') };
        } catch (error) {
          if (error.name === 'AbortError') throw new Error('Génération stoppée');
          const canRetry = attempt < retries && (isRetryableStatus(error.status) || /timeout|network|fetch/i.test(error.message));
          if (!canRetry) throw error;
          const delayMs = getRetryDelayMs(attempt);
          updateRetryMessage(request.prefix, agentId, attempt, retries, delayMs);
          global.handleClaudeRetryEvent?.({ prefix: request.prefix, agentId, attempt, retries, delayMs, provider: 'openai' });
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      throw new Error('OpenAI indisponible après plusieurs tentatives');
    } finally {
      delete global.abortControllers[agentId];
    }
  }

  global.PipelineUIOpenAIRuntime = Object.freeze({
    OPENAI_PROMPT_CACHE_TTL_MS, OPENAI_PROMPT_CACHE_ZONE_GRISE_MS,
    getMaxOutputTokens, getImageDetail, normalizePromptDataForOpenAI,
    normalizeFixedBlocks, buildInputContent, buildPromptCacheKey,
    buildResponsesPayload, extractResponseText, normalizeOpenAIUsage, callOpenAI,
  });
  global.PipelineUI.runtimeOpenAI = global.PipelineUIOpenAIRuntime;
  global.callOpenAI = callOpenAI;
})(window);
