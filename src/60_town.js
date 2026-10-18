/* ═══════════════════════════════════════════════════════════════════════
   ROA, A LITTLE MORE LIVED IN — the Red Hearth, where Marga rents rooms
   by the night and ladles stew by the bowl; and the street kid by the
   plaza who has been begging every mage in Roa for a BIG fireball.
   ═══════════════════════════════════════════════════════════════════════ */
const INN_WARES = [
  { id: 'roomMorning', name: 'A room till morning', price: 10, sold: () => false,
    desc: () => 'A bed upstairs and a door that locks. You wake at dawn, rested and whole. The roads outside are as busy as ever.', buy: () => innRest(7) },
  { id: 'roomEvening', name: 'A room till nightfall', price: 10, sold: () => false,
    desc: () => 'The same bed, the shutters drawn. You wake at dusk, rested and whole — the city lamps already lit.', buy: () => innRest(20) },
  { id: 'stew', name: 'Marga\'s stew', price: 6, sold: () => G.hp >= G.maxHp, soldTag: () => 'Not hungry',
    desc: () => 'A bowl of whatever\'s in the pot today. Closes your wounds. Doesn\'t ask how you got them.', buy: () => { const h = Math.round(G.maxHp - G.hp); G.hp = G.maxHp; if (h > 0) BUS.emit('healNumber', h); } },
];
// a night at the inn: the same rest a waystone gives (the world wakes up too), paid in silver
function innRest(h) {
  resumeGame();
  passTime(h);
}
const MARGA_LINES = ['Rooms upstairs, ale downstairs, and no brawling unless the Lady starts it.', 'You look like you\'ve been sleeping in ditches. Ten silver says you won\'t tonight.',
  'Stew\'s hot. It\'s always hot. I don\'t let it be anything else.'];
async function talkMarga(n) {
  await npcSay(n, [{ s: n.name, t: pick(MARGA_LINES) }]);
  openShop('marga');
}

// "Do a fireball! Do a BIG one!" — an incanted fire spell where he can see it, and he'll give you his treasure
BUS.on('cast', ({ spell, incanted }) => {
  const K = NPCS.roa5;
  if (!G || !K || !K.visible || G.flags.kidFire || spell.school !== 'fire' || !incanted) return;
  if (PL.body.pos.distanceTo(K.pos) > 22) return;
  G.flags.kidFire = true;
  G.maxMana += 6; G.mana = G.maxMana; autosave();             // yours at once; the telling takes a moment
  later(1.4, () => {
    bark('A Street Kid', 'WHOAAA! That was the BIGGEST! Here — my lucky stone. It glows sometimes. It\'s yours now.');
    later(2.6, () => { toast('The street kid\'s lucky stone · Max mana +6', 'good'); BUS.emit('sfx', { id: 'pickup' }); autosave(); });
  });
});
function buildTown() {
  buildTownErrands();
  if (NPCS.v1) NPCS.v1.talk = talkMaryl;
  if (NPCS.roa7) NPCS.roa7.talk = talkMarga;
  if (NPCS.roa5) NPCS.roa5.talk = n => npcSay(n, [{ s: n.name, t: G.flags.kidFire ? pick(['That fireball was the best thing that ever happened in Roa. EVER.', 'Teach me magic! Tomorrow? The day after?']) : 'Are you the mage? Do a fireball! Hold it and say the words — do a BIG one!' }]);
}

