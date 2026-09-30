/* ═══════════════════════════════════════════════════════════════════════
   COMBAT — hits, damage, poise, lock-on, experience.

   Poise: every enemy has a poise bar that heavy hits, kicks and stone
   shots chew through. Breaking it staggers the enemy for ~1.4 s and the
   next hit you land is a CRITICAL (×2.2). Parrying does the same, at once.

   Hitstop: a connecting blow freezes the world for 40–110 ms scaled by the
   target's weight. It's the single biggest reason a sword feels heavy.
   ═══════════════════════════════════════════════════════════════════════ */
const ENT = { enemies: [], npcs: [] };



function hitstop(sec) { GAME.hitstop = Math.max(GAME.hitstop, sec); }

/* ───────────── player → enemies ───────────── */
const _hv = new THREE.Vector3();
function playerSwingHits(move) {
  const p = PL.body.pos, fx = Math.sin(PL.face), fz = Math.cos(PL.face);
  const S = STYLES[G.style], R = RACES[G.race];
  for (const e of ENT.enemies) {
    if (e.dead || e.inactive || PL.attackHits.has(e)) continue;
    const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz);
    if (d > move.reach + e.r) continue;
    if (Math.abs((e.pos.y + e.h * 0.5) - (p.y + 0.9)) > e.h * 0.5 + 1.2) continue;
    const ang = Math.acos(clamp((dx * fx + dz * fz) / Math.max(d, 1e-4), -1, 1));
    if (d > e.r + 0.4 && ang > move.arc) continue;
    PL.attackHits.add(e);
    const base = 16 * S.dmg * R.sword * (1 + G.lvl * 0.12) * move.dmg;
    const crit = e.staggerT > 0 || e.riposte;
    _hv.set(dx, 0, dz).normalize();
    damageEnemy(e, base * (crit ? 2.2 : 1), {
      dir: _hv.clone(), poise: (move.poise || 18) * (crit ? 0 : 1), knock: (move.knock || S.knock || 1) * 2.4, crit, kind: 'sword',
    });
    hitstop(0.045 + (e.def.weight || 1) * 0.022 + (crit ? 0.05 : 0));
    shake(0.18 + (crit ? 0.2 : 0));
    BUS.emit('sfx', { id: crit ? 'crit' : 'hit', pos: e.pos, heavy: (e.def.weight || 1) > 1 });
  }
}

/* Any damage to an enemy goes through here (sword, spells, burns, falls). */
function damageEnemy(e, dmg, o = {}) {
  if (e.dead || e.inactive) return;
  dmg *= DIFFICULTY[SETTINGS.difficulty].dealt;
  // shields and guarding enemies eat frontal damage
  if (e.shield && o.dir && e.state !== 'attack' && !o.crit && o.kind !== 'magicAoE') {
    const front = -(Math.sin(e.face) * o.dir.x + Math.cos(e.face) * o.dir.z);   // >0: hit from the front
    if (front > 0.35) {
      dmg *= 1 - e.shield;
      e.poise -= (o.poise || 10) * 0.5;
      BUS.emit('sfx', { id: 'block', pos: e.pos });
      BUS.emit('spark', { pos: e.pos.clone().setY(e.pos.y + 1.1), col: '#e8e0d0', n: 10 });
      if (e.poise <= 0) staggerEnemy(e);
      numbers(e, dmg, false, true);
      e.hp -= dmg;
      if (e.hp <= 0) killEnemy(e);
      return;
    }
  }
  if (e.riposte) { e.riposte = false; o.crit = true; }
  e.hp -= dmg;
  e.hurtT = 0.16;
  e.lastHitT = GAME.time;
  if (!e.aggro) alertEnemy(e, true);
  numbers(e, dmg, o.crit);
  if (o.burn) { e.burn = Math.max(e.burn || 0, o.burn); e.burnT = 2.8; }
  if (o.slow) { e.slow = Math.max(e.slow || 0, o.slow); e.slowT = 2.2; }
  if (o.root) { e.rootT = Math.max(e.rootT || 0, o.root); }
  if (o.knock && o.dir && !e.def.boss) {
    const k = o.knock * (1 - (e.def.knockRes || 0));
    e.body.vel.x += o.dir.x * k; e.body.vel.z += o.dir.z * k;
  }
  BUS.emit('spark', { pos: e.pos.clone().setY(e.pos.y + e.h * 0.55), col: o.crit ? '#ffe070' : '#ffd8b0', n: o.crit ? 22 : 10, dir: o.dir });
  if (e.hp <= 0) { killEnemy(e); return; }
  e.poise -= o.poise ?? 10;
  if (e.poise <= 0) staggerEnemy(e);
  else if (e.onFlinch && (o.poise ?? 10) >= (e.def.flinchAt ?? 8)) e.onFlinch(o);
  // a hit interrupts a caster's chant — the v2 rule, still true
  if (e.def.caster && e.state === 'windup') { e.interrupt(); BUS.emit('toast', { text: 'Interrupted', cls: 'good', at: e.pos }); }
}
function staggerEnemy(e) {
  e.poise = e.def.poise || 30;
  e.staggerT = e.def.boss ? 1.1 : 1.5;
  if (e.onStagger) e.onStagger();
  BUS.emit('sfx', { id: 'stagger', pos: e.pos });
  BUS.emit('toast', { text: 'Stagger', cls: 'good', at: e.pos });
}
function numbers(e, dmg, crit, blocked) {
  if (!SETTINGS.damageNumbers) return;
  BUS.emit('damageNumber', { pos: e.pos.clone().setY(e.pos.y + e.h + 0.3), value: Math.round(dmg), crit, blocked, target: e });
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; e.hp = 0;
  if (CAM.lockTarget === e) CAM.lockTarget = null;
  if (e.onDeath) e.onDeath();
  G.kills++;
  gainXp(e.def.xp || 10);
  // mana motes spill out — killing is how you refill a broken vessel
  const n = e.def.boss ? 8 : (Math.random() < 0.55 ? 1 + (Math.random() < 0.3 ? 1 : 0) : 0);
  for (let i = 0; i < n; i++) spawnPickup('mana', e.pos.x + rnd(-1, 1), e.pos.z + rnd(-1, 1));
  if (Math.random() < (e.def.boss ? 1 : 0.18)) spawnPickup('hp', e.pos.x + rnd(-1, 1), e.pos.z + rnd(-1, 1));
  BUS.emit('enemyKilled', e);
}

