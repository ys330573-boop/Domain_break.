// Gojo's domain (type 'void') — an infinite-void style cinematic:
//  0. face close-up: he pulls the blindfold off (the fighter swaps to def.domainForm), the cloth flies away
//  A. calm close-up, he raises the crossed-finger sign; the world goes black around him (only Gojo lit)
//  B. a white point behind him bursts open → an endless cosmic void (galaxy core, star field, light
//     streams of "information" rushing past); the camera pulls far back, both fighters tiny, floating
//  C. the opponent is paralysed — light pours into their head, the screen floods with text; Gojo walks
//     slowly up to them
//  D. he lays his hand on their head → white-out → the domain shatters, the victim is launched
// Called from DomainSequence (src/domain.js) for type 'void'.
import * as THREE from 'three';
import { sfx } from './audio.js';
import { say } from './voice.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const NOISE = `
float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*n3(p); p*=2.03; a*=0.5; } return s; }`;

// ------------------------------------------------------------------ the world
export function buildInfiniteVoid() {
  const g = new THREE.Group(); const u = { uTime: { value: 0 } };
  // sky: spiral galaxy core straight behind the arena, nebula, two star layers, radial light streaks
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 64, 32), new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: NOISE + `uniform float uTime; varying vec3 vP;
      void main(){
        vec3 p = normalize(vP);
        vec3 C = normalize(vec3(0.0, 0.1, -1.0));
        float d = acos(clamp(dot(p, C), -1.0, 1.0));
        vec3 X = normalize(cross(vec3(0.0, 1.0, 0.0), C)), Y = cross(C, X);
        float a = atan(dot(p, Y), dot(p, X));
        float neb = fbm(p * 3.2 + vec3(uTime * 0.02));
        float arms = sin(a * 2.0 + log(d + 0.03) * 5.5 - uTime * 0.35);
        float arm = smoothstep(0.25, 1.0, arms) * smoothstep(1.5, 0.06, d) * (0.6 + 0.6 * neb);
        vec3 c = vec3(0.003, 0.005, 0.018);
        c += vec3(0.10, 0.16, 0.48) * neb * neb * 1.6 * smoothstep(2.2, 0.2, d);
        c += mix(vec3(0.45, 0.25, 1.0), vec3(0.55, 0.95, 1.0), neb) * arm;
        c += vec3(1.0) * exp(-d * 10.0) * 2.2;                 // white core
        c += vec3(0.6, 0.85, 1.0) * exp(-d * 2.6) * 0.4;       // halo
        c += vec3(0.85, 0.95, 1.0) * smoothstep(0.01, 0.0, abs(d - 0.42 - 0.015 * sin(uTime * 0.7))) * 0.5;
        c += vec3(0.6, 0.8, 1.0) * smoothstep(0.008, 0.0, abs(d - 0.78)) * 0.25;
        float s = h(floor(p * 420.0)); c += vec3(1.0) * step(0.991, s) * (0.55 + 0.45 * sin(uTime * 3.0 + s * 60.0));
        c += vec3(0.7, 0.85, 1.0) * step(0.997, h(floor(p * 160.0) + 3.0));
        // light streaks racing out of the core
        float lane = floor(a * 110.0);
        float run = fract(d * 1.3 - uTime * 0.7 + h(vec3(lane, 1.0, 0.0)));
        c += vec3(0.75, 0.9, 1.0) * step(0.955, h(vec3(lane, 0.0, 0.0))) * smoothstep(0.0, 0.05, run) * smoothstep(0.4, 0.05, run) * smoothstep(0.08, 0.5, d) * 0.9;
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  sky.renderOrder = -10; g.add(sky);
  // faint mirror floor: rings rippling out from the caster
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 96), new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vU; void main(){ vU = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vU; void main(){ float r = length(vU);
      float ring = smoothstep(0.0, 0.035, abs(fract(r * 0.35 - uTime * 0.25) - 0.5) - 0.465);
      vec3 c = mix(vec3(0.0, 0.006, 0.025), vec3(0.75, 0.92, 1.0), ring * 0.8);
      gl_FragColor = vec4(c, (0.7 + ring * 0.3) * smoothstep(60.0, 6.0, r)); }` }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; g.add(floor);
  // information streams: light streaks flowing out of the galaxy core past the camera
  const N = 900, pos = new Float32Array(N * 2 * 3), seed = new Float32Array(N * 2 * 4);
  for (let i = 0; i < N; i++) {
    const a = rand(0, Math.PI * 2), r = rand(2.5, 26), ph = Math.random(), sp = rand(0.12, 0.35);
    for (let e = 0; e < 2; e++) seed.set([a, r, ph, e ? sp : -sp], (i * 2 + e) * 4);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); lg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const streams = new THREE.LineSegments(lg, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime; attribute vec4 aSeed; varying float vA;
      void main(){
        float sp = abs(aSeed.w), uu = fract(aSeed.z + uTime * sp);
        float k = (aSeed.w > 0.0) ? uu : max(0.0, uu - 0.035 - sp * 0.05);
        vec3 S = vec3(0.0, 5.0, -80.0), E = vec3(cos(aSeed.x) * aSeed.y, sin(aSeed.x) * aSeed.y * 0.55 + 1.5, 16.0);
        vec3 P = mix(S, E, k * k);
        vA = smoothstep(0.0, 0.25, uu) * smoothstep(1.0, 0.8, uu);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(P, 1.0); }`,
    fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(vec3(0.8, 0.93, 1.0) * vA, vA); }` }));
  streams.frustumCulled = false; g.add(streams);
  g.userData = { u, fog: null, bg: '#000004', light: '#e4f3ff', amb: '#5a6ad0', grade: { sat: 1.2, contrast: 1.18, tint: '#eef6ff', halftone: 0.2 } };
  return g;
}

// ------------------------------------------------------------------ helpers
const SIGN_CROSS = { R: { index: 0.05, middle: 0.12, ring: 1, little: 1, thumb: 0.95, spread: { middle: 0.32, index: -0.08 } }, L: { all: 0.35 } };
const HAND_OPEN = { R: { all: 0.18, thumb: 0.1 }, L: { all: 0.3 } };
const front = (f, a = 0.42) => V(Math.cos(a) * f.facing, 0, Math.sin(a));

function blackout(S, g, c, o, on) {
  if (on && !S.bo) {
    const L = new THREE.Group();
    const hemi = new THREE.HemisphereLight('#bcd4ff', '#05060f', 0.9);
    const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.copy(c.pos).add(front(c, 0.9).multiplyScalar(5)).add(V(0, 3, 0)); key.target.position.copy(c.pos).add(V(0, 1.2, 0));
    const rim = new THREE.DirectionalLight('#7fe3ff', 2.8); rim.position.copy(c.pos).add(front(c).multiplyScalar(-4)).add(V(0, 2.5, -2)); rim.target.position.copy(c.pos).add(V(0, 1.2, 0));
    L.add(hemi, key, key.target, rim, rim.target); g.scene.add(L);
    S.bo = { L, bg: g.scene.background, fog: g.scene.fog };
    g.stage.setVisible(false); g.scene.background = new THREE.Color('#000000'); g.scene.fog = null;
    o.U.uSilColor.value.set('#000000'); o.U.uSilhouette.value = 1;
  } else if (!on && S.bo) {
    S.bo.L.removeFromParent(); g.scene.background = S.bo.bg; g.scene.fog = S.bo.fog; g.stage.setVisible(true);
    o.U.uSilhouette.value = 0; S.bo = null;
  }
}
// screen flooded with text (the victim perceiving everything at once)
const GLYPHS = '無限情報知覚空処虚式術領域展開天上天下唯我独尊永遠一瞬全宇宙光星時間止停止認識不能0123456789';
function floodEl() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40;overflow:hidden;font-family:"Yuji Syuku",serif;color:#eaf6ff;mix-blend-mode:screen;opacity:0;transition:opacity .25s;white-space:pre;line-height:1.05;letter-spacing:.08em;font-size:3.2vh;text-shadow:0 0 6px #7fe3ff';
  document.body.appendChild(el); return el;
}
function floodText() {
  let s = '';
  for (let r = 0; r < 32; r++) { const n = 20 + (Math.random() * 40 | 0); for (let i = 0; i < n; i++) s += Math.random() < 0.18 ? ' ' : GLYPHS[Math.random() * GLYPHS.length | 0]; s += '\n'; }
  return s;
}

// ------------------------------------------------------------------ the cinematic (seq = DomainSequence)
export function startInfiniteVoid(seq) {
  const g = seq.g, c = seq.c;
  seq.S = {};
  const form = (c.baseSrc || c.rigged).form;
  seq.PRE = form ? 1.5 : 0;                       // blindfold removal only when there is an unmasked model
  if (form) c.setAnim('maskOff', 0.25); else { c.setAnim('voidSign', 0.35); c.actor.setFingers?.(SIGN_CROSS, 0.3); }
  g.post.grade({ sat: 0.8, contrast: 1.15, halftone: 0.3 });
  g.post.letterbox = true;
  sfx('domain', 0.2);
}
// the blindfold strip flutters off and away
function flyingCloth(g, c) {
  const geo = new THREE.PlaneGeometry(0.55, 0.06, 12, 1), base = geo.attributes.position.array.slice();
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#0b0b12', side: THREE.DoubleSide }));
  const p0 = c.boneWorld('head').add(V(0, 0.08, 0)), dir = -c.facing;
  m.position.copy(p0); m.renderOrder = 3;
  g.fx.add(m, 1.4, (e, k) => {
    const t = e.t;
    m.position.set(p0.x + dir * t * 0.9, p0.y + t * 1.1 - t * t * 0.5, p0.z + t * 0.5);
    m.rotation.set(t * 2.2, t * 3.1 * dir, Math.sin(t * 6) * 0.6);
    const P = geo.attributes.position.array;
    for (let i = 0; i < P.length; i += 3) P[i + 2] = base[i + 2] + Math.sin(base[i] * 14 + t * 18) * 0.04;
    geo.attributes.position.needsUpdate = true;
    m.material.opacity = 1 - Math.max(0, k - 0.7) / 0.3; m.material.transparent = k > 0.7;
  });
}

export function updateInfiniteVoid(seq, dt) {
  const g = seq.g, c = seq.c, o = seq.o, D = seq.D, S = seq.S;
  seq.t += dt; const T = seq.t, t = T - seq.PRE;
  const fr = front(c), once = (k, fn) => seq.once(k, fn);
  if (seq.env.parent) seq.env.userData.u.uTime.value += dt;
  // ---------------- 0: the blindfold comes off
  if (seq.PRE) {
    once('M0', () => {
      g.cam.setShot(tt => { const hd = c.boneWorld('head').add(V(0, 0.02, 0));
        return { pos: hd.clone().add(front(c, 0.55).multiplyScalar(1.05 - tt * 0.25)), look: hd, fov: 30, roll: -c.facing * 0.03 }; }, 0);
      sfx('whoosh');
    });
    if (T > 0.5) once('M1', () => {               // hand over the eyes: swap to the unmasked body
      c.setForm((c.baseSrc || c.rigged).form);
      flyingCloth(g, c); sfx('whoosh'); g.post.flash(0.06, '#ffffff', 0.35);
    });
    if (T > 0.85) once('M2', () => {              // the eyes: a cold blue glint
      const hd = c.boneWorld('head'), f = front(c, 0.42), side = V(-f.z, 0, f.x);
      for (const sd of [-1, 1]) g.fx.flash(hd.clone().addScaledVector(f, 0.1).addScaledVector(side, sd * 0.032).add(V(0, 0.035, 0)), '#7fe3ff', 0.22, 0.6);
      sfx('teleport'); g.post.chroma(0.2, 0.6);
    });
  }
  // ---------------- A1: calm front shot, the hand comes up
  if (t >= 0) once('A1', () => {
    if (seq.PRE) { c.setAnim('voidSign', 0.35); c.actor.setFingers?.(SIGN_CROSS, 0.3); }
    const ch = c.boneWorld('chest').lerp(c.boneWorld('head'), 0.4);
    g.cam.setShot(tt => ({ pos: ch.clone().add(front(c, 0.6).multiplyScalar(2.3 - tt * 0.3)).add(V(0, 0.05, 0)), look: ch, fov: 34, roll: 0 }), 0);
  });
  // ---------------- A2: everything goes black; the sign + eyes in extreme close-up
  if (t > 0.75) once('A2', () => {
    blackout(S, g, c, o, true);
    g.post.letterbox = true; g.post.flash(0.12, '#000000', 1);
    g.hud.domainCall(D.jp, c.def.color);
    say(c.def, 'domain', c.def.lines?.domain || { jp: '領域展開…' + D.jp, en: 'Domain Expansion… ' + D.title });
    if (c.def.lines?.domain) g.hud.dialog(c, c.def.lines.domain, 2800);
    sfx('gong');
    g.cam.setShot(tt => {
      const look = c.boneWorld('hand_R').lerp(c.boneWorld('head'), 0.55);
      return { pos: look.clone().add(front(c, 0.5).multiplyScalar(0.95 - tt * 0.12)).add(V(0, 0.02, 0)), look, fov: 30, roll: -c.facing * 0.04 };
    }, 0);
  });
  // ---------------- A3: a white point opens behind him and swallows everything
  if (t > 1.6) once('A3', () => {
    const p = c.boneWorld('chest').addScaledVector(fr, -0.6);
    S.sphere = seq.makeSphere(p, '#eaf8ff'); S.sphere.scale.setScalar(0.05); g.scene.add(S.sphere);
    g.fx.flash(p, '#ffffff', 2, 0.4); sfx('charge');
    const mid = V((c.pos.x + o.pos.x) / 2, 1.2, 0);
    g.cam.setShot(tt => ({ pos: V(mid.x - c.facing * 0.8, 1.2 + tt * 0.6, 5.5 + tt * 3), look: V(mid.x, 1.3, 0), fov: 36, roll: 0.03 }), 0);
  });
  if (S.sphere) {
    const k = Math.min(1, (t - 1.6) / 0.55), e = k * k * k;
    S.sphere.scale.setScalar(0.05 + e * 70); S.sphere.material.uniforms.uTime.value = t;
  }
  // ---------------- B: the void
  if (t > 2.15) once('B', () => {
    if (S.sphere) { S.sphere.removeFromParent(); S.sphere.geometry.dispose(); S.sphere.material.dispose(); S.sphere = null; }
    blackout(S, g, c, o, false);
    g.setDomainEnv(seq.env, c); g.stage.setVisible(false);
    g.post.flash(0.5, '#ffffff', 1); g.post.grade(seq.env.userData.grade);
    g.hud.domainTitle(D.title, D.jp, c.def.color);
    sfx('boom'); sfx('domain');
    c.setAnim('idle', 0.4); c.actor.setFingers?.(HAND_OPEN, 0.4); o.setAnim('idle', 0.2);
    // reveal: from just behind his shoulder, far back and up — two tiny figures in endless space
    const cp = c.pos.clone(), mid = V((c.pos.x + o.pos.x) / 2, 1.2, 0);
    g.cam.setShot(tt => { const k = 1 - Math.exp(-tt * 1.1), a = 0.25 - k * 0.65;
      return { pos: V(cp.x - c.facing * (1.0 + k * 3) + Math.sin(a) * k * 6, 1.6 + k * 4.5, 1.6 + k * 11), look: V(mid.x, 1.1 + k * 1.5, -2 * k), fov: 36 + k * 8, roll: 0.05 * Math.sin(tt) }; }, 0);
  });
  // both drift slightly — floating in space
  if (t > 2.15 && !seq.fired.has('E')) {
    c.pos.y = 0.12 + Math.sin(t * 1.6) * 0.06; o.pos.y = 0.1 + Math.sin(t * 1.3 + 1) * 0.05;
  }
  // ---------------- C1: paralysed: light pours into their head, the screen floods with text
  if (t > 3.5) once('C1', () => {
    o.setAnim('paralyzed', 0.25);
    S.flood = floodEl(); S.floodT = 0;
    const of = front(o), hp = o.boneWorld('head');
    g.cam.setShot(tt => ({ pos: hp.clone().add(of.clone().multiplyScalar(1.25 - tt * 0.15)).add(V(0, 0.12, 0)), look: hp.clone().add(V(0, -0.02, 0)), fov: 30, roll: Math.sin(tt * 9) * 0.015 }), 0);
    g.post.chroma(0.3, 0.8); sfx('spark'); g.post.impact(0.05, 0);
  });
  if (S.flood) {
    S.floodT -= dt;
    if (S.floodT <= 0) { S.floodT = 0.07; S.flood.textContent = floodText(); }
    S.flood.style.opacity = t < 5.8 ? String(0.28 + Math.random() * 0.12) : '0';
  }
  if (t > 3.5 && t < 6.7) {
    const hp = o.boneWorld('head');
    for (let i = 0; i < 5; i++) {
      const a = rand(0, Math.PI * 2), r = rand(1.5, 4), s = V(Math.cos(a) * r, Math.sin(a) * r * 0.8, rand(-1.5, 1.5));
      g.fx.glow.emit({ pos: hp.clone().add(s), vel: s.clone().multiplyScalar(-2.6), t: 0, life: 0.38, s0: 0.03, s1: 0.06, c: new THREE.Color(Math.random() > 0.4 ? '#ffffff' : '#7fe3ff'), r: 0 });
    }
    seq.tick = (seq.tick || 0) - dt;
    if (seq.tick <= 0) { seq.tick = 0.3; o.U.uFlash.value = 0.35; o.anim.flinch = 0.25; seq.hurt(14); if (Math.random() < 0.5) sfx('orb'); }
  }
  // ---------------- C2: Gojo walks up to the frozen opponent
  if (t > 4.35) once('C2', () => {
    c.setAnim('walkF', 0.2, 0.75);
    S.walkFrom = c.pos.x; S.walkTo = o.pos.x - c.facing * 0.68;
    g.cam.setShot(tt => { const m = V((c.pos.x + o.pos.x) / 2, 0, 0);
      return { pos: V(m.x - c.facing * 0.4, 0.55, 3.3 - tt * 0.25), look: V(m.x, 1.25, 0), fov: 38, roll: -0.04 }; }, 0);
    g.post.chroma(0.2, 0.6);
  });
  if (S.walkFrom != null && !S.arrived) {
    const k = Math.min(1, (t - 4.35) / 1.35);
    c.pos.x = THREE.MathUtils.lerp(S.walkFrom, S.walkTo, k);
    if (k >= 1) { S.arrived = true; c.setAnim('voidTouch', 0.25); c.actor.setFingers?.(HAND_OPEN, 0.2); }
  }
  // ---------------- D: hand on their head
  if (t > 5.75) once('D', () => {
    const hd = o.boneWorld('head'), side = V(0, 0, 1);
    g.cam.setShot(tt => ({ pos: hd.clone().addScaledVector(side, 1.5 - tt * 0.2).add(V(-c.facing * 0.35, 0.05, 0)), look: hd.clone().lerp(c.boneWorld('head'), 0.4), fov: 32, roll: c.facing * 0.03 }), 0);
    g.post.flash(0.08, '#ffffff', 0.5); sfx('teleport');
  });
  // ---------------- E: white-out, final sure hit, shatter
  if (t > 6.6) once('E0', () => {
    g.post.flash(0.6, '#ffffff', 1); g.post.impact(0.12, 0); g.cam.shake(0.8);
    sfx('spark'); sfx('boom', 0.05);
    g.fx.flash(o.boneWorld('head'), '#ffffff', 6, 0.5); g.fx.ring(o.boneWorld('head'), '#7fe3ff', 5, 0.5);
    seq.hurt(D.dmg - seq.dealt, true);
  });
  if (t > 6.95) once('E', () => {
    if (S.flood) { S.flood.remove(); S.flood = null; }
    blackout(S, g, c, o, false);
    g.post.shatter(); sfx('shatter');
    g.clearDomainEnv();
    c.pos.y = 0; o.pos.y = 0;
    g.post.grade({}); g.hud.setVisible(true); g.post.letterbox = false;
    g.cam.clearShot(0);
    c.actor.setFingers?.(null, 0.3);
    c.auraOn = false; c.burnout = 6; c.energy = 0;
    c.setForm(null);                              // blindfold back on
    c.toNeutral();
    o.setState('idle');
    o.takeHit(c, { kb: 9, up: 10, kind: 'heavy' }, 0, o.pos);
    g.hud.toast(c.slot, 'BURNOUT');
    seq.done = true; g.cine = null;
  });
}
