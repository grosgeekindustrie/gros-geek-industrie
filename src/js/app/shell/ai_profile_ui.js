(function initPipelineUIAIProfileUI(global) {
  'use strict';

  const profiles = global.PipelineUIAIProfiles;
  if (!profiles) return;

  const TASK_LABELS = Object.freeze({
    title: 'Titres',
    tags: 'Tags',
    description: 'Description',
    alt: 'Texte ALT',
    translations: 'Traductions',
    social: 'Réseaux sociaux et Pinterest',
  });

  let draftProfile = profiles.getActiveProfile();
  let lastFocusedElement = null;

  const buildModelOptions = (selectedValue) => profiles.SUPPORTED_CLAUDE_MODELS
    .map(({ value, label }) => `<option value="${value}"${value === selectedValue ? ' selected' : ''}>${label}</option>`)
    .join('');

  const ensureDialog = () => {
    let overlay = document.getElementById('aiProfileOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'aiProfileOverlay';
    overlay.className = 'ai-profile-overlay';
    overlay.innerHTML = `
      <section class="ai-profile-dialog" id="aiProfileDialog" role="dialog" aria-modal="true" aria-labelledby="aiProfileDialogTitle">
        <header class="ai-profile-dialog-header">
          <div>
            <h2 id="aiProfileDialogTitle">Profil IA</h2>
            <p>Choisis comment Claude est distribué entre les différents travaux.</p>
          </div>
          <button class="lb-close" type="button" data-ai-profile-close aria-label="Fermer"><span data-svg-icon="close"></span></button>
        </header>
        <div class="ai-profile-dialog-body">
          <div class="ai-profile-presets">
            <button class="ai-profile-preset" type="button" data-ai-profile-preset="claude-legacy">
              <strong>Claude actuel</strong>
              <small>Un modèle principal, avec Sonnet 4.6 conservé pour les traductions.</small>
            </button>
            <button class="ai-profile-preset" type="button" data-ai-profile-preset="claude-custom">
              <strong>Claude personnalisé</strong>
              <small>Choisis un modèle différent pour chaque catégorie de travail.</small>
            </button>
          </div>
          <section class="ai-profile-section" data-ai-profile-legacy>
            <h3>Modèle Claude principal</h3>
            <p>Utilisé par le pipeline, les réseaux sociaux et les outils secondaires. Les traductions restent sur Sonnet 4.6.</p>
            <select class="ai-profile-select" data-ai-profile-base-model></select>
          </section>
          <section class="ai-profile-section" data-ai-profile-custom hidden>
            <h3>Routage personnalisé</h3>
            <p>Ces choix s’appliqueront aux prochains lancements. Un travail déjà démarré conserve son profil initial.</p>
            <div class="ai-profile-routes" data-ai-profile-routes></div>
          </section>
        </div>
        <footer class="ai-profile-dialog-footer">
          <button class="btn btn-muted" type="button" data-ai-profile-close>Annuler</button>
          <button class="btn btn-accent" type="button" data-ai-profile-apply>Appliquer le profil</button>
        </footer>
      </section>`;
    document.body.appendChild(overlay);
    global.PipelineUIIcons?.hydrateIcons?.(overlay);
    bindDialogEvents(overlay);
    return overlay;
  };

  const renderDialog = () => {
    const overlay = ensureDialog();
    const isCustom = draftProfile.id === profiles.PROFILE_IDS.CUSTOM;
    overlay.querySelectorAll('[data-ai-profile-preset]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.aiProfilePreset === draftProfile.id);
    });
    const legacySection = overlay.querySelector('[data-ai-profile-legacy]');
    const customSection = overlay.querySelector('[data-ai-profile-custom]');
    legacySection.hidden = isCustom;
    customSection.hidden = !isCustom;

    const baseSelect = overlay.querySelector('[data-ai-profile-base-model]');
    baseSelect.innerHTML = buildModelOptions(draftProfile.baseModel);

    const routes = overlay.querySelector('[data-ai-profile-routes]');
    routes.innerHTML = profiles.TASK_IDS.map((taskId) => `
      <div class="ai-profile-route">
        <label for="ai-profile-route-${taskId}">${TASK_LABELS[taskId]}</label>
        <select class="ai-profile-select" id="ai-profile-route-${taskId}" data-ai-profile-route="${taskId}">
          ${buildModelOptions(draftProfile.routes[taskId])}
        </select>
      </div>`).join('');
  };

  const updateHeader = () => {
    const label = document.getElementById('aiProfileButtonLabel');
    const button = document.getElementById('aiProfileButton');
    const profile = profiles.getActiveProfile();
    const profileLabel = profiles.getProfileLabel(profile);
    if (label) label.textContent = `IA · ${profileLabel}`;
    if (button) {
      button.title = `Profil IA actif : ${profileLabel}`;
      button.dataset.aiProvider = profile.provider || 'anthropic';
    }
  };

  const openDialog = () => {
    lastFocusedElement = document.activeElement;
    draftProfile = profiles.getActiveProfile();
    renderDialog();
    const overlay = ensureDialog();
    overlay.classList.add('is-open');
    overlay.querySelector('[data-ai-profile-close]')?.focus();
  };

  const closeDialog = () => {
    document.getElementById('aiProfileOverlay')?.classList.remove('is-open');
    lastFocusedElement?.focus?.();
  };

  const applyProfile = () => {
    const overlay = ensureDialog();
    const nextProfile = {
      ...draftProfile,
      baseModel: overlay.querySelector('[data-ai-profile-base-model]')?.value || draftProfile.baseModel,
      routes: { ...draftProfile.routes },
    };
    overlay.querySelectorAll('[data-ai-profile-route]').forEach((select) => {
      nextProfile.routes[select.dataset.aiProfileRoute] = select.value;
    });
    profiles.saveActiveProfile(nextProfile);
    closeDialog();
    global.showToast?.(`Profil IA actif : ${profiles.getProfileLabel(profiles.getActiveProfile())}`);
  };

  function bindDialogEvents(overlay) {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.closest('[data-ai-profile-close]')) {
        closeDialog();
        return;
      }
      const presetButton = event.target.closest('[data-ai-profile-preset]');
      if (presetButton) {
        const nextId = presetButton.dataset.aiProfilePreset;
        draftProfile = profiles.normalizeConfig({
          ...draftProfile,
          id: nextId,
          routes: nextId === profiles.PROFILE_IDS.LEGACY
            ? undefined
            : draftProfile.routes,
        });
        renderDialog();
        return;
      }
      if (event.target.closest('[data-ai-profile-apply]')) applyProfile();
    });
    overlay.addEventListener('change', (event) => {
      if (event.target.matches('[data-ai-profile-base-model]')) {
        draftProfile.baseModel = event.target.value;
      }
      if (event.target.matches('[data-ai-profile-route]')) {
        draftProfile.routes[event.target.dataset.aiProfileRoute] = event.target.value;
      }
    });
  }

  document.getElementById('aiProfileButton')?.addEventListener('click', openDialog);
  global.addEventListener('pipeline:ai-profile-change', updateHeader);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.getElementById('aiProfileOverlay')?.classList.contains('is-open')) closeDialog();
  });
  updateHeader();

  global.PipelineUIAIProfileUI = Object.freeze({ openDialog, closeDialog, updateHeader });
})(window);
