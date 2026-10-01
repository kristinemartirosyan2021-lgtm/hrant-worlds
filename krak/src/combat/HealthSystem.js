// Health with vest + helmet damage mitigation and durability.
export const ARMOR_LEVELS = [
  null,
  { name: 'Զրահ 1', reduce: 0.25, dur: 90 },
  { name: 'Զրահ 2', reduce: 0.38, dur: 140 },
  { name: 'Զրահ 3', reduce: 0.5, dur: 200 },
];
export const HELMET_LEVELS = [
  null,
  { name: 'Սաղավարտ 1', reduce: 0.3, dur: 70 },
  { name: 'Սաղավարտ 2', reduce: 0.42, dur: 110 },
  { name: 'Սաղավարտ 3', reduce: 0.55, dur: 160 },
];

export class Health {
  constructor(max = 100) {
    this.max = max;
    this.hp = max;
    this.armor = { level: 0, dur: 0, max: 0 };
    this.helmet = { level: 0, dur: 0, max: 0 };
    this.lastDamageT = 0;
  }
  reset() {
    this.hp = this.max;
    this.armor = { level: 0, dur: 0, max: 0 };
    this.helmet = { level: 0, dur: 0, max: 0 };
  }
  get alive() { return this.hp > 0; }

  equipArmor(level) {
    const d = ARMOR_LEVELS[level];
    this.armor = { level, dur: d.dur, max: d.dur };
  }
  equipHelmet(level) {
    const d = HELMET_LEVELS[level];
    this.helmet = { level, dur: d.dur, max: d.dur };
  }

  // Returns { dealt, killed, armorHit }
  take(amount, headshot = false, explosive = false) {
    if (this.hp <= 0) return { dealt: 0, killed: false, armorHit: false };
    let dmg = amount;
    let armorHit = false;
    const piece = headshot ? this.helmet : this.armor;
    const table = headshot ? HELMET_LEVELS : ARMOR_LEVELS;
    if (piece.level > 0 && piece.dur > 0) {
      const red = table[piece.level].reduce * (explosive ? 0.6 : 1);
      const absorbed = dmg * red;
      piece.dur = Math.max(0, piece.dur - absorbed * 1.3);
      dmg -= absorbed;
      armorHit = true;
      if (piece.dur <= 0) piece.level = 0;
    }
    const before = this.hp;
    this.hp = Math.max(0, this.hp - dmg);
    return { dealt: before - this.hp, killed: this.hp <= 0, armorHit };
  }

  heal(amount) {
    if (this.hp <= 0) return;
    this.hp = Math.min(this.max, this.hp + amount);
  }
}
