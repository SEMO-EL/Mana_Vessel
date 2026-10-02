/* ═══════════════════════════════════════════════════════════════════════
   STRUCTURES — KayKit medieval set pieces placed into the world, plus the
   handful of things built in code (waystones, lamps, campfire, cave mouth).

   KayKit pieces are hex-board miniatures: a cottage is 0.8 units wide. The
   world scales buildings ×10 (8 m cottages, a 22 m watchtower, 19 m bridge)
   and small props ×4–6.

   Physics rotation convention: addBox takes -rotation.y (see 20_physics).
   Walkable tops (bridge deck, tower platform) are found by raycasting the
   placed model itself — no hand-typed heights.
   ═══════════════════════════════════════════════════════════════════════ */
const PROPS_LIB = new Map();       // name -> Object3D template (at origin)
let _propMat = null;
function propMaterial() {
  if (!_propMat) _propMat = toonMat({ map: assetTexture('textures/hexagons_medieval.png') });
  return _propMat;
}

async function loadPropsLibrary() {
  const g = await parseGLB('models/props.glb');
  const mat = propMaterial();
  for (const child of [...g.scene.children]) {
    child.position.set(0, 0, 0);
    child.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = true; o.receiveShadow = true; } });
    child.updateMatrixWorld(true);
    PROPS_LIB.set(child.name, child);
  }
}

const PROP_SIZE = new Map();
function propSize(name) {
  if (PROP_SIZE.has(name)) return PROP_SIZE.get(name);
  const b = new THREE.Box3().setFromObject(PROPS_LIB.get(name));
  const s = { hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2, h: b.max.y - b.min.y, minY: b.min.y, maxY: b.max.y,
              cx: (b.max.x + b.min.x) / 2, cz: (b.max.z + b.min.z) / 2 };
  PROP_SIZE.set(name, s);
  return s;
}

const STRUCT = { group: new THREE.Group(), placed: [] };
scene.add(STRUCT.group);

/* Place a KayKit piece. Sits on the LOWEST ground under its footprint (so
   it never floats on a slope) and sinks a little. Returns the Object3D. */
function placeProp(name, x, z, o = {}) {
  const tpl = PROPS_LIB.get(name);
  if (!tpl) { console.warn('no prop', name); return null; }
  const s = o.s ?? 10, rot = o.rot || 0, sz = propSize(name);
  const obj = tpl.clone(true);
  obj.rotation.y = rot;
  obj.scale.setScalar(s);
  const c = Math.cos(rot), si = Math.sin(rot);
  const ox = sz.cx * s * c + sz.cz * s * si, oz = -sz.cx * s * si + sz.cz * s * c;
  let y = o.y;
  if (y === undefined) {
    y = Infinity;
    for (const [u, v] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const lx = u * sz.hx * s * 0.8, lz = v * sz.hz * s * 0.8;
      y = Math.min(y, heightAt(x + ox + lx * c + lz * si, z + oz - lx * si + lz * c));
    }
    y -= o.sink ?? 0.25;
  }
  obj.position.set(x, y - sz.minY * s * (o.alignMin ? 1 : 0), z);
  obj.updateMatrixWorld(true);
  (o.parent || STRUCT.group).add(obj);
  if (o.collide !== false) {
    const k = o.pad ?? 0.9;
    const col = addBox(x + ox, z + oz, sz.hx * s * k, sz.hz * s * k, -rot, obj.position.y + sz.minY * s, obj.position.y + sz.maxY * s * (o.colTop ?? 1), o.tag);
    if (o.noGround) col.noGround = true;
    obj.userData.col = col;
  }
  STRUCT.placed.push({ name, obj });
  return obj;
}

// Height of a placed model's surface under (x,z), by raycasting it from above.
const _rc = new THREE.Raycaster();
function surfaceUnder(obj, x, z, fromY) {
  _rc.set(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0));
  _rc.far = 200;
  const h = _rc.intersectObject(obj, true);
  return h.length ? h[0].point.y : null;
}

