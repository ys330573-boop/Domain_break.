// Cel-shaded character materials (hard 3-tone shading + rim light + hit flash)
// and inverted-hull outlines. Environment uses flat unlit materials instead,
// so characters "pop" like anime key art.
import * as THREE from 'three';

let gradientMap = null;
function getGradient() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([120, 120, 120, 255, 205, 205, 205, 255, 255, 255, 255, 255]);
  gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

// Shared uniforms per fighter so we can flash / tint the whole body at once.
export function makeFighterUniforms(rimColor = '#ffffff') {
  return {
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color('#ffffff') },
    uRim: { value: new THREE.Color(rimColor) },
    uRimStrength: { value: 0.4 },
    uSilhouette: { value: 0 },
    uSilColor: { value: new THREE.Color('#000000') },
    uOutlineColor: { value: new THREE.Color('#0b0710') },
    uOutlineWidth: { value: 0.011 },
  };
}

// opts.face: faces get almost no shadow band and no rim (cel shadows on a face read as stubble / a moustache)
export function makeToonMaterial(src, U, opts = {}) {
  const map = src?.map || null;
  if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
  const m = new THREE.MeshToonMaterial({
    color: src?.color ? src.color.clone() : new THREE.Color(1, 1, 1),
    map,
    gradientMap: getGradient(),
    side: src?.side ?? THREE.FrontSide,
    transparent: false,
    alphaTest: src?.transparent || src?.alphaTest ? 0.5 : 0,
  });
  // unlit source textures are already "painted"; brighten a bit so shadows read
  m.color.multiplyScalar(1.12);
  if (opts.face) { m.emissive = new THREE.Color(1, 1, 1).multiplyScalar(0.55); m.emissiveMap = map; m.color.multiplyScalar(0.62); }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    if (opts.face) sh.uniforms.uRimStrength = { value: 0 };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uFlash; uniform vec3 uFlashColor; uniform vec3 uRim; uniform float uRimStrength;
        uniform float uSilhouette; uniform vec3 uSilColor;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        vec3 vd = normalize(vViewPosition);
        float rim = 1.0 - abs(dot(normalize(normal), -vd));
        rim = smoothstep(0.72, 0.76, rim) * smoothstep(-0.2, 0.4, normal.x * 0.7 + normal.y * 0.7);
        gl_FragColor.rgb += uRim * rim * uRimStrength;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFlashColor, uFlash);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uSilColor, uSilhouette);`);
  };
  m.customProgramCacheKey = () => 'fighterToon';
  return m;
}

export function makeOutlineMaterial(U, scale = 1) {
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOutlineWidth = U.uOutlineWidth;
    sh.uniforms.uOutlineScale = { value: scale };
    sh.uniforms.uOutlineColor = U.uOutlineColor;
    sh.uniforms.uFlash = U.uFlash;
    sh.uniforms.uFlashColor = U.uFlashColor;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uOutlineWidth; uniform float uOutlineScale;')
      .replace('#include <begin_vertex>', `
        float camDist = -(modelViewMatrix * vec4(position, 1.0)).z;
        vec3 transformed = vec3(position) + normalize(normal) * uOutlineWidth * uOutlineScale * clamp(camDist / 7.0, 0.12, 1.6);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uOutlineColor; uniform float uFlash; uniform vec3 uFlashColor;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.rgb = mix(uOutlineColor, uFlashColor*0.35, uFlash*0.6);');
  };
  m.customProgramCacheKey = () => 'fighterOutline';
  return m;
}
