// Input: keyboard (2 players) + gamepads, with a short press buffer.
// Every controller exposes the same interface, so AI / future touch controls plug in.
export const ACTIONS = ['light', 'heavy', 's1', 's2', 's3', 'ult', 'jump', 'dash'];

export const KEYMAPS = {
  p1: { left: ['KeyA'], right: ['KeyD'], down: ['KeyS'], jump: ['KeyW', 'Space'], light: ['KeyJ'], heavy: ['KeyK'], s1: ['KeyL'], s2: ['KeyU'], s3: ['KeyO'], ult: ['KeyI', 'DT:KeyD'], dash: ['ShiftLeft'] },
  p2: { left: ['ArrowLeft'], right: ['ArrowRight'], down: ['ArrowDown'], jump: ['ArrowUp'], light: ['Numpad1', 'Comma'], heavy: ['Numpad2', 'Period'], s1: ['Numpad3', 'Slash'], s2: ['Numpad4', 'Semicolon'], s3: ['Numpad5', 'Quote'], ult: ['Numpad6', 'BracketRight', 'DT:ArrowRight'], dash: ['Numpad0', 'ShiftRight'] },
};

// 'DT:<code>' in a keymap = double-tap that key (two presses within DOUBLE_TAP seconds)
const DOUBLE_TAP = 0.28;
const down = new Set();
const pressedAt = new Map();
const lastTap = new Map();
let now = 0;
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  down.add(e.code); pressedAt.set(e.code, now);
  const prev = lastTap.get(e.code);
  if (prev != null && now - prev <= DOUBLE_TAP) { pressedAt.set('DT:' + e.code, now); lastTap.delete(e.code); }
  else lastTap.set(e.code, now);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Quote', 'Slash'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => down.delete(e.code));
window.addEventListener('blur', () => down.clear());
export function tickInput(t) { now = t; }
export function anyKeyDown() { return down.size > 0; }

const BUFFER = 0.16;

export class KeyboardController {
  constructor(map, padIndex = null) { this.map = map; this.padIndex = padIndex; this.consumed = new Map(); this.padPrev = {}; this.padPress = {}; }
  _held(a) {
    if ((this.map[a] || []).some(k => down.has(k))) return true;
    return !!this.pad()?.[a];
  }
  pad() {
    if (this.padIndex == null) return null;
    const gp = navigator.getGamepads?.()[this.padIndex]; if (!gp) return null;
    const b = i => gp.buttons[i]?.pressed;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    return { left: ax < -0.4 || b(14), right: ax > 0.4 || b(15), down: ay > 0.6 || b(13), jump: b(0) || ay < -0.7 || b(12), light: b(2), heavy: b(3), s1: b(1), s2: b(5), s3: b(7), ult: b(4) && b(5) || b(6), dash: b(4) && !b(5) };
  }
  update() { // detect gamepad edges
    const p = this.pad(); if (!p) return;
    for (const a of ACTIONS) { if (p[a] && !this.padPrev[a]) this.padPress[a] = now; this.padPrev[a] = p[a]; }
  }
  get left() { return this._held('left'); }
  get right() { return this._held('right'); }
  get down() { return this._held('down'); }
  get jumpHeld() { return this._held('jump'); }
  // buffered press, consumed once
  pressed(a) {
    let t = -1;
    for (const k of this.map[a] || []) if (pressedAt.has(k)) t = Math.max(t, pressedAt.get(k));
    if (this.padPress[a] != null) t = Math.max(t, this.padPress[a]);
    if (t < 0 || now - t > BUFFER) return false;
    if (this.consumed.get(a) === t) return false;
    this.consumed.set(a, t); return true;
  }
  peek(a) {
    let t = -1;
    for (const k of this.map[a] || []) if (pressedAt.has(k)) t = Math.max(t, pressedAt.get(k));
    if (this.padPress[a] != null) t = Math.max(t, this.padPress[a]);
    return t >= 0 && now - t <= BUFFER && this.consumed.get(a) !== t;
  }
}

// Controller driven by code (AI)
export class VirtualController {
  constructor() { this.left = false; this.right = false; this.down = false; this.jumpHeld = false; this.queue = new Map(); }
  press(a) { this.queue.set(a, now); }
  pressed(a) { const t = this.queue.get(a); if (t == null || now - t > BUFFER) return false; this.queue.delete(a); return true; }
  peek(a) { const t = this.queue.get(a); return t != null && now - t <= BUFFER; }
  update() {}
}
