import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Painter, SCENES, W, H, MAX_RELIEF, FOCUS, rng } from './scenes.js';
import { CHAPTERS, CAMERA, TEXT_IN, DURATION } from './timeline.js';

// ------------------------------------------------------------------ config
const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
const QUALITY = params.get('q') || 'high';
const START_T = parseFloat(params.get('t') || '0');
const AUTOPLAY = params.has('autoplay') || CAPTURE || params.has('t');

const N = W * H;
const TILE = 0.86;          // tessera width; the remaining 0.14 is grout
const THICK = 0.3;          // tessera thickness
const RELIEF_SCALE = 0.42;  // painted relief -> world units
const VARIANTS = 4;
const MAT_PARAMS = [        // roughness, metalness, glass
  [0.26, 0.0, 0.0],  // glazed ceramic
  [0.82, 0.0, 0.0],  // natural stone
  [0.05, 0.0, 1.0],  // translucent glass
  [0.3, 1.0, 0.0],   // gold / metal smalti
  [0.12, 0.0, 0.35], // vitreous enamel
  [0.6, 0.0, 0.0],   // matte / unglazed ceramic
];

const S = { DROP: 0, FLIP: 1, MIGRATE: 2, WAVE: 3, SCATTER: 4, RISE: 5, LIVE: 6, PULSE: 7, TWINKLE: 8 };
const STYLE_ID = { drop: S.DROP, flip: S.FLIP, migrate: S.MIGRATE, wave: S.WAVE, scatter: S.SCATTER, rise: S.RISE, live: S.LIVE, pulse: S.PULSE };
const LIVE_DUR = { [S.LIVE]: 0.5, [S.FLIP]: 0.95, [S.PULSE]: 0.22, [S.RISE]: 1.1, [S.WAVE]: 0.7 };

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const inOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; };

// sRGB byte -> linear
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }

// ------------------------------------------------------------------ renderer
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
let pixelRatio = QUALITY === 'low' ? 0.75 : Math.min(window.devicePixelRatio || 1, QUALITY === 'ultra' ? 2 : 1.5);
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060508);
scene.fog = new THREE.Fog(0x060508, 320, 900);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;

const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 2000);

// light: warm raking key, cool back rim, dim sky fill
const key = new THREE.DirectionalLight(0xffe0bd, 2.5);
key.castShadow = true;
key.shadow.mapSize.set(QUALITY === 'low' ? 2048 : 4096, QUALITY === 'low' ? 2048 : 4096);
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
key.shadow.radius = 3;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x9fc4ff, 0.3);
scene.add(rim, rim.target);
scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x2a1d14, 0.25));

// ------------------------------------------------------------------ grout bed
function groutTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const c = cv.getContext('2d');
  c.fillStyle = '#3b3631'; c.fillRect(0, 0, 512, 512);
  const r = rng(5);
  for (let k = 0; k < 26000; k++) {
    const v = 40 + r() * 60;
    c.fillStyle = `rgba(${v + 10},${v + 4},${v - 4},${0.25 + r() * 0.35})`;
    c.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  for (let k = 0; k < 40; k++) { // trowel sweeps
    c.strokeStyle = `rgba(20,16,12,${0.06 + r() * 0.08})`; c.lineWidth = 3 + r() * 10;
    c.beginPath(); const y = r() * 512; c.moveTo(0, y); c.bezierCurveTo(170, y + r() * 60 - 30, 340, y + r() * 60 - 30, 512, y + r() * 40 - 20); c.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(60, 60);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
const bedTex = groutTexture();
const bed = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ map: bedTex, roughness: 0.95, metalness: 0, bumpMap: bedTex, bumpScale: 1.5 }));
bed.rotation.x = -Math.PI / 2;
bed.receiveShadow = true;
scene.add(bed);

// ------------------------------------------------------------------ tile geometry
// Hand-cut tesserae: irregular quads with chipped corners and slightly bowed edges.
function tileGeometry(seed) {
  const r = rng(seed * 977 + 13);
  const s = TILE / 2;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const pts = [];
  for (let k = 0; k < 4; k++) {
    const [cx, cy] = corners[k];
    const jx = (r() - 0.5) * 0.07, jy = (r() - 0.5) * 0.07;
    const px = cx * s + jx, py = cy * s + jy;
    if (r() < 0.45) {
      const a = 0.05 + r() * 0.1;
      const prev = corners[(k + 3) % 4], next = corners[(k + 1) % 4];
      pts.push(new THREE.Vector2(px + (prev[0] - cx) * a, py + (prev[1] - cy) * a));
      pts.push(new THREE.Vector2(px + (next[0] - cx) * a * (0.6 + r()), py + (next[1] - cy) * a * (0.6 + r())));
    } else pts.push(new THREE.Vector2(px, py));
    const nx = corners[(k + 1) % 4];
    const mx = ((cx + nx[0]) / 2) * s, my = ((cy + nx[1]) / 2) * s;
    const bow = (r() - 0.5) * 0.045;
    pts.push(new THREE.Vector2(mx + (cy === nx[1] ? 0 : bow * cx), my + (cx === nx[0] ? 0 : bow * cy)));
  }
  const bevel = 0.045;
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth: THICK - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 2, curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(0, -(bb.min.y + bb.max.y) / 2, 0);
  // slight dome / warp on the top face so reflections break up like hand-set tesserae
  const pos = geo.attributes.position;
  const w1 = (r() - 0.5) * 0.05, w2 = (r() - 0.5) * 0.05;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y > 0) pos.setY(i, y + 0.02 * (1 - (x * x + z * z) / (s * s * 2)) + w1 * x + w2 * z);
  }
  geo.computeVertexNormals();
  return geo;
}

