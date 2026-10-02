// Actor: a human combatant (player or bot) — body, physics, health, inventory, weapons.
import * as THREE from 'three';
import { HumanModel } from './HumanModel.js';
import { CharacterController } from './CharacterController.js';
import { Health } from '../combat/HealthSystem.js';
import { Inventory } from '../gameplay/InventorySystem.js';
import { WeaponSystem } from '../combat/WeaponSystem.js';
import { WEAPONS } from '../combat/WeaponDefs.js';
import { damp, clamp } from '../core/util.js';

let NEXT_ID = 1;
const _v = new THREE.Vector3();

export function makeIntent() {
  return {
    mx: 0, mz: 0, sprint: false, crouch: false, jump: false,
    aiming: false, fire: false, firePressed: false, reload: false, slot: null,
    heal: false, aimPoint: new THREE.Vector3(),
  };
}

export class Actor {
  constructor(game, { name, isPlayer = false, look }) {
    this.game = game;
    this.id = NEXT_ID++;
    this.name = name;
    this.isPlayer = isPlayer;
    this.model = new HumanModel(look);
    game.scene.add(this.model.root);
    this.ctrl = new CharacterController(game.world.collision);
    this.health = new Health();
    this.inv = new Inventory();
    this.weapons = new WeaponSystem(this);
    this.intent = makeIntent();
    this.yaw = 0;
    this.pitch = 0;
    this.aimF = 0;
    this.alive = true;
    this.kills = 0;
    this.headshots = 0;
    this.damageDealt = 0;
    this.stats = { shots: 0, hits: 0 };
    this.healing = false;
    this.healT = 0;
    this.lastHitBy = null;
    this.lastHitTime = -99;
    this.spawnTime = 0;
    this.placement = 0;
    this.air = null;          // 'plane' | 'fall' | 'chute' | null (on the ground)
    this.chute = null;
    this.model.stepCb = () => this.footstep();
  }

  get pos() { return this.ctrl.pos; }

  spawn(x, z, yaw = 0) {
    const y = this.game.world.collision.groundAt(x, z, 0.3, 50, 0) + 0.05;
    this.ctrl.teleport(x, y, z);
    this.yaw = yaw; this.pitch = 0;
    this.alive = true;
    this.kills = 0; this.headshots = 0; this.damageDealt = 0;
    this.stats = { shots: 0, hits: 0 };
    this.healing = false;
    this.health.reset();
    this.inv.reset();
    this.weapons.reset();
    this.model.reset();
    this.model.root.visible = true;
    this.inv.addWeapon('pistol', 0);
    this.inv.ammo.light = 36;
    this.inv.current = 2;
    this.model.setWeapon('pistol', 0);
    this.spawnTime = this.game.time;
    this.placement = 0;
    this.air = null;
    if (this.chute) this.chute.visible = false;
    this.model.root.rotation.x = 0;
  }

  equipCurrentModel() {
    const w = this.inv.weapon;
    this.model.setWeapon(w ? w.id : null, w ? w.rarity : 0);
  }

  moveSpeed() {
    const I = this.intent;
    const def = this.inv.def;
    let s = 4.6;
    if (I.sprint && !I.aiming && !this.ctrl.crouching && !this.healing) s = 6.9;
    if (this.ctrl.crouching) s = 2.2;
    if (this.aimF > 0.5) s = Math.min(s, 2.9);
    if (this.healing) s = 1.8;
    if (def) s *= def.speedMul;
    if (I.speedScale && !this.ctrl.crouching) s *= I.speedScale;
    return s;
  }

