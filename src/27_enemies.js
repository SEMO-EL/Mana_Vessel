/* ═══════════════════════════════════════════════════════════════════════
   ENEMIES — one brain, many bodies.

   Every enemy runs:  idle → alert → chase ⇄ circle → windup → active →
   recover, with stagger / flinch / dead / leash on the side.
     · Only TOKENS enemies may be winding up or swinging at once; the rest
       circle at a respectful distance. (Arkham / Souls crowd rule.)
     · Every attack starts with a GLINT (visual + sound). Red glint means
       it can't be blocked — dodge it.
     · Wander more than LEASH metres from home and they give up and go back.

   Bodies: KayKit characters via Actor, or procedural rigs (the wolf) that
   expose the same small interface: root, update(dt, e), play hooks.
   ═══════════════════════════════════════════════════════════════════════ */
const TOKENS = 2;
const LEASH = 55;

/* attack fields: clip speed hitAt (normalised) | windup active recover (s, for rigs)
   range [min,max] reach arc dmg poise lunge leap unblockable ranged{…}          */
const ENEMY_DEFS = {
  wolf: {
    name: 'Forest Wolf', rig: 'wolf', hp: 62, poise: 24, r: 0.55, h: 0.95, walk: 2.4, run: 8.8, sight: 24, hear: 13,
    xp: 18, weight: 1, pack: true, flinchAt: 10, knockRes: 0,
    attacks: [
      { name: 'bite',   range: [0, 2.3], windup: 0.42, active: 0.14, recover: 0.55, reach: 2.0, arc: 0.8, dmg: 12, poise: 18, lunge: 3 },
      { name: 'pounce', range: [3.5, 8], windup: 0.62, active: 0.38, recover: 0.9,  reach: 1.7, arc: 1.0, dmg: 19, poise: 32, leap: 12 },
    ],
  },
  alpha: {
    name: 'Grey Alpha', rig: 'wolf', scale: 1.35, hp: 190, poise: 60, r: 0.75, h: 1.25, walk: 2.6, run: 9.2, sight: 28, hear: 16,
    xp: 70, weight: 2, pack: true, flinchAt: 25, knockRes: 0.5, lockBoss: false,
    attacks: [
      { name: 'bite',   range: [0, 2.8], windup: 0.46, active: 0.16, recover: 0.6, reach: 2.6, arc: 0.9, dmg: 20, poise: 30, lunge: 4 },
      { name: 'pounce', range: [4, 10], windup: 0.7,  active: 0.42, recover: 1.0, reach: 2.2, arc: 1.1, dmg: 28, poise: 50, leap: 14, unblockable: true },
    ],
  },
  bandit: {
    name: 'Brigand', base: 'Rogue_Hooded', show: ['Knife'], hp: 96, poise: 32, r: 0.4, h: 1.7, walk: 1.8, run: 5.1, sight: 26, hear: 12,
    xp: 30, weight: 1, flinchAt: 9,
    recolor: { rogue: { 9: '#3a2e28', 8: '#4b3b31', 6: '#5c4a3a', 21: '#4b3b31' } },
    idle: 'Idle', walkClip: 'Walking_B', runClip: 'Running_A',
    attacks: [
      { clip: '1H_Melee_Attack_Slice_Diagonal', speed: 1.15, hitAt: 0.42, range: [0, 2.5], reach: 2.3, arc: 1.0, dmg: 14, poise: 18, lunge: 2.5 },
      { clip: '1H_Melee_Attack_Stab',           speed: 1.1,  hitAt: 0.44, range: [1.8, 4], reach: 3.1, arc: 0.45, dmg: 19, poise: 25, lunge: 7 },
    ],
  },
  marksman: {
    name: 'Brigand Marksman', base: 'Rogue', show: ['1H_Crossbow'], hp: 70, poise: 22, r: 0.4, h: 1.7, walk: 1.8, run: 4.6, sight: 34, hear: 12,
    xp: 34, weight: 1, flinchAt: 8, keepDist: 13,
    recolor: { rogue: { 1: '#2a2420', 8: '#3e4a36', 6: '#4a4034', 21: '#3e4a36' } },
    idle: 'Idle', walkClip: 'Walking_B', runClip: 'Running_A',
    attacks: [
      { clip: '1H_Ranged_Shoot', speed: 0.8, hitAt: 0.35, range: [4, 32], ranged: { spd: 42, dmg: 15, r: 0.1, col: '#e8d8b0', gravity: 1.5 }, aimClip: '1H_Ranged_Aiming' },
    ],
  },
  thrall: {
    name: 'Barrow Thrall', base: 'Skeleton_Minion', hp: 56, poise: 18, r: 0.4, h: 1.65, walk: 1.3, run: 3.9, sight: 20, hear: 10,
    xp: 20, weight: 1, flinchAt: 8, undead: true,
    idle: 'Idle_Combat', walkClip: 'Walking_D_Skeletons', runClip: 'Running_C', deathClip: 'Death_C_Skeletons',
    attacks: [
      { clip: 'Unarmed_Melee_Attack_Punch_A', speed: 1.1, hitAt: 0.35, range: [0, 2.0], reach: 1.9, arc: 0.9, dmg: 11, poise: 14, lunge: 2 },
      { clip: '1H_Melee_Attack_Chop',         speed: 1.0, hitAt: 0.45, range: [0, 2.2], reach: 2.0, arc: 0.8, dmg: 14, poise: 18, lunge: 2 },
    ],
  },
  knight: {
    name: 'Barrow Knight', base: 'Skeleton_Warrior', borrow: [['Knight', '1H_Sword', 'handslotr'], ['Knight', 'Round_Shield', 'handslotl']],
    hp: 160, poise: 60, r: 0.45, h: 1.8, walk: 1.4, run: 3.8, sight: 22, hear: 10, shield: 0.8,
    xp: 64, weight: 2, flinchAt: 30, undead: true, knockRes: 0.6,
    idle: 'Idle_Combat', walkClip: 'Walking_D_Skeletons', runClip: 'Running_C', deathClip: 'Death_C_Skeletons', guardClip: 'Blocking',
    attacks: [
      { clip: '1H_Melee_Attack_Chop',             speed: 0.95, hitAt: 0.45, range: [0, 2.6], reach: 2.5, arc: 0.9, dmg: 20, poise: 30, lunge: 2.5 },
      { clip: '1H_Melee_Attack_Slice_Horizontal', speed: 1.0,  hitAt: 0.42, range: [0, 2.6], reach: 2.6, arc: 1.5, dmg: 18, poise: 25, lunge: 2 },
      { clip: '1H_Melee_Attack_Jump_Chop',        speed: 0.9,  hitAt: 0.5,  range: [3, 6],   reach: 2.4, arc: 0.8, dmg: 30, poise: 50, lunge: 6.5, unblockable: true },
    ],
  },
  archer: {
    name: 'Barrow Archer', base: 'Skeleton_Rogue', borrow: [['Rogue', '1H_Crossbow', 'handslotr']], hp: 58, poise: 18, r: 0.4, h: 1.7,
    walk: 1.4, run: 3.6, sight: 30, hear: 10, xp: 28, weight: 1, flinchAt: 8, undead: true, keepDist: 11,
    idle: 'Idle_Combat', walkClip: 'Walking_D_Skeletons', runClip: 'Running_C', deathClip: 'Death_C_Skeletons',
    attacks: [
      { clip: '1H_Ranged_Shoot', speed: 0.75, hitAt: 0.35, range: [3, 28], ranged: { spd: 36, dmg: 13, r: 0.1, col: '#c8f0ff', gravity: 1 }, aimClip: '1H_Ranged_Aiming' },
    ],
  },
  sorcerer: {
    name: 'Barrow Sorcerer', base: 'Skeleton_Mage', hp: 80, poise: 22, r: 0.4, h: 1.8, walk: 1.3, run: 3.4, sight: 28, hear: 10,
    xp: 45, weight: 1, flinchAt: 6, undead: true, keepDist: 14, caster: true,
    idle: 'Idle_Combat', walkClip: 'Walking_D_Skeletons', runClip: 'Running_C', deathClip: 'Death_C_Skeletons',
    attacks: [
      // the long chant is the tell — and a hit during it cancels the spell (v2's cultist rule)
      { clip: 'Spellcasting', loopWindup: true, windup: 1.3, speed: 1, range: [3, 26], chant: true,
        ranged: { spd: 20, dmg: 22, r: 0.35, col: '#b98ce0', count: 3, spread: 0.18, homing: 1.2 } },
    ],
  },
};