/* ───────────── built-in-code pieces ───────────── */
function lampPost(x, z) {
  const g = new THREE.Group();
  const wood = toonMat({ color: '#4a3726' });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.2, 6), wood);
  pole.position.y = 1.6; pole.castShadow = true; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), wood);
  arm.position.set(0.3, 3.1, 0); g.add(arm);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.28), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc070').multiplyScalar(2) }));
  glass.position.set(0.62, 2.85, 0); g.add(glass);
  g.position.set(x, heightAt(x, z) - 0.05, z);
  STRUCT.group.add(g);
  addCircle(x, z, 0.18, g.position.y, g.position.y + 3.2);
  LAMPS.push({ pos: new THREE.Vector3(x + 0.62, g.position.y + 2.85, z), glass });
}
const LAMPS = [];
function updateLamps() {
  const on = SKY_NOW.night > 0.35 || WEATHER.cur.cloud > 0.85;
  for (const l of LAMPS) {
    l.glass.material.color.set('#ffc070').multiplyScalar(on ? 2.4 : 0.4);
    if (on && l.pos.distanceToSquared(camera.position) < 90 * 90) requestLight(l.pos, '#ffb060', 4.5, 14);
  }
}

function campfire(x, z) {
  const y = heightAt(x, z);
  const wood = toonMat({ color: '#3a2a1c' }), stone = toonMat({ color: '#6b655b' });
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.2, 5), wood);
    l.position.set(x, y + 0.15, z); l.rotation.set(Math.PI / 2 - 0.35, i * Math.PI / 2, 0);
    STRUCT.group.add(l);
  }
  for (let i = 0; i < 9; i++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stone);
    const a = i / 9 * TAU; r.position.set(x + Math.cos(a) * 0.8, y + 0.1, z + Math.sin(a) * 0.8);
    STRUCT.group.add(r);
  }
  FIRES.push({ pos: new THREE.Vector3(x, y + 0.4, z) });
}
const FIRES = [];
function updateFires(dt) {
  for (const f of FIRES) {
    if (f.pos.distanceToSquared(camera.position) > 160 * 160) continue;
    const k = f.small ? 0.5 : 1;
    if (Math.random() < 0.9) emit(f.small ? 1 : 2, { pos: f.pos, spread: 0.25 * k, vel: { x: 0, y: 2.4 * k, z: 0 }, velSpread: 0.4 * k, col: '#ff7a20', col2: '#ffd070', life: 0.7, size: 0.5 * k, size2: 0.05, bright: 2.2, drag: 0.6 });
    if (Math.random() < 0.3) emit(1, { pool: 'soft', pos: f.pos.clone().setY(f.pos.y + 1.2), vel: { x: 0.3, y: 1.4, z: 0 }, velSpread: 0.3, col: '#3a3432', life: 3, size: 0.6, size2: 2.4, drag: 0.3 });
    requestLight(f.pos, '#ff8a3a', (9 + Math.sin(GAME.time * 13) * 1.5 + Math.sin(GAME.time * 7.3)) * k, 16 * k);
  }
}

