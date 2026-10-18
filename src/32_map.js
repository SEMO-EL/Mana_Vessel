/* ═══════════════════════════════════════════════════════════════════════
   MAP — the painted world map, fog of war, fast travel, the minimap.

   PAINTING (mapBuild, once at boot): the playable square (±WORLD.half)
   goes into a 2048² offscreen canvas, read straight from the fields the
   terrain mesh was built from, so the map never disagrees with the ground:
     relief    elevation tint × hillshade lit from the north-west, one value
               per heightfield sample (2 m), upscaled smoothly like a wash
     contours  marching squares on a 4 m grid every 20 m, index every 100 m
     water     per pixel from the river distance field and the lake level,
               so shores stay crisp: inked shoreline, waterlines, ripples
     overlays  fields, forest canopy, the road, buildings, the cave mouth
     paper     grain, stains and burnt edges multiplied over everything
   Place names, border, compass and the title cartouche are vectors drawn
   live in map space: sharp at every zoom, and names fade in as their
   ground is discovered.

   FOG OF WAR: MAP.reveal is a 128×128 byte mask over the same square
   (12.5 m texels, 0 unseen … 255 seen). Play stamps a soft circle at 4 Hz,
   wider the higher you are above the ground; the watchtower stamps 380 m.
   It is saved as base64 in G.mapReveal. The mask belongs to ONE G: when G
   changes (new journey, continue) it is re-read, so a new game never
   inherits an old map.

   SCREEN (#mapScreen): DOM + one canvas with its own rAF loop that only
   runs while open. The menus own GAME.state — mapClose() just hides, and
   the main loop notices the map is gone and returns to play.
   ═══════════════════════════════════════════════════════════════════════ */
// The frame: the playable rectangle plus a 20 m margin (Buena alone was ±800).
const MAP_X0 = WORLD.px0 - 20, MAP_X1 = WORLD.px1 + 20, MAP_Z0 = WORLD.pz0 - 20, MAP_Z1 = WORLD.pz1 + 20;
const MAP_W = MAP_X1 - MAP_X0, MAP_H = MAP_Z1 - MAP_Z0;
const MAP_PPM = Math.min(1.28, 3600 / Math.max(MAP_W, MAP_H));   // map px per metre (1.28 at Buena's size)
const MAP_RES_X = Math.round(MAP_W * MAP_PPM), MAP_RES_Z = Math.round(MAP_H * MAP_PPM);   // painted map, px
const MAP_TEXEL = 12.5;                        // fog-of-war mask texel, metres
const MAP_RVX = Math.round(MAP_W / MAP_TEXEL), MAP_RVZ = Math.round(MAP_H / MAP_TEXEL);
const MAP_FOGX = MAP_RVX * 2, MAP_FOGZ = MAP_RVZ * 2;   // the mask, softly upsampled for drawing
const MAP_REVEAL_R = 70;                       // reveal radius on foot, metres
const MAP_ZOOM = { min: 1, max: 4, open: 2 };
const MAP_COL = {
  ink: '#2a2116', parch: '#e6dcc2', gold: '#c9a227', hot: '#f0cf62', blood: '#8b2635', mana: '#5aa9e6',
  halo: 'rgba(238,228,202,0.88)', rule: '#3a2c1c',
};
// elevation tint, metres → colour: warm lowland greens, olive and ochre
// highlands, grey-brown rock, pale near the highest peaks
const MAP_RAMP = [
  [0, '#93a866'], [22, '#9db06a'], [40, '#aab36e'], [62, '#b6ad6a'], [90, '#bca36b'],
  [125, '#ae9572'], [165, '#9e8f7f'], [210, '#b9b1a3'], [260, '#ddd7c8'], [330, '#f2ede1'],
];
// where each place name sits relative to its spot (metres), and how large
const MAP_LABELS = {
  village: { dx: -20, dz: 120, size: 'big' },     lake: { dz: -22, size: 'mid', water: true, spread: 0.4 },
  roxyHill: { dx: 10, dz: 44 },                   ridge: { dz: -48, size: 'mid' },
  forest: { dz: 180, size: 'big', spread: 0.35 }, grove: { dz: 38 },
  falls: { dx: -90, dz: -40, size: 'mid' },       cave: { dx: 30, dz: -46 },
  camp: { dz: 40 },                               ruinsE: { dz: 36 },
  gate: { dx: -150, dz: -44, size: 'mid' },
  // the Roa basin (the estate sits inside the city's walls: its name would sit on the keep)
  pass: { dz: -40, size: 'mid' },                 roa: { dz: -138, size: 'big' },
  estate: { hide: true },                         farms: { dz: 72 },
  outskirts: { dx: 170, dz: 190, size: 'mid', spread: 0.3 },
  wagons: { dz: -36 },                            firstWall: { dz: -48 },
  sunstones: { dz: -24 }, colossus: { dz: -26 }, hermit: { dz: -22 }, crag: { dz: -20 },
};
const MAP_LABEL_PX = { big: 15, mid: 12.5, small: 10.5 };   // screen px at 1× (grow with √zoom)

const MAP = {
  canvas: null, buildMs: 0,                                  // the painted map
  reveal: new Uint8Array(MAP_RVX * MAP_RVZ), owner: null, revealT: 0,
  fog: null, fogCtx: null, fogImg: null, fogNoise: null, fogDirty: true,
  el: null, cv: null, open: false, raf: 0, lastT: 0, frame: null, err: false,
  view: { cx: 0, cz: 0, zoom: MAP_ZOOM.open, tz: MAP_ZOOM.open, ax: 0, az: 0, sx: 0, sy: 0 },
  drag: null, hover: null, sel: null, travelling: false,
};
const mapHex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
// world metres → painted-map pixels, and "is this inside the frame (± margin)"
const mapX = x => (x - MAP_X0) * MAP_PPM, mapY = z => (z - MAP_Z0) * MAP_PPM;
const inMapFrame = (x, z, m = 0) => x > MAP_X0 - m && x < MAP_X1 + m && z > MAP_Z0 - m && z < MAP_Z1 + m;
const mapWaystones = () => (typeof WSTONE !== 'undefined' && WSTONE.list.length ? WSTONE.list : WAYSTONES);

/* ───────────── painting ───────────── */
function mapBuild() {
  if (!TER.H || !TER.NX) return false;
  const t0 = performance.now();
  const cv = MAP.canvas || document.createElement('canvas');
  cv.width = MAP_RES_X; cv.height = MAP_RES_Z;                // (also wipes a rebuild)
  const ctx = cv.getContext('2d');
  MAP.canvas = cv;
  ctx.fillStyle = MAP_COL.parch; ctx.fillRect(0, 0, MAP_RES_X, MAP_RES_Z);
  // heightfield samples covering the frame: BX × BZ, starting at grid index (ix0, iz0)
  const g = { BX: Math.round(MAP_W / WORLD.cell) + 1, BZ: Math.round(MAP_H / WORLD.cell) + 1,
    ix0: Math.round((MAP_X0 - WORLD.x0) / WORLD.cell), iz0: Math.round((MAP_Z0 - WORLD.z0) / WORLD.cell) };
  const steps = [
    () => mapPaintRelief(ctx, g), () => mapPaintContours(ctx, g), () => mapPaintWater(ctx, g),
    () => mapPaintProps(ctx, 'ground'), () => mapPaintForest(ctx), () => mapPaintRoad(ctx),
    () => mapPaintProps(ctx, 'build'), () => mapPaintPaper(ctx),
  ];
  // one failed layer must not cost the whole map
  for (const step of steps) { ctx.save(); try { step(); } catch (e) { console.error('map', e); } ctx.restore(); }
  if (!MAP.fogNoise) MAP.fogNoise = mapFogNoise();
  MAP.fogDirty = true;
  MAP.buildMs = Math.round(performance.now() - t0);
  mapEnsureDom();                                            // #mapScreen exists (hidden) from boot on
  return true;
}

function mapRampLUT(n, hMax) {
  const st = MAP_RAMP.map(([h, c]) => [h, ...mapHex(c)]), lut = new Uint8Array(n * 3);
  for (let i = 0, s = 0; i < n; i++) {
    const h = i / (n - 1) * hMax;
    while (s < st.length - 2 && h > st[s + 1][0]) s++;
    const a = st[s], b = st[s + 1], t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * t;
  }
  return lut;
}

/* Relief: one pixel per heightfield sample, then a smooth upscale — the
   softness reads as watercolour, and it's ~6× fewer samples than 2048². */