// ------------------------------------------------------------------ material
const U = {
  uTime: { value: 0 },
  uRip: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, -100, 0)) },
  uHeart: { value: new THREE.Vector4(0, 0, 1, 0) },
  uGlassGlow: { value: 1.0 },
};

const VERT_PARS = /* glsl */`
uniform float uTime; uniform vec4 uRip[4]; uniform vec4 uHeart;
float fxOffset(vec2 p) {
  float o = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 r = uRip[i];
    float age = uTime - r.z;
    if (age > 0.0 && age < 7.0) {
      float d = distance(p, r.xy);
      float front = age * 26.0;
      float w = exp(-pow((d - front) / 3.0, 2.0));
      o += r.w * w * exp(-age * 0.55) * (1.0 / (1.0 + d * 0.012));
    }
  }
  float dh = distance(p, uHeart.xy);
  o += uHeart.w * smoothstep(uHeart.z, 0.0, dh) * 0.5;
  return o;
}
`;

const FRAG_PARS = /* glsl */`
varying vec4 vMat; varying vec3 vLocal; varying vec3 vLocalN;
uniform float uGlassGlow;
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

function patchTileShader(sh, depthOnly) {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>\n${VERT_PARS}\n${depthOnly ? '' : 'attribute vec4 aMat; varying vec4 vMat; varying vec3 vLocal; varying vec3 vLocalN;'}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        transformed.y += fxOffset(instanceMatrix[3].xz);
      #endif
      ${depthOnly ? '' : 'vMat = aMat; vLocal = position; vLocalN = normal;'}`);
  if (depthOnly) return;
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 tileBase = diffuseColor.rgb;
      float seed = vMat.w;
      vec3 lp = vLocal * 4.0 + seed * 37.0;
      float n1 = fbm(lp);
      float n2 = vnoise(lp * 6.0);
      float stoneF = smoothstep(0.55, 0.8, vMat.x);
      float glassF = vMat.z;
      float metalF = vMat.y;
      float tv = fract(seed * 91.37);
      float side = 1.0 - abs(vLocalN.y);
      diffuseColor.rgb *= 0.86 + 0.28 * tv;
      diffuseColor.rgb *= vec3(1.0 + (fract(seed * 13.1) - 0.5) * 0.09, 1.0 + (fract(seed * 7.7) - 0.5) * 0.06, 1.0 + (fract(seed * 3.3) - 0.5) * 0.09);
      diffuseColor.rgb *= mix(0.93 + 0.14 * n1, 0.68 + 0.64 * n1, stoneF);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.5 + 1.0 * step(0.74, n2)), stoneF * 0.35);
      float edge = max(abs(vLocal.x), abs(vLocal.z)) / 0.43;
      diffuseColor.rgb *= 1.0 - 0.24 * smoothstep(0.75, 1.02, edge) * (1.0 - glassF) * (1.0 - metalF);
      diffuseColor.rgb *= mix(1.0, 0.62, side * (1.0 - glassF));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.3 + 0.25 * n1), glassF);
      diffuseColor.rgb *= mix(1.0, 0.8 + 0.35 * vnoise(lp * 3.0), metalF);
    `)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(vMat.x * (0.7 + 0.6 * n1) + side * 0.12, 0.03, 1.0);`)
    .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      metalnessFactor = vMat.y;`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float bumpAmt = mix(0.05, 0.3, stoneF) + glassF * 0.1 + metalF * 0.14;
      vec3 bn = vec3(vnoise(lp * 2.5 + 3.1) - 0.5, vnoise(lp * 2.5 + 7.7) - 0.5, 0.0);
      normal = normalize(normal + bumpAmt * bn);`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float through = glassF * (0.45 + 0.55 * n1) * (0.75 + 0.25 * vnoise(lp * 8.0));
      totalEmissiveRadiance += tileBase * through * 0.5 * uGlassGlow;`);
}

const tileMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0 });
tileMat.onBeforeCompile = (sh) => patchTileShader(sh, false);
const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
depthMat.onBeforeCompile = (sh) => patchTileShader(sh, true);

// ------------------------------------------------------------------ tiles
const variantOf = new Uint8Array(N);
const localOf = new Uint32Array(N);
const counts = new Array(VARIANTS).fill(0);
const vr = rng(99);
for (let i = 0; i < N; i++) { const v = Math.floor(vr() * VARIANTS); variantOf[i] = v; localOf[i] = counts[v]++; }

const meshes = [];
for (let v = 0; v < VARIANTS; v++) {
  const geo = tileGeometry(v + 1);
  const n = counts[v];
  geo.setAttribute('aMat', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4));
  const mesh = new THREE.InstancedMesh(geo, tileMat, n);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  geo.attributes.aMat.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.customDepthMaterial = depthMat;
  mesh.frustumCulled = false;
  scene.add(mesh);
  meshes.push(mesh);
}
const dirty = new Uint8Array(VARIANTS);

// per-tile constants
const BX = new Float32Array(N), BZ = new Float32Array(N);
const Q0 = new Float32Array(N * 4), SXZ = new Float32Array(N), SY = new Float32Array(N), HJ = new Float32Array(N);
const SEED = new Float32Array(N), AXA = new Float32Array(N), RND = new Float32Array(N);
{
  const r = rng(7);
  for (let row = 0; row < H; row++) for (let col = 0; col < W; col++) {
    const i = row * W + col;
    BX[i] = col - W / 2 + 0.5 + (r() - 0.5) * 0.08;
    BZ[i] = row - H / 2 + 0.5 + (r() - 0.5) * 0.08;
    const yaw = (r() - 0.5) * 0.19, tx = (r() - 0.5) * 0.05, tz = (r() - 0.5) * 0.05;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tx, yaw, tz));
    Q0.set([q.x, q.y, q.z, q.w], i * 4);
    SXZ[i] = 0.93 + r() * 0.1;
    SY[i] = 0.82 + r() * 0.36;
    HJ[i] = (r() - 0.5) * 0.05;
    SEED[i] = r();
    AXA[i] = r() * Math.PI * 2;
    RND[i] = r();
  }
}

// current, target and transition state
const curC = new Float32Array(N * 3), curM = new Float32Array(N * 3), curH = new Float32Array(N);
const present = new Uint8Array(N);
const tgtC = new Float32Array(N * 3), tgtMat = new Uint8Array(N), tgtH = new Float32Array(N);
const frC = new Float32Array(N * 3), frM = new Float32Array(N * 3), frH = new Float32Array(N);
const T0 = new Float32Array(N), DUR = new Float32Array(N), AMP = new Float32Array(N);
const STY = new Int8Array(N).fill(-1);
const SRCX = new Float32Array(N), SRCZ = new Float32Array(N);
const inAct = new Uint8Array(N);
let act = [];

// ------------------------------------------------------------------ writing instances
function writeMatrix(i, px, py, pz, qx, qy, qz, qw, sxz, sy) {
  const v = variantOf[i], o = localOf[i] * 16;
  const te = meshes[v].instanceMatrix.array;
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  te[o] = (1 - (yy + zz)) * sxz; te[o + 1] = (xy + wz) * sxz; te[o + 2] = (xz - wy) * sxz; te[o + 3] = 0;
  te[o + 4] = (xy - wz) * sy; te[o + 5] = (1 - (xx + zz)) * sy; te[o + 6] = (yz + wx) * sy; te[o + 7] = 0;
  te[o + 8] = (xz + wy) * sxz; te[o + 9] = (yz - wx) * sxz; te[o + 10] = (1 - (xx + yy)) * sxz; te[o + 11] = 0;
  te[o + 12] = px; te[o + 13] = py; te[o + 14] = pz; te[o + 15] = 1;
  dirty[v] = 1;
}
function writeLook(i, r, g, b, rough, metal, glass) {
  const v = variantOf[i], l = localOf[i];
  const ca = meshes[v].instanceColor.array; ca[l * 3] = r; ca[l * 3 + 1] = g; ca[l * 3 + 2] = b;
  const ma = meshes[v].geometry.attributes.aMat.array; ma[l * 4] = rough; ma[l * 4 + 1] = metal; ma[l * 4 + 2] = glass; ma[l * 4 + 3] = SEED[i];
  curC[i * 3] = r; curC[i * 3 + 1] = g; curC[i * 3 + 2] = b;
  curM[i * 3] = rough; curM[i * 3 + 1] = metal; curM[i * 3 + 2] = glass;
}
const restY = (i, h) => THICK * 0.5 * SY[i] + h + HJ[i];

// Pose with an extra animated rotation: angle `th` about the tile's horizontal axis, `spin` about Y.
function pose(i, ox, oy, oz, h, th, spin, scale) {
  const b = i * 4;
  let qx = Q0[b], qy = Q0[b + 1], qz = Q0[b + 2], qw = Q0[b + 3];
  if (spin !== 0) {
    const s = Math.sin(spin / 2), c = Math.cos(spin / 2);
    // (0,s,0,c) * q
    const nx = c * qx + s * qz, ny = c * qy + s * qw, nz = c * qz - s * qx, nw = c * qw - s * qy;
    qx = nx; qy = ny; qz = nz; qw = nw;
  }
  if (th !== 0) {
    const a = AXA[i], s = Math.sin(th / 2), c = Math.cos(th / 2);
    const ax = Math.cos(a) * s, az = Math.sin(a) * s;
    // (ax,0,az,c) * q
    const nx = c * qx + ax * qw + (0 * qz - az * qy);
    const ny = c * qy + 0 * qw + (az * qx - ax * qz);
    const nz = c * qz + az * qw + (ax * qy - 0 * qx);
    const nw = c * qw - (ax * qx + 0 * qy + az * qz);
    qx = nx; qy = ny; qz = nz; qw = nw;
  }
  writeMatrix(i, BX[i] + ox, restY(i, h) + oy, BZ[i] + oz, qx, qy, qz, qw, SXZ[i] * scale, SY[i] * scale);
}
function hide(i) { writeMatrix(i, BX[i], -5, BZ[i], 0, 0, 0, 1, 0, 0); }
function rest(i) { present[i] ? pose(i, 0, 0, 0, curH[i], 0, 0, 1) : hide(i); }

function applyTarget(i) {
  const m = MAT_PARAMS[tgtMat[i]];
  writeLook(i, tgtC[i * 3], tgtC[i * 3 + 1], tgtC[i * 3 + 2], m[0], m[1], m[2]);
  curH[i] = tgtH[i];
}

// ------------------------------------------------------------------ painting & decoding
const painter = new Painter();
const NEW_C = new Float32Array(N * 3), NEW_MAT = new Uint8Array(N), NEW_H = new Float32Array(N);

function paint(sceneName, lt) {
  painter.reset();
  SCENES[sceneName].paint(painter, lt);
  const { col, rel, m0, m1 } = painter.read();
  for (let i = 0; i < N; i++) {
    const p = i * 4;
    NEW_C[i * 3] = LIN[col[p]]; NEW_C[i * 3 + 1] = LIN[col[p + 1]]; NEW_C[i * 3 + 2] = LIN[col[p + 2]];
    let best = 0, bv = m0[p];
    if (m0[p + 1] > bv) { bv = m0[p + 1]; best = 1; }
    if (m0[p + 2] > bv) { bv = m0[p + 2]; best = 2; }
    if (m1[p] > bv) { bv = m1[p]; best = 3; }
    if (m1[p + 1] > bv) { bv = m1[p + 1]; best = 4; }
    if (m1[p + 2] > bv) { bv = m1[p + 2]; best = 5; }
    NEW_MAT[i] = best;
    NEW_H[i] = (rel[p] / 255) * MAX_RELIEF * RELIEF_SCALE;
  }
}
function differs(i) {
  const a = i * 3;
  return Math.abs(NEW_C[a] - tgtC[a]) + Math.abs(NEW_C[a + 1] - tgtC[a + 1]) + Math.abs(NEW_C[a + 2] - tgtC[a + 2]) > 0.012
    || NEW_MAT[i] !== tgtMat[i] || Math.abs(NEW_H[i] - tgtH[i]) > 0.035;
}
function acceptNew(i) {
  const a = i * 3;
  tgtC[a] = NEW_C[a]; tgtC[a + 1] = NEW_C[a + 1]; tgtC[a + 2] = NEW_C[a + 2];
  tgtMat[i] = NEW_MAT[i]; tgtH[i] = NEW_H[i];
}

// ------------------------------------------------------------------ transitions
function schedule(i, style, t0, dur, amp, src) {
  const a = i * 3;
  frC[a] = curC[a]; frC[a + 1] = curC[a + 1]; frC[a + 2] = curC[a + 2];
  frM[a] = curM[a]; frM[a + 1] = curM[a + 1]; frM[a + 2] = curM[a + 2];
  frH[i] = curH[i];
  STY[i] = style; T0[i] = t0; DUR[i] = dur; AMP[i] = amp;
  if (src) { SRCX[i] = src[0]; SRCZ[i] = src[1]; }
  if (!inAct[i]) { inAct[i] = 1; act.push(i); }
}

function finish(i) {
  applyTarget(i);
  present[i] = 1;
  STY[i] = -1;
  pose(i, 0, 0, 0, curH[i], 0, 0, 1);
}

function look(i, m) {
  const a = i * 3, tm = MAT_PARAMS[tgtMat[i]];
  if (m <= 0) { writeLook(i, frC[a], frC[a + 1], frC[a + 2], frM[a], frM[a + 1], frM[a + 2]); return; }
  if (m >= 1) { writeLook(i, tgtC[a], tgtC[a + 1], tgtC[a + 2], tm[0], tm[1], tm[2]); return; }
  writeLook(i, lerp(frC[a], tgtC[a], m), lerp(frC[a + 1], tgtC[a + 1], m), lerp(frC[a + 2], tgtC[a + 2], m),
    lerp(frM[a], tm[0], m), lerp(frM[a + 1], tm[1], m), lerp(frM[a + 2], tm[2], m));
}

function animate(i, u) {
  const e = inOut(u);
  const h = lerp(frH[i], tgtH[i], e);
  const amp = AMP[i];
  switch (STY[i]) {
    case S.DROP: {
      present[i] = 1;
      const p = Math.min(u / 0.72, 1);
      let y = amp * (1 - p * p);
      if (u > 0.72) { const b = (u - 0.72) / 0.28; y = 0.16 * Math.sin(Math.PI * b) * (1 - b); }
      const th = (1 - p) ** 1.5 * (2.2 + RND[i] * 2.5);
      look(i, 1);
      pose(i, (1 - p) * (RND[i] - 0.5) * 1.5, y, 0, tgtH[i], th, (1 - p) * (RND[i] - 0.5) * 3, 1);
      break;
    }
    case S.FLIP:
    case S.LIVE: {
      const lift = amp * Math.sin(Math.PI * u);
      look(i, e < 0.5 ? 0 : 1);
      pose(i, 0, lift, 0, h, Math.PI * e, 0, 1);
      break;
    }
    case S.WAVE: {
      const lift = amp * Math.sin(Math.PI * u) ** 1.4;
      look(i, smooth((u - 0.3) / 0.4));
      pose(i, 0, lift, 0, h, 0.55 * Math.sin(2 * Math.PI * u), 0, 1);
      break;
    }
    case S.PULSE: {
      look(i, u);
      pose(i, 0, 0.12 * Math.sin(Math.PI * u), 0, h, 0, 0, 1);
      break;
    }
    case S.TWINKLE: {
      pose(i, 0, amp * Math.sin(Math.PI * u), 0, curH[i], 2 * Math.PI * e, 0, 1);
      break;
    }
    case S.SCATTER: {
      const s = Math.sin(Math.PI * u);
      const a = AXA[i];
      look(i, u < 0.5 ? 0 : 1);
      pose(i, Math.cos(a) * 2.8 * s * amp, 3.4 * s * amp, Math.sin(a) * 2.8 * s * amp, h, 2 * Math.PI * e * (RND[i] < 0.5 ? 1 : 2), (RND[i] - 0.5) * 4 * s, 1);
      break;
    }
    case S.MIGRATE: {
      if (u < 0.28) {
        const a = u / 0.28;
        look(i, 0);
        if (present[i]) pose(i, 0, -0.4 * a, 0, frH[i], 0, 0, 1 - 0.9 * a); else hide(i);
      } else {
        present[i] = 1;
        const b = (u - 0.28) / 0.72, eb = inOut(b);
        const jx = (RND[i] - 0.5) * 6, jz = (SEED[i] - 0.5) * 6;
        const ox = (SRCX[i] + jx - BX[i]) * (1 - eb), oz = (SRCZ[i] + jz - BZ[i]) * (1 - eb);
        look(i, 1);
        pose(i, ox, (3 + amp * 4) * Math.sin(Math.PI * b), oz, tgtH[i], 3.2 * (1 - eb), 2 * (1 - eb), Math.min(1, 0.35 + b * 3));
      }
      break;
    }
    case S.RISE: {
      if (u < 0.35) {
        const a = inOut(u / 0.35);
        look(i, 0);
        if (present[i]) pose(i, 0, -(0.9 + frH[i]) * a, 0, frH[i], 0, 0, 1); else hide(i);
      } else {
        present[i] = 1;
        const b = (u - 0.35) / 0.65, eb = 1 - (1 - b) ** 3;
        look(i, 1);
        pose(i, 0, -(0.9 + tgtH[i]) * (1 - eb) + 0.28 * amp * Math.sin(Math.PI * b), 0, tgtH[i], 0.3 * Math.sin(Math.PI * b), 0, 1);
      }
      break;
    }
  }
}

function updateTiles(t) {
  let w = 0;
  for (let k = 0; k < act.length; k++) {
    const i = act[k];
    if (t < T0[i]) { act[w++] = i; continue; }
    const u = (t - T0[i]) / DUR[i];
    if (u >= 1) { if (STY[i] === S.TWINKLE) pose(i, 0, 0, 0, curH[i], 0, 0, 1); else finish(i); STY[i] = -1; inAct[i] = 0; continue; }
    animate(i, u);
    act[w++] = i;
  }
  act.length = w;
}

// ------------------------------------------------------------------ choreography
const col = (i) => i % W, row = (i) => Math.floor(i / W);
let openingRank = null;
function computeOpeningRank() {
  const [fx, fy] = FOCUS.campusFirstTile;
  const r = rng(3);
  const keys = new Float32Array(N), idx = new Uint32Array(N);
  for (let i = 0; i < N; i++) {
    const dx = col(i) - fx, dy = (row(i) - fy) * 1.35;
    keys[i] = Math.sqrt(dx * dx + dy * dy) * (0.75 + r() * 0.5) + r() * 3;
    idx[i] = i;
  }
  keys[fy * W + fx] = -2; keys[fy * W + fx + 1] = -1;
  idx.sort((a, b) => keys[a] - keys[b]);
  openingRank = new Uint32Array(N);
  for (let k = 0; k < N; k++) openingRank[idx[k]] = k;
}

function delayFor(i, d, r) {
  const c = col(i), rw = row(i);
  switch (d.type) {
    case 'opening': {
      const k = openingRank[i];
      if (k === 0) return 1.0;
      if (k === 1) return 2.5;
      return 3.3 + 0.67 * Math.log(1 + (k - 2) / 2) + r * 0.15;
    }
    case 'radial': return Math.hypot(c - d.at[0], rw - d.at[1]) / d.speed + r * d.jitter;
    case 'sweep': {
      const len = Math.hypot(d.dir[0], d.dir[1]);
      const ux = d.dir[0] / len, uy = d.dir[1] / len;
      const proj = c * ux + rw * uy;
      const min = Math.min(0, W * ux) + Math.min(0, H * uy);
      let del = (proj - min) / d.speed;
      if (d.bands) del += (Math.floor(rw / (H / d.bands)) % 2) * 0.25;
      return del + r * d.jitter;
    }
  }
  return 0;
}

const liveState = { chapter: -1, lastPaint: -1, fired: new Set() };
const E = {
  fxState: {},
  rip: 0,
  ripple(bx, by, amp, t = U.uTime.value) {
    U.uRip.value[this.rip].set(bx - W / 2, by - H / 2, t, amp);
    this.rip = (this.rip + 1) % 4;
  },
  setHeart(bx, by, r, pulse) { U.uHeart.value.set(bx - W / 2, by - H / 2, r, pulse * 0.9); },
};

function startChapter(k, t) {
  const ch = CHAPTERS[k];
  const lt = Math.max(0, t - ch.t);
  paint(ch.scene, lt);
  liveState.chapter = k; liveState.lastPaint = t; liveState.fired = new Set();
  E.fxState = {};
  U.uHeart.value.w = 0;
  const style = STYLE_ID[ch.style];
  const r = rng(1000 + k);
  const src = ch.src ? [ch.src[0] - W / 2, ch.src[1] - H / 2] : null;
  if (ch.delay.type === 'opening' && !openingRank) computeOpeningRank();
  for (let i = 0; i < N; i++) {
    const rr = r();
    const changed = differs(i);
    acceptNew(i);
    if (!changed && !ch.all && present[i]) continue;
    const dur = ch.dur * (0.8 + 0.4 * r());
    let amp;
    switch (style) {
      case S.DROP: amp = (openingRank[i] < 2 ? 3.2 : 3 + r() * 7); break;
      case S.FLIP: amp = 0.5 + r() * 0.9; break;
      case S.WAVE: amp = (ch.amp || 1) * (0.7 + r() * 0.5); break;
      default: amp = 0.6 + r() * 0.8;
    }
    schedule(i, style, ch.t + delayFor(i, ch.delay, rr), openingRank && style === S.DROP && openingRank[i] < 2 ? 2.2 : dur, amp, src);
  }
}

function livePaint(t) {
  const k = liveState.chapter;
  if (k < 0) return;
  const ch = CHAPTERS[k], sc = SCENES[ch.scene];
  if (!sc.live || t - liveState.lastPaint < 1 / sc.live) return;
  liveState.lastPaint = t;
  paint(ch.scene, t - ch.t);
  const style = STYLE_ID[sc.liveStyle || 'live'];
  const dur = LIVE_DUR[style] || 0.5;
  const jitter = sc.liveJitter || 0.12;
  const r = rng(Math.floor(t * 1000));
  for (let i = 0; i < N; i++) {
    if (!differs(i)) continue;
    acceptNew(i);
    if (inAct[i] && STY[i] !== S.TWINKLE) continue; // an in-flight transition simply lands on the new target
    schedule(i, style, t + r() * jitter, dur * (0.85 + 0.3 * r()), style === S.RISE ? 0.5 : 0.35 + r() * 0.3, null);
  }
}

function sceneEvents(t) {
  const k = liveState.chapter;
  if (k < 0) return;
  const ch = CHAPTERS[k], sc = SCENES[ch.scene], lt = t - ch.t;
  if (sc.fx) sc.fx(E, lt);
  if (sc.events) sc.events.forEach((ev, j) => {
    if (lt >= ev[0] && !liveState.fired.has(j)) { liveState.fired.add(j); E.ripple(ev[1], ev[2], ev[3], ch.t + ev[0]); }
  });
}

// Occasional loose tesserae lift, turn in the light and settle again.
let twinkleSeed = 1;
function twinkles(t, lookX, lookZ, radius) {
  const r = rng(twinkleSeed++);
  for (let n = 0; n < 3; n++) {
    const bx = lookX + (r() - 0.5) * radius * 2 + W / 2, bz = lookZ + (r() - 0.5) * radius * 1.2 + H / 2;
    const c = Math.floor(bx), rw = Math.floor(bz);
    if (c < 0 || c >= W || rw < 0 || rw >= H) continue;
    const i = rw * W + c;
    if (inAct[i] || !present[i]) continue;
    schedule(i, S.TWINKLE, t, 1.4 + r(), 0.5 + r() * 0.6, null);
  }
}

// ------------------------------------------------------------------ camera
const keyT = CAMERA.map((k) => k[0]);
const toWorld = (p) => new THREE.Vector3(p[0] - W / 2, p[2], p[1] - H / 2);
const keyPos = CAMERA.map((k) => toWorld(k[1]));
const keyLook = CAMERA.map((k) => toWorld(k[2]));
const keyAp = CAMERA.map((k) => k[3]);
function tangents(arr) {
  return arr.map((p, i) => {
    const n = arr.length;
    if (i === 0 || i === n - 1) return new THREE.Vector3();
    const a = arr[i - 1], b = arr[i + 1];
    const d0 = keyT[i] - keyT[i - 1], d1 = keyT[i + 1] - keyT[i];
    const v0 = p.clone().sub(a).divideScalar(d0), v1 = b.clone().sub(p).divideScalar(d1);
    return v0.add(v1).multiplyScalar(0.5);
  });
}
const tanPos = tangents(keyPos), tanLook = tangents(keyLook);
function hermite(arr, tan, i, u, dt, out) {
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  return out.set(0, 0, 0)
    .addScaledVector(arr[i], h00).addScaledVector(tan[i], h10 * dt)
    .addScaledVector(arr[i + 1], h01).addScaledVector(tan[i + 1], h11 * dt);
}
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let apScale = 1;
function cameraAt(t) {
  let i = 0;
  while (i < keyT.length - 2 && t >= keyT[i + 1]) i++;
  const dt = keyT[i + 1] - keyT[i];
  const u = clamp((t - keyT[i]) / dt);
  hermite(keyPos, tanPos, i, u, dt, camPos);
  hermite(keyLook, tanLook, i, u, dt, camLook);
  apScale = lerp(keyAp[i], keyAp[i + 1], smooth(u));
  // a breath of hand-held drift
  const d = camPos.distanceTo(camLook);
  camPos.x += Math.sin(t * 0.37) * 0.004 * d; camPos.y += Math.sin(t * 0.53 + 1) * 0.003 * d;
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// ------------------------------------------------------------------ post
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: QUALITY === 'low' ? 0 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 20, aperture: 0.001, maxblur: 0.009 });
if (QUALITY !== 'low') composer.addPass(bokeh);
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.26, 0.5, 0.96);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uFade: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uFade; varying vec2 vUv;
    void main() {
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      float ca = 0.006 * r2;
      vec3 c = vec3(texture2D(tDiffuse, vUv - d * ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d * ca).b);
      c *= mix(1.0, smoothstep(0.85, 0.12, r2 * 1.5), 0.6);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, c * vec3(1.05, 1.0, 0.93), smoothstep(0.35, 1.0, l));
      c = mix(c, c * vec3(0.93, 1.0, 1.07), smoothstep(0.35, 0.0, l) * 0.6);
      float g = fract(sin(dot(vUv * uRes + fract(uTime * 7.13) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
      c += (g - 0.5) * 0.03;
      gl_FragColor = vec4(c * uFade, 1.0);
    }`,
});
composer.addPass(grade);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  grade.uniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ overlay text
const titleEl = document.getElementById('endcard');
let textShown = false;
const textParts = [...titleEl.querySelectorAll('.name, .rule, .line')];
function updateText(t) {
  if (CAPTURE) {
    // frame-stepped rendering: drive the end card from film time, not wall-clock CSS transitions
    const k = (d, len = 2.2) => smooth((t - TEXT_IN - d) / len);
    titleEl.style.setProperty('--shade', k(0, 2.4));
    [[textParts[0], 0], [textParts[2], 1.4]].forEach(([el, d]) => {
      const p = k(d);
      el.style.opacity = p; el.style.transform = `translateY(${(1 - p) * 10}px)`; el.style.filter = `blur(${(1 - p) * 6}px)`;
    });
    textParts[1].style.width = `${k(0.8, 2.4) * 22}%`;
    return;
  }
  const show = t >= TEXT_IN;
  if (show !== textShown) { textShown = show; titleEl.classList.toggle('on', show); }
}

