(function initPipelineUIIndexedDb(global) {
  'use strict';

  // IndexedDB local workspace.
  // Stockage persistant des images du workspace courant pour survivre aux refreshs,
  // fermetures navigateur et redémarrages machine.
  global.PipelineUI = global.PipelineUI || {};
  const sharedConstants = global.PipelineUISharedConstants || {};
  const logger = global.PipelineUILogger?.createLogger?.(sharedConstants.LOG_PREFIXES?.STORAGE || 'storage');

  const DB_NAME = 'etsy-pipeline-local';
  const DB_VERSION = 1;
  const WORKSPACE_STORE = 'imageWorkspaces';

  const writeQueues = new Map();

  const supportsIndexedDb = () => typeof global.indexedDB !== 'undefined';

  const getWorkspaceKey = (prefix) => {
    const path = global.location?.pathname || '/';
    return `${path}::${prefix}`;
  };

  const createImageId = () => {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();

    return `img_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  };

  const cloneCropRect = (cropRect) => {
    if (!cropRect || typeof cropRect !== 'object') return null;

    const x = Number(cropRect.x);
    const y = Number(cropRect.y);
    const width = Number(cropRect.width);
    const height = Number(cropRect.height);

    if (![x, y, width, height].every(Number.isFinite)) return null;

    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };
  };

  const normalizeImageRecord = (record, index = 0) => {
    const safeRecord = record && typeof record === 'object' ? record : {};
    const base64 = String(safeRecord.base64 || '');
    if (!base64) return null;

    const mediaType = String(safeRecord.mediaType || 'image/png');
    const originalBase64 = String(safeRecord.originalBase64 || base64);
    const originalMediaType = String(safeRecord.originalMediaType || mediaType);
    const width = Number(safeRecord.width) || null;
    const height = Number(safeRecord.height) || null;
    const originalWidth = Number(safeRecord.originalWidth) || width;
    const originalHeight = Number(safeRecord.originalHeight) || height;
    const contentHash = String(safeRecord.contentHash || '');
    const anthropicFileId = String(safeRecord.anthropicFileId || '');
    const anthropicContentHash = String(safeRecord.anthropicContentHash || '');
    const anthropicUploadedAt = String(safeRecord.anthropicUploadedAt || '');
    const aiAnalysisQuality = ['auto', 'economy', 'high'].includes(safeRecord.aiAnalysisQuality)
      ? safeRecord.aiAnalysisQuality
      : 'auto';
    const hasFreshAnthropicFile = Boolean(
      anthropicFileId
      && contentHash
      && anthropicContentHash === contentHash
    );

    return {
      id: String(safeRecord.id || createImageId()),
      name: String(safeRecord.name || `Image ${index + 1}`),
      base64,
      mediaType,
      width,
      height,
      originalBase64,
      originalMediaType,
      originalWidth,
      originalHeight,
      cropRect: cloneCropRect(safeRecord.cropRect),
      aiAnalysisQuality,
      contentHash,
      anthropicFileId: hasFreshAnthropicFile ? anthropicFileId : '',
      anthropicContentHash: hasFreshAnthropicFile ? anthropicContentHash : '',
      anthropicUploadedAt: hasFreshAnthropicFile ? anthropicUploadedAt : '',
    };
  };

  const serializeImages = (images) => {
    return (Array.isArray(images) ? images : [])
      .map((record, index) => normalizeImageRecord(record, index))
      .filter(Boolean);
  };

  const openDb = () => new Promise((resolve, reject) => {
    if (!supportsIndexedDb()) {
      reject(new Error('IndexedDB indisponible'));
      return;
    }

    const request = global.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
        db.createObjectStore(WORKSPACE_STORE, { keyPath: 'workspaceKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Ouverture IndexedDB impossible'));
  });

  const runStoreRequest = async ({ mode = 'readonly', handler }) => {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(WORKSPACE_STORE, mode);
      const store = transaction.objectStore(WORKSPACE_STORE);
      const request = handler(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Requête IndexedDB impossible'));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => reject(transaction.error || new Error('Transaction IndexedDB impossible'));
      transaction.onabort = () => reject(transaction.error || new Error('Transaction IndexedDB annulée'));
    });
  };

  const enqueueWrite = (workspaceKey, operation) => {
    const previous = writeQueues.get(workspaceKey) || Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(operation)
      .finally(() => {
        if (writeQueues.get(workspaceKey) === next) {
          writeQueues.delete(workspaceKey);
        }
      });

    writeQueues.set(workspaceKey, next);
    return next;
  };

  const saveWorkspaceImages = async (prefix, images) => {
    if (!supportsIndexedDb()) return [];

    const workspaceKey = getWorkspaceKey(prefix);
    const serializedImages = serializeImages(images);

    await enqueueWrite(workspaceKey, () => runStoreRequest({
      mode: 'readwrite',
      handler: (store) => store.put({
        workspaceKey,
        prefix,
        images: serializedImages,
        updatedAt: new Date().toISOString(),
      }),
    }));

    return serializedImages;
  };

  const loadWorkspaceImages = async (prefix) => {
    if (!supportsIndexedDb()) return [];

    const workspaceKey = getWorkspaceKey(prefix);
    const record = await runStoreRequest({
      handler: (store) => store.get(workspaceKey),
    });
    const serializedImages = serializeImages(record?.images || []);
    const rawImages = Array.isArray(record?.images) ? record.images : [];

    if (JSON.stringify(rawImages) !== JSON.stringify(serializedImages)) {
      await enqueueWrite(workspaceKey, () => runStoreRequest({
        mode: 'readwrite',
        handler: (store) => store.put({
          workspaceKey,
          prefix,
          images: serializedImages,
          updatedAt: new Date().toISOString(),
        }),
      }));
    }

    return serializedImages;
  };

  const restoreWorkspaceImages = async (prefix) => {
    const state = global.state;
    if (!state?.images?.[prefix]) return [];

    try {
      const restoredImages = await loadWorkspaceImages(prefix);
      if (!restoredImages.length) return [];

      state.images[prefix] = restoredImages;
      global.PipelineUIImages.renderThumbs(prefix);

      return restoredImages;
    } catch (error) {
      logger?.warn?.(`IndexedDB restore failed for ${prefix}`, error);
      return [];
    }
  };

  const clearWorkspaceImages = async (prefix) => {
    if (!supportsIndexedDb()) return;

    const workspaceKey = getWorkspaceKey(prefix);

    await enqueueWrite(workspaceKey, () => runStoreRequest({
      mode: 'readwrite',
      handler: (store) => store.delete(workspaceKey),
    }));
  };

  global.PipelineUIIndexedDb = {
    createImageId,
    normalizeImageRecord,
    saveWorkspaceImages,
    restoreWorkspaceImages,
    clearWorkspaceImages,
  };

  global.PipelineUI.db = global.PipelineUI.db || {};
  Object.assign(global.PipelineUI.db, global.PipelineUIIndexedDb);
})(window);
