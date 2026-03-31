(function initPipelineUIHelpers(global) {
  global.PipelineUI = global.PipelineUI || {};
  function normalizeTagValue(tag) {
    return String(tag || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeTitreValue(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function sameTag(a, b) {
    return normalizeTagValue(a).toLowerCase() === normalizeTagValue(b).toLowerCase();
  }

  function sameTitre(a, b) {
    return normalizeTitreValue(a).toLowerCase() === normalizeTitreValue(b).toLowerCase();
  }

  function parseBulkLibraryEntries(raw) {
    return Array.from(new Set(
      String(raw || '')
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean)
    ));
  }

  function extractLastNumberedBlock(raw) {
    const lines = String(raw || '').split('\n');
    const blocks = [];
    let current = [];

    for (const originalLine of lines) {
      const line = originalLine.trim();
      if (!line) {
        if (current.length) {
          blocks.push(current);
          current = [];
        }
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        current.push(line);
        continue;
      }

      if (current.length) {
        blocks.push(current);
        current = [];
      }
    }

    if (current.length) blocks.push(current);
    return blocks.length ? blocks[blocks.length - 1] : null;
  }

  function parseTagOutput(raw) {
    if (!raw) return [];

    const lastNumberedBlock = extractLastNumberedBlock(raw);
    const sourceLines = lastNumberedBlock || String(raw || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const cleaned = sourceLines
      .flatMap((line) => {
        if (line.includes(',') && !/^\d+\.\s/.test(line)) {
          return line.split(',').map((value) => value.trim()).filter(Boolean);
        }
        return [line];
      })
      .map((line) => line.replace(/^\d+\.\s*/, ''))
      .map((line) => line.replace(/^[-•+]\s*/, ''))
      .map((line) => line.trim())
      .filter(Boolean);

    const seen = new Set();
    const out = [];
    for (const tag of cleaned) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
    return out;
  }

  function formatTagsNumbered(tags) {
    return tags.map((tag, index) => `${index + 1}. ${tag}`).join('\n');
  }

  function getBlacklistedTerm(text, blacklist) {
    const lc = String(text || '').toLowerCase();
    return (blacklist || []).find((term) => term && lc.includes(String(term).toLowerCase())) || null;
  }

  function escapeForInlineSingleQuote(text) {
    return String(text || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  global.PipelineUIHelpers = {
    normalizeTagValue,
    normalizeTitreValue,
    sameTag,
    sameTitre,
    parseBulkLibraryEntries,
    extractLastNumberedBlock,
    parseTagOutput,
    formatTagsNumbered,
    getBlacklistedTerm,
    escapeForInlineSingleQuote,
  };

  global.PipelineUI.helpers = global.PipelineUI.helpers || {};
  Object.assign(global.PipelineUI.helpers, global.PipelineUIHelpers);
})(window);
