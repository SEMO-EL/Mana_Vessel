/* ═══════════════════════════════════════════════════════════════════════
   THE WASTE, DRESSED — what stands on the Demon Continent's ground.

   Built once, right after the strip is raised (buildDemonDressing):
     rocks      the KayKit boulders, stained red, thickest under the mesas
     spires     stacked, banded stone needles; a forest of black ones on
                the storm plateau, one alone where you wake
     dead trees bare and twisted, round the Migurd valley and the canyon
     the bones  a beast sixty metres long, ribs you walk under
     Migurd     a palisade, round huts, the elder's longhouse, a well
     the nest   what's left of the caravans it ate, half in the sand
   Everything rigid is merged into a few meshes; colliders are the usual
   circles and boxes, so you walk round the spires and under the ribs.
   ═══════════════════════════════════════════════════════════════════════ */
const DC_DRESS = { rocks: 0, spires: 0, trees: 0, huts: [], mats: {}, spireAt: [], treeAt: [], wagons: [], skel: null };
const DC_WAYSTONES = [
  { id: 'dcWake',   x: 318, z: 2006, name: 'The Red Waste' },
  { id: 'dcMigurd', x: 392, z: 1626, name: 'Migurd Village' },
  { id: 'dcBones',  x: 676, z: 1838, name: 'The Bone Field' },
  { id: 'dcStorm',  x: 952, z: 1752, name: 'Storm\'s Edge' },
  { id: 'dcNest',   x: 1180, z: 1866, name: 'The Nest\'s Rim' },
];

function dcMat(key, opts) { return DC_DRESS.mats[key] || (DC_DRESS.mats[key] = toonMat(opts)); }
// is this spot open ground: off the track, clear of the places, not in the nest's sand
function dcOpen(x, z, track = 9, spots = 1) {
  if (x < DEMON.px0 - 60 || x > DEMON.px1 + 60 || z < DEMON.pz0 - 60 || z > DEMON.pz1 + 60) return false;
  if (roadDistAt(x, z) < track) return false;
  for (const k in DC_SPOTS) { if (k === 'storm') continue; const P = DC_SPOTS[k]; if (Math.hypot(x - P.x, z - P.z) < P.r * spots + 8) return false; }
  for (const W of DC_WAYSTONES) if (Math.hypot(x - W.x, z - W.z) < 9) return false;
  return true;
}

function buildDemonDressing() {
  const R = mulberry32(WORLD.seed + 777);
  dcRocks(R);
  dcSpires(R);
  dcDeadTrees(R);
  dcSkeleton();
  dcMigurdVillage(R);
  dcNestWreckage(R);
  for (const w of DC_WAYSTONES) buildWaystone(w);
  if (typeof buildDemonPeople === 'function') buildDemonPeople();
  batchStaticProps();                       // the fences and props just placed join the static batch
}

/* ───────────── rocks: the same boulders, stained by the dust ───────────── */
function dcRocks(R) {
  const names = ['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E'];
  const lists = names.map(() => []), n = Noise.make(WORLD.seed + 790), tN = new THREE.Vector3();
  for (let i = 0; i < 2600; i++) {
    const x = lerp(DEMON.px0 - 50, DEMON.px1 + 50, R()), z = lerp(DEMON.pz0 - 50, DEMON.pz1 + 50, R());
    if (!dcOpen(x, z, 6, 0.6)) { R(); R(); R(); R(); continue; }
    const nn = normalAt(x, z, tN), steep = 1 - nn.y;
    const p = steep * 2.4 + smooth(0.4, 0.9, n(x / 60, z / 60)) * 0.1 + (1 - smooth(4, 14, dcCanyonAt(Math.round((z - WORLD.z0) / WORLD.cell) * TER.NX + Math.round((x - WORLD.x0) / WORLD.cell)))) * 0.25;
    if (R() > p) { R(); R(); R(); continue; }
    const s = (0.8 + R() * 1.7) * (1 + steep * 2), k = (R() * names.length) | 0, rot = R() * TAU, y = heightAt(x, z) - 0.3 * s;
    lists[k].push([x, y, z, rot, s]);
    if (PROPS_LIB.has(names[k])) {
      const sz = propSize(names[k]), S = s * 1.6, rr = Math.max(sz.hx, sz.hz) * S * 0.72;
      addCircle(x, z, rr, y - 1, y + sz.maxY * S * 0.92, 'rock').thin = rr < 1.5;
    }
    DC_DRESS.rocks++;
  }
  const mat = dcMat('rock', { map: propMaterial().map, color: '#d6a690' });
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  names.forEach((nm, k) => {
    const src = PROPS_LIB.get(nm);
    if (!src || !lists[k].length) return;
    src.traverse(o => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, mat, lists[k].length);
      o.updateWorldMatrix(true, false);
      lists[k].forEach((t, i) => { qt.setFromAxisAngle(up, t[3]); sc.setScalar(t[4] * 1.6); ps.set(t[0], t[1], t[2]); im.setMatrixAt(i, m4.compose(ps, qt, sc).multiply(o.matrixWorld)); });
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
      STRUCT.group.add(im);
    });
  });
}

