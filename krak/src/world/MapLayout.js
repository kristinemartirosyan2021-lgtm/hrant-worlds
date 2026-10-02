// The single hand-authored battlefield: Old Quarter, Factory Zone, Checkpoint,
// Rocky Hills, Oak Forest and the central Old Fortress.
import * as THREE from 'three';
import * as P from './Props.js';

export function buildMap(W) {
  W.rockGeos = makeRockGeos();
  roads(W);
  town(W);
  industry(W);
  checkpoint(W);
  fort(W);
  hills(W);
  forest(W);
  fields(W);
  P.buildFenceMesh(W);
  spawns(W);
}

function makeRockGeos() {
  const out = [];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.DodecahedronGeometry(1, 1);
    const p = g.attributes.position;
    const seen = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      let f = seen.get(key);
      if (f === undefined) { f = 0.75 + Math.random() * 0.45; seen.set(key, f); }
      p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * (p.getY(i) < 0 ? 0.6 : 1), p.getZ(i) * f);
    }
    g.computeVertexNormals();
    out.push(g);
  }
  return out;
}

// ------------------------------------------------------------------ roads
function roads(W) {
  const y = 0.025;
  // N-S road (broken by the fortress)
  W.deco('asphalt', -6, -0.2, -175, 6, y, -25.5);
  W.deco('asphalt', -6, -0.2, 25.5, 6, y, 175);
  // E-W road
  W.deco('asphalt', -175, -0.2, -42, -6, y, -30);
  W.deco('asphalt', 6, -0.2, -42, 175, y, -30);
  W.deco('asphalt', -6, -0.2, -42, 6, y, -30);
  // centre dashes
  for (let z = -170; z < 170; z += 7) {
    if (Math.abs(z) < 27) continue;
    if (z > -44 && z < -28) continue;
    W.deco('paintWhite', -0.12, y, z, 0.12, y + 0.006, z + 3.2, { tint: 0.9 });
  }
  for (let x = -170; x < 170; x += 7) {
    if (Math.abs(x) < 8) continue;
    W.deco('paintWhite', x, y, -36.12, x + 3.2, y + 0.006, -35.88, { tint: 0.9 });
  }
  // Power line along the E-W road.
  const poles = [];
  for (let x = -160; x <= 160; x += 26) if (Math.abs(x) > 9) poles.push(P.powerPole(W, x, -44.5));
  P.wires(W, poles);
  // Abandoned cars on the roads.
  P.car(W, 2.6, -105, 'z');
  P.car(W, -2.8, 62, 'z');
  P.car(W, 42, -33.2, 'x');
  P.car(W, -62, -38.8, 'x');
  P.car(W, 128, -38.6, 'x', [0.15, 0.13, 0.12]);
  P.car(W, -3, 148, 'z');
  // Bus stop shelter.
  W.solid('darkMetal', 8, 0, -48.6, 12, 2.6, -48.4, { noBullet: true });
  W.deco('metalW', 7.8, 2.6, -49.2, 12.2, 2.75, -47.2);
  W.deco('darkMetal', 8, 0, -47.4, 8.1, 2.6, -47.3);
  W.deco('darkMetal', 11.9, 0, -47.4, 12, 2.6, -47.3);
  P.bench(W, 10, -48, 'x');
  P.sign(W, 'ԿԱՆԳԱՌ', 10, 2.3, -48.35, 0, 1.6, 0.4, { bg: '#244a7a' });
}

