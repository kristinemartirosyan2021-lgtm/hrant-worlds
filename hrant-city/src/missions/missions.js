// Five missions (delivery, race, chase, timed escape, collect) + mission markers + save point.
import * as THREE from 'three';
import { RoadDriver } from '../npc/traffic.js';

const MISSION_DEFS = [
  { id: 'pizza', name: 'Pizza Run', reward: 500, start: { x: -24, z: 9 }, color: '#ffd23f', desc: 'Grab the pizza from Hrant\'s Pizza and deliver it hot!' },
  { id: 'race', name: 'Ocean Drive Race', reward: 1000, start: { x: 316, z: 250 }, color: '#ff4f8b', desc: 'Lap the city ring road through every checkpoint before time runs out.' },
  { id: 'thief', name: 'Catch the Thief', reward: 1500, start: { x: 111, z: -65 }, color: '#2ec4b6', desc: 'A thief stole a sports car. Chase it down and wreck it!' },
  { id: 'heat', name: 'Heat Wave', reward: 2000, start: { x: -157, z: 185 }, color: '#ff7a2f', desc: 'You have 3 stars. Lose the cops before the timer runs out.' },
  { id: 'coins', name: 'Hrant\'s Lost Coins', reward: 2500, start: { x: 316, z: -100 }, color: '#b44dff', desc: 'Collect all 10 golden coins scattered around the city and island.' },
];

class Mission {
  constructor(game, def) { this.game = game; this.def = def; this.timer = Infinity; this.text = ''; this.target = null; this.targets = []; }
  start() {}
  update() { return null; }
  end() {}
}

class PizzaRun extends Mission {
  start() {
    const w = this.game.world;
    this.A = w.sidewalkPoint(2, 2, 'e');
    this.B = w.sidewalkPoint(6, 6, 'w');
    this.stage = 0;
    this.bike = this.game.vehicles.spawn('bike', -24, 15.5, Math.PI / 2, '#ff4f8b');
    this.bike.mission = true;
    this.text = 'Go to Hrant\'s Pizza (take the scooter!)';
    this.target = this.A;
  }
  update() {
    const P = this.game.player.pos;
    const near = (t) => Math.hypot(P.x - t.x, P.z - t.z) < 6;
    if (this.stage === 0 && near(this.A)) {
      this.stage = 1; this.timer = 60; this.target = this.B;
      this.text = 'Deliver the pizza before it gets cold!';
      this.game.audio.play('pickup');
    } else if (this.stage === 1 && near(this.B)) return 'pass';
    if (this.timer <= 0) return 'The pizza got cold';
    return null;
  }
  end() { if (this.bike) { this.bike.mission = false; } }
}

class Race extends Mission {
  start() {
    const g = this.game;
    this.cps = [[333, 100], [333, -250], [250, -371], [0, -371], [-250, -371], [-371, -200], [-371, 100], [-200, 371], [100, 371], [333, 330], [333, 240]].map(([x, z]) => ({ x, z }));
    this.idx = 0;
    this.car = g.vehicles.spawn('sports', 333.5, 250, Math.PI, '#ff2fa8');
    this.car.mission = true;
    if (g.player.vehicle) g.player.exitVehicle(true);
    g.player.enterVehicle(this.car);
    this.timer = 125;
    this.countdown = 3;
    this.text = 'Get ready...';
    this.target = this.cps[0];
  }
  update(dt) {
    const g = this.game;
    if (this.countdown > 0) {
      this.countdown -= dt;
      this.timer = 125;
      this.car.controls.throttle = 0; this.car.vx = this.car.vz = 0;
      g.hud.big(this.countdown > 0 ? String(Math.ceil(this.countdown)) : 'GO!', 0.6);
      if (this.countdown <= 0) g.audio.play('go');
      return null;
    }
    if (g.player.vehicle !== this.car) { this.text = 'Get back in your race car!'; this.target = this.car; }
    else { this.text = `Checkpoint ${this.idx + 1}/${this.cps.length}`; this.target = this.cps[this.idx]; }
    if (this.car.state !== 'ok') return 'Your car was wrecked';
    const P = g.player.pos, cp = this.cps[this.idx];
    if (g.player.vehicle === this.car && Math.hypot(P.x - cp.x, P.z - cp.z) < 15) {
      this.idx++;
      g.audio.play('checkpoint');
      if (this.idx >= this.cps.length) return 'pass';
    }
    if (this.timer <= 0) return 'Out of time';
    return null;
  }
  end() { if (this.car) this.car.mission = false; }
}

