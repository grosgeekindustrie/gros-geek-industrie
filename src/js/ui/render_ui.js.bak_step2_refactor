(function initPipelineUIRender(global) {
  function setNodeText(node, text) {
    if (!node) return;
    if ('value' in node) node.value = text;
    else node.textContent = text;
  }

  function syncSelectionField(agentId, text, modePrefix) {
    const p = modePrefix || (typeof global.pfx === 'function' ? global.pfx() : 'col');
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

    const zone = document.getElementById(`${p}-sel-${agentId}`);
    if (!zone) return null;

    const candidate = zone.querySelector(
      '.selection-output, .sel-output, .agent-output, textarea, pre, input[type="text"]'
    );
    if (candidate) setNodeText(candidate, text);
    return candidate || null;
  }

  function syncFinalPre(key, text, modePrefix) {
    const p = modePrefix || (typeof global.pfx === 'function' ? global.pfx() : 'col');
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
    if (contentNode) contentNode.textContent = text;

    const sectionNode = document.getElementById(sectionIdMap[key] || '');
    if (sectionNode) sectionNode.style.display = text ? '' : 'none';

    const finalOutput = document.getElementById(`finalOutput-${p}`);
    if (finalOutput && text) finalOutput.style.display = '';
  }

  function collectTagsFromSelection(modePrefix) {
    const p = modePrefix || (typeof global.pfx === 'function' ? global.pfx() : 'col');
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
      if (nodes.length) return nodes;
    }
    return [];
  }

  function syncTagsOutputFromUI() {
    const helpers = global.PipelineUIHelpers || {};
    const p = typeof global.pfx === 'function' ? global.pfx() : 'col';
    const tags = collectTagsFromSelection(p)
      .map((tag) => (helpers.normalizeTagValue ? helpers.normalizeTagValue(tag) : String(tag || '').trim()))
      .filter(Boolean);

    if (!tags.length) return '';

    const deduped = [];
    const seen = new Set();
    for (const tag of tags) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(tag);
    }

    const normalized = helpers.formatTagsNumbered
      ? helpers.formatTagsNumbered(deduped)
      : deduped.map((tag, index) => `${index + 1}. ${tag}`).join('\n');

    if (global.state?.outputs) {
      global.state.outputs.tags = normalized;
    }

    syncSelectionField('tags', normalized, p);
    syncFinalPre('tags', normalized, p);
    return normalized;
  }

  global.PipelineUIRender = {
    syncSelectionField,
    syncFinalPre,
    syncTagsOutputFromUI,
  };

  global.PipelineUI.render = global.PipelineUI.render || {};
  Object.assign(global.PipelineUI.render, global.PipelineUIRender);
})(window);
