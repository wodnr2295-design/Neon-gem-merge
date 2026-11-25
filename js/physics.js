/* Neon Gem Merge — 2D circle rigid-body physics
 * Compact, dependency-free, deterministic-friendly solver:
 *  - fixed sub-steps (>= 8 per 60 Hz frame, and never larger than 1/480 s)
 *  - positional correction with slop (stable stacked piles)
 *  - impulse resolution with restitution threshold (no endless jitter)
 *  - friction impulses with proper angular terms, so gems roll and settle
 *  - spatial hash broadphase
 *  - wall / floor containment with the same impulse rules
 *
 * Units are "world units" (design width 360). Pure JS: runs in the browser and
 * in the automated stress harness.
 */

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
let NEXT_ID = 1;

export class CircleBody {
  constructor(opts = {}) {
    this.id = NEXT_ID++;
    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    this.vx = 0;
    this.vy = 0;
    this.angle = opts.angle ?? 0;
    this.omega = 0;
    this.tier = opts.tier ?? 1;
    this.kind = opts.kind ?? 'gem';
    this.restitution = opts.restitution ?? 0.08;
    this.friction = opts.friction ?? 0.55;
    this.alive = true;
    this.overTime = 0;        // seconds spent resting over the danger line
    this.age = 0;
    this.mass = 1;
    this.invMass = 1;
    this.invInertia = 1;
    this.setRadius(opts.r ?? 14);
    this.sleeping = false;
    this.restTimer = 0;
  }

  setRadius(r) {
    this.r = r;
    // disc of uniform density: m proportional to area, I = 1/2 m r^2
    this.mass = r * r;
    this.invMass = 1 / this.mass;
    this.invInertia = 2 / (this.mass * r * r);
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  wake() {
    this.sleeping = false;
    this.restTimer = 0;
  }
}

export class PhysicsWorld {
  constructor(opts = {}) {
    this.width = opts.width ?? 360;
    this.height = opts.height ?? 600;
    this.gravity = opts.gravity ?? 1850;
    this.substeps = Math.max(8, opts.substeps ?? 8);
    this.maxSubstep = opts.maxSubstep ?? 1 / 480;
    this.iterations = Math.max(1, opts.iterations ?? 3);
    this.restThreshold = opts.restThreshold ?? 55;
    this.slop = opts.slop ?? 0.05;
    this.correction = opts.correction ?? 0.86;
    this.airDrag = opts.airDrag ?? 0.9995;
    this.spinDrag = opts.spinDrag ?? 0.992;
    this.maxSpeed = opts.maxSpeed ?? 2400;
    this.cell = opts.cell ?? 96;
    this.bodies = [];
    this.grid = new Map();
    this.pairCount = 0;
    this.mergeCandidates = [];
    this.impacts = [];
    this._seenPairs = new Set();
    this._mergeSeen = new Set();
  }

  add(body) {
    body.alive = true;
    this.bodies.push(body);
    return body;
  }

  remove(body) {
    body.alive = false;
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  clear() {
    for (const b of this.bodies) b.alive = false;
    this.bodies.length = 0;
    this.grid.clear();
  }

  get count() {
    return this.bodies.length;
  }

  wakeAll() {
    for (const b of this.bodies) b.wake();
  }

  /** Run one frame. dt in seconds (clamped). Returns merge contact pairs and impacts. */
  step(dt) {
    dt = clamp(dt || 1 / 60, 0, 1 / 30);
    this.mergeCandidates = [];
    this.impacts = [];
    this._mergeSeen.clear();

    const steps = Math.max(this.substeps, Math.ceil(dt / this.maxSubstep));
    const h = dt / steps;
    this.pairCount = 0;

    for (let s = 0; s < steps; s++) {
      this._integrate(h);
      const pairs = this._broadphase();
      for (let it = 0; it < this.iterations; it++) {
        // pair contacts (report only during the first iteration of the first substep)
        for (let p = 0; p < pairs.length; p += 2) {
          const a = pairs[p], b = pairs[p + 1];
          this._solvePair(a, b, it === 0 && s === 0);
        }
        for (let i = 0; i < this.bodies.length; i++) this._solveWalls(this.bodies[i]);
      }
    }

    for (const b of this.bodies) {
      b.age += dt;
      // gentle rolling resistance so piles come to rest instead of gliding forever
      if (b.speed < 160) {
        b.vx *= 0.99;
        b.vy *= 0.99;
      }
      b.omega *= 0.972;
      if (b.speed < 2.4) { b.vx *= 0.55; b.vy *= 0.55; }
      if (Math.abs(b.omega) < 0.05) b.omega *= 0.5;
    }

    return { merges: this.mergeCandidates, impacts: this.impacts };
  }

  _integrate(h) {
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      b.vy += this.gravity * h;
      const drag = Math.pow(this.airDrag, h * 60);
      b.vx *= drag;
      b.vy *= drag;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > this.maxSpeed) {
        const k = this.maxSpeed / sp;
        b.vx *= k;
        b.vy *= k;
      }
      b.x += b.vx * h;
      b.y += b.vy * h;
      b.angle += b.omega * h;
      b.omega = clamp(b.omega * Math.pow(this.spinDrag, h * 60), -45, 45);
    }
  }

