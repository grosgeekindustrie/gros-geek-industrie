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

async function runIrisSemanticSearch(prefix = 'col') {
  const button = document.getElementById(`runIrisBtn-${prefix}`);
  const output = document.getElementById(`out-iris-${prefix}`);

  if (button) {
    button.disabled = true;
    button.textContent = '⟳ Recherche...';
  }

  if (output) {
    output.classList.remove('empty');
    output.textContent = '';
  }

  try {
    const ctx = buildCtx('iris');
    const prompt = buildPrompt('iris', ctx);
    const rawFixed = prompt.fixedContent ? `── CACHE FIXE ──
${prompt.fixedContent}

── VARIABLE ──
` : '';
    state.inputs.iris = rawFixed + prompt.filled;

    const response = await callClaude('iris', prompt, false);
    state.outputs.iris = response.text;
    showAgentCost('iris', response.usage || null, { prefix, source: 'iris' });
    syncCacheIndicator(response.usage || null);

    if (output) output.textContent = response.text;
    showToast('Recherche sémantique Iris générée ✓');
  } catch (error) {
    if (output) output.textContent = `❌ ${error.message}`;
    showToast(`❌ ${error.message}`, '#ff4757');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '▶ Lancer Iris';
    }
  }
}

async function runCollectionIrisSemanticSearch() {
  return runIrisSemanticSearch('col');
}

async function runTabletopIrisSemanticSearch() {
  return runIrisSemanticSearch('tt');
}

// ═══════════════════════════════════════════════════════════
// Cœur d'exécution agent par agent.
// Zone à haut risque : couplage fort entre état, prompts, DOM et cartes UI.
// C'est l'une des dernières parties à découper, pas une cible de nettoyage opportuniste.

