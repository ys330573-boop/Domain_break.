// On-screen controls for phones / tablets.
// Left thumb: floating joystick (←/→ move, ↑ jump, ↓ block). Right thumb: big buttons.
// Buttons simply fire the Player-1 keyboard keys (synthetic KeyboardEvents), so they work for
// local play, vs CPU AND for the online guest (online.js forwards those keys to the host).
import { isTouch } from './display.js';

const KEY = { left: 'KeyA', right: 'KeyD', down: 'KeyS', jump: 'KeyW', light: 'KeyJ', heavy: 'KeyK', s1: 'KeyL', s2: 'KeyU', s3: 'KeyO', ult: 'KeyI', dash: 'ShiftLeft', pause: 'Escape' };
const COMBO_REPEAT = 0.17;   // holding ATTACK keeps tapping light → full combo string automatically

// x, y = button centre measured from the bottom-right corner, s = diameter (all in units of --b)
const BUTTONS = [
  { id: 'light', label: 'ATTACK', sub: 'hold = combo', x: 1.6, y: 1.3, s: 1.5, cls: 'main' },
  { id: 'heavy', label: 'HEAVY', x: 3.05, y: 0.8, s: 1.05 },
  { id: 'jump', label: 'JUMP', x: 0.68, y: 2.62, s: 1.02 },
  { id: 'dash', label: 'DASH', x: 2.0, y: 2.85, s: 0.95 },
  { id: 'down', label: 'BLOCK', x: 3.2, y: 2.0, s: 1.0, cls: 'guard' },
  { id: 's1', label: 'SP 1', x: 2.62, y: 3.92, s: 0.86, cls: 'sp' },
  { id: 's2', label: 'SP 2', x: 1.62, y: 4.02, s: 0.86, cls: 'sp' },
  { id: 's3', label: 'SP 3', x: 0.62, y: 3.88, s: 0.86, cls: 'sp' },
  { id: 'ult', label: 'DOMAIN', jp: '領域', x: 3.78, y: 3.36, s: 1.0, cls: 'ult' },
];

function key(code, down) {
  document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true, cancelable: true }));
}
const buzz = ms => { try { navigator.vibrate?.(ms); } catch (e) {} };

export class TouchControls {
  // getFighter(): the local Player-1 fighter (null for the online guest) — used for labels and the DOMAIN glow
  constructor({ getFighter }) {
    this.getFighter = getFighter;
    this.held = new Set();
    this.visible = false;
    this.el = document.createElement('div');
    this.el.id = 'touchpad';
    this.el.innerHTML = `
      <div class="tzone"></div>
      <div class="stick"><i class="ar u">▲<small>JUMP</small></i><i class="ar d">▼<small>BLOCK</small></i><i class="ar l">◀</i><i class="ar r">▶</i><b class="knob"></b></div>
      <div class="tbtns"></div>`;
    document.body.appendChild(this.el);
    this.zone = this.el.querySelector('.tzone');
    this.stick = this.el.querySelector('.stick');
    this.knob = this.el.querySelector('.knob');
    this.btns = {};
    const wrap = this.el.querySelector('.tbtns');
    for (const b of BUTTONS) {
      const e = document.createElement('div');
      e.className = 'tbtn ' + (b.cls || '');
      e.style.setProperty('--x', b.x); e.style.setProperty('--y', b.y); e.style.setProperty('--s', b.s);
      e.innerHTML = `${b.jp ? `<em>${b.jp}</em>` : ''}<span>${b.label}</span>${b.sub ? `<small>${b.sub}</small>` : ''}`;
      wrap.appendChild(e);
      this.btns[b.id] = e;
      this.bindButton(e, b.id);
    }
    this.bindStick();
    this.lastKit = null;
  }

