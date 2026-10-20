/* ═══════════════════════════════════════════════════════════════════════
   THE NIGHT ROAD — the kidnapping, early in Chapter II.

   Eris punches her new tutor, refuses her lessons and storms out past the
   west gate at dusk. You go after her; a sack comes down over both your
   heads. You wake in a shed at an old farmstead north of the city, ringed
   by a fence, guarded by hired thugs and the man who means to sell you.

   Get her out however you like. Guards don't know at once: a "?" fills
   over their heads while they can see or hear you, and only a full one
   raises the alarm. Strike one who hasn't noticed you from behind and he
   drops without a sound. Or don't bother being quiet. Either way it ends
   with Ghislaine on the road, and the next morning Eris is different.
   ═══════════════════════════════════════════════════════════════════════ */
const KID = {
  H: { x: 1280, z: -80 }, R: 26, exitR: 44,
  built: false, active: false, detected: false, busy: false, fightT: 0,
  meet: { x: 1404, z: 385 },          // outside Roa's west gate, on the road
  enc: null, shed: null, planks: null, gate: null, f: null, r: null,
};
const KID_HP = 0.75;   // the thugs are hired muscle, not soldiers

ENEMY_DEFS.thug = {
  ...ENEMY_DEFS.bandit, name: 'Hired Thug', suspicious: true, sight: 13, hear: 7, xp: 30,
  hp: Math.round(ENEMY_DEFS.bandit.hp * KID_HP),
  recolor: { rogue: { 9: '#2a2622', 8: '#3c3530', 6: '#4a4238', 21: '#3c3530' } },
};
ENEMY_DEFS.broker = {
  ...ENEMY_DEFS.bandit, name: 'Harrow, the Broker', suspicious: true, sight: 14, hear: 8, xp: 90,
  hp: 170, poise: 55, weight: 1.4, flinchAt: 18,
  recolor: { rogue: { 9: '#4a1f24', 8: '#5a2a2a', 6: '#6a4a3a', 21: '#5a2a2a' } },
};
const ERIS_UNARMED = { ...ERIS_SPEC, extra: [] };

// quest steps, between meeting Eris and Ghislaine's yard
QUEST.splice(QUEST.findIndex(q => q.id === 'ghislaine'), 0,
  { id: 'followEris', title: 'The Night Road', text: 'Eris has stormed off past the west gate at dusk. Bring her back before she finds trouble.', at: () => KID.meet },
  { id: 'escape',     title: 'The Night Road', text: 'Get yourself and Eris out of the farmstead — quietly, or not.', at: () => KID.active ? KID.gate : null },
);
ROA_STEPS.splice(ROA_STEPS.indexOf('ghislaine'), 0, 'followEris', 'escape');

