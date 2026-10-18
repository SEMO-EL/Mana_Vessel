/* ═══════════════════════════════════════════════════════════════════════
   MANA VESSEL — The Borderlands of Fittoa            (Milestone 2)
   A third-person open-world action RPG. three.js r170, one HTML file.

   Every src/*.js file is concatenated, in name order, into ONE ES module,
   so top-level names are shared across files. Numbering is layering:
     00-09  core, renderer, input, data
     10-19  world  (terrain, sky, water, foliage, structures, cave)
     20-29  simulation (physics, actors, camera, player, combat, magic, AI)
     30-39  interface  (HUD, menus, map, dialogue)
     40-49  audio
     50-69  story, save
     90-99  tests, main loop
   ═══════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const DEV = /[?&](dev|test)\b/.test(location.search);
const TEST = /[?&]test\b/.test(location.search);

/* ───────────── math ───────────── */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
const smooth = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
// frame-rate independent exponential approach: k = "sharpness" per second
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const wrapAngle = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const dampAngle = (a, b, k, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-k * dt));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ───────────── 2D simplex noise (Gustavson), seeded ───────────── */
const Noise = (() => {
  const grad = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  function make(seed) {
    const r = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    // returns roughly [-1, 1]
    return function (xin, yin) {
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n = 0, tt;
      tt = 0.5 - x0 * x0 - y0 * y0;
      if (tt > 0) { const g = grad[perm[ii + perm[jj]] & 7]; tt *= tt; n += tt * tt * (g[0] * x0 + g[1] * y0); }
      tt = 0.5 - x1 * x1 - y1 * y1;
      if (tt > 0) { const g = grad[perm[ii + i1 + perm[jj + j1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x1 + g[1] * y1); }
      tt = 0.5 - x2 * x2 - y2 * y2;
      if (tt > 0) { const g = grad[perm[ii + 1 + perm[jj + 1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x2 + g[1] * y2); }
      return 70 * n;
    };
  }
  return { make };
})();
function fbm(noise, x, z, oct, lac = 2.03, gain = 0.5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += noise(x * f, z * f) * a; n += a; a *= gain; f *= lac; }
  return s / n;
}
function ridged(noise, x, z, oct) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { const v = 1 - Math.abs(noise(x * f, z * f)); s += v * v * a; n += a; a *= 0.5; f *= 2.1; }
  return s / n;
}

/* ───────────── polyline: dense samples of a Catmull-Rom path ───────────── */
function catmull(points, samplesPerSeg) {
  const out = [];
  const P = i => points[clamp(i, 0, points.length - 1)];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg, t2 = t * t, t3 = t2 * t;
      const f = k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([f(0), f(1)]);
    }
  }
  out.push(points[points.length - 1].slice());
  return out;
}

/* ───────────── events ───────────── */
const BUS = (() => {
  const h = {};
  return {
    on(n, f) { (h[n] || (h[n] = [])).push(f); return () => { h[n] = h[n].filter(x => x !== f); }; },
    emit(n, d) { const l = h[n]; if (l) for (const f of l.slice()) f(d); },
  };
})();

/* ───────────── assets ───────────── */
function assetBuffer(name) {
  const u = MV_ASSET(name);
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);
}
function parseGLB(name) {
  return new Promise((ok, bad) => new GLTFLoader().parse(assetBuffer(name), '', ok, bad));
}
const _texCache = {};
function assetTexture(name, opts = {}) {
  if (_texCache[name]) return _texCache[name];
  const url = URL.createObjectURL(new Blob([MV_ASSET(name)], { type: 'image/png' }));
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = opts.flipY ?? false;               // glTF UV convention
  t.magFilter = opts.nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.anisotropy = 4;
  return (_texCache[name] = t);
}

/* ───────────── settings ─────────────
   Persisted separately from saves. Quality presets are starting points;
   every field can still be changed on its own in Settings.            */
const QUALITY = {
  low:    { scale: 0.75, shadow: 1024, shadowDist: 70,  grass: 0.35, trees: 0.6, bloom: false, msaa: 0, far: 700,  lights: 2, treeNear: 110 },
  medium: { scale: 1.0,  shadow: 2048, shadowDist: 100, grass: 0.6,  trees: 0.8, bloom: true,  msaa: 0, far: 950,  lights: 4, treeNear: 180 },
  high:   { scale: 1.0,  shadow: 4096, shadowDist: 130, grass: 1.0,  trees: 1.0, bloom: true,  msaa: 4, far: 1300, lights: 6, treeNear: 260 },
  ultra:  { scale: 1.25, shadow: 4096, shadowDist: 170, grass: 1.4,  trees: 1.0, bloom: true,  msaa: 4, far: 1600, lights: 8, treeNear: 320 },
};
const SETTINGS = {
  quality: 'high',
  master: 0.7, music: 0.45, sfx: 0.8,
  sens: 1.0, invertY: false, fov: 60,
  shake: true, damageNumbers: true, subtitles: true,
  difficulty: 'adventurer',          // story | adventurer | deadend
  binds: null,                       // filled from DEFAULT_BINDS on load
};
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('mv3d:settings') || 'null');
    if (s) Object.assign(SETTINGS, s);
  } catch (e) { /* first run, or private mode — defaults are fine */ }
}
function saveSettings() {
  try { localStorage.setItem('mv3d:settings', JSON.stringify(SETTINGS)); } catch (e) {}
}
const Q = () => QUALITY[SETTINGS.quality] || QUALITY.high;

/* ───────────── dom helpers ───────────── */
const $ = id => document.getElementById(id);
function bootStatus(msg) { const el = $('bootMsg'); if (el) el.textContent = msg; }
// Yield so the boot text can repaint between heavy steps. setTimeout, not
// requestAnimationFrame: rAF never fires in a background/minimised tab, and
// boot must not stall just because the window isn't focused yet.
const nextFrame = () => new Promise(r => setTimeout(r, 16));

/* Global run state. Declared here, first, because every later file reads it. */
const GAME = { state: 'boot', time: 0, frame: 0, focus: new THREE.Vector3(-420, 30, 360), hitstop: 0, timeScale: 1 };
