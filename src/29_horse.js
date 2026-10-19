/* ═══════════════════════════════════════════════════════════════════════
   KESTREL — a bay mare from the Boreas stables, lent to the tutor once he
   starts taking the Guild's work. Whistle (H) and she comes at a run;
   ride with the same keys you walk with: Shift to gallop (it costs her
   wind, your stamina bar), Space to jump, E or H to get down. A hard
   blow throws you off.

   The horse is procedural like the wolves: a body of soft ellipsoids,
   two-joint legs driven by gait tables (walk · trot · gallop), a neck
   that bobs with the stride, a mane and a tail that answer the wind.
   ═══════════════════════════════════════════════════════════════════════ */
const HORSE = { obj: null, rig: null, body: null, mode: 'gone', speed: 0, heading: 0, idleT: 0, farT: 0, stuckT: 0, lastD: 1e9,
  WALK: 3.2, CANTER: 8.5, GALLOP: 14.5, SADDLE: 1.36 };
const HORSE_NAME = 'Kestrel';

function buildHorseRig() {
  // A bay mare: red-brown coat, black points (mane, tail, lower legs), a white blaze and one
  // white hind sock. Every rigid part is one mesh coloured per vertex; the joints are the same
  // as before (body · neck · head · three tail pieces · hip/knee per leg), so the gaits, the
  // grazing and the rider's seat (body-local 0, 0.36, 0) all carry over.
  const mat = toonMat({ vertexColors: true, rim: true });
  const ball = new THREE.IcosahedronGeometry(1, 2), box = new THREE.BoxGeometry(1, 1, 1);
  const cone = new THREE.ConeGeometry(1, 1, 6), hoofG = new THREE.CylinderGeometry(0.85, 1, 1, 10), tube = new THREE.CylinderGeometry(1, 1, 1, 8);
  const coat = '#7d4a28', coatD = '#6a3d20', coatL = '#94603a', black = '#1f1611', mane = '#17110d', white = '#efe8dc', hoof = '#3b342d', eye = '#0e0a08';
  const leather = '#4a2e1c', leatherD = '#2f1d12', blanket = '#8b2635', gold = '#c9a227', iron = '#6b6a66';
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 1.08; root.add(body);

  // ── the body: barrel, deep chest and shoulder, withers, rounded hindquarters, a tucked belly
  const bp = [
    [ball, coat, 0, 0.02, -0.02, 0.33, 0.35, 0.6],
    [ball, coat, 0, 0.04, 0.46, 0.33, 0.42, 0.36],          // shoulder and chest
    [ball, coatL, 0, -0.06, 0.7, 0.24, 0.3, 0.18],           // the breast, catching the light
    [ball, coat, 0, 0.27, 0.4, 0.17, 0.16, 0.3],             // withers
    [ball, coat, 0, 0.08, -0.52, 0.35, 0.38, 0.4],           // hindquarters
    [ball, coat, 0, 0.27, -0.5, 0.28, 0.16, 0.32],           // croup
    [ball, coatD, 0, -0.17, 0.02, 0.28, 0.2, 0.52],          // belly, in its own shade
  ];
  // tack: Boreas red saddle-cloth with a gold hem, a seat with pommel and cantle, girth, breastplate, stirrups
  bp.push(
    [box, blanket, 0, 0.375, 0.02, 0.62, 0.05, 0.62, 0, 0, 0], [box, gold, 0, 0.375, 0.335, 0.63, 0.055, 0.025], [box, gold, 0, 0.375, -0.295, 0.63, 0.055, 0.025],
    [box, blanket, -0.3, 0.27, 0.02, 0.04, 0.2, 0.6], [box, blanket, 0.3, 0.27, 0.02, 0.04, 0.2, 0.6],                  // the cloth hangs down both flanks
    [box, gold, -0.315, 0.17, 0.02, 0.03, 0.025, 0.61], [box, gold, 0.315, 0.17, 0.02, 0.03, 0.025, 0.61],
    [box, leather, 0, 0.42, 0.0, 0.4, 0.07, 0.48], [box, leatherD, 0, 0.47, 0.22, 0.2, 0.08, 0.07], [box, leatherD, 0, 0.48, -0.21, 0.32, 0.1, 0.06],
    [box, leatherD, 0, -0.2, 0.08, 0.5, 0.03, 0.09],                                              // girth under the belly
    [box, blanket, 0, 0.02, 0.76, 0.42, 0.06, 0.05], [box, gold, 0, 0.02, 0.79, 0.12, 0.08, 0.02], // breastplate across the chest
  );
  for (const s of [-1, 1]) {
    bp.push([box, leatherD, s * 0.345, 0.05, 0.08, 0.03, 0.5, 0.06]);                              // girth strap up the side
    bp.push([box, leatherD, s * 0.38, 0.08, 0.04, 0.015, 0.4, 0.035]);                             // stirrup leather
    bp.push([box, iron, s * 0.39, -0.15, 0.04, 0.03, 0.03, 0.12], [box, iron, s * 0.39, -0.12, -0.01, 0.03, 0.08, 0.02], [box, iron, s * 0.39, -0.12, 0.09, 0.03, 0.08, 0.02]);
    bp.push([box, blanket, s * 0.3, 0.12, 0.62, 0.04, 0.05, 0.3, 0.5, 0, 0]);                     // breastplate straps up to the withers
  }
  body.add(mergedPart(bp, mat));

  // ── the neck: thick where it leaves the shoulder, arching to the poll; a long black mane
  const neck = new THREE.Group(); neck.position.set(0, 0.22, 0.72); neck.rotation.x = -0.75; body.add(neck);
  const np = [];
  for (let i = 0; i < 5; i++) { const k = i / 4; np.push([ball, i % 2 ? coat : coatL, 0, 0.04 + k * 0.08, 0.06 + k * 0.48, 0.2 - k * 0.07, 0.25 - k * 0.1, 0.18]); }
  for (let i = 0; i < 9; i++) {                                                                  // the mane falls to one side in locks
    const k = i / 8;
    np.push([box, mane, 0.04, 0.24 - k * 0.02 + Math.sin(i * 1.7) * 0.01, 0.0 + k * 0.56, 0.035, 0.2 + (i % 3) * 0.03, 0.08, 0.15, 0, 0.35]);
  }
  neck.add(mergedPart(np, mat));

  // ── the head: a broad forehead tapering to the muzzle, a round jaw, nostrils, ears, a white blaze, a bridle
  const head = new THREE.Group(); head.position.set(0, 0.16, 0.6); head.rotation.x = 1.15; neck.add(head);
  const hp = [
    [ball, coat, 0, 0.04, -0.02, 0.13, 0.13, 0.15],                         // forehead and poll
    [tube, coat, 0, 0.0, 0.14, 0.085, 0.3, 0.1, Math.PI / 2 + 0.12, 0, 0], // the long face
    [ball, coat, 0, -0.06, 0.0, 0.12, 0.14, 0.13],                          // the round jaw
    [ball, coatL, 0, -0.04, 0.31, 0.1, 0.1, 0.12],                          // muzzle
    [box, white, 0, 0.09, 0.12, 0.05, 0.02, 0.36, 0.12, 0, 0],             // blaze from the forehead down the face
    [box, black, 0, -0.1, 0.3, 0.12, 0.012, 0.06],                         // the line of the mouth
    [box, mane, 0, 0.15, -0.05, 0.06, 0.04, 0.12, -0.4, 0, 0],             // forelock
    // bridle: browband, noseband, cheek pieces and a bit-ring; short reins hanging back
    [box, leatherD, 0, 0.1, -0.03, 0.28, 0.025, 0.025], [box, leatherD, 0, 0.0, 0.22, 0.2, 0.025, 0.03, 0.12, 0, 0],
  ];
  for (const s of [-1, 1]) hp.push(
    [cone, coat, s * 0.075, 0.2, -0.1, 0.04, 0.14, 0.035, -0.25, 0, -s * 0.18], [cone, black, s * 0.076, 0.27, -0.12, 0.012, 0.03, 0.01, -0.25, 0, -s * 0.18], // ears, dark tips
    [ball, eye, s * 0.115, 0.06, 0.04, 0.026, 0.032, 0.03], [ball, white, s * 0.123, 0.068, 0.05, 0.007, 0.007, 0.007],                                    // eyes and a glint
    [ball, black, s * 0.045, -0.02, 0.41, 0.022, 0.018, 0.014],                                                                                         // nostrils
    [box, leatherD, s * 0.1, 0.02, 0.1, 0.015, 0.025, 0.24, 0.12, 0, 0], [box, iron, s * 0.085, -0.07, 0.3, 0.015, 0.04, 0.04],                        // cheek strap, bit ring
    [box, leatherD, s * 0.09, -0.14, 0.16, 0.012, 0.02, 0.3, -0.6, 0, 0],                                                                               // reins
  );
  head.add(mergedPart(hp, mat));

  // ── the tail: a dock and a long fall of black hair, three pieces that sway and stream
  const tail = []; let par = body;
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group(); g.position.set(0, i === 0 ? 0.3 : -0.02, i === 0 ? -0.88 : -0.26);
    g.rotation.x = i === 0 ? -1.0 : -0.25;
    const w = 0.07 + i * 0.025, tp = [[ball, mane, 0, 0, -0.14, w, w * 0.9, 0.2]];
    if (i > 0) for (const s of [-1, 1]) tp.push([ball, mane, s * w * 0.6, -0.01, -0.13, w * 0.55, w * 0.5, 0.17]);   // the hair spreads lower down
    g.add(mergedPart(tp, mat)); par.add(g); tail.push(g); par = g;
  }

  // ── legs: forearm or gaskin, then knee/hock, cannon, fetlock, pastern and hoof; black below the knee, one white hind sock
  const legs = [];
  for (const [x, z, front] of [[-0.19, 0.56, 1], [0.19, 0.56, 1], [-0.2, -0.58, 0], [0.2, -0.58, 0]]) {
    const hip = new THREE.Group(); hip.position.set(x, -0.14, z); body.add(hip);
    hip.add(mergedPart(front
      ? [[ball, coat, 0, -0.06, 0.02, 0.13, 0.22, 0.15], [ball, coat, 0, -0.3, 0.02, 0.08, 0.2, 0.09]]     // forearm, muscled at the top
      : [[ball, coat, 0, -0.02, -0.05, 0.15, 0.24, 0.2], [ball, coat, 0, -0.3, -0.06, 0.08, 0.2, 0.1]], mat)); // thigh and gaskin
    const knee = new THREE.Group(); knee.position.set(0, -0.46, front ? 0.01 : -0.06); hip.add(knee);
    const sock = !front && x < 0 ? white : black;
    knee.add(mergedPart([
      [ball, front ? black : coatD, 0, 0.0, front ? 0.01 : -0.03, 0.065, 0.07, 0.075],      // knee / hock
      [ball, sock, 0, -0.19, 0, 0.05, 0.19, 0.055],                                         // cannon
      [ball, sock, 0, -0.37, 0.01, 0.062, 0.055, 0.065],                                    // fetlock
      [ball, sock, 0, -0.41, 0.03, 0.048, 0.04, 0.05],                                      // pastern
      [hoofG, hoof, 0, -0.44, 0.04, 0.062, 0.06, 0.07],                                     // hoof
    ], mat));
    legs.push({ hip, knee, front, side: Math.sign(x) });
  }
  root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return { root, body, neck, head, tail, legs, phase: 0, graze: 0, grazeT: 4 };
}