/* ───────────── waystones (rest · respawn · fast travel) ───────────── */
const WSTONE = { list: [] };
function buildWaystone(w) {
  const y = heightAt(w.x, w.z);
  const g = new THREE.Group(); g.position.set(w.x, y, w.z);
  const stone = toonMat({ color: '#7a7466' }), dark = toonMat({ color: '#4d4a44' });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.5, 6), dark); base.position.y = 0.1; base.receiveShadow = true; g.add(base);
  const step = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.4, 6), stone); step.position.y = 0.5; g.add(step);
  const mono = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 3.4, 5), stone); mono.position.y = 2.3; mono.castShadow = true; g.add(mono);
  const runeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5aa9e6') });
  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.02), runeMat);
    const a = i / 5 * TAU; r.position.set(Math.sin(a) * 0.43, 1.4 + i * 0.45, Math.cos(a) * 0.43); r.rotation.y = a;
    g.add(r);
  }
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#8fd0ff') }));
  crystal.position.y = 4.7; g.add(crystal);
  STRUCT.group.add(g);
  addCircle(w.x, w.z, 0.55, y, y + 4);
  addCollider({ kind: 'circle', x: w.x, z: w.z, r: 2.0, y0: y - 1, y1: y + 0.7, tag: 'waystoneBase' });
  const W = { ...w, y, group: g, crystal, runeMat, pos: new THREE.Vector3(w.x, y + 0.7, w.z) };
  WSTONE.list.push(W);
  INTERACTABLES.push({
    pos: W.pos, r: 3.2,
    label: () => G.waystones[w.id] ? 'Rest at the waystone' : 'Touch the waystone',
    action: () => activateWaystone(W),
  });
  return W;
}
function updateWaystones(dt) {
  for (const W of WSTONE.list) {
    const lit = G && G.waystones[W.id];
    W.crystal.rotation.y += dt * (lit ? 1.2 : 0.3);
    W.crystal.position.y = 4.7 + Math.sin(GAME.time * 1.5 + W.x) * 0.15;
    W.crystal.material.color.set(lit ? '#8fd0ff' : '#5a6070').multiplyScalar(lit ? 2.6 : 1);
    W.runeMat.color.set(lit ? '#5aa9e6' : '#2a3038').multiplyScalar(lit ? 2 : 1);
    if (lit && W.pos.distanceToSquared(camera.position) < 120 * 120) {
      requestLight(W.crystal.getWorldPosition(_wsV), '#7fc4ff', 3.5, 12);
      if (Math.random() < 0.15) emit(1, { pos: W.crystal.getWorldPosition(_wsV), col: '#9fd8ff', spread: 0.3, vel: { x: 0, y: 0.8, z: 0 }, velSpread: 0.4, life: 1.5, size: 0.12, bright: 2 });
    }
  }
}
const _wsV = new THREE.Vector3();

/* ───────────── the whole region ───────────── */
function roadRiverCrossing() {
  let best = null, bd = Infinity;
  for (const [x, z] of TER.roadPath) {
    const d = riverDistAt(x, z);
    if (d < bd) { bd = d; best = [x, z]; }
  }
  return best;
}
function roadDirAt(x, z) {
  const P = TER.roadPath; let bi = 0, bd = Infinity;
  for (let i = 0; i < P.length; i++) { const d = Math.hypot(P[i][0] - x, P[i][1] - z); if (d < bd) { bd = d; bi = i; } }
  const a = P[Math.max(0, bi - 2)], b = P[Math.min(P.length - 1, bi + 2)];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
}
// three.js yaw that points a model's local +Z along (dx, dz)
const yawAlong = (dx, dz) => Math.atan2(dx, dz);
// yaw that points local +Z at a world point
const yawTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

