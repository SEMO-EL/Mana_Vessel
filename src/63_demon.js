/* ═══════════════════════════════════════════════════════════════════════
   THE DEMON CONTINENT — Chapter III's waste, a strip of the same heightfield.

   The field runs on south of Fittoa (rows past WORLD.zF), walled off from
   it by mountains, and the strip is only raised when it's needed: under
   the white of the teleport, or at boot for a save that's already here.
   Everything else — physics, grass, water, the camera, AI — reads it like
   any other ground, because it IS the same ground.

   The waste is a rounded basin: the Migurd valley in the north-west (Roxy's
   people), a dry canyon down the west, the bones of something enormous in
   the middle, the storm plateau in the north-east, and the Sand Nest in a
   bowl in the east. A caravan track joins them in the order you'll walk it.
   ═══════════════════════════════════════════════════════════════════════ */
const DEMON = {
  zF: WORLD.zF,                                 // the seam with Fittoa's rows
  cx: 750, cz: 1800, hx: 640, hz: 390,          // the basin: a rounded rectangle, mountains past it
  px0: 150, px1: 1350, pz0: 1440, pz1: 2150,    // playable (soft wall)
  xr: [-500, 2000],                             // the columns raised in full (and given chunks); past them, far peaks
  built: false, building: null, ms: 0,
};
const DC_SPOTS = {
  wake:   { x: 290,  z: 2040, r: 26 },
  migurd: { x: 330,  z: 1600, r: 58 },
  bones:  { x: 720,  z: 1890, r: 42 },
  storm:  { x: 1090, z: 1640, r: 175 },
  nest:   { x: 1200, z: 1990, r: 64 },
};
// the caravan track: where you wake → the Migurd → the bones → up onto the storm plateau → down to the nest
const DC_TRACK = [
  [290, 2040], [318, 1960], [348, 1850], [352, 1730], [336, 1640], [330, 1600],
  [400, 1606], [470, 1632], [560, 1700], [640, 1790], [700, 1860], [770, 1872], [860, 1820],
  [950, 1745], [1030, 1690], [1100, 1668], [1160, 1730], [1196, 1830], [1204, 1918],
];
// a dry riverbed down the west of the waste, crossed by the track twice
const DC_CANYON = [[560, 1420], [575, 1520], [545, 1620], [590, 1720], [560, 1820], [610, 1930], [580, 2040], [640, 2160]];
const DC_NEST_FLOOR = 25;
// what flies over the waste: vultures over the bones and the nest, ash-crows over the Migurd, hawks above the canyon
// (19_wildlife builds every flock at boot; a flock's ground height is re-read once the strip is raised)
FLOCKS.push(
  { x: 720,  z: 1890, r: 46, h: 52, n: 5, col: '#2a2220', s: 2.0, w: 0.1,  glide: 0.94 },
  { x: 1200, z: 1990, r: 55, h: 60, n: 4, col: '#2a2220', s: 2.1, w: 0.09, glide: 0.95 },
  { x: 330,  z: 1600, r: 70, h: 40, n: 6, col: '#1c1a1e', s: 0.9, w: 0.25, glide: 0.4 },
  { x: 575,  z: 1760, r: 90, h: 70, n: 2, col: '#4a3428', s: 1.5, w: 0.08, glide: 0.95 },
);
BUS.on('demonBuilt', () => { for (const f of FLOCKS) if (inDemon(f.z)) f.gy = undefined; });
// the waste's names, for the banners (and the map, once it has a page for here)
Object.assign(PLACES, {
  dcWaste:  { x: 300,  z: 1990, r: 90,  name: 'The Red Waste',  sub: 'The Demon Continent' },
  migurd:   { x: 330,  z: 1600, r: 75,  name: 'Migurd Village', sub: 'Biegoya Region · The Demon Continent' },
  dcCanyon: { x: 575,  z: 1640, r: 40,  name: 'The Dry Canyon' },
  dcBones:  { x: 720,  z: 1890, r: 60,  name: 'The Bone Field', sub: 'Whatever it was, nothing ate it' },
  dcStorm:  { x: 1090, z: 1640, r: 150, name: 'The Storm Front', sub: 'The weather the Migurd warn you about' },
  dcNest:   { x: 1200, z: 1990, r: 80,  name: 'The Sand Nest' },
});

