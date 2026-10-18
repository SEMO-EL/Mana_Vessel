/* ═══════════════════════════════════════════════════════════════════════
   INPUT — keyboard, mouse (pointer lock) and gamepad, mapped to actions.

   Bindings use KeyboardEvent.code — PHYSICAL key positions — so "WASD" is
   the same four keys on QWERTY, AZERTY (ZQSD) or QWERTZ without remapping.
   On-screen prompts show the layout's own label via getLayoutMap().
   Edges (pressed/released) live for exactly one simulation frame.
   ═══════════════════════════════════════════════════════════════════════ */
const DEFAULT_BINDS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', sprint: 'ShiftLeft', walk: 'KeyC',
  attack: 'Mouse0', cast: 'Mouse2', lock: 'KeyQ', guard: 'KeyF',
  interact: 'KeyE', map: 'KeyM', pause: 'Escape', menu: 'Tab',
  spell1: 'Digit1', spell2: 'Digit2', spell3: 'Digit3', spell4: 'Digit4', spell5: 'Digit5',
  style: 'KeyX', horse: 'KeyH', photo: 'KeyP', drink: 'KeyR',
};
const BIND_NAMES = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right',
  jump: 'Jump / Glide', sprint: 'Sprint (hold) · Dodge (tap)', walk: 'Walk toggle',
  attack: 'Sword', cast: 'Cast (tap: chantless · hold: incant)', lock: 'Lock on', guard: 'Guard / Parry',
  interact: 'Interact', map: 'Map', pause: 'Pause', menu: 'Grimoire',
  spell1: 'Spell 1', spell2: 'Spell 2', spell3: 'Spell 3', spell4: 'Spell 4', spell5: 'Spell 5',
  style: 'Swap staff / sword stance', horse: 'Whistle for your horse · mount', photo: 'Photo mode', drink: 'Drink a healing draught',
};
// Xbox layout (standard mapping): buttons[i]
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const PAD_BINDS = {
  jump: PAD.A, sprint: PAD.B, interact: PAD.X, attack: PAD.RB, cast: PAD.RT, guard: PAD.LB,
  lock: PAD.RS, map: PAD.BACK, pause: PAD.START, style: PAD.Y, menu: PAD.LT, horse: PAD.DOWN, drink: PAD.UP,
};

const IN = {
  keys: new Set(), prev: new Set(), edgesDown: new Set(), edgesUp: new Set(),
  lookX: 0, lookY: 0, moveX: 0, moveZ: 0, wheel: 0,
  locked: false, usingPad: false, layout: null,
  pad: { prev: [], axes: [0, 0, 0, 0] },

  down(a)     { return this.keys.has(SETTINGS.binds[a]) || this.padDown(a); },
  pressed(a)  { return this.edgesDown.has(SETTINGS.binds[a]) || this.padPressed(a); },
  released(a) { return this.edgesUp.has(SETTINGS.binds[a]) || this.padReleased(a); },

  padDown(a) { const b = PAD_BINDS[a], g = this.gp; return b !== undefined && !!g && !!g.buttons[b] && g.buttons[b].pressed; },
  padPressed(a) { const b = PAD_BINDS[a]; return b !== undefined && this.padDown(a) && !this.pad.prev[b]; },
  padReleased(a) { const b = PAD_BINDS[a], g = this.gp; return b !== undefined && !!g && !(g.buttons[b] && g.buttons[b].pressed) && !!this.pad.prev[b]; },

  // label for a binding in the player's own keyboard layout
  label(a) {
    const code = SETTINGS.binds[a];
    if (!code) return '—';
    if (code.startsWith('Mouse')) return ['LMB', 'MMB', 'RMB', 'M4', 'M5'][+code.slice(5)] || code;
    const m = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', Escape: 'Esc', Tab: 'Tab', Enter: 'Enter', AltLeft: 'Alt', Backspace: 'Bksp' };
    if (m[code]) return m[code];
    if (this.layout && this.layout.get(code)) return this.layout.get(code).toUpperCase();
    return code.replace(/^Key|^Digit/, '');
  },
};

function initInput() {
  if (!SETTINGS.binds) SETTINGS.binds = { ...DEFAULT_BINDS };
  for (const k in DEFAULT_BINDS) if (!SETTINGS.binds[k]) SETTINGS.binds[k] = DEFAULT_BINDS[k];
  if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
    navigator.keyboard.getLayoutMap().then(m => { IN.layout = m; BUS.emit('layout'); }).catch(() => {});
  }
  const press = code => { if (!IN.keys.has(code)) { IN.keys.add(code); IN.edgesDown.add(code); } IN.usingPad = false; };
  const lift = code => { if (IN.keys.has(code)) { IN.keys.delete(code); IN.edgesUp.add(code); } };

  addEventListener('keydown', e => {
    if (BUS.rebinding) { e.preventDefault(); BUS.emit('rebind', e.code); return; }
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    press(e.code);
    BUS.emit('key', e.code);
  });
  addEventListener('keyup', e => lift(e.code));
  canvas.addEventListener('mousedown', e => {
    if (BUS.rebinding) { e.preventDefault(); BUS.emit('rebind', 'Mouse' + e.button); return; }
    press('Mouse' + e.button);
    BUS.emit('canvasClick', e);
  });
  addEventListener('mouseup', e => lift('Mouse' + e.button));
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => {
    if (!IN.locked) return;
    // clamp one event's travel: some browsers deliver a huge jump on lock
    IN.lookX += clamp(e.movementX, -300, 300);
    IN.lookY += clamp(e.movementY, -300, 300);
  });
  addEventListener('wheel', e => { IN.wheel += Math.sign(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    IN.locked = document.pointerLockElement === canvas;
    BUS.emit('pointerlock', IN.locked);
  });
  // losing focus must not leave a key "held" forever
  addEventListener('blur', () => { for (const k of IN.keys) IN.edgesUp.add(k); IN.keys.clear(); });
}

function lockPointer() {
  if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => {});     // denied (e.g. no user gesture) — harmless
  }
}
function unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }

// Called once per frame BEFORE simulation.
function pollInput() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  IN.gp = null;
  for (const p of pads) if (p && p.connected) { IN.gp = p; break; }
  let mx = 0, mz = 0;
  if (IN.keys.has(SETTINGS.binds.forward)) mz -= 1;
  if (IN.keys.has(SETTINGS.binds.back)) mz += 1;
  if (IN.keys.has(SETTINGS.binds.left)) mx -= 1;
  if (IN.keys.has(SETTINGS.binds.right)) mx += 1;
  if (IN.gp) {
    const ax = IN.gp.axes;
    const dz = v => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;
    const lx = dz(ax[0] || 0), ly = dz(ax[1] || 0), rx = dz(ax[2] || 0), ry = dz(ax[3] || 0);
    if (lx || ly || rx || ry || IN.gp.buttons.some(b => b.pressed)) IN.usingPad = true;
    mx += lx; mz += ly;
    IN.lookX += rx * 14; IN.lookY += ry * 10;
  }
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  IN.moveX = mx; IN.moveZ = mz;
}
// Called once per frame AFTER simulation.
function endInputFrame() {
  IN.edgesDown.clear(); IN.edgesUp.clear();
  IN.lookX = 0; IN.lookY = 0; IN.wheel = 0;
  if (IN.gp) IN.pad.prev = IN.gp.buttons.map(b => b.pressed);
}
