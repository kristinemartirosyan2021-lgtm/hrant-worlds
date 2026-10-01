// Hitscan bullet resolution (world + character hitboxes) and physical grenades.
import * as THREE from 'three';
import { RARITY } from '../config.js';
import { GRENADE } from './WeaponDefs.js';
import { clamp, lerp } from '../core/util.js';

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _h = new THREE.Vector3();
const _end = new THREE.Vector3();

// Ray vs sphere; returns t or -1.
function raySphere(o, d, c, r, maxT) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t > 0 && t < maxT ? t : -1;
}

// Ray vs vertical capped cylinder.
function rayCylinder(o, d, cx, cz, y0, y1, r, maxT) {
  const ox = o.x - cx, oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-8) return -1;
  const b = ox * d.x + oz * d.z;
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  for (const t of [(-b - sq) / a, (-b + sq) / a]) {
    if (t <= 0 || t >= maxT) continue;
    const y = o.y + d.y * t;
    if (y >= y0 && y <= y1) return t;
  }
  return -1;
}

export class ProjectileSystem {
  constructor(game) {
    this.game = game;
    this.grenades = [];
    const geo = new THREE.SphereGeometry(0.09, 10, 8);
    geo.scale(1, 1.25, 1);
    this.gMat = new THREE.MeshStandardMaterial({ color: 0x3b4a2e, roughness: 0.6, metalness: 0.3 });
    this.gGeo = geo;
  }

