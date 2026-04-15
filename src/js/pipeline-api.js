// ═══ PIPELINE API ═══

// Appel HTTP Anthropic.
// Fonction sensible : gère aussi les retries, le prompt caching, les images et les
// AbortController. Toute extraction future doit préserver exactement ce contrat réseau.


// Runtime réseau + orchestration pipeline.
// État actuel : ce fichier ne contient pas seulement les appels API. Il regroupe encore
// l'appel Anthropic, l'orchestrateur QA, l'exécution des agents, une partie du runtime
// pipeline, les agents sociaux, les helpers de copie et le monitoring des coûts.
// Découpage visé : extraire progressivement les blocs les moins risqués (social / copy /
// reporting) vers des modules UI dédiés, puis traiter le coeur pipeline en dernier.
// Important : ne pas lancer de refactor brutal ici sans campagne de retest complète.

const CACHEABLE_BLOCK_MIN_CHARS = 4096;
const ANTHROPIC_PROMPT_CACHING_BETA = 'prompt-caching-2024-07-31';
const ANTHROPIC_FILES_API_BETA = 'files-api-2025-04-14';
const IMAGE_AWARE_AGENT_IDS = new Set(['marche', 'description', 'analyse', 'alt']);
const PROMPT_CACHE_TTL_MS = 5 * 60 * 1000;
const PROMPT_CACHE_ZONE_GRISE_MS = 2 * 60 * 1000;
const PROMPT_CACHE_UI_REFRESH_MS = 5 * 1000;
const CACHE_AWARE_RUNTIME_AGENT_ID = 'cache_aware_prelaunch';
const CACHE_AWARE_STEP_ID = 'cache_aware';

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
  const states = ['files-api-hit', 'files-api-upload', 'files-api-mixed', 'files-api-error'];

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
    return {
      images: [],
      debug: {
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
        status: 'none',
      },
    };
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

  if (invalidatedImages.length) {
    invalidatedImages.forEach((image) => {
      clearAnthropicImageFileState(image, { keepContentHash: Boolean(image?.contentHash) });
    });

    try {
      const normalized = await window.PipelineUIIndexedDb?.saveWorkspaceImages?.(prefix, images);
      if (Array.isArray(normalized) && normalized.length) {
        state.images[prefix] = normalized;
      }
      workspacePersisted = true;
    } catch (error) {
      workspacePersisted = false;
      workspacePersistError = error?.message || 'Persistance workspace impossible';
      console.warn(`Persist invalidated Anthropic files failed for ${prefix}`, error);
    }
  }

  if (!uploadCandidates.length) {
    return {
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
    };
  }

  const response = await fetch('/anthropic/files/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      images: uploadCandidates.map(({ image, index }) => ({
        imageId: String(image.id || `image-${index + 1}`),
        name: String(image.name || `image-${index + 1}`),
        mediaType: String(image.mediaType || 'image/png'),
        base64: String(image.base64 || ''),
        contentHash: String(image.contentHash || ''),
      })),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const error = data.error || `HTTP ${response.status}`;
    return {
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
    };
  }

  const uploadedAt = new Date().toISOString();
  const uploads = Array.isArray(data.images) ? data.images : [];
  const uploadsById = new Map(uploads.map((entry) => [String(entry.imageId || ''), entry]));
  const serverCacheHitsCount = uploads.filter((entry) => Boolean(entry?.cached)).length;
  const uploadedCount = uploads.filter((entry) => !entry?.cached).length;
  const missingUploadIds = uploadCandidates
    .map(({ image, index }) => String(image?.id || `image-${index + 1}`))
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

    return {
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
    };
  }

  images.forEach((image, index) => {
    const imageId = String(image?.id || `image-${index + 1}`);
    const uploaded = uploadsById.get(imageId);
    if (!uploaded) return;

    image.contentHash = String(uploaded.contentHash || image.contentHash || '');
    image.anthropicFileId = String(uploaded.fileId || image.anthropicFileId || '');
    image.anthropicContentHash = String(uploaded.contentHash || image.anthropicContentHash || '');
    image.anthropicUploadedAt = uploadedAt;
    hasMutation = true;
  });

  if (hasMutation) {
    try {
      const normalized = await window.PipelineUIIndexedDb?.saveWorkspaceImages?.(prefix, images);
      if (Array.isArray(normalized) && normalized.length) {
        state.images[prefix] = normalized;
      }
      workspacePersisted = true;
    } catch (error) {
      workspacePersisted = false;
      workspacePersistError = error?.message || 'Persistance workspace impossible';
      console.warn(`Persist Anthropic files failed for ${prefix}`, error);
    }
  }

  const readyImagesAfter = getFreshAnthropicImageFiles(Array.isArray(state?.images?.[prefix]) ? state.images[prefix] : requestedImages);
  const filesReusedCount = readyImagesBefore.length + serverCacheHitsCount;
  const unresolvedCount = requestedImages.length - readyImagesAfter.length;

  if (unresolvedCount > 0) {
    const error = `Files API incomplète: ${unresolvedCount} image(s) sans file_id exploitable après upload.`;

    return {
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
    };
  }

  return {
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
  };
}

