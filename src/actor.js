// Actors: the visual body of a fighter. Two kinds share one interface:
//  - ProcActor: auto-rigged static mesh driven by procedural poses (src/rig.js)
//  - SkelActor: a properly rigged GLB (real skeleton + real skin weights).
//      * real animation clips play where the roster maps one (walk, dash, heavy…)
//      * every other move uses the procedural pose library, RETARGETED onto the real bones
// Interface: group, bones{ourName: Object3D}, anim{play(clip,{fade,speed,restart,name}), update(dt), flinch, flinchDir, clip},
//            copyPoseFrom(other), makeGhost(material)
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { buildRiggedModel, instantiate, loadGLB, CHAR_HEIGHT, BONE_NAMES, restCorrections, fingerKey, fingerLayout } from './rig.js';
import { Animator } from './anim.js';
import { makeToonMaterial, makeOutlineMaterial } from './toon.js';
import { PROPS } from './props.js';
import { attachWeapons } from './weapons.js';

// our bone name -> rig bone name (defaults fit the 28-bone "Pelvis/Spine1/L_Shoulder…" rig)
const DEFAULT_MAP = {
  hips: 'Pelvis', spine: 'Spine1', chest: 'Spine3', neck: 'Neck', head: 'Head',
  upperArm_L: 'L_Shoulder', foreArm_L: 'L_Elbow', hand_L: 'L_Wrist', upperArm_R: 'R_Shoulder', foreArm_R: 'R_Elbow', hand_R: 'R_Wrist',
  thigh_L: 'L_Hip', shin_L: 'L_Knee', foot_L: 'L_Ankle', thigh_R: 'R_Hip', shin_R: 'R_Knee', foot_R: 'R_Ankle',
};
// Mixamo rigs: use `skeleton: { rig: 'mixamo', ... }` in the roster
export const MIXAMO_MAP = {
  hips: 'mixamorigHips', spine: 'mixamorigSpine', chest: 'mixamorigSpine2', neck: 'mixamorigNeck', head: 'mixamorigHead',
  upperArm_L: 'mixamorigLeftArm', foreArm_L: 'mixamorigLeftForeArm', hand_L: 'mixamorigLeftHand',
  upperArm_R: 'mixamorigRightArm', foreArm_R: 'mixamorigRightForeArm', hand_R: 'mixamorigRightHand',
  thigh_L: 'mixamorigLeftUpLeg', shin_L: 'mixamorigLeftLeg', foot_L: 'mixamorigLeftFoot',
  thigh_R: 'mixamorigRightUpLeg', shin_R: 'mixamorigRightLeg', foot_R: 'mixamorigRightFoot',
  toe_L: 'mixamorigLeftToeBase', toe_R: 'mixamorigRightToeBase',
};

// ------------------------------------------------------------------ loading
export async function buildSource(def, onProgress) {
  if (!def.skeleton) return { kind: 'proc', def, rigged: await buildRiggedModel(def, onProgress) };
  const S = def.skeleton;
  const map = Object.assign({}, S.rig === 'mixamo' ? MIXAMO_MAP : Object.assign({ toe_L: 'L_Foot', toe_R: 'R_Foot' }, DEFAULT_MAP), S.map || {});
  const base = await loadGLB(S.base, onProgress);
  const pelvis = base.scene.getObjectByName(map.hips);
  const clips = {};
  for (const [name, spec] of Object.entries(S.clips || {})) {
    let g;
    try { g = await loadGLB(spec.file); } catch (e) { console.warn('animation file missing, move disabled:', spec.file); continue; }
    const c = g.animations.find(a => a.name === spec.clip);
    if (!c) { console.warn('clip not found', spec); continue; }
    const root = spec.rootMotion ? extractRoot(c, map.hips, spec.rootMotion) : null;
    const clip = prepClip(c, map.hips, pelvis.position);
    const rootY = spec.rootY ? extractRootY(clip, map.hips, pelvis.position.y) : null;
    clips[name] = { clip, speed: spec.speed ?? 1, loop: !!spec.loop, from: spec.from ?? 0, root, rootY, prop: spec.prop, weapon: spec.weapon ? [].concat(spec.weapon) : null };
  }
  return { kind: 'skel', def, scene: base.scene, clips, map };
}

