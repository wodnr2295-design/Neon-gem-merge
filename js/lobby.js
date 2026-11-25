/* Neon Gem Merge — main lobby screen.
 * A living title screen: the equipped theme paints the room, a handful of its
 * gems drift around the logo, and three larger gems rest on a glass shelf as a
 * live preview of the equipped theme.
 */

import { drawBackground, drawGem, drawGemIcon, drawGemSilhouette, makeDust, getTheme, hexA } from './render.js';
import { TIERS } from './config.js';

const FLOATERS = [
  { tier: 7, ang: 199, mul: 1.02, r: 19, ph: 0.0, spin: 0.30 },
  { tier: 4, ang: -24, mul: 0.98, r: 15, ph: 1.9, spin: -0.24 },
  { tier: 9, ang: 22, mul: 1.0, r: 21, ph: 3.4, spin: 0.18 },
  { tier: 5, ang: 158, mul: 1.0, r: 17, ph: 4.7, spin: -0.22 }
];

const SHOWCASE = [
  { tier: 5, x: 0.212, rk: 0.30, ph: 0.4 },
  { tier: 7, x: 0.5, rk: 0.40, ph: 2.1 },
  { tier: 9, x: 0.788, rk: 0.32, ph: 3.9 }
];

export class Lobby {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('lobby');
    this.canvas = document.getElementById('lobby-art');
    this.ctx = this.canvas.getContext('2d');
    this.visible = false;
    this.raf = 0;
    this.time = 0;
    this.last = 0;
    this.dust = [];
    this.w = 360;
    this.h = 640;
    this.reduced = false;
    try {
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { /* older browsers */ }
    this.el = {
      coins: document.getElementById('lobby-coin-value'),
      best: document.getElementById('lobby-best'),
      plays: document.getElementById('lobby-plays'),
      codex: document.getElementById('lobby-codex'),
      chip: document.getElementById('theme-chip'),
      chipName: document.getElementById('theme-chip-name'),
      shopSub: document.getElementById('tab-shop-sub'),
      codexSub: document.getElementById('tab-codex-sub'),
      logoA: document.getElementById('logo-a'),
      logoB: document.getElementById('logo-b'),
      langButtons: Array.from(document.querySelectorAll('.lang-seg [data-lang]'))
    };
    this.bind();
  }

