// Wanted level (1-5 stars) and police response: pursuit cars, officers on foot, busting, shooting.
import { clamp, pick } from '../utils/math.js';
import { steerTo, clearAhead, RoadDriver } from '../npc/traffic.js';

const THRESH = [0, 1, 5, 12, 22, 35];
const UNITS = [0, 1, 2, 3, 4, 6];

export class Wanted {
  constructor(game) { this.game = game; this.stars = 0; this.heat = 0; this.unseen = 0; this.seen = false; }
  crime(points) {
    if (this.game.state !== 'playing' || this.game.player.dead) return;
    this.heat += points;
    let s = this.stars;
    while (s < 5 && this.heat >= THRESH[s + 1]) s++;
    if (s > this.stars) { this.stars = s; this.game.hud.pulseStars(); }
    if (this.stars > 0) this.unseen = 0;
  }
  set(stars) { this.stars = stars; this.heat = THRESH[stars]; this.unseen = 0; this.game.hud.pulseStars(); }
  clear() { this.stars = 0; this.heat = 0; this.unseen = 0; }
  get cooldown() { return 5 + this.stars * 2; }
  update(dt, seen) {
    this.seen = seen;
    if (this.stars === 0) { this.heat = Math.max(0, this.heat - dt * 0.2); return; }
    if (seen) this.unseen = 0;
    else {
      this.unseen += dt;
      if (this.unseen > this.cooldown) {
        this.stars--; this.heat = THRESH[this.stars]; this.unseen = 0;
        if (this.stars === 0) this.game.hud.message('You lost the cops!', 2.5);
      }
    }
  }
}

class PursuitDriver {
  constructor(game, v) {
    this.game = game; this.v = v; this.kind = 'police';
    this.node = null; this.prev = null;
    this.stuckT = 0; this.reverseT = 0; this.shootT = 2;
    this.deployed = false;
  }
  onDamage() {}
  pickNode(P) {
    const g = this.game.world.graph;
    if (!this.node) { this.node = g.nearestNode(this.v.x, this.v.z); return; }
    let best = null, bd = Infinity;
    for (const l of this.node.links) {
      if (l.node === this.prev && this.node.links.length > 1) continue;
      const d = Math.hypot(l.node.x - P.x, l.node.z - P.z) + Math.random() * 10;
      if (d < bd) { bd = d; best = l.node; }
    }
    this.prev = this.node; this.node = best || this.prev;
  }
  update(dt) {
    const game = this.game, v = this.v, p = game.player;
    if (v.driver !== 'ai' || v.state !== 'ok') { v.ai = null; v.siren = false; return; }
    v.siren = true;
    const P = p.pos;
    const pv = p.vehicle;
    const tx = P.x + (pv ? pv.vx * 0.6 : 0), tz = P.z + (pv ? pv.vz * 0.6 : 0);
    const d = Math.hypot(P.x - v.x, P.z - v.z);
    const los = d < 55 && !game.world.colliders.segmentBlocked(v.x, v.z, P.x, P.z, 1.5);
    this.los = los && d < 70;

    if (this.reverseT > 0) {
      this.reverseT -= dt;
      v.controls.throttle = 0; v.controls.brake = 1; v.controls.steer = this.revSteer; v.controls.handbrake = false;
      return;
    }
    let desired = 30;
    if (los) {
      if (!pv && d < 35) {
        // approach a player on foot carefully: stop short instead of running them over
        desired = clamp((d - 11) * 0.7, 0, 20);
        if (d < 16 && !this.deployed && Math.abs(v.forwardSpeed) < 2) { this.deployed = true; game.police.deployOfficers(v); }
      } else if (pv) desired = pv.speed + 12;
      steerTo(v, tx, tz, desired, true);
    } else {
      if (!this.node || Math.hypot(this.node.x - v.x, this.node.z - v.z) < 10) this.pickNode(P);
      const free = clearAhead(game, v, 18, 1.8);
      if (free < 10) desired = Math.min(desired, Math.max(4, free));
      steerTo(v, this.node.x, this.node.z, desired);
    }
    if (desired > 3 && Math.abs(v.forwardSpeed) < 1) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
    if (this.stuckT > 1.8) { this.stuckT = 0; this.reverseT = 1.2; this.revSteer = -Math.sign(v.controls.steer || 1); this.node = null; }

    // shooting from the car at 3+ stars
    if (game.wanted.stars >= 3 && los && d < 32) {
      this.shootT -= dt;
      if (this.shootT <= 0) {
        this.shootT = 1.4 + Math.random();
        game.fx.tracer(v.x, v.y + 1.5, v.z, P.x + (Math.random() - 0.5) * 2, P.y + 1, P.z + (Math.random() - 0.5) * 2);
        game.audio.playAt('shot', v.x, v.z);
        if (Math.random() < 0.38) { if (pv) pv.applyDamage(6); else p.damage(7, 'shot'); }
      }
    }
  }
}

