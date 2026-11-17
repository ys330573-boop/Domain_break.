import * as THREE from 'three';
import { ROSTER } from './roster.js';
import { CHAR_HEIGHT } from './rig.js';
import { buildSource, createActor } from './actor.js';
import { makeToonMaterial, makeOutlineMaterial, makeFighterUniforms } from './toon.js';
import { Animator } from './anim.js';
import { getClips } from './poses.js';
import { Post } from './post.js';
import { HUD } from './hud.js';
import { Game } from './game.js';
import { initAudio, sfx } from './audio.js';
import { tickInput, VirtualController } from './input.js';
import { getTex } from './textures.js';
import { AI } from './ai.js';
import { MOVES } from './moves.js';
import { probeVoiceFiles, setVoiceEnabled, voiceEnabled } from './voice.js';
import { preloadPurple } from './purple.js';
import { initOnline, openOnline, isGuest, guestPlaying, onlineRole, guestKey, onlineTestFrame } from './online.js';
import { isTouch, onResize, toggleFullscreen, canFullscreen } from './display.js';
import { TouchControls } from './touch.js';
import { fitFov } from './camera.js';

const $ = s => document.querySelector(s);
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 1.75));   // phones: keep the frame rate up
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const post = new Post(renderer);
const hud = new HUD();
const rigs = {}, portraits = {};
let game = null, screen = 'loading';
const sel = { p1: 0, p2: 1, mode: 'cpu', level: 'normal', stage: 'dusk', step: 0 };

// ------------------------------------------------------------------ loading
async function boot() {
  const bar = $('#loadbar i'), txt = $('#loadtxt');
  let done = 0;
  const only = new URLSearchParams(location.search).get('test') ? [new URLSearchParams(location.search).get('p1'), new URLSearchParams(location.search).get('p2')] : null;
  for (const def of ROSTER) {
    if (only && !only.includes(def.id)) { done++; continue; }
    txt.textContent = `RIGGING ${def.name} · ${def.title.toUpperCase()}`;
    try {
      rigs[def.id] = await buildSource(def, e => { if (e.total) bar.style.width = ((done + e.loaded / e.total * 0.8) / ROSTER.length * 100) + '%'; });
      if (def.domainForm) rigs[def.id].form = await buildSource({ ...def, ...def.domainForm, id: def.id + '_form', domainForm: null });
    } catch (err) { console.error('Failed to load', def.file, err); }
    done++; bar.style.width = (done / ROSTER.length * 100) + '%';
    await new Promise(r => setTimeout(r, 0));
  }
  makePortraits();
  window.__online = { onlineRole };
  await preloadPurple();
  probeVoiceFiles(ROSTER);
  for (const t of ['glow', 'spark', 'burst', 'ring', 'slash', 'line', 'smoke', 'flame', 'crack']) getTex(t);
  buildSelect();
  show('title');
  initOnline(onlineHooks);
}

function makePortraits() {
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(256, 256); r.outputColorSpace = THREE.SRGBColorSpace; r.setClearColor(0x000000, 0);
  for (const def of ROSTER) {
    if (!rigs[def.id]) continue;
    const U = makeFighterUniforms(def.color); U.uOutlineWidth.value = 0.006;
    const inst = createActor(rigs[def.id], U);
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight('#ffffff', '#554466', 1.6));
    const d = new THREE.DirectionalLight('#fff', 2.4); d.position.set(2, 3, 4); s.add(d);
    s.add(inst.group);
    const an = inst.anim; an.play(getClips().intro, { fade: 0, name: 'intro' }); an.update(0.01);
    inst.group.updateMatrixWorld(true);
    const head = inst.bones.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, CHAR_HEIGHT * 0.045, 0));
    const cam = new THREE.PerspectiveCamera(26, 1, 0.01, 50);
    cam.position.copy(head).add(new THREE.Vector3(0.28, 0.02, 1.05)); cam.lookAt(head.clone().add(new THREE.Vector3(0, -0.06, 0)));
    r.render(s, cam);
    portraits[def.id] = r.domElement.toDataURL();
  }
  r.dispose();
}

