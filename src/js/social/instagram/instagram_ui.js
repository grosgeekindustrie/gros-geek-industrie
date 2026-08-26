'use strict';

(function initPipelineUIInstagram(global) {
  global.PipelineUI = global.PipelineUI || {};

  const DRAFT_KEY = 'instagram-studio-draft-v1';
  const AGENT_ID = 'instagram';
  const PROMPT_SPEC_ID = 'instagram-publisher';
  const PROMPT_STATE_KEY = 'instagramPublisher';
  const PROMPT_PATH = 'prompts/instagram/instagram.md';
  const THREADS_TEXT_MAX_LENGTH = 500;
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
  const CONTENT_FIELD_IDS = Object.freeze({
    caption: 'instagramCaption',
    firstComment: 'instagramFirstComment',
    threadsText: 'instagramThreadsText',
    captionFr: 'instagramCaptionFr',
    firstCommentFr: 'instagramFirstCommentFr',
    threadsTextFr: 'instagramThreadsTextFr',
  });
  const createEmptyContentDraft = () => ({
    caption: '',
    firstComment: '',
    threadsText: '',
    captionFr: '',
    firstCommentFr: '',
    threadsTextFr: '',
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
    reelCoverMode: 'frame',
    reelCoverTime: 0,
    reelCoverDataUrl: '',
    reelCustomCover: null,
    draftVideoIdentity: null,
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
    recentInstagramMedia: [],
    tiktokConnected: false,
    tiktokCreator: null,
    lastAgentRaw: '',
    sculptors: [],
    contentMode: 'agent',
    contentDrafts: {
      agent: createEmptyContentDraft(),
      manual: createEmptyContentDraft(),
    },
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

  const normalizeContentDraft = (draft = {}) => ({
    caption: String(draft?.caption || ''),
    firstComment: String(draft?.firstComment || ''),
    threadsText: String(draft?.threadsText || ''),
    captionFr: String(draft?.captionFr || ''),
    firstCommentFr: String(draft?.firstCommentFr || ''),
    threadsTextFr: String(draft?.threadsTextFr || ''),
  });

  const readContentFields = () => Object.fromEntries(
    Object.entries(CONTENT_FIELD_IDS).map(([key, id]) => [key, String(getElement(id)?.value || '')]),
  );

  const writeContentFields = (draft = {}) => {
    const normalized = normalizeContentDraft(draft);
    Object.entries(CONTENT_FIELD_IDS).forEach(([key, id]) => {
      const field = getElement(id);
      if (field) field.value = normalized[key];
    });
  };

  const captureActiveContentDraft = () => {
    state.contentDrafts[state.contentMode] = readContentFields();
    return state.contentDrafts[state.contentMode];
  };

  const pasteInstagramField = async (fieldId, buttonId, label) => {
    const field = getElement(fieldId);
    const button = getElement(buttonId);
    if (!field) return;
    try {
      const value = await navigator.clipboard.readText();
      if (!value) {
        global.showToast?.('Presse-papiers vide', '#f0b35d');
        return;
      }
      field.value = value;
      updateTextCounters();
      saveDraft();
      if (button) button.textContent = 'Collé ✓';
      global.showToast?.(label + ' collé');
      global.setTimeout(() => {
        if (button) button.textContent = 'Coller';
      }, 1400);
    } catch (error) {
      global.showToast?.('Impossible de lire le presse-papiers', '#ff4757');
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
    captureActiveContentDraft();
    const altById = Object.fromEntries(state.images.map(({ id, altText }) => [id, altText || '']));
    const agentContent = normalizeContentDraft(state.contentDrafts.agent);
    const manualContent = normalizeContentDraft(state.contentDrafts.manual);
    const draft = {
      shopKey: state.shopKey,
      listingId: String(getElement('instagramListingId')?.value || ''),
      title: String(getElement('instagramSourceTitle')?.value || ''),
      description: String(getElement('instagramSourceDescription')?.value || ''),
      // Les champs historiques restent branches sur le brouillon IA pour ne
      // jamais remplacer une generation existante par le contenu manuel.
      caption: agentContent.caption,
      firstComment: agentContent.firstComment,
      threadsText: agentContent.threadsText,
      captionFr: agentContent.captionFr,
      firstCommentFr: agentContent.firstCommentFr,
      threadsTextFr: agentContent.threadsTextFr,
      contentMode: state.contentMode,
      agentContent,
      manualContent,
      correction: String(getElement('instagramAgentCorrection')?.value || ''),
      sculptorName: String(getElement('instagramSculptorName')?.value || ''),
      sculptorHandle: String(getElement('instagramSculptorHandle')?.value || ''),
      mode: state.mode,
      ratio: state.ratio,
      referenceId: state.referenceId,
      reelCoverMode: state.reelCoverMode,
      reelCoverTime: state.reelCoverTime,
      reelVideoIdentity: state.video ? {
        name: state.video.name,
        size: state.video.size,
        lastModified: state.video.lastModified,
      } : state.draftVideoIdentity,
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
    state.reelCoverMode = draft.reelCoverMode === 'image' ? 'image' : 'frame';
    // Les fichiers locaux ne survivent pas à un rechargement de page.
    if (state.reelCoverMode === 'image') state.reelCoverMode = 'frame';
    state.reelCoverTime = Math.max(0, Number(draft.reelCoverTime) || 0);
    state.draftVideoIdentity = draft.reelVideoIdentity && typeof draft.reelVideoIdentity === 'object'
      ? draft.reelVideoIdentity
      : null;
    state.draftImageOrder = Array.isArray(draft.imageOrder) ? draft.imageOrder.map(String) : [];
    state.draftListingId = String(draft.listingId || '');
    state.draftAltById = draft.altById && typeof draft.altById === 'object' ? draft.altById : {};

    const splitLegacyDraft = (value) => {
      const separator = '━━━━━━━━━━━━━━━';
      const parts = String(value || '').split(separator);
      return parts.length > 1
        ? { french: parts.shift().trim(), english: parts.join(separator).trim() }
        : { french: '', english: String(value || '') };
    };
    const legacyCaption = splitLegacyDraft(draft.caption);
    const legacyFirstComment = splitLegacyDraft(draft.firstComment);
    const restoredCaption = draft.captionFr ? draft.caption : legacyCaption.english;
    const restoredCaptionFr = draft.captionFr || legacyCaption.french;
    const restoredFirstComment = draft.firstCommentFr ? draft.firstComment : legacyFirstComment.english;
    const restoredFirstCommentFr = draft.firstCommentFr || legacyFirstComment.french;
    const legacyAgentContent = {
      caption: restoredCaption,
      firstComment: restoredFirstComment,
      threadsText: draft.threadsText,
      captionFr: restoredCaptionFr,
      firstCommentFr: restoredFirstCommentFr,
      threadsTextFr: draft.threadsTextFr,
    };
    state.contentMode = draft.contentMode === 'manual' ? 'manual' : 'agent';
    state.contentDrafts.agent = normalizeContentDraft(
      draft.agentContent && typeof draft.agentContent === 'object' ? draft.agentContent : legacyAgentContent,
    );
    state.contentDrafts.manual = normalizeContentDraft(
      draft.manualContent && typeof draft.manualContent === 'object' ? draft.manualContent : {},
    );

    const values = {
      instagramListingId: draft.listingId,
      instagramSourceTitle: draft.title,
      instagramSourceDescription: draft.description,
      instagramAgentCorrection: draft.correction,
      instagramSculptorName: draft.sculptorName,
      instagramSculptorHandle: draft.sculptorHandle,
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = getElement(id);
      if (element && value) element.value = value;
    });
    writeContentFields(state.contentDrafts[state.contentMode]);
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

  const syncContentModeUi = () => {
    const manual = state.contentMode === 'manual';
    syncChoiceButtons('instagramContentModePicker', 'instagram-content-mode', state.contentMode);
    getElement('instagramAgentWorkspace')?.toggleAttribute('hidden', manual);
    getElement('instagramManualWorkspace')?.toggleAttribute('hidden', !manual);
    getElement('instagramFrenchControlSection')?.toggleAttribute('hidden', manual);
    const title = getElement('instagramPublishedLanguageTitle');
    const subtitle = getElement('instagramPublishedLanguageSubtitle');
    const badge = getElement('instagramPublishedLanguageBadge');
    if (title) title.textContent = manual ? 'CONTENU MANUEL' : 'ANGLAIS';
    if (subtitle) subtitle.textContent = manual
      ? 'Brouillon sauvegardé séparément de la génération IA'
      : 'Version publiée sur les réseaux';
    if (badge) badge.textContent = manual ? 'SAUVEGARDE AUTO' : 'PUBLICATION';
  };

  const setContentMode = (mode) => {
    const nextMode = mode === 'manual' ? 'manual' : 'agent';
    if (nextMode === state.contentMode) return;
    captureActiveContentDraft();
    state.contentMode = nextMode;
    writeContentFields(state.contentDrafts[nextMode]);
    syncContentModeUi();
    updateTextCounters();
    saveDraft();
    setResult(nextMode === 'manual'
      ? 'Mode manuel actif. Le brouillon IA reste intact.'
      : 'Génération IA restaurée. Le brouillon manuel reste enregistré.', 'success');
  };

  const clearManualContent = () => {
    if (state.contentMode !== 'manual') return;
    const current = readContentFields();
    const hasContent = [current.caption, current.firstComment, current.threadsText].some((value) => value.trim());
    if (hasContent && !global.confirm('Vider les trois champs du brouillon manuel ? La génération IA ne sera pas modifiée.')) return;
    state.contentDrafts.manual = createEmptyContentDraft();
    writeContentFields(state.contentDrafts.manual);
    updateTextCounters();
    saveDraft();
    getElement('instagramCaption')?.focus();
    global.showToast?.('Nouveau brouillon manuel vide');
  };

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

  const formatVideoTime = (seconds = 0) => {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds - (minutes * 60);
    return minutes + ':' + remainder.toFixed(3).padStart(6, '0');
  };

  const drawReelCover = (video) => {
    if (state.reelCoverMode !== 'frame') return;
    const canvas = getElement('instagramReelCoverCanvas');
    if (!canvas || !video?.videoWidth || !video?.videoHeight) return;
    const scale = Math.min(1, 280 / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      state.reelCoverDataUrl = canvas.toDataURL('image/jpeg', 0.82);
    } catch (error) {
      state.reelCoverDataUrl = '';
    }
    if (state.activeStep === 'review') renderReviewPreview();
  };

  const syncReelCoverControls = (video, time) => {
    const duration = Number.isFinite(video?.duration) ? video.duration : Number(state.video?.duration) || 0;
    const clampedTime = Math.min(Math.max(0, Number(time) || 0), Math.max(0, duration - 0.001));
    state.reelCoverTime = clampedTime;
    const slider = getElement('instagramReelCoverSlider');
    const label = getElement('instagramReelCoverTime');
    if (slider) {
      slider.max = String(Math.max(0, duration));
      slider.value = String(clampedTime);
    }
    if (label) label.textContent = formatVideoTime(clampedTime) + ' / ' + formatVideoTime(duration);
  };

  const seekReelCover = (time, { persist = true } = {}) => {
    const video = getElement('instagramReelVideo');
    if (!video) return;
    syncReelCoverControls(video, time);
    video.currentTime = state.reelCoverTime;
    if (persist) saveDraft();
  };

  const clearCustomReelCover = () => {
    if (state.reelCustomCover?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(state.reelCustomCover.url);
    }
    state.reelCustomCover = null;
  };

  const selectCustomReelCover = async (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setResult('Choisis une couverture JPEG, PNG ou WebP.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setResult('La couverture personnalisée dépasse 10 Mo.', 'error');
      return;
    }

    clearCustomReelCover();
    const customCover = {
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
      width: null,
      height: null,
    };
    await loadImageDimensions(customCover);
    state.reelCustomCover = customCover;
    state.reelCoverMode = 'image';
    state.reelCoverDataUrl = customCover.url;
    state.preparedPublication = null;
    renderMedia();
    saveDraft();
    setResult('Couverture personnalisée ajoutée pour le Reel Instagram.', 'success');
  };

  const setReelCoverMode = (mode) => {
    const normalizedMode = mode === 'image' ? 'image' : 'frame';
    if (normalizedMode === 'image' && !state.reelCustomCover) {
      getElement('instagramReelCustomCoverInput')?.click();
      return;
    }
    state.reelCoverMode = normalizedMode;
    state.reelCoverDataUrl = normalizedMode === 'image'
      ? String(state.reelCustomCover?.url || '')
      : '';
    state.preparedPublication = null;
    renderMedia();
    saveDraft();
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

    const customCoverSelected = state.reelCoverMode === 'image' && state.reelCustomCover;
    const coverPreview = customCoverSelected
      ? `<img src="${escapeHtml(state.reelCustomCover.url)}" alt="Couverture personnalisée"><span>Image</span>`
      : '<canvas id="instagramReelCoverCanvas" aria-label="Couverture sélectionnée"></canvas><span>Frame</span>';
    const coverControls = customCoverSelected
      ? `<div class="instagram-reel-custom-cover">
          <strong>${escapeHtml(state.reelCustomCover.name)}</strong>
          <small>${state.reelCustomCover.width || '?'} × ${state.reelCustomCover.height || '?'} px</small>
          <button type="button" class="instagram-frame-step" data-instagram-select-cover-image>Changer l'image</button>
        </div>`
      : `<div class="instagram-reel-scrubber">
          <input id="instagramReelCoverSlider" type="range" min="0" max="${state.video.duration || 0}" step="0.001" value="${state.reelCoverTime}" aria-label="Choisir la couverture du Reel">
          <div><button type="button" class="instagram-frame-step" data-instagram-cover-step="-0.033333">−1 image</button><strong id="instagramReelCoverTime">${formatVideoTime(state.reelCoverTime)} / ${formatVideoTime(state.video.duration)}</strong><button type="button" class="instagram-frame-step" data-instagram-cover-step="0.033333">+1 image</button></div>
          <small>Déplace le curseur ou avance image par image.</small>
        </div>`;

    stage.innerHTML = `
      <article class="instagram-video-card">
        <div class="instagram-reel-player">
          <video id="instagramReelVideo" src="${escapeHtml(state.video.url)}" controls preload="metadata"></video>
          <div class="instagram-reel-cover-mode" role="group" aria-label="Type de couverture du Reel">
            <button type="button" class="${state.reelCoverMode === 'frame' ? 'is-active' : ''}" data-instagram-cover-mode="frame">Frame de la vidéo</button>
            <button type="button" class="${state.reelCoverMode === 'image' ? 'is-active' : ''}" data-instagram-cover-mode="image">Image personnalisée</button>
            <input id="instagramReelCustomCoverInput" type="file" accept="image/jpeg,image/png,image/webp" hidden>
          </div>
          <div class="instagram-reel-timeline">
            <div class="instagram-reel-cover-preview">${coverPreview}</div>
            ${coverControls}
          </div>
          <small class="instagram-reel-cover-note">L'image personnalisée est envoyée comme couverture Instagram. Les autres réseaux conservent leur couverture vidéo native.</small>
        </div>
        <div class="instagram-video-details">
          <strong>${escapeHtml(state.video.name)}</strong>
          <span>${state.video.width || '?'} × ${state.video.height || '?'} px · ${(state.video.size / (1024 * 1024)).toFixed(1)} Mo</span>
          <button class="btn btn-muted" type="button" data-instagram-remove-video>Retirer</button>
        </div>
      </article>
    `;

    const video = getElement('instagramReelVideo');
    video?.addEventListener('loadedmetadata', () => {
      syncReelCoverControls(video, state.reelCoverTime);
      seekReelCover(state.reelCoverTime, { persist: false });
    }, { once: true });
    video?.addEventListener('seeked', () => drawReelCover(video));
    if (video?.readyState >= 1 && state.reelCoverMode === 'frame') {
      seekReelCover(state.reelCoverTime, { persist: false });
    }
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
      ? (state.contentMode === 'manual' ? 'Manuel · ' : 'IA · ') + captionLength + ' caractères · premier commentaire ' + (getElement('instagramFirstComment')?.value.trim() ? 'prêt' : 'vide')
      : (state.contentMode === 'manual' ? 'Brouillon manuel vide · prêt à recevoir ton texte' : 'Génération IA à lancer');
  };

  const countTextCharacters = (value = '') => Array.from(String(value || '')).length;

  const getThreadsPublicationText = () => String(getElement('instagramThreadsText')?.value || '').trim();

  const validateThreadsPublicationText = () => {
    const text = getThreadsPublicationText();
    const length = countTextCharacters(text);
    if (length > THREADS_TEXT_MAX_LENGTH) {
      return `Raccourcis le texte Threads : ${length} caractères sur ${THREADS_TEXT_MAX_LENGTH} maximum.`;
    }
    return '';
  };

  const reportThreadsValidationError = (message) => {
    setResult(message, 'error');
    global.showToast?.(message, '#ff4757');
    getElement('instagramThreadsText')?.focus();
  };

  const getReadiness = () => {
    const mediaReady = state.mode === 'carousel'
      ? state.images.length >= 2 && state.images.length <= 10
      : Boolean(state.video && state.video.size <= 1024 * 1024 * 1024);
    const caption = String(getElement('instagramCaption')?.value || '').trim();
    const generationReady = Boolean(caption) && countTextCharacters(caption) <= 2100;
    return {
      source: state.contentMode === 'manual' || Boolean(state.listing),
      media: mediaReady,
      generation: generationReady,
      review: Boolean((state.contentMode === 'manual' || state.listing) && mediaReady && generationReady),
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
    const english = parsed?.english && typeof parsed.english === 'object' ? parsed.english : {};
    const french = parsed?.french && typeof parsed.french === 'object' ? parsed.french : {};
    const readValue = (...values) => String(values.find((value) => typeof value === 'string' && value.trim()) || '').trim();
    const separator = '━━━━━━━━━━━━━━━';
    const splitLegacyValue = (value) => {
      const parts = String(value || '').split(separator);
      return parts.length > 1
        ? { french: parts.shift().trim(), english: parts.join(separator).trim() }
        : { french: '', english: '' };
    };

    let caption = readValue(english.caption, parsed?.caption_en, parsed?.captionEnglish);
    let captionFr = readValue(french.caption, parsed?.caption_fr, parsed?.captionFrench);
    const legacyCaption = splitLegacyValue(parsed?.caption);
    if (!caption) caption = legacyCaption.english || readValue(parsed?.caption);
    if (!captionFr) captionFr = legacyCaption.french;

    let firstComment = readValue(
      english.first_comment,
      english.firstComment,
      parsed?.first_comment_en,
      parsed?.firstCommentEnglish,
    );
    let firstCommentFr = readValue(
      french.first_comment,
      french.firstComment,
      parsed?.first_comment_fr,
      parsed?.firstCommentFrench,
    );
    const legacyFirstComment = splitLegacyValue(parsed?.first_comment || parsed?.firstComment);
    if (!firstComment) firstComment = legacyFirstComment.english || readValue(parsed?.first_comment, parsed?.firstComment);
    if (!firstCommentFr) firstCommentFr = legacyFirstComment.french;

    const threadsText = readValue(
      english.threads_text,
      english.threadsText,
      parsed?.threads_text_en,
      parsed?.threadsTextEnglish,
      parsed?.threads_text,
      parsed?.threadsText,
    );
    const threadsTextFr = readValue(
      french.threads_text,
      french.threadsText,
      parsed?.threads_text_fr,
      parsed?.threadsTextFrench,
    );
    const shopUrl = SHOP_URLS[state.shopKey];
    const englishHeader = '🛒🔗 Available in shop\n👉 ' + shopUrl;
    const frenchHeader = '🛒🔗 Disponible en boutique\n👉 ' + shopUrl;
    if (!caption) throw new Error('La sortie JSON ne contient aucune légende anglaise publiable.');
    const warnings = [];
    if (!captionFr) warnings.push('légende française de contrôle absente');
    if (!firstComment) warnings.push('premier commentaire anglais absent');
    if (!firstCommentFr) warnings.push('premier commentaire français de contrôle absent');
    if (!threadsText) warnings.push('texte Threads absent');
    if (!threadsTextFr) warnings.push('texte Threads français de contrôle absent');
    if (!caption.startsWith(englishHeader)) warnings.push('bloc boutique anglais absent du début de la légende');
    if (captionFr && !captionFr.startsWith(frenchHeader)) warnings.push('bloc boutique français absent du début du contrôle de légende');
    if (/Boutique Etsy\s*:/i.test(caption)) warnings.push('ancien format « Boutique Etsy » détecté');
    if (countTextCharacters(caption) > 2100) warnings.push('légende supérieure à la limite interne de 2 100 caractères');
    const hashtags = caption.match(/#[\p{L}\p{N}_]+/gu) || [];
    const lastLine = caption.split('\n').map((line) => line.trim()).filter(Boolean).at(-1) || '';
    const lastLineHashtags = lastLine.match(/#[\p{L}\p{N}_]+/gu) || [];
    if (hashtags.length < 5 || hashtags.length > 6 || lastLineHashtags.length !== hashtags.length) {
      warnings.push('les 5 ou 6 hashtags ne sont pas tous placés sur la dernière ligne anglaise');
    }
    const frenchHashtags = captionFr.match(/#[\p{L}\p{N}_]+/gu) || [];
    if (frenchHashtags.length) warnings.push('hashtags présents dans la légende française de contrôle');
    if ([firstComment, firstCommentFr].some((value) => value.includes('#'))) warnings.push('hashtags présents dans un premier commentaire');
    const firstCommentLength = countTextCharacters(firstComment);
    const firstCommentFrLength = countTextCharacters(firstCommentFr);
    if (firstCommentLength < 250 || firstCommentLength > 500) warnings.push('premier commentaire anglais hors de la plage de 250 à 500 caractères');
    if (firstCommentFrLength < 250 || firstCommentFrLength > 500) warnings.push('premier commentaire français hors de la plage de 250 à 500 caractères');
    const threadsLength = countTextCharacters(threadsText);
    const threadsFrLength = countTextCharacters(threadsTextFr);
    if (threadsLength < 420 || threadsLength > 500) warnings.push('texte Threads anglais hors de la plage de 420 à 500 caractères');
    if (threadsFrLength < 420 || threadsFrLength > 500) warnings.push('texte Threads français hors de la plage de 420 à 500 caractères');
    if ([threadsText, threadsTextFr].some((value) => value.includes('#'))) warnings.push('hashtag interdit dans une version Threads');
    if (!firstComment.startsWith(englishHeader)) warnings.push('bloc boutique anglais absent du début du premier commentaire');
    if (firstCommentFr && !firstCommentFr.startsWith(frenchHeader)) warnings.push('bloc boutique français absent du début du contrôle du premier commentaire');
    if (!threadsText.startsWith(englishHeader)) warnings.push('bloc boutique anglais absent du début du texte Threads');
    if (threadsTextFr && !threadsTextFr.startsWith(frenchHeader)) warnings.push('bloc boutique français absent du début du contrôle Threads');
    if ([caption, firstComment, threadsText, captionFr, firstCommentFr, threadsTextFr].some((value) => (value.split(shopUrl).length - 1) !== 1)) {
      warnings.push('URL boutique attendue une seule fois dans chacun des six champs');
    }
    if ([caption, firstComment, threadsText, captionFr, firstCommentFr, threadsTextFr].some((value) => value.includes('—'))) warnings.push('tiret cadratin interdit');
    if ([caption, firstComment, threadsText, captionFr, firstCommentFr, threadsTextFr].some((value) => /\[\[[A-Z_]+\]\]/.test(value))) warnings.push('placeholder non résolu');
    const handle = String(getElement('instagramSculptorHandle')?.value || '').trim();
    const sculptorCredit = handle || String(getElement('instagramSculptorName')?.value || '').trim();
    if (sculptorCredit) {
      const englishCreditCount = caption.split(sculptorCredit).length - 1;
      const frenchCreditCount = captionFr.split(sculptorCredit).length - 1;
      const englishCredit = 'Sculpted by: ' + sculptorCredit;
      const frenchCredit = 'Sculpté par : ' + sculptorCredit;
      if (englishCreditCount !== 1 || !caption.includes(englishCredit)) warnings.push('crédit sculpteur anglais incorrect');
      if (captionFr && (frenchCreditCount !== 1 || !captionFr.includes(frenchCredit))) warnings.push('crédit sculpteur français de contrôle incorrect');
      if ([firstComment, firstCommentFr, threadsText, threadsTextFr].some((value) => value.toLocaleLowerCase().includes(sculptorCredit.toLocaleLowerCase()))) {
        warnings.push('le sculpteur ne doit apparaître que dans les légendes');
      }
    }
    if (findCopiedSourceSequence(caption)) warnings.push('reprise trop proche de la description source');
    return { caption, firstComment, threadsText, captionFr, firstCommentFr, threadsTextFr, warnings };
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
    if (runButton) runButton.disabled = state.contentMode !== 'agent' || state.agentRunning || !state.listing;
    if (promptButton) promptButton.disabled = state.contentMode !== 'agent' || state.agentRunning;
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

      let response = await global.callAI(AGENT_ID, {
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
          filled,
          'CORRECTION TECHNIQUE OBLIGATOIRE',
          'Réécris entièrement la proposition JSON ci-dessous pour corriger toutes ces erreurs :',
          output.warnings.join(' ; '),
          'Respecte intégralement le prompt et son schéma JSON english/french ci-dessus. Conserve uniquement les faits déjà présents. Retourne seulement le JSON corrigé.',
          'PROPOSITION À CORRIGER',
          state.lastAgentRaw,
        ].join('\n\n');
        response = await global.callAI(AGENT_ID, {
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
      getElement('instagramCaptionFr').value = output.captionFr;
      getElement('instagramFirstCommentFr').value = output.firstCommentFr;
      getElement('instagramThreadsTextFr').value = output.threadsTextFr;
      updateTextCounters();
      saveDraft();


      if (output.warnings.length) {
        const warning = 'Texte chargé, mais à corriger : ' + output.warnings.join(' · ') + '.';
        setAgentState('Génération à corriger', 'warning');
        setResult(warning, 'warning');
        global.showToast?.(warning, '#f0b35d');
      } else {
        setAgentState('Génération terminée', 'success');
        setResult('Versions anglaises prêtes à publier et versions françaises séparées pour contrôle.', 'success');
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
      const cover = state.reelCoverDataUrl
        ? '<div class="instagram-review-reel-cover"><img src="' + escapeHtml(state.reelCoverDataUrl) + '" alt="Couverture du Reel"><span>' +
          (state.reelCoverMode === 'image' ? 'Couverture personnalisée' : 'Couverture · ' + formatVideoTime(state.reelCoverTime)) +
          '</span></div>'
        : '<video src="' + escapeHtml(state.video.url) + '" controls></video>';
      preview.innerHTML = cover + '<p>' + escapeHtml(caption || 'Légende vide') + '</p>';
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
    if (state.contentMode !== 'manual' && !state.listing) message = 'Charge une fiche Etsy pour commencer.';
    else if (state.mode === 'carousel' && state.images.length < 2) message = 'Un carrousel exige au moins 2 images.';
    else if (state.mode === 'carousel' && state.images.length > 10) message = 'Retire ' + (state.images.length - 10) + ' image(s) pour respecter la limite de 10.';
    else if (state.mode === 'reel' && !state.video) message = 'Ajoute la vidéo du Reel.';
    else if (state.video?.size > 1024 * 1024 * 1024) message = 'La vidéo dépasse la limite de 1 Go.';
    else if (!String(getElement('instagramCaption')?.value || '').trim()) message = 'La légende est encore vide.';
    else if (countTextCharacters(getElement('instagramCaption')?.value || '') > 2100) message = 'Raccourcis la légende à 2 100 caractères maximum.';
    else if (validateThreadsPublicationText()) message = validateThreadsPublicationText();

    const ready = !message;
    title.textContent = ready ? 'Brouillon prêt pour le prochain jet' : 'Préparation incomplète';
    detail.textContent = ready
      ? 'Ordre, ratio et texte sont prêts. Rien ne sera publié depuis cet écran aujourd’hui.'
      : message;
    dot.classList.toggle('is-ready', ready);
    const testButton = getElement('instagramTestPublishBtn');
    const publishButton = getElement('instagramPublishBtn');
    const publishAllButton = getElement('instagramPublishAllBtn');
    const facebookButton = getElement('facebookPublishBtn');
    const recentFacebookButton = getElement('instagramRecentFacebookBtn');
    const threadsButton = getElement('threadsPublishBtn');
    const tiktokButton = getElement('tiktokPublishBtn');
    const tiktokConnectButton = getElement('tiktokConnectBtn');
    if (testButton) testButton.disabled = state.publishing;
    if (publishButton) publishButton.disabled = state.publishing;
    if (publishAllButton) publishAllButton.disabled = state.publishing;
    if (facebookButton) facebookButton.disabled = state.publishing;
    if (recentFacebookButton) recentFacebookButton.disabled = state.publishing;
    if (threadsButton) threadsButton.disabled = state.publishing;
    if (tiktokButton) tiktokButton.disabled = state.publishing;
    if (tiktokConnectButton) tiktokConnectButton.disabled = state.publishing;
    syncProgress();
    if (state.activeStep === 'review') renderReviewPreview();
    syncAgentControls();
  };

  const updateTextCounters = () => {
    const caption = String(getElement('instagramCaption')?.value || '');
    const firstComment = String(getElement('instagramFirstComment')?.value || '');
    const threadsText = String(getElement('instagramThreadsText')?.value || '');
    const captionFr = String(getElement('instagramCaptionFr')?.value || '');
    const firstCommentFr = String(getElement('instagramFirstCommentFr')?.value || '');
    const threadsTextFr = String(getElement('instagramThreadsTextFr')?.value || '');
    const alt = String(getElement('instagramMediaAlt')?.value || '');
    if (getElement('instagramCaptionCount')) {
      const captionLength = countTextCharacters(caption);
      getElement('instagramCaptionCount').textContent = captionLength;
      getElement('instagramCaptionCount').classList.toggle('is-over-limit', captionLength > 2100);
    }
    if (getElement('instagramThreadsCount')) {
      const threadsLength = countTextCharacters(threadsText);
      getElement('instagramThreadsCount').textContent = threadsLength;
      getElement('instagramThreadsCount').classList.toggle('is-over-limit', Boolean(threadsLength) && (threadsLength < 420 || threadsLength > 500));
    }
    if (getElement('instagramCommentCount')) {
      const commentLength = countTextCharacters(firstComment);
      getElement('instagramCommentCount').textContent = commentLength;
      getElement('instagramCommentCount').classList.toggle('is-over-limit', Boolean(commentLength) && (commentLength < 250 || commentLength > 500));
    }
    if (getElement('instagramCaptionFrCount')) getElement('instagramCaptionFrCount').textContent = countTextCharacters(captionFr);
    if (getElement('instagramCommentFrCount')) getElement('instagramCommentFrCount').textContent = countTextCharacters(firstCommentFr);
    if (getElement('instagramThreadsFrCount')) getElement('instagramThreadsFrCount').textContent = countTextCharacters(threadsTextFr);
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
        const restoredImages = state.draftImageOrder.map((id) => imagesById.get(id)).filter(Boolean);
        const restoredIds = new Set(restoredImages.map(({ id }) => id));
        state.images = [
          ...restoredImages,
          ...normalizedImages.filter(({ id }) => !restoredIds.has(id)),
        ];
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
    const identityMatchesDraft = state.draftVideoIdentity
      && state.draftVideoIdentity.name === file.name
      && Number(state.draftVideoIdentity.size) === file.size
      && Number(state.draftVideoIdentity.lastModified) === file.lastModified;
    state.reelCoverTime = identityMatchesDraft ? state.reelCoverTime : 0;
    if (!identityMatchesDraft) {
      clearCustomReelCover();
      state.reelCoverMode = 'frame';
    }
    state.reelCoverDataUrl = '';
    state.video = { file, name: file.name, size: file.size, type: file.type, lastModified: file.lastModified, url, width: null, height: null, duration: null };
    state.draftVideoIdentity = { name: file.name, size: file.size, lastModified: file.lastModified };

    video.onloadedmetadata = () => {
      state.video.width = video.videoWidth;
      state.video.height = video.videoHeight;
      state.video.duration = video.duration;
      state.reelCoverTime = Math.min(state.reelCoverTime, Math.max(0, video.duration - 0.001));
      renderMedia();
      saveDraft();
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

  const prepareCustomReelCoverBlob = async () => {
    const cover = state.reelCustomCover;
    if (!cover?.file || !cover.url) {
      throw new Error('Ajoute de nouveau l’image de couverture du Reel.');
    }
    const image = await loadCanvasImage(cover.url);
    const scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvasToJpegBlob(canvas);
  };

  const prepareCustomReelCoverMediaId = async () => {
    if (state.mode !== 'reel' || state.reelCoverMode !== 'image') return '';
    const coverSignature = JSON.stringify({
      name: state.reelCustomCover?.name,
      size: state.reelCustomCover?.size,
      type: state.reelCustomCover?.type,
    });
    if (
      state.preparedPublication?.coverSignature === coverSignature
      && state.preparedPublication?.coverMediaId
    ) {
      return state.preparedPublication.coverMediaId;
    }
    setResult('Envoi temporaire de la couverture personnalisée…');
    const blob = await prepareCustomReelCoverBlob();
    const response = await fetch('/instagram/test/media', {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    });
    const payload = await readJson(response);
    const coverMediaId = String(payload.mediaId || '');
    if (state.preparedPublication) {
      state.preparedPublication.coverSignature = coverSignature;
      state.preparedPublication.coverMediaId = coverMediaId;
    }
    return coverMediaId;
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
      const coverMediaId = await prepareCustomReelCoverMediaId();
      const payload = await requestJson('/instagram/test/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaIds: prepared.mediaIds,
          mode: state.mode,
          caption: String(getElement('instagramCaption')?.value || '').trim(),
          firstComment: String(getElement('instagramFirstComment')?.value || '').trim(),
          thumbOffsetMs: state.mode === 'reel' ? Math.round(state.reelCoverTime * 1000) : null,
          coverMediaId,
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

    const validationError = validateThreadsPublicationText();
    if (validationError) {
      reportThreadsValidationError(validationError);
      return;
    }

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
          text: getThreadsPublicationText(),
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

  const publishFacebook = async () => {
    if (state.publishing) return;

    if (!global.confirm('Publier maintenant ' + (state.mode === 'reel' ? 'ce Reel' : 'ce carrousel') + ' sur Facebook ? Cette action crée une vraie publication sur la Page ' + SHOP_LABELS[state.shopKey] + '.')) return;

    state.publishing = true;
    syncPreflight();
    const button = getElement('facebookPublishBtn');
    if (button) button.textContent = 'Publication Facebook…';

    try {
      const prepared = await preparePublicationMedia();
      const payload = await requestJson('/facebook/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaIds: prepared.mediaIds,
          message: String(getElement('instagramCaption')?.value || '').trim(),
          mode: state.mode,
          shopKey: state.shopKey,
        }),
      });
      state.preparedPublication = null;
      const pageLabel = payload.profile?.name || SHOP_LABELS[state.shopKey];
      setResult('Publication Facebook créée sur ' + pageLabel + ' (' + payload.mediaCount + ' média(s)).', 'success');
      global.showToast?.('Publication Facebook créée');
    } catch (error) {
      state.preparedPublication = null;
      setResult('Publication Facebook impossible : ' + error.message, 'error');
      global.showToast?.(error.message, '#ff4757');
    } finally {
      state.publishing = false;
      if (button) button.textContent = 'Publier sur Facebook';
      syncPreflight();
    }
  };

  const publishAllNetworks = async () => {
    if (state.publishing) return;
    if (!state.listing && /^\d+$/.test(String(getElement('instagramListingId')?.value || '').trim())) {
      setResult('Rechargement automatique de la fiche mémorisée…');
      await loadListing();
    }

    const threadsValidationError = validateThreadsPublicationText();
    if (threadsValidationError) {
      reportThreadsValidationError(threadsValidationError);
      return;
    }

    const mediaLabel = state.mode === 'reel' ? 'ce Reel' : 'ce carrousel';
    if (!global.confirm(
      'Publier maintenant ' + mediaLabel + ' sur Instagram, Threads et Facebook ? ' +
      'Cette action crée trois vraies publications.',
    )) return;

    state.publishing = true;
    syncPreflight();
    const button = getElement('instagramPublishAllBtn');
    const results = [];

    const runNetwork = async (label, requestPublication) => {
      if (button) button.textContent = 'Publication ' + (results.length + 1) + ' / 3…';
      setResult('Publication sur ' + label + '…');
      try {
        const prepared = await preparePublicationMedia();
        const outcome = await requestPublication(prepared);
        results.push({ label, ok: true, warning: outcome.warning || '' });
      } catch (error) {
        results.push({ label, ok: false, error: error.message });
      } finally {
        // Chaque endpoint supprime ses médias temporaires après publication.
        // Le réseau suivant doit donc recevoir une nouvelle copie préparée.
        state.preparedPublication = null;
      }
    };

    try {
      await runNetwork('Instagram', async (prepared) => {
        const coverMediaId = await prepareCustomReelCoverMediaId();
        const payload = await requestJson('/instagram/test/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaIds: prepared.mediaIds,
            mode: state.mode,
            caption: String(getElement('instagramCaption')?.value || '').trim(),
            firstComment: String(getElement('instagramFirstComment')?.value || '').trim(),
            thumbOffsetMs: state.mode === 'reel' ? Math.round(state.reelCoverTime * 1000) : null,
            coverMediaId,
            dryRun: false,
          }),
        });
        return {
          warning: payload.commentError
            ? 'publication créée, premier commentaire non publié : ' + payload.commentError
            : '',
        };
      });

      await runNetwork('Threads', async (prepared) => {
        await requestJson('/threads/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaIds: prepared.mediaIds,
            text: getThreadsPublicationText(),
            mode: state.mode,
          }),
        });
        return {};
      });

      await runNetwork('Facebook', async (prepared) => {
        await requestJson('/facebook/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaIds: prepared.mediaIds,
            message: String(getElement('instagramCaption')?.value || '').trim(),
            mode: state.mode,
            shopKey: state.shopKey,
          }),
        });
        return {};
      });

      const successful = results.filter(({ ok }) => ok).length;
      const warnings = results.filter(({ warning }) => warning);
      const failures = results.filter(({ ok }) => !ok);
      const summary = results.map((result) => {
        if (!result.ok) return result.label + ' ✗ (' + result.error + ')';
        if (result.warning) return result.label + ' ✓ (' + result.warning + ')';
        return result.label + ' ✓';
      }).join(' · ');
      const resultType = failures.length ? (successful ? 'warning' : 'error') : (warnings.length ? 'warning' : 'success');
      setResult('Publications terminées : ' + summary, resultType);
      if (failures.length) {
        global.showToast?.(successful + ' réseau(x) publié(s), ' + failures.length + ' en échec', successful ? '#f0b35d' : '#ff4757');
      } else {
        global.showToast?.('Publication créée sur les trois réseaux');
      }
    } finally {
      state.publishing = false;
      if (button) button.textContent = 'Publier sur Instagram, Threads et Facebook';
      syncPreflight();
    }
  };

  const renderRecentInstagramMedia = () => {
    const list = getElement('instagramRecentList');
    if (!list) return;
    if (!state.recentInstagramMedia.length) {
      list.innerHTML = '<div class="instagram-review-empty">Aucune publication Instagram récente récupérable.</div>';
      return;
    }
    list.innerHTML = state.recentInstagramMedia.map((media) => {
      const previewUrl = String(media.thumbnail_url || media.media_url || '');
      const caption = String(media.caption || '').trim() || 'Publication sans légende';
      const type = String(media.media_product_type || media.media_type || 'MEDIA').replaceAll('_', ' ');
      const timestamp = media.timestamp ? new Date(media.timestamp).toLocaleDateString('fr-FR') : 'Date inconnue';
      return '<article class="instagram-recent-card">' +
        (previewUrl ? '<img src="' + escapeHtml(previewUrl) + '" alt="Aperçu Instagram">' : '<div class="instagram-review-empty">Sans aperçu</div>') +
        '<div><strong>' + escapeHtml(type) + ' · ' + escapeHtml(timestamp) + '</strong><p>' + escapeHtml(caption) + '</p>' +
        '<button class="btn btn-muted" type="button" data-instagram-republish-id="' + escapeHtml(media.id) + '"' + (state.publishing ? ' disabled' : '') + '>Publier sur Facebook</button></div>' +
      '</article>';
    }).join('');
  };

  const closeRecentInstagramModal = () => {
    const modal = getElement('instagramRecentModal');
    modal?.classList.remove('is-visible');
    modal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('instagram-modal-open');
  };

  const openRecentInstagramModal = async () => {
    const modal = getElement('instagramRecentModal');
    const status = getElement('instagramRecentStatus');
    if (!modal || !status) return;
    modal.classList.add('is-visible');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('instagram-modal-open');
    status.textContent = 'Chargement des publications Instagram…';
    status.className = 'instagram-inline-status';
    getElement('instagramRecentList').innerHTML = '';

    try {
      const payload = await requestJson('/instagram/media/recent?limit=30');
      state.recentInstagramMedia = Array.isArray(payload.media) ? payload.media : [];
      status.textContent = state.recentInstagramMedia.length + ' publication(s) Instagram disponible(s). Choisis uniquement celles absentes de Facebook.';
      status.classList.add('is-success');
      renderRecentInstagramMedia();
    } catch (error) {
      state.recentInstagramMedia = [];
      status.textContent = 'Lecture Instagram impossible : ' + error.message;
      status.classList.add('is-error');
      renderRecentInstagramMedia();
    }
  };

  const publishRecentInstagramToFacebook = async (instagramMediaId) => {
    if (state.publishing) return;
    const media = state.recentInstagramMedia.find((item) => String(item.id) === String(instagramMediaId));
    if (!media) return;
    const pageLabel = SHOP_LABELS[state.shopKey];
    if (!global.confirm('Republier cette publication Instagram sur la Page Facebook ' + pageLabel + ' ? Cette action crée une vraie publication.')) return;

    state.publishing = true;
    syncPreflight();
    renderRecentInstagramMedia();
    try {
      const payload = await requestJson('/facebook/publish-instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagramMediaId: media.id,
          shopKey: state.shopKey,
        }),
      });
      closeRecentInstagramModal();
      setResult('Publication Instagram rattrapée sur Facebook (' + payload.mediaCount + ' média(s)).', 'success');
      global.showToast?.('Publication Instagram rattrapée sur Facebook');
    } catch (error) {
      const status = getElement('instagramRecentStatus');
      if (status) {
        status.textContent = error.message;
        status.className = 'instagram-inline-status is-error';
      }
      global.showToast?.(error.message, '#ff4757');
    } finally {
      state.publishing = false;
      syncPreflight();
      renderRecentInstagramMedia();
    }
  };

  const TIKTOK_PRIVACY_LABELS = Object.freeze({
    PUBLIC_TO_EVERYONE: 'Tout le monde',
    FOLLOWER_OF_CREATOR: 'Abonnés',
    MUTUAL_FOLLOW_FRIENDS: 'Amis',
    SELF_ONLY: 'Moi uniquement',
  });

  const renderTikTokCreatorSettings = () => {
    const creator = state.tiktokCreator;
    const panel = getElement('tiktokPublishSettings');
    const select = getElement('tiktokPrivacyLevel');
    if (!panel || !select) return;
    panel.hidden = !creator;
    if (!creator) return;

    const previousValue = select.value;
    const privacyOptions = Array.isArray(creator.privacy_level_options)
      ? creator.privacy_level_options
      : [];
    select.innerHTML = '<option value="">Choisir la visibilité…</option>' + privacyOptions.map((value) => (
      '<option value="' + escapeHtml(value) + '">' +
      escapeHtml(TIKTOK_PRIVACY_LABELS[value] || value) +
      '</option>'
    )).join('');
    select.value = privacyOptions.includes(previousValue)
      ? previousValue
      : (privacyOptions.includes('SELF_ONLY') ? 'SELF_ONLY' : '');

    [
      ['tiktokAllowComment', 'comment_disabled'],
      ['tiktokAllowDuet', 'duet_disabled'],
      ['tiktokAllowStitch', 'stitch_disabled'],
    ].forEach(([elementId, creatorKey]) => {
      const input = getElement(elementId);
      if (!input) return;
      const forcedDisabled = Boolean(creator[creatorKey]);
      input.checked = false;
      input.disabled = forcedDisabled;
    });
  };

  const syncTikTokCommercialSettings = () => {
    const enabled = Boolean(getElement('tiktokCommercialContent')?.checked);
    const options = getElement('tiktokCommercialOptions');
    const ownBrand = getElement('tiktokOwnBrand');
    const brandedContent = getElement('tiktokBrandedContent');
    const notice = getElement('tiktokCommercialNotice');
    if (options) options.hidden = !enabled;
    if (!enabled) {
      if (ownBrand) ownBrand.checked = false;
      if (brandedContent) brandedContent.checked = false;
    }
    if (notice) {
      notice.textContent = brandedContent?.checked
        ? 'La vidéo sera étiquetée « Partenariat rémunéré ».'
        : (ownBrand?.checked ? 'La vidéo sera étiquetée « Contenu promotionnel ».' : '');
    }
  };

  const waitForTikTokPublishStatus = async (publishId) => {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await new Promise((resolve) => global.setTimeout(resolve, 2000));
      const payload = await requestJson('/tiktok/publish/status?publishId=' + encodeURIComponent(publishId));
      const status = payload.status || {};
      if (status.status === 'PUBLISH_COMPLETE') return status;
      if (status.status === 'FAILED') {
        throw new Error('Traitement TikTok échoué : ' + (status.fail_reason || 'raison inconnue'));
      }
      setResult('TikTok traite la vidéo… statut : ' + (status.status || 'en attente'), 'working');
    }
    return null;
  };

  const verifyTikTokConnection = async ({ quiet = false } = {}) => {
    const element = getElement('tiktokProfileState');
    const connectButton = getElement('tiktokConnectBtn');
    if (!element) return false;
    if (!quiet) element.textContent = 'TikTok : vérification…';
    try {
      const status = await requestJson('/tiktok/oauth/status');
      if (!status.configured) {
        state.tiktokConnected = false;
        state.tiktokCreator = null;
        element.textContent = 'TikTok : configuration .env incomplète (' + status.missingConfig.join(', ') + ')';
        if (connectButton) connectButton.textContent = 'Configurer TikTok';
        renderTikTokCreatorSettings();
        return false;
      }
      if (!status.connected) {
        state.tiktokConnected = false;
        state.tiktokCreator = null;
        element.textContent = 'TikTok prêt à être connecté';
        if (connectButton) connectButton.textContent = 'Connecter TikTok';
        renderTikTokCreatorSettings();
        return false;
      }

      const [profilePayload, creatorPayload] = await Promise.all([
        requestJson('/tiktok/profile'),
        requestJson('/tiktok/creator-info'),
      ]);
      const profile = profilePayload.profile || {};
      state.tiktokConnected = true;
      state.tiktokCreator = creatorPayload.creator || null;
      const label = profile.display_name || state.tiktokCreator?.creator_nickname || profile.open_id;
      element.textContent = 'TikTok connecté : ' + (label || 'compte autorisé');
      if (connectButton) connectButton.textContent = 'Reconnecter TikTok';
      renderTikTokCreatorSettings();
      return true;
    } catch (error) {
      state.tiktokConnected = false;
      state.tiktokCreator = null;
      element.textContent = 'TikTok : ' + error.message;
      if (connectButton) connectButton.textContent = 'Connecter TikTok';
      renderTikTokCreatorSettings();
      return false;
    }
  };

  const connectTikTok = async () => {
    const element = getElement('tiktokProfileState');
    try {
      const payload = await requestJson('/tiktok/oauth/start');
      const popup = global.open(payload.authUrl, '_blank');
      if (!popup) throw new Error('Le navigateur a bloqué la fenêtre OAuth TikTok');
      if (element) element.textContent = 'TikTok : autorisation dans le navigateur…';

      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => global.setTimeout(resolve, 2000));
        if (await verifyTikTokConnection({ quiet: true })) {
          global.showToast?.('Compte TikTok connecté');
          return;
        }
        if (popup.closed && attempt > 2) break;
      }
      if (element) element.textContent = 'TikTok : autorisation non terminée';
    } catch (error) {
      if (element) element.textContent = 'TikTok : ' + error.message;
      global.showToast?.(error.message, '#ff4757');
    }
  };

  const publishTikTok = async () => {
    if (state.publishing) return;
    if (state.mode !== 'reel' || !state.video?.file) {
      setResult('TikTok review : sélectionne le mode Reel et ajoute une vidéo MP4 ou MOV.', 'error');
      return;
    }
    // TikTok requires fresh creator information immediately before posting.
    // This also refreshes the available privacy levels after the account is
    // switched between public and private in the TikTok mobile application.
    if (!await verifyTikTokConnection({ quiet: true })) return;

    const privacyLevel = String(getElement('tiktokPrivacyLevel')?.value || '');
    if (!privacyLevel) {
      setResult('TikTok review : choisis manuellement la visibilité.', 'error');
      return;
    }
    const commercialContent = Boolean(getElement('tiktokCommercialContent')?.checked);
    const brandOrganic = commercialContent && Boolean(getElement('tiktokOwnBrand')?.checked);
    const brandContent = commercialContent && Boolean(getElement('tiktokBrandedContent')?.checked);
    if (commercialContent && !brandOrganic && !brandContent) {
      setResult('TikTok review : indique si le contenu promeut ta marque, une marque tierce, ou les deux.', 'error');
      return;
    }
    if (brandContent && privacyLevel === 'SELF_ONLY') {
      setResult('TikTok review : un partenariat rémunéré ne peut pas être privé.', 'error');
      return;
    }
    const privacyLabel = TIKTOK_PRIVACY_LABELS[privacyLevel] || privacyLevel;
    const creatorLabel = state.tiktokCreator?.creator_nickname || 'le compte connecté';
    if (!global.confirm(
      'Publier maintenant cette vidéo sur TikTok (' + creatorLabel + ') avec la visibilité « ' +
      privacyLabel + ' » ? Cette action crée une vraie publication TikTok.',
    )) return;

    state.publishing = true;
    syncPreflight();
    const button = getElement('tiktokPublishBtn');
    if (button) button.textContent = 'Publication TikTok…';
    try {
      const prepared = await preparePublicationMedia();
      const payload = await requestJson('/tiktok/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaIds: prepared.mediaIds,
          mode: 'reel',
          title: String(getElement('instagramCaption')?.value || '').trim(),
          privacyLevel,
          disableComment: !Boolean(getElement('tiktokAllowComment')?.checked),
          disableDuet: !Boolean(getElement('tiktokAllowDuet')?.checked),
          disableStitch: !Boolean(getElement('tiktokAllowStitch')?.checked),
          brandOrganic,
          brandContent,
          coverTimestampMs: Math.round(state.reelCoverTime * 1000),
          durationSeconds: Number(state.video.duration || 0),
        }),
      });
      state.preparedPublication = null;
      setResult('Vidéo envoyée à TikTok, traitement en cours…', 'working');
      const finalStatus = await waitForTikTokPublishStatus(payload.publishId);
      if (finalStatus) {
        setResult('Publication TikTok terminée.', 'success');
        global.showToast?.('Publication TikTok terminée');
      } else {
        setResult('Vidéo envoyée à TikTok. Le traitement continue et peut prendre quelques minutes.', 'success');
        global.showToast?.('Vidéo envoyée à TikTok');
      }
    } catch (error) {
      state.preparedPublication = null;
      setResult('Publication TikTok impossible : ' + error.message, 'error');
      global.showToast?.(error.message, '#ff4757');
    } finally {
      state.publishing = false;
      if (button) button.textContent = 'Publier sur TikTok';
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

  const verifyFacebookConnection = async () => {
    const element = getElement('facebookProfileState');
    if (!element) return;
    element.textContent = 'Facebook : vérification…';
    try {
      const payload = await requestJson('/facebook/profile?shop=' + encodeURIComponent(state.shopKey));
      const profile = payload.profile || {};
      element.textContent = 'Facebook connecté : ' + (profile.name || profile.id);
    } catch (error) {
      element.textContent = 'Facebook : ' + error.message;
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
    getElement('instagramContentModePicker')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-instagram-content-mode]');
      if (button) setContentMode(button.dataset.instagramContentMode);
    });
    getElement('instagramManualClearBtn')?.addEventListener('click', clearManualContent);
    getElement('instagramAgentRunBtn')?.addEventListener('click', runInstagramAgent);
    getElement('instagramPasteCaptionBtn')?.addEventListener('click', () => pasteInstagramField('instagramCaption', 'instagramPasteCaptionBtn', 'Légende'));
    getElement('instagramPasteCommentBtn')?.addEventListener('click', () => pasteInstagramField('instagramFirstComment', 'instagramPasteCommentBtn', 'Premier commentaire'));
    getElement('instagramPasteThreadsBtn')?.addEventListener('click', () => pasteInstagramField('instagramThreadsText', 'instagramPasteThreadsBtn', 'Texte Threads'));
    getElement('instagramCopyCaptionBtn')?.addEventListener('click', () => copyInstagramField('instagramCaption', 'instagramCopyCaptionBtn', 'Légende'));
    getElement('instagramCopyCommentBtn')?.addEventListener('click', () => copyInstagramField('instagramFirstComment', 'instagramCopyCommentBtn', 'Premier commentaire'));
    getElement('instagramCopyThreadsBtn')?.addEventListener('click', () => copyInstagramField('instagramThreadsText', 'instagramCopyThreadsBtn', 'Texte Threads'));
    getElement('instagramAgentStopBtn')?.addEventListener('click', stopInstagramAgent);
    getElement('instagramVerifyBtn')?.addEventListener('click', verifyConnection);
    getElement('instagramTestPublishBtn')?.addEventListener('click', () => publishInstagram({ dryRun: true }));
    getElement('instagramPublishAllBtn')?.addEventListener('click', publishAllNetworks);
    getElement('instagramPublishBtn')?.addEventListener('click', () => publishInstagram({ dryRun: false }));
    getElement('facebookPublishBtn')?.addEventListener('click', publishFacebook);
    getElement('threadsPublishBtn')?.addEventListener('click', publishThreads);
    getElement('tiktokConnectBtn')?.addEventListener('click', connectTikTok);
    getElement('tiktokPublishBtn')?.addEventListener('click', publishTikTok);
    getElement('tiktokCommercialContent')?.addEventListener('change', syncTikTokCommercialSettings);
    getElement('tiktokOwnBrand')?.addEventListener('change', syncTikTokCommercialSettings);
    getElement('tiktokBrandedContent')?.addEventListener('change', syncTikTokCommercialSettings);
    getElement('instagramRecentFacebookBtn')?.addEventListener('click', openRecentInstagramModal);
    document.querySelectorAll('[data-instagram-recent-close]').forEach((button) => button.addEventListener('click', closeRecentInstagramModal));
    getElement('instagramRecentList')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-instagram-republish-id]');
      if (button) publishRecentInstagramToFacebook(button.dataset.instagramRepublishId);
    });
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
      closeRecentInstagramModal();
      verifyFacebookConnection();
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
      const coverModeButton = event.target.closest('[data-instagram-cover-mode]');
      if (coverModeButton) {
        setReelCoverMode(coverModeButton.dataset.instagramCoverMode);
        return;
      }
      if (event.target.closest('[data-instagram-select-cover-image]')) {
        getElement('instagramReelCustomCoverInput')?.click();
        return;
      }
      const stepButton = event.target.closest('[data-instagram-cover-step]');
      if (stepButton) {
        seekReelCover(state.reelCoverTime + Number(stepButton.dataset.instagramCoverStep || 0));
        return;
      }
      if (event.target.closest('[data-instagram-remove-video]')) {
        if (state.video?.url) URL.revokeObjectURL(state.video.url);
        state.video = null;
        clearCustomReelCover();
        state.reelCoverMode = 'frame';
        state.reelCoverDataUrl = '';
        renderMedia();
        saveDraft();
      }
    });
    getElement('instagramVideoStage')?.addEventListener('input', (event) => {
      if (event.target.id === 'instagramReelCoverSlider') seekReelCover(event.target.value);
    });
    getElement('instagramVideoStage')?.addEventListener('change', (event) => {
      if (event.target.id === 'instagramReelCustomCoverInput') {
        selectCustomReelCover(event.target.files?.[0]);
      }
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

    ['instagramSourceTitle', 'instagramSourceDescription', 'instagramCaption', 'instagramFirstComment', 'instagramThreadsText', 'instagramCaptionFr', 'instagramFirstCommentFr', 'instagramThreadsTextFr', 'instagramAgentCorrection', 'instagramSculptorName', 'instagramSculptorHandle'].forEach((id) => {
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
  syncContentModeUi();
  syncRatioPicker();
  renderMedia();
  updateTextCounters();
  showStep(state.activeStep);
  syncAgentControls();
  updateInstagramCostDisplay();
  syncTikTokCommercialSettings();
  verifyThreadsConnection();
  verifyFacebookConnection();
  verifyTikTokConnection();
  const restoredListingId = String(getElement('instagramListingId')?.value || '').trim();
  if (/^\d+$/.test(restoredListingId)) {
    global.setTimeout(() => loadListing(), 0);
  }

  global.PipelineUIInstagram = {
    open,
    loadListing,
    verifyConnection,
    verifyFacebookConnection,
    verifyThreadsConnection,
    publishAllNetworks,
    publishFacebook,
    publishTikTok,
    connectTikTok,
    verifyTikTokConnection,
    openRecentInstagramModal,
    publishThreads,
    runInstagramAgent,
    stopInstagramAgent,
    getState: () => state,
  };
  global.PipelineUI.social = global.PipelineUI.social || {};
  global.PipelineUI.social.instagram = global.PipelineUIInstagram;
})(window);
