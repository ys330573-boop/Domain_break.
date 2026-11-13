// ONLINE — remote play with a friend.
//  HOST:  runs the real game, shares this browser tab as live video and gets a room code (e.g. QWER-4821).
//  GUEST: types the code, watches the host's game as a video and their keyboard / gamepad drives
//         Player 2 on the host (keys are sent back and replayed there as Player-2 key presses).
// Room codes are looked up through the free PeerJS broker (0.peerjs.com); video + keys then flow
// directly between the two browsers (WebRTC, with PeerJS' public TURN relay as a fallback).
// Nothing else changes in the game: every move, cinematic and menu works exactly as locally.

const PREFIX = 'domainbreak-v1-';
const $ = s => document.querySelector(s);
let PeerLib = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  return PeerLib || (PeerLib = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'vendor/peerjs/peerjs.min.js';
    s.onload = () => res(window.Peer); s.onerror = () => rej(new Error('vendor/peerjs/peerjs.min.js is missing'));
    document.head.appendChild(s);
  }));
}
function newCode() {
  const L = 'ABCDEFGHJKMNPQRSTUVWXYZ', D = '23456789', r = s => s[Math.random() * s.length | 0];
  return r(L) + r(L) + r(L) + r(L) + '-' + r(D) + r(D) + r(D) + r(D);
}
const cleanCode = c => { const s = (c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return s.length === 8 ? s.slice(0, 4) + '-' + s.slice(4) : s; };
const isLocalUrl = () => ['localhost', '127.0.0.1', ''].includes(location.hostname);

// self-test trace (?onlinetest=1): every status line is posted to the dev server
const TEST = new URLSearchParams(location.search).get('onlinetest'), TRACE = [];
function trace(m) { if (!TEST) return; TRACE.push(+(performance.now() / 1000).toFixed(2) + ' ' + m);
  fetch('/save?name=onl_trace_' + (new URLSearchParams(location.search).get('host') ? 'host' : 'guest'), { method: 'POST', body: JSON.stringify(TRACE) }).catch(() => {}); }
if (TEST) { addEventListener('error', e => trace('ERROR ' + e.message)); addEventListener('unhandledrejection', e => trace('REJECT ' + (e.reason?.message || e.reason))); trace('loaded'); }
const S = { role: null, peer: null, conn: null, call: null, stream: null, rtt: null, hooks: {}, held: new Set() };
export const isGuest = () => S.role === 'guest' && !!S.conn;
export const onlineRole = () => S.role;

// ------------------------------------------------------------------ UI
const CSS = `
#online{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;background:rgba(5,2,12,.82);font-family:var(--fd,Bangers),sans-serif;color:#fff}
#online.on{display:flex}
#online .box{background:#0d0818;border:4px solid #fff;box-shadow:10px 10px 0 #4fd6ff;padding:28px 34px;min-width:min(520px,92vw);max-width:92vw;text-align:center;transform:skewX(-2deg)}
#online h2{margin:0 0 6px;font-size:44px;letter-spacing:2px} #online h2 span{color:#4fd6ff}
#online p{font-family:'Zen Kaku Gothic New',sans-serif;font-size:15px;opacity:.85;margin:8px 0;line-height:1.5}
#online .row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:16px}
#online .code{font-size:64px;letter-spacing:6px;color:#4fd6ff;margin:8px 0;user-select:all}
#online input{font-family:inherit;font-size:40px;letter-spacing:5px;text-align:center;width:9ch;background:#000;color:#4fd6ff;border:3px solid #fff;padding:6px 10px;text-transform:uppercase}
#online .st{font-family:'Zen Kaku Gothic New',sans-serif;font-size:15px;min-height:22px;color:#ffd27a;margin-top:12px}
#online .st.ok{color:#7dffb0} #online .st.bad{color:#ff6b7a}
#guestview{position:fixed;inset:0;z-index:190;background:#000;display:none}
#guestview.on{display:block}
#guestview video{width:100%;height:100%;object-fit:contain;background:#000}
#guestview .tap{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-family:Bangers,sans-serif;font-size:40px;color:#fff;background:rgba(0,0,0,.6);cursor:pointer}
.netbadge{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:195;font-family:'Zen Kaku Gothic New',sans-serif;font-size:13px;color:#fff;background:rgba(0,0,0,.6);border:2px solid #4fd6ff;padding:3px 10px;display:none;gap:10px;align-items:center}
.netbadge.on{display:flex} .netbadge button{font-size:12px;padding:1px 8px;border-width:2px}
`;
let ui = null;
function buildUI() {
  if (ui) return ui;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const ov = document.createElement('div'); ov.id = 'online'; ov.innerHTML = '<div class="box"></div>'; document.body.appendChild(ov);
  const gv = document.createElement('div'); gv.id = 'guestview';
  gv.innerHTML = '<video playsinline autoplay></video><div class="tap">CLICK TO START SOUND</div>'; document.body.appendChild(gv);
  const badge = document.createElement('div'); badge.className = 'netbadge'; badge.innerHTML = '<span class="t"></span><button>LEAVE</button>'; document.body.appendChild(badge);
  badge.querySelector('button').onclick = () => leave();
  ui = { ov, box: ov.querySelector('.box'), gv, video: gv.querySelector('video'), tap: gv.querySelector('.tap'), badge, badgeT: badge.querySelector('.t') };
  // keys typed into the panel must not reach the game
  ov.addEventListener('keydown', e => e.stopPropagation());
  return ui;
}
function panel(html) { buildUI(); ui.box.innerHTML = html; ui.ov.classList.add('on'); }
function closePanel() { ui?.ov.classList.remove('on'); }
function status(text, cls = '') { trace('status: ' + text); const el = ui?.box.querySelector('.st'); if (el) { el.textContent = text; el.className = 'st ' + cls; } }
function badge(text) { if (text) trace('badge: ' + text); buildUI(); ui.badge.classList.toggle('on', !!text); ui.badgeT.textContent = text || ''; }

export function openOnline() {
  panel(`<h2>PLAY <span>ONLINE</span></h2>
    <p>HOST: your game runs here, you get a code and send it to your friend.<br>JOIN: type your friend's code — you play as Player 2.</p>
    <div class="row"><button id="on-host">HOST</button><button id="on-join">JOIN</button><button id="on-x">CLOSE</button></div>`);
  $('#on-host').onclick = () => startHost();
  $('#on-join').onclick = () => joinPanel();
  $('#on-x').onclick = () => closePanel();
}
function joinPanel(code = '') {
  panel(`<h2>JOIN A <span>FRIEND</span></h2><p>Type the code your friend sent you.</p>
    <input id="on-code" maxlength="9" placeholder="ABCD-1234" value="${cleanCode(code)}">
    <div class="row"><button id="on-go">JOIN</button><button id="on-back">BACK</button></div><div class="st"></div>`);
  const inp = $('#on-code'); inp.focus();
  const go = () => startGuest(inp.value);
  $('#on-go').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#on-back').onclick = () => openOnline();
}

// ------------------------------------------------------------------ HOST
async function captureTab() {
  // the whole tab (game + HUD + menus) — the browser asks which tab to share; pick this one
  try {
    if (!new URLSearchParams(location.search).get('onlinetest') && navigator.mediaDevices?.getDisplayMedia) {
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 60, max: 60 }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', systemAudio: 'exclude',
      });
      return { stream: s, full: true };
    }
  } catch (e) { console.warn('tab capture refused', e); if (e.name === 'NotAllowedError' && !S.allowCanvas) return { refused: true }; }
  // fallback: only the 3D canvas (no HP bars / menus)
  const c = document.getElementById('game');
  return { stream: c.captureStream(60), full: false };
}
async function startHost(fixedCode) {
  // ask for the tab first: the browser only allows it right after a click
  panel(`<h2>HOST <span>ONLINE</span></h2><p>Your browser will ask what to share — choose <b>this tab</b> (Domain Break) and allow audio.</p><div class="st">Waiting for screen share…</div>`);
  const cap = await captureTab();
  if (cap.refused) {
    panel(`<h2>HOST <span>ONLINE</span></h2><p>Screen share was cancelled. Your friend can only see the game if you share this tab.</p>
      <div class="row"><button id="on-retry">TRY AGAIN</button><button id="on-canvas">SHARE GAME ONLY</button><button id="on-back">BACK</button></div><div class="st bad"></div>`);
    $('#on-retry').onclick = () => startHost(); $('#on-back').onclick = () => openOnline();
    $('#on-canvas').onclick = () => { S.allowCanvas = true; startHost(); };
    return;
  }
  S.stream = cap.stream;
  for (const t of S.stream.getVideoTracks()) { t.contentHint = 'motion'; t.onended = () => { if (S.role === 'host') badge('Screen sharing stopped — your friend sees a frozen picture. STOP and HOST again.'); }; }
  hostRoom(fixedCode, cap.full);
}
async function hostRoom(fixedCode, full) {
  let Peer;
  try { Peer = await loadPeer(); } catch (e) { status(e.message, 'bad'); return; }
  S.role = 'host';
  const code = fixedCode || newCode();
  const peer = S.peer = new Peer(PREFIX + code, { debug: 1 });
  const link = isLocalUrl() ? '' : `${location.origin}${location.pathname}?join=${code}`;
  panel(`<h2>ROOM <span>CODE</span></h2>
    <div class="code">${code}</div>
    <p>Send this code to your friend. They open Domain Break → ONLINE → JOIN and type it.${link ? '<br>Or send them the invite link.' : ''}
    ${full ? '' : '<br><b>Note:</b> only the 3D view is shared (no HP bars / menus) because tab sharing was not available.'}</p>
    <div class="row"><button id="on-copy">COPY CODE</button>${link ? '<button id="on-link">COPY INVITE LINK</button>' : ''}<button id="on-stop">STOP HOSTING</button></div>
    <div class="st">Connecting to the online lobby…</div>`);
  $('#on-copy').onclick = () => { navigator.clipboard?.writeText(code); status('Code copied!', 'ok'); };
  if (link) $('#on-link').onclick = () => { navigator.clipboard?.writeText(link); status('Invite link copied!', 'ok'); };
  $('#on-stop').onclick = () => leave();
  peer.on('open', () => status('Waiting for your friend to join…'));
  peer.on('error', e => {
    if (e.type === 'unavailable-id') { try { peer.destroy(); } catch (x) {} hostRoom(null, full); return; }  // code taken: pick another
    status('Online error: ' + (e.type || e.message), 'bad');
  });
  peer.on('disconnected', () => { if (S.role === 'host' && !S.conn) status('Lost the lobby connection, reconnecting…'); try { peer.reconnect(); } catch (e) {} });
  peer.on('connection', conn => {
    if (S.conn) { conn.on('open', () => { conn.send({ t: 'busy' }); setTimeout(() => conn.close(), 400); }); return; }
    S.conn = conn;
    conn.on('open', () => {
      S.call = peer.call(conn.peer, S.stream);
      tuneVideo(S.call);
      closePanel();
      badge('ONLINE · friend connected (Player 2)');
      S.hooks.onHostConnected?.();
    });
    conn.on('data', d => {
      if (!d) return;
      if (d.t === 'k') { d.d ? S.held.add(d.c) : S.held.delete(d.c); S.hooks.onGuestKey?.(d.c, !!d.d); }
      else if (d.t === 'ping') conn.send({ t: 'pong', s: d.s });
      else if (d.t === 'rtt') { S.rtt = d.v; badge(`ONLINE · friend connected (Player 2) · ${d.v} ms`); }
    });
    conn.on('close', () => hostLostGuest());
    conn.on('error', () => hostLostGuest());
  });
}
function hostLostGuest() {
  if (S.role !== 'host' || !S.conn) return;
  for (const c of S.held) S.hooks.onGuestKey?.(c, false);
  S.held.clear(); S.conn = null; try { S.call?.close(); } catch (e) {} S.call = null;
  badge('ONLINE · friend left — waiting for them to rejoin (same code)');
  S.hooks.onHostLost?.();
}
// a fighting game wants frames, not sharpness: keep 60 fps, allow a generous bitrate
function tuneVideo(call, tries = 0) {
  const pc = call?.peerConnection; if (!pc) return;
  const snd = pc.getSenders().find(s => s.track?.kind === 'video');
  if (!snd || !snd.getParameters().encodings?.length) { if (tries < 20) setTimeout(() => tuneVideo(call, tries + 1), 500); return; }
  const p = snd.getParameters();
  p.encodings[0].maxBitrate = 6_000_000; p.encodings[0].maxFramerate = 60;
  p.degradationPreference = 'maintain-framerate';
  snd.setParameters(p).catch(e => console.warn('video tuning', e));
}

