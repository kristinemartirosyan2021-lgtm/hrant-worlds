// Pooled visual effects: GPU-point particles, muzzle flashes, tracers, shells, decals, explosions.
import * as THREE from 'three';
import { softDotTexture, flashTexture, decalTexture } from '../world/Textures.js';
import { rand } from '../core/util.js';

class ParticleSystem {
  constructor(scene, cap, additive, tex) {
    this.cap = cap;
    this.n = 0;
    this.P = new Float32Array(cap * 3);
    this.V = new Float32Array(cap * 3);
    this.L = new Float32Array(cap * 2);     // life, maxLife
    this.S = new Float32Array(cap * 2);     // size0, size1
    this.C = new Float32Array(cap * 4);     // rgb, alpha0
    this.D = new Float32Array(cap * 2);     // drag, gravity
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4);
    this.size = new Float32Array(cap);
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('color', this.aCol);
    geo.setAttribute('size', this.aSize);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.uniforms = { map: { value: tex }, scale: { value: 600 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC;
        void main(){ float a = texture2D(map, gl_PointCoord).a * vC.a; if (a < 0.003) discard; gl_FragColor = vec4(vC.rgb * ${additive ? 'a' : '1.0'}, ${additive ? '1.0' : 'a'}); }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, drag = 1, grav = 0) {
    let i = this.n;
    if (i >= this.cap) i = Math.floor(Math.random() * this.cap); else this.n++;
    this.P[i * 3] = x; this.P[i * 3 + 1] = y; this.P[i * 3 + 2] = z;
    this.V[i * 3] = vx; this.V[i * 3 + 1] = vy; this.V[i * 3 + 2] = vz;
    this.L[i * 2] = life; this.L[i * 2 + 1] = life;
    this.S[i * 2] = s0; this.S[i * 2 + 1] = s1;
    this.C[i * 4] = r; this.C[i * 4 + 1] = g; this.C[i * 4 + 2] = b; this.C[i * 4 + 3] = a;
    this.D[i * 2] = drag; this.D[i * 2 + 1] = grav;
  }

  update(dt) {
    const { P, V, L, S, C, D } = this;
    let i = 0;
    while (i < this.n) {
      L[i * 2] -= dt;
      if (L[i * 2] <= 0) {
        // swap-remove
        const j = --this.n;
        if (j !== i) {
          for (let k = 0; k < 3; k++) { P[i * 3 + k] = P[j * 3 + k]; V[i * 3 + k] = V[j * 3 + k]; }
          for (let k = 0; k < 2; k++) { L[i * 2 + k] = L[j * 2 + k]; S[i * 2 + k] = S[j * 2 + k]; D[i * 2 + k] = D[j * 2 + k]; }
          for (let k = 0; k < 4; k++) C[i * 4 + k] = C[j * 4 + k];
        }
        continue;
      }
      const dr = Math.exp(-D[i * 2] * dt);
      V[i * 3] *= dr; V[i * 3 + 1] = V[i * 3 + 1] * dr - D[i * 2 + 1] * dt; V[i * 3 + 2] *= dr;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      const t = 1 - L[i * 2] / L[i * 2 + 1];
      this.pos[i * 3] = P[i * 3]; this.pos[i * 3 + 1] = P[i * 3 + 1]; this.pos[i * 3 + 2] = P[i * 3 + 2];
      this.size[i] = S[i * 2] + (S[i * 2 + 1] - S[i * 2]) * t;
      this.col[i * 4] = C[i * 4]; this.col[i * 4 + 1] = C[i * 4 + 1]; this.col[i * 4 + 2] = C[i * 4 + 2];
      const fadeIn = Math.min(1, t * 8);
      this.col[i * 4 + 3] = C[i * 4 + 3] * (1 - t) * fadeIn;
      i++;
    }
    this.points.geometry.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
  }

  clear() { this.n = 0; }
}

const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Color();

const MAT_COLORS = {
  stone: [0.62, 0.52, 0.45], dirt: [0.45, 0.37, 0.27], metal: [0.55, 0.55, 0.55], wood: [0.5, 0.38, 0.25],
};

export class Effects {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    const dot = softDotTexture();
    this.add = new ParticleSystem(scene, 2500, true, dot);
    this.alpha = new ParticleSystem(scene, 3500, false, dot);

