/* ═══════════════════════════════════════════════════════════════════════
   MAGIC — spells, projectiles, and THE VESSEL.

   Chant rules (unchanged since v1): tap = chantless, instant, ×1.6 cost;
   hold 0.68 s = incanted, ×0.55 cost, ×1.45 power, half-speed walking,
   and a hit breaks it. Proficiency ranks each school up as you cast.

   The Vessel: when mana hits zero you COLLAPSE (helpless ~2.6 s), the pool
   grows 8%, and the break throws out a shockwave that staggers everything
   near you — the risky move that is also your escape hatch.
   ═══════════════════════════════════════════════════════════════════════ */
const MAGIC = { projectiles: [], effects: [], platforms: [], chantCircle: null, aimCircle: null };

function schoolRank(sc) {
  const p = G.prof[sc] || 0;
  for (let i = RANK_NEED.length - 1; i >= 0; i--) if (p >= RANK_NEED[i]) return i;
  return 0;
}
function isLearned(s) { return s.gift ? !!(G && G.flags && G.flags['spell_' + s.gift]) : (G.prof[s.school] || 0) >= (RANK_NEED[s.rank] ?? 999); }
function learnedIds() { return SPELLS.filter(isLearned).map(s => s.id); }
// One slot per school. It holds the spell you attuned in the Grimoire, or, if
// you never chose, the strongest you know. (Lower spells keep their uses: the
// pillar you climb, the bolt that freezes water.)
function unlockedSpells() {
  const best = {};
  for (const s of SPELLS) if (isLearned(s) && (!best[s.school] || s.rank > best[s.school].rank)) best[s.school] = s;
  const at = (G && G.attune) || {};
  return ['fire', 'water', 'wind', 'earth', 'heal'].map(k => {
    const chosen = at[k] && SPELL[at[k]];
    return chosen && chosen.school === k && isLearned(chosen) ? chosen : best[k];
  }).filter(Boolean);
}
function checkUnlocks(before) {
  const bar = unlockedSpells().map(s => s.id);
  for (const id of learnedIds()) if (!before.includes(id)) {
    const onBar = bar.includes(id);
    BUS.emit('toast', { text: 'Learned — ' + SPELL[id].name + (onBar ? '' : ' · attune it in the Grimoire'), cls: 'big' });
    BUS.emit('sfx', { id: 'unlock' });
    BUS.emit('slot');
  }
}

function spendMana(n) {
  if (!G || PL.state === 'collapse') return;
  G.mana -= n;
  if (G.mana <= 0.5) breakVessel();
}

/* ───────────── aiming ───────────── */
const _ao = new THREE.Vector3(), _ad = new THREE.Vector3(), _ap = new THREE.Vector3();
function aimPoint(out = new THREE.Vector3(), maxD = 60) {
  if (CAM.lockTarget) return out.copy(CAM.lockTarget.lockPoint());
  camera.getWorldPosition(_ao); camera.getWorldDirection(_ad);
  let best = raycastWorld(_ao, _ad, maxD);
  // the eye stops at the water's skin too: aim there and that's where the ice forms
  best = Math.min(best, rayWater(_ao, _ad, Math.min(best, maxD)));
  // enemies as spheres around their chest
  for (const e of ENT.enemies) {
    if (e.dead || e.inactive) continue;
    const c = e.lockPoint(), r = e.r + 0.35;
    const L = _ap.copy(c).sub(_ao), tca = L.dot(_ad);
    if (tca < 0) continue;
    const d2 = L.lengthSq() - tca * tca;
    if (d2 > r * r) continue;
    const t = tca - Math.sqrt(r * r - d2);
    if (t < best) best = t;
  }
  if (!isFinite(best)) best = maxD;
  return out.copy(_ao).addScaledVector(_ad, best);
}
// Distance along a ray to the water surface (lake or river), or Infinity.
function rayWater(o, d, maxD) {
  if (d.y >= -1e-4 || GAME.inCave) return Infinity;            // looking up never meets it
  const under = t => { const w = waterAt(o.x + d.x * t, o.z + d.z * t); return w > NO_WATER && o.y + d.y * t < w; };
  for (let t = 0.5; t < maxD; t += 0.75) {
    if (!under(t)) continue;
    let a = Math.max(0, t - 0.75), b = t;
    for (let k = 0; k < 6; k++) { const m = (a + b) / 2; if (under(m)) b = m; else a = m; }
    return b;
  }
  return Infinity;
}
// Where spells leave from: out in front of the casting hand, never below chest
// height. (Early in the cast animation the hand is low; a bolt born 0.5 m off
// the ground, aimed down a slope, buries itself in the hillside.)
function staffTip(out = new THREE.Vector3()) {
  PL.actor.bonePos('handslotr', out);
  out.x += Math.sin(PL.face) * 0.55; out.z += Math.cos(PL.face) * 0.55;
  out.y = Math.max(out.y + 0.35, PL.body.pos.y + 1.35);
  return out;
}

