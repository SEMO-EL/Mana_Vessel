/* ═══════════════════════════════════════════════════════════════════════
   BOSSES — the Barrow Warden (cave) and the Elder Treant (Heart Grove).

   Both run on the ordinary Enemy brain; what makes them bosses is data:
   bigger numbers, a second phase, and HOSTILE AREA ATTACKS — a ring is
   drawn on the ground where the blow will land, then it lands. Stand in
   the ring when it fills and you pay for it.
   ═══════════════════════════════════════════════════════════════════════ */
ENEMY_DEFS.warden = {
  name: 'The Barrow Warden', base: 'Skeleton_Warrior', borrow: [['Knight', '2H_Sword', 'handslotr']],
  hp: 1350, poise: 170, r: 1.1, h: 1.8, walk: 1.5, run: 4.2, sight: 40, hear: 40,
  xp: 520, weight: 4, flinchAt: 999, undead: true, knockRes: 1, boss: true, wakeR: 0,   // lies in state until the mist is crossed
  idle: 'Idle_Combat', walkClip: 'Walking_D_Skeletons', runClip: 'Running_C', deathClip: 'Death_C_Skeletons',
  attacks: [
    { clip: '2H_Melee_Attack_Chop',  speed: 0.8,  hitAt: 0.46, range: [0, 5],   reach: 4.4, arc: 0.55, dmg: 34, poise: 60, lunge: 2, shock: 5 },
    { clip: '2H_Melee_Attack_Slice', speed: 0.85, hitAt: 0.42, range: [0, 5],   reach: 4.8, arc: 1.7,  dmg: 28, poise: 45, lunge: 1.5 },
    { clip: '2H_Melee_Attack_Stab',  speed: 0.9,  hitAt: 0.5,  range: [4, 11],  reach: 4.2, arc: 0.4,  dmg: 32, poise: 55, lunge: 10, unblockable: true },
  ],
  phase2: {
    at: 0.55, speedMul: 1.25, summon: { key: 'thrall', n: 3, rise: true },   // a roar that raises the dead
    attacks: [
      { clip: '2H_Melee_Attack_Spin', speed: 1.0, hitAt: 0.3, range: [0, 5.5], reach: 5.0, arc: 3.14, dmg: 30, poise: 60, lunge: 2, unblockable: true, activeMul: 3 },
    ],
  },
};
ENEMY_DEFS.treant = {
  name: 'The Elder Treant', rig: 'treant', hp: 1100, poise: 150, r: 1.6, h: 6.5, walk: 1.5, run: 2.6, sight: 40, hear: 40,
  xp: 460, weight: 4, flinchAt: 999, knockRes: 1, boss: true, fireWeak: 1.6,
  wakeR: 16, wakeT: 2.2,      // stands as a tree until you come close (or strike it)
  attacks: [
    { name: 'slam',  range: [0, 6],  windup: 1.0, active: 0.2, recover: 1.1, reach: 6, arc: 0.6, dmg: 32, poise: 60, aoe: { r: 3.6, at: 'front', dist: 4.4 } },
    { name: 'sweep', range: [0, 6],  windup: 0.9, active: 0.3, recover: 1.0, reach: 6.2, arc: 2.2, dmg: 26, poise: 40 },
    { name: 'roots', range: [5, 24], windup: 0.6, active: 0.1, recover: 1.2, dmg: 30, poise: 50, aoe: { r: 3.2, at: 'target', delay: 1.1 } },
    { name: 'stomp', range: [0, 4.5], windup: 1.1, active: 0.1, recover: 1.2, dmg: 24, poise: 70, aoe: { r: 5.5, at: 'self' }, unblockable: true },
  ],
};

