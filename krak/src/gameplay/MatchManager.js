// Match flow: deploy → battle → zone → final fight → victory/defeat → rewards.
import * as THREE from 'three';
import { Player } from '../entities/PlayerController.js';
import { Bot } from '../entities/EnemyAI.js';
import { CHARACTERS, randomLook, applySkin } from '../entities/HumanModel.js';
import { BOT_NAMES, PLAYER_COUNT, AREAS } from '../config.js';
import { rand } from '../core/util.js';

export class MatchManager {
  constructor(game) {
    this.game = game;
    this.state = 'idle';
    this.time = 0;
    this.player = null;
    this.bots = [];
    this.feed = [];
    this.areaName = '';
    this.areaT = 0;
    game.events.on('zone_shrink', () => {
      if (this.state !== 'playing') return;
      game.ui.banner('ԱՆՎՏԱՆԳ ԳՈՏԻՆ ՓՈՔՐԱՆՈՒՄ Է', 'zone');
      game.audio.zoneAlarm();
    });
    game.events.on('zone_warning', () => {
      if (this.state !== 'playing') return;
      game.ui.banner('ԳՈՏԻՆ ԿՓՈՔՐԱՆԱ 10 ՎԱՅՐԿՅԱՆԻՑ', 'warn', 2.2);
      game.audio.zoneTick();
    });
  }

  get alive() { return this.game.actors.filter((a) => a.alive).length; }

  ensureActors() {
    const g = this.game;
    const charId = g.save.data.character;
    const ch = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
    const look = applySkin(ch.look, g.save.data.skins[ch.id] || 'default');
    if (this.player) { this.player.dispose(); }
    this.player = new Player(g, { name: ch.name, look });
    if (!this.bots.length) {
      const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
      for (let i = 0; i < PLAYER_COUNT - 1; i++) {
        const skill = i < 4 ? rand(0.2, 0.42) : i < 11 ? rand(0.42, 0.68) : rand(0.68, 0.9);
        this.bots.push(new Bot(g, { name: names[i], look: randomLook(), skill }));
      }
    } else {
      // reshuffle skills a bit every match
      for (const b of this.bots) b.ai.setSkill(Math.min(0.92, Math.max(0.15, b.ai.skill + rand(-0.1, 0.1))));
    }
    g.player = this.player;
    g.actors = [this.player, ...this.bots];
  }

  start() {
    const g = this.game;
    this.ensureActors();
    g.fx.clear();
    g.projectiles.clear();
    g.loot.spawnAll();
    g.zone.reset();
    // Everyone boards the transport plane.
    g.drop.setup();
    const p0 = g.drop.pos;
    for (const a of g.actors) {
      a.spawn(p0.x, p0.z, Math.atan2(g.drop.dir.x, g.drop.dir.z));
      g.drop.board(a);
      if (!a.isPlayer) g.drop.planBot(a);
    }
    this.time = 0;
    this.kills = 0;
    this.feed = [];
    this.placement = 0;
    this.result = null;
    this.longestKill = 0;
    this.nadeKills = 0;
    this.slowmo = 0;
    g.loot.picked = 0;
    this.state = 'deploy';
    this.deployT = 0;
    this.areaName = '';
    g.ui.showHUD(true);
    g.ui.resetHUD();
  }

