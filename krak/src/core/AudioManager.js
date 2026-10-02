// Fully procedural Web Audio sound engine: no audio files are required.
import { clamp, rand } from './util.js';

const SHOT = {
  pistol:  { crack: 0.05, body: 0.14, lp: 2600, thump: 150, tg: 0.5, gain: 0.75, tail: 0.35 },
  ar:      { crack: 0.06, body: 0.2,  lp: 2100, thump: 115, tg: 0.75, gain: 0.95, tail: 0.5 },
  smg:     { crack: 0.04, body: 0.11, lp: 3000, thump: 160, tg: 0.45, gain: 0.7, tail: 0.35 },
  shotgun: { crack: 0.08, body: 0.36, lp: 1500, thump: 80,  tg: 1.0, gain: 1.15, tail: 0.75 },
  sniper:  { crack: 0.1,  body: 0.55, lp: 1700, thump: 62,  tg: 1.1, gain: 1.3, tail: 1.0 },
};

export class AudioManager {
  constructor(save) {
    this.save = save;
    this.ctx = null;
    this.voices = 0;
    this.listenerPos = { x: 0, y: 0, z: 0 };
    this.musicOn = false;
    this.heartbeatT = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.ui = ctx.createGain(); this.ui.gain.value = 0.6; this.ui.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 0.0; this.amb.connect(this.master);
    this.mus = ctx.createGain(); this.mus.connect(this.master);

    // Shared noise buffer.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Procedural reverb impulse (outdoor slap + decay).
    const rlen = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, rlen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < rlen; i++) {
        const t = i / ctx.sampleRate;
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rlen, 3.2) * (t < 0.08 ? 0.4 : 1) * 0.5;
      }
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    this.reverbIn = ctx.createGain(); this.reverbIn.gain.value = 0.5;
    this.reverbIn.connect(this.reverb).connect(this.sfx);
    this.applySettings();
    this.startWind();
  }

  applySettings() {
    if (!this.ctx) return;
    const s = this.save.data.settings;
    this.master.gain.value = clamp(s.volume, 0, 1);
    this.mus.gain.value = clamp(s.music, 0, 1) * 0.55;
  }

  get t() { return this.ctx.currentTime; }

  setListener(pos, forward) {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    this.listenerPos = { x: pos.x, y: pos.y, z: pos.z };
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setTargetAtTime(pos.x, t, 0.02);
      L.positionY.setTargetAtTime(pos.y, t, 0.02);
      L.positionZ.setTargetAtTime(pos.z, t, 0.02);
      L.forwardX.setTargetAtTime(forward.x, t, 0.02);
      L.forwardY.setTargetAtTime(forward.y, t, 0.02);
      L.forwardZ.setTargetAtTime(forward.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
  }

  dist(pos) {
    const p = this.listenerPos;
    const dx = pos.x - p.x, dy = pos.y - p.y, dz = pos.z - p.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Returns an input node routed to the destination, spatialised if pos is given.
  out(pos, ref = 5, bus = this.sfx, reverb = 0) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    if (pos) {
      const d = this.dist(pos);
      const p = new PannerNode(ctx, {
        panningModel: d < 30 ? 'HRTF' : 'equalpower',
        distanceModel: 'inverse', refDistance: ref, maxDistance: 600, rolloffFactor: 1.1,
        positionX: pos.x, positionY: pos.y, positionZ: pos.z,
      });
      g.connect(p).connect(bus);
      if (reverb > 0) {
        const rs = ctx.createGain();
        rs.gain.value = reverb * clamp(d / 60, 0.25, 1.2);
        p.connect(rs).connect(this.reverbIn);
      }
    } else {
      g.connect(bus);
      if (reverb > 0) {
        const rs = ctx.createGain(); rs.gain.value = reverb;
        g.connect(rs).connect(this.reverbIn);
      }
    }
    return g;
  }

  noiseSrc(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.start(t, Math.random() * 1.5, dur + 0.05);
    return s;
  }

  env(g, t, a, peak, dec, sustainLevel = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.0001), t + a + dec);
  }

  voice(life) {
    this.voices++;
    setTimeout(() => this.voices--, life * 1000 + 50);
  }

  // ---------------------------------------------------------------- gameplay
  shot(kind, pos, local = false, suppressed = false) {
    if (!this.ctx) return;
    const P = SHOT[kind] || SHOT.ar;
    const d = local ? 0 : this.dist(pos);
    if (!local && (this.voices > 26 || d > 420)) return;
    const ctx = this.ctx;
    const delay = local ? 0 : d / 343;
    const t = ctx.currentTime + delay + 0.005;
    const out = this.out(local ? null : pos, 7, this.sfx, P.tail * 0.6);
    const farLP = ctx.createBiquadFilter();
    farLP.type = 'lowpass';
    farLP.frequency.value = local ? 18000 : clamp(16000 - d * 110, 900, 16000);
    farLP.connect(out);
    const gain = P.gain * (local ? 1 : 1.25) * (suppressed ? 0.5 : 1);

    if (d < 60) {
      const n = this.noiseSrc(t, P.crack);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
      const g = ctx.createGain();
      this.env(g, t, 0.001, 0.9 * gain, P.crack);
      n.connect(hp).connect(g).connect(farLP);
    }
    const n2 = this.noiseSrc(t, P.body);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(P.lp * rand(0.9, 1.1), t);
    lp.frequency.exponentialRampToValueAtTime(300, t + P.body);
    const g2 = ctx.createGain();
    this.env(g2, t, 0.002, 1.0 * gain, P.body);
    n2.connect(lp).connect(g2).connect(farLP);

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(P.thump * rand(0.95, 1.05), t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.16);
    const g3 = ctx.createGain();
    this.env(g3, t, 0.002, P.tg * gain, 0.18);
    o.connect(g3).connect(farLP);
    o.start(t); o.stop(t + 0.25);
    if (local) {
      // Mechanical click layer gives every weapon a distinct "action" feel.
      this.click(t + 0.03, kind === 'sniper' ? 900 : 2400, 0.15, 0.03);
    }
    this.voice(P.body + delay + 0.4);
  }

  click(t, freq = 2000, vol = 0.3, dur = 0.025, pos = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    t = t ?? ctx.currentTime;
    const n = this.noiseSrc(t, dur);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
    const g = ctx.createGain();
    this.env(g, t, 0.001, vol, dur);
    n.connect(bp).connect(g).connect(this.out(pos, 2));
  }

  reload(duration, kind, pos = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (kind === 'shotgun') {
      const n = Math.max(2, Math.round(duration / 0.45));
      for (let i = 0; i < n; i++) this.click(t + 0.25 + i * (duration - 0.5) / n, 1500, 0.35, 0.04, pos);
      this.click(t + duration - 0.15, 900, 0.5, 0.06, pos);
      this.click(t + duration - 0.05, 1300, 0.4, 0.05, pos);
      return;
    }
    this.click(t + duration * 0.15, 1800, 0.35, 0.04, pos);      // mag release
    this.click(t + duration * 0.22, 700, 0.25, 0.08, pos);       // mag drop
    this.click(t + duration * 0.62, 2200, 0.45, 0.035, pos);     // mag insert
    this.click(t + duration * 0.66, 1200, 0.3, 0.05, pos);
    this.click(t + duration * 0.88, 2600, 0.5, 0.03, pos);       // bolt
    this.click(t + duration * 0.92, 1500, 0.4, 0.04, pos);
  }

  dryFire() { if (this.ctx) this.click(null, 3200, 0.3, 0.02); }
  switchWeapon() { if (this.ctx) { this.click(null, 1100, 0.3, 0.05); this.click(this.t + 0.12, 2400, 0.25, 0.03); } }

  footstep(pos, local, intensity = 1, surface = 'dirt') {
    if (!this.ctx) return;
    if (!local && (this.voices > 20 || this.dist(pos) > 30)) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this.noiseSrc(t, 0.09);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = surface === 'metal' ? 2600 : surface === 'wood' ? 1100 : surface === 'stone' ? 1600 : 800;
    const g = ctx.createGain();
    this.env(g, t, 0.004, (local ? 0.16 : 0.5) * intensity, 0.08);
    n.connect(lp).connect(g).connect(this.out(local ? null : pos, 2));
    if (surface === 'metal') {
      const o = ctx.createOscillator(); o.frequency.value = rand(300, 420);
      const g2 = ctx.createGain(); this.env(g2, t, 0.002, 0.04 * intensity, 0.12);
      o.connect(g2).connect(this.out(local ? null : pos, 2)); o.start(t); o.stop(t + 0.15);
    }
    this.voice(0.15);
  }

  impact(pos, mat = 'stone') {
    if (!this.ctx || this.voices > 24) return;
    const d = this.dist(pos);
    if (d > 70) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this.noiseSrc(t, 0.06);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = mat === 'metal' ? 3500 : mat === 'wood' ? 900 : mat === 'dirt' ? 500 : 1800;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    this.env(g, t, 0.001, 0.6, 0.06);
    const out = this.out(pos, 3);
    n.connect(bp).connect(g).connect(out);
    if (mat === 'metal' || (mat === 'stone' && Math.random() < 0.18)) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const f0 = mat === 'metal' ? rand(2200, 3800) : rand(2500, 4200);
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.22);
      const g2 = ctx.createGain(); this.env(g2, t, 0.003, 0.08, 0.22);
      o.connect(g2).connect(out); o.start(t); o.stop(t + 0.3);
    }
    this.voice(0.3);
  }

  whiz(pos) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this.noiseSrc(t, 0.16);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6;
    bp.frequency.setValueAtTime(5200, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.15);
    const g = ctx.createGain(); this.env(g, t, 0.02, 0.35, 0.13);
    n.connect(bp).connect(g).connect(this.out(pos, 1));
  }

  bodyHit(pos, local) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this.noiseSrc(t, 0.08);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = ctx.createGain(); this.env(g, t, 0.002, local ? 0.5 : 0.7, 0.08);
    n.connect(lp).connect(g).connect(this.out(local ? null : pos, 3));
  }

  hitmarker(head = false, kill = false) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const tone = (f, at, dur, vol, type = 'square') => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const g = ctx.createGain(); this.env(g, at, 0.002, vol, dur);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
      o.connect(hp).connect(g).connect(this.ui); o.start(at); o.stop(at + dur + 0.02);
    };
    if (kill) {
      tone(220, t, 0.18, 0.25, 'sawtooth');
      tone(880, t + 0.02, 0.25, 0.12, 'triangle');
      tone(1320, t + 0.09, 0.35, 0.1, 'triangle');
      const n = this.noiseSrc(t, 0.12);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
      const g = ctx.createGain(); this.env(g, t, 0.002, 0.8, 0.15);
      n.connect(lp).connect(g).connect(this.ui);
    } else if (head) {
      tone(1760, t, 0.12, 0.13, 'triangle');
      tone(2640, t + 0.01, 0.18, 0.08, 'sine');
    } else {
      tone(1250, t, 0.04, 0.07, 'square');
    }
  }

  hurt(amount) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this.noiseSrc(t, 0.2);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = ctx.createGain(); this.env(g, t, 0.003, clamp(0.4 + amount / 40, 0.4, 1.2), 0.2);
    n.connect(lp).connect(g).connect(this.ui);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    const g2 = ctx.createGain(); this.env(g2, t, 0.003, 0.4, 0.2);
    o.connect(g2).connect(this.ui); o.start(t); o.stop(t + 0.25);
  }

  heartbeat(dt, active) {
    if (!this.ctx || !active) { this.heartbeatT = 0; return; }
    this.heartbeatT -= dt;
    if (this.heartbeatT > 0) return;
    this.heartbeatT = 0.85;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [off, v] of [[0, 0.7], [0.18, 0.45]]) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(70, t + off); o.frequency.exponentialRampToValueAtTime(38, t + off + 0.14);
      const g = ctx.createGain(); this.env(g, t + off, 0.01, v, 0.15);
      o.connect(g).connect(this.ui); o.start(t + off); o.stop(t + off + 0.2);
    }
  }

  explosion(pos) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const d = this.dist(pos);
    const t = ctx.currentTime + d / 343;
    const out = this.out(pos, 14, this.sfx, 0.9);
    const lpF = ctx.createBiquadFilter(); lpF.type = 'lowpass'; lpF.frequency.value = clamp(9000 - d * 40, 600, 9000);
    lpF.connect(out);
    const n = this.noiseSrc(t, 1.4);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(120, t + 1.3);
    const g = ctx.createGain(); this.env(g, t, 0.004, 1.6, 1.3);
    n.connect(lp).connect(g).connect(lpF);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(22, t + 0.9);
    const g2 = ctx.createGain(); this.env(g2, t, 0.004, 1.4, 0.9);
    o.connect(g2).connect(lpF); o.start(t); o.stop(t + 1.0);
    this.voice(1.6 + d / 343);
  }

  pickup(kind = 'item') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const notes = kind === 'weapon' ? [660, 990] : kind === 'armor' ? [440, 660] : [880, 1320];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain(); this.env(g, t + i * 0.06, 0.004, 0.12, 0.12);
      o.connect(g).connect(this.ui); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.2);
    });
    this.click(t, 1800, 0.25, 0.04);
  }

  uiHover() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1900;
    const g = ctx.createGain(); this.env(g, t, 0.002, 0.04, 0.04);
    o.connect(g).connect(this.ui); o.start(t); o.stop(t + 0.06);
  }
  uiClick() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(1400, t + 0.06);
    const g = ctx.createGain(); this.env(g, t, 0.002, 0.16, 0.09);
    o.connect(g).connect(this.ui); o.start(t); o.stop(t + 0.12);
    this.click(t, 2600, 0.15, 0.02);
  }
  uiBig() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [196, 294, 392].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(3000, t + 0.3);
      const g = ctx.createGain(); this.env(g, t + i * 0.02, 0.01, 0.09, 0.8);
      o.connect(lp).connect(g).connect(this.ui); o.start(t); o.stop(t + 1);
    });
    const n = this.noiseSrc(t, 0.8);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    const g = ctx.createGain(); this.env(g, t, 0.3, 0.08, 0.5);
    n.connect(hp).connect(g).connect(this.ui);
  }

  whoosh() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this.noiseSrc(t, 1.2);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2500, t + 0.9);
    const g = ctx.createGain(); this.env(g, t, 0.7, 0.35, 0.5);
    n.connect(bp).connect(g).connect(this.ui);
  }

  impactBoom() {
    // Title slam: sub drop + metallic hit.
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.4);
    const g = ctx.createGain(); this.env(g, t, 0.005, 1.0, 1.5);
    o.connect(g).connect(this.ui); o.start(t); o.stop(t + 1.6);
    const n = this.noiseSrc(t, 1.6);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(200, t + 1.5);
    const g2 = ctx.createGain(); this.env(g2, t, 0.003, 0.6, 1.5);
    n.connect(lp).connect(g2).connect(this.ui);
    const rs = ctx.createGain(); rs.gain.value = 0.6; g2.connect(rs).connect(this.reverbIn);
  }

  zoneAlarm() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(620, t + i * 0.32); o.frequency.linearRampToValueAtTime(880, t + i * 0.32 + 0.22);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
      const g = ctx.createGain(); this.env(g, t + i * 0.32, 0.01, 0.07, 0.24);
      o.connect(lp).connect(g).connect(this.ui); o.start(t + i * 0.32); o.stop(t + i * 0.32 + 0.3);
    }
  }

  zoneTick() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 110;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const g = ctx.createGain(); this.env(g, t, 0.01, 0.12, 0.25);
    o.connect(lp).connect(g).connect(this.ui); o.start(t); o.stop(t + 0.3);
  }

  stinger(win) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const seq = win
      ? [[293.7, 0], [370, 0.12], [440, 0.24], [587.3, 0.36], [740, 0.6], [880, 0.6]]
      : [[293.7, 0], [277.2, 0.35], [233.1, 0.7], [146.8, 1.05]];
    for (const [f, at] of seq) {
      for (const det of [-4, 4]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = win ? 2600 : 1100;
        const g = ctx.createGain(); this.env(g, t + at, 0.02, 0.07, win ? 1.8 : 1.4);
        o.connect(lp).connect(g).connect(this.ui); o.start(t + at); o.stop(t + at + 2);
        const rs = ctx.createGain(); rs.gain.value = 0.5; g.connect(rs).connect(this.reverbIn);
      }
    }
    if (win) {
      const n = this.noiseSrc(t, 2.5);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
      const g = ctx.createGain(); this.env(g, t, 0.6, 0.12, 1.8);
      n.connect(hp).connect(g).connect(this.ui);
    }
  }

  levelUp() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain(); this.env(g, t + i * 0.08, 0.005, 0.14, 0.6);
      o.connect(g).connect(this.ui); o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.7);
    });
  }

  xpTick() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = rand(1500, 1700);
    const g = ctx.createGain(); this.env(g, t, 0.002, 0.03, 0.03);
    o.connect(g).connect(this.ui); o.start(t); o.stop(t + 0.05);
  }

  // ---------------------------------------------------------------- transport plane
  startPlane(pos) {
    if (!this.ctx || this.planeNodes) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 1.5);
    const pan = new PannerNode(ctx, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: 30, rolloffFactor: 0.8, positionX: pos.x, positionY: pos.y, positionZ: pos.z });
    out.connect(pan).connect(this.sfx);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    lp.connect(out);
    const oscs = [];
    for (const [f, gv] of [[58, 0.22], [58.7, 0.22], [116, 0.1], [174.5, 0.05]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const gg = ctx.createGain(); gg.gain.value = gv;
      o.connect(gg).connect(lp); o.start(); oscs.push(o);
    }
    const n = ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.7;
    const ng = ctx.createGain(); ng.gain.value = 0.35;
    n.connect(bp).connect(ng).connect(lp); n.start(); oscs.push(n);
    this.planeNodes = { out, pan, oscs };
  }
  updatePlane(pos) {
    if (!this.planeNodes) return;
    const p = this.planeNodes.pan, t = this.ctx.currentTime;
    p.positionX.setTargetAtTime(pos.x, t, 0.05);
    p.positionY.setTargetAtTime(pos.y, t, 0.05);
    p.positionZ.setTargetAtTime(pos.z, t, 0.05);
  }
  stopPlane() {
    if (!this.planeNodes) return;
    const { out, oscs } = this.planeNodes;
    this.planeNodes = null;
    const t = this.ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 2);
    setTimeout(() => oscs.forEach((o) => { try { o.stop(); } catch (e) { /* ignore */ } }), 2200);
  }

  // ---------------------------------------------------------------- ambience
  startWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.11;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lfoG = ctx.createGain(); lfoG.gain.value = 180;
    lfo.connect(lfoG).connect(bp.frequency);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.13;
    const lfoG2 = ctx.createGain(); lfoG2.gain.value = 0.06;
    lfo2.connect(lfoG2).connect(g.gain);
    src.connect(bp).connect(g).connect(this.amb);
    src.start(); lfo.start(); lfo2.start();
  }
  setAmbience(level) {
    if (!this.ctx) return;
    this.amb.gain.setTargetAtTime(level, this.ctx.currentTime, 0.8);
  }

  // Distant rumble of a far-away fight, used to make the world feel alive.
  distantRumble() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this.noiseSrc(t, 2.2);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    const g = ctx.createGain(); this.env(g, t, 0.05, 0.5, 2.0);
    const pan = ctx.createStereoPanner(); pan.pan.value = rand(-0.8, 0.8);
    n.connect(lp).connect(g).connect(pan).connect(this.sfx);
  }

  // ---------------------------------------------------------------- music
  // A duduk-flavoured drone + melody in a D "Phrygian dominant"-like mode.
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const ctx = this.ctx;
    this.musGain = ctx.createGain();
    this.musGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.musGain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 3);
    this.musGain.connect(this.mus);
    const rs = ctx.createGain(); rs.gain.value = 0.7; this.musGain.connect(rs).connect(this.reverbIn);
    this.drones = [];
    for (const f of [73.4, 110, 146.8]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      o.detune.value = rand(-6, 6);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340;
      const g = ctx.createGain(); g.gain.value = f < 80 ? 0.05 : 0.025;
      o.connect(lp).connect(g).connect(this.musGain); o.start();
      this.drones.push(o);
    }
    const scale = [293.7, 311.1, 370, 392, 440, 466.2, 523.3, 587.3];
    const phrase = [
      [4, 1.2], [3, 0.6], [2, 0.6], [1, 1.6], [2, 0.8], [3, 0.8], [4, 2.2],
      [5, 0.8], [4, 0.6], [3, 0.6], [2, 0.6], [1, 0.8], [0, 2.6],
      [2, 0.9], [4, 0.9], [6, 1.4], [5, 0.7], [4, 0.7], [3, 1.2], [2, 0.6], [1, 0.6], [0, 3.0],
    ];
    let i = 0;
    let at = ctx.currentTime + 2.5;
    const sched = () => {
      if (!this.musicOn) return;
      while (at < ctx.currentTime + 1.5) {
        const [deg, dur] = phrase[i % phrase.length];
        this.dudukNote(scale[deg] / 2, at, dur * 1.25);
        at += dur * 1.25;
        i++;
        if (i % phrase.length === 0) at += 3.5;
      }
      this.musTimer = setTimeout(sched, 400);
    };
    sched();
  }
  dudukNote(f, t, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.6);
    vib.connect(vg).connect(o.frequency);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 3.2; bp.Q.value = 1.1;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.18);
    g.gain.setValueAtTime(0.1, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    o.connect(bp).connect(lp).connect(g).connect(this.musGain);
    o.start(t); vib.start(t); o.stop(t + dur + 0.3); vib.stop(t + dur + 0.3);
  }
  stopMusic() {
    if (!this.ctx || !this.musicOn) return;
    this.musicOn = false;
    clearTimeout(this.musTimer);
    const t = this.ctx.currentTime;
    const g = this.musGain;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value || 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    const drones = this.drones;
    setTimeout(() => { drones.forEach((o) => o.stop()); g.disconnect(); }, 1700);
  }
}