/* ───────────── procedural wolf ───────────── */
function buildWolfRig(scale = 1, tint = '#6e737b') {
  const dark = toonMat({ color: tint, rim: true }), light = toonMat({ color: new THREE.Color(tint).lerp(new THREE.Color('#c9c3b8'), 0.55), rim: true });
  const eyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd24a').multiplyScalar(2.2) });
  const nose = toonMat({ color: '#1a1a1c' });
  const S = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };
  const ball = new THREE.IcosahedronGeometry(1, 2);
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.set(0, 0.74, 0); root.add(body);
  body.add(S(ball, dark, 0, 0, -0.05, 0.3, 0.29, 0.66));                 // torso
  body.add(S(ball, light, 0, -0.1, 0.1, 0.24, 0.2, 0.5));                // belly
  const chest = S(ball, dark, 0, 0.06, 0.42, 0.33, 0.36, 0.34); body.add(chest);
  body.add(S(ball, light, 0, -0.04, 0.55, 0.22, 0.26, 0.2));             // ruff
  const neck = new THREE.Group(); neck.position.set(0, 0.16, 0.6); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.16, 0.14); neck.add(head);
  head.add(S(ball, dark, 0, 0, 0, 0.19, 0.18, 0.22));
  head.add(S(new THREE.BoxGeometry(1, 1, 1), light, 0, -0.04, 0.2, 0.12, 0.1, 0.24));  // snout
  head.add(S(ball, nose, 0, -0.01, 0.33, 0.045, 0.04, 0.04));
  const jaw = new THREE.Group(); jaw.position.set(0, -0.08, 0.08); head.add(jaw);
  jaw.add(S(new THREE.BoxGeometry(1, 1, 1), light, 0, -0.02, 0.12, 0.1, 0.04, 0.2));
  for (const s of [-1, 1]) {
    const ear = S(new THREE.ConeGeometry(0.06, 0.16, 4), dark, s * 0.1, 0.18, -0.04);
    ear.rotation.z = -s * 0.25; head.add(ear);
    head.add(S(ball, eyeM, s * 0.085, 0.05, 0.14, 0.028, 0.022, 0.02));
  }
  const tail = []; let parent = body; let tz = -0.68;
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group(); g.position.set(0, i === 0 ? 0.08 : 0, i === 0 ? tz : -0.2);
    g.add(S(ball, i === 2 ? light : dark, 0, 0, -0.1, 0.07 - i * 0.012, 0.07 - i * 0.012, 0.14));
    parent.add(g); tail.push(g); parent = g;
  }
  const legs = [];
  for (const [x, z, front] of [[-0.16, 0.44, 1], [0.16, 0.44, 1], [-0.17, -0.4, 0], [0.17, -0.4, 0]]) {
    const hip = new THREE.Group(); hip.position.set(x, -0.04, z); body.add(hip);
    hip.add(S(ball, dark, 0, -0.16, 0, 0.085, 0.2, 0.1));
    const knee = new THREE.Group(); knee.position.set(0, -0.33, 0); hip.add(knee);
    knee.add(S(ball, dark, 0, -0.17, 0, 0.055, 0.19, 0.06));
    knee.add(S(ball, light, 0, -0.36, 0.04, 0.06, 0.035, 0.09));   // paw
    legs.push({ hip, knee, front, side: Math.sign(x) });
  }
  root.scale.setScalar(scale);
  return {
    root, body, neck, head, jaw, tail, legs, phase: Math.random() * 10, crouch: 0, bite: 0, deadT: -1, eyeM,
    /* e: the enemy (reads speed, state, stateT). Drives every joint procedurally. */
    update(dt, e) {
      const sp = Math.hypot(e.body.vel.x, e.body.vel.z) / scale;
      const gallop = sp > 5;
      this.phase += dt * (sp < 0.3 ? 0 : gallop ? sp * 1.25 : sp * 2.6);
      const ph = this.phase, t = GAME.time + this.phase;
      const amp = sp < 0.3 ? 0 : gallop ? 0.95 : 0.55;
      const windup = e.state === 'windup', active = e.state === 'active';
      this.crouch = damp(this.crouch, windup ? 1 : 0, 10, dt);
      this.bite = damp(this.bite, active ? 1 : 0, 18, dt);
      this.legs.forEach((L, i) => {
        // trot: diagonal pairs together; gallop: fronts together, backs together
        const off = gallop ? (L.front ? 0 : Math.PI * 0.85) + (L.side > 0 ? 0.35 : 0) : ((i === 0 || i === 3) ? 0 : Math.PI);
        const s = Math.sin(ph + off);
        L.hip.rotation.x = s * amp * 0.75 - this.crouch * (L.front ? -0.35 : 0.6);
        L.knee.rotation.x = (L.front ? -1 : 1) * Math.max(0, Math.cos(ph + off)) * amp * 0.9 + this.crouch * (L.front ? 0.2 : -0.9);
      });
      this.body.position.y = 0.74 + Math.abs(Math.sin(ph * (gallop ? 1 : 2))) * (gallop ? 0.07 : 0.03) - this.crouch * 0.2 + Math.sin(t * 2) * 0.006;
      this.body.rotation.x = (gallop ? Math.sin(ph) * 0.08 : 0) + this.crouch * 0.12 - (e.state === 'active' && e.attack && e.attack.leap ? 0.25 : 0);
      // head: look toward the player when hunting, snap forward to bite, howl on alert
      const howl = e.state === 'alert' ? 1 : 0;
      this.neck.rotation.x = damp(this.neck.rotation.x, -howl * 0.9 + this.crouch * 0.35 - this.bite * 0.3, 10, dt);
      this.jaw.rotation.x = damp(this.jaw.rotation.x, (this.bite * 0.7 + howl * 0.6 + (windup ? 0.25 : 0)), 20, dt);
      const wag = e.aggro ? 0.2 : 0.45;
      this.tail.forEach((g, k) => { g.rotation.y = Math.sin(t * (e.aggro ? 9 : 4) + k * 0.8) * wag; g.rotation.x = (e.aggro ? 0.35 : -0.3) - k * 0.1; });
      // death: roll onto the side
      if (e.dead) { this.deadT = this.deadT < 0 ? 0 : this.deadT + dt; this.root.rotation.z = smooth(0, 0.5, this.deadT) * 1.5; this.body.position.y = 0.74 - smooth(0, 0.5, this.deadT) * 0.45; }
      if (e.hurtT > 0) this.body.position.x = Math.sin(GAME.time * 70) * 0.03; else this.body.position.x = 0;
      this.eyeM.color.setRGB(2.2, 1.8 * (e.aggro ? 0.5 : 1), 0.4 * (e.aggro ? 0.2 : 1));
    },
    weaponPos(out) { return this.head.getWorldPosition(out); },
  };
}

