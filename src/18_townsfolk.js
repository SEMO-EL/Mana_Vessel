/* ═══════════════════════════════════════════════════════════════════════
   TOWNSFOLK — people walking the streets by day: Roa's lanes and plaza,
   Buena's road. Each walks a street graph from corner to corner, stops
   now and then to look about, waits or steps aside when you're in the
   way, has a word for you if you stop them, and is indoors by night.

   The graphs are checked against everything built at boot: an edge that
   runs through a house, a stall or a lamp is dropped (logged in dev).
   ═══════════════════════════════════════════════════════════════════════ */
const TOWN = { walkers: [], graphs: {}, greetT: 20, dropped: [] };

// Roa: the main road through the west and east gates, a ring round the fountain,
// the avenue to the estate, the south street to the gate, the quarter street and both lanes
function roaTownNodes() {
  const P = ROA_PLAZA, ring = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ring.push(['p' + i, P.x + Math.cos(a) * 8.6, P.z + Math.sin(a) * 8.6]); }
  return {
    nodes: [
      ['wg', 1452, 385], ['b', 1500, 385], ['c', 1532, 386], ['f', 1588, 386], ['g', 1620, 385], ['eg', 1668, 385],
      ['d', 1560, 358], ['i', 1560, 339], ['e', 1556, 414], ['n', 1552, 440], ['s', 1552, 486],
      ['m', 1456, 440], ['k', 1500, 440], ['o', 1620, 440], ['q', 1664, 440],
      ['j', 1500, 302], ['l', 1500, 482], ['qn', 1620, 302], ['r', 1620, 482], ...ring,
    ],
    edges: [
      ['wg', 'b'], ['b', 'c'], ['c', 'p4'], ['f', 'p0'], ['f', 'g'], ['g', 'eg'],
      ['d', 'p6'], ['d', 'i'], ['e', 'p2'], ['e', 'n'], ['n', 's'],
      ['m', 'k'], ['k', 'n'], ['n', 'o'], ['o', 'q'],
      ['j', 'b'], ['b', 'k'], ['k', 'l'], ['qn', 'g'], ['g', 'o'], ['o', 'r'],
      ...ring.map((r, i) => [r[0], ring[(i + 1) % 8][0]]),
    ],
  };
}
// Buena: up and down the road through the village
function buenaTownNodes() {
  const pts = [[-585, 333], [-552, 339], [-520, 345], [-488, 351], [-456, 356], [-420, 362], [-396, 370]];
  return { nodes: pts.map((p, i) => ['v' + i, p[0], p[1]]), edges: pts.slice(1).map((p, i) => ['v' + i, 'v' + (i + 1)]) };
}

// the long road: every other point of the smoothed road between two x's, kept to its right-hand side
function roadTownNodes(x0, x1, key) {
  const pts = TER.roadPath.filter(p => p[0] >= x0 && p[0] <= x1), sel = pts.filter((_, i) => i % 2 === 0);
  if (pts.length && sel[sel.length - 1] !== pts[pts.length - 1]) sel.push(pts[pts.length - 1]);
  const nodes = sel.map((p, i) => {
    const q = sel[Math.min(i + 1, sel.length - 1)], o = sel[Math.max(i - 1, 0)], dx = q[0] - o[0], dz = q[1] - o[1], l = Math.hypot(dx, dz) || 1;
    return [key + i, p[0] - dz / l * 1.3, p[1] + dx / l * 1.3];
  });
  return { nodes, edges: sel.slice(1).map((p, i) => [key + i, key + (i + 1)]) };
}
function buildTownGraph(key, def) {
  const N = new Map();
  for (const [k, x, z] of def.nodes) N.set(k, { k, x, z, nb: [] });
  const gy = (x, z) => heightAt(x, z);
  const blocked = (x, z) => groundAt(x, z, gy(x, z) + 60, 0.42) > gy(x, z) + 0.3 || waterAt(x, z) > heightAt(x, z) - 0.2;
  for (const [a, b] of def.edges) {
    const A = N.get(a), B = N.get(b), len = Math.hypot(B.x - A.x, B.z - A.z);
    let ok = true;
    for (let t = 0; t <= len && ok; t += 0.8) { const k = t / len; if (blocked(lerp(A.x, B.x, k), lerp(A.z, B.z, k))) ok = false; }
    if (!ok) { TOWN.dropped.push(key + ':' + a + '-' + b); continue; }
    A.nb.push(B); B.nb.push(A);
  }
  const list = [...N.values()].filter(n => n.nb.length);
  TOWN.graphs[key] = list;
  if (DEV && TOWN.dropped.length) console.warn('town edges dropped', TOWN.dropped);
  return list;
}

