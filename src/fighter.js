// Fighter: state machine, physics, move execution, hit detection, visuals (trails, afterimages).
import * as THREE from 'three';
import { createActor } from './actor.js';
import { makeToonMaterial, makeOutlineMaterial, makeFighterUniforms } from './toon.js';
import { getClips } from './poses.js';
import { Trail } from './fx.js';
import { MOVES, kitMoves } from './moves.js';
import { sfx } from './audio.js';
import { weaponTip } from './weapons.js';
import { Decap } from './decap.js';

// camera-facing flame aura: noise-driven 2-tone flames rising around the body silhouette
const AURA_VERT = `varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * vec2(2.0, 3.0); mv.z -= 0.35; gl_Position = projectionMatrix * mv; }`;
const AURA_FRAG = `uniform float uTime; uniform float uAmt; uniform vec3 uColor; uniform float uSeed; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ return n(p)*0.55 + n(p*2.1)*0.28 + n(p*4.3)*0.17; }
  void main(){ vec2 p = vUv - vec2(0.5, 0.42);
    float body = 1.0 - length(p * vec2(3.4, 1.55));
    float flame = fbm(vec2(vUv.x * 5.0 + uSeed, vUv.y * 2.6 - uTime * 2.6));
    float tongues = fbm(vec2(vUv.x * 11.0 - uSeed, vUv.y * 1.5 - uTime * 3.6));
    float f = body + flame * 0.75 + tongues * 0.35 * vUv.y - 0.55 - (1.0 - uAmt) * 0.6;
    if (f < 0.0) discard;
    vec3 c = mix(uColor, vec3(1.0), step(0.3, f) * 0.85);
    c = mix(vec3(0.03, 0.0, 0.06), c, step(0.035, f));
    gl_FragColor = vec4(c, 0.92 * smoothstep(0.0, 0.02, f)); }`;

export const GRAV = 32, WALK = 3.4, BACKWALK = 2.6, JUMP_V = 11.8, DASH_V = 13;
const MAX_HP = 1000;
const TURN = Math.PI / 2 - 0.42;

