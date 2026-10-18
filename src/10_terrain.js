/* ═══════════════════════════════════════════════════════════════════════
   TERRAIN — one heightfield, sculpted from WORLD data, cut into chunks.

   Fields on the same grid (NX×NZ, 2 m spacing, WORLD.x0..x1 × z0..z1):
     H       ground height
     WATER   water surface height, or NO_WATER
     RIVD    distance to the river centreline      (for banks, grass, audio)
     ROADD   distance to the road centreline       (for colour, grass)
     GRASS   grass density 0..255                  (uploaded as a texture)
   Queries (heightAt, normalAt, waterAt) read these bilinearly; physics,
   foliage, AI and the map all use the same numbers the mesh was built from.
   ═══════════════════════════════════════════════════════════════════════ */
const NO_WATER = -1e4;
const TER = {
  NX: 0, NZ: 0, H: null, WATER: null, RIVD: null, RIVL: null, ROADD: null, GRASS: null,
  group: new THREE.Group(), chunks: [], heightTex: null, grassTex: null, riverPath: [],
};

function terIndex(x, z) {
  const c = WORLD.cell;
  return [clamp((x - WORLD.x0) / c, 0, TER.NX - 1.001), clamp((z - WORLD.z0) / c, 0, TER.NZ - 1.001)];
}
function sampleField(F, x, z) {
  const [fx, fz] = terIndex(x, z);
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, N = TER.NX;
  const i = iz * N + ix;
  const a = F[i], b = F[i + 1], c = F[i + N], d = F[i + N + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}
const heightAt = (x, z) => sampleField(TER.H, x, z);
function normalAt(x, z, out = new THREE.Vector3()) {
  const e = WORLD.cell;
  const hl = heightAt(x - e, z), hr = heightAt(x + e, z), hd = heightAt(x, z - e), hu = heightAt(x, z + e);
  return out.set(hl - hr, 2 * e, hd - hu).normalize();
}
// Water surface at a point, or NO_WATER. Uses the nearest cell rather than
// blending, so the shoreline doesn't average water with "no water".
function waterAt(x, z) {
  const [fx, fz] = terIndex(x, z);
  return TER.WATER[Math.round(fz) * TER.NX + Math.round(fx)];
}
const riverDistAt = (x, z) => sampleField(TER.RIVD, x, z);
const roadDistAt = (x, z) => sampleField(TER.ROADD, x, z);

/* rasterise distance-to-polyline into a field, touching only nearby cells */
function rasterPolyline(pts, levels, F, L, reach) {
  const c = WORLD.cell, X0 = WORLD.x0, Z0 = WORLD.z0, N = TER.NX;
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
    const minx = Math.max(0, Math.floor((Math.min(ax, bx) - reach - X0) / c));
    const maxx = Math.min(TER.NX - 1, Math.ceil((Math.max(ax, bx) + reach - X0) / c));
    const minz = Math.max(0, Math.floor((Math.min(az, bz) - reach - Z0) / c));
    const maxz = Math.min(TER.NZ - 1, Math.ceil((Math.max(az, bz) + reach - Z0) / c));
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
    for (let iz = minz; iz <= maxz; iz++) {
      const z = iz * c + Z0;
      for (let ix = minx; ix <= maxx; ix++) {
        const x = ix * c + X0;
        const t = clamp(((x - ax) * dx + (z - az) * dz) / len2, 0, 1);
        const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
        const i = iz * N + ix;
        if (d < F[i]) { F[i] = d; if (L) L[i] = lerp(levels[s], levels[s + 1], t); }
      }
    }
  }
}

