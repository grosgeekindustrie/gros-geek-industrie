'use strict';

// Workspace traduction visible sous l'output final existant.
// Step 3 étroit : UI benchable, édition locale, alias lookup, traduction, import/export pack MD.

(function initPipelineUITranslationsWorkspace(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUITranslationsWorkspace = global.PipelineUITranslationsWorkspace || {};

  const SUPPORTED_LANGUAGES = ['fr', 'en', 'de', 'es'];
  const FIELD_LABELS = Object.freeze({
    title: 'Titre',
    tags: 'Tags',
    description: 'Description',
    alt: 'Balise ALT',
  });
  const TEXTAREA_ROWS = Object.freeze({
    title: 3,
    tags: 4,
    description: 10,
    alt: 6,
  });

  const getState = () => global.state || {};
  const getRuntime = () => global.PipelineUI?.translationsRuntime || global.PipelineUITranslationsRuntime || {};
  const getModeFromPrefix = (prefix = 'tt') => (prefix === 'col' ? 'collection' : 'tabletop');
  const getVisibleLanguages = (prefix = 'tt') => {
    const runtime = getRuntime();
    const mode = getModeFromPrefix(prefix);
    const visible = runtime.getVisibleTranslationLanguages?.(mode) || ['fr'];
    return visible.filter((language) => SUPPORTED_LANGUAGES.includes(language));
  };

  const getWorkspace = (prefix = 'tt') => getRuntime().ensureTranslationState?.(prefix) || null;
  const getMount = (prefix = 'tt') => document.getElementById(`translationWorkspace-${prefix}`);
  const getFinalOutputPanel = (prefix = 'tt') => document.getElementById(`finalOutput-${prefix}`);
  const getLanguageLabel = (language = 'fr') => {
    const map = getRuntime().SUPPORTED_TRANSLATION_LANGUAGES || {};
    return map[language]?.label || language.toUpperCase();
  };
  const normalizeWorkspaceLanguage = (language = '') => {
    const normalized = String(language || '').trim().toLowerCase();
    return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : '';
  };
  const escapeHtml = (value = '') => String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const getPrefixBaseName = (prefix = 'tt') => (prefix === 'col' ? 'collection' : 'tabletop_dnd');
  const getTimestampSlug = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  };

  const hasSourceOutputs = () => {
    const outputs = getState().outputs || {};
    return Boolean(
      String(outputs.titre_valide || '').trim()
      || String(outputs.tags || '').trim()
      || String(outputs.description_assembled || outputs.description || '').trim()
      || String(outputs.alt || '').trim()
    );
  };

  const hasWorkspaceContent = (workspace) => {
    if (!workspace) return false;
    return SUPPORTED_LANGUAGES.some((language) => {
      const result = workspace.results?.[language] || {};
      return Boolean(
        String(result.title || '').trim()
        || String(result.tags || '').trim()
        || String(result.description || '').trim()
        || String(result.alt || '').trim()
      );
    });
  };

  const ensureWorkspaceSeeded = (prefix = 'tt') => {
    const runtime = getRuntime();
    const workspace = getWorkspace(prefix);
    if (!workspace) return null;

    if (hasSourceOutputs() && !hasWorkspaceContent(workspace)) {
      runtime.captureTranslationSource?.(prefix);
    }

    workspace.meta = workspace.meta || {};
    const visibleLanguages = getVisibleLanguages(prefix);
    if (!visibleLanguages.includes(workspace.meta.activeLanguage)) {
      workspace.meta.activeLanguage = visibleLanguages.includes('fr') ? 'fr' : visibleLanguages[0];
    }

    return workspace;
  };

  const getEditableSourceSnapshot = (prefix = 'tt') => {
    const workspace = getWorkspace(prefix);
    const frResult = workspace?.results?.fr || {};
    const frAliases = workspace?.aliases?.fr || {};

    return {
      title: String(frResult.title || workspace?.source?.title || '').trim(),
      tags: String(frResult.tags || workspace?.source?.tags || '').trim(),
      description: String(frResult.description || workspace?.source?.description || '').trim(),
      alt: String(frResult.alt || workspace?.source?.alt || '').trim(),
      name: String(frAliases.name || workspace?.source?.name || '').trim(),
      universe: String(frAliases.universe || workspace?.source?.universe || '').trim(),
    };
  };

  const getAliasesSnapshot = (prefix = 'tt') => {
    const workspace = getWorkspace(prefix);
    const aliases = {};

    SUPPORTED_LANGUAGES.forEach((language) => {
      aliases[language] = {
        name: String(workspace?.aliases?.[language]?.name || '').trim(),
        universe: String(workspace?.aliases?.[language]?.universe || '').trim(),
      };
    });

    return aliases;
  };

  const buildPromptMenuMarkup = (workspace) => {
    const isOpen = Boolean(workspace.meta?.promptMenuOpen);

    return `
      <div class="translation-prompt-menu-wrap">
        <button
          type="button"
          class="btn btn-muted translation-prompt-toggle"
          data-role="prompt-menu-toggle"
          aria-expanded="${isOpen ? 'true' : 'false'}"
          title="Prompts traduction"
        >⚙️</button>
        ${isOpen ? `
          <div class="translation-prompt-menu">
            <button type="button" class="translation-prompt-action" data-role="open-translate-prompt">📝 Prompt traduction</button>
            <button type="button" class="translation-prompt-action" data-role="open-alias-prompt">🧭 Prompt alias</button>
            <button type="button" class="translation-prompt-action" data-role="refresh-source">↻ Recharger FR</button>
          </div>
        ` : ''}
      </div>
    `;
  };

  const buildToolbarMarkup = (prefix, workspace, visibleLanguages) => {
    const activeLanguage = workspace.meta.activeLanguage || 'fr';
    const hasTargetLanguage = visibleLanguages.some((language) => language !== 'fr');
    const targetHint = activeLanguage === 'fr'
      ? (hasTargetLanguage ? 'Traduira la première langue active' : 'Active EN / DE / ES dans les paramètres')
      : `Traduira ${activeLanguage.toUpperCase()}`;

    return `
      <div class="translation-toolbar">
        <div class="translation-toolbar-group">
          <button type="button" class="btn btn-accent" data-role="translate" data-prefix="${prefix}" ${hasTargetLanguage ? '' : 'disabled'}>🌍 Traduire</button>
          <button type="button" class="btn btn-muted" data-role="import" data-prefix="${prefix}">📥 Importer</button>
          ${buildPromptMenuMarkup(workspace)}
          <span class="translation-status">${escapeHtml(targetHint)}</span>
        </div>
        <div class="translation-toolbar-group">
          <button type="button" class="btn btn-muted" data-role="export" data-prefix="${prefix}">💾 Export</button>
        </div>
      </div>
    `;
  };

  const buildAliasGridMarkup = (workspace, visibleLanguages) => `
    <div class="translation-alias-panel">
      <div class="translation-alias-head">
        <div>
          <div class="translation-alias-title">Alias marché</div>
          <div class="translation-alias-hint">Les alias alimentent l'agent alias et guident la traduction.</div>
        </div>
        <button type="button" class="btn btn-muted" data-role="lookup-alias">🧭 Alias</button>
      </div>
      <div class="translation-alias-grid">
        ${visibleLanguages.map((language) => {
          const entry = workspace.aliases?.[language] || {};
          return `
            <div class="translation-alias-card">
              <div class="translation-language-code">${escapeHtml(language)}</div>
              <label class="translation-label">
                Alias nom
                <input
                  class="translation-input"
                  type="text"
                  data-role="alias-input"
                  data-language="${language}"
                  data-field="name"
                  value="${escapeHtml(entry.name || '')}"
                  placeholder="Nom ${escapeHtml(language.toUpperCase())}"
                >
              </label>
              <label class="translation-label">
                Alias univers
                <input
                  class="translation-input"
                  type="text"
                  data-role="alias-input"
                  data-language="${language}"
                  data-field="universe"
                  value="${escapeHtml(entry.universe || '')}"
                  placeholder="Univers ${escapeHtml(language.toUpperCase())}"
                >
              </label>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  const buildTabsMarkup = (workspace, visibleLanguages) => `
    <div class="translation-tabs" role="tablist" aria-label="Langues traduites">
      ${visibleLanguages.map((language) => {
        const isActive = workspace.meta.activeLanguage === language;
        const isTranslated = language !== 'fr' && workspace.meta.translatedAtByLanguage?.[language];
        const suffix = isTranslated ? ' • traduite' : '';
        return `
          <button
            type="button"
            class="translation-tab ${isActive ? 'is-active' : ''}"
            data-role="tab"
            data-language="${language}"
            aria-selected="${isActive ? 'true' : 'false'}"
          >${escapeHtml(language.toUpperCase())}${escapeHtml(suffix)}</button>
        `;
      }).join('')}
    </div>
  `;

  const buildEditorMarkup = (workspace) => {
    const language = workspace.meta.activeLanguage || 'fr';
    const result = workspace.results?.[language] || {};

    const cards = Object.entries(FIELD_LABELS).map(([field, label]) => `
      <div class="translation-editor-card">
        <div class="translation-editor-head">
          <div class="translation-editor-title">${escapeHtml(label)} · ${escapeHtml(language.toUpperCase())}</div>
          <div class="translation-editor-actions">
            <button type="button" class="btn btn-muted btn-xs-inline" data-role="copy-field" data-language="${language}" data-field="${field}">📋 Copier</button>
          </div>
        </div>
        <textarea
          class="translation-textarea"
          data-role="result-input"
          data-language="${language}"
          data-field="${field}"
          data-prefix-field="${language === 'fr' ? field : ''}"
          rows="${TEXTAREA_ROWS[field]}"
          spellcheck="false"
        >${escapeHtml(result[field] || '')}</textarea>
      </div>
    `).join('');

    return `
      <div class="translation-editor">
        <div class="translation-editor-head">
          <div>
            <div class="translation-alias-title">Résultat ${escapeHtml(language.toUpperCase())}</div>
            <div class="translation-alias-hint">Champs éditables · copie / collage natifs.</div>
          </div>
          <div class="translation-editor-actions">
            <button type="button" class="btn btn-muted" data-role="copy-all-language" data-language="${language}">📋 Tout copier</button>
          </div>
        </div>
        ${cards}
      </div>
    `;
  };

  const getWorkspacePack = (prefix = 'tt') => {
    const workspace = getWorkspace(prefix);
    const mode = getModeFromPrefix(prefix);
    const visibleLanguages = getVisibleLanguages(prefix);

    return {
      version: 1,
      kind: 'translation_workspace',
      mode,
      prefix,
      visibleLanguages,
      exportedAt: new Date().toISOString(),
      workspace,
    };
  };

  const buildSectionBlock = (heading = '', value = '') => [
    `## ${heading}`,
    String(value || '').trim(),
    '',
  ].join('\n');

  const buildWorkspaceMarkdownPack = (prefix = 'tt') => {
    const payload = getWorkspacePack(prefix);
    const sections = [
      '# Translation Workspace Pack',
      '',
      buildSectionBlock('MODE', payload.mode),
      buildSectionBlock('PREFIX', payload.prefix),
      buildSectionBlock('VISIBLE_LANGUAGES', payload.visibleLanguages.join(', ')),
      buildSectionBlock('EXPORTED_AT', payload.exportedAt),
      buildSectionBlock('SOURCE_NAME', payload.workspace?.source?.name || ''),
      buildSectionBlock('SOURCE_UNIVERSE', payload.workspace?.source?.universe || ''),
    ];

    payload.visibleLanguages.forEach((language) => {
      const aliases = payload.workspace?.aliases?.[language] || {};
      const result = payload.workspace?.results?.[language] || {};
      sections.push(buildSectionBlock(`ALIAS_${language.toUpperCase()}_NAME`, aliases.name || ''));
      sections.push(buildSectionBlock(`ALIAS_${language.toUpperCase()}_UNIVERSE`, aliases.universe || ''));
      sections.push(buildSectionBlock(`${language.toUpperCase()}_TITLE`, result.title || ''));
      sections.push(buildSectionBlock(`${language.toUpperCase()}_TAGS`, result.tags || ''));
      sections.push(buildSectionBlock(`${language.toUpperCase()}_DESCRIPTION`, result.description || ''));
      sections.push(buildSectionBlock(`${language.toUpperCase()}_ALT`, result.alt || ''));
    });

    sections.push('```json');
    sections.push(JSON.stringify(payload, null, 2));
    sections.push('```');
    sections.push('');

    return sections.join('\n');
  };

  const extractSectionValue = (input = '', heading = '') => {
    const escapedHeading = String(heading || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^##\\s+${escapedHeading}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`, 'im');
    const match = String(input || '').match(pattern);
    return match ? match[1].trim() : '';
  };

  const createEmptyImportWorkspace = () => ({
    source: { title: '', tags: '', description: '', alt: '', name: '', universe: '' },
    aliases: {
      fr: { name: '', universe: '' },
      en: { name: '', universe: '' },
      de: { name: '', universe: '' },
      es: { name: '', universe: '' },
    },
    results: {
      fr: { title: '', tags: '', description: '', alt: '', rawResponse: '' },
      en: { title: '', tags: '', description: '', alt: '', rawResponse: '' },
      de: { title: '', tags: '', description: '', alt: '', rawResponse: '' },
      es: { title: '', tags: '', description: '', alt: '', rawResponse: '' },
    },
    meta: { sourceCapturedAt: '', aliasLookupAt: '', translatedAtByLanguage: {}, activeLanguage: 'fr', promptMenuOpen: false },
  });

  const parseLegacyListingMarkdownPack = (input = '') => {
    const workspace = createEmptyImportWorkspace();
    const mode = String(extractSectionValue(input, 'MODE') || 'tabletop').trim() || 'tabletop';
    const prefix = String(extractSectionValue(input, 'PREFIX') || (mode === 'collection' ? 'col' : 'tt')).trim() || (mode === 'collection' ? 'col' : 'tt');
    const visibleLanguages = [
      'fr',
      ...String(extractSectionValue(input, 'VISIBLE_LANGUAGES') || '')
        .split(/[;,\n]/)
        .map(normalizeWorkspaceLanguage)
        .filter((language) => language && language !== 'fr'),
    ].filter((language, index, array) => array.indexOf(language) === index);

    workspace.source.name = extractSectionValue(input, 'SOURCE_NAME');
    workspace.source.universe = extractSectionValue(input, 'SOURCE_UNIVERSE');
    workspace.aliases.fr = { name: workspace.source.name, universe: workspace.source.universe };

    SUPPORTED_LANGUAGES.forEach((language) => {
      const languageKey = language.toUpperCase();
      workspace.aliases[language] = {
        name: extractSectionValue(input, `ALIAS_${languageKey}_NAME`) || workspace.aliases[language]?.name || '',
        universe: extractSectionValue(input, `ALIAS_${languageKey}_UNIVERSE`) || workspace.aliases[language]?.universe || '',
      };
      workspace.results[language] = {
        ...workspace.results[language],
        title: extractSectionValue(input, `${languageKey}_TITLE`) || workspace.results[language]?.title || '',
        tags: extractSectionValue(input, `${languageKey}_TAGS`) || workspace.results[language]?.tags || '',
        description: extractSectionValue(input, `${languageKey}_DESCRIPTION`) || workspace.results[language]?.description || '',
        alt: extractSectionValue(input, `${languageKey}_ALT`) || workspace.results[language]?.alt || '',
      };
    });

    workspace.source.title = workspace.results.fr.title;
    workspace.source.tags = workspace.results.fr.tags;
    workspace.source.description = workspace.results.fr.description;
    workspace.source.alt = workspace.results.fr.alt;

    return {
      version: 1,
      kind: 'translation_workspace',
      mode,
      prefix,
      visibleLanguages,
      exportedAt: extractSectionValue(input, 'EXPORTED_AT') || new Date().toISOString(),
      workspace,
    };
  };

  const parseWorkspaceMarkdownPack = (raw = '') => {
    const input = String(raw || '').trim();
    const fencedMatch = input.match(/```json\s*([\s\S]*?)```/i);

    if (fencedMatch?.[1]) {
      const parsed = JSON.parse(fencedMatch[1].trim());
      if (parsed?.kind === 'translation_workspace' && parsed.workspace) {
        return parsed;
      }
    }

    if (/^##\s+FR_(TITLE|TAGS|DESCRIPTION|ALT)\s*$/im.test(input)) {
      return parseLegacyListingMarkdownPack(input);
    }

    const parsed = JSON.parse(input);
    if (parsed?.kind !== 'translation_workspace' || !parsed.workspace) {
      throw new Error('Pack traduction invalide');
    }

    return parsed;
  };

  const setPromptMenuOpen = (prefix = 'tt', isOpen = false) => {
    const workspace = getWorkspace(prefix);
    if (!workspace) return;
    workspace.meta.promptMenuOpen = Boolean(isOpen);
    renderTranslationWorkspace(prefix);
  };

  const refreshSourceFromFinalOutputs = (prefix = 'tt') => {
    const runtime = getRuntime();
    runtime.captureTranslationSource?.(prefix, {
      aliasesOverride: getAliasesSnapshot(prefix),
    });
    const workspace = getWorkspace(prefix);
    if (workspace) workspace.meta.promptMenuOpen = false;
    renderTranslationWorkspace(prefix);
    global.showToast?.('Base FR rechargée ✓');
  };

  const renderTranslationWorkspace = (prefix = 'tt') => {
    const mount = getMount(prefix);
    if (!mount) return;

    const workspace = ensureWorkspaceSeeded(prefix);
    if (!workspace) return;

    const visibleLanguages = getVisibleLanguages(prefix);
    const isEmpty = !hasWorkspaceContent(workspace);

    syncLegacyResultVisibility(prefix, workspace, visibleLanguages);

    mount.innerHTML = `
      <div class="translation-workspace ${isEmpty ? 'is-empty' : ''}" data-prefix="${prefix}">
        ${buildToolbarMarkup(prefix, workspace, visibleLanguages)}
        ${buildAliasGridMarkup(workspace, visibleLanguages)}
        ${buildTabsMarkup(workspace, visibleLanguages)}
        ${buildEditorMarkup(workspace)}
        <input type="file" data-role="import-file" accept=".md,.txt,.json" hidden>
        ${isEmpty ? '<div class="translation-empty">Lance le pipeline puis utilise l\'onglet FR comme base avant traduction.</div>' : ''}
      </div>
    `;
  };

  const copyLanguageBlock = async (prefix = 'tt', language = 'fr') => {
    const workspace = getWorkspace(prefix);
    const result = workspace?.results?.[language] || {};
    const content = [
      `── TITRE (${language.toUpperCase()}) ──`,
      result.title || '',
      '',
      `── TAGS (${language.toUpperCase()}) ──`,
      result.tags || '',
      '',
      `── DESCRIPTION (${language.toUpperCase()}) ──`,
      result.description || '',
      '',
      `── ALT (${language.toUpperCase()}) ──`,
      result.alt || '',
    ].join('\n');

    await navigator.clipboard.writeText(content);
    global.showToast?.(`Bloc ${language.toUpperCase()} copié ✓`);
  };

  const copyField = async (prefix = 'tt', language = 'fr', field = 'title') => {
    const workspace = getWorkspace(prefix);
    const value = workspace?.results?.[language]?.[field] || '';
    await navigator.clipboard.writeText(String(value || ''));
    global.showToast?.(`${FIELD_LABELS[field] || field} ${language.toUpperCase()} copié ✓`);
  };

  const syncAliasOrResultInput = (target) => {
    const mount = target.closest('.translation-workspace');
    const prefix = mount?.dataset?.prefix;
    const workspace = getWorkspace(prefix);
    if (!workspace) return;

    const role = target.dataset.role;
    const language = String(target.dataset.language || '').trim().toLowerCase();
    const field = String(target.dataset.field || '').trim();
    const value = String(target.value || '').trim();

    if (role === 'alias-input') {
      workspace.aliases[language] = workspace.aliases[language] || { name: '', universe: '' };
      workspace.aliases[language][field] = value;
      if (language === 'fr') {
        workspace.source[field] = value;
      }
      return;
    }

    if (role === 'result-input') {
      workspace.results[language] = workspace.results[language] || { title: '', tags: '', description: '', alt: '', rawResponse: '' };
      workspace.results[language][field] = target.value;
      if (language === 'fr') {
        workspace.source[field] = target.value;
      }
    }
  };

  const setActiveLanguage = (prefix = 'tt', language = 'fr') => {
    const workspace = getWorkspace(prefix);
    if (!workspace) return;
    workspace.meta.activeLanguage = language;
    renderTranslationWorkspace(prefix);
  };

  const runAliasLookupFromWorkspace = async (prefix = 'tt') => {
    const runtime = getRuntime();
    const mode = getModeFromPrefix(prefix);
    const languages = runtime.getEnabledTranslationLanguages?.(mode) || [];

    if (!languages.length) {
      global.showToast?.('Active au moins une langue de traduction', '#ff4757');
      return;
    }

    await runtime.runAliasLookup?.(prefix, {
      languages,
      sourceOverride: getEditableSourceSnapshot(prefix),
      aliasesOverride: getAliasesSnapshot(prefix),
    });

    renderTranslationWorkspace(prefix);
    global.showToast?.('Alias remplis ✓');
  };

  const runTranslationFromWorkspace = async (prefix = 'tt') => {
    const runtime = getRuntime();
    const workspace = getWorkspace(prefix);
    const visibleLanguages = getVisibleLanguages(prefix);
    const activeLanguage = workspace?.meta?.activeLanguage || 'fr';
    const targetLanguage = activeLanguage !== 'fr'
      ? activeLanguage
      : visibleLanguages.find((language) => language !== 'fr');

    if (!targetLanguage) {
      global.showToast?.('Aucune langue traduite active', '#ff4757');
      return;
    }

    await runtime.runTranslation?.(prefix, targetLanguage, {
      sourceOverride: getEditableSourceSnapshot(prefix),
      aliasesOverride: getAliasesSnapshot(prefix),
    });

    workspace.meta.activeLanguage = targetLanguage;
    renderTranslationWorkspace(prefix);
    global.showToast?.(`Traduction ${targetLanguage.toUpperCase()} générée ✓`);
  };

  const exportWorkspacePack = (prefix = 'tt') => {
    const content = buildWorkspaceMarkdownPack(prefix);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getPrefixBaseName(prefix)}_translation_workspace_${getTimestampSlug()}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    global.showToast?.('Pack traduction exporté ✓');
  };

  const importWorkspacePack = async (prefix = 'tt', file) => {
    const text = await file.text();
    const parsed = parseWorkspaceMarkdownPack(text);
    const current = getWorkspace(prefix);
    if (!current) return;

    const importedWorkspace = parsed.workspace || {};
    current.source = { ...current.source, ...(importedWorkspace.source || {}) };
    current.meta = { ...current.meta, ...(importedWorkspace.meta || {}) };

    SUPPORTED_LANGUAGES.forEach((language) => {
      current.aliases[language] = {
        ...(current.aliases?.[language] || { name: '', universe: '' }),
        ...(importedWorkspace.aliases?.[language] || {}),
      };
      current.results[language] = {
        ...(current.results?.[language] || { title: '', tags: '', description: '', alt: '', rawResponse: '' }),
        ...(importedWorkspace.results?.[language] || {}),
      };
    });

    const visibleLanguages = getVisibleLanguages(prefix);
    if (!visibleLanguages.includes(current.meta.activeLanguage)) {
      current.meta.activeLanguage = visibleLanguages.includes('fr') ? 'fr' : visibleLanguages[0];
    }

    renderTranslationWorkspace(prefix);
    global.showToast?.('Pack traduction importé ✓');
  };

  const onWorkspaceClick = async (event) => {
    const button = event.target.closest('[data-role]');
    if (!button) return;
    const mount = button.closest('.translation-workspace');
    const prefix = mount?.dataset?.prefix;
    if (!prefix) return;

    const role = button.dataset.role;
    const workspace = getWorkspace(prefix);
    const shouldKeepPromptMenuOpen = ['prompt-menu-toggle', 'open-translate-prompt', 'open-alias-prompt', 'refresh-source'].includes(role);
    if (workspace && !shouldKeepPromptMenuOpen) {
      workspace.meta.promptMenuOpen = false;
    }

    try {
      if (role === 'tab') {
        setActiveLanguage(prefix, button.dataset.language);
        return;
      }

      if (role === 'lookup-alias') {
        await runAliasLookupFromWorkspace(prefix);
        return;
      }

      if (role === 'translate') {
        await runTranslationFromWorkspace(prefix);
        return;
      }

      if (role === 'prompt-menu-toggle') {
        setPromptMenuOpen(prefix, !workspace?.meta?.promptMenuOpen);
        return;
      }

      if (role === 'open-translate-prompt') {
        if (workspace) workspace.meta.promptMenuOpen = false;
        renderTranslationWorkspace(prefix);
        global.openPromptLightbox?.('translate_listing');
        return;
      }

      if (role === 'open-alias-prompt') {
        if (workspace) workspace.meta.promptMenuOpen = false;
        renderTranslationWorkspace(prefix);
        global.openPromptLightbox?.('alias_lookup');
        return;
      }

      if (role === 'refresh-source') {
        refreshSourceFromFinalOutputs(prefix);
        return;
      }

      if (role === 'export') {
        exportWorkspacePack(prefix);
        return;
      }

      if (role === 'import') {
        const input = mount.querySelector('[data-role="import-file"]');
        input?.click();
        return;
      }

      if (role === 'copy-field') {
        await copyField(prefix, button.dataset.language, button.dataset.field);
        return;
      }

      if (role === 'copy-all-language') {
        await copyLanguageBlock(prefix, button.dataset.language);
      }
    } catch (error) {
      global.showToast?.(`❌ ${error.message}`, '#ff4757', 4500);
    }
  };

  const onWorkspaceInput = (event) => {
    const target = event.target;
    if (!target?.dataset?.role) return;
    syncAliasOrResultInput(target);
  };

  const onWorkspaceChange = async (event) => {
    const target = event.target;
    if (target?.dataset?.role !== 'import-file') return;

    const mount = target.closest('.translation-workspace');
    const prefix = mount?.dataset?.prefix;
    const [file] = target.files || [];
    if (!file || !prefix) return;

    try {
      await importWorkspacePack(prefix, file);
    } catch (error) {
      global.showToast?.(`❌ ${error.message}`, '#ff4757', 4500);
    } finally {
      target.value = '';
    }
  };

  const bindWorkspaceMount = (prefix = 'tt') => {
    const mount = getMount(prefix);
    if (!mount || mount.dataset.bound === 'true') return;

    mount.dataset.bound = 'true';
    mount.addEventListener('click', onWorkspaceClick);
    mount.addEventListener('input', onWorkspaceInput);
    mount.addEventListener('change', onWorkspaceChange);
  };

  const mountTranslationWorkspace = (prefix = 'tt') => {
    bindWorkspaceMount(prefix);
    renderTranslationWorkspace(prefix);
  };

  const mountAllTranslationWorkspaces = () => {
    ['tt', 'col'].forEach((prefix) => mountTranslationWorkspace(prefix));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAllTranslationWorkspaces, { once: true });
  } else {
    mountAllTranslationWorkspaces();
  }

  global.PipelineUITranslationsWorkspace = {
    mountTranslationWorkspace,
    mountAllTranslationWorkspaces,
    renderTranslationWorkspace,
    exportWorkspacePack,
    importWorkspacePack,
    buildWorkspaceMarkdownPack,
    parseWorkspaceMarkdownPack,
    refreshSourceFromFinalOutputs,
  };

  global.PipelineUI.translationsWorkspace = global.PipelineUI.translationsWorkspace || {};
  Object.assign(global.PipelineUI.translationsWorkspace, global.PipelineUITranslationsWorkspace);
  Object.assign(global, global.PipelineUITranslationsWorkspace);
})(window);
