// Procedural pose animation. Poses are authored semantically (degrees):
//   hips:{x,y,z} pos:[fwd,up,side]  spine/chest/neck/head:{x:lean fwd, y:twist(+ = toward char's left), z:side}
//   armL/armR:{fwd, side, twist}  elbowL/R: bend   handL/R:{x,y,z}
//   legL/legR:{fwd, side, twist}  kneeL/R: bend    footL/R: {x}
// Character faces +Z in local space, its LEFT is +X.
import * as THREE from 'three';

const D = THREE.MathUtils.degToRad;
const _e = new THREE.Euler();
const qe = (x, y, z, order = 'XYZ') => new THREE.Quaternion().setFromEuler(_e.set(D(x), D(y), D(z), order));

export function compilePose(spec, base) {
  const out = base ? clonePose(base) : neutralPose();
  if (!spec) return out;
  const set = (bone, q) => { out.q[bone] = q; };
  for (const k of ['hips', 'spine', 'chest', 'neck', 'head']) {
    if (spec[k]) { const s = spec[k]; set(k, qe(s.x || 0, s.y || 0, s.z || 0, 'YXZ')); }
  }
  if (spec.pos) out.pos = new THREE.Vector3(spec.pos[2] || 0, spec.pos[1] || 0, spec.pos[0] || 0);
  for (const [s, side] of [['L', 1], ['R', -1]]) {
    const a = spec['arm' + s];
    if (a) set('upperArm_' + s, qe(-(a.fwd || 0), side * (a.twist || 0), side * (a.side || 0), 'XZY'));
    if (spec['elbow' + s] != null) set('foreArm_' + s, qe(-spec['elbow' + s], 0, 0));
    const h = spec['hand' + s];
    if (h) set('hand_' + s, qe(h.x || 0, side * (h.y || 0), side * (h.z || 0)));
    const l = spec['leg' + s];
    if (l) set('thigh_' + s, qe(-(l.fwd || 0), side * (l.twist || 0), side * (l.side || 0), 'XZY'));
    if (spec['knee' + s] != null) set('shin_' + s, qe(spec['knee' + s], 0, 0));
    const f = spec['foot' + s];
    if (f) set('foot_' + s, qe(f.x || 0, 0, 0));
  }
  return out;
}

export function neutralPose() {
  const q = {};
  for (const n of ['hips', 'spine', 'chest', 'neck', 'head', 'upperArm_L', 'foreArm_L', 'hand_L', 'upperArm_R', 'foreArm_R', 'hand_R', 'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R'])
    q[n] = new THREE.Quaternion();
  return { q, pos: new THREE.Vector3() };
}
export function clonePose(p) {
  const q = {};
  for (const k in p.q) q[k] = p.q[k].clone();
  return { q, pos: p.pos.clone() };
}
export function blendPose(a, b, t, out) {
  out = out || neutralPose();
  for (const k in a.q) out.q[k].slerpQuaternions(a.q[k], b.q[k], t);
  out.pos.lerpVectors(a.pos, b.pos, t);
  return out;
}

const EASE = {
  linear: t => t,
  smooth: t => t * t * (3 - 2 * t),
  out: t => 1 - (1 - t) * (1 - t) * (1 - t),
  in: t => t * t * t,
  snap: t => 1 - Math.pow(1 - t, 5),
  hold: t => (t < 1 ? 0 : 1),
};

// A clip: { loop, keys:[{t, pose(spec or compiled), ease}] }
export class Clip {
  constructor(def, base) {
    this.loop = !!def.loop;
    this.keys = def.keys.map(k => ({ t: k.t, ease: EASE[k.ease || 'smooth'], pose: k.pose.q ? k.pose : compilePose(k.pose, base) }));
    this.duration = this.keys[this.keys.length - 1].t;
    this._tmp = neutralPose();
  }
  sample(time, out) {
    const K = this.keys;
    let t = this.loop ? time % this.duration : Math.min(time, this.duration);
    if (K.length === 1 || t <= K[0].t) return blendPose(K[0].pose, K[0].pose, 0, out);
    for (let i = 1; i < K.length; i++) {
      if (t <= K[i].t) {
        const a = K[i - 1], b = K[i];
        const f = b.ease((t - a.t) / Math.max(1e-5, b.t - a.t));
        return blendPose(a.pose, b.pose, f, out);
      }
    }
    return blendPose(K[K.length - 1].pose, K[K.length - 1].pose, 0, out);
  }
}

// Drives a rig instance from clips with crossfades + additive flinch + procedural extras
export class Animator {
  constructor(inst) {
    this.inst = inst;
    this.clip = null; this.time = 0; this.speed = 1;
    this.fromPose = neutralPose(); this.fade = 0; this.fadeDur = 0;
    this.out = neutralPose(); this.cur = neutralPose();
    this.flinch = 0; this.flinchDir = 1;
    this.breath = 0;
    this.extra = null; // function(pose, dt) for procedural tweaks
    this._ql = new THREE.Quaternion(); this._qc = new THREE.Quaternion();
  }
  play(clip, { fade = 0.08, speed = 1, restart = true } = {}) {
    if (this.clip === clip && !restart) return;
    this.fromPose = clonePose(this.out);
    this.clip = clip; this.time = 0; this.speed = speed;
    this.fade = 0; this.fadeDur = fade;
  }
  update(dt) {
    if (!this.clip) return;
    this.time += dt * this.speed;
    this.clip.sample(this.time, this.cur);
    if (this.fadeDur > 0 && this.fade < this.fadeDur) {
      this.fade += dt;
      const f = Math.min(1, this.fade / this.fadeDur);
      blendPose(this.fromPose, this.cur, f * f * (3 - 2 * f), this.out);
    } else blendPose(this.cur, this.cur, 0, this.out);
    this.breath += dt;
    if (this.extra) this.extra(this.out, dt);
    // flinch: additive lean back
    if (this.flinch > 0.001) {
      const f = this.flinch;
      this.out.q.chest.multiply(qe(-25 * f, 0, 8 * f * this.flinchDir));
      this.out.q.head.multiply(qe(-30 * f, 10 * f, 0));
      this.flinch = Math.max(0, this.flinch - dt * 4);
    }
    this.apply(this.out);
  }
  apply(pose) {
    const { bones, rest, corrections: C } = this.inst;
    bones.hips.position.copy(rest.hips).add(pose.pos);
    for (const n of ['hips', 'spine', 'chest', 'neck', 'head']) bones[n].quaternion.copy(pose.q[n]);
    for (const s of ['L', 'R']) {
      const ca = C['arm_' + s], cl = C['leg_' + s];
      const cai = this._qc.copy(ca).invert();
      bones['upperArm_' + s].quaternion.copy(pose.q['upperArm_' + s]).multiply(ca);
      bones['foreArm_' + s].quaternion.copy(cai).multiply(pose.q['foreArm_' + s]).multiply(ca);
      bones['hand_' + s].quaternion.copy(cai).multiply(pose.q['hand_' + s]).multiply(ca);
      const cli = this._ql.copy(cl).invert();
      bones['thigh_' + s].quaternion.copy(pose.q['thigh_' + s]).multiply(cl);
      bones['shin_' + s].quaternion.copy(cli).multiply(pose.q['shin_' + s]).multiply(cl);
      bones['foot_' + s].quaternion.copy(cli).multiply(pose.q['foot_' + s]).multiply(cl);
    }
  }
}