/* ───────────── Enemy ───────────── */
class Enemy {
  constructor(key, x, z, opts = {}) {
    const d = this.def = { ...ENEMY_DEFS[key], ...(opts.override || {}) };
    this.key = key;
    const sc = opts.scale || 1;               // def r/h are final sizes; bosses pass a scale
    this.r = d.r * sc; this.h = d.h * sc;
    this.body = { pos: new THREE.Vector3(x, floorAt(x, z), z), vel: new THREE.Vector3(), r: this.r, h: this.h, grounded: true, groundY: 0 };
    this.pos = this.body.pos;
    this.home = new THREE.Vector3(x, 0, z);
    this.face = opts.face ?? rnd(0, TAU);
    this.maxHp = this.hp = d.hp * (opts.hpMul || 1);
    this.poise = d.poise;
    this.shield = d.shield || 0;
    this.state = opts.dormant ? 'dormant' : 'idle';
    this.stateT = rnd(0, 2);
    this.aggro = false; this.lockable = true;
    this.encounter = opts.encounter || null;
    this.wanderT = rnd(2, 6); this.wanderTo = null;
    this.circleDir = Math.random() < 0.5 ? -1 : 1;
    this.attackCd = rnd(0.5, 1.5);
    this.token = false; this.hits = false;
    this.burn = 0; this.burnT = 0; this.slow = 0; this.slowT = 0; this.rootT = 0; this.staggerT = 0; this.hurtT = 0;
    this.fade = 1;
    if (d.rig === 'wolf') {
      this.rig = buildWolfRig(d.scale || 1, key === 'alpha' ? '#4d5158' : pick(['#6e737b', '#7a7166', '#5d6168']));
      this.root = this.rig.root;
    } else if (d.rig === 'treant') {
      this.rig = buildTreantRig();
      this.root = this.rig.root;
    } else if (d.rig === 'stone') {
      this.rig = buildStoneRig();
      this.root = this.rig.root;
    } else {
      this.actor = new Actor({ base: d.base, recolor: d.recolor, show: d.show || [], hide: d.hide || [], scale: opts.scale || 1 });
      for (const [from, mesh, bone] of d.borrow || []) { borrowMesh(this.actor, from, mesh, bone); this.actor.show(mesh, true); }
      this.root = this.actor.root;
      if (this.state === 'dormant') this.actor.once('Skeletons_Inactive_Floor_Pose', { fade: 0 });
      else this.actor.loop(d.idle || 'Idle');
    }
    this.root.position.copy(this.pos);
    scene.add(this.root);
    ENT.enemies.push(this);
  }
  lockPoint() { return _lp.set(this.pos.x, this.pos.y + this.h * 0.62, this.pos.z); }
  weaponPos(out) {
    if (this.rig) return this.rig.weaponPos(out);
    return this.actor.bonePos('handslotr', out);
  }
  dist() { return Math.hypot(PL.body.pos.x - this.pos.x, PL.body.pos.z - this.pos.z); }
  angleToPlayer() { return Math.atan2(PL.body.pos.x - this.pos.x, PL.body.pos.z - this.pos.z); }
  set(s) { this.state = s; this.stateT = 0; }