/* ───────────── enemies → player ───────────── */
// An enemy attack connecting. Returns what happened ('hit'|'blocked'|'parried'|'dodged').
function damagePlayer(dmg, o = {}) {
  const res = playerHit(dmg, o);
  if (res === 'hit' || res === 'blocked') {
    hitstop(res === 'hit' ? 0.06 : 0.03);
    shake(res === 'hit' ? 0.35 : 0.15);
    if (res === 'hit') BUS.emit('sfx', { id: 'hurt' });
  }
  return res;
}
BUS.on('parry', src => {
  hitstop(0.12); shake(0.3);
  BUS.emit('sfx', { id: 'parry' });
  BUS.emit('toast', { text: 'Parry', cls: 'good' });
  BUS.emit('spark', { pos: PL.body.pos.clone().setY(PL.body.pos.y + 1.3), col: '#bfe8ff', n: 30 });
  if (src && !src.dead) {
    src.riposte = true;
    staggerEnemy(src);
    // Water God answers a parry with an immediate counter-cut
    if (STYLES[G.style].counter) setTimeout(() => { if (PL.state === 'move' || PL.state === 'hit') startAttack(-1); }, 60);
  }
});

/* ───────────── lock-on ───────────── */
function lockCandidates(maxD = 28) {
  const p = PL.body.pos, out = [];
  for (const e of ENT.enemies) {
    if (e.dead || e.inactive || !e.lockable) continue;
    const d = e.pos.distanceTo(p);
    if (d > maxD) continue;
    // must be roughly on screen
    const v = e.lockPoint().clone().project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
    out.push({ e, d, sx: v.x });
  }
  return out;
}
function toggleLockOn() {
  if (CAM.lockTarget) { CAM.lockTarget = null; BUS.emit('sfx', { id: 'unlock' }); return; }
  const c = lockCandidates();
  if (!c.length) { CAM.yaw = PL.face + Math.PI; return; }       // no target: recentre the camera
  c.sort((a, b) => (Math.abs(a.sx) * 12 + a.d) - (Math.abs(b.sx) * 12 + b.d));
  CAM.lockTarget = c[0].e;
  BUS.emit('sfx', { id: 'lock' });
}
// flick the mouse sideways while locked to switch targets
let _flick = 0;
function lockSwitch(dt) {
  if (!CAM.lockTarget) { _flick = 0; return; }
  _flick = _flick * Math.exp(-dt * 8) + IN.lookX;
  if (Math.abs(_flick) < 90) return;
  const dir = Math.sign(_flick); _flick = 0;
  const cur = CAM.lockTarget.lockPoint().clone().project(camera).x;
  const c = lockCandidates().filter(o => o.e !== CAM.lockTarget && Math.sign(o.sx - cur) === dir);
  if (!c.length) return;
  c.sort((a, b) => Math.abs(a.sx - cur) - Math.abs(b.sx - cur));
  CAM.lockTarget = c[0].e;
  BUS.emit('sfx', { id: 'lock' });
}
// the nearest enemy roughly in front, for gentle attack auto-aim
function softTarget(maxD) {
  let best = null, bs = Infinity;
  const p = PL.body.pos, fx = -Math.sin(CAM.yaw), fz = -Math.cos(CAM.yaw);
  for (const e of ENT.enemies) {
    if (e.dead || e.inactive) continue;
    const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz);
    if (d > maxD) continue;
    const f = (dx * fx + dz * fz) / Math.max(d, 1e-4);
    if (f < 0.3) continue;
    const s = d - f * 3;
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}

/* ───────────── experience ───────────── */
function gainXp(n) {
  G.xp += n * RACES[G.race].xp;
  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext; G.lvl++;
    G.xpNext = Math.round(G.xpNext * 1.32);
    G.maxHp += 9; G.hp = G.maxHp;
    G.maxStamina += 3; G.stamina = G.maxStamina;
    BUS.emit('levelUp', G.lvl);
    const rank = guildRank(G.lvl);
    if (rank !== guildRank(G.lvl - 1)) BUS.emit('toast', { text: 'Adventurer Rank ' + rank, cls: 'big' });
  }
}
function guildRank(lvl) { let r = 'F'; for (const [l, n] of GUILD_RANKS) if (lvl >= l) r = n; return r; }
