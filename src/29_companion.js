/* ═══════════════════════════════════════════════════════════════════════
   COMPANION — Eris, once she insists on coming along.

   She follows a step behind your left shoulder, runs to catch up, and
   when something near you wants a fight she goes and gives it one: sword
   combos from the shared clip library, real damage through the same
   damageEnemy as yours. Enemies keep their eyes on you (they came for the
   mage); she can't fall — a Boreas doesn't. If she's left far behind (fast
   travel, a fall) she catches up out of sight. And she talks: short barks
   at the bottom of the screen that never stop the game.
   ═══════════════════════════════════════════════════════════════════════ */
const ALLY = { eris: null };
const ALLY_CLIPS = ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab'];
const ERIS_BARKS = {
  engage: ['Finally!', 'Mine!', 'Stay behind me, {name}!', 'Hah! Come on, then!', 'I saw it first!'],
  kill: ['Hah! Too slow!', 'Next!', 'Did you SEE that?!', 'That one was mine.'],
  hurt: ['{name}! Get back!', 'Don\'t you DARE fall over!', 'Heal yourself, idiot!'],
  idle: ['I\'m bored. Find something to hit.', 'Ghislaine says I\'m getting faster. I AM getting faster.', 'Grandfather says a lady doesn\'t run. I run.', 'You walk like a scholar.'],
  steel: ['My sword just BOUNCES off it! Use your magic!'],
  vessel: ['{name}?! ...Show-off.'],
  mount: ['Move over. I\'m riding too.', 'Budge up, tutor.', 'Don\'t you dare leave without me!'],
  ride: ['FASTER!', 'Hah! Kestrel likes me better.', 'If you fall off, I\'m not stopping.', 'Grandfather says I ride like a bandit. Good!'],
};