// RUN AGENT
// ═══════════════════════════════════════════════════════════
async function runAgent(agent, correction = '', isRetry = false) {
  const p = pfx();
  const refs = beginAgentExecution(p, agent, { isRetry });

  try {
    const ctx = buildCtx(agent.id, correction);
    let result = '';
    let usage = null;

    const prompt = buildPrompt(agent.id, ctx);
    const rawFixed = prompt.fixedContent ? `── CACHE FIXE ──\n${prompt.fixedContent}\n\n── VARIABLE ──\n` : '';
    state.inputs[agent.id] = rawFixed + prompt.filled;
    const runtimePrompt = withPipelineCacheAwarePromptData(p, prompt, {
      source: isRetry ? 'rerun' : 'pipeline',
    });
    const response = await callClaude(agent.id, runtimePrompt, shouldUseImagesForAgent(agent));
    result = response.text;
    usage = response.usage || null;

    if (agent.selectionType === 'tags') {
      state.outputs.tags_raw = result;
      state.outputs.tags = '';
    } else {
      state.outputs[agent.id] = result;
    }

    if (!agent.hasSelection) {
      appendPipelineRunEntry(p, agent.id, result, { quality: 'brut', validation: 'non_valide', origin: 'auto', sourceAgentId: agent.id });
    }

    finalizeAgentSuccess(p, agent, refs, result, usage, { isRetry });
    return true;
  } catch (err) {
    finalizeAgentError(p, agent, refs, err);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// Contrôle global du pipeline unitaire.
// Ce bloc orchestre aussi les transitions de vues et les déplacements DOM vers la vue
// pipeline. Toute extraction future devra être testée visuellement sur TT et Collection.

// PIPELINE CONTROL
// ═══════════════════════════════════════════════════════════
// PIPELINE CONTROL
// ???????????????????????????????????????????????????????????????????????????
// Moved to pipeline/runtime/launch_runtime_ui.js.
async function runLeoAgent(p) {
  const formats = [];
  if (document.getElementById(`soc-insta-${p}`)?.checked) formats.push('INSTAGRAM/TIKTOK');
  if (document.getElementById(`soc-fb-${p}`)?.checked) formats.push('FACEBOOK');
  if (document.getElementById(`soc-marketplace-${p}`)?.checked) formats.push('FACEBOOK MARKETPLACE');
  if (formats.length === 0) { showToast('Coche au moins un réseau !', '#ff4757'); return; }
  const card = document.getElementById(`card-social-${p}`);
  const stat = document.getElementById(`stat-social-${p}`);
  const out  = document.getElementById(`out-social-${p}`);
  const btn  = document.getElementById(`runLeoBtn-${p}`);
  const stopBtn = document.getElementById(`bstop-social-${p}`);
  if (card) card.className = 'agent-card active';
  if (stat) { stat.className = 'agent-status s-run'; stat.textContent = '⟳ génération...'; }
  if (out)  { out.className = 'output-box'; out.textContent = ''; }
  if (btn)  btn.disabled = true;
  if (stopBtn) stopBtn.style.display = 'inline-flex';
  toggleCard(`social-${p}`);
  const correction = document.getElementById(`cor-social-${p}`)?.value || '';
  const ctx = buildCtx('social');
  ctx.social_formats = formats.join(', ');
  ctx.correction = correction;
  const prompt = buildPrompt('social', ctx);
  state.inputs['social'] = prompt.filled;
  try {
    const { text: result, usage } = await callClaude('social', prompt, false);
    state.outputs['social'] = result;
    if (out) out.textContent = result;
    if (card) card.className = 'agent-card done';
    if (stat) { stat.className = 'agent-status s-done'; stat.textContent = '✓ done'; }
    showAgentCost('social', usage, { prefix: p, source: 'social' });
    syncCacheIndicator(usage);
    displaySocialOutput(result, p);
    showToast('Posts générés ✓');
  } catch (err) {
    if (out) out.textContent = `❌ ${err.message}`;
    if (card) card.className = 'agent-card error';
    if (stat) { stat.className = 'agent-status s-err'; stat.textContent = '✗ erreur'; }
    showToast(`❌ ${err.message}`, '#ff4757');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '▶ Générer'; }
    if (stopBtn) stopBtn.style.display = 'none';
  }
}

async function runCamilleAgent(p) {
  if (!document.getElementById(`soc-pinterest-${p}`)?.checked) {
    showToast(`Active Pinterest pour ${currentMode === 'collection' ? 'Zoe' : 'Camille'} !`, '#ff4757');
    return;
  }
  const card = document.getElementById(`card-camille-${p}`);
  const stat = document.getElementById(`stat-camille-${p}`);
  const out  = document.getElementById(`out-camille-${p}`);
  const btn  = document.getElementById(`runCamilleBtn-${p}`);
  const stopBtn = document.getElementById(`bstop-camille-${p}`);
  if (card) card.className = 'agent-card active';
  if (stat) { stat.className = 'agent-status s-run'; stat.textContent = '⟳ génération...'; }
  if (out)  { out.className = 'output-box'; out.textContent = ''; }
  if (btn)  btn.disabled = true;
  if (stopBtn) stopBtn.style.display = 'inline-flex';
  toggleCard(`camille-${p}`);
  const correction = document.getElementById(`cor-camille-${p}`)?.value || '';
  const ctx = buildCtx('camille');
  ctx.correction = correction;
  const prompt = buildPrompt('camille', ctx);
  state.inputs['camille'] = prompt.filled;
  try {
    const { text: result, usage } = await callClaude('camille', prompt, false);
    state.outputs['camille'] = result;
    if (out) out.textContent = result;
    if (card) card.className = 'agent-card done';
    if (stat) { stat.className = 'agent-status s-done'; stat.textContent = '✓ done'; }
    showAgentCost('camille', usage, { prefix: p, source: 'camille' });
    syncCacheIndicator(usage);
    displayCamilleOutput(result, p);
    showToast('Pinterest généré ✓');
  } catch (err) {
    if (out) out.textContent = `❌ ${err.message}`;
    if (card) card.className = 'agent-card error';
    if (stat) { stat.className = 'agent-status s-err'; stat.textContent = '✗ erreur'; }
    showToast(`❌ ${err.message}`, '#ff4757');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '▶ Générer'; }
    if (stopBtn) stopBtn.style.display = 'none';
  }
}