/* ───────────── hostile area attacks ───────────── */
function hostileAoE(pos, r, delay, dmg, o = {}) {
  const circle = runeCircle('#ff5a3a');
  circle.position.copy(pos).setY(groundAt(pos.x, pos.z, pos.y + 2) + 0.12);
  circle.scale.setScalar(r * 2);
  MAGIC.effects.push({ kind: 'hostileAoE', pos: circle.position.clone(), r, delay, t: 0, dmg, o, circle });
}
/* ───────────── the Elder Treant rig ───────────── */
function buildTreantRig() {
  const bark = toonMat({ color: '#4a3a2a', rim: true }), barkL = toonMat({ color: '#6a5540', rim: true });
  const leaf = toonMat({ color: '#35502a' }), leafL = toonMat({ color: '#557a38' });
  const eyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#d8ff6a').multiplyScalar(2.5) });
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 1.6; root.add(body);
  const trunkG = new THREE.CylinderGeometry(0.95, 1.35, 5.2, 9, 5); trunkG.translate(0, 2.4, 0);
  const tp = trunkG.attributes.position, tn = Noise.make(91);
  for (let i = 0; i < tp.count; i++) { const k = 1 + tn(tp.getX(i) * 1.3 + tp.getY(i) * 0.4, tp.getZ(i) * 1.3) * 0.14; tp.setX(i, tp.getX(i) * k); tp.setZ(i, tp.getZ(i) * k); }
  trunkG.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkG, bark); trunk.castShadow = true; body.add(trunk);
  // face
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), eyeM); e.position.set(s * 0.38, 3.6, 1.05); body.add(e); }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.2), new THREE.MeshBasicMaterial({ color: '#0a0806' })); mouth.position.set(0, 2.9, 1.12); body.add(mouth);
  // crown
  const crown = new THREE.Group(); crown.position.y = 5.2; body.add(crown);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU, r = i === 0 ? 0 : 1.6;
    const b = new THREE.Mesh(canopyBlob(i === 0 ? 2.2 : 1.5, 1, 90 + i), i % 2 ? leaf : leafL);
    b.position.set(Math.cos(a) * r, 0.6 + (i === 0 ? 0.8 : 0), Math.sin(a) * r); b.castShadow = true;
    crown.add(b);
  }
  // arms: shoulder -> elbow -> twig hand
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 1.05, 4.1, 0.2); body.add(sh);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.6, 7).translate(0, -1.3, 0), barkL); up.castShadow = true; sh.add(up);
    const el = new THREE.Group(); el.position.y = -2.5; sh.add(el);
    const fo = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 7).translate(0, -1.2, 0), bark); fo.castShadow = true; el.add(fo);
    for (let k = 0; k < 4; k++) {
      const tw = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.1, 4).translate(0, -0.5, 0), bark);
      tw.position.y = -2.3; tw.rotation.set((k - 1.5) * 0.35, 0, (k % 2 ? 1 : -1) * 0.3); el.add(tw);
    }
    arms.push({ sh, el, s });
  }
  // root legs
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + Math.PI / 4;
    const hip = new THREE.Group(); hip.position.set(Math.cos(a) * 0.7, 1.5, Math.sin(a) * 0.7); root.add(hip);
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 2.0, 6).translate(0, -1, 0), bark); lg.castShadow = true;
    lg.rotation.z = -Math.cos(a) * 0.5; lg.rotation.x = Math.sin(a) * 0.5;
    hip.add(lg);
    legs.push({ hip, a });
  }
  return {
    root, body, arms, legs, crown, eyeM, phase: 0, deadT: -1, raise: 0,
    update(dt, e) {
      const sp = Math.hypot(e.body.vel.x, e.body.vel.z);
      this.phase += dt * sp * 1.8;
      const t = GAME.time;
      // asleep it is only a tree: arms raised as boughs, eyes dark. It wakes over ~2 s.
      this.wakeK = damp(this.wakeK ?? (e.state === 'dormant' ? 0 : 1), e.state === 'dormant' ? 0 : 1, 1.6, dt);
      const sleep = 1 - this.wakeK;
      this.legs.forEach((L, i) => { L.hip.position.y = 1.5 + Math.max(0, Math.sin(this.phase + i * Math.PI / 2)) * 0.35 * Math.min(1, sp); });
      this.body.rotation.z = Math.sin(this.phase) * 0.04 * Math.min(1, sp) + Math.sin(t * 0.7) * 0.015;
      this.crown.rotation.y = Math.sin(t * 0.5) * 0.08;
      // arm poses by attack
      const a = e.attack, st = e.state;
      const w = st === 'windup' ? clamp(e.stateT / (e.windup || 1), 0, 1) : 0;
      let lUp = 0.3, rUp = 0.3, swing = 0;
      if (a && (st === 'windup' || st === 'active')) {
        if (a.name === 'slam') { rUp = st === 'windup' ? -2.4 * w : 0.9; }
        if (a.name === 'sweep') { swing = st === 'windup' ? -1.2 * w : 1.4; lUp = rUp = -0.4; }
        if (a.name === 'roots') { lUp = rUp = -1.2 * w; }
        if (a.name === 'stomp') { this.body.position.y = 1.6 + (st === 'windup' ? w * 0.9 : -0.3); }
      } else this.body.position.y = damp(this.body.position.y, 1.6, 8, dt);
      lUp = lerp(lUp, -2.75, sleep); rUp = lerp(rUp, -2.6, sleep);
      this.arms[0].sh.rotation.x = damp(this.arms[0].sh.rotation.x, lUp, 8, dt);
      this.arms[1].sh.rotation.x = damp(this.arms[1].sh.rotation.x, rUp, 8, dt);
      if (e.state === 'awaken') this.crown.rotation.z = Math.sin(t * 23) * 0.05 * sleep;   // the shudder as it wakes
      else this.crown.rotation.z = damp(this.crown.rotation.z, 0, 6, dt);
      this.body.rotation.y = damp(this.body.rotation.y, swing, 6, dt);
      this.arms.forEach(A => { A.el.rotation.x = -0.4 + Math.sin(t * 1.3 + A.s) * 0.05; A.sh.rotation.z = A.s * 0.25; });
      this.eyeM.color.setRGB(2.2 + w * 1.5, 2.5 - w * 1.2, 0.8 - w * 0.6).multiplyScalar(this.wakeK * this.wakeK);
      if (e.dead) { this.deadT = this.deadT < 0 ? 0 : this.deadT + dt; this.root.rotation.x = smooth(0, 1.6, this.deadT) * 1.45; }
    },
    weaponPos(out) { return this.arms[1].el.getWorldPosition(out); },
  };
}