// forward (+Z) travel of the pelvis over time, so the game can move the fighter with the animation
function extractRoot(clip, pelvisName, mul) {
  const t = clip.tracks.find(t => t.name === pelvisName + '.position');
  if (!t) return null;
  const z = new Float32Array(t.times.length);
  for (let i = 0; i < z.length; i++) z[i] = (t.values[i * 3 + 2] - t.values[2]) * mul;
  return { times: t.times, z };
}
// jumps baked into a clip (pelvis rising above its rest height): move that rise to the FIGHTER
// (so hurtbox / gravity / landing follow it) and keep the pelvis at most at rest height
function extractRootY(clip, pelvisName, restY) {
  const t = clip.tracks.find(t => t.name === pelvisName + '.position');
  if (!t) return null;
  t.values = Float32Array.from(t.values);
  const z = new Float32Array(t.times.length);
  for (let i = 0; i < z.length; i++) { const up = Math.max(0, t.values[i * 3 + 1] - restY); z[i] = up; t.values[i * 3 + 1] -= up; }
  return { times: t.times, z };
}
function sampleRoot(r, time) {
  const T = r.times; if (time <= T[0]) return r.z[0];
  for (let i = 1; i < T.length; i++) if (time <= T[i]) { const k = (time - T[i - 1]) / (T[i] - T[i - 1]); return r.z[i - 1] + (r.z[i] - r.z[i - 1]) * k; }
  return r.z[r.z.length - 1];
}

// keep rotations; keep only the pelvis' vertical motion (the game moves the fighter itself)
function prepClip(src, pelvisName, rest) {
  const c = src.clone();
  c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') || t.name === pelvisName + '.position');
  for (const t of c.tracks) if (t.name === pelvisName + '.position') {
    for (let i = 0; i < t.values.length; i += 3) { t.values[i] = rest.x; t.values[i + 2] = rest.z; }
  }
  return c;
}

// ------------------------------------------------------------------ hand signs
// setFingers({ R: { index: 0, middle: 0, ring: 1, little: 1, thumb: 0.8 }, L: { all: 0.6 } }) curls
// fingers (0 = straight, 1 = fist) on top of whatever the body animation does; setFingers(null) fades
// back. side.spread = { middle: 0.3 } bends a finger sideways towards the index finger (crossed fingers).
// Needs finger bones: real skeletons (mixamo…) or skinned models whose source rig had fingers.
const FCURL = [1.3, 1.6, 1.1], _fq = new THREE.Quaternion(), _ft = new THREE.Quaternion(), _fs = new THREE.Quaternion();
const FingerMixin = {
  setFingers(spec, fade = 0.1) { if (spec) this.fSpec = spec; this.fOn = !!spec; this.fFade = fade; },
  updateFingers(dt) {
    const F = this.fingers; if (!F || !F.length) return;
    const want = this.fOn ? 1 : 0, step = dt / Math.max(0.02, this.fFade || 0.1);
    this.fW = this.fW || 0;
    this.fW = want > this.fW ? Math.min(want, this.fW + step) : Math.max(want, this.fW - step);
    if (this.fW <= 0 && !(this.fPrev > 0)) return;
    this.fPrev = this.fW;
    this.beforeFingers?.();
    const S = this.fSpec || {};
    for (const f of F) {
      const side = S[f.side] || {}, c = side[f.finger] ?? side.all ?? 0.2;
      _ft.copy(f.rest);
      const sp = f.seg === 1 && side.spread?.[f.finger];
      if (sp && f.spread) _ft.multiply(_fs.setFromAxisAngle(f.spread, sp));
      _ft.multiply(_fq.setFromAxisAngle(f.axis, c * FCURL[f.seg - 1] * (f.finger === 'thumb' ? 0.9 : 1)));
      if (this.fingerBase) f.b.quaternion.copy(f.rest);
      f.b.quaternion.slerp(_ft, this.fW);
    }
  },
};

export function createActor(src, U, opts = {}) {
  return src.kind === 'skel' ? new SkelActor(src, U, opts) : new ProcActor(src, U, opts);
}

function packPose(list) {
  const out = new Float32Array(list.length * 7);
  list.forEach((b, i) => { b.quaternion.toArray(out, i * 7); b.position.toArray(out, i * 7 + 4); });
  return out;
}
function unpackPose(list, a) {
  list.forEach((b, i) => { b.quaternion.fromArray(a, i * 7); b.position.fromArray(a, i * 7 + 4); });
}

