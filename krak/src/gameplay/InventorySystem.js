// Weapon slots (1-2 primaries, 3 sidearm), ammo pools, grenades and medkits.
import { WEAPONS } from '../combat/WeaponDefs.js';
import { RARITY } from '../config.js';

export const MAX_AMMO = { light: 180, rifle: 210, shell: 40, sniper: 30 };
export const MAX_GRENADES = 4;
export const MAX_MEDKITS = 5;

export function magSize(item) {
  return Math.round(WEAPONS[item.id].mag * RARITY[item.rarity].mag);
}

export class Inventory {
  constructor() { this.reset(); }

  reset() {
    this.slots = [null, null, null];
    this.current = 2;
    this.ammo = { light: 0, rifle: 0, shell: 0, sniper: 0 };
    this.grenades = 0;
    this.medkits = 0;
  }

  get weapon() { return this.slots[this.current]; }
  get def() { const w = this.weapon; return w ? WEAPONS[w.id] : null; }

  // Returns the weapon item that was dropped (if any) and the slot it went into.
  addWeapon(id, rarity, mag = null) {
    const def = WEAPONS[id];
    const item = { id, rarity, mag: mag ?? Math.round(def.mag * RARITY[rarity].mag) };
    let slot;
    if (def.slot === 'secondary') slot = 2;
    else if (!this.slots[0]) slot = 0;
    else if (!this.slots[1]) slot = 1;
    else slot = this.current === 2 ? 0 : this.current;
    const dropped = this.slots[slot];
    this.slots[slot] = item;
    return { dropped, slot };
  }

  addAmmo(type, n) {
    const before = this.ammo[type];
    this.ammo[type] = Math.min(MAX_AMMO[type], before + n);
    return this.ammo[type] - before;
  }

  hasWeapon() { return this.slots.some(Boolean); }

  bestSlot(prefer = null) {
    let best = -1, bestScore = -1;
    for (let i = 0; i < 3; i++) {
      const it = this.slots[i];
      if (!it) continue;
      const def = WEAPONS[it.id];
      const ammo = it.mag + this.ammo[def.ammo];
      if (ammo <= 0) continue;
      let score = def.damage * (def.pellets || 1) * (def.rpm / 60) * RARITY[it.rarity].dmg;
      if (prefer && def.botPref === prefer) score *= 1.8;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }
}
