// ONLINE — play with a friend anywhere over the internet (remote play).
//
//  HOST (you): start the game with HOST-ONLINE.bat. It runs a small server on your PC and opens a free
//    Cloudflare tunnel, which gives a public https link. In the game: PLAY ONLINE → HOST (share this tab)
//    → COPY INVITE LINK → send it to your friend.
//  FRIEND: clicks the link → JOIN. They see your game as live video (with sound) and play Player 2 with
//    their own keyboard / gamepad. They choose their character first, then you choose yours.
//
// Video (WebCodecs), sound (Opus) and key presses all travel through that one https link (WebSocket, relayed
// by online_server.py), so it works on any network — mobile data, any Wi-Fi, other cities — with no router
// setup and no accounts. The game itself only runs on the host, so every move and cinematic is identical.

const $ = s => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const TEST = Q.get('onlinetest');
const W = 1280, H = 720, FPS = 30;

const S = { role: null, ws: null, hooks: {}, held: new Set(), sending: false, forceKey: true, playing: false, rtt: null };
export const isGuest = () => S.role === 'guest';
export const guestPlaying = () => S.role === 'guest' && S.playing;
export const onlineRole = () => S.role;

// self-test trace (?onlinetest=1): status lines are posted to the dev server
const TRACE = [];
function trace(m) { if (!TEST) return; TRACE.push(+(performance.now() / 1000).toFixed(2) + ' ' + m);
  fetch('/save?name=onl_trace_' + (Q.get('join') ? 'guest' : 'host'), { method: 'POST', body: JSON.stringify(TRACE) }).catch(() => {}); }
if (TEST) { addEventListener('error', e => trace('ERROR ' + e.message)); addEventListener('unhandledrejection', e => trace('REJECT ' + (e.reason?.message || e.reason))); }

// ------------------------------------------------------------------ UI
const CSS = `
#online{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;background:rgba(5,2,12,.86);color:#fff;font-family:Bangers,sans-serif}
#online.on{display:flex}
#online .box{background:#0d0818;border:4px solid #fff;box-shadow:10px 10px 0 #4fd6ff;padding:26px 32px;width:min(620px,92vw);text-align:center}
#online h2{margin:0 0 6px;font-size:42px;letter-spacing:2px} #online h2 span{color:#4fd6ff}
#online p{font-family:'Zen Kaku Gothic New',sans-serif;font-size:15px;opacity:.9;margin:8px 0;line-height:1.55}
#online .row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:16px}
#online .link{font-family:monospace;font-size:15px;background:#000;border:2px solid #4fd6ff;color:#4fd6ff;padding:10px;margin:10px 0;word-break:break-all;user-select:all}
#online .st{font-family:'Zen Kaku Gothic New',sans-serif;font-size:15px;min-height:22px;color:#ffd27a;margin-top:12px}
#online .st.ok{color:#7dffb0} #online .st.bad{color:#ff6b7a}
#online .big{font-size:30px;padding:10px 34px}
#guestview{position:fixed;inset:0;z-index:190;background:#000;display:none}
#guestview.on{display:block}
#guestview canvas{width:100%;height:100%;object-fit:contain;display:block}
.netbadge{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:195;font-family:'Zen Kaku Gothic New',sans-serif;font-size:13px;color:#fff;background:rgba(0,0,0,.65);border:2px solid #4fd6ff;padding:3px 10px;display:none;gap:10px;align-items:center;white-space:nowrap}
.netbadge.on{display:flex} .netbadge button{font-size:12px;padding:1px 8px;border-width:2px}
`;
let ui = null;
function buildUI() {
  if (ui) return ui;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const ov = document.createElement('div'); ov.id = 'online'; ov.innerHTML = '<div class="box"></div>'; document.body.appendChild(ov);
  const gv = document.createElement('div'); gv.id = 'guestview'; gv.innerHTML = `<canvas width="${W}" height="${H}"></canvas>`; document.body.appendChild(gv);
  const badge = document.createElement('div'); badge.className = 'netbadge'; badge.innerHTML = '<span class="t"></span><button>LEAVE</button>'; document.body.appendChild(badge);
  badge.querySelector('button').onclick = () => leave();
  ui = { ov, box: ov.querySelector('.box'), gv, canvas: gv.querySelector('canvas'), badge, badgeT: badge.querySelector('.t') };
  ui.ctx = ui.canvas.getContext('2d');
  ov.addEventListener('keydown', e => e.stopPropagation());
  return ui;
}
function panel(html) { buildUI(); ui.box.innerHTML = html; ui.ov.classList.add('on'); }
function closePanel() { ui?.ov.classList.remove('on'); }
function status(text, cls = '') { trace('status: ' + text); const el = ui?.box.querySelector('.st'); if (el) { el.textContent = text; el.className = 'st ' + cls; } }
function badge(text) { if (text) trace('badge: ' + text); buildUI(); ui.badge.classList.toggle('on', !!text); ui.badgeT.textContent = text || ''; }
const wsUrl = role => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=${role}`;

export function openOnline() {
  panel(`<h2>PLAY <span>ONLINE</span></h2>
    <p>Play with a friend anywhere — they only need the invite link. You host: the game runs on your PC and your
    friend plays Player 2 from their own phone network / Wi-Fi.</p>
    <div class="row"><button id="on-host" class="big">HOST</button><button id="on-x">CLOSE</button></div>
    <p style="opacity:.6;font-size:13px">Your friend doesn't press anything here — they just open the link you send.</p>`);
  $('#on-host').onclick = () => startHost();
  $('#on-x').onclick = () => closePanel();
}

