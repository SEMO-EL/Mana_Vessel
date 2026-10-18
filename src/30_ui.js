/* ═══════════════════════════════════════════════════════════════════════
   UI — HUD, compass, floaters, dialogue, splashes, banners, toasts.
   DOM overlays over the canvas; world-anchored bits (damage numbers,
   enemy bars, the lock diamond) are projected from 3D every frame.
   ═══════════════════════════════════════════════════════════════════════ */
const UI = { calmT: 0, dlg: null, floaters: [], ebars: new Map(), hpLag: 1, bossLag: 1, boss: null, objective: null };

async function loadFonts() {
  const faces = [
    ['Cinzel', 'fonts/Cinzel-var.woff2', { weight: '400 900' }],
    ['Spectral', 'fonts/Spectral-400-normal.woff2', { weight: '400' }],
    ['Spectral', 'fonts/Spectral-600-normal.woff2', { weight: '600' }],
    ['Spectral', 'fonts/Spectral-400-italic.woff2', { weight: '400', style: 'italic' }],
  ];
  for (const [fam, file, desc] of faces) {
    try { const f = new FontFace(fam, assetBuffer(file), desc); await f.load(); document.fonts.add(f); }
    catch (e) { /* falls back to Georgia — never fatal */ }
  }
}

/* ───────────── toasts, hints, banners, splashes ───────────── */
function toast(text, cls = '') {
  const d = document.createElement('div');
  d.className = 'toast ' + cls; d.textContent = text;
  $('toasts').appendChild(d);
  setTimeout(() => d.remove(), 2700);
}
BUS.on('toast', o => { if (o.at) return floatText(o.at, o.text, o.cls); toast(o.text, o.cls); });
let _hintT = null;
function hint(text, sec = 3) {
  const h = $('hint'); h.textContent = text; h.classList.add('on');
  clearTimeout(_hintT); _hintT = setTimeout(() => h.classList.remove('on'), sec * 1000);
}
BUS.on('hint', t => hint(t, 2.5));
function banner(title, sub = '') {
  const b = $('banner');
  $('bannerTitle').textContent = title; $('bannerSub').textContent = sub;
  b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
}
BUS.on('place', p => { banner(p.name, p.sub || ''); BUS.emit('sfx', { id: 'discover' }); });
function splash(artKey, title, sub = '', ms = 4200) {
  return new Promise(res => {
    const el = $('splash'), im = $('splashImg');
    const src = window.ART && ART[artKey];
    if (src) { im.src = src; im.style.display = ''; } else im.style.display = 'none';
    $('splashTitle').textContent = title; $('splashSub').textContent = sub;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    setTimeout(() => { el.classList.remove('on'); res(); }, ms);
  });
}
function letterbox(on) { $('letterbox').classList.toggle('on', on); document.body.classList.toggle('lb', on); }
function bossCard(title, sub = '') {
  $('bcTitle').textContent = title; $('bcSub').textContent = sub;
  const b = $('bossCard'); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
}