// ------------------------------------------------------------------ town
function town(W) {
  // Streets & plaza paving.
  W.deco('asphalt', -152, -0.2, -92, -108, 0.03, -84);
  W.deco('asphalt', -76, -0.2, -92, -32, 0.03, -84);
  W.deco('asphalt', -96, -0.2, -140, -88, 0.03, -104);
  W.deco('asphalt', -96, -0.2, -72, -88, 0.03, -42);
  W.deco('basalt', -108, -0.2, -104, -76, 0.04, -72, { uv: 2.5 });
  // Sidewalk curbs.
  for (const [x0, x1] of [[-152, -108], [-76, -32]]) {
    W.solid('sidewalk', x0, 0, -94, x1, 0.14, -92, { cover: false });
    W.solid('sidewalk', x0, 0, -84, x1, 0.14, -82, { cover: false });
  }

  church(W, -92, -88);
  P.khachkar(W, -100.5, -79, 0);
  P.khachkar(W, -98.5, -78.6, 0.15);
  P.khachkar(W, -84, -79, -0.1);
  for (const [x, z] of [[-104, -100], [-80, -100], [-104, -76], [-80, -76]]) P.lamp(W, x, z);
  P.bench(W, -100, -98, 'x'); P.bench(W, -84, -98, 'x');
  // Market stalls along the north of the plaza.
  P.stall(W, -102, -102, 'x', [0.75, 0.25, 0.15]);
  P.stall(W, -96.5, -102, 'x', [0.2, 0.45, 0.7]);
  P.stall(W, -82, -102, 'x', [0.85, 0.65, 0.15]);
  P.crate(W, -86.5, -103, 0.8, null, 2);

  // NW block
  W.building({ x: -138, z: -124, w: 14, d: 12, floors: 2, mat: 'tuff', doors: [{ side: 's', off: 2 }, { side: 'e', off: 0 }], tier: 1 });
  W.building({ x: -118, z: -126, w: 10, d: 14, floors: 3, mat: 'tuffO', doors: [{ side: 's', off: 0 }], tier: 1.2 });
  W.house(-140, -110, 12, 6, 3.4, 'plaster');
  P.laundry(W, -131, -121, -123, -123, 5.2);
  P.sign(W, 'ՍՐՃԱՐԱՆ', -118, 2.9, -118.8, 0, 2.6, 0.6, { bg: '#5a2a1a', fg: '#f7d9a4' });
  lowWall(W, -150, -102, -126, -101.6, 1.1, 'tuff');

  // NE block
  W.building({ x: -62, z: -124, w: 14, d: 12, floors: 2, mat: 'plasterY', doors: [{ side: 's', off: -2 }, { side: 'w', off: 1 }], tier: 1 });
  W.building({ x: -44, z: -126, w: 9, d: 12, floors: 2, mat: 'tuffB', doors: [{ side: 's', off: 0 }], tier: 1 });
  W.house(-58, -109, 15, 5, 3.4, 'plasterG');
  P.sign(W, 'ՄԹԵՐՔ', -62, 2.95, -117.8, 0, 3.2, 0.7, { bg: '#1f5a3a', fg: '#f2f0e0' });
  P.sign(W, 'ՀԱՑ', -44, 2.95, -119.8, 0, 1.8, 0.6, { bg: '#7a4a1a', fg: '#ffe9b0' });
  P.dumpster(W, -52, -114.5, 'x');

  // SW block
  W.building({ x: -136, z: -60, w: 14, d: 12, floors: 2, mat: 'tuffB', balcony: 's', doors: [{ side: 'n', off: 3 }, { side: 'e', off: 2 }], tier: 1 });
  W.house(-116, -58, 9, 9, 3.4, 'tuffO', 1);
  P.sign(W, 'ԴԵՂԱՏՈՒՆ', -136, 2.95, -66.2, Math.PI, 3.0, 0.65, { bg: '#e9efe9', fg: '#1c7a3a' });
  lowWall(W, -150, -74.4, -122, -74, 1.15, 'basalt');

  // SE block: Soviet-era apartment block.
  W.building({ x: -60, z: -60, w: 16, d: 11, floors: 3, mat: 'plasterG', fh: 3.1, doors: [{ side: 'n', off: 3 }, { side: 's', off: -3 }], tier: 1.1, winSpacing: 3.0 });
  W.house(-41, -58, 7, 10, 3.2, 'plaster', 1);
  P.laundry(W, -52, -53.5, -46, -53.5, 4.6);

  // Parked / wrecked cars.
  P.car(W, -128, -89.5, 'x'); P.car(W, -70, -86.4, 'x'); P.car(W, -48, -89.6, 'x', [0.12, 0.11, 0.1]);
  P.car(W, -90, -124, 'z'); P.car(W, -94, -58, 'z');
  P.barrel(W, -108, -66); P.barrel(W, -107.3, -66.8); P.tires(W, -110, -112);
  P.crate(W, -146, -98, 1.0, null, 2);
  // Street poles + wires along main street.
  const poles = [];
  for (let x = -150; x <= -40; x += 22) { if (x > -112 && x < -72) continue; poles.push(P.powerPole(W, x, -81.5)); }
  P.wires(W, poles.slice(0, 2)); P.wires(W, poles.slice(2));

  W.patrolPoints.push({ x: -92, z: -88 }, { x: -130, z: -88 }, { x: -50, z: -88 }, { x: -92, z: -125 }, { x: -92, z: -55 });
  for (const [x, z] of [[-92, -96], [-100, -82], [-140, -96], [-46, -96], [-92, -132], [-92, -50], [-128, -44], [-110, -102]]) {
    W.lootSpots.push({ x, y: 0.05, z, tier: 0.7 });
  }
}

function lowWall(W, x0, z0, x1, z1, h, mat) {
  W.solid(mat, x0, -0.3, z0, x1, h, z1);
  W.deco('basalt', x0 - 0.05, h, z0 - 0.05, x1 + 0.05, h + 0.1, z1 + 0.05);
}

