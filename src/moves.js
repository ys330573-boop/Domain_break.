// Movesets. A move = { clip, dur, events:[{t, hit|vel|sfx|trail|clip|fn}], chain, cost, ... }
// hit spec: x0..x1 (forward from fighter), y0..y1, dmg, stun, kb, up (launch), kind, hitstop, color
import * as THREE from 'three';
import { sfx } from './audio.js';
import { weaponTip } from './weapons.js';
import { HOLLOW_PURPLE } from './purple.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ shared normals
export const MOVES = {
  jab: { clip: 'jab', dur: 0.3, cancel: 0.13, normal: true, button: 'light', chain: { light: 'cross', heavy: 'heavy' },
    events: [{ t: 0, vel: [1.6], sfx: 'whoosh', trail: 'hand_L' }, { t: 0.06, hit: { x0: 0.1, x1: 1.15, y0: 0.9, y1: 1.7, dmg: 32, stun: 0.32, kb: 1.6, kind: 'light', hitstop: 0.05 } }] },
  cross: { clip: 'cross', dur: 0.36, cancel: 0.16, normal: true, button: 'light', chain: { light: 'kick', heavy: 'heavy' },
    events: [{ t: 0, vel: [2.4], sfx: 'whoosh', trail: 'hand_R' }, { t: 0.07, hit: { x0: 0.1, x1: 1.25, y0: 0.9, y1: 1.7, dmg: 38, stun: 0.36, kb: 2, kind: 'light', hitstop: 0.06 } }] },
  kick: { clip: 'kick', dur: 0.48, cancel: 0.26, normal: true, button: 'light', chain: { heavy: 'heavy' },
    events: [{ t: 0.02, vel: [2.2], sfx: 'whoosh', trail: 'foot_R' }, { t: 0.14, hit: { x0: 0.1, x1: 1.5, y0: 0.7, y1: 1.9, dmg: 60, stun: 0.5, kb: 7.5, kind: 'heavy', hitstop: 0.09 } }] },
  heavy: { clip: 'heavy', dur: 0.64, cancel: 0.4, normal: true, button: 'heavy',
    events: [{ t: 0.12, vel: [3], sfx: 'whoosh', trail: ['hand_R', 'hand_L'] }, { t: 0.2, vel: [2, 3] }, { t: 0.21, hit: { x0: 0, x1: 1.3, y0: 0.6, y1: 2.2, dmg: 80, kb: 2.5, up: 13, kind: 'heavy', hitstop: 0.11, impact: true } }] },
  airLight: { clip: 'airAtk', dur: 0.38, air: true, normal: true, button: 'light',
    events: [{ t: 0, sfx: 'whoosh', trail: 'foot_R' }, { t: 0.08, hit: { x0: 0, x1: 1.2, y0: -0.2, y1: 1.2, dmg: 40, stun: 0.4, kb: 3, kind: 'light', hitstop: 0.06 } }] },
  airHeavy: { clip: 'airAtk', dur: 0.5, air: true, normal: true, button: 'heavy', speed: 0.8,
    events: [{ t: 0, sfx: 'whoosh', trail: ['foot_R', 'foot_L'] }, { t: 0.06, vel: [7, -14] }, { t: 0.08, hit: { x0: -0.1, x1: 1.2, y0: -0.4, y1: 1.0, dmg: 70, kb: 6, up: 6, kind: 'heavy', hitstop: 0.1, impact: true, active: 0.3 } }],
    update(f, g) { if (f.grounded && f.moveT > 0.1 && !f._slam) { f._slam = true; g.fx.shockwave(V(f.pos.x, 0.05, 0), f.def.color, 3); g.fx.groundCrack(V(f.pos.x, 0, 0), 2); g.cam.shake(0.5); sfx('boom'); } },
    start(f) { f._slam = false; } },
};
// ---- moves that need a real animation clip (only offered when the character's rig has it)
// → + Heavy: running double jump-kick (root motion carries the fighter forward)
MOVES.jumpKick = { clip: 'jumpKick', needs: 'jumpKick', dur: 1.0, cancel: 0.8, normal: true, button: 'heavy', friction: 14,
  events: [{ t: 0, sfx: 'whoosh' }, { t: 0.3, trail: 'foot_R', sfx: 'whoosh' },
    { t: 0.42, hit: { x0: -0.1, x1: 1.5, y0: 0.5, y1: 1.9, dmg: 42, stun: 0.55, kb: 2.5, kind: 'light', hitstop: 0.06, active: 0.12 } },
    { t: 0.56, trail: 'foot_L', sfx: 'whoosh' },
    { t: 0.64, hit: { x0: -0.1, x1: 1.6, y0: 0.8, y1: 2.3, dmg: 62, kb: 7, up: 9, kind: 'heavy', hitstop: 0.1, impact: true, active: 0.12 } },
    { t: 0.8, trailOff: true }],
  update(f, g) { if (f.moveT > 0.72 && f.moveT < 0.76 && !f._landFx) { f._landFx = true; g.fx.dust(V(f.pos.x, 0.05, 0), 0.8); sfx('land'); } },
  start(f) { f._landFx = false; } };
