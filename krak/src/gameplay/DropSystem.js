// Aircraft drop at match start: everyone rides a transport plane across the map,
// jumps out (player chooses when), free-falls, opens a parachute and lands.
import * as THREE from 'three';
import { PartSet, GEO, stdMat } from '../entities/meshUtil.js';
import { MAP } from '../config.js';
import { clamp, damp, rand } from '../core/util.js';

const ALT = 150;              // flight altitude (m)
const SPEED = 18;             // plane speed (m/s)
const FALL_V = 42;            // terminal free-fall speed
const FALL_H = 18;            // free-fall steering speed
const CHUTE_V = 5.5;          // descent speed under canopy
const CHUTE_H = 9;            // canopy steering speed
const AUTO_CHUTE = 60;        // auto-open height above ground

const _v = new THREE.Vector3();

function buildPlane() {
  const g = new THREE.Group();
  g.name = 'plane';
  const body = stdMat('#5d6656', 0.7, 0.3);
  const dark = stdMat('#2d322c', 0.6, 0.4);
  const glass = stdMat('#1c2a33', 0.15, 0.8);
  const P = new PartSet()
    .add(GEO.cylZ, body, 0, 0, 0, 3.6, 3.6, 22)             // fuselage
    .add(GEO.sphere, body, 0, 0, 11, 3.6, 3.6, 4.5)          // nose
    .add(GEO.cone, body, 0, 0.6, -13.5, 3.4, 6, 3.2, -Math.PI / 2) // tail cone
    .box(glass, 2.4, 0.9, 1.2, 0, 1.1, 12.2)                 // cockpit glass
    .box(body, 34, 0.45, 4.2, 0, 1.3, 1)                     // wings
    .box(body, 11, 0.35, 2.4, 0, 1.8, -14)                   // tail plane
    .box(body, 0.45, 5, 3.6, 0, 3.6, -14)                    // fin
    .box(dark, 30, 0.12, 0.5, 0, 1.55, 2.6)                  // wing flaps line
    .box(stdMat('#c8102e', 0.6), 0.5, 0.9, 2.4, 0, 4.9, -14.2)  // red
    .box(stdMat('#0033a0', 0.6), 0.5, 0.9, 2.4, 0, 4.0, -14.2)  // blue
    .box(stdMat('#f2a800', 0.6), 0.5, 0.9, 2.4, 0, 3.1, -14.2); // apricot (tricolour on the fin)
  for (const x of [-8, 8]) {
    P.add(GEO.cylZ, dark, x, 0.6, 3.4, 1.5, 1.5, 4.5);        // engines
    P.add(GEO.cone, dark, x, 0.6, 6.0, 1.1, 1.0, 1.1, Math.PI / 2);
  }
  P.box(dark, 3.6, 0.1, 6, 0, -1.9, -9);                     // rear ramp
  P.build(g);
  const props = [];
  for (const x of [-8, 8]) {
    const p = new THREE.Mesh(GEO.box, stdMat('#1a1a1a', 0.5, 0.5));
    p.scale.set(5.4, 0.35, 0.12);
    p.position.set(x, 0.6, 6.6);
    g.add(p);
    props.push(p);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.props = props;
  return g;
}

// Canopy texture: stripes in the colours of the Armenian flag + apricot accents.
let canopyTex = null;
function canopyTexture() {
  if (canopyTex) return canopyTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 32;
  const x = c.getContext('2d');
  const cols = ['#d8202f', '#1f4aa8', '#f2a800', '#f4efe6'];
  for (let i = 0; i < 16; i++) { x.fillStyle = cols[i % 4]; x.fillRect(i * 16, 0, 16, 32); }
  canopyTex = new THREE.CanvasTexture(c);
  canopyTex.colorSpace = THREE.SRGBColorSpace;
  canopyTex.wrapS = THREE.RepeatWrapping;
  return canopyTex;
}

export function buildChute() {
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.42),
    new THREE.MeshStandardMaterial({ map: canopyTexture(), side: THREE.DoubleSide, roughness: 0.9 }),
  );
  canopy.scale.set(3.4, 1.6, 2.6);
  canopy.position.y = 3.2;
  canopy.castShadow = true;
  g.add(canopy);
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pts.push(Math.cos(a) * 3.4 * 0.97, 3.2 + 1.6 * Math.cos(Math.PI * 0.42), Math.sin(a) * 2.6 * 0.97, i < 4 ? 0.18 : -0.18, 1.45, 0);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x222222 })));
  g.userData.canopy = canopy;
  return g;
}

