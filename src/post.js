// Anime post-processing: impact frames (manga inverted B/W or red/black), radial speed
// lines, chromatic aberration, halftone shading, colour grading, letterbox, flash,
// and the "domain shatter" glass-break transition.
import * as THREE from 'three';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime;
uniform float uImpact; uniform float uImpactMode; uniform float uFlash; uniform vec3 uFlashColor;
uniform float uChroma; uniform float uSpeed; uniform vec2 uCenter; uniform vec3 uSpeedColor;
uniform float uVignette; uniform float uLetterbox; uniform float uSat; uniform float uContrast;
uniform vec3 uTint; uniform float uMono; uniform float uHalftone; uniform float uRedKeep; uniform float uRewind;
varying vec2 vUv;
float hash(float n){ return fract(sin(n)*43758.5453); }
float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
void main(){
  vec2 uv = vUv;
  // VHS rewind: tearing lines + wobble
  if (uRewind > 0.0) {
    float band = floor(uv.y * 90.0);
    uv.x += (hash(band + floor(uTime * 30.0)) - 0.5) * 0.012 * uRewind;
    float tear = step(0.985, hash(floor(uv.y * 14.0) + floor(uTime * 12.0)));
    uv.x += tear * 0.05 * uRewind;
  }
  vec2 d = uv - uCenter;
  // chromatic aberration (radial)
  vec2 off = d * uChroma * 0.03;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + off).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - off).b;
  // colour grade
  float l = luma(col);
  col = mix(vec3(l), col, uSat);
  col = (col - 0.5) * uContrast + 0.5;
  col *= uTint;
  // monochrome manga mode (keep reds if uRedKeep)
  float redness = clamp((col.r - max(col.g, col.b)) * 3.0, 0.0, 1.0) * uRedKeep;
  col = mix(col, mix(vec3(luma(col)), col, redness), uMono);
  // halftone dots in shadows (screen space, 45deg)
  vec2 px = gl_FragCoord.xy;
  vec2 hp = mat2(0.7071, -0.7071, 0.7071, 0.7071) * px / 5.0;
  float dotv = length(fract(hp) - 0.5);
  float shade = 1.0 - smoothstep(0.08, 0.35, luma(col));
  col *= 1.0 - uHalftone * shade * (1.0 - smoothstep(0.2, 0.3, dotv)) * 0.6;
  // radial speed lines
  if (uSpeed > 0.001) {
    float ang = atan(d.y * uRes.y / uRes.x, d.x);
    float seg = floor(ang * 60.0 + uTime * 0.0);
    float rnd = hash(seg + floor(uTime * 24.0) * 13.0);
    float w = fract(ang * 60.0);
    float line = step(0.7, rnd) * (1.0 - smoothstep(0.0, 0.5, abs(w - 0.5) * 2.0 * (1.0 - rnd * 0.5)));
    float rad = length(d * vec2(uRes.x / uRes.y, 1.0));
    line *= smoothstep(0.18 + rnd * 0.2, 0.75, rad);
    col = mix(col, uSpeedColor, line * uSpeed);
  }
  // impact frame
  if (uImpact > 0.5) {
    float t = step(0.42, luma(col));
    vec3 a = uImpactMode < 0.5 ? vec3(1.0) : vec3(0.0);
    vec3 b = uImpactMode < 0.5 ? vec3(0.02) : vec3(0.95, 0.05, 0.12);
    if (uImpactMode > 1.5) { a = vec3(0.0); b = vec3(1.0); }
    col = mix(a, b, t);
  }
  if (uRewind > 0.0) {
    float l2 = luma(col);
    col = mix(col, vec3(l2) * vec3(0.75, 0.95, 1.15), 0.65 * uRewind);
    col *= 0.85 + 0.15 * sin(gl_FragCoord.y * 2.2);
    col += (hash(gl_FragCoord.y * 0.37 + uTime * 91.0) - 0.5) * 0.12 * uRewind;
  }
  // vignette
  float v = smoothstep(0.95, 0.25, length(d * vec2(1.0, 0.8)));
  col *= mix(1.0, v, uVignette);
  col = mix(col, uFlashColor, uFlash);
  // letterbox
  float lb = uLetterbox * 0.12;
  if (uv.y < lb || uv.y > 1.0 - lb) col = vec3(0.0);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4, type: THREE.HalfFloatType });
    this.snapRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
    this.u = {
      tDiffuse: { value: this.rt.texture }, uRes: { value: size.clone() }, uTime: { value: 0 },
      uImpact: { value: 0 }, uImpactMode: { value: 0 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) },
      uChroma: { value: 0 }, uSpeed: { value: 0 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uSpeedColor: { value: new THREE.Color(1, 1, 1) },
      uVignette: { value: 0.35 }, uLetterbox: { value: 0 }, uSat: { value: 1.12 }, uContrast: { value: 1.06 },
      uTint: { value: new THREE.Color(1, 1, 1) }, uMono: { value: 0 }, uHalftone: { value: 0.55 }, uRedKeep: { value: 0 }, uRewind: { value: 0 },
    };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // timed effects
    this.impactT = 0; this.flashT = 0; this.flashDur = 0.2; this.speedT = 0; this.speedDur = 0; this.chromaT = 0;
    this.base = { sat: 1.12, contrast: 1.06, mono: 0, tint: new THREE.Color(1, 1, 1), halftone: 0.55, redKeep: 0 };
    // shatter overlay
    this.shards = null; this.shatterScene = new THREE.Scene();
    this.shatterCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    // copy material for snapshots
    this.copyMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null } }, vertexShader: VERT, fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }', depthTest: false });
  }
  setSize(w, h) {
    const s = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt.setSize(s.x, s.y); this.snapRT.setSize(s.x, s.y); this.u.uRes.value.copy(s);
  }
  impact(dur = 0.08, mode = 0) { this.impactT = dur; this.u.uImpactMode.value = mode; }
  flash(dur = 0.2, color = '#ffffff', amt = 1) { this.flashT = dur; this.flashDur = dur; this.flashAmt = amt; this.u.uFlashColor.value.set(color); }
  speed(dur = 0.4, amt = 0.8, color = '#ffffff', center) {
    this.speedT = dur; this.speedDur = dur; this.speedAmt = amt; this.u.uSpeedColor.value.set(color);
    if (center) this.u.uCenter.value.copy(center);
  }
  chroma(dur = 0.25, amt = 1) { this.chromaT = dur; this.chromaDur = dur; this.chromaAmt = amt; }
  setCenter(v2) { this.u.uCenter.value.copy(v2); }
  grade({ sat = 1.12, contrast = 1.06, mono = 0, tint = '#ffffff', halftone = 0.55, redKeep = 0 } = {}) {
    Object.assign(this.base, { sat, contrast, mono, halftone, redKeep }); this.base.tint.set(tint);
  }
  update(dt, time) {
    const u = this.u; u.uTime.value = time;
    this.impactT -= dt; u.uImpact.value = this.impactT > 0 ? 1 : 0;
    this.flashT -= dt; u.uFlash.value = this.flashT > 0 ? (this.flashT / this.flashDur) * (this.flashAmt ?? 1) : 0;
    this.speedT -= dt; u.uSpeed.value = this.speedT > 0 ? Math.min(1, this.speedT / (this.speedDur * 0.5)) * this.speedAmt : (this.speedHold || 0);
    this.chromaT -= dt; u.uChroma.value = this.chromaT > 0 ? (this.chromaT / this.chromaDur) * this.chromaAmt : (this.chromaHold || 0);
    const k = 1 - Math.exp(-dt * 6);
    u.uSat.value += (this.base.sat - u.uSat.value) * k;
    u.uContrast.value += (this.base.contrast - u.uContrast.value) * k;
    u.uMono.value += (this.base.mono - u.uMono.value) * k;
    u.uHalftone.value += (this.base.halftone - u.uHalftone.value) * k;
    u.uRedKeep.value = this.base.redKeep;
    u.uTint.value.lerp(this.base.tint, k);
    u.uLetterbox.value += ((this.letterbox ? 1 : 0) - u.uLetterbox.value) * (1 - Math.exp(-dt * 8));
    u.uRewind.value = this.rewind || 0;
    if (this.shards) this.updateShards(dt);
  }
  render(scene, camera) {
    const r = this.renderer;
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, camera);
    r.setRenderTarget(null); r.render(this.scene, this.cam);
    if (this.shards) { r.autoClear = false; r.clearDepth(); r.render(this.shatterScene, this.shatterCam); r.autoClear = true; }
  }
  // ------------- glass shatter: snapshot current frame, break into shards
  shatter() {
    const r = this.renderer;
    // snapshot the post-processed look by rendering post quad into snapRT
    r.setRenderTarget(this.snapRT); r.render(this.scene, this.cam); r.setRenderTarget(null);
    if (this.shards) this.shatterScene.remove(this.shards.group);
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ map: this.snapRT.texture, side: THREE.DoubleSide, transparent: true, depthTest: false });
    const aspect = this.u.uRes.value.x / this.u.uRes.value.y;
    this.shatterCam.left = -aspect; this.shatterCam.right = aspect; this.shatterCam.updateProjectionMatrix();
    // jittered grid -> triangles
    const NX = 9, NY = 6, pts = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const edge = i === 0 || j === 0 || i === NX || j === NY;
      pts.push([i / NX + (edge ? 0 : (Math.random() - 0.5) * 0.08), j / NY + (edge ? 0 : (Math.random() - 0.5) * 0.12)]);
    }
    const P = (i, j) => pts[j * (NX + 1) + i];
    const list = [];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      if ((i + j) % 2) { list.push([a, b, c], [a, c, d]); } else { list.push([a, b, d], [b, c, d]); }
    }
    const shards = [];
    for (const tri of list) {
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      const g = new THREE.BufferGeometry();
      const pos = [], uv = [];
      for (const p of tri) { pos.push((p[0] - cx) * 2 * aspect, (p[1] - cy) * 2, 0); uv.push(p[0], p[1]); }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const m = new THREE.Mesh(g, mat);
      m.position.set((cx - 0.5) * 2 * aspect, (cy - 0.5) * 2, 0);
      const dx = cx - 0.5, dy = cy - 0.5;
      m.userData.v = new THREE.Vector3(dx * (2 + Math.random() * 3), dy * (2 + Math.random() * 3) + 0.5, 0);
      m.userData.w = new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6);
      m.userData.delay = Math.hypot(dx, dy) * 0.25;
      group.add(m); shards.push(m);
    }
    // white crack lines flash
    this.shatterScene.add(group);
    this.shards = { group, shards, t: 0, mat };
  }
  updateShards(dt) {
    const S = this.shards; S.t += dt;
    for (const m of S.shards) {
      if (S.t < 0.18 + m.userData.delay * 0.3) { m.scale.setScalar(0.985); continue; }
      m.userData.v.y -= dt * 4.5;
      m.position.addScaledVector(m.userData.v, dt);
      m.rotation.x += m.userData.w.x * dt; m.rotation.y += m.userData.w.y * dt; m.rotation.z += m.userData.w.z * dt;
    }
    S.mat.opacity = Math.max(0, 1 - Math.max(0, S.t - 0.6) / 0.7);
    if (S.t > 1.4) { this.shatterScene.remove(S.group); S.shards.forEach(m => m.geometry.dispose()); S.mat.dispose(); this.shards = null; }
  }
}
