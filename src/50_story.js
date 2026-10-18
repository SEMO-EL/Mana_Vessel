/* ═══════════════════════════════════════════════════════════════════════
   STORY — the people of Buena, the quest, and the systems that hold a run
   together: waystones, death, fast travel, discovery, collectibles.

   The quest is a straight line of STEPS (G.quest). Each step knows its
   objective text and where its marker points; NPC dialogue and world
   events advance it. Everything worth remembering lives in G.flags.
   ═══════════════════════════════════════════════════════════════════════ */

/* ───────────── dialogue script ───────────── */
const SCRIPT = {
  intro: [
    { t: 'You were thirty-four. You were pathetic. You were hit by a truck while running from a life you had already thrown away.' },
    { t: 'And then there was a ceiling you did not recognise, and hands too small to be yours, and a woman crying with joy over a body you had just been given.' },
    { t: 'This time, you tell yourself. This time I will not waste a single day.' },
  ],
  roxy1: [
    { s: 'Roxy Migurdia', p: 'roxy', t: 'So you\'re the prodigy. Hm. You don\'t look like much — but then, neither do I.' },
    { s: 'Roxy Migurdia', p: 'roxy', t: 'Magic obeys the incantation, but the incantation is only a crutch. Speak the words and the spell is cheap and strong. Skip them and it is instant and expensive. Both are correct. Knowing which is which — that\'s a mage.' },
    { s: 'Roxy Migurdia', p: 'roxy', t: 'Those three rune-stones. Break them. TAP to cast without words; HOLD until the circle burns gold to incant.' },
  ],
  roxy2: [
    { s: 'Roxy Migurdia', p: 'roxy', t: 'Adequate. Now the thing most mages never learn, and it kills them.' },
    { s: 'Roxy Migurdia', p: 'roxy', t: 'Your mana pool grows when you empty it. Completely. To nothing. You will collapse, and you will get back up with a bigger vessel than you had. Every great mage in history was, at some point, an idiot who overdid it.' },
    { s: 'Roxy Migurdia', p: 'roxy', t: 'Empty it. Here, where I can watch. And if anything is near you when it breaks — well. It won\'t be near you for long.' },
  ],
  roxy3: [
    { s: 'Roxy Migurdia', p: 'roxy', t: 'You broke the vessel. Good. That\'s the whole trick.' },
    { s: 'Roxy Migurdia', p: 'roxy', t: 'One more thing, and this one is free: wind magic can hold you up. Jump, and while you fall, hold it — the air will carry you, for as long as your mana lasts.' },
    { s: 'Roxy Migurdia', p: 'roxy', t: 'Your father wants you in the training yard. Something about "a proper education". Try not to let him hit you in the face.' },
  ],
  paul1: [
    { s: 'Paul Greyrat', p: null, t: 'There he is! Magic, magic, magic. Your mother\'s side, that. Well — magic won\'t save you when something gets inside your chant.' },
    { s: 'Paul Greyrat', p: null, t: 'Sword. Left click. Swing it until it stops feeling like a decision. Tap the run key to roll out of the way — hold it to run. Watch the shoulders, not the blade: everything telegraphs.' },
    { s: 'Paul Greyrat', p: null, t: 'And I keep my guard up, so hacking at my front gets you nowhere. Wait for me to swing, then make me pay for it. Or get round my side.' },
    { s: 'Paul Greyrat', p: null, t: 'Come on, then. Show your old man what you\'ve got. I\'ll go easy. Probably.' },
  ],
  paul2: [
    { s: 'Paul Greyrat', p: null, t: 'Alright, alright! I yield. Gods, you\'re quick.' },
    { s: 'Paul Greyrat', p: null, t: 'Listen. The wolves have been coming out of the forest at night, bold as anything. Wolves don\'t do that unless something bigger is pushing them. Go east, into Buena Forest. Find what it is.' },
  ],
  alphaDead: [
    { t: 'The alpha falls, and the forest goes quiet behind it. Whatever pushed the pack out of the trees was the pack\'s own hunger — and now it has none.' },
    { t: 'Somewhere to the north, under the cliffs, the villagers say the dead have stopped staying down.' },
  ],
  roxy4: [
    { s: 'Roxy Migurdia', p: 'roxy', t: 'You\'ve been busy. Paul told me about the wolves. He tells everyone about the wolves.' },
    { s: 'Roxy Migurdia', p: 'roxy', t: 'Then your final examination. There is a cave under the northern cliffs the villagers call the Weeping Cave. Something down there is waking the dead. Put it back to sleep.' },
    { s: 'Roxy Migurdia', p: 'roxy', t: 'Follow the river north to the falls, then the cliffs east of it. And rest at the waystone before you go in. That is not advice. That is part of the exam.' },
  ],
  wardenDead: [
    { t: 'The Warden\'s blade drops, and the barrow exhales — a long, cold sigh, like a house settling after a door is finally closed.' },
    { t: 'The dead lie still. Go back to Roxy.' },
  ],
  roxy5: [
    { s: 'Roxy Migurdia', p: 'roxy', t: 'You did it. Of course you did. I would like it on the record that I have nothing left to teach you, which is unfair.' },
    { s: 'Roxy Migurdia', p: 'roxy', t: 'I\'m leaving Buena. A tutor who has run out of lessons should go find some of her own.' },
    { s: 'Roxy Migurdia', p: 'roxy', t: 'Paul has written to a noble house in Roa — the Boreas. They need a tutor for a girl who, I am told, punches. Take the road east. Try to be less of an idiot than I was.' },
  ],
  gate: [
    { t: 'The gate to Roa stands shut, the road beyond it climbing toward walls you can see from here.' },
    { t: 'That is the next chapter.' },
  ],
  pages: [
    'Page I — "The vessel is not a cup. It is a muscle. It does not fill; it grows."',
    'Page II — "Fire does not only burn what you aim it at. Remember the brambles."',
    'Page III — "Water that is cold enough is a floor."',
    'Page IV — "Earth answers when you ask it to stand. It will lift whatever stands on it."',
    'Page V — "Wind is patient. It will hold you up for exactly as long as you can pay it."',
  ],
};

