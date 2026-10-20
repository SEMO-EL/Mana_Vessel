/* ═══════════════════════════════════════════════════════════════════════
   CHAPTER II — THE BOREAS GIRL (Milestone 2)

   The gate out of Buena opens; the road runs through the pass to Roa.
   Eris (who punches), Ghislaine (who teaches the sword the hard way), the
   Adventurer Guild (Rank F, everyone starts there), the brigands of
   Wagonbreak Camp, the First Golem in its sunken ring — and a birthday at
   the Boreas estate that ends with a light in the eastern sky.
   ═══════════════════════════════════════════════════════════════════════ */
const SCRIPT2 = {
  gate1: [
    { t: 'You knock. For a long moment, nothing. Then boots on stone, and a voice through the timbers.' },
    { s: 'Gate Sergeant', t: 'Who goes there? ...Greyrat? The tutor from Buena? Lord Sauros said you would come. He said it loudly. He says everything loudly.' },
    { s: 'Gate Sergeant', t: 'Lift the bar! Mind the young master — he is a mage, and apparently a good one.' },
  ],
  eris1: [
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'You\'re the tutor?! You\'re SHORTER than me!' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: '...Fine. FINE. But if you bore me I\'ll punch you, and Ghislaine says my punches are coming along nicely.' },
  ],
  eris2: [
    { t: 'She punches you. Ghislaine was right.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'That one was for being short. Ghislaine is in the yard by the keep. Go on — if SHE likes you, maybe I will.' },
    { t: 'She will punch you again. She will also, eventually, be the reason you survive.' },
  ],
  ghis1: [
    { p: 'ghislaine', s: 'Ghislaine Dedoldia', t: 'Magic is fine. Magic is not enough. Something will one day get inside your incantation range, and on that day you will want a sword.' },
    { p: 'ghislaine', s: 'Ghislaine Dedoldia', t: 'Show me what Paul taught you. I will not go easy. Paul goes easy. Paul is an idiot.' },
    { p: 'ghislaine', s: 'Ghislaine Dedoldia', t: 'My guard is closed. Make me open it — then be somewhere else when I swing.' },
  ],
  ghis2: [
    { p: 'ghislaine', s: 'Ghislaine Dedoldia', t: 'Hm. Not bad. Watch the shoulders, not the blade. The blade only tells you where it has already been.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'I\'m coming with you. To the Guild. Grandfather said no. I\'m still coming.' },
    { p: 'ghislaine', s: 'Ghislaine Dedoldia', t: 'Take her. Bring her back with all her fingers. The Adventurer Guild faces the plaza — they will have work for a Rank F.' },
  ],
  ghisWin: [
    { p: 'ghislaine', s: 'Ghislaine Dedoldia', t: 'Dead. Twice, if I had wanted. You stood still when my shoulders moved.' },
    { p: 'ghislaine', s: 'Ghislaine Dedoldia', t: 'Again, when you can breathe.' },
  ],
  guild1: [
    { p: 'guild', s: 'Guild Clerk', t: 'Registration, is it? Rank F. Everyone starts at F, including the ones who end at S.' },
    { p: 'guild', s: 'Guild Clerk', t: 'Rank rises with deeds, not with coin. Try not to die on a Rank F job — it\'s embarrassing for both of us.' },
    { p: 'guild', s: 'Guild Clerk', t: 'Here. Brigands have dug in at the old wagon stop on the trade road, north-east of the city. Merchants won\'t use the road. Clear them out.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'FINALLY. Something to hit.' },
  ],
  campDone: [
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'Ha! Did you SEE that? ...What? Why are you looking at the hills like that?' },
    { t: 'The brigands didn\'t dig in here to rob the road. They dug in because something north of here made them stop running.' },
    { t: 'Beyond the camp, old stones ring a hollow in the ground. The air over it hums.' },
  ],
  golemDone: [
    { t: 'The golem comes apart the way it came together — slowly, and then all at once.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: '...I wasn\'t scared. You were scared. Let\'s go home, it\'s — oh! It\'s my BIRTHDAY. Don\'t you dare have forgotten.' },
  ],
  birthday1: [
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'You came. Good. Not that I was waiting.' },
    { s: 'Sauros Boreas Greyrat', t: 'TUTOR! You brought her back with every finger! Eat! Drink! It\'s her tenth birthday and the cook has made enough for forty!' },
    { p: 'ghislaine', s: 'Ghislaine Dedoldia', t: 'She fought well. So did you. Do not let it go to your head.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'What\'s that? For me? ...It\'s a figurine. Of me. With a sword.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: '...I\'ll keep it. Don\'t look at me.' },
  ],
  birthday2: [
    { t: 'Later, on the terrace. The night is warm, the lamps are low, and the city has gone quiet below.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: '{name}. Look at the sky. Over the east. Is that... supposed to be there?' },
    { t: 'A light hangs over the horizon — too bright, too still, the colour of nothing you have a name for.' },
    { t: 'Then it opens.' },
  ],
};

