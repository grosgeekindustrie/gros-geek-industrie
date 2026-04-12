'use strict';

// Catalogues déclaratifs de formulaire.
// Contient uniquement des données et quelques helpers légers de lecture.

window.PipelineUI = window.PipelineUI || {};
window.PipelineUIData = window.PipelineUIData || {};
window.PipelineUIDataFormCatalogs = window.PipelineUIDataFormCatalogs || {};

const TABLETOP_FORM_CATALOGS = {
  archetypes: {
    primaryOptions: [
      { value: '', label: '— Choisir —' },
      { value: 'monk', label: 'Monk / Moine' },
      { value: 'warrior', label: 'Warrior / Guerrier' },
      { value: 'mage', label: 'Mage / Sorcerer' },
      { value: 'rogue', label: 'Rogue / Assassin' },
      { value: 'ranger', label: 'Ranger / Archer' },
      { value: 'paladin', label: 'Paladin' },
      { value: 'barbarian', label: 'Barbarian / Berserker' },
      { value: 'cleric', label: 'Cleric / Priest' },
      { value: 'druid', label: 'Druid' },
      { value: 'bard', label: 'Bard' },
      { value: 'fighter', label: 'Fighter' },
      { value: 'necromancer', label: 'Necromancer' },
      { value: 'artificer', label: 'Artificer' },
      { value: 'creature', label: 'Creature / Monster' },
    ],
    secondaryOptions: [
      { value: 'monk', label: 'Monk' },
      { value: 'warrior', label: 'Warrior' },
      { value: 'mage', label: 'Mage' },
      { value: 'rogue', label: 'Rogue' },
      { value: 'ranger', label: 'Ranger' },
      { value: 'paladin', label: 'Paladin' },
      { value: 'barbarian', label: 'Barbarian' },
      { value: 'cleric', label: 'Cleric' },
      { value: 'druid', label: 'Druid' },
      { value: 'bard', label: 'Bard' },
      { value: 'fighter', label: 'Fighter' },
      { value: 'necromancer', label: 'Necromancer' },
      { value: 'martial artist', label: 'Martial artist' },
      { value: 'kung fu', label: 'Kung fu' },
      { value: 'assassin', label: 'Assassin' },
      { value: 'archer', label: 'Archer' },
      { value: 'berserker', label: 'Berserker' },
      { value: 'wizard', label: 'Wizard' },
      { value: 'warlock', label: 'Warlock' },
      { value: 'dragonborn', label: 'Dragonborn' },
    ],
  },
  typeOptions: [
    { value: 'SOLO', label: 'Solo' },
    { value: 'SET', label: 'Set / Armée' },
    { value: 'BOSS', label: 'Boss / Créature' },
  ],
  versionOptions: [
    { value: 'FIGURINE', label: 'Figurine' },
    { value: 'MINIATURES', label: 'Miniatures' },
    { value: 'LES_DEUX', label: 'Figurine et Miniatures' },
  ],
};

const COLLECTION_FORM_CATALOGS = {
  typeOptions: [
    { value: 'FIGURINE', label: 'Figurine' },
    { value: 'STATUE', label: 'Statue' },
    { value: 'BUSTE', label: 'Buste' },
  ],
  media: [
    { value: 'anime', label: '📺 Anime', subcategories: ['shonen', 'seinen', 'shojo', 'josei', 'mecha', 'isekai'] },
    { value: 'manga', label: '📖 Manga', subcategories: ['shonen', 'seinen', 'shojo', 'josei', 'kodomo'] },
    { value: 'jeux vidéo', label: '🎮 Jeux vidéo', subcategories: ['rpg', 'action-adventure', 'fighting game', 'puzzle game', 'survival horror', 'jrpg'] },
    { value: 'comics / super-héros', label: '🦸 Comics', subcategories: ['superhero', 'dark fantasy', 'indie comics', 'graphic novel'] },
    { value: 'cinéma', label: '🎬 Cinéma', subcategories: ['action', 'sci-fi', 'fantasy', 'horror', 'thriller'] },
    { value: 'animation occidentale', label: '🎨 Animation', subcategories: ['family', 'fantasy', 'adventure', 'comedy'] },
    { value: 'donjons & dragons / fantasy', label: '🐉 Fantasy', subcategories: ['high fantasy', 'dark fantasy', 'mythological', 'tabletop rpg'] },
    { value: 'Sci-fi', label: '🚀 Science fiction', subcategories: ['cyberpunk', 'space opera', 'mecha', 'post-apocalyptic'] },
    { value: 'création originale', label: '✨ Original', subcategories: ['dark fantasy', 'heroic fantasy', 'mythological', 'character design'] },
  ],
  sharedGenres: [
    { value: 'fantasy', label: 'Fantasy' },
    { value: 'dark fantasy', label: 'Dark fantasy' },
    { value: 'sci-fi', label: 'Sci-fi' },
    { value: 'cyberpunk', label: 'Cyberpunk' },
    { value: 'horror', label: 'Horror' },
    { value: 'gothic', label: 'Gothic' },
    { value: 'post-apocalyptic', label: 'Post-apocalyptic' },
    { value: 'mythological', label: 'Mythological' },
    { value: 'military', label: 'Military' },
    { value: 'adventure', label: 'Adventure' },
  ],
};

const dedupeOptions = (options = []) => {
  const seen = new Set();
  return options.filter((option) => {
    const key = String(option?.value || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getCollectionMediaMap = () => Object.fromEntries(
  COLLECTION_FORM_CATALOGS.media.map((entry) => [entry.value, entry])
);

const getCollectionSubcategoriesForMedia = (selectedMedia = []) => {
  const mediaMap = getCollectionMediaMap();
  const selectedValues = Array.isArray(selectedMedia) ? selectedMedia : [];
  const subcategoryOptions = selectedValues.flatMap((value) => (mediaMap[value]?.subcategories || []).map((subcategory) => ({
    value: subcategory,
    label: subcategory,
  })));

  return dedupeOptions(subcategoryOptions);
};

Object.assign(window.PipelineUIDataFormCatalogs, {
  TABLETOP_FORM_CATALOGS,
  COLLECTION_FORM_CATALOGS,
  dedupeOptions,
  getCollectionSubcategoriesForMedia,
});

Object.assign(window.PipelineUIData, {
  formCatalogs: window.PipelineUIDataFormCatalogs,
});