function church(W, cx, cz) {
  // Cross-in-square plan with a tall drum and conical dome, classic Armenian silhouette.
  const m = 'tuffO';
  W.solid(m, cx - 4, -0.3, cz - 4, cx + 4, 9, cz + 4);
  W.solid(m, cx - 2.5, -0.3, cz - 7, cx + 2.5, 7.5, cz + 7);
  W.solid(m, cx - 7, -0.3, cz - 2.5, cx + 7, 7.5, cz + 2.5);
  W.deco('basalt', cx - 7.1, -0.3, cz - 2.6, cx + 7.1, 0.6, cz + 2.6);
  W.deco('basalt', cx - 2.6, -0.3, cz - 7.1, cx + 2.6, 0.6, cz + 7.1);
  // arm gables
  W.gableRoof(cx, cz, 14.4, 5.4, 7.5, 2.0, 0);
  W.gableRoof(cx, cz, 5.4, 14.4, 7.5, 2.0, 1);
  // drum + cone
  const drum = new THREE.CylinderGeometry(2.6, 2.6, 4.2, 12);
  scaleUV(drum, 6, 1.4);
  W.mesh(m, drum, cx, 11, cz, 0);
  const cone = new THREE.ConeGeometry(3.05, 3.4, 12);
  W.mesh('basalt', cone, cx, 14.8, cz, 0);
  // cross on top
  W.deco('darkMetal', cx - 0.06, 16.4, cz - 0.06, cx + 0.06, 18, cz + 0.06);
  W.deco('darkMetal', cx - 0.45, 17.3, cz - 0.06, cx + 0.45, 17.42, cz + 0.06);
  W.collision.add(cx - 2.6, 9, cz - 2.6, cx + 2.6, 16.5, cz + 2.6, 'stone');
  // arched portal + narrow windows
  W.deco('woodDark', cx - 0.8, 0, cz + 7.02, cx + 0.8, 2.6, cz + 7.08);
  W.deco('basalt', cx - 1.1, 2.6, cz + 7.0, cx + 1.1, 3.0, cz + 7.12);
  for (const [dx, dz] of [[0, -7.04], [7.04, 0], [-7.04, 0]]) {
    const ax = dz === 0;
    W.deco('pane', cx + dx - (ax ? 0.04 : 0.25), 3.5, cz + dz - (ax ? 0.25 : 0.04), cx + dx + (ax ? 0.04 : 0.25), 5.4, cz + dz + (ax ? 0.25 : 0.04));
  }
}

function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}

// ------------------------------------------------------------------ industry
function industry(W) {
  W.deco('concreteNP', 34, -0.2, -140, 154, 0.02, -46, { uv: 8 });
  warehouse(W, 72, -112, 32, 22, 9, 'metal');
  warehouse(W, 126, -114, 24, 20, 8, 'metalW', true);
  W.building({ x: 52, z: -60, w: 12, d: 10, floors: 2, mat: 'concrete', doors: [{ side: 's', off: 0 }, { side: 'e', off: 1 }], tier: 1.1 });
  P.sign(W, 'ԳՈՐԾԱՐԱՆ', 52, 7.2, -54.8, 0, 6, 1.2, { bg: '#20262c', fg: '#f0b400', sub: 'Վարչական մասնաշենք', h: 160 });
  // Container yard (maze of 1-2 high stacks).
  const mats = ['cRed', 'cBlue', 'cGreen', 'cOrange', 'cGrey'];
  const r = W.rng;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 3; j++) {
      if ((i === 2 && j === 1) || (i === 4 && j === 0)) continue;
      const x = 86 + i * 12 + (r() - 0.5) * 2, z = -76 + j * 11;
      const axis = (i + j) % 3 === 0 ? 'z' : 'x';
      const open = r() < 0.25;
      const top = P.container(W, x, z, axis, mats[Math.floor(r() * mats.length)], 0, open);
      if (!open && r() < 0.55) P.container(W, x + (r() - 0.5) * 0.6, z, axis, mats[Math.floor(r() * mats.length)], top);
      if (!open && r() < 0.3) W.lootSpots.push({ x: x + (axis === 'x' ? 4.2 : 0), y: 0.05, z: z + (axis === 'z' ? 4.2 : 0), tier: 1 });
    }
  }
  W.lootSpots.push({ x: 110, y: 0.05, z: -65, tier: 1.4 });
  P.waterTower(W, 148, -52);
  P.chimney(W, 146, -134, 32);
  P.truck(W, 100, -94, 'x');
  P.truck(W, 40, -86, 'z', [0.6, 0.45, 0.18]);
  // forklift
  W.solid('paintYellow', 58, 0.3, -92, 60.2, 1.6, -90.8);
  W.deco('darkMetal', 60.2, 0, -92, 60.35, 3.2, -90.8);
  for (const [x, z] of [[44, -100], [45, -101], [44.5, -98.8], [118, -92], [118.8, -92.6], [150, -90]]) P.barrel(W, x, z);
  for (const [x, z] of [[64, -96], [66.5, -96.4], [140, -60], [104, -134]]) P.pallets(W, x, z, 4);
  P.tires(W, 136, -88); P.tires(W, 137, -86.8, 2);
  P.crate(W, 90, -97, 1.2, null, 2); P.crate(W, 92, -98.5, 1.0);
  // Perimeter fence with gaps.
  P.fence(W, 34, -141, 70, -141); P.fence(W, 80, -141, 154, -141);
  P.fence(W, 154, -141, 154, -100); P.fence(W, 154, -88, 154, -48);
  P.fence(W, 33, -141, 33, -110); P.fence(W, 33, -96, 33, -70);
  W.patrolPoints.push({ x: 72, z: -112 }, { x: 126, z: -114 }, { x: 110, z: -66 }, { x: 52, z: -80 });
}

