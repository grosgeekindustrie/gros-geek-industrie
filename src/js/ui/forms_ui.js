(function initPipelineUIForms(global) {

// Formulaires, persistance locale et context builder.
// Ce module centralise la lecture/écriture des champs et construit le contexte injecté
// dans les prompts. Toute évolution ici peut impacter plusieurs agents à la fois.
  global.PipelineUI = global.PipelineUI || {};

  const DEFAULT_SHOP_URL = 'https://grosgeekindustrie.etsy.com';
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
  const getCurrentMode = () => global.currentMode || 'tabletop';
  const getPfx = () => (typeof global.pfx === 'function' ? global.pfx() : (global.getPipelinePrefix?.(getCurrentMode()) || (getCurrentMode() === 'collection' ? 'col' : 'tt')));
  const getEchellesApi = () => global.PipelineUIEchelles || {};
  const getConfig = () => global.PipelineUIConfig || global;

  const getCheckedValues = (selector) => [...document.querySelectorAll(selector)].map((input) => input.value);

  const readAppSettings = () => {
    try {
      return JSON.parse(localStorage.getItem('pipeline.settings') || '{}');
    } catch (error) {
      return {};
    }
  };

  const writeAppSettings = (nextSettings) => {
    localStorage.setItem('pipeline.settings', JSON.stringify(nextSettings));
  };

  const renderSelectOptions = (selectId, options = [], selectedValue = null) => {
    const select = document.getElementById(selectId);
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
    const root = document.getElementById(rootId);
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
    let wrapper = document.getElementById(wrapperId);
    if (wrapper) return wrapper;

    const mediumGroup = document.getElementById(COLLECTION_DYNAMIC_IDS.mediumGroup);
    const mediumField = mediumGroup?.closest('.fg.full');
    const formGrid = mediumField?.parentElement;
    if (!mediumField || !formGrid) return null;

    wrapper = document.createElement('div');
    wrapper.id = wrapperId;
    wrapper.className = 'fg full';
    wrapper.innerHTML = `
      <label>${labelText} <span class="fg-hint">→ ${hintText}</span></label>
      <div id="${groupId}" class="option-chip-group"></div>
    `;

    mediumField.insertAdjacentElement('afterend', wrapper);
    return wrapper;
  };

  const ensureCollectionMediumMetaFields = () => {
    ensureCollectionDynamicField({
      wrapperId: COLLECTION_DYNAMIC_IDS.mediumSubcategoriesWrap,
      groupId: COLLECTION_DYNAMIC_IDS.mediumSubcategoriesGroup,
      labelText: 'Sous-catégories de medium',
      hintText: 'contexte supplémentaire pour les agents',
    });

    ensureCollectionDynamicField({
      wrapperId: COLLECTION_DYNAMIC_IDS.genreWrap,
      groupId: COLLECTION_DYNAMIC_IDS.genreGroup,
      labelText: 'Genres transverses',
      hintText: 'ambiance, tonalité, sous-genre',
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
      onChange: () => saveFormState(),
    });

    renderCheckboxGroup({
      rootId: COLLECTION_DYNAMIC_IDS.genreGroup,
      options: genreOptions,
      selectedValues: currentGenres,
      onChange: () => saveFormState(),
    });

    const subcategoriesWrap = document.getElementById(COLLECTION_DYNAMIC_IDS.mediumSubcategoriesWrap);
    const genresWrap = document.getElementById(COLLECTION_DYNAMIC_IDS.genreWrap);
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
      onChange: () => saveFormState(),
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

  const formatCommaList = (values = []) => values.join(', ');

  const buildCollectionMediumContext = () => {
    const mediums = getCollectionMediumValues();
    const mediumSubcategories = getCollectionMediumSubcategoryValues();
    const genres = getCollectionGenreValues();
    const parts = [];

    if (mediums.length) parts.push(`Mediums: ${formatCommaList(mediums)}`);
    if (mediumSubcategories.length) parts.push(`Sous-catégories: ${formatCommaList(mediumSubcategories)}`);
    if (genres.length) parts.push(`Genres: ${formatCommaList(genres)}`);

    return parts.join(' | ');
  };

  const getShopUrl = () => {
    const inputValue = document.getElementById('shopUrl')?.value?.trim();
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

    const archetypes = (document.getElementById('tt-fArchetypes')?.value || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const seo = (document.getElementById('tt-fArchSeo')?.value || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const parts = [];

    if (archetypes.length) parts.push(`Archétypes: ${archetypes.join(', ')}`);
    if (seo.length) parts.push(`SEO élargi: ${seo.join(', ')}`);

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
      type: document.getElementById('tt-fType')?.value || 'SOLO',
      version: document.getElementById('tt-fVersion')?.value || 'FIGURINE',
      buzz: document.getElementById('tt-fBuzz')?.checked || false,
      buzzNote: document.getElementById('tt-fBuzzNote')?.value || '',
      genres,
      genresTransverses: genres,
      genres_transverses: genres,
      particularites: document.getElementById('tt-fParticularites')?.value || '',
      archetypesManuels: document.getElementById('tt-fArchetypes')?.value || '',
      seoElargies: document.getElementById('tt-fArchSeo')?.value || '',
      descriptionFigurine: document.getElementById('tt-fDescriptionFigurine')?.value || '',
      resumePersonnage: document.getElementById('tt-fResumePersonnage')?.value || '',
      connexesPrioritaires: document.getElementById('tt-fConnexesPrioritaires')?.value || '',
      lienPerso: document.getElementById('tt-fLienPerso')?.value || '',
    };
  };

  function getCollectionData() {
    return {
      typePiece: document.getElementById('col-fType')?.value || 'FIGURINE',
      medium: getMediums(),
      ...getCollectionMediumMetaData(),
      license: document.getElementById('col-fLicense')?.checked ? 'oui' : 'non',
      particularites: document.getElementById('col-fParticularites')?.value || '',
      descriptionFigurine: document.getElementById('col-fDescriptionFigurine')?.value || '',
      resumePersonnage: document.getElementById('col-fResumePersonnage')?.value || '',
      connexesPrioritaires: document.getElementById('col-fConnexesPrioritaires')?.value || '',
      lienPerso: document.getElementById('col-fLienPerso')?.value || '',
      buzzCollection: document.getElementById('col-fBuzzCollection')?.checked || false,
      buzzCollectionNote: document.getElementById('col-fBuzzCollectionNote')?.value || '',
    };
  }

  function toggleBuzz(p) {
    const checked = document.getElementById(`${p}-fBuzz`)?.checked;
    document.getElementById(`${p}-fBuzzNote`)?.classList.toggle('visible', !!checked);
  }

  function toggleLicense() {
    const checked = document.getElementById('col-fLicense')?.checked;
    const label = document.getElementById('col-licenseLabel');
    if (label) {
      label.textContent = checked
        ? 'Oui — décrire uniquement via le medium et les termes connexes'
        : 'Non — nommer librement le personnage et l\'univers';
    }
    saveFormState();
  }

  function toggleBuzzCollection() {
    document.getElementById('col-fBuzzCollectionNote')?.classList.toggle('visible', !!document.getElementById('col-fBuzzCollection')?.checked);
    saveFormState();
  }

  async function fetchPersonnage() {
    const url = document.getElementById('col-fLienPerso')?.value?.trim();
    if (!url) {
      global.showToast?.('Saisis un lien avant de fetcher', '#ff4757', 4000);
      return;
    }

    const btn = document.getElementById('fetchBtn-col');
    const status = document.getElementById('fetchStatus-col');
    btn.disabled = true;
    btn.textContent = '⟳ Fetch...';
    status.style.display = 'block';
    status.style.color = 'var(--muted)';
    status.textContent = 'Récupération en cours...';

    try {
      const res = await fetch(`/fetch-url?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      document.getElementById('col-fResumePersonnage').value = data.text;
      status.style.color = 'var(--success)';
      status.textContent = `✓ ${data.chars} caractères récupérés`;
      saveFormState();
      global.showToast?.('Contexte récupéré ✓', '#4caf7d', 3000);
    } catch (error) {
      status.style.color = 'var(--error)';
      status.textContent = `✗ ${error.message}`;
      global.showToast?.(`Fetch échoué : ${error.message}`, '#ff4757', 10000);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔍 Fetch';
    }
  }

  function buildCtx(agentId, correction = '') {
    const state = getState();
    const currentMode = getCurrentMode();
    const p = getPfx();
    const echellesApi = getEchellesApi();

    const getFieldValue = (suffix) => document.getElementById(`${p}-${suffix}`)?.value?.trim() || '';
    const formatName = (value) => value.replace(/\b\w/g, (char) => char.toUpperCase());
    const rawNomField = getFieldValue('fNom');
    const rawNomCourtField = getFieldValue('fNomCourt');
    const rawNom = rawNomField || rawNomCourtField || 'Figurine';
    const rawNomCourt = rawNomCourtField || rawNom.split(' ')[0];
    const nom = formatName(rawNom);
    const nomCourt = formatName(rawNomCourt);
    const rules = (state.persistentRules[agentId] || []).join('\n');
    const collectionDescription = document.getElementById('col-fDescriptionFigurine')?.value || '';
    const collectionResume = document.getElementById('col-fResumePersonnage')?.value || '';
    const normalizedOutputs = { ...state.outputs };

    const pipelineRun = state.pipelineRun?.[p] || {};
    const base = {
      nom,
      nomCourt,
      univers: document.getElementById(`${p}-fUnivers`)?.value || '',
      sculpteur: document.getElementById(`${p}-fSculpteur`)?.value || 'Inconnu',
      echelles: echellesApi.getEchellesSelected?.() || '',
      pieces: document.getElementById(`${p}-fPieces`)?.value || '',
      dimensions: echellesApi.getDimsFromEchelles?.() || '',
      notes: currentMode === 'collection' ? collectionDescription : (document.getElementById(`${p}-fNotes`)?.value || ''),
      descriptionFigurine: collectionDescription,
      resumePersonnage: collectionResume,
      pose: document.getElementById(`${p}-fPose`)?.value || 'MUSEUM',
      imageCount: state.images[p].length,
      outputs: normalizedOutputs,
      correction,
      rules,
      archetypes: getArchetypes(),
      url_boutique: getShopUrl(),
      social_formats: state._leoFormats || '',
      selectedAccrocheText: state.selectedAccroche?.text || '',
      selectedCTAText: state.selectedCTA?.text || '',
      pipeline_form_snapshot: pipelineRun.formSnapshot || '',
      pipeline_cumulatif: pipelineRun.cumulativeText || '',
      pipeline_warmup_hint: pipelineRun.warmupHint || '',
      profil_dominant: (() => {
        const match = (state.outputs.marche || '').match(/Dominant\s*:\s*(.+)/i);
        return match ? match[1].trim() : 'hobbyiste';
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
    const data = {};

    if (currentMode === 'tabletop') {
      TABLETOP_FORM_FIELDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) data[id] = el.value;
      });
      data._echelles = (echellesApi.ECHELLES || []).map((_, i) => ({
        checked: document.getElementById(`tt-ec${i}`)?.checked || false,
        dim: document.getElementById(`tt-ed${i}`)?.value || '',
      }));
      data._genres = getTabletopGenreValues();
      data._buzz = document.getElementById('tt-fBuzz')?.checked || false;
      data._buzzNote = document.getElementById('tt-fBuzzNote')?.value || '';
    } else {
      COLLECTION_FORM_FIELDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) data[id] = el.value;
      });
      data._echelles = (echellesApi.ECHELLES_COLLECTION || []).map((_, i) => ({
        checked: document.getElementById(`col-ec${i}`)?.checked || false,
        dim: document.getElementById(`col-ed${i}`)?.value || '',
      }));
      data._license = document.getElementById('col-fLicense')?.checked || false;
      data._mediums = getCollectionMediumValues();
      data._mediumSubcategories = getCollectionMediumSubcategoryValues();
      data._genres = getCollectionGenreValues();
      data._particularites = document.getElementById('col-fParticularites')?.value || '';
      data._descriptionFigurine = document.getElementById('col-fDescriptionFigurine')?.value || '';
      data._resumePersonnage = document.getElementById('col-fResumePersonnage')?.value || '';
      data._connexesPrioritaires = document.getElementById('col-fConnexesPrioritaires')?.value || '';
      data._lienPerso = document.getElementById('col-fLienPerso')?.value || '';
      data._buzz = document.getElementById('col-fBuzzCollection')?.checked || false;
      data._buzzNote = document.getElementById('col-fBuzzCollectionNote')?.value || '';
      data._originEchelleIndex = (() => {
        const checked = document.querySelector('input[name="col-origin-scale"]:checked');
        return checked ? Number(checked.value) : null;
      })();
      data._customEchelles = [];
      for (let c = 0; c < (echellesApi.CUSTOM_COLLECTION_COUNT || 0); c += 1) {
        const idx = (echellesApi.ECHELLES_COLLECTION || []).length + c;
        data._customEchelles.push({
          checked: document.getElementById(`col-ec${idx}`)?.checked || false,
          label: document.getElementById(`col-elabel${idx}`)?.value || '',
          dim: document.getElementById(`col-ed${idx}`)?.value || '',
        });
      }
    }

    localStorage.setItem(`pipeline.form.${currentMode}`, JSON.stringify(data));
  }

  function loadFormState() {
    const currentMode = getCurrentMode();
    const echellesApi = getEchellesApi();
    renderDeclarativeFormCatalogs({ shouldSave: false });

    try {
      const saved = localStorage.getItem(`pipeline.form.${currentMode}`) || localStorage.getItem(`pipeline_form_${currentMode}`);
      if (!saved) return;
      const data = JSON.parse(saved);

      if (currentMode === 'tabletop') {
        TABLETOP_FORM_FIELDS.forEach((id) => {
          const el = document.getElementById(id);
          if (el && data[id] !== undefined) el.value = data[id];
        });
        if (data._echelles) data._echelles.forEach((entry, i) => {
          const cb = document.getElementById(`tt-ec${i}`);
          const dim = document.getElementById(`tt-ed${i}`);
          if (cb && entry.checked) {
            cb.checked = true;
            global.toggleEch?.(i, { shouldSave: false });
            if (dim && entry.dim) dim.value = entry.dim;
          }
        });
        if (data._genres) {
          document.querySelectorAll(`#${TABLETOP_DYNAMIC_IDS.genreGroup} input`).forEach((input) => {
            input.checked = data._genres.includes(input.value);
          });
        }
        const archetypesEl = document.getElementById('tt-fArchetypes');
        if (archetypesEl && !archetypesEl.value) {
          const legacyArchetypes = [
            data.tt-fArchPrincipal,
            ...(Array.isArray(data._archSec) ? data._archSec : []),
          ]
            .map((value) => String(value || '').trim())
            .filter(Boolean);
          archetypesEl.value = [...new Set(legacyArchetypes)].join(', ');
        }
        if (data._buzz !== undefined) {
          const el = document.getElementById('tt-fBuzz');
          if (el) {
            el.checked = data._buzz;
            toggleBuzz('tt');
          }
        }
        if (data._buzzNote !== undefined) {
          const el = document.getElementById('tt-fBuzzNote');
          if (el) el.value = data._buzzNote;
        }
      } else {
        COLLECTION_FORM_FIELDS.forEach((id) => {
          const el = document.getElementById(id);
          if (el && data[id] !== undefined) el.value = data[id];
        });
        if (data._echelles) data._echelles.forEach((entry, i) => {
          const cb = document.getElementById(`col-ec${i}`);
          const dim = document.getElementById(`col-ed${i}`);
          if (cb && entry.checked) {
            cb.checked = true;
            global.toggleEch?.(i, { shouldSave: false });
            if (dim && entry.dim) dim.value = entry.dim;
          }
        });
        if (data._license !== undefined) {
          const el = document.getElementById('col-fLicense');
          if (el) {
            el.checked = data._license;
            toggleLicense();
          }
        }
        if (data._mediums) {
          document.querySelectorAll('#col-fMediumGroup input').forEach((input) => {
            input.checked = data._mediums.includes(input.value);
          });
        }
        renderCollectionMediumMeta({
          selectedSubcategories: data._mediumSubcategories || [],
          selectedGenres: data._genres || [],
          shouldSave: false,
        });
        if (data._particularites !== undefined) {
          const el = document.getElementById('col-fParticularites');
          if (el) el.value = data._particularites;
        }
        const descriptionFigurineValue = data._descriptionFigurine ?? data['col-fNotes'];
        if (descriptionFigurineValue !== undefined) {
          const el = document.getElementById('col-fDescriptionFigurine');
          if (el) el.value = descriptionFigurineValue;
        }
        const resumePersonnageValue = data._resumePersonnage ?? data._contextePerso;
        if (resumePersonnageValue !== undefined) {
          const el = document.getElementById('col-fResumePersonnage');
          if (el) el.value = resumePersonnageValue;
        }
        if (data._connexesPrioritaires !== undefined) {
          const el = document.getElementById('col-fConnexesPrioritaires');
          if (el) el.value = data._connexesPrioritaires;
        }
        if (data._lienPerso !== undefined) {
          const el = document.getElementById('col-fLienPerso');
          if (el) el.value = data._lienPerso;
        }
        if (data._buzz !== undefined) {
          const el = document.getElementById('col-fBuzzCollection');
          if (el) {
            el.checked = data._buzz;
            toggleBuzzCollection();
          }
        }
        if (data._buzzNote !== undefined) {
          const el = document.getElementById('col-fBuzzCollectionNote');
          if (el) el.value = data._buzzNote;
        }
        if (data._customEchelles) data._customEchelles.forEach((entry, c) => {
          const idx = (echellesApi.ECHELLES_COLLECTION || []).length + c;
          const cb = document.getElementById(`col-ec${idx}`);
          const label = document.getElementById(`col-elabel${idx}`);
          const dim = document.getElementById(`col-ed${idx}`);
          if (label && entry.label) label.value = entry.label;
          if (cb && entry.checked) {
            cb.checked = true;
            global.toggleEch?.(idx, { shouldSave: false });
          }
          if (dim && entry.dim) dim.value = entry.dim;
        });
        if (Number.isInteger(data._originEchelleIndex)) {
          global.setEchelleOrigin?.(data._originEchelleIndex, { shouldSave: false, recalculate: false });
        }
      }
    } catch (error) {}
  }

  function attachFormPersistence() {
    TABLETOP_FORM_FIELDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', saveFormState);
      if (el.tagName === 'SELECT') el.addEventListener('change', saveFormState);
    });

    COLLECTION_FORM_FIELDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', saveFormState);
      if (el.tagName === 'SELECT') el.addEventListener('change', saveFormState);
    });

    ['col-fParticularites', 'col-fDescriptionFigurine', 'col-fResumePersonnage', 'col-fLienPerso', 'col-fConnexesPrioritaires'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', saveFormState);
    });

    const apiKeyEl = document.getElementById('apiKey');
    if (apiKeyEl) apiKeyEl.addEventListener('input', () => {
      const settings = readAppSettings();
      settings.apiKey = apiKeyEl.value;
      writeAppSettings(settings);
    });

    const shopUrlEl = document.getElementById('shopUrl');
    if (shopUrlEl) shopUrlEl.addEventListener('input', persistShopUrl);
  }

  function loadPersistedData() {
    const state = getState();
    try {
      const rules = localStorage.getItem('pipeline.rules') || localStorage.getItem('pipeline_rules');
      if (rules) {
        state.persistentRules = JSON.parse(rules);
        Object.keys(state.persistentRules).forEach((id) => global.refreshRules?.(id));
      }
    } catch (error) {}

    try {
      const settings = readAppSettings();
      const apiKeyEl = document.getElementById('apiKey');
      if (apiKeyEl && settings.apiKey) apiKeyEl.value = settings.apiKey;

      const shopUrlEl = document.getElementById('shopUrl');
      if (shopUrlEl) shopUrlEl.value = settings.shopUrl || DEFAULT_SHOP_URL;

      if (settings.mode && settings.mode !== getCurrentMode()) {
        global.currentMode = settings.mode;
        state.mode = settings.mode;
        document.body.classList.toggle('mode-collection', settings.mode === 'collection');
      }

      if (settings.view && settings.view === 'form') {
        global._restoreView = settings.view;
        global._restoreMode = settings.mode || 'tabletop';
      }
    } catch (error) {}
  }

  async function loadAllFiles(silent = false) {
    const state = getState();
    const currentMode = getCurrentMode();
    const p = getPfx();
    const config = getConfig();
    const map = currentMode === 'collection'
      ? (config.PROMPT_FILE_MAP_COLLECTION || global.PROMPT_FILE_MAP_COLLECTION || {})
      : (config.PROMPT_FILE_MAP || global.PROMPT_FILE_MAP || {});
    const promptFiles = Object.entries(map);
    const biblioFiles = ['tags', 'accroches', 'objectif', 'psycho', 'titres', 'bibliotheque-semantique'];
    const missing = [];
    const mode = currentMode;

    await Promise.all([
      ...promptFiles.map(async ([agentId, fname]) => {
        try {
          const res = await fetch(`/files/prompts/${mode}/${fname}.md`);
          if (!res.ok) {
            missing.push(`prompts/${mode}/${fname}.md`);
            return;
          }
          state.promptsByMode[mode][agentId] = await res.text();
        } catch (error) {
          missing.push(`prompts/${mode}/${fname}.md`);
        }
      }),
      ...biblioFiles.map(async (key) => {
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

    const btn = document.getElementById(`runBtn-${p}`);
    if (missing.length > 0) {
      if (!silent) {
        const list = missing.map((file) => `  • ${file}`).join('\n');
        alert(`⚠️ Fichiers manquants :\n\n${list}\n\nVérifiez que server.py est lancé.`);
      } else {
        global.showToast?.(`⚠️ ${missing.length} fichier(s) manquants en mode ${mode}`, '#ff4757', 10000);
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = `⚠️ Fichiers manquants (${mode})`;
      }
    } else if (btn) {
      btn.disabled = false;
      btn.innerHTML = '▶';
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
