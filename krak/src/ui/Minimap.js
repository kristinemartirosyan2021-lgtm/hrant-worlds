// Pre-rendered tactical map + per-frame minimap / big map drawing.
import { AREAS, MAP } from '../config.js';
import { FLAT_ZONES } from '../world/Terrain.js';

const R = 180; // map half-extent drawn

export class Minimap {
  constructor(game) {
    this.game = game;
    this.mini = document.getElementById('minimap');
    this.mctx = this.mini.getContext('2d');
    this.big = document.getElementById('bigmapCanvas');
    this.bctx = this.big.getContext('2d');
    this.pings = [];
    game.events.on('gunshot', (e) => {
      if (!e.actor || e.actor.isPlayer || !game.player) return;
      const d = e.actor.ctrl.pos.distanceTo(game.player.ctrl.pos);
      if (d < 80) this.pings.push({ x: e.pos.x, z: e.pos.z, t: 1.2 });
    });
  }

  bake() {
    const W = this.game.world;
    const S = 720;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const d = img.data;
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const x = -R + (i / S) * R * 2, z = -R + (j / S) * R * 2;
        const h = W.terrain.height(x, z);
        const hx = W.terrain.height(x + 1.5, z) - h;
        const shade = 1 - Math.max(-0.25, Math.min(0.3, hx * 0.35));
        let r = 92, g = 96, b = 58;
        if (h > 6) { const k = Math.min(1, (h - 6) / 20); r += 40 * k; g += 28 * k; b += 30 * k; }
        let flat = false;
        for (const [cx, cz, hw, hd] of FLAT_ZONES) if (Math.abs(x - cx) < hw && Math.abs(z - cz) < hd && hw > 10 && hd > 10) flat = true;
        if (flat) { r = 104; g = 92; b = 76; }
        const fx = x + 105, fz = z - 95;
        if (Math.hypot(fx, fz) < 72 && !flat) { r *= 0.72; g *= 0.85; b *= 0.7; }
        const k = (j * S + i) * 4;
        d[k] = r * shade; d[k + 1] = g * shade; d[k + 2] = b * shade; d[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const toPx = (v) => ((v + R) / (R * 2)) * S;
    // roads
    ctx.fillStyle = '#3d3b38';
    const rect = (x0, z0, x1, z1) => ctx.fillRect(toPx(x0), toPx(z0), toPx(x1) - toPx(x0), toPx(z1) - toPx(z0));
    rect(-6, -175, 6, 175); rect(-175, -42, 175, -30);
    rect(-152, -92, -32, -84); rect(-96, -140, -88, -42);
    // structures
    for (const b of W.collision.boxes) {
      if (b.noNav) continue;
      const sx = b.max[0] - b.min[0], sz = b.max[2] - b.min[2];
      if (sx > 60 || sz > 60) continue;
      const g = W.terrain.height((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2);
      if (b.max[1] - g < 1.6 || b.min[1] - g > 1) continue;
      ctx.fillStyle = b.mat === 'metal' ? '#8b9196' : b.mat === 'wood' ? '#6b5236' : '#c4ab8c';
      rect(b.min[0], b.min[2], b.max[0], b.max[2]);
    }
    // trees
    ctx.fillStyle = 'rgba(30,50,20,0.65)';
    for (const t of W.vegetation.trees) { ctx.beginPath(); ctx.arc(toPx(t.x), toPx(t.z), 2.2, 0, 7); ctx.fill(); }
    // border
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
    ctx.strokeRect(toPx(-MAP.half), toPx(-MAP.half), toPx(MAP.half) - toPx(-MAP.half), toPx(MAP.half) - toPx(-MAP.half));
    this.base = c;
    this.S = S;
  }

  w2p(v, size, span, c) { return size / 2 + ((v - c) / span) * size; }

  draw(dt) {
    const g = this.game;
    const p = g.player;
    if (!p || !this.base) return;
    for (const q of this.pings) q.t -= dt;
    this.pings = this.pings.filter((q) => q.t > 0);
    const ctx = this.mctx;
    const size = this.mini.width;
    const span = 150; // metres across the minimap
    const px = p.ctrl.pos.x, pz = p.ctrl.pos.z;
    ctx.clearRect(0, 0, size, size);
    const S = this.S;
    const scale = S / (R * 2);
    const sx = ((px - span / 2) + R) * scale, sz = ((pz - span / 2) + R) * scale;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(this.base, sx, sz, span * scale, span * scale, 0, 0, size, size);
    ctx.globalAlpha = 1;
    this.drawZones(ctx, size, span, px, pz, 1.5);
    // pings
    for (const q of this.pings) {
      ctx.fillStyle = `rgba(255,60,50,${Math.min(1, q.t)})`;
      ctx.beginPath(); ctx.arc(this.w2p(q.x, size, span, px), this.w2p(q.z, size, span, pz), 4, 0, 7); ctx.fill();
    }
    this.drawPlayer(ctx, size / 2, size / 2, p.yaw, 1);
    if (g.ui.bigMapOpen) this.drawBig();
  }

  drawZones(ctx, size, span, cx, cz, lw) {
    const z = this.game.zone;
    const k = size / span;
    // outside tint
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.arc(this.w2p(z.center.x, size, span, cx), this.w2p(z.center.y, size, span, cz), z.radius * k, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(70,40,200,0.28)';
    ctx.fill('evenodd');
    ctx.restore();
    ctx.lineWidth = lw * 1.6;
    ctx.strokeStyle = '#5aa8ff';
    ctx.beginPath(); ctx.arc(this.w2p(z.center.x, size, span, cx), this.w2p(z.center.y, size, span, cz), z.radius * k, 0, 7); ctx.stroke();
    if (!z.done) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.arc(this.w2p(z.next.x, size, span, cx), this.w2p(z.next.y, size, span, cz), z.nextRadius * k, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawPlayer(ctx, x, y, yaw, s) {
    ctx.save();
    ctx.translate(x, y);
    // yaw: forward (sin, cos) in world (x, z) -> canvas (x, y)
    ctx.rotate(Math.atan2(Math.cos(yaw), Math.sin(yaw)) + Math.PI / 2);
    ctx.fillStyle = '#ffb22e';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9 * s); ctx.lineTo(6 * s, 7 * s); ctx.lineTo(0, 3 * s); ctx.lineTo(-6 * s, 7 * s); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  drawBig() {
    const g = this.game;
    const ctx = this.bctx;
    const size = this.big.width;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(this.base, 0, 0, size, size);
    const span = R * 2;
    this.drawZones(ctx, size, span, 0, 0, 2);
    ctx.font = '800 15px "Noto Sans Armenian", sans-serif';
    ctx.textAlign = 'center';
    for (const a of AREAS) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(a.name, this.w2p(a.x, size, span, 0) + 1, this.w2p(a.z, size, span, 0) + 1);
      ctx.fillStyle = '#f3eadc';
      ctx.fillText(a.name, this.w2p(a.x, size, span, 0), this.w2p(a.z, size, span, 0));
    }
    const p = g.player;
    this.drawPlayer(ctx, this.w2p(p.ctrl.pos.x, size, span, 0), this.w2p(p.ctrl.pos.z, size, span, 0), p.yaw, 1.4);
  }
}
