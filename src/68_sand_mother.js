/* ═══════════════════════════════════════════════════════════════════════
   THE SAND MOTHER — what eats the caravans.

   A worm the size of a watchtower, asleep under the nest's pale sand
   until you walk into the bowl. It fights from where it stands: rears
   and slams (a ring in front of it is the tell), sweeps its body round,
   spits gobbets of wet sand in an arc. Then it goes under — a ripple of
   sand runs at you — and comes up through a ring at your feet. At half
   its strength its brood answers (rust scorpions) and it burrows more.

   The rig is one curve: a base in the sand, a body rising and leaning
   toward its prey, a round maw at the top with three petals that open.
   rise / lean / sway / rear are the pose; the brain (def.brain) runs the
   burrowing on top of the ordinary enemy brain.
   ═══════════════════════════════════════════════════════════════════════ */
ENEMY_DEFS.sandMother = {
  name: 'The Sand Mother', rig: 'worm', hp: 2400, poise: 500, r: 2.6, h: 8.5, walk: 0, run: 0, sight: 80, hear: 80,
  xp: 950, weight: 6, flinchAt: 999, knockRes: 1, boss: true, wakeR: 0, wakeT: 2.4, deathSfx: 'howl',
  brain: wormBrain,
  attacks: [
    { name: 'slam',  range: [0, 11],  windup: 1.05, active: 0.25, recover: 1.1, dmg: 38, poise: 70, aoe: { r: 3.8, at: 'front', dist: 7.5 } },
    { name: 'sweep', range: [0, 9],   windup: 0.9,  active: 0.35, recover: 1.0, reach: 9.5, arc: 2.2, dmg: 28, poise: 50 },
    { name: 'spit',  range: [7, 42],  windup: 1.0,  active: 0.2,  recover: 0.9, ranged: { spd: 21, dmg: 22, r: 0.55, col: '#cfa860', count: 3, spread: 0.22, gravity: 8, life: 4, poise: 40 } },
  ],
  phase2: {
    at: 0.5, speedMul: 1, summon: { key: 'rustScorp', n: 3, dist: 10 },
    attacks: [{ name: 'spit', range: [5, 42], windup: 0.85, active: 0.2, recover: 0.8, ranged: { spd: 23, dmg: 20, r: 0.5, col: '#cfa860', count: 5, spread: 0.18, gravity: 8, life: 4, poise: 36 } }],
  },
};
RIGS.worm = () => buildWormRig();

/* ───────────── the brain: burrowing on top of the ordinary fight ───────────── */
function wormBrain(e, dt) {
  const W = e.worm || (e.worm = { mode: 'up', t: 9, next: rnd(10, 13), farT: 0 });
  W.t += dt;
  const N = DC_SPOTS.nest;
  if (W.mode === 'up') {
    if (e.state === 'chase' || e.state === 'circle') {
      W.next -= dt; W.farT = e.dist() > 13 ? W.farT + dt : 0;
      if (W.next <= 0 || W.farT > 2.6) { e.releaseToken(); W.mode = 'sinking'; W.t = 0; e.set('recover'); e.recoverT = 99; BUS.emit('sfx', { id: 'pillar', pos: e.pos }); }
    }
    return false;                                          // the ordinary brain: attacks from where it stands
  }
  e.body.vel.x = e.body.vel.z = 0;
  if (W.mode === 'sinking') {
    if (W.t > 0.9) { W.mode = 'under'; W.t = 0; e.inactive = true; e.lockable = false; if (CAM.lockTarget === e) CAM.lockTarget = null; }
    return true;
  }
  if (W.mode === 'under') {
    // a ripple of sand runs at you, then the ground under you lights up
    const p = PL.body.pos, dx = p.x - e.pos.x, dz = p.z - e.pos.z, d = Math.hypot(dx, dz), sp = 15 * dt;
    if (d > 0.1) { e.pos.x += dx / d * Math.min(sp, d); e.pos.z += dz / d * Math.min(sp, d); }
    // (it stays in its bowl)
    const ox = e.pos.x - N.x, oz = e.pos.z - N.z, od = Math.hypot(ox, oz), lim = N.r * 0.92;
    if (od > lim) { e.pos.x = N.x + ox / od * lim; e.pos.z = N.z + oz / od * lim; }
    e.pos.y = heightAt(e.pos.x, e.pos.z);
    if (Math.random() < 0.8) emit(3, { pool: 'soft', pos: e.pos.clone().setY(e.pos.y + 0.2), col: '#c9a66a', spread: 1.2, velSpread: 2.5, upBias: 2.5, life: 0.9, size: 0.5, size2: 1.4, gravity: 4 });
    if (W.t > 1.5 || d < 1.2) {
      W.mode = 'rising'; W.t = 0; W.at = e.pos.clone();
      hostileAoE(W.at, 4.2, 0.95, 42, { poise: 80, unblockable: true, dust: '#c9a66a' });
    }
    return true;
  }
  if (W.mode === 'rising') {
    if (W.t > 0.95) {
      W.mode = 'up'; W.t = 0; W.next = rnd(10, 14) / (e.phase2 ? 1.6 : 1); W.farT = 0;
      e.inactive = false; e.lockable = true;
      e.face = e.angleToPlayer();
      shake(0.7); BUS.emit('sfx', { id: 'howl', pos: e.pos });
      emit(60, { pool: 'soft', pos: e.pos.clone().setY(e.pos.y + 0.6), col: '#c9a66a', spread: 2.5, velSpread: 6, upBias: 5, life: 1.6, size: 0.9, size2: 2.6, gravity: 5 });
      e.set('recover'); e.recoverT = 1.4;
    }
    return true;
  }
  return false;
}

