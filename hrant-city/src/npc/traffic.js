// Traffic AI: cars follow lanes on the road graph, obey traffic lights and keep distance.
import { PALETTE } from '../config.js';
import { clamp, wrapAngle, pick } from '../utils/math.js';

const rng = Math.random;

/** Sets vehicle controls to drive toward (tx,tz) at a desired speed. */
export function steerTo(v, tx, tz, desired, aggressive = false) {
  const c = v.controls;
  const want = Math.atan2(tx - v.x, tz - v.z);
  const a = wrapAngle(want - v.heading);
  const vF = v.forwardSpeed;
  c.steer = clamp(-a * 2.6, -1, 1);
  if (Math.abs(a) > 0.9 && !aggressive) desired = Math.min(desired, 7);
  const e = desired - vF;
  c.throttle = clamp(e * 0.5, 0, 1);
  c.brake = e < -1.5 ? clamp(-e * 0.25, 0, 1) : 0;
  c.handbrake = false;
  if (desired < 0.3 && vF < 1.2) { c.throttle = 0; c.brake = vF > 0.1 ? 1 : 0; c.handbrake = true; }
  return a;
}

/** Look for something ahead in our lane. Returns free distance. */
export function clearAhead(game, v, range = 22, laneW = 2.6) {
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  let free = Infinity;
  for (const o of game.vehicles.list) {
    if (o === v) continue;
    const dx = o.x - v.x, dz = o.z - v.z;
    if (Math.abs(dx) > range || Math.abs(dz) > range) continue;
    const along = dx * fx + dz * fz;
    if (along <= 0 || along > range) continue;
    const lat = Math.abs(dx * fz - dz * fx);
    if (lat < laneW + o.spec.width / 2) free = Math.min(free, along - o.spec.length / 2);
  }
  const p = game.player;
  if (!p.inVehicle && !p.dead) {
    const dx = p.x - v.x, dz = p.z - v.z, along = dx * fx + dz * fz;
    if (along > 0 && along < range && Math.abs(dx * fz - dz * fx) < 2) { free = Math.min(free, along - 1); v.wantHonk = true; }
  }
  return free;
}

export class RoadDriver {
  constructor(game, v, from, edge, opts = {}) {
    this.game = game; this.v = v;
    this.cruiseMul = opts.cruiseMul || 1;
    this.ignoreLights = !!opts.ignoreLights;
    this.stuckT = 0; this.reverseT = 0; this.honkT = 0;
    this.kind = 'traffic';
    this.setLane(from, edge);
  }

  setLane(from, edge) {
    this.edge = edge; this.from = from;
    this.lane = this.game.world.graph.lane(edge, from);
    this.phase = 0; // 0 = heading to lane start (crossing intersection), 1 = along lane
  }

  chooseNext() {
    const node = this.lane.to;
    const opts = node.links.filter((l) => l.edge !== this.edge && !l.edge.noTraffic);
    let next;
    if (!opts.length) next = node.links.find((l) => l.edge === this.edge);
    else {
      // prefer going straight a bit
      const straight = opts.find((l) => (l.edge.a === node ? 1 : -1) * (l.edge.dx * this.lane.dx + l.edge.dz * this.lane.dz) > 0.9);
      next = straight && rng() < 0.45 ? straight : pick(rng, opts);
    }
    this.setLane(node, next.edge);
  }

  onDamage(amount, byPlayer) {
    if (byPlayer && this.v.health < this.v.spec.health * 0.5 && this.v.driver === 'ai' && rng() < 0.5) this.game.bailOut(this.v);
  }

