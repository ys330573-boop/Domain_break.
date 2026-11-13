// Match controller: rounds, hit resolution, hitstop, super-freeze, domains, KO slow-mo.
import * as THREE from 'three';
import { Fighter } from './fighter.js';
import { Stage } from './stage.js';
import { FX } from './fx.js';
import { CameraDirector } from './camera.js';
import { DomainSequence } from './domain.js';
import { KeyboardController, KEYMAPS } from './input.js';
import { AI } from './ai.js';
import { sfx } from './audio.js';
import { MatchIntro } from './intro.js';
import { Recorder, KOReplay } from './replay.js';
import { say, stopVoice } from './voice.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const POPS = { light: ['バシッ', 'ドッ', 'ガッ'], heavy: ['ドゴォ!', 'バキィ!', 'ドン!'], special: ['ズバッ', 'ゴォッ', 'ドォン!'] };
const pick = a => a[(Math.random() * a.length) | 0];

export class Game {
  constructor(renderer, post, hud, portraits) {
    this.renderer = renderer; this.post = post; this.hud = hud; this.portraits = portraits;
  }
  start({ defs, rigs, mode = 'cpu', level = 'normal', palette = 'dusk', onEnd }) {
    this.scene = new THREE.Scene();
    this.stage = new Stage(this.scene, palette);
    this.fx = new FX(this.scene);
    const size = this.renderer.getSize(new THREE.Vector2());
    this.cam = new CameraDirector(size.x / size.y);
    this.projectiles = [];
    this.fighters = [new Fighter(this, defs[0], rigs[0], 0), new Fighter(this, defs[1], rigs[1], 1)];
    this.ctrls = [new KeyboardController(KEYMAPS.p1, 0), null];
    this.ais = [];
    if (mode === 'cpu') { const ai = new AI(this.fighters[1], level); this.ais.push(ai); this.ctrls[1] = ai.ctrl; }
    else this.ctrls[1] = new KeyboardController(KEYMAPS.p2, 1);
    this.mode = mode; this.onEnd = onEnd;
    this.wins = [0, 0]; this.round = 1;
    this.time = 0; this.hitstop = 0; this.timeScale = 1; this.slowT = 0;
    this.freeze = null; this.cine = null; this.paused = false;
    this.rec = new Recorder(); this.koInfo = null; this.replay = null;
    this.hud.setup(this.fighters, this.portraits);
    this.hud.setVisible(false);
    this.post.grade({}); this.post.letterbox = true;
    this.resize();
    this.beginIntro();
  }
  resize() {
    const s = this.renderer.getSize(new THREE.Vector2());
    this.cam.cam.aspect = s.x / s.y; this.cam.cam.updateProjectionMatrix();
    this.fx.setScale(this.renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(15))));
  }

  // ------------------------------------------------------------- flow
  beginIntro() {
    this.phase = 'intro'; this.phaseT = 0;
    this.intro = new MatchIntro(this);
  }
  beginRound() {
    this.phase = 'ready'; this.phaseT = 0;
    const [a, b] = this.fighters;
    a.reset(-2.6); b.reset(2.6);
    if (this.round > 1) { a.domain = this.carry?.[0] ?? 0; b.domain = this.carry?.[1] ?? 0; }
    this.projectiles.forEach(p => p.obj?.removeFromParent()); this.projectiles = [];
    this.fx.clear(); this.hud.clearFx(); this.hud.resetTrails();
    this.rec.clear(); this.koInfo = null; this.replay = null;
    this.timer = 99; this.cam.clearShot(0.6); this.cam.focusOverride = null; this.post.letterbox = false;
    this.hud.setVisible(true);
    this.hud.announce(`ROUND ${this.round}`, 'round', 1100);
    sfx('gong');
    this.timeScale = 1;
  }
  // ------------------------------------------------------------- per-frame
  update(rawDt) {
    if (this.paused) return;
    const dt0 = Math.min(rawDt, 1 / 30);
    if (this.slowT > 0) { this.slowT -= dt0; if (this.slowT <= 0) this.timeScale = 1; }
    const dt = dt0 * this.timeScale;
    this.phaseT += dt0;
    if (this.phase === 'replay') { // KO replay drives the poses directly
      this.runPhase(dt0); this.fx.update(dt0);
      this.cam.update(dt0, this.fighters, this.stage.bounds);
      this.stage.update(dt0, this.cam.cam, null, this.time);
      this.post.update(dt0, this.time); this.hud.update(this.fighters, this.timer ?? 99, this.wins);
      return;
    }
    for (const c of this.ctrls) c?.update?.();
    this.runPhase(dt0);
    const fighting = this.phase === 'fight';
    // hitstop freezes the action but not the camera / post
    let frozen = false;
    if (this.hitstop > 0) { this.hitstop -= dt0; frozen = true; }
    if (!frozen) {
      this.time += dt;
      if (this.cine) this.cine.update(dt);
      if (fighting && !this.freeze && !this.cine) for (const ai of this.ais) ai.update(dt);
      for (let i = 0; i < 2; i++) {
        const f = this.fighters[i];
        if (this.freeze && this.freeze.f !== f) continue;
        f.update(dt, fighting && !this.cine ? this.ctrls[i] : null);
      }
      if (this.freeze) { this.freeze.t -= dt; if (this.freeze.t <= 0) this.endFreeze(); }
      this.pushApart();
      this.updateProjectiles(dt);
      this.fx.update(dt);
    }
    for (const f of this.fighters) f.updateVisual(frozen ? 0 : dt, frozen || (this.freeze && this.freeze.f !== f));
    if (this.phase === 'fight' || this.phase === 'ko') this.rec.record(this, frozen ? 0 : dt);
    // KOs that don't come from a normal hit (e.g. the final blow of a domain)
    if (fighting && !this.cine) for (const f of this.fighters) if (f.hp <= 0) { this.onKO(f.opp, f); break; }
    // timer
    if (fighting && !this.cine && !this.freeze) {
      this.timer -= dt;
      if (this.timer <= 0) this.timeUp();
    }
    this.cam.update(dt0, this.fighters, this.stage.bounds);
    this.stage.update(dt, this.cam.cam, this.phase === 'fight' ? this.fx : null, this.time);
    this.post.update(dt0, this.time);
    this.hud.update(this.fighters, this.timer ?? 99, this.wins);
  }
  runPhase(dt) {
    const T = this.phaseT;
    const [a, b] = this.fighters;
    if (this.phase === 'intro') {
      const skip = T > 0.5 && (this.ctrls[0].pressed?.('light') || this.ctrls[0].pressed?.('jump'));
      if (skip) this.intro.skip(); else this.intro.update(dt);
    } else if (this.phase === 'ready') {
      if (T > 1.2 && !this._fightCalled) { this._fightCalled = true; this.hud.announce('FIGHT!', 'fight', 900); sfx('boom'); this.cam.shake(0.3); }
      if (T > 1.5) { this._fightCalled = false; this.phase = 'fight'; this.phaseT = 0; for (const f of this.fighters) f.toNeutral(); }
    } else if (this.phase === 'ko') {
      if (T > 2.1) {
        if (this.koInfo) { // rewind + slow-motion replay of the finishing blow
          this.replay = new KOReplay(this, this.rec, this.koInfo); this.koInfo = null;
          if (!this.replay.done) { this.phase = 'replay'; this.phaseT = 0; return; }
        }
        this.showWinner();
      }
    } else if (this.phase === 'replay') {
      this.replay.update(dt);
      if (this.replay.done) this.showWinner();
    } else if (this.phase === 'win') {
      if ((T > 3.4 && this._winVoiceDone) || T > 7) {
        stopVoice();
        if (this.wins[this.koWinner] >= 2) { this.phase = 'end'; this.onEnd?.(this.koWinner, this.fighters); }
        else { this.round++; this.carry = this.fighters.map(f => f.domain); this.beginRound(); }
      }
    }
  }
  showWinner() {
    this.phase = 'win'; this.phaseT = 0; this.timeScale = 1;
    const w = this.fighters[this.koWinner];
    if (w.state !== 'ko') { w.setState('win'); w.vel.set(0, 0, 0); w.setAnim('victory', 0.3); w.faceOpp(); }
    const wp = w.pos.clone(); const fr = V(Math.cos(0.42) * w.facing, 0, Math.sin(0.42));
    this.cam.setShot(t => ({ pos: wp.clone().add(fr.clone().multiplyScalar(3.2 - t * 0.2)).add(V(0, 1.0, 0)), look: wp.clone().add(V(0, 1.2, 0)), fov: 32, roll: 0.03 }), 0.6);
    this.post.letterbox = true; this.hud.setVisible(false);
    this.hud.announce(`<span style="color:${w.def.color}">${w.def.name}</span> WINS`, 'wins', 2600);
    this._winVoiceDone = false;
    const line = w.def.lines?.win;
    setTimeout(() => {
      if (this.phase !== 'win') return;
      if (line) this.hud.dialog(w, line, 3400);
      say(w.def, 'win').then(() => { this._winVoiceDone = true; });
    }, 500);
  }
  timeUp() {
    const [a, b] = this.fighters;
    const w = a.hp / a.maxHp >= b.hp / b.maxHp ? 0 : 1;
    this.hud.announce('TIME', 'ko', 1500);
    this.endRound(w);
  }
  endRound(winner) {
    this.phase = 'ko'; this.phaseT = 0; this.koWinner = winner; this.wins[winner]++;
  }
  onKO(att, tgt, point, color) {
    if (this.phase !== 'fight') return;
    this.endRound(att.slot);
    this.koInfo = { rt: this.rec.rt, att, tgt, point: (point || tgt.pos.clone().add(V(0, 1.1, 0.3))).clone(), color: color || att.def.color };
    this.timeScale = 0.25; this.slowT = 1.4;
    this.post.impact(0.12, 0); this.post.flash(0.4, '#ffffff', 0.6);
    this.hud.announce('K.O.', 'ko', 2400); sfx('ko');
    this.cam.zoomPunch(0.5, 1.2); this.cam.dutch(0.15, 1.5);
  }
  pushApart() {
    const [a, b] = this.fighters;
    if (this.cine) return;
    if (['down', 'ko'].includes(a.state) || ['down', 'ko'].includes(b.state)) return;
    const dx = b.pos.x - a.pos.x, dy = Math.abs(b.pos.y - a.pos.y);
    const minD = 0.72;
    if (Math.abs(dx) < minD && dy < 1.4) {
      const push = (minD - Math.abs(dx)) / 2 * (Math.sign(dx) || 1);
      a.pos.x -= push; b.pos.x += push;
      const [b0, b1] = this.stage.bounds;
      for (const f of this.fighters) f.pos.x = THREE.MathUtils.clamp(f.pos.x, b0, b1);
      if (Math.abs(b.pos.x - a.pos.x) < minD * 0.9) { // cornered: push the other one out
        if (a.pos.x <= b0 + 0.01) b.pos.x = a.pos.x + minD; else if (b.pos.x >= b1 - 0.01) a.pos.x = b.pos.x - minD;
        else if (b.pos.x <= b0 + 0.01) a.pos.x = b.pos.x + minD; else if (a.pos.x >= b1 - 0.01) b.pos.x = a.pos.x - minD;
      }
    }
  }

  // ------------------------------------------------------------- combat
  applyHit(att, tgt, spec, point, opts = {}) {
    if (this.phase !== 'fight' && this.phase !== 'ko') return false;
    if (tgt.invuln > 0 || ['cine', 'ko', 'intro', 'win', 'down', 'getup'].includes(tgt.state)) return false;
    if (!opts.projectile) att.hitLanded = true;
    const color = spec.color || att.def.color;
    const uv = this.cam.project(point);
    this.post.setCenter(uv);
    if (tgt.isBlocking(att) && !spec.unblockable) {
      const chip = Math.min(tgt.hp - 1, spec.dmg * (spec.chip ?? 0.1));
      tgt.hp -= Math.max(0, chip); tgt.blockHit(att, spec);
      this.fx.hitSpark(point, '#ffffff', 0.6, att.facing); this.fx.ring(point, '#bfe8ff', 1.2, 0.2);
      this.hitstop = 0.04; sfx('block'); this.cam.shake(0.08);
      att.energy = Math.min(100, att.energy + 2); tgt.domain = Math.min(100, tgt.domain + 2);
      return true;
    }
    if (spec.unblockable && tgt.isBlocking(att)) { this.hud.pop('GUARD BREAK', uv, '#fff', 0.8); }
    const spark = !opts.projectile && att.sparkArmed && att.move?.normal;
    if (spark) { att.sparkArmed = false; att.lastSparkT = this.time; } // only the first hit of a move can spark
    let dmg = spec.dmg * 0.8 * Math.max(0.4, 1 - 0.08 * att.combo);
    if (spark) dmg = spec.dmg * 2.2;
    tgt.takeHit(att, spec, dmg, point);
    att.combo++; att.comboTimer = 1.1; this.hud.combo(att.slot, att.combo);
    att.lastHitT = this.time;
    att.energy = Math.min(100, att.energy + dmg * 0.07);
    att.domain = Math.min(100, att.domain + dmg * 0.05 + (spark ? 15 : 0));
    tgt.domain = Math.min(100, tgt.domain + dmg * 0.04);
    // feedback
    const big = spec.kind === 'heavy' || dmg >= 70;
    this.fx.hitSpark(point, color, big ? 1.5 : 0.9, att.facing);
    if (big) { this.fx.impactBurst(point, color, 1.8); this.fx.ring(point, '#ffffff', 2.4, 0.25); }
    this.hitstop = spec.hitstop ?? 0.05;
    this.cam.shake(big ? 0.45 : 0.16);
    if (big) this.cam.zoomPunch(0.12, 0.18);
    if (spec.impact) { this.post.impact(0.07, spec.impactMode ?? 0); this.post.chroma(0.25, 1); this.cam.dutch(0.06, 0.3); }
    sfx(big ? 'hitH' : spec.kind === 'special' && att.def.kit === 'shrine' ? 'slash' : 'hitL');
    this.hud.pop(pick(POPS[big ? 'heavy' : spec.kind === 'special' ? 'special' : 'light']), uv, color, big ? 1.4 : 0.9);
    if (big && tgt.grounded) this.fx.dust(V(tgt.pos.x, 0.05, 0), 0.6);
    if (spark) this.sparkFX(att, tgt, point, uv);
    this.hud.damage(tgt.slot, dmg, big || spark);
    if (tgt.hp <= 0) this.onKO(att, tgt, point, color);
    return true;
  }
  sparkFX(att, tgt, point, uv) {
    this.hitstop = 0.3;
    this.post.impact(0.14, 1); this.post.flash(0.3, '#ff1030', 0.5); this.post.chroma(0.5, 2.5); this.post.speed(0.5, 1, '#000000');
    this.fx.blackSpark(point, '#ff1030');
    this.cam.zoomPunch(0.35, 0.4); this.cam.dutch(0.14, 0.5); this.cam.shake(0.8);
    this.hud.spark(uv); sfx('spark');
    tgt.vel.x *= 1.6;
  }
  spawnProjectile(p) {
    p.t = 0; p.hitCD = 0; p.pos = p.pos.clone();
    if (p.obj) { p.obj.position.copy(p.pos); this.scene.add(p.obj); }
    this.projectiles.push(p); return p;
  }
  updateProjectiles(dt) {
    const P = this.projectiles;
    for (const p of P) {
      if (this.freeze && this.freeze.f !== p.owner) continue;
      p.t += dt; p.hitCD -= dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.obj) p.obj.position.copy(p.pos);
      p.update?.(p, dt);
      const tgt = p.owner.opp, hb = tgt.hurtbox();
      const cx = THREE.MathUtils.clamp(p.pos.x, hb.x0, hb.x1), cy = THREE.MathUtils.clamp(p.pos.y, hb.y0, hb.y1);
      if (p.hitCD <= 0 && Math.hypot(p.pos.x - cx, p.pos.y - cy) < p.radius) {
        if (this.applyHit(p.owner, tgt, p.hit, V(cx, cy, 0.4), { projectile: true })) {
          p.hits--; p.hitCD = p.interval; p.onHit?.(p, tgt);
          if (p.hits <= 0) p.dead = true;
        }
      }
      // projectile clash
      for (const q of P) if (q !== p && q.owner !== p.owner && !q.dead && p.pos.distanceTo(q.pos) < p.radius + q.radius) {
        p.dead = q.dead = true; this.fx.flash(p.pos, '#ffffff', 3, 0.3); this.fx.ring(p.pos, '#ffffff', 3, 0.3); sfx('boom'); this.cam.shake(0.3);
      }
      if (p.t > p.life || Math.abs(p.pos.x) > 30) p.dead = true;
      if (p.dead) { p.onEnd?.(p); p.obj?.removeFromParent(); }
    }
    this.projectiles = P.filter(p => !p.dead);
  }
  superFreeze(f, dur) {
    this.freeze = { f, t: dur };
    const off = V(f.facing * 1.1, 0, 2.2).normalize(), hp = f.boneWorld('chest');
    this.cam.setShot(t => ({ pos: hp.clone().add(off.clone().multiplyScalar(3.1 - t * 0.7)).add(V(0, 0.05 - t * 0.2, 0)), look: hp.clone().add(V(f.facing * 0.3, 0.1, 0)), fov: 32, roll: f.facing * 0.07 }), 0.08);
    this.post.grade({ sat: 0.35, contrast: 1.3, halftone: 0.9 }); this.post.flash(0.15, f.def.aura, 0.6);
    this.hud.cutin(f, f.move?.name || '', this.portraits[f.def.id]);
    f.auraOn = true; sfx('charge');
  }
  endFreeze() {
    const f = this.freeze.f; this.freeze = null; f.auraOn = false;
    this.cam.clearShot(0.2); this.post.grade({});
  }
  startDomain(f, type) {
    f.domain = 0;
    new DomainSequence(this, f, type);
  }
  setDomainEnv(env, caster) {
    this.stage.setVisible(false);
    if (!env.userData.lights) {
      const amb = new THREE.HemisphereLight(env.userData.amb, '#000000', 1.6), sun = new THREE.DirectionalLight(env.userData.light, 2.4);
      sun.position.set(-3, 6, 6); env.add(amb, sun); env.userData.lights = true;
    }
    env.position.x = caster.pos.x;
    this.scene.add(env);
    this._savedBg = this.scene.background; this._savedFog = this.scene.fog;
    this.scene.background = new THREE.Color(env.userData.bg); this.scene.fog = null;
    this.domainEnv = env;
  }
  clearDomainEnv() {
    if (this.domainEnv) this.domainEnv.removeFromParent();
    this.domainEnv = null; this.stage.setVisible(true);
    this.scene.background = this._savedBg; this.scene.fog = this._savedFog;
  }
  render() { this.post.render(this.scene, this.cam.cam); }
  dispose() {
    stopVoice(); this.hud.replayTag(null); this.post.rewind = 0;
    for (const f of this.fighters) f.dispose();
    this.fx.clear(); this.hud.clearFx();
    this.scene = null;
  }
}
