// Reusable prop builders (cars, containers, barriers, sandbags, stalls, khachkars ...).
import * as THREE from 'three';
import { signTexture, khachkarTexture } from './Textures.js';

const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14).rotateZ(Math.PI / 2);
const barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14);
const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 1, 8);
const tireGeo = new THREE.TorusGeometry(0.36, 0.14, 8, 14).rotateX(Math.PI / 2);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

const CAR_COLORS = [
  [0.75, 0.73, 0.68], [0.55, 0.12, 0.1], [0.2, 0.32, 0.5], [0.85, 0.82, 0.74], [0.3, 0.36, 0.26],
  [0.62, 0.5, 0.28], [0.18, 0.18, 0.2], [0.45, 0.5, 0.55], [0.7, 0.55, 0.2],
];

// axis 'x' => long side along X.
export function car(W, x, z, axis = 'x', color = null, y = null) {
  const g = y ?? W.h(x, z);
  const L = 4.3, Wd = 1.8;
  const hx = axis === 'x' ? L / 2 : Wd / 2, hz = axis === 'x' ? Wd / 2 : L / 2;
  const col = color || CAR_COLORS[Math.floor(W.rng() * CAR_COLORS.length)];
  const dirt = 0.75 + W.rng() * 0.25;
  const tint = col.map((c) => c * dirt);
  // body
  W.solid('carPaint', x - hx, g + 0.32, z - hz, x + hx, g + 0.98, z + hz, { tint, uv: 2, impact: 'metal' });
  // cabin (shifted backwards a bit)
  const off = (W.rng() < 0.5 ? -1 : 1) * 0.25;
  const cx = axis === 'x' ? x + off : x, cz = axis === 'x' ? z : z + off;
  const chx = axis === 'x' ? 1.15 : Wd / 2 - 0.08, chz = axis === 'x' ? Wd / 2 - 0.08 : 1.15;
  W.solid('carPaint', cx - chx, g + 0.98, cz - chz, cx + chx, g + 1.45, cz + chz, { tint, uv: 2, impact: 'metal' });
  // windows band
  W.deco('pane', cx - chx - 0.02, g + 1.04, cz - chz - 0.02, cx + chx + 0.02, g + 1.38, cz + chz + 0.02);
  // bumpers
  if (axis === 'x') {
    W.deco('chrome', x - hx - 0.08, g + 0.36, z - hz + 0.1, x - hx, g + 0.5, z + hz - 0.1);
    W.deco('chrome', x + hx, g + 0.36, z - hz + 0.1, x + hx + 0.08, g + 0.5, z + hz - 0.1);
  } else {
    W.deco('chrome', x - hx + 0.1, g + 0.36, z - hz - 0.08, x + hx - 0.1, g + 0.5, z - hz);
    W.deco('chrome', x - hx + 0.1, g + 0.36, z + hz, x + hx - 0.1, g + 0.5, z + hz + 0.08);
  }
  // wheels
  const ry = axis === 'x' ? 0 : Math.PI / 2;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const wx = axis === 'x' ? x + a * 1.35 : x + b * (Wd / 2 - 0.05);
    const wz = axis === 'x' ? z + b * (Wd / 2 - 0.05) : z + a * 1.35;
    W.mesh('rubber', wheelGeo, wx, g + 0.33, wz, ry);
  }
}

