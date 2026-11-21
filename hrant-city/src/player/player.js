// Hrant: third-person player controller (walk, run, jump, swim, punch, shoot, drive).
import * as THREE from 'three';
import { buildHumanoid } from './humanoid.js';
import { clamp, damp, dampAngle, wrapAngle } from '../utils/math.js';

const SWIM_Y = -1.15;

export class Player {
  constructor(game) {
    this.game = game;
    this.model = buildHumanoid({ shirt: '#ff4f8b', pants: '#f5f5f5', skin: '#e0ac7e', hair: '#1b1b1b', shoes: '#1fb5a8', glasses: true });
    // Hawaiian-ish shirt flowers
    game.scene.add(this.model.group);
    this.x = 0; this.y = 0; this.z = 0; this.vx = 0; this.vz = 0; this.vy = 0;
    this.heading = 0; this.onGround = true; this.swimming = false;
    this.health = 100; this.armor = 0; this.maxHealth = 100;
    this.dead = false; this.vehicle = null;
    this.phase = 0; this.punchT = 0; this.aimT = 0; this.cd = 0; this.hurtT = 0;
    this.lastStep = 0;
    this.speed = 0;
  }

  get inVehicle() { return !!this.vehicle; }
  get pos() { return this.vehicle ? { x: this.vehicle.x, y: this.vehicle.y, z: this.vehicle.z } : { x: this.x, y: this.y, z: this.z }; }

  spawnAt(x, z, h = 0) {
    this.x = x; this.z = z; this.y = this.game.world.heightAt(x, z) + 0.02; this.heading = h;
    this.vx = this.vz = this.vy = 0;
    this.dead = false; this.health = this.maxHealth;
    this.model.group.visible = true;
    this.model.body.rotation.set(0, 0, 0);
    this.model.body.position.set(0, 0, 0);
    this.vehicle = null;
  }

  damage(amount, cause = 'hit') {
    if (this.dead || this.game.state !== 'playing') return;
    if (this.armor > 0) {
      const a = Math.min(this.armor, amount * 0.8);
      this.armor -= a; amount -= a;
    }
    this.health -= amount;
    this.hurtT = 0.4;
    this.game.hud.flashHurt();
    if (this.health <= 0) { this.health = 0; this.die(cause); }
  }

  die(cause) {
    if (this.dead) return;
    this.dead = true;
    if (this.vehicle) this.exitVehicle(true);
    this.model.group.visible = true;
    this.game.onPlayerDeath(cause);
  }

  // ------------------------------------------------------------ update
  update(dt, input, cam) {
    this.cd -= dt; this.punchT -= dt; this.aimT -= dt; this.hurtT -= dt;
    if (this.dead) { this._animDead(dt); return; }
    if (input.pressed('car')) {
      if (this.vehicle) this.exitVehicle();
      else {
        const v = this.game.vehicles.nearestEnterable(this.x, this.z, 4.5);
        if (v) this.enterVehicle(v);
      }
    }
    if (this.vehicle) this._driveUpdate(dt, input);
    else this._footUpdate(dt, input, cam);
  }

  _footUpdate(dt, input, cam) {
    const g = this.game, w = g.world;
    const f = cam.forward, rx = -f.z, rz = f.x;
    const mx = input.move.x, my = input.move.y;
    const mag = Math.min(1, Math.hypot(mx, my));
    let dx = f.x * my + rx * mx, dz = f.z * my + rz * mx;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const touchMag = Math.hypot(input.touchMove.x, input.touchMove.y);
    const running = input.isHeld('sprint') || touchMag > 0.92;
    const target = mag * (this.swimming ? 2.6 : running ? 7.6 : 3.4);
    this.vx = damp(this.vx, dx * target, 10, dt);
    this.vz = damp(this.vz, dz * target, 10, dt);
    this.speed = Math.hypot(this.vx, this.vz);

    if (this.aimT > 0) this.heading = dampAngle(this.heading, cam.yaw, 20, dt);
    else if (mag > 0.1) this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 12, dt);

    if (input.pressed('jump') && this.onGround && !this.swimming) { this.vy = 6.8; this.onGround = false; g.audio.play('jump'); }

    const ox = this.x, oz = this.z, oy = this.y;
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.vy -= 22 * dt; this.y += this.vy * dt;

