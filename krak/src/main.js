// Entry point for ԿՐԱԿ.
import { Game } from './core/Game.js';

const game = new Game();
window.__krak = game;
game.boot().catch((err) => {
  console.error(err);
  const l = document.getElementById('bootLabel');
  if (l) l.textContent = 'ՍԽԱԼ․ ' + (err && err.message ? err.message : err);
});