const TOWN_HAIR = ['#3a2418', '#6a4a2a', '#a37a3c', '#2a2230', '#c8a060', '#7a6a5a', '#4a3020', '#d8c8a0', '#8a3a24'];
const TOWN_CLOTH = ['#6a7a4a', '#3e4a5e', '#7a5a3a', '#5a3a4a', '#4a5a6a', '#8a6a3a', '#3a4a3a', '#6a3a2a', '#5a5a6a'];
function townSpec(R) {
  const base = ['Rogue', 'Barbarian', 'Mage', 'Rogue', 'Knight', 'Rogue_Hooded', 'Barbarian'][(R() * 7) | 0];
  const hair = TOWN_HAIR[(R() * TOWN_HAIR.length) | 0], c1 = TOWN_CLOTH[(R() * TOWN_CLOTH.length) | 0], c2 = TOWN_CLOTH[(R() * TOWN_CLOTH.length) | 0];
  const rc = base === 'Barbarian' ? { barbarian: { 1: hair, 6: c1 } }
    : base === 'Mage' ? { mage: { 1: hair, 8: c1, 9: c2 } }
    : base === 'Knight' ? { knight: { 1: hair } }
    : { rogue: { 1: hair, 8: c1, 21: c1, 9: c2 } };
  const hide = base === 'Knight' ? ['Knight_Helmet', 'Knight_Cape'] : base === 'Barbarian' && R() < 0.6 ? ['Barbarian_Hat', 'Barbarian_Cape'] : base === 'Mage' ? ['Mage_Hat', 'Mage_Cape'] : [];
  return { base, recolor: rc, hide };
}

const ROA_TOWNS_NAMES = ['Baker Wendel', 'Washerwoman Ilse', 'Carter Bram', 'Apprentice Nils', 'Old Hanne', 'Clerk Petra', 'Fishmonger Jory',
  'Seamstress Odile', 'Porter Gunt', 'Milkmaid Rosa', 'Tanner Hal', 'Young Pim', 'Widow Abel', 'Mason Krell'];
