/* ═══════════════════════════════════════════════════════════════════════
   CHAPTER III, part two — the Migurd village.

   Roxy's people: blue-haired, young-looking for a century, and speaking
   mind to mind (out loud only for guests). The elder takes you in; at the
   well a woman hears her daughter's name. That night by the fire Ruijerd
   tells what the Superd were made to do, and the three of you take the
   name people whisper about him — Dead End — to make it mean something
   else. In the morning: the nest, and the storm in the way.
   ═══════════════════════════════════════════════════════════════════════ */
const MIGURD_SPEC = (hair, cloth, dark, base = 'Rogue', s = 0.84) => base === 'Mage'
  ? { base: 'Mage', scale: s, recolor: { mage: { 1: hair, 8: cloth, 9: dark, 10: '#4a3a2c', 5: '#5a4632' } } }
  : { base: 'Rogue', scale: s, recolor: { rogue: { 1: hair, 8: cloth, 21: cloth, 9: dark, 6: '#9a8a6e' } } };
const MIGURD_LINES = {
  arrive: [
    { s: 'Migurd Sentry', t: '...' },
    { t: 'The sentry looks at Ruijerd for a long moment, and Ruijerd looks back, and neither of them says a word. Something is said all the same.' },
    { s: 'Migurd Sentry', t: 'Outsiders. Children, and dressed for a dance. ...Ruijerd says you are under his protection. That is enough for us.' },
    { s: 'Migurd Sentry', t: 'We speak mind to mind here; mouths are for eating, and for guests. The elder will see you. The longhouse, on the square.' },
  ],
  elder: [
    { s: 'Migurd Elder', t: 'Sit, if you like. You look like people the waste has been chewing on.' },
    { s: 'Migurd Elder', t: 'Asura? Fittoa? I know the names the way I know the names of stars. You are a very long way from either.' },
    { s: 'Migurd Elder', t: 'Ruijerd brings us the strays the waste does not eat. You are welcome to our fire tonight. Tomorrow he will tell you what lies between you and the coast — and none of it is good.' },
    { t: 'You thank him, and without quite meaning to, you mention where you learned your manners. And your magic. From a teacher with blue hair, called Roxy.' },
    { t: 'Across the square, by the well, a woman sets down her bucket.' },
  ],
  mother: [
    { s: 'Migurd Woman', t: 'Roxy. You said Roxy.' },
    { s: 'Migurd Woman', t: '...She\'s alive. Of course she\'s alive, she was always too stubborn for anything else. A TEACHER. My Roxy.' },
    { s: 'Migurd Woman', t: 'She was born without the mind-voice, you see. Everyone here could hear everyone, all the time — and she couldn\'t hear a thing. She left the year she grew tired of being lonely in a crowd.' },
    { s: 'Migurd Woman', t: 'We thought the world had eaten her. Every year we thought it a little more.' },
    { s: 'Migurd Woman', t: 'If you see her again — when you see her — tell her that her mother practises talking out loud. Every day. In case.' },
    { s: 'Migurd Woman', t: 'And give her this. I braided it the week she left. I\'ve had nobody to give it to.' },
  ],
  fire: [
    { t: 'Night in the Migurd village. The fire is small and the stars are enormous.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'Ruijerd. Is it true? What they say about Superd?' },
    { s: 'Ruijerd Superdia', t: 'That we killed children. That we went mad in the war and killed whoever stood nearest. Yes. It is true.' },
    { s: 'Ruijerd Superdia', t: 'Laplace gave our warriors spears that whispered. We fought for him with them — and then the spears fought with us. When it was over there were very few of us left, and no one left who would believe it had not been our choice.' },
    { s: 'Ruijerd Superdia', t: 'I have spent a very long time trying to make one child not afraid of me. Today, two were not. That is a good day.' },
    { t: 'You think about names. About how a name can be a curse, and how a curse is only a name until somebody decides it isn\'t.' },
    { t: 'So you tell him: our party needs a name. Let it be the one they whisper about him — Dead End — and let it come to mean the ones who turned up when nobody else would.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'Dead End. ...It sounds STRONG. I like it.' },
    { s: 'Ruijerd Superdia', t: '...Dead End. Very well. Then let us earn it.' },
  ],
  morning: [
    { s: 'Ruijerd Superdia', t: 'There is a nest under this waste, and a mother in it, and it is eating the caravans that would take you home.' },
    { s: 'Ruijerd Superdia', t: 'The weather to the north-east is foul, and the things in it are worse. The nest is on the far side. We go through anyway.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'Finally. Something to HIT.' },
  ],
};
const MIGURD_CHATTER = [
  'We talk with our minds here. It is very quiet, and very loud, at the same time.',
  'Ruijerd brings us meat in the dry season. Nobody else crosses the waste for us.',
  'The nest has eaten three caravans since the last rains. Nobody goes south-east any more.',
  'The storm on the plateau never moves. Things live inside it that should not live anywhere.',
  'You have Roxy\'s way of standing. Like you are about to explain something.',
  'Outsiders are so LOUD. Even when you are thinking.',
];
const MIG = { busy: false, arrived: false };

function buildMigurdPeople() {
  const M = DC_SPOTS.migurd, L = DC_DRESS.longhouse;
  const at = (dx, dz) => [M.x + dx, M.z + dz];
  const chat = n => async () => { if (MIG.busy) return; await npcSay(n, [{ s: n.name, t: pick(MIGURD_CHATTER) }]); };
  // the sentry at the east gate
  const g = at(40, 8);
  new NPC('migSentry', { ...MIGURD_SPEC('#4f7fd6', '#6e5e48', '#3e352c'), show: [] }, g[0], g[1], { name: 'Migurd Sentry', face: Math.PI / 2, talk: n => chat(n)() });
  // the elder, at the longhouse door
  new NPC('migElder', MIGURD_SPEC('#5a86c8', '#4a5a7a', '#2e3446', 'Mage', 0.9), L.x + 1.6, L.z + 1.4, { name: 'Migurd Elder', face: 0.1, talk: n => talkMigurdElder(n) });
  // Roxy's mother, by the well
  const w = at(-3.4, 4.6);
  new NPC('migMother', MIGURD_SPEC('#3d6fc4', '#7a6a8a', '#3a3446', 'Mage', 0.84), w[0], w[1], { name: 'Migurd Woman', face: 0.6, talk: n => talkMigurdMother(n) });
  // villagers: round the fire, at the racks, at their doors
  const folk = [
    [at(5.5, 6.5), '#4a78c8', '#7a6a52', 'Sit_Floor_Idle', -2.2], [at(0.6, 5.8), '#5a8ad6', '#6a5e4a', 'Sit_Floor_Idle', 2.6],
    [at(-8.4, 9.6), '#4572c0', '#8a7a5e', 'Use_Item', 0.4], [at(9.0, -3.4), '#5c86d0', '#6e6450', 'Interact', -0.3],
    [at(-10, -3.6), '#4f7fd6', '#7d6d55', 'Idle', 1.2], [at(14, 9), '#4a7ad0', '#6a5a46', 'Idle', -2.4],
  ];
  folk.forEach(([[x, z], hair, cloth, idle, face], i) => {
    new NPC('mig' + i, MIGURD_SPEC(hair, cloth, '#3e352c', i % 2 ? 'Mage' : 'Rogue', 0.8 + (i % 3) * 0.03), x, z, { name: 'Migurd', idle, face, talk: n => chat(n)() });
  });
  // the fire: rest here when the day's done
  INTERACTABLES.push({ pos: DC_DRESS.fire, r: 3.2, label: () => 'Rest by the fire', enabled: () => !!G && G.quest === 'dcRest' && !MIG.busy, action: () => migurdNight() });
}

async function talkMigurdElder(n) {
  if (MIG.busy) return;
  if (G.quest !== 'dcElder') return npcSay(n, [{ s: n.name, t: dcAt('dcStorm') ? 'Go carefully on the plateau. Lightning there has eyes.' : 'Rest. The fire is yours tonight.' }]);
  MIG.busy = true;
  try {
    await npcSay(n, MIGURD_LINES.elder);
    // she crosses the square to you (under a blink: the two-shot wants you both close)
    const W = NPCS.migMother, p = PL.body.pos, a = Math.atan2(W.pos.x - p.x, W.pos.z - p.z);
    setPlayerState('talk'); await fadeOut(0.35);
    const wx = p.x + Math.sin(a) * 2.2, wz = p.z + Math.cos(a) * 2.2;
    W.home = W.home || { x: W.pos.x, z: W.pos.z, face: W.baseFace };
    W.moveTo(wx, wz, Math.atan2(p.x - wx, p.z - wz));
    PL.face = a; PL.actor.root.rotation.y = a;
    await fadeIn(0.35);
    await npcSay(W, MIGURD_LINES.mother);
    W.moveTo(W.home.x, W.home.z, W.home.face);
    G.flags.migurdCharm = true;
    toast('Received — A braided Migurd charm (for Roxy)', 'good');
    gainXp(120);
    setQuest('dcRest');
  } finally { MIG.busy = false; }
}
async function talkMigurdMother(n) {
  if (MIG.busy) return;
  const line = G.flags.migurdCharm ? 'Keep it safe. And keep yourself safe — she will want to hear about all this.' : 'Welcome, outsider.';
  await npcSay(n, [{ s: n.name, t: line }]);
}

// Night by the fire, the name, and the morning
async function migurdNight() {
  if (MIG.busy) return;
  MIG.busy = true;
  try {
    setPlayerState('talk'); $('hud').classList.add('off');
    await fadeOut(1.0);
    TOD.hour = 21.6;
    const F = DC_DRESS.fire, y = F.y - 0.4;
    // round the fire: you, Eris, Ruijerd
    const seat = a => [F.x + Math.cos(a) * 2.1, F.z + Math.sin(a) * 2.1, Math.atan2(-Math.cos(a), -Math.sin(a))];
    const [px, pz, pf] = seat(1.9), [ex, ez, ef] = seat(0.5), [rx, rz, rf] = seat(3.4);
    if (ALLY.eris) ALLY.eris.leave(); if (ALLY.ruijerd) ALLY.ruijerd.leave();
    placePlayerAt(px, groundAt(px, pz, F.y + 2), pz, pf); setPlayerState('talk'); PL.actor.loop('Sit_Floor_Idle', { fade: 0 });
    const E = NPCS.eris, R = NPCS.ruijerd;
    E.setVisible(true); E.moveTo(ex, ez, ef); E.hold = true; E.actor.loop('Sit_Floor_Idle', { fade: 0 });
    R.setVisible(true); R.moveTo(rx, rz, rf); R.hold = true; R.actor.loop('Sit_Floor_Idle', { fade: 0 });
    MIG.fireOn = true;
    const wide = { pos: new THREE.Vector3(F.x + 5.5, y + 2.6, F.z - 4.2), look: new THREE.Vector3(F.x, y + 0.2, F.z + 0.4), fov: 40 };
    // close shots from the side (not across the flames: the sparks would fill the lens)
    const side = (x, z, f, k) => ({ pos: new THREE.Vector3(x + Math.sin(f + k) * 2.5, y + 1.0, z + Math.cos(f + k) * 2.5), look: new THREE.Vector3(x, y + 0.45, z), fov: 36 });
    const rui = side(rx, rz, rf, 1.0), eris = side(ex, ez, ef, -1.0);
    CAM.override = wide; CAM.ovBlend = 1; letterbox(true);
    await fadeIn(1.4);
    const cams = [wide, eris, rui, rui, rui, wide, wide, eris, rui];
    await say(say$(MIGURD_LINES.fire).map((L, i) => ({ ...L, cam: cams[i] || wide })), { cam: wide });
    G.flags.deadEnd = true;
    setPlayerState('talk'); $('hud').classList.add('off'); letterbox(true);
    await splash('m_deadend', 'Dead End', 'Three of you, and a long way home', 3800);
    await fadeOut(1.2);
    // morning
    TOD.hour = 7.4; MIG.fireOn = false;
    for (const n of [E, R]) { n.actor.loop('Idle', { fade: 0 }); }
    PL.actor.loop('Idle', { fade: 0 });
    const M = DC_SPOTS.migurd, mx = M.x + 26, mz = M.z + 4;
    placePlayerAt(mx, groundAt(mx, mz, 999), mz, Math.PI / 2); setPlayerState('talk');
    E.moveTo(mx + 1.4, mz + 2.2, -1.2); R.moveTo(mx + 2.6, mz - 1.0, -1.9);
    G.lastWaystone = 'dcMigurd'; G.waystones.dcMigurd = true;
    const shot = { pos: new THREE.Vector3(mx + 6.2, groundAt(mx, mz, 999) + 1.3, mz + 2.4), look: new THREE.Vector3(mx + 1.2, groundAt(mx, mz, 999) + 0.7, mz + 0.4), fov: 40 };
    CAM.override = shot;
    await fadeIn(1.4);
    await say(say$(MIGURD_LINES.morning), { cam: shot });
    E.setVisible(false); R.setVisible(false); E.hold = R.hold = false;
    G.flags.erisWith = true; G.flags.ruiWith = true;
    ALLY.eris.join(); ALLY.ruijerd.join();
    CAM.override = null; letterbox(false); setPlayerState('move'); $('hud').classList.remove('off');
    setQuest('dcStorm');
  } finally { MIG.busy = false; }
}

function updateMigurd(dt) {
  if (!G || !DEMON.built) return;
  const M = DC_SPOTS.migurd, p = PL.body.pos;
  // the fire burns every night (and through the scene)
  if (DC_DRESS.fire && (MIG.fireOn || SKY_NOW.night > 0.3) && Math.hypot(p.x - M.x, p.z - M.z) < 120) {
    requestLight(DC_DRESS.fire, '#ff9a4a', 5 + Math.sin(GAME.time * 9) * 0.6, 12);
    if (Math.random() < 0.5) emit(1, { pos: DC_DRESS.fire, col: '#ffb060', col2: '#ff5a20', vel: { x: 0, y: 1.6, z: 0 }, velSpread: 0.5, spread: 0.3, life: 0.8, size: 0.16, bright: 2 });
  }
  if (G.quest === 'dcMigurd' && !MIG.busy && !UI.dlg && PL.state === 'move' && Math.hypot(p.x - M.x, p.z - M.z) < 52) migurdArrive();
}
async function migurdArrive() {
  MIG.busy = true;
  try {
    const S = NPCS.migSentry;
    await npcSay(S, MIGURD_LINES.arrive);
    setQuest('dcElder');
  } finally { MIG.busy = false; }
}
// called from resetDemonState: who stands where for the step you're on
function resetMigurdState() {
  MIG.busy = false; MIG.fireOn = false;
  if (G.quest === 'dcRest' || G.quest === 'dcElder') G.lastWaystone = G.lastWaystone && G.lastWaystone.startsWith('dc') ? G.lastWaystone : 'dcWake';
}
