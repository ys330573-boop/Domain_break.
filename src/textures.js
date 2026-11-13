// Procedurally painted textures (no image assets needed): VFX sprites + anime backdrops.
import * as THREE from 'three';

const cache = {};
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function getTex(name) {
  if (cache[name]) return cache[name];
  const f = GEN[name];
  return (cache[name] = f());
}

const GEN = {
  glow() {
    const [c, g] = canvas(128, 128);
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.7)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return tex(c);
  },
  dot() {
    const [c, g] = canvas(64, 64);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill(); return tex(c);
  },
  spark() { // anime 4-point star burst
    const [c, g] = canvas(256, 256);
    g.translate(128, 128); g.fillStyle = '#fff';
    const spikes = [[0, 124, 14], [Math.PI / 2, 110, 12], [Math.PI, 124, 14], [Math.PI * 1.5, 110, 12], [Math.PI / 4, 60, 8], [Math.PI * 0.75, 66, 8], [Math.PI * 1.25, 60, 8], [Math.PI * 1.75, 66, 8]];
    for (const [a, len, w] of spikes) {
      g.save(); g.rotate(a); g.beginPath(); g.moveTo(-w, 0); g.lineTo(0, -len); g.lineTo(w, 0); g.closePath(); g.fill(); g.restore();
    }
    g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill(); return tex(c);
  },
  burst() { // jagged impact shape (manga "BAM" balloon)
    const [c, g] = canvas(256, 256);
    const r = rnd(7); g.translate(128, 128); g.fillStyle = '#fff'; g.beginPath();
    const n = 18;
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2, rad = i % 2 ? 50 + r() * 20 : 100 + r() * 26;
      g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    g.fill(); return tex(c);
  },
  ring() {
    const [c, g] = canvas(256, 256);
    g.strokeStyle = '#fff'; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.arc(128, 128, 92, 0, Math.PI * 2); g.stroke(); return tex(c);
  },
  slash() { // crescent slash
    const [c, g] = canvas(512, 256);
    const gr = g.createLinearGradient(0, 0, 512, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.75, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath();
    g.moveTo(10, 200); g.quadraticCurveTo(256, -40, 502, 200); g.quadraticCurveTo(256, 60, 10, 200); g.fill(); return tex(c);
  },
  line() { // tapered straight slash line
    const [c, g] = canvas(512, 32);
    const gr = g.createLinearGradient(0, 0, 512, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 16); g.lineTo(256, 4); g.lineTo(512, 16); g.lineTo(256, 28); g.fill(); return tex(c);
  },
  smoke() { // ink-like puff with hard toon edge
    const [c, g] = canvas(128, 128);
    const r = rnd(3); g.fillStyle = '#fff';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(64 + (r() - 0.5) * 50, 64 + (r() - 0.5) * 50, 18 + r() * 18, 0, Math.PI * 2); g.fill(); }
    return tex(c);
  },
  flame() {
    const [c, g] = canvas(128, 256);
    const gr = g.createLinearGradient(0, 256, 0, 0);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(64, 0);
    g.bezierCurveTo(110, 90, 128, 160, 100, 220); g.quadraticCurveTo(64, 260, 28, 220); g.bezierCurveTo(0, 160, 18, 90, 64, 0); g.fill();
    return tex(c);
  },
  speedlines() { // radial manga speed lines (white on transparent)
    const [c, g] = canvas(1024, 1024);
    const r = rnd(11); g.translate(512, 512);
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2, w = 0.002 + r() * 0.01, r0 = 260 + r() * 200;
      g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
      g.beginPath(); g.moveTo(Math.cos(a - w) * 760, Math.sin(a - w) * 760); g.lineTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a + w) * 760, Math.sin(a + w) * 760); g.fill();
    }
    return tex(c);
  },
  shard() {
    const [c, g] = canvas(64, 64);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 0); g.lineTo(60, 40); g.lineTo(20, 64); g.lineTo(4, 24); g.fill(); return tex(c);
  },
  crack() { // ground crack decal
    const [c, g] = canvas(256, 256);
    const r = rnd(5); g.strokeStyle = '#140b18'; g.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      let x = 128, y = 128, a = (k / 9) * Math.PI * 2 + r() * 0.4; g.lineWidth = 7;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 18; y += Math.sin(a) * 18; g.lineTo(x, y); g.lineWidth = Math.max(1, 7 - s); }
      g.stroke();
    }
    g.fillStyle = '#140b18'; g.beginPath(); g.arc(128, 128, 22, 0, Math.PI * 2); g.fill();
    return tex(c);
  },
};

// ---------------------------------------------------------------- backdrops
export function paintSky(pal) {
  const [c, g] = canvas(2048, 1024);
  const gr = g.createLinearGradient(0, 0, 0, 1024);
  pal.sky.forEach((col, i) => gr.addColorStop(i / (pal.sky.length - 1), col));
  g.fillStyle = gr; g.fillRect(0, 0, 2048, 1024);
  // sun / moon with halftone ring
  g.fillStyle = pal.sun; g.beginPath(); g.arc(1300, 560, 170, 0, Math.PI * 2); g.fill();
  g.fillStyle = pal.sunRing;
  for (let y = 300; y < 820; y += 16) for (let x = 1040; x < 1560; x += 16) {
    const d = Math.hypot(x - 1300, y - 560); if (d > 180 && d < 260) { const rr = (1 - (d - 180) / 80) * 6; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); }
  }
  // flat cel clouds with darker underside
  const r = rnd(pal.seed || 9);
  for (let i = 0; i < 14; i++) {
    const cx = r() * 2048, cy = 120 + r() * 520, w = 180 + r() * 360;
    g.fillStyle = pal.cloudDark;
    for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(cx + (k - 3) * w * 0.15, cy + 8, w * 0.18 + r() * 30, 26 + r() * 22, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = pal.cloud;
    for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(cx + (k - 3) * w * 0.15, cy - 4 - r() * 14, w * 0.16 + r() * 26, 20 + r() * 18, 0, 0, Math.PI * 2); g.fill(); }
  }
  // stars for night
  if (pal.stars) { g.fillStyle = '#fff'; for (let i = 0; i < 300; i++) { g.globalAlpha = r(); g.fillRect(r() * 2048, r() * 600, 2, 2); } g.globalAlpha = 1; }
  return tex(c);
}

