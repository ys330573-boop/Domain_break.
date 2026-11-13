// CPU opponent: drives a VirtualController like a human would.
import { VirtualController } from './input.js';
import { MOVES } from './moves.js';

const LEVELS = {
  easy: { think: 0.34, block: 0.15, aggro: 0.4, special: 0.12, spark: 0.03, combo: 0.4 },
  normal: { think: 0.22, block: 0.4, aggro: 0.55, special: 0.25, spark: 0.08, combo: 0.7 },
  hard: { think: 0.12, block: 0.65, aggro: 0.7, special: 0.4, spark: 0.15, combo: 0.9 },
};

export class AI {
  constructor(fighter, level = 'normal') {
    this.f = fighter; this.L = LEVELS[level] || LEVELS.normal;
    this.ctrl = new VirtualController();
    this.timer = 0; this.mode = 'approach'; this.modeT = 0; this.comboStep = 0;
    fighter.isAI = true; fighter.aiSpark = this.L.spark;
  }
  update(dt) {
    const f = this.f, o = f.opp, c = this.ctrl, L = this.L;
    const dx = o.pos.x - f.pos.x, dist = Math.abs(dx), dir = Math.sign(dx) || 1;
    // continue combo when our hits land
    if (f.state === 'attack' && f.hitLanded && f.move?.chain && Math.random() < L.combo * dt * 12) {
      c.press(f.move.chain.light && Math.random() > 0.3 ? 'light' : 'heavy');
      if (f.move.id === 'kick' && f.energy > 30 && Math.random() < L.special) c.press(Math.random() > 0.5 ? 's2' : 's1');
    }
    // react: block incoming attacks
    const threat = (o.state === 'attack' && dist < 2.6) || (this.f.game.projectiles.some(p => p.owner === o && Math.abs(p.pos.x - f.pos.x) < 3.5 && Math.sign(p.vel.x) === Math.sign(f.pos.x - p.pos.x)));
    if (threat && ['idle', 'walk', 'block'].includes(f.state)) {
      if (this.blockDecision === undefined) {
        this.blockDecision = Math.random() < L.block;
        // sometimes escape with a backflip, or flip-kick a jumping opponent
        if ((f.has(MOVES.flipKick) || f.has(MOVES.spinSlash)) && !o.grounded && dist < 2 && Math.random() < L.block * 0.6) { c.left = c.right = false; this.walk(dir, -1); c.press('heavy'); this.blockDecision = false; return; }
        if (f.has(MOVES.backflip) && dist < 2 && Math.random() < L.block * 0.35) { c.left = c.right = false; this.walk(dir, -1); c.press('dash'); this.blockDecision = false; return; }
      }
      if (this.blockDecision) { c.left = c.right = false; c.down = true; return; }
    } else this.blockDecision = undefined;
    c.down = false;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = L.think * (0.6 + Math.random() * 0.8);
    c.left = c.right = false;
    if (!['idle', 'walk', 'jump'].includes(f.state)) return;
    // ultimate
    if (f.domain >= 100 && f.grounded && !['down', 'ko'].includes(o.state) && Math.random() < 0.5) { c.press('ult'); return; }
    const r = Math.random();
    if (dist > 4.5) {
      if (f.energy >= 20 && r < L.special) { c.press('s1'); return; }
      if (f.energy >= 60 && r < L.special * 0.5) { c.press('s3'); return; }
      if (r < 0.25) { c.press('dash'); return; }
      this.walk(dir, 1);
    } else if (dist > 1.6) {
      if (f.energy >= 30 && r < L.special * 0.6) { c.press('s2'); return; }
      if (r < L.aggro * 0.4) { c.press('dash'); return; }
      if (dist < 3.4 && f.has(MOVES.jumpKick) && r < 0.12 + L.aggro * 0.15) { this.walk(dir, 1); c.press('heavy'); return; }
      if (r < 0.12) { c.press('jump'); this.walk(dir, 1); return; }
      this.walk(dir, 1);
    } else {
      if (o.state === 'down' || o.state === 'getup') { this.walk(dir, -1); return; }
      if (r < L.aggro) {
        const h = Math.random() < 0.3;
        if (h && (f.has(MOVES.flipKick) || f.has(MOVES.spinSlash)) && Math.random() < 0.4) this.walk(dir, -1);
        c.press(h ? 'heavy' : 'light');
      }
      else if (r < L.aggro + 0.15) this.walk(dir, -1);
      else if (r < L.aggro + 0.22) c.press('jump');
    }
    if (!f.grounded && dist < 1.8) c.press('light');
  }
  walk(dir, sign) { const c = this.ctrl; if (dir * sign > 0) c.right = true; else c.left = true; }
}