// ← + Heavy: somersault flip-kick — the feet's arc over the head is the hitbox (anti-air launcher)
MOVES.flipKick = { clip: 'flipKick', needs: 'flipKick', dur: 0.95, cancel: 0.7, normal: true, button: 'heavy', friction: 10,
  events: [{ t: 0.08, fn: f => { f.invuln = 0.28; } }, { t: 0.16, sfx: 'jump' }, { t: 0.2, trail: ['foot_L', 'foot_R'], sfx: 'whoosh' },
    { t: 0.24, hit: { x0: -0.3, x1: 1.35, y0: 0.6, y1: 2.9, dmg: 72, kb: 3, up: 13.5, kind: 'heavy', hitstop: 0.11, impact: true, active: 0.14 },
      fn: (f, g) => g.fx.slashArc(V(f.pos.x + f.facing * 0.5, f.pos.y + 1.9, 0.3), f.def.color, { size: 2.6, rotZ: f.facing > 0 ? 0.6 : -0.6, flip: -f.facing }) },
    { t: 0.45, trailOff: true }, { t: 0.58, fn: (f, g) => { g.fx.dust(V(f.pos.x, 0.05, 0), 0.6); sfx('land'); } }] };
// ← + Dash: backflip evade (invulnerable while flipping away)
MOVES.backflip = { clip: 'backflip', needs: 'backflip', dur: 0.78, friction: 0.5, ghosts: true,
  events: [{ t: 0.1, fn: f => { f.invuln = 0.42; } }, { t: 0.14, vel: [-8.5], sfx: 'jump' }, { t: 0.5, vel: [-1.2] },
    { t: 0.54, fn: (f, g) => { g.fx.dust(V(f.pos.x, 0.05, 0), 0.6); sfx('land'); } }] };

// ---- clip-driven light string (J J J J) + chop. Timings match the melee_combo / kick_spinning clips.
MOVES.cJab = { clip: 'comboJab', needs: 'comboJab', dur: 0.32, cancel: 0.16, normal: true, button: 'light', chain: { light: 'cKick', heavy: 'heavy' }, friction: 12,
  events: [{ t: 0, sfx: 'whoosh', trail: ['hand_R', 'hand_L'] }, { t: 0.1, hit: { x0: 0.1, x1: 1.3, y0: 0.9, y1: 1.8, dmg: 32, stun: 0.36, kb: 1.6, kind: 'light', hitstop: 0.05, active: 0.08 } }] };
MOVES.cKick = { clip: 'comboKick', needs: 'comboKick', dur: 0.42, cancel: 0.2, normal: true, button: 'light', chain: { light: 'cLunge', heavy: 'heavy' }, friction: 12,
  events: [{ t: 0, sfx: 'whoosh', trail: 'foot_R' }, { t: 0.08, hit: { x0: 0, x1: 1.5, y0: 0.5, y1: 1.6, dmg: 38, stun: 0.42, kb: 2, kind: 'light', hitstop: 0.06, active: 0.12 } }] };
MOVES.cLunge = { clip: 'comboLunge', needs: 'comboLunge', dur: 0.46, cancel: 0.26, normal: true, button: 'light', chain: { light: 'cSpin', heavy: 'heavy' }, friction: 12,
  events: [{ t: 0.05, sfx: 'whoosh', trail: 'hand_R' }, { t: 0.16, hit: { x0: 0, x1: 1.75, y0: 0.35, y1: 1.4, dmg: 44, stun: 0.5, kb: 3, kind: 'light', hitstop: 0.07, active: 0.1 } }] };
MOVES.cSpin = { clip: 'spinKick', needs: 'spinKick', dur: 0.86, cancel: 0.6, normal: true, button: 'light', chain: { heavy: 'heavy' }, friction: 12,
  events: [{ t: 0.02, sfx: 'whoosh' }, { t: 0.18, trail: 'foot_L', sfx: 'whoosh' },
    { t: 0.28, hit: { x0: -0.1, x1: 1.75, y0: 0.8, y1: 2.3, dmg: 70, kb: 9, up: 5, kind: 'heavy', hitstop: 0.11, impact: true, active: 0.12 },
      fn: (f, g) => g.fx.slashArc(V(f.pos.x + f.facing * 0.7, f.pos.y + 1.55, 0.3), f.def.color, { size: 2.8, rotZ: 0, flip: f.facing }) },
    { t: 0.5, trailOff: true }] };
// → + K when the rig has a chop but no jump-kick
MOVES.chop = { clip: 'chop', needs: 'chop', dur: 0.64, cancel: 0.4, normal: true, button: 'heavy',
  events: [{ t: 0.08, vel: [2.5], sfx: 'whoosh', trail: 'hand_R' },
    { t: 0.21, hit: { x0: 0, x1: 1.35, y0: 0.4, y1: 2.1, dmg: 78, kb: 6, up: 4, kind: 'heavy', hitstop: 0.11, impact: true },
      fn: (f, g) => g.fx.groundCrack(V(f.pos.x + f.facing * 1.1, 0, 0), 1.6) }] };

// K : heavy straight (characters with a 'crossHeavy' clip) — big knockback, can wall-bounce
MOVES.crossHeavy = { clip: 'crossHeavy', needs: 'crossHeavy', dur: 0.6, cancel: 0.36, normal: true, button: 'heavy', friction: 10,
  events: [{ t: 0.04, vel: [3], sfx: 'whoosh', trail: ['hand_R'] },
    { t: 0.15, hit: { x0: 0, x1: 1.45, y0: 0.8, y1: 1.9, dmg: 76, kb: 12, up: 4.5, kind: 'heavy', hitstop: 0.12, impact: true, active: 0.08 } }] };
