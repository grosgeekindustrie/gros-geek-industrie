(function initPipelineUIForms(global) {

// Formulaires, persistance locale et context builder.
// Ce module centralise la lecture/ecriture des champs et construit le contexte injecte
// dans les prompts. Toute evolution ici peut impacter plusieurs agents a la fois.
  global.PipelineUI = global.PipelineUI || {};

  const DEFAULT_SHOP_URL = 'https://grosgeekindustrie.etsy.com';
  const APP_SETTINGS_STORAGE_KEY = 'pipeline.settings';
  const FORM_STORAGE_KEY_PREFIX = 'pipeline.form.';
  const DEFAULT_SUBJECT_NAME = 'Figurine';
  const DEFAULT_SCULPTOR_NAME = 'Inconnu';
  const DEFAULT_POSE_NAME = 'MUSEUM';
  const DEFAULT_PROFILE_NAME = 'hobbyiste';
  const DEFAULT_VERSION_LABEL = 'FIGURINE';
  const PIPELINE_RULES_STORAGE_KEY = 'pipeline.rules';
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
    'col-fDescriptionFigurine',
    'col-fResumePersonnage',
    'col-fLienPerso',
    'col-fConnexesPrioritaires',
  ];
  const COLLECTION_PERSISTED_TEXT_FIELD_STORAGE_MAP = {
    _particularites: 'col-fParticularites',
    _descriptionFigurine: 'col-fDescriptionFigurine',
    _resumePersonnage: 'col-fResumePersonnage',
    _connexesPrioritaires: 'col-fConnexesPrioritaires',
    _lienPerso: 'col-fLienPerso',
  };
  const BIBLIO_FILES = ['tags', 'accroches', 'objectif', 'psycho', 'titres', 'bibliotheque-semantique'];
  const formFieldsData = global.PipelineUIDataFormFields || {};
  const formCatalogsData = global.PipelineUIDataFormCatalogs || {};

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
  const getSelectedScaleOriginIndex = (name) => {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? Number(checked.value) : null;
  };
  const setScaleOriginFromStorage = (originIndex) => {
    if (Number.isInteger(originIndex)) {
      global.setEchelleOrigin(originIndex, { shouldSave: false, recalculate: false });
    }
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

  const collectScaleEntries = (prefix, count) => Array.from({ length: count }, (_, index) => ({
    checked: isElementChecked(`${prefix}-ec${index}`),
    dim: getElementValue(`${prefix}-ed${index}`),
    source: document.getElementById(`${prefix}-ei${index}`)?.dataset?.dimensionSource || '',
  }));

  const restoreScaleEntries = (entries, prefix) => {
    if (!Array.isArray(entries)) return;

    entries.forEach((entry, index) => {
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

  const saveCollectionPersistedTextFields = (data) => {
    Object.entries(COLLECTION_PERSISTED_TEXT_FIELD_STORAGE_MAP).forEach(([storageKey, fieldId]) => {
      data[storageKey] = getElementValue(fieldId);
    });
  };

  const restoreCollectionPersistedTextFields = (data) => {
    Object.entries(COLLECTION_PERSISTED_TEXT_FIELD_STORAGE_MAP).forEach(([storageKey, fieldId]) => {
      if (data[storageKey] !== undefined) {
        setElementValue(fieldId, data[storageKey]);
      }
    });
  };

  const saveCollectionCustomScales = (data, echellesApi) => {
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
  };

  const restoreCollectionCustomScales = (customScales, echellesApi) => {
    if (!Array.isArray(customScales)) return;

    customScales.forEach((entry, index) => {
      const scaleIndex = (echellesApi.ECHELLES_COLLECTION || []).length + index;
      const checkbox = getElementById(`col-ec${scaleIndex}`);
      if (entry.label) setElementValue(`col-elabel${scaleIndex}`, entry.label);
      if (checkbox && entry.checked) {
        checkbox.checked = true;
        global.toggleEch(scaleIndex, { shouldSave: false });
      }
      if (entry.dim) setElementValue(`col-ed${scaleIndex}`, entry.dim);
      if (entry.source && typeof global.PipelineUIEchelles?.setRowDimensionSource === 'function') {
        global.PipelineUIEchelles.setRowDimensionSource(scaleIndex, entry.source);
      }
    });
  };

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

  function renderDeclarativeFormCatalogs({ shouldSave = false } = {}) {
    renderTabletopCatalogs();
    renderCollectionCatalogs();
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

    const savedValue = readAppSettings().shopUrl;
    return savedValue || DEFAULT_SHOP_URL;
  };

  const persistShopUrl = () => {
    const settings = readAppSettings();
    settings.shopUrl = getShopUrl();
    writeAppSettings(settings);
  };

  function getArchetypes() {
    if (getCurrentMode() !== 'tabletop') return '';

    const archetypes = getElementValue('tt-fArchetypes')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const seo = getElementValue('tt-fArchSeo')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const parts = [];

    if (archetypes.length) parts.push(`Archetypes: ${archetypes.join(', ')}`);
    if (seo.length) parts.push(`SEO elargi: ${seo.join(', ')}`);

    return parts.join(' | ') || '';
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

    return {
      type: getElementValue('tt-fType', 'SOLO'),
      version: getElementValue('tt-fVersion', DEFAULT_VERSION_LABEL),
      presentationVisuelle: getElementValue('tt-fPresentationVisuelle'),
      natureSujet: getElementValue('tt-fNatureSujet', 'HUMANOIDE'),
      buzz: isElementChecked('tt-fBuzz'),
      buzzNote: getElementValue('tt-fBuzzNote'),
      genres,
      genresTransverses: genres,
      genres_transverses: genres,
      particularites: getElementValue('tt-fParticularites'),
      archetypesManuels: getElementValue('tt-fArchetypes'),
      seoElargies: getElementValue('tt-fArchSeo'),
      descriptionFigurine: getElementValue('tt-fDescriptionFigurine'),
      resumePersonnage: getElementValue('tt-fResumePersonnage'),
      connexesPrioritaires: getElementValue('tt-fConnexesPrioritaires'),
      lienPerso: getElementValue('tt-fLienPerso'),
    };
  };

  function getCollectionData() {
    return {
      typePiece: getElementValue('col-fType', DEFAULT_VERSION_LABEL),
      medium: getMediums(),
      ...getCollectionMediumMetaData(),
      license: isElementChecked('col-fLicense') ? 'oui' : 'non',
      particularites: getElementValue('col-fParticularites'),
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
      data._originEchelleIndex = getSelectedScaleOriginIndex('tt-origin-scale');
      data._genres = getTabletopGenreValues();
      data._buzz = isElementChecked('tt-fBuzz');
      data._buzzNote = getElementValue('tt-fBuzzNote');
    } else {
      data._echelles = collectScaleEntries('col', (echellesApi.ECHELLES_COLLECTION || []).length);
      data._dynamicEchelles = echellesApi.isDynamicScaleEnabled?.('col') || false;
      data._license = isElementChecked('col-fLicense');
      data._mediums = getCollectionMediumValues();
      data._mediumSubcategories = getCollectionMediumSubcategoryValues();
      data._genres = getCollectionGenreValues();
      saveCollectionPersistedTextFields(data);
      data._buzz = isElementChecked('col-fBuzzCollection');
      data._buzzNote = getElementValue('col-fBuzzCollectionNote');
      data._originEchelleIndex = getSelectedScaleOriginIndex('col-origin-scale');
      saveCollectionCustomScales(data, echellesApi);
    }

    writeStoredJSON(`${FORM_STORAGE_KEY_PREFIX}${currentMode}`, data);
  }

  function loadFormState() {
    const currentMode = getCurrentMode();
    const echellesApi = getEchellesApi();
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

        setScaleOriginFromStorage(data._originEchelleIndex);

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
        restoreScaleEntries(data._echelles, 'col');

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

        restoreCollectionPersistedTextFields(data);

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

        restoreCollectionCustomScales(data._customEchelles, echellesApi);
        setScaleOriginFromStorage(data._originEchelleIndex);
      }
    } catch (_error) {}
  }

  function attachFormPersistence() {
    TABLETOP_FORM_FIELDS.forEach(attachSaveListener);
    COLLECTION_FORM_FIELDS.forEach(attachSaveListener);
    COLLECTION_PERSISTED_TEXT_FIELDS.forEach(attachSaveListener);

    const apiKeyEl = getElementById('apiKey');
    if (apiKeyEl) {
      apiKeyEl.addEventListener('input', () => {
        const settings = readAppSettings();
        settings.apiKey = apiKeyEl.value;
        writeAppSettings(settings);
      });
    }

    const shopUrlEl = getElementById('shopUrl');
    if (shopUrlEl) shopUrlEl.addEventListener('input', persistShopUrl);
  }

  function loadPersistedData() {
    const state = getState();
    try {
      const rules = readStoredJSON(PIPELINE_RULES_STORAGE_KEY, null);
      if (rules) {
        state.persistentRules = rules;
        Object.keys(state.persistentRules).forEach((id) => global.refreshRules(id));
      }
    } catch (_error) {}

    try {
      const settings = readAppSettings();
      const apiKeyEl = getElementById('apiKey');
      if (apiKeyEl && settings.apiKey) apiKeyEl.value = settings.apiKey;

      const shopUrlEl = getElementById('shopUrl');
      if (shopUrlEl) shopUrlEl.value = settings.shopUrl || DEFAULT_SHOP_URL;

      if (settings.mode && settings.mode !== getCurrentMode()) {
        global.currentMode = settings.mode;
        state.mode = settings.mode;
        document.body.classList.toggle('mode-collection', settings.mode === 'collection');
      }

      if (settings.view && settings.view === 'form') {
        global._restoreView = settings.view;
        global._restoreMode = settings.mode;
      }
    } catch (_error) {}
  }

  const formatMarkdownFilePath = (family, mode, fileName) => `${family}/${mode}/${fileName}.md`;
  const loadMarkdownFile = async ({ filePath, onSuccess, missing }) => {
    try {
      const response = await fetch(`/files/${filePath}`);
      if (!response.ok) {
        missing.push(filePath);
        return;
      }

      const markdownContent = await response.text();
      onSuccess(markdownContent);
    } catch (_error) {
      missing.push(filePath);
    }
  };

  const setRunButtonMissingState = (button, mode) => {
    if (!button) return;
    button.disabled = true;
    button.textContent = `${MISSING_FILES_MESSAGES.buttonPrefix} (${mode})`;
  };

  const setRunButtonReadyState = (button) => {
    if (!button) return;
    button.disabled = false;
    button.textContent = '\u25b6';
  };

  async function loadAllFiles(silent = false) {
    const state = getState();
    const currentMode = getCurrentMode();
    const prefix = getPfx();
    const config = getConfig();
    const promptFileMap = currentMode === 'collection'
      ? config.PROMPT_FILE_MAP_COLLECTION
      : config.PROMPT_FILE_MAP;
    const promptFiles = Object.entries(promptFileMap);
    const missing = [];
    const mode = currentMode;

    await Promise.all([
      ...promptFiles.map(async ([agentId, fileName]) => {
        const filePath = formatMarkdownFilePath('prompts', mode, fileName);
        await loadMarkdownFile({
          filePath,
          missing,
          onSuccess: (markdownContent) => {
            state.promptsByMode[mode][agentId] = markdownContent;
          },
        });
      }),
      ...BIBLIO_FILES.map(async (key) => {
        const filePath = formatMarkdownFilePath('biblios', mode, key);
        await loadMarkdownFile({
          filePath,
          missing,
          onSuccess: (markdownContent) => {
            state.bibliosByMode[mode][key] = markdownContent;
          },
        });
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

      setRunButtonMissingState(btn, mode);
    } else {
      setRunButtonReadyState(btn);
    }
  }

  global.PipelineUIForms = {
    FORM_FIELDS_TT: TABLETOP_FORM_FIELDS,
    FORM_FIELDS_COL: COLLECTION_FORM_FIELDS,
    TABLETOP_FORM_FIELDS,
    COLLECTION_FORM_FIELDS,
    getArchetypes,
    getMediums,
    getCollectionData,
    getCollectionMediumSubcategoryValues,
    getCollectionGenreValues,
    renderCollectionMediumMeta,
    renderDeclarativeFormCatalogs,
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
  };

  global.PipelineUI.forms = global.PipelineUI.forms || {};
  Object.assign(global.PipelineUI.forms, global.PipelineUIForms);
  Object.assign(global, global.PipelineUIForms);
})(window);
