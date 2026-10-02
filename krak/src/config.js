// Global tuning constants and data tables.
export const MAP = {
  half: 165,          // playable half-extent (meters)
  wall: 168,          // invisible boundary
  terrainHalf: 230,   // rendered terrain half-extent
};

export const PLAYER_COUNT = 16;

export const RARITY = [
  { id: 0, name: 'Սովորական', css: '#c3c9d1', hex: 0xc3c9d1, dmg: 1.0, mag: 1.0, reload: 1.0, recoil: 1.0 },
  { id: 1, name: 'Հազվադեպ', css: '#3fa9ff', hex: 0x3fa9ff, dmg: 1.07, mag: 1.15, reload: 0.94, recoil: 0.9 },
  { id: 2, name: 'Էպիկական', css: '#b85cff', hex: 0xb85cff, dmg: 1.14, mag: 1.25, reload: 0.88, recoil: 0.82 },
  { id: 3, name: 'Լեգենդար', css: '#ffb22e', hex: 0xffb22e, dmg: 1.22, mag: 1.35, reload: 0.8, recoil: 0.74 },
];

export const AREAS = [
  { id: 'town', name: 'ՀԻՆ ԹԱՂ', x: -92, z: -88, r: 58 },
  { id: 'industry', name: 'ԳՈՐԾԱՐԱՆԱՅԻՆ ԳՈՏԻ', x: 92, z: -88, r: 58 },
  { id: 'checkpoint', name: 'ԼՔՎԱԾ ԱՆՑԱԿԵՏ', x: 0, z: 100, r: 38 },
  { id: 'hills', name: 'ԺԱՅՌՈՏ ԲԼՈՒՐՆԵՐ', x: 105, z: 95, r: 60 },
  { id: 'forest', name: 'ԿԱՂՆՈՒ ԱՆՏԱՌ', x: -105, z: 95, r: 60 },
  { id: 'fort', name: 'ՀԻՆ ԲԵՐԴ', x: 0, z: 0, r: 34 },
];

export const BOT_NAMES = [
  'Սևակ', 'Տիգրան', 'Լիլիթ', 'Գոռ', 'Արամ', 'Նազենի', 'Վահե', 'Սոնա', 'Մհեր',
  'Անուշ', 'Կարեն', 'Գայանե', 'Արթուր', 'Լևոն', 'Մանե', 'Սամվել', 'Զարա', 'Էդգար',
  'Շանթ', 'Աստղիկ', 'Վարդան', 'Թամար', 'Ռուբեն', 'Հասմիկ',
];

export const ZONE_PHASES = [
  { wait: 40, shrink: 32, radius: 118, dps: 2 },
  { wait: 35, shrink: 28, radius: 74, dps: 4 },
  { wait: 30, shrink: 25, radius: 42, dps: 7 },
  { wait: 25, shrink: 22, radius: 20, dps: 10 },
  { wait: 20, shrink: 28, radius: 3, dps: 16 },
];
