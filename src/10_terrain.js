/* ═══════════════════════════════════════════════════════════════════════
   TERRAIN — one heightfield, sculpted from WORLD data, cut into chunks.

   Fields on the same grid (N×N, 2 m spacing, ±1100 m):
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
  N: 0, H: null, WATER: null, RIVD: null, RIVL: null, ROADD: null, GRASS: null,
  group: new THREE.Group(), chunks: [], heightTex: null, grassTex: null, riverPath: [],
};

function terIndex(x, z) {
  const c = WORLD.cell, e = WORLD.ext, N = TER.N;
  return [clamp((x + e) / c, 0, N - 1.001), clamp((z + e) / c, 0, N - 1.001)];
}
function sampleField(F, x, z) {
  const [fx, fz] = terIndex(x, z);
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, N = TER.N;
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
  return TER.WATER[Math.round(fz) * TER.N + Math.round(fx)];
}
const riverDistAt = (x, z) => sampleField(TER.RIVD, x, z);
const roadDistAt = (x, z) => sampleField(TER.ROADD, x, z);

/* rasterise distance-to-polyline into a field, touching only nearby cells */
function rasterPolyline(pts, levels, F, L, reach) {
  const c = WORLD.cell, e = WORLD.ext, N = TER.N;
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
    const minx = Math.max(0, Math.floor((Math.min(ax, bx) - reach + e) / c));
    const maxx = Math.min(N - 1, Math.ceil((Math.max(ax, bx) + reach + e) / c));
    const minz = Math.max(0, Math.floor((Math.min(az, bz) - reach + e) / c));
    const maxz = Math.min(N - 1, Math.ceil((Math.max(az, bz) + reach + e) / c));
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
    for (let iz = minz; iz <= maxz; iz++) {
      const z = iz * c - e;
      for (let ix = minx; ix <= maxx; ix++) {
        const x = ix * c - e;
        const t = clamp(((x - ax) * dx + (z - az) * dz) / len2, 0, 1);
        const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
        const i = iz * N + ix;
        if (d < F[i]) { F[i] = d; if (L) L[i] = lerp(levels[s], levels[s + 1], t); }
      }
    }
  }
}