/* ═══════════════ Roa ═══════════════ */
// Dust jackals: the outskirts' wolves — sandy, lighter, quicker, in packs.
ENEMY_DEFS.jackal = {
  name: 'Dust Jackal', rig: 'wolf', scale: 0.82, tint: '#9c8458', hp: 44, poise: 16, r: 0.48, h: 0.8, walk: 2.6, run: 9.8, sight: 26, hear: 16,
  xp: 14, weight: 1, pack: true, flinchAt: 9, knockRes: 0,
  attacks: [
    { name: 'bite',   range: [0, 2.1], windup: 0.36, active: 0.12, recover: 0.5, reach: 1.8, arc: 0.8, dmg: 10, poise: 14, lunge: 3.5 },
    { name: 'pounce', range: [3, 7.5], windup: 0.55, active: 0.34, recover: 0.8, reach: 1.6, arc: 1.0, dmg: 15, poise: 26, leap: 12 },
  ],
};
// The captain of Wagonbreak Camp: a field boss with a great axe and a whistle.
ENEMY_DEFS.captain = {
  name: 'Brannoc, Brigand Captain', base: 'Barbarian', show: ['2H_Axe'], hide: ['Barbarian_Hat'], scale: 1.2,
  recolor: { barbarian: { 1: '#2e1c14', 8: '#5a2a22', 9: '#3a221a', 6: '#4a3a2c', 21: '#5a2a22' } },
  hp: 460, poise: 110, r: 0.55, h: 2.05, walk: 1.6, run: 4.6, sight: 30, hear: 18, xp: 180,
  weight: 3, flinchAt: 999, knockRes: 0.7, boss: true,
  idle: '2H_Melee_Idle', walkClip: 'Walking_B', runClip: 'Running_A',
  attacks: [
    { clip: '2H_Melee_Attack_Chop',  speed: 0.85, hitAt: 0.48, range: [0, 3.3], reach: 3.1, arc: 0.7, dmg: 30, poise: 55, lunge: 3, shock: 3.4 },
    { clip: '2H_Melee_Attack_Slice', speed: 0.9,  hitAt: 0.42, range: [0, 3.3], reach: 3.3, arc: 1.8, dmg: 24, poise: 40, lunge: 2 },
    { clip: '1H_Melee_Attack_Jump_Chop', speed: 0.85, hitAt: 0.5, range: [4, 9], reach: 2.9, arc: 0.8, dmg: 34, poise: 60, lunge: 9, unblockable: true },
  ],
  phase2: {
    at: 0.4, speedMul: 1.15, summon: { key: 'bandit', n: 2, dist: 10 },
    attacks: [
      { clip: '2H_Melee_Attack_Spin', speed: 1.0, hitAt: 0.3, range: [0, 3.6], reach: 3.5, arc: 3.14, dmg: 24, poise: 45, lunge: 1.5, activeMul: 2.5 },
    ],
  },
};
// Ghislaine Dedoldia: a beastfolk Sword Saint — ears, white hair, dark skin,
// a sword borrowed from the Knight's rack. Eris: crimson hair, a sword too.
const catEars = a => {
  const m = toonMat({ color: '#d8d2c8' }), inner = toonMat({ color: '#8a6a5a' }), head = a.bones.head;
  if (!head) return;
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), m);
    ear.position.set(s * 0.32, 1.05, 0.02); ear.rotation.set(0, Math.PI / 4, s * -0.32);
    const inn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), inner);
    inn.position.set(0, -0.05, 0.05); ear.add(inn);
    ear.castShadow = true; head.add(ear);
  }
};
const swordInHand = a => { if (borrowMesh(a, 'Knight', '1H_Sword', 'handslotr')) a.show('1H_Sword', true); };
const ERIS_SPEC = { base: 'Rogue', recolor: { rogue: { 1: '#b8262f', 8: '#7a1f2b', 21: '#7a1f2b', 9: '#3a2228', 6: '#efe4d2' } }, extra: [swordInHand] };
// (the Rogue's body, not the Barbarian's: his beard is baked into the head)
const GHIS_SPEC = { base: 'Rogue', scale: 1.1,
  recolor: { rogue: { 1: '#dcd6cc', 0: '#5e3c28', 23: '#5e3c28', 8: '#2c2622', 21: '#2c2622', 9: '#3d342c', 6: '#4a3a30' } },
  extra: [catEars, swordInHand] };
