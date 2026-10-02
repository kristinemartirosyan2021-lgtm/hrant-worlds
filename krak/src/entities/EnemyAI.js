// Tactical bot AI: perception (sight + hearing), state machine
// PATROL / ALERT / SEARCH / ATTACK / COVER / FLANK / RETREAT / CHASE, cover usage, looting, zone awareness.
import * as THREE from 'three';
import { Actor } from './Actor.js';
import { WEAPONS } from '../combat/WeaponDefs.js';
import { clamp, lerp, rand, chance, wrapAngle, dampAngle } from '../core/util.js';
import { magSize } from '../gameplay/InventorySystem.js';

const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _eye = new THREE.Vector3();
const DEG = Math.PI / 180;

export const S = {
  PATROL: 'PATROL', ALERT: 'ALERT', SEARCH: 'SEARCH', ATTACK: 'ATTACK',
  COVER: 'TAKE_COVER', FLANK: 'FLANK', RETREAT: 'RETREAT', CHASE: 'CHASE',
};

export class Bot extends Actor {
  constructor(game, opts) {
    super(game, { ...opts, isPlayer: false });
    this.ai = new EnemyAI(this, opts.skill ?? 0.5);
  }
  spawn(x, z, yaw) {
    super.spawn(x, z, yaw);
    this.ai.reset();
  }
  update(dt) {
    if (this.alive && this.air) { if (this.game.match.state === 'playing') this.game.drop.botIntent(this); super.update(dt); return; }
    if (this.alive && this.game.match.state === 'playing') this.ai.update(dt);
    else { const I = this.intent; I.mx = I.mz = 0; I.fire = I.firePressed = false; }
    super.update(dt);
  }
  onDamagedAI(dmg, info) { if (this.alive) this.ai.onDamaged(dmg, info); }
}

export class EnemyAI {
  constructor(bot, skill) {
    this.bot = bot;
    this.game = bot.game;
    this.setSkill(skill);
    this.lastSeen = new THREE.Vector3();
    this.noisePos = new THREE.Vector3();
    this.goal = new THREE.Vector3();
    this.aimOff = new THREE.Vector3();
    this.lastPos = new THREE.Vector3();
    this.game.events.on('gunshot', (e) => this.onNoise(e.actor, e.pos, e.loud));
    this.game.events.on('footstep', (e) => this.onNoise(e.actor, e.pos, 12));
    this.reset();
  }

  setSkill(s) {
    this.skill = s;
    this.reaction = lerp(0.9, 0.3, s);
    this.turnRate = lerp(3.2, 8.5, s);
    this.baseErr = lerp(4.8, 1.3, s) * DEG;
    this.viewDist = lerp(70, 120, s);
    this.aggression = clamp(rand(0.15, 0.9) * (0.7 + s * 0.5), 0.1, 1);
    this.headChance = lerp(0.04, 0.28, s);
    this.focusRate = lerp(1.1, 2.8, s);
  }

  reset() {
    this.state = S.PATROL;
    this.stateT = 0;
    this.target = null;
    this.visible = false;
    this.lastSeenT = -99;
    this.noiseT = -99;
    this.reactionT = 0;
    this.aimErr = 0.2;
    this.percT = Math.random() * 0.3;
    this.path = null;
    this.pathI = 0;
    this.repathT = 0;
    this.cover = null;
    this.strafe = 1;
    this.strafeT = 0;
    this.burst = 0;
    this.burstPause = 0;
    this.stuckT = 0;
    this.lootItem = null;
    this.grenadeCD = rand(6, 12);
    this.lookYaw = this.bot.yaw;
    this.scanT = 0;
    this.hitRecent = -99;
    this.wantCrouch = false;
    this.healCD = 0;
    this.flankSide = chance(0.5) ? 1 : -1;
    this.aimHead = false;
    this.moveSpeedMode = 'run';
  }

  setState(s) {
    if (this.state === s) return;
    if (this.cover && s !== S.COVER) { this.cover.claimed = null; this.cover = null; }
    this.state = s;
    this.stateT = 0;
    this.path = null;
    this.wantCrouch = false;
    if (this.bot.game.debugAI) console.log(this.bot.name, '->', s);
  }

  // ------------------------------------------------------------ perception
  eye(out) { return this.bot.headWorld(out); }

  canSee(a) {
    const col = this.game.world.collision;
    this.eye(_eye);
    a.chestWorld(_a);
    if (col.clear(_eye.x, _eye.y, _eye.z, _a.x, _a.y, _a.z)) return true;
    a.headWorld(_a);
    return col.clear(_eye.x, _eye.y, _eye.z, _a.x, _a.y, _a.z);
  }