export class DropSystem {
  constructor(game) {
    this.game = game;
    this.plane = buildPlane();
    this.plane.visible = false;
    game.scene.add(this.plane);
    this.pos = new THREE.Vector3();
    this.dir = new THREE.Vector3();
    this.active = false;
  }

  // Random straight flight line through the middle part of the map.
  setup() {
    const ang = Math.random() * Math.PI * 2;
    this.dir.set(Math.cos(ang), 0, Math.sin(ang));
    const off = rand(-40, 40);
    this.center = new THREE.Vector3(-this.dir.z * off, 0, this.dir.x * off);
    this.startD = -235;
    this.ejectD = MAP.half - 18;           // everyone is out before the far edge
    this.endD = 260;
    this.d = this.startD;
    this.t = 0;
    this.flying = false;
    this.active = true;
    this.landedAll = false;
    this.updatePlane(0);
    this.plane.visible = true;
  }

  pointAt(d, out = new THREE.Vector3()) {
    return out.copy(this.center).addScaledVector(this.dir, d).setY(ALT);
  }
  // Path distance at which the plane is closest to a ground point.
  alongOf(x, z) { return (x - this.center.x) * this.dir.x + (z - this.center.z) * this.dir.z; }

  get timeToEject() { return Math.max(0, (this.ejectD - this.d) / SPEED); }
  get overMap() { return Math.abs(this.pos.x) < MAP.half - 5 && Math.abs(this.pos.z) < MAP.half - 5; }

  start() { this.flying = true; this.game.audio.startPlane(this.pos); }

  updatePlane(dt) {
    if (this.flying) { this.d += SPEED * dt; this.t += dt; }
    this.pointAt(this.d, this.pos);
    this.plane.position.copy(this.pos);
    this.plane.rotation.y = Math.atan2(this.dir.x, this.dir.z);
    this.plane.rotation.z = Math.sin(this.t * 0.6) * 0.03;
    for (const p of this.plane.userData.props) p.rotation.z += dt * 40;
  }

  update(dt) {
    if (!this.active) return;
    this.updatePlane(dt);
    this.game.audio.updatePlane(this.pos);
    if (this.d > this.endD) {
      this.plane.visible = false;
      this.game.audio.stopPlane();
    }
    const anyoneUp = this.game.actors.some((a) => a.alive && a.air);
    if (!anyoneUp && this.d > this.ejectD) {
      this.landedAll = true;
      if (!this.plane.visible) this.active = false;
    }
  }

  stop() {
    this.active = false;
    this.flying = false;
    this.plane.visible = false;
    this.game.audio.stopPlane();
  }

  // ------------------------------------------------------------ per-actor air physics
  board(a) {
    a.air = 'plane';
    a.ctrl.pos.copy(this.pos);
    a.ctrl.vel.set(0, 0, 0);
    a.model.root.visible = false;
    if (a.chute) a.chute.visible = false;
  }

  jump(a) {
    if (a.air !== 'plane') return;
    a.air = 'fall';
    a.ctrl.pos.copy(this.pos).addScaledVector(this.dir, -14).add(_v.set(rand(-1.5, 1.5), -3, rand(-1.5, 1.5)));
    a.ctrl.vel.copy(this.dir).multiplyScalar(SPEED * 0.6);
    a.ctrl.vel.y = -4;
    a.model.root.visible = true;
    if (a.isPlayer) {
      this.game.audio.whoosh();
      this.game.ui.banner('ԱԶԱՏ ԱՆԿՈՒՄ', 'warn', 2);
    }
  }

