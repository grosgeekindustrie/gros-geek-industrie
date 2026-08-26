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
    description_final: 'description_final',
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

  function stripPromptArtifactLine(rawLine = '') {
    return String(rawLine || '')
      .trimEnd()
      .replace(/^\s*#{1,6}\s*/, '')
      .replace(/^\s*[-–—]{2,}\s*(.+?)\s*[-–—]{2,}\s*$/u, '$1');
  }

  function shouldKeepPromptArtifactLine(line = '', key = '') {
    const compact = String(line || '').trim();
    if (!compact) return true;
    if (/^(sortie finale|output final)\s*:?\s*$/iu.test(compact)) return false;
    if (/^[-–—_]{2,}\s*$/u.test(compact)) return false;
    if (key === 'description_final') return !/^(description)\s*:?\s*$/iu.test(compact);
    return !/^(titre|tags|description|balise alt|alt)\s*:?\s*$/iu.test(compact);
  }

  function sanitizeSharedFinalOutputText(key, text) {
    if (key === 'tags') return String(text || '');

    const normalized = String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ');

    if (!normalized) return '';

    const cleanedLines = normalized
      .split('\n')
      .map((line) => stripPromptArtifactLine(line))
      .filter((line) => shouldKeepPromptArtifactLine(line, key));

    if (key === 'description_final') {
      return cleanedLines.join('\n');
    }

    const joined = cleanedLines.join('\n').trim();
    if (!joined) return '';

    return joined.replace(/\n{3,}/g, '\n\n');
  }

  function formatTagsForDisplay(text) {
    const tags = sortTagValues(splitTagValues(text));
    return tags.map((tag, index) => `${tag}${index < tags.length - 1 ? ',' : ''}`).join('\n');
  }

  function formatFinalOutputText(key, text) {
    return key === 'tags'
      ? formatTagsForDisplay(text)
      : sanitizeSharedFinalOutputText(key, text);
  }

  function normalizeFinalOutputText(key, text) {
    if (key !== 'tags') return sanitizeSharedFinalOutputText(key, text);
    return sortTagValues(splitTagValues(text)).join(', ');
  }

  function getFinalOutputContentNode(node) {
    return node?.querySelector?.('.fs-content') || node;
  }

  function updateAltLengthMeta(prefix, text) {
    const metaNode = document.getElementById(`fc-alt-meta-${prefix}`);
    if (!metaNode) return;

    const length = String(text || '').length;
    metaNode.textContent = `${length} / 500`;
    metaNode.classList.toggle('fs-meta-ok', length <= 500);
    metaNode.classList.toggle('fs-meta-over', length > 500);
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

    if (key === 'alt') {
      updateAltLengthMeta(node?.dataset?.finalPrefix || global.pfx(), value);
    }

    global.persistPipelineSeedSnapshot?.(global.pfx?.());
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

  function resizeTextarea(node) {
    if (!node || node.tagName !== 'TEXTAREA' || node.dataset.noAutoresize === 'true') return;

    const previousScrollY = window.scrollY;
    const computedStyle = window.getComputedStyle(node);
    const minHeight = Number.parseFloat(computedStyle.minHeight || '0') || 0;

    node.style.height = 'auto';
    node.style.overflowY = 'hidden';
    node.style.height = `${Math.max(node.scrollHeight, minHeight)}px`;

    if (document.activeElement === node && window.scrollY !== previousScrollY) {
      window.scrollTo({ top: previousScrollY });
    }
  }

  function resizeAllTextareas(root = document) {
    const host = root && typeof root.querySelectorAll === 'function' ? root : document;
    host.querySelectorAll('textarea').forEach((node) => resizeTextarea(node));
  }

  function bindTextareaAutoResize() {
    if (global.__pipelineTextareaAutoResizeBound) return;
    global.__pipelineTextareaAutoResizeBound = true;

    const init = () => resizeAllTextareas(document);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }

    document.addEventListener('input', (event) => {
      const textarea = event.target?.closest?.('textarea');
      if (!textarea) return;
      resizeTextarea(textarea);
    });

    document.addEventListener('focusin', (event) => {
      const textarea = event.target?.closest?.('textarea');
      if (!textarea) return;
      resizeTextarea(textarea);
    });

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.tagName === 'TEXTAREA') {
            resizeTextarea(node);
            return;
          }
          resizeAllTextareas(node);
        });
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
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
      description_final: `fc-description-${p}`,
      alt: `fc-alt-${p}`,
    };
    const sectionIdMap = {
      tags: `fs-tags-${p}`,
      titre_valide: `fs-titre-${p}`,
      description_final: `fs-description-${p}`,
      alt: `fs-alt-${p}`,
    };

    const contentNode = document.getElementById(contentIdMap[key] || '');
    if (contentNode) setNodeText(contentNode, formatFinalOutputText(key, text));

    if (key === 'alt') updateAltLengthMeta(p, text);

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
  bindTextareaAutoResize();

  global.PipelineUIRender = {
    syncSelectionField,
    syncFinalPre,
    syncTagsOutputFromUI,
    formatFinalOutputText,
    sanitizeFinalOutputText: sanitizeSharedFinalOutputText,
    updateAltLengthMeta,
    resizeTextarea,
    resizeAllTextareas,
  };

  global.PipelineUI.render = global.PipelineUI.render || {};
  Object.assign(global.PipelineUI.render, global.PipelineUIRender);
})(window);