/* ───────────── world-anchored floaters ───────────── */
const _proj = new THREE.Vector3();
function toScreen(p, out = { x: 0, y: 0, vis: false }) {
  _proj.copy(p).project(camera);
  out.vis = _proj.z < 1 && Math.abs(_proj.x) < 1.2 && Math.abs(_proj.y) < 1.2;
  out.x = (_proj.x * 0.5 + 0.5) * viewW; out.y = (-_proj.y * 0.5 + 0.5) * viewH;
  return out;
}
function floatText(pos, text, cls = '') {
  const el = document.createElement('div');
  el.className = 'num ' + cls; el.textContent = text;
  $('floaters').appendChild(el);
  UI.floaters.push({ el, pos: pos.clone(), t: 0, life: cls === 'crit' ? 1.3 : 1.0, vx: rnd(-0.5, 0.5) });
}
BUS.on('damageNumber', o => floatText(o.pos, String(o.value), o.crit ? 'crit' : o.blocked ? 'blk' : ''));
BUS.on('healNumber', v => floatText(PL.body.pos.clone().setY(PL.body.pos.y + 2.1), '+' + v, 'heal'));
const _sc = { x: 0, y: 0, vis: false };
function updateFloaters(dt) {
  for (let i = UI.floaters.length - 1; i >= 0; i--) {
    const f = UI.floaters[i];
    f.t += dt; f.pos.y += dt * 1.1; f.pos.x += f.vx * dt;
    toScreen(f.pos, _sc);
    const k = f.t / f.life;
    f.el.style.opacity = _sc.vis ? String(1 - smooth(0.6, 1, k)) : '0';
    f.el.style.transform = `translate(${_sc.x}px, ${_sc.y}px) translate(-50%,-50%) scale(${1 + (1 - smooth(0, 0.15, k)) * 0.5})`;
    if (f.t >= f.life) { f.el.remove(); UI.floaters.splice(i, 1); }
  }
  // enemy health bars: only for the hurt or the alerted, only nearby
  const seen = new Set();
  for (const e of ENT.enemies) {
    if (e.dead || e.def.boss || e.state === 'dormant') continue;
    const near = e.dist() < 28;
    const show = near && (e.hp < e.maxHp || (e.aggro && GAME.time - (e.alertT || -9) < 1.5));
    if (!show) continue;
    seen.add(e);
    let bar = UI.ebars.get(e);
    if (!bar) { bar = document.createElement('div'); bar.className = 'ebar'; bar.innerHTML = '<i></i>'; $('floaters').appendChild(bar); UI.ebars.set(e, bar); }
    toScreen(_proj.set(e.pos.x, e.pos.y + e.h + 0.45, e.pos.z), _sc);
    bar.style.display = _sc.vis ? '' : 'none';
    bar.style.transform = `translate(${_sc.x}px, ${_sc.y}px) translate(-50%,-50%)`;
    bar.firstChild.style.transform = `scaleX(${clamp(e.hp / e.maxHp, 0, 1)})`;
    bar.classList.toggle('alert', GAME.time - (e.alertT || -9) < 1.5);
  }
  for (const [e, bar] of UI.ebars) if (!seen.has(e)) { bar.remove(); UI.ebars.delete(e); }
  // lock-on diamond
  const lm = $('lockMark');
  if (CAM.lockTarget) {
    toScreen(CAM.lockTarget.lockPoint(), _sc);
    lm.classList.toggle('on', _sc.vis);
    lm.style.transform = `translate(${_sc.x}px, ${_sc.y}px) translate(-50%,-50%) rotate(${GAME.time * 60}deg)`;
  } else lm.classList.remove('on');
}
BUS.on('alert', e => { e.alertT = GAME.time; });

