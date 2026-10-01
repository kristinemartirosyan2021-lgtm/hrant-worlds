// Heightfield terrain: flattened building zones, rolling forest, rocky hills, border mountains.
import * as THREE from 'three';
import { fbm, smoothstep, clamp } from '../core/util.js';
import { MAP } from '../config.js';
import { groundTexture } from './Textures.js';

const HALF = MAP.terrainHalf;
const SEG = 230;             // 2 m resolution
const STEP = (HALF * 2) / SEG;

// Rectangles (cx, cz, hw, hd) that are forced flat (height 0) for buildings and roads.
export const FLAT_ZONES = [
  [-92, -88, 60, 52],   // town
  [92, -88, 62, 52],    // industry
  [0, 0, 36, 36],       // fort
  [0, 100, 30, 26],     // checkpoint
  [0, 0, 8, 175],       // N-S road
  [0, -36, 175, 8],     // E-W road
  [-105, 95, 12, 12],   // forest cabin clearing
];

function rectMask(x, z, [cx, cz, hw, hd], soft = 16) {
  const dx = Math.abs(x - cx) - hw, dz = Math.abs(z - cz) - hd;
  const d = Math.max(dx, dz);
  return 1 - smoothstep(0, soft, d);
}

function rawHeight(x, z) {
  let h = (fbm(x * 0.011 + 3.1, z * 0.011 - 7.7, 4) * 0.5 + 0.5) * 6.5;
  // Rocky hills in the south-east.
  const hx = x - 105, hz = z - 98;
  const hm = 1 - smoothstep(30, 85, Math.sqrt(hx * hx + hz * hz));
  h += hm * ((fbm(x * 0.022 + 11, z * 0.022 + 4, 5) * 0.5 + 0.5) * 22 + 4);
  // Gentle forest undulation in the south-west.
  const fx = x + 105, fz = z - 95;
  const fm = 1 - smoothstep(40, 90, Math.sqrt(fx * fx + fz * fz));
  h += fm * (fbm(x * 0.03, z * 0.03, 3) * 0.5 + 0.5) * 4;
  // Border mountains keep players inside.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > 150) h += Math.pow(edge - 150, 1.35) * 0.75 * (0.7 + 0.3 * fbm(x * 0.05, z * 0.05, 2));
  return h;
}

export class Terrain {
  constructor() {
    const n = SEG + 1;
    this.n = n;
    this.h = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -HALF + i * STEP, z = -HALF + j * STEP;
        let flat = 0;
        for (const r of FLAT_ZONES) flat = Math.max(flat, rectMask(x, z, r));
        this.h[j * n + i] = rawHeight(x, z) * (1 - flat);
      }
    }
    this.maxH = 0;
    for (let i = 0; i < this.h.length; i++) this.maxH = Math.max(this.maxH, this.h[i]);
  }

  // Bilinear sample matching the rendered triangles closely.
  height(x, z) {
    const fx = clamp((x + HALF) / STEP, 0, SEG - 0.0001);
    const fz = clamp((z + HALF) / STEP, 0, SEG - 0.0001);
    const i = Math.floor(fx), j = Math.floor(fz);
    const u = fx - i, v = fz - j;
    const n = this.n, h = this.h;
    const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
    // Match PlaneGeometry triangle split (a,c,b) / (c,d,b).
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }

  normal(x, z, out = new THREE.Vector3()) {
    const e = 1.0;
    const hl = this.height(x - e, z), hr = this.height(x + e, z);
    const hd = this.height(x, z - e), hu = this.height(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  slope(x, z) {
    const e = 0.75;
    const dx = this.height(x + e, z) - this.height(x - e, z);
    const dz = this.height(x, z + e) - this.height(x, z - e);
    return Math.sqrt(dx * dx + dz * dz) / (2 * e);
  }

  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    let t = 0, prevT = 0;
    for (let k = 0; k < 400 && t < maxT; k++) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      if (y > this.maxH + 1 && dy >= 0) return null;
      const diff = y - this.height(x, z);
      if (diff < 0) {
        let lo = prevT, hi = t;
        for (let b = 0; b < 8; b++) {
          const m = (lo + hi) / 2;
          const yy = oy + dy * m;
          if (yy - this.height(ox + dx * m, oz + dz * m) < 0) hi = m; else lo = m;
        }
        const n = this.normal(ox + dx * hi, oz + dz * hi);
        return { t: hi, x: ox + dx * hi, y: oy + dy * hi, z: oz + dz * hi, nx: n.x, ny: n.y, nz: n.z, mat: 'dirt', box: null };
      }
      prevT = t;
      t += Math.max(0.35, Math.min(diff * 0.5, 6));
    }
    return null;
  }

  buildMesh() {
    const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color('#7d7a3c');
    const cDry = new THREE.Color('#a48d55');
    const cDirt = new THREE.Color('#7b6248');
    const cRock = new THREE.Color('#7a746d');
    const cForest = new THREE.Color('#4f5a2b');
    const cSnow = new THREE.Color('#d9d6d0');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const gi = Math.round((x + HALF) / STEP), gj = Math.round((z + HALF) / STEP);
      const h = this.h[gj * this.n + gi];
      pos.setY(i, h);
      const s = this.slope(x, z);
      const n = fbm(x * 0.04, z * 0.04, 3) * 0.5 + 0.5;
      c.copy(cGrass).lerp(cDry, n);
      const fx = x + 105, fz = z - 95;
      const forest = 1 - smoothstep(35, 80, Math.sqrt(fx * fx + fz * fz));
      c.lerp(cForest, forest * 0.75);
      let flat = 0;
      for (const r of FLAT_ZONES) flat = Math.max(flat, rectMask(x, z, r, 6));
      c.lerp(cDirt, flat * 0.65 * (0.7 + 0.3 * n));
      c.lerp(cRock, smoothstep(0.45, 0.9, s));
      c.lerp(cSnow, smoothstep(30, 48, h));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const tex = groundTexture();
    tex.repeat.set(HALF / 3, HALF / 3);
    const mat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.96, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }
}
