/* Neon Gem Merge — bootstrap and UI controller. */

import { Game } from './game.js';
import { AudioEngine } from './audio.js';
import { AdBridge } from './admob-bridge.js';
import { detectLang, createI18n, applyStaticText } from './i18n.js';
import { STORAGE, TIERS, tierOf, DESIGN_WIDTH } from './config.js';
import { drawGemIcon } from './render.js';

const params = new URLSearchParams(location.search);
const TEST = params.get('test') === '1';
const FAST = TEST || params.get('fast') === '1';

const t = createI18n(detectLang());
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
const btnPause = $('btn-pause');
const btnBomb = $('btn-bomb');
const btnSwap = $('btn-swap');
const bombCount = $('bomb-count');
const swapCount = $('swap-count');

const audio = new AudioEngine();
let pendingTier = 1;
let soundOn = true;
try { soundOn = localStorage.getItem(STORAGE.sound) !== '0'; } catch (e) { /* ignore */ }
audio.setEnabled(soundOn);

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
  onScore: (score, best) => {
    scoreEl.textContent = format(score);
    bestEl.textContent = format(best);
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
  onCombo: (n) => {
    if (n >= 3) srLive.textContent = `${n}x combo`;
  }
});

window.__NGM__ = { game, bridge, audio, version: '1.0.0', t };

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
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1900);
}

function showGameOver(info) {
  $('final-score').textContent = format(info.score);
  $('final-best').textContent = format(info.best);
  $('record-pill').hidden = !info.newRecord;
  $('btn-revive').hidden = !info.canRevive;
  overOverlay.hidden = false;
  srLive.textContent = `${t('gameOver')} ${info.score}`;
}

/* sound */

function setSound(on) {
  soundOn = on;
  audio.setEnabled(on);
  btnSound.setAttribute('aria-pressed', on ? 'true' : 'false');
  btnSound.setAttribute('aria-label', on ? t('soundOff') : t('soundOn'));
  try { localStorage.setItem(STORAGE.sound, on ? '1' : '0'); } catch (e) { /* ignore */ }
}
setSound(soundOn);

btnSound.addEventListener('click', () => {
  audio.unlock();
  setSound(!soundOn);
  if (soundOn) audio.ui();
});

/* tutorial */

function tutorialDone() {
  try { return localStorage.getItem(STORAGE.tutorial) === '1'; } catch (e) { return TEST; }
}

function openTutorial() {
  tutorial.hidden = false;
  drawTutorialArt();
}

$('btn-start').addEventListener('click', () => {
  audio.unlock();
  try { localStorage.setItem(STORAGE.tutorial, '1'); } catch (e) { /* ignore */ }
  tutorial.hidden = true;
  game.startFromTutorial();
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
  game.restart();
  audio.ui();
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
  game.restart();
  audio.ui();
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
  game.start();
  doResize();
  pendingTier = game.currentTier;
  renderNext();
  renderBoosters(game.boosters);
  if (!tutorialDone()) openTutorial();
  if (TEST) tutorial.hidden = true;

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
  restart: () => game.restart()
};
