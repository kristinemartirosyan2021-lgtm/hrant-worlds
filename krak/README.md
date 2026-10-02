# ԿՐԱԿ — Մնա վերջինը

Original Armenian third-person 3D survival shooter for the browser (Three.js, no build step).
16 fighters, one hand-built map (Old Quarter, Factory Zone, Checkpoint, Rocky Hills, Oak Forest,
Old Fortress), shrinking zone, loot rarities, tactical bot AI, progression, fully Armenian UI.

## Run

Serve this folder with any static web server (ES modules don't load from `file://`):

```bash
cd krak && python3 -m http.server 8080
# open http://localhost:8080
```

URL flags: `?debug` (FPS / draw calls / AI states), `?skip` (skip intro gate),
`?mobile=1` / `?mobile=0` (force touch controls on/off).

## Desktop controls
WASD move · Shift sprint · Space jump/vault · C crouch · R reload · F pick up · 1/2/3 weapons ·
G grenade (hold to aim, release) · H heal · M map · Mouse look · LMB fire · RMB aim · Esc pause.

## Mobile (auto-detected)
Landscape layout with multi-touch: floating left joystick (push past the ring upward to sprint),
right-side swipe to look 360°, fire buttons (drag while firing to track), aim toggle, jump, crouch,
reload, grenade (hold → arc, release → throw), heal, tap the pickup prompt / weapon slots / minimap.
Settings include touch sensitivity, button size, optional aim assist and Low / Medium / High graphics.
Rendering adapts automatically (DPR cap, dynamic resolution, shadow/LOD/particle budgets).

## Code layout
`src/core` game loop, input, audio (procedural Web Audio), save, cinematics ·
`src/world` terrain, map, collision, nav grid, vegetation, sky ·
`src/entities` human model + IK, character physics, player, bot AI ·
`src/combat` weapons, hitscan, grenades, effects, health ·
`src/gameplay` match flow, zone, loot, inventory, progression ·
`src/ui` HUD, menus, minimap, touch controls.