/* ───────────── quest steps ───────────── */
const QUEST = [
  { id: 'findRoxy',  title: 'The Second Life',   text: 'Roxy is waiting on the hill south-east of the village.', at: () => NPCS.roxy && NPCS.roxy.pos },
  { id: 'stones',    title: 'The First Lesson',  text: 'Break Roxy\'s three rune-stones with magic.', at: () => NPCS.roxy && NPCS.roxy.pos },
  { id: 'breakIt',   title: 'The First Lesson',  text: 'Empty your mana completely. Break the vessel.', at: null },
  { id: 'tellRoxy',  title: 'The First Lesson',  text: 'Speak with Roxy.', at: () => NPCS.roxy && NPCS.roxy.pos },
  { id: 'findPaul',  title: 'A Proper Education', text: 'Your father is in the training yard.', at: () => NPCS.paul && NPCS.paul.pos },
  { id: 'spar',      title: 'A Proper Education', text: 'Best Paul in a sparring match.', at: () => NPCS.paul && NPCS.paul.pos },
  { id: 'wolves',    title: 'Hunger in the Trees', text: 'Find what drives the wolves out of Buena Forest.', at: () => ({ x: 470, z: -120 }) },
  { id: 'examRoxy',  title: 'The Final Exam',    text: 'Return to Roxy.', at: () => NPCS.roxy && NPCS.roxy.pos },
  { id: 'cave',      title: 'The Final Exam',    text: 'Enter the Weeping Cave beneath the northern cliffs.', at: () => STRUCT.caveMouth ? { x: STRUCT.caveMouth.x, z: STRUCT.caveMouth.z } : null },
  { id: 'warden',    title: 'The Final Exam',    text: 'Put the dead back to sleep.', at: null },
  { id: 'farewell',  title: 'The Final Exam',    text: 'Return to Roxy.', at: () => NPCS.roxy && NPCS.roxy.pos },
  { id: 'road',      title: 'The Road to Roa',   text: 'Take the road east, through the pass.', at: () => ({ x: 780, z: 380 }) },
  { id: 'done',      title: 'The Road to Roa',   text: 'Explore Buena, or rest and continue in Milestone 2.', at: null },
];
function questStep() { return QUEST.find(q => q.id === G.quest) || QUEST[0]; }
function setQuest(id, { quiet = false } = {}) {
  if (G.quest === id) return;
  G.quest = id;
  const q = questStep();
  if (!quiet) { toast(q.title, 'big'); later(0.7, () => toast(q.text)); }
  BUS.emit('sfx', { id: 'page' });
  BUS.emit('quest', id);
  autosave();
}
function currentObjective() { if (!G) return null; const q = questStep(); return { title: q.title, text: q.text }; }
function questMarker() {
  if (!G) return null;
  const q = questStep(); const p = q.at && q.at();
  return p ? { x: p.x, z: p.z, label: q.title } : null;
}

/* ───────────── NPCs ───────────── */
const NPCS = {};
class NPC {
  constructor(id, spec, x, z, o = {}) {
    this.id = id; this.name = o.name || id;
    this.actor = new Actor(spec);
    this.pos = new THREE.Vector3(x, heightAt(x, z), z);
    this.face = o.face || 0; this.baseFace = this.face;
    this.idle = o.idle || 'Idle';
    this.actor.root.position.copy(this.pos);
    this.actor.loop(this.idle, { fade: 0 });
    this.actor.mixer.setTime(Math.random() * 3);
    scene.add(this.actor.root);
    this.col = addCircle(x, z, 0.4, this.pos.y, this.pos.y + 1.8, 'npc');
    this.talk = o.talk || null;
    this.visible = true;
    // one conversation at a time: the key that closes a talk must not reopen it
    // before its follow-up (quest step, spawned stones) has run
    if (this.talk) INTERACTABLES.push({ pos: this.pos, r: 2.8, label: () => 'Talk to ' + this.name,
      enabled: () => this.visible && !!this.talk && !this.busy,
      action: async () => { if (this.busy) return; this.busy = true; try { await this.talk(this); } finally { this.busy = false; } } });
    NPCS[id] = this;
  }
  setVisible(on) { this.visible = on; this.actor.root.visible = on; this.col.y1 = on ? this.pos.y + 1.8 : this.pos.y - 5; }
  // stand somewhere else (a scene, a visit): the talk prompt and the body come along
  moveTo(x, z, face = this.face) {
    this.pos.set(x, heightAt(x, z), z);
    removeCollider(this.col);
    this.col = addCircle(x, z, 0.4, this.pos.y, this.pos.y + (this.visible ? 1.8 : -5), 'npc');
    this.face = this.baseFace = face;
    this.actor.root.position.copy(this.pos); this.actor.root.rotation.y = face;
  }
  update(dt) {
    if (!this.visible) return;
    const d = PL.body.pos.distanceTo(this.pos);
    // animation LOD: every frame up close, ~5 Hz in the distance (never frozen)
    this._acc = (this._acc || 0) + dt;
    if (d > 60 && this._acc < 0.2) return;
    const step = this._acc; this._acc = 0;
    // turn to face you when you come close (unless a scene has them looking somewhere else)
    const want = d < 6 && !this.hold ? Math.atan2(PL.body.pos.x - this.pos.x, PL.body.pos.z - this.pos.z) : this.baseFace;
    this.face = dampAngle(this.face, want, 3, step);
    this.actor.root.rotation.y = this.face;
    this.actor.update(step);
  }
}
async function npcSay(npc, lines) {
  await say(lines, { cam: talkCam(npc.pos) });
}