// which side of the seam a point is on (the strip starts a little past it: the seam itself is peaks)
const inDemon = z => z > DEMON.zF + 150;
// the steps of the story that happen over there (filled in by the chapter's story file)
const DC_QUESTS = new Set();
function savedInDemon() {
  const s = typeof loadGame === 'function' ? loadGame() : null;
  if (!s) return false;
  return DC_QUESTS.has(s.quest) || (Array.isArray(s.pos) && Number.isFinite(s.pos[2]) && inDemon(s.pos[2]));
}
const REGION = { k: 0, dc: false };
// the other continent is a world away: waystones, compass marks and travel only on your side of the seam
const sameSide = (z, ref = PL.body.pos.z) => inDemon(z) === inDemon(ref);
// a place counts toward "every place" once its ground exists (the waste's, once you've been sent there)
const placeCounts = k => DEMON.built || !inDemon(PLACES[k].z);
// how much of the storm plateau's weather a point is under (1 well inside it)
const dcStormW = (x, z) => 1 - smooth(DC_SPOTS.storm.r * 0.55, DC_SPOTS.storm.r + 30, Math.hypot(x - DC_SPOTS.storm.x, z - DC_SPOTS.storm.z));

/* ───────────── shape ───────────── */
// canyon distance for the strip's rows only (the river field is Fittoa's)
function dcCanyonAt(i) { const C = TER.DCC; if (!C) return 1e6; const k = i - TER.NZF * TER.NX; return k >= 0 && k < C.length ? C[k] : 1e6; }

function demonHeight(x, z, i, n) {
  const S = DC_SPOTS, td = TER.ROADD[i], cd = dcCanyonAt(i);
  // the basin's walls first: deep in them, nothing finer is worth the noise
  const u = (x - DEMON.cx) / DEMON.hx, v = (z - DEMON.cz) / DEMON.hz;
  const e = Math.pow(u * u * u * u + v * v * v * v, 0.25);
  const m = smooth(0.94, 1.12, e), m2 = smooth(1.06, 1.45, e);
  let h = 34 + fbm(n.a, x / 420, z / 420, 3) * 12;
  if (m2 < 0.999) {
    h += fbm(n.b, x / 120, z / 120, 3) * 3.5 + n.c(x / 26, z / 26) * 0.6;
    // landmarks keep their ground open
    let near = 0;
    for (const k in S) { const P = S[k]; if (k !== 'storm') near = Math.max(near, 1 - smooth(P.r, P.r + 50, Math.hypot(x - P.x, z - P.z))); }
    // mesas: flat-topped tables with cliff sides, a second tier on the biggest — never across the track or the canyon
    const wm = smooth(26, 70, td) * smooth(24, 52, cd) * (1 - near) * (1 - m);
    if (wm > 0.001) {
      const b = fbm(n.d, x / 210, z / 210, 2);
      h += wm * (smooth(0.2, 0.27, b) * (19 + n.c(x / 40, z / 40) * 1.5) + smooth(0.47, 0.53, b) * 11);
    }
    // the dry canyon: a sunk bed, banks you can walk down
    if (cd < 30) h -= 7.5 * (1 - smooth(5, 24, cd));
    // the storm plateau: higher ground, a long easy rise all round
    const ds = Math.hypot(x - S.storm.x, z - S.storm.z);
    h += 14 * (1 - smooth(S.storm.r * 0.62, S.storm.r * 1.05, ds));
    // the Sand Nest: a bowl, and a lip round it
    const dn = Math.hypot(x - S.nest.x, z - S.nest.z);
    if (dn < S.nest.r + 30) {
      h = lerp(h, DC_NEST_FLOOR + n.c(x / 18, z / 18) * 0.5, 1 - smooth(S.nest.r * 0.5, S.nest.r, dn));
      h += 3.5 * Math.exp(-Math.pow((dn - S.nest.r - 7) / 7, 2));
    }
    // the track: a worn bed
    if (td < ROAD_WIDTH + 6) h -= (1 - smooth(ROAD_WIDTH * 0.5, ROAD_WIDTH * 0.5 + 6, td)) * 0.3;
  }
  if (m > 0) h += m * (40 + fbm(n.d, x / 140, z / 140, 3) * 25);
  if (m2 > 0) h += m2 * (90 + ridged(n.e, x / 240, z / 240, 4) * 160);
  return h;
}