// ------------------------------------------------------------------ main step
let nextChapter = 0;
let simT = 0;

function step(t) {
  simT = t;
  U.uTime.value = t;
  while (nextChapter < CHAPTERS.length && t >= CHAPTERS[nextChapter].t) startChapter(nextChapter++, t);
  sceneEvents(t);
  livePaint(t);
  cameraAt(t);
  const d = camPos.distanceTo(camLook);
  twinkles(t, camLook.x, camLook.z, Math.min(30, d * 0.5));
  updateTiles(t);
  for (let v = 0; v < VARIANTS; v++) if (dirty[v]) {
    meshes[v].instanceMatrix.needsUpdate = true;
    meshes[v].instanceColor.needsUpdate = true;
    meshes[v].geometry.attributes.aMat.needsUpdate = true;
    dirty[v] = 0;
  }
  // light follows the action; slowly swinging for glints
  const az = -2.2 + Math.sin(t * 0.05) * 0.35;
  const elev = 0.62;
  const L = 120;
  key.target.position.copy(camLook).setY(0);
  key.position.set(camLook.x + Math.cos(az) * Math.cos(elev) * L, Math.sin(elev) * L, camLook.z + Math.sin(az) * Math.cos(elev) * L * -1);
  const sz = clamp(d * 0.95, 16, 175);
  const sc = key.shadow.camera;
  sc.left = -sz; sc.right = sz; sc.top = sz; sc.bottom = -sz; sc.near = 1; sc.far = 400;
  sc.updateProjectionMatrix();
  rim.target.position.copy(camLook);
  rim.position.set(camLook.x + 40, 30, camLook.z - 70);
  bokeh.uniforms.focus.value = d;
  bokeh.uniforms.aperture.value = (0.014 / d) * apScale;
  grade.uniforms.uTime.value = t;
  grade.uniforms.uFade.value = smooth(t / 1.2);
  updateText(t);
}