function buildPeople() {
  const hill = PLACES.roxyHill;
  new NPC('roxy', { base: 'Mage', show: ['Mage_Hat', '2H_Staff'], recolor: { mage: { 1: '#3d6fc4', 8: '#2c3148', 9: '#23283c', 10: '#4a3226', 5: '#6a4a2a' } } },
    hill.x + 4, hill.z - 6, { name: 'Roxy', face: -2.2, idle: 'Idle', talk: talkRoxy });
  new NPC('paul', { base: 'Knight', show: ['1H_Sword'], hide: ['Knight_Helmet'], recolor: { knight: { 1: '#a37a3c' } } },
    -498, 436, { name: 'Paul', face: Math.PI, idle: '2H_Melee_Idle', talk: talkPaul });
  new NPC('zenith', { base: 'Rogue', recolor: { rogue: { 1: '#e2c27a', 8: '#b58da8', 6: '#e8dcc8', 21: '#b58da8', 9: '#8a6a86' } } },
    -462, 312, { name: 'Zenith', face: 2.6, idle: 'Idle', talk: n => npcSay(n, [
      { s: 'Zenith Greyrat', t: G.quest === 'done' || G.quest === 'road' ? 'Roa! Write to us. Write every week. Paul says every month is fine; Paul is wrong.' : 'Be careful out there. And come home for supper — I made too much again.' }]) });
  new NPC('lilia', { base: 'Rogue', recolor: { rogue: { 1: '#2a2230', 8: '#3a3444', 6: '#e6e0d4', 21: '#3a3444', 9: '#2a2230' } } },
    -478, 318, { name: 'Lilia', face: 2.2, idle: 'Use_Item', talk: n => npcSay(n, [
      { s: 'Lilia', t: 'Young master. The waystone by the well — rest there, and the house will know where to look for you if you fall.' }]) });
  // villagers going about their day
  const V = [
    ['Barbarian', { barbarian: { 1: '#4a3020' } }, -418, 344, 'Interact', 'Farmer Gerard', 'The wolves took two sheep last week. Two! In summer!'],
    ['Barbarian', { barbarian: { 1: '#7a6a5a', 6: '#5a6a3a' } }, -345, 525, 'PickUp', 'Old Maryl', 'Harvest is early this year. The mill can barely keep up.'],
    ['Rogue', { rogue: { 1: '#6a4a2a', 8: '#6a7a4a', 21: '#6a7a4a' } }, -405, 352, 'Sit_Floor_Idle', 'Tomas', 'Did you hear? A tower on the ridge. You can see all of Buena from the top, they say.'],
    ['Knight', { knight: { 1: '#3a2a1c' } }, -330, 395, 'Idle', 'Road Warden', 'East road\'s thick with brigands past the fields. Their camp\'s south of the road — steer wide or bring friends.'],
    ['Rogue', { rogue: { 1: '#c8a060', 8: '#8a5a6a', 21: '#8a5a6a' } }, -568, 612, 'Idle', 'Fisher Anne', 'There\'s an island out there, see it? No boat in Buena will take you. Maybe a mage could walk it.'],
  ];
  V.forEach(([base, rc, x, z, idle, name, line], i) => {
    const hideHat = base === 'Barbarian' ? ['Barbarian_Hat'] : [];
    new NPC('v' + i, { base, recolor: rc, hide: hideHat }, x, z, { name, idle, face: rnd(0, TAU), talk: n => npcSay(n, [{ s: name, t: line }]) });
  });
}

/* ───────────── Roxy, Paul, and the quest beats ───────────── */
async function talkRoxy(n) {
  const q = G.quest;
  if (q === 'findRoxy') { await npcSay(n, SCRIPT.roxy1); setQuest('stones'); spawnRuneStones(); return; }
  if (q === 'stones') { await npcSay(n, [{ s: 'Roxy Migurdia', p: 'roxy', t: 'The rune-stones, prodigy. Magic. Not a stick.' }]); return; }
  if (q === 'breakIt') { await npcSay(n, [{ s: 'Roxy Migurdia', p: 'roxy', t: 'All of it. Cast until there is nothing left. Yes, it will hurt.' }]); return; }
  if (q === 'tellRoxy') { await npcSay(n, SCRIPT.roxy3); setQuest('findPaul'); return; }
  if (q === 'examRoxy') { await npcSay(n, SCRIPT.roxy4); setQuest('cave'); return; }
  if (q === 'farewell') { await npcSay(n, SCRIPT.roxy5); setQuest('road'); return; }
  await npcSay(n, [{ s: 'Roxy Migurdia', p: 'roxy', t: pick(['Rest at a waystone before anything that frightens you. It\'s not cowardice, it\'s arithmetic.', 'Incant when you can afford the time. Go chantless when you can\'t.', 'An empty vessel is a growing one. Remember that when you\'re scared.']) }]);
}
async function talkPaul(n) {
  const q = G.quest;
  if (q === 'findPaul' || q === 'spar') {
    await npcSay(n, SCRIPT.paul1);
    setQuest('spar');
    startSpar();
    return;
  }
  await npcSay(n, [{ s: 'Paul Greyrat', t: pick(['Keep your guard up — F, or whatever you\'ve set it to. Tap it right as they swing and you\'ll turn the blow.', 'Lock on with Q. Then circle. Never walk straight at something that wants to hit you.', 'Heavy strike: hold the attack. Breaks their stance. Then the next one really hurts.']) }]);
}

