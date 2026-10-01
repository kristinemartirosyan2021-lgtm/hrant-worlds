// DOM-based game UI: menus, HUD, feedback, results. All player-facing text is Armenian.
import * as THREE from 'three';
import { WEAPONS, AMMO } from '../combat/WeaponDefs.js';
import { RARITY } from '../config.js';
import { weaponIcon } from '../entities/WeaponModels.js';
import { CHARACTERS, SKINS } from '../entities/HumanModel.js';
import { ACHIEVEMENTS, xpForLevel } from '../gameplay/Progression.js';
import { magSize } from '../gameplay/InventorySystem.js';
import { Minimap } from './Minimap.js';
import { fmtTime, clamp } from '../core/util.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();

const TIPS = [
  'Գոտին փոքրանում է․ մի՛ մնա դրսում՝ այն վնասում է ամեն վայրկյան։',
  'Լեգենդար զենքերը ոսկեգույն լույս ունեն։ Փնտրիր դրանք Հին Բերդում։',
  'Պահիր G-ն՝ նռնակի հետագիծը տեսնելու համար, բաց թող՝ նետելու։',
  'Կքանստած (C) կրակելիս զենքը ավելի ճշգրիտ է։',
  'Թշնամիները լսում են կրակոցները։ Երբեմն լռությունը լավագույն զենքն է։',
  'SPACE-ով կարող ես ցատկել ցածր պատնեշների վրայով։',
  'Դեղարկղը (H) վերականգնում է 75 առողջություն։',
  'Զրահն ու սաղավարտը կլանում են վնասի մի մասը։',
  'Տանիքները լավ դիրք են, բայց քեզ էլ են տեսնում։',
];

export class UIManager {
  constructor(game) {
    this.game = game;
    this.minimap = new Minimap(game);
    this.bigMapOpen = false;
    this.progress = null;
    this.hpLag = 100;
    this.lastHp = 100;
    this.hurt = 0;
    this.lastAlive = 16;
    this.lastKills = 0;
    this.slotCache = '';
    this.feedItems = [];
    this.bindMenu();
    this.bindPause();
    this.bindResults();
    this.uiSounds();
  }

  show(id, on = true) { $(id).classList.toggle('show', on); }

