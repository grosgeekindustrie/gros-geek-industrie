'use strict';

(function initPipelineUIOutputRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};

  const COPY_ALL_OUTPUTS_DIVIDER = '='.repeat(50);
  const COPY_ALL_OUTPUTS_EMPTY_MESSAGE = 'Aucun output a copier';
  const COPY_ALL_OUTPUTS_SUCCESS = (count) => `Review globale copiee - ${count} blocs`;
  const SOLO_EXPORT_FALLBACK_NAME_BY_PREFIX = Object.freeze({
    tt: 'tabletop',
    col: 'collection',
  });
  const SOLO_EXPORT_FALLBACK_AUTHOR = 'unknown_sculptor';
  const getFinalDescriptionOutput = () => global.state.outputs.description_assembled || '';

  function getOutputText(prefix, agentId) {
    const outputNode = document.getElementById(`${prefix}-out-${agentId}`);
    return outputNode?.textContent || global.state.outputs[agentId] || '';
  }

  function getCopyAllOutputAgents(prefix) {
    return prefix === 'col'
      ? [
          { id: 'tags', label: '01 - TAGS' },
          { id: 'titre', label: '02 - TITRES' },
          { id: 'description', label: '03 - DESCRIPTION' },
          { id: 'alt', label: '04 - BALISE ALT' },
        ]
      : [
          { id: 'marche', label: '01 - ANALYSE MARCHE' },
          { id: 'tags', label: '02 - TAGS' },
          { id: 'titre', label: '03 - TITRES' },
          { id: 'description', label: '04 - DESCRIPTION' },
          { id: 'alt', label: '05 - BALISE ALT' },
        ];
  }

  function setFinalSectionContent(sectionId, contentId, content, key = '') {
    if (!content) return;

    const sectionNode = document.getElementById(sectionId);
    if (sectionNode) sectionNode.style.display = 'block';

    const contentNode = document.getElementById(contentId);
    if (!contentNode) return;

    contentNode.textContent = global.PipelineUIRender.formatFinalOutputText(key, content);
  }

  function refreshFinalOutputTabs(prefix) {
    if (prefix === 'tt') {
      global.refreshDndSoloTabs();
      if (!global.isPipelineExecutionActive()) global.activateDndSoloTab('result', { force: true });
    }

    if (prefix === 'col') {
      global.refreshCollectionSoloTabs();
      if (!global.isPipelineExecutionActive()) global.activateCollectionSoloTab('result', { force: true });
    }
  }

  function revealFinalOutput(prefix) {
    const finalOutput = document.getElementById(`finalOutput-${prefix}`);
    if (finalOutput) {
      finalOutput.style.display = 'flex';
      finalOutput.style.flexDirection = 'column';
    }
  }

  function resetFinalOutputPanels(prefix) {
    const finalOutput = document.getElementById(`finalOutput-${prefix}`);
    if (finalOutput) finalOutput.style.display = 'none';

    [`fs-titre-${prefix}`, `fs-tags-${prefix}`, `fs-description-${prefix}`, `fs-alt-${prefix}`].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.style.display = 'none';
    });
  }

  function moveFinalOutputPanelToPipelineBody(prefix, pipelineBody) {
    if (!pipelineBody) return;
    const finalOutput = document.getElementById(`finalOutput-${prefix}`);
    if (finalOutput) pipelineBody.appendChild(finalOutput);
  }

  function assembleFinal() {
    const prefix = global.pfx();
    const titre = global.state.outputs.titre_valide || '';
    const tags = global.state.outputs.tags || '';
    const desc = getFinalDescriptionOutput();
    const alt = global.state.outputs.alt || '';

    if (!titre && !tags && !desc && !alt) return;

    setFinalSectionContent(`fs-titre-${prefix}`, `fc-titre-${prefix}`, titre, 'titre_valide');
    setFinalSectionContent(`fs-tags-${prefix}`, `fc-tags-${prefix}`, tags, 'tags');
    setFinalSectionContent(`fs-description-${prefix}`, `fc-description-${prefix}`, desc, 'description_assembled');
    setFinalSectionContent(`fs-alt-${prefix}`, `fc-alt-${prefix}`, alt, 'alt');

    revealFinalOutput(prefix);
    if (alt) global.showSocialEntryPanel(prefix);
    refreshFinalOutputTabs(prefix);
  }

  function copyOut(agentId) {
    const prefix = global.pfx();
    navigator.clipboard.writeText(getOutputText(prefix, agentId));
    global.showToast('Copie OK');
  }

  function copyAllOutputs() {
    const prefix = global.pfx();
    const parts = getCopyAllOutputAgents(prefix)
      .map((agent) => {
        const output = global.state.outputs[agent.id] || '';
        return output
          ? `${COPY_ALL_OUTPUTS_DIVIDER}\n${agent.label}\n${COPY_ALL_OUTPUTS_DIVIDER}\n${output}`
          : null;
      })
      .filter(Boolean);

    if (!parts.length) {
      global.showToast(COPY_ALL_OUTPUTS_EMPTY_MESSAGE, '#ff4757');
      return;
    }

    navigator.clipboard.writeText(parts.join('\n\n'));
    global.showToast(COPY_ALL_OUTPUTS_SUCCESS(parts.length));
  }

  function copySection(key) {
    navigator.clipboard.writeText(global.state.outputs[key] || '');
    global.showToast('Copié ✓');
  }

  function buildFinalOutputExport(prefixOverride) {
    const prefix = prefixOverride || global.pfx();
    const titre = global.state.outputs.titre_valide || '';
    const tags = global.state.outputs.tags || '';
    const desc = getFinalDescriptionOutput();
    const alt = global.state.outputs.alt || '';
    const parts = [];

    if (titre) parts.push(`── TITRE ──\n${titre}`);
    if (tags) parts.push(`── TAGS ──\n${tags}`);
    if (desc) parts.push(`── DESCRIPTION ──\n${desc}`);
    if (alt) parts.push(`── BALISE ALT ──\n${alt}`);

    return {
      prefix,
      content: parts.join('\n\n'),
    };
  }

  function getSoloExportMeta(prefixOverride) {
    const prefix = prefixOverride || global.pfx();
    const nomCourt = document.getElementById(`${prefix}-fNomCourt`)?.value?.trim() || '';
    const nomComplet = document.getElementById(`${prefix}-fNom`)?.value?.trim() || '';
    const sculpteur = document.getElementById(`${prefix}-fSculpteur`)?.value?.trim() || '';
    const fallbackNom = SOLO_EXPORT_FALLBACK_NAME_BY_PREFIX[prefix] || 'pipeline';
    const rawNom = nomCourt || nomComplet || global.state.outputs.titre_valide || fallbackNom;
    const rawSculpteur = sculpteur || SOLO_EXPORT_FALLBACK_AUTHOR;
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const dateFR = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`;
    const heureFR = `${pad(now.getHours())}${pad(now.getMinutes())}`;
    const sanitizeSegment = (value, fallback) => {
      const sanitized = String(value || fallback).replace(/[^\w-]/g, '_');
      return sanitized || fallback;
    };
    const nom = sanitizeSegment(rawNom, fallbackNom);
    const auteur = sanitizeSegment(rawSculpteur, SOLO_EXPORT_FALLBACK_AUTHOR);
    const folder = prefix === 'tt' ? 'export/solo/dnd/' : 'export/solo/collection/';

    return {
      prefix,
      folder,
      base: `${nom}_${auteur}_${dateFR}_${heureFR}`,
    };
  }

  function getSoloFinalOutputAgentLabels(prefixOverride) {
    const prefix = prefixOverride || global.pfx();

    if (prefix === 'tt') {
      return {
        titre: '01 Maya — Titres',
        titre_valide: '01b Titre validé',
        tags: '02 Karim — Tags',
        marche: '03 Sophie — Analyse marché',
        description: '04 Claire — Description brute',
        description_assembled: '04b Description assemblée',
        alt: '05 Nadia — Balise ALT finale',
      };
    }

    return {
      titre: '01 Nova — Titres',
      titre_valide: '01b Titre validé',
      tags: '02 Axel — Tags',
      description: '03 Eden — Description brute',
      description_assembled: '03b Description assemblée',
      alt: '04 Jules — Balise ALT finale',
      iris: 'Hors pipeline — Iris sémantique',
    };
  }

  function buildSoloFinalOutputFiles(prefixOverride) {
    const exportMeta = getSoloExportMeta(prefixOverride);
    const completeParts = [
      '# Output final',
      '',
      '## Titre',
      global.state.outputs.titre_valide || '',
      '',
      '## Tags',
      global.state.outputs.tags || '',
      '',
      '## Description',
      getFinalDescriptionOutput(),
      '',
      '## Balise ALT',
      global.state.outputs.alt || '',
    ];
    const rawParts = ['# Output final — RAW', ''];

    Object.entries(getSoloFinalOutputAgentLabels(exportMeta.prefix)).forEach(([key, label]) => {
      const value = global.state.outputs[key];
      if (!value) return;
      rawParts.push(`## ${label}\n${value}\n`);
    });

    return {
      ...exportMeta,
      files: [
        {
          filename: `${exportMeta.folder}${exportMeta.base}_complete.md`,
          content: completeParts.join('\n'),
        },
        {
          filename: `${exportMeta.folder}${exportMeta.base}_raw.md`,
          content: rawParts.join('\n'),
        },
      ],
    };
  }

  async function exportFinalOutputs(prefixOverride) {
    const { folder, files } = buildSoloFinalOutputFiles(prefixOverride);
    const hasContent = files.some((file) => file.content.replace(/[#\s]/g, '').trim());

    if (!hasContent) {
      global.showToast('Aucun output final à exporter', '#ff4757');
      return;
    }

    try {
      const response = await fetch('/solo/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      global.showToast(`✅ Exporté dans ${folder} — ${data.count} fichier(s)`, '#4caf7d', 5000);
    } catch (error) {
      global.showToast(`Erreur export: ${error.message}`, '#ff4757', 5000);
    }
  }

  function copyAll() {
    const { content } = buildFinalOutputExport();
    if (!content) {
      global.showToast('Aucun output final à copier', '#ff4757');
      return;
    }

    navigator.clipboard.writeText(content);
    global.showToast('Tout copié ✓');
  }

  global.PipelineUIOutputRuntime = {
    getOutputText,
    getCopyAllOutputAgents,
    setFinalSectionContent,
    refreshFinalOutputTabs,
    revealFinalOutput,
    resetFinalOutputPanels,
    moveFinalOutputPanelToPipelineBody,
    assembleFinal,
    copyOut,
    copyAllOutputs,
    copySection,
    exportFinalOutputs,
    copyAll,
  };

  global.PipelineUI.runtimeOutput = global.PipelineUI.runtimeOutput || {};
  Object.assign(global.PipelineUI.runtimeOutput, global.PipelineUIOutputRuntime);
  Object.assign(global, global.PipelineUIOutputRuntime);
})(window);
