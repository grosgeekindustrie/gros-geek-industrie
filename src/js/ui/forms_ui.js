(function initPipelineUIForms(global) {

// Formulaires, persistance locale et context builder.
// Ce module centralise la lecture/écriture des champs et construit le contexte injecté
// dans les prompts. Toute évolution ici peut impacter plusieurs agents à la fois.
  global.PipelineUI = global.PipelineUI || {};

  const FORM_FIELDS_TT = [
    'tt-fNom',
    'tt-fNomCourt',
    'tt-fUnivers',
    'tt-fSculpteur',
    'tt-fPieces',
    'tt-fNotes',
    'tt-fPose',
    'tt-fType',
    'tt-fVersion',
    'tt-fUrlBoutique',
    'tt-fArchPrincipal',
    'tt-fArchSeo',
  ];

  const FORM_FIELDS_COL = [
    'col-fNomCourt',
    'col-fNom',
    'col-fUnivers',
    'col-fSculpteur',
    'col-fPieces',
    'col-fNotes',
    'col-fPose',
    'col-fUrlBoutique',
  ];

  const getState = () => global.state;
  const getCurrentMode = () => global.currentMode || 'tabletop';
  const getPfx = () => (typeof global.pfx === 'function' ? global.pfx() : (getCurrentMode() === 'collection' ? 'col' : 'tt'));
  const getEchellesApi = () => global.PipelineUIEchelles || {};
  const getConfig = () => global.PipelineUIConfig || global;

  function getArchetypes() {
    if (getCurrentMode() !== 'tabletop') return '';

    const principal = document.getElementById('tt-fArchPrincipal').value || '';
    const secondaires = [...document.querySelectorAll('#tt-archSecondaires input:checked')].map((input) => input.value);
    const seo = (document.getElementById('tt-fArchSeo').value || '').split(',').map((value) => value.trim()).filter(Boolean);
    const parts = [];

    if (principal) parts.push(`Principal: ${principal}`);
    if (secondaires.length) parts.push(`Secondaires: ${secondaires.join(', ')}`);
    if (seo.length) parts.push(`SEO élargi: ${seo.join(', ')}`);

    return parts.join(' | ') || '';
  }

  function getMediums() {
    return [...document.querySelectorAll('#col-fMediumGroup input:checked')].map((input) => input.value).join(', ');
  }

  function getCollectionData() {
    return {
      medium: getMediums(),
      license: document.getElementById('col-fLicense')?.checked ? 'oui' : 'non',
      particularites: document.getElementById('col-fParticularites')?.value || '',
      contextePerso: document.getElementById('col-fContextePerso')?.value || '',
      connexesPrioritaires: document.getElementById('col-fConnexesPrioritaires')?.value || '',
      lienPerso: document.getElementById('col-fLienPerso')?.value || '',
      buzzCollection: document.getElementById('col-fBuzzCollection')?.checked || false,
      buzzCollectionNote: document.getElementById('col-fBuzzCollectionNote')?.value || '',
    };
  }

  function toggleBuzz(p) {
    const checked = document.getElementById(`${p}-fBuzz`).checked;
    document.getElementById(`${p}-fBuzzNote`).classList.toggle('visible', checked);
  }

  function toggleLicense() {
    const checked = document.getElementById('col-fLicense').checked;
    document.getElementById('col-licenseLabel').textContent = checked
      ? 'Oui — décrire uniquement via le medium et les termes connexes'
      : 'Non — nommer librement le personnage et l\'univers';
    saveFormState();
  }

  function toggleBuzzCollection() {
    document.getElementById('col-fBuzzCollectionNote').classList.toggle('visible', document.getElementById('col-fBuzzCollection').checked);
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

      document.getElementById('col-fContextePerso').value = data.text;
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

const getFieldValue = (suffix) =>
  document.getElementById(`${p}-${suffix}`)?.value?.trim() || '';

const formatName = (value) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase());

const rawNomField = getFieldValue('fNom');
const rawNomCourtField = getFieldValue('fNomCourt');

const rawNom = rawNomField || rawNomCourtField || 'Figurine';
const rawNomCourt = rawNomCourtField || rawNom.split(' ')[0];

const nom = formatName(rawNom);
const nomCourt = formatName(rawNomCourt);

const rules = (state.persistentRules[agentId] || []).join('\n');

    const base = {
      nom,
      nomCourt,
      univers: document.getElementById(`${p}-fUnivers`)?.value || '',
      sculpteur: document.getElementById(`${p}-fSculpteur`)?.value || 'Inconnu',
      echelles: echellesApi.getEchellesSelected?.() || '',
      pieces: document.getElementById(`${p}-fPieces`)?.value || '',
      dimensions: echellesApi.getDimsFromEchelles?.() || '',
      notes: document.getElementById(`${p}-fNotes`)?.value || '',
      pose: document.getElementById(`${p}-fPose`)?.value || 'MUSEUM',
      imageCount: state.images[p].length,
      outputs: { ...state.outputs },
      correction,
      rules,
      archetypes: getArchetypes(),
      url_boutique: document.getElementById(`${p}-fUrlBoutique`)?.value || 'https://grosgeekindustrie.etsy.com',
      social_formats: state._leoFormats || '',
      selectedAccrocheText: state.selectedAccroche?.text || '',
      selectedCTAText: state.selectedCTA?.text || '',
      profil_dominant: (() => {
        const match = (state.outputs.marche || '').match(/Dominant\s*:\s*(.+)/i);
        return match ? match[1].trim() : 'hobbyiste';
      })(),
    };

    if (currentMode === 'tabletop') {
      base.type = document.getElementById('tt-fType')?.value || 'SOLO';
      base.version = document.getElementById('tt-fVersion')?.value || 'FIGURINE';
      base.buzz = document.getElementById('tt-fBuzz')?.checked || false;
      base.buzzNote = document.getElementById('tt-fBuzzNote')?.value || '';
    } else {
      Object.assign(base, getCollectionData());
    }

    return base;
  }

  function saveFormState() {
    const currentMode = getCurrentMode();
    const p = getPfx();
    const echellesApi = getEchellesApi();
    const data = {};

    if (currentMode === 'tabletop') {
      FORM_FIELDS_TT.forEach((id) => {
        const el = document.getElementById(id);
        if (el) data[id] = el.value;
      });
      data._echelles = (echellesApi.ECHELLES || []).map((_, i) => ({
        checked: document.getElementById(`tt-ec${i}`)?.checked || false,
        dim: document.getElementById(`tt-ed${i}`)?.value || '',
      }));
      data._archSec = [...document.querySelectorAll('#tt-archSecondaires input:checked')].map((input) => input.value);
      data._buzz = document.getElementById('tt-fBuzz')?.checked || false;
      data._buzzNote = document.getElementById('tt-fBuzzNote')?.value || '';
    } else {
      FORM_FIELDS_COL.forEach((id) => {
        const el = document.getElementById(id);
        if (el) data[id] = el.value;
      });
      data._echelles = (echellesApi.ECHELLES_COLLECTION || []).map((_, i) => ({
        checked: document.getElementById(`col-ec${i}`)?.checked || false,
        dim: document.getElementById(`col-ed${i}`)?.value || '',
      }));
      data._license = document.getElementById('col-fLicense')?.checked || false;
      data._mediums = [...document.querySelectorAll('#col-fMediumGroup input:checked')].map((input) => input.value);
      data._particularites = document.getElementById('col-fParticularites')?.value || '';
      data._contextePerso = document.getElementById('col-fContextePerso')?.value || '';
      data._connexesPrioritaires = document.getElementById('col-fConnexesPrioritaires')?.value || '';
      data._lienPerso = document.getElementById('col-fLienPerso')?.value || '';
      data._buzz = document.getElementById('col-fBuzzCollection')?.checked || false;
      data._buzzNote = document.getElementById('col-fBuzzCollectionNote')?.value || '';
      data._originEchelleIndex = (() => {
        const checked = document.querySelector('input[name="col-origin-scale"]:checked');
        return checked ? Number(checked.value) : null;
      })();
      data._customEchelles = [];
      for (let c = 0; c < (echellesApi.CUSTOM_COLLECTION_COUNT || 0); c++) {
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
    try {
      const saved = localStorage.getItem(`pipeline.form.${currentMode}`) || localStorage.getItem(`pipeline_form_${currentMode}`);
      if (!saved) return;
      const data = JSON.parse(saved);

      if (currentMode === 'tabletop') {
        FORM_FIELDS_TT.forEach((id) => {
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
        if (data._archSec) document.querySelectorAll('#tt-archSecondaires input').forEach((input) => {
          input.checked = data._archSec.includes(input.value);
        });
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
        FORM_FIELDS_COL.forEach((id) => {
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
        if (data._mediums) document.querySelectorAll('#col-fMediumGroup input').forEach((input) => {
          input.checked = data._mediums.includes(input.value);
        });
        if (data._particularites !== undefined) {
          const el = document.getElementById('col-fParticularites');
          if (el) el.value = data._particularites;
        }
        if (data._contextePerso !== undefined) {
          const el = document.getElementById('col-fContextePerso');
          if (el) el.value = data._contextePerso;
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
          global.setEchelleOrigin?.(data._originEchelleIndex, { shouldSave: false });
        }
      }
    } catch (error) {}
  }

  function attachFormPersistence() {
    FORM_FIELDS_TT.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', saveFormState);
      if (el.tagName === 'SELECT') el.addEventListener('change', saveFormState);
    });

    FORM_FIELDS_COL.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', saveFormState);
      if (el.tagName === 'SELECT') el.addEventListener('change', saveFormState);
    });

    document.querySelectorAll('#tt-archSecondaires input').forEach((input) => input.addEventListener('change', saveFormState));
    document.querySelectorAll('#col-fMediumGroup input').forEach((input) => input.addEventListener('change', saveFormState));
    ['col-fParticularites', 'col-fContextePerso', 'col-fLienPerso','col-fConnexesPrioritaires'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', saveFormState);
    });

    const apiKeyEl = document.getElementById('apiKey');
    if (apiKeyEl) apiKeyEl.addEventListener('input', () => {
      try {
        const settings = JSON.parse(localStorage.getItem('pipeline.settings') || '{}');
        settings.apiKey = apiKeyEl.value;
        localStorage.setItem('pipeline.settings', JSON.stringify(settings));
      } catch (error) {}
    });
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
      const rawSettings = localStorage.getItem('pipeline.settings');
      if (!rawSettings) return;

      const settings = JSON.parse(rawSettings);
      const apiKeyEl = document.getElementById('apiKey');
      if (apiKeyEl && settings.apiKey) apiKeyEl.value = settings.apiKey;

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
    FORM_FIELDS_TT,
    FORM_FIELDS_COL,
    getArchetypes,
    getMediums,
    getCollectionData,
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