function toggleReseauxOnly(p) {
  const section = document.getElementById(`reseauxOnlySection-${p}`);
  const btn = document.getElementById(`toggleReseauxOnlyBtn-${p}`);
  if (!section) return;
  const isVisible = section.style.display !== 'none';
  section.style.display = isVisible ? 'none' : 'block';
  if (btn) btn.textContent = isVisible ? '📋 Fiche déjà publiée' : '✕ Fermer';
  if (p === 'tt' || p === 'col') {
    refreshSoloTabs(p);
    if (!isVisible) activateSoloTab(p, 'social', { force: true });
  }
}

function displaySocialOutput(result, p) {
  const sections = parseSocialSections(result);
  state.socialSections = sections;
  const so = document.getElementById(`socialOutput-${p}`);
  if (so) { so.style.display = 'flex'; so.style.flexDirection = 'column'; }
  const show = (id, content) => {
    if (!content) return;
    const wrap = document.getElementById(`ss-${id}-${p}`);
    if (wrap) wrap.style.display = 'block';
    const el = document.getElementById(`sc-${id}-${p}`);
    if (el) el.textContent = content;
  };
  show('insta', sections.insta);
  show('fb', sections.fb);
  show('marketplace', sections.marketplace);
  if (sections.pinterest || sections.pinterestTitre || sections.pinterestDesc) {
    const wrap = document.getElementById(`ss-pinterest-${p}`); if (wrap) wrap.style.display = 'block';
    if (sections.pinterestTitre) {
      const t = document.getElementById(`sc-pinterest-titre-${p}`); if (t) t.style.display = 'block';
      const tc = document.getElementById(`sc-pinterest-t-${p}`); if (tc) tc.textContent = sections.pinterestTitre;
    }
    if (sections.pinterestDesc) {
      const d = document.getElementById(`sc-pinterest-desc-wrap-${p}`); if (d) d.style.display = 'block';
      const dc = document.getElementById(`sc-pinterest-d-${p}`); if (dc) dc.textContent = sections.pinterestDesc;
    }
    if (sections.pinterestAlt) {
      const a = document.getElementById(`sc-pinterest-alt-wrap-${p}`); if (a) a.style.display = 'block';
      const ac = document.getElementById(`sc-pinterest-a-${p}`); if (ac) ac.textContent = sections.pinterestAlt;
    }
    if (!sections.pinterestTitre && !sections.pinterestDesc) {
      const d = document.getElementById(`sc-pinterest-desc-wrap-${p}`); if (d) d.style.display = 'block';
      const dc = document.getElementById(`sc-pinterest-d-${p}`); if (dc) dc.textContent = sections.pinterest;
    }
  }
  if (p === 'tt' || p === 'col') {
    refreshSoloTabs(p);
    activateSoloTab(p, 'social', { force: true });
  }
}

function displayCamilleOutput(result, p) { displaySocialOutput(result, p); }

