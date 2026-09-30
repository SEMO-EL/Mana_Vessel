/* ═══════════════════════════════════════════════════════════════════════
   FOLIAGE — grass, trees, bushes, rocks.

   GRASS is one instanced draw. A square window of blade slots follows the
   camera, snapped to the blade spacing. Each slot derives its jitter,
   height, colour and whether it exists at all from a hash of its WORLD
   cell — so when the window slides, a blade in the world keeps its exact
   look. Height, density and colour come from the terrain textures.

   TREES are procedural "painted" trees: soft blob canopies whose normals
   point out from the canopy centre, so they shade as one rounded mass the
   way a brush would paint them. Instanced per 200 m cell with a near and
   a far LOD so frustum culling and distance swaps both work.
   ═══════════════════════════════════════════════════════════════════════ */
const FOL = {
  grass: null, grassU: null,
  cells: [],               // { cx, cz, center: Vector3, parts: [{hi, lo}] }
  trees: [],               // [{x, z, r, type}] for colliders / map
  rocks: [],
};

/* ───────────── GRASS ───────────── */
function buildGrass() {
  const q = Q();
  const spacing = 0.34 / Math.sqrt(q.grass);
  const radius = q.grass >= 1 ? 58 : 44;
  const side = Math.ceil(radius * 2 / spacing);
  // blade: 3 segments, 7 vertices (x across, y 0..1 up)
  const bp = [], bi = [];
  const segs = 3;
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    if (s < segs) { bp.push(-1, t, 0, 1, t, 0); } else { bp.push(0, 1, 0); }
  }
  for (let s = 0; s < segs - 1; s++) { const a = s * 2; bi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const last = (segs - 1) * 2; bi.push(last, last + 1, last + 2);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  g.setIndex(bi);
  const cells = new Float32Array(side * side * 2);
  let k = 0;
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) { cells[k++] = i - side / 2; cells[k++] = j - side / 2; }
  g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
  g.instanceCount = side * side;

  const U = FOL.grassU = {
    uHeightTex: { value: TER.heightTex }, uGrassTex: { value: TER.grassTex }, uColorTex: { value: TER.colorTex },
    uN: { value: TER.N }, uM: { value: TER.colorM }, uExt: { value: WORLD.ext }, uCell: { value: WORLD.cell },
    uOriginCell: { value: new THREE.Vector2() }, uSpacing: { value: spacing }, uRadius: { value: radius },
    uTime: { value: 0 }, uWind: { value: 1 }, uPlayer: { value: new THREE.Vector3(0, -999, 0) },
  };
  const onShader = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */`#include <common>
        attribute vec2 aCell;
        uniform sampler2D uHeightTex, uGrassTex, uColorTex;
        uniform float uN, uM, uExt, uCell, uSpacing, uRadius, uTime, uWind;
        uniform vec2 uOriginCell; uniform vec3 uPlayer;
        varying vec3 vGrassCol; varying float vGrassT;
        float gH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', /* glsl */`
        vec2 wc = uOriginCell + aCell;
        vec2 wxz = (wc + vec2(gH(wc), gH(wc + 7.13))) * uSpacing;
        vec2 huv = ((wxz + uExt) / uCell + 0.5) / uN;
        float dens = texture2D(uGrassTex, huv).r;
        float keep = step(gH(wc + 17.3), dens);
        float gy = texture2D(uHeightTex, huv).r;
        float dcam = distance(wxz, cameraPosition.xz);
        float fade = 1.0 - smoothstep(uRadius * 0.62, uRadius, dcam);
        // knee height on a 1.7 m character; taller clumps only where it's dense
        float hgt = mix(0.22, 0.52, gH(wc + 3.1)) * mix(0.75, 1.25, dens) * keep * fade;
        float ang = gH(wc + 9.7) * 6.2831;
        vec2 dir = vec2(cos(ang), sin(ang));
        float t = position.y;
        float w = mix(0.065, 0.012, t * t) * step(0.001, hgt);
        vec3 p = vec3(wxz.x + dir.y * position.x * w, gy + t * hgt, wxz.y - dir.x * position.x * w);
        float wv = sin(uTime * 1.8 + wxz.x * 0.33 + wxz.y * 0.21) * 0.55 + sin(uTime * 3.3 + wxz.x * 1.4 + wxz.y * 0.9) * 0.2;
        vec2 bend = vec2(0.94, 0.34) * wv * uWind * 0.55 + dir * 0.18;
        vec2 away = wxz - uPlayer.xz; float pd = length(away);
        bend += away / max(pd, 0.001) * smoothstep(1.3, 0.15, pd) * 1.3 * step(abs(uPlayer.y - gy), 2.5);
        p.xz += bend * t * t * hgt;
        p.y -= length(bend) * t * t * hgt * 0.35;
        vec3 transformed = p;
        vec2 cuv = ((wxz + uExt) / (uCell * 2.0) + 0.5) / uM;
        vec3 gc = texture2D(uColorTex, cuv).rgb; gc *= gc;               // stored as sqrt(linear)
        float flower = step(0.985, gH(wc + 41.0)) * step(0.6, dens);
        vec3 fcol = mix(vec3(0.95, 0.9, 0.55), vec3(0.85, 0.45, 0.6), gH(wc + 5.0));
        vGrassCol = mix(gc * mix(0.85, 1.2, gH(wc + 5.5)), fcol, flower * smoothstep(0.7, 1.0, t));
        vGrassT = t;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrassCol; varying float vGrassT;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb = vGrassCol * mix(0.5, 1.18, vGrassT);')
      // double-sided would flip the normal on back faces and paint dark streaks
      // through every field; grass is lit like the ground it stands on, both sides
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );');
  };
  onShader.key = 'grass';
  const mat = toonMat({ side: THREE.DoubleSide, onShader });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;       // the window moves with the camera; bounds would lie
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  FOL.grass = mesh;
  scene.add(mesh);
}

