// Voice-over: plays voices/<id>_<key>.mp3 if you provide one, otherwise speaks the
// line with the browser's text-to-speech (Japanese voice if installed, else English),
// with per-character pitch/rate. Lines live in roster.js -> def.lines.
let enabled = true;
const fileOk = new Map();      // url -> boolean
let voices = [];
function loadVoices() { voices = window.speechSynthesis?.getVoices?.() || []; }
if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

export function setVoiceEnabled(v) { enabled = v; if (!v) stopVoice(); }
export function voiceEnabled() { return enabled; }

// probe for user-provided audio files once at boot
export async function probeVoiceFiles(roster) {
  const jobs = [];
  for (const def of roster) for (const key of Object.keys(def.lines || {})) {
    const url = `voices/${def.id}_${key}.mp3`;
    jobs.push(fetch(url, { method: 'HEAD' }).then(r => fileOk.set(url, r.ok)).catch(() => fileOk.set(url, false)));
  }
  await Promise.all(jobs);
}

let current = null;
export function stopVoice() {
  try { window.speechSynthesis?.cancel(); } catch (e) { /* ignore */ }
  if (current) { current.pause(); current = null; }
}

function pickVoice(lang) {
  const L = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(lang));
  if (!L.length) return null;
  return L.find(v => /male|ichiro|keita|david|guy|mark|ryan/i.test(v.name)) || L[0];
}

// Speak a line. Returns a Promise that resolves when it finishes (or after a timeout).
// line = { en, jp }, profile = { pitch, rate }
export function say(def, key, override) {
  const line = override || def.lines?.[key];
  if (!line) return Promise.resolve(0);
  const estimate = Math.min(6, 0.7 + (line.en || line.jp || '').length * 0.065);
  if (!enabled) return wait(estimate);
  stopVoice();
  const url = `voices/${def.id}_${key}.mp3`;
  if (fileOk.get(url)) {
    return new Promise(res => {
      const a = new Audio(url); current = a; a.volume = 1;
      a.onended = () => res(); a.onerror = () => res();
      a.play().catch(() => res());
      setTimeout(res, 8000);
    });
  }
  if (!window.speechSynthesis) return wait(estimate);
  const jpVoice = line.jp ? pickVoice('ja') : null;
  const u = new SpeechSynthesisUtterance(jpVoice ? line.jp : (line.en || line.jp));
  const v = jpVoice || pickVoice('en');
  if (v) { u.voice = v; u.lang = v.lang; }
  const p = def.voice || {};
  u.pitch = p.pitch ?? 1; u.rate = p.rate ?? 1; u.volume = 1;
  return new Promise(res => {
    let done = false; const fin = () => { if (!done) { done = true; res(); } };
    u.onend = fin; u.onerror = fin;
    speechSynthesis.speak(u);
    setTimeout(fin, (estimate + 2.5) * 1000);
  });
}
function wait(s) { return new Promise(r => setTimeout(r, s * 1000)); }
