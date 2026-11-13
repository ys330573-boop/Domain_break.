// DOMAIN EXPANSION — full cinematic: hand-sign close-ups, ink sphere engulfing the
// arena, a unique domain world, sure-hit barrage, and a glass-shatter exit.
import * as THREE from 'three';
import { sfx } from './audio.js';
import { say } from './voice.js';
import { cutAt, firePillar } from './moves.js';
import { buildInfiniteVoid, startInfiniteVoid, updateInfiniteVoid } from './voiddomain.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);

export const DOMAINS = {
  void: { title: 'BOUNDLESS VOID', jp: '無限虚空', color: '#7fe3ff', color2: '#b26bff', dmg: 300 },
  shrine: { title: 'CRIMSON ALTAR', jp: '紅蓮祭壇', color: '#ff2a3a', color2: '#ff9a3c', dmg: 300 },
  heavenly: { title: 'ZERO CAGE', jp: '零ノ檻', color: '#d6ff6a', color2: '#ffffff', dmg: 280 },
};

// ------------------------------------------------------------- environments
const SKY_VERT = `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const NOISE = `
float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*n3(p); p*=2.03; a*=0.5; } return s; }`;

function skySphere(frag, uniforms) {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERT, fragmentShader: NOISE + frag, side: THREE.BackSide, depthWrite: false, fog: false });
  const s = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 24), m); s.renderOrder = -10;
  return s;
}

function buildVoid() {
  const g = new THREE.Group(); const u = { uTime: { value: 0 } };
  g.add(skySphere(`uniform float uTime; varying vec3 vP;
    void main(){ vec3 p = vP; float a = atan(p.y, p.x);
      float sw = fbm(vec3(p.xy*3.0 + vec2(cos(a+uTime*0.2), sin(a-uTime*0.2)), uTime*0.1));
      float neb = fbm(p*4.0 + vec3(0.0, 0.0, uTime*0.15));
      vec3 c = vec3(0.01, 0.0, 0.04);
      c += vec3(0.25, 0.05, 0.6) * smoothstep(0.45, 0.85, neb);
      c += vec3(0.1, 0.7, 1.0) * smoothstep(0.62, 0.9, sw) * 0.9;
      c += vec3(1.0) * step(0.985, h(floor(p*300.0)));
      // radial light streaks toward the centre
      float r = length(p.xy); float streak = step(0.93, h(vec3(floor(a*80.0), 0.0, 0.0))) * smoothstep(0.1, 0.9, r);
      c += vec3(0.85, 0.95, 1.0) * streak * (0.5 + 0.5*sin(uTime*8.0 + a*30.0));
      gl_FragColor = vec4(c, 1.0); }`, u));
  // glowing floor rings
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vU; void main(){ vU = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vU; void main(){ float r = length(vU);
      float ring = smoothstep(0.08, 0.0, abs(fract(r*0.5 - uTime*0.4) - 0.5) - 0.42);
      float grid = step(0.985, fract(atan(vU.y, vU.x) * 6.0)) * 0.3;
      vec3 c = mix(vec3(0.01,0.0,0.05), vec3(0.35,0.85,1.0), ring * 0.7 + grid);
      gl_FragColor = vec4(c, (0.9 - r/45.0)); }` }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; g.add(floor);
  g.userData = { u, fog: null, bg: '#02000a', light: '#cdeeff', amb: '#4a3aa0', grade: { sat: 1.25, contrast: 1.15, tint: '#e6f0ff', halftone: 0.3 } };
  return g;
}

