/* ═══════════════════════════════════════════════════════════════════════
   PLAYER — state machine, movement, stamina, and every animation choice.

   States: move · air · dodge · attack · castShoot · hit · collapse · dead ·
           rest · talk · interact · climb
   'move' also carries two sub-modes that don't lock your legs:
     chanting  (holding cast)   — half speed, arms incant over walking legs
     guarding  (holding guard)  — slow, block pose, parry window on press

   Rules of feel:
     · inputs are buffered for 0.25 s, so a press slightly early still lands
     · every commitment has a cancel point after which a dodge wins
     · the dodge is invulnerable for ~0.3 s of its 0.5 s
   ═══════════════════════════════════════════════════════════════════════ */
let G = null;          // persistent game state (saved)
const PL = {
  actor: null,
  body: { pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 0.38, h: 1.7, grounded: true, groundY: 0 },
  face: 0, state: 'move', stateT: 0,
  moveSpeed: 0, sprinting: false, walkToggle: false,
  combo: 0, comboQueued: false, attackStep: null, attackHits: new Set(), heavyCharge: 0,
  chanting: null, chantT: 0, castPending: null,
  guarding: false, parryT: 0, iframe: 0, hyper: false,
  staminaDelay: 0, buffer: { attack: 0, dodge: 0, jump: 0, cast: 0 },
  sprintHeldT: 0, dodgeDir: new THREE.Vector3(), knock: new THREE.Vector3(),
  gliding: false, fallStartY: 0, airT: 0, slotIdx: 0, weapon: 'staff',
  lastHitT: -10, interactTarget: null, collapseT: 0, restAt: null, slow: 0, slowT: 0,
};
const RUN_SPEED = 5.4, SPRINT_SPEED = 8.2, WALK_SPEED = 2.2, JUMP_V = 8.4;

function newGameState({ name, race, style, aff }) {
  const R = RACES[race];
  return {
    v: 3, name, race, style, aff,
    lvl: 1, xp: 0, xpNext: 60, breaks: 0, kills: 0,
    maxHp: R.hp, hp: R.hp, maxStamina: 100, stamina: 100, maxMana: R.mana, mana: R.mana,
    prof: { fire: 0, water: 0, wind: 0, earth: 0, heal: 0, [aff]: 3 },
    flags: {}, discovered: {}, waystones: { village: true }, lastWaystone: 'village',
    pos: null, hour: 17.2, quest: 'findRoxy', pages: [], cds: {},
    deaths: 0, playTime: 0,
  };
}

function rudeusRecolor(G) {
  const R = RACES[G.race];
  return { mage: { 1: R.hair, 8: '#34405e', 9: '#2b3550', 10: '#5c3a2a', 5: '#7a5a3a' } };
}
function buildPlayerActor() {
  const R = RACES[G.race];
  const extra = [];
  if (R.ears) extra.push(a => addEars(a, R.ears, R.hair));
  if (R.gem) extra.push(a => addGem(a));
  const actor = new Actor({ base: 'Mage', recolor: rudeusRecolor(G), show: ['2H_Staff'], extra });
  borrowMesh(actor, 'Knight', '1H_Sword', 'handslotr');
  return actor;
}
// Small cosmetic meshes on the head bone. The head bone is in model units (×1/CHAR_SCALE).
function addEars(actor, kind, hair) {
  const mat = charMaterial('mage', { 1: hair });
  const skin = toonMat({ color: kind === 'elf' ? '#f0cfae' : hair });
  for (const s of [-1, 1]) {
    const g = kind === 'elf' ? new THREE.ConeGeometry(0.09, 0.55, 5) : new THREE.ConeGeometry(0.16, 0.34, 4);
    const m = new THREE.Mesh(g, kind === 'elf' ? skin : toonMat({ color: hair }));
    if (kind === 'elf') { m.position.set(s * 0.52, 0.72, -0.02); m.rotation.set(0, 0, -s * 1.15); }
    else { m.position.set(s * 0.34, 1.32, -0.05); m.rotation.set(-0.15, 0, -s * 0.35); }
    m.castShadow = true;
    actor.bones.head.add(m);
  }
}
function addGem(actor) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), new THREE.MeshBasicMaterial({ color: '#ff3355' }));
  m.position.set(0, 0.86, 0.47);
  actor.bones.head.add(m);
}

