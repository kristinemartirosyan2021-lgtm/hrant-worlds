// Vehicle with arcade physics: acceleration, grip/drift, collisions, damage, fire, explosion.
import * as THREE from 'three';
import { VEHICLES, buildVehicleGeometry } from './carModels.js';
import { clamp, damp } from '../utils/math.js';

let bodyMat = null, lightMat = null, beamMat = null, beamGeo = null;
function materials(game) {
  if (!bodyMat) {
    bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    beamMat = new THREE.MeshBasicMaterial({ map: game.textures.beam, color: '#fff2c8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    beamGeo = new THREE.PlaneGeometry(4.5, 14);
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0.12, 9);
  }
  return { bodyMat, lightMat, beamMat, beamGeo };
}
export function setBeamOpacity(o) { if (beamMat) beamMat.opacity = o; }

let nextId = 1;

export class Vehicle {
  constructor(game, type, x, z, heading, color) {
    this.id = nextId++;
    this.game = game;
    this.type = type;
    this.spec = VEHICLES[type];
    this.isVehicle = true;
    this.isPolice = type === 'police';
    this.color = color;
    const { bodyMat: bm, lightMat: lm, beamMat: em, beamGeo: eg } = materials(game);
    const geo = buildVehicleGeometry(type, color);
    this.mesh = new THREE.Group();
    this.mesh.rotation.order = 'YXZ';
    this.body = new THREE.Mesh(geo.body, bm);
    this.body.castShadow = game.quality.shadows;
    this.mesh.add(this.body);
    if (geo.lights) { this.lights = new THREE.Mesh(geo.lights, lm); this.mesh.add(this.lights); }
    if (geo.siren) {
      this.sirenR = new THREE.Mesh(geo.siren.red, lm); this.sirenB = new THREE.Mesh(geo.siren.blue, lm);
      this.mesh.add(this.sirenR, this.sirenB);
    }
    if (!this.spec.water && type !== 'bike') { this.beam = new THREE.Mesh(eg, em); this.beam.position.z = this.spec.length / 2 - 1; this.mesh.add(this.beam); }
    game.scene.add(this.mesh);

    this.x = x; this.z = z; this.heading = heading;
    this.y = this.spec.water ? -0.45 : game.world.heightAt(x, z);
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.steerS = 0;
    this.health = this.spec.health;
    this.state = 'ok'; // ok | burning | wrecked
    this.burnT = 0; this.sinkT = 0; this.sunk = false; this.wreckT = 0;
    this.driver = null; // 'player' | 'ai' | null
    this.ai = null;
    this.siren = false;
    this.lastHitByPlayer = -100;
    this.mission = false;
    this.persistent = false;
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: true };
    this.smokeT = 0;
    this.sleep = 0;
    // collision circles along the body
    const w = Math.max(this.spec.width, 1.1);
    const n = Math.max(1, Math.round(this.spec.length / w));
    this.radius = w / 2 + 0.05;
    this.circles = [];
    for (let i = 0; i < n; i++) this.circles.push(n === 1 ? 0 : -(this.spec.length - w) / 2 + ((this.spec.length - w) * i) / (n - 1));
    this.boundR = this.spec.length / 2 + 0.3;
    this.syncMesh();
  }

  get forwardSpeed() { return this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading); }
  get speed() { return Math.hypot(this.vx, this.vz); }

  applyDamage(amount, byPlayer = false) {
    if (this.state === 'wrecked' || amount <= 0) return;
    if (byPlayer) this.lastHitByPlayer = this.game.time;
    if (this.driver === 'player' && this.game.cheatGod) return;
    this.health -= amount;
    if (this.health <= 0 && this.state === 'ok') {
      this.health = 0;
      this.state = 'burning';
      this.burnT = 3.2;
    }
    if (this.ai && this.ai.onDamage) this.ai.onDamage(amount, byPlayer);
  }

  explode() {
    const g = this.game;
    this.state = 'wrecked';
    this.wreckT = 0;
    this.vy = 7; this.vx *= 0.3; this.vz *= 0.3;
    // char the paint
    const c = this.body.geometry.attributes.color;
    for (let i = 0; i < c.array.length; i++) c.array[i] *= 0.18;
    c.needsUpdate = true;
    if (this.lights) this.lights.visible = false;
    if (this.beam) this.beam.visible = false;
    if (this.sirenR) { this.sirenR.visible = this.sirenB.visible = false; }
    this.siren = false;
    const byPlayer = this.driver === 'player' || g.time - this.lastHitByPlayer < 10;
    if (this.driver === 'player') g.player.die('explosion');
    g.explosion(this.x, this.y + 1, this.z, byPlayer && !g.player.dead, this);
    if (this.driver === 'ai' && this.ai && this.ai.onWrecked) this.ai.onWrecked();
    if (this.driver === 'ai') this.driver = null;
  }

  update(dt) {
    const g = this.game, w = g.world, s = this.spec, c = this.controls;
    const moving = this.speed > 0.05 || this.vy !== 0 || this.driver || this.state === 'burning';
    if (!moving) { this.sleep += dt; if (this.sleep > 0.5) return; } else this.sleep = 0;

    if (this.state === 'burning') {
      this.burnT -= dt;
      g.fx.fire(this.x, this.y + 1, this.z, dt);
      if (this.burnT <= 0) this.explode();
    } else if (this.state === 'ok' && this.health < s.health * 0.35) {
      this.smokeT -= dt;
      if (this.smokeT < 0) { this.smokeT = 0.12; g.fx.smoke(this.x + Math.sin(this.heading) * s.length * 0.35, this.y + 1.1, this.z + Math.cos(this.heading) * s.length * 0.35); }
    }
    const disabled = this.state === 'wrecked' || this.sinkT > 0;
    const throttle = disabled ? 0 : c.throttle, brake = disabled ? 0 : c.brake;
    const steerIn = disabled ? 0 : c.steer, handbrake = disabled ? true : c.handbrake;

    // --- steering (heading first, then velocity is re-projected => natural drift)
    let vF = this.forwardSpeed;
    this.steerS = damp(this.steerS, steerIn, 8, dt);
    const speedFac = clamp(vF / 6, -1, 1) * (1 - 0.45 * clamp(Math.abs(vF) / s.maxSpeed, 0, 1));
    let yaw = -this.steerS * s.steerRate * speedFac;
    if (handbrake && Math.abs(vF) > 4) yaw *= 1.5;
    this.heading += yaw * dt;

    const fx = Math.sin(this.heading), fz = Math.cos(this.heading), rx = -fz, rz = fx;
    vF = this.vx * fx + this.vz * fz;
    let vR = this.vx * rx + this.vz * rz;
    const onGround = this.y <= w.heightAt(this.x, this.z) + 0.15 || s.water;

    if (onGround) {
      if (throttle > 0) vF += s.accel * throttle * dt * (vF < 0 ? 2.2 : 1);
      if (brake > 0) {
        if (vF > 0.6) vF -= 26 * brake * dt;
        else vF = Math.max(-s.maxReverse, vF - s.accel * 0.7 * brake * dt);
      }
      if (vF > s.maxSpeed) vF = damp(vF, s.maxSpeed, 3, dt);
      vF -= vF * s.drag * dt;
      if (throttle === 0 && brake === 0) vF *= Math.exp(-(handbrake ? 1.6 : 0.35) * dt);
      if (handbrake) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 9 * dt);
      let grip = handbrake ? s.driftGrip : s.grip;
      grip *= 1 - 0.35 * Math.abs(this.steerS) * clamp(Math.abs(vF) / s.maxSpeed, 0, 1);
      if (this.state === 'wrecked') grip = 4;
      vR *= Math.exp(-grip * dt);
      this.drifting = Math.abs(vR) > 4.5 && Math.abs(vF) > 8;
    }
    this.vx = fx * vF + rx * vR;
    this.vz = fz * vF + rz * vR;

    // --- integrate
    const ox = this.x, oz = this.z;
    this.x += this.vx * dt; this.z += this.vz * dt;

    if (s.water) {
      if (!w.isWater(this.x, this.z) || w.heightAt(this.x, this.z) > 0.5) {
        this.x = ox; this.z = oz; this.vx *= -0.3; this.vz *= -0.3;
        this.applyDamage(Math.max(0, this.speed - 6) * 2, this.driver === 'player');
      }
      this.y = -0.45 + Math.sin(g.time * 2 + this.id) * 0.05;
    } else {
      const gh = w.heightAt(this.x, this.z);
      if (gh > this.y + 1.2) { this.x = ox; this.z = oz; this.vx *= -0.3; this.vz *= -0.3; }
      const ground = w.heightAt(this.x, this.z);
      const inWater = w.isWater(this.x, this.z) && this.y < 0.6;
      if (inWater) {
        if (this.sinkT === 0) { g.fx.splash(this.x, -0.4, this.z); if (this.driver === 'player') g.audio.play('splash'); }
        this.sinkT += dt;
        this.y = damp(this.y, -1.7, 1.5, dt);
        this.vx *= Math.exp(-2.5 * dt); this.vz *= Math.exp(-2.5 * dt);
        if (this.sinkT > 2.5 && this.state !== 'wrecked') { this.state = 'wrecked'; this.sunk = true; this.health = 0; }
      } else if (this.y > ground + 0.6 || this.vy > 0) {
        this.vy -= 25 * dt; this.y += this.vy * dt;
        if (this.y <= ground) {
          if (this.vy < -8) this.applyDamage((-this.vy - 8) * 3, this.driver === 'player');
          this.y = ground; this.vy = 0;
        }
      } else { this.y = ground; this.vy = 0; }
    }

    // --- buildings
    const cols = w.colliders;
    let hitN = null;
    for (const o of this.circles) {
      const cx = this.x + fx * o, cz = this.z + fz * o;
      const r = cols.pushCircle(cx, cz, this.radius, this.y + 0.5);
      if (r.hit) { this.x += r.x - cx; this.z += r.z - cz; hitN = r; }
    }
    if (hitN) this._impact(hitN.nx, hitN.nz, 0.25);
    const prevZ = this.z;
    if (w.constrain(this)) { this._impact(0, prevZ > this.z ? -1 : 1, 0.2); }
    this.syncMesh(dt);
  }

  _impact(nx, nz, bounce) {
    const vn = this.vx * nx + this.vz * nz;
    if (vn >= 0) return;
    this.vx -= nx * vn * (1 + bounce); this.vz -= nz * vn * (1 + bounce);
    const impact = -vn;
    if (impact > 5) {
      this.applyDamage((impact - 5) * 3.2, false);
      if (this.driver === 'player') {
        this.game.audio.play('crash', clamp(impact / 25, 0.2, 1));
        this.game.cam.addShake(clamp(impact / 20, 0.1, 1));
      }
    }
  }

  syncMesh(dt = 0) {
    const s = this.spec, w = this.game.world;
    this.mesh.position.set(this.x, this.y, this.z);
    let pitch = 0, roll = 0;
    if (!s.water) {
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading), hl = s.length / 2;
      const hf = w.heightAt(this.x + fx * hl, this.z + fz * hl), hb = w.heightAt(this.x - fx * hl, this.z - fz * hl);
      if (this.y < Math.max(hf, hb) + 0.3) pitch = -Math.atan2(hf - hb, s.length);
      const vR = this.vx * -fz + this.vz * fx;
      roll = s.lean ? -this.steerS * clamp(this.forwardSpeed / 15, 0, 1) * 0.5 : clamp(vR * 0.012, -0.08, 0.08);
      if (this.state === 'wrecked' && this.sunk) roll = 0.4;
    } else {
      pitch = -clamp(this.forwardSpeed / 40, 0, 1) * 0.12;
      roll = -this.steerS * 0.12;
    }
    if (dt) {
      this.mesh.rotation.x = damp(this.mesh.rotation.x, pitch, 10, dt);
      this.mesh.rotation.z = damp(this.mesh.rotation.z, roll, 6, dt);
    }
    this.mesh.rotation.y = this.heading;
    if (this.sirenR) {
      const on = this.siren && Math.floor(this.game.time * 6) % 2 === 0;
      this.sirenR.visible = !this.siren || on;
      this.sirenB.visible = !this.siren || !on;
    }
  }

  dispose() {
    this.game.scene.remove(this.mesh);
    this.body.geometry.dispose();
    if (this.lights) this.lights.geometry.dispose();
    if (this.sirenR) { this.sirenR.geometry.dispose(); this.sirenB.geometry.dispose(); }
  }
}