/* rune-stones: breakable only by magic */
ENEMY_DEFS.runestone = { name: 'Rune-stone', rig: 'stone', hp: 20, poise: 999, r: 0.7, h: 1.6, walk: 0, run: 0, sight: 0, hear: 0, xp: 4, weight: 9, static: true, magicOnly: true, attacks: [] };
function spawnRuneStones() {
  for (const e of [...ENT.enemies]) if (e.quest === 'stone') e.remove();   // idempotent (continue, re-talk)
  const r = NPCS.roxy.pos;
  G.flags.stonesBroken = 0;
  for (let i = 0; i < 3; i++) {
    const a = -0.4 + i * 0.5, x = r.x + Math.cos(a) * 14, z = r.z + Math.sin(a) * 14;
    const e = new Enemy('runestone', x, z);
    e.quest = 'stone';
  }
}
function buildStoneRig() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.8, 6), toonMat({ color: '#7a7466' }));
  m.position.y = 0.9; m.castShadow = true; g.add(m);
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5aa9e6').multiplyScalar(2), transparent: true, opacity: 0.9, map: runeTexture('w') }));
  rune.position.set(0, 1.0, 0.5); g.add(rune);
  return { root: g, update(dt, e) { rune.rotation.z += dt; if (e.dead) g.scale.y = Math.max(0.01, g.scale.y - dt * 3); }, weaponPos(o) { return g.getWorldPosition(o); } };
}

/* sparring with Paul: an enemy that yields */
ENEMY_DEFS.paulSpar = {
  name: 'Paul Greyrat', base: 'Knight', show: ['1H_Sword'], hide: ['Knight_Helmet'], recolor: { knight: { 1: '#a37a3c' } },
  hp: 300, poise: 60, r: 0.42, h: 1.75, walk: 1.8, run: 4.8, sight: 40, hear: 40, xp: 60, weight: 1, flinchAt: 14, spar: true,
  shield: 0.85, guardPoise: 0.3, flinchCd: 1.8, armorWindup: true,   // his blade guards his front, and once he swings he commits: dodge, then punish
  idle: '2H_Melee_Idle', walkClip: 'Walking_B', runClip: 'Running_A',
  attacks: [
    { clip: '1H_Melee_Attack_Slice_Diagonal', speed: 0.95, hitAt: 0.42, range: [0, 2.6], reach: 2.4, arc: 1.0, dmg: 9, poise: 18, lunge: 3 },
    { clip: '1H_Melee_Attack_Stab', speed: 0.9, hitAt: 0.44, range: [1.8, 4.2], reach: 3.1, arc: 0.45, dmg: 12, poise: 25, lunge: 7 },
  ],
};
// A spar: the NPC steps out and an enemy stand-in fights you — one that
// yields at a threshold instead of dying, and wins by pulling its last blow.
function startSpar(npcId = 'paul', defKey = 'paulSpar', o = {}) {
  const n = NPCS[npcId];
  n.setVisible(false);
  const e = new Enemy(defKey, n.pos.x, n.pos.z, { face: n.face });
  e.aggro = true; e.set('alert');
  e.sparring = true;
  UI.spar = e;
  UI.sparInfo = {
    npc: n, yieldAt: o.yieldAt ?? 0.3,
    onWin: o.onWin || (() => { gainXp(60); npcSay(NPCS.paul, SCRIPT.paul2).then(() => setQuest('wolves')); }),
    onLose: o.onLose || (() => {
      setQuest('findPaul', { quiet: true });
      npcSay(NPCS.paul, [
        { s: 'Paul Greyrat', t: 'Hah! And that is why you watch the shoulders. Breathe, kid. You were closer than you think.' },
        { s: 'Paul Greyrat', t: 'Wait for my swing, get out of its way, then hit me while I\'m still recovering. Come talk to me when you want another go.' },
      ]);
    }),
  };
}
function endSpar() {
  const e = UI.spar, info = UI.sparInfo;
  if (!e) return null;
  e.dead = true; e.releaseToken();
  if (CAM.lockTarget === e) CAM.lockTarget = null;
  e.remove();
  UI.spar = null; UI.sparInfo = null;
  if (info) info.npc.setVisible(true);
  return info;
}
// Losing: the blade stops an inch short, and you go again when ready.
BUS.on('sparLost', () => {
  const info = endSpar();
  if (!info) return;
  G.hp = Math.max(G.hp, G.maxHp * 0.5);
  info.onLose();
});
function checkSpar() {
  const e = UI.spar;
  if (!e) return;
  if (!e.dead && e.hp / e.maxHp < UI.sparInfo.yieldAt) { endSpar().onWin(); return; }   // a yield, a bow
  if (PL.state === 'dead') endSpar();                                                  // they'd never let it go that far
}