const ROAD_NAMES = { west: ['A Pilgrim', 'Pedlar Ostrik'], east: ['A Courier', 'Old Wanderer', 'Tinker Wenna'] };
const BUENA_TOWNS_NAMES = ['Shepherd Alain', 'Goodwife Marthe', 'Woodcutter Oskar', 'Nell, who keeps the hens', 'The Miller\'s Boy'];
// what they say depends on how far the story has come
function townLines(where) {
  const q = G ? G.quest : '';
  if (where === 'west' || where === 'east') return ['Long road to Roa. Longer back.', 'Mind the wolves where the forest comes down to the road.',
    "I've walked this road thirty years. It hasn't got any shorter.", "Buena's got the best cider in Fittoa. Don't tell Roa I said so.",
    ...(where === 'east' ? ["They've opened the pass gate again. About time.", "Roa's just over the rise. You'll smell the bakeries first."]
      : [G && G.flags.gateOpen ? "The pass gate's open again. Roa's three hours' walk, if your legs are young." : "The gate to Roa's barred, last I heard. Something about bandits."])];
  if (where === 'buena') {
    const L = ['Fine weather for the harvest.', 'Mind the cart ruts, they\'ll turn your ankle.', 'Your father was up before dawn swinging that sword again.',
      'Lady Zenith brought soup round when my Henri was ill. A saint, that woman.', 'Wolves on the forest road. Don\'t go alone.'];
    if (q === 'road' || q === 'done' || ROA_STEPS.includes(q)) L.push('Off to Roa, are you? Bring back something nice.', 'Roa! Big place. Bigger than Buena, anyway.');
    return L;
  }
  const L = ['Fine day for it.', 'Mind the carts.', 'Fresh bread at Marga\'s, if you\'re quick.', 'Gods, my back.',
    'Is it true you cast without chanting? My nephew says it\'s impossible.', 'Keep your spells holstered inside the walls, friend.'];
  L.push(...ROA_RUMOURS);
  if (q === 'toRoa' || q === 'findEris') L.push('You\'re the new tutor? The last one left in tears. Well — left.', 'Lady Eris? Try the forecourt. Follow the shouting.');
  if (q === 'ghislaine' || q === 'guild') L.push('Saw the Sword Saint training at dawn. Didn\'t see her sword move. Just the dummy falling over.');
  if (q === 'bandits') L.push('Brigands at Wagonbreak again. My brother\'s wagon never came home.');
  if (q === 'firstWall') L.push('Something\'s stirring out at the First Wall. Hunters won\'t go near it.');
  if (q === 'birthday') L.push('The young lady\'s birthday tonight! The kitchens have been at it since dawn.');
  if (q === 'done') L.push('Strange light over the hills, the other night. Gave me the shivers.', 'My grandmother says a light like that means a calamity. She says that about rain, too.');
  if (G && G.flags.wagons) L.push('They say the Guild\'s new mage cleared Wagonbreak. Was that you?');
  if (G && G.flags.firstWall) L.push('A golem! A real golem! And you knocked it flat? Drinks are on me. Not today. But someday.');
  return L;
}
const ROA_STEPS = ['toRoa', 'findEris', 'ghislaine', 'guild', 'bandits', 'firstWall', 'birthday'];
// Roa's night watch: out when the townsfolk go in, a lantern each
const ROA_WATCH = [['Watchman Hale', '#3a2418'], ['Watchwoman Brisa', '#a37a3c'], ['Watchman Odo', '#7a6a5a']];
function watchLines() {
  const L = ['Quiet night. Let\'s keep it that way.', 'Lamps lit, gates barred. Off to bed with you.', 'Twelve years on the watch and the worst I\'ve had is a drunk goat.',
    'Mind the dark lanes. Not that anything happens in Roa.', 'The keep\'s got its own guard. We get the streets. And the goats.'];
  if (G && G.flags.wagons) L.push('Quieter on the trade road since Wagonbreak. Our thanks, mage.');
  if (G && G.quest === 'done') L.push('That light over the hills again. The captain says it\'s nothing. The captain says that a lot.');
  return L;
}
let _watchLantern = null;
function watchLantern(actor) {
  const L = _watchLantern || (_watchLantern = {
    geo: new THREE.IcosahedronGeometry(0.1 / CHAR_SCALE, 1),
    mat: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc070').multiplyScalar(2.4) }),
    halo: new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color('#ffb060'), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
  });
  const g = new THREE.Mesh(L.geo, L.mat), h = new THREE.Sprite(L.halo);
  h.scale.setScalar(0.9 / CHAR_SCALE); g.add(h);
  (actor.bones.handslotl || actor.bones.handl || actor.root).add(g);
  return g;
}

