/* ═══════════════════════════════════════════════════════════════════════
   LANDMARKS & MANA CRYSTALS — reasons to leave the road in the Roa basin.

   Four new places you can see from a distance: the Sunstones (a ring of
   standing stones on the south-east downs), the Fallen Colossus (a stone
   knight as long as a house, face to the sky, in the north meadows),
   Hermit's Rock (a spire in the badlands with a ledge path up it), and a
   crag over the pass road. Eight mana crystals hide at them and around
   the basin — some lie in the open, some want a climb, an Earth Wall
   pillar, or a golem's death. Each one deepens the vessel.
   ═══════════════════════════════════════════════════════════════════════ */
const CRYSTALS = { list: [], got: 0, geo: null, mat: null, glowMat: null };
const CRYSTAL_MANA = 5, CRYSTAL_ALL_BONUS = 20;
const LANDMARKS = {
  sunstones: { x: 1900, z: 570 },
  colossus: { x: 1420, z: 20 },
  hermit: { x: 2230, z: -60 },
  crag: { x: 1180, z: 330 },
};

const LANDMARK_R = { sunstones: 14, colossus: 17, hermit: 7, crag: 5 };
function nearLandmark(x, z, pad = 0) { for (const k in LANDMARKS) if (Math.hypot(x - LANDMARKS[k].x, z - LANDMARKS[k].z) < LANDMARK_R[k] + pad) return true; return false; }
// a lumpy stone piece: a subdivided box or blob pushed about by noise, weathered vertex colours
function stoneGeo(geo, seed, amt = 0.12, col = '#8f897d', moss = '#5f6b3e') {
  const n = Noise.make(seed), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + n(x * 0.9 + y * 0.3, z * 0.9 - y * 0.5) * amt;
    p.setXYZ(i, x * k, y * (1 + n(x * 0.7, z * 0.7) * amt * 0.5), z * k);
  }
  geo.computeVertexNormals();
  const c0 = new THREE.Color(col), cm = new THREE.Color(moss), cd = new THREE.Color(col).multiplyScalar(0.72), nr = geo.attributes.normal;
  paint(geo, (x, y, z, c) => {
    c.copy(c0).lerp(cd, clamp(n(x * 0.4 + 9, z * 0.4) * 0.5 + 0.5, 0, 1) * 0.5);
    return c;
  });
  // moss on what faces the sky
  const col2 = geo.attributes.color;
  for (let i = 0; i < nr.count; i++) {
    const up = nr.getY(i);
    if (up > 0.55) { const t = smooth(0.55, 0.95, up) * 0.55; col2.setXYZ(i, lerp(col2.getX(i), cm.r, t), lerp(col2.getY(i), cm.g, t), lerp(col2.getZ(i), cm.b, t)); }
  }
  return geo.index ? geo.toNonIndexed() : geo;
}
const _stoneMat = () => CRYSTALS.stoneMat || (CRYSTALS.stoneMat = toonMat({ vertexColors: true }));
function mergeStone(parts) {
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, _stoneMat());
  m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false;
  STRUCT.group.add(m);
  return m;
}
// place a piece (geometry in local space) by position / rotation
const _sm4 = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _se = new THREE.Euler(), _sv = new THREE.Vector3(), _ss = new THREE.Vector3(1, 1, 1);
function stonePiece(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  _sm4.compose(_sv.set(x, y, z), _sq.setFromEuler(_se.set(rx, ry, rz)), _ss);
  return geo.applyMatrix4(_sm4);
}

