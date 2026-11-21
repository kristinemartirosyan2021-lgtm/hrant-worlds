// Visual effects: particles (smoke/fire/splash), explosions with flash light, bullet tracers.
import * as THREE from 'three';

class ParticleSystem {
  constructor(scene, tex, count, additive, size) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.colA = new Float32Array(count * 4);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.base = new Float32Array(count * 3);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.colA, 4).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.PointsMaterial({
      size, map: tex, vertexColors: true, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
    for (let i = 0; i < count; i++) this.pos[i * 3 + 1] = -9999;
    this.active = 0;
  }
  emit(x, y, z, vx, vy, vz, life, r, g, b) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.count;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.base[i * 3] = r; this.base[i * 3 + 1] = g; this.base[i * 3 + 2] = b;
    this.active = 1.5;
  }
  update(dt, gravity = 0, drag = 0.5) {
    if (this.active <= 0) return;
    this.active -= dt;
    const P = this.pos, V = this.vel, C = this.colA;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { if (C[i * 4 + 3] !== 0) { C[i * 4 + 3] = 0; P[i * 3 + 1] = -9999; } continue; }
      this.active = Math.max(this.active, 0.1);
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      V[i * 3 + 1] += gravity * dt;
      const k = Math.exp(-drag * dt);
      V[i * 3] *= k; V[i * 3 + 2] *= k;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      C[i * 4] = this.base[i * 3]; C[i * 4 + 1] = this.base[i * 3 + 1]; C[i * 4 + 2] = this.base[i * 3 + 2];
      C[i * 4 + 3] = t * t;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export class Effects {
  constructor(game) {
    this.game = game;
    const scene = game.scene, tex = game.textures.soft;
    this.smokeSys = new ParticleSystem(scene, tex, 220, false, 3.2);
    this.fireSys = new ParticleSystem(scene, tex, 220, true, 2.4);
    this.splashSys = new ParticleSystem(scene, tex, 120, false, 1.0);
    this.explosions = [];
    const geo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; scene.add(m);
      this.explosions.push({ mesh: m, t: 0 });
    }
    this.flash = new THREE.PointLight('#ffaa55', 0, 40, 1.5);
    scene.add(this.flash);
    this.tracers = [];
    const tm = new THREE.LineBasicMaterial({ color: '#fff3a0', transparent: true });
    for (let i = 0; i < 8; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, tm.clone());
      l.visible = false; l.frustumCulled = false; scene.add(l);
      this.tracers.push({ line: l, t: 0 });
    }
    this.tracerIdx = 0;
  }

  smoke(x, y, z, dark = 0.35) {
    this.smokeSys.emit(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8, 2 + Math.random(), (Math.random() - 0.5) * 0.8, 2.2, dark, dark, dark);
  }
  fire(x, y, z, dt) {
    const n = Math.ceil(dt * 60);
    for (let i = 0; i < n; i++) {
      this.fireSys.emit(x + (Math.random() - 0.5) * 1.6, y, z + (Math.random() - 0.5) * 1.6, (Math.random() - 0.5), 3 + Math.random() * 2, (Math.random() - 0.5), 0.6, 1, 0.45 + Math.random() * 0.3, 0.1);
      if (Math.random() < 0.4) this.smoke(x, y + 1.2, z, 0.15);
    }
  }
  splash(x, y, z) {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 3;
      this.splashSys.emit(x, y + 0.2, z, Math.cos(a) * s, 4 + Math.random() * 4, Math.sin(a) * s, 1.0, 0.85, 0.95, 1);
    }
  }
  explosion(x, y, z) {
    const e = this.explosions.find((q) => q.t <= 0) || this.explosions[0];
    e.t = 0.7; e.mesh.position.set(x, y, z); e.mesh.visible = true;
    this.flash.position.set(x, y + 2, z); this.flash.intensity = 300;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 10;
      this.fireSys.emit(x, y, z, Math.cos(a) * s, Math.random() * 10, Math.sin(a) * s, 0.8 + Math.random() * 0.4, 1, 0.5 + Math.random() * 0.4, 0.15);
    }
    for (let i = 0; i < 25; i++) this.smoke(x + (Math.random() - 0.5) * 3, y + Math.random() * 2, z + (Math.random() - 0.5) * 3, 0.12);
  }
  tracer(ax, ay, az, bx, by, bz) {
    const t = this.tracers[this.tracerIdx]; this.tracerIdx = (this.tracerIdx + 1) % this.tracers.length;
    const p = t.line.geometry.attributes.position;
    p.setXYZ(0, ax, ay, az); p.setXYZ(1, bx, by, bz); p.needsUpdate = true;
    t.line.visible = true; t.t = 0.08; t.line.material.opacity = 1;
    for (let i = 0; i < 4; i++) this.fireSys.emit(ax, ay, az, (Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2, 0.08, 1, 0.9, 0.5);
  }

  update(dt) {
    this.smokeSys.update(dt, 0.6, 0.6);
    this.fireSys.update(dt, 2, 1.5);
    this.splashSys.update(dt, -14, 0.3);
    for (const e of this.explosions) {
      if (e.t <= 0) continue;
      e.t -= dt;
      const k = 1 - e.t / 0.7;
      e.mesh.scale.setScalar(1 + k * 8);
      e.mesh.material.opacity = Math.max(0, 1 - k);
      e.mesh.material.color.setHSL(0.08 - k * 0.06, 1, 0.6 - k * 0.3);
      if (e.t <= 0) e.mesh.visible = false;
    }
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 700);
    for (const t of this.tracers) {
      if (t.t <= 0) continue;
      t.t -= dt; t.line.material.opacity = Math.max(0, t.t / 0.08);
      if (t.t <= 0) t.line.visible = false;
    }
  }
}