  onFlinch() {
    if (this.state === 'active' || this.def.weight >= 2 || this.staggerT > 0) return;
    if (this.state === 'windup') this.releaseToken();
    this.set('flinch');
    if (this.actor) this.actor.once(Math.random() < 0.5 ? 'Hit_A' : 'Hit_B', { speed: 1.6, fade: 0.05 });
  }
  onStagger() {
    this.releaseToken();
    this.set('stagger');
    if (this.actor) this.actor.once('Hit_B', { speed: 0.7, fade: 0.05 });
  }
  interrupt() { this.releaseToken(); this.set('recover'); this.attack = null; if (this.actor) this.actor.once('Hit_A', { speed: 1.4 }); }
  releaseToken() { if (this.token) { this.token = false; ENT.tokens = Math.max(0, (ENT.tokens || 0) - 1); } }
  onDeath() {
    this.releaseToken();
    this.set('dead');
    if (this.actor) this.actor.once(this.def.deathClip || 'Death_A', { speed: 1, fade: 0.1 });
    BUS.emit('sfx', { id: this.def.undead ? 'boneDeath' : this.def.rig === 'wolf' ? 'wolfDeath' : 'death', pos: this.pos });
    if (this.encounter) this.encounter.killed++;
  }

  update(dt) {
    const d = this.def;
    this.stateT += dt;
    this.hurtT -= dt;
    if (this.staggerT > 0) this.staggerT -= dt;
    if (this.slowT > 0 && (this.slowT -= dt) <= 0) this.slow = 0;
    if (this.rootT > 0) this.rootT -= dt;
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.hp -= this.burn * dt;
      if (Math.random() < 0.5) emit(1, { pos: this.lockPoint(), col: '#ff8030', vel: { x: 0, y: 1.5, z: 0 }, velSpread: 0.5, life: 0.5, size: 0.3, bright: 2 });
      if (this.hp <= 0) { if (d.spar) this.hp = 1; else killEnemy(this); }
    }

