// Shrinking safe zone with animated energy wall, timers and out-of-zone damage.
import * as THREE from 'three';
import { ZONE_PHASES, MAP } from '../config.js';
import { clamp, lerp } from '../core/util.js';

export class ZoneSystem {
  constructor(game) {
    this.game = game;
    this.center = new THREE.Vector2();
    this.next = new THREE.Vector2();
    this.from = new THREE.Vector2();
    this.uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#5aa8ff') }, uAlpha: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; varying vec3 vW;
        void main(){
          float h = vUv.y;
          float stripes = smoothstep(0.35, 0.5, abs(fract(vUv.x * 260.0 + vW.y * 0.08 - uTime * 0.6) - 0.5));
          float scan = smoothstep(0.0, 0.02, abs(fract(h * 14.0 - uTime * 0.25) - 0.5) - 0.46);
          float base = smoothstep(0.35, 0.0, h) * 0.5;
          float a = (0.16 + stripes * 0.18 + scan * 0.25 + base) * (1.0 - smoothstep(0.55, 1.0, h));
          gl_FragColor = vec4(uColor * (1.2 + base * 2.0), a * uAlpha);
        }`,
    });
    this.wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 128, 1, true), mat);
    this.wall.renderOrder = 3;
    this.wall.frustumCulled = false;
    game.scene.add(this.wall);
    // Ground ring of the next zone.
    this.nextRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false, fog: false }));
    this.nextRing.position.y = 0.4;
    game.scene.add(this.nextRing);
    this.reset();
  }

  reset() {
    this.phase = -1;
    this.center.set(0, 0);
    this.radius = 240;
    this.next.set(0, 0);
    this.nextRadius = 240;
    this.timeLeft = 0;
    this.shrinking = false;
    this.done = false;
    this.dps = 0;
    this.tick = 0;
    this.warned = false;
    this.wall.visible = true;
    this.startPhase(0);
  }

  pickNext(radius) {
    const maxOff = Math.max(0, this.radius - radius) * 0.85;
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * maxOff;
      const x = this.center.x + Math.cos(a) * d, z = this.center.y + Math.sin(a) * d;
      const lim = MAP.half - 12 - radius * 0.35;
      if (Math.abs(x) > lim || Math.abs(z) > lim) continue;
      if (radius < 30) {
        // keep the final circles on walkable ground
        if (!this.game.world.nav.walkable(x, z)) continue;
        if (this.game.world.terrain.height(x, z) > 9) continue;
      }
      return [x, z];
    }
    return [this.center.x * 0.8, this.center.y * 0.8];
  }

  startPhase(i) {
    this.phase = i;
    const P = ZONE_PHASES[i];
    const [x, z] = i === 0 ? [(Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50] : this.pickNext(P.radius);
    this.next.set(x, z);
    this.nextRadius = P.radius;
    this.timeLeft = P.wait;
    this.shrinking = false;
    this.warned = false;
  }

  get phaseInfo() { return ZONE_PHASES[Math.max(0, this.phase)]; }

  update(dt) {
    const g = this.game;
    this.uniforms.uTime.value += dt;
    if (!this.done) {
      this.timeLeft -= dt;
      const P = ZONE_PHASES[this.phase];
      if (!this.shrinking) {
        if (!this.warned && this.timeLeft < 10) { this.warned = true; g.events.emit('zone_warning', { t: 10 }); }
        if (this.timeLeft <= 0) {
          this.shrinking = true;
          this.timeLeft = P.shrink;
          this.from.copy(this.center);
          this.fromR = this.radius;
          this.dps = P.dps;
          g.events.emit('zone_shrink', { phase: this.phase });
        }
      } else {
        const t = clamp(1 - this.timeLeft / P.shrink, 0, 1);
        this.center.lerpVectors(this.from, this.next, t);
        this.radius = lerp(this.fromR, this.nextRadius, t);
        if (this.timeLeft <= 0) {
          this.center.copy(this.next);
          this.radius = this.nextRadius;
          if (this.phase + 1 < ZONE_PHASES.length) this.startPhase(this.phase + 1);
          else { this.done = true; this.shrinking = false; }
        }
      }
    }
    // damage tick
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 1;
      const dps = Math.max(1, this.dps || 1) * (this.phase === 0 && !this.shrinking ? 1 : 1);
      for (const a of g.actors) {
        if (!a.alive) continue;
        if (this.outside(a.ctrl.pos)) a.applyDamage(dps, { attacker: null, zone: true, dir: null });
      }
    }
    // visuals
    this.wall.position.set(this.center.x, 60, this.center.y);
    this.wall.scale.set(this.radius, 170, this.radius);
    const cam = g.camera.position;
    const dCam = Math.hypot(cam.x - this.center.x, cam.z - this.center.y);
    this.uniforms.uAlpha.value = clamp(1.4 - Math.abs(dCam - this.radius) / 160, 0.35, 1);
    this.nextRing.position.set(this.next.x, 0.4, this.next.y);
    this.nextRing.scale.setScalar(this.nextRadius);
    this.nextRing.material.opacity = this.done ? 0 : 0.0;
  }

  outside(p) {
    return Math.hypot(p.x - this.center.x, p.z - this.center.y) > this.radius;
  }

  distanceOutside(p) {
    return Math.hypot(p.x - this.center.x, p.z - this.center.y) - this.radius;
  }
}