// Sparring, she guards almost everything from the front, swings fast and
// commits, and yields at half — she is teaching, not fighting.
ENEMY_DEFS.ghisSpar = {
  name: 'Ghislaine Dedoldia', ...GHIS_SPEC,
  hp: 380, poise: 90, r: 0.42, h: 1.85, walk: 2.3, run: 6.6, sight: 40, hear: 40, xp: 120, weight: 1, flinchAt: 14, spar: true,
  shield: 0.9, guardPoise: 0.22, flinchCd: 2.4, armorWindup: true,
  idle: '2H_Melee_Idle', walkClip: 'Walking_B', runClip: 'Running_A',
  attacks: [
    { clip: '1H_Melee_Attack_Slice_Diagonal',   speed: 1.25, hitAt: 0.4,  range: [0, 2.8], reach: 2.6, arc: 1.1, dmg: 11, poise: 22, lunge: 4 },
    { clip: '1H_Melee_Attack_Slice_Horizontal', speed: 1.3,  hitAt: 0.38, range: [0, 2.8], reach: 2.7, arc: 1.6, dmg: 10, poise: 20, lunge: 3 },
    { clip: '1H_Melee_Attack_Stab',             speed: 1.2,  hitAt: 0.42, range: [2, 5.5], reach: 3.4, arc: 0.45, dmg: 14, poise: 28, lunge: 10 },
  ],
};