function warehouse(W, cx, cz, w, d, h, mat, damaged = false) {
  const t = 0.35;
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const highWin = (a, b) => {
    const out = [];
    for (let p = a + 2; p < b - 2; p += 4) out.push({ a: p, b: p + 2.2, lo: h - 2.6, hi: h - 1.2 });
    return out;
  };
  const sDoor = { a: cx - 7, b: cx - 1, lo: -1, hi: 5.2 };
  const nDoor = { a: cx + 2, b: cx + 8, lo: -1, hi: 5.2 };
  const eDoor = { a: cz - 2, b: cz + 2, lo: -1, hi: 3 };
  W.wallX(mat, x0, x1, z1, -0.4, h, t, [sDoor, ...highWin(x0, x1).filter((o) => o.b < sDoor.a || o.a > sDoor.b)], false);
  W.wallX(mat, x0, x1, z0, -0.4, h, t, [nDoor, ...highWin(x0, x1).filter((o) => o.b < nDoor.a || o.a > nDoor.b)], false);
  W.wallZ(mat, z0 + t / 2, z1 - t / 2, x0, -0.4, h, t, damaged ? [{ a: cz - 3, b: cz + 3, lo: -1, hi: 4.5 }] : [{ a: cz + 3, b: cz + 6, lo: -1, hi: 2.6 }], false);
  W.wallZ(mat, z0 + t / 2, z1 - t / 2, x1, -0.4, h, t, [eDoor], false);
  W.deco('darkMetal', sDoor.a - 0.2, sDoor.hi, z1 - 0.3, sDoor.b + 0.2, sDoor.hi + 0.3, z1 + 0.3);
  W.deco('darkMetal', nDoor.a - 0.2, nDoor.hi, z0 - 0.3, nDoor.b + 0.2, nDoor.hi + 0.3, z0 + 0.3);
  // Roof (damaged warehouse has a hole letting light in).
  if (damaged) W.slab('roofTin', x0, z0, x1, z1, h, h + 0.2, [[cx - 4, cz - 5, cx + 5, cz + 3]]);
  else W.solid('roofTin', x0, h, z0, x1, h + 0.2, z1);
  W.deco('darkMetal', x0 - 0.3, h + 0.2, z0 - 0.3, x1 + 0.3, h + 0.4, z0);
  W.deco('darkMetal', x0 - 0.3, h + 0.2, z1, x1 + 0.3, h + 0.4, z1 + 0.3);
  W.solid('concreteNP', x0 + t / 2, -0.2, z0 + t / 2, x1 - t / 2, 0.06, z1 - t / 2, { cover: false });
  // Steel trusses (visual)
  for (let x = x0 + 4; x < x1 - 1; x += 4) W.deco('darkMetal', x - 0.1, h - 0.6, z0, x + 0.1, h - 0.4, z1);
  const tier = damaged ? 1.1 : 1.3;
  if (!damaged) {
    // Mezzanine catwalk along the north wall + stairs.
    const my = 4.2;
    const mz1 = z0 + 3.2;
    W.solid('darkMetal', x0 + 1.5, my - 0.15, z0 + t / 2, x1 - 1.5, my, mz1, { cover: false });
    W.solid('darkMetal', x0 + 1.5, my, mz1 - 0.05, x1 - 6.2, my + 1.05, mz1 + 0.05, { noBullet: true, cover: false });
    W.solid('darkMetal', x0 + 1.5, my, z0 + t / 2, x0 + 1.6, my + 1.05, mz1, { noBullet: true, cover: false });
    for (let x = x0 + 3; x < x1 - 2; x += 5) W.solid('darkMetal', x - 0.12, 0, mz1 - 0.3, x + 0.12, my - 0.15, mz1 - 0.06, { cover: false });
    W.stairsZ('darkMetal', mz1 + 4.2, x1 - 5.9, x1 - 4.6, 0, my, -1);
    W.lootSpots.push({ x: cx - 6, y: my, z: z0 + 1.6, tier: tier + 0.3 });
    W.lootSpots.push({ x: cx + 4, y: my, z: z0 + 1.6, tier });
    // Shelving racks
    for (let i = 0; i < 3; i++) {
      const rx = x0 + 6 + i * 7;
      W.solid('darkMetal', rx, 0, cz + 0.5, rx + 4.5, 3.2, cz + 1.6);
      P.crate(W, rx + 1, cz + 1.05, 0.9, 3.2);
    }
    P.container(W, x1 - 5, z1 - 3, 'x', 'cBlue', 0.06);
  } else {
    P.container(W, cx - 6, cz + 4, 'z', 'cRed', 0.06, true);
    P.crate(W, cx + 3, cz - 4, 1.2, 0.06, 2); P.crate(W, cx + 4.5, cz - 4.2, 1.1, 0.06);
    W.solid('concrete', cx + 6, 0, cz + 2, cx + 7, 1.2, cz + 6);
  }
  P.crate(W, cx - 9, z1 - 3, 1.2, 0.06, 2);
  P.crate(W, cx + 9, cz - 2, 1.1, 0.06);
  for (let i = 0; i < 3; i++) W.lootSpots.push({ x: cx + (i - 1) * w * 0.28, y: 0.06, z: cz + (i === 1 ? -3 : 4), tier });
}