// ← + K : hop + spinning slashes, last one launches (anti-air)
const spinArc = (rot) => (f, g) => g.fx.slashArc(V(f.pos.x + f.facing * 0.75, f.pos.y + 1.35, 0.35), f.def.color, { size: 2.4, rotZ: f.facing > 0 ? rot : -rot, flip: f.facing });
MOVES.spinSlash = { clip: 'spinSlash', needs: 'spinSlash', dur: 0.82, cancel: 0.6, normal: true, button: 'heavy', friction: 10,
  events: [{ t: 0, fn: f => { f.invuln = 0.2; }, sfx: 'slash', trail: ['hand_R', 'hand_L'] },
    { t: 0.1, fn: spinArc(0.5), hit: { x0: -0.2, x1: 1.5, y0: 0.6, y1: 2.6, dmg: 24, stun: 0.5, kb: 1, kind: 'special', hitstop: 0.04, active: 0.06, color: '#ff3048' } },
    { t: 0.3, sfx: 'slash', fn: spinArc(-0.4), hit: { x0: -0.2, x1: 1.5, y0: 0.6, y1: 2.6, dmg: 24, stun: 0.5, kb: 1, kind: 'special', hitstop: 0.04, active: 0.06, color: '#ff3048' } },
    { t: 0.41, sfx: 'slash', fn: spinArc(0.9), hit: { x0: -0.2, x1: 1.55, y0: 0.4, y1: 2.6, dmg: 46, kb: 3, up: 12.5, kind: 'heavy', hitstop: 0.1, impact: true, impactMode: 1, active: 0.08, color: '#ff3048' } },
    { t: 0.55, trailOff: true, fn: (f, g) => { g.fx.dust(V(f.pos.x, 0.05, 0), 0.7); sfx('land'); } }] };

// ---- weapon moves (characters whose rig has a 'blade' weapon + these clips). Timings match the
//      roster's clip `from`/`speed` (Toji: sword_regular_c, sword_uppercut, aerial_dive_kick).
const bladeArc = (y, rot, size = 2.6) => (f, g) => g.fx.slashArc(V(f.pos.x + f.facing * 0.9, f.pos.y + y, 0.35), f.def.accent || '#ffffff', { size, rotZ: f.facing > 0 ? rot : -rot, flip: f.facing });
// K : three-cut blade rush that carries the fighter forward
MOVES.bladeRush = { clip: 'bladeRush', needs: 'bladeRush', dur: 1.02, cancel: 0.84, normal: true, button: 'heavy', friction: 12,
  events: [{ t: 0, sfx: 'slash', trail: 'w_blade' },
    { t: 0.07, fn: bladeArc(0.9, 0.35), hit: { x0: 0, x1: 1.75, y0: 0.3, y1: 1.9, dmg: 34, stun: 0.5, kb: 1.5, kind: 'special', hitstop: 0.05, active: 0.08 } },
    { t: 0.3, sfx: 'slash', fn: bladeArc(1.1, -0.5) },
    { t: 0.33, hit: { x0: 0, x1: 1.75, y0: 0.4, y1: 2.0, dmg: 38, stun: 0.55, kb: 1.5, kind: 'special', hitstop: 0.06, active: 0.08 } },
    { t: 0.66, sfx: 'slash', fn: bladeArc(1.0, 0.9, 3) },
    { t: 0.7, hit: { x0: -0.1, x1: 1.85, y0: 0.2, y1: 2.2, dmg: 72, kb: 8, up: 7, kind: 'heavy', hitstop: 0.11, impact: true, active: 0.1 } },
    { t: 0.85, trailOff: true }] };
// <- + K : rising blade - invulnerable anti-air launcher; the clip's jump really lifts the fighter
MOVES.bladeRise = { clip: 'bladeRise', needs: 'bladeRise', dur: 0.6, normal: true, button: 'heavy', friction: 8,
  events: [{ t: 0.04, fn: f => { f.invuln = 0.22; } }, { t: 0.1, sfx: 'slash', trail: 'w_blade' },
    { t: 0.14, fn: bladeArc(1.6, 1.25, 3), hit: { x0: -0.3, x1: 1.55, y0: 0.3, y1: 3.2, dmg: 76, kb: 2.5, up: 14.5, kind: 'heavy', hitstop: 0.1, impact: true, active: 0.14 } },
    { t: 0.45, trailOff: true }] };
// -> + K : flying front kick (root motion)
MOVES.diveKick = { clip: 'diveKick', needs: 'diveKick', dur: 0.84, cancel: 0.62, normal: true, button: 'heavy', friction: 12,
  events: [{ t: 0, sfx: 'whoosh' }, { t: 0.16, trail: 'foot_L', sfx: 'whoosh' },
    { t: 0.24, hit: { x0: 0, x1: 1.6, y0: 0.6, y1: 2.1, dmg: 70, kb: 9.5, up: 4, kind: 'heavy', hitstop: 0.1, impact: true, active: 0.12 } },
    { t: 0.5, trailOff: true }] };

for (const k in MOVES) MOVES[k].id = k;

// ------------------------------------------------------------------ helpers
function handPos(f, side = 'R') { return f.boneWorld('hand_' + side); }