/* ───────────── the Roa basin ───────────── */
// distance from a point to an axis-aligned rectangle {x, z, hw, hd} (0 inside)
function rectDist(x, z, R) { return Math.hypot(Math.max(Math.abs(x - R.x) - R.hw, 0), Math.max(Math.abs(z - R.z) - R.hd, 0)); }
// how much a point belongs to the outskirts' badlands (north-east of the city)
const outskirtsW = (x, z) => smooth(OUTSKIRTS.x0 - 90, OUTSKIRTS.x0 + 90, x) * (1 - smooth(OUTSKIRTS.z1 - 90, OUTSKIRTS.z1 + 90, z));
// First pass, inside the height loop: the outskirts break into mesas and
// gullies — but stay walkable along the trade road.
function sculptRoa(h, x, z, i, nA, nB) {
  const ok = outskirtsW(x, z);
  if (ok > 0) h += ok * smooth(8, 36, TER.ROADD[i]) * (ridged(nB, x / 85, z / 85, 3) * 18 - 6 + fbm(nA, x / 36, z / 36, 2) * 2.5);
  return h;
}
// Second pass: the built places want level ground. Each one's level is the
// median of the land already under it, so nothing stands on a plinth or sits
// in a pit, and the edges ease back into the hills.
function sculptRoaSites() {
  const c = WORLD.cell, N = TER.NX, H = TER.H, n = Noise.make(WORLD.seed + 61);
  const median = (x0, z0, x1, z1) => {
    const v = [];
    for (let z = z0; z <= z1; z += 6) for (let x = x0; x <= x1; x += 6) v.push(heightAt(x, z));
    v.sort((a, b) => a - b); return v[v.length >> 1];
  };
  const C = ROA_CITY, E = ROA_ESTATE, F = FIRST_WALL, W = WAGON_CAMP;
  C.h = median(C.x - C.hw, C.z - C.hd, C.x + C.hw, C.z + C.hd);
  F.h = median(F.x - F.r, F.z - F.r, F.x + F.r, F.z + F.r) - 2.5;     // sunk a little below its surroundings
  W.h = median(W.x - 20, W.z - 20, W.x + 20, W.z + 20);
  const each = (x0, z0, x1, z1, fn) => {
    const i0 = Math.max(1, Math.floor((x0 - WORLD.x0) / c)), i1 = Math.min(N - 2, Math.ceil((x1 - WORLD.x0) / c));
    const j0 = Math.max(1, Math.floor((z0 - WORLD.z0) / c)), j1 = Math.min(TER.NZ - 2, Math.ceil((z1 - WORLD.z0) / c));
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) { const i = j * N + k; H[i] = fn(H[i], WORLD.x0 + k * c, WORLD.z0 + j * c); }
  };
  // the city on one low plateau, eased out over 70 m; the Boreas terrace a step up within it
  each(C.x - C.hw - 72, C.z - C.hd - 72, C.x + C.hw + 72, C.z + C.hd + 72, (h, x, z) => {
    h = lerp(h, C.h + n(x / 50, z / 50) * 0.5, 1 - smooth(0, 70, rectDist(x, z, C)));
    return h + E.up * (1 - smooth(0, 7, rectDist(x, z, E)));
  });
  // the First Wall: a sunken arena floor ringed by a raised lip (walkable: ~30°)
  each(F.x - F.r - 32, F.z - F.r - 32, F.x + F.r + 32, F.z + F.r + 32, (h, x, z) => {
    const d = Math.hypot(x - F.x, z - F.z);
    h = lerp(h, F.h + n(x / 9, z / 9) * 0.25, 1 - smooth(F.r - 4, F.r + 10, d));
    return h + 3.5 * Math.exp(-Math.pow((d - F.r - 9) / 6, 2));
  });
  // the wagon camp: a level yard beside the road
  each(W.x - 40, W.z - 40, W.x + 40, W.z + 40, (h, x, z) => lerp(h, W.h, 1 - smooth(22, 38, Math.hypot(x - W.x, z - W.z))));
}