// ------------------------------------------------------------------ checkpoint
function checkpoint(W) {
  W.deco('concreteNP', -26, -0.2, 78, 26, 0.02, 122, { uv: 6 });
  W.building({ x: -11, z: 93, w: 4.4, d: 4.4, floors: 1, mat: 'concrete', doors: [{ side: 'e', off: 0 }], roofAccess: false, parapet: false, interior: false, winSpacing: 2 });
  W.building({ x: 11, z: 107, w: 4.4, d: 4.4, floors: 1, mat: 'concrete', doors: [{ side: 'w', off: 0 }], roofAccess: false, parapet: false, interior: false, winSpacing: 2 });
  W.deco('metalW', -13.6, 3.45, 90.4, -8.4, 3.6, 95.6);
  W.deco('metalW', 8.4, 3.45, 104.4, 13.6, 3.6, 109.6);
  W.lootSpots.push({ x: -11.5, y: 0.08, z: 93, tier: 1.3 }, { x: 11.5, y: 0.08, z: 107, tier: 1.3 });
  // Boom gates (red/white striped).
  for (const [z, dir] of [[96.5, 1], [103.5, -1]]) {
    const px = dir > 0 ? -6.8 : 6.8;
    W.solid('concrete', px - 0.3, 0, z - 0.3, px + 0.3, 1.1, z + 0.3);
    for (let i = 0; i < 6; i++) {
      const xa = px + dir * i * 1.1, xb = px + dir * (i + 1) * 1.1;
      W.deco(i % 2 ? 'paintWhite' : 'paintRed', Math.min(xa, xb), 0.95, z - 0.06, Math.max(xa, xb), 1.07, z + 0.06);
    }
  }
  // Staggered jersey barriers.
  P.jersey(W, -3, 82, 'x'); P.jersey(W, 3.2, 87, 'x'); P.jersey(W, -3, 113, 'x'); P.jersey(W, 3.2, 118, 'x');
  P.jersey(W, -9, 104, 'z'); P.jersey(W, 9, 96, 'z');
  // Sandbag nests (U shapes).
  for (const [x, z, s] of [[-17, 100, 1], [17, 94, -1]]) {
    P.sandbags(W, x - 2, z - 2, x + 2, z - 1.4);
    P.sandbags(W, x + s * 2 - 0.3, z - 1.4, x + s * 2 + 0.3, z + 1.6);
    P.sandbags(W, x - 2, z + 1.6, x - 0.6, z + 2.2);
    W.lootSpots.push({ x, y: 0.05, z, tier: 1.2 });
  }
  watchtower(W, 19, 117);
  W.building({ x: -19, z: 115, w: 12, d: 8, floors: 2, mat: 'concrete', doors: [{ side: 'e', off: 0 }, { side: 'n', off: 3 }], tier: 1.3 });
  P.truck(W, 15, 82, 'z');
  P.car(W, -14, 80.5, 'x', [0.3, 0.35, 0.25]);
  P.tires(W, 22, 100); P.tires(W, -23, 96, 4);
  P.crate(W, 23, 105, 1.1, null, 2); P.barrel(W, -22, 106); P.barrel(W, -22.6, 106.8);
  P.sign(W, 'ԿԱՆԳ', 7.5, 2.4, 89.6, Math.PI, 1.6, 0.8, { bg: '#b0201a', fg: '#ffffff' });
  W.solid('darkMetal', 7.45, 0, 89.62, 7.55, 2.0, 89.72, { cover: false });
  P.sign(W, 'ԱՆՑԱԿԵՏ', -11, 3.95, 95.3, 0, 3.6, 0.7, { bg: '#2b3b2b', fg: '#e6dfc4' });
  P.fence(W, -27, 76, -27, 92); P.fence(W, -27, 108, -27, 124); P.fence(W, 27, 76, 27, 90); P.fence(W, 27, 106, 27, 124);
  W.patrolPoints.push({ x: 0, z: 100 }, { x: -18, z: 104 }, { x: 18, z: 104 });
}

function watchtower(W, x, z) {
  const g = W.h(x, z);
  const py = g + 4.6;
  for (const a of [-1, 1]) for (const b of [-1, 1]) W.solid('woodDark', x + a * 1.4 - 0.12, g, z + b * 1.4 - 0.12, x + a * 1.4 + 0.12, py + 2.4, z + b * 1.4 + 0.12, { cover: false });
  W.solid('wood', x - 1.6, py - 0.2, z - 1.6, x + 1.6, py, z + 1.6, { cover: false });
  // railing / half walls with gap for the stairs (south side, west half)
  W.solid('wood', x - 1.6, py, z - 1.6, x + 1.6, py + 1.0, z - 1.5);
  W.solid('wood', x - 1.6, py, z - 1.6, x - 1.5, py + 1.0, z + 1.6);
  W.solid('wood', x + 1.5, py, z - 1.6, x + 1.6, py + 1.0, z + 1.6);
  W.solid('wood', x + 0.1, py, z + 1.5, x + 1.6, py + 1.0, z + 1.6);
  W.deco('roofTin', x - 1.9, py + 2.4, z - 1.9, x + 1.9, py + 2.55, z + 1.9);
  W.stairsZ('wood', z + 1.6 + 4.6, x - 1.4, x - 0.2, g, 4.6, -1, 11, 0.42);
  W.lootSpots.push({ x: x + 0.6, y: py, z: z - 0.6, tier: 1.8 });
}