function projectile(g, f, o) {
  return g.spawnProjectile(Object.assign({ owner: f, radius: 0.45, life: 1.5, hits: 1, interval: 0.15 }, o));
}

function chargeAt(g, f, side, color, dur = 0.4) {
  const fx = g.fx;
  const p = handPos(f, side);
  for (let i = 0; i < 18; i++) {
    const off = V((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4, (Math.random() - 0.5));
    fx.glow.emit({ pos: p.clone().add(off), vel: off.clone().multiplyScalar(-1 / dur), t: 0, life: dur, s0: 0.12, s1: 0.3, c: new THREE.Color(color), r: 0 });
  }
  fx.flash(p, color, 1.2, dur);
}

// ------------------------------------------------------------------ kits
const KITS = {
  // ======================= VOID (Limitless-style space manipulation)
  void: {
    s1: { name: 'GRAVITY ORB', jp: '重力球', clip: 'castPush', dur: 0.7, cost: 20,
      events: [{ t: 0, fn: (f, g) => { chargeAt(g, f, 'R', '#3fa9ff', 0.24); sfx('charge'); } },
        { t: 0.24, fn: (f, g) => {
          sfx('orb');
          const obj = g.fx.orb('#2f8bff', 0.42, '#d9f3ff');
          projectile(g, f, { pos: f.front(1.2, 1.25), vel: V(6.5 * f.facing, 0, 0), obj, life: 1.7, hits: 4, interval: 0.2, radius: 0.7,
            hit: { dmg: 24, stun: 0.42, kb: 0, pull: 0, kind: 'special', hitstop: 0.04, color: '#3fa9ff' },
            update(p, dt) { // swirl particles get sucked in
              obj.rotation.z += dt * 6; obj.userData.halo.material.rotation += dt * 3;
              for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, r = 1.4 + Math.random(); const o = V(Math.cos(a) * r, Math.sin(a) * r, 0);
                g.fx.glow.emit({ pos: p.pos.clone().add(o), vel: o.clone().multiplyScalar(-2.2), t: 0, life: 0.45, s0: 0.1, s1: 0.22, c: new THREE.Color('#7cc8ff'), r: 0 }); }
              // pull target toward the orb
              const t = p.owner.opp; const d = p.pos.x - t.pos.x;
              if (Math.abs(d) < 2.4 && t.state !== 'cine') t.pos.x += Math.sign(d) * dt * 2.6;
            },
            onEnd(p) { g.fx.flash(p.pos, '#3fa9ff', 2.5, 0.25); g.fx.ring(p.pos, '#9fd8ff', 3, 0.3); },
          });
        } }] },
    s2: { name: 'REPEL BURST', jp: '斥力', clip: 'castSign', dur: 0.72, cost: 30,
      events: [{ t: 0, fn: (f, g) => { chargeAt(g, f, 'R', '#ff2a3a', 0.3); sfx('charge'); } },
        { t: 0.3, fn: (f, g) => {
          const p = f.front(1.4, 1.2);
          g.fx.flash(p, '#ff2a3a', 3.5, 0.3); g.fx.impactBurst(p, '#ff3b3b', 2.6, '#1a0006');
          g.fx.ring(p, '#ff6b6b', 4.5, 0.4); g.fx.burstParticles(p, '#ff4040', 30, 10, 0.3, 0.5);
          g.cam.shake(0.5); sfx('boom'); g.post.chroma(0.3, 1.2);
        }, hit: { x0: 0.3, x1: 2.6, y0: 0.1, y1: 2.3, dmg: 115, kb: 13, up: 7, kind: 'heavy', hitstop: 0.12, impact: true, impactMode: 1, color: '#ff2a3a' } }] },
    // O : HOLLOW PURPLE — blackout, Blue + Red collide into Purple, the two-finger sign, the opponent
    //     is cut in half at the waist (src/purple.js)
    s3: HOLLOW_PURPLE,
    ult: { name: 'DOMAIN EXPANSION', ult: true, clip: 'sign', dur: 0.2, start: (f, g) => g.startDomain(f, 'void') },
  },
  // ======================= SHRINE (cursed slashes & fire)
  shrine: {
    s1: { name: 'CLEAVE WAVE', jp: '斬波', clip: 'slash', dur: 0.62, cost: 20,
      events: [{ t: 0.12, sfx: 'slash' }, { t: 0.18, fn: (f, g) => fireSlash(f, g, 0.25) }, { t: 0.32, fn: (f, g) => { sfx('slash'); fireSlash(f, g, -0.3); } }] },
    s2: { name: 'DISMANTLE RUSH', jp: '乱斬', clip: 'rush', dur: 0.62, cost: 30, ghosts: true, friction: 1,
      events: [{ t: 0, vel: [15], sfx: 'whoosh', trail: ['hand_L', 'hand_R'] },
        ...[0.06, 0.12, 0.18].map(t => ({ t, fn: (f, g) => { if (Math.abs(f.opp.pos.x - f.pos.x) < 1.8) cutAt(g, f.opp, 2); }, hit: { x0: -0.2, x1: 1.4, y0: 0.3, y1: 2, dmg: 26, stun: 0.5, kb: 1.5, kind: 'special', hitstop: 0.035, color: '#ff3048', active: 0.05 } })),
        { t: 0.26, vel: [2], fn: (f, g) => { sfx('slash'); if (Math.abs(f.opp.pos.x - f.pos.x) < 2) cutAt(g, f.opp, 4); }, hit: { x0: -0.2, x1: 1.6, y0: 0.2, y1: 2.2, dmg: 55, kb: 10, up: 6, kind: 'heavy', hitstop: 0.1, impact: true, impactMode: 1, color: '#ff3048' } }] },
    s3: { name: 'EMBER ARROW', jp: '炎矢', clip: 'castPush', dur: 1.1, cost: 60, speed: 0.55, super: true,
      events: [{ t: 0, fn: (f, g) => { g.superFreeze(f, 0.36); sfx('charge'); f.flameT = 0.5; } },
        { t: 0.42, fn: (f, g) => {
          sfx('fire'); g.post.speed(0.5, 0.9, '#ffb36b');
          const obj = new THREE.Group();
          const core = g.fx.sprite('flame', '#ffcf4a', 1, V()); core.scale.set(2.6, 0.9, 1); core.material.rotation = f.facing > 0 ? -Math.PI / 2 : Math.PI / 2;
          const halo = g.fx.sprite('glow', '#ff5a1f', 3, V()); obj.add(halo, core);
          projectile(g, f, { pos: f.front(1.3, 1.3), vel: V(21 * f.facing, 0, 0), obj, life: 1.2, radius: 0.7,
            hit: { dmg: 210, kb: 13, up: 10, kind: 'heavy', hitstop: 0.16, impact: true, impactMode: 1, chip: 0.35, color: '#ff7a1f' },
            update(p) { for (let i = 0; i < 4; i++) g.fx.flames.emit({ pos: p.pos.clone().add(V(0, (Math.random() - 0.5) * 0.5, 0)), vel: V(-p.vel.x * 0.1, 1 + Math.random() * 2, 0), t: 0, life: 0.4, s0: 0.9, s1: 0.2, c: new THREE.Color(Math.random() > 0.5 ? '#ff6a1f' : '#ffd04a'), r: 0, a: 0.8 }); },
            onHit(p, t) { firePillar(g, t.pos.clone()); },
            onEnd(p) { g.fx.flash(p.pos, '#ff7a1f', 3, 0.3); } });
        } }],
      update(f, g, dt) { if (f.flameT > 0) { f.flameT -= dt; const h = handPos(f, 'R'); g.fx.flames.emit({ pos: h, vel: V(0, 2, 0), t: 0, life: 0.3, s0: 0.6, s1: 0.1, c: new THREE.Color('#ff7a1f'), r: 0, a: 0.8 }); } } },
    ult: { name: 'DOMAIN EXPANSION', ult: true, clip: 'sign', dur: 0.2, start: (f, g) => g.startDomain(f, 'shrine') },
  },
  // ======================= HEAVENLY (zero-energy physical monster with weapons)
  heavenly: {
    // three fast pistol shots (falls back to a throw pose for rigs without the gun clip)
    s1: { name: 'GUN BARRAGE', jp: '銃撃', clip: 'gunShoot', dur: 0.62, cost: 20,
      start(f) { if (!f.actor.hasClip('gunShoot')) f.setAnim('castPush', 0.04, f.atkSpd); },
      events: [0.1, 0.24, 0.38].map((t, i) => ({ t, fn: (f, g) => gunShot(f, g, i === 2) })) },
    s2: { name: 'PHANTOM RUSH', jp: '瞬', clip: 'dash', dur: 0.75, cost: 30, ghosts: true,
      events: [{ t: 0, fn: (f, g) => { sfx('teleport'); f.spawnGhost(); f.root.visible = false; } },
        { t: 0.1, fn: (f, g) => {
          const o = f.opp; const nx = THREE.MathUtils.clamp(o.pos.x + f.facing * 1.1, g.stage.bounds[0], g.stage.bounds[1]);
          f.pos.x = nx; f.faceOpp(); f.root.visible = true; f.spawnGhost('#ffffff');
          g.fx.flash(f.front(0, 1.1), '#ffffff', 1.4, 0.15); g.post.speed(0.3, 0.7);
        } },
        { t: 0.12, fn: f => { const blade = f.actor.hasClip('phantomSlash'); f.setAnim(blade ? 'phantomSlash' : 'heavy', 0.03, f.atkSpd); trailOn(f, blade ? 'w_blade' : 'hand_R'); if (blade) sfx('slash'); } },
        { t: 0.3, vel: [2, 2], fn: (f, g) => { if (f.actor.hasClip('phantomSlash')) bladeArc(1.2, 0.7, 3.2)(f, g); },
          hit: { x0: 0, x1: 1.7, y0: 0.5, y1: 2.2, dmg: 90, kb: 3, up: 12, kind: 'heavy', hitstop: 0.12, impact: true, color: '#d6ff6a' } }] },
    // O : the cursed worm coils round his chest, he draws a blade from its mouth in slow motion,
    //     blitzes the opponent and cuts across the neck
    s3: { name: 'CURSED ARMORY', jp: '武器庫', clip: 'drawBlade', dur: 2.3, cost: 60, super: true, friction: 1.5,
      start(f, g) {
        f._cs = 'draw'; f._csT = 0; f._beheaded = false;
        if (!f.actor.hasClip('drawBlade')) f.setAnim('block', 0.05);
        g.timeScale = 0.4; g.slowT = 1.3;
        focusOn(f, g);
      },
      events: [
        { t: 0, fn: (f, g) => {
          g.superFreeze(f, 0.5); cursedWorm(f, g); sfx('chain');
          const c = f.boneWorld('chest');
          g.cam.setShot(t => { const a = 0.55 - t * 0.5; return { pos: c.clone().add(V(Math.sin(a) * 3.1 * f.facing, 0.35 - t * 0.15, Math.cos(a) * 3.1)), look: c.clone().add(V(0, 0.05, 0)), fov: 34, roll: f.facing * 0.05 }; }, 0.1);
        } },
        { t: 0.34, fn: (f, g) => drawFromWorm(f, g) },
        { t: 0.62, fn: (f, g) => { // blitz
          f._cs = 'dash'; g.timeScale = 1; g.slowT = 0; focusOff(f, g);
          f.setAnim('dash', 0.04, 1.8); f.vel.x = 24 * f.facing; f.ghostsOn = true;
          sfx('whoosh'); sfx('teleport'); g.post.speed(0.5, 1, '#ffffff'); g.fx.dust(V(f.pos.x, 0.05, 0), 1);
        } },
      ],
      end(f, g) { focusOff(f, g); f.ghostsOn = false; if (f._cs === 'cut' && !f._csEnd && g.phase === 'fight') { g.cam.clearShot(0.3); g.post.grade({}); } },
      update(f, g, dt) {
        if (f._cs === 'dash') {
          f.vel.x = 24 * f.facing; f.speedLines?.(2);
          const d = Math.abs(f.opp.pos.x - f.pos.x);
          if (d < 1.35 || f.moveT > 1.3 || f.pos.x <= g.stage.bounds[0] + 0.05 || f.pos.x >= g.stage.bounds[1] - 0.05) neckCut(f, g);
        } else if (f._cs === 'cut') {
          f._csT += dt;
          if (f.hitLanded && !f._beheaded) { f._beheaded = true; beheadFx(f, g); }
          if (f._csT > 0.95 && !f._csEnd) { f._csEnd = true; f.ghostsOn = false; if (g.phase === 'fight') { g.cam.clearShot(0.3); g.post.grade({}); } }
        }
      } },
    ult: { name: 'ZERO CAGE', ult: true, clip: 'sign', dur: 0.2, start: (f, g) => g.startDomain(f, 'heavenly') },
  },
};