  _hashCell(v) {
    return Math.floor(v / this.cell);
  }

  _broadphase() {
    const grid = this.grid;
    grid.clear();
    const cell = this.cell;
    for (const b of this.bodies) {
      const cx = Math.floor(b.x / cell);
      const cy = Math.floor(b.y / cell);
      const key = cx + ',' + cy;
      let arr = grid.get(key);
      if (!arr) { arr = []; grid.set(key, arr); }
      arr.push(b);
    }
    const pairs = [];
    for (const b of this.bodies) {
      const cx = Math.floor(b.x / cell);
      const cy = Math.floor(b.y / cell);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const arr = grid.get((cx + ox) + ',' + (cy + oy));
          if (!arr) continue;
          for (let k = 0; k < arr.length; k++) {
            const o = arr[k];
            if (o.id <= b.id) continue;
            const dx = o.x - b.x, dy = o.y - b.y;
            const rr = b.r + o.r;
            if (dx * dx + dy * dy < rr * rr) { pairs.push(b, o); }
          }
        }
      }
    }
    this.pairCount += pairs.length / 2;
    return pairs;
  }

  _solvePair(a, b, report) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const rr = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;

    let dist = Math.sqrt(d2);
    let nx, ny;
    if (dist < 1e-6) {
      // perfectly concentric: pick a deterministic escape direction
      nx = Math.cos(a.id * 1.7 + b.id);
      ny = Math.sin(a.id * 1.7 + b.id);
      dist = 0.001;
    } else {
      nx = dx / dist;
      ny = dy / dist;
    }
    const pen = Math.max(rr - Math.max(dist, 0), 0);
    const invSum = a.invMass + b.invMass;

    // --- positional correction -------------------------------------------------
    if (pen > this.slop) {
      const push = (pen - this.slop) * this.correction / invSum;
      a.x -= nx * push * a.invMass;
      a.y -= ny * push * a.invMass;
      b.x += nx * push * b.invMass;
      b.y += ny * push * b.invMass;
      if (pen > 0.6) { a.wake(); b.wake(); }
    }

    // --- relative velocity at the contact point --------------------------------
    const arx = nx * a.r, ary = ny * a.r;
    const brx = -nx * b.r, bry = -ny * b.r;
    const avx = a.vx - a.omega * ary;
    const avy = a.vy + a.omega * arx;
    const bvx = b.vx - b.omega * bry;
    const bvy = b.vy + b.omega * brx;
    let rvx = bvx - avx;
    let rvy = bvy - avy;
    const vn = rvx * nx + rvy * ny;

    if (vn > 0) {
      // separating: nothing to do but remember contact for merging
      this._maybeMerge(a, b, true, 0);
      return;
    }

    const speedIn = -vn;
    const e = speedIn < this.restThreshold ? 0 : (a.restitution + b.restitution) * 0.5;
    const jn = -(1 + e) * vn / invSum;

    a.vx -= jn * nx * a.invMass;
    a.vy -= jn * ny * a.invMass;
    b.vx += jn * nx * b.invMass;
    b.vy += jn * ny * b.invMass;

    // --- friction --------------------------------------------------------------
    // recompute point velocities after the normal impulse
    const avx2 = a.vx - a.omega * ary;
    const avy2 = a.vy + a.omega * arx;
    const bvx2 = b.vx - b.omega * bry;
    const bvy2 = b.vy + b.omega * brx;
    rvx = bvx2 - avx2;
    rvy = bvy2 - avy2;
    const tx = -ny, ty = nx;
    const vt = rvx * tx + rvy * ty;
    const mu = (a.friction + b.friction) * 0.5;
    const kt = invSum + a.r * a.r * a.invInertia + b.r * b.r * b.invInertia;
    let jt = -vt / kt;
    const maxT = mu * Math.abs(jn);
    jt = clamp(jt, -maxT, maxT);

    a.vx -= jt * tx * a.invMass;
    a.vy -= jt * ty * a.invMass;
    b.vx += jt * tx * b.invMass;
    b.vy += jt * ty * b.invMass;
    // torque = arm x impulse, arms are parallel to the contact normal
    a.omega -= (arx * (jt * ty) - ary * (jt * tx)) * a.invInertia;
    b.omega += (brx * (jt * ty) - bry * (jt * tx)) * b.invInertia;

    this._maybeMerge(a, b, true, speedIn);

    if (report && speedIn > 45) {
      this.impacts.push({ a, b, speed: speedIn });
    }
  }

  _maybeMerge(a, b, enable, speed) {
    if (!enable) return;
    if (a.kind !== 'gem' || b.kind !== 'gem') return;
    if (a.tier !== b.tier) return;
    const key = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
    if (this._mergeSeen.has(key)) return;
    this._mergeSeen.add(key);
    this.mergeCandidates.push([a, b, speed]);
  }

  _solveWalls(b) {
    const r = b.r;
    // left wall — outward normal (1, 0)
    if (b.x - r < 0) this._wallContact(b, 1, 0, r - b.x, 0, 1);
    // right wall — outward normal (-1, 0)
    if (b.x + r > this.width) this._wallContact(b, -1, 0, b.x + r - this.width, 0, 1);
    // floor — outward normal (0, -1)
    if (b.y + r > this.height) this._wallContact(b, 0, -1, b.y + r - this.height, 1, 0);

    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.vx) || !Number.isFinite(b.vy)) {
      b.x = this.width * 0.5;
      b.y = this.height * 0.5;
      b.vx = 0; b.vy = 0; b.omega = 0;
    }
  }

  /** Impulse contact against an immovable wall with Coulomb friction and spin. */
  _wallContact(b, nx, ny, pen, tx, ty) {
    b.x += nx * pen;
    b.y += ny * pen;
    const r = b.r, invM = b.invMass, invI = b.invInertia;
    const armx = -nx * r, army = -ny * r;

    let pvx = b.vx - b.omega * army;
    let pvy = b.vy + b.omega * armx;
    const vn = pvx * nx + pvy * ny;
    let jn = 0;
    if (vn < 0) {
      const e = -vn < this.restThreshold * 0.5 ? 0 : b.restitution;
      jn = -(1 + e) * vn / invM;
      b.vx += jn * nx * invM;
      b.vy += jn * ny * invM;
    }

    pvx = b.vx - b.omega * army;
    pvy = b.vy + b.omega * armx;
    const vt = pvx * tx + pvy * ty;
    const kt = invM + r * r * invI;
    let jt = -vt / kt;
    const maxT = b.friction * Math.abs(jn);
    jt = clamp(jt, -maxT, maxT);
    b.vx += jt * tx * invM;
    b.vy += jt * ty * invM;
    b.omega += (armx * (jt * ty) - army * (jt * tx)) * invI;
  }

  /** Lowest free centre-y for a circle of radius r dropped at x. */
  predictLanding(x, r, fromY) {
    let best = this.height - r;
    for (const g of this.bodies) {
      if (!g.alive) continue;
      const dx = Math.abs(g.x - x);
      const sum = g.r + r;
      if (dx >= sum) continue;
      const drop = Math.sqrt(Math.max(sum * sum - dx * dx, 0));
      const cy = g.y - drop;
      if (cy >= (fromY ?? -1e9) && cy < best) best = cy;
    }
    return best;
  }

  /** Static-ish body counts / diagnostics used by the QA harness. */
  diagnose() {
    let maxPen = 0, nan = 0, outside = 0, overlapping = 0;
    for (let i = 0; i < this.bodies.length; i++) {
      const a = this.bodies[i];
      if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.vx) || !Number.isFinite(a.vy)) nan++;
      if (a.x - a.r < -0.8 || a.x + a.r > this.width + 0.8 || a.y + a.r > this.height + 0.8) outside++;
      for (let j = i + 1; j < this.bodies.length; j++) {
        const b = this.bodies[j];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const pen = a.r + b.r - d;
        if (pen > 0.9) overlapping++;
        if (pen > maxPen) maxPen = pen;
      }
    }
    return { count: this.bodies.length, maxPen, nan, outside, overlapping };
  }
}