// gait tables: per leg [left-front, right-front, left-hind, right-hind] phase offsets (cycles)
const HORSE_GAITS = {
  walk:   { off: [0.25, 0.75, 0, 0.5], amp: 0.36, bob: 0.02 },
  trot:   { off: [0, 0.5, 0.5, 0], amp: 0.6, bob: 0.05 },
  gallop: { off: [0.45, 0.55, 0, 0.1], amp: 0.92, bob: 0.08 },
};
function animateHorse(dt) {
  const R = HORSE.rig, sp = HORSE.speed, t = GAME.time;
  const g = sp < 0.25 ? null : sp < 4.2 ? HORSE_GAITS.walk : sp < 9.5 ? HORSE_GAITS.trot : HORSE_GAITS.gallop;
  const freq = !g ? 0 : g === HORSE_GAITS.walk ? sp * 0.42 : g === HORSE_GAITS.trot ? 1.5 + sp * 0.08 : 1.7 + sp * 0.05;
  R.phase += dt * freq;
  const ph = R.phase * TAU;
  R.legs.forEach((L, i) => {
    if (!g) { L.hip.rotation.x = damp(L.hip.rotation.x, 0, 8, dt); L.knee.rotation.x = damp(L.knee.rotation.x, 0, 8, dt); return; }
    const a = ph + g.off[i] * TAU, s = Math.sin(a), lift = Math.max(0, Math.cos(a));
    L.hip.rotation.x = s * g.amp * 0.62;
    L.knee.rotation.x = (L.front ? 1 : -1) * lift * g.amp * 1.15;
  });
  // the body rises and pitches with the stride; the neck pumps at the gallop
  const bob = g ? Math.abs(Math.sin(ph)) * g.bob : 0;
  R.body.position.y = 1.08 + bob - (g === HORSE_GAITS.gallop ? 0.04 : 0);
  R.body.rotation.x = g === HORSE_GAITS.gallop ? Math.sin(ph) * 0.06 : 0;
  // grazing when she stands a while
  if (!g && HORSE.mode !== 'ride') { R.grazeT -= dt; if (R.grazeT < 0) { R.graze = R.graze > 0.5 ? 0 : 1; R.grazeT = R.graze ? rnd(3, 6) : rnd(5, 11); } } else R.graze = 0;
  const neckX = -0.75 + (g === HORSE_GAITS.gallop ? 0.35 + Math.sin(ph) * 0.12 : g ? Math.sin(ph * 2) * 0.04 : 0) + R.graze * 1.15;
  R.neck.rotation.x = damp(R.neck.rotation.x, neckX, 4, dt);
  R.head.rotation.x = damp(R.head.rotation.x, 1.15 + R.graze * 0.25, 4, dt);
  R.tail.forEach((tg, k) => {
    tg.rotation.y = Math.sin(t * (g ? 3 : 1.6) + k * 0.9) * (g ? 0.15 : 0.28) * (k + 1) * 0.5;
    tg.rotation.x = k === 0 ? -1.0 + Math.min(0.55, sp * 0.045) : -0.25;   // streams out behind at speed
  });
  // hoofbeats: one clop per leg strike
  if (g) {
    const beat = Math.floor(R.phase * (g === HORSE_GAITS.walk ? 4 : 2));
    if (beat !== R.beat) { R.beat = beat; if (HORSE.obj.position.distanceToSquared(camera.position) < 60 * 60) BUS.emit('sfx', { id: 'hoof', pos: HORSE.obj.position, gallop: g === HORSE_GAITS.gallop }); }
  }
}

