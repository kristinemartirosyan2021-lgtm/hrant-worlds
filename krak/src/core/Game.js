// Game: owns renderer, scene, systems and the main loop; drives screen flow.
import * as THREE from 'three';
import { SaveSystem } from './SaveSystem.js';
import { InputManager } from './InputManager.js';
import { AudioManager } from './AudioManager.js';
import { Director } from './Director.js';
import { Emitter } from './util.js';
import { World } from '../world/World.js';
import { SUN_DIR, FOG_COLOR } from '../world/Sky.js';
import { setMaxAnisotropy } from '../world/Textures.js';
import { Effects } from '../combat/Effects.js';
import { ProjectileSystem } from '../combat/ProjectileSystem.js';
import { LootSystem } from '../gameplay/LootSystem.js';
import { ZoneSystem } from '../gameplay/ZoneSystem.js';
import { MatchManager } from '../gameplay/MatchManager.js';
import { Progression } from '../gameplay/Progression.js';
import { UIManager } from '../ui/UIManager.js';
import { TouchControls, detectTouch } from '../ui/TouchControls.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Game {
  constructor() {
    this.canvas = $('gl');
    this.events = new Emitter();
    this.save = new SaveSystem();
    this.input = new InputManager(this.canvas);
    this.audio = new AudioManager(this.save);
    this.time = 0;
    this.paused = false;
    this.actors = [];
    this.player = null;
    this.pathBudget = 3;
    this.screen = 'boot';
    this.debug = /[?&]debug/.test(location.search);
    // Mobile / touch detection.
    this.touch = detectTouch();
    this.input.touch = this.touch;
    document.body.classList.toggle('touch', this.touch);
    const st = this.save.data.settings;
    if (this.touch && st.qualityAuto) st.quality = 'medium';
    this.resScale = 1;
    this.frameTimes = [];
    this.bodyState = '';
    this.preventBrowserGestures();
  }

  // Block page scroll, pinch zoom, double-tap zoom and text selection while playing.
  preventBrowserGestures() {
    const scrollable = (t) => t && t.closest && t.closest('.panels, .rs-inner, .pause-inner, .tabs, input');
    document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || !scrollable(e.target)) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('selectstart', (e) => { if (!(e.target.closest && e.target.closest('input'))) e.preventDefault(); });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.match && this.match.state === 'playing') this.pause();
    });
  }

  async boot() {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !(this.touch && this.save.data.settings.quality === 'low'), powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.02;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    setMaxAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));
    const scene = (this.scene = new THREE.Scene());
    scene.background = FOG_COLOR.clone();
    scene.fog = new THREE.FogExp2(FOG_COLOR.clone(), 0.0052);
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 3000);
    this.camera.position.set(0, 30, 60);

    this.hemi = new THREE.HemisphereLight(0xbfd2e6, 0x6b5640, 1.05);
    scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xffd9b0, 3.1));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0x8fa8c8, 0.35);
    fill.position.set(60, 40, -50);
    scene.add(fill);

    this.ui = new UIManager(this);
    this.world = new World(this);
    await this.world.build((p, l) => this.ui.bootProgress(p, l));
    this.fx = new Effects(this);
    this.projectiles = new ProjectileSystem(this);
    this.loot = new LootSystem(this);
    this.zone = new ZoneSystem(this);
    this.zone.wall.visible = false;
    this.match = new MatchManager(this);
    this.progression = new Progression(this.save);
    this.director = new Director(this);
    this.ui.minimap.bake();
    this.touchUI = new TouchControls(this);
    this.applyQuality();
    addEventListener('resize', () => this.resize());
    this.resize();

    this.input.onLockChange = (locked) => {
      if (!locked && this.match.state === 'playing' && !this.paused) this.pause();
    };
    this.canvas.addEventListener('click', () => {
      if (this.match.state === 'playing' && !this.input.locked && !this.paused) this.input.requestLock();
    });
    $('hud').addEventListener('click', () => {
      if (this.match.state === 'playing' && !this.input.locked && !this.paused) this.input.requestLock();
    });
    $('clickToLock').style.pointerEvents = 'auto';
    $('clickToLock').addEventListener('click', () => this.input.requestLock());

    // Warm-up render (compiles shaders) behind the boot screen.
    this.director.lobby();
    this.director.update(0.016, this.camera);
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.loop());

    this.ui.show('boot', false);
    this.ui.show('gate');
    this.screen = 'gate';
    $('gateBtn').addEventListener('click', () => this.playIntro(), { once: true });
    if (/[?&]skip/.test(location.search)) { $('gateBtn').click(); }
  }

  applyQuality() {
    const q = this.save.data.settings.quality;
    const dpr = window.devicePixelRatio || 1;
    // Phones have very high DPR; rendering at ~1x CSS pixels (plus dynamic resolution) keeps 60 FPS.
    const cap = this.touch ? { low: 0.8, medium: 1.0, high: 1.35 } : { low: 0.75, medium: 1, high: 1.5 };
    this.basePR = Math.min(dpr, cap[q]) * (q === 'low' && !this.touch ? 1 : 1);
    this.renderer.setPixelRatio(this.basePR * this.resScale);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    const ext = q === 'high' ? 70 : 50;
    const sc = this.sun.shadow.camera;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix();
    // Scale content density.
    const dens = { low: 0.35, medium: 0.7, high: 1 }[q];
    if (this.world.vegetation.grass) this.world.vegetation.grass.count = Math.floor(this.world.vegetation.grassMax * dens);
    this.fx.add.density = this.fx.alpha.density = { low: 0.5, medium: 0.8, high: 1 }[q];
    this.actorCull = { low: 170, medium: 240, high: 420 }[q];
    this.shadowNear = { low: 0, medium: 35, high: 70 }[q];
    this.scene.fog.density = q === 'low' ? 0.0062 : 0.0052;
    const size = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.onFovChange();
  }

  onFovChange() {
    if (!this.fx) return;
    const h = this.renderer.domElement.height;
    this.fx.setScale(h / (2 * Math.tan((this.camera.fov * Math.PI) / 360)));
  }

  cameraShake(t) { if (this.player) this.player.addShake(t); }

  // ---------------------------------------------------------------- screens
  async playIntro() {
    this.audio.init();
    this.audio.startMusic();
    this.audio.setAmbience(0.6);
    this.ui.show('gate', false);
    this.ui.show('intro');
    this.screen = 'intro';
    const black = $('introBlack'), title = $('introTitle'), sub = $('introSub');
    this.introParticles(true);
    let skipped = false;
    const skip = () => { if (skipped) return; skipped = true; this.toLobby(); };
    const onKey = () => skip();
    $('intro').addEventListener('click', skip, { once: true });
    setTimeout(() => addEventListener('keydown', onKey, { once: true }), 400);
    this.introSkip = () => { removeEventListener('keydown', onKey); };
    const step = async (ms, fn) => { await sleep(ms); if (!skipped) fn(); };
    await step(800, () => { title.classList.add('in'); this.audio.impactBoom(); });
    await step(1200, () => { sub.classList.add('in'); this.audio.whoosh(); });
    await step(800, () => { this.director.intro(); });
    await step(800, () => { black.classList.add('reveal'); });
    await step(1600, () => { title.classList.add('out'); sub.classList.add('out'); });
    await step(9000, () => {});
    if (!skipped) skip();
  }

  introParticles(on) {
    const c = $('introParticles');
    const ctx = c.getContext('2d');
    this.introOn = on;
    if (!on) { ctx.clearRect(0, 0, c.width, c.height); return; }
    c.width = innerWidth; c.height = innerHeight;
    const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height, v: 10 + Math.random() * 40, s: Math.random() * 2 + 0.5, a: Math.random(), w: Math.random() * 6 }));
    let last = performance.now();
    const frame = (t) => {
      if (!this.introOn) { ctx.clearRect(0, 0, c.width, c.height); return; }
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of ps) {
        p.y -= p.v * dt; p.x += Math.sin(t * 0.001 + p.w) * 10 * dt;
        if (p.y < -10) { p.y = c.height + 10; p.x = Math.random() * c.width; }
        const fl = 0.5 + Math.sin(t * 0.004 + p.w) * 0.5;
        ctx.fillStyle = `rgba(255,${140 + fl * 80},60,${0.25 + fl * 0.6 * p.a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  async fade(fn) {
    $('fade').classList.add('on');
    await sleep(450);
    await fn();
    $('fade').classList.remove('on');
  }

  async toLobby() {
    if (this.screen === 'lobby') return;
    this.screen = 'lobby';
    if (this.introSkip) this.introSkip();
    await this.fade(async () => {
      this.introParticles(false);
      this.ui.show('gate', false);
      this.ui.show('intro', false);
      this.ui.show('results', false);
      this.ui.show('endTitle', false);
      this.ui.show('pause', false);
      this.ui.showHUD(false);
      this.paused = false;
      this.match.cleanup();
      this.zone.wall.visible = false;
      this.director.lobby();
      this.ui.refreshMenu();
      this.ui.openTab('play');
      this.ui.show('menu');
      this.audio.init();
      this.audio.startMusic();
      this.audio.setAmbience(0.45);
    });
  }

  async startMatch() {
    if (this.screen === 'loading') return;
    this.audio.init();
    if (this.touch) this.enterFullscreen();
    this.screen = 'loading';
    this.ui.show('gate', false);
    this.ui.show('intro', false);
    this.introParticles(false);
    this.ui.show('menu', false);
    this.ui.show('results', false);
    this.ui.show('endTitle', false);
    this.audio.stopMusic();
    await this.ui.matchLoading();
    this.match.cleanup();
    this.match.start();
    this.zone.wall.visible = true;
    this.director.deploy(this.player);
    this.cd = 0;
    this.ui.show('loading', false);
    this.audio.setAmbience(0.9);
    this.audio.whoosh();
    this.screen = 'match';
  }

  // Mobile: go fullscreen and lock to landscape where the browser allows it.
  enterFullscreen() {
    const de = document.documentElement;
    try {
      const req = de.requestFullscreen || de.webkitRequestFullscreen;
      if (req && !document.fullscreenElement) {
        const pr = req.call(de, { navigationUI: 'hide' });
        if (pr && pr.then) pr.then(() => this.lockLandscape()).catch(() => this.lockLandscape());
        else this.lockLandscape();
      } else this.lockLandscape();
    } catch (e) { /* ignore */ }
  }
  lockLandscape() {
    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignore */ }
    setTimeout(() => { this.resize(); this.touchUI.layout(); }, 300);
  }

  pause() {
    if (this.match.state !== 'playing') return;
    if (this.touchUI) this.touchUI.reset();
    this.paused = true;
    this.ui.show('pause');
    $('pauseSettings').classList.remove('show');
  }

  resume() {
    this.paused = false;
    this.ui.show('pause', false);
    this.input.requestLock();
    this.clock.getDelta();
  }

  quitMatch() {
    this.paused = false;
    this.ui.show('pause', false);
    this.match.abandon();
  }

  // ---------------------------------------------------------------- loop
  loop() {
    const realDt = this.clock.getDelta();
    const rawDt = Math.min(realDt, 0.05);
    this.dynamicResolution(realDt);
    if (!this.paused) this.step(rawDt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
    if (this.debug) this.perf();
  }

  // One logic tick (separate from rendering so tests can fast-forward).
  step(rawDt) {
    const m = this.match;
    let ts = 1;
    if (m.slowmo > 0) { m.slowmo -= rawDt; ts = 0.3; }
    const dt = rawDt * ts;
    this.time += dt;
    this.pathBudget = 3;
    if (m.state === 'deploy' || m.state === 'playing' || m.state === 'ended') {
      m.update(dt);
      if (m.state === 'deploy') {
        const n = 3 - Math.floor(m.deployT - 0.6);
        if (m.deployT > 0.6 && n >= 1 && n <= 3 && n !== this.cd) { this.cd = n; this.ui.countdown(n); this.audio.zoneTick(); }
      }
      for (const a of this.actors) a.update(dt);
      this.separateActors();
      this.projectiles.update(dt);
      this.loot.update(dt, this.camera);
      if (m.state === 'playing' && this.director.mode === 'deploy') this.director.none();
    }
    if (this.director.mode !== 'none') this.director.update(dt, this.camera);
    else if (this.player) this.player.updateCamera(dt, this.camera);
    if (this.director.mode !== 'none' && this.audio.ctx) {
      const f = new THREE.Vector3(); this.camera.getWorldDirection(f);
      this.audio.setListener(this.camera.position, f);
    }
    this.fx.update(dt, this.camera);
    this.world.update(dt, this.camera);
    this.updateSun();
    this.ui.update(rawDt);
    if (this.touchUI) this.touchUI.update();
    this.updateLOD();
    this.updateBodyState();
  }

  // Distance culling / shadow LOD for characters (big draw-call saver on phones).
  updateLOD() {
    const c = this.camera.position;
    const cull2 = (this.actorCull || 400) ** 2, sh2 = (this.shadowNear ?? 70) ** 2;
    for (const a of this.actors) {
      if (a.isPlayer) continue;
      const p = a.ctrl.pos;
      const d2 = (p.x - c.x) ** 2 + (p.y - c.y) ** 2 + (p.z - c.z) ** 2;
      const root = a.model.root;
      const vis = d2 < cull2 && this.match.state !== 'idle';
      if (root.visible !== vis) root.visible = vis;
      const cast = d2 < sh2;
      if (a.model.castingShadow !== cast) {
        a.model.castingShadow = cast;
        root.traverse((o) => { if (o.isMesh) o.castShadow = cast; });
      }
    }
  }

  updateBodyState() {
    const m = this.match.state;
    const key = `${m}|${this.paused}|${this.screen}`;
    if (key === this.bodyState) return;
    this.bodyState = key;
    const b = document.body.classList;
    b.toggle('in-match', m === 'deploy' || m === 'playing' || m === 'ended');
    b.toggle('match-ended', m === 'ended');
    b.toggle('paused', this.paused);
    b.toggle('loading-match', this.screen === 'loading');
    if (m !== 'playing' && this.touchUI) this.touchUI.reset();
    if (this.touchUI && b.contains('in-match')) requestAnimationFrame(() => this.touchUI.layout());
  }

  // Keeps frame rate smooth on weaker phones by scaling render resolution (60 FPS target).
  dynamicResolution(dt) {
    if (this.match.state !== 'playing' || this.paused) return;
    const ft = this.frameTimes;
    ft.push(dt);
    if (ft.length < 90) return;
    const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
    ft.length = 0;
    const min = this.touch ? 0.6 : 0.75;
    let s = this.resScale;
    if (avg > 1 / 45) s = Math.max(min, s - 0.1);
    else if (avg < 1 / 57) s = Math.min(1, s + 0.05);
    if (s !== this.resScale) {
      this.resScale = s;
      this.renderer.setPixelRatio(this.basePR * s);
      this.resize();
    }
  }

  // Debug/test helper: advance game logic quickly without rendering.
  simulate(seconds, dt = 1 / 30) {
    for (let t = 0; t < seconds; t += dt) { this.step(dt); this.input.endFrame(); }
  }

  updateSun() {
    const c = this.camera.position;
    const t = this.sun.target.position;
    // Snap to shadow texels to avoid shimmering.
    const snap = 140 / this.sun.shadow.mapSize.x;
    t.set(Math.round(c.x / snap) * snap, 0, Math.round(c.z / snap) * snap);
    this.sun.position.copy(t).addScaledVector(SUN_DIR, 180);
    this.sun.target.updateMatrixWorld();
  }

  separateActors() {
    const A = this.actors;
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < A.length; j++) {
        const b = A[j];
        if (!b.alive) continue;
        const dx = b.ctrl.pos.x - a.ctrl.pos.x, dz = b.ctrl.pos.z - a.ctrl.pos.z;
        if (Math.abs(b.ctrl.pos.y - a.ctrl.pos.y) > 1.6) continue;
        const d2 = dx * dx + dz * dz;
        const min = 0.72;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (min - d) / 2;
          const nx = dx / d, nz = dz / d;
          a.ctrl.pos.x -= nx * push; a.ctrl.pos.z -= nz * push;
          b.ctrl.pos.x += nx * push; b.ctrl.pos.z += nz * push;
        }
      }
    }
  }

  perf() {
    const now = performance.now();
    this.pf = this.pf || { t0: now, n: 0, fps: 0 };
    this.pf.n++;
    if (now - this.pf.t0 > 500) {
      this.pf.fps = Math.round((this.pf.n * 1000) / (now - this.pf.t0)); this.pf.t0 = now; this.pf.n = 0;
      const info = this.renderer.info.render;
      const p = this.player;
      const ai = p ? this.actors.filter((a) => a !== p && a.alive).map((a) => a.ai.state[0]).join('') : '';
      $('perf').textContent = `${this.pf.fps} FPS · ${info.calls} draw · ${(info.triangles / 1000).toFixed(0)}k tri · ${ai}`;
    }
  }
}
