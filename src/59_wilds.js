/* ═══════════════════════════════════════════════════════════════════════
   THE WILDS & THE ERRANDS — growing stronger off the story's road.

   Bears in the woods north and west of Buena (heavy, slow to flinch, a
   swipe and a mauling lunge), and the Ashback: the old grey bear the
   hunters won't name twice. Four errands for people who'll pay in what
   they have, every one of them something that stays with you:
     The Lost Flock      Farmer Gerard's three sheep, strayed in the hills   (+8 max health)
     Moonpetals          Lilia's night-blooming flowers, five of them        (draughts; one fresh each day after)
     The Ashback         Hunter Gerd's grudge, up under the northern cliffs  (+15 max health, a purse)
     Hilde's Caravan     the wreck on the trade road north of Roa            (a bandolier, a purse, a friend's price)
   ═══════════════════════════════════════════════════════════════════════ */
const WILDS = { sheep: [], pen: [], petals: [], built: false };

/* ───────────── bears ───────────── */
ENEMY_DEFS.bear = {
  name: 'Forest Bear', rig: 'wolf', bear: true, tint: '#5a4030', hp: 170, poise: 70, r: 0.78, h: 1.35, walk: 1.5, run: 7.0, sight: 16, hear: 10,
  xp: 48, weight: 2.2, flinchAt: 22, knockRes: 0.6,
  attacks: [
    { name: 'swipe', range: [0, 2.6], windup: 0.55, active: 0.18, recover: 0.7, reach: 2.4, arc: 1.0, dmg: 22, poise: 34, lunge: 2.5 },
    { name: 'maul',  range: [1.8, 5.5], windup: 0.95, active: 0.35, recover: 1.25, reach: 2.2, arc: 1.1, dmg: 32, poise: 60, leap: 7 },
  ],
};
ENEMY_DEFS.ashback = {
  ...ENEMY_DEFS.bear, name: 'Ashback', tint: '#4a4440', scale: 1.4, r: 1.05, h: 1.85, hp: 560, poise: 150, xp: 240, weight: 3, flinchAt: 45, knockRes: 0.8, boss: true, sight: 22,
  attacks: [
    { name: 'swipe', range: [0, 3.4], windup: 0.5, active: 0.2, recover: 0.6, reach: 3.2, arc: 1.15, dmg: 28, poise: 44, lunge: 3 },
    { name: 'maul',  range: [2.2, 8], windup: 0.85, active: 0.4, recover: 1.1, reach: 2.9, arc: 1.2, dmg: 40, poise: 80, leap: 11, unblockable: true },
  ],
  phase2: { at: 0.4, speedMul: 1.25, attacks: [{ name: 'swipe', range: [0, 3.4], windup: 0.36, active: 0.2, recover: 0.45, reach: 3.2, arc: 1.25, dmg: 24, poise: 40, lunge: 4 }] },
};
BOUNTY_CARDS.ashback = ['The Ashback', 'Grey as cinders, older than the village'];