/* quest steps: the chapter continues where 'road' ends */
QUEST.splice(QUEST.findIndex(q => q.id === 'done'), 1,
  { id: 'toRoa',     title: 'The Boreas Girl', text: 'Follow the road through the pass to the city of Roa.', at: () => ({ x: 1448, z: 385 }) },
  { id: 'findEris',  title: 'The Boreas Girl', text: 'Find Eris at the Boreas estate, north of the plaza.', at: () => NPCS.eris && NPCS.eris.pos },
  { id: 'ghislaine', title: 'The Sword Saint', text: 'Ghislaine is in the training yard beside the keep.', at: () => NPCS.ghislaine && NPCS.ghislaine.pos },
  { id: 'guild',     title: 'Rank F',          text: 'Register at the Adventurer Guild, facing the plaza.', at: () => NPCS.clerk && NPCS.clerk.pos },
  { id: 'bandits',   title: 'Rank F',          text: 'Clear the brigands from Wagonbreak Camp, on the trade road north-east of Roa.', at: () => ({ x: WAGON_CAMP.x, z: WAGON_CAMP.z }) },
  { id: 'firstWall', title: 'Something Older', text: 'Find what the brigands were running from, in the ruins north of the camp.', at: () => ({ x: FIRST_WALL.x, z: FIRST_WALL.z }) },
  { id: 'birthday',  title: 'The Boreas Girl', text: 'Return to the Boreas estate. Tonight is Eris\'s birthday.', at: () => ROA.spots.forecourt },
  { id: 'done',      title: 'The Displaced',   text: 'Explore Fittoa while you still can. Chapter III comes next.', at: null },
);
// a step reached out of order (a camp already cleared, a golem already felled) moves straight on
BUS.on('quest', id => {
  if (id === 'bandits' && G.flags.wagons) later(1.6, () => { if (G.quest === 'bandits') setQuest('firstWall'); });
  if (id === 'firstWall' && G.flags.firstWall) later(1.6, () => { if (G.quest === 'firstWall') setQuest('birthday'); });
});