class Thief extends Mission {
  start() {
    const g = this.game;
    this.myCar = g.vehicles.spawn('sports', 119, -70.5, Math.PI / 2, '#1c1c1c');
    this.myCar.mission = true;
    const graph = g.world.graph;
    const edges = graph.edges.filter((e) => !e.noTraffic && e.a.grid && e.b.grid && Math.hypot((e.a.x + e.b.x) / 2 - 111, (e.a.z + e.b.z) / 2 + 65) > 70 && Math.hypot((e.a.x + e.b.x) / 2 - 111, (e.a.z + e.b.z) / 2 + 65) < 140);
    let v = null;
    for (let i = 0; i < 20 && !v; i++) v = g.traffic.spawnOnEdge(edges[Math.floor(Math.random() * edges.length)], 'sports', '#e63946', { cruiseMul: 1.75, ignoreLights: true });
    this.thief = v;
    if (v) { v.mission = true; v.health = 70; }
    this.timer = 160;
    this.text = 'Wreck the thief\'s red sports car!';
  }
  update() {
    const g = this.game, v = this.thief;
    if (!v) return 'The thief got away';
    this.target = v;
    if (v.state !== 'ok' || (v.driver !== 'ai' && v.driver !== 'player')) return 'pass';
    if (v.driver === 'ai' && !v.ai) {
      const n = g.world.graph.nearestNode(v.x, v.z);
      const l = n.links.find((q) => !q.edge.noTraffic);
      v.ai = new RoadDriver(g, v, n, l.edge, { cruiseMul: 1.75, ignoreLights: true });
    }
    if (v.driver === 'player') return 'pass';
    const P = g.player.pos;
    const d = Math.hypot(P.x - v.x, P.z - v.z);
    this.text = `Wreck the thief's car! (${Math.round(d)} m)`;
    if (d > 330) return 'The thief got away';
    if (this.timer <= 0) return 'Out of time';
    return null;
  }
  end() {
    if (this.thief) this.thief.mission = false;
    if (this.myCar) this.myCar.mission = false;
  }
}

class HeatWave extends Mission {
  start() {
    const g = this.game;
    this.car = g.vehicles.spawn('sports', -151.5, 200, 0, '#ff9f1c');
    this.car.mission = true;
    g.wanted.set(3);
    this.timer = 150;
    this.text = 'Lose the cops! Break line of sight.';
  }
  update() {
    const g = this.game;
    this.target = null;
    if (g.wanted.stars === 0) return 'pass';
    this.text = g.wanted.seen ? 'Lose the cops! They can see you!' : 'Hide! Stay out of sight...';
    if (this.timer <= 0) return 'The heat caught up with you';
    return null;
  }
  end() { if (this.car) this.car.mission = false; }
}

class Coins extends Mission {
  start() {
    const g = this.game;
    const pts = [[370, -300], [500, 0], [760, -10], [700, 100], [0, 0], [-148, -148], [148, 74], [-296, 296], [222, -296], [-74, 222]];
    this.left = pts.length; this.total = pts.length;
    this.coins = pts.map(([x, z]) => g.pickups.spawn('coin', x, z, 0, { onCollect: () => { this.left--; g.addMoney(50); } }));
    this.timer = 300;
  }
  update() {
    const P = this.game.player.pos;
    let best = null, bd = Infinity;
    for (const c of this.coins) {
      if (!this.game.pickups.items.includes(c)) continue;
      const d = Math.hypot(c.x - P.x, c.z - P.z);
      if (d < bd) { bd = d; best = c; }
    }
    this.targets = this.coins.filter((c) => this.game.pickups.items.includes(c));
    this.target = best;
    this.text = `Coins: ${this.total - this.left}/${this.total}`;
    if (this.left <= 0) return 'pass';
    if (this.timer <= 0) return 'Out of time';
    return null;
  }
  end() { for (const c of this.coins) if (this.game.pickups.items.includes(c)) this.game.pickups.remove(c); }
}

