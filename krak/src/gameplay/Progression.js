// XP / levels, daily missions, achievements and cosmetic unlocks.
import { CHARACTERS, SKINS } from '../entities/HumanModel.js';

export const xpForLevel = (l) => 500 + (l - 1) * 220;

const MISSION_POOL = [
  { id: 'kills5', text: 'Կատարիր 5 սպանություն', key: 'kills', goal: 5, xp: 250 },
  { id: 'win1', text: 'Հաղթիր 1 խաղ', key: 'wins', goal: 1, xp: 400 },
  { id: 'play3', text: 'Խաղա 3 մարտ', key: 'matches', goal: 3, xp: 200 },
  { id: 'head2', text: 'Կատարիր 2 գլխին հարված', key: 'headshots', goal: 2, xp: 250 },
  { id: 'dmg800', text: 'Հասցրու 800 վնաս', key: 'damage', goal: 800, xp: 220 },
  { id: 'loot20', text: 'Վերցրու 20 իր', key: 'loot', goal: 20, xp: 150 },
  { id: 'top5', text: 'Մնա լավագույն 5-ում', key: 'top5', goal: 1, xp: 220 },
  { id: 'nade1', text: 'Ոչնչացրու թշնամուն նռնակով', key: 'nadeKills', goal: 1, xp: 300 },
];

export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'Առաջին արյուն', desc: 'Կատարիր առաջին սպանությունդ', test: (s) => s.kills >= 1 },
  { id: 'last_one', name: 'Վերջինը', desc: 'Հաղթիր առաջին մարտդ', test: (s) => s.wins >= 1 },
  { id: 'sharp', name: 'Սուր աչք', desc: 'Կատարիր 10 գլխին հարված', test: (s) => s.headshots >= 10 },
  { id: 'hunter', name: 'Որսորդ', desc: 'Ընդհանուր 50 սպանություն', test: (s) => s.kills >= 50 },
  { id: 'veteran', name: 'Վետերան', desc: 'Խաղա 20 մարտ', test: (s) => s.matches >= 20 },
  { id: 'rampage', name: 'Փոթորիկ', desc: 'Մեկ մարտում կատարիր 6 սպանություն', test: (s, m) => m && m.kills >= 6 },
  { id: 'eagle', name: 'Արծվի աչք', desc: 'Սպանիր թշնամուն 150մ-ից ավելի հեռվից', test: (s) => s.longestKill >= 150 },
  { id: 'untouched', name: 'Անխոցելի', desc: 'Հաղթիր՝ ունենալով 80+ առողջություն', test: (s, m) => m && m.win && m.hpLeft >= 80 },
  { id: 'champion', name: 'Չեմպիոն', desc: 'Հաղթիր 10 մարտ', test: (s) => s.wins >= 10 },
];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export class Progression {
  constructor(save) {
    this.save = save;
    this.refreshDaily();
  }
  get d() { return this.save.data; }

  refreshDaily() {
    const daily = this.d.daily;
    if (daily.date === today() && daily.missions.length) return;
    const pool = MISSION_POOL.slice();
    const pick = [];
    while (pick.length < 3) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    daily.date = today();
    daily.missions = pick.map((m) => ({ id: m.id, progress: 0, done: false }));
    this.save.save();
  }

  missionDefs() {
    return this.d.daily.missions.map((m) => ({ ...MISSION_POOL.find((p) => p.id === m.id), ...m }));
  }

  levelProgress() {
    const need = xpForLevel(this.d.level);
    return { level: this.d.level, xp: this.d.xp, need, frac: this.d.xp / need };
  }

  // Apply match results; returns a breakdown for the results screen.
  applyMatch(r) {
    const d = this.d;
    this.refreshDaily();
    const st = d.stats;
    st.matches++;
    st.kills += r.kills;
    st.headshots += r.headshots;
    st.damage += Math.round(r.damage);
    st.shotsFired += r.shots;
    st.shotsHit += r.hits;
    st.playTime += Math.round(r.time);
    if (r.win) st.wins++; else st.deaths++;
    st.bestPlace = Math.min(st.bestPlace, r.place);
    st.longestKill = Math.max(st.longestKill || 0, Math.round(r.longestKill || 0));

    const lines = [];
    lines.push({ label: 'Մասնակցություն', xp: 80 });
    if (r.kills) lines.push({ label: `Սպանություններ ×${r.kills}`, xp: r.kills * 60 });
    if (r.headshots) lines.push({ label: `Գլխին հարվածներ ×${r.headshots}`, xp: r.headshots * 25 });
    if (r.damage > 0) lines.push({ label: `Վնաս ${Math.round(r.damage)}`, xp: Math.round(r.damage / 8) });
    lines.push({ label: `Տեղ #${r.place}`, xp: Math.max(0, (17 - r.place) * 14) });
    if (r.win) lines.push({ label: 'ՀԱՂԹԱՆԱԿ', xp: 400 });
    lines.push({ label: `Գոյատևում ${Math.floor(r.time / 60)}ր ${Math.floor(r.time % 60)}վ`, xp: Math.round(r.time * 0.4) });

    // missions
    const missionDone = [];
    const inc = { kills: r.kills, wins: r.win ? 1 : 0, matches: 1, headshots: r.headshots, damage: Math.round(r.damage), loot: r.loot, top5: r.place <= 5 ? 1 : 0, nadeKills: r.nadeKills };
    for (const m of d.daily.missions) {
      if (m.done) continue;
      const def = MISSION_POOL.find((p) => p.id === m.id);
      m.progress = Math.min(def.goal, m.progress + (inc[def.key] || 0));
      if (m.progress >= def.goal) { m.done = true; missionDone.push(def); lines.push({ label: `Առաջադրանք՝ ${def.text}`, xp: def.xp, mission: true }); }
    }
    const total = lines.reduce((a, l) => a + l.xp, 0);
    const before = { level: d.level, xp: d.xp };
    d.xp += total;
    const levelUps = [];
    while (d.xp >= xpForLevel(d.level)) {
      d.xp -= xpForLevel(d.level);
      d.level++;
      levelUps.push(d.level);
    }
    // unlocks
    const unlocks = [];
    for (const lv of levelUps) {
      for (const s of SKINS) if (s.unlock === lv) { unlocks.push(`Արտաքին՝ «${s.name}»`); if (!d.unlockedSkins.includes(s.id)) d.unlockedSkins.push(s.id); }
      for (const c of CHARACTERS) if (c.unlock === lv) unlocks.push(`Հերոս՝ ${c.name}`);
    }
    // achievements
    const newAch = [];
    const m = { kills: r.kills, win: r.win, hpLeft: r.hpLeft };
    for (const a of ACHIEVEMENTS) {
      if (d.achievements[a.id]) continue;
      if (a.test(st, m)) { d.achievements[a.id] = Date.now(); newAch.push(a); }
    }
    this.save.save();
    return { lines, total, before, after: { level: d.level, xp: d.xp }, levelUps, unlocks, newAch, missionDone };
  }
}
