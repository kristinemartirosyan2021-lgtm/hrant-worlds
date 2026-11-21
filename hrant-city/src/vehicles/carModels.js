// Vehicle specs (arcade handling) and low-poly model builders (all built facing +Z).
import { GeoBuilder, BASE, col } from '../utils/geo.js';

export const VEHICLES = {
  sedan: { name: 'Sedan', width: 1.9, length: 4.4, accel: 11, maxSpeed: 40, maxReverse: 10, steerRate: 2.2, grip: 7, driftGrip: 1.4, drag: 0.12, mass: 1.5, health: 100, sound: 0.9 },
  taxi: { name: 'Taxi', width: 1.9, length: 4.4, accel: 11, maxSpeed: 40, maxReverse: 10, steerRate: 2.2, grip: 7, driftGrip: 1.4, drag: 0.12, mass: 1.5, health: 100, sound: 0.9 },
  sports: { name: 'Sports', width: 2.0, length: 4.5, accel: 17, maxSpeed: 55, maxReverse: 12, steerRate: 2.4, grip: 8, driftGrip: 1.5, drag: 0.1, mass: 1.2, health: 85, sound: 1.25 },
  police: { name: 'Police', width: 1.9, length: 4.6, accel: 14, maxSpeed: 48, maxReverse: 12, steerRate: 2.3, grip: 8, driftGrip: 1.5, drag: 0.1, mass: 1.7, health: 130, sound: 1.05 },
  truck: { name: 'Truck', width: 2.5, length: 7.2, accel: 6.5, maxSpeed: 28, maxReverse: 7, steerRate: 1.5, grip: 6, driftGrip: 2, drag: 0.15, mass: 4, health: 220, sound: 0.6 },
  bike: { name: 'Motorbike', width: 0.9, length: 2.1, accel: 16, maxSpeed: 50, maxReverse: 6, steerRate: 2.8, grip: 9, driftGrip: 2, drag: 0.1, mass: 0.6, health: 60, sound: 1.5, showRider: true, seatY: 0.62, seatZ: -0.25, lean: true },
  boat: { name: 'Speedboat', width: 2.6, length: 6, accel: 10, maxSpeed: 36, maxReverse: 8, steerRate: 1.7, grip: 1.8, driftGrip: 0.8, drag: 0.18, mass: 2, health: 150, sound: 0.8, water: true, showRider: true, seatY: 0.35, seatZ: -0.8 },
};

const GLASS = '#2a3a4c', TYRE = '#151515', TRIM = '#2d2d2d', HUB = '#bfc5cc';

function wheels(b, xs, zs, r, w, y = r) {
  for (const x of xs) for (const z of zs) {
    b.prim(BASE.cyl10, r * 2, w, r * 2, x, y, z, col(TYRE), 0, 0, Math.PI / 2);
    b.prim(BASE.cyl6, r * 1.1, w + 0.02, r * 1.1, x, y, z, col(HUB), 0, 0, Math.PI / 2);
  }
}

