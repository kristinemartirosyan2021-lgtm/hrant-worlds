// Helpers to build compact multi-part models with few draw calls.
import * as THREE from 'three';

const matCache = new Map();
export function stdMat(color, rough = 0.8, metal = 0, extra = {}) {
  const key = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
    matCache.set(key, m);
  }
  return m;
}

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylZ: new THREE.CylinderGeometry(0.5, 0.5, 1, 10).rotateX(Math.PI / 2),
  cylY: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  sphere: new THREE.SphereGeometry(0.5, 14, 10),
  hemi: new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 4, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 10),
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// Collects parts and emits one merged mesh per material.
export class PartSet {
  constructor() { this.parts = new Map(); }
  add(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(_m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return this;
  }
  box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) { return this.add(GEO.box, mat, x, y, z, w, h, d, rx, ry, rz); }
  build(parent, shadow = true) {
    const meshes = [];
    for (const [mat, geos] of this.parts) {
      const geo = mergeGeos(geos);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.parts.clear();
    return meshes;
  }
}

export function mergeGeos(geos) {
  let count = 0;
  for (const g of geos) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  let o = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nrm.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