// ------------------------------------------------------------------ showcase (select screen 3D)
const showcase = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100), slots: [null, null] };
{
  const S = showcase.scene;
  S.add(new THREE.HemisphereLight('#ffffff', '#3a2a50', 1.5));
  const d = new THREE.DirectionalLight('#fff', 2.6); d.position.set(-2, 4, 5); S.add(d);
  showcase.bgU = { uC1: { value: new THREE.Color('#4fd6ff') }, uC2: { value: new THREE.Color('#ff3048') }, uTime: { value: 0 } };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(40, 22), new THREE.ShaderMaterial({ uniforms: showcase.bgU, depthWrite: false,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uC1; uniform vec3 uC2; uniform float uTime; varying vec2 vU;
      float h(float n){ return fract(sin(n)*43758.5453); }
      void main(){ vec2 p = vU - 0.5; p.x *= 1.8;
        float side = smoothstep(-0.02, 0.02, p.x + p.y * 0.35);
        vec3 base = mix(uC1 * 0.55, uC2 * 0.55, side);
        float a = atan(p.y, p.x - sign(p.x) * 0.45); float seg = floor(a * 40.0);
        float ln = step(0.75, h(seg + floor(uTime * 6.0)));
        base = mix(base, mix(uC1, uC2, side) * 1.2, ln * 0.35 * smoothstep(0.1, 0.6, length(p)));
        float d = abs(p.x + p.y * 0.35); base = mix(vec3(1.0), base, smoothstep(0.0, 0.012, d));
        vec2 hp = gl_FragCoord.xy / 7.0; float dotv = length(fract(hp) - 0.5);
        base *= 1.0 - 0.25 * step(dotv, 0.25 * length(p) * 1.4);
        gl_FragColor = vec4(base, 1.0); }` }));
  bg.position.set(0, 1.2, -6); S.add(bg);
  showcase.cam.position.set(0, 1.25, 6.2); showcase.cam.lookAt(0, 1.0, 0);
}
function setShowcase(slot, def) {
  const old = showcase.slots[slot];
  if (old && old.def === def) return;
  if (old) old.inst.group.removeFromParent();
  if (!def || !rigs[def.id]) { showcase.slots[slot] = null; return; }
  const U = makeFighterUniforms(def.color);
  const inst = createActor(rigs[def.id], U);
  inst.group.position.set(slot ? 1.55 : -1.55, 0, 0);
  inst.group.rotation.y = slot ? -0.45 : 0.45;
  const an = inst.anim; an.play(getClips().intro, { fade: 0, name: 'intro' });
  showcase.scene.add(inst.group);
  showcase.slots[slot] = { def, inst, an, t: 0, U };
  showcase.bgU[slot ? 'uC2' : 'uC1'].value.set(def.color);
  U.uFlash.value = 1;
}
function updateShowcase(dt) {
  showcase.bgU.uTime.value += dt;
  for (const s of showcase.slots) if (s) {
    s.t += dt; s.an.update(dt); s.U.uFlash.value = Math.max(0, s.U.uFlash.value - dt * 4);
    if (s.t > 1.5 && s.an.clip !== getClips().idle) s.an.play(getClips().idle, { fade: 0.3, name: 'idle' });
  }
}

// ------------------------------------------------------------------ UI screens
function show(name) {
  screen = name;
  document.querySelectorAll('.screen').forEach(e => e.classList.toggle('active', e.id === name));
  $('#hud').classList.toggle('hidden', name !== 'fight');
  if (name !== 'fight') { post.letterbox = false; post.grade({}); }
  if (name === 'select') { sel.step = 0; refreshSelect(); }
  document.body.classList.toggle('fighting', name === 'fight');
}
function buildSelect() {
  const grid = $('#grid');
  grid.innerHTML = '';
  ROSTER.forEach((def, i) => {
    const el = document.createElement('div'); el.className = 'card'; el.dataset.i = i;
    el.style.setProperty('--c', def.color);
    el.innerHTML = `<div class="face" style="background-image:url(${portraits[def.id] || ''})"></div><div class="nm">${def.name}</div><div class="tt">${def.title}</div>`;
    el.onmouseenter = () => { if (isTouch || (sel.online && sel.step === 0)) return; sel[pickSlot()] = i; refreshSelect(); sfx('ui'); };
    // touch: first tap selects the fighter (shows them), a second tap on the same card confirms
    el.onclick = () => {
      if (isTouch && sel[pickSlot()] !== i) { if (sel.online && sel.step === 0) return; sel[pickSlot()] = i; refreshSelect(); sfx('ui'); return; }
      confirmPick();
    };
    grid.appendChild(el);
  });
  // locked slot to show where future characters go
  const lock = document.createElement('div'); lock.className = 'card locked'; lock.innerHTML = '<div class="face"></div><div class="nm">?</div><div class="tt">COMING SOON</div>';
  grid.appendChild(lock);
}
// which slot the current select step edits (online: the friend = Player 2 picks first, then you = Player 1)
function pickSlot() { return sel.online ? (sel.step === 0 ? 'p2' : 'p1') : (sel.step === 0 ? 'p1' : 'p2'); }
function refreshSelect() {
  const show1 = !sel.online || sel.step >= 1, show2 = sel.online || sel.step >= 1;
  document.querySelectorAll('#grid .card').forEach(el => {
    const i = +el.dataset.i;
    el.classList.toggle('p1', show1 && i === sel.p1); el.classList.toggle('p2', show2 && i === sel.p2);
  });
  setShowcase(0, show1 ? ROSTER[sel.p1] : null);
  setShowcase(1, show2 ? ROSTER[sel.p2] : null);
  const d1 = ROSTER[sel.p1], d2 = ROSTER[sel.p2];
  $('#selp1').innerHTML = show1 ? `<b style="--c:${d1.color}">${d1.name}</b><i>${d1.title}</i>` : `<b class="dim">YOU</b><i>after your friend…</i>`;
  $('#selp2').innerHTML = show2 ? `<b style="--c:${d2.color}">${d2.name}</b><i>${d2.title}</i>` : `<b class="dim">${sel.mode === 'cpu' ? 'CPU' : 'P2'}</b><i>choose…</i>`;
  $('#selhint').textContent = sel.online
    ? (sel.step === 0 ? 'YOUR FRIEND (PLAYER 2) IS CHOOSING…' : 'PLAYER 1 — NOW CHOOSE YOUR FIGHTER')
    : sel.step === 0 ? 'PLAYER 1 — CHOOSE YOUR FIGHTER' : sel.mode === 'cpu' ? 'CHOOSE YOUR OPPONENT' : 'PLAYER 2 — CHOOSE YOUR FIGHTER';
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === sel.mode));
  document.querySelectorAll('[data-level]').forEach(b => b.classList.toggle('on', b.dataset.level === sel.level));
  document.querySelectorAll('[data-stage]').forEach(b => b.classList.toggle('on', b.dataset.stage === sel.stage));
  $('#levels').style.display = sel.mode === 'cpu' ? '' : 'none';
}
function confirmPick() {
  sfx('select');
  if (sel.step === 0) {
    sel.step = 1;
    if (sel.online) { if (sel.p1 === sel.p2) sel.p1 = (sel.p2 + 1) % ROSTER.length; showcase.slots[1] && (showcase.slots[1].U.uFlash.value = 1); }
    else { if (sel.p2 === sel.p1) sel.p2 = (sel.p1 + 1) % ROSTER.length; showcase.slots[0] && (showcase.slots[0].U.uFlash.value = 1); }
    refreshSelect();
  } else startFight();
}
function startFight() {
  show('vs');
  const d1 = ROSTER[sel.p1], d2 = ROSTER[sel.p2];
  $('#vs').innerHTML = `<div class="vsside l" style="--c:${d1.color}"><div class="face" style="background-image:url(${portraits[d1.id]})"></div><b>${d1.name}</b><i>${d1.title}</i></div>
    <div class="vsmid">VS</div>
    <div class="vsside r" style="--c:${d2.color}"><div class="face" style="background-image:url(${portraits[d2.id]})"></div><b>${d2.name}</b><i>${d2.title}</i></div>`;
  sfx('boom');
  setTimeout(() => {
    if (game) game.dispose();
    game = new Game(renderer, post, hud, portraits);
    game.start({ defs: [d1, d2], rigs: [rigs[d1.id], rigs[d2.id]], mode: sel.mode, level: sel.level, palette: sel.stage, onEnd: onMatchEnd });
    show('fight');
  }, 1700);
}
function onMatchEnd(winner, fighters) {
  const w = fighters[winner];
  setTimeout(() => {
    $('#resultbox').innerHTML = `<div class="face" style="background-image:url(${portraits[w.def.id]});--c:${w.def.color}"></div>
      <h2 style="--c:${w.def.color}">${sel.mode === 'cpu' ? (winner === 0 ? 'VICTORY' : 'DEFEAT') : `PLAYER ${winner + 1} WINS`}</h2>
      <p>${w.def.name} · ${w.def.title}</p>
      <div class="btns"><button id="rematch">REMATCH</button><button id="toselect">CHARACTER SELECT</button></div>`;
    $('#rematch').onclick = () => { sfx('select'); startFight(); };
    $('#toselect').onclick = () => { sfx('ui'); show('select'); };
    show('result');
  }, 400);
}

// ------------------------------------------------------------------ events
document.addEventListener('pointerdown', () => initAudio());
document.addEventListener('keydown', e => {
  initAudio();
  if (screen === 'title' && (e.code === 'Enter' || e.code === 'Space')) { sfx('select'); show('select'); return; }
  if (screen === 'select') {
    if (sel.online && sel.step === 0) return;   // online: your friend is choosing first
    const n = ROSTER.length;
    const k = pickSlot();
    if (['KeyA', 'ArrowLeft'].includes(e.code)) { sel[k] = (sel[k] + n - 1) % n; sfx('ui'); refreshSelect(); }
    if (['KeyD', 'ArrowRight'].includes(e.code)) { sel[k] = (sel[k] + 1) % n; sfx('ui'); refreshSelect(); }
    if (['Enter', 'KeyJ', 'Space'].includes(e.code)) confirmPick();
    if (['Escape', 'KeyK', 'Backspace'].includes(e.code)) selectBack();
  }
  if (screen === 'fight' && e.code === 'Escape') togglePause();
});
// select-screen BACK (same as Esc) — needed on phones that have no keyboard
function selectBack() { if (screen !== 'select' || (sel.online && sel.step === 0)) return; if (sel.step > 0) { sel.step = 0; refreshSelect(); sfx('ui'); } else show('title'); }
$('#backbtn').onclick = () => selectBack();
// fullscreen + pause buttons (top of the screen)
$('#fsbtn').onclick = e => { e.stopPropagation(); toggleFullscreen(); };
if (!canFullscreen) $('#fsbtn').style.display = 'none';
$('#pausebtn').onclick = e => { e.stopPropagation(); if (isGuest()) { guestKey('Escape', true); guestKey('Escape', false); } else if (screen === 'fight') togglePause(); };
const touch = new TouchControls({ getFighter: () => (!isGuest() && game?.fighters?.[0]) || null });
// ------------------------------------------------------------------ online (src/online.js)
// the friend's keys arrive here and are replayed as Player-2 keys (they press their own WASD / J K L…)
const GUEST_FIGHT = { KeyA: 'ArrowLeft', ArrowLeft: 'ArrowLeft', KeyD: 'ArrowRight', ArrowRight: 'ArrowRight', KeyS: 'ArrowDown', ArrowDown: 'ArrowDown',
  KeyW: 'ArrowUp', Space: 'ArrowUp', ArrowUp: 'ArrowUp', KeyJ: 'Comma', KeyK: 'Period', KeyL: 'Slash', KeyU: 'Semicolon', KeyO: 'Quote',
  KeyI: 'BracketRight', ShiftLeft: 'ShiftRight', ShiftRight: 'ShiftRight', Escape: 'Escape' };
const GUEST_MENU = { KeyA: 'ArrowLeft', ArrowLeft: 'ArrowLeft', KeyD: 'ArrowRight', ArrowRight: 'ArrowRight', KeyJ: 'Enter', Enter: 'Enter', Space: 'Enter', KeyK: 'Backspace', Escape: 'Backspace' };
const guestDown = new Map();   // guest code -> replayed code
function fakeKey(code, down) { document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true })); }
function onGuestKey(code, down) {
  if (!down) { const m = guestDown.get(code); if (m) { guestDown.delete(code); fakeKey(m, false); } return; }
  if (screen === 'select') {           // the friend picks Player 2 first, then you pick Player 1
    if (!sel.online || sel.step !== 0) return;
    const m = GUEST_MENU[code], n = ROSTER.length;
    if (m === 'ArrowLeft') { sel.p2 = (sel.p2 + n - 1) % n; sfx('ui'); refreshSelect(); }
    else if (m === 'ArrowRight') { sel.p2 = (sel.p2 + 1) % n; sfx('ui'); refreshSelect(); }
    else if (m === 'Enter') confirmPick();
    return;
  }
  if (screen === 'result') { if (['Enter', 'KeyJ', 'Space'].includes(code)) $('#rematch')?.click(); return; }
  if (screen !== 'fight') return;
  const m = GUEST_FIGHT[code]; if (!m) return;
  guestDown.set(code, m); fakeKey(m, true);
}
function onHostConnected() {
  sel.mode = 'vs'; sel.online = true;
  if (game && screen === 'fight') { game.dispose(); game = null; }
  show('select');
  hud.announce('FRIEND JOINED', 'round', 1400);
  if (Q.get('autofight')) { sel.p1 = 0; sel.p2 = 1; sel.step = 1; startFight(); }
  if (Q.get('onlinetest')) onlineTestHost();
}
function onlineOff() { if (!sel.online) return; sel.online = false; if (screen === 'select') { sel.step = 0; refreshSelect(); } }
const onlineHooks = { onHostConnected, onGuestKey, onHostLost: onlineOff, onHostEnd: onlineOff,
  onGuestStart: () => { if (Q.get('autojoin') && Q.get('onlinetest')) onlineTestGuest(); } };
$('#onlinebtn').addEventListener('click', e => { e.stopPropagation(); initAudio(); sfx('ui'); openOnline(); });
$('#onlinebtn2').onclick = () => { sfx('ui'); openOnline(); };

function togglePause() {
  if (!game) return;
  game.paused = !game.paused; $('#pause').classList.toggle('active', game.paused);
}
$('#title').addEventListener('click', () => { initAudio(); sfx('select'); show('select'); });
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { sel.mode = b.dataset.mode; sfx('ui'); refreshSelect(); });
document.querySelectorAll('[data-level]').forEach(b => b.onclick = () => { sel.level = b.dataset.level; sfx('ui'); refreshSelect(); });
document.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => { sel.stage = b.dataset.stage; sfx('ui'); refreshSelect(); });
$('#resume').onclick = togglePause;
$('#quit').onclick = () => { togglePause(); if (game) { game.dispose(); game = null; } show('select'); };
$('#movesbtn').onclick = () => $('#moves').classList.toggle('active');
$('#voicebtn').onclick = () => { setVoiceEnabled(!voiceEnabled()); $('#voicebtn').textContent = 'VOICE ' + (voiceEnabled() ? 'ON' : 'OFF'); $('#voicebtn').classList.toggle('on', voiceEnabled()); sfx('ui'); };
$('#movesclose').onclick = () => $('#moves').classList.remove('active');

function resize() {
  renderer.setSize(innerWidth, innerHeight); post.setSize(innerWidth, innerHeight);
  showcase.cam.aspect = innerWidth / innerHeight; showcase.cam.fov = fitFov(30, showcase.cam.aspect); showcase.cam.updateProjectionMatrix();
  game?.resize();
}
onResize(resize);
resize();

// ------------------------------------------------------------------ loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  tickInput(now / 1000);
  window.__fc = (window.__fc || 0) + 1;
  const gp = guestPlaying(); document.body.classList.toggle('guestplay', gp);
  touch.update(gp || (screen === 'fight' && !!game && !game.paused && game.phase !== 'replay'));
  if (isGuest()) return;          // watching the host's game: nothing to draw here
  if (screen === 'fight' && game) { if (!window.__hold) game.update(dt); game.render(); }
  else if (['select', 'vs', 'title', 'result'].includes(screen)) {
    updateShowcase(dt);
    post.update(dt, now / 1000);
    post.render(showcase.scene, showcase.cam);
  }
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ dev/test hook: ?test=1&p1=gojo&p2=sukuna&domainAt=3&ai1=1
const Q = new URLSearchParams(location.search);
async function post8766(name, body) {
  for (let i = 0; i < 5; i++) {
    try { await fetch(`/save?name=${name}`, { method: 'POST', body, cache: 'no-store', keepalive: false }); return; } catch (e) { await new Promise(r => setTimeout(r, 300)); }
  }
}
if (Q.get('join')) {   // opened from an invite link: this page only shows the host's game
  document.querySelectorAll('.screen').forEach(e => e.classList.remove('active'));
  initOnline(onlineHooks);
} else boot().then(() => {
  if (Q.get('ui')) { show(Q.get('ui')); if (Q.get('step')) { sel.step = 1; refreshSelect(); } }
  if (!Q.get('test')) return;
  const i1 = ROSTER.findIndex(d => d.id === Q.get('p1')), i2 = ROSTER.findIndex(d => d.id === Q.get('p2'));
  if (i1 >= 0) sel.p1 = i1; if (i2 >= 0) sel.p2 = i2;
  sel.stage = Q.get('stage') || sel.stage;
  const d1 = ROSTER[sel.p1], d2 = ROSTER[sel.p2];
  game = new Game(renderer, post, hud, portraits);
  game.start({ defs: [d1, d2], rigs: [rigs[d1.id], rigs[d2.id]], mode: 'cpu', level: 'hard', palette: sel.stage, onEnd: onMatchEnd });
  if (Q.get('ai1')) { const ai = new AI(game.fighters[0], 'hard'); game.ctrls[0] = ai.ctrl; game.ais.push(ai); }
  if (Q.get('skipintro')) game.beginRound();
  if (Q.get('dummy')) { // passive opponent at a given distance (move testing)
    game.ais = game.ais.filter(ai => ai.f.slot !== 1);
    game.ctrls[1] = { left: false, right: false, down: false, pressed: () => false, peek: () => false, update() {} };
    const d = +Q.get('dummy'); const _br = game.beginRound.bind(game);
    game.fighters[1].reset(game.fighters[0].pos.x + d);
  }
  if (Q.get('lowhp')) game.fighters[1].hp = +Q.get('lowhp');
  if (Q.get('mash')) { // P1 holds forward and taps light/heavy (e.g. mash=light) — combo movement testing
    let n = 0; const btn = Q.get('mash'), vc = new VirtualController(); vc.right = true;
    game.ais = game.ais.filter(ai => ai.f.slot !== 0); game.ctrls[0] = vc;
    const _u = game.update.bind(game); game.update = dt => { if (++n % 10 === 0) vc.press(btn); _u(dt); };
  }
  show('fight');
  window.__game = game;
  // deterministic simulation: step N seconds at 60fps, then hold the frame for a screenshot
  // shots=2.1,3.0 → simulate to each time, render, POST the frame to the dev server (port 8766)
  const shots = (Q.get('shots') || Q.get('sim') || '').split(',').filter(Boolean).map(Number);
  if (shots.length) {
    window.__hold = true;
    const dAt = +Q.get('domainAt'), sAt = +Q.get('superAt'), tag = Q.get('tag') || 'cap';
    let clock = 1000, done = { d: false, s: false }, simTime = 0;
    const log = [];
    (async () => {
      for (const target of shots) {
        while (simTime < target) {
          clock += 1 / 60; simTime += 1 / 60; tickInput(clock);
          if (game.phase === 'fight') {
            if (dAt && !done.d && game.phaseT > dAt) { done.d = true; const f = game.fighters[+(Q.get('caster') || 0)]; f.domain = 100; f.faceOpp(); game.startDomain(f, f.def.kit); }
            if (sAt && !done.s && game.phaseT > sAt) { done.s = true; const f = game.fighters[+(Q.get('caster') || 0)]; f.energy = 100; f.state = 'idle'; f.faceOpp(); const mv = Q.get('move') || 's3'; f.startMove(f.kit[mv] || MOVES[mv]); }
          }
          game.update(1 / 60);
        }
        game.render();
        const info = { at: target, phase: game.phase, t: +game.time.toFixed(2), hp: game.fighters.map(f => Math.round(f.hp)), st: game.fighters.map(f => f.state), dc: game.fighters.map(f => f.decap ? +f.decapT.toFixed(2) : null), cs: game.fighters[0]._cs, hl: game.fighters[0].hitLanded, x: game.fighters.map(f => +f.pos.x.toFixed(2)), y: game.fighters.map(f => +f.pos.y.toFixed(2)), vis: game.fighters.map(f => f.root.visible), cam: game.cam.pos.toArray().map(v => +v.toFixed(1)), dom: game.fighters.map(f => Math.round(f.domain)),
          fx: [...document.querySelectorAll('#fxlayer > *')].map(e => e.className + ':' + e.textContent.slice(0, 30)) };
        log.push(info);
        if (location.port === '8766') await post8766(`${tag}_${target}`, renderer.domElement.toDataURL('image/png'));
      }
      if (location.port === '8766') await post8766(`${tag}_log`, JSON.stringify(log, null, 1));
      document.title = 'SHOTS_DONE';
    })();
  }
});

// ------------------------------------------------------------------ online self-test (two headless browsers)
// host:  ?onlinetest=1&host=ABCD-1234&autofight=1     guest: ?onlinetest=1&join=ABCD-1234&autojoin=1
function onlineTestHost() {
  const log = [], t0 = performance.now();
  // headless browsers may not run requestAnimationFrame: drive the game from a timer if frames stall
  let lastFc = -1, rafStalled = 0;
  setInterval(() => {
    if (window.__fc === lastFc && screen === 'fight' && game) { rafStalled++; tickInput(performance.now() / 1000); game.update(1 / 30); game.render(); onlineTestFrame(); }
    else if (window.__fc === lastFc) { post.render(showcase.scene, showcase.cam); onlineTestFrame(); }
    lastFc = window.__fc;
  }, 33);
  const iv = setInterval(async () => {
    const g = game; if (g && g.phase === 'intro') g.beginRound();
    if (!Q.get('autofight')) { log.push({ t: +((performance.now() - t0) / 1000).toFixed(2), screen, step: sel.step, p1: sel.p1, p2: sel.p2, online: !!sel.online });
      if (screen === 'select' && sel.step === 1 && !log.hostPicked) { log.hostPicked = 1; setTimeout(() => { fakeKey('KeyD', true); fakeKey('KeyD', false); fakeKey('Enter', true); fakeKey('Enter', false); }, 600); } }
    if (g) { const f = g.fighters[1]; log.push({ t: +((performance.now() - t0) / 1000).toFixed(2), fc: window.__fc, stall: rafStalled, phase: g.phase, x: +f.pos.x.toFixed(2), st: f.state, anim: f.animName, hp: g.fighters.map(q => Math.round(q.hp)) }); }
    if (performance.now() - t0 > 17000) {
      clearInterval(iv);
      await post8766('onl_host_shot', renderer.domElement.toDataURL('image/png'));
      await post8766('onl_host_log', JSON.stringify(log));
    }
  }, 250);
}
function onlineTestGuest() {
  const v = document.querySelector('#guestview canvas');
  const tap = (c, ms = 120) => { guestKey(c, true); setTimeout(() => guestKey(c, false), ms); };
  const shot = async name => { await post8766(name, v.toDataURL('image/png')); };
  setTimeout(() => guestKey('KeyA', true), 6000);
  setTimeout(() => guestKey('KeyA', false), 7600);
  setTimeout(() => shot('onl_guest_1'), 7000);
  for (let i = 0; i < 4; i++) setTimeout(() => tap('KeyJ'), 8500 + i * 380);
  setTimeout(() => tap('KeyL'), 10500);
  setTimeout(() => shot('onl_guest_2'), 11000);
  setTimeout(() => post8766('onl_guest_log', JSON.stringify({ w: v.width, h: v.height, rtt: document.querySelector('.netbadge .t')?.textContent })), 12000);
}
