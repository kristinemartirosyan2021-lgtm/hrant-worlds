// Main menu, pause menu, settings and help screens.
import { saveSettings, loadSave, clearSave } from '../core/save.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(game) {
    this.game = game;
    this.back = 'menu-main';
    this.helpBack = 'menu-main';

    $('btn-continue').onclick = () => this._start(loadSave());
    $('btn-new').onclick = () => {
      if (loadSave() && !confirm('Start a new game? Your saved progress will be replaced.')) return;
      clearSave(); this._start(null);
    };
    $('btn-settings-main').onclick = () => this.open('menu-settings', 'menu-main');
    $('btn-help').onclick = () => this.open('menu-help', 'menu-main');
    $('btn-resume').onclick = () => this.resume();
    $('btn-save').onclick = () => { game.state = 'playing'; game.saveGame(); this.resume(); };
    $('btn-settings-pause').onclick = () => this.open('menu-settings', 'menu-pause');
    $('btn-help-pause').onclick = () => this.open('menu-help', 'menu-pause');
    $('btn-quit').onclick = () => { game.state = 'playing'; game.saveGame(true); location.reload(); };
    $('btn-settings-back').onclick = () => this.open(this.back);
    $('btn-help-back').onclick = () => this.open(this.helpBack);
    $('btn-pause').onclick = () => this.pause();

    const s = game.settings;
    const q = $('set-quality'), vol = $('set-volume'), mus = $('set-music'), sens = $('set-sens'), fps = $('set-fps');
    q.value = s.quality; vol.value = s.volume; mus.value = s.music; sens.value = s.sensitivity; fps.checked = s.showFps;
    const apply = () => {
      const ns = { quality: q.value, volume: +vol.value, music: +mus.value, sensitivity: +sens.value, showFps: fps.checked };
      saveSettings(ns);
      game.applySettings(ns);
    };
    for (const el of [q, vol, mus, sens, fps]) el.addEventListener('change', apply);
    for (const el of [vol, mus, sens]) el.addEventListener('input', apply);
    game.input.onPause = () => {
      if (game.state === 'playing') this.pause();
      else if (game.state === 'paused') this.resume();
    };
  }

  ready() {
    $('loading').classList.add('hidden');
    $('main-buttons').classList.remove('hidden');
    $('btn-continue').classList.toggle('hidden', !loadSave());
  }

  _start(save) {
    this.game.audio.unlock();
    this.open(null);
    this.game.startGame(save);
  }

  open(id, back) {
    for (const m of document.querySelectorAll('.menu')) m.classList.add('hidden');
    if (id === 'menu-settings' && back) this.back = back;
    if (id === 'menu-help' && back) this.helpBack = back;
    if (id) $(id).classList.remove('hidden');
  }

  pause() {
    const g = this.game;
    if (g.state !== 'playing') return;
    g.state = 'paused';
    g.input.clearAll();
    g.audio.engine(false); g.audio.horn(false); g.audio.siren(0);
    if (document.pointerLockElement) document.exitPointerLock();
    const list = $('mission-list');
    list.innerHTML = '<b>Missions</b>' + g.missions.defs.map((d, i) => {
      const done = g.missions.completed.has(d.id);
      return `<div class="${done ? 'done' : ''}">${i + 1}. ${d.name} — $${d.reward.toLocaleString()} ${done ? '✔' : ''}</div>`;
    }).join('');
    this.open('menu-pause');
  }

  resume() {
    const g = this.game;
    this.open(null);
    g.audio.unlock();
    if (g.state === 'paused') g.state = 'playing';
  }
}
