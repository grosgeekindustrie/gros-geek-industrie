'use strict';

(function initPipelineUIDescriptionAssemblyRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};
  const templates = global.PipelineUIDataDescriptionTemplates || {};

  const TOP_LEVEL_BLOCK_SEPARATOR = '\n\n\n\n';
  const PREFIX_TO_FAMILY = Object.freeze({
    col: 'collection',
    tt: 'tabletop',
  });

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

  function normalizeTopLevelBlockText(rawValue) {
    return String(rawValue || '')
      .replace(/\r\n/g, '\n')
      .trim()
      .replace(/\n{3,}/g, TOP_LEVEL_BLOCK_SEPARATOR)
      .trim();
  }

  function resolveDescriptionFamilyFromPrefix(prefix = '') {
    return PREFIX_TO_FAMILY[String(prefix || '').trim()] || 'collection';
  }

  function getFixedBlocksForFamilyAndLanguage(family = '', language = 'fr') {
    const families = templates.FIXED_BLOCKS_BY_FAMILY_AND_LANGUAGE || {};
    return Array.isArray(families?.[family]?.[language]) ? families[family][language] : [];
  }

  function stripTrailingFixedBlocks(rawValue, family = '', language = 'fr') {
    const normalized = normalizeTopLevelBlockText(rawValue);
    const fixedBlocks = getFixedBlocksForFamilyAndLanguage(family, language);
    if (!normalized || !fixedBlocks.length) {
      return {
        description: normalized,
        stripped: false,
        family,
        language,
      };
    }

    const fixedJoined = joinTopLevelBlocks(fixedBlocks);
    if (!fixedJoined) {
      return {
        description: normalized,
        stripped: false,
        family,
        language,
      };
    }

    if (normalized === fixedJoined) {
      return {
        description: '',
        stripped: true,
        family,
        language,
      };
    }

    const suffix = `${TOP_LEVEL_BLOCK_SEPARATOR}${fixedJoined}`;
    if (normalized.endsWith(suffix)) {
      return {
        description: normalized.slice(0, -suffix.length).trim(),
        stripped: true,
        family,
        language,
      };
    }

    return {
      description: normalized,
      stripped: false,
      family,
      language,
    };
  }

  function buildTranslatedDescriptionWithFixedBlocks(dynamicDescription, family = '', language = '') {
    const dynamicOnly = stripTrailingFixedBlocks(dynamicDescription, family, language).description;
    const fixedBlocks = getFixedBlocksForFamilyAndLanguage(family, language);
    if (!fixedBlocks.length) return dynamicOnly;
    return joinTopLevelBlocks([dynamicOnly, ...fixedBlocks]);
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
    normalizeTopLevelBlockText,
    resolveDescriptionFamilyFromPrefix,
    getFixedBlocksForFamilyAndLanguage,
    stripTrailingFixedBlocks,
    buildTranslatedDescriptionWithFixedBlocks,
    buildDescriptionAssemblyContext,
    stripLeadingDescriptionHeading,
    buildFinalPipelineDescription,
  };

  global.PipelineUI.runtime = global.PipelineUI.runtime || {};
  Object.assign(global.PipelineUI.runtime, global.PipelineUIDescriptionAssembly);
  Object.assign(global, global.PipelineUIDescriptionAssembly);
})(window);
