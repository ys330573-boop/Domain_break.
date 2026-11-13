// Synthesised SFX with WebAudio — punches, slashes, booms, whooshes, domain drones.
let ctx = null, master = null, noiseBuf = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.55;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
  master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setVolume(v) { if (master) master.gain.value = v; }

function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function noise(t, dur, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, vol = 0.5, a = 0.005 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain(); env(g, t, a, vol, dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + a + 0.05);
}
function tone(t, dur, { type = 'sine', f0 = 200, f1 = f0, vol = 0.5, a = 0.005 } = {}) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain(); env(g, t, a, vol, dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + a + 0.05);
}

const SFX = {
  whoosh: (t) => noise(t, 0.18, { f0: 600, f1: 2400, q: 0.8, vol: 0.25, a: 0.04 }),
  hitL: (t) => { noise(t, 0.08, { f0: 2500, f1: 600, q: 0.7, vol: 0.6 }); tone(t, 0.1, { f0: 180, f1: 60, vol: 0.6 }); },
  hitH: (t) => { noise(t, 0.2, { f0: 1800, f1: 200, q: 0.6, vol: 0.8 }); tone(t, 0.25, { type: 'triangle', f0: 120, f1: 35, vol: 0.9 }); },
  block: (t) => { tone(t, 0.08, { type: 'square', f0: 900, f1: 500, vol: 0.15 }); noise(t, 0.06, { f0: 4000, q: 3, vol: 0.3 }); },
  slash: (t) => { noise(t, 0.16, { type: 'highpass', f0: 3000, f1: 7000, vol: 0.45, a: 0.01 }); tone(t, 0.12, { type: 'sawtooth', f0: 2400, f1: 900, vol: 0.06 }); },
  boom: (t) => { tone(t, 0.7, { f0: 90, f1: 25, vol: 1 }); noise(t, 0.6, { type: 'lowpass', f0: 1800, f1: 80, q: 0.5, vol: 0.9 }); },
  spark: (t) => { tone(t, 0.5, { type: 'sawtooth', f0: 60, f1: 30, vol: 0.6 }); noise(t, 0.35, { f0: 5000, f1: 300, q: 0.5, vol: 0.9 }); tone(t + 0.02, 0.3, { type: 'square', f0: 1500, f1: 3000, vol: 0.08 }); },
  charge: (t) => { tone(t, 0.6, { type: 'sawtooth', f0: 150, f1: 900, vol: 0.12, a: 0.2 }); noise(t, 0.6, { f0: 400, f1: 3000, q: 4, vol: 0.2, a: 0.2 }); },
  orb: (t) => { tone(t, 0.5, { type: 'sine', f0: 300, f1: 120, vol: 0.4 }); tone(t, 0.5, { type: 'sine', f0: 305, f1: 118, vol: 0.4 }); },
  fire: (t) => { noise(t, 0.8, { type: 'lowpass', f0: 3000, f1: 300, q: 0.4, vol: 0.7, a: 0.05 }); tone(t, 0.5, { f0: 70, f1: 40, vol: 0.6 }); },
  beam: (t) => { tone(t, 1.0, { type: 'sawtooth', f0: 80, f1: 60, vol: 0.35, a: 0.05 }); noise(t, 1.0, { f0: 800, f1: 200, q: 1, vol: 0.6, a: 0.05 }); tone(t, 1.0, { f0: 400, f1: 1200, vol: 0.15 }); },
  chain: (t) => { for (let i = 0; i < 5; i++) tone(t + i * 0.03, 0.05, { type: 'square', f0: 2000 + Math.random() * 1500, vol: 0.06 }); noise(t, 0.2, { type: 'highpass', f0: 4000, vol: 0.3 }); },
  shot: (t) => { noise(t, 0.09, { type: 'highpass', f0: 1200, f1: 300, q: 0.7, vol: 0.9 }); tone(t, 0.12, { type: 'square', f0: 220, f1: 50, vol: 0.35 }); noise(t + 0.02, 0.25, { type: 'lowpass', f0: 900, f1: 120, vol: 0.3 }); },
  teleport: (t) => { tone(t, 0.15, { type: 'sine', f0: 1800, f1: 200, vol: 0.25 }); noise(t, 0.1, { type: 'highpass', f0: 6000, vol: 0.3 }); },
  land: (t) => { noise(t, 0.1, { type: 'lowpass', f0: 600, f1: 100, vol: 0.4 }); },
  jump: (t) => noise(t, 0.12, { f0: 800, f1: 1600, q: 1, vol: 0.15 }),
  ui: (t) => tone(t, 0.07, { type: 'square', f0: 880, f1: 1320, vol: 0.08 }),
  select: (t) => { tone(t, 0.15, { type: 'square', f0: 660, f1: 990, vol: 0.12 }); tone(t + 0.08, 0.2, { type: 'square', f0: 990, f1: 1480, vol: 0.12 }); },
  ko: (t) => { tone(t, 1.6, { type: 'sawtooth', f0: 220, f1: 40, vol: 0.4 }); noise(t, 1.2, { type: 'lowpass', f0: 2000, f1: 60, vol: 0.7 }); },
  shatter: (t) => { for (let i = 0; i < 14; i++) tone(t + Math.random() * 0.4, 0.2, { type: 'triangle', f0: 2000 + Math.random() * 4000, f1: 1500, vol: 0.06 }); noise(t, 0.6, { type: 'highpass', f0: 3000, f1: 8000, vol: 0.5 }); },
  domain: (t) => { // deep chord swell
    for (const f of [55, 82.4, 110, 164.8, 220]) tone(t, 2.6, { type: 'sawtooth', f0: f, f1: f * 0.98, vol: 0.07, a: 0.8 });
    noise(t, 2.5, { type: 'lowpass', f0: 200, f1: 2000, vol: 0.25, a: 1.2 });
  },
  gong: (t) => { for (const f of [110, 220.5, 331, 447]) tone(t, 2.2, { type: 'sine', f0: f, f1: f * 0.995, vol: 0.18, a: 0.005 }); },
};

export function sfx(name, delay = 0) {
  if (!ctx || !SFX[name]) return;
  try { SFX[name](ctx.currentTime + delay); } catch (e) { /* ignore */ }
}
