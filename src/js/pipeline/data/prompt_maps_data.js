'use strict';

// Mapping déclaratif des prompts disque.

(function initPipelineUIDataPromptMaps(global) {
  global.PipelineUI = global.PipelineUI || {};
  global.PipelineUIData = global.PipelineUIData || {};
  global.PipelineUIDataPromptMaps = global.PipelineUIDataPromptMaps || {};

  const promptFileMaps = {
    tabletop: {
      analyse:'marcus', alt:'nadia', marche:'sophie', tags:'karim',
      titre:'maya', description:'claire', social:'leo', camille:'camille', iris:'iris',
    },
    collection: {
      alt:'jules',
      iris:'iris',
      marche:'luna',
      tags:'tags',
      titre:'nova',
      description:'eden',
      social:'theo',
      camille:'zoe',
    },
  };

  const promptFileMapsByShop = {
    grosgeek: promptFileMaps,
    doublex: {
      tabletop: {
        analyse:'yoshi_visual',
        alt:'luigi_alt_blocks',
        marche:'daisy_market',
        tags:'bowser_tags',
        titre:'mario_titles',
        description:'peach_description',
        social:'wario_social',
        camille:'rosalina_pinterest',
        iris:'toad_seo',
      },
      collection: {
        alt:'lune_alt_blocks',
        iris:'esquie_seo',
        marche:'ciel_alt',
        tags:'verso_tags',
        titre:'maelle_titles',
        description:'renoir_description',
        social:'alicia_social',
        camille:'gustave_pinterest',
      },
    },
  };

  const normalizeShopKey = (shopKey = '') => (
    String(shopKey || '').trim() === 'doublex' ? 'doublex' : 'grosgeek'
  );

  const resolvePromptFileMap = (mode = 'tabletop', shopKey = '', options = {}) => {
    const normalizedShopKey = normalizeShopKey(shopKey);
    const normalizedMode = String(mode || '').trim() === 'collection' ? 'collection' : 'tabletop';
    const useDoublexShopPrompts = options?.useDoublexShopPrompts !== false;
    const effectiveShopKey = normalizedShopKey === 'doublex' && !useDoublexShopPrompts ? 'grosgeek' : normalizedShopKey;
    return promptFileMapsByShop[effectiveShopKey]?.[normalizedMode]
      || promptFileMaps[normalizedMode]
      || {};
  };

  const resolvePromptFolder = (mode = 'tabletop', shopKey = '', options = {}) => {
    const normalizedShopKey = normalizeShopKey(shopKey);
    const normalizedMode = String(mode || '').trim() === 'collection' ? 'collection' : 'tabletop';
    const useDoublexShopPrompts = options?.useDoublexShopPrompts !== false;
    return normalizedShopKey === 'doublex' && useDoublexShopPrompts
      ? `prompts/doubleX/${normalizedMode}`
      : `prompts/${normalizedMode}`;
  };

  Object.assign(global.PipelineUIDataPromptMaps, {
    PROMPT_FILE_MAPS: promptFileMaps,
    PROMPT_FILE_MAPS_BY_SHOP: promptFileMapsByShop,
    resolvePromptFileMap,
    resolvePromptFolder,
  });

  Object.assign(global.PipelineUIData, {
    promptMaps: global.PipelineUIDataPromptMaps,
  });
})(window);