async function buildTerrain() {
  const c = WORLD.cell, X0 = WORLD.x0, Z0 = WORLD.z0;
  const N = TER.NX = Math.round((WORLD.x1 - WORLD.x0) / c) + 1;     // N: the row stride
  const NZ = TER.NZ = Math.round((WORLD.z1 - WORLD.z0) / c) + 1;
  const NN = N * NZ;
  TER.H = new Float32Array(NN);
  TER.WATER = new Float32Array(NN).fill(NO_WATER);
  TER.RIVD = new Float32Array(NN).fill(1e6);
  TER.RIVL = new Float32Array(NN);
  TER.ROADD = new Float32Array(NN).fill(1e6);
  TER.GRASS = new Uint8Array(NN);

  /* --- river & road distance fields --- */
  const rPts = [], rLev = [];
  const dense = catmull(RIVER.map(p => [p[0], p[1]]), 10);
  for (let i = 0; i < RIVER.length - 1; i++) {
    for (let s = 0; s < 10; s++) { rPts.push(dense[i * 10 + s]); rLev.push(lerp(RIVER[i][2], RIVER[i + 1][2], s / 10)); }
  }
  rPts.push([RIVER[RIVER.length - 1][0], RIVER[RIVER.length - 1][1]]); rLev.push(RIVER[RIVER.length - 1][2]);
  TER.riverPath = rPts.map((p, i) => [p[0], p[1], rLev[i]]);
  rasterPolyline(rPts, rLev, TER.RIVD, TER.RIVL, RIVER_WIDTH / 2 + 40);
  const roadPts = catmull(ROAD, 8);
  TER.roadPath = roadPts;
  rasterPolyline(roadPts, null, TER.ROADD, null, ROAD_WIDTH / 2 + 20);
  TER.streets = STREETS.map(s => s.length > 2 ? catmull(s, 6) : s);
  for (const s of TER.streets) rasterPolyline(s, null, TER.ROADD, null, ROAD_WIDTH / 2 + 20);

  /* --- heights --- */
  const n1 = Noise.make(WORLD.seed + 1), n2 = Noise.make(WORLD.seed + 2), n3 = Noise.make(WORLD.seed + 3);
  const n4 = Noise.make(WORLD.seed + 4), n5 = Noise.make(WORLD.seed + 5), n6 = Noise.make(WORLD.seed + 6);
  const hw = RIVER_WIDTH / 2;
  const rdx = RIDGE.bx - RIDGE.ax, rdz = RIDGE.bz - RIDGE.az, rlen2 = rdx * rdx + rdz * rdz;

  for (let iz = 0; iz < NZ; iz++) {
    const z = iz * c + Z0;
    for (let ix = 0; ix < N; ix++) {
      const x = ix * c + X0;
      const i = iz * N + ix;
      let h = 32 + fbm(n1, x / 480, z / 480, 4) * 20 + fbm(n2, x / 130, z / 130, 3) * 5.5 + n3(x / 38, z / 38) * 1.0;

      // forest hills — rougher inside the forest zone
      const fw = smooth(FOREST_ZONE.x0 - 60, FOREST_ZONE.x0 + 60, x) * (1 - smooth(FOREST_ZONE.z1 - 60, FOREST_ZONE.z1 + 60, z)) * forestEast(x);
      h += fw * fbm(n4, x / 170, z / 170, 3) * 12;

      // watchtower ridge: capsule falloff along its spine, crest roughened
      const rt = clamp(((x - RIDGE.ax) * rdx + (z - RIDGE.az) * rdz) / rlen2, 0, 1);
      const rd = Math.hypot(x - (RIDGE.ax + rdx * rt), z - (RIDGE.az + rdz * rt));
      const rTaper = Math.sin(rt * Math.PI) * 0.55 + 0.45;
      h += RIDGE.h * rTaper * Math.exp(-Math.pow(rd / (RIDGE.w * 0.5), 2)) * (0.9 + 0.2 * n6(x / 50, z / 50));

      // the tutor's hill
      const dh = Math.hypot(x - ROXY_HILL.x, z - ROXY_HILL.z);
      h += ROXY_HILL.h * Math.exp(-Math.pow(dh / ROXY_HILL.r, 2));

      // heart grove: a shallow bowl under the old tree
      const dg = Math.hypot(x - GROVE.x, z - GROVE.z);
      h -= 5 * Math.exp(-Math.pow(dg / GROVE.r, 2));

      // northern escarpment — wobbly line, steep middle, rough top
      const cz = z + n6(x / 70, 3.1) * 14;
      let ct = smooth(CLIFF.z0, CLIFF.z1, cz); ct = ct * ct * (3 - 2 * ct);
      h += ct * (CLIFF.h + ridged(n5, x / 90, z / 90, 3) * 22) + smooth(CLIFF.z1, CLIFF.z1 - 200, cz) * 40;

      // mountain ring (rounded square), with a pass for the Roa road
      const ringE = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25);
      // two bands: rolling foothills first, the real peaks further out — so the
      // horizon layers into depth instead of standing up as one wall
      let m = smooth(760, 900, ringE), m2 = smooth(880, 1060, ringE);
      // Roa's basin has a ring of its own: between the two, mountains — except the pass
      const ringR = Math.pow(Math.pow(Math.abs(x - ROA_BASIN.x), 4) + Math.pow(Math.abs(z - ROA_BASIN.z), 4), 0.25);
      m = Math.min(m, smooth(ROA_BASIN.r, ROA_BASIN.r + 140, ringR));
      m2 = Math.min(m2, smooth(ROA_BASIN.r + 120, ROA_BASIN.r + 300, ringR));
      if (x > 560) {
        const pass = 1 - (1 - smooth(EAST_PASS.w, EAST_PASS.w + 100, Math.abs(z - EAST_PASS.z))) * smooth(560, 760, x);
        m *= pass; m2 *= pass;
      }
      h += m * (45 + fbm(n4, x / 140, z / 140, 3) * 30) + m2 * (80 + ridged(n5, x / 240, z / 240, 5) * 170);

      if (x > 900) h = sculptRoa(h, x, z, i, n2, n5);

      // village basin
      const dv = Math.hypot(x - VILLAGE_BASIN.x, z - VILLAGE_BASIN.z);
      const vb = 1 - smooth(VILLAGE_BASIN.r * 0.5, VILLAGE_BASIN.r, dv);
      h = lerp(h, VILLAGE_BASIN.h + n2(x / 60, z / 60) * 1.3, vb);

      // lake: bowl below the water, rim guaranteed above it
      const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
      const lb = 1 - smooth(LAKE.r * 0.3, LAKE.r, dl);
      h = Math.min(h, lerp(h, LAKE.bed, lb));
      const rim = (1 - smooth(LAKE.r, LAKE.r + 30, dl)) * smooth(LAKE.r * 0.9, LAKE.r, dl);
      h = Math.max(h, lerp(h, WORLD.lakeLevel + 0.8, rim));
      // the island: a mound breaking the surface, far from any wadeable shallows
      const di = Math.hypot(x - ISLAND.x, z - ISLAND.z);
      if (di < ISLAND.r + 12) h = Math.max(h, lerp(LAKE.bed, ISLAND.h, 1 - smooth(ISLAND.r * 0.4, ISLAND.r + 12, di)));

      // river: levee keeps the banks above the water, channel cuts below it
      const rv = TER.RIVD[i], L = TER.RIVL[i];
      if (rv < hw + 28) {
        const lev = 1 - smooth(hw, hw + 28, rv);
        h = Math.max(h, lerp(h, L + 0.9, lev));
        // gentle banks: a 45° cut reads as a concrete channel
        const ch = 1 - smooth(hw * 0.25, hw + 7, rv);
        h = Math.min(h, lerp(h, L - 2.4, ch * ch * (3 - 2 * ch)));
      }

      // road: a slight sunken bed (not across the river — that's the bridge)
      const ro = TER.ROADD[i];
      if (ro < ROAD_WIDTH + 8 && rv > hw + 14) h -= (1 - smooth(ROAD_WIDTH * 0.5, ROAD_WIDTH * 0.5 + 8, ro)) * 0.35;

      TER.H[i] = h;

      // water surface
      if (rv < hw + 2.5) TER.WATER[i] = L;
      else if (dl < LAKE.r + 4 && h < WORLD.lakeLevel + 0.05) TER.WATER[i] = WORLD.lakeLevel;
    }
    if ((iz & 63) === 0) { bootStatus('Raising the land  ' + Math.round(iz / NZ * 100) + '%'); await nextFrame(); }
  }

  sculptRoaSites();

  /* --- grass density: none on water, road, rock, steep ground, or the basin core --- */
  for (let iz = 1; iz < NZ - 1; iz++) {
    for (let ix = 1; ix < N - 1; ix++) {
      const i = iz * N + ix, x = ix * c + X0, z = iz * c + Z0;
      if (TER.WATER[i] > NO_WATER || x < WORLD.px0 - 40 || x > WORLD.px1 + 40 || z < WORLD.pz0 - 40 || z > WORLD.pz1 + 40) continue;
      // rise over run: central differences span two cells
      const slope = Math.hypot(TER.H[i + 1] - TER.H[i - 1], TER.H[i + N] - TER.H[i - N]) / (2 * c);
      let g = 1 - smooth(0.45, 0.8, slope);
      g *= smooth(ROAD_WIDTH * 0.5, ROAD_WIDTH * 0.5 + 4, TER.ROADD[i]);
      g *= smooth(hw + 1, hw + 7, TER.RIVD[i]);
      g *= 0.55 + 0.45 * smooth(-0.2, 0.4, n3(x / 25, z / 25));
      if (x > 900) {
        g *= 1 - 0.62 * outskirtsW(x, z);                                   // the outskirts: dry and patchy
        const inCity = 1 - smooth(2, 18, rectDist(x, z, ROA_CITY));
        g *= 1 - inCity * (0.45 + 0.55 * roaPaved(x, z, TER.ROADD[i]));    // yards keep a thin lawn; stone keeps none
        g *= smooth(0, 3, rectDist(x, z, ROA_YARD));                         // the training ground is beaten bare
      }
      TER.GRASS[i] = Math.round(clamp(g, 0, 1) * 255);
    }
  }

  buildTerrainTextures();
  bootStatus('Painting the ground');
  await nextFrame();
  buildColorTexture(n3, n4);
  buildTerrainChunks(n3, n4);
  scene.add(TER.group);
}

