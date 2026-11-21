// GeoBuilder: merges many small primitives into one vertex-coloured BufferGeometry.
// Used for static city chunks (1 draw call per chunk) and for per-vehicle models.
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

// Shared non-indexed base primitives (flat normals).
export const BASE = {
  box: new THREE.BoxGeometry(1, 1, 1).toNonIndexed(),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6).toNonIndexed(),
  cyl10: new THREE.CylinderGeometry(0.5, 0.5, 1, 10).toNonIndexed(),
  cone4: (() => { const g = new THREE.ConeGeometry(0.7071, 1, 4).toNonIndexed(); g.rotateY(Math.PI / 4); g.computeVertexNormals(); return g; })(),
  cone8: new THREE.ConeGeometry(0.5, 1, 8).toNonIndexed(),
  plane: (() => { const g = new THREE.PlaneGeometry(1, 1).toNonIndexed(); g.rotateX(-Math.PI / 2); return g; })(),
  sphere: new THREE.IcosahedronGeometry(0.5, 0),
};
BASE.cone8.computeVertexNormals();

export class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; }
  get empty() { return this.pos.length === 0; }

  /**
   * @param geo non-indexed geometry
   * @param m Matrix4 transform
   * @param color THREE.Color (linear)
   * @param uvMode 'none' | 'geo' | 'world' (world-space UVs for window textures)
   */
  add(geo, m, color, uvMode = 'none') {
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
    _nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(m);
      _n.fromBufferAttribute(n, i).applyMatrix3(_nm).normalize();
      this.pos.push(_v.x, _v.y, _v.z);
      this.nor.push(_n.x, _n.y, _n.z);
      if (uvMode === 'world') {
        if (Math.abs(_n.y) > 0.5) this.uv.push(0.02, 0.02);
        else if (Math.abs(_n.x) > Math.abs(_n.z)) this.uv.push(_v.z / 12, _v.y / 16);
        else this.uv.push(_v.x / 12, _v.y / 16);
      } else if (uvMode === 'geo' && uv) this.uv.push(uv.getX(i), uv.getY(i));
      else this.uv.push(0.02, 0.02);
      this.col.push(color.r, color.g, color.b);
    }
  }

  /** Box centred at (x,y,z) with size (w,h,d) and optional rotation (rx,ry,rz). */
  box(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0, uvMode = 'none') {
    return this.prim(BASE.box, w, h, d, x, y, z, color, ry, rx, rz, uvMode);
  }

  prim(geo, sx, sy, sz, x, y, z, color, ry = 0, rx = 0, rz = 0, uvMode = 'none') {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    this.add(geo, _m, color, uvMode);
    return this;
  }

  /** Append another builder's data, transformed by a matrix. */
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Splits static geometry into spatial chunks so the GPU can frustum-cull them. */
export class ChunkedBuilder {
  constructor(chunkSize = 150) { this.size = chunkSize; this.chunks = new Map(); }
  at(x, z) {
    const k = Math.floor(x / this.size) + ',' + Math.floor(z / this.size);
    let b = this.chunks.get(k);
    if (!b) { b = new GeoBuilder(); this.chunks.set(k, b); }
    return b;
  }
  box(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0, uvMode = 'none') {
    return this.at(x, z).box(w, h, d, x, y, z, color, ry, rx, rz, uvMode);
  }
  prim(geo, sx, sy, sz, x, y, z, color, ry = 0, rx = 0, rz = 0, uvMode = 'none') {
    return this.at(x, z).prim(geo, sx, sy, sz, x, y, z, color, ry, rx, rz, uvMode);
  }
  /** Creates one Mesh per chunk and adds them to parent. */
  toMeshes(material, parent, { cast = false, receive = false, renderOrder = 0 } = {}) {
    const meshes = [];
    for (const b of this.chunks.values()) {
      if (b.empty) continue;
      const mesh = new THREE.Mesh(b.build(), material);
      mesh.castShadow = cast; mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      mesh.renderOrder = renderOrder;
      parent.add(mesh); meshes.push(mesh);
    }
    return meshes;
  }
}

const _colorCache = new Map();
/** Cached THREE.Color from hex/string (converted to linear working space). */
export function col(c) {
  let v = _colorCache.get(c);
  if (!v) { v = new THREE.Color(c); _colorCache.set(c, v); }
  return v;
}