// ------------------------------------------------------------------ fortress
function fort(W) {
  const m = 'tuffB';
  const R = 24, t = 1.4, H = 5.5;
  W.deco('basalt', -R, -0.2, -R, R, 0.03, R, { uv: 2.2 });
  // Outer walls with 4 gates and collapsed sections.
  const gate = (c) => ({ a: c - 3, b: c + 3, lo: -1, hi: 4.0 });
  W.wallX(m, -R - t / 2, R + t / 2, -R, -0.5, H, t, [gate(0)], false);
  W.wallX(m, -R - t / 2, R + t / 2, R, -0.5, H, t, [gate(0)], false);
  W.wallZ(m, -R + t / 2, R - t / 2, -R, -0.5, H, t, [gate(0), { a: -15, b: -10, lo: 0.9, hi: 99 }], false);
  W.wallZ(m, -R + t / 2, R - t / 2, R, -0.5, H, t, [gate(0), { a: 8, b: 14, lo: 1.5, hi: 99 }], false);
  // Gate arches.
  for (const [ax, az, along] of [[0, -R, 'x'], [0, R, 'x'], [-R, 0, 'z'], [R, 0, 'z']]) {
    if (along === 'x') W.deco('basalt', ax - 3.3, 3.9, az - t / 2 - 0.1, ax + 3.3, 4.4, az + t / 2 + 0.1);
    else W.deco('basalt', ax - t / 2 - 0.1, 3.9, az - 3.3, ax + t / 2 + 0.1, 4.4, az + 3.3);
  }
  // Merlons on the outer edge of the walls.
  for (let p = -R; p <= R; p += 1.8) {
    if (Math.abs(p) < 3.5) continue;
    W.solid(m, p - 0.45, H, -R - t / 2, p + 0.45, H + 0.85, -R - t / 2 + 0.45);
    W.solid(m, p - 0.45, H, R + t / 2 - 0.45, p + 0.45, H + 0.85, R + t / 2);
    if (!(p > -15.5 && p < -9.5)) W.solid(m, -R - t / 2, H, p - 0.45, -R - t / 2 + 0.45, H + 0.85, p + 0.45);
    if (!(p > 7.5 && p < 14.5)) W.solid(m, R + t / 2 - 0.45, H, p - 0.45, R + t / 2, H + 0.85, p + 0.45);
  }
  // Rubble at the breaches.
  P.rockMesh(W, -R + 1.6, -12.5, 1.3, 0.5); P.rockMesh(W, R - 1.8, 11, 1.4, 0.5); P.rockMesh(W, R + 1.8, 9.5, 1.0, 0.5);
  // Corner towers.
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const x = a * R, z = b * R;
    W.solid(m, x - 3, -0.5, z - 3, x + 3, 8, z + 3);
    W.deco('basalt', x - 3.2, 8, z - 3.2, x + 3.2, 8.3, z + 3.2);
    W.gableRoof(x, z, 6.4, 6.4, 8.3, 1.6, 0);
  }
  // Stairs to the north & south wall walkways.
  W.stairs('basalt', -15, -R + t / 2, -R + t / 2 + 1.3, 0, H, 1, 13, 0.42);
  W.stairs('basalt', 15, R - t / 2 - 1.3, R - t / 2, 0, H, -1, 13, 0.42);
  // Central keep (tall, enterable, best loot).
  W.building({ x: 0, z: -7, w: 10, d: 10, floors: 3, mat: 'tuff', doors: [{ side: 's', off: 0 }, { side: 'w', off: 1 }], tier: 2.4, cornice: true });
  P.sign(W, 'ՀԻՆ ԲԵՐԴ', 0, 3.3, -1.75, 0, 2.6, 0.5, { bg: '#3b2a20', fg: '#e8c88f' });
  // East arcade (covered gallery).
  for (let z = -15; z <= 15; z += 3.75) W.solid('tuff', 13.6, 0, z - 0.35, 14.3, 4.1, z + 0.35);
  W.solid('tuff', 13.2, 4.1, -15.6, 22.5, 4.6, 15.6, { cover: false });
  W.deco('roofTin', 13, 4.6, -15.8, 22.7, 4.75, 15.8);
  for (let i = 0; i < 3; i++) W.lootSpots.push({ x: 18.5, y: 0.05, z: -10 + i * 10, tier: 2 });
  // Ruined rooms (south-west).
  const ruins = [[-18, 6, -10, 6.4, 2.2], [-18, 6, -18, 16, 1.4], [-10, 6, -10, 12, 2.6], [-18, 16, -13, 16.4, 1.1], [-7, 13, -2, 13.4, 1.8]];
  for (const [x0, z0, x1, z1, h] of ruins) {
    if (x0 === x1) W.solid('tuffB', x0 - 0.3, -0.3, z0, x0 + 0.3, h, z1);
    else W.solid('tuffB', x0, -0.3, z0 - 0.2, x1, h, z1);
  }
  W.lootSpots.push({ x: -14, y: 0.05, z: 10, tier: 2.2 }, { x: -5, y: 0.05, z: 16, tier: 1.8 });
  // Well
  const well = new THREE.CylinderGeometry(1.1, 1.2, 1.0, 12, 1, true);
  W.mesh('basalt', well, 8, 0.5, 10, 0);
  W.collision.add(8 - 1.1, 0, 10 - 1.1, 8 + 1.1, 1.0, 10 + 1.1, 'stone');
  W.deco('woodDark', 6.8, 1.0, 9.9, 9.2, 1.1, 10.1);
  P.khachkar(W, -6, -14.2, 0); P.khachkar(W, -8, -14.4, 0.12);
  P.crate(W, 9, -16, 1.1, 0.03, 2); P.crate(W, -12, -6, 1.0, 0.03); P.barrel(W, 10.5, 18); P.barrel(W, 11.2, 17.2);
  P.sandbags(W, -4, 19, 4, 19.6);
  W.lootSpots.push({ x: 0, y: H, z: -R, tier: 1.8 }, { x: -6, y: H, z: R, tier: 1.6 });
  W.patrolPoints.push({ x: 0, z: 8 }, { x: -12, z: 0 }, { x: 10, z: -12 });
}

