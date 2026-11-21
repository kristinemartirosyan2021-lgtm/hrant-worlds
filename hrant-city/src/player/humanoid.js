// Low-poly humanoid built from boxes, with pivoted limbs for simple animation.
import * as THREE from 'three';

const matCache = new Map();
function mat(c) {
  let m = matCache.get(c);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); matCache.set(c, m); }
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function limb(w, h, d, color, x, y, extra) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  const m = new THREE.Mesh(box(w, h, d), mat(color));
  m.position.y = -h / 2;
  m.castShadow = true;
  pivot.add(m);
  if (extra) for (const e of extra) pivot.add(e);
  return pivot;
}

export function buildHumanoid({ shirt = '#1fb5a8', pants = '#2c3e66', skin = '#e0ac7e', hair = '#1b1b1b', shoes = '#f5f5f5', glasses = true } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const torso = new THREE.Mesh(box(0.54, 0.64, 0.3), mat(shirt));
  torso.position.y = 1.22; torso.castShadow = true;
  body.add(torso);
  const belt = new THREE.Mesh(box(0.56, 0.08, 0.32), mat('#3b2a1a'));
  belt.position.y = 0.92; body.add(belt);
  const head = new THREE.Mesh(box(0.32, 0.34, 0.32), mat(skin));
  head.position.y = 1.72; head.castShadow = true;
  body.add(head);
  const hairTop = new THREE.Mesh(box(0.35, 0.1, 0.35), mat(hair));
  hairTop.position.y = 1.92; body.add(hairTop);
  const hairBack = new THREE.Mesh(box(0.35, 0.22, 0.08), mat(hair));
  hairBack.position.set(0, 1.8, -0.15); body.add(hairBack);
  if (glasses) {
    const g = new THREE.Mesh(box(0.34, 0.07, 0.04), mat('#111111'));
    g.position.set(0, 1.76, 0.17); body.add(g);
  }

  const handL = new THREE.Mesh(box(0.13, 0.13, 0.13), mat(skin)); handL.position.y = -0.66;
  const handR = new THREE.Mesh(box(0.13, 0.13, 0.13), mat(skin)); handR.position.y = -0.66;
  const gun = new THREE.Mesh(box(0.08, 0.14, 0.32), mat('#222222'));
  gun.position.set(0, -0.72, 0.12); gun.visible = false;
  const armL = limb(0.15, 0.6, 0.15, skin, 0.35, 1.5, [handL]);
  const armR = limb(0.15, 0.6, 0.15, skin, -0.35, 1.5, [handR, gun]);
  const sleeveL = new THREE.Mesh(box(0.18, 0.22, 0.18), mat(shirt)); sleeveL.position.y = -0.1; armL.add(sleeveL);
  const sleeveR = new THREE.Mesh(box(0.18, 0.22, 0.18), mat(shirt)); sleeveR.position.y = -0.1; armR.add(sleeveR);
  const shoeL = new THREE.Mesh(box(0.2, 0.1, 0.3), mat(shoes)); shoeL.position.set(0, -0.86, 0.04);
  const shoeR = new THREE.Mesh(box(0.2, 0.1, 0.3), mat(shoes)); shoeR.position.set(0, -0.86, 0.04);
  const legL = limb(0.2, 0.86, 0.22, pants, 0.13, 0.9, [shoeL]);
  const legR = limb(0.2, 0.86, 0.22, pants, -0.13, 0.9, [shoeR]);
  body.add(armL, armR, legL, legR);

  return { group, body, torso, head, armL, armR, legL, legR, gun };
}
