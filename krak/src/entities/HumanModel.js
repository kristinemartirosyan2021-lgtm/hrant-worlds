// Procedurally built, procedurally animated human character with two-bone IK arms.
import * as THREE from 'three';
import { PartSet, GEO, stdMat } from './meshUtil.js';
import { buildWeaponModel } from './WeaponModels.js';
import { clamp, damp, lerp, wrapAngle } from '../core/util.js';

export const CHARACTERS = [
  { id: 'areg', name: 'ԱՐԵԳ', role: 'Գրոհային', bio: 'Արագ, համարձակ, միշտ առաջին գծում։', unlock: 1,
    look: { skin: '#c8977a', hair: '#2a1d15', hairStyle: 'short', jacket: '#4d5a3a', pants: '#2f3338', vest: '#6d5b40', accent: '#e07a2b', headgear: null, beard: 'stubble', backpack: true, scarf: true } },
  { id: 'narek', name: 'ՆԱՐԵԿ', role: 'Հետախույզ', bio: 'Լուռ է ու համբերատար։ Տեսնում է առաջինը։', unlock: 1,
    look: { skin: '#b9876a', hair: '#1a1410', hairStyle: 'buzz', jacket: '#2b2d31', pants: '#3a4a5a', vest: '#1d1f22', accent: '#3fd0c9', headgear: 'beanie', hgColor: '#222326', beard: 'full', backpack: true } },
  { id: 'ani', name: 'ԱՆԻ', role: 'Դիպուկահար', bio: 'Մեկ կրակոց, մեկ որոշում։', unlock: 1,
    look: { skin: '#d9a98c', hair: '#3a2016', hairStyle: 'pony', jacket: '#6d2433', pants: '#24262b', vest: '#55585c', accent: '#e2b23c', headgear: null, female: true, backpack: false } },
  { id: 'davit', name: 'ԴԱՎԻԹ', role: 'Պաշտպան', bio: 'Ծանր քայլ, հաստատուն ձեռք։', unlock: 1,
    look: { skin: '#a87458', hair: '#15100c', hairStyle: 'bald', jacket: '#233149', pants: '#5b5f63', vest: '#4b5a34', accent: '#c0392b', headgear: 'bandana', hgColor: '#8b1e1e', beard: 'full', backpack: true, bulky: true } },
  { id: 'mari', name: 'ՄԱՐԻ', role: 'Բժիշկ', bio: 'Գիտի ինչպես փրկել և ինչպես հաղթել։', unlock: 3,
    look: { skin: '#e0b49a', hair: '#8a3b1c', hairStyle: 'bob', jacket: '#a08a64', pants: '#4a5236', vest: '#3d3a33', accent: '#f2efe6', headgear: 'cap', hgColor: '#6b5a3f', female: true, backpack: true } },
  { id: 'hayk', name: 'ՀԱՅԿ', role: 'Հրամանատար', bio: 'Լեգենդար նետաձիգի անունը կրողը։', unlock: 5,
    look: { skin: '#c08c6c', hair: '#120e0b', hairStyle: 'short', jacket: '#17191b', pants: '#202225', vest: '#2b2b2b', accent: '#ff7a1a', headgear: 'helmet', hgColor: '#2e3a2a', beard: 'stubble', goggles: true, backpack: true, bulky: true } },
];

export const SKINS = [
  { id: 'default', name: 'Հիմնական', unlock: 1, colors: null },
  { id: 'apricot', name: 'Ծիրան', unlock: 2, colors: { jacket: '#c9792c', vest: '#5a3a22', accent: '#ffb04a' } },
  { id: 'ararat', name: 'Ձյունե լեռ', unlock: 4, colors: { jacket: '#d9dde0', vest: '#8f979c', pants: '#6f767b', accent: '#9fd3ff' } },
  { id: 'night', name: 'Գիշեր', unlock: 6, colors: { jacket: '#14161a', vest: '#0c0d0f', pants: '#121316', accent: '#ff3355' } },
  { id: 'pomegranate', name: 'Նուռ', unlock: 8, colors: { jacket: '#8e1630', vest: '#3b0d17', accent: '#ff5c7a' } },
  { id: 'gold', name: 'Ոսկե արծիվ', unlock: 10, colors: { jacket: '#2a2418', vest: '#b8902e', pants: '#3a3224', accent: '#ffd25a' } },
];

