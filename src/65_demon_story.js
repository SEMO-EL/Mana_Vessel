/* ═══════════════════════════════════════════════════════════════════════
   CHAPTER III — THE DISPLACED.  Part one: the light, the dream, the waste.

   After the birthday the light still hangs over the east ('done'). Face it
   from the Boreas terrace — or take the endcard's "Into Chapter III" — and
   it opens: white, then a white place with a god in it whose face you
   can't hold onto, then a red dawn on the Demon Continent with Eris
   breathing beside you. Black wolves; a spear out of nowhere; a Superd.
   He walks you north to the Migurd (part two: 66_demon_village.js).

   Step order: done → dcWake → dcSurvive → dcMigurd → dcElder → dcRest →
   dcStorm → dcNest → dcBoss → dcDone. A save in any dc* step raises the
   waste at boot (savedInDemon) and resetDemonState() sets the scene.
   ═══════════════════════════════════════════════════════════════════════ */
const DC_STEPS = ['dcWake', 'dcSurvive', 'dcMigurd', 'dcElder', 'dcRest', 'dcStorm', 'dcNest', 'dcBoss', 'dcDone'];
for (const s of DC_STEPS) DC_QUESTS.add(s);
const dcAt = id => DC_STEPS.indexOf(G.quest) >= DC_STEPS.indexOf(id);      // this step or past it

// after the birthday: the light is still there, and the terrace is where you face it
{
  const q = QUEST.find(q => q.id === 'done');
  q.title = 'The Displaced';
  q.text = 'The light still hangs over the east. When you are ready to leave Fittoa behind, face it from the Boreas terrace.';
  q.at = () => ROA.spots.terrace;
}
QUEST.push(
  { id: 'dcWake',    title: 'The Displaced', text: 'Wake Eris.', at: () => NPCS.eris && NPCS.eris.pos },
  { id: 'dcSurvive', title: 'The Displaced', text: 'Survive.', at: null },
  { id: 'dcMigurd',  title: 'Dead End',      text: 'Follow the caravan track north to the Migurd village.', at: () => ({ x: 368, z: 1606 }) },
  { id: 'dcElder',   title: 'Dead End',      text: 'Speak with the Migurd elder, in the longhouse on the square.', at: () => NPCS.migElder && NPCS.migElder.pos },
  { id: 'dcRest',    title: 'Dead End',      text: 'Rest by the fire in the Migurd village.', at: () => DC_DRESS.fire },
  { id: 'dcStorm',   title: 'The Storm Front', text: 'Cross the storm plateau to the north-east. The nest is on the far side.', at: () => ({ x: 1160, z: 1740 }) },
  { id: 'dcNest',    title: 'The Sand Mother', text: 'Find the nest, in the sand bowl south of the plateau.', at: () => ({ x: DC_SPOTS.nest.x, z: DC_SPOTS.nest.z }) },
  { id: 'dcBoss',    title: 'The Sand Mother', text: 'Kill it.', at: null },
  { id: 'dcDone',    title: 'Dead End',      text: 'The caravans can run again. Chapter IV comes next.', at: null },
);

/* ───────────── the waste's wolves ───────────── */
{
  const W = ENEMY_DEFS.wolf;
  ENEMY_DEFS.bwolf = { ...W, name: 'Black Wolf', tint: '#24212a', eye: '#ff4a3a', hp: 105, poise: 34, xp: 34, sight: 28, hear: 16, run: 9.4,
    attacks: [{ ...W.attacks[0], dmg: 16, poise: 22 }, { ...W.attacks[1], dmg: 24, poise: 38 }] };
}

