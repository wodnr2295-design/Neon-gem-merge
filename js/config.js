/* Neon Gem Merge — shared configuration
 * All artwork is drawn procedurally on Canvas 2D; no external image assets.
 */

export const DESIGN_WIDTH = 360;

export const PHYSICS = {
  gravity: 1850,
  substeps: 8,           // >= 8 as required; also clamped to <= 1/480 s per substep
  maxSubstep: 1 / 480,
  iterations: 6,        // solver passes per substep (stacks stay tight)
  restThreshold: 55,     // below this closing speed no bounce (kills jitter)
  slop: 0.05,
  correction: 0.86,
  friction: 0.55,
  airDrag: 0.9995,
  spinDrag: 0.992,
  maxSpeed: 2400,
  cell: 96
};

export const PLAY = {
  dangerY: 96,        // top danger line (world units)
  spawnY: 40,         // gem centre when waiting to drop
  dropCooldown: 0.24, // seconds until the next gem is ready
  overflowGrace: 1.0, // a freshly dropped gem cannot trigger overflow for this long
  overflowLimit: 2.5, // continuous seconds over the line => game over
  dangerSpeed: 62,    // must be slower than this to count as "resting over line"
  reviveInvuln: 1.2,
  startingTiers: [1, 2, 3, 4, 5],
  tierWeights: [34, 27, 20, 12, 7]
};

/* 11 hand-tuned pastel-jewel tiers.
 * c1 = light face, c2 = body, rim = edge light, glow = ambient halo.
 */
export const TIERS = [
  { tier: 1,  ko: '스파크',   en: 'Spark',      r: 14,  shape: 'spark',   c1: '#EAF9FF', c2: '#93D6F0', rim: '#FFFFFF', glow: '#8FD4F2', facet: '#B9E7F8' },
  { tier: 2,  ko: '글로우 오브', en: 'Glow Orb',  r: 19,  shape: 'orb',     c1: '#DDFAF0', c2: '#6FD3B8', rim: '#F4FFFB', glow: '#79DCC0', facet: '#A9EBD9' },
  { tier: 3,  ko: '프리즘',   en: 'Prism',      r: 25,  shape: 'prism',   c1: '#FFEEDC', c2: '#F0AE84', rim: '#FFF8F0', glow: '#F4BA92', facet: '#FFD7BC' },
  { tier: 4,  ko: '아메지스트', en: 'Amethyst',  r: 32,  shape: 'hex',     c1: '#EFE6FF', c2: '#A489EE', rim: '#FAF6FF', glow: '#AE95F0', facet: '#D2C1FA' },
  { tier: 5,  ko: '루비',     en: 'Ruby',       r: 40,  shape: 'diamond', c1: '#FFE1EA', c2: '#EF7F9C', rim: '#FFF5F8', glow: '#F089A4', facet: '#FFBDD0' },
  { tier: 6,  ko: '토파즈',   en: 'Topaz',      r: 49,  shape: 'octagon', c1: '#FFF2D2', c2: '#E0B15E', rim: '#FFF9EA', glow: '#E7BC74', facet: '#FBDCA4' },
  { tier: 7,  ko: '에메랄드', en: 'Emerald',    r: 59,  shape: 'round',   c1: '#DCF8E9', c2: '#4FC29B', rim: '#F2FFF9', glow: '#63CBAA', facet: '#9EE3C9' },
  { tier: 8,  ko: '사파이어', en: 'Sapphire',   r: 70,  shape: 'square',  c1: '#E2E9FF', c2: '#6B8CEF', rim: '#F6F9FF', glow: '#7B9BF1', facet: '#B7C7FB' },
  { tier: 9,  ko: '오팔',     en: 'Opal',       r: 82,  shape: 'opal',    c1: '#FFE2F3', c2: '#84CCC8', rim: '#FFFFFF', glow: '#C9C4F2', facet: '#D9C9F5' },
  { tier: 10, ko: '노바',     en: 'Nova',       r: 95,  shape: 'star6',   c1: '#EFE0FF', c2: '#7B5FD4', rim: '#FBF7FF', glow: '#8E75DE', facet: '#C8B5F6' },
  { tier: 11, ko: '코스믹 다이아', en: 'Cosmic Diamond', r: 110, shape: 'cosmic', c1: '#E7ECFF', c2: '#6D5BC9', rim: '#FFFFFF', glow: '#8E7BE0', facet: '#C0C9FF' }
];

export const TIER_BY_LEVEL = TIERS;
export const MAX_TIER = TIERS.length;

export function tierOf(level) {
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, level - 1))];
}

/** Score awarded for producing a gem of `level` (2..11). */
export function mergeScore(level) {
  return 5 * level * (level - 1);
}

export const STORAGE = {
  best: 'ngm.best.v1',
  sound: 'ngm.sound.v1',
  tutorial: 'ngm.tutorial.v1',
  codex: 'ngm.codex.v1'
};