/* ───────────── the Vessel (signature HUD, ported from v2) ───────────── */
let _vesselFlash = 0;
BUS.on('vesselBreak', () => { _vesselFlash = 1; });
function drawVessel(time) {
  const cv = $('vessel'), V = cv.getContext('2d');
  V.setTransform(1, 0, 0, 1, 0, 0);
  V.clearRect(0, 0, cv.width, cv.height);
  const pct = clamp(G.mana / G.maxMana, 0, 1);
  const cx = 75, cy = 92, grow = 1 + Math.min(0.28, G.breaks * 0.035);
  const rw = 40 * grow, rh = 58 * grow;
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i / 8 * TAU, r = i % 2 ? 0.86 : 1; pts.push([cx + Math.cos(a) * rw * r, cy + Math.sin(a) * rh * r]); }
  const path = () => { V.beginPath(); pts.forEach((p, i) => i ? V.lineTo(p[0], p[1]) : V.moveTo(p[0], p[1])); V.closePath(); };
  V.save(); V.globalCompositeOperation = 'lighter';
  const og = V.createRadialGradient(cx, cy, rw * 0.4, cx, cy, rw * 2);
  og.addColorStop(0, `rgba(90,169,230,${0.2 * pct + (PL.state === 'collapse' ? 0.3 : 0)})`); og.addColorStop(1, 'rgba(90,169,230,0)');
  V.fillStyle = og; V.fillRect(0, 0, cv.width, cv.height); V.restore();
  path(); V.save(); V.clip();
  V.fillStyle = 'rgba(4,6,14,.9)'; V.fillRect(0, 0, cv.width, cv.height);
  const top = cy + rh - rh * 2 * pct;
  const g = V.createLinearGradient(0, top, 0, cy + rh);
  g.addColorStop(0, '#a8dfff'); g.addColorStop(0.35, '#5aa9e6'); g.addColorStop(1, '#153a63');
  V.fillStyle = g; V.beginPath(); V.moveTo(0, top);
  for (let x = 0; x <= cv.width; x += 6) V.lineTo(x, top + Math.sin(time * 3.3 + x / 22) * 2.6 + Math.sin(time * 5.9 + x / 11) * 1.1);
  V.lineTo(cv.width, cv.height); V.lineTo(0, cv.height); V.closePath(); V.fill();
  V.globalAlpha = 0.4; V.fillStyle = '#cfeaff';
  for (let i = 0; i < 6; i++) { const bx = cx - 26 + i * 11, by = cy + rh - ((time * 66 + i * 70) % 120); if (by > top + 6) { V.beginPath(); V.arc(bx, by, 1.5 + i % 2, 0, 7); V.fill(); } }
  V.globalAlpha = 1; V.restore();
  // cracks spread as it empties
  const crack = clamp((1 - pct) * 1.1, 0, 1) * (0.35 + 0.65 * Math.min(1, G.breaks / 4 + (1 - pct)));
  if (crack > 0.04) {
    V.strokeStyle = `rgba(240,207,98,${crack})`; V.lineWidth = 1.2;
    [[0.2, -0.9], [-0.6, 0.1], [0.7, 0.4], [-0.15, 0.8], [0.5, -0.35]].forEach(([sx, sy], k) => {
      if (k / 5 > (1 - pct) + G.breaks * 0.06) return;
      V.beginPath(); let px = cx + sx * rw * 0.9, py = cy + sy * rh * 0.9; V.moveTo(px, py);
      for (let j = 0; j < 4; j++) { px += Math.cos(k * 2.1 + j * 1.3) * 7; py += Math.sin(k * 1.7 + j * 0.9) * 9; V.lineTo(px, py); }
      V.stroke();
    });
  }
  if (_vesselFlash > 0) { V.globalAlpha = _vesselFlash; V.fillStyle = '#f0cf62'; path(); V.fill(); V.globalAlpha = 1; _vesselFlash -= 0.02; }
  path(); V.strokeStyle = PL.state === 'collapse' ? '#f0cf62' : 'rgba(201,162,39,.85)'; V.lineWidth = PL.state === 'collapse' ? 3.4 : 1.8; V.stroke();
  V.font = '700 13px Cinzel, Georgia'; V.textAlign = 'center';
  V.fillStyle = 'rgba(11,13,24,.8)'; V.fillRect(18, 162, 114, 20);
  V.fillStyle = '#8fd0ff'; V.fillText(Math.round(G.mana) + ' / ' + Math.round(G.maxMana), cx, 176);
  V.font = '700 8px Cinzel, Georgia'; V.fillStyle = 'rgba(201,162,39,.9)';
  V.fillText('BREAKS ' + G.breaks, cx, 12);
}

/* ───────────── spell bar ───────────── */
function sigil(school, c) {
  if (school === 'fire')  return `<path d="M12 3 C15 8 18 9 18 14 A6 6 0 0 1 6 14 C6 9 9 8 12 3Z" stroke="${c}" stroke-width="1.4" fill="none"/><circle cx="12" cy="15" r="2.4" fill="${c}"/>`;
  if (school === 'water') return `<path d="M12 3 C16 9 18 12 18 15 A6 6 0 0 1 6 15 C6 12 8 9 12 3Z" stroke="${c}" stroke-width="1.4" fill="none"/><path d="M9 15 h6" stroke="${c}" stroke-width="1.2"/>`;
  if (school === 'wind')  return `<path d="M3 9 h12 a3 3 0 1 0 -3 -3" stroke="${c}" stroke-width="1.4" fill="none"/><path d="M3 14 h14 a3 3 0 1 1 -3 3" stroke="${c}" stroke-width="1.4" fill="none"/>`;
  if (school === 'earth') return `<path d="M12 4 L20 18 H4 Z" stroke="${c}" stroke-width="1.4" fill="none"/><path d="M8 18 L12 11 L16 18" stroke="${c}" stroke-width="1.2" fill="none"/>`;
  return `<circle cx="12" cy="12" r="7" stroke="${c}" stroke-width="1.4" fill="none"/><path d="M12 8 v8 M8 12 h8" stroke="${c}" stroke-width="1.6"/>`;
}
function buildSpellBar() {
  const bar = $('spellBar'); bar.innerHTML = '';
  unlockedSpells().forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'slot';
    const col = SCHOOLS[s.school].col;
    d.innerHTML = `<div class="k">${i + 1}</div><svg viewBox="0 0 24 24">${sigil(s.school, col)}</svg><div class="nm">${s.name}</div><div class="c">${s.cost}</div><div class="cd" style="transform:scaleY(0)"></div>`;
    bar.appendChild(d);
  });
}
BUS.on('slot', () => { if (G) buildSpellBar(); });

