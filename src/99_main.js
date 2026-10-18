/* ═══════════════════════════════════════════════════════════════════════
   MAIN — boot sequence and the frame loop.
   (GAME itself is declared in 00_core.js so earlier files can use it.)

   Dev switches (URL):  ?play        skip the title, start as a default char
                        ?view=NAME   free-fly camera at a named viewpoint
                        ?test        run the self-tests and report
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
  plaza:    { p: [-400, 40, 400],  look: [-440, 26, 330] },
  gate:     { p: [700, 50, 420],   look: [800, 40, 380] },
};
function setView(name) {
  const v = VIEWS[name]; if (!v) return false;
  camera.position.set(...v.p);
  const d = new THREE.Vector3(...v.look).sub(camera.position).normalize();
  DEVCAM.yaw = Math.atan2(-d.x, -d.z); DEVCAM.pitch = Math.asin(d.y);
  camera.rotation.set(DEVCAM.pitch, DEVCAM.yaw, 0, 'YXZ');
  GAME.state = 'dev';
  closeAllScreens(); $('hud').classList.add('off');
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
  let tl = t0; GAME.bootLaps = {};
  const lap = k => { const n = performance.now(); GAME.bootLaps[k] = Math.round(n - tl); tl = n; };   // where the boot time goes (dev: __mv.GAME.bootLaps)
  loadSettings();
  initInput();
  await loadFonts();
  applyQuality();
  await nextFrame();
  await buildTerrain(); lap('buildTerrain');
  bootStatus('Filling the river');
  buildWater(); lap('buildWater');
  await nextFrame();
  bootStatus('Growing the forest');
  buildGrass(); lap('buildGrass');
  await buildTrees(); lap('buildTrees');
  await nextFrame();
  bootStatus('Raising Buena');
  await loadPropsLibrary(); lap('loadPropsLibrary');
  scatterRocks(); lap('scatterRocks');
  await loadCharacters(); lap('loadCharacters');
  buildStructures(); lap('buildStructures');
  buildRoa(); lap('buildRoa');
  addTreeColliders(); lap('addTreeColliders');
  bootStatus('Hollowing the cave');
  await nextFrame();
  buildCave(); lap('buildCave');
  bootStatus('Waking the people');
  buildPeople(); lap('buildPeople');
  buildRoaPeople(); lap('buildRoaPeople');
  buildTownsfolk(); lap('buildTownsfolk');
  buildWildlife(); lap('buildWildlife');
  initDeer();
  defineEncounters();
  defineRoaEncounters();
  defineBountyEncounters();
  buildBountyBoard();
  buildCrystals(); lap('buildCrystals');
  buildSideQuests(); lap('buildSideQuests');
  buildPages(); lap('buildPages');
  buildCaches(); lap('buildCaches');
  batchStaticProps(); lap('batchStaticProps');
  initVFX(); lap('initVFX');
  initTrails();
  initMenus(); lap('initMenus');
  if (typeof mapBuild === 'function') { bootStatus('Drawing the map'); await nextFrame(); try { mapBuild(); } catch (e) { console.error('map', e); } lap('mapBuild'); }
  if (typeof initAudio === 'function') initAudio();
  GAME.bootMs = Math.round(performance.now() - t0);
  $('boot').classList.add('gone');
  canvas.addEventListener('click', () => { if (GAME.state === 'play' || GAME.state === 'dev') lockPointer(); });

  if (QS.has('view')) setView(QS.get('view'));
  else if (QS.has('play')) startDevPlay();
  else showTitle();
  requestAnimationFrame(loop);
  if (TEST) setTimeout(runTests, 50);
}

/* ?play: straight into the world as a default character (for testing) */
function startDevPlay() {
  G = newGameState({ name: 'Rudeus', race: QS.get('race') || 'human', style: QS.get('style') || 'sword', aff: QS.get('aff') || 'fire' });
  if (QS.has('quest')) G.quest = QS.get('quest');
  if (QS.has('allspells')) for (const k in G.prof) G.prof[k] = 130;
  if (QS.has('gate')) G.flags.gateOpen = true;                 // dev: the pass gate already open
  if (QS.has('eris')) G.flags.erisWith = true;                 // dev: Eris along
  if (QS.has('horse')) G.flags.horse = true;                   // dev: Kestrel lent already
  if (QS.has('event')) EVENTS.t = 3;                            // dev: a road event as soon as there's room for one
  TOD.hour = +(QS.get('hour') || 16.5); TOD.frozen = QS.has('freeze');
  const W = WSTONE.list[0];
  spawnPlayer(W.x + 4, W.z + 6, Math.PI * 0.75);
  resetWorldState();
  enterPlay();
  const list = (QS.get('enemies') || '').split(',').filter(Boolean);
  list.forEach((k, i) => new Enemy(k, W.x + 10 + i * 3, W.z - 14 + (i % 2) * 4));
}