function updateGrass(time, focus, player) {
  const U = FOL.grassU; if (!U) return;
  U.uTime.value = time;
  U.uWind.value = 0.7 + WEATHER.cur.rain * 0.8 + WEATHER.cur.cloud * 0.3;
  U.uOriginCell.value.set(Math.round(focus.x / U.uSpacing.value), Math.round(focus.z / U.uSpacing.value));
  if (player) U.uPlayer.value.copy(player);
}

/* ───────────── TREES ───────────── */
function spherizeNormals(geo, cx, cy, cz, amount) {
  const p = geo.attributes.position, n = geo.attributes.normal, v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) - cx, p.getY(i) - cy, p.getZ(i) - cz).normalize();
    w.set(n.getX(i), n.getY(i), n.getZ(i)).lerp(v, amount).normalize();
    n.setXYZ(i, w.x, w.y, w.z);
  }
}
function paint(geo, fn) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), c); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function canopyBlob(r, detail, seed) {
  // Icosahedrons come non-indexed (one normal per face). Weld first so the
  // blob gets smooth normals — otherwise every leaf mass reads as facets.
  let g = new THREE.IcosahedronGeometry(r, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const n = Noise.make(seed), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + n(x * 0.9 + seed, z * 0.9 + y) * 0.16;
    p.setXYZ(i, x * k, y * k * 0.86, z * k);
  }
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.count * 2), 2));
  return g;
}
function trunkGeo(h, r0, r1, segs, lean) {
  const g = new THREE.CylinderGeometry(r1, r0, h, segs, 3, true);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h; p.setX(i, p.getX(i) + lean * y * y * h); }
  g.computeVertexNormals();
  return g;
}
const BARK = new THREE.Color('#5b4a3a'), BARK_D = new THREE.Color('#362b22');
// Build one tree variant at two detail levels. Returns { hi, lo, height, trunkR }.
function makeTreeVariant(kind, seed) {
  const R = mulberry32(seed);
  const build = detail => {
    const parts = [];
    if (kind === 'broad' || kind === 'bush' || kind === 'oak') {
      const big = kind === 'oak';
      const h = kind === 'bush' ? 0.4 : big ? 5.2 + R() * 1.5 : 3.6 + R() * 1.6;
      const lean = (R() - 0.5) * 0.12;
      if (kind !== 'bush') parts.push(paint(trunkGeo(h + 1, big ? 0.75 : 0.42, big ? 0.38 : 0.2, detail ? 7 : 5, lean),
        (x, y, z, c) => c.copy(BARK_D).lerp(BARK, clamp(y / h, 0, 1))));
      const cx = lean * h * h * 0.08, cy = h + (kind === 'bush' ? 0.3 : 1.6), cz = 0;
      const blobs = kind === 'bush' ? 3 : big ? 9 : 6;
      const base = kind === 'bush' ? 0.9 : big ? 3.1 : 2.2;
      const canopy = [];
      for (let b = 0; b < blobs; b++) {
        const a = R() * TAU, rr = b === 0 ? 0 : base * (0.55 + R() * 0.45);
        const bg = canopyBlob(base * (b === 0 ? 1.05 : 0.62 + R() * 0.3), detail ? 1 : 0, seed + b * 13);
        bg.translate(cx + Math.cos(a) * rr, cy + (R() - 0.35) * base * 0.8, cz + Math.sin(a) * rr);
        canopy.push(bg);
      }
      const cg = mergeGeometries(canopy.map(x => x.index ? x.toNonIndexed() : x));
      spherizeNormals(cg, cx, cy - base * 0.3, cz, 0.72);
      const tint = R();
      const deep = new THREE.Color().setHSL(0.24 + tint * 0.05, 0.42, 0.14), lit = new THREE.Color().setHSL(0.20 + tint * 0.06, 0.48, 0.36);
      paint(cg, (x, y, z, c) => c.copy(deep).lerp(lit, clamp((y - cy + base) / (base * 2.2), 0, 1)));
      parts.push(cg);
      return { geo: mergeGeometries(parts.map(x => x.index ? x.toNonIndexed() : x)), height: cy + base, trunkR: big ? 0.7 : 0.4 };
    }
    if (kind === 'pine') {
      const h = 7 + R() * 4;
      parts.push(paint(trunkGeo(h * 0.5, 0.36, 0.18, detail ? 6 : 4, 0), (x, y, z, c) => c.copy(BARK_D).lerp(BARK, y / h)));
      const tiers = 4;
      for (let t = 0; t < tiers; t++) {
        const tt = t / tiers;
        const r = lerp(2.3, 0.7, tt) * (0.9 + R() * 0.2);
        const cone = new THREE.ConeGeometry(r, h * 0.38, detail ? 9 : 6, 1, false);
        cone.translate(0, h * (0.28 + tt * 0.58), 0);
        const p = cone.attributes.position;
        for (let i = 0; i < p.count; i++) if (p.getY(i) < h * (0.28 + tt * 0.58) - h * 0.15) {
          const a = Math.atan2(p.getZ(i), p.getX(i));
          const k = 1 + Math.sin(a * 5 + t) * 0.12;
          p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
        }
        cone.computeVertexNormals();
        parts.push(cone.toNonIndexed());
      }
      const cg = mergeGeometries(parts.slice(1));
      spherizeNormals(cg, 0, h * 0.5, 0, 0.45);
      const deep = new THREE.Color('#1c3325'), lit = new THREE.Color('#3f6b3d');
      paint(cg, (x, y, z, c) => c.copy(deep).lerp(lit, clamp(Math.hypot(x, z) / 2.2, 0, 1) * 0.6 + y / h * 0.4));
      return { geo: mergeGeometries([parts[0].toNonIndexed(), cg]), height: h, trunkR: 0.35 };
    }
    // dead tree: trunk + bare branches
    const h = 5 + R() * 2;
    parts.push(paint(trunkGeo(h, 0.38, 0.14, detail ? 6 : 4, 0.05), (x, y, z, c) => c.copy(BARK_D).lerp(BARK, y / h * 0.6)));
    for (let b = 0; b < (detail ? 6 : 3); b++) {
      const bl = 1.2 + R() * 1.6;
      const br = trunkGeo(bl, 0.12, 0.03, 4, 0);
      br.rotateZ((R() < 0.5 ? -1 : 1) * (0.6 + R() * 0.6)); br.rotateY(R() * TAU);
      br.translate(0, h * (0.45 + R() * 0.45), 0);
      parts.push(paint(br, (x, y, z, c) => c.copy(BARK_D)));
    }
    return { geo: mergeGeometries(parts.map(x => x.index ? x.toNonIndexed() : x)), height: h, trunkR: 0.35 };
  };
  const hi = build(1), lo = build(0);
  return { hi: hi.geo, lo: lo.geo, height: hi.height, trunkR: hi.trunkR };
}

