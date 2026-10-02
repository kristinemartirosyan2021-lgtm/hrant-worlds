// Ground loot: generation by area tier, rarity visuals (beams/rings), pickup and death drops.
import * as THREE from 'three';
import { RARITY } from '../config.js';
import { WEAPONS, AMMO } from '../combat/WeaponDefs.js';
import { buildWeaponModel } from '../entities/WeaponModels.js';
import { PartSet, GEO, stdMat } from '../entities/meshUtil.js';
import { MAX_GRENADES, MAX_MEDKITS, magSize } from './InventorySystem.js';
import { ARMOR_LEVELS, HELMET_LEVELS } from '../combat/HealthSystem.js';

const WEAPON_SCORE = { ar: 1.0, smg: 0.92, shotgun: 0.82, sniper: 0.78, pistol: 0.4 };
const _v = new THREE.Vector3();

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0.9)');
  x.fillStyle = g; x.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class LootSystem {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.group = new THREE.Group();
    this.group.name = 'loot';
    game.scene.add(this.group);
    const bt = beamTexture();
    this.beamGeo = new THREE.CylinderGeometry(0.05, 0.22, 1, 8, 1, true).translate(0, 0.5, 0);
    this.beamMats = RARITY.map((r) => new THREE.MeshBasicMaterial({ map: bt, color: r.hex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.ringGeo = new THREE.RingGeometry(0.42, 0.55, 28).rotateX(-Math.PI / 2);
    this.ringMats = RARITY.map((r) => new THREE.MeshBasicMaterial({ color: r.hex, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.time = 0;
    this.picked = 0;
  }

  clear() {
    for (const it of this.items) this.group.remove(it.obj);
    this.items.length = 0;
  }

  spawnAll() {
    this.clear();
    const spots = this.game.world.lootSpots;
    for (const s of spots) {
      const r = Math.random();
      if (r < 0.12) continue;
      const it = this.randomItem(s.tier);
      this.add(it, s.x, s.y, s.z);
      if (it.kind === 'weapon') {
        const def = WEAPONS[it.id];
        const a = Math.random() * Math.PI * 2;
        this.add({ kind: 'ammo', ammo: def.ammo, amount: AMMO[def.ammo].pack, rarity: 0 }, s.x + Math.cos(a) * 0.7, s.y, s.z + Math.sin(a) * 0.7);
      }
      if (s.tier >= 1.5 && Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        this.add(this.randomItem(s.tier, true), s.x + Math.cos(a) * 1.1, s.y, s.z + Math.sin(a) * 1.1);
      }
    }
  }

  rarityFor(tier) {
    const w = [Math.max(0.12, 1.25 - tier * 0.5), 0.55 + tier * 0.05, 0.1 + tier * 0.17, 0.02 + Math.max(0, tier - 0.8) * 0.12];
    const sum = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < 4; i++) { r -= w[i]; if (r <= 0) return i; }
    return 0;
  }

  randomItem(tier, noWeapon = false) {
    const r = Math.random();
    const rarity = this.rarityFor(tier);
    if (r < 0.4 && !noWeapon) {
      const wr = Math.random();
      const sniperBoost = tier > 1.2 ? 0.06 : 0;
      const id = wr < 0.28 ? 'ar' : wr < 0.53 ? 'smg' : wr < 0.7 ? 'shotgun' : wr < 0.8 + sniperBoost ? 'sniper' : 'pistol';
      return { kind: 'weapon', id, rarity };
    }
    if (r < 0.6) {
      const types = ['light', 'rifle', 'rifle', 'shell', 'sniper', 'light'];
      const t = types[Math.floor(Math.random() * types.length)];
      return { kind: 'ammo', ammo: t, amount: AMMO[t].pack, rarity: 0 };
    }
    if (r < 0.7) { const lv = Math.min(3, Math.max(1, rarity)); return { kind: 'armor', level: lv, rarity: lv - 1 + (lv === 3 ? 0 : 0) }; }
    if (r < 0.79) { const lv = Math.min(3, Math.max(1, rarity)); return { kind: 'helmet', level: lv, rarity: lv - 1 }; }
    if (r < 0.91) return { kind: 'medkit', rarity: 1 };
    return { kind: 'grenade', amount: 2, rarity: 1 };
  }

  label(it) {
    switch (it.kind) {
      case 'weapon': return `${WEAPONS[it.id].name} · ${WEAPONS[it.id].type}`;
      case 'ammo': return `${AMMO[it.ammo].name} ×${it.amount}`;
      case 'armor': return `Զրահաբաճկոն · Մակարդակ ${it.level}`;
      case 'helmet': return `Սաղավարտ · Մակարդակ ${it.level}`;
      case 'medkit': return 'Դեղարկղ';
      case 'grenade': return `Նռնակ ×${it.amount}`;
    }
    return '';
  }

  buildVisual(it) {
    const obj = new THREE.Group();
    const model = new THREE.Group();
    obj.add(model);
    const R = RARITY[it.rarity];
    if (it.kind === 'weapon') {
      const w = buildWeaponModel(it.id, it.rarity);
      w.rotation.set(0, 0, Math.PI / 2);
      w.position.y = 0.08;
      model.add(w);
      model.scale.setScalar(1.25);
    } else if (it.kind === 'ammo') {
      const col = AMMO[it.ammo].color;
      new PartSet()
        .box(stdMat('#3d4630', 0.8), 0.42, 0.22, 0.26, 0, 0.11, 0)
        .box(stdMat(col, 0.5, 0.3), 0.43, 0.05, 0.27, 0, 0.17, 0)
        .box(stdMat('#222', 0.6), 0.1, 0.03, 0.04, 0, 0.235, 0)
        .build(model);
    } else if (it.kind === 'armor') {
      const c = ['#4b5a34', '#3a4a5a', '#2b2b2b'][it.level - 1];
      new PartSet()
        .box(stdMat(c, 0.8), 0.46, 0.5, 0.18, 0, 0.3, 0)
        .box(stdMat(c, 0.8), 0.12, 0.12, 0.2, -0.16, 0.58, 0)
        .box(stdMat(c, 0.8), 0.12, 0.12, 0.2, 0.16, 0.58, 0)
        .box(stdMat('#222', 0.7), 0.1, 0.12, 0.06, -0.12, 0.2, 0.11)
        .box(stdMat('#222', 0.7), 0.1, 0.12, 0.06, 0.12, 0.2, 0.11)
        .box(stdMat(R.css, 0.5, 0.2, { emissive: R.hex, emissiveIntensity: 0.4 }), 0.2, 0.04, 0.02, 0, 0.45, 0.1)
        .build(model);
    } else if (it.kind === 'helmet') {
      const c = ['#4b5a34', '#3a4a5a', '#2b2b2b'][it.level - 1];
      new PartSet()
        .add(GEO.hemi, stdMat(c, 0.6, 0.2), 0, 0.08, 0, 0.42, 0.36, 0.46)
        .box(stdMat(c, 0.6, 0.2), 0.44, 0.03, 0.48, 0, 0.08, 0)
        .box(stdMat(R.css, 0.5, 0.2, { emissive: R.hex, emissiveIntensity: 0.4 }), 0.12, 0.03, 0.02, 0, 0.2, 0.2)
        .build(model);
    } else if (it.kind === 'medkit') {
      new PartSet()
        .box(stdMat('#e8e6e0', 0.6), 0.4, 0.26, 0.18, 0, 0.13, 0)
        .box(stdMat('#2fbf6a', 0.5, 0, { emissive: 0x1a8040, emissiveIntensity: 0.6 }), 0.06, 0.18, 0.19, 0, 0.13, 0)
        .box(stdMat('#2fbf6a', 0.5, 0, { emissive: 0x1a8040, emissiveIntensity: 0.6 }), 0.18, 0.06, 0.19, 0, 0.13, 0)
        .box(stdMat('#333', 0.6), 0.14, 0.03, 0.04, 0, 0.275, 0)
        .build(model);
    } else if (it.kind === 'grenade') {
      new PartSet()
        .add(GEO.sphere, stdMat('#3b4a2e', 0.6, 0.3), -0.08, 0.1, 0, 0.17, 0.21, 0.17)
        .add(GEO.sphere, stdMat('#3b4a2e', 0.6, 0.3), 0.1, 0.1, 0.02, 0.17, 0.21, 0.17)
        .box(stdMat('#888', 0.4, 0.8), 0.05, 0.05, 0.05, -0.08, 0.23, 0)
        .box(stdMat('#888', 0.4, 0.8), 0.05, 0.05, 0.05, 0.1, 0.23, 0.02)
        .build(model);
    }
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    const ring = new THREE.Mesh(this.ringGeo, this.ringMats[it.rarity]);
    ring.position.y = 0.03;
    obj.add(ring);
    let beam = null;
    if (it.rarity >= 1 || it.kind === 'weapon') {
      beam = new THREE.Mesh(this.beamGeo, this.beamMats[it.rarity]);
      beam.scale.set(1, it.rarity >= 3 ? 7 : it.rarity >= 2 ? 4.5 : 2.6, 1);
      obj.add(beam);
    }
    obj.userData = { model, ring, beam };
    return obj;
  }

  add(it, x, y, z) {
    it.x = x; it.y = y; it.z = z;
    it.active = true;
    it.claimedBy = null;
    it.phase = Math.random() * 6;
    it.obj = this.buildVisual(it);
    it.obj.position.set(x, y, z);
    this.group.add(it.obj);
    this.items.push(it);
    return it;
  }

  remove(it) {
    it.active = false;
    this.group.remove(it.obj);
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
  }

  // Death drop: scatter everything the actor carried.
  dropAll(actor) {
    const p = actor.ctrl.pos;
    const out = [];
    for (const s of actor.inv.slots) if (s) out.push({ kind: 'weapon', id: s.id, rarity: s.rarity, mag: s.mag });
    for (const [k, n] of Object.entries(actor.inv.ammo)) if (n > 0) out.push({ kind: 'ammo', ammo: k, amount: n, rarity: 0 });
    if (actor.health.armor.level > 0) out.push({ kind: 'armor', level: actor.health.armor.level, rarity: actor.health.armor.level - 1 });
    if (actor.health.helmet.level > 0) out.push({ kind: 'helmet', level: actor.health.helmet.level, rarity: actor.health.helmet.level - 1 });
    if (actor.inv.medkits > 0) for (let i = 0; i < actor.inv.medkits; i++) out.push({ kind: 'medkit', rarity: 1 });
    if (actor.inv.grenades > 0) out.push({ kind: 'grenade', amount: actor.inv.grenades, rarity: 1 });
    const col = this.game.world.collision;
    out.forEach((it, i) => {
      const a = (i / out.length) * Math.PI * 2 + Math.random() * 0.3;
      const r = 0.7 + (i % 2) * 0.5;
      let x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const y = col.groundAt(x, z, 0.1, p.y + 0.3, 0.3);
      if (Math.abs(y - p.y) > 0.6) { x = p.x; z = p.z; }
      this.add(it, x, col.groundAt(x, z, 0.1, p.y + 0.3, 0.3), z);
    });
  }

  nearest(actor, maxD = 2.4) {
    if (actor.air) return null;
    const p = actor.ctrl.pos;
    let best = null, bestS = Infinity;
    actor.forward(_v);
    for (const it of this.items) {
      if (!it.active) continue;
      const dx = it.x - p.x, dz = it.z - p.z, dy = it.y - p.y;
      if (Math.abs(dy) > 1.4) continue;
      const d = Math.hypot(dx, dz);
      if (d > maxD) continue;
      const facing = d > 0.01 ? (dx * _v.x + dz * _v.z) / d : 1;
      const s = d - facing * 0.8;
      if (s < bestS) { bestS = s; best = it; }
    }
    return best;
  }

  // ------------------------------------------------------------ pickup logic
  apply(actor, it, auto = false) {
    const inv = actor.inv;
    const g = this.game;
    let taken = false, kind = 'item';
    switch (it.kind) {
      case 'weapon': {
        if (auto) return false;
        const def = WEAPONS[it.id];
        const { dropped, slot } = inv.addWeapon(it.id, it.rarity, it.mag ?? null);
        if (dropped) {
          this.add({ kind: 'weapon', id: dropped.id, rarity: dropped.rarity, mag: dropped.mag }, actor.ctrl.pos.x + 0.3, actor.ctrl.pos.y, actor.ctrl.pos.z + 0.3);
        }
        actor.inv.current = slot;
        actor.weapons.reloadLeft = 0;
        actor.weapons.switchLeft = 0.35;
        actor.equipCurrentModel();
        if (inv.ammo[def.ammo] === 0 && !actor.isPlayer) inv.ammo[def.ammo] = 10;
        taken = true; kind = 'weapon';
        break;
      }
      case 'ammo': {
        const n = inv.addAmmo(it.ammo, it.amount);
        if (n <= 0) return false;
        it.amount -= n;
        if (actor.isPlayer) g.ui.toast(`+${n} ${AMMO[it.ammo].name}`, AMMO[it.ammo].color);
        if (it.amount > 0) { g.audio.pickup('item'); return 'partial'; }
        taken = true;
        break;
      }
      case 'armor': {
        const cur = actor.health.armor;
        if (auto || (cur.level >= it.level && cur.dur >= ARMOR_LEVELS[cur.level].dur * 0.6)) { if (!auto && actor.isPlayer) g.ui.toast('Ունես ավելի լավ զրահ', '#aaa'); return false; }
        if (cur.level > 0) this.add({ kind: 'armor', level: cur.level, rarity: cur.level - 1 }, actor.ctrl.pos.x - 0.3, actor.ctrl.pos.y, actor.ctrl.pos.z);
        actor.health.equipArmor(it.level);
        taken = true; kind = 'armor';
        break;
      }
      case 'helmet': {
        const cur = actor.health.helmet;
        if (auto || (cur.level >= it.level && cur.dur >= HELMET_LEVELS[cur.level].dur * 0.6)) { if (!auto && actor.isPlayer) g.ui.toast('Ունես ավելի լավ սաղավարտ', '#aaa'); return false; }
        if (cur.level > 0) this.add({ kind: 'helmet', level: cur.level, rarity: cur.level - 1 }, actor.ctrl.pos.x - 0.3, actor.ctrl.pos.y, actor.ctrl.pos.z + 0.3);
        actor.health.equipHelmet(it.level);
        taken = true; kind = 'armor';
        break;
      }
      case 'medkit':
        if (inv.medkits >= MAX_MEDKITS) return false;
        inv.medkits++;
        taken = true;
        if (actor.isPlayer) g.ui.toast('+1 Դեղարկղ', '#2fbf6a');
        break;
      case 'grenade': {
        if (inv.grenades >= MAX_GRENADES) return false;
        const n = Math.min(it.amount, MAX_GRENADES - inv.grenades);
        inv.grenades += n;
        it.amount -= n;
        if (actor.isPlayer) g.ui.toast(`+${n} Նռնակ`, '#c8b070');
        if (it.amount > 0) return 'partial';
        taken = true;
        break;
      }
    }
    if (taken) {
      this.remove(it);
      if (actor.isPlayer) {
        g.audio.pickup(kind);
        this.picked++;
        if (it.kind !== 'ammo' && it.kind !== 'medkit' && it.kind !== 'grenade') g.ui.toast(`${this.label(it)}`, RARITY[it.rarity].css);
      }
    }
    return taken;
  }

  tryPickup(player) {
    const it = this.nearest(player);
    if (!it) return false;
    return this.apply(player, it, false);
  }

  update(dt, camera) {
    this.time += dt;
    const cp = camera.position;
    const pl = this.game.player;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      const dx = it.x - cp.x, dz = it.z - cp.z;
      const d2 = dx * dx + dz * dz;
      const u = it.obj.userData;
      const near = d2 < 75 * 75;
      u.model.visible = near;
      u.ring.visible = d2 < 50 * 50;
      if (u.beam) u.beam.visible = d2 < 160 * 160;
      if (near) {
        u.model.rotation.y = this.time * 0.9 + it.phase;
        u.model.position.y = 0.12 + Math.sin(this.time * 2 + it.phase) * 0.05;
      }
      if (u.beam) u.beam.material.opacity = 0.65 + Math.sin(this.time * 3 + it.phase) * 0.15;
      // player auto-pickup for consumables
      if (pl && pl.alive && (it.kind === 'ammo' || it.kind === 'medkit' || it.kind === 'grenade')) {
        const px = it.x - pl.ctrl.pos.x, pz = it.z - pl.ctrl.pos.z;
        if (px * px + pz * pz < 1.3 && Math.abs(it.y - pl.ctrl.pos.y) < 1.2) {
          if (it.kind !== 'ammo' || this.ammoUseful(pl, it)) this.apply(pl, it, true);
        }
      }
    }
  }

  // ------------------------------------------------------------ bot helpers
  weaponScore(id, rarity) { return WEAPON_SCORE[id] * RARITY[rarity].dmg; }

  isUpgradeFor(bot, it) {
    const inv = bot.inv;
    const def = WEAPONS[it.id];
    if (def.slot !== 'primary') return false;
    if (!inv.slots[0] || !inv.slots[1]) return true;
    const worst = Math.min(this.weaponScore(inv.slots[0].id, inv.slots[0].rarity), this.weaponScore(inv.slots[1].id, inv.slots[1].rarity));
    return this.weaponScore(it.id, it.rarity) > worst + 0.08;
  }

  ammoUseful(actor, it) {
    return actor.inv.slots.some((s) => s && WEAPONS[s.id].ammo === it.ammo);
  }

  botAutoPickup(bot) {
    const p = bot.ctrl.pos;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (!it.active) continue;
      const dx = it.x - p.x, dz = it.z - p.z;
      if (dx * dx + dz * dz > 2.6 || Math.abs(it.y - p.y) > 1.2) continue;
      let want = false;
      if (it.kind === 'weapon') {
        want = this.isUpgradeFor(bot, it);
        if (want && bot.inv.slots[0] && bot.inv.slots[1]) {
          // replace the worse primary
          const s0 = this.weaponScore(bot.inv.slots[0].id, bot.inv.slots[0].rarity);
          const s1 = this.weaponScore(bot.inv.slots[1].id, bot.inv.slots[1].rarity);
          bot.inv.current = s0 < s1 ? 0 : 1;
        }
      } else if (it.kind === 'ammo') want = this.ammoUseful(bot, it);
      else if (it.kind === 'armor') want = it.level > bot.health.armor.level;
      else if (it.kind === 'helmet') want = it.level > bot.health.helmet.level;
      else want = true;
      if (want) {
        const res = this.apply(bot, it, false);
        if (res && it.kind === 'weapon') {
          const def = WEAPONS[it.id];
          const w = bot.inv.weapon;
          if (w && w.mag === 0) w.mag = magSize(w);
          if (bot.inv.ammo[def.ammo] < 20) bot.inv.ammo[def.ammo] += 20;
        }
        if (bot.ai.lootItem === it) bot.ai.lootItem = null;
      }
    }
  }
}
