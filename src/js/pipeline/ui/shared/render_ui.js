(function initPipelineUIRender(global) {

// Helpers de synchronisation UI.
// Ce module recopie les valeurs sélectionnées vers les sorties visibles sans porter la
// logique métier complète. Il sert de colle légère entre état runtime et DOM final.
  global.PipelineUI = global.PipelineUI || {};
  const dom = global.PipelineUIDom || {};
  let lastTagsDuplicateSignature = '';

  const FINAL_OUTPUT_STATE_KEYS = {
    tags: 'tags',
    titre_valide: 'titre_valide',
    description_assembled: 'description_assembled',
    alt: 'alt',
  };

  function getRuntimeState() {
    return global.state || (typeof state !== 'undefined' ? state : null);
  }

  function splitTagValues(text) {
    return String(text || '')
      .split(/[\n,]+/)
      .map((tag) => (global.PipelineUIHelpers?.normalizeTagValue ? global.PipelineUIHelpers.normalizeTagValue(tag) : String(tag || '').trim()))
      .filter(Boolean);
  }

  function sortTagValues(tags = []) {
    return [...tags].sort((left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' }));
  }

  function formatTagsForDisplay(text) {
    const tags = sortTagValues(splitTagValues(text));
    return tags.map((tag, index) => `${tag}${index < tags.length - 1 ? ',' : ''}`).join('\n');
  }

  function formatFinalOutputText(key, text) {
    return key === 'tags' ? formatTagsForDisplay(text) : String(text || '');
  }

  function normalizeFinalOutputText(key, text) {
    if (key !== 'tags') return String(text || '').trim();
    return sortTagValues(splitTagValues(text)).join(', ');
  }

  function getFinalOutputContentNode(node) {
    return node?.querySelector?.('.fs-content') || node;
  }

  function readFinalOutputText(node) {
    return getFinalOutputContentNode(node)?.textContent || '';
  }

  function syncFinalOutputEdit(node) {
    const key = node?.dataset?.finalKey || '';
    const stateKey = FINAL_OUTPUT_STATE_KEYS[key];
    const runtimeState = getRuntimeState();
    if (!stateKey || !runtimeState?.outputs) return;

    const value = normalizeFinalOutputText(key, readFinalOutputText(node));
    runtimeState.outputs[stateKey] = value;

    if (key === 'tags') {
      runtimeState.selectedTags = splitTagValues(value);
    }
  }

  function formatEditableFinalOutput(node) {
    const key = node?.dataset?.finalKey || '';
    if (key !== 'tags') return;

    const contentNode = getFinalOutputContentNode(node);
    const formatted = formatTagsForDisplay(readFinalOutputText(node));
    if (contentNode && contentNode.textContent !== formatted) contentNode.textContent = formatted;
  }

  function bindFinalOutputEditing() {
    if (global.__pipelineFinalOutputEditingBound) return;
    global.__pipelineFinalOutputEditingBound = true;

    document.addEventListener('input', (event) => {
      const node = event.target.closest?.('.final-editable-output[data-final-key]');
      if (!node) return;
      syncFinalOutputEdit(node);
    });

    document.addEventListener('blur', (event) => {
      const node = event.target.closest?.('.final-editable-output[data-final-key]');
      if (!node) return;
      syncFinalOutputEdit(node);
      formatEditableFinalOutput(node);
    }, true);
  }

  function setNodeText(node, text) {
    if (!node) return;
    if ('value' in node) node.value = text;
    else node.textContent = text;
  }

  function syncSelectionField(agentId, text, modePrefix) {
    const p = modePrefix || global.pfx();
    const selectionZone = dom.getAllByData?.('selectionZone', 'titre', document)
      ?.find((node) => node.dataset.prefix === p && node.dataset.agentId === agentId)
      || document.getElementById(`${p}-sel-${agentId}`);
    const directIds = [
      `${p}-out-${agentId}`,
      `${p}-raw-${agentId}`,
      `${p}-selected-${agentId}`,
      `${p}-selection-${agentId}`,
    ];

    for (const id of directIds) {
      const node = document.getElementById(id);
      if (node) {
        setNodeText(node, text);
        return node;
      }
    }

    const zone = selectionZone;
    if (!zone) return null;

    const candidate = zone.querySelector(
      '.selection-output, .sel-output, .agent-output, textarea, pre, input[type="text"]'
    );
    if (candidate) setNodeText(candidate, text);
    return candidate || null;
  }

  function syncFinalPre(key, text, modePrefix) {
    const p = modePrefix || global.pfx();
    const contentIdMap = {
      tags: `fc-tags-${p}`,
      titre_valide: `fc-titre-${p}`,
      description_assembled: `fc-description-${p}`,
      alt: `fc-alt-${p}`,
    };
    const sectionIdMap = {
      tags: `fs-tags-${p}`,
      titre_valide: `fs-titre-${p}`,
      description_assembled: `fs-description-${p}`,
      alt: `fs-alt-${p}`,
    };

    const contentNode = document.getElementById(contentIdMap[key] || '');
    if (contentNode) setNodeText(contentNode, formatFinalOutputText(key, text));

    const sectionNode = document.getElementById(sectionIdMap[key] || '');
    if (sectionNode) sectionNode.style.display = text ? '' : 'none';

    const finalOutput = document.getElementById(`finalOutput-${p}`);
    if (finalOutput && text) finalOutput.style.display = '';
    if (p === 'tt' && text) global.refreshDndSoloTabs?.();
    if (p === 'col' && text) global.refreshCollectionSoloTabs?.();
  }

  function collectTagsFromSelection(modePrefix) {
    const p = modePrefix || global.pfx();
    const selectionZone = dom.getAllByData?.('selectionZone', 'tags', document)
      ?.find((node) => node.dataset.prefix === p)
      || document.getElementById(`${p}-sel-tags`);
    const tagRows = dom.getAllByData?.('tagsItem', null, selectionZone) || [];

    if (tagRows.length) {
      return sortTagValues(tagRows
        .filter((row) => dom.getByData?.('tagsCheckbox', null, row)?.checked)
        .map((row) => dom.getByData?.('tagsInput', null, row)?.value || '')
        .map((tag) => (global.PipelineUIHelpers?.normalizeTagValue ? global.PipelineUIHelpers.normalizeTagValue(tag) : String(tag || '').trim()))
        .filter(Boolean));
    }

    const selectors = [
      `#${p}-sel-tags .titre-item .titre-text`,
      `#${p}-sel-tags .titre-text`,
      `#${p}-sel-list-tags .titre-item .titre-text`,
      `#${p}-sel-list-tags .titre-text`,
    ];

    for (const selector of selectors) {
      const nodes = [...document.querySelectorAll(selector)]
        .map((node) => node.textContent.trim())
        .filter(Boolean);
      if (nodes.length) return sortTagValues(nodes);
    }
    return [];
  }

  function syncTagsOutputFromUI() {
    const helpers = global.PipelineUIHelpers || {};
    const p = global.pfx();
    const selectionZone = dom.getAllByData?.('selectionZone', 'tags', document)
      ?.find((node) => node.dataset.prefix === p)
      || document.getElementById(`${p}-sel-tags`);
    const tags = collectTagsFromSelection(p)
      .map((tag) => (helpers.normalizeTagValue ? helpers.normalizeTagValue(tag) : String(tag || '').trim()))
      .filter(Boolean);

    const seen = new Set();
    const duplicateCount = tags.reduce((count, tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return count + 1;
      seen.add(key);
      return count;
    }, 0);

    const normalized = tags.join(', ');
    const runtimeState = getRuntimeState();
    if (runtimeState?.outputs) {
      runtimeState.outputs.tags = normalized;
    }

    const previewNode = dom.getByData?.('tagsPreview', null, selectionZone) || document.getElementById(`${p}-tags-final-output`);
    if (previewNode) {
      previewNode.textContent = normalized ? formatTagsForDisplay(normalized) : '— aucun tag sélectionné —';
    }

    syncFinalPre('tags', normalized, p);

    if (duplicateCount > 0) {
      const signature = `${p}:${normalized}`;
      if (lastTagsDuplicateSignature !== signature) {
        lastTagsDuplicateSignature = signature;
        global.showToast?.(`${duplicateCount} doublon(s) tag détecté(s) dans la sélection`, '#ff4757', 5000);
      }
    } else {
      lastTagsDuplicateSignature = '';
    }

    return normalized;
  }

  bindFinalOutputEditing();

  global.PipelineUIRender = {
    syncSelectionField,
    syncFinalPre,
    syncTagsOutputFromUI,
    formatFinalOutputText,
  };

  global.PipelineUI.render = global.PipelineUI.render || {};
  Object.assign(global.PipelineUI.render, global.PipelineUIRender);
})(window);
