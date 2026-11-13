// Dismemberment effects: 'head' (Toji's CURSED ARMORY) and 'waist' (Gojo's HOLLOW PURPLE).
// The victim's cut bone is collapsed (stump) and a second copy of the character is drawn with
// ONLY the bones above the cut live; those bones get a falling / tumbling transform.
// The fall is a pure function of time, so the KO replay can scrub it backwards and forwards.
import * as THREE from 'three';
import { createActor } from './actor.js';

const GRAV = 9, STEP = 1 / 120;
const NOOP = () => {};
const MODES = {
  head: { bone: 'head', ground: 0.11, v: [0.85, 2.2, 0.45], spin: 7 },
  // upper body: thrown back, tips over and lands flat on its back (pivot = the cut)
  waist: { bone: 'spine', ground: 0.2, v: [1.5, 1.5, 0.25], tip: 1.45 },
};

export class Decap {
  constructor(g, f, dir, mode = 'head') {
    this.g = g; this.f = f; this.dir = dir; this.mode = mode; this.M = MODES[mode] || MODES.head;
    const A = f.actor;
    f.root.updateMatrixWorld(true);
    // copy, same pose as the victim right now
    this.copy = createActor(f.rigged, f.U);
    // same mirroring as the victim so face culling stays correct (bone matrices carry the mirror)
    const hold = new THREE.Group(); hold.add(this.copy.group); hold.scale.x = f.facing; g.scene.add(hold); this.hold = hold;
    this.copy.copyPoseFrom(A);
    const srcBones = [], dstBones = [];
    A.group.traverse(o => { if (o.isBone) srcBones.push(o); });
    this.copy.group.traverse(o => { if (o.isBone) dstBones.push(o); if (o.isMesh) o.frustumCulled = false; });
    const cut = A.bones[this.M.bone];
    const chain = new Set(); cut.traverse(o => { if (o.isBone) chain.add(o); });
    this.p0 = cut.getWorldPosition(new THREE.Vector3());
    this.bones = dstBones.map((b, i) => {
      // three re-derives world matrices from the hierarchy every frame; these bones are driven directly
      b.matrixAutoUpdate = false; b.updateMatrixWorld = NOOP; b.updateWorldMatrix = NOOP;
      return { b, live: chain.has(srcBones[i]), m0: srcBones[i].matrixWorld.clone() };
    });
    this.cut = cut;
    // glowing wound on both halves (purple erasure)
    this.caps = [];
    if (mode === 'waist') for (let i = 0; i < 2; i++) {
      const s = g.fx.sprite('glow', '#a24bff', 0.6, this.p0); s.renderOrder = 7; g.scene.add(s); this.caps.push(s);
    }
    this.T = new THREE.Matrix4(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
    this.lastT = -1;
    this.apply(0);
  }
  // simulated pivot position + rotation angle at time t (deterministic)
  state(t) {
    const M = this.M, p = this.p0.clone(), v = new THREE.Vector3(this.dir * M.v[0], M.v[1], M.v[2]);
    let ang = 0, w = -this.dir * (M.spin || 0), bounced = 0;
    t = Math.min(t, 3);
    for (let s = 0; s < t; s += STEP) {
      const h = Math.min(STEP, t - s);
      v.y -= GRAV * h; p.addScaledVector(v, h); ang += w * h;
      if (p.y < M.ground) {
        p.y = M.ground;
        if (bounced < 2 && v.y < -1) { v.y *= M.tip ? -0.22 : -0.32; bounced++; } else v.y = 0;
        v.x *= 0.6; v.z *= 0.5; w *= 0.55;
      }
      if (p.y <= M.ground + 1e-4) { v.x *= Math.exp(-3 * h); w *= Math.exp(-3 * h); } // sliding / rolling to a stop
    }
    // the upper body tips over onto its back (top away from the attacker) instead of spinning
    if (M.tip) { const k = 1 - Math.exp(-t * 3.4); ang = -this.dir * M.tip * k * (1 + 0.06 * Math.sin(t * 9) * Math.exp(-t * 2)); }
    return { p, ang };
  }
  apply(t) {
    this.t = t;
    const { p, ang } = this.state(t);
    // T = translate(p) * rot * translate(-p0)
    if (this.M.tip) this._q.setFromEuler(new THREE.Euler(0, ang * 0.12, ang));
    else this._q.setFromEuler(new THREE.Euler(ang * 0.25, ang * 0.4, ang));
    this.T.makeTranslation(p.x, p.y, p.z).multiply(this._m.makeRotationFromQuaternion(this._q)).multiply(new THREE.Matrix4().makeTranslation(-this.p0.x, -this.p0.y, -this.p0.z));
    const collapse = new THREE.Matrix4().compose(this.p0, new THREE.Quaternion(), new THREE.Vector3(1e-4, 1e-4, 1e-4));
    for (const B of this.bones) B.b.matrixWorld.multiplyMatrices(this.T, B.live ? B.m0 : collapse);
    this.hold.visible = true;
    this.cut.scale.setScalar(1e-4);
    if (this.caps.length) {
      const legs = this.cut.getWorldPosition(new THREE.Vector3());
      this.caps[0].position.copy(p); this.caps[1].position.copy(legs);
      const fade = Math.max(0.25, 1 - t * 0.35);
      for (const c of this.caps) { c.visible = true; c.material.opacity = fade * (0.75 + Math.random() * 0.25); c.scale.setScalar(0.45 + Math.random() * 0.1); }
      // smouldering violet embers + a little dark smoke from both wounds (only while time moves)
      if (t !== this.lastT && t < 2.5) {
        const fx = this.g.fx;
        for (const q of [p, legs]) {
          if (Math.random() < 0.6) fx.glow.emit({ pos: q.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.2)), vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.6 + Math.random(), 0), t: 0, life: 0.5, s0: 0.04, s1: 0.01, c: new THREE.Color(Math.random() < 0.7 ? '#b26bff' : '#ffffff'), r: 0 });
          if (Math.random() < 0.08) fx.smoke.emit({ pos: q.clone(), vel: new THREE.Vector3(0, 0.7, 0), t: 0, life: 0.7, s0: 0.12, s1: 0.3, c: new THREE.Color('#2a1838'), r: Math.random() * 6, a: 0.35 });
        }
      }
    }
    this.lastT = t;
  }
  // hide the effect (e.g. replay before the cut)
  hide() { this.hold.visible = false; this.cut.scale.setScalar(1); for (const c of this.caps) c.visible = false; }
  dispose() { this.hide(); this.hold.removeFromParent(); for (const c of this.caps) { c.removeFromParent(); c.material.dispose(); } }
  headPos() { return this.state(this.t).p; }
}