function spawnPlayer(x, z, face = 0) {
  if (PL.actor) scene.remove(PL.actor.root);
  PL.actor = buildPlayerActor();
  scene.add(PL.actor.root);
  PL.body.pos.set(x, floorAt(x, z), z);
  PL.body.vel.set(0, 0, 0);
  PL.body.grounded = true;
  PL.face = face;
  setPlayerState('move');
  PL.actor.loop('Idle');
  CAM.yaw = face + Math.PI; CAM.pitch = -0.2;
  CAM.pivot.set(x, PL.body.pos.y + 1.55, z);
}

function setPlayerState(s) { PL.state = s; PL.stateT = 0; }
const canAct = () => !['hit', 'collapse', 'dead', 'talk', 'rest', 'climb', 'interact'].includes(PL.state);
function spendStamina(n) {
  if (G.stamina <= 0) return false;         // Souls rule: any stamina left lets you act
  G.stamina -= n; PL.staminaDelay = 0.75;
  return true;
}

/* movement direction from input, camera-relative */
const _mv = new THREE.Vector3(), _fw = new THREE.Vector3(), _rt = new THREE.Vector3();
function inputDir(out) {
  camForward(_fw); camRight(_rt);
  out.set(0, 0, 0).addScaledVector(_fw, -IN.moveZ).addScaledVector(_rt, IN.moveX);
  const l = out.length(); if (l > 1) out.divideScalar(l);
  return out;
}
function faceToward(angle, k, dt) { PL.face = dampAngle(PL.face, angle, k, dt); }
function angleTo(x, z) { return Math.atan2(x - PL.body.pos.x, z - PL.body.pos.z); }

/* ───────────── per-frame ───────────── */
function updatePlayer(dt) {
  const b = PL.body, A = PL.actor;
  PL.stateT += dt;
  PL.iframe = Math.max(0, PL.iframe - dt);
  PL.parryT = Math.max(0, PL.parryT - dt);
  for (const k in PL.buffer) PL.buffer[k] = Math.max(0, PL.buffer[k] - dt);
  for (const k in G.cds) if (G.cds[k] > 0) G.cds[k] -= dt;

  // stamina regenerates after a short pause; guarding halves it
  PL.staminaDelay -= dt;
  if (PL.staminaDelay <= 0 && !PL.sprinting) G.stamina = Math.min(G.maxStamina, G.stamina + dt * (PL.guarding ? 16 : 34));
  // mana: a slow trickle — the point is to break it, not to wait for it
  if (PL.state !== 'collapse') G.mana = Math.min(G.maxMana, G.mana + dt * (1.4 + G.lvl * 0.14));

  if (canAct()) readBufferedInput(dt);

  // spell slot selection
  for (let i = 0; i < 5; i++) if (IN.pressed('spell' + (i + 1)) && PLAYER_SPELLS()[i]) { PL.slotIdx = i; BUS.emit('slot'); }
  if (IN.wheel && !CAM.lockTarget && !IN.down('cast')) {
    const n = PLAYER_SPELLS().length; if (n) { PL.slotIdx = (PL.slotIdx + IN.wheel + n) % n; BUS.emit('slot'); }
  }
  if (IN.pressed('lock')) toggleLockOn();
  if (CAM.lockTarget && (CAM.lockTarget.dead || CAM.lockTarget.pos.distanceTo(b.pos) > 32)) CAM.lockTarget = null;

  switch (PL.state) {
    case 'move':      stMove(dt); break;
    case 'air':       stAir(dt); break;
    case 'dodge':     stDodge(dt); break;
    case 'attack':    stAttack(dt); break;
    case 'castShoot': stCastShoot(dt); break;
    case 'hit':       stHit(dt); break;
    case 'collapse':  stCollapse(dt); break;
    case 'dead':      b.vel.x = b.vel.z = 0; break;
    case 'rest': case 'talk': case 'climb': b.vel.x = b.vel.z = 0; break;
    case 'interact':  b.vel.x = b.vel.z = 0; if (PL.stateT > 0.9) setPlayerState('move'); break;
  }

  moveBody(b, dt);
  if (b.hitDeepWater && PL.state === 'move' && (_mv.x || _mv.z)) { b.hitDeepWater = false; BUS.emit('hint', 'Too deep to wade.'); }
  b.hitDeepWater = false;

  // fall damage (Souls-style: survivable heights hurt, cliffs kill)
  if (b.justLanded) {
    b.justLanded = false;
    const fell = PL.fallStartY - b.pos.y;
    if (fell > 9 && !PL.gliding) damagePlayer(Math.round((fell - 9) * 9), { pure: true, noStagger: fell < 14 });
    PL.gliding = false;
    if (PL.state === 'air') {
      setPlayerState('move');
      A.once('Jump_Land', { speed: 1.8, fade: 0.08, onEnd: () => { if (PL.state === 'move') A.loop('Idle', { fade: 0.15 }); } });
      BUS.emit('land', b.landSpeed);
    }
  }
  if (!b.grounded && PL.state === 'move' && b.pos.y < b.groundY - 0.05) {
    // walked off a ledge
    setPlayerState('air'); PL.fallStartY = b.pos.y; A.loop('Jump_Idle', { fade: 0.2 });
  }

  // interaction prompt
  PL.interactTarget = canAct() && PL.state === 'move' ? nearestInteractable() : null;
  if (PL.interactTarget && IN.pressed('interact')) PL.interactTarget.action();

  A.root.position.copy(b.pos);
  A.root.rotation.y = PL.face;
  A.update(dt);

  G.pos = [b.pos.x, b.pos.y, b.pos.z];
  G.hp = Math.min(G.hp, G.maxHp);
}