  bind() {
    document.getElementById('btn-play').addEventListener('click', () => this.app.onPlay());
    document.getElementById('tab-shop').addEventListener('click', () => this.app.openScreen('shop'));
    document.getElementById('tab-codex').addEventListener('click', () => this.app.openScreen('codex'));
    document.getElementById('btn-lobby-sound').addEventListener('click', () => this.app.toggleSound());
    for (const btn of this.el.langButtons) {
      btn.addEventListener('click', () => this.app.setLang(btn.dataset.lang));
    }
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(() => {
        if (this.visible) this.resize();
      });
      this._ro.observe(this.root);
      const sc = document.getElementById('lobby-showcase');
      if (sc) this._ro.observe(sc);
    } else {
      window.addEventListener('resize', () => this.visible && this.resize());
    }
  }

  resize() {
    const rect = this.root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.dpr = dpr;
    const hero = this.root.querySelector('.lobby-hero');
    if (hero) {
      const hr = hero.getBoundingClientRect();
      const lr = this.root.getBoundingClientRect();
      this.heroTop = hr.top - lr.top;
      this.heroH = hr.height;
    } else {
      this.heroTop = rect.height * 0.12;
      this.heroH = rect.height * 0.6;
    }
    this.measure();
    this.resizeShowcase();
    const count = Math.round((rect.width * rect.height) / 12000);
    if (!this.dust.length || Math.abs(this.dust.length - count) > 8) {
      this.dust = makeDust(count, rect.width, rect.height);
    }
    if (this.reduced || !this.running) this.draw();
  }

  measure() {
    const lr = this.root.getBoundingClientRect();
    const logo = document.getElementById('lobby-title');
    const chip = this.el.chip;
    if (logo) {
      const g = logo.getBoundingClientRect();
      this.logoTop = g.top - lr.top;
      this.logoH = g.height;
    }
    if (chip) {
      const c = chip.getBoundingClientRect();
      this.chipTop = c.top - lr.top;
    }
    // one scale for every decorative gem so small phones stay composed
    this.k = Math.max(0.62, Math.min(1, this.w / 390, this.h / 780));
  }

  show() {
    this.root.hidden = false;
    this.visible = true;
    this.refresh();
    this.resize();
    this.start();
  }

  hide() {
    this.visible = false;
    this.root.hidden = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.running = false;
  }

  /** Keep the lobby on screen but stop burning frames while a panel covers it. */
  pauseLoop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resumeLoop() {
    if (this.visible) this.start();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    if (this.reduced) {
      this.time = 1.4;
      this.draw();
      return;
    }
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    if (!w || !h) return;
    const dpr = this.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const theme = getTheme();
    const time = this.time;
    drawBackground(ctx, w, h, time, this.dust, theme);

    // a wide halo behind the logo, tinted by the equipped theme
    const heroTop = this.heroTop ?? h * 0.12;
    const heroH = this.heroH || h * 0.6;
    const k = this.k || 1;
    const logoTop = this.logoTop ?? heroTop + heroH * 0.18;
    const logoH = this.logoH || 96;
    const hy = logoTop + logoH * 0.4;
    const halo = ctx.createRadialGradient(w * 0.5, hy, 0, w * 0.5, hy, w * 0.86);
    halo.addColorStop(0, theme.ui[0]);
    halo.addColorStop(0.45, theme.ui[1]);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    // a single quiet orbit around the wordmark
    const cx = w * 0.5;
    const cy = logoTop + logoH * 0.5;
    const tilt = -0.10;
    const rx = w * 0.345;
    const ry = Math.max(34, logoH * 0.72);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = hexA(theme.gems ? theme.gems[8] : '#C9BFFF', 0.22);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, -2.5, -1.25);
    ctx.stroke();
    ctx.restore();

    // floating gems riding that orbit
    for (let i = 0; i < FLOATERS.length; i++) {
      const f = FLOATERS[i];
      const a = (f.ang * Math.PI) / 180 + tilt;
      const bob = Math.sin(time * 0.85 + f.ph) * 4.5;
      const scale = 1 + Math.sin(time * 0.7 + f.ph) * 0.04;
      const x = Math.max(24, Math.min(w - 24, cx + Math.cos(a) * rx * f.mul));
      const y = cy + Math.sin(a) * ry * f.mul + bob;
      ctx.save();
      ctx.globalAlpha = 0.95;
      drawGem(ctx, {
        x, y, r: f.r * scale * k, tier: f.tier,
        angle: Math.sin(time * f.spin + f.ph) * 0.22
      }, time, { shadow: false });
      ctx.restore();
    }

    this.drawShowcase();

    // edge vignette so the type always reads
    const vg = ctx.createRadialGradient(w * 0.5, h * 0.46, w * 0.28, w * 0.5, h * 0.46, w * 1.05);
    vg.addColorStop(0, 'rgba(3,6,12,0)');
    vg.addColorStop(1, 'rgba(3,6,12,0.62)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  resizeShowcase() {
    const c = document.getElementById('lobby-showcase');
    if (!c) return;
    this.showcaseEl = c;
    const rect = c.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    this.showW = rect.width;
    this.showH = rect.height;
    this.showDpr = dpr;
  }

  /** Three larger gems of the equipped theme, drifting in the open band. */
  drawShowcase() {
    const c = this.showcaseEl;
    if (!c || !this.showW) return;
    const ctx = c.getContext('2d');
    const w = this.showW;
    const h = this.showH;
    const dpr = this.showDpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const time = this.time;
    const theme = getTheme();
    const midY = h * 0.55;

    // a faint pool of light under the trio
    const pool = ctx.createRadialGradient(w * 0.5, midY + h * 0.22, 0, w * 0.5, midY + h * 0.22, w * 0.42);
    pool.addColorStop(0, theme.ui[0].replace(/[\d.]+\)$/, '0.10)'));
    pool.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, w, h);

    const k = this.k || 1;
    const base = Math.max(14, Math.min(42, h * 0.32, w * 0.125) * Math.max(0.78, k));
    for (const s of SHOWCASE) {
      const bob = Math.sin(time * 0.95 + s.ph) * 6;
      const r = base * (0.80 + s.rk * 0.52);
      const x = w * s.x;
      const y = midY + Math.sin(s.ph) * h * 0.05 + bob;
      ctx.save();
      ctx.globalAlpha = 0.97;
      drawGem(ctx, {
        x, y, r, tier: s.tier,
        angle: Math.sin(time * 0.3 + s.ph) * 0.14
      }, time, { shadow: false });
      ctx.restore();
    }
  }

  refresh() {
    const { profile, game, t } = this.app;
    const coins = this.app.format(profile.coins);
    this.el.coins.textContent = coins;
    this.el.best.textContent = this.app.format(game.best);
    this.el.plays.textContent = this.app.format(profile.plays);
    const found = game.codex.size;
    this.el.codex.textContent = `${found}/${TIERS.length}`;
    this.el.codexSub.textContent = `${found} / ${TIERS.length}`;

    const th = profile.theme();
    const name = t.lang === 'ko' ? th.ko : th.en;
    this.el.chipName.textContent = name;
    this.el.shopSub.textContent = name;
    this.el.logoA.textContent = t.lang === 'ko' ? '네온 젬' : 'NEON GEM';
    this.el.logoB.textContent = t.lang === 'ko' ? '머지' : 'MERGE';

    for (const btn of this.el.langButtons) {
      btn.classList.toggle('on', btn.dataset.lang === t.lang);
      btn.setAttribute('aria-pressed', btn.dataset.lang === t.lang ? 'true' : 'false');
    }
    this.measure();
    this.resizeShowcase();
    if (this.reduced) this.draw();
  }
}