/* ───────────── spires: stacked bands of stone, tapering ───────────── */
const _sn = Noise.make(4049);
function spirePieces(out, x, z, h, r, R, palette) {
  const y0 = heightAt(x, z) - 1.2;
  const segs = Math.max(3, Math.round(h / 3.2));
  let y = y0, rr = r;
  for (let k = 0; k < segs; k++) {
    const sh = h / segs * (0.8 + R() * 0.4), top = rr * (0.78 + R() * 0.12);
    const g = new THREE.CylinderGeometry(top, rr, sh, 6, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k2 = 1 + _sn(p.getX(i) * 0.9 + x, p.getZ(i) * 0.9 + p.getY(i) + z) * 0.16; p.setXYZ(i, p.getX(i) * k2, p.getY(i), p.getZ(i) * k2); }
    g.computeVertexNormals();
    out.push([g, palette[k % palette.length], x + (R() - 0.5) * 0.3, y + sh / 2, z + (R() - 0.5) * 0.3, 1, 1, 1, 0, R() * TAU, 0]);
    y += sh * 0.96; rr = top;
  }
  out.push([new THREE.ConeGeometry(rr, rr * 1.6, 6), palette[segs % palette.length], x, y + rr * 0.8, z, 1, 1, 1, 0, R() * TAU, 0]);
  addCircle(x, z, r * 0.95, y0, y0 + h + 1, 'spire');
  DC_DRESS.spires++; DC_DRESS.spireAt.push([x, z, r, palette[0]]);
}
function dcSpires(R) {
  const red = ['#6e4436', '#8a5a44', '#5a3a30', '#7c4c3a'], black = ['#3b302d', '#4a3c37', '#2f2725', '#433530'], sand = ['#a8865e', '#bd9a6e', '#977552'];
  const pieces = [], dark = [];
  // the one where you wake: alone, tall, the first thing you see
  spirePieces(pieces, DC_SPOTS.wake.x - 22, DC_SPOTS.wake.z - 14, 22, 2.6, R, red);
  // the storm plateau: a forest of black needles
  const S = DC_SPOTS.storm;
  for (let i = 0, n = 0; i < 400 && n < 26; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * S.r * 0.85, x = S.x + Math.cos(a) * d, z = S.z + Math.sin(a) * d;
    if (!dcOpen(x, z, 10, 1) || Math.hypot(x - DC_WAYSTONES[3].x, z - DC_WAYSTONES[3].z) < 14) continue;
    spirePieces(dark, x, z, 7 + R() * 16, 1.1 + R() * 1.6, R, black); n++;
  }
  // a few out on the waste, and sandstone ones round the nest
  for (let i = 0, n = 0; i < 400 && n < 22; i++) {
    const x = lerp(DEMON.px0, DEMON.px1, R()), z = lerp(DEMON.pz0, DEMON.pz1, R());
    if (!dcOpen(x, z, 14, 1.4) || dcStormW(x, z) > 0.2) continue;
    spirePieces(pieces, x, z, 6 + R() * 12, 1 + R() * 1.4, R, red); n++;
  }
  const N = DC_SPOTS.nest;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU + 0.4, x = N.x + Math.cos(a) * (N.r + 16 + R() * 10), z = N.z + Math.sin(a) * (N.r + 16 + R() * 10);
    if (roadDistAt(x, z) < 10) continue;
    spirePieces(pieces, x, z, 6 + R() * 7, 1 + R() * 0.8, R, sand);
  }
  const mat = dcMat('vc', { vertexColors: true });
  for (const list of [pieces, dark]) if (list.length) { const m = mergedPart(list, mat); m.receiveShadow = true; STRUCT.group.add(m); }
}