async function buildRequestImageBlocks(prefix, apiKey) {
  const result = await ensureAnthropicImageFiles(prefix, apiKey);
  const images = Array.isArray(result?.images) ? result.images : [];
  const debug = result?.debug || {
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
    status: 'none',
  };

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
  const isLegacy = typeof promptData === 'string';
  const promptText = isLegacy ? promptData : promptData.filled;
  const fixedContent = isLegacy ? null : promptData.fixedContent;
  const fixedContentBlocks = isLegacy ? [] : (Array.isArray(promptData.fixedContentBlocks) ? promptData.fixedContentBlocks : []);
  const promptDebug = isLegacy ? null : (promptData.promptDebug || null);
  const runtimeAgentId = isLegacy ? agentId : (String(promptData.runtimeAgentId || '').trim() || agentId);
  const prefix = pfx();
  const content = [];
  const getRetryDelayMs = (attempt) => {
    const baseDelay = Math.min(30000, 3000 * (2 ** Math.max(attempt - 1, 0)));
    const jitter = Math.floor(Math.random() * 1200);
    return baseDelay + jitter;
  };
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
  let filesApiDebug = {
    enabled: hasRequestedImages,
    requestedImagesCount: hasRequestedImages ? state.images[prefix].length : 0,
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
    status: 'none',
  };

  if (hasRequestedImages) {
    const imageRequest = await buildRequestImageBlocks(prefix, apiKey);
    imageContentBlocks = imageRequest.blocks;
    filesApiDebug = imageRequest.debug || filesApiDebug;
  }

  let fixedPrefixChars = 0;
  const normalizedFixedBlocks = fixedContentBlocks
    .map((block, index) => {
      const text = String(block?.text || '').trim();
      if (!text) return null;

      const chars = text.length;
      fixedPrefixChars += chars;
      const cacheable = Boolean(block?.cacheable);
      const cacheApplied = cacheable && fixedPrefixChars >= CACHEABLE_BLOCK_MIN_CHARS;

      return {
        key: block?.key || `block_${index + 1}`,
        text,
        chars,
        prefixChars: fixedPrefixChars,
        cacheable,
        cacheApplied,
        cacheGroup: String(block?.cacheGroup || ''),
        cacheLabel: String(block?.cacheLabel || ''),
      };
    })
    .filter(Boolean);
  const appliedBreakpointCount = normalizedFixedBlocks.filter((block) => block.cacheApplied).length;
  const canApplyImageBreakpoint = imageContentBlocks.length > 0
    && appliedBreakpointCount < 4
    && normalizedFixedBlocks.some((block) => block.cacheApplied);

  if (imageContentBlocks.length > 0) {
    imageContentBlocks = imageContentBlocks.map((block, index) => {
      if (!canApplyImageBreakpoint || index !== imageContentBlocks.length - 1) return block;
      return {
        ...block,
        cache_control: { type: 'ephemeral' },
      };
    });

    filesApiDebug = {
      ...filesApiDebug,
      promptCacheBreakpointApplied: canApplyImageBreakpoint,
      promptCacheBreakpointType: canApplyImageBreakpoint ? 'last_image' : 'none',
    };
  }

  const runtimePromptDebug = isLegacy
    ? promptDebug
    : {
        ...(promptDebug || {}),
        fixedBlocks: normalizedFixedBlocks.map((block, index) => ({
          index,
          key: block.key,
          cacheable: block.cacheable,
          cacheApplied: block.cacheApplied,
          cacheGroup: block.cacheGroup,
          cacheLabel: block.cacheLabel,
          chars: block.chars,
          prefixChars: block.prefixChars,
        })),
        filesApiDebug,
      };

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
  } else if (fixedContent && fixedContent.length >= CACHEABLE_BLOCK_MIN_CHARS) {
    content.push({ type: 'text', text: fixedContent, cache_control: { type: 'ephemeral' } });
    content.push(...imageContentBlocks);
    content.push({ type: 'text', text: promptText });
  } else {
    content.push(...imageContentBlocks);
    content.push({ type: 'text', text: promptText });
  }

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

      const canRetry = attempt < retries && isRetryableOverloadError(err);
      if (!canRetry) {
        if (filesApiDebug.enabled) {
          applyAgentFilesApiVisualState(prefix, runtimeAgentId, {
            ...filesApiDebug,
            status: 'error',
            error: err.message,
          });
        }
        delete abortControllers[agentId];
        if (isRetryableOverloadError(err)) {
          throw new Error('Serveurs Anthropic surchargés après plusieurs tentatives. Réessaie dans quelques minutes.');
        }
        throw err;
      }

      const delayMs = getRetryDelayMs(attempt);
      updateRetryMessage(attempt, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  delete abortControllers[agentId];
  throw new Error('Serveurs Anthropic surchargés après plusieurs tentatives. Réessaie dans quelques minutes.');
}


// ═══════════════════════════════════════════════════════════
// QA secondaire optionnelle.
// Ce bloc reste ici car il est directement branché au runtime d'exécution des agents.

// ORCHESTRATEUR
// ═══════════════════════════════════════════════════════════
function toggleOrchestrator() {
  state.orchestrateurActif = !state.orchestrateurActif;
  const btn = document.getElementById('orchToggleBtn');
  btn.textContent = `🔍 Orchestrateur ${state.orchestrateurActif ? 'ON' : 'OFF'}`;
  btn.className = `btn ${state.orchestrateurActif ? 'btn-success' : 'btn-muted'}`;
  showToast(`Orchestrateur ${state.orchestrateurActif ? 'activé' : 'désactivé'}`);
}

async function runOrchestrator(agentId, output) {
  const ctx = buildCtx(agentId);
  const attempt = (state.orchAttempts[agentId] || 0) + 1;
  state.orchAttempts[agentId] = attempt;
  const orchCtx = { ...ctx, agent_id: agentId, tentative: attempt, output_to_validate: output };
  const prompt = buildPrompt('orchestrateur', orchCtx);
  try {
    const { text: result, usage } = await callClaude('orchestrateur', prompt.filled, false, 2);
    showAgentCost('orchestrateur', usage, { prefix: pfx(), source: 'orchestrateur' });
    syncCacheIndicator(usage);
    const clean = result.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    return { statut: 'VALIDE', agent: agentId, tentative: attempt, problemes: [], correction: '', score: '?/?' };
  }
}

function showOrchestratorBadge(agentId, result) {
  const existing = document.getElementById(`orch-badge-${agentId}`);
  if (existing) existing.remove();
  const badge = document.createElement('div');
  badge.id = `orch-badge-${agentId}`;
  badge.style.cssText = 'margin:4px 0 8px;padding:7px 11px;border-radius:6px;font-family:Space Mono,monospace;font-size:11px;line-height:1.6;';
  const problems = (result.problemes || []).slice(0, 2).join(' • ');
  if (result.statut === 'VALIDE') {
    badge.style.cssText += 'background:rgba(76,175,125,.1);border:1px solid rgba(76,175,125,.3);color:#4caf7d;';
    if (result.tentative > 1) {
      const prev = (state._lastOrchProblems?.[agentId] || []).slice(0,2);
      badge.innerHTML = `✅ Corrigé après ${result.tentative - 1} relance${prev.length ? `<br><span style="opacity:.6;font-size:10px;">${prev.map(p => `✓ ${p}`).join('<br>')}</span>` : ''}`;
    } else badge.textContent = `✅ ${currentMode === 'collection' ? 'Rex' : 'Felix'} OK — ${result.score}`;
  } else if (result.statut === 'RELANCER') {
    if (!state._lastOrchProblems) state._lastOrchProblems = {};
    state._lastOrchProblems[agentId] = result.problemes || [];
    badge.style.cssText += 'background:rgba(232,197,71,.1);border:1px solid rgba(232,197,71,.3);color:#e8c547;';
    badge.innerHTML = `⟳ Relance ${result.tentative}/2${problems ? `<br><span style="opacity:.7;">${problems}</span>` : ''}`;
  } else {
    badge.style.cssText += 'background:rgba(255,71,87,.1);border:1px solid rgba(255,71,87,.3);color:#ff4757;';
    badge.innerHTML = `❌ ALERTE${problems ? `<br><span style="opacity:.7;">${problems}</span>` : ''}`;
  }
  const body = document.getElementById(`${pfx()}-body-${agentId}`);
  if (body) body.insertBefore(badge, body.firstChild);
}

function refreshSoloTabs(prefix) {
  const mode = typeof getPipelineModeByPrefix === 'function'
    ? getPipelineModeByPrefix(prefix)
    : (prefix === 'col' ? 'collection' : 'tabletop');
  const refreshMethodName = typeof getPipelineUiConfig === 'function'
    ? getPipelineUiConfig(mode)?.tabs?.refreshMethod
    : (prefix === 'col' ? 'refreshCollectionSoloTabs' : 'refreshDndSoloTabs');
  const refreshMethod = refreshMethodName ? window[refreshMethodName] : null;
  refreshMethod?.();
}

