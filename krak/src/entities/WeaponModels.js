// Procedural weapon models. Local frame: +Z forward, origin at the pistol grip.
import * as THREE from 'three';
import { PartSet, GEO, stdMat } from './meshUtil.js';
import { RARITY } from '../config.js';

const metal = () => stdMat(0x2a2d31, 0.38, 0.75);
const poly = () => stdMat(0x1c1e20, 0.75, 0.1);
const tan = () => stdMat(0x7d6c50, 0.8, 0.05);
const wood = () => stdMat(0x6a4126, 0.6, 0.05);
const glass = () => stdMat(0x2b4a66, 0.1, 0.9, { emissive: 0x0a1a2a });

export function buildWeaponModel(id, rarity = 0) {
  const g = new THREE.Group();
  g.name = 'weapon:' + id;
  const P = new PartSet();
  const info = { muzzle: new THREE.Vector3(), gripL: new THREE.Vector3(), mag: new THREE.Vector3(), eject: new THREE.Vector3(), magMesh: null };
  const M = metal(), PL = poly();
  if (id === 'ar') {
    P.box(PL, 0.07, 0.1, 0.42, 0, 0.065, 0.12);
    P.box(tan(), 0.078, 0.08, 0.26, 0, 0.06, 0.43);
    P.add(GEO.cylZ, M, 0, 0.065, 0.66, 0.026, 0.026, 0.22);
    P.add(GEO.cylZ, M, 0, 0.065, 0.78, 0.042, 0.042, 0.06);
    P.box(tan(), 0.06, 0.11, 0.26, 0, 0.04, -0.2);
    P.box(PL, 0.064, 0.05, 0.08, 0, 0.0, -0.31);
    P.box(PL, 0.04, 0.12, 0.05, 0, -0.045, 0.0, -0.3);
    P.box(M, 0.026, 0.03, 0.24, 0, 0.13, 0.15);
    P.box(M, 0.02, 0.05, 0.02, 0, 0.14, 0.5);
    P.box(M, 0.05, 0.05, 0.08, 0, 0.17, 0.08);
    info.muzzle.set(0, 0.065, 0.82); info.gripL.set(0, 0.015, 0.42); info.mag.set(0, -0.08, 0.19); info.eject.set(0.05, 0.08, 0.12);
    info.magGeo = [0.05, 0.18, 0.09, 0, -0.07, 0.19, 0.25];
  } else if (id === 'smg') {
    P.box(PL, 0.066, 0.1, 0.32, 0, 0.065, 0.1);
    P.add(GEO.cylZ, M, 0, 0.065, 0.32, 0.03, 0.03, 0.12);
    P.add(GEO.cylZ, M, 0, 0.065, 0.4, 0.045, 0.045, 0.06);
    P.box(PL, 0.04, 0.11, 0.05, 0, -0.045, 0.0, -0.25);
    P.box(PL, 0.035, 0.1, 0.04, 0, -0.03, 0.22);
    P.box(M, 0.02, 0.02, 0.22, 0.025, 0.06, -0.15);
    P.box(M, 0.02, 0.02, 0.22, -0.025, 0.06, -0.15);
    P.box(PL, 0.06, 0.07, 0.03, 0, 0.05, -0.27);
    P.box(M, 0.04, 0.04, 0.06, 0, 0.13, 0.06);
    info.muzzle.set(0, 0.065, 0.44); info.gripL.set(0, -0.06, 0.22); info.mag.set(0, -0.07, 0.1); info.eject.set(0.05, 0.08, 0.1);
    info.magGeo = [0.035, 0.2, 0.05, 0, -0.07, 0.1, 0.05];
  } else if (id === 'shotgun') {
    P.box(PL, 0.07, 0.1, 0.34, 0, 0.06, 0.08);
    P.add(GEO.cylZ, M, 0, 0.085, 0.5, 0.034, 0.034, 0.56);
    P.add(GEO.cylZ, M, 0, 0.035, 0.42, 0.03, 0.03, 0.42);
    P.box(wood(), 0.07, 0.07, 0.2, 0, 0.035, 0.42);
    P.box(wood(), 0.06, 0.12, 0.3, 0, 0.03, -0.22, 0.12);
    P.box(PL, 0.04, 0.11, 0.05, 0, -0.045, 0.0, -0.3);
    P.box(M, 0.012, 0.02, 0.012, 0, 0.11, 0.76);
    info.muzzle.set(0, 0.085, 0.79); info.gripL.set(0, 0.0, 0.42); info.mag.set(0, 0.03, 0.2); info.eject.set(0.05, 0.08, 0.1);
  } else if (id === 'sniper') {
    P.box(stdMat(0x3c4a3a, 0.8, 0.1), 0.07, 0.1, 0.5, 0, 0.06, 0.12);
    P.add(GEO.cylZ, M, 0, 0.07, 0.68, 0.03, 0.03, 0.62);
    P.add(GEO.cylZ, M, 0, 0.07, 1.0, 0.05, 0.05, 0.08);
    P.box(stdMat(0x3c4a3a, 0.8, 0.1), 0.06, 0.13, 0.32, 0, 0.035, -0.26);
    P.box(PL, 0.065, 0.04, 0.12, 0, 0.12, -0.24);
    P.box(PL, 0.04, 0.12, 0.05, 0, -0.045, 0.0, -0.3);
    P.add(GEO.cylZ, PL, 0, 0.17, 0.14, 0.055, 0.055, 0.36);
    P.add(GEO.cylZ, PL, 0, 0.17, 0.33, 0.07, 0.07, 0.08);
    P.add(GEO.cylZ, PL, 0, 0.17, -0.05, 0.065, 0.065, 0.06);
    P.add(GEO.cylZ, glass(), 0, 0.17, 0.375, 0.06, 0.06, 0.01);
    P.box(M, 0.03, 0.05, 0.03, 0, 0.12, 0.05); P.box(M, 0.03, 0.05, 0.03, 0, 0.12, 0.24);
    P.box(M, 0.012, 0.012, 0.25, 0.02, -0.02, 0.62, 0.15); P.box(M, 0.012, 0.012, 0.25, -0.02, -0.02, 0.62, 0.15);
    info.muzzle.set(0, 0.07, 1.04); info.gripL.set(0, 0.01, 0.4); info.mag.set(0, -0.04, 0.16); info.eject.set(0.05, 0.08, 0.14);
    info.magGeo = [0.05, 0.08, 0.09, 0, -0.03, 0.16, 0];
  } else {
    // pistol
    P.box(M, 0.034, 0.04, 0.19, 0, 0.075, 0.06);
    P.box(PL, 0.032, 0.03, 0.15, 0, 0.042, 0.06);
    P.box(PL, 0.032, 0.11, 0.05, 0, -0.01, 0.0, -0.22);
    P.box(PL, 0.012, 0.02, 0.04, 0, 0.02, 0.05);
    info.muzzle.set(0, 0.075, 0.16); info.gripL.set(-0.035, -0.02, 0.02); info.mag.set(0, -0.06, -0.01); info.eject.set(0.03, 0.09, 0.05);
  }
  P.build(g);
  if (info.magGeo) {
    const [w, h, d, x, y, z, rx] = info.magGeo;
    const mag = new THREE.Mesh(GEO.box, id === 'ar' ? stdMat(0x2e2b26, 0.6, 0.4) : PL);
    mag.scale.set(w, h, d);
    mag.position.set(x, y, z);
    mag.rotation.x = rx;
    mag.castShadow = true;
    g.add(mag);
    info.magMesh = mag;
    info.magHome = mag.position.clone();
  }
  // Rarity accent strip.
  if (rarity > 0) {
    const R = RARITY[rarity];
    const accent = new THREE.Mesh(GEO.box, stdMat(R.hex, 0.4, 0.3, { emissive: R.hex, emissiveIntensity: 0.6 }));
    const len = id === 'pistol' ? 0.1 : 0.2;
    accent.scale.set(id === 'pistol' ? 0.036 : 0.074, 0.012, len);
    accent.position.set(0, id === 'pistol' ? 0.058 : 0.04, id === 'pistol' ? 0.06 : 0.12);
    g.add(accent);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  g.userData = info;
  return g;
}

// 2D silhouette icons for HUD / loot cards (drawn once, cached as data URLs).
const iconCache = new Map();
export function weaponIcon(id, color = '#e8e2d4') {
  const key = id + color;
  if (iconCache.has(key)) return iconCache.get(key);
  const c = document.createElement('canvas');
  c.width = 220; c.height = 80;
  const x = c.getContext('2d');
  x.fillStyle = color;
  const R = (a, b, w, h) => x.fillRect(a, b, w, h);
  if (id === 'ar') {
    R(40, 28, 90, 16); R(130, 30, 60, 12); R(190, 33, 22, 6); R(6, 30, 38, 14); R(6, 40, 10, 12);
    x.save(); x.translate(64, 42); x.rotate(0.35); R(0, 0, 14, 26); x.restore();
    x.save(); x.translate(100, 42); x.rotate(0.12); R(0, 0, 14, 30); x.restore();
    R(70, 20, 40, 6);
  } else if (id === 'smg') {
    R(60, 26, 80, 18); R(140, 30, 30, 10); R(170, 31, 10, 8); R(20, 30, 40, 5); R(20, 37, 40, 5); R(16, 28, 6, 18);
    x.save(); x.translate(78, 44); x.rotate(0.3); R(0, 0, 13, 24); x.restore();
    R(112, 44, 10, 30); R(126, 44, 9, 14);
  } else if (id === 'shotgun') {
    R(40, 26, 70, 16); R(110, 24, 100, 9); R(110, 36, 80, 8); R(130, 34, 36, 12);
    x.save(); x.translate(4, 34); x.rotate(0.1); R(0, 0, 44, 16); x.restore();
    x.save(); x.translate(60, 42); x.rotate(0.35); R(0, 0, 13, 22); x.restore();
  } else if (id === 'sniper') {
    R(50, 30, 80, 14); R(130, 33, 86, 7); R(70, 14, 60, 10); R(64, 12, 8, 14); R(128, 11, 10, 16);
    x.save(); x.translate(4, 32); x.rotate(0.05); R(0, 0, 50, 18); x.restore();
    x.save(); x.translate(70, 44); x.rotate(0.35); R(0, 0, 12, 22); x.restore();
    R(98, 44, 12, 10);
  } else if (id === 'pistol') {
    R(70, 24, 80, 16); R(74, 40, 66, 8);
    x.save(); x.translate(78, 46); x.rotate(0.28); R(0, 0, 20, 30); x.restore();
  } else if (id === 'grenade') {
    x.beginPath(); x.ellipse(110, 46, 20, 24, 0, 0, 7); x.fill(); R(100, 14, 20, 10); R(118, 16, 18, 4);
  }
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}
