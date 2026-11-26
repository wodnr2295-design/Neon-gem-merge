/* Neon Gem Merge — bootstrap and UI controller. */

import { Game } from './game.js';
import { AudioEngine } from './audio.js';
import { AdBridge } from './admob-bridge.js';
import { detectLang, createI18n, applyStaticText } from './i18n.js';
import { STORAGE, TIERS, tierOf, ECONOMY } from './config.js';
import { drawGemIcon, setTheme as setRenderTheme } from './render.js';
import { Profile } from './profile.js';
import { themeById } from './themes.js';
import { Lobby } from './lobby.js';
import { Shop } from './shop.js';
import { Codex } from './codex.js';

const params = new URLSearchParams(location.search);
const TEST = params.get('test') === '1';
const FAST = TEST || params.get('fast') === '1';

const readLS = (key, fallback = null) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e) { return fallback; }
};
const writeLS = (key, value) => {
  try { localStorage.setItem(key, String(value)); } catch (e) { /* private mode */ }
};

let t = createI18n(detectLang(readLS(STORAGE.lang)));
applyStaticText(t);

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const canvas = $('game');
const scoreEl = $('score');
const bestEl = $('best');
const codexCanvas = $('codex');
const nextCanvas = $('next-canvas');
const toastEl = $('toast');
const srLive = $('sr-live');

const tutorial = $('tutorial');
const pauseOverlay = $('pause');
const overOverlay = $('over');
const adOverlay = $('ad');

const btnSound = $('btn-sound');
const btnLobbySound = $('btn-lobby-sound');
const btnPause = $('btn-pause');
const btnBomb = $('btn-bomb');
const btnSwap = $('btn-swap');
const bombCount = $('bomb-count');
const swapCount = $('swap-count');
const hudCoinValue = $('hud-coin-value');

const audio = new AudioEngine();
let pendingTier = 1;
let soundOn = true;
soundOn = readLS(STORAGE.sound) !== '0';
audio.setEnabled(soundOn);

const profile = new Profile();
setRenderTheme(profile.themeId);

/* ------------------------------------------------------------------ ads */

const bridge = new AdBridge({
  isTesting: true,
  mock: (placement) => runSimulatedAd(placement)
});

let adBusy = false;
let adRaf = 0;

function runSimulatedAd() {
  if (adBusy) return Promise.resolve(false);
  adBusy = true;
  const bar = $('ad-bar');
  const claim = $('btn-claim');
  const closeBtn = $('btn-ad-close');
  const title = $('ad-title');
  const demo = $('ad-demo');

  demo.textContent = bridge.platform === 'web' ? (t.lang === 'ko' ? '데모 광고' : 'demo ad') : '';
  title.textContent = t('adPlaying');
  bar.style.width = '0%';
  claim.disabled = true;
  claim.hidden = false;
  closeBtn.hidden = true;
  adOverlay.hidden = false;

  const duration = FAST ? 420 : 3200;
  const start = performance.now();

  return new Promise((resolve) => {
    const finish = (ok) => {
      cancelAnimationFrame(adRaf);
      adOverlay.hidden = true;
      adBusy = false;
      claim.removeEventListener('click', onClaim);
      closeBtn.removeEventListener('click', onClose);
      resolve(ok);
    };
    const onClaim = () => { audio.reward(); finish(true); };
    const onClose = () => finish(false);
    claim.addEventListener('click', onClaim);
    closeBtn.addEventListener('click', onClose);

    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / duration);
      bar.style.width = (k * 100).toFixed(1) + '%';
      if (k >= 1) {
        title.textContent = t('adReady');
        claim.disabled = false;
        closeBtn.hidden = false;
        return;
      }
      adRaf = requestAnimationFrame(tick);
    };
    adRaf = requestAnimationFrame(tick);
  });
}

async function requestAd(placement) {
  const wasPlaying = game.state === 'playing';
  if (wasPlaying) game.pause(true);
  const res = await bridge.showRewarded(placement);
  if (wasPlaying && game.state === 'paused') game.resume();
  return !!res.rewarded;
}

