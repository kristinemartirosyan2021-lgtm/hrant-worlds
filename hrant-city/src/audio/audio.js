// All sound is synthesised with the Web Audio API (no audio files, no copyrighted music).
import { RadioStation } from './music.js';

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.volume = 0.8; this.musicVolume = 0.5;
    this.listener = { x: 0, z: 0 };
    this._hornOn = false;
  }

  /** Must be called from a user gesture (tap/click). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0; this.musicBus.connect(this.master);
    // noise buffer
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._initEngine();
    this._initSiren();
    this._initHorn();
    this.radio = new RadioStation(ctx, this.musicBus, this.noise);
  }

  setVolume(v, music) {
    this.volume = v; this.musicVolume = music;
    if (this.master) this.master.gain.value = v;
  }

  setMusic(on, level = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(on ? this.musicVolume * level : 0, t, 0.4);
    if (on) this.radio.start(); else if (level === 0) setTimeout(() => { if (this.musicBus.gain.value < 0.01) this.radio.stop(); }, 2000);
  }

  _initEngine() {
    const c = this.ctx;
    this.engOsc = c.createOscillator(); this.engOsc.type = 'sawtooth';
    this.engOsc2 = c.createOscillator(); this.engOsc2.type = 'square';
    this.engFilter = c.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 600; this.engFilter.Q.value = 3;
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    const g2 = c.createGain(); g2.gain.value = 0.35;
    this.engOsc.connect(this.engFilter); this.engOsc2.connect(g2); g2.connect(this.engFilter);
    this.engFilter.connect(this.engGain); this.engGain.connect(this.sfx);
    this.engOsc.start(); this.engOsc2.start();
    // tyre screech
    this.screech = c.createBufferSource(); this.screech.buffer = this.noise; this.screech.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 8;
    this.screechGain = c.createGain(); this.screechGain.gain.value = 0;
    this.screech.connect(bp); bp.connect(this.screechGain); this.screechGain.connect(this.sfx);
    this.screech.start();
  }

  /** rpm 0..1, load 0..1, on = engine running */
  engine(on, rpm = 0, load = 0, pitchMul = 1, drift = false, boat = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = (boat ? 40 : 48) * pitchMul + rpm * 170 * pitchMul;
    this.engOsc.frequency.setTargetAtTime(f, t, 0.05);
    this.engOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(350 + rpm * 1600 + load * 600, t, 0.08);
    this.engGain.gain.setTargetAtTime(on ? 0.09 + load * 0.08 : 0, t, 0.1);
    this.screechGain.gain.setTargetAtTime(on && drift ? 0.12 : 0, t, 0.06);
  }

  _initSiren() {
    const c = this.ctx;
    this.sirenOsc = c.createOscillator(); this.sirenOsc.type = 'square'; this.sirenOsc.frequency.value = 700;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.6;
    const lfoGain = c.createGain(); lfoGain.gain.value = 260;
    lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    this.sirenGain = c.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(f); f.connect(this.sirenGain); this.sirenGain.connect(this.sfx);
    this.sirenOsc.start(); lfo.start();
  }
  siren(level) { if (this.ctx) this.sirenGain.gain.setTargetAtTime(level * 0.05, this.ctx.currentTime, 0.2); }

  _initHorn() {
    const c = this.ctx;
    this.hornGain = c.createGain(); this.hornGain.gain.value = 0;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2000;
    for (const fr of [392, 494]) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(f); o.start(); }
    f.connect(this.hornGain); this.hornGain.connect(this.sfx);
  }
  horn(on) {
    if (!this.ctx || on === this._hornOn) return;
    this._hornOn = on;
    this.hornGain.gain.setTargetAtTime(on ? 0.12 : 0, this.ctx.currentTime, 0.015);
  }

  // ------------------------------------------------------------ one-shots
  _env(node, t, a, peak, decay) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }
  _noise(t, dur, type, freq, q, peak, decay, dest = this.sfx) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    s.connect(f); f.connect(g); g.connect(dest);
    this._env(g, t, 0.005, peak, decay);
    s.start(t, Math.random() * 0.5, dur);
    return f;
  }
  _tone(t, type, f0, f1, peak, dur, dest = this.sfx) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    o.connect(g); g.connect(dest);
    this._env(g, t, 0.005, peak, dur);
    o.start(t); o.stop(t + dur + 0.05);
  }

  playAt(name, x, z, vol = 1) {
    const d = Math.hypot(x - this.listener.x, z - this.listener.z);
    if (d > 90) return;
    this.play(name, vol * Math.max(0.05, 1 - d / 90));
  }

  play(name, vol = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'step': this._noise(t, 0.08, 'bandpass', 600 + Math.random() * 300, 1.2, 0.12 * vol, 0.07); break;
      case 'jump': this._tone(t, 'sine', 220, 440, 0.06 * vol, 0.15); break;
      case 'punch': this._noise(t, 0.12, 'lowpass', 500, 1, 0.5 * vol, 0.1); this._tone(t, 'sine', 120, 50, 0.3 * vol, 0.12); break;
      case 'hurt': this._tone(t, 'sawtooth', 300, 140, 0.08 * vol, 0.2); break;
      case 'shot': this._noise(t, 0.25, 'lowpass', 2500, 0.7, 0.6 * vol, 0.18); this._tone(t, 'square', 180, 40, 0.15 * vol, 0.08); break;
      case 'crash': this._noise(t, 0.5, 'lowpass', 900, 0.8, 0.7 * vol, 0.4); this._tone(t, 'triangle', 90, 35, 0.4 * vol, 0.25); break;
      case 'explosion': {
        this._noise(t, 1.6, 'lowpass', 700, 0.5, 1.0 * vol, 1.4);
        this._tone(t, 'sine', 80, 25, 0.8 * vol, 1.0);
        break;
      }
      case 'splash': this._noise(t, 0.6, 'bandpass', 1200, 0.6, 0.35 * vol, 0.5); break;
      case 'door': this._noise(t, 0.1, 'lowpass', 300, 2, 0.4 * vol, 0.08); this._tone(t + 0.05, 'square', 90, 70, 0.08 * vol, 0.06); break;
      case 'honk': this._tone(t, 'square', 350, 340, 0.05 * vol, 0.35); this._tone(t, 'square', 440, 430, 0.04 * vol, 0.35); break;
      case 'pickup': this._tone(t, 'square', 880, 880, 0.08 * vol, 0.08); this._tone(t + 0.08, 'square', 1320, 1320, 0.08 * vol, 0.12); break;
      case 'checkpoint': this._tone(t, 'triangle', 660, 660, 0.15, 0.1); this._tone(t + 0.1, 'triangle', 990, 990, 0.15, 0.18); break;
      case 'go': this._tone(t, 'square', 880, 880, 0.12, 0.4); break;
      case 'mission': [523, 659, 784].forEach((f, i) => this._tone(t + i * 0.1, 'triangle', f, f, 0.15, 0.25)); break;
      case 'passed': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this._tone(t + i * 0.13, 'square', f, f, 0.08, 0.3)); break;
      case 'failed': [392, 330, 262, 196].forEach((f, i) => this._tone(t + i * 0.18, 'sawtooth', f, f * 0.98, 0.07, 0.3)); break;
      case 'wasted': this._tone(t, 'sawtooth', 220, 55, 0.12, 1.8); this._noise(t, 1.5, 'lowpass', 400, 1, 0.2, 1.4); break;
      case 'cash': this._tone(t, 'square', 1200, 1600, 0.06, 0.1); break;
      default: break;
    }
  }
}