/* ───────────── Ruijerd ───────────── */
// the jewel in his forehead (the Superd's third eye), and a white spear
const superdJewel = a => {
  const head = a.bones.head; if (!head) return;
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3a3a').multiplyScalar(2.2) }));
  m.scale.set(1, 1.35, 0.6); m.position.set(0, 0.64, 0.45); head.add(m);
};
const spearInHand = a => {
  const hand = a.bones.handslotr; if (!hand) return;
  const g = new THREE.Group(), shaftM = toonMat({ color: '#e6e0d2' }), steel = toonMat({ color: '#a7b2bc', rim: true }), wrap = toonMat({ color: '#3e3630' });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 2.5, 6), shaftM); shaft.position.y = 0.45; g.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 4), steel); tip.position.y = 1.91; g.add(tip);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 6), wrap); collar.position.y = 1.66; g.add(collar);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.34, 6), wrap); grip.position.y = 0.05; g.add(grip);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.rotation.z = Math.PI / 2;                 // the slot's −X is up in the idle grip: the spear stands upright
  hand.add(g);
};
const RUIJERD_SPEC = { base: 'Rogue', scale: 1.12,
  recolor: { rogue: { 1: '#2f9e6a', 0: '#e3cdb4', 23: '#e3cdb4', 8: '#c8bfa8', 21: '#c8bfa8', 9: '#4a4440', 6: '#5e5248' } },
  extra: [superdJewel, spearInHand] };