/* ───────────── colour ───────────── */
const DCOL = (() => {
  const C = hex => new THREE.Color(hex);
  return {
    earth: C('#7c5a48'), dust: C('#94704f'), dark: C('#4c3a34'), ash: C('#7d746e'), pale: C('#a99079'), rust: C('#8e4a33'),
    sand: C('#d2b07a'), sandDark: C('#b38d5d'), bed: C('#b99a78'), basalt: C('#3d3330'),
    rock: C('#7a5444'), rockDark: C('#4f3a33'), peak: C('#5e4a44'),
    track: C('#8c5e42'), trackPale: C('#a37554'), scrub: C('#6f6a45'), scrubDark: C('#545232'), storm: C('#4f4442'),
  };
})();
const _dc1 = new THREE.Color();
function demonColor(x, z, h, slope, i, nA, nB, out) {
  const S = DC_SPOTS, v1 = nA(x / 45, z / 45), v2 = nB(x / 12, z / 12);
  // brown earth and dusty ochre, darker patches, ash streaks, bleached clay flats — and rust, in places
  out.copy(DCOL.earth).lerp(DCOL.dust, smooth(-0.2, 0.7, v1)).lerp(DCOL.dark, smooth(0.25, 0.85, -v1) * 0.5);
  out.lerp(DCOL.ash, smooth(0.3, 0.9, v2) * 0.35);
  const big = nA(x / 160 + 7.3, z / 160 - 2.1);
  out.lerp(DCOL.pale, smooth(0.25, 0.6, big) * 0.55);
  out.lerp(DCOL.rust, smooth(0.3, 0.7, -big) * 0.5);
  // the Migurd valley: hardy scrub round the village
  const dm = Math.hypot(x - S.migurd.x, z - S.migurd.z);
  if (dm < 170) out.lerp(_dc1.copy(DCOL.scrub).lerp(DCOL.scrubDark, smooth(-0.3, 0.6, v2)), (1 - smooth(55, 165, dm)) * (0.45 + 0.25 * smooth(-0.4, 0.5, v1)));
  // the storm plateau: rain-dark and ashen
  const st = dcStormW(x, z);
  if (st > 0) out.lerp(_dc1.copy(DCOL.storm).lerp(DCOL.basalt, smooth(0.1, 0.8, v2) * 0.4), st * 0.6);
  // the canyon's pale dry bed
  const cd = dcCanyonAt(i);
  if (cd < 14) out.lerp(_dc1.copy(DCOL.bed).lerp(DCOL.sandDark, smooth(-0.3, 0.7, v2) * 0.5), (1 - smooth(4, 13, cd)) * 0.8);
  // the nest: blown sand, paler at the bottom
  const dn = Math.hypot(x - S.nest.x, z - S.nest.z);
  if (dn < S.nest.r + 60) out.lerp(_dc1.copy(DCOL.sand).lerp(DCOL.sandDark, smooth(-0.2, 0.8, v2) * 0.5), (1 - smooth(S.nest.r * 0.8, S.nest.r + 55, dn)) * 0.9);
  // the track
  const td = TER.ROADD[i];
  out.lerp(_dc1.copy(DCOL.track).lerp(DCOL.trackPale, smooth(-0.5, 0.5, v2)), (1 - smooth(ROAD_WIDTH * 0.35, ROAD_WIDTH * 0.5 + 1.5, td)) * 0.85);
  // rock by slope (mesa walls: banded red stone), the high peaks dark
  const rockW = smooth(0.55, 0.95, slope);
  out.lerp(_dc1.copy(DCOL.rock).lerp(DCOL.rockDark, smooth(-0.2, 0.6, v2)).lerp(DCOL.basalt, st * 0.6), rockW);
  out.lerp(DCOL.peak, smooth(110, 200, h) * (1 - rockW * 0.5));
  return out;
}