/* ───────────── world encounters ───────────── */
function defineEncounters() {
  defineEncounter('forestEdge', 180, 120, [['wolf', 0, 0], ['wolf', 4, 3], ['wolf', -3, 5]]);
  defineEncounter('forestDeep', 360, -80, [['wolf', 0, 0], ['wolf', 5, -2], ['wolf', -4, 3]]);
  defineEncounter('alpha', 470, -120, [['alpha', 0, 0], ['wolf', 5, 4], ['wolf', -5, 3], ['wolf', 2, -6]], {
    onClear: () => { if (G.quest === 'wolves') { say(SCRIPT.alphaDead).then(() => setQuest('examRoxy')); } G.flags.alpha = true; },
  });
  defineEncounter('westWoods', -430, -360, [['wolf', 0, 0], ['wolf', 3, 4], ['wolf', -4, 2]]);
  defineEncounter('nightFields', -150, 480, [['wolf', 0, 0], ['wolf', 4, 2]], { night: true });
  defineEncounter('roadBandits', 60, 440, [['bandit', 0, 0], ['bandit', 3, 3]]);
  defineEncounter('camp', PLACES.camp.x, PLACES.camp.z, [['bandit', -6, 4], ['bandit', 5, -3], ['bandit', 7, 6], ['marksman', 0, -12]], {
    onClear: () => { G.flags.campCleared = true; toast('Brigands\' Rest is quiet', 'good'); },
  });
  defineEncounter('ridgeWatch', -40, 40, [['marksman', 0, 0], ['bandit', 4, 3]]);
  defineEncounter('chapelNight', PLACES.ruinsE.x, PLACES.ruinsE.z, [['thrall', -4, 4], ['thrall', 5, 2], ['archer', 0, -8]], { night: true });
  defineEncounter('treant', GROVE.x, GROVE.z, [['treant', 0, 0, { dormant: true }]], { boss: true, onClear: () => { G.flags.treant = true; banner('Great Enemy Felled', 'The Elder Treant'); } });
  // the cave, chamber by chamber (local coords → world)
  const cw = (lx, lz) => caveWorld(lx, lz);
  const E = (id, lx, lz, list, o) => { const w = cw(lx, lz); defineEncounter(id, w.x, w.z, list, { cave: true, ...(o || {}) }); };
  E('caveEntrance', 0, -8, [['thrall', -4, -2, { dormant: true }], ['thrall', 4, -3, { dormant: true }]]);
  E('caveGrotto', -42, -30, [['archer', -8, -6], ['thrall', 4, 3], ['thrall', 6, -4], ['sorcerer', -10, 8]]);
  E('caveHall', 38, -40, [['thrall', -3, 3, { dormant: true }], ['thrall', 3, 4, { dormant: true }], ['knight', 0, -6]]);
  E('caveOssuary', 0, -74, [['knight', -4, 0], ['archer', 6, -6], ['thrall', 3, 4, { dormant: true }], ['sorcerer', -6, -7]]);
  E('warden', 0, -120, [['warden', 0, 0, { scale: 2.2, face: 0, dormant: true }]], { boss: true,
    onClear: () => { G.flags.warden = true; banner('Great Enemy Felled', 'The Barrow Warden'); later(2.5, () => say(SCRIPT.wardenDead).then(() => { if (G.quest === 'warden' || G.quest === 'cave') setQuest('farewell'); })); } });
}

// The Elder Treant is only a tree until you come too close. Then it isn't.
BUS.on('enemyWake', e => {
  if (e.key !== 'treant') return;
  BUS.emit('sfx', { id: 'howl', pos: e.pos });
  shake(0.45);
  emit(40, { pool: 'soft', pos: e.pos.clone().setY(e.pos.y + 6), col: '#5a7a38', spread: 2.2, velSpread: 2.5, life: 2.2, size: 0.35, size2: 0.2, gravity: 2.5 });   // leaves shaken loose
  if (!G.flags.treantSeen) { G.flags.treantSeen = true; bossCard('The Elder Treant', 'Heart of Buena Forest'); BUS.emit('sfx', { id: 'bossIntro' }); }
});

/* ───────────── the Warden's reveal ─────────────
   Crossing the mist: the braziers catch around the Barrow, the Warden climbs
   out of its grave in the shaft of daylight, and its name lands. The first
   time is a short cutscene; after that it simply rises as you walk in. */
const SHOT = { fn: null };
BUS.on('fogWall', () => {
  const W = ENT.enemies.find(e => e.key === 'warden' && !e.dead && e.state === 'dormant');
  if (!W) return;
  if (G.flags.wardenSeen) { later(0.8, () => W.wake(1.0)); return; }
  G.flags.wardenSeen = true;
  setPlayerState('talk'); PL.actor.setUpper(null); PL.actor.loop('Idle', { fade: 0.3 });
  CAM.lockTarget = null;
  letterbox(true); $('hud').classList.add('off');
  const P0 = PL.body.pos.clone(), wp = W.pos.clone();
  const dir = new THREE.Vector3(wp.x - P0.x, 0, wp.z - P0.z).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x);
  // from over your shoulder at the mist, down the hall to a low three-quarter on the grave
  const from = P0.clone().addScaledVector(dir, -3).addScaledVector(side, 1.2).setY(P0.y + 2.6);
  const to = wp.clone().addScaledVector(dir, -9).addScaledVector(side, 4).setY(wp.y + 0.9);   // low: it looms
  const ov = CAM.override = { pos: from.clone(), look: wp.clone().setY(wp.y + 1), fov: 42 };
  CAM.ovBlend = 1;
  let t = 0, woke = false, carded = false;
  SHOT.fn = dt => {
    t += dt;
    ov.pos.lerpVectors(from, to, smooth(0, 1, t / 4.6));
    ov.look.set(wp.x, wp.y + lerp(0.6, W.h * 0.62, smooth(1.4, 3.8, t)), wp.z);
    if (!woke && t > 1.3) { woke = true; W.wake(0.9); W.awakeT += 1.6; shake(0.25); }
    if (!carded && t > 2.5) { carded = true; bossCard('The Barrow Warden', 'Keeper of the Weeping Cave'); BUS.emit('sfx', { id: 'bossIntro' }); }
    if (t < 5.2) return false;
    CAM.override = null; letterbox(false); $('hud').classList.remove('off');
    if (PL.state === 'talk') setPlayerState('move');
    return true;
  };
});