async function runReseauxOnly(type, p) {
  // Lire les overrides du formulaire "fiche déjà publiée"
  const nom       = document.getElementById(`ro-nom-${p}`)?.value || '';
  const sculpteur = document.getElementById(`ro-sculpteur-${p}`)?.value || '';
  const url       = document.getElementById(`ro-url-${p}`)?.value || '';
  const accroche  = document.getElementById(`ro-accroche-${p}`)?.value || '';
  const cta       = document.getElementById(`ro-cta-${p}`)?.value || '';
  const titre     = document.getElementById(`ro-titre-${p}`)?.value || '';

  // Sauvegarder les valeurs courantes
  const prevAccroche   = state.selectedAccroche;
  const prevCTA        = state.selectedCTA;
  const prevTitre      = state.outputs.titre_valide;
  const nomEl          = document.getElementById(`${p}-fNom`);
  const sculpteurEl    = document.getElementById(`${p}-fSculpteur`);
  const shopUrlEl      = document.getElementById('shopUrl');
  const prevNom        = nomEl?.value || '';
  const prevSculpteur  = sculpteurEl?.value || '';
  const prevUrl        = shopUrlEl?.value || '';

  // Appliquer les overrides
  if (accroche) state.selectedAccroche = { text: accroche };
  if (cta)      state.selectedCTA      = { text: cta };
  if (titre)    state.outputs.titre_valide = titre;
  if (nom       && nomEl)      nomEl.value      = nom;
  if (sculpteur && sculpteurEl) sculpteurEl.value = sculpteur;
  if (url && shopUrlEl) {
    shopUrlEl.value = url;
    try {
      const settings = JSON.parse(localStorage.getItem('pipeline.settings') || '{}');
      settings.shopUrl = url;
      localStorage.setItem('pipeline.settings', JSON.stringify(settings));
    } catch (error) {}
  }
  // echelles : injecter via un champ texte libre lu par buildCtx si dispo
  const nomCourtEl = document.getElementById(`${p}-fNomCourt`);
  const prevNomCourt = nomCourtEl?.value || '';
  if (nom && nomCourtEl) nomCourtEl.value = nom;

  try {
    if (type === 'leo'    || type === 'both') await runLeoAgent(p);
    if (type === 'camille'|| type === 'both') await runCamilleAgent(p);
  } finally {
    // Restaurer
    state.selectedAccroche     = prevAccroche;
    state.selectedCTA          = prevCTA;
    state.outputs.titre_valide = prevTitre;
    if (nomEl)       nomEl.value       = prevNom;
    if (nomCourtEl)  nomCourtEl.value  = prevNomCourt;
    if (sculpteurEl) sculpteurEl.value = prevSculpteur;
    if (shopUrlEl) {
      shopUrlEl.value = prevUrl;
      try {
        const settings = JSON.parse(localStorage.getItem('pipeline.settings') || '{}');
        settings.shopUrl = prevUrl || 'https://grosgeekindustrie.etsy.com';
        localStorage.setItem('pipeline.settings', JSON.stringify(settings));
      } catch (error) {}
    }
  }
}