function mapPaintRelief(ctx, { BX, BZ, ix0, iz0 }) {
  const N = TER.NX, H = TER.H, GR = TER.GRASS, inv2c = 1 / (2 * WORLD.cell);
  const LUTN = 1024, HMAX = 340, lut = mapRampLUT(LUTN, HMAX), lk = (LUTN - 1) / HMAX;
  // light from the north-west (−x, −z), ~42° up; heights exaggerated so gentle hills still model
  const EX = 2.4, Ln = Math.hypot(1, 1.3, 1), LX = -1 / Ln, LY = 1.3 / Ln, LZ = -1 / Ln;
  const img = ctx.createImageData(BX, BZ), d = img.data;
  for (let j = 0; j < BZ; j++) {
    const row = (iz0 + j) * N + ix0;
    for (let k = 0; k < BX; k++) {
      const gi = row + k, h = H[gi];
      const gx = (H[gi + 1] - H[gi - 1]) * inv2c, gz = (H[gi + N] - H[gi - N]) * inv2c;
      const nx = -gx * EX, nz = -gz * EX;
      const sh = (nx * LX + LY + nz * LZ) / Math.sqrt(nx * nx + 1 + nz * nz) - LY;   // 0 on flat ground
      const li = ((h < 0 ? 0 : h > HMAX ? HMAX : h) * lk | 0) * 3;
      let r = lut[li], g = lut[li + 1], b = lut[li + 2];
      // thick meadow grass greens the lowlands a little
      if (GR && h < 110) {
        const t = GR[gi] * (0.14 / 255) * (h < 60 ? 1 : (110 - h) / 50);
        r += (112 - r) * t; g += (146 - g) * t; b += (80 - b) * t;
      }
      // steep ground is bare rock
      const sl = gx * gx + gz * gz;
      if (sl > 0.3) {
        const t = Math.min((Math.sqrt(sl) - 0.55) * 0.9, 0.55);
        if (t > 0) { r += (140 - r) * t; g += (127 - g) * t; b += (110 - b) * t; }
      }
      // hillshade: warm light on north-west faces, violet-brown shade on the rest
      if (sh > 0) { const t = Math.min(sh * 1.3, 0.55); r += (253 - r) * t; g += (244 - g) * t; b += (220 - b) * t; }
      else { const t = Math.min(-sh * 1.15, 0.75); r += (72 - r) * t; g += (58 - g) * t; b += (64 - b) * t; }
      // printed on parchment
      const o = (j * BX + k) * 4;
      d[o] = r + (232 - r) * 0.15; d[o + 1] = g + (222 - g) * 0.15; d[o + 2] = b + (196 - b) * 0.15; d[o + 3] = 255;
    }
  }
  const tmp = document.createElement('canvas');
  tmp.width = BX; tmp.height = BZ;
  tmp.getContext('2d').putImageData(img, 0, 0);
  const cpx = WORLD.cell * MAP_PPM;                                     // map px per sample
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, -cpx / 2, -cpx / 2, BX * cpx, BZ * cpx);           // sample k's centre lands on MAP_X0 + k·cell
  tmp.width = tmp.height = 0;
}

/* Contours by marching squares on every 2nd sample (4 m): ~160k cells,
   nearly all crossing no level at all. Saddles pair top-right/bottom-left. */
function mapPaintContours(ctx, { BX, BZ, ix0, iz0 }) {
  const N = TER.NX, H = TER.H, STEP = 2, M = Math.floor((BX - 1) / STEP) + 1, MZ = Math.floor((BZ - 1) / STEP) + 1, IV = 20;
  const V = new Float32Array(M * MZ);
  for (let j = 0; j < MZ; j++) for (let k = 0; k < M; k++) V[j * M + k] = H[(iz0 + j * STEP) * N + ix0 + k * STEP];
  const q = STEP * WORLD.cell * MAP_PPM, minor = new Path2D(), major = new Path2D(), P = new Float32Array(8);
  for (let j = 0; j < MZ - 1; j++) for (let k = 0; k < M - 1; k++) {
    const a = V[j * M + k], b = V[j * M + k + 1], c = V[(j + 1) * M + k + 1], d = V[(j + 1) * M + k];
    const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
    for (let L = Math.ceil(lo / IV) * IV; L < hi; L += IV) {
      let n = 0;
      if ((a >= L) !== (b >= L)) { const t = (L - a) / (b - a); P[n++] = (k + t) * q; P[n++] = j * q; }
      if ((b >= L) !== (c >= L)) { const t = (L - b) / (c - b); P[n++] = (k + 1) * q; P[n++] = (j + t) * q; }
      if ((d >= L) !== (c >= L)) { const t = (L - d) / (c - d); P[n++] = (k + t) * q; P[n++] = (j + 1) * q; }
      if ((a >= L) !== (d >= L)) { const t = (L - a) / (d - a); P[n++] = k * q; P[n++] = (j + t) * q; }
      if (n < 4) continue;
      const path = L % 100 === 0 ? major : minor;
      path.moveTo(P[0], P[1]); path.lineTo(P[2], P[3]);
      if (n === 8) { path.moveTo(P[4], P[5]); path.lineTo(P[6], P[7]); }
    }
  }
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(96,66,40,0.2)'; ctx.lineWidth = 0.9; ctx.stroke(minor);
  ctx.strokeStyle = 'rgba(96,66,40,0.36)'; ctx.lineWidth = 1.4; ctx.stroke(major);
}

/* Water at full resolution, but only near water: flag the samples it can
   touch, then shade pixels inside their bounds. Coverage comes from smooth
   fields (river distance, depth under the lake), so edges antialias. */
function mapPaintWater(ctx, { BX, BZ, ix0, iz0 }) {
  const N = TER.NX, H = TER.H, WA = TER.WATER, RD = TER.RIVD, c = WORLD.cell, inv = 1 / c;
  const lvl = WORLD.lakeLevel, rEdge = RIVER_WIDTH / 2 + 2.5, lr2 = (LAKE.r + 4) ** 2, lf2 = (LAKE.r + 8) ** 2;
  const near = new Uint8Array(BX * BZ);
  let k0 = BX, k1 = -1, j0 = BZ, j1 = -1;
  for (let j = 0; j < BZ; j++) {
    const dz = MAP_Z0 + j * c - LAKE.z;
    for (let k = 0; k < BX; k++) {
      const gi = (iz0 + j) * N + ix0 + k, dx = MAP_X0 + k * c - LAKE.x;
      if (WA[gi] > NO_WATER || RD[gi] < rEdge + 2 || (dx * dx + dz * dz < lf2 && H[gi] < lvl + 0.6)) {
        near[j * BX + k] = 1;
        if (k < k0) k0 = k; if (k > k1) k1 = k; if (j < j0) j0 = j; if (j > j1) j1 = j;
      }
    }
  }
  if (k1 < 0) return;
  const S = MAP_PPM, pm = 1 / S;
  const px0 = Math.max(0, Math.floor(k0 * c * S) - 3), px1 = Math.min(MAP_RES_X, Math.ceil(k1 * c * S) + 4);
  const py0 = Math.max(0, Math.floor(j0 * c * S) - 3), py1 = Math.min(MAP_RES_Z, Math.ceil(j1 * c * S) + 4);
  const W = px1 - px0, Hh = py1 - py0, img = ctx.createImageData(W, Hh), d = img.data;
  for (let py = py0; py < py1; py++) {
    const z = MAP_Z0 + (py + 0.5) * pm, bj = Math.round((z - MAP_Z0) * inv);
    if (bj < 0 || bj >= BZ) continue;
    const fz = (z - WORLD.z0) * inv, iz = fz | 0, tz = fz - iz, dzl = z - LAKE.z;
    for (let px = px0; px < px1; px++) {
      const x = MAP_X0 + (px + 0.5) * pm, bk = Math.round((x - MAP_X0) * inv);
      if (bk < 0 || bk >= BX || !near[bj * BX + bk]) continue;
      const fx = (x - WORLD.x0) * inv, ix = fx | 0, tx = fx - ix, gi = iz * N + ix;
      const rd = (RD[gi] * (1 - tx) + RD[gi + 1] * tx) * (1 - tz) + (RD[gi + N] * (1 - tx) + RD[gi + N + 1] * tx) * tz;
      const h = (H[gi] * (1 - tx) + H[gi + 1] * tx) * (1 - tz) + (H[gi + N] * (1 - tx) + H[gi + N + 1] * tx) * tz;
      const dxl = x - LAKE.x;
      const wr = rEdge - rd;                                          // metres in from the river's edge
      const wl = dxl * dxl + dzl * dzl < lr2 ? lvl + 0.05 - h : -1;   // metres under the lake's surface
      const covR = clamp(wr * S + 0.5, 0, 1), covL = clamp(wl * 7 + 0.5, 0, 1), cov = Math.max(covR, covL);
      if (cov <= 0) continue;
      const lake = covL > covR, q = lake ? wl * 9 : wr;               // ≈ metres from the shore
      const deep = smooth(0, lake ? 22 : 9, q);
      let r = 150 - 62 * deep, g = 180 - 48 * deep, b = 188 - 30 * deep;
      // engraved waterlines following the shore
      const ln = lake ? Math.min(Math.abs(q - 3.2), Math.abs(q - 7.8), Math.abs(q - 14)) : Math.abs(q - 3);
      if (ln < 0.5) { const t = (1 - ln / 0.5) * 0.42; r += (218 - r) * t; g += (230 - g) * t; b += (228 - b) * t; }
      // ripple flecks
      const rp = Math.sin(x * 0.55 + Math.sin(z * 0.09) * 2.2) * Math.sin(z * 0.85 + x * 0.12);
      if (rp > 0.72) { const t = (rp - 0.72) * 0.9; r += (232 - r) * t; g += (240 - g) * t; b += (236 - b) * t; }
      // inked shoreline
      const sh = (1 - smooth(0.3, 1.8, q)) * 0.82;
      r += (48 - r) * sh; g += (76 - g) * sh; b += (94 - b) * sh;
      const o = ((py - py0) * W + px - px0) * 4;
      d[o] = r + (230 - r) * 0.08; d[o + 1] = g + (222 - g) * 0.08; d[o + 2] = b + (196 - b) * 0.08; d[o + 3] = cov * 255;
    }
  }
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = Hh;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.drawImage(tmp, px0, py0);
  tmp.width = tmp.height = 0;
}

