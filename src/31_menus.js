/* ═══════════════════════════════════════════════════════════════════════
   MENUS & FLOW — title · creator · intro · pause · grimoire · settings ·
   rest · death · endcard.  GAME.state is the single source of truth:
     title → creator → intro → play ⇄ paused/map/grimoire/settings/rest
   Pausing hangs off pointer-lock release: browsers swallow Esc while the
   pointer is captured, so "the pointer was released during play" is the
   only pause signal that works everywhere.
   ═══════════════════════════════════════════════════════════════════════ */
const SCREENS = ['title', 'creator', 'pause', 'grimoire', 'settingsScreen', 'death', 'rest', 'endcard'];
let _settingsFrom = 'title';
function openScreen(id) {
  for (const s of SCREENS) $(s).classList.toggle('on', s === id);
  unlockPointer();
  BUS.emit('sfx', { id: 'uiSelect' });
}
function closeAllScreens() { for (const s of SCREENS) $(s).classList.remove('on'); }

/* ───────────── title: a slow cinematic flight over Buena ───────────── */
const TITLE_PATH = [[-700, 150, 700], [-560, 90, 520], [-420, 70, 470], [-300, 80, 380], [-180, 110, 250], [-110, 105, 150], [-60, 90, 20], [-120, 80, -200], [-250, 95, -380], [-300, 110, -470]];
let _titleT = 0;
function titleCamera(dt) {
  _titleT += dt * 0.012;
  const pts = TITLE_PATH, n = pts.length - 1;
  const u = (Math.sin(_titleT) * 0.5 + 0.5) * n;
  const i = Math.min(n - 1, Math.floor(u)), t = u - i;
  const P = k => pts[clamp(k, 0, n)];
  const cr = (a, b, c, d, t) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const x = cr(P(i - 1)[0], P(i)[0], P(i + 1)[0], P(i + 2)[0], t), y = cr(P(i - 1)[1], P(i)[1], P(i + 1)[1], P(i + 2)[1], t), z = cr(P(i - 1)[2], P(i)[2], P(i + 1)[2], P(i + 2)[2], t);
  camera.position.set(x, Math.max(y, heightAt(x, z) + 25), z);
  camera.lookAt(-420, 30, 330);
  GAME.focus.set(-420, 26, 350);
}
function showTitle() {
  GAME.state = 'title';
  TOD.hour = 17.6; TOD.frozen = true;
  Object.assign(WEATHER.cur, WEATHER_STATES.fair); Object.assign(WEATHER.tgt, WEATHER_STATES.fair); WEATHER.timer = 1e9;
  $('hud').classList.add('off');
  if (PL.actor) PL.actor.root.visible = false;
  $('bContinue').disabled = !hasSave();
  openScreen('title');
}

