// Pedestrians walking around block sidewalks; they panic, flee, get knocked out and drop cash.
import { BLOCK, PALETTE } from '../config.js';
import { pick, damp, dampAngle } from '../utils/math.js';

const rng = Math.random;
const HALF_PATH = BLOCK / 2 - 1.8;

export function perimeterPoint(block, t) {
  const h = HALF_PATH, L = 2 * h;
  t = ((t % (4 * L)) + 4 * L) % (4 * L);
  const seg = Math.floor(t / L), u = t - seg * L;
  switch (seg) {
    case 0: return { x: block.cx - h + u, z: block.cz - h, dx: 1, dz: 0 };
    case 1: return { x: block.cx + h, z: block.cz - h + u, dx: 0, dz: 1 };
    case 2: return { x: block.cx + h - u, z: block.cz + h, dx: -1, dz: 0 };
    default: return { x: block.cx - h, z: block.cz + h - u, dx: 0, dz: -1 };
  }
}
/** Nearest perimeter parameter for a point. */
export function perimeterProject(block, x, z) {
  const h = HALF_PATH, L = 2 * h;
  const lx = Math.max(-h, Math.min(h, x - block.cx)), lz = Math.max(-h, Math.min(h, z - block.cz));
  const dn = Math.abs(lz + h), ds = Math.abs(lz - h), de = Math.abs(lx - h), dw = Math.abs(lx + h);
  const m = Math.min(dn, ds, de, dw);
  if (m === dn) return lx + h;
  if (m === de) return L + lz + h;
  if (m === ds) return 2 * L + (h - lx);
  return 3 * L + (h - lz);
}

export class PedestrianManager {
  constructor(game) {
    this.game = game;
    this.crowd = game.crowd;
    this.list = [];
    this.spawnT = 0;
  }

  get target() { return this.game.quality.peds; }

  spawn(block, t, opts = {}) {
    const colors = {
      shirt: pick(rng, PALETTE.shirts), pants: pick(rng, PALETTE.pants),
      skin: pick(rng, PALETTE.skin), hair: pick(rng, PALETTE.hair),
    };
    const slot = this.crowd.alloc(colors);
    if (slot < 0) return null;
    const p = perimeterPoint(block, t);
    const ped = {
      kind: 'ped', slot, block, t, dir: rng() < 0.5 ? 1 : -1,
      speed: 1.1 + rng() * 0.6, x: p.x, y: 0.15, z: p.z, heading: 0,
      phase: rng() * 6, alive: true, fleeT: 0, deadT: 0, lie: 0,
      vx: 0, vy: 0, vz: 0, flying: false, ...opts,
    };
    this.list.push(ped);
    return ped;
  }

  /** Spawn a pedestrian at an arbitrary point (e.g. a car-jacked driver) – snaps to nearest sidewalk. */
  spawnAt(x, z, flee = true) {
    const block = this.game.world.nearestBlock(x, z);
    const ped = this.spawn(block, perimeterProject(block, x, z));
    if (ped) {
      ped.x = x; ped.z = z;
      if (flee) { ped.fleeT = 8; ped.fx = x; ped.fz = z; }
      ped.snapping = 1;
    }
    return ped;
  }

  remove(ped) {
    this.crowd.release(ped.slot);
    const i = this.list.indexOf(ped);
    if (i >= 0) this.list.splice(i, 1);
  }

  kill(ped, fromX, fromZ, force = 4, byPlayer = true) {
    if (!ped.alive) return;
    ped.alive = false; ped.deadT = 0;
    const dx = ped.x - fromX, dz = ped.z - fromZ, l = Math.hypot(dx, dz) || 1;
    ped.vx = (dx / l) * force; ped.vz = (dz / l) * force; ped.vy = force * 0.5; ped.flying = true;
    ped.heading = Math.atan2(-dx, -dz);
    if (byPlayer) {
      this.game.wanted.crime(1.5, 'assault');
      if (rng() < 0.7) this.game.pickups.spawn('cash', ped.x, ped.z, 10 + Math.floor(rng() * 40));
    }
    this.game.audio.play('hurt');
    this.panic(ped.x, ped.z, 25);
  }

  panic(x, z, radius, mild = false) {
    for (const p of this.list) {
      if (!p.alive) continue;
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < radius * radius) {
        p.fleeT = mild ? Math.max(p.fleeT, 1.5) : 6; p.fx = x; p.fz = z;
      }
    }
  }

  nearest(x, z, maxD) {
    let best = null, bd = maxD * maxD;
    for (const p of this.list) {
      if (!p.alive) continue;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  update(dt) {
    const g = this.game, P = g.player.pos;
    // spawn / despawn around the player
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.4;
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        const d2 = (p.x - P.x) ** 2 + (p.z - P.z) ** 2;
        if (d2 > 170 * 170 || (!p.alive && p.deadT > 25)) this.remove(p);
      }
      const alive = this.list.length;
      if (alive < this.target) {
        const near = g.world.blocks.filter((b) => {
          const d = Math.hypot(b.cx - P.x, b.cz - P.z);
          return d < 150 && d > 20;
        });
        if (near.length) {
          const b = pick(rng, near);
          this.spawn(b, rng() * 8 * HALF_PATH);
        }
      }
    }

    for (const p of this.list) {
      if (!p.alive) {
        p.deadT += dt;
        if (p.flying) {
          p.vy -= 20 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.vx *= Math.exp(-1.5 * dt); p.vz *= Math.exp(-1.5 * dt);
          const r = g.world.colliders.pushCircle(p.x, p.z, 0.3, p.y);
          p.x = r.x; p.z = r.z;
          const gh = g.world.heightAt(p.x, p.z) + 0.05;
          if (p.y <= gh) { p.y = gh; p.flying = false; }
        }
        p.lie = Math.min(1, p.lie + dt * 4);
        this.crowd.set(p.slot, p.x, p.y, p.z, p.heading, 0, p.lie);
        continue;
      }
      let speed = p.speed;
      if (p.fleeT > 0) {
        p.fleeT -= dt;
        speed = 5.2;
        // run along the perimeter away from the threat
        const pt = perimeterPoint(p.block, p.t);
        const away = (pt.x - p.fx) * pt.dx + (pt.z - p.fz) * pt.dz;
        p.dir = away >= 0 ? 1 : -1;
      }
      p.t += p.dir * speed * dt;
      const q = perimeterPoint(p.block, p.t);
      if (p.snapping > 0) {
        p.snapping -= dt;
        p.x = damp(p.x, q.x, 3, dt); p.z = damp(p.z, q.z, 3, dt);
      } else { p.x = q.x; p.z = q.z; }
      p.y = 0.15;
      p.heading = dampAngle(p.heading, Math.atan2(q.dx * p.dir, q.dz * p.dir), 10, dt);
      p.phase += dt * speed * 3.2;
      this.crowd.set(p.slot, p.x, p.y, p.z, p.heading, Math.sin(p.phase) * Math.min(1, speed / 2) * 0.6);
    }
  }
}