/* Ground colour at 4 m resolution, so grass matches the soil it grows from. */
function buildColorTexture(nA, nB) {
  const N = TER.NX, MX = (TER.NX - 1) / 2 + 1, MZ = (TER.NZ - 1) / 2 + 1, c = WORLD.cell;
  const data = new Uint8Array(MX * MZ * 4), col = new THREE.Color(), n = new THREE.Vector3();
  for (let j = 0; j < MZ; j++) for (let k = 0; k < MX; k++) {
    const ix = k * 2, iz = j * 2, i = iz * N + ix;
    const x = ix * c + WORLD.x0, z = iz * c + WORLD.z0;
    normalAt(x, z, n);
    const slope = Math.sqrt(1 - n.y * n.y) / Math.max(n.y, 0.05);
    terrainColor(x, z, TER.H[i], slope, i, nA, nB, col);
    const o = (j * MX + k) * 4;
    // store sqrt(linear): spends the 8 bits where the dark greens live
    data[o] = Math.sqrt(col.r) * 255; data[o + 1] = Math.sqrt(col.g) * 255; data[o + 2] = Math.sqrt(col.b) * 255; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, MX, MZ, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  TER.colorTex = t; TER.colorMX = MX; TER.colorMZ = MZ;
}

/* GPU copies of the height + grass fields, for grass placement in shaders */
function buildTerrainTextures() {
  const NX = TER.NX, NZ = TER.NZ;
  const half = new Uint16Array(NX * NZ);
  for (let i = 0; i < NX * NZ; i++) half[i] = THREE.DataUtils.toHalfFloat(TER.H[i]);
  const ht = new THREE.DataTexture(half, NX, NZ, THREE.RedFormat, THREE.HalfFloatType);
  ht.minFilter = ht.magFilter = THREE.LinearFilter; ht.needsUpdate = true;
  TER.heightTex = ht;
  const gt = new THREE.DataTexture(TER.GRASS, NX, NZ, THREE.RedFormat, THREE.UnsignedByteType);
  gt.minFilter = gt.magFilter = THREE.LinearFilter; gt.needsUpdate = true;
  TER.grassTex = gt;
}

/* ───────────── colour ───────────── */
const TCOL = (() => {
  const C = hex => new THREE.Color(hex);   // sRGB hex -> linear working space
  return {
    lush: C('#6c8c3c'), dry: C('#9ba04d'), dark: C('#4a6630'), warm: C('#8b9a46'),
    forest: C('#3f5427'), moss: C('#526d2c'),
    dirt: C('#8a7150'), path: C('#7b6747'), bank: C('#a8976b'), bed: C('#5d5a4c'),
    rock: C('#7b7266'), rockDark: C('#554e46'), cliff: C('#8d8272'),
    snow: C('#e9e7e1'), field: C('#c0a24c'),
    dust: C('#ad9a68'), dustPale: C('#c2b184'), badRock: C('#9b8467'),
    cobble: C('#8a7e6c'), cobbleDark: C('#6e6456'), plaza: C('#a59882'), soil: C('#6c5639'),
    pave: C('#ab9c82'), paveDark: C('#8e7f68'), yard: C('#7d9246'), yardWorn: C('#94895a'),
  };
})();
const _tc = new THREE.Color(), _tc2 = new THREE.Color();
function terrainColor(x, z, h, slope, i, nA, nB, out) {
  const v1 = nA(x / 45, z / 45), v2 = nB(x / 12, z / 12);
  // meadow: lush <-> dry <-> dark, broken up by two noise scales
  out.copy(TCOL.lush).lerp(TCOL.dry, smooth(-0.1, 0.7, v1)).lerp(TCOL.dark, smooth(0.2, 0.8, -v1) * 0.6);
  out.lerp(TCOL.warm, smooth(0.3, 1, v2) * 0.35);
  // forest floor
  const fw = smooth(FOREST_ZONE.x0 - 40, FOREST_ZONE.x0 + 80, x) * (1 - smooth(FOREST_ZONE.z1 - 40, FOREST_ZONE.z1 + 80, z)) * forestEast(x);
  out.lerp(_tc.copy(TCOL.forest).lerp(TCOL.moss, smooth(-0.3, 0.6, v2)), fw * 0.8);
  // wheat fields south of the village
  const fieldW = (1 - smooth(55, 80, Math.hypot(x + 340, z - 520))) + (1 - smooth(40, 60, Math.hypot(x + 560, z - 430)));
  out.lerp(TCOL.field, clamp(fieldW, 0, 1) * 0.75);
  // river banks and beds
  const rv = TER.RIVD[i];
  const hw = RIVER_WIDTH / 2;
  out.lerp(TCOL.bank, (1 - smooth(hw + 1, hw + 6, rv)) * 0.85);
  if (TER.WATER[i] > NO_WATER && h < TER.WATER[i] - 0.4) out.lerp(TCOL.bed, 0.8);
  // lake shore
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (h < WORLD.lakeLevel + 1.2 && dl < LAKE.r + 20) out.lerp(TCOL.bank, 0.7);
  if (x > 900) roaGroundColor(x, z, h, v1, v2, out);
  // road
  const ro = TER.ROADD[i];
  const paved = x > 900 ? 1 - smooth(0, 6, rectDist(x, z, ROA_CITY)) : 0;      // Roa's streets are laid stone, not dirt
  out.lerp(_tc.copy(TCOL.dirt).lerp(TCOL.path, smooth(-0.5, 0.5, v2)), (1 - smooth(ROAD_WIDTH * 0.35, ROAD_WIDTH * 0.5 + 1.5, ro)) * 0.95 * (1 - paved * 0.8));
  // village worn ground
  const dv = Math.hypot(x - VILLAGE_BASIN.x, z - VILLAGE_BASIN.z);
  out.lerp(TCOL.path, (1 - smooth(20, 90, dv)) * 0.25 * (0.6 + 0.4 * v2));
  // rock by slope, snow by height
  const rockW = smooth(0.55, 0.95, slope);
  out.lerp(_tc2.copy(TCOL.rock).lerp(TCOL.rockDark, smooth(-0.2, 0.6, v2)).lerp(TCOL.cliff, smooth(60, 100, h) * 0.5), rockW);
  out.lerp(TCOL.snow, smooth(215, 265, h + v1 * 25) * (1 - rockW * 0.6));
  return out;
}

function terrainMaterial() {
  const onShader = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerN;\nattribute float paved;\nvarying float vPaved;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvTerN = objectNormal; vPaved = paved;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vTerN; varying float vPaved;
        float tHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float pHash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float tNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(tHash(i), tHash(i+vec2(1,0)), f.x), mix(tHash(i+vec2(0,1)), tHash(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // brush-scale variation so a field of one colour still reads as paint
        { float b = tNoise(vWFPos.xz * 0.9) * 0.45 + tNoise(vWFPos.xz * 0.23) * 0.35 + tNoise(vWFPos.xz * 3.1) * 0.2;
          diffuseColor.rgb *= 0.84 + 0.32 * b;
          // cliffs: sedimentary strata + vertical cracks, only where it's steep
          float steep = (1.0 - smoothstep(0.55, 0.82, normalize(vTerN).y));
          if (steep > 0.0) {
            vec2 sp = vec2(vWFPos.x + vWFPos.z, vWFPos.y);
            float warp = tNoise(sp * vec2(0.04, 0.08)) * 6.0;
            float band = sin((vWFPos.y + warp) * 0.9) * 0.5 + 0.5;
            float fine = tNoise(vec2((vWFPos.x - vWFPos.z) * 0.6, vWFPos.y * 3.0));
            float crack = 1.0 - smoothstep(0.0, 0.08, abs(tNoise(vec2((vWFPos.x + vWFPos.z) * 0.35, vWFPos.y * 0.05)) - 0.5));
            vec3 rc = diffuseColor.rgb * (0.78 + 0.34 * band) * (0.9 + 0.2 * fine);
            rc *= 1.0 - crack * 0.45;
            rc = mix(rc, rc * vec3(1.05, 0.98, 0.92), band);
            diffuseColor.rgb = mix(diffuseColor.rgb, rc, steep);
          }
          // laid stone: cobbles (voronoi cells, mortar in the seams), faded out with distance
          if (vPaved > 0.02) {
            float near = 1.0 - smoothstep(30.0, 70.0, length(vWFPos - cameraPosition));
            vec2 q = vWFPos.xz * 2.3, iq = floor(q), fq = fract(q);
            float d1 = 8.0, d2 = 8.0, sid = 0.0;
            for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j)), cell = iq + g;
              vec2 r = g + vec2(pHash(cell), pHash(cell + 19.7)) * 0.75 + 0.125 - fq;
              float d = dot(r, r);
              if (d < d1) { d2 = d1; d1 = d; sid = pHash(cell + 7.3); } else if (d < d2) d2 = d;
            }
            float edge = sqrt(d2) - sqrt(d1);
            float mortar = 1.0 - smoothstep(0.05, 0.17, edge);
            vec3 st = diffuseColor.rgb * (0.86 + 0.28 * sid) * (0.93 + 0.1 * smoothstep(0.15, 0.55, edge));
            st = mix(st, diffuseColor.rgb * 0.55, mortar);
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb * 0.95, st, near), vPaved);
          }
          // rain darkens the ground
          diffuseColor.rgb *= 1.0 - wfMisc.w * 0.28; }`);
  };
  onShader.key = 'terrain';
  return toonMat({ vertexColors: true, onShader });
}

function buildTerrainChunks(nA, nB) {
  const CH = 100, perX = Math.round((WORLD.x1 - WORLD.x0) / CH), perZ = Math.round((WORLD.z1 - WORLD.z0) / CH);
  const mat = terrainMaterial();
  TER.material = mat;
  for (let cz = 0; cz < perZ; cz++) {
    for (let cx = 0; cx < perX; cx++) {
      const x0 = WORLD.x0 + cx * CH, z0 = WORLD.z0 + cz * CH;
      // full detail where you can walk (plus a margin); the far mountains at half
      const mx = x0 + CH / 2, mz = z0 + CH / 2;
      const inner = mx > WORLD.px0 - 80 && mx < WORLD.px1 + 80 && mz > WORLD.pz0 - 80 && mz < WORLD.pz1 + 80;
      const step = inner ? 2 : 4;
      const geo = chunkGeometry(x0, z0, CH, step, nA, nB);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      mesh.castShadow = inner;               // far mountains don't need to cast into the shadow map
      mesh.matrixAutoUpdate = false;
      TER.group.add(mesh);
      TER.chunks.push(mesh);
    }
  }
}

function chunkGeometry(x0, z0, size, step, nA, nB) {
  const S = Math.round(size / step), V = S + 1;
  const skirt = 4 * S;                 // one skirt vertex per edge vertex (4 edges)
  const pos = new Float32Array((V * V + skirt + 4) * 3);
  const nor = new Float32Array(pos.length);
  const col = new Float32Array(pos.length);
  const pav = new Float32Array(pos.length / 3);
  const N = TER.NX, c = WORLD.cell;
  const n = new THREE.Vector3(), cl = new THREE.Color();
  let p = 0;
  const put = (x, y, z, i) => {
    pos[p] = x; pos[p + 1] = y; pos[p + 2] = z;
    normalAt(x, z, n); nor[p] = n.x; nor[p + 1] = n.y; nor[p + 2] = n.z;
    const slope = Math.sqrt(1 - n.y * n.y) / Math.max(n.y, 0.05);
    terrainColor(x, z, y, slope, i, nA, nB, cl);
    col[p] = cl.r; col[p + 1] = cl.g; col[p + 2] = cl.b;
    pav[p / 3] = x > 1400 ? roaPaved(x, z, TER.ROADD[i]) : 0;
    p += 3;
  };
  for (let j = 0; j < V; j++) for (let k = 0; k < V; k++) {
    const x = x0 + k * step, z = z0 + j * step;
    const ix = Math.round((x - WORLD.x0) / c), iz = Math.round((z - WORLD.z0) / c);
    const gi = clamp(iz, 0, TER.NZ - 1) * N + clamp(ix, 0, N - 1);
    put(x, TER.H[gi], z, gi);
  }
  const idx = [];
  for (let j = 0; j < S; j++) for (let k = 0; k < S; k++) {
    const a = j * V + k, b = a + 1, d = a + V, f = d + 1;
    if ((j + k) & 1) idx.push(a, d, b, b, d, f); else idx.push(a, d, f, a, f, b);
  }
  // skirts: hang each border edge down 6 m so LOD seams never show sky
  let sk = V * V;
  const edge = [];
  for (let k = 0; k < V; k++) edge.push(k);                       // north
  for (let j = 1; j < V; j++) edge.push(j * V + S);               // east
  for (let k = S - 1; k >= 0; k--) edge.push(S * V + k);          // south
  for (let j = S - 1; j >= 1; j--) edge.push(j * V);              // west
  edge.push(0);
  const skirtIdx = [];
  for (let s = 0; s < edge.length - 1; s++) {
    const src = edge[s] * 3;
    pos[sk * 3] = pos[src]; pos[sk * 3 + 1] = pos[src + 1] - 6; pos[sk * 3 + 2] = pos[src + 2];
    nor[sk * 3] = nor[src]; nor[sk * 3 + 1] = nor[src + 1]; nor[sk * 3 + 2] = nor[src + 2];
    col[sk * 3] = col[src]; col[sk * 3 + 1] = col[src + 1]; col[sk * 3 + 2] = col[src + 2];
    pav[sk] = pav[edge[s]];
    skirtIdx.push(sk); sk++;
  }
  for (let s = 0; s < edge.length - 1; s++) {
    // wound to face OUT of the chunk: a seam is seen from the neighbour's side
    const a = edge[s], b = edge[s + 1], sa = skirtIdx[s], sb = skirtIdx[(s + 1) % skirtIdx.length];
    idx.push(a, b, sa, b, sb, sa);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, sk * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, sk * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, sk * 3), 3));
  g.setAttribute('paved', new THREE.BufferAttribute(pav.subarray(0, sk), 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/* Roa's ground: dust and pale rock in the outskirts, worn cobbles inside the
   walls (a paler square round the plaza), tilled soil in the market gardens. */
const ROA_PLAZA = { x: 1560, z: 386, r: 26 };
const ROA_FORECOURT = { x: 1560, z: 325, hw: 26, hd: 9 };             // stone court before the keep
const ROA_YARD = { x: 1600, z: 321, hw: 14, hd: 10 };                  // Ghislaine's training ground: trodden earth
// 0..1: how much of this spot is laid stone (streets, the plaza, the forecourt) — inside the walls only
function roaPaved(x, z, ro) {
  if (x < 1430 || x > 1690 || z < 265 || z > 505) return 0;
  const inside = 1 - smooth(-2, 3, rectDist(x, z, ROA_CITY));
  if (inside <= 0) return 0;
  const street = 1 - smooth(ROAD_WIDTH * 0.5 - 0.5, ROAD_WIDTH * 0.5 + 1.2, ro);
  const plaza = 1 - smooth(ROA_PLAZA.r - 3, ROA_PLAZA.r + 1, Math.hypot(x - ROA_PLAZA.x, z - ROA_PLAZA.z));
  const court = 1 - smooth(0, 2, rectDist(x, z, ROA_FORECOURT));
  return Math.max(street, plaza, court) * inside;
}
function roaGroundColor(x, z, h, v1, v2, out) {
  const ok = outskirtsW(x, z);
  if (ok > 0) {
    out.lerp(_tc.copy(TCOL.dust).lerp(TCOL.dustPale, smooth(-0.2, 0.7, v2)), ok * (0.55 + 0.3 * smooth(-0.3, 0.6, v1)));
    out.lerp(TCOL.badRock, ok * smooth(0.45, 0.9, v2) * 0.4);
  }
  const inside = 1 - smooth(0, 6, rectDist(x, z, ROA_CITY));
  if (inside > 0) {
    // yards and lawns between the streets (worn to earth in patches); the estate's lawn kept greener
    const estate = 1 - smooth(0, 4, rectDist(x, z, ROA_ESTATE));
    out.lerp(_tc.copy(TCOL.yard).lerp(TCOL.yardWorn, smooth(0.1, 0.8, v2) * (0.7 - estate * 0.5)), inside * 0.75);
    // laid stone (the shader cuts it into cobbles up close)
    const pv = roaPaved(x, z, TER.ROADD[Math.round((z - WORLD.z0) / WORLD.cell) * TER.NX + Math.round((x - WORLD.x0) / WORLD.cell)]);
    out.lerp(_tc.copy(TCOL.pave).lerp(TCOL.paveDark, smooth(-0.2, 0.8, v2) * 0.55), pv * 0.92);
    out.lerp(TCOL.plaza, (1 - smooth(ROA_PLAZA.r - 4, ROA_PLAZA.r + 2, Math.hypot(x - ROA_PLAZA.x, z - ROA_PLAZA.z))) * 0.45);
    out.lerp(_tc.copy(TCOL.dirt).lerp(TCOL.bank, smooth(-0.3, 0.7, v2) * 0.5), (1 - smooth(0, 3, rectDist(x, z, ROA_YARD))) * 0.9);
  }
  // market gardens: strips of tilled soil south of the walls
  const gardens = (1 - smooth(0, 14, rectDist(x, z, { x: 1545, z: 600, hw: 95, hd: 70 }))) * (Math.sin(z * 0.35 + Math.sin(x * 0.02) * 2) > 0.2 ? 1 : 0.35);
  out.lerp(TCOL.soil, gardens * 0.55);
  return out;
}