/* ───────────── creator: your character, live, on the hill ───────────── */
const CC = { name: 'Rudeus', race: 'human', style: 'sword', aff: 'fire', diff: 'adventurer', focus: 'race' };
const CC_SPOT = { x: -262, z: 505 };
function buildChips(host, obj, key, labelOf) {
  const el = $(host); el.innerHTML = '';
  for (const [k, v] of Object.entries(obj)) {
    const b = document.createElement('button');
    b.className = 'chip' + (CC[key] === k ? ' sel' : '');
    b.textContent = labelOf ? labelOf(v) : v.name;
    b.onclick = () => { CC[key] = k; CC.focus = key; refreshCreator(); BUS.emit('sfx', { id: 'uiMove' }); };
    el.appendChild(b);
  }
}
const AFF_DESC = {
  fire: 'Burn. The loudest school, and not subtle about it. Clears brambles.',
  water: 'Slow, pierce, and eventually a storm. Freezes rivers into floors.',
  wind: 'The cheapest spell in the world, cast very fast.',
  earth: 'Stone Cannon, and pillars you can climb.',
  heal: 'Start able to close your own wounds.',
};
function refreshCreator() {
  buildChips('ccRace', RACES, 'race');
  buildChips('ccStyle', STYLES, 'style');
  buildChips('ccAff', Object.fromEntries(Object.entries(SCHOOLS).map(([k, v]) => [k, { name: v.name }])), 'aff');
  buildChips('ccDiff', DIFFICULTY, 'diff');
  const f = CC.focus;
  const d = f === 'race' ? RACES[CC.race] : f === 'style' ? STYLES[CC.style] : f === 'diff' ? DIFFICULTY[CC.diff] : { desc: AFF_DESC[CC.aff], stat: '' };
  $('ccDesc').innerHTML = (d.desc || '') + (d.stat ? `<b>${d.stat}</b>` : '');
  // rebuild the preview body
  G = newGameState({ name: CC.name, race: CC.race, style: CC.style, aff: CC.aff });
  spawnPlayer(CC_SPOT.x, CC_SPOT.z, 2.4);
  PL.actor.root.visible = true;
  PL.actor.loop('Idle', { fade: 0 });
}
let _ccOrbit = 0;
function creatorCamera(dt) {
  _ccOrbit += dt * 0.25;
  const p = PL.body.pos, a = 2.4 + Math.sin(_ccOrbit) * 0.5;
  camera.position.set(p.x + Math.sin(a) * 3.6 - 1.2, p.y + 1.55, p.z + Math.cos(a) * 3.6);
  camera.lookAt(p.x - 0.9, p.y + 1.05, p.z);
  GAME.focus.copy(p);
  PL.actor.update(dt);
}
function showCreator() {
  GAME.state = 'creator';
  $('ccName').value = CC.name;
  refreshCreator();
  openScreen('creator');
}

/* ───────────── a new journey ───────────── */
async function beginJourney() {
  CC.name = ($('ccName').value || 'Rudeus').trim().slice(0, 14) || 'Rudeus';
  SETTINGS.difficulty = CC.diff; saveSettings();
  G = newGameState({ name: CC.name, race: CC.race, style: CC.style, aff: CC.aff });
  closeAllScreens();
  GAME.state = 'intro';
  await fadeOut(0.8);
  TOD.hour = 16.4; TOD.frozen = false;
  Object.assign(WEATHER.tgt, WEATHER_STATES.clear); Object.assign(WEATHER.cur, WEATHER_STATES.clear); WEATHER.timer = 240;
  // the prologue, over black
  await say(SCRIPT.intro);
  // the crane shot: from over the lake, down to the Greyrat house
  const home = { x: -466, z: 316 };
  spawnPlayer(home.x, home.z, -2.6);
  PL.actor.root.visible = true;
  resetWorldState();
  const shot = { t: 0, dur: 7.5 };
  GAME.cine = (dt) => {
    shot.t += dt;
    const k = smooth(0, 1, shot.t / shot.dur);
    const from = new THREE.Vector3(-620, 120, 640), to = new THREE.Vector3(home.x + 5, PL.body.pos.y + 2.4, home.z + 7);
    camera.position.lerpVectors(from, to, k);
    camera.lookAt(lerp(-430, home.x, k), lerp(20, PL.body.pos.y + 1.2, k), lerp(360, home.z, k));
    GAME.focus.copy(PL.body.pos);
    PL.actor.update(dt);
    return shot.t >= shot.dur;
  };
  letterbox(true);
  await fadeIn(1.4);
  await new Promise(r => { GAME.cineDone = r; });
  letterbox(false);
  enterPlay();
  banner('Buena Village', 'Fittoa Region · The Asura Kingdom');
  setTimeout(() => { const q = questStep(); toast(q.title, 'big'); setTimeout(() => toast(q.text), 700); }, 4600);
  setTimeout(() => hint('Click to take control of the camera.', 4), 1200);
  autosave();
}
function continueJourney() {
  const s = loadGame();
  if (!s) return;
  G = Object.assign(newGameState({ name: s.name, race: s.race, style: s.style, aff: s.aff }), s);
  if (typeof mapDeserialize === 'function') mapDeserialize();
  TOD.hour = s.hour ?? 12; TOD.frozen = false; WEATHER.timer = 60;
  resetWorldState();
  const W = WSTONE.list.find(w => w.id === G.lastWaystone) || WSTONE.list[0];
  closeAllScreens();
  spawnPlayer(W.x + 4, W.z, 0);        // rebuilds the body for the saved race and hair
  placeAtWaystone(W);
  PL.actor.root.visible = true;
  enterPlay();
  banner(W.name, 'The journey continues');
}
// world state that follows G (quest-dependent objects, beaten bosses)
function resetWorldState() {
  for (const e of [...ENT.enemies]) e.remove();
  for (const enc of ENCOUNTERS) { enc.active = false; enc.live = []; enc.cleared = !!(enc.opts.boss && G.flags[enc.id]); }
  CAVE.fogPassed = false;
  if (NPCS.paul) NPCS.paul.setVisible(true);
  if (G.quest === 'stones') spawnRuneStones();
  for (const P of PAGES) P.mesh.visible = !G.pages.includes(P.i);
  buildSpellBar();
}
function enterPlay() {
  GAME.state = 'play';
  GAME.cine = null;
  $('hud').classList.remove('off');
  closeAllScreens();
}

