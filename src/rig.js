// Loads a GLB, bakes it into a clean, normalized, Y-up / +Z-facing model,
// then auto-rigs it with a standard humanoid skeleton (works for static meshes
// AND already-skinned meshes — skinned ones are baked to their rest pose first).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const CHAR_HEIGHT = 1.8;
const loader = new GLTFLoader();
const cache = new Map();

export function loadGLB(url, onProgress) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url, onProgress));
  return cache.get(url);
}

const BONES = [
  // name, parent
  ['hips', null], ['spine', 'hips'], ['chest', 'spine'], ['neck', 'chest'], ['head', 'neck'],
  ['upperArm_L', 'chest'], ['foreArm_L', 'upperArm_L'], ['hand_L', 'foreArm_L'],
  ['upperArm_R', 'chest'], ['foreArm_R', 'upperArm_R'], ['hand_R', 'foreArm_R'],
  ['thigh_L', 'hips'], ['shin_L', 'thigh_L'], ['foot_L', 'shin_L'],
  ['thigh_R', 'hips'], ['shin_R', 'thigh_R'], ['foot_R', 'shin_R'],
];
export const BONE_NAMES = BONES.map(b => b[0]);

// finger joints of the SOURCE skeleton (mixamo 'RightHandIndex2', or 'index_intermediate.R' style)
// -> our key 'R_index2'. Skinned models keep their own finger weights so hand signs can be posed.
export const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'little'];
const SEG = { proximal: 1, intermediate: 2, distal: 3, '1': 1, '2': 2, '3': 3 };
export function fingerKey(name) {
  const n = (name || '').toLowerCase();
  let m = n.match(/(left|right)hand(thumb|index|middle|ring|pinky)([1-3])(?!\d)/);
  if (m) return `${m[1] === 'left' ? 'L' : 'R'}_${m[2] === 'pinky' ? 'little' : m[2]}${m[3]}`;
  m = n.match(/(thumb|index|middle|ring|little|pinky)_?(proximal|intermediate|distal|[1-3])[._]?(l|r)(?![a-z])/);
  if (m) return `${m[3].toUpperCase()}_${m[1] === 'pinky' ? 'little' : m[1]}${SEG[m[2]]}`;
  return null;
}

function matchName(o, list) {
  return list.includes(o.name) || (o.parent && list.includes(o.parent.name));
}

