// Road network graph: grid streets + ring highway + Ocean Drive + bridge to the island.
import { GRID_N, ROAD_W, HWY_W, RING, OCEAN_DRIVE_X, roadCoord, ISLAND_NODE_X } from '../config.js';

export class RoadGraph {
  constructor() { this.nodes = []; this.edges = []; this._byKey = new Map(); }

  node(x, z, opts = {}) {
    const k = x.toFixed(1) + ',' + z.toFixed(1);
    let n = this._byKey.get(k);
    if (!n) {
      n = { id: this.nodes.length, x, z, links: [], light: false, offset: 0, size: 0, ...opts };
      this.nodes.push(n); this._byKey.set(k, n);
    } else Object.assign(n, opts);
    return n;
  }

  edge(a, b, width, opts = {}) {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    const e = { id: this.edges.length, a, b, width, len, dx: dx / len, dz: dz / len, noTraffic: false, highway: width >= HWY_W, ...opts };
    this.edges.push(e);
    a.links.push({ node: b, edge: e });
    b.links.push({ node: a, edge: e });
    a.size = Math.max(a.size, width); b.size = Math.max(b.size, width);
    return e;
  }

  nearestNode(x, z, filter) {
    let best = null, bd = Infinity;
    for (const n of this.nodes) {
      if (filter && !filter(n)) continue;
      const d = (n.x - x) ** 2 + (n.z - z) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  /** Lane geometry for travelling from node `from` along edge e. */
  lane(e, from) {
    const to = e.a === from ? e.b : e.a;
    const sgn = e.a === from ? 1 : -1;
    const dx = e.dx * sgn, dz = e.dz * sgn;
    const rx = -dz, rz = dx; // right-hand side
    const off = e.width / 4;
    const s0 = from.size / 2 + 1, s1 = to.size / 2 + 1.5;
    return {
      from, to, dx, dz, rx, rz, off,
      sx: from.x + dx * s0 + rx * off, sz: from.z + dz * s0 + rz * off,
      ex: to.x - dx * s1 + rx * off, ez: to.z - dz * s1 + rz * off,
      len: e.len - s0 - s1,
    };
  }

  /** Traffic light: returns 'green' | 'yellow' | 'red' for the axis of an edge. */
  lightState(node, e, time) {
    if (!node.light) return 'green';
    const axisZ = Math.abs(e.dz) > Math.abs(e.dx);
    const p = (time + node.offset) % 18;
    const q = axisZ ? p : (p + 9) % 18;
    if (q < 7) return 'green';
    if (q < 8.5) return 'yellow';
    return 'red';
  }
}

export function buildRoadGraph() {
  const g = new RoadGraph();
  const rc = roadCoord;
  const grid = [];
  for (let i = 0; i <= GRID_N; i++) {
    grid[i] = [];
    for (let j = 0; j <= GRID_N; j++) {
      const interior = i > 0 && i < GRID_N && j > 0 && j < GRID_N;
      grid[i][j] = g.node(rc(i), rc(j), { light: interior, offset: ((i * 7 + j * 13) % 18), grid: true });
    }
  }
  for (let i = 0; i <= GRID_N; i++) {
    for (let j = 0; j <= GRID_N; j++) {
      if (i < GRID_N) g.edge(grid[i][j], grid[i + 1][j], ROAD_W);
      if (j < GRID_N) g.edge(grid[i][j], grid[i][j + 1], ROAD_W);
    }
  }
  const R = RING, E = OCEAN_DRIVE_X;
  const evens = [0, 2, 4, 6, 8].map(rc);
  const chain = (pts, w) => { for (let k = 0; k < pts.length - 1; k++) g.edge(pts[k], pts[k + 1], w); };
  // North & south highway
  for (const z of [-R, R]) chain([-R, ...evens, E].map((x) => g.node(x, z, { ring: true })), HWY_W);
  // West highway
  chain([-R, ...evens, R].map((z) => g.node(-R, z, { ring: true })), HWY_W);
  // Ocean Drive (east)
  const all = []; for (let j = 0; j <= GRID_N; j++) all.push(rc(j));
  chain([-R, ...all, R].map((z) => g.node(E, z, { ring: true })), ROAD_W);
  // Connectors grid <-> ring
  for (let i = 0; i <= GRID_N; i += 2) {
    g.edge(grid[i][0], g.node(rc(i), -R), ROAD_W);
    g.edge(grid[i][GRID_N], g.node(rc(i), R), ROAD_W);
    g.edge(grid[0][i], g.node(-R, rc(i)), ROAD_W);
  }
  for (let j = 0; j <= GRID_N; j++) g.edge(grid[GRID_N][j], g.node(E, rc(j)), ROAD_W);
  // Bridge to the island
  const island = g.node(ISLAND_NODE_X, 0, { island: true });
  g.bridgeEdge = g.edge(g.node(E, 0), island, ROAD_W, { bridge: true, noTraffic: true });
  g.grid = grid;
  return g;
}