    // terrain + water
    const gh = w.heightAt(this.x, this.z);
    const stepMax = this.swimming ? 1.5 : 0.7;
    if (gh > oy + stepMax) { this.x = ox; this.z = oz; }
    const ground = w.heightAt(this.x, this.z);
    const water = w.isWater(this.x, this.z) && ground < 0.5;
    if (water && this.y <= SWIM_Y + 0.05) {
      if (!this.swimming) { g.audio.play('splash'); g.fx.splash(this.x, -0.4, this.z); }
      this.y = SWIM_Y; this.vy = Math.max(0, this.vy); this.swimming = true; this.onGround = false;
    } else if (!water && this.y <= ground) {
      if (!this.onGround && this.vy < -14) this.damage((-this.vy - 14) * 4, 'fall');
      this.y = ground; this.vy = 0; this.onGround = true; this.swimming = false;
    } else if (!water) {
      this.swimming = false;
      if (this.y > ground + 0.1) this.onGround = false;
    }

    // collisions: buildings, vehicles, world bounds
    const res = w.colliders.pushCircle(this.x, this.z, 0.4, this.y);
    this.x = res.x; this.z = res.z;
    g.vehicles.pushBody(this, 0.45);
    w.constrain(this);

    // combat
    if (input.pressed('attack') || (input.isHeld('attack') && this.cd <= 0 && this.aimT > 0)) this.attack(cam);

