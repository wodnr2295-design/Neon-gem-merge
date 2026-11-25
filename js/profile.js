/* Neon Gem Merge — the player's saved profile.
 * Star coins, run count, owned/equipped themes and booster packs, all in
 * localStorage. Views subscribe to `on()` so the coin pills stay in sync
 * wherever they are shown.
 */

import { STORAGE, ECONOMY } from './config.js';
import { THEMES, DEFAULT_THEME_ID, themeById } from './themes.js';

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch (e) { return fallback; }
};

const write = (key, value) => {
  try { localStorage.setItem(key, String(value)); } catch (e) { /* private mode */ }
};

const readJSON = (key, fallback) => {
  const raw = read(key, null);
  if (raw === null) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
};

export class Profile {
  constructor() {
    const storedCoins = read(STORAGE.coins, null);
    this.fresh = storedCoins === null;
    this.coins = Number(storedCoins ?? ECONOMY.welcome) || 0;
    if (this.fresh) write(STORAGE.coins, this.coins);

    this.plays = Number(read(STORAGE.plays, '0')) || 0;
    this.owned = new Set(
      (readJSON(STORAGE.themes, []) || []).filter((id) => THEMES.some((th) => th.id === id))
    );
    this.owned.add(DEFAULT_THEME_ID);
    this.themeId = themeById(read(STORAGE.theme, DEFAULT_THEME_ID)).id;
    if (!this.owned.has(this.themeId)) this.themeId = DEFAULT_THEME_ID;
    const packs = readJSON(STORAGE.packs, {}) || {};
    this.packs = {
      bomb: Math.max(0, Number(packs.bomb) || 0),
      swap: Math.max(0, Number(packs.swap) || 0)
    };
    this._subs = [];
  }

  on(fn) {
    this._subs.push(fn);
    return () => {
      const i = this._subs.indexOf(fn);
      if (i >= 0) this._subs.splice(i, 1);
    };
  }

  _changed(kind) {
    for (const fn of this._subs) {
      try { fn(this, kind); } catch (e) { /* a broken view must not stop the game */ }
    }
  }

  /* ---- coins ---- */
  addCoins(n) {
    const amount = Math.floor(Number(n) || 0);
    if (amount <= 0) return this.coins;
    this.coins += amount;
    write(STORAGE.coins, this.coins);
    this._changed('coins');
    return this.coins;
  }

  spend(n) {
    const amount = Math.floor(Number(n) || 0);
    if (amount <= 0) return true;
    if (this.coins < amount) return false;
    this.coins -= amount;
    write(STORAGE.coins, this.coins);
    this._changed('coins');
    return true;
  }

  /* ---- runs ---- */
  recordRun() {
    this.plays += 1;
    write(STORAGE.plays, this.plays);
    this._changed('plays');
    return this.plays;
  }

  /* ---- themes ---- */
  ownsTheme(id) {
    return this.owned.has(id);
  }

  buyTheme(id) {
    const th = themeById(id);
    if (this.owned.has(th.id)) return false;
    if (th.price > 0 && !this.spend(th.price)) return false;
    this.owned.add(th.id);
    write(STORAGE.themes, JSON.stringify(Array.from(this.owned)));
    this.equipTheme(th.id);
    this._changed('themes');
    return true;
  }

  equipTheme(id) {
    if (!this.owned.has(id)) return false;
    this.themeId = id;
    write(STORAGE.theme, id);
    this._changed('theme');
    return true;
  }

  theme() {
    return themeById(this.themeId);
  }

  /* ---- booster packs (spent at the start of the next run) ---- */
  addPack(kind, count = ECONOMY.boosterPackSize) {
    if (kind !== 'bomb' && kind !== 'swap') return;
    this.packs[kind] = Math.max(0, this.packs[kind] + count);
    write(STORAGE.packs, JSON.stringify(this.packs));
    this._changed('packs');
  }

  takePacks() {
    const taken = { ...this.packs };
    this.packs = { bomb: 0, swap: 0 };
    write(STORAGE.packs, JSON.stringify(this.packs));
    this._changed('packs');
    return taken;
  }
}

export { THEMES };