  // Max distance at which this bot is willing to start a fight with its best weapon.
  engageRange() {
    const b = this.bot;
    const R = { pistol: 38, smg: 46, shotgun: 30, ar: 95, sniper: 170 };
    let r = 30;
    for (const s of b.inv.slots) {
      if (!s) continue;
      const def = WEAPONS[s.id];
      if (s.mag + b.inv.ammo[def.ammo] > 0) r = Math.max(r, R[s.id]);
    }
    return r * lerp(0.85, 1.15, this.aggression);
  }

  perceive() {
    const b = this.bot;
    const now = this.game.time;
    const engage = this.engageRange();
    const cands = [];
    for (const a of this.game.actors) {
      if (a === b || !a.alive || a.air === 'plane') continue;
      const dx = a.ctrl.pos.x - b.ctrl.pos.x, dz = a.ctrl.pos.z - b.ctrl.pos.z;
      const d = Math.hypot(dx, dz);
      let range = this.viewDist;
      if (a.weapons.sinceShot < 0.6) range *= 1.6;
      if (a.ctrl.crouching && a.weapons.sinceShot > 1) range *= 0.6;
      if (d > range) continue;
      // Out of effective weapon range: ignore unless they are actively hurting us.
      const threat = a === b.lastHitBy && now - b.lastHitTime < 5;
      if (d > engage && !threat && !(a === this.target && this.state === S.ATTACK && d < engage * 1.4)) continue;
      const known = a === this.target && now - this.lastSeenT < 2;
      if (d > 5 && !known) {
        const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - b.yaw));
        if (ang > 80 * DEG) continue;
      }
      cands.push({ a, d });
    }
    cands.sort((p, q) => p.d - q.d);
    let best = null, bestScore = Infinity;
    for (let i = 0; i < Math.min(4, cands.length); i++) {
      const { a, d } = cands[i];
      if (!this.canSee(a)) continue;
      let score = d * (a.isPlayer ? 0.85 : 1);
      if (a === this.target) score *= 0.6;
      if (a === b.lastHitBy && now - b.lastHitTime < 4) score *= 0.5;
      if (score < bestScore) { bestScore = score; best = a; }
    }
    if (best) {
      const fresh = best !== this.target || now - this.lastSeenT > 1.8;
      if (fresh) {
        this.reactionT = this.reaction * rand(0.8, 1.35) + (best.isPlayer ? 0.12 : 0);
        this.aimErr = this.baseErr * 3 + 0.04;
        this.chooseWeapon(cands.find((c) => c.a === best).d);
      }
      this.target = best;
      this.visible = true;
      this.lastSeen.copy(best.ctrl.pos);
      this.lastSeenT = now;
    } else {
      this.visible = false;
    }
  }

  onNoise(actor, pos, loud) {
    const b = this.bot;
    if (!b.alive || actor === b || this.game.match.state !== 'playing') return;
    const d = b.ctrl.pos.distanceTo(pos);
    if (d > loud) return;
    if (this.visible) return;
    const err = d * 0.08;
    this.noisePos.set(pos.x + rand(-err, err), pos.y, pos.z + rand(-err, err));
    this.noiseT = this.game.time;
    if (this.state === S.PATROL || (this.state === S.SEARCH && this.stateT > 2)) this.setState(S.ALERT);
  }

  onDamaged(dmg, info) {
    const now = this.game.time;
    this.hitRecent = now;
    const att = info.attacker;
    if (info.zone || info.fall) return;
    if (att && att !== this.bot && att.alive) {
      if (!this.visible || this.target === att) {
        this.target = att;
        this.lastSeen.copy(att.ctrl.pos);
        this.lastSeenT = now - 0.5;
        // turn towards attacker immediately (reaction)
        this.lookYaw = Math.atan2(att.ctrl.pos.x - this.bot.ctrl.pos.x, att.ctrl.pos.z - this.bot.ctrl.pos.z);
      }
    }
    const hp = this.bot.health.hp;
    if (this.state !== S.COVER && this.state !== S.RETREAT) {
      if (hp < 35 && (this.bot.inv.medkits > 0 || chance(0.5))) this.setState(S.RETREAT);
      else if (hp < 65 && chance(0.75 - this.aggression * 0.45)) this.setState(S.COVER);
      else if (this.state === S.PATROL || this.state === S.SEARCH || this.state === S.ALERT) this.setState(this.visible ? S.ATTACK : S.CHASE);
    }
  }

  // ------------------------------------------------------------ helpers
  zoneInfo() {
    const z = this.game.zone;
    const p = this.bot.ctrl.pos;
    const dCur = Math.hypot(p.x - z.center.x, p.z - z.center.z);
    const dNext = Math.hypot(p.x - z.next.x, p.z - z.next.z);
    const outsideCur = dCur > z.radius - 3;
    const outsideNext = dNext > z.nextRadius - 5;
    const urgent = outsideCur || (outsideNext && (z.shrinking || z.timeLeft < 22));
    return { outsideCur, outsideNext, urgent };
  }

  zonePoint() {
    const z = this.game.zone;
    const nav = this.game.world.nav;
    const r = Math.max(2, z.nextRadius * 0.55);
    return nav.randomWalkableNear(z.next.x, z.next.z, r) || { x: z.next.x, z: z.next.z };
  }

  requestPath(x, z) {
    const g = this.game;
    if (g.pathBudget <= 0) return false;
    g.pathBudget--;
    const p = this.bot.ctrl.pos;
    this.path = g.world.nav.findPath(p.x, p.z, x, z);
    this.pathI = 0;
    this.goal.set(x, 0, z);
    this.repathT = 1.5;
    this.stuckT = 0;
    this.lastPos.copy(p);
    if (!this.path) this.path = [];
    return true;
  }

  // Returns desired move direction (x,z) along current path, or null when arrived.
  followPath(dt) {
    const p = this.bot.ctrl.pos;
    if (!this.path || this.pathI >= this.path.length) return null;
    let wp = this.path[this.pathI];
    let dx = wp.x - p.x, dz = wp.z - p.z;
    let d = Math.hypot(dx, dz);
    const last = this.pathI === this.path.length - 1;
    if (d < (last ? 0.6 : 0.9)) {
      this.pathI++;
      if (this.pathI >= this.path.length) return null;
      wp = this.path[this.pathI];
      dx = wp.x - p.x; dz = wp.z - p.z; d = Math.hypot(dx, dz);
    }
    // stuck detection
    this.stuckT += dt;
    if (this.stuckT > 1.2) {
      if (p.distanceTo(this.lastPos) < 0.6) {
        this.bot.intent.jump = true;
        this.path = null;
        this.stuckCount = (this.stuckCount || 0) + 1;
        if (this.stuckCount > 2) { this.stuckCount = 0; if (this.lootItem) { this.lootItem.claimedBy = null; this.lootItem = null; } }
        return null;
      }
      this.stuckCount = 0;
      this.stuckT = 0;
      this.lastPos.copy(p);
    }
    return { x: dx / (d || 1), z: dz / (d || 1), d };
  }

  moveTo(dt, x, z, mode = 'run') {
    const g = this.game;
    if (!this.path || this.goal.distanceTo(_v.set(x, 0, z)) > 2.5) {
      if (!this.requestPath(x, z)) return 'wait';
    }
    const dir = this.followPath(dt);
    if (!dir) {
      const p = this.bot.ctrl.pos;
      if (Math.hypot(x - p.x, z - p.z) < 1.5) return 'arrived';
      return 'wait';
    }
    this.move(dir.x, dir.z, mode);
    void g;
    return 'moving';
  }

  move(x, z, mode) {
    const I = this.bot.intent;
    // separation from nearby actors
    const p = this.bot.ctrl.pos;
    for (const a of this.game.actors) {
      if (a === this.bot || !a.alive) continue;
      const dx = p.x - a.ctrl.pos.x, dz = p.z - a.ctrl.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 2.25 && d2 > 1e-4) { const d = Math.sqrt(d2); x += (dx / d) * (1.5 - d); z += (dz / d) * (1.5 - d); }
    }
    const l = Math.hypot(x, z) || 1;
    I.mx = x / l; I.mz = z / l;
    I.sprint = mode === 'sprint';
    this.moveSpeedMode = mode;
  }

  stop() { const I = this.bot.intent; I.mx = 0; I.mz = 0; I.sprint = false; }

  chooseWeapon(dist) {
    const b = this.bot;
    const pref = dist < 14 ? 'close' : dist > 50 ? 'far' : 'mid';
    const slot = b.inv.bestSlot(pref);
    if (slot >= 0 && slot !== b.inv.current) b.intent.slot = slot;
  }

  needs() {
    const b = this.bot;
    const hasPrimary = !!(b.inv.slots[0] || b.inv.slots[1]);
    return {
      weapon: !hasPrimary,
      ammo: b.ammoTotal() < 40,
      armor: b.health.armor.level < 2,
      helmet: b.health.helmet.level < 2,
      medkit: b.inv.medkits < 2,
      grenade: b.inv.grenades < 1,
      upgrade: true,
    };
  }

  findLoot() {
    const b = this.bot;
    const n = this.needs();
    const items = this.game.loot.items;
    const p = b.ctrl.pos;
    let best = null, bestS = Infinity;
    for (const it of items) {
      if (!it.active || it.y > p.y + 0.8 || it.y < p.y - 3) continue;
      if (it.claimedBy && it.claimedBy !== b && it.claimedBy.alive) continue;
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d > 55) continue;
      let want = 0;
      if (it.kind === 'weapon') {
        const def = WEAPONS[it.id];
        if (def.slot === 'primary') want = n.weapon ? 3 : (this.game.loot.isUpgradeFor(b, it) ? 1.2 : 0);
      } else if (it.kind === 'ammo') want = n.ammo && this.game.loot.ammoUseful(b, it) ? 1.5 : 0.2;
      else if (it.kind === 'armor') want = it.level > b.health.armor.level ? 1.6 : 0;
      else if (it.kind === 'helmet') want = it.level > b.health.helmet.level ? 1.2 : 0;
      else if (it.kind === 'medkit') want = n.medkit ? 1.2 : 0;
      else if (it.kind === 'grenade') want = n.grenade ? 0.7 : 0;
      if (want <= 0) continue;
      const s = d / want;
      if (s < bestS) { bestS = s; best = it; }
    }
    return best;
  }

  // ------------------------------------------------------------ main update
  update(dt) {
    const b = this.bot, g = this.game, I = b.intent;
    this.stateT += dt;
    I.fire = I.firePressed = I.jump = I.reload = I.heal = false;
    I.slot = null;
    I.aiming = false;
    this.percT -= dt;
    if (this.percT <= 0) { this.percT = 0.18 + Math.random() * 0.12; this.perceive(); }
    if (this.target && !this.target.alive) { this.target = null; this.visible = false; if (this.state === S.ATTACK || this.state === S.CHASE || this.state === S.FLANK) this.setState(S.SEARCH); }

    const zi = this.zoneInfo();
    // Zone override: never die to the storm while busy with something else.
    if (zi.outsideCur && this.state !== S.PATROL) {
      const z = g.zone;
      const out = Math.hypot(b.ctrl.pos.x - z.center.x, b.ctrl.pos.z - z.center.y) - z.radius;
      const closeFight = this.visible && this.target && this.target.ctrl.pos.distanceTo(b.ctrl.pos) < 14 && b.health.hp > 50;
      if (!closeFight || out > 12) { this.setState(S.PATROL); this.path = null; this.lootItem = null; }
    }
    const st = this.state;
    // Weapon management: swap away from empty weapons; without any ammo, go find loot instead of fighting.
    const best = b.inv.bestSlot();
    const armed = best >= 0;
    if (armed && b.ammoTotal() === 0 && best !== b.inv.current) I.slot = best;
    if (!armed && (this.state === S.ATTACK || this.state === S.COVER || this.state === S.FLANK || this.state === S.CHASE)) this.setState(S.PATROL);
    const fleeingZone = !armed || zi.outsideCur && !(this.target && this.target.ctrl.pos.distanceTo(b.ctrl.pos) < 14);
    if (this.visible && !fleeingZone && (st === S.PATROL || st === S.ALERT || st === S.SEARCH || st === S.CHASE)) this.setState(S.ATTACK);
    // Running to the zone: still return fire on the move.
    if (fleeingZone && this.visible && this.reactionT <= 0 && this.aimAligned && b.inv.weapon) {
      I.fire = true;
      this.semiT = (this.semiT || 0) - dt;
      if (this.semiT <= 0) { I.firePressed = true; this.semiT = rand(0.25, 0.5); }
    }
    if (fleeingZone && this.visible) this.reactionT -= dt;

    switch (this.state) {
      case S.PATROL: this.patrol(dt, zi); break;
      case S.ALERT: this.alert(dt); break;
      case S.SEARCH: this.search(dt, zi); break;
      case S.ATTACK: this.attack(dt, zi); break;
      case S.COVER: this.takeCover(dt, zi); break;
      case S.FLANK: this.flank(dt, zi); break;
      case S.RETREAT: this.retreat(dt, zi); break;
      case S.CHASE: this.chase(dt, zi); break;
    }
    I.crouch = this.wantCrouch;
    this.updateAim(dt);
    // opportunistic loot pickup
    g.loot.botAutoPickup(b);
    // heal when safe
    this.healCD -= dt;
    if (!this.visible && b.health.hp < 70 && b.inv.medkits > 0 && this.healCD <= 0 && g.time - this.hitRecent > 3 && !zi.outsideCur) {
      I.heal = true; this.healCD = 6;
    }
    if (b.healing) { I.mx *= 0.3; I.mz *= 0.3; I.sprint = false; }
    // reload when idle
    const w = b.inv.weapon;
    if (w && !this.visible && w.mag < magSize(w) * 0.5 && b.inv.ammo[WEAPONS[w.id].ammo] > 0) I.reload = true;
  }

  patrol(dt, zi) {
    const b = this.bot;
    if (this.game.time - this.noiseT < 3) { this.setState(S.ALERT); return; }
    const z = this.game.zone;
    const goalBad = zi.urgent && Math.hypot(this.goal.x - z.next.x, this.goal.z - z.next.y) > z.nextRadius * 0.8;
    if (!this.path || this.pathI >= (this.path?.length || 0) || this.stateT > 25 || (goalBad && this.repathT <= 0)) {
      let x, z;
      this.lootItem = null;
      if (zi.urgent) ({ x, z } = this.zonePoint());
      else {
        const it = this.findLoot();
        if (it && chance(0.85)) { this.lootItem = it; it.claimedBy = b; x = it.x; z = it.z; }
        else if (zi.outsideNext && chance(0.6)) ({ x, z } = this.zonePoint());
        else {
          const nav = this.game.world.nav;
          const zz = this.game.zone;
          const pts = this.game.world.patrolPoints.filter((q) => Math.hypot(q.x - zz.next.x, q.z - zz.next.z) < zz.nextRadius + 10);
          const q = pts.length && chance(0.6) ? pts[Math.floor(Math.random() * pts.length)] : null;
          const tgt = q ? nav.randomWalkableNear(q.x, q.z, 6) : nav.randomWalkableNear(b.ctrl.pos.x, b.ctrl.pos.z, 35);
          if (!tgt) return;
          x = tgt.x; z = tgt.z;
        }
      }
      this.stateT = 0;
      if (!this.requestPath(x, z)) return;
    }
    this.repathT -= dt;
    const dir = this.followPath(dt);
    if (dir) this.move(dir.x, dir.z, zi.urgent ? 'sprint' : 'run');
    else if (zi.urgent) {
      // No usable path yet: head straight for the safe zone.
      const p = b.ctrl.pos, zc = this.game.zone.next;
      this.move(zc.x - p.x, zc.y - p.z, 'sprint');
      if (this.repathT <= 0) this.path = null;
    }
    else this.stop();
    this.faceMove(dt);
  }

  alert(dt) {
    this.stop();
    const p = this.bot.ctrl.pos;
    this.lookYaw = Math.atan2(this.noisePos.x - p.x, this.noisePos.z - p.z);
    this.wantCrouch = this.skill > 0.5;
    if (this.stateT > lerp(1.6, 0.6, this.aggression)) {
      this.lastSeen.copy(this.noisePos);
      this.setState(S.SEARCH);
    }
  }

  search(dt, zi) {
    if (zi.urgent && this.stateT > 1) { this.setState(S.PATROL); return; }
    const res = this.moveTo(dt, this.lastSeen.x, this.lastSeen.z, 'run');
    if (res === 'arrived' || this.stateT > 14) {
      this.stop();
      this.scanT += dt;
      this.lookYaw += Math.sin(this.scanT * 1.5) * dt * 1.6;
      if (this.stateT > 18 || res === 'arrived' && this.scanT > 3) { this.scanT = 0; this.setState(S.PATROL); }
    } else this.faceMove(dt, true);
  }

  attack(dt, zi) {
    const b = this.bot, g = this.game, I = b.intent;
    const t = this.target;
    if (!t) { this.setState(S.SEARCH); return; }
    const p = b.ctrl.pos;
    const d = p.distanceTo(t.ctrl.pos);
    if (!this.visible) {
      const lost = g.time - this.lastSeenT;
      if (lost > 0.8) {
        if (b.inv.grenades > 0 && this.grenadeCD <= 0 && d > 7 && d < 32 && chance(0.5)) this.throwGrenadeAt(this.lastSeen);
        if (this.aggression > 0.6 && chance(0.5)) this.setState(S.FLANK);
        else if (this.aggression > 0.35) this.setState(S.CHASE);
        else this.setState(S.COVER);
        return;
      }
    }
    if (d > this.engageRange() * 1.5 && g.time - this.hitRecent > 4) { this.target = null; this.visible = false; this.setState(S.PATROL); return; }
    // weapon preference & distance keeping
    const def = b.inv.def;
    const pref = def ? (def.botPref === 'close' ? 9 : def.botPref === 'far' ? 55 : 24) : 15;
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeT = rand(0.5, 1.6); this.strafe = chance(0.5) ? 1 : -1; if (chance(0.2)) this.strafe = 0; }
    const dx = t.ctrl.pos.x - p.x, dz = t.ctrl.pos.z - p.z;
    const l = Math.hypot(dx, dz) || 1;
    let mx = (-dz / l) * this.strafe, mz = (dx / l) * this.strafe;
    if (d > pref * 1.5 && zi.urgent === false) { mx += (dx / l) * 1.2; mz += (dz / l) * 1.2; }
    else if (d < pref * 0.5) { mx -= (dx / l); mz -= (dz / l); }
    if (zi.outsideCur) { const zp = g.zone.next; mx += (zp.x - p.x) * 0.05; mz += (zp.z - p.z) * 0.05; }
    // check that strafing won't walk into walls
    const nav = g.world.nav;
    if (!nav.walkable(p.x + mx * 1.2, p.z + mz * 1.2)) { this.strafe = -this.strafe; mx = -mx; mz = -mz; }
    const stationary = def && (def.botPref === 'far' || (def.botPref === 'mid' && d > 30)) && this.skill > 0.4;
    if (stationary && this.stateT % 4 < 2.5) { mx *= 0.15; mz *= 0.15; this.wantCrouch = d > 25; }
    else this.wantCrouch = false;
    if (Math.hypot(mx, mz) > 0.05) this.move(mx, mz, 'run'); else this.stop();

    // shooting
    this.reactionT -= dt;
    I.aiming = d > 12;
    const canShoot = this.visible && this.reactionT <= 0 && this.aimAligned;
    if (canShoot && b.inv.weapon) {
      if (this.burstPause > 0) this.burstPause -= dt;
      else {
        const auto = def.auto;
        I.fire = true;
        if (!auto) {
          this.semiT = (this.semiT || 0) - dt;
          if (this.semiT <= 0) { I.firePressed = true; this.semiT = 60 / def.rpm + rand(0.08, 0.35) * (def.id === 'sniper' ? 2 : 1); }
        } else I.firePressed = this.burst === 0;
        this.burst += dt;
        const burstLen = def.id === 'smg' ? rand(0.4, 0.9) : rand(0.25, 0.6);
        if (auto && this.burst > burstLen * (d > 30 ? 0.6 : 1)) {
          this.burst = 0;
          this.burstPause = rand(0.25, 0.7) * (d > 40 ? 1.5 : 1);
          this.aimHead = chance(this.headChance);
        }
      }
    }
    // tactical decisions
    const hp = b.health.hp;
    if (hp < 30 && g.time - this.hitRecent < 2) { this.setState(b.inv.medkits > 0 ? S.RETREAT : S.COVER); return; }
    const w = b.inv.weapon;
    if (w && w.mag === 0 && d < 40 && chance(0.6) && this.stateT > 0.5) { this.setState(S.COVER); return; }
    if (this.stateT > 6 && chance(dt * 0.15 * this.aggression)) this.setState(S.FLANK);
    if (this.stateT > 2 && d > 70 && def && def.botPref !== 'far' && chance(dt * 0.4)) this.setState(S.CHASE);
    this.grenadeCD -= dt;
  }

  throwGrenadeAt(pos) {
    const b = this.bot;
    if (b.inv.grenades <= 0) return;
    b.inv.grenades--;
    this.grenadeCD = rand(10, 18);
    const o = b.shotOrigin(new THREE.Vector3());
    o.y += 0.2;
    const dx = pos.x - o.x, dz = pos.z - o.z, dy = pos.y - o.y;
    const dist = Math.hypot(dx, dz);
    const ang = 38 * DEG;
    const gr = 18;
    const denom = 2 * Math.cos(ang) ** 2 * (dist * Math.tan(ang) - dy);
    let v = denom > 0 ? Math.sqrt((gr * dist * dist) / denom) : 14;
    v = clamp(v * rand(0.9, 1.08), 5, 22);
    const vel = new THREE.Vector3((dx / dist) * Math.cos(ang) * v, Math.sin(ang) * v, (dz / dist) * Math.cos(ang) * v);
    this.game.projectiles.throwGrenade(b, o, vel);
    b.model.fire(1);
  }

  pickCover(threat) {
    const W = this.game.world;
    const p = this.bot.ctrl.pos;
    const cands = W.coverNear(p.x, p.z, 24);
    const scored = [];
    for (const c of cands) {
      if (c.claimed && c.claimed !== this.bot && c.claimed.alive) continue;
      const tx = threat.x - c.x, tz = threat.z - c.z;
      const tl = Math.hypot(tx, tz) || 1;
      if ((c.nx * tx + c.nz * tz) / tl > -0.25) continue; // obstacle must be between point and threat
      const dSelf = Math.hypot(c.x - p.x, c.z - p.z);
      const s = dSelf + Math.abs(tl - 18) * 0.25 + (c.high ? 0 : 1.5);
      scored.push({ c, s });
    }
    scored.sort((a, b2) => a.s - b2.s);
    const col = W.collision;
    const ty = threat.y + 1.5;
    for (let i = 0; i < Math.min(6, scored.length); i++) {
      const c = scored[i].c;
      const gy = W.terrain.height(c.x, c.z) + 0.95;
      if (!col.clear(threat.x, ty, threat.z, c.x, gy, c.z)) return c;
    }
    return null;
  }

  takeCover(dt, zi) {
    const b = this.bot, I = b.intent;
    const threat = this.target ? this.lastSeen : b.lastHitBy ? b.lastHitBy.ctrl.pos : null;
    if (!threat) { this.setState(S.PATROL); return; }
    if (!this.cover) {
      if (this.stateT > 0.05) { this.setState(this.visible ? S.ATTACK : S.SEARCH); return; }
      this.cover = this.pickCover(threat);
      if (!this.cover) { this.setState(b.health.hp < 40 ? S.RETREAT : S.ATTACK); return; }
      this.cover.claimed = b;
      this.coverReached = false;
    }
    if (!this.coverReached) {
      const res = this.moveTo(dt, this.cover.x, this.cover.z, 'sprint');
      this.faceMove(dt, this.visible);
      if (res === 'arrived') { this.coverReached = true; this.stateT = 0; this.holdT = rand(1.2, 3.2) * (1.2 - this.aggression * 0.6); }
      if (this.stateT > 6 || (res === 'wait' && this.stateT > 2)) { this.setState(this.visible ? S.ATTACK : S.SEARCH); return; }
      // shoot while running if target is visible
      if (this.visible && this.reactionT <= 0 && this.aimAligned && chance(0.5)) { I.fire = true; I.firePressed = chance(0.3); }
      return;
    }
    this.stop();
    this.wantCrouch = true;
    const p = b.ctrl.pos;
    this.lookYaw = Math.atan2(threat.x - p.x, threat.z - p.z);
    const w = b.inv.weapon;
    if (w && w.mag < magSize(w)) I.reload = true;
    if (b.health.hp < 75 && b.inv.medkits > 0 && !b.healing) I.heal = true;
    if (b.healing) { this.holdT = Math.max(this.holdT, 0.5); return; }
    if (zi.outsideCur) { this.setState(S.PATROL); return; }
    if (this.stateT > this.holdT && !b.weapons.reloading) {
      // peek: stand up / step out and fight
      this.setState(this.target && this.target.alive ? S.ATTACK : S.SEARCH);
      this.reactionT = Math.min(this.reactionT, 0.15);
    }
  }

  flank(dt, zi) {
    const b = this.bot;
    const t = this.target;
    if (!t || zi.urgent && zi.outsideCur) { this.setState(S.PATROL); return; }
    if (!this.flankPt) {
      const p = b.ctrl.pos;
      const base = Math.atan2(p.x - this.lastSeen.x, p.z - this.lastSeen.z);
      const dist = clamp(p.distanceTo(this.lastSeen), 10, 25);
      const ang = base + this.flankSide * rand(60, 85) * DEG;
      const fx = this.lastSeen.x + Math.sin(ang) * dist, fz = this.lastSeen.z + Math.cos(ang) * dist;
      this.flankPt = this.game.world.nav.randomWalkableNear(fx, fz, 5);
      this.flankSide = -this.flankSide;
      if (!this.flankPt) { this.setState(S.CHASE); return; }
    }
    const res = this.moveTo(dt, this.flankPt.x, this.flankPt.z, 'sprint');
    this.faceMove(dt, true);
    if (this.visible && this.stateT > 0.8) { this.flankPt = null; this.setState(S.ATTACK); return; }
    if (res === 'arrived' || this.stateT > 11) { this.flankPt = null; this.setState(this.visible ? S.ATTACK : S.SEARCH); }
  }

  retreat(dt, zi) {
    const b = this.bot, I = b.intent;
    const threat = this.target ? this.lastSeen : b.lastHitBy ? b.lastHitBy.ctrl.pos : null;
    const p = b.ctrl.pos;
    if (!this.retreatPt) {
      let ax = 0, az = 0;
      if (threat) { ax = p.x - threat.x; az = p.z - threat.z; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l; }
      const zc = this.game.zone.next;
      ax += (zc.x - p.x) * 0.01; az += (zc.z - p.z) * 0.01;
      const pt = this.game.world.nav.randomWalkableNear(p.x + ax * 22, p.z + az * 22, 8);
      this.retreatPt = pt || { x: p.x, z: p.z };
      if (threat) {
        const c = this.pickCover(threat);
        if (c && Math.hypot(c.x - p.x, c.z - p.z) < 18) { this.retreatPt = { x: c.x, z: c.z }; }
      }
    }
    const res = this.moveTo(dt, this.retreatPt.x, this.retreatPt.z, 'sprint');
    this.faceMove(dt, false);
    if (res === 'arrived' || this.stateT > 7) {
      this.stop();
      this.wantCrouch = true;
      if (b.inv.medkits > 0 && b.health.hp < 80) I.heal = true;
      if (!b.healing && this.stateT > 2) { this.retreatPt = null; this.setState(this.visible ? S.ATTACK : S.SEARCH); }
    }
  }

  chase(dt, zi) {
    if (zi.urgent && zi.outsideCur) { this.setState(S.PATROL); return; }
    const res = this.moveTo(dt, this.lastSeen.x, this.lastSeen.z, this.aggression > 0.6 ? 'sprint' : 'run');
    this.faceMove(dt, true);
    if (res === 'arrived' || this.stateT > 9) this.setState(S.SEARCH);
  }

  faceMove(dt, towardsLastSeen = false) {
    const b = this.bot, I = b.intent;
    if (towardsLastSeen) {
      const p = b.ctrl.pos;
      this.lookYaw = Math.atan2(this.lastSeen.x - p.x, this.lastSeen.z - p.z);
    } else if (Math.abs(I.mx) + Math.abs(I.mz) > 0.1) {
      this.lookYaw = Math.atan2(I.mx, I.mz) + Math.sin(this.game.time * 0.7 + this.bot.id) * 0.35;
    }
  }

  updateAim(dt) {
    const b = this.bot, I = b.intent;
    const t = this.target;
    let wantYaw = this.lookYaw, wantPitch = 0;
    this.aimAligned = false;
    if (t && this.visible) {
      // aim point with human-like error that tightens while tracking
      const focus = Math.exp(-this.focusRate * dt);
      this.aimErr = this.baseErr + (this.aimErr - this.baseErr) * focus;
      const tp = this.aimHead ? t.headWorld(_a) : t.chestWorld(_a);
      const shooter = b.shotOrigin(_b);
      const dist = shooter.distanceTo(tp);
      const tv = t.ctrl.vel;
      const tSpeed = Math.hypot(tv.x, tv.z);
      const selfMove = Math.hypot(b.ctrl.vel.x, b.ctrl.vel.z);
      let err = this.aimErr + tSpeed * 0.45 * DEG + selfMove * 0.3 * DEG;
      if (t.ctrl.crouching) err *= 1.15;
      if (t.isPlayer && !t.ctrl.onGround) err += 1.5 * DEG;
      // lead imperfectly
      const lead = (dist / 300) * lerp(0.2, 0.8, this.skill);
      tp.x += tv.x * lead; tp.z += tv.z * lead;
      this.jitterT = (this.jitterT || 0) - dt;
      if (this.jitterT <= 0) {
        this.jitterT = rand(0.08, 0.2);
        const r = Math.tan(err) * dist;
        this.aimOff.set(rand(-1, 1), rand(-0.6, 0.6), rand(-1, 1)).normalize().multiplyScalar(r * Math.sqrt(Math.random()) * 1.2);
      }
      I.aimPoint.copy(tp).add(this.aimOff);
      wantYaw = Math.atan2(tp.x - shooter.x, tp.z - shooter.z);
      wantPitch = Math.atan2(tp.y - shooter.y, Math.hypot(tp.x - shooter.x, tp.z - shooter.z));
      this.lookYaw = wantYaw;
    } else {
      b.forward(_v);
      b.shotOrigin(I.aimPoint).addScaledVector(_v, 30);
    }
    b.yaw = dampAngle(b.yaw, wantYaw, this.turnRate, dt);
    b.pitch = b.pitch + (wantPitch - b.pitch) * (1 - Math.exp(-this.turnRate * dt));
    if (t && this.visible) {
      const dy = Math.abs(wrapAngle(wantYaw - b.yaw));
      this.aimAligned = dy < 0.09 + (t.ctrl.pos.distanceTo(b.ctrl.pos) < 6 ? 0.2 : 0);
    }
  }
}