function treeMaterial() {
  const onShader = shader => {
    shader.uniforms.uTime = FOL.windTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
        { vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sway = max(transformed.y - 1.5, 0.0) * 0.012;
          transformed.x += sin(uTime * 1.3 + ip.x * 0.17 + ip.z * 0.11) * sway;
          transformed.z += cos(uTime * 1.1 + ip.z * 0.13) * sway * 0.6; }`);
  };
  onShader.key = 'tree';
  return toonMat({ vertexColors: true, onShader });
}
FOL.windTime = { value: 0 };

function treeDensity(x, z, n) {
  if (Math.abs(x) > 790 || Math.abs(z) > 790) return 0;
  const i = terIndex(x, z), idx = Math.round(i[1]) * TER.N + Math.round(i[0]);
  if (TER.WATER[idx] > NO_WATER) return 0;
  if (TER.ROADD[idx] < ROAD_WIDTH * 0.5 + 3) return 0;
  if (TER.RIVD[idx] < RIVER_WIDTH * 0.5 + 3) return 0;
  const nn = normalAt(x, z, _tmpN);
  if (nn.y < 0.8) return 0;
  const h = TER.H[idx];
  if (h > 200) return 0;
  // clearings the player needs: village core, waystones, grove centre, camp, cave mouth
  if (Math.hypot(x - VILLAGE_BASIN.x, z - VILLAGE_BASIN.z) < 120) return 0.015;
  for (const w of WAYSTONES) if (Math.hypot(x - w.x, z - w.z) < 22) return 0;
  if (Math.hypot(x - GROVE.x, z - GROVE.z) < 48) return 0;
  if (Math.hypot(x - PLACES.camp.x, z - PLACES.camp.z) < 40) return 0;
  if (Math.hypot(x - PLACES.cave.x, z - PLACES.cave.z) < 45) return 0;
  if (Math.hypot(x - PLACES.ruinsE.x, z - PLACES.ruinsE.z) < 22) return 0;
  const forest = smooth(FOREST_ZONE.x0 - 30, FOREST_ZONE.x0 + 90, x) * (1 - smooth(FOREST_ZONE.z1 - 50, FOREST_ZONE.z1 + 60, z));
  const patchy = smooth(-0.1, 0.5, n(x / 90, z / 90));
  const bank = (1 - smooth(10, 40, TER.RIVD[idx])) * 0.25;
  const north = smooth(-380, -520, z) * 0.35;          // woods below the cliffs
  const ridge = smooth(38, 70, h) * (1 - forest) * 0.18;
  return clamp(forest * (0.55 + patchy * 0.45) + patchy * 0.05 + bank + north * patchy + ridge, 0, 0.95);
}
const _tmpN = new THREE.Vector3();

async function buildTrees() {
  const q = Q();
  const n = Noise.make(WORLD.seed + 77), R = mulberry32(WORLD.seed + 78);
  const kinds = [
    { kind: 'broad', seed: 11 }, { kind: 'broad', seed: 12 }, { kind: 'oak', seed: 13 },
    { kind: 'pine', seed: 14 }, { kind: 'pine', seed: 15 }, { kind: 'bush', seed: 16 }, { kind: 'dead', seed: 17 },
  ];
  const variants = kinds.map(k => ({ ...k, ...makeTreeVariant(k.kind, k.seed) }));
  const mat = treeMaterial();
  const CELL = 200, per = Math.ceil(1600 / CELL);
  const buckets = new Map();
  const step = 7.5 / Math.sqrt(q.trees);
  for (let z = -790; z < 790; z += step) {
    for (let x = -790; x < 790; x += step) {
      const px = x + (R() - 0.5) * step * 0.9, pz = z + (R() - 0.5) * step * 0.9;
      const d = treeDensity(px, pz, n);
      if (R() > d) continue;
      const h = heightAt(px, pz);
      const coldness = smooth(-300, -560, pz) + smooth(60, 140, h);
      let vi;
      const r = R();
      if (r < 0.14) vi = 5;                                            // bush
      else if (r < 0.14 + 0.5 * clamp(coldness, 0, 1) + 0.12) vi = R() < 0.5 ? 3 : 4;  // pine
      else if (r < 0.95) vi = R() < 0.18 ? 2 : (R() < 0.5 ? 0 : 1);   // broadleaf / oak
      else vi = 6;                                                     // dead
      const s = 0.8 + R() * 0.55;
      const key = Math.floor((px + 800) / CELL) + ',' + Math.floor((pz + 800) / CELL);
      if (!buckets.has(key)) buckets.set(key, variants.map(() => []));
      buckets.get(key)[vi].push([px, h - 0.15, pz, R() * TAU, s]);
      FOL.trees.push({ x: px, z: pz, r: vi === 5 ? 0 : variants[vi].trunkR * s, kind: variants[vi].kind, h: variants[vi].height * s });
    }
  }
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const [key, lists] of buckets) {
    const [cx, cz] = key.split(',').map(Number);
    const cell = { center: new THREE.Vector3(cx * CELL - 800 + CELL / 2, 30, cz * CELL - 800 + CELL / 2), parts: [] };
    lists.forEach((list, vi) => {
      if (!list.length) return;
      const mk = geo => {
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((t, i) => {
          qt.setFromAxisAngle(up, t[3]); sc.setScalar(t[4]); ps.set(t[0], t[1], t[2]);
          im.setMatrixAt(i, m4.compose(ps, qt, sc));
        });
        im.castShadow = true; im.receiveShadow = true;
        im.computeBoundingSphere();
        scene.add(im);
        return im;
      };
      cell.parts.push({ hi: mk(variants[vi].hi), lo: mk(variants[vi].lo) });
    });
    FOL.cells.push(cell);
  }
}

function updateTrees(time) {
  FOL.windTime.value = time;
  if (FOL.hidden) { for (const c of FOL.cells) for (const p of c.parts) p.hi.visible = p.lo.visible = false; return; }
  const cp = camera.position;
  for (const c of FOL.cells) {
    const d = Math.hypot(c.center.x - cp.x, c.center.z - cp.z);
    const near = d < 260;
    for (const p of c.parts) { p.hi.visible = near; p.lo.visible = !near; }
  }
}

/* ───────────── ROCKS (KayKit set pieces, scattered) ───────────── */
function scatterRocks() {
  const R = mulberry32(WORLD.seed + 91), n = Noise.make(WORLD.seed + 92);
  const names = ['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E'];
  const lists = names.map(() => []);
  for (let i = 0; i < 2600; i++) {
    const x = (R() - 0.5) * 1560, z = (R() - 0.5) * 1560;
    const ii = terIndex(x, z), idx = Math.round(ii[1]) * TER.N + Math.round(ii[0]);
    if (TER.WATER[idx] > NO_WATER || TER.ROADD[idx] < 6) continue;
    const nn = normalAt(x, z, _tmpN);
    const steep = 1 - nn.y;
    const bank = 1 - smooth(8, 18, TER.RIVD[idx]);
    const p = steep * 2.2 + bank * 0.5 + smooth(0.4, 0.9, n(x / 60, z / 60)) * 0.12;
    if (R() > p) continue;
    if (Math.hypot(x - VILLAGE_BASIN.x, z - VILLAGE_BASIN.z) < 90) continue;
    const s = (0.8 + R() * 1.6) * (1 + steep * 2);
    lists[(R() * names.length) | 0].push([x, heightAt(x, z) - 0.3 * s, z, R() * TAU, s]);
    FOL.rocks.push({ x, z, r: 0.9 * s });
  }
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  names.forEach((nm, k) => {
    const src = PROPS_LIB.get(nm);
    if (!src || !lists[k].length) return;
    src.traverse(o => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, propMaterial(), lists[k].length);
      o.updateWorldMatrix(true, false);
      lists[k].forEach((t, i) => {
        qt.setFromAxisAngle(up, t[3]); sc.setScalar(t[4] * 1.6); ps.set(t[0], t[1], t[2]);
        im.setMatrixAt(i, m4.compose(ps, qt, sc).multiply(o.matrixWorld));
      });
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere();
      scene.add(im);
      (FOL.rockMeshes || (FOL.rockMeshes = [])).push(im);
    });
  });
}