const horseUnlocked = () => !!G && (!!G.flags.horse || G.quest === 'done' || ROA_STEPS.indexOf(G.quest) >= ROA_STEPS.indexOf('bandits'));
function spawnHorse(x, z, heading) {
  if (!HORSE.rig) {
    HORSE.rig = buildHorseRig(); HORSE.obj = HORSE.rig.root; scene.add(HORSE.obj);
    HORSE.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 0.62, h: 1.7, grounded: true, groundY: 0 };
    INTERACTABLES.push({ pos: HORSE.body.pos, r: 2.6, label: () => 'Ride ' + HORSE_NAME,
      enabled: () => HORSE.mode !== 'gone' && HORSE.mode !== 'ride' && PL.state === 'move', action: () => mountHorse() });
  }
  HORSE.body.pos.set(x, floorAt(x, z), z); HORSE.body.vel.set(0, 0, 0);
  HORSE.heading = heading; HORSE.speed = 0; HORSE.obj.visible = true;
  HORSE.obj.position.copy(HORSE.body.pos); HORSE.obj.rotation.y = heading;
  HORSE.mode = 'idle'; HORSE.farT = 0; HORSE.leaving = false; HORSE.homeIn = false;
}
// the whistle: she comes from behind you, out of sight, at a canter
function whistleHorse() {
  if (!horseUnlocked()) { hint('You have no horse yet. Lord Sauros keeps horses at the Boreas stables, on the estate terrace.', 3.5); return; }
  if (GAME.inCave) { hint('She won\'t come underground.', 3); return; }
  BUS.emit('sfx', { id: 'whistle' });
  const p = PL.body.pos;
  if (HORSE.mode !== 'gone' && HORSE.body.pos.distanceTo(p) < 70) { HORSE.leaving = HORSE.mode === 'stall'; HORSE.mode = 'come'; HORSE.stuckT = 0; HORSE.lastD = 1e9; return; }
  // pick a spot behind the camera, on dry walkable ground
  const back = CAM.yaw, bx = Math.sin(back), bz = Math.cos(back);
  let sx = p.x + bx * 26, sz = p.z + bz * 26;
  for (let i = 0; i < 6; i++) {
    const a = back + (i - 2.5) * 0.5, x = p.x + Math.sin(a) * 26, z = p.z + Math.cos(a) * 26;
    if (waterAt(x, z) < heightAt(x, z) && normalAt(x, z, _hn).y > 0.8 && groundAt(x, z, heightAt(x, z) + 50, 0.6) < heightAt(x, z) + 0.3) { sx = x; sz = z; break; }
  }
  spawnHorse(sx, sz, Math.atan2(p.x - sx, p.z - sz));
  HORSE.mode = 'come'; HORSE.stuckT = 0; HORSE.lastD = 1e9;
  later(0.6, () => BUS.emit('sfx', { id: 'whinny', pos: HORSE.body.pos }));
}
const _hn = new THREE.Vector3();

