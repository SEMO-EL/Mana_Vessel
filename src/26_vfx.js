/* ═══════════════════════════════════════════════════════════════════════
   VFX — particles, rings, rune circles, light pool, rain, pickups.

   Particles are a GPU ring buffer: each particle stores where it was born,
   its velocity, colour, birth time and life. The vertex shader computes
   where it is NOW, so the CPU only writes a particle once, at birth.
   ═══════════════════════════════════════════════════════════════════════ */
const VFX = { pools: {}, rings: [], lights: [], lightReq: [], circles: [], pickups: [] };

function makeParticlePool(N, blending, alphaK = 0.75, nearFade = 0) {
  const g = new THREE.BufferGeometry();
  const mk = (n) => new THREE.BufferAttribute(new Float32Array(N * n), n).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', mk(3));     // birth position
  g.setAttribute('aVel', mk(3));
  g.setAttribute('aCol', mk(3));
  g.setAttribute('aT', mk(4));           // birth, life, size0, size1
  g.setAttribute('aG', mk(2));           // gravity, drag
  // unborn particles: birth far in the future
  const t = g.attributes.aT.array; for (let i = 0; i < N; i++) t[i * 4] = 1e9;
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 500 } },
    vertexShader: /* glsl */`
      attribute vec3 aVel; attribute vec3 aCol; attribute vec4 aT; attribute vec2 aG;
      uniform float uTime, uScale;
      varying vec3 vCol; varying float vA;
      void main(){
        float age = uTime - aT.x;
        float k = age / aT.y;
        if (age < 0.0 || k > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
        // velocity with exponential drag, plus gravity
        float dr = max(aG.y, 1e-3);
        vec3 p = position + aVel * (1.0 - exp(-dr * age)) / dr + vec3(0.0, -0.5 * aG.x * age * age, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = mix(aT.z, aT.w, k) * uScale / max(-mv.z, 0.1);
        vCol = aCol;
        vA = (1.0 - k) * smoothstep(0.0, 0.08, k + 0.02);
        #ifdef NEAR_FADE
        vA *= smoothstep(1.5, NEAR_FADE, -mv.z);       // big soft puffs thin out before they fill the lens
        #endif
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol; varying float vA;
      void main(){
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        float d = dot(q, q);
        if (d > 1.0) discard;
        float a = (1.0 - d) * (1.0 - d) * vA;
        gl_FragColor = vec4(vCol * a, a);
      }`,
    transparent: true, depthWrite: false, blending,
  });
  if (blending === THREE.NormalBlending) {
    m.fragmentShader = m.fragmentShader.replace('gl_FragColor = vec4(vCol * a, a);', `gl_FragColor = vec4(vCol, a * ${alphaK.toFixed(3)});`);
    m.blending = THREE.CustomBlending; m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
  }
  if (nearFade) m.defines = { NEAR_FADE: nearFade.toFixed(1) };
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  scene.add(pts);
  return { pts, g, m, N, head: 0, dirty: [] };
}

const _pc = new THREE.Color();
/* emit n particles. o: { pos, spread, vel, velSpread, col, col2, life, size, size2, gravity, drag, pool } */
function emit(n, o) {
  const P = VFX.pools[o.pool || 'add'];
  if (!P) return;
  const a = P.g.attributes, now = VFX.time;
  const start = P.head;
  for (let i = 0; i < n; i++) {
    const k = P.head; P.head = (P.head + 1) % P.N;
    const sp = o.spread || 0;
    a.position.setXYZ(k, o.pos.x + rnd(-sp, sp), o.pos.y + rnd(-sp, sp) * (o.flat ? 0.2 : 1), o.pos.z + rnd(-sp, sp));
    const vs = o.velSpread ?? 1;
    const v = o.vel || { x: 0, y: 0, z: 0 };
    a.aVel.setXYZ(k, v.x + rnd(-vs, vs), v.y + rnd(-vs, vs) * (o.upBias ? 0.3 : 1) + (o.upBias || 0), v.z + rnd(-vs, vs));
    _pc.set(o.col || '#ffffff');
    if (o.col2) _pc.lerp(_tmpCol.set(o.col2), Math.random());
    a.aCol.setXYZ(k, _pc.r * (o.bright || 1), _pc.g * (o.bright || 1), _pc.b * (o.bright || 1));
    const life = (o.life || 0.6) * rnd(0.7, 1.3);
    a.aT.setXYZ(k, now + (o.delay ? rnd(0, o.delay) : 0), life, o.size ?? 0.3);
    a.aT.setW(k, o.size2 ?? 0.02);
    a.aG.setXY(k, o.gravity ?? 0, o.drag ?? 1.5);
  }
  P.dirty.push([start, n]);
}
const _tmpCol = new THREE.Color();

