// Kinematic character physics: acceleration, stairs step-up, jumping, vaulting, crouching.
import * as THREE from 'three';

const GRAVITY = 22;
const _n = new THREE.Vector3();

export class CharacterController {
  constructor(collision) {
    this.col = collision;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.radius = 0.36;
    this.standH = 1.8;
    this.crouchH = 1.22;
    this.height = this.standH;
    this.crouching = false;
    this.onGround = false;
    this.groundY = 0;
    this.airTime = 0;
    this.events = { landed: 0, vaulted: false, jumped: false };
  }

  teleport(x, y, z) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.onGround = false;
  }

  canStand() {
    const c = this.col.ceilingAt(this.pos.x, this.pos.z, this.radius * 0.9, this.pos.y + 0.3);
    return c - this.pos.y > this.standH + 0.02;
  }

  // wishX/wishZ: normalised world direction (or zero); speed: target speed (m/s).
  step(dt, wishX, wishZ, speed, jump, wantCrouch) {
    const ev = this.events;
    ev.landed = 0; ev.vaulted = false; ev.jumped = false;
    const p = this.pos, v = this.vel, col = this.col;

    // crouch
    if (wantCrouch) this.crouching = true;
    else if (this.crouching && this.canStand()) this.crouching = false;
    this.height = this.crouching ? this.crouchH : this.standH;

    // horizontal acceleration
    const tx = wishX * speed, tz = wishZ * speed;
    const has = wishX !== 0 || wishZ !== 0;
    const accel = this.onGround ? (has ? 48 : 30) : 7;
    let dx = tx - v.x, dz = tz - v.z;
    const dl = Math.hypot(dx, dz), maxD = accel * dt;
    if (dl > maxD) { dx *= maxD / dl; dz *= maxD / dl; }
    v.x += dx; v.z += dz;

    // jump / vault
    if (jump && this.onGround && !this.crouching) {
      const vault = this.findVault(wishX || Math.sin(this.facing || 0), wishZ || Math.cos(this.facing || 0));
      if (vault !== null) {
        v.y = Math.sqrt(2 * GRAVITY * (vault - p.y + 0.4));
        const hs = Math.max(Math.hypot(v.x, v.z), 3.2);
        const fl = Math.hypot(wishX, wishZ) || 1;
        if (has) { v.x = (wishX / fl) * hs; v.z = (wishZ / fl) * hs; }
        ev.vaulted = true;
      } else {
        v.y = 7.0;
        ev.jumped = true;
      }
      this.onGround = false;
    }

    // horizontal integrate with sub-steps
    const stepUp = this.onGround ? 0.52 : 0.3;
    const travel = Math.hypot(v.x, v.z) * dt;
    const n = Math.max(1, Math.ceil(travel / 0.2));
    const pushOut = { x: 0, z: 0 };
    for (let i = 0; i < n; i++) {
      p.x += (v.x * dt) / n;
      p.z += (v.z * dt) / n;
      if (col.resolveCylinder(p, this.radius, p.y + stepUp, p.y + this.height, pushOut)) {
        // remove velocity into the wall (slide)
        const dot = v.x * pushOut.x + v.z * pushOut.z;
        if (dot < 0) { v.x -= dot * pushOut.x; v.z -= dot * pushOut.z; }
      }
    }

    // vertical
    const prevY = p.y;
    v.y -= GRAVITY * dt;
    if (v.y < -40) v.y = -40;
    p.y += v.y * dt;
    if (v.y > 0) {
      const ceil = col.ceilingAt(p.x, p.z, this.radius * 0.8, prevY + this.height - 0.15);
      if (p.y + this.height > ceil) { p.y = ceil - this.height; v.y = 0; }
    }
    const ground = col.groundAt(p.x, p.z, this.radius * 0.8, Math.max(p.y, prevY), stepUp);
    this.groundY = ground;
    if (p.y <= ground) {
      if (!this.onGround) ev.landed = -v.y;
      p.y = ground;
      v.y = 0;
      this.onGround = true;
    } else if (this.onGround && v.y <= 0 && p.y - ground < 0.5) {
      p.y = ground; v.y = 0;
    } else {
      this.onGround = false;
    }
    this.airTime = this.onGround ? 0 : this.airTime + dt;

    // slide off very steep terrain
    if (this.onGround) {
      const t = col.terrain;
      if (Math.abs(ground - t.height(p.x, p.z)) < 0.05) {
        t.normal(p.x, p.z, _n);
        if (_n.y < 0.62) { v.x += _n.x * 18 * dt; v.z += _n.z * 18 * dt; }
      }
    }
  }

  // Returns obstacle top height if a vaultable obstacle is right ahead.
  findVault(fx, fz) {
    const l = Math.hypot(fx, fz);
    if (l < 1e-3) return null;
    fx /= l; fz /= l;
    const p = this.pos;
    const x = p.x + fx * 0.75, z = p.z + fz * 0.75;
    const boxes = this.col.query(x - 0.25, z - 0.25, x + 0.25, z + 0.25);
    let top = null;
    for (const b of boxes) {
      if (x < b.min[0] - 0.25 || x > b.max[0] + 0.25 || z < b.min[2] - 0.25 || z > b.max[2] + 0.25) continue;
      const h = b.max[1] - p.y;
      if (h > 0.5 && h < 1.45) top = Math.max(top ?? -Infinity, b.max[1]);
      else if (h >= 1.45 && b.min[1] < p.y + 1.4) return null;
    }
    if (top === null) return null;
    const ceil = this.col.ceilingAt(x, z, 0.3, top + 0.05);
    if (ceil - top < 1.3) return null;
    return top;
  }
}
