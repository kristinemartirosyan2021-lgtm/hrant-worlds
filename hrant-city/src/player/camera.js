// Third-person orbit camera with auto-follow behind vehicles and building collision.
import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../utils/math.js';

export class CameraRig {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.yaw = Math.PI; this.pitch = 0.32;
    this.dist = 6; this.curDist = 6;
    this.sensitivity = 1;
    this.idle = 10;
    this.shake = 0;
    this.target = new THREE.Vector3();
    this.baseFov = 65;
  }

  get forward() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }

  addShake(a) { this.shake = Math.min(1.2, this.shake + a); }

  update(dt, input, focus, vehicle) {
    const s = 0.0042 * this.sensitivity;
    if (input.look.dx || input.look.dy) {
      this.yaw -= input.look.dx * s;
      this.pitch = clamp(this.pitch + input.look.dy * s * 0.8, -0.35, 1.25);
      this.idle = 0;
    } else this.idle += dt;

    let wantDist = 5.2, height = 1.7, fov = this.baseFov;
    if (vehicle) {
      const big = vehicle.spec.length > 6 ? 3 : 0;
      wantDist = 8.5 + big; height = 2.0 + big * 0.3;
      const sp = Math.abs(vehicle.forwardSpeed);
      fov += clamp(sp / 45, 0, 1) * 14;
      if (this.idle > 1.2 && sp > 2) {
        const back = vehicle.forwardSpeed < -2 ? vehicle.heading + Math.PI : vehicle.heading;
        this.yaw = dampAngle(this.yaw, back, 2.5, dt);
        this.pitch = damp(this.pitch, 0.22, 1.5, dt);
      }
    }
    this.dist = wantDist;
    this.target.set(focus.x, focus.y + height, focus.z);

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dx = -Math.sin(this.yaw) * cp, dz = -Math.cos(this.yaw) * cp, dy = sp;
    const free = this.world.colliders.rayDistance(this.target.x, this.target.z, this.target.y, dx, dz, dy, this.dist, 0.6);
    this.curDist = free < this.curDist ? free : damp(this.curDist, free, 4, dt);
    let cx = this.target.x + dx * this.curDist, cy = this.target.y + dy * this.curDist, cz = this.target.z + dz * this.curDist;
    cy = Math.max(cy, this.world.heightAt(cx, cz) + 0.4);
    if (this.world.isWater(cx, cz)) cy = Math.max(cy, -0.1);

    if (this.shake > 0) {
      const a = this.shake * 0.35;
      cx += (Math.random() - 0.5) * a; cy += (Math.random() - 0.5) * a; cz += (Math.random() - 0.5) * a;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.target);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = damp(this.camera.fov, fov, 3, dt);
      this.camera.updateProjectionMatrix();
    }
  }
}
