// HUD: money, stars, clock, health/armor, objective, prompts, big messages, speedometer.
const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = $('hud');
    this.clock = $('clock'); this.money = $('money'); this.stars = $('stars');
    this.health = $('health-bar'); this.armor = $('armor-bar');
    this.objEl = $('objective'); this.objText = $('obj-text'); this.objTimer = $('obj-timer');
    this.bigEl = $('big'); this.bigTitle = $('big-title'); this.bigSub = $('big-sub');
    this.toast = $('toast'); this.promptEl = $('prompt');
    this.vehHud = $('vehicle-hud'); this.speed = $('speed'); this.vehBar = $('vehicle-bar');
    this.hurt = $('hurt'); this.fps = $('fps');
    this.bigT = 0; this.toastT = 0; this.promptText = null; this.shownMoney = 0;
    this._last = {};
  }
  show(v) { this.el.classList.toggle('hidden', !v); }

  _set(key, el, prop, val) {
    if (this._last[key] === val) return;
    this._last[key] = val;
    if (prop === 'text') el.textContent = val; else el.style[prop] = val;
  }

  message(text, t = 2) {
    this.toast.textContent = text; this.toast.classList.add('show'); this.toastT = t;
  }
  big(title, t = 2.5, sub = '', color = '#ffd23f') {
    this.bigTitle.textContent = title; this.bigTitle.style.color = color;
    this.bigSub.textContent = sub || '';
    this.bigEl.classList.remove('hidden');
    // restart animation
    this.bigTitle.style.animation = 'none'; void this.bigTitle.offsetWidth; this.bigTitle.style.animation = '';
    this.bigT = t;
  }
  objective(text, timer = null) {
    if (!text) { this.objEl.classList.add('hidden'); this._last.obj = null; return; }
    this.objEl.classList.remove('hidden');
    this._set('obj', this.objText, 'text', text);
    if (timer === null) this._set('objt', this.objTimer, 'text', '');
    else {
      const t = Math.max(0, Math.ceil(timer));
      this._set('objt', this.objTimer, 'text', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
      this.objTimer.classList.toggle('low', t <= 10);
    }
  }
  prompt(text) { this.promptText = text; }
  flashHurt() { this.hurt.classList.add('on'); clearTimeout(this._ht); this._ht = setTimeout(() => this.hurt.classList.remove('on'), 60); }
  pulseStars() { this.stars.classList.remove('pulse'); void this.stars.offsetWidth; this.stars.classList.add('pulse'); }

  update(dt, fps) {
    const g = this.game, p = g.player;
    this._set('clock', this.clock, 'text', g.daynight.timeString);
    this.shownMoney += (g.money - this.shownMoney) * Math.min(1, dt * 6);
    if (Math.abs(g.money - this.shownMoney) < 1) this.shownMoney = g.money;
    this._set('money', this.money, 'text', '$' + Math.round(this.shownMoney).toLocaleString('en-US'));
    const s = g.wanted.stars;
    if (this._last.stars !== s) {
      this._last.stars = s;
      [...this.stars.children].forEach((c, i) => c.classList.toggle('on', i < s));
    }
    this.stars.classList.toggle('flash', s > 0 && !g.wanted.seen);
    this._set('hp', this.health, 'width', Math.max(0, p.health / p.maxHealth) * 100 + '%');
    this._set('ar', this.armor, 'width', Math.max(0, p.armor) + '%');
    const v = p.vehicle;
    this.vehHud.classList.toggle('hidden', !v);
    if (v) {
      this._set('spd', this.speed, 'text', String(Math.round(Math.abs(v.forwardSpeed) * 3.6)));
      this._set('vb', this.vehBar, 'width', Math.max(0, v.health / v.spec.health) * 100 + '%');
    }
    if (this.bigT > 0) { this.bigT -= dt; if (this.bigT <= 0) this.bigEl.classList.add('hidden'); }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toast.classList.remove('show'); }
    if (this.promptText) { this.promptEl.classList.remove('hidden'); this._set('pr', this.promptEl, 'text', this.promptText); }
    else this.promptEl.classList.add('hidden');
    this.promptText = null;
    if (g.settings.showFps) this._set('fps', this.fps, 'text', fps + ' FPS'); else this._set('fps', this.fps, 'text', '');
  }
}