// ------------------------------------------------------------------ GUEST
async function startGuest(raw) {
  const code = cleanCode(raw); S.lastCode = code;
  if (!/^[A-Z]{4}-[0-9]{4}$/.test(code)) { status('A code looks like ABCD-1234.', 'bad'); return; }
  status('Connecting…');
  let Peer;
  try { Peer = await loadPeer(); } catch (e) { status(e.message, 'bad'); return; }
  leave(true);
  S.role = 'guest';
  const peer = S.peer = new Peer({ debug: 1 });
  buildUI();
  const fail = msg => { if (S.role !== 'guest') return; joinPanel(code); status(msg, 'bad'); leave(true); };
  const timer = setTimeout(() => { if (!ui.video.srcObject) fail('No answer from that room. Check the code, and that your friend is still hosting.'); }, 20000);
  peer.on('error', e => fail(e.type === 'peer-unavailable' ? 'Room not found — check the code.' : 'Online error: ' + (e.type || e.message)));
  peer.on('call', call => {
    S.call = call; call.answer();
    call.on('stream', s => {
      clearTimeout(timer);
      const v = ui.video; v.srcObject = s; v.muted = false;
      ui.gv.classList.add('on'); closePanel();
      v.play().catch(() => { v.muted = true; v.play(); ui.tap.style.display = 'flex'; });
      ui.tap.onclick = () => { v.muted = false; v.play(); ui.tap.style.display = 'none'; };
      badge('ONLINE · you are Player 2 · A/D move · W jump · S block · J/K attack · L/U/O specials · I domain');
      S.hooks.onGuestStart?.();
    });
    call.on('close', () => guestLost());
  });
  peer.on('open', () => {
    const conn = S.conn = peer.connect(PREFIX + code, { reliable: true });
    conn.on('open', () => status('Connected — waiting for the video…', 'ok'));
    conn.on('data', d => {
      if (d?.t === 'pong') { S.rtt = Math.round(performance.now() - d.s); conn.send({ t: 'rtt', v: S.rtt }); updateGuestBadge(); }
      else if (d?.t === 'busy') fail('That room already has a Player 2.');
    });
    conn.on('close', () => guestLost());
    S.pingT = setInterval(() => { if (S.conn?.open) S.conn.send({ t: 'ping', s: performance.now() }); }, 1000);
  });
}
function updateGuestBadge() { if (S.role === 'guest' && ui.gv.classList.contains('on')) badge(`ONLINE · Player 2 · ping ${S.rtt} ms · A/D move · W jump · S block · J/K attack · L/U/O specials · I domain`); }
function guestLost() {
  if (S.role !== 'guest') return;
  leave(true);
  panel(`<h2>DISCONNECTED</h2><p>The connection to your friend's game was lost.</p><div class="row"><button id="on-again">JOIN AGAIN</button><button id="on-x">CLOSE</button></div><div class="st"></div>`);
  $('#on-again').onclick = () => joinPanel(S.lastCode || '');
  $('#on-x').onclick = () => closePanel();
}
function send(c, d) { if (S.role === 'guest' && S.conn?.open) S.conn.send({ t: 'k', c, d: d ? 1 : 0 }); }
export function guestKey(code, down) { send(code, down); }

