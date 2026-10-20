/* ═══════════════════════════════════════════════════════════════════════
   CHAPTER III, END TO END — run after the synchronous self-tests.

   Plays the chapter the way a player would, minus the walking: faces the
   light from the terrace, rides out the dream, wakes Eris, kills two
   wolves, meets Ruijerd, arrives at the Migurd village, talks to the
   elder, rests by the fire, crosses the storm, wakes the Sand Mother and
   kills her — advancing every dialogue as it opens and letting every fade
   and card run on its own timers. Each step must reach its quest in time;
   the report names the step that didn't.
   ═══════════════════════════════════════════════════════════════════════ */
async function chapterThreeTest() {
  const out = { c3: [], c3ok: false }, step = s => out.c3.push(s);
  const frameMs = 33;
  // run the world until cond() (or give up): dialogue advanced as it comes, you kept alive
  const drive = async (cond, maxFrames = 2400) => {
    for (let i = 0; i < maxFrames; i++) {
      if (cond()) return true;
      if (UI.dlg) { advanceDialogue(); advanceDialogue(); }
      if (G) G.hp = G.maxHp;
      frame(1 / 30);
      await new Promise(r => setTimeout(r, frameMs));
    }
    return cond();
  };
  const place = (x, z, face = 0) => { placePlayerAt(x, groundAt(x, z, 999), z, face); setPlayerState('move'); };
  const was = GAME.skipRender; GAME.skipRender = true;
  try {
    // set the table: after the birthday, the light waiting, the gate open
    G.quest = 'done'; G.flags.gateOpen = true; G.flags.birthdayScene = true;
    resetWorldState(); GAME.state = 'play';
    const T = ROA.spots.terrace; place(T.x, T.z + 2);
    if (!OMEN.on || !OMEN.dim) return { ...out, c3fail: 'no waiting light' };
    step('omen');
    faceTheLight(false);
    if (!await drive(() => G.quest === 'dcWake' && !DCS.busy && PL.state === 'move', 4000)) return { ...out, c3fail: 'light → wake (' + G.quest + ')' };
    let silh = 0; PL.actor.root.traverse(o => { if (o.userData && o.userData.mat0) silh++; });
    if (!DEMON.built || !inDemon(PL.body.pos.z) || DREAM.on || silh || !NPCS.eris.visible) return { ...out, c3fail: 'wake state' };
    step('wake');
    dcTalkEris(NPCS.eris);
    if (!await drive(() => G.quest === 'dcSurvive' && !DCS.busy && DCS.wolves.length === 3)) return { ...out, c3fail: 'eris → wolves' };
    step('wolves');
    for (const w of DCS.wolves.slice(0, 2)) damageEnemy(w, 99999, {});
    if (!await drive(() => G.quest === 'dcMigurd' && !DCS.busy)) return { ...out, c3fail: 'ruijerd' };
    if (!ALLY.ruijerd || !ALLY.ruijerd.active || !ALLY.eris.active || DCS.wolves.some(w => !w.dead)) return { ...out, c3fail: 'party' };
    step('ruijerd');
    const M = DC_SPOTS.migurd; place(M.x + 45, M.z + 5, -Math.PI / 2);
    if (!await drive(() => G.quest === 'dcElder' && !MIG.busy)) return { ...out, c3fail: 'migurd arrival' };
    step('migurd');
    talkMigurdElder(NPCS.migElder);
    if (!await drive(() => G.quest === 'dcRest' && !MIG.busy)) return { ...out, c3fail: 'elder' };
    if (!G.flags.migurdCharm) return { ...out, c3fail: 'charm' };
    step('elder');
    migurdNight();
    if (!await drive(() => G.quest === 'dcStorm' && !MIG.busy, 3000)) return { ...out, c3fail: 'fire' };
    if (!G.flags.deadEnd || !ALLY.ruijerd.active || !ALLY.eris.active) return { ...out, c3fail: 'dead end' };
    step('deadEnd');
    place(1040, 1700);
    await drive(() => STORMF.said && (REGION.storm || 0) > 0.4, 400);
    if (!(WEATHER.tgt.rain > 0.9)) return { ...out, c3fail: 'storm weather' };
    step('storm');
    place(1160, 1742);
    if (!await drive(() => G.quest === 'dcNest', 300)) return { ...out, c3fail: 'storm crossing' };
    step('crossed');
    for (const e of [...ENT.enemies]) e.remove();
    place(1192, 1968);
    if (!await drive(() => G.quest === 'dcBoss' && ENT.enemies.some(e => e.key === 'sandMother' && e.aggro), 400)) return { ...out, c3fail: 'mother wake' };
    const m = ENT.enemies.find(e => e.key === 'sandMother');
    if (!await drive(() => !m.inactive && m.worm && m.worm.mode === 'up', 600)) return { ...out, c3fail: 'mother up' };
    damageEnemy(m, m.maxHp * 0.55, {});
    await drive(() => !!m.phase2, 200);
    if (!m.phase2) return { ...out, c3fail: 'phase two' };
    step('phase2');
    if (!await drive(() => !m.inactive && m.worm.mode === 'up', 900)) return { ...out, c3fail: 'mother up again' };
    damageEnemy(m, 999999, {});
    if (!await drive(() => GAME.state === 'end' && G.quest === 'dcDone', 1200)) return { ...out, c3fail: 'endcard (' + GAME.state + ', ' + G.quest + ')' };
    step('endcard');
    // the land and its sheet
    if (WSTONE.list.length < 11 || !(MAP.pages.demon || MAP.page === 'demon') || TER.chunks.length <= 836) return { ...out, c3fail: 'land/map' };
    // a save over here raises the waste at boot
    GAME.state = 'play'; saveGame(true);
    const s = loadGame(); localStorage.removeItem(SAVE_KEY);
    if (!s || s.quest !== 'dcDone' || !Array.isArray(s.pos) || !inDemon(s.pos[2])) return { ...out, c3fail: 'save' };
    step('save');
    out.c3ok = true;
    return out;
  } catch (e) { return { ...out, c3fail: 'threw: ' + (e.stack || e).toString().slice(0, 300) }; }
  finally { GAME.skipRender = was; }
}
