// GPU-friendly crowd rendering: every body part of every NPC is one InstancedMesh
// (5 draw calls total for all pedestrians and police officers on foot).
import * as THREE from 'three';

const _base = new THREE.Matrix4(), _loc = new THREE.Matrix4(), _m = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _c = new THREE.Color();

function hanging(w, h, d) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, -h / 2, 0); return g; }

export class CrowdRenderer {
  constructor(scene, capacity = 48) {
    this.capacity = capacity;
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const mk = (geo, count) => {
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = true;
      for (let i = 0; i < count; i++) { m.setMatrixAt(i, _zero); m.setColorAt(i, _c.set('#ffffff')); }
      scene.add(m);
      return m;
    };
    this.torso = mk(new THREE.BoxGeometry(0.52, 0.62, 0.3), capacity);
    this.head = mk(new THREE.BoxGeometry(0.32, 0.34, 0.32), capacity);
    this.hair = mk(new THREE.BoxGeometry(0.35, 0.12, 0.35), capacity);
    this.arms = mk(hanging(0.15, 0.62, 0.15), capacity * 2);
    this.legs = mk(hanging(0.2, 0.9, 0.22), capacity * 2);
    this.free = [];
    for (let i = capacity - 1; i >= 0; i--) this.free.push(i);
    this.dirty = true;
  }

  alloc(colors) {
    const k = this.free.pop();
    if (k === undefined) return -1;
    this.setColors(k, colors);
    return k;
  }
  release(k) { if (k < 0) return; this.hide(k); this.free.push(k); }

  setColors(k, { shirt, pants, skin, hair }) {
    this.torso.setColorAt(k, _c.set(shirt));
    this.head.setColorAt(k, _c.set(skin));
    this.hair.setColorAt(k, _c.set(hair));
    this.arms.setColorAt(k * 2, _c.set(skin)); this.arms.setColorAt(k * 2 + 1, _c.set(skin));
    this.legs.setColorAt(k * 2, _c.set(pants)); this.legs.setColorAt(k * 2 + 1, _c.set(pants));
    for (const m of [this.torso, this.head, this.hair, this.arms, this.legs]) m.instanceColor.needsUpdate = true;
  }

  hide(k) {
    this.torso.setMatrixAt(k, _zero); this.head.setMatrixAt(k, _zero); this.hair.setMatrixAt(k, _zero);
    this.arms.setMatrixAt(k * 2, _zero); this.arms.setMatrixAt(k * 2 + 1, _zero);
    this.legs.setMatrixAt(k * 2, _zero); this.legs.setMatrixAt(k * 2 + 1, _zero);
    this.dirty = true;
  }

  /** pose: swing (radians, legs/arms), lie (0..1 fall over), armUp (aiming) */
  set(k, x, y, z, heading, swing = 0, lie = 0, armUp = 0) {
    _q.setFromAxisAngle(_up, heading);
    _base.compose(_p.set(x, y, z), _q, _s);
    if (lie > 0) {
      _m.makeRotationX(-lie * Math.PI / 2);
      _loc.makeTranslation(0, 0.18 * lie, 0);
      _base.multiply(_loc).multiply(_m);
    }
    const put = (mesh, idx, lx, ly, lz, rx = 0) => {
      _loc.makeRotationX(rx); _loc.setPosition(lx, ly, lz);
      _m.multiplyMatrices(_base, _loc);
      mesh.setMatrixAt(idx, _m);
    };
    put(this.torso, k, 0, 1.22, 0);
    put(this.head, k, 0, 1.72, 0);
    put(this.hair, k, 0, 1.92, 0);
    put(this.arms, k * 2, 0.35, 1.5, 0, -swing * 0.8);
    put(this.arms, k * 2 + 1, -0.35, 1.5, 0, armUp ? -Math.PI / 2 : swing * 0.8);
    put(this.legs, k * 2, 0.13, 0.9, 0, swing);
    put(this.legs, k * 2 + 1, -0.13, 0.9, 0, -swing);
    this.dirty = true;
  }

  commit() {
    if (!this.dirty) return;
    for (const m of [this.torso, this.head, this.hair, this.arms, this.legs]) m.instanceMatrix.needsUpdate = true;
    this.dirty = false;
  }
}
