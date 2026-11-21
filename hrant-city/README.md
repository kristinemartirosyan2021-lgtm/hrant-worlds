# 🌴 Hrant City — "Hrant GTA6"

A sunny, low-poly, open-world 3D game for mobile browsers (landscape). It's built with **Three.js + Vite** in plain JavaScript.
Everything is generated in code. Models are built from simple geometry, textures are drawn on canvas, and all sounds and the radio music are synthesised with the Web Audio API. There are **no paid or copyrighted assets**.

## ▶️ Run it

```bash
cd hrant-city
npm install
npm run dev          # dev server on http://localhost:5173 and on your local network
```

### Play on your phone over Wi-Fi (local network IP)

1. Connect the PC and the phone to the **same Wi-Fi**.
2. Run `npm run dev`. Vite prints a line like `Network: http://192.168.1.23:5173/`.
   If you can't see it, find your PC's IP:
   - Windows: `ipconfig` → "IPv4 Address"
   - macOS: `ipconfig getifaddr en0`
   - Linux: `hostname -I`
3. On the phone, open **Chrome (Android)** or **Safari (iPhone)** and go to `http://<PC-IP>:5173`.
4. Turn the phone to **landscape**. In portrait you'll see a "Rotate your phone" screen.
5. Tap ⛶ for fullscreen (Android). On iPhone, Safari has no fullscreen API. Use *Share → Add to Home Screen* on the published (HTTPS) version instead.
6. If the phone can't connect, allow Node/Vite through the PC firewall (Windows asks the first time: tick "Private networks").

> The service worker (offline mode) and "Install app" only work on **HTTPS** or `localhost`. Over a LAN IP the game works, but it won't install. Use the published version (see below) to test the PWA.

To test the production build: `npm run build && npm run preview`, then open `http://<PC-IP>:4173`.

## 🎮 Controls

| | Phone | PC |
|---|---|---|
| Move / steer | Left-side floating joystick (push to the edge = run) | WASD / arrows |
| Camera | Drag anywhere on the right side | Mouse (click to lock pointer) |
| Jump / sprint | JUMP · SPRINT | Space · Shift |
| Enter / exit any car | CAR / EXIT | E or F |
| Start mission / save | ACTION | R or Enter |
| Attack (punch close, pistol far) | ATTACK | Left click or Q |
| In car | GAS · BRAKE (reverse) · DRIFT (handbrake) · HORN | W · S · Space · H |
| Pause | ❚❚ | Esc / P |

## ✅ Step-by-step test checklist

Every step below is already implemented. Use this list to check each part on your phone.

1. **Setup, landscape, touch, walking.** Open the game in portrait and check that you see "Rotate your phone". Rotate it, tap *New Game*, walk with the left thumb, look around with the right thumb, then JUMP and SPRINT. Tap ⛶ for fullscreen.
2. **City, camera, minimap.** Explore downtown towers, the pastel art-deco hotels by the beach, the suburbs, the ring highway, Ocean Drive, the beach, the bridge and the island. The minimap (bottom-left) rotates with the camera and shows roads, mission markers (numbered), the hospital (H) and the police station (P).
3. **Cars.** Parked cars wait in the lot next to the spawn point: a sports car, a motorbike, a sedan, a truck and a taxi. Tap CAR, then use GAS, BRAKE and DRIFT. Crash into walls to see smoke, then fire and an explosion. Drive into the sea and the car sinks. Take the **speedboat** at the pier, east of the beach.
4. **NPCs and traffic.** Pedestrians walk the sidewalks and run away from gunfire. Traffic stops at traffic lights and behind other cars. Tap CAR next to a traffic car to carjack it.
5. **Police.** Commit crimes (punching, shooting, hitting police cars) to raise the ★ wanted level. Police cars chase you and officers get out. At 1★ they try to arrest you (BUSTED). From 2★ they shoot. Stay out of their line of sight until the stars stop flashing and fade.
6. **Missions, money, HUD, menus, save.** Walk into a coloured light beam and press ACTION:
   1. *Pizza Run* – delivery (next to the spawn)
   2. *Ocean Drive Race* – checkpoints around the ring road (beach)
   3. *Catch the Thief* – chase and wreck a car
   4. *Heat Wave* – timed escape from a 3★ wanted level
   5. *Hrant's Lost Coins* – collect 10 coins, including some on the bridge and the island

   The game saves progress automatically every 45 s and after each mission. You can also save from the pause menu or at the green beam at **Hrant's Villa** on the island. If you die you respawn at the hospital (−$100). If you get busted you respawn at the police station (−$200).