/* ----------------------------------------------------------------- game */

const game = new Game({
  canvas,
  audio,
  i18n: t,
  profile,
  onScore: (score, best) => {
    scoreEl.textContent = format(score);
    bestEl.textContent = format(Math.max(score, best));
    scoreEl.classList.remove('bump');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('bump');
  },
  onState: (state, info) => {
    if (state === 'playing') {
      overOverlay.hidden = true;
      pauseOverlay.hidden = true;
      tutorial.hidden = true;
    } else if (state === 'paused') {
      if (!info?.auto) pauseOverlay.hidden = false;
    } else if (state === 'over') {
      showGameOver(info);
    } else if (state === 'idle' && info?.toLobby) {
      pauseOverlay.hidden = true;
      overOverlay.hidden = true;
      goLobby();
    }
  },
  onNext: (cur) => { pendingTier = cur; renderNext(); },
  onBoosters: (b, extra) => renderBoosters(b, extra),
  onCodex: () => {
    drawCodex();
    const wrap = $('codex-wrap');
    wrap.classList.remove('pop');
    void wrap.offsetWidth;
    wrap.classList.add('pop');
  },
  onDanger: (level) => {
    stage.style.setProperty('--danger', String(level));
  },
  onToast: (msg) => showToast(msg),
  onCoins: (run, delta) => {
    refreshCoins();
    if (delta > 0) {
      hudCoinValue.classList.remove('bump');
      void hudCoinValue.offsetWidth;
      hudCoinValue.classList.add('bump');
    }
  },
  onCombo: (n) => {
    if (n >= 3) srLive.textContent = `${n}x combo`;
  }
});

/* ------------------------------------------------------------- screens */

const lobby = new Lobby(appApi());
const shop = new Shop(appApi());
const codex = new Codex(appApi());

/* The api object is built after the views so that each view receives the same
 * live getters; it only ever calls back into functions defined below. */
function appApi() {
  return {
    get t() { return t; },
    profile,
    game,
    audio,
    format: (n) => format(n),
    showToast: (msg) => showToast(msg),
    onPlay: () => play(),
    openScreen: (which) => openPanel(which),
    closePanel: () => closePanel(),
    requestAd: (placement) => requestAd(placement),
    applyTheme: (id) => applyTheme(id),
    toggleSound: () => toggleSound(),
    setLang: (lang) => setLang(lang),
    refreshViews: () => refreshViews()
  };
}

let screen = 'lobby';

function play() {
  audio.unlock();
  setScreen('game');
  if (!tutorialDone()) {
    openTutorial();
  } else {
    startRun();
  }
}

function startRun() {
  runRecorded = false;
  game.restart();
}

let runRecorded = false;

function setScreen(name) {
  screen = name;
  if (name === 'game') {
    lobby.hide();
    shop.hide();
    codex.hide();
    game.setVisible(true);
    scheduleResize();
    return;
  }
  game.setVisible(false);
  if (name === 'lobby') {
    shop.hide();
    codex.hide();
    lobby.show();
  } else {
    lobby.show();
    lobby.pauseLoop();
    if (name === 'shop') { codex.hide(); shop.show(); }
    else { shop.hide(); codex.show(); }
  }
}

function openPanel(which) {
  audio.ui();
  setScreen(which);
}

function closePanel() {
  audio.ui();
  setScreen('lobby');
}

function goLobby() {
  setScreen('lobby');
}

function refreshCoins() {
  const text = format(profile.coins);
  const hud = $('hud-coin-value');
  if (hud) hud.textContent = text;
}

function refreshViews() {
  refreshCoins();
  if (screen === 'lobby') lobby.refresh();
  if (screen === 'shop') shop.refresh();
  if (screen === 'codex') codex.refresh();
  drawCodex();
  renderNext();
}

function applyTheme(id) {
  const th = themeById(id);
  game.setTheme(th.id);
  const frame = $('frame');
  frame.style.setProperty('--theme-glow-1', th.ui[0]);
  frame.style.setProperty('--theme-glow-2', th.ui[1]);
  document.body.dataset.theme = th.id;
  lobby.refresh();
  if (screen === 'codex') codex.refresh();
  if (screen === 'shop') shop.render();
}

