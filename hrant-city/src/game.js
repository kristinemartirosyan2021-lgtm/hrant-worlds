// Game: creates every subsystem and runs the per-frame update.
import * as THREE from 'three';
import { QUALITY, PALETTE } from './config.js';
import { World } from './world/city.js';
import { DayNight } from './world/daynight.js';
import { Pickups } from './world/pickups.js';
import { makeSoftCircle, makeBeamTexture } from './world/textures.js';
import { Input } from './core/input.js';
import { TouchControls } from './core/touch.js';
import { writeSave } from './core/save.js';
import { Player } from './player/player.js';
import { CameraRig } from './player/camera.js';
import { VehicleManager } from './vehicles/vehicleManager.js';
import { Effects } from './vehicles/effects.js';
import { CrowdRenderer } from './npc/crowd.js';
import { PedestrianManager } from './npc/pedestrians.js';
import { TrafficManager } from './npc/traffic.js';
import { PoliceManager, Wanted } from './police/police.js';
import { MissionManager } from './missions/missions.js';
import { HUD } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { AudioSystem } from './audio/audio.js';
import { clamp, pick } from './utils/math.js';

export class Game {
  constructor(container, settings) {
    this.settings = settings;
    this.quality = { ...QUALITY[settings.quality] };
    this.state = 'menu';
    this.time = 0; this.money = 0;
    this.respawnT = 0; this.autosaveT = 45; this.frozen = false;

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: settings.quality !== 'low', powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = this.quality.shadows;
    r.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.3, 1200);
    this.textures = { soft: makeSoftCircle(), beam: makeBeamTexture() };

    this.world = new World(this.scene, this.quality);
    this.daynight = new DayNight(this.scene, this.quality);
    this.crowd = new CrowdRenderer(this.scene, 72);
    this.fx = new Effects(this);
    this.audio = new AudioSystem();
    this.input = new Input(r.domElement);
    this.touch = new TouchControls(this.input, document.getElementById('touch'));
    this.hud = new HUD(this);
    this.wanted = new Wanted(this);
    this.vehicles = new VehicleManager(this);
    this.peds = new PedestrianManager(this);
    this.traffic = new TrafficManager(this);
    this.police = new PoliceManager(this);
    this.pickups = new Pickups(this);
    this.player = new Player(this);
    this.cam = new CameraRig(this.camera, this.world);
    this.missions = new MissionManager(this);
    this.minimap = new Minimap(this, document.getElementById('minimap'));

