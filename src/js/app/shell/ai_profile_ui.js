(function initPipelineUIAIProfileUI(global) {
  'use strict';
  const profiles = global.PipelineUIAIProfiles;
  if (!profiles) return;

  const TASK_LABELS = Object.freeze({ title: 'Titres', tags: 'Tags', description: 'Description', alt: 'Texte ALT', translations: 'Traductions', social: 'Réseaux sociaux et Pinterest' });
  let draftProfile = profiles.getActiveProfile();
  let lastFocusedElement = null;
  const buildOptions = (entries, selected) => entries.map(({ value, label }) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
  const buildModelOptions = (provider, selected) => buildOptions(profiles.getModelsForProvider(provider), selected);
  const buildReasoningOptions = (selected) => buildOptions(profiles.SUPPORTED_OPENAI_REASONING_EFFORTS, selected);

  const ensureDialog = () => {
    let overlay = document.getElementById('aiProfileOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'aiProfileOverlay';
    overlay.className = 'ai-profile-overlay';
    overlay.innerHTML = `
      <section class="ai-profile-dialog" id="aiProfileDialog" role="dialog" aria-modal="true" aria-labelledby="aiProfileDialogTitle">
        <header class="ai-profile-dialog-header"><div><h2 id="aiProfileDialogTitle">Profil IA</h2><p>Choisis le fournisseur, puis distribue les modèles entre les différents travaux.</p></div><button class="lb-close" type="button" data-ai-profile-close aria-label="Fermer"><span data-svg-icon="close"></span></button></header>
        <div class="ai-profile-dialog-body">
          <div class="ai-profile-provider-group"><div class="ai-profile-provider-heading"><span class="ai-provider-dot ai-provider-dot-anthropic"></span><strong>Claude</strong></div><div class="ai-profile-presets">
            <button class="ai-profile-preset" type="button" data-ai-profile-preset="claude-legacy"><strong>Claude actuel</strong><small>Le comportement historique, avec Sonnet 4.6 conservé pour les traductions.</small></button>
            <button class="ai-profile-preset" type="button" data-ai-profile-preset="claude-custom"><strong>Claude personnalisé</strong><small>Un modèle Claude différent pour chaque catégorie de travail.</small></button>
          </div></div>
          <div class="ai-profile-provider-group"><div class="ai-profile-provider-heading"><span class="ai-provider-dot ai-provider-dot-openai"></span><strong>GPT</strong></div><div class="ai-profile-presets">
            <button class="ai-profile-preset" type="button" data-ai-profile-preset="openai-standard"><strong>GPT uniforme</strong><small>Le même modèle et le même niveau de réflexion pour tous les agents.</small></button>
            <button class="ai-profile-preset" type="button" data-ai-profile-preset="openai-custom"><strong>GPT personnalisé</strong><small>Modèle et réflexion réglables travail par travail.</small></button>
          </div></div>
          <section class="ai-profile-section" data-ai-profile-uniform><h3 data-ai-profile-uniform-title>Modèle principal</h3><p data-ai-profile-uniform-description></p><div class="ai-profile-uniform-controls">
            <label><span>Modèle</span><select class="ai-profile-select" data-ai-profile-base-model></select></label>
            <label data-ai-profile-base-reasoning-wrap hidden><span>Niveau de réflexion</span><select class="ai-profile-select" data-ai-profile-base-reasoning></select></label>
          </div></section>
          <section class="ai-profile-section" data-ai-profile-custom hidden><h3>Routage personnalisé</h3><p>Les prochains lancements utilisent ces choix. Un travail déjà démarré conserve son profil initial.</p><div class="ai-profile-routes" data-ai-profile-routes></div></section>
        </div>
        <footer class="ai-profile-dialog-footer"><button class="btn btn-muted" type="button" data-ai-profile-close>Annuler</button><button class="btn btn-accent" type="button" data-ai-profile-apply>Appliquer le profil</button></footer>
      </section>`;
    document.body.appendChild(overlay);
    global.PipelineUIIcons?.hydrateIcons?.(overlay);
    bindDialogEvents(overlay);
    return overlay;
  };

  const renderRoute = (task, provider) => {
    const isOpenAI = provider === 'openai';
    return `<div class="ai-profile-route${isOpenAI ? ' has-reasoning' : ''}"><label for="ai-profile-route-${task}">${TASK_LABELS[task]}</label><select class="ai-profile-select" id="ai-profile-route-${task}" data-ai-profile-route="${task}">${buildModelOptions(provider, draftProfile.routes[task])}</select>${isOpenAI ? `<select class="ai-profile-select" aria-label="Réflexion · ${TASK_LABELS[task]}" data-ai-profile-reasoning="${task}">${buildReasoningOptions(draftProfile.reasoningEfforts[task])}</select>` : ''}</div>`;
  };
  const renderDialog = () => {
    const overlay = ensureDialog();
    const isCustom = [profiles.PROFILE_IDS.CLAUDE_CUSTOM, profiles.PROFILE_IDS.OPENAI_CUSTOM].includes(draftProfile.id);
    const isOpenAI = draftProfile.provider === 'openai';
    overlay.dataset.aiProvider = draftProfile.provider;
    overlay.querySelectorAll('[data-ai-profile-preset]').forEach((button) => button.classList.toggle('is-active', button.dataset.aiProfilePreset === draftProfile.id));
    overlay.querySelector('[data-ai-profile-uniform]').hidden = isCustom;
    overlay.querySelector('[data-ai-profile-custom]').hidden = !isCustom;
    overlay.querySelector('[data-ai-profile-uniform-title]').textContent = isOpenAI ? 'Configuration GPT uniforme' : 'Modèle Claude principal';
    overlay.querySelector('[data-ai-profile-uniform-description]').textContent = isOpenAI ? 'Le modèle et la réflexion sélectionnés seront utilisés partout.' : 'Pipeline et réseaux utilisent ce modèle. Les traductions restent sur Sonnet 4.6.';
    overlay.querySelector('[data-ai-profile-base-model]').innerHTML = buildModelOptions(draftProfile.provider, draftProfile.baseModel);
    overlay.querySelector('[data-ai-profile-base-reasoning-wrap]').hidden = !isOpenAI;
    overlay.querySelector('[data-ai-profile-base-reasoning]').innerHTML = buildReasoningOptions(draftProfile.baseReasoningEffort);
    overlay.querySelector('[data-ai-profile-routes]').innerHTML = profiles.TASK_IDS.map((task) => renderRoute(task, draftProfile.provider)).join('');
  };
  const updateHeader = () => {
    const label = document.getElementById('aiProfileButtonLabel');
    const button = document.getElementById('aiProfileButton');
    const profile = profiles.getActiveProfile();
    const text = profiles.getProfileLabel(profile);
    if (label) label.textContent = `IA · ${text}`;
    if (button) { button.title = `Profil IA actif : ${text}`; button.dataset.aiProvider = profile.provider; }
  };
  const openDialog = () => {
    lastFocusedElement = document.activeElement;
    draftProfile = profiles.getActiveProfile();
    renderDialog();
    const overlay = ensureDialog();
    overlay.classList.add('is-open');
    overlay.querySelector('[data-ai-profile-close]')?.focus();
  };
  const closeDialog = () => { document.getElementById('aiProfileOverlay')?.classList.remove('is-open'); lastFocusedElement?.focus?.(); };
  const applyProfile = () => {
    const overlay = ensureDialog();
    const next = { ...draftProfile, baseModel: overlay.querySelector('[data-ai-profile-base-model]')?.value || draftProfile.baseModel, baseReasoningEffort: overlay.querySelector('[data-ai-profile-base-reasoning]')?.value || draftProfile.baseReasoningEffort, routes: { ...draftProfile.routes }, reasoningEfforts: { ...draftProfile.reasoningEfforts } };
    overlay.querySelectorAll('[data-ai-profile-route]').forEach((select) => { next.routes[select.dataset.aiProfileRoute] = select.value; });
    overlay.querySelectorAll('[data-ai-profile-reasoning]').forEach((select) => { next.reasoningEfforts[select.dataset.aiProfileReasoning] = select.value; });
    profiles.saveActiveProfile(next);
    closeDialog();
    global.showToast?.(`Profil IA actif : ${profiles.getProfileLabel(profiles.getActiveProfile())}`);
  };
  function bindDialogEvents(overlay) {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.closest('[data-ai-profile-close]')) { closeDialog(); return; }
      const preset = event.target.closest('[data-ai-profile-preset]');
      if (preset) { draftProfile = profiles.getProfileForId(preset.dataset.aiProfilePreset); renderDialog(); return; }
      if (event.target.closest('[data-ai-profile-apply]')) applyProfile();
    });
    overlay.addEventListener('change', (event) => {
      if (event.target.matches('[data-ai-profile-base-model]')) draftProfile.baseModel = event.target.value;
      if (event.target.matches('[data-ai-profile-base-reasoning]')) draftProfile.baseReasoningEffort = event.target.value;
      if (event.target.matches('[data-ai-profile-route]')) draftProfile.routes[event.target.dataset.aiProfileRoute] = event.target.value;
      if (event.target.matches('[data-ai-profile-reasoning]')) draftProfile.reasoningEfforts[event.target.dataset.aiProfileReasoning] = event.target.value;
    });
  }
  document.getElementById('aiProfileButton')?.addEventListener('click', openDialog);
  global.addEventListener('pipeline:ai-profile-change', updateHeader);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && document.getElementById('aiProfileOverlay')?.classList.contains('is-open')) closeDialog(); });
  updateHeader();
  global.PipelineUIAIProfileUI = Object.freeze({ openDialog, closeDialog, updateHeader });
})(window);