function render() { composer.render(); }

// Jump anywhere: lay the previous chapter instantly, then replay the current one.
function seek(t) {
  t = clamp(t, 0, DURATION);
  act.forEach((i) => { inAct[i] = 0; STY[i] = -1; });
  act = [];
  present.fill(0);
  for (let j = 0; j < 4; j++) U.uRip.value[j].set(0, 0, -100, 0);
  let k = 0;
  while (k + 1 < CHAPTERS.length && CHAPTERS[k + 1].t <= t) k++;
  if (k > 0) {
    const prev = CHAPTERS[k - 1];
    paint(prev.scene, CHAPTERS[k].t - prev.t);
    for (let i = 0; i < N; i++) { acceptNew(i); applyTarget(i); present[i] = 1; }
  }
  for (let i = 0; i < N; i++) rest(i);
  nextChapter = k;
  startChapter(nextChapter++, t);
  // don't replay ripples that already happened
  const ch = CHAPTERS[k], sc = SCENES[ch.scene];
  if (sc.events) sc.events.forEach((ev, j) => { if (t - ch.t > ev[0] + 0.05) liveState.fired.add(j); });
  if (ch.scene === 'heart') E.fxState.beat = Math.floor((t - ch.t - 2.4) / 0.95);
  step(t);
}

