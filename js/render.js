/* Neon Gem Merge — procedural art.
 * Soft, jewel-like pastel gems with glass highlights and tiny friendly faces.
 * No bitmaps: every gem, glow, particle and background element is drawn here.
 */

import { tierOf, DESIGN_WIDTH } from './config.js';
import { buildGemPalette, themeById, DEFAULT_THEME_ID } from './themes.js';

const TAU = Math.PI * 2;

/* ----------------------------------------------------------------- themes */

let THEME = themeById(DEFAULT_THEME_ID);
let PALETTE = buildGemPalette(THEME);

export function setTheme(themeOrId) {
  THEME = typeof themeOrId === 'string' ? themeById(themeOrId) : (themeOrId || themeById(DEFAULT_THEME_ID));
  PALETTE = buildGemPalette(THEME);
  return THEME;
}

export function getTheme() {
  return THEME;
}

function paletteFor(tier) {
  return PALETTE[Math.max(0, Math.min(PALETTE.length - 1, tier - 1))] || tierOf(tier);
}

/* ---------------------------------------------------------------- helpers */

function roundedPolygon(ctx, pts, radius) {
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const v1x = prev[0] - p[0], v1y = prev[1] - p[1];
    const v2x = next[0] - p[0], v2y = next[1] - p[1];
    const l1 = Math.hypot(v1x, v1y) || 1;
    const l2 = Math.hypot(v2x, v2y) || 1;
    const r1 = Math.min(radius, l1 * 0.45);
    const r2 = Math.min(radius, l2 * 0.45);
    const a = [p[0] + (v1x / l1) * r1, p[1] + (v1y / l1) * r1];
    const b = [p[0] + (v2x / l2) * r2, p[1] + (v2y / l2) * r2];
    if (i === 0) ctx.moveTo(a[0], a[1]);
    else ctx.lineTo(a[0], a[1]);
    ctx.quadraticCurveTo(p[0], p[1], b[0], b[1]);
  }
  ctx.closePath();
}

function starPoints(spikes, outer, inner, phase = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = phase + (i * Math.PI) / spikes;
    pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
  }
  return pts;
}

function circlePath(ctx, r) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
}

export function gemShapePath(ctx, shape, r) {
  switch (shape) {
    case 'spark':
      roundedPolygon(ctx, starPoints(4, r * 0.98, r * 0.3), r * 0.08);
      break;
    case 'orb':
      circlePath(ctx, r * 0.97);
      break;
    case 'prism': {
      const pts = [];
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 3;
        pts.push([Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02]);
      }
      roundedPolygon(ctx, pts, r * 0.26);
      break;
    }
    case 'hex': {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 6;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      roundedPolygon(ctx, pts, r * 0.2);
      break;
    }
    case 'diamond': {
      const pts = [
        [0, -r], [r * 0.64, -r * 0.58], [r * 0.94, r * 0.06], [r * 0.6, r * 0.82],
        [0, r], [-r * 0.6, r * 0.82], [-r * 0.94, r * 0.06], [-r * 0.64, -r * 0.58]
      ];
      roundedPolygon(ctx, pts, r * 0.12);
      break;
    }
    case 'octagon': {
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + Math.PI / 8 + (i * TAU) / 8;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      roundedPolygon(ctx, pts, r * 0.22);
      break;
    }
    case 'round':
      circlePath(ctx, r * 0.98);
      break;
    case 'square': {
      const s = r * 0.86;
      roundedPolygon(ctx, [[-s, -s], [s, -s], [s, s], [-s, s]], r * 0.34);
      break;
    }
    case 'opal':
      circlePath(ctx, r * 0.98);
      break;
    case 'star6':
      roundedPolygon(ctx, starPoints(6, r, r * 0.62, -Math.PI / 2 + Math.PI / 6), r * 0.2);
      break;
    case 'cosmic': {
      const pts = [
        [0, -r], [r * 0.58, -r * 0.62], [r * 0.95, -r * 0.05], [r * 0.66, r * 0.6],
        [0, r], [-r * 0.66, r * 0.6], [-r * 0.95, -r * 0.05], [-r * 0.58, -r * 0.62]
      ];
      roundedPolygon(ctx, pts, r * 0.1);
      break;
    }
    default:
      circlePath(ctx, r);
  }
}

