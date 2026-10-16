/* ═══════════════════════════════════════════════════════════════════════
   ROA — the seat of House Boreas, its market gardens and orchard, the
   watch-post in the pass, and out in the dry north-east: Wagonbreak Camp
   on the trade road and the First Wall, a ruin older than the city.

   The city is a 224 × 208 m walled rectangle — 14 × 13 lengths of 16 m
   wall (KayKit pieces at scale 8) — with gates west and east on the road
   and south to the gardens, a tower on each corner. Inside: the plaza with
   the founder's fountain and the market, the Adventurer Guild facing it,
   streets of houses, and in the north the Boreas keep on its terrace with
   Ghislaine's training yard beside it.
   Every placed piece joins the static batch at boot, except the gates.
   ═══════════════════════════════════════════════════════════════════════ */
const ROA = { gates: {}, spots: {} };

function buildRoa() {
  const C = ROA_CITY, S = 8, L = 2 * S;
  const x0 = C.x - C.hw, x1 = C.x + C.hw, z0 = C.z - C.hd, z1 = C.z + C.hd;
  const R = mulberry32(WORLD.seed + 404);
  const face = (x, z, tx, tz) => yawTo(x, z, tx, tz);

  /* walls: wall lengths centred on the grid, a gate where the road crosses */
  const run = (ax, az, bx, bz, rot, gate, gateRot, key) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / L), ux = (bx - ax) / len, uz = (bz - az) / len;
    for (let k = 0; k < n; k++) {
      const cx = ax + ux * (k + 0.5) * L, cz = az + uz * (k + 0.5) * L;
      if (gate && Math.hypot(cx - gate[0], cz - gate[1]) < 1) { ROA.gates[key] = buildGate(cx, cz, gateRot, S, { open: 1 }); continue; }
      placeProp('wall_straight', cx, cz, { s: S, rot, sink: 0.6 });
    }
  };
  run(x0, z0, x0, z1, Math.PI / 2, [x0, C.z], Math.PI / 2, 'west');      // doors swing inward, east
  run(x1, z0, x1, z1, Math.PI / 2, [x1, C.z], -Math.PI / 2, 'east');     // …and west
  run(x0, z0, x1, z0, 0, null, 0, 'north');
  run(x0, z1, x1, z1, 0, [1552, z1], Math.PI, 'south');                  // …and north
  for (const [tx, tz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) placeProp('building_tower_B_red', tx, tz, { s: 9 });
  // gate towers: a squat tower either side of each road gate
  for (const gx of [x0, x1]) for (const s of [-1, 1]) placeProp('building_tower_base_red', gx, C.z + s * 13, { s: 7.5 });

  /* the Boreas estate: the keep on its terrace, a stone balustrade along the
     terrace edge (a gap for the avenue), Ghislaine's yard to the east */
  const E = ROA_ESTATE, ez = E.z + E.hd;
  placeProp('building_castle_red', C.x, 297, { s: 10, rot: 0 });
  ROA.spots.keepDoor = { x: C.x, z: 316 };
  for (let x = E.x - E.hw + 4; x < E.x + E.hw - 2; x += 6.9) {
    if (Math.abs(x + 3.45 - C.x) < 7) continue;                           // the avenue comes up here
    placeProp('fence_stone_straight', x + 3.45, ez - 8 + 2.5, { s: 6, rot: Math.PI / 2, pad: 0.8 });
  }
  const yard = { x: 1600, z: 322 };
  ROA.spots.yard = yard;
  for (let i = 0; i < 3; i++) placeProp('target', yard.x - 7 + i * 7, yard.z - 9, { s: 6, rot: 0, pad: 0.6 });
  placeProp('weaponrack', yard.x + 13, yard.z - 2, { s: 6, rot: -Math.PI / 2 });
  placeProp('weaponrack', yard.x + 13, yard.z + 4, { s: 6, rot: -Math.PI / 2 });
  for (const [lx, lz] of [[C.x - 10, 330], [C.x + 10, 330]]) lampPost(lx, lz);
  ROA.spots.forecourt = { x: C.x - 12, z: 334 };
  // the east end of the terrace, where the birthday ends: a lamp of its own
  ROA.spots.terrace = { x: C.x + 18, z: 330 };
  lampPost(C.x + 18.8, 327.4);

  /* the plaza: a fountain with the founder on a plinth, market stalls round it */
  const P = ROA_PLAZA;
  roaFountain(P.x, P.z);
  ROA.spots.plaza = { x: P.x, z: P.z };
  for (const a of [0.7, 2.45, 3.85, 5.6]) {                               // the four diagonals: streets stay clear
    const sx = P.x + Math.cos(a) * 20, sz = P.z + Math.sin(a) * 20;
    placeProp('tent', sx, sz, { s: 6.5, rot: face(sx, sz, P.x, P.z) });
    for (const [n, d, o] of [['crate_A_big', 4.2, 0.5], ['barrel', 4.4, -0.55], ['sack', 3.4, 1.1]]) {
      const b = a + o / 4;
      placeProp(n, P.x + Math.cos(b) * (20 + d * 0.6), P.z + Math.sin(b) * (20 + d * 0.6), { s: 5, rot: R() * TAU, pad: 0.7 });
    }
  }

  /* the Adventurer Guild faces the plaza from the south-east */
  const gh = { x: 1600, z: 418 };
  placeProp('building_tavern_red', gh.x, gh.z, { s: 13, rot: face(gh.x, gh.z, P.x, P.z) });
  const ga = Math.atan2(P.x - gh.x, P.z - gh.z), gfx = Math.sin(ga), gfz = Math.cos(ga);
  ROA.spots.guildDoor = { x: gh.x + gfx * 11, z: gh.z + gfz * 11 };
  for (const s of [-1, 1]) placeProp('flag_red', gh.x + gfx * 9.5 + gfz * s * 5, gh.z + gfz * 9.5 - gfx * s * 5, { s: 9, rot: ga, collide: false });
  roaGuildSign(gh.x + gfx * 8.9, gh.z + gfz * 8.9, ga);

  /* civic buildings */
  placeProp('building_market_red', 1518, 410, { s: 10, rot: face(1518, 410, P.x, P.z) });
  placeProp('building_church_red', 1486, 458, { s: 11, rot: Math.PI });
  placeProp('building_blacksmith_red', 1640, 460, { s: 10, rot: Math.PI });
  placeProp('building_well_red', 1600, 470, { s: 6, rot: 0.3 });

  /* townhouses: every street lined on both sides, shoulder to shoulder,
     facing it — wherever the ground is free (not the plaza, the terrace,
     another street, a landmark, or the wall's walk) */
  const free = (x, z, r) => {
    if (x < x0 + 7 + r || x > x1 - 7 - r || z < z0 + 7 + r || z > z1 - 7 - r) return false;
    if (Math.hypot(x - P.x, z - P.z) < P.r + 8 + r || rectDist(x, z, E) < r + 2 || roadDistAt(x, z) < r + 3.2) return false;
    const gy = heightAt(x, z);
    for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (groundAt(x + dx, z + dz, gy + 60, 0.5) > gy + 0.3) return false;
    return true;
  };
  const streets = [[[x0, C.z], [x1, C.z]], ...STREETS.slice(2)];
  let houses = 0;
  for (const st of streets) {
    const [[ax, az], [bx, bz]] = st, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    for (const off of [10.5, 22.5]) for (let t = 6 + (off > 20 ? 5.5 : 0); t < len - 6; t += 11.5) for (const side of [-1, 1]) {
      const cx = ax + ux * t, cz = az + uz * t, hx = cx - uz * side * off, hz = cz + ux * side * off;
      if (!free(hx, hz, 4.8)) continue;
      const big = R() < 0.4;
      placeProp(big ? 'building_home_B_red' : 'building_home_A_red', hx, hz, { s: big ? 10.5 : 11.5, rot: face(hx, hz, cx, cz) + (R() - 0.5) * 0.08 });
      houses++;
    }
  }
  ROA.houses = houses;
  // clutter by the doors, and the lamps that light the streets at night
  for (let i = 0; i < 26; i++) {
    const x = lerp(x0 + 10, x1 - 10, R()), z = lerp(z0 + 10, z1 - 10, R());
    if (roadDistAt(x, z) < 6 || Math.hypot(x - P.x, z - P.z) < 30 || rectDist(x, z, E) < 4) continue;
    const gy = heightAt(x, z);
    if (groundAt(x, z, gy + 60, 2.5) > gy + 0.3) continue;                 // something's built here already
    placeProp(['barrel', 'crate_A_big', 'crate_B_big', 'sack', 'bucket_water', 'crate_long_A', 'pallet'][(R() * 7) | 0], x, z, { s: 5, rot: R() * TAU, pad: 0.7 });
  }
  for (const [lx, lz] of [[1478, 374], [1512, 397], [1606, 374], [1640, 397], [1540, 364], [1580, 408], [1551, 352], [1545, 448]]) lampPost(lx, lz);

  /* outside the walls: market gardens, a windmill, farmsteads, the orchard fence */
  for (const fx of [1498, 1517, 1536, 1574, 1593, 1612]) for (const fz of [578, 599, 620]) placeProp('building_grain', fx, fz, { collide: false, sink: 0.4 });
  placeProp('building_windmill_red', 1652, 640, { s: 11, rot: -0.4 });
  placeProp('building_home_B_red', 1462, 588, { rot: 0.9 });
  placeProp('building_home_A_red', 1640, 572, { rot: -2.3 });
  const O = ROA_ORCHARD;
  for (let x = O.x - O.hw; x < O.x + O.hw; x += 4.4) placeProp('fence_wood_straight', x + 2.2, O.z - O.hd - 3, { s: 3.8, rot: Math.PI / 2, pad: 0.7 });

  /* the watch-post in the pass */
  placeProp('building_tower_base_red', 1036, 350, { s: 8 });
  placeProp('flag_red', 1047, 356, { s: 9, collide: false });
  campfire(1046, 368);
  for (const [n, dx, dz] of [['crate_A_big', -4, 22], ['barrel', 2, 24], ['weaponrack', 10, 20]]) placeProp(n, 1036 + dx, 350 + dz, { s: 5, rot: R() * TAU });

  buildWagonCamp(R);
  buildFirstWall(R);
}

