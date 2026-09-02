"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const WIDTH = 1280;
const HEIGHT = 720;
const GROUND_Y = 626;
const SAVE_KEY = "hrant-worlds-save-v1";
const PROFILE_KEY = "hrant-worlds-profile-v1";

type Screen =
  | "login"
  | "menu"
  | "playing"
  | "paused"
  | "gameover"
  | "victory";

type Profile = { name: string; gmail: string };
type Platform = { x: number; y: number; w: number; h: number; ground?: boolean };
type Pickup = { x: number; y: number; collected: boolean; phase: number };
type Hazard = { x: number; y: number; w: number; h: number };
type Enemy = {
  x: number;
  y: number;
  w: number;
  h: number;
  start: number;
  end: number;
  dir: number;
  speed: number;
  dead: boolean;
};
type Theme = {
  name: string;
  skyA: string;
  skyB: string;
  glow: string;
  accent: string;
  ground: string;
  danger: string;
};
type LevelData = {
  level: number;
  width: number;
  platforms: Platform[];
  pickups: Pickup[];
  hazards: Hazard[];
  enemies: Enemy[];
  portalX: number;
  secret: Pickup;
};
type Runtime = {
  level: LevelData;
  player: {
    x: number;
    y: number;
    w: number;
    h: number;
    vx: number;
    vy: number;
    onGround: boolean;
    hurtUntil: number;
  };
  score: number;
  lives: number;
  cameraX: number;
  wantsJump: boolean;
  transition: boolean;
  secretFound: boolean;
  message: string;
  messageUntil: number;
};

const themes: Theme[] = [
  { name: "Նեոն քաղաք", skyA: "#090b2a", skyB: "#21105d", glow: "#29f7ff", accent: "#a855f7", ground: "#17245b", danger: "#ff3d81" },
  { name: "Բյուրեղյա ձոր", skyA: "#071e34", skyB: "#113a58", glow: "#65f6d6", accent: "#78a7ff", ground: "#17445a", danger: "#ff6874" },
  { name: "Ամպերի դարպաս", skyA: "#13204c", skyB: "#7144a3", glow: "#baf4ff", accent: "#ffd166", ground: "#414f87", danger: "#ff5a7d" },
  { name: "Լավայի ճեղք", skyA: "#20070d", skyB: "#6d1720", glow: "#ffb21d", accent: "#ff5a1f", ground: "#4a1722", danger: "#ffe057" },
  { name: "Ստվերների անտառ", skyA: "#031711", skyB: "#0d3a2b", glow: "#64ff9c", accent: "#21c7a8", ground: "#12392e", danger: "#ff5876" },
  { name: "Լուսնային բազա", skyA: "#050819", skyB: "#222d5b", glow: "#d9e7ff", accent: "#6d8cff", ground: "#273054", danger: "#ff4f91" },
  { name: "Սառցե պահոց", skyA: "#041d30", skyB: "#0d6380", glow: "#c7fbff", accent: "#65d9ff", ground: "#1f6e86", danger: "#ff668f" },
  { name: "Փոթորկի գործարան", skyA: "#11131d", skyB: "#3f395e", glow: "#f8ef70", accent: "#9b87ff", ground: "#343452", danger: "#ff5578" },
  { name: "Քվանտային լաբիրինթոս", skyA: "#160628", skyB: "#4a0d68", glow: "#ff70f1", accent: "#58fff0", ground: "#421650", danger: "#ffe34d" },
  { name: "Թագի միջուկ", skyA: "#140b02", skyB: "#55320b", glow: "#ffd35a", accent: "#ff8a26", ground: "#5a3515", danger: "#ff355e" },
];

