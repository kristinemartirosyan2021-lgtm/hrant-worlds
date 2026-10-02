// Weapon data. Every weapon has a distinct role, rhythm and recoil signature.
export const AMMO = {
  light: { name: 'Թեթև փամփուշտ', short: '9մմ', color: '#e8c35a', pack: 30 },
  rifle: { name: 'Հրացանի փամփուշտ', short: '7.62', color: '#d77a3a', pack: 30 },
  shell: { name: 'Կոտորակ', short: '12', color: '#d84a3a', pack: 10 },
  sniper: { name: 'Դիպուկ փամփուշտ', short: '.338', color: '#7ab0e0', pack: 8 },
};

export const WEAPONS = {
  ar: {
    id: 'ar', name: 'ԱՐԾԻՎ-7', type: 'Ինքնաձիգ', slot: 'primary', ammo: 'rifle', auto: true,
    damage: 24, head: 2.0, rpm: 610, mag: 30, reload: 2.2, range: 85, pellets: 1,
    spreadHip: 2.4, spreadAds: 0.35, spreadMove: 1.6, bloom: 0.35, bloomMax: 3.0,
    recoilV: 0.95, recoilH: 0.38, recoilRecover: 7, kick: 0.07, adsFov: 52, adsZoom: 1.35,
    sound: 'ar', tracer: 0xffd27a, shellSize: 1, weight: 0.92, botPref: 'mid', speedMul: 0.95,
  },
  smg: {
    id: 'smg', name: 'ԿԱՅԾ', type: 'Ավտոմատ ատրճանակ', slot: 'primary', ammo: 'light', auto: true,
    damage: 17, head: 1.75, rpm: 900, mag: 32, reload: 1.75, range: 40, pellets: 1,
    spreadHip: 2.2, spreadAds: 0.9, spreadMove: 0.7, bloom: 0.22, bloomMax: 2.4,
    recoilV: 0.5, recoilH: 0.45, recoilRecover: 10, kick: 0.05, adsFov: 58, adsZoom: 1.15,
    sound: 'smg', tracer: 0xffe08a, shellSize: 0.7, weight: 0.97, botPref: 'close', speedMul: 1.0,
  },
  shotgun: {
    id: 'shotgun', name: 'ՈՐՈՏ', type: 'Կոտորակային հրացան', slot: 'primary', ammo: 'shell', auto: false,
    damage: 13, head: 1.5, rpm: 75, mag: 6, reload: 2.7, range: 16, pellets: 9,
    spreadHip: 5.2, spreadAds: 3.8, spreadMove: 0.6, bloom: 0, bloomMax: 0,
    recoilV: 5.0, recoilH: 1.2, recoilRecover: 6, kick: 0.16, adsFov: 60, adsZoom: 1.1,
    sound: 'shotgun', tracer: 0xffc070, shellSize: 1.4, weight: 0.93, botPref: 'close', speedMul: 0.95,
  },
  sniper: {
    id: 'sniper', name: 'ՆԵՏ', type: 'Դիպուկահար հրացան', slot: 'primary', ammo: 'sniper', auto: false,
    damage: 92, head: 2.6, rpm: 44, mag: 5, reload: 3.0, range: 220, pellets: 1,
    spreadHip: 7.0, spreadAds: 0.0, spreadMove: 4.0, bloom: 0, bloomMax: 0,
    recoilV: 6.5, recoilH: 1.0, recoilRecover: 4, kick: 0.2, adsFov: 16, adsZoom: 4, scope: true,
    sound: 'sniper', tracer: 0xbfe4ff, shellSize: 1.5, weight: 0.88, botPref: 'far', speedMul: 0.9,
  },
  pistol: {
    id: 'pistol', name: 'ԳԱՅԼ', type: 'Ատրճանակ', slot: 'secondary', ammo: 'light', auto: false,
    damage: 21, head: 2.0, rpm: 380, mag: 12, reload: 1.35, range: 35, pellets: 1,
    spreadHip: 1.4, spreadAds: 0.45, spreadMove: 0.8, bloom: 0.5, bloomMax: 2.0,
    recoilV: 1.7, recoilH: 0.5, recoilRecover: 9, kick: 0.09, adsFov: 60, adsZoom: 1.15,
    sound: 'pistol', tracer: 0xffe6a0, shellSize: 0.6, weight: 1.0, botPref: 'close', speedMul: 1.05,
  },
};

export const GRENADE = { damage: 115, radius: 7.5, fuse: 2.6, name: 'ՆՌՆԱԿ' };
