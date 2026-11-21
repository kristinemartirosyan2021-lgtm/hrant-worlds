// Global constants: world layout, quality presets, palettes.

export const BLOCK = 60;            // city block (lot) size incl. sidewalk
export const ROAD_W = 14;           // normal street width (2 lanes)
export const HWY_W = 20;            // highway width (4 lanes)
export const PITCH = BLOCK + ROAD_W;
export const GRID_N = 8;            // blocks per axis
export const HALF = (GRID_N * PITCH) / 2;   // 296
export const SIDEWALK = 4;
export const RING = 366;            // ring highway distance from centre (N, S, W)
export const OCEAN_DRIVE_X = 330;   // beach road on the east side
export const WATER_X = 392;         // ocean starts here
export const ISLAND = { x0: 590, x1: 870, z0: -170, z1: 170 };
export const BRIDGE = { z: 0, halfW: 8, rampStart: 342, deckStart: 392, deckEnd: 600, rampEnd: 650, h: 7 };
export const ISLAND_NODE_X = 730;
export const WORLD_BOUNDS = { x0: -470, x1: 900, z0: -470, z1: 470 };

export const roadCoord = (i) => -HALF + i * PITCH;              // i = 0..GRID_N
export const blockCenter = (i) => -HALF + i * PITCH + PITCH / 2; // i = 0..GRID_N-1

export const QUALITY = {
  low: { pixelRatio: 1, far: 230, shadows: false, peds: 10, traffic: 8, shinyWater: false, label: 'Low' },
  medium: { pixelRatio: 1.5, far: 320, shadows: false, peds: 18, traffic: 14, shinyWater: true, label: 'Medium' },
  high: { pixelRatio: 2, far: 440, shadows: true, peds: 28, traffic: 20, shinyWater: true, label: 'High' },
};

export const PALETTE = {
  downtown: ['#dfe7ef', '#a9c7e8', '#8fb3d9', '#f0e6d8', '#cfd8dc', '#9ec9c4', '#f2c6d0', '#b8c4d6'],
  deco: ['#ffd1dc', '#b5ead7', '#fff1b6', '#c7ceea', '#ffdac1', '#e2f0cb', '#f8b8d0', '#a0e7e5', '#ffffff'],
  house: ['#fdf6e3', '#ffe4c4', '#f5d6e0', '#d6f0ef', '#fff5c2', '#e8e0ff', '#ffffff'],
  roof: ['#c46a4a', '#a8563c', '#e0a060', '#8a5a44', '#d9825b'],
  neon: ['#ff2fa8', '#21f0ff', '#ff7a2f', '#b44dff', '#3dff8a'],
  cars: ['#ff4f8b', '#2ec4b6', '#f5f5f5', '#c6ff4f', '#8b5cf6', '#ff9f1c', '#1c1c1c', '#c0c7cf', '#e63946', '#7ec8ff', '#ffd23f', '#14532d'],
  shirts: ['#ff6fa5', '#2ec4b6', '#ffffff', '#ffd23f', '#7ec8ff', '#ff9f1c', '#9b5de5', '#e63946', '#3ddc97', '#f4a261', '#222222'],
  pants: ['#2c3e66', '#1f1f1f', '#d8c3a5', '#4a4a4a', '#ffffff', '#6b4f3a', '#3a5a40'],
  skin: ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0673d'],
  hair: ['#1b1b1b', '#3b2412', '#7a4a1f', '#d9b36c', '#6d6d6d', '#a52a2a'],
};