/* ───────────── casting ───────────── */
function castPlayerSpell(sp, incanted) {
  const cost = Math.round(sp.cost * (incanted ? CHANT.incantCost : CHANT.chantlessCost));
  const spent = Math.min(cost, G.mana);
  const eff = cost > 0 ? spent / cost : 1;         // an empty vessel still gives what it has
  const power = (incanted ? CHANT.incantPower : 1) * RACES[G.race].magic * (1 + G.lvl * 0.05) * (1 + schoolRank(sp.school) * 0.12) * eff * staffGearMul();
  G.cds[sp.id] = sp.cd * (incanted ? 1.15 : 1);
  const before = learnedIds();
  G.prof[sp.school] = (G.prof[sp.school] || 0) + (incanted ? 1.4 : 1.0);
  checkUnlocks(before);
  const col = SCHOOLS[sp.school].col;
  BUS.emit('sfx', { id: 'cast_' + sp.school, incanted });
  BUS.emit('cast', { spell: sp, incanted });

  const origin = staffTip(new THREE.Vector3());
  const target = aimPoint(new THREE.Vector3(), sp.range || 70);
  const dir = target.clone().sub(origin).normalize();
  emit(14, { pos: origin, col, spread: 0.1, velSpread: 2.5, life: 0.35, size: 0.35, bright: 2 });

  switch (sp.kind) {
    case 'bolt': {
      const shots = sp.shots || 1;
      for (let i = 0; i < shots; i++) {
        const d = dir.clone();
        if (shots > 1) d.applyAxisAngle(_up, (i - (shots - 1) / 2) * sp.spread).y += rnd(-0.03, 0.03);
        spawnProjectile({ pos: origin.clone(), dir: d.normalize(), spd: sp.spd, r: sp.radius, dmg: sp.dmg * power,
          school: sp.school, pierce: sp.pierce || 0, life: sp.life, gravity: sp.gravity || 0, knock: sp.knock || 0,
          slow: sp.slow, burn: sp.burn, freezes: sp.freezes, poise: sp.poise ?? 12,
          target: CAM.lockTarget, homing: CAM.lockTarget ? 2.5 : 0 });
      }
      if (sp.id === 'vacuum') { shake(0.35); hitstop(0.05); }
      break;
    }
    case 'beam':   addEffect({ kind: 'beam', t: 0, life: sp.life, dmg: sp.dmg * power, range: sp.range, school: sp.school, burn: sp.burn, tick: 0 }); break;
    case 'nova':   addEffect({ kind: 'nova', pos: groundPoint(target), t: 0, life: sp.life, r: sp.area, dmg: sp.dmg * power, school: sp.school, slow: sp.slow, burn: sp.burn, hits: new Set() }); shake(0.25); break;
    case 'burst':  addEffect({ kind: 'nova', pos: PL.body.pos.clone(), t: 0, life: sp.life, r: sp.area, dmg: sp.dmg * power, school: sp.school, knock: sp.knock, hits: new Set(), self: true }); shake(0.2); break;
    case 'meteor': addEffect({ kind: 'meteor', pos: groundPoint(target), t: 0, delay: sp.delay, r: sp.area, dmg: sp.dmg * power, burn: sp.burn }); break;
    case 'field':  addEffect({ kind: 'field', pos: groundPoint(target), t: 0, life: sp.life, r: sp.area, dmg: sp.dmg * power, slow: sp.slow, tick: 0, school: sp.school }); if (sp.school === 'water') freezeWaterNear(groundPoint(target), sp.area); break;
    case 'prison': addEffect({ kind: 'prison', pos: groundPoint(target), t: 0, life: sp.life, r: sp.area, dmg: sp.dmg * power, root: sp.root, applied: false }); shake(0.3); break;
    case 'wall':   raisePillar(groundPoint(target), sp.life); break;
    case 'self': {
      const h = sp.heal * power;
      G.hp = Math.min(G.maxHp, G.hp + h);
      if (sp.cleanse) { PL.slow = 0; PL.burn = 0; }
      emit(40, { pos: PL.body.pos.clone().setY(PL.body.pos.y + 1), col: col, col2: '#ffffff', spread: 0.6, vel: { x: 0, y: 2.2, z: 0 }, velSpread: 0.8, life: 1.2, size: 0.3, bright: 1.6 });
      ring(PL.body.pos, { col, r1: 2.2, life: 0.7 });
      BUS.emit('healNumber', Math.round(h));
      break;
    }
    case 'aura': addEffect({ kind: 'aura', t: 0, life: sp.life, r: sp.area, heal: sp.heal * power, tick: 0 }); break;
  }
  spendMana(spent);
}
const _up = new THREE.Vector3(0, 1, 0);
function groundPoint(p) { return new THREE.Vector3(p.x, groundAt(p.x, p.z, p.y + 1), p.z); }

/* ───────────── projectiles (the player's AND enemies') ───────────── */
const _projGeo = new THREE.IcosahedronGeometry(1, 1);
// a thrown boulder: lumpy, lit like the ground it came out of, no glow
const _rockGeo = (() => { const g = new THREE.DodecahedronGeometry(1, 1), p = g.attributes.position, n = Noise.make(31);
  for (let i = 0; i < p.count; i++) { const k = 1 + n(p.getX(i) * 2.1, p.getY(i) * 2.1 + p.getZ(i)) * 0.18; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.9, p.getZ(i) * k); }
  g.computeVertexNormals(); return g; })();