/* ───────────── the people of Roa ───────────── */
const ROA_FOLK = [
  ['Knight', { knight: { 1: '#5a4632' } }, 1458, 377, 'Idle', 'Guard Bastian', 'Welcome to Roa. Keep your spells holstered inside the walls — the last mage set the fish market on fire.', ['Knight_Helmet'], -Math.PI / 2],
  ['Knight', { knight: { 1: '#2c2420' } }, 1662, 393, 'Idle', 'Guard Ulla', 'The trade road\'s not safe past the farms. Brigands, jackals... and worse, they say. Something in the old ring.', ['Knight_Helmet'], Math.PI / 2],
  ['Rogue', { rogue: { 1: '#c8a060', 8: '#7a5a3a', 21: '#7a5a3a' } }, 1576, 404, 'Interact', 'Fruit Seller', 'Apples from the orchard by the west road! Lady Eris kicked a whole cart of them once. Best day of my life.'],
  ['Barbarian', { barbarian: { 1: '#7a6a5a', 6: '#5a6a3a' } }, 1543, 372, 'Use_Item', 'Merchant Hilde', 'The trade road\'s choked with brigands. Nobody\'s sold a bolt of cloth north of the camp in a month.', ['Barbarian_Hat']],
  ['Mage', { mage: { 1: '#9a9a9a', 8: '#3e4a5e', 9: '#2e3646' } }, 1586, 372, 'Idle', 'Old Tomas, Scribe', 'The First Wall? Older than the city, older than House Boreas. They say it walks, some nights. They say a lot of things.'],
  ['Rogue', { rogue: { 1: '#3a2418', 8: '#6a7a4a', 21: '#6a7a4a' } }, 1526, 396, 'Idle', 'A Street Kid', 'Are you the mage? Do a fireball! Do a BIG one!'],
  ['Knight', { knight: { 1: '#a37a3c' } }, 1572, 338, 'Idle', 'Squire Alec', 'Lady Eris broke three tutors this year. Do try to be the one she doesn\'t break.', ['Knight_Helmet']],
  ['Barbarian', { barbarian: { 1: '#4a3020' } }, 1612, 444, 'Idle', 'Innkeeper Marga', 'Rooms upstairs, ale downstairs, and no brawling unless the Lady starts it.', ['Barbarian_Hat']],
  ['Mage', { mage: { 1: '#e8e0d0', 8: '#d8d0c0', 9: '#bfb6a6' } }, 1488, 446, 'Idle', 'Father Odran', 'The Milis teachings say the gods watch over Roa. Lately the gods seem to be watching something else.'],
  ['Barbarian', { barbarian: { 1: '#6a5034', 6: '#6a5a3a' } }, 1520, 596, 'PickUp', 'Farmer Joss', 'Jackals came down from the dry hills last night. Took two hens. Bold as you like.', ['Barbarian_Hat']],
  ['Knight', { knight: { 1: '#3a2a1c' } }, 806, 372, 'Idle', 'Gate Sergeant', 'Roa is that way. Follow the road and don\'t stop for anyone who asks you to.', ['Knight_Helmet'], Math.PI],
];
// the traders and the street kid go home at night (the guards, the scribe and the innkeeper keep their posts)
const ROA_DAY_ONLY = ['roa2', 'roa3', 'roa5'];
function updateRoaSchedules() {
  const night = TOD.hour < 6.3 || TOD.hour > 20.2;
  for (const id of ROA_DAY_ONLY) {
    const n = NPCS[id]; if (!n) continue;
    if (n.visible === !night) continue;
    // only change while you can't see it happen
    const d = n.pos.distanceTo(camera.position);
    if (d > 35 || behindCamera(n.pos)) n.setVisible(!night);
  }
}
function buildRoaPeople() {
  const S = ROA.spots, F = S.forecourt;
  new NPC('eris', ERIS_SPEC, F.x, F.z, { name: 'Eris', face: Math.PI * 0.95, idle: 'Idle', talk: talkEris });
  new NPC('ghislaine', GHIS_SPEC, S.yard.x, S.yard.z + 3, { name: 'Ghislaine', face: Math.PI, idle: '2H_Melee_Idle', talk: talkGhis });
  const gd = S.guildDoor;
  const sd = STABLE.door;
  new NPC('stable', { base: 'Barbarian', recolor: { barbarian: { 1: '#8a7a6a', 6: '#5a4a32' } }, hide: ['Barbarian_Hat'] }, sd.x, sd.z,
    { name: 'Old Bertram, Stablemaster', face: -2.4, idle: 'Idle', talk: talkStable });
  new NPC('clerk', { base: 'Rogue', recolor: { rogue: { 1: '#6a3a2a', 8: '#3a4a6a', 21: '#3a4a6a', 6: '#e6dcc8' } } }, gd.x, gd.z,
    { name: 'Guild Clerk', face: Math.atan2(S.plaza.x - gd.x, S.plaza.z - gd.z), idle: 'Idle', talk: talkClerk });
  new NPC('sauros', { base: 'Knight', show: ['Knight_Cape'], hide: ['Knight_Helmet'], recolor: { knight: { 1: '#ece6dc', 8: '#7a1f2b', 9: '#5a1620' } } },
    S.keepDoor.x + 5, S.keepDoor.z + 2, { name: 'Lord Sauros', face: 0.2, idle: 'Idle', talk: talkSauros });
  ROA_FOLK.forEach(([base, rc, x, z, idle, name, line, hide, face], i) => {
    new NPC('roa' + i, { base, recolor: rc, hide: hide || [] }, x, z, { name, idle, face: face ?? rnd(0, TAU), talk: n => npcSay(n, [{ s: name, t: line }]) });
  });
  NPCS.roa10.setVisible(false);                         // the sergeant stands at the pass once the gate is open
}