export function truck(W, x, z, axis = 'z', tint = [0.32, 0.38, 0.28]) {
  const g = W.h(x, z);
  const L = 7.5, Wd = 2.4;
  const hx = axis === 'x' ? L / 2 : Wd / 2, hz = axis === 'x' ? Wd / 2 : L / 2;
  const dir = 1;
  // chassis
  W.solid('darkMetal', x - hx, g + 0.5, z - hz, x + hx, g + 0.95, z + hz);
  // cab at +end
  const cabL = 2.0;
  if (axis === 'z') {
    W.solid('carPaint', x - hx, g + 0.95, z + hz - cabL, x + hx, g + 2.7, z + hz, { tint, impact: 'metal' });
    W.deco('pane', x - hx + 0.15, g + 2.0, z + hz + 0.01, x + hx - 0.15, g + 2.55, z + hz + 0.04);
    // cargo bed with canvas cover
    W.solid('carPaint', x - hx, g + 0.95, z - hz, x + hx, g + 1.6, z + hz - cabL - 0.2, { tint, impact: 'metal' });
    W.solid('cloth', x - hx + 0.05, g + 1.6, z - hz, x + hx - 0.05, g + 3.0, z + hz - cabL - 0.3, { tint: [0.42, 0.44, 0.3], impact: 'wood', uv: 2 });
  } else {
    W.solid('carPaint', x + hx - cabL, g + 0.95, z - hz, x + hx, g + 2.7, z + hz, { tint, impact: 'metal' });
    W.solid('carPaint', x - hx, g + 0.95, z - hz, x + hx - cabL - 0.2, g + 1.6, z + hz, { tint, impact: 'metal' });
    W.solid('cloth', x - hx, g + 1.6, z - hz + 0.05, x + hx - cabL - 0.3, g + 3.0, z + hz - 0.05, { tint: [0.42, 0.44, 0.3], impact: 'wood', uv: 2 });
  }
  const ry = axis === 'x' ? 0 : Math.PI / 2;
  for (const a of [-0.8, 0.1, 0.85]) for (const b of [-1, 1]) {
    const wx = axis === 'x' ? x + a * hx * dir : x + b * (Wd / 2 - 0.1);
    const wz = axis === 'x' ? z + b * (Wd / 2 - 0.1) : z + a * hz * dir;
    W.mesh('rubber', wheelGeo, wx, g + 0.5, wz, ry, 1.5, 1.5, 1.5);
  }
}

export function barrel(W, x, z, y = null, tint = null) {
  const g = y ?? W.h(x, z);
  const t = tint || [[0.25, 0.35, 0.5], [0.55, 0.2, 0.12], [0.35, 0.38, 0.3], [0.6, 0.5, 0.2]][Math.floor(W.rng() * 4)];
  W.mesh('carPaint', barrelGeo, x, g + 0.45, z, 0, 1, 1, 1, t);
  W.collision.add(x - 0.28, g, z - 0.28, x + 0.28, g + 0.9, z + 0.28, 'metal');
}

export function crate(W, x, z, s = 1.1, y = null, stack = 1) {
  let g = y ?? W.h(x, z);
  for (let i = 0; i < stack; i++) {
    const ss = s * (i ? 0.85 : 1);
    W.solid('wood', x - ss / 2, g, z - ss / 2, x + ss / 2, g + ss, z + ss / 2, { uv: ss });
    W.deco('woodDark', x - ss / 2 - 0.02, g + ss * 0.42, z - ss / 2 - 0.02, x + ss / 2 + 0.02, g + ss * 0.58, z + ss / 2 + 0.02);
    g += ss;
  }
}

export function pallets(W, x, z, n = 3) {
  const g = W.h(x, z);
  W.solid('wood', x - 0.6, g, z - 0.5, x + 0.6, g + 0.14 * n, z + 0.5, { uv: 1 });
}

export function sandbags(W, x0, z0, x1, z1, h = 1.05) {
  const g = Math.min(W.h(x0, z0), W.h(x1, z1));
  const rows = Math.round(h / 0.21);
  for (let r = 0; r < rows; r++) {
    const inset = r * 0.03;
    const off = r % 2 ? 0.2 : 0;
    W.solid('sandbag', Math.min(x0, x1) + inset + (x1 !== x0 ? off * 0 : 0), g + r * 0.21, Math.min(z0, z1) + inset,
      Math.max(x0, x1) - inset, g + (r + 1) * 0.21, Math.max(z0, z1) - inset, { tint: 0.85 + (r % 2) * 0.1 });
  }
}

export function jersey(W, x, z, axis = 'x', len = 3) {
  const g = W.h(x, z);
  const hx = axis === 'x' ? len / 2 : 0.35, hz = axis === 'x' ? 0.35 : len / 2;
  W.solid('concrete', x - hx, g, z - hz, x + hx, g + 0.35, z + hz, { uv: 2 });
  const ix = axis === 'x' ? hx : 0.17, iz = axis === 'x' ? 0.17 : hz;
  W.solid('concrete', x - ix, g + 0.35, z - iz, x + ix, g + 0.95, z + iz, { uv: 2 });
  W.deco('paintRed', x - ix - 0.01, g + 0.8, z - iz - 0.01, x + ix + 0.01, g + 0.88, z + iz + 0.01);
}