let _last = performance.now();
const SIM_STATES = new Set(['play', 'rest']);
function frame(dtReal) {
  GAME.frame++;
  pollInput();
  // time: hitstop freezes the simulation; the vessel break slows it for a beat
  let dt = dtReal;
  if (GAME.hitstop > 0) { GAME.hitstop -= dtReal; dt = 0; }
  else if (GAME.slowmo > 0) { GAME.slowmo -= dtReal; dt = dtReal * 0.3; }
  const s = GAME.state;
  if (SIM_STATES.has(s)) GAME.time += dt; else GAME.time += dtReal * 0.2;   // menus: the world idles gently

  if (s === 'dev') updateDevCam(dtReal);
  else if (s === 'photo') { updateDevCam(dtReal); const p = PL.body.pos, c = camera.position, dx = c.x - p.x, dy = c.y - p.y, dz = c.z - p.z, d = Math.hypot(dx, dy, dz); if (d > 40) c.set(p.x + dx / d * 40, p.y + dy / d * 40, p.z + dz / d * 40); }
  else if (s === 'title') { titleCamera(dtReal); if (_titleRoa) updateTownsfolk(dtReal); }
  else if (s === 'creator') creatorCamera(dtReal);
  else if (s === 'intro') { if (GAME.cine && GAME.cine(dtReal) && GAME.cineDone) { const r = GAME.cineDone; GAME.cineDone = null; r(); } }
  if (SIM_STATES.has(s) && G) {
    if (dt > 0) {
      updatePlayer(dt);
      updateEncounters();
      updateEnemies(dt);
      updateAllies(dt);
      updateTownsfolk(dt);
      updateHorse(dt);
      updateDeer(dt);
      updateMagic(dt);
      updateStory(dt);
      updateBounties();
      updateCrystals(dt);
      updateEvents(dt);
      updateCaches(dt);
      updateFeats(dt);
    }
    lockSwitch(dtReal);
    updateCamera(dtReal, PL.body.pos, { fovKick: PL.sprinting ? 6 : 0, noLook: s !== 'play' });
    GAME.focus.copy(PL.body.pos);
    if (typeof mapRevealUpdate === 'function') mapRevealUpdate(dtReal);
  }
  if (UI.dlg) updateDialogue(dtReal);
  if (s === 'map' && typeof mapIsOpen === 'function' && !mapIsOpen()) enterPlay();   // closed from its own UI

  updateSky(dt || dtReal * 0.2, GAME.focus, GAME.time);
  caveAtmosphere();
  if (!GAME.inCave) {
    updateWater(GAME.time);
    updateGrass(GAME.time, camera.position, G ? PL.body.pos : null);
    updateLamps(); updateFires(dtReal); updateFountains(dtReal);
  }
  updateTrees(GAME.time);
  updateWildlife(dt || dtReal * 0.3);
  updateCave(dtReal);
  if (G) updateWaystones(dtReal);
  updateVFX(dt);
  updateTrails(dt || dtReal * 0.2);
  if (G && (s === 'play' || s === 'rest')) updateHUD(dtReal, GAME.time);
  updateFlash(dtReal);
  if (typeof updateAudio === 'function') { try { updateAudio(dtReal); } catch (e) { console.error('audio', e); } }
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
  THREE, scene, camera, renderer, TER, FOL, TOD, WEATHER, GAME, setView, heightAt, waterAt, floorAt, groundAt, PROPS_LIB, propSize,
  PL, CAM, ENT, IN, MAGIC, VFX, PHYS, STRUCT, CAVE, NPCS, ENCOUNTERS, WSTONE, UI, PAGES, BUS, ROA, CHARS, ALLY, DUST, ROA_GREEN, TOWN, WILD, CRYSTALS, STORM, HORSE, DEER, CACHES, openCache, STABLE, leadOutHorse, sendHorseHome, EVENTS, eventSpot, startRoadEvent, endRoadEvent,
  get G() { return G; }, set G(v) { G = v; }, get MAP() { return typeof MAP !== 'undefined' ? MAP : null; },
  Enemy, damageEnemy, damagePlayer, spawnPlayer, castPlayerSpell, SPELL, setQuest, enterCave, exitCave, climbTower, fastTravel, saveGame, loadGame, startDevPlay,
  step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) frame(dt); return renderer.info.render; },
  mapDraw(t = performance.now() / 1000) { if (typeof mapDraw === 'function' && MAP.open) mapDraw(t); },   // a map frame without rAF (hidden pane)
  hold(keys, n = 30, dt = 1 / 60) {
    for (const k of keys) { IN.keys.add(k); IN.edgesDown.add(k); }
    for (let i = 0; i < n; i++) frame(dt);
    for (const k of keys) { IN.keys.delete(k); IN.edgesUp.add(k); }
    frame(dt);
  },
};

