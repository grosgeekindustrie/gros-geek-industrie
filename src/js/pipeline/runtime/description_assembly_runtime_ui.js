'use strict';

(function initPipelineUIDescriptionAssemblyRuntime(global) {
  global.PipelineUI = global.PipelineUI || {};
  const templates = global.PipelineUIDataDescriptionTemplates || {};

  const TOP_LEVEL_BLOCK_SEPARATOR = '\n\n\n\n';
  const PREFIX_TO_FAMILY = Object.freeze({
    col: 'collection',
    tt: 'tabletop',
  });

  function getActiveShopKey() {
    return global.PipelineUIForms?.getActiveShopKey?.() || 'grosgeek';
  }

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

  function normalizeDescriptionLineEndings(rawValue) {
    return String(rawValue || '').replace(/\r\n?/g, '\n');
  }

  function stripOuterBlankLines(rawValue) {
    return normalizeDescriptionLineEndings(rawValue)
      .replace(/^(?:[ \t]*\n)+/g, '')
      .replace(/(?:\n[ \t]*)+$/g, '');
  }

  function joinTopLevelBlocks(blocks = []) {
    return blocks
      .map((block) => stripOuterBlankLines(block))
      .filter(Boolean)
      .join(TOP_LEVEL_BLOCK_SEPARATOR);
  }

  function normalizeTopLevelBlockText(rawValue) {
    return stripOuterBlankLines(rawValue);
  }

  function resolveDescriptionFamilyFromPrefix(prefix = '') {
    const baseFamily = PREFIX_TO_FAMILY[String(prefix || '').trim()] || 'collection';
    if (getActiveShopKey() === 'doublex') {
      if (baseFamily === 'collection') return 'collection_doublex';
      if (baseFamily === 'tabletop') return 'tabletop_doublex';
    }
    return baseFamily;
  }

  function getFixedBlocksForFamilyAndLanguage(family = '', language = 'fr') {
    const families = templates.FIXED_BLOCKS_BY_FAMILY_AND_LANGUAGE || {};
    return Array.isArray(families?.[family]?.[language]) ? families[family][language] : [];
  }

  function getIntroBlocksForFamilyAndLanguage(family = '', language = 'fr') {
    const families = templates.INTRO_FIXED_BLOCKS_BY_FAMILY_AND_LANGUAGE || {};
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
        description: stripOuterBlankLines(normalized.slice(0, -suffix.length)),
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

  function stripLeadingFixedBlocks(rawValue, family = '', language = 'fr') {
    const normalized = normalizeTopLevelBlockText(rawValue);
    const introBlocks = getIntroBlocksForFamilyAndLanguage(family, language);
    if (!normalized || !introBlocks.length) {
      return {
        description: normalized,
        stripped: false,
        family,
        language,
      };
    }

    const introJoined = joinTopLevelBlocks(introBlocks);
    if (!introJoined) {
      return {
        description: normalized,
        stripped: false,
        family,
        language,
      };
    }

    if (normalized === introJoined) {
      return {
        description: '',
        stripped: true,
        family,
        language,
      };
    }

    const prefix = `${introJoined}${TOP_LEVEL_BLOCK_SEPARATOR}`;
    if (normalized.startsWith(prefix)) {
      return {
        description: stripOuterBlankLines(normalized.slice(prefix.length)),
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

  function stripDecorativeFixedBlocks(rawValue, family = '', language = 'fr') {
    const candidateFamilies = family === 'collection_doublex'
      ? ['collection_doublex', 'collection']
      : [family];

    for (const candidateFamily of candidateFamilies) {
      const withoutIntro = stripLeadingFixedBlocks(rawValue, candidateFamily, language);
      const withoutTrailing = stripTrailingFixedBlocks(withoutIntro.description, candidateFamily, language);
      if (withoutIntro.stripped || withoutTrailing.stripped) {
        return {
          description: withoutTrailing.description,
          stripped: true,
          family: candidateFamily,
          language,
        };
      }
    }

    return {
      description: normalizeTopLevelBlockText(rawValue),
      stripped: false,
      family,
      language,
    };
  }

  function stripTranslationSourceCommonBlocks(rawValue, family = '', language = 'fr') {
    const normalized = normalizeTopLevelBlockText(rawValue);
    const editorialMarker = /^(?:🎭\s*)?Fan Art et artiste\s*:/im;
    const markerMatch = editorialMarker.exec(normalized);
    const editorialTail = markerMatch ? normalized.slice(markerMatch.index) : '';
    const nextBlockOffset = editorialTail.search(/\n{3,}/);
    const withoutCommonTail = markerMatch && nextBlockOffset >= 0
      ? stripOuterBlankLines(normalized.slice(0, markerMatch.index + nextBlockOffset))
      : normalized;
    const stripped = stripDecorativeFixedBlocks(withoutCommonTail, family, language);

    return {
      ...stripped,
      stripped: Boolean((markerMatch && nextBlockOffset >= 0) || stripped.stripped),
    };
  }

  function restoreTranslationSourceSpacing(rawTranslation, rawSource) {
    const translation = normalizeTopLevelBlockText(rawTranslation);
    const source = normalizeTopLevelBlockText(rawSource);
    if (!translation || !source) return translation;

    const sourceSeparators = [...source.matchAll(/\n{2,}/g)].map((match) => match[0]);
    const translationParts = translation.split(/\n{2,}/);
    if (sourceSeparators.length !== translationParts.length - 1) return translation;

    return translationParts
      .map((part, index) => `${part}${sourceSeparators[index] || ''}`)
      .join('');
  }

  function assertDynamicFanArtBlockPreserved(rawSource, rawTranslation) {
    const sourceHasDynamicFanArt = /^(?:🎭\s*)?Fan Art et artiste\s*:/im.test(String(rawSource || ''));
    if (!sourceHasDynamicFanArt) return;

    const translationHasDynamicFanArt = /^(?:🎭\s*)?Fan[ -]?Art\b[^\n]*:/im.test(String(rawTranslation || ''));
    if (!translationHasDynamicFanArt) {
      throw new Error('La traduction a supprimé le bloc dynamique Fan Art et artiste. Relance cette langue.');
    }
  }

  function buildTranslatedDescriptionWithFixedBlocks(dynamicDescription, family = '', language = '', sourceDescription = '') {
    assertDynamicFanArtBlockPreserved(sourceDescription, dynamicDescription);
    const spacedDescription = restoreTranslationSourceSpacing(dynamicDescription, sourceDescription);
    const dynamicOnly = stripDecorativeFixedBlocks(spacedDescription, family, language).description;
    const introBlocks = getIntroBlocksForFamilyAndLanguage(family, language);
    const fixedBlocks = getFixedBlocksForFamilyAndLanguage(family, language);
    if (!introBlocks.length && !fixedBlocks.length) return dynamicOnly;
    return joinTopLevelBlocks([...introBlocks, dynamicOnly, ...fixedBlocks]);
  }

  function buildDescriptionAssemblyContext(prefix) {
    const currentPrefix = typeof global.pfx === 'function' ? global.pfx() : '';
    if (currentPrefix === prefix && typeof global.buildCtx === 'function') {
      return global.buildCtx('description') || {};
    }
    return {};
  }

  function stripLeadingDescriptionHeading(rawValue) {
    const lines = normalizeDescriptionLineEndings(rawValue)
      .split('\n');

    if (!lines.length) return '';

    const firstLine = String(lines[0] || '').trim();
    const isMarkdownHeading = /^#\s*/.test(firstLine);
    const looksLikeDescriptionHeading = /description\s+produit/i.test(firstLine);
    if (!isMarkdownHeading || !looksLikeDescriptionHeading) {
      return lines.join('\n');
    }

    const remaining = lines.slice(1).join('\n');
    return remaining.replace(/^(?:[ \t]*\n)+/g, '');
  }

  function buildFinalPipelineDescription(prefix, dynamicDescription) {
    const rawDynamicDescription = stripLeadingDescriptionHeading(dynamicDescription);
    if (!rawDynamicDescription) return '';

    const family = resolveDescriptionFamilyFromPrefix(prefix);
    const ctx = buildDescriptionAssemblyContext(prefix);
    const introBlocks = family === 'collection'
      ? [buildWhatYouReceiveBlock(ctx)]
      : getIntroBlocksForFamilyAndLanguage(family, 'fr');
    const fixedClientBlocks = family === 'collection'
      ? [
          String(templates.EXPERIENCE_BLOCK || '').trim(),
          ...(Array.isArray(templates.CLIENT_INFORMATION_BLOCKS) ? templates.CLIENT_INFORMATION_BLOCKS : []),
        ]
      : getFixedBlocksForFamilyAndLanguage(family, 'fr');

    return joinTopLevelBlocks([
      ...introBlocks,
      rawDynamicDescription,
      ...fixedClientBlocks,
    ]);
  }

  global.PipelineUIDescriptionAssembly = {
    formatScaleSummary,
    buildWhatYouReceiveBlock,
    joinTopLevelBlocks,
    normalizeTopLevelBlockText,
    resolveDescriptionFamilyFromPrefix,
    getIntroBlocksForFamilyAndLanguage,
    getFixedBlocksForFamilyAndLanguage,
    stripLeadingFixedBlocks,
    stripTrailingFixedBlocks,
    stripDecorativeFixedBlocks,
    stripTranslationSourceCommonBlocks,
    restoreTranslationSourceSpacing,
    assertDynamicFanArtBlockPreserved,
    buildTranslatedDescriptionWithFixedBlocks,
    buildDescriptionAssemblyContext,
    stripLeadingDescriptionHeading,
    buildFinalPipelineDescription,
  };

  global.PipelineUI.runtime = global.PipelineUI.runtime || {};
  Object.assign(global.PipelineUI.runtime, global.PipelineUIDescriptionAssembly);
  Object.assign(global, global.PipelineUIDescriptionAssembly);
})(window);