const KID_LINES = {
  storm: [
    { t: 'She punches you. Ghislaine was right.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'That one was for being short. And I am NOT having lessons. I\'m going out — and don\'t you DARE follow me!' },
    { t: 'She storms off across the forecourt and out toward the west gate, as the light starts to go.' },
    { s: 'Sauros Boreas Greyrat', t: 'TUTOR! She\'s run off past the gate — at THIS hour! Bring her back!' },
  ],
  ambush: [
    { t: 'Eris stands on the road with her back to the city, arms folded, glaring at nothing.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'I TOLD you not to—' },
    { t: 'A sack comes down over your head. A hand clamps over your mouth. Eris screams — and then she doesn\'t.' },
  ],
  wake: [
    { t: 'You come to on cold straw. Dark. A shed — moonlight through the gaps in the boards, men talking outside, a fire crackling.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'Where ARE we?! When Grandfather finds out, he\'ll — he\'ll —' },
    { t: 'Her voice is shaking. They took her sword. They didn\'t think to take your magic.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: '...You\'re a mage. Do something. Please.' },
  ],
  quiet: [
    { p: 'ghislaine', s: 'Ghislaine Dedoldia', t: 'There you are. I followed the cart tracks — and you are already out. Past all of them. With her.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'He — he got us out. They didn\'t even SEE us. He just... walked us out.' },
    { p: 'ghislaine', s: 'Ghislaine Dedoldia', t: 'Wait here. I will go and have a word with them.' },
    { t: 'She goes. There is not much noise, and it does not last long.' },
  ],
  loud: [
    { p: 'ghislaine', s: 'Ghislaine Dedoldia', t: 'I heard the fighting from the road.' },
    { t: 'She does not draw so much as arrive, and the last of them are on the ground.' },
    { p: 'ghislaine', s: 'Ghislaine Dedoldia', t: 'You kept her behind you. Good. That is the whole of the lesson, most days.' },
  ],
  after: [
    { p: 'eris', s: 'Eris Boreas Greyrat', t: '...Rudeus.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'Thank you. — Don\'t make that face! I\'ll take your stupid lessons. ALL of them. Reading and everything.' },
  ],
  morning: [
    { t: 'Morning. The estate has been awake all night; Lord Sauros has shouted at most of it.' },
    { t: 'Nobody says it out loud, but the whole house knows who brought the young lady home.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'Ghislaine wants you in the yard. Swords. Today. — Go! Before I change my mind about you.' },
  ],
};

/* ───────────── the farmstead ───────────── */
// a frame at the farm: f points at the gate (toward Roa), r to its right
const kidAt = (u, v) => ({ x: KID.H.x + KID.f.x * u + KID.r.x * v, z: KID.H.z + KID.f.z * u + KID.r.z * v });
function buildHideout() {
  const H = KID.H, dx = 1560 - H.x, dz = 385 - H.z, l = Math.hypot(dx, dz);
  KID.f = { x: dx / l, z: dz / l }; KID.r = { x: KID.f.z, z: -KID.f.x };
  const fAng = Math.atan2(KID.f.x, KID.f.z);
  thinGrassAround(H.x, H.z, KID.R - 2);
  // the fence: a gate toward the city, a broken stretch at the back
  const back = kidAt(-23, -11), backAng = Math.atan2(back.x - H.x, back.z - H.z);
  for (let a = 0; a < TAU; a += 0.17) {
    const ang = Math.atan2(Math.sin(a), Math.cos(a));                  // a as a compass angle, x = sin, z = cos
    if (Math.abs(wrapAngle(ang - fAng)) < 0.3 || Math.abs(wrapAngle(ang - backAng)) < 0.17) continue;
    const px = H.x + Math.sin(ang) * KID.R, pz = H.z + Math.cos(ang) * KID.R;
    placeProp('fence_wood_straight', px, pz, { s: 3.8, rot: ang + Math.PI / 2, pad: 0.7 });
  }
  KID.gate = kidAt(KID.R + 2, 0); KID.back = back;
  // a ruined farmhouse, tents, a fire, crates
  const fh = kidAt(-9, -15);
  placeProp('building_destroyed', fh.x, fh.z, { s: 8, rot: fAng });
  for (const [u, v, rot] of [[8, -15, 0.8], [12, 12, -0.6]]) { const p = kidAt(u, v); placeProp('tent', p.x, p.z, { s: 7, rot: fAng + rot }); }
  const fire = kidAt(4, -3); campfire(fire.x, fire.z); KID.fire = fire;
  for (const [n, u, v] of [['crate_A_big', 2, 9], ['barrel', 4, 10], ['sack', -2, 10], ['crate_B_big', 15, -6], ['wheelbarrow', -14, 4]]) { const p = kidAt(u, v); placeProp(n, p.x, p.z, { s: 5, rot: (u + v) * 0.6 }); }
  wreckedWagon(kidAt(16, 6).x, kidAt(16, 6).z, fAng + 0.4, false);
  buildShed(kidAt(-7, 12), Math.atan2(KID.r.x, KID.r.z));
  // the men: two at the fire, one on the gate, one walking the back fence, the Broker at the farmhouse
  const look = p => Math.atan2(p.x, p.z);
  const at = (u, v) => kidAt(u, v);
  const rel = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);
  const f1 = at(5.5, -1), f2 = at(2.5, -4.5), gate = at(KID.R - 3, 0), br = at(-5, -10);
  const beat = [at(-20, 13), at(-21, 0), at(-19, -12), at(-21, 0)].map((p, i) => ({ ...p, face: i % 2 ? look({ x: -KID.f.x, z: -KID.f.z }) : undefined }));
  const list = [
    ['thug', f1, { post: { ...f1, face: rel(f1, fire) } }],
    ['thug', f2, { post: { ...f2, face: rel(f2, fire) } }],
    ['thug', gate, { post: { ...gate, face: fAng } }],
    ['thug', beat[0], { patrol: beat }],
    ['broker', br, { post: { ...br, face: rel(br, H) } }],
  ];
  defineEncounter('hideout', H.x, H.z, list.map(([k, p, o]) => [k, p.x - H.x, p.z - H.z, o]), { flag: 'kidHide' });
  KID.enc = ENCOUNTERS.find(e => e.id === 'hideout');
  KID.built = true;
}
// a plank shed, door toward the yard, the back boards rotten
function buildShed(c, yaw) {
  const mat = toonMat({ vertexColors: true }), box = new THREE.BoxGeometry(1, 1, 1);
  const y = heightAt(c.x, c.z), g = new THREE.Group(); g.position.set(c.x, y - 0.05, c.z); g.rotation.y = yaw;
  const wood = '#5d4430', woodD = '#3e2c1e', roof = '#4a3a2c';
  // 6 m by 5, 2.8 high: room for the camera behind you
  const X = 3, Z = 2.5, Hh = 2.8;
  g.add(mergedPart([
    [box, wood, -X, Hh / 2, 0, 0.14, Hh, Z * 2 + 0.1], [box, wood, X, Hh / 2, 0, 0.14, Hh, Z * 2 + 0.1],                      // sides
    [box, wood, -1.85, Hh / 2, -Z, 2.3, Hh, 0.14], [box, wood, 1.85, Hh / 2, -Z, 2.3, Hh, 0.14], [box, wood, 0, 2.4, -Z, 1.4, 0.8, 0.14],   // front, round the door
    [box, woodD, 0, 1.0, -Z - 0.02, 1.4, 2.0, 0.1],                                                 // the barred door
    [box, woodD, 0, 1.1, -Z - 0.1, 1.7, 0.12, 0.1],                                                 // its bar
    [box, roof, 0, Hh + 0.1, 0, X * 2 + 0.5, 0.14, Z * 2 + 0.6, 0.1, 0, 0],                         // roof
    [box, '#4a3a28', 0, -0.4, 0, X * 2 - 0.1, 1.66, Z * 2 - 0.1], [box, '#b89a5a', 0.4, 0.47, 0.6, 3.2, 0.08, 2.6],   // packed earth floor, a straw bed
    [box, '#6e5a3a', -2.2, 0.78, 1.6, 0.9, 0.7, 0.8], [box, '#6e5a3a', 2.3, 0.73, -1.4, 0.8, 0.6, 1.0],   // old feed bins
  ], mat));
  const planks = mergedPart([[box, '#4e3a28', -2, Hh / 2, Z, 2, Hh, 0.12], [box, '#52402c', 0, Hh / 2, Z, 2, Hh, 0.12], [box, '#4a3626', 2, Hh / 2, Z, 2, Hh, 0.12]], mat);
  g.add(planks);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  STRUCT.group.add(g);
  // walls hold (the door too); the back boards hold until they don't
  const W = (lx, lz, hx, hz) => { const s = Math.sin(yaw), co = Math.cos(yaw); return addBox(c.x + lx * co + lz * s, c.z - lx * s + lz * co, hx, hz, -yaw, y - 0.5, y + Hh, 'shed'); };
  W(-X, 0, 0.1, Z + 0.05); W(X, 0, 0.1, Z + 0.05); W(0, -Z, X + 0.05, 0.1);
  W(-2.2, 1.6, 0.45, 0.4); W(2.3, -1.4, 0.4, 0.5);
  // the earth floor sits level whatever the slope beneath: walkable, 0.38 up
  addBox(c.x, c.z, X - 0.05, Z - 0.05, -yaw, y - 1.2, y + 0.38, 'shedFloor');
  // a guttering lantern on a nail by the door
  const lan = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.18), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb060').multiplyScalar(2) }));
  lan.position.set(1.5, 2.0, -Z + 0.3); g.add(lan);
  KID.lantern = new THREE.Vector3();
  KID.shed = { x: c.x, z: c.z, y, yaw, g, lan };
  KID.planks = { mesh: planks, col: W(0, Z, X + 0.05, 0.1), W: () => W(0, Z, X + 0.05, 0.1), pos: new THREE.Vector3(c.x + Math.sin(yaw) * (Z - 0.6), y, c.z + Math.cos(yaw) * (Z - 0.6)) };
  INTERACTABLES.push({ pos: KID.planks.pos, r: 2.4, label: () => 'Break out the rotten boards',
    enabled: () => KID.active && KID.planks.mesh.visible, action: () => breakPlanks() });
}
function breakPlanks() {
  const P = KID.planks; if (!P.mesh.visible) return;
  P.mesh.visible = false; removeCollider(P.col);
  emit(18, { pos: P.pos.clone().setY(P.pos.y + 1), col: '#7a5a3a', spread: 0.8, velSpread: 2, upBias: 1.5, life: 0.8, size: 0.12, size2: 0.05, gravity: 9, pool: 'soft' });
  BUS.emit('sfx', { id: 'block', pos: P.pos });
  setPlayerState('interact'); PL.actor.once('Unarmed_Melee_Attack_Kick', { speed: 1.3 });
  // a crack in the night: anyone close turns his head
  for (const e of kidFoes()) if (!e.aggro && e.pos.distanceTo(P.pos) < 13) e.sus = Math.max(e.sus || 0, 0.5);
  hint('Out. Keep low, keep her close — the broken fence at the back, or the gate if you dare.', 4);
}
function restorePlanks() {
  const P = KID.planks; if (!P || P.mesh.visible) return;
  P.mesh.visible = true; P.col = P.W();
}
const kidFoes = () => (KID.enc && KID.enc.live || []).filter(e => !e.dead && !e.removed);