function flushPools() {
  for (const P of Object.values(VFX.pools)) {
    if (!P.dirty.length) continue;
    const g = P.g;
    for (const name of ['position', 'aVel', 'aCol', 'aT', 'aG']) {
      const at = g.attributes[name];
      at.clearUpdateRanges();
      for (const [s, n] of P.dirty) {
        const isz = at.itemSize;
        if (s + n <= P.N) at.addUpdateRange(s * isz, n * isz);
        else { at.addUpdateRange(s * isz, (P.N - s) * isz); at.addUpdateRange(0, (n - (P.N - s)) * isz); }
      }
      at.needsUpdate = true;
    }
    P.dirty.length = 0;
  }
}

/* ───────────── rings (shockwaves, landings, the vessel break) ───────────── */
const _ringGeo = new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2);
function ring(pos, { col = '#ffffff', r0 = 0.5, r1 = 6, life = 0.5, opacity = 0.9, thick = false } = {}) {
  const m = new THREE.Mesh(thick ? new THREE.RingGeometry(0.7, 1, 64).rotateX(-Math.PI / 2) : _ringGeo,
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.copy(pos); m.position.y += 0.15;
  m.renderOrder = 6;
  scene.add(m);
  VFX.rings.push({ m, t: 0, life, r0, r1, opacity });
}

/* ───────────── rune circles (drawn once per school) ───────────── */
const _runeTex = {};
function runeTexture(col) {
  if (_runeTex[col]) return _runeTex[col];
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  x.translate(256, 256);
  x.strokeStyle = '#ffffff'; x.fillStyle = '#ffffff';
  x.shadowColor = '#ffffff'; x.shadowBlur = 8;
  x.lineWidth = 5; x.beginPath(); x.arc(0, 0, 240, 0, TAU); x.stroke();
  x.lineWidth = 2.5; x.beginPath(); x.arc(0, 0, 222, 0, TAU); x.stroke();
  x.beginPath(); x.arc(0, 0, 150, 0, TAU); x.stroke();
  x.lineWidth = 3;
  // six-pointed star (the Six-Faced World)
  for (let k = 0; k < 2; k++) {
    x.beginPath();
    for (let i = 0; i <= 3; i++) { const a = (i / 3) * TAU + k * Math.PI / 3 - Math.PI / 2; const px = Math.cos(a) * 150, py = Math.sin(a) * 150; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
  }
  // glyphs around the band
  x.font = 'bold 26px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    x.save(); x.rotate(a); x.translate(0, -231); x.fillText(glyphs[i % glyphs.length], 0, 0); x.restore();
  }
  x.beginPath(); x.arc(0, 0, 60, 0, TAU); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (_runeTex[col] = t);
}
function runeCircle(col) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: runeTexture('w'), color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.renderOrder = 6;
  scene.add(m);
  return m;
}

/* ───────────── light pool ─────────────
   A fixed number of point lights (changing the count recompiles every
   shader). Each frame, emitters request light; the brightest nearest win. */
function initLightPool() {
  for (const l of VFX.lights) scene.remove(l);
  VFX.lights = [];
  for (let i = 0; i < 8; i++) {
    const l = new THREE.PointLight('#ffffff', 0, 12, 1.6);
    scene.add(l); VFX.lights.push(l);
  }
}
function requestLight(pos, col, intensity, dist) { VFX.lightReq.push({ pos, col, intensity, dist }); }
function assignLights() {
  const cp = camera.position, max = Q().lights;
  // brightest first, discounted by how far the camera is outside each light's reach
  for (const r of VFX.lightReq) r.score = r.intensity / (1 + r.pos.distanceToSquared(cp) / (r.dist * r.dist));
  VFX.lightReq.sort((a, b) => b.score - a.score);
  for (let i = 0; i < VFX.lights.length; i++) {
    const l = VFX.lights[i], r = i < max ? VFX.lightReq[i] : null;
    if (r) { l.position.copy(r.pos); l.color.set(r.col); l.intensity = r.intensity; l.distance = r.dist; }
    else l.intensity = 0;
  }
  VFX.lightReq.length = 0;
}