// ------------------------------------------------------------------ HOST
async function serverInfo() {
  try { const r = await fetch('/online-info', { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (e) {}
  return null;
}
async function captureTab() {
  try {
    if (!TEST && navigator.mediaDevices?.getDisplayMedia) {
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', systemAudio: 'exclude',
      });
      return { stream: s, full: true };
    }
  } catch (e) { console.warn('tab capture refused', e); if (!S.allowCanvas) return { refused: true }; }
  return { stream: document.getElementById('game').captureStream(30), full: false };  // 3D view only
}
async function startHost() {
  if (!window.MediaStreamTrackProcessor || !window.VideoEncoder) {
    panel(`<h2>HOST <span>ONLINE</span></h2><p>Hosting needs <b>Google Chrome</b> or <b>Microsoft Edge</b> on a PC.</p><div class="row"><button id="on-x">OK</button></div>`);
    $('#on-x').onclick = () => closePanel(); return;
  }
  const info = await serverInfo();
  if (!info) {
    panel(`<h2>HOST <span>ONLINE</span></h2>
      <p>To play online, start the game with <b>HOST-ONLINE.bat</b> (in the game folder) instead of start.bat.
      It makes the invite link for your friend.</p><p>Close this tab and the black window, then double-click <b>HOST-ONLINE.bat</b>.</p>
      <div class="row"><button id="on-x">OK</button></div>`);
    $('#on-x').onclick = () => closePanel(); return;
  }
  panel(`<h2>HOST <span>ONLINE</span></h2><p>Your browser will ask what to share — choose <b>this tab</b> (Domain Break) and switch on <b>“Also share tab audio”</b>.</p><div class="st">Waiting for the share…</div>`);
  const cap = await captureTab();
  if (cap.refused) {
    panel(`<h2>HOST <span>ONLINE</span></h2><p>Sharing was cancelled. Your friend sees the game through this share, so please share <b>this tab</b>.</p>
      <div class="row"><button id="on-retry">TRY AGAIN</button><button id="on-canvas">SHARE 3D VIEW ONLY</button><button id="on-x">CANCEL</button></div>`);
    $('#on-retry').onclick = () => startHost(); $('#on-x').onclick = () => closePanel();
    $('#on-canvas').onclick = () => { S.allowCanvas = true; startHost(); };
    return;
  }
  S.role = 'host'; S.stream = cap.stream; S.full = cap.full;
  for (const t of S.stream.getVideoTracks()) t.onended = () => { if (S.role === 'host') badge('Screen share stopped — your friend sees a frozen picture. Press LEAVE and HOST again.'); };
  startVideo(S.stream.getVideoTracks()[0]);
  if (S.stream.getAudioTracks()[0]) startAudio(S.stream.getAudioTracks()[0]);
  connectHost();
  invitePanel(info);
}
async function invitePanel(info) {
  panel(`<h2>INVITE YOUR <span>FRIEND</span></h2>
    <div class="link" id="on-link">Creating your invite link…</div>
    <div class="row"><button id="on-copy" disabled>COPY INVITE LINK</button><button id="on-stop">STOP</button></div>
    <p>Send the link on WhatsApp etc. When your friend opens it and presses JOIN, they choose their fighter first, then you choose yours.
    Keep this tab in front and the black HOST-ONLINE window open.${S.full ? '' : '<br><b>Note:</b> only the 3D view is shared (no HP bars / menus).'}</p>
    <div class="st">Waiting for your friend…</div>`);
  $('#on-stop').onclick = () => leave();
  for (let i = 0; i < 90 && !info?.url && S.role === 'host'; i++) {
    if (info?.error && i % 5 === 0) status(info.error, 'bad');
    await new Promise(r => setTimeout(r, 1000)); info = await serverInfo();
  }
  if (S.role !== 'host' || !ui.box.querySelector('#on-link')) return;
  if (!info?.url) { status('Could not create the invite link — check your internet, then close the black window and start HOST-ONLINE.bat again.', 'bad'); return; }
  const link = info.url + '/?join=1';
  S.link = link;
  $('#on-link').textContent = link;
  const copy = $('#on-copy'); copy.disabled = false;
  copy.onclick = () => { navigator.clipboard?.writeText(link).then(() => status('Invite link copied! Send it to your friend.', 'ok'), () => status('Select the link above and copy it (Ctrl+C).')); };
  trace('link ' + link);
}
function connectHost() {
  const ws = S.ws = new WebSocket(wsUrl('host'));
  ws.binaryType = 'arraybuffer';
  ws.onmessage = e => {
    if (typeof e.data !== 'string') return;
    const d = JSON.parse(e.data);
    if (d.t === 'guest-joined' || (d.t === 'hello' && d.guest)) guestJoined();
    else if (d.t === 'guest-left') hostLostGuest();
    else if (d.t === 'needkey') S.forceKey = true;
    else if (d.t === 'k') { d.d ? S.held.add(d.c) : S.held.delete(d.c); S.hooks.onGuestKey?.(d.c, !!d.d); }
    else if (d.t === 'ping') sendJSON({ t: 'pong', s: d.s });
    else if (d.t === 'rtt') badge(`ONLINE · friend is Player 2 · ping ${d.v} ms`);
  };
  ws.onclose = () => { if (S.role === 'host' && S.ws === ws) { badge('ONLINE · lost the local server — is the black HOST-ONLINE window still open? Reconnecting…'); setTimeout(() => { if (S.role === 'host' && S.ws === ws) connectHost(); }, 2000); } };
}
function guestJoined() {
  S.sending = true; S.forceKey = true;
  closePanel();
  badge('ONLINE · friend joined (Player 2)');
  sendConfigs();
  S.hooks.onHostConnected?.();
}
function hostLostGuest() {
  S.sending = false;
  for (const c of S.held) S.hooks.onGuestKey?.(c, false);
  S.held.clear();
  badge('ONLINE · your friend left — they can open the same link again');
  S.hooks.onHostLost?.();
}
function sendJSON(o) { if (S.ws?.readyState === 1) S.ws.send(JSON.stringify(o)); }
function sendConfigs() { if (S.vcfg) sendJSON(S.vcfg); if (S.acfg) sendJSON(S.acfg); }
// media packet: [type 1=video 2=audio][flags 1=key][timestamp float64][data]
function sendChunk(type, chunk) {
  if (!S.sending || S.ws?.readyState !== 1) return;
  if (type === 1 && S.ws.bufferedAmount > 1.5e6 && chunk.type !== 'key') { S.forceKey = true; return; }  // upload can't keep up
  const b = new Uint8Array(10 + chunk.byteLength);
  b[0] = type; b[1] = chunk.type === 'key' ? 1 : 0;
  new DataView(b.buffer).setFloat64(2, chunk.timestamp);
  chunk.copyTo(b.subarray(10));
  S.ws.send(b);
}
async function pickCodec() {
  for (const c of [{ codec: 'avc1.42E01F', avc: { format: 'annexb' }, hardwareAcceleration: 'prefer-hardware' }, { codec: 'vp8' }]) {
    const cfg = { ...c, width: W, height: H, bitrate: 2_500_000, framerate: FPS, latencyMode: 'realtime' };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch (e) {}
  }
  return { codec: 'vp8', width: W, height: H, bitrate: 2_500_000, framerate: FPS, latencyMode: 'realtime' };
}
async function startVideo(track) {
  const cfg = await pickCodec();
  S.vcfg = { t: 'vcfg', codec: cfg.codec, w: W, h: H };
  trace('codec ' + cfg.codec);
  const cv = new OffscreenCanvas(W, H), cx = cv.getContext('2d');
  const enc = S.venc = new VideoEncoder({
    output: chunk => { if (chunk.type === 'key') sendConfigs(); sendChunk(1, chunk); },
    error: e => { trace('venc ' + e.message); console.error(e); },
  });
  enc.configure(cfg);
  let last = 0, n = 0;
  // one picture -> letterboxed into 1280x720 -> encoder (drops frames when the encoder is busy)
  const push = (src, sw, sh) => {
    const now = performance.now();
    if (!S.sending || now - last < 1000 / FPS - 3 || enc.encodeQueueSize > 2 || enc.state !== 'configured') return;
    last = now;
    const k = Math.min(W / sw, H / sh), dw = sw * k, dh = sh * k;
    cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H); cx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
    const vf = new VideoFrame(cv, { timestamp: Math.round(now * 1000) });
    const key = S.forceKey || n % (FPS * 3) === 0; S.forceKey = false; n++;
    enc.encode(vf, { keyFrame: key }); vf.close();
  };
  if (TEST) { // headless test browsers don't produce captured frames: the test loop hands over each rendered frame
    const c = document.getElementById('game');
    S.testPush = () => push(c, c.width, c.height); return;
  }
  const reader = S.vreader = new MediaStreamTrackProcessor({ track }).readable.getReader();
  for (;;) {
    let r; try { r = await reader.read(); } catch (e) { break; }
    if (r.done) break;
    const f = r.value;
    push(f, f.displayWidth, f.displayHeight); f.close();
  }
}
async function startAudio(track) {
  const reader = S.areader = new MediaStreamTrackProcessor({ track }).readable.getReader();
  let enc = null;
  for (;;) {
    let r; try { r = await reader.read(); } catch (e) { break; }
    if (r.done) break;
    const d = r.value;
    if (!enc) {
      const cfg = { codec: 'opus', sampleRate: d.sampleRate, numberOfChannels: Math.min(2, d.numberOfChannels), bitrate: 96000 };
      try { if (!(await AudioEncoder.isConfigSupported(cfg)).supported) { d.close(); break; } } catch (e) { d.close(); break; }
      enc = S.aenc = new AudioEncoder({ output: chunk => sendChunk(2, chunk), error: e => trace('aenc ' + e.message) });
      enc.configure(cfg);
      S.acfg = { t: 'acfg', sampleRate: cfg.sampleRate, ch: cfg.numberOfChannels };
      if (S.sending) sendJSON(S.acfg);
    }
    if (S.sending && enc.state === 'configured' && d.numberOfChannels <= 2) enc.encode(d);
    d.close();
  }
}