export function paintSkyline(pal, layer) {
  const W = 2048, H = 512;
  const [c, g] = canvas(W, H);
  const r = rnd(100 + layer * 17);
  let x = 0;
  const base = layer === 0 ? pal.far : pal.mid;
  while (x < W) {
    const w = 60 + r() * (layer === 0 ? 120 : 180), h = (layer === 0 ? 120 : 160) + r() * (layer === 0 ? 220 : 300);
    g.fillStyle = base; g.fillRect(x, H - h, w, h);
    // roof details
    if (r() > 0.6) { g.fillRect(x + w * 0.3, H - h - 30, 6, 30); }
    if (r() > 0.7) { g.fillRect(x + w * 0.1, H - h - 18, w * 0.4, 18); }
    // edge highlight (cel rim)
    g.fillStyle = pal.rim; g.fillRect(x + w - 5, H - h, 5, h);
    // windows
    if (layer === 1) {
      for (let wy = H - h + 16; wy < H - 10; wy += 22) for (let wx = x + 10; wx < x + w - 14; wx += 18)
        if (r() > 0.45) { g.fillStyle = r() > 0.8 ? pal.win2 : pal.win; g.fillRect(wx, wy, 9, 12); }
      // neon sign
      if (r() > 0.75) {
        g.fillStyle = pal.neon[(r() * pal.neon.length) | 0];
        const sh = 50 + r() * 80; g.fillRect(x + w * 0.5 - 12, H - h + 30, 24, sh);
      }
    } else {
      for (let wy = H - h + 14; wy < H; wy += 26) for (let wx = x + 8; wx < x + w - 8; wx += 22)
        if (r() > 0.7) { g.fillStyle = pal.winFar; g.fillRect(wx, wy, 6, 8); }
    }
    x += w + (r() * 8 | 0);
  }
  const t = tex(c); t.wrapS = THREE.RepeatWrapping; return t;
}

export function paintGround(pal) {
  const [c, g] = canvas(1024, 1024);
  g.fillStyle = pal.ground; g.fillRect(0, 0, 1024, 1024);
  const r = rnd(42);
  // painterly variation strokes
  for (let i = 0; i < 260; i++) {
    g.fillStyle = r() > 0.5 ? pal.ground2 : pal.ground3;
    g.globalAlpha = 0.5; g.fillRect(r() * 1024, r() * 1024, 40 + r() * 140, 3 + r() * 6);
  }
  g.globalAlpha = 1;
  // crosswalk stripes (centre band)
  g.fillStyle = pal.stripe;
  for (let i = 0; i < 8; i++) g.fillRect(40 + i * 125, 380, 70, 260);
  // lane line
  g.fillRect(0, 160, 1024, 10); g.fillRect(0, 860, 1024, 10);
  // grid cracks
  g.strokeStyle = pal.ground3; g.lineWidth = 3;
  for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(r() * 1024, r() * 1024); g.lineTo(r() * 1024, r() * 1024); g.stroke(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function paintProps(pal) { // near-ground silhouettes: poles, lamps, signs, rails
  const [c, g] = canvas(2048, 512);
  const r = rnd(77);
  for (let i = 0; i < 9; i++) {
    const x = 80 + i * 230 + r() * 60;
    g.fillStyle = pal.prop;
    if (i % 3 === 0) { // utility pole with wires
      g.fillRect(x, 20, 16, 492); g.fillRect(x - 40, 60, 96, 10); g.fillRect(x - 30, 90, 76, 8);
    } else if (i % 3 === 1) { // street lamp
      g.fillRect(x, 120, 10, 392); g.fillRect(x, 120, 60, 10);
      g.fillStyle = pal.lamp; g.beginPath(); g.ellipse(x + 60, 136, 20, 10, 0, 0, Math.PI * 2); g.fill();
    } else { // vending machine
      g.fillRect(x, 330, 90, 182); g.fillStyle = pal.neon[i % pal.neon.length]; g.fillRect(x + 10, 345, 70, 60);
      g.fillStyle = pal.rim; g.fillRect(x + 85, 330, 5, 182);
    }
  }
  // wires
  g.strokeStyle = pal.prop; g.lineWidth = 3;
  for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(0, 70 + k * 25); for (let x = 0; x <= 2048; x += 64) g.lineTo(x, 70 + k * 25 + Math.sin(x / 690 * Math.PI) * 40); g.stroke(); }
  // guard rail
  g.fillStyle = pal.prop; g.fillRect(0, 440, 2048, 10); for (let x = 0; x < 2048; x += 120) g.fillRect(x, 440, 8, 72);
  const t = tex(c); t.wrapS = THREE.RepeatWrapping; return t;
}

// portrait backdrop used by UI cards
export function paintCardBg(color) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < 256; y += 10) for (let x = (y / 10 % 2) * 5; x < 256; x += 10) { g.beginPath(); g.arc(x, y, (y / 256) * 4, 0, 7); g.fill(); }
  return c.toDataURL();
}