const BOT_SKIN = ['#e0b49a', '#c8977a', '#b9876a', '#a87458', '#d9a98c', '#8d5f45'];
const BOT_HAIR = ['#15100c', '#2a1d15', '#3a2016', '#5a3a22', '#1a1410'];
const BOT_JACKET = ['#4d5a3a', '#3b4250', '#5a4a3a', '#2b2d31', '#6b5d45', '#45503f', '#383d42', '#5c3a2e', '#3f4a52', '#6e6a5e'];
const BOT_PANTS = ['#2f3338', '#3a4a5a', '#4a5236', '#24262b', '#5b5f63', '#3d3a33'];
const BOT_VEST = ['#6d5b40', '#1d1f22', '#4b5a34', '#55585c', '#3d3a33', '#5a4a36'];
const BOT_HG = [null, null, 'beanie', 'cap', 'helmet', 'bandana', null];
const BOT_HAIRSTYLE = ['short', 'buzz', 'bald', 'short', 'bob', 'pony'];

export function randomLook(rng = Math.random) {
  const p = (a) => a[Math.floor(rng() * a.length)];
  const hairStyle = p(BOT_HAIRSTYLE);
  const female = hairStyle === 'bob' || hairStyle === 'pony';
  return {
    skin: p(BOT_SKIN), hair: p(BOT_HAIR), hairStyle, female,
    jacket: p(BOT_JACKET), pants: p(BOT_PANTS), vest: p(BOT_VEST), accent: '#' + new THREE.Color().setHSL(rng(), 0.6, 0.5).getHexString(),
    headgear: p(BOT_HG), hgColor: p(['#222326', '#3a4630', '#5a4a36', '#6b1e1e', '#2e3a2a']),
    beard: !female && rng() < 0.45 ? p(['stubble', 'full']) : null, backpack: rng() < 0.6, bulky: rng() < 0.25,
  };
}

export function applySkin(look, skinId) {
  const s = SKINS.find((k) => k.id === skinId);
  return s && s.colors ? { ...look, ...s.colors } : look;
}

const DOWN = new THREE.Vector3(0, -1, 0);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();

export class HumanModel {
  constructor(look) {
    this.look = look;
    this.root = new THREE.Group();
    this.root.name = 'human';
    this.root.rotation.order = 'YXZ';
    // Mirror so local +X is the character's right-hand side when facing +Z.
    this.root.scale.x = -1;
    this.build(look);
    this.phase = Math.random() * 6;
    this.crouchF = 0;
    this.aimF = 0;
    this.sprintF = 0;
    this.airF = 0;
    this.hipYaw = 0;
    this.flinch = new THREE.Vector2();
    this.kick = 0;
    this.deathT = -1;
    this.weaponId = null;
    this.lowerF = 0;
    this.stepCb = null;
    this.lastStepSign = 1;
  }

