// Screen helpers: fullscreen, landscape lock, UI scale for small screens, touch-device detection.
const Q = new URLSearchParams(location.search);
const root = document.documentElement;

// touch device = coarse pointer or touch points (?touch=1 forces it for testing on a PC, ?touch=0 hides it)
export const isTouch = Q.get('touch') === '1' || (Q.get('touch') !== '0' && (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches));
if (isTouch) document.body.classList.add('touch');

// ---------------------------------------------------------------- UI scale
// The HUD/menus were designed for a ~1400x820 window. On phones/tablets everything is zoomed down
// by CSS `zoom: var(--ui)` (HUD + FX) and `var(--uim)` (menus, a bit bigger so cards stay tappable).
export function updateScale() {
  const w = innerWidth, h = innerHeight;
  const ui = Math.max(0.42, Math.min(1, h / 780, w / 1300));
  const uim = Math.max(0.5, Math.min(1, h / 720, w / 1150));
  root.style.setProperty('--ui', ui.toFixed(3));
  root.style.setProperty('--uim', uim.toFixed(3));
}
updateScale();

// ---------------------------------------------------------------- fullscreen
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
export const canFullscreen = !!(root.requestFullscreen || root.webkitRequestFullscreen);
export async function enterFullscreen() {
  try {
    if (!fsEl()) {
      if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
      else root.webkitRequestFullscreen?.();
    }
  } catch (e) { /* browser refused (no user gesture / iOS iPhone) */ }
  try { await screen.orientation?.lock?.('landscape'); } catch (e) { /* only works in fullscreen on Android */ }
}
export function exitFullscreen() {
  try { if (document.exitFullscreen) document.exitFullscreen(); else document.webkitExitFullscreen?.(); } catch (e) {}
}
export function toggleFullscreen() { fsEl() ? exitFullscreen() : enterFullscreen(); }

function syncFsButton() { document.body.classList.toggle('isfs', !!fsEl()); }
document.addEventListener('fullscreenchange', syncFsButton);
document.addEventListener('webkitfullscreenchange', syncFsButton);

// first real tap on a phone/tablet goes fullscreen + landscape automatically
// (pointerup counts as a user gesture for touch; pointerdown does not)
if (isTouch && canFullscreen) {
  const auto = e => {
    if (e.pointerType === 'mouse') return;
    if (e.target.closest?.('#fsbtn, #online')) return;   // the button handles itself; don't hijack the online dialog
    removeEventListener('pointerup', auto, true);
    enterFullscreen();
  };
  addEventListener('pointerup', auto, true);
}

// ---------------------------------------------------------------- resize (incl. phone rotation)
export function onResize(fn) {
  let t1 = 0, t2 = 0;
  const run = () => { updateScale(); fn(); };
  const later = () => { run(); clearTimeout(t1); clearTimeout(t2); t1 = setTimeout(run, 120); t2 = setTimeout(run, 450); };  // mobile reports the new size late
  addEventListener('resize', later);
  addEventListener('orientationchange', later);
  visualViewport?.addEventListener('resize', later);
  document.addEventListener('fullscreenchange', later);
}

// stop the browser from scrolling / zooming / long-press menus while playing
document.addEventListener('contextmenu', e => { if (isTouch) e.preventDefault(); });
document.addEventListener('gesturestart', e => e.preventDefault());   // iOS pinch
document.addEventListener('dblclick', e => e.preventDefault());