  openChute(a) {
    if (a.air !== 'fall') return;
    a.air = 'chute';
    if (!a.chute) { a.chute = buildChute(); a.model.root.add(a.chute); }
    a.chute.visible = true;
    a.chute.scale.setScalar(0.2);
    a.chuteT = 0;
    if (a.isPlayer) { this.game.audio.click(null, 500, 0.6, 0.25); this.game.audio.whoosh(); }
  }

  updateActor(a, dt) {
    const I = a.intent;
    const p = a.ctrl.pos, v = a.ctrl.vel;
    if (a.air === 'plane') {
      p.copy(this.pos);
      v.copy(this.dir).multiplyScalar(SPEED);
      const forced = this.d >= this.ejectD;
      if ((I.jump && this.overMap) || forced) this.jump(a);
      return;
    }
    const ground = a.game.world.collision.groundAt(p.x, p.z, 0.3, p.y, 0);
    const height = p.y - ground;
    if (a.air === 'fall') {
      if ((I.jump && height < ALT - 20) || height < AUTO_CHUTE) this.openChute(a);
      v.y = Math.max(-FALL_V, v.y - 16 * dt);
      v.x = damp(v.x, I.mx * FALL_H, 2.2, dt);
      v.z = damp(v.z, I.mz * FALL_H, 2.2, dt);
    }
    if (a.air === 'chute') {
      a.chuteT += dt;
      a.chute.scale.setScalar(clamp(0.2 + a.chuteT * 2.4, 0.2, 1));
      v.y = damp(v.y, -CHUTE_V, 3, dt);
      v.x = damp(v.x, I.mx * CHUTE_H, 1.6, dt);
      v.z = damp(v.z, I.mz * CHUTE_H, 1.6, dt);
    }
    const prevY = p.y;
    p.addScaledVector(v, dt);
    const lim = MAP.half - 2;
    p.x = clamp(p.x, -lim, lim); p.z = clamp(p.z, -lim, lim);
    const g2 = a.game.world.collision.groundAt(p.x, p.z, 0.3, prevY, 0);
    if (p.y <= g2 + 0.02) this.land(a, g2);
    // gentle body orientation
    if (Math.hypot(v.x, v.z) > 0.5 && !a.isPlayer) a.yaw = Math.atan2(v.x, v.z);
  }

  land(a, y) {
    const p = a.ctrl.pos;
    a.air = null;
    if (a.chute) a.chute.visible = false;
    a.model.root.rotation.x = 0;
    a.ctrl.teleport(p.x, y, p.z);
    a.ctrl.onGround = true;
    a.game.fx.dustPuff(p, 10, 0.8);
    a.game.audio.footstep(p, a.isPlayer, 1.8);
    if (a.isPlayer) a.game.audio.click(null, 300, 0.4, 0.12);
    if (a.ai) a.ai.reset();
  }

  // Bots: choose a landing target near the flight path and when to jump.
  planBot(b) {
    const W = this.game.world;
    const spots = W.lootSpots.filter((s) => s.y < 0.5 && Math.abs(this.alongOf(s.x, s.z)) < 150);
    const near = spots.filter((s) => {
      const along = this.alongOf(s.x, s.z);
      const px = this.center.x + this.dir.x * along, pz = this.center.z + this.dir.z * along;
      return Math.hypot(s.x - px, s.z - pz) < 105;
    });
    const s = near.length ? near[Math.floor(Math.random() * near.length)] : { x: this.center.x, z: this.center.z };
    b.dropTarget = { x: s.x + rand(-6, 6), z: s.z + rand(-6, 6) };
    const along = clamp(this.alongOf(s.x, s.z) + rand(-30, 10), -MAP.half + 20, this.ejectD - 5);
    b.jumpD = along;
    b.chuteH = rand(55, 95);
  }

  botIntent(b) {
    const I = b.intent;
    I.jump = false; I.mx = I.mz = 0;
    if (b.air === 'plane') { I.jump = this.d >= b.jumpD; return; }
    const p = b.ctrl.pos, t = b.dropTarget;
    const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
    if (d > 2) { I.mx = dx / d; I.mz = dz / d; }
    if (b.air === 'fall') {
      const ground = this.game.world.collision.groundAt(p.x, p.z, 0.3, p.y, 0);
      if (p.y - ground < b.chuteH) I.jump = true;
    }
  }
}