// ------------------------------------------------------------------ hills
function hills(W) {
  // Find the highest walkable spot near the hills centre for a shepherd hut.
  let best = { x: 105, z: 98, h: -1 };
  for (let x = 85; x <= 130; x += 3) for (let z = 75; z <= 125; z += 3) {
    const h = W.h(x, z);
    if (h > best.h && W.terrain.slope(x, z) < 0.5) best = { x, z, h };
  }
  hut(W, best.x, best.z);
  P.khachkar(W, best.x + 6, best.z + 1, Math.PI / 2);
  P.khachkar(W, best.x + 6.2, best.z - 1.3, Math.PI / 2 + 0.2);
  const r = W.rng;
  let placed = 0;
  for (let i = 0; i < 400 && placed < 46; i++) {
    const a = r() * Math.PI * 2, d = 10 + r() * 62;
    const x = 105 + Math.cos(a) * d, z = 98 + Math.sin(a) * d;
    if (Math.abs(x) < 9 || Math.abs(x - best.x) < 7 && Math.abs(z - best.z) < 7) continue;
    if (Math.abs(x) > 150 || Math.abs(z) > 150) continue;
    const s = 0.9 + r() * 2.4;
    P.rockMesh(W, x, z, s, 0.55 + r() * 0.4);
    placed++;
  }
  // Ruined stone walls on the slopes.
  for (const [x, z, len, ax] of [[86, 80, 8, 'x'], [122, 76, 6, 'z'], [96, 118, 7, 'x'], [130, 110, 5, 'z'], [80, 106, 6, 'z']]) {
    const g = W.h(x, z);
    const hx = ax === 'x' ? len / 2 : 0.35, hz = ax === 'x' ? 0.35 : len / 2;
    W.solid('tuffB', x - hx, g - 1.2, z - hz, x + hx, g + 1.0 + r() * 0.8, z + hz);
    W.lootSpots.push({ x: x + (ax === 'x' ? 0 : 1.2), y: W.h(x + (ax === 'x' ? 0 : 1.2), z + (ax === 'x' ? 1.2 : 0)) + 0.05, z: z + (ax === 'x' ? 1.2 : 0), tier: 0.6 });
  }
  W.patrolPoints.push({ x: best.x, z: best.z + 6 }, { x: 90, z: 85 }, { x: 120, z: 115 });
}

function hut(W, x, z) {
  const w = 7, d = 6, t = 0.4;
  let base = -Infinity;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) base = Math.max(base, W.h(x + a * w / 2, z + b * d / 2));
  base += 0.15;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const H = base + 3;
  const win = (c) => ({ a: c - 0.5, b: c + 0.5, lo: base + 1.1, hi: base + 2.0 });
  W.wallX('basalt', x0, x1, z0, base - 3, H, t, [win(x - 1.5), win(x + 1.5)]);
  W.wallX('basalt', x0, x1, z1, base - 3, H, t, [{ a: x - 0.8, b: x + 0.8, lo: base - 3, hi: base + 2.3 }]);
  W.wallZ('basalt', z0 + t / 2, z1 - t / 2, x0, base - 3, H, t, [win(z)]);
  W.wallZ('basalt', z0 + t / 2, z1 - t / 2, x1, base - 3, H, t, [win(z)]);
  W.solid('woodDark', x0 + t / 2, base - 3, z0 + t / 2, x1 - t / 2, base, z1 - t / 2, { cover: false });
  W.gableRoof(x, z, w + 0.6, d + 0.6, H, 1.6, 0);
  W.solid('wood', x - 2.6, base, z0 + 0.4, x - 1.4, base + 0.9, z0 + 1.2);
  W.lootSpots.push({ x: x + 1, y: base, z, tier: 1.6 });
  // Steps up to the door so it's reachable on a slope.
  const g = W.h(x, z1 + 1.5);
  if (base - g > 0.3) {
    const n = Math.ceil((base - g + 0.5) / 0.35);
    W.stairsZ('basalt', z1 + 0.15 + n * 0.4, x - 0.8, x + 0.8, g - 0.5, base - g + 0.5, -1, n, 0.4);
  }
}