const RUIJERD_BARKS = {
  engage: ['Stay behind me.', 'I see it.', 'Hold your ground.', 'Children first. Then me.'],
  kill: ['Next.', 'It will not rise.', 'Done.', 'Clean.'],
  hurt: ['{name}. Heal yourself. Now.', 'Fall back to me.', 'Do not be proud. Heal.'],
  idle: ['The waste is quiet. It is never quiet for long.', 'Eris. Your guard is too high again.', 'Drink when you can. Out here you do not always get to.',
    'My third eye sees what moves behind the rocks. Nothing, for now.', 'You walk well, for a mage.'],
  steel: ['Steel is wasted on it. Your magic, {name}.'],
  vessel: ['...Get up. You always get up.', 'A mage\'s courage. Or a mage\'s foolishness. Get up.'],
  chest: ['Take what you need. The dead do not mind.'],
};
const RUIJERD_FIRSTS = {
  bwolf: 'Black wolves hunt in threes. Count them, then count again.',
  ogre: 'An ogre. Slow, and strong enough that slow does not matter. Do not stand in front of it.',
  stormWisp: 'Storm spirits. Lightning with a grudge. Magic unmakes them; my spear only annoys them.',
  rustScorp: 'Rock scorpions. The sting first, then the rest.',
};
const RUIJERD_OPTS = { barks: RUIJERD_BARKS, firsts: RUIJERD_FIRSTS, sawKey: 'ruiSaw_', side: -1, noRide: true,
  clips: ['2H_Melee_Attack_Stab', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spin'], dmgMul: 1.6, reach: 2.3, hitReach: 3.3 };

/* ───────────── what's said ───────────── */
const DC_LINES = {
  terrace: [
    { t: 'The terrace, at night. Below, Roa is asleep. Over the east, the light is still there — closer, now. Waiting.' },
    { t: 'You know, the way you know a step is missing in the dark, that once you look straight at it, Fittoa will be behind you for a long time.' },
  ],
  dream: [
    { t: 'White. No floor, no sky, no sound — and you, standing in it.' },
    { t: 'Not quite you. Older. Heavier. A body you had spent ten years trying to forget.' },
    { p: 'hitogami', s: '???', t: 'Ah — you\'re awake! Well. You\'re not, actually. But you know what I mean.' },
    { p: 'hitogami', s: '???', t: 'Don\'t strain your eyes on my face. Nobody manages it. Call me Hitogami — the Man-God. The god of people. Your god, if you like.' },
    { p: 'hitogami', s: 'Hitogami', t: 'Something enormous just happened to Fittoa, and you were standing in the middle of it. I\'m afraid you\'ve been... moved.' },
    { p: 'hitogami', s: 'Hitogami', t: 'Far. The Demon Continent. Red sky, hungry things, a very long walk home.' },
    { p: 'hitogami', s: 'Hitogami', t: 'So here is some advice, free of charge. When you wake, a Superd will come. Trust him. Help him. Do that, and you will get home.' },
    { p: 'hitogami', s: 'Hitogami', t: 'That\'s all! Off you go. And {name} — do try to enjoy yourself.' },
    { t: 'You don\'t trust a face you can\'t see. You don\'t, at this moment, have much choice.' },
  ],
  wake: [
    { t: 'Red.' },
    { t: 'A red sky. Red dust in your mouth. Ground that is warm the way ground in Fittoa never is.' },
    { t: 'You are alive. Three steps away, Eris is breathing. Everything else you had a moment ago is gone.' },
  ],
  erisWake: [
    { p: 'eris', s: 'Eris Boreas Greyrat', t: '...Mm. {name}? Why are you — where — ' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'This isn\'t the terrace. This isn\'t ANYWHERE. Why is the sky that colour?!' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'Grandfather. Ghislaine. The house — {name}, where IS everyone?' },
    { t: 'You don\'t have an answer. Out in the dust something howls, and something else answers it.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'Fine. FINE. Questions later. Stay behind me!' },
  ],
  move: [
    { p: 'ruijerd2', s: '???', t: 'Move.' },
    { t: 'The spear takes the wolf out of the air before you see the man who threw it. Green hair. A jewel set in his forehead, like a third eye. A race whose name empties a street.' },
  ],
  ruijerd: [
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'A — a SUPERD. {name}, get behind me. Grandfather says they eat children. He says it EVERY winter.' },
    { p: 'ruijerd2', s: 'Ruijerd Superdia', t: 'Superd. Yes. You may run. Most do.' },
    { t: 'Somewhere behind your eyes, a man with no face says: trust him.' },
    { p: 'ruijerd2', s: 'Ruijerd Superdia', t: '...You did not run.' },
    { p: 'ruijerd2', s: 'Ruijerd Superdia', t: 'Two children, alone in the Red Waste, dressed for a party. I do not know how you came here. I know you will not leave it alone.' },
    { p: 'ruijerd2', s: 'Ruijerd Superdia', t: 'I am Ruijerd. North of here live the Migurd. They will feed you, and they will not scream at me. Follow the track; I will walk behind.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: '...If he eats us, I\'m blaming you.' },
  ],
};
// the terrace: where you face the light (placed once Roa exists; see resetDemonState)
const DC_TERRACE = new THREE.Vector3(1e9, 0, 1e9);
INTERACTABLES.push({ pos: DC_TERRACE, r: 3.2, label: () => 'Face the light — begin Chapter III',
  enabled: () => !!G && G.quest === 'done' && GAME.state === 'play' && !DCS.busy, action: () => faceTheLight(false) });
const say$ = lines => lines.map(L => ({ ...L, t: L.t.replace(/\{name\}/g, G.name) }));
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ───────────── the dream: a white place, and a god without a face ───────────── */
var DREAM = { on: false, group: null, at: new THREE.Vector3(750, 900, 1800), god: null, tex: null, cv: null, t: 0, black: null };
function mosaicFace(a) {
  const head = a.bones.head; if (!head) return;
  const cv = document.createElement('canvas'); cv.width = cv.height = 8;
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.84), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(0.04, 0.42, 0.55); head.add(m);
  DREAM.cv = cv; DREAM.tex = tex; paintMosaic();
}
// the face: blocks of skin and shadow that never settle into features
function paintMosaic() {
  if (!DREAM.cv) return;
  const c = DREAM.cv.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = 150 + Math.random() * 90, w = Math.random() < 0.18 ? 0.55 : 1;
    c.fillStyle = `rgb(${Math.round(v * w)},${Math.round(v * 0.88 * w)},${Math.round(v * 0.8 * w)})`; c.fillRect(x, y, 1, 1);
  }
  DREAM.tex.needsUpdate = true;
}
const HITOGAMI_SPEC = { base: 'Mage', recolor: { mage: { 1: '#efe9df', 8: '#f4f1ea', 9: '#dcd6cc', 10: '#c9c2b4', 5: '#bdb6a8' } }, extra: [mosaicFace] };
function buildDream() {
  const A = DREAM.at, g = new THREE.Group(); g.position.copy(A);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(70, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f6f3ec'), side: THREE.BackSide, fog: false })));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), toonMat({ color: '#f1ede4' }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  g.visible = false; scene.add(g);
  addCollider({ kind: 'circle', x: A.x, z: A.z, r: 38, y0: A.y - 3, y1: A.y, tag: 'dream' });
  DREAM.group = g;
  DREAM.god = new Actor(HITOGAMI_SPEC);
  DREAM.god.root.visible = false; scene.add(DREAM.god.root);
  DREAM.black = new THREE.MeshBasicMaterial({ color: new THREE.Color('#121014'), fog: false });
}
// you, as you were: a dark shape with your outline
function silhouette(on) {
  PL.actor.root.traverse(o => {
    if (!o.isMesh) return;
    if (on) { if (!o.userData.mat0) { o.userData.mat0 = o.material; o.material = DREAM.black; } }
    else if (o.userData.mat0) { o.material = o.userData.mat0; delete o.userData.mat0; }
  });
}
// while dreaming the light is the white's: called at the end of updateSky
function dreamLighting() {
  SUN.color.set('#ffffff'); SUN.intensity = 1.5;
  HEMI.color.set('#ffffff'); HEMI.groundColor.set('#d8d2c8'); HEMI.intensity = 1.5;
  WFOG.wfColor.value.set('#f6f3ec'); WFOG.wfParams.value.x = 0.002;
  if (gradePass) { gradePass.uniforms.uLift.value.set(0, 0, 0); gradePass.uniforms.uGain.value.set(1, 1, 1); }
  renderer.toneMappingExposure = 1;
}
async function hitogamiDream() {
  if (!DREAM.group) buildDream();
  const A = DREAM.at, god = DREAM.god;
  DREAM.group.visible = true; DREAM.on = true;
  placePlayerAt(A.x, A.y + 0.05, A.z + 2.6, Math.PI);
  setPlayerState('talk'); PL.actor.loop('Idle', { fade: 0 });
  silhouette(true);
  god.root.position.set(A.x, A.y, A.z - 1.4); god.root.rotation.y = 0; god.root.visible = true; god.loop('Idle', { fade: 0 });
  // (the dialogue box owns the bottom of the screen: every shot aims low, so faces sit in the upper half)
  const two = { pos: new THREE.Vector3(A.x + 5.2, A.y + 1.8, A.z + 2.2), look: new THREE.Vector3(A.x, A.y + 0.7, A.z + 0.6), fov: 40 };
  const back = { pos: new THREE.Vector3(A.x - 1.2, A.y + 1.7, A.z + 5.4), look: new THREE.Vector3(A.x, A.y + 0.75, A.z - 1.2), fov: 38 };
  const face = { pos: new THREE.Vector3(A.x + 0.9, A.y + 1.2, A.z + 1.0), look: new THREE.Vector3(A.x, A.y + 0.72, A.z - 1.4), fov: 34 };
  CAM.override = back; CAM.ovBlend = 1; letterbox(true); $('hud').classList.add('off');
  await fadeIn(1.8);
  const cams = [back, back, face, face, two, two, face, two, back];
  await say(say$(DREAM_LINES()).map((L, i) => ({ ...L, cam: cams[i] || two })), { cam: back });
  setPlayerState('talk'); $('hud').classList.add('off'); letterbox(true);
  god.once('Spellcast_Raise', { fade: 0.2 });
  await whiteOut(1.6);
  DREAM.on = false; DREAM.group.visible = false; god.root.visible = false; silhouette(false);
}
const DREAM_LINES = () => DC_LINES.dream;
function updateDream(dt) {
  if (!DREAM.on) return;
  DREAM.t += dt;
  if (DREAM.t > 0.11) { DREAM.t = 0; paintMosaic(); }
  DREAM.god.update(dt);
  // (the god turns to you; you were facing it already)
  const p = PL.body.pos, g = DREAM.god.root;
  g.rotation.y = dampAngle(g.rotation.y, Math.atan2(p.x - g.position.x, p.z - g.position.z), 4, dt);
}

/* ───────────── the light opens ───────────── */
const DCS = { busy: false, wolves: [], killed: 0, ruiDone: false };
// from the terrace (quest 'done'), or straight from the endcard (the screen's already white)
async function faceTheLight(fromEndcard = false) {
  if (DCS.busy) return;
  DCS.busy = true;
  try {
    GAME.state = 'play';
    setPlayerState('talk'); $('hud').classList.add('off');
    if (!fromEndcard) {
      // the light again, closer; then it opens, for good
      await fadeOut(0.8);
      TOD.hour = 22.6;
      const tx = ROA.spots.terrace.x, tz = ROA.spots.terrace.z, yt = heightAt(tx, tz);
      placePlayerAt(tx, floorAt(tx, tz + 0.5), tz + 0.5, Math.PI / 2);
      setPlayerState('talk');
      OMEN.reset(); OMEN.dim = false; OMEN.start(new THREE.Vector3(tx, yt, tz));
      const sky = { pos: new THREE.Vector3(tx - 3.15, yt + 0.35, tz + 0.54), look: new THREE.Vector3(tx + 44.2, yt + 14.1, tz - 7.6), fov: 40 };
      CAM.override = sky; CAM.ovBlend = 1; letterbox(true);
      await fadeIn(1.0);
      await say(say$(DC_LINES.terrace), { cam: sky });
      setPlayerState('talk'); $('hud').classList.add('off'); CAM.override = sky; letterbox(true);
      OMEN.burst(); BUS.emit('sfx', { id: 'break' }); shake(0.8);
      await whiteOut(2.2);
    } else {
      const e = fadeEl(); e.style.transition = 'none'; e.style.background = '#ffffff'; e.style.opacity = 1;
    }
    closeAllScreens(); GAME.state = 'play';
    // under the white: the world you knew goes quiet, and the waste is raised
    OMEN.reset();
    if (ALLY.eris) ALLY.eris.leave();
    horseStandDown();
    for (const e of [...ENT.enemies]) e.remove();
    for (const enc of ENCOUNTERS) { enc.active = false; enc.live = []; }
    await buildDemonLand();
    // the chapter card (it sits under the white: lift the white off it, and put it back as the card goes)
    const card = splash('ch3', 'Chapter III', 'The Displaced', 4200), fe = fadeEl();
    fe.style.transition = 'opacity 0.7s ease'; fe.style.opacity = 0;
    await card;
    fe.style.transition = 'none'; fe.style.background = '#ffffff'; fe.style.opacity = 1;
    await hitogamiDream();
    await wakeInTheWaste();
  } finally { DCS.busy = false; }
}

/* ───────────── waking ───────────── */
async function wakeInTheWaste() {
  const W = DC_SPOTS.wake, px = W.x + 4, pz = W.z - 4;
  TOD.hour = 7.8; TOD.frozen = false;
  Object.assign(WEATHER.cur, WEATHER_STATES.clear); Object.assign(WEATHER.tgt, WEATHER_STATES.clear); WEATHER.timer = 200;
  REGION.k = 1; REGION.wasDC = true;
  placePlayerAt(px, groundAt(px, pz, 999), pz, -2.4);
  setPlayerState('talk'); PL.actor.loop('Lie_Idle', { fade: 0 });
  dcLayErisDown(px, pz);
  G.lastWaystone = 'dcWake'; G.flags.dc = true; G.flags.erisWith = false; G.flags.ruiWith = false;
  DCS.killed = 0; DCS.wolves = []; DCS.ruiDone = false;
  setQuest('dcWake', { quiet: true });
  const y = PL.body.pos.y;
  const high = { pos: new THREE.Vector3(px - 3.5, y + 6.5, pz + 7.5), look: new THREE.Vector3(px + 1.2, y - 0.6, pz + 0.6), fov: 46 };
  const low = { pos: new THREE.Vector3(px + 5.5, y + 1.0, pz + 5.2), look: new THREE.Vector3(px + 1.2, y + 0.1, pz + 0.6), fov: 40 };
  CAM.override = high; CAM.ovBlend = 1; letterbox(true); $('hud').classList.add('off');
  // the white burns off into a red dawn
  const e = fadeEl(); e.style.transition = 'opacity 3s ease-out'; e.style.opacity = 0;
  await wait(3100); e.style.background = '';
  await say(DC_LINES.wake.map((L, i) => ({ ...L, cam: i ? low : high })), { cam: high });
  setPlayerState('talk'); $('hud').classList.add('off'); letterbox(true); CAM.override = low;
  PL.actor.once('Lie_StandUp', { fade: 0.2 });
  await wait(1700);
  CAM.override = null; letterbox(false);
  setPlayerState('move'); PL.actor.loop('Idle', { fade: 0.3 });
  $('hud').classList.remove('off');
  const q = questStep(); toast(q.title, 'big'); later(0.7, () => toast(q.text));
  autosave();
}
function dcLayErisDown(px, pz) {
  const E = NPCS.eris;
  E.setVisible(true); E.moveTo(px + 2.4, pz + 1.4, 1.2); E.hold = true;
  E.actor.loop('Lie_Idle', { fade: 0 });
}

// Talking to Eris on the waste (the rest of the time she's at your shoulder)
async function dcTalkEris(n) {
  if (G.quest !== 'dcWake' || DCS.busy) return;
  DCS.busy = true;
  try {
    n.actor.once('Lie_StandUp', { fade: 0.2 });
    await wait(1500);
    n.actor.loop('Idle', { fade: 0.3 });
    await npcSay(n, say$(DC_LINES.erisWake));
    // she draws; they come out of the dust
    n.setVisible(false);
    G.flags.erisWith = true;
    if (!ALLY.eris) ALLY.eris = new Companion(ERIS_SPEC, 'Eris', '#e8606f');
    ALLY.eris.join();
    ALLY.eris.pos.set(n.pos.x, n.pos.y, n.pos.z); ALLY.eris.actor.root.position.copy(n.pos);
    setQuest('dcSurvive');
    dcSpawnWolves(3);
    hint('Black wolves. Keep Eris close — and keep your distance.', 4);
  } finally { DCS.busy = false; }
}
function dcSpawnWolves(n) {
  const p = PL.body.pos;
  for (let i = 0; i < n; i++) {
    const a = 0.55 + (i - 1) * 0.35, x = p.x + Math.cos(a) * 26, z = p.z - Math.sin(a) * 26;
    const e = new Enemy('bwolf', x, z, { face: Math.atan2(p.x - x, p.z - z) });
    e.dcWolf = true;                     // (counted by the enemyKilled listener below — onDeath is the Enemy's own)
    alertEnemy(e, true);
    DCS.wolves.push(e);
  }
}

BUS.on('enemyKilled', e => { if (e.dcWolf) DCS.killed++; });

/* ───────────── the Superd ───────────── */
async function ruijerdArrives() {
  if (DCS.ruiDone || DCS.busy) return;
  DCS.busy = true; DCS.ruiDone = true;
  try {
    const live = DCS.wolves.filter(e => !e.dead && !e.removed);
    const p = PL.body.pos;
    // he comes from the west, out of the low sun
    const R = NPCS.ruijerd, rx = p.x - 5, rz = p.z + 3;
    await say(say$(DC_LINES.move.slice(0, 1)));
    R.moveTo(rx, rz, Math.atan2(p.x - rx, p.z - rz)); R.setVisible(true); R.hold = true;
    R.actor.once('2H_Melee_Attack_Spin', { speed: 1.2, fade: 0.05, onEnd: () => R.actor.loop('Idle', { fade: 0.2 }) });
    BUS.emit('sfx', { id: 'crit' }); shake(0.35);
    for (const e of live) { killEnemy(e); emit(14, { pos: e.lockPoint().clone(), col: '#e8e0d0', spread: 0.3, velSpread: 4, life: 0.5, size: 0.14, bright: 1.5 }); }
    await wait(500);
    // in front of him, a little to the side, aimed low (his face in the upper half, above the dialogue)
    const f = R.face, y = heightAt(rx, rz);
    const shot = { pos: new THREE.Vector3(rx + Math.sin(f) * 3.2 + Math.cos(f) * 1.1, y + 1.25, rz + Math.cos(f) * 3.2 - Math.sin(f) * 1.1), look: new THREE.Vector3(rx, y + 0.8, rz), fov: 36 };
    await say(say$(DC_LINES.move.slice(1)), { cam: shot });
    if (ALLY.eris) { ALLY.eris.leave(); NPCS.eris.setVisible(true); NPCS.eris.moveTo(p.x + 1.6, p.z + 1.2, Math.atan2(rx - p.x - 1.6, rz - p.z - 1.2)); NPCS.eris.hold = true; NPCS.eris.actor.loop('2H_Melee_Idle', { fade: 0.2 }); }
    await npcSay(R, say$(DC_LINES.ruijerd));
    // the three of you
    R.setVisible(false); NPCS.eris.setVisible(false); NPCS.eris.hold = false;
    G.flags.erisWith = true; G.flags.ruiWith = true;
    if (!ALLY.eris) ALLY.eris = new Companion(ERIS_SPEC, 'Eris', '#e8606f');
    ALLY.eris.join();
    if (!ALLY.ruijerd) ALLY.ruijerd = new Companion(RUIJERD_SPEC, 'Ruijerd', '#6fce8a', RUIJERD_OPTS);
    ALLY.ruijerd.join(); ALLY.ruijerd.pos.copy(R.pos); ALLY.ruijerd.actor.root.position.copy(R.pos);
    setQuest('dcMigurd');
    later(4, () => hint('Ruijerd walks behind. Follow the caravan track north.', 4));
  } finally { DCS.busy = false; }
}

/* ───────────── each frame ───────────── */
function updateDemonStory(dt) {
  updateDream(dt);
  if (!G || DCS.busy || UI.dlg) return;
  if (G.quest === 'dcSurvive' && !DCS.ruiDone && PL.state !== 'dead') {
    const live = DCS.wolves.filter(e => !e.dead && !e.removed);
    // a fall (or a reload) cleared the field: bring back the ones still owed
    if (!live.length && DCS.killed < 2) { DCS.wolves = []; dcSpawnWolves(3 - DCS.killed); }
    else if (DCS.killed >= 2 || G.hp < G.maxHp * 0.35) ruijerdArrives();
  }
}

/* ───────────── people, and state on load ───────────── */
function buildDemonPeople() {
  const W = DC_SPOTS.wake;
  new NPC('ruijerd', RUIJERD_SPEC, W.x, W.z, { name: 'Ruijerd', idle: 'Idle' });
  NPCS.ruijerd.setVisible(false);
  // Eris on the waste: her Roa talks stay hers; over here, these
  const roaTalk = NPCS.eris.talk;
  NPCS.eris.talk = n => DC_QUESTS.has(G.quest) ? dcTalkEris(n) : roaTalk(n);
  if (typeof buildMigurdPeople === 'function') buildMigurdPeople();
}
// called by resetWorldState (after resetRoaState): the waste as the step needs it
function resetDemonState() {
  DCS.busy = false;
  if (ROA.spots && ROA.spots.terrace) { const T = ROA.spots.terrace; DC_TERRACE.set(T.x, floorAt(T.x, T.z), T.z); }
  if (DREAM.on) { DREAM.on = false; DREAM.group.visible = false; DREAM.god.root.visible = false; silhouette(false); }
  if (G.quest === 'done') { OMEN.reset(); dcShowOmen(); }
  if (!DC_QUESTS.has(G.quest)) { if (ALLY.ruijerd) ALLY.ruijerd.leave(); return; }
  if (!DEMON.built) return;                                   // (raised at boot for a save over here)
  OMEN.reset();
  if (NPCS.ruijerd) NPCS.ruijerd.setVisible(false);
  if (G.quest === 'dcWake') {
    const W = DC_SPOTS.wake; dcLayErisDown(W.x + 4, W.z - 4);
    if (ALLY.eris) ALLY.eris.leave();
  } else NPCS.eris.setVisible(false);
  if (G.quest === 'dcSurvive') { DCS.wolves = []; DCS.killed = 0; DCS.ruiDone = false; }
  else DCS.ruiDone = dcAt('dcMigurd');
  if (G.flags.ruiWith) {
    if (!ALLY.ruijerd) ALLY.ruijerd = new Companion(RUIJERD_SPEC, 'Ruijerd', '#6fce8a', RUIJERD_OPTS);
    ALLY.ruijerd.join();
  } else if (ALLY.ruijerd) ALLY.ruijerd.leave();
  if (typeof resetMigurdState === 'function') resetMigurdState();
  if (typeof resetDemonSide === 'function') resetDemonSide();
}
// while the light waits for you: a violet star low over the east, from anywhere in Fittoa
function dcShowOmen() {
  if (!ROA.spots || !ROA.spots.terrace) return;
  const T = ROA.spots.terrace;
  OMEN.start(new THREE.Vector3(T.x, heightAt(T.x, T.z), T.z)); OMEN.dim = true;
}
