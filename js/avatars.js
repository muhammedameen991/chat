/**
 * Golden Grove — Built-in Image Profile Picture (DP) Registry
 * Replaces emoji characters with professionally designed vector image assets.
 * Organizes avatars into 6 distinct categories with rich metadata and search.
 */

export const DEFAULT_AVATAR = '/avatars/default_avatar.svg';

export const AVATAR_CATEGORIES = [
  { id: 'all', label: 'All Avatars', icon: '✨' },
  { id: 'nature', label: 'Nature', icon: '🌿' },
  { id: 'abstract', label: 'Abstract', icon: '🌀' },
  { id: 'minimal', label: 'Minimal', icon: '⚪' },
  { id: 'animals', label: 'Animals', icon: '🦊' },
  { id: 'illustrations', label: 'Illustrations', icon: '🎨' },
  { id: 'gradients', label: 'Gradient Portraits', icon: '🌈' },
];

export const BUILTIN_AVATARS = [
  // NATURE
  {
    id: 'nature_grove_oak',
    name: 'Grove Oak',
    category: 'nature',
    url: '/avatars/nature_grove_oak.svg',
    description: 'Ancient sheltering oak tree under warm sun rays',
  },
  {
    id: 'nature_sunlit_meadow',
    name: 'Sunlit Meadow',
    category: 'nature',
    url: '/avatars/nature_sunlit_meadow.svg',
    description: 'Rolling hills and wildflowers bathed in golden morning light',
  },
  {
    id: 'nature_emerald_forest',
    name: 'Emerald Pines',
    category: 'nature',
    url: '/avatars/nature_emerald_forest.svg',
    description: 'Majestic evergreen canopy in deep forest green',
  },
  {
    id: 'nature_golden_peaks',
    name: 'Golden Peaks',
    category: 'nature',
    url: '/avatars/nature_golden_peaks.svg',
    description: 'Serene mountain summits at sunrise',
  },

  // ABSTRACT
  {
    id: 'abstract_solar_spiral',
    name: 'Solar Spiral',
    category: 'abstract',
    url: '/avatars/abstract_solar_spiral.svg',
    description: 'Golden geometric orbits and radiant energy rings',
  },
  {
    id: 'abstract_botanical_mesh',
    name: 'Botanical Harmony',
    category: 'abstract',
    url: '/avatars/abstract_botanical_mesh.svg',
    description: 'Translucent overlapping leaf petals and warm earth tones',
  },
  {
    id: 'abstract_solar_burst',
    name: 'Solar Burst',
    category: 'abstract',
    url: '/avatars/abstract_solar_burst.svg',
    description: 'Radiant geometric sunburst on deep moss green',
  },
  {
    id: 'abstract_harmony_flow',
    name: 'Harmonic Flow',
    category: 'abstract',
    url: '/avatars/abstract_harmony_flow.svg',
    description: 'Fluid curving ribbons of amber gold and forest jade',
  },

  // MINIMAL
  {
    id: 'minimal_zen_leaf',
    name: 'Zen Leaf',
    category: 'minimal',
    url: '/avatars/minimal_zen_leaf.svg',
    description: 'Monolithic botanical leaf silhouette with golden veins',
  },
  {
    id: 'minimal_solar_ring',
    name: 'Solar Ring',
    category: 'minimal',
    url: '/avatars/minimal_solar_ring.svg',
    description: 'Clean minimalist concentric gold and jade circles',
  },
  {
    id: 'minimal_acorn_crest',
    name: 'Acorn Crest',
    category: 'minimal',
    url: '/avatars/minimal_acorn_crest.svg',
    description: 'Refined heraldic acorn symbol of golden growth',
  },
  {
    id: 'minimal_horizon_lines',
    name: 'Earthy Horizon',
    category: 'minimal',
    url: '/avatars/minimal_horizon_lines.svg',
    description: 'Calm striped landscape lines beneath an amber sun',
  },

  // ANIMALS
  {
    id: 'animal_forest_fox',
    name: 'Forest Fox',
    category: 'animals',
    url: '/avatars/animal_forest_fox.svg',
    description: 'Noble orange fox with watchful eyes and golden mark',
  },
  {
    id: 'animal_woodland_deer',
    name: 'Woodland Deer',
    category: 'animals',
    url: '/avatars/animal_woodland_deer.svg',
    description: 'Graceful stag portrait framed in gentle earth tones',
  },
  {
    id: 'animal_soaring_hawk',
    name: 'Soaring Hawk',
    category: 'animals',
    url: '/avatars/animal_soaring_hawk.svg',
    description: 'Falcon gliding peacefully across a morning sunbeam',
  },
  {
    id: 'animal_pine_owl',
    name: 'Pine Owl',
    category: 'animals',
    url: '/avatars/animal_pine_owl.svg',
    description: 'Wise nocturnal owl nestled in deep pine needles',
  },

  // ILLUSTRATIONS
  {
    id: 'illus_grove_wanderer',
    name: 'Grove Wanderer',
    category: 'illustrations',
    url: '/avatars/illus_grove_wanderer.svg',
    description: 'Warm illustrated traveler wearing an explorer hat',
  },
  {
    id: 'illus_sun_botanist',
    name: 'Sun Botanist',
    category: 'illustrations',
    url: '/avatars/illus_sun_botanist.svg',
    description: 'Passionate gardener with round spectacles and floral crown',
  },
  {
    id: 'illus_leaf_guardian',
    name: 'Leaf Guardian',
    category: 'illustrations',
    url: '/avatars/illus_leaf_guardian.svg',
    description: 'Nature guardian crowned with golden laurel leaves',
  },
  {
    id: 'illus_meadow_dreamer',
    name: 'Meadow Dreamer',
    category: 'illustrations',
    url: '/avatars/illus_meadow_dreamer.svg',
    description: 'Serene dreamer admiring the gentle sun in a wildflower grove',
  },

  // GRADIENT PORTRAITS
  {
    id: 'gradient_amber_aurora',
    name: 'Amber Aurora',
    category: 'gradients',
    url: '/avatars/gradient_amber_aurora.svg',
    description: 'Silky radial gradient of morning sunlight and warm amber',
  },
  {
    id: 'gradient_deep_canopy',
    name: 'Emerald Canopy',
    category: 'gradients',
    url: '/avatars/gradient_deep_canopy.svg',
    description: 'Lush gradient portrait blending vibrant emerald and pine',
  },
  {
    id: 'gradient_sunset_clay',
    name: 'Sunset Terracotta',
    category: 'gradients',
    url: '/avatars/gradient_sunset_clay.svg',
    description: 'Earthy warmth inspired by clay pottery and evening sun',
  },
  {
    id: 'gradient_sylvan_mist',
    name: 'Sylvan Mist',
    category: 'gradients',
    url: '/avatars/gradient_sylvan_mist.svg',
    description: 'Soft sage green morning mist touched by soft golden glow',
  },
];

