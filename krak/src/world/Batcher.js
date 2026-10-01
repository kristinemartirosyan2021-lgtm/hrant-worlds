// Static geometry batcher: collects boxes / arbitrary meshes per material and
// merges them into a single draw call each. Boxes use world-space UVs so
// textures tile continuously without stretching.
import * as THREE from 'three';

class Bucket {
  constructor(material) {
    this.material = material;
    this.pos = []; this.nrm = []; this.uv = []; this.col = [];
  }
}

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m3 = new THREE.Matrix3();

export class Batcher {
  constructor() {
    this.buckets = new Map();
  }

  bucket(key, material) {
    let b = this.buckets.get(key);
    if (!b) { b = new Bucket(material); this.buckets.set(key, b); }
    return b;
  }

  // Axis-aligned box with world-space UVs (scale = metres per texture repeat).
  box(key, material, minx, miny, minz, maxx, maxy, maxz, uvScale = 3, tint = 1) {
    const b = this.bucket(key, material);
    const s = 1 / uvScale;
    const [tr, tg, tb] = Array.isArray(tint) ? tint : [tint, tint, tint];
    const quad = (p0, p1, p2, p3, n, uvs) => {
      // two triangles p0 p1 p2, p0 p2 p3
      const order = [0, 1, 2, 0, 2, 3];
      const P = [p0, p1, p2, p3];
      for (const k of order) {
        b.pos.push(P[k][0], P[k][1], P[k][2]);
        b.nrm.push(n[0], n[1], n[2]);
        b.uv.push(uvs[k][0] * s, uvs[k][1] * s);
        b.col.push(tr, tg, tb);
      }
    };
    const x0 = minx, x1 = maxx, y0 = miny, y1 = maxy, z0 = minz, z1 = maxz;
    // +X
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[-z1, y0], [-z0, y0], [-z0, y1], [-z1, y1]]);
    // -X
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[z0, y0], [z1, y0], [z1, y1], [z0, y1]]);
    // +Y
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [[x0, -z1], [x1, -z1], [x1, -z0], [x0, -z0]]);
    // -Y
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
    // +Z
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
    // -Z
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[-x1, y0], [-x0, y0], [-x0, y1], [-x1, y1]]);
  }

  // Arbitrary BufferGeometry transformed by a matrix.
  geometry(key, material, geo, matrix, tint = 1) {
    const b = this.bucket(key, material);
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    _m3.getNormalMatrix(matrix);
    const [tr, tg, tb] = Array.isArray(tint) ? tint : [tint, tint, tint];
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      b.pos.push(_v.x, _v.y, _v.z);
      _n.fromBufferAttribute(n, i).applyMatrix3(_m3).normalize();
      b.nrm.push(_n.x, _n.y, _n.z);
      if (uv) b.uv.push(uv.getX(i), uv.getY(i)); else b.uv.push(0, 0);
      b.col.push(tr, tg, tb);
    }
  }

  build(parent, { castShadow = true, receiveShadow = true } = {}) {
    const meshes = [];
    for (const [key, b] of this.buckets) {
      if (!b.pos.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, b.material);
      mesh.name = 'batch:' + key;
      mesh.castShadow = castShadow && !b.material.userData.noShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.buckets.clear();
    return meshes;
  }
}
