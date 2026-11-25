/* Neon Gem Merge — gem codex and how-to-play.
 * Every tier drawn by the same Canvas routine the board uses, so what the
 * player sees here is exactly the gem they will meet in the game. Gems that
 * have not been merged yet stay a grey silhouette behind a small lock.
 */

import { TIERS, mergeScore, tierOf } from './config.js';
import { drawGemIcon, drawGemSilhouette } from './render.js';

export class Codex {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('codex-screen');
    this.grid = document.getElementById('codex-grid');
    this.progress = document.getElementById('codex-progress');
    this.note = document.getElementById('codex-note');
    this.bind();
  }

  bind() {
    document.getElementById('codex-back').addEventListener('click', () => this.app.closePanel());
  }

  show() {
    this.root.hidden = false;
    this.render();
  }

  hide() {
    this.root.hidden = true;
  }

  refresh() {
    if (this.root.hidden) return;
    this.render();
  }

  render() {
    const t = this.app.t;
    const found = this.app.game.codex;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const size = 58;

    this.grid.innerHTML = TIERS.map((info) => {
      const on = found.has(info.tier);
      const name = on ? t('gem' + info.tier) : '???';
      const score = info.tier === 1
        ? t('baseGem')
        : `+${mergeScore(info.tier)} ${t('points')}`;
      return `
        <article class="gem-card${on ? ' on' : ' locked'}" data-tier="${info.tier}">
          <canvas width="${Math.round(size * dpr)}" height="${Math.round(size * dpr)}" style="width:${size}px;height:${size}px" data-gem="${info.tier}"></canvas>
          <span class="gem-lv">Lv.${info.tier}</span>
          <b class="gem-name">${name}</b>
          <small class="gem-score">${score}</small>
        </article>`;
    }).join('');

    for (const canvas of this.grid.querySelectorAll('[data-gem]')) {
      const tier = Number(canvas.dataset.gem);
      const on = found.has(tier);
      const ctx = canvas.getContext('2d');
      const s = canvas.width / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, s, s);
      const r = Math.max(13, Math.min(s * 0.33, 6 + tierOf(tier).r * 0.36));
      if (on) {
        drawGemIcon(ctx, tier, s / 2, s / 2 - 2, r, 1.2, 1);
      } else {
        drawGemSilhouette(ctx, tier, s / 2, s / 2 - 2, r, 1);
      }
    }

    const count = found.size;
    this.progress.textContent = `${count} / ${TIERS.length}`;
    this.note.textContent = count >= TIERS.length ? t('codexComplete') : t('lockedGem');
    this.note.classList.toggle('all', count >= TIERS.length);
  }
}