// a bear: a round heavy barrel of a body, a hump at the shoulders, a broad head with round ears
function buildBearRig(scale, tint, mat, eyeM, ball, box) {
  const dark = tint, light = '#' + new THREE.Color(tint).lerp(new THREE.Color('#a08a6a'), 0.4).getHexString(), deep = '#' + new THREE.Color(tint).multiplyScalar(0.6).getHexString(), nose = '#1a1410';
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.set(0, 0.74, 0); root.add(body);
  body.add(mergedPart([[ball, dark, 0, 0, -0.08, 0.42, 0.42, 0.68], [ball, dark, 0, 0.12, 0.3, 0.44, 0.46, 0.4], [ball, deep, 0, 0.3, 0.18, 0.3, 0.2, 0.3],
    [ball, light, 0, -0.2, 0.05, 0.3, 0.2, 0.5]], mat));
  const neck = new THREE.Group(); neck.position.set(0, 0.12, 0.62); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.02, 0.12); neck.add(head);
  const hp = [[ball, dark, 0, 0, 0.02, 0.24, 0.22, 0.24], [ball, light, 0, -0.06, 0.24, 0.12, 0.1, 0.14], [ball, nose, 0, -0.02, 0.36, 0.05, 0.04, 0.04]];
  const eyes = [];
  for (const s of [-1, 1]) {
    hp.push([ball, dark, s * 0.17, 0.2, -0.04, 0.07, 0.07, 0.04], [ball, light, s * 0.17, 0.2, -0.015, 0.04, 0.04, 0.02]);
    eyes.push([ball, '#ffffff', s * 0.11, 0.07, 0.19, 0.022, 0.02, 0.018]);
  }
  head.add(mergedPart(hp, mat));
  head.add(mergedPart(eyes, eyeM));
  const jaw = new THREE.Group(); jaw.position.set(0, -0.14, 0.14); head.add(jaw);
  jaw.add(mergedPart([[box, light, 0, -0.01, 0.08, 0.12, 0.05, 0.16]], mat));
  const tail = [new THREE.Group()]; tail[0].position.set(0, 0.12, -0.74); body.add(tail[0]);
  tail[0].add(mergedPart([[ball, dark, 0, 0, -0.03, 0.06, 0.06, 0.06]], mat));
  const legs = [];
  for (const [x, z, front] of [[-0.24, 0.42, 1], [0.24, 0.42, 1], [-0.25, -0.44, 0], [0.25, -0.44, 0]]) {
    const hip = new THREE.Group(); hip.position.set(x, -0.16, z); body.add(hip);
    hip.add(mergedPart([[ball, dark, 0, -0.12, 0, 0.15, 0.22, 0.16]], mat));
    const knee = new THREE.Group(); knee.position.set(0, -0.3, 0); hip.add(knee);
    knee.add(mergedPart([[ball, dark, 0, -0.12, 0, 0.11, 0.17, 0.12], [ball, deep, 0, -0.26, 0.04, 0.12, 0.05, 0.15]], mat));
    legs.push({ hip, knee, front, side: Math.sign(x) });
  }
  root.scale.setScalar(scale);
  return { root, body, neck, head, jaw, tail, legs, phase: Math.random() * 10, crouch: 0, bite: 0, deadT: -1, eyeM, baseY: 0.74, scale,
    update: quadRigUpdate, weaponPos: quadRigWeaponPos };
}

/* ───────────── places ───────────── */
const WILD_SPOTS = {
  bearsNorth: { x: 700, z: -330 }, bearsWest: { x: -620, z: -150 }, ashback: { x: 320, z: -450 },
  sheep: [{ x: -640, z: 120, hint: 'up the north-west meadows' }, { x: -180, z: 680, hint: 'south, past the Tutor\'s Hill' }, { x: 20, z: 300, hint: 'east, over the ridge' }],
  pen: { x: -404, z: 336 },
  petals: [{ x: -300, z: 250 }, { x: -520, z: 470 }, { x: -150, z: 380 }, { x: -640, z: 330 }, { x: -350, z: 610 }],
  hunter: { x: -20, z: 330 }, wreck: { x: 1660, z: 180 },
};
function wildSpot(s) { return (typeof findCacheSpot === 'function' && findCacheSpot(s)) || { x: s.x, z: s.z }; }

/* ───────────── sheep ───────────── */
function buildSheep() {
  const mat = WILDS.mat || (WILDS.mat = toonMat({ vertexColors: true, rim: true }));
  const ball = new THREE.IcosahedronGeometry(1, 1), wool = '#efe9dc', woolD = '#d9d0bd', face = '#2a2420';
  const root = new THREE.Group(), body = new THREE.Group(); body.position.y = 0.55; root.add(body);
  const bp = [[ball, wool, 0, 0, 0, 0.36, 0.3, 0.48]];
  for (const [x, y, z] of [[0.2, 0.12, 0.2], [-0.2, 0.12, 0.2], [0.18, 0.14, -0.2], [-0.18, 0.14, -0.2], [0, 0.22, 0], [0, 0.18, 0.32], [0, 0.16, -0.36]]) bp.push([ball, woolD, x, y, z, 0.16, 0.14, 0.16]);
  for (const [x, z] of [[-0.16, 0.26], [0.16, 0.26], [-0.16, -0.26], [0.16, -0.26]]) bp.push([ball, face, x, -0.36, z, 0.05, 0.2, 0.05]);
  body.add(mergedPart(bp, mat));
  const head = new THREE.Group(); head.position.set(0, 0.1, 0.48); body.add(head);
  head.add(mergedPart([[ball, face, 0, 0, 0.06, 0.12, 0.13, 0.17], [ball, wool, 0, 0.1, 0.0, 0.13, 0.08, 0.12], [ball, face, 0.13, 0.03, 0.0, 0.08, 0.03, 0.04, 0, 0, -0.4], [ball, face, -0.13, 0.03, 0.0, 0.08, 0.03, 0.04, 0, 0, 0.4]], mat));
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, head, t: Math.random() * 10 };
}
function sheepFound() { return (G.flags.flockGot || []).length; }

