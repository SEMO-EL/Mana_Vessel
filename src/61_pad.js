/* ═══════════════════════════════════════════════════════════════════════
   THE CONTROLLER IN MENUS — START pauses (and resumes), BACK opens the map,
   LT the Grimoire; in any screen the d-pad or left stick walks a gold ring
   over its buttons, A presses, B backs out, left/right moves a slider or a
   choice. The keyboard and mouse never see the ring.
   ═══════════════════════════════════════════════════════════════════════ */
const PADUI = { scr: null, el: null, idx: 0, repeat: 0, armed: false };
// a button's press this frame (raw: menus want A and B, not what they're bound to in play)
const padHit = i => { const g = IN.gp; return !!(g && g.buttons[i] && g.buttons[i].pressed && !IN.pad.prev[i]); };
const padHeld = i => { const g = IN.gp; return !!(g && g.buttons[i] && g.buttons[i].pressed); };
const suppressPause = () => { GAME._suppressPause = true; setTimeout(() => GAME._suppressPause = false, 50); };

function padFocusClear() { for (const e of document.querySelectorAll('.padFocus')) e.classList.remove('padFocus'); PADUI.el = null; }
function updatePadUI(dt) {
  if (!IN.gp || !IN.usingPad) { if (PADUI.el) padFocusClear(); return; }
  const s = GAME.state;
  if (s === 'play' || s === 'rest' && !document.querySelector('.screen.on')) {
    if (UI.dlg || s !== 'play') return;
    if (padHit(PAD.START)) { pauseGame(); return; }
    if (padHit(PAD.BACK) && typeof mapOpen === 'function') { suppressPause(); GAME.state = 'map'; mapOpen(); return; }
    if (padHit(PAD.LT)) { suppressPause(); openGrimoire(); return; }
    return;
  }
  if (s === 'map') { if (padHit(PAD.BACK) || padHit(PAD.B) || padHit(PAD.START)) { mapClose(); GAME.state = 'play'; lockPointer(); } else padMap(dt); return; }
  if (s === 'paused' && padHit(PAD.START)) { resumeGame(); return; }
  if (s === 'grimoire' && padHit(PAD.LT)) { resumeGame(); return; }

  // a screen is up: the ring walks its buttons
  const scr = SCREENS.map(id => $(id)).find(el => el && el.classList.contains('on'));
  if (!scr) { if (PADUI.el) padFocusClear(); return; }
  const items = [...scr.querySelectorAll('button:not([disabled]), .chip, [data-attune], input[type=range], select')].filter(el => el.offsetParent !== null);
  if (!items.length) return;
  if (PADUI.scr !== scr) { PADUI.scr = scr; PADUI.idx = 0; PADUI.armed = false; }
  if (!items.includes(PADUI.el)) PADUI.el = items[Math.min(PADUI.idx, items.length - 1)];    // the screen redrew: keep the place
  // the A that opened this screen (or closed the talk before it) mustn't also press its first button
  if (!PADUI.armed) { if (!padHeld(PAD.A)) PADUI.armed = true; }
  const ay = (IN.gp.axes && IN.gp.axes[1]) || 0;
  let dir = padHit(PAD.UP) ? -1 : padHit(PAD.DOWN) ? 1 : 0;
  if (!dir && Math.abs(ay) > 0.6) { PADUI.repeat -= dt; if (PADUI.repeat <= 0) { dir = Math.sign(ay); PADUI.repeat = 0.2; } } else if (!dir) PADUI.repeat = 0;
  if (dir) {
    const i = items.indexOf(PADUI.el);
    PADUI.el = items[(i + dir + items.length) % items.length];
    PADUI.el.scrollIntoView({ block: 'nearest' });
    BUS.emit('sfx', { id: 'uiMove' });
  }
  const el = PADUI.el;
  PADUI.idx = items.indexOf(el);
  const lr = padHit(PAD.LEFT) ? -1 : padHit(PAD.RIGHT) ? 1 : 0;
  if (lr && el.tagName === 'INPUT') { el.value = +el.value + lr * (+el.step || 1); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  else if (lr && el.tagName === 'SELECT') { el.selectedIndex = clamp(el.selectedIndex + lr, 0, el.options.length - 1); el.dispatchEvent(new Event('change', { bubbles: true })); }
  for (const e of document.querySelectorAll('.padFocus')) if (e !== el) e.classList.remove('padFocus');
  el.classList.add('padFocus');
  if (PADUI.armed && padHit(PAD.A) && el.tagName !== 'INPUT' && el.tagName !== 'SELECT') { el.click(); return; }
  if (padHit(PAD.B)) {
    const back = items.find(b => /^(back|resume|close|leave)$/i.test(b.textContent.trim()));
    if (back) back.click(); else if (s === 'paused' || s === 'shop' || s === 'bounties') resumeGame();
  }
}
// The map on a controller: LB/RB (or the d-pad) step through the waystones you've woken
// and centre on one; A travels there; the left stick pans, the right stick zooms.
function padMap(dt) {
  if (typeof MAP === 'undefined' || !MAP.open || MAP.travelling) return;
  const V = MAP.view, ax = IN.gp.axes || [];
  const lx = Math.abs(ax[0] || 0) > 0.2 ? ax[0] : 0, ly = Math.abs(ax[1] || 0) > 0.2 ? ax[1] : 0, ry = Math.abs(ax[3] || 0) > 0.2 ? ax[3] : 0;
  if (lx || ly) { V.cx += lx * 420 * dt / V.zoom; V.cz += ly * 420 * dt / V.zoom; }
  if (ry && MAP.frame) {                      // zoom about the middle of the screen (the wheel zooms about the cursor)
    V.ax = V.cx; V.az = V.cz; V.sx = MAP.frame.vw / 2; V.sy = MAP.frame.vh / 2;
    V.tz = clamp(V.tz * (1 - ry * 1.6 * dt), MAP_ZOOM.min, MAP_ZOOM.max);
  }
  const step = padHit(PAD.RB) || padHit(PAD.RIGHT) ? 1 : padHit(PAD.LB) || padHit(PAD.LEFT) ? -1 : 0;
  if (step) {
    const woke = WSTONE.list.filter(W => G && G.waystones[W.id] && sameSide(W.z));
    if (woke.length) {
      const i = woke.indexOf(MAP.sel), W = woke[((i < 0 ? (step > 0 ? -1 : 0) : i) + step + woke.length) % woke.length];
      MAP.sel = W; V.cx = W.x; V.cz = W.z;
      $('mapTravelName').textContent = W.name;
      const why = typeof travelBlock === 'function' ? travelBlock() : null;
      $('mapTravel').classList.toggle('blocked', !!why); $('mapTravelWhy').textContent = why || '';
      BUS.emit('sfx', { id: 'uiSelect' });
    }
  }
  if (padHit(PAD.A) && MAP.sel) mapTravel();
}

// Rumble, for controllers that have it: a blow taken, a parry, a hard landing, a level gained
function rumble(strong, weak, ms) {
  const g = IN.gp, a = g && g.vibrationActuator;
  if (!a || !IN.usingPad || SETTINGS.rumble === false) return;
  try { a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) { /* not every pad, not every browser */ }
}
BUS.on('playerHurt', o => rumble(Math.min(1, 0.35 + (o && o.dmg || 0) / 60), 0.5, 160));
BUS.on('parry', () => rumble(0.2, 0.8, 110));
BUS.on('land', v => { if (v > 12) rumble(0.5, 0.3, 120); });
BUS.on('levelUp', () => rumble(0, 0.5, 260));