function readBufferedInput(dt) {
  if (IN.pressed('attack')) PL.buffer.attack = 0.25;
  if (IN.pressed('jump')) PL.buffer.jump = 0.2;
  // sprint key: short tap = dodge, hold = sprint
  if (IN.down('sprint')) PL.sprintHeldT += dt;
  if (IN.released('sprint')) { if (PL.sprintHeldT < 0.22) PL.buffer.dodge = 0.25; PL.sprintHeldT = 0; }
  if (IN.pressed('cast')) PL.buffer.cast = 0.22;
}

/* ───────────── move (grounded) ───────────── */
function stMove(dt) {
  const b = PL.body, A = PL.actor;
  inputDir(_mv);
  const has = _mv.lengthSq() > 0.01;
  if (IN.pressed('walk')) PL.walkToggle = !PL.walkToggle;

  // guard (held)
  PL.guarding = IN.down('guard') && !PL.chanting;
  if (IN.pressed('guard')) PL.parryT = STYLES[G.style].parryWindow;

  // chanting (held cast) — begin on press, resolve on release
  if (PL.buffer.cast && !PL.chanting && !PL.guarding) { PL.buffer.cast = 0; beginChant(); }
  if (PL.chanting) {
    PL.chantT += dt;
    if (!IN.down('cast')) releaseChant();
  }

  PL.sprinting = has && IN.down('sprint') && PL.sprintHeldT > 0.22 && !PL.chanting && !PL.guarding && G.stamina > 0;
  let speed = PL.walkToggle ? WALK_SPEED : RUN_SPEED;
  if (PL.sprinting) { speed = SPRINT_SPEED; G.stamina -= dt * 16; PL.staminaDelay = 0.5; }
  if (PL.chanting) speed = RUN_SPEED * 0.45;
  if (PL.guarding) speed = WALK_SPEED * 0.9;
  if (b.inWater > 0.4) speed *= 0.6;
  speed *= RACES[G.race].spd * (PL.slow > 0 ? 1 - PL.slow : 1);
  const tx = has ? _mv.x * speed : 0, tz = has ? _mv.z * speed : 0;
  const k = has ? 14 : 10;
  b.vel.x = damp(b.vel.x, tx, k, dt); b.vel.z = damp(b.vel.z, tz, k, dt);
  PL.moveSpeed = Math.hypot(b.vel.x, b.vel.z);

  // facing
  const locked = CAM.lockTarget && !PL.sprinting;
  if (PL.chanting || PL.guarding && !locked) faceToward(CAM.yaw + Math.PI, 14, dt);
  else if (locked) faceToward(angleTo(CAM.lockTarget.pos.x, CAM.lockTarget.pos.z), 12, dt);
  else if (has) faceToward(Math.atan2(_mv.x, _mv.z), 12, dt);

  // animation
  if (PL.guarding) { A.setUpper('Blocking'); }
  else if (PL.chanting) { A.setUpper(PL.chantT > CHANT.need ? 'Spellcasting' : 'Spellcast_Raise', { speed: 1 }); }
  else A.setUpper(null);
  locomotionAnim(A, b, locked);

  // actions
  if (PL.buffer.jump && b.grounded) { PL.buffer.jump = 0; doJump(); return; }
  if (PL.buffer.dodge && !PL.chanting) { PL.buffer.dodge = 0; if (spendStamina(18)) { startDodge(); return; } }
  if (PL.buffer.attack && !PL.chanting && !PL.guarding) { PL.buffer.attack = 0; startAttack(0); return; }
  // charged heavy: hold attack
  if (IN.down('attack') && !PL.chanting) { PL.heavyCharge += dt; if (PL.heavyCharge > 0.34) { PL.heavyCharge = 0; startAttack(-1); return; } }
  else PL.heavyCharge = 0;
}