export class Fighter {
  constructor(game, def, rigged, slot) {
    this.game = game; this.def = def; this.slot = slot; this.rigged = rigged;
    this.U = makeFighterUniforms(def.color);
    this.actor = createActor(rigged, this.U);
    this.inst = this.actor;
    this.root = new THREE.Group();
    this.model = this.inst.group; this.model.rotation.y = TURN; this.root.add(this.model);
    this.anim = this.actor.anim;
    this.clips = getClips();
    this.kit = kitMoves(def.kit);
    // trails
    this.trails = {};
    for (const b of ['hand_L', 'hand_R', 'foot_L', 'foot_R']) this.trails[b] = new Trail(game.scene, def.color, 12, b.startsWith('foot') ? 0.13 : 0.11);
    // weapon-tip trails ('w_blade', 'w_knife'…) for characters with hand-held weapons
    for (const w in this.actor.weapons || {}) this.trails['w_' + w] = new Trail(game.scene, def.accent || def.color, 14, 0.2);
    // speed stats: def.speed scales walk/dash, def.atkSpeed scales every attack's timeline
    this.spd = def.speed || 1; this.atkSpd = def.atkSpeed || 1;
    // ghost (afterimage) pool
    this.ghosts = [];
    for (let i = 0; i < 4; i++) {
      const gm = new THREE.MeshBasicMaterial({ color: def.aura, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const g = this.actor.makeGhost(gm);
      const holder = new THREE.Group(); holder.add(g.group); g.group.rotation.y = TURN; holder.visible = false;
      game.scene.add(holder);
      this.ghosts.push({ inst: g, holder, mat: gm, life: 0 });
    }
    this.ghostTimer = 0;
    this.auraU = { uTime: { value: 0 }, uAmt: { value: 0 }, uColor: { value: new THREE.Color(def.aura) }, uSeed: { value: Math.random() * 10 } };
    this.auraMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: this.auraU, transparent: true, depthWrite: false, vertexShader: AURA_VERT, fragmentShader: AURA_FRAG }));
    this.auraMesh.frustumCulled = false; this.auraMesh.renderOrder = -1;
    game.scene.add(this.auraMesh);
    this.reset(slot === 0 ? -2.6 : 2.6);
    game.scene.add(this.root);
  }
  reset(x) {
    if (this.decap) { this.decap.dispose(); this.decap = null; }
    if (this.baseSrc) this.setForm(null);
    this.pos = new THREE.Vector3(x, 0, 0); this.vel = new THREE.Vector3();
    this.facing = x < 0 ? 1 : -1;
    this.hp = MAX_HP; this.maxHp = MAX_HP; this.dispHp = MAX_HP;
    this.energy = 50; this.domain = 0; this.burnout = 0;
    this.state = 'idle'; this.t = 0; this.move = null; this.moveT = 0;
    this.stun = 0; this.invuln = 0; this.combo = 0; this.comboTimer = 0;
    this.lastHitT = -9; this.pressT = { light: -9, heavy: -9 }; this.pressSeen = {};
    this.sparkArmed = false; this.hitLanded = false; this.juggle = 0;
    this.visible = true; this.root.visible = true;
    this.setAnim('idle', 0);
    this.U.uFlash.value = 0; this.U.uSilhouette.value = 0;
  }
  get opp() { return this.game.fighters[1 - this.slot]; }
  // swap the body for another model (e.g. Gojo without his blindfold during his domain); null = back to
  // the normal one. Actors are cached, the current animation carries over.
  setForm(src) {
    this.baseSrc = this.baseSrc || this.rigged;
    const target = src || this.baseSrc;
    if (target === this.rigged) return;
    this.forms = this.forms || new Map([[this.baseSrc, this.actor]]);
    let actor = this.forms.get(target);
    if (!actor) { actor = createActor(target, this.U); this.forms.set(target, actor); }
    this.model.removeFromParent();
    this.actor = this.inst = actor; this.anim = actor.anim; this.rigged = target;
    this.model = actor.group; this.model.rotation.y = TURN; this.root.add(this.model);
    this.setAnim(this.animName || 'idle', 0);
    this.root.updateMatrixWorld(true);
  }
  get grounded() { return this.pos.y <= 0.0001; }
  setAnim(name, fade = 0.08, speed = 1, restart = true) {
    const c = this.clips[name] || (this.actor.hasClip(name) ? name : null);
    if (c) this.anim.play(c, { fade, speed, restart, name }); this.animName = name;
  }
  has(m) { return m && (!m.needs || this.actor.hasClip(m.needs)); }
  // K + direction: → jump kick, ← flip kick (when the rig has those animations), else the normal heavy
  lightStart() { return this.has(MOVES.cJab) ? MOVES.cJab : MOVES.jab; }
  heavyFor(c) {
    const fwd = this.facing > 0 ? c.right : c.left, back = this.facing > 0 ? c.left : c.right;
    if (fwd && this.has(MOVES.diveKick)) return MOVES.diveKick;
    if (back && this.has(MOVES.bladeRise)) return MOVES.bladeRise;
    if (!fwd && !back && this.has(MOVES.bladeRush)) return MOVES.bladeRush;
    if (fwd && this.has(MOVES.jumpKick)) return MOVES.jumpKick;
    if (fwd && this.has(MOVES.chop)) return MOVES.chop;
    if (back && this.has(MOVES.flipKick)) return MOVES.flipKick;
    if (back && this.has(MOVES.spinSlash)) return MOVES.spinSlash;
    if (this.has(MOVES.crossHeavy)) return MOVES.crossHeavy;
    return MOVES.heavy;
  }
  boneWorld(name, out = new THREE.Vector3()) { return this.inst.bones[name].getWorldPosition(out); }
  chestWorld() { return this.boneWorld('chest'); }
  front(dist = 1, y = 1.2) { return new THREE.Vector3(this.pos.x + this.facing * dist, this.pos.y + y, 0); }
  setState(s) {
    if (s !== 'attack') { if (this.actor.held) this.actor.holdWeapon(null); this.endMoveHook(); }
    this.state = s; this.t = 0;
  }
  endMoveHook() { const e = this._moveEnd; this._moveEnd = null; if (e) e(this, this.game); }

  // -------------------------------------------------------------------- update
  update(dt, ctrl) {
    const g = this.game;
    this.t += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.burnout > 0) this.burnout -= dt;
    this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0;
    // energy regen
    if (!['cine'].includes(this.state)) this.energy = Math.min(100, this.energy + dt * (this.burnout > 0 ? 1.5 : 5));
    // track fresh attack presses (for SPARK timing)
    if (ctrl) for (const a of ['light', 'heavy']) {
      const p = ctrl.peek(a);
      if (p && !this.pressSeen[a]) this.pressT[a] = g.time;
      this.pressSeen[a] = p;
    }
    const st = this.state;
    if (st === 'cine' || st === 'intro' || st === 'win') { /* puppeted */ }
    else if (st === 'ko') this.updKO(dt);
    else if (st === 'hit') { this.stun -= dt; this.applyFriction(dt, 14); if (this.stun <= 0) this.toNeutral(); }
    else if (st === 'blockstun') { this.stun -= dt; this.applyFriction(dt, 12); if (this.stun <= 0) this.setState('block'); }
    else if (st === 'airhit') { this.vel.y -= GRAV * 0.85 * dt; if (this.grounded && this.vel.y <= 0 && this.t > 0.05) this.knockdown(); }
    else if (st === 'down') { this.applyFriction(dt, 10); if (this.t > 0.55) { this.setState('getup'); this.setAnim('getup', 0.05); this.invuln = 0.6; } }
    else if (st === 'getup') { if (this.t > 0.45) this.toNeutral(); }
    else if (st === 'attack') this.updAttack(dt, ctrl);
    else if (st === 'dash') this.updDash(dt, ctrl);
    else this.updNeutral(dt, ctrl);

    // physics
    if (!['cine', 'intro', 'win'].includes(this.state) || this.cinePhysics) {
      if (!this.grounded || this.vel.y > 0) {
        if (this.state !== 'airhit' && !(this.state === 'attack' && this.move?.float && this.moveT < this.move.float)) this.vel.y -= GRAV * dt;
      }
      this.pos.addScaledVector(this.vel, dt);
      const rd = this.anim.takeRootDelta ? this.anim.takeRootDelta() : 0;
      if (rd && this.state === 'attack') this.pos.x += rd * this.facing;
      // a jump baked into the playing clip carries the fighter up (gravity takes over when the move ends)
      if (this.state === 'attack' && this.anim.rootY != null) { this.pos.y = Math.max(0, this.anim.rootY); this.vel.y = 0; }
      if (this.pos.y < 0) {
        this.pos.y = 0;
        if (this.vel.y < -2 && ['jump', 'idle', 'walk'].includes(this.state)) this.land();
        if (this.state === 'attack' && this.move?.air) this.land();
        this.vel.y = 0;
      }
      const [b0, b1] = g.stage.bounds;
      if (this.pos.x < b0) { this.pos.x = b0; if (this.state === 'airhit') this.wallBounce(); }
      if (this.pos.x > b1) { this.pos.x = b1; if (this.state === 'airhit') this.wallBounce(); }
    }
  }
  wallBounce() {
    if (Math.abs(this.vel.x) > 8) {
      this.vel.x *= -0.35; this.vel.y = Math.max(this.vel.y, 5);
      this.game.fx.shockwave(new THREE.Vector3(this.pos.x, this.pos.y + 1, 0), '#ffffff', 2);
      this.game.cam.shake(0.4); sfx('hitH');
    } else this.vel.x = 0;
  }
  applyFriction(dt, k) { if (this.grounded) this.vel.x *= Math.exp(-k * dt); }
  faceOpp() { const d = this.opp.pos.x - this.pos.x; if (Math.abs(d) > 0.05) this.facing = d > 0 ? 1 : -1; }
  toNeutral() { this.move = null; if (this.grounded) { this.setState('idle'); this.setAnim('idle', 0.12); } else { this.setState('jump'); this.setAnim('fall', 0.15); } }
  land() {
    this.vel.x *= 0.3; sfx('land');
    this.game.fx.dust(new THREE.Vector3(this.pos.x, 0.05, 0), 0.6);
    if (this.state === 'attack') { this.move = null; }
    this.setState('idle'); this.setAnim('land', 0.04);
    this.landT = 0.16;
  }
  knockdown() {
    this.pos.y = 0; this.vel.y = 0; this.vel.x *= 0.4;
    this.setState('down'); this.setAnim('down', 0.08);
    this.game.fx.dust(new THREE.Vector3(this.pos.x, 0.05, 0), 1.2);
    this.game.cam.shake(0.25); sfx('land');
    this.juggle = 0;
    if (this.hp <= 0) { this.setState('ko'); }
  }
  updKO(dt) { this.applyFriction(dt, 4); }

  updNeutral(dt, c) {
    const g = this.game;
    const air = !this.grounded;
    if (!air) this.faceOpp();
    if (this.landT > 0) { this.landT -= dt; }
    const fwd = c ? (this.facing > 0 ? c.right : c.left) : false;
    const back = c ? (this.facing > 0 ? c.left : c.right) : false;
    if (!c) return;
    // actions
    if (c.pressed('ult') && this.domain >= 100 && !air) return this.startMove(this.kit.ult);
    if (c.pressed('s3')) { if (this.canSpecial(this.kit.s3)) return this.startMove(this.kit.s3); }
    if (c.pressed('s2')) { if (this.canSpecial(this.kit.s2)) return this.startMove(this.kit.s2); }
    if (c.pressed('s1')) { if (this.canSpecial(this.kit.s1)) return this.startMove(this.kit.s1); }
    if (c.pressed('heavy')) return this.startMove(air ? MOVES.airHeavy : this.heavyFor(c));
    if (c.pressed('light')) return this.startMove(air ? MOVES.airLight : this.lightStart());
    if (air) { // air control
      const ax = (fwd ? 1 : back ? -1 : 0) * this.facing;
      this.vel.x += ax * dt * 6; this.vel.x = THREE.MathUtils.clamp(this.vel.x, -5, 5);
      if (this.state !== 'jump') { this.setState('jump'); this.setAnim('fall', 0.15); }
      if (this.vel.y < 0 && this.animName === 'jump' && this.t > 0.3) this.setAnim('fall', 0.2);
      return;
    }
    if (c.pressed('jump')) {
      this.vel.y = JUMP_V; this.vel.x = (fwd ? 4.6 : back ? -4.2 : 0) * this.spd * this.facing;
      this.pos.y = 0.001; this.setState('jump'); this.setAnim('jump', 0.05); sfx('jump');
      this.game.fx.dust(new THREE.Vector3(this.pos.x, 0.05, 0), 0.5);
      return;
    }
    if (c.pressed('dash')) { this.startDash(back ? -1 : 1); return; }
    if (c.down) {
      if (this.state !== 'block') { this.setState('block'); this.setAnim('block', 0.05); }
      this.vel.x = 0; return;
    }
    if (fwd) { this.vel.x = WALK * this.spd * this.facing; if (this.animName !== 'walkF') this.setAnim('walkF', 0.12, this.spd); this.state = 'walk'; }
    else if (back) { this.vel.x = -BACKWALK * this.spd * this.facing; if (this.animName !== 'walkB') this.setAnim('walkB', 0.12, this.spd); this.state = 'walk'; }
    else {
      this.vel.x = 0;
      if (this.state !== 'idle' || (this.animName !== 'idle' && this.animName !== 'land') || (this.animName === 'land' && this.landT <= 0)) { this.state = 'idle'; if (this.animName !== 'idle') this.setAnim('idle', 0.15); }
    }
  }
  canSpecial(m) {
    if (!m) return false;
    if (this.burnout > 0) { this.game.hud.toast(this.slot, 'BURNOUT'); return false; }
    if (this.energy < (m.cost || 0)) { this.game.hud.toast(this.slot, 'LOW ENERGY'); return false; }
    return true;
  }
  startDash(dir) {
    if (dir < 0 && this.has(MOVES.backflip)) return this.startMove(MOVES.backflip);
    this.setState('dash'); this.dashDir = dir;
    this.vel.x = DASH_V * this.spd * dir * this.facing * (dir < 0 ? 0.85 : 1);
    this.setAnim(dir > 0 ? 'dash' : 'walkB', 0.05, 1.6);
    if (dir < 0) this.invuln = 0.18;
    this.game.fx.dust(new THREE.Vector3(this.pos.x, 0.05, 0), 0.7); sfx('whoosh');
    this.spawnGhost();
  }
  updDash(dt, c) {
    this.ghostTimer -= dt; if (this.ghostTimer <= 0) { this.spawnGhost(); this.ghostTimer = 0.05; }
    if (this.def.afterimage && Math.random() < 0.5) this.game.fx.dust(new THREE.Vector3(this.pos.x, 0.05, 0), 0.25);
    // allow attacks out of dash
    if (c && this.t > 0.06) {
      if (c.pressed('light')) { this.vel.x *= 0.5; return this.startMove(this.lightStart()); }
      if (c.pressed('heavy')) { this.vel.x *= 0.5; return this.startMove(this.has(MOVES.jumpKick) && this.dashDir > 0 ? MOVES.jumpKick : this.heavyFor(c)); }
    }
    if (this.t > 0.24) { this.vel.x *= 0.25; this.toNeutral(); }
  }

  // ------------------------------------------------------------------ moves
  startMove(m) {
    if (!m) return;
    const g = this.game;
    if (m.cost) this.energy -= m.cost;
    if (m.ult) this.domain = 0;
    this.endMoveHook(); this._moveEnd = m.end || null;
    this.move = m; this.moveT = 0; this.evIdx = 0; this.hitLanded = false; this.activeHits = [];
    this.setState('attack');
    if (m.clip) this.setAnim(m.clip, m.fade ?? 0.04, (m.speed || 1) * this.atkSpd);
    this.actor.holdWeapon(m.weapon || null);
    if (!m.air && this.grounded) this.faceOpp();
    // SPARK timing: pressed shortly after your previous hit connected
    this.sparkArmed = false;
    if (m.normal) {
      const pt = this.pressT[m.button || 'light'];
      const dtHit = pt - this.lastHitT;
      if (g.time - (this.lastSparkT ?? -9) > 2.5) { // short cooldown between sparks
        if (this.isAI) this.sparkArmed = Math.random() < this.aiSpark && g.time - this.lastHitT < 0.6; // CPU presses are frame-perfect: use its difficulty chance instead
        else if (dtHit > 0.03 && dtHit < 0.19) this.sparkArmed = true;
      }
    }
    for (const k in this.trails) this.trails[k].active = false;
    this.ghostsOn = false;
    if (m.name) g.hud.callout(this.slot, m.name, m.jp);
    if (m.start) m.start(this, g);
  }
  updAttack(dt, c) {
    const m = this.move, g = this.game;
    const prevT = this.moveT;
    this.moveT += dt * this.atkSpd;
    if (m.friction != null) this.applyFriction(dt, m.friction); else this.applyFriction(dt, 6);
    // holding forward during a ground normal keeps pressing in (combos travel instead of standing still)
    if (c && m.normal && !m.air && this.grounded && this.moveT < m.dur * 0.75 && (this.facing > 0 ? c.right : c.left)
      && Math.abs(this.opp.pos.x - this.pos.x) > 0.8) {
      this.pos.x += this.facing * 2.4 * this.spd * dt;
      if (this.def.motionLines && Math.random() < 0.35) this.speedLines(2);
    }
    // timeline events
    for (const ev of m.events || []) {
      if (ev.t > prevT && ev.t <= this.moveT || (prevT === 0 && ev.t === 0)) this.runEvent(ev);
    }
    // active hitboxes
    for (const h of this.activeHits) {
      if (h.done || this.moveT > h.until) continue;
      if (this.checkHit(h.spec)) { h.done = true; }
    }
    if (m.update) m.update(this, g, dt);
    // ghosts on fast moves
    if (m.ghosts || this.ghostsOn) { this.ghostTimer -= dt; if (this.ghostTimer <= 0) { this.spawnGhost(); this.ghostTimer = 0.045; } }
    // cancels / chains
    if (c && m.chain && this.moveT >= (m.cancel ?? m.dur * 0.6)) {
      if (c.peek('light') && m.chain.light) { c.pressed('light'); return this.startMove(MOVES[m.chain.light]); }
      if (c.peek('heavy') && m.chain.heavy) { c.pressed('heavy'); return this.startMove(m.chain.heavy === 'heavy' ? this.heavyFor(c) : MOVES[m.chain.heavy]); }
    }
    if (c && m.normal && this.hitLanded && this.moveT > (m.cancel ?? 0.15)) { // special-cancel on hit
      for (const s of ['s1', 's2', 's3']) if (c.peek(s) && this.canSpecial(this.kit[s])) { c.pressed(s); return this.startMove(this.kit[s]); }
      if (c.peek('ult') && this.domain >= 100 && this.grounded) { c.pressed('ult'); return this.startMove(this.kit.ult); }
    }
    if (this.moveT >= m.dur) {
      for (const k in this.trails) this.trails[k].active = false;
      if (m.air && !this.grounded) { this.move = null; this.setState('jump'); this.setAnim('fall', 0.15); }
      else this.toNeutral();
    }
  }
  runEvent(ev) {
    const g = this.game;
    if (ev.vel) { this.vel.x = ev.vel[0] * this.facing; if (ev.vel[1] != null) { this.vel.y = ev.vel[1]; if (ev.vel[1] > 0) this.pos.y = Math.max(this.pos.y, 0.001); } }
    if (ev.hit) this.activeHits.push({ spec: ev.hit, until: this.moveT + (ev.hit.active ?? 0.07), done: false });
    if (ev.sfx) sfx(ev.sfx);
    if (ev.trail) { for (const b of [].concat(ev.trail)) { const tr = this.trails[b]; if (!tr.active) tr.pts.length = 0; tr.active = true; } }
    if (ev.trailOff) for (const k in this.trails) this.trails[k].active = false;
    if (ev.clip) this.setAnim(ev.clip, 0.03, this.atkSpd);
    if (ev.fn) ev.fn(this, g);
  }
  hitbox(spec) {
    const f = this.facing, x = this.pos.x;
    const a = x + f * spec.x0, b = x + f * spec.x1;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: this.pos.y + spec.y0, y1: this.pos.y + spec.y1 };
  }
  hurtbox() {
    const lying = this.state === 'down' || this.state === 'ko' && this.t > 0.4;
    return { x0: this.pos.x - 0.38, x1: this.pos.x + 0.38, y0: this.pos.y, y1: this.pos.y + (lying ? 0.5 : 1.85) };
  }
  checkHit(spec) {
    const o = this.opp;
    const A = this.hitbox(spec), B = o.hurtbox();
    if (A.x1 < B.x0 || A.x0 > B.x1 || A.y1 < B.y0 || A.y0 > B.y1) return false;
    const px = THREE.MathUtils.clamp((A.x0 + A.x1) / 2, B.x0, B.x1), py = THREE.MathUtils.clamp((Math.max(A.y0, B.y0) + Math.min(A.y1, B.y1)) / 2, B.y0 + 0.2, B.y1 - 0.1);
    return this.game.applyHit(this, o, spec, new THREE.Vector3(px - this.facing * 0.15, py, 0.35));
  }

  // ------------------------------------------------------------------ receive
  takeHit(att, spec, dmg, point) {
    this.hp = Math.max(0, this.hp - dmg);
    const launched = spec.up > 0 || !this.grounded || this.hp <= 0;
    const dir = Math.sign(this.pos.x - att.pos.x) || att.facing;
    this.move = null; for (const k in this.trails) this.trails[k].active = false;
    if (spec.pull) {
      this.vel.x = -dir * spec.pull;
    } else this.vel.x = dir * (spec.kb ?? 2);
    this.anim.flinch = 1; this.anim.flinchDir = dir;
    if (launched) {
      this.juggle++;
      const scale = Math.max(0.45, 1 - this.juggle * 0.12);
      this.vel.y = Math.max(spec.up ? spec.up * scale : 5 * scale, this.hp <= 0 ? 8 : 0);
      this.pos.y = Math.max(this.pos.y, 0.02);
      this.setState('airhit'); this.setAnim('launched', 0.04);
    } else {
      this.stun = spec.stun ?? 0.3;
      this.setState('hit'); this.setAnim(spec.kind === 'heavy' || dmg > 70 ? 'hitH' : 'hitL', 0.02);
    }
    this.U.uFlash.value = 1;
  }
  blockHit(att, spec) {
    const dir = Math.sign(this.pos.x - att.pos.x) || att.facing;
    this.vel.x = dir * (spec.kb ?? 2) * 0.6 + dir * 1.5;
    this.stun = (spec.stun ?? 0.3) * 0.7;
    this.setState('blockstun'); this.setAnim('block', 0.02);
    this.anim.flinch = 0.4; this.anim.flinchDir = dir;
  }
  isBlocking(att) {
    if (!this.grounded) return false;
    if (!['block', 'blockstun'].includes(this.state)) return false;
    return Math.sign(att.pos.x - this.pos.x) === this.facing || Math.abs(att.pos.x - this.pos.x) < 0.2;
  }

  // ------------------------------------------------------------------ visuals
  // anime motion lines streaking behind the body (used instead of afterimages for def.motionLines)
  // head cut off and falling (slow motion). If the victim survives it was only a vision of death:
  // the head snaps back after a moment.
  // mode 'waist': cut in half (Hollow Purple) — the upper body falls, the legs buckle
  behead(att, mode = 'head') {
    if (this.decap) this.decap.dispose();
    this.decap = new Decap(this.game, this, att.facing, mode); this.decapT = 0;
  }
  speedLines(n = 5) {
    const fx = this.game.fx;
    for (let i = 0; i < n; i++) {
      const y = this.pos.y + 0.2 + Math.random() * 1.6;
      const len = 0.9 + Math.random() * 1.8;
      fx.slashLine(new THREE.Vector3(this.pos.x - this.facing * (0.35 + len * 0.5 + Math.random() * 0.4), y, 0.35), 0, len, '#ffffff', 0.16 + Math.random() * 0.08, 0.025 + Math.random() * 0.03);
    }
  }
  spawnGhost(color) {
    if (this.def.motionLines) return this.speedLines();
    if (this.baseSrc && this.rigged !== this.baseSrc) return; // ghosts copy the normal body's pose
    const gh = this.ghosts.find(g => g.life <= 0) || this.ghosts[0];
    gh.life = 0.32; gh.holder.visible = true;
    gh.mat.color.set(color || this.def.aura);
    gh.holder.position.copy(this.root.position); gh.holder.scale.copy(this.root.scale); gh.holder.rotation.copy(this.root.rotation);
    gh.inst.group.rotation.copy(this.model.rotation); gh.inst.group.position.copy(this.model.position);
    gh.inst.copyPoseFrom(this.actor);
  }
  syncRoot() { // used by the KO replay (pose set directly, no animation update)
    this.root.position.set(this.pos.x, this.pos.y, this.pos.z || 0);
    this.root.scale.x = this.facing;
    this.auraMesh.visible = false;
  }
  updateVisual(dt, frozen) {
    if (!frozen) this.anim.update(dt);
    this.actor.updateFingers?.(frozen ? 0 : dt);
    if (this.decap) {
      this.decapT += frozen ? 0 : dt;
      this.decap.apply(this.decapT);
      if (this.decap.mode === 'waist' && this.state === 'ko' && this.decapT > 0.35 && this.animName !== 'down') this.setAnim('down', 0.45); // legs buckle
      if (this.hp > 0 && this.decapT > 1.1 && this.game.phase === 'fight') { // survived: it was a vision
        const p = this.boneWorld('head');
        this.decap.dispose(); this.decap = null;
        this.game.post.flash(0.25, '#ffffff', 0.85); this.game.fx.flash(p, '#ffffff', 2.2, 0.25);
        this.game.hud.pop('殺気', this.game.cam.project(p), '#ffffff', 1.3); sfx('teleport');
      }
    }
    this.root.position.set(this.pos.x, this.pos.y, this.pos.z || 0);
    this.root.scale.x = this.facing;
    this.U.uFlash.value = Math.max(0, this.U.uFlash.value - dt * 7);
    this.dispHp += (this.hp - this.dispHp) * (1 - Math.exp(-dt * 2.5));
    this.root.updateMatrixWorld(true);
    const tmp = new THREE.Vector3();
    for (const k in this.trails) {
      if (k.startsWith('w_')) weaponTip(this.actor.weapons[k.slice(2)], tmp); else this.boneWorld(k, tmp);
      tmp.z = 0.25; this.trails[k].update(tmp, dt);
    }
    // speedster afterimages while moving fast
    if (this.def.afterimage && !frozen && this.root.visible && ['walk', 'dash', 'attack', 'jump'].includes(this.state) && (Math.abs(this.vel.x) > 3.5 || this.state === 'attack' && this.anim.rootY > 0.2)) {
      this.speedGhostT = (this.speedGhostT ?? 0) - dt;
      if (this.speedGhostT <= 0) { this.spawnGhost(); this.speedGhostT = 0.07; }
    }
    for (const g of this.ghosts) {
      if (g.life > 0) { g.life -= dt; g.mat.opacity = Math.max(0, g.life / 0.32) * 0.55; if (g.life <= 0) g.holder.visible = false; }
    }
    // anime flame aura: full while charging supers/domains, flickering when the domain gauge is full
    const want = this.auraOn ? 1 : this.domain >= 100 ? 0.55 : 0;
    this.auraU.uAmt.value += (want - this.auraU.uAmt.value) * (1 - Math.exp(-dt * 8));
    this.auraU.uTime.value += dt;
    this.auraMesh.position.set(this.pos.x, this.pos.y + 0.95, 0);
    this.auraMesh.visible = this.auraU.uAmt.value > 0.01 && this.root.visible;
    if (this.auraOn && Math.random() < 0.5) this.game.fx.aura(this.pos.clone(), this.def.aura, 0.5);
  }
  dispose() {
    this.root.removeFromParent();
    for (const g of this.ghosts) g.holder.removeFromParent();
    for (const k in this.trails) this.trails[k].mesh.removeFromParent();
    this.auraMesh.removeFromParent();
  }
}
