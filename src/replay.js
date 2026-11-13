// KO replay: the fight is recorded continuously (poses, positions, projectiles).
// On a KO: quick VHS-style REWIND, then the finishing blow replays in SLOW MOTION with
// cinematic cameras and a big impact frame at the moment of the hit.
import * as THREE from 'three';
import { sfx } from './audio.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const KEEP = 3.0;                 // seconds of history kept
const BEFORE = 1.15, AFTER = 0.55; // replay window around the KO moment
const REWIND_TIME = 1.1, SLOW = 0.32;

export class Recorder {
  constructor() { this.buf = []; this.rt = 0; }
  clear() { this.buf.length = 0; }
  record(g, dtGame) {
    if (g.cine) { this.buf.length = 0; return; }   // never replay into a domain cinematic
    this.rt += Math.max(dtGame, 0.004);             // hitstop frames still take a little replay time
    this.buf.push({
      rt: this.rt,
      f: g.fighters.map(f => ({ x: f.pos.x, y: f.pos.y, facing: f.facing, vis: f.root.visible, pose: f.actor.getPose(), flash: f.U.uFlash.value, decapT: f.decap ? f.decapT : null })),
      p: g.projectiles.filter(p => p.obj).map(p => ({ obj: p.obj, x: p.pos.x, y: p.pos.y, z: p.pos.z })),
    });
    while (this.buf.length && this.rt - this.buf[0].rt > KEEP) this.buf.shift();
  }
  // snapshot at replay-time rt (nearest frame)
  at(rt) {
    const B = this.buf; let lo = 0, hi = B.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].rt < rt) lo = m + 1; else hi = m; }
    return B[lo];
  }
}

export class KOReplay {
  constructor(g, rec, ko) {
    this.g = g; this.rec = rec; this.ko = ko; // ko = { rt, point, att, tgt, color }
    const B = rec.buf;
    this.start = Math.max(B[0].rt, ko.rt - BEFORE);
    this.end = Math.min(B[B.length - 1].rt, ko.rt + AFTER);
    this.ok = B.length > 20 && this.end - this.start > 0.6;
    this.phase = 'rewind'; this.t = 0; this.done = false; this.hitShown = false;
    this.shown = new Set();
    if (!this.ok) { this.done = true; return; }
    this.final = B[B.length - 1];
    g.hud.setVisible(false); g.post.letterbox = true;
    g.hud.replayTag('rewind');
    g.post.rewind = 1; sfx('teleport');
    const mid = V((ko.att.pos.x + ko.tgt.pos.x) / 2, 1.1, 0);
    g.cam.setShot(() => ({ pos: V(mid.x, 1.6, 8.5), look: mid, fov: 34, roll: 0 }), 0);
  }
  apply(s) {
    const g = this.g;
    s.f.forEach((d, i) => {
      const f = g.fighters[i];
      f.pos.x = d.x; f.pos.y = d.y; f.facing = d.facing; f.root.visible = d.vis;
      f.actor.setPose(d.pose); f.U.uFlash.value = d.flash;
      if (f.decap) { if (d.decapT != null) f.decap.apply(d.decapT); else f.decap.hide(); }
      f.syncRoot();
    });
    // projectiles that existed in this frame
    const now = new Set();
    for (const p of s.p) { now.add(p.obj); if (!p.obj.parent) g.scene.add(p.obj); p.obj.position.set(p.x, p.y, p.z); this.shown.add(p.obj); }
    for (const o of this.shown) if (!now.has(o)) o.removeFromParent();
  }
  update(dt) {
    if (this.done) return;
    const g = this.g, ko = this.ko;
    this.t += dt;
    if (this.phase === 'rewind') {
      const k = Math.min(1, this.t / REWIND_TIME);
      const rt = THREE.MathUtils.lerp(this.final.rt, this.start, k * k * (3 - 2 * k));
      this.apply(this.rec.at(rt));
      if (Math.random() < 0.3) sfx('ui');
      if (k >= 1) this.beginSlow();
    } else {
      const rt = this.start + this.t * SLOW;
      this.apply(this.rec.at(Math.min(rt, this.end)));
      if (!this.hitShown && rt >= ko.rt) this.impact();
      if (rt >= this.end + 0.15) this.finish();
    }
  }
  beginSlow() {
    const g = this.g, ko = this.ko;
    this.phase = 'slow'; this.t = 0;
    g.post.rewind = 0; g.post.flash(0.2, '#ffffff', 0.7);
    g.hud.replayTag('replay');
    // slow orbit around the two fighters, low angle
    const A = ko.att, T = ko.tgt;
    g.cam.setShot(t => {
      const mid = V((A.pos.x + T.pos.x) / 2, 1.05, 0);
      const a = -0.75 + t * 0.22;
      return { pos: V(mid.x + Math.sin(a) * 4.3, 0.55 + t * 0.08, Math.cos(a) * 4.3), look: mid.clone().add(V(0, 0.15, 0)), fov: 34, roll: 0.05 };
    }, 0);
  }
  impact() {
    const g = this.g, ko = this.ko;
    this.hitShown = true;
    g.post.impact(0.16, 1); g.post.flash(0.3, ko.color, 0.5); g.post.chroma(0.6, 2);
    g.post.setCenter(g.cam.project(ko.point)); g.post.speed(0.8, 1, '#ffffff');
    g.fx.hitSpark(ko.point, ko.color, 2.2, ko.att.facing); g.fx.impactBurst(ko.point, ko.color, 3);
    g.fx.ring(ko.point, '#ffffff', 5, 0.5); g.fx.blackSpark(ko.point, ko.color);
    g.cam.shake(0.9); g.cam.zoomPunch(0.3, 0.6);
    sfx('spark'); sfx('boom', 0.05);
    g.hud.pop('ドォン!!', g.cam.project(ko.point), ko.color, 1.8);
    // freeze-frame push-in on the victim
    const T = ko.tgt, side = -ko.att.facing;
    g.cam.setShot(t => {
      const c = V(T.pos.x, T.pos.y + 0.9, 0);
      return { pos: c.clone().add(V(side * 0.6, 0.35, 3.6 - t * 0.4)), look: c, fov: 34, roll: side * 0.1 };
    }, 0);
  }
  finish() {
    const g = this.g;
    this.done = true;
    g.post.rewind = 0; g.hud.replayTag(null);
    for (const o of this.shown) o.removeFromParent();
    this.apply(this.final);
    for (const o of this.shown) o.removeFromParent();
  }
}