// ---- 1. bake every mesh to world space (skinned meshes in current pose) ----
function bakeParts(gltfScene, def, fingerJ) {
  gltfScene.updateMatrixWorld(true);
  const parts = [];
  const v = new THREE.Vector3(), t = new THREE.Vector3(), n = new THREE.Vector3();
  gltfScene.traverse(o => {
    if (!o.isMesh) return;
    if (def.include && !matchName(o, def.include)) return;
    if (def.exclude && matchName(o, def.exclude)) return;
    const src = o.geometry;
    const pos = src.attributes.position, nrm = src.attributes.normal, uv = src.attributes.uv;
    const count = pos.count;
    const P = new Float32Array(count * 3), N = new Float32Array(count * 3);
    const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
    if (o.isSkinnedMesh) o.skeleton.update();
    // per-vertex finger weights (up to 2 finger joints) from the source skin
    let fing = null;
    if (o.isSkinnedMesh && src.attributes.skinIndex) {
      const keys = o.skeleton.bones.map(b => fingerKey(b.name));
      if (keys.some(Boolean)) {
        o.skeleton.bones.forEach((b, i) => { if (keys[i] && !fingerJ[keys[i]]) fingerJ[keys[i]] = b.getWorldPosition(new THREE.Vector3()); });
        const SI = src.attributes.skinIndex, SW = src.attributes.skinWeight;
        fing = { k: new Array(count * 2).fill(null), w: new Float32Array(count * 2) };
        const acc = new Map();
        for (let i = 0; i < count; i++) {
          acc.clear();
          for (let j = 0; j < 4; j++) { const k = keys[SI.getComponent(i, j)], w = SW.getComponent(i, j); if (k && w > 0) acc.set(k, (acc.get(k) || 0) + w); }
          if (!acc.size) continue;
          const top = [...acc].sort((a, b) => b[1] - a[1]);
          for (let j = 0; j < 2 && j < top.length; j++) { fing.k[i * 2 + j] = top[j][0]; fing.w[i * 2 + j] = top[j][1]; }
        }
      }
    }
    for (let i = 0; i < count; i++) {
      if (o.isSkinnedMesh) {
        o.getVertexPosition(i, v);
        if (nrm) {
          n.fromBufferAttribute(nrm, i);
          t.fromBufferAttribute(pos, i).addScaledVector(n, 0.01);
          o.applyBoneTransform(i, t);
          n.copy(t).sub(v).normalize().transformDirection(o.matrixWorld);
        }
        v.applyMatrix4(o.matrixWorld);
      } else {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (nrm) n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
      }
      P.set([v.x, v.y, v.z], i * 3);
      if (nrm) N.set([n.x, n.y, n.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    if (nrm) g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    if (uv) g.setAttribute('uv', uv.clone());
    if (src.index) g.setIndex(src.index.clone());
    if (o.matrixWorld.determinant() < 0 && g.index) { // fix winding for mirrored nodes
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i += 3) { const a = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = a; }
    }
    if (!nrm) g.computeVertexNormals();
    parts.push({ name: o.name, geometry: g, material: Array.isArray(o.material) ? o.material[0] : o.material, fing });
  });
  return parts;
}

// ---- 2. normalize: feet on y=0, height = CHAR_HEIGHT, centred, facing +Z ----
function normalizeParts(parts, def, points = []) {
  const box = new THREE.Box3();
  const crop = def.crop || {};
  for (const p of parts) { if (crop[p.name]) continue; p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); }
  const h = box.max.y - box.min.y;
  const s = CHAR_HEIGHT / h * (def.scale || 1);
  const c = box.getCenter(new THREE.Vector3());
  const m = new THREE.Matrix4()
    .makeRotationY(THREE.MathUtils.degToRad(def.rotY || 0))
    .multiply(new THREE.Matrix4().makeScale(s, s, s))
    .multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
  for (const p of parts) p.geometry.applyMatrix4(m);
  for (const v of points) v.applyMatrix4(m);
  // crop parts (keep triangles fully inside a box, in units of CHAR_HEIGHT)
  for (const p of parts) {
    const b = crop[p.name]; if (!b) continue;
    const H = CHAR_HEIGHT, P = p.geometry.attributes.position;
    const inside = i => {
      const x = P.getX(i) / H, y = P.getY(i) / H, z = P.getZ(i) / H;
      return x >= b.min[0] && x <= b.max[0] && y >= b.min[1] && y <= b.max[1] && z >= b.min[2] && z <= b.max[2];
    };
    const idx = p.geometry.index ? p.geometry.index.array : [...Array(P.count).keys()];
    const keep = [];
    for (let i = 0; i < idx.length; i += 3)
      if (inside(idx[i]) && inside(idx[i + 1]) && inside(idx[i + 2])) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    p.geometry.setIndex(keep);
  }
  return parts.filter(p => (p.geometry.index ? p.geometry.index.count : 1) > 0);
}

// ---- 3. find joints from the mesh shape ----
function detectJoints(parts, def) {
  const H = CHAR_HEIGHT, r = Object.assign({
    hipY: 0.5, kneeY: 0.27, ankleY: 0.05, spineY: 0.6, chestY: 0.7, neckY: 0.83, headY: 0.865,
    shoulderY: 0.805, shoulderX: 0.085, legX: null, armTip: null,
  }, def.rig || {});
  const all = [];
  for (const p of parts) {
    const P = p.geometry.attributes.position.array;
    for (let i = 0; i < P.length; i += 3) all.push(P[i], P[i + 1], P[i + 2]);
  }
  const N = all.length / 3;
  // torso z centre
  let zs = [];
  for (let i = 0; i < N; i++) { const x = all[i * 3], y = all[i * 3 + 1]; if (y > 0.6 * H && y < 0.8 * H && Math.abs(x) < 0.08 * H) zs.push(all[i * 3 + 2]); }
  zs.sort((a, b) => a - b);
  const zc = zs.length ? zs[zs.length >> 1] : 0;
  // feet x
  const footX = side => {
    let sum = 0, c = 0;
    for (let i = 0; i < N; i++) { const x = all[i * 3], y = all[i * 3 + 1]; if (y > 0.02 * H && y < 0.09 * H && x * side > 0.01 * H) { sum += x; c++; } }
    return c ? Math.min(Math.max(Math.abs(sum / c), 0.035 * H), 0.12 * H) : 0.06 * H;
  };
  const lx = r.legX != null ? r.legX * H : (footX(1) + footX(-1)) / 2;
  // arm tips
  const armTip = side => {
    if (r.armTip) return new THREE.Vector3(side * r.armTip[0] * H, r.armTip[1] * H, zc + (r.armTip[2] || 0) * H);
    const cand = [];
    for (let i = 0; i < N; i++) {
      const x = all[i * 3] * side, y = all[i * 3 + 1];
      if (y > 0.3 * H && y < 0.9 * H && x > 0.12 * H) cand.push(i);
    }
    if (cand.length < 10) return new THREE.Vector3(side * 0.2 * H, 0.45 * H, zc);
    cand.sort((a, b) => all[b * 3] * side - all[a * 3] * side);
    const k = Math.max(10, Math.floor(cand.length * 0.01));
    const t = new THREE.Vector3();
    for (let j = 0; j < k; j++) t.add(new THREE.Vector3(all[cand[j] * 3], all[cand[j] * 3 + 1], all[cand[j] * 3 + 2]));
    return t.divideScalar(k);
  };
  const J = {};
  J.hips = new THREE.Vector3(0, r.hipY * H, zc);
  J.spine = new THREE.Vector3(0, r.spineY * H, zc);
  J.chest = new THREE.Vector3(0, r.chestY * H, zc);
  J.neck = new THREE.Vector3(0, r.neckY * H, zc);
  J.head = new THREE.Vector3(0, r.headY * H, zc);
  J.headTop = new THREE.Vector3(0, H, zc);
  for (const [s, side] of [['L', 1], ['R', -1]]) {
    const S = new THREE.Vector3(side * r.shoulderX * H, r.shoulderY * H, zc);
    const T = armTip(side);
    J['upperArm_' + s] = S;
    J['foreArm_' + s] = S.clone().lerp(T, 0.42);
    J['hand_' + s] = S.clone().lerp(T, 0.8);
    J['handTip_' + s] = T;
    J['thigh_' + s] = new THREE.Vector3(side * lx * 0.85, (r.hipY - 0.02) * H, zc);
    J['shin_' + s] = new THREE.Vector3(side * lx, r.kneeY * H, zc + 0.01 * H);
    J['foot_' + s] = new THREE.Vector3(side * lx, r.ankleY * H, zc - 0.01 * H);
    J['toe_' + s] = new THREE.Vector3(side * lx, 0.01 * H, zc + 0.08 * H);
  }
  return J;
}

// Average normals of vertices sharing a position: smooth cel shading + gap-free outlines
function smoothNormals(g) {
  const P = g.attributes.position.array, n = P.length / 3, N = g.attributes.normal.array;
  const idx = g.index ? g.index.array : null;
  const key = new Int32Array(n), map = new Map(); let uid = 0;
  for (let i = 0; i < n; i++) {
    const k = Math.round(P[i * 3] * 4000) + '_' + Math.round(P[i * 3 + 1] * 4000) + '_' + Math.round(P[i * 3 + 2] * 4000);
    let id = map.get(k); if (id === undefined) { id = uid++; map.set(k, id); } key[i] = id;
  }
  const acc = new Float32Array(uid * 3);
  const tc = idx ? idx.length : n;
  for (let t = 0; t < tc; t += 3) {
    const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az;
    const vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { const k = key[v] * 3; acc[k] += cx; acc[k + 1] += cy; acc[k + 2] += cz; }
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = key[i] * 3; let x = acc[k], y = acc[k + 1], z = acc[k + 2];
    const l = Math.hypot(x, y, z);
    if (l < 1e-12) { out[i * 3] = N[i * 3]; out[i * 3 + 1] = N[i * 3 + 1]; out[i * 3 + 2] = N[i * 3 + 2]; continue; }
    // keep orientation consistent with the authored normal (double-sided cloth)
    const sgn = (x * N[i * 3] + y * N[i * 3 + 1] + z * N[i * 3 + 2]) < 0 ? -1 : 1;
    out[i * 3] = sgn * x / l; out[i * 3 + 1] = sgn * y / l; out[i * 3 + 2] = sgn * z / l;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

function segDist(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const apx = p[0] - a.x, apy = p[1] - a.y, apz = p[2] - a.z;
  const l2 = abx * abx + aby * aby + abz * abz || 1e-9;
  let t = (apx * abx + apy * aby + apz * abz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ---- 4. skin weights ----
function computeWeights(parts, J, fingers = []) {
  const H = CHAR_HEIGHT;
  const segs = [
    ['hips', J.hips, J.spine], ['spine', J.spine, J.chest], ['chest', J.chest, J.neck],
    ['neck', J.neck, J.head], ['head', J.head, J.headTop],
  ];
  for (const s of ['L', 'R']) {
    segs.push(['upperArm_' + s, J['upperArm_' + s], J['foreArm_' + s]], ['foreArm_' + s, J['foreArm_' + s], J['hand_' + s]],
      ['hand_' + s, J['hand_' + s], J['handTip_' + s]], ['thigh_' + s, J['thigh_' + s], J['shin_' + s]],
      ['shin_' + s, J['shin_' + s], J['foot_' + s]], ['foot_' + s, J['foot_' + s], J['toe_' + s]]);
  }
  const boneIndex = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i]));
  const hipY = J.hips.y, sx = Math.abs(J.upperArm_L.x);
  const sigma = 0.018 * H;
  const allowed = (name, x, y) => {
    const side = name.endsWith('_L') ? 1 : name.endsWith('_R') ? -1 : 0;
    if (!side) return true;
    if (x * side < -0.012 * H) return false;
    if (name.startsWith('thigh') || name.startsWith('shin') || name.startsWith('foot')) return y < hipY + 0.04 * H;
    // arms: must be outside the torso core a bit
    return x * side > sx * 0.55 || y < hipY;
  };
  for (const p of parts) {
    const P = p.geometry.attributes.position.array, n = P.length / 3;
    const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
    const d = new Float32Array(segs.length);
    for (let i = 0; i < n; i++) {
      const v = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
      let dmin = Infinity;
      for (let k = 0; k < segs.length; k++) {
        d[k] = allowed(segs[k][0], v[0], v[1]) ? segDist(v, segs[k][1], segs[k][2]) : Infinity;
        if (d[k] < dmin) dmin = d[k];
      }
      const top = [];
      for (let k = 0; k < segs.length; k++) if (d[k] < Infinity) top.push([Math.exp(-(d[k] - dmin) / sigma), k]);
      top.sort((a, b) => b[0] - a[0]);
      let sum = 0;
      for (let j = 0; j < 4 && j < top.length; j++) sum += top[j][0];
      for (let j = 0; j < 4 && j < top.length; j++) {
        SI[i * 4 + j] = boneIndex[segs[top[j][1]][0]];
        SW[i * 4 + j] = top[j][0] / sum;
      }
    }
    // vertices the source model skinned to its fingers follow our finger bones
    if (p.fing && fingers.length) {
      const fIdx = Object.fromEntries(fingers.map((f, i) => [f.key, BONE_NAMES.length + i]));
      for (let i = 0; i < n; i++) {
        const k1 = p.fing.k[i * 2], k2 = p.fing.k[i * 2 + 1];
        let w1 = k1 && fIdx[k1] != null ? p.fing.w[i * 2] : 0, w2 = k2 && fIdx[k2] != null ? p.fing.w[i * 2 + 1] : 0;
        if (w1 + w2 < 0.3) continue;
        const side = (w1 ? k1 : k2)[0], hand = boneIndex['hand_' + side];
        const sc = Math.min(1, w1 + w2) / (w1 + w2); w1 *= sc; w2 *= sc;
        SI.set([w1 ? fIdx[k1] : hand, w2 ? fIdx[k2] : hand, hand, hand], i * 4);
        SW.set([w1, w2, 1 - w1 - w2, 0], i * 4);
      }
    }
    p.geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
    p.geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  }
}

// Canonical rest directions: arms hang down slightly out, legs straight down.
export function restCorrections(J) {
  const C = {};
  const dir = (a, b) => b.clone().sub(a).normalize();
  for (const [s, side] of [['L', 1], ['R', -1]]) {
    const armRest = dir(J['upperArm_' + s], J['foreArm_' + s]);
    const armCanon = new THREE.Vector3(side * Math.sin(0.2), -Math.cos(0.2), 0);
    C['arm_' + s] = new THREE.Quaternion().setFromUnitVectors(armRest, armCanon);
    const legRest = dir(J['thigh_' + s], J['shin_' + s]);
    C['leg_' + s] = new THREE.Quaternion().setFromUnitVectors(legRest, new THREE.Vector3(0, -1, 0));
  }
  return C;
}

// Finger bones (children of the hands) + the axis each one curls around (towards the palm), in
// character space. FJ: joint positions by key ('R_index1'…). Used by the auto-rig AND real skeletons.
export function fingerLayout(FJ) {
  const out = [];
  for (const side of ['L', 'R']) {
    const P = k => FJ[`${side}_${k}`];
    const a = P('index1') || P('middle1'), b = P('little1') || P('ring1'), m1 = P('middle1') || P('index1'), m2 = P('middle3') || P('middle2') || P('index3') || P('index2');
    if (!a || !b || !m1 || !m2) continue;
    const fdir = m2.clone().sub(m1).normalize();
    const palm = a.clone().sub(b).cross(fdir).normalize().multiplyScalar(side === 'R' ? 1 : -1);
    for (const fn of FINGER_NAMES) for (let s = 1; s <= 3; s++) {
      const key = `${side}_${fn}${s}`, pos = P(fn + s); if (!pos) continue;
      const nxt = P(fn + (s + 1)), prv = P(fn + (s - 1));
      const d = (nxt ? nxt.clone().sub(pos) : prv ? pos.clone().sub(prv) : fdir.clone()).normalize();
      // rotating d about (d x palm) moves it towards the palm; the thumb also folds across it
      const axis = d.clone().cross(palm).normalize();
      if (fn === 'thumb') axis.lerp(fdir, 0.2).normalize();
      // sideways: rotating d about (d x lat) moves it towards the index-finger side (crossed fingers)
      const lat = a.clone().sub(b); lat.addScaledVector(d, -lat.dot(d)).normalize();
      const spread = d.clone().cross(lat).normalize();
      out.push({ key, name: 'f_' + key, side, finger: fn, seg: s, parent: s > 1 && prv ? `f_${side}_${fn}${s - 1}` : 'hand_' + side, pos, axis, spread });
    }
  }
  return out;
}

// ---- public: build a rigged character instance data (shared, cloneable) ----
export async function buildRiggedModel(def, onProgress) {
  const gltf = await loadGLB(def.file, onProgress);
  const FJ = {};
  let parts = bakeParts(gltf.scene, def, FJ);
  parts = normalizeParts(parts, def, Object.values(FJ));
  for (const p of parts) smoothNormals(p.geometry);
  const J = detectJoints(parts, def);
  const fingers = def.noFingers ? [] : fingerLayout(FJ);
  computeWeights(parts, J, fingers);
  for (const p of parts) { p.geometry.computeBoundingSphere(); delete p.fing; }
  return { def, parts, joints: J, corrections: restCorrections(J), fingers };
}

// Create a live instance: group with skinned meshes + skeleton
export function instantiate(rigged, makeMaterial, makeOutline) {
  const group = new THREE.Group();
  const J = rigged.joints;
  const bones = {};
  for (const [name, parent] of BONES) {
    const b = new THREE.Bone(); b.name = name;
    const pj = parent ? J[parent] : new THREE.Vector3();
    b.position.copy(J[name]).sub(pj);
    (parent ? bones[parent] : group).add(b);
    bones[name] = b;
  }
  const fingers = rigged.fingers || [];
  for (const F of fingers) {
    const b = new THREE.Bone(); b.name = F.name;
    const pj = F.parent.startsWith('f_') ? fingers.find(x => x.name === F.parent).pos : J[F.parent];
    b.position.copy(F.pos).sub(pj);
    bones[F.parent].add(b); bones[F.name] = b;
  }
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([...BONE_NAMES, ...fingers.map(F => F.name)].map(n => bones[n]));
  const meshes = [], outlines = [];
  for (const p of rigged.parts) {
    const mat = makeMaterial(p.material);
    const m = new THREE.SkinnedMesh(p.geometry, mat);
    m.frustumCulled = false; m.castShadow = false;
    group.add(m); m.bind(skeleton, new THREE.Matrix4());
    meshes.push(m);
    if (makeOutline && !p.material?.userData?.noOutline) {
      const o = new THREE.SkinnedMesh(p.geometry, makeOutline(p.material));
      o.frustumCulled = false;
      group.add(o); o.bind(skeleton, new THREE.Matrix4());
      outlines.push(o);
    }
  }
  const rest = {};
  for (const n in bones) rest[n] = bones[n].position.clone();
  return { group, bones, skeleton, meshes, outlines, rest, corrections: rigged.corrections, joints: J, fingers };
}