// guest: every key goes to the host (not to the local game); also a gamepad, mapped to the same keys
addEventListener('keydown', e => {
  if (!isGuest() || !ui?.gv.classList.contains('on')) return;
  if (e.target?.tagName === 'INPUT') return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (!e.repeat) send(e.code, true);
}, true);
addEventListener('keyup', e => {
  if (!isGuest() || !ui?.gv.classList.contains('on')) return;
  e.preventDefault(); e.stopImmediatePropagation(); send(e.code, false);
}, true);
addEventListener('blur', () => { if (isGuest()) for (const c of ['KeyA', 'KeyD', 'KeyS', 'KeyW', 'ShiftLeft']) send(c, false); });
const PAD = { left: 'KeyA', right: 'KeyD', down: 'KeyS', jump: 'KeyW', light: 'KeyJ', heavy: 'KeyK', s1: 'KeyL', s2: 'KeyU', s3: 'KeyO', ult: 'KeyI', dash: 'ShiftLeft', start: 'Enter' };
const padPrev = {};
function pollPad() {
  requestAnimationFrame(pollPad);
  if (!isGuest()) return;
  const gp = [...(navigator.getGamepads?.() || [])].find(Boolean); if (!gp) return;
  const b = i => !!gp.buttons[i]?.pressed, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  const now = { left: ax < -0.4 || b(14), right: ax > 0.4 || b(15), down: ay > 0.6 || b(13), jump: b(0) || ay < -0.7 || b(12), light: b(2), heavy: b(3), s1: b(1), s2: b(5), s3: b(7), ult: b(6), dash: b(4), start: b(9) };
  for (const k in now) if (now[k] !== !!padPrev[k]) { padPrev[k] = now[k]; send(PAD[k], now[k]); }
}
requestAnimationFrame(pollPad);

