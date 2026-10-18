/* ═══════════════════════════════════════════════════════════════════════
   ROAD EVENTS — the road doesn't wait for you. Every so often, a little
   way ahead on the long road, someone is in trouble: a pedlar backed
   against their spilled pack by wolves, a pilgrim stopped by brigands,
   a courier ringed by jackals at dusk. Step in and they'll thank you —
   and, if you stop to talk, tell you about a blue light they saw on the
   way (a mana crystal, marked from then on). Ride past and they're gone
   when you look back.

   One at a time, outdoors, once you can fight (from the wolves on), never
   inside a town, a camp or another encounter's ground.
   ═══════════════════════════════════════════════════════════════════════ */
const EVENTS = { t: 300, cur: null, n: 0 };
const EVENT_FOLK = ['Pedlar Marten', 'Pilgrim Ysolde', 'Courier Fenn', 'Tinker Rosalind', 'Farmer Gil', 'Old Berthe', 'Goatherd Pim', 'Journeyman Corwin'];
const EVENT_LINES = {
  help: ['Help! Someone, please!', 'Over here — please!', 'Get back! Get BACK!', 'Somebody! Anybody!'],
  thanks: ['You — you saved my life. Gods keep you.', 'I thought that was the end of me. Thank you.', 'Bless you. I\'ll not forget this.', 'That was... thank you. Truly.'],
  talk: ['I\'ll keep to the middle of the road from now on, I promise you that.', 'Safe travels — safer than mine, I hope.', 'I\'d pay you if they\'d left me anything worth the paying.'],
};
const _evF = new THREE.Vector3(), _evN = new THREE.Vector3();

// once you can fight: the wolves' errand on
function eventsOpen() {
  const at = QUEST.findIndex(q => q.id === G.quest), from = QUEST.findIndex(q => q.id === 'wolves');
  return at >= from && from >= 0;
}

// who's after them: wolves by night this side of the pass, jackals beyond it; brigands by day
function eventPack(x, night) {
  const roa = x > 800, more = G.lvl >= 6 ? 1 : 0, rep = (k, n) => Array(n).fill(k);
  if (night) return roa ? rep('jackal', 3 + more) : rep('wolf', 2 + more);
  if (roa) return Math.random() < 0.5 ? rep('jackal', 2 + more) : ['bandit', 'bandit', ...(more ? ['marksman'] : [])];
  return Math.random() < 0.65 ? ['bandit', 'bandit', ...(more ? ['bandit'] : [])] : rep('wolf', 2 + more);
}

// A spot on the road ~110 m along it from you, the way you're looking first:
// open ground, dry, level, unbuilt, and clear of towns and other fights.
function eventSpot() {
  const P = TER.roadPath, p = PL.body.pos;
  if (!P || P.length < 3) return null;
  let bi = 0, bd = Infinity;
  for (let i = 0; i < P.length; i++) { const d = Math.hypot(P[i][0] - p.x, P[i][1] - p.z); if (d < bd) { bd = d; bi = i; } }
  if (bd > 60) return null;
  camera.getWorldDirection(_evF);
  const cands = [];
  for (const dir of [1, -1]) {
    let acc = 0;
    for (let i = bi; i + dir >= 0 && i + dir < P.length; i += dir) {
      acc += Math.hypot(P[i + dir][0] - P[i][0], P[i + dir][1] - P[i][1]);
      if (acc >= 110) { cands.push(i + dir); break; }
    }
  }
  const ahead = i => (P[i][0] - p.x) * _evF.x + (P[i][1] - p.z) * _evF.z;
  cands.sort((a, b) => ahead(b) - ahead(a));
  for (const i of cands) {
    const q = P[Math.min(i + 1, P.length - 1)], o = P[Math.max(i - 1, 0)], dx = q[0] - o[0], dz = q[1] - o[1], l = Math.hypot(dx, dz) || 1;
    for (const side of Math.random() < 0.5 ? [1, -1] : [-1, 1]) {
      const x = P[i][0] - dz / l * 4.5 * side, z = P[i][1] + dx / l * 4.5 * side;
      if (eventSpotOk(x, z)) return { x, z, roadAng: Math.atan2(dx, dz) };
    }
  }
  return null;
}
function eventSpotOk(x, z) {
  if (x < WORLD.px0 + 20 || x > WORLD.px1 - 20 || z < WORLD.pz0 + 20 || z > WORLD.pz1 - 20) return false;
  if (Math.hypot(x - PL.body.pos.x, z - PL.body.pos.z) < 80) return false;
  if (Math.hypot(x - VILLAGE_BASIN.x, z - VILLAGE_BASIN.z) < VILLAGE_BASIN.r + 40) return false;    // Buena
  if (rectDist(x, z, ROA_CITY) < 60) return false;                                                // Roa
  if (Math.abs(x - 800) < 70) return false;                                                       // the pass gate
  for (const enc of ENCOUNTERS) if (Math.hypot(enc.x - x, enc.z - z) < 90) return false;
  for (const W of WSTONE.list) if (Math.hypot(W.x - x, W.z - z) < 30) return false;
  for (let a = 0; a < 6; a++) {                                                                   // room to fight in
    const sx = x + Math.cos(a) * 6, sz = z + Math.sin(a) * 6, h = heightAt(sx, sz);
    if (waterAt(sx, sz) > NO_WATER || groundAt(sx, sz, h + 60) > h + 0.3) return false;
  }
  return normalAt(x, z, _evN).y > 0.88;
}

