// Player: input → intent, third-person camera rig with collision, recoil, ADS/scope, interaction.
import * as THREE from 'three';
import { Actor } from './Actor.js';
import { WEAPONS } from '../combat/WeaponDefs.js';
import { RARITY } from '../config.js';
import { clamp, damp, lerp, rand } from '../core/util.js';

const _v = new THREE.Vector3();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _piv = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _h = new THREE.Vector3();
const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const BASE_FOV = 72;

export class Player extends Actor {
  constructor(game, opts) {
    super(game, { ...opts, isPlayer: true });
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.camDist = 3.0;
    this.pivotY = 0;
    this.fov = BASE_FOV;
    this.scoped = false;
    this.grenadeHeld = false;
    this.grenadeLine = null;
    this.suppression = 0;
    this.trauma = 0;
    this.shakeT = 0;
    this.lastHurtDir = 0;
    this.toggleCrouch = false;
    this.aimHit = null;
    this.mapOpen = false;
  }

  spawn(x, z, yaw) {
    super.spawn(x, z, yaw);
    this.pivotY = this.ctrl.pos.y + 1.62;
    this.recoilPitch = this.recoilYaw = 0;
    this.toggleCrouch = false;
    this.grenadeHeld = false;
    this.suppression = 0;
    this.model.root.visible = true;
    this.inv.ammo.light = 48;
  }

  // ------------------------------------------------------------ input
  readInput(dt) {
    const g = this.game, inp = g.input, I = this.intent;
    const sens = 0.0021 * g.save.data.settings.sensitivity * (this.fov / BASE_FOV);
    if (inp.locked) {
      this.yaw -= inp.mouse.dx * sens;
      this.pitch -= inp.mouse.dy * sens * (g.save.data.settings.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.25, 1.2);
    }
    if (inp.touch) {
      const fovK = this.fov / BASE_FOV;
      this.yaw -= inp.look.yaw * fovK;
      this.pitch -= inp.look.pitch * fovK;
      this.pitch = clamp(this.pitch, -1.25, 1.2);
    }
    let fx = 0, fz = 0;
    if (inp.down('KeyW')) fz += 1;
    if (inp.down('KeyS')) fz -= 1;
    if (inp.down('KeyA')) fx -= 1;
    if (inp.down('KeyD')) fx += 1;
    I.speedScale = 1;
    if (inp.axis.active) {
      // Analog joystick: light push walks, full push runs.
      fx = inp.axis.x; fz = -inp.axis.y;
      const m = Math.hypot(fx, fz);
      I.speedScale = m < 0.55 ? 0.55 : 1;
    }
    const len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    // world = forward*fz + right*fx; right = (-c, 0, s)
    I.mx = s * fz - c * fx;
    I.mz = c * fz + s * fx;
    I.sprint = inp.down('ShiftLeft') || inp.down('ShiftRight') || inp.axis.sprint;
    if (I.sprint && fz <= 0) I.sprint = false;
    if (inp.hit('KeyC') || inp.hit('ControlLeft')) this.toggleCrouch = !this.toggleCrouch;
    if (I.sprint && this.toggleCrouch && len > 0) this.toggleCrouch = false;
    I.crouch = this.toggleCrouch;
    I.jump = inp.hit('Space');
    if (I.jump && this.toggleCrouch) { this.toggleCrouch = false; I.jump = false; }
    I.aiming = inp.mouse.right && !this.healing;
    I.fire = inp.mouse.left && !this.grenadeHeld;
    I.firePressed = inp.mouse.leftPressed && !this.grenadeHeld;
    if (I.fire) I.sprint = false;
    I.reload = inp.hit('KeyR');
    I.heal = inp.hit('KeyH') || inp.hit('Digit4');
    I.slot = null;
    if (inp.hit('Digit1')) I.slot = 0;
    if (inp.hit('Digit2')) I.slot = 1;
    if (inp.hit('Digit3')) I.slot = 2;
    if (inp.mouse.wheel !== 0) {
      for (let k = 1; k <= 3; k++) {
        const sl = (this.inv.current + (inp.mouse.wheel > 0 ? k : -k) + 6) % 3;
        if (this.inv.slots[sl]) { I.slot = sl; break; }
      }
    }
    if (inp.touch && g.save.data.settings.aimAssist) this.aimAssist(dt, I);
    if (inp.hit('KeyF')) g.loot.tryPickup(this);
    if (inp.hit('KeyM')) { this.mapOpen = !this.mapOpen; g.ui.toggleBigMap(this.mapOpen); }
    // grenade: hold to aim, release to throw
    if (inp.hit('KeyG') && this.inv.grenades > 0 && !this.healing) this.grenadeHeld = true;
    if (this.grenadeHeld && (inp.up('KeyG') || !inp.down('KeyG'))) {
      this.grenadeHeld = false;
      this.throwGrenade();
    }
  }