// ------------------------------------------------------------------ auto-rigged
class ProcActor {
  constructor(src, U, opts) {
    this.src = src;
    const mat = opts.material;
    this.inst = instantiate(src.rigged, mat ? () => mat : m => makeToonMaterial(m, U), mat || opts.noOutline ? null : () => makeOutlineMaterial(U));
    this.group = this.inst.group; this.bones = this.inst.bones;
    this.anim = new Animator(this.inst);
    // finger bones (from the source model's own skin) for hand signs; nothing animates them otherwise
    const fl = this.inst.fingers || [];
    this.poseBones = [...BONE_NAMES, ...fl.map(F => F.name)].map(n => this.bones[n]);
    this.fingers = fl.map(F => ({ b: this.bones[F.name], side: F.side, finger: F.finger, seg: F.seg, axis: F.axis, spread: F.spread, rest: new THREE.Quaternion() }));
    this.fingerBase = true;
  }
  hasClip() { return false; }
  holdWeapon() {}
  getPose() { return packPose(this.poseBones); }
  setPose(a) { unpackPose(this.poseBones, a); }
  copyPoseFrom(o) { for (const n in this.bones) { this.bones[n].quaternion.copy(o.bones[n].quaternion); this.bones[n].position.copy(o.bones[n].position); } }
  makeGhost(mat) { return new ProcActor(this.src, null, { material: mat }); }
}