function eventProp(name, x, z, rot, tilt) {
  const tpl = PROPS_LIB.get(name); if (!tpl) return null;
  const o = tpl.clone(true);
  o.scale.setScalar(5); o.rotation.set(tilt || 0, rot, 0, 'YXZ');      // turned, then tipped over
  o.position.set(x, 0, z); o.updateMatrixWorld(true);
  o.position.y = heightAt(x, z) - new THREE.Box3().setFromObject(o).min.y - 0.1;
  o.updateMatrixWorld(true);
  o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(o);
  return o;
}

function startRoadEvent(s) {
  const k = EVENTS.n++;
  const actor = new Actor(townSpec(mulberry32(WORLD.seed + 900 + (k % 6))));   // six faces, so the material cache stays small
  actor.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const y = heightAt(s.x, s.z), pos = new THREE.Vector3(s.x, y, s.z);
  actor.root.position.copy(pos);
  scene.add(actor.root);
  actor.loop('Blocking', { fade: 0 });
  const E = { x: s.x, z: s.z, pos, name: EVENT_FOLK[k % EVENT_FOLK.length], actor, face: s.roadAng, phase: 'beset', t: 0, called: false, talked: false, acc: 0 };
  E.col = addCircle(s.x, s.z, 0.4, y, y + 1.8, 'npc');
  // what they were carrying, on the ground
  const ra = s.roadAng;
  E.props = [eventProp('sack', s.x + Math.sin(ra + 1.9) * 1.3, s.z + Math.cos(ra + 1.9) * 1.3, ra + 0.6, 1.2), eventProp('crate_A_big', s.x + Math.sin(ra - 2.3) * 1.6, s.z + Math.cos(ra - 2.3) * 1.6, ra + 0.3, 0)].filter(Boolean);
  for (const o of E.props) { const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()); o.userData.col = addCircle(c.x, c.z, Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 0.4, b.min.y, b.max.y, 'prop'); }
  // and who's after them, prowling a ring round them
  const pack = eventPack(s.x, SKY_NOW.night > 0.5);
  E.foes = pack.map((key, i) => {
    const a = i / pack.length * TAU + rnd(-0.4, 0.4), r = rnd(3.6, 5);
    const ex = s.x + Math.cos(a) * r, ez = s.z + Math.sin(a) * r;
    const e = new Enemy(key, ex, ez, { face: Math.atan2(s.x - ex, s.z - ez) });
    e.home.set(s.x, 0, s.z); e.menace = true; e.eventFoe = true;
    return e;
  });
  E.beasts = ENEMY_DEFS[pack[0]].rig === 'wolf';
  E.interact = { pos, r: 2.6, label: () => 'Talk to ' + E.name, enabled: () => E.phase === 'saved' && !E.busy, action: () => talkTraveller(E) };
  INTERACTABLES.push(E.interact);
  EVENTS.cur = E;
  if (E.beasts) BUS.emit('sfx', { id: pack[0] === 'boar' ? 'snarl' : 'howl', pos });
  hint(E.beasts ? 'Howling, somewhere up the road — and someone shouting.' : 'Shouting, somewhere up the road.', 3.5);
  return E;
}