7. **Day/night, sound, polish.** A full day lasts 12 minutes. Watch the sunset, then the lit windows, street lamps, neon and car headlights at night. Sounds include the engine, tyre screech, horn, sirens, footsteps and gunshots, plus the procedural "Hrant FM" radio in cars. In *Settings* you can change graphics (Low/Medium/High), sound and radio volume, camera sensitivity and turn on an FPS counter.
8. **PWA.** On the published HTTPS site: Android Chrome menu → *Install app* / *Add to Home screen*; iPhone Safari → *Share* → *Add to Home Screen*. The game then opens fullscreen in landscape and **works offline**.

## 🚀 Publish for free

### Option A — GitHub Pages (workflow included)

1. Merge this code into the `main` branch.
2. In the GitHub repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow `.github/workflows/hrant-city-pages.yml` builds `hrant-city/` and deploys it on every push to `main`. You can also run it by hand from the **Actions** tab.
4. Your game will be at `https://<your-username>.github.io/hrant-worlds/`.

### Option B — Netlify

- **Easiest:** run `npm run build`, then drag the `hrant-city/dist` folder onto <https://app.netlify.com/drop>.
- **Auto-deploy from GitHub:** on Netlify, *Add new site → Import from Git* → pick this repo. The `netlify.toml` in the repo root already sets base `hrant-city`, command `npm run build` and publish folder `dist`.

Both options give you HTTPS, which you need for "Add to Home Screen" and offline play.

## ⚡ Performance

- One draw call per city chunk. Static geometry is merged into 150 m chunks, so off-screen chunks are frustum-culled.
- All pedestrians and police officers on foot are drawn with **5 instanced meshes** in total.
- Fog sets the draw distance (Low 230 m / Medium 320 m / High 440 m). Distant vehicles are hidden.
- Pixel ratio is capped (Low 1 / Medium 1.5 / High 2). Shadows are on **High** only. NPC and traffic counts scale with quality.
- Touch devices start on *Medium* (*Low* if the device reports ≤ 3 GB RAM). You can change this in Settings.

## 🗂️ Code structure

```
src/
  main.js              boot, render loop, fullscreen/orientation wiring
  game.js              creates all systems, game flow (death, busted, save)
  config.js            world layout constants, quality presets, palettes
  core/                input.js (keyboard/mouse), touch.js (joystick+buttons), orientation.js, save.js
  world/               city.js (procedural city), roads.js (road graph + traffic lights),
                       colliders.js (spatial hash), daynight.js (sky/sun/fog), textures.js, pickups.js
  player/              player.js (walk/run/jump/swim/fight/drive), humanoid.js (model), camera.js
  vehicles/            carModels.js (specs + models), vehicle.js (arcade physics/damage),
                       vehicleManager.js (collisions), effects.js (smoke/fire/explosions/tracers)
  npc/                 crowd.js (instanced rendering), pedestrians.js, traffic.js (lane-following AI)
  police/              police.js (wanted stars, pursuit AI, officers)
  missions/            missions.js (5 missions + markers + save point)
  ui/                  hud.js, minimap.js, menus.js
  audio/               audio.js (engine, horn, siren, SFX), music.js ("Hrant FM" synthwave radio)
scripts/               sw-plugin.js (generates the offline service worker), make-icons.mjs (PWA icons)
```

Part of the Hrant Worlds project. Have fun in Hrant City! 🌅