  // ------------------------------------------------------------ buttons
  press(id) { if (this.held.has(id)) return; this.held.add(id); key(KEY[id], true); }
  release(id) { if (!this.held.has(id)) return; this.held.delete(id); key(KEY[id], false); }
  bindButton(e, id) {
    let pid = null, rep = null;
    const up = ev => {
      if (ev.pointerId !== pid) return;
      pid = null; e.classList.remove('down'); clearInterval(rep); rep = null;
      this.release(id);
    };
    e.addEventListener('pointerdown', ev => {
      ev.preventDefault(); ev.stopPropagation();
      if (pid != null) return;
      pid = ev.pointerId; e.setPointerCapture?.(pid);
      e.classList.add('down'); buzz(id === 'ult' ? 30 : 8);
      this.press(id);
      if (id === 'light') rep = setInterval(() => { key(KEY.light, false); key(KEY.light, true); }, COMBO_REPEAT * 1000);
    });
    e.addEventListener('pointerup', up);
    e.addEventListener('pointercancel', up);
    e.addEventListener('lostpointercapture', up);
  }

  // ------------------------------------------------------------ joystick (floats to where the thumb lands)
  bindStick() {
    let pid = null, ox = 0, oy = 0;
    const st = { left: false, right: false, down: false, jump: false };
    const set = (id, on) => { if (st[id] === on) return; st[id] = on; on ? this.press(id) : this.release(id); };
    const R = () => this.stick.offsetWidth * 0.5;
    const move = ev => {
      if (ev.pointerId !== pid) return;
      const r = R();
      let dx = (ev.clientX - ox) / r, dy = (ev.clientY - oy) / r;
      const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
      this.knob.style.transform = `translate(${dx * r * 0.62}px, ${dy * r * 0.62}px)`;
      // hysteresis: switch on at a bigger push than switch off, so a resting thumb doesn't flicker (D-D = domain!)
      set('right', st.right ? dx > 0.22 : dx > 0.38);
      set('left', st.left ? dx < -0.22 : dx < -0.38);
      set('jump', st.jump ? dy < -0.45 : dy < -0.62);
      set('down', st.down ? dy > 0.4 : dy > 0.58);
    };
    const end = ev => {
      if (ev.pointerId !== pid) return;
      pid = null;
      for (const k in st) set(k, false);
      this.stick.classList.remove('active'); this.stick.style.left = this.stick.style.top = '';
      this.knob.style.transform = '';
    };
    this.zone.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      if (pid != null) return;
      pid = ev.pointerId; this.zone.setPointerCapture?.(pid);
      const r = R(), z = this.zone.getBoundingClientRect();
      ox = Math.min(Math.max(ev.clientX, z.left + r), z.right - r * 0.4);
      oy = Math.min(Math.max(ev.clientY, z.top + r), innerHeight - r - 4);
      this.stick.classList.add('active');
      this.stick.style.left = (ox - r) + 'px'; this.stick.style.top = (oy - r) + 'px';
      move(ev);
    });
    this.zone.addEventListener('pointermove', move);
    this.zone.addEventListener('pointerup', end);
    this.zone.addEventListener('pointercancel', end);
    this.zone.addEventListener('lostpointercapture', end);
  }

  // ------------------------------------------------------------ per frame
  releaseAll() { for (const id of [...this.held]) this.release(id); }
  update(show) {
    show = show && isTouch;
    if (show !== this.visible) {
      this.visible = show; this.el.classList.toggle('on', show);
      if (!show) this.releaseAll();
    }
    if (!show) return;
    const f = this.getFighter();
    if (f?.kit && f.kit !== this.lastKit) {          // show the real special names of the local fighter
      this.lastKit = f.kit;
      for (const s of ['s1', 's2', 's3']) {
        const n = f.kit[s]?.name; if (n) this.btns[s].querySelector('span').textContent = n.split(' ').slice(-1)[0];
      }
    }
    if (f) {
      this.btns.ult.classList.toggle('ready', f.domain >= 100);
      for (const s of ['s1', 's2', 's3']) this.btns[s].classList.toggle('low', f.burnout > 0 || f.energy < (f.kit[s]?.cost || 0));
    }
  }
}
