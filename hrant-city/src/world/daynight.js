// Day/night cycle: sky dome shader, sun/moon light, fog colour, night factor.
import * as THREE from 'three';
import { clamp, lerp } from '../utils/math.js';

// hour, sky top, horizon, sun colour, sun intensity, hemi intensity
const KEYS = [
  [0, '#050a1c', '#152048', '#8fa2ff', 0.35, 0.55],
  [5, '#0b1030', '#2a2a58', '#8fa2ff', 0.3, 0.55],
  [6, '#2a3170', '#ff9a6b', '#ff9a5c', 0.8, 0.8],
  [7.5, '#3a8ee6', '#bfe3ff', '#fff1d6', 1.9, 1.15],
  [12, '#2a7fe0', '#a8d8ff', '#ffffff', 2.4, 1.3],
  [16.5, '#3b74d6', '#ffe0b0', '#ffe2b0', 2.1, 1.2],
  [18.3, '#4a4aa0', '#ff7a45', '#ff8a3d', 1.4, 1.0],
  [19.3, '#2a2266', '#d1456e', '#ff5a5a', 0.7, 0.85],
  [20.5, '#0b1030', '#2a2458', '#8fa2ff', 0.35, 0.55],
  [24, '#050a1c', '#152048', '#8fa2ff', 0.35, 0.55],
];
const _a = new THREE.Color(), _b = new THREE.Color();

export class DayNight {
  constructor(scene, quality) {
    this.scene = scene;
    this.hour = 17.2;
    this.speed = 1 / 30; // game hours per real second (1 day = 12 min)
    this.top = new THREE.Color(); this.horizon = new THREE.Color(); this.sunColor = new THREE.Color();
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.night = 0;

    this.hemi = new THREE.HemisphereLight('#bfe3ff', '#6a5a40', 1.2);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2);
    this.sun.position.set(100, 200, 50);
    scene.add(this.sun); scene.add(this.sun.target);
    this.setShadows(quality.shadows);

    scene.fog = new THREE.Fog('#bfe3ff', 60, quality.far);

    const geo = new THREE.SphereGeometry(100, 24, 12);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: {
        top: { value: this.top }, horizon: { value: this.horizon }, sunColor: { value: this.sunColor },
        sunDir: { value: this.sunDir }, night: { value: 0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDir; uniform float night;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 c = mix(horizon, top, pow(h, 0.45));
          if (d.y < 0.0) c = horizon * 0.85;
          float s = max(dot(d, normalize(sunDir)), 0.0);
          c += sunColor * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.35 * (1.0 - night * 0.6));
          vec3 p = floor(d * 260.0);
          float r = fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          c += vec3(step(0.9975, r)) * night * smoothstep(0.05, 0.4, h) * 0.9;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(geo, this.skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.apply();
  }

  setShadows(on) {
    this.sun.castShadow = on;
    if (on) {
      const s = this.sun.shadow;
      s.mapSize.set(1024, 1024);
      s.camera.left = -70; s.camera.right = 70; s.camera.top = 70; s.camera.bottom = -70;
      s.camera.near = 1; s.camera.far = 400;
      s.bias = -0.0008; s.normalBias = 0.6;
      s.camera.updateProjectionMatrix();
    }
  }

  setFar(far) { this.scene.fog.far = far; this.scene.fog.near = Math.min(80, far * 0.3); }

  get timeString() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  apply() {
    const t = this.hour;
    let k = 0;
    while (k < KEYS.length - 2 && KEYS[k + 1][0] <= t) k++;
    const A = KEYS[k], B = KEYS[k + 1];
    const f = clamp((t - A[0]) / (B[0] - A[0]), 0, 1);
    this.top.copy(_a.set(A[1])).lerp(_b.set(B[1]), f);
    this.horizon.copy(_a.set(A[2])).lerp(_b.set(B[2]), f);
    this.sunColor.copy(_a.set(A[3])).lerp(_b.set(B[3]), f);
    const sunI = lerp(A[4], B[4], f), hemiI = lerp(A[5], B[5], f);

    // sun travels east (+x, over the ocean) to west
    const ang = ((t - 6) / 12) * Math.PI;
    const sx = Math.cos(ang), sy = Math.sin(ang);
    const isDay = sy > -0.05;
    if (isDay) this.sunDir.set(sx, Math.max(sy, 0.02), 0.35).normalize();
    else this.sunDir.set(-sx, -sy, -0.3).normalize(); // moon opposite
    this.night = clamp(t < 12 ? (6.6 - t) / 1.4 : (t - 18.6) / 1.4, 0, 1);
    this.skyMat.uniforms.night.value = this.night;

    this.sun.color.copy(this.sunColor);
    this.sun.intensity = sunI;
    this.hemi.color.copy(this.horizon).lerp(this.top, 0.3).lerp(_a.set('#ffffff'), 0.35);
    this.hemi.groundColor.set('#5a4a3a').lerp(_a.set('#151830'), this.night);
    this.hemi.intensity = hemiI;
    this.scene.fog.color.copy(this.horizon);
  }

  update(dt, focus, camera) {
    this.hour = (this.hour + dt * this.speed) % 24;
    this.apply();
    if (focus) {
      this.sun.target.position.set(focus.x, 0, focus.z);
      this.sun.position.set(focus.x + this.sunDir.x * 150, this.sunDir.y * 150, focus.z + this.sunDir.z * 150);
    }
    if (camera) this.sky.position.copy(camera.position);
  }
}