  // Returns true if an actor was hit.
  fireShot(shooter, origin, dir, def, item, muzzle, drawTracer) {
    const g = this.game;
    const maxD = def.id === 'sniper' ? 500 : Math.max(120, def.range * 3.5);
    const wh = g.world.collision.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxD, { bullets: true });
    let bestT = wh ? wh.t : maxD;
    let victim = null, head = false;
    for (const a of g.actors) {
      if (a === shooter || !a.alive) continue;
      const dx = a.ctrl.pos.x - origin.x, dz = a.ctrl.pos.z - origin.z;
      const along = dx * dir.x + dz * dir.z;
      if (along < -1 || along > bestT + 1) continue;
      a.headWorld(_h);
      const th = raySphere(origin, dir, _h, 0.15, bestT);
      if (th > 0) { bestT = th; victim = a; head = true; continue; }
      const top = _h.y - 0.13;
      const tb = rayCylinder(origin, dir, a.ctrl.pos.x, a.ctrl.pos.z, a.ctrl.pos.y + 0.02, top, a.ctrl.crouching ? 0.34 : 0.3, bestT);
      if (tb > 0) { bestT = tb; victim = a; head = false; }
    }
    _end.copy(origin).addScaledVector(dir, bestT);
    if (drawTracer) {
      const showT = shooter.isPlayer ? 1 : 0.6;
      if (Math.random() < showT) g.fx.tracer(muzzle, _end, def.tracer, def.id === 'sniper' ? 0.03 : 0.02);
    }
    // Near-miss feedback for the player.
    const pl = g.player;
    if (pl && pl.alive && shooter !== pl && victim !== pl) {
      pl.headWorld(_h);
      const t = clamp((_h.x - origin.x) * dir.x + (_h.y - origin.y) * dir.y + (_h.z - origin.z) * dir.z, 0, bestT);
      _p.copy(origin).addScaledVector(dir, t);
      const dist = _p.distanceTo(_h);
      if (dist < 2.2 && t > 3) {
        g.audio.whiz(_p);
        pl.suppress(1 - dist / 2.2);
      }
    }
    if (victim) {
      const dist = bestT;
      let falloff = 1;
      if (dist > def.range) falloff = lerp(1, 0.55, clamp((dist - def.range) / (def.range * 1.5), 0, 1));
      const dmg = def.damage * RARITY[item.rarity].dmg * falloff * (head ? def.head : 1);
      victim.applyDamage(dmg, { attacker: shooter, headshot: head, dir: dir.clone(), weapon: def, point: _end.clone(), dist });
      return true;
    }
    if (wh) {
      _n.set(wh.nx, wh.ny, wh.nz);
      _p.set(wh.x, wh.y, wh.z);
      g.fx.impact(_p, _n, wh.mat);
      if (Math.random() < (shooter.isPlayer ? 1 : 0.5)) g.audio.impact(_p, wh.mat);
    }
    return false;
  }

  // ------------------------------------------------------------ grenades
  throwGrenade(actor, origin, vel) {
    const mesh = new THREE.Mesh(this.gGeo, this.gMat);
    mesh.castShadow = true;
    mesh.position.copy(origin);
    this.game.scene.add(mesh);
    this.grenades.push({ actor, mesh, p: origin.clone(), v: vel.clone(), t: GRENADE.fuse, bounces: 0 });
    this.game.audio.click(null, 900, 0.3, 0.05, actor.isPlayer ? null : origin);
  }

  // Trajectory preview: returns array of points.
  predict(origin, vel, out = [], steps = 40) {
    out.length = 0;
    const p = origin.clone(), v = vel.clone();
    const col = this.game.world.collision;
    const dt = 0.05;
    for (let i = 0; i < steps; i++) {
      out.push(p.clone());
      v.y -= 18 * dt;
      const len = v.length() * dt;
      const d = v.clone().normalize();
      const hit = col.raycast(p.x, p.y, p.z, d.x, d.y, d.z, len);
      if (hit) { out.push(new THREE.Vector3(hit.x, hit.y, hit.z)); break; }
      p.addScaledVector(v, dt);
    }
    return out;
  }

  update(dt) {
    const g = this.game;
    const col = g.world.collision;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const gr = this.grenades[i];
      gr.t -= dt;
      const sub = 3;
      for (let s = 0; s < sub; s++) {
        const h = dt / sub;
        gr.v.y -= 18 * h;
        const len = gr.v.length() * h;
        if (len > 1e-5) {
          const d = _p.copy(gr.v).normalize();
          const hit = col.raycast(gr.p.x, gr.p.y, gr.p.z, d.x, d.y, d.z, len + 0.09);
          if (hit) {
            _n.set(hit.nx, hit.ny, hit.nz);
            const vn = gr.v.dot(_n);
            gr.v.addScaledVector(_n, -1.55 * vn).multiplyScalar(0.55);
            gr.p.set(hit.x, hit.y, hit.z).addScaledVector(_n, 0.1);
            if (Math.abs(vn) > 2) g.audio.click(null, 600, Math.min(0.5, Math.abs(vn) * 0.05), 0.05, gr.p);
            continue;
          }
        }
        gr.p.addScaledVector(gr.v, h);
      }
      gr.mesh.position.copy(gr.p);
      gr.mesh.rotation.x += dt * gr.v.length() * 2;
      if (Math.random() < 0.6) g.fx.trail(gr.p);
      if (gr.t <= 0) {
        this.explode(gr.p, gr.actor);
        g.scene.remove(gr.mesh);
        this.grenades.splice(i, 1);
      }
    }
  }

  explode(pos, actor) {
    const g = this.game;
    g.fx.explosion(pos);
    g.audio.explosion(pos);
    g.events.emit('gunshot', { actor, pos: pos.clone(), loud: 140 });
    const col = g.world.collision;
    for (const a of g.actors) {
      if (!a.alive) continue;
      a.chestWorld(_h);
      const d = _h.distanceTo(pos);
      if (d > GRENADE.radius) continue;
      if (!col.clear(pos.x, pos.y + 0.4, pos.z, _h.x, _h.y, _h.z)) continue;
      const dmg = GRENADE.damage * Math.pow(1 - d / GRENADE.radius, 1.3);
      if (dmg < 2) continue;
      const dir = _h.clone().sub(pos).normalize();
      a.applyDamage(dmg, { attacker: actor, headshot: false, dir, weapon: { id: 'grenade', name: GRENADE.name }, explosive: true, point: _h.clone(), dist: d });
    }
    const pl = g.player;
    if (pl) {
      const d = pl.ctrl.pos.distanceTo(pos);
      g.cameraShake(Math.max(0, 1.2 - d / 30));
    }
  }

  clear() {
    for (const gr of this.grenades) this.game.scene.remove(gr.mesh);
    this.grenades.length = 0;
  }
}