/* ───────────── dead trees ───────────── */
function deadTreePieces(out, x, z, s, R) {
  const y = heightAt(x, z) - 0.2, lean = (R() - 0.5) * 0.25, h = 3.4 * s;
  const bark = R() < 0.5 ? '#3b2e28' : '#4a3a30';
  const trunk = new THREE.CylinderGeometry(0.12 * s, 0.3 * s, h, 5); trunk.translate(0, h / 2, 0);
  out.push([trunk, bark, x, y, z, 1, 1, 1, lean, 0, lean * 0.6]);
  const n = 3 + ((R() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const bl = (0.9 + R() * 1.1) * s, b = new THREE.CylinderGeometry(0.02 * s, 0.09 * s, bl, 4); b.translate(0, bl / 2, 0);
    const a = R() * TAU, up = 0.5 + R() * 0.6, by = h * (0.5 + R() * 0.45);
    out.push([b, bark, x + Math.sin(lean) * by, y + by, z, 1, 1, 1, Math.cos(a) * up, 0, Math.sin(a) * up]);
  }
  addCircle(x, z, 0.3 * s, y - 1, y + h, 'tree').thin = true;
  DC_DRESS.trees++; DC_DRESS.treeAt.push([x, z]);
}
function dcDeadTrees(R) {
  const out = [], M = DC_SPOTS.migurd;
  // a broken ring round the Migurd valley, on its low hills
  for (let i = 0, n = 0; i < 300 && n < 18; i++) {
    const a = R() * TAU, d = 70 + R() * 70, x = M.x + Math.cos(a) * d, z = M.z + Math.sin(a) * d;
    if (!dcOpen(x, z, 8, 0.9)) continue;
    deadTreePieces(out, x, z, 0.9 + R() * 0.6, R); n++;
  }
  // along the canyon, and here and there
  for (let i = 0, n = 0; i < 600 && n < 30; i++) {
    const x = lerp(DEMON.px0, DEMON.px1, R()), z = lerp(DEMON.pz0, DEMON.pz1, R());
    if (!dcOpen(x, z, 8, 1.2) || dcStormW(x, z) > 0.3) continue;
    const ci = Math.round((z - WORLD.z0) / WORLD.cell) * TER.NX + Math.round((x - WORLD.x0) / WORLD.cell), cd = dcCanyonAt(ci);
    if (cd > 30 && R() > 0.25) continue;
    deadTreePieces(out, x, z, 0.8 + R() * 0.7, R); n++;
  }
  if (out.length) STRUCT.group.add(mergedPart(out, dcMat('vc', { vertexColors: true })));
}

/* ───────────── the bones: something enormous died here, long ago ───────────── */
function dcSkeleton() {
  const B = DC_SPOTS.bones, y0 = (B.lv ?? heightAt(B.x, B.z)) - 0.8;
  const dir = new THREE.Vector3(Math.cos(0.5), 0, Math.sin(0.5)), side = new THREE.Vector3(-dir.z, 0, dir.x), up = new THREE.Vector3(0, 1, 0);
  const bone = '#d9cdb2', boneD = '#b3a283', out = [];
  const at = (t, s, h) => new THREE.Vector3(B.x, y0, B.z).addScaledVector(dir, t).addScaledVector(side, s).addScaledVector(up, h);
  const tube = (pts, r, col) => { const c = new THREE.CatmullRomCurve3(pts); out.push([new THREE.TubeGeometry(c, 18, r, 6, false), col, 0, 0, 0]); };
  // the spine, sagging between shoulders and hips
  const spine = [];
  for (let i = 0; i <= 12; i++) { const t = -26 + i * 4.6; spine.push(at(t, 0, 11.5 - Math.pow((i - 6) / 6, 2) * 2.5 - (i > 9 ? (i - 9) * 1.6 : 0))); }
  tube(spine, 0.75, boneD);
  DC_DRESS.skel = { spine: spine.map(p => [p.x, p.z]), ribs: [], skull: null };
  for (let i = 1; i < 12; i++) out.push([new THREE.BoxGeometry(1.1, 1.6, 0.9), bone, spine[i].x, spine[i].y + 0.9, spine[i].z, 1, 1, 1, 0, -0.5, 0]);
  // ribs: eleven pairs arching down into the dust (the last few broken short)
  for (let i = 0; i < 11; i++) {
    const t = -20 + i * 3.9, top = spine[Math.min(12, Math.round((t + 26) / 4.6))].y - y0, w = 7.5 + Math.sin(i / 10 * Math.PI) * 2.2;
    for (const s of [-1, 1]) {
      const broken = i > 7 && (i + s) % 3 === 0;
      const pts = [at(t, 0, top), at(t + 0.6, s * w * 0.62, top * 0.98), at(t + 1.1, s * w, top * 0.5)];
      if (!broken) pts.push(at(t + 1.3, s * w * 0.9, -0.6));
      tube(pts, 0.42 - i * 0.012, i % 2 ? bone : boneD);
      if (!broken) { const f = at(t + 1.3, s * w * 0.9, 0); addCircle(f.x, f.z, 0.7, y0 - 1, y0 + 6, 'bone'); }
      const a0 = at(t, 0, 0), a1 = at(t + 1.2, s * w * (broken ? 0.85 : 1), 0);
      DC_DRESS.skel.ribs.push([a0.x, a0.z, a1.x, a1.z]);
    }
  }
  // the skull, at the head end: a long brow, sockets, a jaw in the sand, two horns sweeping back
  const sk = at(-31, 0, 4.2);
  out.push([new THREE.SphereGeometry(1, 12, 8), bone, sk.x, sk.y, sk.z, 3.4, 2.6, 5.2, 0, -0.5 + Math.PI / 2, 0]);
  const snout = at(-35.5, 0, 2.6); out.push([new THREE.SphereGeometry(1, 10, 6), boneD, snout.x, snout.y, snout.z, 2.2, 1.7, 3.2, 0, -0.5 + Math.PI / 2, 0]);
  for (const s of [-1, 1]) {
    const e = at(-32.2, s * 2.1, 5.2); out.push([new THREE.SphereGeometry(0.85, 8, 6), '#2a2220', e.x, e.y, e.z]);
    tube([at(-30, s * 2.6, 6.4), at(-27, s * 5.5, 9.5), at(-22.5, s * 6.2, 9.8), at(-20, s * 5.2, 8.2)], 0.55, boneD);
    const jaw = at(-34, s * 1.8, 0.3); out.push([new THREE.BoxGeometry(0.7, 0.8, 6), bone, jaw.x, jaw.y, jaw.z, 1, 1, 1, 0, -0.5 + Math.PI / 2 + s * 0.12, 0]);
  }
  addCircle(sk.x, sk.z, 4.2, y0 - 1, y0 + 8, 'bone');
  DC_DRESS.skel.skull = [sk.x, sk.z, snout.x, snout.z];
  // the tail, vertebrae trailing off and going under
  for (let i = 0; i < 9; i++) { const p = at(30 + i * 2.6, Math.sin(i * 0.5) * 2, 2.2 - i * 0.32); out.push([new THREE.BoxGeometry(1.1 - i * 0.08, 0.9 - i * 0.06, 1.2), i % 2 ? bone : boneD, p.x, p.y, p.z, 1, 1, 1, 0, -0.5 + i * 0.1, 0]); }
  // a scatter of smaller bones round it
  const R = mulberry32(5150);
  for (let i = 0; i < 22; i++) {
    const a = R() * TAU, d = 16 + R() * 28, x = B.x + Math.cos(a) * d, z = B.z + Math.sin(a) * d, y = heightAt(x, z);
    out.push([new THREE.CylinderGeometry(0.12, 0.16, 1.4 + R() * 1.6, 5), R() < 0.5 ? bone : boneD, x, y + 0.08, z, 1, 1, 1, Math.PI / 2, R() * TAU, 0]);
  }
  const m = mergedPart(out, dcMat('vc', { vertexColors: true })); m.receiveShadow = true;
  STRUCT.group.add(m);
}

/* ───────────── the Migurd village ───────────── */
// a round hut: a mud-brick drum, a thatched cone, a doorway hung with blue cloth (facing `face`)
function hutPieces(out, x, z, face, s = 1) {
  const y = heightAt(x, z) - 0.15, r = 2.6 * s, wall = 2.2 * s;
  const dx = Math.sin(face), dz = Math.cos(face);
  out.push([new THREE.CylinderGeometry(r, r * 1.06, wall, 12), '#a89070', x, y + wall / 2, z]);
  out.push([new THREE.CylinderGeometry(r * 1.02, r * 1.08, 0.35, 12), '#8a7258', x, y + 0.17, z]);
  out.push([new THREE.ConeGeometry(r * 1.38, 2.5 * s, 12), '#7d6a4c', x, y + wall + 1.2 * s, z]);
  out.push([new THREE.ConeGeometry(r * 0.42, 0.9 * s, 8), '#5e4e38', x, y + wall + 2.35 * s, z]);
  out.push([new THREE.BoxGeometry(1.0 * s, 1.65 * s, 0.4), '#2a2220', x + dx * r * 0.93, y + 0.85 * s, z + dz * r * 0.93, 1, 1, 1, 0, face, 0]);
  out.push([new THREE.BoxGeometry(1.1 * s, 1.1 * s, 0.06), '#3f5f94', x + dx * (r + 0.1), y + 1.15 * s, z + dz * (r + 0.1), 1, 1, 1, 0, face, 0]);
  addCircle(x, z, r * 1.04, y - 1, y + wall + 2.6 * s, 'hut');
  DC_DRESS.huts.push({ x, z, face, door: new THREE.Vector3(x + dx * (r + 1.2), y, z + dz * (r + 1.2)) });
}
function dcMigurdVillage(R) {
  const M = DC_SPOTS.migurd, out = [], ring = 34;
  // the palisade: a circle of stakes, a gate east toward the track, an opening south where it arrives
  for (let i = 0; i < 48; i++) {
    const a = (i + 0.5) / 48 * TAU;
    if (Math.abs(wrapAngle(a - 0.1)) < 0.16 || Math.abs(wrapAngle(a - 1.4)) < 0.13) continue;
    const x = M.x + Math.cos(a) * ring, z = M.z + Math.sin(a) * ring;
    placeProp('fence_wood_straight', x, z, { s: 3.8, rot: -a, pad: 0.6 });
  }
  // gateposts with skull totems (horned, bleached): the Migurd's warning to the waste
  for (const [ga, gw] of [[0.1, 0.16], [1.4, 0.13]]) for (const s of [-1, 1]) {
    const a = ga + s * gw, x = M.x + Math.cos(a) * ring, z = M.z + Math.sin(a) * ring, y = heightAt(x, z);
    out.push([new THREE.CylinderGeometry(0.2, 0.26, 3.6, 6), '#4a3a2c', x, y + 1.8, z]);
    out.push([new THREE.SphereGeometry(0.42, 8, 6), '#d9cdb2', x, y + 3.75, z, 1, 0.85, 1.25]);
    for (const h of [-1, 1]) out.push([new THREE.ConeGeometry(0.1, 0.7, 5), '#c8b998', x + h * 0.38, y + 4.1, z, 1, 1, 1, 0, 0, -h * 0.6]);
    addCircle(x, z, 0.3, y - 1, y + 4, 'post');
  }
  // round huts in two rings, doors toward the square
  const spots = [[14, 0.9], [14, 2.1], [14, 3.4], [14, 4.0], [24, 0.5], [24, 1.9], [24, 2.6], [24, 3.3], [25, 4.2], [24, 5.3]];
  for (const [d, a] of spots) {
    const x = M.x + Math.cos(a) * d, z = M.z + Math.sin(a) * d;
    hutPieces(out, x, z, Math.atan2(M.x - x, M.z - z), d > 20 ? 1 : 1.15);
  }
  // the elder's longhouse, north side, door to the square
  const L = { x: M.x - 2, z: M.z - 22 }, ly = heightAt(L.x, L.z) - 0.15;
  out.push([new THREE.BoxGeometry(11, 2.6, 5.4), '#a08868', L.x, ly + 1.3, L.z]);
  for (const s of [-1, 1]) out.push([new THREE.BoxGeometry(11.6, 0.3, 3.7), '#7d6a4c', L.x, ly + 3.35, L.z + s * 1.45, 1, 1, 1, s * 0.62, 0, 0]);
  out.push([new THREE.BoxGeometry(1.4, 2.0, 0.4), '#2a2220', L.x, ly + 1.0, L.z + 2.72]);
  out.push([new THREE.BoxGeometry(1.5, 1.4, 0.06), '#3f5f94', L.x, ly + 1.35, L.z + 2.94]);
  addBox(L.x, L.z, 5.6, 2.8, 0, ly - 1, ly + 4.2, 'longhouse');
  DC_DRESS.longhouse = { x: L.x, z: L.z + 4.2, y: ly };
  // the square: a fire pit of blackened stones, drying racks with hides, a well
  const fy = heightAt(M.x + 3, M.z + 4);
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; out.push([new THREE.DodecahedronGeometry(0.32, 0), '#3a3230', M.x + 3 + Math.cos(a) * 1.1, fy + 0.15, M.z + 4 + Math.sin(a) * 1.1]); }
  for (let i = 0; i < 4; i++) out.push([new THREE.CylinderGeometry(0.09, 0.11, 1.6, 5), '#2a201a', M.x + 3, fy + 0.25, M.z + 4, 1, 1, 1, Math.PI / 2, i * 0.8, 0]);
  DC_DRESS.fire = new THREE.Vector3(M.x + 3, fy + 0.4, M.z + 4);
  for (const [dx, dz, rot] of [[-9, 7, 0.4], [10, -6, -0.3], [-11, -5, 1.2]]) {
    const x = M.x + dx, z = M.z + dz, y = heightAt(x, z);
    for (const s of [-1, 1]) out.push([new THREE.CylinderGeometry(0.07, 0.09, 2.2, 5), '#4a3a2c', x + Math.cos(rot) * s * 1.2, y + 1.1, z - Math.sin(rot) * s * 1.2]);
    out.push([new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), '#4a3a2c', x, y + 2.1, z, 1, 1, 1, 0, rot, Math.PI / 2]);
    out.push([new THREE.BoxGeometry(1.9, 1.2, 0.05), R() < 0.5 ? '#8a6a4a' : '#6e5a44', x, y + 1.45, z, 1, 1, 1, 0, rot, 0]);
    addBox(x, z, 1.3, 0.2, -rot, y - 1, y + 2.2, 'rack');
  }
  placeProp('building_well_red', M.x - 6, M.z + 2, { s: 6, rot: 0.4, mat: ruinMaterial() });
  for (const [dx, dz, k] of [[7, 12, 'crate_A_small'], [8.4, 12.6, 'sack'], [-14, 10, 'barrel'], [-13.2, 11.2, 'sack'], [12, -12, 'crate_B_big'], [-4, -15, 'barrel']]) placeProp(k, M.x + dx, M.z + dz, { s: k.startsWith('crate') ? 2.4 : 2.6, rot: R() * TAU, pad: 0.8 });
  const m = mergedPart(out, dcMat('vc', { vertexColors: true })); m.receiveShadow = true;
  STRUCT.group.add(m);
}