const CLASSES = { pizza: PizzaRun, race: Race, thief: Thief, heat: HeatWave, coins: Coins };

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.defs = MISSION_DEFS;
    this.completed = new Set();
    this.active = null;
    this.cooldown = 0;
    const beamGeo = new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true);
    beamGeo.translate(0, 30, 0);
    this.markers = this.defs.map((d) => {
      const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(d.start.x, game.world.heightAt(d.start.x, d.start.z), d.start.z);
      m.renderOrder = 4;
      game.scene.add(m);
      return m;
    });
    const tg = new THREE.CylinderGeometry(3, 3, 80, 20, 1, true); tg.translate(0, 40, 0);
    this.beam = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.visible = false; this.beam.renderOrder = 4;
    game.scene.add(this.beam);
    // save point at Hrant's villa
    const v = game.world.landmarks.villa;
    this.saveMarker = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#3dff8a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.saveMarker.position.set(v.x, 0, v.z); this.saveMarker.scale.set(1, 0.3, 1);
    game.scene.add(this.saveMarker);
  }

  start(def) {
    const g = this.game;
    this.active = new CLASSES[def.id](g, def);
    this.active.start();
    g.hud.big(def.name.toUpperCase(), 2.5, def.desc);
    g.audio.play('mission');
  }

  finish(result) {
    const g = this.game, m = this.active;
    if (!m) return;
    m.end();
    this.active = null;
    this.beam.visible = false;
    this.cooldown = 3;
    g.hud.objective(null);
    if (result === 'pass') {
      const first = !this.completed.has(m.def.id);
      const reward = first ? m.def.reward : Math.round(m.def.reward / 4);
      this.completed.add(m.def.id);
      g.addMoney(reward);
      g.hud.big('MISSION PASSED', 3.5, `+$${reward.toLocaleString()}`, '#ffd23f');
      g.audio.play('passed');
      if (m.def.id === 'heat') g.wanted.clear();
      if (this.completed.size === this.defs.length && first) setTimeout(() => g.hud.big('HRANT CITY IS YOURS', 4, 'All missions complete!', '#ff4f8b'), 4000);
      g.saveGame(true);
    } else {
      g.hud.big('MISSION FAILED', 3, result, '#ff3355');
      g.audio.play('failed');
      if (m.def.id === 'heat') g.wanted.clear();
    }
  }

  abort(reason) { if (this.active) this.finish(reason); }

  blips() {
    const out = [];
    if (this.active) {
      if (this.active.targets && this.active.targets.length) for (const t of this.active.targets) out.push({ x: t.x, z: t.z, color: '#ffd23f', size: 4, edge: true });
      else if (this.active.target) out.push({ x: this.active.target.x, z: this.active.target.z, color: '#ffe14d', size: 6, edge: true });
    } else {
      this.defs.forEach((d, i) => out.push({ x: d.start.x, z: d.start.z, color: d.color, size: 6, label: String(i + 1), done: this.completed.has(d.id), edge: true }));
    }
    const v = this.game.world.landmarks.villa;
    out.push({ x: v.x, z: v.z, color: '#3dff8a', size: 5, label: 'S' });
    return out;
  }

  update(dt) {
    const g = this.game, p = g.player, P = p.pos, input = g.input;
    this.cooldown -= dt;
    const t = g.time;
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i];
      m.visible = !this.active;
      m.material.opacity = 0.25 + Math.sin(t * 3) * 0.1;
      m.scale.y = this.completed.has(this.defs[i].id) ? 0.25 : 1;
    }
    if (this.active) {
      const m = this.active;
      m.timer -= dt;
      const res = m.update(dt);
      g.hud.objective(m.text, isFinite(m.timer) ? m.timer : null);
      const tg = m.target;
      this.beam.visible = !!tg;
      if (tg) this.beam.position.set(tg.x, g.world.heightAt(tg.x, tg.z), tg.z);
      if (res) this.finish(res);
      return;
    }
    if (p.dead || this.cooldown > 0) return;
    for (const d of this.defs) {
      if (Math.hypot(P.x - d.start.x, P.z - d.start.z) < (p.inVehicle ? 6 : 3)) {
        const done = this.completed.has(d.id);
        g.hud.prompt(`ACTION: ${done ? 'Replay' : 'Start'} "${d.name}"`);
        if (input.pressed('action')) this.start(d);
        return;
      }
    }
    const v = g.world.landmarks.villa;
    if (Math.hypot(P.x - v.x, P.z - v.z) < 4) {
      g.hud.prompt('ACTION: Save game at Hrant\'s Villa');
      if (input.pressed('action')) { g.saveGame(true); g.hud.big('GAME SAVED', 2, 'Hrant\'s Villa', '#3dff8a'); p.health = p.maxHealth; }
    }
  }
}
