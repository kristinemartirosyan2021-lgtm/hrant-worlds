// Owns all vehicles: spawning, updates, vehicle-vehicle and vehicle-pedestrian collisions.
import { Vehicle, setBeamOpacity } from './vehicle.js';
import { clamp } from '../utils/math.js';

export class VehicleManager {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  spawn(type, x, z, heading, color) {
    const v = new Vehicle(this.game, type, x, z, heading, color);
    this.list.push(v);
    return v;
  }

  remove(v) {
    const i = this.list.indexOf(v);
    if (i >= 0) this.list.splice(i, 1);
    v.dispose();
  }

  nearestEnterable(x, z, maxD) {
    let best = null, bd = Infinity;
    for (const v of this.list) {
      if (v.state === 'wrecked') continue;
      // distance to the vehicle's centre line
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      const dx = x - v.x, dz = z - v.z;
      const along = clamp(dx * fx + dz * fz, -v.spec.length / 2, v.spec.length / 2);
      const d = Math.hypot(dx - fx * along, dz - fz * along) - v.spec.width / 2;
      if (d < maxD && d < bd) { bd = d; best = v; }
    }
    return best;
  }

  /** Push a character (obj with x,z,y) out of vehicle bodies. */
  pushBody(obj, r) {
    for (const v of this.list) {
      if (Math.abs(v.x - obj.x) > v.boundR + r || Math.abs(v.z - obj.z) > v.boundR + r) continue;
      if (obj.y > v.y + 1.8) continue;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading), rx = -fz, rz = fx;
      const dx = obj.x - v.x, dz = obj.z - v.z;
      const lz = dx * fx + dz * fz, lx = dx * rx + dz * rz;
      const hx = v.spec.width / 2 + r, hz = v.spec.length / 2 + r;
      if (Math.abs(lx) < hx && Math.abs(lz) < hz) {
        const px = hx - Math.abs(lx), pz = hz - Math.abs(lz);
        if (px < pz) { const s = Math.sign(lx) || 1; obj.x += rx * px * s; obj.z += rz * px * s; }
        else { const s = Math.sign(lz) || 1; obj.x += fx * pz * s; obj.z += fz * pz * s; }
      }
    }
  }

  update(dt) {
    const g = this.game;
    setBeamOpacity(g.daynight.night * 0.35);
    const camX = g.camera.position.x, camZ = g.camera.position.z, far2 = (g.quality.far + 20) ** 2;
    for (const v of this.list) {
      if (v.ai) v.ai.update(dt);
      v.update(dt);
      v.mesh.visible = (v.x - camX) ** 2 + (v.z - camZ) ** 2 < far2;
    }
    this._vehicleCollisions();
    this._hitCharacters();
  }

  _vehicleCollisions() {
    const L = this.list, g = this.game;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        const lim = a.boundR + b.boundR;
        const dx0 = b.x - a.x, dz0 = b.z - a.z;
        if (Math.abs(dx0) > lim || Math.abs(dz0) > lim) continue;
        if (Math.abs(a.y - b.y) > 2.5) continue;
        if (a.sleep > 0.5 && b.sleep > 0.5) continue;
        const afx = Math.sin(a.heading), afz = Math.cos(a.heading), bfx = Math.sin(b.heading), bfz = Math.cos(b.heading);
        let done = false;
        for (const oa of a.circles) {
          if (done) break;
          const ax = a.x + afx * oa, az = a.z + afz * oa;
          for (const ob of b.circles) {
            const bx = b.x + bfx * ob, bz = b.z + bfz * ob;
            const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz), rr = a.radius + b.radius;
            if (d >= rr || d < 1e-4) continue;
            const nx = dx / d, nz = dz / d, pen = rr - d;
            const ma = a.state === 'wrecked' ? a.spec.mass * 2 : a.spec.mass, mb = b.state === 'wrecked' ? b.spec.mass * 2 : b.spec.mass;
            const ta = mb / (ma + mb), tb = ma / (ma + mb);
            a.x -= nx * pen * ta; a.z -= nz * pen * ta;
            b.x += nx * pen * tb; b.z += nz * pen * tb;
            const vrel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
            if (vrel < 0) {
              const jImp = (-(1.25) * vrel) / (1 / ma + 1 / mb);
              a.vx -= (nx * jImp) / ma; a.vz -= (nz * jImp) / ma;
              b.vx += (nx * jImp) / mb; b.vz += (nz * jImp) / mb;
              a.sleep = 0; b.sleep = 0;
              const imp = -vrel;
              if (imp > 4) {
                const byP = a.driver === 'player' || b.driver === 'player';
                a.applyDamage((imp - 4) * 2.6 * tb * 2, b.driver === 'player');
                b.applyDamage((imp - 4) * 2.6 * ta * 2, a.driver === 'player');
                if (byP) {
                  g.audio.play('crash', clamp(imp / 25, 0.2, 1));
                  g.cam.addShake(clamp(imp / 25, 0.1, 0.8));
                  const other = a.driver === 'player' ? b : a;
                  if (other.isPolice && other.state !== 'wrecked') g.wanted.crime(1.2, 'hit police');
                  else if (other.driver === 'ai' && imp > 8) g.wanted.crime(0.4, 'reckless');
                }
              }
            }
            done = true; break;
          }
        }
      }
    }
  }

  _hitCharacters() {
    const g = this.game, chars = g.characters();
    for (const v of this.list) {
      const sp = v.speed;
      if (sp < 3 || v.spec.water) continue;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading), rx = -fz, rz = fx;
      const hx = v.spec.width / 2 + 0.35, hz = v.spec.length / 2 + 0.35;
      const test = (c) => {
        const dx = c.x - v.x, dz = c.z - v.z;
        if (Math.abs(dx) > hz + 1 || Math.abs(dz) > hz + 1) return false;
        if (c.y > v.y + 1.8 || c.y < v.y - 1.5) return false;
        const lz = dx * fx + dz * fz, lx = dx * rx + dz * rz;
        return Math.abs(lx) < hx && Math.abs(lz) < hz;
      };
      for (const c of chars) {
        if (!c.alive || !test(c)) continue;
        g.hitCharacter(c, 'vehicle', v.x, v.z, v);
      }
      const p = g.player;
      if (!p.inVehicle && !p.dead && sp > 5 && test(p)) {
        const dmg = sp * 2.2;
        p.damage(dmg, 'roadkill');
        const nx = p.x - v.x, nz = p.z - v.z, l = Math.hypot(nx, nz) || 1;
        p.vx = (nx / l) * sp * 0.6 + v.vx * 0.4; p.vz = (nz / l) * sp * 0.6 + v.vz * 0.4; p.vy = 4; p.onGround = false;
        p.x += (nx / l) * 0.8; p.z += (nz / l) * 0.8;
        v.vx *= 0.8; v.vz *= 0.8;
      }
    }
  }
}
