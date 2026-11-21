// "Hrant FM" – a tiny procedural synthwave radio station (original, generated live).

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// Chord progressions as MIDI root + minor/major flag. Two "songs" alternate.
const SONGS = [
  { bpm: 104, chords: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']] },   // Am F C G
  { bpm: 96, chords: [[50, 'm'], [58, 'M'], [53, 'M'], [57, 'm']] },    // Dm Bb F Am
  { bpm: 112, chords: [[52, 'm'], [48, 'M'], [55, 'M'], [50, 'M']] },   // Em C G D
];

export class RadioStation {
  constructor(ctx, out, noise) {
    this.ctx = ctx; this.out = out; this.noise = noise;
    this.running = false; this.step = 0; this.next = 0; this.song = 0; this.bar = 0;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.connect(out);
    this.delay = ctx.createDelay(1); this.delay.delayTime.value = 0.36;
    this.fb = ctx.createGain(); this.fb.gain.value = 0.3;
    this.delay.connect(this.fb); this.fb.connect(this.delay); this.delay.connect(this.comp);
  }
  start() {
    if (this.running) return;
    this.running = true; this.next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this._schedule(), 30);
  }
  stop() { this.running = false; clearInterval(this.timer); }

  _schedule() {
    const s = SONGS[this.song];
    const sixteenth = 60 / s.bpm / 4;
    while (this.next < this.ctx.currentTime + 0.15) {
      this._play(this.step, this.next, s, sixteenth);
      this.next += sixteenth;
      this.step++;
      if (this.step % 16 === 0) {
        this.bar++;
        if (this.bar % 16 === 0) this.song = (this.song + 1) % SONGS.length;
      }
    }
  }

  _voice(t, type, freq, dur, peak, cutoff, dest = this.comp) {
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.3), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _play(step, t, s, six) {
    const c = this.ctx;
    const barIdx = Math.floor(step / 16) % s.chords.length;
    const [root, q] = s.chords[barIdx];
    const third = q === 'm' ? 3 : 4;
    const chord = [root, root + third, root + 7, root + 12];
    const st = step % 16;
    // drums
    if (st % 4 === 0) { // kick
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g); g.connect(this.comp); o.start(t); o.stop(t + 0.3);
    }
    if (st === 4 || st === 12) this._noiseHit(t, 'bandpass', 1800, 0.45, 0.18);
    if (st % 2 === 1) this._noiseHit(t, 'highpass', 7000, 0.12, 0.04);
    // bass: driving 8ths
    if (st % 2 === 0) this._voice(t, 'sawtooth', NOTE(root - 12), six * 1.8, 0.22, 900);
    // arpeggio
    const arp = chord[[0, 1, 2, 3, 2, 1, 0, 2][st % 8]] + 12;
    this._voice(t, 'square', NOTE(arp), six * 0.9, 0.05, 2600, this.delay);
    this._voice(t, 'square', NOTE(arp), six * 0.9, 0.04, 2600);
    // pad
    if (st === 0) for (const n of chord.slice(0, 3)) this._voice(t, 'triangle', NOTE(n), six * 16, 0.05, 1500);
    // lead melody every other bar
    if (this.bar % 2 === 1 && (st === 0 || st === 6 || st === 10)) this._voice(t, 'sawtooth', NOTE(chord[(st / 2) % 3 | 0] + 24), six * 3, 0.04, 3000, this.delay);
  }

  _noiseHit(t, type, freq, peak, dur) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.comp);
    s.start(t, Math.random() * 0.5, dur + 0.05);
  }
}