/* ───────────── compass ───────────── */
const _cmPool = [];
function compassMarks() {
  const out = [];
  const cards = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  for (const [k, [x, z]] of Object.entries(cards)) out.push({ ang: Math.atan2(x, z), label: k, cls: 'card' });
  for (let i = 0; i < 24; i++) if (i % 6) { const a = i / 24 * TAU; out.push({ ang: a, label: '|', cls: 'tick' }); }
  const p = PL.body.pos;
  for (const W of WSTONE.list) if (G.waystones[W.id]) out.push({ ang: Math.atan2(W.x - p.x, W.z - p.z), label: '◈', cls: 'way', d: Math.hypot(W.x - p.x, W.z - p.z) });
  const q = typeof questMarker === 'function' ? questMarker() : null;
  if (q) out.push({ ang: Math.atan2(q.x - p.x, q.z - p.z), label: '◆', cls: 'quest' });
  const bm = typeof bountyMarker === 'function' ? bountyMarker() : null;
  if (bm) out.push({ ang: Math.atan2(bm.x - p.x, bm.z - p.z), label: '✦', cls: 'bounty' });
  for (const e of ENT.enemies) if (e.aggro && !e.dead && e.dist() < 40) out.push({ ang: e.angleToPlayer() + Math.PI, label: '•', cls: 'enemy' });
  return out;
}
function updateCompass() {
  const strip = $('compassStrip'), w = strip.clientWidth || 500;
  const facing = Math.atan2(-Math.sin(CAM.yaw), -Math.cos(CAM.yaw));   // camera heading as a world angle
  const marks = compassMarks();
  while (_cmPool.length < marks.length) { const s = document.createElement('span'); strip.appendChild(s); _cmPool.push(s); }
  _cmPool.forEach((el, i) => {
    const m = marks[i];
    if (!m) { el.style.display = 'none'; return; }
    const rel = wrapAngle(m.ang - facing);
    if (Math.abs(rel) > 1.35) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.className = 'cm ' + m.cls;
    el.textContent = m.label;
    el.style.left = (w / 2 + rel / 1.35 * w / 2) + 'px';
  });
}