let _rockMat = null;
function spawnProjectile(o) {
  const col = o.col || SCHOOLS[o.school]?.col || '#ffffff';
  const core = o.rock ? new THREE.Mesh(_rockGeo, _rockMat || (_rockMat = toonMat({ color: '#8a7a64' })))
    : new THREE.Mesh(_projGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(o.hostile ? 2.2 : 3.2) }));
  if (o.rock) core.castShadow = true;
  core.scale.setScalar(o.r);
  core.position.copy(o.pos);
  scene.add(core);
  const p = { ...o, col, vel: o.dir.clone().multiplyScalar(o.spd), hits: new Set(), mesh: core, age: 0 };
  MAGIC.projectiles.push(p);
  return p;
}
const _pp = new THREE.Vector3(), _hm = new THREE.Vector3(), _hm2 = new THREE.Vector3(), _hm3 = new THREE.Vector3();
function updateProjectiles(dt) {
  for (let i = MAGIC.projectiles.length - 1; i >= 0; i--) {
    const p = MAGIC.projectiles[i];
    p.age += dt; p.life -= dt;
    // homing: turn toward the target by at most `homing` radians per second
    if (p.homing && p.target) {
      const tp = p.target === 'player' ? _hm.set(PL.body.pos.x, PL.body.pos.y + 1.1, PL.body.pos.z) : (p.target.dead ? null : p.target.lockPoint());
      if (tp) {
        const want = _hm2.copy(tp).sub(p.pos).normalize(), cur = _hm3.copy(p.vel).normalize();
        const ang = cur.angleTo(want);
        if (ang > 1.3) p.homing = 0;               // dodged past it: no boomerangs
        else if (ang > 1e-4) { cur.lerp(want, Math.min(1, p.homing * dt / ang)).normalize(); p.vel.copy(cur).multiplyScalar(p.spd); }
      }
    }
    p.vel.y -= (p.gravity || 0) * dt;
    const prevY = p.pos.y;
    p.pos.addScaledVector(p.vel, dt);
    p.mesh.position.copy(p.pos);
    // trail + light (a boulder tumbles and sheds grit instead)
    if (p.rock) {
      p.mesh.rotation.x += dt * 5; p.mesh.rotation.z += dt * 3;
      if (Math.random() < 0.5) emit(1, { pool: 'soft', pos: p.pos, col: '#8a7458', spread: p.r * 0.6, velSpread: 0.5, life: 0.6, size: 0.5, size2: 1.2, gravity: 2 });
    } else {
      emit(p.school === 'wind' ? 1 : 2, { pos: p.pos, col: p.col, spread: p.r * 0.5, velSpread: 0.6, life: 0.35, size: p.r * 1.6, size2: 0.02, bright: 1.6 });
      requestLight(p.pos, p.col, 5 + p.r * 6, 9);
    }
    let done = p.life <= 0;
    // water: a freezing bolt that crosses the surface makes an ice floe
    const w = waterAt(p.pos.x, p.pos.z);
    if (!done && p.freezes && !p.hostile && w > NO_WATER && prevY >= w && p.pos.y < w + 0.05) {
      makeIceFloe(p.pos.x, p.pos.z, w); done = true;
    }
    // anything else that meets the water ends there in a splash
    if (!done && w > NO_WATER && prevY >= w && p.pos.y < w) {
      emit(16, { pos: _pp.set(p.pos.x, w + 0.1, p.pos.z), col: '#cfe8f5', spread: 0.3, velSpread: 2.2, upBias: 3.5, life: 0.6, size: 0.12, size2: 0.04, gravity: 9 });
      ring(_pp, { col: '#bfe0f0', r1: 1.4, life: 0.5 });
      done = true;
    }
    // ground / walls
    if (!done && p.pos.y < heightAt(p.pos.x, p.pos.z)) done = true;
    if (!done) for (const c of nearColliders(p.pos.x, p.pos.z, 1)) {
      if (p.pos.y > c.y0 && p.pos.y < c.y1 && insideFootprint(c, p.pos.x, p.pos.z, p.r)) {
        if (c.tag === 'bramble' && p.school === 'fire') burnBramble(c);
        done = true; break;
      }
    }
    // targets
    if (!done && !p.hostile) {
      for (const e of ENT.enemies) {
        if (e.dead || e.inactive || p.hits.has(e)) continue;
        const cx = e.pos.x, cz = e.pos.z;
        if (Math.hypot(p.pos.x - cx, p.pos.z - cz) > e.r + p.r) continue;
        if (p.pos.y < e.pos.y - 0.2 || p.pos.y > e.pos.y + e.h + 0.2) continue;
        p.hits.add(e);
        damageEnemy(e, p.dmg, { dir: _pp.copy(p.vel).setY(0).normalize().clone(), knock: p.knock, slow: p.slow, burn: p.burn, poise: p.poise, kind: 'magic', school: p.school });
        BUS.emit('sfx', { id: 'impact_' + p.school, pos: p.pos });
        if (p.pierce > 0) p.pierce--; else { done = true; break; }
      }
    } else if (!done && p.hostile) {
      const b = PL.body;
      if (Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) < b.r + p.r && p.pos.y > b.pos.y - 0.1 && p.pos.y < b.pos.y + b.h) {
        damagePlayer(p.dmg, { dir: p.vel.clone().setY(0).normalize(), poise: p.poise || 15, source: p.source });
        done = true;
      }
    }
    if (done) {
      if (p.rock) {
        emit(30, { pool: 'soft', pos: p.pos, col: '#7a6a52', spread: p.r, velSpread: 5, upBias: 3, life: 1.1, size: 0.9, size2: 2.4, gravity: 7 });
        emit(16, { pos: p.pos, col: '#a08c70', spread: p.r * 0.5, velSpread: 7, upBias: 4, life: 0.8, size: 0.3, gravity: 14 });
        BUS.emit('sfx', { id: 'pillar', pos: p.pos });
        if (p.pos.distanceToSquared(PL.body.pos) < 15 * 15) shake(0.3);
      } else {
        emit(18, { pos: p.pos, col: p.col, spread: 0.2, velSpread: 4, life: 0.45, size: 0.35, bright: 2, gravity: p.school === 'earth' ? 9 : 0 });
        if (p.school === 'fire' && !p.hostile) burnNear(p.pos, 2);       // fire splashes: a near miss still catches
        if (p.school === 'earth') emit(10, { pool: 'soft', pos: p.pos, col: '#8a7458', spread: 0.3, velSpread: 3, life: 0.8, size: 0.4, size2: 1.2, gravity: 6 });
      }
      scene.remove(p.mesh); if (!p.rock) p.mesh.material.dispose();   // (boulders share one material)
      MAGIC.projectiles.splice(i, 1);
    }
  }
}

