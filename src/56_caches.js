/* ═══════════════════════════════════════════════════════════════════════
   CACHES — eleven small iron-bound chests tucked off the paths, six in
   Buena, five round Roa: under a ridge, by the lake, behind the chapel,
   in the outskirts' gullies. Each holds a little something that stays
   with you (health, wind, a school's understanding) and a note from
   whoever hid it. No markers: a glint catches the eye when you're close.
   ═══════════════════════════════════════════════════════════════════════ */
const CACHES = { list: [], group: new THREE.Group(), mat: null };
// anchor: where to start looking for level, dry, unbuilt ground (the search spirals out to 16 m)
const CACHE_SPOTS = [
  { id: 'lake', x: -560, z: 497, boon: { hp: 6 }, who: 'A fisherman\'s tin',
    t: 'Wrapped in oilcloth under the roots: hooks, line, and a stoppered flask marked in a child\'s hand — "for when Da gets the cough." It is strong, and warm going down.' },
  { id: 'ridge', x: -205, z: 118, boon: { stamina: 4 }, who: 'An old soldier\'s pack',
    t: 'A Fittoa border-guard\'s kit, long abandoned: a good pair of boot-wraps and a strip of jerky that has outlived its owner. The wraps fit.' },
  { id: 'falls', x: -342, z: -515, boon: { prof: 'water' }, who: 'A water-stained primer',
    t: 'Someone studied here, where the spray keeps the air cool. Margins full of notes on intermediate water-magic, in a neat hand. Some of them make sense now.' },
  { id: 'forest', x: 300, z: -330, boon: { hp: 6 }, who: 'A hunter\'s cache',
    t: 'Snares, a whetstone, and a pouch of dried herbs a healer would pay for. "Steep in hot water. Do NOT eat raw — Gil." You steep. It helps.' },
  { id: 'chapel', x: 546, z: -404, boon: { prof: 'heal' }, who: 'A Millis prayer-book',
    t: 'The chapel\'s last priest hid this when the dead began to stir: a prayer-book with the healing rites written out in full, underlined twice.' },
  { id: 'hill', x: -196, z: 584, boon: { stamina: 4 }, who: 'A small wooden box',
    t: 'A toy sword, carefully carved, and a note in your father\'s hand: "For Rudy, when he\'s old enough. Don\'t tell your mother." You are old enough.' },
  { id: 'pass', x: 1062, z: 446, boon: { hp: 6 }, who: 'A courier\'s dead-drop',
    t: 'A letter sealed in Boreas red — the seal already broken, the letter long gone — and the courier\'s spare tonic, never needed. It is now.' },
  { id: 'colossus', x: 1436, z: 30, boon: { prof: 'earth' }, who: 'A clay tablet',
    t: 'Marks pressed into clay by someone who sat in the giant\'s shadow and thought very hard about stone. The shapes stay with you when you close your eyes.' },
  { id: 'mesa', x: 2062, z: 238, boon: { stamina: 4 }, who: 'A brigand\'s stash',
    t: 'Wagonbreak\'s rainy-day money, by the look of it — taken by someone else first. They left the good boots. Brigands steal good boots.' },
  { id: 'gardens', x: 1470, z: 560, boon: { hp: 6 }, who: 'A farmer\'s strongbox',
    t: 'Seed-corn, a deed to a field that isn\'t there anymore, and a jar of honey-wine labelled "Joss — mine — HANDS OFF". Sorry, Joss.' },
  { id: 'wall', x: 2096, z: -30, boon: { prof: 'wind' }, who: 'A sentry\'s sketchbook',
    t: 'Pages of birds drawn from life on the First Wall\'s lip, and how the wind runs under their wings. Whoever drew them watched for a long time.' },
];
const _chV = new THREE.Vector3();