/* ───────────── the story ───────────── */
// from talkEris, after the punch: she storms off, and you go after her at dusk
async function kidnapBegin(n) {
  await npcSay(n, KID_LINES.storm);
  await fadeOut(0.6);
  if (TOD.hour < 18.5 || TOD.hour > 23) TOD.hour = 19.3;
  NPCS.eris.moveTo(KID.meet.x, KID.meet.z, -Math.PI / 2); NPCS.eris.hold = true;
  setQuest('followEris');
  await fadeIn(0.8);
}
async function kidnapAmbush() {
  if (KID.busy) return;
  KID.busy = true;
  try {
    NPCS.eris.face = Math.atan2(PL.body.pos.x - NPCS.eris.pos.x, PL.body.pos.z - NPCS.eris.pos.z);
    await say(KID_LINES.ambush);
    BUS.emit('sfx', { id: 'hurt' }); shake(0.4);
    await fadeOut(0.4);
    await gameWait(0.6);
    setupEscape();
    setQuest('escape');
    await fadeIn(1.2);
    await say(KID_LINES.wake);
    hint('The back boards are rotten. Guards grow suspicious (?) before they shout — walk (' + IN.label('walk') + ') to stay quiet, and strike an unaware guard from behind to drop him silently.', 7);
  } finally { KID.busy = false; }
}
// (sync) put everything where the night starts: you and Eris in the shed, the men at their posts
function setupEscape() {
  for (const e of [...ENT.enemies]) if (!e.def.boss) e.remove();
  TOD.hour = 23.2;
  NPCS.eris.setVisible(false); NPCS.eris.hold = false;
  G.flags.kidHide = true;
  const enc = KID.enc; despawnEncounter(enc); enc.cleared = false; spawnEncounter(enc);
  for (const e of enc.live) { e.sus = 0; e.home.set(e.pos.x, 0, e.pos.z); }
  restorePlanks();
  const S = KID.shed, fx = -Math.sin(S.yaw), fz = -Math.cos(S.yaw);
  // by the rotten back wall, facing it: the whole shed behind you for the camera
  placePlayerAt(S.x - fx * 1.3, S.y + 0.4, S.z - fz * 1.3, S.yaw); CAM.pitch = -0.22;
  if (!ALLY.erisNight) ALLY.erisNight = new Companion(ERIS_UNARMED, 'Eris', '#e8606f');
  const E = ALLY.erisNight; E.passive = true; E.join();
  E.pos.set(S.x - fx * 0.6 - Math.cos(S.yaw) * 1.4, S.y + 0.4, S.z - fz * 0.6 + Math.sin(S.yaw) * 1.4);
  if (ALLY.eris && ALLY.eris.active) ALLY.eris.leave();
  KID.active = true; KID.detected = false; KID.fightT = 0;
}
// out past the fence, or nobody left standing: either way, Ghislaine
function finishEscape(how) {
  if (!KID.active) return;
  KID.active = false;
  const quiet = how === 'escaped' && !KID.detected;
  G.flags.kidnapDone = true;
  if (quiet) G.flags.kidStealth = true;
  gainXp(quiet ? 260 : 160);
  toast(quiet ? 'Out without a sound' : 'Out', 'big');
  kidnapAftermath(quiet);
}
async function kidnapAftermath(quiet) {
  KID.busy = true;
  try {
    // Ghislaine comes up the road toward you
    const g = NPCS.ghislaine, p = PL.body.pos, to = kidAt(KID.exitR + 4, 0);
    const gx = lerp(p.x, to.x, 0.25) + 5, gz = lerp(p.z, to.z, 0.25) + 3;
    g.moveTo(gx, gz, Math.atan2(p.x - gx, p.z - gz)); g.setVisible(true); g.hold = true;
    if (!quiet) for (const e of kidFoes()) { killEnemy(e); emit(10, { pos: e.lockPoint().clone(), col: '#ffe0b0', spread: 0.3, velSpread: 3, life: 0.4, size: 0.12, bright: 2 }); }
    if (!quiet) { g.actor.once('2H_Melee_Attack_Spin', { speed: 1.1, onEnd: () => g.actor.loop(g.idle, { fade: 0.2 }) }); BUS.emit('sfx', { id: 'crit' }); shake(0.3); }
    await say(quiet ? KID_LINES.quiet : KID_LINES.loud);
    await say(KID_LINES.after);
    await fadeOut(1.0);
    // morning, at home
    for (const e of [...ENT.enemies]) if (!e.def.boss) e.remove();
    G.flags.kidHide = false; despawnEncounter(KID.enc);
    if (ALLY.erisNight) ALLY.erisNight.leave();
    TOD.hour = 8.5;
    resetRoaState();
    const F = ROA.spots.forecourt;
    placePlayerAt(F.x + 3, floorAt(F.x + 3, F.z + 4), F.z + 4, Math.atan2(-3, -4));
    setQuest('ghislaine', { quiet: true });
    autosave();
    await fadeIn(1.2);
    await say(KID_LINES.morning);
    toast('The Sword Saint', 'big'); later(0.7, () => toast('Ghislaine is in the training yard beside the keep.'));
  } finally { KID.busy = false; }
}
// a fall in the night, or a save loaded mid-escape: back to the straw
async function restartEscape() {
  await fadeOut(0.5);
  setupEscape();
  G.hp = G.maxHp; G.mana = G.maxMana; G.stamina = G.maxStamina;
  GAME.state = 'play'; $('hud').classList.remove('off');
  await fadeIn(0.9);
  hint('Back in the shed. Again — quietly, or not.', 3);
}
// called after a load (resetWorldState): the world as the step needs it
function resetKidnap() {
  if (!KID.built || !G) return;
  if (KID.active) { KID.active = false; if (ALLY.erisNight) ALLY.erisNight.leave(); }
  G.flags.kidHide = G.quest === 'escape';
  restorePlanks();
  if (G.quest === 'followEris' && NPCS.eris) { NPCS.eris.moveTo(KID.meet.x, KID.meet.z, -Math.PI / 2); NPCS.eris.hold = true; }
}
function kidnapResume() { if (G && G.quest === 'escape' && !KID.active && !KID.busy) restartEscape(); }