/* ───────────── dialogue ───────────── */
// A second say() while one is open waits its turn (a burn tick can finish a
// quest enemy mid-conversation) instead of replacing it and stranding its promise.
const _dlgQueue = [];
function say(lines, opts = {}) {
  return new Promise(resolve => {
    if (UI.dlg) _dlgQueue.push({ lines, opts, resolve }); else openDialogue(lines, opts, resolve);
  });
}
function openDialogue(lines, opts, resolve) {
  UI.dlg = { lines, i: 0, shown: 0, resolve, opts, t: 0, openFrame: GAME.frame };
  $('dialogue').classList.add('on');
  letterbox(true);
  $('hud').classList.add('off');
  if (G && PL.state !== 'dead') { UI.dlg.prevState = PL.state; setPlayerState('talk'); PL.actor.setUpper(null); PL.actor.loop('Idle', { fade: 0.3 }); }
  showLine();
}
function showLine() {
  const d = UI.dlg, L = d.lines[d.i];
  $('dlgName').textContent = L.s || '';
  $('dlgText').textContent = '';
  d.shown = 0; d.t = 0;
  const src = L.p && window.ART ? ART[L.p] : null;
  $('dlgPortrait').classList.toggle('on', !!src);
  if (src) $('dlgImg').src = src;
  if (L.cam) CAM.override = L.cam; else if (d.opts.cam) CAM.override = d.opts.cam;
  if (L.onShow) L.onShow();
  BUS.emit('sfx', { id: 'page' });
}
function advanceDialogue() {
  const d = UI.dlg; if (!d) return;
  const L = d.lines[d.i];
  if (d.shown < L.t.length) { d.shown = L.t.length; $('dlgText').textContent = L.t; return; }
  d.i++;
  if (d.i >= d.lines.length) {
    $('dialogue').classList.remove('on');
    letterbox(false);
    CAM.override = null;
    if (GAME.state === 'play') $('hud').classList.remove('off');
    UI.dlg = null;
    if (G && PL.state === 'talk') setPlayerState('move');
    d.resolve();
    const next = _dlgQueue.shift();
    if (next) openDialogue(next.lines, next.opts, next.resolve);
  } else showLine();
}
function updateDialogue(dt) {
  const d = UI.dlg; if (!d) return;
  if (GAME.frame === d.openFrame) return;   // the key that opened the talk must not also skip its first line
  const L = d.lines[d.i];
  if (d.shown < L.t.length) {
    d.t += dt;
    const n = Math.min(L.t.length, Math.floor(d.t * 52));
    if (n !== d.shown) { d.shown = n; $('dlgText').textContent = L.t.slice(0, n); }
  }
  if (IN.pressed('interact') || IN.pressed('jump') || IN.edgesDown.has('Enter') || IN.edgesDown.has('Mouse0')) advanceDialogue();
}
$('dlgBox').addEventListener('click', () => advanceDialogue());
// A two-shot from the side: both faces visible, the speaker nearer frame
// centre, and both sitting in the upper half (the dialogue box owns the bottom).
// Picks whichever side of the pair has more open ground, so a wall or tree
// isn't between the lens and the conversation.
function talkCam(target) {
  const p = PL.body.pos, t = target;
  const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz) || 1;
  const nx = dx / d, nz = dz / d;
  const mx = p.x + dx * 0.6, mz = p.z + dz * 0.6;
  let best = null, bestClear = -1;
  for (const s of [1, -1]) {
    const sx = -nz * s, sz = nx * s;
    const pos = new THREE.Vector3(mx + sx * 3.6 - nx * 1.2, Math.max(p.y, t.y) + 1.75, mz + sz * 3.6 - nz * 1.2);
    pos.y = Math.max(pos.y, floorAt(pos.x, pos.z) + 1.2);
    const look = new THREE.Vector3(mx, (p.y + t.y) / 2 + 0.55, mz);
    const dir = look.clone().sub(pos); const len = dir.length(); dir.divideScalar(len);
    const clear = Math.min(raycastWorld(pos, dir, len), len);
    if (clear > bestClear) { bestClear = clear; best = { pos, look, fov: 40 }; }
  }
  return best;
}