function locomotionAnim(A, b, locked) {
  const sp = PL.moveSpeed;
  if (sp < 0.35) { A.loop(PL.guarding || CAM.lockTarget ? 'Idle_Combat' : 'Idle', { fade: 0.25 }); return; }
  if (locked) {
    // strafe set relative to facing
    const f = PL.face, fx = Math.sin(f), fz = Math.cos(f);
    const fwd = (b.vel.x * fx + b.vel.z * fz) / sp, side = (b.vel.x * fz - b.vel.z * fx) / sp;
    if (fwd < -0.5) { A.loop('Walking_Backwards', { speed: sp / 2.4 }); return; }
    if (Math.abs(side) > 0.6) { A.loop(side > 0 ? 'Running_Strafe_Left' : 'Running_Strafe_Right', { speed: sp / 4.5 }); return; }
  }
  if (sp < 3.2) A.loop('Walking_A', { speed: sp / 2.3 });
  else A.loop('Running_A', { speed: clamp(sp / 5.4, 0.8, 1.45) });
}

function doJump() {
  const b = PL.body;
  if (!spendStamina(6) && G.stamina <= 0) return;
  b.vel.y = JUMP_V; b.grounded = false;
  PL.fallStartY = b.pos.y; PL.airT = 0; PL.gliding = false;
  setPlayerState('air');
  PL.actor.setUpper(null);
  PL.chanting = null;
  PL.actor.once('Jump_Start', { speed: 2.2, fade: 0.08, onEnd: () => { if (PL.state === 'air') PL.actor.loop('Jump_Idle', { fade: 0.15 }); } });
  BUS.emit('sfx', { id: 'jump' });
}

/* ───────────── air + Gale Step glide ───────────── */
function stAir(dt) {
  const b = PL.body;
  PL.airT += dt;
  inputDir(_mv);
  const has = _mv.lengthSq() > 0.01;
  // air control: steer, but momentum mostly carries
  const ctrl = PL.gliding ? 5.5 : 2.5;
  const target = PL.gliding ? 7.5 : Math.max(RUN_SPEED, Math.hypot(b.vel.x, b.vel.z));
  if (has) {
    b.vel.x = damp(b.vel.x, _mv.x * target, ctrl, dt);
    b.vel.z = damp(b.vel.z, _mv.z * target, ctrl, dt);
    faceToward(Math.atan2(_mv.x, _mv.z), PL.gliding ? 4 : 8, dt);
  }
  // Gale Step: hold jump while falling — wind magic cushions you, at a mana cost
  const wantGlide = IN.down('jump') && b.vel.y < 0 && PL.airT > 0.25 && G.mana > 1;
  if (wantGlide && !PL.gliding) { PL.gliding = true; BUS.emit('glide', true); PL.actor.loop('Jump_Idle', { fade: 0.2 }); }
  if (!wantGlide && PL.gliding) { PL.gliding = false; BUS.emit('glide', false); PL.fallStartY = b.pos.y; }
  if (PL.gliding) {
    b.gravityScale = 0.18; b.maxFall = -2.4;
    spendMana(dt * 7);                 // every metre of glide feeds the vessel
    if (!has) { const fx = Math.sin(PL.face), fz = Math.cos(PL.face); b.vel.x = damp(b.vel.x, fx * 6, 2, dt); b.vel.z = damp(b.vel.z, fz * 6, 2, dt); }
  } else { b.gravityScale = 1; b.maxFall = -45; }
  if (b.grounded) { b.gravityScale = 1; b.maxFall = -45; }
  // plunge: attack in the air
  if (PL.buffer.attack && PL.airT > 0.15) { PL.buffer.attack = 0; b.gravityScale = 1; b.maxFall = -45; PL.gliding = false; startAttack(-1); }
}