/* ───────────── rain (shader-driven, no per-drop CPU) ───────────── */
function buildRain() {
  const N = 5000, pos = new Float32Array(N * 2 * 3), seed = new Float32Array(N * 2 * 3);
  for (let i = 0; i < N; i++) {
    const sx = Math.random(), sy = Math.random(), sz = Math.random();
    for (let e = 0; e < 2; e++) {
      seed.set([sx, sy, sz], (i * 2 + e) * 3);
      pos.set([0, e, 0], (i * 2 + e) * 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uCol: { value: new THREE.Color('#aab8c8') } },
    vertexShader: /* glsl */`
      attribute vec3 aSeed; uniform float uTime, uAmt; uniform vec3 uCam; varying float vA;
      void main(){
        vec3 box = vec3(60.0, 36.0, 60.0);
        vec3 p = aSeed * box + vec3(-uTime * 3.0, -uTime * 24.0, 0.0);
        // wrap into a box centred on the camera; drops stay put in the world as you move
        p = mod(p - uCam, box) + uCam - box * 0.5;
        p += vec3(-0.08, -0.9, 0.0) * position.y;
        vA = step(aSeed.x * 0.999, uAmt) * 0.35;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`uniform vec3 uCol; varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(uCol, vA); }`,
    transparent: true, depthWrite: false,
  });
  const lines = new THREE.LineSegments(g, m);
  lines.frustumCulled = false; lines.renderOrder = 7;
  scene.add(lines);
  VFX.rain = lines;
}

/* ───────────── pickups (mana motes, health) ───────────── */
const _pickGeo = new THREE.OctahedronGeometry(0.16, 0);
function spawnPickup(kind, x, z) {
  const col = kind === 'mana' ? '#6fc4ff' : '#ff5a6a';
  const m = new THREE.Mesh(_pickGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(3) }));
  const y = groundAt(x, z, 999) + 0.7;
  m.position.set(x, y, z);
  scene.add(m);
  VFX.pickups.push({ m, kind, t: 0, x, z, y, col, life: 40 });
}
function updatePickups(dt) {
  const p = PL.body && PL.body.pos;
  for (let i = VFX.pickups.length - 1; i >= 0; i--) {
    const k = VFX.pickups[i];
    k.t += dt; k.life -= dt;
    k.m.rotation.y += dt * 2.5;
    k.m.position.y = k.y + Math.sin(k.t * 3) * 0.12;
    if (p && G) {
      const d = k.m.position.distanceTo(_tv.set(p.x, p.y + 0.9, p.z));
      if (d < 3.5) { k.m.position.lerp(_tv, Math.min(1, dt * (8 - d * 1.5))); k.y = k.m.position.y; }
      if (d < 0.7) {
        if (k.kind === 'mana') { G.mana = Math.min(G.maxMana, G.mana + G.maxMana * 0.15); BUS.emit('pickup', 'mana'); }
        else { G.hp = Math.min(G.maxHp, G.hp + G.maxHp * 0.14); BUS.emit('pickup', 'hp'); }
        emit(12, { pos: k.m.position, col: k.col, spread: 0.2, velSpread: 2, life: 0.5, size: 0.25, bright: 2 });
        k.life = 0;
      }
    }
    if (VFX.time % 0.1 < dt) emit(1, { pos: k.m.position, col: k.col, spread: 0.1, velSpread: 0.3, upBias: 0.6, life: 0.8, size: 0.12, bright: 1.5 });
    requestLight(k.m.position, k.col, 1.2, 4);
    if (k.life <= 0) { scene.remove(k.m); k.m.material.dispose(); VFX.pickups.splice(i, 1); }
  }
}
const _tv = new THREE.Vector3();

function initVFX() {
  VFX.pools.add = makeParticlePool(9000, THREE.AdditiveBlending);
  VFX.pools.soft = makeParticlePool(4000, THREE.NormalBlending);
  VFX.pools.haze = makeParticlePool(2500, THREE.NormalBlending, 0.2, 12);      // dust: big, faint, many
  VFX.time = 0;
  initLightPool();
  buildRain();
}

/* Dust blowing past (runs at the ambient 12 Hz): faint puffs drifting on the
   wind, a few grains low to the ground, and now and then a dust devil out on
   the flats, turning as it wanders. */
const _dv = new THREE.Vector3();
function dustAround(cp) {
  const k = DUST.k, st = DUST.storm, night = SKY_NOW.night;
  const wind = 3 + st * 9, wx = -wind * 0.92, wz = wind * 0.38;          // out of the east-north-east
  const col = night > 0.5 ? '#4a4038' : '#cdb38a';
  const puffs = Math.round(k * (1.5 + st * 6));
  for (let i = 0; i < puffs; i++) {
    const a = Math.random() * TAU, d = rnd(10, 42), x = cp.x + Math.cos(a) * d - wx * 1.2, z = cp.z + Math.sin(a) * d - wz * 1.2;
    _dv.set(x, heightAt(x, z) + rnd(0.3, 3.5 + st * 4), z);
    emit(1, { pool: 'haze', pos: _dv, vel: { x: wx, y: 0.2, z: wz }, velSpread: 0.8, drag: 0.05, col, life: 4.5, size: 3 + st * 3, size2: 6 + st * 5 });
  }
  if (Math.random() < k * (0.5 + st)) {
    const x = cp.x + rnd(-12, 12), z = cp.z + rnd(-12, 12);
    _dv.set(x, heightAt(x, z) + rnd(0.1, 1.2), z);
    emit(3, { pool: 'soft', pos: _dv, spread: 1.5, vel: { x: wx * 1.4, y: 0.4, z: wz * 1.4 }, velSpread: 1.2, drag: 0.2, col: col, life: 1.4, size: 0.06, size2: 0.04 });
  }
  // dust devils: by day, out on the flats, one at a time
  DUST.devilT -= 0.08;
  if (DUST.devilT <= 0 && night < 0.3 && WEATHER.cur.rain < 0.2 && DUST.devils.length < 1) {
    DUST.devilT = rnd(25, 60);
    const a = Math.random() * TAU, d = rnd(45, 120), x = cp.x + Math.cos(a) * d, z = cp.z + Math.sin(a) * d;
    if (outskirtsW(x, z) > 0.6) DUST.devils.push({ x, z, t: 0, life: rnd(10, 16), vx: rnd(-2, 2), vz: rnd(-2, 2), spin: Math.random() * TAU });
  }
  for (let i = DUST.devils.length - 1; i >= 0; i--) {
    const D = DUST.devils[i];
    D.t += 0.08; D.x += D.vx * 0.08; D.z += D.vz * 0.08; D.spin += 0.08 * 9;
    const grow = smooth(0, 2, D.t) * (1 - smooth(D.life - 2.5, D.life, D.t));
    const gy = heightAt(D.x, D.z);
    for (let j = 0; j < 4; j++) {
      const h = Math.random() * 14 * grow, r = 0.6 + h * 0.28, a = D.spin + j * 1.57 + h * 0.5;
      _dv.set(D.x + Math.cos(a) * r, gy + h, D.z + Math.sin(a) * r);
      emit(1, { pool: 'haze', pos: _dv, vel: { x: -Math.sin(a) * 6 + D.vx, y: 2.5 + h * 0.1, z: Math.cos(a) * 6 + D.vz }, velSpread: 0.6, drag: 0.6, col: '#c4a77c', life: 1.6, size: 1.6 + h * 0.18, size2: 3 + h * 0.3 });
    }
    if (D.t > D.life) DUST.devils.splice(i, 1);
  }
}

let _ambT = 0;
function updateVFX(dt) {
  VFX.time += dt;
  for (const P of Object.values(VFX.pools)) {
    P.m.uniforms.uTime.value = VFX.time;
    P.m.uniforms.uScale.value = viewH * 0.9 * (renderer.getPixelRatio());
  }
  for (let i = VFX.rings.length - 1; i >= 0; i--) {
    const r = VFX.rings[i]; r.t += dt;
    const k = r.t / r.life;
    const s = lerp(r.r0, r.r1, 1 - Math.pow(1 - k, 3));
    r.m.scale.set(s, 1, s);
    r.m.material.opacity = r.opacity * (1 - k);
    if (k >= 1) { scene.remove(r.m); r.m.material.dispose(); VFX.rings.splice(i, 1); }
  }
  updatePickups(dt);
  // rain follows weather
  if (VFX.rain) {
    const u = VFX.rain.material.uniforms;
    u.uTime.value = VFX.time; u.uCam.value.copy(camera.position); u.uAmt.value = WEATHER.cur.rain * (GAME.inCave ? 0 : 1);
    u.uCol.value.copy(SKY_NOW.fog).lerp(_tmpCol.set('#ffffff'), 0.4);
  }
  // ambient life: fireflies at night near water and woods, mist at the falls
  _ambT += dt;
  if (_ambT > 0.08 && !GAME.inCave) {
    _ambT = 0;
    const cp = camera.position;
    if (SKY_NOW.night > 0.5 && WEATHER.cur.rain < 0.3) {
      const x = cp.x + rnd(-30, 30), z = cp.z + rnd(-30, 30);
      emit(1, { pos: new THREE.Vector3(x, heightAt(x, z) + rnd(0.4, 2.2), z), col: '#d8ff7a', velSpread: 0.4, drag: 0.5, life: 4, size: 0.1, size2: 0.1, bright: 2.2 });
    }
    if (DUST.k > 0.05) dustAround(cp);
    const fx = PLACES.falls.x, fz = PLACES.falls.z + 14;
    if (Math.hypot(cp.x - fx, cp.z - fz) < 260) {
      emit(3, { pool: 'soft', pos: new THREE.Vector3(fx - 6, 44, fz), spread: 5, vel: { x: 0, y: 1.2, z: 2 }, velSpread: 1.5, col: '#e8f0f4', life: 2.8, size: 2.2, size2: 5, drag: 0.4 });
    }
  }
}
