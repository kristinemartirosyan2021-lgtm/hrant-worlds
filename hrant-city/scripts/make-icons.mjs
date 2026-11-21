// Generates the PWA icons (PNG) with a tiny built-in PNG encoder – no dependencies.
// Design: synthwave sunset, striped sun, palm silhouette-free bold "H".
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function draw(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const pad = maskable ? 0.1 : 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let c = v < 0.62 ? mix([255, 214, 90], [255, 47, 168], v / 0.62) : mix([120, 30, 160], [18, 6, 42], (v - 0.62) / 0.38);
      // sun
      const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy);
      if (r < 0.3 - pad * 0.5 && v < 0.62) {
        const stripe = v > 0.4 && Math.floor((v - 0.4) * 40) % 2 === 1;
        c = stripe ? c : mix([255, 240, 140], [255, 90, 120], (v - 0.2) / 0.42);
      }
      // horizon grid
      if (v > 0.62) {
        const gy = (v - 0.62) / 0.38;
        if (Math.abs(((u - 0.5) / (gy + 0.15)) * 4 % 1) < 0.06 || Math.abs((Math.log(gy + 0.05) * 6) % 1) < 0.08) c = mix(c, [33, 240, 255], 0.7);
      }
      // bold H
      const hx = (u - 0.5) / (0.62 - pad), hy = (v - 0.47) / (0.62 - pad);
      const inH = Math.abs(hy) < 0.36 && (Math.abs(hx + 0.27) < 0.1 || Math.abs(hx - 0.27) < 0.1 || (Math.abs(hx) < 0.27 && Math.abs(hy) < 0.07));
      const inHo = Math.abs(hy) < 0.40 && (Math.abs(hx + 0.27) < 0.14 || Math.abs(hx - 0.27) < 0.14 || (Math.abs(hx) < 0.27 && Math.abs(hy) < 0.11));
      if (inHo) c = [26, 6, 48];
      if (inH) c = [255, 255, 255];
      // rounded corners for non-maskable
      let a = 255;
      if (!maskable) {
        const cr = 0.18, qx = Math.max(Math.abs(u - 0.5) - (0.5 - cr), 0), qy = Math.max(Math.abs(v - 0.5) - (0.5 - cr), 0);
        if (Math.hypot(qx, qy) > cr) a = 0;
      }
      const i = (y * size + x) * 4;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = a;
    }
  }
  return png(size, size, buf);
}

const out = path.resolve('public/icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), draw(192, false));
fs.writeFileSync(path.join(out, 'icon-512.png'), draw(512, false));
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), draw(512, true));
fs.writeFileSync(path.join(out, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd65a"/><stop offset=".62" stop-color="#ff2fa8"/><stop offset=".63" stop-color="#781ea0"/><stop offset="1" stop-color="#12062a"/></linearGradient></defs>
<rect width="100" height="100" rx="18" fill="url(#g)"/><circle cx="50" cy="50" r="30" fill="#fff08c" opacity=".55"/>
<path d="M28 25h12v19h20V25h12v50H60V55H40v20H28z" fill="#fff" stroke="#1a0630" stroke-width="3"/></svg>`);
console.log('icons written to', out);
