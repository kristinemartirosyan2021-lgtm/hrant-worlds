// Procedural canvas textures (no image assets needed).
import * as THREE from 'three';
import { mulberry32 } from '../utils/math.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Building facade: 4x4 windows per tile. Returns albedo + night emissive maps. */
export function makeWindowTextures() {
  const rng = mulberry32(42);
  const [c, g] = canvas(256, 256);
  const [ce, ge] = canvas(256, 256);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  ge.fillStyle = '#000000'; ge.fillRect(0, 0, 256, 256);
  const lit = ['#ffd27a', '#ffe9b0', '#fff4d6', '#ffc46b', '#a8e6ff', '#ffb3de'];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const x = i * 64 + 14, y = j * 64 + 12, w = 38, h = 38;
      g.fillStyle = '#d0d4da'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
      const grd = g.createLinearGradient(x, y, x + w, y + h);
      grd.addColorStop(0, '#5d7896'); grd.addColorStop(1, '#2c3b4f');
      g.fillStyle = grd; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 3, y + 3, 8, h - 6);
      if (rng() < 0.55) {
        ge.fillStyle = lit[Math.floor(rng() * lit.length)];
        ge.fillRect(x, y, w, h);
      }
    }
  }
  const map = tex(c), emissive = tex(ce);
  return { map, emissive };
}

/** Road: asphalt with white edges and yellow dashed centre. u across, v along (1 tile = width). */
export function makeRoadTexture() {
  const rng = mulberry32(7);
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#44464c'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 600; i++) {
    const v = 55 + Math.floor(rng() * 30);
    g.fillStyle = `rgb(${v},${v},${v + 4})`;
    g.fillRect(Math.floor(rng() * 64), Math.floor(rng() * 64), 1, 1);
  }
  g.fillStyle = '#f2f2f2'; g.fillRect(2, 0, 2, 64); g.fillRect(60, 0, 2, 64);
  g.fillStyle = '#ffd23f'; g.fillRect(29, 0, 2, 32); g.fillRect(33, 0, 2, 32);
  const t = tex(c);
  t.anisotropy = 8;
  return t;
}

/** Soft radial blob for particles, light pools and headlight beams. */
export function makeSoftCircle(size = 64) {
  const [c, g] = canvas(size, size);
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  return tex(c, true, false);
}

/** Headlight beam: bright near the car, fading forward. */
export function makeBeamTexture() {
  const [c, g] = canvas(64, 128);
  const grd = g.createLinearGradient(0, 128, 0, 0);
  grd.addColorStop(0, 'rgba(255,245,210,0.9)');
  grd.addColorStop(1, 'rgba(255,245,210,0)');
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(22, 128); g.lineTo(42, 128); g.lineTo(64, 0); g.lineTo(0, 0); g.closePath(); g.fill();
  return tex(c, true, false);
}