/* ───────────── pause & friends ───────────── */
function pauseGame() {
  if (GAME.state !== 'play' || UI.dlg) return;
  GAME.state = 'paused';
  openScreen('pause');
}
function resumeGame() {
  closeAllScreens();
  GAME.state = 'play';
  lockPointer();
}
BUS.on('pointerlock', locked => {
  if (!locked && GAME.state === 'play' && !UI.dlg && PL.state !== 'dead' && !GAME._suppressPause) pauseGame();
});

function openGrimoire() {
  const b = $('grimBody');
  let html = `<p class="flavor" style="margin:0 auto 10px;text-align:center">${G.name} · Level ${G.lvl} · Rank ${guildRank(G.lvl)} · ${G.breaks} breaks · ${G.kills} kills · Max mana ${Math.round(G.maxMana)} · Pages ${G.pages.length}/5</p>`;
  for (const [k, s] of Object.entries(SCHOOLS)) {
    const p = G.prof[k] || 0, r = schoolRank(k);
    const next = RANK_NEED[r + 1], prev = RANK_NEED[r];
    const pct = next ? clamp((p - prev) / (next - prev), 0, 1) : 1;
    html += `<div class="school"><h3 style="color:${s.col}">${s.name}<span class="rank">${RANKS[r]}</span></h3>`;
    html += `<div class="prog"><i style="width:${pct * 100}%;background:${s.col}"></i></div>`;
    for (const sp of SPELLS.filter(x => x.school === k)) {
      const has = p >= RANK_NEED[sp.rank];
      html += `<div class="sp ${has ? '' : 'lock'}"><b>${sp.name}</b> — ${RANKS[sp.rank]} · ${sp.cost} mana${has ? '' : ' · locked'}</div>`;
    }
    html += `</div>`;
  }
  html += `<p class="flavor" style="margin:14px auto 0;text-align:center">Tap cast for chantless (instant, ×1.6 cost). Hold until the circle turns gold to incant (×0.55 cost, ×1.45 power). Casting a school ranks it up.</p>`;
  b.innerHTML = html;
  GAME.state = 'grimoire';
  openScreen('grimoire');
}