/* ───────────── waystones ───────────── */
async function activateWaystone(W) {
  if (!G.waystones[W.id]) {
    G.waystones[W.id] = true;
    G.lastWaystone = W.id;
    BUS.emit('waystone', W);
    BUS.emit('sfx', { id: 'waystone' });
    banner('Waystone Awakened', W.name);
    emit(60, { pos: W.crystal.getWorldPosition(new THREE.Vector3()), col: '#8fd0ff', spread: 0.3, velSpread: 5, life: 1.4, size: 0.3, bright: 2 });
    ring(W.pos, { col: '#8fd0ff', r1: 8, life: 1.1 });
    autosave();
    return;
  }
  // rest: sit, then the rest menu
  setPlayerState('rest');
  PL.face = Math.atan2(W.x - PL.body.pos.x, W.z - PL.body.pos.z);
  PL.actor.once('Sit_Floor_Down', { speed: 1.2, onEnd: () => PL.state === 'rest' && PL.actor.loop('Sit_Floor_Idle') });
  PL.restAt = W;
  G.lastWaystone = W.id;
  restWorld();
  openRest(W);
}
function restWorld() {
  G.hp = G.maxHp; G.stamina = G.maxStamina; G.mana = G.maxMana;
  G.cds = {};
  for (const e of [...ENT.enemies]) if (!e.def.boss || e.dead) e.remove();
  resetEncounters();
  BUS.emit('sfx', { id: 'waystone' });
  autosave();
}
function leaveRest() {
  if (PL.state !== 'rest') return;
  PL.actor.once('Sit_Floor_StandUp', { speed: 1.4, onEnd: () => { setPlayerState('move'); PL.actor.loop('Idle'); } });
}
// Elden Ring's rule: no travelling out of a fight, or up out of the ground.
function travelBlock() {
  if (GAME.inCave) return 'The cave holds you. Find the way out first.';
  if (ENT.enemies.some(e => !e.dead && e.aggro && e.dist() < 50)) return 'Not with enemies this close.';
  return null;
}
async function fastTravel(id) {
  const W = WSTONE.list.find(w => w.id === id);
  if (!W || !G.waystones[id]) return;
  closeAllScreens();
  await fadeOut(0.6);
  leaveCaveNow();
  for (const e of [...ENT.enemies]) e.remove();
  for (const enc of ENCOUNTERS) { enc.active = false; enc.live = []; }
  G.lastWaystone = id;                    // where you arrive is where you'll rise
  placeAtWaystone(W);
  GAME.state = 'play';
  $('hud').classList.remove('off');
  await fadeIn(0.8);
  banner(W.name);
}
// Stand beside the stone on open ground, looking out at the most open view
// (never nose to a wall), with room behind for the camera.
const _wsO = new THREE.Vector3(), _wsD = new THREE.Vector3();
function placeAtWaystone(W) {
  let best = null, bestS = -Infinity;
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU, x = W.x + Math.sin(a) * 3.5, z = W.z + Math.cos(a) * 3.5, h = floorAt(x, z);
    if (!GAME.inCave && waterAt(x, z) > NO_WATER) continue;
    if (groundAt(x, z, h + 3, 0.6) > h + 0.3) continue;                       // something low stands here
    _wsO.set(x, h, z); pushOut(_wsO, 0.7, h, 1.7);
    if (Math.hypot(_wsO.x - x, _wsO.z - z) > 0.05) continue;                  // …or a wall
    _wsO.set(x, h + 1.4, z);
    const ahead = raycastWorld(_wsO, _wsD.set(Math.sin(a), 0, Math.cos(a)), 30);
    const behind = raycastWorld(_wsO, _wsD.set(-Math.sin(a), 0.25, -Math.cos(a)).normalize(), 6);
    const toPlace = Math.cos(a - Math.atan2(PLACES.village.x - W.x, PLACES.village.z - W.z));
    const s = Math.min(ahead, 30) + Math.min(behind, 6) * 2 + toPlace * 3;
    if (s > bestS) { bestS = s; best = { x, z, a }; }
  }
  if (!best) { const a = 0; best = { x: W.x + Math.sin(a) * 4, z: W.z + Math.cos(a) * 4, a }; }
  placePlayerAt(best.x, floorAt(best.x, best.z), best.z, best.a);
}
function placePlayerAt(x, y, z, face) {
  horseStandDown();
  PL.body.pos.set(x, y, z); PL.body.vel.set(0, 0, 0);
  PL.face = face; CAM.yaw = face + Math.PI; CAM.pitch = -0.18; CAM.lockTarget = null;
  CAM.pivot.copy(PL.body.pos).setY(PL.body.pos.y + 1.55);
  setPlayerState('move'); PL.actor.loop('Idle', { fade: 0 });
}
// Where a save left you, if it's somewhere you can stand (else null: the last waystone instead)
function savedSpot(s) {
  const p = s.pos;
  if (s.inCave || !Array.isArray(p) || p.length < 3 || !p.every(Number.isFinite)) return null;
  const [x, y, z] = p;
  if (x < WORLD.px0 || x > WORLD.px1 || z < WORLD.pz0 || z > WORLD.pz1) return null;
  const w = waterAt(x, z), gy = groundAt(x, z, y + 0.6);         // a bridge deck or a floe counts as ground
  if (w > NO_WATER && w - gy > PHYS.WADE) return null;
  return { x, y: gy, z, face: Number.isFinite(s.face) ? s.face : 0 };
}

/* ───────────── death ───────────── */
BUS.on('playerDied', () => {
  if (UI.spar) return;
  setTimeout(() => {
    $('deathText').textContent = pick([
      'You fall. Somewhere, a third life begins without you.',
      'The vessel spills, and the world keeps turning.',
      'Not this time. Get up.',
    ]) + '  ·  ' + G.breaks + ' breaks, ' + G.kills + ' kills, level ' + G.lvl + '.';
    GAME.state = 'dead';
    $('hud').classList.add('off');
    openScreen('death');
    BUS.emit('sfx', { id: 'death' });
  }, 2600);
});
async function riseAgain() {
  closeAllScreens();
  if (SHOT.fn) { SHOT.fn = null; CAM.override = null; letterbox(false); }
  await fadeOut(0.5);
  leaveCaveNow();
  for (const e of [...ENT.enemies]) e.remove();
  resetEncounters();
  const W = WSTONE.list.find(w => w.id === G.lastWaystone) || WSTONE.list[0];
  G.hp = G.maxHp; G.mana = G.maxMana * 0.6; G.stamina = G.maxStamina;
  placeAtWaystone(W);
  GAME.state = 'play';
  $('hud').classList.remove('off');
  await fadeIn(0.9);
}