/* The founder of House Boreas, in stone, over a round basin of water. */
function roaFountain(x, z) {
  const y = heightAt(x, z), stone = toonMat({ color: '#9a9184' }), dark = toonMat({ color: '#6f685e' });
  const g = new THREE.Group(); g.position.set(x, y, z);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.6, 0.9, 28, 1, true), stone); rim.position.y = 0.45; g.add(rim);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(6.35, 0.32, 6, 32), stone); lip.rotation.x = Math.PI / 2; lip.position.y = 0.9; g.add(lip);
  const water = new THREE.Mesh(new THREE.CircleGeometry(6.1, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5d93b5').multiplyScalar(0.9), transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.62; g.add(water);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6.2, 28), dark); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.06; g.add(floor);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 2.6), stone); plinth.position.y = 1.2; g.add(plinth);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.3, 3.0), dark); cap.position.y = 2.5; g.add(cap);
  for (const m of [rim, lip, plinth, cap]) { m.castShadow = true; m.receiveShadow = true; }
  STRUCT.group.add(g);
  addCircle(x, z, 6.6, y - 1, y + 0.95, 'fountain');
  // the statue: a knight cast from the same clips as everyone else, then never animated again
  try {
    const a = new Actor({ base: 'Knight', show: ['1H_Sword', 'Round_Shield'], hide: [] , scale: 1.55 });
    const statueMat = toonMat({ color: '#a8a092', rim: true });
    a.model.traverse(o => { if (o.isMesh) { o.material = statueMat; o.castShadow = true; } });
    a.loop('Idle', { fade: 0 }); a.mixer.setTime(0.4);
    a.root.position.set(x, y + 2.65, z); a.root.rotation.y = Math.PI * 0.08;
    a.root.updateMatrixWorld(true);
    scene.add(a.root);
    ROA.statue = a;
  } catch (e) { console.warn('statue', e); }
  // spray: a few drops arcing from the plinth into the basin, by day and night
  FOUNTAINS.push({ pos: new THREE.Vector3(x, y + 2.7, z), basinY: y + 0.62 });
}
const FOUNTAINS = [];
function updateFountains(dt) {
  for (const f of FOUNTAINS) {
    if (f.pos.distanceToSquared(camera.position) > 90 * 90) continue;
    if (Math.random() < dt * 30) {
      const a = Math.random() * TAU;
      emit(1, { pos: f.pos, vel: { x: Math.cos(a) * 1.6, y: 2.2, z: Math.sin(a) * 1.6 }, velSpread: 0.3, gravity: 9, col: '#d8eefa', life: 0.9, size: 0.08, size2: 0.05, bright: 1.2 });
    }
  }
}

/* The Guild's sign: crossed swords over a shield, painted on a board. */
function roaGuildSign(x, z, yaw) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96;
  const c = cv.getContext('2d');
  c.fillStyle = '#4a3220'; c.fillRect(0, 0, 128, 96);
  c.strokeStyle = '#c9a227'; c.lineWidth = 4; c.strokeRect(4, 4, 120, 88);
  c.fillStyle = '#7a1f22';
  c.beginPath(); c.moveTo(64, 20); c.lineTo(88, 30); c.lineTo(84, 60); c.lineTo(64, 78); c.lineTo(44, 60); c.lineTo(40, 30); c.closePath(); c.fill();
  c.strokeStyle = '#e6dcc2'; c.lineWidth = 5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(30, 18); c.lineTo(98, 80); c.moveTo(98, 18); c.lineTo(30, 80); c.stroke();
  c.fillStyle = '#c9a227'; c.fillRect(24, 14, 12, 8); c.fillRect(92, 14, 12, 8);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.95), toonMat({ map: tex, emissive: '#1a120a' }));
  board.position.set(x, heightAt(x, z) + 4.6, z); board.rotation.y = yaw;
  STRUCT.group.add(board);
}

