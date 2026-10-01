// Persistent profile: progression, stats, missions, achievements, settings.
const KEY = 'krak_save_v1';

const DEFAULT = () => ({
  version: 1,
  xp: 0,
  level: 1,
  character: 'areg',
  skins: {},            // characterId -> skinId
  unlockedSkins: ['default'],
  stats: {
    matches: 0, wins: 0, kills: 0, headshots: 0, deaths: 0,
    damage: 0, shotsFired: 0, shotsHit: 0, bestPlace: 99, playTime: 0, longestKill: 0,
  },
  daily: { date: '', missions: [] },
  achievements: {},
  settings: { sensitivity: 1.0, volume: 0.8, music: 0.5, quality: 'high', invertY: false },
  seenIntro: false,
});

export class SaveSystem {
  constructor() {
    this.data = DEFAULT();
    this.storageOk = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = deepMerge(DEFAULT(), JSON.parse(raw));
    } catch (e) {
      this.storageOk = false;
    }
  }
  save() {
    if (!this.storageOk) return;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { this.storageOk = false; }
  }
  reset() { this.data = DEFAULT(); this.save(); }
}

function deepMerge(base, over) {
  if (typeof over !== 'object' || over === null || Array.isArray(over)) return over ?? base;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    const b = base[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) ? deepMerge(b, over[k]) : over[k];
  }
  return out;
}
