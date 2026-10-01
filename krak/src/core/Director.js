// Cinematic camera director: intro fly-through, lobby showcase, deploy swoop, victory / defeat shots.
import * as THREE from 'three';
import { HumanModel, CHARACTERS, applySkin } from '../entities/HumanModel.js';
import { clamp, lerp, smoothstep } from './util.js';

const _v = new THREE.Vector3();
const _t = new THREE.Vector3();

export class Director {
  constructor(game) {
    this.game = game;
    this.mode = 'none';
    this.t = 0;
    this.showcase = null;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    // Intro path over the battlefield.
    const W = game.world;
    const H = (x, z, o) => W.terrain.height(x, z) + o;
    this.introPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-150, H(-150, -150, 40), -150),
      new THREE.Vector3(-110, 26, -110),
      new THREE.Vector3(-70, 14, -70),
      new THREE.Vector3(-30, 11, -32),
      new THREE.Vector3(10, 14, -18),
      new THREE.Vector3(30, 10, 20),
    ]);
    this.introLook = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-92, 8, -88),
      new THREE.Vector3(-80, 6, -70),
      new THREE.Vector3(-40, 6, -30),
      new THREE.Vector3(0, 8, 0),
      new THREE.Vector3(40, 6, 30),
      new THREE.Vector3(60, 6, 60),
    ]);
    // Lobby / showcase spot: just outside the fortress south gate.
    this.showSpot = new THREE.Vector3(5, 0, 33);
    this.showSpot.y = W.terrain.height(5, 33);
  }

  buildShowcase() {
    const g = this.game;
    const d = g.save.data;
    const ch = CHARACTERS.find((c) => c.id === d.character) || CHARACTERS[0];
    const look = applySkin(ch.look, d.skins[ch.id] || 'default');
    if (this.showcase) g.scene.remove(this.showcase.root);
    this.showcase = new HumanModel(look);
    this.showcase.setWeapon(ch.id === 'ani' ? 'sniper' : ch.id === 'davit' ? 'shotgun' : ch.id === 'narek' ? 'smg' : 'ar', ch.id === 'hayk' ? 3 : 2);
    this.showcase.root.position.copy(this.showSpot);
    this.showcase.root.rotation.y = Math.PI * 0.92;
    g.scene.add(this.showcase.root);
    this.reloadCycle = 0;
  }

  intro() {
    this.mode = 'intro';
    this.t = 0;
    this.exploded = false;
    this.buildShowcase();
  }

  lobby() {
    this.mode = 'lobby';
    this.t = 0;
    if (!this.showcase) this.buildShowcase();
    this.showcase.root.visible = true;
  }

  hideShowcase() { if (this.showcase) this.showcase.root.visible = false; }

  deploy(player) {
    this.mode = 'deploy';
    this.t = 0;
    this.player = player;
    this.hideShowcase();
    const p = player.ctrl.pos;
    this.from = new THREE.Vector3(p.x - Math.sin(player.yaw) * 30, p.y + 60, p.z - Math.cos(player.yaw) * 30);
  }

  victory(player) { this.mode = 'victory'; this.t = 0; this.player = player; this.orbit0 = player.yaw + Math.PI; }
  defeat(player, killer) { this.mode = 'defeat'; this.t = 0; this.player = player; this.killer = killer; this.orbit0 = player.yaw + Math.PI * 0.7; }
  none() { this.mode = 'none'; }

  updateShowcase(dt) {
    const s = this.showcase;
    if (!s || !s.root.visible) return;
    this.reloadCycle += dt;
    const cyc = this.reloadCycle % 9;
    const reloadT = cyc > 6 && cyc < 8.2 ? (cyc - 6) / 2.2 : -1;
    s.update(dt, {
      speed: 0, localVX: 0, localVZ: 0, crouch: false, onGround: true,
      aimPitch: Math.sin(this.reloadCycle * 0.4) * 0.05 - 0.05, aiming: false, sprint: false,
      reloadT, switchT: 0, healT: 0,
    });
    // breathing
    s.chest.rotation.x += Math.sin(this.reloadCycle * 1.6) * 0.02;
    s.head.rotation.y = Math.sin(this.reloadCycle * 0.35) * 0.25;
  }

  update(dt, camera) {
    this.t += dt;
    const g = this.game;
    this.updateShowcase(dt);
    if (this.mode === 'intro') {
      const T = this.t;
      // Phase 1 (0-9.5s): fly-through.  Phase 2 (9.5s+): close-up of the hero reloading.
      if (T < 9.5) {
        const u = smoothstep(0, 9.5, T) * 0.97;
        this.introPath.getPointAt(u, camera.position);
        this.introLook.getPointAt(Math.min(1, u + 0.03), _t);
        camera.lookAt(_t);
        if (!this.exploded && T > 4.2) {
          this.exploded = true;
          const ep = new THREE.Vector3(70, 0, -96);
          g.fx.explosion(ep, 2.2);
          g.audio.explosion(ep);
          setTimeout(() => { g.fx.explosion(new THREE.Vector3(78, 0, -102), 1.4); }, 350);
        }
      } else {
        const s = this.showSpot;
        const k = smoothstep(9.5, 13, T);
        const ang = Math.PI * 0.92 + lerp(-0.2, 0.35, k);
        const dist = lerp(2.6, 3.6, k);
        camera.position.set(s.x + Math.sin(ang) * dist, s.y + lerp(1.35, 1.7, k), s.z + Math.cos(ang) * dist);
        camera.lookAt(s.x, s.y + 1.35, s.z);
        if (this.reloadCycle < 6) this.reloadCycle = 6.05;
      }
      if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); g.onFovChange(); }
      return;
    }
    if (this.mode === 'lobby') {
      const s = this.showSpot;
      const ang = Math.PI * 0.92 + 0.45 + Math.sin(this.t * 0.12) * 0.12;
      const dist = 4.3;
      // Offset the character to the right side of the screen (menu lives on the left).
      camera.position.set(s.x + Math.sin(ang) * dist, s.y + 1.55, s.z + Math.cos(ang) * dist);
      _v.set(Math.cos(ang), 0, -Math.sin(ang));
      camera.lookAt(s.x - _v.x * 1.1, s.y + 1.2, s.z - _v.z * 1.1);
      if (camera.fov !== 42) { camera.fov = 42; camera.updateProjectionMatrix(); g.onFovChange(); }
      return;
    }
    if (this.mode === 'deploy') {
      const p = this.player.ctrl.pos;
      const k = smoothstep(0, 3.4, this.t);
      const e = 1 - Math.pow(1 - k, 3);
      const behind = _t.set(p.x - Math.sin(this.player.yaw) * 3.1 - Math.cos(this.player.yaw) * 0.6, p.y + 1.75, p.z - Math.cos(this.player.yaw) * 3.1 + Math.sin(this.player.yaw) * 0.6);
      camera.position.lerpVectors(this.from, behind, e);
      _v.set(p.x + Math.sin(this.player.yaw) * 10 * e, p.y + lerp(0, 1.6, e), p.z + Math.cos(this.player.yaw) * 10 * e);
      camera.lookAt(_v);
      const fov = lerp(60, 72, e);
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); g.onFovChange(); }
      this.player.model.root.position.copy(p);
      this.player.model.root.rotation.y = this.player.yaw;
      return;
    }
    if (this.mode === 'victory' || this.mode === 'defeat') {
      const p = this.player.ctrl.pos;
      const win = this.mode === 'victory';
      const ang = this.orbit0 + this.t * (win ? 0.35 : 0.12);
      const dist = win ? lerp(2.8, 5.5, clamp(this.t / 6, 0, 1)) : lerp(3, 7, clamp(this.t / 5, 0, 1));
      const h = win ? lerp(1.4, 2.4, clamp(this.t / 6, 0, 1)) : lerp(2, 6, clamp(this.t / 5, 0, 1));
      camera.position.set(p.x + Math.sin(ang) * dist, p.y + h, p.z + Math.cos(ang) * dist);
      const col = g.world.collision;
      const look = _t.set(p.x, p.y + (win ? 1.3 : 0.4), p.z);
      _v.copy(camera.position).sub(look);
      const len = _v.length();
      _v.normalize();
      const hit = col.raycast(look.x, look.y, look.z, _v.x, _v.y, _v.z, len);
      if (hit) camera.position.copy(look).addScaledVector(_v, Math.max(0.6, hit.t - 0.3));
      camera.lookAt(look);
      if (win && Math.random() < dt * 6) g.fx.confetti(p, 6);
      return;
    }
  }
}