/* ───────────── the watchtower ───────────── */
async function climbTower() {
  await fadeOut(0.5);
  const T = STRUCT.tower;
  PL.body.pos.set(T.x, T.top, T.z); PL.body.vel.set(0, 0, 0); PL.body.grounded = true;
  PL.face = Math.atan2(PLACES.village.x - T.x, PLACES.village.z - T.z);
  CAM.yaw = PL.face + Math.PI; CAM.pitch = -0.25;
  CAM.pivot.copy(PL.body.pos).setY(PL.body.pos.y + 1.55);
  await fadeIn(0.8);
  if (!G.flags.tower) {
    G.flags.tower = true;
    if (typeof mapRevealAt === 'function') mapRevealAt(T.x, T.z, 380);
    banner('Watchtower Ridge', 'The borderlands lie open below');
    setTimeout(() => hint('Jump — and hold Jump while you fall — to glide down on the wind.', 5), 2500);
  }
}

/* ───────────── collectibles: Roxy's lost pages ───────────── */
const PAGES = [];
// A leaf of Roxy's textbook: parchment, lines of her small hand, one spell
// diagram, scorched edges — painted once and shared by all five pages.
let _pageTex = null, _haloTex = null;
function pageTexture() {
  if (_pageTex) return _pageTex;
  const W = 128, H = 166, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), R = mulberry32(4242);
  const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#efe2bf'); bg.addColorStop(1, '#dcc897');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) { x.fillStyle = `rgba(150,110,60,${0.04 + R() * 0.05})`; x.beginPath(); x.arc(R() * W, R() * H, 6 + R() * 18, 0, TAU); x.fill(); }
  // the diagram: a circle of runes with a star inside
  x.strokeStyle = 'rgba(70,46,26,.85)'; x.lineWidth = 1.4;
  x.beginPath(); x.arc(64, 54, 26, 0, TAU); x.stroke();
  x.beginPath(); x.arc(64, 54, 19, 0, TAU); x.stroke();
  x.beginPath(); for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + k * TAU * 2 / 5; x[k ? 'lineTo' : 'moveTo'](64 + Math.cos(a) * 19, 54 + Math.sin(a) * 19); } x.stroke();
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; x.fillStyle = 'rgba(70,46,26,.8)'; x.fillRect(64 + Math.cos(a) * 22.5 - 1, 54 + Math.sin(a) * 22.5 - 1, 2, 2); }
  // lines of handwriting
  x.strokeStyle = 'rgba(60,40,24,.7)'; x.lineWidth = 1;
  for (let row = 0; row < 7; row++) {
    let px = 14 + (row === 0 ? 8 : 0); const py = 96 + row * 9.5;
    while (px < W - 16) {
      const w = 4 + R() * 12; x.beginPath(); x.moveTo(px, py);
      for (let s = 1; s <= 4; s++) x.lineTo(px + w * s / 4, py + (R() - 0.5) * 2.2);
      x.stroke(); px += w + 3 + R() * 2;
    }
  }
  // scorched edges
  const v = x.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.62);
  v.addColorStop(0, 'rgba(90,50,20,0)'); v.addColorStop(1, 'rgba(90,50,20,.55)');
  x.fillStyle = v; x.fillRect(0, 0, W, H);
  _pageTex = new THREE.CanvasTexture(c); _pageTex.colorSpace = THREE.SRGBColorSpace; _pageTex.anisotropy = 4;
  return _pageTex;
}
function haloTexture() {
  if (_haloTex) return _haloTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,230,160,1)'); g.addColorStop(0.35, 'rgba(255,210,120,.35)'); g.addColorStop(1, 'rgba(255,200,100,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _haloTex = new THREE.CanvasTexture(c); _haloTex.colorSpace = THREE.SRGBColorSpace;
  return _haloTex;
}
function buildPages() {
  const T = STRUCT.tower;
  const spots = [
    [T.x + 1.2, T.z - 1.2, T.top],                               // I   the tower top
    [PLACES.ruinsE.x + 12, PLACES.ruinsE.z + 14, null],          // II  behind the brambles
    [ISLAND.x, ISLAND.z, null],                                   // III the lake island
    [FALLS_LEDGE.x, FALLS_LEDGE.z, 'ledge'],                      // IV  the falls ledge
    [PLACES.camp.x + 2, PLACES.camp.z + 2, null],                 // V   Brigands' Rest
  ];
  // the ledge under the falls
  const lx = FALLS_LEDGE.x, lz = FALLS_LEDGE.z, ly = heightAt(lx, lz + 6) + FALLS_LEDGE.up;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(FALLS_LEDGE.w * 2, 0.8, FALLS_LEDGE.d * 2), toonMat({ color: '#8a7e6e' }));
  slab.position.set(lx, ly - 0.4, lz); slab.castShadow = slab.receiveShadow = true;
  STRUCT.group.add(slab);
  addBox(lx, lz, FALLS_LEDGE.w, FALLS_LEDGE.d, 0, ly - 30, ly, 'ledge');
  spots.forEach(([x, z, y], i) => {
    const py = y === 'ledge' ? ly : y ?? heightAt(x, z);
    // the page itself (a gently lit painting, not a lamp) and a soft halo that finds it from afar
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.55, 4, 1), toonMat({ map: pageTexture(), emissive: '#4a3c22', side: THREE.DoubleSide }));
    const pg = m.geometry.attributes.position;
    for (let k = 0; k < pg.count; k++) pg.setZ(k, Math.sin((pg.getX(k) / 0.42 + 0.5) * Math.PI) * 0.04);   // a soft curl
    m.geometry.computeVertexNormals();
    m.position.set(x, py + 1.1, z);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color('#ffd98a').multiplyScalar(1.3), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(1.5); m.add(halo);
    STRUCT.group.add(m);
    const P = { i, mesh: m, pos: new THREE.Vector3(x, py, z) };
    PAGES.push(P);
    INTERACTABLES.push({ pos: P.pos, r: 2.4, label: () => 'Pick up the page', enabled: () => !G.pages.includes(i), action: () => takePage(P) });
  });
}
function takePage(P) {
  if (G.pages.includes(P.i)) return;
  G.pages.push(P.i);
  P.mesh.visible = false;
  setPlayerState('interact'); PL.actor.once('PickUp', { speed: 1.4 });
  BUS.emit('sfx', { id: 'page' });
  say([{ s: 'Roxy\'s Textbook', t: SCRIPT.pages[P.i] + '   (' + G.pages.length + ' / 5)' }]);
  const schools = ['fire', 'fire', 'water', 'earth', 'wind'];
  const before = learnedIds();
  G.prof[schools[P.i]] = (G.prof[schools[P.i]] || 0) + 8;
  checkUnlocks(before);
  if (G.pages.length === 5) { G.maxMana += 30; G.mana = G.maxMana; setTimeout(() => toast('Roxy\'s Textbook complete — Max mana +30', 'big'), 1500); }
  autosave();
}
// The first time you come near a page that a spell will win you, a nudge.
const PAGE_HINTS = {
  1: [16, 'A thicket of thorns, and something pale caught inside. Fire would make short work of it.'],
  2: [55, 'Something glints on the island. Too deep to wade, unless the water were ice.'],
  3: [20, 'A page on a ledge under the falls, out of reach. Earth will lift whatever stands on it.'],
};
function updatePages(dt) {
  for (const P of PAGES) if (P.mesh.visible) {
    const H = PAGE_HINTS[P.i];
    if (H && G && !G.flags['ph' + P.i] && !GAME.inCave && P.pos.distanceTo(PL.body.pos) < H[0]) { G.flags['ph' + P.i] = true; hint(H[1], 6); }
    P.mesh.rotation.y += dt * 0.9;
    P.mesh.rotation.z = Math.sin(GAME.time * 1.3 + P.i) * 0.12;      // it turns and flutters on the air
    P.mesh.position.y = P.pos.y + 1.1 + Math.sin(GAME.time * 2 + P.i) * 0.1;
    P.mesh.visible = !(G && G.pages.includes(P.i));
    if (P.pos.distanceToSquared(PL.body.pos) < 60 * 60) {
      requestLight(P.mesh.position, '#f0e0b0', 1.5, 5);
      if (Math.random() < 0.1) emit(1, { pos: P.mesh.position, col: '#f0cf62', velSpread: 0.4, upBias: 0.5, life: 1, size: 0.1, bright: 2 });
    }
  }
}

