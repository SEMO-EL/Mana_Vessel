/* ═══════════════════════════════════════════════════════════════════════
   ROA'S GREEN — trees in the yards and along the avenue, the estate lawn
   with flower beds and clipped hedges, benches round the fountain.

   Runs at the end of buildRoa() on its own random stream, so nothing that
   was placed before it moves. Everything here is merged by kind (one mesh
   of hedges, one of benches, one of beds, one instanced set of flowers,
   instanced trees in the forest's LOD scheme): a handful of draw calls.
   ═══════════════════════════════════════════════════════════════════════ */
const ROA_GREEN = { trees: 0, beds: 0, flowers: 0, hedges: 0, benches: 0 };

function buildRoaGreenery() {
  const R = mulberry32(WORLD.seed + 405), C = ROA_CITY, E = ROA_ESTATE, P = ROA_PLAZA;
  const x0 = C.x - C.hw, x1 = C.x + C.hw, z0 = C.z - C.hd, z1 = C.z + C.hd;
  const planted = [];
  // nothing built within r of here (houses, stalls, walls, the keep), and room from other trees
  const clear = (x, z, r, gap) => {
    const gy = heightAt(x, z);
    for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]])
      if (groundAt(x + dx, z + dz, gy + 60, 0.3) > gy + 0.3) return false;
    for (const t of planted) if (Math.hypot(x - t[0], z - t[2]) < gap) return false;
    return true;
  };

  /* ── trees ── */
  const variants = [makeTreeVariant('broad', 31), makeTreeVariant('broad', 32), makeTreeVariant('oak', 33)];
  const lists = variants.map(() => []);
  const plant = (x, z, vi, s) => {
    const y = heightAt(x, z);
    lists[vi].push([x, y - 0.15, z, R() * TAU, s]);
    planted.push([x, y, z]);
    const v = variants[vi];
    FOL.trees.push({ x, z, r: v.trunkR * s, kind: 'broad', h: v.height * s });
  };
  // the avenue up to the terrace: two pairs, on the verge either side of the stone
  for (const z of [354, 344]) for (const s of [-1, 1]) {
    const x = C.x + s * 7;
    if (clear(x, z, 1.2, 4)) plant(x, z, 0, 0.85);
  }
  // the estate lawn: a few broad old trees, away from the keep, the court and the yard
  const yardR = { x: 1600, z: 322, hw: 17, hd: 13 };
  for (let i = 0, n = 0; i < 160 && n < 7; i++) {
    const x = lerp(E.x - E.hw + 5, E.x + E.hw - 5, R()), z = lerp(E.z - E.hd + 4, E.z + E.hd - 5, R());
    if (rectDist(x, z, ROA_FORECOURT) < 5 || rectDist(x, z, yardR) < 3 || roaPaved(x, z, roadDistAt(x, z)) > 0.05) continue;
    if (!clear(x, z, 4.5, 11)) continue;
    plant(x, z, R() < 0.5 ? 2 : 1, 0.95 + R() * 0.3); n++;
  }
  // the yards behind the houses
  for (let i = 0, n = 0; i < 420 && n < 28; i++) {
    const x = lerp(x0 + 9, x1 - 9, R()), z = lerp(z0 + 9, z1 - 9, R());
    if (roadDistAt(x, z) < 7.5 || Math.hypot(x - P.x, z - P.z) < P.r + 7 || rectDist(x, z, E) < 4) continue;
    if (!clear(x, z, 4.2, 10)) continue;
    plant(x, z, (R() * 3) | 0, 0.8 + R() * 0.35); n++;
  }
  const mat = treeMaterial(), m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const cell = { center: new THREE.Vector3(C.x, C.h, C.z), parts: [] };
  lists.forEach((list, vi) => {
    if (!list.length) return;
    const mk = geo => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((t, i) => { qt.setFromAxisAngle(up, t[3]); sc.setScalar(t[4]); ps.set(t[0], t[1], t[2]); im.setMatrixAt(i, m4.compose(ps, qt, sc)); });
      im.castShadow = im.receiveShadow = true;
      im.computeBoundingSphere();
      scene.add(im);
      return im;
    };
    cell.parts.push({ hi: mk(variants[vi].hi), lo: mk(variants[vi].lo) });
  });
  FOL.cells.push(cell);
  ROA_GREEN.trees = planted.length;

  /* ── the estate lawn: flower beds and hedges ── */
  const soilGeos = [], hedgeGeos = [], flowers = [];
  const FLOWER_COLS = ['#e8486a', '#f2c94c', '#f4f1e8', '#9b6be0', '#ff8c42', '#e86fb0'].map(c => new THREE.Color(c));
  const bed = (x, z, w, d, rot = 0) => {
    const y = heightAt(x, z);
    const curb = new THREE.BoxGeometry(w + 0.5, 0.32, d + 0.5); curb.translate(0, 0.12, 0);
    const soil = new THREE.BoxGeometry(w, 0.36, d); soil.translate(0, 0.16, 0);
    paintFlat(curb, '#9a9184'); paintFlat(soil, '#4f3a26');
    for (const g of [curb, soil]) { g.rotateY(rot); g.translate(x, y, z); soilGeos.push(g); }
    // rows of flowers, one colour per row-run
    const c = Math.cos(rot), s = Math.sin(rot);
    for (let u = -w / 2 + 0.35; u < w / 2 - 0.2; u += 0.42) {
      const colA = FLOWER_COLS[(R() * FLOWER_COLS.length) | 0];
      for (let v = -d / 2 + 0.3; v < d / 2 - 0.2; v += 0.4) {
        const lu = u + (R() - 0.5) * 0.16, lv = v + (R() - 0.5) * 0.16;
        flowers.push([x + lu * c + lv * s, y + 0.42 + R() * 0.16, z - lu * s + lv * c, 0.7 + R() * 0.6, R() < 0.8 ? colA : FLOWER_COLS[(R() * FLOWER_COLS.length) | 0]]);
      }
    }
    addBox(x, z, (w + 0.5) / 2, (d + 0.5) / 2, -rot, y - 0.5, y + 0.34, 'bed');
    ROA_GREEN.beds++;
  };
  const hedge = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), rot = Math.atan2(bz - az, bx - ax), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const y = Math.min(heightAt(ax, az), heightAt(mx, mz), heightAt(bx, bz));
    const g = new THREE.BoxGeometry(len, 1.25, 1.05, Math.max(2, Math.round(len / 0.7)), 3, 2);
    const p = g.attributes.position, n = Noise.make(WORLD.seed + 406 + ROA_GREEN.hedges);
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const k = 1 + n(vx * 1.3 + ax, vy * 1.7 + vz) * 0.18;      // clipped, but by hand
      p.setXYZ(i, vx, vy > 0 ? vy * k : vy, vz * (vy > 0.3 ? 0.92 * k : k));
    }
    g.computeVertexNormals();
    paint(g, (x, yy, z, col) => col.set('#2f5a2a').lerp(_hedgeLit, clamp((yy + 0.6) / 1.4, 0, 1)));
    g.translate(0, 0.6, 0); g.rotateY(-rot); g.translate(mx, y, mz);
    hedgeGeos.push(g);
    addBox(mx, mz, len / 2, 0.55, rot, y - 0.5, y + 1.3, 'hedge');
    ROA_GREEN.hedges++;
  };
  // west lawn: two beds framed by a hedge along the terrace's west edge and its balustrade
  const wx = E.x - E.hw;                           // 1502
  bed(wx + 16, 318, 9, 2.6); bed(wx + 16, 305, 9, 2.6);
  hedge(wx + 3, 290, wx + 3, 330);
  hedge(wx + 6, 331.5, wx + 28, 331.5);
  // either side of the keep's court: a bed each, and low hedges marking the court's corners
  bed(ROA_FORECOURT.x - ROA_FORECOURT.hw - 4.5, 318, 2.6, 8);
  for (const s of [-1, 1]) hedge(ROA_FORECOURT.x + s * (ROA_FORECOURT.hw + 1.5), 330.5, ROA_FORECOURT.x + s * (ROA_FORECOURT.hw + 1.5), 323);
  // behind Ghislaine's yard, against the north wall of the terrace
  bed(1604, 296, 10, 2.6);
  // the plaza: four round-cornered planters on the inner ring, between the stalls and the streets
  for (const a of [0.35, 1.22, 2.0, 2.9, 3.5, 4.35, 5.15, 6.0]) {
    const px = P.x + Math.cos(a) * 15.5, pz = P.z + Math.sin(a) * 15.5;
    if (Math.abs(px - P.x) < 4.5 || Math.abs(pz - P.z) < 4.5) continue;   // keep the four streets' lines clear
    if (!clear(px, pz, 1.4, 0)) continue;
    bed(px, pz, 2.2, 2.2, -a);
  }

  /* ── benches round the fountain, facing it, and two on the lawn ── */
  const benchGeos = [];
  const bench = (x, z, yaw) => {
    const y = heightAt(x, z), parts = [];
    const box = (w, h, d, bx, by, bz, col) => { const g = new THREE.BoxGeometry(w, h, d); paintFlat(g, col); g.translate(bx, by, bz); parts.push(g); };
    box(2.3, 0.1, 0.55, 0, 0.47, 0, '#7a5a3a');
    box(2.3, 0.42, 0.08, 0, 0.82, -0.25, '#7a5a3a');
    for (const s of [-1, 1]) { box(0.12, 0.47, 0.5, s * 1.0, 0.23, 0, '#4a3a2c'); box(0.1, 0.5, 0.08, s * 1.0, 0.8, -0.25, '#4a3a2c'); }
    const g = mergeGeometries(parts.map(q => q.toNonIndexed()));
    g.rotateY(yaw); g.translate(x, y, z);
    benchGeos.push(g);
    addBox(x, z, 1.15, 0.3, -yaw, y - 0.2, y + 0.55, 'bench');      // you can step up and stand on it
    ROA_GREEN.benches++;
  };
  for (const a of [0.7, 2.45, 3.85, 5.6]) {
    const bx = P.x + Math.cos(a) * 10.5, bz = P.z + Math.sin(a) * 10.5;
    bench(bx, bz, Math.atan2(P.x - bx, P.z - bz));
  }
  bench(wx + 16, 311.5, Math.PI / 2 * 0);
  bench(1590, 300, Math.PI);

  /* ── merge ── */
  const vmat = toonMat({ vertexColors: true });
  for (const geos of [soilGeos, hedgeGeos, benchGeos]) {
    if (!geos.length) continue;
    const g = mergeGeometries(geos.map(q => q.index ? q.toNonIndexed() : q));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, vmat);
    m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false;
    STRUCT.group.add(m);
  }
  if (flowers.length) {
    const fg = new THREE.IcosahedronGeometry(0.13, 0);
    const im = new THREE.InstancedMesh(fg, toonMat({ emissive: '#140c08' }), flowers.length);
    const col = new THREE.Color();
    flowers.forEach((f, i) => {
      qt.setFromAxisAngle(up, i * 1.7); sc.set(f[3], f[3] * 0.7, f[3]); ps.set(f[0], f[1], f[2]);
      im.setMatrixAt(i, m4.compose(ps, qt, sc));
      im.setColorAt(i, col.copy(f[4]));
    });
    im.receiveShadow = true;
    im.computeBoundingSphere();
    STRUCT.group.add(im);
    ROA_GREEN.flowers = flowers.length;
  }
}
const _hedgeLit = new THREE.Color('#5d8c3e');
// a flat vertex colour over a whole piece
function paintFlat(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
