/* ═══════════════════════════════════════════════════════════════════════
   WILDLIFE — what moves when nothing is trying to kill you. Flocks wheel
   over the lake, the fields, the forest and Roa's plaza; vultures turn
   over Wagonbreak Camp; hawks hang over the pass. By day, butterflies
   rise out of the meadow grass around you. Birds roost at night.

   One instanced mesh of birds (wings flap in the vertex shader, each bird
   with its own beat; gliders hold theirs), one of butterflies.
   ═══════════════════════════════════════════════════════════════════════ */
const WILD = { birds: null, flocks: [], bfly: null, flies: [], t: 0 };

const FLOCKS = [
  // x, z: what they circle; r: radius; h: height above the ground there; n; col; size; w: angular speed; glide: 0 flaps … 1 soars
  { x: -560, z: 620, r: 60, h: 34, n: 7, col: '#ece8e0', s: 1.1, w: 0.22, glide: 0.5 },     // gulls over Lake Buena
  { x: -380, z: 480, r: 90, h: 22, n: 9, col: '#4a3a2c', s: 0.7, w: 0.42, glide: 0.1 },     // swallows over the fields
  { x: 420, z: -150, r: 70, h: 58, n: 6, col: '#1e1e22', s: 1.0, w: 0.2, glide: 0.35 },     // crows over the forest
  { x: 1560, z: 386, r: 38, h: 26, n: 8, col: '#8a8c92', s: 0.8, w: 0.33, glide: 0.2 },     // pigeons over the plaza
  { x: 1985, z: 158, r: 42, h: 46, n: 4, col: '#3a2a20', s: 1.9, w: 0.12, glide: 0.92 },    // vultures over the camp
  { x: 1010, z: 384, r: 110, h: 85, n: 2, col: '#5a4030', s: 1.5, w: 0.08, glide: 0.95 },   // hawks over the pass
];

function birdGeometry() {
  // a body and two wings hinged on it, in local +Z (forward)
  const v = [
    0, 0, 0.45,   -0.09, 0, -0.1,   0.09, 0, -0.1,        // body top
    0, 0, 0.45,   0.09, 0, -0.1,    0, -0.08, -0.05,      // body under
    0, 0, 0.45,   0, -0.08, -0.05,  -0.09, 0, -0.1,
    0, 0, -0.1,   -0.09, 0, -0.4,   0.09, 0, -0.4,        // tail
    -0.06, 0, 0.18,  -0.75, 0.02, -0.02,  -0.06, 0, -0.12,   // left wing
    0.06, 0, 0.18,   0.06, 0, -0.12,  0.75, 0.02, -0.02,     // right wing
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

function buildWildlife() {
  const total = FLOCKS.reduce((s, f) => s + f.n, 0);
  const g = birdGeometry();
  const flap = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);     // beat speed, phase, amplitude
  g.setAttribute('aFlap', flap);
  WILD.uTime = { value: 0 };
  const onShader = shader => {
    shader.uniforms.uTime = WILD.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aFlap; uniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float span = max(abs(transformed.x) - 0.06, 0.0);
          float beat = sin(uTime * aFlap.x + aFlap.y) * aFlap.z;
          transformed.y += beat * span * 1.1;
          transformed.x *= 1.0 - abs(beat) * 0.12; }`);
  };
  onShader.key = 'bird';
  const mat = toonMat({ side: THREE.DoubleSide, onShader });
  const im = new THREE.InstancedMesh(g, mat, total);
  im.frustumCulled = false; im.castShadow = false;
  const col = new THREE.Color();
  let k = 0;
  for (const f of FLOCKS) {
    f.birds = [];
    for (let i = 0; i < f.n; i++, k++) {
      f.birds.push({ i: k, a: i / f.n * TAU * 0.35 + Math.random() * 0.2, dr: (Math.random() - 0.5) * f.r * 0.25, dh: (Math.random() - 0.5) * 5, ph: Math.random() * 10 });
      flap.setXYZ(k, 9 + Math.random() * 4 + (f.s < 0.9 ? 6 : 0), Math.random() * 10, 0.6);
      im.setColorAt(k, col.set(f.col).multiplyScalar(0.9 + Math.random() * 0.2));
    }
  }
  scene.add(im);
  WILD.birds = im; WILD.flap = flap; WILD.flocks = FLOCKS;

  // butterflies: two wings on a hinge, beating fast
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0.06, -0.13, 0, 0.1, -0.11, 0, -0.08,    0, 0, 0.06, -0.11, 0, -0.08, 0, 0, -0.06,
    0, 0, 0.06, 0.11, 0, -0.08, 0.13, 0, 0.1,      0, 0, 0.06, 0, 0, -0.06, 0.11, 0, -0.08,
  ], 3));
  bg.computeVertexNormals();
  const bonShader = shader => {
    shader.uniforms.uTime = WILD.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float b = sin(uTime * 22.0 + ip.x * 3.1 + ip.z * 1.7) * 1.1;
          float s = sign(transformed.x), r = abs(transformed.x);
          transformed.x = s * r * cos(b); transformed.y += r * abs(sin(b)); }`);
  };
  bonShader.key = 'bfly';
  const bm = new THREE.InstancedMesh(bg, toonMat({ side: THREE.DoubleSide, onShader: bonShader, emissive: '#1a1410' }), 16);
  bm.frustumCulled = false;
  const BCOL = ['#f4f1e8', '#f2c94c', '#ff8c42', '#7fb8ff', '#f4f1e8', '#e8e070'];
  for (let i = 0; i < 16; i++) { bm.setColorAt(i, col.set(BCOL[i % BCOL.length])); WILD.flies.push({ p: new THREE.Vector3(0, -999, 0), v: new THREE.Vector3(), t: 0, home: null }); }
  scene.add(bm);
  WILD.bfly = bm;
}