/* ───────────── per-frame HUD ───────────── */
function updateHUD(dt, time) {
  if (!G) return;
  $('whoName').textContent = G.name;
  $('whoLvl').textContent = 'Lv ' + G.lvl;
  $('whoRank').textContent = 'Rank ' + guildRank(G.lvl);
  const hp = clamp(G.hp / G.maxHp, 0, 1);
  $('hpFill').style.transform = `scaleX(${hp})`;
  UI.hpLag = hp > UI.hpLag ? hp : damp(UI.hpLag, hp, 2.2, dt);
  $('hpLag').style.transform = `scaleX(${UI.hpLag})`;
  $('stFill').style.transform = `scaleX(${clamp(G.stamina / G.maxStamina, 0, 1)})`;
  $('xpFill').style.transform = `scaleX(${clamp(G.xp / G.xpNext, 0, 1)})`;
  // widths grow with the stats, like a Souls bar
  document.querySelector('.bar.hp').style.width = (200 + G.maxHp * 0.6) + 'px';
  document.querySelector('.bar.st').style.width = (170 + G.maxStamina * 0.5) + 'px';
  drawVessel(time);
  const spells = unlockedSpells(), slots = $('spellBar').children;
  if (slots.length !== spells.length) buildSpellBar();
  for (let i = 0; i < slots.length; i++) {
    const s = spells[i]; if (!s) continue;
    slots[i].classList.toggle('on', i === PL.slotIdx);
    slots[i].classList.toggle('poor', G.mana < s.cost * CHANT.incantCost);
    const cd = Math.max(0, G.cds[s.id] || 0);
    slots[i].lastChild.style.transform = `scaleY(${cd / s.cd})`;
  }
  const cm = $('chantMeter');
  cm.classList.toggle('on', !!PL.chanting);
  if (PL.chanting) { const k = Math.min(1, PL.chantT / CHANT.need); cm.firstChild.style.width = (k * 100) + '%'; cm.classList.toggle('ready', k >= 1); cm.lastChild.textContent = k >= 1 ? 'Incanted' : 'Incanting'; }
  $('reticle').classList.toggle('on', !!PL.chanting && !CAM.lockTarget);
  $('styleName').textContent = STYLES[G.style].name;
  const it = PL.interactTarget;
  $('prompt').classList.toggle('on', !!it && !UI.dlg);
  if (it) { $('promptKey').textContent = IN.usingPad ? 'X' : IN.label('interact'); $('promptText').textContent = it.label(); }
  // boss bar
  const boss = ENT.enemies.find(e => e.def.boss && e.aggro && !e.dead && e.dist() < 60);
  if (boss) {
    $('bossBar').classList.add('on'); $('bossName').textContent = boss.def.name;
    const bp = clamp(boss.hp / boss.maxHp, 0, 1);
    $('bossFill').style.transform = `scaleX(${bp})`;
    UI.bossLag = bp > UI.bossLag ? bp : damp(UI.bossLag, bp, 1.6, dt);
    $('bossLag').style.transform = `scaleX(${UI.bossLag})`;
  } else { $('bossBar').classList.remove('on'); UI.bossLag = 1; }
  // calm HUD: fade the busy bits when nothing is happening
  const busy = PL.chanting || ENT.enemies.some(e => e.aggro && !e.dead) || GAME.time - PL.lastHitT < 5 || G.hp < G.maxHp * 0.99;
  UI.calmT = busy ? 0 : UI.calmT + dt;
  $('hud').classList.toggle('calm', UI.calmT > 6);
  updateCompass();
  updateFloaters(dt);
  const obj = typeof currentObjective === 'function' ? currentObjective() : null;
  if (obj) { $('objTitle').textContent = obj.title; $('objText').textContent = obj.text; $('objective').style.opacity = UI.calmT > 12 ? 0.35 : 0.9; }
  else $('objective').style.opacity = 0;
  $('keyHints').innerHTML = IN.usingPad ? '' : `${IN.label('lock')} lock · ${IN.label('map')} map · ${IN.label('pause')} pause`;
}

/* screen flash (vessel break, meteor): pushes a colour through the grade pass */
let _flash = { a: 0, col: new THREE.Color() };
BUS.on('flash', o => { _flash.a = o.a; _flash.col.set(o.col); });
BUS.on('playerHurt', () => { _flash.a = Math.max(_flash.a, 0.18); _flash.col.set('#8b2635'); });
function updateFlash(dt) {
  if (!gradePass) return;
  _flash.a = Math.max(0, _flash.a - dt * 1.6);
  gradePass.uniforms.uFlash.value.set(_flash.col.r, _flash.col.g, _flash.col.b, _flash.a);
  const collapse = G && PL.state === 'collapse' ? 0.7 : G && PL.state === 'dead' ? 0.9 : 0;
  gradePass.uniforms.uDesat.value = damp(gradePass.uniforms.uDesat.value, collapse, 3, dt);
}

/* ───────────── barks ───────────── */
// A companion's line: speaker in their colour, text in italics, gone in a few seconds.
let _barkT = null;
function bark(who, text, col = '#e6dcc2') {
  const el = $('bark');
  $('barkName').textContent = who; $('barkName').style.color = col;
  $('barkText').textContent = text;
  el.classList.add('on');
  clearTimeout(_barkT);
  _barkT = setTimeout(() => el.classList.remove('on'), 1800 + text.length * 45);
  BUS.emit('sfx', { id: 'uiMove' });
}