/* ───────────── the nest: the caravans it ate ───────────── */
function wagonPieces(out, x, z, rot, tilt, R) {
  const y = heightAt(x, z) - 0.35, c = Math.cos(rot), s = Math.sin(rot);
  const L = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const wood = '#5e4632', woodD = '#46342a';
  out.push([new THREE.BoxGeometry(1.9, 0.25, 4.0), wood, ...L(0, 0.75, 0), 1, 1, 1, tilt, rot, tilt * 0.4]);
  for (const sd of [-1, 1]) out.push([new THREE.BoxGeometry(0.12, 0.6, 3.9), woodD, ...L(sd * 0.92, 1.1, 0), 1, 1, 1, tilt, rot, 0]);
  // two wheels still on, one lying flat beside it
  for (const [lx, lz] of [[-1.05, -1.3], [1.05, 1.3]]) out.push([new THREE.CylinderGeometry(0.62, 0.62, 0.14, 10), woodD, ...L(lx, 0.55, lz), 1, 1, 1, 0, rot, Math.PI / 2]);
  out.push([new THREE.CylinderGeometry(0.62, 0.62, 0.14, 10), woodD, ...L(2.0, 0.12, 0.6), 1, 1, 1, 0.1, 0, 0]);
  // the canvas hoops, most of the canvas gone
  for (const lz of [-1.4, 0, 1.4]) out.push([new THREE.TorusGeometry(0.95, 0.05, 4, 10, Math.PI), woodD, ...L(0, 1.0, lz), 1, 1, 1, 0, rot + Math.PI / 2, 0]);
  out.push([new THREE.CylinderGeometry(0.97, 0.97, 1.5, 10, 1, true, 0, Math.PI * 0.6), '#cbbd9e', ...L(0, 1.0, 0.7), 1, 1, 1, Math.PI / 2, rot, 0]);
  addBox(x, z, 1.1, 2.1, -rot, y - 1, y + 1.6, 'wagon');
  DC_DRESS.wagons.push([x, z, rot]);
}
function dcNestWreckage(R) {
  const N = DC_SPOTS.nest, out = [];
  for (const [a, d, rot, tilt] of [[3.6, N.r + 6, 0.8, 0.12], [4.3, N.r - 4, 2.3, -0.2], [5.2, N.r + 9, 1.6, 0.05]]) {
    wagonPieces(out, N.x + Math.cos(a) * d, N.z + Math.sin(a) * d, rot, tilt, R);
  }
  // spilled cargo, half buried
  for (let i = 0; i < 14; i++) {
    const a = 3.3 + R() * 2.4, d = N.r - 10 + R() * 22, x = N.x + Math.cos(a) * d, z = N.z + Math.sin(a) * d;
    placeProp(pick(['crate_A_small', 'sack', 'barrel', 'crate_open']), x, z, { s: 2.4, rot: R() * TAU, sink: 0.35 + R() * 0.3, pad: 0.8 });
  }
  // ribs of things it ate, sticking up out of the sand
  const bone = '#d9cdb2';
  for (let i = 0; i < 9; i++) {
    const a = R() * TAU, d = R() * N.r * 0.8, x = N.x + Math.cos(a) * d, z = N.z + Math.sin(a) * d, y = heightAt(x, z);
    const h = 2 + R() * 3, curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, y - 0.5, z), new THREE.Vector3(x + 0.6, y + h * 0.6, z + 0.2), new THREE.Vector3(x + 1.6, y + h, z + 0.4)]);
    out.push([new THREE.TubeGeometry(curve, 8, 0.16, 5, false), bone, 0, 0, 0, 1, 1, 1, 0, 0, 0]);
  }
  const m = mergedPart(out, dcMat('vc', { vertexColors: true })); m.receiveShadow = true;
  STRUCT.group.add(m);
}

