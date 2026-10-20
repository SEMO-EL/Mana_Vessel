/* ═══════════════════════════════════════════════════════════════════════
   THE WASTE'S WILD — what hunts on the Demon Continent, and the storm.

   Black wolves in threes, rust scorpions in the canyon, ogres where the
   ground is open (slow, and strong enough that slow doesn't matter), a
   black alpha at the bones, and in the storm: wisps made of lightning.

   THE STORM FRONT: while you're on the plateau, lightning picks its
   spots — often yours, or the spot you're running to. A blue-white ring
   is the tell; then the bolt, the thunder, and every hunter nearby turning
   toward the light ("keep the lightning at your back: it shows them where
   you are"). Cross it to the far side and the nest is below you.
   ═══════════════════════════════════════════════════════════════════════ */
ENEMY_DEFS.ogre = {
  name: 'Waste Ogre', base: 'Barbarian', show: ['2H_Axe'], hide: ['Barbarian_Hat'], scale: 1.6,
  recolor: { barbarian: { 0: '#7f8a66', 23: '#7f8a66', 1: '#2e2a26' } },
  hp: 440, poise: 130, r: 0.8, h: 2.7, walk: 1.25, run: 3.4, sight: 24, hear: 12,
  xp: 170, weight: 3, flinchAt: 45, knockRes: 0.75, armorWindup: true,
  idle: 'Idle', walkClip: 'Walking_B', runClip: 'Running_A',
  attacks: [
    { clip: '2H_Melee_Attack_Chop',  speed: 0.75, hitAt: 0.5,  range: [0, 3.8], reach: 3.5, arc: 0.9, dmg: 34, poise: 60, lunge: 2 },
    { clip: '2H_Melee_Attack_Slice', speed: 0.8,  hitAt: 0.45, range: [0, 3.8], reach: 3.7, arc: 1.8, dmg: 26, poise: 45, lunge: 1.5 },
    { clip: '2H_Melee_Attack_Spin',  speed: 0.7,  hitAt: 0.5,  range: [0, 4.2], dmg: 28, poise: 70, unblockable: true, aoe: { r: 3.8, at: 'self' } },
  ],
};
ENEMY_DEFS.rustScorp = { ...ENEMY_DEFS.scorpion, name: 'Rust Scorpion', tint: '#8e3e26', hp: 130, xp: 44, scale: 1.45,
  attacks: ENEMY_DEFS.scorpion.attacks.map(a => ({ ...a, dmg: Math.round(a.dmg * 1.3) })) };
ENEMY_DEFS.ashAlpha = { ...ENEMY_DEFS.alpha, name: 'Black Alpha', tint: '#1c1a20', eye: '#ff1a0a', hp: 300, xp: 120,
  attacks: ENEMY_DEFS.alpha.attacks.map(a => ({ ...a, dmg: Math.round(a.dmg * 1.25) })) };
