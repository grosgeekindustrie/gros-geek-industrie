(function initPipelineUIForms(global) {

// Formulaires, persistance locale et context builder.
// Ce module centralise la lecture/ecriture des champs et construit le contexte injecte
// dans les prompts. Toute evolution ici peut impacter plusieurs agents a la fois.
  global.PipelineUI = global.PipelineUI || {};

  const DEFAULT_SHOP_URL = 'https://grosgeekindustrie.etsy.com';
  const DEFAULT_SHOP_URLS = Object.freeze({
    grosgeek: 'https://grosgeekindustrie.etsy.com',
    doublex: 'https://www.etsy.com/shop/DoubleXindustrie',
  });
  const APP_SETTINGS_STORAGE_KEY = 'pipeline.settings';
  const FORM_STORAGE_KEY_PREFIX = 'pipeline.form.';
  const DEFAULT_SUBJECT_NAME = 'Figurine';
  const DEFAULT_SCULPTOR_NAME = 'Inconnu';
  const DEFAULT_POSE_NAME = 'MUSEUM';
  const DEFAULT_PROFILE_NAME = 'hobbyiste';
  const DEFAULT_VERSION_LABEL = 'FIGURINE';
  const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5';
  const SUPPORTED_CLAUDE_MODELS = Object.freeze([
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { value: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
    { value: 'claude-sonnet-4-0', label: 'Claude Sonnet 4.0' },
    { value: 'claude-opus-4-1', label: 'Claude Opus 4.1' },
    { value: 'claude-opus-4-0', label: 'Claude Opus 4.0' },
    { value: 'claude-3-7-sonnet-latest', label: 'Claude Sonnet 3.7' },
    { value: 'claude-3-5-sonnet-latest', label: 'Claude Sonnet 3.5' },
  ]);
  const LEGACY_CLAUDE_MODEL_ALIASES = Object.freeze({
    'claude-opus-4-5-20251101': 'claude-opus-4-5',
  });
  const SUPPORTED_CLAUDE_MODEL_IDS = new Set(SUPPORTED_CLAUDE_MODELS.map((entry) => entry.value));
  const CLAUDE_MODEL_SELECT_IDS = Object.freeze(['tt-launch-model', 'col-launch-model']);
  const DOUBLEX_PROMPT_TOGGLE_IDS = Object.freeze(['tt-doublex-prompt-toggle', 'col-doublex-prompt-toggle']);
  const FETCH_STATUS = {
    idleLabel: 'Fetch',
    loadingLabel: '\u27f3 Fetch...',
    loadingText: 'Recuperation en cours...',
    successTextPrefix: '\u2713',
    successTextSuffix: 'caracteres recuperes',
    successToast: 'Contexte recupere \u2713',
    errorTextPrefix: '\u2717',
    errorToastPrefix: 'Fetch echoue : ',
    successColor: '#4caf7d',
    errorColor: '#ff4757',
  };
  const LICENSE_LABELS = {
    checked: 'Oui \u2014 decrire uniquement via le medium et les termes connexes',
    unchecked: 'Non \u2014 nommer librement le personnage et l\'univers',
  };
  const MISSING_FILES_MESSAGES = {
    title: 'Fichiers manquants :',
    serverHint: 'Verifiez que server.py est lance.',
    buttonPrefix: 'Fichiers manquants',
    toastPrefix: 'fichier(s) manquants en mode',
  };
  const COLLECTION_PERSISTED_TEXT_FIELDS = [
    'col-fParticularites',
    'col-fConsignesExternes',
    'col-fDescriptionFigurine',
    'col-fResumePersonnage',
    'col-fLienPerso',
    'col-fConnexesPrioritaires',
    'col-fArchetypes',
    'col-fArchSeo',
  ];
  const BIBLIO_FILES = ['tags', 'accroches', 'objectif', 'psycho', 'titres', 'bibliotheque-semantique'];
  const formFieldsData = global.PipelineUIDataFormFields || {};
  const formCatalogsData = global.PipelineUIDataFormCatalogs || {};
  const PROMPT_FLAG_BY_FIELD_ID = formFieldsData.PROMPT_FLAG_BY_FIELD_ID || {};

  const TABLETOP_FORM_FIELDS = formFieldsData.TABLETOP_FORM_FIELDS || [
    'tt-fNom',
    'tt-fNomCourt',
    'tt-fUnivers',
    'tt-fSculpteur',
    'tt-fType',
    'tt-fVersion',
    'tt-fPieces',
    'tt-fPose',
    'tt-fArchetypes',
    'tt-fArchSeo',
    'tt-fParticularites',
    'tt-fConsignesExternes',
    'tt-fResumePersonnage',
    'tt-fConnexesPrioritaires',
    'tt-fLienPerso',
    'tt-fDescriptionFigurine',
    'tt-fNotes',
  ];

  const COLLECTION_FORM_FIELDS = formFieldsData.COLLECTION_FORM_FIELDS || [
    'col-fType',
    'col-fNomCourt',
    'col-fNom',
    'col-fUnivers',
    'col-fSculpteur',
    'col-fPieces',
    'col-fDescriptionFigurine',
    'col-fPose',
    'col-fArchetypes',
    'col-fArchSeo',
  ];

  const TABLETOP_FORM_CATALOGS = formCatalogsData.TABLETOP_FORM_CATALOGS || {};
  const COLLECTION_FORM_CATALOGS = formCatalogsData.COLLECTION_FORM_CATALOGS || {};

  const TABLETOP_DYNAMIC_IDS = {
    genreGroup: 'tt-fGenreGroup',
  };

  const COLLECTION_DYNAMIC_IDS = {
    mediumGroup: 'col-fMediumGroup',
    mediumSubcategoriesWrap: 'col-fMediumSubcategoriesWrap',
    mediumSubcategoriesGroup: 'col-fMediumSubcategoriesGroup',
    genreWrap: 'col-fGenreWrap',
    genreGroup: 'col-fGenreGroup',
  };

  const getState = () => global.state;
  const getCurrentMode = () => global.currentMode;
  const getPfx = () => global.pfx();
  const getEchellesApi = () => global.PipelineUIEchelles || {};
  const getConfig = () => global.PipelineUIConfig;
  const getElementById = (id) => document.getElementById(id);
  const getElementValue = (id, fallback = '') => getElementById(id)?.value || fallback;
  const getTrimmedElementValue = (id, fallback = '') => getElementById(id)?.value?.trim() || fallback;
  const isElementChecked = (id) => getElementById(id)?.checked || false;
  const setElementValue = (id, value) => {
    const element = getElementById(id);
    if (element) element.value = value;
  };
  const withElement = (id, callback) => {
    const element = getElementById(id);
    if (element) callback(element);
  };
  const getCheckedValues = (selector) => [...document.querySelectorAll(selector)].map((input) => input.value);
  const formatCommaList = (values = []) => values.join(', ');
  const saveFormStateIfNeeded = () => saveFormState();
  let speechRecognitionInstance = null;
  let speechRecognitionFieldId = '';
  let speechRecognitionSupported = null;

  const getSpeechRecognitionCtor = () => (
    window.SpeechRecognition
    || window.webkitSpeechRecognition
    || null
  );

  const isSpeechRecognitionSupported = () => {
    if (speechRecognitionSupported === null) {
      speechRecognitionSupported = typeof getSpeechRecognitionCtor() === 'function';
    }
    return speechRecognitionSupported;
  };

  const getSpeechRecognitionButtonId = (fieldId = '') => `${String(fieldId || '').trim()}-mic`;

  const isBraveBrowser = () => {
    try {
      return !!global.navigator?.brave;
    } catch (error) {
      return false;
    }
  };

  const setSpeechRecognitionButtonState = (fieldId = '', isListening = false) => {
    const button = getElementById(getSpeechRecognitionButtonId(fieldId));
    if (!button) return;
    button.classList.toggle('is-recording', !!isListening);
    const label = button.querySelector('.ui-icon-label');
    if (label) label.textContent = isListening ? 'Stop' : 'Micro';
  };

  const appendTranscriptToField = (fieldId = '', transcript = '') => {
    const field = getElementById(fieldId);
    const normalizedTranscript = String(transcript || '').trim();
    if (!field || !normalizedTranscript) return;

    const currentValue = String(field.value || '');
    const selectionStart = typeof field.selectionStart === 'number' ? field.selectionStart : currentValue.length;
    const selectionEnd = typeof field.selectionEnd === 'number' ? field.selectionEnd : currentValue.length;
    const before = currentValue.slice(0, selectionStart);
    const after = currentValue.slice(selectionEnd);
    const needsLeadingSpace = before && !/\s$/.test(before);
    const needsTrailingSpace = after && !/^\s/.test(after);
    const insertion = `${needsLeadingSpace ? ' ' : ''}${normalizedTranscript}${needsTrailingSpace ? ' ' : ''}`;
    const nextValue = `${before}${insertion}${after}`;
    const nextCaret = before.length + insertion.length;

    field.value = nextValue;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
    if (typeof field.setSelectionRange === 'function') {
      field.setSelectionRange(nextCaret, nextCaret);
    }
  };

  const pasteClipboardToField = async (fieldId = '') => {
    const normalizedFieldId = String(fieldId || '').trim();
    const field = getElementById(normalizedFieldId);
    if (!field) {
      global.showToast('Champ introuvable', '#ff4757', 3000);
      return;
    }

    if (!navigator.clipboard?.readText) {
      global.showToast('Collage indisponible dans ce navigateur', '#ff4757', 3500);
      return;
    }

    try {
      const clipboardText = String(await navigator.clipboard.readText() || '').trim();
      if (!clipboardText) {
        global.showToast('Presse-papiers vide', '#ff4757', 2500);
        return;
      }

      appendTranscriptToField(normalizedFieldId, clipboardText);
      saveFormState();
      global.showToast('Texte colle', '#7eb8f7', 1800);
    } catch (error) {
      global.showToast('Lecture du presse-papiers refusee', '#ff4757', 3500);
    }
  };

  const stopExternalInstructionDictationInternal = ({ silent = false } = {}) => {
    const activeFieldId = speechRecognitionFieldId;
    const recognition = speechRecognitionInstance;
    speechRecognitionFieldId = '';
    speechRecognitionInstance = null;
    if (activeFieldId) setSpeechRecognitionButtonState(activeFieldId, false);
    if (recognition) {
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      } catch (error) {}
    }
    if (!silent && activeFieldId) global.showToast('Dictée arrêtée', '#e8c547', 1800);
  };

  const getStoredJSONEntry = (key) => {
    try {
      const rawValue = localStorage.getItem(key);
      if (!rawValue) return { found: false, value: null };
      return { found: true, value: JSON.parse(rawValue) };
    } catch (error) {
      return { found: false, value: null };
    }
  };

  const readStoredJSON = (key, fallback) => {
    const entry = getStoredJSONEntry(key);
    return entry.found ? entry.value : fallback;
  };

  const writeStoredJSON = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const collectFieldValues = (fieldIds) => fieldIds.reduce((data, id) => {
    const element = getElementById(id);
    if (element) data[id] = element.value;
    return data;
  }, {});

  const buildPipelinePromptContext = (pipelineRun = {}) => ({
    pipeline_form_snapshot: pipelineRun.formSnapshot || '',
    pipeline_cumulatif: pipelineRun.cumulativeText || '',
    pipeline_warmup_hint: pipelineRun.warmupHint || '',
  });

  const restoreFieldValues = (fieldIds, data) => {
    fieldIds.forEach((id) => {
      if (data[id] !== undefined) setElementValue(id, data[id]);
    });
  };

  const collectScaleEntries = (prefix, count, labels = []) => Array.from({ length: count }, (_, index) => ({
    checked: isElementChecked(`${prefix}-ec${index}`),
    dim: getElementValue(`${prefix}-ed${index}`),
    source: document.getElementById(`${prefix}-ei${index}`)?.dataset?.dimensionSource || '',
    label: labels[index] || '',
  }));

  const restoreScaleEntries = (entries, prefix, labels = []) => {
    if (!Array.isArray(entries)) return;

    entries.forEach((entry, savedIndex) => {
      const labelIndex = entry.label ? labels.findIndex((label) => label === entry.label) : -1;
      const index = labelIndex >= 0
        ? labelIndex
        : (prefix === 'col' && !entry.label ? savedIndex + 3 : savedIndex);
      const checkbox = getElementById(`${prefix}-ec${index}`);
      if (checkbox && entry.checked) {
        checkbox.checked = true;
        global.toggleEch(index, { shouldSave: false });
      }
      if (entry.dim) setElementValue(`${prefix}-ed${index}`, entry.dim);
      if (entry.source && typeof global.PipelineUIEchelles?.setRowDimensionSource === 'function') {
        global.PipelineUIEchelles.setRowDimensionSource(index, entry.source);
      }
    });
  };

  const setCheckedValues = (selector, selectedValues = []) => {
    const selected = new Set(selectedValues || []);
    document.querySelectorAll(selector).forEach((input) => {
      input.checked = selected.has(input.value);
    });
  };

  const attachSaveListener = (id) => {
    withElement(id, (element) => {
      element.addEventListener('input', saveFormState);
      if (element.tagName === 'SELECT') {
        element.addEventListener('change', saveFormState);
      }
    });
  };

  const readAppSettings = () => readStoredJSON(APP_SETTINGS_STORAGE_KEY, {});

  const writeAppSettings = (nextSettings) => {
    writeStoredJSON(APP_SETTINGS_STORAGE_KEY, nextSettings);
  };

  const shouldUseDoublexShopPrompts = () => readAppSettings().doublexUseShopPrompts !== false;

  const writeDoublexPromptToggleSetting = (enabled) => {
    const settings = readAppSettings();
    settings.doublexUseShopPrompts = enabled !== false;
    writeAppSettings(settings);
  };

  const getActiveShopKey = () => {
    const rawValue = String(readAppSettings().activeShop || '').trim();
    return rawValue === 'doublex' ? 'doublex' : 'grosgeek';
  };
  const syncDoublexPromptToggleUi = () => {
    const isDoublexActive = getActiveShopKey() === 'doublex';
    const enabled = shouldUseDoublexShopPrompts();
    document.querySelectorAll('[data-js="doublex-prompt-toggle-wrap"]').forEach((node) => {
      node.hidden = !isDoublexActive;
    });
    DOUBLEX_PROMPT_TOGGLE_IDS.forEach((id) => {
      const input = getElementById(id);
      if (input) input.checked = enabled;
    });
  };
  const getPromptFileMapForCurrentContext = (mode = getCurrentMode()) => (
    getConfig().resolvePromptFileMap?.(mode, getActiveShopKey(), { useDoublexShopPrompts: shouldUseDoublexShopPrompts() })
      || (mode === 'collection' ? getConfig().PROMPT_FILE_MAP_COLLECTION : getConfig().PROMPT_FILE_MAP)
  );
  const getPromptFolderForCurrentContext = (mode = getCurrentMode()) => (
    getConfig().resolvePromptFolder?.(mode, getActiveShopKey(), { useDoublexShopPrompts: shouldUseDoublexShopPrompts() })
      || `prompts/${mode}`
  );

  const renderSelectOptions = (selectId, options = [], selectedValue = null) => {
    const select = getElementById(selectId);
    if (!select) return;

    const nextValue = selectedValue ?? select.value;
    select.innerHTML = options.map((option) => (
      `<option value="${String(option.value)}">${String(option.label)}</option>`
    )).join('');

    if (options.some((option) => option.value === nextValue)) {
      select.value = nextValue;
    } else if (options.length > 0) {
      select.value = options[0].value;
    }
  };

  const renderCheckboxGroup = ({ rootId, options = [], selectedValues = [], onChange = null }) => {
    const root = getElementById(rootId);
    if (!root) return;

    const selected = new Set((selectedValues || []).map((value) => String(value)));
    root.innerHTML = options.map((option) => {
      const checked = selected.has(String(option.value)) ? ' checked' : '';
      return `<label class="social-check"><input type="checkbox" value="${String(option.value)}"${checked}/> ${String(option.label)}</label>`;
    }).join('');

    root.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', () => {
        if (typeof onChange === 'function') {
          onChange();
          return;
        }

        saveFormState();
      });
    });
  };

  const ensureCollectionDynamicField = ({ wrapperId, groupId, labelText, hintText }) => {
    let wrapper = getElementById(wrapperId);
    if (wrapper) return wrapper;

    const mediumGroup = getElementById(COLLECTION_DYNAMIC_IDS.mediumGroup);
    const mediumField = mediumGroup?.closest('.fg.full');
    const formGrid = mediumField?.parentElement;
    if (!mediumField || !formGrid) return null;

    wrapper = document.createElement('div');
    wrapper.id = wrapperId;
    wrapper.className = 'fg full';
    wrapper.innerHTML = `
      <label>${labelText} <span class="fg-hint">\u2192 ${hintText}</span></label>
      <div id="${groupId}" class="option-chip-group"></div>
    `;

    mediumField.insertAdjacentElement('afterend', wrapper);
    return wrapper;
  };

  const ensureCollectionMediumMetaFields = () => {
    ensureCollectionDynamicField({
      wrapperId: COLLECTION_DYNAMIC_IDS.mediumSubcategoriesWrap,
      groupId: COLLECTION_DYNAMIC_IDS.mediumSubcategoriesGroup,
      labelText: 'Sous-categories de medium',
      hintText: 'contexte supplementaire pour les agents',
    });

    ensureCollectionDynamicField({
      wrapperId: COLLECTION_DYNAMIC_IDS.genreWrap,
      groupId: COLLECTION_DYNAMIC_IDS.genreGroup,
      labelText: 'Genres transverses',
      hintText: 'ambiance, tonalite, sous-genre',
    });
  };

  const getTabletopGenreValues = () => getCheckedValues(`#${TABLETOP_DYNAMIC_IDS.genreGroup} input:checked`);
  const getCollectionMediumValues = () => getCheckedValues(`#${COLLECTION_DYNAMIC_IDS.mediumGroup} input:checked`);
  const getCollectionMediumSubcategoryValues = () => getCheckedValues(`#${COLLECTION_DYNAMIC_IDS.mediumSubcategoriesGroup} input:checked`);
  const getCollectionGenreValues = () => getCheckedValues(`#${COLLECTION_DYNAMIC_IDS.genreGroup} input:checked`);

  const renderCollectionMediumMeta = ({ selectedSubcategories = null, selectedGenres = null, shouldSave = false } = {}) => {
    ensureCollectionMediumMetaFields();

    const selectedMedia = getCollectionMediumValues();
    const currentSubcategories = selectedSubcategories || getCollectionMediumSubcategoryValues();
    const currentGenres = selectedGenres || getCollectionGenreValues();
    const subcategoryOptions = typeof formCatalogsData.getCollectionSubcategoriesForMedia === 'function'
      ? formCatalogsData.getCollectionSubcategoriesForMedia(selectedMedia)
      : [];
    const genreOptions = COLLECTION_FORM_CATALOGS.sharedGenres || [];

    renderCheckboxGroup({
      rootId: COLLECTION_DYNAMIC_IDS.mediumSubcategoriesGroup,
      options: subcategoryOptions,
      selectedValues: currentSubcategories,
      onChange: saveFormStateIfNeeded,
    });

    renderCheckboxGroup({
      rootId: COLLECTION_DYNAMIC_IDS.genreGroup,
      options: genreOptions,
      selectedValues: currentGenres,
      onChange: saveFormStateIfNeeded,
    });

    const subcategoriesWrap = getElementById(COLLECTION_DYNAMIC_IDS.mediumSubcategoriesWrap);
    const genresWrap = getElementById(COLLECTION_DYNAMIC_IDS.genreWrap);
    if (subcategoriesWrap) subcategoriesWrap.style.display = subcategoryOptions.length ? '' : 'none';
    if (genresWrap) genresWrap.style.display = genreOptions.length ? '' : 'none';

    if (shouldSave) saveFormState();
  };

  const renderTabletopCatalogs = () => {
    renderSelectOptions('tt-fType', TABLETOP_FORM_CATALOGS.typeOptions || []);
    renderSelectOptions('tt-fVersion', TABLETOP_FORM_CATALOGS.versionOptions || []);
    renderCheckboxGroup({
      rootId: TABLETOP_DYNAMIC_IDS.genreGroup,
      options: COLLECTION_FORM_CATALOGS.sharedGenres || [],
      selectedValues: getTabletopGenreValues(),
      onChange: saveFormStateIfNeeded,
    });
  };

  const renderCollectionCatalogs = () => {
    renderSelectOptions('col-fType', COLLECTION_FORM_CATALOGS.typeOptions || []);
    renderCheckboxGroup({
      rootId: COLLECTION_DYNAMIC_IDS.mediumGroup,
      options: (COLLECTION_FORM_CATALOGS.media || []).map((entry) => ({ value: entry.value, label: entry.label })),
      selectedValues: getCollectionMediumValues(),
      onChange: () => {
        renderCollectionMediumMeta({ shouldSave: false });
        saveFormState();
      },
    });
    renderCollectionMediumMeta({ shouldSave: false });
  };

  function applyPromptFlagAttributes() {
    Object.entries(PROMPT_FLAG_BY_FIELD_ID).forEach(([fieldId, promptFlag]) => {
      const element = getElementById(fieldId);
      if (!element) return;
      element.dataset.promptFlag = String(promptFlag || '').trim();
    });
  }

  function renderDeclarativeFormCatalogs({ shouldSave = false } = {}) {
    renderTabletopCatalogs();
    renderCollectionCatalogs();
    applyPromptFlagAttributes();
    if (shouldSave) saveFormState();
  }

  const buildCollectionMediumContext = () => {
    const mediums = getCollectionMediumValues();
    const mediumSubcategories = getCollectionMediumSubcategoryValues();
    const genres = getCollectionGenreValues();
    const parts = [];

    if (mediums.length) parts.push(`Mediums: ${formatCommaList(mediums)}`);
    if (mediumSubcategories.length) parts.push(`Sous-categories: ${formatCommaList(mediumSubcategories)}`);
    if (genres.length) parts.push(`Genres: ${formatCommaList(genres)}`);

    return parts.join(' | ');
  };

  const getShopUrl = () => {
    const inputValue = getTrimmedElementValue('shopUrl');
    if (inputValue) return inputValue;

    const settings = readAppSettings();
    const shopUrls = settings.shopUrls && typeof settings.shopUrls === 'object' ? settings.shopUrls : {};
    const savedValue = shopUrls[getActiveShopKey()] || settings.shopUrl;
    return savedValue || DEFAULT_SHOP_URLS[getActiveShopKey()] || DEFAULT_SHOP_URL;
  };

  const persistShopUrl = () => {
    const settings = readAppSettings();
    const activeShopKey = getActiveShopKey();
    settings.shopUrls = settings.shopUrls && typeof settings.shopUrls === 'object'
      ? settings.shopUrls
      : {};
    settings.shopUrls[activeShopKey] = getShopUrl();
    settings.shopUrl = settings.shopUrls[activeShopKey];
    writeAppSettings(settings);
  };

  function normalizeClaudeModelId(value = '') {
    const rawValue = String(value || '').trim();
    if (!rawValue) return DEFAULT_CLAUDE_MODEL;
    const aliasedValue = LEGACY_CLAUDE_MODEL_ALIASES[rawValue] || rawValue;
    return SUPPORTED_CLAUDE_MODEL_IDS.has(aliasedValue) ? aliasedValue : DEFAULT_CLAUDE_MODEL;
  }

  function ensureClaudeModelOptions() {
    CLAUDE_MODEL_SELECT_IDS.forEach((id) => {
      renderSelectOptions(id, SUPPORTED_CLAUDE_MODELS, getElementById(id)?.value || DEFAULT_CLAUDE_MODEL);
    });
  }

  function syncClaudeModelSelects(nextValue = '', sourceId = '') {
    const normalizedValue = normalizeClaudeModelId(nextValue);
    CLAUDE_MODEL_SELECT_IDS.forEach((id) => {
      if (!id || id === sourceId) return;
      const select = getElementById(id);
      if (select) select.value = normalizedValue;
    });
  }

  function getSelectedClaudeModel() {
    const currentPrefix = getCurrentMode() === 'collection' ? 'col' : 'tt';
    const currentSelect = getElementById(`${currentPrefix}-launch-model`);
    const currentValue = normalizeClaudeModelId(currentSelect?.value || '');
    if (currentValue) return currentValue;

    const settingsValue = normalizeClaudeModelId(readAppSettings().selectedClaudeModel || '');
    return settingsValue || DEFAULT_CLAUDE_MODEL;
  }

  function getArchetypes() {
    const prefix = getCurrentMode() === 'collection' ? 'col' : 'tt';
    const archetypes = getElementValue(`${prefix}-fArchetypes`)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return archetypes.join(', ');
  }

  function getMediums() {
    return formatCommaList(getCollectionMediumValues());
  }

  const getCollectionMediumMetaData = () => {
    const mediumSubcategories = formatCommaList(getCollectionMediumSubcategoryValues());
    const genres = formatCommaList(getCollectionGenreValues());
    const mediumContext = buildCollectionMediumContext();

    return {
      mediumSubcategories,
      medium_subcategories: mediumSubcategories,
      genres,
      genresTransverses: genres,
      genres_transverses: genres,
      mediumContext,
      medium_context: mediumContext,
    };
  };

  const getTabletopData = () => {
    const genres = formatCommaList(getTabletopGenreValues());
    const type = getElementValue('tt-fType', 'SOLO');

    return {
      type,
      typePiece: type,
      version: getElementValue('tt-fVersion', DEFAULT_VERSION_LABEL),
      presentationVisuelle: getElementValue('tt-fPresentationVisuelle'),
      natureSujet: getElementValue('tt-fNatureSujet', 'HUMANOIDE'),
      buzz: isElementChecked('tt-fBuzz'),
      buzzNote: getElementValue('tt-fBuzzNote'),
      genres,
      genresTransverses: genres,
      genres_transverses: genres,
      particularites: getElementValue('tt-fParticularites'),
      consignesExternes: getElementValue('tt-fConsignesExternes'),
      consignes_externes: getElementValue('tt-fConsignesExternes'),
      archetypesManuels: getElementValue('tt-fArchetypes'),
      seoElargies: getElementValue('tt-fArchSeo'),
      descriptionFigurine: getElementValue('tt-fDescriptionFigurine'),
      resumePersonnage: getElementValue('tt-fResumePersonnage'),
      connexesPrioritaires: getElementValue('tt-fConnexesPrioritaires'),
      lienPerso: getElementValue('tt-fLienPerso'),
    };
  };

  function getCollectionData() {
    const typePiece = getElementValue('col-fType', DEFAULT_VERSION_LABEL);

    return {
      type: typePiece,
      typePiece,
      medium: getMediums(),
      ...getCollectionMediumMetaData(),
      license: isElementChecked('col-fLicense') ? 'oui' : 'non',
      particularites: getElementValue('col-fParticularites'),
      consignesExternes: getElementValue('col-fConsignesExternes'),
      consignes_externes: getElementValue('col-fConsignesExternes'),
      archetypesManuels: getElementValue('col-fArchetypes'),
      seoElargies: getElementValue('col-fArchSeo'),
      descriptionFigurine: getElementValue('col-fDescriptionFigurine'),
      resumePersonnage: getElementValue('col-fResumePersonnage'),
      connexesPrioritaires: getElementValue('col-fConnexesPrioritaires'),
      lienPerso: getElementValue('col-fLienPerso'),
      buzzCollection: isElementChecked('col-fBuzzCollection'),
      buzzCollectionNote: getElementValue('col-fBuzzCollectionNote'),
    };
  }

  function toggleBuzz(prefix) {
    const checked = isElementChecked(`${prefix}-fBuzz`);
    getElementById(`${prefix}-fBuzzNote`)?.classList.toggle('visible', checked);
  }

  function toggleLicense() {
    const checked = isElementChecked('col-fLicense');
    const label = getElementById('col-licenseLabel');
    if (label) {
      label.textContent = checked ? LICENSE_LABELS.checked : LICENSE_LABELS.unchecked;
    }
    saveFormState();
  }

  function toggleBuzzCollection() {
    getElementById('col-fBuzzCollectionNote')?.classList.toggle('visible', isElementChecked('col-fBuzzCollection'));
    saveFormState();
  }

  async function fetchPersonnage() {
    const url = getTrimmedElementValue('col-fLienPerso');
    if (!url) {
      global.showToast('Saisis un lien avant de fetcher', FETCH_STATUS.errorColor, 4000);
      return;
    }

    const btn = getElementById('fetchBtn-col');
    const status = getElementById('fetchStatus-col');
    if (!btn || !status) return;

    btn.disabled = true;
    btn.textContent = FETCH_STATUS.loadingLabel;
    status.style.display = 'block';
    status.style.color = 'var(--muted)';
    status.textContent = FETCH_STATUS.loadingText;

    try {
      const res = await fetch(`/fetch-url?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setElementValue('col-fResumePersonnage', data.text);
      status.style.color = 'var(--success)';
      status.textContent = `${FETCH_STATUS.successTextPrefix} ${data.chars} ${FETCH_STATUS.successTextSuffix}`;
      saveFormState();
      global.showToast(FETCH_STATUS.successToast, FETCH_STATUS.successColor, 3000);
    } catch (error) {
      status.style.color = 'var(--error)';
      status.textContent = `${FETCH_STATUS.errorTextPrefix} ${error.message}`;
      global.showToast(`${FETCH_STATUS.errorToastPrefix}${error.message}`, FETCH_STATUS.errorColor, 10000);
    } finally {
      btn.disabled = false;
      btn.textContent = FETCH_STATUS.idleLabel;
    }
  }

  function buildCtx(agentId, correction = '') {
    const state = getState();
    const currentMode = getCurrentMode();
    const prefix = getPfx();
    const echellesApi = getEchellesApi();
    const getFieldValue = (suffix) => getTrimmedElementValue(`${prefix}-${suffix}`);
    const formatName = (value) => value.replace(/\b\w/g, (char) => char.toUpperCase());
    const rawNomField = getFieldValue('fNom');
    const rawNomCourtField = getFieldValue('fNomCourt');
    const rawNom = rawNomField || rawNomCourtField || DEFAULT_SUBJECT_NAME;
    const rawNomCourt = rawNomCourtField || rawNom.split(' ')[0];
    const nom = formatName(rawNom);
    const nomCourt = formatName(rawNomCourt);
    const rules = (state.persistentRules[agentId] || []).join('\n');
    const collectionDescription = getElementValue('col-fDescriptionFigurine');
    const collectionResume = getElementValue('col-fResumePersonnage');
    const normalizedOutputs = { ...state.outputs };
    const pipelineRun = state.pipelineRun?.[prefix] || {};
    const base = {
      nom,
      nomCourt,
      univers: getElementValue(`${prefix}-fUnivers`),
      sculpteur: getElementValue(`${prefix}-fSculpteur`, DEFAULT_SCULPTOR_NAME),
      echelles: echellesApi.getEchellesSelected(),
      pieces: getElementValue(`${prefix}-fPieces`),
      dimensions: echellesApi.getDimsFromEchelles(),
      notes: currentMode === 'collection' ? collectionDescription : getElementValue(`${prefix}-fNotes`),
      descriptionFigurine: collectionDescription,
      resumePersonnage: collectionResume,
      pose: getElementValue(`${prefix}-fPose`, DEFAULT_POSE_NAME),
      imageCount: state.images[prefix].length,
      outputs: normalizedOutputs,
      correction,
      rules,
      archetypes: getArchetypes(),
      url_boutique: getShopUrl(),
      social_formats: state._leoFormats || '',
      selectedAccrocheText: state.selectedAccroche?.text || '',
      selectedCTAText: state.selectedCTA?.text || '',
      ...buildPipelinePromptContext(pipelineRun),
      profil_dominant: (() => {
        const match = (state.outputs.marche || '').match(/Dominant\s*:\s*(.+)/i);
        return match ? match[1].trim() : DEFAULT_PROFILE_NAME;
      })(),
    };

    if (currentMode === 'tabletop') {
      Object.assign(base, getTabletopData());
    } else {
      Object.assign(base, getCollectionData());
    }

    const relaunchContext = global.buildListingRelaunchContext?.(prefix, {
      agentId,
      mode: currentMode,
      baseContext: base,
    });
    if (relaunchContext && typeof relaunchContext === 'object') {
      Object.assign(base, relaunchContext);
    }

    const relaunchInstructions = String(base.relaunch_user_instruction || '').trim();
    if (relaunchInstructions) {
      base.correction = [
        String(base.correction || '').trim(),
        `Instructions de relance a appliquer :\n${relaunchInstructions}`,
      ].filter(Boolean).join('\n\n');
    }

    if (agentId === 'description' && String(base.relaunch_internal_instruction || '').trim()) {
      base.correction = [
        String(base.correction || '').trim(),
        String(base.relaunch_internal_instruction || '').trim(),
      ].filter(Boolean).join('\n\n');
    }

    return base;
  }

  function saveFormState() {
    const currentMode = getCurrentMode();
    const echellesApi = getEchellesApi();
    const data = currentMode === 'tabletop'
      ? collectFieldValues(TABLETOP_FORM_FIELDS)
      : collectFieldValues(COLLECTION_FORM_FIELDS);

    if (currentMode === 'tabletop') {
      data._echelles = collectScaleEntries('tt', (echellesApi.ECHELLES || []).length);
      data._dynamicEchelles = echellesApi.isDynamicScaleEnabled?.('tt') || false;
      data._originEchelleIndex = (() => {
        const checked = document.querySelector('input[name="tt-origin-scale"]:checked');
        return checked ? Number(checked.value) : null;
      })();
      data._genres = getTabletopGenreValues();
      data._buzz = isElementChecked('tt-fBuzz');
      data._buzzNote = getElementValue('tt-fBuzzNote');
    } else {
      data._echelles = collectScaleEntries('col', (echellesApi.ECHELLES_COLLECTION || []).length, echellesApi.ECHELLES_COLLECTION || []);
      data._dynamicEchelles = echellesApi.isDynamicScaleEnabled?.('col') || false;
      data._license = isElementChecked('col-fLicense');
      data._mediums = getCollectionMediumValues();
      data._mediumSubcategories = getCollectionMediumSubcategoryValues();
      data._genres = getCollectionGenreValues();
      data._particularites = getElementValue('col-fParticularites');
      data._consignesExternes = getElementValue('col-fConsignesExternes');
      data._archetypesManuels = getElementValue('col-fArchetypes');
      data._seoElargies = getElementValue('col-fArchSeo');
      data._descriptionFigurine = getElementValue('col-fDescriptionFigurine');
      data._resumePersonnage = getElementValue('col-fResumePersonnage');
      data._connexesPrioritaires = getElementValue('col-fConnexesPrioritaires');
      data._lienPerso = getElementValue('col-fLienPerso');
      data._buzz = isElementChecked('col-fBuzzCollection');
      data._buzzNote = getElementValue('col-fBuzzCollectionNote');
      data._originEchelleIndex = (() => {
        const checked = document.querySelector('input[name="col-origin-scale"]:checked');
        return checked ? Number(checked.value) : null;
      })();
      data._originEchelleLabel = Number.isInteger(data._originEchelleIndex)
        ? (echellesApi.ECHELLES_COLLECTION || [])[data._originEchelleIndex] || ''
        : '';
      data._customEchelles = [];
      for (let index = 0; index < (echellesApi.CUSTOM_COLLECTION_COUNT || 0); index += 1) {
        const scaleIndex = (echellesApi.ECHELLES_COLLECTION || []).length + index;
        data._customEchelles.push({
          checked: isElementChecked(`col-ec${scaleIndex}`),
          label: getElementValue(`col-elabel${scaleIndex}`),
          dim: getElementValue(`col-ed${scaleIndex}`),
          source: document.getElementById(`col-ei${scaleIndex}`)?.dataset?.dimensionSource || '',
        });
      }
    }

    writeStoredJSON(`${FORM_STORAGE_KEY_PREFIX}${currentMode}`, data);
  }

  function loadFormState() {
    const currentMode = getCurrentMode();
    const echellesApi = getEchellesApi();
    ensureClaudeModelOptions();
    renderDeclarativeFormCatalogs({ shouldSave: false });

    try {
      const data = readStoredJSON(`${FORM_STORAGE_KEY_PREFIX}${currentMode}`, null);
      if (!data) return;

      if (currentMode === 'tabletop') {
        if (data._dynamicEchelles !== undefined) {
          echellesApi.setDynamicEchellesEnabled?.(data._dynamicEchelles, { shouldSave: false });
        }

        restoreFieldValues(TABLETOP_FORM_FIELDS, data);
        restoreScaleEntries(data._echelles, 'tt');

        if (Number.isInteger(data._originEchelleIndex)) {
          global.setEchelleOrigin(data._originEchelleIndex, { shouldSave: false, recalculate: false });
        }

        setCheckedValues(`#${TABLETOP_DYNAMIC_IDS.genreGroup} input`, data._genres);

        if (data._buzz !== undefined) {
          const buzzEl = getElementById('tt-fBuzz');
          if (buzzEl) {
            buzzEl.checked = data._buzz;
            toggleBuzz('tt');
          }
        }

        if (data._buzzNote !== undefined) {
          setElementValue('tt-fBuzzNote', data._buzzNote);
        }
      } else {
        echellesApi.setDynamicEchellesEnabled?.(data._dynamicEchelles !== undefined ? data._dynamicEchelles : true, { shouldSave: false });

        restoreFieldValues(COLLECTION_FORM_FIELDS, data);
        restoreScaleEntries(data._echelles, 'col', echellesApi.ECHELLES_COLLECTION || []);

        if (data._license !== undefined) {
          const licenseEl = getElementById('col-fLicense');
          if (licenseEl) {
            licenseEl.checked = data._license;
            toggleLicense();
          }
        }

        setCheckedValues(`#${COLLECTION_DYNAMIC_IDS.mediumGroup} input`, data._mediums);
        renderCollectionMediumMeta({
          selectedSubcategories: data._mediumSubcategories || [],
          selectedGenres: data._genres || [],
          shouldSave: false,
        });

        if (data._particularites !== undefined) {
          setElementValue('col-fParticularites', data._particularites);
        }

        if (data._consignesExternes !== undefined) {
          setElementValue('col-fConsignesExternes', data._consignesExternes);
        }

        if (data._archetypesManuels !== undefined) {
          setElementValue('col-fArchetypes', data._archetypesManuels);
        }

        if (data._seoElargies !== undefined) {
          setElementValue('col-fArchSeo', data._seoElargies);
        }

        if (data._descriptionFigurine !== undefined) {
          setElementValue('col-fDescriptionFigurine', data._descriptionFigurine);
        }

        if (data._resumePersonnage !== undefined) {
          setElementValue('col-fResumePersonnage', data._resumePersonnage);
        }

        if (data._connexesPrioritaires !== undefined) {
          setElementValue('col-fConnexesPrioritaires', data._connexesPrioritaires);
        }

        if (data._lienPerso !== undefined) {
          setElementValue('col-fLienPerso', data._lienPerso);
        }

        if (data._buzz !== undefined) {
          const buzzEl = getElementById('col-fBuzzCollection');
          if (buzzEl) {
            buzzEl.checked = data._buzz;
            toggleBuzzCollection();
          }
        }

        if (data._buzzNote !== undefined) {
          setElementValue('col-fBuzzCollectionNote', data._buzzNote);
        }

        const collectionScaleList = echellesApi.ECHELLES_COLLECTION || [];
        const legacyOneFifthEntry = Array.isArray(data._customEchelles)
          ? data._customEchelles.find((entry) => String(entry?.label || '').trim() === '1/5')
          : null;
        const oneFifthIndex = collectionScaleList.findIndex((label) => String(label || '').trim() === '1/5');

        if (legacyOneFifthEntry && oneFifthIndex >= 0) {
          const checkbox = getElementById(`col-ec${oneFifthIndex}`);
          if (checkbox && legacyOneFifthEntry.checked) {
            checkbox.checked = true;
            global.toggleEch(oneFifthIndex, { shouldSave: false });
          }
          if (legacyOneFifthEntry.dim) setElementValue(`col-ed${oneFifthIndex}`, legacyOneFifthEntry.dim);
          if (legacyOneFifthEntry.source && typeof global.PipelineUIEchelles?.setRowDimensionSource === 'function') {
            global.PipelineUIEchelles.setRowDimensionSource(oneFifthIndex, legacyOneFifthEntry.source);
          }
        }

        const originLabelIndex = data._originEchelleLabel
          ? (echellesApi.ECHELLES_COLLECTION || []).findIndex((label) => label === data._originEchelleLabel)
          : -1;
        const originIndex = originLabelIndex >= 0
          ? originLabelIndex
          : (Number.isInteger(data._originEchelleIndex) ? data._originEchelleIndex + 3 : null);
        if (Number.isInteger(originIndex)) {
          global.setEchelleOrigin(originIndex, { shouldSave: false, recalculate: false });
        }

        echellesApi.refreshCollectionAutoDimensions?.({ shouldSave: false, force: true });
      }
    } catch (error) {}
  }

  function attachFormPersistence() {
    TABLETOP_FORM_FIELDS.forEach(attachSaveListener);
    COLLECTION_FORM_FIELDS.forEach(attachSaveListener);
    COLLECTION_PERSISTED_TEXT_FIELDS.forEach(attachSaveListener);

    CLAUDE_MODEL_SELECT_IDS.forEach((id) => {
      const select = getElementById(id);
      if (!select) return;
      select.addEventListener('change', () => {
        const settings = readAppSettings();
        settings.selectedClaudeModel = normalizeClaudeModelId(select.value || '');
        writeAppSettings(settings);
        syncClaudeModelSelects(settings.selectedClaudeModel, id);
      });
    });

    DOUBLEX_PROMPT_TOGGLE_IDS.forEach((id) => {
      const input = getElementById(id);
      if (!input) return;
      input.addEventListener('change', async () => {
        const enabled = !!input.checked;
        writeDoublexPromptToggleSetting(enabled);
        syncDoublexPromptToggleUi();
        await loadAllFiles(true);
        global.showToast(
          enabled ? 'Prompts DoubleXindustrie actifs' : 'Prompts classiques actifs',
          enabled ? '#f2a3c7' : '#e8c547',
          2500,
        );
      });
    });

    const shopUrlEl = getElementById('shopUrl');
    if (shopUrlEl) shopUrlEl.addEventListener('input', persistShopUrl);
  }

  function toggleExternalInstructionDictation(fieldId = '') {
    const normalizedFieldId = String(fieldId || '').trim();
    if (!normalizedFieldId) return;

    if (!isSpeechRecognitionSupported()) {
      global.showToast('Reco vocale non supportée par ce navigateur', '#ff4757', 4000);
      return;
    }

    if (speechRecognitionFieldId === normalizedFieldId && speechRecognitionInstance) {
      stopExternalInstructionDictationInternal();
      return;
    }

    if (speechRecognitionInstance) {
      stopExternalInstructionDictationInternal({ silent: true });
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    const field = getElementById(normalizedFieldId);
    if (!SpeechRecognitionCtor || !field) {
      global.showToast('Champ de dictée introuvable', '#ff4757', 3000);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    speechRecognitionFieldId = normalizedFieldId;
    speechRecognitionInstance = recognition;
    setSpeechRecognitionButtonState(normalizedFieldId, true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .slice(event.resultIndex || 0)
        .filter((result) => result?.isFinal)
        .map((result) => String(result?.[0]?.transcript || '').trim())
        .filter(Boolean)
        .join(' ');
      appendTranscriptToField(normalizedFieldId, transcript);
    };

    recognition.onerror = (event) => {
      const errorCode = String(event?.error || '').trim();
      console.error('[dictation] speech recognition error', {
        fieldId: normalizedFieldId,
        error: errorCode || 'unknown',
        message: String(event?.message || '').trim(),
        type: String(event?.type || '').trim(),
        isBrave: isBraveBrowser(),
        userAgent: String(global.navigator?.userAgent || ''),
        event,
      });
      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
        global.showToast('Micro refusé par le navigateur', '#ff4757', 4000);
      } else if (errorCode === 'no-speech') {
        global.showToast('Aucune voix détectée', '#e8c547', 2500);
      } else {
        global.showToast(`Erreur dictée : ${errorCode || 'inconnue'}`, '#ff4757', 4000);
      }
    };

    recognition.onend = () => {
      speechRecognitionFieldId = '';
      speechRecognitionInstance = null;
      setSpeechRecognitionButtonState(normalizedFieldId, false);
      saveFormState();
    };

    try {
      field.focus();
      recognition.start();
      global.showToast('Dictée démarrée', '#7eb8f7', 1800);
    } catch (error) {
      speechRecognitionFieldId = '';
      speechRecognitionInstance = null;
      setSpeechRecognitionButtonState(normalizedFieldId, false);
      global.showToast(`Impossible de démarrer la dictée : ${error.message}`, '#ff4757', 4000);
    }
  }

  function loadPersistedData() {
    const state = getState();
    try {
      const rules = readStoredJSON('pipeline.rules', null);
      if (rules) {
        state.persistentRules = rules;
        Object.keys(state.persistentRules).forEach((id) => global.refreshRules(id));
      }
    } catch (error) {}

    try {
      const settings = readAppSettings();
      const shopUrlEl = getElementById('shopUrl');
      const activeShopKey = String(settings.activeShop || '').trim() === 'doublex' ? 'doublex' : 'grosgeek';
      const shopUrls = settings.shopUrls && typeof settings.shopUrls === 'object' ? settings.shopUrls : {};
      if (shopUrlEl) shopUrlEl.value = shopUrls[activeShopKey] || settings.shopUrl || DEFAULT_SHOP_URLS[activeShopKey] || DEFAULT_SHOP_URL;
      syncDoublexPromptToggleUi();

      ensureClaudeModelOptions();
      const selectedClaudeModel = normalizeClaudeModelId(settings.selectedClaudeModel || '');
      settings.selectedClaudeModel = selectedClaudeModel;
      writeAppSettings(settings);
      CLAUDE_MODEL_SELECT_IDS.forEach((id) => {
        const select = getElementById(id);
        if (select) select.value = selectedClaudeModel;
      });

      if (settings.mode && settings.mode !== getCurrentMode()) {
        global.currentMode = settings.mode;
        state.mode = settings.mode;
        document.body.classList.toggle('mode-collection', settings.mode === 'collection');
      }

      if (settings.view && settings.view === 'form') {
        global._restoreView = settings.view;
        global._restoreMode = settings.mode;
      }
    } catch (error) {}
  }

  async function loadAllFiles(silent = false) {
    const state = getState();
    const currentMode = getCurrentMode();
    const prefix = getPfx();
    const config = getConfig();
    const promptFileMap = getPromptFileMapForCurrentContext(currentMode);
    const promptFolder = getPromptFolderForCurrentContext(currentMode);
    const promptFiles = Object.entries(promptFileMap);
    const missing = [];
    const mode = currentMode;

    await Promise.all([
      ...promptFiles.map(async ([agentId, fileName]) => {
        try {
          const res = await fetch(`/files/${promptFolder}/${fileName}.md`);
          if (!res.ok) {
            missing.push(`${promptFolder}/${fileName}.md`);
            return;
          }
          state.promptsByMode[mode][agentId] = await res.text();
        } catch (error) {
          missing.push(`${promptFolder}/${fileName}.md`);
        }
      }),
      ...BIBLIO_FILES.map(async (key) => {
        try {
          const res = await fetch(`/files/biblios/${mode}/${key}.md`);
          if (!res.ok) {
            missing.push(`biblios/${mode}/${key}.md`);
            return;
          }
          state.bibliosByMode[mode][key] = await res.text();
        } catch (error) {
          missing.push(`biblios/${mode}/${key}.md`);
        }
      }),
    ]);

    if (mode !== getCurrentMode()) return;

    const btn = getElementById(`runBtn-${prefix}`);
    if (missing.length > 0) {
      if (!silent) {
        const list = missing.map((file) => `  \u2022 ${file}`).join('\n');
        alert(`${MISSING_FILES_MESSAGES.title}\n\n${list}\n\n${MISSING_FILES_MESSAGES.serverHint}`);
      } else {
        global.showToast(`${missing.length} ${MISSING_FILES_MESSAGES.toastPrefix} ${mode}`, FETCH_STATUS.errorColor, 10000);
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = `${MISSING_FILES_MESSAGES.buttonPrefix} (${mode})`;
      }
    } else if (btn) {
      btn.disabled = false;
      btn.textContent = '\u25b6';
    }
  }

  global.PipelineUIForms = {
    FORM_FIELDS_TT: TABLETOP_FORM_FIELDS,
    FORM_FIELDS_COL: COLLECTION_FORM_FIELDS,
    TABLETOP_FORM_FIELDS,
    COLLECTION_FORM_FIELDS,
    getArchetypes,
    getSelectedClaudeModel,
    normalizeClaudeModelId,
    getMediums,
    getCollectionData,
    getCollectionMediumSubcategoryValues,
    getCollectionGenreValues,
    renderCollectionMediumMeta,
    renderDeclarativeFormCatalogs,
    applyPromptFlagAttributes,
    toggleBuzz,
    toggleLicense,
    toggleBuzzCollection,
    fetchPersonnage,
    buildCtx,
    saveFormState,
    loadFormState,
    attachFormPersistence,
    loadPersistedData,
    loadAllFiles,
    getActiveShopKey,
    syncDoublexPromptToggleUi,
    toggleExternalInstructionDictation,
    pasteClipboardToField,
    stopExternalInstructionDictation: stopExternalInstructionDictationInternal,
  };

  global.PipelineUI.forms = global.PipelineUI.forms || {};
  Object.assign(global.PipelineUI.forms, global.PipelineUIForms);
  Object.assign(global, global.PipelineUIForms);
})(window);