/* ───────────── settings ───────────── */
function openSettings(from) {
  _settingsFrom = from;
  if (from !== 'title') GAME.state = 'settings';
  buildSettings();
  openScreen('settingsScreen');
}
function buildSettings() {
  const b = $('setBody');
  const opt = (label, key, choices) => `<div class="srow"><label>${label}</label><div class="opts">${Object.entries(choices).map(([k, v]) => `<button class="chip ${SETTINGS[key] === k ? 'sel' : ''}" data-set="${key}" data-val="${k}">${v}</button>`).join('')}</div></div>`;
  const slider = (label, key, min, max, step, fmt) => `<div class="srow"><label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${SETTINGS[key]}" data-slide="${key}"><span class="val" id="v_${key}">${fmt(SETTINGS[key])}</span></div>`;
  let h = '<div class="sgroup">Graphics</div>';
  h += opt('Quality', 'quality', { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' });
  h += slider('Field of view', 'fov', 50, 90, 1, v => Math.round(v) + '°');
  h += '<div class="sgroup">Controls</div>';
  h += slider('Mouse sensitivity', 'sens', 0.3, 2.5, 0.05, v => (+v).toFixed(2));
  h += boolRow('Invert camera Y', 'invertY');
  h += '<div class="sgroup">Audio</div>';
  h += slider('Master', 'master', 0, 1, 0.01, v => Math.round(v * 100));
  h += slider('Music', 'music', 0, 1, 0.01, v => Math.round(v * 100));
  h += slider('Effects', 'sfx', 0, 1, 0.01, v => Math.round(v * 100));
  h += '<div class="sgroup">Game</div>';
  h += opt('Difficulty', 'difficulty', Object.fromEntries(Object.entries(DIFFICULTY).map(([k, v]) => [k, v.name])));
  h += boolRow('Screen shake', 'shake');
  h += boolRow('Damage numbers', 'damageNumbers');
  h += '<div class="sgroup">Key bindings — click, then press a key or mouse button</div><div class="binds">';
  for (const [a, name] of Object.entries(BIND_NAMES)) h += `<div class="bindrow"><span>${name}</span><button data-bind="${a}">${IN.label(a)}</button></div>`;
  h += '</div>';
  b.innerHTML = h;
  b.querySelectorAll('[data-set]').forEach(el => el.onclick = () => { SETTINGS[el.dataset.set] = el.dataset.val; afterSettingChange(el.dataset.set); buildSettings(); });
  b.querySelectorAll('[data-bool]').forEach(el => el.onclick = () => { SETTINGS[el.dataset.bool] = el.dataset.val === '1'; saveSettings(); buildSettings(); });
  b.querySelectorAll('[data-slide]').forEach(el => el.oninput = () => {
    const k = el.dataset.slide; SETTINGS[k] = +el.value;
    $('v_' + k).textContent = k === 'fov' ? Math.round(el.value) + '°' : k === 'sens' ? (+el.value).toFixed(2) : Math.round(el.value * 100);
    afterSettingChange(k);
  });
  b.querySelectorAll('[data-bind]').forEach(el => el.onclick = () => {
    el.classList.add('listen'); el.textContent = 'Press…';
    BUS.rebinding = el.dataset.bind;
  });
}
function boolRow(label, key) {
  return `<div class="srow"><label>${label}</label><div class="opts"><button class="chip ${SETTINGS[key] ? 'sel' : ''}" data-bool="${key}" data-val="1">On</button><button class="chip ${!SETTINGS[key] ? 'sel' : ''}" data-bool="${key}" data-val="0">Off</button></div></div>`;
}
BUS.on('rebind', code => {
  const a = BUS.rebinding; BUS.rebinding = null;
  if (a && code !== 'Escape') {
    for (const k in SETTINGS.binds) if (SETTINGS.binds[k] === code) SETTINGS.binds[k] = null;
    SETTINGS.binds[a] = code;
    saveSettings();
  }
  buildSettings();
});
function afterSettingChange(k) {
  saveSettings();
  if (k === 'quality') { applyQuality(); rebuildQualityDependents(); }
  if (k === 'fov') { camera.fov = SETTINGS.fov; camera.updateProjectionMatrix(); }
  if (['master', 'music', 'sfx'].includes(k) && typeof auVolumes === 'function') auVolumes();
}
function rebuildQualityDependents() {
  if (FOL.grass) { scene.remove(FOL.grass); FOL.grass.geometry.dispose(); buildGrass(); }
}
function closeSettings() {
  BUS.rebinding = null;
  if (_settingsFrom === 'title') openScreen('title');
  else { GAME.state = 'paused'; openScreen('pause'); }
}

/* ───────────── rest at a waystone ───────────── */
function openRest(W) {
  GAME.state = 'rest';
  $('restName').textContent = W.name;
  const m = $('restMenu'); m.innerHTML = '';
  const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; m.appendChild(b); };
  btn('Wait until morning', () => passTime(7));
  btn('Wait until nightfall', () => passTime(20));
  btn('Travel', () => { closeAllScreens(); openTravel(); });
  btn('Rise', () => { closeAllScreens(); leaveRest(); GAME.state = 'play'; lockPointer(); });
  openScreen('rest');
}
async function passTime(h) {
  await fadeOut(0.5);
  TOD.hour = h;
  restWorld();
  await fadeIn(0.7);
  toast(h < 12 ? 'Morning' : 'Nightfall', 'big');
}
function openTravel() {
  if (typeof mapOpen === 'function') { GAME.state = 'map'; mapOpen(); return; }
  // fallback: a simple list if the map module is absent
  const m = $('restMenu'); m.innerHTML = '';
  for (const W of WSTONE.list) if (G.waystones[W.id]) { const b = document.createElement('button'); b.textContent = W.name; b.onclick = () => fastTravel(W.id); m.appendChild(b); }
  openScreen('rest');
}

/* ───────────── endcard ───────────── */
function showEndcard() {
  GAME.state = 'end';
  $('endText').textContent = `${G.name}, level ${G.lvl}, Adventurer Rank ${guildRank(G.lvl)}. You broke the vessel ${G.breaks} times; it is ${Math.round(G.maxMana)} deep now. ${G.kills} kills, ${G.pages.length} of Roxy's pages, ${G.deaths} deaths. The Boreas estate is waiting in Roa — and a girl who punches.`;
  openScreen('endcard');
  autosave();
}

/* ───────────── wiring ───────────── */
function initMenus() {
  $('bNew').onclick = () => showCreator();
  $('bContinue').onclick = () => continueJourney();
  $('bSettings').onclick = () => openSettings('title');
  $('ccBack').onclick = () => { if (PL.actor) PL.actor.root.visible = false; showTitle(); };
  $('ccStart').onclick = () => beginJourney();
  $('ccName').oninput = e => { CC.name = e.target.value; };
  $('pResume').onclick = () => resumeGame();
  $('pMap').onclick = () => { closeAllScreens(); if (typeof mapOpen === 'function') { GAME.state = 'map'; mapOpen(); } else resumeGame(); };
  $('pGrimoire').onclick = () => openGrimoire();
  $('pSettings').onclick = () => openSettings('pause');
  $('pSave').onclick = () => saveGame(false);
  $('pQuit').onclick = () => { saveGame(true); showTitle(); };
  $('gBack').onclick = () => { GAME.state = 'paused'; openScreen('pause'); };
  $('sBack').onclick = () => closeSettings();
  $('sReset').onclick = () => { SETTINGS.binds = { ...DEFAULT_BINDS }; Object.assign(SETTINGS, { quality: 'high', master: 0.7, music: 0.45, sfx: 0.8, sens: 1, invertY: false, fov: 60, shake: true, damageNumbers: true }); afterSettingChange('quality'); buildSettings(); };
  $('dRise').onclick = () => riseAgain();
  $('eKeep').onclick = () => { enterPlay(); lockPointer(); };
  $('eTitle').onclick = () => showTitle();
  BUS.on('key', code => {
    if (BUS.rebinding) return;
    const is = a => SETTINGS.binds[a] === code;
    if (GAME.state === 'play' && !UI.dlg) {
      if (is('map') && typeof mapOpen === 'function') { GAME._suppressPause = true; GAME.state = 'map'; mapOpen(); setTimeout(() => GAME._suppressPause = false, 50); }
      else if (is('menu')) { GAME._suppressPause = true; openGrimoire(); setTimeout(() => GAME._suppressPause = false, 50); }
      else if (is('pause')) pauseGame();
    } else if (GAME.state === 'map' && (is('map') || is('pause'))) { mapClose(); GAME.state = 'play'; lockPointer(); }
    else if (GAME.state === 'paused' && is('pause')) resumeGame();
    else if (GAME.state === 'grimoire' && (is('menu') || is('pause'))) resumeGame();
    else if (GAME.state === 'settings' && is('pause')) closeSettings();
  });
}