class Walker {
  constructor(graph, where, name, R, o = {}) {
    this.graph = graph; this.where = where; this.name = name; this.R = R;
    this.night = !!o.night; this.lines = o.lines || null;          // the night watch: out by night, their own words
    this.actor = new Actor(o.spec || townSpec(R));
    if (o.lantern) { this.lantern = watchLantern(this.actor); this.lightPos = new THREE.Vector3(); }
    this.actor.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.actor.root);
    this.node = graph[(R() * graph.length) | 0]; this.prev = null; this.next = this.pickNext();
    this.pos = new THREE.Vector3(this.node.x, heightAt(this.node.x, this.node.z), this.node.z);
    this.body = { pos: this.pos, r: 0.36, vel: new THREE.Vector3() };
    this.speed = 1.2 + R() * 0.5; this.clip = ['Walking_A', 'Walking_B', 'Walking_C'][(R() * 3) | 0];
    this.face = 0; this.mode = 'walk'; this.wait = 0; this.blockT = 0; this.acc = 0; this.anim = ''; this.shown = true; this.shadow = true;
    this.idleClip = 'Idle';
    INTERACTABLES.push({ pos: this.pos, r: 2.4, label: () => 'Talk to ' + this.name,
      enabled: () => this.shown && this.actor.root.visible && !this.busy, action: () => this.talk() });
  }
  pickNext() {
    const nb = this.node.nb.filter(n => n !== this.prev), list = nb.length ? nb : this.node.nb;
    return list[(this.R() * list.length) | 0];
  }
  play(clip, speed = 1) { if (this.anim !== clip) { this.actor.loop(clip, { fade: 0.3, speed }); this.anim = clip; } }
  async talk() {
    this.busy = true; this.mode = 'talk';
    this.face = Math.atan2(PL.body.pos.x - this.pos.x, PL.body.pos.z - this.pos.z);
    this.actor.root.rotation.y = this.face; this.play('Idle');
    try { await npcSay(this, [{ s: this.name, t: pick(this.lines ? this.lines() : townLines(this.where)) }]); }
    finally { this.busy = false; this.mode = 'pause'; this.wait = 1.5; }
  }
  // put down somewhere out of sight (dawn, or back from being far away)
  respawn(cam) {
    let best = null;
    for (let i = 0; i < 8 && !best; i++) {
      const n = this.graph[(this.R() * this.graph.length) | 0];
      if (Math.hypot(n.x - cam.x, n.z - cam.z) > 45) best = n;
    }
    if (!best) return false;
    this.node = best; this.prev = null; this.next = this.pickNext();
    this.pos.set(best.x, heightAt(best.x, best.z), best.z);
    this.actor.root.position.copy(this.pos);
    return true;
  }
  update(dt, day, cam) {
    const d = Math.hypot(this.pos.x - cam.x, this.pos.z - cam.z);
    // night: off the streets once nobody's looking; morning: back out the same way
    if (!day && this.shown && this.mode !== 'talk' && (d > 28 || (d > 6 && behindCamera(this.pos)))) { this.shown = false; this.actor.root.visible = false; }
    if (day && !this.shown && this.respawn(cam)) this.shown = true;
    if (!this.shown) return;
    const far = d > 170;
    this.actor.root.visible = !far;
    if (far) return;
    if (this.mode === 'walk') this.walk(dt);
    else if (this.mode === 'pause') { this.play(this.idleClip); this.wait -= dt; if (this.wait <= 0) this.mode = 'walk'; }
    this.pos.y = floorAt(this.pos.x, this.pos.z);
    this.actor.root.position.copy(this.pos);
    this.actor.root.rotation.y = this.face;
    // shadows only up close; the animation at a lower rate far off
    const sh = d < 40;
    if (sh !== this.shadow) { this.shadow = sh; this.actor.root.traverse(o => { if (o.isMesh) o.castShadow = sh; }); }
    // a lantern lights the street round them (from the shared pool of lights, nearest first)
    if (this.lantern && d < 70) { this.lantern.getWorldPosition(this.lightPos); requestLight(this.lightPos, '#ffb060', 2.4, 9); }
    this.acc += dt;
    if (d > 55 && this.acc < 0.2) return;
    this.actor.update(this.acc); this.acc = 0;
  }
  walk(dt) {
    // in the rain, everyone but the watch hurries and nobody stops to look about
    const wet = WEATHER.cur.rain > 0.35 && !this.night, spd = this.speed * (wet ? 1.6 : 1);
    const tx = this.next.x, tz = this.next.z;
    let dx = tx - this.pos.x, dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.5) {
      this.prev = this.node; this.node = this.next; this.next = this.pickNext();
      if (!wet && this.R() < 0.2) { this.mode = 'pause'; this.wait = 2 + this.R() * 5; this.idleClip = this.R() < 0.7 ? 'Idle' : 'Interact'; this.face += (this.R() - 0.5) * 2; }
      return;
    }
    dx /= dist; dz /= dist;
    // you're in the way: wait a moment, then go round on the right
    const px = PL.body.pos.x - this.pos.x, pz = PL.body.pos.z - this.pos.z, pd = Math.hypot(px, pz);
    const inWay = pd < 1.9 && (px * dx + pz * dz) > pd * 0.55 && Math.abs(PL.body.pos.y - this.pos.y) < 1.5;
    if (inWay) this.blockT += dt; else this.blockT = Math.max(0, this.blockT - dt * 2);
    if (inWay && this.blockT < 1.0) { this.play('Idle'); this.face = dampAngle(this.face, Math.atan2(px, pz), 5, dt); return; }
    if (inWay) { const sx = -dz, sz = dx; dx = dx * 0.5 + sx * 0.9; dz = dz * 0.5 + sz * 0.9; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    this.pos.x += dx * spd * dt; this.pos.z += dz * spd * dt;
    pushOut(this.pos, 0.36, this.pos.y, 1.7);
    this.face = dampAngle(this.face, Math.atan2(dx, dz), 6, dt);
    this.play(this.clip, spd / 2.3 * 1.15);
  }
}