function buildLandmarks() {
  const R = mulberry32(WORLD.seed + 808);
  const out = {};
  /* the Sunstones: nine standing stones round a flat altar stone */
  {
    const S = LANDMARKS.sunstones, y = heightAt(S.x, S.z), parts = [];
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + 0.2, r = 9.5, h = 3.4 + R() * 1.6, x = S.x + Math.cos(a) * r, z = S.z + Math.sin(a) * r, gy = heightAt(x, z);
      const g = stoneGeo(new THREE.BoxGeometry(1.4, h, 0.9, 2, 4, 2), 900 + i, 0.14);
      g.translate(0, h / 2 - 0.4, 0);
      parts.push(stonePiece(g, x, gy, z, (R() - 0.5) * 0.12, -a + Math.PI / 2, (R() - 0.5) * 0.14));
      addBox(x, z, 0.7, 0.45, a - Math.PI / 2, gy - 1, gy + h - 0.4, 'stone');
    }
    const altar = stoneGeo(new THREE.BoxGeometry(3.2, 0.9, 2.2, 3, 1, 2), 950, 0.08);
    altar.translate(0, 0.25, 0);
    parts.push(stonePiece(altar, S.x, y, S.z, 0, 0.3, 0));
    addBox(S.x, S.z, 1.6, 1.1, -0.3, y - 1, y + 0.7, 'altar');
    mergeStone(parts);
    out.sunstones = y + 0.7;
  }
  /* the Fallen Colossus: a stone knight on his back, head west, sword broken beside him */
  {
    const C = LANDMARKS.colossus, y = heightAt(C.x, C.z), parts = [];
    const box = (w, h, d, x, yy, z, seed, rx = 0, ry = 0, rz = 0, amt = 0.06) => parts.push(stonePiece(stoneGeo(new THREE.BoxGeometry(w, h, d, 3, 2, 3), seed, amt), C.x + x, y + yy, C.z + z, rx, ry, rz));
    const cyl = (r, l, x, yy, z, seed, ry = 0) => { const g = stoneGeo(new THREE.CylinderGeometry(r, r * 1.05, l, 9, 3), seed, 0.06); g.rotateZ(Math.PI / 2); parts.push(stonePiece(g, C.x + x, y + yy, C.z + z, 0, ry, 0)); };
    box(7, 3.4, 5.2, 0, 1.5, 0, 960);                 // torso (top 3.2)
    box(5, 0.5, 3.4, 0.3, 3.3, 0, 961, 0, 0, 0, 0.04);    // breastplate ridge (top ≈ 3.55)
    box(1.2, 3.0, 5.5, 3.9, 1.3, 0, 962);             // belt
    const head = stoneGeo(new THREE.IcosahedronGeometry(2.4, 2), 963, 0.05); parts.push(stonePiece(head, C.x - 5.6, y + 2.1, C.z + 0.3));
    box(4.2, 0.9, 0.6, -5.6, 4.3, 0.3, 964);          // helmet crest
    box(0.5, 0.25, 2.6, -7.4, 2.6, 0.3, 965, 0, 0, 0.5); // visor
    cyl(1.0, 6.5, 0.6, 0.85, 3.7, 966);               // left arm at his side
    cyl(1.0, 5.5, -1.5, 0.75, -8.6, 967, 0.9);        // right arm, broken off and rolled away
    for (const s of [-1, 1]) { cyl(1.25, 7.5, 7.9, 1.1, s * 1.4, 968 + s); box(1.5, 2.6, 1.7, 11.9, 1.3, s * 1.4, 970 + s); }
    box(14, 0.35, 1.3, 3, 0.25, 7.2, 972, 0, 0.05, 0);       // the sword, lying
    box(6, 0.35, 1.3, 13.5, 2.0, 7.4, 973, 0, 0.2, 0.42);    // its broken half, leaning on a stone
    const shield = stoneGeo(new THREE.CylinderGeometry(2.8, 2.8, 0.5, 18, 1), 974, 0.04); shield.rotateX(1.2);
    parts.push(stonePiece(shield, C.x - 2, y + 1.6, C.z - 5.8, 0, 0.2, 0));
    box(1.6, 1.1, 1.6, 6.2, 0.15, 3.6, 975, 0, 0.4, 0, 0.1);  // a fallen block: the way up
    mergeStone(parts);
    const B = (x, z, hx, hz, top, rot = 0) => addBox(C.x + x, C.z + z, hx, hz, rot, y - 1, y + top, 'colossus');
    B(0, 0, 3.5, 2.6, 3.2); B(0.3, 0, 2.5, 1.7, 3.55); B(3.9, 0, 0.6, 2.75, 2.8);
    addCircle(C.x - 5.6, C.z + 0.3, 2.3, y - 1, y + 4.5, 'colossus');
    B(0.6, 3.7, 3.25, 1.0, 1.85);
    for (const s of [-1, 1]) { B(7.9, s * 1.4, 3.75, 1.2, 2.35); B(11.9, s * 1.4, 0.75, 0.85, 2.6); }
    B(6.2, 3.6, 0.8, 0.8, 0.7, -0.4);
    B(-1.5, -8.6, 2.75, 1.0, 1.75, -0.9);
    addCircle(C.x - 2, C.z - 5.8, 2.6, y - 1, y + 2.6, 'colossus');
    out.colossus = { x: C.x + 0.3, z: C.z, y: y + 3.55 };
  }
  /* Hermit's Rock: a spire with a ledge path spiralling up it */
  {
    const H = LANDMARKS.hermit, y = heightAt(H.x, H.z), parts = [];
    // the first ledge one jump above the ground under it; each next one a jump higher; the top one more
    const base = heightAt(H.x + 3.35, H.z) + 1.2, top = base + 1.2 * 8 - y;
    for (let k = 0; k < 6; k++) {
      const r = lerp(2.8, 2.1, k / 5), g = stoneGeo(new THREE.IcosahedronGeometry(r, 1), 980 + k, 0.16, '#8c7e6a', '#6b6a40');
      g.scale(1, 1.15, 1);
      parts.push(stonePiece(g, H.x + (R() - 0.5) * 0.4, y + 0.6 + k * (top - 1.6) / 5, H.z + (R() - 0.5) * 0.4, 0, R() * TAU, 0));
    }
    // a skirt of fallen rock round the foot, so the spire sits in the ground
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + 0.4, g = stoneGeo(new THREE.IcosahedronGeometry(1.5 + R() * 0.6, 1), 995 + i, 0.18, '#8c7e6a', '#6b6a40');
      g.scale(1, 0.55, 1);
      const bx = H.x + Math.cos(a) * 2.6, bz = H.z + Math.sin(a) * 2.6;
      parts.push(stonePiece(g, bx, heightAt(bx, bz) - 0.2, bz, 0, R() * TAU, 0));
    }
    const cap = stoneGeo(new THREE.CylinderGeometry(2.5, 2.2, 0.8, 9, 1), 990, 0.08, '#8c7e6a', '#6b6a40');
    parts.push(stonePiece(cap, H.x, y + top - 0.4, H.z));
    addCircle(H.x, H.z, 2.25, y - 1, y + top - 0.8, 'spire');
    addCircle(H.x, H.z, 2.4, y + top - 1.2, y + top, 'spire top');
    for (let k = 0; k < 8; k++) {
      const a = k * 0.9, lx = H.x + Math.cos(a) * 3.35, lz = H.z + Math.sin(a) * 3.35, ly = base + 1.2 * k;
      const g = stoneGeo(new THREE.CylinderGeometry(1.3, 1.0, 0.7, 7, 1), 1000 + k, 0.1, '#8c7e6a', '#6b6a40');
      parts.push(stonePiece(g, lx, ly - 0.35, lz, 0, R() * TAU, 0));
      // a wedge of rock under each ledge so it grows out of the spire, not out of the air
      const w = stoneGeo(new THREE.ConeGeometry(0.9, Math.min(2.4, ly - y + 0.3), 6, 1), 1010 + k, 0.1, '#7c705e', '#6b6a40');
      w.rotateX(Math.PI);
      parts.push(stonePiece(w, lx * 0.85 + H.x * 0.15, ly - 0.7 - Math.min(2.4, ly - y + 0.3) / 2, lz * 0.85 + H.z * 0.15));
      addCircle(lx, lz, 1.22, ly - 1.5, ly, 'ledge');
    }
    mergeStone(parts);
    out.hermit = y + top;
  }
  /* a crag over the pass road: a sheer-sided stack with a flat top — one Earth Wall and a jump */
  {
    const K = LANDMARKS.crag, y = heightAt(K.x, K.z), parts = [];
    for (let i = 0; i < 4; i++) {
      const a = i * 1.6, g = stoneGeo(new THREE.IcosahedronGeometry(2.2 - i * 0.1, 1), 1020 + i, 0.15, '#857b6b', '#5e6a3c');
      g.scale(1, 1.25, 1);
      parts.push(stonePiece(g, K.x + Math.cos(a) * 1.4, y + 1.6 + (i % 2) * 0.8, K.z + Math.sin(a) * 1.4, 0, R() * TAU, 0));
    }
    const slab = stoneGeo(new THREE.CylinderGeometry(2.8, 3.0, 0.9, 8, 1), 1030, 0.07, '#857b6b', '#5e6a3c');
    parts.push(stonePiece(slab, K.x, y + 4.3 - 0.45, K.z));
    mergeStone(parts);
    addCircle(K.x, K.z, 2.9, y - 1, y + 4.3, 'crag');
    out.crag = y + 4.3;
  }
  return out;
}

