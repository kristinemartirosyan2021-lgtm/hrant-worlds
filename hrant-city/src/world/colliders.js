// Spatial hash of axis-aligned building boxes for cheap circle collisions and line-of-sight.

export class ColliderGrid {
  constructor(cell = 32) {
    this.cell = cell;
    this.map = new Map();
    this.boxes = [];
    this.stamp = 0;
  }
  _key(ix, iz) { return (ix + 1000) * 4096 + (iz + 1000); }

  add(minX, minZ, maxX, maxZ, h = 100) {
    const b = { minX, minZ, maxX, maxZ, h, s: 0 };
    this.boxes.push(b);
    const c = this.cell;
    for (let ix = Math.floor(minX / c); ix <= Math.floor(maxX / c); ix++) {
      for (let iz = Math.floor(minZ / c); iz <= Math.floor(maxZ / c); iz++) {
        const k = this._key(ix, iz);
        let arr = this.map.get(k);
        if (!arr) { arr = []; this.map.set(k, arr); }
        arr.push(b);
      }
    }
    return b;
  }

  /** Visit every box overlapping the given rectangle once. */
  _each(minX, minZ, maxX, maxZ, fn) {
    const c = this.cell, s = ++this.stamp;
    for (let ix = Math.floor(minX / c); ix <= Math.floor(maxX / c); ix++) {
      for (let iz = Math.floor(minZ / c); iz <= Math.floor(maxZ / c); iz++) {
        const arr = this.map.get(this._key(ix, iz));
        if (!arr) continue;
        for (const b of arr) {
          if (b.s === s) continue;
          b.s = s;
          if (fn(b) === true) return true;
        }
      }
    }
    return false;
  }

  /**
   * Push a circle out of all boxes. Returns result object (shared) with
   * x,z = corrected position, hit flag and average normal nx,nz.
   */
  pushCircle(x, z, r, y = 0, out = { x: 0, z: 0, hit: false, nx: 0, nz: 0 }) {
    out.hit = false; out.nx = 0; out.nz = 0;
    this._each(x - r, z - r, x + r, z + r, (b) => {
      if (y > b.h) return;
      const cx = x < b.minX ? b.minX : x > b.maxX ? b.maxX : x;
      const cz = z < b.minZ ? b.minZ : z > b.maxZ ? b.maxZ : z;
      let dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) return;
      let nx, nz, pen;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        nx = dx / d; nz = dz / d; pen = r - d;
      } else {
        // centre inside the box: push along the axis of least penetration
        const l = x - b.minX, rr = b.maxX - x, t = z - b.minZ, bb = b.maxZ - z;
        const m = Math.min(l, rr, t, bb);
        if (m === l) { nx = -1; nz = 0; pen = l + r; }
        else if (m === rr) { nx = 1; nz = 0; pen = rr + r; }
        else if (m === t) { nx = 0; nz = -1; pen = t + r; }
        else { nx = 0; nz = 1; pen = bb + r; }
      }
      x += nx * pen; z += nz * pen;
      out.nx += nx; out.nz += nz; out.hit = true;
    });
    if (out.hit) {
      const l = Math.hypot(out.nx, out.nz) || 1;
      out.nx /= l; out.nz /= l;
    }
    out.x = x; out.z = z;
    return out;
  }

  pointBlocked(x, z, y = 1) {
    return this._each(x, z, x, z, (b) => y < b.h && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
  }

  /** True when the straight line from a to b passes through a building. */
  segmentBlocked(ax, az, bx, bz, y = 1.5) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / 2.5));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.pointBlocked(ax + dx * t, az + dz * t, y)) return true;
    }
    return false;
  }

  /** Distance along a ray until a building is hit (for camera collision). */
  rayDistance(ax, az, ay, dx, dz, dy, maxD, step = 0.5) {
    for (let d = step; d < maxD; d += step) {
      if (this.pointBlocked(ax + dx * d, az + dz * d, ay + dy * d)) return Math.max(0.5, d - 0.6);
    }
    return maxD;
  }
}
