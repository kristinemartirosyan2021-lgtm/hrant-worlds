// Shared static-world materials (all batched geometry provides vertex colors for tint variation).
import * as THREE from 'three';
import * as T from './Textures.js';

export function createMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, vertexColors: true, ...o });
  const M = {
    tuff: std({ map: T.tuffTexture('#c58a6c', 3) }),
    tuffO: std({ map: T.tuffTexture('#c97b4f', 4) }),
    tuffB: std({ map: T.tuffTexture('#a87c6a', 5) }),
    basalt: std({ map: T.basaltTexture() }),
    plaster: std({ map: T.plasterTexture('#d6c7aa', 7) }),
    plasterG: std({ map: T.plasterTexture('#b4beb6', 8) }),
    plasterY: std({ map: T.plasterTexture('#d9b98a', 9) }),
    concrete: std({ map: T.concreteTexture('#8d8b85', 11) }),
    concreteNP: std({ map: T.concreteTexture('#85837c', 12, false) }),
    asphalt: std({ map: T.asphaltTexture(), roughness: 0.96 }),
    sidewalk: std({ map: T.concreteTexture('#a39d92', 13, true) }),
    metal: std({ map: T.metalTexture('#6f7d86', 41, 16, 0.45), metalness: 0.35, roughness: 0.65 }),
    metalW: std({ map: T.metalTexture('#a9aca6', 42, 16, 0.3), metalness: 0.3, roughness: 0.7 }),
    roofTin: std({ map: T.roofTexture(), metalness: 0.25, roughness: 0.75, side: THREE.DoubleSide }),
    wood: std({ map: T.woodTexture('#7a5a3a', 51) }),
    woodDark: std({ map: T.woodTexture('#4b3626', 52) }),
    rock: std({ map: T.rockTexture() }),
    darkMetal: std({ color: 0x2c3034, roughness: 0.55, metalness: 0.55 }),
    trim: std({ color: 0x3a2a1f, roughness: 0.8 }),
    pane: std({ color: 0x1b2228, roughness: 0.15, metalness: 0.7 }),
    rubber: std({ color: 0x18181a, roughness: 0.95 }),
    sandbag: std({ map: T.plasterTexture('#a08f66', 15), roughness: 1 }),
    paintRed: std({ color: 0xa8302a, roughness: 0.7 }),
    paintWhite: std({ color: 0xe6e2d8, roughness: 0.7 }),
    paintYellow: std({ color: 0xd8a523, roughness: 0.7 }),
    cRed: std({ map: T.containerTexture('#9a3324', 71), metalness: 0.3, roughness: 0.7 }),
    cBlue: std({ map: T.containerTexture('#2d5a86', 72), metalness: 0.3, roughness: 0.7 }),
    cGreen: std({ map: T.containerTexture('#3c6b45', 73), metalness: 0.3, roughness: 0.7 }),
    cOrange: std({ map: T.containerTexture('#c06a26', 74), metalness: 0.3, roughness: 0.7 }),
    cGrey: std({ map: T.containerTexture('#6f7471', 75), metalness: 0.3, roughness: 0.7 }),
    carPaint: std({ roughness: 0.45, metalness: 0.45 }),
    chrome: std({ color: 0x9aa0a6, roughness: 0.3, metalness: 0.9 }),
    cloth: std({ roughness: 1, side: THREE.DoubleSide }),
    brick: std({ map: T.tuffTexture('#8e4a35', 17) }),
    foliage: std({ roughness: 1 }),
  };
  M.pane.userData.noShadow = true;
  M.cloth.userData.noShadow = false;
  // UV scales (metres per texture repeat) per material key.
  M.uv = {
    tuff: 3, tuffO: 3, tuffB: 3, basalt: 3, plaster: 4, plasterG: 4, plasterY: 4, concrete: 3, concreteNP: 3,
    asphalt: 6, sidewalk: 2, metal: 4, metalW: 4, roofTin: 3, wood: 2, woodDark: 2, rock: 3, sandbag: 1.2,
    cRed: 2.6, cBlue: 2.6, cGreen: 2.6, cOrange: 2.6, cGrey: 2.6, brick: 2.5,
  };
  // Impact material type for bullet effects / sounds.
  M.impact = {
    metal: 'metal', metalW: 'metal', roofTin: 'metal', darkMetal: 'metal', cRed: 'metal', cBlue: 'metal',
    cGreen: 'metal', cOrange: 'metal', cGrey: 'metal', carPaint: 'metal', chrome: 'metal',
    wood: 'wood', woodDark: 'wood', trim: 'wood', sandbag: 'dirt', rock: 'stone',
  };
  return M;
}