/* Put ctx in a placed prop's own frame (footprint centre, yaw — the same
   maths as placeProp's collider). Returns half-sizes in map px and a
   south-east shadow offset expressed in that rotated frame. */
function mapPropFrame(ctx, p) {
  const o = p.obj;
  if (!o || !inMapFrame(o.position.x, o.position.z, 40)) return null;
  const sz = typeof propSize === 'function' ? propSize(p.name) : null, s = o.scale.x, rot = o.rotation.y;
  const c = Math.cos(rot), si = Math.sin(rot), S = MAP_PPM;
  const ox = sz ? (sz.cx * c + sz.cz * si) * s : 0, oz = sz ? (-sz.cx * si + sz.cz * c) * s : 0;
  ctx.save();
  ctx.translate(mapX(o.position.x + ox), mapY(o.position.z + oz));
  ctx.rotate(-rot);
  return { w: (sz ? sz.hx * s : 4) * S, h: (sz ? sz.hz * s : 4) * S, sx: 1.4 * c - 1.8 * si, sy: 1.4 * si + 1.8 * c };
}

/* Buildings as little painted footprints, from STRUCT.placed. 'ground'
   pass: fields and the bridge (under forest and road); 'build': the rest. */
const MAP_PROPS = [   // [name pattern, kind, fill]
  [/^building_grain/, 'field', 'rgba(208,172,76,0.62)'], [/^building_bridge/, 'bridge', '#8a6440'],
  [/^building_tower/, 'tower', '#8f3d2f'], [/^building_(home|church|tavern|market|blacksmith|watermill|windmill)/, 'house', '#9a4434'],
  [/^(building_well|building_destroyed|tent$|wall_|fence_stone)/, 'minor', 'rgba(104,94,80,0.75)'],
];
function mapPaintProps(ctx, pass) {
  for (const p of (typeof STRUCT !== 'undefined' && STRUCT.placed) || []) {
    const def = MAP_PROPS.find(d => d[0].test(p.name || '')), kind = def && def[1];
    if (!kind || (pass === 'ground') !== (kind === 'field' || kind === 'bridge')) continue;
    const F = mapPropFrame(ctx, p);
    if (!F) continue;
    const { w, h } = F, r = Math.max(w, h), round = kind === 'tower';
    const shape = (dx, dy) => { ctx.beginPath(); if (round) ctx.arc(dx, dy, r, 0, TAU); else ctx.rect(dx - w, dy - h, 2 * w, 2 * h); };
    if (kind === 'house' || round) { shape(F.sx, F.sy); ctx.fillStyle = 'rgba(40,24,14,0.35)'; ctx.fill(); }   // cast shadow
    shape(0, 0); ctx.fillStyle = def[2]; ctx.fill();
    ctx.lineWidth = round ? 1.6 : 0.9; ctx.strokeStyle = kind === 'field' ? 'rgba(128,92,34,0.5)' : '#3b2216'; ctx.stroke();
    ctx.beginPath();
    if (kind === 'field') { for (let y = -h + 1.6; y < h; y += 2.6) { ctx.moveTo(-w + 1, y); ctx.lineTo(w - 1, y); } }   // furrows
    else if (kind === 'house') { if (w > h) { ctx.moveTo(-w, 0); ctx.lineTo(w, 0); } else { ctx.moveTo(0, -h); ctx.lineTo(0, h); } }   // roof ridge
    else if (round) ctx.arc(0, 0, r * 0.55, 0, TAU);
    ctx.lineWidth = 0.8; ctx.strokeStyle = round ? 'rgba(255,226,180,0.5)' : kind === 'house' ? '#5e2a20' : ctx.strokeStyle; ctx.stroke();
    ctx.restore();
  }
  // the cave mouth: a dark arch in the cliff, open to the south
  const m = pass === 'build' && typeof STRUCT !== 'undefined' && STRUCT.caveMouth;
  if (m) {
    const X = mapX(m.x), Y = mapY(m.z), r = 7 * MAP_PPM;
    ctx.beginPath(); ctx.ellipse(X, Y + r * 0.15, r, r * 0.8, 0, Math.PI, TAU); ctx.closePath();
    ctx.fillStyle = '#1c1418'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#6a5d50'; ctx.stroke();
  }
}

/* Forest: every crown is a blob in ONE path, so the canopy fills as a
   single painted mass — then a cast shadow under it and a lit north-west
   shoulder on each crown. Pines are tiny triangles; scrub is thinned. */
function mapPaintForest(ctx) {
  const trees = (typeof FOL !== 'undefined' && FOL.trees) || [], S = MAP_PPM;
  const crowns = new Path2D(), lights = new Path2D(), pines = new Path2D(), scrub = new Path2D();
  let n = 0;
  for (const t of trees) {
    if (!inMapFrame(t.x, t.z)) continue;
    const X = mapX(t.x), Y = mapY(t.z), h = t.h || 8;
    if (t.kind === 'pine') {
      const r = (1.5 + h * 0.11) * S;
      pines.moveTo(X, Y - r * 1.6); pines.lineTo(X + r * 0.9, Y + r * 0.75); pines.lineTo(X - r * 0.9, Y + r * 0.75); pines.closePath();
    } else if (t.kind === 'bush' || t.kind === 'dead') {
      if ((n++ & 1) === 0) { const r = 1.4 * S; scrub.moveTo(X + r, Y); scrub.arc(X, Y, r, 0, TAU); }
    } else {
      const r = (1.8 + h * 0.16) * S, lr = r * 0.48, lx = X - r * 0.32, ly = Y - r * 0.36;
      crowns.moveTo(X + r, Y); crowns.arc(X, Y, r, 0, TAU);
      lights.moveTo(lx + lr, ly); lights.arc(lx, ly, lr, 0, TAU);
    }
  }
  ctx.save(); ctx.translate(1.7, 2.1);
  ctx.fillStyle = 'rgba(38,44,24,0.42)'; ctx.fill(crowns); ctx.fill(pines);
  ctx.restore();
  ctx.fillStyle = 'rgba(112,104,62,0.55)'; ctx.fill(scrub);
  ctx.fillStyle = '#5f7d3d'; ctx.fill(crowns);
  ctx.fillStyle = 'rgba(170,186,104,0.55)'; ctx.fill(lights);
  ctx.fillStyle = '#41593a'; ctx.fill(pines);
  ctx.strokeStyle = 'rgba(28,36,22,0.55)'; ctx.lineWidth = 0.6; ctx.stroke(pines);
}

/* The road: a pale worn verge under a warm-brown dashed line. */
function mapPaintRoad(ctx) {
  const pts = TER.roadPath || catmull(ROAD, 8), S = MAP_PPM, path = new Path2D();
  pts.forEach(([x, z], i) => { const X = mapX(x), Y = mapY(z); if (i) path.lineTo(X, Y); else path.moveTo(X, Y); });
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(240,229,200,0.6)'; ctx.lineWidth = 6.5; ctx.stroke(path);
  ctx.strokeStyle = '#7a5532'; ctx.lineWidth = 2.4; ctx.setLineDash([9, 6]); ctx.stroke(path);
  ctx.setLineDash([]);
}