function activateSoloTab(prefix, tabId, options = {}) {
  const mode = typeof getPipelineModeByPrefix === 'function'
    ? getPipelineModeByPrefix(prefix)
    : (prefix === 'col' ? 'collection' : 'tabletop');
  const activateMethodName = typeof getPipelineUiConfig === 'function'
    ? getPipelineUiConfig(mode)?.tabs?.activateMethod
    : (prefix === 'col' ? 'activateCollectionSoloTab' : 'activateDndSoloTab');
  const activateMethod = activateMethodName ? window[activateMethodName] : null;
  activateMethod?.(tabId, options);
}

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

function getPipelineLaunchState(prefix) {
  state.pipelineLaunch = state.pipelineLaunch || {};
  state.pipelineLaunch[prefix] = state.pipelineLaunch[prefix] || {
    currentStepId: '',
    isRunning: false,
    lastStatus: 'prêt',
  };
  return state.pipelineLaunch[prefix];
}

function getPromptCachePrefix(prefix = '') {
  if (prefix) return prefix;
  if (typeof pfx === 'function') return pfx();
  if (typeof getPipelinePrefix === 'function') return getPipelinePrefix(currentMode);
  return currentMode === 'collection' ? 'col' : 'tt';
}

function formatPromptCacheTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getRuntimeDebugState() {
  state.runtimeDebug = state.runtimeDebug || {};
  state.runtimeDebug.lastCacheStatus = state.runtimeDebug.lastCacheStatus || '—';
  state.runtimeDebug.activeCacheRuns = state.runtimeDebug.activeCacheRuns || {};
  state.runtimeDebug.cacheRunHistory = state.runtimeDebug.cacheRunHistory || {};
  state.runtimeDebug.promptCacheByPrefix = state.runtimeDebug.promptCacheByPrefix || {};

  if (!state.runtimeDebug.promptCacheTickerId && typeof window !== 'undefined') {
    state.runtimeDebug.promptCacheTickerId = window.setInterval(() => {
      renderPromptCacheIndicator();
      refreshPipelineLaunchPanels();
    }, PROMPT_CACHE_UI_REFRESH_MS);
  }

  return state.runtimeDebug;
}

