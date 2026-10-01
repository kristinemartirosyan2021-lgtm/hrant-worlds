// Per-actor weapon handling: fire rate, spread/bloom, recoil, reloads, switching.
import * as THREE from 'three';
import { WEAPONS } from './WeaponDefs.js';
import { RARITY } from '../config.js';
import { magSize } from '../gameplay/InventorySystem.js';
import { clamp } from '../core/util.js';

const _dir = new THREE.Vector3();
const _o = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const DEG = Math.PI / 180;

export class WeaponSystem {
  constructor(actor) {
    this.actor = actor;
    this.reset();
  }

  reset() {
    this.cooldown = 0;
    this.reloadLeft = 0;
    this.reloadDur = 0;
    this.switchLeft = 0;
    this.bloom = 0;
    this.shotsInBurst = 0;
    this.sinceShot = 10;
    this.autoReload = 0;
  }

  get reloading() { return this.reloadLeft > 0; }
  get reloadT() { return this.reloadLeft > 0 ? 1 - this.reloadLeft / this.reloadDur : -1; }
  get switchT() { return this.switchLeft > 0 ? 1 - this.switchLeft / 0.45 : 0; }

  switchTo(slot) {
    const inv = this.actor.inv;
    if (slot === inv.current || !inv.slots[slot]) return false;
    inv.current = slot;
    this.reloadLeft = 0;
    this.switchLeft = 0.45;
    this.bloom = 0;
    const w = inv.weapon;
    this.actor.model.setWeapon(w.id, w.rarity);
    if (this.actor.isPlayer) this.actor.game.audio.switchWeapon();
    return true;
  }

  startReload() {
    const inv = this.actor.inv;
    const w = inv.weapon;
    if (!w || this.reloadLeft > 0 || this.switchLeft > 0) return false;
    const def = WEAPONS[w.id];
    const size = magSize(w);
    if (w.mag >= size || inv.ammo[def.ammo] <= 0) return false;
    let dur = def.reload * RARITY[w.rarity].reload;
    if (w.id === 'shotgun') dur = (0.55 + 0.36 * Math.min(size - w.mag, inv.ammo.shell)) * RARITY[w.rarity].reload;
    this.reloadDur = this.reloadLeft = dur;
    const a = this.actor;
    a.game.audio.reload(dur, w.id === 'shotgun' ? 'shotgun' : 'mag', a.isPlayer ? null : a.ctrl.pos);
    if (a.isPlayer) a.game.ui.reloadStarted(dur);
    return true;
  }

  finishReload() {
    const inv = this.actor.inv;
    const w = inv.weapon;
    if (!w) return;
    const def = WEAPONS[w.id];
    const need = magSize(w) - w.mag;
    const take = Math.min(need, inv.ammo[def.ammo]);
    w.mag += take;
    inv.ammo[def.ammo] -= take;
  }

  currentSpread(def, it) {
    const a = this.actor;
    const ads = a.aimF;
    let s = def.spreadHip + (def.spreadAds - def.spreadHip) * ads;
    const speed = Math.hypot(a.ctrl.vel.x, a.ctrl.vel.z);
    s += clamp(speed / 5, 0, 1.2) * def.spreadMove * (1 - ads * 0.5);
    s += this.bloom;
    if (a.ctrl.crouching) s *= 0.75;
    if (!a.ctrl.onGround) s = s * 1.8 + 1.5;
    return s * (0.9 + 0.1 * RARITY[it.rarity].recoil);
  }

  update(dt, intent) {
    const a = this.actor;
    const inv = a.inv;
    this.cooldown -= dt;
    this.sinceShot += dt;
    if (this.switchLeft > 0) this.switchLeft = Math.max(0, this.switchLeft - dt);
    const w = inv.weapon;
    const def = w ? WEAPONS[w.id] : null;
    if (def) this.bloom = Math.max(0, this.bloom - dt * (this.sinceShot > 0.15 ? 6 : 1.5));
    if (!w) return;
    if (this.autoReload > 0) {
      this.autoReload -= dt;
      if (this.autoReload <= 0 && w.mag === 0) this.startReload();
    }

    if (this.reloadLeft > 0) {
      // Shotgun reload can be interrupted to fire.
      if (w.id === 'shotgun' && intent.firePressed && w.mag > 0) this.reloadLeft = 0;
      else {
        this.reloadLeft -= dt;
        if (this.reloadLeft <= 0) { this.reloadLeft = 0; this.finishReload(); }
        return;
      }
    }
    if (intent.reload) this.startReload();
    if (this.switchLeft > 0 || this.reloadLeft > 0 || a.healing) return;

    const wants = def.auto ? intent.fire : intent.firePressed;
    if (wants && this.cooldown <= 0) {
      if (w.mag <= 0) {
        if (intent.firePressed) {
          if (!this.startReload() && a.isPlayer) { a.game.audio.dryFire(); a.game.ui.flashNoAmmo(); }
        }
        return;
      }
      this.fire(def, w, intent);
    }
    if (!intent.fire) this.shotsInBurst = 0;
  }

  fire(def, w, intent) {
    const a = this.actor;
    const g = a.game;
    this.cooldown = 60 / def.rpm;
    w.mag--;
    this.sinceShot = 0;
    this.shotsInBurst++;
    a.shotOrigin(_o);
    const target = intent.aimPoint;
    _dir.copy(target).sub(_o);
    if (_dir.lengthSq() < 1e-4) a.forward(_dir);
    _dir.normalize();
    // basis for spread
    _a.set(0, 1, 0).cross(_dir);
    if (_a.lengthSq() < 1e-6) _a.set(1, 0, 0);
    _a.normalize();
    _b.copy(_dir).cross(_a).normalize();
    const spread = this.currentSpread(def, w) * DEG;
    const pellets = def.pellets || 1;
    const muzzle = a.model.muzzleWorld(new THREE.Vector3());
    let hits = 0;
    for (let i = 0; i < pellets; i++) {
      const r = Math.sqrt(Math.random()) * spread * (pellets > 1 ? 1 : 0.85);
      const th = Math.random() * Math.PI * 2;
      const d = new THREE.Vector3().copy(_dir)
        .addScaledVector(_a, Math.cos(th) * Math.tan(r))
        .addScaledVector(_b, Math.sin(th) * Math.tan(r))
        .normalize();
      if (g.projectiles.fireShot(a, _o, d, def, w, muzzle, i === 0 || Math.random() < 0.35)) hits++;
    }
    if (a.isPlayer) {
      a.stats.shots++;
      if (hits) a.stats.hits++;
    }
    this.bloom = Math.min(def.bloomMax, this.bloom + def.bloom);
    a.model.fire(def.kick * 6);
    a.onFired(def, w);
    g.fx.muzzleFlash(muzzle, _dir, a.isPlayer, def.id);
    const ej = a.model.ejectWorld(new THREE.Vector3());
    g.fx.shell(ej, a.right(new THREE.Vector3()), def.shellSize);
    g.audio.shot(def.sound, muzzle, a.isPlayer);
    g.events.emit('gunshot', { actor: a, pos: _o.clone(), loud: def.id === 'sniper' ? 160 : def.id === 'pistol' ? 70 : 100 });
    if (w.mag === 0 && a.inv.ammo[def.ammo] > 0) this.autoReload = 0.25;
  }
}