export function container(W, x, z, axis = 'x', mat = 'cRed', y = null, open = false) {
  const g = y ?? W.h(x, z);
  const L = 6.06, Wd = 2.44, H = 2.6;
  const hx = axis === 'x' ? L / 2 : Wd / 2, hz = axis === 'x' ? Wd / 2 : L / 2;
  if (!open) {
    W.solid(mat, x - hx, g, z - hz, x + hx, g + H, z + hz);
  } else {
    const t = 0.08;
    W.solid(mat, x - hx, g + H - t, z - hz, x + hx, g + H, z + hz);
    W.solid('darkMetal', x - hx, g, z - hz, x + hx, g + 0.12, z + hz, { cover: false });
    if (axis === 'x') {
      W.solid(mat, x - hx, g, z - hz, x + hx, g + H, z - hz + t);
      W.solid(mat, x - hx, g, z + hz - t, x + hx, g + H, z + hz);
      W.solid(mat, x - hx, g, z - hz, x - hx + t, g + H, z + hz);
      // open door leaves
      W.deco(mat, x + hx, g, z + hz - 0.05, x + hx + 1.2, g + H, z + hz);
    } else {
      W.solid(mat, x - hx, g, z - hz, x - hx + t, g + H, z + hz);
      W.solid(mat, x + hx - t, g, z - hz, x + hx, g + H, z + hz);
      W.solid(mat, x - hx, g, z - hz, x + hx, g + H, z - hz + t);
      W.deco(mat, x + hx - 0.05, g, z + hz, x + hx, g + H, z + hz + 1.2);
    }
  }
  // corner posts / frame
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    W.deco('darkMetal', x + a * hx - 0.07, g, z + b * hz - 0.07, x + a * hx + 0.07, g + H + 0.02, z + b * hz + 0.07);
  }
  return g + H;
}

export function lamp(W, x, z) {
  const g = W.h(x, z);
  W.mesh('darkMetal', poleGeo, x, g + 2.6, z, 0, 0.8, 5.2, 0.8);
  W.deco('darkMetal', x - 0.05, g + 5.1, z - 0.05, x + 0.9, g + 5.2, z + 0.05);
  W.deco('paintWhite', x + 0.65, g + 4.95, z - 0.15, x + 1.1, g + 5.1, z + 0.15);
  W.collision.add(x - 0.12, g, z - 0.12, x + 0.12, g + 5.2, z + 0.12, 'metal', { cover: false });
}

export function powerPole(W, x, z) {
  const g = W.h(x, z);
  W.mesh('woodDark', poleGeo, x, g + 4.5, z, 0, 1.3, 9, 1.3);
  W.deco('woodDark', x - 1.0, g + 8.2, z - 0.07, x + 1.0, g + 8.35, z + 0.07);
  W.collision.add(x - 0.15, g, z - 0.15, x + 0.15, g + 9, z + 0.15, 'wood', { cover: false });
  return [x, g + 8.4, z];
}

export function wires(W, poles) {
  const pts = [];
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i], b = poles[i + 1];
    for (const off of [-0.9, 0, 0.9]) {
      const n = 10;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        const sag = (t) => -Math.sin(t * Math.PI) * 0.9;
        pts.push(a[0] + off + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0 + sag(t0), a[2] + (b[2] - a[2]) * t0);
        pts.push(a[0] + off + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1 + sag(t1), a[2] + (b[2] - a[2]) * t1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.7 }));
  W.group.add(line);
}

export function fence(W, x0, z0, x1, z1, h = 2.2) {
  // Chain-link: posts + rails + see-through mesh; bullets pass through.
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 3));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
    const g = W.h(x, z);
    W.deco('darkMetal', x - 0.04, g, z - 0.04, x + 0.04, g + h, z + 0.04);
  }
  const g = Math.min(W.h(x0, z0), W.h(x1, z1));
  const minx = Math.min(x0, x1), maxx = Math.max(x0, x1), minz = Math.min(z0, z1), maxz = Math.max(z0, z1);
  W.deco('darkMetal', minx - 0.02, g + h - 0.05, minz - 0.02, maxx + 0.02, g + h, maxz + 0.02);
  W.fenceSegs = W.fenceSegs || [];
  W.fenceSegs.push([x0, z0, x1, z1, g, h]);
  W.collision.add(minx - 0.05, g - 0.5, minz - 0.05, maxx + 0.05, g + h, maxz + 0.05, 'metal', { noBullet: true, cover: false });
}