/* ───────────── the body ───────────── */
const _smQ = new THREE.Quaternion(), _smUp = new THREE.Vector3(0, 1, 0), _smT = new THREE.Vector3(), _smP = new THREE.Vector3(), _smP2 = new THREE.Vector3();
function buildWormRig() {
  const mat = toonMat({ vertexColors: true, rim: true });
  const plate = '#9a7a52', plateD = '#5e4632', belly = '#c9a476', flesh = '#b5525e', tooth = '#efe6cf';
  const ball = new THREE.IcosahedronGeometry(1, 2), band = new THREE.TorusGeometry(1, 0.14, 6, 16), spike = new THREE.ConeGeometry(0.22, 0.9, 5);
  const root = new THREE.Group(), N = 15, segs = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), r = 1.25 + Math.sin(t * Math.PI * 0.9 + 0.2) * 0.65;
    const pieces = [[ball, i % 2 ? plate : belly, 0, 0, 0, r, r * 0.78, r], [band, plateD, 0, 0.05, 0, r * 1.02, r * 1.02, 1.2, Math.PI / 2, 0, 0]];
    if (i % 2 === 0 && i > 1) for (let s = 0; s < 3; s++) { const a = s / 3 * TAU + i; pieces.push([spike, plateD, Math.cos(a) * r * 0.9, 0.2, Math.sin(a) * r * 0.9, 1, 1, 1, Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1]); }
    const g = new THREE.Group(); g.add(mergedPart(pieces, mat)); root.add(g); segs.push({ g, r, t });
  }
  // the maw: a plated collar, wet flesh inside, a ring of teeth, three petals hinged at the rim
  const head = new THREE.Group(); root.add(head);
  const teeth = [];
  for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; teeth.push([new THREE.ConeGeometry(0.16, 0.7, 4), tooth, Math.cos(a) * 1.35, 0.75, Math.sin(a) * 1.35, 1, 1, 1, Math.sin(a) * 2.1, 0, -Math.cos(a) * 2.1]); }
  head.add(mergedPart([
    [new THREE.CylinderGeometry(1.75, 1.95, 1.3, 16, 1, true), plateD, 0, 0.2, 0],
    [new THREE.CircleGeometry(1.6, 16), flesh, 0, 0.55, 0, 1, 1, 1, -Math.PI / 2, 0, 0],
    [new THREE.CircleGeometry(0.7, 12), '#3a1418', 0, 0.58, 0, 1, 1, 1, -Math.PI / 2, 0, 0],
    ...teeth,
  ], mat));
  const petals = [];
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * TAU, hinge = new THREE.Group();
    hinge.position.set(Math.cos(a) * 1.8, 0.8, Math.sin(a) * 1.8); hinge.rotation.y = -a;
    const pet = mergedPart([[new THREE.ConeGeometry(1.1, 3.0, 5), plate, 0, 1.4, 0, 1, 1, 0.45], [new THREE.ConeGeometry(0.85, 2.6, 5), flesh, -0.05, 1.3, 0, 1, 1, 0.3]], mat);
    hinge.add(pet); head.add(hinge); petals.push(hinge);
  }
  const eyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb04a').multiplyScalar(2.4) });
  for (const s of [-1, 1]) for (const k of [0, 1]) { const ey = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), eyeM); ey.position.set(s * (0.9 + k * 0.35), -0.1 - k * 0.25, 1.55); head.add(ey); }
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // a dark ring of churned sand round where it stands
  const hole = new THREE.Mesh(new THREE.RingGeometry(1.6, 4.6, 24), new THREE.MeshBasicMaterial({ color: '#3e2e20', transparent: true, opacity: 0.55, depthWrite: false }));
  hole.rotation.x = -Math.PI / 2; hole.position.y = 0.06; root.add(hole);
  const P = { rise: 0, lean: 3, sway: 0, rear: 0, open: 0.15 };
  return {
    root, segs, head, petals, P, deadT: -1, t: Math.random() * 10,
    update(dt, e) {
      this.t += dt;
      const W = e.worm, st = e.state, a = e.attack, k = (x, s = 6) => 1 - Math.exp(-s * dt);
      // the pose this moment wants
      let rise = 1, lean = 3 + Math.sin(this.t * 0.9) * 0.6, sway = Math.sin(this.t * 0.6) * 1.2, rear = 0, open = 0.15 + Math.sin(this.t * 2) * 0.08;
      if (st === 'dormant') rise = 0;
      if (st === 'awaken') rise = smooth(0, 1, e.stateT / (e.awakeT || 2.4));
      if (W && (W.mode === 'sinking' || W.mode === 'under' || W.mode === 'rising')) rise = W.mode === 'sinking' ? 1 - smooth(0, 0.9, W.t) : 0;
      if (W && W.mode === 'up' && W.t < 0.6) rise = smooth(0, 0.6, W.t);
      if (a && st === 'windup') {
        const w = clamp(e.stateT / (e.windup || 1), 0, 1);
        if (a.name === 'slam') { lean = lerp(3, -1.5, w); rear = 1.5 * w; open = 0.6 * w; }
        if (a.name === 'sweep') { sway = lerp(sway, -5, w); lean = 4; }
        if (a.name === 'spit') { rear = 1.2 * w; open = 1 * w; lean = 2; }
      }
      if (a && st === 'active') {
        if (a.name === 'slam') { lean = 8.5; rear = 0; open = 0.9; rise = 0.85; }
        if (a.name === 'sweep') { sway = 5; lean = 4.5; }
        if (a.name === 'spit') { lean = 4.5; open = 1; }
      }
      if (e.dead) { this.deadT = this.deadT < 0 ? 0 : this.deadT + dt; lean = 9 + this.deadT; rise = Math.max(0, 0.8 - this.deadT * 0.18); open = 0.4; }
      const fast = st === 'active' ? 14 : 5;
      P.rise += (rise - P.rise) * k(0, fast); P.lean += (lean - P.lean) * k(0, fast); P.sway += (sway - P.sway) * k(0, fast);
      P.rear += (rear - P.rear) * k(0, fast); P.open += (open - P.open) * k(0, 8);
      this.root.visible = P.rise > 0.02 || st === 'awaken';
      hole.visible = st !== 'dormant';
      // the curve: from under the sand, up, leaning toward its prey
      const H = 8.2, base = -1.4 - (1 - P.rise) * (H + 2);
      const at = (t, out) => out.set(P.sway * Math.sin(t * Math.PI) * 0.8, base + H * Math.pow(Math.sin(t * Math.PI / 2), 0.85), P.lean * t * t - P.rear * Math.sin(t * Math.PI) * 0.8);
      for (const S of this.segs) {
        at(S.t, _smP); at(Math.min(1, S.t + 0.04), _smP2);
        S.g.position.copy(_smP);
        S.g.quaternion.setFromUnitVectors(_smUp, _smT.subVectors(_smP2, _smP).normalize());
        S.g.position.y += Math.sin(this.t * 3 + S.t * 6) * 0.04;
      }
      at(1, _smP); at(0.96, _smP2);
      this.head.position.copy(_smP);
      this.head.quaternion.setFromUnitVectors(_smUp, _smT.subVectors(_smP, _smP2).normalize());
      for (const pt of this.petals) pt.rotation.x = -0.15 - P.open * 1.1;
      if (P.rise > 0.3 && !e.dead && Math.random() < dt * 3) emit(2, { pool: 'soft', pos: _smP.set(e.pos.x, e.pos.y + 0.3, e.pos.z), col: '#c9a66a', spread: 2, velSpread: 1.2, upBias: 1, life: 1.2, size: 0.6, size2: 1.6, gravity: 2 });
    },
    weaponPos(out) { return this.head.getWorldPosition(out); },
  };
}

