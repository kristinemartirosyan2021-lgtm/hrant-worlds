// Collectable items: cash (dropped), health, armor, mission coins.
import * as THREE from 'three';

const DEFS = {
  cash: { color: '#3ddc5a', geo: () => new THREE.BoxGeometry(0.6, 0.3, 0.35), r: 1.4 },
  health: { color: '#ff3355', geo: () => { const g = new THREE.BoxGeometry(0.8, 0.25, 0.25); const g2 = new THREE.BoxGeometry(0.25, 0.8, 0.25); return mergeTwo(g, g2); }, r: 1.5, respawn: 45 },
  armor: { color: '#2b7bff', geo: () => new THREE.CylinderGeometry(0.45, 0.45, 0.15, 12).rotateX(Math.PI / 2), r: 1.5, respawn: 60 },
  coin: { color: '#ffd23f', geo: () => new THREE.CylinderGeometry(0.7, 0.7, 0.16, 16).rotateX(Math.PI / 2), r: 3.2 },
};
function mergeTwo(a, b) {
  const g = new THREE.BufferGeometry();
  const A = a.toNonIndexed(), B = b.toNonIndexed();
  for (const name of ['position', 'normal']) {
    const arr = new Float32Array(A.attributes[name].array.length + B.attributes[name].array.length);
    arr.set(A.attributes[name].array); arr.set(B.attributes[name].array, A.attributes[name].array.length);
    g.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  return g;
}

export class Pickups {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.geos = {}; this.mats = {};
    for (const [k, d] of Object.entries(DEFS)) {
      this.geos[k] = d.geo();
      this.mats[k] = new THREE.MeshBasicMaterial({ color: d.color });
    }
  }

  spawn(type, x, z, value = 0, opts = {}) {
    const mesh = new THREE.Mesh(this.geos[type], this.mats[type]);
    const y = (opts.y ?? this.game.world.heightAt(x, z)) + 1;
    mesh.position.set(x, y, z);
    this.game.scene.add(mesh);
    const it = { type, x, y, z, value, mesh, active: true, timer: 0, life: opts.life ?? (type === 'cash' ? 40 : Infinity), respawn: opts.respawn ?? DEFS[type].respawn, onCollect: opts.onCollect };
    this.items.push(it);
    return it;
  }

  remove(it) {
    this.game.scene.remove(it.mesh);
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
  }

  update(dt) {
    const g = this.game, p = g.player;
    if (p.dead) return;
    const P = p.pos;
    const t = g.time;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (!it.active) {
        it.timer -= dt;
        if (it.timer <= 0) { it.active = true; it.mesh.visible = true; }
        continue;
      }
      it.life -= dt;
      if (it.life <= 0) { this.remove(it); continue; }
      it.mesh.rotation.y = t * 2.5;
      it.mesh.position.y = it.y + Math.sin(t * 3 + i) * 0.15;
      const r = DEFS[it.type].r + (p.inVehicle ? 1.5 : 0);
      if ((P.x - it.x) ** 2 + (P.z - it.z) ** 2 < r * r && Math.abs(P.y + 1 - it.y) < 3) {
        if (it.type === 'health' && p.health >= p.maxHealth) continue;
        if (it.type === 'armor' && p.armor >= 100) continue;
        this.collect(it);
      }
    }
  }

  collect(it) {
    const g = this.game, p = g.player;
    if (it.type === 'cash') { g.addMoney(it.value); }
    if (it.type === 'health') { p.health = p.maxHealth; g.hud.message('+ Health', 1.2); }
    if (it.type === 'armor') { p.armor = 100; g.hud.message('+ Armor', 1.2); }
    g.audio.play('pickup');
    if (it.onCollect) it.onCollect(it);
    if (it.respawn) { it.active = false; it.timer = it.respawn; it.mesh.visible = false; }
    else this.remove(it);
  }
}
