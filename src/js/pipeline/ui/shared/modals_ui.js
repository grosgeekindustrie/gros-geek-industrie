(function initPipelineUIModals(global) {

// Modals métier de bibliothèque.
// Gère les modals de validation / blacklist et la persistance liée aux bibliothèques.
// Module DOM-heavy : toute modification doit rester ciblée et retestée visuellement.
  global.PipelineUI = global.PipelineUI || {};
  const sharedConstants = global.PipelineUISharedConstants || {};
  const logger = global.PipelineUILogger?.createLogger?.(sharedConstants.LOG_PREFIXES?.UI || 'ui');
  const helpers = () => global.PipelineUIHelpers || {};

  function ensureLibraryModals() {
    if (document.getElementById('libraryBlacklistModal')) return;

    const host = document.createElement('div');
    host.innerHTML = `
<div id="libraryBlacklistModal" class="library-modal">
  <div class="library-modal-card" role="dialog" aria-modal="true" aria-labelledby="libraryBlacklistModalTitle">
    <h3 id="libraryBlacklistModalTitle" class="library-modal-title">Blacklister</h3>
    <div class="library-modal-subtitle">Élément actuel</div>
    <div id="libraryBlacklistCurrent" class="library-modal-current"></div>
    <textarea
      id="libraryBlacklistTextarea"
      class="library-modal-textarea"
      placeholder="Valeur à blacklister. Tu peux en mettre plusieurs séparées par des virgules."
    ></textarea>
    <div class="library-modal-hint">
      Si le champ est vide, le tag ou le titre du bouton sera blacklisté.<br>
      Tu peux saisir un segment, le texte complet, ou plusieurs entrées séparées par des virgules.
    </div>
    <div id="libraryBlacklistFeedback" class="library-modal-feedback"></div>
    <div class="library-modal-actions">
      <button type="button" class="library-modal-btn" onclick="closeLibraryBlacklistModal()">Annuler</button>
      <button type="button" class="library-modal-btn primary" onclick="confirmLibraryBlacklistModal()">OK</button>
    </div>
  </div>
</div>
<div id="libraryValidatedModal" class="library-modal">
  <div class="library-modal-card" role="dialog" aria-modal="true" aria-labelledby="libraryValidatedModalTitle">
    <h3 id="libraryValidatedModalTitle" class="library-modal-title">Ajouter aux validés</h3>
    <div class="library-modal-subtitle">Ajout manuel</div>
    <div class="library-modal-current">
      Saisis une ou plusieurs valeurs séparées par des virgules.
    </div>
    <textarea
      id="libraryValidatedTextarea"
      class="library-modal-textarea"
      placeholder="Ex: figurine résine à peindre, garage kit anime"
    ></textarea>
    <div class="library-modal-hint">
      Si le champ est vide et que tu cliques sur OK, rien ne se passe.
    </div>
    <div id="libraryValidatedFeedback" class="library-modal-feedback"></div>
    <div class="library-modal-actions">
      <button type="button" class="library-modal-btn" onclick="closeLibraryValidatedModal()">Annuler</button>
      <button type="button" class="library-modal-btn primary" onclick="confirmLibraryValidatedModal()">OK</button>
    </div>
  </div>
</div>
`;

    document.body.appendChild(host);

    document.getElementById('libraryBlacklistModal').addEventListener('click', (event) => {
      if (event.target.id === 'libraryBlacklistModal') closeLibraryBlacklistModal();
    });
    document.getElementById('libraryValidatedModal').addEventListener('click', (event) => {
      if (event.target.id === 'libraryValidatedModal') closeLibraryValidatedModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      closeLibraryBlacklistModal();
      closeLibraryValidatedModal();
    });
  }

  function setLibraryModalFeedback(modalType, text = '', tone = '') {
    const id = modalType === 'blacklist' ? 'libraryBlacklistFeedback' : 'libraryValidatedFeedback';
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = text;
    node.className = `library-modal-feedback${tone ? ` ${tone}` : ''}`;
  }

  function openLibraryBlacklistModal({ kind, currentValue, itemId = null, source = 'main', agentId = 'titre' }) {
    ensureLibraryModals();
    global.__libraryBlacklistState = {
      kind,
      currentValue: String(currentValue || '').trim(),
      itemId,
      source,
      agentId,
    };

    const modal = document.getElementById('libraryBlacklistModal');
    const title = document.getElementById('libraryBlacklistModalTitle');
    const current = document.getElementById('libraryBlacklistCurrent');
    const textarea = document.getElementById('libraryBlacklistTextarea');

    title.textContent = kind === 'tags' ? 'Blacklister des tags' : 'Blacklister des titres';
    current.textContent = global.__libraryBlacklistState.currentValue || '—';
    textarea.value = global.__libraryBlacklistState.currentValue || '';
    setLibraryModalFeedback('blacklist', '');
    modal.classList.add('visible');

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
    }, 0);
  }

  function closeLibraryBlacklistModal() {
    const modal = document.getElementById('libraryBlacklistModal');
    if (modal) modal.classList.remove('visible');
    global.__libraryBlacklistState = null;
  }

  function openLibraryValidatedModal({ kind, source = 'main', agentId = 'titre' }) {
    ensureLibraryModals();
    global.__libraryValidatedState = { kind, source, agentId };

    const modal = document.getElementById('libraryValidatedModal');
    const title = document.getElementById('libraryValidatedModalTitle');
    const textarea = document.getElementById('libraryValidatedTextarea');

    title.textContent = kind === 'tags' ? 'Ajouter des tags validés' : 'Ajouter des titres validés';
    textarea.value = '';
    setLibraryModalFeedback('validated', '');
    modal.classList.add('visible');

    setTimeout(() => textarea.focus(), 0);
  }

  function closeLibraryValidatedModal() {
    const modal = document.getElementById('libraryValidatedModal');
    if (modal) modal.classList.remove('visible');
    global.__libraryValidatedState = null;
  }

  async function saveTagsLibrary(validated, blacklisted) {
    const updated = global.buildBiblioTagsRaw(validated, blacklisted);
    const response = await fetch(`/files/biblios/${global.currentMode}/tags.md`, {
      method: 'PUT',
      body: updated,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    global.state.bibliosByMode[global.currentMode].tags = updated;
    document.dispatchEvent(new CustomEvent('pipeline:tags-library-updated'));
  }

  async function saveTitresLibrary(validated, blacklisted) {
    const updated = global.buildBiblioTitresRaw(validated, blacklisted);
    const response = await fetch(`/files/biblios/${global.currentMode}/titres.md`, {
      method: 'PUT',
      body: updated,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    global.state.bibliosByMode[global.currentMode].titres = updated;
  }

  async function confirmLibraryBlacklistModal() {
    const state = global.__libraryBlacklistState;
    if (!state) return;

    const textarea = document.getElementById('libraryBlacklistTextarea');
    const rawEntries = helpers().parseBulkLibraryEntries(textarea?.value || '');
    const fallback = state.currentValue ? [state.currentValue] : [];
    const entries = rawEntries.length ? rawEntries : fallback;

    if (!entries.length) {
      closeLibraryBlacklistModal();
      return;
    }

    try {
      if (state.kind === 'tags') {
        const { validated, blacklisted } = global.parseBiblioTags(global.getBiblio('tags'));
        const added = [];

        for (const entry of entries.map(helpers().normalizeTagValue)) {
          if (!entry) continue;
          if (blacklisted.some((value) => helpers().sameTag(value, entry))) continue;
          blacklisted.push(entry);
          added.push(entry);
        }

        if (added.length) {
          await saveTagsLibrary(validated, blacklisted);
        }

        if (state.itemId) {
          const item = document.getElementById(state.itemId);
          if (item) {
            item.classList.remove('validated');
            item.classList.add('invalidated');
            const autoRegenTagFn = global.PipelineUITags.autoRegenTag;

            if (typeof autoRegenTagFn === 'function') {
              setTimeout(() => autoRegenTagFn(
                state.currentValue,
                added[0] || state.currentValue,
                item
              ), 0);
            } else {
              logger?.error?.('autoRegenTag introuvable');
            }
          }
        }

        global.showToast(
          added.length ? ` ${added.length} tag(s) blacklisté(s)` : 'Déjà blacklisté',
          added.length ? undefined : '#7eb8f7'
        );
      } else {
        const { validated, blacklisted } = global.parseBiblioTitres(global.getBiblio('titres'));
        const added = [];

        for (const entry of entries.map(helpers().normalizeTitreValue)) {
          if (!entry) continue;
          if (blacklisted.some((value) => helpers().sameTitre(value, entry))) continue;
          blacklisted.push(entry);
          added.push(entry);
        }

        if (added.length) {
          await saveTitresLibrary(validated, blacklisted);
        }

        if (state.itemId) {
          const item = document.getElementById(state.itemId);
          if (item) {
            item.classList.remove('validated');
            item.classList.add('invalidated');
            const autoRegenTitreFn = global.PipelineUITitles.autoRegenTitre;

            if (typeof autoRegenTitreFn === 'function') {
              setTimeout(() => autoRegenTitreFn(
                state.currentValue,
                added[0] || state.currentValue,
                item,
                state.agentId || 'titre'
              ), 0);
            } else {
              logger?.error?.('autoRegenTitre introuvable');
            }
          }
        }

        global.showToast(
          added.length ? ` ${added.length} titre(s) blacklisté(s)` : 'Déjà blacklisté',
          added.length ? undefined : '#7eb8f7'
        );
      }

      closeLibraryBlacklistModal();
    } catch (error) {
      setLibraryModalFeedback('blacklist', 'Erreur de sauvegarde', 'error');
    }
  }

  async function confirmLibraryValidatedModal() {
    const state = global.__libraryValidatedState;
    if (!state) return;

    const textarea = document.getElementById('libraryValidatedTextarea');
    const entries = helpers().parseBulkLibraryEntries(textarea?.value || '');
    if (!entries.length) {
      closeLibraryValidatedModal();
      return;
    }

    try {
      if (state.kind === 'tags') {
        const { validated, blacklisted } = global.parseBiblioTags(global.getBiblio('tags'));
        const accepted = [];
        for (const raw of entries) {
          const value = helpers().normalizeTagValue(raw);
          if (!value) continue;
          if (validated.some((entry) => helpers().sameTag(entry, value))) continue;
          if (accepted.some((entry) => helpers().sameTag(entry, value))) continue;
          accepted.push(value);
        }
        if (accepted.length) {
          await saveTagsLibrary([...validated, ...accepted], blacklisted);
        }
        global.showToast(`✅ ${accepted.length} tag(s) validé(s) ajouté(s)`);
      } else {
        const { validated, blacklisted } = global.parseBiblioTitres(global.getBiblio('titres'));
        const accepted = [];
        for (const raw of entries) {
          const value = helpers().normalizeTitreValue(raw);
          if (!value) continue;
          if (validated.some((entry) => helpers().sameTitre(entry, value))) continue;
          if (accepted.some((entry) => helpers().sameTitre(entry, value))) continue;
          accepted.push(value);
        }
        if (accepted.length) {
          await saveTitresLibrary([...validated, ...accepted], blacklisted);
        }
        global.showToast(`✅ ${accepted.length} titre(s) validé(s) ajouté(s)`);
      }

      closeLibraryValidatedModal();
    } catch (error) {
      setLibraryModalFeedback('validated', 'Erreur de sauvegarde', 'error');
    }
  }

  function ensureZoneLibraryActionButton(zoneEl, buttonId, label, onClick) {
    if (!zoneEl) return;

    let bar = zoneEl.querySelector('.library-actions-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'library-actions-bar';
      zoneEl.prepend(bar);
    }

    let button = document.getElementById(buttonId);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = buttonId;
      button.className = 'library-action-btn';
      bar.appendChild(button);
    }

    button.textContent = label;
    button.onclick = onClick;
  }

  function ensureTagsManualAddButton() {
    const zone = document.getElementById(`${global.pfx()}-sel-tags`);
    ensureZoneLibraryActionButton(
      zone,
      `${global.pfx()}-manual-valid-tags`,
      '➕ Ajouter des tags validés',
      () => openLibraryValidatedModal({ kind: 'tags', source: 'main' })
    );
  }

  function ensureTitresManualAddButton(agentId) {
    const zone = document.getElementById(`${global.pfx()}-sel-${agentId}`);
    ensureZoneLibraryActionButton(
      zone,
      `${global.pfx()}-manual-valid-${agentId}`,
      '➕ Ajouter des titres validés',
      () => openLibraryValidatedModal({ kind: 'titres', source: 'main', agentId })
    );
  }

  function ensureExplorerManualAddButton(kind, agentId = 'titre') {
    const label = document.getElementById('explorerListLabel');
    if (!label) return;

    let bar = document.getElementById('explorerLibraryActions');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'explorerLibraryActions';
      bar.className = 'explorer-library-actions';
      label.insertAdjacentElement('afterend', bar);
    }

    let button = document.getElementById('explorerManualValidBtn');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'explorerManualValidBtn';
      button.className = 'library-action-btn';
      bar.appendChild(button);
    }

    button.textContent = kind === 'tags'
      ? '➕ Ajouter des tags validés'
      : '➕ Ajouter des titres validés';
    button.onclick = () => openLibraryValidatedModal({ kind, source: 'explorer', agentId });
  }

  global.PipelineUIModals = {
    ensureLibraryModals,
    openLibraryBlacklistModal,
    closeLibraryBlacklistModal,
    openLibraryValidatedModal,
    closeLibraryValidatedModal,
    confirmLibraryBlacklistModal,
    confirmLibraryValidatedModal,
    ensureTagsManualAddButton,
    ensureTitresManualAddButton,
    ensureExplorerManualAddButton,
  };

  global.PipelineUI.modals = global.PipelineUI.modals || {};
  Object.assign(global.PipelineUI.modals, global.PipelineUIModals);
})(window);