class Companion {
  constructor(spec, name, col) {
    this.name = name; this.col = col;
    this.actor = new Actor(spec);
    this.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 0.38, h: 1.6, grounded: true, groundY: 0 };
    this.pos = this.body.pos;
    this.face = 0; this.state = 'follow'; this.stateT = 0;
    this.target = null; this.cd = 0; this.combo = 0; this.hitDone = false;
    this.barkCd = 3; this.idleT = 60; this.active = false;
    this.actor.root.visible = false;
    scene.add(this.actor.root);
    this.actor.loop('Idle', { fade: 0 });
  }
  // stand her a few steps behind your left shoulder, on the ground
  placeBehind() {
    const P = PL.body.pos, f = PL.face;
    const x = P.x - Math.sin(f) * 2.6 - Math.cos(f) * 1.4, z = P.z - Math.cos(f) * 2.6 + Math.sin(f) * 1.4;
    this.pos.set(x, floorAt(x, z), z); this.body.vel.set(0, 0, 0); this.body.grounded = true;
    this.face = f;
    this.actor.root.position.copy(this.pos); this.actor.root.rotation.y = f;
  }
  join() { this.active = true; this.actor.root.visible = true; this.placeBehind(); this.set('follow'); }
  leave() { this.active = false; this.actor.root.visible = false; this.target = null; }
  set(s) { this.state = s; this.stateT = 0; }
  bark(kind, force) {
    if (!force && this.barkCd > 0) return;
    const list = ERIS_BARKS[kind]; if (!list) return;
    bark(this.name, pick(list).replace('{name}', G.name), this.col);
    this.barkCd = 6 + Math.random() * 4;
  }
  pickTarget() {
    const P = PL.body.pos;
    let best = null, bd = 1e9;
    for (const e of ENT.enemies) {
      if (e.dead || e.inactive || e.state === 'dormant' || e.def.static || e.def.spar || !e.lockable) continue;
      if (!e.aggro && e.dist() > 9) continue;                       // only fights that are happening, or about to
      const dP = Math.hypot(e.pos.x - P.x, e.pos.z - P.z);
      if (dP > 24 || Math.abs(e.pos.y - P.y) > 6) continue;
      const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) + dP * 0.5;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // up behind you on Kestrel: same seat, half a saddle further back
  ridePillion(dt) {
    const A = this.actor, R = HORSE.rig;
    if (!this.riding) { this.riding = true; this.target = null; this.set('follow'); this.bark('mount', true); this.rideBarkT = 20 + Math.random() * 20; }
    R.body.updateMatrixWorld(true);
    _pv.set(0, 0.36, -0.4).applyMatrix4(R.body.matrixWorld);
    A.root.position.set(_pv.x, _pv.y - 0.06, _pv.z); A.root.rotation.y = HORSE.heading;
    this.pos.copy(HORSE.body.pos); this.face = HORSE.heading;
    A.loop('Idle', { fade: 0.2 });
    A.update(dt);
    for (const [s, side] of [[1, 'l'], [-1, 'r']]) {
      A.bones['upperleg' + side].quaternion.multiply(_pq.setFromEuler(_pe.set(-1.0, 0, -0.55 * s)));
      A.bones['lowerleg' + side].quaternion.multiply(_pq.setFromEuler(_pe.set(1.15, 0, 0)));
    }
    this.rideBarkT -= dt; this.barkCd -= dt;
    if (this.rideBarkT < 0 && HORSE.speed > 10) { this.rideBarkT = 30 + Math.random() * 30; this.bark('ride', true); }
  }
  update(dt) {
    if (!this.active) return;
    if (typeof HORSE !== 'undefined' && HORSE.mode === 'ride') { this.ridePillion(dt); return; }
    if (this.riding) { this.riding = false; this.placeBehind(); this.set('follow'); }
    const A = this.actor, b = this.body, P = PL.body.pos;
    this.stateT += dt; this.cd -= dt; this.barkCd -= dt; this.idleT -= dt;
    const dP = Math.hypot(P.x - this.pos.x, P.z - this.pos.z);
    // left far behind (fast travel, a long fall, a cave mouth): catch up unseen
    if (dP > 45 || Math.abs(P.y - this.pos.y) > 14) { this.placeBehind(); this.set('follow'); }
    let want = null, speed = 0;
    if (this.state === 'attack') {
      const clip = CHARS.clips.get(this.clip), dur = clip ? clip.duration / 1.3 : 0.7;
      const T = this.target;
      if (T && !T.dead) this.face = dampAngle(this.face, Math.atan2(T.pos.x - this.pos.x, T.pos.z - this.pos.z), 10, dt);
      if (!this.hitDone && this.stateT > dur * 0.42) {
        this.hitDone = true;
        if (T && !T.dead) {
          const dx = T.pos.x - this.pos.x, dz = T.pos.z - this.pos.z, d = Math.hypot(dx, dz);
          const facing = (dx * Math.sin(this.face) + dz * Math.cos(this.face)) / Math.max(d, 1e-3);
          if (d < 2.5 + T.r && facing > 0.3) {
            const dir = new THREE.Vector3(dx / d, 0, dz / d);
            damageEnemy(T, (11 + G.lvl * 2.2) * (this.combo === 2 ? 1.5 : 1), { dir, knock: 2.2, poise: 20, kind: 'ally' });
            BUS.emit('sfx', { id: 'hit', pos: T.pos });
            if (T.def.steelRes && !this.toldSteel) { this.toldSteel = true; this.bark('steel', true); }
            if (T.dead) this.bark('kill');
          }
        }
      }
      if (this.stateT > dur * 0.85) { this.set('recover'); this.cd = this.combo >= 2 ? 1.6 : 0.35; this.combo = (this.combo + 1) % 3; }
    } else if (this.state === 'recover') {
      if (this.stateT > 0.25) this.set('follow');
    } else {
      const T = this.pickTarget();
      if (T && T !== this.target) { this.target = T; this.bark('engage'); }
      if (!T) { this.target = null; this.combo = 0; }
      if (this.target) {
        const T2 = this.target, dx = T2.pos.x - this.pos.x, dz = T2.pos.z - this.pos.z, d = Math.hypot(dx, dz);
        const reach = 1.7 + T2.r;
        this.face = dampAngle(this.face, Math.atan2(dx, dz), 9, dt);
        if (d > reach) { want = [dx / d, dz / d]; speed = d > 6 ? 6.2 : 3.4; }
        else if (this.cd <= 0) {
          this.clip = ALLY_CLIPS[this.combo]; this.hitDone = false;
          A.once(this.clip, { speed: 1.3, fade: 0.08 });
          BUS.emit('sfx', { id: 'swing', pos: this.pos });
          this.set('attack');
        }
      } else {
        // follow: a point behind your left shoulder; run if you're running away from her
        const f = PL.face, tx = P.x - Math.sin(f) * 2.6 - Math.cos(f) * 1.4, tz = P.z - Math.cos(f) * 2.6 + Math.sin(f) * 1.4;
        const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
        if (d > 1.2) { want = [dx / d, dz / d]; speed = d > 7 ? 6.6 : d > 3 ? 4.2 : 2.2; this.face = dampAngle(this.face, Math.atan2(dx, dz), 8, dt); }
        else this.face = dampAngle(this.face, PL.face, 3, dt);
        if (this.idleT < 0 && !ENT.enemies.some(e => e.aggro && !e.dead)) { this.idleT = 70 + Math.random() * 60; this.bark('idle', true); }
      }
    }
    if (G.hp < G.maxHp * 0.3 && this.target) this.bark('hurt');
    // steering → physics
    const vx = want ? want[0] * speed : 0, vz = want ? want[1] * speed : 0;
    b.vel.x = damp(b.vel.x, vx, 10, dt); b.vel.z = damp(b.vel.z, vz, 10, dt);
    moveBody(b, dt);
    // animation
    if (this.state !== 'attack') {
      const sp = Math.hypot(b.vel.x, b.vel.z);
      A.loop(sp > 4.6 ? 'Running_A' : sp > 0.6 ? 'Walking_A' : (this.target ? '2H_Melee_Idle' : 'Idle'), { fade: 0.2 });
    }
    A.root.position.copy(this.pos);
    A.root.rotation.y = this.face;
    A.update(dt);
  }
}
const _pv = new THREE.Vector3(), _pq = new THREE.Quaternion(), _pe = new THREE.Euler();
function updateAllies(dt) { if (ALLY.eris) ALLY.eris.update(dt); }
function allyBodies() { return ALLY.eris && ALLY.eris.active && !ALLY.eris.riding ? [ALLY.eris.body] : []; }
BUS.on('vesselBreak', () => { if (ALLY.eris && ALLY.eris.active) later(1.2, () => ALLY.eris.bark('vessel', true)); });