function buildTownsfolk() {
  const R = mulberry32(WORLD.seed + 707);
  const roa = buildTownGraph('roa', roaTownNodes()), buena = buildTownGraph('buena', buenaTownNodes());
  if (roa.length) for (const name of ROA_TOWNS_NAMES) TOWN.walkers.push(new Walker(roa, 'roa', name, R));
  if (buena.length) for (const name of BUENA_TOWNS_NAMES) TOWN.walkers.push(new Walker(buena, 'buena', name, R));
  // travellers on the long road, either side of the pass gate
  for (const [key, x0, x1] of [['west', -300, 770], ['east', 805, 1440]]) {
    const g = buildTownGraph(key, roadTownNodes(x0, x1, key[0]));
    if (g.length > 2) for (const name of ROAD_NAMES[key]) TOWN.walkers.push(new Walker(g, key, name, R));
  }
  // last, so everyone above keeps the faces the seed gave them
  if (roa.length) for (const [name, hair] of ROA_WATCH) TOWN.walkers.push(new Walker(roa, 'roa', name, R, {
    night: true, lantern: true, lines: watchLines,
    spec: { base: 'Knight', recolor: { knight: { 1: hair } }, show: ['Knight_Helmet'], hide: ['Knight_Cape'] } }));
}
function updateTownsfolk(dt) {
  if (!TOWN.walkers.length || GAME.inCave) return;
  const h = TOD.hour, day = h > 6.3 && h < 20.0, cam = camera.position;
  for (const w of TOWN.walkers) w.update(dt, w.night ? !day : day, cam);
  // a passing word now and then, never mid-fight or mid-talk
  TOWN.greetT -= dt;
  if (G && TOWN.greetT <= 0 && !UI.dlg && PL.state === 'move' && !ENT.enemies.some(e => e.aggro && !e.dead)) {
    const p = PL.body.pos;
    const w = TOWN.walkers.find(w => w.shown && w.mode === 'walk' && Math.hypot(w.pos.x - p.x, w.pos.z - p.z) < 3.2);
    if (w) {
      TOWN.greetT = 28 + Math.random() * 20;
      const tod = h < 5 || h >= 21.5 ? 'Late to be out.' : h < 12 ? 'Morning.' : h < 17.5 ? 'Afternoon.' : 'Evening.';
      const wet = WEATHER.cur.rain > 0.35 ? ['Wet enough for you?', 'Get indoors, you will catch your death!', 'Rain, rain, rain...'] : [];
      bark(w.name, pick([tod, tod, ...wet, ...wet, 'Good day to you.', 'Mind yourself.', 'Gods keep you.', ...(w.where === 'roa' && G.quest !== 'toRoa' ? ['Tutor.'] : ['Young master.'])]));
    }
  }
}
const _bcF = new THREE.Vector3();
function behindCamera(p) { camera.getWorldDirection(_bcF); return (p.x - camera.position.x) * _bcF.x + (p.z - camera.position.z) * _bcF.z < 0; }
function townBodies() {
  const out = [];
  for (const w of TOWN.walkers) if (w.shown && w.actor.root.visible && w.pos.distanceToSquared(PL.body.pos) < 400) out.push(w.body);
  return out;
}