function mountHorse() {
  if (HORSE.mode === 'gone' || PL.state !== 'move') return;
  if (GAME.time < (HORSE.noMountUntil || 0)) return;          // the press that got you down mustn't put you straight back up
  HORSE.mode = 'ride'; HORSE.speed = 0;
  setPlayerState('ride');
  PL.chanting = null; PL.guarding = false; PL.actor.setUpper(null);
  PL.actor.loop('Idle', { fade: 0.2 });
  CAM.lockTarget = null;
  HORSE.camPrev = CAM.distT; CAM.distT = Math.max(CAM.distT, 6.2); CAM.lift = 0.95;
  BUS.emit('sfx', { id: 'jump' });
  if (!G.flags.rodeOnce) { G.flags.rodeOnce = true; hint(`${IN.label('forward')} ride · hold ${IN.label('sprint')} to gallop · ${IN.label('jump')} jump · ${IN.label('interact')} get down`, 6); }
}
function dismountHorse(thrown = false) {
  if (HORSE.mode !== 'ride') return;
  HORSE.mode = 'idle';
  HORSE.noMountUntil = GAME.time + 0.4;
  const hx = Math.cos(HORSE.heading), hz = -Math.sin(HORSE.heading);                 // her left side
  const x = HORSE.body.pos.x + hx * 1.3, z = HORSE.body.pos.z + hz * 1.3;
  const b = PL.body;
  b.pos.set(x, floorAt(x, z), z); b.vel.set(thrown ? hx * 4 : 0, thrown ? 3 : 0, thrown ? hz * 4 : 0); b.grounded = !thrown;
  if (HORSE.camPrev) CAM.distT = HORSE.camPrev; CAM.lift = 0;
  setPlayerState(thrown ? 'hit' : 'move');
  PL.actor.root.position.copy(b.pos);
  if (thrown) { PL.actor.once('Hit_B', { speed: 1, fade: 0.05 }); HORSE.speed *= 0.3; }
  else PL.actor.loop('Idle', { fade: 0.2 });
}
// travel, death, a new game: she goes back to the stables, you're on your feet
function horseStandDown() {
  if (typeof HORSE === 'undefined' || !HORSE.rig) return;
  if (HORSE.mode === 'ride') { HORSE.mode = 'gone'; if (PL.state === 'ride') PL.state = 'move'; }
  HORSE.mode = 'gone'; HORSE.obj.visible = false;
  CAM.lift = 0; if (HORSE.camPrev) { CAM.distT = HORSE.camPrev; HORSE.camPrev = 0; }
}
// she's lent once the Guild's work begins
BUS.on('quest', id => {
  if (id === 'bandits' && G && !G.flags.horse) {
    G.flags.horse = true;
    later(5, () => { toast('Lord Sauros lends you ' + HORSE_NAME + ', a bay mare from the estate stables', 'big'); later(0.8, () => hint(IN.label('horse') + ' to whistle for her — or fetch her from the stables on the terrace', 5)); });
  }
});
function horseThrow() { if (PL.state === 'ride') { dismountHorse(true); toast('Thrown from the saddle', 'bad'); } }