function crystalGeometry() {
  const parts = [];
  const shard = (h, r, x, z, tx, tz) => {
    const g = new THREE.OctahedronGeometry(1, 0); g.scale(r, h, r); g.translate(0, h * 0.85, 0);
    g.rotateX(tx); g.rotateZ(tz); g.translate(x, 0, z);
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  shard(0.55, 0.16, 0, 0, 0, 0);
  shard(0.38, 0.11, 0.15, 0.05, 0.1, -0.4);
  shard(0.32, 0.1, -0.13, 0.08, 0.2, 0.45);
  shard(0.3, 0.09, 0.02, -0.15, -0.45, 0.05);
  shard(0.24, 0.08, -0.08, -0.1, -0.3, 0.3);
  const g = mergeGeometries(parts); g.computeVertexNormals();
  return g;
}

function buildCrystals() {
  const L = buildLandmarks();
  const F = FIRST_WALL, rr = F.r + 9, a1 = 2.6, rx = F.x + Math.cos(a1) * (rr + 5), rz = F.z + Math.sin(a1) * (rr + 5);
  let ruinTop = 0; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) ruinTop = Math.max(ruinTop, groundAt(rx + dx, rz + dz, heightAt(rx, rz) + 100));
  const O = ROA_ORCHARD;
  const spots = [
    { id: 'sunstones', x: LANDMARKS.sunstones.x, z: LANDMARKS.sunstones.z, y: L.sunstones, hint: 'the Sunstones' },
    { id: 'colossus', x: L.colossus.x, z: L.colossus.z, y: L.colossus.y, hint: 'the Fallen Colossus' },
    { id: 'hermit', x: LANDMARKS.hermit.x, z: LANDMARKS.hermit.z, y: L.hermit, hint: 'Hermit\'s Rock' },
    { id: 'crag', x: LANDMARKS.crag.x, z: LANDMARKS.crag.z, y: L.crag, hint: 'the crag over the pass' },
    { id: 'ruin', x: rx, z: rz, y: ruinTop, hint: 'a broken tower at the First Wall' },
    { id: 'orchard', x: O.x + 5.5, z: O.z + 14, y: null, hint: 'the orchard' },
    { id: 'windmill', x: 1662, z: 652, y: null, hint: 'behind the windmill' },
    { id: 'golem', x: F.x, z: F.z, y: null, hint: 'what the First Golem guarded', after: 'firstWall' },
  ];
  const geo = crystalGeometry();
  CRYSTALS.mat = toonMat({ color: '#7fd0ff', emissive: '#2a6fb0', emissiveIntensity: 1.2 });
  const halo = new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color('#8fd8ff').multiplyScalar(1.4), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  // a faint column of light that finds them from far off
  const beamGeo = new THREE.CylinderGeometry(0.12, 0.5, 9, 8, 1, true); beamGeo.translate(0, 4.5, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#6fc8ff').multiplyScalar(0.7), transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const s of spots) {
    const y = s.y ?? heightAt(s.x, s.z);
    const g = new THREE.Group(); g.position.set(s.x, y, s.z);
    const m = new THREE.Mesh(geo, CRYSTALS.mat); m.castShadow = true; g.add(m);
    const h = new THREE.Sprite(halo); h.scale.setScalar(1.6); h.position.y = 0.45; g.add(h);
    const b = new THREE.Mesh(beamGeo, beamMat); g.add(b);
    scene.add(g);
    CRYSTALS.list.push({ ...s, y, g, m, beam: b, pos: new THREE.Vector3(s.x, y, s.z) });
  }
}
function crystalsGot() { return G && G.crystals ? G.crystals.length : 0; }
function resetCrystals() {
  for (const c of CRYSTALS.list) c.g.visible = !(G && G.crystals && G.crystals.includes(c.id)) && (!c.after || !!(G && G.flags[c.after]));
}
function updateCrystals(dt) {
  if (!G || GAME.inCave) return;
  G.crystals = G.crystals || [];
  const p = PL.body.pos, t = GAME.time;
  for (const c of CRYSTALS.list) {
    const show = !G.crystals.includes(c.id) && (!c.after || !!G.flags[c.after]);
    c.g.visible = show;
    if (!show) continue;
    const d2 = c.pos.distanceToSquared(p);
    if (d2 > 220 * 220) continue;
    if (d2 < 70 * 70 && !(G.crystalsSeen || (G.crystalsSeen = [])).includes(c.id)) G.crystalsSeen.push(c.id);   // marked on the map from now on
    c.m.rotation.y = t * 0.6; c.m.position.y = 0.12 + Math.sin(t * 1.7 + c.x) * 0.08;
    c.beam.material.opacity = 0.14 * smooth(6, 40, Math.sqrt(d2));
    if (d2 < 35 * 35 && !G.flags.crystalHint) { G.flags.crystalHint = true; hint('A mana crystal. Reach it, and it deepens your vessel.', 5); }
    if (d2 < 30 * 30) requestLight(_crV.copy(c.pos).setY(c.y + 0.8), '#7fc8ff', 2.4, 7);
    if (d2 < 1.6 * 1.6 && Math.abs(p.y - c.y) < 1.6 && PL.state !== 'dead') takeCrystal(c);
  }
}
const _crV = new THREE.Vector3();
function takeCrystal(c) {
  G.crystals.push(c.id);
  c.g.visible = false;
  G.maxMana += CRYSTAL_MANA; G.mana = Math.min(G.maxMana, G.mana + 30);
  const n = G.crystals.length, all = CRYSTALS.list.length;
  emit(50, { pos: c.pos.clone().setY(c.y + 0.6), col: '#9fe0ff', spread: 0.3, velSpread: 4, upBias: 3, life: 1.2, size: 0.16, size2: 0.02, bright: 2.4 });
  BUS.emit('sfx', { id: 'learn' }); BUS.emit('flash', { col: '#8fd8ff', a: 0.25 });
  toast(`Mana Crystal ${n} / ${all} — max mana +${CRYSTAL_MANA}`, 'big');
  if (n === all) {
    G.maxMana += CRYSTAL_ALL_BONUS;
    later(1.6, () => { banner('The Vessel Sings', 'Every crystal in the Roa basin'); toast('Max mana +' + CRYSTAL_ALL_BONUS, 'good'); });
  }
  autosave();
}