async function talkEris(n) {
  const q = G.quest;
  if (q === 'toRoa' || q === 'findEris') {
    if (q === 'toRoa') setQuest('findEris', { quiet: true });
    await npcSay(n, SCRIPT2.eris1);
    await erisPunch(n);
    await kidnapBegin(n);              // she storms off at dusk, and the night goes wrong (62_kidnap)
    return;
  }
  if (q === 'ghislaine') return npcSay(n, [{ p: 'eris', s: 'Eris Boreas Greyrat', t: 'Ghislaine is in the YARD. Go. Before I get bored and punch you again.' }]);
  if (q === 'birthday') return birthdayScene();
  return npcSay(n, [{ p: 'eris', s: 'Eris Boreas Greyrat', t: pick(['What are you staring at?', 'Ghislaine says I\'m getting faster. I AM getting faster.', 'If you\'re going to read, read somewhere I can\'t see you doing it.']) }]);
}
const gameWait = s => new Promise(r => later(s, r));
// She does. Ghislaine was right about the punches.
async function erisPunch(n) {
  setPlayerState('talk');
  n.face = Math.atan2(PL.body.pos.x - n.pos.x, PL.body.pos.z - n.pos.z);
  n.actor.once('Unarmed_Melee_Attack_Punch_A', { speed: 1.25, fade: 0.08, onEnd: () => n.actor.loop(n.idle, { fade: 0.2 }) });
  await gameWait(0.34);
  PL.actor.once('Hit_B', { speed: 1.3, fade: 0.05 });
  shake(0.45); hitstop(0.09);
  BUS.emit('sfx', { id: 'hurt' }); BUS.emit('flash', { col: '#ff8070', a: 0.22 });
  G.hp = Math.max(1, G.hp - 4);
  emit(14, { pos: PL.body.pos.clone().setY(PL.body.pos.y + 1.6), col: '#fff0a0', spread: 0.2, velSpread: 3, upBias: 2, life: 0.6, size: 0.18, bright: 2 });
  await gameWait(0.9);
  if (PL.state === 'talk') setPlayerState('move');
}

async function talkGhis(n) {
  if (G.quest === 'ghislaine') {
    await npcSay(n, SCRIPT2.ghis1);
    startSpar('ghislaine', 'ghisSpar', {
      yieldAt: 0.5,
      onWin: () => { gainXp(120); npcSay(NPCS.ghislaine, SCRIPT2.ghis2).then(() => { erisJoins(); setQuest('guild'); }); },
      onLose: () => npcSay(NPCS.ghislaine, SCRIPT2.ghisWin),
    });
    return;
  }
  return npcSay(n, [{ p: 'ghislaine', s: 'Ghislaine Dedoldia', t: pick([
    'Watch the shoulders, not the blade.',
    'The Sword God style wins in one strike, or not at all. Paul forgets the second half.',
    'Eris is getting faster. Do not tell her I said so.',
    'A mage who cannot run is a mage who cannot cast twice.',
  ]) }]);
}
function erisJoins() {
  G.flags.erisWith = true;
  NPCS.eris.setVisible(false);
  if (!ALLY.eris) ALLY.eris = new Companion(ERIS_SPEC, 'Eris', '#e8606f');
  ALLY.eris.join();
  toast('Eris joins you', 'good');
  later(1.4, () => bark('Eris', 'Try to keep up, tutor.', '#e8606f'));
}

async function talkClerk(n) {
  if (G.quest === 'guild') {
    await npcSay(n, SCRIPT2.guild1);
    G.flags.guildF = true;
    setQuest('bandits');
    return;
  }
  return npcSay(n, [{ p: 'guild', s: 'Guild Clerk', t: G.flags.firstWall
    ? 'A golem. A real one, from the First Wall. You\'ll be Rank E by the end of the week, mark me.'
    : G.flags.wagons ? 'Wagonbreak\'s clear? The merchants will be singing. Badly, but singing.'
    : 'Rank F work is honest work. Mostly it\'s rats. Today it\'s brigands. Lucky you.' },
    { p: 'guild', s: 'Guild Clerk', t: 'And there\'s the board by the door, when the Lady\'s business leaves you an afternoon. Bounties pay. Some of them pay very well.' }]);
}
async function talkSauros(n) {
  if (G.quest === 'toRoa' || G.quest === 'findEris')
    return npcSay(n, [{ s: 'Sauros Boreas Greyrat', t: 'SO! You\'re the tutor! GOOD! My granddaughter is in the forecourt. Brace yourself, boy. She has broken four already!' }]);
  return npcSay(n, [{ s: 'Sauros Boreas Greyrat', t: pick([
    'Ghislaine says you\'ll do. Ghislaine says nothing is fine. So you\'ll do!',
    'Teach her letters, boy, and sums! And for the gods\' sake teach her to stop punching the staff!',
    'ERIS! ...She\'s not here. Never mind. Carry on!',
  ]) }]);
}