/* ───────────── the fight, and what comes after ───────────── */
const MOTHER_LINES = {
  intro: [
    { t: 'The sand inhales.' },
    { s: 'Ruijerd Superdia', t: 'Empty yourself if you must. I will hold it off while you rise. That is what a party is.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: 'It\'s HUGE. ...Good. More to hit!' },
  ],
  win: [
    { t: 'The Sand Mother goes down the way a tower does: slowly, then everywhere.' },
    { s: 'Ruijerd Superdia', t: 'It is done. The caravans will run again.' },
    { s: 'Ruijerd Superdia', t: 'You emptied yourself and got back up. Again and again. Most people call that stupidity.' },
    { s: 'Ruijerd Superdia', t: 'I have decided to call it Dead End.' },
    { p: 'eris', s: 'Eris Boreas Greyrat', t: '...We\'re really doing this, aren\'t we. Walking home. All the way.' },
    { t: 'All the way. One caravan, one city, one fight at a time — and the name Dead End going ahead of you.' },
  ],
};
function defineMotherEncounter() {
  const N = DC_SPOTS.nest;
  defineEncounter('sandMother', N.x, N.z, [['sandMother', 0, 0, { dormant: true, face: Math.PI * 1.25 }]], {
    boss: true,
    onClear: () => {
      G.flags.sandMother = true;
      // her brood doesn't outlive her
      for (const e of [...ENT.enemies]) if (!e.dead && e.key === 'rustScorp' && Math.hypot(e.pos.x - N.x, e.pos.z - N.z) < N.r + 30) {
        killEnemy(e); emit(16, { pool: 'soft', pos: e.pos.clone().setY(e.pos.y + 0.4), col: '#c9a66a', spread: 0.8, velSpread: 3, upBias: 2, life: 1, size: 0.5, size2: 1.2, gravity: 4 });
      }
      banner('Great Enemy Felled', 'The Sand Mother');
      later(3, () => motherFelled());
    },
  });
}
function updateSandMother() {
  if (!G || !DEMON.built || DCS.busy || UI.dlg) return;
  const N = DC_SPOTS.nest, p = PL.body.pos, d = Math.hypot(p.x - N.x, p.z - N.z);
  if (d > N.r * 0.62 || PL.state === 'dead') return;
  const m = ENT.enemies.find(e => e.key === 'sandMother' && e.state === 'dormant' && !e.dead);
  if (!m) return;
  if (G.quest === 'dcNest') setQuest('dcBoss', { quiet: true });
  wakeMother(m);
}
async function wakeMother(m) {
  m.wake(1);
  shake(0.9);
  BUS.emit('sfx', { id: 'pillar', pos: m.pos }); BUS.emit('sfx', { id: 'howl', pos: m.pos });
  emit(80, { pool: 'soft', pos: m.pos.clone().setY(m.pos.y + 0.5), col: '#c9a66a', spread: 5, velSpread: 6, upBias: 5, life: 2.2, size: 1.2, size2: 3.4, gravity: 4 });
  if (!G.flags.motherSeen) {
    G.flags.motherSeen = true;
    bossCard('The Sand Mother', 'What eats the caravans');
    BUS.emit('sfx', { id: 'bossIntro' });
    later(2.8, () => say(say$(MOTHER_LINES.intro)));
  }
}
async function motherFelled() {
  if (!DC_QUESTS.has(G.quest) || G.quest === 'dcDone') return;
  DCS.busy = true;
  try {
    await say(say$(MOTHER_LINES.win));
    setQuest('dcDone', { quiet: true });
    G.flags.m3done = true;
    showEndcard('m3');
  } finally { DCS.busy = false; }
}