/* ───────────── dodge ───────────── */
function startDodge() {
  const b = PL.body;
  inputDir(_mv);
  let clip = 'Dodge_Forward';
  if (_mv.lengthSq() < 0.01) {
    // no input: a backstep, like Souls
    PL.dodgeDir.set(-Math.sin(PL.face), 0, -Math.cos(PL.face));
    clip = 'Dodge_Backward';
  } else {
    PL.dodgeDir.copy(_mv).normalize();
    if (CAM.lockTarget) {
      const fx = Math.sin(PL.face), fz = Math.cos(PL.face);
      const fwd = PL.dodgeDir.x * fx + PL.dodgeDir.z * fz, side = PL.dodgeDir.x * fz - PL.dodgeDir.z * fx;
      clip = Math.abs(fwd) > Math.abs(side) ? (fwd > 0 ? 'Dodge_Forward' : 'Dodge_Backward') : (side > 0 ? 'Dodge_Left' : 'Dodge_Right');
    } else PL.face = Math.atan2(PL.dodgeDir.x, PL.dodgeDir.z);
  }
  PL.chanting = null; PL.guarding = false;
  PL.actor.setUpper(null);
  setPlayerState('dodge');
  PL.iframe = 0.34;
  PL.actor.once(clip, { speed: 0.82, fade: 0.06 });
  BUS.emit('sfx', { id: 'dodge' });
}
function stDodge(dt) {
  const b = PL.body, T = 0.5;
  const t = PL.stateT / T;
  const sp = lerp(9.5, 1.5, t * t) * RACES[G.race].spd;
  b.vel.x = PL.dodgeDir.x * sp; b.vel.z = PL.dodgeDir.z * sp;
  if (PL.stateT > T * 0.8 && PL.buffer.attack) { PL.buffer.attack = 0; startAttack(0); return; }  // roll-attack
  if (PL.stateT >= T) { setPlayerState('move'); PL.actor.loop('Idle', { fade: 0.18 }); }
}

/* ───────────── sword ───────────── */
function startAttack(step) {
  const S = STYLES[G.style];
  const move = step < 0 ? S.heavy : S.combo[step];
  if (!spendStamina(move.st)) return;
  PL.combo = step < 0 ? 0 : step;
  PL.attackStep = move; PL.attackHits.clear(); PL.comboQueued = false;
  PL.hyper = step < 0;                 // heavy attacks don't flinch
  PL.chanting = null; PL.guarding = false;
  setWeapon('sword');
  PL.actor.setUpper(null);
  // face the lock target, else your stick, else the camera
  inputDir(_mv);
  if (CAM.lockTarget) PL.face = angleTo(CAM.lockTarget.pos.x, CAM.lockTarget.pos.z);
  else if (_mv.lengthSq() > 0.01) PL.face = Math.atan2(_mv.x, _mv.z);
  else { const e = softTarget(6); if (e) PL.face = angleTo(e.pos.x, e.pos.z); }
  setPlayerState('attack');
  PL.actor.once(move.clip, { speed: move.speed, fade: 0.08 });
  BUS.emit('sfx', { id: 'swing', heavy: step < 0 });
}
function stAttack(dt) {
  const b = PL.body, m = PL.attackStep, p = PL.actor.progress();
  // lunge during the windup, then plant
  const lunge = p < m.hit[0] ? m.lunge : p < m.hit[1] ? m.lunge * 0.3 : 0;
  const fx = Math.sin(PL.face), fz = Math.cos(PL.face);
  b.vel.x = fx * lunge; b.vel.z = fz * lunge;
  if (p >= m.hit[0] && p <= m.hit[1]) playerSwingHits(m);
  if (PL.buffer.attack && p > 0.25) PL.comboQueued = true;
  if (p >= m.cancel) {
    const S = STYLES[G.style];
    if (PL.comboQueued && PL.attackStep !== S.heavy && PL.combo + 1 < S.combo.length) { PL.buffer.attack = 0; startAttack(PL.combo + 1); return; }
    if (PL.buffer.dodge) { PL.buffer.dodge = 0; if (spendStamina(18)) { startDodge(); return; } }
    if (PL.buffer.cast) { setPlayerState('move'); return; }
    inputDir(_mv);
    if (_mv.lengthSq() > 0.01 && p > m.cancel + 0.08) { finishAttack(); return; }
  }
  if (p >= 0.98) finishAttack();
}
function finishAttack() { PL.hyper = false; PL.attackStep = null; setPlayerState('move'); PL.actor.loop('Idle_Combat', { fade: 0.2 }); }

