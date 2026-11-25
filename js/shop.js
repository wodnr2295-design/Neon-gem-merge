/* Neon Gem Merge — shop screen.
 * Gem themes (with live previews drawn in that theme's own palette), booster
 * packs for the next run, and star coins from a rewarded ad.
 */

import { THEMES } from './themes.js';
import { drawThemeSwatch } from './render.js';
import { ECONOMY } from './config.js';

const BOMB_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="10.5" cy="13.6" r="5.6"/>
  <path d="M14.6 9.4l1.5-1.5M16.1 7.9c.5-.8.2-1.8-.6-2.3M17.8 9.6c.9-.2 1.4-1 1.3-1.9"/>
</svg>`;

const SWAP_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4.6 9.4A7.6 7.6 0 0 1 18 7.2"/><path d="M18 4.4v3.1h-3.1"/>
  <path d="M19.4 14.6A7.6 7.6 0 0 1 6 16.8"/><path d="M6 19.6v-3.1h3.1"/>
</svg>`;

export class Shop {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('shop');
    this.themeList = document.getElementById('theme-list');
    this.boosterList = document.getElementById('booster-shop');
    this.coinValue = document.getElementById('shop-coin-value');
    this.adBtn = document.getElementById('btn-ad-coins');
    this.adLabel = document.getElementById('ad-coin-label');
    this.adSub = document.getElementById('ad-coin-sub');
    this.adReadyAt = 0;
    this.tick = 0;
    this.bind();
  }

  bind() {
    document.getElementById('shop-back').addEventListener('click', () => this.app.closePanel());
    this.adBtn.addEventListener('click', () => this.claimAdCoins());
    this.themeList.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      const card = btn.closest('.theme-card');
      if (!card) return;
      this.onThemeAction(card.dataset.id, btn.dataset.action);
    });
    this.boosterList.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-pack]');
      if (!btn) return;
      this.buyPack(btn.dataset.pack);
    });
  }

  show() {
    this.root.hidden = false;
    this.render();
    clearInterval(this.tick);
    this.tick = setInterval(() => this.updateAdCard(), 500);
  }

  hide() {
    this.root.hidden = true;
    clearInterval(this.tick);
    this.tick = 0;
  }

  refresh() {
    if (this.root.hidden) return;
    this.render();
  }

  render() {
    const { app } = this;
    const t = app.t;
    const profile = app.profile;
    this.coinValue.textContent = app.format(profile.coins);

    /* ---- themes ---- */
    this.themeList.innerHTML = THEMES.map((th) => {
      const owned = profile.ownsTheme(th.id);
      const equipped = profile.themeId === th.id;
      const name = t.lang === 'ko' ? th.ko : th.en;
      const tag = t.lang === 'ko' ? th.tagKo : th.tagEn;
      let action = '';
      let cls = 'th-action';
      if (equipped) {
        action = `<span class="${cls} on" aria-disabled="true">${t('equipped')}</span>`;
      } else if (owned) {
        action = `<button class="${cls} equip" type="button" data-action="equip">${t('equip')}</button>`;
      } else {
        action = `<button class="${cls} buy" type="button" data-action="buy">
          <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path d="M12 2.6l2.72 5.9 6.28.82-4.6 4.4 1.16 6.3L12 16.9l-5.56 3.12 1.16-6.3-4.6-4.4 6.28-.82z" fill="currentColor"/></svg>
          <b>${th.price}</b></button>`;
      }
      return `
        <article class="theme-card${equipped ? ' equipped' : ''}" data-id="${th.id}">
          <canvas class="theme-preview" width="112" height="74" data-theme-canvas="${th.id}"></canvas>
          <div class="theme-meta">
            <b class="th-name">${name}</b>
            <small class="th-tag">${tag}</small>
          </div>
          ${action}
        </article>`;
    }).join('');

    // paint each preview with that theme's own gems
    for (const canvas of this.themeList.querySelectorAll('[data-theme-canvas]')) {
      const th = THEMES.find((x) => x.id === canvas.dataset.themeCanvas);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawThemeSwatch(ctx, canvas.width, canvas.height, th, 1.2);
    }

    /* ---- boosters ---- */
    const packs = profile.packs;
    this.boosterList.innerHTML = `
      <article class="booster-card">
        <div class="b-ico" aria-hidden="true">${BOMB_ICON}</div>
        <div class="b-meta">
          <b>${t('bomb')}</b>
          <small>${t('boosterBombDesc')}</small>
          <em>${t('packNote')}<span class="pack-count">${packs.bomb > 0 ? `${t('packPending')} ${packs.bomb}` : ''}</span></em>
        </div>
        <button class="b-buy" type="button" data-pack="bomb">
          <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path d="M12 2.6l2.72 5.9 6.28.82-4.6 4.4 1.16 6.3L12 16.9l-5.56 3.12 1.16-6.3-4.6-4.4 6.28-.82z" fill="currentColor"/></svg>
          <b>${ECONOMY.boosterPack}</b>
        </button>
      </article>
      <article class="booster-card">
        <div class="b-ico" aria-hidden="true">${SWAP_ICON}</div>
        <div class="b-meta">
          <b>${t('swap')}</b>
          <small>${t('boosterSwapDesc')}</small>
          <em>${t('packNote')}<span class="pack-count">${packs.swap > 0 ? `${t('packPending')} ${packs.swap}` : ''}</span></em>
        </div>
        <button class="b-buy" type="button" data-pack="swap">
          <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path d="M12 2.6l2.72 5.9 6.28.82-4.6 4.4 1.16 6.3L12 16.9l-5.56 3.12 1.16-6.3-4.6-4.4 6.28-.82z" fill="currentColor"/></svg>
          <b>${ECONOMY.boosterPack}</b>
        </button>
      </article>`;

    this.adLabel.textContent = t('adCoinsBtn');
    this.updateAdCard();
  }

  updateAdCard() {
    const t = this.app.t;
    const left = Math.max(0, this.adReadyAt - Date.now());
    if (left > 0) {
      this.adBtn.disabled = true;
      this.adBtn.classList.add('waiting');
      this.adLabel.textContent = t('adCoinsWait');
      this.adSub.textContent = `${Math.ceil(left / 1000)}s`;
    } else {
      this.adBtn.disabled = false;
      this.adBtn.classList.remove('waiting');
      this.adLabel.textContent = t('adCoinsBtn');
      this.adSub.textContent = t('adCoinsFree');
    }
  }

  onThemeAction(id, action) {
    const { app } = this;
    const profile = app.profile;
    if (action === 'equip') {
      if (profile.equipTheme(id)) {
        app.applyTheme(id);
        app.showToast(app.t('equippedToast'));
        this.render();
        app.refreshViews();
      }
      return;
    }
    if (action === 'buy') {
      const th = THEMES.find((x) => x.id === id);
      if (!th) return;
      if (profile.coins < th.price) {
        app.showToast(app.t('notEnough'));
        return;
      }
      if (profile.buyTheme(id)) {
        app.applyTheme(id);
        app.showToast(app.t('bought'));
        this.render();
        app.refreshViews();
        app.audio.reward();
      }
    }
  }

  buyPack(kind) {
    const { app } = this;
    if (app.profile.coins < ECONOMY.boosterPack) {
      app.showToast(app.t('notEnough'));
      return;
    }
    app.profile.spend(ECONOMY.boosterPack);
    app.profile.addPack(kind);
    app.showToast(`${app.t(kind === 'bomb' ? 'bomb' : 'swap')} +${ECONOMY.boosterPackSize}`);
    app.audio.reward();
    this.render();
    app.refreshViews();
  }

  async claimAdCoins() {
    const { app } = this;
    if (Date.now() < this.adReadyAt) return;
    const ok = await app.requestAd('coins');
    if (ok) {
      app.profile.addCoins(ECONOMY.adCoins);
      app.showToast(app.t('adCoinsToast'));
      app.audio.reward();
      this.adReadyAt = Date.now() + 12000;
      this.coinValue.textContent = app.format(app.profile.coins);
      this.updateAdCard();
      app.refreshViews();
    } else {
      app.showToast(app.t('adFail'));
    }
  }
}