// ------------------------------------------------------------------ GUEST
function joinPanel() {
  panel(`<h2>DOMAIN <span>BREAK</span></h2>
    <p>Your friend invited you to an online fight!<br>You are <b>Player 2</b>. You choose your fighter first, then your friend chooses theirs.</p>
    <p style="font-size:14px">Keys: <b>A/D</b> move · <b>W</b> jump · <b>S</b> block · <b>J</b> light · <b>K</b> heavy · <b>L U O</b> specials · <b>I</b> domain · <b>Shift</b> dash · gamepad works too.<br>
    Character select: <b>A/D</b> choose · <b>J</b> or <b>Enter</b> confirm.</p>
    <div class="row"><button id="on-join" class="big">JOIN</button></div><div class="st"></div>`);
  $('#on-join').onclick = () => startGuest();
}
function startGuest() {
  if (!window.VideoDecoder) { status('Your browser is too old for this game — please use Chrome or Edge.', 'bad'); return; }
  S.role = 'guest'; buildUI();
  try { S.actx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); S.actx.resume(); } catch (e) {}
  status('Connecting to your friend…');
  const ws = S.ws = new WebSocket(wsUrl('guest'));
  ws.binaryType = 'arraybuffer';
  const timer = setTimeout(() => { if (!S.playing) status('Still waiting… your friend must have the game open, press PLAY ONLINE → HOST and share the tab.', 'bad'); }, 15000);
  ws.onopen = () => { status('Connected — waiting for your friend to start hosting…', 'ok'); S.pingT = setInterval(() => sendJSON({ t: 'ping', s: performance.now() }), 1000); };
  ws.onmessage = e => {
    if (typeof e.data !== 'string') return onMedia(new Uint8Array(e.data));
    const d = JSON.parse(e.data);
    if (d.t === 'busy') { status('Someone else is already playing with your friend.', 'bad'); ws.close(); }
    else if (d.t === 'hello') status(d.host ? 'Connected — starting the video…' : 'Connected — waiting for your friend to press HOST…', 'ok');
    else if (d.t === 'host-ready') status('Your friend is hosting — starting the video…', 'ok');
    else if (d.t === 'host-left') { S.playing = false; ui.gv.classList.remove('on'); joinPanelAgain('Your friend stopped hosting.'); }
    else if (d.t === 'vcfg') setupVideo(d);
    else if (d.t === 'acfg') setupAudio(d);
    else if (d.t === 'pong') { S.rtt = Math.round(performance.now() - d.s); sendJSON({ t: 'rtt', v: S.rtt }); if (S.playing) badge(`ONLINE · you are Player 2 · ping ${S.rtt} ms · A/D move · W jump · S block · J/K attack · L/U/O specials · I domain`); }
  };
  ws.onclose = () => { clearTimeout(timer); clearInterval(S.pingT); if (S.role === 'guest' && S.ws === ws) { S.playing = false; ui.gv.classList.remove('on'); badge(''); joinPanelAgain('The connection was lost.'); } };
}
function joinPanelAgain(msg) { if (S.role !== 'guest') return; S.role = null; joinPanel(); status(msg + ' Press JOIN to try again.', 'bad'); }
function setupVideo(d) {
  if (S.vdec && S.vcodec === d.codec) return;
  try { S.vdec?.close(); } catch (e) {}
  S.vcodec = d.codec; S.gotKey = false;
  S.vdec = new VideoDecoder({
    output: f => {
      ui.ctx.drawImage(f, 0, 0, ui.canvas.width, ui.canvas.height); f.close();
      if (!S.playing) { S.playing = true; closePanel(); ui.gv.classList.add('on'); badge('ONLINE · you are Player 2'); S.hooks.onGuestStart?.(); }
    },
    error: e => { trace('vdec ' + e.message); S.gotKey = false; sendJSON({ t: 'needkey' }); setTimeout(() => { S.vcodec = null; setupVideo(d); }, 50); },
  });
  S.vdec.configure({ codec: d.codec, optimizeForLatency: true, hardwareAcceleration: 'no-preference' });
}
function setupAudio(d) {
  if (S.adec || !window.AudioDecoder || !S.actx) return;
  S.adec = new AudioDecoder({ output: playAudio, error: e => trace('adec ' + e.message) });
  S.adec.configure({ codec: 'opus', sampleRate: d.sampleRate, numberOfChannels: d.ch });
}
function onMedia(b) {
  const type = b[0], key = b[1] & 1, ts = new DataView(b.buffer, b.byteOffset).getFloat64(2), data = b.subarray(10);
  if (type === 1 && S.vdec?.state === 'configured') {
    if (!key && !S.gotKey) return;
    if (!key && S.vdec.decodeQueueSize > 3) { S.gotKey = false; sendJSON({ t: 'needkey' }); return; }   // fell behind: skip to a key frame
    if (key) S.gotKey = true;
    S.vdec.decode(new EncodedVideoChunk({ type: key ? 'key' : 'delta', timestamp: ts, data }));
  } else if (type === 2 && S.adec?.state === 'configured') {
    S.adec.decode(new EncodedAudioChunk({ type: 'key', timestamp: ts, data }));
  }
}
function playAudio(ad) {
  const ctx = S.actx; if (!ctx) { ad.close(); return; }
  const n = ad.numberOfFrames, ch = ad.numberOfChannels, buf = ctx.createBuffer(ch, n, ad.sampleRate);
  for (let c = 0; c < ch; c++) { const a = new Float32Array(n); ad.copyTo(a, { planeIndex: c, format: 'f32-planar' }); buf.copyToChannel(a, c); }
  ad.close();
  const now = ctx.currentTime;
  if (!S.aNext || S.aNext < now + 0.02 || S.aNext > now + 0.35) S.aNext = now + 0.06;   // keep the sound close to the picture
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start(S.aNext);
  S.aNext += buf.duration;
}
function send(c, d) { if (S.role === 'guest' && S.ws?.readyState === 1) S.ws.send(JSON.stringify({ t: 'k', c, d: d ? 1 : 0 })); }
export function guestKey(code, down) { send(code, down); }
export function onlineTestFrame() { S.testPush?.(); }

