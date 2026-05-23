'use strict';

(function initPipelineUIDescriptionAssemblyRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};
  const templates = global.PipelineUIDataDescriptionTemplates || {};

  const TOP_LEVEL_BLOCK_SEPARATOR = '\n\n\n\n';

  function splitScaleValues(rawValue) {
    return String(rawValue || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function formatScaleSummary(rawValue) {
    const values = splitScaleValues(rawValue);
    if (!values.length) return '';
    if (values.length === 1) return values[0];
    return `de ${values[0]} à ${values[values.length - 1]}`;
  }

  function buildWhatYouReceiveBlock(ctx = {}) {
    const baseLines = Array.isArray(templates.WHAT_YOU_RECEIVE_LINES) ? [...templates.WHAT_YOU_RECEIVE_LINES] : [];
    const scaleSummary = formatScaleSummary(ctx.echelles);
    baseLines.push(`• Echelle : ${scaleSummary || 'voir details'}${scaleSummary ? ' (dimensions ci-dessous)' : ''}`);
    return baseLines.join('\n');
  }

  function joinTopLevelBlocks(blocks = []) {
    return blocks
      .map((block) => String(block || '').trim())
      .filter(Boolean)
      .join(TOP_LEVEL_BLOCK_SEPARATOR)
      .replace(/\n{5,}/g, TOP_LEVEL_BLOCK_SEPARATOR)
      .trim();
  }

  function buildDescriptionAssemblyContext(prefix) {
    const currentPrefix = typeof global.pfx === 'function' ? global.pfx() : '';
    if (currentPrefix === prefix && typeof global.buildCtx === 'function') {
      return global.buildCtx('description') || {};
    }
    return {};
  }

  function stripLeadingDescriptionHeading(rawValue) {
    const lines = String(rawValue || '')
      .replace(/\r\n/g, '\n')
      .split('\n');

    if (!lines.length) return '';

    const firstLine = String(lines[0] || '').trim();
    const isMarkdownHeading = /^#\s*/.test(firstLine);
    const looksLikeDescriptionHeading = /description\s+produit/i.test(firstLine);
    if (!isMarkdownHeading || !looksLikeDescriptionHeading) {
      return lines.join('\n').trim();
    }

    const remaining = lines.slice(1).join('\n').replace(/^\s+/, '');
    return remaining.trim();
  }

  function buildFinalPipelineDescription(prefix, dynamicDescription) {
    const rawDynamicDescription = stripLeadingDescriptionHeading(dynamicDescription);
    if (!rawDynamicDescription) return '';

    const ctx = buildDescriptionAssemblyContext(prefix);
    const fixedClientBlocks = Array.isArray(templates.CLIENT_INFORMATION_BLOCKS)
      ? templates.CLIENT_INFORMATION_BLOCKS
      : [];

    return joinTopLevelBlocks([
      buildWhatYouReceiveBlock(ctx),
      rawDynamicDescription,
      String(templates.EXPERIENCE_BLOCK || '').trim(),
      ...fixedClientBlocks,
    ]);
  }

  global.PipelineUIDescriptionAssembly = {
    formatScaleSummary,
    buildWhatYouReceiveBlock,
    joinTopLevelBlocks,
    buildDescriptionAssemblyContext,
    stripLeadingDescriptionHeading,
    buildFinalPipelineDescription,
  };

  global.PipelineUI.runtime = global.PipelineUI.runtime || {};
  Object.assign(global.PipelineUI.runtime, global.PipelineUIDescriptionAssembly);
  Object.assign(global, global.PipelineUIDescriptionAssembly);
})(window);