/* ───────────── moonpetals ───────────── */
function buildPetal() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.5, 4), toonMat({ color: '#3e6a32' }));
  stem.position.y = 0.25; g.add(stem);
  const bloom = new THREE.Group(); bloom.position.y = 0.52; g.add(bloom);
  const pm = WILDS.petalMat || (WILDS.petalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#bfe4ff').multiplyScalar(1.6), side: THREE.DoubleSide }));
  const pg = new THREE.ConeGeometry(0.07, 0.22, 4, 1, true); pg.translate(0, 0.11, 0);
  for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(pg, pm); p.rotation.set(0.9, i / 6 * TAU, 0, 'YXZ'); bloom.add(p); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color('#9fd4ff'), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(1.3); bloom.add(halo);
  return { root: g, bloom, halo };
}
const moonOpen = () => SKY_NOW.night > 0.5;

/* ───────────── the people who ask ───────────── */
const ERRAND_LINES = {
  gerardAsk: [{ s: 'Farmer Gerard', t: 'Young master! You\'ve a mage\'s eyes — have you seen my sheep? Three of them broke the fold in the storm. The wolves will have them by the week\'s end.' },
    { s: 'Farmer Gerard', t: 'One went up the north-west meadows, one south past the Tutor\'s Hill, and the daft one east over the ridge. Find them and they\'ll follow the bell home.' }],
  gerardWait: n => [{ s: 'Farmer Gerard', t: `${n} of three home. The others are still out there — north-west, south past the hill, east over the ridge.` }],
  gerardDone: [{ s: 'Farmer Gerard', t: 'All three! You\'ve saved my winter, young master. Here — not much, but it\'s honest silver. And Marthe will send round a stew that\'ll put iron in your bones.' }],
  liliaAsk: [{ s: 'Lilia', t: 'Young master. Since you\'re out at all hours: there\'s a flower in the meadows round the village, a moonpetal. It only opens at night.' },
    { s: 'Lilia', t: 'Five of them, and I can brew a draught that closes wounds faster than any priest. Bring them to me and I\'ll keep you in it.' }],
  liliaWait: n => [{ s: 'Lilia', t: `${n} of five. They glow when they open, after dark, in the meadows round the village.` }],
  liliaDone: [{ s: 'Lilia', t: 'Five. Thank you. Here are the first two. Come by of a morning and there\'ll be a fresh one waiting — one a day, mind. I\'m a maid, not an apothecary.' }],
  liliaBrew: [{ s: 'Lilia', t: 'Your draught, young master. Fresh this morning.' }],
  liliaNone: [{ s: 'Lilia', t: 'Today\'s draught is already in your pack. Tomorrow, young master.' }],
  liliaFull: [{ s: 'Lilia', t: 'Your flasks are full. I\'ll keep today\'s for you.' }],
  gerdAsk: [{ s: 'Hunter Gerd', t: 'Mage. You\'re the one who cleared the forest of wolves? Then hear me. There\'s a bear up under the northern cliffs, grey as ash, older than your village.' },
    { s: 'Hunter Gerd', t: 'The Ashback. Took my brother\'s arm, and two of my dogs. Kill it and I\'ll make you a cloak from its hide — and I\'ve silver put by.' }],
  gerdWait: [{ s: 'Hunter Gerd', t: 'Under the northern cliffs, east of the falls. It won\'t run. Bring fire, or bring a lot of friends.' }],
  gerdDone: [{ s: 'Hunter Gerd', t: 'You did it. Gods. Here — the hide\'s still warm, I cut it while you rested. It\'ll turn a claw. And the silver, as promised.' }],
  gerdAfter: [{ s: 'Hunter Gerd', t: 'The woods breathe easier. So do I.' }],
  hildeAsk: [{ s: 'Merchant Hilde', t: 'You\'re good with a fight, I hear. My last caravan never came in. They found the wagon north of the walls, off the trade road. Brigands, sitting on it like crows.' },
    { s: 'Merchant Hilde', t: 'There was a strongbox. If you can bring it back I\'ll pay you, and you\'ll have a friend\'s price at my stall from then on.' }],
  hildeDone: [{ s: 'Merchant Hilde', t: 'My strongbox! Unopened, too — you\'re either very honest or very bad with locks. Here. And from now on, a friend\'s price. Don\'t tell the fruit seller.' }],
};
const hildePrice = p => G && G.flags.caravan === 'done' ? Math.round(p * 0.8) : p;

