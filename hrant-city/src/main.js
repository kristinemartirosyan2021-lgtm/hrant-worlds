// Entry point: boot the game, wire menus, orientation, fullscreen and the render loop.
import './style.css';
import { Game } from './game.js';
import { Menus } from './ui/menus.js';
import { loadSettings } from './core/save.js';
import { watchOrientation, toggleFullscreen } from './core/orientation.js';
import { registerSW } from './pwa.js';

registerSW();

const settings = loadSettings();
let game, menus;

function boot() {
  try {
    game = new Game(document.getElementById('canvas-wrap'), settings);
  } catch (e) {
    console.error(e);
    document.getElementById('loading').textContent = 'Could not start WebGL on this device 😢';
    return;
  }
  window.__game = game; // handy for debugging in the console
  menus = new Menus(game);
  menus.ready();

  document.getElementById('btn-fullscreen').onclick = async () => {
    game.audio.unlock();
    const ok = await toggleFullscreen();
    if (!ok) game.hud.message('iPhone: tap Share → "Add to Home Screen" for fullscreen', 4);
  };
  // first touch anywhere unlocks audio (mobile autoplay rules)
  window.addEventListener('pointerdown', () => game.audio.unlock(), { once: true });

  watchOrientation((portrait) => { if (portrait && game.state === 'playing') menus.pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'playing') menus.pause(); });

  let last = performance.now(), frames = 0, fpsT = 0, fps = 60;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    frames++; fpsT += dt;
    if (fpsT >= 1) { fps = frames; frames = 0; fpsT = 0; }
    if (game.state !== 'paused') game.update(dt);
    if (game.state === 'playing' || game.state === 'paused') game.hud.update(dt, fps);
    if (game.state === 'playing') game.minimap.draw(dt);
    game.render();
  }
  requestAnimationFrame(frame);
}

// Let the loading text paint before the (synchronous) city generation.
requestAnimationFrame(() => setTimeout(boot, 30));
