'use strict';

(function initPipelineUIInstagram(global) {
  global.PipelineUI = global.PipelineUI || {};

  const DRAFT_KEY = 'instagram-studio-draft-v1';
  const AGENT_ID = 'instagram';
  const PROMPT_SPEC_ID = 'instagram-publisher';
  const PROMPT_STATE_KEY = 'instagramPublisher';
  const PROMPT_PATH = 'prompts/instagram/instagram.md';
  const SHOP_URLS = Object.freeze({
    grosgeek: 'https://grosgeekindustrie.etsy.com',
    doublex: 'https://doublexindustrie.etsy.com',
  });
  const SHOP_LABELS = Object.freeze({
    grosgeek: 'Gros Geek Industrie',
    doublex: 'Double X Industrie',
  });
  const RATIOS = Object.freeze({
    original: { label: 'Original', value: null, className: 'ratio-original' },
    '1:1': { label: '1:1', value: 1, className: 'ratio-square' },
    '4:5': { label: '4:5', value: 4 / 5, className: 'ratio-portrait' },
    '16:9': { label: '16:9', value: 16 / 9, className: 'ratio-landscape' },
  });

  let sculptorLibraryPromise = null;

  const state = {
    configured: false,
    connected: false,
    busy: false,
    profile: null,
    shopKey: 'grosgeek',
    listingId: '',
    listing: null,
    rawPayload: null,
    images: [],
    video: null,
    mode: 'carousel',
    ratio: 'original',
    referenceId: '',
    activeMediaId: '',
    sortable: null,
    draftAltById: {},
    draftImageOrder: [],
    draftListingId: '',
    activeStep: 'source',
    agentRunning: false,
    publishing: false,
    preparedPublication: null,
    lastAgentRaw: '',
    sculptors: [],
  };

  const getElement = (id) => document.getElementById(id);
  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const readJson = async (response) => {
    let payload = {};
    try {
      payload = await response.json();
    } catch (error) {}

    if (!response.ok) throw new Error(payload.error || ('Erreur HTTP ' + response.status));
    return payload;
  };

  const requestJson = async (url, options = {}) => readJson(await fetch(url, options));

  const setStateLabel = (message, type = '') => {
    const element = getElement('instagramTestState');
    if (!element) return;
    element.textContent = message;
    element.className = 'instagram-state';
    if (type) element.classList.add('is-' + type);
  };

  const setListingStatus = (message, type = '') => {
    const element = getElement('instagramListingStatus');
    if (!element) return;
    element.textContent = message;
    element.className = 'instagram-inline-status';
    if (type) element.classList.add('is-' + type);
  };

  const setResult = (message = '', type = '') => {
    const element = getElement('instagramPublishResult');
    if (!element) return;
    element.textContent = message;
    element.className = 'instagram-result';
    if (type) element.classList.add('is-' + type);
  };

  const copyInstagramField = async (fieldId, buttonId, label) => {
    const field = getElement(fieldId);
    const button = getElement(buttonId);
    const value = String(field?.value || '').trim();
    if (!value) {
      global.showToast?.(label + ' vide', '#f0b35d');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      if (button) button.textContent = 'Copié ✓';
      global.showToast?.(label + ' copié');
      global.setTimeout(() => {
        if (button) button.textContent = 'Copier';
      }, 1400);
    } catch (error) {
      global.showToast?.('Impossible de copier ' + label.toLowerCase(), '#ff4757');
    }
  };

  const getActiveShopKey = () => (
    global.PipelineUIApp?.getActiveShopKey?.() === 'doublex' ? 'doublex' : 'grosgeek'
  );

  const getImageUrl = (image = {}) => String(
    image.url_fullxfull
    || image.url_570xN
    || image.url_570xn
    || image.url_170x135
    || image.full_url
    || image.src
    || image.url
    || ''
  ).trim();

  const normalizeSculptorKey = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const parseSculptorLibrary = (text = '') => String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [name = '', handle = '', aliases = ''] = line.split('|').map((part) => part.trim());
      return {
        name,
        handle: handle && !handle.startsWith('@') ? '@' + handle : handle,
        keys: [name, ...aliases.split(',')].map(normalizeSculptorKey).filter(Boolean),
      };
    })
    .filter((entry) => entry.name);

  const loadSculptorLibrary = async () => {
    if (state.sculptors.length) return state.sculptors;
    if (!sculptorLibraryPromise) {
      sculptorLibraryPromise = fetch('/files/biblios/instagram/sculpteurs.md')
        .then((response) => {
          if (!response.ok) throw new Error('Bibliothèque des sculpteurs indisponible.');
          return response.text();
        })
        .then((text) => {
          state.sculptors = parseSculptorLibrary(text);
          return state.sculptors;
        })
        .finally(() => {
          sculptorLibraryPromise = null;
        });
    }
    return sculptorLibraryPromise;
  };

  const resolveSculptorEntry = (name = '') => {
    const key = normalizeSculptorKey(name);
    return state.sculptors.find((entry) => entry.keys.includes(key)) || null;
  };

  const extractSculptorName = (description = '') => {
    const match = String(description || '').match(/Sculpt[ée]\s+par\s*:\s*([^\n<]+)/i);
    return String(match?.[1] || '').trim().replace(/[. ]+$/, '');
  };

  const syncSculptorFields = (name = '', { preserveHandle = false } = {}) => {
    const nameInput = getElement('instagramSculptorName');
    const handleInput = getElement('instagramSculptorHandle');
    const help = getElement('instagramSculptorHelp');
    const resolvedName = String(name || nameInput?.value || '').trim();
    const entry = resolveSculptorEntry(resolvedName);
    if (nameInput && name) nameInput.value = resolvedName;
    if (handleInput && (!preserveHandle || !handleInput.value.trim())) {
      handleInput.value = entry?.handle || '';
    }
    if (help) {
      help.textContent = entry?.handle
        ? 'Compte vérifié dans la bibliothèque locale : ' + entry.handle
        : resolvedName
          ? 'Sculpteur détecté, mais aucun @compte vérifié : complète-le avant la génération si nécessaire.'
          : 'Aucun sculpteur détecté dans la fiche.';
      help.classList.toggle('is-warning', Boolean(resolvedName && !entry?.handle));
    }
  };

  const saveSculptorToLibrary = async () => {
    const button = getElement('instagramSaveSculptorBtn');
    const help = getElement('instagramSculptorHelp');
    const name = String(getElement('instagramSculptorName')?.value || '').trim();
    let handle = String(getElement('instagramSculptorHandle')?.value || '').trim();
    if (handle && !handle.startsWith('@')) handle = '@' + handle;
    if (!name || !/^@[A-Za-z0-9._]{1,30}$/.test(handle)) {
      if (help) {
        help.textContent = 'Renseigne un nom et un @compte Instagram valide avant d’enregistrer.';
        help.classList.add('is-warning');
      }
      return;
    }

    if (button) button.disabled = true;
    try {
      const path = '/files/biblios/instagram/sculpteurs.md';
      const response = await fetch(path + '?v=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de lire la bibliothèque des sculpteurs.');
      const current = await response.text();
      const lines = current.replace(/\r\n?/g, '\n').split('\n');
      const wantedKey = normalizeSculptorKey(name);
      const index = lines.findIndex((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return false;
        const [entryName = '', , aliases = ''] = trimmed.split('|').map((part) => part.trim());
        return [entryName, ...aliases.split(',')].map(normalizeSculptorKey).includes(wantedKey);
      });
      if (index >= 0) {
        const [, , aliases = ''] = lines[index].split('|').map((part) => part.trim());
        lines[index] = name + ' | ' + handle + ' | ' + aliases;
      } else {
        if (lines.length && lines[lines.length - 1].trim()) lines.push('');
        lines.push(name + ' | ' + handle + ' |');
      }
      const updated = lines.join('\n').replace(/\n*$/, '\n');
      const saveResponse = await fetch(path, { method: 'PUT', body: updated });
      if (!saveResponse.ok) {
        const payload = await saveResponse.json().catch(() => ({}));
        throw new Error(payload.error || 'Impossible d’enregistrer le sculpteur.');
      }
      state.sculptors = parseSculptorLibrary(updated);
      getElement('instagramSculptorHandle').value = handle;
      syncSculptorFields(name, { preserveHandle: true });
      saveDraft();
      global.showToast?.(name + ' enregistré dans la bibliothèque');
    } catch (error) {
      if (help) {
        help.textContent = error.message;
        help.classList.add('is-warning');
      }
    } finally {
      if (button) button.disabled = false;
    }
  };

  const getTemplateBlockTitles = () => {
    const templates = global.PipelineUIDataDescriptionTemplates || {};
    const titles = new Set();
    const collectBlock = (block) => {
      const firstLine = String(block || '').replace(/\r\n?/g, '\n').split('\n').find((line) => line.trim());
      if (firstLine) titles.add(firstLine.trim());
    };
    const collectFamilyMap = (familyMap) => {
      Object.values(familyMap || {}).forEach((languages) => {
        Object.values(languages || {}).forEach((blocks) => {
          (Array.isArray(blocks) ? blocks : []).forEach(collectBlock);
        });
      });
    };

    collectFamilyMap(templates.INTRO_FIXED_BLOCKS_BY_FAMILY_AND_LANGUAGE);
    collectFamilyMap(templates.FIXED_BLOCKS_BY_FAMILY_AND_LANGUAGE);
    (Array.isArray(templates.CLIENT_INFORMATION_BLOCKS) ? templates.CLIENT_INFORMATION_BLOCKS : []).forEach(collectBlock);
    collectBlock(templates.EXPERIENCE_BLOCK);
    collectBlock((Array.isArray(templates.WHAT_YOU_RECEIVE_LINES) ? templates.WHAT_YOU_RECEIVE_LINES : []).join('\n'));
    return titles;
  };

  const cleanDescription = (value = '') => {
    const source = String(value || '').replace(/\r\n?/g, '\n').trim();
    if (!source) return { description: '', removedBlocks: 0 };

    const blockTitles = getTemplateBlockTitles();
    const blocks = source.split(/\n{3,}/).map((block) => block.trim()).filter(Boolean);
    const keptBlocks = [];
    let removedBlocks = 0;

    blocks.forEach((block) => {
      const firstLine = block.split('\n').find((line) => line.trim())?.trim() || '';
      const isEditorialCredit = /^(?:🎭\s*)?Fan Art et artiste\s*:/i.test(firstLine);
      if (blockTitles.has(firstLine) || isEditorialCredit) {
        removedBlocks += 1;
        return;
      }
      keptBlocks.push(block);
    });

    let description = keptBlocks.join('\n\n\n\n').trim();
    const assembly = global.PipelineUIDescriptionAssembly;
    if (assembly?.stripDecorativeFixedBlocks) {
      const families = state.shopKey === 'doublex'
        ? ['collection_doublex', 'tabletop_doublex', 'collection', 'tabletop']
        : ['collection', 'tabletop'];
      let best = { description, removed: 0 };
      families.forEach((family) => {
        const result = assembly.stripDecorativeFixedBlocks(description, family, 'fr');
        const candidate = String(result?.description ?? description).trim();
        const removed = result?.stripped ? Math.max(1, description.length - candidate.length) : 0;
        if (removed > best.removed) best = { description: candidate, removed };
      });
      if (best.removed) {
        description = best.description;
        removedBlocks += 1;
      }
    }

    return {
      description: description.replace(/\n{5,}/g, '\n\n\n\n').trim(),
      removedBlocks,
    };
  };

  const autoGrowTextarea = (textarea, expand = false) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    const minimum = textarea.id === 'instagramSourceTitle' ? 64 : 210;
    const target = expand ? textarea.scrollHeight : Math.min(textarea.scrollHeight, 360);
    textarea.style.height = Math.max(minimum, target) + 'px';
    textarea.classList.toggle('is-expanded', expand);
  };
  const loadImageDimensions = (media) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      media.width = image.naturalWidth;
      media.height = image.naturalHeight;
      resolve(media);
    };
    image.onerror = () => resolve(media);
    image.src = media.url;
  });

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });

  const dataUrlParts = (dataUrl = '') => {
    const match = String(dataUrl).match(/^data:([^;,]+);base64,(.+)$/);
    return match ? { mediaType: match[1], base64: match[2] } : null;
  };

  const normalizeImages = (images = []) => images
    .map((image, index) => {
      const id = String(image?.listing_image_id || image?.image_id || ('etsy-image-' + (index + 1)));
      return {
        id,
        url: getImageUrl(image),
        name: 'Image Etsy ' + (index + 1),
        altText: String(state.draftAltById[id] ?? image?.alt_text ?? ''),
        width: Number(image?.full_width || image?.width) || null,
        height: Number(image?.full_height || image?.height) || null,
        source: 'etsy',
      };
    })
    .filter((image) => image.url);

  const getFirstRatio = () => {
    const first = state.images[0];
    return first?.width && first?.height ? first.width / first.height : 1;
  };

  const getFrameRatio = () => RATIOS[state.ratio]?.value || getFirstRatio();

  const getMediaById = (id) => state.images.find((media) => media.id === id) || null;

  const saveDraft = () => {
    const altById = Object.fromEntries(state.images.map(({ id, altText }) => [id, altText || '']));
    const draft = {
      shopKey: state.shopKey,
      listingId: String(getElement('instagramListingId')?.value || ''),
      title: String(getElement('instagramSourceTitle')?.value || ''),
      description: String(getElement('instagramSourceDescription')?.value || ''),
      caption: String(getElement('instagramCaption')?.value || ''),
      firstComment: String(getElement('instagramFirstComment')?.value || ''),
      threadsText: String(getElement('instagramThreadsText')?.value || ''),
      correction: String(getElement('instagramAgentCorrection')?.value || ''),
      sculptorName: String(getElement('instagramSculptorName')?.value || ''),
      sculptorHandle: String(getElement('instagramSculptorHandle')?.value || ''),
      mode: state.mode,
      ratio: state.ratio,
      referenceId: state.referenceId,
      imageOrder: state.images.map(({ id }) => id),
      altById,
    };

    try {
      global.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (error) {}
  };

  const restoreDraft = () => {
    let draft = {};
    try {
      draft = JSON.parse(global.localStorage.getItem(DRAFT_KEY) || '{}');
    } catch (error) {}

    state.shopKey = draft.shopKey === 'doublex' ? 'doublex' : getActiveShopKey();
    state.mode = draft.mode === 'reel' ? 'reel' : 'carousel';
    state.ratio = RATIOS[draft.ratio] ? draft.ratio : 'original';
    state.referenceId = String(draft.referenceId || '');
    state.draftImageOrder = Array.isArray(draft.imageOrder) ? draft.imageOrder.map(String) : [];
    state.draftListingId = String(draft.listingId || '');
    state.draftAltById = draft.altById && typeof draft.altById === 'object' ? draft.altById : {};

    const values = {
      instagramListingId: draft.listingId,
      instagramSourceTitle: draft.title,
      instagramSourceDescription: draft.description,
      instagramCaption: draft.caption,
      instagramFirstComment: draft.firstComment,
      instagramThreadsText: draft.threadsText,
      instagramAgentCorrection: draft.correction,
      instagramSculptorName: draft.sculptorName,
      instagramSculptorHandle: draft.sculptorHandle,
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = getElement(id);
      if (element && value) element.value = value;
    });
  };

  const syncChoiceButtons = (containerId, dataName, value) => {
    getElement(containerId)?.querySelectorAll('[data-' + dataName + ']').forEach((button) => {
      const active = button.dataset[dataName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] === value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-checked', String(active));
    });
  };

  const syncShopPicker = () => syncChoiceButtons('instagramShopPicker', 'instagram-shop', state.shopKey);
  const syncModePicker = () => syncChoiceButtons('instagramModePicker', 'instagram-mode', state.mode);

  const syncRatioPicker = () => {
    const option = RATIOS[state.ratio] || RATIOS.original;
    const label = getElement('instagramRatioLabel');
    const icon = getElement('instagramRatioIcon');
    if (label) label.textContent = option.label;
    if (icon) icon.className = 'instagram-ratio-icon ' + option.className;
    getElement('instagramRatioMenu')?.querySelectorAll('[data-instagram-ratio]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.instagramRatio === state.ratio);
    });
  };

  const syncImageOrderFromDom = () => {
    const grid = getElement('instagramMediaGrid');
    if (!grid) return;
    const ids = [...grid.querySelectorAll('[data-instagram-media-id]')]
      .map((card) => card.dataset.instagramMediaId);
    const byId = new Map(state.images.map((media) => [media.id, media]));
    state.images = ids.map((id) => byId.get(id)).filter(Boolean);
    renderMedia();
    saveDraft();
  };

  const initializeSortable = () => {
    state.sortable?.destroy?.();
    state.sortable = null;
    const grid = getElement('instagramMediaGrid');
    if (!grid || state.mode !== 'carousel' || state.images.length < 2 || typeof global.Sortable !== 'function') return;
    state.sortable = new global.Sortable(grid, {
      animation: 180,
      ghostClass: 'instagram-sort-ghost',
      handle: '.instagram-media-card',
      filter: 'button',
      preventOnFilter: false,
      onEnd: syncImageOrderFromDom,
    });
  };

  const renderVideo = () => {
    const stage = getElement('instagramVideoStage');
    if (!stage) return;
    stage.hidden = state.mode !== 'reel';
    if (state.mode !== 'reel') return;

    if (!state.video) {
      stage.innerHTML = '<div class="instagram-empty-media"><strong>Dépose une vidéo</strong><span>MP4 ou MOV · 1 Go maximum · le ratio natif est conservé.</span></div>';
      return;
    }

    stage.innerHTML = `
      <article class="instagram-video-card">
        <video src="${escapeHtml(state.video.url)}" controls preload="metadata"></video>
        <div>
          <strong>${escapeHtml(state.video.name)}</strong>
          <span>${state.video.width || '?'} × ${state.video.height || '?'} px · ${(state.video.size / (1024 * 1024)).toFixed(1)} Mo</span>
          <button class="btn btn-muted" type="button" data-instagram-remove-video>Retirer</button>
        </div>
      </article>
    `;
  };

  const renderMedia = () => {
    const grid = getElement('instagramMediaGrid');
    const empty = getElement('instagramEmptyMedia');
    const count = getElement('instagramMediaCount');
    const rule = getElement('instagramMediaRule');
    const ratioControl = getElement('instagramRatioControl');
    if (!grid || !empty || !count || !rule) return;

    const carousel = state.mode === 'carousel';
    grid.hidden = !carousel;
    empty.hidden = !carousel || state.images.length > 0;
    ratioControl?.toggleAttribute('hidden', !carousel);
    count.textContent = carousel
      ? state.images.length + ' image' + (state.images.length > 1 ? 's' : '')
      : (state.video ? '1 vidéo' : '0 vidéo');
    rule.textContent = carousel
      ? 'Carrousel : 2 à 10 images. Glisse pour changer l’ordre.'
      : 'Reel : une vidéo, ratio natif conservé, 1 Go maximum.';

    if (carousel) {
      const frameRatio = getFrameRatio();
      grid.style.setProperty('--instagram-frame-ratio', String(frameRatio || 1));
      grid.innerHTML = state.images.map((media, index) => `
        <article class="instagram-media-card${state.referenceId === media.id ? ' is-reference' : ''}" data-instagram-media-id="${escapeHtml(media.id)}" tabindex="0">
          <div class="instagram-media-frame">
            <img src="${escapeHtml(media.url)}" alt="${escapeHtml(media.altText || ('Image ' + (index + 1)))}" loading="lazy">
          </div>
          <button class="instagram-reference-check${state.referenceId === media.id ? ' is-checked' : ''}" type="button" data-instagram-reference-media="${escapeHtml(media.id)}" aria-pressed="${state.referenceId === media.id}" aria-label="${state.referenceId === media.id ? 'Image envoyée à l’agent' : 'Envoyer cette image à l’agent'}"><span>✓</span></button>
          <span class="instagram-media-position">${String(index + 1).padStart(2, '0')}</span>
          ${state.referenceId === media.id ? '<span class="instagram-reference-badge">Agent</span>' : ''}
          <button class="instagram-media-remove" type="button" data-instagram-remove-media="${escapeHtml(media.id)}" aria-label="Retirer cette image">×</button>
        </article>
      `).join('');
    }

    renderVideo();
    initializeSortable();
    syncSummaries();
    syncPreflight();
  };

  const syncSummaries = () => {
    const sourceSummary = getElement('instagramSourceSummary');
    const mediaSummary = getElement('instagramMediaSummary');
    const copySummary = getElement('instagramCopySummary');
    const captionLength = String(getElement('instagramCaption')?.value || '').length;

    if (sourceSummary) sourceSummary.textContent = state.listing
      ? SHOP_LABELS[state.shopKey] + ' · fiche ' + state.listingId
      : 'Choisir une boutique et charger une fiche';
    if (mediaSummary) mediaSummary.textContent = state.mode === 'carousel'
      ? state.images.length + ' image' + (state.images.length > 1 ? 's' : '') + ' · ' + RATIOS[state.ratio].label
      : (state.video ? state.video.name : 'Aucune vidéo');
    if (copySummary) copySummary.textContent = captionLength
      ? captionLength + ' caractères · premier commentaire ' + (getElement('instagramFirstComment')?.value.trim() ? 'prêt' : 'vide')
      : 'Rédaction manuelle pour ce premier jet';
  };

  const countTextCharacters = (value = '') => Array.from(String(value || '')).length;

  const getReadiness = () => {
    const mediaReady = state.mode === 'carousel'
      ? state.images.length >= 2 && state.images.length <= 10
      : Boolean(state.video && state.video.size <= 1024 * 1024 * 1024);
    const caption = String(getElement('instagramCaption')?.value || '').trim();
    const generationReady = Boolean(caption) && countTextCharacters(caption) <= 2200;
    return {
      source: Boolean(state.listing),
      media: mediaReady,
      generation: generationReady,
      review: Boolean(state.listing && mediaReady && generationReady),
    };
  };

  const showStep = (step = 'source') => {
    const target = ['source', 'media', 'generation', 'review'].includes(step) ? step : 'source';
    state.activeStep = target;
    document.querySelectorAll('[data-instagram-screen]').forEach((screen) => {
      const active = screen.dataset.instagramScreen === target;
      screen.hidden = !active;
      screen.classList.toggle('is-active', active);
    });
    syncProgress();
    if (target === 'source') {
      autoGrowTextarea(getElement('instagramSourceTitle'));
      autoGrowTextarea(getElement('instagramSourceDescription'));
    }
    if (target === 'media') renderMedia();
    if (target === 'generation') renderAgentInput();
    if (target === 'review') renderReviewPreview();
  };

  const syncProgress = () => {
    const completed = getReadiness();
    document.querySelectorAll('[data-instagram-step-target]').forEach((button) => {
      const key = button.dataset.instagramStepTarget;
      button.classList.toggle('is-complete', completed[key]);
      button.classList.toggle('is-active', key === state.activeStep);
    });
  };

  const buildAgentInput = () => {
    const reference = getMediaById(state.referenceId);
    return {
      shop: {
        key: state.shopKey,
        label: SHOP_LABELS[state.shopKey],
        url: SHOP_URLS[state.shopKey],
      },
      listing: {
        id: state.listingId,
        title: String(getElement('instagramSourceTitle')?.value || '').trim(),
        description: String(getElement('instagramSourceDescription')?.value || '').trim(),
      },
      sculptor: {
        name: String(getElement('instagramSculptorName')?.value || '').trim(),
        handle: (() => {
          const handle = String(getElement('instagramSculptorHandle')?.value || '').trim();
          return handle && !handle.startsWith('@') ? '@' + handle : handle;
        })(),
      },
      publication: {
        type: state.mode,
        ratio: state.mode === 'carousel' ? state.ratio : 'native',
        mediaCount: state.mode === 'carousel' ? state.images.length : (state.video ? 1 : 0),
        userCorrection: String(getElement('instagramAgentCorrection')?.value || '').trim(),
      },
      referenceImage: reference ? {
        id: reference.id,
        name: reference.name,
        altText: reference.altText || '',
        source: reference.source,
        url: reference.source === 'etsy' ? reference.url : '[fichier local]',
      } : null,
    };
  };

  const getCustomPromptState = () => {
    global.state.customPrompts = global.state.customPrompts || {};
    return global.state.customPrompts;
  };

  const loadAgentPrompt = async () => {
    const response = await fetch('/files/' + PROMPT_PATH + '?v=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Prompt Instagram introuvable.');
    }
    const prompt = await response.text();
    getCustomPromptState()[PROMPT_STATE_KEY] = prompt;
    return prompt;
  };

  const replacePromptValue = (prompt, placeholder, value) => (
    prompt.split('[[' + placeholder + ']]').join(String(value ?? ''))
  );

  const buildAgentPrompt = (template) => {
    const source = buildAgentInput();
    const replacements = {
      SHOP_NAME: source.shop.label,
      SHOP_URL: source.shop.url,
      ETSY_LISTING_ID: source.listing.id,
      TITLE: source.listing.title,
      DESCRIPTION: source.listing.description,
      SCULPTOR_NAME: source.sculptor.name || 'Non renseigné',
      SCULPTOR_HANDLE: source.sculptor.handle,
      MEDIA_TYPE: source.publication.type === 'reel' ? 'Reel vidéo' : 'Carrousel d’images',
      MEDIA_RATIO: source.publication.ratio,
      MEDIA_COUNT: source.publication.mediaCount,
      CORRECTION: source.publication.userCorrection || 'Aucune consigne complémentaire.',
    };
    return Object.entries(replacements).reduce(
      (prompt, [placeholder, value]) => replacePromptValue(prompt, placeholder, value),
      template,
    );
  };

  const normalizeCopyText = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const findCopiedSourceSequence = (caption = '', wordCount = 12) => {
    const sourceWords = normalizeCopyText(getElement('instagramSourceDescription')?.value || '').split(' ').filter(Boolean);
    const normalizedCaption = ' ' + normalizeCopyText(caption) + ' ';
    for (let index = 0; index <= sourceWords.length - wordCount; index += 1) {
      const sequence = sourceWords.slice(index, index + wordCount).join(' ');
      if (sequence && normalizedCaption.includes(' ' + sequence + ' ')) return sequence;
    }
    return '';
  };

  const parseAgentOutput = (rawOutput = '') => {
    const fence = String.fromCharCode(96).repeat(3);
    let cleaned = String(rawOutput || '').trim();
    if (cleaned.startsWith(fence)) cleaned = cleaned.slice(cleaned.indexOf('\n') + 1);
    if (cleaned.endsWith(fence)) cleaned = cleaned.slice(0, -fence.length).trim();
    const parsed = JSON.parse(cleaned);
    const caption = String(parsed?.caption || '').trim();
    const firstComment = String(parsed?.first_comment || parsed?.firstComment || '').trim();
    const threadsText = String(parsed?.threads_text || parsed?.threadsText || '').trim();
    const shopUrl = SHOP_URLS[state.shopKey];
    const frenchHeader = '🛒🔗 Disponible en boutique\n👉 ' + shopUrl;
    const englishHeader = '🛒🔗 Available in shop\n👉 ' + shopUrl;
    const separator = '━━━━━━━━━━━━━━━';
    if (!caption) throw new Error('La sortie JSON ne contient aucune légende.');
    const warnings = [];
    if (!threadsText) warnings.push('texte Threads absent');
    if (!caption.startsWith(frenchHeader)) warnings.push('bloc boutique français absent du début');
    if (!caption.includes(separator + '\n\n' + englishHeader)) warnings.push('bloc anglais ou séparateur incorrect');
    if (/Boutique Etsy\s*:/i.test(caption)) warnings.push('ancien format « Boutique Etsy » détecté');
    if (countTextCharacters(caption) > 2100) warnings.push('légende supérieure à la limite interne de 2 100 caractères');
    const hashtags = caption.match(/#[\p{L}\p{N}_]+/gu) || [];
    const lastLine = caption.split('\n').map((line) => line.trim()).filter(Boolean).at(-1) || '';
    const lastLineHashtags = lastLine.match(/#[\p{L}\p{N}_]+/gu) || [];
    if (hashtags.length < 5 || hashtags.length > 6 || lastLineHashtags.length !== hashtags.length) {
      warnings.push('les 5 ou 6 hashtags ne sont pas tous placés sur la dernière ligne');
    }
    if (firstComment.includes('#')) warnings.push('hashtags présents dans le premier commentaire');
    const firstCommentLength = countTextCharacters(firstComment);
    if (firstCommentLength < 500 || firstCommentLength > 1000) warnings.push('premier commentaire hors de la plage de 500 à 1 000 caractères');
    const threadsLength = countTextCharacters(threadsText);
    if (threadsLength < 420 || threadsLength > 500) warnings.push('texte Threads hors de la plage de 420 à 500 caractères');
    if (threadsText.includes('#')) warnings.push('hashtag interdit dans le texte Threads');
    if (!threadsText.startsWith(englishHeader)) warnings.push('bloc boutique anglais absent du début du texte Threads');
    if ([caption, firstComment, threadsText].some((value) => value.includes('—'))) warnings.push('tiret cadratin interdit');
    const commentHeader = '🛒🔗 Disponible en boutique / Available in shop\n👉 ' + shopUrl;
    const commentShopUrlCount = firstComment.split(shopUrl).length - 1;
    if (!firstComment.startsWith(commentHeader) || !firstComment.includes('\n\n' + separator + '\n\n') || commentShopUrlCount !== 1) {
      warnings.push('premier commentaire non bilingue ou séparateur manquant');
    }
    const handle = String(getElement('instagramSculptorHandle')?.value || '').trim();
    const sculptorCredit = handle || String(getElement('instagramSculptorName')?.value || '').trim();
    if (sculptorCredit) {
      const creditCount = caption.split(sculptorCredit).length - 1;
      const captionParts = caption.split(separator);
      const frenchCredit = 'Sculpté par : ' + sculptorCredit;
      const englishCredit = 'Sculpted by: ' + sculptorCredit;
      if (creditCount !== 2 || !captionParts[0]?.includes(frenchCredit) || !captionParts[1]?.includes(englishCredit)) {
        warnings.push('le crédit sculpteur doit être en français dans la partie française et en anglais dans la partie anglaise');
      }
      if (threadsText.toLocaleLowerCase().includes(sculptorCredit.toLocaleLowerCase())) warnings.push('le sculpteur ne doit pas être cité dans le texte Threads');
    }
    if (findCopiedSourceSequence(caption)) warnings.push('reprise trop proche de la description source');
    return { caption, firstComment, threadsText, warnings };
  };

  const setAgentState = (message, type = '') => {
    const badge = document.querySelector('.instagram-agent-state');
    if (!badge) return;
    badge.textContent = message;
    badge.className = 'instagram-agent-state';
    if (type) badge.classList.add('is-' + type);
  };

  const syncAgentControls = () => {
    const runButton = getElement('instagramAgentRunBtn');
    const stopButton = getElement('instagramAgentStopBtn');
    const promptButton = getElement('instagramAgentPromptBtn');
    if (runButton) runButton.disabled = state.agentRunning || !state.listing;
    if (promptButton) promptButton.disabled = state.agentRunning;
    if (stopButton) stopButton.hidden = !state.agentRunning;
  };

  const buildReferenceImageRecord = async () => {
    const reference = getMediaById(state.referenceId);
    if (!reference) throw new Error('Choisis l’image à montrer à l’agent.');
    const prepared = await ensureCropRecord(reference);
    return {
      id: prepared.id,
      name: prepared.name,
      base64: prepared.base64,
      mediaType: prepared.mediaType,
      width: prepared.width,
      height: prepared.height,
      originalBase64: prepared.originalBase64 || prepared.base64,
      originalMediaType: prepared.originalMediaType || prepared.mediaType,
      originalWidth: prepared.originalWidth || prepared.width,
      originalHeight: prepared.originalHeight || prepared.height,
      cropRect: prepared.cropRect || null,
      contentHash: prepared.contentHash || '',
      anthropicFileId: prepared.anthropicFileId || '',
      anthropicContentHash: prepared.anthropicContentHash || '',
      anthropicUploadedAt: prepared.anthropicUploadedAt || '',
    };
  };

  const updateInstagramCostDisplay = (latestEntry = null) => {
    const element = getElement('instagramAgentCost');
    const tracking = global.state?.costTracking;
    const entries = Array.isArray(tracking?.entries)
      ? tracking.entries.filter((entry) => entry.agentId === AGENT_ID)
      : [];
    const last = latestEntry || entries[entries.length - 1] || null;
    if (!element || !last) return;
    const instagramTotal = entries.reduce((sum, entry) => sum + (Number(entry.costCents) || 0), 0);
    const sessionTotal = Number(tracking?.totals?.costCents) || 0;
    element.textContent = 'Dernier run ' + Number(last.costCents || 0).toFixed(3) + '¢ · '
      + Number(last.inputTok || 0).toLocaleString() + ' tokens entrée · '
      + Number(last.outputTok || 0).toLocaleString() + ' tokens sortie · Instagram Σ '
      + instagramTotal.toFixed(3) + '¢ · session complète Σ ' + sessionTotal.toFixed(3) + '¢';
  };

  const recordInstagramUsage = (usage) => {
    if (!usage || (!Number(usage.input_tokens) && !Number(usage.output_tokens))) {
      throw new Error('Anthropic n’a retourné aucune donnée de pricing exploitable.');
    }
    const showCost = global.PipelineUICostRuntime?.showAgentCost || global.showAgentCost;
    if (typeof showCost !== 'function') throw new Error('Le runtime de pricing Anthropic n’est pas chargé.');
    const costPrefix = global.pfx?.() || 'col';
    const entry = showCost(AGENT_ID, usage, { prefix: costPrefix, source: 'social' });
    if (!entry) throw new Error('Le pricing Anthropic n’a pas pu être enregistré.');
    global.syncCacheIndicator?.(usage);
    updateInstagramCostDisplay(entry);
    return entry;
  };

  const runInstagramAgent = async () => {
    if (state.agentRunning) return;
    if (!state.listing) {
      setResult('Charge d’abord une fiche Etsy.', 'error');
      showStep('source');
      return;
    }
    if (!state.referenceId) {
      setResult('Choisis une image de référence dans l’écran Médias.', 'error');
      showStep('media');
      return;
    }

    state.agentRunning = true;
    syncAgentControls();
    setAgentState('Préparation de l’image…', 'running');
    setResult('');

    try {
      const [template, referenceImage] = await Promise.all([
        loadAgentPrompt(),
        buildReferenceImageRecord(),
      ]);
      const filled = buildAgentPrompt(template);
      global.state.inputs = global.state.inputs || {};
      global.state.images = global.state.images || {};
      global.state.inputs[AGENT_ID] = filled;
      global.state.images.instagram = [referenceImage];
      setAgentState('Génération en cours…', 'running');

      let response = await global.callClaude(AGENT_ID, {
        filled,
        fixedContent: '',
        runtimeAgentId: AGENT_ID,
        workspacePrefix: 'instagram',
      }, true);
      recordInstagramUsage(response.usage || null);
      state.lastAgentRaw = response.text || '';
      let output = parseAgentOutput(state.lastAgentRaw);

      if (output.warnings.length) {
        setAgentState('Une relance corrective maximum…', 'running');
        const retryPrompt = [
          'Réécris entièrement la proposition JSON ci-dessous pour corriger toutes ces erreurs :',
          output.warnings.join(' ; '),
          'Règles absolues : caption obligatoirement complète en français puis séparateur puis anglais, jamais dans une seule langue, 2 100 caractères maximum espaces compris ; texte de vente très court ; tutoiement en français ; aucune phrase recopiée ; exactement 5 ou 6 hashtags uniquement sur la dernière ligne de caption ; sculpteur crédité exactement deux fois avec son @compte, sous la forme Sculpté par : dans la partie française puis Sculpted by: dans la partie anglaise, et nulle part ailleurs ; aucun sculpteur dans les lignes techniques ; first_comment obligatoirement en français puis séparateur puis anglais, entre 500 et 1 000 caractères, sans hashtag, avec un seul bloc boutique bilingue et un seul lien ' + SHOP_URLS[state.shopKey] + ' au début ; first_comment doit être une réaction humaine naturelle sous le post, jamais une seconde présentation, une description produit ou une répétition de caption ; threads_text uniquement en anglais, naturel et commercial, entre 420 et 500 caractères, structure libre, aucun hashtag, aucune mention du sculpteur, commençant exactement par 🛒🔗 Available in shop puis à la ligne 👉 ' + SHOP_URLS[state.shopKey] + ' ; ces trois emojis sont obligatoires ; le caractère tiret cadratin est interdit partout.',
          'Conserve uniquement les faits déjà présents. Retourne seulement le JSON corrigé.',
          state.lastAgentRaw,
        ].join('\n\n');
        response = await global.callClaude(AGENT_ID, {
          filled: retryPrompt,
          fixedContent: '',
          runtimeAgentId: AGENT_ID,
          workspacePrefix: 'instagram',
        }, false);
        recordInstagramUsage(response.usage || null);
        state.lastAgentRaw = response.text || '';
        output = parseAgentOutput(state.lastAgentRaw);
      }
      getElement('instagramCaption').value = output.caption;
      getElement('instagramFirstComment').value = output.firstComment;
      getElement('instagramThreadsText').value = output.threadsText;
      updateTextCounters();
      saveDraft();


      if (output.warnings.length) {
        const warning = 'Texte chargé, mais à corriger : ' + output.warnings.join(' · ') + '.';
        setAgentState('Génération à corriger', 'warning');
        setResult(warning, 'warning');
        global.showToast?.(warning, '#f0b35d');
      } else {
        setAgentState('Génération terminée', 'success');
        setResult('Légende, premier commentaire et texte Threads générés. Relis-les avant publication.', 'success');
        global.showToast?.('Post Instagram généré');
      }
    } catch (error) {
      const stopped = /stopp/i.test(String(error.message || ''));
      setAgentState(stopped ? 'Génération stoppée' : 'Erreur', stopped ? '' : 'error');
      setResult(error.message, stopped ? '' : 'error');
      global.showToast?.(error.message, stopped ? '#e8c547' : '#ff4757');
    } finally {
      state.agentRunning = false;
      syncAgentControls();
    }
  };

  const stopInstagramAgent = () => {
    if (!state.agentRunning) return;
    global.stopAgent?.(AGENT_ID);
    setAgentState('Arrêt demandé…');
  };
  const renderAgentInput = () => {
    const panel = getElement('instagramAgentInput');
    if (!panel || panel.hidden) return;
    panel.textContent = JSON.stringify(buildAgentInput(), null, 2);
  };

  const renderReviewPreview = () => {
    const preview = getElement('instagramReviewPreview');
    if (!preview) return;
    const caption = String(getElement('instagramCaption')?.value || '').trim();
    if (state.mode === 'reel' && state.video) {
      preview.innerHTML = '<video src="' + escapeHtml(state.video.url) + '" controls></video><p>' + escapeHtml(caption || 'Légende vide') + '</p>';
      return;
    }
    if (!state.images.length) {
      preview.innerHTML = '<div class="instagram-review-empty">Aucun média à prévisualiser.</div>';
      return;
    }
    const mediaGrid = state.images.map((media, index) => (
      '<div class="instagram-review-media" style="--instagram-review-ratio:' + getFrameRatio() + '">' +
        '<img src="' + escapeHtml(media.url) + '" alt="Image ' + (index + 1) + '">' +
        '<span>' + String(index + 1).padStart(2, '0') + '</span>' +
      '</div>'
    )).join('');
    preview.innerHTML = '<div class="instagram-review-media-grid">' + mediaGrid + '</div><p>' + escapeHtml(caption || 'Légende vide') + '</p>';
  };
  const syncPreflight = () => {
    const title = getElement('instagramReviewTitle');
    const detail = getElement('instagramReviewDetail');
    const dot = getElement('instagramReviewDot');
    if (!title || !detail || !dot) return;

    let message = '';
    if (!state.listing) message = 'Charge une fiche Etsy pour commencer.';
    else if (state.mode === 'carousel' && state.images.length < 2) message = 'Un carrousel exige au moins 2 images.';
    else if (state.mode === 'carousel' && state.images.length > 10) message = 'Retire ' + (state.images.length - 10) + ' image(s) pour respecter la limite de 10.';
    else if (state.mode === 'reel' && !state.video) message = 'Ajoute la vidéo du Reel.';
    else if (state.video?.size > 1024 * 1024 * 1024) message = 'La vidéo dépasse la limite de 1 Go.';
    else if (!String(getElement('instagramCaption')?.value || '').trim()) message = 'La légende est encore vide.';
    else if (countTextCharacters(getElement('instagramCaption')?.value || '') > 2200) message = 'Raccourcis la légende à 2 200 caractères maximum pour Instagram.';

    const ready = !message;
    title.textContent = ready ? 'Brouillon prêt pour le prochain jet' : 'Préparation incomplète';
    detail.textContent = ready
      ? 'Ordre, ratio et texte sont prêts. Rien ne sera publié depuis cet écran aujourd’hui.'
      : message;
    dot.classList.toggle('is-ready', ready);
    const testButton = getElement('instagramTestPublishBtn');
    const publishButton = getElement('instagramPublishBtn');
    const threadsButton = getElement('threadsPublishBtn');
    if (testButton) testButton.disabled = state.publishing;
    if (publishButton) publishButton.disabled = state.publishing;
    if (threadsButton) threadsButton.disabled = state.publishing;
    syncProgress();
    if (state.activeStep === 'review') renderReviewPreview();
    syncAgentControls();
  };

  const updateTextCounters = () => {
    const caption = String(getElement('instagramCaption')?.value || '');
    const firstComment = String(getElement('instagramFirstComment')?.value || '');
    const threadsText = String(getElement('instagramThreadsText')?.value || '');
    const alt = String(getElement('instagramMediaAlt')?.value || '');
    if (getElement('instagramCaptionCount')) {
      const captionLength = countTextCharacters(caption);
      getElement('instagramCaptionCount').textContent = captionLength;
      getElement('instagramCaptionCount').classList.toggle('is-over-limit', captionLength > 2200);
    }
    if (getElement('instagramThreadsCount')) {
      const threadsLength = countTextCharacters(threadsText);
      getElement('instagramThreadsCount').textContent = threadsLength;
      getElement('instagramThreadsCount').classList.toggle('is-over-limit', Boolean(threadsLength) && (threadsLength < 420 || threadsLength > 500));
    }
    if (getElement('instagramCommentCount')) {
      const commentLength = countTextCharacters(firstComment);
      getElement('instagramCommentCount').textContent = commentLength;
      getElement('instagramCommentCount').classList.toggle('is-over-limit', Boolean(commentLength) && (commentLength < 500 || commentLength > 1000));
    }
    if (getElement('instagramMediaAltCount')) getElement('instagramMediaAltCount').textContent = alt.length;
    syncSummaries();
    syncPreflight();
  };

  const loadListing = async () => {
    const input = getElement('instagramListingId');
    const listingId = String(input?.value || '').trim();
    if (!/^\d+$/.test(listingId)) {
      setListingStatus('Entre un listing ID numérique, sans URL.', 'error');
      input?.focus();
      return;
    }

    if (!global.PipelineUIEtsyRuntime?.fetchListingPayload || !global.PipelineUIEtsyData?.normalizeEtsyListingPayload) {
      setListingStatus('Le module Etsy n’est pas disponible.', 'error');
      return;
    }

    state.busy = true;
    getElement('instagramLoadListingBtn').disabled = true;
    setListingStatus('Chargement de la fiche ' + listingId + '…');

    try {
      const envelope = await global.PipelineUIEtsyRuntime.fetchListingPayload(listingId, { shopKey: state.shopKey });
      const normalized = global.PipelineUIEtsyData.normalizeEtsyListingPayload(envelope?.payload || null);
      const listing = normalized?.data || null;
      if (!listing) throw new Error('La réponse Etsy ne contient aucune fiche exploitable.');

      state.listingId = listingId;
      state.rawPayload = envelope;
      state.listing = listing;
      const normalizedImages = normalizeImages(listing.images);
      if (state.draftListingId === listingId && state.draftImageOrder.length) {
        const imagesById = new Map(normalizedImages.map((media) => [media.id, media]));
        state.images = state.draftImageOrder.map((id) => imagesById.get(id)).filter(Boolean);
      } else {
        state.images = normalizedImages;
      }
      state.draftListingId = listingId;
      state.draftImageOrder = state.images.map(({ id }) => id);
      state.referenceId = state.images.some(({ id }) => id === state.referenceId)
        ? state.referenceId
        : (state.images[0]?.id || '');

      await loadSculptorLibrary();
      syncSculptorFields(extractSculptorName(listing.description || ''));

      const cleanup = cleanDescription(listing.description || '');
      getElement('instagramSourceTitle').value = listing.title || '';
      getElement('instagramSourceDescription').value = cleanup.description;
      getElement('instagramListingEditor').hidden = false;
      autoGrowTextarea(getElement('instagramSourceTitle'));
      autoGrowTextarea(getElement('instagramSourceDescription'));

      renderMedia();
      syncSummaries();
      saveDraft();
      setListingStatus(
        'Fiche chargée · ' + state.images.length + ' image(s) · ' + cleanup.removedBlocks + ' bloc(s) commun(s) retiré(s).',
        cleanup.removedBlocks ? 'success' : ''
      );

      syncProgress();

      state.images.forEach((media) => {
        if (!media.width || !media.height) {
          loadImageDimensions(media).then(() => {
            if (media === state.images[0] && state.ratio === 'original') renderMedia();
          });
        }
      });
    } catch (error) {
      state.listing = null;
      state.rawPayload = null;
      state.images = [];
      renderMedia();
      setListingStatus('Erreur Etsy : ' + error.message, 'error');
    } finally {
      state.busy = false;
      getElement('instagramLoadListingBtn').disabled = false;
      syncPreflight();
    }
  };

  const addLocalImages = async (files = []) => {
    const accepted = [...files].filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
    if (!accepted.length) {
      setResult('Choisis des images JPG, PNG ou WebP.', 'error');
      return;
    }

    const additions = await Promise.all(accepted.map(async (file, index) => {
      const dataUrl = await fileToDataUrl(file);
      const parts = dataUrlParts(dataUrl);
      const media = {
        id: global.crypto?.randomUUID?.() || ('local-' + Date.now() + '-' + index),
        url: dataUrl,
        name: file.name,
        altText: '',
        width: null,
        height: null,
        base64: parts?.base64 || '',
        mediaType: parts?.mediaType || file.type,
        source: 'local',
      };
      await loadImageDimensions(media);
      media.originalBase64 = media.base64;
      media.originalMediaType = media.mediaType;
      media.originalWidth = media.width;
      media.originalHeight = media.height;
      return media;
    }));

    state.images.push(...additions);
    if (!state.referenceId) state.referenceId = state.images[0]?.id || '';
    renderMedia();
    saveDraft();
    setResult(additions.length + ' image(s) locale(s) ajoutée(s).', 'success');
  };

  const selectLocalVideo = (file) => {
    if (!file) return;
    if (!['video/mp4', 'video/quicktime'].includes(file.type)) {
      setResult('Choisis une vidéo MP4 ou MOV.', 'error');
      return;
    }

    if (state.video?.url) URL.revokeObjectURL(state.video.url);
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    state.video = { file, name: file.name, size: file.size, type: file.type, lastModified: file.lastModified, url, width: null, height: null, duration: null };

    video.onloadedmetadata = () => {
      state.video.width = video.videoWidth;
      state.video.height = video.videoHeight;
      state.video.duration = video.duration;
      renderMedia();
    };
    video.src = url;
    renderMedia();
    setResult('Vidéo locale ajoutée. Elle reste uniquement dans ce navigateur.', 'success');
  };

  const removeMedia = (id) => {
    const index = state.images.findIndex((media) => media.id === id);
    if (index < 0) return;
    const [removed] = state.images.splice(index, 1);
    if (removed.source === 'local' && removed.url.startsWith('blob:')) URL.revokeObjectURL(removed.url);
    if (state.referenceId === id) state.referenceId = state.images[0]?.id || '';
    renderMedia();
    saveDraft();
  };

  const openMediaModal = async (id) => {
    const media = getMediaById(id);
    if (!media) return;
    state.activeMediaId = id;

    getElement('instagramDialogImage').src = media.url;
    getElement('instagramDialogImage').alt = media.altText || media.name;
    getElement('instagramMediaModalTitle').textContent = media.name;
    getElement('instagramMediaAlt').value = media.altText || '';
    getElement('instagramMediaDimensions').textContent = media.width && media.height
      ? media.width + ' × ' + media.height + ' px'
      : 'Dimensions en cours de lecture…';
    getElement('instagramReferenceBtn').classList.toggle('is-selected', state.referenceId === id);
    getElement('instagramReferenceBtn').textContent = state.referenceId === id ? 'Image montrée à l’agent' : 'Montrer à l’agent';
    updateTextCounters();

    const modal = getElement('instagramMediaModal');
    modal.classList.add('is-visible');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('instagram-modal-open');

    if (!media.width || !media.height) {
      await loadImageDimensions(media);
      if (state.activeMediaId === id) {
        getElement('instagramMediaDimensions').textContent = media.width && media.height
          ? media.width + ' × ' + media.height + ' px'
          : 'Dimensions indisponibles';
      }
    }
  };

  const closeMediaModal = () => {
    state.activeMediaId = '';
    const modal = getElement('instagramMediaModal');
    modal?.classList.remove('is-visible');
    modal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('instagram-modal-open');
  };

  const saveActiveAlt = () => {
    const media = getMediaById(state.activeMediaId);
    if (!media) return;
    media.altText = String(getElement('instagramMediaAlt')?.value || '').slice(0, 500);
    getElement('instagramDialogImage').alt = media.altText || media.name;
    state.draftAltById[media.id] = media.altText;
    saveDraft();
  };

  const toggleReference = () => {
    const media = getMediaById(state.activeMediaId);
    if (!media) return;
    state.referenceId = media.id;
    getElement('instagramReferenceBtn').classList.add('is-selected');
    getElement('instagramReferenceBtn').textContent = 'Image montrée à l’agent';
    renderMedia();
    saveDraft();
  };

  const ensureCropRecord = async (media) => {
    if (!media.base64) {
      let readableUrl = media.url;
      if (media.source === 'etsy') {
        const cached = await requestJson('/etsy/media-cache/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: media.url }),
        });
        readableUrl = cached.cachedUrl;
      }
      const response = await fetch(readableUrl);
      if (!response.ok) throw new Error('Téléchargement de l’image impossible.');
      const dataUrl = await fileToDataUrl(await response.blob());
      const parts = dataUrlParts(dataUrl);
      if (!parts) throw new Error('Format de l’image incompatible avec le crop.');
      media.base64 = parts.base64;
      media.mediaType = parts.mediaType;
      await loadImageDimensions(media);
      media.originalBase64 = media.base64;
      media.originalMediaType = media.mediaType;
      media.originalWidth = media.width;
      media.originalHeight = media.height;
    }
    return media;
  };

  const cropActiveMedia = async () => {
    const media = getMediaById(state.activeMediaId);
    if (!media || !global.PipelineUIImageTools?.openImageCropModal) return;
    const button = getElement('instagramCropBtn');
    button.disabled = true;
    button.textContent = 'Préparation…';

    try {
      const record = await ensureCropRecord(media);
      global.PipelineUIImageTools.openImageCropModal({
        imageRecord: record,
        onConfirm: (variant) => {
          media.base64 = variant.base64;
          media.mediaType = variant.mediaType;
          media.width = variant.width;
          media.height = variant.height;
          media.cropRect = variant.crop;
          media.url = 'data:' + variant.mediaType + ';base64,' + variant.base64;
          getElement('instagramDialogImage').src = media.url;
          getElement('instagramMediaDimensions').textContent = media.width + ' × ' + media.height + ' px · recadrée';
          renderMedia();
        },
      });
    } catch (error) {
      setResult('Crop impossible : ' + error.message, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Recadrer';
    }
  };

  const getPublicationSignature = () => JSON.stringify({
    mode: state.mode,
    ratio: state.ratio,
    images: state.images.map((media) => ({
      id: media.id,
      url: media.url,
      width: media.width,
      height: media.height,
      crop: media.cropRect || null,
    })),
    video: state.video ? {
      name: state.video.name,
      size: state.video.size,
      type: state.video.type,
      lastModified: state.video.lastModified,
    } : null,
  });

  const loadCanvasImage = (url) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Une image du carrousel ne peut pas être préparée.'));
    image.src = url;
  });

  const canvasToJpegBlob = (canvas) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Conversion JPEG impossible.'));
    }, 'image/jpeg', 0.92);
  });

  const preparePublicationImageBlob = async (media) => {
    const record = await ensureCropRecord(media);
    const sourceUrl = 'data:' + record.mediaType + ';base64,' + record.base64;
    const image = await loadCanvasImage(sourceUrl);
    const rawRatio = Number(getFrameRatio()) || 1;
    const frameRatio = Math.min(1.91, Math.max(0.8, rawRatio));
    let targetWidth = 1080;
    let targetHeight = Math.round(targetWidth / frameRatio);
    if (targetHeight > 1350) {
      targetHeight = 1350;
      targetWidth = Math.round(targetHeight * frameRatio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    context.fillStyle = '#000';
    context.fillRect(0, 0, targetWidth, targetHeight);
    const scale = Math.min(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight);
    const drawWidth = Math.round(image.naturalWidth * scale);
    const drawHeight = Math.round(image.naturalHeight * scale);
    context.drawImage(
      image,
      Math.round((targetWidth - drawWidth) / 2),
      Math.round((targetHeight - drawHeight) / 2),
      drawWidth,
      drawHeight,
    );
    return canvasToJpegBlob(canvas);
  };

  const preparePublicationMedia = async () => {
    const signature = getPublicationSignature();
    if (state.preparedPublication?.signature === signature) return state.preparedPublication;
    if (state.mode === 'reel') {
      if (!state.video?.file) {
        throw new Error('Ajoute de nouveau la vidéo à publier.');
      }
      setResult('Envoi temporaire de la vidéo…');
      const response = await fetch('/instagram/test/video', {
        method: 'POST',
        headers: { 'Content-Type': state.video.type },
        body: state.video.file,
      });
      const payload = await readJson(response);
      state.preparedPublication = { signature, mediaIds: [payload.mediaId] };
      return state.preparedPublication;
    }

    const mediaIds = [];
    for (let index = 0; index < state.images.length; index += 1) {
      setResult('Préparation de l’image ' + (index + 1) + ' / ' + state.images.length + '…');
      const blob = await preparePublicationImageBlob(state.images[index]);
      const response = await fetch('/instagram/test/media', {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });
      const payload = await readJson(response);
      mediaIds.push(payload.mediaId);
    }
    state.preparedPublication = { signature, mediaIds };
    return state.preparedPublication;
  };

  const publishInstagram = async ({ dryRun = false } = {}) => {
    if (state.publishing) return;
    if (!state.listing && /^\d+$/.test(String(getElement('instagramListingId')?.value || '').trim())) {
      setResult('Rechargement automatique de la fiche mémorisée…');
      await loadListing();
    }

    if (!dryRun && !global.confirm('Publier maintenant ' + (state.mode === 'reel' ? 'ce Reel' : 'ce carrousel') + ' sur Instagram ? Cette action crée une vraie publication.')) return;

    state.publishing = true;
    syncPreflight();
    const testButton = getElement('instagramTestPublishBtn');
    const publishButton = getElement('instagramPublishBtn');
    if (testButton) testButton.textContent = dryRun ? 'Préparation…' : 'Tester la préparation';
    if (publishButton) publishButton.textContent = dryRun ? 'Publier sur Instagram' : 'Publication…';

    try {
      const prepared = await preparePublicationMedia();
      const payload = await requestJson('/instagram/test/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaIds: prepared.mediaIds,
          mode: state.mode,
          caption: String(getElement('instagramCaption')?.value || '').trim(),
          firstComment: String(getElement('instagramFirstComment')?.value || '').trim(),
          dryRun,
        }),
      });
      if (dryRun) {
        setResult('Préparation validée : ' + payload.mediaCount + ' média(s), tunnel HTTPS prêt.', 'success');
        global.showToast?.('Carrousel prêt à publier');
      } else {
        state.preparedPublication = null;
        const suffix = payload.commentError
          ? ' Publication créée, mais premier commentaire non publié : ' + payload.commentError
          : (payload.commentId ? ' Premier commentaire publié.' : ' Aucun premier commentaire envoyé.');
        setResult('Publication Instagram créée (' + payload.mediaCount + ' média(s)).' + suffix, payload.commentError ? 'warning' : 'success');
        global.showToast?.('Publication Instagram créée');
      }
    } catch (error) {
      state.preparedPublication = null;
      setResult((dryRun ? 'Test impossible : ' : 'Publication impossible : ') + error.message, 'error');
      global.showToast?.(error.message, '#ff4757');
    } finally {
      state.publishing = false;
      if (testButton) testButton.textContent = 'Tester la préparation';
      if (publishButton) publishButton.textContent = 'Publier sur Instagram';
      syncPreflight();
    }
  };

  const publishThreads = async () => {
    if (state.publishing) return;

    if (!global.confirm('Publier maintenant ' + (state.mode === 'reel' ? 'cette vidéo' : 'ce carrousel') + ' sur Threads ? Cette action crée une vraie publication.')) return;

    state.publishing = true;
    syncPreflight();
    const button = getElement('threadsPublishBtn');
    if (button) button.textContent = 'Publication Threads…';

    try {
      const prepared = await preparePublicationMedia();
      const payload = await requestJson('/threads/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaIds: prepared.mediaIds,
          text: String(getElement('instagramThreadsText')?.value || '').trim(),
          mode: state.mode,
        }),
      });
      state.preparedPublication = null;
      setResult('Publication Threads créée (' + payload.mediaCount + ' média(s)).', 'success');
      global.showToast?.('Publication Threads créée');
    } catch (error) {
      state.preparedPublication = null;
      setResult('Publication Threads impossible : ' + error.message, 'error');
      global.showToast?.(error.message, '#ff4757');
    } finally {
      state.publishing = false;
      if (button) button.textContent = 'Publier sur Threads';
      syncPreflight();
    }
  };

  const verifyThreadsConnection = async () => {
    const element = getElement('threadsProfileState');
    if (!element) return;
    try {
      const payload = await requestJson('/threads/profile');
      const profile = payload.profile || {};
      element.textContent = 'Threads connecté : ' + (profile.username ? '@' + profile.username : profile.id);
    } catch (error) {
      element.textContent = 'Threads : ' + error.message;
    }
  };

  const verifyConnection = async () => {
    if (state.busy) return;
    state.busy = true;
    state.connected = false;
    setStateLabel('Vérification…', 'running');
    getElement('instagramVerifyBtn').disabled = true;

    try {
      const payload = await requestJson('/instagram/test/profile');
      state.profile = payload.profile;
      state.connected = true;
      const label = state.profile.username ? '@' + state.profile.username : state.profile.id;
      getElement('instagramProfile').textContent = label;
      setStateLabel('Connecté', 'success');
    } catch (error) {
      state.profile = null;
      getElement('instagramProfile').textContent = error.message;
      setStateLabel('Connexion impossible', 'error');
    } finally {
      state.busy = false;
      getElement('instagramVerifyBtn').disabled = false;
    }
  };

  const loadConfigurationStatus = async () => {
    try {
      const payload = await requestJson('/instagram/test/status');
      state.configured = Boolean(payload.configured);
      if (!state.configured) {
        getElement('instagramProfile').textContent = 'Token absent du fichier .env local';
        setStateLabel('Token absent', 'error');
      } else if (!state.connected && !state.busy) {
        await verifyConnection();
      }
    } catch (error) {
      getElement('instagramProfile').textContent = error.message;
      setStateLabel('Serveur indisponible', 'error');
    }
  };

  const setMode = (mode) => {
    state.mode = mode === 'reel' ? 'reel' : 'carousel';
    syncModePicker();
    renderMedia();
    saveDraft();
  };

  const setRatio = (ratio) => {
    if (!RATIOS[ratio]) return;
    state.ratio = ratio;
    getElement('instagramRatioMenu').hidden = true;
    getElement('instagramRatioTrigger').setAttribute('aria-expanded', 'false');
    syncRatioPicker();
    renderMedia();
    saveDraft();
  };

  const open = () => {
    global.showView?.('instagram-test');
    loadConfigurationStatus();
    syncPreflight();
  };

  const bindEvents = () => {
    document.querySelectorAll('[data-instagram-step-target]').forEach((button) => {
      button.addEventListener('click', () => showStep(button.dataset.instagramStepTarget));
    });
    document.querySelectorAll('[data-instagram-next]').forEach((button) => {
      button.addEventListener('click', () => showStep(button.dataset.instagramNext));
    });
    document.querySelectorAll('[data-instagram-previous]').forEach((button) => {
      button.addEventListener('click', () => showStep(button.dataset.instagramPrevious));
    });

    getElement('instagramAgentInputBtn')?.addEventListener('click', () => {
      const panel = getElement('instagramAgentInput');
      panel.hidden = !panel.hidden;
      getElement('instagramAgentInputBtn').textContent = panel.hidden ? 'Voir l’input' : 'Masquer l’input';
      renderAgentInput();
    });
    getElement('instagramAgentPromptBtn')?.addEventListener('click', () => {
      delete getCustomPromptState()[PROMPT_STATE_KEY];
      global.openPromptLightbox?.(PROMPT_SPEC_ID);
    });
    getElement('instagramAgentRunBtn')?.addEventListener('click', runInstagramAgent);
    getElement('instagramCopyCaptionBtn')?.addEventListener('click', () => copyInstagramField('instagramCaption', 'instagramCopyCaptionBtn', 'Légende'));
    getElement('instagramCopyCommentBtn')?.addEventListener('click', () => copyInstagramField('instagramFirstComment', 'instagramCopyCommentBtn', 'Premier commentaire'));
    getElement('instagramCopyThreadsBtn')?.addEventListener('click', () => copyInstagramField('instagramThreadsText', 'instagramCopyThreadsBtn', 'Texte Threads'));
    getElement('instagramAgentStopBtn')?.addEventListener('click', stopInstagramAgent);
    getElement('instagramVerifyBtn')?.addEventListener('click', verifyConnection);
    getElement('instagramTestPublishBtn')?.addEventListener('click', () => publishInstagram({ dryRun: true }));
    getElement('instagramPublishBtn')?.addEventListener('click', () => publishInstagram({ dryRun: false }));
    getElement('threadsPublishBtn')?.addEventListener('click', publishThreads);
    getElement('instagramLoadListingBtn')?.addEventListener('click', loadListing);
    getElement('instagramListingId')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') loadListing();
    });

    getElement('instagramShopPicker')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-instagram-shop]');
      if (!button) return;
      state.shopKey = button.dataset.instagramShop === 'doublex' ? 'doublex' : 'grosgeek';
      syncShopPicker();
      saveDraft();
    });

    getElement('instagramModePicker')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-instagram-mode]');
      if (button) setMode(button.dataset.instagramMode);
    });

    getElement('instagramRatioTrigger')?.addEventListener('click', () => {
      const menu = getElement('instagramRatioMenu');
      menu.hidden = !menu.hidden;
      getElement('instagramRatioTrigger').setAttribute('aria-expanded', String(!menu.hidden));
    });
    getElement('instagramRatioMenu')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-instagram-ratio]');
      if (button) setRatio(button.dataset.instagramRatio);
    });

    getElement('instagramAddMediaBtn')?.addEventListener('click', () => {
      getElement(state.mode === 'carousel' ? 'instagramLocalImages' : 'instagramLocalVideo')?.click();
    });
    getElement('instagramLocalImages')?.addEventListener('change', (event) => addLocalImages(event.target.files));
    getElement('instagramLocalVideo')?.addEventListener('change', (event) => selectLocalVideo(event.target.files?.[0]));

    const drop = getElement('instagramMediaDrop');
    ['dragenter', 'dragover'].forEach((name) => drop?.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.add('is-dragging');
    }));
    ['dragleave', 'drop'].forEach((name) => drop?.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.remove('is-dragging');
    }));
    drop?.addEventListener('drop', (event) => {
      if (state.mode === 'carousel') addLocalImages(event.dataTransfer?.files || []);
      else selectLocalVideo(event.dataTransfer?.files?.[0]);
    });

    getElement('instagramMediaGrid')?.addEventListener('click', (event) => {
      const reference = event.target.closest('[data-instagram-reference-media]');
      if (reference) {
        event.stopPropagation();
        state.referenceId = reference.dataset.instagramReferenceMedia;
        renderMedia();
        renderAgentInput();
        saveDraft();
        return;
      }
      const remove = event.target.closest('[data-instagram-remove-media]');
      if (remove) {
        event.stopPropagation();
        removeMedia(remove.dataset.instagramRemoveMedia);
        return;
      }
      const card = event.target.closest('[data-instagram-media-id]');
      if (card) openMediaModal(card.dataset.instagramMediaId);
    });
    getElement('instagramMediaGrid')?.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      const card = event.target.closest('[data-instagram-media-id]');
      if (!card) return;
      event.preventDefault();
      openMediaModal(card.dataset.instagramMediaId);
    });
    getElement('instagramVideoStage')?.addEventListener('click', (event) => {
      if (!event.target.closest('[data-instagram-remove-video]')) return;
      if (state.video?.url) URL.revokeObjectURL(state.video.url);
      state.video = null;
      renderMedia();
    });

    document.querySelectorAll('[data-instagram-modal-close]').forEach((button) => button.addEventListener('click', closeMediaModal));
    getElement('instagramMediaAlt')?.addEventListener('input', () => {
      saveActiveAlt();
      updateTextCounters();
    });
    getElement('instagramReferenceBtn')?.addEventListener('click', toggleReference);
    getElement('instagramCropBtn')?.addEventListener('click', cropActiveMedia);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.activeMediaId) closeMediaModal();
    });

    ['instagramSourceTitle', 'instagramSourceDescription', 'instagramCaption', 'instagramFirstComment', 'instagramThreadsText', 'instagramAgentCorrection', 'instagramSculptorName', 'instagramSculptorHandle'].forEach((id) => {
      getElement(id)?.addEventListener('input', (event) => {
        if (id === 'instagramSculptorName') syncSculptorFields('', { preserveHandle: false });
        if (id === 'instagramSourceTitle') autoGrowTextarea(event.currentTarget);
        if (id === 'instagramSourceDescription' && event.currentTarget.classList.contains('is-expanded')) {
          autoGrowTextarea(event.currentTarget, true);
        }
        updateTextCounters();
        renderAgentInput();
        saveDraft();
      });
    });
    getElement('instagramSaveSculptorBtn')?.addEventListener('click', saveSculptorToLibrary);
    getElement('instagramSculptorHandle')?.addEventListener('blur', (event) => {
      const handle = String(event.currentTarget.value || '').trim();
      event.currentTarget.value = handle && !handle.startsWith('@') ? '@' + handle : handle;
      syncSculptorFields('', { preserveHandle: true });
      renderAgentInput();
      saveDraft();
    });
    getElement('instagramSourceDescription')?.addEventListener('focus', (event) => autoGrowTextarea(event.currentTarget, true));
    getElement('instagramSourceTitle')?.addEventListener('focus', (event) => autoGrowTextarea(event.currentTarget, true));
  };

  const previousPromptResolver = global.resolveCustomPromptLightboxSpec;
  global.resolveCustomPromptLightboxSpec = (id) => {
    if (id === PROMPT_SPEC_ID) {
      return {
        label: 'Instagram · Publication bilingue',
        path: PROMPT_PATH,
        stateKey: PROMPT_STATE_KEY,
      };
    }
    return previousPromptResolver?.(id) || null;
  };
  restoreDraft();
  bindEvents();
  loadSculptorLibrary()
    .then(() => syncSculptorFields('', { preserveHandle: true }))
    .catch(() => syncSculptorFields('', { preserveHandle: true }));
  syncShopPicker();
  syncModePicker();
  syncRatioPicker();
  renderMedia();
  updateTextCounters();
  showStep(state.activeStep);
  syncAgentControls();
  updateInstagramCostDisplay();
  verifyThreadsConnection();
  const restoredListingId = String(getElement('instagramListingId')?.value || '').trim();
  if (/^\d+$/.test(restoredListingId)) {
    global.setTimeout(() => loadListing(), 0);
  }

  global.PipelineUIInstagram = {
    open,
    loadListing,
    verifyConnection,
    verifyThreadsConnection,
    publishThreads,
    runInstagramAgent,
    stopInstagramAgent,
    getState: () => state,
  };
  global.PipelineUI.social = global.PipelineUI.social || {};
  global.PipelineUI.social.instagram = global.PipelineUIInstagram;
})(window);