const _wm = new THREE.Matrix4(), _wq = new THREE.Quaternion(), _we = new THREE.Euler(), _ws = new THREE.Vector3(), _wp = new THREE.Vector3();
/* A fish now and then: out of deep water in a short silver arc, a splash each end. */
const FISH = { t: 6, m: null, p0: new THREE.Vector3(), p1: new THREE.Vector3(), k: -1, y: 0 };
function updateFish(dt) {
  if (!FISH.m) {
    const g = new THREE.IcosahedronGeometry(1, 1); g.scale(0.07, 0.09, 0.26);
    FISH.m = new THREE.Mesh(g, toonMat({ color: '#9aa8b4', emissive: '#10161c' })); FISH.m.visible = false; scene.add(FISH.m);
  }
  if (FISH.k >= 0) {
    FISH.k += dt / 0.75;
    const k = Math.min(1, FISH.k), h = Math.sin(k * Math.PI) * 0.9;
    FISH.m.position.lerpVectors(FISH.p0, FISH.p1, k).setY(FISH.y + h - 0.1);
    FISH.m.rotation.x = -Math.cos(k * Math.PI) * 0.9;            // nose up, then nose down
    if (FISH.k >= 1) { FISH.k = -1; FISH.m.visible = false; splashAt(FISH.p1, FISH.y, 0.7); }
    return;
  }
  FISH.t -= dt;
  if (FISH.t > 0 || GAME.inCave || SKY_NOW.night > 0.6) return;
  FISH.t = rnd(5, 14);
  const c = camera.position;
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * TAU, d = rnd(10, 45), x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
    const w = waterAt(x, z);
    if (w === NO_WATER || w - heightAt(x, z) < 0.7) continue;
    const dir = Math.random() * TAU, x1 = x + Math.cos(dir) * 1.4, z1 = z + Math.sin(dir) * 1.4;
    if (waterAt(x1, z1) === NO_WATER) continue;
    FISH.p0.set(x, w, z); FISH.p1.set(x1, w, z1); FISH.y = w; FISH.k = 0;
    FISH.m.visible = true; FISH.m.rotation.set(0, Math.atan2(x1 - x, z1 - z), 0, 'YXZ');
    splashAt(FISH.p0, w, 0.5);
    return;
  }
}
function splashAt(p, y, s) {
  emit(Math.round(10 * s + 4), { pos: new THREE.Vector3(p.x, y + 0.05, p.z), spread: 0.15, col: '#dcf0fa', velSpread: 1.0 * s, upBias: 2.2 * s, gravity: 9, life: 0.55, size: 0.07, size2: 0.03 });
  ring(new THREE.Vector3(p.x, y + 0.03, p.z), { col: '#e8f6ff', r0: 0.15, r1: 1.4 * s + 0.4, life: 0.9, opacity: 0.5 });
  if (p.distanceToSquared(camera.position) < 30 * 30) BUS.emit('sfx', { id: 'splash', pos: p });
}
function updateWildlife(dt) {
  updateFish(dt);
  if (!WILD.birds) return;
  WILD.t += dt; WILD.uTime.value = WILD.t;
  const cam = camera.position, night = SKY_NOW.night, inside = GAME.inCave;
  // birds: roost at night, gone in the cave
  const show = !inside && night < 0.6;
  WILD.birds.visible = show;
  if (show) {
    for (const f of WILD.flocks) {
      const far = Math.hypot(f.x - cam.x, f.z - cam.z) > 700;
      const gy = f.gy ?? (f.gy = heightAt(f.x, f.z));
      for (const b of f.birds) {
        if (far) { _wm.makeScale(0, 0, 0); WILD.birds.setMatrixAt(b.i, _wm); continue; }
        b.a += f.w * dt * (1 + Math.sin(WILD.t * 0.3 + b.ph) * 0.15);
        const r = f.r + b.dr + Math.sin(WILD.t * 0.21 + b.ph) * f.r * 0.12;
        const x = f.x + Math.cos(b.a) * r, z = f.z + Math.sin(b.a) * r;
        const y = gy + f.h + b.dh + Math.sin(WILD.t * 0.6 + b.ph) * 2.5;
        // heading: along the circle (counter-clockwise), banked into the turn
        const yaw = Math.atan2(-Math.sin(b.a), Math.cos(b.a));
        _we.set(Math.sin(WILD.t * 0.9 + b.ph) * 0.08, yaw, -0.35 * Math.sign(f.w), 'YXZ');
        _wm.compose(_wp.set(x, y, z), _wq.setFromEuler(_we), _ws.setScalar(f.s));
        WILD.birds.setMatrixAt(b.i, _wm);
        // flap in bursts, glide between (gliders mostly hold their wings)
        const flapping = Math.sin(WILD.t * 0.7 + b.ph * 3) > (f.glide * 2 - 1);
        WILD.flap.setZ(b.i, damp(WILD.flap.getZ(b.i), flapping ? 0.65 : 0.06, 4, dt));
      }
    }
    WILD.birds.instanceMatrix.needsUpdate = true;
    WILD.flap.needsUpdate = true;
  }
  // butterflies: by day, in grass, not in the rain, around wherever you are
  const flyOK = !inside && night < 0.3 && WEATHER.cur.rain < 0.2 && G && PL.body;
  WILD.bfly.visible = !!flyOK;
  if (flyOK) {
    const p = PL.body.pos;
    WILD.flies.forEach((F, i) => {
      if (!F.home || F.p.distanceToSquared(p) > 32 * 32) {
        // a new one, somewhere grassy nearby (or nowhere, this time)
        const a = Math.random() * TAU, d = 8 + Math.random() * 20, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        const gr = TER.GRASS ? sampleField(TER.GRASS, x, z) / 255 : 0;
        if (gr < 0.45 || waterAt(x, z) > heightAt(x, z) - 0.3) { F.home = null; F.p.set(0, -999, 0); }
        else { F.home = new THREE.Vector3(x, heightAt(x, z), z); F.p.copy(F.home).setY(F.home.y + 0.6); F.t = Math.random() * 10; }
      }
      if (F.home) {
        F.t += dt;
        // a drunk, looping flight round its patch
        const tx = F.home.x + Math.sin(F.t * 0.7 + i) * 2.5 + Math.sin(F.t * 1.9) * 0.6;
        const tz = F.home.z + Math.cos(F.t * 0.55 + i * 2) * 2.5 + Math.cos(F.t * 2.3) * 0.6;
        const ty = heightAt(tx, tz) + 0.5 + Math.abs(Math.sin(F.t * 1.3 + i)) * 1.1;
        F.v.set(tx - F.p.x, ty - F.p.y, tz - F.p.z);
        F.p.addScaledVector(F.v, Math.min(1, dt * 2.5));
        _we.set(0, Math.atan2(F.v.x, F.v.z), 0);
        _wm.compose(F.p, _wq.setFromEuler(_we), _ws.setScalar(1));
      } else _wm.makeScale(0, 0, 0);
      WILD.bfly.setMatrixAt(i, _wm);
    });
    WILD.bfly.instanceMatrix.needsUpdate = true;
  }
}