// riding: camera-relative steering like on foot, with a horse's momentum
function stRide(dt) {
  const hb = HORSE.body, b = PL.body;
  inputDir(_mv);
  const has = _mv.lengthSq() > 0.01;
  const wantGallop = has && IN.down('sprint') && G.stamina > 1;
  let target = has ? (PL.walkToggle ? HORSE.WALK : wantGallop ? HORSE.GALLOP : HORSE.CANTER) : 0;
  if (IN.pressed('walk')) PL.walkToggle = !PL.walkToggle;
  if (wantGallop) { G.stamina -= dt * 11 * (G.gear && G.gear.oats ? 0.7 : 1); PL.staminaDelay = 0.6; }
  if (hb.inWater > 0.5) target = Math.min(target, HORSE.WALK);
  HORSE.speed = damp(HORSE.speed, target, target > HORSE.speed ? 1.6 : 3.2, dt);
  if (has) {
    const want = Math.atan2(_mv.x, _mv.z);
    const rate = lerp(3.4, 1.7, smooth(HORSE.WALK, HORSE.GALLOP, HORSE.speed));
    HORSE.heading = dampAngle(HORSE.heading, want, rate, dt);
  }
  hb.vel.x = Math.sin(HORSE.heading) * HORSE.speed; hb.vel.z = Math.cos(HORSE.heading) * HORSE.speed;
  if (IN.pressed('jump') && hb.grounded && G.stamina > 4) { hb.vel.y = 7.4; hb.grounded = false; G.stamina -= 10; PL.staminaDelay = 0.7; BUS.emit('sfx', { id: 'jump' }); }
  moveBody(hb, dt);
  if (hb.hitDeepWater) { hb.hitDeepWater = false; HORSE.speed = 0; }
  // you sit where she is
  b.pos.copy(hb.pos); b.vel.copy(hb.vel); b.grounded = hb.grounded; b.inWater = hb.inWater;
  PL.face = HORSE.heading;
  if (IN.pressed('interact') || IN.pressed('horse')) { dismountHorse(); return; }
  if (IN.pressed('attack') || IN.pressed('cast')) { if (!HORSE.toldFight) { HORSE.toldFight = true; hint('Get down to fight.', 3); } }
}
// the rider on the saddle, legs about her barrel
const _rq = new THREE.Quaternion(), _re = new THREE.Euler(), _rv = new THREE.Vector3();
function poseRider(dt) {
  const A = PL.actor, R = HORSE.rig;
  R.body.updateMatrixWorld(true);
  _rv.set(0, 0.36, 0.0).applyMatrix4(R.body.matrixWorld);
  A.root.position.set(_rv.x, _rv.y + 0.08 - 0.14, _rv.z);
  A.root.rotation.y = HORSE.heading;
  A.update(dt);
  for (const [s, side] of [[1, 'l'], [-1, 'r']]) {
    A.bones['upperleg' + side].quaternion.multiply(_rq.setFromEuler(_re.set(-1.0, 0, -0.55 * s)));
    A.bones['lowerleg' + side].quaternion.multiply(_rq.setFromEuler(_re.set(1.15, 0, 0)));
  }
}