/* ───────────── area effects ───────────── */
function addEffect(e) {
  if (e.kind === 'meteor') {
    e.circle = runeCircle(SCHOOLS.fire.col); e.circle.position.copy(e.pos).setY(e.pos.y + 0.1); e.circle.scale.setScalar(e.r * 2);
    e.rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a2a').multiplyScalar(2.5) }));
    scene.add(e.rock);
    BUS.emit('sfx', { id: 'meteorFall' });
  }
  if (e.kind === 'field' || e.kind === 'prison' || e.kind === 'aura') {
    e.circle = runeCircle(e.kind === 'field' ? SCHOOLS[e.school || 'water'].col : e.kind === 'prison' ? SCHOOLS.earth.col : SCHOOLS.heal.col);
    e.circle.scale.setScalar(e.r * 2);
  }
  MAGIC.effects.push(e);
}
function updateEffects(dt) {
  for (let i = MAGIC.effects.length - 1; i >= 0; i--) {
    const e = MAGIC.effects[i];
    e.t += dt;
    let done = false;
    switch (e.kind) {
      case 'beam': {
        // flamethrower: a cone from the staff along your facing
        const o = staffTip(_pp), fx = Math.sin(PL.face), fz = Math.cos(PL.face);
        for (let k = 0; k < 6; k++) emit(1, { pos: o, vel: { x: fx * 14, y: rnd(-1, 1.5), z: fz * 14 }, velSpread: 2.5, col: '#ffb040', col2: '#ff3a10', life: 0.6, size: 0.3, size2: 1.4, drag: 1.2, bright: 1.8 });
        requestLight(o.clone().add(_ad.set(fx * 4, 0, fz * 4)), '#ff8a30', 14, 12);
        e.tick -= dt;
        if (e.tick <= 0) {
          e.tick = 0.1;
          for (const en of ENT.enemies) {
            if (en.dead || en.inactive) continue;
            const dx = en.pos.x - o.x, dz = en.pos.z - o.z, d = Math.hypot(dx, dz);
            if (d > e.range + en.r) continue;
            if ((dx * fx + dz * fz) / Math.max(d, 1e-4) < 0.82) continue;
            damageEnemy(en, e.dmg * 0.12, { dir: new THREE.Vector3(fx, 0, fz), burn: e.burn, poise: 3, kind: 'magic', school: 'fire' });
          }
          burnNear(o.clone().add(new THREE.Vector3(fx * e.range * 0.6, 0, fz * e.range * 0.6)), e.range * 0.5);
        }
        if (PL.state === 'hit' || PL.state === 'collapse') done = true;
        done = done || e.t > e.life;
        break;
      }
      case 'nova': {
        const k = Math.min(1, e.t / e.life), r = e.r * (1 - Math.pow(1 - k, 2));
        if (!e.rang) { e.rang = true; ring(e.pos, { col: SCHOOLS[e.school].col, r1: e.r, life: e.life * 1.2, thick: true });
          emit(60, { pos: e.pos.clone().setY(e.pos.y + 0.5), col: SCHOOLS[e.school].col, col2: '#ffffff', spread: 0.5, velSpread: e.r * 1.4, upBias: 2, life: 0.8, size: 0.5, bright: 1.8 }); }
        if (e.school === 'water' && e.t < 0.05) emit(80, { pos: e.pos.clone().setY(e.pos.y + 9), spread: e.r * 0.7, vel: { x: 0, y: -18, z: 0 }, velSpread: 1, col: '#9fd8ff', life: 0.6, size: 0.12, size2: 0.05, drag: 0.1 });
        requestLight(e.pos.clone().setY(e.pos.y + 1.5), SCHOOLS[e.school].glow, 30 * (1 - k), e.r * 2.5);
        for (const en of ENT.enemies) {
          if (en.dead || en.inactive || e.hits.has(en)) continue;
          const d = Math.hypot(en.pos.x - e.pos.x, en.pos.z - e.pos.z);
          if (d > r + en.r) continue;
          e.hits.add(en);
          const dir = new THREE.Vector3(en.pos.x - e.pos.x, 0, en.pos.z - e.pos.z).normalize();
          damageEnemy(en, e.dmg, { dir, knock: e.knock || 3, slow: e.slow, burn: e.burn, poise: 30, kind: 'magicAoE', school: e.school });
        }
        if (e.school === 'fire') burnNear(e.pos, r);
        done = e.t > e.life;
        break;
      }
      case 'meteor': {
        const k = e.t / e.delay;
        e.circle.material.opacity = 0.35 + 0.5 * k;
        e.circle.rotation.y += dt * 1.5;
        e.rock.position.set(e.pos.x - (1 - k) * 25, e.pos.y + (1 - k) * 60, e.pos.z - (1 - k) * 10);
        e.rock.rotation.x += dt * 4;
        emit(4, { pos: e.rock.position, col: '#ff8a30', col2: '#ffd070', spread: 1, velSpread: 2, life: 0.6, size: 1.1, bright: 2 });
        requestLight(e.rock.position, '#ff7a30', 60, 40);
        if (k >= 1) {
          addEffect({ kind: 'nova', pos: e.pos, t: 0, life: 0.5, r: e.r, dmg: e.dmg, school: 'fire', burn: e.burn, knock: 8, hits: new Set() });
          emit(120, { pos: e.pos.clone().setY(e.pos.y + 1), col: '#ff9a30', col2: '#fff0a0', spread: 1.5, velSpread: 14, upBias: 6, life: 1.3, size: 0.8, bright: 2.2, gravity: 8 });
          emit(40, { pool: 'soft', pos: e.pos, col: '#3a2a22', spread: 2, velSpread: 6, upBias: 4, life: 2.5, size: 2, size2: 6, drag: 0.8 });
          shake(0.8); hitstop(0.08);
          BUS.emit('flash', { col: '#ffb070', a: 0.35 });
          BUS.emit('sfx', { id: 'meteorImpact' });
          scene.remove(e.rock); scene.remove(e.circle);
          done = true;
        }
        break;
      }
      case 'field': {
        e.circle.position.copy(e.pos).setY(e.pos.y + 0.12);
        e.circle.material.opacity = 0.7 * (1 - e.t / e.life);
        e.circle.rotation.y -= dt * 0.5;
        const mud = e.school === 'earth';             // Quagmire: the ground turned to sucking mud, bubbling brown
        if (Math.random() < 0.6) emit(2, { pos: e.pos.clone().add(new THREE.Vector3(rnd(-e.r, e.r), mud ? 0.05 : 0.2, rnd(-e.r, e.r))), col: mud ? '#6e5434' : '#cdefff', vel: { x: 0, y: mud ? 0.3 : 0.6, z: 0 }, velSpread: 0.3, life: mud ? 1.0 : 1.4, size: mud ? 0.26 : 0.18, bright: mud ? 0.6 : 1.6, pool: mud ? 'soft' : undefined });
        e.tick -= dt;
        if (e.tick <= 0) {
          e.tick = 0.4;
          for (const en of ENT.enemies) {
            if (en.dead || en.inactive) continue;
            if (Math.hypot(en.pos.x - e.pos.x, en.pos.z - e.pos.z) > e.r + en.r) continue;
            damageEnemy(en, e.dmg, { slow: e.slow, poise: 4, kind: 'magicAoE', school: e.school || 'water' });
          }
        }
        done = e.t > e.life;
        if (done) scene.remove(e.circle);
        break;
      }
      case 'prison': {
        e.circle.position.copy(e.pos).setY(e.pos.y + 0.12);
        e.circle.material.opacity = 0.8 * (1 - e.t / e.life);
        if (!e.applied) {
          e.applied = true;
          for (const en of ENT.enemies) {
            if (en.dead || en.inactive) continue;
            if (Math.hypot(en.pos.x - e.pos.x, en.pos.z - e.pos.z) > e.r + en.r) continue;
            damageEnemy(en, e.dmg, { root: e.root, poise: 40, kind: 'magicAoE', school: 'earth' });
            spikeRing(en.pos, 1.4 + en.r);
          }
          spikeRing(e.pos, e.r * 0.7);
        }
        done = e.t > e.life;
        if (done) scene.remove(e.circle);
        break;
      }
      case 'hostileAoE': {
        // an enemy area attack: the ring fills, then the blow lands inside it
        const k = clamp(e.t / e.delay, 0, 1);
        e.circle.material.opacity = 0.25 + 0.65 * k;
        if (e.o.tint) e.circle.material.color.copy(e.o.tint).multiplyScalar(1 + k);       // (a lightning mark is blue-white)
        else e.circle.material.color.setRGB(1.2 + k, 0.35, 0.2);
        e.circle.rotation.y += dt * (1 + k * 4);
        if (k >= 1) {
          const b = PL.body;
          const hit = Math.hypot(b.pos.x - e.pos.x, b.pos.z - e.pos.z) < e.r + b.r && b.pos.y - e.pos.y < 2.5;
          const res = hit ? damagePlayer(e.dmg, { dir: new THREE.Vector3(b.pos.x - e.pos.x, 0, b.pos.z - e.pos.z).normalize(), poise: e.o.poise || 50, unblockable: e.o.unblockable }) : null;
          if (e.o.roots) spikeRing(e.pos, e.r * 0.55);
          if (e.o.onLand) e.o.onLand(e.pos, res === 'hit');
          if (!e.o.quiet) {
            emit(50, { pool: 'soft', pos: e.pos, col: e.o.dust || '#6a5a44', spread: e.r * 0.6, velSpread: 4, upBias: 3, life: 1.2, size: 0.8, size2: 2.2, gravity: 6 });
            ring(e.pos, { col: '#ffb070', r1: e.r * 1.1, life: 0.4 });
            shake(0.35);
            BUS.emit('sfx', { id: 'pillar', pos: e.pos });
          }
          scene.remove(e.circle);
          done = true;
        }
        break;
      }
      case 'aura': {
        const p = PL.body.pos;
        e.circle.position.set(p.x, groundAt(p.x, p.z, p.y + 1) + 0.12, p.z);
        e.circle.material.opacity = 0.6 * (1 - e.t / e.life);
        e.circle.rotation.y += dt;
        e.tick -= dt;
        if (e.tick <= 0) { e.tick = 0.5; const h = e.heal / (e.life / 0.5); G.hp = Math.min(G.maxHp, G.hp + h); BUS.emit('healNumber', Math.round(h)); }
        if (Math.random() < 0.5) emit(1, { pos: p.clone().add(new THREE.Vector3(rnd(-e.r, e.r), 0.2, rnd(-e.r, e.r))), col: '#fff0a0', vel: { x: 0, y: 1.5, z: 0 }, velSpread: 0.2, life: 1.2, size: 0.2, bright: 1.6 });
        requestLight(p.clone().setY(p.y + 1), '#fff0a0', 6, 8);
        done = e.t > e.life;
        if (done) scene.remove(e.circle);
        break;
      }
    }
    if (done) MAGIC.effects.splice(i, 1);
  }
}

