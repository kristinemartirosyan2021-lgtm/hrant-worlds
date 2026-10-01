// Keyboard / mouse / pointer-lock input with per-frame edge detection.
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0 };
    this.locked = false;
    this.enabled = true;
    // Touch / virtual input (filled by TouchControls).
    this.touch = false;
    this.look = { yaw: 0, pitch: 0 };          // radians accumulated this frame
    this.axis = { x: 0, y: 0, active: false, sprint: false };
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.left = this.mouse.right = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // Clamp single-event spikes that some browsers emit on lock.
      const mx = Math.max(-200, Math.min(200, e.movementX || 0));
      const my = Math.max(-200, Math.min(200, e.movementY || 0));
      this.mouse.dx += mx;
      this.mouse.dy += my;
    });
    window.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    window.addEventListener('wheel', (e) => {
      if (this.locked) this.mouse.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.mouse.left = this.mouse.right = false; }
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  // Virtual key press/release used by on-screen buttons.
  vDown(code) {
    if (!this.keys.has(code)) this.pressed.add(code);
    this.keys.add(code);
  }
  vUp(code) {
    if (this.keys.delete(code)) this.released.add(code);
  }

  requestLock() {
    if (this.touch) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch (e) { /* ignore */ } });
    } catch (e) {
      try { this.canvas.requestPointerLock(); } catch (e2) { /* ignore */ }
    }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.enabled && this.keys.has(code); }
  hit(code) { return this.enabled && this.pressed.has(code); }
  up(code) { return this.released.has(code); }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.dx = this.mouse.dy = 0;
    this.mouse.leftPressed = this.mouse.rightPressed = false;
    this.mouse.wheel = 0;
    this.look.yaw = this.look.pitch = 0;
  }
}