// ------------------------------------------------------------------ shared
export function leave(silent) {
  const was = S.role;
  clearInterval(S.pingT);
  if (was === 'host') { for (const c of S.held) S.hooks.onGuestKey?.(c, false); S.held.clear(); }
  try { S.call?.close(); } catch (e) {}
  try { S.conn?.close(); } catch (e) {}
  try { S.peer?.destroy(); } catch (e) {}
  if (!silent || was === 'host') { S.stream?.getTracks().forEach(t => t.stop()); S.stream = null; }
  S.peer = S.conn = S.call = null; S.role = null;
  if (ui) { ui.gv.classList.remove('on'); ui.video.srcObject = null; ui.tap.style.display = 'none'; }
  badge('');
  if (!silent) { closePanel(); if (was === 'host') S.hooks.onHostEnd?.(); }
}

// hooks: { onHostConnected, onHostLost, onHostEnd, onGuestKey(code, down), onGuestStart }
export function initOnline(hooks) {
  S.hooks = hooks || {};
  const q = new URLSearchParams(location.search);
  if (q.get('join')) { S.lastCode = cleanCode(q.get('join')); joinPanel(S.lastCode); if (q.get('autojoin')) startGuest(S.lastCode); }
  else if (q.get('host') && q.get('onlinetest')) startHost(cleanCode(q.get('host')));
}
