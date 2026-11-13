// Flat, hand-painted-looking parallax stage. Unlit materials only, so it reads 2D
// and the cel-shaded fighters pop in front of it.
import * as THREE from 'three';
import { paintSky, paintSkyline, paintGround, paintProps } from './textures.js';

export const PALETTES = {
  dusk: {
    name: 'DUSK CROSSING', seed: 9,
    sky: ['#2b1e5c', '#7a3b8f', '#ff6f6f', '#ffb36b', '#ffe3a1'], sun: '#fff1c9', sunRing: 'rgba(255,240,200,0.65)',
    cloud: '#ffc7a8', cloudDark: '#d9708b', far: '#8a4d8f', mid: '#4b2a5c', rim: '#ff9f8a',
    win: '#ffd27a', win2: '#7af0ff', winFar: '#ffcf9a', neon: ['#ff4f8b', '#4fe3ff', '#ffe14f'],
    ground: '#5b4a6e', ground2: '#6c5a80', ground3: '#463857', stripe: '#e9e2f2', prop: '#2a1838', lamp: '#fff3b0',
    fog: '#d77d8f', light: '#ffd7b0', amb: '#8f7bd6',
  },
  night: {
    name: 'NEON NIGHT', seed: 21, stars: true,
    sky: ['#05040f', '#0d1240', '#1b2a6b', '#4a2f86', '#b04a9a'], sun: '#e8f3ff', sunRing: 'rgba(160,200,255,0.5)',
    cloud: '#3a3f86', cloudDark: '#221f55', far: '#1c1d4a', mid: '#120f2e', rim: '#5d7cff',
    win: '#9ff3ff', win2: '#ff5fb1', winFar: '#7f8cff', neon: ['#ff2f8f', '#2ff3ff', '#b45cff'],
    ground: '#262143', ground2: '#2f2a55', ground3: '#1a1631', stripe: '#c9c6ff', prop: '#07061a', lamp: '#bfefff',
    fog: '#3b2f7a', light: '#bcd2ff', amb: '#6a5cff',
  },
};

export class Stage {
  constructor(scene, paletteKey = 'dusk') {
    this.scene = scene;
    this.group = new THREE.Group();
    this.pal = PALETTES[paletteKey];
    this.build();
    scene.add(this.group);
    this.bounds = [-11, 11];
  }
  build() {
    const pal = this.pal, G = this.group;
    const basic = (map, opts = {}) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: opts.depthWrite ?? true, fog: opts.fog ?? true, ...opts });
    // sky
    // curved sky wrapping 200° behind the arena so cinematic angles never see an edge
    const sky = new THREE.Mesh(new THREE.CylinderGeometry(115, 115, 90, 48, 1, true, Math.PI / 2 - 0.9, Math.PI + 1.8),
      basic(paintSky(pal), { fog: false, transparent: false, side: THREE.BackSide }));
    sky.position.set(0, 24, 0); G.add(sky);
    // far + mid skylines
    const far = new THREE.Mesh(new THREE.PlaneGeometry(240, 16), basic(paintSkyline(pal, 0), { alphaTest: 0.5 }));
    far.material.map.repeat.x = 3.8; far.position.set(0, 7, -70); G.add(far);
    const mid = new THREE.Mesh(new THREE.PlaneGeometry(130, 10), basic(paintSkyline(pal, 1), { alphaTest: 0.5 }));
    mid.material.map.repeat.x = 3.2; mid.position.set(0, 5, -34); G.add(mid);
    const props = new THREE.Mesh(new THREE.PlaneGeometry(64, 6.4), basic(paintProps(pal), { alphaTest: 0.5 }));
    props.material.map.repeat.x = 2.5; props.position.set(0, 3.2, -9); G.add(props);
    // ground
    const gt = paintGround(pal); gt.repeat.set(9, 5);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 80), new THREE.MeshBasicMaterial({ map: gt }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -20); G.add(ground);
    // ground fighter-lane edge line (anime ink)
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(140, 0.08), new THREE.MeshBasicMaterial({ color: '#120a1c' }));
    edge.rotation.x = -Math.PI / 2; edge.position.set(0, 0.005, -2.2); G.add(edge);
    this.scene.fog = new THREE.Fog(pal.fog, 18, 120);
    this.scene.background = new THREE.Color(pal.sky[2]);
    // lights for toon shading
    this.amb = new THREE.HemisphereLight(pal.amb, '#2a1a30', 1.4);
    this.sun = new THREE.DirectionalLight(pal.light, 2.6); this.sun.position.set(-4, 7, 6);
    this.rimL = new THREE.DirectionalLight(pal.neon[1], 0.9); this.rimL.position.set(6, 3, -6);
    G.add(this.amb, this.sun, this.rimL);
    this.layers = { sky, far, mid, props };
  }
  setVisible(v) { this.group.visible = v; }
  update(dt, cam, fx, t) {
    // subtle parallax drift of far layers relative to camera x (planes are huge; texture offsets fake depth)
    const x = cam.position.x;
    this.layers.far.material.map.offset.x = x * 0.0015;
    this.layers.mid.material.map.offset.x = x * 0.004;
    // ambient floating motes
    if (fx && Math.random() < dt * 8) {
      const c = new THREE.Color(this.pal.neon[(Math.random() * 3) | 0]);
      fx.glow.emit({ pos: new THREE.Vector3(x + (Math.random() - 0.5) * 22, Math.random() * 6, -2 - Math.random() * 6), vel: new THREE.Vector3(0.3, 0.25, 0), t: 0, life: 4, s0: 0.12, s1: 0.04, c, r: 0, a: 0.6 });
    }
  }
}