  update(dt) {
    const m = this.model;
    if (!this.alive) { m.update(dt, null); return; }
    const I = this.intent;
    if (this.air) { this.updateAir(dt); return; }
    this.ctrl.facing = this.yaw;
    const wasGround = this.ctrl.onGround;
    this.ctrl.step(dt, I.mx, I.mz, this.moveSpeed(), I.jump, I.crouch);
    const ev = this.ctrl.events;
    if (ev.landed > 6 && !wasGround) {
      this.game.fx.dustPuff(this.ctrl.pos, 6, 0.6);
      this.game.audio.footstep(this.ctrl.pos, this.isPlayer, 1.6);
      if (ev.landed > 15) this.applyDamage((ev.landed - 15) * 4, { attacker: null, fall: true, dir: _v.set(0, -1, 0) });
    }
    if ((ev.jumped || ev.vaulted) && this.isPlayer) this.game.audio.footstep(this.ctrl.pos, true, 1.2);

    if (I.slot !== null && I.slot !== undefined) { if (this.weapons.switchTo(I.slot)) this.cancelHeal(); }
    this.updateHeal(dt);
    this.weapons.update(dt, I);
    this.aimF = damp(this.aimF, I.aiming && !this.healing ? 1 : 0, 14, dt);

    // model
    m.root.position.copy(this.ctrl.pos);
    m.root.rotation.y = this.yaw;
    const v = this.ctrl.vel;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const lx = -(v.x * c - v.z * s), lz = v.x * s + v.z * c; // right / forward components
    m.update(dt, {
      speed: Math.hypot(v.x, v.z), localVX: lx, localVZ: lz,
      crouch: this.ctrl.crouching, onGround: this.ctrl.onGround,
      aimPitch: this.pitch, aiming: I.aiming || this.weapons.sinceShot < 0.4, sprint: I.sprint,
      reloadT: this.weapons.reloadT, switchT: this.weapons.switchT, healT: this.healing ? this.healT : 0,
    });
  }

  // Aircraft / free-fall / parachute (see DropSystem).
  updateAir(dt) {
    const drop = this.game.drop;
    drop.updateActor(this, dt);
    const m = this.model;
    if (!this.air) return;                // just landed
    m.root.position.copy(this.ctrl.pos);
    m.root.rotation.y = this.yaw;
    m.root.rotation.x = this.air === 'fall' ? 1.05 : 0;   // belly-down while free-falling
    m.update(dt, {
      speed: 0, localVX: 0, localVZ: 0, crouch: false, onGround: false,
      aimPitch: this.air === 'fall' ? -0.6 : 0, aiming: false, sprint: false,
      reloadT: -1, switchT: 0, healT: 0,
    });
  }

  // ------------------------------------------------------------ healing
  startHeal() {
    if (this.healing || this.inv.medkits <= 0 || this.health.hp >= this.health.max) return false;
    if (this.weapons.reloading) return false;
    this.healing = true;
    this.healT = 0;
    if (this.isPlayer) this.game.ui.healStarted(3.2);
    this.game.audio.click(null, 1400, 0.3, 0.08, this.isPlayer ? null : this.ctrl.pos);
    return true;
  }
  cancelHeal() {
    if (!this.healing) return;
    this.healing = false;
    if (this.isPlayer) this.game.ui.healCancelled();
  }
  updateHeal(dt) {
    const I = this.intent;
    if (I.heal) this.startHeal();
    if (!this.healing) return;
    if (I.firePressed || (I.sprint && Math.hypot(I.mx, I.mz) > 0)) { this.cancelHeal(); return; }
    this.healT += dt;
    if (this.healT >= 3.2) {
      this.healing = false;
      this.inv.medkits--;
      this.health.heal(75);
      if (this.isPlayer) { this.game.ui.healDone(); this.game.audio.pickup('armor'); }
    }
  }

  // ------------------------------------------------------------ geometry helpers
  headWorld(out) {
    const p = this.ctrl.pos;
    const h = this.ctrl.crouching ? 1.22 : 1.7;
    return out.set(p.x + Math.sin(this.yaw) * 0.03, p.y + h, p.z + Math.cos(this.yaw) * 0.03);
  }
  chestWorld(out) {
    const p = this.ctrl.pos;
    return out.set(p.x, p.y + (this.ctrl.crouching ? 0.9 : 1.3), p.z);
  }
  shotOrigin(out) {
    const p = this.ctrl.pos;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return out.set(p.x - c * 0.16, p.y + (this.ctrl.crouching ? 1.12 : 1.55), p.z + s * 0.16);
  }
  forward(out) {
    const cp = Math.cos(this.pitch);
    return out.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
  }
  right(out) {
    return out.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
  }

