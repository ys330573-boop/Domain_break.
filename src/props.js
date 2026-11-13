// Small stylised props used by animations (character space: feet at y=0, facing +Z, height 1.8).
import * as THREE from 'three';

function inked(geo, color, rim, rimScale = 1.06) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
  const edge = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: rim, side: THREE.BackSide }));
  edge.scale.setScalar(rimScale);
  g.add(body, edge); return g;
}

export const PROPS = {
  // dark throne on a pile of skulls (for sitting animations)
  throne(def) {
    const T = new THREE.Group();
    const dark = '#0c0508', rim = def?.color || '#ff3048', bone = '#d9cdb8';
    const seat = inked(new THREE.BoxGeometry(0.62, 0.1, 0.5), dark, rim); seat.position.set(0, 0.5, -0.12); T.add(seat);
    const base = inked(new THREE.CylinderGeometry(0.36, 0.5, 0.45, 7), dark, rim); base.position.set(0, 0.225, -0.15); T.add(base);
    const back = inked(new THREE.BoxGeometry(0.62, 1.05, 0.1), dark, rim); back.position.set(0, 1.0, -0.38); T.add(back);
    // horns / spikes on the back rest
    for (const [x, h, r] of [[-0.3, 0.55, 0.25], [0.3, 0.55, -0.25], [-0.12, 0.35, 0.1], [0.12, 0.35, -0.1]]) {
      const s = inked(new THREE.ConeGeometry(0.06, h, 5), dark, rim, 1.12);
      s.position.set(x, 1.52 + h / 2 - 0.05, -0.38); s.rotation.z = r; T.add(s);
    }
    // arm rests
    for (const x of [-0.34, 0.34]) { const a = inked(new THREE.BoxGeometry(0.08, 0.08, 0.46), dark, rim); a.position.set(x, 0.72, -0.12); T.add(a); }
    // skulls around the base
    const skullMat = new THREE.MeshBasicMaterial({ color: bone }), eyeMat = new THREE.MeshBasicMaterial({ color: '#120006' });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 1.6 - Math.PI * 0.3, r = 0.55 + (i % 2) * 0.12;
      const sk = new THREE.Group();
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), skullMat); head.scale.set(1, 0.95, 1.1); sk.add(head);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 0.07), skullMat); jaw.position.set(0, -0.07, 0.035); sk.add(jaw);
      for (const ex of [-0.034, 0.034]) { // deep eye sockets
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), eyeMat); e.scale.set(1, 1.15, 0.45); e.position.set(ex, 0.008, 0.083); sk.add(e);
      }
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.03, 3), eyeMat); nose.rotation.x = Math.PI; nose.position.set(0, -0.03, 0.092); sk.add(nose);
      const skEdge = new THREE.Mesh(head.geometry, new THREE.MeshBasicMaterial({ color: '#120006', side: THREE.BackSide })); skEdge.scale.set(1.08, 1.03, 1.18); sk.add(skEdge);
      sk.position.set(Math.sin(a) * r, 0.08 + (i % 3) * 0.05, -0.15 + Math.cos(a) * r * 0.6);
      sk.rotation.y = a * 0.4; T.add(sk);
    }
    T.traverse(o => { o.frustumCulled = false; });
    return T;
  },
};