async function buildTerrain() {
  const c = WORLD.cell, e = WORLD.ext;
  const N = TER.N = Math.round(2 * e / c) + 1;
  const NN = N * N;
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

  /* --- heights --- */
  const n1 = Noise.make(WORLD.seed + 1), n2 = Noise.make(WORLD.seed + 2), n3 = Noise.make(WORLD.seed + 3);
  const n4 = Noise.make(WORLD.seed + 4), n5 = Noise.make(WORLD.seed + 5), n6 = Noise.make(WORLD.seed + 6);
  const hw = RIVER_WIDTH / 2;
  const rdx = RIDGE.bx - RIDGE.ax, rdz = RIDGE.bz - RIDGE.az, rlen2 = rdx * rdx + rdz * rdz;

  for (let iz = 0; iz < N; iz++) {
    const z = iz * c - e;
    for (let ix = 0; ix < N; ix++) {
      const x = ix * c - e;
      const i = iz * N + ix;
      let h = 32 + fbm(n1, x / 480, z / 480, 4) * 20 + fbm(n2, x / 130, z / 130, 3) * 5.5 + n3(x / 38, z / 38) * 1.0;

      // forest hills — rougher inside the forest zone
      const fw = smooth(FOREST_ZONE.x0 - 60, FOREST_ZONE.x0 + 60, x) * (1 - smooth(FOREST_ZONE.z1 - 60, FOREST_ZONE.z1 + 60, z));
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
      if (x > 560) {
        const pass = 1 - (1 - smooth(EAST_PASS.w, EAST_PASS.w + 100, Math.abs(z - EAST_PASS.z))) * smooth(560, 760, x);
        m *= pass; m2 *= pass;
      }
      h += m * (45 + fbm(n4, x / 140, z / 140, 3) * 30) + m2 * (80 + ridged(n5, x / 240, z / 240, 5) * 170);

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
      else if (dl < LAKE.r + 4 && h < WORLD.lakeLevel + 0.5) TER.WATER[i] = WORLD.lakeLevel;
    }
    if ((iz & 63) === 0) { bootStatus('Raising the land  ' + Math.round(iz / N * 100) + '%'); await nextFrame(); }
  }

  /* --- grass density: none on water, road, rock, steep ground, or the basin core --- */
  for (let iz = 1; iz < N - 1; iz++) {
    for (let ix = 1; ix < N - 1; ix++) {
      const i = iz * N + ix, x = ix * c - e, z = iz * c - e;
      if (TER.WATER[i] > NO_WATER || Math.abs(x) > 820 || Math.abs(z) > 820) continue;
      // rise over run: central differences span two cells
      const slope = Math.hypot(TER.H[i + 1] - TER.H[i - 1], TER.H[i + N] - TER.H[i - N]) / (2 * c);
      let g = 1 - smooth(0.45, 0.8, slope);
      g *= smooth(ROAD_WIDTH * 0.5, ROAD_WIDTH * 0.5 + 4, TER.ROADD[i]);
      g *= smooth(hw + 1, hw + 7, TER.RIVD[i]);
      g *= 0.55 + 0.45 * smooth(-0.2, 0.4, n3(x / 25, z / 25));
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
  const N = TER.N, M = (N - 1) / 2 + 1, c = WORLD.cell, e = WORLD.ext;
  const data = new Uint8Array(M * M * 4), col = new THREE.Color(), n = new THREE.Vector3();
  for (let j = 0; j < M; j++) for (let k = 0; k < M; k++) {
    const ix = k * 2, iz = j * 2, i = iz * N + ix;
    const x = ix * c - e, z = iz * c - e;
    normalAt(x, z, n);
    const slope = Math.sqrt(1 - n.y * n.y) / Math.max(n.y, 0.05);
    terrainColor(x, z, TER.H[i], slope, i, nA, nB, col);
    const o = (j * M + k) * 4;
    // store sqrt(linear): spends the 8 bits where the dark greens live
    data[o] = Math.sqrt(col.r) * 255; data[o + 1] = Math.sqrt(col.g) * 255; data[o + 2] = Math.sqrt(col.b) * 255; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, M, M, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  TER.colorTex = t; TER.colorM = M;
}

/* GPU copies of the height + grass fields, for grass placement in shaders */
function buildTerrainTextures() {
  const N = TER.N;
  const half = new Uint16Array(N * N);
  for (let i = 0; i < N * N; i++) half[i] = THREE.DataUtils.toHalfFloat(TER.H[i]);
  const ht = new THREE.DataTexture(half, N, N, THREE.RedFormat, THREE.HalfFloatType);
  ht.minFilter = ht.magFilter = THREE.LinearFilter; ht.needsUpdate = true;
  TER.heightTex = ht;
  const gt = new THREE.DataTexture(TER.GRASS, N, N, THREE.RedFormat, THREE.UnsignedByteType);
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
  };
})();
const _tc = new THREE.Color(), _tc2 = new THREE.Color();
function terrainColor(x, z, h, slope, i, nA, nB, out) {
  const v1 = nA(x / 45, z / 45), v2 = nB(x / 12, z / 12);
  // meadow: lush <-> dry <-> dark, broken up by two noise scales
  out.copy(TCOL.lush).lerp(TCOL.dry, smooth(-0.1, 0.7, v1)).lerp(TCOL.dark, smooth(0.2, 0.8, -v1) * 0.6);
  out.lerp(TCOL.warm, smooth(0.3, 1, v2) * 0.35);
  // forest floor
  const fw = smooth(FOREST_ZONE.x0 - 40, FOREST_ZONE.x0 + 80, x) * (1 - smooth(FOREST_ZONE.z1 - 40, FOREST_ZONE.z1 + 80, z));
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
  // road
  const ro = TER.ROADD[i];
  out.lerp(_tc.copy(TCOL.dirt).lerp(TCOL.path, smooth(-0.5, 0.5, v2)), (1 - smooth(ROAD_WIDTH * 0.35, ROAD_WIDTH * 0.5 + 1.5, ro)) * 0.95);
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
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerN;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvTerN = objectNormal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vTerN;
        float tHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(tHash(i), tHash(i+vec2(1,0)), f.x), mix(tHash(i+vec2(0,1)), tHash(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // brush-scale variation so a field of one colour still reads as paint
        { float b = tNoise(vWFPos.xz * 0.9) * 0.45 + tNoise(vWFPos.xz * 0.23) * 0.35 + tNoise(vWFPos.xz * 3.1) * 0.2;
          diffuseColor.rgb *= 0.84 + 0.32 * b;
          // cliffs: sedimentary strata + vertical cracks, only where it's steep
          float steep = smoothstep(0.82, 0.55, normalize(vTerN).y);
          if (steep > 0.0) {
            vec2 sp = vec2(vWFPos.x + vWFPos.z, vWFPos.y);
            float warp = tNoise(sp * vec2(0.04, 0.08)) * 6.0;
            float band = sin((vWFPos.y + warp) * 0.9) * 0.5 + 0.5;
            float fine = tNoise(vec2((vWFPos.x - vWFPos.z) * 0.6, vWFPos.y * 3.0));
            float crack = smoothstep(0.08, 0.0, abs(tNoise(vec2((vWFPos.x + vWFPos.z) * 0.35, vWFPos.y * 0.05)) - 0.5));
            vec3 rc = diffuseColor.rgb * (0.78 + 0.34 * band) * (0.9 + 0.2 * fine);
            rc *= 1.0 - crack * 0.45;
            rc = mix(rc, rc * vec3(1.05, 0.98, 0.92), band);
            diffuseColor.rgb = mix(diffuseColor.rgb, rc, steep);
          }
          // rain darkens the ground
          diffuseColor.rgb *= 1.0 - wfMisc.w * 0.28; }`);
  };
  onShader.key = 'terrain';
  return toonMat({ vertexColors: true, onShader });
}

function buildTerrainChunks(nA, nB) {
  const e = WORLD.ext, CH = 100, per = Math.round(2 * e / CH);
  const mat = terrainMaterial();
  TER.material = mat;
  for (let cz = 0; cz < per; cz++) {
    for (let cx = 0; cx < per; cx++) {
      const x0 = -e + cx * CH, z0 = -e + cz * CH;
      const inner = Math.max(Math.abs(x0 + CH / 2), Math.abs(z0 + CH / 2)) < 860;
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
  const N = TER.N, c = WORLD.cell, e = WORLD.ext;
  const n = new THREE.Vector3(), cl = new THREE.Color();
  let p = 0;
  const put = (x, y, z, i) => {
    pos[p] = x; pos[p + 1] = y; pos[p + 2] = z;
    normalAt(x, z, n); nor[p] = n.x; nor[p + 1] = n.y; nor[p + 2] = n.z;
    const slope = Math.sqrt(1 - n.y * n.y) / Math.max(n.y, 0.05);
    terrainColor(x, z, y, slope, i, nA, nB, cl);
    col[p] = cl.r; col[p + 1] = cl.g; col[p + 2] = cl.b;
    p += 3;
  };
  for (let j = 0; j < V; j++) for (let k = 0; k < V; k++) {
    const x = x0 + k * step, z = z0 + j * step;
    const ix = Math.round((x + e) / c), iz = Math.round((z + e) / c);
    const gi = clamp(iz, 0, N - 1) * N + clamp(ix, 0, N - 1);
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
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}