function parseSocialSections(output) {
  const sections = { insta:'', fb:'', marketplace:'', pinterest:'', pinterestTitre:'', pinterestDesc:'', pinterestAlt:'' };
  const clean = output.replace(/\*\*(.*?)\*\*/g, '$1').replace(/#{1,3}\s*/g, '');
  const parts = clean.split(/(?:^|\n)\s*(INSTAGRAM(?:\/TIKTOK)?|TIKTOK|FACEBOOK MARKETPLACE|FACEBOOK|PINTEREST)\s*\n/im);
  for (let i = 1; i < parts.length; i += 2) {
    const marker = (parts[i] || '').trim().toLowerCase();
    const content = (parts[i + 1] || '').trim();
    if (marker.includes('instagram') || marker === 'tiktok') sections.insta = content;
    else if (marker.includes('facebook marketplace')) sections.marketplace = content;
    else if (marker.includes('facebook')) sections.fb = content;
    else if (marker.includes('pinterest')) {
      sections.pinterest = content;
      const pBlocks = content.split(/\n---+\n/);
      if (pBlocks[0]) sections.pinterestTitre = pBlocks[0].replace(/^TITRE PINTEREST\s*:\s*/i, '').trim();
      if (pBlocks[1]) sections.pinterestDesc  = pBlocks[1].replace(/^DESCRIPTION PINTEREST\s*:\s*/i, '').trim();
      if (pBlocks[2]) sections.pinterestAlt   = pBlocks[2].replace(/^BALISE ALT PINTEREST\s*:\s*/i, '').trim();
    }
  }
  if (!sections.insta && parts[0] && parts[0].trim().length > 20) sections.insta = parts[0].trim();
  if (!sections.insta && !sections.fb && !sections.pinterest) sections.insta = clean.trim();
  return sections;
}

function copySocialSection(id) {
  const keyMap = { insta:'insta', fb:'fb', pinterest:'pinterest', pinterestTitre:'pinterestTitre', pinterestDesc:'pinterestDesc', pinterestAlt:'pinterestAlt' };
  navigator.clipboard.writeText(state.socialSections?.[keyMap[id]] || '');
  showToast('Copié ✓');
}

function copySocial() { navigator.clipboard.writeText(state.outputs['social'] || ''); showToast('Posts copiés ✓'); }

// ═══════════════════════════════════════════════════════════
// OUTPUT FINAL
// ═══════════════════════════════════════════════════════════

function copySection(key) { navigator.clipboard.writeText(state.outputs[key] || ''); showToast('Copié ✓'); }

function buildFinalOutputExport(prefixOverride) {
  const prefix = prefixOverride || pfx();
  const titre = state.outputs.titre_valide || '';
  const tags = state.outputs.tags || '';
  const desc = state.outputs['description_assembled'] || state.outputs.description || '';
  const alt = state.outputs.alt || '';

  const parts = [];
  if (titre) parts.push(`── TITRE ──\n${titre}`);
  if (tags) parts.push(`── TAGS ──\n${tags}`);
  if (desc) parts.push(`── DESCRIPTION ──\n${desc}`);
  if (alt) parts.push(`── BALISE ALT ──\n${alt}`);

  return {
    prefix,
    content: parts.join('\n\n'),
  };
}

function getSoloExportMeta(prefixOverride) {
  const prefix = prefixOverride || pfx();
  const nomCourt = document.getElementById(`${prefix}-fNomCourt`)?.value?.trim() || '';
  const nomComplet = document.getElementById(`${prefix}-fNom`)?.value?.trim() || '';
  const sculpteur = document.getElementById(`${prefix}-fSculpteur`)?.value?.trim() || '';
  const fallbackNom = prefix === 'tt' ? 'tabletop_dnd' : 'collection';
  const rawNom = nomCourt || nomComplet || state.outputs.titre_valide || fallbackNom;
  const rawSculpteur = sculpteur || 'sculpteur';
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const dateFR = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`;
  const heureFR = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  const sanitizeSegment = (value, fallback) => {
    const sanitized = (value || fallback).replace(/[^\w-]/g, '_');

    return sanitized || fallback;
  };
  const nom = sanitizeSegment(rawNom, fallbackNom);
  const auteur = sanitizeSegment(rawSculpteur, 'sculpteur');
  const folder = prefix === 'tt' ? 'export/solo/dnd/' : 'export/solo/collection/';

  return {
    prefix,
    folder,
    base: `${nom}_${auteur}_${dateFR}_${heureFR}`,
  };
}

function getSoloFinalOutputAgentLabels(prefixOverride) {
  const prefix = prefixOverride || pfx();

  if (prefix === 'tt') {
    return {
      titre: '01 Maya — Titres',
      titre_valide: '01b Titre validé',
      tags: '02 Karim — Tags',
      marche: '03 Sophie — Analyse marché',
      description: '04 Claire — Description brute',
      description_assembled: '04b Description assemblée',
      alt: '05 Nadia — Balise ALT finale',
    };
  }

  return {
    titre: '01 Nova — Titres',
    titre_valide: '01b Titre validé',
    tags: '02 Axel — Tags',
    description: '03 Eden — Description brute',
    description_assembled: '03b Description assemblée',
    alt: '04 Jules — Balise ALT finale',
    iris: 'Hors pipeline — Iris sémantique',
  };
}

function buildSoloFinalOutputFiles(prefixOverride) {
  const exportMeta = getSoloExportMeta(prefixOverride);
  const tags = state.outputs.tags || '';
  const completeParts = [
    '# Output final',
    '',
    '## 🏷️ Titre',
    state.outputs.titre_valide || '',
    '',
    '## 🔖 Tags',
    tags,
  ];

  completeParts.push(
    '',
    '## 📝 Description',
    state.outputs['description_assembled'] || state.outputs.description || '',
    '',
    '## 🖼️ Balise ALT',
    state.outputs.alt || '',
  );

  const complete = completeParts.join('\n');

  const rawParts = ['# Output final — RAW', ''];
  const agentLabels = getSoloFinalOutputAgentLabels(exportMeta.prefix);

  Object.entries(agentLabels).forEach(([key, label]) => {
    const value = state.outputs[key];
    if (!value) return;
    rawParts.push(`## ${label}\n${value}\n`);
  });

  return {
    ...exportMeta,
    files: [
      {
        filename: `${exportMeta.folder}${exportMeta.base}_complete.md`,
        content: complete,
      },
      {
        filename: `${exportMeta.folder}${exportMeta.base}_raw.md`,
        content: rawParts.join('\n'),
      },
    ],
  };
}