    if (this.state === 'dead') {
      this.body.vel.x = damp(this.body.vel.x, 0, 6, dt); this.body.vel.z = damp(this.body.vel.z, 0, 6, dt);
      moveBody(this.body, dt);
      if (this.stateT > 4) { this.fade -= dt; this.root.position.y = this.pos.y - (1 - this.fade) * 0.8; if (this.fade <= 0) this.remove(); }
      this.sync(dt);
      return;
    }
    if (this.state !== 'dormant' && !d.static) this.think(dt);
    // steering is done; physics does the rest
    if (this.rootT > 0) { this.body.vel.x = 0; this.body.vel.z = 0; }
    moveBody(this.body, dt);
    this.sync(dt);
  }

  sync(dt) {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.face;
    if (this.rig) this.rig.update(dt, this);
    else this.actor.update(dt * (this.slow ? 1 - this.slow * 0.6 : 1));
  }

  remove() {
    scene.remove(this.root);
    const i = ENT.enemies.indexOf(this); if (i >= 0) ENT.enemies.splice(i, 1);
    this.removed = true;
  }

  /* A boss's second phase: new moves, faster, and a roar that raises the dead. */
  enterPhase2() {
    const P2 = this.def.phase2;
    this.phase2 = true;
    this.def = { ...this.def, attacks: [...this.def.attacks, ...P2.attacks], walk: this.def.walk * P2.speedMul, run: this.def.run * P2.speedMul };
    this.releaseToken();
    this.set('recover'); this.recoverT = 2.2;
    if (this.actor) this.actor.once('Taunt', { speed: 0.8, fade: 0.1 });
    BUS.emit('bossPhase', this);
    BUS.emit('sfx', { id: 'howl', pos: this.pos });
    shake(0.5);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * TAU, x = this.pos.x + Math.cos(a) * 7, z = this.pos.z + Math.sin(a) * 7;
      const t = new Enemy('thrall', x, z, { dormant: true });
      t.aggro = true; t.lockable = false; t.set('awaken');
      t.actor.once('Spawn_Ground_Skeletons', { speed: 1.4, fade: 0 });
    }
  }

  /* ───── the brain ───── */
  think(dt) {
    const d = this.def, dist = this.dist(), p = PL.body.pos;
    if (d.phase2 && !this.phase2 && this.hp / this.maxHp < d.phase2.at && this.state !== 'windup' && this.state !== 'active') { this.enterPhase2(); return; }
    const speedMul = this.slow ? 1 - this.slow : 1;
    const playerDown = PL.state === 'dead';
    const steer = (tx, tz, spd, k = 8) => {
      this.body.vel.x = damp(this.body.vel.x, tx * spd * speedMul, k, dt);
      this.body.vel.z = damp(this.body.vel.z, tz * spd * speedMul, k, dt);
    };
    const faceTo = (a, k = 8) => { this.face = dampAngle(this.face, a, k, dt); };
    const toP = this.angleToPlayer(), dx = Math.sin(toP), dz = Math.cos(toP);

    switch (this.state) {
      case 'idle': {
        // wander around home
        this.wanderT -= dt;
        if (this.wanderT <= 0) { this.wanderT = rnd(3, 8); const a = rnd(0, TAU), r = rnd(0, 10); this.wanderTo = new THREE.Vector3(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r); }
        if (this.wanderTo) {
          const wx = this.wanderTo.x - this.pos.x, wz = this.wanderTo.z - this.pos.z, wd = Math.hypot(wx, wz);
          if (wd > 0.8) { steer(wx / wd, wz / wd, d.walk, 4); faceTo(Math.atan2(wx, wz), 4); } else { steer(0, 0, 0); this.wanderTo = null; }
        } else steer(0, 0, 0);
        this.locoAnim();
        if (!playerDown && this.perceives(dist)) alertEnemy(this);
        break;
      }
      case 'alert':
        steer(0, 0, 0); faceTo(toP, 10);
        if (this.actor) this.actor.loop(d.idle || 'Idle');
        if (this.stateT > (d.rig === 'wolf' ? 0.7 : 0.45)) this.set('chase');
        break;
      case 'return': {
        const hx = this.home.x - this.pos.x, hz = this.home.z - this.pos.z, hd = Math.hypot(hx, hz);
        this.hp = Math.min(this.maxHp, this.hp + dt * this.maxHp * 0.2);
        if (hd < 2) { this.aggro = false; this.set('idle'); break; }
        steer(hx / hd, hz / hd, d.run * 0.8); faceTo(Math.atan2(hx, hz)); this.locoAnim();
        break;
      }
      case 'chase': case 'circle': {
        if (playerDown || this.home.distanceTo(_lp.set(this.pos.x, 0, this.pos.z)) > LEASH || dist > 45) { this.releaseToken(); this.set('return'); break; }
        this.attackCd -= dt;
        // ready to attack: claim a token FIRST, then close to range — otherwise a
        // melee enemy circling outside its reach would wait forever
        if (this.attackCd <= 0 && !this.token && (ENT.tokens || 0) < TOKENS) { this.token = true; ENT.tokens = (ENT.tokens || 0) + 1; }
        if (this.token) {
          const atk = d.attacks.filter(a => dist >= a.range[0] && dist <= a.range[1]);
          if (atk.length) { this.startAttack(pick(atk)); break; }
        }
        // movement: close in (or keep distance for ranged), circle if waiting
        const keep = d.keepDist || (this.token ? 1.6 : 4.5 + this.r);
        if (d.keepDist && dist < keep * 0.6) { steer(-dx, -dz, d.run * 0.8); }
        else if (dist > keep + 1.2) { steer(dx, dz, dist > 10 ? d.run : d.run * 0.7); }
        else {
          // strafe around the player
          if (Math.random() < dt * 0.3) this.circleDir *= -1;
          steer(dz * this.circleDir, -dx * this.circleDir, d.walk);
        }
        faceTo(toP, 9);
        this.locoAnim();
        break;
      }
      case 'windup': {
        const a = this.attack;
        faceTo(toP, a.leap ? 12 : 6);
        steer(dx, dz, (a.lunge || 0) * 0.35, 6);
        if (this.actor && a.aimClip && this.stateT < 0.05) this.actor.loop(a.aimClip);
        if (!this.glinted && this.stateT > 0.05) { this.glinted = true; BUS.emit('tell', { e: this, unblockable: a.unblockable }); }
        if (a.chant && Math.random() < 0.5) emit(1, { pos: this.weaponPos(_lp2), col: '#b98ce0', velSpread: 1, life: 0.6, size: 0.25, bright: 2 });
        if (this.stateT >= this.windup) this.enterActive();
        break;
      }
      case 'active': {
        const a = this.attack;
        if (a.leap) {
          if (this.stateT < 0.05 && this.body.grounded) { this.body.vel.set(Math.sin(this.face) * a.leap, 5.5, Math.cos(this.face) * a.leap); this.body.grounded = false; }
        } else steer(Math.sin(this.face), Math.cos(this.face), a.lunge || 0, 12);
        if (!a.ranged && !this.hits) this.tryHit(a);
        if (this.stateT >= this.activeT && (this.body.grounded || !a.leap)) { this.set('recover'); }
        break;
      }
      case 'recover': {
        steer(0, 0, 0, 6);
        if (this.stateT >= (this.recoverT || 0.6)) { this.releaseToken(); this.attackCd = rnd(0.6, 1.8); this.set('chase'); }
        break;
      }
      case 'flinch':
        steer(0, 0, 0, 5);
        if (this.stateT > 0.45) this.set('chase');
        break;
      case 'stagger':
        steer(0, 0, 0, 4);
        if (this.rig && this.stateT < 0.1) this.body.vel.y = 3;
        if (this.stateT > (this.def.weight >= 2 ? 1.2 : 1.5)) { this.riposte = false; this.set('chase'); }
        break;
      case 'awaken':
        steer(0, 0, 0, 5);
        if (this.stateT > 2.0) { this.lockable = true; this.set('chase'); }
        break;
    }
  }

  perceives(dist) {
    const d = this.def;
    if (dist > d.sight) return false;
    const noisy = PL.sprinting || PL.state === 'attack' || PL.state === 'castShoot' || PL.chanting;
    if (dist < (noisy ? d.hear : d.hear * 0.4)) return true;
    const rel = Math.abs(wrapAngle(this.angleToPlayer() - this.face));
    if (rel > 1.15 && dist > 5) return false;
    // line of sight from eye to head
    const eye = _lp2.set(this.pos.x, this.pos.y + this.h * 0.9, this.pos.z);
    const dir = _lp3.set(PL.body.pos.x, PL.body.pos.y + 1.5, PL.body.pos.z).sub(eye);
    const len = dir.length(); dir.divideScalar(len);
    return raycastWorld(eye, dir, len) >= len - 0.5;
  }

  locoAnim() {
    if (!this.actor) return;
    const sp = Math.hypot(this.body.vel.x, this.body.vel.z);
    const d = this.def;
    if (sp < 0.3) this.actor.loop(this.aggro ? (d.idle === 'Idle' ? 'Idle_Combat' : d.idle || 'Idle') : d.idle || 'Idle');
    else if (sp < d.run * 0.6) this.actor.loop(d.walkClip || 'Walking_A', { speed: sp / 1.8 });
    else this.actor.loop(d.runClip || 'Running_A', { speed: clamp(sp / 5, 0.8, 1.3) });
  }

  startAttack(a) {
    this.attack = a; this.hits = false; this.glinted = false;
    this.set('windup');
    if (this.actor && a.clip) {
      const clip = CHARS.clips.get(a.clip);
      const dur = clip ? clip.duration / (a.speed || 1) : 1;
      if (a.loopWindup) { this.windup = a.windup; this.activeT = 0.25; this.recoverT = 0.5; this.actor.loop(a.clip, { speed: a.speed || 1 }); }
      else {
        this.windup = dur * a.hitAt; this.activeT = dur * 0.14; this.recoverT = dur * (1 - a.hitAt - 0.14) + 0.15;
        if (!a.aimClip) this.actor.once(a.clip, { speed: a.speed || 1, fade: 0.1 });
        else { this.windup = Math.max(this.windup, 0.9); }
      }
    } else { this.windup = a.windup; this.activeT = a.active; this.recoverT = a.recover; }
    if (SETTINGS.difficulty === 'story') this.windup *= 1.25;
    if (a.activeMul) this.activeT *= a.activeMul;
    if (a.aoe) {
      // area attack: the ring on the ground is the tell, and the ring does the damage
      const p = a.aoe.at === 'self' ? this.pos.clone()
        : a.aoe.at === 'target' ? PL.body.pos.clone()
        : this.pos.clone().add(new THREE.Vector3(Math.sin(this.face) * a.aoe.dist, 0, Math.cos(this.face) * a.aoe.dist));
      hostileAoE(p, a.aoe.r, this.windup + (a.aoe.delay || 0), a.dmg, { poise: a.poise, unblockable: a.unblockable, roots: a.name === 'roots' });
      this.hits = true;
    }
  }
  enterActive() {
    const a = this.attack;
    this.set('active');
    if (a.ranged) {
      const R = a.ranged, from = this.weaponPos(new THREE.Vector3());
      if (this.actor && a.aimClip) this.actor.once(a.clip, { speed: a.speed || 1, fade: 0.05 });
      const n = R.count || 1;
      for (let i = 0; i < n; i++) {
        const target = _lp2.set(PL.body.pos.x, PL.body.pos.y + 1.1, PL.body.pos.z);
        const dir = target.clone().sub(from).normalize();
        if (n > 1) dir.applyAxisAngle(_up, (i - (n - 1) / 2) * R.spread);
        dir.y += (R.gravity || 0) * from.distanceTo(target) / (R.spd * R.spd) * 0.5;
        spawnProjectile({ pos: from.clone(), dir: dir.normalize(), spd: R.spd, r: R.r, dmg: R.dmg, hostile: true, col: R.col, life: 3, gravity: R.gravity || 0, poise: 18 });
      }
      BUS.emit('sfx', { id: a.chant ? 'enemyCast' : 'crossbow', pos: this.pos });
    }
    if (a.name === 'pounce' || a.leap) BUS.emit('sfx', { id: 'snarl', pos: this.pos });
    if (a.shock) {
      const p = this.pos.clone().add(new THREE.Vector3(Math.sin(this.face) * 3.5, 0, Math.cos(this.face) * 3.5));
      hostileAoE(p, a.shock, 0.12, a.dmg * 0.6, { poise: 40 });
    }
  }
  tryHit(a) {
    const b = PL.body;
    const dx = b.pos.x - this.pos.x, dz = b.pos.z - this.pos.z, dd = Math.hypot(dx, dz);
    if (dd > (a.reach + b.r) * (this.def.scale || 1)) return;
    if (Math.abs(b.pos.y - this.pos.y) > 2.2) return;
    const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - this.face));
    if (ang > (a.arc || 1)) return;
    this.hits = true;
    const res = damagePlayer(a.dmg, { dir: _lp3.set(dx, 0, dz).normalize().clone(), poise: a.poise, unblockable: a.unblockable, source: this });
    if (res === 'blocked' && this.def.weight < 2) { this.poise -= 12; if (this.poise <= 0) staggerEnemy(this); }
  }
}
const _lp = new THREE.Vector3(), _lp2 = new THREE.Vector3(), _lp3 = new THREE.Vector3();