// ------------------------------------------------------------------ real skeleton
class SkelActor {
  constructor(src, U, opts) {
    this.src = src;
    const map = src.map;
    this.group = new THREE.Group();
    const norm = new THREE.Group();
    const scene = SkeletonUtils.clone(src.scene);
    norm.add(scene); this.group.add(norm);
    this.scene = scene;
    // measure the real (skinned) rest pose to normalise height & centre
    this.group.updateMatrixWorld(true);
    const meshes = [];
    scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    const box = new THREE.Box3(), v = new THREE.Vector3();
    for (const m of meshes) {
      const n = m.geometry.attributes.position.count;
      for (let i = 0; i < n; i += 3) { m.getVertexPosition(i, v); box.expandByPoint(v.applyMatrix4(m.matrixWorld)); }
    }
    const s = CHAR_HEIGHT / (box.max.y - box.min.y);
    const c = box.getCenter(new THREE.Vector3());
    norm.rotation.y = THREE.MathUtils.degToRad(src.def.rotY || 0);
    norm.scale.setScalar(s); norm.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    this.normScale = s;
    this.group.updateMatrixWorld(true);
    // hand-held weapons (cut out of the model or built-in props), parented to the hand bones
    this.weapons = attachWeapons(scene, map, src.def.skeleton.weapons, U, opts);
    this.held = null;
    // materials + outlines
    // roster skeleton.hide: mesh nodes to drop (e.g. a duplicate untextured shell that z-fights)
    const hide = src.def.skeleton.hide || [];
    for (const m of meshes) {
      if (m.userData.isWeaponSource) continue;
      if (hide.some(n => m.name === n || m.parent?.name === n)) { m.visible = false; continue; }
      const orig = m.material;
      const face = (src.def.skeleton.faces || []).some(n => m.name.includes(n));
      m.material = opts.material || makeToonMaterial(orig, U, { face });
      m.frustumCulled = false;
      const noLine = (src.def.skeleton.noOutline || []).some(n => m.name === n || m.parent?.name === n);
      if (!opts.material && !opts.noOutline && !noLine && m.isSkinnedMesh) {
        const o = new THREE.SkinnedMesh(m.geometry, makeOutlineMaterial(U, (face ? 0.35 : 1) / m.matrixWorld.getMaxScaleOnAxis()));
        o.frustumCulled = false; o.position.copy(m.position); o.quaternion.copy(m.quaternion); o.scale.copy(m.scale);
        m.parent.add(o); o.bind(m.skeleton, m.bindMatrix);
      }
    }
    // our-name -> real bone
    this.bones = {};
    for (const n of BONE_NAMES) { const b = scene.getObjectByName(map[n]); if (!b) throw new Error('Bone not found: ' + map[n]); this.bones[n] = b; }
    // real bones in parent-first order + rest data (char space == group space; group is identity right now)
    this.realBones = [];
    const seen = new Set();
    scene.traverse(o => { if (o.isBone && !seen.has(o)) { seen.add(o); this.realBones.push(o); } });
    const inv = {}; for (const n of BONE_NAMES) inv[map[n]] = n;
    this.rest = new Map();
    const gq = new THREE.Quaternion();
    for (const b of this.realBones) {
      const r = { local: b.quaternion.clone(), world: b.getWorldQuaternion(new THREE.Quaternion()), ours: inv[b.name] };
      if (!b.parent.isBone) r.parentWorld = b.parent.getWorldQuaternion(gq.clone());
      this.rest.set(b, r);
    }
    const pelvis = this.bones.hips;
    this.pelvisRest = pelvis.getWorldPosition(new THREE.Vector3());
    this.pelvisParentInv = pelvis.parent.matrixWorld.clone().invert();
    // virtual auto-rig skeleton built from the REAL joint positions (drives the procedural moves)
    const P = n => this.bones[n].getWorldPosition(new THREE.Vector3());
    const J = {};
    for (const n of BONE_NAMES) J[n] = P(n);
    J.headTop = J.head.clone().add(new THREE.Vector3(0, CHAR_HEIGHT * 0.12, 0));
    for (const sd of ['L', 'R']) {
      J['handTip_' + sd] = J['hand_' + sd].clone().add(J['hand_' + sd].clone().sub(J['foreArm_' + sd]).multiplyScalar(0.35));
      const toe = scene.getObjectByName(map['toe_' + sd]);
      J['toe_' + sd] = toe ? toe.getWorldPosition(new THREE.Vector3()) : J['foot_' + sd].clone().add(new THREE.Vector3(0, -0.05, 0.12));
    }
    this.virt = instantiate({ parts: [], joints: J, corrections: restCorrections(J) }, null, null);
    // props shown while certain clips play (e.g. a throne for a sitting animation)
    this.props = {};
    if (!opts.material) for (const spec of Object.values(src.clips)) if (spec.prop && !this.props[spec.prop] && PROPS[spec.prop]) {
      const p = PROPS[spec.prop](src.def); p.visible = false; this.group.add(p); this.props[spec.prop] = p;
    }
    this.anim = new SkelAnim(this);
    // real finger bones -> hand signs (axes converted into each bone's own rest frame)
    const FJ = {}, fb = {};
    for (const b of this.realBones) { const k = fingerKey(b.name); if (k && !FJ[k]) { FJ[k] = b.getWorldPosition(new THREE.Vector3()); fb[k] = b; } }
    this.fingers = fingerLayout(FJ).map(F => {
      const b = fb[F.key], wq = b.getWorldQuaternion(new THREE.Quaternion()).invert();
      return { b, side: F.side, finger: F.finger, seg: F.seg, axis: F.axis.clone().applyQuaternion(wq).normalize(), spread: F.spread.clone().applyQuaternion(wq).normalize(), rest: b.quaternion.clone() };
    });
  }
  // the mixer only rewrites changed channels: remember the clean pose before we bend fingers on top
  beforeFingers() {
    const A = this.anim;
    if (A.mode === 'clip' && !A.dirty) { this.realBones.forEach((b, i) => { A.pure[i][0].copy(b.quaternion); A.pure[i][1].copy(b.position); }); A.dirty = true; }
  }
  // write the virtual (procedural) pose onto the real skeleton
  retarget() {
    const v = this.virt, W = this._W || (this._W = new Map()), myW = this._myW || (this._myW = {});
    v.group.updateMatrixWorld(true);
    for (const n of BONE_NAMES) (myW[n] || (myW[n] = new THREE.Quaternion())), v.bones[n].getWorldQuaternion(myW[n]);
    const tmp = this._t || (this._t = new THREE.Quaternion());
    for (const b of this.realBones) {
      const r = this.rest.get(b);
      const parentQ = b.parent.isBone ? W.get(b.parent) : r.parentWorld;
      let D = W.get(b) || new THREE.Quaternion();
      if (r.ours) D.copy(myW[r.ours]).multiply(r.world);
      else D.copy(parentQ).multiply(r.local);
      W.set(b, D);
      b.quaternion.copy(tmp.copy(parentQ).invert().multiply(D));
    }
    const delta = v.bones.hips.position.clone().sub(v.rest.hips);
    this.bones.hips.position.copy(this.pelvisRest.clone().add(delta).applyMatrix4(this.pelvisParentInv));
  }
  hasClip(name) { return !!this.src.clips[name]; }
  // weapons visible = the playing clip's weapon(s) + whatever a move asks to hold
  holdWeapon(name) { this.held = name || null; this.updateWeapons(); }
  updateWeapons() {
    const w = this.anim?.real?.weapon;
    for (const k in this.weapons) this.weapons[k].holder.visible = !!(w && w.includes(k)) || this.held === k;
  }
  weaponVis() { let bits = 0, i = 0; for (const k in this.weapons) { if (this.weapons[k].holder.visible) bits |= 1 << i; i++; } return bits; }
  setWeaponVis(bits) { let i = 0; for (const k in this.weapons) { this.weapons[k].holder.visible = !!(bits & (1 << i)); i++; } }
  getPose() { const p = packPose(this.realBones); p.weapons = this.weaponVis(); return p; }
  setPose(a) { unpackPose(this.realBones, a); if (a.weapons != null) this.setWeaponVis(a.weapons); }
  copyPoseFrom(o) { for (let i = 0; i < this.realBones.length; i++) { this.realBones[i].quaternion.copy(o.realBones[i].quaternion); this.realBones[i].position.copy(o.realBones[i].position); } this.setWeaponVis(o.weaponVis()); }
  makeGhost(mat) { return new SkelActor(this.src, null, { material: mat }); }
}

