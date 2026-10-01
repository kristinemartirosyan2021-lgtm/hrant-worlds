// Instanced vegetation: oaks, pines, poplars, bushes and wind-swayed grass.
import * as THREE from 'three';
import { grassBladeTexture } from './Textures.js';
import { FLAT_ZONES } from './Terrain.js';

function merge(geos) {
  const pos = [], nrm = [], uv = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    g.computeVertexNormals();
    pos.push(...g.attributes.position.array);
    nrm.push(...g.attributes.normal.array);
    if (g.attributes.uv) uv.push(...g.attributes.uv.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  if (uv.length === (pos.length / 3) * 2) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

function windify(mat, strength, uniforms) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
       float ph = instanceMatrix[3].x * 0.27 + instanceMatrix[3].z * 0.31;
       #else
       float ph = 0.0;
       #endif
       float sway = sin(uTime * 1.4 + ph) * 0.6 + sin(uTime * 2.7 + ph * 1.7) * 0.4;
       transformed.x += sway * ${strength.toFixed(3)} * max(0.0, position.y);
       transformed.z += cos(uTime * 1.1 + ph) * ${(strength * 0.6).toFixed(3)} * max(0.0, position.y);`,
    );
  };
  return mat;
}

export class Vegetation {
  constructor(world) {
    this.W = world;
    this.uniforms = { uTime: { value: 0 } };
    this.trees = [];
  }

  blocked(x, z, r = 1.2) {
    const W = this.W;
    if (Math.abs(x) > 158 || Math.abs(z) > 158) return true;
    if (Math.abs(x) < 9 && Math.abs(z) > 24) return true;               // N-S road
    if (Math.abs(z + 36) < 9) return true;                              // E-W road
    if (Math.abs(x) < 30 && Math.abs(z) < 30) return true;              // fort
    const boxes = W.collision.query(x - r, z - r, x + r, z + r);
    for (const b of boxes) if (b.max[1] > W.h(x, z) + 0.2) return true;
    return false;
  }

  inFlat(x, z, pad = 0) {
    for (const [cx, cz, hw, hd] of FLAT_ZONES) {
      if (hw < 10 || hd < 10) continue;
      if (Math.abs(x - cx) < hw + pad && Math.abs(z - cz) < hd + pad) return true;
    }
    return false;
  }

  build() {
    const W = this.W;
    const r = W.rng;
    const pts = { oak: [], pine: [], poplar: [], bush: [] };
    const tryAdd = (type, x, z, s) => {
      if (this.blocked(x, z, type === 'bush' ? 0.8 : 1.6)) return false;
      if (W.terrain.slope(x, z) > 0.9) return false;
      for (const t of this.trees) { const dx = t.x - x, dz = t.z - z; if (dx * dx + dz * dz < 4) return false; }
      pts[type].push({ x, z, s, y: W.h(x, z) });
      if (type !== 'bush') {
        this.trees.push({ x, z });
        const g = W.h(x, z);
        const tr = type === 'pine' ? 0.28 : 0.32;
        W.collision.add(x - tr, g - 0.5, z - tr, x + tr, g + 4.5 * s, z + tr, 'wood');
      }
      return true;
    };
    // Forest (south-west): dense oak + pine.
    for (let i = 0; i < 1800 && pts.pine.length + pts.oak.length < 300; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 75;
      const x = -105 + Math.cos(a) * d * 1.05, z = 95 + Math.sin(a) * d;
      if (Math.abs(x + 105) < 9 && Math.abs(z - 95) < 9) continue;
      tryAdd(r() < 0.55 ? 'pine' : 'oak', x, z, 0.8 + r() * 0.6);
    }
    // Hills: sparse.
    for (let i = 0; i < 300 && i < 300; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 70;
      const x = 105 + Math.cos(a) * d, z = 98 + Math.sin(a) * d;
      if (r() < 0.22) tryAdd(r() < 0.5 ? 'oak' : 'pine', x, z, 0.7 + r() * 0.5);
    }
    // Town & industry yards (apricot / mulberry style oaks).
    for (let i = 0; i < 260; i++) {
      const x = -150 + r() * 118, z = -138 + r() * 96;
      if (Math.abs(z + 88) < 6 || Math.abs(x + 92) < 6) continue;
      if (x > -110 && x < -74 && z > -106 && z < -70) { if (r() < 0.7) continue; }
      if (r() < 0.18) tryAdd('oak', x, z, 0.65 + r() * 0.3);
    }
    // Poplar rows along the roads (very characteristic for the region).
    for (let z = -160; z < 160; z += 8.5) {
      if (Math.abs(z) < 32 || (z > 70 && z < 130)) continue;
      if (r() < 0.8) tryAdd('poplar', -10.5, z + r(), 0.9 + r() * 0.3);
      if (r() < 0.8) tryAdd('poplar', 10.5, z + r(), 0.9 + r() * 0.3);
    }
    for (let x = -160; x < 160; x += 9) {
      if (Math.abs(x) < 14) continue;
      if (r() < 0.6) tryAdd('poplar', x + r(), -27, 0.9 + r() * 0.3);
    }
    // Fields: scattered trees and bushes.
    for (let i = 0; i < 500; i++) {
      const x = -155 + r() * 310, z = -155 + r() * 310;
      if (this.inFlat(x, z, 4)) continue;
      const v = r();
      if (v < 0.08) tryAdd('oak', x, z, 0.8 + r() * 0.5);
      else if (v < 0.4) tryAdd('bush', x, z, 0.6 + r() * 0.7);
    }
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 75;
      tryAdd('bush', -105 + Math.cos(a) * d, 95 + Math.sin(a) * d, 0.6 + r() * 0.6);
    }
    this.makeMeshes(pts);
    this.makeGrass();
  }

  makeMeshes(pts) {
    const W = this.W;
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 1, 7).translate(0, 0.5, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 });
    const oakCrown = merge([
      new THREE.IcosahedronGeometry(1.7, 1).translate(0, 4.4, 0),
      new THREE.IcosahedronGeometry(1.3, 1).translate(1.0, 3.8, 0.4),
      new THREE.IcosahedronGeometry(1.2, 1).translate(-0.9, 4.0, -0.5),
      new THREE.IcosahedronGeometry(1.1, 1).translate(0.2, 5.3, -0.3),
    ]);
    const pineCrown = merge([
      new THREE.ConeGeometry(1.9, 3.0, 8).translate(0, 3.0, 0),
      new THREE.ConeGeometry(1.5, 2.6, 8).translate(0, 4.6, 0),
      new THREE.ConeGeometry(1.0, 2.2, 8).translate(0, 6.0, 0),
    ]);
    const poplarCrown = new THREE.IcosahedronGeometry(1, 1).scale(1.1, 4.2, 1.1).translate(0, 6.2, 0);
    const bushGeo = new THREE.IcosahedronGeometry(1, 1).scale(1.2, 0.75, 1.2).translate(0, 0.45, 0);
    const leafMat = windify(new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), 0.012, this.uniforms);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const palettes = {
      oak: ['#5e6b2c', '#6f7a30', '#8a7a2a', '#a7742a', '#4f5f2a', '#7c8a3a'],
      pine: ['#2f4a2c', '#36502e', '#3e5a33', '#2a4228'],
      poplar: ['#7a8a34', '#a19032', '#c4a03a', '#6a7d30'],
      bush: ['#556328', '#6b7330', '#7e7a35', '#4c5a26'],
    };
    const build = (list, geo, type, trunkH, trunkS) => {
      if (!list.length) return;
      const crown = new THREE.InstancedMesh(geo, leafMat, list.length);
      crown.castShadow = true; crown.receiveShadow = true;
      let trunk = null;
      if (trunkH) {
        trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length);
        trunk.castShadow = true; trunk.receiveShadow = true;
      }
      list.forEach((t, i) => {
        q.setFromAxisAngle(up, W.rng() * Math.PI * 2);
        m4.compose(p.set(t.x, t.y - 0.2, t.z), q, s.set(t.s, t.s * (0.9 + W.rng() * 0.25), t.s));
        crown.setMatrixAt(i, m4);
        const pal = palettes[type];
        col.set(pal[Math.floor(W.rng() * pal.length)]).offsetHSL(0, 0, (W.rng() - 0.5) * 0.06);
        crown.setColorAt(i, col);
        if (trunk) {
          m4.compose(p.set(t.x, t.y - 0.3, t.z), q, s.set(t.s * trunkS, t.s * trunkH, t.s * trunkS));
          trunk.setMatrixAt(i, m4);
        }
      });
      crown.instanceMatrix.needsUpdate = true;
      W.group.add(crown);
      if (trunk) W.group.add(trunk);
    };
    build(pts.oak, oakCrown, 'oak', 3.8, 1.1);
    build(pts.pine, pineCrown, 'pine', 2.4, 0.8);
    build(pts.poplar, poplarCrown, 'poplar', 3.2, 0.7);
    build(pts.bush, bushGeo, 'bush', 0, 0);
  }

  makeGrass() {
    const W = this.W;
    const tex = grassBladeTexture();
    const geo = merge([
      new THREE.PlaneGeometry(1.1, 0.7).translate(0, 0.35, 0),
      new THREE.PlaneGeometry(1.1, 0.7).translate(0, 0.35, 0).rotateY(Math.PI / 3),
      new THREE.PlaneGeometry(1.1, 0.7).translate(0, 0.35, 0).rotateY(-Math.PI / 3),
    ]);
    // Normals pointing up make grass lit like the ground.
    const n = geo.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    const mat = windify(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 }), 0.25, this.uniforms);
    const COUNT = 9000;
    const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    let i = 0;
    const r = W.rng;
    for (let k = 0; k < COUNT * 3 && i < COUNT; k++) {
      const x = -158 + r() * 316, z = -158 + r() * 316;
      if (this.inFlat(x, z, -2) && r() < 0.85) continue;
      if (Math.abs(x) < 7 && Math.abs(z) > 24) continue;
      if (Math.abs(z + 36) < 7) continue;
      const y = W.h(x, z);
      if (y > 26) continue;
      q.setFromAxisAngle(up, r() * Math.PI);
      const sc = 0.7 + r() * 0.9;
      m4.compose(p.set(x, y - 0.05, z), q, s.set(sc, sc * (0.7 + r() * 0.6), sc));
      mesh.setMatrixAt(i, m4);
      col.setHSL(0.13 + r() * 0.06, 0.45, 0.42 + r() * 0.16);
      mesh.setColorAt(i, col);
      i++;
    }
    mesh.count = i;
    mesh.receiveShadow = true;
    W.group.add(mesh);
  }

  update(dt) {
    this.uniforms.uTime.value += dt;
  }
}
