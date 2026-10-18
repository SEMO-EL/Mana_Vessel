/* ═══════════════════════════════════════════════════════════════════════
   DEER — herds in the meadows by day. They graze, drift, lift their heads
   when you come near, and bolt in long bounds if you come nearer (sooner
   if you're running, sooner still on horseback). A stag leads each herd.

   The rig is the horse's, lighter and longer in the leg, with each rigid
   part merged into one vertex-coloured mesh (a dozen draws a deer).
   ═══════════════════════════════════════════════════════════════════════ */
const DEER = { herds: [] };
const DEER_SPOTS = [
  { x: -170, z: 560, n: 4 },     // the fields south of the Tutor's Hill
  { x: 60, z: 290, n: 3 },       // the slope between the ridge and the forest
  { x: 1455, z: 75, n: 5 },      // the north meadows, round the Colossus
  { x: 1720, z: 690, n: 4 },     // past the market gardens
  { x: 1975, z: 610, n: 4 },     // the downs by the Sunstones
];
const _drM = new THREE.Matrix4(), _drQ = new THREE.Quaternion(), _drE = new THREE.Euler(), _drV = new THREE.Vector3(), _drS = new THREE.Vector3();
// pieces: [geometry, '#colour', x, y, z, sx, sy, sz, rx, ry, rz] → one mesh, vertex-coloured
function mergedPart(pieces, mat) {
  const geos = pieces.map(([g, col, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0]) => {
    const q = (g.index ? g.toNonIndexed() : g.clone());
    q.applyMatrix4(_drM.compose(_drV.set(x, y, z), _drQ.setFromEuler(_drE.set(rx, ry, rz)), _drS.set(sx, sy, sz)));
    if (q.attributes.uv) q.deleteAttribute('uv');
    return paintFlat(q, col);
  });
  const m = new THREE.Mesh(mergeGeometries(geos), mat);
  m.castShadow = true;
  return m;
}
function buildDeerRig(stag) {
  const mat = DEER.mat || (DEER.mat = toonMat({ vertexColors: true, rim: true }));
  const ball = new THREE.IcosahedronGeometry(1, 1), cone = new THREE.ConeGeometry(1, 1, 5), cyl = new THREE.CylinderGeometry(1, 1, 1, 5);
  const coat = stag ? '#8e5f34' : '#a0703f', belly = '#e8d8b8', leg = '#6e4a2a', dark = '#1e1612';
  const root = new THREE.Group(), body = new THREE.Group(); body.position.y = 0.98; root.add(body);
  body.add(mergedPart([[ball, coat, 0, 0, 0, 0.25, 0.28, 0.62], [ball, coat, 0, 0.04, 0.42, 0.24, 0.3, 0.28], [ball, coat, 0, 0.06, -0.42, 0.25, 0.27, 0.28],
    [ball, belly, 0, -0.12, 0.02, 0.2, 0.15, 0.5], [ball, belly, 0, 0.02, -0.66, 0.12, 0.16, 0.08]], mat));
  const neck = new THREE.Group(); neck.position.set(0, 0.16, 0.56); neck.rotation.x = -0.95; body.add(neck);
  neck.add(mergedPart([[ball, coat, 0, 0.06, 0.24, 0.11, 0.13, 0.36], [ball, belly, 0, -0.04, 0.2, 0.07, 0.07, 0.26]], mat));
  const head = new THREE.Group(); head.position.set(0, 0.12, 0.52); head.rotation.x = 1.25; neck.add(head);
  const hp = [[ball, coat, 0, 0, 0.04, 0.1, 0.11, 0.2], [ball, '#5a3a22', 0, -0.02, 0.22, 0.065, 0.07, 0.1], [ball, dark, 0, -0.01, 0.31, 0.03, 0.025, 0.02],
    [ball, dark, 0.085, 0.04, 0.06, 0.022, 0.026, 0.02], [ball, dark, -0.085, 0.04, 0.06, 0.022, 0.026, 0.02],
    [cone, coat, 0.1, 0.13, -0.06, 0.045, 0.16, 0.025, 0, 0, -0.9], [cone, coat, -0.1, 0.13, -0.06, 0.045, 0.16, 0.025, 0, 0, 0.9]];
  if (stag) for (const s of [-1, 1]) {
    // antlers: a beam back and up, two tines forward
    hp.push([cyl, '#d8c8a8', s * 0.06, 0.24, -0.06, 0.016, 0.34, 0.016, -0.35, 0, -s * 0.35]);
    hp.push([cyl, '#d8c8a8', s * 0.12, 0.33, -0.02, 0.012, 0.16, 0.012, 0.6, 0, -s * 0.25]);
    hp.push([cyl, '#d8c8a8', s * 0.1, 0.4, -0.13, 0.012, 0.14, 0.012, 0.25, 0, -s * 0.55]);
  }
  head.add(mergedPart(hp, mat));
  const tail = [new THREE.Group()]; tail[0].position.set(0, 0.16, -0.66); tail[0].rotation.x = -0.6; body.add(tail[0]);
  tail[0].add(mergedPart([[ball, belly, 0, 0, -0.06, 0.05, 0.05, 0.09]], mat));
  const legs = [];
  for (const [x, z, front] of [[-0.13, 0.42, 1], [0.13, 0.42, 1], [-0.14, -0.44, 0], [0.14, -0.44, 0]]) {
    const hip = new THREE.Group(); hip.position.set(x, -0.1, z); body.add(hip);
    hip.add(mergedPart([[ball, coat, 0, -0.17, front ? 0.02 : -0.03, 0.065, 0.24, front ? 0.07 : 0.1]], mat));
    const knee = new THREE.Group(); knee.position.set(0, -0.42, 0); hip.add(knee);
    knee.add(mergedPart([[ball, leg, 0, -0.2, 0, 0.033, 0.23, 0.035], [ball, dark, 0, -0.43, 0.01, 0.04, 0.03, 0.05]], mat));
    legs.push({ hip, knee, front, side: Math.sign(x) });
  }
  return { root, body, neck, head, tail, legs, phase: Math.random() * 10, graze: 0, grazeT: rnd(1, 6), baseY: 0.98 };
}
// shared gait animation (the horse's tables, a lighter body, a bounding gallop)
function animateDeer(R, sp, dt, alert) {
  const g = sp < 0.25 ? null : sp < 3 ? HORSE_GAITS.walk : sp < 7 ? HORSE_GAITS.trot : HORSE_GAITS.gallop;
  const freq = !g ? 0 : g === HORSE_GAITS.walk ? sp * 0.75 : g === HORSE_GAITS.trot ? 2 + sp * 0.1 : 2.3 + sp * 0.05;
  R.phase += dt * freq;
  const ph = R.phase * TAU;
  R.legs.forEach((L, i) => {
    if (!g) { L.hip.rotation.x = damp(L.hip.rotation.x, 0, 8, dt); L.knee.rotation.x = damp(L.knee.rotation.x, 0, 8, dt); return; }
    const a = ph + g.off[i] * TAU, s = Math.sin(a), lift = Math.max(0, Math.cos(a));
    L.hip.rotation.x = s * g.amp * 0.6;
    L.knee.rotation.x = (L.front ? 1 : -1) * lift * g.amp * 1.2;
  });
  const bound = g === HORSE_GAITS.gallop;
  R.body.position.y = R.baseY + (g ? Math.abs(Math.sin(ph)) * (bound ? 0.18 : g.bob) : 0);
  R.body.rotation.x = bound ? Math.sin(ph) * 0.12 : 0;
  if (!g && !alert) { R.grazeT -= dt; if (R.grazeT < 0) { R.graze = R.graze > 0.5 ? 0 : 1; R.grazeT = R.graze ? rnd(3, 8) : rnd(2, 5); } } else R.graze = 0;
  R.neck.rotation.x = damp(R.neck.rotation.x, -0.95 + R.graze * 1.35 + (bound ? 0.3 : 0) - (alert && !g ? 0.25 : 0), 5, dt);
  R.head.rotation.x = damp(R.head.rotation.x, 1.25 + R.graze * 0.2, 5, dt);
  R.tail[0].rotation.x = damp(R.tail[0].rotation.x, alert || bound ? 0.5 : -0.6, 8, dt);   // the white flag goes up
}