  // Mobile aim assist: gentle magnetism toward a visible enemy near the crosshair while
  // aiming or firing. It only nudges the view; bullets still need to physically hit.
  aimAssist(dt, I) {
    const g = this.game;
    const engaged = I.aiming || I.fire;
    this.assistT = (this.assistT || 0) - dt;
    if (this.assistT <= 0) {
      this.assistT = 0.15;
      this.assistTarget = null;
      const o = this.shotOrigin(_v);
      let best = 0.13;
      for (const a of g.actors) {
        if (a === this || !a.alive) continue;
        a.chestWorld(_h);
        const dx = _h.x - o.x, dy = _h.y - o.y, dz = _h.z - o.z;
        const d = Math.hypot(dx, dy, dz);
        if (d > 90 || d < 1) continue;
        const yawTo = Math.atan2(dx, dz), pitchTo = Math.asin(dy / d);
        const ang = Math.hypot(wrap(yawTo - this.yaw), pitchTo - this.pitch);
        if (ang > best) continue;
        if (!g.world.collision.clear(o.x, o.y, o.z, _h.x, _h.y, _h.z)) continue;
        best = ang; this.assistTarget = a;
      }
    }
    const t = this.assistTarget;
    if (!t || !t.alive || !engaged) return;
    const o = this.shotOrigin(_v);
    t.chestWorld(_h);
    const dx = _h.x - o.x, dy = _h.y - o.y, dz = _h.z - o.z;
    const d = Math.hypot(dx, dy, dz);
    const yawTo = Math.atan2(dx, dz), pitchTo = Math.asin(dy / d);
    const k = 1 - Math.exp(-(I.aiming ? 5 : 3) * dt);
    this.yaw += wrap(yawTo - this.yaw - this.recoilYaw) * k;
    // compensate for the camera recoil offset so the crosshair (pitch + recoil) settles on target
    this.pitch += (pitchTo - this.recoilPitch - this.pitch) * k * 0.6;
  }

  grenadeVelocity(out) {
    this.forward(_f);
    const pitch = clamp(this.pitch + 0.25, -0.6, 1.2);
    const cp = Math.cos(pitch);
    return out.set(Math.sin(this.yaw) * cp, Math.sin(pitch), Math.cos(this.yaw) * cp).multiplyScalar(17).add(_v.copy(this.ctrl.vel).multiplyScalar(0.5));
  }

  throwGrenade() {
    if (this.inv.grenades <= 0 || !this.alive) return;
    this.inv.grenades--;
    const o = this.shotOrigin(new THREE.Vector3());
    o.y += 0.2;
    this.game.projectiles.throwGrenade(this, o, this.grenadeVelocity(new THREE.Vector3()));
    this.model.fire(1);
    this.game.audio.whoosh();
  }

  update(dt) {
    if (this.alive && this.game.match.state === 'playing' && !this.game.paused) this.readInput(dt);
    else {
      const I = this.intent;
      I.mx = I.mz = 0; I.fire = I.firePressed = I.jump = I.reload = I.heal = false; I.slot = null;
    }
    super.update(dt);
    this.suppression = Math.max(0, this.suppression - dt * 0.8);
  }