/* Paper: a grain tile, a few age stains and burnt edges, all multiplied. */
function mapPaintPaper(ctx) {
  const T = 256, tile = document.createElement('canvas'), R = mulberry32(WORLD.seed + 404);
  tile.width = tile.height = T;
  const tc = tile.getContext('2d'), img = tc.createImageData(T, T), d = img.data;
  for (let i = 0; i < T * T; i++) {
    const v = 236 + R() * 19 - (R() < 0.012 ? 28 : 0);
    d[i * 4] = v; d[i * 4 + 1] = v * 0.985; d[i * 4 + 2] = v * 0.95; d[i * 4 + 3] = 255;
  }
  tc.putImageData(img, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, MAP_RES_X, MAP_RES_Z);
  for (let i = 0, n = Math.round(16 * MAP_RES_X * MAP_RES_Z / (2048 * 2048)); i < n; i++) {
    const x = R() * MAP_RES_X, y = R() * MAP_RES_Z, r = 80 + R() * 260, g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(150,110,60,${(0.04 + R() * 0.05).toFixed(3)})`); g.addColorStop(1, 'rgba(150,110,60,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // burnt edges: a vignette stretched to the sheet's aspect
  const cx = MAP_RES_X / 2, cy = MAP_RES_Z / 2, m = Math.min(MAP_RES_X, MAP_RES_Z);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(MAP_RES_X / m, MAP_RES_Z / m);
  const v = ctx.createRadialGradient(0, 0, m * 0.42, 0, 0, m * 0.74);
  v.addColorStop(0, 'rgba(120,80,40,0)'); v.addColorStop(1, 'rgba(110,72,36,0.42)');
  ctx.fillStyle = v; ctx.fillRect(-m / 2, -m / 2, m, m);
  ctx.restore();
  tile.width = tile.height = 0;
}

/* ───────────── fog of war ───────────── */
// Which G the mask belongs to; a different G (new game, continue) re-reads it.
function mapSyncOwner() { if (G && MAP.owner !== G) mapDeserialize(); }

/// How seen a world point is, 0..1 (bilinear over the mask).
function mapSeen(x, z) {
  const RX = MAP_RVX, RZ = MAP_RVZ, rv = MAP.reveal;
  const fx = clamp((x - MAP_X0) / MAP_TEXEL - 0.5, 0, RX - 1.001), fz = clamp((z - MAP_Z0) / MAP_TEXEL - 0.5, 0, RZ - 1.001);
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * RX + ix;
  return ((rv[i] * (1 - tx) + rv[i + 1] * tx) * (1 - tz) + (rv[i + RX] * (1 - tx) + rv[i + RX + 1] * tx) * tz) / 255;
}

// Stamp a soft-edged disc of "seen" into the mask. Returns whether anything changed.
function mapRevealAt(x, z, r) {
  if (!G || !isFinite(x) || !isFinite(z) || !(r > 0)) return false;
  mapSyncOwner();
  const RX = MAP_RVX, RZ = MAP_RVZ, cm = MAP_TEXEL, cx = (x - MAP_X0) / cm - 0.5, cz = (z - MAP_Z0) / cm - 0.5;
  const rr = r / cm, inner = (r - Math.min(r * 0.4, 60)) / cm, rv = MAP.reveal;
  const x0 = Math.max(0, Math.floor(cx - rr)), x1 = Math.min(RX - 1, Math.ceil(cx + rr));
  const z0 = Math.max(0, Math.floor(cz - rr)), z1 = Math.min(RZ - 1, Math.ceil(cz + rr));
  let changed = false;
  for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
    const dd = Math.hypot(ix - cx, iz - cz);
    if (dd >= rr) continue;
    const v = Math.round(255 * (1 - smooth(inner, rr, dd))), i = iz * RX + ix;
    if (v > rv[i]) { rv[i] = v; changed = true; }
  }
  if (changed) MAP.fogDirty = true;
  return changed;
}

// Every frame of play: ~4 Hz is plenty for a 12.5 m mask.
function mapRevealUpdate(dt) {
  if (!G || !PL.body) return;
  mapSyncOwner();
  MAP.revealT += dt || 0;
  if (MAP.revealT < 0.25) return;
  MAP.revealT = 0;
  if (GAME.inCave) return;                       // underground you learn nothing of the land above
  const p = PL.body.pos, above = TER.H ? Math.max(0, p.y - heightAt(p.x, p.z)) : 0;
  mapRevealAt(p.x, p.z, MAP_REVEAL_R + Math.min(above, 150) * 1.4);
}

function mapSerialize() {
  if (!G) return;
  mapSyncOwner();
  try {
    let s = '';
    for (let i = 0; i < MAP.reveal.length; i += 0x2000) s += String.fromCharCode.apply(null, MAP.reveal.subarray(i, i + 0x2000));
    G.mapReveal = btoa(s); G.mapRevealW = MAP_RVX;
  } catch (e) { console.error('map save', e); }
}

function mapDeserialize() {
  MAP.reveal.fill(0);
  MAP.owner = G || null;
  MAP.revealT = 0;
  if (G && typeof G.mapReveal === 'string' && G.mapReveal) {
    try {
      const s = atob(G.mapReveal), W = G.mapRevealW || 128;     // saves before Roa: a 128×128 mask over Buena's ±800
      if (s.length === MAP.reveal.length && W === MAP_RVX) for (let i = 0; i < s.length; i++) MAP.reveal[i] = s.charCodeAt(i);
      else if (s.length % W === 0) {
        // an older, smaller mask: same texel size, same north-west corner — copy it row by row
        const H = s.length / W, ox = Math.round((-WORLD.half - MAP_X0) / MAP_TEXEL), oz = Math.round((-WORLD.half - MAP_Z0) / MAP_TEXEL);
        for (let j = 0; j < H; j++) for (let k = 0; k < W; k++) {
          const tx = k + ox, tz = j + oz;
          if (tx >= 0 && tx < MAP_RVX && tz >= 0 && tz < MAP_RVZ) MAP.reveal[tz * MAP_RVX + tx] = s.charCodeAt(j * W + k);
        }
      }
    } catch (e) { /* a damaged map is just an unexplored one */ }
  }
  if (DEV && /[?&]reveal\b/.test(location.search)) MAP.reveal.fill(255);
  MAP.fogDirty = true;
}

// Fixed cloud texture that roughens the fog's edge (built once).
function mapFogNoise() {
  const FX = MAP_FOGX, FZ = MAP_FOGZ, out = new Float32Array(FX * FZ), n = Noise.make(WORLD.seed + 505);
  for (let y = 0; y < FZ; y++) for (let x = 0; x < FX; x++) out[y * FX + x] = clamp(fbm(n, x / 22, y / 22, 3) * 0.5 + 0.5, 0, 1);
  return out;
}

/* The mask → a parchment fog at twice its resolution: bilinear, pushed
   through a noisy threshold so the edge is torn cloud, with a sepia wash
   along it. Rebuilt lazily, only when the mask changed and someone draws. */
function mapFogRefresh() {
  if (!MAP.fog) {
    const cv = document.createElement('canvas');
    cv.width = MAP_FOGX; cv.height = MAP_FOGZ;
    MAP.fog = cv; MAP.fogCtx = cv.getContext('2d'); MAP.fogImg = MAP.fogCtx.createImageData(MAP_FOGX, MAP_FOGZ);
    MAP.fogDirty = true;
  }
  if (!MAP.fogDirty) return;
  if (!MAP.fogNoise) MAP.fogNoise = mapFogNoise();
  MAP.fogDirty = false;
  const FX = MAP_FOGX, FZ = MAP_FOGZ, RX = MAP_RVX, RZ = MAP_RVZ, rv = MAP.reveal, nz = MAP.fogNoise, d = MAP.fogImg.data;
  const kx = RX / FX, kz = RZ / FZ;
  for (let y = 0; y < FZ; y++) {
    const fy = clamp((y + 0.5) * kz - 0.5, 0, RZ - 1.001), iy = fy | 0, ty = fy - iy;
    for (let x = 0; x < FX; x++) {
      const fx = clamp((x + 0.5) * kx - 0.5, 0, RX - 1.001), ix = fx | 0, tx = fx - ix, i = iy * RX + ix;
      const v = ((rv[i] * (1 - tx) + rv[i + 1] * tx) * (1 - ty) + (rv[i + RX] * (1 - tx) + rv[i + RX + 1] * tx) * ty) / 255;
      const n = nz[y * FX + x], s = clamp((v - 0.5 + (n - 0.5) * 0.5) * 2.6 + 0.5, 0, 1);
      const a = 1 - s * s * (3 - 2 * s), rim = Math.max(0, 1 - Math.abs(a - 0.5) * 3.2);
      const tone = (0.95 + (n - 0.5) * 0.12) * (1 - rim * 0.2), o = (y * FX + x) * 4;
      d[o] = 228 * tone; d[o + 1] = 216 * tone; d[o + 2] = 188 * tone; d[o + 3] = a * 248;
    }
  }
  MAP.fogCtx.putImageData(MAP.fogImg, 0, 0);
}

/* ───────────── the map screen ───────────── */
const MAP_CSS = `
#mapScreen{position:fixed;inset:0;z-index:45;display:none;overflow:hidden;user-select:none;touch-action:none;
  background:radial-gradient(ellipse at 50% 42%,#1d1b2e 0%,#0b0d18 60%,#04050a 100%)}
#mapScreen.on{display:block;animation:mapIn .32s ease-out}
@keyframes mapIn{from{opacity:0}to{opacity:1}}
#mapCanvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab}
#mapScreen.drag #mapCanvas{cursor:grabbing}
#mapScreen button{min-width:0;padding:8px 18px;font-size:11px;letter-spacing:.22em}
#mapCloseBtn{position:absolute;top:16px;right:18px;width:42px;height:42px;padding:0!important;font-size:22px!important;letter-spacing:0!important;line-height:1}
#mapLegend{position:absolute;left:20px;bottom:54px;padding:9px 16px 7px;cursor:pointer;
  background:linear-gradient(180deg,rgba(10,12,26,.88),rgba(6,7,16,.94));border:1px solid rgba(201,162,39,.35);box-shadow:0 18px 50px rgba(0,0,0,.5)}
#mapLegend:not(.open) div{display:none}
#mapLegend:not(.open) h4{margin:0}
#mapLegend h4::after{content:" ▸";color:var(--dim,#a99d80)}
#mapLegend.open h4::after{content:" ▾"}
#mapLegend h4{margin:0 0 6px;text-align:center;font:700 11px var(--display,'Cinzel',Georgia,serif);letter-spacing:.32em;text-transform:uppercase;color:var(--gold,#c9a227)}
#mapLegend div{display:flex;align-items:center;gap:10px;font:italic 400 13px/1.85 var(--body,'Spectral',Georgia,serif);color:var(--parch,#e6dcc2)}
#mapLegend svg{width:22px;height:16px;flex:none;overflow:visible}
#mapHint{position:absolute;left:50%;transform:translateX(-50%);bottom:14px;width:max-content;max-width:92vw;text-align:center;pointer-events:none;font:italic 400 13px var(--body,'Spectral',Georgia,serif);
  color:var(--parch,#e6dcc2);letter-spacing:.03em;padding:6px 16px;background:rgba(8,9,18,.8);border:1px solid rgba(201,162,39,.3)}
#mapTravel{position:absolute;display:none;transform:translate(-50%,calc(-100% - 26px));padding:14px 18px 12px;text-align:center;white-space:nowrap;
  background:linear-gradient(180deg,rgba(14,17,34,.95),rgba(6,7,16,.97));border:1px solid rgba(240,207,98,.55);box-shadow:0 16px 44px rgba(0,0,0,.6),0 0 34px rgba(90,169,230,.2)}
#mapTravel.on{display:block}
#mapTravel::after{content:'';position:absolute;left:50%;bottom:-7px;width:12px;height:12px;background:#07080f;border:solid rgba(240,207,98,.55);border-width:0 1px 1px 0;transform:translateX(-50%) rotate(45deg)}
#mapTravel .q{font:italic 400 15px var(--body,'Spectral',Georgia,serif);color:var(--parch,#e6dcc2);margin-bottom:11px}
#mapTravel .q b{font:700 13px var(--display,'Cinzel',Georgia,serif);letter-spacing:.14em;text-transform:uppercase;color:var(--hot,#f0cf62)}
#mapTravel .b{display:flex;gap:8px;justify-content:center}
#mapTravel .why{display:none;font:italic 400 13px var(--body,'Spectral',Georgia,serif);color:#e8907a;margin:-4px 0 10px}
#mapTravel.blocked .why{display:block}
#mapTravel.blocked #mapTravelGo{display:none}
`;
const MAP_RUNE_SVG = '<path d="M11 1.5L16 8L11 14.5L6 8Z"';

function mapEnsureDom() {
  if (MAP.el) return;
  const st = document.createElement('style');
  st.id = 'mapStyle'; st.textContent = MAP_CSS;
  document.head.appendChild(st);
  const el = MAP.el = document.createElement('div');
  el.id = 'mapScreen';
  el.innerHTML = `<canvas id="mapCanvas"></canvas>
    <button id="mapCloseBtn" title="Close">×</button>
    <div id="mapLegend"><h4>Legend</h4>
      <div><svg viewBox="0 0 22 16"><path d="M11 1L17 14L11 10.5L5 14Z" fill="#f0cf62" stroke="#4a3608"/></svg>You</div>
      <div><svg viewBox="0 0 22 16"><circle cx="11" cy="8" r="8" fill="rgba(90,169,230,.35)"/>${MAP_RUNE_SVG} fill="#1d3550" stroke="#bfe3ff"/><path d="M11 4.5V11.5" stroke="#8fd0ff"/></svg>Waystone — click to travel</div>
      <div><svg viewBox="0 0 22 16">${MAP_RUNE_SVG} fill="#6f685c" stroke="#3b352c"/></svg>Dormant waystone</div>
      <div><svg viewBox="0 0 22 16"><path d="M11 1.5L17 8L11 14.5L5 8Z" fill="#f0cf62" stroke="#5a420c"/></svg>Objective</div>
      <div><svg viewBox="0 0 22 16"><path d="M1 8H21" stroke="#c49a6c" stroke-width="2" stroke-dasharray="4 3"/></svg>Road</div>
      <div><svg viewBox="0 0 22 16"><circle cx="7" cy="9" r="4.5" fill="#5f7d3d"/><circle cx="13" cy="8" r="5" fill="#6f8f45"/><path d="M19 13H22L20.5 7Z" fill="#41593a"/></svg>Woodland</div>
      <div><svg viewBox="0 0 22 16"><rect x="5" y="4" width="12" height="8" fill="#9a4434" stroke="#3b2216"/><path d="M5 8H17" stroke="#5e2a20"/></svg>Dwelling</div>
      <div><svg viewBox="0 0 22 16"><path d="M1 8H6M11 8H16" stroke="#e6dcc2" stroke-width="3"/><path d="M6 8H11M16 8H21" stroke="#8a7350" stroke-width="3"/></svg>Border · 100 m</div>
    </div>
    <div id="mapTravel"><div class="q">Travel to <b id="mapTravelName"></b>?</div><div class="why" id="mapTravelWhy"></div>
      <div class="b"><button id="mapTravelGo" class="primary">Travel</button><button id="mapTravelNo">Cancel</button></div></div>
    <div id="mapHint"><kbd>M</kbd> / <kbd>Esc</kbd> — close · Drag to pan · Wheel to zoom · Click a waystone to travel</div>`;
  document.body.appendChild(el);
  const cv = MAP.cv = $('mapCanvas');
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0 || MAP.travelling) return;
    const [x, y] = pos(e);
    MAP.drag = { id: e.pointerId, x, y, cx: MAP.view.cx, cz: MAP.view.cz, moved: false };
    MAP.view.tz = MAP.view.zoom;                                   // a grab stops any zoom glide
    cv.style.cursor = '';
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
  });
  cv.addEventListener('pointermove', e => {
    const [x, y] = pos(e), D = MAP.drag, f = MAP.frame;
    if (!f) return;
    if (D) {
      const dx = x - D.x, dy = y - D.y;
      if (!D.moved && dx * dx + dy * dy > 25) { D.moved = true; el.classList.add('drag'); }
      if (D.moved) { MAP.view.cx = D.cx - dx / f.s; MAP.view.cz = D.cz - dy / f.s; }
    } else {
      const w = mapHitWaystone(x, y);
      MAP.hover = w ? w.id : null;
      cv.style.cursor = w ? 'pointer' : '';
    }
  });
  const end = e => {
    const D = MAP.drag;
    if (!D || D.id !== e.pointerId) return;
    MAP.drag = null; el.classList.remove('drag');
    if (!D.moved && e.type === 'pointerup') { const [x, y] = pos(e); mapClick(x, y); }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e => {
    e.preventDefault(); e.stopPropagation();                      // the camera's wheel zoom stays out of it
    const f = MAP.frame, v = MAP.view;
    if (!f || MAP.travelling) return;
    const [x, y] = pos(e), dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
    v.tz = clamp(v.tz * Math.exp(-dy * 0.0022), MAP_ZOOM.min, MAP_ZOOM.max);
    // pin the world point under the cursor while the zoom glides there
    v.sx = x; v.sy = y; v.ax = (x - f.ox) / f.s; v.az = (y - f.oy) / f.s;
  }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  $('mapLegend').onclick = () => { $('mapLegend').classList.toggle('open'); BUS.emit('sfx', { id: 'uiSelect' }); };
  $('mapTravelGo').onclick = () => mapTravel();
  $('mapTravelNo').onclick = () => { BUS.emit('sfx', { id: 'uiSelect' }); MAP.sel = null; };
  $('mapCloseBtn').onclick = () => { BUS.emit('sfx', { id: 'uiSelect' }); mapClose(); };
}

function mapOpen() {
  document.exitPointerLock?.();
  mapEnsureDom();
  if (!MAP.canvas && TER.H) { try { mapBuild(); } catch (e) { console.error('map', e); } }
  if (G) mapSyncOwner();
  if (MAP.open) return;
  MAP.open = true; MAP.travelling = false; MAP.sel = null; MAP.hover = null; MAP.drag = null;
  MAP.frame = null; MAP.lastT = 0; MAP.err = false;
  const v = MAP.view, p = G && PL.body ? PL.body.pos : null;
  v.cx = p ? p.x : 0; v.cz = p ? p.z : 0; v.zoom = v.tz = MAP_ZOOM.open;
  MAP.el.classList.add('on');
  BUS.emit('sfx', { id: 'page' });
  if (!MAP.raf) MAP.raf = requestAnimationFrame(mapLoop);
}
// Just hides. GAME.state belongs to the caller (menus) or the main loop.
function mapClose() {
  MAP.open = false; MAP.travelling = false; MAP.drag = null; MAP.sel = null; MAP.hover = null;
  if (MAP.raf) { cancelAnimationFrame(MAP.raf); MAP.raf = 0; }
  if (MAP.el) { MAP.el.classList.remove('on', 'drag'); $('mapTravel').classList.remove('on'); }
}
function mapIsOpen() { return MAP.open; }

function mapLoop(now) {
  MAP.raf = 0;
  if (!MAP.open) return;
  // fastTravel flips GAME.state to 'play' once the screen is black: the map leaves under the fade
  if (MAP.travelling && GAME.state !== 'map') { mapClose(); return; }
  const dt = MAP.lastT ? Math.min(0.05, Math.max(0, (now - MAP.lastT) / 1000)) : 0;
  MAP.lastT = now;
  try { mapStep(dt); mapDraw(now / 1000); }
  catch (e) { if (!MAP.err) { MAP.err = true; console.error('map', e); } }
  if (MAP.open) MAP.raf = requestAnimationFrame(mapLoop);
}

function mapClick(x, y) {
  const w = mapHitWaystone(x, y);
  if (w) {
    MAP.sel = w; $('mapTravelName').textContent = w.name; BUS.emit('sfx', { id: 'uiSelect' });
    const why = typeof travelBlock === 'function' ? travelBlock() : null;
    $('mapTravel').classList.toggle('blocked', !!why); $('mapTravelWhy').textContent = why || '';
  }
  else MAP.sel = null;
}

function mapTravel() {
  const w = MAP.sel;
  if (!w || MAP.travelling || (typeof travelBlock === 'function' && travelBlock())) return;
  BUS.emit('sfx', { id: 'uiSelect' });
  MAP.sel = null;
  if (typeof fastTravel !== 'function' || !G || !G.waystones || !G.waystones[w.id]) { mapClose(); return; }
  MAP.travelling = true;
  // fastTravel handles screens, state and the fade; if it bails early, close anyway
  Promise.resolve(fastTravel(w.id)).catch(e => console.error('map travel', e))
    .finally(() => { if (MAP.open && MAP.travelling) mapClose(); });
}

const mapBaseScale = (vw, vh) => Math.min(vw / MAP_W, vh / MAP_H) * 0.92;   // screen px per metre at 1× (whole sheet in view)
const mapUiScale = (vw, vh) => clamp(Math.min(vw, vh) / 900, 0.8, 1.5);

function mapClampView(vw, vh) {
  const v = MAP.view, s = mapBaseScale(vw, vh) * v.zoom, hw = vw / 2 / s, hh = vh / 2 / s;
  // each axis: centre the sheet if it fits, otherwise keep it on screen (40 m of table allowed)
  v.cx = 2 * hw >= MAP_W + 80 ? (MAP_X0 + MAP_X1) / 2 : clamp(v.cx, MAP_X0 - 40 + hw, MAP_X1 + 40 - hw);
  v.cz = 2 * hh >= MAP_H + 80 ? (MAP_Z0 + MAP_Z1) / 2 : clamp(v.cz, MAP_Z0 - 40 + hh, MAP_Z1 + 40 - hh);
}

// Smooth wheel zoom that keeps the anchored world point under the cursor.
function mapStep(dt) {
  const v = MAP.view, f = MAP.frame;
  if (!f || Math.abs(v.tz - v.zoom) < 0.002) { v.zoom = v.tz; return; }
  v.zoom = damp(v.zoom, v.tz, 16, dt);
  const s = mapBaseScale(f.vw, f.vh) * v.zoom;
  v.cx = v.ax - (v.sx - f.vw / 2) / s; v.cz = v.az - (v.sy - f.vh / 2) / s;
}

function mapHitWaystone(x, y) {
  const f = MAP.frame;
  if (!f || !G || !G.waystones) return null;
  let best = null, bd = (18 * f.k) ** 2;
  for (const w of mapWaystones()) {
    if (!G.waystones[w.id]) continue;
    const dx = f.ox + w.x * f.s - x, dy = f.oy + w.z * f.s - y, dd = dx * dx + dy * dy;
    if (dd < bd) { bd = dd; best = w; }
  }
  return best;
}

// Copy the world rect [wx, wx+ww]×[wz, wz+wh] (already inside the map) of a square map image.
function mapBlit(ctx, img, wx, wz, ww, wh, dx, dy, s) {
  const kx = img.width / MAP_W, kz = img.height / MAP_H;      // image px per metre (the sheet, or its fog)
  ctx.drawImage(img, (wx - MAP_X0) * kx, (wz - MAP_Z0) * kz, ww * kx, wh * kz, dx, dy, ww * s, wh * s);
}

function mapDraw(t) {
  const cv = MAP.cv, vw = cv.clientWidth || innerWidth, vh = cv.clientHeight || innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(vw * dpr), Hh = Math.round(vh * dpr);
  if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  mapClampView(vw, vh);
  const v = MAP.view, s = mapBaseScale(vw, vh) * v.zoom;
  const f = MAP.frame = { vw, vh, s, ox: vw / 2 - v.cx * s, oy: vh / 2 - v.cz * s, k: mapUiScale(vw, vh) };  // screen = o + world·s
  // the sheet, lifted off the table (its shadow only matters while an edge is in view)
  const sx0 = f.ox + MAP_X0 * s, sy0 = f.oy + MAP_Z0 * s, sw = MAP_W * s, sh = MAP_H * s;
  if (sx0 > 0 || sy0 > 0 || sx0 + sw < vw || sy0 + sh < vh) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
    ctx.fillStyle = MAP_COL.parch; ctx.fillRect(sx0, sy0, sw, sh);
    ctx.restore();
  }
  // painted map, then its fog — only the part on screen
  const wx0 = Math.max(MAP_X0, -f.ox / s), wz0 = Math.max(MAP_Z0, -f.oy / s), wx1 = Math.min(MAP_X1, (vw - f.ox) / s), wz1 = Math.min(MAP_Z1, (vh - f.oy) / s);
  if (wx1 > wx0 && wz1 > wz0) {
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = s < MAP_PPM ? 'high' : 'medium';
    if (MAP.canvas) mapBlit(ctx, MAP.canvas, wx0, wz0, wx1 - wx0, wz1 - wz0, f.ox + wx0 * s, f.oy + wz0 * s, s);
    mapFogRefresh();
    mapBlit(ctx, MAP.fog, wx0, wz0, wx1 - wx0, wz1 - wz0, f.ox + wx0 * s, f.oy + wz0 * s, s);
  }
  mapDrawLabels(ctx, f);
  mapDrawBorder(ctx, f);
  mapDrawCompass(ctx, f.ox + (MAP_X1 - 150) * s, f.oy + (MAP_Z1 - 150) * s, 70 * s);
  mapDrawCartouche(ctx, f);
  mapDrawMarkers(ctx, f, t);
  // the travel panel rides above its waystone
  const panel = $('mapTravel');
  if (!MAP.sel || MAP.travelling) panel.classList.remove('on');
  else {
    panel.classList.add('on');
    panel.style.left = clamp(f.ox + MAP.sel.x * s, 130, vw - 130) + 'px';
    panel.style.top = clamp(f.oy + MAP.sel.z * s - 14 * f.k, 120, vh - 10) + 'px';
  }
}

/* ───────────── drawing helpers (screen space) ───────────── */
// Letter-spaced, centred text with a halo: native letterSpacing where the
// browser has it, glyph by glyph where it doesn't.
function mapMeasure(ctx, str, font, sp) {
  ctx.font = font;
  if ('letterSpacing' in ctx) { ctx.letterSpacing = sp + 'px'; const w = ctx.measureText(str).width - sp; ctx.letterSpacing = '0px'; return w; }
  let w = -sp;
  for (const ch of str) w += ctx.measureText(ch).width + sp;
  return w;
}
function mapText(ctx, str, x, y, font, sp, fill, halo, haloW) {
  const native = 'letterSpacing' in ctx, x0 = x - mapMeasure(ctx, str, font, sp) / 2;
  ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  if (native) ctx.letterSpacing = sp + 'px';
  const run = draw => {
    if (native) { draw(str, x0); return; }
    let cx = x0;
    for (const ch of str) { draw(ch, cx); cx += ctx.measureText(ch).width + sp; }
  };
  if (halo) { ctx.lineJoin = 'round'; ctx.lineWidth = haloW; ctx.strokeStyle = halo; run((s, cx) => ctx.strokeText(s, cx, y)); }
  ctx.fillStyle = fill; run((s, cx) => ctx.fillText(s, cx, y));
  if (native) ctx.letterSpacing = '0px';
}

// Place names fade in with the ground they name; sizes grow with √zoom.
function mapDrawLabels(ctx, f) {
  const zs = f.k * Math.sqrt(MAP.view.zoom);
  for (const key in PLACES) {
    const p = PLACES[key], o = MAP_LABELS[key] || { dz: -30 }, a = smooth(0.3, 0.75, mapSeen(p.x, p.z));
    if (a <= 0.01 || o.hide) continue;
    const px = MAP_LABEL_PX[o.size || 'small'] * zs, X = f.ox + (p.x + (o.dx || 0)) * f.s, Y = f.oy + (p.z + (o.dz || 0)) * f.s;
    if (X < -400 || X > f.vw + 400 || Y < -80 || Y > f.vh + 80) continue;
    ctx.globalAlpha = a;
    // water names in blue-black ink, the rest in brown-black
    mapText(ctx, p.name.toUpperCase(), X, Y, `700 ${px}px Cinzel, Georgia, serif`, px * (o.spread ?? 0.22), o.water ? '#24435c' : MAP_COL.ink, MAP_COL.halo, px * 0.34);
    if (p.sub) mapText(ctx, p.sub, X, Y + px * 1.1, `italic 400 ${px * 0.78}px Spectral, Georgia, serif`, 0.4, '#4a3c28', MAP_COL.halo, px * 0.28);
  }
  ctx.globalAlpha = 1;
}

// Double border: heavy and fine rules, an ink scale every 100 m between, gold hairline, corner bosses.
function mapDrawBorder(ctx, f) {
  const s = f.s, x0 = f.ox + MAP_X0 * s, y0 = f.oy + MAP_Z0 * s, LX = MAP_W * s, LZ = MAP_H * s;
  const i1 = 6 * s, i2 = 16 * s, seg = 100 * s, mid = (i1 + i2) / 2, th = (i2 - i1) * 0.38;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 + i1, y0 + i1, LX - 2 * i1, LZ - 2 * i1); ctx.rect(x0 + i2, y0 + i2, LX - 2 * i2, LZ - 2 * i2);
  ctx.fillStyle = '#ebe2c8'; ctx.fill('evenodd');
  ctx.clip('evenodd');
  ctx.fillStyle = 'rgba(52,38,24,0.85)';
  for (let i = 0; i < MAP_W / 100; i += 2) {                       // ink every other 100 m, top and bottom
    const a = i * seg;
    ctx.fillRect(x0 + a, y0 + mid - th / 2, seg, th); ctx.fillRect(x0 + a, y0 + LZ - mid - th / 2, seg, th);
  }
  for (let i = 0; i < MAP_H / 100; i += 2) {                       // …and down both sides
    const a = i * seg;
    ctx.fillRect(x0 + mid - th / 2, y0 + a, th, seg); ctx.fillRect(x0 + LX - mid - th / 2, y0 + a, th, seg);
  }
  ctx.restore();
  ctx.strokeStyle = MAP_COL.rule;
  ctx.lineWidth = Math.max(1.4, 2.4 * s); ctx.strokeRect(x0 + i1, y0 + i1, LX - 2 * i1, LZ - 2 * i1);
  ctx.lineWidth = Math.max(0.8, s); ctx.strokeRect(x0 + i2, y0 + i2, LX - 2 * i2, LZ - 2 * i2);
  ctx.strokeStyle = 'rgba(201,162,39,0.8)'; ctx.lineWidth = Math.max(1, 1.2 * s);
  ctx.strokeRect(x0 + 2 * s, y0 + 2 * s, LX - 4 * s, LZ - 4 * s);
  const r = (i2 - i1) * 0.9;
  for (const [cx, cy] of [[x0 + mid, y0 + mid], [x0 + LX - mid, y0 + mid], [x0 + mid, y0 + LZ - mid], [x0 + LX - mid, y0 + LZ - mid]]) {
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath();
    ctx.fillStyle = MAP_COL.rule; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.35, 0, TAU); ctx.fillStyle = MAP_COL.gold; ctx.fill();
  }
}

// An engraved eight-point rose; each point split into a lit and a shaded half.
function mapDrawCompass(ctx, cx, cy, R) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(236,227,202,0.6)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(52,38,24,0.85)'; ctx.lineWidth = Math.max(1, R * 0.025); ctx.stroke();
  ctx.lineWidth = Math.max(0.6, R * 0.012);
  ctx.beginPath(); ctx.arc(0, 0, R * 0.84, 0, TAU);
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * TAU, l = 0.84 - (i % 8 === 0 ? 0.16 : i % 2 ? 0.05 : 0.1);
    ctx.moveTo(Math.sin(a) * R * 0.84, -Math.cos(a) * R * 0.84); ctx.lineTo(Math.sin(a) * R * l, -Math.cos(a) * R * l);
  }
  ctx.stroke();
  const point = (a, len, w) => {
    const tx = Math.sin(a) * len, ty = -Math.cos(a) * len, px = Math.cos(a) * w, py = Math.sin(a) * w;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(tx, ty); ctx.lineTo(px, py); ctx.closePath(); ctx.fillStyle = MAP_COL.rule; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(tx, ty); ctx.lineTo(-px, -py); ctx.closePath(); ctx.fillStyle = '#e9dcb8'; ctx.fill();
    ctx.strokeStyle = MAP_COL.rule; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.lineTo(-px, -py); ctx.stroke();
  };
  for (let i = 0; i < 4; i++) point(Math.PI / 4 + i * Math.PI / 2, R * 0.5, R * 0.1);
  for (let i = 0; i < 4; i++) point(i * Math.PI / 2, R * 0.8, R * 0.14);
  ctx.beginPath(); ctx.arc(0, 0, R * 0.06, 0, TAU); ctx.fillStyle = MAP_COL.gold; ctx.fill(); ctx.stroke();
  const fs = Math.max(8, R * 0.24);
  for (const [l, dx, dy] of [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]]) {
    const big = l === 'N' ? 1.25 : 1;
    mapText(ctx, l, dx * R * 1.18, dy * R * 1.18, `700 ${fs * big}px Cinzel, Georgia, serif`, 0, l === 'N' ? MAP_COL.blood : MAP_COL.ink, MAP_COL.halo, fs * 0.3);
  }
  ctx.restore();
}

// The title ribbon, top-left: notched ends, ink and gold rules, title fitted to the room.
function mapDrawCartouche(ctx, f) {
  const s = f.s, w = 210 * s, h = 34 * s, nd = h * 0.85;
  const ribbon = ins => {
    const W = w - ins, Hh = h - ins;
    ctx.beginPath(); ctx.moveTo(-W, -Hh); ctx.lineTo(W, -Hh); ctx.lineTo(W - nd, 0); ctx.lineTo(W, Hh); ctx.lineTo(-W, Hh); ctx.lineTo(-W + nd, 0); ctx.closePath();
  };
  ctx.save();
  ctx.translate(f.ox + (MAP_X0 + 238) * s + 2 * s, f.oy + (MAP_Z0 + 58) * s + 3 * s);   // the sheet's top-left corner
  ribbon(0); ctx.fillStyle = 'rgba(30,20,10,0.3)'; ctx.fill();
  ctx.translate(-2 * s, -3 * s);
  ribbon(0); ctx.fillStyle = '#f0e7cf'; ctx.fill();
  ctx.strokeStyle = MAP_COL.rule; ctx.lineWidth = Math.max(1.2, 2 * s); ctx.stroke();
  ribbon(5 * s); ctx.strokeStyle = MAP_COL.gold; ctx.lineWidth = Math.max(0.8, s); ctx.stroke();
  const title = 'THE BORDERLANDS OF FITTOA', font = p => `700 ${p}px Cinzel, Georgia, serif`;
  let px = 17 * s;
  const room = 2 * (w - nd) - 16 * s, tw = mapMeasure(ctx, title, font(px), px * 0.16);
  if (tw > room) px *= room / tw;
  mapText(ctx, title, 0, -h * 0.18, font(px), px * 0.16, MAP_COL.ink, null, 0);
  mapText(ctx, 'The Asura Kingdom', 0, h * 0.5, `italic 400 ${10.5 * s}px Spectral, Georgia, serif`, 0.5, '#5a4630', null, 0);
  ctx.strokeStyle = 'rgba(90,70,48,0.7)'; ctx.lineWidth = Math.max(0.6, 0.8 * s); ctx.beginPath();
  ctx.moveTo(-70 * s, h * 0.5); ctx.lineTo(-48 * s, h * 0.5); ctx.moveTo(48 * s, h * 0.5); ctx.lineTo(70 * s, h * 0.5);
  ctx.stroke();
  ctx.restore();
}

// A waystone: a standing stone with a rune; awakened ones glow mana-blue.
function mapRune(ctx, X, Y, k, lit, t) {
  const r = 9 * k;
  if (lit) {
    const gr = r * 2.6 * (1 + 0.08 * Math.sin(t * 3)), g = ctx.createRadialGradient(X, Y, 0, X, Y, gr);
    g.addColorStop(0, 'rgba(90,169,230,0.6)'); g.addColorStop(1, 'rgba(90,169,230,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, gr, 0, TAU); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(X, Y - r * 1.25); ctx.lineTo(X + r * 0.8, Y); ctx.lineTo(X, Y + r * 1.25); ctx.lineTo(X - r * 0.8, Y); ctx.closePath();
  ctx.fillStyle = lit ? '#1d3550' : '#6f685c'; ctx.fill();
  ctx.lineWidth = 1.4 * k; ctx.strokeStyle = lit ? '#bfe3ff' : '#3b352c'; ctx.stroke();
  ctx.strokeStyle = lit ? '#8fd0ff' : '#b8b0a0'; ctx.lineWidth = 1.5 * k; ctx.beginPath();
  ctx.moveTo(X, Y - r * 0.65); ctx.lineTo(X, Y + r * 0.65);
  ctx.moveTo(X - r * 0.35, Y - r * 0.1); ctx.lineTo(X, Y - r * 0.42); ctx.lineTo(X + r * 0.35, Y - r * 0.1);
  ctx.moveTo(X - r * 0.3, Y + r * 0.35); ctx.lineTo(X, Y + r * 0.1); ctx.lineTo(X + r * 0.3, Y + r * 0.35);
  ctx.stroke();
}

// The objective: a bobbing gold diamond in a soft glow.
function mapDiamond(ctx, X, Y, k, t) {
  const r = 9 * k, y = Y + Math.sin(t * 2.6) * 2 * k, g = ctx.createRadialGradient(X, y, 0, X, y, r * 2.6);
  g.addColorStop(0, 'rgba(240,207,98,0.55)'); g.addColorStop(1, 'rgba(240,207,98,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, y, r * 2.6, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(X, y - r * 1.3); ctx.lineTo(X + r, y); ctx.lineTo(X, y + r * 1.3); ctx.lineTo(X - r, y); ctx.closePath();
  ctx.fillStyle = MAP_COL.hot; ctx.fill(); ctx.lineWidth = 1.6 * k; ctx.strokeStyle = '#5a420c'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X, y - r * 0.55); ctx.lineTo(X + r * 0.42, y); ctx.lineTo(X, y + r * 0.55); ctx.lineTo(X - r * 0.42, y); ctx.closePath();
  ctx.fillStyle = '#fff3c4'; ctx.fill();
}

// You: a gold arrow along PL.face — direction (sin f, cos f) in x/z, so rotate by π − f — with a pulse.
function mapArrow(ctx, X, Y, face, k, t) {
  const ph = (t % 1.6) / 1.6, sc = k * (1 + 0.07 * Math.sin(t * 5));
  ctx.beginPath(); ctx.arc(X, Y, (9 + ph * 20) * k, 0, TAU);
  ctx.strokeStyle = `rgba(240,207,98,${((1 - ph) * 0.75).toFixed(3)})`; ctx.lineWidth = 2 * k; ctx.stroke();
  for (let pass = 0; pass < 2; pass++) {                       // shadow first, cast to the south-east
    ctx.save();
    ctx.translate(X + (pass ? 0 : 1.5 * k), Y + (pass ? 0 : 2.2 * k)); ctx.rotate(Math.PI - face); ctx.scale(sc, sc);
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(8.5, 9); ctx.lineTo(0, 4.5); ctx.lineTo(-8.5, 9); ctx.closePath();
    if (!pass) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); }
    else {
      const g = ctx.createLinearGradient(0, -13, 0, 9);
      g.addColorStop(0, '#fff1b8'); g.addColorStop(0.5, MAP_COL.hot); g.addColorStop(1, MAP_COL.gold);
      ctx.fillStyle = g; ctx.fill(); ctx.lineJoin = 'round'; ctx.lineWidth = 1.5; ctx.strokeStyle = '#4a3608'; ctx.stroke();
    }
    ctx.restore();
  }
}

function mapQuest() {
  if (!G || typeof questMarker !== 'function') return null;
  try { const q = questMarker(); return q && isFinite(q.x) && isFinite(q.z) ? q : null; } catch (e) { return null; }
}

function mapDrawMarkers(ctx, f, t) {
  const k = f.k, inside = (X, Y, m) => X > m && Y > m && X < f.vw - m && Y < f.vh - m;
  // waystones: awakened ones glow and travel; dormant ones show once their ground is seen
  for (const w of mapWaystones()) {
    const lit = !!(G && G.waystones && G.waystones[w.id]);
    if (!lit && mapSeen(w.x, w.z) < 0.5) continue;
    const X = f.ox + w.x * f.s, Y = f.oy + w.z * f.s;
    if (!inside(X, Y, -40)) continue;
    const hot = lit && (MAP.hover === w.id || (MAP.sel && MAP.sel.id === w.id));
    mapRune(ctx, X, Y, k * (hot ? 1.25 : 1), lit, t);
    if (hot) mapText(ctx, w.name.toUpperCase(), X, Y + 26 * k, `700 ${11 * k}px Cinzel, Georgia, serif`, 2 * k, MAP_COL.parch, 'rgba(11,13,24,0.85)', 4 * k);
  }
  // the objective — pinned to the screen edge with a chevron when it's out of view
  const q = mapQuest();
  if (q) {
    const X = f.ox + q.x * f.s, Y = f.oy + q.z * f.s, m = 34 * k;
    if (inside(X, Y, m)) {
      mapDiamond(ctx, X, Y, k, t);
      if (q.label) mapText(ctx, q.label, X, Y + 28 * k, `italic 400 ${13 * k}px Spectral, Georgia, serif`, 0.3, MAP_COL.ink, MAP_COL.halo, 4 * k);
    } else {
      const dx = X - f.vw / 2, dy = Y - f.vh / 2;
      const sc = Math.min((f.vw / 2 - m) / Math.abs(dx || 1e-6), (f.vh / 2 - m) / Math.abs(dy || 1e-6));
      const ex = f.vw / 2 + dx * sc, ey = f.vh / 2 + dy * sc;
      mapDiamond(ctx, ex, ey, k * 0.8, t);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(Math.atan2(dy, dx));
      ctx.beginPath(); ctx.moveTo(22 * k, 0); ctx.lineTo(13 * k, -6 * k); ctx.lineTo(13 * k, 6 * k); ctx.closePath();
      ctx.fillStyle = MAP_COL.hot; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#5a420c'; ctx.stroke();
      ctx.restore();
    }
  }
  // a tracked bounty: a blood-red star with its name
  const bm = G && typeof bountyMarker === 'function' ? bountyMarker() : null;
  if (bm) {
    const X = f.ox + bm.x * f.s, Y = f.oy + bm.z * f.s;
    if (inside(X, Y, 20 * k)) {
      const r = 9 * k * (1 + Math.sin(t * 3) * 0.06);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - Math.PI / 2, rr = i % 2 ? r * 0.42 : r; ctx.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = MAP_COL.blood; ctx.fill(); ctx.lineWidth = 1.2 * k; ctx.strokeStyle = MAP_COL.parch; ctx.stroke();
      mapText(ctx, bm.label, X, Y + 22 * k, `italic 400 ${12 * k}px Spectral, Georgia, serif`, 0.3, MAP_COL.blood, MAP_COL.halo, 4 * k);
    }
  }
  if (G && PL.body) mapArrow(ctx, f.ox + PL.body.pos.x * f.s, f.oy + PL.body.pos.z * f.s, PL.face, k, t);
}

/* ───────────── minimap ─────────────
   North-up disc centred on the player, zoomMetres from centre to rim.
   Draws into [0, size]² of ctx under whatever transform the caller set. */
function mapMinimapDraw(ctx, size, zoomMetres = 140) {
  if (!ctx || !(size > 0)) return;
  if (G) mapSyncOwner();
  const R = size / 2, zm = Math.max(20, zoomMetres || 140), s = R / zm, t = performance.now() / 1000;
  const p = G && PL.body ? PL.body.pos : null, cx = p ? p.x : 0, cz = p ? p.z : 0;
  const ox = R - cx * s, oy = R - cz * s, k = clamp(size / 180, 0.55, 1.2);
  ctx.save();
  ctx.beginPath(); ctx.arc(R, R, R, 0, TAU); ctx.clip();
  ctx.fillStyle = '#17151f'; ctx.fillRect(0, 0, size, size);
  const wx0 = Math.max(MAP_X0, cx - zm), wz0 = Math.max(MAP_Z0, cz - zm), wx1 = Math.min(MAP_X1, cx + zm), wz1 = Math.min(MAP_Z1, cz + zm);
  if (wx1 > wx0 && wz1 > wz0) {
    ctx.imageSmoothingEnabled = true;
    if (MAP.canvas) mapBlit(ctx, MAP.canvas, wx0, wz0, wx1 - wx0, wz1 - wz0, ox + wx0 * s, oy + wz0 * s, s);
    mapFogRefresh();
    mapBlit(ctx, MAP.fog, wx0, wz0, wx1 - wx0, wz1 - wz0, ox + wx0 * s, oy + wz0 * s, s);
  }
  if (G && G.waystones) for (const w of mapWaystones()) {
    if (!G.waystones[w.id]) continue;
    const X = ox + w.x * s, Y = oy + w.z * s;
    if ((X - R) ** 2 + (Y - R) ** 2 < (R - 6 * k) ** 2) mapRune(ctx, X, Y, k * 0.7, true, t);
  }
  const q = mapQuest();
  if (q) {                                                     // inside, or pinned to the rim
    let dx = (q.x - cx) * s, dy = (q.z - cz) * s;
    const d = Math.hypot(dx, dy), lim = R - 11 * k;
    if (d > lim) { dx *= lim / d; dy *= lim / d; }
    mapDiamond(ctx, R + dx, R + dy, k * 0.75, t);
  }
  if (p) mapArrow(ctx, R, R, PL.face, k * 0.85, t);
  ctx.restore();
  ctx.save();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(201,162,39,0.9)'; ctx.beginPath(); ctx.arc(R, R, R - 1, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(11,13,24,0.8)'; ctx.beginPath(); ctx.arc(R, R, R - 3, 0, TAU); ctx.stroke();
  mapText(ctx, 'N', R, 9 * k, `700 ${11 * k}px Cinzel, Georgia, serif`, 0, MAP_COL.blood, MAP_COL.halo, 3 * k);
  ctx.restore();
}
