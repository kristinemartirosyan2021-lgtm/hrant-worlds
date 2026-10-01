// 1 m navigation grid + A* with path smoothing for the AI.
import { MAP } from '../config.js';

const HALF = MAP.half + 1;
const N = Math.ceil(HALF * 2);

class Heap {
  constructor(cap, f) { this.a = new Int32Array(cap); this.n = 0; this.f = f; }
  push(i) {
    const a = this.a, f = this.f;
    let k = this.n++;
    a[k] = i;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (f[a[p]] <= f[a[k]]) break;
      const t = a[p]; a[p] = a[k]; a[k] = t; k = p;
    }
  }
  pop() {
    const a = this.a, f = this.f;
    const top = a[0];
    a[0] = a[--this.n];
    let k = 0;
    for (;;) {
      const l = k * 2 + 1, r = l + 1;
      let m = k;
      if (l < this.n && f[a[l]] < f[a[m]]) m = l;
      if (r < this.n && f[a[r]] < f[a[m]]) m = r;
      if (m === k) break;
      const t = a[m]; a[m] = a[k]; a[k] = t; k = m;
    }
    return top;
  }
}

export class NavGrid {
  constructor(world) {
    this.W = world;
    this.N = N;
    this.grid = new Uint8Array(N * N);
    this.g = new Float32Array(N * N);
    this.f = new Float32Array(N * N);
    this.parent = new Int32Array(N * N);
    this.seen = new Uint32Array(N * N);
    this.closed = new Uint32Array(N * N);
    this.gen = 1;
    this.heap = new Heap(N * N, this.f);
  }

  idx(x, z) {
    const i = Math.floor(x + HALF), j = Math.floor(z + HALF);
    if (i < 0 || j < 0 || i >= N || j >= N) return -1;
    return j * N + i;
  }
  cx(i) { return (i % N) - HALF + 0.5; }
  cz(i) { return Math.floor(i / N) - HALF + 0.5; }

  build() {
    const T = this.W.terrain;
    const grid = this.grid;
    const inf = 0.36;
    for (const b of this.W.collision.boxes) {
      if (b.noNav) continue;
      const i0 = Math.max(0, Math.floor(b.min[0] - inf + HALF - 0.5));
      const i1 = Math.min(N - 1, Math.ceil(b.max[0] + inf + HALF - 0.5));
      const j0 = Math.max(0, Math.floor(b.min[2] - inf + HALF - 0.5));
      const j1 = Math.min(N - 1, Math.ceil(b.max[2] + inf + HALF - 0.5));
      for (let j = j0; j <= j1; j++) {
        const z = j - HALF + 0.5;
        if (z < b.min[2] - inf || z > b.max[2] + inf) continue;
        for (let i = i0; i <= i1; i++) {
          const x = i - HALF + 0.5;
          if (x < b.min[0] - inf || x > b.max[0] + inf) continue;
          const g = T.height(x, z);
          if (b.max[1] > g + 0.45 && b.min[1] < g + 1.75) grid[j * N + i] = 1;
        }
      }
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = i - HALF + 0.5, z = j - HALF + 0.5;
      if (Math.abs(x) > MAP.half - 1 || Math.abs(z) > MAP.half - 1) { grid[j * N + i] = 1; continue; }
      if (T.slope(x, z) > 0.95) grid[j * N + i] = 1;
    }
  }

  walkable(x, z) {
    const i = this.idx(x, z);
    return i >= 0 && this.grid[i] === 0;
  }

  nearestWalkable(x, z, maxR = 8) {
    if (this.walkable(x, z)) return { x, z };
    for (let r = 1; r <= maxR; r++) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const px = x + Math.cos(ang) * r, pz = z + Math.sin(ang) * r;
        if (this.walkable(px, pz)) return { x: px, z: pz };
      }
    }
    return null;
  }

  // Line of walkability on the grid (sampled every 0.4 m, with lateral clearance).
  los(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / 0.4);
    const nx = len > 0 ? -dz / len * 0.3 : 0, nz = len > 0 ? dx / len * 0.3 : 0;
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const x = ax + dx * t, z = az + dz * t;
      if (!this.walkable(x, z) || !this.walkable(x + nx, z + nz) || !this.walkable(x - nx, z - nz)) return false;
    }
    return true;
  }

  findPath(sx, sz, tx, tz, maxIter = 24000) {
    let s = this.idx(sx, sz), t = this.idx(tx, tz);
    if (s < 0 || t < 0) return null;
    if (this.grid[s]) { const p = this.nearestWalkable(sx, sz, 3); if (!p) return null; s = this.idx(p.x, p.z); }
    if (this.grid[t]) { const p = this.nearestWalkable(tx, tz, 6); if (!p) return null; t = this.idx(p.x, p.z); tx = p.x; tz = p.z; }
    if (s === t) return [{ x: tx, z: tz }];
    const gen = ++this.gen;
    const { grid, g, f, parent, seen, closed, heap } = this;
    heap.n = 0;
    const tix = t % N, tjz = Math.floor(t / N);
    const hfun = (i) => {
      const dx = Math.abs((i % N) - tix), dz = Math.abs(Math.floor(i / N) - tjz);
      return dx + dz + (1.4142 - 2) * Math.min(dx, dz);
    };
    g[s] = 0; f[s] = hfun(s); parent[s] = -1; seen[s] = gen;
    heap.push(s);
    let found = false, iter = 0, bestI = s, bestH = Infinity;
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
    while (heap.n > 0 && iter++ < maxIter) {
      const cur = heap.pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (cur === t) { found = true; break; }
      const hc = f[cur] - g[cur];
      if (hc < bestH) { bestH = hc; bestI = cur; }
      const ci = cur % N, cj = Math.floor(cur / N);
      for (const [di, dj, cost] of DIRS) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const n = nj * N + ni;
        if (grid[n] || closed[n] === gen) continue;
        if (di && dj && (grid[cj * N + ni] || grid[nj * N + ci])) continue;
        const ng = g[cur] + cost;
        if (seen[n] !== gen || ng < g[n]) {
          seen[n] = gen; g[n] = ng; f[n] = ng + hfun(n) * 1.05; parent[n] = cur;
          heap.push(n);
        }
      }
    }
    const end = found ? t : bestI;
    if (!found && end === s) return null;
    const raw = [];
    for (let c = end; c !== -1; c = parent[c]) raw.push(c);
    raw.reverse();
    // smooth
    const pts = raw.map((i) => ({ x: this.cx(i), z: this.cz(i) }));
    if (found) pts[pts.length - 1] = { x: tx, z: tz };
    const out = [];
    let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !this.los(pts[a].x, pts[a].z, pts[b].x, pts[b].z)) b--;
      out.push(pts[b]);
      a = b;
    }
    if (!out.length) out.push(pts[pts.length - 1]);
    return out;
  }

  randomWalkableNear(x, z, r, rng = Math.random) {
    for (let k = 0; k < 20; k++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (this.walkable(px, pz)) return { x: px, z: pz };
    }
    return this.nearestWalkable(x, z, 10);
  }
}