/* ───────────── on the map: the waste's own marks ───────────── */
// Called by mapBuild for the Demon Continent's sheet (map px via mapX/mapY, MAP_PPM px per metre).
function mapPaintDemon(ctx) {
  const S = MAP_PPM, D = DC_DRESS;
  ctx.lineCap = ctx.lineJoin = 'round';
  // the nest: a stippled sand bowl
  const N = DC_SPOTS.nest, NX = mapX(N.x), NY = mapY(N.z), NR = N.r * S;
  const g = ctx.createRadialGradient(NX, NY, NR * 0.2, NX, NY, NR * 1.25);
  g.addColorStop(0, 'rgba(232,212,160,0.75)'); g.addColorStop(0.75, 'rgba(222,196,140,0.45)'); g.addColorStop(1, 'rgba(222,196,140,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(NX, NY, NR * 1.25, 0, TAU); ctx.fill();
  const R = mulberry32(919);
  ctx.fillStyle = 'rgba(120,90,50,0.35)';
  for (let i = 0; i < 260; i++) { const a = R() * TAU, d = Math.sqrt(R()) * NR; ctx.fillRect(NX + Math.cos(a) * d, NY + Math.sin(a) * d, 1.2, 1.2); }
  ctx.strokeStyle = 'rgba(90,64,36,0.5)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.arc(NX, NY, NR, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  // the storm: rain hatching over the plateau
  const T = DC_SPOTS.storm, TX = mapX(T.x), TY = mapY(T.z), TR = T.r * S;
  ctx.save(); ctx.beginPath(); ctx.arc(TX, TY, TR, 0, TAU); ctx.clip();
  ctx.strokeStyle = 'rgba(60,70,96,0.28)'; ctx.lineWidth = 1;
  ctx.beginPath(); for (let k = -TR * 2; k < TR * 2; k += 7) { ctx.moveTo(TX + k - TR, TY - TR); ctx.lineTo(TX + k + TR * 0.4, TY + TR); } ctx.stroke();
  ctx.restore();
  // spires: little inked needles, black on the plateau
  for (const [x, z, r, col] of D.spireAt) {
    const X = mapX(x), Y = mapY(z), w = Math.max(1.6, r * S * 0.9), h = w * 2.4;
    ctx.beginPath(); ctx.moveTo(X, Y - h); ctx.lineTo(X + w, Y + w * 0.5); ctx.lineTo(X - w, Y + w * 0.5); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 0.7; ctx.strokeStyle = MAP_COL.ink; ctx.stroke();
  }
  // dead trees: scratches
  ctx.strokeStyle = 'rgba(58,42,30,0.8)'; ctx.lineWidth = 0.9; ctx.beginPath();
  for (const [x, z] of D.treeAt) { const X = mapX(x), Y = mapY(z); ctx.moveTo(X, Y + 2.5); ctx.lineTo(X, Y - 2.5); ctx.moveTo(X, Y - 1); ctx.lineTo(X + 2, Y - 3); ctx.moveTo(X, Y - 0.2); ctx.lineTo(X - 2, Y - 2.2); }
  ctx.stroke();
  // the bones: spine, ribs and skull, drawn the way a surveyor would
  if (D.skel) {
    ctx.strokeStyle = '#efe6cf'; ctx.lineWidth = 3.2; const bone = new Path2D();
    D.skel.spine.forEach(([x, z], i) => { if (i) bone.lineTo(mapX(x), mapY(z)); else bone.moveTo(mapX(x), mapY(z)); });
    for (const [x0, z0, x1, z1] of D.skel.ribs) { bone.moveTo(mapX(x0), mapY(z0)); bone.lineTo(mapX(x1), mapY(z1)); }
    ctx.stroke(bone); ctx.strokeStyle = 'rgba(70,54,36,0.85)'; ctx.lineWidth = 1.1; ctx.stroke(bone);
    if (D.skel.skull) { const [sx, sz, nx, nz] = D.skel.skull; ctx.beginPath(); ctx.ellipse(mapX((sx + nx) / 2), mapY((sz + nz) / 2), 5 * S, 3.2 * S, Math.atan2(nz - sz, nx - sx), 0, TAU); ctx.fillStyle = '#efe6cf'; ctx.fill(); ctx.stroke(); }
  }
  // the Migurd village: palisade ring, round huts with their doors, the longhouse
  const M = DC_SPOTS.migurd;
  ctx.strokeStyle = '#4a3422'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(mapX(M.x), mapY(M.z), 34 * S, 0.3, 1.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(mapX(M.x), mapY(M.z), 34 * S, 1.55, TAU - 0.06); ctx.stroke();
  for (const h of D.huts) {
    const X = mapX(h.x), Y = mapY(h.z), r = 2.9 * S;
    ctx.beginPath(); ctx.arc(X + 1.2, Y + 1.5, r, 0, TAU); ctx.fillStyle = 'rgba(40,24,14,0.35)'; ctx.fill();
    ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fillStyle = '#a8865e'; ctx.fill(); ctx.lineWidth = 0.9; ctx.strokeStyle = '#3b2216'; ctx.stroke();
    ctx.beginPath(); ctx.arc(X, Y, r * 0.35, 0, TAU); ctx.fillStyle = '#6e5636'; ctx.fill();
  }
  if (D.longhouse) { const X = mapX(D.longhouse.x), Y = mapY(D.longhouse.z - 4.2); ctx.fillStyle = '#9a7a54'; ctx.fillRect(X - 5.5 * S, Y - 2.7 * S, 11 * S, 5.4 * S); ctx.strokeStyle = '#3b2216'; ctx.lineWidth = 0.9; ctx.strokeRect(X - 5.5 * S, Y - 2.7 * S, 11 * S, 5.4 * S); }
  // the wagons it ate: small broken boxes
  for (const [x, z, rot] of D.wagons) {
    ctx.save(); ctx.translate(mapX(x), mapY(z)); ctx.rotate(-rot);
    ctx.fillStyle = '#6a4a30'; ctx.fillRect(-1.1 * S, -2 * S, 2.2 * S, 4 * S); ctx.strokeStyle = MAP_COL.ink; ctx.lineWidth = 0.8; ctx.strokeRect(-1.1 * S, -2 * S, 2.2 * S, 4 * S);
    ctx.restore();
  }
}
