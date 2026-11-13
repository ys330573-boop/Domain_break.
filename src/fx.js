// VFX: GPU point particles + sprite/mesh effects, all stylised (hard shapes, flat colours).
import * as THREE from 'three';
import { getTex } from './textures.js';

const PVERT = `
attribute float aSize; attribute float aAlpha; attribute float aRot; attribute vec3 aColor;
varying float vAlpha; varying float vRot; varying vec3 vColor; uniform float uScale;
void main(){ vAlpha = aAlpha; vRot = aRot; vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const PFRAG = `
uniform sampler2D map; varying float vAlpha; varying float vRot; varying vec3 vColor;
void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(vRot), co = cos(vRot);
  vec2 uv = vec2(c.x * co - c.y * s, c.x * s + c.y * co) + 0.5;
  vec4 t = texture2D(map, uv); if (t.a * vAlpha < 0.02) discard;
  gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha); }`;

class PointSystem {
  constructor(scene, texName, blending, cap = 800) {
    this.cap = cap; this.n = 0;
    this.p = []; // particle data
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    this.rot = new Float32Array(cap); this.col = new Float32Array(cap * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: getTex(texName) }, uScale: { value: 600 } }, vertexShader: PVERT, fragmentShader: PFRAG,
      transparent: true, depthWrite: false, blending,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
    scene.add(this.points);
  }
  emit(o) { if (this.p.length >= this.cap) this.p.shift(); this.p.push(o); }
  update(dt) {
    const P = this.p; let w = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i]; q.t += dt; if (q.t >= q.life) continue;
      q.vel.y -= (q.grav || 0) * dt; q.vel.multiplyScalar(Math.exp(-(q.drag || 0) * dt));
      if (q.attract) { const d = q.attract.clone().sub(q.pos); q.vel.addScaledVector(d, dt * q.attractK); }
      q.pos.addScaledVector(q.vel, dt); q.r += (q.spin || 0) * dt;
      P[w++] = q;
    }
    P.length = w;
    for (let i = 0; i < w; i++) {
      const q = P[i], k = q.t / q.life;
      this.pos[i * 3] = q.pos.x; this.pos[i * 3 + 1] = q.pos.y; this.pos[i * 3 + 2] = q.pos.z;
      this.size[i] = q.s0 + (q.s1 - q.s0) * k;
      this.alpha[i] = (q.a ?? 1) * (k < 0.1 ? k / 0.1 : 1 - Math.pow(Math.max(0, (k - 0.4) / 0.6), 2));
      this.rot[i] = q.r; this.col[i * 3] = q.c.r; this.col[i * 3 + 1] = q.c.g; this.col[i * 3 + 2] = q.c.b;
    }
    const g = this.points.geometry; g.setDrawRange(0, w);
    for (const k of ['position', 'aSize', 'aAlpha', 'aRot', 'aColor']) g.attributes[k].needsUpdate = true;
  }
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const C = c => (c instanceof THREE.Color ? c : new THREE.Color(c));

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.glow = new PointSystem(scene, 'glow', THREE.AdditiveBlending, 1200);
    this.sparks = new PointSystem(scene, 'spark', THREE.AdditiveBlending, 400);
    this.smoke = new PointSystem(scene, 'smoke', THREE.NormalBlending, 500);
    this.flames = new PointSystem(scene, 'flame', THREE.AdditiveBlending, 600);
    this.items = [];
  }
  setScale(px) { for (const s of [this.glow, this.sparks, this.smoke, this.flames]) s.mat.uniforms.uScale.value = px; }
  update(dt) {
    this.glow.update(dt); this.sparks.update(dt); this.smoke.update(dt); this.flames.update(dt);
    const I = this.items; let w = 0;
    for (let i = 0; i < I.length; i++) {
      const e = I[i]; e.t += dt;
      const k = Math.min(1, e.t / e.dur);
      if (e.update) e.update(e, k, dt);
      if (e.t >= e.dur) { if (e.obj) { e.obj.removeFromParent(); dispose(e.obj); } if (e.onEnd) e.onEnd(e); continue; }
      I[w++] = e;
    }
    I.length = w;
  }
  add(obj, dur, update, parent) { if (obj) (parent || this.scene).add(obj); const e = { obj, t: 0, dur, update }; this.items.push(e); return e; }
  clear() { for (const e of this.items) if (e.obj) { e.obj.removeFromParent(); dispose(e.obj); } this.items.length = 0; for (const s of [this.glow, this.sparks, this.smoke, this.flames]) s.p.length = 0; }

  // ------------------------------------------------------------- primitives
  sprite(tex, color, size, pos, { additive = true, rot = 0, opacity = 1 } = {}) {
    const m = new THREE.SpriteMaterial({ map: getTex(tex), color: C(color), transparent: true, depthWrite: false, depthTest: true, rotation: rot, opacity,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const s = new THREE.Sprite(m); s.position.copy(pos); s.scale.setScalar(size); s.renderOrder = 6; return s;
  }
  burstParticles(pos, color, n = 14, speed = 6, size = 0.25, life = 0.35, sys = 'glow', extra = {}) {
    const c = C(color);
    for (let i = 0; i < n; i++) {
      const dir = V(rand(-1, 1), rand(-1, 1), rand(-0.4, 0.4)).normalize();
      this[sys].emit({ pos: pos.clone(), vel: dir.multiplyScalar(speed * rand(0.4, 1)), t: 0, life: life * rand(0.6, 1.2), s0: size, s1: size * 0.2, c, r: rand(0, 6), drag: 4, ...extra });
    }
  }

  // ------------------------------------------------------------- composite effects
  hitSpark(pos, color = '#fff', scale = 1, dir = 1) {
    const s = this.sprite('spark', color, 0.2 * scale, pos, { rot: rand(0, Math.PI) });
    this.add(s, 0.16, (e, k) => { s.scale.setScalar((0.4 + k * 1.6) * scale); s.material.opacity = 1 - k * k; });
    const s2 = this.sprite('spark', '#ffffff', 0.15 * scale, pos, { rot: rand(0, Math.PI) });
    this.add(s2, 0.1, (e, k) => s2.scale.setScalar((0.3 + k * 0.9) * scale));
    this.burstParticles(pos, color, 10 + 6 * scale, 7 * scale, 0.16 * scale, 0.3, 'glow', { grav: 6 });
    // directional streaks
    for (let i = 0; i < 4 + scale * 2; i++) {
      const v = V(dir * rand(3, 10), rand(-4, 5), rand(-1, 1));
      this.sparks.emit({ pos: pos.clone(), vel: v, t: 0, life: rand(0.15, 0.3), s0: 0.35 * scale, s1: 0.05, c: C(color), r: rand(0, 6), drag: 6 });
    }
  }
  impactBurst(pos, color = '#fff', size = 1.6, ink = '#140b18') {
    // manga "BAM" balloon: black jagged shape + coloured inner
    const outer = this.sprite('burst', ink, size, pos, { additive: false, rot: rand(0, 6) });
    const inner = this.sprite('burst', color, size * 0.8, pos.clone().add(V(0, 0, 0.01)), { additive: false, rot: rand(0, 6) });
    this.add(outer, 0.18, (e, k) => { outer.scale.setScalar(size * (0.5 + k * 0.7)); outer.material.opacity = 1 - k; });
    this.add(inner, 0.16, (e, k) => { inner.scale.setScalar(size * 0.8 * (0.4 + k * 0.8)); inner.material.opacity = 1 - k; });
  }
  ring(pos, color, size = 2, dur = 0.35, { flat = false, thick = 1 } = {}) {
    let obj;
    if (flat) {
      obj = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: getTex('ring'), color: C(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      obj.rotation.x = -Math.PI / 2; obj.position.copy(pos);
    } else obj = this.sprite('ring', color, 0.1, pos);
    this.add(obj, dur, (e, k) => { const s = size * (0.15 + (1 - Math.pow(1 - k, 3)) * 0.85); obj.scale.set(s, s, s); obj.material.opacity = (1 - k) * thick; });
    return obj;
  }
  shockwave(pos, color = '#ffffff', size = 4) {
    this.ring(pos.clone().setY(0.05), color, size, 0.45, { flat: true });
    this.ring(pos, color, size * 0.7, 0.3);
    this.dust(pos.clone().setY(0.1), size * 0.5);
  }
  dust(pos, amount = 1, color = '#e9dccd') {
    const c = C(color);
    for (let i = 0; i < 10 * amount; i++) {
      this.smoke.emit({ pos: pos.clone().add(V(rand(-0.3, 0.3), 0, rand(-0.3, 0.3))), vel: V(rand(-3, 3) * amount, rand(0.3, 1.6), rand(-1, 1)), t: 0, life: rand(0.35, 0.7),
        s0: 0.35, s1: 0.9 * amount, c, r: rand(0, 6), spin: rand(-2, 2), drag: 3, a: 0.85 });
    }
  }
  slashArc(pos, color, { size = 2.2, rotZ = 0, rotY = 0, dur = 0.22, flip = 1 } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: getTex('slash'), color: C(color), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.copy(pos); m.rotation.set(0, rotY, rotZ); m.scale.set(size * flip, size, 1);
    const inner = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ map: getTex('slash'), color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    inner.scale.set(0.9, 0.55, 1); inner.position.z = 0.01; m.add(inner);
    this.add(m, dur, (e, k) => { m.scale.set(size * flip * (0.7 + k * 0.5), size * (1 - k * 0.6), 1); m.material.opacity = 1 - k * k; inner.material.opacity = 1 - k; });
    return m;
  }
  slashLine(center, angle, len, color = '#ffffff', dur = 0.25, width = 0.12) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: getTex('line'), color: C(color), transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.copy(center); m.rotation.z = angle; m.renderOrder = 9;
    this.add(m, dur, (e, k) => { const g = Math.min(1, k * 5); m.scale.set(len * g, width * (1 - k), 1); m.material.opacity = 1 - k * k; });
    return m;
  }
  inkSlash(center, angle, len, dur = 0.35) { // black stroke + white core (manga cut)
    this.slashLine(center, angle, len * 1.05, '#ffffff', dur, 0.22);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: getTex('line'), color: 0x000000, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    m.position.copy(center).add(V(0, 0, -0.01)); m.rotation.z = angle; m.renderOrder = 8;
    this.add(m, dur, (e, k) => { const g = Math.min(1, k * 5); m.scale.set(len * 1.15 * g, 0.34 * (1 - k * 0.7), 1); m.material.opacity = 1 - k; });
  }
  lightning(a, b, color = '#000000', width = 0.08, dur = 0.25, segs = 10) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const p = a.clone().lerp(b, i / segs);
      if (i > 0 && i < segs) p.add(V(rand(-0.25, 0.25), rand(-0.25, 0.25), 0));
      pts.push(p);
    }
    const pos = [], idx = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], n = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize();
      const perp = V(-n.y, n.x, 0).multiplyScalar(width * (1 - i / pts.length * 0.7));
      pos.push(p.x + perp.x, p.y + perp.y, p.z, p.x - perp.x, p.y - perp.y, p.z);
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: C(color), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = 7;
    this.add(m, dur, (e, k) => { m.material.opacity = Math.random() > 0.3 ? 1 - k : 0.2; });
  }
  blackSpark(pos, color = '#ff1030') {
    for (let i = 0; i < 9; i++) {
      const ang = rand(0, Math.PI * 2), len = rand(1.2, 3.2);
      const b = pos.clone().add(V(Math.cos(ang) * len, Math.sin(ang) * len, rand(-0.3, 0.3)));
      this.lightning(pos, b, i % 3 === 0 ? color : '#050005', rand(0.05, 0.12), rand(0.25, 0.45));
    }
    this.impactBurst(pos, color, 3.2, '#000000');
    this.burstParticles(pos, color, 30, 12, 0.3, 0.5, 'glow', { grav: 3 });
    this.ring(pos, color, 5, 0.4);
  }
  groundCrack(pos, size = 2.2, dur = 3) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: getTex('crack'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rand(0, 6); m.position.set(pos.x, 0.012, pos.z); m.renderOrder = 1;
    this.add(m, dur, (e, k) => { m.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; });
    // debris chunks
    const c = new THREE.Color('#3a2c3c');
    for (let i = 0; i < 12; i++)
      this.smoke.emit({ pos: V(pos.x + rand(-0.5, 0.5), 0.1, pos.z + rand(-0.4, 0.4)), vel: V(rand(-3, 3), rand(4, 9), rand(-1, 1)), t: 0, life: rand(0.5, 0.9), s0: 0.12, s1: 0.1, c, r: 0, spin: 9, grav: 22, a: 1 });
  }
  flash(pos, color, size = 3, dur = 0.2) {
    const s = this.sprite('glow', color, size, pos);
    this.add(s, dur, (e, k) => { s.scale.setScalar(size * (1 + k)); s.material.opacity = 1 - k; });
  }
  aura(pos, color, amount = 1) { // flame-like rising aura around a fighter
    const c = C(color);
    for (let i = 0; i < 2 * amount; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      this.flames.emit({ pos: pos.clone().add(V(side * rand(0.3, 0.5), rand(0, 1.7), rand(-0.2, 0.2))), vel: V(side * rand(0, 0.4), rand(2.5, 4.5), 0), t: 0, life: rand(0.2, 0.4), s0: rand(0.22, 0.38), s1: 0.05, c, r: rand(-0.2, 0.2), a: 0.55 });
    }
    if (Math.random() < 0.3 * amount) this.glow.emit({ pos: pos.clone().add(V(rand(-0.5, 0.5), rand(0, 1.8), 0.2)), vel: V(0, rand(1, 3), 0), t: 0, life: 0.6, s0: 0.08, s1: 0.02, c: new THREE.Color('#ffffff'), r: 0 });
  }
  // ------------------------------------------------------------ objects with custom shaders
  orb(color, radius = 0.45, inner = '#ffffff') {
    const g = new THREE.Group();
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: C(color) }, uInner: { value: C(inner) }, uTime: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform vec3 uInner; uniform float uTime; varying vec3 vN; varying vec3 vV;
        void main(){ float f = 1.0 - abs(dot(vN, vV)); float band = step(0.55, f);
          vec3 c = mix(uInner, uColor, smoothstep(0.15, 0.5, f)); c = mix(c, vec3(0.02), step(0.9, f));
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
    g.add(core);
    const halo = this.sprite('glow', color, radius * 5, V()); g.add(halo);
    g.userData = { core, halo, mat };
    return g;
  }
  beam(from, dir, length, color, width = 0.7) {
    const g = new THREE.Group();
    const mk = (r, col, add) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color: C(col), transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }));
      m.rotation.z = Math.PI / 2; return m;
    };
    const outer = mk(width, '#120018', false), mid = mk(width * 0.8, color, true), core = mk(width * 0.35, '#ffffff', false);
    g.add(outer, mid, core); g.position.copy(from);
    g.userData = { outer, mid, core, length, dir };
    return g;
  }
}

function dispose(o) {
  o.traverse(c => {
    if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose();
    if (c.material) { const ms = Array.isArray(c.material) ? c.material : [c.material]; ms.forEach(m => m.dispose()); }
  });
}

// Ribbon trail following a moving point (fists/feet/weapons)
export class Trail {
  constructor(scene, color, len = 14, width = 0.18) {
    this.n = len; this.width = width; this.pts = []; this.active = false; this.fade = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(len * 2 * 3); this.alpha = new Float32Array(len * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < len - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: C(color) }, uOp: { value: 1 } },
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uOp; varying float vA; void main(){ gl_FragColor = vec4(mix(uColor, vec3(1.0), smoothstep(0.8,1.0,vA) * 0.7), vA*uOp*0.85); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
    scene.add(this.mesh);
  }
  setColor(c) { this.mat.uniforms.uColor.value.set(c); }
  update(p, dt) {
    if (this.active) { this.pts.unshift(p.clone()); this.fade = 1; } else { this.fade = Math.max(0, this.fade - dt * 6); if (this.pts.length) this.pts.unshift(this.pts[0].clone()); }
    if (this.pts.length > this.n) this.pts.length = this.n;
    const P = this.pts, w = this.width;
    for (let i = 0; i < this.n; i++) {
      const a = P[Math.min(i, P.length - 1)] || p;
      const b = P[Math.min(i + 1, P.length - 1)] || a;
      let dx = a.x - b.x, dy = a.y - b.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const ww = w * (1 - i / this.n);
      this.pos.set([a.x - dy * ww, a.y + dx * ww, a.z, a.x + dy * ww, a.y - dx * ww, a.z], i * 6);
      // only fast-moving segments are visible (a still hand draws nothing)
      const seg = Math.hypot(a.x - b.x, a.y - b.y);
      const al = (1 - i / this.n) * (i < P.length ? 1 : 0) * Math.min(1, seg / 0.06);
      this.alpha[i * 2] = al; this.alpha[i * 2 + 1] = al;
    }
    this.mat.uniforms.uOp.value = this.fade;
    this.mesh.visible = this.fade > 0.01 && P.length > 1;
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.aA.needsUpdate = true;
  }
}
