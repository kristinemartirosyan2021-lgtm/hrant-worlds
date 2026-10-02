// Static collision world: axis-aligned boxes in a uniform 2D grid + analytic terrain.
const CELL = 8;
const ORIGIN = -256;
const N = 64; // 64 * 8 = 512 m

export class Collision {
  constructor(terrain) {
    this.terrain = terrain;
    this.boxes = [];
    this.cells = Array.from({ length: N * N }, () => []);
    this.stamp = 1;
    this._q = [];
  }

  add(minx, miny, minz, maxx, maxy, maxz, mat = 'stone', opts = {}) {
    const b = {
      min: [Math.min(minx, maxx), Math.min(miny, maxy), Math.min(minz, maxz)],
      max: [Math.max(minx, maxx), Math.max(miny, maxy), Math.max(minz, maxz)],
      mat, id: this.boxes.length, s: 0,
      noBullet: !!opts.noBullet,   // e.g. foliage: blocks movement but not bullets
      noNav: !!opts.noNav,
      cover: opts.cover !== false,
    };
    this.boxes.push(b);
    const x0 = this.ci(b.min[0]), x1 = this.ci(b.max[0]);
    const z0 = this.ci(b.min[2]), z1 = this.ci(b.max[2]);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) this.cells[x * N + z].push(b);
    return b;
  }

  ci(v) {
    const i = Math.floor((v - ORIGIN) / CELL);
    return i < 0 ? 0 : i >= N ? N - 1 : i;
  }

  // Unique boxes overlapping an XZ rectangle.
  query(minx, minz, maxx, maxz) {
    const out = this._q;
    out.length = 0;
    const s = ++this.stamp;
    const x0 = this.ci(minx), x1 = this.ci(maxx), z0 = this.ci(minz), z1 = this.ci(maxz);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const cell = this.cells[x * N + z];
      for (let i = 0; i < cell.length; i++) {
        const b = cell[i];
        if (b.s === s) continue;
        b.s = s;
        if (b.max[0] < minx || b.min[0] > maxx || b.max[2] < minz || b.min[2] > maxz) continue;
        out.push(b);
      }
    }
    return out;
  }

  // Highest walkable surface under a circle at most `stepUp` above feetY.
  groundAt(x, z, r, feetY, stepUp = 0.5) {
    let g = this.terrain.height(x, z);
    const boxes = this.query(x - r, z - r, x + r, z + r);
    const lim = feetY + stepUp;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const top = b.max[1];
      if (top > g && top <= lim && circleRect(x, z, r, b)) g = top;
    }
    return g;
  }

  // Lowest ceiling above a circle (for jumps / standing up).
  ceilingAt(x, z, r, fromY) {
    let c = Infinity;
    const boxes = this.query(x - r, z - r, x + r, z + r);
    for (const b of boxes) {
      if (b.min[1] >= fromY && b.min[1] < c && circleRect(x, z, r, b)) c = b.min[1];
    }
    return c;
  }

  // Push a vertical cylinder out of boxes. Returns true if anything was hit.
  resolveCylinder(pos, r, yLo, yHi, out = null) {
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      const boxes = this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r);
      let moved = false;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        if (b.max[1] <= yLo || b.min[1] >= yHi) continue;
        const cx = Math.max(b.min[0], Math.min(pos.x, b.max[0]));
        const cz = Math.max(b.min[2], Math.min(pos.z, b.max[2]));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true; moved = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = r - d;
          dx /= d; dz /= d;
          pos.x += dx * push; pos.z += dz * push;
          if (out) { out.x = dx; out.z = dz; }
        } else {
          // Center inside box: exit along the shallowest axis.
          const l = pos.x - b.min[0], rr = b.max[0] - pos.x, n = pos.z - b.min[2], f = b.max[2] - pos.z;
          const m = Math.min(l, rr, n, f);
          if (m === l) { pos.x = b.min[0] - r; if (out) { out.x = -1; out.z = 0; } }
          else if (m === rr) { pos.x = b.max[0] + r; if (out) { out.x = 1; out.z = 0; } }
          else if (m === n) { pos.z = b.min[2] - r; if (out) { out.x = 0; out.z = -1; } }
          else { pos.z = b.max[2] + r; if (out) { out.x = 0; out.z = 1; } }
        }
      }
      if (!moved) break;
    }
    return hit;
  }

  // Ray vs static boxes (+terrain). Direction must be normalised.
  raycast(ox, oy, oz, dx, dy, dz, maxT, opts = {}) {
    let best = maxT, bestB = null, bestAxis = 0, bestSign = 0;
    const s = ++this.stamp;
    let ix = this.ci(ox), iz = this.ci(oz);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const adx = Math.abs(dx), adz = Math.abs(dz);
    const tDX = adx > 1e-9 ? CELL / adx : Infinity;
    const tDZ = adz > 1e-9 ? CELL / adz : Infinity;
    const cellMinX = ORIGIN + ix * CELL, cellMinZ = ORIGIN + iz * CELL;
    let tMX = adx > 1e-9 ? (dx > 0 ? (cellMinX + CELL - ox) / dx : (cellMinX - ox) / dx) : Infinity;
    let tMZ = adz > 1e-9 ? (dz > 0 ? (cellMinZ + CELL - oz) / dz : (cellMinZ - oz) / dz) : Infinity;
    const invX = 1 / dx, invY = 1 / dy, invZ = 1 / dz;
    let t = 0;
    for (let guard = 0; guard < 200; guard++) {
      const cell = this.cells[ix * N + iz];
      for (let i = 0; i < cell.length; i++) {
        const b = cell[i];
        if (b.s === s) continue;
        b.s = s;
        if (opts.bullets && b.noBullet) continue;
        // slab test
        let t0 = 0, t1 = best, axis = -1, sign = 0;
        let ta = (b.min[0] - ox) * invX, tb = (b.max[0] - ox) * invX;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        if (ta > t0) { t0 = ta; axis = 0; sign = -stepX; }
        if (tb < t1) t1 = tb;
        if (t0 > t1) continue;
        ta = (b.min[1] - oy) * invY; tb = (b.max[1] - oy) * invY;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        if (ta > t0) { t0 = ta; axis = 1; sign = dy > 0 ? -1 : 1; }
        if (tb < t1) t1 = tb;
        if (t0 > t1) continue;
        ta = (b.min[2] - oz) * invZ; tb = (b.max[2] - oz) * invZ;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        if (ta > t0) { t0 = ta; axis = 2; sign = -stepZ; }
        if (tb < t1) t1 = tb;
        if (t0 > t1) continue;
        if (axis === -1) continue; // origin inside box: ignore (lets shots leave cover tops)
        if (t0 < best) { best = t0; bestB = b; bestAxis = axis; bestSign = sign; }
      }
      // advance
      if (tMX < tMZ) { t = tMX; tMX += tDX; ix += stepX; }
      else { t = tMZ; tMZ += tDZ; iz += stepZ; }
      if (t > best || ix < 0 || iz < 0 || ix >= N || iz >= N) break;
    }
    let hit = null;
    if (bestB) {
      const nrm = [0, 0, 0];
      nrm[bestAxis] = bestSign;
      hit = { t: best, x: ox + dx * best, y: oy + dy * best, z: oz + dz * best, nx: nrm[0], ny: nrm[1], nz: nrm[2], mat: bestB.mat, box: bestB };
    }
    if (!opts.noTerrain) {
      const th = this.terrain.raycast(ox, oy, oz, dx, dy, dz, hit ? hit.t : maxT);
      if (th) hit = th;
    }
    return hit;
  }

  // True if the segment a->b is unobstructed.
  clear(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-4) return true;
    return !this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len - 0.05, { bullets: true });
  }
}

export function circleRect(x, z, r, b) {
  const cx = Math.max(b.min[0], Math.min(x, b.max[0]));
  const cz = Math.max(b.min[2], Math.min(z, b.max[2]));
  const dx = x - cx, dz = z - cz;
  return dx * dx + dz * dz < r * r;
}
