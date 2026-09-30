/* ═══════════════════════════════════════════════════════════════════════
   MAIN — boot sequence and the frame loop.
   (GAME itself is declared in 00_core.js so earlier files can use it.)
   ═══════════════════════════════════════════════════════════════════════ */
const QS = new URLSearchParams(location.search);

/* dev camera: free fly (WASD + mouse, Space/C up/down) and named viewpoints */
const DEVCAM = { yaw: 0, pitch: -0.2, speed: 60 };
const VIEWS = {
  village:  { p: [-300, 70, 470],  look: [-430, 26, 350] },
  falls:    { p: [-250, 70, -420], look: [-306, 55, -555] },
  forest:   { p: [320, 60, -20],   look: [430, 30, -200] },
  cliffs:   { p: [-60, 45, -380],  look: [-60, 60, -560] },
  road:     { p: [420, 45, 470],   look: [900, 40, 380] },
  ridge:    { p: [-110, 95, 230],  look: [-420, 30, 360] },
  lake:     { p: [-430, 40, 560],  look: [-600, 18, 660] },
  ground:   { p: [-380, 27, 400],  look: [-420, 26, 340] },
};
function setView(name) {
  const v = VIEWS[name]; if (!v) return false;
  camera.position.set(...v.p);
  const d = new THREE.Vector3(...v.look).sub(camera.position).normalize();
  DEVCAM.yaw = Math.atan2(-d.x, -d.z); DEVCAM.pitch = Math.asin(d.y);
  camera.rotation.set(DEVCAM.pitch, DEVCAM.yaw, 0, 'YXZ');
  GAME.state = 'dev';
  return true;
}
function updateDevCam(dt) {
  DEVCAM.yaw -= IN.lookX * 0.0022; DEVCAM.pitch = clamp(DEVCAM.pitch - IN.lookY * 0.0022, -1.5, 1.5);
  camera.rotation.set(DEVCAM.pitch, DEVCAM.yaw, 0, 'YXZ');
  const f = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation), r = new THREE.Vector3(1, 0, 0).applyEuler(camera.rotation);
  const sp = DEVCAM.speed * (IN.keys.has('ShiftLeft') ? 4 : 1) * dt;
  camera.position.addScaledVector(f, -IN.moveZ * sp).addScaledVector(r, IN.moveX * sp);
  if (IN.keys.has('Space')) camera.position.y += sp;
  if (IN.keys.has('KeyC')) camera.position.y -= sp;
  camera.position.y = Math.max(camera.position.y, heightAt(camera.position.x, camera.position.z) + 1.5);
  GAME.focus.set(camera.position.x, heightAt(camera.position.x, camera.position.z), camera.position.z).addScaledVector(f.setY(0).normalize(), 25);
}

async function boot() {
  const t0 = performance.now();
  loadSettings();
  initInput();
  applyQuality();
  await nextFrame();
  await buildTerrain();
  bootStatus('Filling the river');
  buildWater();
  await nextFrame();
  bootStatus('Growing the forest');
  buildGrass();
  await buildTrees();
  await nextFrame();
  bootStatus('Carrying stones');
  await loadPropsLibrary();
  scatterRocks();
  bootStatus('Waking the people');
  await loadCharacters();
  initVFX();
  GAME.bootMs = Math.round(performance.now() - t0);
  $('boot').classList.add('gone');
  canvas.addEventListener('click', () => { if (GAME.state === 'play' || GAME.state === 'dev') lockPointer(); });

  if (QS.has('view')) setView(QS.get('view'));
  else startDevPlay();
  requestAnimationFrame(loop);
  if (TEST) setTimeout(runTests, 50);
}

/* until the menus exist: jump straight into play as a default character */
function startDevPlay() {
  G = newGameState({ name: 'Rudeus', race: QS.get('race') || 'human', style: QS.get('style') || 'sword', aff: QS.get('aff') || 'fire' });
  if (QS.has('allspells')) for (const k in G.prof) G.prof[k] = 130;
  const w = WAYSTONES[0];
  spawnPlayer(w.x + 4, w.z + 6, Math.PI * 0.75);
  GAME.state = 'play';
  const list = (QS.get('enemies') || '').split(',').filter(Boolean);
  list.forEach((k, i) => new Enemy(k, w.x + 10 + i * 3, w.z - 14 + (i % 2) * 4));
}

let _last = performance.now();
function frame(dtReal) {
  GAME.frame++;
  pollInput();
  // time: hitstop freezes the simulation; the vessel break slows it for a beat
  let dt = dtReal;
  if (GAME.hitstop > 0) { GAME.hitstop -= dtReal; dt = 0; }
  else if (GAME.slowmo > 0) { GAME.slowmo -= dtReal; dt = dtReal * 0.3; }
  GAME.time += dt;

  if (GAME.state === 'dev') updateDevCam(dtReal);
  if (GAME.state === 'play') {
    if (dt > 0) {
      updatePlayer(dt);
      updateEncounters();
      updateEnemies(dt);
      updateMagic(dt);
    }
    lockSwitch(dtReal);
    updateCamera(dtReal, PL.body.pos, { fovKick: PL.sprinting ? 6 : 0 });
    GAME.focus.copy(PL.body.pos);
  }
  updateSky(dt, GAME.focus, GAME.time);
  updateWater(GAME.time);
  updateGrass(GAME.time, camera.position, GAME.state === 'play' ? PL.body.pos : null);
  updateTrees(GAME.time);
  updateVFX(dt);
  assignLights();
  flushPools();
  renderer.info.reset();
  composer.render(dtReal);
  endInputFrame();
}
function loop(now) {
  const dt = Math.min(0.05, (now - _last) / 1000);
  _last = now;
  try { frame(dt); } catch (e) { reportFatal(e); return; }
  requestAnimationFrame(loop);
}
function reportFatal(e) {
  console.error(e);
  $('boot').classList.remove('gone'); $('boot').classList.add('err');
  bootStatus('Something broke: ' + (e && (e.stack || e.message) || e));
}

/* Test/inspection hooks — used by the headless harness and by me in devtools. */
window.__mv = {
  THREE, scene, camera, renderer, TER, FOL, TOD, WEATHER, GAME, setView, heightAt, waterAt, PROPS_LIB, propSize,
  PL, CAM, ENT, IN, MAGIC, VFX, PHYS, get G() { return G; }, Enemy, spawnPlayer, castPlayerSpell, SPELL,
  // run N frames synchronously (rAF doesn't fire in a hidden tab)
  step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) frame(dt); return renderer.info.render; },
  // simulate held keys for a number of frames: keys = ['KeyW', 'Mouse0', ...]
  hold(keys, n = 30, dt = 1 / 60) {
    for (const k of keys) { IN.keys.add(k); IN.edgesDown.add(k); }
    for (let i = 0; i < n; i++) frame(dt);
    for (const k of keys) { IN.keys.delete(k); IN.edgesUp.add(k); }
    frame(dt);
  },
};

function runTests() {
  const report = { bootMs: GAME.bootMs, ok: true };
  try { if (typeof selfTests === 'function') Object.assign(report, selfTests()); } catch (e) { report.ok = false; report.error = String(e.stack || e); }
  const pre = document.createElement('pre'); pre.id = '__report';
  pre.textContent = JSON.stringify(report); document.body.appendChild(pre);
  document.title = 'MV-TEST-DONE';
}

boot().catch(e => {
  $('boot').classList.add('err');
  bootStatus('Boot failed: ' + (e && (e.stack || e.message) || e));
  console.error(e);
});