function updateHorse(dt) {
  // not out with you, and you're near the estate: she's in her stall
  if (HORSE.mode === 'gone' && typeof stableWants === 'function' && stableWants()) { spawnHorse(STABLE.stall.x, STABLE.stall.z, 0); HORSE.mode = 'stall'; }
  if (HORSE.mode === 'gone' || !HORSE.rig) return;
  const hb = HORSE.body, p = PL.body.pos;
  if (GAME.inCave) { HORSE.obj.visible = false; return; }
  HORSE.obj.visible = true;
  if (HORSE.mode === 'come') {
    // out of a stall: straight out of its front first, then over to you
    if (HORSE.leaving && Math.hypot(hb.pos.x - STABLE.stall.x, hb.pos.z - (STABLE.stall.z + 6)) < 1.5) HORSE.leaving = false;
    const tx = HORSE.leaving ? STABLE.stall.x : p.x, tz = HORSE.leaving ? STABLE.stall.z + 6 : p.z;
    const dx = tx - hb.pos.x, dz = tz - hb.pos.z, d = Math.hypot(dx, dz);
    if (!HORSE.leaving && d < 2.6) { HORSE.mode = 'idle'; HORSE.speed = 0; }
    else {
      HORSE.heading = dampAngle(HORSE.heading, Math.atan2(dx, dz), 4, dt);
      HORSE.speed = damp(HORSE.speed, d > 12 ? HORSE.CANTER : 3, 2.5, dt);
      // caught on something: try again from closer, out of sight
      HORSE.stuckT = d < HORSE.lastD - 0.02 ? 0 : HORSE.stuckT + dt; HORSE.lastD = d;
      if (HORSE.stuckT > 2.5) { const a = CAM.yaw; spawnHorse(p.x + Math.sin(a) * 8, p.z + Math.cos(a) * 8, a + Math.PI); HORSE.mode = 'come'; HORSE.stuckT = 0; HORSE.lastD = 1e9; }
    }
  } else if (HORSE.mode === 'home') {
    // led back: round to the front of the stable first, then into the middle stall
    const S = STABLE.stall, front = !HORSE.homeIn, tx = S.x, tz = front ? S.z + 7 : S.z;
    const dx = tx - hb.pos.x, dz = tz - hb.pos.z, d = Math.hypot(dx, dz);
    if (d < (front ? 1.5 : 0.6)) { if (front) { HORSE.homeIn = true; HORSE.lastD = 1e9; } else { HORSE.mode = 'stall'; HORSE.speed = 0; HORSE.homeIn = false; } }
    else {
      HORSE.heading = dampAngle(HORSE.heading, Math.atan2(dx, dz), 4, dt);
      HORSE.speed = damp(HORSE.speed, d > 5 ? 3.2 : 1.3, 2.5, dt);
      HORSE.stuckT = d < HORSE.lastD - 0.02 ? 0 : HORSE.stuckT + dt; HORSE.lastD = d;
      if (HORSE.stuckT > 3) { spawnHorse(S.x, S.z, 0); HORSE.mode = 'stall'; HORSE.homeIn = false; }
    }
  } else if (HORSE.mode === 'stall') {
    // turns round to look out over the door; out of sight and mind once you've gone
    HORSE.speed = 0; HORSE.heading = dampAngle(HORSE.heading, 0, 1.5, dt);
    if (hb.pos.distanceTo(p) > 130) { HORSE.mode = 'gone'; HORSE.obj.visible = false; return; }
  } else if (HORSE.mode === 'idle') {
    HORSE.speed = damp(HORSE.speed, 0, 3, dt);
    // left far behind long enough, she goes home
    HORSE.farT = hb.pos.distanceTo(p) > 160 ? HORSE.farT + dt : 0;
    if (HORSE.farT > 30) { HORSE.mode = 'gone'; HORSE.obj.visible = false; return; }
  }
  if (HORSE.mode !== 'ride') {
    hb.vel.x = Math.sin(HORSE.heading) * HORSE.speed; hb.vel.z = Math.cos(HORSE.heading) * HORSE.speed;
    moveBody(hb, dt);
  }
  HORSE.obj.position.copy(hb.pos);
  HORSE.obj.rotation.y = HORSE.heading;
  animateHorse(dt);
}
