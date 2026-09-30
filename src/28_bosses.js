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
  xp: 520, weight: 4, flinchAt: 999, undead: true, knockRes: 1, boss: true,
  idle: 'Idle_Combat', walkClip: 'Walking_D_Skeletons', runClip: 'Running_C', deathClip: 'Death_C_Skeletons',
  attacks: [
    { clip: '2H_Melee_Attack_Chop',  speed: 0.8,  hitAt: 0.46, range: [0, 5],   reach: 4.4, arc: 0.55, dmg: 34, poise: 60, lunge: 2, shock: 5 },
    { clip: '2H_Melee_Attack_Slice', speed: 0.85, hitAt: 0.42, range: [0, 5],   reach: 4.8, arc: 1.7,  dmg: 28, poise: 45, lunge: 1.5 },
    { clip: '2H_Melee_Attack_Stab',  speed: 0.9,  hitAt: 0.5,  range: [4, 11],  reach: 4.2, arc: 0.4,  dmg: 32, poise: 55, lunge: 10, unblockable: true },
  ],
  phase2: {
    at: 0.55, speedMul: 1.25,
    attacks: [
      { clip: '2H_Melee_Attack_Spin', speed: 1.0, hitAt: 0.3, range: [0, 5.5], reach: 5.0, arc: 3.14, dmg: 30, poise: 60, lunge: 2, unblockable: true, activeMul: 3 },
    ],
  },
};
ENEMY_DEFS.treant = {
  name: 'The Elder Treant', rig: 'treant', hp: 1100, poise: 150, r: 1.6, h: 6.5, walk: 1.5, run: 2.6, sight: 40, hear: 40,
  xp: 460, weight: 4, flinchAt: 999, knockRes: 1, boss: true, fireWeak: 1.6,
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
      this.arms[0].sh.rotation.x = damp(this.arms[0].sh.rotation.x, lUp, 8, dt);
      this.arms[1].sh.rotation.x = damp(this.arms[1].sh.rotation.x, rUp, 8, dt);
      this.body.rotation.y = damp(this.body.rotation.y, swing, 6, dt);
      this.arms.forEach(A => { A.el.rotation.x = -0.4 + Math.sin(t * 1.3 + A.s) * 0.05; A.sh.rotation.z = A.s * 0.25; });
      this.eyeM.color.setRGB(2.2 + w * 1.5, 2.5 - w * 1.2, 0.8 - w * 0.6);
      if (e.dead) { this.deadT = this.deadT < 0 ? 0 : this.deadT + dt; this.root.rotation.x = smooth(0, 1.6, this.deadT) * 1.45; }
    },
    weaponPos(out) { return this.arms[1].el.getWorldPosition(out); },
  };
}