/* ───────────── each frame ───────────── */
const _kidV = new THREE.Vector3(), KID_MARKS = [];
function updateKidnap(dt) {
  if (!KID.built || !G) return;
  if (G.quest === 'followEris' && !KID.busy && !UI.dlg && PL.state === 'move' && Math.hypot(PL.body.pos.x - KID.meet.x, PL.body.pos.z - KID.meet.z) < 6) kidnapAmbush();
  if (KID.active && !KID.busy) {
    const foes = kidFoes(), p = PL.body.pos;
    if (!KID.detected && foes.some(e => e.aggro)) { KID.detected = true; hint('They\'ve seen you! Fight — or run for it.', 3); BUS.emit('sfx', { id: 'snarl' }); }
    if (KID.detected) KID.fightT += dt;
    const out = Math.hypot(p.x - KID.H.x, p.z - KID.H.z) > KID.exitR;
    if (out || !foes.length || KID.fightT > 75) finishEscape(out ? 'escaped' : 'fought');
  }
  if (KID.shed && Math.hypot(PL.body.pos.x - KID.shed.x, PL.body.pos.z - KID.shed.z) < 40) { KID.shed.lan.getWorldPosition(KID.lantern); requestLight(KID.lantern, '#ffa050', 9, 10); }
  updateSuspicionMarks();
}
// "?" over a guard who's getting suspicious, "!" over one who's raised the alarm
function updateSuspicionMarks() {
  const show = KID.active ? kidFoes() : [], hud = $('floaters');
  while (KID_MARKS.length < show.length) { const el = document.createElement('div'); el.className = 'susMark'; hud.appendChild(el); KID_MARKS.push(el); }
  KID_MARKS.forEach((el, i) => {
    const e = show[i];
    if (!e || (!e.aggro && !(e.sus > 0.04))) { el.style.display = 'none'; return; }
    _kidV.set(e.pos.x, e.pos.y + e.h + 0.55, e.pos.z).project(camera);
    if (_kidV.z > 1) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.style.left = ((_kidV.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - _kidV.y) / 2 * innerHeight) + 'px';
    el.textContent = e.aggro ? '!' : '?';
    el.classList.toggle('alarm', e.aggro);
    el.style.opacity = e.aggro ? 1 : clamp(0.35 + e.sus * 0.65, 0, 1);
    el.style.transform = `translate(-50%,-100%) scale(${e.aggro ? 1.2 : 0.8 + e.sus * 0.5})`;
  });
}
