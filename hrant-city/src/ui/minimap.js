// Circular rotating minimap. The full map is pre-rendered once to an offscreen canvas.
import { WORLD_BOUNDS, WATER_X, ISLAND, BRIDGE } from '../config.js';

const SCALE = 1; // px per metre on the offscreen map

export class Minimap {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.radius = 130; // metres shown from centre to edge
    this.timer = 0;
    this._prerender();
  }

  _prerender() {
    const g = this.game, W = WORLD_BOUNDS;
    const w = Math.ceil((W.x1 - W.x0 + 200) * SCALE), h = Math.ceil((W.z1 - W.z0 + 200) * SCALE);
    this.ox = W.x0 - 100; this.oz = W.z0 - 100;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const X = (v) => (v - this.ox) * SCALE, Z = (v) => (v - this.oz) * SCALE;
    x.fillStyle = '#3f6f3a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#1b6f9a'; x.fillRect(X(WATER_X), 0, w, h);
    x.fillStyle = '#d9c48c'; x.fillRect(X(303), 0, X(WATER_X) - X(303), h);
    x.fillRect(X(ISLAND.x0), Z(ISLAND.z0), (ISLAND.x1 - ISLAND.x0) * SCALE, (ISLAND.z1 - ISLAND.z0) * SCALE);
    for (const b of g.world.blocks) {
      x.fillStyle = b.type === 'park' ? '#4f9a46' : b.type === 'suburb' ? '#58804e' : '#6b6b78';
      x.fillRect(X(b.cx - 30), Z(b.cz - 30), 60 * SCALE, 60 * SCALE);
    }
    x.fillStyle = '#4a4a58';
    for (const bx of g.world.colliders.boxes) x.fillRect(X(bx.minX), Z(bx.minZ), (bx.maxX - bx.minX) * SCALE, (bx.maxZ - bx.minZ) * SCALE);
    x.lineCap = 'square';
    for (const e of g.world.graph.edges) {
      x.strokeStyle = e.highway ? '#f2d16b' : '#e9e9ee';
      x.lineWidth = e.width * SCALE * 0.9;
      x.beginPath(); x.moveTo(X(e.a.x), Z(e.a.z)); x.lineTo(X(e.b.x), Z(e.b.z)); x.stroke();
    }
    x.strokeStyle = '#ff6fa5'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(X(BRIDGE.deckStart), Z(BRIDGE.z - BRIDGE.halfW)); x.lineTo(X(BRIDGE.deckEnd), Z(BRIDGE.z - BRIDGE.halfW));
    x.moveTo(X(BRIDGE.deckStart), Z(BRIDGE.z + BRIDGE.halfW)); x.lineTo(X(BRIDGE.deckEnd), Z(BRIDGE.z + BRIDGE.halfW)); x.stroke();
    this.map = c;
    // landmarks
    this.icons = [];
    const L = g.world.landmarks;
    if (L.hospital) this.icons.push({ ...L.hospital, label: 'H', color: '#ff3355' });
    if (L.police) this.icons.push({ ...L.police, label: 'P', color: '#2b7bff' });
  }

  draw(dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1 / 30;
    const g = this.game, ctx = this.ctx, cw = this.canvas.width, R = cw / 2;
    const P = g.player.pos;
    const yaw = g.cam.yaw;
    const speed = g.player.vehicle ? Math.abs(g.player.vehicle.forwardSpeed) : 0;
    const radius = this.radius + Math.min(speed * 2, 90);
    const k = R / radius; // px per metre on minimap
    const theta = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));
    ctx.save();
    ctx.fillStyle = '#1b6f9a'; ctx.fillRect(0, 0, cw, cw);
    ctx.translate(R, R);
    ctx.rotate(theta);
    ctx.scale(k / SCALE, k / SCALE);
    ctx.drawImage(this.map, -(P.x - this.ox) * SCALE, -(P.z - this.oz) * SCALE);
    ctx.restore();

    const toScreen = (x, z) => {
      const dx = (x - P.x) * k, dz = (z - P.z) * k;
      const c = Math.cos(theta), s = Math.sin(theta);
      return [R + dx * c - dz * s, R + dx * s + dz * c];
    };
    const dot = (x, z, color, size, label, edge, done) => {
      let [sx, sy] = toScreen(x, z);
      const dx = sx - R, dy = sy - R, d = Math.hypot(dx, dy), lim = R - size - 4;
      if (d > lim) { if (!edge) return; sx = R + (dx / d) * lim; sy = R + (dy / d) * lim; }
      ctx.beginPath(); ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fillStyle = done ? '#555' : color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke();
      if (label) { ctx.fillStyle = '#000'; ctx.font = `900 ${size * 1.5}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, sx, sy + 1); }
    };
    for (const ic of this.icons) dot(ic.x, ic.z, ic.color, 9, ic.label, true);
    // vehicles: police in blue/red
    for (const v of g.vehicles.list) {
      if (v.isPolice && v.siren) dot(v.x, v.z, Math.floor(g.time * 4) % 2 ? '#ff2a2a' : '#2b7bff', 5);
    }
    for (const c of g.police.cops) if (c.alive) dot(c.x, c.z, '#2b7bff', 3.5);
    for (const b of g.missions.blips()) dot(b.x, b.z, b.color, b.size * 1.6, b.label, b.edge, b.done);
    // player arrow
    const h = g.player.vehicle ? g.player.vehicle.heading : g.player.heading;
    const a = Math.atan2(Math.cos(h), Math.sin(h)) + theta;
    ctx.save(); ctx.translate(R, R); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, 10); ctx.lineTo(-5, 0); ctx.lineTo(-10, -10); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#ff2fa8'; ctx.stroke();
    ctx.restore();
    // north marker
    const [nx, ny] = toScreen(P.x, P.z - 1e5);
    const nd = Math.hypot(nx - R, ny - R);
    const mx = R + ((nx - R) / nd) * (R - 14), my = R + ((ny - R) / nd) * (R - 14);
    ctx.fillStyle = '#fff'; ctx.font = '900 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeText('N', mx, my); ctx.fillText('N', mx, my);
  }
}