/* stone spikes (Stone Prison) */
const _spikeGeo = new THREE.ConeGeometry(0.35, 2.2, 5);
_spikeGeo.translate(0, 1.1, 0);
function spikeRing(pos, r) {
  const mat = toonMat({ color: '#8a7355' });
  const n = Math.max(6, Math.round(r * 5));
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + rnd(-0.2, 0.2);
    const m = new THREE.Mesh(_spikeGeo, mat);
    const x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r;
    m.position.set(x, heightAt(x, z) - 2, z);
    m.rotation.set(rnd(-0.3, 0.3), rnd(0, TAU), rnd(-0.3, 0.3));
    m.scale.setScalar(rnd(0.7, 1.3));
    m.castShadow = true;
    scene.add(m);
    MAGIC.platforms.push({ mesh: m, t: 0, life: 3, rise: 2, y0: m.position.y, spike: true });
  }
  emit(30, { pool: 'soft', pos, col: '#7a6a52', spread: r * 0.7, velSpread: 3, upBias: 2, life: 1.2, size: 0.6, size2: 1.6, gravity: 5 });
}

/* ───────────── Earth Pillar: a platform you can stand on ───────────── */
const _pillarGeo = (() => {
  const g = new THREE.CylinderGeometry(1.15, 1.45, 6, 7, 2);
  g.translate(0, -3, 0);            // top at y = 0
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > -0.05) p.setY(i, p.getY(i) + rnd(-0.12, 0.12));
  g.computeVertexNormals();
  return g;
})();
function raisePillar(pos, life) {
  const top = pos.y + 3.2;
  const m = new THREE.Mesh(_pillarGeo, toonMat({ color: '#9a8260' }));
  m.position.set(pos.x, pos.y - 0.4, pos.z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  const col = addCircle(pos.x, pos.z, 1.2, pos.y - 3, pos.y - 0.4, 'pillar');
  const plat = { mesh: m, t: 0, life, rise: 0.35, y0: pos.y - 0.4, top, col, pillar: true };
  MAGIC.platforms.push(plat);
  shake(0.2);
  BUS.emit('sfx', { id: 'pillar', pos });
  emit(40, { pool: 'soft', pos, col: '#8a7458', spread: 1.2, velSpread: 3.5, upBias: 3, life: 1.2, size: 0.8, size2: 2, gravity: 6 });
  // anything standing on it gets thrown
  for (const en of ENT.enemies) {
    if (en.dead || en.inactive) continue;
    if (Math.hypot(en.pos.x - pos.x, en.pos.z - pos.z) < 1.4 + en.r) {
      en.body.vel.y = 12; en.body.grounded = false;
      damageEnemy(en, 18, { poise: 50, kind: 'magic', school: 'earth' });
    }
  }
}
/* ───────────── Ice floe: walkable on water ───────────── */
function makeIceFloe(x, z, level) {
  for (const p of MAGIC.platforms) if (p.floe && Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z) < 1.5) { p.t = 0; return; }
  const g = new THREE.CylinderGeometry(1.8, 1.6, 0.5, 7);
  const m = new THREE.Mesh(g, toonMat({ color: '#cfeefa', emissive: '#244a5a' }));
  m.position.set(x, level - 0.1, z);
  m.rotation.y = rnd(0, TAU);
  m.receiveShadow = true;
  scene.add(m);
  const col = addCircle(x, z, 1.75, level - 1.5, level + 0.15, 'floe');
  MAGIC.platforms.push({ mesh: m, t: 0, life: 16, rise: 0, y0: level - 0.1, col, floe: true });
  emit(24, { pos: new THREE.Vector3(x, level + 0.2, z), col: '#e0f6ff', spread: 1, velSpread: 2, upBias: 1, life: 0.8, size: 0.25, bright: 1.6 });
  BUS.emit('sfx', { id: 'freeze', pos: m.position });
}
function freezeWaterNear(p, r) {
  for (let a = 0; a < TAU; a += TAU / 7) for (const rr of [0, r * 0.55]) {
    const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr, w = waterAt(x, z);
    if (w > NO_WATER) makeIceFloe(x, z, w);
    if (rr === 0) break;
  }
}
function updatePlatforms(dt) {
  for (let i = MAGIC.platforms.length - 1; i >= 0; i--) {
    const p = MAGIC.platforms[i];
    p.t += dt;
    if (p.pillar) {
      const up = smooth(0, p.rise, p.t) * 3.6;
      const down = smooth(p.life - 1.2, p.life, p.t) * 3.6;
      const prevTop = p.col.y1;
      p.mesh.position.y = p.y0 + up - down;
      p.col.y1 = p.mesh.position.y;
      // a rising pillar carries whoever stands on it (otherwise the wall
      // test would shove them off the moment the top passed step height)
      if (p.col.y1 > prevTop) {
        const riders = [PL.body, ...ENT.enemies.filter(e => !e.dead).map(e => e.body)];
        for (const b of riders) {
          if (b.pos.y >= prevTop - 0.35 && b.pos.y < p.col.y1 && insideFootprint(p.col, b.pos.x, b.pos.z, b.r * 0.5)) {
            b.pos.y = p.col.y1; b.vel.y = Math.max(b.vel.y, 0); b.grounded = true;
          }
        }
      }
    } else if (p.spike) {
      const up = smooth(0, 0.15, p.t) * 2, down = smooth(p.life - 0.6, p.life, p.t) * 2.2;
      p.mesh.position.y = p.y0 + up - down;
    } else if (p.floe) {
      const k = smooth(p.life - 3, p.life, p.t);
      p.mesh.position.y = p.y0 - k * 0.6;
      p.mesh.material.opacity = 1 - k; p.mesh.material.transparent = k > 0;
      p.col.y1 = p.y0 + 0.25 - k * 0.8;
    }
    if (p.t >= p.life) {
      scene.remove(p.mesh);
      if (p.col) removeCollider(p.col);
      MAGIC.platforms.splice(i, 1);
    }
  }
}