function buildStructures() {
  const V = VILLAGE_BASIN;
  /* village: houses face the plaza/road */
  const houses = [
    ['building_home_B_red', -470, 298, 'greyrat'], ['building_church_red', -522, 282], ['building_tavern_red', -457, 324],
    ['building_market_red', -402, 336], ['building_blacksmith_red', -380, 316], ['building_home_A_red', -515, 362],
    ['building_home_B_red', -497, 400], ['building_home_A_red', -444, 410], ['building_home_A_red', -398, 414],
    ['building_home_B_red', -548, 326], ['building_home_A_red', -566, 382], ['building_home_A_red', -590, 345],
  ];
  for (const [n, x, z, id] of houses) {
    const o = placeProp(n, x, z, { rot: yawTo(x, z, -430, 360) });
    if (id) o.userData.id = id;
  }
  // The rest of Buena: cottages shoulder to shoulder along both sides of the
  // road, each facing the street with a yard fenced behind — a village, not a
  // scatter. Skips the story buildings, the plaza, the waystone, the people,
  // the river bank and Paul's yard.
  const roadZ = x => {
    for (let i = 0; i < ROAD.length - 1; i++) { const [ax, az] = ROAD[i], [bx, bz] = ROAD[i + 1]; if (x >= ax && x <= bx) return az + (bz - az) * (x - ax) / (bx - ax); }
    return ROAD[0][1];
  };
  const keepClear = [...houses.map(([, x, z]) => [x, z, 15]), [-430, 352, 16], [-392, 332, 12], [-498, 444, 24],
    [-462, 312, 7], [-478, 318, 7], [-418, 344, 7], [-405, 352, 7]];
  const RV = mulberry32(919);
  for (let x = -580; x <= -380; x += 15 + RV() * 4) for (const side of [-1, 1]) {
    const hx = x + (RV() - 0.5) * 4, rz = roadZ(hx), hz = rz + side * (15 + RV() * 4);
    if (roadDistAt(hx, hz) < 11 || riverDistAt(hx, hz) < 22) continue;
    if (keepClear.some(([cx, cz, r]) => Math.hypot(hx - cx, hz - cz) < r)) continue;
    const h0 = heightAt(hx, hz);
    if (Math.abs(heightAt(hx + 5, hz) - h0) > 1.6 || Math.abs(heightAt(hx, hz + 5) - h0) > 1.6) continue;   // no cottages on a slope
    placeProp(RV() < 0.55 ? 'building_home_A_red' : 'building_home_B_red', hx, hz, { rot: yawTo(hx, hz, hx, rz) + (RV() - 0.5) * 0.25 });
    keepClear.push([hx, hz, 13]);
    // a yard fence behind, and something by the door
    if (RV() < 0.7) for (const dx of [-4.4, 0, 4.4]) placeProp('fence_wood_straight', hx + dx, hz + side * 9.5, { s: 3.8, rot: Math.PI / 2, pad: 0.6 });
    const dx = (RV() < 0.5 ? -1 : 1) * (3.5 + RV() * 1.5);
    placeProp(['barrel', 'crate_A_big', 'sack', 'bucket_water', 'resource_lumber', 'wheelbarrow'][Math.floor(RV() * 6)], hx + dx, hz - side * 5.5, { s: 5, rot: RV() * TAU, pad: 0.6 });
  }
  placeProp('building_well_red', -430, 352, { s: 7, rot: 0.4 });
  // watermill on the river bank, wheel toward the water
  const wmX = -357, wmZ = 300;
  placeProp('building_watermill_red', wmX, wmZ, { rot: yawTo(wmX, wmZ, -336, 300) + Math.PI / 2 });
  placeProp('building_windmill_red', -302, 590, { s: 11, rot: -0.6 });
  // wheat fields
  for (const [cx, cz, nx, nz] of [[-340, 520, 3, 2], [-560, 432, 2, 2]]) {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      placeProp('building_grain', cx + (i - (nx - 1) / 2) * 18.2, cz + (j - (nz - 1) / 2) * 20, { collide: false, sink: 0.4 });
    }
  }
  // Paul's training yard
  const ty = { x: -498, z: 444 };
  for (let i = 0; i < 3; i++) placeProp('target', ty.x - 6 + i * 6, ty.z + 6, { s: 6, rot: Math.PI, pad: 0.6 });
  placeProp('weaponrack', ty.x + 9, ty.z - 3, { s: 6, rot: -Math.PI / 2 });
  for (let i = -2; i <= 2; i++) {
    placeProp('fence_wood_straight', ty.x + i * 4.4, ty.z - 9, { s: 3.8, rot: Math.PI / 2, pad: 0.7 });
    placeProp('fence_wood_straight', ty.x + i * 4.4, ty.z + 11, { s: 3.8, rot: Math.PI / 2, pad: 0.7 });
  }
  // village clutter
  const R = mulberry32(4242);
  for (let i = 0; i < 26; i++) {
    const a = R() * TAU, r = 22 + R() * 70;
    const x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r;
    if (roadDistAt(x, z) < 5 || riverDistAt(x, z) < 14) continue;
    placeProp(pick(['barrel', 'crate_A_big', 'crate_B_big', 'sack', 'wheelbarrow', 'bucket_water', 'crate_long_A', 'resource_lumber']), x, z, { s: 5, rot: R() * TAU, pad: 0.8 });
  }
  for (const [x, z] of [[-430, 372], [-470, 350], [-396, 352], [-500, 330], [-455, 390], [-372, 372]]) lampPost(x, z);
  placeProp('flag_red', -438, 344, { s: 7, collide: false });

  /* the bridge: where the road meets the river, laid along the road */
  const [bx, bz] = roadRiverCrossing();
  const [rdx, rdz] = roadDirAt(bx, bz);
  const bridgeRot = yawAlong(rdx, rdz);
  const bankY = Math.max(heightAt(bx - rdx * 11, bz - rdz * 11), heightAt(bx + rdx * 11, bz + rdz * 11));
  const bridge = placeProp('building_bridge_A', bx, bz, { s: 11, rot: bridgeRot, y: bankY - 0.35, collide: false });
  const deck = surfaceUnder(bridge, bx, bz, bankY + 20) ?? bankY;
  // deck as a walkable slab, and railings so you don't step off the side
  const bsz = propSize('building_bridge_A');
  const halfLen = bsz.hz * 11, halfW = bsz.hx * 11;
  addBox(bx, bz, halfW * 0.8, halfLen, -bridgeRot, deck - 3, deck, 'bridge');
  for (const s of [-1, 1]) {
    const px = bx + Math.cos(bridgeRot) * s * halfW * 0.92, pz = bz - Math.sin(bridgeRot) * s * halfW * 0.92;
    addBox(px, pz, 0.2, halfLen * 0.85, -bridgeRot, deck, deck + 1.1, 'rail');
  }
  STRUCT.bridge = { x: bx, z: bz, deck };

  /* the watchtower on the ridge crest — climb it to see the region */
  let tx = -105, tz = 146, best = -1;
  for (let k = 0; k <= 20; k++) {   // highest point along the ridge spine
    const t = k / 20, x = lerp(RIDGE.ax, RIDGE.bx, t), z = lerp(RIDGE.az, RIDGE.bz, t);
    const h = heightAt(x, z); if (h > best && t > 0.3 && t < 0.7) { best = h; tx = x; tz = z; }
  }
  const tower = placeProp('building_tower_A_red', tx, tz, { s: 10, rot: 0.3 });
  const topY = surfaceUnder(tower, tx, tz, tower.position.y + 40) ?? tower.position.y + 17;
  STRUCT.tower = { x: tx, z: tz, top: topY, base: tower.position.y, obj: tower };
  addBox(tx, tz, 2.6, 2.6, 0, topY - 1, topY, 'towerTop');
  INTERACTABLES.push({ pos: new THREE.Vector3(tx + Math.sin(0.3) * 6, tower.position.y + 1, tz + Math.cos(0.3) * 6), r: 5, label: () => 'Climb the watchtower', action: () => climbTower() });

  /* Roa's sealed gate in the eastern pass, walls climbing the slopes, the city beyond */
  const gx = 786, gz = 380;
  placeProp('wall_straight_gate', gx, gz, { s: 10, rot: Math.PI / 2 });
  for (const off of [-20, -40, -60, 20, 40, 60]) placeProp('wall_straight', gx + Math.abs(off) * 0.08, gz + off, { s: 10, rot: Math.PI / 2, sink: 1.5 });
  addBox(gx, gz, 1.2, 12, 0, heightAt(gx, gz) - 2, heightAt(gx, gz) + 12, 'roaGate');
  INTERACTABLES.push({ pos: new THREE.Vector3(gx - 4, heightAt(gx - 4, gz), gz), r: 6, label: () => 'The gate to Roa',
    action: () => BUS.emit('toast', { text: 'The gate is barred from the other side. (Milestone 2)', cls: 'big' }) });
  placeProp('building_castle_red', 1030, 380, { s: 22, rot: -Math.PI / 2, collide: false, y: heightAt(1030, 380) - 2 });
  for (const [x, z] of [[1000, 330], [1000, 430], [1065, 340], [1065, 420]]) placeProp('building_tower_B_red', x, z, { s: 13, collide: false });

  /* Brigands' Rest */
  const C = PLACES.camp;
  for (const [dx, dz] of [[-8, -4], [6, -7], [8, 6]]) placeProp('tent', C.x + dx, C.z + dz, { s: 8, rot: yawTo(C.x + dx, C.z + dz, C.x, C.z) });
  campfire(C.x, C.z);
  for (const [dx, dz, n] of [[-3, 8, 'crate_A_big'], [-5, 9, 'barrel'], [11, -1, 'weaponrack'], [-11, 4, 'crate_long_A'], [2, -10, 'sack']])
    placeProp(n, C.x + dx, C.z + dz, { s: 5, rot: R() * TAU });

  /* the Sunken Chapel ruins, its heart behind brambles */
  const RU = PLACES.ruinsE;
  placeProp('building_destroyed', RU.x, RU.z, { s: 14, rot: 0.8 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + 0.3;
    placeProp(i % 3 ? 'fence_stone_straight' : 'fence_stone_straight_gate', RU.x + Math.cos(a) * 20, RU.z + Math.sin(a) * 20, { s: 6, rot: a, pad: 0.8 });
  }
  addBramble(RU.x + 12, RU.z + 14, 4.5);

  /* the cave mouth under the cliffs */
  buildCaveMouth();

  for (const w of WAYSTONES) buildWaystone(w);
}