export function kitMoves(kit) { return KITS[kit] || KITS.void; }

// ------------------------------------------------------------------ fx helpers used by moves
function fireSlash(f, g, tilt) {
  const obj = new THREE.Group();
  const arc = g.fx.slashArc(V(), '#ff3048', { size: 2.4, rotZ: (f.facing > 0 ? -Math.PI / 2 : Math.PI / 2) + tilt, dur: 99 });
  g.fx.items.pop(); arc.removeFromParent(); obj.add(arc);
  projectile(g, f, { pos: f.front(1, 1.2), vel: V(15 * f.facing, 0, 0), obj, life: 0.75, radius: 0.75,
    hit: { dmg: 42, stun: 0.45, kb: 3, kind: 'special', hitstop: 0.05, color: '#ff3048' },
    update(p, dt) { arc.material.opacity = 0.7 + Math.random() * 0.3; },
    onHit(p, t) { cutAt(g, t, 2); } });
}
export function cutAt(g, t, n = 3, color = '#ffffff') {
  for (let i = 0; i < n; i++) {
    const c = V(t.pos.x + (Math.random() - 0.5) * 0.6, t.pos.y + 0.6 + Math.random() * 1.0, 0.6);
    g.fx.inkSlash(c, Math.random() * Math.PI, 2.2 + Math.random(), 0.3);
  }
  g.fx.burstParticles(V(t.pos.x, t.pos.y + 1.1, 0.4), '#ff2a3a', 8, 6, 0.15, 0.4, 'glow', { grav: 10 });
}
export function firePillar(g, pos) {
  for (let i = 0; i < 60; i++) g.fx.flames.emit({ pos: pos.clone().add(V((Math.random() - 0.5) * 1.2, Math.random() * 0.5, 0)), vel: V((Math.random() - 0.5) * 2, 4 + Math.random() * 9, 0), t: 0, life: 0.6 + Math.random() * 0.5, s0: 1.4, s1: 0.3, c: new THREE.Color(Math.random() > 0.4 ? '#ff5a1f' : '#ffd04a'), r: 0, a: 0.9 });
  g.fx.flash(pos.clone().setY(1.5), '#ff7a1f', 6, 0.5); g.fx.shockwave(pos.clone().setY(0.05), '#ffb36b', 5); g.fx.groundCrack(pos, 3);
}
function chainWhip(f, g) {
  const start = handPos(f, 'R');
  const segs = 26, group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#2a2a33' });
  const geo = new THREE.TorusGeometry(0.07, 0.022, 4, 8);
  for (let i = 0; i < segs; i++) { const m = new THREE.Mesh(geo, mat); m.rotation.y = i % 2 ? Math.PI / 2 : 0; group.add(m); }
  const tip = g.fx.sprite('spark', '#e8ffd0', 0.6, V()); group.add(tip);
  g.fx.add(group, 0.42, (e, k) => {
    const ext = k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6;
    const len = 5.6 * Math.sin(ext * Math.PI / 2);
    const s = handPos(f, 'R');
    for (let i = 0; i < segs; i++) {
      const u = i / (segs - 1);
      group.children[i].position.set(s.x + f.facing * u * len, s.y + Math.sin(u * Math.PI) * 0.5 * (1 - ext) - u * 0.1, 0.2);
    }
    tip.position.copy(group.children[segs - 1].position);
  });
}
// Toji's cursed-tool worm: a dark segmented spirit that coils round his chest, its head ending at his right hand
function cursedWorm(f, g) {
  const grp = new THREE.Group();
  const skin = new THREE.MeshToonMaterial({ color: '#5b4a68' }), ink = new THREE.MeshBasicMaterial({ color: '#0b0710', side: THREE.BackSide });
  const body = new THREE.Mesh(new THREE.BufferGeometry(), skin), hull = new THREE.Mesh(new THREE.BufferGeometry(), ink);
  grp.add(body, hull);
  // head: skull-ish bulb, open red mouth, two pale eyes
  const head = new THREE.Group();
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), skin));
  const hh = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), ink); head.add(hh);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 6, 14), new THREE.MeshBasicMaterial({ color: '#8a0018' }));
  mouth.position.z = 0.1; head.add(mouth);
  const throat = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), new THREE.MeshBasicMaterial({ color: '#1a0006' }));
  throat.position.z = 0.105; head.add(throat);
  for (const x of [-0.06, 0.06]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshBasicMaterial({ color: '#f4f0d0' })); e.position.set(x, 0.07, 0.07); head.add(e); }
  grp.add(head);
  grp.traverse(o => { o.renderOrder = 3; o.frustumCulled = false; });
  const life = 0.72, pts = [];
  g.fx.add(grp, life, (e, k) => {
    const c = f.boneWorld('chest'), hand = f.boneWorld('hand_R'), hips = f.boneWorld('hips');
    const grow = Math.min(1, k / 0.38), shrink = k > 0.66 ? (k - 0.66) / 0.34 : 0;
    pts.length = 0;
    // it flies in from behind / above, then coils (the visible part slides along this path)
    pts.push(V(c.x - f.facing * 3.2, c.y + 2.2, -2.2), V(c.x - f.facing * 1.6, c.y + 1.2, -1.2), V(c.x - f.facing * 0.6, hips.y + 0.2, -0.5));
    const N = 16, turns = 1.35, a0 = -Math.PI * 0.5;
    for (let i = 0; i < N; i++) { // helix from the waist up round the chest to the back of the neck
      const s = i / (N - 1), a = a0 + s * turns * Math.PI * 2, r = 0.34 + Math.sin(s * Math.PI) * 0.06;
      pts.push(V(c.x + Math.cos(a) * r * f.facing, THREE.MathUtils.lerp(hips.y + 0.05, c.y + 0.32, s), Math.sin(a) * r));
    }
    pts.push(V(hand.x - f.facing * 0.05, hand.y + 0.12, hand.z + 0.05), V(hand.x + f.facing * 0.04, hand.y + 0.02, hand.z + 0.08));
    const curve = new THREE.CatmullRomCurve3(pts);
    // the head travels the whole path (flying in), the body is the 70% behind it; then it slips away backwards
    const headU = grow * (1 - shrink * 0.9), tailU = Math.max(0, headU - 0.72);
    const sub = new THREE.CatmullRomCurve3(Array.from({ length: 28 }, (_, i) => curve.getPoint(tailU + (headU - tailU) * i / 27 + 1e-4)));
    body.geometry.dispose(); hull.geometry.dispose();
    body.geometry = new THREE.TubeGeometry(sub, 48, 0.045 * (1 - shrink * 0.5), 8, false);
    hull.geometry = new THREE.TubeGeometry(sub, 48, 0.062 * (1 - shrink * 0.5), 8, false);
    const tip = sub.getPoint(1), tan = sub.getTangent(1);
    head.position.copy(tip); head.lookAt(tip.clone().add(tan));
    head.scale.setScalar(1 - shrink * 0.7);
    // wriggle + cursed mist
    body.material.color.setHSL(0.76, 0.12, 0.33 + Math.sin(e.t * 30) * 0.03);
    if (Math.random() < 0.2) g.fx.smoke.emit({ pos: tip.clone().add(V((Math.random() - 0.5) * 0.3, 0, 0.1)), vel: V(0, 0.6, 0), t: 0, life: 0.5, s0: 0.18, s1: 0.35, c: new THREE.Color('#3a2d45'), r: Math.random() * 6, a: 0.4 });
  });
}
// everything but Toji goes dark: black veil behind him, opponent as a silhouette, focus lines on him
function focusOn(f, g) {
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshBasicMaterial({ color: '#05030a', transparent: true, opacity: 0, depthWrite: false }));
  veil.position.set(f.pos.x, 2, -1.3); veil.renderOrder = 1;
  f._veil = veil;
  g.fx.add(veil, 0.62, (e, k) => { veil.material.opacity = Math.min(1, k / 0.15) * 0.82 * (f._cs === 'draw' ? 1 : 0); });
  const o = f.opp; o.U.uSilColor.value.set('#05030a'); o.U.uSilhouette.value = 1;
  g.post.speed(0.9, 0.9, '#ffffff', g.cam.project(f.boneWorld('chest')));
}
function focusOff(f, g) {
  const o = f.opp; o.U.uSilhouette.value = 0;
  if (f._veil) f._veil.material.opacity = 0;
}
// head off: red-black ink spray at the neck, slow motion, close-up that follows the falling head
function beheadFx(f, g) {
  const o = f.opp;
  o.behead(f);
  const neck = o.boneWorld('neck');
  g.fx.burstParticles(neck, '#c4001c', 26, 5, 0.16, 0.7, 'glow', { grav: 9 });
  g.fx.burstParticles(neck, '#120006', 14, 4, 0.2, 0.6, 'glow', { grav: 9 });
  g.fx.inkSlash(neck.clone().setZ(0.7), f.facing > 0 ? -0.1 : 0.1, 2.6, 0.16);
  sfx('hitH'); sfx('spark');
  g.timeScale = 0.22; g.slowT = 1.6;
  const camLook = neck.clone();
  g.cam.setShot(t => { const h = o.decap ? o.decap.headPos() : neck; camLook.lerp(h, 0.12); return { pos: camLook.clone().add(V(-f.facing * 0.8, 0.7, 3.4)), look: camLook.clone().add(V(0, 0.1, 0)), fov: 36, roll: f.facing * 0.05 }; }, 0.15);
}
// the blade slides out of the worm's mouth into his hand
function drawFromWorm(f, g) {
  f.actor.holdWeapon('blade');
  const w = f.actor.weapons?.blade;
  if (w) {
    const blade = w.holder.children[0];
    g.fx.add(null, 0.3, (e, k) => { const s = Math.min(1, 0.08 + k * 1.2); blade.scale.set(1, s, 1); });
    trailOn(f, 'w_blade');
  }
  const h = f.boneWorld('hand_R');
  g.fx.flash(h, '#ffffff', 1.6, 0.18); g.fx.burstParticles(h, '#e8ffd0', 14, 4, 0.12, 0.4);
  g.post.flash(0.08, '#ffffff', 0.5); sfx('slash'); g.cam.shake(0.15);
}
// final cut across the opponent's neck
function neckCut(f, g) {
  f._cs = 'cut'; f._csT = 0; f._csEnd = false;
  f.vel.x = 3 * f.facing;
  f.setAnim(f.actor.hasClip('neckSlash') ? 'neckSlash' : 'heavy', 0.03, 1);
  sfx('slash');
  const o = f.opp;
  f.activeHits.push({ spec: { x0: -0.3, x1: 1.9, y0: 0.6, y1: 2.2, dmg: 240, kb: 9, up: 7, kind: 'heavy', hitstop: 0.22, impact: true, impactMode: 0, unblockable: true, color: '#ffffff' }, until: f.moveT + 0.2, done: false });
  // ink cut through the neck line + slow motion close-up
  const neck = V(o.pos.x, o.pos.y + 1.55, 0.6);
  g.fx.inkSlash(neck, f.facing > 0 ? -0.12 : 0.12, 3.4, 0.18);
  g.fx.slashLine(neck, f.facing > 0 ? -0.12 : 0.12, 6, '#ffffff', 0.14, 0.16);
  g.fx.slashArc(V(f.pos.x + f.facing * 1, f.pos.y + 1.5, 0.4), '#ffffff', { size: 3.4, rotZ: f.facing > 0 ? 0.15 : -0.15, flip: f.facing });
  g.post.flash(0.1, '#ffffff', 0.9); g.post.impact(0.12, 0); g.cam.shake(0.7);
  g.timeScale = 0.25; g.slowT = 0.9;
  const side = V(-f.facing * 0.6, 0.15, 2.4);
  g.cam.setShot(t => ({ pos: neck.clone().add(side.clone().multiplyScalar(1 + t * 0.15)), look: neck.clone().add(V(f.facing * 0.2, -0.15, 0)), fov: 30, roll: f.facing * 0.08 }), 0.05);
}
function trailOn(f, keys) { for (const b of [].concat(keys)) { const tr = f.trails[b]; if (!tr) continue; if (!tr.active) tr.pts.length = 0; tr.active = true; } }
// one pistol shot: muzzle flash at the gun, a fast tracer round
function gunShot(f, g, last) {
  const w = f.actor.weapons?.gun;
  const p = w ? weaponTip(w) : handPos(f, 'R');
  p.z = 0.3;
  sfx('shot'); g.cam.shake(0.12);
  g.fx.flash(p, '#ffd27a', 1.3, 0.07);
  g.fx.burstParticles(p, '#ffe2a0', 6, 7, 0.08, 0.15);
  const obj = new THREE.Group();
  const core = g.fx.sprite('glow', '#fff3c4', 0.5, V()); core.scale.set(1.1, 0.16, 1);
  const halo = g.fx.sprite('glow', '#ffb347', 0.9, V()); halo.scale.set(1.6, 0.35, 1);
  obj.add(halo, core);
  projectile(g, f, { pos: p.clone().setY(Math.max(p.y, f.pos.y + 0.9)), vel: V(44 * f.facing, 0, 0), obj, life: 0.42, radius: 0.32,
    hit: { dmg: last ? 40 : 26, stun: 0.3, kb: last ? 6 : 1, kind: 'special', hitstop: last ? 0.07 : 0.035, color: '#ffd27a' },
    onEnd(pr) { g.fx.flash(pr.pos, '#ffd27a', 0.8, 0.08); } });
}