  footstep() {
    const p = this.ctrl.pos;
    const t = this.game.world.terrain.height(p.x, p.z);
    const surf = p.y > t + 0.05 ? (p.y > t + 2 ? 'stone' : 'stone') : 'dirt';
    const sp = Math.hypot(this.ctrl.vel.x, this.ctrl.vel.z);
    const inten = this.ctrl.crouching ? 0.35 : clamp(sp / 5, 0.4, 1.3);
    this.game.audio.footstep(p, this.isPlayer, inten, surf);
    if (!this.isPlayer && sp > 3) this.game.events.emit('footstep', { actor: this, pos: p });
  }

  // ------------------------------------------------------------ damage
  applyDamage(amount, info) {
    if (!this.alive || this.game.match.state !== 'playing' && !info.zone) return;
    const res = this.health.take(amount, info.headshot, info.explosive);
    const g = this.game;
    const attacker = info.attacker;
    if (attacker && attacker !== this) {
      this.lastHitBy = attacker;
      this.lastHitTime = g.time;
      attacker.damageDealt += res.dealt;
    }
    // reaction
    const dir = info.dir || _v.set(0, 0, 1);
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const localX = dir.x * c - dir.z * s;
    this.model.hit(localX, Math.min(2, amount / 25));
    if (info.point && !info.zone && !info.fall) {
      if (res.armorHit && Math.random() < 0.5) g.fx.armorSpark(info.point, dir);
      g.fx.blood(info.point, dir, info.headshot);
      g.audio.bodyHit(info.point, false);
    }
    if (!info.zone) this.cancelHealOnHit();
    if (this.isPlayer) this.onDamaged(res.dealt, info);
    if (attacker && attacker.isPlayer && attacker !== this) {
      g.ui.hitmarker(info.headshot, res.killed);
      g.ui.damageNumber(info.point || this.chestWorld(new THREE.Vector3()), res.dealt, info.headshot, res.armorHit);
      g.audio.hitmarker(info.headshot, res.killed);
      g.match.onPlayerHit(res.dealt, info.headshot);
    }
    this.onDamagedAI(res.dealt, info);
    if (res.killed) this.die(info);
  }

  cancelHealOnHit() {
    if (this.healing && Math.random() < 0.5) this.cancelHeal();
  }

  die(info) {
    this.alive = false;
    if (this.air) {
      // Killed in the air: the body drops to the ground below.
      const p = this.ctrl.pos;
      p.y = this.game.world.collision.groundAt(p.x, p.z, 0.3, p.y, 0);
      this.air = null;
      if (this.chute) this.chute.visible = false;
      this.model.root.rotation.x = 0;
      this.model.root.position.copy(p);
    }
    this.cancelHeal();
    const attacker = info.attacker || (this.game.time - this.lastHitTime < 8 ? this.lastHitBy : null);
    const dir = info.dir || _v.set(0, 0, 1);
    const fwdDot = Math.sin(this.yaw) * dir.x + Math.cos(this.yaw) * dir.z;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this.model.die(fwdDot > 0, Math.sign(dir.x * c - dir.z * s) || 1);
    if (this.model.weapon) this.model.weapon.visible = false;
    this.game.match.onKill(this, attacker, info);
  }

  onFired() {}
  onDamaged() {}
  onDamagedAI() {}
  suppress() {}

  weaponDef() { return this.inv.def; }
  ammoTotal() {
    const w = this.inv.weapon;
    return w ? w.mag + this.inv.ammo[WEAPONS[w.id].ammo] : 0;
  }

  dispose() {
    this.game.scene.remove(this.model.root);
  }
}