function spawnHerd(H) {
  H.deer = [];
  for (let i = 0; i < H.n; i++) {
    const a = Math.random() * TAU, r = Math.random() * 9, x = H.x + Math.cos(a) * r, z = H.z + Math.sin(a) * r;
    const rig = buildDeerRig(i === 0);
    const d = { rig, body: { pos: new THREE.Vector3(x, floorAt(x, z), z), vel: new THREE.Vector3(), r: 0.4, h: 1.3, grounded: true, groundY: 0 },
      heading: Math.random() * TAU, speed: 0, mode: 'graze', t: rnd(2, 8), to: null, alert: 0, shadow: true };
    rig.root.position.copy(d.body.pos); scene.add(rig.root);
    H.deer.push(d);
  }
  H.cx = H.x; H.cz = H.z;
}
function despawnHerd(H) {
  for (const d of H.deer || []) { scene.remove(d.rig.root); d.rig.root.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
  H.deer = null;
}
function updateDeer(dt) {
  if (!G || GAME.inCave) return;
  const p = PL.body.pos, h = TOD.hour, day = h > 5.8 && h < 20.5;
  const riding = PL.state === 'ride', loud = riding ? 34 : PL.sprinting ? 24 : 15;
  for (const H of DEER.herds) {
    const dh = Math.hypot(p.x - H.cx, p.z - H.cz);
    if (!H.deer && day && dh < 170 && dh > 60) spawnHerd(H);
    if (H.deer && (dh > 240 || (!day && dh > 50))) { despawnHerd(H); continue; }
    if (!H.deer) continue;
    let sx = 0, sz = 0;
    for (const d of H.deer) {
      const b = d.body, dx = b.pos.x - p.x, dz = b.pos.z - p.z, dist = Math.hypot(dx, dz);
      d.t -= dt;
      // you: noticed at a distance, fled from up close
      d.alert = damp(d.alert, dist < loud * 1.6 ? 1 : 0, 2, dt);
      if (dist < loud && d.mode !== 'flee') { d.mode = 'flee'; d.t = rnd(5, 8); d.flee = Math.atan2(dx, dz) + rnd(-0.4, 0.4); }
      if (d.mode === 'flee') {
        d.heading = dampAngle(d.heading, d.flee + Math.sin(GAME.time * 0.7 + d.rig.phase) * 0.25, 4, dt);
        d.speed = damp(d.speed, 11, 3, dt);
        if (d.t < 0 && dist > loud * 2) { d.mode = 'graze'; d.t = rnd(2, 6); }
      } else if (d.mode === 'walk') {
        const tx = d.to[0] - b.pos.x, tz = d.to[1] - b.pos.z, td = Math.hypot(tx, tz);
        d.heading = dampAngle(d.heading, Math.atan2(tx, tz), 3, dt);
        d.speed = damp(d.speed, td > 1 ? 1.2 : 0, 3, dt);
        if (td < 1 || d.t < 0) { d.mode = 'graze'; d.t = rnd(4, 10); }
      } else {
        d.speed = damp(d.speed, 0, 4, dt);
        if (d.t < 0) { d.mode = 'walk'; d.t = 8; const a = Math.random() * TAU, r = Math.random() * 10; d.to = [H.cx + Math.cos(a) * r, H.cz + Math.sin(a) * r]; }
      }
      b.vel.x = Math.sin(d.heading) * d.speed; b.vel.z = Math.cos(d.heading) * d.speed;
      moveBody(b, dt);
      if (b.hitDeepWater) { b.hitDeepWater = false; d.flee += Math.PI * 0.6; }
      d.rig.root.position.copy(b.pos); d.rig.root.rotation.y = d.heading;
      const sh = b.pos.distanceToSquared(camera.position) < 45 * 45;
      if (sh !== d.shadow) { d.shadow = sh; d.rig.root.traverse(o => { if (o.isMesh) o.castShadow = sh; }); }
      animateDeer(d.rig, d.speed, dt, d.alert > 0.5);
      sx += b.pos.x; sz += b.pos.z;
    }
    // the herd's centre follows the herd (they settle wherever they stop running)
    H.cx = sx / H.deer.length; H.cz = sz / H.deer.length;
  }
}
function initDeer() { DEER.herds = DEER_SPOTS.map(s => ({ ...s, deer: null, cx: s.x, cz: s.z })); }