/* brambles: a thorn thicket that blocks a path until fire clears it */
function addBramble(x, z, r) {
  const g = new THREE.Group();
  const mat = toonMat({ color: '#3c3020' }), thorn = toonMat({ color: '#5a4a30' });
  const R = mulberry32(Math.round(x * 7 + z));
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.6 + R() * 0.9, 0.06, 4, 10, Math.PI * (1 + R())), R() < 0.5 ? mat : thorn);
    m.position.set((R() - 0.5) * r * 1.6, 0.5 + R() * 1.6, (R() - 0.5) * r * 1.6);
    m.rotation.set(R() * TAU, R() * TAU, R() * TAU);
    m.castShadow = true;
    g.add(m);
  }
  g.position.set(x, heightAt(x, z), z);
  STRUCT.group.add(g);
  const col = addCircle(x, z, r, g.position.y - 1, g.position.y + 2.6, 'bramble');
  BRAMBLES.push({ mesh: g, col });
}

function buildCaveMouth() {
  const C = PLACES.cave;
  // find the cliff face: walk north from the waystone until the ground rises steeply
  let x = C.x, z = WAYSTONES[2].z - 10;
  for (let i = 0; i < 60; i++) { if (heightAt(x, z - 3) - heightAt(x, z) > 2.2) break; z -= 2; }
  const y = heightAt(x, z);
  const rock = propMaterial();
  const g = new THREE.Group(); g.position.set(x, y, z);
  const pieces = [[-6, 0, 0, 2.6, 0.2], [6, 0, 0, 2.6, -0.2], [-4.5, 7, -1, 2.2, 0.9], [4.5, 7, -1, 2.2, -0.9], [0, 10, -1.5, 2.8, 1.57]];
  for (const [px, py, pz, s, rz] of pieces) {
    const r = PROPS_LIB.get('rock_single_E').clone(true);
    r.scale.set(s * 9, s * 12, s * 9); r.position.set(px, py, pz); r.rotation.z = rz;
    r.traverse(o => { if (o.isMesh) o.material = rock; });
    g.add(r);
  }
  // the dark within
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(9, 11), new THREE.MeshBasicMaterial({ color: '#050407' }));
  dark.position.set(0, 5.3, -2.2); g.add(dark);
  g.rotation.y = 0;
  STRUCT.group.add(g);
  for (const s of [-1, 1]) addBox(x + s * 6.5, z - 1, 1.8, 3, 0, y - 1, y + 12);
  STRUCT.caveMouth = { x, z, y };
  // two torches flank the entrance
  for (const s of [-1, 1]) FIRES.push({ pos: new THREE.Vector3(x + s * 3.6, y + 2.4, z + 2.5), small: true });
  INTERACTABLES.push({ pos: new THREE.Vector3(x, y + 0.5, z + 3), r: 5, label: () => 'Enter the Weeping Cave', action: () => enterCave() });
}