/* ───────────── brambles: fire clears them ───────────── */
const BRAMBLES = [];
function burnBramble(c) {
  if (c.burnt) return;
  c.burnt = true;
  removeCollider(c);
  const b = BRAMBLES.find(x => x.col === c);
  if (b) {
    b.burning = 1.4;
    emit(80, { pos: new THREE.Vector3(c.x, c.y0 + 1, c.z), col: '#ff9a30', col2: '#ffd070', spread: Math.max(c.hx || c.r, 1), velSpread: 2, upBias: 3, life: 1.2, size: 0.6, bright: 2 });
    BUS.emit('sfx', { id: 'burn', pos: b.mesh.position });
    BUS.emit('toast', { text: 'The brambles burn away', cls: 'good' });
  }
}
// anything that burns within r of a thicket's EDGE sets it alight
function burnNear(pos, r) {
  for (const b of BRAMBLES) if (!b.col.burnt && Math.hypot(b.col.x - pos.x, b.col.z - pos.z) < r + (b.col.r || 2)) burnBramble(b.col);
}
function updateBrambles(dt) {
  for (let i = BRAMBLES.length - 1; i >= 0; i--) {
    const b = BRAMBLES[i];
    if (b.burning === undefined) continue;
    b.burning -= dt;
    b.mesh.scale.y = Math.max(0.01, b.burning / 1.4);
    if (Math.random() < 0.8) emit(2, { pos: b.mesh.position.clone().add(new THREE.Vector3(rnd(-1, 1), 0.5, rnd(-1, 1))), col: '#ff8030', vel: { x: 0, y: 2, z: 0 }, velSpread: 0.6, life: 0.7, size: 0.4, bright: 2 });
    if (b.burning <= 0) { scene.remove(b.mesh); BRAMBLES.splice(i, 1); }
  }
}