export function buildFenceMesh(W) {
  if (!W.fenceSegs) return;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(160,165,165,1)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(64, 64); ctx.moveTo(64, 0); ctx.lineTo(0, 64); ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 });
  const P = [], UV = [];
  for (const [x0, z0, x1, z1, g, h] of W.fenceSegs) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const quad = [[x0, g, z0, 0, 0], [x1, g, z1, len, 0], [x1, g + h, z1, len, h], [x0, g + h, z0, 0, h]];
    for (const k of [0, 1, 2, 0, 2, 3]) { P.push(quad[k][0], quad[k][1], quad[k][2]); UV.push(quad[k][3] / 0.5, quad[k][4] / 0.5); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.computeVertexNormals();
  W.group.add(new THREE.Mesh(geo, mat));
}

export function stall(W, x, z, axis = 'x', tint = [0.7, 0.2, 0.15]) {
  const g = W.h(x, z);
  const hx = axis === 'x' ? 1.4 : 0.8, hz = axis === 'x' ? 0.8 : 1.4;
  for (const a of [-1, 1]) for (const b of [-1, 1]) W.deco('woodDark', x + a * hx - 0.05, g, z + b * hz - 0.05, x + a * hx + 0.05, g + 2.3, z + b * hz + 0.05);
  W.solid('wood', x - hx, g + 0.8, z - hz, x + hx, g + 0.95, z + hz, { cover: false });
  W.solid('woodDark', x - hx, g, z - hz, x + hx, g + 0.8, z + hz);
  W.deco('cloth', x - hx - 0.2, g + 2.3, z - hz - 0.2, x + hx + 0.2, g + 2.4, z + hz + 0.2, { tint });
  // produce (apricots / pomegranates)
  for (let i = 0; i < 6; i++) {
    const px = x + (W.rng() - 0.5) * hx * 1.6, pz = z + (W.rng() - 0.5) * hz * 1.6;
    W.deco('carPaint', px - 0.15, g + 0.95, pz - 0.15, px + 0.15, g + 1.1, pz + 0.15, { tint: W.rng() < 0.5 ? [0.9, 0.5, 0.1] : [0.6, 0.05, 0.08] });
  }
}

export function bench(W, x, z, axis = 'x') {
  const g = W.h(x, z);
  const hx = axis === 'x' ? 0.9 : 0.25, hz = axis === 'x' ? 0.25 : 0.9;
  W.solid('wood', x - hx, g + 0.42, z - hz, x + hx, g + 0.5, z + hz, { cover: false });
  W.deco('darkMetal', x - hx, g, z - hz, x - hx + 0.08, g + 0.42, z + hz);
  W.deco('darkMetal', x + hx - 0.08, g, z - hz, x + hx, g + 0.42, z + hz);
}

export function tires(W, x, z, n = 3) {
  const g = W.h(x, z);
  for (let i = 0; i < n; i++) W.mesh('rubber', tireGeo, x, g + 0.14 + i * 0.27, z, 0, 1, 1.2, 1);
  W.collision.add(x - 0.5, g, z - 0.5, x + 0.5, g + n * 0.27, z + 0.5, 'dirt');
}

export function dumpster(W, x, z, axis = 'x') {
  const g = W.h(x, z);
  const hx = axis === 'x' ? 1.0 : 0.7, hz = axis === 'x' ? 0.7 : 1.0;
  W.solid('cGreen', x - hx, g + 0.15, z - hz, x + hx, g + 1.3, z + hz, { uv: 1.5 });
  W.deco('darkMetal', x - hx - 0.05, g + 1.3, z - hz - 0.05, x + hx + 0.05, g + 1.38, z + hz + 0.05);
}