/* ───────────── discovery ───────────── */
function updateDiscovery() {
  if (GAME.inCave || UI.dlg || PL.state === 'talk') return;      // no banners across a scene; it shows after
  const p = PL.body.pos;
  for (const [id, pl] of Object.entries(PLACES)) {
    if (G.discovered[id]) continue;
    if (Math.hypot(p.x - pl.x, p.z - pl.z) < pl.r) {
      G.discovered[id] = true;
      BUS.emit('place', { name: pl.name, sub: pl.sub || '' });
      gainXp(8);
    }
  }
  if (G.quest === 'road' && !GAME.inCave && Math.hypot(p.x - 786, p.z - 380) < 16) gateScene();
  if (G.quest === 'cave' && GAME.inCave) setQuest('warden');
}

/* ───────────── per-frame story ───────────── */
BUS.on('enemyKilled', e => {
  if (e.quest === 'stone' && G.quest === 'stones') {
    G.flags.stonesBroken = (G.flags.stonesBroken || 0) + 1;
    toast('Rune-stone ' + G.flags.stonesBroken + ' / 3');
    if (G.flags.stonesBroken >= 3) { npcSay(NPCS.roxy, SCRIPT.roxy2).then(() => setQuest('breakIt')); }
  }
});
BUS.on('vesselBreak', o => {
  if (o.first) setTimeout(() => splash('m_break', 'The Vessel Breaks', 'and reforms larger', 3800), 400);
  if (G.quest === 'breakIt') later(4.3, () => { if (G.quest === 'breakIt') setQuest('tellRoxy'); });
});
BUS.on('enterCave', () => { if (G.quest === 'cave') setQuest('warden'); });
// story timers run on game time: a pause (or the map) holds them
const LATER = [];
function later(sec, fn) { LATER.push({ t: sec, fn }); }
function updateStory(dt) {
  for (let i = LATER.length - 1; i >= 0; i--) if ((LATER[i].t -= dt) <= 0) { const f = LATER[i].fn; LATER.splice(i, 1); f(); }
  if (SHOT.fn && SHOT.fn(dt)) SHOT.fn = null;
  for (const n of Object.values(NPCS)) n.update(dt);
  checkSpar();
  updateDiscovery();
  updatePages(dt);
  updateRoaStory(dt);
}

/* ───────────── save / load ───────────── */
const SAVE_KEY = 'mv3d:save';
function autosave() { if (G && GAME.state === 'play') saveGame(true); }
function saveGame(quiet) {
  if (!G) return false;
  try {
    G.hour = TOD.hour;
    G.pos = [PL.body.pos.x, PL.body.pos.y, PL.body.pos.z]; G.face = PL.face;
    G.inCave = !!GAME.inCave;
    G.bossesDown = { warden: !!G.flags.warden, treant: !!G.flags.treant };
    if (typeof mapSerialize === 'function') mapSerialize();
    localStorage.setItem(SAVE_KEY, JSON.stringify(G));
    if (!quiet) toast('Saved');
    return true;
  } catch (e) { toast('Save failed', 'bad'); return false; }
}
function loadGame() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function hasSave() { return !!loadGame(); }