function cacheSpotOk(x, z) {
  const h = heightAt(x, z);
  if (roadDistAt(x, z) < 6) return false;
  for (const [dx, dz] of [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) {
    const sx = x + dx, sz = z + dz, sh = heightAt(sx, sz);
    if (waterAt(sx, sz) > NO_WATER || groundAt(sx, sz, sh + 60, 0.5) > sh + 0.25) return false;
  }
  return normalAt(x, z, _chV).y > 0.86 && h > WORLD.lakeLevel + 0.6;
}
function findCacheSpot(s) {
  for (let r = 0; r <= 16; r += 2) {
    const n = r ? Math.round(r * 2.5) : 1;
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + r * 0.37, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
      if (cacheSpotOk(x, z)) return { x, z };
    }
  }
  return null;
}

function buildChest() {
  const mat = CACHES.mat || (CACHES.mat = toonMat({ vertexColors: true, rim: true }));
  const box = new THREE.BoxGeometry(1, 1, 1), wood = '#6a4426', woodD = '#4e301a', iron = '#3a3836', brass = '#c9a227';
  const root = new THREE.Group();
  // the body: planks, two iron bands, iron corners
  const bp = [[box, wood, 0, 0.21, 0, 0.82, 0.42, 0.52], [box, woodD, 0, 0.02, 0, 0.84, 0.04, 0.54]];
  for (const x of [-0.26, 0.26]) bp.push([box, iron, x, 0.21, 0, 0.06, 0.44, 0.545]);
  for (const x of [-0.41, 0.41]) for (const z of [-0.26, 0.26]) bp.push([box, iron, x, 0.21, z, 0.03, 0.44, 0.03]);
  bp.push([box, brass, 0, 0.36, 0.265, 0.1, 0.12, 0.02]);
  root.add(mergedPart(bp, mat));
  // the lid, hinged along the back top edge
  const lid = new THREE.Group(); lid.position.set(0, 0.42, -0.26); root.add(lid);
  const half = new THREE.CylinderGeometry(0.26, 0.26, 0.82, 10, 1, false, 0, Math.PI); half.rotateZ(Math.PI / 2);
  const lp = [[half, wood, 0, 0, 0.26, 1, 0.55, 1], [box, woodD, 0, 0.012, 0.26, 0.8, 0.024, 0.5]];   // a flat underside: the inside shows when it's open
  for (const x of [-0.26, 0.26]) lp.push([half, iron, x, 0, 0.26, 0.075, 0.57, 1.03]);
  lp.push([box, brass, 0, 0.0, 0.53, 0.12, 0.08, 0.03]);
  lid.add(mergedPart(lp, mat));
  root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return { root, lid };
}

// The meadow grass stands taller than a chest: trample a small clearing round each one.
function thinGrassAround(x, z, r) {
  const c = WORLD.cell, N = TER.NX, G8 = TER.GRASS;
  const i0 = Math.max(0, Math.floor((x - r - 3 - WORLD.x0) / c)), i1 = Math.min(N - 1, Math.ceil((x + r + 3 - WORLD.x0) / c));
  const j0 = Math.max(0, Math.floor((z - r - 3 - WORLD.z0) / c)), j1 = Math.min(TER.NZ - 1, Math.ceil((z + r + 3 - WORLD.z0) / c));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = smooth(r, r + 2.5, Math.hypot(WORLD.x0 + i * c - x, WORLD.z0 + j * c - z)), o = j * N + i;
    G8[o] = Math.round(G8[o] * k);
  }
  if (TER.grassTex) TER.grassTex.needsUpdate = true;
}