export function rockMesh(W, x, z, s, sy = 0.7, collide = true) {
  const g = W.h(x, z);
  const geo = W.rockGeos[Math.floor(W.rng() * W.rockGeos.length)];
  const ry = W.rng() * Math.PI * 2;
  W.mesh('rock', geo, x, g + s * sy * 0.35, z, ry, s, s * sy, s, 0.8 + W.rng() * 0.3);
  if (collide) {
    const r = s * 0.62;
    W.collision.add(x - r, g - 1, z - r, x + r, g + s * sy * 1.1, z + r, 'stone');
  }
}

export function sign(W, text, x, y, z, ry, w = 3, h = 0.75, opts = {}) {
  const tex = signTexture(text, opts);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = false; m.receiveShadow = true;
  W.group.add(m);
  return m;
}

let khTex = null;
export function khachkar(W, x, z, ry = 0) {
  const g = W.h(x, z);
  if (!khTex) khTex = khachkarTexture();
  const front = new THREE.MeshStandardMaterial({ map: khTex, roughness: 0.95 });
  const side = new THREE.MeshStandardMaterial({ color: 0x6f5e52, roughness: 0.95 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.24), [side, side, side, side, front, front]);
  m.position.set(x, g + 0.35 + 0.9, z);
  m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  W.group.add(m);
  W.solid('basalt', x - 0.7, g - 0.3, z - 0.45, x + 0.7, g + 0.35, z + 0.45);
  const ax = Math.abs(Math.cos(ry)) > 0.5;
  W.collision.add(x - (ax ? 0.5 : 0.14), g, z - (ax ? 0.14 : 0.5), x + (ax ? 0.5 : 0.14), g + 2.15, z + (ax ? 0.14 : 0.5), 'stone');
}

export function laundry(W, x0, z0, x1, z1, y) {
  const pts = [x0, y, z0, x1, y, z1];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  W.group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x222222 })));
  const n = 4 + Math.floor(W.rng() * 4);
  const palette = [[0.9, 0.9, 0.85], [0.7, 0.15, 0.15], [0.2, 0.35, 0.65], [0.85, 0.6, 0.2], [0.4, 0.55, 0.35]];
  const len = Math.hypot(x1 - x0, z1 - z0);
  const plane = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5 + (W.rng() - 0.5) * 0.4) / n;
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    const w = 0.4 + W.rng() * 0.5, h = 0.5 + W.rng() * 0.5;
    const ry = Math.atan2(-(z1 - z0), x1 - x0);
    _q.setFromAxisAngle(UP, ry);
    _m.compose(_v.set(x, y - h / 2, z), _q, _s.set(w, h, 1));
    W.meshM('cloth', plane, _m, palette[Math.floor(W.rng() * palette.length)]);
  }
  void len;
}

export function waterTower(W, x, z) {
  const g = W.h(x, z);
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    W.solid('darkMetal', x + a * 2 - 0.15, g, z + b * 2 - 0.15, x + a * 2 + 0.15, g + 9, z + b * 2 + 0.15, { cover: false });
  }
  const tank = new THREE.CylinderGeometry(3, 3, 4, 16);
  W.mesh('metalW', tank, x, g + 11, z, 0);
  const roof = new THREE.ConeGeometry(3.2, 1.4, 16);
  W.mesh('roofTin', roof, x, g + 13.7, z, 0);
  W.collision.add(x - 2.6, g + 9, z - 2.6, x + 2.6, g + 13, z + 2.6, 'metal');
  W.deco('darkMetal', x - 2.3, g + 8.9, z - 2.3, x + 2.3, g + 9.05, z + 2.3);
}

export function chimney(W, x, z, h = 30) {
  const g = W.h(x, z);
  const geo = new THREE.CylinderGeometry(1.1, 1.8, h, 14, 1, true);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * h / 2.5);
  W.mesh('brick', geo, x, g + h / 2, z, 0);
  for (const y of [h * 0.6, h - 1]) {
    const ring = new THREE.CylinderGeometry(1.25, 1.25, 0.6, 14);
    W.mesh('paintWhite', ring, x, g + y, z, 0);
  }
  W.collision.add(x - 1.4, g, z - 1.4, x + 1.4, g + h, z + 1.4, 'stone');
}