async function talkGerard(n) {
  const f = G.flags;
  if (!f.flock) { await npcSay(n, ERRAND_LINES.gerardAsk); f.flock = 'asked'; f.flockGot = f.flockGot || []; toast('The Lost Flock', 'big'); resetWilds(); return; }
  if (f.flock === 'asked' && sheepFound() < 3) return npcSay(n, ERRAND_LINES.gerardWait(sheepFound()));
  if (f.flock === 'asked') {
    await npcSay(n, ERRAND_LINES.gerardDone);
    f.flock = 'done'; gainXp(120); gainCoin(60); G.maxHp += 8; G.hp = G.maxHp;
    toast('Max health +8', 'good'); BUS.emit('sfx', { id: 'levelUp' }); autosave(); return;
  }
  return npcSay(n, [{ s: 'Farmer Gerard', t: 'Three fat sheep and not a wolf in sight. Bless you, young master.' }]);
}
async function talkLilia(n) {
  const f = G.flags;
  if (!f.moon) { await npcSay(n, ERRAND_LINES.liliaAsk); f.moon = 'asked'; f.moonGot = f.moonGot || []; toast('Moonpetals', 'big'); return; }
  const got = (f.moonGot || []).length;
  if (f.moon === 'asked' && got < 5) return npcSay(n, ERRAND_LINES.liliaWait(got));
  if (f.moon === 'asked') {
    await npcSay(n, ERRAND_LINES.liliaDone);
    f.moon = 'done'; f.brewDay = f.day || 0; gainXp(100);
    G.draughts = Math.min(draughtCap(), (G.draughts || 0) + 2); G.flags.toldDrink = true;
    toast('Healing draughts +2 · ' + IN.label('drink') + ' to drink', 'good'); autosave(); return;
  }
  // after: one fresh draught a day
  if (f.brewDay === (f.day || 0)) return npcSay(n, ERRAND_LINES.liliaNone);
  if ((G.draughts || 0) >= draughtCap()) return npcSay(n, ERRAND_LINES.liliaFull);
  await npcSay(n, ERRAND_LINES.liliaBrew);
  f.brewDay = f.day || 0; G.draughts = (G.draughts || 0) + 1; toast('Healing draught +1', 'good'); autosave();
}
async function talkGerd(n) {
  const f = G.flags;
  if (!f.ashback) { await npcSay(n, ERRAND_LINES.gerdAsk); f.ashback = 'asked'; f.sq_ashback = true; toast('The Ashback', 'big'); return; }
  if (f.ashback === 'asked') return npcSay(n, ERRAND_LINES.gerdWait);
  if (f.ashback === 'killed') {
    await npcSay(n, ERRAND_LINES.gerdDone);
    f.ashback = 'done'; gainCoin(120); G.maxHp += 15; G.hp = G.maxHp;
    toast('Bear-hide cloak · Max health +15', 'good'); BUS.emit('sfx', { id: 'levelUp' }); autosave(); return;
  }
  return npcSay(n, ERRAND_LINES.gerdAfter);
}
// Hilde: the caravan, offered the second time you visit, settled before her wares
async function hildeErrand(n) {
  const f = G.flags;
  if (f.metHilde && !f.caravan) { await npcSay(n, ERRAND_LINES.hildeAsk); f.caravan = 'asked'; f.sq_caravan = true; toast('Hilde\'s Caravan', 'big'); return true; }
  if (f.caravan === 'found') {
    await npcSay(n, ERRAND_LINES.hildeDone);
    f.caravan = 'done'; gainXp(140);
    if (!gear().bandolier) { gear().bandolier = 1; toast('Draught bandolier · carry 5', 'good'); gainCoin(80); } else gainCoin(200);
    autosave(); return true;
  }
  return false;
}

