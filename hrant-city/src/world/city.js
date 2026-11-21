// Procedural "Vice City"-style world: grid downtown, art-deco beachfront, suburbs,
// ring highway, Ocean Drive, beach, bridge and island. Deterministic (seeded).
import * as THREE from 'three';
import {
  BLOCK, GRID_N, HALF, SIDEWALK, RING, OCEAN_DRIVE_X, WATER_X, ISLAND, BRIDGE, WORLD_BOUNDS,
  ROAD_W, roadCoord, blockCenter, PALETTE,
} from '../config.js';
import { ChunkedBuilder, GeoBuilder, BASE, col } from '../utils/geo.js';
import { mulberry32, randRange, pick, clamp } from '../utils/math.js';
import { ColliderGrid } from './colliders.js';
import { buildRoadGraph } from './roads.js';
import { makeWindowTextures, makeRoadTexture, makeSoftCircle } from './textures.js';

const SPECIAL = { park: '3,4', hospital: '1,4', police: '5,1' };

export class World {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.group = new THREE.Group();
    this.group.name = 'world';
    scene.add(this.group);
    this.rng = mulberry32(1337);
    this.colliders = new ColliderGrid(32);
    this.graph = buildRoadGraph();
    this.blocks = [];          // grid blocks for pedestrian sidewalks
    this.parkingSpots = [];    // {x,z,h,type,color,police}
    this.landmarks = {};
    this.night = 0;