    this._chars = [];
    this._spawnStatic();
    const s = this.world.landmarks.spawn;
    this.player.spawnAt(s.x, s.z, s.h);
    this.player.model.group.visible = false;
    this.applySettings(settings);
    window.addEventListener('resize', () => this.resize());
  }

  // ------------------------------------------------------------ setup
  _spawnStatic() {
    const W = this.world, L = W.landmarks;
    const starters = [['sports', '#ff2fa8'], ['bike', '#2ec4b6'], ['sedan', '#7ec8ff'], ['truck', '#ff9f1c'], ['taxi', '#ffd23f']];
    let k = 0;
    for (const spot of W.parkingSpots) {
      let v;
      if (spot.police) v = this.vehicles.spawn('police', spot.x, spot.z, spot.h, '#f4f4f4');
      else { const [t, c] = starters[k++ % starters.length]; v = this.vehicles.spawn(t, spot.x, spot.z, spot.h, c); }
      v.persistent = true;
    }
    const boat = this.vehicles.spawn('boat', L.dock.x, L.dock.z, L.dock.h, '#ff4f8b'); boat.persistent = true;
    const boat2 = this.vehicles.spawn('boat', 640, 150, Math.PI, '#21f0ff'); boat2.persistent = true;
    const isl = this.vehicles.spawn('sports', 745, 30, 0, '#b44dff'); isl.persistent = true;
    const beachBike = this.vehicles.spawn('bike', 316, 260, Math.PI, '#c6ff4f'); beachBike.persistent = true;
    const beachCar = this.vehicles.spawn('sedan', 316, -90, 0, '#ffffff'); beachCar.persistent = true;

    const P = this.pickups;
    P.spawn('health', L.hospital.x + 6, L.hospital.z);
    P.spawn('armor', L.police.x + 6, L.police.z);
    P.spawn('health', L.villa.x + 4, L.villa.z - 6);
    P.spawn('armor', L.villa.x - 4, L.villa.z - 6);
    P.spawn('health', 360, 30);
    P.spawn('health', -296, -296);
    P.spawn('armor', 296, 296);
  }

  characters() {
    const c = this._chars;
    c.length = 0;
    for (const p of this.peds.list) c.push(p);
    for (const p of this.police.cops) c.push(p);
    return c;
  }

  // ------------------------------------------------------------ settings
  applySettings(s) {
    this.settings = s;
    const q = QUALITY[s.quality];
    const shadowsChanged = q.shadows !== this.quality.shadows;
    Object.assign(this.quality, q);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.daynight.setFar(q.far);
    this.camera.far = q.far + 60; this.camera.updateProjectionMatrix();
    if (shadowsChanged) {
      this.renderer.shadowMap.enabled = q.shadows;
      this.daynight.setShadows(q.shadows);
      this.scene.traverse((o) => {
        if (o.isMesh && o.parent === this.world.group) { o.castShadow = q.shadows && !o.material.transparent && o.material !== this.world.mats.road && o.material.type !== 'MeshBasicMaterial'; o.receiveShadow = q.shadows; }
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; });
      });
    }
    this.audio.setVolume(s.volume, s.music);
    this.cam.sensitivity = s.sensitivity;
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ------------------------------------------------------------ game flow
  startGame(save) {
    const p = this.player, L = this.world.landmarks;
    this.missions.completed = new Set(save ? save.completed || [] : []);
    this.money = save ? save.money || 0 : 250;
    this.hud.shownMoney = this.money;
    if (save && save.pos) p.spawnAt(save.pos.x, save.pos.z, save.pos.h || 0);
    else p.spawnAt(L.spawn.x, L.spawn.z, L.spawn.h);
    if (save) { p.health = save.health ?? 100; p.armor = save.armor ?? 0; this.daynight.hour = save.hour ?? 17.2; }
    else this.daynight.hour = 17.2;
    this.cam.yaw = p.heading; this.cam.pitch = 0.3;
    this.wanted.clear();
    this.state = 'playing';
    this.hud.show(true);
    this.touch.setVisible(this.input.isTouch);
    this.touch.setMode('foot');
    this.audio.setMusic(false, 0);
    if (!save) this.hud.big('HRANT CITY', 3, 'Find the coloured beams to start missions');
    else this.hud.message('Welcome back, Hrant!', 2.5);
  }

  saveGame(silent = false) {
    if (this.state !== 'playing' || this.player.dead) return;
    const P = this.player.pos;
    const onBridge = this.world.heightAt(P.x, P.z) > 0.5;
    const w = this.world.isWater(P.x, P.z);
    const pos = onBridge || w ? this.world.landmarks.spawn : { x: P.x, z: P.z, h: this.player.heading };
    writeSave({
      money: this.money, completed: [...this.missions.completed], pos,
      hour: this.daynight.hour, health: Math.max(20, this.player.health), armor: this.player.armor,
    });
    if (!silent) this.hud.message('Game saved', 1.5);
  }

  addMoney(n) {
    this.money = Math.max(0, this.money + n);
    if (n > 0) { this.hud.message(`+$${n}`, 1.2); this.audio.play('cash'); }
  }

  onPlayerDeath(cause) {
    this.audio.play('wasted');
    this.hud.big('WASTED', 4, cause === 'explosion' ? 'Boom.' : '', '#ff3355');
    this.missions.abort('You died');
    this.respawnT = 4; this.respawnAt = 'hospital';
    this.audio.setMusic(false, 0);
    this.audio.engine(false);
  }

  onBusted() {
    if (this.respawnT > 0) return;
    const p = this.player;
    if (p.vehicle) p.exitVehicle(true);
    this.frozen = true;
    this.audio.play('failed');
    this.hud.big('BUSTED', 3.5, '-$200', '#2b7bff');
    this.missions.abort('You got busted');
    this.respawnT = 3.5; this.respawnAt = 'police';
  }

  _respawn() {
    const p = this.player, L = this.world.landmarks;
    const where = this.respawnAt === 'police' ? L.police : L.hospital;
    this.addMoney(this.respawnAt === 'police' ? -200 : -100);
    this.police.clearAll();
    this.wanted.clear();
    p.spawnAt(where.x, where.z, where.h);
    p.armor = 0;
    this.frozen = false;
    this.cam.yaw = where.h;
    this.touch.setMode('foot');
    this.hud.message(this.respawnAt === 'police' ? 'Released from Hrant City PD' : 'Patched up at the hospital', 2.5);
  }

  carjack(v) {
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const ped = this.peds.spawnAt(v.x + fz * 2, v.z - fx * 2, true);
    if (ped) { ped.fx = v.x; ped.fz = v.z; }
    if (v.isPolice) { this.wanted.crime(5, 'stole police car'); const i = this.police.units.indexOf(v); if (i >= 0) this.police.units.splice(i, 1); }
    else if (Math.random() < 0.35) this.wanted.crime(1, 'carjacking');
  }

  bailOut(v) {
    v.driver = null; v.ai = null;
    v.controls.throttle = 0; v.controls.handbrake = true;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    this.peds.spawnAt(v.x + fz * 2, v.z - fx * 2, true);
  }

  hitCharacter(c, type, fx, fz, vehicle) {
    const byPlayer = type !== 'vehicle' || (vehicle && vehicle.driver === 'player');
    if (c.kind === 'ped') {
      const force = type === 'vehicle' ? Math.min(18, vehicle.speed * 0.8) : type === 'shot' ? 2 : type === 'explosion' ? 10 : 5;
      this.peds.kill(c, fx, fz, force, byPlayer);
    } else if (c.kind === 'cop') {
      if (!byPlayer) { c.alive = false; return; }
      this.police.hitCop(c, type, fx, fz);
    }
    if (type === 'vehicle' && vehicle && vehicle.driver === 'player') this.cam.addShake(0.15);
  }

  explosion(x, y, z, byPlayer, source) {
    this.fx.explosion(x, y, z);
    this.audio.playAt('explosion', x, z, 1.4);
    const P = this.player.pos;
    const d = Math.hypot(P.x - x, P.z - z);
    this.cam.addShake(clamp(1.2 - d / 60, 0, 1.2));
    for (const v of this.vehicles.list) {
      if (v === source) continue;
      const dv = Math.hypot(v.x - x, v.z - z);
      if (dv < 9) { v.applyDamage(70 * (1 - dv / 9), byPlayer); const k = (1 - dv / 9) * 8; v.vx += ((v.x - x) / (dv || 1)) * k; v.vz += ((v.z - z) / (dv || 1)) * k; v.vy = Math.max(v.vy, k * 0.5); v.sleep = 0; }
    }
    for (const c of [...this.characters()]) {
      if (c.alive && Math.hypot(c.x - x, c.z - z) < 8) this.hitCharacter(c, 'explosion', x, z, null);
    }
    if (!this.player.inVehicle && d < 8) this.player.damage(90 * (1 - d / 8), 'explosion');
    this.peds.panic(x, z, 50);
    if (byPlayer) this.wanted.crime(2, 'explosion');
  }

  onEnterVehicle(v) {
    this.touch.setMode('car');
    if (v.isPolice && v.driver === 'player' && !v.stolenFlag) { v.stolenFlag = true; if (this.wanted.stars < 2) this.wanted.crime(5, 'stole police car'); }
    this.audio.setMusic(true);
    this.hud.message(v.spec.name, 1.2);
  }
  onExitVehicle() {
    this.touch.setMode('foot');
    this.audio.setMusic(false, 0);
    this.audio.engine(false);
    this.audio.horn(false);
  }

  // ------------------------------------------------------------ loop
  update(dt) {
    this.time += dt;
    const input = this.input, p = this.player;
    input.poll();
    if (this.state === 'playing') {
      if (!this.frozen) p.update(dt, input, this.cam);
      this.vehicles.update(dt);
      this.characters();
      this.peds.update(dt);
      this.traffic.update(dt);
      this.police.update(dt);
      this.pickups.update(dt);
      this.missions.update(dt);
      if (this.respawnT > 0) { this.respawnT -= dt; if (this.respawnT <= 0) this._respawn(); }
      this.autosaveT -= dt;
      if (this.autosaveT <= 0) { this.autosaveT = 45; this.saveGame(true); }
      // audio
      const P = p.pos;
      this.audio.listener.x = P.x; this.audio.listener.z = P.z;
      const v = p.vehicle;
      if (v && v.state !== 'wrecked') {
        const sf = clamp(Math.abs(v.forwardSpeed) / v.spec.maxSpeed, 0, 1);
        const gear = Math.min(4, Math.floor(sf * 5));
        const rpm = v.spec.water ? sf : (sf * 5 - gear) * 0.7 + 0.2 + gear * 0.04;
        this.audio.engine(true, rpm, v.controls.throttle, v.spec.sound, v.drifting, !!v.spec.water);
      } else this.audio.engine(false);
      this.cam.update(dt, input, p.pos, p.vehicle);
    } else {
      // attract mode: slow orbit around the park
      this.vehicles.update(dt);
      this.characters();
      this.peds.update(dt);
      this.traffic.update(dt);
      const s = this.world.landmarks.spawn, a = this.time * 0.06;
      this.camera.position.set(s.x + Math.sin(a) * 160, 95, s.z + Math.cos(a) * 160);
      this.camera.lookAt(s.x, 0, s.z);
    }
    this.world.update(this.time);
    this.fx.update(dt);
    this.daynight.update(this.state === 'playing' ? dt : dt * 0.3, this.state === 'playing' ? p.pos : this.world.landmarks.spawn, this.camera);
    this.world.setNight(this.daynight.night);
    this.crowd.commit();
    input.endFrame();
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

export { pick, PALETTE };