/* Wagonbreak Camp: brigands squatting by the trade road — a ring of
   stakes open toward the road, tents, a fire, a lookout, wrecked wagons. */
function buildWagonCamp(R) {
  const W = WAGON_CAMP, toRoad = Math.atan2(190 - W.z, 1995 - W.x);
  for (let a = 0; a < TAU; a += 0.17) {
    let d = Math.abs(((a - toRoad) % TAU + TAU + Math.PI) % TAU - Math.PI);
    if (d < 0.5) continue;                                                // the way in
    const px = W.x + Math.cos(a) * 26, pz = W.z + Math.sin(a) * 26;
    placeProp('fence_wood_straight', px, pz, { s: 3.8, rot: -a, pad: 0.7 });
  }
  for (const [dx, dz] of [[-9, -6], [7, -10], [-11, 7], [9, 9]]) placeProp('tent', W.x + dx, W.z + dz, { s: 8, rot: yawTo(W.x + dx, W.z + dz, W.x, W.z) });
  campfire(W.x, W.z);
  placeProp('building_tower_base_red', W.x - 16, W.z - 15, { s: 6 });
  for (const [n, dx, dz] of [['crate_A_big', 4, 14], ['crate_B_big', 6, 15], ['barrel', -4, 15], ['resource_lumber', 14, -2], ['sack', -14, 1], ['weaponrack', 2, -16], ['crate_long_A', -16, -4]])
    placeProp(n, W.x + dx, W.z + dz, { s: 5, rot: R() * TAU });
  wreckedWagon(W.x + 34, W.z + 22, 0.4, false);
  wreckedWagon(W.x + 20, W.z + 38, 2.2, true);
  ROA.spots.camp = { x: W.x, z: W.z };
}
// A cart built from boxes and wheels; tipped ones lie on their side, a wheel off.
function wreckedWagon(x, z, yaw, tipped) {
  const wood = toonMat({ color: '#6b4e33' }), dark = toonMat({ color: '#3f2d1e' });
  const g = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 4.2), wood); bed.position.y = 1.1; g.add(bed);
  for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 4.2), dark); side.position.set(s * 1.05, 1.6, 0); g.add(side); }
  const wg = new THREE.CylinderGeometry(0.62, 0.62, 0.16, 10);
  const wheels = tipped ? [[-1.2, 1.2]] : [[-1.2, 1.2], [1.2, 1.2], [-1.2, -1.2], [1.2, -1.2]];
  for (const [wx, wz] of wheels) { const w = new THREE.Mesh(wg, dark); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.62, wz); g.add(w); }
  if (tipped) { g.rotation.z = 1.35; const loose = new THREE.Mesh(wg, dark); loose.position.set(2.6, 0.08, -1.5); g.add(loose); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.set(x, heightAt(x, z) + (tipped ? 1.1 : 0), z); g.rotation.y = yaw;
  STRUCT.group.add(g);
  addCircle(x, z, 2.2, heightAt(x, z) - 1, heightAt(x, z) + 2, 'wagon');
}

