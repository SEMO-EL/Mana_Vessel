/* ═══════════════════════════════════════════════════════════════════════
   THE WEEPING CAVE — an enclosed dungeon built from two heightfields.

   FLOOR rises steeply (70°+) outside the open shapes, so the walls are just
   terrain too steep to climb — the existing slope rule keeps you inside.
   CEILING hangs over it, low outside the shapes, so the two meshes meet and
   close the space. Chambers are circles, tunnels are capsules; the signed
   distance to their union decides open / wall everywhere.

   The cave sits 300 m below the world (under the northern cliffs), and while
   you're inside, the outdoor world is hidden and physics reads CAVE floors.
   ═══════════════════════════════════════════════════════════════════════ */
const CAVE = {
  ox: -60, oz: -560, base: -300,          // world position of local (0,0) and floor level
  x0: -80, x1: 80, z0: -140, z1: 20, cell: 1,
  F: null, C: null, N: 0, M: 0,           // floor / ceiling grids
  group: new THREE.Group(), lights: [],
  shapes: [
    // chambers: { c:[x,z], r, lv (floor level), ch (ceiling clearance) }
    { id: 'entrance', c: [0, -8],    r: 9,  lv: 0,  ch: 7 },
    { id: 'grotto',   c: [-42, -30], r: 16, lv: -2, ch: 13 },
    { id: 'hall',     c: [38, -40],  r: 14, lv: -1, ch: 10 },
    { id: 'ossuary',  c: [0, -74],   r: 12, lv: -4, ch: 8 },
    { id: 'barrow',   c: [0, -116],  r: 23, lv: -7, ch: 17 },
    // tunnels: { a, b, r }
    { a: [0, 14], b: [0, -8], r: 3.6 },
    { a: [0, -8], b: [-42, -30], r: 3.8 },
    { a: [0, -8], b: [38, -40], r: 3.8 },
    { a: [-42, -30], b: [0, -74], r: 3.5 },
    { a: [38, -40], b: [0, -74], r: 3.5 },
    { a: [0, -74], b: [0, -116], r: 4.4 },
  ],
};
CAVE.group.visible = false;
scene.add(CAVE.group);

// signed distance to the open space (negative inside) + the floor level there
function caveSDF(lx, lz) {
  let best = 1e9, lv = 0, ch = 4;
  for (const s of CAVE.shapes) {
    let d, l, c;
    if (s.c) {
      d = Math.hypot(lx - s.c[0], lz - s.c[1]) - s.r; l = s.lv;
      c = s.ch * Math.sqrt(Math.max(0, 1 - Math.pow(Math.hypot(lx - s.c[0], lz - s.c[1]) / (s.r + 3), 2)));
    } else {
      const [ax, az] = s.a, [bx, bz] = s.b, dx = bx - ax, dz = bz - az;
      const t = clamp(((lx - ax) * dx + (lz - az) * dz) / (dx * dx + dz * dz), 0, 1);
      d = Math.hypot(lx - (ax + dx * t), lz - (az + dz * t)) - s.r;
      const la = caveLevelAtPoint(ax, az), lb = caveLevelAtPoint(bx, bz);
      l = lerp(la, lb, t); c = 4.6;
    }
    if (d < best) { best = d; lv = l; ch = c; }
  }
  return [best, lv, ch];
}
function caveLevelAtPoint(x, z) {
  for (const s of CAVE.shapes) if (s.c && Math.hypot(x - s.c[0], z - s.c[1]) < s.r) return s.lv;
  return 0;
}