function buildWilds() {
  const S = WILD_SPOTS;
  // bears, and the Ashback (only once Gerd has asked)
  defineEncounter('bearsNorth', S.bearsNorth.x, S.bearsNorth.z, [['bear', 0, 0], ['bear', 7, 5]]);
  defineEncounter('bearsWest', S.bearsWest.x, S.bearsWest.z, [['bear', 0, 0]]);
  defineEncounter('ashback', S.ashback.x, S.ashback.z, [['ashback', 0, 0, { face: 2.2 }], ['bear', 8, 6]],
    { flag: 'sq_ashback', boss: true, onClear: () => { if (G.flags.ashback === 'asked') G.flags.ashback = 'killed'; G.flags.ashbackDown = true; banner('Field Boss Felled', 'The Ashback'); } });
  defineEncounter('caravan', S.wreck.x, S.wreck.z, [['bandit', 4, 3], ['bandit', -5, 2], ['marksman', 2, -9]], { flag: 'sq_caravan' });
  JOURNAL_FOES.push(['ashbackDown', 'The Ashback']);
  defineScorpionNests();

  // the sheep, where they strayed (a few wolves have found the eastern one), and the fold by Gerard
  const pen = wildSpot(S.pen);
  S.sheep.forEach((s0, i) => {
    const s = wildSpot(s0), sh = buildSheep(), y = heightAt(s.x, s.z);
    sh.root.position.set(s.x, y, s.z); sh.root.rotation.y = i * 2.1; STRUCT.group.add(sh.root); thinGrassAround(s.x, s.z, 1.6);
    const home = buildSheep(), hx = pen.x + (i - 1) * 1.8, hz = pen.z + (i % 2) * 1.4;
    home.root.position.set(hx, heightAt(hx, hz), hz); home.root.rotation.y = 1 + i; home.root.visible = false; STRUCT.group.add(home.root);
    const S1 = { i, x: s.x, z: s.z, sh, home, pos: new THREE.Vector3(s.x, y, s.z), hint: s0.hint };
    WILDS.sheep.push(S1);
    INTERACTABLES.push({ pos: S1.pos, r: 2.4, label: () => 'Ring the bell: lead the sheep home',
      enabled: () => G.flags.flock === 'asked' && !(G.flags.flockGot || []).includes(i), action: () => leadSheep(S1) });
  });
  defineEncounter('sheepWolves', S.sheep[2].x + 14, S.sheep[2].z - 10, [['wolf', 0, 0], ['wolf', 4, 3]], { flag: 'flockWolves' });

  // moonpetals, closed by day
  S.petals.forEach((p0, i) => {
    const p = wildSpot(p0), pe = buildPetal(), y = heightAt(p.x, p.z);
    pe.root.position.set(p.x, y, p.z); STRUCT.group.add(pe.root);
    const P = { i, x: p.x, z: p.z, pe, pos: new THREE.Vector3(p.x, y, p.z) };
    WILDS.petals.push(P);
    INTERACTABLES.push({ pos: P.pos, r: 2, label: () => 'Pick the moonpetal',
      enabled: () => G.flags.moon === 'asked' && moonOpen() && !(G.flags.moonGot || []).includes(i), action: () => pickPetal(P) });
  });

  // Hunter Gerd's camp at the forest's edge
  const h = wildSpot(S.hunter);
  thinGrassAround(h.x, h.z, 5);
  campfire(h.x + 3, h.z + 2);
  placeProp('tent', h.x - 3, h.z - 3, { s: 7, rot: 0.8 });
  placeProp('weaponrack', h.x + 4, h.z - 4, { s: 5, rot: -0.6 });
  new NPC('gerd', { base: 'Barbarian', recolor: { barbarian: { 1: '#5a4a3a', 6: '#4a5a32' } }, hide: ['Barbarian_Hat'] }, h.x + 1.5, h.z + 4.5,
    { name: 'Hunter Gerd', face: 2.6, idle: 'Idle', talk: talkGerd });
  WILDS.hunter = h;

  // the wreck north of Roa, and Hilde's strongbox in it
  const w = wildSpot(S.wreck);
  thinGrassAround(w.x, w.z, 6);
  wreckedWagon(w.x, w.z, 0.7, true);
  for (const [n, dx, dz] of [['crate_A_big', 3.5, 2], ['barrel', -3, 2.5], ['sack', 1.5, -3.5], ['crate_B_big', -4, -2]]) placeProp(n, w.x + dx, w.z + dz, { s: 5, rot: (dx + dz) * 0.7 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.4), toonMat({ color: '#3a3836' }));
  const by = heightAt(w.x + 2.4, w.z - 1.2);
  box.position.set(w.x + 2.4, by + 0.19, w.z - 1.2); box.rotation.y = 0.4; box.castShadow = true; STRUCT.group.add(box);
  WILDS.strongbox = box; WILDS.wreck = w;
  INTERACTABLES.push({ pos: new THREE.Vector3(box.position.x, by, box.position.z), r: 2.2, label: () => 'Take Hilde\'s strongbox',
    enabled: () => G.flags.caravan === 'asked' && box.visible, action: () => takeStrongbox() });

  // the asking: Gerard, Lilia, Hilde
  if (NPCS.v0) NPCS.v0.talk = talkGerard;
  if (NPCS.lilia) NPCS.lilia.talk = talkLilia;
  if (NPCS.roa3) NPCS.roa3.talk = async n => { if (await hildeErrand(n)) openShop(); else await talkHilde(n); };
  WILDS.built = true;
}
function leadSheep(S1) {
  const got = G.flags.flockGot || (G.flags.flockGot = []);
  if (got.includes(S1.i)) return;
  got.push(S1.i);
  BUS.emit('sfx', { id: 'pickup', pos: S1.pos });
  toast('Sheep found (' + got.length + ' / 3)' + (got.length === 3 ? ' — back to Gerard' : ''), 'good');
  S1.leaving = true;                                     // home once you look away
  resetWilds();
}
function pickPetal(P) {
  const got = G.flags.moonGot || (G.flags.moonGot = []);
  if (got.includes(P.i)) return;
  got.push(P.i);
  setPlayerState('interact'); PL.actor.once('PickUp', { speed: 1.4 });
  BUS.emit('sfx', { id: 'pickup', pos: P.pos });
  toast('Moonpetal (' + got.length + ' / 5)' + (got.length === 5 ? ' — back to Lilia' : ''), 'good');
  P.pe.root.visible = false;
}
function takeStrongbox() {
  if (ENT.enemies.some(e => e.aggro && !e.dead && e.dist() < 25)) { hint('Not with brigands breathing down your neck.', 2.5); return; }
  G.flags.caravan = 'found';
  WILDS.strongbox.visible = false;
  setPlayerState('interact'); PL.actor.once('PickUp', { speed: 1.4 });
  BUS.emit('sfx', { id: 'pickup' });
  toast('Hilde\'s strongbox — back to her stall in Roa', 'good');
}
// what the world shows follows the save (on load, new game)
function resetWilds() {
  if (!WILDS.built || !G) return;
  const flock = G.flags.flockGot || [];
  for (const S1 of WILDS.sheep) {
    const home = flock.includes(S1.i);
    if (!S1.leaving) S1.sh.root.visible = !home;
    S1.home.root.visible = home && !S1.leaving;
  }
  G.flags.flockWolves = G.flags.flock === 'asked' && !flock.includes(2);
  const moon = G.flags.moonGot || [];
  for (const P of WILDS.petals) P.pe.root.visible = !moon.includes(P.i);
  if (WILDS.strongbox) WILDS.strongbox.visible = G.flags.caravan !== 'found' && G.flags.caravan !== 'done';
}