    // footsteps
    if (this.onGround && this.speed > 1) {
      const step = Math.floor(this.phase / Math.PI);
      if (step !== this.lastStep) { this.lastStep = step; g.audio.play('step', running ? 1 : 0.6); }
    }
    this._animate(dt);
  }

  _animate(dt) {
    const m = this.model;
    m.group.position.set(this.x, this.y, this.z);
    m.group.rotation.y = this.heading;
    this.phase += dt * (2.2 + this.speed * 1.5);
    const amp = clamp(this.speed / 4, 0, 1) * 0.8;
    let sw = Math.sin(this.phase) * amp;
    if (!this.onGround && !this.swimming) sw = 0.5;
    m.legL.rotation.x = this.onGround || this.swimming ? sw : -0.6;
    m.legR.rotation.x = this.onGround || this.swimming ? -sw : 0.3;
    m.armL.rotation.x = -sw * 0.9;
    m.armR.rotation.x = sw * 0.9;
    m.body.rotation.x = this.swimming ? 1.2 : 0;
    m.body.position.y = this.swimming ? 0.7 : 0;
    if (this.swimming) { m.armL.rotation.x = Math.sin(this.phase) * 2; m.armR.rotation.x = -Math.sin(this.phase) * 2; }
    if (this.punchT > 0) m.armR.rotation.x = -Math.PI / 2 * (this.punchT / 0.3);
    m.gun.visible = this.aimT > 0 && this.punchT <= 0;
    if (m.gun.visible) m.armR.rotation.x = -Math.PI / 2;
  }

  _animDead(dt) {
    const m = this.model;
    m.body.rotation.x = damp(m.body.rotation.x, -Math.PI / 2, 6, dt);
    m.body.position.y = 0.2;
    m.group.position.set(this.x, Math.max(this.y, this.swimming ? -0.5 : this.y), this.z);
  }

  // ------------------------------------------------------------ combat
  attack(cam) {
    const g = this.game;
    if (this.cd > 0) return;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    // melee first
    let best = null, bd = 2.0;
    for (const c of g.characters()) {
      if (!c.alive) continue;
      const dx = c.x - this.x, dz = c.z - this.z, d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.2) { bd = d; best = c; }
    }
    if (best) {
      this.punchT = 0.3; this.cd = 0.45;
      g.audio.play('punch');
      g.hitCharacter(best, 'punch', this.x, this.z);
      return;
    }
    // pistol (auto-aim in the camera direction)
    this.cd = 0.3; this.aimT = 1.2;
    this.heading = cam.yaw;
    const ax = Math.sin(cam.yaw), az = Math.cos(cam.yaw);
    const ox = this.x + ax * 0.6, oz = this.z + az * 0.6, oy = this.y + 1.45;
    let target = null, tScore = Infinity, tx = ox + ax * 45, tz = oz + az * 45, ty = oy;
    const consider = (x, y, z, obj, radius) => {
      const dx = x - ox, dz = z - oz, along = dx * ax + dz * az;
      if (along < 0.5 || along > 45) return;
      const perp = Math.abs(dx * az - dz * ax);
      if (perp > radius + along * 0.06) return;
      const score = along + perp * 6;
      if (score < tScore && !g.world.colliders.segmentBlocked(ox, oz, x, z, oy)) { tScore = score; target = obj; tx = x; ty = y; tz = z; }
    };
    for (const c of g.characters()) if (c.alive) consider(c.x, c.y + 1.2, c.z, c, 0.6);
    for (const v of g.vehicles.list) if (v.state !== 'wrecked') consider(v.x, v.y + 1, v.z, v, v.spec.width / 2 + 0.6);
    const wallD = g.world.colliders.rayDistance(ox, oz, oy, ax, az, 0, 45, 1);
    if (!target && wallD < 45) { tx = ox + ax * wallD; tz = oz + az * wallD; }
    g.fx.tracer(ox, oy, oz, tx, ty, tz);
    g.audio.play('shot');
    g.wanted.crime(0.6, 'shots');
    g.peds.panic(this.x, this.z, 40);
    if (target) {
      if (target.isVehicle) target.applyDamage(14, true);
      else g.hitCharacter(target, 'shot', this.x, this.z);
    }
  }

  // ------------------------------------------------------------ vehicles
  enterVehicle(v) {
    const g = this.game;
    if (v.state === 'wrecked') return;
    if (v.driver === 'ai') g.carjack(v);
    v.driver = 'player';
    v.ai = null;
    this.vehicle = v;
    this.swimming = false;
    this.model.group.visible = v.spec.showRider;
    g.audio.play('door');
    g.onEnterVehicle(v);
  }

  exitVehicle(force = false) {
    const g = this.game, v = this.vehicle;
    if (!v) return;
    const w = g.world;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading), rx = -fz, rz = fx;
    const side = v.spec.width / 2 + 0.9;
    const cands = [[-rx * side, -rz * side], [rx * side, rz * side], [fx * (v.spec.length / 2 + 1), fz * (v.spec.length / 2 + 1)], [-fx * (v.spec.length / 2 + 1), -fz * (v.spec.length / 2 + 1)]];
    let px = v.x + cands[0][0], pz = v.z + cands[0][1];
    for (const [ox, oz] of cands) {
      const x = v.x + ox, z = v.z + oz;
      if (!w.colliders.pointBlocked(x, z, v.y + 0.5)) { px = x; pz = z; break; }
    }
    this.x = px; this.z = pz;
    const gh = w.heightAt(px, pz);
    this.y = w.isWater(px, pz) && gh < 0.5 ? SWIM_Y : Math.max(gh, v.y);
    this.swimming = w.isWater(px, pz) && gh < 0.5;
    this.vx = this.vz = this.vy = 0;
    this.heading = v.heading;
    const speed = Math.abs(v.forwardSpeed);
    v.driver = null;
    v.controls.throttle = 0; v.controls.brake = 0; v.controls.steer = 0; v.controls.handbrake = true;
    this.vehicle = null;
    this.model.group.visible = true;
    this.model.body.rotation.set(0, 0, 0); this.model.body.position.set(0, 0, 0);
    g.onExitVehicle(v);
    if (!force && speed > 12) this.damage(Math.min(40, (speed - 12) * 2), 'jump');
  }

  _driveUpdate(dt, input) {
    const g = this.game, v = this.vehicle;
    const c = v.controls, my = input.move.y;
    c.throttle = Math.max(input.isHeld('gas') ? 1 : 0, my > 0.15 ? my : 0);
    c.brake = Math.max(input.isHeld('brake') ? 1 : 0, my < -0.15 ? -my : 0);
    c.steer = input.move.x;
    c.handbrake = input.isHeld('handbrake');
    g.audio.horn(input.isHeld('horn'));
    if (input.isHeld('horn')) g.peds.panic(v.x, v.z, 12, true);
    this.x = v.x; this.y = v.y; this.z = v.z;
    if (v.spec.showRider) {
      const m = this.model;
      const sy = v.spec.seatY, sz = v.spec.seatZ;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      m.group.position.set(v.x + fx * sz, v.y + sy + (v.mesh.position.y - v.y), v.z + fz * sz);
      m.group.rotation.set(v.mesh.rotation.x, v.heading, v.mesh.rotation.z, 'YXZ');
      m.body.position.y = -0.55; m.body.rotation.x = 0;
      m.legL.rotation.x = -1.3; m.legR.rotation.x = -1.3;
      m.armL.rotation.x = -1.1; m.armR.rotation.x = -1.1;
      m.gun.visible = false;
    }
    if (v.state === 'wrecked' && v.sunk) this.exitVehicle(true);
    void wrapAngle; void THREE;
  }
}