async function talkTraveller(E) {
  E.busy = true;
  try {
    const lines = [{ s: E.name, t: E.talked ? pick(EVENT_LINES.talk) : pick(EVENT_LINES.thanks) }];
    // a tip, the first time: a crystal they passed that you haven't seen
    let tip = null;
    if (!E.talked && typeof CRYSTALS !== 'undefined') {
      const seen = G.crystalsSeen || (G.crystalsSeen = []), got = G.crystals || [];
      const left = CRYSTALS.list.filter(c => !c.after && !seen.includes(c.id) && !got.includes(c.id));
      left.sort((a, b) => Math.hypot(a.x - E.x, a.z - E.z) - Math.hypot(b.x - E.x, b.z - E.z));
      tip = left[0] || null;
      if (tip) lines.push({ s: E.name, t: `One more thing. On my way I saw a blue light up at ${tip.hint} — one of those mana stones, I'd swear to it.` });
    }
    E.talked = true;
    await npcSay(E, lines);
    if (tip && !G.crystalsSeen.includes(tip.id)) { G.crystalsSeen.push(tip.id); toast('Marked on your map: a mana crystal', 'good'); BUS.emit('sfx', { id: 'page' }); }
  } finally { E.busy = false; }
}

function endRoadEvent(E) {
  scene.remove(E.actor.root);
  removeCollider(E.col);
  for (const o of E.props) { scene.remove(o); if (o.userData.col) removeCollider(o.userData.col); }
  for (const e of E.foes) if (!e.removed && !e.dead) e.remove();
  const i = INTERACTABLES.indexOf(E.interact); if (i >= 0) INTERACTABLES.splice(i, 1);
  if (EVENTS.cur === E) EVENTS.cur = null;
  EVENTS.t = rnd(360, 600);
}

function updateRoadEvent(E, dt) {
  E.t += dt;
  const p = PL.body.pos, d = Math.hypot(p.x - E.x, p.z - E.z);
  // cleared away rather than killed (you died, travelled, loaded): the moment's gone, nobody was saved
  if (E.phase === 'beset' && E.foes.some(e => e.removed && !e.dead)) { endRoadEvent(E); return; }
  const live = E.foes.filter(e => !e.dead && !e.removed);
  let want = E.face;
  if (E.phase === 'beset') {
    // cower from the nearest of them
    let near = null, nd = Infinity;
    for (const e of live) { const ed = Math.hypot(e.pos.x - E.x, e.pos.z - E.z); if (ed < nd) { nd = ed; near = e; } }
    if (near) want = Math.atan2(near.pos.x - E.x, near.pos.z - E.z);
    if (!E.called && d < 55 && !UI.dlg) { E.called = true; bark(E.name, pick(EVENT_LINES.help)); }
    if (!live.length) {
      E.phase = 'saved'; E.t = 0;
      E.actor.once('Cheer', { fade: 0.35, onEnd: () => { if (EVENTS.cur === E) E.actor.loop('Idle', { fade: 0.4 }); } });
      const xp = 20 + G.lvl * 6;
      gainXp(xp);
      G.flags.helped = (G.flags.helped || 0) + 1;
      bark(E.name, pick(EVENT_LINES.thanks));
      toast('Traveller saved  ·  +' + xp + ' xp', 'good');
      BUS.emit('sfx', { id: 'discover' });
    } else if (d > 230 && !live.some(e => e.aggro && e.dist() < 60)) { endRoadEvent(E); return; }   // you rode on
  } else {
    if (d < 12) want = Math.atan2(p.x - E.x, p.z - E.z);
    // they head on once you've gone, or a while after, when you're not looking
    if (!E.busy && !UI.dlg && (d > 110 || (E.t > 120 && d > 25 && behindCamera(E.pos)))) { endRoadEvent(E); return; }
  }
  E.face = dampAngle(E.face, want, 5, dt);
  E.actor.root.rotation.y = E.face;
  E.acc += dt;
  if (d > 60 && E.acc < 0.2) return;
  E.actor.update(E.acc); E.acc = 0;
}

function updateEvents(dt) {
  if (!G) return;
  const E = EVENTS.cur;
  if (E) { if (GAME.inCave) endRoadEvent(E); else updateRoadEvent(E, dt); return; }
  if (GAME.inCave || !eventsOpen() || UI.dlg || PL.state === 'talk' || PL.state === 'dead') return;
  if (ENT.enemies.some(e => e.aggro && !e.dead)) return;
  EVENTS.t -= dt;
  if (EVENTS.t > 0) return;
  EVENTS.t = 25;                                 // nowhere fit just now: look again shortly
  const s = eventSpot();
  if (s) startRoadEvent(s);
}
// for the compass: someone in trouble, not too far off
function eventMarker() {
  const E = EVENTS.cur;
  if (!E || E.phase !== 'beset') return null;
  return Math.hypot(PL.body.pos.x - E.x, PL.body.pos.z - E.z) < 260 ? { x: E.x, z: E.z } : null;
}