let _wildPrevHour = -1;
function updateWilds(dt) {
  if (!WILDS.built || !G || GAME.inCave) return;
  // a new day when the clock runs past midnight (or a wait skips over it)
  if (_wildPrevHour >= 0 && TOD.hour < _wildPrevHour - 1) G.flags.day = (G.flags.day || 0) + 1;
  _wildPrevHour = TOD.hour;
  const p = PL.body.pos, t = GAME.time;
  for (const S1 of WILDS.sheep) {
    const r = S1.sh.root;
    if (S1.leaving && (Math.hypot(S1.x - p.x, S1.z - p.z) > 30 || behindCamera(S1.pos))) { S1.leaving = false; r.visible = false; S1.home.root.visible = true; }
    for (const sh of [S1.sh, S1.home]) if (sh.root.visible && Math.abs(sh.root.position.x - p.x) < 80 && Math.abs(sh.root.position.z - p.z) < 80) {
      sh.t += dt; sh.head.rotation.x = 0.5 + Math.sin(sh.t * 1.3) * 0.35;             // grazing
    }
  }
  // moonpetals open after dark: buds by day, a pale glow by night
  const open = moonOpen() ? 1 : 0;
  for (const P of WILDS.petals) {
    if (!P.pe.root.visible) continue;
    const k = P.open = damp(P.open || 0, open, 1.5, dt);
    P.pe.bloom.scale.setScalar(0.35 + 0.65 * k); P.pe.halo.material.opacity = 0.6 * k;
    if (k > 0.5 && Math.hypot(P.x - p.x, P.z - p.z) < 25) requestLight(P.pos, '#9fd4ff', 1.2 * k, 5);
  }
}
// the compass: what you've been asked to find, if it's near
function errandMarks() {
  if (!G || !WILDS.built) return [];
  const f = G.flags, out = [], p = PL.body.pos;
  const near = (x, z, r) => Math.hypot(x - p.x, z - p.z) < r;
  if (f.flock === 'asked') for (const S1 of WILDS.sheep) if (!(f.flockGot || []).includes(S1.i) && near(S1.x, S1.z, 220)) out.push(S1);
  if (f.moon === 'asked' && moonOpen()) for (const P of WILDS.petals) if (!(f.moonGot || []).includes(P.i) && near(P.x, P.z, 90)) out.push(P);
  if (f.ashback === 'asked' && near(WILD_SPOTS.ashback.x, WILD_SPOTS.ashback.z, 300)) out.push(WILD_SPOTS.ashback);
  if (f.caravan === 'asked' && WILDS.wreck && near(WILDS.wreck.x, WILDS.wreck.z, 300)) out.push(WILDS.wreck);
  return out;
}
function errandRows() {
  const f = G.flags, out = [];
  if (f.flock === 'asked') out.push(['The Lost Flock', sheepFound() < 3 ? 'Sheep found: ' + sheepFound() + ' / 3' : 'Back to Farmer Gerard in Buena']);
  if (f.flock === 'done') out.push(['The Lost Flock', 'Done']);
  if (f.moon === 'asked') out.push(['Moonpetals', (f.moonGot || []).length < 5 ? 'Picked: ' + (f.moonGot || []).length + ' / 5 (they open at night)' : 'Back to Lilia at the Greyrat house']);
  if (f.moon === 'done') out.push(['Moonpetals', 'Done — Lilia brews a draught each day']);
  if (f.ashback === 'asked') out.push(['The Ashback', 'Under the northern cliffs, east of the falls']);
  if (f.ashback === 'killed') out.push(['The Ashback', 'Back to Hunter Gerd at the forest\'s edge']);
  if (f.ashback === 'done') out.push(['The Ashback', 'Done']);
  if (f.caravan === 'asked') out.push(['Hilde\'s Caravan', 'The wreck north of Roa\'s walls, off the trade road']);
  if (f.caravan === 'found') out.push(['Hilde\'s Caravan', 'Back to Hilde by the plaza']);
  if (f.caravan === 'done') out.push(['Hilde\'s Caravan', 'Done — a friend\'s price at her stall']);
  return out;
}