/* ───────────── raising the strip ───────────── */
// distance-to-polyline into a field that covers rows j0.. only (index k = (iz - j0) * N + ix)
function dcRaster(pts, F, j0, reach) {
  const c = WORLD.cell, X0 = WORLD.x0, Z0 = WORLD.z0, N = TER.NX, rows = F.length / N;
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
    const minx = Math.max(0, Math.floor((Math.min(ax, bx) - reach - X0) / c)), maxx = Math.min(N - 1, Math.ceil((Math.max(ax, bx) + reach - X0) / c));
    const minz = Math.max(j0, Math.floor((Math.min(az, bz) - reach - Z0) / c)), maxz = Math.min(j0 + rows - 1, Math.ceil((Math.max(az, bz) + reach - Z0) / c));
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
    for (let iz = minz; iz <= maxz; iz++) {
      const z = iz * c + Z0;
      for (let ix = minx; ix <= maxx; ix++) {
        const x = ix * c + X0, t = clamp(((x - ax) * dx + (z - az) * dz) / len2, 0, 1);
        const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t)), k = (iz - j0) * N + ix;
        if (d < F[k]) F[k] = d;
      }
    }
  }
}

// Raise the waste. Idempotent; a second caller waits for the first.
function buildDemonLand() {
  if (DEMON.built) return Promise.resolve();
  if (!DEMON.building) DEMON.building = raiseDemonLand().then(() => { DEMON.built = true; BUS.emit('demonBuilt'); });
  return DEMON.building;
}
async function raiseDemonLand() {
  const t0 = performance.now();
  const c = WORLD.cell, N = TER.NX, X0 = WORLD.x0, Z0 = WORLD.z0, NZ = TER.NZ, j0 = TER.NZF;     // rows j0..NZ-1 are the strip
  const H = TER.H;
  const n = { a: Noise.make(WORLD.seed + 301), b: Noise.make(WORLD.seed + 302), c: Noise.make(WORLD.seed + 303), d: Noise.make(WORLD.seed + 304), e: Noise.make(WORLD.seed + 305) };
  // the track (into the shared road field: footsteps, colour, grass all read it) and the canyon
  TER.dcTrack = catmull(DC_TRACK, 8);
  rasterPolyline(TER.dcTrack, null, TER.ROADD, null, ROAD_WIDTH / 2 + 20);
  TER.DCC = new Float32Array((NZ - j0) * N).fill(1e6);
  dcRaster(catmull(DC_CANYON, 8), TER.DCC, j0, 40);
  // heights; the first 240 m blend out of Fittoa's last row (both are peaks there)
  const seam = H.slice((j0 - 1) * N, j0 * N);
  const ix0 = Math.max(0, Math.round((DEMON.xr[0] - X0) / c)), ix1 = Math.min(N - 1, Math.round((DEMON.xr[1] - X0) / c));
  for (let iz = j0; iz < NZ; iz++) {
    const z = iz * c + Z0, bl = smooth(DEMON.zF, DEMON.zF + 240, z);
    for (let ix = 0; ix < N; ix++) {
      const i = iz * N + ix, x = ix * c + X0;
      // past the raised columns: far peaks only, cheaply
      const raw = ix >= ix0 && ix <= ix1 ? demonHeight(x, z, i, n) : 150 + ridged(n.e, x / 260, z / 260, 2) * 150;
      H[i] = lerp(seam[ix], raw, bl);
    }
    if ((iz & 31) === 0) { bootStatus('A long way from home  ' + Math.round((iz - j0) / (NZ - j0) * 100) + '%'); await nextFrame(); }
  }
  sculptDemonSites(n);
  // grass: thin, dry, red as the dirt it grows from — thicker in the Migurd valley, none in the sand or on the track
  const G8 = TER.GRASS;
  for (let iz = j0; iz < NZ - 1; iz++) {
    const z = iz * c + Z0;
    if (z < DEMON.pz0 - 40 || z > DEMON.pz1 + 40) continue;
    for (let ix = 1; ix < N - 1; ix++) {
      const x = ix * c + X0;
      if (x < DEMON.px0 - 40 || x > DEMON.px1 + 40) continue;
      const i = iz * N + ix;
      const slope = Math.hypot(H[i + 1] - H[i - 1], H[i + N] - H[i - N]) / (2 * c);
      let g = (1 - smooth(0.4, 0.7, slope)) * smooth(ROAD_WIDTH * 0.5, ROAD_WIDTH * 0.5 + 3, TER.ROADD[i]);
      const dm = Math.hypot(x - DC_SPOTS.migurd.x, z - DC_SPOTS.migurd.z), dn = Math.hypot(x - DC_SPOTS.nest.x, z - DC_SPOTS.nest.z);
      const patch = smooth(0.25, 0.7, n.c(x / 30, z / 30));
      g *= Math.max(0.3 * patch, (1 - smooth(70, 170, dm)) * 0.85);
      g *= smooth(DC_SPOTS.nest.r + 10, DC_SPOTS.nest.r + 60, dn) * smooth(6, 14, dcCanyonAt(i)) * (1 - dcStormW(x, z) * 0.7);
      g *= smooth(14, 26, dm);                                                   // the village square stays trodden
      G8[i] = Math.round(clamp(g, 0, 1) * 255);
    }
  }
  // the GPU copies: heights (half floats) and grass are the same textures, re-uploaded
  const half = TER.heightHalf;
  for (let i = j0 * N; i < NZ * N; i++) half[i] = THREE.DataUtils.toHalfFloat(H[i]);
  TER.heightTex.needsUpdate = true; TER.grassTex.needsUpdate = true;
  bootStatus('Painting the waste'); await nextFrame();
  const nA = Noise.make(WORLD.seed + 3), nB = Noise.make(WORLD.seed + 4);
  buildColorTexture(nA, nB, (j0 - 1) / 2, (NZ - 1) / 2);
  await nextFrame();
  // chunks: the raised columns only (the rest is beyond the fog from anywhere you can stand)
  const inner = (mx, mz) => mx > DEMON.px0 - 80 && mx < DEMON.px1 + 80 && mz > DEMON.pz0 - 80 && mz < DEMON.pz1 + 80;
  buildTerrainChunks(nA, nB, Math.round((WORLD.zF - WORLD.z0) / 100), Math.round((WORLD.z1 - WORLD.z0) / 100), DEMON.xr, inner);
  DEMON.ms = Math.round(performance.now() - t0);
  if (typeof buildDemonDressing === 'function') { await nextFrame(); buildDemonDressing(); }
  // the waste's own map sheet, painted now (it's the white of the teleport, or the boot screen) rather than at first glance
  if (typeof mapBuildPage === 'function') { await nextFrame(); mapBuildPage('demon'); }
}
// the places people live and fight want level ground: each at the median of the land under it, eased back out
function sculptDemonSites(n) {
  const c = WORLD.cell, N = TER.NX, H = TER.H;
  const median = (x, z, r) => { const v = []; for (let zz = z - r; zz <= z + r; zz += 6) for (let xx = x - r; xx <= x + r; xx += 6) v.push(heightAt(xx, zz)); v.sort((a, b) => a - b); return v[v.length >> 1]; };
  const each = (x, z, R, fn) => {
    const i0 = Math.max(1, Math.floor((x - R - WORLD.x0) / c)), i1 = Math.min(N - 2, Math.ceil((x + R - WORLD.x0) / c));
    const j0 = Math.max(TER.NZF, Math.floor((z - R - WORLD.z0) / c)), j1 = Math.min(TER.NZ - 2, Math.ceil((z + R - WORLD.z0) / c));
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) { const i = j * N + k; H[i] = fn(H[i], WORLD.x0 + k * c, WORLD.z0 + j * c); }
  };
  for (const key of ['migurd', 'wake', 'bones']) {
    const P = DC_SPOTS[key], lv = P.lv = median(P.x, P.z, P.r);
    each(P.x, P.z, P.r + 60, (h, x, z) => lerp(h, lv + n.c(x / 40, z / 40) * 0.35, 1 - smooth(P.r * 0.85, P.r + 50, Math.hypot(x - P.x, z - P.z))));
  }
  // the Migurd valley: a low ring of hills round the village, open where the track comes in (south) and goes on (east)
  const M = DC_SPOTS.migurd;
  each(M.x, M.z, 200, (h, x, z) => {
    const d = Math.hypot(x - M.x, z - M.z), a = Math.atan2(z - M.z, x - M.x);
    const gap = Math.max(1 - smooth(0.25, 0.6, Math.abs(wrapAngle(a - 0.1))), 1 - smooth(0.25, 0.6, Math.abs(wrapAngle(a - 1.4))));
    return h + 9 * Math.exp(-Math.pow((d - 120) / 32, 2)) * (1 - gap);
  });
  DC_SPOTS.nest.lv = DC_NEST_FLOOR;
  DC_SPOTS.storm.lv = median(DC_SPOTS.storm.x, DC_SPOTS.storm.z, 40);
}