function setWeapon(w) {
  if (PL.weapon === w) return;
  PL.weapon = w;
  PL.actor.show('2H_Staff', w === 'staff');
  PL.actor.show('1H_Sword', w === 'sword');
}

/* ───────────── casting (chant / chantless) ───────────── */
function PLAYER_SPELLS() { return unlockedSpells(); }
function currentSpell() { const l = PLAYER_SPELLS(); return l[Math.min(PL.slotIdx, l.length - 1)] || null; }
function beginChant() {
  const sp = currentSpell();
  if (!sp || (G.cds[sp.id] || 0) > 0 || G.mana < 1) { if (sp && G.mana < 1) BUS.emit('hint', 'The vessel is empty.'); return; }
  PL.chanting = sp; PL.chantT = 0;
  setWeapon('staff');
  CAM.aiming = true;
  BUS.emit('chant', sp);
}
function releaseChant() {
  const sp = PL.chanting, t = PL.chantT;
  PL.chanting = null; CAM.aiming = false;
  PL.actor.setUpper(null);
  PL.castPending = { spell: sp, incanted: t >= CHANT.need, fired: false };
  setPlayerState('castShoot');
  PL.face = CAM.lockTarget ? angleTo(CAM.lockTarget.pos.x, CAM.lockTarget.pos.z) : CAM.yaw + Math.PI;
  PL.actor.once(sp.kind === 'self' || sp.kind === 'aura' ? 'Spellcast_Raise' : 'Spellcast_Shoot',
    { speed: sp.kind === 'self' || sp.kind === 'aura' ? 2.6 : 1.9, fade: 0.06 });
}
function stCastShoot(dt) {
  const b = PL.body;
  b.vel.x = damp(b.vel.x, 0, 12, dt); b.vel.z = damp(b.vel.z, 0, 12, dt);
  const p = PL.actor.progress();
  if (!PL.castPending.fired && p > 0.28) {
    PL.castPending.fired = true;
    castPlayerSpell(PL.castPending.spell, PL.castPending.incanted);
    if (PL.state !== 'castShoot') return;      // the cast broke the vessel
  }
  if (p > 0.6 && (PL.buffer.dodge || PL.buffer.attack || PL.buffer.cast || _mvHas())) { setPlayerState('move'); return; }
  if (p >= 0.98) { setPlayerState('move'); PL.actor.loop('Idle', { fade: 0.2 }); }
}
function _mvHas() { return Math.abs(IN.moveX) + Math.abs(IN.moveZ) > 0.1; }
function breakChant() {
  if (!PL.chanting) return;
  PL.chanting = null; CAM.aiming = false; PL.actor.setUpper(null);
  BUS.emit('toast', { text: 'Chant broken', cls: 'bad' });
  BUS.emit('sfx', { id: 'chantBreak' });
}

