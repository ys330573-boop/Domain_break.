// HOLLOW PURPLE (虚式「茈」) — Gojo's super (O).
//  1. Blackout: the arena vanishes, only Gojo is lit, camera in front of him.
//  2. Blue (蒼, attraction) forms over his left palm, Red (赫, repulsion) over his right.
//  3. Hands come together, the two orbs spiral into each other → Purple.
//  4. The two-finger sign (index + middle out); he flicks the sphere at the opponent.
//  5. It erases everything in its path and cuts the opponent in half at the waist (upper body falls,
//     legs buckle). Survivors get "only a vision" like Toji's beheading.
// Orb shapes come from models/hollow_purple/hollow_purple.glb (red + blue sphere sets);
// built-in spheres are used if the file is missing.
import * as THREE from 'three';
import { loadGLB } from './rig.js';
import { sfx } from './audio.js';
import { say } from './voice.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const PURPLE_GLB = 'models/hollow_purple/hollow_purple.glb';

// ------------------------------------------------------------------ orb meshes
let TPL = null;
export function preloadPurple() {
  return loadGLB(PURPLE_GLB).then(g => { TPL = buildTemplates(g.scene); })
    .catch(e => console.warn('hollow purple model missing, using built-in orbs', e));
}
// split the model into its red and blue sphere sets, each centred and scaled to radius 1,
// sorted [core, swirl, shell] by size
function buildTemplates(scene) {
  scene.updateMatrixWorld(true);
  const sets = { red: [], blue: [] };
  scene.traverse(o => {
    if (!o.isMesh) return;
    const e = o.material.emissive && o.material.emissive.getHex() ? o.material.emissive : o.material.color;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    g.computeBoundingSphere();
    (e.r > e.b ? sets.red : sets.blue).push(g);
  });
  for (const k in sets) {
    const L = sets[k]; if (L.length < 3) return null;
    const c = V(); L.forEach(g => c.add(g.boundingSphere.center)); c.divideScalar(L.length);
    L.forEach(g => g.translate(-c.x, -c.y, -c.z));
    L.forEach(g => g.computeBoundingSphere());
    const R = Math.max(...L.map(g => g.boundingSphere.radius));
    L.forEach(g => { g.scale(1 / R, 1 / R, 1 / R); g.computeBoundingSphere(); g.userData.shared = true; });
    L.sort((a, b) => a.boundingSphere.radius - b.boundingSphere.radius);
  }
  return sets;
}
let FALLBACK = null;
function fallbackGeos() {
  if (!FALLBACK) {
    FALLBACK = [new THREE.IcosahedronGeometry(0.62, 3), new THREE.IcosahedronGeometry(0.8, 2), new THREE.SphereGeometry(1, 28, 18)];
    FALLBACK.forEach(g => { g.userData.shared = true; });
  }
  return FALLBACK;
}