function alertEnemy(e, fromDamage) {
  if (e.aggro || e.dead) return;
  e.aggro = true;
  e.set(fromDamage ? 'chase' : 'alert');
  BUS.emit('alert', e);
  if (e.def.rig === 'wolf') BUS.emit('sfx', { id: 'howl', pos: e.pos });
  // the pack hears it
  for (const o of ENT.enemies) {
    if (o === e || o.dead || o.aggro || o.state === 'dormant') continue;
    if (o.pos.distanceTo(e.pos) < (e.def.pack ? 30 : 16)) { o.aggro = true; o.set('alert'); o.stateT = -rnd(0, 0.4); }
  }
}

/* ───────────── encounters: spawn near, despawn far, reset on rest ───────────── */
const ENCOUNTERS = [];
function defineEncounter(id, x, z, list, opts = {}) {
  ENCOUNTERS.push({ id, x, z, list, opts, live: [], killed: 0, active: false, cleared: false });
}
function updateEncounters() {
  const p = PL.body.pos;
  for (const enc of ENCOUNTERS) {
    // cave encounters live only underground; every other encounter only outside
    if (!!enc.opts.cave !== !!GAME.inCave) { if (enc.active && !enc.live.some(e => e.aggro)) despawnEncounter(enc); continue; }
    const d = Math.hypot(p.x - enc.x, p.z - enc.z);
    if (!enc.active && !enc.cleared && d < 150 && (!enc.opts.night || SKY_NOW.night > 0.5) && (!enc.opts.flag || G.flags[enc.opts.flag])) spawnEncounter(enc);
    else if (enc.active && d > 210 && !enc.live.some(e => e.aggro && !e.dead)) despawnEncounter(enc);
    if (enc.active && enc.live.length && enc.live.every(e => e.dead)) {
      enc.cleared = true; enc.active = false;
      if (enc.opts.onClear) enc.opts.onClear();
    }
  }
}
function spawnEncounter(enc) {
  enc.active = true; enc.live = []; enc.killed = 0;
  enc.list.forEach(([key, dx, dz, o], i) => {
    const x = enc.x + dx, z = enc.z + dz;
    const e = new Enemy(key, x, z, { ...(o || {}), encounter: enc });
    if (o && o.y !== undefined) e.pos.y = o.y;
    enc.live.push(e);
  });
}
function despawnEncounter(enc) {
  for (const e of enc.live) if (!e.removed) e.remove();
  enc.live = []; enc.active = false;
}
// Resting at a waystone brings the world back — the Souls contract.
function resetEncounters() {
  for (const enc of ENCOUNTERS) {
    if (enc.opts.boss && enc.cleared) continue;
    despawnEncounter(enc); enc.cleared = false;
  }
}
function wakeDormant(radius) {
  for (const e of ENT.enemies) {
    if (e.state !== 'dormant' || e.dead) continue;
    if (e.dist() < radius) {
      e.aggro = true; e.lockable = false; e.set('awaken');
      e.actor.once('Skeletons_Awaken_Floor', { speed: 1.2, fade: 0.05 });
      BUS.emit('sfx', { id: 'boneRise', pos: e.pos });
    }
  }
}

function updateEnemies(dt) {
  ENT.tokens = ENT.enemies.filter(e => e.token && !e.dead).length;
  for (let i = ENT.enemies.length - 1; i >= 0; i--) ENT.enemies[i].update(dt);
  separateBodies();
}
// Bodies don't pass through each other: push overlapping circles apart,
// heavier things move less. The player counts as weight 1.
function separateBodies() {
  const list = ENT.enemies.filter(e => !e.dead && e.state !== 'dormant');
  const all = PL.state !== 'dead' ? [{ body: PL.body, w: 1 }, ...list.map(e => ({ body: e.body, w: e.def.weight || 1 }))] : list.map(e => ({ body: e.body, w: e.def.weight || 1 }));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i].body, b = all[j].body;
    if (Math.abs(a.pos.y - b.pos.y) > 1.6) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.r + b.r;
    if (d >= m || d < 1e-5) continue;
    const push = (m - d) / d, wa = all[j].w / (all[i].w + all[j].w), wb = 1 - wa;
    a.pos.x -= dx * push * wa; a.pos.z -= dz * push * wa;
    b.pos.x += dx * push * wb; b.pos.z += dz * push * wb;
  }
}