/* ───────────── getting hit ───────────── */
// Called by combat when something connects with the player.
function playerHit(dmg, { dir = null, poise = 20, unblockable = false, pure = false, noStagger = false, source = null } = {}) {
  if (PL.state === 'dead') return 'dead';
  if (!pure && PL.iframe > 0) return 'dodged';
  // parry: guard pressed just before the blow
  if (!pure && !unblockable && PL.parryT > 0 && dir && facingAway(dir) < 0) {
    PL.parryT = 0; PL.iframe = 0.35;
    BUS.emit('parry', source);
    return 'parried';
  }
  let taken = dmg * DIFFICULTY[SETTINGS.difficulty].taken;
  if (!pure && !unblockable && PL.guarding && dir && facingAway(dir) < 0) {
    const st = taken * 1.1;
    if (G.stamina >= st * 0.5) {
      G.stamina -= st; PL.staminaDelay = 0.9;
      taken *= 0.18;
      PL.actor.once('Block_Hit', { speed: 1.6, fade: 0.05, onEnd: () => PL.state === 'move' && PL.actor.loop('Idle_Combat') });
      BUS.emit('sfx', { id: 'block' });
      G.hp -= taken;
      if (G.hp <= 0) { playerDie(); return 'dead'; }
      return 'blocked';
    }
    PL.guarding = false;              // guard broken
    BUS.emit('toast', { text: 'Guard broken', cls: 'bad' });
  }
  G.hp -= taken;
  PL.lastHitT = GAME.time;
  breakChant();
  BUS.emit('playerHurt', { dmg: taken, dir });
  if (G.hp <= 0) { playerDie(); return 'dead'; }
  if (!PL.hyper && !noStagger && PL.state !== 'collapse') {
    setPlayerState('hit');
    PL.iframe = 0.2;
    if (dir) PL.knock.copy(dir).setY(0).normalize().multiplyScalar(Math.min(7, 2.5 + poise * 0.06));
    PL.actor.once(poise > 35 ? 'Hit_B' : 'Hit_A', { speed: 1.5, fade: 0.05 });
  }
  return 'hit';
}
// dot of your facing with a hit direction: < 0 means the blow comes from the front
function facingAway(dir) { return Math.sin(PL.face) * dir.x + Math.cos(PL.face) * dir.z; }
function stHit(dt) {
  const b = PL.body;
  b.vel.x = PL.knock.x; b.vel.z = PL.knock.z;
  PL.knock.multiplyScalar(Math.exp(-dt * 7));
  if (PL.stateT > 0.42) { setPlayerState('move'); PL.actor.loop('Idle_Combat', { fade: 0.2 }); }
}
function playerDie() {
  G.hp = 0;
  setPlayerState('dead');
  PL.chanting = null; CAM.aiming = false; CAM.lockTarget = null;
  PL.actor.setUpper(null);
  PL.actor.once('Death_A', { speed: 0.9, fade: 0.1 });
  G.deaths++;
  BUS.emit('playerDied');
}

/* ───────────── the vessel collapse ───────────── */
function startCollapse() {
  setPlayerState('collapse');
  PL.chanting = null; CAM.aiming = false; CAM.lockTarget = null;
  PL.actor.setUpper(null);
  PL.body.vel.set(0, PL.body.vel.y, 0);
  PL.collapseT = 0;
  PL.actor.once('Lie_Down', { speed: 2.6, fade: 0.1, onEnd: () => { if (PL.state === 'collapse') PL.actor.loop('Lie_Idle', { fade: 0.15 }); } });
}
function stCollapse(dt) {
  PL.body.vel.x = PL.body.vel.z = 0;
  PL.collapseT += dt;
  if (PL.collapseT > 1.9 && !PL._rising) {
    PL._rising = true;
    PL.actor.once('Lie_StandUp', { speed: 2.4, fade: 0.12, onEnd: () => {
      PL._rising = false; setPlayerState('move'); PL.actor.loop('Idle', { fade: 0.2 }); endCollapse();
    } });
  }
}

/* ───────────── interaction ───────────── */
const INTERACTABLES = [];     // { pos: Vector3, r, label: () => string, action: () => void, enabled?: () => bool }
function nearestInteractable() {
  const p = PL.body.pos, fx = Math.sin(PL.face), fz = Math.cos(PL.face);
  let best = null, bestS = Infinity;
  for (const it of INTERACTABLES) {
    if (it.enabled && !it.enabled()) continue;
    const dx = it.pos.x - p.x, dz = it.pos.z - p.z, d = Math.hypot(dx, dz);
    if (d > it.r || Math.abs(it.pos.y - p.y) > 3) continue;
    const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
    const s = d - facing * 0.8;                 // prefer what you're looking at
    if (s < bestS) { bestS = s; best = it; }
  }
  return best;
}