/** Returns { body: BufferGeometry (vertex coloured), lights: BufferGeometry, siren?: {red, blue} } */
export function buildVehicleGeometry(type, paint) {
  const b = new GeoBuilder(), L = new GeoBuilder();
  const P = col(paint);
  const head = col('#fff6d0'), tail = col('#ff2030');
  let sirenR = null, sirenB = null;
  switch (type) {
    case 'sedan': case 'taxi': case 'police': {
      const len = type === 'police' ? 4.6 : 4.4;
      b.box(1.9, 0.62, len, 0, 0.66, 0, P);
      b.box(1.7, 0.55, 2.2, 0, 1.24, -0.25, col(GLASS));
      b.box(1.72, 0.08, 2.0, 0, 1.54, -0.25, P);
      b.box(1.95, 0.22, 0.25, 0, 0.45, len / 2, col(TRIM));
      b.box(1.95, 0.22, 0.25, 0, 0.45, -len / 2, col(TRIM));
      if (type === 'police') {
        b.box(1.93, 0.34, 2.1, 0, 0.72, 0, col('#111111'));
        b.box(1.2, 0.12, 0.35, 0, 1.6, -0.2, col('#333333'));
        sirenR = new GeoBuilder().box(0.5, 0.18, 0.3, 0.32, 1.72, -0.2, col('#ff1030'));
        sirenB = new GeoBuilder().box(0.5, 0.18, 0.3, -0.32, 1.72, -0.2, col('#1050ff'));
      }
      if (type === 'taxi') L.box(0.7, 0.25, 0.3, 0, 1.7, -0.2, col('#ffe66b'));
      wheels(b, [-0.9, 0.9], [-1.35, 1.35], 0.36, 0.28);
      L.box(0.4, 0.16, 0.06, 0.62, 0.74, len / 2 + 0.01, head); L.box(0.4, 0.16, 0.06, -0.62, 0.74, len / 2 + 0.01, head);
      L.box(0.4, 0.16, 0.06, 0.62, 0.74, -len / 2 - 0.01, tail); L.box(0.4, 0.16, 0.06, -0.62, 0.74, -len / 2 - 0.01, tail);
      break;
    }
    case 'sports': {
      b.box(2.0, 0.5, 4.5, 0, 0.55, 0, P);
      b.box(1.9, 0.18, 1.4, 0, 0.86, 1.4, P);
      b.box(1.6, 0.42, 1.7, 0, 1.0, -0.35, col(GLASS));
      b.box(1.55, 0.06, 1.3, 0, 1.23, -0.45, P);
      b.box(1.9, 0.08, 0.4, 0, 1.12, -2.1, col(TRIM));
      b.box(0.1, 0.35, 0.1, 0.7, 0.92, -2.1, col(TRIM)); b.box(0.1, 0.35, 0.1, -0.7, 0.92, -2.1, col(TRIM));
      b.box(2.02, 0.12, 4.3, 0, 0.36, 0, col(TRIM));
      wheels(b, [-0.95, 0.95], [-1.4, 1.45], 0.38, 0.32);
      L.box(0.5, 0.1, 0.06, 0.65, 0.66, 2.26, head); L.box(0.5, 0.1, 0.06, -0.65, 0.66, 2.26, head);
      L.box(1.6, 0.1, 0.06, 0, 0.7, -2.26, tail);
      break;
    }
    case 'truck': {
      b.box(2.3, 0.5, 7.0, 0, 0.8, 0, col(TRIM));
      b.box(2.4, 1.8, 2.1, 0, 1.95, 2.35, P);
      b.box(2.2, 0.75, 0.06, 0, 2.3, 3.42, col(GLASS));
      b.box(0.06, 0.65, 1.2, 1.21, 2.3, 2.5, col(GLASS)); b.box(0.06, 0.65, 1.2, -1.21, 2.3, 2.5, col(GLASS));
      b.box(2.5, 2.7, 4.7, 0, 2.4, -1.1, col('#f2f2f2'));
      b.box(2.52, 0.4, 4.72, 0, 1.3, -1.1, P);
      wheels(b, [-1.05, 1.05], [-2.6, -1.5, 2.4], 0.5, 0.4);
      L.box(0.4, 0.22, 0.06, 0.8, 1.2, 3.42, head); L.box(0.4, 0.22, 0.06, -0.8, 1.2, 3.42, head);
      L.box(0.3, 0.2, 0.06, 0.9, 1.0, -3.47, tail); L.box(0.3, 0.2, 0.06, -0.9, 1.0, -3.47, tail);
      break;
    }
    case 'bike': {
      b.box(0.3, 0.38, 1.3, 0, 0.66, 0, P);
      b.box(0.42, 0.3, 0.55, 0, 0.92, 0.25, P);
      b.box(0.34, 0.12, 0.7, 0, 0.9, -0.3, col('#1a1a1a'));
      b.box(0.08, 0.6, 0.08, 0, 0.9, 0.72, col(TRIM), 0, -0.4);
      b.box(0.75, 0.06, 0.06, 0, 1.17, 0.6, col(TRIM));
      b.prim(BASE.cyl10, 0.68, 0.14, 0.68, 0, 0.34, 0.75, col(TYRE), 0, 0, Math.PI / 2);
      b.prim(BASE.cyl10, 0.68, 0.16, 0.68, 0, 0.34, -0.72, col(TYRE), 0, 0, Math.PI / 2);
      b.box(0.2, 0.15, 0.6, 0.18, 0.45, -0.45, col('#9aa0a6'));
      L.box(0.18, 0.14, 0.06, 0, 1.0, 0.86, head);
      L.box(0.16, 0.1, 0.06, 0, 0.85, -0.68, tail);
      break;
    }
    case 'boat': {
      b.box(2.4, 0.8, 4.4, 0, 0.15, -0.5, col('#ffffff'));
      b.box(1.7, 0.8, 1.7, 0, 0.15, 1.75, col('#ffffff'), Math.PI / 4);
      b.box(2.42, 0.2, 4.42, 0, 0.35, -0.5, P);
      b.box(1.72, 0.2, 1.72, 0, 0.35, 1.75, P, Math.PI / 4);
      b.box(2.0, 0.08, 3.6, 0, 0.58, -0.7, col('#e8d8b8'));
      b.box(1.8, 0.5, 0.08, 0, 0.9, 0.6, col(GLASS), 0, -0.4);
      b.box(1.2, 0.4, 0.8, 0, 0.75, -1.4, col('#2ec4b6'));
      b.box(0.5, 0.9, 0.5, 0, 0.5, -2.85, col('#1a1a1a'));
      L.box(0.3, 0.15, 0.06, 0.6, 0.65, 1.4, head); L.box(0.3, 0.15, 0.06, -0.6, 0.65, 1.4, head);
      break;
    }
  }
  return {
    body: b.build(), lights: L.empty ? null : L.build(),
    siren: sirenR ? { red: sirenR.build(), blue: sirenB.build() } : null,
  };
}