// ------------------------------------------------------------------ playback
let playing = false, clockT = 0, lastNow = 0;
const perf = { acc: 0, n: 0, checked: false };
const ui = document.getElementById('ui');
const scrub = document.getElementById('scrub');

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastNow) / 1000 || 0);
  lastNow = now;
  if (playing) {
    clockT = Math.min(DURATION, clockT + dt);
    step(clockT);
    if (clockT >= DURATION) { playing = false; document.body.classList.add('ended'); }
    // gentle adaptive resolution for slower GPUs
    if (!perf.checked && clockT > 2) {
      perf.acc += dt; perf.n++;
      if (perf.n === 90) {
        perf.checked = true;
        if (perf.acc / perf.n > 0.045 && pixelRatio > 0.6) { pixelRatio = Math.max(0.6, pixelRatio * 0.7); resize(); }
      }
    }
  }
  render();
  if (scrub) scrub.style.width = `${(clockT / DURATION) * 100}%`;
}

function play() {
  document.body.classList.add('playing');
  document.body.classList.remove('ended');
  if (clockT >= DURATION) { clockT = 0; seek(0); }
  playing = true;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); playing ? (playing = false) : play(); }
  else if (e.code === 'KeyR') { clockT = 0; seek(0); play(); }
  else if (e.code === 'ArrowRight') { clockT = Math.min(DURATION, clockT + 5); seek(clockT); }
  else if (e.code === 'ArrowLeft') { clockT = Math.max(0, clockT - 5); seek(clockT); }
  else if (e.code === 'KeyF') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); }
  else if (e.code === 'KeyH') document.body.classList.toggle('clean');
});
document.getElementById('begin')?.addEventListener('click', play);
document.getElementById('replay')?.addEventListener('click', () => { clockT = 0; seek(0); play(); });
if (ui) {
  let idle;
  window.addEventListener('pointermove', () => { ui.classList.add('awake'); clearTimeout(idle); idle = setTimeout(() => ui.classList.remove('awake'), 1800); });
}

// Optional official logo: drop the file at assets/wvsom-logo.png and it is laid in tile for the final reveal.
async function loadLogo() {
  try {
    const res = await fetch('assets/wvsom-logo.png', { cache: 'no-store' });
    if (!res.ok) return;
    painter.logo = await createImageBitmap(await res.blob());
  } catch { /* no logo supplied – the tile wordmark is used */ }
}

// Deterministic, frame-accurate stepping for offline rendering.
window.__film = {
  duration: DURATION,
  fps: 30,
  seek(t) { clockT = t; seek(t); render(); },
  // advance exactly one frame and render it
  frame() { clockT = Math.min(DURATION, clockT + 1 / this.fps); step(clockT); render(); return clockT; },
  get time() { return simT; },
};

await loadLogo();
clockT = START_T;
seek(START_T);
if (!CAPTURE) {
  requestAnimationFrame((now) => { lastNow = now; loop(now); });
  if (AUTOPLAY) play();
} else {
  document.body.classList.add('playing', 'clean', 'capture');
  render();
}
window.__ready = true;
