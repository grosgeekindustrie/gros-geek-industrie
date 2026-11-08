(function initPipelineUIAIProfileUI(global) {
  'use strict';
  const profiles = global.PipelineUIAIProfiles;
  if (!profiles) return;

  const TASK_LABELS = Object.freeze({ title: 'Titres', tags: 'Tags', description: 'Description', alt: 'Texte ALT', translations: 'Traductions', social: 'Réseaux sociaux et Pinterest' });
  let draftProfile = profiles.getActiveProfile();
  let selectedNamedPresetId = draftProfile.namedPresetId || '';
  let draftPresetName = draftProfile.namedPresetName || '';
  let lastFocusedElement = null;
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const buildOptions = (entries, selected) => entries.map(({ value, label }) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
  const buildModelOptions = (provider, selected) => buildOptions(profiles.getModelsForProvider(provider), selected);
  const buildReasoningOptions = (model, selected) => buildOptions(profiles.getReasoningEffortsForModel(model), selected);

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
          <section class="ai-profile-section ai-profile-saved-section">
            <div class="ai-profile-section-heading"><div><h3>Presets enregistrés</h3><p>Charger un preset ne modifie rien tant que tu ne l'appliques pas. Les réglages ne sont jamais sauvegardés automatiquement.</p></div><button class="btn btn-muted" type="button" data-ai-profile-new-preset>Nouveau</button></div>
            <div class="ai-profile-saved-list" data-ai-profile-saved-list></div>
            <div class="ai-profile-preset-editor">
              <label><span>Nom du preset</span><input class="ai-profile-select" type="text" maxlength="60" placeholder="Ex. Astra rédaction" data-ai-profile-preset-name></label>
              <div class="ai-profile-preset-actions"><button class="btn btn-muted" type="button" data-ai-profile-save-preset>Enregistrer</button><button class="btn btn-muted ai-profile-delete-button" type="button" data-ai-profile-delete-preset>Supprimer</button></div>
            </div>
          </section>
          <div class="ai-profile-provider-group"><div class="ai-profile-provider-heading"><span class="ai-provider-dot ai-provider-dot-anthropic"></span><strong>Claude</strong></div><div class="ai-profile-presets">
            <button class="ai-profile-preset" type="button" data-ai-profile-preset="claude-legacy"><strong>Claude actuel</strong><small>Le comportement historique, avec Sonnet 4.6 conservé pour les traductions.</small></button>
            <button class="ai-profile-preset" type="button" data-ai-profile-preset="claude-custom"><strong>Claude personnalisé</strong><small>Un modèle Claude différent pour chaque catégorie de travail.</small></button>
          </div></div>
          <div class="ai-profile-provider-group"><div class="ai-profile-provider-heading"><span class="ai-provider-dot ai-provider-dot-openai"></span><strong>GPT</strong></div><div class="ai-profile-presets">
            <button class="ai-profile-preset" type="button" data-ai-profile-preset="openai-standard"><strong>GPT uniforme</strong><small>Le même modèle et le même niveau de réflexion pour tous les agents.</small></button>
            <button class="ai-profile-preset" type="button" data-ai-profile-preset="openai-custom"><strong>GPT personnalisé</strong><small>Sol, Terra, Luna ou Astra réglables travail par travail.</small></button>
          </div></div>
          <div class="ai-profile-provider-group"><div class="ai-profile-provider-heading"><span class="ai-provider-dot ai-provider-dot-openai"></span><strong>GPT-6</strong></div><div class="ai-profile-presets">
            <button class="ai-profile-preset" type="button" data-ai-profile-preset="openai-6-standard"><strong>GPT-6 Sol</strong><small>Sol au niveau moyen pour tous les agents, recherche web au niveau faible.</small></button>
            <button class="ai-profile-preset" type="button" data-ai-profile-preset="openai-6-custom"><strong>GPT-6 personnalisé</strong><small>Sol ou Luna et niveau de réflexion réglables pour chaque travail.</small></button>
          </div></div>
          <section class="ai-profile-section" data-ai-profile-uniform><h3 data-ai-profile-uniform-title>Modèle principal</h3><p data-ai-profile-uniform-description></p><div class="ai-profile-uniform-controls"><label><span>Modèle</span><select class="ai-profile-select" data-ai-profile-base-model></select></label><label data-ai-profile-base-reasoning-wrap hidden><span>Niveau de réflexion</span><select class="ai-profile-select" data-ai-profile-base-reasoning></select></label></div></section>
          <section class="ai-profile-section" data-ai-profile-custom hidden><h3>Routage personnalisé</h3><p>Un pipeline lancé conserve ce profil. Une relance individuelle utilise le profil actif et sa famille de prompts.</p><div class="ai-profile-routes" data-ai-profile-routes></div></section>
          <section class="ai-profile-section" data-ai-description-research hidden>
            <h3>Recherche web avant Description</h3><p>Le modèle de recherche analyse jusqu’aux quatre premières images et vérifie le personnage, le lore et une éventuelle scène reconnaissable. Son brief est conservé pour les relances de Description jusqu’au prochain lancement complet du pipeline.</p>
            <div class="ai-profile-routes">
              <div class="ai-profile-route has-reasoning"><label for="ai-description-research-enabled">Activation</label><select class="ai-profile-select" id="ai-description-research-enabled" data-ai-description-research-enabled><option value="true">Activée</option><option value="false">Désactivée</option></select><select class="ai-profile-select" aria-label="Réutilisation de la recherche" data-ai-description-research-reuse><option value="true">Réutiliser jusqu’au prochain pipeline</option><option value="false">Toujours relancer</option></select></div>
              <div class="ai-profile-route has-reasoning"><label for="ai-description-research-model">Modèle de recherche</label><select class="ai-profile-select" id="ai-description-research-model" data-ai-description-research-model></select><select class="ai-profile-select" aria-label="Réflexion de la recherche" data-ai-description-research-reasoning></select></div>
              <div class="ai-profile-route has-reasoning"><label for="ai-description-research-calls">Budget web maximal</label><select class="ai-profile-select" id="ai-description-research-calls" data-ai-description-research-calls><option value="1">1 appel outil max.</option><option value="2">2 appels outil max.</option><option value="3">3 appels outil max.</option></select><select class="ai-profile-select" aria-label="Contexte de recherche" data-ai-description-research-context><option value="low">Contexte faible</option><option value="medium">Contexte moyen</option><option value="high">Contexte élevé</option></select></div>
            </div>
          </section>
        </div>
        <footer class="ai-profile-dialog-footer"><button class="btn btn-muted" type="button" data-ai-profile-close>Annuler</button><button class="btn btn-accent" type="button" data-ai-profile-apply>Appliquer le profil</button></footer>
      </section>`;
    document.body.appendChild(overlay);
    global.PipelineUIIcons?.hydrateIcons?.(overlay);
    bindDialogEvents(overlay);
    return overlay;
  };

  const renderSavedPresets = (overlay) => {
    const presets = profiles.getNamedPresets();
    overlay.querySelector('[data-ai-profile-saved-list]').innerHTML = presets.map((preset) => `<button class="ai-profile-saved-preset${preset.id === selectedNamedPresetId ? ' is-active' : ''}" type="button" data-ai-profile-saved-preset="${escapeHtml(preset.id)}"><strong>${escapeHtml(preset.name)}</strong><small>${escapeHtml(profiles.getProfileLabel(preset.config))}</small></button>`).join('') || '<p class="ai-profile-empty-presets">Aucun preset enregistré.</p>';
    const selected = presets.find(({ id }) => id === selectedNamedPresetId);
    overlay.querySelector('[data-ai-profile-preset-name]').value = draftPresetName;
    overlay.querySelector('[data-ai-profile-delete-preset]').disabled = !selected;
  };
  const renderRoute = (task, provider) => {
    const isOpenAI = provider === 'openai';
    const model = draftProfile.routes[task];
    const effort = profiles.normalizeOpenAIReasoningEffort(draftProfile.reasoningEfforts[task], draftProfile.baseReasoningEffort, model);
    return `<div class="ai-profile-route${isOpenAI ? ' has-reasoning' : ''}"><label for="ai-profile-route-${task}">${TASK_LABELS[task]}</label><select class="ai-profile-select" id="ai-profile-route-${task}" data-ai-profile-route="${task}">${buildModelOptions(provider, model)}</select>${isOpenAI ? `<select class="ai-profile-select" aria-label="Réflexion · ${TASK_LABELS[task]}" data-ai-profile-reasoning="${task}">${buildReasoningOptions(model, effort)}</select>` : ''}</div>`;
  };
  const renderDialog = () => {
    const overlay = ensureDialog();
    draftProfile = profiles.normalizeConfig(draftProfile);
    const isCustom = [profiles.PROFILE_IDS.CLAUDE_CUSTOM, profiles.PROFILE_IDS.OPENAI_CUSTOM, profiles.PROFILE_IDS.OPENAI_6_CUSTOM].includes(draftProfile.id);
    const isOpenAI = draftProfile.provider === 'openai';
    overlay.dataset.aiProvider = draftProfile.provider;
    overlay.querySelectorAll('[data-ai-profile-preset]').forEach((button) => button.classList.toggle('is-active', button.dataset.aiProfilePreset === draftProfile.id && !selectedNamedPresetId));
    overlay.querySelector('[data-ai-profile-uniform]').hidden = isCustom;
    overlay.querySelector('[data-ai-profile-custom]').hidden = !isCustom;
    overlay.querySelector('[data-ai-profile-uniform-title]').textContent = isOpenAI ? 'Configuration GPT uniforme' : 'Modèle Claude principal';
    overlay.querySelector('[data-ai-profile-uniform-description]').textContent = isOpenAI ? 'Le modèle et la réflexion sélectionnés seront utilisés partout.' : 'Pipeline et réseaux utilisent ce modèle. Les traductions restent sur Sonnet 4.6.';
    overlay.querySelector('[data-ai-profile-base-model]').innerHTML = buildModelOptions(draftProfile.provider, draftProfile.baseModel);
    overlay.querySelector('[data-ai-profile-base-reasoning-wrap]').hidden = !isOpenAI;
    overlay.querySelector('[data-ai-profile-base-reasoning]').innerHTML = buildReasoningOptions(draftProfile.baseModel, draftProfile.baseReasoningEffort);
    overlay.querySelector('[data-ai-profile-routes]').innerHTML = profiles.TASK_IDS.map((task) => renderRoute(task, draftProfile.provider)).join('');
    const research = profiles.normalizeDescriptionResearch(draftProfile.descriptionResearch, draftProfile.provider);
    overlay.querySelector('[data-ai-description-research]').hidden = !isOpenAI;
    overlay.querySelector('[data-ai-description-research-enabled]').value = String(research.enabled);
    overlay.querySelector('[data-ai-description-research-reuse]').value = String(research.reuseIdentical);
    overlay.querySelector('[data-ai-description-research-model]').innerHTML = buildModelOptions('openai', research.model);
    overlay.querySelector('[data-ai-description-research-reasoning]').innerHTML = buildReasoningOptions(research.model, research.reasoningEffort);
    overlay.querySelector('[data-ai-description-research-calls]').value = String(research.maxToolCalls);
    overlay.querySelector('[data-ai-description-research-context]').value = research.searchContextSize;
    renderSavedPresets(overlay);
  };
  const syncDraftFromForm = () => {
    const overlay = ensureDialog();
    const next = { ...draftProfile, baseModel: overlay.querySelector('[data-ai-profile-base-model]')?.value || draftProfile.baseModel, baseReasoningEffort: overlay.querySelector('[data-ai-profile-base-reasoning]')?.value || draftProfile.baseReasoningEffort, routes: { ...draftProfile.routes }, reasoningEfforts: { ...draftProfile.reasoningEfforts }, descriptionResearch: { ...(draftProfile.descriptionResearch || {}) } };
    overlay.querySelectorAll('[data-ai-profile-route]').forEach((select) => { next.routes[select.dataset.aiProfileRoute] = select.value; });
    overlay.querySelectorAll('[data-ai-profile-reasoning]').forEach((select) => { next.reasoningEfforts[select.dataset.aiProfileReasoning] = select.value; });
    next.descriptionResearch = { enabled: overlay.querySelector('[data-ai-description-research-enabled]')?.value !== 'false', reuseIdentical: overlay.querySelector('[data-ai-description-research-reuse]')?.value !== 'false', model: overlay.querySelector('[data-ai-description-research-model]')?.value, reasoningEffort: overlay.querySelector('[data-ai-description-research-reasoning]')?.value, maxToolCalls: Number(overlay.querySelector('[data-ai-description-research-calls]')?.value) || 2, searchContextSize: overlay.querySelector('[data-ai-description-research-context]')?.value || 'low' };
    draftProfile = profiles.normalizeConfig(next);
    return draftProfile;
  };
  const updateHeader = () => {
    const label = document.getElementById('aiProfileButtonLabel');
    const button = document.getElementById('aiProfileButton');
    const profile = profiles.getActiveProfile();
    const text = profiles.getProfileLabel(profile);
    if (label) label.textContent = `IA · ${text}`;
    if (button) { button.title = `Profil IA actif : ${text}`; button.dataset.aiProvider = profile.provider; }
  };
  const openDialog = () => { lastFocusedElement = document.activeElement; draftProfile = profiles.getActiveProfile(); selectedNamedPresetId = draftProfile.namedPresetId || ''; draftPresetName = draftProfile.namedPresetName || profiles.getNamedPreset(selectedNamedPresetId)?.name || ''; renderDialog(); const overlay = ensureDialog(); overlay.classList.add('is-open'); overlay.querySelector('[data-ai-profile-close]')?.focus(); };
  const closeDialog = () => { document.getElementById('aiProfileOverlay')?.classList.remove('is-open'); lastFocusedElement?.focus?.(); };
  const applyProfile = () => {
    const next = syncDraftFromForm();
    const selected = selectedNamedPresetId ? profiles.getNamedPreset(selectedNamedPresetId) : null;
    profiles.saveActiveProfile(next, { namedPresetId: selected && profiles.configsEqual(next, selected.config) ? selected.id : '' });
    closeDialog();
    global.showToast?.(`Profil IA actif : ${profiles.getProfileLabel(profiles.getActiveProfile())}`);
  };
  const savePreset = () => {
    const overlay = ensureDialog();
    const config = syncDraftFromForm();
    const name = draftPresetName || overlay.querySelector('[data-ai-profile-preset-name]')?.value;
    try {
      const saved = selectedNamedPresetId ? profiles.updateNamedPreset(selectedNamedPresetId, { name, config }) : profiles.createNamedPreset(name, config);
      selectedNamedPresetId = saved.id;
      draftPresetName = saved.name;
      global.showToast?.(`Preset « ${saved.name} » enregistré`);
      renderDialog();
    } catch (error) { global.showToast?.(error.message || 'Impossible d’enregistrer le preset'); }
  };
  const deletePreset = () => {
    if (!selectedNamedPresetId) return;
    const selected = profiles.getNamedPreset(selectedNamedPresetId);
    if (!selected || !global.confirm?.(`Supprimer le preset « ${selected.name} » ?`)) return;
    profiles.deleteNamedPreset(selectedNamedPresetId);
    selectedNamedPresetId = '';
    draftPresetName = '';
    global.showToast?.(`Preset « ${selected.name} » supprimé`);
    renderDialog();
    updateHeader();
  };
  function bindDialogEvents(overlay) {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.closest('[data-ai-profile-close]')) { closeDialog(); return; }
      const savedPreset = event.target.closest('[data-ai-profile-saved-preset]');
      if (savedPreset) { const saved = profiles.getNamedPreset(savedPreset.dataset.aiProfileSavedPreset); if (saved) { selectedNamedPresetId = saved.id; draftPresetName = saved.name; draftProfile = saved.config; renderDialog(); } return; }
      const builtInPreset = event.target.closest('[data-ai-profile-preset]');
      if (builtInPreset) { selectedNamedPresetId = ''; draftPresetName = ''; draftProfile = profiles.getProfileForId(builtInPreset.dataset.aiProfilePreset); renderDialog(); return; }
      if (event.target.closest('[data-ai-profile-new-preset]')) { syncDraftFromForm(); selectedNamedPresetId = ''; draftPresetName = ''; renderSavedPresets(overlay); overlay.querySelector('[data-ai-profile-preset-name]')?.focus(); return; }
      if (event.target.closest('[data-ai-profile-save-preset]')) { savePreset(); return; }
      if (event.target.closest('[data-ai-profile-delete-preset]')) { deletePreset(); return; }
      if (event.target.closest('[data-ai-profile-apply]')) applyProfile();
    });
    overlay.addEventListener('input', (event) => {
      if (event.target.matches('[data-ai-profile-preset-name]')) draftPresetName = event.target.value;
    });
    overlay.addEventListener('change', (event) => {
      if (!event.target.matches('.ai-profile-select')) return;
      syncDraftFromForm();
      if (event.target.matches('[data-ai-profile-base-model], [data-ai-profile-route], [data-ai-description-research-model]')) renderDialog();
    });
  }
  document.getElementById('aiProfileButton')?.addEventListener('click', openDialog);
  global.addEventListener('pipeline:ai-profile-change', updateHeader);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && document.getElementById('aiProfileOverlay')?.classList.contains('is-open')) closeDialog(); });
  updateHeader();
  global.PipelineUIAIProfileUI = Object.freeze({ openDialog, closeDialog, updateHeader });
})(window);
