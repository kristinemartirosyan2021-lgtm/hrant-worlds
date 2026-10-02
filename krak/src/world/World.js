// World: owns terrain, static geometry, collisions, nav grid, cover/loot/spawn points.
import * as THREE from 'three';
import { Terrain } from './Terrain.js';
import { Collision } from './Collision.js';
import { Batcher } from './Batcher.js';
import { createMaterials } from './Materials.js';
import { buildMap } from './MapLayout.js';
import { Vegetation } from './Vegetation.js';
import { NavGrid } from './NavGrid.js';
import { Sky } from './Sky.js';
import { mulberry32 } from '../core/util.js';
import { MAP } from '../config.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export class World {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.group = new THREE.Group();
    this.group.name = 'world';
    this.scene.add(this.group);
    this.rng = mulberry32(20260930);
    this.lootSpots = [];
    this.spawnPoints = [];
    this.coverPoints = [];
    this.patrolPoints = [];
    this.signs = [];
    this.lightPoints = [];
  }

  async build(progress = () => {}) {
    const tick = async (p, label) => { progress(p, label); await new Promise((r) => setTimeout(r, 0)); };
    await tick(0.05, 'terrain');
    this.terrain = new Terrain();
    this.collision = new Collision(this.terrain);
    this.terrainMesh = this.terrain.buildMesh();
    this.group.add(this.terrainMesh);
    this.M = createMaterials();
    this.batch = new Batcher();
    await tick(0.2, 'sky');
    this.sky = new Sky(this.game);
    await tick(0.3, 'map');
    buildMap(this);
    await tick(0.55, 'vegetation');
    this.vegetation = new Vegetation(this);
    this.vegetation.build();
    await tick(0.7, 'batch');
    this.batch.build(this.group);
    this.boundaryWalls();
    await tick(0.8, 'nav');
    this.nav = new NavGrid(this);
    this.nav.build();
    this.buildCoverPoints();
    this.lootSpots = this.lootSpots.filter((s) => s.y > 0.5 || this.nav.walkable(s.x, s.z));
    this.spawnPoints = this.spawnPoints.filter((s) => this.nav.walkable(s.x, s.z));
    await tick(0.95, 'done');
  }

  // ---------------------------------------------------------------- helpers
  tint() { return 0.86 + this.rng() * 0.2; }

  solid(mat, x0, y0, z0, x1, y1, z1, o = {}) {
    const M = this.M;
    this.batch.box(o.key || mat, M[mat], Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1),
      Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), o.uv || M.uv[mat] || 2, o.tint ?? this.tint());
    if (o.collide === false) return null;
    return this.collision.add(x0, y0, z0, x1, y1, z1, o.impact || M.impact[mat] || 'stone', o);
  }

  deco(mat, x0, y0, z0, x1, y1, z1, o = {}) {
    return this.solid(mat, x0, y0, z0, x1, y1, z1, { ...o, collide: false });
  }

  mesh(mat, geo, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, tint) {
    _q.setFromAxisAngle(_p.set(0, 1, 0), ry);
    _m.compose(_s.set(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
    this.batch.geometry(mat, this.M[mat], geo, _m, tint ?? this.tint());
  }

  meshM(mat, geo, matrix, tint) {
    this.batch.geometry(mat, this.M[mat], geo, matrix, tint ?? this.tint());
  }

  h(x, z) { return this.terrain.height(x, z); }

  // Wall along X (constant z). Openings: {a,b,lo,hi} in absolute coordinates.
  wallX(mat, x0, x1, z, y0, y1, t, openings = [], trim = true) {
    const ops = openings.filter((o) => o.b > x0 && o.a < x1).sort((p, q) => p.a - q.a);
    let cur = x0;
    const z0 = z - t / 2, z1 = z + t / 2;
    for (const o of ops) {
      if (o.a > cur) this.solid(mat, cur, y0, z0, o.a, y1, z1);
      if (o.lo > y0) this.solid(mat, o.a, y0, z0, o.b, o.lo, z1);
      if (o.hi < y1) this.solid(mat, o.a, o.hi, z0, o.b, y1, z1);
      if (trim) this.openingTrimX(o, z, t);
      cur = Math.max(cur, o.b);
    }
    if (cur < x1) this.solid(mat, cur, y0, z0, x1, y1, z1);
  }

  wallZ(mat, z0, z1, x, y0, y1, t, openings = [], trim = true) {
    const ops = openings.filter((o) => o.b > z0 && o.a < z1).sort((p, q) => p.a - q.a);
    let cur = z0;
    const x0 = x - t / 2, x1 = x + t / 2;
    for (const o of ops) {
      if (o.a > cur) this.solid(mat, x0, y0, cur, x1, y1, o.a);
      if (o.lo > y0) this.solid(mat, x0, y0, o.a, x1, o.lo, o.b);
      if (o.hi < y1) this.solid(mat, x0, o.hi, o.a, x1, y1, o.b);
      if (trim) this.openingTrimZ(o, x, t);
      cur = Math.max(cur, o.b);
    }
    if (cur < z1) this.solid(mat, x0, y0, cur, x1, y1, z1);
  }

  openingTrimX(o, z, t) {
    const e = t / 2 + 0.06;
    if (o.lo > 0.3) this.deco('trim', o.a - 0.08, o.lo - 0.08, z - e, o.b + 0.08, o.lo, z + e);
    this.deco('trim', o.a - 0.08, o.hi, z - e, o.b + 0.08, o.hi + 0.12, z + e);
  }
  openingTrimZ(o, x, t) {
    const e = t / 2 + 0.06;
    if (o.lo > 0.3) this.deco('trim', x - e, o.lo - 0.08, o.a - 0.08, x + e, o.lo, o.b + 0.08);
    this.deco('trim', x - e, o.hi, o.a - 0.08, x + e, o.hi + 0.12, o.b + 0.08);
  }

  // Slab with rectangular holes (holes: [x0,z0,x1,z1]).
  slab(mat, x0, z0, x1, z1, y0, y1, holes = []) {
    if (!holes.length) { this.solid(mat, x0, y0, z0, x1, y1, z1); return; }
    const [hx0, hz0, hx1, hz1] = holes[0];
    const rest = holes.slice(1);
    if (hz0 > z0) this.slab(mat, x0, z0, x1, hz0, y0, y1, rest);
    if (hz1 < z1) this.slab(mat, x0, hz1, x1, z1, y0, y1, rest);
    if (hx0 > x0) this.slab(mat, x0, hz0, hx0, hz1, y0, y1, rest);
    if (hx1 < x1) this.slab(mat, hx1, hz0, x1, hz1, y0, y1, rest);
  }

  // Straight solid stairs rising along +x (dir=1) or -x (dir=-1).
  stairs(mat, xStart, zA, zB, yBase, rise, dir, steps = 10, run = 0.42) {
    const per = rise / steps;
    for (let i = 0; i < steps; i++) {
      const xa = xStart + dir * i * run, xb = xStart + dir * (i + 1) * run;
      this.solid(mat, Math.min(xa, xb), yBase, zA, Math.max(xa, xb), yBase + per * (i + 1), zB, { cover: false });
    }
    return xStart + dir * steps * run;
  }

  // Stairs rising along +z / -z.
  stairsZ(mat, zStart, xA, xB, yBase, rise, dir, steps = 10, run = 0.42) {
    const per = rise / steps;
    for (let i = 0; i < steps; i++) {
      const za = zStart + dir * i * run, zb = zStart + dir * (i + 1) * run;
      this.solid(mat, xA, yBase, Math.min(za, zb), xB, yBase + per * (i + 1), Math.max(za, zb), { cover: false });
    }
    return zStart + dir * steps * run;
  }

  // ---------------------------------------------------------------- building
  building(o) {
    const {
      x, z, w, d, floors = 2, mat = 'tuff', fh = 3.3, doors = [{ side: 's', off: 0 }],
      roofAccess = true, parapet = true, floorMat = 'woodDark', tier = 1, interior = true,
      winSpacing = 3.4, balcony = null, cornice = true,
    } = o;
    const t = 0.3;
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const top = floors * fh;
    const wallTop = top + (parapet ? 1.05 : 0.15);
    const sides = { n: [], s: [], e: [], w: [] };
    for (const dr of doors) {
      const dw = dr.w || 1.8;
      const along = dr.side === 'n' || dr.side === 's' ? x + (dr.off || 0) : z + (dr.off || 0);
      sides[dr.side].push({ a: along - dw / 2, b: along + dw / 2, lo: -0.5, hi: 2.45, door: true, floor: dr.floor || 0 });
      if (dr.floor) sides[dr.side][sides[dr.side].length - 1].lo = dr.floor * fh;
    }
    const addWindows = (side, from, to) => {
      const len = to - from;
      const n = Math.max(1, Math.floor((len - 1.2) / winSpacing));
      const gap = len / n;
      for (let f = 0; f < floors; f++) {
        for (let i = 0; i < n; i++) {
          const c = from + gap * (i + 0.5);
          const lo = f * fh + 1.0, hi = f * fh + 2.25;
          if (sides[side].some((op) => op.door && op.floor === f && Math.abs((op.a + op.b) / 2 - c) < 1.6)) continue;
          if (this.rng() < 0.12 && f === 0) continue;
          sides[side].push({ a: c - 0.62, b: c + 0.62, lo, hi });
        }
      }
    };
    addWindows('n', x0 + 0.6, x1 - 0.6); addWindows('s', x0 + 0.6, x1 - 0.6);
    addWindows('e', z0 + 0.6, z1 - 0.6); addWindows('w', z0 + 0.6, z1 - 0.6);
    // Stairs layout (alternating north / south walls).
    const flights = [];
    const nFlights = roofAccess ? floors : floors - 1;
    for (let f = 0; f < nFlights; f++) {
      const north = f % 2 === 0;
      const zs0 = north ? z0 + t / 2 : z1 - t / 2 - 1.3;
      const zs1 = zs0 + 1.3;
      const xs = north ? x0 + t / 2 + 1.0 : x1 - t / 2 - 1.0;
      const dir = north ? 1 : -1;
      flights.push({ f, zs0, zs1, xs, dir, xe: xs + dir * 4.2 });
    }
    // Keep windows out of the stairwells to avoid odd openings behind steps.
    for (const fl of flights) {
      const side = fl.zs0 < z ? 'n' : 's';
      const lo = Math.min(fl.xs, fl.xe), hi = Math.max(fl.xs, fl.xe);
      sides[side] = sides[side].filter((op) => op.door || !(op.b > lo && op.a < hi && op.lo < (fl.f + 1) * fh + 0.5 && op.hi > fl.f * fh));
    }
    // Walls.
    this.wallX(mat, x0, x1, z0, -0.4, wallTop, t, sides.n);
    this.wallX(mat, x0, x1, z1, -0.4, wallTop, t, sides.s);
    this.wallZ(mat, z0 + t / 2, z1 - t / 2, x0, -0.4, wallTop, t, sides.w);
    this.wallZ(mat, z0 + t / 2, z1 - t / 2, x1, -0.4, wallTop, t, sides.e);
    // Base plinth (dark basalt) and cornice band for an Armenian look.
    this.deco('basalt', x0 - 0.08, -0.4, z0 - 0.08, x1 + 0.08, 0.55, z0 + 0.02);
    this.deco('basalt', x0 - 0.08, -0.4, z1 - 0.02, x1 + 0.08, 0.55, z1 + 0.08);
    this.deco('basalt', x0 - 0.08, -0.4, z0, x0 + 0.02, 0.55, z1);
    this.deco('basalt', x1 - 0.02, -0.4, z0, x1 + 0.08, 0.55, z1);
    if (cornice) {
      this.deco('basalt', x0 - 0.18, top - 0.1, z0 - 0.18, x1 + 0.18, top + 0.12, z0);
      this.deco('basalt', x0 - 0.18, top - 0.1, z1, x1 + 0.18, top + 0.12, z1 + 0.18);
      this.deco('basalt', x0 - 0.18, top - 0.1, z0, x0, top + 0.12, z1);
      this.deco('basalt', x1, top - 0.1, z0, x1 + 0.18, top + 0.12, z1);
    }
    // Floors & roof.
    const ix0 = x0 + t / 2, ix1 = x1 - t / 2, iz0 = z0 + t / 2, iz1 = z1 - t / 2;
    this.solid(floorMat, ix0, -0.2, iz0, ix1, 0.08, iz1, { cover: false });
    for (let f = 1; f <= floors; f++) {
      const holes = flights.filter((fl) => fl.f === f - 1).map((fl) => [Math.min(fl.xs, fl.xe) - 0.05, fl.zs0, Math.max(fl.xs, fl.xe) + 0.05, fl.zs1]);
      const isRoof = f === floors;
      this.slab(isRoof ? 'concreteNP' : floorMat, ix0, iz0, ix1, iz1, f * fh - 0.28, f * fh, holes);
      // Railings around stairwell openings.
      for (const fl of flights.filter((q) => q.f === f - 1)) {
        const inner = fl.zs0 < z ? fl.zs1 : fl.zs0;
        const lo = Math.min(fl.xs, fl.xe), hi = Math.max(fl.xs, fl.xe);
        this.solid('darkMetal', lo, f * fh, inner - 0.04, hi, f * fh + 1.0, inner + 0.04, { noBullet: true, cover: false });
        const startX = fl.dir > 0 ? lo : hi;
        this.solid('darkMetal', startX - 0.04, f * fh, Math.min(fl.zs0, fl.zs1), startX + 0.04, f * fh + 1.0, Math.max(fl.zs0, fl.zs1), { noBullet: true, cover: false });
      }
    }
    for (const fl of flights) this.stairs('concrete', fl.xs, fl.zs0 + 0.02, fl.zs1 - 0.02, fl.f * fh, fh, fl.dir);
    // Ceiling lamps (emissive look) and interior detail.
    if (interior) {
      for (let f = 0; f < floors; f++) {
        const fy = f * fh + 0.08;
        const free = { x0: ix0 + 0.6, x1: ix1 - 0.6, z0: iz0 + 1.8, z1: iz1 - 1.8 };
        if (free.z1 - free.z0 < 1) continue;
        this.furnish(free, fy, f);
        // loot spots
        const nLoot = w * d > 140 ? 3 : 2;
        for (let i = 0; i < nLoot; i++) {
          this.lootSpots.push({
            x: free.x0 + 0.5 + this.rng() * Math.max(0.1, free.x1 - free.x0 - 1),
            y: fy, z: free.z0 + 0.3 + this.rng() * Math.max(0.1, free.z1 - free.z0 - 0.6), tier,
          });
        }
        this.patrolPoints.push({ x, z, y: fy });
      }
      if (roofAccess) this.lootSpots.push({ x: x + (this.rng() - 0.5) * (w - 3), y: top, z: z + (this.rng() - 0.5) * 2, tier: tier + 0.3 });
      // Roof clutter for cover.
      if (roofAccess) {
        this.solid('metalW', x + w * 0.2, top, z - 0.6, x + w * 0.2 + 1.1, top + 1.0, z + 0.6);
        this.deco('darkMetal', x - w * 0.25, top, z + 0.8, x - w * 0.25 + 0.15, top + 1.6, z + 0.95);
      }
    }
    if (balcony) this.balcony(balcony, x0, x1, z0, z1, fh);
    // Remember interior bounds (used by AI & audio occlusion heuristics).
    return { x0, x1, z0, z1, top };
  }

  balcony(side, x0, x1, z0, z1, fh) {
    const y = fh;
    const cx = (x0 + x1) / 2;
    if (side === 's') {
      this.solid('concrete', cx - 2.5, y - 0.2, z1, cx + 2.5, y, z1 + 1.3, { cover: false });
      this.solid('darkMetal', cx - 2.5, y, z1 + 1.25, cx + 2.5, y + 1.0, z1 + 1.32, { noBullet: true });
      this.solid('darkMetal', cx - 2.55, y, z1, cx - 2.48, y + 1.0, z1 + 1.32, { noBullet: true });
      this.solid('darkMetal', cx + 2.48, y, z1, cx + 2.55, y + 1.0, z1 + 1.32, { noBullet: true });
    } else {
      this.solid('concrete', cx - 2.5, y - 0.2, z0 - 1.3, cx + 2.5, y, z0, { cover: false });
      this.solid('darkMetal', cx - 2.5, y, z0 - 1.32, cx + 2.5, y + 1.0, z0 - 1.25, { noBullet: true });
    }
  }

  furnish(r, y, seed) {
    const rr = this.rng;
    const items = 2 + Math.floor(rr() * 2);
    for (let i = 0; i < items; i++) {
      const kind = rr();
      const px = r.x0 + rr() * (r.x1 - r.x0), pz = r.z0 + rr() * (r.z1 - r.z0);
      if (kind < 0.35) {
        // table
        this.solid('wood', px - 0.7, y + 0.72, pz - 0.45, px + 0.7, y + 0.78, pz + 0.45, { cover: false });
        for (const [a, b] of [[-0.62, -0.38], [0.62, -0.38], [-0.62, 0.38], [0.62, 0.38]]) {
          this.deco('woodDark', px + a - 0.04, y, pz + b - 0.04, px + a + 0.04, y + 0.72, pz + b + 0.04);
        }
      } else if (kind < 0.6) {
        // crate stack
        this.solid('wood', px - 0.5, y, pz - 0.5, px + 0.5, y + 1.0, pz + 0.5);
        if (rr() < 0.5) this.solid('wood', px - 0.35, y + 1.0, pz - 0.35, px + 0.35, y + 1.6, pz + 0.35);
      } else if (kind < 0.8) {
        // sofa / bed
        this.solid('cGrey', px - 1.0, y, pz - 0.45, px + 1.0, y + 0.5, pz + 0.45, { uv: 1 });
        this.solid('cGrey', px - 1.0, y + 0.5, pz + 0.25, px + 1.0, y + 0.95, pz + 0.45, { uv: 1 });
      } else {
        // shelf
        this.solid('woodDark', px - 0.9, y, pz - 0.2, px + 0.9, y + 1.9, pz + 0.2);
      }
    }
  }

  // Simple solid house (not enterable) with windows, door and pitched tin roof.
  house(x, z, w, d, h, mat = 'plaster', roofRot = 0) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    this.solid(mat, x0, -0.4, z0, x1, h, z1);
    this.deco('basalt', x0 - 0.06, -0.4, z0 - 0.06, x1 + 0.06, 0.5, z1 + 0.06);
    const floors = Math.max(1, Math.round(h / 3));
    const winX = Math.max(1, Math.floor(w / 3)), winZ = Math.max(1, Math.floor(d / 3));
    for (let f = 0; f < floors; f++) {
      const y0 = f * 3 + 1.0, y1 = y0 + 1.2;
      for (let i = 0; i < winX; i++) {
        const cx = x0 + (w / winX) * (i + 0.5);
        for (const zz of [z0 - 0.04, z1 + 0.04]) {
          if (f === 0 && i === Math.floor(winX / 2) && zz > z) {
            this.deco('woodDark', cx - 0.55, 0, zz - 0.03, cx + 0.55, 2.2, zz + 0.03);
            continue;
          }
          this.deco('pane', cx - 0.5, y0, zz - 0.02, cx + 0.5, y1, zz + 0.02);
          this.deco('trim', cx - 0.6, y0 - 0.1, zz - 0.06, cx + 0.6, y0, zz + 0.06);
          this.deco('trim', cx - 0.6, y1, zz - 0.05, cx + 0.6, y1 + 0.1, zz + 0.05);
        }
      }
      for (let i = 0; i < winZ; i++) {
        const cz = z0 + (d / winZ) * (i + 0.5);
        for (const xx of [x0 - 0.04, x1 + 0.04]) {
          this.deco('pane', xx - 0.02, y0, cz - 0.5, xx + 0.02, y1, cz + 0.5);
          this.deco('trim', xx - 0.06, y0 - 0.1, cz - 0.6, xx + 0.06, y0, cz + 0.6);
        }
      }
    }
    this.gableRoof(x, z, w + 0.6, d + 0.6, h, Math.min(w, d) * 0.32, roofRot);
  }

  gableRoof(x, z, w, d, y, rh, rot = 0) {
    // Ridge along X when rot=0, along Z when rot=1.
    const L = rot ? d : w, W = rot ? w : d;
    const hl = L / 2, hw = W / 2;
    const P = [];
    const UV = [];
    const quad = (a, b, c, dd) => { P.push(...a, ...b, ...c, ...a, ...c, ...dd); };
    // slopes (local: ridge along x)
    quad([-hl, 0, hw], [hl, 0, hw], [hl, rh, 0], [-hl, rh, 0]);
    quad([hl, 0, -hw], [-hl, 0, -hw], [-hl, rh, 0], [hl, rh, 0]);
    for (let i = 0; i < P.length; i += 3) UV.push(P[i] / 3, (P[i + 1] + Math.abs(P[i + 2])) / 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.computeVertexNormals();
    _q.setFromAxisAngle(_p.set(0, 1, 0), rot ? Math.PI / 2 : 0);
    _m.compose(_s.set(x, y, z), _q, new THREE.Vector3(1, 1, 1));
    this.meshM('roofTin', g, _m);
    // gables
    const G = [];
    G.push(-hl + 0.3, 0, hw - 0.3, -hl + 0.3, 0, -hw + 0.3, -hl + 0.3, rh - 0.15, 0);
    G.push(hl - 0.3, 0, -hw + 0.3, hl - 0.3, 0, hw - 0.3, hl - 0.3, rh - 0.15, 0);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(G, 3));
    const guv = [];
    for (let i = 0; i < G.length; i += 3) guv.push(G[i + 2] / 3, G[i + 1] / 3);
    gg.setAttribute('uv', new THREE.Float32BufferAttribute(guv, 2));
    gg.computeVertexNormals();
    this.meshM('plaster', gg, _m);
    // collision approximation (keeps players off the slope)
    this.collision.add(x - (rot ? hw : hl), y, z - (rot ? hl : hw), x + (rot ? hw : hl), y + rh * 0.6, z + (rot ? hl : hw), 'metal');
  }

  boundaryWalls() {
    const W = MAP.wall;
    const c = this.collision;
    c.add(-W - 2, -50, -W - 2, W + 2, 200, -W, 'stone', { noNav: true });
    c.add(-W - 2, -50, W, W + 2, 200, W + 2, 'stone', { noNav: true });
    c.add(-W - 2, -50, -W, -W, 200, W, 'stone', { noNav: true });
    c.add(W, -50, -W, W + 2, 200, W, 'stone', { noNav: true });
  }

  // ---------------------------------------------------------------- cover
  buildCoverPoints() {
    const pts = [];
    for (const b of this.collision.boxes) {
      if (!b.cover || b.noNav) continue;
      const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
      const g = this.terrain.height(cx, cz);
      if (b.min[1] > g + 0.6) continue;            // not ground level
      const hgt = b.max[1] - g;
      if (hgt < 0.95) continue;                     // too low to hide behind crouched
      const sx = b.max[0] - b.min[0], sz = b.max[2] - b.min[2];
      if (sx < 0.6 && sz < 0.6) continue;
      const add = (x, z, nx, nz) => {
        if (!this.nav.walkable(x, z)) return;
        pts.push({ x, z, nx, nz, high: hgt > 1.7, claimed: null });
      };
      const off = 0.75;
      const stepX = Math.max(1, Math.floor(sx / 3)), stepZ = Math.max(1, Math.floor(sz / 3));
      for (let i = 0; i < stepX; i++) {
        const x = b.min[0] + (sx * (i + 0.5)) / stepX;
        add(x, b.min[2] - off, 0, -1); add(x, b.max[2] + off, 0, 1);
      }
      for (let i = 0; i < stepZ; i++) {
        const z = b.min[2] + (sz * (i + 0.5)) / stepZ;
        add(b.min[0] - off, z, -1, 0); add(b.max[0] + off, z, 1, 0);
      }
    }
    // Spatial bucket (16 m cells).
    this.coverPoints = pts;
    this.coverGrid = new Map();
    for (const p of pts) {
      const k = Math.floor(p.x / 16) * 1000 + Math.floor(p.z / 16);
      if (!this.coverGrid.has(k)) this.coverGrid.set(k, []);
      this.coverGrid.get(k).push(p);
    }
  }

  coverNear(x, z, r) {
    const out = [];
    const c0x = Math.floor((x - r) / 16), c1x = Math.floor((x + r) / 16);
    const c0z = Math.floor((z - r) / 16), c1z = Math.floor((z + r) / 16);
    for (let i = c0x; i <= c1x; i++) for (let j = c0z; j <= c1z; j++) {
      const l = this.coverGrid.get(i * 1000 + j);
      if (!l) continue;
      for (const p of l) {
        const dx = p.x - x, dz = p.z - z;
        if (dx * dx + dz * dz < r * r) out.push(p);
      }
    }
    return out;
  }

  update(dt, camera) {
    if (this.sky) this.sky.update(dt, camera);
    if (this.vegetation) this.vegetation.update(dt, camera);
  }
}