/* ───────────── the gate opens ───────────── */
// The gate's interact: before the story reaches it, it stays barred.
function onGateKnock() {
  if (G.quest === 'road') { gateScene(); return; }
  if (G.flags.gateOpen) return;
  BUS.emit('toast', { text: 'The gate is barred from the other side.', cls: 'big' });
}
async function gateScene() {
  if (G.flags.gateOpen || ROA.gateBusy) return;
  ROA.gateBusy = true;
  try {
    const y = heightAt(786, 380);
    const shot = { pos: new THREE.Vector3(766, y + 5, 392), look: new THREE.Vector3(790, y + 6, 380), fov: 46 };
    await say(SCRIPT2.gate1, { cam: shot });
    // the bar lifts, the doors swing east toward Roa
    setPlayerState('talk');
    CAM.override = shot; letterbox(true); $('hud').classList.add('off');
    BUS.emit('sfx', { id: 'gate', pos: new THREE.Vector3(786, y + 2, 380) });
    await tween(2.8, k => STRUCT.passGate.set(k * k * (3 - 2 * k)));
    G.flags.gateOpen = true;
    NPCS.roa10.setVisible(true);
    await gameWait(0.6);
    CAM.override = null; letterbox(false); $('hud').classList.remove('off');
    if (PL.state === 'talk') setPlayerState('move');
    splash('ch2', 'Chapter II', 'The Boreas Girl', 4200);
    later(4.6, () => setQuest('toRoa'));
  } finally { ROA.gateBusy = false; }
}
// tweens on game time (a pause holds them)
ROA.tweens = [];
function tween(dur, fn) { return new Promise(r => ROA.tweens.push({ t: 0, dur, fn, r })); }

/* ───────────── world encounters in the Roa basin ───────────── */
function defineRoaEncounters() {
  const W = WAGON_CAMP, F = FIRST_WALL;
  defineEncounter('wagons', W.x, W.z, [['bandit', -8, 5], ['bandit', 7, -7], ['bandit', 11, 7], ['bandit', -12, -6], ['marksman', -15, -13], ['marksman', 6, 15], ['captain', 1, -3]], {
    boss: true,
    onClear: () => {
      G.flags.wagons = true;
      banner('Field Boss Felled', 'Brannoc, Brigand Captain');
      if (G.quest === 'bandits') later(2.2, () => say(SCRIPT2.campDone).then(() => { if (G.quest === 'bandits') setQuest('firstWall'); }));
    },
  });
  defineEncounter('firstWall', F.x, F.z, [['golem', 0, 0, { dormant: true, face: 0 }]], {
    boss: true,
    onClear: () => {
      G.flags.firstWall = true;
      banner('Great Enemy Felled', 'The First Golem');
      later(2.6, () => say(SCRIPT2.golemDone).then(() => { if (G.quest === 'firstWall') setQuest('birthday'); }));
    },
  });
  defineEncounter('jackalsNorth', 1905, -30, [['jackal', 0, 0], ['jackal', 3, 2], ['jackal', -3, 3], ['jackal', 2, -3]]);
  defineEncounter('jackalsEast', 2200, 250, [['jackal', 0, 0], ['jackal', 4, 1], ['jackal', -2, 4]]);
  defineEncounter('jackalsGardens', 1720, 650, [['jackal', 0, 0], ['jackal', 3, 3]], { night: true });
  defineEncounter('roadWatch', 1790, 285, [['bandit', 0, 0], ['marksman', -6, -8]]);
  defineEncounter('boarsFarms', 1450, 690, [['boar', 0, 0], ['boar', 5, 3]]);
  defineEncounter('boarsForest', 250, 260, [['boar', 0, 0], ['boar', -4, 4], ['boar', 4, 5]]);
}