// guest: every key goes to the host (not to the local page); a gamepad is mapped to the same keys
addEventListener('keydown', e => {
  if (!isGuest() || !S.playing) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (!e.repeat) send(e.code, true);
}, true);
addEventListener('keyup', e => { if (!isGuest() || !S.playing) return; e.preventDefault(); e.stopImmediatePropagation(); send(e.code, false); }, true);
addEventListener('blur', () => { if (isGuest()) for (const c of ['KeyA', 'KeyD', 'KeyS', 'KeyW', 'ShiftLeft', 'ArrowLeft', 'ArrowRight']) send(c, false); });
const PAD = { left: 'KeyA', right: 'KeyD', down: 'KeyS', jump: 'KeyW', light: 'KeyJ', heavy: 'KeyK', s1: 'KeyL', s2: 'KeyU', s3: 'KeyO', ult: 'KeyI', dash: 'ShiftLeft', start: 'Enter' };
const padPrev = {};
function pollPad() {
  requestAnimationFrame(pollPad);
  if (!isGuest() || !S.playing) return;
  const gp = [...(navigator.getGamepads?.() || [])].find(Boolean); if (!gp) return;
  const b = i => !!gp.buttons[i]?.pressed, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  const now = { left: ax < -0.4 || b(14), right: ax > 0.4 || b(15), down: ay > 0.6 || b(13), jump: b(0) || ay < -0.7 || b(12), light: b(2), heavy: b(3), s1: b(1), s2: b(5), s3: b(7), ult: b(6), dash: b(4), start: b(9) };
  for (const k in now) if (now[k] !== !!padPrev[k]) { padPrev[k] = now[k]; send(PAD[k], now[k]); }
}
requestAnimationFrame(pollPad);