    // Muzzle flash sprites.
    const ftex = flashTexture();
    this.flashes = [];
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffd9a0 }));
      s.visible = false; s.renderOrder = 6;
      scene.add(s);
      this.flashes.push({ s, t: 0 });
    }
    this.flashIdx = 0;
    this.light = new THREE.PointLight(0xffb060, 0, 9, 2);
    scene.add(this.light);
    this.lightT = 0;
    this.boomLight = new THREE.PointLight(0xff8a3a, 0, 40, 2);
    scene.add(this.boomLight);
    this.boomT = 0;

    // Tracers (instanced, additive, faded via instance colour).
    const tg = new THREE.BufferGeometry();
    const w = 0.5;
    tg.setAttribute('position', new THREE.Float32BufferAttribute([
      -w, 0, 0, w, 0, 0, w, 0, 1, -w, 0, 0, w, 0, 1, -w, 0, 1,
      0, -w, 0, 0, w, 0, 0, w, 1, 0, -w, 0, 0, w, 1, 0, -w, 1,
    ], 3));
    this.tracerMesh = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }), 64);
    this.tracerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tracerMesh.frustumCulled = false;
    this.tracerMesh.renderOrder = 6;
    for (let i = 0; i < 64; i++) { this.tracerMesh.setColorAt(i, _c.setRGB(0, 0, 0)); this.tracerMesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); }
    scene.add(this.tracerMesh);
    this.tracers = Array.from({ length: 64 }, () => ({ alive: false, a: new THREE.Vector3(), b: new THREE.Vector3(), head: 0, len: 0, color: new THREE.Color(), width: 0.02 }));
    this.tracerIdx = 0;

    // Shell casings.
    this.shellMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.045, 6).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xc8962e, metalness: 0.9, roughness: 0.3 }), 60);
    this.shellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shellMesh.frustumCulled = false;
    scene.add(this.shellMesh);
    this.shells = Array.from({ length: 60 }, () => ({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), t: 0, floor: 0, s: 1 }));
    for (let i = 0; i < 60; i++) this.shellMesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    this.shellIdx = 0;

    // Bullet hole decals.
    this.decalMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: decalTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, opacity: 0.9 }), 260);
    this.decalMesh.frustumCulled = false;
    for (let i = 0; i < 260; i++) this.decalMesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    scene.add(this.decalMesh);
    this.decalIdx = 0;

    // Shockwave rings.
    this.rings = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffd0a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.visible = false;
      scene.add(m);
      this.rings.push({ m, t: 1 });
    }

    // Ambient dust motes floating around the camera.
    this.motes = [];
    for (let i = 0; i < 160; i++) this.motes.push({ x: rand(-20, 20), y: rand(-4, 10), z: rand(-20, 20), p: rand(0, 6) });
  }

  setScale(px) {
    this.add.uniforms.scale.value = px;
    this.alpha.uniforms.scale.value = px;
  }

  muzzleFlash(pos, dir, local, kind) {
    const f = this.flashes[this.flashIdx++ % this.flashes.length];
    f.s.position.copy(pos).addScaledVector(dir, 0.08);
    const sz = kind === 'shotgun' ? 0.75 : kind === 'sniper' ? 0.8 : kind === 'pistol' ? 0.35 : 0.5;
    f.s.scale.setScalar(sz * rand(0.8, 1.2));
    f.s.material.rotation = Math.random() * Math.PI;
    f.s.visible = true;
    f.t = 0.045;
    if (local || Math.random() < 0.5) {
      this.light.position.copy(pos);
      this.light.intensity = local ? 26 : 14;
      this.lightT = 0.05;
    }
    for (let i = 0; i < 4; i++) {
      this.add.emit(pos.x, pos.y, pos.z, dir.x * rand(2, 6) + rand(-1, 1), dir.y * rand(2, 6) + rand(-1, 1), dir.z * rand(2, 6) + rand(-1, 1),
        rand(0.04, 0.09), 0.08, 0.02, 1, 0.75, 0.35, 1, 4);
    }
    for (let i = 0; i < 2; i++) {
      this.alpha.emit(pos.x, pos.y, pos.z, dir.x * 1.5 + rand(-0.3, 0.3), dir.y * 1.5 + rand(0, 0.5), dir.z * 1.5 + rand(-0.3, 0.3),
        rand(0.4, 0.8), 0.12, 0.6, 0.6, 0.58, 0.55, 0.22, 2.5, -0.4);
    }
  }

  tracer(from, to, color = 0xffd27a, width = 0.022) {
    const t = this.tracers[this.tracerIdx++ % this.tracers.length];
    t.alive = true;
    t.a.copy(from); t.b.copy(to);
    t.len = from.distanceTo(to);
    t.head = Math.min(2, t.len);
    t.color.set(color);
    t.width = width;
  }

  shell(pos, right, size = 1) {
    const s = this.shells[this.shellIdx++ % this.shells.length];
    s.alive = true;
    s.p.copy(pos);
    s.v.copy(right).multiplyScalar(rand(1.5, 2.6)).add(_v.set(rand(-0.3, 0.3), rand(1.4, 2.4), rand(-0.3, 0.3)));
    s.w.set(rand(-20, 20), rand(-20, 20), rand(-20, 20));
    s.r.set(0, 0, 0);
    s.t = 2.2;
    s.s = size;
    s.floor = this.game.world.collision.groundAt(pos.x, pos.z, 0.05, pos.y, 0.0);
  }

  decal(p, n, size = 0.13) {
    const i = this.decalIdx++ % 260;
    _v.copy(p).addScaledVector(n, 0.012);
    _q.setFromUnitVectors(_z, n);
    _m.compose(_v, _q, _s.set(size, size, size));
    this.decalMesh.setMatrixAt(i, _m);
    this.decalMesh.instanceMatrix.needsUpdate = true;
  }

  impact(p, n, mat = 'stone') {
    const c = MAT_COLORS[mat] || MAT_COLORS.stone;
    const k = mat === 'dirt' ? 7 : 5;
    for (let i = 0; i < k; i++) {
      this.alpha.emit(p.x, p.y, p.z,
        n.x * rand(0.8, 2.5) + rand(-0.6, 0.6), n.y * rand(0.8, 2.5) + rand(0, 1.2), n.z * rand(0.8, 2.5) + rand(-0.6, 0.6),
        rand(0.35, 0.9), 0.06, rand(0.35, 0.6), c[0], c[1], c[2], 0.75, 3, 1.5);
    }
    for (let i = 0; i < 4; i++) {
      this.alpha.emit(p.x, p.y, p.z, n.x * rand(2, 5) + rand(-2, 2), n.y * rand(2, 5) + rand(0, 3), n.z * rand(2, 5) + rand(-2, 2),
        rand(0.3, 0.6), 0.03, 0.03, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 1, 0.5, 14);
    }
    if (mat === 'metal' || mat === 'stone') {
      const sc = mat === 'metal' ? 6 : 2;
      for (let i = 0; i < sc; i++) {
        this.add.emit(p.x, p.y, p.z, n.x * rand(2, 7) + rand(-3, 3), n.y * rand(2, 7) + rand(0, 3), n.z * rand(2, 7) + rand(-3, 3),
          rand(0.1, 0.3), 0.04, 0.01, 1, 0.7, 0.3, 1, 1, 9);
      }
    }
    if (mat !== 'dirt') this.decal(p, n);
  }

  blood(p, dir, head = false) {
    const k = head ? 14 : 8;
    for (let i = 0; i < k; i++) {
      this.alpha.emit(p.x, p.y, p.z,
        dir.x * rand(0.5, 3) + rand(-0.8, 0.8), dir.y * rand(0.5, 3) + rand(-0.2, 1.5), dir.z * rand(0.5, 3) + rand(-0.8, 0.8),
        rand(0.25, 0.55), 0.07, rand(0.2, 0.4), 0.42, 0.03, 0.04, 0.85, 3, 6);
    }
    this.alpha.emit(p.x, p.y, p.z, dir.x * 0.5, 0.2, dir.z * 0.5, 0.4, 0.15, 0.7, 0.35, 0.04, 0.05, 0.35, 3, 0);
  }

  armorSpark(p, dir) {
    for (let i = 0; i < 6; i++) {
      this.add.emit(p.x, p.y, p.z, -dir.x * rand(1, 4) + rand(-2, 2), rand(0, 3), -dir.z * rand(1, 4) + rand(-2, 2),
        rand(0.08, 0.2), 0.05, 0.01, 0.6, 0.85, 1, 1, 2, 6);
    }
  }

  explosion(p, scale = 1) {
    const s = scale;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.1;
      const sp = rand(3, 11) * s;
      this.add.emit(p.x, p.y + 0.3, p.z, Math.cos(a) * sp * (1 - e * 0.5), e * sp, Math.sin(a) * sp * (1 - e * 0.5),
        rand(0.25, 0.6), rand(0.6, 1.2) * s, rand(1.8, 3.2) * s, 1, rand(0.45, 0.7), 0.2, 1, 3.5, -1);
    }
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = rand(1, 5) * s;
      this.alpha.emit(p.x, p.y + 0.5, p.z, Math.cos(a) * sp, rand(1.5, 5) * s, Math.sin(a) * sp,
        rand(1.6, 3.2), rand(1, 1.8) * s, rand(4, 7) * s, 0.22, 0.2, 0.19, 0.7, 1.3, -0.6);
    }
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, sp = rand(8, 20) * s;
      this.add.emit(p.x, p.y + 0.3, p.z, Math.cos(a) * sp, rand(3, 14) * s, Math.sin(a) * sp,
        rand(0.4, 1.0), 0.08, 0.02, 1, 0.7, 0.3, 1, 0.8, 18);
    }
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, sp = rand(4, 10) * s;
      this.alpha.emit(p.x, p.y + 0.3, p.z, Math.cos(a) * sp, rand(4, 10) * s, Math.sin(a) * sp,
        rand(0.8, 1.4), 0.12, 0.08, 0.15, 0.13, 0.1, 1, 0.5, 20);
    }
    this.boomLight.position.set(p.x, p.y + 1.5, p.z);
    this.boomLight.intensity = 220 * s;
    this.boomT = 0.35;
    const r = this.rings.find((q) => q.t >= 1) || this.rings[0];
    r.t = 0; r.m.visible = true; r.m.position.set(p.x, p.y + 0.15, p.z); r.scale = 7 * s;
  }

  dustPuff(p, n = 6, size = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.alpha.emit(p.x, p.y + 0.05, p.z, Math.cos(a) * rand(0.6, 1.6), rand(0.1, 0.5), Math.sin(a) * rand(0.6, 1.6),
        rand(0.5, 0.9), size * 0.4, size * 1.4, 0.55, 0.47, 0.37, 0.35, 3, -0.2);
    }
  }

  confetti(p, count = 40) {
    const cols = [[1, 0.75, 0.2], [0.9, 0.15, 0.15], [0.2, 0.4, 0.9], [1, 0.55, 0.1]];
    for (let i = 0; i < count; i++) {
      const c = cols[i % cols.length];
      const a = Math.random() * Math.PI * 2;
      this.add.emit(p.x + rand(-3, 3), p.y + rand(2, 6), p.z + rand(-3, 3), Math.cos(a) * rand(0.5, 2), rand(1, 4), Math.sin(a) * rand(0.5, 2),
        rand(1.5, 3), 0.12, 0.08, c[0], c[1], c[2], 1, 1.2, 2.2);
    }
  }

  // Spark trail for grenades in flight.
  trail(p) {
    this.add.emit(p.x, p.y, p.z, rand(-0.3, 0.3), rand(0, 0.4), rand(-0.3, 0.3), 0.25, 0.08, 0.01, 1, 0.6, 0.2, 0.8, 1, 0);
  }

  update(dt, camera) {
    this.add.update(dt);
    this.alpha.update(dt);
    for (const f of this.flashes) if (f.s.visible) { f.t -= dt; if (f.t <= 0) f.s.visible = false; }
    if (this.lightT > 0) { this.lightT -= dt; if (this.lightT <= 0) this.light.intensity = 0; }
    if (this.boomT > 0) { this.boomT -= dt; this.boomLight.intensity *= Math.exp(-10 * dt); if (this.boomT <= 0) this.boomLight.intensity = 0; }
    for (const r of this.rings) {
      if (r.t >= 1) continue;
      r.t = Math.min(1, r.t + dt * 2.8);
      const e = 1 - Math.pow(1 - r.t, 3);
      r.m.scale.setScalar(0.5 + e * r.scale);
      r.m.material.opacity = (1 - r.t) * 0.7;
      if (r.t >= 1) r.m.visible = false;
    }
    // tracers
    const tm = this.tracerMesh;
    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (!t.alive) continue;
      t.head += dt * 420;
      const tail = Math.max(0, t.head - 7);
      if (tail >= t.len) {
        t.alive = false;
        tm.setMatrixAt(i, _m.makeScale(0, 0, 0));
        tm.setColorAt(i, _c.setRGB(0, 0, 0));
        continue;
      }
      const head = Math.min(t.head, t.len);
      _v.subVectors(t.b, t.a).normalize();
      _q.setFromUnitVectors(_z, _v);
      const start = _s.copy(t.a).addScaledVector(_v, tail);
      const dist = start.distanceTo(camera.position);
      const w = t.width * Math.max(1, dist * 0.05);
      _m.compose(start, _q, new THREE.Vector3(w, w, Math.max(0.01, head - tail)));
      tm.setMatrixAt(i, _m);
      tm.setColorAt(i, _c.copy(t.color).multiplyScalar(1.6));
    }
    tm.instanceMatrix.needsUpdate = true;
    if (tm.instanceColor) tm.instanceColor.needsUpdate = true;
    // shells
    const sm = this.shellMesh;
    for (let i = 0; i < this.shells.length; i++) {
      const s = this.shells[i];
      if (!s.alive) continue;
      s.t -= dt;
      if (s.t <= 0) { s.alive = false; sm.setMatrixAt(i, _m.makeScale(0, 0, 0)); continue; }
      s.v.y -= 15 * dt;
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < s.floor + 0.01) {
        s.p.y = s.floor + 0.01;
        if (Math.abs(s.v.y) > 1.2 && s.bounced !== true) { s.bounced = true; }
        s.v.y = Math.abs(s.v.y) * 0.3; s.v.x *= 0.5; s.v.z *= 0.5; s.w.multiplyScalar(0.5);
      }
      s.r.x += s.w.x * dt; s.r.y += s.w.y * dt; s.r.z += s.w.z * dt;
      _q.setFromEuler(s.r);
      const sc = s.s * Math.min(1, s.t * 3);
      _m.compose(s.p, _q, _s.set(sc, sc, sc));
      sm.setMatrixAt(i, _m);
    }
    sm.instanceMatrix.needsUpdate = true;
    // ambient motes
    const cp = camera.position;
    for (const m of this.motes) {
      m.p += dt;
      m.x += Math.sin(m.p * 0.7) * dt * 0.3 + dt * 0.25;
      m.y += Math.cos(m.p * 0.5) * dt * 0.1;
      let wx = cp.x + ((((m.x - cp.x) % 40) + 60) % 40) - 20;
      let wz = cp.z + ((((m.z - cp.z) % 40) + 60) % 40) - 20;
      m.x = wx; m.z = wz;
      if (Math.random() < dt * 0.6) {
        this.alpha.emit(wx, cp.y + m.y * 0.6 - 1, wz, 0.2, 0.02, 0.05, 2.5, 0.03, 0.03, 0.95, 0.88, 0.7, 0.5, 0, 0);
      }
    }
  }

  clear() {
    this.add.clear(); this.alpha.clear();
    for (const t of this.tracers) t.alive = false;
    for (let i = 0; i < 260; i++) this.decalMesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    this.decalMesh.instanceMatrix.needsUpdate = true;
  }
}