// ------------------------------------------------------------------ forest
function forest(W) {
  const cx = -105, cz = 95;
  W.building({ x: cx, z: cz, w: 8, d: 7, floors: 1, mat: 'woodDark', floorMat: 'wood', doors: [{ side: 'e', off: 0 }], roofAccess: false, parapet: false, cornice: false, tier: 1.2 });
  W.gableRoof(cx, cz, 8.8, 7.8, 3.45, 2.0, 0);
  P.crate(W, cx + 6, cz + 2, 1.0, null, 2);
  // woodpile
  const log = new THREE.CylinderGeometry(0.18, 0.18, 2.2, 8).rotateX(Math.PI / 2);
  for (let i = 0; i < 6; i++) W.mesh('woodDark', log, cx - 5.2, 0.2 + Math.floor(i / 3) * 0.34, cz - 2 + (i % 3) * 0.36, Math.PI / 2);
  W.collision.add(cx - 6.3, 0, cz - 2.3, cx - 4.1, 0.75, cz - 1.1, 'wood');
  // Fallen logs + rocks through the forest.
  const r = W.rng;
  const bigLog = new THREE.CylinderGeometry(0.4, 0.45, 1, 10).rotateZ(Math.PI / 2);
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = 14 + r() * 50;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (Math.abs(x) < 10 || Math.abs(x) > 150 || Math.abs(z) > 150) continue;
    const len = 4 + r() * 4;
    const g = W.h(x, z);
    const ax = r() < 0.5;
    W.mesh('woodDark', bigLog, x, g + 0.35, z, ax ? 0 : Math.PI / 2, len, 1, 1);
    if (ax) W.collision.add(x - len / 2, g - 0.5, z - 0.42, x + len / 2, g + 0.8, z + 0.42, 'wood');
    else W.collision.add(x - 0.42, g - 0.5, z - len / 2, x + 0.42, g + 0.8, z + len / 2, 'wood');
    if (r() < 0.5) W.lootSpots.push({ x: x + (ax ? 0 : 1.0), y: W.h(x + (ax ? 0 : 1), z + (ax ? 1 : 0)) + 0.05, z: z + (ax ? 1.0 : 0), tier: 0.5 });
  }
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = 12 + r() * 55;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (Math.abs(x) < 10 || Math.abs(x) > 150 || Math.abs(z) > 150) continue;
    P.rockMesh(W, x, z, 0.8 + r() * 1.8, 0.6);
  }
  // Hunter stand
  const hx = -82, hz = 118, g = W.h(hx, hz);
  for (const a of [-1, 1]) for (const b of [-1, 1]) W.solid('woodDark', hx + a - 0.08, g - 0.5, hz + b - 0.08, hx + a + 0.08, g + 3.2, hz + b + 0.08, { cover: false });
  W.solid('wood', hx - 1.1, g + 2.4, hz - 1.1, hx + 1.1, g + 2.55, hz + 1.1, { cover: false });
  W.solid('wood', hx - 1.1, g + 2.55, hz - 1.1, hx + 1.1, g + 3.4, hz - 1.0);
  W.stairsZ('wood', hz + 1.1 + 2.9, hx - 0.5, hx + 0.5, g - 0.2, 2.75, -1, 7, 0.42);
  W.lootSpots.push({ x: hx, y: g + 2.55, z: hz, tier: 1.5 });
  W.patrolPoints.push({ x: cx + 6, z: cz }, { x: -90, z: 120 }, { x: -125, z: 75 });
}

// ------------------------------------------------------------------ open fields
function fields(W) {
  const r = W.rng;
  const bale = new THREE.CylinderGeometry(0.75, 0.75, 1.3, 14).rotateZ(Math.PI / 2);
  const spots = [[45, 40], [52, 46], [-46, 36], [-40, 44], [40, 18], [-52, -6], [60, -10], [-30, 60], [32, 62]];
  for (const [x, z] of spots) {
    const g = W.h(x, z);
    W.mesh('sandbag', bale, x, g + 0.72, z, r() * 0.3, 1, 1, 1, [1.15, 1.0, 0.6]);
    W.collision.add(x - 0.7, g - 0.2, z - 0.75, x + 0.7, g + 1.45, z + 0.75, 'dirt');
    if (r() < 0.6) W.lootSpots.push({ x: x + 1.6, y: W.h(x + 1.6, z) + 0.05, z, tier: 0.5 });
  }
  // A ruined farmhouse between the fortress and the forest.
  const fx = -48, fz = 52;
  for (const [x0, z0, x1, z1, h] of [[fx - 4, fz - 3, fx + 4, fz - 2.6, 2.6], [fx - 4, fz + 2.6, fx - 0.5, fz + 3, 1.8], [fx - 4.2, fz - 3, fx - 3.8, fz + 3, 2.2], [fx + 3.8, fz - 3, fx + 4.2, fz + 1, 1.3]]) {
    const g = Math.min(W.h(x0, z0), W.h(x1, z1));
    W.solid('tuffB', x0, g - 1, z0, x1, g + h, z1);
  }
  W.lootSpots.push({ x: fx, y: W.h(fx, fz) + 0.05, z: fz, tier: 1.1 });
  // Stone sheep-fold walls between the fort and the hills.
  for (const [x, z, len] of [[52, 58, 10], [64, 30, 8], [-60, 20, 9]]) {
    const g = W.h(x, z);
    W.solid('basalt', x - len / 2, g - 1, z - 0.35, x + len / 2, g + 1.1, z + 0.35);
  }
}

function spawns(W) {
  const pts = [
    [-140, -96], [-100, -134], [-46, -74], [-122, -46], [-70, -100],
    [44, -122], [110, -50], [146, -100], [90, -136], [62, -74],
    [-24, 88], [24, 124], [0, 136],
    [80, 70], [132, 122], [100, 142], [140, 68],
    [-80, 70], [-132, 122], [-100, 142], [-140, 66],
    [-48, 30], [48, 32], [-40, -2], [40, -2], [0, -58], [0, 56], [-150, 10], [150, 10],
  ];
  for (const [x, z] of pts) W.spawnPoints.push({ x, z });
}
