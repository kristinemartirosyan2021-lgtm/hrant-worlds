// Sky dome with sun glow, distant mountain ring (incl. a twin snowy peak) and drifting clouds.
import * as THREE from 'three';
import { mountainTexture } from './Textures.js';
import { mulberry32 } from '../core/util.js';

export const SUN_DIR = new THREE.Vector3(-0.72, 0.4, 0.38).normalize();
export const FOG_COLOR = new THREE.Color('#c9b49a');

export class Sky {
  constructor(game) {
    this.group = new THREE.Group();
    this.group.name = 'sky';
    game.scene.add(this.group);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        sunDir: { value: SUN_DIR },
        zenith: { value: new THREE.Color('#3f6390') },
        horizon: { value: new THREE.Color('#e7c49c') },
        ground: { value: new THREE.Color('#a48c74') },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `
        uniform vec3 sunDir, zenith, horizon, ground; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.55));
          col = mix(col, ground, smoothstep(0.0, -0.25, h));
          float s = max(dot(d, sunDir), 0.0);
          col += vec3(1.0, 0.78, 0.5) * pow(s, 6.0) * 0.35;
          col += vec3(1.0, 0.85, 0.65) * pow(s, 64.0) * 0.6;
          col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9997, s) * 4.0;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    // Mountain ring.
    const ringTex = mountainTexture(4, false);
    ringTex.wrapS = THREE.RepeatWrapping;
    ringTex.repeat.set(3, 1);
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(900, 900, 260, 48, 1, true),
      new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false, color: 0xb6aea8 }),
    );
    ring.position.y = 70;
    ring.renderOrder = -9;
    this.group.add(ring);
    // The twin-peaked giant on the south-east horizon.
    const twinTex = mountainTexture(9, true);
    const twin = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 360),
      new THREE.MeshBasicMaterial({ map: twinTex, transparent: true, fog: false, depthWrite: false, color: 0xd9d2d0 }),
    );
    twin.position.set(420, 125, 760);
    twin.lookAt(0, 125, 0);
    twin.renderOrder = -8;
    this.group.add(twin);

    // Clouds.
    this.clouds = [];
    const ctex = cloudTexture();
    const r = mulberry32(99);
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, transparent: true, opacity: 0.55 + r() * 0.3, fog: false, depthWrite: false, color: 0xfff2e0 }));
      const a = r() * Math.PI * 2, d = 300 + r() * 450;
      sp.position.set(Math.cos(a) * d, 180 + r() * 120, Math.sin(a) * d);
      const s = 180 + r() * 220;
      sp.scale.set(s, s * 0.35, 1);
      sp.renderOrder = -7;
      this.group.add(sp);
      this.clouds.push(sp);
    }
  }

  update(dt, camera) {
    this.group.position.set(camera.position.x, 0, camera.position.z);
    for (const c of this.clouds) {
      c.position.x += dt * 2.0;
      if (c.position.x > 800) c.position.x = -800;
    }
  }
}

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  const r = mulberry32(3);
  for (let i = 0; i < 40; i++) {
    const x = 40 + r() * 176, y = 50 + r() * 40, rad = 14 + r() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