// The First Golem: masonry from the First Wall that stands up when trespassed
// on. Steel barely marks it; soaked stone cracks (water ×1.5). Phase two at
// half: the core burns brighter, it shakes the arena, and the floor bites.
ENEMY_DEFS.golem = {
  name: 'The First Golem', rig: 'golem', hp: 1500, poise: 220, r: 1.6, h: 5.2, walk: 1.25, run: 2.6, sight: 44, hear: 44,
  xp: 620, weight: 5, flinchAt: 999, knockRes: 1, boss: true, wakeR: 0, wakeT: 2.8, steelRes: 0.55, waterWeak: 1.5,
  attacks: [
    { name: 'slam',  range: [0, 5.6], windup: 1.1,  active: 0.2, recover: 1.2, reach: 5.2, arc: 0.7, dmg: 36, poise: 70, aoe: { r: 3.8, at: 'front', dist: 4.3 } },
    { name: 'sweep', range: [0, 5.6], windup: 0.95, active: 0.3, recover: 1.0, reach: 5.8, arc: 2.2, dmg: 28, poise: 45 },
    { name: 'hurl',  range: [9, 36],  windup: 1.25, active: 0.2, recover: 1.1, ranged: { spd: 25, dmg: 32, r: 0.95, col: '#8c7a62', gravity: 9, rock: true, life: 4, poise: 60 } },
  ],
  phase2: {
    at: 0.5, speedMul: 1.25,
    attacks: [
      { name: 'quake',  range: [0, 7],  windup: 1.25, active: 0.1, recover: 1.4, dmg: 30, poise: 80, aoe: { r: 6.8, at: 'self' }, unblockable: true },
      { name: 'spikes', range: [6, 30], windup: 0.8,  active: 0.1, recover: 1.2, dmg: 26, poise: 50, aoe: { r: 3.0, at: 'target', delay: 1.0 } },
    ],
  },
};
const _gv = new THREE.Vector3(), _gv2 = new THREE.Vector3();
function buildGolemRig() {
  const stone = toonMat({ color: '#7d7466', rim: true }), stoneD = toonMat({ color: '#5f574c', rim: true }), moss = toonMat({ color: '#5d6c3a' });
  const glowM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffae4a').multiplyScalar(2.2) });
  const nz = Noise.make(707);
  const rock = (r, mat, sx = 1, sy = 1, sz = 1, seed = 0) => {
    const g = new THREE.DodecahedronGeometry(r, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + nz(p.getX(i) * 1.7 + seed, p.getY(i) * 1.7 + p.getZ(i)) * 0.17; p.setXYZ(i, p.getX(i) * k * sx, p.getY(i) * k * sy, p.getZ(i) * k * sz); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 2.0; root.add(hips);
  const torso = rock(1.45, stone, 1.25, 0.95, 1.0, 1); torso.position.y = 0.9; hips.add(torso);
  const chest = new THREE.Group(); chest.position.y = 1.9; hips.add(chest);
  const chestR = rock(1.35, stoneD, 1.35, 0.9, 1.0, 2); chestR.position.y = 0.4; chest.add(chestR);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), glowM); core.position.set(0, 0.35, 1.18); chest.add(core);
  const head = rock(0.62, stone, 1.1, 0.9, 1, 3); head.position.set(0, 1.55, 0.25); chest.add(head);
  for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.05), glowM); eye.position.set(s * 0.22, 1.6, 0.85); chest.add(eye); }
  for (const s of [-1, 1]) { const mm = rock(0.55, moss, 1.3, 0.45, 1, 4 + s); mm.position.set(s * 1.25, 1.05, -0.1); chest.add(mm); }
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 1.75, 0.75, 0); chest.add(sh);
    const shoulder = rock(0.72, stoneD, 1, 1, 1, 6 + s); sh.add(shoulder);
    const up = rock(0.55, stone, 0.9, 1.5, 0.9, 7 + s); up.position.y = -1.0; sh.add(up);
    const el = new THREE.Group(); el.position.y = -1.85; sh.add(el);
    const fore = rock(0.5, stone, 0.9, 1.5, 0.9, 8 + s); fore.position.y = -0.7; el.add(fore);
    const fist = rock(0.82, stoneD, 1, 0.95, 1, 9 + s); fist.position.y = -1.55; el.add(fist);
    arms.push({ sh, el, fist, s });
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.85, 0.1, 0); hips.add(hip);
    const leg = rock(0.62, stoneD, 1, 1.75, 1, 11 + s); leg.position.y = -1.1; hip.add(leg);
    legs.push({ hip, s });
  }
  // the assembly: every rock remembers where it belongs and where it lay
  const parts = [];
  root.traverse(o => { if (o.isMesh && o.material !== glowM) parts.push({ o, home: o.position.clone(), rot: o.rotation.clone() }); });
  const R = mulberry32(99);
  for (const p of parts) p.scatter = new THREE.Vector3((R() - 0.5) * 7, 0, (R() - 0.5) * 7);
  const glowParts = [core];
  root.traverse(o => { if (o.isMesh && o.material === glowM && o !== core) glowParts.push(o); });
  return {
    root, hips, chest, core, glowM, arms, legs, parts, glowParts, phase: 0, wakeK: -1, deadT: -1,
    update(dt, e) {
      const t = GAME.time, st = e.state, a = e.attack;
      // assembled-ness: 0 lying in the dust, 1 standing — the rocks fly home in turn
      const want = st === 'dormant' ? 0 : 1;
      this.wakeK = this.wakeK < 0 ? want : clamp(this.wakeK + (want ? dt / 2.6 : -dt), 0, 1);
      const settling = this.wakeK < 1 || this.deadT >= 0;
      for (const g of this.glowParts) g.visible = this.wakeK > 0.25 && this.deadT < 0;
      if (settling) {
        this.root.updateMatrixWorld(true);
        this.parts.forEach((p, i) => {
          const k = this.deadT >= 0 ? 1 - smooth(i * 0.04, i * 0.04 + 0.7, this.deadT) : smooth(i * 0.035, i * 0.035 + 0.45, this.wakeK * 1.4);
          // home is in the part's parent frame; lying, a rock rests in the dust around the golem's feet
          const lie = _gv.copy(p.scatter); lie.y = 0.45;
          this.root.localToWorld(lie); p.o.parent.worldToLocal(lie);
          const kk = k * k * (3 - 2 * k);
          p.o.position.lerpVectors(lie, p.home, kk);
          p.o.rotation.x = p.rot.x + (1 - kk) * ((i % 3) - 1);
          p.o.rotation.z = p.rot.z + (1 - kk) * ((i % 2) - 0.5);
        });
      }
      if (this.deadT >= 0) { this.deadT += dt; return; }
      if (e.dead) { this.deadT = 0; return; }
      if (st === 'dormant') return;
      const sp = Math.hypot(e.body.vel.x, e.body.vel.z), mv = Math.min(1, sp);
      this.phase += dt * sp * 1.4;
      this.legs.forEach((L, i) => { L.hip.rotation.x = Math.sin(this.phase + i * Math.PI) * 0.45 * mv; });
      this.hips.rotation.z = Math.sin(this.phase) * 0.05 * mv;
      const w = st === 'windup' ? clamp(e.stateT / (e.windup || 1), 0, 1) : 0;
      let lUp = 0.15 + Math.sin(this.phase) * 0.3 * mv, rUp = 0.15 - Math.sin(this.phase) * 0.3 * mv, twist = 0, lift = 0;
      if (a && (st === 'windup' || st === 'active')) {
        if (a.name === 'slam') { lUp = rUp = st === 'windup' ? -2.7 * w : 0.6; }
        if (a.name === 'sweep') { twist = st === 'windup' ? -1.0 * w : 1.2; rUp = -1.3; }
        if (a.name === 'hurl') { rUp = st === 'windup' ? -2.9 * w : 0.4; lUp = 0.5; twist = st === 'windup' ? -0.5 * w : 0.4; }
        if (a.name === 'quake') { lift = st === 'windup' ? w * 1.2 : -0.5; lUp = rUp = -1.6 * w; }
        if (a.name === 'spikes') { lUp = rUp = -2.2 * w; }
      }
      this.hips.position.y = damp(this.hips.position.y, 2.0 + Math.abs(Math.sin(this.phase)) * 0.12 * mv + lift, 10, dt);
      this.arms[0].sh.rotation.x = damp(this.arms[0].sh.rotation.x, lUp, 9, dt);
      this.arms[1].sh.rotation.x = damp(this.arms[1].sh.rotation.x, rUp, 9, dt);
      for (const A of this.arms) { A.el.rotation.x = -0.35; A.sh.rotation.z = A.s * 0.12; }
      this.chest.rotation.y = damp(this.chest.rotation.y, twist, 7, dt);
      // the core: embers at rest, a forge in phase two, flaring as a blow winds up
      const pulse = e.phase2 ? 1.6 + Math.sin(t * 7) * 0.4 : 1;
      this.glowM.color.setRGB(2.2, 1.35, 0.55).multiplyScalar(this.wakeK * this.wakeK * (pulse + w * 0.8));
      this.core.rotation.y += dt * (e.phase2 ? 3 : 1);
      if (e.phase2 && Math.random() < dt * 6) emit(1, { pos: this.core.getWorldPosition(_gv2), col: '#ffb04a', col2: '#ff6a20', vel: { x: 0, y: 1.2, z: 0 }, velSpread: 0.8, life: 0.7, size: 0.25, bright: 2 });
    },
    weaponPos(out) { return this.arms[1].fist.getWorldPosition(out); },
  };
}
