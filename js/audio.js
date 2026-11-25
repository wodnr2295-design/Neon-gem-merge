/* Neon Gem Merge — procedural audio.
 * Everything is synthesised with the Web Audio API: no sample files.
 * The palette is soft marimba / glass-bell rather than arcade bleeps, to match
 * the calm indie-puzzle art direction.
 */

const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

function noteForTier(tier) {
  const i = Math.max(0, Math.min(PENTA.length - 1, tier - 1));
  return PENTA[i];
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.ready = false;
    this._noise = null;
  }

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.ready = false; return; }
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.9 : 0;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
      this._noise = this._makeNoise(1.0);
      this.ready = true;
    } catch (e) {
      this.ready = false;
    }
  }

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, t, 0.03);
    }
  }

  _makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return buf;
  }

  _tone({ freq = 440, type = 'sine', dur = 0.3, gain = 0.15, attack = 0.004, decay = 0.9, detune = 0, pan = 0, filter = 0 }) {
    if (!this.ready || !this.enabled) return;
    const ac = this.ctx, t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.value = detune;
    let node = osc;
    if (filter) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      node.connect(f);
      node = f;
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g);
    if (p) { p.pan.value = pan; g.connect(p).connect(this.master); }
    else g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noiseBurst({ dur = 0.12, gain = 0.08, freq = 1200, q = 0.7, type = 'bandpass', pan = 0 }) {
    if (!this.ready || !this.enabled) return;
    const ac = this.ctx, t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = this._noise;
    const f = ac.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g);
    if (ac.createStereoPanner) {
      const p = ac.createStereoPanner(); p.pan.value = pan;
      g.connect(p).connect(this.master);
    } else g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  drop() {
    this._tone({ freq: 220, type: 'sine', dur: 0.16, gain: 0.11, decay: 0.7 });
    this._tone({ freq: 330, type: 'triangle', dur: 0.1, gain: 0.045 });
    this._noiseBurst({ dur: 0.08, gain: 0.035, freq: 900 });
  }

  bounce(speed = 200, tier = 1) {
    const v = Math.min(1, speed / 700);
    const f = noteForTier(Math.max(1, tier)) * 2;
    this._tone({ freq: f, type: 'sine', dur: 0.09, gain: 0.02 + v * 0.035 });
  }

  merge(tier, combo = 1) {
    const f = noteForTier(tier);
    const pan = (Math.random() - 0.5) * 0.25;
    this._tone({ freq: f, type: 'triangle', dur: 0.38, gain: 0.16, pan });
    this._tone({ freq: f * 2, type: 'sine', dur: 0.3, gain: 0.07, pan: -pan });
    this._tone({ freq: f * 1.5, type: 'sine', dur: 0.45, gain: 0.05, pan });
    if (tier >= 7) {
      this._tone({ freq: f * 3, type: 'sine', dur: 0.55, gain: 0.035, decay: 1 });
      this._noiseBurst({ dur: 0.25, gain: 0.03, freq: 3200, q: 0.9 });
    }
    if (combo >= 2) {
      const c = Math.min(combo, 5);
      for (let i = 0; i < c; i++) {
        setTimeout(() => {
          this._tone({ freq: PENTA[Math.min(PENTA.length - 1, tier + i)] * 2, type: 'sine', dur: 0.12, gain: 0.05 });
        }, i * 55);
      }
    }
  }

  bomb() {
    this._noiseBurst({ dur: 0.35, gain: 0.12, freq: 700, q: 0.5 });
    this._tone({ freq: 180, type: 'sine', dur: 0.35, gain: 0.12 });
    this._tone({ freq: 90, type: 'sine', dur: 0.5, gain: 0.1 });
  }

  swap() {
    this._tone({ freq: 520, type: 'sine', dur: 0.1, gain: 0.07 });
    setTimeout(() => this._tone({ freq: 700, type: 'sine', dur: 0.12, gain: 0.07 }), 70);
  }

  ui() {
    this._tone({ freq: 660, type: 'sine', dur: 0.06, gain: 0.045 });
  }

  reward() {
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => setTimeout(() => this._tone({ freq: f, type: 'triangle', dur: 0.18, gain: 0.06 }), i * 80));
  }

  revive() {
    [392, 523.25, 659.25, 880].forEach((f, i) => setTimeout(() => {
      this._tone({ freq: f, type: 'sine', dur: 0.35, gain: 0.08 });
    }, i * 90));
  }

  gameOver() {
    [392, 329.63, 261.63, 196].forEach((f, i) => setTimeout(() => {
      this._tone({ freq: f, type: 'sine', dur: 0.5, gain: 0.1 });
      this._tone({ freq: f * 0.5, type: 'triangle', dur: 0.5, gain: 0.045 });
    }, i * 150));
  }

  danger() {
    this._tone({ freq: 300, type: 'sine', dur: 0.12, gain: 0.05 });
  }

  newGem(tier) {
    const f = noteForTier(tier) * 2;
    this._tone({ freq: f, type: 'sine', dur: 0.2, gain: 0.05 });
  }
}
