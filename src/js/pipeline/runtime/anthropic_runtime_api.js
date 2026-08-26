'use strict';

(function initPipelineUIAnthropicRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};
  const sharedConstants = global.PipelineUISharedConstants || {};
  const runtimeFormats = global.PipelineUIRuntimeFormats || {};
  const logger = global.PipelineUILogger?.createLogger?.(sharedConstants.LOG_PREFIXES?.PIPELINE || 'pipeline');
  const PIPELINE_PREFIXES = sharedConstants.PIPELINE_PREFIXES || {
    TABLETOP: 'tt',
    COLLECTION: 'col',
  };

  const CACHEABLE_BLOCK_MIN_CHARS = 4096;
  const ANTHROPIC_PROMPT_CACHING_BETA = 'prompt-caching-2024-07-31';
  const ANTHROPIC_FILES_API_BETA = 'files-api-2025-04-14';
  const IMAGE_AWARE_AGENT_IDS = new Set(['marche', 'description', 'alt']);
  const PROMPT_CACHE_TTL_MS = 5 * 60 * 1000;
  const PROMPT_CACHE_ZONE_GRISE_MS = 2 * 60 * 1000;
  const PROMPT_CACHE_UI_REFRESH_MS = 5 * 1000;
  const CACHE_AWARE_RUNTIME_AGENT_ID = 'cache_aware_prelaunch';
  const CACHE_AWARE_STEP_ID = 'cache_aware';
  const FILES_API_STATUS_CLASSES = Object.freeze([
    'files-api-hit',
    'files-api-upload',
    'files-api-mixed',
    'files-api-error',
  ]);
  const DEFAULT_FILES_API_DEBUG = runtimeFormats.DEFAULT_FILES_API_DEBUG || Object.freeze({
    enabled: false,
    requestedImagesCount: 0,
    usedFilesCount: 0,
    localReuseCount: 0,
    serverCacheHitsCount: 0,
    filesReusedCount: 0,
    uploadCandidatesCount: 0,
    uploadedCount: 0,
    invalidatedCount: 0,
    unresolvedCount: 0,
    workspacePersisted: null,
    workspacePersistError: '',
    promptCacheBreakpointApplied: false,
    promptCacheBreakpointType: 'none',
    status: 'none',
    error: '',
  });
  const CACHE_FRESHNESS_CLASSES = Object.freeze([
    'cache-freshness-hot',
    'cache-freshness-gray',
    'cache-freshness-stale',
  ]);
  const CACHE_FRESHNESS_CLASS_BY_STATE = Object.freeze({
    hot: 'cache-freshness-hot',
    gray: 'cache-freshness-gray',
    stale: 'cache-freshness-stale',
  });
  const PIPELINE_LAUNCH_DEFAULT_SCOPE = 'pipeline complet';
  const PIPELINE_LAUNCH_LABEL = 'Lancer le pipeline complet';
  const DEFAULT_PIPELINE_PREFIXES = Object.freeze([
    PIPELINE_PREFIXES.TABLETOP,
    PIPELINE_PREFIXES.COLLECTION,
  ]);
  const AGENT_MAX_TOKENS = Object.freeze({
    pinterest: 5000,
    instagram: 1600,
    traduction_listing_en: 4000,
    traduction_listing_de: 4000,
    traduction_listing_es: 4000,
    traduction_listing_it: 6000,
    traduction_listing_nl: 6000,
    traduction_listing_pt: 6000,
  });

  function getAnthropicBetaHeader({ useFiles = false } = {}) {
    return useFiles
      ? `${ANTHROPIC_PROMPT_CACHING_BETA},${ANTHROPIC_FILES_API_BETA}`
      : ANTHROPIC_PROMPT_CACHING_BETA;
  }

  function getMaxTokensForAgent(agentId = '') {
    return Number(AGENT_MAX_TOKENS[String(agentId || '').trim()]) || 2000;
  }

  function shouldUseImagesForAgent(agent) {
    const agentId = typeof agent === 'string' ? agent : String(agent?.id || '').trim();
    return Boolean(agent?.usesImages) || IMAGE_AWARE_AGENT_IDS.has(agentId);
  }

  function hasFreshAnthropicImageFile(image) {
    return Boolean(
      image?.anthropicFileId
      && image?.contentHash
      && image?.anthropicContentHash === image?.contentHash
    );
  }

  function shouldInvalidateAnthropicImageFile(image) {
    const hasAnthropicMetadata = Boolean(
      image?.anthropicFileId
      || image?.anthropicContentHash
      || image?.anthropicUploadedAt
    );

    return hasAnthropicMetadata && !hasFreshAnthropicImageFile(image);
  }

  function clearAnthropicImageFileState(image, { keepContentHash = false } = {}) {
    if (!image || typeof image !== 'object') return false;

    let mutated = false;

    if (!keepContentHash && image.contentHash) {
      image.contentHash = '';
      mutated = true;
    }

    ['anthropicFileId', 'anthropicContentHash', 'anthropicUploadedAt'].forEach((key) => {
      if (image[key]) {
        image[key] = '';
        mutated = true;
      }
    });

    return mutated;
  }

  function getFreshAnthropicImageFiles(images = []) {
    return images.filter((image) => hasFreshAnthropicImageFile(image));
  }

  function createFilesApiDebug(overrides = {}) {
    return runtimeFormats.createFilesApiDebug
      ? runtimeFormats.createFilesApiDebug(overrides)
      : {
        ...DEFAULT_FILES_API_DEBUG,
        ...overrides,
      };
  }

  function buildFilesApiResult({ images = [], debug = {}, error = '' } = {}) {
    const result = {
      images,
      debug: createFilesApiDebug(debug),
    };

    if (error) result.error = error;
    return result;
  }

  function getAnthropicImageEntryId(image, index) {
    return String(image?.id || `image-${index + 1}`);
  }

  function getPromptTextCharCount(promptText = '') {
    return String(promptText || '').length;
  }

  function normalizePromptDataForClaude(agentId, promptData) {
    return {
      promptText: String(promptData?.filled || ''),
      fixedContent: String(promptData?.fixedContent || ''),
      fixedContentBlocks: Array.isArray(promptData?.fixedContentBlocks) ? promptData.fixedContentBlocks : [],
      promptDebug: promptData?.promptDebug || null,
      runtimeAgentId: String(promptData?.runtimeAgentId || '').trim() || agentId,
      overrideModel: String(promptData?.overrideModel || '').trim(),
      workspacePrefix: String(promptData?.workspacePrefix || '').trim(),
    };
  }

  function normalizeClaudeFixedContentBlocks(fixedContentBlocks = []) {
    let fixedPrefixChars = 0;

    return fixedContentBlocks
      .map((block, index) => {
        const text = String(block?.text || '').trim();
        if (!text) return null;

        const chars = text.length;
        fixedPrefixChars += chars;
        const cacheable = Boolean(block?.cacheable);

        return {
          key: block?.key || `block_${index + 1}`,
          text,
          chars,
          prefixChars: fixedPrefixChars,
          cacheable,
          cacheApplied: cacheable && fixedPrefixChars >= CACHEABLE_BLOCK_MIN_CHARS,
          cacheGroup: String(block?.cacheGroup || ''),
          cacheLabel: String(block?.cacheLabel || ''),
        };
      })
      .filter(Boolean);
  }

  function applyImagePromptCacheBreakpoint(imageContentBlocks = [], normalizedFixedBlocks = [], filesApiDebug = {}) {
    const appliedBreakpointCount = normalizedFixedBlocks.filter((block) => block.cacheApplied).length;
    const canApplyImageBreakpoint = imageContentBlocks.length > 0
      && appliedBreakpointCount < 4
      && normalizedFixedBlocks.some((block) => block.cacheApplied);

    return {
      imageContentBlocks: imageContentBlocks.map((block, index) => {
        if (!canApplyImageBreakpoint || index !== imageContentBlocks.length - 1) return block;
        return {
          ...block,
          cache_control: { type: 'ephemeral' },
        };
      }),
      filesApiDebug: createFilesApiDebug({
        ...filesApiDebug,
        promptCacheBreakpointApplied: canApplyImageBreakpoint,
        promptCacheBreakpointType: canApplyImageBreakpoint ? 'last_image' : 'none',
      }),
    };
  }

  function buildClaudeRuntimePromptDebug(promptDebug, normalizedFixedBlocks, filesApiDebug, promptText = '') {
    return {
      ...(promptDebug || {}),
      promptText: String(promptText || promptDebug?.promptText || ''),
      promptChars: Number(promptDebug?.promptChars) || getPromptTextCharCount(promptText),
      fixedBlocks: normalizedFixedBlocks.map((block, index) => ({
        index,
        key: block.key,
        text: block.text,
        cacheable: block.cacheable,
        cacheApplied: block.cacheApplied,
        cacheGroup: block.cacheGroup,
        cacheLabel: block.cacheLabel,
        chars: block.chars,
        prefixChars: block.prefixChars,
      })),
      filesApiDebug: createFilesApiDebug(filesApiDebug),
    };
  }

  function buildClaudeMessageContent(promptText, fixedContent, normalizedFixedBlocks, imageContentBlocks = []) {
    const content = [];

    if (normalizedFixedBlocks.length > 0) {
      normalizedFixedBlocks.forEach((block) => {
        const contentBlock = { type: 'text', text: block.text };
        if (block.cacheApplied) contentBlock.cache_control = { type: 'ephemeral' };
        content.push(contentBlock);
      });
      content.push(...imageContentBlocks);
      content.push({ type: 'text', text: promptText });
      return content;
    }

    if (fixedContent && fixedContent.length >= CACHEABLE_BLOCK_MIN_CHARS) {
      content.push({ type: 'text', text: fixedContent, cache_control: { type: 'ephemeral' } });
      content.push(...imageContentBlocks);
      content.push({ type: 'text', text: promptText });
      return content;
    }

    content.push(...imageContentBlocks);
    content.push({ type: 'text', text: promptText });
    return content;
  }

  function getClaudeRetryDelayMs(attempt) {
    const baseDelay = Math.min(30000, 3000 * (2 ** Math.max(attempt - 1, 0)));
    const jitter = Math.floor(Math.random() * 1200);
    return baseDelay + jitter;
  }

  function getClaudeRetryOutputElement(prefix, agentId) {
    return document.getElementById(`${prefix}-out-${agentId}`) || document.getElementById(`out-${agentId}`);
  }

  function updateClaudeRetryMessage(prefix, agentId, attempt, retries, delayMs) {
    const out = getClaudeRetryOutputElement(prefix, agentId);
    if (!out) return;

    const nextAttempt = Math.min(attempt + 1, retries);
    out.textContent = `⏳ Anthropic surchargé · nouvelle tentative ${nextAttempt}/${retries} dans ${(delayMs / 1000).toFixed(1)}s...`;
  }

  function isRetryableClaudeOverloadError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('529')
      || message.includes('overload')
      || message.includes('surcharg')
      || message.includes('500')
      || message.includes('internal server error')
      || message.includes('api_error')
      || message.includes('timeout')
    );
  }

  function buildAnthropicUploadImagePayload(image, index) {
    const imageId = getAnthropicImageEntryId(image, index);
    return {
      imageId,
      name: String(image?.name || imageId),
      mediaType: String(image?.mediaType || 'image/png'),
      base64: String(image?.base64 || ''),
      contentHash: String(image?.contentHash || ''),
    };
  }

  async function persistAnthropicWorkspaceImages(prefix, images, warningContext) {
    try {
      const normalized = await global.PipelineUIIndexedDb?.saveWorkspaceImages?.(prefix, images);
      if (Array.isArray(normalized) && normalized.length) {
        global.state.images[prefix] = normalized;
      }

      return {
        images: Array.isArray(global.state?.images?.[prefix]) ? global.state.images[prefix] : images,
        workspacePersisted: true,
        workspacePersistError: '',
      };
    } catch (error) {
      logger?.warn?.(`${warningContext} failed for ${prefix}`, error);
      return {
        images: Array.isArray(global.state?.images?.[prefix]) ? global.state.images[prefix] : images,
        workspacePersisted: false,
        workspacePersistError: error?.message || 'Persistance workspace impossible',
      };
    }
  }

  function resolveFilesApiStatus(debug = {}) {
    const usedFilesCount = Number(debug.usedFilesCount) || 0;
    const uploadedCount = Number(debug.uploadedCount) || 0;
    const filesReusedCount = Number(debug.filesReusedCount) || 0;
    const hasError = Boolean(debug.error);

    if (hasError) return 'error';
    if (!usedFilesCount) return 'none';
    if (uploadedCount > 0 && filesReusedCount > 0) return 'mixed';
    if (uploadedCount > 0) return 'upload';
    if (filesReusedCount > 0) return 'hit';
    return 'none';
  }

  function formatFilesApiStatusLabel(status = 'none') {
    switch (status) {
      case 'hit':
        return 'reuse';
      case 'upload':
        return 'upload';
      case 'mixed':
        return 'mixed';
      case 'error':
        return 'erreur';
      default:
        return 'none';
    }
  }

  function getAgentFilesApiElements(prefix, agentId) {
    return {
      badge: document.getElementById(`${prefix}-bimg-${agentId}`),
      card: document.getElementById(`${prefix}-card-${agentId}`),
    };
  }

  function clearAgentFilesApiVisualState(prefix, agentId) {
    const { badge, card } = getAgentFilesApiElements(prefix, agentId);
    if (badge) {
      badge.classList.remove(...FILES_API_STATUS_CLASSES);
      badge.title = 'Images activées · en attente';
    }
    if (card) card.classList.remove(...FILES_API_STATUS_CLASSES);
  }

  function applyAgentFilesApiVisualState(prefix, agentId, filesApiDebug = {}) {
    const { badge, card } = getAgentFilesApiElements(prefix, agentId);
    if (!badge && !card) return;

    clearAgentFilesApiVisualState(prefix, agentId);
    const status = resolveFilesApiStatus(filesApiDebug);
    if (status === 'none') return;

    const statusClass = `files-api-${status}`;
    const requestedImagesCount = Number(filesApiDebug.requestedImagesCount) || 0;
    const usedFilesCount = Number(filesApiDebug.usedFilesCount) || 0;
    const localReuseCount = Number(filesApiDebug.localReuseCount) || 0;
    const serverCacheHitsCount = Number(filesApiDebug.serverCacheHitsCount) || 0;
    const uploadedCount = Number(filesApiDebug.uploadedCount) || 0;
    const invalidatedCount = Number(filesApiDebug.invalidatedCount) || 0;
    const unresolvedCount = Number(filesApiDebug.unresolvedCount) || 0;
    const workspacePersisted = filesApiDebug.workspacePersisted;
    const parts = [
      `Files API: ${formatFilesApiStatusLabel(status)}`,
      `${requestedImagesCount} image(s) demandée(s)`,
      `${usedFilesCount} file(s) utilisé(s)`,
    ];

    if (localReuseCount > 0) parts.push(`${localReuseCount} relu(s) localement`);
    if (serverCacheHitsCount > 0) parts.push(`${serverCacheHitsCount} relu(s) via cache serveur`);
    if (uploadedCount > 0) parts.push(`${uploadedCount} upload réel(s)`);
    if (invalidatedCount > 0) parts.push(`${invalidatedCount} invalidation(s)`);
    if (unresolvedCount > 0) parts.push(`${unresolvedCount} image(s) non résolue(s)`);
    if (workspacePersisted === true) parts.push('workspace sauvé');
    if (workspacePersisted === false) parts.push('workspace NON sauvé');
    if (filesApiDebug.workspacePersistError) parts.push(`Persist: ${filesApiDebug.workspacePersistError}`);
    if (filesApiDebug.error) parts.push(`Erreur: ${filesApiDebug.error}`);

    if (badge) {
      badge.classList.add(statusClass);
      badge.title = parts.join(' · ');
    }
    if (card) card.classList.add(statusClass);
  }

  async function ensureAnthropicImageFiles(prefix) {
    const images = Array.isArray(global.state?.images?.[prefix]) ? global.state.images[prefix] : [];
    const requestedImages = images.filter((image) => image?.base64);
    if (!requestedImages.length) return buildFilesApiResult();

    const readyImagesBefore = getFreshAnthropicImageFiles(requestedImages);
    const uploadCandidates = requestedImages
      .map((image, index) => ({ image, index }))
      .filter(({ image }) => !readyImagesBefore.includes(image));
    const invalidatedImages = uploadCandidates
      .map(({ image }) => image)
      .filter((image) => shouldInvalidateAnthropicImageFile(image));
    const invalidatedCount = invalidatedImages.length;
    let workspacePersisted = null;
    let workspacePersistError = '';
    let runtimeImages = images;

    if (invalidatedImages.length) {
      invalidatedImages.forEach((image) => {
        clearAnthropicImageFileState(image, { keepContentHash: Boolean(image?.contentHash) });
      });

      const persistedState = await persistAnthropicWorkspaceImages(prefix, images, 'Persist invalidated Anthropic files');
      runtimeImages = persistedState.images;
      workspacePersisted = persistedState.workspacePersisted;
      workspacePersistError = persistedState.workspacePersistError;
    }

    if (!uploadCandidates.length) {
      return buildFilesApiResult({
        images: readyImagesBefore,
        debug: {
          enabled: true,
          requestedImagesCount: requestedImages.length,
          usedFilesCount: readyImagesBefore.length,
          localReuseCount: readyImagesBefore.length,
          serverCacheHitsCount: 0,
          filesReusedCount: readyImagesBefore.length,
          uploadCandidatesCount: 0,
          uploadedCount: 0,
          invalidatedCount,
          unresolvedCount: 0,
          workspacePersisted,
          workspacePersistError,
          status: resolveFilesApiStatus({
            usedFilesCount: readyImagesBefore.length,
            filesReusedCount: readyImagesBefore.length,
          }),
        },
      });
    }

    const response = await fetch('/anthropic/files/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: uploadCandidates.map(({ image, index }) => buildAnthropicUploadImagePayload(image, index)),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const error = data.error || `HTTP ${response.status}`;
      return buildFilesApiResult({
        images: readyImagesBefore,
        debug: {
          enabled: true,
          requestedImagesCount: requestedImages.length,
          usedFilesCount: readyImagesBefore.length,
          localReuseCount: readyImagesBefore.length,
          serverCacheHitsCount: 0,
          filesReusedCount: readyImagesBefore.length,
          uploadCandidatesCount: uploadCandidates.length,
          uploadedCount: 0,
          invalidatedCount,
          unresolvedCount: uploadCandidates.length,
          workspacePersisted,
          workspacePersistError,
          status: 'error',
          error,
        },
        error,
      });
    }

    const uploadedAt = new Date().toISOString();
    const uploads = Array.isArray(data.images) ? data.images : [];
    const uploadsById = new Map(uploads.map((entry) => [String(entry.imageId || ''), entry]));
    const serverCacheHitsCount = uploads.filter((entry) => Boolean(entry?.cached)).length;
    const uploadedCount = uploads.filter((entry) => !entry?.cached).length;
    const missingUploadIds = uploadCandidates
      .map(({ image, index }) => getAnthropicImageEntryId(image, index))
      .filter((imageId) => !uploadsById.has(imageId));
    const invalidUploadIds = uploads
      .filter((entry) => !entry?.fileId || !entry?.contentHash)
      .map((entry) => String(entry?.imageId || 'image'));
    let hasMutation = false;

    if (missingUploadIds.length || invalidUploadIds.length) {
      const incompleteReasons = [];
      if (missingUploadIds.length) incompleteReasons.push(`${missingUploadIds.length} image(s) absente(s) de la réponse`);
      if (invalidUploadIds.length) incompleteReasons.push(`${invalidUploadIds.length} image(s) sans file_id exploitable`);
      const error = `Réponse upload incomplète: ${incompleteReasons.join(' · ')}`;

      return buildFilesApiResult({
        images: readyImagesBefore,
        debug: {
          enabled: true,
          requestedImagesCount: requestedImages.length,
          usedFilesCount: readyImagesBefore.length,
          localReuseCount: readyImagesBefore.length,
          serverCacheHitsCount: 0,
          filesReusedCount: readyImagesBefore.length,
          uploadCandidatesCount: uploadCandidates.length,
          uploadedCount: 0,
          invalidatedCount,
          unresolvedCount: uploadCandidates.length,
          workspacePersisted,
          workspacePersistError,
          status: 'error',
          error,
        },
        error,
      });
    }

    runtimeImages.forEach((image, index) => {
      const imageId = getAnthropicImageEntryId(image, index);
      const uploaded = uploadsById.get(imageId);
      if (!uploaded) return;

      image.contentHash = String(uploaded.contentHash || image.contentHash || '');
      image.anthropicFileId = String(uploaded.fileId || image.anthropicFileId || '');
      image.anthropicContentHash = String(uploaded.contentHash || image.anthropicContentHash || '');
      image.anthropicUploadedAt = uploadedAt;
      hasMutation = true;
    });

    if (hasMutation) {
      const persistedState = await persistAnthropicWorkspaceImages(prefix, runtimeImages, 'Persist Anthropic files');
      runtimeImages = persistedState.images;
      workspacePersisted = persistedState.workspacePersisted;
      workspacePersistError = persistedState.workspacePersistError;
    }

    const readyImagesAfter = getFreshAnthropicImageFiles(runtimeImages.filter((image) => image?.base64));
    const filesReusedCount = readyImagesBefore.length + serverCacheHitsCount;
    const unresolvedCount = requestedImages.length - readyImagesAfter.length;

    if (unresolvedCount > 0) {
      const error = `Files API incomplète: ${unresolvedCount} image(s) sans file_id exploitable après upload.`;

      return buildFilesApiResult({
        images: readyImagesAfter,
        debug: {
          enabled: true,
          requestedImagesCount: requestedImages.length,
          usedFilesCount: readyImagesAfter.length,
          localReuseCount: readyImagesBefore.length,
          serverCacheHitsCount,
          filesReusedCount,
          uploadCandidatesCount: uploadCandidates.length,
          uploadedCount,
          invalidatedCount,
          unresolvedCount,
          workspacePersisted,
          workspacePersistError,
          status: 'error',
          error,
        },
        error,
      });
    }

    return buildFilesApiResult({
      images: readyImagesAfter,
      debug: {
        enabled: true,
        requestedImagesCount: requestedImages.length,
        usedFilesCount: readyImagesAfter.length,
        localReuseCount: readyImagesBefore.length,
        serverCacheHitsCount,
        filesReusedCount,
        uploadCandidatesCount: uploadCandidates.length,
        uploadedCount,
        invalidatedCount,
        unresolvedCount,
        workspacePersisted,
        workspacePersistError,
        status: resolveFilesApiStatus({
          usedFilesCount: readyImagesAfter.length,
          uploadedCount,
          filesReusedCount,
        }),
      },
    });
  }

  async function buildRequestImageBlocks(prefix) {
    const result = await ensureAnthropicImageFiles(prefix);
    const images = Array.isArray(result?.images) ? result.images : [];
    const debug = createFilesApiDebug(result?.debug);

    if (result?.error) throw new Error(result.error);

    return {
      blocks: images.map((image) => ({
        type: 'image',
        source: {
          type: 'file',
          file_id: image.anthropicFileId,
        },
      })),
      debug,
    };
  }

  async function callClaude(agentId, promptData, useImages, retries = 3) {
    const controller = new AbortController();
    const normalizedPromptData = normalizePromptDataForClaude(agentId, promptData);
    const {
      promptText,
      fixedContent,
      fixedContentBlocks,
      promptDebug,
      runtimeAgentId,
      overrideModel,
      workspacePrefix,
    } = normalizedPromptData;
    const prefix = workspacePrefix || global.pfx();

    global.abortControllers[agentId] = controller;

    const hasRequestedImages = Boolean(useImages && global.state.images[prefix].length > 0);
    let imageContentBlocks = [];
    let filesApiDebug = createFilesApiDebug({
      enabled: hasRequestedImages,
      requestedImagesCount: hasRequestedImages ? global.state.images[prefix].length : 0,
    });

    if (hasRequestedImages) {
      const imageRequest = await buildRequestImageBlocks(prefix);
      imageContentBlocks = imageRequest.blocks;
      filesApiDebug = imageRequest.debug || filesApiDebug;
    }

    const normalizedFixedBlocks = normalizeClaudeFixedContentBlocks(fixedContentBlocks);
    const imageBreakpointState = applyImagePromptCacheBreakpoint(
      imageContentBlocks,
      normalizedFixedBlocks,
      filesApiDebug,
    );
    imageContentBlocks = imageBreakpointState.imageContentBlocks;
    filesApiDebug = imageBreakpointState.filesApiDebug;

    const runtimePromptDebug = buildClaudeRuntimePromptDebug(promptDebug, normalizedFixedBlocks, filesApiDebug, promptText);
    const content = buildClaudeMessageContent(promptText, fixedContent, normalizedFixedBlocks, imageContentBlocks);

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch('/anthropic/messages', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: overrideModel || global.getActiveAgentModel?.(agentId) || global.AGENT_MODELS[agentId] || 'claude-sonnet-4-5',
            max_tokens: getMaxTokensForAgent(agentId),
            messages: [{ role: 'user', content }],
            useFilesBeta: imageContentBlocks.length > 0,
          }),
        });

        if (response.status === 529) throw new Error('HTTP 529 overload');
        if (response.status === 500) throw new Error('HTTP 500 internal server error');

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const usage = data.usage || {};
        global.recordCacheDebugEvent(prefix, runtimeAgentId, usage, runtimePromptDebug);
        if (filesApiDebug.enabled) {
          applyAgentFilesApiVisualState(prefix, runtimeAgentId, filesApiDebug);
        }
        delete global.abortControllers[agentId];
        return {
          text: data.content.map((block) => block.text || '').join('\n'),
          usage,
        };
      } catch (error) {
        if (error.name === 'AbortError') {
          delete global.abortControllers[agentId];
          throw new Error('Génération stoppée');
        }

        const canRetry = attempt < retries && isRetryableClaudeOverloadError(error);
        if (!canRetry) {
          if (filesApiDebug.enabled) {
            applyAgentFilesApiVisualState(prefix, runtimeAgentId, {
              ...filesApiDebug,
              status: 'error',
              error: error.message,
            });
          }
          delete global.abortControllers[agentId];
          if (isRetryableClaudeOverloadError(error)) {
            throw new Error('Serveurs Anthropic surchargés après plusieurs tentatives. Réessaie dans quelques minutes.');
          }
          throw error;
        }

        const delayMs = getClaudeRetryDelayMs(attempt);
        updateClaudeRetryMessage(prefix, agentId, attempt, retries, delayMs);
        global.handleClaudeRetryEvent?.({
          prefix,
          agentId,
          attempt,
          retries,
          delayMs,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    delete global.abortControllers[agentId];
    throw new Error('Serveurs Anthropic surchargés après plusieurs tentatives. Réessaie dans quelques minutes.');
  }

  Object.assign(global, {
    CACHEABLE_BLOCK_MIN_CHARS,
    ANTHROPIC_PROMPT_CACHING_BETA,
    ANTHROPIC_FILES_API_BETA,
    IMAGE_AWARE_AGENT_IDS,
    PROMPT_CACHE_TTL_MS,
    PROMPT_CACHE_ZONE_GRISE_MS,
    PROMPT_CACHE_UI_REFRESH_MS,
    CACHE_AWARE_RUNTIME_AGENT_ID,
    CACHE_AWARE_STEP_ID,
    FILES_API_STATUS_CLASSES,
    DEFAULT_FILES_API_DEBUG,
    CACHE_FRESHNESS_CLASSES,
    CACHE_FRESHNESS_CLASS_BY_STATE,
    PIPELINE_LAUNCH_DEFAULT_SCOPE,
    PIPELINE_LAUNCH_LABEL,
    DEFAULT_PIPELINE_PREFIXES,
  });

  global.PipelineUIAnthropicRuntime = {
    getAnthropicBetaHeader,
    shouldUseImagesForAgent,
    hasFreshAnthropicImageFile,
    shouldInvalidateAnthropicImageFile,
    clearAnthropicImageFileState,
    getFreshAnthropicImageFiles,
    createFilesApiDebug,
    buildFilesApiResult,
    getAnthropicImageEntryId,
    getPromptTextCharCount,
    normalizePromptDataForClaude,
    normalizeClaudeFixedContentBlocks,
    applyImagePromptCacheBreakpoint,
    buildClaudeRuntimePromptDebug,
    buildClaudeMessageContent,
    getClaudeRetryDelayMs,
    getClaudeRetryOutputElement,
    updateClaudeRetryMessage,
    isRetryableClaudeOverloadError,
    buildAnthropicUploadImagePayload,
    persistAnthropicWorkspaceImages,
    resolveFilesApiStatus,
    formatFilesApiStatusLabel,
    getAgentFilesApiElements,
    clearAgentFilesApiVisualState,
    applyAgentFilesApiVisualState,
    ensureAnthropicImageFiles,
    buildRequestImageBlocks,
    callClaude,
  };

  global.PipelineUI.runtimeAnthropic = global.PipelineUI.runtimeAnthropic || {};
  Object.assign(global.PipelineUI.runtimeAnthropic, global.PipelineUIAnthropicRuntime);
  Object.assign(global, global.PipelineUIAnthropicRuntime);
})(window);