const ORB_VS = `varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const ORB_FS = `uniform vec3 uColor; uniform vec3 uHot; uniform float uTime; uniform float uMode; uniform float uAmt;
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main(){
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    vec3 c; float a = 1.0;
    if (uMode < 0.5) {          // core: white-hot centre fading to the colour at the edge
      c = mix(uHot, uColor, smoothstep(0.2, 0.8, f));
    } else if (uMode < 1.5) {   // swirl: bright streaks racing round the surface
      float s = (sin(vP.y * 11.0 + atan(vP.z, vP.x) * 3.0 + uTime * 9.0) * 0.5 + 0.5)
              * (sin(vP.x * 7.0 + vP.z * 5.0 - uTime * 5.0) * 0.5 + 0.5);
      a = smoothstep(0.2, 0.65, s) * (0.4 + 0.6 * f); c = mix(uColor, uHot, s * 0.7) * 1.5;
    } else {                    // shell: fresnel glow
      a = pow(f, 2.0) * 0.95; c = uColor * 1.4;
    }
    gl_FragColor = vec4(c, a * uAmt);
  }`;
const ORB_COLORS = { blue: ['#2f7dff', '#e8f7ff'], red: ['#ff1f35', '#fff0ea'], purple: ['#9a35ff', '#fbf2ff'] };

// a glowing orb of radius 1 (scale the group); group.userData.tick(dt) animates it
export function makeOrb(fx, kind) {
  const [col, hot] = ORB_COLORS[kind];
  const grp = new THREE.Group(), mats = [], layers = [];
  const geos = TPL ? (kind === 'blue' ? TPL.blue : TPL.red) : fallbackGeos();
  const add = (geo, mode, scale = 1) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(col) }, uHot: { value: new THREE.Color(hot) }, uTime: { value: Math.random() * 10 }, uMode: { value: mode }, uAmt: { value: 1 } },
      vertexShader: ORB_VS, fragmentShader: ORB_FS, transparent: mode > 0.5, depthWrite: mode < 0.5,
      blending: mode > 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending, side: mode === 1 ? THREE.DoubleSide : THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(geo, m); mesh.scale.setScalar(scale); mesh.renderOrder = 5; mesh.frustumCulled = false;
    grp.add(mesh); layers.push(mesh); mats.push(m); return mesh;
  };
  add(geos[0], 0, 1); add(geos[1], 1, 1); add(geos[2], 2, 1.08);
  if (kind === 'purple') { const s2 = add((TPL ? TPL.blue : geos)[1], 1, 1.04); s2.rotation.set(1, 2, 0.5); }
  const halo = fx.sprite('glow', col, 2.5, V()); halo.material.opacity = 0.8; halo.renderOrder = 4; grp.add(halo);
  grp.userData = {
    layers, mats, halo,
    tick(dt) {
      for (const m of mats) m.uniforms.uTime.value += dt;
      layers[1].rotation.y += dt * 2.6; layers[1].rotation.x += dt * 1.2;
      layers[2].rotation.y -= dt * 0.7;
      if (layers[3]) { layers[3].rotation.y -= dt * 3.2; layers[3].rotation.z += dt * 1.6; }
      halo.material.rotation += dt * 0.8;
      halo.material.opacity = 0.7 + Math.random() * 0.15;
    },
  };
  return grp;
}
function disposeOrb(o) { if (!o) return; o.removeFromParent(); o.traverse(c => { if (c.material) c.material.dispose(); }); }

// ------------------------------------------------------------------ helpers
// a point just above the palm / beyond the extended fingers (finger bones when the rig has them)
function fingerBone(f, side, finger, seg) { return f.actor.fingers?.find(x => x.side === side && x.finger === finger && x.seg === seg)?.b; }
function palm(f, side) {
  const h = f.boneWorld('hand_' + side), e = f.boneWorld('foreArm_' + side);
  const m = fingerBone(f, side, 'middle', 1);
  return m ? h.lerp(m.getWorldPosition(V()), 0.7) : h.addScaledVector(h.clone().sub(e).normalize(), 0.08);
}
function fingertip(f) {
  const h = f.boneWorld('hand_R'), e = f.boneWorld('foreArm_R'), dir = h.clone().sub(e).normalize();
  const t = fingerBone(f, 'R', 'middle', 3) || fingerBone(f, 'R', 'index', 3);
  return t ? t.getWorldPosition(V()).addScaledVector(dir, 0.05) : h.addScaledVector(dir, 0.18);
}
// the direction a fighter's body faces (3/4 towards the camera, like the model's turn)
const frontOf = (f, a = 0.42) => V(Math.cos(a) * f.facing, 0, Math.sin(a));

// everything but the caster goes black (arena hidden, opponent a black silhouette), own lights
function blackout(f, g, on) {
  const o = f.opp, S = f._hp;
  if (on && !S.bo) {
    const L = new THREE.Group();
    const hemi = new THREE.HemisphereLight('#c9b8ff', '#12061f', 1.0);
    const key = new THREE.DirectionalLight('#ffffff', 2.1);
    key.position.copy(f.pos).add(frontOf(f, 0.9).multiplyScalar(5)).add(V(0, 3, 0)); key.target.position.copy(f.pos).add(V(0, 1, 0));
    const rim = new THREE.DirectionalLight('#b47aff', 2.6);
    rim.position.copy(f.pos).add(frontOf(f, 0.42).multiplyScalar(-4)).add(V(0, 2.5, -2)); rim.target.position.copy(f.pos).add(V(0, 1, 0));
    const blue = new THREE.PointLight('#3f8cff', 0, 3.5, 1.4), red = new THREE.PointLight('#ff2a3a', 0, 3.5, 1.4);
    L.add(hemi, key, key.target, rim, rim.target, blue, red);
    g.scene.add(L);
    S.bo = { L, blue, red, bg: g.scene.background, fog: g.scene.fog, stage: g.stage.group.visible };
    g.stage.setVisible(false); g.scene.background = new THREE.Color('#000000'); g.scene.fog = null;
    o.U.uSilColor.value.set('#000000'); o.U.uSilhouette.value = 1;
    g.hud.setVisible(false); g.post.letterbox = true;
  } else if (!on && S.bo) {
    const B = S.bo; S.bo = null;
    B.L.removeFromParent();
    if (!g.domainEnv) { g.stage.setVisible(B.stage); g.scene.background = B.bg; g.scene.fog = B.fog; }
    o.U.uSilhouette.value = 0;
  }
}

// ------------------------------------------------------------------ the move
const SIGN_OPEN = { R: { all: 0.12, thumb: 0.05 }, L: { all: 0.12, thumb: 0.05 } };
const SIGN_JOIN = { R: { all: 0.35 }, L: { all: 0.35 } };
const SIGN_PURPLE = { R: { index: 0, middle: 0, ring: 1, little: 1, thumb: 0.9 }, L: { all: 0.55, thumb: 0.4 } };
const T_BLUE = 0.15, T_RED = 0.95, T_JOIN = 1.75, T_MERGE = 2.35, T_SIGN = 2.5, T_FIRE = 3.15;

export const HOLLOW_PURPLE = {
  name: 'HOLLOW PURPLE', jp: '虚式「茈」', clip: 'purpleOpen', dur: 9, cost: 60, super: true, friction: 20,
  start(f, g) {
    f._hp = { t: 0, fired: new Set(), orbs: {}, hit: false, hitT: 0, done: false };
    f.vel.set(0, 0, 0);
    g.freeze = { f, t: 99 };                     // the opponent is frozen until the sphere arrives
    blackout(f, g, true);
    g.post.grade({ sat: 1.15, contrast: 1.2, halftone: 0.35 });
    g.hud.cutin(f, 'HOLLOW PURPLE', g.portraits?.[f.def.id]);
    f.actor.setFingers?.(SIGN_OPEN, 0.25);
    sfx('charge'); sfx('domain', 0.2);
    const line = f.def.lines?.purple || { jp: '順転「蒼」、反転「赫」…虚式「茈」', en: 'Blue… Red… Hollow technique: Purple.' };
    say(f.def, 'purple', line); g.hud.dialog(f, line, 3600);
    // shot A: in front of him, both palms in frame, slow push in
    const ch = f.boneWorld('chest'), fr = frontOf(f, 0.62);
    g.cam.setShot(t => ({ pos: ch.clone().add(fr.clone().multiplyScalar(2.6 - Math.min(t, 1.6) * 0.35)).add(V(0, 0.08, 0)), look: ch.clone().add(V(0, 0.08, 0)), fov: 36, roll: 0 }), 0);
  },
  update(f, g, dt) {
    const S = f._hp; if (!S) return;
    const rdt = dt / Math.max(0.01, g.timeScale);   // real seconds (dt arrives scaled by our own ramp)
    S.t += dt; const t = S.t;
    if (S.ramp) runRamp(g, S, rdt);
    const once = (k, fn) => { if (!S.fired.has(k)) { S.fired.add(k); fn(); } };
    const O = S.orbs, fx = g.fx;
    for (const k in O) if (O[k] && !(k === 'purple' && S.proj)) O[k].userData.tick(dt);
    // ---- blue (left palm): particles pulled in
    if (t > T_BLUE) once('blue', () => {
      O.blue = makeOrb(fx, 'blue'); O.blue.scale.setScalar(0.001); g.scene.add(O.blue);
      sfx('orb'); g.post.flash(0.1, '#2f7dff', 0.35);
      const p = palm(f, 'L'); g.hud.pop('蒼', g.cam.project(p.clone().add(V(0, 0.35, 0))), '#7cc8ff', 1.5);
    });
    if (O.blue && !S.merged) {
      const k = Math.min(1, (t - T_BLUE) / 0.5), r = 0.13 * (1 - Math.pow(1 - k, 3)) * (1 + Math.sin(t * 40) * 0.04);
      if (t < T_JOIN) O.blue.position.copy(palm(f, 'L')).add(V(0, 0.12, 0.02));
      O.blue.scale.setScalar(Math.max(0.001, r));
      if (Math.random() < 0.7) { const d = V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(0.5 + Math.random() * 0.4);
        fx.glow.emit({ pos: O.blue.position.clone().add(d), vel: d.clone().multiplyScalar(-2.4), t: 0, life: 0.38, s0: 0.02, s1: 0.05, c: new THREE.Color('#8fd0ff'), r: 0 }); }
      if (S.bo) { S.bo.blue.position.copy(O.blue.position); S.bo.blue.intensity = 3 * k; }
    }
    // ---- red (right palm): sparks pushed out
    if (t > T_RED) once('red', () => {
      O.red = makeOrb(fx, 'red'); O.red.scale.setScalar(0.001); g.scene.add(O.red);
      sfx('orb'); sfx('spark'); g.post.flash(0.1, '#ff1f35', 0.35); g.cam.shake(0.15);
      const p = palm(f, 'R'); g.hud.pop('赫', g.cam.project(p.clone().add(V(0, 0.35, 0))), '#ff6b6b', 1.5);
    });
    if (O.red && !S.merged) {
      const k = Math.min(1, (t - T_RED) / 0.45), r = 0.13 * (1 - Math.pow(1 - k, 3)) * (1 + Math.sin(t * 47) * 0.05);
      if (t < T_JOIN) O.red.position.copy(palm(f, 'R')).add(V(0, 0.12, 0.02));
      O.red.scale.setScalar(Math.max(0.001, r));
      if (Math.random() < 0.6) { const d = V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        fx.sparks.emit({ pos: O.red.position.clone().addScaledVector(d, 0.1), vel: d.multiplyScalar(2.5 + Math.random() * 2), t: 0, life: 0.3, s0: 0.05, s1: 0.01, c: new THREE.Color('#ff5a5a'), r: Math.random() * 6, drag: 3 }); }
      if (S.bo) { S.bo.red.position.copy(O.red.position); S.bo.red.intensity = 3 * k; }
    }
    // ---- hands together, the orbs spiral into each other
    if (t > T_JOIN) once('join', () => {
      f.setAnim('purpleJoin', 0.25); f.actor.setFingers?.(SIGN_JOIN, 0.2);
      S.b0 = O.blue.position.clone(); S.r0 = O.red.position.clone();
      const ch = f.boneWorld('chest').lerp(f.boneWorld('head'), 0.45), fr = frontOf(f, 0.55);
      g.cam.setShot(tt => ({ pos: ch.clone().add(fr.clone().multiplyScalar(2.0 - tt * 0.3)).add(V(0, 0.02, 0)), look: ch.clone(), fov: 32, roll: f.facing * 0.04 }), 0);
      sfx('charge'); g.post.speed(0.6, 0.6, '#ffffff', g.cam.project(ch));
    });
    if (t > T_JOIN && !S.merged) {
      const k = Math.min(1, (t - T_JOIN) / (T_MERGE - T_JOIN)), e = k * k;
      const c = palm(f, 'L').lerp(palm(f, 'R'), 0.5).add(V(0, 0.04, 0)).addScaledVector(frontOf(f), 0.14);
      const mid = S.b0.clone().lerp(S.r0, 0.5).lerp(c, Math.min(1, k * 1.6));
      const half = S.b0.distanceTo(S.r0) * 0.5 * (1 - e), ang = k * 11;
      const ax = frontOf(f, 0.42 + Math.PI / 2).multiplyScalar(Math.cos(ang) * half).add(V(0, Math.sin(ang) * half * 0.6, 0));
      O.blue.position.copy(mid).add(ax); O.red.position.copy(mid).sub(ax);
      if (Math.random() < 0.8) { const q = O.blue.position.clone().lerp(O.red.position, Math.random()), d = V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        fx.sparks.emit({ pos: q, vel: d.multiplyScalar(1.5), t: 0, life: 0.18, s0: 0.04, s1: 0.01, c: new THREE.Color(Math.random() < 0.5 ? '#ffffff' : '#c27dff'), r: Math.random() * 6 }); }
      S.mid = mid;
    }
    // ---- merge: Purple
    if (t > T_MERGE) once('merge', () => {
      S.merged = true;
      disposeOrb(O.blue); disposeOrb(O.red); O.blue = O.red = null;
      O.purple = makeOrb(fx, 'purple'); O.purple.position.copy(S.mid); O.purple.scale.setScalar(0.12); g.scene.add(O.purple);
      if (S.bo) { S.bo.blue.color.set('#a24bff'); S.bo.blue.intensity = 4; S.bo.red.intensity = 0; }
      fx.flash(S.mid, '#ffffff', 1.2, 0.18); fx.flash(S.mid, '#a24bff', 2.2, 0.4); fx.ring(S.mid, '#d9a6ff', 1.6, 0.3);
      fx.burstParticles(S.mid, '#d9a6ff', 24, 4, 0.05, 0.45);
      g.post.flash(0.1, '#ffffff', 0.55); g.post.impact(0.05, 2); g.post.chroma(0.25, 1); g.cam.shake(0.35);
      g.hud.domainTitle('HOLLOW PURPLE', '虚式「茈」', '#b26bff');
      ramp(S, g, [[0, 0.2], [0.5, 0.2], [0.9, 1]]);
      sfx('boom'); sfx('beam');
    });
    // ---- the signature: arm out, two fingers up, the sphere hangs in front of them
    if (t > T_SIGN) once('sign', () => {
      f.setAnim('purpleSign', 0.18); f.actor.setFingers?.(SIGN_PURPLE, 0.15);
      g.post.flash(0.08, '#ffffff', 0.4); sfx('whoosh');
      // side-front close-up: hand + sphere in the foreground, his face behind
      const side = V(0, 0, 1).addScaledVector(frontOf(f), -frontOf(f).z).normalize();
      g.cam.setShot(tt => {
        const h = f.boneWorld('hand_R'), hd = f.boneWorld('head');
        const look = h.clone().lerp(hd, 0.35).addScaledVector(frontOf(f), 0.12);
        return { pos: look.clone().addScaledVector(side, 1.5 + tt * 0.25).addScaledVector(frontOf(f), 0.45).add(V(0, -0.06, 0)), look, fov: 34, roll: -f.facing * 0.05 };
      }, 0.12);
    });
    if (O.purple && !S.proj) {
      const k = Math.min(1, (t - T_MERGE) / 0.4);
      O.purple.scale.setScalar(0.12 + 0.06 * k + Math.sin(t * 50) * 0.006);
      if (t > T_SIGN) {
        const want = fingertip(f).addScaledVector(frontOf(f, 0.2), 0.2).add(V(0, 0.03, 0));
        O.purple.position.lerp(want, 1 - Math.exp(-dt * 14));
      }
      if (S.bo) S.bo.blue.position.copy(O.purple.position);
      if (Math.random() < 0.5) { const d = V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        fx.glow.emit({ pos: O.purple.position.clone().addScaledVector(d, 0.6), vel: d.multiplyScalar(-1.8), t: 0, life: 0.3, s0: 0.02, s1: 0.05, c: new THREE.Color(Math.random() < 0.5 ? '#c27dff' : '#ffffff'), r: 0 }); }
    }
    // ---- fire
    if (t > T_FIRE) once('fire', () => fire(f, g));
    if (S.proj && !S.hit) {
      S.fireReal += rdt;
      // second angle: from behind the opponent, the sphere swelling towards them
      if (S.fireReal > 0.3) once('incoming', () => {
        const o = f.opp, dir = f.facing, P = S.proj, look = P.pos.clone();
        g.cam.setShot(tt => { look.lerp(P.pos, 0.25); return { pos: V(o.pos.x + dir * (2.4 + tt * 0.3), 1.0, 1.7), look: look.clone().add(V(0, 0.05, 0)), fov: 40, roll: -dir * 0.06 }; }, 0);
        g.post.speed(0.8, 0.9, '#e9c8ff');
      });
    }
    if (S.hit) {
      S.hitT += dt; S.hitReal += rdt;
      const o = f.opp, dir = S.dir;
      // 2) follow the upper body as it falls
      if (S.hitReal > 1.1) once('fall', () => {
        const camLook = S.cut.clone();
        g.cam.setShot(() => { const h = o.decap ? o.decap.headPos() : S.cut; camLook.lerp(h, 0.08); return { pos: camLook.clone().add(V(-dir * 1.3, 0.85, 3.9)), look: camLook.clone().add(V(0, 0.25, 0)), fov: 36, roll: dir * 0.04 }; }, 0.35);
      });
      // 3) wide: Gojo, the two halves and the erased trench
      if (S.hitReal > 2.5) once('wide', () => {
        const mid = (f.pos.x + o.pos.x) / 2;
        g.cam.setShot(tt => ({ pos: V(mid - dir * 0.6, 1.6 + tt * 0.1, 7.2 + tt * 0.5), look: V(mid + dir * 0.6, 0.95, 0), fov: 34, roll: 0 }), 0.4);
      });
      if (S.hitReal > 3.6) finish(f, g);
    } else if (S.projDead && t > T_FIRE + 0.2) finish(f, g);
    if (t > 7.5) finish(f, g);
  },
  end(f, g) { cleanup(f, g); },
};

function fire(f, g) {
  const S = f._hp, P = S.orbs.purple;
  blackout(f, g, false);
  g.post.grade({});
  g.post.flash(0.12, '#ffffff', 0.6); g.post.speed(0.6, 0.8, '#e9c8ff'); g.post.chroma(0.25, 1); g.cam.shake(0.5);
  sfx('beam'); sfx('boom'); f.vel.x = -2.5 * f.facing;   // recoil
  S.fireReal = 0;
  ramp(S, g, [[0, 0.1], [0.35, 0.1], [0.7, 0.28], [1.4, 0.28], [1.9, 1]]);   // the flick in slow motion
  const dir = f.facing, start = P.position.clone(); start.z = 0.1;
  let crackT = 0;
  S.proj = g.spawnProjectile({
    owner: f, pos: start, vel: V(dir * 19, 0, 0), obj: P, life: 2.4, radius: 1.0, hits: 99, interval: 9,
    hit: { dmg: 300, kb: 0.8, kind: 'heavy', hitstop: 0.16, impact: true, impactMode: 2, unblockable: true, chip: 0.5, color: '#b26bff' },
    update(p, dt) {
      P.userData.tick(dt);
      const r = 0.3 + 1.0 * Math.min(1, p.t / 0.3);
      p.radius = 0.35 + 0.65 * Math.min(1, p.t / 0.3);          // hit size grows with the sphere
      p.vel.x = dir * Math.min(19, 7 + p.t * 45);                 // starts slow, then rushes
      P.scale.setScalar(r * (1 + Math.sin(p.t * 60) * 0.02));
      p.pos.y += (1.25 - p.pos.y) * Math.min(1, dt * 6);
      p.pos.z += (0 - p.pos.z) * Math.min(1, dt * 6);
      // erasing everything it passes: violet debris streaming into its wake, scorched trench
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * 6.28, rr = r * (0.9 + Math.random() * 0.4);
        g.fx.glow.emit({ pos: p.pos.clone().add(V(-dir * Math.random() * 0.6, Math.cos(a) * rr, Math.sin(a) * rr * 0.6)), vel: V(-dir * (3 + Math.random() * 5), (Math.random() - 0.5) * 1.5, 0), t: 0, life: 0.4, s0: 0.07, s1: 0.01, c: new THREE.Color(Math.random() < 0.6 ? '#b26bff' : '#f2e6ff'), r: 0 });
      }
      crackT -= dt; if (crackT <= 0) { crackT = 0.07; g.fx.groundCrack(V(p.pos.x, 0, 0), 1.1, 2.5); }
      g.cam.shake(0.04);
    },
    onHit(p, tgt) { cutInHalf(f, g, tgt); },
    onEnd(p) { // far away: the sphere bursts
      g.fx.flash(p.pos, '#ffffff', 4, 0.3); g.fx.flash(p.pos, '#a24bff', 9, 0.8); g.fx.ring(p.pos, '#d9a6ff', 7, 0.6);
      g.fx.shockwave(V(p.pos.x, 0.05, 0), '#b26bff', 7); sfx('boom'); g.cam.shake(0.3);
      S.projDead = true; S.orbs.purple = null; P.traverse(c => { if (c.material) c.material.dispose(); }); },
  });
  // over-the-shoulder: the sphere flies away from him into the opponent
  const gp = f.pos.clone(), proj = S.proj, look = proj.pos.clone();
  g.cam.setShot(() => { look.lerp(proj.pos, 0.2); return { pos: V(gp.x - dir * 1.9, 1.75, 2.6), look: look.clone().add(V(0, 0.1, 0)), fov: 38, roll: dir * 0.03 }; }, 0);
}

// the sphere hits: the upper body is erased from the waist, falls; the legs buckle
function cutInHalf(f, g, o) {
  const S = f._hp; if (!S || S.hit) return;
  S.hit = true; S.hitT = 0; S.hitReal = 0;
  if (g.freeze?.f === f) g.freeze = null;
  const dir = Math.sign(o.pos.x - f.pos.x) || f.facing;
  o.behead(f, 'waist');
  o.vel.set(dir * 0.6, Math.min(0, o.vel.y), 0);
  if (o.hp <= 0) o.setState('ko'); else { o.setState('hit'); o.stun = 1.5; }
  o.setAnim('hitH', 0.03);
  const cut = o.boneWorld('spine'); S.cut = cut.clone(); S.dir = dir;
  if (g.phase === 'ko') g.phaseT -= 1.6;          // let the whole slow-motion play before the KO replay
  const line = cut.clone().setZ(0.6);
  g.fx.slashLine(line, 0, 4.5, '#ffffff', 0.9, 0.05); g.fx.inkSlash(line, 0, 3.2, 0.8);
  g.fx.shockwave(V(o.pos.x, 0.05, 0), '#b26bff', 5);
  g.fx.burstParticles(V(o.pos.x, 0.1, 0), '#e3c4ff', 20, 5, 0.05, 1.2, 'sparks', { grav: 6 });
  g.fx.flash(cut, '#ffffff', 3, 0.2); g.fx.flash(cut, '#a24bff', 6, 0.6);
  g.fx.burstParticles(cut, '#c27dff', 30, 6, 0.07, 0.6, 'glow', { grav: 4 });
  g.fx.ring(cut, '#e3c4ff', 3, 0.35);
  g.post.flash(0.14, '#ffffff', 0.7); g.post.impact(0.1, 2); g.post.chroma(0.3, 1.4); g.cam.shake(0.8);
  g.hud.pop('消', g.cam.project(cut.clone().add(V(0, 0.6, 0))), '#d9a6ff', 1.8);
  sfx('spark'); sfx('boom');
  // near-frozen moment, then time slowly comes back (real seconds)
  ramp(S, g, [[0, 0.04], [0.45, 0.04], [1.4, 0.1], [2.6, 0.22], [3.4, 1]]);
  o.U.uFlash.value = 0.25;                         // no long white flash while time is nearly frozen
  // 1) slow orbit round the cut
  const c = cut.clone();
  g.cam.setShot(tt => { const a = -0.75 + tt * 0.5; return { pos: c.clone().add(V(-dir * Math.sin(a) * 2.3, 0.25 - tt * 0.05, Math.cos(a) * 2.3)), look: c.clone().add(V(0, 0.1, 0)), fov: 38, roll: dir * 0.05 }; }, 0);
}

// speed ramp in REAL seconds: keys [[t, timeScale], ...]; owns g.timeScale while it runs
function ramp(S, g, keys) { S.ramp = { t: 0, keys }; runRamp(g, S, 0); }
function runRamp(g, S, rdt) {
  const R = S.ramp, K = R.keys; R.t += rdt;
  let v = K[K.length - 1][1];
  for (let i = 1; i < K.length; i++) if (R.t <= K[i][0]) { const a = K[i - 1], b = K[i], k = (R.t - a[0]) / Math.max(1e-4, b[0] - a[0]); v = a[1] + (b[1] - a[1]) * k * k * (3 - 2 * k); break; }
  g.timeScale = v; g.slowT = 0;
  if (R.t >= K[K.length - 1][0]) { S.ramp = null; g.timeScale = 1; }
}

function finish(f, g) {
  const S = f._hp; if (!S || S.done) return;
  S.done = true;
  if (g.phase === 'fight') { g.cam.clearShot(0.4); g.post.grade({}); }
  f.moveT = 1e3; // ends the move next frame (end() cleans up)
}

function cleanup(f, g) {
  const S = f._hp; if (!S) return;
  blackout(f, g, false); f._hp = null;
  if (S.ramp) { S.ramp = null; g.timeScale = 1; }
  if (g.freeze?.f === f) g.freeze = null;
  f.actor.setFingers?.(null, 0.25);
  for (const k of ['blue', 'red']) disposeOrb(S.orbs[k]);
  if (S.orbs.purple && !S.proj) disposeOrb(S.orbs.purple);
  if (g.phase === 'fight') { g.hud.setVisible(true); g.post.letterbox = false; if (!S.done) { g.cam.clearShot(0.3); g.post.grade({}); } }
}
