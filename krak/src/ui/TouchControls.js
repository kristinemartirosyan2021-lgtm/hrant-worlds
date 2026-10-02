// Mobile touch controls: floating joystick, 360° look pad, fire/aim/jump/crouch/reload/
// grenade/heal/interact buttons. Fully multi-touch (pointer events tracked by pointerId),
// so the player can move, look and shoot at the same time.
import { clamp } from '../core/util.js';

const $ = (id) => document.getElementById(id);

export function detectTouch() {
  const q = new URLSearchParams(location.search);
  if (q.get('mobile') === '1') return true;
  if (q.get('mobile') === '0') return false;
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent);
  return (coarse && touch) || uaMobile;
}

// Base look speed: radians per CSS pixel of swipe at sensitivity 1.0.
const LOOK_RAD_PER_PX = 0.0062;

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.input = game.input;
    this.root = $('touch');
    this.pointers = new Map();    // pointerId -> { role, x, y, ... }
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, sprint: false };
    this.aimToggle = false;
    this.build();
    this.bind();
    this.layout();
    addEventListener('resize', () => this.layout());
    addEventListener('orientationchange', () => setTimeout(() => this.layout(), 250));
  }

  build() {
    const btn = (id, label, cls = '', icon = '') =>
      `<div class="tbtn ${cls}" id="${id}" data-role="${id}"><span class="ti">${icon}</span><span class="tl">${label}</span><b class="badge"></b></div>`;
    this.root.innerHTML = `
      <div class="joy-zone" id="tJoyZone"></div>
      <div class="look-zone" id="tLookZone"></div>
      <div class="joy" id="tJoy"><div class="joy-ring"></div><div class="joy-knob" id="tKnob"></div><div class="joy-sprint" id="tSprint">ՎԱԶՔ</div></div>
      ${btn('tFire', '', 'fire', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="currentColor"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="currentColor" stroke-width="2"/></svg>')}
      ${btn('tFireL', '', 'fire small', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="currentColor"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="currentColor" stroke-width="2"/></svg>')}
      ${btn('tAim', 'ՆՇԱՆ', '', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>')}
      ${btn('tJump', 'ՑԱՏԿ', '', '<svg viewBox="0 0 24 24"><path d="M12 4l7 8h-4v8H9v-8H5z" fill="currentColor"/></svg>')}
      ${btn('tCrouch', 'ԿՔԱՆՍՏԵԼ', '', '<svg viewBox="0 0 24 24"><path d="M12 20l-7-8h4V4h6v8h4z" fill="currentColor"/></svg>')}
      ${btn('tReload', 'ԼԻՑՔ', '', '<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 0 8 8h-3a5 5 0 1 1-5-5v3l5-4.5L12 1z" fill="currentColor"/></svg>')}
      ${btn('tNade', 'ՆՌՆԱԿ', '', '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="6" ry="7" fill="currentColor"/><rect x="10" y="3" width="4" height="4" fill="currentColor"/><path d="M14 5h5" stroke="currentColor" stroke-width="2"/></svg>')}
      ${btn('tHeal', 'ԲՈՒԺՎԵԼ', 'heal', '<svg viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor"/></svg>')}
      <div class="tdrop" id="tDrop" data-role="tDrop"><span id="tDropLabel">ԻՋՆԵԼ</span></div>
      <div class="tbtn pause" id="tPause" data-role="tPause"><span class="ti"><svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg></span></div>
    `;
    this.el = {};
    for (const n of this.root.querySelectorAll('[id]')) this.el[n.id] = n;
  }

  bind() {
    const opts = { passive: false };
    this.root.addEventListener('pointerdown', (e) => this.down(e), opts);
    window.addEventListener('pointermove', (e) => this.move(e), opts);
    window.addEventListener('pointerup', (e) => this.up(e), opts);
    window.addEventListener('pointercancel', (e) => this.up(e), opts);
    // Contextual HUD elements become touch buttons.
    $('prompt').addEventListener('pointerdown', (e) => { if (!this.active()) return; e.preventDefault(); e.stopPropagation(); this.tap('KeyF'); });
    for (const s of document.querySelectorAll('#invSlots .slot[data-slot]')) {
      s.addEventListener('pointerdown', (e) => { if (!this.active()) return; e.preventDefault(); e.stopPropagation(); this.tap('Digit' + (+s.dataset.slot + 1)); });
    }
    document.querySelector('#invSlots .slot.util').addEventListener('pointerdown', (e) => { if (!this.active()) return; e.preventDefault(); this.tap('KeyH'); });
    document.querySelector('.minimap-wrap').addEventListener('pointerdown', (e) => { if (!this.active()) return; e.preventDefault(); this.tap('KeyM'); });
    $('bigmap').addEventListener('pointerdown', (e) => { if (!this.active()) return; e.preventDefault(); this.tap('KeyM'); });
  }

  active() { return this.input.touch && this.game.match.state === 'playing' && !this.game.paused; }

  tap(code) {
    this.input.vDown(code);
    // release on next frame so `hit()` registers exactly once
    requestAnimationFrame(() => requestAnimationFrame(() => this.input.vUp(code)));
  }

  // ---------------------------------------------------------------- layout
  layout() {
    const W = innerWidth, H = innerHeight;
    const st = this.game.save.data.settings;
    const cs = getComputedStyle(document.documentElement);
    const sa = (n) => parseFloat(cs.getPropertyValue(n)) || 0;
    const sl = sa('--sal'), sr = sa('--sar'), sb = sa('--sab');
    // Scale everything from a reference 780x380 landscape phone, never smaller than thumb-friendly.
    const s = clamp(Math.min(W / 780, H / 380), 0.82, 1.35) * (st.btnScale || 1);
    this.scale = s;
    const fireR = Math.round(46 * s);
    const bR = Math.round(Math.max(27, 29 * s));           // min 54px diameter
    const pad = Math.round(14 * s);
    const fx = W - sr - pad - fireR - 6, fy = H - sb - pad - fireR - Math.round(10 * s);
    const place = (el, cx, cy, r) => {
      el.style.width = el.style.height = `${r * 2}px`;
      el.style.left = `${Math.round(cx - r)}px`;
      el.style.top = `${Math.round(cy - r)}px`;
    };
    place(this.el.tFire, fx, fy, fireR);
    const ring1 = fireR + 14 + bR;
    const ring2 = ring1 + bR * 2 + 8;
    const at = (deg, rad) => [fx + Math.cos((deg * Math.PI) / 180) * rad, fy - Math.sin((deg * Math.PI) / 180) * rad];
    // Two arcs around the fire button; angular spacing guarantees no overlap at any scale.
    place(this.el.tJump, ...at(92, ring1), bR);
    place(this.el.tReload, ...at(138, ring1), bR);
    place(this.el.tCrouch, ...at(184, ring1), bR);
    place(this.el.tNade, ...at(104, ring2), bR);
    place(this.el.tAim, ...at(140, ring2), bR);
    place(this.el.tHeal, ...at(174, ring2), bR);
    // Left-side fire button above the joystick area (for "claw-less" shooting).
    const lfR = Math.round(34 * s);
    place(this.el.tFireL, sl + pad + lfR + Math.round(40 * s), H * 0.42, lfR);
    // Pause sits just left of the minimap (top-right).
    const pr = Math.max(25, Math.round(22 * s));
    const mm = document.querySelector('.minimap-wrap').getBoundingClientRect();
    const mmLeft = mm.width > 0 ? mm.left : W - sr - 8 - Math.min(150, Math.max(92, H * 0.25));
    place(this.el.tPause, mmLeft - 10 - pr, sa('--sat') + 8 + pr, pr);
    // Joystick defaults (bottom-left resting position).
    this.joyR = Math.round(58 * s);
    this.joyRest = { x: sl + pad + this.joyR + Math.round(30 * s), y: H - sb - pad - this.joyR - Math.round(14 * s) };
    const j = this.el.tJoy;
    j.style.width = j.style.height = `${this.joyR * 2}px`;
    if (this.joy.id === null) this.setJoyPos(this.joyRest.x, this.joyRest.y);
    // Center the bottom HUD (weapon slots / ammo) in the free gap between joystick and buttons.
    const leftLimit = this.joyRest.x + this.joyR + 8;
    const rightLimit = Math.min(...['tCrouch', 'tHeal'].map((k) => parseFloat(this.el[k].style.left))) - 8;
    const cx = rightLimit > leftLimit ? (leftLimit + rightLimit) / 2 : W / 2;
    document.documentElement.style.setProperty('--bcx', `${Math.round(Math.min(cx, W / 2))}px`);
    // Expose scale to CSS (HUD sizing on phones).
    document.documentElement.style.setProperty('--ts', s.toFixed(3));
    this.bounds = { fx, fy, fireR };
  }

  setJoyPos(x, y) {
    const j = this.el.tJoy;
    j.style.left = `${x - this.joyR}px`;
    j.style.top = `${y - this.joyR}px`;
    this.joy.ox = x; this.joy.oy = y;
    this.el.tKnob.style.transform = 'translate(-50%, -50%)';
  }

  // ---------------------------------------------------------------- pointers
  down(e) {
    if (!this.input.touch) return;
    e.preventDefault();
    this.game.audio.init();
    if (!this.active()) return;
    const t = e.target.closest('[data-role]') || e.target;
    const role = t.dataset ? t.dataset.role || t.id : t.id;
    const W = innerWidth;
    const p = { role, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
    try { this.root.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const I = this.input;
    switch (role) {
      case 'tFire': case 'tFireL':
        I.mouse.left = true; I.mouse.leftPressed = true; this.firing = (this.firing || 0) + 1; break;
      case 'tAim': this.aimToggle = !this.aimToggle; I.mouse.right = this.aimToggle; I.mouse.rightPressed = this.aimToggle; break;
      case 'tJump': I.vDown('Space'); break;
      case 'tCrouch': I.vDown('KeyC'); break;
      case 'tReload': I.vDown('KeyR'); break;
      case 'tNade': I.vDown('KeyG'); break;
      case 'tHeal': I.vDown('KeyH'); break;
      case 'tPause': this.game.pause(); break;
      case 'tDrop': this.tap('Space'); break;
      default: {
        // Zones: left part → joystick, rest → look.
        if (e.clientX < W * 0.42 && this.joy.id === null) {
          p.role = 'joy';
          this.joy.id = e.pointerId;
          const x = clamp(e.clientX, this.joyR + 8, W * 0.42 - this.joyR * 0.4);
          const y = clamp(e.clientY, this.joyR + 8, innerHeight - this.joyR - 8);
          this.setJoyPos(x, y);
          this.el.tJoy.classList.add('on');
        } else p.role = 'look';
      }
    }
    if (t.classList && t.classList.contains('tbtn')) t.classList.add('pressed');
    p.el = t.classList && t.classList.contains('tbtn') ? t : null;
    this.pointers.set(e.pointerId, p);
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (p.role === 'joy') { this.updateJoy(e.clientX, e.clientY); return; }
    // Look pad, plus "drag to aim" while holding fire / grenade (standard on mobile shooters).
    if (p.role === 'look' || p.role === 'tFire' || p.role === 'tFireL' || p.role === 'tNade' || p.role === 'tAim') {
      const st = this.game.save.data.settings;
      let k = LOOK_RAD_PER_PX * (st.touchSens || 1);
      const pl = this.game.player;
      if (pl && pl.aimF > 0.5) k *= 0.75;                       // finer control when aiming
      if (pl && st.aimAssist && pl.aimEnemy) k *= 0.7;          // slowdown over targets
      this.input.look.yaw += dx * k;
      this.input.look.pitch += dy * k * (st.invertY ? -1 : 1);
    }
  }

  updateJoy(x, y) {
    const j = this.joy;
    let dx = x - j.ox, dy = y - j.oy;
    const d = Math.hypot(dx, dy);
    const R = this.joyR;
    // Pushing far past the ring (upwards) engages sprint.
    j.sprint = d > R * 1.25 && dy < -Math.abs(dx) * 0.6;
    const k = d > R ? R / d : 1;
    this.el.tKnob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
    this.el.tJoy.classList.toggle('sprint', j.sprint);
    // dead zone + normalised analog vector
    const m = clamp((d - R * 0.12) / (R * 0.88), 0, 1);
    const a = this.input.axis;
    a.x = d > 0 ? (dx / d) * m : 0;
    a.y = d > 0 ? (dy / d) * m : 0;
    a.active = m > 0;
    a.sprint = j.sprint;
  }

  up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    const I = this.input;
    if (p.el) p.el.classList.remove('pressed');
    switch (p.role) {
      case 'joy':
        this.joy.id = null;
        I.axis.x = I.axis.y = 0; I.axis.active = false; I.axis.sprint = false;
        this.el.tJoy.classList.remove('on', 'sprint');
        this.setJoyPos(this.joyRest.x, this.joyRest.y);
        break;
      case 'tFire': case 'tFireL':
        this.firing = Math.max(0, (this.firing || 0) - 1);
        if (!this.firing) I.mouse.left = false;
        break;
      case 'tJump': I.vUp('Space'); break;
      case 'tCrouch': I.vUp('KeyC'); break;
      case 'tReload': I.vUp('KeyR'); break;
      case 'tNade': I.vUp('KeyG'); break;
      case 'tHeal': I.vUp('KeyH'); break;
    }
  }

  // Aircraft / parachute phase: one big contextual action button.
  setAir(air) {
    const b = this.el.tDrop;
    if (!b) return;
    b.classList.toggle('show', !!air && air !== 'chute');
    this.el.tDropLabel.textContent = air === 'plane' ? 'ԻՋՆԵԼ' : 'ԲԱՑԵԼ ՕԴԱՊԱՐԻԿԸ';
  }

  // Release everything (pause, death, match end).
  reset() {
    const I = this.input;
    this.pointers.clear();
    this.joy.id = null;
    this.firing = 0;
    I.mouse.left = false;
    this.aimToggle = false;
    I.mouse.right = false;
    I.axis.x = I.axis.y = 0; I.axis.active = false; I.axis.sprint = false;
    for (const c of ['Space', 'KeyC', 'KeyR', 'KeyG', 'KeyH']) I.vUp(c);
    for (const b of this.root.querySelectorAll('.pressed')) b.classList.remove('pressed');
    this.el.tJoy.classList.remove('on', 'sprint');
    if (this.joyRest) this.setJoyPos(this.joyRest.x, this.joyRest.y);
  }

  // Per-frame visual state (ammo/grenade/medkit badges, availability).
  update() {
    const pl = this.game.player;
    if (!pl || !this.input.touch) return;
    const nb = this.el.tNade.querySelector('.badge');
    const hb = this.el.tHeal.querySelector('.badge');
    if (nb.textContent !== String(pl.inv.grenades)) nb.textContent = pl.inv.grenades;
    if (hb.textContent !== String(pl.inv.medkits)) hb.textContent = pl.inv.medkits;
    this.el.tNade.classList.toggle('dim', pl.inv.grenades <= 0);
    this.el.tHeal.classList.toggle('dim', pl.inv.medkits <= 0 || pl.health.hp >= pl.health.max);
    this.el.tAim.classList.toggle('on', this.aimToggle);
    this.el.tCrouch.classList.toggle('on', pl.ctrl.crouching);
    this.el.tReload.classList.toggle('dim', !pl.inv.weapon);
    // ADS can be cancelled by the game (e.g. while healing) — keep the toggle honest.
    if (!pl.alive && this.aimToggle) { this.aimToggle = false; this.input.mouse.right = false; }
  }
}