function getPromptCacheEntry(prefix = '', createIfMissing = false) {
  const runtimeDebug = getRuntimeDebugState();
  const resolvedPrefix = getPromptCachePrefix(prefix);

  if (!runtimeDebug.promptCacheByPrefix[resolvedPrefix] && createIfMissing) {
    runtimeDebug.promptCacheByPrefix[resolvedPrefix] = {
      status: '—',
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
      lastConfirmedAtLabel: '—',
      expiresAtLabel: '—',
      remainingMs: 0,
    };
  }

  const expiresAtMs = entry.expiresAtMs || (entry.lastConfirmedAtMs + PROMPT_CACHE_TTL_MS);
  const remainingMs = expiresAtMs - nowMs;
  let state = 'stale';
  let label = 'probablement expiré';

  if (remainingMs > PROMPT_CACHE_ZONE_GRISE_MS) {
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

function updatePromptCacheCheckpoint(prefix = '', status = '—') {
  const resolvedPrefix = getPromptCachePrefix(prefix);
  const entry = getPromptCacheEntry(resolvedPrefix, true);
  const now = new Date();
  entry.status = status;
  entry.lastConfirmedAtMs = now.getTime();
  entry.lastConfirmedAt = now.toISOString();
  entry.expiresAtMs = entry.lastConfirmedAtMs + PROMPT_CACHE_TTL_MS;
  entry.expiresAt = new Date(entry.expiresAtMs).toISOString();
}

function getLastCacheStatus(prefix = '') {
  const resolvedPrefix = getPromptCachePrefix(prefix);
  const entry = getPromptCacheEntry(resolvedPrefix, false);
  const baseStatus = String(entry?.status || getRuntimeDebugState().lastCacheStatus || '—');
  const freshness = getPromptCacheFreshnessInfo(resolvedPrefix);

  if (!freshness.hasEstimate) return baseStatus;
  if (baseStatus === '—') return freshness.label;
  return `${baseStatus} · ${freshness.label}`;
}

function renderPromptCacheIndicator(prefix = '') {
  const resolvedPrefix = getPromptCachePrefix(prefix);
  const cacheNode = document.getElementById('session-cache');
  if (!cacheNode) return;

  const freshness = getPromptCacheFreshnessInfo(resolvedPrefix);
  const status = getLastCacheStatus(resolvedPrefix);
  const classes = ['cache-freshness-hot', 'cache-freshness-gray', 'cache-freshness-stale'];
  cacheNode.classList.remove(...classes);
  cacheNode.textContent = `🧠 cache ${status}`;

  if (!freshness.hasEstimate) {
    cacheNode.title = `Cliquer pour copier le rapport cache complet · dernier statut : ${status}`;
    return;
  }

  const stateClass = freshness.state === 'hot'
    ? 'cache-freshness-hot'
    : freshness.state === 'gray'
      ? 'cache-freshness-gray'
      : 'cache-freshness-stale';
  cacheNode.classList.add(stateClass);
  cacheNode.title = [
    `Cliquer pour copier le rapport cache complet · dernier statut : ${status}`,
    `Dernier refresh confirmé : ${freshness.lastConfirmedAtLabel}`,
    `Expiration estimée si inactif : ${freshness.expiresAtLabel}`,
    `Fraîcheur estimée : ${freshness.label}`,
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
  const pipelineRunState = getPipelineRunState(prefix);
  const runRecord = {
    prefix,
    mode: getPipelineLaunchMode(prefix),
    launchScope: String(options.launchScope || 'pipeline complet'),
    cacheAwareEnabled: Boolean(options.cacheAwareEnabled),
    startedAt: new Date().toISOString(),
    finishedAt: '',
    finalStatus: 'running',
    pipelineAgents: pipelineAgents.map((agent) => agent.id),
    events: [],
    lastHeaderStatus: runtimeDebug.lastCacheStatus || '—',
    launchStatus: launchState.lastStatus || 'prêt',
    warmupEnabled: false,
    warmupHint: pipelineRunState.warmupHint || 'Warmup non défini',
  };

  runtimeDebug.activeCacheRuns[prefix] = runRecord;
  return runRecord;
}

function finalizeCacheDebugRun(prefix, finalStatus = '') {
  const runtimeDebug = getRuntimeDebugState();
  const activeRun = runtimeDebug.activeCacheRuns[prefix];
  if (!activeRun) return;

  const pipelineRunState = getPipelineRunState(prefix);
  activeRun.finishedAt = new Date().toISOString();
  activeRun.finalStatus = finalStatus || activeRun.finalStatus || 'done';
  activeRun.lastHeaderStatus = runtimeDebug.lastCacheStatus || '—';
  activeRun.launchStatus = getPipelineLaunchState(prefix).lastStatus || activeRun.launchStatus || 'prêt';
  activeRun.warmupHint = pipelineRunState.warmupHint || activeRun.warmupHint || 'Warmup non défini';

  const warmupDetails = getCacheWarmupDetails(activeRun.events);
  activeRun.warmupEnabled = warmupDetails.enabled;
  activeRun.firstWriteOrder = warmupDetails.firstWriteOrder;
  activeRun.firstHitOrder = warmupDetails.firstHitOrder;
  runtimeDebug.cacheRunHistory[prefix] = activeRun;
}

function getLatestCacheDebugRun(prefix = pfx()) {
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

function recordCacheDebugEvent(prefix, agentId, usage = {}, promptDebug = null) {
  const activeRun = getActiveCacheDebugRun(prefix);
  if (!activeRun) return;

  const fixedBlocks = Array.isArray(promptDebug?.fixedBlocks) ? promptDebug.fixedBlocks : [];
  const sharedBlock = fixedBlocks.find((block) => block.key === 'shared_prefix');
  const cumulativeBlocks = fixedBlocks.filter((block) => (block.cacheGroup || '').trim() === 'cumulative_append_only'
    || String(block.key || '').startsWith('cumulative_append_only'));
  const launchState = getPipelineLaunchState(prefix);
  const cacheAppliedBlocks = fixedBlocks.filter((block) => block.cacheApplied);
  const filesApiDebug = promptDebug?.filesApiDebug && typeof promptDebug.filesApiDebug === 'object'
    ? { ...promptDebug.filesApiDebug }
    : null;
  const event = {
    order: activeRun.events.length + 1,
    agentId,
    status: getCacheStatusFromUsage(usage),
    cacheReadTokens: usage.cache_read_input_tokens || 0,
    cacheWriteTokens: usage.cache_creation_input_tokens || 0,
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    promptChars: promptDebug?.promptChars || 0,
    fixedChars: fixedBlocks.reduce((sum, block) => sum + (block.chars || 0), 0),
    sharedPrefixChars: sharedBlock?.chars || 0,
    cumulativeChars: cumulativeBlocks.reduce((sum, block) => sum + (block.chars || 0), 0),
    cumulativeCacheAppliedChars: cumulativeBlocks.reduce((sum, block) => sum + (block.cacheApplied ? (block.chars || 0) : 0), 0),
    cumulativeBlockCount: cumulativeBlocks.length,
    cacheAppliedChars: cacheAppliedBlocks.reduce((sum, block) => sum + (block.chars || 0), 0),
    fixedBlocks,
    filesApiDebug,
    source: String(promptDebug?.source || 'pipeline'),
    displayStepId: launchState.currentStepId || getPipelineDisplayStepIdForRuntimeAgent(prefix, agentId),
    timestamp: new Date().toISOString(),
  };

  activeRun.events.push(event);
  activeRun.lastHeaderStatus = getRuntimeDebugState().lastCacheStatus || activeRun.lastHeaderStatus || '—';
}

function buildCacheDebugReport(prefix = pfx()) {
  const run = getLatestCacheDebugRun(prefix);
  if (!run) return 'Aucun rapport cache disponible.';

  const warmupDetails = getCacheWarmupDetails(run.events);
  const warmupStatus = warmupDetails.enabled
    ? `ON (#${warmupDetails.firstWriteOrder} → #${warmupDetails.firstHitOrder})`
    : 'OFF';
  const cacheAwareEvents = run.events.filter((event) => String(event?.source || '') === 'cache-aware-prelaunch');
  const lines = [
    '═══ RAPPORT CACHE PIPELINE ═══',
    `Mode: ${run.mode}`,
    `Préfixe: ${run.prefix}`,
    `Lancement: ${run.launchScope || 'pipeline complet'}`,
    `Ordre: ${run.pipelineAgents.join(' -> ') || '—'}`,
    `Démarré: ${run.startedAt || '—'}`,
    `Terminé: ${run.finishedAt || '—'}`,
    `Statut final: ${run.finalStatus || '—'}`,
    `Header cache: ${run.lastHeaderStatus || '—'}`,
    `Cache-aware pré-pipeline: ${cacheAwareEvents.length ? `ON (${cacheAwareEvents.length} événement(s))` : 'OFF'}`,
    `Warmup intra-pipeline réel: ${warmupStatus}`,
    `Warmup hint: ${run.warmupHint || '—'}`,
  ];

  const freshness = getPromptCacheFreshnessInfo(prefix);
  if (freshness.hasEstimate) {
    lines.push(`Dernier refresh confirmé: ${freshness.lastConfirmedAtLabel}`);
    lines.push(`Expiration estimée si inactif: ${freshness.expiresAtLabel}`);
    lines.push(`Fraîcheur estimée: ${freshness.label}`);
  } else {
    lines.push('Dernier refresh confirmé: —');
    lines.push('Expiration estimée si inactif: —');
    lines.push('Fraîcheur estimée: —');
  }

  lines.push('');

  if (!run.events.length) {
    lines.push('Aucun événement cache enregistré.');
    return lines.join('\n');
  }

  run.events.forEach((event) => {
    lines.push(`#${event.order} ${event.agentId} (${event.displayStepId || event.agentId})`);
    lines.push(`- source: ${event.source || 'pipeline'}`);
    lines.push(`- cache: ${event.status}`);
    lines.push(`- lu: ${event.cacheReadTokens.toLocaleString()} tok`);
    lines.push(`- écrit: ${event.cacheWriteTokens.toLocaleString()} tok`);
    lines.push(`- input: ${event.inputTokens.toLocaleString()} tok`);
    lines.push(`- output: ${event.outputTokens.toLocaleString()} tok`);
    lines.push(`- prompt variable: ${event.promptChars.toLocaleString()} chars`);
    lines.push(`- bloc fixe total: ${event.fixedChars.toLocaleString()} chars`);
    lines.push(`- bloc fixe activé: ${event.cacheAppliedChars.toLocaleString()} chars`);
    lines.push(`- bloc commun: ${event.sharedPrefixChars.toLocaleString()} chars`);
    lines.push(`- cumulatif: ${event.cumulativeChars.toLocaleString()} chars (${(event.cumulativeBlockCount || 0).toLocaleString()} bloc(s))`);
    if (event.cumulativeCacheAppliedChars > 0) {
      lines.push(`- cumulatif caché: ${event.cumulativeCacheAppliedChars.toLocaleString()} chars`);
    }
    if (event.filesApiDebug?.enabled) {
      const filesApiStatus = formatFilesApiStatusLabel(event.filesApiDebug.status);
      lines.push(`- files api: ${filesApiStatus}`);
      lines.push(`- images demandées: ${(event.filesApiDebug.requestedImagesCount || 0).toLocaleString()}`);
      lines.push(`- files utilisés: ${(event.filesApiDebug.usedFilesCount || 0).toLocaleString()}`);
      lines.push(`- reuses locaux: ${(event.filesApiDebug.localReuseCount || 0).toLocaleString()}`);
      lines.push(`- reuses cache serveur: ${(event.filesApiDebug.serverCacheHitsCount || 0).toLocaleString()}`);
      lines.push(`- uploads réels: ${(event.filesApiDebug.uploadedCount || 0).toLocaleString()}`);
      lines.push(`- invalidations: ${(event.filesApiDebug.invalidatedCount || 0).toLocaleString()}`);
      lines.push(`- images non résolues: ${(event.filesApiDebug.unresolvedCount || 0).toLocaleString()}`);
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
            : ` · cache OFF (prefixe < ${CACHEABLE_BLOCK_MIN_CHARS.toLocaleString()} chars)`)
        : '';
      const blockLabel = block.cacheLabel ? ` — ${block.cacheLabel}` : '';
      lines.push(`  • ${block.key}${blockLabel}: ${block.chars.toLocaleString()} chars${cacheLabel}`);
    });
    lines.push('');
  });

  return lines.join('\n').trim();
}

function copyCacheDebugReport(prefix = pfx()) {
  const report = buildCacheDebugReport(prefix);
  navigator.clipboard.writeText(report);
  showToast('Rapport cache copié ✓');
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
  refreshPipelineLaunchPanels();
}

function getPipelineLaunchSummary(prefix) {
  const launchState = getPipelineLaunchState(prefix);
  const steps = getPipelineTargetStepsForPrefix(prefix);
  const currentStep = steps.find((step) => step.id === launchState.currentStepId);
  const currentStepLabel = launchState.currentStepId === CACHE_AWARE_STEP_ID
    ? 'Cache-aware pré-pipeline'
    : (currentStep ? currentStep.label : '—');

  return [
    'Pipeline : complet',
    `Étape courante : ${currentStepLabel}`,
    `État : ${launchState.lastStatus || 'prêt'}`,
    `Cache : ${getLastCacheStatus()}`,
  ].join('\n');
}

const syncStandaloneLaunchButtons = (prefix) => {
  const launchState = getPipelineLaunchState(prefix);
  const buttons = document.querySelectorAll(`[data-pipeline-action="launch"][data-pipeline-prefix="${prefix}"]`);

  buttons.forEach((button) => {
    button.disabled = launchState.isRunning;
    if (button.id === `runBtn-${prefix}`) {
      button.title = 'Lancer le pipeline complet';
      button.setAttribute('aria-label', 'Lancer le pipeline complet');
      return;
    }

    button.textContent = '▶ Lancer le pipeline complet';
  });
};

function renderPipelineLaunchPanel(prefix) {
  const statusNode = document.getElementById(`launchStatus-${prefix}`);

  if (!statusNode) return;

  statusNode.textContent = getPipelineLaunchSummary(prefix);
  syncStandaloneLaunchButtons(prefix);
}

function refreshPipelineLaunchPanelState(prefix) {
  renderPipelineLaunchPanel(prefix);
}

function refreshPipelineLaunchPanels() {
  const prefixes = typeof getPipelinePrefixes === 'function' ? getPipelinePrefixes() : ['tt', 'col'];
  prefixes.forEach((prefix) => renderPipelineLaunchPanel(prefix));
}

function setPipelineLaunchState(prefix, nextState = {}) {
  const launchState = getPipelineLaunchState(prefix);
  Object.assign(launchState, nextState);
  refreshPipelineLaunchPanelState(prefix);
}

function buildPipelineFormSnapshot(prefix) {
  const mode = getPipelineLaunchMode(prefix);
  const echelles = typeof window.PipelineUIEchelles?.getEchellesSelected === 'function'
    ? window.PipelineUIEchelles.getEchellesSelected()
    : '';
  const dimensions = typeof window.PipelineUIEchelles?.getDimsFromEchelles === 'function'
    ? window.PipelineUIEchelles.getDimsFromEchelles()
    : '';
  const collectionData = mode === 'collection' && typeof getCollectionData === 'function'
    ? getCollectionData()
    : {};
  const lines = [];
  const pushSnapshotLine = (label, value) => {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) return;
    lines.push(`${label}: ${normalizedValue}`);
  };

  pushSnapshotLine('Mode', mode);
  pushSnapshotLine('Nom', document.getElementById(`${prefix}-fNom`)?.value);
  pushSnapshotLine('Nom court', document.getElementById(`${prefix}-fNomCourt`)?.value);
  pushSnapshotLine('Univers', document.getElementById(`${prefix}-fUnivers`)?.value);
  pushSnapshotLine('Sculpteur', document.getElementById(`${prefix}-fSculpteur`)?.value);
  pushSnapshotLine('Échelles', echelles);
  pushSnapshotLine('Dimensions', dimensions);
  pushSnapshotLine('Pièces', document.getElementById(`${prefix}-fPieces`)?.value);
  pushSnapshotLine('Pose', document.getElementById(`${prefix}-fPose`)?.value);

  if (mode === 'tabletop') {
    pushSnapshotLine('Type', document.getElementById('tt-fType')?.value);
    pushSnapshotLine('Version', document.getElementById('tt-fVersion')?.value);
    pushSnapshotLine('Archétypes', typeof getArchetypes === 'function' ? getArchetypes() : '');
    pushSnapshotLine('Notes', document.getElementById('tt-fNotes')?.value);
  } else {
    pushSnapshotLine('Medium', collectionData.medium || (typeof getMediums === 'function' ? getMediums() : ''));
    pushSnapshotLine('Sous-catégories medium', collectionData.mediumSubcategories || collectionData.medium_subcategories || '');
    pushSnapshotLine('Genres transverses', collectionData.genresTransverses || collectionData.genres_transverses || collectionData.genres || '');
    pushSnapshotLine('Contexte medium', collectionData.mediumContext || collectionData.medium_context || '');
    pushSnapshotLine('License sensible', document.getElementById('col-fLicense')?.checked ? 'oui' : 'non');
    pushSnapshotLine('Particularités', document.getElementById('col-fParticularites')?.value);
    pushSnapshotLine('Description figurine', document.getElementById('col-fDescriptionFigurine')?.value);
    pushSnapshotLine('Résumé personnage', document.getElementById('col-fResumePersonnage')?.value);
    pushSnapshotLine('Connexes prioritaires', document.getElementById('col-fConnexesPrioritaires')?.value);
    pushSnapshotLine('Lien perso', document.getElementById('col-fLienPerso')?.value);
  }

  return lines.join('\n');
}

function getPipelineRunState(prefix) {
  state.pipelineRun = state.pipelineRun || {};
  state.pipelineRun[prefix] = state.pipelineRun[prefix] || {
    formSnapshot: '',
    warmupHint: '',
    cumulativeEntries: [],
    cumulativeText: '',
  };
  return state.pipelineRun[prefix];
}

function resetPipelineRunState(prefix) {
  const runState = getPipelineRunState(prefix);
  const warmupStepId = window.getPipelineWarmupStepId?.(getPipelineLaunchMode(prefix)) || 'marche';
  const formSnapshot = buildPipelineFormSnapshot(prefix);

  runState.formSnapshot = formSnapshot;
  runState.warmupHint = `Warmup compatible: préfixe stable avant ${warmupStepId}`;
  runState.cumulativeEntries = [];
  runState.cumulativeText = '';

  return runState;
}

function refreshPipelineRunCumulativeText(runState) {
  runState.cumulativeText = runState.cumulativeEntries
    .map((entry) => `## ${entry.agentId}\n${entry.content}`)
    .join('\n\n');
}

function appendPipelineRunEntry(prefix, agentId, content) {
  const trimmed = String(content || '').trim();
  if (!trimmed) return;

  const runState = getPipelineRunState(prefix);
  runState.cumulativeEntries.push({
    agentId,
    content: trimmed,
  });
  refreshPipelineRunCumulativeText(runState);
}

function setPipelineRunEntry(prefix, agentId, content) {
  const trimmed = String(content || '').trim();
  const runState = getPipelineRunState(prefix);
  runState.cumulativeEntries = runState.cumulativeEntries
    .filter((entry) => entry.agentId !== agentId);

  if (trimmed) {
    runState.cumulativeEntries.push({
      agentId,
      content: trimmed,
    });
  }

  refreshPipelineRunCumulativeText(runState);
}

if (typeof state !== 'undefined') {
  const prefixes = typeof getPipelinePrefixes === 'function' ? getPipelinePrefixes() : ['tt', 'col'];
  prefixes.forEach((prefix) => getPipelineRunState(prefix));
}

function getResolvedTargetStep(prefix) {
  const mode = getPipelineLaunchMode(prefix);

  if (typeof normalizePipelineTargetStepId === 'function') {
    return normalizePipelineTargetStepId(mode);
  }

  if (typeof getPipelineFinalTargetStepId === 'function') {
    return getPipelineFinalTargetStepId(mode);
  }

  return '';
}

if (typeof state !== 'undefined') refreshPipelineLaunchPanels();

function buildPipelineCacheAwareSharedBlocks(prefix) {
  const runState = getPipelineRunState(prefix);
  const formSnapshot = String(runState.formSnapshot || buildPipelineFormSnapshot(prefix) || '').trim();

  if (!formSnapshot) return [];

  return [{
    key: 'cache_aware_form_snapshot',
    text: `=== CONTEXTE FORMULAIRE STABLE ===\n${formSnapshot}`,
    cacheable: true,
  }];
}

function withPipelineCacheAwarePromptData(prefix, promptData, options = {}) {
  if (!promptData || typeof promptData === 'string') return promptData;

  const sharedBlocks = buildPipelineCacheAwareSharedBlocks(prefix);
  const runtimeSource = String(options.source || promptData.runtimeSource || 'pipeline');
  const promptChars = Number(promptData?.promptDebug?.promptChars) || String(promptData.filled || '').length;

  return {
    ...promptData,
    fixedContentBlocks: [
      ...sharedBlocks,
      ...(Array.isArray(promptData.fixedContentBlocks) ? promptData.fixedContentBlocks : []),
    ],
    runtimeSource,
    promptDebug: {
      ...(promptData.promptDebug || {}),
      promptChars,
      source: runtimeSource,
    },
  };
}

window.withPipelineCacheAwarePromptData = withPipelineCacheAwarePromptData;

function buildCacheAwarePrelaunchPromptData(prefix, firstAgent) {
  const ctx = buildCtx(firstAgent.id);
  const basePrompt = buildPrompt(firstAgent.id, ctx);
  const prelaunchFilled = [
    'PHASE TECHNIQUE — CACHE-AWARE PRÉ-PIPELINE',
    'Objectif : amorcer le préfixe commun stable partagé avant le pipeline standard.',
    'Réponds uniquement : CACHE_AWARE_READY',
  ].join('\n\n');

  return withPipelineCacheAwarePromptData(prefix, {
    filled: prelaunchFilled,
    fixedContent: basePrompt.fixedContent,
    fixedContentBlocks: Array.isArray(basePrompt.fixedContentBlocks) ? basePrompt.fixedContentBlocks : [],
    runtimeAgentId: CACHE_AWARE_RUNTIME_AGENT_ID,
    promptDebug: {
      ...(basePrompt.promptDebug || {}),
      promptChars: prelaunchFilled.length,
    },
  }, { source: 'cache-aware-prelaunch' });
}

async function runCacheAwarePrelaunch(prefix, pipelineAgents = []) {
  const firstAgent = pipelineAgents.find(Boolean);
  if (!firstAgent) return null;

  setPipelineLaunchState(prefix, {
    currentStepId: CACHE_AWARE_STEP_ID,
    isRunning: true,
    lastStatus: 'cache-aware pré-pipeline',
  });

  const promptData = buildCacheAwarePrelaunchPromptData(prefix, firstAgent);
  const response = await callClaude('cache_aware', promptData, shouldUseImagesForAgent(firstAgent));
  showAgentCost('cache_aware', response.usage || null, {
    prefix,
    source: 'cache-aware-prelaunch',
  });
  syncCacheIndicator(response.usage || null);

  return response;
}

async function runPipelineWithCacheAware(prefix) {
  const resolvedStepId = getResolvedTargetStep(prefix);
  const pipelineAgents = getPipelineRuntimeAgentsForTarget(prefix, resolvedStepId);

  resetPipelineRunState(prefix);
  beginCacheDebugRun(prefix, pipelineAgents, {
    launchScope: 'cache-aware pré-pipeline + pipeline complet',
    cacheAwareEnabled: true,
  });

  try {
    await runCacheAwarePrelaunch(prefix, pipelineAgents);
  } catch (error) {
    finalizeCacheDebugRun(prefix, 'erreur cache-aware');
    setPipelineLaunchState(prefix, {
      currentStepId: CACHE_AWARE_STEP_ID,
      isRunning: false,
      lastStatus: 'erreur cache-aware',
    });
    showToast(`❌ Cache-aware pré-pipeline: ${error.message}`, '#ff4757');
    return false;
  }

  return startPipeline(prefix, {
    skipCacheRunInit: true,
    preserveRunState: true,
    preserveCacheStatus: true,
  });
}

window.runPipelineWithCacheAware = runPipelineWithCacheAware;

function extractMarkdownSectionValue(rawText, sectionTitle) {
  const escapedTitle = String(sectionTitle || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionPattern = new RegExp(`^##\\s+${escapedTitle}\\s*$([\\s\\S]*?)(?=^##\\s+|$)`, 'im');
  const match = String(rawText || '').match(sectionPattern);

  return match ? match[1].trim() : '';
}

function extractAltFromAnalyseOutput(rawText) {
  const source = String(rawText || '');
  const sectionTitles = ['BALISE_ALT', 'BALISE ALT', 'ALT'];

  for (const title of sectionTitles) {
    const sectionValue = extractMarkdownSectionValue(source, title);
    if (sectionValue) return sectionValue;
  }

  const inlinePattern = /^(?:[-*]\s*)?(?:balise\s*alt|alt)\s*[:：-]\s*(.+)$/im;
  const inlineMatch = source.match(inlinePattern);
  return inlineMatch ? inlineMatch[1].trim() : '';
}

async function runCollectionIrisSemanticSearch() {
  const button = document.getElementById('runIrisBtn-col');
  const output = document.getElementById('out-iris-col');

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
    const rawFixed = prompt.fixedContent ? `── CACHE FIXE ──\n${prompt.fixedContent}\n\n── VARIABLE ──\n` : '';
    state.inputs.iris = rawFixed + prompt.filled;

    const response = await callClaude('iris', prompt, false);
    state.outputs.iris = response.text;
    showAgentCost('iris', response.usage || null, { prefix: 'col', source: 'iris' });
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

// ═══════════════════════════════════════════════════════════
// Cœur d'exécution agent par agent.
// Zone à haut risque : couplage fort entre état, prompts, DOM, orchestrateur et cartes UI.
// C'est l'une des dernières parties à découper, pas une cible de nettoyage opportuniste.

// RUN AGENT
// ═══════════════════════════════════════════════════════════
async function runAgent(agent, correction = '', isRetry = false) {
  const p = pfx();
  const card = document.getElementById(`${p}-card-${agent.id}`);
  const stat = document.getElementById(`${p}-stat-${agent.id}`);
  const out = document.getElementById(`${p}-out-${agent.id}`);
  const stopBtn = document.getElementById(`${p}-bstop-${agent.id}`);
  card.className = 'agent-card active';
  updatePipelineTimeline(agent.id, 'active');
  refreshSoloTabs(p);
  stat.className = 'agent-status s-run'; stat.textContent = '⟳ génération...';
  const ctxEl = document.getElementById('headerContext');
  if (ctxEl) ctxEl.textContent = agent.title.replace(/^[🔍🖼️📊🔖🏷️📝]/u,'').trim();
  if (out) {
    out.className = 'output-box';
    out.textContent = '';
  }
  if (stopBtn) stopBtn.style.display = 'inline-flex';
  if (!['analyse','alt','marche'].includes(agent.id)) openCard(`${p}-${agent.id}`);
  if (agent.hasSelection && !isRetry) {
    state.selectedAccroche = null; state.selectedCTA = null; state.selectedTitre = null; state.selectedTags = [];
    [`${p}-sel-${agent.id}`, `${p}-sel-accroche-${agent.id}`, `${p}-sel-cta-${agent.id}`].forEach(id => {
      const z = document.getElementById(id);
      if (!z) return;
      z.classList.remove('visible');
      if (agent.selectionType === 'tags' && id === `${p}-sel-${agent.id}`) {
        z.style.display = 'none';
        const runtimeRoot = document.getElementById(`${p}-sel-tags-runtime`);
        if (runtimeRoot) runtimeRoot.innerHTML = '';
        const validateBtn = document.getElementById(`${p}-validate-tags`);
        if (validateBtn) validateBtn.disabled = true;
        return;
      }
      const d = z.querySelector('[id]');
      if (d) d.innerHTML = '';
    });
  }
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

    if (!(agent.hasSelection && ['titre', 'tags'].includes(agent.id))) {
      appendPipelineRunEntry(p, agent.id, result);
    }

    if (currentMode === 'collection' && agent.id === 'analyse') {
      state.outputs.alt = extractAltFromAnalyseOutput(result);
      appendPipelineRunEntry(p, 'alt', state.outputs.alt);
    } else if (agent.id === 'alt') {
      appendPipelineRunEntry(p, 'alt', result);
    }

    if (out) out.textContent = result;
    showAgentCost(agent.id, usage, { prefix: p, source: isRetry ? 'rerun' : 'pipeline' });
    syncCacheIndicator(usage);
    if (state.orchestrateurActif) {
      stat.className = 'agent-status s-run'; stat.textContent = '🔍 audit...';
      const orchResult = await runOrchestrator(agent.id, result);
      showOrchestratorBadge(agent.id, orchResult);
      if (orchResult.statut === 'RELANCER' && (state.orchAttempts[agent.id] || 0) < 2) {
        stat.textContent = '⟳ relance...';
        const retryResult = await runAgent(agent, orchResult.correction, true);
        refreshSoloTabs(p);
        return retryResult;
      } else if (orchResult.statut === 'ALERTE') {
        card.className = 'agent-card error';
        stat.className = 'agent-status s-err'; stat.textContent = '❌ alerte';
        document.getElementById(`${p}-br-${agent.id}`).disabled = false;
        if (stopBtn) stopBtn.style.display = 'none';
        showToast(`❌ Alerte orchestrateur: ${agent.id}`, '#ff4757');
        refreshSoloTabs(p);
        return false;
      }
    }
    card.className = 'agent-card done';
    updatePipelineTimeline(agent.id, 'done');
    if (agent.hasSelection) {
      stat.className = 'agent-status s-run'; stat.textContent = '⏳ sélection requise';
      if (agent.selectionType === 'titre') buildTitreSelectionUI(agent.id, result);
      else if (agent.selectionType === 'tags') buildTagsUI(result);
      else buildAccrocheCTASelectionUI(agent.id, result);
    } else {
      stat.className = 'agent-status s-done'; stat.textContent = '✓ done';
    }
    document.getElementById(`${p}-br-${agent.id}`).disabled = false;
    document.getElementById(`${p}-bs-${agent.id}`).disabled = false;
    document.getElementById(`${p}-bp-${agent.id}`).disabled = false;
    if (agent.id === 'tags') { const bex = document.getElementById(`${p}-bexplore-tags`); if (bex) bex.disabled = false; }
    if (agent.id === 'titre') { const bex = document.getElementById(`${p}-bexplore-titre`); if (bex) bex.disabled = false; }
    if (stopBtn) stopBtn.style.display = 'none';
    refreshSoloTabs(p);
    return true;
  } catch (err) {
    if (out) out.textContent = `❌ ${err.message}`;
    card.className = 'agent-card error';
    updatePipelineTimeline(agent.id, 'error');
    stat.className = 'agent-status s-err';
    stat.textContent = err.message.includes('stoppée') ? '⏹ stoppé' : '✗ erreur';
    document.getElementById(`${p}-br-${agent.id}`).disabled = false;
    if (stopBtn) stopBtn.style.display = 'none';
    refreshSoloTabs(p);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// Contrôle global du pipeline unitaire.
// Ce bloc orchestre aussi les transitions de vues et les déplacements DOM vers la vue
// pipeline. Toute extraction future devra être testée visuellement sur TT et Collection.

// PIPELINE CONTROL
// ═══════════════════════════════════════════════════════════
async function startPipeline(p, _options = {}) {
  const skipCacheRunInit = Boolean(_options.skipCacheRunInit);
  const preserveRunState = Boolean(_options.preserveRunState);
  const preserveCacheStatus = Boolean(_options.preserveCacheStatus);
  const resolvedStepId = getResolvedTargetStep(p);
  const finalStepMeta = getPipelineTargetStepMetaForPrefix(p, resolvedStepId);
  const pipelineAgents = getPipelineRuntimeAgentsForTarget(p, resolvedStepId);
  const finalAgentId = finalStepMeta?.stopAfterAgentId || pipelineAgents[pipelineAgents.length - 1]?.id || '';
  const runtimeAgentIds = new Set(pipelineAgents.map((agent) => agent.id));
  const knownAgentIds = ['analyse', 'marche', 'titre', 'tags', 'description', 'alt'];
  const warningBox = document.getElementById(`imgWarning-${p}`);
  const btn = document.getElementById(`runBtn-${p}`);

  if (state.images[p].length === 0) {
    if (warningBox) warningBox.style.display = 'block';
    showToast('⚠️ Charge au moins une image !', '#ff4757');
    return;
  }

  if (warningBox) warningBox.style.display = 'none';
  if (!preserveCacheStatus) setLastCacheStatus('—');
  document.getElementById(`socialSection-${p}`).style.display = 'none';
  document.getElementById(`socialOutput-${p}`).style.display = 'none';
  document.getElementById(`reseauxOnlySection-${p}`).style.display = 'none';
  [`ss-insta-${p}`, `ss-fb-${p}`, `ss-marketplace-${p}`, `ss-pinterest-${p}`].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  state.socialSections = {};
  document.getElementById(`finalOutput-${p}`).style.display = 'none';
  [`fs-titre-${p}`, `fs-tags-${p}`, `fs-description-${p}`, `fs-alt-${p}`].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  ['titre_valide', 'description_assembled', 'tags', 'tags_raw', 'alt'].forEach((key) => {
    state.outputs[key] = '';
  });

  if (btn) {
    btn.disabled = true;
    btn.textContent = '⟳ Pipeline en cours...';
  }

  setPipelineLaunchState(p, {
    currentStepId: '',
    isRunning: true,
    lastStatus: 'en cours',
  });

  const isSoloTabsFlow = p === 'tt' || p === 'col';

  if (isSoloTabsFlow) {
    const pipelineEl = document.getElementById(`pipeline-${p}`);
    if (pipelineEl) pipelineEl.style.display = '';
    window.setPipelineExecutionActive?.(true);
    activateSoloTab(p, 'pipeline', { force: true });
    refreshSoloTabs(p);
    showView('form');
  } else {
    const pipelineBody = document.getElementById('pipelineViewBody');
    if (pipelineBody) {
      const pipelineEl = document.getElementById(`pipeline-${p}`);
      const finalEl = document.getElementById(`finalOutput-${p}`);
      if (pipelineEl) {
        pipelineEl.style.display = '';
        pipelineBody.appendChild(pipelineEl);
      }
      if (finalEl) pipelineBody.appendChild(finalEl);
      const socialSectionEl = document.getElementById(`socialSection-${p}`);
      if (socialSectionEl) pipelineBody.appendChild(socialSectionEl);
      const socialOutputEl = document.getElementById(`socialOutput-${p}`);
      if (socialOutputEl) pipelineBody.appendChild(socialOutputEl);
    }

    const titleEl = document.getElementById('pipelineViewTitle');
    if (titleEl) titleEl.textContent = currentMode === 'tabletop' ? '🎲 Pipeline Tabletop' : '🖼️ Pipeline Collection';

    const timeline = document.getElementById('pipelineTimeline');
    if (timeline) timeline.style.display = '';

    const ctx = document.getElementById('headerContext');
    if (ctx) {
      ctx.className = 'app-context mode-pipeline';
      ctx.textContent = '⟳ Pipeline en cours...';
    }
    buildPipelineTimeline();
    window.setPipelineExecutionActive?.(true);
    showView('pipeline');
  }

  state.selectedAccroche = null;
  state.selectedCTA = null;
  state.selectedTitre = null;
  state.selectedTags = [];
  Object.keys(state.orchAttempts).forEach((key) => delete state.orchAttempts[key]);
  state.outputs.iris = '';
  if (!preserveRunState) resetPipelineRunState(p);
  if (!skipCacheRunInit) {
    beginCacheDebugRun(p, pipelineAgents, {
      launchScope: 'pipeline complet',
      cacheAwareEnabled: false,
    });
  }

  knownAgentIds.forEach((agentId) => {
    state.outputs[agentId] = '';
    const card = document.getElementById(`${p}-card-${agentId}`);
    const stat = document.getElementById(`${p}-stat-${agentId}`);
    const out = document.getElementById(`${p}-out-${agentId}`);

    if (card) card.className = 'agent-card';
    if (card) card.style.display = runtimeAgentIds.has(agentId) ? '' : 'none';
    if (stat) {
      stat.className = 'agent-status s-wait';
      stat.textContent = 'en attente';
    }
    if (out) {
      out.className = 'output-box empty';
      out.textContent = '— pas encore généré —';
    }

    const br = document.getElementById(`${p}-br-${agentId}`);
    if (br) br.disabled = true;
    const bs = document.getElementById(`${p}-bs-${agentId}`);
    if (bs) bs.disabled = true;
    const bp = document.getElementById(`${p}-bp-${agentId}`);
    if (bp) bp.disabled = true;

    const ob = document.getElementById(`orch-badge-${agentId}`);
    if (ob) ob.remove();
    clearAgentFilesApiVisualState(p, agentId);
  });

  refreshSoloTabs(p);

  let hasError = false;
  let isSelectionPause = false;
  let lastCompletedAgentId = '';

  for (const agent of pipelineAgents) {
    setPipelineLaunchState(p, {
      currentStepId: getPipelineDisplayStepIdForRuntimeAgent(p, agent.id),
      isRunning: true,
      lastStatus: `en cours · ${getPipelineDisplayStepIdForRuntimeAgent(p, agent.id)}`,
    });

    const ok = await runAgent(agent);
    if (!ok) {
      hasError = true;
      break;
    }

    lastCompletedAgentId = agent.id;

    if (agent.hasSelection) {
      isSelectionPause = true;
      break;
    }

    if (agent.id === finalAgentId) break;
  }

  assembleFinal();

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '▶ Relancer tout';
  }

  window.setPipelineExecutionActive?.(false);

  const finalStatus = hasError
    ? 'erreur'
    : isSelectionPause
      ? 'en pause · sélection requise'
      : 'terminé';

  setPipelineLaunchState(p, {
    currentStepId: getPipelineDisplayStepIdForRuntimeAgent(p, lastCompletedAgentId || finalAgentId),
    isRunning: false,
    lastStatus: finalStatus,
  });
  finalizeCacheDebugRun(p, finalStatus);

  if (isSoloTabsFlow) {
    refreshSoloTabs(p);
    const hasResult = p === 'tt'
      ? window.isDndSoloResultAvailable?.()
      : window.isCollectionSoloResultAvailable?.();
    if (hasResult) {
      activateSoloTab(p, 'result', { force: true });
    } else {
      activateSoloTab(p, 'pipeline', { force: true });
    }
  }
}


// ═══════════════════════════════════════════════════════════
// RÈGLES PERSISTANTES
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// Runtime social encore hébergé ici.
// Découpage visé à terme : déplacer progressivement ces flows vers un module social dédié,
// après stabilisation et retest des sorties Instagram / Facebook / Marketplace / Pinterest.

// RÉSEAUX SOCIAUX
// ═══════════════════════════════════════════════════════════
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
    marche: '03 Luna — Analyse marché',
    description: '04 Eden — Description brute',
    description_assembled: '04b Description assemblée',
    analyse: '05 Jules — ALT finale (source)',
    alt: '05b Jules — Balise ALT finale',
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
      orchestrateur: 'QA Felix',
      cache_aware: '00 Cache-aware',
    },
    col: {
      titre: '01 Nova',
      titre_explorer: '01b Nova Explorer',
      tags: '02 Axel',
      marche: '03 Luna',
      description: '04 Eden',
      analyse: '05 Jules',
      alt: '05b Jules ALT',
      social: '06 Theo',
      camille: '07 Zoe',
      iris: 'Iris',
      orchestrateur: 'QA Rex',
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
  if (entry.source === 'orchestrateur' || entry.agentId === 'orchestrateur') return 'orchestrateur';
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
    orchestrateur: 'orchestrateur',
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
    orchestrateur: { count: 0, costCents: 0 },
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
  const orchestrateurState = categoryTotals.orchestrateur.count > 0
    ? `${categoryTotals.orchestrateur.count} appel(s)`
    : '0 appel (OFF ou non exécuté)';

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
    `Orchestrateur: ${categoryTotals.orchestrateur.costCents.toFixed(3)}¢ (${orchestrateurState})`,
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