  update(dt) {
    const g = this.game, v = this.v, L = this.lane;
    if (v.driver !== 'ai' || v.state !== 'ok') { v.ai = null; return; }
    let cruise = (this.edge.highway ? 21 : 13) * this.cruiseMul;
    // project position on lane
    const px = v.x - L.sx, pz = v.z - L.sz;
    const s = px * L.dx + pz * L.dz;
    let tx, tz;
    if (this.phase === 0) {
      tx = L.sx + L.dx * 2; tz = L.sz + L.dz * 2;
      if (s > -1.5) this.phase = 1;
      cruise = Math.min(cruise, 9);
    }
    if (this.phase === 1) {
      const ahead = Math.min(L.len, Math.max(0, s) + 9);
      tx = L.sx + L.dx * ahead; tz = L.sz + L.dz * ahead;
      const distEnd = L.len - s;
      if (distEnd < 3) { this.chooseNext(); return; }
      if (!this.ignoreLights) {
        const st = g.world.graph.lightState(L.to, this.edge, g.time);
        if ((st === 'red' || (st === 'yellow' && distEnd > 12)) && distEnd < 32) cruise = Math.min(cruise, Math.max(0, (distEnd - 3) * 0.7));
      }
      if (distEnd < 15) cruise = Math.min(cruise, 9);
    }
    v.wantHonk = false;
    const free = clearAhead(g, v);
    if (free < Infinity) cruise = Math.min(cruise, Math.max(0, (free - 3.5) * 0.9));
    if (v.wantHonk) {
      this.honkT -= dt;
      if (this.honkT <= 0) { this.honkT = 2.5; g.audio.playAt('honk', v.x, v.z); }
    }

    // stuck recovery
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      v.controls.throttle = 0; v.controls.brake = 1; v.controls.steer = -v.controls.steer; v.controls.handbrake = false;
      return;
    }
    if (cruise > 3 && Math.abs(v.forwardSpeed) < 0.6) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > 3) { this.stuckT = 0; this.reverseT = 1.3; this.stuckCount = (this.stuckCount || 0) + 1; }
    steerTo(v, tx, tz, cruise);
  }
}

export class TrafficManager {
  constructor(game) {
    this.game = game;
    this.timer = 0;
  }
  get target() { return this.game.quality.traffic; }

  aiCars() { return this.game.vehicles.list.filter((v) => v.driver === 'ai' && v.ai && v.ai.kind === 'traffic' && !v.mission); }

  spawnOnEdge(edge, type, color, opts) {
    const g = this.game;
    const from = rng() < 0.5 ? edge.a : edge.b;
    const lane = g.world.graph.lane(edge, from);
    if (lane.len < 10) return null;
    const s = 4 + rng() * (lane.len - 8);
    const x = lane.sx + lane.dx * s, z = lane.sz + lane.dz * s;
    for (const o of g.vehicles.list) if ((o.x - x) ** 2 + (o.z - z) ** 2 < 14 * 14) return null;
    const v = g.vehicles.spawn(type, x, z, Math.atan2(lane.dx, lane.dz), color);
    v.driver = 'ai';
    v.ai = new RoadDriver(g, v, from, edge, opts);
    v.ai.phase = 1;
    const sp = edge.highway ? 15 : 9;
    v.vx = lane.dx * sp; v.vz = lane.dz * sp;
    return v;
  }

  randomType() {
    const r = rng();
    if (r < 0.42) return 'sedan';
    if (r < 0.58) return 'taxi';
    if (r < 0.74) return 'sports';
    if (r < 0.86) return 'truck';
    return 'bike';
  }

  update(dt) {
    const g = this.game;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.5;
    const P = g.player.pos;
    const cars = this.aiCars();
    // despawn far traffic & abandoned wrecks
    for (const v of [...g.vehicles.list]) {
      if (v === g.player.vehicle || v.persistent || v.mission) continue;
      const d = Math.hypot(v.x - P.x, v.z - P.z);
      const camVisible = d < 60;
      if ((v.driver === 'ai' && d > 230) || (!v.driver && d > 260) || (v.state === 'wrecked' && d > 120)) {
        if (v.isPolice && v.ai && v.ai.kind === 'police') continue;
        g.vehicles.remove(v);
      } else if (v.ai && v.ai.stuckCount > 3 && !camVisible) g.vehicles.remove(v);
    }
    if (cars.length < this.target) {
      const edges = g.world.graph.edges.filter((e) => {
        if (e.noTraffic) return false;
        const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
        const d = Math.hypot(mx - P.x, mz - P.z);
        return d > 70 && d < 190;
      });
      if (edges.length) {
        const type = this.randomType();
        const color = type === 'taxi' ? '#ffd23f' : pick(rng, PALETTE.cars);
        this.spawnOnEdge(pick(rng, edges), type, color);
      }
    }
  }
}