/* ------------------------------------------------------------- language */

function setLang(lang) {
  if (lang !== 'ko' && lang !== 'en') return;
  writeLS(STORAGE.lang, lang);
  t = createI18n(lang);
  applyStaticText(t);
  game.i18n = t;
  audio.ui();
  lobby.refresh();
  shop.render();
  codex.refresh();
  drawTutorialArt();
  drawCodex();
  renderNext();
  syncSoundButtons();
  if (screen === 'lobby') lobby.refresh();
}

/* ------------------------------------------------------------------ init */

function init() {
  applyTheme(profile.themeId);
  profile.on((p, kind) => {
    refreshCoins();
    if (kind === 'coins' || kind === 'packs' || kind === 'themes' || kind === 'theme' || kind === 'plays') {
      if (screen === 'lobby') lobby.refresh();
      if (kind === 'packs' && screen === 'shop') shop.refresh();
    }
  });
  if (TEST) {
    lobby.hide();
    game.setVisible(true);
  } else {
    setScreen('lobby');
  }
}

window.__NGM__ = {
  game, bridge, audio, profile, lobby, shop, codex,
  version: '1.2.0',
  get t() { return t; },
  setLang, applyTheme, setScreen
};

/* ------------------------------------------------------------ utilities */

function format(n) {
  return (n || 0).toLocaleString(t.lang === 'ko' ? 'ko-KR' : 'en-US');
}

/* ------------------------------------------------------------ sizing/art */

let resizeRaf = 0;
function scheduleResize() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    doResize();
  });
}

function doResize() {
  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  game.resize(rect.width, rect.height, dpr);
  drawCodex();
  renderNext();
  drawTutorialArt();
}

if (window.ResizeObserver) {
  new ResizeObserver(scheduleResize).observe(stage);
} else {
  window.addEventListener('resize', scheduleResize);
}
window.addEventListener('orientationchange', () => setTimeout(scheduleResize, 120));