// the storm's own: a knot of lightning that throws sparks and calls the bolt down on you
const STRIKE_TINT = new THREE.Color('#9fc4ff');
ENEMY_DEFS.stormWisp = {
  name: 'Storm Wisp', rig: 'stormWisp', hp: 70, poise: 12, r: 0.45, h: 2.1, walk: 2.2, run: 5.2, sight: 30, hear: 18,
  xp: 46, weight: 0.6, flinchAt: 6, keepDist: 11, caster: true, deathSfx: 'chantBreak',
  attacks: [
    { windup: 0.9, range: [3, 22], chant: true, ranged: { spd: 28, dmg: 15, r: 0.22, col: '#d8e6ff', count: 2, spread: 0.12, homing: 0.6, life: 2.2 } },
    { name: 'call', windup: 0.6, active: 0.1, recover: 1.0, range: [4, 24], dmg: 24, poise: 50, unblockable: true,
      aoe: { r: 2.4, at: 'target', delay: 0.6, tint: STRIKE_TINT, quiet: true, onLand: p => lightningBolt(p) } },
  ],
};
RIGS.stormWisp = () => buildStormWispRig();
function buildStormWispRig() {
  const orbM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#c8dcff').multiplyScalar(2), transparent: true, opacity: 0.8 });
  const coreM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.6) });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color('#9fc4ff'), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
  const root = new THREE.Group(), orb = new THREE.Group(); orb.position.y = 1.4; root.add(orb);
  const shell = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), orbM), core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), coreM);
  halo.scale.setScalar(2); orb.add(shell, core, halo);
  // three crackling arms of light that flicker round it
  const arcG = new THREE.BufferGeometry(); arcG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 6 * 3), 3));
  const arcs = new THREE.LineSegments(arcG, new THREE.LineBasicMaterial({ color: new THREE.Color('#dfeaff').multiplyScalar(2.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  arcs.frustumCulled = false; orb.add(arcs);
  const lp = new THREE.Vector3();
  return {
    root, orb, t: Math.random() * 10, deadT: -1,
    update(dt, e) {
      this.t += dt;
      const charge = e.state === 'windup' ? Math.min(1, e.stateT / (e.windup || 1)) : 0;
      orb.position.y = 1.4 + Math.sin(this.t * 2.6) * 0.25 + charge * 0.3;
      shell.rotation.y += dt * (2 + charge * 8); shell.rotation.x += dt * 1.3;
      orb.scale.setScalar(1 + charge * 0.5 + Math.sin(this.t * 13) * 0.06);
      if (e.dead) { this.deadT = this.deadT < 0 ? 0 : this.deadT + dt; orb.scale.setScalar(Math.max(0.01, 1 - this.deadT * 1.8)); halo.material.opacity = Math.max(0, 0.75 - this.deadT); arcs.visible = false; return; }
      // re-zig the arcs a few times a second
      if (Math.random() < dt * 14) {
        const p = arcG.attributes.position;
        for (let a = 0; a < 3; a++) {
          let x = 0, y = 0, z = 0; const dir = Math.random() * TAU, len = 0.5 + charge * 0.6;
          for (let s = 0; s < 3; s++) {
            const i = (a * 6 + s * 2) * 3; p.array[i] = x; p.array[i + 1] = y; p.array[i + 2] = z;
            x += Math.cos(dir) * len * 0.4 + (Math.random() - 0.5) * 0.25; y += (Math.random() - 0.5) * 0.4; z += Math.sin(dir) * len * 0.4 + (Math.random() - 0.5) * 0.25;
            p.array[i + 3] = x; p.array[i + 4] = y; p.array[i + 5] = z;
          }
        }
        p.needsUpdate = true;
      }
      if (e.dist() < 55) requestLight(orb.getWorldPosition(lp), '#a8c8ff', 1.8 + charge * 2, 8);
    },
    weaponPos(out) { return orb.getWorldPosition(out); },
  };
}

/* ───────────── where they are ───────────── */
function defineDemonEncounters() {
  const E = (id, x, z, list, o) => defineEncounter(id, x, z, list, o);
  E('dcWolvesW', 520, 1960, [['bwolf', 0, 0], ['bwolf', 4, 3], ['bwolf', -3, 4]]);
  E('dcWolvesN', 450, 1770, [['bwolf', 0, 0], ['bwolf', -4, 2], ['bwolf', 3, -4]]);
  E('dcCanyon', 585, 1690, [['rustScorp', 0, 0], ['rustScorp', -4, 6], ['rustScorp', 3, -7]]);
  E('dcOgreS', 830, 1975, [['ogre', 0, 0], ['bwolf', 6, 3], ['bwolf', -5, 4]]);
  E('dcBones', 690, 1935, [['ashAlpha', 0, 0], ['bwolf', 5, 2], ['bwolf', -4, 3]]);
  E('dcMesa', 930, 1890, [['ogre', 0, 0]]);
  E('dcStorm1', 1010, 1700, [['stormWisp', 0, 0], ['stormWisp', 6, -4], ['stormWisp', -5, -6]]);
  E('dcStorm2', 1110, 1610, [['ogre', 0, 0], ['stormWisp', 7, 3], ['stormWisp', -6, 4]]);
  E('dcStorm3', 1150, 1700, [['bwolf', 0, 0], ['bwolf', 4, -3], ['bwolf', -3, -4], ['stormWisp', 0, -9]]);
  E('dcRim', 1120, 1950, [['rustScorp', 0, 0], ['rustScorp', 5, -4]]);
  // after dark, lights drift among the bones
  E('dcGraveLights', 735, 1880, [['graveWisp', 0, 0], ['graveWisp', 8, 4], ['graveWisp', -7, 6]], { night: true });
}
ENEMY_DEFS.graveWisp = { ...ENEMY_DEFS.wisp, name: 'Grave Light', hp: 64, xp: 38,
  attacks: ENEMY_DEFS.wisp.attacks.map(a => ({ ...a, ranged: { ...a.ranged, dmg: 18 } })) };

/* ───────────── lightning ───────────── */
const BOLTS = [];
let _boltMat = null;
function lightningBolt(p, harmless) {
  const top = new THREE.Vector3(p.x + rnd(-6, 6), p.y + 70, p.z + rnd(-6, 6));
  const pts = [], n = 14;
  for (let i = 0; i <= n; i++) {
    const k = i / n, j = Math.sin(k * Math.PI) * 3.2;
    pts.push(new THREE.Vector3(lerp(top.x, p.x, k) + (i && i < n ? rnd(-j, j) : 0), lerp(top.y, p.y, k), lerp(top.z, p.z, k) + (i && i < n ? rnd(-j, j) : 0)));
  }
  // the stroke as thin tubes (a GL line is one pixel wide at any distance), a branch or two off it
  const geos = [], up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), d = new THREE.Vector3();
  const tube = (a, b, w) => {
    const len = a.distanceTo(b), g = new THREE.CylinderGeometry(w, w, len, 4, 1, true);
    g.translate(0, len / 2, 0); g.applyQuaternion(q.setFromUnitVectors(up, d.subVectors(b, a).normalize())); g.translate(a.x, a.y, a.z);
    geos.push(g);
  };
  for (let i = 0; i < n; i++) tube(pts[i], pts[i + 1], harmless ? 0.22 : 0.16);
  for (let b = 0; b < 2; b++) {
    let s0 = pts[3 + ((Math.random() * 6) | 0)].clone();
    for (let s = 0; s < 3; s++) { const nx = s0.clone().add(new THREE.Vector3(rnd(-4, 4), -rnd(3, 7), rnd(-4, 4))); tube(s0, nx, 0.07); s0 = nx; }
  }
  if (!_boltMat) _boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#eef4ff').multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const line = new THREE.Mesh(mergeGeometries(geos), _boltMat.clone()); line.frustumCulled = false;
  for (const g of geos) g.dispose();
  scene.add(line);
  BOLTS.push({ line, t: 0, pos: p.clone() });
  STORM.flash = Math.max(STORM.flash, harmless ? 0.6 : 1);
  BUS.emit('sfx', { id: 'thunder', far: harmless ? rnd(0.5, 1.5) : 0 });
  if (harmless) return;
  emit(26, { pos: p.clone().setY(p.y + 0.3), col: '#dfeaff', spread: 0.4, velSpread: 6, upBias: 2, life: 0.5, size: 0.14, bright: 2.5 });
  emit(18, { pool: 'soft', pos: p, col: '#3a3436', spread: 0.8, velSpread: 2.5, upBias: 2, life: 1.4, size: 0.7, size2: 1.8, gravity: -0.5 });
  ring(p, { col: '#cfe0ff', r1: 3.2, life: 0.35 });
  shake(0.45);
  // the light shows them where you are
  for (const e of ENT.enemies) if (!e.dead && !e.aggro && e.state !== 'dormant' && e.pos.distanceTo(p) < 24) alertEnemy(e);
}
function updateBolts(dt) {
  for (let i = BOLTS.length - 1; i >= 0; i--) {
    const B = BOLTS[i]; B.t += dt;
    B.line.material.opacity = B.t < 0.08 ? 1 : B.t < 0.14 ? 0.2 : B.t < 0.22 ? 0.9 : Math.max(0, 1 - (B.t - 0.22) * 4);
    if (B.t < 0.3) requestLight(B.pos.clone().setY(B.pos.y + 6), '#cfe0ff', 30 * (1 - B.t / 0.3), 60);
    if (B.t > 0.5) { scene.remove(B.line); B.line.geometry.dispose(); B.line.material.dispose(); BOLTS.splice(i, 1); }
  }
}

/* ───────────── on the road: Eris and Ruijerd ─────────────
   Now and then, out on the waste with nothing trying to kill you, the two of them talk.
   One exchange at a time, never twice, never in a fight or a scene. */
const DC_BANTER = [
  { a: ['Eris', 'Ruijerd. Teach me that spin thing.'], b: ['Ruijerd', 'When your guard stops dropping, Eris. Not before.'] },
  { a: ['Eris', 'How old ARE you?'], b: ['Ruijerd', 'Older than your grandfather\'s grandfather. Watch your left.'] },
  { a: ['Ruijerd', '{name}. Your magic is strange. You do not chant.'], b: ['Eris', 'He does that. It\'s annoying. You get used to it.'] },
  { a: ['Eris', 'Do Superd even eat? I\'ve never seen you eat.'], b: ['Ruijerd', '...I eat while you sleep.'], c: ['Eris', 'THAT IS SUSPICIOUS.'] },
  { a: ['Eris', '{name} talks about his teacher in his sleep. Roxy this, Roxy that.'], b: ['Ruijerd', 'The Migurd woman will be glad to know it.'] },
  { a: ['Ruijerd', 'Eris. You walk ahead of him without looking back. Good. Now look back sometimes.'], b: ['Eris', '...I look back. I just don\'t let him SEE.'] },
  { a: ['Eris', 'When we get home I\'m telling Ghislaine I fought a worm the size of a TOWER.'], b: ['Ruijerd', 'Tell her it was two. Swordsmen respect exaggeration.'], after: 'sandMother' },
  { a: ['Ruijerd', 'Dead End. People will run when they hear it, at first.'], b: ['Eris', 'Then we\'ll make them stop running. One town at a time.'], after: 'deadEnd' },
];
const BANTER = { t: 150, busy: false };
function updateBanter(dt) {
  if (!G || !REGION.dc || BANTER.busy || UI.dlg || PL.state !== 'move') return;
  const E = ALLY.eris, R = ALLY.ruijerd;
  if (!E || !E.active || !R || !R.active || ENT.enemies.some(e => e.aggro && !e.dead)) return;
  if ((BANTER.t -= dt) > 0) return;
  BANTER.t = rnd(140, 220);
  const said = G.flags.banter || (G.flags.banter = []);
  const next = DC_BANTER.findIndex((x, i) => !said.includes(i) && (!x.after || G.flags[x.after]));
  if (next < 0) return;
  said.push(next);
  const x = DC_BANTER[next], col = n => n === 'Eris' ? '#e8606f' : '#6fce8a', line = s => s.replace('{name}', G.name);
  BANTER.busy = true;
  bark(x.a[0], line(x.a[1]), col(x.a[0]));
  // each reply waits for the line before it to be read (a bark stays up ~1.8 s + 45 ms a letter)
  const tA = 1.2 + x.a[1].length * 0.04, tB = tA + 1.2 + x.b[1].length * 0.04;
  later(tA, () => bark(x.b[0], line(x.b[1]), col(x.b[0])));
  later(x.c ? tB : tA + 0.2, () => { if (x.c) bark(x.c[0], line(x.c[1]), col(x.c[0])); BANTER.busy = false; });
}

/* ───────────── the storm front ───────────── */
const STORMF = { strikeT: 4, farT: 2, said: false, crossed: false };
function updateStormFront(dt) {
  updateBolts(dt);
  if (!G || !DEMON.built || GAME.inCave) return;
  const p = PL.body.pos, w = REGION.storm || 0;
  if (w < 0.4 || PL.state === 'dead' || UI.dlg || PL.state === 'talk') return;
  // far strokes: the sky working itself up, all round you
  STORMF.farT -= dt;
  if (STORMF.farT <= 0) {
    STORMF.farT = rnd(1.5, 4);
    const a = rnd(0, TAU), d = rnd(35, 90), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    lightningBolt(new THREE.Vector3(x, heightAt(x, z), z), true);
  }
  // near strokes: on you, or on where you're going
  STORMF.strikeT -= dt;
  if (STORMF.strikeT <= 0) {
    STORMF.strikeT = rnd(2.6, 5.2) * (SETTINGS.difficulty === 'story' ? 1.5 : 1);
    const v = PL.body.vel, lead = Math.random() < 0.6 ? 0.9 : 0, off = Math.random() < 0.45 ? 0 : rnd(2, 5), a = rnd(0, TAU);
    const x = p.x + v.x * lead + Math.cos(a) * off, z = p.z + v.z * lead + Math.sin(a) * off;
    hostileAoE(new THREE.Vector3(x, groundAt(x, z, p.y + 3), z), 2.4, 1.15, 26, { poise: 55, unblockable: true, tint: STRIKE_TINT, quiet: true,
      onLand: (pos, hit) => { lightningBolt(pos); if (hit && G.quest === 'dcStorm') G.flags.dcStruck = true; } });
  }
}
// the story's side of the storm: the first step into it, and the far side
function updateStormStory() {
  if (!G || G.quest !== 'dcStorm' || DCS.busy || UI.dlg || PL.state !== 'move') return;
  const p = PL.body.pos;
  if (!STORMF.said && (REGION.storm || 0) > 0.5) {
    STORMF.said = true;
    say(say$([
      { t: 'The rain on the Demon Continent does not fall so much as arrive.' },
      { p: 'ruijerd2', s: 'Ruijerd Superdia', t: 'Keep the lightning at your back. It shows them where you are.' },
      { p: 'eris', s: 'Eris Boreas Greyrat', t: 'And watch the ground! If it glows, MOVE.' },
    ]));
  }
  if (Math.hypot(p.x - 1160, p.z - 1740) < 30) {
    if (!G.flags.dcStruck) G.flags.stormWalker = true;
    setQuest('dcNest');
    later(1.2, () => hint('The storm lets go of you. Below, to the south: a bowl of pale sand, and the wagons it ate.', 5));
  }
}