export class PoliceManager {
  constructor(game) {
    this.game = game;
    this.units = [];   // police vehicles in pursuit
    this.cops = [];    // officers on foot
    this.spawnT = 0;
    this.bustT = 0;
  }

  characters() { return this.cops; }

  spawnUnit() {
    const g = this.game, P = g.player.pos, graph = g.world.graph;
    const cands = graph.nodes.filter((n) => {
      const d = Math.hypot(n.x - P.x, n.z - P.z);
      return d > 85 && d < 170 && !n.island;
    });
    if (!cands.length) return;
    const n = pick(Math.random, cands);
    for (const o of g.vehicles.list) if (Math.hypot(o.x - n.x, o.z - n.z) < 10) return;
    const v = g.vehicles.spawn('police', n.x, n.z, Math.atan2(P.x - n.x, P.z - n.z), '#f4f4f4');
    v.driver = 'ai';
    v.ai = new PursuitDriver(g, v);
    v.ai.node = n;
    this.units.push(v);
  }

  deployOfficers(v) {
    const n = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const side = i === 0 ? 1 : -1;
      const x = v.x - Math.cos(v.heading) * side * 1.8, z = v.z + Math.sin(v.heading) * side * 1.8;
      this.spawnCop(x, z, v);
    }
  }

  spawnCop(x, z, car) {
    const slot = this.game.crowd.alloc({ shirt: '#1f3d8a', pants: '#14213d', skin: pick(Math.random, ['#e0ac69', '#c68642', '#f1c27d', '#8d5524']), hair: '#111111' });
    if (slot < 0) return;
    this.cops.push({ kind: 'cop', slot, x, y: this.game.world.heightAt(x, z), z, heading: 0, hp: 3, alive: true, phase: 0, shootT: 1 + Math.random(), deadT: 0, lie: 0, car, aim: 0 });
  }

  hitCop(c, type, fx, fz) {
    if (!c.alive) return;
    c.hp -= type === 'punch' ? 1 : type === 'shot' ? 1.5 : 3;
    if (c.hp <= 0) {
      c.alive = false; c.deadT = 0;
      c.heading = Math.atan2(fx - c.x, fz - c.z);
      this.game.wanted.crime(4, 'killed cop');
      this.game.audio.play('hurt');
      if (Math.random() < 0.6) this.game.pickups.spawn('cash', c.x, c.z, 50);
    } else this.game.wanted.crime(1, 'assault officer');
  }

  clearAll() {
    for (const c of this.cops) this.game.crowd.release(c.slot);
    this.cops = [];
    for (const v of this.units) if (v !== this.game.player.vehicle) this.game.vehicles.remove(v);
    this.units = [];
  }

  update(dt) {
    const g = this.game, w = g.wanted, p = g.player, P = p.pos;
    // prune units
    this.units = this.units.filter((v) => g.vehicles.list.includes(v) && v.driver === 'ai' && v.state === 'ok');
    const want = UNITS[w.stars];
    this.spawnT -= dt;
    if (this.units.length < want && this.spawnT <= 0 && !p.dead) { this.spawnT = 2.5; this.spawnUnit(); }

    // calm down: release extra units back to patrol traffic
    if (this.units.length > want) {
      const v = this.units.pop();
      v.siren = false;
      const n = g.world.graph.nearestNode(v.x, v.z);
      const l = n.links.find((q) => !q.edge.noTraffic) || n.links[0];
      v.ai = new RoadDriver(g, v, n, l.edge);
    }

    let seen = false;
    for (const v of this.units) if (v.ai && v.ai.los) seen = true;

    // officers on foot
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      const d = Math.hypot(P.x - c.x, P.z - c.z);
      if (!c.alive) {
        c.deadT += dt; c.lie = Math.min(1, c.lie + dt * 4);
        g.crowd.set(c.slot, c.x, c.y, c.z, c.heading, 0, c.lie);
        if (c.deadT > 30 || d > 160) { g.crowd.release(c.slot); this.cops.splice(i, 1); }
        continue;
      }
      if ((w.stars === 0 && d > 30) || d > 140) { g.crowd.release(c.slot); this.cops.splice(i, 1); continue; }
      const los = !g.world.colliders.segmentBlocked(c.x, c.z, P.x, P.z, 1.5);
      if (los && d < 60) seen = true;
      let speed = 0;
      const stopDist = w.stars >= 2 ? 9 : 1.1;
      if (w.stars > 0 && !p.dead && (d > stopDist || !los)) speed = 5.6;
      const dx = (P.x - c.x) / (d || 1), dz = (P.z - c.z) / (d || 1);
      c.heading = Math.atan2(dx, dz);
      c.x += dx * speed * dt; c.z += dz * speed * dt;
      const r = g.world.colliders.pushCircle(c.x, c.z, 0.4, c.y);
      c.x = r.x; c.z = r.z;
      g.vehicles.pushBody(c, 0.4);
      g.world.constrain(c);
      c.y = g.world.isWater(c.x, c.z) ? -1.1 : g.world.heightAt(c.x, c.z);
      c.phase += dt * speed * 3;
      c.aim = 0;
      if (w.stars >= 2 && los && d < 28 && !p.dead) {
        c.aim = 1;
        c.shootT -= dt;
        if (c.shootT <= 0) {
          c.shootT = (w.stars >= 3 ? 1.2 : 1.9) + Math.random() * 0.8;
          g.fx.tracer(c.x, c.y + 1.45, c.z, P.x + (Math.random() - 0.5), P.y + 1.1, P.z + (Math.random() - 0.5));
          g.audio.playAt('shot', c.x, c.z);
          if (Math.random() < (w.stars >= 3 ? 0.35 : 0.22)) { if (p.vehicle) p.vehicle.applyDamage(5); else p.damage(6, 'shot'); }
        }
      }
      g.crowd.set(c.slot, c.x, c.y, c.z, c.heading, Math.sin(c.phase) * clamp(speed / 3, 0, 1) * 0.6, 0, c.aim);
    }

    // busted: an officer next to you on foot at 1 star (or any star when you stand still)
    let nearCop = false;
    if (!p.inVehicle && !p.dead && w.stars > 0) {
      for (const c of this.cops) if (c.alive && Math.hypot(c.x - P.x, c.z - P.z) < 1.8) nearCop = true;
    }
    if (nearCop && (w.stars <= 1 || p.speed < 0.5)) {
      this.bustT += dt;
      if (this.bustT > 1.6) { this.bustT = 0; g.onBusted(); }
    } else this.bustT = Math.max(0, this.bustT - dt);

    w.update(dt, seen && w.stars > 0);
    // siren loudness for audio
    let nearest = Infinity;
    for (const v of this.units) nearest = Math.min(nearest, Math.hypot(v.x - P.x, v.z - P.z));
    g.audio.siren(nearest < 200 ? clamp(1 - nearest / 200, 0, 1) : 0);
  }
}