function drawCodex() {
  const rect = codexCanvas.getBoundingClientRect();
  if (!rect.width) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  codexCanvas.width = Math.round(rect.width * dpr);
  codexCanvas.height = Math.round(rect.height * dpr);
  const ctx = codexCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  const n = TIERS.length;
  const pad = 14;
  const gap = (rect.width - pad * 2) / (n - 1);
  const cy = rect.height / 2 + 0.5;
  const time = performance.now() / 1000;

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, cy);
  ctx.lineTo(rect.width - pad, cy);
  ctx.stroke();

  const unlocked = game.codex;
  for (let i = 0; i < n; i++) {
    const tier = i + 1;
    const x = pad + gap * i;
    const r = Math.min(10, gap * 0.42);
    const isOn = unlocked.has(tier);
    if (isOn) {
      drawGemIcon(ctx, tier, x, cy, r, time, 1);
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.arc(x, cy + r + 3.4, 0.9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(214, 228, 250, 0.16)';
      ctx.arc(x, cy, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function renderNext() {
  const rect = nextCanvas.getBoundingClientRect();
  if (!rect.width) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  nextCanvas.width = Math.round(rect.width * dpr);
  nextCanvas.height = Math.round(rect.height * dpr);
  const ctx = nextCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  const tier = pendingTier || 1;
  const r = Math.min(rect.width * 0.38, 7 + tier * 1.0);
  drawGemIcon(ctx, tier, rect.width / 2 + 0.5, rect.height / 2 + 0.5, r, performance.now() / 1000);
}

function drawTutorialArt() {
  const c = $('tut-art');
  const rect = c.getBoundingClientRect();
  if (!rect.width) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  c.width = Math.round(rect.width * dpr);
  c.height = Math.round(rect.height * dpr);
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  const h = rect.height;
  const cy = h / 2 - 2;
  const r = Math.min(14, h * 0.22);
  const time = performance.now() / 1000;
  drawGemIcon(ctx, 1, 44, cy, r, time);
  drawGemIcon(ctx, 1, 44 + r * 2 + 6, cy, r, time);
  ctx.strokeStyle = 'rgba(210, 224, 250, 0.35)';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  const ax = 44 + r * 2 + 6 + r + 12;
  ctx.beginPath();
  ctx.moveTo(ax, cy);
  ctx.lineTo(ax + 16, cy);
  ctx.moveTo(ax + 10, cy - 5);
  ctx.lineTo(ax + 16, cy);
  ctx.lineTo(ax + 10, cy + 5);
  ctx.stroke();
  drawGemIcon(ctx, 2, ax + 34 + r, cy, r * 1.15, time);
}

/* ------------------------------------------------------------ UI wiring */

function renderBoosters(b, extra = {}) {
  bombCount.textContent = b.bomb > 0 ? String(b.bomb) : t('adTag');
  swapCount.textContent = b.swap > 0 ? String(b.swap) : t('adTag');
  btnBomb.classList.toggle('needs-ad', b.bomb <= 0);
  btnSwap.classList.toggle('needs-ad', b.swap <= 0);
  btnBomb.classList.toggle('active', !!extra.bombMode);
  btnBomb.setAttribute('aria-label', `${t('bomb')} · ${b.bomb > 0 ? b.bomb : t('adTag')}`);
  btnSwap.setAttribute('aria-label', `${t('swap')} · ${b.swap > 0 ? b.swap : t('adTag')}`);
  if (extra.bombMode) showToast(t('bombTip'));
}

let toastTimer = 0;
function showToast(msg, color) {
  if (!msg) return;
  toastEl.textContent = msg;
  if (color) toastEl.style.color = color;
  else toastEl.style.color = '';
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1900);
}

function showGameOver(info) {
  $('final-score').textContent = format(info.score);
  $('final-best').textContent = format(info.best);
  $('record-pill').hidden = !info.newRecord;
  $('btn-revive').hidden = !info.canRevive;
  let earned = game.coinsRun;
  if (!runRecorded) {
    runRecorded = true;
    profile.recordRun();
    const bonus = ECONOMY.runBonus(info.score);
    if (bonus > 0) {
      profile.addCoins(bonus);
      earned += bonus;
    }
    refreshCoins();
    if (screen === 'lobby') lobby.refresh();
  }
  const runCoins = $('run-coins');
  runCoins.hidden = earned <= 0;
  $('run-coins-value').textContent = '+' + format(earned);
  overOverlay.hidden = false;
  srLive.textContent = `${t('gameOver')} ${info.score}`;
}

/* sound */

function syncSoundButtons() {
  for (const btn of [btnSound, btnLobbySound]) {
    if (!btn) continue;
    btn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    btn.setAttribute('aria-label', soundOn ? t('soundOff') : t('soundOn'));
  }
}

function setSound(on) {
  soundOn = on;
  audio.setEnabled(on);
  writeLS(STORAGE.sound, on ? '1' : '0');
  syncSoundButtons();
}

function toggleSound() {
  audio.unlock();
  setSound(!soundOn);
  if (soundOn) audio.ui();
}

btnSound.addEventListener('click', toggleSound);

/* tutorial */

function tutorialDone() {
  if (TEST) return true;
  try { return localStorage.getItem(STORAGE.tutorial) === '1'; } catch (e) { return false; }
}

function openTutorial() {
  tutorial.hidden = false;
  drawTutorialArt();
}

$('btn-start').addEventListener('click', () => {
  audio.unlock();
  writeLS(STORAGE.tutorial, '1');
  tutorial.hidden = true;
  startRun();
  audio.ui();
});

/* pause */

btnPause.addEventListener('click', () => {
  if (game.state === 'paused') {
    game.resume();
  } else {
    game.pause(false);
  }
  audio.ui();
});

$('btn-resume').addEventListener('click', () => {
  game.resume();
  audio.ui();
});

$('btn-restart').addEventListener('click', () => {
  pauseOverlay.hidden = true;
  overOverlay.hidden = true;
  startRun();
  audio.ui();
});

$('btn-to-lobby').addEventListener('click', () => {
  audio.ui();
  game.toLobby();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!pauseOverlay.hidden) game.resume();
    else if (game.state === 'playing') game.pause(false);
  }
});

/* game over */

$('btn-again').addEventListener('click', () => {
  overOverlay.hidden = true;
  startRun();
  audio.ui();
});

$('btn-over-lobby').addEventListener('click', () => {
  audio.ui();
  game.toLobby();
});

$('btn-revive').addEventListener('click', async () => {
  const btn = $('btn-revive');
  btn.disabled = true;
  const ok = await requestAd('revive');
  btn.disabled = false;
  if (ok) {
    overOverlay.hidden = true;
    game.revive();
  } else {
    showToast(t('adFail'));
  }
});

/* boosters */

btnBomb.addEventListener('click', async () => {
  if (adBusy) return;
  audio.unlock();
  if (game.state === 'over' || game.state === 'paused') return;
  if (game.boosters.bomb > 0) {
    game.useBomb();
    return;
  }
  const ok = await requestAd('bomb');
  if (ok) {
    game.refillBooster('bomb');
    showToast(t('rewardBomb'));
    game.useBomb();
  } else {
    showToast(t('adFail'));
  }
});

btnSwap.addEventListener('click', async () => {
  if (adBusy) return;
  audio.unlock();
  if (game.state === 'over' || game.state === 'paused') return;
  if (game.boosters.swap > 0) {
    game.swapGem();
    return;
  }
  const ok = await requestAd('swap');
  if (ok) {
    game.refillBooster('swap');
    showToast(t('rewardSwap'));
    game.swapGem();
  } else {
    showToast(t('adFail'));
  }
});

/* first interaction unlocks WebAudio on iOS/Android */

const unlockOnce = () => {
  audio.unlock();
  window.removeEventListener('pointerdown', unlockOnce);
  window.removeEventListener('keydown', unlockOnce);
};
window.addEventListener('pointerdown', unlockOnce);
window.addEventListener('keydown', unlockOnce);

/* ----------------------------------------------------------------- boot */

async function boot() {
  try { await document.fonts.ready; } catch (e) { /* proceed with system fonts */ }
  await bridge.init();
  if (bridge.platform !== 'web') {
    document.body.classList.add('native');
    bridge.showBanner();
  }
  init();
  syncSoundButtons();
  game.start();
  doResize();
  pendingTier = game.currentTier;
  renderNext();
  renderBoosters(game.boosters);
  refreshCoins();

  if (!TEST && profile.fresh) {
    writeLS(STORAGE.welcome, '1');
    setTimeout(() => showToast(t('welcome')), 700);
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch (e) { /* offline support is optional */ }
  }
}

boot();

window.addEventListener('error', (e) => {
  console.error('[ngm] uncaught', e.message);
});

/* test helpers used by tests/qa_browser.py */
window.__NGM_TEST__ = {
  ready: () => !!game.running,
  snapshot: () => game.debugSnapshot(),
  freeze: () => { game.running = false; cancelAnimationFrame(game._raf); },
  step: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) game.update(dt); game.render(performance.now()); },
  resume: () => { if (!game.running) game.start(); },
  dropAt: (x, tier) => {
    if (tier) game.currentTier = tier;
    game.state = 'playing';
    game.aim.x = x;
    game.dropCooldown = 0;
    game.drop();
  },
  addGem: (x, y, tier) => game.debugAddGem(x, y, tier),
  forceOverflow: (seconds = 2.6) => game.debugForceOverflow(seconds),
  setTier: (tier) => { game.currentTier = tier; game.nextTier = tier; game.on.next(tier, tier); },
  useBomb: () => game.useBomb(),
  swap: () => game.swapGem(),
  revive: () => game.revive(),
  restart: () => game.restart(),
  play: () => play(),
  lobby: () => setScreen('lobby'),
  screen: () => screen,
  coins: () => profile.coins,
  addCoins: (n) => { profile.addCoins(n); refreshCoins(); },
  equip: (id) => { profile.equipTheme(id); applyTheme(id); }
};