/* ------------------------------------------------------------------ faces */

function drawFace(ctx, r, tier, alpha = 1) {
  if (alpha <= 0.02) return;
  const eyeY = r * 0.02;
  const eyeDX = r * 0.28;
  const ew = Math.max(1.5, r * 0.075);
  const eh = Math.max(2.2, r * 0.125);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(38, 47, 70, 0.86)';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * eyeDX, eyeY, ew, eh, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * eyeDX - ew * 0.3, eyeY - eh * 0.3, Math.max(0.9, r * 0.026), 0, TAU);
    ctx.fill();
  }
  // smile
  ctx.strokeStyle = 'rgba(38, 47, 70, 0.7)';
  ctx.lineWidth = Math.max(1.2, r * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, r * 0.14, r * 0.17, Math.PI * 0.18, Math.PI * 0.82);
  ctx.stroke();
  // blush
  if (tier <= 6) {
    ctx.fillStyle = 'rgba(255, 140, 165, 0.16)';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * r * 0.47, r * 0.24, r * 0.15, r * 0.09, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSparkle(ctx, r, alpha = 1) {
  ctx.save();
  const star = (x, y, s, a) => {
    ctx.globalAlpha = alpha * a;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
  };
  star(r * 0.5, -r * 0.52, r * 0.19, 1);
  star(-r * 0.58, r * 0.42, r * 0.11, 0.7);
  ctx.restore();
}

/* ------------------------------------------------------------------- gems */

/**
 * Draw one gem centred at (x, y). `scale` is used for spawn pop animations.
 */
export function drawGem(ctx, gem, time = 0, opts = {}) {
  const tierInfo = paletteFor(gem.tier);
  const r = gem.r;
  const scale = opts.scale ?? 1;
  const alpha = opts.alpha ?? 1;
  if (alpha <= 0.01) return;

  ctx.save();
  ctx.translate(gem.x, gem.y);
  ctx.globalAlpha = alpha;

  // ambient halo (kept subtle: pastel, not casino-neon)
  if (opts.halo !== false) {
    const hr = r * 1.7;
    const halo = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, hr);
    halo.addColorStop(0, hexA(tierInfo.glow, 0.20));
    halo.addColorStop(0.55, hexA(tierInfo.glow, 0.07));
    halo.addColorStop(1, hexA(tierInfo.glow, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, hr, 0, TAU);
    ctx.fill();
  }

  // contact shadow
  if (opts.shadow !== false) {
    const sg = ctx.createRadialGradient(0, r * 0.55, r * 0.1, 0, r * 0.55, r * 0.95);
    sg.addColorStop(0, 'rgba(4, 8, 16, 0.28)');
    sg.addColorStop(1, 'rgba(4, 8, 16, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.6, r * 0.95, r * 0.5, 0, 0, TAU);
    ctx.fill();
  }

  ctx.scale(scale, scale);

  // ---- body ---------------------------------------------------------------
  ctx.save();
  ctx.rotate(gem.angle * 0.6);

  gemShapePath(ctx, tierInfo.shape, r);

  const g = ctx.createLinearGradient(-r * 0.55, -r * 0.8, r * 0.5, r * 0.85);
  g.addColorStop(0, tierInfo.c1);
  g.addColorStop(0.48, mix(tierInfo.c1, tierInfo.c2, 0.55));
  g.addColorStop(1, tierInfo.c2);
  ctx.fillStyle = g;
  ctx.fill();

  // inner darker edge for depth
  ctx.save();
  ctx.clip();
  const edge = ctx.createRadialGradient(0, -r * 0.2, r * 0.25, 0, 0, r * 1.05);
  edge.addColorStop(0, 'rgba(255,255,255,0)');
  edge.addColorStop(0.72, 'rgba(255,255,255,0)');
  edge.addColorStop(1, hexA(tierInfo.c2, 0.55));
  ctx.fillStyle = edge;
  ctx.fillRect(-r, -r, r * 2, r * 2);

  // facets
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = Math.max(1, r * 0.022);
  const facets = {
    diamond: [[0, -r], [0, r], [-r * 0.94, r * 0.06], [r * 0.94, r * 0.06]],
    cosmic: [[0, -r], [0, r], [-r * 0.95, -r * 0.05], [r * 0.95, -r * 0.05], [-r * 0.66, r * 0.6], [r * 0.66, r * 0.6]],
    hex: [[-r, 0], [r, 0], [0, -r], [0, r]],
    octagon: [[-r * 0.75, -r * 0.75], [r * 0.75, r * 0.75], [r * 0.75, -r * 0.75], [-r * 0.75, r * 0.75]],
    prism: [[0, -r], [0, r * 0.3], [-r * 0.9, r * 0.6], [r * 0.9, r * 0.6]]
  }[tierInfo.shape];
  if (facets) {
    ctx.beginPath();
    for (let i = 0; i < facets.length; i += 2) {
      ctx.moveTo(facets[i][0], facets[i][1]);
      ctx.lineTo(facets[i + 1][0], facets[i + 1][1]);
    }
    ctx.stroke();
  }

  // glass highlight: a soft crescent on the upper-left
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.42, r * 0.52, r * 0.3, -0.5, 0, TAU);
  const hi = ctx.createRadialGradient(-r * 0.34, -r * 0.5, 0, -r * 0.34, -r * 0.42, r * 0.6);
  hi.addColorStop(0, 'rgba(255,255,255,0.75)');
  hi.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hi;
  ctx.fill();

  // bottom reflected light
  ctx.beginPath();
  ctx.ellipse(r * 0.08, r * 0.52, r * 0.36, r * 0.12, 0.12, 0, TAU);
  ctx.fillStyle = hexA(tierInfo.c1, 0.18);
  ctx.fill();

  if (tierInfo.shape === 'opal') {
    const ir = ctx.createLinearGradient(-r, -r, r, r);
    ir.addColorStop(0, 'rgba(255, 160, 210, 0.42)');
    ir.addColorStop(0.4, 'rgba(150, 240, 226, 0.38)');
    ir.addColorStop(0.7, 'rgba(186, 168, 255, 0.40)');
    ir.addColorStop(1, 'rgba(255, 216, 160, 0.28)');
    ctx.fillStyle = ir;
    ctx.fillRect(-r, -r, r * 2, r * 2);
  }

  if (tierInfo.shape === 'cosmic') {
    for (let i = 0; i < 7; i++) {
      const a = i * 2.39996;
      const rad = r * (0.18 + ((i * 37) % 60) / 100);
      const sz = Math.max(0.8, r * (0.012 + ((i * 13) % 20) / 1000));
      ctx.fillStyle = 'rgba(255,255,255,' + (0.45 + (i % 3) * 0.15) + ')';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rad, Math.sin(a) * rad, sz, 0, TAU);
      ctx.fill();
    }
  }

  ctx.restore(); // clip

  // rim light
  gemShapePath(ctx, tierInfo.shape, r);
  ctx.strokeStyle = hexA(tierInfo.rim, 0.55);
  ctx.lineWidth = Math.max(1, r * 0.045);
  ctx.stroke();

  ctx.restore(); // rotation

  // ---- upright details ----------------------------------------------------
  if (gem.tier <= 8) {
    drawFace(ctx, r, gem.tier, gem.tier <= 5 ? 1 : 0.9);
  } else if (gem.tier === 9) {
    drawFace(ctx, r, gem.tier, 0.75);
    drawSparkle(ctx, r, 0.55);
  } else {
    drawSparkle(ctx, r, 1);
    // slow orbiting glints for the two highest tiers
    for (let i = 0; i < 3; i++) {
      const a = time * 0.7 + i * 2.1;
      const px = Math.cos(a) * r * 0.62;
      const py = Math.sin(a * 1.13) * r * 0.55;
      const gr = ctx.createRadialGradient(px, py, 0, px, py, r * 0.22);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(px, py, r * 0.22, 0, TAU);
      ctx.fill();
    }
  }

  ctx.restore();
}