function mulberry32(seed: number) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLevel(level: number): LevelData {
  const random = mulberry32(7400 + level * 913);
  const worldWidth = 4300 + level * 260;
  const platforms: Platform[] = [];
  const pickups: Pickup[] = [];
  const hazards: Hazard[] = [];
  const enemies: Enemy[] = [];
  let x = 0;

  while (x < worldWidth) {
    const remaining = worldWidth - x;
    const segmentWidth = Math.min(
      remaining,
      520 + Math.floor(random() * 300),
    );
    platforms.push({
      x,
      y: GROUND_Y,
      w: segmentWidth,
      h: HEIGHT - GROUND_Y + 80,
      ground: true,
    });

    const hazardCount =
      level < 2
        ? 1
        : 1 + Math.floor(random() * Math.min(3, 1 + level / 3));
    for (let h = 0; h < hazardCount; h += 1) {
      const hx = x + 190 + random() * Math.max(80, segmentWidth - 330);
      if (hx < worldWidth - 250 && hx > 280) {
        hazards.push({
          x: hx,
          y: GROUND_Y - 24,
          w: 36 + random() * 28,
          h: 24,
        });
      }
    }

    if (
      x > 380 &&
      x < worldWidth - 500 &&
      random() < 0.58 + level * 0.025
    ) {
      const ex = x + 100 + random() * Math.max(120, segmentWidth - 250);
      enemies.push({
        x: ex,
        y: GROUND_Y - 44,
        w: 44,
        h: 44,
        start: Math.max(x + 40, ex - 100),
        end: Math.min(x + segmentWidth - 55, ex + 150),
        dir: random() > 0.5 ? 1 : -1,
        speed: 1.15 + level * 0.14 + random() * 0.55,
        dead: false,
      });
    }

    x += segmentWidth;
    if (x < worldWidth - 600) {
      x += Math.min(152, 74 + level * 4 + random() * 42);
    }
  }

  platforms.push({
    x: worldWidth - 680,
    y: GROUND_Y,
    w: 680,
    h: HEIGHT - GROUND_Y + 80,
    ground: true,
  });

  let floatX = 350;
  let floatIndex = 0;
  while (floatX < worldWidth - 360) {
    const y =
      420 + Math.sin(floatIndex * 1.37) * 72 - random() * 70;
    const w = 145 + random() * 120;
    platforms.push({ x: floatX, y, w, h: 22 });
    const coinCount = 2 + Math.floor(w / 70);
    for (let c = 0; c < coinCount; c += 1) {
      pickups.push({
        x:
          floatX +
          28 +
          c * ((w - 56) / Math.max(1, coinCount - 1)),
        y: y - 34,
        collected: false,
        phase: random() * Math.PI * 2,
      });
    }
    floatX += 250 + random() * Math.max(125, 245 - level * 7);
    floatIndex += 1;
  }

  for (let c = 0; c < 16 + level * 2; c += 1) {
    pickups.push({
      x: 280 + random() * (worldWidth - 620),
      y: GROUND_Y - 70 - random() * 46,
      collected: false,
      phase: random() * Math.PI * 2,
    });
  }

  const secretX = Math.floor(worldWidth * (0.48 + random() * 0.18));
  const secretPlatformY = 270 + random() * 55;
  platforms.push({
    x: secretX - 100,
    y: secretPlatformY,
    w: 210,
    h: 20,
  });
  platforms.push({
    x: secretX - 290,
    y: secretPlatformY + 120,
    w: 145,
    h: 20,
  });

  return {
    level,
    width: worldWidth,
    platforms,
    pickups,
    hazards,
    enemies,
    portalX: worldWidth - 170,
    secret: {
      x: secretX,
      y: secretPlatformY - 46,
      collected: false,
      phase: 0,
    },
  };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function intersects(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function createRuntime(level: number, score = 0, lives = 3): Runtime {
  return {
    level: buildLevel(level),
    player: {
      x: 90,
      y: GROUND_Y - 58,
      w: 42,
      h: 58,
      vx: 0,
      vy: 0,
      onGround: true,
      hurtUntil: 0,
    },
    score,
    lives,
    cameraX: 0,
    wantsJump: false,
    transition: false,
    secretFound: false,
    message: "ԱՇԽԱՐՀ " + level + " — " + themes[level - 1].name,
    messageUntil:
      typeof performance === "undefined" ? 2100 : performance.now() + 2100,
  };
}

export default function HrantWorldsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime>(createRuntime(1));
  const screenRef = useRef<Screen>("login");
  const keysRef = useRef({ left: false, right: false });
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const hudTickRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("Հրանտ");
  const [gmail, setGmail] = useState("");
  const [formError, setFormError] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [hud, setHud] = useState({
    level: 1,
    score: 0,
    lives: 3,
    progress: 0,
    world: themes[0].name,
  });

  const changeScreen = useCallback((next: Screen) => {
    screenRef.current = next;
    setScreen(next);
  }, []);

  const beep = useCallback(
    (frequency: number, duration = 0.08, volume = 0.045) => {
      if (!soundOn || typeof window === "undefined") return;
      const audioWindow = window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      };
      const AudioCtor = window.AudioContext || audioWindow.webkitAudioContext;
      if (!AudioCtor) return;
      const audio = audioRef.current ?? new AudioCtor();
      audioRef.current = audio;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.currentTime + duration,
      );
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    },
    [soundOn],
  );

  const updateHud = useCallback(() => {
    const runtime = runtimeRef.current;
    setHud({
      level: runtime.level.level,
      score: runtime.score,
      lives: runtime.lives,
      progress: Math.min(
        100,
        Math.round(
          (runtime.player.x /
            Math.max(1, runtime.level.width - 170)) *
            100,
        ),
      ),
      world: themes[runtime.level.level - 1].name,
    });
  }, []);

  const saveGame = useCallback(() => {
    const runtime = runtimeRef.current;
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        level: runtime.level.level,
        score: runtime.score,
        lives: runtime.lives,
      }),
    );
    setHasSave(true);
    runtime.message = "ԽԱՂԸ ՊԱՀՊԱՆՎԵՑ";
    runtime.messageUntil = performance.now() + 1400;
    beep(720, 0.12);
  }, [beep]);

  const startLevel = useCallback(
    (level: number, score = 0, lives = 3) => {
      runtimeRef.current = createRuntime(level, score, lives);
      updateHud();
      changeScreen("playing");
    },
    [changeScreen, updateHud],
  );

  const startNewGame = useCallback(() => {
    localStorage.removeItem(SAVE_KEY);
    setHasSave(false);
    startLevel(1, 0, 3);
    beep(420, 0.14);
  }, [beep, startLevel]);

  const continueGame = useCallback(() => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      startNewGame();
      return;
    }
    try {
      const saved = JSON.parse(raw) as {
        level?: number;
        score?: number;
        lives?: number;
      };
      startLevel(
        Math.min(10, Math.max(1, saved.level ?? 1)),
        saved.score ?? 0,
        Math.max(1, saved.lives ?? 3),
      );
      beep(560, 0.12);
    } catch {
      startNewGame();
    }
  }, [beep, startLevel, startNewGame]);

  const damagePlayer = useCallback(() => {
    const runtime = runtimeRef.current;
    const now = performance.now();
    if (now < runtime.player.hurtUntil || runtime.transition) return;
    runtime.lives -= 1;
    beep(120, 0.18, 0.07);
    updateHud();
    if (runtime.lives <= 0) {
      localStorage.removeItem(SAVE_KEY);
      setHasSave(false);
      changeScreen("gameover");
      return;
    }
    runtime.player.x = Math.max(90, runtime.player.x - 240);
    runtime.player.y = 320;
    runtime.player.vx = 0;
    runtime.player.vy = -5;
    runtime.player.hurtUntil = now + 1300;
    runtime.message = "ՄՆԱՑ ՄԵԿ ԿՅԱՆՔ ՊԱԿԱՍ";
    runtime.messageUntil = now + 1100;
  }, [beep, changeScreen, updateHud]);

  const nextLevel = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime.transition) return;
    runtime.transition = true;
    runtime.score += 300 + runtime.level.level * 80;
    beep(880, 0.2, 0.06);
    if (runtime.level.level >= 10) {
      localStorage.removeItem(SAVE_KEY);
      setHasSave(false);
      updateHud();
      window.setTimeout(() => changeScreen("victory"), 550);
      return;
    }
    const next = runtime.level.level + 1;
    const nextScore = runtime.score;
    const nextLives = runtime.lives;
    runtime.message = "ԴԱՐՊԱՍԸ ԲԱՑՎԵՑ";
    runtime.messageUntil = performance.now() + 1000;
    window.setTimeout(() => {
      startLevel(next, nextScore, nextLives);
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ level: next, score: nextScore, lives: nextLives }),
      );
      setHasSave(true);
    }, 700);
  }, [beep, changeScreen, startLevel, updateHud]);

  const jump = useCallback(() => {
    if (screenRef.current === "playing") {
      runtimeRef.current.wantsJump = true;
    }
  }, []);

  useEffect(() => {
    const storedProfile = localStorage.getItem(PROFILE_KEY);
    if (storedProfile) {
      try {
        const savedProfile = JSON.parse(storedProfile) as Profile;
        setProfile(savedProfile);
        setName(savedProfile.name);
        setGmail(savedProfile.gmail);
        changeScreen("menu");
      } catch {
        localStorage.removeItem(PROFILE_KEY);
      }
    }
    setHasSave(Boolean(localStorage.getItem(SAVE_KEY)));
  }, [changeScreen]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(event.key)) {
        event.preventDefault();
      }
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        keysRef.current.left = true;
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        keysRef.current.right = true;
      }
      if (
        event.key === "ArrowUp" ||
        event.key === " " ||
        event.key.toLowerCase() === "w"
      ) {
        jump();
      }
      if (
        (event.key === "Escape" || event.key.toLowerCase() === "p") &&
        screenRef.current === "playing"
      ) {
        changeScreen("paused");
      } else if (
        (event.key === "Escape" || event.key.toLowerCase() === "p") &&
        screenRef.current === "paused"
      ) {
        changeScreen("playing");
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        keysRef.current.left = false;
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        keysRef.current.right = false;
      }
    };
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [changeScreen, jump]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const update = (dt: number) => {
      const runtime = runtimeRef.current;
      const player = runtime.player;
      const now = performance.now();
      const previousBottom = player.y + player.h;

      if (keysRef.current.left) player.vx -= 0.88 * dt;
      if (keysRef.current.right) player.vx += 0.88 * dt;
      if (!keysRef.current.left && !keysRef.current.right) {
        player.vx *= Math.pow(0.78, dt);
      }
      const topSpeed = 7.1 + runtime.level.level * 0.12;
      player.vx = Math.max(-topSpeed, Math.min(topSpeed, player.vx));

      if (runtime.wantsJump && player.onGround) {
        player.vy = -15.7;
        player.onGround = false;
        beep(310, 0.07, 0.035);
      }
      runtime.wantsJump = false;
      player.vy += 0.78 * dt;
      player.vy = Math.min(19, player.vy);
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      player.x = Math.max(
        0,
        Math.min(runtime.level.width - player.w, player.x),
      );
      player.onGround = false;

      if (player.vy >= 0) {
        for (const platform of runtime.level.platforms) {
          const crossedTop =
            previousBottom <=
              platform.y + Math.max(12, player.vy * dt + 2) &&
            player.y + player.h >= platform.y;
          const horizontal =
            player.x + player.w - 7 > platform.x &&
            player.x + 7 < platform.x + platform.w;
          if (crossedTop && horizontal) {
            player.y = platform.y - player.h;
            player.vy = 0;
            player.onGround = true;
          }
        }
      }

      for (const enemy of runtime.level.enemies) {
        if (enemy.dead) continue;
        enemy.x += enemy.speed * enemy.dir * dt;
        if (enemy.x < enemy.start) {
          enemy.x = enemy.start;
          enemy.dir = 1;
        }
        if (enemy.x > enemy.end) {
          enemy.x = enemy.end;
          enemy.dir = -1;
        }
        if (intersects(player, enemy)) {
          if (player.vy > 2 && previousBottom <= enemy.y + 12) {
            enemy.dead = true;
            player.vy = -10;
            runtime.score += 120;
            beep(530, 0.08);
          } else {
            damagePlayer();
          }
        }
      }

      for (const hazard of runtime.level.hazards) {
        if (intersects(player, hazard)) damagePlayer();
      }
      if (player.y > HEIGHT + 130) damagePlayer();

      for (const pickup of runtime.level.pickups) {
        if (pickup.collected) continue;
        const pickupRect = {
          x: pickup.x - 15,
          y: pickup.y - 15,
          w: 30,
          h: 30,
        };
        if (intersects(player, pickupRect)) {
          pickup.collected = true;
          runtime.score += 50;
          beep(690, 0.055, 0.025);
        }
      }

      if (!runtime.level.secret.collected) {
        const secretRect = {
          x: runtime.level.secret.x - 22,
          y: runtime.level.secret.y - 22,
          w: 44,
          h: 44,
        };
        if (intersects(player, secretRect)) {
          runtime.level.secret.collected = true;
          runtime.secretFound = true;
          runtime.score += 500;
          runtime.lives = Math.min(5, runtime.lives + 1);
          runtime.message = "ԳԱՂՏՆԻ ՍԵՆՅԱԿ • +500 • +1 ԿՅԱՆՔ";
          runtime.messageUntil = now + 1900;
          beep(980, 0.24, 0.055);
        }
      }

      if (
        player.x + player.w > runtime.level.portalX &&
        player.y + player.h > GROUND_Y - 120
      ) {
        nextLevel();
      }

      const targetCamera = Math.max(
        0,
        Math.min(
          runtime.level.width - WIDTH,
          player.x - WIDTH * 0.36,
        ),
      );
      runtime.cameraX +=
        (targetCamera - runtime.cameraX) * Math.min(1, 0.08 * dt);
      hudTickRef.current += dt;
      if (hudTickRef.current > 8) {
        hudTickRef.current = 0;
        updateHud();
      }
    };

    const draw = (time: number) => {
      const runtime = runtimeRef.current;
      const theme = themes[runtime.level.level - 1];
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, theme.skyA);
      gradient.addColorStop(1, theme.skyB);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.save();
      for (let i = 0; i < 46; i += 1) {
        const sx =
          ((i * 197 -
            runtime.cameraX * (0.09 + (i % 3) * 0.04)) %
            (WIDTH + 160)) -
          80;
        const sy = 38 + ((i * 83) % 430);
        ctx.globalAlpha =
          0.28 + Math.sin(time * 0.0017 + i) * 0.16;
        ctx.fillStyle = i % 5 === 0 ? theme.accent : theme.glow;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = theme.glow;
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i += 1) {
        const bx =
          ((i * 310 - runtime.cameraX * 0.18) % 1700) - 180;
        ctx.beginPath();
        ctx.moveTo(bx, 545);
        ctx.lineTo(bx + 180, 310 - (i % 3) * 38);
        ctx.lineTo(bx + 360, 545);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(-runtime.cameraX, 0);

      for (const platform of runtime.level.platforms) {
        const visible =
          platform.x + platform.w > runtime.cameraX - 80 &&
          platform.x < runtime.cameraX + WIDTH + 80;
        if (!visible) continue;
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = platform.ground ? 12 : 18;
        ctx.fillStyle = platform.ground
          ? theme.ground
          : theme.accent + "bb";
        roundedRect(
          ctx,
          platform.x,
          platform.y,
          platform.w,
          platform.h,
          platform.ground ? 9 : 11,
        );
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = theme.glow + "b8";
        ctx.fillRect(
          platform.x + 8,
          platform.y,
          Math.max(0, platform.w - 16),
          3,
        );
        if (platform.ground) {
          ctx.globalAlpha = 0.16;
          ctx.strokeStyle = theme.glow;
          for (
            let gx = platform.x + 30;
            gx < platform.x + platform.w;
            gx += 88
          ) {
            ctx.beginPath();
            ctx.moveTo(gx, platform.y + 13);
            ctx.lineTo(gx + 38, platform.y + 53);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }

      for (const hazard of runtime.level.hazards) {
        ctx.fillStyle = theme.danger;
        ctx.shadowColor = theme.danger;
        ctx.shadowBlur = 12;
        const pieces = Math.max(1, Math.round(hazard.w / 22));
        for (let i = 0; i < pieces; i += 1) {
          const px = hazard.x + (i * hazard.w) / pieces;
          const pw = hazard.w / pieces;
          ctx.beginPath();
          ctx.moveTo(px, hazard.y + hazard.h);
          ctx.lineTo(px + pw / 2, hazard.y);
          ctx.lineTo(px + pw, hazard.y + hazard.h);
          ctx.closePath();
          ctx.fill();
        }
      }

      for (const pickup of runtime.level.pickups) {
        if (pickup.collected) continue;
        const bob = Math.sin(time * 0.004 + pickup.phase) * 5;
        ctx.shadowColor = "#ffe66f";
        ctx.shadowBlur = 16;
        ctx.fillStyle = "#ffe66f";
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y + bob, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#fff8b0";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y + bob, 6, -1.1, 1.1);
        ctx.stroke();
      }

      for (const enemy of runtime.level.enemies) {
        if (enemy.dead) continue;
        ctx.shadowColor = theme.danger;
        ctx.shadowBlur = 18;
        ctx.fillStyle = theme.danger + "dd";
        roundedRect(ctx, enemy.x, enemy.y, enemy.w, enemy.h, 10);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(enemy.x + 12, enemy.y + 14);
        ctx.lineTo(enemy.x + 19, enemy.y + 21);
        ctx.moveTo(enemy.x + 19, enemy.y + 14);
        ctx.lineTo(enemy.x + 12, enemy.y + 21);
        ctx.moveTo(enemy.x + 27, enemy.y + 14);
        ctx.lineTo(enemy.x + 34, enemy.y + 21);
        ctx.moveTo(enemy.x + 34, enemy.y + 14);
        ctx.lineTo(enemy.x + 27, enemy.y + 21);
        ctx.stroke();
      }

      if (!runtime.level.secret.collected) {
        const pulse = 19 + Math.sin(time * 0.005) * 4;
        ctx.shadowColor = "#ff72f1";
        ctx.shadowBlur = 28;
        const secretGradient = ctx.createRadialGradient(
          runtime.level.secret.x - 6,
          runtime.level.secret.y - 8,
          2,
          runtime.level.secret.x,
          runtime.level.secret.y,
          pulse,
        );
        secretGradient.addColorStop(0, "#ffffff");
        secretGradient.addColorStop(0.34, "#ff72f1");
        secretGradient.addColorStop(1, "#7b2cff");
        ctx.fillStyle = secretGradient;
        ctx.beginPath();
        ctx.arc(
          runtime.level.secret.x,
          runtime.level.secret.y,
          pulse,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      const portalY = GROUND_Y - 92;
      ctx.shadowColor = theme.glow;
      ctx.shadowBlur = 30;
      ctx.strokeStyle = theme.glow;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.ellipse(
        runtime.level.portalX + 28,
        portalY + 48,
        29 + Math.sin(time * 0.004) * 3,
        49,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = theme.accent + "66";
      ctx.beginPath();
      ctx.ellipse(
        runtime.level.portalX + 28,
        portalY + 48,
        20,
        40,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      const player = runtime.player;
      const isHurt = performance.now() < player.hurtUntil;
      if (!isHurt || Math.floor(time / 90) % 2 === 0) {
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 24;
        const playerGradient = ctx.createLinearGradient(
          player.x,
          player.y,
          player.x,
          player.y + player.h,
        );
        playerGradient.addColorStop(0, "#ffffff");
        playerGradient.addColorStop(0.22, theme.glow);
        playerGradient.addColorStop(1, theme.accent);
        ctx.fillStyle = playerGradient;
        roundedRect(
          ctx,
          player.x,
          player.y,
          player.w,
          player.h,
          13,
        );
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#07101d";
        ctx.font = "800 25px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          "H",
          player.x + player.w / 2,
          player.y + player.h / 2 + 1,
        );
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(player.x + 13, player.y + 13, 3, 0, Math.PI * 2);
        ctx.arc(player.x + 29, player.y + 13, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (performance.now() < runtime.messageUntil) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "800 26px Arial";
        const textWidth = Math.min(
          780,
          ctx.measureText(runtime.message).width + 72,
        );
        ctx.fillStyle = "rgba(4, 8, 24, .74)";
        ctx.strokeStyle = theme.glow + "99";
        ctx.lineWidth = 2;
        roundedRect(
          ctx,
          WIDTH / 2 - textWidth / 2,
          94,
          textWidth,
          60,
          18,
        );
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.fillText(runtime.message, WIDTH / 2, 125);
        ctx.restore();
      }
    };

    const frame = (time: number) => {
      const dt = Math.min(
        2,
        Math.max(
          0.2,
          (time - (lastTimeRef.current || time)) / 16.667,
        ),
      );
      lastTimeRef.current = time;
      if (screenRef.current === "playing") update(dt);
      draw(time);
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [beep, damagePlayer, nextLevel, updateHud]);

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanGmail = gmail.trim().toLowerCase();
    if (cleanName.length < 2) {
      setFormError("Գրիր խաղացողի անունը։");
      return;
    }
    if (!/^[^\s@]+@gmail\.com$/.test(cleanGmail)) {
      setFormError("Գրիր ճիշտ Gmail հասցե։");
      return;
    }
    const nextProfile = { name: cleanName, gmail: cleanGmail };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    setProfile(nextProfile);
    setFormError("");
    changeScreen("menu");
    beep(620, 0.14);
  };

  const togglePause = () => {
    changeScreen(
      screenRef.current === "playing" ? "paused" : "playing",
    );
  };

  const toggleFullscreen = async () => {
    if (!shellRef.current) return;
    if (!document.fullscreenElement) {
      await shellRef.current.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  const move = (direction: "left" | "right", active: boolean) => {
    keysRef.current[direction] = active;
  };

  return (
    <main className="game-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="game-shell" ref={shellRef}>
        <div className="game-topbar">
          <div className="brand-lockup">
            <span className="brand-mark">HW</span>
            <div>
              <strong>HRANT WORLDS</strong>
              <span>
                {screen === "login"
                  ? "Մուտք դեպի աշխարհներ"
                  : hud.world}
              </span>
            </div>
          </div>

          {(screen === "playing" || screen === "paused") && (
            <div className="hud" aria-label="Խաղի տվյալներ">
              <span>
                <b>{hud.level}</b>
                <small>ՓՈՒԼ</small>
              </span>
              <span>
                <b>{hud.score.toLocaleString("hy-AM")}</b>
                <small>ՄԻԱՎՈՐ</small>
              </span>
              <span>
                <b>{"♥".repeat(hud.lives)}</b>
                <small>ԿՅԱՆՔ</small>
              </span>
            </div>
          )}

          <div className="top-actions">
            <Button
              className="icon-button"
              variant="ghost"
              size="icon"
              aria-label={soundOn ? "Անջատել ձայնը" : "Միացնել ձայնը"}
              onClick={() => setSoundOn((value) => !value)}
            >
              {soundOn ? "♪" : "×"}
            </Button>
            <Button
              className="icon-button"
              variant="ghost"
              size="icon"
              aria-label="Ամբողջ էկրան"
              onClick={toggleFullscreen}
            >
              ⛶
            </Button>
            {(screen === "playing" || screen === "paused") && (
              <Button
                className="icon-button"
                variant="ghost"
                size="icon"
                aria-label="Դադար"
                onClick={togglePause}
              >
                {screen === "paused" ? "▶" : "Ⅱ"}
              </Button>
            )}
          </div>
        </div>

        <div className="play-stage">
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            aria-label="Hrant Worlds խաղային տարածք"
          />

          {(screen === "playing" || screen === "paused") && (
            <div
              className="progress-track"
              aria-label={"Փուլի առաջընթաց՝ " + hud.progress + "%"}
            >
              <div style={{ width: hud.progress + "%" }} />
            </div>
          )}

          {screen === "login" && (
            <section className="overlay-panel login-panel">
              <p className="eyebrow">ՄՈՒՏՔ ԴԵՊԻ ԱՇԽԱՐՀՆԵՐ</p>
              <h1>Պատրա՞ստ ես, հերոս</h1>
              <p className="panel-copy">
                Ստեղծիր քո խաղային պրոֆիլը և սկսիր առաջին աշխարհից։
              </p>
              <form onSubmit={submitProfile} className="profile-form">
                <label>
                  <span>Խաղացողի անուն</span>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Օրինակ՝ Հրանտ"
                    autoComplete="nickname"
                  />
                </label>
                <label>
                  <span>Gmail</span>
                  <Input
                    value={gmail}
                    onChange={(event) => setGmail(event.target.value)}
                    placeholder="name@gmail.com"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                  />
                </label>
                {formError && (
                  <p className="form-error" role="alert">
                    {formError}
                  </p>
                )}
                <Button
                  type="submit"
                  className="game-button primary-button"
                >
                  ԲԱՑԵԼ ԴԱՐՊԱՍԸ <span>→</span>
                </Button>
              </form>
              <p className="privacy-note">
                🔒 Տվյալները պահվում են միայն այս սարքում և ոչ մի տեղ չեն
                ուղարկվում։
              </p>
            </section>
          )}

          {screen === "menu" && (
            <section className="overlay-panel menu-panel">
              <p className="eyebrow">
                ԲԱՐԻ ԳԱԼՈՒՍՏ,{" "}
                {profile?.name.toUpperCase() || "ՀԵՐՈՍ"}
              </p>
              <h1>10 աշխարհ։ Մեկ ճանապարհ։</h1>
              <p className="panel-copy">
                Հավաքիր էներգիան, գտիր գաղտնի սենյակները և հասիր Թագի
                միջուկին։
              </p>
              <div className="menu-actions">
                <Button
                  className="game-button primary-button"
                  onClick={startNewGame}
                >
                  ՆՈՐ ԽԱՂ <span>▶</span>
                </Button>
                {hasSave && (
                  <Button
                    className="game-button secondary-button"
                    variant="outline"
                    onClick={continueGame}
                  >
                    ՇԱՐՈՒՆԱԿԵԼ <span>↗</span>
                  </Button>
                )}
                <Button
                  className="game-button ghost-button"
                  variant="ghost"
                  onClick={() => setHelpOpen((value) => !value)}
                >
                  ԻՆՉՊԵ՞Ս ԽԱՂԱԼ
                </Button>
              </div>
              {helpOpen && (
                <div className="help-card">
                  <span>
                    ← → / A D
                    <br />
                    <small>ՇԱՐԺՎԵԼ</small>
                  </span>
                  <span>
                    ↑ / SPACE
                    <br />
                    <small>ՑԱՏԿԵԼ</small>
                  </span>
                  <span>
                    P / ESC
                    <br />
                    <small>ԴԱԴԱՐ</small>
                  </span>
                </div>
              )}
            </section>
          )}

          {screen === "paused" && (
            <section className="overlay-panel compact-panel">
              <p className="eyebrow">ԽԱՂԸ ԴԱԴԱՐԵՑՎԱԾ Է</p>
              <h2>Մի փոքր շունչ քաշիր</h2>
              <div className="menu-actions">
                <Button
                  className="game-button primary-button"
                  onClick={() => changeScreen("playing")}
                >
                  ՇԱՐՈՒՆԱԿԵԼ
                </Button>
                <Button
                  className="game-button secondary-button"
                  variant="outline"
                  onClick={saveGame}
                >
                  ՊԱՀՊԱՆԵԼ
                </Button>
                <Button
                  className="game-button ghost-button"
                  variant="ghost"
                  onClick={() => changeScreen("menu")}
                >
                  ԳԼԽԱՎՈՐ ՄԵՆՅՈՒ
                </Button>
              </div>
            </section>
          )}

          {screen === "gameover" && (
            <section className="overlay-panel compact-panel">
              <p className="eyebrow danger-text">
                ՓՈՐՁՈՒԹՅՈՒՆԸ ՉԱՎԱՐՏՎԵՑ
              </p>
              <h2>Կրկին փորձե՞նք</h2>
              <p className="panel-copy">
                Դու հասար {hud.level}-րդ աշխարհ և հավաքեցիր{" "}
                {hud.score.toLocaleString("hy-AM")} միավոր։
              </p>
              <div className="menu-actions">
                <Button
                  className="game-button primary-button"
                  onClick={startNewGame}
                >
                  ՆՈՐԻՑ ՍԿՍԵԼ
                </Button>
                <Button
                  className="game-button ghost-button"
                  variant="ghost"
                  onClick={() => changeScreen("menu")}
                >
                  ԳԼԽԱՎՈՐ ՄԵՆՅՈՒ
                </Button>
              </div>
            </section>
          )}

          {screen === "victory" && (
            <section className="overlay-panel victory-panel">
              <div className="victory-crown">♛</div>
              <p className="eyebrow">
                ԲՈԼՈՐ ԱՇԽԱՐՀՆԵՐՆ ԱՆՑԱԾ ԵՆ
              </p>
              <h2>Հրանտը հասավ Թագի միջուկին</h2>
              <p className="panel-copy">
                Վերջնական հաշիվ՝{" "}
                <strong>{hud.score.toLocaleString("hy-AM")}</strong>
              </p>
              <Button
                className="game-button primary-button"
                onClick={startNewGame}
              >
                ԽԱՂԱԼ ԿՐԿԻՆ
              </Button>
            </section>
          )}

          {screen === "playing" && (
            <div
              className="touch-controls"
              aria-label="Հեռախոսի կառավարում"
            >
              <div className="touch-directions">
                <button
                  aria-label="Շարժվել ձախ"
                  onPointerDown={() => move("left", true)}
                  onPointerUp={() => move("left", false)}
                  onPointerCancel={() => move("left", false)}
                  onPointerLeave={() => move("left", false)}
                >
                  ←
                </button>
                <button
                  aria-label="Շարժվել աջ"
                  onPointerDown={() => move("right", true)}
                  onPointerUp={() => move("right", false)}
                  onPointerCancel={() => move("right", false)}
                  onPointerLeave={() => move("right", false)}
                >
                  →
                </button>
              </div>
              <button
                className="jump-button"
                aria-label="Ցատկել"
                onPointerDown={jump}
              >
                ↑<small>ՑԱՏԿ</small>
              </button>
            </div>
          )}

          <div className="rotate-hint">
            ↻ Հեռախոսը շրջիր հորիզոնական
          </div>
        </div>
      </div>
    </main>
  );
}