function buildShrine() {
  const g = new THREE.Group(); const u = { uTime: { value: 0 } };
  g.add(skySphere(`uniform float uTime; varying vec3 vP;
    void main(){ float y = vP.y; vec3 c = mix(vec3(0.55, 0.02, 0.05), vec3(0.02, 0.0, 0.0), smoothstep(-0.05, 0.6, y));
      // huge crimson moon
      float d = length(vP - normalize(vec3(0.0, 0.32, -1.0)));
      c = mix(c, vec3(1.0, 0.2, 0.15), smoothstep(0.24, 0.23, d));
      c = mix(c, vec3(0.05,0,0), smoothstep(0.235, 0.23, d) * smoothstep(0.20, 0.205, d) * 0.0);
      float cl = fbm(vec3(vP.x*5.0 + uTime*0.1, vP.y*12.0, 1.0));
      c = mix(c, vec3(0.08, 0.0, 0.01), smoothstep(0.55, 0.62, cl) * smoothstep(0.5, 0.0, abs(y-0.2)));
      gl_FragColor = vec4(c, 1.0); }`, u));
  // blood lake
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShaderMaterial({ uniforms: u, fog: false,
    vertexShader: `varying vec2 vU; void main(){ vU = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: NOISE + `uniform float uTime; varying vec2 vU; void main(){ float r = length(vU);
      float rip = smoothstep(0.1, 0.0, abs(fract(r*0.6 - uTime*0.5) - 0.5) - 0.44) * smoothstep(30.0, 0.0, r);
      float n = fbm(vec3(vU*0.3, uTime*0.2));
      vec3 c = mix(vec3(0.25, 0.0, 0.02), vec3(0.6, 0.02, 0.06), n);
      c = mix(c, vec3(1.0, 0.45, 0.4), rip * 0.6);
      gl_FragColor = vec4(c, 1.0); }` }));
  lake.rotation.x = -Math.PI / 2; lake.position.y = 0.001; g.add(lake);
  // black spires & ribs
  const black = new THREE.MeshBasicMaterial({ color: '#070002' });
  const rimMat = new THREE.MeshBasicMaterial({ color: '#ff2a3a', side: THREE.BackSide });
  for (let i = 0; i < 26; i++) {
    const h = rand(4, 16), a = rand(0, Math.PI * 2), r = rand(14, 40);
    const s = new THREE.Mesh(new THREE.ConeGeometry(rand(0.3, 1.1), h, 5), black);
    s.position.set(Math.cos(a) * r, h / 2 - 0.5, Math.sin(a) * r - 6); s.rotation.z = rand(-0.25, 0.25); g.add(s);
  }
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(9 + i * 0.4, 0.35, 6, 24, Math.PI), black);
    rib.position.set(-20 + i * 8, 0, -26); rib.rotation.y = 0.3; g.add(rib);
  }
  // shrine silhouette behind
  const shrine = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 6), black); base.position.y = 2.5; shrine.add(base);
  for (let k = 0; k < 3; k++) {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(9 - k * 2.2, 2.2, 4), black); roof.rotation.y = Math.PI / 4; roof.position.y = 5.8 + k * 3.2; roof.scale.z = 0.7; shrine.add(roof);
    const glow = new THREE.Mesh(new THREE.ConeGeometry(9.1 - k * 2.2, 2.25, 4), rimMat); glow.rotation.y = Math.PI / 4; glow.position.y = roof.position.y; glow.scale.z = 0.72; shrine.add(glow);
    const body = new THREE.Mesh(new THREE.BoxGeometry(6 - k * 1.6, 2, 4 - k), black); body.position.y = 7 + k * 3.2; shrine.add(body);
  }
  shrine.position.set(0, 0, -30); g.add(shrine);
  g.userData = { u, bg: '#200003', light: '#ffb0a0', amb: '#7a1020', grade: { sat: 1.2, contrast: 1.2, tint: '#ffe6e6', halftone: 0.6 } };
  return g;
}

function buildHeavenly() {
  const g = new THREE.Group(); const u = { uTime: { value: 0 } };
  g.add(skySphere(`uniform float uTime; varying vec3 vP;
    void main(){ float a = atan(vP.y, vP.x) + atan(vP.z, vP.x);
      float seg = floor(a * 70.0); float rn = h(vec3(seg, floor(uTime*10.0), 0.0));
      float line = step(0.78, rn) * smoothstep(0.0, 0.5, abs(vP.y + 0.1));
      vec3 c = mix(vec3(0.96, 0.95, 0.92), vec3(0.03), line);
      gl_FragColor = vec4(c, 1.0); }`, u));
  // hatched paper floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShaderMaterial({ uniforms: u,
    vertexShader: `varying vec2 vU; void main(){ vU = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vU; void main(){ float r = length(vU);
      float hatch = step(0.85, fract((vU.x + vU.y) * 2.0)) * smoothstep(3.0, 12.0, r);
      float ring = step(0.97, fract(r * 0.25 - uTime * 0.3));
      vec3 c = vec3(0.94) - vec3(0.85) * max(hatch * 0.6, ring);
      gl_FragColor = vec4(c, 1.0); }` }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001; g.add(floor);
  g.userData = { u, bg: '#f2f0ea', light: '#ffffff', amb: '#ffffff', ink: true, grade: { sat: 1, contrast: 1.35, mono: 1, redKeep: 1, tint: '#ffffff', halftone: 0.9 } };
  return g;
}

// Gojo's domain uses the infinite-void cinematic in src/voiddomain.js (buildVoid is the older look)
const BUILDERS = { void: buildInfiniteVoid, shrine: buildShrine, heavenly: buildHeavenly };
const envCache = {};
function getEnv(type) { return envCache[type] || (envCache[type] = BUILDERS[type]()); }

// ------------------------------------------------------------- the sequence
export class DomainSequence {
  constructor(game, caster, type) {
    this.g = game; this.c = caster; this.o = caster.opp; this.type = type; this.D = DOMAINS[type];
    this.t = 0; this.done = false; this.fired = new Set();
    this.env = getEnv(type);
    this.dealt = 0;
    const g = game, c = caster, o = this.o;
    for (const f of [c, o]) { f.setState('cine'); f.vel.set(0, 0, 0); f.move = null; for (const k in f.trails) f.trails[k].active = false; }
    // bring opponent into frame
    if (o.pos.y > 0) o.pos.y = 0;
    c.pos.y = 0;
    const dist = o.pos.x - c.pos.x;
    if (Math.abs(dist) > 3.6 || Math.abs(dist) < 1.6) o.pos.x = THREE.MathUtils.clamp(c.pos.x + Math.sign(dist || c.facing) * 2.8, g.stage.bounds[0], g.stage.bounds[1]);
    c.faceOpp(); o.faceOpp();
    g.cine = this;
    if (type === 'void') { o.setAnim('idle', 0.2); g.hud.setVisible(false); startInfiniteVoid(this); return; }
    c.setAnim('sign', 0.15); o.setAnim('idle', 0.2);
    g.hud.setVisible(false); g.post.letterbox = true;
    g.post.flash(0.25, '#ffffff'); g.post.impact(0.05, 2);
    sfx('gong'); sfx('domain', 0.3);
  }
  once(key, fn) { if (!this.fired.has(key)) { this.fired.add(key); fn(); } }
  front(f) { return V(Math.cos(0.42) * f.facing, 0, Math.sin(0.42)); }
  update(dt) {
    if (this.type === 'void') return updateInfiniteVoid(this, dt);
    const g = this.g, c = this.c, o = this.o, D = this.D;
    this.t += dt; const t = this.t;
    const head = c.boneWorld('head'), chest = c.boneWorld('chest');
    const fr = this.front(c);
    c.auraOn = t > 0.4 && t < 2.6;
    // ---------------- Phase A: face close-up
    this.once('A', () => {
      const h0 = head.clone();
      g.cam.setShot(tt => ({ pos: h0.clone().add(fr.clone().multiplyScalar(1.3 - tt * 0.25)).add(V(0, -0.1, 0)), look: h0.clone().add(V(0, -0.05, 0)), fov: 32 - tt * 3, roll: -0.05 }), 0);
      g.hud.domainCall(D.jp, c.def.color);
      say(c.def, 'domain', c.def.lines?.domain || { jp: '領域展開…' + D.jp, en: 'Domain Expansion… ' + D.title });
      if (c.def.lines?.domain) g.hud.dialog(c, c.def.lines.domain, 2600);
      g.post.grade({ sat: 0.5, contrast: 1.3, halftone: 0.9 });
    });
    if (t > 0.95) this.once('A2', () => { // hands close-up
      const ch = chest.clone().add(V(0, -0.05, 0));
      g.cam.setShot(tt => ({ pos: ch.clone().add(fr.clone().multiplyScalar(0.9 + tt * 0.1)).add(V(0, 0.05, 0)), look: ch, fov: 30, roll: 0.12 }), 0);
      g.post.flash(0.12, c.def.aura, 0.8); g.post.speed(0.8, 0.9, '#ffffff'); g.post.impact(0.05, 0); sfx('hitH');
      g.fx.flash(ch, c.def.aura, 2.5, 0.5);
    });
    // ---------------- Phase B: name card + ink sphere expands
    if (t > 1.65) this.once('B', () => {
      g.hud.domainTitle(D.title, D.jp, c.def.color);
      const mid = V((c.pos.x + o.pos.x) / 2, 1.2, 0);
      g.cam.setShot(tt => ({ pos: V(mid.x - c.facing * 1.5, 0.5 + tt * 1.2, 7.5 + tt * 4), look: V(mid.x, 1.6 + tt * 0.5, 0), fov: 38, roll: 0.06 }), 0);
      this.sphere = this.makeSphere(c.pos.clone().add(V(0, 1.1, 0)), D.color);
      g.scene.add(this.sphere);
      sfx('boom'); g.cam.shake(0.6);
      g.post.grade({ sat: 1, contrast: 1.2 });
    });
    if (this.sphere && t < 2.55) {
      const k = Math.min(1, (t - 1.65) / 0.85); const e = k * k * k;
      this.sphere.scale.setScalar(0.2 + e * 60);
      if (e * 60 > 9) g.stage.setVisible(false);
      this.sphere.material.uniforms.uTime.value = t;
    }
    if (t > 2.5) this.once('C', () => { // swap world
      if (this.sphere) { this.sphere.removeFromParent(); this.sphere.geometry.dispose(); this.sphere.material.dispose(); this.sphere = null; }
      g.setDomainEnv(this.env, c);
      g.post.flash(0.35, '#ffffff'); g.post.letterbox = false;
      g.post.grade(this.env.userData.grade);
      sfx('gong');
      c.setAnim('open', 0.3); o.setAnim('hitL', 0.1);
      if (this.env.userData.ink) { for (const f of [c, o]) { f.U.uSilhouette.value = 1; f.U.uOutlineColor.value.set('#ffffff'); f.U.uOutlineWidth.value = 0.02; } c.U.uSilColor.value.set('#050505'); o.U.uSilColor.value.set('#151515'); }
    });
    if (this.env.parent) this.env.userData.u.uTime.value += dt;
    // ---------------- Phase C: sure-hit barrage + orbit camera
    if (t > 2.5 && t < 6.3) {
      const mid = V((c.pos.x + o.pos.x) / 2, 1.1, 0);
      if (!this.fired.has('orbit')) {
        this.fired.add('orbit');
        g.cam.setShot(tt => { const a = -0.9 + tt * 0.45; const r = 6.5 - tt * 0.3; return { pos: V(mid.x + Math.sin(a) * r, 1.0 + Math.sin(tt * 0.8) * 0.6, Math.cos(a) * r), look: mid.clone().add(V(0, 0.2, 0)), fov: 34, roll: Math.sin(tt) * 0.05 }; }, 0);
      }
      if (t > 4.1) this.once('C2', () => { // low dramatic angle on opponent
        const op = o.pos.clone();
        g.cam.setShot(tt => ({ pos: V(op.x - o.facing * 0.2 + tt * 0.3, 0.35, 3.0 - tt * 0.3), look: V(op.x, 1.4, 0), fov: 40, roll: -0.12 }), 0);
      });
      if (t > 5.3) this.once('C3', () => { // caster hero shot
        const cp = c.pos.clone();
        g.cam.setShot(tt => ({ pos: cp.clone().add(fr.clone().multiplyScalar(3.4)).add(V(0, 0.4 - tt * 0.3, 0)), look: cp.clone().add(V(0, 1.3, 0)), fov: 30 - tt * 4, roll: 0.06 }), 0);
        c.setAnim('castSign', 0.15);
      });
      this.barrage(dt);
    }
    // ---------------- Phase D: finale + shatter
    if (t > 6.3) this.once('D', () => {
      g.post.impact(0.12, this.type === 'shrine' ? 1 : this.type === 'heavenly' ? 2 : 0);
      g.post.flash(0.15, D.color, 0.8); sfx('spark'); sfx('boom', 0.05);
      const op = o.pos.clone().add(V(0, 1.1, 0.3));
      g.fx.blackSpark(op, D.color);
      const final = D.dmg - this.dealt;
      this.hurt(final, true);
    });
    if (t > 6.55) this.once('E', () => {
      g.post.shatter(); sfx('shatter');
      g.clearDomainEnv();
      for (const f of [c, o]) { f.U.uSilhouette.value = 0; f.U.uOutlineColor.value.set('#0b0710'); f.U.uOutlineWidth.value = 0.011; }
      g.post.grade({}); g.hud.setVisible(true);
      g.cam.clearShot(0);
      c.auraOn = false; c.burnout = 6; c.energy = 0;
      c.toNeutral();
      // launch the victim
      o.setState('idle');
      o.takeHit(c, { kb: 9, up: 10, kind: 'heavy' }, 0, o.pos);
      g.hud.toast(c.slot, 'BURNOUT');
      this.done = true; g.cine = null;
    });
  }
  hurt(d, big = false) {
    const o = this.o, g = this.g;
    d = Math.min(d, Math.max(0, o.hp - (big ? 0 : 1)));
    o.hp = Math.max(0, o.hp - d); this.dealt += d;
    o.U.uFlash.value = big ? 1 : 0.55; o.anim.flinch = 1; o.anim.flinchDir = this.c.facing;
    g.hud.damage(o.slot, d, big);
    g.cam.shake(big ? 0.8 : 0.2);
    this.c.combo++; this.c.comboTimer = 2; g.hud.combo(this.c.slot, this.c.combo);
  }
  barrage(dt) {
    const g = this.g, c = this.c, o = this.o, t = this.t;
    this.tick = (this.tick || 0) - dt;
    const op = o.pos.clone().add(V(0, 1.1, 0));
    if (this.type === 'void') {
      // information overload: streams of light pour into the victim
      for (let i = 0; i < 6; i++) {
        const a = rand(0, Math.PI * 2), r = rand(3, 6), s = V(Math.cos(a) * r, Math.sin(a) * r * 0.7, rand(-2, 2));
        g.fx.glow.emit({ pos: op.clone().add(s), vel: s.clone().multiplyScalar(-2.2), t: 0, life: 0.45, s0: 0.08, s1: 0.18, c: new THREE.Color(Math.random() > 0.5 ? '#ffffff' : '#7fe3ff'), r: 0 });
      }
      if (this.tick <= 0) {
        this.tick = 0.32;
        g.fx.ring(op, '#7fe3ff', 3, 0.3); g.post.chroma(0.15, 0.5); g.post.flash(0.06, '#ffffff', 0.3);
        o.setAnim(Math.random() > 0.5 ? 'hitL' : 'hitH', 0.05); sfx('orb');
        this.hurt(18);
      }
    } else if (this.type === 'shrine') {
      if (this.tick <= 0) {
        this.tick = 0.09;
        // slashes everywhere, concentrated on the victim
        const center = Math.random() > 0.35 ? op.clone().add(V(rand(-0.6, 0.6), rand(-0.6, 0.7), 0.6)) : V(c.pos.x + rand(-7, 7), rand(0.3, 4), rand(-3, 1));
        g.fx.inkSlash(center, rand(0, Math.PI), rand(2, 4.5), 0.28);
        if (Math.random() > 0.6) sfx('slash');
        if (Math.random() > 0.55) { o.U.uFlash.value = 0.8; this.hurt(9); o.setAnim(Math.random() > 0.5 ? 'hitL' : 'hitH', 0.03); g.fx.burstParticles(op, '#ff2a3a', 6, 6, 0.14, 0.35, 'glow', { grav: 8 }); }
        if (Math.random() > 0.8) { const gx = c.pos.x + rand(-6, 6); g.fx.flames.emit({ pos: V(gx, 0.1, rand(-3, 0)), vel: V(0, 3, 0), t: 0, life: 0.4, s0: 0.6, s1: 0.1, c: new THREE.Color('#ff2a3a'), r: 0, a: 0.7 }); }
      }
      if (t > 5.4) this.once('fire', () => { firePillar(g, o.pos.clone()); sfx('fire'); });
    } else { // heavenly: blink strikes from all directions
      if (this.tick <= 0) {
        this.tick = 0.38;
        const ang = rand(0, Math.PI * 2);
        const from = op.clone().add(V(Math.cos(ang) * 2.2, Math.sin(ang) * 1.2 + 0.2, 0));
        // caster teleports around the victim
        c.pos.x = THREE.MathUtils.clamp(op.x + Math.cos(ang) * 1.3, g.stage.bounds[0], g.stage.bounds[1]); c.faceOpp();
        c.setAnim(['jab', 'cross', 'kick', 'slash'][(Math.random() * 4) | 0], 0.02);
        c.spawnGhost('#000000');
        g.fx.inkSlash(op.clone().add(V(0, 0, 0.5)), ang + Math.PI / 2, 4.5, 0.3);
        g.fx.lightning(from, op.clone().add(V(rand(-0.3, 0.3), rand(-0.3, 0.3), 0)), '#d01020', 0.06, 0.2);
        g.post.impact(0.04, 2); sfx('hitH'); sfx('teleport');
        o.setAnim(Math.random() > 0.5 ? 'hitL' : 'hitH', 0.03);
        this.hurt(26);
      }
    }
  }
  makeSphere(pos, color) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } }, side: THREE.DoubleSide, depthWrite: false, transparent: true,
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ float f = 1.0 - abs(dot(vN, vV));
          float lines = step(0.92, fract(vP.y * 6.0 + uTime * 2.0)) * 0.6;
          vec3 c = mix(vec3(0.0), uColor, smoothstep(0.55, 0.9, f));
          c = mix(c, vec3(1.0), step(0.93, f));
          c += uColor * lines;
          gl_FragColor = vec4(c, 0.96); }`,
    });
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), m); s.position.copy(pos); s.renderOrder = 20;
    return s;
  }
}