/* -------------------------------------------------------------- particles */

export class Particles {
  constructor(limit = 420) {
    this.items = [];
    this.limit = limit;
  }

  clear() {
    this.items.length = 0;
  }

  burst(x, y, color, count = 16, power = 220, size = 3, type = 'dot') {
    for (let i = 0; i < count && this.items.length < this.limit; i++) {
      const a = Math.random() * TAU;
      const sp = power * (0.35 + Math.random() * 0.9);
      this.items.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - power * 0.25,
        life: 0,
        max: 0.45 + Math.random() * 0.5,
        size: size * (0.5 + Math.random()),
        color,
        type,
        rot: Math.random() * TAU
      });
    }
  }

  ring(x, y, color, radius = 40, count = 1) {
    for (let i = 0; i < count; i++) {
      this.items.push({
        x, y, vx: 0, vy: 0, life: 0, max: 0.5, size: radius, color, type: 'ring', rot: 0
      });
    }
  }

  update(dt) {
    const arr = this.items;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life += dt;
      if (p.life >= p.max) { arr.splice(i, 1); continue; }
      if (p.type === 'ring') continue;
      p.vy += 420 * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += dt * 3;
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.items) {
      const t = p.life / p.max;
      const a = 1 - t;
      if (p.type === 'ring') {
        const rr = p.size * (0.4 + t * 1.4);
        ctx.strokeStyle = hexA(p.color, 0.55 * a);
        ctx.lineWidth = Math.max(1, 4 * (1 - t));
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, TAU);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = a;
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.2);
      gr.addColorStop(0, p.color);
      gr.addColorStop(1, hexA(p.color, 0));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.2 * (0.6 + (1 - t) * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------- background */

export function makeDust(count, w, h) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.5 + Math.random() * 1.4,
      a: 0.06 + Math.random() * 0.16,
      sp: 2 + Math.random() * 8,
      ph: Math.random() * TAU
    });
  }
  return arr;
}