/* ?test — a smoke run the headless harness reads back. Synchronous: it boots
   a dev game, plays a few seconds of each system, and reports what broke.
   (Kept short: headless Chrome renders on the CPU.) */
function selfTests() {
  const R = {}, fail = [], step = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) frame(dt); };
  const check = (name, fn) => { try { const v = fn(); R[name] = v === undefined ? true : v; if (v === false) fail.push(name); } catch (e) { fail.push(name + ': ' + (e.message || e)); } };
  check('title', () => GAME.state);
  check('devPlay', () => { startDevPlay(); step(20); return GAME.state; });
  check('calls', () => { step(10); return renderer.info.render.calls; });
  // a frame that isn't black: a NaN anywhere spreads through bloom to the whole screen
  check('brightness', () => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 18;
    const x = c.getContext('2d'); frame(1 / 30); x.drawImage(renderer.domElement, 0, 0, 32, 18);
    const d = x.getImageData(0, 0, 32, 18).data; let s = 0;
    for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
    const v = Math.round(s / (32 * 18 * 3)); return v > 20 ? v : false;
  });
  check('spells', () => { const out = []; for (const sp of unlockedSpells()) { G.cds = {}; G.mana = G.maxMana; castPlayerSpell(sp, false); step(8); out.push(sp.id); } return out.join(','); });
  check('kill', () => {
    const p = PL.body.pos, e = new Enemy('wolf', p.x + 4, p.z), k0 = G.kills;
    for (let i = 0; i < 20 && !e.dead; i++) damageEnemy(e, 40, { dir: new THREE.Vector3(1, 0, 0), kind: 'sword' });
    step(6); return G.kills - k0 === 1;
  });
  check('vessel', () => { const m0 = G.maxMana; G.mana = 1; spendMana(5); const down = PL.state === 'collapse'; step(70, 1 / 12); return down && G.maxMana > m0 && PL.state === 'move'; });
  check('save', () => { G.quest = 'wolves'; saveGame(true); const s = loadGame(); localStorage.removeItem(SAVE_KEY); return !!s && s.quest === 'wolves' && Array.isArray(s.pos); });
  check('map', () => typeof MAP !== 'undefined' && !!MAP.canvas ? MAP.buildMs : false);
  check('batched', () => STRUCT.batched || false);
  // Chapter II and the open world around it
  check('roa', () => ROA.houses > 20 && ROA_GREEN.trees > 10 && ROA.spots.board ? ROA.houses : false);
  check('town', () => TOWN.walkers.length >= 15 && !TOWN.dropped.length ? TOWN.walkers.length : false);
  check('crystals', () => CRYSTALS.list.length === 8 && LANDMARKS.colossus ? 8 : false);
  check('trunks', () => FOL.trunkColliders > 1000 ? FOL.trunkColliders : false);
  check('bounty', () => {
    G.flags.guildF = true; G.bounties = {}; takeBounty('scar');
    const ok = G.bounties.scar === 'taken' && !!G.flags.bt_scar && !!bountyMarker();
    G.bounties = {}; G.flags.bt_scar = false; G.trackBounty = null; return ok;
  });
  check('golem', () => { const p = PL.body.pos, e = new Enemy('golem', p.x + 9, p.z, { dormant: true }); e.wake(1); step(30); const ok = !e.removed && !!e.rig; e.remove(); return ok; });
  check('scar', () => { const p = PL.body.pos, e = new Enemy('scar', p.x + 8, p.z); step(10); const ok = !!e.rig; e.remove(); return ok; });
  check('eris', () => { if (!ALLY.eris) ALLY.eris = new Companion(ERIS_SPEC, 'Eris', '#e8606f'); ALLY.eris.join(); step(10); const ok = ALLY.eris.active; ALLY.eris.leave(); return ok; });
  check('horse', () => { G.flags.horse = true; whistleHorse(); step(90); const came = HORSE.mode === 'come' || HORSE.mode === 'idle'; HORSE.body.pos.copy(PL.body.pos).add(new THREE.Vector3(1.5, 0, 0)); HORSE.mode = 'idle'; mountHorse(); const rode = PL.state === 'ride'; step(10); dismountHorse(); const off = PL.state === 'move'; horseStandDown(); return came && rode && off; });
  // getting down stays down: the key that dismounts must not remount in the same frame (H and E both)
  check('dismount', () => {
    G.flags.horse = true; const keys = [SETTINGS.binds.horse, SETTINGS.binds.interact], res = [];
    for (const k of keys) {
      whistleHorse(); HORSE.body.pos.copy(PL.body.pos).add(new THREE.Vector3(1.5, 0, 0)); HORSE.mode = 'idle'; GAME.time += 1;
      mountHorse(); step(3);
      IN.keys.add(k); IN.edgesDown.add(k); frame(1 / 30); IN.keys.delete(k); IN.edgesUp.add(k); step(10);
      res.push(PL.state === 'move' && HORSE.mode === 'idle');
    }
    horseStandDown();
    return res.every(Boolean);
  });
  // the Boreas stables: Kestrel waits in her stall, Bertram leads her out, sends her home
  check('stable', () => {
    if (!STABLE.built || !NPCS.stable) return false;
    G.flags.horse = true; horseStandDown();
    const p0 = PL.body.pos.clone(), sx = STABLE.x, sz = STABLE.z + 12;
    PL.body.pos.set(sx, heightAt(sx, sz), sz); step(3);
    const inStall = HORSE.mode === 'stall';
    leadOutHorse(); step(150);
    const out = HORSE.mode === 'idle' && HORSE.body.pos.z > STABLE.z + 3;
    sendHorseHome(); step(420);
    const back = HORSE.mode === 'stall' && HORSE.body.pos.distanceTo(STABLE.stall) < 1.2;
    PL.body.pos.copy(p0); horseStandDown(); step(2);
    return inStall && out && back;
  });
  check('walkers', () => { const w = TOWN.walkers[0], x0 = w.pos.x, z0 = w.pos.z; w.update(1, true, w.pos.clone().setY(w.pos.y + 5)); for (let i = 0; i < 30; i++) w.update(1 / 15, true, w.pos.clone().setY(w.pos.y + 5)); return Math.hypot(w.pos.x - x0, w.pos.z - z0) > 0.5 || w.mode === 'pause'; });
  check('event', () => {
    const q0 = G.quest; G.quest = 'wolves';
    const p0 = PL.body.pos.clone();
    let E = null;
    for (const f of [0.3, 0.2, 0.4, 0.5, 0.15, 0.6, 0.7]) {
      const P = TER.roadPath[Math.floor(TER.roadPath.length * f)];
      PL.body.pos.set(P[0], heightAt(P[0], P[1]), P[1]);
      const s = eventSpot(); if (s) { E = startRoadEvent(s); break; }
    }
    if (!E) { PL.body.pos.copy(p0); G.quest = q0; return false; }
    step(5);
    const ring = E.foes.length >= 2 && E.foes.every(e => !e.aggro && Math.hypot(e.pos.x - E.x, e.pos.z - E.z) < 8);
    const h0 = G.flags.helped || 0;
    for (const e of E.foes) killEnemy(e);
    step(3);
    const saved = E.phase === 'saved' && G.flags.helped === h0 + 1 && !!eventMarker() === false;
    endRoadEvent(E); G.flags.helped = h0; G.quest = q0; PL.body.pos.copy(p0);
    // swept away (a death, a fast travel) is not a rescue
    const E2 = startRoadEvent({ x: E.x, z: E.z, roadAng: 0 });
    for (const e of [...E2.foes]) e.remove();
    step(2);
    const swept = !EVENTS.cur && (G.flags.helped || 0) === h0;
    return ring && saved && swept && !INTERACTABLES.includes(E.interact) && !INTERACTABLES.includes(E2.interact) ? E.foes.length : false;
  });
  check('feats', () => {
    const f0 = G.feats; G.feats = undefined; FEATS_T.t = 0; updateFeats(0.016);
    const silent = Array.isArray(G.feats);
    G.kills = Math.max(G.kills, 1); G.feats = G.feats.filter(id => id !== 'blood'); FEATS_T.t = 0; updateFeats(0.016);
    const got = G.feats.includes('blood'), all = FEATS.every(f => typeof featHeld(f) === 'boolean');
    G.feats = f0; return silent && got && all ? FEATS.length : false;
  });
  // the Buena bridge: walkable along the road; the village waystone: you rise looking at open ground
  check('bridge', () => STRUCT.bridge.slabs > 40 && STRUCT.bridge.deck > heightAt(STRUCT.bridge.x, STRUCT.bridge.z) + 4 ? STRUCT.bridge.slabs : false);
  check('waystoneView', () => {
    const p0 = PL.body.pos.clone(), f0 = PL.face;
    placeAtWaystone(WSTONE.list[0]);
    const o = PL.body.pos.clone().setY(PL.body.pos.y + 1.4), clear = raycastWorld(o, new THREE.Vector3(Math.sin(PL.face), 0, Math.cos(PL.face)), 30);
    PL.body.pos.copy(p0); PL.face = f0;
    return clear > 12 ? Math.round(clear) : false;
  });
  check('resume', () => {
    const B = STRUCT.bridge, s = savedSpot({ pos: [B.x, B.deck, B.z], face: 1.5 }), deep = savedSpot({ pos: [ISLAND.x + 30, 0, ISLAND.z], face: 0 });
    return !!s && Math.abs(s.y - B.deck) < 0.3 && s.face === 1.5 && deep === null;
  });
  check('caches', () => {
    if (CACHES.list.length !== CACHE_SPOTS.length) return false;
    // (its xp can level you up, which adds health of its own: count that in, then put everything back)
    const snap = JSON.parse(JSON.stringify(G)), C = CACHES.list[0], hp0 = G.maxHp, l0 = G.lvl; G.caches = [];
    openCache(C); step(40);
    while (UI.dlg) advanceDialogue();
    const ok = C.open === 1 && G.maxHp === hp0 + (C.boon.hp || 0) + 9 * (G.lvl - l0) && cachesGot() === 1;
    for (const k of Object.keys(G)) if (!(k in snap)) delete G[k];
    Object.assign(G, snap); resetCaches();
    return ok && C.open === 0 ? CACHES.list.length : false;
  });
  R.failures = fail; R.ok = fail.length === 0;
  return R;
}
function runTests() {
  const report = { bootMs: GAME.bootMs, ok: true };
  try { if (typeof selfTests === 'function') Object.assign(report, selfTests()); } catch (e) { report.ok = false; report.error = String(e.stack || e); }
  const pre = document.createElement('pre'); pre.id = '__report'; pre.style.display = 'none';
  pre.textContent = JSON.stringify(report); document.body.appendChild(pre);
  document.title = 'MV-TEST-DONE';
}

boot().catch(e => {
  $('boot').classList.remove('gone'); $('boot').classList.add('err');
  bootStatus('Boot failed: ' + (e && (e.stack || e.message) || e));
  console.error(e);
});
