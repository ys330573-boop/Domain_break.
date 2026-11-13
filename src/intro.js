// Match intro cinematic:
//  1. crane shot from straight overhead sweeping down to street level (stage title)
//  2. Player 1 walks in from the left  -> close-up, name card, signature line (voice)
//  3. Player 2 walks in from the right -> close-up, name card, signature line (voice)
//  4. wide face-off "VS" -> ROUND 1
import * as THREE from 'three';
import { say, stopVoice } from './voice.js';
import { sfx } from './audio.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const WALK_SPEED = 2.9, START_X = 8.5, SPOT_X = 2.6;

export class MatchIntro {
  constructor(g) {
    this.g = g; this.done = false;
    const [a, b] = g.fighters;
    a.reset(-START_X); b.reset(START_X);
    for (const f of g.fighters) { f.setState('intro'); f.setAnim('idle', 0); }
    g.hud.setVisible(false); g.post.letterbox = true;
    this.steps = [
      this.crane(),
      this.walkIn(a, -SPOT_X), this.talk(a),
      this.walkIn(b, SPOT_X), this.talk(b),
      this.faceOff(),
    ];
    this.i = -1; this.next();
  }
  next() {
    this.i++; this.t = 0;
    if (this.i >= this.steps.length) { this.finish(); return; }
    this.steps[this.i].enter?.();
  }
  update(dt) {
    if (this.done) return;
    this.t += dt;
    const s = this.steps[this.i];
    s.update?.(dt, this.t);
    if (s.isDone(this.t)) this.next();
  }
  skip() { stopVoice(); this.finish(); }
  finish() {
    if (this.done) return;
    this.done = true;
    this.g.hud.clearFx();
    this.g.beginRound();
  }
  // ---------------------------------------------------------------- steps
  crane() {
    const g = this.g, D = 2.8;
    return {
      enter: () => {
        g.cam.setShot(t => {
          const e = ease(t / D);
          return { pos: V(Math.sin(e * Math.PI) * 2.8, THREE.MathUtils.lerp(26, 1.7, e), THREE.MathUtils.lerp(4.5, 10, e)),
            look: V(0, THREE.MathUtils.lerp(0, 1.0, e), THREE.MathUtils.lerp(-1.5, 0, e)), fov: THREE.MathUtils.lerp(40, 32, e), roll: (1 - e) * 0.35 };
        }, 0);
        g.hud.announce(`<div class="stagename"><i>STAGE</i><b>${g.stage.pal.name}</b></div>`, 'introwrap', 2600);
        sfx('whoosh');
      },
      isDone: t => t > D,
    };
  }
  walkIn(f, target) {
    const g = this.g;
    return {
      enter: () => {
        f.setAnim('walkF', 0.2);
        g.cam.setShot(() => ({ pos: V(f.pos.x + f.facing * 2.7, 1.0, 3.3), look: V(f.pos.x + f.facing * 0.3, 1.05, 0), fov: 34, roll: -f.facing * 0.03 }), 0);
      },
      update: (dt) => {
        const d = target - f.pos.x;
        f.pos.x += Math.sign(d) * Math.min(Math.abs(d), WALK_SPEED * dt);
      },
      isDone: () => Math.abs(target - f.pos.x) < 0.01,
    };
  }
  talk(f) {
    const g = this.g;
    let voiceDone = false;
    return {
      enter: () => {
        f.setAnim('intro', 0.25);
        const head = f.boneWorld('head');
        const fr = V(Math.cos(0.42) * f.facing, 0, Math.sin(0.42));
        g.cam.setShot(t => ({ pos: head.clone().add(fr.clone().multiplyScalar(2.2 - t * 0.12)).add(V(0, -0.02, 0)), look: head.clone().add(V(0, -0.04, 0)), fov: 30, roll: f.facing * 0.04 }), 0);
        g.hud.announce(`<div class="introcard ${f.slot ? 'right' : 'left'}" style="--c:${f.def.color}"><b>${f.def.name}</b><i>${f.def.title}</i></div>`, 'introwrap', 2800);
        const line = f.def.lines?.intro;
        if (line) g.hud.dialog(f, line, 3200);
        say(f.def, 'intro').then(() => { voiceDone = true; });
        f.U.uFlash.value = 0.6; sfx('whoosh');
      },
      isDone: t => (t > 1.8 && voiceDone) || t > 6.5,
    };
  }
  faceOff() {
    const g = this.g;
    return {
      enter: () => {
        for (const f of g.fighters) f.setAnim('idle', 0.2);
        g.cam.setShot(t => ({ pos: V(0, 0.55 + t * 0.2, 7.2 - t * 0.4), look: V(0, 1.25, 0), fov: 36, roll: 0 }), 0);
        g.hud.announce('VS', 'vsflash', 1300);
        sfx('boom'); g.cam.shake(0.3); g.post.flash(0.15, '#ffffff', 0.6);
      },
      isDone: t => t > 1.3,
    };
  }
}