function buildCave() {
  const C = CAVE, n = Noise.make(WORLD.seed + 300), n2 = Noise.make(WORLD.seed + 301);
  const N = C.N = Math.round((C.x1 - C.x0) / C.cell) + 1, M = C.M = Math.round((C.z1 - C.z0) / C.cell) + 1;
  C.F = new Float32Array(N * M); C.Cc = new Float32Array(N * M); C.SD = new Float32Array(N * M);
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    const lx = C.x0 + i * C.cell, lz = C.z0 + j * C.cell;
    const [sd, lv, ch] = caveSDF(lx, lz);
    const k = j * N + i;
    const wall = smooth(-0.6, 2.8, sd);
    const bump = n(lx / 7, lz / 7) * 0.45 + n2(lx / 2.2, lz / 2.2) * 0.12;
    C.F[k] = C.base + lv + bump * (1 - wall) + wall * (16 + n(lx / 4, lz / 4) * 3);
    // ceiling: a dome over each chamber, stalactites hanging from it
    const stal = Math.max(0, n2(lx / 1.6, lz / 1.6) - 0.35) * 5;
    C.Cc[k] = C.base + lv + Math.max(3.2, ch + 2.5) - stal * (1 - wall) - wall * (ch * 0.7);
    C.SD[k] = sd;
  }
  const floorGeo = caveGrid(C.F, false), ceilGeo = caveGrid(C.Cc, true);
  const floor = new THREE.Mesh(floorGeo, TER.material);
  floor.receiveShadow = true;
  const ceil = new THREE.Mesh(ceilGeo, TER.material);
  C.group.add(floor, ceil);

  // crystals: the grotto glows; a few elsewhere mark the way
  const R = mulberry32(777);
  const crystalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#6fc8ff').multiplyScalar(2.2) });
  const crystalDim = toonMat({ color: '#2a5a7a', emissive: '#12324a' });
  const spots = [];
  for (let i = 0; i < 40; i++) {
    const g = CAVE.shapes[1];
    const a = R() * TAU, r = g.r * (0.75 + R() * 0.3);
    spots.push([g.c[0] + Math.cos(a) * r, g.c[1] + Math.sin(a) * r, 1]);
  }
  for (const s of CAVE.shapes.filter(s => s.c && s.id !== 'grotto')) for (let i = 0; i < 5; i++) {
    const a = R() * TAU; spots.push([s.c[0] + Math.cos(a) * (s.r - 0.5), s.c[1] + Math.sin(a) * (s.r - 0.5), 0.6]);
  }
  for (const [lx, lz, big] of spots) {
    const cl = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.2 + R() * 0.25, 1 + R() * 1.8 * big, 5), k === 0 ? crystalMat : crystalDim);
      m.position.set((R() - 0.5) * 0.8, 0.5, (R() - 0.5) * 0.8);
      m.rotation.set((R() - 0.5) * 0.9, R() * TAU, (R() - 0.5) * 0.9);
      cl.add(m);
    }
    const w = caveWorld(lx, lz);
    cl.position.set(w.x, caveFloorAt(w.x, w.z) - 0.1, w.z);
    C.group.add(cl);
    C.lights.push({ pos: cl.position.clone().setY(cl.position.y + 1), col: '#6fc8ff', i: 2.2 * big, d: 9 });
  }
  // torches at the entrance and the ossuary; a gold light where the Warden sleeps
  for (const [lx, lz] of [[-5, -2], [5, -2], [-9, -74], [9, -74], [-14, -104], [14, -104]]) {
    const w = caveWorld(lx, lz), y = caveFloorAt(w.x, w.z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2, 5), toonMat({ color: '#3a2a1c' }));
    post.position.set(w.x, y + 1, w.z); C.group.add(post);
    CAVE_FIRES.push({ pos: new THREE.Vector3(w.x, y + 2.1, w.z) });
  }
  // bones scattered through the ossuary and barrow
  const boneMat = toonMat({ color: '#d8ceb4' });
  for (let i = 0; i < 60; i++) {
    const s = R() < 0.5 ? CAVE.shapes[3] : CAVE.shapes[4];
    const a = R() * TAU, r = R() * s.r * 0.9, w = caveWorld(s.c[0] + Math.cos(a) * r, s.c[1] + Math.sin(a) * r);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5 + R() * 0.4, 4), boneMat);
    b.position.set(w.x, caveFloorAt(w.x, w.z) + 0.05, w.z); b.rotation.set(Math.PI / 2, 0, R() * TAU);
    C.group.add(b);
  }
  // the fog wall before the Barrow (Souls: you choose to walk through)
  const fw = caveWorld(0, -93), fy = caveFloorAt(fw.x, fw.z);
  const fog = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9,78.2))) * 43758.5); }
      float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){ float v = n(vUv*vec2(6.0,4.0) + vec2(0.0, uTime*0.4)) * 0.6 + n(vUv*vec2(13.0,9.0) - vec2(uTime*0.3, 0.0)) * 0.4;
        float e = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x) * smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        gl_FragColor = vec4(vec3(1.0, 0.82, 0.45) * v * e * 0.9, 1.0); }`,
  }));
  fog.position.set(fw.x, fy + 3, fw.z);
  C.group.add(fog);
  C.fogWall = fog;
  C.fogCol = addBox(fw.x, fw.z, 4.5, 0.4, 0, fy - 1, fy + 8, 'fogwall');
  C.fogCol.noGround = true;
  INTERACTABLES.push({ pos: new THREE.Vector3(fw.x, fy, fw.z + 1.5), r: 3.5, label: () => 'Pass through the golden mist',
    enabled: () => GAME.inCave && !CAVE.fogPassed, action: () => passFogWall() });
  // the way out
  const ex = caveWorld(0, 12);
  INTERACTABLES.push({ pos: new THREE.Vector3(ex.x, caveFloorAt(ex.x, ex.z), ex.z), r: 4, label: () => 'Leave the cave', enabled: () => GAME.inCave, action: () => exitCave() });
}
const CAVE_FIRES = [];

function caveWorld(lx, lz) { return { x: CAVE.ox + lx, z: CAVE.oz + lz }; }
function caveGridSample(F, x, z) {
  const C = CAVE;
  const fx = clamp((x - C.ox - C.x0) / C.cell, 0, C.N - 1.001), fz = clamp((z - C.oz - C.z0) / C.cell, 0, C.M - 1.001);
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * C.N + ix;
  return (F[i] * (1 - tx) + F[i + 1] * tx) * (1 - tz) + (F[i + C.N] * (1 - tx) + F[i + C.N + 1] * tx) * tz;
}
const caveFloorAt = (x, z) => CAVE.F ? caveGridSample(CAVE.F, x, z) : CAVE.base;
const caveCeilAt = (x, z) => CAVE.Cc ? caveGridSample(CAVE.Cc, x, z) : CAVE.base + 20;

function caveGrid(H, down) {
  const C = CAVE, N = C.N, M = C.M;
  const pos = new Float32Array(N * M * 3), col = new Float32Array(N * M * 3);
  const rock = new THREE.Color('#57504a'), wet = new THREE.Color('#3d3f45'), moss = new THREE.Color('#3f4a36'), ceilC = new THREE.Color('#34303a');
  const cc = new THREE.Color(), n = Noise.make(WORLD.seed + 310);
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, lx = C.x0 + i * C.cell, lz = C.z0 + j * C.cell;
    pos[k * 3] = C.ox + lx; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = C.oz + lz;
    if (down) cc.copy(ceilC).multiplyScalar(0.8 + 0.3 * n(lx / 5, lz / 5));
    else cc.copy(rock).lerp(wet, smooth(-0.4, 0.6, n(lx / 9, lz / 9))).lerp(moss, smooth(0.3, 0.9, n(lx / 4 + 7, lz / 4)) * (1 - smooth(-1, 1, C.SD[k])) * 0.6);
    col[k * 3] = cc.r; col[k * 3 + 1] = cc.g; col[k * 3 + 2] = cc.b;
  }
  const idx = [];
  for (let j = 0; j < M - 1; j++) for (let i = 0; i < N - 1; i++) {
    const a = j * N + i, b = a + 1, d = a + N, f = d + 1;
    if (down) idx.push(a, f, d, a, b, f); else idx.push(a, d, f, a, f, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/* ───────────── entering and leaving ───────────── */
const OUTDOOR_SAVED = {};
function setOutdoorVisible(on) {
  TER.group.visible = on; skyDome.visible = on; STRUCT.group.visible = on;
  if (FOL.grass) FOL.grass.visible = on;
  for (const m of WATER.meshes) m.visible = on;
  for (const c of FOL.cells) for (const p of c.parts) { p.hi.visible = on && p.hi.visible; p.lo.visible = on && p.lo.visible; }
  FOL.hidden = !on;
  for (const im of FOL.rockMeshes || []) im.visible = on;
  CAVE.group.visible = !on;
}
async function enterCave() {
  await fadeOut(0.6);
  GAME.inCave = true;
  setOutdoorVisible(false);
  if (VFX.rain) VFX.rain.visible = false;
  CAM.lockTarget = null;
  const s = caveWorld(0, 9);
  PL.body.pos.set(s.x, caveFloorAt(s.x, s.z), s.z);
  PL.body.vel.set(0, 0, 0);
  PL.face = Math.PI; CAM.yaw = 0; CAM.pitch = -0.12;
  CAM.pivot.copy(PL.body.pos).setY(PL.body.pos.y + 1.55);
  for (const e of [...ENT.enemies]) if (!e.encounter || !e.encounter.opts.cave) e.remove();
  G.flags.enteredCave = true;
  BUS.emit('enterCave');
  BUS.emit('place', { name: 'The Weeping Cave', sub: 'Below the northern cliffs' });
  await fadeIn(0.8);
}
async function exitCave() {
  await fadeOut(0.6);
  GAME.inCave = false;
  setOutdoorVisible(true);
  if (VFX.rain) VFX.rain.visible = true;
  CAM.lockTarget = null;
  for (const e of [...ENT.enemies]) if (e.encounter && e.encounter.opts.cave) e.remove();
  for (const enc of ENCOUNTERS) if (enc.opts.cave) { enc.active = false; enc.live = []; }
  const m = STRUCT.caveMouth;
  PL.body.pos.set(m.x, heightAt(m.x, m.z + 7), m.z + 7);
  PL.body.vel.set(0, 0, 0);
  PL.face = 0; CAM.yaw = Math.PI; CAM.pitch = -0.15;
  CAM.pivot.copy(PL.body.pos).setY(PL.body.pos.y + 1.55);
  BUS.emit('exitCave');
  await fadeIn(0.8);
}
function passFogWall() {
  CAVE.fogPassed = true;
  removeCollider(CAVE.fogCol);
  const fw = caveWorld(0, -97);
  PL.body.pos.set(fw.x, caveFloorAt(fw.x, fw.z), fw.z);
  BUS.emit('sfx', { id: 'waystone' });
  BUS.emit('fogWall');
}

function updateCave(dt) {
  if (!GAME.inCave) return;
  for (const l of CAVE.lights) if (l.pos.distanceToSquared(camera.position) < 55 * 55) requestLight(l.pos, l.col, l.i, l.d);
  for (const f of CAVE_FIRES) {
    if (f.pos.distanceToSquared(camera.position) > 70 * 70) continue;
    if (Math.random() < 0.7) emit(1, { pos: f.pos, spread: 0.1, vel: { x: 0, y: 1.4, z: 0 }, velSpread: 0.25, col: '#ff7a20', col2: '#ffd070', life: 0.6, size: 0.3, bright: 2.2 });
    requestLight(f.pos, '#ff8a3a', 5 + Math.sin(GAME.time * 11 + f.pos.x) * 0.8, 11);
  }
  // your staff is the lantern down here
  if (PL.actor) requestLight(PL.actor.bonePos('handslotr', _cvL).setY(_cvL.y + 0.6), '#ffd9a8', 7, 13);
  if (CAVE.fogWall) { CAVE.fogWall.material.uniforms.uTime.value = GAME.time; CAVE.fogWall.visible = !CAVE.fogPassed; }
  // drips
  if (Math.random() < dt * 6) {
    const p = PL.body.pos, x = p.x + rnd(-12, 12), z = p.z + rnd(-12, 12);
    emit(1, { pos: new THREE.Vector3(x, caveCeilAt(x, z) - 0.3, z), vel: { x: 0, y: -1, z: 0 }, velSpread: 0, gravity: 18, drag: 0.1, col: '#9fd8ff', life: 1.2, size: 0.05, size2: 0.05, bright: 1.5 });
  }
}
const _cvL = new THREE.Vector3();

// Cave atmosphere overrides the sky state while inside (called after updateSky).
function caveAtmosphere() {
  if (!GAME.inCave) return;
  WFOG.wfColor.value.set('#07090f');
  WFOG.wfSunColor.value.set('#1a2a3a');
  WFOG.wfParams.value.set(0.035, 0.0, CAVE.base - 50, 0.0);
  SUN.intensity = 0;
  HEMI.color.set('#34405a'); HEMI.groundColor.set('#161218'); HEMI.intensity = 0.55;
  if (gradePass) { gradePass.uniforms.uLift.value.set(0.0, 0.004, 0.01); gradePass.uniforms.uGain.value.set(0.92, 1.0, 1.1); gradePass.uniforms.uSat.value = 0.9; }
  renderer.toneMappingExposure = 1.25;
}

/* ───────────── the fade (shared by transitions) ───────────── */
let _fadeEl = null;
function fadeEl() {
  if (!_fadeEl) { _fadeEl = document.createElement('div'); _fadeEl.id = 'fade'; document.body.appendChild(_fadeEl); }
  return _fadeEl;
}
function fadeOut(t = 0.5) { const e = fadeEl(); e.style.transition = `opacity ${t}s ease`; e.style.opacity = 1; return new Promise(r => setTimeout(r, t * 1000 + 30)); }
function fadeIn(t = 0.5) { const e = fadeEl(); e.style.transition = `opacity ${t}s ease`; e.style.opacity = 0; return new Promise(r => setTimeout(r, t * 1000 + 30)); }
