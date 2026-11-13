// Hand-held weapons for rigged characters.
//  - a weapon mesh that already ships inside the GLB (often skinned to some random bone and shrunk)
//    is cut out, re-sized and parented to a hand bone;
//  - or a small built-in prop (e.g. a pistol) is created.
// Roster usage (inside `skeleton`):
//   weapons: {
//     blade: { mesh: 'wuqi2', hand: 'R', scale: 6, grip: 0.12 },   // mesh-name substring, grip = fraction from the pommel
//     gun:   { prop: 'pistol', hand: 'R', scale: 1 },
//   }
//   clips: { slash: { ..., weapon: 'blade' } }   // weapon shown only while that clip plays
import * as THREE from 'three';
import { makeToonMaterial, makeOutlineMaterial } from './toon.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// world-space grip frame of a hand: Y = out of the thumb side of the fist (blade direction),
// X = where the knuckles point (cutting edge / gun barrel), origin = centre of the palm
function handFrame(hand, forearm) {
  const p = hand.getWorldPosition(V());
  const find = k => hand.children.find(c => c.isBone && c.name.toLowerCase().includes(k));
  const mid = find('middle'), idx = find('index'), pin = find('pinky') || find('ring');
  let fingers = mid ? mid.getWorldPosition(V()).sub(p) : p.clone().sub(forearm.getWorldPosition(V())).multiplyScalar(0.35);
  const len = fingers.length(); fingers.normalize();
  let across = idx && pin ? idx.getWorldPosition(V()).sub(pin.getWorldPosition(V())) : V(0, 0, 1);
  across.addScaledVector(fingers, -across.dot(fingers)).normalize();
  const z = V().crossVectors(fingers, across).normalize();
  const m = new THREE.Matrix4().makeBasis(fingers, across, z);
  return { pos: p.clone().addScaledVector(fingers, len * 0.55), quat: new THREE.Quaternion().setFromRotationMatrix(m) };
}

// built-in props, in character units (fighter height 1.8), grip at the origin, barrel along +X, top along +Y
const BUILT = {
  pistol() {
    const g = new THREE.Group();
    const dark = new THREE.MeshToonMaterial({ color: '#2a2b31' }), steel = new THREE.MeshToonMaterial({ color: '#8d93a0' });
    const box = (w, h, d, mat, x, y, z, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.z = rz; g.add(m); return m; };
    box(0.05, 0.13, 0.034, dark, -0.012, -0.01, 0, 0.22);   // grip
    box(0.2, 0.05, 0.036, steel, 0.06, 0.075, 0);         // slide
    box(0.17, 0.03, 0.03, dark, 0.05, 0.04, 0);           // frame
    box(0.03, 0.022, 0.02, dark, 0.165, 0.075, 0);        // muzzle
    box(0.05, 0.012, 0.02, dark, 0.035, 0.0, 0);          // trigger guard
    g.userData.tip = V(0.19, 0.075, 0);
    g.userData.toon = true;
    return g;
  },
};

export function attachWeapons(scene, map, specs, U, opts = {}) {
  const out = {};
  if (!specs) return out;
  scene.updateMatrixWorld(true);
  const meshes = []; scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const [name, spec] of Object.entries(specs)) {
    const sd = spec.hand || 'R';
    const hand = scene.getObjectByName(map['hand_' + sd]), forearm = scene.getObjectByName(map['foreArm_' + sd]);
    if (!hand) continue;
    const F = handFrame(hand, forearm);
    let obj, worldScale, tip;
    if (spec.mesh) {
      const src = meshes.find(m => m.name.includes(spec.mesh));
      if (!src) { console.warn('weapon mesh not found', spec.mesh); continue; }
      src.visible = false; src.userData.isWeaponSource = true;
      // bake the bind-space geometry, put the grip at the origin (blade along +Y, thin side along Z)
      const geo = src.geometry.clone();
      for (const k of ['skinIndex', 'skinWeight']) geo.deleteAttribute(k);
      geo.computeBoundingBox();
      const b = geo.boundingBox.clone(), size = b.getSize(V());
      const grip = V((b.min.x + b.max.x) / 2, b.min.y + size.y * (spec.grip ?? 0.15), (b.min.z + b.max.z) / 2);
      geo.translate(-grip.x, -grip.y, -grip.z);
      if (spec.flip) geo.rotateY(Math.PI);
      worldScale = src.matrixWorld.getMaxScaleOnAxis() * (spec.scale ?? 1);
      obj = new THREE.Mesh(geo, opts.material || makeToonMaterial(src.material, U));
      if (!opts.material && !opts.noOutline) obj.add(new THREE.Mesh(geo, makeOutlineMaterial(U, 0.6 / worldScale)));
      tip = V(0, b.max.y - grip.y, 0);
    } else {
      obj = BUILT[spec.prop]();
      tip = obj.userData.tip;
      worldScale = spec.scale ?? 1;
      if (opts.material) obj.traverse(o => { if (o.isMesh) o.material = opts.material; });
      else { const parts = []; obj.traverse(o => { if (o.isMesh) parts.push(o); });
        for (const o of parts) { o.material = makeToonMaterial({ color: o.material.color }, U); if (!opts.noOutline) o.add(new THREE.Mesh(o.geometry, makeOutlineMaterial(U, 0.6 / worldScale))); } }
    }
    obj.traverse(o => { o.frustumCulled = false; });
    // world placement in the rest pose -> local to the hand bone
    const roll = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(spec.rot || [0, 0, 0]).map(THREE.MathUtils.degToRad)));
    const want = new THREE.Matrix4().compose(F.pos, F.quat.clone().multiply(roll), V(worldScale, worldScale, worldScale));
    const holder = new THREE.Group();
    holder.matrix.copy(hand.matrixWorld).invert().multiply(want);
    holder.matrix.decompose(holder.position, holder.quaternion, holder.scale);
    holder.add(obj); hand.add(holder);
    holder.visible = false;
    out[name] = { holder, tip, hand: sd };
  }
  return out;
}

export function weaponTip(w, out = V()) { w.holder.updateWorldMatrix(true, false); return out.copy(w.tip).applyMatrix4(w.holder.matrixWorld); }
