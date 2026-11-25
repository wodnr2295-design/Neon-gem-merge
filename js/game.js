/* Neon Gem Merge — game logic.
 * Owns the physics world, merge chain, boosters, revive, scoring and rendering.
 */

import {
  DESIGN_WIDTH, PHYSICS, PLAY, TIERS, MAX_TIER, tierOf, mergeScore, STORAGE, ECONOMY
} from './config.js';
import { PhysicsWorld, CircleBody } from './physics.js';
import { drawGem, drawGemIcon, Particles, makeDust, drawBackground, hexA, setTheme, getTheme } from './render.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export class Game {
  constructor(opts = {}) {
    this.canvas = opts.canvas;
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.audio = opts.audio ?? null;
    this.i18n = opts.i18n ?? ((k) => k);
    this.profile = opts.profile ?? null;
    this.reducedMotion = false;
    this.on = {
      score: opts.onScore || (() => {}),
      state: opts.onState || (() => {}),
      next: opts.onNext || (() => {}),
      boosters: opts.onBoosters || (() => {}),
      codex: opts.onCodex || (() => {}),
      danger: opts.onDanger || (() => {}),
      toast: opts.onToast || (() => {}),
      combo: opts.onCombo || (() => {}),
      coins: opts.onCoins || (() => {})
    };

    this.theme = getTheme();
    this.coinsRun = 0;

    this.scale = 1;
    this.cssW = 360;
    this.cssH = 600;
    this.worldH = 600;

    this.world = new PhysicsWorld({
      width: DESIGN_WIDTH,
      height: this.worldH,
      gravity: PHYSICS.gravity,
      substeps: PHYSICS.substeps,
      maxSubstep: PHYSICS.maxSubstep,
      iterations: PHYSICS.iterations,
      restThreshold: PHYSICS.restThreshold,
      slop: PHYSICS.slop,
      correction: PHYSICS.correction,
      airDrag: PHYSICS.airDrag,
      spinDrag: PHYSICS.spinDrag,
      maxSpeed: PHYSICS.maxSpeed,
      cell: PHYSICS.cell
    });

    this.particles = new Particles(460);
    this.dust = [];
    this.texts = [];

    this.state = 'idle';
    this.score = 0;
    this.best = this._loadNumber(STORAGE.best);
    this.newRecord = false;
    this.visible = true;
    this.codex = new Set(this._loadJSON(STORAGE.codex, [1]));
    this.combo = 0;
    this.lastMergeAt = -10;
    this.elapsed = 0;
    this.dangerLevel = 0;
    this.shake = 0;
    this.graceTimer = 0;
    this.dropCooldown = 0;
    this.bombMode = false;
    this.reviveUsed = false;
    this.startTime = performance.now();
    this.lastFrame = 0;
    this.acc = 0;
    this.running = false;
    this.aim = { active: false, x: DESIGN_WIDTH / 2, pointerId: null };
    this.pendingDrop = null;
    this.currentTier = 1;
    this.nextTier = 1;
    this.boosters = { bomb: 1, swap: 1 };
    this.metrics = { frames: 0, steps: 0, lastFrameMs: 0, peakGems: 0 };
    this._listeners = [];

    this.reset(true, { keepPacks: true });
    this.bindInput();
    this.bindLifecycle();
  }

  /* ------------------------------------------------------------- storage */
  _loadNumber(key) {
    try { return Number(localStorage.getItem(key)) || 0; } catch (e) { return 0; }
  }
  _loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  _save(key, value) {
    try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  /* --------------------------------------------------------------- setup */
  bindLifecycle() {
    this._onVisibility = () => {
      if (document.hidden && this.state === 'playing') this.pause(true);
    };
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  bindInput() {
    const c = this.canvas;
    const toWorld = (ev) => {
      const rect = c.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * DESIGN_WIDTH;
      const y = ((ev.clientY - rect.top) / rect.height) * this.worldH;
      return { x, y };
    };

    const down = (ev) => {
      if (this.state !== 'playing' && this.state !== 'idle') return;
      const p = toWorld(ev);
      if (this.bombMode) {
        this._bombAt(p.x, p.y);
        return;
      }
      if (this.dropCooldown > 0 || this.state === 'idle') {
        // still allow aiming during cooldown, but not dropping
      }
      this.aim.active = true;
      this.aim.pointerId = ev.pointerId;
      this.aim.x = this._clampAim(p.x);
      c.setPointerCapture?.(ev.pointerId);
      ev.preventDefault();
    };
    const move = (ev) => {
      if (!this.aim.active) return;
      const p = toWorld(ev);
      this.aim.x = this._clampAim(p.x);
      ev.preventDefault();
    };
    const up = (ev) => {
      if (!this.aim.active) return;
      this.aim.active = false;
      c.releasePointerCapture?.(ev.pointerId);
      if (this.state === 'idle') this.state = 'playing';
      if (this.dropCooldown <= 0 && this.state === 'playing') {
        this.drop();
      } else if (this.state === 'playing') {
        // buffer the tap so quick play never loses an input
        this.pendingDrop = this.aim.x;
      }
      ev.preventDefault();
    };
    const cancel = () => { this.aim.active = false; };

    c.addEventListener('pointerdown', down, { passive: false });
    c.addEventListener('pointermove', move, { passive: false });
    c.addEventListener('pointerup', up, { passive: false });
    c.addEventListener('pointercancel', cancel);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    this._listeners.push(() => {
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', cancel);
    });

    this._onKey = (ev) => {
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        if (this.state !== 'playing' && this.state !== 'idle') return;
        this.aim.active = true;
        this.aim.x = this._clampAim(this.aim.x + (ev.key === 'ArrowLeft' ? -14 : 14));
        ev.preventDefault();
      } else if (ev.key === ' ' || ev.key === 'Enter') {
        if (this.state === 'idle') this.state = 'playing';
        if (this.state === 'playing' && this.dropCooldown <= 0) this.drop();
        ev.preventDefault();
      }
    };
    window.addEventListener('keydown', this._onKey);
    this._listeners.push(() => window.removeEventListener('keydown', this._onKey));
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    for (const fn of this._listeners) fn();
    this._listeners.length = 0;
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  resize(cssW, cssH, dpr = 1) {
    if (!cssW || !cssH) return;
    this.cssW = cssW;
    this.cssH = cssH;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.dpr = dpr;
    this.scale = cssW / DESIGN_WIDTH;
    this.worldH = cssH / this.scale;
    this.world.width = DESIGN_WIDTH;
    // small floor inset so resting gems never touch the dock edge
    this.world.height = Math.max(240, this.worldH - 10);
    this.dust = makeDust(Math.round((cssW * cssH) / 9000), DESIGN_WIDTH, this.worldH);
    // keep bodies inside the resized world
    for (const b of this.world.bodies) {
      b.x = clamp(b.x, b.r, DESIGN_WIDTH - b.r);
      b.y = Math.min(b.y, this.world.height - b.r);
    }
  }

  /* --------------------------------------------------------------- state */
  reset(silent = false, options = {}) {
    this.world.clear();
    this.world.gravity = PHYSICS.gravity;
    this.particles.clear();
    this.texts.length = 0;
    this.score = 0;
    this.combo = 0;
    this.lastMergeAt = -10;
    this.newRecord = false;
    this.reviveUsed = false;
    this.graceTimer = 0;
    this.dropCooldown = 0;
    this.bombMode = false;
    this.elapsed = 0;
    this.dangerLevel = 0;
    this.shake = 0;
    this.state = 'idle';
    this.pendingDrop = null;
    this.coinsRun = 0;
    const packs = this.profile && !options.keepPacks ? this.profile.takePacks() : { bomb: 0, swap: 0 };
    this.boosters.bomb = 1 + (packs.bomb || 0);
    this.boosters.swap = 1 + (packs.swap || 0);
    this.pendingPacks = packs;
    this.currentTier = this.randomTier();
    this.nextTier = this.randomTier();
    this.aim.x = DESIGN_WIDTH / 2;
    this.aim.active = false;
    this.on.score(this.score, this.best);
    this.on.next(this.currentTier, this.nextTier);
    this.on.boosters(this.boosters);
    this.on.danger(0);
    this.on.coins(this.coinsRun, 0);
    if (!silent) this.on.state('idle');
  }

  /* ------------------------------------------------------------------ coins */

  _earnCoins(n) {
    const amount = Math.floor(n || 0);
    if (amount <= 0) return;
    this.coinsRun += amount;
    if (this.profile) this.profile.addCoins(amount);
    this.on.coins(this.coinsRun, amount);
  }

  /* ------------------------------------------------------------------ theme */

  setTheme(id) {
    this.theme = setTheme(id);
    return this.theme;
  }

  /** Leave the run without recording a score and return to the lobby. */
  toLobby() {
    this.reset(true, { keepPacks: true });
    this.state = 'idle';
    this.on.state('idle', { toLobby: true });
  }

  setVisible(visible) {
    this.visible = !!visible;
  }

  randomTier() {
    const weights = PLAY.tierWeights;
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return PLAY.startingTiers[i];
    }
    return PLAY.startingTiers[0];
  }

  startFromTutorial() {
    if (this.state === 'idle') this.state = 'playing';
    this.on.state(this.state);
  }

  restart() {
    this.reset();
    this.state = 'playing';
    this.lastFrame = performance.now();
    this.on.state('playing', { restart: true });
  }

  pause(auto = false) {
    if (this.state !== 'playing' && this.state !== 'idle') return;
    this._prevState = this.state;
    this.state = 'paused';
    this.aim.active = false;
    this.pendingDrop = null;
    this.on.state('paused', { auto });
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this._prevState || 'playing';
    this.lastFrame = performance.now();
    this.on.state(this.state);
  }

  gameOver() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.aim.active = false;
    this.pendingDrop = null;
    this.newRecord = this.score > this.best;
    if (this.newRecord) {
      this.best = this.score;
      this._save(STORAGE.best, String(this.best));
    }
    this.audio?.gameOver();
    this.on.state('over', {
      score: this.score,
      best: this.best,
      newRecord: this.newRecord,
      canRevive: !this.reviveUsed
    });
    this.on.score(this.score, this.best);
  }

  /* ---------------------------------------------------------------- drop */
  _clampAim(x) {
    const info = tierOf(this.currentTier);
    const pad = info.r + 3;
    return clamp(x, pad, DESIGN_WIDTH - pad);
  }

  drop() {
    if (this.state !== 'playing' || this.dropCooldown > 0) return;
    const info = tierOf(this.currentTier);
    const x = this._clampAim(this.aim.x);
    const body = new CircleBody({
      x, y: Math.min(PLAY.spawnY, this.worldH * 0.2),
      r: info.r,
      tier: this.currentTier
    });
    body.restitution = 0.06 + Math.random() * 0.03;
    body.friction = 0.55;
    body.angle = (Math.random() - 0.5) * 0.6;
    body.omega = (Math.random() - 0.5) * 1.2;
    this.world.add(body);
    body.spawnAt = this.elapsed;
    this.dropCooldown = PLAY.dropCooldown;
    this.audio?.drop();
    this.currentTier = this.nextTier;
    this.nextTier = this.randomTier();
    this.on.next(this.currentTier, this.nextTier);
    this.aim.x = this._clampAim(this.aim.x);
    this.metrics.peakGems = Math.max(this.metrics.peakGems, this.world.count);
  }

  /* ----------------------------------------------------------- attractions */
  _burstAt(x, y, tier, big = false) {
    const info = tierOf(tier);
    const n = big ? 34 : 14 + Math.min(14, tier * 2);
    this.particles.burst(x, y, info.c1, n, big ? 340 : 190 + tier * 8, big ? 4.4 : 2.6, 'dot');
    this.particles.burst(x, y, info.c2, Math.ceil(n * 0.6), big ? 260 : 150, big ? 3.2 : 2, 'dot');
    if (tier >= 5 || big) this.particles.ring(x, y, info.rim, info.r * (big ? 1.8 : 1.2));
    this.shake = Math.min(14, this.shake + (big ? 10 : 2 + tier * 0.7));
  }

  _floatText(x, y, text, color, size = 16, weight = 700, key = null) {
    if (key) {
      const ex = this.texts.find((t) => t.key === key);
      if (ex) {
        ex.text = text;
        ex.x = x; ex.y = y;
        ex.life = 0;
        return ex;
      }
    }
    // stack simultaneous texts so burst messages never print on top of each other
    const recent = this.texts.filter((t) => t.life < 0.32 && !t.key && Math.abs(t.x - x) < 70).length;
    const item = {
      x, y: y - recent * (size * 0.72), text, color, size, weight, key,
      life: 0, max: 1.0, vy: -46
    };
    this.texts.push(item);
    return item;
  }

  _scorePulse(x, y, pts, size) {
    const t = this.texts.find((tx) => tx.key === 'score');
    if (t && t.life < 0.5) {
      t.value += pts;
      t.text = '+' + t.value;
      t.x = x; t.y = y;
      t.life = 0;
      return;
    }
    const item = this._floatText(x, y, '+' + pts, '#F7FAFF', size, 700, 'score');
    item.value = pts;
  }

  mergePair(a, b) {
    if (!a.alive || !b.alive) return;
    this.world.remove(a);
    this.world.remove(b);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const now = this.elapsed;
    this.combo = now - this.lastMergeAt < 0.9 ? this.combo + 1 : 1;
    this.lastMergeAt = now;
    const mult = Math.min(this.combo, 5);

    if (a.tier >= MAX_TIER) {
      const pts = 1500 * mult;
      this.score += pts;
      this._earnCoins(ECONOMY.cosmicCoin);
      this._burstAt(mx, my, MAX_TIER, true);
      this.particles.ring(mx, my, '#FFFFFF', 130, 2);
      this._scorePulse(mx, my - 10, pts, 20);
      this._floatText(mx, my + 28, this.i18n('cosmicPop'), '#E8E2FF', 12.5, 600);
      this.audio?.merge(MAX_TIER, Math.min(this.combo, 5));
      this.shake = 16;
    } else {
      const level = a.tier + 1;
      const info = tierOf(level);
      const body = new CircleBody({
        x: mx, y: my, r: info.r, tier: level,
        angle: Math.atan2(b.y - a.y, b.x - a.x)
      });
      body.vx = (a.vx + b.vx) * 0.22;
      body.vy = (a.vy + b.vy) * 0.22 - 30;
      body.omega = (Math.random() - 0.5) * 1.5;
      body.spawnAt = this.elapsed;
      body.pop = 0;
      this.world.add(body);
      const pts = mergeScore(level) * mult;
      this.score += pts;
      this._scorePulse(mx, my - info.r * 0.55, pts, Math.min(19, 12 + level * 0.7));
      this._burstAt(mx, my, level);
      this.audio?.merge(level, this.combo);
      if (this.combo >= 2) {
        this._floatText(mx, my + info.r * 0.4, `${Math.min(this.combo, 9)}x COMBO`, '#FFE3AE', 12.5, 800, 'combo');
        this.on.combo(Math.min(this.combo, 9));
      }
      this.unlockCodex(level);
      this._earnCoins(ECONOMY.mergeCoin(level));
      this.metrics.peakGems = Math.max(this.metrics.peakGems, this.world.count);
    }
    this.on.score(this.score, this.best);
  }

  unlockCodex(level) {
    if (this.codex.has(level)) return;
    this.codex.add(level);
    this._save(STORAGE.codex, Array.from(this.codex));
    this.on.codex(level, Array.from(this.codex));
    const info = tierOf(level);
    this.on.toast(this.i18n('newGem') + ': ' + this.i18n('gem' + level), info.c1);
    this.audio?.newGem(level);
  }

  /* ------------------------------------------------------------- boosters */
  useBomb() {
    if (this.state !== 'playing' && this.state !== 'idle') return false;
    if (this.boosters.bomb <= 0) return false;
    if (this.world.count === 0) {
      this.on.toast(this.i18n('noGems'), '#FFE9B8');
      return 'empty';
    }
    this.bombMode = !this.bombMode;
    this.on.boosters(this.boosters, { bombMode: this.bombMode });
    return true;
  }

  _bombAt(x, y) {
    let hit = null, bestD = Infinity;
    for (const b of this.world.bodies) {
      const d = Math.hypot(b.x - x, b.y - y) - b.r;
      if (d < bestD) { bestD = d; hit = b; }
    }
    if (!hit || bestD > 26) return;
    const info = tierOf(hit.tier);
    this.world.remove(hit);
    this.world.wakeAll();
    this._burstAt(hit.x, hit.y, hit.tier, true);
    this.particles.burst(hit.x, hit.y, info.c2, 26, 300, 3.4);
    this._floatText(hit.x, hit.y - 10, this.i18n('removed'), '#FFD9E2', 13, 600);
    this.audio?.bomb();
    this.bombMode = false;
    this.boosters.bomb = Math.max(0, this.boosters.bomb - 1);
    this.on.boosters(this.boosters, { bombMode: false });
  }

  swapGem() {
    if (this.state !== 'playing' && this.state !== 'idle') return false;
    if (this.boosters.swap <= 0) return false;
    if (this.dropCooldown > 0) return false;
    let t = this.randomTier();
    let guard = 0;
    while (t === this.currentTier && guard++ < 8) t = this.randomTier();
    this.currentTier = t;
    this.aim.x = this._clampAim(this.aim.x);
    this.boosters.swap = Math.max(0, this.boosters.swap - 1);
    this.audio?.swap();
    this.particles.ring(this.aim.x, Math.min(PLAY.spawnY, this.worldH * 0.2), tierOf(t).c1, 34);
    this.on.next(this.currentTier, this.nextTier);
    this.on.boosters(this.boosters, { bombMode: false });
    return true;
  }

  refillBooster(kind) {
    if (kind === 'bomb') this.boosters.bomb += 1;
    if (kind === 'swap') this.boosters.swap += 1;
    this.on.boosters(this.boosters);
  }

  /* --------------------------------------------------------------- revive */
  revive() {
    if (!this.reviveUsed && this.state === 'over') {
      this.reviveUsed = true;
      const bodies = this.world.bodies.slice();
      if (bodies.length) {
        bodies.sort((p, q) => (p.y - p.r) - (q.y - q.r));
        const topEdge = bodies[0].y - bodies[0].r;
        // clear the top "three rows" (a row is roughly one gem tall)
        const cut = topEdge + 3 * 42;
        let victims = bodies.filter((b) => b.y - b.r <= cut).slice(0, 18);
        if (victims.length < 3) {
          victims = bodies.slice(0, Math.min(3, bodies.length));
        }
        for (const b of victims) {
          this._burstAt(b.x, b.y, b.tier);
          this.world.remove(b);
        }
      }
      for (const b of this.world.bodies) { b.overTime = 0; b.wake(); }
      this.graceTimer = PLAY.reviveInvuln;
      this.dangerLevel = 0;
      this.on.danger(0);
      this.state = 'playing';
      this.audio?.revive();
      this.on.state('playing', { revived: true });
      this.lastFrame = performance.now();
      this.on.boosters(this.boosters);
      return true;
    }
    return false;
  }

  /* ----------------------------------------------------------------- loop */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    const frame = (now) => {
      if (!this.running) return;
      const raw = (now - this.lastFrame) / 1000;
      this.lastFrame = now;
      const dt = clamp(raw, 0, 1 / 20);
      this.metrics.frames++;
      if (!this.visible) {
        this._raf = requestAnimationFrame(frame);
        return;
      }
      const t0 = performance.now();
      this.update(dt);
      this.render(now);
      this.metrics.lastFrameMs = performance.now() - t0;
      this._raf = requestAnimationFrame(frame);
    };
    this._raf = requestAnimationFrame(frame);
  }

  update(dt) {
    this.elapsed += dt;
    this.particles.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 42);
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const tx = this.texts[i];
      tx.life += dt;
      tx.y += tx.vy * dt;
      tx.vy *= 0.94;
      if (tx.life > tx.max) this.texts.splice(i, 1);
    }
    if (this.dropCooldown > 0) this.dropCooldown = Math.max(0, this.dropCooldown - dt);
    if (this.dropCooldown <= 0 && this.pendingDrop !== null && this.state === 'playing') {
      this.aim.x = this.pendingDrop;
      this.pendingDrop = null;
      this.drop();
    }
    if (this.graceTimer > 0) this.graceTimer = Math.max(0, this.graceTimer - dt);

    if (this.state === 'paused' || this.state === 'over') return;

    this.world.step(dt);
    this.metrics.steps++;

    // merges reported by the solver
    const merges = this.world.mergeCandidates;
    if (merges.length) {
      const done = new Set();
      for (const [a, b] of merges) {
        if (!a.alive || !b.alive || done.has(a.id) || done.has(b.id)) continue;
        if (a.tier !== b.tier) continue;
        done.add(a.id); done.add(b.id);
        this.mergePair(a, b);
      }
    }

    // impact sounds (throttled)
    if (this.audio) {
      const impacts = this.world.impacts;
      let loud = 0;
      for (const im of impacts) if (im.speed > loud) loud = im.speed;
      if (loud > 140 || Math.random() < 0.25) {
        if (loud > 90) this.audio.bounce(loud, impacts[0]?.a?.tier ?? 1);
      }
    }

    // overflow / danger timer
    let maxOver = 0;
    if (this.graceTimer <= 0) {
      for (const b of this.world.bodies) {
        if (b.age < PLAY.overflowGrace) continue;
        const overLine = b.y - b.r < PLAY.dangerY;
        if (overLine && b.speed < PLAY.dangerSpeed) {
          b.overTime += dt;
        } else {
          b.overTime = Math.max(0, b.overTime - dt * 2.2);
        }
        if (b.overTime > maxOver) maxOver = b.overTime;
      }
    }
    const level = clamp(maxOver / PLAY.overflowLimit, 0, 1);
    if (Math.abs(level - this.dangerLevel) > 0.02) {
      this.dangerLevel = level;
      this.on.danger(level);
    }
    if (maxOver >= PLAY.overflowLimit) this.gameOver();
  }

  render(now) {
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    const w = DESIGN_WIDTH;
    const h = this.worldH;
    const sx = (this.canvas.width / dpr) / this.scale;
    ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const time = (now - this.startTime) / 1000;
    drawBackground(ctx, w, h, time, this.dust, this.theme);

    // shake
    let ox = 0, oy = 0;
    if (this.shake > 0.2) {
      ox = (Math.random() - 0.5) * this.shake;
      oy = (Math.random() - 0.5) * this.shake;
    }
    ctx.save();
    ctx.translate(ox, oy);

    this.drawVessel(ctx, w);
    this.drawGround(ctx, w);
    this.drawDangerLine(ctx, w);

    // guide + ghost (behind gems so it reads as "below")
    if ((this.state === 'playing' || this.state === 'idle') && this.aim.active && !this.bombMode) {
      this.drawGuide(ctx);
    }

    // gems
    const bodies = this.world.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      let scale = 1;
      if (b.spawnAt !== undefined) {
        const age = this.elapsed - b.spawnAt;
        if (age < 0.34) scale = clamp(easeOutBack(clamp(age / 0.34, 0, 1)), 0.05, 1.25);
        if (b.pop !== undefined) {
          const pa = clamp((this.elapsed - (b.spawnAt || 0)) / 0.3, 0, 1);
          scale *= 1 + 0.12 * (1 - pa) * Math.sin(pa * Math.PI);
        }
      }
      drawGem(ctx, b, time, { scale });
    }

    // aiming gem at the top
    if ((this.state === 'playing' || this.state === 'idle') && !this.bombMode) {
      const info = tierOf(this.currentTier);
      const y = Math.min(PLAY.spawnY, this.worldH * 0.2);
      const bob = Math.sin(time * 2.4) * 1.6;
      drawGem(ctx, { x: this.aim.x, y: y + bob, r: info.r, tier: this.currentTier, angle: Math.sin(time) * 0.08 }, time, {
        alpha: this.dropCooldown > 0 ? 0.45 : 1,
        shadow: false
      });
      // faint tether
      if (this.aim.active) {
        ctx.save();
        ctx.strokeStyle = hexA(info.glow, 0.22);
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 7]);
        ctx.beginPath();
        ctx.moveTo(this.aim.x, y + info.r);
        ctx.lineTo(this.aim.x, this.worldH);
        ctx.stroke();
        ctx.restore();
      }
    }

    this.particles.draw(ctx);

    // floating text
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.life / t.max;
      const a = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = `${t.weight} ${t.size}px "NGM Sans", Pretendard, "Noto Sans KR", -apple-system, "Apple SD Gothic Neo", system-ui, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.shadowColor = 'rgba(5,9,16,0.8)';
      ctx.shadowBlur = 8;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();

    if (this.bombMode) {
      ctx.save();
      ctx.fillStyle = 'rgba(12, 18, 30, 0.28)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    ctx.restore();
  }

  /** A barely-there glass vessel so the play area reads as a container. */
  drawVessel(ctx, w) {
    const h = this.world.height;
    const r = 16;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0.5, 0);
    ctx.lineTo(w - 0.5, 0);
    ctx.lineTo(w - 0.5, h - r);
    ctx.quadraticCurveTo(w - 0.5, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0.5, h, 0.5, h - r);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.010)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.024)');
    g.addColorStop(1, 'rgba(255,255,255,0.045)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  drawGround(ctx, w) {
    const y = this.world.height;
    const g = ctx.createLinearGradient(0, y - 34, 0, y);
    g.addColorStop(0, 'rgba(160, 190, 235, 0)');
    g.addColorStop(1, 'rgba(160, 190, 235, 0.055)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 34, w, 34);
    const line = ctx.createLinearGradient(0, 0, w, 0);
    line.addColorStop(0, 'rgba(255,255,255,0)');
    line.addColorStop(0.18, 'rgba(255,255,255,0.09)');
    line.addColorStop(0.82, 'rgba(255,255,255,0.09)');
    line.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }

  drawDangerLine(ctx, w) {
    const y = PLAY.dangerY;
    const lvl = this.dangerLevel;
    ctx.save();
    const g = ctx.createLinearGradient(0, y - 18, 0, y + 10);
    g.addColorStop(0, 'rgba(255, 170, 190, 0)');
    g.addColorStop(1, 'rgba(255, 170, 190,' + (0.05 + lvl * 0.16) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 18, w, 28);

    ctx.setLineDash([6, 7]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255, 190, 205,' + (0.2 + lvl * 0.34) + ')';
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(w - 10, y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (lvl > 0.02) {
      ctx.strokeStyle = 'rgba(255, 205, 215,' + (0.3 + lvl * 0.4) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(10 + (w - 20) * clamp(lvl, 0, 1), y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawGuide(ctx) {
    const info = tierOf(this.currentTier);
    const startY = Math.min(PLAY.spawnY, this.worldH * 0.2);
    const landY = this.world.predictLanding(this.aim.x, info.r, startY + info.r * 0.5);
    const y = Math.min(landY, this.worldH - info.r);
    ctx.save();
    // dashed drop line
    ctx.strokeStyle = hexA(info.c1, 0.38);
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 9]);
    ctx.beginPath();
    ctx.moveTo(this.aim.x, startY + info.r + 4);
    ctx.lineTo(this.aim.x, Math.max(startY + info.r + 6, y - info.r));
    ctx.stroke();
    ctx.setLineDash([]);

    // landing ghost
    ctx.strokeStyle = hexA(info.c1, 0.55);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(this.aim.x, y, info.r + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = hexA(info.c1, 0.10);
    ctx.fill();

    // small crosshair at the aim x
    ctx.strokeStyle = hexA(info.c1, 0.7);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(this.aim.x - 6, y);
    ctx.lineTo(this.aim.x + 6, y);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------------------------------------------------------- debug */
  debugAddGem(x, y, tier = 1) {
    const info = tierOf(tier);
    const b = new CircleBody({ x, y, r: info.r, tier });
    b.spawnAt = this.elapsed - 1;
    this.world.add(b);
    this.metrics.peakGems = Math.max(this.metrics.peakGems, this.world.count);
    return b;
  }

  debugForceOverflow(seconds = 2.6) {
    let top = null;
    for (const b of this.world.bodies) {
      if (!top || b.y - b.r < top.y - top.r) top = b;
    }
    if (!top) return false;
    for (const b of this.world.bodies) b.overTime = 0;
    // place the topmost gem just over the line, centred, so the rule fires visually
    top.x = DESIGN_WIDTH / 2;
    top.y = Math.min(top.y, PLAY.dangerY + top.r * 0.55);
    top.vx = 0;
    top.vy = 0;
    top.age = 10;
    top.overTime = seconds;
    return true;
  }

  debugSnapshot() {
    return {
      state: this.state,
      score: this.score,
      best: this.best,
      combo: this.combo,
      gems: this.world.count,
      danger: this.dangerLevel,
      dropCooldown: this.dropCooldown,
      boosters: { ...this.boosters },
      bombMode: this.bombMode,
      reviveUsed: this.reviveUsed,
      currentTier: this.currentTier,
      nextTier: this.nextTier,
      codex: Array.from(this.codex),
      coinsRun: this.coinsRun,
      particles: this.particles.items.length,
      metrics: { ...this.metrics },
      diag: this.world.diagnose()
    };
  }
}

export { DESIGN_WIDTH, TIERS };