function buildCaches() {
  STRUCT.group.add(CACHES.group);
  for (const s of CACHE_SPOTS) {
    const p = findCacheSpot(s);
    if (!p) { if (DEV) console.warn('cache: no ground near', s.id); continue; }
    const { root, lid } = buildChest();
    const y = heightAt(p.x, p.z);
    // facing downhill/outward a little at random, sat into the ground
    const face = Math.atan2(s.x - p.x || 0.3, s.z - p.z || 0.7) + Math.PI + (((s.x * 13 + s.z * 7) % 10) / 10 - 0.5);
    root.position.set(p.x, y - 0.04, p.z); root.rotation.y = face;
    CACHES.group.add(root);
    thinGrassAround(p.x, p.z, 2.2);
    const col = addBox(p.x, p.z, 0.42, 0.27, -face, y - 0.5, y + 0.62, 'prop');
    const C = { ...s, x: p.x, z: p.z, y, root, lid, col, open: 0, opening: false, glintT: Math.random() * 2, pos: new THREE.Vector3(p.x, y, p.z) };
    CACHES.list.push(C);
    INTERACTABLES.push({ pos: C.pos, r: 2.2, label: () => 'Open the chest', enabled: () => !cacheTaken(C.id), action: () => openCache(C) });
  }
}
const cacheTaken = id => !!(G && G.caches && G.caches.includes(id));
// on load / new game: lids as the save has them
function resetCaches() {
  for (const C of CACHES.list) { C.opening = false; C.open = cacheTaken(C.id) ? 1 : 0; C.lid.rotation.x = -C.open * 1.9; }
}

function openCache(C) {
  if (cacheTaken(C.id)) return;
  (G.caches || (G.caches = [])).push(C.id);
  C.opening = true;
  setPlayerState('interact'); PL.actor.once('Interact', { speed: 1.2 });
  PL.face = Math.atan2(C.x - PL.body.pos.x, C.z - PL.body.pos.z);
  BUS.emit('sfx', { id: 'chest', pos: C.pos });
  emit(14, { pos: C.pos.clone().setY(C.y + 0.6), col: '#ffe8a0', spread: 0.3, velSpread: 1.2, upBias: 2.2, life: 0.9, size: 0.08, size2: 0.02, gravity: -0.5, bright: 2 });
  const b = C.boon;
  let gain = '';
  if (b.hp) { G.maxHp += b.hp; G.hp = G.maxHp; gain = 'Max health +' + b.hp; }
  if (b.stamina) { G.maxStamina += b.stamina; G.stamina = G.maxStamina; gain = 'Max stamina +' + b.stamina; }
  if (b.prof) {
    const before = learnedIds();
    G.prof[b.prof] = (G.prof[b.prof] || 0) + 8;
    checkUnlocks(before);
    gain = SCHOOLS[b.prof].name + ' understanding deepens';
  }
  gainXp(25);
  G.coin = (G.coin || 0) + 35; gain += '  ·  35 silver';
  say([{ s: C.who, t: C.t + '   (' + G.caches.length + ' / ' + CACHES.list.length + ')' }]).then(() => { toast(gain, 'good'); BUS.emit('sfx', { id: 'pickup' }); });
  autosave();
}

function updateCaches(dt) {
  if (!G || GAME.inCave || !CACHES.list.length) return;
  const p = PL.body.pos;
  for (const C of CACHES.list) {
    if (C.opening && C.open < 1) { C.open = Math.min(1, C.open + dt * 1.6); const k = 1 - Math.pow(1 - C.open, 3); C.lid.rotation.x = -k * 1.9; }
    if (cacheTaken(C.id)) continue;
    // a glint, now and then, when you're near enough to notice it
    const d2 = (C.x - p.x) ** 2 + (C.z - p.z) ** 2;
    if (d2 > 40 * 40) continue;
    if (d2 < 10 * 10 && !C.erisSaw) { C.erisSaw = true; erisSays('chest'); }
    if ((C.glintT -= dt) <= 0) {
      C.glintT = 1.4 + Math.random() * 1.6;
      emit(1, { pos: _chV.set(C.x + rnd(-0.3, 0.3), C.y + 0.5, C.z + rnd(-0.2, 0.2)), col: '#fff2c0', vel: { x: 0, y: 0.25, z: 0 }, velSpread: 0.05, life: 0.7, size: 0.22, size2: 0.0, bright: 3, gravity: 0 });
    }
  }
}
function cachesGot() { return CACHES.list.filter(C => cacheTaken(C.id)).length; }