  onFired(def, item) {
    const R = RARITY[item.rarity];
    const ads = this.aimF;
    const crouch = (this.ctrl.crouching ? 0.75 : 1) * (this.game.input.touch ? 0.7 : 1);
    const v = def.recoilV * R.recoil * crouch * (1 - ads * 0.3) * DEG;
    const h = def.recoilH * R.recoil * crouch * DEG;
    this.recoilPitch += v;
    this.pitch += v * 0.35;
    this.recoilYaw += rand(-h, h) * 0.6;
    this.yaw += rand(-h, h) * 0.4;
    this.trauma = Math.min(1, this.trauma + def.kick * 0.8);
  }

  onDamaged(amount, info) {
    const g = this.game;
    if (amount <= 0) return;
    g.audio.hurt(amount);
    this.trauma = Math.min(1, this.trauma + Math.min(0.6, amount / 40));
    if (info.attacker && info.attacker !== this) {
      const a = info.attacker.ctrl.pos;
      const ang = Math.atan2(a.x - this.ctrl.pos.x, a.z - this.ctrl.pos.z) - this.yaw;
      g.ui.damageDirection(ang);
    } else if (info.dir && !info.zone) {
      g.ui.damageDirection(Math.atan2(-info.dir.x, -info.dir.z) - this.yaw);
    }
    g.ui.damageFlash(Math.min(1, amount / 30));
  }

  // Bots deal slightly reduced damage to the player to keep fights fair and readable.
  applyDamage(amount, info) {
    if (info && info.attacker && !info.attacker.isPlayer) amount *= 0.8;
    super.applyDamage(amount, info);
  }

  suppress(v) {
    this.suppression = Math.min(1, this.suppression + v * 0.5);
    this.trauma = Math.min(1, this.trauma + v * 0.12);
  }

  addShake(t) { this.trauma = Math.min(1, this.trauma + t); }