/* ═══ THE VESSEL ═══ */
function breakVessel() {
  if (PL.state === 'collapse' || PL.state === 'dead') return;
  G.mana = 0;
  G.breaks++;
  const gain = Math.max(6, Math.round(G.maxMana * 0.08));
  G.maxMana += gain;
  startCollapse();
  // the break throws everything back — the gamble that buys you room
  const p = PL.body.pos;
  for (const e of ENT.enemies) {
    if (e.dead || e.inactive) continue;
    const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
    if (d > 7.5) continue;
    const dir = new THREE.Vector3(e.pos.x - p.x, 0, e.pos.z - p.z).normalize();
    damageEnemy(e, 18 + G.maxMana * 0.3, { dir, knock: 14 * (1 - d / 9), poise: 999, kind: 'magicAoE' });
  }
  ring(p, { col: '#8fd0ff', r0: 0.5, r1: 9, life: 0.7, thick: true });
  ring(p, { col: '#f0cf62', r0: 0.3, r1: 6, life: 1.0 });
  emit(160, { pos: p.clone().setY(p.y + 1), col: '#8fd0ff', col2: '#ffffff', spread: 0.3, velSpread: 11, upBias: 2, life: 1.2, size: 0.35, bright: 2.2, drag: 2 });
  shake(0.9); hitstop(0.12);
  GAME.slowmo = 0.45;                          // a beat of slow motion
  BUS.emit('flash', { col: '#8fd0ff', a: 0.45 });
  BUS.emit('vesselBreak', { gain, first: G.breaks === 1 });
  BUS.emit('sfx', { id: 'break' });
}
function endCollapse() {
  G.mana = G.maxMana * 0.25;
  BUS.emit('sfx', { id: 'reform' });
  BUS.emit('toast', { text: 'You rise. The vessel is larger.' });
  emit(50, { pos: PL.body.pos.clone().setY(PL.body.pos.y + 0.6), col: '#f0cf62', col2: '#ffffff', spread: 0.6, vel: { x: 0, y: 3, z: 0 }, velSpread: 1.5, life: 1.4, size: 0.25, bright: 2 });
}

