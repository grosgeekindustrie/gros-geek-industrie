// ═══ PIPELINE API ═══

// Appel HTTP Anthropic.
// Fonction sensible : gère aussi les retries, le prompt caching, les images et les
// AbortController. Toute extraction future doit préserver exactement ce contrat réseau.


// Runtime réseau + orchestration pipeline.
// État actuel : ce fichier ne contient pas seulement les appels API. Il regroupe encore
// l'appel Anthropic, l'exécution des agents, une partie du runtime
// pipeline, les agents sociaux, les helpers de copie et le monitoring des coûts.
// Découpage visé : extraire progressivement les blocs les moins risqués (social / copy /
// reporting) vers des modules UI dédiés, puis traiter le coeur pipeline en dernier.
// Important : ne pas lancer de refactor brutal ici sans campagne de retest complète.

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
const DEFAULT_FILES_API_DEBUG = Object.freeze({
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
const DEFAULT_PIPELINE_PREFIXES = Object.freeze(['tt', 'col']);

function getAnthropicBetaHeader({ useFiles = false } = {}) {
  return useFiles
    ? `${ANTHROPIC_PROMPT_CACHING_BETA},${ANTHROPIC_FILES_API_BETA}`
    : ANTHROPIC_PROMPT_CACHING_BETA;
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
  return {
    ...DEFAULT_FILES_API_DEBUG,
    ...overrides,
  };
}

function buildFilesApiResult({ images = [], debug = {}, error = '' } = {}) {
  const result = {
    images,
    debug: createFilesApiDebug(debug),
  };

  if (error) {
    result.error = error;
  }

  return result;
}

function getAnthropicImageEntryId(image, index) {
  return String(image?.id || `image-${index + 1}`);
}

function getPromptTextCharCount(promptText = '') {
  return String(promptText || '').length;
}

function normalizePromptDataForClaude(agentId, promptData) {
  const isLegacy = typeof promptData === 'string';
  const normalizedPromptText = isLegacy ? promptData : String(promptData?.filled || '');

  return {
    isLegacy,
    promptText: normalizedPromptText,
    fixedContent: isLegacy ? null : String(promptData?.fixedContent || ''),
    fixedContentBlocks: isLegacy
      ? []
      : (Array.isArray(promptData?.fixedContentBlocks) ? promptData.fixedContentBlocks : []),
    promptDebug: isLegacy ? null : (promptData?.promptDebug || null),
    runtimeAgentId: isLegacy ? agentId : (String(promptData?.runtimeAgentId || '').trim() || agentId),
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
      if (block.cacheApplied) {
        contentBlock.cache_control = { type: 'ephemeral' };
      }
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
  return message.includes('529') || message.includes('overload') || message.includes('surcharg');
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
    const normalized = await window.PipelineUIIndexedDb?.saveWorkspaceImages?.(prefix, images);
    if (Array.isArray(normalized) && normalized.length) {
      state.images[prefix] = normalized;
    }

    return {
      images: Array.isArray(state?.images?.[prefix]) ? state.images[prefix] : images,
      workspacePersisted: true,
      workspacePersistError: '',
    };
  } catch (error) {
    console.warn(`${warningContext} failed for ${prefix}`, error);
    return {
      images: Array.isArray(state?.images?.[prefix]) ? state.images[prefix] : images,
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
  const states = FILES_API_STATUS_CLASSES;

  if (badge) {
    badge.classList.remove(...states);
    badge.title = 'Images activées · en attente';
  }

  if (card) {
    card.classList.remove(...states);
  }
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

  if (card) {
    card.classList.add(statusClass);
  }
}

async function ensureAnthropicImageFiles(prefix, apiKey) {
  const images = Array.isArray(state?.images?.[prefix]) ? state.images[prefix] : [];
  const requestedImages = images.filter((image) => image?.base64);
  if (!requestedImages.length) {
    return buildFilesApiResult();
  }

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
      apiKey,
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

async function buildRequestImageBlocks(prefix, apiKey) {
  const result = await ensureAnthropicImageFiles(prefix, apiKey);
  const images = Array.isArray(result?.images) ? result.images : [];
  const debug = createFilesApiDebug(result?.debug);

  if (result?.error) {
    throw new Error(result.error);
  }

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
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) throw new Error('Clé API manquante');

  const controller = new AbortController();
  const normalizedPromptData = normalizePromptDataForClaude(agentId, promptData);
  const {
    isLegacy,
    promptText,
    fixedContent,
    fixedContentBlocks,
    promptDebug,
    runtimeAgentId,
  } = normalizedPromptData;
  const prefix = pfx();
  const updateRetryMessage = (attempt, delayMs) => {
    const out = document.getElementById(`${prefix}-out-${agentId}`) || document.getElementById(`out-${agentId}`);
    if (!out) return;

    const nextAttempt = Math.min(attempt + 1, retries);
    out.textContent = `⏳ Anthropic surchargé · nouvelle tentative ${nextAttempt}/${retries} dans ${(delayMs / 1000).toFixed(1)}s...`;
  };
  const isRetryableOverloadError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('529') || message.includes('overload') || message.includes('surcharg');
  };

  abortControllers[agentId] = controller;

  const hasRequestedImages = Boolean(useImages && state.images[prefix].length > 0);
  let imageContentBlocks = [];
  let filesApiDebug = createFilesApiDebug({
    enabled: hasRequestedImages,
    requestedImagesCount: hasRequestedImages ? state.images[prefix].length : 0,
  });

  if (hasRequestedImages) {
    const imageRequest = await buildRequestImageBlocks(prefix, apiKey);
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

  const runtimePromptDebug = isLegacy
    ? promptDebug
    : buildClaudeRuntimePromptDebug(promptDebug, normalizedFixedBlocks, filesApiDebug, promptText);
  const content = buildClaudeMessageContent(promptText, fixedContent, normalizedFixedBlocks, imageContentBlocks);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': getAnthropicBetaHeader({ useFiles: imageContentBlocks.length > 0 }),
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: AGENT_MODELS[agentId] || 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content }]
        })
      });

      if (res.status === 529) {
        throw new Error('HTTP 529 overload');
      }

      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const usage = data.usage || {};
      recordCacheDebugEvent(prefix, runtimeAgentId, usage, runtimePromptDebug);
      if (filesApiDebug.enabled) {
        applyAgentFilesApiVisualState(prefix, runtimeAgentId, filesApiDebug);
      }
      delete abortControllers[agentId];
      return { text: data.content.map((block) => block.text || '').join('\n'), usage };
    } catch (err) {
      if (err.name === 'AbortError') {
        delete abortControllers[agentId];
        throw new Error('Génération stoppée');
      }

      const canRetry = attempt < retries && isRetryableClaudeOverloadError(err);
      if (!canRetry) {
        if (filesApiDebug.enabled) {
          applyAgentFilesApiVisualState(prefix, runtimeAgentId, {
            ...filesApiDebug,
            status: 'error',
            error: err.message,
          });
        }
        delete abortControllers[agentId];
        if (isRetryableClaudeOverloadError(err)) {
          throw new Error('Serveurs Anthropic surchargés après plusieurs tentatives. Réessaie dans quelques minutes.');
        }
        throw err;
      }

      const delayMs = getClaudeRetryDelayMs(attempt);
      updateClaudeRetryMessage(prefix, agentId, attempt, retries, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  delete abortControllers[agentId];
  throw new Error('Serveurs Anthropic surchargés après plusieurs tentatives. Réessaie dans quelques minutes.');
}


// ═══════════════════════════════════════════════════════════
// QA secondaire optionnelle.
// Ce bloc reste ici car il est directement branché au runtime d'exécution des agents.

// HELPERS UI PIPELINE
// ═══════════════════════════════════════════════════════════
// Moved to pipeline/runtime/launch_runtime_ui.js.

function getPipelineLaunchMode(prefix) {
  if (typeof getPipelineModeByPrefix === 'function') {
    return getPipelineModeByPrefix(prefix);
  }
  return prefix === 'col' ? 'collection' : 'tabletop';
}

function getSafePipelineAgentsFallback() {
  if (typeof getPipelineAgents === 'function') {
    const agents = getPipelineAgents();
    return Array.isArray(agents) ? agents : [];
  }

  return [];
}

function getPipelineTargetStepsForPrefix(prefix) {
  const mode = getPipelineLaunchMode(prefix);

  if (typeof getPipelineTargetSteps === 'function') {
    return getPipelineTargetSteps(mode);
  }

  return getSafePipelineAgentsFallback().map((agent) => ({
    id: agent.id,
    label: agent.title,
  }));
}

function getPipelineTargetStepMetaForPrefix(prefix, stepId = '') {
  const mode = getPipelineLaunchMode(prefix);

  if (typeof getPipelineTargetStepMeta === 'function') {
    return getPipelineTargetStepMeta(mode, stepId);
  }

  return null;
}

function getPipelineRuntimeAgentIdsForPrefix(prefix, stepId = '') {
  const mode = getPipelineLaunchMode(prefix);
  const resolvedStepId = String(stepId || '').trim();

  if (typeof getPipelineRuntimeAgentIdsForTarget === 'function') {
    return getPipelineRuntimeAgentIdsForTarget(mode, resolvedStepId);
  }

  if (typeof getPipelineRuntimeAgentIds === 'function') {
    return getPipelineRuntimeAgentIds(mode);
  }

  return getSafePipelineAgentsFallback().map((agent) => agent.id);
}

function getPipelineRuntimeAgentsForTarget(prefix, stepId = '') {
  const runtimeAgentIds = getPipelineRuntimeAgentIdsForPrefix(prefix, stepId);
  const availableAgents = getSafePipelineAgentsFallback();
  const agentMap = new Map(availableAgents.map((agent) => [agent.id, agent]));

  return runtimeAgentIds.map((agentId) => agentMap.get(agentId)).filter(Boolean);
}

function getPipelineDisplayStepIdForRuntimeAgent(prefix, runtimeAgentId = '') {
  const targetSteps = getPipelineTargetStepsForPrefix(prefix);
  if (targetSteps.some((step) => step.id === runtimeAgentId)) return runtimeAgentId;

  const altTargetMeta = getPipelineTargetStepMetaForPrefix(prefix, 'alt');
  if (altTargetMeta?.stopAfterAgentId === runtimeAgentId) return altTargetMeta.id;

  return runtimeAgentId;
}

// Launch state, run-state bridge and cache-aware prelaunch moved to
// pipeline/runtime/launch_runtime_ui.js.

// Moved to pipeline/runtime/iris_runtime_ui.js.

// ═══════════════════════════════════════════════════════════
// Cœur d'exécution agent par agent.
// Zone à haut risque : couplage fort entre état, prompts, DOM et cartes UI.
// C'est l'une des dernières parties à découper, pas une cible de nettoyage opportuniste.

// RUN AGENT
// ═══════════════════════════════════════════════════════════
// Moved to pipeline/runtime/agent_runtime_ui.js.


// ═══════════════════════════════════════════════════════════
// Contrôle global du pipeline unitaire.
// Ce bloc orchestre aussi les transitions de vues et les déplacements DOM vers la vue
// pipeline. Toute extraction future devra être testée visuellement sur TT et Collection.

// PIPELINE CONTROL
// ═══════════════════════════════════════════════════════════
// PIPELINE CONTROL
// ???????????????????????????????????????????????????????????????????????????
// Moved to pipeline/runtime/launch_runtime_ui.js and pipeline/runtime/social_runtime_ui.js.

// ═══════════════════════════════════════════════════════════
// OUTPUT FINAL
// ═══════════════════════════════════════════════════════════

// Moved to pipeline/runtime/output_runtime_ui.js.

// ═══════════════════════════════════════════════════════════
// TITRE EXPLORER
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// Monitoring session.
// Affichage UI + cumul de coût runtime. Bloc isolable plus tard, mais déplacé seulement
// quand le coeur pipeline et le reporting auront des contrats plus stables.

// MONITORING COÛTS
// ═══════════════════════════════════════════════════════════
// Moved to pipeline/runtime/cost_runtime_ui.js.

// ═══════════════════════════════════════════════════════════
// PERSISTANCE FORMULAIRE
// ═══════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════
