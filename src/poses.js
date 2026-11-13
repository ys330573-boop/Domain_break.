// All pose specs & clip definitions (see anim.js for the semantic format).
import { Clip, compilePose } from './anim.js';

export const STANCE = {
  pos: [0, -0.07, 0],
  hips: { y: -22 },
  spine: { x: 6 }, chest: { x: 5, y: -8 }, neck: { y: 10 }, head: { y: 18, x: -2 },
  armL: { fwd: 55, side: 14, twist: -10 }, elbowL: 110, handL: { x: -10 },
  armR: { fwd: 30, side: 18, twist: -10 }, elbowR: 128,
  legL: { fwd: 26, side: 7 }, kneeL: 24, footL: { x: -12 },
  legR: { fwd: -20, side: 7, twist: 10 }, kneeR: 26, footR: { x: 4 },
};
const S = (o) => ({ ...STANCE, ...o });

function mk(def) { return def; }

export const CLIP_DEFS = {
  idle: mk({ loop: true, keys: [
    { t: 0, pose: S({}) },
    { t: 0.9, pose: S({ pos: [0, -0.1, 0], chest: { x: 9, y: -8 }, elbowL: 115, elbowR: 132 }) },
    { t: 1.8, pose: S({}) },
  ] }),
  walkF: mk({ loop: true, keys: [
    { t: 0, pose: S({ legL: { fwd: 38, side: 6 }, kneeL: 10, legR: { fwd: -28, side: 6 }, kneeR: 30, pos: [0, -0.06, 0] }) },
    { t: 0.25, pose: S({ legL: { fwd: 5, side: 6 }, kneeL: 40, legR: { fwd: 8, side: 6 }, kneeR: 50, pos: [0, -0.03, 0] }) },
    { t: 0.5, pose: S({ legL: { fwd: 38, side: 6 }, kneeL: 10, legR: { fwd: -28, side: 6 }, kneeR: 30, pos: [0, -0.06, 0] }) },
  ] }),
  walkB: mk({ loop: true, keys: [
    { t: 0, pose: S({ legL: { fwd: 20, side: 6 }, kneeL: 30, legR: { fwd: -35, side: 6 }, kneeR: 15 }) },
    { t: 0.28, pose: S({ legL: { fwd: 0, side: 6 }, kneeL: 45, legR: { fwd: 0, side: 6 }, kneeR: 45, pos: [0, -0.04, 0] }) },
    { t: 0.56, pose: S({ legL: { fwd: 20, side: 6 }, kneeL: 30, legR: { fwd: -35, side: 6 }, kneeR: 15 }) },
  ] }),
  dash: mk({ loop: true, keys: [
    { t: 0, pose: { pos: [0, -0.12, 0], hips: { x: 22, y: 0 }, spine: { x: 14 }, chest: { x: 10 }, head: { x: -30 },
      armL: { fwd: -55, side: 25, twist: 20 }, elbowL: 10, armR: { fwd: -60, side: 25, twist: 20 }, elbowR: 10,
      legL: { fwd: 50 }, kneeL: 70, legR: { fwd: -45 }, kneeR: 40, footR: { x: 30 } } },
    { t: 0.18, pose: { pos: [0, -0.1, 0], hips: { x: 22, y: 0 }, spine: { x: 14 }, chest: { x: 10 }, head: { x: -30 },
      armL: { fwd: -55, side: 25, twist: 20 }, elbowL: 10, armR: { fwd: -60, side: 25, twist: 20 }, elbowR: 10,
      legL: { fwd: -40 }, kneeL: 40, legR: { fwd: 50 }, kneeR: 70, footL: { x: 30 } } },
    { t: 0.36, pose: { pos: [0, -0.12, 0], hips: { x: 22, y: 0 }, spine: { x: 14 }, chest: { x: 10 }, head: { x: -30 },
      armL: { fwd: -55, side: 25, twist: 20 }, elbowL: 10, armR: { fwd: -60, side: 25, twist: 20 }, elbowR: 10,
      legL: { fwd: 50 }, kneeL: 70, legR: { fwd: -45 }, kneeR: 40, footR: { x: 30 } } },
  ] }),
  jump: mk({ keys: [
    { t: 0, pose: S({ pos: [0, -0.2, 0], kneeL: 60, kneeR: 60, legL: { fwd: 40 }, legR: { fwd: 0 } }) },
    { t: 0.12, ease: 'out', pose: { pos: [0, 0.05, 0], hips: { x: 5 }, chest: { x: -5 }, armL: { fwd: 30, side: 60 }, elbowL: 40, armR: { fwd: 10, side: 55 }, elbowR: 50,
      legL: { fwd: 70 }, kneeL: 110, legR: { fwd: 20 }, kneeR: 90, footL: { x: 20 }, footR: { x: 30 } } },
  ] }),
  fall: mk({ keys: [
    { t: 0, pose: { pos: [0, 0.05, 0], hips: { x: 5 }, chest: { x: -5 }, armL: { fwd: 30, side: 60 }, elbowL: 40, armR: { fwd: 10, side: 55 }, elbowR: 50,
      legL: { fwd: 70 }, kneeL: 110, legR: { fwd: 20 }, kneeR: 90 } },
    { t: 0.35, pose: { pos: [0, 0, 0], hips: { x: 0 }, armL: { fwd: 20, side: 40 }, elbowL: 30, armR: { fwd: 0, side: 45 }, elbowR: 30,
      legL: { fwd: 30 }, kneeL: 40, legR: { fwd: -10 }, kneeR: 30, footL: { x: -20 }, footR: { x: -10 } } },
  ] }),
  land: mk({ keys: [
    { t: 0, pose: S({ pos: [0, -0.28, 0], spine: { x: 20 }, kneeL: 80, kneeR: 80, legL: { fwd: 55 }, legR: { fwd: 10 } }) },
    { t: 0.16, pose: S({}) },
  ] }),
  block: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.06, pose: { pos: [0, -0.14, 0], hips: { y: -20 }, spine: { x: 15 }, chest: { x: 8, y: 0 }, head: { x: 12, y: 15 },
      armL: { fwd: 85, side: -30, twist: 20 }, elbowL: 125, armR: { fwd: 95, side: -25, twist: 20 }, elbowR: 135,
      legL: { fwd: 30, side: 8 }, kneeL: 40, legR: { fwd: -20, side: 8 }, kneeR: 35 } },
  ] }),
  hitL: mk({ keys: [
    { t: 0, pose: S({ chest: { x: -20, y: 10 }, head: { x: -30, y: 20 }, armL: { fwd: 10, side: 40 }, elbowL: 40, armR: { fwd: 0, side: 40 }, elbowR: 40 }) },
    { t: 0.3, pose: S({}) },
  ] }),
  hitH: mk({ keys: [
    { t: 0, pose: { pos: [0, -0.05, -0.0], hips: { x: -15, y: -10 }, spine: { x: -15 }, chest: { x: -25 }, head: { x: -35 },
      armL: { fwd: 30, side: 70 }, elbowL: 30, armR: { fwd: -10, side: 75 }, elbowR: 25, legL: { fwd: 35 }, kneeL: 20, legR: { fwd: -10 }, kneeR: 20 } },
    { t: 0.5, pose: S({}) },
  ] }),
  launched: mk({ keys: [
    { t: 0, pose: { hips: { x: -50 }, spine: { x: -20 }, chest: { x: -20 }, head: { x: -30 }, armL: { fwd: 160, side: 30 }, elbowL: 20, armR: { fwd: 140, side: 40 }, elbowR: 30,
      legL: { fwd: 40 }, kneeL: 50, legR: { fwd: 10 }, kneeR: 30 } },
    { t: 0.6, pose: { hips: { x: -80 }, spine: { x: -10 }, chest: { x: -10 }, head: { x: -10 }, armL: { fwd: 120, side: 60 }, elbowL: 30, armR: { fwd: 100, side: 70 }, elbowR: 30,
      legL: { fwd: 30 }, kneeL: 60, legR: { fwd: 15 }, kneeR: 40 } },
  ] }),
  down: mk({ keys: [
    { t: 0, pose: { pos: [0, -0.78, -0.35], hips: { x: -90 }, spine: { x: 5 }, chest: { x: 5 }, head: { x: 15, y: 30 },
      armL: { fwd: 150, side: 50 }, elbowL: 20, armR: { fwd: 160, side: 30 }, elbowR: 50, legL: { fwd: 20, side: 10 }, kneeL: 30, legR: { fwd: 5, side: 10 }, kneeR: 5 } },
  ] }),
  getup: mk({ keys: [
    { t: 0, pose: { pos: [0, -0.78, -0.35], hips: { x: -90 }, head: { x: 15 }, armL: { fwd: 150, side: 50 }, elbowL: 20, armR: { fwd: 160, side: 30 }, elbowR: 50, legL: { fwd: 20 }, kneeL: 30, legR: { fwd: 5 }, kneeR: 5 } },
    { t: 0.2, pose: { pos: [0, -0.55, 0], hips: { x: -20 }, spine: { x: 40 }, chest: { x: 20 }, armL: { fwd: -20, side: 20 }, elbowL: 10, armR: { fwd: -30, side: 20 }, elbowR: 10, legL: { fwd: 90 }, kneeL: 140, legR: { fwd: 60 }, kneeR: 130 } },
    { t: 0.45, pose: S({}) },
  ] }),
  ko: mk({ keys: [
    { t: 0, pose: { pos: [0, -0.05, 0], hips: { x: -15 }, chest: { x: -30 }, head: { x: -40 }, armL: { fwd: 20, side: 60 }, elbowL: 20, armR: { fwd: 10, side: 60 }, elbowR: 20, legL: { fwd: 20 }, kneeL: 30, legR: { fwd: -5 }, kneeR: 20 } },
    { t: 0.5, ease: 'in', pose: { pos: [0, -0.78, -0.35], hips: { x: -90 }, spine: { x: 5 }, chest: { x: 5 }, head: { x: 15, y: 30 },
      armL: { fwd: 150, side: 50 }, elbowL: 20, armR: { fwd: 160, side: 30 }, elbowR: 50, legL: { fwd: 20, side: 10 }, kneeL: 30, legR: { fwd: 5, side: 10 }, kneeR: 5 } },
  ] }),

  // ---------- attacks ----------
  jab: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.06, ease: 'snap', pose: S({ hips: { y: -35 }, chest: { x: 5, y: -15 }, armL: { fwd: 92, side: 4, twist: -80 }, elbowL: 4, handL: { x: 0 }, legL: { fwd: 35, side: 7 }, kneeL: 30 }) },
    { t: 0.16, pose: S({ hips: { y: -35 }, chest: { x: 5, y: -15 }, armL: { fwd: 90, side: 4, twist: -80 }, elbowL: 8 }) },
    { t: 0.3, pose: S({}) },
  ] }),
  cross: mk({ keys: [
    { t: 0, pose: S({ hips: { y: -30 }, armR: { fwd: 20, side: 25 }, elbowR: 140 }) },
    { t: 0.07, ease: 'snap', pose: S({ pos: [0.06, -0.1, 0], hips: { y: 25 }, chest: { x: 8, y: 25 }, head: { y: -30, x: 0 }, armR: { fwd: 92, side: -8, twist: 80 }, elbowR: 3,
      armL: { fwd: 40, side: 20 }, elbowL: 120, legR: { fwd: -30, side: 6, twist: 20 }, kneeR: 15, footR: { x: 20 } }) },
    { t: 0.2, pose: S({ pos: [0.06, -0.1, 0], hips: { y: 25 }, chest: { x: 8, y: 25 }, head: { y: -30 }, armR: { fwd: 90, side: -8, twist: 80 }, elbowR: 8, armL: { fwd: 40, side: 20 }, elbowL: 120 }) },
    { t: 0.36, pose: S({}) },
  ] }),
  kick: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.08, pose: S({ pos: [0, -0.02, 0], hips: { y: 10, z: 10 }, legR: { fwd: 60, side: 30, twist: -20 }, kneeR: 120 }) },
    { t: 0.15, ease: 'snap', pose: { pos: [0, -0.04, 0], hips: { y: 60, z: 22, x: 0 }, spine: { z: -18 }, chest: { y: 0, z: -12 }, head: { y: -40, z: 15 },
      armL: { fwd: 40, side: 50 }, elbowL: 60, armR: { fwd: -30, side: 40 }, elbowR: 40,
      legL: { fwd: 0, side: -5 }, kneeL: 15, legR: { fwd: 115, side: 35, twist: -40 }, kneeR: 0, footR: { x: 30 } } },
    { t: 0.3, pose: { pos: [0, -0.04, 0], hips: { y: 60, z: 22 }, spine: { z: -18 }, chest: { z: -12 }, head: { y: -40, z: 15 },
      armL: { fwd: 40, side: 50 }, elbowL: 60, armR: { fwd: -30, side: 40 }, elbowR: 40,
      legL: { fwd: 0, side: -5 }, kneeL: 15, legR: { fwd: 110, side: 35, twist: -40 }, kneeR: 10 } },
    { t: 0.46, pose: S({}) },
  ] }),
  heavy: mk({ keys: [ // rising uppercut
    { t: 0, pose: S({}) },
    { t: 0.14, pose: S({ pos: [0, -0.25, 0], hips: { y: -40 }, spine: { x: 25 }, chest: { y: -25, x: 10 }, armR: { fwd: -30, side: 25 }, elbowR: 100, kneeL: 70, kneeR: 70, legL: { fwd: 50 } }) },
    { t: 0.22, ease: 'snap', pose: { pos: [0.1, 0.12, 0], hips: { y: 30, x: -8 }, spine: { x: -10 }, chest: { y: 30, x: -15 }, head: { x: -25, y: -25 },
      armR: { fwd: 170, side: -10, twist: 60 }, elbowR: 25, armL: { fwd: -20, side: 30 }, elbowL: 90,
      legL: { fwd: 10 }, kneeL: 10, legR: { fwd: -20 }, kneeR: 10, footR: { x: 40 }, footL: { x: 30 } } },
    { t: 0.45, pose: { pos: [0.1, 0.1, 0], hips: { y: 30, x: -8 }, spine: { x: -10 }, chest: { y: 30, x: -15 }, head: { x: -25, y: -25 },
      armR: { fwd: 165, side: -10, twist: 60 }, elbowR: 30, armL: { fwd: -20, side: 30 }, elbowL: 90, legL: { fwd: 10 }, kneeL: 10, legR: { fwd: -20 }, kneeR: 10 } },
    { t: 0.62, pose: S({}) },
  ] }),
  airAtk: mk({ keys: [
    { t: 0, pose: { hips: { x: 10 }, legL: { fwd: 70 }, kneeL: 120, legR: { fwd: 30 }, kneeR: 110, armL: { fwd: 20, side: 50 }, elbowL: 40, armR: { side: 50 }, elbowR: 40 } },
    { t: 0.08, ease: 'snap', pose: { hips: { x: -25 }, spine: { x: 10 }, chest: { x: 10 }, head: { x: 10 }, legL: { fwd: 80 }, kneeL: 130, legR: { fwd: 75 }, kneeR: 0, footR: { x: 40 },
      armL: { fwd: -20, side: 60 }, elbowL: 30, armR: { fwd: -30, side: 50 }, elbowR: 20 } },
    { t: 0.35, pose: { hips: { x: -25 }, spine: { x: 10 }, legL: { fwd: 80 }, kneeL: 130, legR: { fwd: 75 }, kneeR: 0, armL: { fwd: -20, side: 60 }, elbowL: 30, armR: { fwd: -30, side: 50 }, elbowR: 20 } },
  ] }),
  // palm push / projectile release
  castPush: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.16, pose: S({ hips: { y: 10 }, chest: { y: 25, x: -5 }, armR: { fwd: 20, side: 30, twist: 40 }, elbowR: 130, handR: { x: 50 }, kneeL: 40, kneeR: 40, pos: [0, -0.15, 0] }) },
    { t: 0.24, ease: 'snap', pose: S({ pos: [0.08, -0.12, 0], hips: { y: 30 }, chest: { y: 20, x: 5 }, head: { y: -25 }, armR: { fwd: 92, side: -5, twist: 40 }, elbowR: 0, handR: { x: 70 },
      armL: { fwd: 20, side: 30 }, elbowL: 80, legL: { fwd: 45 }, kneeL: 45 }) },
    { t: 0.55, pose: S({ pos: [0.08, -0.12, 0], hips: { y: 30 }, chest: { y: 20, x: 5 }, head: { y: -25 }, armR: { fwd: 90, side: -5, twist: 40 }, elbowR: 4, handR: { x: 70 }, armL: { fwd: 20, side: 30 }, elbowL: 80, legL: { fwd: 45 }, kneeL: 45 }) },
    { t: 0.7, pose: S({}) },
  ] }),
  // two-finger sign raised (Limitless style)
  castSign: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.2, ease: 'out', pose: { pos: [0, -0.02, 0], hips: { y: -10 }, chest: { y: 10, x: -5 }, head: { y: 0, x: -8 },
      armR: { fwd: 70, side: -20, twist: 30 }, elbowR: 110, handR: { x: 20 }, armL: { fwd: 70, side: 15, twist: -40 }, elbowL: 10,
      legL: { fwd: 10, side: 8 }, kneeL: 5, legR: { fwd: -8, side: 8 }, kneeR: 5 } },
    { t: 0.6, pose: { pos: [0, -0.02, 0], hips: { y: -10 }, chest: { y: 10, x: -5 }, head: { y: 0, x: -8 },
      armR: { fwd: 72, side: -20, twist: 30 }, elbowR: 112, handR: { x: 20 }, armL: { fwd: 70, side: 15, twist: -40 }, elbowL: 10,
      legL: { fwd: 10, side: 8 }, kneeL: 5, legR: { fwd: -8, side: 8 }, kneeR: 5 } },
    { t: 0.75, pose: S({}) },
  ] }),
  // big horizontal arm sweep (slash)
  slash: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.12, pose: S({ hips: { y: -50 }, chest: { y: -30 }, head: { y: 50 }, armR: { fwd: 80, side: 70, twist: 0 }, elbowR: 30, armL: { fwd: 30, side: 30 }, elbowL: 90 }) },
    { t: 0.2, ease: 'snap', pose: S({ pos: [0.06, -0.12, 0], hips: { y: 35 }, chest: { y: 35, x: 8 }, head: { y: -40 }, armR: { fwd: 85, side: -60, twist: 0 }, elbowR: 5, armL: { fwd: -10, side: 40 }, elbowL: 40, kneeL: 45 }) },
    { t: 0.45, pose: S({ pos: [0.06, -0.12, 0], hips: { y: 35 }, chest: { y: 35, x: 8 }, head: { y: -40 }, armR: { fwd: 80, side: -55 }, elbowR: 10, armL: { fwd: -10, side: 40 }, elbowL: 40, kneeL: 45 }) },
    { t: 0.6, pose: S({}) },
  ] }),
  // overhead throw (chain / arrow)
  throwOver: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.16, pose: S({ hips: { y: -40 }, spine: { x: -10 }, chest: { y: -30, x: -15 }, armR: { fwd: 160, side: 30, twist: 20 }, elbowR: 70, legR: { fwd: -30 }, kneeR: 20 }) },
    { t: 0.24, ease: 'snap', pose: S({ pos: [0.08, -0.12, 0], hips: { y: 25 }, spine: { x: 20 }, chest: { y: 25, x: 15 }, head: { y: -25, x: -10 }, armR: { fwd: 70, side: -10 }, elbowR: 0,
      armL: { fwd: -20, side: 30 }, elbowL: 30, legL: { fwd: 45 }, kneeL: 40 }) },
    { t: 0.5, pose: S({ pos: [0.08, -0.12, 0], hips: { y: 25 }, spine: { x: 20 }, chest: { y: 25, x: 15 }, head: { y: -25, x: -10 }, armR: { fwd: 65, side: -10 }, elbowR: 5, armL: { fwd: -20, side: 30 }, elbowL: 30, legL: { fwd: 45 }, kneeL: 40 }) },
    { t: 0.65, pose: S({}) },
  ] }),
  // lunging elbow / shoulder rush
  rush: mk({ keys: [
    { t: 0, pose: S({ pos: [0, -0.2, 0], spine: { x: 25 }, kneeL: 60, kneeR: 60 }) },
    { t: 0.1, ease: 'snap', pose: { pos: [0.1, -0.2, 0], hips: { x: 20, y: -50 }, spine: { x: 15 }, chest: { x: 10, y: -20 }, head: { y: 55, x: -20 },
      armL: { fwd: 85, side: -10, twist: -30 }, elbowL: 150, armR: { fwd: -30, side: 30 }, elbowR: 60,
      legL: { fwd: 60 }, kneeL: 70, legR: { fwd: -40 }, kneeR: 10, footR: { x: 30 } } },
    { t: 0.35, pose: { pos: [0.1, -0.2, 0], hips: { x: 20, y: -50 }, spine: { x: 15 }, chest: { x: 10, y: -20 }, head: { y: 55, x: -20 },
      armL: { fwd: 85, side: -10, twist: -30 }, elbowL: 150, armR: { fwd: -30, side: 30 }, elbowR: 60, legL: { fwd: 60 }, kneeL: 70, legR: { fwd: -40 }, kneeR: 10 } },
    { t: 0.5, pose: S({}) },
  ] }),
  // domain hand sign: hands together in front of chest
  sign: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.3, ease: 'out', pose: { pos: [0, 0, 0], hips: { y: 0 }, spine: { x: 2 }, chest: { x: 0 }, head: { x: 12 },
      armL: { fwd: 38, side: -30, twist: -30 }, elbowL: 100, handL: { x: 0, z: -20 }, armR: { fwd: 38, side: -30, twist: -30 }, elbowR: 100, handR: { x: 0, z: -20 },
      legL: { side: 9 }, kneeL: 2, legR: { side: 9 }, kneeR: 2 } },
    { t: 3.0, pose: { pos: [0, 0, 0], hips: { y: 0 }, spine: { x: 0 }, chest: { x: -4 }, head: { x: -6 },
      armL: { fwd: 40, side: -30, twist: -30 }, elbowL: 102, handL: { x: 0, z: -20 }, armR: { fwd: 40, side: -30, twist: -30 }, elbowR: 102, handR: { x: 0, z: -20 },
      legL: { side: 9 }, kneeL: 2, legR: { side: 9 }, kneeR: 2 } },
  ] }),
  // HOLLOW PURPLE: palms open at the sides (Blue left, Red right) -> hands meet -> arm out, two-finger sign
  purpleOpen: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.35, ease: 'out', pose: { pos: [0, -0.04, 0], spine: { x: 2 }, chest: { x: -6 }, head: { x: 4 },
      armL: { fwd: 35, side: 40, twist: -55 }, elbowL: 75, handL: { x: -25 }, armR: { fwd: 35, side: 40, twist: -55 }, elbowR: 75, handR: { x: -25 },
      legL: { fwd: 6, side: 12 }, kneeL: 10, legR: { fwd: -6, side: 12 }, kneeR: 10 } },
    { t: 2.5, pose: { pos: [0, -0.05, 0], spine: { x: 2 }, chest: { x: -8 }, head: { x: 6 },
      armL: { fwd: 37, side: 42, twist: -55 }, elbowL: 78, handL: { x: -25 }, armR: { fwd: 37, side: 42, twist: -55 }, elbowR: 78, handR: { x: -25 },
      legL: { fwd: 6, side: 12 }, kneeL: 12, legR: { fwd: -6, side: 12 }, kneeR: 12 } },
  ] }),
  purpleJoin: mk({ keys: [
    { t: 0, pose: { pos: [0, -0.04, 0], spine: { x: 2 }, chest: { x: -6 }, head: { x: 4 },
      armL: { fwd: 35, side: 40, twist: -55 }, elbowL: 75, handL: { x: -25 }, armR: { fwd: 35, side: 40, twist: -55 }, elbowR: 75, handR: { x: -25 },
      legL: { fwd: 6, side: 12 }, kneeL: 10, legR: { fwd: -6, side: 12 }, kneeR: 10 } },
    { t: 0.4, ease: 'out', pose: { pos: [0, -0.06, 0], spine: { x: 4 }, chest: { x: 0 }, head: { x: 14 },
      armL: { fwd: 28, side: -22, twist: -25 }, elbowL: 100, handL: { x: 0, z: -15 }, armR: { fwd: 28, side: -22, twist: -25 }, elbowR: 100, handR: { x: 0, z: -15 },
      legL: { fwd: 8, side: 12 }, kneeL: 14, legR: { fwd: -8, side: 12 }, kneeR: 14 } },
  ] }),
  purpleSign: mk({ keys: [
    { t: 0, pose: { pos: [0, -0.06, 0], spine: { x: 4 }, chest: { x: 0 }, head: { x: 14 },
      armL: { fwd: 28, side: -22, twist: -25 }, elbowL: 100, handL: { x: 0, z: -15 }, armR: { fwd: 28, side: -22, twist: -25 }, elbowR: 100, handR: { x: 0, z: -15 },
      legL: { fwd: 8, side: 12 }, kneeL: 14, legR: { fwd: -8, side: 12 }, kneeR: 14 } },
    { t: 0.22, ease: 'snap', pose: { pos: [0, -0.08, 0], hips: { y: 8 }, spine: { x: 3 }, chest: { y: 14, x: -4 }, neck: { y: -4 }, head: { y: -12, x: -4 },
      armR: { fwd: 86, side: -6, twist: 15 }, elbowR: 10, handR: { x: 10 }, armL: { fwd: -6, side: 14 }, elbowL: 30,
      legL: { fwd: 24, side: 9 }, kneeL: 16, legR: { fwd: -18, side: 9, twist: 10 }, kneeR: 12 } },
    { t: 3, pose: { pos: [0, -0.09, 0], hips: { y: 8 }, spine: { x: 3 }, chest: { y: 15, x: -5 }, neck: { y: -4 }, head: { y: -12, x: -6 },
      armR: { fwd: 88, side: -6, twist: 15 }, elbowR: 8, handR: { x: 10 }, armL: { fwd: -6, side: 14 }, elbowL: 30,
      legL: { fwd: 24, side: 9 }, kneeL: 16, legR: { fwd: -18, side: 9, twist: 10 }, kneeR: 12 } },
  ] }),
  // Gojo's domain: right hand over the eyes, pulls the blindfold up and off, looks up
  maskOff: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.4, ease: 'out', pose: { pos: [0, 0, 0], chest: { y: 6 }, head: { x: 12 },
      armR: { fwd: 105, side: -45, twist: 20 }, elbowR: 140, handR: { x: -20 }, armL: { fwd: 4, side: 10 }, elbowL: 14,
      legL: { fwd: 4, side: 8 }, legR: { fwd: -4, side: 8 } } },
    { t: 0.75, ease: 'snap', pose: { pos: [0, 0, 0], chest: { y: 4, x: -4 }, head: { x: -4 },
      armR: { fwd: 150, side: -5, twist: 20 }, elbowR: 110, handR: { x: 10 }, armL: { fwd: 4, side: 10 }, elbowL: 14,
      legL: { fwd: 4, side: 8 }, legR: { fwd: -4, side: 8 } } },
    { t: 1.3, pose: { pos: [0, 0, 0], chest: { x: -6 }, head: { x: -8 },
      armR: { fwd: 8, side: 10 }, elbowR: 18, armL: { fwd: 4, side: 10 }, elbowL: 14,
      legL: { fwd: 4, side: 8 }, legR: { fwd: -4, side: 8 } } },
  ] }),
  // Gojo's domain: crossed-finger sign raised in front of the face, head slightly bowed
  voidSign: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.4, ease: 'out', pose: { pos: [0, 0, 0], hips: { y: -6 }, chest: { y: 6, x: -2 }, neck: { x: 4 }, head: { x: 10, y: -4 },
      armR: { fwd: 62, side: -26, twist: 30 }, elbowR: 128, handR: { x: 15, z: -10 }, armL: { fwd: 4, side: 10 }, elbowL: 14,
      legL: { fwd: 4, side: 8 }, kneeL: 3, legR: { fwd: -4, side: 8 }, kneeR: 3 } },
    { t: 3, pose: { pos: [0, 0.005, 0], hips: { y: -6 }, chest: { y: 6, x: -3 }, neck: { x: 4 }, head: { x: 12, y: -4 },
      armR: { fwd: 63, side: -26, twist: 30 }, elbowR: 129, handR: { x: 15, z: -10 }, armL: { fwd: 4, side: 10 }, elbowL: 14,
      legL: { fwd: 4, side: 8 }, kneeL: 3, legR: { fwd: -4, side: 8 }, kneeR: 3 } },
  ] }),
  // hand laid on the opponent's head
  voidTouch: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.35, ease: 'out', pose: { pos: [0, 0, 0], chest: { y: 10, x: 0 }, head: { x: 4, y: -8 },
      armR: { fwd: 108, side: -10, twist: 0 }, elbowR: 32, handR: { x: 45 }, armL: { fwd: 2, side: 10 }, elbowL: 12,
      legL: { fwd: 12, side: 8 }, kneeL: 6, legR: { fwd: -10, side: 8 }, kneeR: 6 } },
    { t: 3, pose: { pos: [0, 0, 0], chest: { y: 10, x: 0 }, head: { x: 4, y: -8 },
      armR: { fwd: 108, side: -10, twist: 0 }, elbowR: 32, handR: { x: 45 }, armL: { fwd: 2, side: 10 }, elbowL: 12,
      legL: { fwd: 12, side: 8 }, kneeL: 6, legR: { fwd: -10, side: 8 }, kneeR: 6 } },
  ] }),
  // frozen, overloaded: arms drifting out, head tipped back
  paralyzed: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.3, ease: 'out', pose: { pos: [0, -0.02, 0], spine: { x: -4 }, chest: { x: -10 }, neck: { x: -4 }, head: { x: -6 },
      armL: { fwd: 18, side: 32, twist: -20 }, elbowL: 35, armR: { fwd: 18, side: 32, twist: -20 }, elbowR: 35,
      legL: { side: 8 }, kneeL: 6, legR: { side: 8 }, kneeR: 6 } },
    { t: 4, pose: { pos: [0, -0.02, 0], spine: { x: -5 }, chest: { x: -12 }, neck: { x: -5 }, head: { x: -8 },
      armL: { fwd: 22, side: 36, twist: -20 }, elbowL: 38, armR: { fwd: 22, side: 36, twist: -20 }, elbowR: 38,
      legL: { side: 8 }, kneeL: 7, legR: { side: 8 }, kneeR: 7 } },
  ] }),
  // standing tall, arms open (domain active / taunt)
  open: mk({ keys: [
    { t: 0, pose: { pos: [0, 0, 0], chest: { x: -8 }, head: { x: -12 }, armL: { fwd: 25, side: 55, twist: -40 }, elbowL: 15, armR: { fwd: 25, side: 55, twist: -40 }, elbowR: 15, legL: { side: 10 }, legR: { side: 10 } } },
    { t: 1.2, pose: { pos: [0, 0.02, 0], chest: { x: -10 }, head: { x: -15 }, armL: { fwd: 28, side: 60, twist: -40 }, elbowL: 15, armR: { fwd: 28, side: 60, twist: -40 }, elbowR: 15, legL: { side: 10 }, legR: { side: 10 } } },
  ] }),
  victory: mk({ keys: [
    { t: 0, pose: S({}) },
    { t: 0.4, ease: 'out', pose: { pos: [0, 0, 0], hips: { y: -15 }, chest: { x: -6, y: 5 }, head: { x: -10, y: 20 },
      armR: { fwd: 150, side: 10, twist: 30 }, elbowR: 60, armL: { fwd: -5, side: 12 }, elbowL: 25,
      legL: { fwd: 12, side: 8 }, kneeL: 5, legR: { fwd: -8, side: 8 }, kneeR: 3 } },
    { t: 3, pose: { pos: [0, 0.01, 0], hips: { y: -15 }, chest: { x: -8, y: 5 }, head: { x: -12, y: 20 },
      armR: { fwd: 152, side: 10, twist: 30 }, elbowR: 62, armL: { fwd: -5, side: 12 }, elbowL: 25, legL: { fwd: 12, side: 8 }, kneeL: 5, legR: { fwd: -8, side: 8 }, kneeR: 3 } },
  ] }),
  intro: mk({ keys: [
    { t: 0, pose: { pos: [0, 0, 0], chest: { x: -5 }, head: { x: -5 }, armL: { fwd: -5, side: 8 }, elbowL: 10, armR: { fwd: -5, side: 8 }, elbowR: 10, legL: { side: 5 }, legR: { side: 5 } } },
    { t: 0.8, pose: { pos: [0, 0, 0], chest: { x: -7 }, head: { x: -10, y: 10 }, armL: { fwd: -5, side: 8 }, elbowL: 10, armR: { fwd: 60, side: -10, twist: 40 }, elbowR: 120, legL: { side: 5 }, legR: { side: 5 } } },
    { t: 1.5, pose: S({}) },
  ] }),
  tpose: mk({ keys: [{ t: 0, pose: {} }] }),
};

let compiled = null;
export function getClips() {
  if (compiled) return compiled;
  compiled = {};
  for (const k in CLIP_DEFS) compiled[k] = new Clip(CLIP_DEFS[k]);
  return compiled;
}