  update(dt) {
    const g = this.game;
    if (this.state === 'deploy') {
      this.deployT += dt;
      if (this.deployT > 3.6) {
        this.state = 'playing';
        g.drop.start();
        g.ui.banner('ՄԱՐՏԸ ՍԿՍՎԵՑ', 'start', 2.5);
        g.audio.uiBig();
        g.input.requestLock();
      }
      return;
    }
    if (this.state === 'playing') {
      this.time += dt;
      g.drop.update(dt);
      // The storm only starts once everyone has landed.
      if (!g.drop.active || g.drop.landedAll) g.zone.update(dt);
      // Area name when entering a new section.
      const p = this.player.ctrl.pos;
      let area = '';
      for (const a of AREAS) if (Math.hypot(p.x - a.x, p.z - a.z) < a.r * 0.75) area = a.name;
      if (area && area !== this.areaName && !this.player.air) { this.areaName = area; g.ui.areaTitle(area); }
      if (!area && this.areaName && Math.random() < 0.01) this.areaName = '';
      // Occasional distant rumble to make the battlefield feel alive.
      if (Math.random() < dt * 0.04) g.audio.distantRumble();
    }
    if (this.state === 'ended') {
      this.endT += dt;
    }
  }

  onKill(victim, killer, info) {
    const g = this.game;
    if (this.state !== 'playing') return;
    const aliveNow = this.alive;
    victim.placement = aliveNow + 1;
    g.loot.dropAll(victim);
    const head = !!info.headshot;
    const weapon = info.zone ? 'ԳՈՏԻ' : info.fall ? 'ԱՆԿՈՒՄ' : info.weapon ? info.weapon.name : '';
    if (killer && killer !== victim) {
      killer.kills++;
      if (head) killer.headshots++;
    }
    g.ui.killFeed(killer && killer !== victim ? killer.name : null, victim.name, weapon, head, killer === this.player, victim === this.player);
    g.ui.setAlive(aliveNow);
    if (killer === this.player && victim !== this.player) {
      this.kills++;
      if (info.dist) this.longestKill = Math.max(this.longestKill, info.dist);
      if (info.explosive) this.nadeKills++;
      g.ui.eliminated(victim.name, head, this.kills);
      g.player.addShake(0.25);
      if (aliveNow === 1) this.victory();
    }
    if (victim === this.player) {
      this.defeat(killer);
      return;
    }
    if (this.player.alive && aliveNow === 1) this.victory();
  }

  onPlayerHit(dmg) {
    void dmg;
  }

  victory() {
    if (this.state !== 'playing') return;
    const g = this.game;
    this.state = 'ended';
    this.endT = 0;
    this.player.placement = 1;
    this.slowmo = 1.6;
    g.director.victory(this.player);
    g.audio.stinger(true);
    g.ui.victoryTitle();
    g.input.exitLock();
    this.finish(true);
  }

  defeat(killer) {
    const g = this.game;
    this.state = 'ended';
    this.endT = 0;
    this.slowmo = 1.0;
    g.director.defeat(this.player, killer);
    g.audio.stinger(false);
    g.ui.defeatTitle(killer ? killer.name : null, this.player.placement);
    g.input.exitLock();
    this.finish(false);
  }

  finish(win) {
    const g = this.game;
    const p = this.player;
    this.result = {
      win, place: win ? 1 : p.placement, kills: this.kills, headshots: p.headshots, damage: p.damageDealt,
      time: this.time, shots: p.stats.shots, hits: p.stats.hits, loot: g.loot.picked, hpLeft: p.health.hp,
      longestKill: this.longestKill, nadeKills: this.nadeKills,
    };
    this.rewards = g.progression.applyMatch(this.result);
    setTimeout(() => {
      if (this.state === 'ended') g.ui.showResults(this.result, this.rewards);
    }, win ? 5200 : 3800);
  }

  // Leave the match from the pause menu.
  abandon() {
    const g = this.game;
    if (this.state === 'playing') {
      this.player.placement = this.alive;
      this.state = 'ended';
      this.finish(false);
      g.ui.showResults(this.result, this.rewards);
    }
  }

  cleanup() {
    this.state = 'idle';
    const g = this.game;
    g.drop.stop();
    for (const a of g.actors) a.model.root.visible = false;
    g.loot.clear();
    g.projectiles.clear();
    g.fx.clear();
  }

  debugPos() { return this.player ? this.player.ctrl.pos.clone() : new THREE.Vector3(); }
}
