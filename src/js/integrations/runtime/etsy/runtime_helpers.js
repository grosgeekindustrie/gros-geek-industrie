(function initPipelineUIEtsyRuntimeHelpers(global) {
  'use strict';

  // Shared browser/runtime helpers reused by Etsy runtime modules.
  global.PipelineUI = global.PipelineUI || {};
  const EtsyRuntime = global.PipelineUIEtsyRuntime || {};

  function getNode(id) {
    return document.getElementById(id);
  }

  function getWorkspaceNodes(prefix) {
    return {
      panel: getNode(`etsyApiPanel-${prefix}`),
      input: getNode(`etsyApiListingRef-${prefix}`),
      uploadInput: getNode(`etsyApiUploadInput-${prefix}`),
      status: getNode(`etsyApiStatus-${prefix}`),
      summary: getNode(`etsyApiSummary-${prefix}`),
      strip: getNode(`etsyApiMediaStrip-${prefix}`),
      payload: getNode(`etsyApiPayload-${prefix}`),
    };
  }

  function ensureUploadInput(prefix, deps = {}) {
    const nodes = deps.getNodes?.(prefix) || getWorkspaceNodes(prefix);
    if (!nodes.panel) return null;
    if (nodes.uploadInput) return nodes.uploadInput;

    const input = document.createElement('input');
    input.type = 'file';
    input.id = `etsyApiUploadInput-${prefix}`;
    input.className = 'input-file-hidden';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    nodes.panel.appendChild(input);
    return input;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(String(event.target?.result || ''));
      reader.onerror = () => reject(new Error('Lecture image impossible'));
      reader.readAsDataURL(file);
    });
  }

  function loadImageFromDataUrl(dataUrl) {
    const helper = global.PipelineUIImageTools?.loadImageFromDataUrl;
    if (typeof helper === 'function') return helper(dataUrl);

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Chargement image impossible'));
      image.src = dataUrl;
    });
  }

  function getSortableCtor() {
    return global.Sortable || null;
  }

  function getFilerobotCtor() {
    return global.FilerobotImageEditor || null;
  }

  function getActiveEditorSession() {
    return global.PipelineUIEtsyWorkspace?.activeEditorSession || null;
  }

  function setActiveEditorSession(session) {
    global.PipelineUIEtsyWorkspace = global.PipelineUIEtsyWorkspace || {};
    global.PipelineUIEtsyWorkspace.activeEditorSession = session || null;
  }

  function getImageKey(image, index) {
    return `image:${String(image?.listing_image_id || image?.image_id || index)}`;
  }

  function getVideoKey(video, index) {
    return `video:${String(video?.video_id || video?.listing_video_id || index)}`;
  }

  function getLocalImageKey(image) {
    return `local-image:${String(image?.local_id)}`;
  }

  function getLocalVideoKey(video) {
    return `local-video:${String(video?.local_id)}`;
  }

  function getImageId(image, index) {
    return String(image?.listing_image_id || image?.image_id || index || '-');
  }

  function getVideoId(video, index) {
    return String(video?.video_id || video?.listing_video_id || index || '-');
  }

  function getVideoPreviewSource(video, isLocal) {
    if (isLocal) return String(video?.data_url || '');
    return String(video?.video_url || '');
  }

  function getImagePreviewSource(image, isLocal) {
    if (isLocal) return String(image?.data_url || '');
    return String(
      image?.url_fullxfull
      || image?.full_url
      || image?.url_570xN
      || image?.url_570xn
      || image?.src
      || image?.url
      || image?.url_170x135
      || image?.url_75x75
      || ''
    );
  }

  function getImageResolution(image) {
    return {
      width: Number(image?.full_width || image?.width || image?.original_width || image?.w || 0) || 0,
      height: Number(image?.full_height || image?.height || image?.original_height || image?.h || 0) || 0,
    };
  }

  function getVideoResolution(video) {
    return {
      width: Number(video?.width || video?.video_width || 0) || 0,
      height: Number(video?.height || video?.video_height || 0) || 0,
    };
  }

  function formatResolution({ width, height } = {}) {
    return width > 0 && height > 0 ? `${width} x ${height}` : '-';
  }

  function getPipelineSeedForEtsy(prefix) {
    const seed = global.readPipelineSeedSnapshot?.(prefix) || null;
    if (!seed || typeof seed !== 'object') return null;

    const title = String(seed.title || '').trim();
    const tagsCsv = String(seed.tagsCsv || '').trim();
    const descriptionText = String(seed.descriptionText || '').replace(/\r\n?/g, '\n');
    const altText = String(seed.altText || '').trim();
    if (!title && !tagsCsv && !descriptionText && !altText) return null;

    return {
      title,
      tagsCsv,
      descriptionText,
      altText,
      updatedAt: String(seed.updatedAt || '').trim(),
    };
  }

  global.PipelineUIEtsyRuntime = {
    ...EtsyRuntime,
    getNode,
    getWorkspaceNodes,
    ensureUploadInput,
    readFileAsDataUrl,
    loadImageFromDataUrl,
    getSortableCtor,
    getFilerobotCtor,
    getActiveEditorSession,
    setActiveEditorSession,
    getImageKey,
    getVideoKey,
    getLocalImageKey,
    getLocalVideoKey,
    getImageId,
    getVideoId,
    getImagePreviewSource,
    getVideoPreviewSource,
    getImageResolution,
    getVideoResolution,
    formatResolution,
    getPipelineSeedForEtsy,
  };
  global.PipelineUI.integrations = global.PipelineUI.integrations || {};
  global.PipelineUI.integrations.runtime = global.PipelineUIEtsyRuntime;
})(window);
