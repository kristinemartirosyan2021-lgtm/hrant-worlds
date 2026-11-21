// Unified input: keyboard + mouse (desktop) and touch controls (mobile) feed one state object.

const KEYMAP = {
  Space: ['jump', 'handbrake'], ShiftLeft: ['sprint'], ShiftRight: ['sprint'],
  KeyE: ['car'], KeyF: ['car'], KeyR: ['action'], Enter: ['action'], KeyQ: ['attack'],
  KeyH: ['horn'], KeyG: ['horn'],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.held = new Set();      // from keyboard/mouse
    this.touchHeld = new Set(); // from touch buttons
    this.pressedSet = new Set();
    this.look = { dx: 0, dy: 0 };
    this.touchMove = { x: 0, y: 0 };
    this.move = { x: 0, y: 0 };
    this.enabled = true;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.onPause = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyP') { this.onPause && this.onPause(); return; }
      this.keys.add(e.code);
      for (const n of KEYMAP[e.code] || []) this.press(n, 'key');
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      for (const n of KEYMAP[e.code] || []) this.release(n, 'key');
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.held.clear(); this.touchHeld.clear(); });

    // Desktop mouse: click to lock pointer, then mouse = camera, left button = attack.
    canvas.addEventListener('mousedown', (e) => {
      if (this.isTouch) return;
      if (document.pointerLockElement !== canvas) {
        if (this.enabled && canvas.requestPointerLock) canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) this.press('attack', 'key');
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.release('attack', 'key'); });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) { this.look.dx += e.movementX; this.look.dy += e.movementY; }
    });
  }

  press(name, src = 'touch') {
    const set = src === 'touch' ? this.touchHeld : this.held;
    if (!set.has(name)) this.pressedSet.add(name);
    set.add(name);
  }
  release(name, src = 'touch') { (src === 'touch' ? this.touchHeld : this.held).delete(name); }
  isHeld(name) { return this.held.has(name) || this.touchHeld.has(name); }
  pressed(name) { return this.pressedSet.has(name); }
  addLook(dx, dy) { this.look.dx += dx; this.look.dy += dy; }

  /** Call once per frame before game update. */
  poll() {
    let x = this.touchMove.x, y = this.touchMove.y;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    this.move.x = x; this.move.y = y;
  }
  /** Call at end of frame. */
  endFrame() { this.pressedSet.clear(); this.look.dx = 0; this.look.dy = 0; }
  clearAll() { this.held.clear(); this.touchHeld.clear(); this.pressedSet.clear(); this.touchMove.x = this.touchMove.y = 0; }
}