/* The First Wall: a sunken ring older than Roa — broken wall standing on
   its lip, fallen masonry, two ways in (from the road, and from the north). */
function buildFirstWall(R) {
  const F = FIRST_WALL, rr = F.r + 9;
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * TAU;
    if (Math.abs(Math.sin(a) - 1) < 0.12 || Math.abs(Math.sin(a) + 1) < 0.12) continue;   // the two ways in (south, north)
    const x = F.x + Math.cos(a) * rr, z = F.z + Math.sin(a) * rr;
    const o = placeProp('wall_straight', x, z, { s: 6 + R() * 1.5, rot: -a - Math.PI / 2, sink: 1 + R() * 3.5, mat: ruinMaterial() });
    o.rotation.z = (R() - 0.5) * 0.12; o.updateMatrixWorld(true);
  }
  for (const [a, r] of [[0.8, rr + 6], [2.6, rr + 5], [4.0, rr + 7], [5.5, rr + 6]]) placeProp('building_tower_base_red', F.x + Math.cos(a) * r, F.z + Math.sin(a) * r, { s: 5.5, sink: 2.5 + R() * 2, mat: ruinMaterial() });
  placeProp('building_destroyed', F.x + 12, F.z - rr - 16, { s: 12, rot: 2.6, mat: ruinMaterial() });
  for (let i = 0; i < 8; i++) {
    const a = R() * TAU, r = F.r * (0.45 + R() * 0.45);
    placeProp('resource_stone', F.x + Math.cos(a) * r, F.z + Math.sin(a) * r, { s: 5 + R() * 3, rot: R() * TAU, pad: 0.6, mat: ruinMaterial() });
  }
  ROA.spots.arena = { x: F.x, z: F.z };
}