  // ------------------------------------------------------------ camera
  updateCamera(dt, camera) {
    const g = this.game;
    const def = this.inv.def;
    // recoil recovery
    const rec = def ? def.recoilRecover : 8;
    const back = this.recoilPitch * (1 - Math.exp(-rec * dt));
    this.recoilPitch -= back;
    this.pitch -= back * 0.25;
    this.recoilYaw = damp(this.recoilYaw, 0, rec, dt);
    const ads = this.aimF;
    this.scoped = !!(def && def.scope && ads > 0.85 && this.alive);
    const crouch = this.ctrl.crouching;
    const targetPivot = this.ctrl.pos.y + (crouch ? 1.22 : 1.62);
    this.pivotY = damp(this.pivotY, targetPivot, Math.abs(targetPivot - this.pivotY) > 1.5 ? 30 : 14, dt);
    const yaw = this.yaw + this.recoilYaw;
    const pitch = this.pitch + this.recoilPitch;
    _f.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    _r.set(-Math.cos(yaw), 0, Math.sin(yaw));
    let dist = lerp(3.1, 1.45, ads);
    let shoulder = lerp(0.62, 0.55, ads);
    if (this.scoped) { dist = 0; shoulder = 0; }
    if (!this.alive) { dist = 4.5; shoulder = 0.3; }
    _piv.set(this.ctrl.pos.x, this.pivotY, this.ctrl.pos.z);
    // collision: shoulder side then back
    const col = g.world.collision;
    const sideHit = col.raycast(_piv.x, _piv.y, _piv.z, _r.x, 0, _r.z, shoulder + 0.25, { noTerrain: false });
    if (sideHit) shoulder = Math.max(0, sideHit.t - 0.25);
    _piv.addScaledVector(_r, shoulder);
    let want = dist;
    if (dist > 0) {
      const hit = col.raycast(_piv.x, _piv.y, _piv.z, -_f.x, -_f.y, -_f.z, dist + 0.3);
      if (hit) want = Math.max(0.2, hit.t - 0.3);
    }
    this.camDist = want < this.camDist ? want : damp(this.camDist, want, 6, dt);
    _cam.copy(_piv).addScaledVector(_f, -this.camDist);
    // keep camera above terrain
    const th = g.world.terrain.height(_cam.x, _cam.z) + 0.3;
    if (_cam.y < th) _cam.y = th;
    // screen shake (trauma model)
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.shakeT += dt * 30;
    const sh = this.trauma * this.trauma;
    camera.position.copy(_cam);
    _v.copy(_cam).add(_f);
    camera.lookAt(_v);
    if (sh > 0) {
      camera.rotateX((Math.sin(this.shakeT * 1.1) + Math.sin(this.shakeT * 2.3)) * 0.012 * sh);
      camera.rotateY((Math.sin(this.shakeT * 0.9 + 3) + Math.sin(this.shakeT * 1.9)) * 0.012 * sh);
      camera.rotateZ(Math.sin(this.shakeT * 1.3 + 7) * 0.02 * sh);
    }
    // FOV
    let fov = BASE_FOV;
    if (def) fov = lerp(BASE_FOV, def.adsFov, ads);
    if (this.intent.sprint && Math.hypot(this.ctrl.vel.x, this.ctrl.vel.z) > 5 && ads < 0.1) fov += 6;
    this.fov = damp(this.fov, fov, 12, dt);
    if (Math.abs(camera.fov - this.fov) > 0.01) { camera.fov = this.fov; camera.updateProjectionMatrix(); g.onFovChange(); }
    // hide the body when the camera is inside it / scoped
    this.model.root.visible = !this.scoped && this.camDist > 0.55;
    // aim point (ray from camera, skipping things between camera and player)
    const start = this.camDist + 0.4;
    const ox = _cam.x + _f.x * start, oy = _cam.y + _f.y * start, oz = _cam.z + _f.z * start;
    const maxD = 600;
    const wh = col.raycast(ox, oy, oz, _f.x, _f.y, _f.z, maxD, { bullets: true });
    let best = wh ? wh.t : maxD;
    let enemy = null;
    for (const a of g.actors) {
      if (a === this || !a.alive) continue;
      a.headWorld(_h);
      const dx = _h.x - ox, dy = _h.y - 0.45 - oy, dz = _h.z - oz;
      const t = dx * _f.x + dy * _f.y + dz * _f.z;
      if (t < 0 || t > best) continue;
      const px = ox + _f.x * t - a.ctrl.pos.x, pz = oz + _f.z * t - a.ctrl.pos.z;
      const py = oy + _f.y * t;
      if (px * px + pz * pz < 0.16 && py > a.ctrl.pos.y && py < _h.y + 0.15) { best = t; enemy = a; }
    }
    this.intent.aimPoint.set(ox + _f.x * best, oy + _f.y * best, oz + _f.z * best);
    this.aimEnemy = enemy;
    // grenade arc preview
    this.updateGrenadeArc();
    // audio listener
    g.audio.setListener(camera.position, _f);
  }

  updateGrenadeArc() {
    const g = this.game;
    if (!this.grenadeLine) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
      this.grenadeLine = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0xffc35a, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.9, depthTest: false }));
      this.grenadeLine.frustumCulled = false;
      this.grenadeLine.renderOrder = 10;
      g.scene.add(this.grenadeLine);
    }
    this.grenadeLine.visible = this.grenadeHeld && this.alive;
    if (!this.grenadeHeld) return;
    const o = this.shotOrigin(new THREE.Vector3());
    o.y += 0.2;
    const pts = g.projectiles.predict(o, this.grenadeVelocity(new THREE.Vector3()), [], 55);
    const arr = this.grenadeLine.geometry.attributes.position.array;
    for (let i = 0; i < 60; i++) {
      const p = pts[Math.min(i, pts.length - 1)];
      arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
    }
    this.grenadeLine.geometry.attributes.position.needsUpdate = true;
    this.grenadeLine.computeLineDistances();
  }

  spreadPx(camera, height) {
    const def = this.inv.def;
    const w = this.inv.weapon;
    if (!def) return 10;
    const deg = this.weapons.currentSpread(def, w);
    const rad = deg * DEG;
    return Math.tan(rad) / Math.tan((camera.fov * DEG) / 2) * (height / 2);
  }

  weaponLabel() {
    const w = this.inv.weapon;
    return w ? WEAPONS[w.id].name : '';
  }
}