export function drawBackground(ctx, w, h, time, dust, theme) {
  const th = theme || THEME;
  const bgSet = th.bg || THEME.bg;
  const bg = ctx.createLinearGradient(0, 0, w * 0.3, h);
  bg.addColorStop(0, bgSet.stops[0]);
  bg.addColorStop(0.45, bgSet.stops[1]);
  bg.addColorStop(1, bgSet.stops[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // two very soft aurora pools
  for (const b of bgSet.lights) {
    const x = parseFloat(b[0]) * w;
    const y = parseFloat(b[1]) * h;
    const r = parseFloat(b[2]) * w;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${b[3]}, ${b[4]})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // a quiet star field for the deep-space theme
  if (bgSet.stars) {
    ctx.save();
    for (let i = 0; i < 46; i++) {
      const sx = ((i * 73.31) % 97) / 97 * w;
      const sy = ((i * 41.17) % 89) / 89 * h;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.55 + i * 1.7));
      const sr = 0.4 + ((i * 13) % 7) * 0.16;
      ctx.fillStyle = `rgba(${bgSet.dust}, ${(bgSet.dustAlpha * 0.30 * tw).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // soft light falloff behind the play area (no hard vertical edges)
  const col = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.72);
  col.addColorStop(0, `rgba(${bgSet.column}, 0.045)`);
  col.addColorStop(0.55, `rgba(${bgSet.column}, 0.018)`);
  col.addColorStop(1, `rgba(${bgSet.column}, 0)`);
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, w, h);

  // dust motes
  if (dust) {
    ctx.save();
    for (const d of dust) {
      const y = (d.y - time * d.sp) % h;
      const yy = y < 0 ? y + h : y;
      const tw = 0.6 + 0.4 * Math.sin(time * 0.9 + d.ph);
      ctx.fillStyle = `rgba(${bgSet.dust}, ${(d.a * tw * (bgSet.dustAlpha || 1)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(d.x, yy, d.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // floor warmth
  const fl = ctx.createLinearGradient(0, h * 0.86, 0, h);
  fl.addColorStop(0, `rgba(${bgSet.floor}, 0)`);
  fl.addColorStop(1, `rgba(${bgSet.floor}, 0.07)`);
  ctx.fillStyle = fl;
  ctx.fillRect(0, h * 0.86, w, h * 0.14);

  // soft side walls: gives the play field a quiet container feel
  const side = 30;
  const sl = ctx.createLinearGradient(0, 0, side, 0);
  sl.addColorStop(0, `rgba(${bgSet.wall}, 0.55)`);
  sl.addColorStop(1, `rgba(${bgSet.wall}, 0)`);
  ctx.fillStyle = sl;
  ctx.fillRect(0, 0, side, h);
  const sr = ctx.createLinearGradient(w, 0, w - side, 0);
  sr.addColorStop(0, `rgba(${bgSet.wall}, 0.55)`);
  sr.addColorStop(1, `rgba(${bgSet.wall}, 0)`);
  ctx.fillStyle = sr;
  ctx.fillRect(w - side, 0, side, h);
}

/* ------------------------------------------------------------------ color */

export function hexA(hex, alpha) {
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Draw a small standalone gem into any 2D context (used by the next preview).
 *  Pass `theme` to draw it in another theme's palette (shop previews). */
export function drawGemIcon(ctx, tier, x, y, r, time = 0, alpha = 1, theme = null) {
  const prevTheme = THEME;
  const prevPalette = PALETTE;
  if (theme) {
    THEME = theme;
    PALETTE = buildGemPalette(theme);
  }
  const fake = { x, y, r, tier, angle: 0 };
  drawGem(ctx, fake, time, { halo: false, shadow: false, alpha });
  if (theme) {
    THEME = prevTheme;
    PALETTE = prevPalette;
  }
}

/** Unmet gem: the same silhouette, drained of colour, behind a lock. */
export function drawGemSilhouette(ctx, tier, x, y, r, alpha = 1) {
  const info = tierOf(tier);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  gemShapePath(ctx, info.shape, r);
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, 'rgba(196, 212, 238, 0.13)');
  g.addColorStop(1, 'rgba(196, 212, 238, 0.05)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(198, 214, 240, 0.20)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // a tiny lock at a size that still reads at 24px
  const s = Math.max(5, r * 0.34);
  ctx.globalAlpha = alpha * 0.6;
  ctx.strokeStyle = 'rgba(214, 228, 250, 0.55)';
  ctx.lineWidth = Math.max(1, s * 0.16);
  ctx.beginPath();
  ctx.arc(0, -s * 0.28, s * 0.34, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = 'rgba(214, 228, 250, 0.42)';
  ctx.beginPath();
  ctx.roundRect(-s * 0.52, -s * 0.28, s * 1.04, s * 0.86, s * 0.18);
  ctx.fill();
  ctx.restore();
}

/** A compact theme preview: its background wash plus three of its gems. */
export function drawThemeSwatch(ctx, w, h, theme, time = 0) {
  const th = theme || THEME;
  const saved = THEME;
  THEME = th;
  ctx.save();
  const bg = ctx.createLinearGradient(0, 0, w * 0.4, h);
  bg.addColorStop(0, th.bg.stops[0]);
  bg.addColorStop(0.5, th.bg.stops[1]);
  bg.addColorStop(1, th.bg.stops[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  for (const b of th.bg.lights) {
    const x = parseFloat(b[0]) * w;
    const y = parseFloat(b[1]) * h;
    const r = Math.max(w, h) * parseFloat(b[2]) * 0.9;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${b[3]}, ${b[4]})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  const prevPalette = PALETTE;
  PALETTE = buildGemPalette(th);
  const cy = h * 0.56;
  const r1 = Math.min(h * 0.24, w * 0.16);
  ctx.globalAlpha = 0.55;
  drawGem(ctx, { x: w * 0.19, y: cy + 1, r: r1 * 0.8, tier: 2, angle: 0.2 }, time, { halo: false, shadow: false });
  ctx.globalAlpha = 1;
  drawGem(ctx, { x: w * 0.46, y: cy, r: r1, tier: 5, angle: -0.1 }, time, { halo: false, shadow: false });
  ctx.globalAlpha = 0.8;
  drawGem(ctx, { x: w * 0.76, y: cy + 1, r: r1 * 0.9, tier: 8, angle: 0.15 }, time, { halo: false, shadow: false });
  PALETTE = prevPalette;
  THEME = saved;
  ctx.restore();
}

export { DESIGN_WIDTH };