/* chant visuals: rune circle under you, and at the aim point for area spells */
function updateChantVisuals(dt) {
  if (!MAGIC.chantCircle) { MAGIC.chantCircle = runeCircle('#ffffff'); MAGIC.aimCircle = runeCircle('#ffffff'); }
  const c = MAGIC.chantCircle, a = MAGIC.aimCircle;
  const sp = PL.chanting;
  if (sp) {
    const k = Math.min(1, PL.chantT / CHANT.need);
    const col = SCHOOLS[sp.school].col;
    c.material.color.set(col).multiplyScalar(k >= 1 ? 1.8 : 0.9);
    c.material.opacity = 0.35 + 0.55 * k;
    c.position.copy(PL.body.pos).setY(PL.body.groundY + 0.06);
    c.scale.setScalar(1.6 + k * 1.4);
    c.rotation.y += dt * (1 + k * 2);
    requestLight(PL.body.pos.clone().setY(PL.body.pos.y + 1), SCHOOLS[sp.school].glow, 3 + k * 6, 6);
    if (Math.random() < 0.5) emit(1, { pos: PL.body.pos.clone().add(new THREE.Vector3(rnd(-1.5, 1.5), 0.1, rnd(-1.5, 1.5))), col, vel: { x: 0, y: 1.8, z: 0 }, velSpread: 0.3, life: 0.9, size: 0.14, bright: 1.8 });
    const area = ['nova', 'meteor', 'field', 'prison'].includes(sp.kind) ? sp.area : sp.kind === 'wall' ? 1.4 : 0;
    if (area) {
      const t = groundPoint(aimPoint(_pp, sp.range || 30));
      a.position.copy(t).setY(t.y + 0.08);
      a.scale.setScalar(area * 2);
      a.material.color.set(col); a.material.opacity = 0.25 + 0.35 * k;
      a.rotation.y -= dt;
    } else a.material.opacity = 0;
  } else {
    c.material.opacity = damp(c.material.opacity, 0, 10, dt);
    a.material.opacity = 0;
  }
}

function updateMagic(dt) {
  updateProjectiles(dt);
  updateEffects(dt);
  updatePlatforms(dt);
  updateBrambles(dt);
  updateChantVisuals(dt);
}