    const win = makeWindowTextures();
    this.soft = makeSoftCircle();
    this.mats = {
      building: new THREE.MeshLambertMaterial({ map: win.map, emissiveMap: win.emissive, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true }),
      plain: new THREE.MeshLambertMaterial({ vertexColors: true }),
      neon: new THREE.MeshBasicMaterial({ vertexColors: true }),
      lamp: new THREE.MeshBasicMaterial({ color: '#bbbbbb' }),
      pool: new THREE.MeshBasicMaterial({ map: this.soft, color: '#ffc477', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      road: new THREE.MeshLambertMaterial({ map: makeRoadTexture() }),
      ground: new THREE.MeshLambertMaterial({ color: '#6fae55' }),
      sand: new THREE.MeshLambertMaterial({ color: '#f2dfb0' }),
      water: quality.shinyWater
        ? new THREE.MeshPhongMaterial({ color: '#1fa2c9', specular: '#ffffff', shininess: 90, transparent: true, opacity: 0.93 })
        : new THREE.MeshLambertMaterial({ color: '#1fa2c9' }),
    };
    this.cb = {
      building: new ChunkedBuilder(), plain: new ChunkedBuilder(), neon: new ChunkedBuilder(),
      lamp: new ChunkedBuilder(), pool: new ChunkedBuilder(),
    };
    this.build();
  }

  // ---------------------------------------------------------------- queries
  heightAt(x, z) {
    const B = BRIDGE;
    if (Math.abs(z - B.z) < B.halfW + 0.5 && x > B.rampStart && x < B.rampEnd) {
      if (x < B.deckStart) return ((x - B.rampStart) / (B.deckStart - B.rampStart)) * B.h;
      if (x < B.deckEnd) return B.h;
      return ((B.rampEnd - x) / (B.rampEnd - B.deckEnd)) * B.h;
    }
    return 0;
  }
  isWater(x, z) {
    if (x < WATER_X) return false;
    if (x > ISLAND.x0 && x < ISLAND.x1 && z > ISLAND.z0 && z < ISLAND.z1) return false;
    return true;
  }
  onBridgeSpan(x) { return x > BRIDGE.rampStart + 8 && x < BRIDGE.rampEnd - 8; }
  /** Keeps things on the bridge deck (railings) and inside the world. Mutates obj.x/z. Returns true if clamped by railing. */
  constrain(obj) {
    let hit = false;
    if (obj.y > 1.5 && this.onBridgeSpan(obj.x)) {
      const lim = BRIDGE.halfW - 0.8;
      if (obj.z > lim) { obj.z = lim; hit = true; } else if (obj.z < -lim) { obj.z = -lim; hit = true; }
    }
    const W = WORLD_BOUNDS;
    if (obj.x < W.x0) { obj.x = W.x0; hit = true; } else if (obj.x > W.x1) { obj.x = W.x1; hit = true; }
    if (obj.z < W.z0) { obj.z = W.z0; hit = true; } else if (obj.z > W.z1) { obj.z = W.z1; hit = true; }
    return hit;
  }
  /** Is (x,z) on a drivable road surface? (approximate, used for spawning) */
  nearestBlock(x, z) {
    let best = null, bd = Infinity;
    for (const b of this.blocks) {
      const d = (b.cx - x) ** 2 + (b.cz - z) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  setNight(f) {
    this.night = f;
    this.mats.building.emissiveIntensity = f * 0.95;
    this.mats.pool.opacity = f * 0.55;
    this.mats.lamp.color.setRGB(0.6 + f * 0.4, 0.6 + f * 0.35, 0.6 + f * 0.1);
  }

  update(time) {
    // traffic light colours
    this._tlTimer = (this._tlTimer || 0) - 1;
    if (this._tlTimer > 0 || !this.tlMesh) return;
    this._tlTimer = 10;
    const G = col('#2bff5a'), Y = col('#ffd21f'), R = col('#ff2a2a');
    for (let k = 0; k < this.tlNodes.length; k++) {
      const { node, axisZ } = this.tlNodes[k];
      const fake = { dx: axisZ ? 0 : 1, dz: axisZ ? 1 : 0 };
      const s = this.graph.lightState(node, fake, time);
      this.tlMesh.setColorAt(k, s === 'green' ? G : s === 'yellow' ? Y : R);
    }
    this.tlMesh.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- build
  build() {
    this._ground();
    this._roads();
    for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) this._block(i, j);
    this._suburbs();
    this._beach();
    this._bridge();
    this._island();
    this._lamps();
    this._trafficLights();
    const g = this.group, sh = this.quality.shadows;
    this.buildingMeshes = this.cb.building.toMeshes(this.mats.building, g, { cast: sh, receive: sh });
    this.cb.plain.toMeshes(this.mats.plain, g, { cast: sh, receive: sh });
    this.cb.neon.toMeshes(this.mats.neon, g);
    this.cb.lamp.toMeshes(this.mats.lamp, g);
    this.cb.pool.toMeshes(this.mats.pool, g, { renderOrder: 2 });
    this.cb = null;
  }

  _plane(x0, x1, z0, z1, y, mat, receive = true) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = receive;
    m.matrixAutoUpdate = false; m.updateMatrix();
    this.group.add(m);
    return m;
  }

  _ground() {
    this._plane(-1600, WATER_X, -1600, 1600, -0.02, this.mats.ground);
    this.water = this._plane(WATER_X - 6, 3200, -3200, 3200, -0.4, this.mats.water, false);
    this.water.renderOrder = 1;
  }

  _roads() {
    const g = this.graph, b = new GeoBuilder();
    const P = b.pos, N = b.nor, U = b.uv, C = b.col;
    const white = col('#ffffff');
    const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, ua, va, ub, vb) => {
      // a b c d in order (a,b along left/right at start; c,d at end)
      const verts = [[ax, ay, az, ua, va], [bx, by, bz, ub, va], [cx, cy, cz, ub, vb], [ax, ay, az, ua, va], [cx, cy, cz, ub, vb], [dx, dy, dz, ua, vb]];
      for (const v of verts) { P.push(v[0], v[1], v[2]); N.push(0, 1, 0); U.push(v[3], v[4]); C.push(white.r, white.g, white.b); }
    };
    for (const e of g.edges) {
      const ha = e.a.size / 2, hb = e.b.size / 2;
      const len = e.len - ha - hb;
      if (len <= 0) continue;
      const rx = -e.dz, rz = e.dx, w2 = e.width / 2;
      const steps = Math.max(1, Math.ceil(len / (e.bridge ? 4 : 40)));
      for (let s = 0; s < steps; s++) {
        const t0 = ha + (len * s) / steps, t1 = ha + (len * (s + 1)) / steps;
        const x0 = e.a.x + e.dx * t0, z0 = e.a.z + e.dz * t0, x1 = e.a.x + e.dx * t1, z1 = e.a.z + e.dz * t1;
        const y0 = this.heightAt(x0, z0) + 0.03, y1 = this.heightAt(x1, z1) + 0.03;
        // left = -right ; ensure CCW winding when viewed from above
        quad(
          x0 + rx * w2, y0, z0 + rz * w2,
          x0 - rx * w2, y0, z0 - rz * w2,
          x1 - rx * w2, y1, z1 - rz * w2,
          x1 + rx * w2, y1, z1 + rz * w2,
          0, t0 / e.width, 1, t1 / e.width,
        );
      }
    }
    for (const n of g.nodes) {
      const s = n.size / 2, y = 0.03;
      quad(n.x - s, y, n.z + s, n.x + s, y, n.z + s, n.x + s, y, n.z - s, n.x - s, y, n.z - s, 0.25, 0.25, 0.25, 0.25);
    }
    // fix winding: compute and flip if normal points down
    const geo = b.build();
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    const pos = geo.attributes.position;
    for (let i = 0; i < nrm.count; i += 3) {
      if (nrm.getY(i) < 0) {
        // swap vertices 1 and 2 of the triangle
        for (const attr of [pos, geo.attributes.uv]) {
          const sz = attr.itemSize;
          for (let c = 0; c < sz; c++) {
            const a = attr.array[(i + 1) * sz + c]; attr.array[(i + 1) * sz + c] = attr.array[(i + 2) * sz + c]; attr.array[(i + 2) * sz + c] = a;
          }
        }
      }
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.mats.road);
    mesh.receiveShadow = this.quality.shadows;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    this.roadMesh = mesh;
  }

  // ---------------------------------------------------------------- props
  palm(x, z, h) {
    const r = this.rng, P = this.cb.plain;
    h = h || randRange(r, 6, 10);
    const lean = randRange(r, -0.5, 0.5), lz = randRange(r, -0.5, 0.5);
    const segs = 4;
    let tx = x, tz = z;
    for (let s = 0; s < segs; s++) {
      const y = (h / segs) * (s + 0.5);
      tx = x + lean * (s / segs) ** 2 * 2; tz = z + lz * (s / segs) ** 2 * 2;
      P.prim(BASE.cyl6, 0.42 - s * 0.05, h / segs + 0.05, 0.42 - s * 0.05, tx, y, tz, col(s % 2 ? '#8b6b4a' : '#7a5c3e'));
    }
    const top = h;
    const fronds = 7;
    for (let k = 0; k < fronds; k++) {
      const yaw = (k / fronds) * Math.PI * 2 + r();
      const pitch = 0.35 + r() * 0.3, L = 3.4;
      const cx = tx + Math.sin(yaw) * L * 0.45, cz = tz + Math.cos(yaw) * L * 0.45, cy = top - Math.sin(pitch) * L * 0.45;
      P.box(0.9, 0.08, L, cx, cy, cz, col(k % 2 ? '#2e8b3e' : '#3fa34d'), yaw, pitch);
    }
    P.prim(BASE.sphere, 0.7, 0.6, 0.7, tx, top - 0.2, tz, col('#5b3b1f'));
  }

  house(x, z, w, d, h, wall, roof, ry = 0) {
    const P = this.cb.plain;
    P.box(w, h, d, x, h / 2 + 0.15, z, col(wall), ry);
    const rh = Math.min(w, d) * 0.35;
    P.prim(BASE.cone4, w + 1, rh, d + 1, x, h + 0.15 + rh / 2, z, col(roof), ry);
    // windows + door (thin dark boxes on faces); only for axis-aligned houses
    const glass = col('#30475e');
    for (const sgn of [-1, 1]) {
      P.box(w * 0.22, h * 0.3, 0.1, x - w * 0.22, h * 0.6, z + sgn * (d / 2 + 0.03), glass);
      P.box(w * 0.22, h * 0.3, 0.1, x + w * 0.22, h * 0.6, z + sgn * (d / 2 + 0.03), glass);
      P.box(0.1, h * 0.3, d * 0.25, x + sgn * (w / 2 + 0.03), h * 0.6, z, glass);
    }
    P.box(1.2, 2.2, 0.12, x, 1.25, z + d / 2 + 0.05, col('#6b4423'));
    this.colliders.add(x - w / 2, z - d / 2, x + w / 2, z + d / 2, h + rh);
  }

  tower(x, z, w, d, h, color, opts = {}) {
    const B = this.cb.building, P = this.cb.plain, r = this.rng;
    B.box(w, h, d, x, h / 2 + 0.15, z, col(color), 0, 0, 0, 'world');
    let top = h + 0.15;
    if (opts.tier && h > 30) {
      const tw = w * randRange(r, 0.55, 0.75), td = d * randRange(r, 0.55, 0.75), th = randRange(r, 8, 25);
      B.box(tw, th, td, x, top + th / 2, z, col(color), 0, 0, 0, 'world');
      if (r() < 0.5) P.prim(BASE.cyl6, 0.3, 12, 0.3, x, top + th + 6, z, col('#dddddd'));
      top += th;
    }
    // roof cap + AC units
    P.box(w + 0.4, 0.5, d + 0.4, x, h + 0.4, z, col('#9aa0a6'));
    if (r() < 0.7) P.box(3, 1.6, 2.5, x + randRange(r, -w / 4, w / 4), h + 1.4, z + randRange(r, -d / 4, d / 4), col('#c9ced3'));
    if (opts.neon) {
      const nc = col(opts.neon), y = h - 0.6;
      const N = this.cb.neon;
      N.box(w + 0.3, 0.35, 0.25, x, y, z + d / 2 + 0.05, nc);
      N.box(w + 0.3, 0.35, 0.25, x, y, z - d / 2 - 0.05, nc);
      N.box(0.25, 0.35, d + 0.3, x + w / 2 + 0.05, y, z, nc);
      N.box(0.25, 0.35, d + 0.3, x - w / 2 - 0.05, y, z, nc);
      if (opts.decoStripes) {
        N.box(0.3, h * 0.7, 0.3, x + w / 2 + 0.1, h * 0.45, z + d / 2 + 0.1, nc);
        N.box(0.3, h * 0.7, 0.3, x - w / 2 - 0.1, h * 0.45, z + d / 2 + 0.1, nc);
      }
    }
    this.colliders.add(x - w / 2, z - d / 2, x + w / 2, z + d / 2, top + 2);
  }

  _block(i, j) {
    const r = this.rng, P = this.cb.plain;
    const cx = blockCenter(i), cz = blockCenter(j);
    const key = i + ',' + j;
    const dc = Math.max(Math.abs(i - 3.5), Math.abs(j - 3.5));
    let type = dc <= 1.5 ? 'downtown' : dc <= 2.5 ? 'midrise' : 'suburb';
    if (i === GRID_N - 1) type = 'hotel';
    if (key === SPECIAL.park) type = 'park';
    if (key === SPECIAL.hospital) type = 'hospital';
    if (key === SPECIAL.police) type = 'police';
    this.blocks.push({ i, j, cx, cz, type });

    // sidewalk slab + curb
    P.box(BLOCK, 0.15, BLOCK, cx, 0.075, cz, col('#c9c6bd'));
    const inner = BLOCK - SIDEWALK * 2, ih = inner / 2;
    const interiorColor = type === 'suburb' || type === 'park' ? '#74b95a' : type === 'hotel' ? '#e8dcc0' : '#d6d0c2';
    P.box(inner, 0.04, inner, cx, 0.17, cz, col(interiorColor));

    if (type === 'downtown') {
      const split = r();
      const lots = split < 0.3 ? [[0, 0, inner]] : split < 0.65
        ? [[-ih / 2, 0, ih], [ih / 2, 0, ih]].map(([ox, oz, s]) => [ox, oz, s, inner])
        : [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [(a * ih) / 2, (b * ih) / 2, ih]);
      for (const lot of lots) {
        const [ox, oz, sx, sz = sx] = lot;
        const w = sx - randRange(r, 3, 7), d = sz - randRange(r, 3, 7);
        const centrality = 1 - dc / 2;
        const h = randRange(r, 30, 60) + centrality * randRange(r, 20, 70);
        this.tower(cx + ox, cz + oz, w, d, h, pick(r, PALETTE.downtown), { tier: r() < 0.6, neon: r() < 0.3 ? pick(r, PALETTE.neon) : null });
      }
    } else if (type === 'midrise' || type === 'hotel') {
      const n = type === 'hotel' ? 2 : 2 + Math.floor(r() * 3);
      const lots = n === 2 ? [[0, -ih / 2], [0, ih / 2]] : n === 3 ? [[-ih / 2, -ih / 2], [ih / 2, -ih / 2], [0, ih / 2]] : [[-ih / 2, -ih / 2], [ih / 2, -ih / 2], [-ih / 2, ih / 2], [ih / 2, ih / 2]];
      for (const [ox, oz] of lots) {
        const full = n === 2 || (n === 3 && oz > 0);
        const w = (full ? inner : ih) - randRange(r, 4, 8), d = ih - randRange(r, 4, 7);
        const h = type === 'hotel' ? randRange(r, 24, 48) : randRange(r, 12, 34);
        this.tower(cx + ox, cz + oz, w, d, h, pick(r, PALETTE.deco), { neon: r() < 0.75 ? pick(r, PALETTE.neon) : null, decoStripes: type === 'hotel' });
      }
      if (type === 'hotel') { this.palm(cx + ih - 1, cz - 2); this.palm(cx + ih - 1, cz + 3); }
    } else if (type === 'suburb') {
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const hx = cx + (a * ih) / 2, hz = cz + (b * ih) / 2;
        const w = randRange(r, 10, 14), d = randRange(r, 9, 12), h = randRange(r, 4, 6.5);
        this.house(hx, hz, w, d, h, pick(r, PALETTE.house), pick(r, PALETTE.roof));
        if (r() < 0.45) P.box(5, 0.1, 3, hx + a * 2, 0.22, hz + b * (d / 2 + 3), col('#4fc3f7'));
        if (r() < 0.8) this.palm(hx - a * (w / 2 + 2), hz + b * (d / 2 + 2.5));
      }
    } else if (type === 'park') {
      // fountain + palms + parking lot along the north edge
      P.prim(BASE.cyl10, 12, 0.8, 12, cx, 0.5, cz + 4, col('#d8d2c4'));
      P.prim(BASE.cyl10, 10.6, 0.1, 10.6, cx, 0.92, cz + 4, col('#58c7f3'));
      P.prim(BASE.cyl6, 1, 3, 1, cx, 1.8, cz + 4, col('#e9e4d8'));
      this.cb.neon.prim(BASE.sphere, 1.4, 1.4, 1.4, cx, 3.6, cz + 4, col('#7fe8ff'));
      this.colliders.add(cx - 5, cz - 1, cx + 5, cz + 9, 1.2);
      P.box(inner, 0.05, 9, cx, 0.2, cz - ih + 5, col('#55585e'));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        this.palm(cx + Math.cos(a) * 17, cz + 6 + Math.sin(a) * 13);
      }
      for (const px of [-20, -10, 0, 10, 20]) this.parkingSpots.push({ x: cx + px, z: cz - ih + 5, h: Math.PI / 2 });
      this.landmarks.spawn = { x: cx + 7, z: cz - BLOCK / 2 + 2.5, h: Math.PI };
      this.landmarks.park = { x: cx, z: cz };
    } else if (type === 'hospital') {
      this.tower(cx, cz + 4, 40, 26, 22, '#f4f7fa', {});
      const red = col('#ff2a3a'), N = this.cb.neon;
      for (const sgn of [-1, 1]) {
        N.box(6, 1.6, 0.3, cx, 16, cz + 4 + sgn * 13.2, red);
        N.box(1.6, 6, 0.3, cx, 16, cz + 4 + sgn * 13.2, red);
      }
      P.box(inner, 0.05, 9, cx, 0.2, cz - ih + 5, col('#55585e'));
      this.landmarks.hospital = { x: cx, z: cz - BLOCK / 2 + 2, h: Math.PI };
    } else if (type === 'police') {
      this.tower(cx, cz + 6, 42, 24, 14, '#e9eef7', {});
      const N = this.cb.neon;
      N.box(42.4, 1.2, 24.4, cx, 12.4, cz + 6, col('#2b5cff'));
      P.box(inner, 0.05, 12, cx, 0.2, cz - ih + 6, col('#55585e'));
      for (const px of [-15, -5, 5, 15]) this.parkingSpots.push({ x: cx + px, z: cz - ih + 6, h: Math.PI / 2, police: true });
      this.landmarks.police = { x: cx, z: cz - BLOCK / 2 + 2, h: Math.PI };
    }
  }

  _suburbs() {
    const r = this.rng;
    const conn = [0, 2, 4, 6, 8].map(roadCoord);
    const nearConn = (v) => conn.some((c) => Math.abs(v - c) < 16);
    // north and south bands
    for (const zc of [-(HALF + RING) / 2 - 3, (HALF + RING) / 2 + 3]) {
      for (let x = -HALF + 10; x < HALF - 10; x += 24) {
        if (nearConn(x)) { this.palm(x + 12, zc); continue; }
        const w = randRange(r, 10, 15), d = randRange(r, 10, 14);
        this.house(x, zc, w, d, randRange(r, 4, 7), pick(r, PALETTE.house), pick(r, PALETTE.roof));
        if (r() < 0.6) this.palm(x + w / 2 + 2, zc + randRange(r, -6, 6));
      }
    }
    // west band
    const xw = -(HALF + RING) / 2 - 3;
    for (let z = -RING + 22; z < RING - 22; z += 24) {
      if (nearConn(z)) { this.palm(xw, z + 12); continue; }
      const w = randRange(r, 10, 14), d = randRange(r, 10, 15);
      this.house(xw, z, w, d, randRange(r, 4, 7), pick(r, PALETTE.house), pick(r, PALETTE.roof));
    }
    // outer scattered palms
    for (let k = 0; k < 70; k++) {
      const a = r() * Math.PI * 2, d = RING + randRange(r, 25, 95);
      const x = Math.cos(a) * d * 1.05, z = Math.sin(a) * d;
      if (x > OCEAN_DRIVE_X - 20) continue;
      this.palm(x, z);
    }
    // a beach-side strip of palms between the grid and Ocean Drive
    for (let z = -RING + 10; z < RING - 10; z += 18) {
      if (Math.abs(z % 74) < 10) continue;
      this.palm(HALF + 18, z + randRange(r, -3, 3));
    }
  }

  _beach() {
    const P = this.cb.plain, r = this.rng;
    // sand (thin box so the edge reads as a shoreline)
    const sand = new THREE.Mesh(new THREE.BoxGeometry(WATER_X - (HALF + ROAD_W / 2), 1, 3000), this.mats.sand);
    sand.position.set((WATER_X + HALF + ROAD_W / 2) / 2, -0.495, 0);
    sand.receiveShadow = this.quality.shadows;
    sand.matrixAutoUpdate = false; sand.updateMatrix();
    this.group.add(sand);
    // umbrellas, loungers, lifeguard towers
    const cols = ['#ff4f8b', '#2ec4b6', '#ffd23f', '#ff9f1c', '#7ec8ff', '#ffffff'];
    for (let z = -RING; z < RING; z += 11) {
      if (Math.abs(z) < 16 || Math.abs(z - 60) < 10) continue;
      const x = randRange(r, 352, 384), zz = z + randRange(r, -3, 3);
      P.prim(BASE.cyl6, 0.12, 2.6, 0.12, x, 1.3, zz, col('#eeeeee'));
      P.prim(BASE.cone8, 3.4, 0.9, 3.4, x, 2.7, zz, col(pick(r, cols)));
      P.box(0.8, 0.25, 2, x + 1.5, 0.3, zz, col('#ffffff'));
    }
    for (const z of [-250, -120, 130, 260]) {
      const x = 372;
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.box(0.25, 3, 0.25, x + a, 1.5, z + b, col('#f5f5f5'));
      P.box(3, 2.2, 3, x, 4.1, z, col('#ff6fa5'));
      P.prim(BASE.cone4, 3.8, 1.2, 3.8, x, 5.8, z, col('#ffd23f'));
      this.colliders.add(x - 1.2, z - 1.2, x + 1.2, z + 1.2, 6);
    }
    // pier / dock
    P.box(36, 0.5, 5, WATER_X + 14, 0.25, 60, col('#a0764d'));
    for (let x = WATER_X - 2; x < WATER_X + 32; x += 6) {
      P.prim(BASE.cyl6, 0.4, 3, 0.4, x, -1, 57.8, col('#6b4f3a'));
      P.prim(BASE.cyl6, 0.4, 3, 0.4, x, -1, 62.2, col('#6b4f3a'));
    }
    this.landmarks.dock = { x: WATER_X + 18, z: 68, h: Math.PI / 2 };
    this.landmarks.beach = { x: 370, z: -60 };
  }

  _bridge() {
    const P = this.cb.plain, B = BRIDGE;
    const deckLen = B.deckEnd - B.deckStart, cx = (B.deckStart + B.deckEnd) / 2;
    const concrete = col('#d8d2c4'), rail = col('#f4f4f4');
    P.box(deckLen, 1.2, B.halfW * 2, cx, B.h - 0.65, B.z, concrete);
    for (const s of [-1, 1]) {
      P.box(deckLen, 1.0, 0.35, cx, B.h + 0.5, B.z + s * B.halfW, rail);
      this.cb.neon.box(deckLen, 0.12, 0.12, cx, B.h - 0.1, B.z + s * (B.halfW + 0.1), col('#ff2fa8'));
    }
    for (let x = B.deckStart + 12; x < B.deckEnd; x += 26) {
      P.box(3, B.h + 2, 3, x, (B.h - 2) / 2 - 1, B.z - 5, concrete);
      P.box(3, B.h + 2, 3, x, (B.h - 2) / 2 - 1, B.z + 5, concrete);
    }
    // suspension-ish towers in the middle
    for (const x of [450, 545]) {
      for (const s of [-1, 1]) {
        P.box(1.6, 22, 1.6, x, B.h + 11, B.z + s * (B.halfW + 0.8), col('#e9e4d8'));
        this.cb.neon.box(0.3, 22, 0.3, x, B.h + 11, B.z + s * (B.halfW + 1.65), col('#21f0ff'));
      }
      P.box(1.6, 1.6, B.halfW * 2 + 3, x, B.h + 21, B.z, col('#e9e4d8'));
    }
    // ramp fill (stepped solids under the sloped road)
    const ramp = (x0, x1, up) => {
      const n = 8;
      for (let k = 0; k < n; k++) {
        const a = x0 + ((x1 - x0) * k) / n, b = x0 + ((x1 - x0) * (k + 1)) / n;
        const h = Math.min(this.heightAt(a, 0), this.heightAt(b, 0)) - 0.05;
        if (h <= 0.05) continue;
        P.box(Math.abs(b - a) + 0.05, h, B.halfW * 2, (a + b) / 2, h / 2, B.z, concrete);
      }
      void up;
    };
    ramp(B.rampStart, B.deckStart, true);
    ramp(B.deckEnd, B.rampEnd, false);
  }

  _island() {
    const P = this.cb.plain, I = ISLAND;
    const isl = new THREE.Mesh(new THREE.BoxGeometry(I.x1 - I.x0, 2, I.z1 - I.z0), this.mats.sand);
    isl.position.set((I.x0 + I.x1) / 2, -0.99, (I.z0 + I.z1) / 2);
    isl.matrixAutoUpdate = false; isl.updateMatrix(); isl.receiveShadow = this.quality.shadows;
    this.group.add(isl);
    const gx0 = I.x0 + 25, gx1 = I.x1 - 25, gz0 = I.z0 + 25, gz1 = I.z1 - 25;
    P.box(gx1 - gx0, 0.04, gz1 - gz0, (gx0 + gx1) / 2, 0.03, (gz0 + gz1) / 2, col('#79c35e'));
    // Hrant's villa
    const vx = 790, vz = 40;
    this.tower(vx, vz, 30, 20, 9, '#fff0f5', { neon: '#ff2fa8' });
    P.box(18, 5, 14, vx - 4, 11.6, vz + 1, col('#fff0f5'));
    P.box(16, 0.12, 8, vx - 8, 0.12, vz - 18, col('#4fc3f7'));
    P.box(18, 0.3, 10, vx - 8, 0.08, vz - 18, col('#ffffff'));
    this.landmarks.villa = { x: 760, z: 20, h: -Math.PI / 2 };
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2;
      this.palm(730 + Math.cos(a) * 115, Math.sin(a) * 135);
    }
    for (let k = 0; k < 4; k++) this.house(690 + k * 30, -80, 12, 10, 5, pick(this.rng, PALETTE.house), pick(this.rng, PALETTE.roof));
  }

  _lamps() {
    const P = this.cb.plain, L = this.cb.lamp, Q = this.cb.pool;
    const pole = col('#5f6368');
    const lamp = (x, z, dirx, dirz) => {
      P.prim(BASE.cyl6, 0.22, 7, 0.22, x, 3.5, z, pole);
      const hx = x + dirx * 1.6, hz = z + dirz * 1.6;
      P.box(Math.abs(dirx) * 1.8 + 0.15, 0.15, Math.abs(dirz) * 1.8 + 0.15, x + dirx * 0.8, 6.95, z + dirz * 0.8, pole);
      L.box(0.9, 0.25, 0.9, hx, 6.8, hz, col('#ffffff'));
      Q.prim(BASE.plane, 13, 1, 13, hx + dirx * 1.5, 0.2, hz + dirz * 1.5, col('#ffffff'));
    };
    const o = BLOCK / 2 - 1;
    for (const b of this.blocks) {
      lamp(b.cx - o, b.cz - o, -0.7, -0.7);
      lamp(b.cx + o, b.cz + o, 0.7, 0.7);
      lamp(b.cx, b.cz - o, 0, -1);
      lamp(b.cx, b.cz + o, 0, 1);
      if ((b.i + b.j) % 2 === 0) { lamp(b.cx - o, b.cz, -1, 0); lamp(b.cx + o, b.cz, 1, 0); }
    }
    // highway & Ocean Drive lamps
    for (const e of this.graph.edges) {
      if (e.bridge || e.a.grid && e.b.grid) continue;
      const n = Math.floor(e.len / 45);
      for (let k = 1; k < n; k++) {
        const t = (k / n) * e.len;
        const rx = -e.dz, rz = e.dx, off = e.width / 2 + 1.2;
        lamp(e.a.x + e.dx * t + rx * off, e.a.z + e.dz * t + rz * off, -rx, -rz);
      }
    }
    // bridge lamps
    for (let x = BRIDGE.deckStart + 6; x < BRIDGE.deckEnd; x += 30) {
      for (const s of [-1, 1]) {
        P.prim(BASE.cyl6, 0.2, 6, 0.2, x, BRIDGE.h + 3, s * (BRIDGE.halfW - 0.3), pole);
        L.box(0.8, 0.25, 0.8, x, BRIDGE.h + 6, s * (BRIDGE.halfW - 1.2), col('#ffffff'));
        Q.prim(BASE.plane, 10, 1, 10, x, BRIDGE.h + 0.1, s * (BRIDGE.halfW - 3), col('#ffffff'));
      }
    }
  }

  _trafficLights() {
    const P = this.cb.plain;
    this.tlNodes = [];
    const pole = col('#3c3f44');
    for (const n of this.graph.nodes) {
      if (!n.light) continue;
      const o = n.size / 2 + 1.2;
      P.prim(BASE.cyl6, 0.2, 5, 0.2, n.x + o, 2.5, n.z + o, pole);
      P.prim(BASE.cyl6, 0.2, 5, 0.2, n.x - o, 2.5, n.z - o, pole);
      this.tlNodes.push({ node: n, axisZ: true, x: n.x + o, z: n.z + o });
      this.tlNodes.push({ node: n, axisZ: false, x: n.x - o, z: n.z - o });
    }
    const geo = new THREE.BoxGeometry(0.6, 1.4, 0.6);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const mesh = new THREE.InstancedMesh(geo, mat, this.tlNodes.length);
    const m = new THREE.Matrix4();
    this.tlNodes.forEach((t, k) => {
      m.makeTranslation(t.x, 5.4, t.z);
      mesh.setMatrixAt(k, m);
      mesh.setColorAt(k, col('#ff2a2a'));
    });
    mesh.computeBoundingSphere();
    this.group.add(mesh);
    this.tlMesh = mesh;
  }

  /** Random sidewalk point on a block side (for missions/pickups). side: 'n','s','e','w' */
  sidewalkPoint(i, j, side, along = 0) {
    const cx = blockCenter(i), cz = blockCenter(j), o = BLOCK / 2 - 2;
    switch (side) {
      case 'n': return { x: cx + along, z: cz - o };
      case 's': return { x: cx + along, z: cz + o };
      case 'e': return { x: cx + o, z: cz + along };
      default: return { x: cx - o, z: cz + along };
    }
  }
}

export { clamp };
