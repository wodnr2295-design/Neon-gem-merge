/* Neon Gem Merge — visual themes.
 *
 * A theme is a complete look: the gem body colours for all 11 tiers plus the
 * board ambience (gradient, aurora pools, dust, floor). Everything is authored
 * by hand so each set stays pastel and coherent instead of being a blind hue
 * rotation. `buildGemPalette` derives the highlight/facet/rim tints from each
 * body colour, so a theme only has to state eleven base colours.
 */

import { TIERS } from './config.js';

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

export function rgbOf(hex) {
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixHex(a, b, t) {
  const [ar, ag, ab] = rgbOf(a);
  const [br, bg, bb] = rgbOf(b);
  const r = clamp255(ar + (br - ar) * t);
  const g = clamp255(ag + (bg - ag) * t);
  const bl = clamp255(ab + (bb - ab) * t);
  return '#' + [r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function hexAlpha(hex, alpha) {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ------------------------------------------------------------------ themes */

export const THEMES = [
  {
    id: 'midnight',
    ko: '미드나잇 파스텔',
    en: 'Midnight Pastel',
    tagKo: '기본 · 차분한 심야 파스텔',
    tagEn: 'Default · calm midnight pastels',
    price: 0,
    bg: {
      stops: ['#0D1421', '#111A2A', '#0A1019'],
      lights: [['0.18', '0.16', '0.85', '120,170,220', 0.11], ['0.92', '0.72', '0.95', '150,130,210', 0.09]],
      column: '178,206,255',
      dust: '220,235,255',
      dustAlpha: 1,
      floor: '140,170,220',
      wall: '3,6,12',
      stars: 0
    },
    ui: ['rgba(120,170,220,0.20)', 'rgba(150,130,210,0.16)']
  },
  {
    id: 'aurora',
    ko: '오로라 트와일라잇',
    en: 'Aurora Twilight',
    tagKo: '민트빛 오로라가 흐르는 밤',
    tagEn: 'Mint aurora drifting over midnight',
    price: 450,
    gems: [
      '#B6EDE4', '#8ADDC6', '#9FD8EC', '#AEC0F2', '#D8A8E0',
      '#BFD98F', '#63C9A6', '#7E9BEE', '#8FDCD8', '#8B6AD6', '#6C5AD4'
    ],
    bg: {
      stops: ['#0B1A20', '#0E2430', '#071318'],
      lights: [['0.15', '0.14', '0.90', '80,220,190', 0.13], ['0.88', '0.74', '0.95', '130,120,235', 0.11]],
      column: '170,235,230',
      dust: '205,255,245',
      dustAlpha: 1.05,
      floor: '110,200,190',
      wall: '2,10,14',
      stars: 0
    },
    ui: ['rgba(80,220,190,0.20)', 'rgba(130,120,235,0.16)']
  },
  {
    id: 'cherry',
    ko: '체리 블라썸',
    en: 'Cherry Blossom',
    tagKo: '분홍 꽃잎이 내려앉은 봄밤',
    tagEn: 'Petal-soft pink spring night',
    price: 650,
    gems: [
      '#FFE3EC', '#FFC2D6', '#FFC7A8', '#EFA3C8', '#F2779B',
      '#F0C08A', '#E98AB0', '#B78BD8', '#F3B9D0', '#B36BAE', '#9B5A9E'
    ],
    bg: {
      stops: ['#1A1018', '#241522', '#120A11'],
      lights: [['0.20', '0.14', '0.90', '255,150,185', 0.13], ['0.90', '0.76', '0.95', '255,180,150', 0.09]],
      column: '255,200,220',
      dust: '255,225,238',
      dustAlpha: 1,
      floor: '235,150,180',
      wall: '16,6,12',
      stars: 0
    },
    ui: ['rgba(255,150,185,0.20)', 'rgba(255,180,150,0.14)']
  },
  {
    id: 'deepspace',
    ko: '딥 스페이스',
    en: 'Deep Space',
    tagKo: '별이 쏟아지는 심우주 보석',
    tagEn: 'Jewels adrift in a star field',
    price: 900,
    gems: [
      '#7FC8E8', '#4FC3A8', '#E8A87C', '#8B78E0', '#E85C86',
      '#D9A84E', '#3FAE8A', '#4A6BE0', '#7FB8D8', '#6B4FC8', '#4A3FA8'
    ],
    bg: {
      stops: ['#05070E', '#0A0B1B', '#03050B'],
      lights: [['0.20', '0.20', '0.95', '90,110,235', 0.14], ['0.85', '0.80', '0.90', '190,80,210', 0.08]],
      column: '170,185,255',
      dust: '225,232,255',
      dustAlpha: 1.9,
      floor: '110,120,210',
      wall: '0,0,4',
      stars: 1
    },
    ui: ['rgba(90,110,235,0.22)', 'rgba(190,80,210,0.14)']
  }
];

export const DEFAULT_THEME_ID = 'midnight';

export function themeById(id) {
  return THEMES.find((th) => th.id === id) || THEMES[0];
}

/* ---------------------------------------------------------------- palettes */

/** Turn a theme's eleven body colours into full gem tier records. */
export function buildGemPalette(theme) {
  const th = theme || THEMES[0];
  return TIERS.map((base, i) => {
    if (th.id === DEFAULT_THEME_ID || !th.gems) return { ...base };
    const c2 = th.gems[i] || base.c2;
    return {
      ...base,
      c1: mixHex(c2, '#FFFFFF', 0.60),
      c2,
      facet: mixHex(c2, '#FFFFFF', 0.36),
      rim: mixHex(c2, '#FFFFFF', 0.88),
      glow: c2
    };
  });
}