/* ───────────── per frame ───────────── */
function updateRoaStory(dt) {
  for (let i = ROA.tweens.length - 1; i >= 0; i--) {
    const T = ROA.tweens[i];
    T.t += dt; T.fn(clamp(T.t / T.dur, 0, 1));
    if (T.t >= T.dur) { ROA.tweens.splice(i, 1); T.r(); }
  }
  if (GAME.inCave) return;
  const p = PL.body.pos;
  if (G.quest === 'toRoa' && rectDist(p.x, p.z, ROA_CITY) < 2) setQuest('findEris');
  updateRoaSchedules();
  updateAftermath();
  // the First Golem stands when you step into its ring
  if (Math.hypot(p.x - FIRST_WALL.x, p.z - FIRST_WALL.z) < FIRST_WALL.r - 3) {
    const g = ENT.enemies.find(e => e.key === 'golem' && e.state === 'dormant' && !e.dead);
    if (g) wakeGolem(g);
  }
  if (G.quest === 'birthday' && !G.flags.birthdayScene && ROA.spots.forecourt && Math.hypot(p.x - ROA.spots.forecourt.x, p.z - ROA.spots.forecourt.z) < 24) birthdayScene();
  OMEN.update(dt);
}
function wakeGolem(g) {
  g.wake(1);
  shake(0.6);
  BUS.emit('sfx', { id: 'pillar', pos: g.pos }); BUS.emit('sfx', { id: 'howl', pos: g.pos });
  emit(60, { pool: 'soft', pos: g.pos.clone().setY(g.pos.y + 0.5), col: '#8a7a62', spread: 4, velSpread: 4, upBias: 3, life: 2, size: 1, size2: 3, gravity: 3 });
  if (!G.flags.golemSeen) { G.flags.golemSeen = true; bossCard('The First Golem', 'Built to guard a wall that is no longer there'); BUS.emit('sfx', { id: 'bossIntro' }); }
}

