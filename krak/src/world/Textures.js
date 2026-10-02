// Procedural canvas textures (no external image assets).
import * as THREE from 'three';
import { mulberry32 } from '../core/util.js';

let maxAniso = 4;
export function setMaxAnisotropy(a) { maxAniso = a; }

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function noiseFill(ctx, w, h, base, amt, seed = 1, scale = 1) {
  const r = mulberry32(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amt * scale;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function blotches(ctx, w, h, colors, count, rmin, rmax, alpha, seed) {
  const r = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    const x = r() * w, y = r() * h, rad = rmin + r() * (rmax - rmin);
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      ctx.beginPath();
      ctx.ellipse(x + ox, y + oy, rad, rad * (0.5 + r()), r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// Armenian tuff masonry: irregular large blocks with soft mortar.
export function tuffTexture(base = '#b9785e', seed = 3) {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#8d6a5a';
  ctx.fillRect(0, 0, S, S);
  const r = mulberry32(seed);
  const rows = 6;
  const rh = S / rows;
  const baseC = new THREE.Color(base);
  for (let y = 0; y < rows; y++) {
    let x = -r() * 60;
    while (x < S) {
      const bw = 70 + r() * 70;
      const col = baseC.clone().offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12);
      ctx.fillStyle = '#' + col.getHexString();
      const ins = 3;
      ctx.fillRect(x + ins, y * rh + ins, bw - ins * 2, rh - ins * 2);
      // wrap
      if (x + bw > S) ctx.fillRect(x + ins - S, y * rh + ins, bw - ins * 2, rh - ins * 2);
      // chisel marks
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#000';
      for (let k = 0; k < 6; k++) ctx.fillRect(x + ins + r() * bw, y * rh + ins + r() * rh, 1 + r() * 3, 1 + r() * 6);
      ctx.globalAlpha = 1;
      x += bw;
    }
  }
  blotches(ctx, S, S, ['#5a3d33', '#d9a68a', '#3c2b25'], 50, 8, 40, 0.08, seed + 1);
  noiseFill(ctx, S, S, 0, 34, seed + 2);
  return toTex(c);
}

export function plasterTexture(base = '#d8cbb3', seed = 7) {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  blotches(ctx, S, S, ['#a99a80', '#efe6d4', '#8c7d66'], 70, 10, 80, 0.12, seed);
  // grime streaks
  const r = mulberry32(seed + 5);
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.05 + r() * 0.08;
    ctx.fillStyle = '#4a3f33';
    const x = r() * S;
    ctx.fillRect(x, r() * S * 0.3, 2 + r() * 6, 60 + r() * 200);
  }
  ctx.globalAlpha = 1;
  // cracks
  ctx.strokeStyle = 'rgba(40,30,20,0.35)';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    let x = r() * S, y = r() * S;
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 30; y += r() * 20; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  noiseFill(ctx, S, S, 0, 22, seed + 2);
  return toTex(c);
}

export function concreteTexture(base = '#8f8f8a', seed = 11, panels = true) {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  blotches(ctx, S, S, ['#6d6d68', '#a8a8a2', '#5c5a52'], 90, 6, 60, 0.12, seed);
  if (panels) {
    ctx.strokeStyle = 'rgba(30,30,30,0.45)'; ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, S - 2, S - 2);
    ctx.fillStyle = 'rgba(30,30,30,0.35)';
    for (const [x, y] of [[40, 40], [S - 40, 40], [40, S - 40], [S - 40, S - 40]]) {
      ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
    }
  }
  const r = mulberry32(seed + 9);
  for (let i = 0; i < 30; i++) {
    ctx.globalAlpha = 0.06 + r() * 0.06; ctx.fillStyle = '#2e2a24';
    ctx.fillRect(r() * S, r() * S * 0.4, 3 + r() * 5, 80 + r() * 250);
  }
  ctx.globalAlpha = 1;
  noiseFill(ctx, S, S, 0, 28, seed + 3);
  return toTex(c);
}

export function asphaltTexture(seed = 21) {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#3a3a3c'; ctx.fillRect(0, 0, S, S);
  blotches(ctx, S, S, ['#2a2a2b', '#4a4945', '#55524a'], 120, 6, 50, 0.18, seed);
  const r = mulberry32(seed);
  ctx.strokeStyle = 'rgba(15,15,15,0.6)'; ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath(); let x = r() * S, y = r() * S; ctx.moveTo(x, y);
    for (let k = 0; k < 10; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  noiseFill(ctx, S, S, 0, 40, seed + 1);
  return toTex(c);
}

export function groundTexture(seed = 31) {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, S, S);
  blotches(ctx, S, S, ['#5e5e5e', '#a0a0a0', '#707070', '#949494'], 260, 4, 30, 0.35, seed);
  const r = mulberry32(seed + 3);
  // grass blades / pebbles
  for (let i = 0; i < 2600; i++) {
    const v = 60 + r() * 120;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(r() * S, r() * S, 1 + r() * 2, 2 + r() * 5);
  }
  ctx.globalAlpha = 1;
  noiseFill(ctx, S, S, 0, 30, seed + 1);
  return toTex(c, true, false);
}

export function metalTexture(base = '#7d8389', seed = 41, ridges = 16, rust = 0.35) {
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  const w = S / ridges;
  for (let i = 0; i < ridges; i++) {
    const g = ctx.createLinearGradient(i * w, 0, (i + 1) * w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.0)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g; ctx.fillRect(i * w, 0, w, S);
  }
  blotches(ctx, S, S, ['#7a3e1d', '#94532a', '#4d2a17'], Math.floor(60 * rust), 3, 24, 0.35 * rust + 0.05, seed);
  const r = mulberry32(seed + 2);
  for (let i = 0; i < 30 * rust; i++) {
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#5a2d14';
    ctx.fillRect(r() * S, r() * S, 2 + r() * 3, 20 + r() * 80);
  }
  ctx.globalAlpha = 1;
  noiseFill(ctx, S, S, 0, 26, seed + 1);
  return toTex(c);
}

export function woodTexture(base = '#7a5a3a', seed = 51) {
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  const r = mulberry32(seed);
  const planks = 4;
  for (let p = 0; p < planks; p++) {
    const y = (p * S) / planks;
    ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.15})`;
    ctx.fillRect(0, y, S, S / planks);
    ctx.strokeStyle = 'rgba(20,10,0,0.25)';
    for (let k = 0; k < 14; k++) {
      ctx.beginPath();
      const yy = y + r() * (S / planks);
      ctx.moveTo(0, yy);
      ctx.bezierCurveTo(S * 0.3, yy + (r() - 0.5) * 8, S * 0.6, yy + (r() - 0.5) * 8, S, yy);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(10,5,0,0.6)'; ctx.fillRect(0, y, S, 2);
  }
  noiseFill(ctx, S, S, 0, 20, seed + 1);
  return toTex(c);
}

export function roofTexture(seed = 61) {
  // Rusty corrugated tin, very common on old Armenian houses.
  return metalTexture('#8a4a32', seed, 12, 0.9);
}

export function containerTexture(color, seed = 71) {
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
  const ridges = 10, w = S / ridges;
  for (let i = 0; i < ridges; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(i * w, 0, w * 0.18, S);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(i * w + w * 0.5, 0, w * 0.12, S);
  }
  blotches(ctx, S, S, ['#5a2d14', '#7a3e1d', '#222'], 30, 3, 18, 0.3, seed);
  noiseFill(ctx, S, S, 0, 22, seed + 1);
  return toTex(c);
}

export function rockTexture(seed = 81) {
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#8a8580'; ctx.fillRect(0, 0, S, S);
  blotches(ctx, S, S, ['#5d5853', '#a9a49c', '#6e6a5f', '#4a4640'], 140, 4, 30, 0.3, seed);
  ctx.strokeStyle = 'rgba(30,25,20,0.4)';
  const r = mulberry32(seed + 1);
  for (let i = 0; i < 14; i++) {
    ctx.beginPath(); let x = r() * S, y = r() * S; ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  noiseFill(ctx, S, S, 0, 34, seed + 2);
  return toTex(c);
}

export function basaltTexture(seed = 91) {
  return tuffTexture('#4a4744', seed);
}

// Text sign (shop signs, factory names, checkpoint) in Armenian.
export function signTexture(text, { bg = '#1f3c5a', fg = '#f2e6c9', w = 512, h = 128, font = 800, border = true, sub = '' } = {}) {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  if (border) { ctx.strokeStyle = fg; ctx.lineWidth = 6; ctx.strokeRect(8, 8, w - 16, h - 16); }
  ctx.fillStyle = fg;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = h * (sub ? 0.42 : 0.55);
  ctx.font = `${font} ${size}px "Noto Sans Armenian", sans-serif`;
  while (ctx.measureText(text).width > w * 0.86 && size > 10) { size -= 2; ctx.font = `${font} ${size}px "Noto Sans Armenian", sans-serif`; }
  ctx.fillText(text, w / 2, sub ? h * 0.4 : h / 2 + 2);
  if (sub) {
    ctx.font = `600 ${h * 0.2}px "Noto Sans Armenian", sans-serif`;
    ctx.fillText(sub, w / 2, h * 0.76);
  }
  noiseFill(ctx, w, h, 0, 26, text.length * 13);
  // weathering
  blotches(ctx, w, h, ['#000', '#5a3d2a'], 12, 4, 26, 0.12, text.length);
  return toTex(c, false);
}

// Khachkar (cross-stone) relief: ornamental cross with interlace frame.
export function khachkarTexture() {
  const W = 256, H = 448;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#7d6a5c'; ctx.fillRect(0, 0, W, H);
  const groove = 'rgba(30,20,15,0.65)', hi = 'rgba(230,210,190,0.35)';
  // frame interlace
  ctx.lineWidth = 6;
  for (let i = 0; i < 2; i++) {
    ctx.strokeStyle = i ? hi : groove;
    const o = i ? -1 : 1;
    ctx.strokeRect(16 + o, 16 + o, W - 32, H - 32);
    ctx.strokeRect(30 + o, 30 + o, W - 60, H - 60);
    for (let y = 40; y < H - 40; y += 22) {
      ctx.beginPath(); ctx.arc(23 + o, y + o, 7, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(W - 23 + o, y + o, 7, 0, 7); ctx.stroke();
    }
  }
  // cross
  const cx = W / 2, cy = H * 0.42;
  const drawCross = (o, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = 10;
    const arm = (dx, dy, len) => {
      ctx.beginPath(); ctx.moveTo(cx + o, cy + o); ctx.lineTo(cx + dx * len + o, cy + dy * len + o); ctx.stroke();
      // flared trefoil terminals
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + dx * len + (dy !== 0 ? s * 10 : 0) + o, cy + dy * len + (dx !== 0 ? s * 10 : 0) + o, 9, 0, 7);
        ctx.stroke();
      }
    };
    arm(0, -1, 95); arm(-1, 0, 70); arm(1, 0, 70); arm(0, 1, 120);
    ctx.beginPath(); ctx.arc(cx + o, cy + o, 26, 0, 7); ctx.stroke();
  };
  drawCross(2, groove); drawCross(-1, hi);
  // rosette under cross (wheel of eternity motif, simplified)
  const ry = H * 0.82;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.strokeStyle = groove; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 14, ry + Math.sin(a) * 14, 16, a, a + 2.2); ctx.stroke();
  }
  noiseFill(ctx, W, H, 0, 30, 77);
  blotches(ctx, W, H, ['#3e3a2d', '#6b7a4a'], 30, 4, 20, 0.2, 5);
  return toTex(c, false);
}

export function decalTexture() {
  const S = 64;
  const [c, ctx] = canvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.22, 'rgba(10,8,6,0.95)');
  g.addColorStop(0.35, 'rgba(40,35,30,0.6)');
  g.addColorStop(1, 'rgba(60,55,50,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return toTex(c, false);
}

export function grassBladeTexture() {
  const W = 128, H = 128;
  const [c, ctx] = canvas(W, H);
  const r = mulberry32(5);
  for (let i = 0; i < 40; i++) {
    const x = 8 + r() * (W - 16);
    const h = 50 + r() * 70;
    const g = Math.floor(110 + r() * 80);
    ctx.strokeStyle = `rgb(${g + 40},${g + 30},${Math.floor(g * 0.45)})`;
    ctx.lineWidth = 2 + r() * 2;
    ctx.beginPath(); ctx.moveTo(x, H);
    ctx.quadraticCurveTo(x + (r() - 0.5) * 20, H - h * 0.6, x + (r() - 0.5) * 34, H - h);
    ctx.stroke();
  }
  return toTex(c, false);
}

export function softDotTexture() {
  const S = 64;
  const [c, ctx] = canvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return toTex(c, false);
}

export function flashTexture() {
  const S = 128;
  const [c, ctx] = canvas(S);
  ctx.translate(S / 2, S / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, S / 2);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.25, 'rgba(255,200,90,0.9)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(S / 2, 0); ctx.lineTo(0, 8); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(0, 0, S * 0.22, 0, 7); ctx.fill();
  return toTex(c, false);
}

// Distant mountain silhouettes, including a twin-peaked snowy giant.
export function mountainTexture(seed, twin = false) {
  const W = 2048, H = 512;
  const [c, ctx] = canvas(W, H);
  const r = mulberry32(seed);
  const pts = [];
  for (let x = 0; x <= W; x += 8) {
    let y = H * 0.55 + Math.sin(x * 0.004 + seed) * 40 + Math.sin(x * 0.011 + seed * 2) * 25 + (r() - 0.5) * 8;
    if (twin) {
      const p1 = Math.exp(-Math.pow((x - W * 0.42) / 260, 2)) * H * 0.5;
      const p2 = Math.exp(-Math.pow((x - W * 0.66) / 160, 2)) * H * 0.3;
      y -= p1 + p2;
    }
    pts.push([x, y]);
  }
  ctx.beginPath(); ctx.moveTo(0, H);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(W, H); ctx.closePath();
  const g = ctx.createLinearGradient(0, H * 0.05, 0, H);
  g.addColorStop(0, twin ? '#b8b2ba' : '#5d6270');
  g.addColorStop(1, twin ? '#6a6d7c' : '#3c404b');
  ctx.fillStyle = g; ctx.fill();
  if (twin) {
    // snow caps
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(250,246,240,0.95)';
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (const [x, y] of pts) {
      const snowLine = H * 0.32 + Math.sin(x * 0.05) * 10 + Math.sin(x * 0.13) * 6;
      ctx.lineTo(x, Math.min(snowLine, H));
    }
    ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  return toTex(c, false);
}
