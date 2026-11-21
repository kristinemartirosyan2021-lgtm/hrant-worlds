// On-screen touch controls: floating joystick (left), camera drag zone + buttons (right).
// Uses Pointer Events so several fingers work at the same time.

export class TouchControls {
  constructor(input, root) {
    this.input = input;
    this.root = root;
    this.sensitivity = 1;
    this.mode = 'foot';
    this.joy = { id: null, ox: 0, oy: 0 };
    this.look = { id: null, x: 0, y: 0 };

    this.joyZone = root.querySelector('#joy-zone');
    this.lookZone = root.querySelector('#look-zone');
    this.joyBase = root.querySelector('#joy-base');
    this.joyKnob = root.querySelector('#joy-knob');
    this.R = 55;

    this.joyZone.addEventListener('pointerdown', (e) => this._joyStart(e));
    this.lookZone.addEventListener('pointerdown', (e) => this._lookStart(e));
    window.addEventListener('pointermove', (e) => this._move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this._end(e));
    window.addEventListener('pointercancel', (e) => this._end(e));

    for (const btn of root.querySelectorAll('[data-btn]')) {
      const name = btn.dataset.btn;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        btn.setPointerCapture?.(e.pointerId);
        btn.classList.add('down');
        input.press(name, 'touch');
      });
      const up = (e) => { e.preventDefault(); btn.classList.remove('down'); input.release(name, 'touch'); };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.setMode('foot');
  }

  setVisible(v) { this.root.classList.toggle('hidden', !v); }

  setMode(mode) {
    this.mode = mode;
    this.root.dataset.mode = mode;
    const carBtn = this.root.querySelector('[data-btn="car"]');
    if (carBtn) carBtn.textContent = mode === 'car' ? 'EXIT' : 'CAR';
  }

  _joyStart(e) {
    if (this.joy.id !== null) return;
    e.preventDefault();
    this.joy.id = e.pointerId;
    this.joy.ox = e.clientX; this.joy.oy = e.clientY;
    this.joyBase.style.display = 'block';
    this.joyBase.style.left = e.clientX + 'px';
    this.joyBase.style.top = e.clientY + 'px';
    this.joyKnob.style.transform = 'translate(-50%,-50%)';
  }
  _lookStart(e) {
    if (this.look.id !== null) return;
    e.preventDefault();
    this.look.id = e.pointerId; this.look.x = e.clientX; this.look.y = e.clientY;
  }
  _move(e) {
    if (e.pointerId === this.joy.id) {
      e.preventDefault();
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const l = Math.hypot(dx, dy);
      if (l > this.R) { dx *= this.R / l; dy *= this.R / l; }
      this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const nx = dx / this.R, ny = -dy / this.R;
      const mag = Math.hypot(nx, ny);
      const dead = 0.12;
      const s = mag < dead ? 0 : (mag - dead) / (1 - dead) / mag;
      this.input.touchMove.x = nx * s; this.input.touchMove.y = ny * s;
    } else if (e.pointerId === this.look.id) {
      e.preventDefault();
      const dx = e.clientX - this.look.x, dy = e.clientY - this.look.y;
      this.look.x = e.clientX; this.look.y = e.clientY;
      this.input.addLook(dx * 2.2, dy * 2.2);
    }
  }
  _end(e) {
    if (e.pointerId === this.joy.id) {
      this.joy.id = null;
      this.joyBase.style.display = 'none';
      this.input.touchMove.x = 0; this.input.touchMove.y = 0;
    } else if (e.pointerId === this.look.id) this.look.id = null;
  }
}