// ------------------------------------------------------------------ shared
export function leave() {
  const was = S.role;
  S.role = null; S.sending = false; S.playing = false;
  clearInterval(S.pingT);
  if (was === 'host') { for (const c of S.held) S.hooks.onGuestKey?.(c, false); S.held.clear(); S.hooks.onHostEnd?.(); }
  try { S.ws?.close(); } catch (e) {} S.ws = null;
  try { S.vreader?.cancel(); S.areader?.cancel(); } catch (e) {}
  try { S.venc?.close(); S.aenc?.close(); } catch (e) {}
  try { S.vdec?.close(); S.adec?.close(); } catch (e) {}
  S.venc = S.aenc = S.vdec = S.adec = null; S.vcodec = null;
  S.stream?.getTracks().forEach(t => t.stop()); S.stream = null;
  if (ui) ui.gv.classList.remove('on');
  badge(''); closePanel();
  if (was === 'guest') joinPanel();
}

// hooks: { onHostConnected, onHostLost, onHostEnd, onGuestKey(code, down), onGuestStart }
export function initOnline(hooks) {
  S.hooks = hooks || {};
  if (Q.get('join')) { joinPanel(); if (Q.get('autojoin')) startGuest(); }
  else if (TEST && Q.get('host')) startHost();
}