// Mapping for legacy avatar IDs to modern images
const LEGACY_AVATAR_MAP = {
  avatar_1: '/avatars/nature_sunlit_meadow.svg',
  avatar_2: '/avatars/nature_grove_oak.svg',
  avatar_3: '/avatars/animal_forest_fox.svg',
  avatar_4: '/avatars/minimal_zen_leaf.svg',
  avatar_5: '/avatars/abstract_solar_burst.svg',
  avatar_6: '/avatars/nature_emerald_forest.svg',
};

/**
 * Resolves any avatar string (ID, URL, legacy identifier) to a valid image URL.
 * Never returns an emoji character.
 * @param {string} [avatarIdOrUrl]
 * @returns {string}
 */
export function resolveAvatarUrl(avatarIdOrUrl) {
  if (!avatarIdOrUrl || typeof avatarIdOrUrl !== 'string') {
    return DEFAULT_AVATAR;
  }

  // Already a URL or data URL
  if (
    avatarIdOrUrl.startsWith('/') ||
    avatarIdOrUrl.startsWith('http://') ||
    avatarIdOrUrl.startsWith('https://') ||
    avatarIdOrUrl.startsWith('data:image/')
  ) {
    return avatarIdOrUrl;
  }

  // Legacy mappings
  if (LEGACY_AVATAR_MAP[avatarIdOrUrl]) {
    return LEGACY_AVATAR_MAP[avatarIdOrUrl];
  }

  // ID match in built-in list
  const found = BUILTIN_AVATARS.find((a) => a.id === avatarIdOrUrl);
  if (found) {
    return found.url;
  }

  return DEFAULT_AVATAR;
}

/**
 * Filters avatars by category and optional search query.
 * @param {string} category
 * @param {string} [query]
 * @returns {Array<typeof BUILTIN_AVATARS[0]>}
 */
export function filterBuiltinAvatars(category = 'all', query = '') {
  const cleanQ = (query || '').trim().toLowerCase();
  return BUILTIN_AVATARS.filter((item) => {
    const matchesCat = category === 'all' || item.category === category;
    const matchesQuery =
      !cleanQ ||
      item.name.toLowerCase().includes(cleanQ) ||
      item.description.toLowerCase().includes(cleanQ) ||
      item.category.toLowerCase().includes(cleanQ);
    return matchesCat && matchesQuery;
  });
}