/* ───────────── the birthday, and the light ───────────── */
async function birthdayScene() {
  if (G.flags.birthdayScene) return;
  G.flags.birthdayScene = true;
  setPlayerState('talk');
  $('hud').classList.add('off');
  await fadeOut(1.0);
  TOD.hour = 20.4;
  // the streets empty for the evening (it's night now; nobody wanders through the party)
  for (const w of TOWN.walkers) { w.shown = false; w.actor.root.visible = false; }
  // a clear night: the sky is the whole point of what comes next
  Object.assign(WEATHER.cur, WEATHER_STATES.clear); Object.assign(WEATHER.tgt, WEATHER_STATES.clear); WEATHER.timer = 1e9;
  if (ALLY.eris) ALLY.eris.leave();
  G.flags.erisWith = false;
  // set the scene in the forecourt: Eris, Ghislaine, her grandfather; you, facing them
  const F = ROA.spots.forecourt, fx = F.x, fz = F.z;
  const px = fx + 1, pz = fz + 9;
  NPCS.eris.setVisible(true); NPCS.eris.moveTo(fx + 1, fz + 1.5, 0);
  NPCS.ghislaine.moveTo(fx + 6, fz - 1, -0.4);
  NPCS.sauros.moveTo(fx - 4.5, fz - 1.5, 0.4);
  PL.body.pos.set(px, floorAt(px, pz), pz); PL.body.vel.set(0, 0, 0);
  PL.face = Math.PI; CAM.yaw = PL.face + Math.PI; CAM.lockTarget = null;
  PL.actor.root.position.copy(PL.body.pos); PL.actor.root.rotation.y = PL.face;
  CAM.pivot.copy(PL.body.pos).setY(PL.body.pos.y + 1.55);
  const y = heightAt(fx, fz);
  const party = { pos: new THREE.Vector3(fx - 6, y + 3.2, fz + 13), look: new THREE.Vector3(fx + 1, y + 1.3, fz + 1), fov: 44 };
  CAM.override = party; CAM.ovBlend = 1; letterbox(true);
  await fadeIn(1.4);
  await say(SCRIPT2.birthday1, { cam: party });
  // later, on the terrace, looking east (closing the talk handed control back: take it again)
  setPlayerState('talk'); $('hud').classList.add('off');
  CAM.override = party; letterbox(true);
  await fadeOut(0.9);
  TOD.hour = 22.6;
  NPCS.ghislaine.setVisible(false); NPCS.sauros.setVisible(false);
  // side by side on the terrace, both facing east
  const tx = ROA.spots.terrace.x, tz = ROA.spots.terrace.z;
  NPCS.eris.moveTo(tx, tz - 0.5, Math.PI / 2); NPCS.eris.hold = true;     // she looks at the sky, not at you
  PL.body.pos.set(tx, floorAt(tx, tz + 0.5), tz + 0.5); PL.face = Math.PI / 2;
  PL.actor.root.position.copy(PL.body.pos); PL.actor.root.rotation.y = PL.face;
  const yt = heightAt(tx, tz);
  // 1. a quiet two-shot from the front
  const calm = { pos: new THREE.Vector3(tx + 5.5, yt + 2.1, tz + 3.5), look: new THREE.Vector3(tx, yt + 1.25, tz), fov: 40 };
  // 2. Eris's line: low and close behind them, on the line from the light through them,
  //    tilting up from their heads to the sky (heads clear of the rooftops, the light above)
  const look0 = new THREE.Vector3(tx, yt + 1.0, tz), look1 = new THREE.Vector3(tx + 44.2, yt + 14.1, tz - 7.6);
  const sky = { pos: new THREE.Vector3(tx - 3.15, yt + 0.35, tz + 0.54), look: look0.clone(), fov: 40 };
  // 3. their faces, lit by it
  const faces = { pos: new THREE.Vector3(tx + 3.6, yt + 1.15, tz + 0.25), look: new THREE.Vector3(tx, yt + 0.95, tz), fov: 36 };
  const lines = SCRIPT2.birthday2.map((L, i) => ({ ...L, t: L.t.replace('{name}', G.name), cam: [calm, sky, faces][i] || sky }));
  lines[1].onShow = () => {
    OMEN.start(new THREE.Vector3(tx, yt, tz));
    tween(3.4, k => sky.look.lerpVectors(look0, look1, k * k * (3 - 2 * k)));
  };
  CAM.override = calm; CAM.ovBlend = 1;
  await fadeIn(1.2);
  await say(lines, { cam: calm });
  // it opens (the talk closing handed control back again: hold it to the end)
  setPlayerState('talk'); $('hud').classList.add('off');
  CAM.override = sky; letterbox(true);
  OMEN.burst();
  BUS.emit('sfx', { id: 'break' }); shake(0.8);
  if (typeof calamityWave === 'function') calamityWave(OMEN.core.position, 2.6);
  await whiteOut(2.4);
  await new Promise(r => setTimeout(r, 900));                 // hold the white a beat
  CAM.override = null; letterbox(false);
  setQuest('done', { quiet: true });
  showEndcard('m2');
  if (OMEN.core) OMEN.core.material.opacity = 0.3;               // what is left of the light: a violet haze, not a white wall
  // the white recedes and leaves the card (over what is left of the light)
  const e = fadeEl();
  e.style.transition = 'opacity 2.6s ease-out'; e.style.opacity = 0;
  setTimeout(() => { if (e.style.opacity === '0') e.style.background = ''; }, 2700);
}
// The light over the east: a still, impossible star that swells, then opens.
// A hot core, a wide bloom that lights the sky around it, and slow halos
// breathing outward from it — all soft-edged, so it reads as light, not a shape.
const _omenOff = new THREE.Vector3(700, 310, -120);
const OMEN = {
  core: null, glow: null, halos: [], t: 0, on: false, burstT: -1,
  build() {
    const radial = (size, stops) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      const c = cv.getContext('2d'), h = size / 2, g = c.createRadialGradient(h, h, 0, h, h, h);
      for (const [k, col] of stops) g.addColorStop(k, col);
      c.fillStyle = g; c.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const sprite = (map, col) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: col, transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending }));
      s.renderOrder = 20; return s;
    };
    this.core = sprite(radial(128, [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(236,220,255,0.95)'], [0.45, 'rgba(160,140,255,0.35)'], [1, 'rgba(120,90,255,0)']]), new THREE.Color(2.4, 2.2, 2.8));
    this.glow = sprite(radial(128, [[0, 'rgba(190,175,255,0.5)'], [0.35, 'rgba(150,130,255,0.18)'], [1, 'rgba(110,90,240,0)']]), new THREE.Color(1, 1, 1));
    const haloTex = radial(256, [[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(0,0,0,0)'], [0.84, 'rgba(215,200,255,0.55)'], [0.9, 'rgba(190,170,255,0.3)'], [1, 'rgba(160,140,255,0)']]);
    this.halos = [0, 1, 2].map(() => sprite(haloTex, new THREE.Color(1.3, 1.2, 1.7)));
  },
  start(from) {
    if (!this.core) this.build();
    this.core.material.opacity = 1;
    this.from = from.clone(); this.on = true; this.t = 0; this.burstT = -1;
    scene.add(this.core, this.glow, ...this.halos);
  },
  burst() { this.burstT = 0; },
  reset() {
    this.on = false; this.dim = false;
    if (this.core) { scene.remove(this.core, this.glow, ...this.halos); this.core.visible = this.glow.visible = true; for (const h of this.halos) h.visible = true; }
  },
  update(dt) {
    if (!this.on) return;
    this.t += dt;
    if (this.burstT >= 0) this.burstT += dt;
    // far over the eastern horizon, low in the sky
    const p = this.core.position.set(this.from.x + 700, this.from.y + 310, this.from.z - 120);
    // (dim: the light that waits after the birthday — always low over the east of wherever you are, no light of its own)
    if (this.dim) { p.copy(camera.position).add(_omenOff); const vis = !GAME.inCave; this.core.visible = this.glow.visible = vis; for (const h of this.halos) h.visible = vis; }
    const rise = 0.4 + 0.6 * smooth(0, 3, this.t);
    // (when it opens it flares to a star a few times its size — the wave that follows is what fills the world)
    const swell = 1 + Math.sin(this.t * 2.3) * 0.06 + (this.burstT >= 0 ? Math.pow(Math.min(this.burstT, 1.2), 2) * 3 : 0);
    this.core.scale.setScalar(70 * swell * rise);
    this.glow.position.copy(p); this.glow.scale.setScalar(330 * swell * rise);
    this.glow.material.opacity = 0.85 * smooth(0, 4, this.t) * (this.dim ? 0.45 : 1);
    if (this.dim) this.core.material.opacity = 0.6;
    // three halos, staggered, each swelling out and thinning away
    this.halos.forEach((h, i) => {
      const k = ((this.t + i * 1.2) % 3.6) / 3.6;
      h.position.copy(p);
      h.scale.setScalar((80 + k * 150) * swell);
      h.material.opacity = Math.pow(1 - k, 1.6) * smooth(0, 0.25, k) * 0.6 * smooth(0.5, 3, this.t) * (this.dim ? 0.4 : 1);
    });
    if (!this.dim) requestLight(PL.body.pos.clone().setY(PL.body.pos.y + 6).add(new THREE.Vector3(8, 0, -2)), '#c8b8ff', 6 + (this.burstT >= 0 ? this.burstT * 30 : 0), 40);
  },
};
// the whole screen goes to white, and stays there
function whiteOut(sec) {
  const e = fadeEl();
  e.style.transition = 'none'; e.style.background = '#ffffff'; e.style.opacity = 0;
  void e.offsetWidth;
  e.style.transition = `opacity ${sec}s ease-in`; e.style.opacity = 1;
  return new Promise(r => setTimeout(r, sec * 1000 + 60));
}
function clearWhiteOut() { const e = fadeEl(); e.style.transition = 'none'; e.style.opacity = 0; e.style.background = ''; }

/* ───────────── saves and resets ───────────── */
// Saves from before Roa: a finished first chapter stops at the gate, not past it.
function migrateSave(g) {
  if ((g.v || 0) < 4) { if (g.quest === 'done') g.quest = 'road'; g.v = 4; }
  return g;
}
// world state that follows G for this chapter (called by resetWorldState)
function resetRoaState() {
  if (!STRUCT.passGate || !NPCS.eris) return;
  STRUCT.passGate.set(G.flags.gateOpen ? 1 : 0);
  NPCS.roa10.setVisible(!!G.flags.gateOpen);
  ROA.tweens.length = 0; ROA.gateBusy = false;
  UI.sparInfo = null;
  const S = ROA.spots, F = S.forecourt;
  NPCS.eris.moveTo(F.x, F.z, Math.PI * 0.95); NPCS.eris.hold = false;
  NPCS.ghislaine.moveTo(S.yard.x, S.yard.z + 3, Math.PI); NPCS.ghislaine.setVisible(true);
  NPCS.sauros.moveTo(S.keepDoor.x + 5, S.keepDoor.z + 2, 0.2); NPCS.sauros.setVisible(true);
  const withYou = !!G.flags.erisWith;
  NPCS.eris.setVisible(!withYou);
  if (withYou) { if (!ALLY.eris) ALLY.eris = new Companion(ERIS_SPEC, 'Eris', '#e8606f'); ALLY.eris.join(); }
  else if (ALLY.eris) ALLY.eris.leave();
  OMEN.reset(); clearWhiteOut();
}
