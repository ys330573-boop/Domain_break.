// Fighting-game camera + cinematic shot director with shake / punch-zoom / dutch tilt.
import * as THREE from 'three';

export class CameraDirector {
  constructor(aspect) {
    this.cam = new THREE.PerspectiveCamera(30, aspect, 0.1, 400);
    this.pos = new THREE.Vector3(0, 1.6, 9); this.look = new THREE.Vector3(0, 1.1, 0);
    this.fov = 30; this.roll = 0;
    this.trauma = 0; this.punch = 0; this.punchDur = 0.2; this.punchT = 0;
    this.shot = null; // cinematic override: function(t) -> {pos, look, fov, roll}
    this.shotT = 0; this.blend = 1; this.blendDur = 0;
    this.from = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 30, roll: 0 };
    this.tiltT = 0; this.tilt = 0;
    this.focusOverride = null;
  }
  shake(a) { this.trauma = Math.min(1.2, this.trauma + a); }
  zoomPunch(amt = 0.25, dur = 0.22) { this.punch = amt; this.punchDur = dur; this.punchT = dur; }
  dutch(rad = 0.08, dur = 0.4) { this.tilt = rad; this.tiltT = dur; this.tiltDur = dur; }
  // cinematic shot: fn(t) returns {pos, look, fov?, roll?}; blend from current over blendDur (0 = hard cut)
  setShot(fn, blendDur = 0) {
    this.from.pos.copy(this.pos); this.from.look.copy(this.look); this.from.fov = this.fov; this.from.roll = this.roll;
    this.shot = fn; this.shotT = 0; this.blendDur = blendDur; this.blend = blendDur > 0 ? 0 : 1;
  }
  clearShot(blendDur = 0.4) { this.setShot(null, blendDur); }

  update(dt, fighters, bounds) {
    let tPos, tLook, tFov = 30, tRoll = 0;
    if (this.shot) {
      this.shotT += dt;
      const s = this.shot(this.shotT);
      tPos = s.pos; tLook = s.look; tFov = s.fov ?? 30; tRoll = s.roll ?? 0;
    } else {
      const a = fighters[0].pos, b = fighters[1].pos;
      const mx = (a.x + b.x) / 2, dist = Math.abs(a.x - b.x);
      const hy = Math.max(a.y, b.y);
      let z = THREE.MathUtils.clamp(Math.max(5.6 + dist * 0.62, 6 + hy * 1.3), 6.2, 13);
      if (this.focusOverride) { z = this.focusOverride.z; }
      const fx = this.focusOverride ? this.focusOverride.x : THREE.MathUtils.clamp(mx, bounds[0] + 2.5, bounds[1] - 2.5);
      const fy = this.focusOverride ? this.focusOverride.y : 1.05 + hy * 0.45;
      tPos = new THREE.Vector3(fx, fy + 0.45 + z * 0.04, z);
      tLook = new THREE.Vector3(fx, fy, 0);
    }
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / Math.max(0.001, this.blendDur));
      const k = this.blend * this.blend * (3 - 2 * this.blend);
      this.pos.lerpVectors(this.from.pos, tPos, k); this.look.lerpVectors(this.from.look, tLook, k);
      this.fov = THREE.MathUtils.lerp(this.from.fov, tFov, k); this.roll = THREE.MathUtils.lerp(this.from.roll, tRoll, k);
    } else if (this.shot) {
      this.pos.copy(tPos); this.look.copy(tLook); this.fov = tFov; this.roll = tRoll;
    } else {
      const k = 1 - Math.exp(-dt * 5);
      this.pos.lerp(tPos, k); this.look.lerp(tLook, k); this.fov += (tFov - this.fov) * k; this.roll += (tRoll - this.roll) * k;
    }
    // punch zoom (move toward look target)
    let punchK = 0;
    if (this.punchT > 0) { this.punchT -= dt; const p = this.punchT / this.punchDur; punchK = this.punch * Math.sin(p * Math.PI * 0.5); }
    const cp = this.pos.clone().lerp(this.look, punchK);
    // shake
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const sh = this.trauma * this.trauma, t = performance.now() / 1000;
    cp.x += (Math.sin(t * 71.3) + Math.sin(t * 43.1)) * 0.09 * sh;
    cp.y += (Math.sin(t * 63.7) + Math.sin(t * 37.9)) * 0.09 * sh;
    let roll = this.roll + Math.sin(t * 57) * 0.03 * sh;
    if (this.tiltT > 0) { this.tiltT -= dt; roll += this.tilt * Math.sin((this.tiltT / this.tiltDur) * Math.PI); }
    this.cam.position.copy(cp);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.look);
    this.cam.rotateZ(roll);
    if (Math.abs(this.cam.fov - this.fov) > 0.01) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
  }
  project(v3) { // world -> 0..1 screen uv
    const p = v3.clone().project(this.cam);
    return new THREE.Vector2(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
  }
}