  build(L) {
    const skin = stdMat(L.skin, 0.62);
    const hair = stdMat(L.hair, 0.9);
    const jacket = stdMat(L.jacket, 0.88);
    const pants = stdMat(L.pants, 0.9);
    const vest = stdMat(L.vest, 0.82, 0.05);
    const dark = stdMat('#151515', 0.7);
    const boots = stdMat('#2a2420', 0.75);
    const glove = stdMat('#232323', 0.8);
    const accent = stdMat(L.accent, 0.6);
    const hg = stdMat(L.hgColor || '#333', 0.85);
    const bw = L.bulky ? 1.08 : L.female ? 0.92 : 1;

    const hips = (this.hips = new THREE.Group());
    hips.position.y = 0.98;
    this.root.add(hips);
    new PartSet()
      .box(pants, 0.32 * bw, 0.17, 0.2, 0, 0, 0)
      .box(dark, 0.34 * bw, 0.05, 0.22, 0, 0.07, 0)
      .box(vest, 0.08, 0.1, 0.06, 0.15 * bw, -0.02, 0.07)
      .build(hips);

    const spine = (this.spine = new THREE.Group());
    spine.position.y = 0.08;
    hips.add(spine);
    const torso = new PartSet()
      .add(GEO.capsule, jacket, 0, 0.22, 0, 0.36 * bw, 0.2, 0.22)
      .box(vest, 0.38 * bw, 0.3, 0.26, 0, 0.25, 0.005)
      .box(vest, 0.09, 0.1, 0.05, -0.1 * bw, 0.17, 0.14)
      .box(vest, 0.09, 0.1, 0.05, 0.0, 0.17, 0.14)
      .box(vest, 0.09, 0.1, 0.05, 0.1 * bw, 0.17, 0.14)
      .box(accent, 0.12, 0.03, 0.01, -0.1, 0.34, 0.135);
    if (L.backpack) torso.box(stdMat('#3b3a30', 0.9), 0.3, 0.36, 0.15, 0, 0.24, -0.19).box(dark, 0.26, 0.05, 0.16, 0, 0.42, -0.19);
    if (L.scarf) torso.add(GEO.capsule, accent, 0, 0.43, 0.01, 0.2, 0.06, 0.17, 0, 0, Math.PI / 2);
    torso.build(spine);

    const chest = (this.chest = new THREE.Group());
    chest.position.y = 0.44;
    spine.add(chest);
    new PartSet().add(GEO.cylY, skin, 0, 0.05, 0, 0.1, 0.1, 0.1).build(chest);

    const head = (this.head = new THREE.Group());
    head.position.set(0, 0.17, 0.01);
    chest.add(head);
    const H = new PartSet();
    H.add(GEO.sphere, skin, 0, 0, 0, 0.2, 0.235, 0.215);
    H.box(skin, 0.03, 0.05, 0.04, 0, -0.01, 0.105);
    H.add(GEO.sphere, skin, 0.103, 0, -0.005, 0.035, 0.055, 0.03);
    H.add(GEO.sphere, skin, -0.103, 0, -0.005, 0.035, 0.055, 0.03);
    H.add(GEO.sphere, dark, 0.042, 0.02, 0.092, 0.022, 0.018, 0.012);
    H.add(GEO.sphere, dark, -0.042, 0.02, 0.092, 0.022, 0.018, 0.012);
    H.box(hair, 0.05, 0.012, 0.012, 0.043, 0.048, 0.1);
    H.box(hair, 0.05, 0.012, 0.012, -0.043, 0.048, 0.1);
    H.box(stdMat('#8a5a4a', 0.6), 0.05, 0.012, 0.01, 0, -0.062, 0.098);
    const hs = L.hairStyle;
    if (hs !== 'bald' && L.headgear !== 'helmet') {
      const thick = hs === 'buzz' ? 0.205 : 0.218;
      H.add(GEO.hemi, hair, 0, 0.01, -0.008, thick, hs === 'buzz' ? 0.2 : 0.23, thick + 0.01);
      if (hs === 'bob' || hs === 'long') H.box(hair, 0.22, 0.2, 0.12, 0, -0.07, -0.06);
      if (hs === 'pony') { H.add(GEO.capsule, hair, 0, -0.06, -0.15, 0.06, 0.08, 0.06, 0.5); H.add(GEO.sphere, hair, 0, 0.05, -0.1, 0.09, 0.08, 0.08); }
    }
    if (L.beard === 'full') H.add(GEO.sphere, hair, 0, -0.07, 0.04, 0.19, 0.15, 0.17);
    if (L.beard === 'stubble') H.add(GEO.sphere, stdMat(new THREE.Color(L.skin).multiplyScalar(0.62).getStyle(), 0.9), 0, -0.065, 0.035, 0.182, 0.13, 0.165);
    if (L.headgear === 'beanie') { H.add(GEO.hemi, hg, 0, 0.02, -0.005, 0.226, 0.26, 0.232); H.box(hg, 0.232, 0.04, 0.238, 0, 0.02, -0.005); }
    if (L.headgear === 'cap') { H.add(GEO.hemi, hg, 0, 0.03, -0.005, 0.222, 0.2, 0.228); H.box(hg, 0.17, 0.015, 0.1, 0, 0.045, 0.13); }
    if (L.headgear === 'helmet') {
      H.add(GEO.hemi, hg, 0, 0.0, -0.005, 0.255, 0.26, 0.27);
      H.box(hg, 0.26, 0.03, 0.28, 0, 0.0, -0.01);
      if (L.goggles) { H.box(dark, 0.17, 0.045, 0.05, 0, 0.07, 0.11); H.box(accent, 0.07, 0.03, 0.02, 0, 0.07, 0.14); }
    }
    if (L.headgear === 'bandana') H.box(hg, 0.215, 0.045, 0.225, 0, 0.065, -0.005);
    H.build(head);

    const mkArm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.2 * bw, -0.03, 0);
      chest.add(sh);
      new PartSet()
        .add(GEO.capsule, jacket, 0, -0.145, 0, 0.11, 0.135, 0.11)
        .add(GEO.sphere, vest, 0, -0.01, 0, 0.14, 0.12, 0.15)
        .build(sh);
      const el = new THREE.Group();
      el.position.y = -0.29;
      sh.add(el);
      new PartSet().add(GEO.capsule, jacket, 0, -0.13, 0, 0.09, 0.125, 0.09).build(el);
      const hand = new THREE.Group();
      hand.position.y = -0.27;
      el.add(hand);
      new PartSet().add(GEO.sphere, glove, 0, -0.02, 0, 0.085, 0.1, 0.065).build(hand);
      return { sh, el, hand };
    };
    this.armR = mkArm(1);
    this.armL = mkArm(-1);

    const mkLeg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.095 * bw, -0.04, 0);
      hips.add(hip);
      new PartSet().add(GEO.capsule, pants, 0, -0.21, 0, 0.14, 0.21, 0.15).build(hip);
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);
      new PartSet()
        .add(GEO.capsule, pants, 0, -0.2, 0, 0.115, 0.2, 0.12)
        .box(vest, 0.1, 0.1, 0.04, 0, -0.02, 0.06)
        .build(knee);
      const ankle = new THREE.Group();
      ankle.position.y = -0.44;
      knee.add(ankle);
      new PartSet().box(boots, 0.115, 0.1, 0.27, 0, -0.04, 0.05).build(ankle);
      return { hip, knee, ankle };
    };
    this.legR = mkLeg(1);
    this.legL = mkLeg(-1);

    this.mount = new THREE.Group();
    chest.add(this.mount);
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  setWeapon(id, rarity = 0) {
    if (this.weapon) { this.mount.remove(this.weapon); }
    this.weaponId = id;
    if (!id) { this.weapon = null; return; }
    this.weapon = buildWeaponModel(id, rarity);
    this.mount.add(this.weapon);
  }

  muzzleWorld(out) {
    if (!this.weapon) return this.head.getWorldPosition(out);
    return out.copy(this.weapon.userData.muzzle).applyMatrix4(this.weapon.matrixWorld);
  }
  ejectWorld(out) {
    if (!this.weapon) return this.head.getWorldPosition(out);
    return out.copy(this.weapon.userData.eject).applyMatrix4(this.weapon.matrixWorld);
  }

  // p: { speed, localVX, localVZ, crouch, onGround, aimPitch, aiming, sprint, reloadT, switchT, healT, dead }
  update(dt, p) {
    if (this.deathT >= 0) { this.updateDeath(dt); return; }
    const sp = p.speed;
    this.crouchF = damp(this.crouchF, p.crouch ? 1 : 0, 12, dt);
    this.aimF = damp(this.aimF, p.aiming ? 1 : 0, 14, dt);
    this.sprintF = damp(this.sprintF, p.sprint && sp > 3 ? 1 : 0, 8, dt);
    this.airF = damp(this.airF, p.onGround ? 0 : 1, 10, dt);
    const lowerTarget = Math.max(this.sprintF * (1 - this.aimF), p.switchT > 0 ? Math.sin(Math.PI * p.switchT) : 0, p.healT > 0 ? 1 : 0);
    this.lowerF = damp(this.lowerF, lowerTarget, 14, dt);

    // Leg cycle.
    const moving = sp > 0.3;
    let ang = Math.atan2(p.localVX, p.localVZ);
    let dir = 1;
    if (Math.abs(ang) > 1.75) { dir = -1; ang = wrapAngle(ang - Math.PI * Math.sign(ang)); }
    this.hipYaw = damp(this.hipYaw, moving ? clamp(ang * 0.55, -0.75, 0.75) : 0, 8, dt);
    const cycleLen = lerp(1.5, 3.2, clamp(sp / 6.8, 0, 1)) * (this.crouchF > 0.5 ? 0.7 : 1);
    const prevPhase = this.phase;
    this.phase += (sp * dt / cycleLen) * Math.PI * 2 * dir;
    if (moving && p.onGround && this.stepCb) {
      const s = Math.sign(Math.sin(this.phase));
      if (s !== this.lastStepSign && Math.sin(prevPhase) !== 0) this.stepCb();
      this.lastStepSign = s;
    }
    const amp = clamp(sp / 4.5, 0, 1) * lerp(0.55, 0.85, this.sprintF) * (1 - this.crouchF * 0.45);
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    let tL = s * amp, tR = -s * amp;
    let kL = Math.max(0, -c) * amp * 1.4 + 0.06, kR = Math.max(0, c) * amp * 1.4 + 0.06;
    // crouch pose
    const cf = this.crouchF;
    tL = lerp(tL, -1.05 + s * amp * 0.6, cf); tR = lerp(tR, -1.05 - s * amp * 0.6, cf);
    kL = lerp(kL, 1.8, cf); kR = lerp(kR, 1.8, cf);
    // airborne pose
    const af = this.airF;
    tL = lerp(tL, -0.55, af); tR = lerp(tR, -0.15, af); kL = lerp(kL, 1.0, af); kR = lerp(kR, 0.5, af);
    this.legL.hip.rotation.set(tL, 0, 0);
    this.legR.hip.rotation.set(tR, 0, 0);
    this.legL.knee.rotation.x = kL;
    this.legR.knee.rotation.x = kR;
    this.legL.ankle.rotation.x = -(tL + kL) * 0.6 * (1 - af);
    this.legR.ankle.rotation.x = -(tR + kR) * 0.6 * (1 - af);
    const bob = moving ? Math.abs(c) * 0.035 * amp : 0;
    this.hips.position.y = lerp(0.98, 0.64, cf) - bob + af * 0.03;
    this.hips.rotation.y = this.hipYaw;
    this.hips.rotation.z = moving ? s * 0.03 * amp : 0;

    // Upper body: counter-rotate hips, lean, aim pitch, flinch.
    this.flinch.multiplyScalar(Math.exp(-9 * dt));
    const pitch = p.aimPitch;
    const lean = cf * 0.22 + this.sprintF * 0.18 * (1 - this.aimF);
    this.spine.rotation.set(lean - pitch * 0.35 + this.flinch.x, -this.hipYaw, this.flinch.y);
    this.chest.rotation.set(-pitch * 0.45 - lean * 0.5, 0, 0);
    this.head.rotation.set(-pitch * 0.2, 0, 0);

    this.poseWeapon(dt, p);
  }

  poseWeapon(dt, p) {
    this.kick = Math.max(0, this.kick - dt * 9);
    const w = this.weapon;
    if (!w) return;
    const pistol = this.weaponId === 'pistol';
    const aim = this.aimF, low = this.lowerF;
    // grip position in chest space
    if (pistol) {
      _v1.set(lerp(0.08, 0.03, aim), lerp(-0.14, -0.05, aim), lerp(0.36, 0.44, aim));
    } else {
      _v1.set(lerp(0.13, 0.1, aim), lerp(-0.14, -0.06, aim), lerp(0.2, 0.24, aim));
    }
    _v1.y -= low * 0.14; _v1.x -= low * 0.05;
    _v1.z -= this.kick * 0.06;
    let rx = -this.kick * 0.25 + low * 0.75, ry = low * -0.45, rz = 0;
    // reload: tilt weapon, dip
    const rt = p.reloadT;
    if (rt >= 0) {
      const k = Math.sin(clamp(rt, 0, 1) * Math.PI);
      rz = k * 0.55; rx += k * 0.25; _v1.y -= k * 0.04;
      if (w.userData.magMesh) w.userData.magMesh.visible = !(rt > 0.25 && rt < 0.62);
    } else if (w.userData.magMesh) w.userData.magMesh.visible = true;
    this.mount.position.copy(_v1);
    _e.set(rx, ry, rz);
    this.mount.quaternion.setFromEuler(_e);
    this.mount.updateMatrix();

    // IK targets (chest space).
    _v2.set(0, -0.025, -0.01).applyQuaternion(this.mount.quaternion).add(this.mount.position);
    _v3.copy(w.userData.gripL).applyQuaternion(this.mount.quaternion).add(this.mount.position);
    if (rt >= 0 && !pistol) {
      // left hand goes to the magazine, down to the vest, back again
      const magP = _v4.copy(w.userData.mag).applyQuaternion(this.mount.quaternion).add(this.mount.position);
      const pouch = new THREE.Vector3(-0.08, -0.32, 0.18);
      let t;
      if (rt < 0.2) { t = rt / 0.2; _v3.lerp(magP, t); }
      else if (rt < 0.45) { t = (rt - 0.2) / 0.25; _v3.copy(magP).lerp(pouch, Math.sin(t * Math.PI / 2)); }
      else if (rt < 0.7) { t = (rt - 0.45) / 0.25; _v3.copy(pouch).lerp(magP, t * t); }
      else if (rt < 0.85) { _v3.copy(magP); }
      else { t = (rt - 0.85) / 0.15; _v4.copy(magP); _v3.lerp(_v4, 1 - t); }
    } else if (p.healT > 0) {
      _v3.set(-0.05, -0.22, 0.25 + Math.sin(p.healT * 20) * 0.02);
    }
    this.solveArm(this.armR, _v2, _v1.set(0.7, -0.9, -0.5));
    this.solveArm(this.armL, _v3, _v1.set(-0.7, -0.9, -0.2));
  }

  solveArm(arm, target, pole) {
    const a = 0.29, b = 0.27;
    const S = arm.sh.position;
    const d = _v4.copy(target).sub(S);
    const dist = clamp(d.length(), 0.08, a + b - 0.002);
    d.normalize();
    const cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1);
    const A = Math.acos(cosA);
    pole.normalize();
    const pv = pole.sub(_v1.copy(d).multiplyScalar(pole.dot(d)));
    if (pv.lengthSq() < 1e-6) pv.set(0, -1, 0);
    pv.normalize();
    const upper = _v1.copy(d).multiplyScalar(Math.cos(A)).addScaledVector(pv, Math.sin(A)).normalize();
    arm.sh.quaternion.setFromUnitVectors(DOWN, upper);
    const E = upper.multiplyScalar(a).add(S);
    const fore = E.sub(target).negate().normalize();
    _q1.setFromUnitVectors(DOWN, fore);
    _q2.copy(arm.sh.quaternion).invert();
    arm.el.quaternion.copy(_q2.multiply(_q1));
  }

  hit(dirLocalX, strength = 1) {
    this.flinch.x += 0.25 * strength;
    this.flinch.y += dirLocalX * 0.2 * strength;
  }

  fire(kick = 1) { this.kick = Math.min(1.3, this.kick + kick); }

  die(fromBehind, side) {
    this.deathT = 0;
    this.baseY = this.root.position.y;
    this.deathDir = fromBehind ? 1 : -1;
    this.deathSide = side;
  }

  updateDeath(dt) {
    this.deathT += dt;
    const t = clamp(this.deathT / 0.75, 0, 1);
    const e = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
    const bounce = t >= 1 ? 0 : Math.sin(t * Math.PI) * 0.08;
    this.root.rotation.x = this.deathDir * (Math.PI / 2) * e * 0.97;
    this.root.rotation.z = this.deathSide * 0.3 * e;
    this.root.position.y = this.baseY + 0.13 * e + bounce;
    this.hips.position.y = lerp(this.hips.position.y, 0.98, e);
    this.legL.knee.rotation.x = lerp(this.legL.knee.rotation.x, 0.4, e);
    this.legR.knee.rotation.x = lerp(this.legR.knee.rotation.x, 0.15, e);
    this.legL.hip.rotation.x = lerp(this.legL.hip.rotation.x, -0.2, e);
    this.legR.hip.rotation.x = lerp(this.legR.hip.rotation.x, 0.1, e);
    this.armL.sh.quaternion.slerp(_q1.setFromEuler(_e.set(-0.4, 0, -1.2)), e * 0.3);
    this.armR.sh.quaternion.slerp(_q1.setFromEuler(_e.set(-0.2, 0, 1.3)), e * 0.3);
    this.armL.el.quaternion.slerp(_q1.identity(), e * 0.3);
    this.armR.el.quaternion.slerp(_q1.identity(), e * 0.3);
    this.spine.rotation.x = lerp(this.spine.rotation.x, 0, e);
    this.chest.rotation.x = lerp(this.chest.rotation.x, 0, e);
    this.head.rotation.y = lerp(this.head.rotation.y, 0.6 * this.deathSide, e);
  }

  reset() {
    this.deathT = -1;
    this.root.rotation.set(0, this.root.rotation.y, 0);
    this.head.rotation.set(0, 0, 0);
    if (this.weapon) this.weapon.visible = true;
  }
}
