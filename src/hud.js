// DOM HUD: health/energy/domain bars, timer, combo counters, move callouts,
// manga onomatopoeia pops, round announcements, domain title cards, super cut-ins.
const $ = (s) => document.querySelector(s);

export class HUD {
  constructor() {
    this.root = $('#hud');
    this.fx = $('#fxlayer');
    this.p = [0, 1].map(i => ({
      hp: $(`#p${i + 1} .hp-fill`), trail: $(`#p${i + 1} .hp-trail`), en: $(`#p${i + 1} .en-fill`), dom: $(`#p${i + 1} .dom-fill`),
      domWrap: $(`#p${i + 1} .dom`), name: $(`#p${i + 1} .pname`), title: $(`#p${i + 1} .ptitle`), port: $(`#p${i + 1} .portrait`),
      combo: $(`#combo${i + 1}`), pips: $(`#p${i + 1} .pips`), enSegs: $(`#p${i + 1} .en`),
    }));
    this.timer = $('#timer');
    this.trail = [1000, 1000];
  }
  setup(fighters, portraits) {
    fighters.forEach((f, i) => {
      const P = this.p[i];
      P.name.textContent = f.def.name; P.title.textContent = f.def.title;
      P.port.style.backgroundImage = `url(${portraits[f.def.id]})`;
      P.port.style.setProperty('--c', f.def.color);
      document.querySelector(`#p${i + 1}`).style.setProperty('--c', f.def.color);
      document.querySelector(`#p${i + 1}`).style.setProperty('--c2', f.def.accent);
    });
  }
  setVisible(v) { this.root.classList.toggle('hidden', !v); }
  update(fighters, timer, wins) {
    fighters.forEach((f, i) => {
      const P = this.p[i];
      const hp = f.hp / f.maxHp;
      P.hp.style.transform = `scaleX(${hp})`;
      this.trail[i] = Math.max(f.hp, this.trail[i] - (this.trail[i] > f.hp ? 400 : 0) * (1 / 60) * (f.comboTimer > 0 ? 0.05 : 1));
      P.trail.style.transform = `scaleX(${this.trail[i] / f.maxHp})`;
      P.hp.classList.toggle('low', hp < 0.3);
      P.en.style.transform = `scaleX(${f.energy / 100})`;
      P.enSegs.classList.toggle('burn', f.burnout > 0);
      P.dom.style.transform = `scaleY(${f.domain / 100})`;
      P.domWrap.classList.toggle('ready', f.domain >= 100);
      P.pips.innerHTML = '<i class="' + (wins[i] > 0 ? 'on' : '') + '"></i><i class="' + (wins[i] > 1 ? 'on' : '') + '"></i>';
    });
    this.timer.textContent = Math.max(0, Math.ceil(timer));
  }
  resetTrails() { this.trail = [1000, 1000]; }
  combo(slot, n) {
    const el = this.p[slot].combo;
    if (n < 2) return;
    el.innerHTML = `<b>${n}</b><span>HITS</span>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1400);
  }
  callout(slot, name, jp) {
    const el = document.createElement('div');
    el.className = 'callout ' + (slot ? 'right' : 'left');
    el.innerHTML = `${jp ? `<span class="jp">${jp}</span>` : ''}<span class="en">${name}</span>`;
    this.fx.appendChild(el); setTimeout(() => el.remove(), 1600);
  }
  toast(slot, text) {
    if (this._toastT && performance.now() - this._toastT < 500) return;
    this._toastT = performance.now();
    const el = document.createElement('div'); el.className = 'toast ' + (slot ? 'right' : 'left'); el.textContent = text;
    this.fx.appendChild(el); setTimeout(() => el.remove(), 900);
  }
  pop(text, uv, color = '#fff', size = 1) { // manga onomatopoeia at a screen position (uv 0..1)
    const el = document.createElement('div'); el.className = 'pop';
    el.textContent = text; el.style.left = (uv.x * 100) + '%'; el.style.top = ((1 - uv.y) * 100) + '%';
    el.style.setProperty('--c', color); el.style.setProperty('--s', size); el.style.setProperty('--r', ((Math.random() - 0.5) * 30) + 'deg');
    this.fx.appendChild(el); setTimeout(() => el.remove(), 700);
  }
  damage(slot, d, big) {
    const el = document.createElement('div'); el.className = 'dmg ' + (slot ? 'right' : 'left') + (big ? ' big' : '');
    el.textContent = Math.round(d); this.fx.appendChild(el); setTimeout(() => el.remove(), 800);
  }
  announce(text, cls = '', dur = 1400) {
    const el = document.createElement('div'); el.className = 'announce ' + cls;
    el.innerHTML = text; this.fx.appendChild(el); setTimeout(() => el.remove(), dur);
    return el;
  }
  spark(uv) {
    const el = document.createElement('div'); el.className = 'sparktext';
    el.innerHTML = '<span>会心</span><b>SPARK!</b>';
    this.fx.appendChild(el); setTimeout(() => el.remove(), 1300);
  }
  cutin(f, name, portrait) { // anime super cut-in band
    const el = document.createElement('div');
    el.className = 'cutin ' + (f.slot ? 'right' : 'left');
    el.style.setProperty('--c', f.def.color);
    el.innerHTML = `<div class="band"><div class="face" style="background-image:url(${portrait})"></div><div class="lines"></div><div class="txt">${name}</div></div>`;
    this.fx.appendChild(el); setTimeout(() => el.remove(), 1100);
  }
  domainCall(jp, color) {
    const el = document.createElement('div'); el.className = 'domcall'; el.style.setProperty('--c', color);
    el.innerHTML = `<div class="v">領域展開</div><div class="h">DOMAIN EXPANSION</div>`;
    this.fx.appendChild(el); setTimeout(() => el.remove(), 1700);
  }
  domainTitle(title, jp, color) {
    const el = document.createElement('div'); el.className = 'domtitle'; el.style.setProperty('--c', color);
    el.innerHTML = `<div class="jp">${jp.split('').map((c, i) => `<span style="animation-delay:${i * 0.08}s">${c}</span>`).join('')}</div><div class="en">${title}</div>`;
    this.fx.appendChild(el); setTimeout(() => el.remove(), 2300);
  }
  // anime subtitle box: name plate + Japanese line + English line
  dialog(f, line, dur = 3000) {
    document.querySelectorAll('.dialog').forEach(e => e.remove());
    const el = document.createElement('div');
    el.className = 'dialog ' + (f.slot ? 'right' : 'left');
    el.style.setProperty('--c', f.def.color);
    el.innerHTML = `<div class="who">${f.def.name}</div>${line.jp ? `<div class="jp">「${line.jp}」</div>` : ''}<div class="en">${line.en || ''}</div>`;
    document.body.appendChild(el); setTimeout(() => el.remove(), dur);
  }
  replayTag(mode) {
    document.querySelectorAll('.replaytag').forEach(e => e.remove());
    if (!mode) return;
    const el = document.createElement('div'); el.className = 'replaytag ' + mode;
    el.innerHTML = mode === 'rewind' ? '◀◀ REWIND' : '<i></i>REPLAY <small>SLOW ×0.3</small>';
    document.body.appendChild(el);
  }
  clearFx() { this.fx.innerHTML = ''; document.querySelectorAll('.dialog,.replaytag').forEach(e => e.remove()); }
}