/* ───────────── Magister Wenna and the Quagmire ───────────── */
// A retired Guild mage by the Guild door. Show her earth and water both (Earth Wall,
// Icicle), fetch three lumps of river clay from the banks round Buena, and she
// teaches you Rudeus's own trick: the ground remembered as water.
const TOWN_ERRAND = { clay: [], built: false };
const WENNA_LINES = {
  notYet: 'Stone Cannon. Yes, yes — any brute can throw rocks. Come back when you can call a wall out of the earth and an icicle out of the air. Then I\'ll show you something worth knowing.',
  ask: ['Earth and water, both. Good. Now — what happens when you mix them? Mud. Don\'t laugh. Mud has drowned more armies than fire ever burned.',
    'Bring me three lumps of clay from the riverbanks round Buena. The good grey clay, not the sand. Then we\'ll talk.'],
  wait: n => `${n} of three. The river at Buena — grey clay, not sand. Mud is patient. Be more patient than mud.`,
  teach: ['Good clay. Now watch. You don\'t make the ground soft. You remind it that it was water once, and would like to be again.',
    'There. Quagmire. Sink them where they stand, and they\'ll never reach you. Every mage in Asura knows Stone Cannon. Almost none of them know this.'],
  after: ['Practice it. Mud and patience, tutor. Mud and patience.', 'Use it on the brigands. They hate it. Everyone hates it. That\'s the point.'],
};
function clayGot() { return (G.flags.clayGot || []).length; }
async function talkWenna(n) {
  const f = G.flags, ready = isLearned(SPELL.wall) && isLearned(SPELL.icicle);
  if (!f.mud && !ready) return npcSay(n, [{ s: n.name, t: WENNA_LINES.notYet }]);
  if (!f.mud) { await npcSay(n, WENNA_LINES.ask.map(t => ({ s: n.name, t }))); f.mud = 'asked'; f.clayGot = f.clayGot || []; toast('Mud and Patience', 'big'); resetTownErrands(); return; }
  if (f.mud === 'asked' && clayGot() < 3) return npcSay(n, [{ s: n.name, t: WENNA_LINES.wait(clayGot()) }]);
  if (f.mud === 'asked') {
    await npcSay(n, WENNA_LINES.teach.map(t => ({ s: n.name, t })));
    const before = learnedIds();
    f.mud = 'done'; f.spell_quagmire = true; gainXp(150);
    checkUnlocks(before); autosave(); return;
  }
  return npcSay(n, [{ s: n.name, t: pick(WENNA_LINES.after) }]);
}
function buildTownErrands() {
  // Wenna, beside the Guild door
  const gd = ROA.spots.guildDoor, P = ROA.spots.plaza, a = Math.atan2(P.x - gd.x, P.z - gd.z);
  const w = wildSpot({ x: gd.x + Math.sin(a) * 5 - Math.cos(a) * 5, z: gd.z + Math.cos(a) * 5 + Math.sin(a) * 5 });
  new NPC('wenna', { base: 'Mage', show: ['2H_Staff'], recolor: { mage: { 1: '#cfc8bc', 8: '#4a3a52', 9: '#3a2c42', 10: '#5a4632' } } }, w.x, w.z,
    { name: 'Magister Wenna', face: a + Math.PI, idle: 'Idle', talk: talkWenna });
  // three lumps of river clay on the banks round Buena
  const R = TER.riverPath, hw = RIVER_WIDTH / 2 + 3;
  const geo = new THREE.IcosahedronGeometry(0.32, 1), mat = toonMat({ color: '#8c8478' });
  [0.42, 0.62, 0.82].forEach((t, i) => {
    const k = Math.floor(R.length * t), p = R[k], q = R[Math.min(k + 1, R.length - 1)], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
    const s = wildSpot({ x: p[0] - dz / l * hw, z: p[1] + dx / l * hw }), y = heightAt(s.x, s.z);
    const m = new THREE.Mesh(geo, mat); m.scale.set(1.3, 0.55, 1); m.position.set(s.x, y + 0.08, s.z); m.castShadow = m.receiveShadow = true;
    STRUCT.group.add(m);
    const C = { i, x: s.x, z: s.z, m, pos: new THREE.Vector3(s.x, y, s.z) };
    TOWN_ERRAND.clay.push(C);
    INTERACTABLES.push({ pos: C.pos, r: 2.2, label: () => 'Dig out the river clay',
      enabled: () => G.flags.mud === 'asked' && !(G.flags.clayGot || []).includes(i), action: () => takeClay(C) });
  });
  if (NPCS.wenna) TOWN_ERRAND.built = true;
}
function takeClay(C) {
  const got = G.flags.clayGot || (G.flags.clayGot = []);
  if (got.includes(C.i)) return;
  got.push(C.i); C.m.visible = false;
  setPlayerState('interact'); PL.actor.once('PickUp', { speed: 1.4 });
  BUS.emit('sfx', { id: 'pickup', pos: C.pos });
  toast('River clay (' + got.length + ' / 3)' + (got.length === 3 ? ' — back to Magister Wenna in Roa' : ''), 'good');
}
function resetTownErrands() {
  if (!TOWN_ERRAND.built || !G) return;
  const got = G.flags.clayGot || [];
  for (const C of TOWN_ERRAND.clay) C.m.visible = !got.includes(C.i);
}
function townMarks() {
  if (!G || G.flags.mud !== 'asked') return [];
  const p = PL.body.pos, got = G.flags.clayGot || [];
  return TOWN_ERRAND.clay.filter(C => !got.includes(C.i) && Math.hypot(C.x - p.x, C.z - p.z) < 200);
}
function townRows() {
  const f = G.flags, out = [];
  if (f.mud === 'asked') out.push(['Mud and Patience', clayGot() < 3 ? 'River clay: ' + clayGot() + ' / 3 (the banks round Buena)' : 'Back to Magister Wenna by the Guild']);
  if (f.mud === 'done') out.push(['Mud and Patience', 'Done — Quagmire learned']);
  return out;
}

/* ───────────── Old Maryl's pantry, by Buena's mill ───────────── */
// Draughts before Roa (dearer than Hilde's — it's a long way to carry them) and honey cakes
const MARYL_WARES = [
  { id: 'mDraught', name: 'Healing Draught', price: 36, desc: () => `Lilia's recipe, or near enough. Drink it (${IN.label('drink')}) and nearly half your wounds close in a breath. Dearer than in Roa: it's a long way to carry them.`,
    sold: () => (G.draughts || 0) >= draughtCap(), soldTag: () => 'Flasks full', have: () => (G.draughts || 0) + ' / ' + draughtCap(), buy: () => { G.draughts = (G.draughts || 0) + 1; } },
  { id: 'cakes', name: 'Honey Cakes', price: 8, sold: () => G.hp >= G.maxHp, soldTag: () => 'Not hungry',
    desc: () => 'Still warm. You eat three before you notice. Closes your wounds.', buy: () => { const h = Math.round(G.maxHp - G.hp); G.hp = G.maxHp; if (h > 0) BUS.emit('healNumber', h); } },
];
VENDORS.maryl = { title: 'Maryl\'s Pantry', wares: () => MARYL_WARES, price: p => p };
async function talkMaryl(n) {
  await npcSay(n, [{ s: n.name, t: pick(['Harvest\'s early this year. The mill can barely keep up — but I\'ve cakes, and a few draughts for the road.', 'Off adventuring again? Take something warm with you.', 'Silver for cakes, silver for draughts. Kindness I give away free.']) }]);
  openShop('maryl');
}