/* ───────────── sand scorpions: the outskirts' gullies ───────────── */
ENEMY_DEFS.scorpion = {
  name: 'Sand Scorpion', rig: 'wolf', scorpion: true, tint: '#a8783e', scale: 1.35, hp: 96, poise: 55, r: 0.9, h: 1.0, walk: 2.0, run: 7.6, sight: 14, hear: 12,
  xp: 32, weight: 1.6, flinchAt: 16, knockRes: 0.5, pack: true,
  attacks: [
    { name: 'pinch', range: [0, 2.2], windup: 0.4, active: 0.15, recover: 0.5, reach: 2.0, arc: 0.9, dmg: 14, poise: 20, lunge: 2.5 },
    { name: 'sting', range: [1.2, 3.6], windup: 0.75, active: 0.2, recover: 0.8, reach: 3.2, arc: 0.6, dmg: 22, poise: 36, lunge: 3, unblockable: true },
  ],
};
// six legs, two pincers, a tail curled up over its back (the sting arcs forward when it's angry)
function buildScorpionRig(scale, tint, mat, eyeM, ball, box) {
  const shell = tint, dark = '#' + new THREE.Color(tint).multiplyScalar(0.55).getHexString(), pale = '#' + new THREE.Color(tint).lerp(new THREE.Color('#e8d8b0'), 0.4).getHexString();
  const root = new THREE.Group(), body = new THREE.Group(); body.position.set(0, 0.36, 0); root.add(body);
  body.add(mergedPart([[ball, shell, 0, 0, 0.16, 0.3, 0.13, 0.3], [ball, shell, 0, 0.01, -0.12, 0.27, 0.12, 0.2], [ball, dark, 0, 0.02, -0.34, 0.22, 0.11, 0.16],
    [ball, shell, 0, 0.02, -0.52, 0.17, 0.1, 0.13], [box, dark, 0, 0.11, 0.05, 0.32, 0.04, 0.5]], mat));
  const neck = new THREE.Group(); neck.position.set(0, 0.02, 0.4); body.add(neck);
  const head = new THREE.Group(); neck.add(head);
  const hp = [[ball, dark, 0, 0, 0, 0.13, 0.08, 0.1]], eyes = [];
  for (const s of [-1, 1]) {
    hp.push([box, shell, s * 0.2, 0, 0.12, 0.06, 0.06, 0.3, 0, s * 0.5, 0], [ball, shell, s * 0.3, 0, 0.3, 0.1, 0.07, 0.14]);
    eyes.push([ball, '#ffffff', s * 0.05, 0.06, 0.08, 0.02, 0.02, 0.02]);
  }
  head.add(mergedPart(hp, mat));
  head.add(mergedPart(eyes, eyeM));
  const jaw = new THREE.Group(); jaw.position.set(0, 0, 0.36); head.add(jaw);       // the pincers' moving fingers
  jaw.add(mergedPart([[box, pale, -0.3, 0, 0.06, 0.04, 0.04, 0.16, 0, 0.4, 0], [box, pale, 0.3, 0, 0.06, 0.04, 0.04, 0.16, 0, -0.4, 0]], mat));
  // the tail: five segments curling up and forward, the sting on the end
  const tp = [];
  // up from the rump, then forward over the back: the classic arch
  let ty = 0.04, tz = 0, a = 1.2;
  for (let k = 0; k < 5; k++) { a += 0.48; ty += Math.sin(a) * 0.16; tz -= Math.cos(a) * 0.16; tp.push([ball, k % 2 ? dark : shell, 0, ty, tz, 0.075 - k * 0.006, 0.075 - k * 0.006, 0.09, a - Math.PI / 2, 0, 0]); }
  tp.push([new THREE.ConeGeometry(0.045, 0.18, 6), '#2a1a10', 0, ty - 0.07, tz + 0.05, 1, 1, 1, 2.6, 0, 0]);
  const tail = [new THREE.Group()]; tail[0].position.set(0, 0.04, -0.62); body.add(tail[0]);
  tail[0].add(mergedPart(tp, mat));
  const legs = [];
  for (const [z, front] of [[0.18, 1], [0.0, 0], [-0.2, 1]]) for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.24, -0.02, z); body.add(hip);
    hip.add(mergedPart([[box, dark, s * 0.13, 0.04, 0, 0.26, 0.04, 0.05, 0, 0, s * 0.35]], mat));
    const knee = new THREE.Group(); knee.position.set(s * 0.25, 0.04, 0); hip.add(knee);
    knee.add(mergedPart([[box, dark, s * 0.135, -0.16, 0, 0.04, 0.42, 0.04, 0, 0, s * 0.7]], mat));
    legs.push({ hip, knee, front, side: s });
  }
  root.scale.setScalar(scale);
  return { root, body, neck, head, jaw, tail, legs, phase: Math.random() * 10, crouch: 0, bite: 0, deadT: -1, eyeM, baseY: 0.36, scale,
    update: quadRigUpdate, weaponPos: quadRigWeaponPos };
}
function defineScorpionNests() {
  defineEncounter('scorpionsWest', 1780, 110, [['scorpion', 0, 0], ['scorpion', 5, 4]]);
  defineEncounter('scorpionsSouth', 2040, 360, [['scorpion', 0, 0], ['scorpion', -5, 3], ['scorpion', 4, -5]]);
}