async function exportFinalOutputs(prefixOverride) {
  const { folder, files } = buildSoloFinalOutputFiles(prefixOverride);
  const hasContent = files.some((file) => file.content.replace(/[#\s]/g, '').trim());

  if (!hasContent) {
    showToast('Aucun output final à exporter', '#ff4757');
    return;
  }

  try {
    const response = await fetch('/solo/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    showToast(`✅ Exporté dans ${folder} — ${data.count} fichier(s)`, '#4caf7d', 5000);
  } catch (error) {
    showToast(`Erreur export: ${error.message}`, '#ff4757', 5000);
  }
}

function copyAll() {
  const { content } = buildFinalOutputExport();
  if (!content) {
    showToast('Aucun output final à copier', '#ff4757');
    return;
  }
  navigator.clipboard.writeText(content);
  showToast('Tout copié ✓');
}

// ═══════════════════════════════════════════════════════════
// TITRE EXPLORER
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// Monitoring session.
// Affichage UI + cumul de coût runtime. Bloc isolable plus tard, mais déplacé seulement
// quand le coeur pipeline et le reporting auront des contrats plus stables.

// MONITORING COÛTS
// ═══════════════════════════════════════════════════════════
function getCostRatesForAgent(agentId = '') {
  const model = String(AGENT_MODELS[agentId] || '');
  const isHaiku = model.includes('haiku');

  return isHaiku
    ? { input: 0.80 / 1_000_000, cacheWrite: 1.00 / 1_000_000, cacheRead: 0.08 / 1_000_000, output: 4.00 / 1_000_000 }
    : { input: 3.00 / 1_000_000, cacheWrite: 3.75 / 1_000_000, cacheRead: 0.30 / 1_000_000, output: 15.00 / 1_000_000 };
}

function toSafeTokenCount(value) {
  return Math.max(0, Number(value) || 0);
}

function getCostTrackingState() {
  state.costTracking = state.costTracking || {
    entries: [],
    nextOrder: 1,
    aggregatesByKey: {},
    totals: {
      inputTok: 0,
      outputTok: 0,
      cacheRead: 0,
      cacheWrite: 0,
      costCents: 0,
    },
  };
  state.agentUsage = state.agentUsage || {};
  state.sessionCost = Number(state.sessionCost) || 0;

  return state.costTracking;
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
      social: '06 Léo',
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
      social: '05 Theo',
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

function getCostModelName(agentId = '') {
  return String(AGENT_MODELS[getCostModelAgentId(agentId)] || '—');
}

function getCostEntryType(entry = {}) {
  if (entry.source === 'cache-aware-prelaunch' || entry.agentId === 'cache_aware') return 'cache_aware_prelaunch';
  if (entry.isWarmupEvent) return 'warmup';
  if (entry.source === 'iris' || entry.agentId === 'iris') return 'iris';
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
    social: 'social',
    explorer: 'explorer',
    cache_aware_prelaunch: 'cache-aware pré-pipeline',
    warmup: 'warmup',
    other: 'autre',
  };

  return labels[getCostEntryType(entry)] || 'autre';
}

function getCostEntryTotalTokens(entry = {}) {
  return toSafeTokenCount(entry.inputTok) + toSafeTokenCount(entry.cacheWrite) + toSafeTokenCount(entry.cacheRead) + toSafeTokenCount(entry.outputTok);
}

function buildCostTypeTotals(entries = []) {
  const totals = {
    pipeline: { count: 0, costCents: 0 },
    rerun: { count: 0, costCents: 0 },
    iris: { count: 0, costCents: 0 },
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

function buildUsageCostSnapshot(agentId, usage = {}) {
  const rates = getCostRatesForAgent(agentId);
  const inputTok = toSafeTokenCount(usage.input_tokens);
  const outputTok = toSafeTokenCount(usage.output_tokens);
  const cacheRead = toSafeTokenCount(usage.cache_read_input_tokens);
  const cacheWrite = toSafeTokenCount(usage.cache_creation_input_tokens);
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
    costCents: 0,
  };

  tracking.entries.forEach((entry) => {
    totals.inputTok += entry.inputTok;
    totals.outputTok += entry.outputTok;
    totals.cacheRead += entry.cacheRead;
    totals.cacheWrite += entry.cacheWrite;
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
    aggregate.costCents += entry.costCents;
    aggregate.lastOrder = entry.order;
    aggregate.lastEntry = entry;
  });

  tracking.aggregatesByKey = aggregatesByKey;
  tracking.totals = totals;
  state.sessionCost = totals.costCents;
  state.agentUsage = Object.fromEntries(
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

  sessionEl.textContent = `💰 ${totals.costCents.toFixed(2)}¢`;
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

  badge.innerHTML = parts.join('<span style="opacity:.3;">|</span>');
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

  const resolvedPrefix = String(options.prefix || pfx());
  const resolvedAgentId = String(agentId || '').trim();
  if (!resolvedAgentId) return null;

  const tracking = getCostTrackingState();
  const snapshot = buildUsageCostSnapshot(resolvedAgentId, usage);
  const activeCacheRun = getActiveCacheDebugRun(resolvedPrefix);
  const activeCacheEvents = Array.isArray(activeCacheRun?.events) ? activeCacheRun.events : [];
  const matchingCacheEvents = activeCacheEvents.filter((event) => {
    return event.agentId === resolvedAgentId || event.displayStepId === resolvedAgentId;
  });
  const lastCacheEvent = matchingCacheEvents[matchingCacheEvents.length - 1] || null;
  const warmupDetails = getCacheWarmupDetails(activeCacheEvents);
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
    mode: getPipelineLaunchMode(resolvedPrefix),
    agentId: resolvedAgentId,
    label: getCostAgentLabel(resolvedPrefix, resolvedAgentId),
    model: getCostModelName(resolvedAgentId),
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
  if (!entry) return;

  refreshSessionCostDisplay();
  renderAgentCostBadge(entry.prefix, entry.agentId);
}

function copyTokenReport() {
  const { tracking, totals, aggregatesByKey } = recomputeCostTracking();
  const entries = Array.isArray(tracking.entries) ? tracking.entries : [];
  if (!entries.length) {
    showToast('Aucun coût session à copier', '#ff4757');
    return;
  }

  const categoryTotals = buildCostTypeTotals(entries);
  const linesSum = entries.reduce((sum, entry) => sum + (Number(entry.costCents) || 0), 0);
  const topEntries = [...entries].sort((left, right) => right.costCents - left.costCents).slice(0, 3);
  const latestRuns = ['tt', 'col']
    .map((prefix) => getLatestCacheDebugRun(prefix))
    .filter(Boolean);
  const warmupSummaries = latestRuns.length
    ? latestRuns.map((run) => {
        const details = getCacheWarmupDetails(run.events || []);
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
    '',
    '── Totaux par périmètre ──',
    `Cache-aware pré-pipeline: ${categoryTotals.cache_aware_prelaunch.costCents.toFixed(3)}¢ (${categoryTotals.cache_aware_prelaunch.count} événement(s))`,
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
      const model = getCostModelName(aggregate.agentId);

      lines.push(
        `${getCostModeShortLabel(aggregate.prefix)} · ${aggregate.label} | ${model} | x${aggregate.executionCount}`
        + ` | ${aggregate.costCents.toFixed(3)}¢`
        + ` | in ${aggregate.inputTok.toLocaleString()}`
        + ` | out ${aggregate.outputTok.toLocaleString()}`
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
      `   tok : input ${entry.inputTok.toLocaleString()} | cache write ${entry.cacheWrite.toLocaleString()} | cache read ${entry.cacheRead.toLocaleString()} | output ${entry.outputTok.toLocaleString()} | total ${entry.totalTokens.toLocaleString()}`,
    );
    lines.push(
      `   cache: ${entry.cacheStatus || '—'} | warmup: ${entry.isWarmupEvent ? 'oui' : 'non'} | contexte: ${entry.mode} / ${entry.prefix}`,
    );
  });

  navigator.clipboard.writeText(lines.join('\n'));
  showToast('Rapport coûts/tokens copié ✓');
}


// ═══════════════════════════════════════════════════════════
// PERSISTANCE FORMULAIRE
// ═══════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════