  uiSounds() {
    document.addEventListener('mouseover', (e) => {
      const b = e.target.closest && e.target.closest('button');
      if (b && b !== this._lastHover) { this._lastHover = b; this.game.audio.uiHover(); }
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('button')) this.game.audio.uiClick();
    });
  }

  // ---------------------------------------------------------------- boot
  bootProgress(p, label) {
    $('bootFill').style.width = `${Math.round(p * 100)}%`;
    const map = { terrain: 'ՌԵԼԻԵՖ', sky: 'ԵՐԿԻՆՔ', map: 'ՔԱՂԱՔ ԵՎ ԳՈՐԾԱՐԱՆ', vegetation: 'ԱՆՏԱՌ', batch: 'ԿԱՌՈՒՑՎԱԾՔՆԵՐ', nav: 'ՃԱՆԱՊԱՐՀՆԵՐ', done: 'ՊԱՏՐԱՍՏ Է' };
    $('bootLabel').textContent = `ԲԵՌՆՎՈՒՄ Է · ${map[label] || ''}`;
  }

  // ---------------------------------------------------------------- menu
  bindMenu() {
    $('tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.openTab(b.dataset.tab);
    });
    $('playBtn').addEventListener('click', () => this.game.startMatch());
  }

  openTab(tab) {
    for (const b of $('tabs').querySelectorAll('button')) b.classList.toggle('active', b.dataset.tab === tab);
    for (const p of document.querySelectorAll('.panel')) p.classList.toggle('show', p.dataset.panel === tab);
    this.refreshMenu();
  }

  refreshMenu() {
    const g = this.game, d = g.save.data;
    const ch = CHARACTERS.find((c) => c.id === d.character) || CHARACTERS[0];
    $('mLevel').textContent = d.level;
    $('mName').textContent = ch.name;
    const need = xpForLevel(d.level);
    $('mXpFill').style.width = `${(d.xp / need) * 100}%`;
    $('mXpText').textContent = `${d.xp} / ${need} ՓՈՐՁ`;
    $('hcRole').textContent = ch.role;
    $('hcName').textContent = ch.name;
    $('hcBio').textContent = ch.bio;
    // daily (mini)
    const ms = g.progression.missionDefs();
    const mHtml = ms.map((m) => `<div class="mi ${m.done ? 'done' : ''}"><span class="mt">${m.text}</span><span class="mx">+${m.xp} ՓՈՐՁ</span><div class="mp"><i style="width:${(m.progress / m.goal) * 100}%"></i></div></div>`).join('');
    $('dailyMini').innerHTML = `<h3 style="font-weight:900;font-size:12px;letter-spacing:4px;color:var(--amber);margin-bottom:8px">ՕՐՎԱ ԱՌԱՋԱԴՐԱՆՔՆԵՐ</h3>${mHtml}`;
    $('missionList').innerHTML = ms.map((m) => `<div class="mi ${m.done ? 'done' : ''}"><span class="mt">${m.text}</span><span class="mx">${m.progress}/${m.goal} · +${m.xp}</span><div class="mp"><i style="width:${(m.progress / m.goal) * 100}%"></i></div></div>`).join('');
    // heroes
    $('heroGrid').innerHTML = CHARACTERS.map((c) => {
      const locked = d.level < c.unlock;
      return `<button class="hero ${c.id === d.character ? 'sel' : ''} ${locked ? 'locked' : ''}" data-id="${c.id}" data-lock="ՄԱԿԱՐԴԱԿ ${c.unlock}">
        <div class="sw" style="background:linear-gradient(90deg, ${c.look.jacket}, ${c.look.accent})"></div><b>${c.name}</b><small>${c.role}</small></button>`;
    }).join('');
    for (const b of $('heroGrid').querySelectorAll('.hero')) {
      b.onclick = () => {
        const c = CHARACTERS.find((q) => q.id === b.dataset.id);
        if (d.level < c.unlock) { this.toastMenu(`Կբացվի ${c.unlock}-րդ մակարդակում`); return; }
        d.character = c.id; g.save.save();
        g.director.buildShowcase();
        this.refreshMenu();
      };
    }
    const curSkin = d.skins[ch.id] || 'default';
    $('skinGrid').innerHTML = SKINS.map((s) => {
      const locked = !d.unlockedSkins.includes(s.id) && d.level < s.unlock;
      const col = s.colors ? s.colors.jacket : ch.look.jacket;
      const acc = s.colors ? s.colors.accent : ch.look.accent;
      return `<button class="skin ${s.id === curSkin ? 'sel' : ''} ${locked ? 'locked' : ''}" data-id="${s.id}"><i style="background:linear-gradient(135deg, ${col} 60%, ${acc} 60%)"></i><span>${s.name}<small>${locked ? `ՄԱԿԱՐԴԱԿ ${s.unlock}` : 'Բաց է'}</small></span></button>`;
    }).join('');
    for (const b of $('skinGrid').querySelectorAll('.skin')) {
      b.onclick = () => {
        const s = SKINS.find((q) => q.id === b.dataset.id);
        if (!d.unlockedSkins.includes(s.id) && d.level < s.unlock) { this.toastMenu(`Կբացվի ${s.unlock}-րդ մակարդակում`); return; }
        d.skins[ch.id] = s.id; g.save.save();
        g.director.buildShowcase();
        this.refreshMenu();
      };
    }
    // achievements
    $('achList').innerHTML = ACHIEVEMENTS.map((a) => `<div class="ach ${d.achievements[a.id] ? 'on' : ''}"><b>${a.name}</b><small>${a.desc}</small></div>`).join('');
    // stats
    const st = d.stats;
    const acc = st.shotsFired ? Math.round((st.shotsHit / st.shotsFired) * 100) : 0;
    const items = [
      ['ՄԱՐՏԵՐ', st.matches], ['ՀԱՂԹԱՆԱԿՆԵՐ', st.wins], ['ՍՊԱՆՈՒԹՅՈՒՆՆԵՐ', st.kills], ['ԳԼԽԻՆ ՀԱՐՎԱԾՆԵՐ', st.headshots],
      ['ՀԱՍՑՎԱԾ ՎՆԱՍ', st.damage], ['ԿՐԱԿԻ ՃՇԳՐՏՈՒԹՅՈՒՆ', acc + '%'], ['ԼԱՎԱԳՈՒՅՆ ՏԵՂ', st.bestPlace < 99 ? '#' + st.bestPlace : '—'],
      ['Ս/Մ ՀԱՐԱԲԵՐԱԿՑՈՒԹՅՈՒՆ', st.matches ? (st.kills / Math.max(1, st.deaths)).toFixed(2) : '0'],
      ['ԱՄԵՆԱՀԵՌՈՒ ՍՊԱՆՈՒԹՅՈՒՆ', (st.longestKill || 0) + 'մ'], ['ԽԱՂԱՅԻՆ ԺԱՄԱՆԱԿ', Math.round(st.playTime / 60) + ' ր'],
    ];
    $('statGrid').innerHTML = items.map(([k, v]) => `<div class="stat"><b>${v}</b><small>${k}</small></div>`).join('');
    this.buildSettings($('settingsBox'));
  }

  toastMenu(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.cssText = 'position:absolute;left:36px;bottom:60px;z-index:30';
    t.textContent = text;
    $('menu').appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  buildSettings(box) {
    const g = this.game, s = g.save.data.settings;
    const range = (key, label, min, max, step, fmt) => `<div class="row"><span>${label}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"><output>${fmt(s[key])}</output></div>`;
    const pct = (v) => Math.round(v * 100) + '%';
    box.innerHTML =
      range('sensitivity', 'ՄԿՆԻԿԻ ԶԳԱՅՈՒՆՈՒԹՅՈՒՆ', 0.2, 3, 0.05, (v) => Number(v).toFixed(2)) +
      range('volume', 'ՁԱՅՆԻ ԲԱՐՁՐՈՒԹՅՈՒՆ', 0, 1, 0.05, pct) +
      range('music', 'ԵՐԱԺՇՏՈՒԹՅՈՒՆ', 0, 1, 0.05, pct) +
      `<div class="row"><span>ԳՐԱՖԻԿԱՅԻ ՈՐԱԿ</span><div class="seg">${['low', 'medium', 'high'].map((q, i) => `<button data-q="${q}" class="${s.quality === q ? 'on' : ''}">${['ՑԱԾՐ', 'ՄԻՋԻՆ', 'ԲԱՐՁՐ'][i]}</button>`).join('')}</div><output></output></div>` +
      `<div class="row"><span>ՇՐՋԵԼ Y ԱՌԱՆՑՔԸ</span><div class="seg"><button data-inv="0" class="${!s.invertY ? 'on' : ''}">ՈՉ</button><button data-inv="1" class="${s.invertY ? 'on' : ''}">ԱՅՈ</button></div><output></output></div>`;
    for (const inp of box.querySelectorAll('input[type=range]')) {
      inp.oninput = () => {
        s[inp.dataset.k] = parseFloat(inp.value);
        const out = inp.parentElement.querySelector('output');
        out.textContent = inp.dataset.k === 'sensitivity' ? Number(inp.value).toFixed(2) : pct(inp.value);
        g.audio.applySettings();
        g.save.save();
      };
    }
    for (const b of box.querySelectorAll('[data-q]')) b.onclick = () => { s.quality = b.dataset.q; g.save.save(); g.applyQuality(); this.buildSettings(box); };
    for (const b of box.querySelectorAll('[data-inv]')) b.onclick = () => { s.invertY = b.dataset.inv === '1'; g.save.save(); this.buildSettings(box); };
  }

  // ---------------------------------------------------------------- loading
  async matchLoading() {
    this.show('loading');
    const dots = $('ldDots');
    dots.innerHTML = Array.from({ length: 16 }, () => '<i></i>').join('');
    $('ldTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    const list = dots.querySelectorAll('i');
    for (let i = 1; i <= 16; i++) {
      $('ldCount').textContent = i;
      list[i - 1].classList.add('on');
      this.game.audio.xpTick();
      await new Promise((r) => setTimeout(r, 70 + Math.random() * 120));
    }
    await new Promise((r) => setTimeout(r, 350));
  }

  // ---------------------------------------------------------------- HUD
  showHUD(on) { this.show('hud', on); }

  resetHUD() {
    this.hpLag = 100; this.hurt = 0; this.lastAlive = 16; this.lastKills = 0; this.slotCache = '';
    $('killfeed').innerHTML = '';
    $('dmgNums').innerHTML = '';
    $('dmgDirs').innerHTML = '';
    $('toasts').innerHTML = '';
    this.setAlive(16);
    $('hKills').textContent = 'ՍՊԱՆՈՒԹՅՈՒՆ՝ 0';
    this.show('endTitle', false);
    this.show('results', false);
    this.toggleBigMap(false);
    $('progressRing').classList.remove('show');
    $('hNadeIc').src = weaponIcon('grenade', '#c8b070');
  }

  setAlive(n) {
    $('hAlive').textContent = `ՄՆԱՑ՝ ${n}`;
    if (n !== this.lastAlive) { this.bump($('hAlive').parentElement); this.lastAlive = n; }
  }

  bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  reloadStarted(dur) { this.ring('ՎԵՐԱԼԻՑՔԱՎՈՐՈՒՄ', dur, () => this.game.player && this.game.player.weapons.reloading); }
  healStarted(dur) { this.ring('ԲՈՒԺՎՈՒՄ', dur, () => this.game.player && this.game.player.healing); $('hHpFill').parentElement.classList.add('heal'); }
  healCancelled() { $('progressRing').classList.remove('show'); $('hHpFill').parentElement.classList.remove('heal'); }
  healDone() { this.healCancelled(); this.toast('+75 Առողջություն', '#2fbf6a'); }

  ring(label, dur, alive) {
    this.progress = { label, dur, t: 0, alive };
    $('prText').textContent = label;
    $('progressRing').classList.add('show');
  }

  flashNoAmmo() { const e = $('noAmmo'); e.classList.remove('show'); void e.offsetWidth; e.classList.add('show'); }

  toast(text, color = '#fff') {
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderLeftColor = color;
    t.textContent = text;
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 2700);
    while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
  }

  hitmarker(head, kill) {
    const h = $('hitmarker');
    h.className = '';
    void h.offsetWidth;
    h.className = `show ${head ? 'head' : ''} ${kill ? 'kill' : ''}`;
  }

  damageNumber(pos, amount, head, armor) {
    const cam = this.game.camera;
    _v.copy(pos).project(cam);
    if (_v.z > 1) return;
    const x = (_v.x * 0.5 + 0.5) * innerWidth, y = (-_v.y * 0.5 + 0.5) * innerHeight;
    const e = document.createElement('div');
    e.className = `dn ${head ? 'head' : ''} ${armor && !head ? 'armor' : ''}`;
    e.textContent = Math.max(1, Math.round(amount));
    e.style.left = `${x + (Math.random() - 0.5) * 30}px`;
    e.style.top = `${y - 20}px`;
    $('dmgNums').appendChild(e);
    setTimeout(() => e.remove(), 950);
  }

  damageDirection(angle) {
    const e = document.createElement('div');
    e.className = 'dd';
    // angle is relative to view yaw: 0 = in front. Screen: positive yaw is to the left.
    e.style.transform = `rotate(${-angle}rad)`;
    $('dmgDirs').appendChild(e);
    setTimeout(() => e.remove(), 1400);
  }

  damageFlash(k) { this.hurt = Math.min(1, this.hurt + k * 0.8); }

  banner(text, cls = 'start', dur = 3) {
    const b = $('banner');
    b.className = '';
    void b.offsetWidth;
    b.textContent = text;
    b.style.animationDuration = `${dur}s`;
    b.className = `show ${cls}`;
  }

  areaTitle(name) {
    const a = $('areaTitle');
    a.className = '';
    void a.offsetWidth;
    a.textContent = name;
    a.className = 'show';
  }

  eliminated(name, head, kills) {
    const e = $('elim');
    e.className = '';
    void e.offsetWidth;
    e.innerHTML = `<div class="e1">ԴՈՒ ՈՉՆՉԱՑՐԻՐ</div><div class="e2">${name}</div>${head ? '<div class="e3">ԳԼԽԻՆ ՀԱՐՎԱԾ</div>' : ''}<div class="e4">ՍՊԱՆՈՒԹՅՈՒՆ՝ ${kills}</div>`;
    e.className = 'show';
    $('hKills').textContent = `ՍՊԱՆՈՒԹՅՈՒՆ՝ ${kills}`;
    this.bump($('hKills').parentElement);
  }

  killFeed(killer, victim, weapon, head, byMe, meDied) {
    const k = document.createElement('div');
    k.className = `kf ${byMe ? 'me' : ''} ${meDied ? 'died' : ''}`;
    k.innerHTML = killer
      ? `<span>${killer}</span><span class="w">${weapon}${head ? ' · <span class="hs">ԳԼԽԻՆ</span>' : ''}</span><span>${victim}</span>`
      : `<span>${victim}</span><span class="w">${weapon || 'ՈՉՆՉԱՑՎԱԾ'}</span>`;
    $('killfeed').prepend(k);
    while ($('killfeed').children.length > 5) $('killfeed').lastChild.remove();
    setTimeout(() => { k.style.transition = 'opacity .6s'; k.style.opacity = '0'; setTimeout(() => k.remove(), 600); }, 6000);
  }

  toggleBigMap(open) { this.bigMapOpen = open; this.show('bigmap', open); }

  countdown(n) {
    const c = $('countdown');
    c.className = '';
    void c.offsetWidth;
    c.textContent = n;
    c.className = 'tick';
  }

  victoryTitle() {
    const e = $('endTitle');
    e.classList.remove('lose');
    $('etMain').textContent = 'ՀԱՂԹԱՆԱԿ';
    $('etSub').textContent = 'ԴՈՒ ՄՆԱՑԻՐ ՎԵՐՋԻՆԸ';
    this.show('endTitle');
    $('crosshair').classList.add('hide');
  }

  defeatTitle(killer, place) {
    const e = $('endTitle');
    e.classList.add('lose');
    $('etMain').textContent = 'ՊԱՐՏՈՒԹՅՈՒՆ';
    $('etSub').textContent = killer ? `ՔԵԶ ՈՉՆՉԱՑՐԵՑ՝ ${killer} · #${place}` : `ԴՈՒ ՈՉՆՉԱՑՎԵՑԻՐ · #${place}`;
    this.show('endTitle');
    $('crosshair').classList.add('hide');
  }

  // ---------------------------------------------------------------- results
  bindResults() {
    $('againBtn').addEventListener('click', () => this.game.startMatch());
    $('lobbyBtn').addEventListener('click', () => this.game.toLobby());
  }

  showResults(r, rw) {
    this.show('endTitle', false);
    this.show('hud', false);
    this.show('results');
    const t = $('rsTitle');
    t.textContent = r.win ? 'ՀԱՂԹԱՆԱԿ' : 'ՄԱՐՏՆ ԱՎԱՐՏՎԵՑ';
    t.className = `rs-title ${r.win ? 'win' : 'lose'}`;
    $('rsPlace').textContent = `#${r.place} ՏԵՂ 16-ԻՑ`;
    const acc = r.shots ? Math.round((r.hits / r.shots) * 100) : 0;
    $('rsStats').innerHTML = [
      ['ՍՊԱՆՈՒԹՅՈՒՆՆԵՐ', r.kills], ['ԳԼԽԻՆ ՀԱՐՎԱԾՆԵՐ', r.headshots], ['ՀԱՍՑՎԱԾ ՎՆԱՍ', Math.round(r.damage)],
      ['ՃՇԳՐՏՈՒԹՅՈՒՆ', acc + '%'], ['ԳՈՅԱՏԵՎՈՒՄ', fmtTime(r.time)], ['ՎԵՐՑՐԱԾ ԻՐԵՐ', r.loot],
    ].map(([k, v]) => `<div class="stat"><b>${v}</b><small>${k}</small></div>`).join('');
    const lines = $('rsLines');
    lines.innerHTML = '';
    const unl = $('rsUnlocks');
    unl.innerHTML = '';
    const g = this.game;
    // animate XP lines and the bar
    let level = rw.before.level, xp = rw.before.xp;
    $('rsLevel').textContent = level;
    $('rsXpFill').style.transition = 'none';
    $('rsXpFill').style.width = `${(xp / xpForLevel(level)) * 100}%`;
    $('rsXpTotal').textContent = '+0 ՓՈՐՁ';
    let shown = 0;
    rw.lines.forEach((l, i) => {
      setTimeout(() => {
        const d = document.createElement('div');
        d.className = `ln ${l.mission ? 'mission' : ''}`;
        d.innerHTML = `<span>${l.label}</span><b>+${l.xp}</b>`;
        lines.appendChild(d);
        g.audio.xpTick();
      }, 250 + i * 180);
    });
    const start = 250 + rw.lines.length * 180;
    const total = rw.total;
    const steps = 40;
    for (let s = 1; s <= steps; s++) {
      setTimeout(() => {
        const add = Math.round((total * s) / steps) - shown;
        shown += add;
        xp += add;
        while (xp >= xpForLevel(level)) {
          xp -= xpForLevel(level);
          level++;
          $('rsLevel').textContent = level;
          $('luNum').textContent = level;
          const lu = $('levelUp');
          lu.className = '';
          void lu.offsetWidth;
          lu.className = 'show';
          g.audio.levelUp();
          g.fx.confetti(g.camera.position.clone().add(new THREE.Vector3(0, -3, 0)), 30);
        }
        $('rsXpFill').style.transition = 'width .05s linear';
        $('rsXpFill').style.width = `${(xp / xpForLevel(level)) * 100}%`;
        $('rsXpTotal').textContent = `+${shown} ՓՈՐՁ`;
        if (s % 3 === 0) g.audio.xpTick();
        if (s === steps) {
          const extra = [...rw.unlocks.map((u) => `🔓 ${u}`), ...rw.newAch.map((a) => `★ Նվաճում՝ ${a.name}`)];
          extra.forEach((u, i) => setTimeout(() => { const d = document.createElement('div'); d.textContent = u; unl.appendChild(d); }, i * 250));
        }
      }, start + s * 35);
    }
  }

  // ---------------------------------------------------------------- pause
  bindPause() {
    $('resumeBtn').addEventListener('click', () => this.game.resume());
    $('quitBtn').addEventListener('click', () => this.game.quitMatch());
    $('pauseSettingsBtn').addEventListener('click', () => {
      const box = $('pauseSettings');
      box.classList.toggle('show');
      if (box.classList.contains('show')) this.buildSettings(box);
    });
  }

  // ---------------------------------------------------------------- per-frame HUD
  update(dt) {
    const g = this.game;
    const p = g.player;
    if (!p || !$('hud').classList.contains('show')) return;
    // health
    const hp = p.health.hp;
    if (hp < this.lastHp) this.hpLag = Math.max(this.hpLag, this.lastHp);
    this.lastHp = hp;
    this.hpLag += (hp - this.hpLag) * Math.min(1, dt * 2.5);
    $('hHpFill').style.width = `${hp}%`;
    $('hHpLag').style.width = `${Math.max(hp, this.hpLag)}%`;
    $('hHpText').textContent = Math.ceil(hp);
    $('hHpFill').parentElement.classList.toggle('low', hp < 30);
    const ar = p.health.armor, he = p.health.helmet;
    $('hArmorFill').style.width = ar.level ? `${(ar.dur / ar.max) * 100}%` : '0%';
    $('hVest').className = `gear-ic l${ar.level}`;
    $('hVest').querySelector('b').textContent = ar.level || '—';
    $('hHelmet').className = `gear-ic l${he.level}`;
    $('hHelmet').querySelector('b').textContent = he.level || '—';
    $('hName').textContent = p.name;
    // weapon
    const inv = p.inv, w = inv.weapon;
    if (w) {
      const def = WEAPONS[w.id];
      $('hWName').textContent = def.name;
      $('hWName').style.color = RARITY[w.rarity].css;
      $('hWType').textContent = `${def.type} · ${RARITY[w.rarity].name}`;
      $('hMag').textContent = w.mag;
      $('hMag').classList.toggle('low', w.mag <= Math.ceil(magSize(w) * 0.25));
      $('hRes').textContent = inv.ammo[def.ammo];
    }
    $('hNades').textContent = inv.grenades;
    $('hMed').textContent = inv.medkits;
    const key = inv.slots.map((s) => (s ? `${s.id}${s.rarity}${s.mag}` : '-')).join('|') + inv.current + JSON.stringify(inv.ammo);
    if (key !== this.slotCache) {
      this.slotCache = key;
      for (const el of $('invSlots').querySelectorAll('.slot[data-slot]')) {
        const i = +el.dataset.slot;
        const s = inv.slots[i];
        el.classList.toggle('empty', !s);
        el.classList.toggle('cur', i === inv.current);
        if (s) {
          const def = WEAPONS[s.id];
          el.querySelector('img').src = weaponIcon(s.id, RARITY[s.rarity].css);
          el.querySelector('.nm').textContent = def.name;
          el.querySelector('.am').textContent = `${s.mag}/${inv.ammo[def.ammo]}`;
          el.style.borderBottomColor = RARITY[s.rarity].css;
        } else el.style.borderBottomColor = '';
      }
    }
    // timer & zone
    $('hTime').textContent = fmtTime(g.match.time);
    const z = g.zone;
    const zi = $('zoneInfo');
    if (z.done) { $('zoneText').textContent = 'ՎԵՐՋՆԱԿԱՆ ԳՈՏԻ'; zi.classList.add('shrink'); }
    else if (z.shrinking) { $('zoneText').textContent = `ԳՈՏԻՆ ՓՈՔՐԱՆՈՒՄ Է՝ ${fmtTime(z.timeLeft)}`; zi.classList.add('shrink'); }
    else { $('zoneText').textContent = `ԳՈՏԻՆ ԿՓՈՔՐԱՆԱ՝ ${fmtTime(z.timeLeft)}`; zi.classList.remove('shrink'); }
    // crosshair
    const ch = $('crosshair');
    const spread = clamp(p.spreadPx(g.camera, innerHeight), 3, 120);
    const gap = 3 + spread;
    ch.querySelector('.t').style.top = `${-gap - 9}px`;
    ch.querySelector('.b').style.top = `${gap}px`;
    ch.querySelector('.l').style.left = `${-gap - 9}px`;
    ch.querySelector('.r').style.left = `${gap}px`;
    ch.classList.toggle('enemy', !!p.aimEnemy);
    ch.classList.toggle('hide', p.scoped || !p.alive || g.match.state !== 'playing');
    this.show('scope', p.scoped);
    // progress ring
    if (this.progress) {
      const pr = this.progress;
      pr.t += dt;
      const k = clamp(pr.t / pr.dur, 0, 1);
      $('prFill').style.strokeDashoffset = `${163.4 * (1 - k)}`;
      if (k >= 1 || !pr.alive()) { this.progress = null; $('progressRing').classList.remove('show'); $('hHpFill').parentElement.classList.remove('heal'); }
    }
    // interaction prompt
    const near = p.alive ? g.loot.nearest(p) : null;
    const pr = $('prompt');
    if (near && (near.kind === 'weapon' || near.kind === 'armor' || near.kind === 'helmet' || near.kind === 'ammo')) {
      $('promptText').innerHTML = `ՎԵՐՑՆԵԼ՝ <b style="color:${RARITY[near.rarity].css}">${g.loot.label(near)}</b> <small style="color:${RARITY[near.rarity].css};opacity:.8">${near.kind === 'ammo' ? '' : RARITY[near.rarity].name}</small>`;
      pr.classList.add('show');
    } else pr.classList.remove('show');
    // vignettes
    this.hurt = Math.max(0, this.hurt - dt * 1.8);
    $('vigHurt').style.opacity = this.hurt;
    const low = hp < 30 && p.alive ? (0.45 + Math.sin(g.time * 6) * 0.2) * (1 - hp / 30 + 0.3) : 0;
    $('vigLow').style.opacity = low;
    g.audio.heartbeat(dt, hp < 30 && p.alive && g.match.state === 'playing');
    const outside = p.alive && g.zone.outside(p.ctrl.pos) && g.match.state === 'playing';
    $('vigZone').style.opacity = outside ? 1 : 0;
    $('zoneWarn').classList.toggle('show', outside);
    $('clickToLock').classList.toggle('show', g.match.state === 'playing' && !g.input.locked && !g.paused);
    this.minimap.draw(dt);
  }
}