Object.assign(ProcActor.prototype, FingerMixin);
Object.assign(SkelActor.prototype, FingerMixin);

const _e = new THREE.Euler(), _q = new THREE.Quaternion();
class SkelAnim {
  constructor(actor) {
    this.a = actor;
    this.proc = new Animator(actor.virt);
    this.mixer = new THREE.AnimationMixer(actor.scene);
    this.mode = 'proc'; this.flinch = 0; this.flinchDir = 1; this.clip = null;
    this.snap = null; this.fade = 0; this.fadeDur = 0;
    this.real = null; this.action = null; this.rootDelta = 0; this.rootY = null;
    // three's mixer only re-writes a channel when its value CHANGES, so anything we write on top of
    // the clip (crossfade, flinch) must be undone before the next mixer.update, or constant channels stick
    this.pure = actor.realBones.map(b => [b.quaternion.clone(), b.position.clone()]); this.dirty = false;
  }
  takeRootDelta() { const d = this.rootDelta; this.rootDelta = 0; return d; }
  snapshot() {
    this.snap = this.a.realBones.map(b => [b.quaternion.clone(), b.position.clone()]);
  }
  play(clip, { fade = 0.08, speed = 1, restart = true, name } = {}) {
    const real = name && this.a.src.clips[name];
    if (!restart && this.clip === clip) return;
    this.clip = clip;
    for (const k in this.a.props) this.a.props[k].visible = !!(real && real.prop === k);
    this.real = real || null; this.a.updateWeapons();
    if (real) {
      this.snapshot(); this.fade = 0; this.fadeDur = Math.max(fade, 0.06);
      this.mode = 'clip';
      this.mixer.stopAllAction(); this.dirty = false;
      const act = this.mixer.clipAction(real.clip);
      act.reset(); act.setLoop(real.loop ? THREE.LoopRepeat : THREE.LoopOnce); act.clampWhenFinished = true;
      act.timeScale = real.speed * speed;
      act.time = real.speed * speed < 0 ? real.clip.duration : real.from;
      act.play();
      this.real = real; this.action = act;
    } else {
      this.real = null; this.action = null;
      if (this.mode === 'clip') { this.snapshot(); this.fade = 0; this.fadeDur = Math.max(fade, 0.08); this.mixer.stopAllAction(); this.proc.play(clip, { fade: 0, speed, restart }); }
      else this.proc.play(clip, { fade, speed, restart });
      this.mode = 'proc';
    }
  }
  update(dt) {
    const A = this.a;
    if (this.mode === 'clip') {
      const t0 = this.action ? this.action.time : 0;
      if (this.dirty) { A.realBones.forEach((b, i) => { b.quaternion.copy(this.pure[i][0]); b.position.copy(this.pure[i][1]); }); this.dirty = false; }
      this.mixer.update(dt);
      if (this.flinch > 0.001 || (this.snap && this.fade < this.fadeDur)) { A.realBones.forEach((b, i) => { this.pure[i][0].copy(b.quaternion); this.pure[i][1].copy(b.position); }); this.dirty = true; }
      if (this.real?.root && this.action) this.rootDelta += (sampleRoot(this.real.root, this.action.time) - sampleRoot(this.real.root, t0)) * A.normScale;
      this.rootY = this.real?.rootY && this.action ? sampleRoot(this.real.rootY, this.action.time) * A.normScale : null;
      if (this.flinch > 0.001) {
        const f = this.flinch;
        A.bones.chest.quaternion.multiply(_q.setFromEuler(_e.set(-0.44 * f, 0, 0.14 * f * this.flinchDir)));
        A.bones.head.quaternion.multiply(_q.setFromEuler(_e.set(-0.5 * f, 0.17 * f, 0)));
      }
      this.flinch = Math.max(0, this.flinch - dt * 4);
    } else {
      this.rootY = null;
      this.proc.flinch = this.flinch; this.proc.flinchDir = this.flinchDir;
      this.proc.update(dt);
      this.flinch = this.proc.flinch;
      A.retarget();
    }
    if (this.snap && this.fade < this.fadeDur) {
      this.fade += dt;
      const k = Math.min(1, this.fade / this.fadeDur), e = k * k * (3 - 2 * k);
      A.realBones.forEach((b, i) => { b.quaternion.slerpQuaternions(this.snap[i][0], b.quaternion.clone(), e); b.position.lerpVectors(this.snap[i][1], b.position.clone(), e); });
    }
  }
}
