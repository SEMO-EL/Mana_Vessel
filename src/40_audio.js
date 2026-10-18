/* ═══════════════════════════════════════════════════════════════════════
   AUDIO — fully synthesised. No files, no network: every sound is a few
   oscillators and ONE shared loop of white noise pushed through filters.
   Ported from v2 (auInit / tone / nz / sfx / MOOD) and extended for 3D.

   Graph:
     one-shots ─┬─ sfx ────────────────────────┐
     beds ──────┼─ ambience ───────────────────┼─ master ─ compressor ─ out
     region ────┴─ explore ─┐                  │
     combat ────── combat ──┼─ duck ─ music ───┘
     echo (feedback delay) ─┘
   `duck` dips the music under tells and stingers; `explore` dips the
   region layer while the combat layer plays.

   Public:  initAudio()      arm the gesture listener / create the context
            auVolumes()      apply SETTINGS.master / music / sfx
            updateAudio(dt)  listener, footsteps, ambience, adaptive music
   Sounds are requested on the BUS: 'sfx' { id, pos?, heavy?, incanted? }
   plus a few game events (see the bottom). Anything with `pos` goes
   through its own HRTF panner; everything else plays 2D.

   Rules:
     · nothing is scheduled until the context is RUNNING (click / key)
     · every voice stops itself and disconnects its nodes on 'ended'
     · no setTimeout / setInterval — phrases are scheduled on the audio
       clock, rhythms with a short look-ahead from updateAudio
     · audio must never take the game down: handlers are try/caught
   ═══════════════════════════════════════════════════════════════════════ */
const AUDIO_MAX_VOICES = 24;           // concurrent one-shot sfx voices (priority sounds get +8)
const AUDIO_NOISE_SEC = 3;             // length of the one shared noise loop
const AUDIO_MIX = { music: 0.5, sfx: 0.62, amb: 0.55 };   // bus trims under the settings sliders
const AUDIO_STRIDE_WALK = 0.9, AUDIO_STRIDE_SPRINT = 1.4; // metres per footstep
const AUDIO_GESTURES = ['pointerdown', 'keydown', 'pointerup', 'touchend'];
const AUDIO_NOOPT = {};
const AUDIO_TMP = new THREE.Vector3(), AUDIO_FWD = new THREE.Vector3(), AUDIO_UP = new THREE.Vector3();

const AUDIO = {
  ctx: null, dead: false, armed: false, onGesture: null, hidden: false, warned: false,
  master: null, comp: null, sfx: null, amb: null, music: null, duck: null, explore: null, combat: null,
  echoIn: null, caveIn: null, noiseBuf: null, cbDest: null,
  voices: 0, last: {}, learned: false, volv: [-1, -1, -1], tick: 0, clock: 0,
  duckUntil: 0, duckAmt: 1,
  glide: null,
  step: { init: false, x: 0, z: 0, acc: 0 },
  beds: null, bedList: [], birdT: 2, dripT: 1,
  mus: { region: null, layer: null, dying: [] },
  cb: { lvl: 0, hold: 0, boss: false, wantBoss: false, next: 0, i: 0 },
};

/* ───────────── context: created / resumed only after a user gesture ───────────── */
function initAudio() {
  if (AUDIO.dead) return;
  if (AUDIO.ctx) { if (AUDIO.ctx.state !== 'running') auArm(); return; }
  // sticky activation already happened (e.g. called from a click): start now
  const ua = navigator.userActivation;
  if (ua && ua.hasBeenActive) { auCreate(); auResume(); }
  if (!AUDIO.ctx || AUDIO.ctx.state !== 'running') auArm();
}
function auArm() {
  if (AUDIO.armed || AUDIO.dead) return;
  AUDIO.armed = true;
  AUDIO.onGesture = () => {
    if (!AUDIO.ctx) auCreate();
    if (!AUDIO.ctx) { auDisarm(); return; }
    auResume();
  };
  for (const ev of AUDIO_GESTURES) addEventListener(ev, AUDIO.onGesture, true);
}
function auDisarm() {
  if (!AUDIO.armed) return;
  for (const ev of AUDIO_GESTURES) removeEventListener(ev, AUDIO.onGesture, true);
  AUDIO.armed = false; AUDIO.onGesture = null;
}
// keep listening until the context really is running (some events don't count as activation)
function auResume() {
  const c = AUDIO.ctx;
  if (!c) return;
  if (c.state === 'running') { auDisarm(); return; }
  try {
    const p = c.resume();
    if (p && p.then) p.then(() => { if (c.state === 'running') auDisarm(); }).catch(() => {});
  } catch (e) { /* not allowed yet — the next gesture tries again */ }
}
function auOnVisibility() {
  const c = AUDIO.ctx;
  if (!c) return;
  if (document.hidden) { if (c.state === 'running') { AUDIO.hidden = true; c.suspend().catch(() => {}); } }
  else if (AUDIO.hidden) { AUDIO.hidden = false; auResume(); }
}

function auCreate() {
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) { AUDIO.dead = true; return; }
  let c;
  try { c = new C({ latencyHint: 'interactive' }); }
  catch (e) { try { c = new C(); } catch (e2) { AUDIO.dead = true; return; } }
  AUDIO.ctx = c;
  // the one noise loop everything shares
  const n = Math.round(c.sampleRate * AUDIO_NOISE_SEC), buf = c.createBuffer(1, n, c.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
  AUDIO.noiseBuf = buf;

  const gain = (v, to) => { const g = c.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const comp = AUDIO.comp = c.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5;
  comp.attack.value = 0.004; comp.release.value = 0.22;
  comp.connect(c.destination);
  AUDIO.master = gain(0, comp);
  AUDIO.sfx = gain(0, AUDIO.master);
  AUDIO.amb = gain(0, AUDIO.master);
  AUDIO.music = gain(0, AUDIO.master);
  AUDIO.duck = gain(1, AUDIO.music);
  AUDIO.explore = gain(1, AUDIO.duck);
  AUDIO.combat = gain(0, AUDIO.duck);
  AUDIO.cbDest = { node: AUDIO.combat, pan: null, live: 0, cap: 0 };

  // music echo: a soft feedback delay that gives the sparse melody some air
  AUDIO.echoIn = auEcho(0.46, 0.34, 1800, 0.5, AUDIO.duck);
  // cave: drips go direct AND into a longer, wetter echo
  AUDIO.caveIn = gain(1, AUDIO.amb);
  AUDIO.caveIn.connect(auEcho(0.37, 0.5, 2000, 0.55, AUDIO.amb));

  auBuildBeds();
  auVolumes();
  document.addEventListener('visibilitychange', auOnVisibility);
}
// in → delay ⟲ (lowpass · feedback) → wet → out.  Returns the input node.
function auEcho(time, feedback, cut, wetAmt, out) {
  const c = AUDIO.ctx;
  const inp = c.createGain(), dl = c.createDelay(1.5), lp = c.createBiquadFilter(), fb = c.createGain(), wet = c.createGain();
  dl.delayTime.value = time; lp.type = 'lowpass'; lp.frequency.value = cut; fb.gain.value = feedback; wet.gain.value = wetAmt;
  inp.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(out);
  return inp;
}

function auVolumes() {
  const c = AUDIO.ctx;
  if (!c || !AUDIO.master) return;
  const t = c.currentTime;
  const m = clamp(+SETTINGS.master || 0, 0, 1), mu = clamp(+SETTINGS.music || 0, 0, 1), s = clamp(+SETTINGS.sfx || 0, 0, 1);
  AUDIO.master.gain.setTargetAtTime(m, t, 0.03);
  AUDIO.music.gain.setTargetAtTime(mu * AUDIO_MIX.music, t, 0.03);
  AUDIO.sfx.gain.setTargetAtTime(s * AUDIO_MIX.sfx, t, 0.03);
  AUDIO.amb.gain.setTargetAtTime(s * AUDIO_MIX.amb, t, 0.03);    // ambience follows the sfx slider
  const v = AUDIO.volv; v[0] = SETTINGS.master; v[1] = SETTINGS.music; v[2] = SETTINGS.sfx;
}
function auSyncVolumes() {
  const v = AUDIO.volv;
  if (v[0] !== SETTINGS.master || v[1] !== SETTINGS.music || v[2] !== SETTINGS.sfx) auVolumes();
}

/* ───────────── voices ─────────────
   A "dest" is where one sound goes: a bus, optionally through a fresh
   HRTF panner. Voices check in and out; the panner is released when the
   last one ends. cap: 0 = uncapped (music, beds), 1 = sfx, 2 = priority. */
const auReady = () => !!AUDIO.ctx && AUDIO.ctx.state === 'running';
const auVar = (x, amt = 0.06) => x * (1 + (Math.random() * 2 - 1) * amt);     // so repeats never match
function auPlace(node, x, y, z) {
  if (node.positionX) { node.positionX.value = x; node.positionY.value = y; node.positionZ.value = z; }
  else node.setPosition(x, y, z);
}
function auSet(param, v, tc = 0.08) { param.setTargetAtTime(v, AUDIO.ctx.currentTime, tc); }
function auDest(bus, pos = null, ref = 4, cap = 1) {
  const d = { node: bus, pan: null, live: 0, cap };
  if (pos) {
    const p = AUDIO.ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = ref; p.maxDistance = 80; p.rolloffFactor = 1.2;
    auPlace(p, pos.x, pos.y, pos.z);
    p.connect(bus);
    d.node = d.pan = p;
  }
  return d;
}
function auRelease(d) { if (d.pan && d.live <= 0) { d.pan.disconnect(); d.pan = null; } }
function auVoiceOK(d) { return !d.cap || AUDIO.voices < AUDIO_MAX_VOICES + (d.cap > 1 ? 8 : 0); }
function auTrack(d, src, nodes) {
  const counted = !!d.cap;
  if (counted) AUDIO.voices++;
  d.live++;
  src.onended = () => {
    if (counted) AUDIO.voices--;
    for (const n of nodes) n.disconnect();
    d.live--; auRelease(d);
  };
}
// attack → optional hold → exponential release
function auEnv(p, t, vol, atk, hold, dur) {
  atk = clamp(atk, 0.002, dur * 0.9);
  hold = Math.min(Math.max(hold, atk), dur * 0.95);
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(vol, t + atk);
  if (hold > atk) p.setValueAtTime(vol, t + hold);
  p.exponentialRampToValueAtTime(0.0001, t + dur);
}
/* One enveloped oscillator, f0→f1 exponential glide (f1 = 0: hold pitch).
   o: { at delay, atk, hold, lp / lp1 lowpass sweep, q, det cents, vib [Hz, depthHz], send } */
function auTone(d, type, f0, f1, dur, vol, o = AUDIO_NOOPT) {
  if (!(vol > 0) || !auVoiceOK(d)) return null;
  const c = AUDIO.ctx, t = c.currentTime + (o.at || 0);
  const osc = c.createOscillator(), g = c.createGain(), nodes = [osc, g];
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  if (o.det) osc.detune.value = o.det;
  let head = osc;
  if (o.lp) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = o.q ?? 0.7;
    f.frequency.setValueAtTime(o.lp, t);
    if (o.lp1) f.frequency.exponentialRampToValueAtTime(o.lp1, t + dur);
    osc.connect(f); head = f; nodes.push(f);
  }
  if (o.vib) {
    const l = c.createOscillator(), lg = c.createGain();
    l.frequency.value = o.vib[0];
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib[1], t + dur * 0.5);
    l.connect(lg); lg.connect(osc.frequency);
    l.start(t); l.stop(t + dur + 0.05);
    nodes.push(l, lg);
  }
  auEnv(g.gain, t, vol, o.atk ?? Math.min(0.012, dur * 0.2), o.hold || 0, dur);
  head.connect(g); g.connect(d.node);
  if (o.send) g.connect(o.send);
  osc.start(t); osc.stop(t + dur + 0.05);
  auTrack(d, osc, nodes);
  return osc;
}
// Filtered noise burst from the shared loop, filter swept f0→f1.
function auNz(d, dur, vol, f0, f1, type = 'bandpass', q = 1.1, o = AUDIO_NOOPT) {
  if (!(vol > 0) || !auVoiceOK(d)) return null;
  const c = AUDIO.ctx, t = c.currentTime + (o.at || 0);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = AUDIO.noiseBuf; s.loop = true;
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  auEnv(g.gain, t, vol, o.atk ?? 0.01, o.hold || 0, dur);
  s.connect(f); f.connect(g); g.connect(d.node);
  if (o.send) g.connect(o.send);
  s.start(t, Math.random() * (AUDIO_NOISE_SEC - 0.5)); s.stop(t + dur + 0.05);
  auTrack(d, s, [s, f, g]);
  return s;
}
// Throaty growl: a lowpassed saw, amplitude-chopped by a fast square LFO.
function auGrowl(d, f0, f1, dur, vol, rate = 26, o = AUDIO_NOOPT) {
  if (!(vol > 0) || !auVoiceOK(d)) return null;
  const c = AUDIO.ctx, t = c.currentTime + (o.at || 0);
  const osc = c.createOscillator(), lp = c.createBiquadFilter(), am = c.createGain();
  const lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  lp.type = 'lowpass'; lp.frequency.value = 720; lp.Q.value = 2;
  am.gain.value = 0.55; lfo.type = 'square'; lfo.frequency.value = rate; lg.gain.value = 0.45;
  lfo.connect(lg); lg.connect(am.gain);
  auEnv(g.gain, t, vol, 0.04, dur * 0.5, dur);
  osc.connect(lp); lp.connect(am); am.connect(g); g.connect(d.node);
  osc.start(t); lfo.start(t); osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  auTrack(d, osc, [osc, lp, am, lfo, lg, g]);
  return osc;
}
// multi-point pitch contour on an already-started tone: pts = [[seconds, Hz], ...]
function auContour(param, t, pts, mul = 1) { for (const [dt, f] of pts) param.exponentialRampToValueAtTime(f * mul, t + dt); }
// dip the music for a moment so a tell or a stinger reads clearly
function auDuck(to, hold) {
  const t = AUDIO.ctx.currentTime, g = AUDIO.duck.gain;
  if (t < AUDIO.duckUntil && to >= AUDIO.duckAmt) return;      // a deeper duck is already running
  AUDIO.duckUntil = t + hold; AUDIO.duckAmt = to;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.linearRampToValueAtTime(to, t + 0.04);
  g.setTargetAtTime(1, t + hold, 0.35);
}

/* ───────────── the sound book ─────────────
   (d, e) → schedule voices into dest d. e = the BUS payload. */
const AUDIO_SFX = {
  /* movement */
  jump: d => {
    auNz(d, 0.14, 0.1, auVar(550), 1500, 'bandpass', 1, { atk: 0.03 });
    auTone(d, 'sine', 170, 85, 0.08, 0.1);
  },
  dodge: d => {                                                        // v2 'dash' + cloth
    auNz(d, 0.18, 0.2, auVar(2400), 400, 'bandpass', 1.1, { atk: 0.02 });
    auNz(d, 0.24, 0.08, 900, 450, 'lowpass', 0.7, { at: 0.03 });
  },
  /* steel */
  swing: (d, e) => {
    if (e.heavy) {
      auNz(d, 0.28, 0.3, auVar(1900), 240, 'bandpass', 1, { atk: 0.09 });
      auTone(d, 'sine', 150, 60, 0.24, 0.08, { atk: 0.06 });
    } else auNz(d, 0.14, 0.27, auVar(3400, 0.1), 700, 'bandpass', 1.4, { atk: 0.03 });
  },
  hit: (d, e) => {
    const k = auVar(e.heavy ? 0.72 : 1, 0.07);
    auNz(d, 0.1, 0.32, 900 * k, 180 * k, 'bandpass', 1.2);
    auTone(d, 'square', 220 * k, 90 * k, 0.09, 0.12, { lp: 2400 });
    auTone(d, 'sine', 130 * k, 50, 0.13, 0.2);
  },
  crit: d => {
    auNz(d, 0.14, 0.36, 1100, 150, 'bandpass', 1.1);
    auTone(d, 'square', 260, 80, 0.12, 0.13, { lp: 2600 });
    auTone(d, 'sine', 95, 34, 0.3, 0.3);
    auTone(d, 'triangle', 1650, 1240, 0.32, 0.08);
    auNz(d, 0.22, 0.14, 3200, 700, 'bandpass', 1.6, { at: 0.02 });
  },
  block: d => {
    auNz(d, 0.12, 0.26, auVar(2200), 600, 'bandpass', 2.4);
    auTone(d, 'square', 520, 320, 0.1, 0.1, { lp: 3000 });
    auTone(d, 'triangle', auVar(1250, 0.03), 1180, 0.22, 0.05);
  },
  parry: d => {
    auTone(d, 'sine', 1760, 2640, 0.22, 0.2);
    auTone(d, 'square', 880, 1320, 0.14, 0.07, { lp: 4000 });
    auNz(d, 0.1, 0.2, 4000, 1500, 'bandpass', 3);
    auTone(d, 'sine', 2637, 0, 0.6, 0.06, { at: 0.03, hold: 0.1 });   // the ring that says "now"
  },
  stagger: d => {
    auTone(d, 'square', 420, 140, 0.3, 0.09, { lp: 1500 });
    auTone(d, 'triangle', 840, 300, 0.22, 0.05);
    auNz(d, 0.26, 0.22, 1500, 250, 'bandpass', 1);
    auTone(d, 'sine', 1320, 990, 0.35, 0.03, { at: 0.08, vib: [11, 40] });
  },
  hurt: d => {                                                         // v2 'phurt'
    auTone(d, 'sawtooth', 180, 60, 0.26, 0.22, { lp: 1800 });
    auNz(d, 0.2, 0.24, 700, 140, 'lowpass', 1);
    auTone(d, 'sine', 120, 48, 0.14, 0.16);
  },
  lock: d => { auTone(d, 'triangle', 880, 1320, 0.07, 0.07); auTone(d, 'sine', 1760, 0, 0.06, 0.03, { at: 0.04 }); },
  unlock: d => auTone(d, 'triangle', 1100, 700, 0.08, 0.05),          // lock-on released
  learn: d => {                                                        // v2 'unlock' chime: a spell learned
    [659, 988].forEach((f, i) => auTone(d, 'sine', f, 0, 0.42, 0.13, { at: i * 0.13, hold: 0.08 }));
    auTone(d, 'sine', 1976, 0, 0.5, 0.025, { at: 0.26 });
    auDuck(0.5, 0.8);
  },
  chantBreak: d => {
    auTone(d, 'sawtooth', 620, 150, 0.25, 0.09, { lp: 2000, lp1: 400 });
    auNz(d, 0.18, 0.18, 3800, 900, 'bandpass', 2);
    auTone(d, 'triangle', 1320, 660, 0.12, 0.05);
  },
  /* casting (v2 voices; incanted = fuller and longer) */
  cast_fire: (d, e) => {
    const L = e.incanted ? 1.5 : 1;
    auNz(d, 0.34 * L, 0.3, 900, 180, 'bandpass', 0.8);
    auTone(d, 'sawtooth', 300, 90, 0.3 * L, 0.12, { lp: 2200 });
    if (e.incanted) { auTone(d, 'sine', 110, 45, 0.55, 0.2, { atk: 0.03 }); auNz(d, 0.7, 0.14, 500, 140, 'lowpass', 0.8, { atk: 0.1 }); }
  },
  cast_water: (d, e) => {
    const L = e.incanted ? 1.6 : 1;
    auTone(d, 'sine', 420, 900, 0.26 * L, 0.18);
    auTone(d, 'triangle', 210, 450, 0.26 * L, 0.09);
    if (e.incanted) for (let i = 0; i < 4; i++) { const f = rnd(500, 900); auTone(d, 'sine', f, f * 1.7, 0.07, 0.05, { at: 0.08 + i * 0.07 }); }
  },
  cast_wind: (d, e) => {
    auNz(d, 0.2, 0.26, 600, 3200, 'bandpass', 1.6);
    if (e.incanted) { auNz(d, 0.5, 0.18, 300, 2400, 'bandpass', 1, { atk: 0.12 }); auTone(d, 'sine', 900, 1900, 0.45, 0.03, { atk: 0.15 }); }
  },
  cast_earth: (d, e) => {
    auTone(d, 'square', 140, 52, 0.3, 0.18, { lp: 900 });
    auNz(d, 0.16, 0.16, 320, 120, 'lowpass', 1);
    if (e.incanted) { auTone(d, 'sine', 72, 32, 0.55, 0.26); auNz(d, 0.45, 0.12, 200, 520, 'bandpass', 2, { at: 0.05 }); }
  },
  cast_heal: (d, e) => {
    const L = e.incanted ? 1.6 : 1;
    auTone(d, 'triangle', 523, 784, 0.42 * L, 0.12);
    auTone(d, 'sine', 784, 1046, 0.42 * L, 0.07);
    if (e.incanted) { auTone(d, 'sine', 1318, 1568, 0.8, 0.045, { at: 0.12, hold: 0.25 }); auNz(d, 0.9, 0.04, 4000, 8000, 'bandpass', 3, { atk: 0.3 }); }
  },
  /* impacts */
  impact_fire: d => {
    auNz(d, 0.42, 0.34, 1400, 150, 'lowpass', 0.8);
    auTone(d, 'sawtooth', 160, 48, 0.3, 0.12, { lp: 1200 });
    for (let i = 0; i < 3; i++) auNz(d, 0.03, 0.12, rnd(2000, 4500), 0, 'bandpass', 2.5, { at: rnd(0.05, 0.35), atk: 0.003 });
  },
  impact_water: d => {
    auNz(d, 0.32, 0.26, 2400, 450, 'bandpass', 0.9);
    auTone(d, 'sine', 620, 190, 0.16, 0.12);
    auNz(d, 0.2, 0.08, 5000, 3000, 'highpass', 0.7, { at: 0.04 });
  },
  impact_wind: d => {
    auNz(d, 0.26, 0.24, 2800, 800, 'bandpass', 1.4);
    auTone(d, 'sine', 1500, 700, 0.2, 0.04);
  },
  impact_earth: d => {
    auNz(d, 0.3, 0.34, 650, 90, 'lowpass', 1);
    auTone(d, 'square', 120, 44, 0.22, 0.14, { lp: 700 });
    for (let i = 0; i < 3; i++) auNz(d, 0.04, 0.1, rnd(900, 1800), 0, 'bandpass', 2, { at: rnd(0.04, 0.25), atk: 0.003 });
  },
  impact_heal: d => {
    auTone(d, 'sine', 1046, 1568, 0.35, 0.06);
    auTone(d, 'triangle', 784, 1046, 0.3, 0.04, { at: 0.04 });
  },
  /* the big spells */
  meteorFall: d => {                                                   // ~1 s rising whistle + growing rumble
    auNz(d, 1.0, 0.22, 300, 2200, 'bandpass', 0.9, { atk: 0.8 });
    auTone(d, 'sine', 500, 1600, 1.05, 0.05, { atk: 0.85 });
    auTone(d, 'sawtooth', 55, 85, 1.0, 0.07, { atk: 0.8, lp: 300 });
  },
  meteorImpact: d => {
    auTone(d, 'sine', 70, 26, 2.0, 0.5, { atk: 0.004, hold: 0.12 });
    auTone(d, 'sawtooth', 110, 32, 1.1, 0.3, { lp: 900, lp1: 120 });
    auNz(d, 1.4, 0.45, 1200, 60, 'lowpass', 0.7, { atk: 0.004 });
    auNz(d, 2.2, 0.22, 400, 50, 'lowpass', 0.8, { at: 0.15, hold: 0.4 });
    for (let i = 0; i < 5; i++) auNz(d, 0.05, 0.12, rnd(1500, 3500), 0, 'bandpass', 3, { at: rnd(0.2, 1.1), atk: 0.003 });
    auDuck(0.4, 1.0);
  },
  pillar: d => {                                                       // stone grind, cracks, then the thud
    auNz(d, 0.45, 0.2, 250, 600, 'bandpass', 3, { atk: 0.08 });
    auTone(d, 'sawtooth', 50, 62, 0.45, 0.06, { lp: 250, atk: 0.08 });
    for (let i = 0; i < 3; i++) auNz(d, 0.04, 0.12, rnd(800, 1600), 0, 'bandpass', 2, { at: rnd(0.05, 0.35), atk: 0.003 });
    auTone(d, 'sine', 95, 38, 0.4, 0.32, { at: 0.38 });
    auNz(d, 0.3, 0.28, 600, 70, 'lowpass', 1, { at: 0.38 });
  },
  freeze: d => {                                                       // v2 freeze + glassy crackle
    auTone(d, 'sine', 1400, 300, 0.7, 0.13);
    auNz(d, 0.7, 0.15, 3000, 700, 'bandpass', 2.2);
    for (let i = 0; i < 5; i++) { const f = rnd(2600, 4400); auTone(d, 'triangle', f, f * 0.8, 0.05, 0.045, { at: i * 0.06 + rnd(0, 0.03), atk: 0.002 }); }
  },
  burn: d => {                                                         // crackling whoosh
    auNz(d, 0.6, 0.24, 350, 1600, 'bandpass', 0.8, { atk: 0.15 });
    auNz(d, 0.5, 0.12, 200, 120, 'lowpass', 1);
    for (let i = 0; i < 6; i++) auNz(d, 0.025, 0.16, rnd(2000, 5000), 0, 'bandpass', 2.5, { at: rnd(0, 0.55), atk: 0.002 });
  },
  // thunder: a crack (less of one far away), then the long roll
  thunder: (d, e) => {
    const far = (e && e.far) || 1, near = 1 - smooth(0.4, 3.2, far);
    auNz(d, 0.3, 0.5 * near, 2600, 700, 'lowpass', 0.7, { atk: 0.003 });
    auNz(d, 4.5 + far, 0.5, 260, 50, 'lowpass', 1, { atk: 0.12 + far * 0.05, at: 0.05 });
    auNz(d, 3.2, 0.32, 140, 40, 'lowpass', 1, { atk: 0.5, at: 0.5 + far * 0.2 });
  },
  // hooves on the ground: a dull clop, sharper at the gallop
  hoof: (d, e) => {
    const g = e && e.gallop;
    auNz(d, 0.05, g ? 0.12 : 0.08, rnd(700, 1000), 280, 'bandpass', 2, { atk: 0.002 });
    auTone(d, 'sine', auVar(g ? 120 : 150, 0.12), 60, 0.07, g ? 0.07 : 0.045);
  },
  // two-note whistle through the fingers
  whistle: d => {
    auTone(d, 'sine', 1900, 2400, 0.16, 0.05, { atk: 0.01 });
    auTone(d, 'sine', 2300, 1700, 0.28, 0.05, { at: 0.2, atk: 0.01 });
  },
  // a whinny: a falling, wobbling cry
  whinny: d => {
    auTone(d, 'sawtooth', 820, 520, 0.9, 0.035, { lp: 2200, atk: 0.04, vib: [11, 60] });
    auTone(d, 'sawtooth', 1240, 760, 0.7, 0.02, { lp: 2600, atk: 0.05, vib: [13, 70] });
    auNz(d, 0.6, 0.03, 1500, 700, 'bandpass', 1.4, { atk: 0.05 });
  },
  gate: d => {                                                         // a great bar lifted, two doors swinging on old hinges
    auNz(d, 0.35, 0.3, 300, 120, 'lowpass', 1, { atk: 0.01 });                                   // the bar
    auTone(d, 'sawtooth', 92, 70, 1.6, 0.05, { lp: 500, atk: 0.3, at: 0.4, vib: [5, 6] });      // the creak, low
    auTone(d, 'sawtooth', 138, 104, 1.4, 0.035, { lp: 700, atk: 0.4, at: 0.55, vib: [7, 9] });  // …and its harmonic
    auNz(d, 2.2, 0.12, 180, 90, 'lowpass', 0.8, { atk: 0.8, at: 0.3 });                         // the doors' weight
    auNz(d, 0.4, 0.28, 140, 60, 'lowpass', 1, { at: 2.6, atk: 0.005 });                          // they come to rest
  },
  ignite: d => {                                                       // a brazier catching: breathy whoosh, a few sparks
    auNz(d, 0.45, 0.2, 260, 1400, 'bandpass', 0.9, { atk: 0.04 });
    auNz(d, 0.3, 0.1, 150, 90, 'lowpass', 1);
    for (let i = 0; i < 4; i++) auNz(d, 0.02, 0.12, rnd(2500, 5500), 0, 'bandpass', 2.5, { at: rnd(0.05, 0.4), atk: 0.002 });
  },
  bossIntro: d => {                                                    // a struck low drum, then a dark swell under the name
    auTone(d, 'sine', 70, 38, 1.6, 0.5, { hold: 0.05 });
    auNz(d, 0.5, 0.3, 180, 60, 'lowpass', 1, { atk: 0.004 });
    auTone(d, 'sawtooth', 73.4, 0, 3.2, 0.08, { lp: 700, atk: 0.9, at: 0.1 });
    auTone(d, 'sawtooth', 110, 0, 3.2, 0.055, { lp: 900, atk: 1.1, at: 0.15 });
    auTone(d, 'sawtooth', 116.5, 0, 3.0, 0.04, { lp: 800, atk: 1.3, at: 0.25 });   // the minor-second rub
  },
  /* the vessel */
  'break': d => {                                                      // v2 'break', bigger: shatter + sub drop
    auTone(d, 'sawtooth', 900, 60, 0.9, 0.28, { lp: 5000 });
    auTone(d, 'square', 600, 40, 0.9, 0.14, { lp: 3000 });
    auNz(d, 1.1, 0.34, 3000, 120, 'bandpass', 0.6);
    auNz(d, 0.6, 0.26, 7000, 2000, 'bandpass', 1.5, { atk: 0.003 });
    for (let i = 0; i < 6; i++) { const f = rnd(2500, 5000); auTone(d, 'triangle', f, f * 0.9, rnd(0.12, 0.25), 0.05, { at: rnd(0.02, 0.7), atk: 0.002 }); }
    auTone(d, 'sine', 90, 28, 2.2, 0.4, { at: 0.05, hold: 0.2 });
    auTone(d, 'sine', 52, 40, 1.4, 0.3, { at: 0.09 });
    auNz(d, 0.9, 0.22, 200, 50, 'lowpass', 1, { at: 0.09 });
    auDuck(0.25, 1.6);
  },
  reform: d => {                                                       // v2 rising fifths + shimmer
    [392, 523, 659, 880].forEach((f, i) => auTone(d, 'sine', f, f * 1.5, 0.6, 0.12, { at: i * 0.08 }));
    auNz(d, 1.0, 0.05, 3000, 8000, 'bandpass', 2, { atk: 0.5 });
  },
  /* enemies */
  crossbow: d => {
    auNz(d, 0.03, 0.22, 3000, 2400, 'bandpass', 2, { atk: 0.002 });
    auTone(d, 'triangle', auVar(240), 150, 0.16, 0.12);
    auTone(d, 'sawtooth', 180, 120, 0.09, 0.035, { lp: 1500 });
  },
  enemyCast: d => {                                                    // eerie, dissonant, wavering
    auTone(d, 'sine', 440, 311, 0.9, 0.07, { atk: 0.1, vib: [6, 8] });
    auTone(d, 'sine', 466, 330, 0.9, 0.05, { atk: 0.1 });
    auTone(d, 'triangle', 110, 98, 0.9, 0.06, { atk: 0.15 });
    auNz(d, 0.8, 0.08, 1500, 500, 'bandpass', 5, { atk: 0.3 });
  },
  snarl: d => {
    auGrowl(d, auVar(115), 80, 0.5, 0.14, 27);
    auNz(d, 0.42, 0.1, 900, 380, 'bandpass', 1.5);
  },
  howl: d => {                                                         // sine glide up, hold, fall — vibrato blooms in
    const k = auVar(1, 0.08), dur = rnd(1.5, 1.9), t = AUDIO.ctx.currentTime;
    for (const [mul, vol] of [[1, 0.12], [2, 0.025]]) {
      const o = auTone(d, 'sine', 330 * k * mul, 0, dur, vol, { atk: 0.2, hold: dur * 0.6, vib: [5.2, 8 * mul] });
      if (o) auContour(o.frequency, t, [[0.35, 560], [dur * 0.65, 610], [dur, 430]], k * mul);
    }
    auNz(d, dur * 0.8, 0.025, 1100 * k, 900, 'bandpass', 4, { atk: 0.3, hold: dur * 0.4 });
  },
  wolfDeath: d => {                                                    // yelp, whimper, body
    auTone(d, 'sine', 950, 520, 0.16, 0.1);
    auTone(d, 'triangle', 1900, 1040, 0.12, 0.025);
    auTone(d, 'sine', 700, 400, 0.55, 0.06, { at: 0.2, hold: 0.2, vib: [9, 22] });
    auTone(d, 'sine', 100, 42, 0.22, 0.14, { at: 0.34 });
    auNz(d, 0.22, 0.18, 420, 80, 'lowpass', 1, { at: 0.34 });
  },
  death: d => {                                                        // grunt, fall, gear clatter
    auTone(d, 'sawtooth', 170, 70, 0.32, 0.08, { lp: 900 });
    auTone(d, 'sine', 95, 38, 0.32, 0.22, { at: 0.28 });
    auNz(d, 0.3, 0.24, 520, 70, 'lowpass', 1, { at: 0.28 });
    auNz(d, 0.16, 0.07, 2600, 1200, 'bandpass', 2, { at: 0.3 });
  },
  boneDeath: d => {                                                    // dry rattling clacks, bunched at the start
    for (let i = 0; i < 9; i++) {
      const at = Math.pow(Math.random(), 1.7) * 0.8;
      if (Math.random() < 0.55) auNz(d, 0.018, 0.2, rnd(1800, 3800), 0, 'bandpass', 7, { at, atk: 0.002 });
      else { const f = rnd(620, 1150); auTone(d, 'triangle', f, f * 0.82, 0.04, 0.07, { at, atk: 0.002 }); }
    }
    auTone(d, 'sine', 120, 60, 0.16, 0.1, { at: 0.12 });
  },
  boneRise: d => {                                                     // clacks gather as something climbs out
    auTone(d, 'sine', 110, 220, 1.3, 0.06, { atk: 1.0, vib: [4, 4] });
    auNz(d, 1.0, 0.06, 300, 900, 'bandpass', 3, { atk: 0.6 });
    for (let i = 0; i < 7; i++) auNz(d, 0.018, 0.16, rnd(1800, 3600), 0, 'bandpass', 7, { at: 0.3 + (1 - Math.pow(Math.random(), 2)), atk: 0.002 });
  },
  /* rewards & world */
  pickup: (d, e) => {
    const f = e.kind === 'hp' ? 660 : 880;
    auTone(d, 'sine', f, f * 1.5, 0.14, 0.14);
    auTone(d, 'triangle', f * 1.5, f * 2, 0.18, 0.04, { at: 0.06 });
  },
  levelUp: d => {                                                      // v2 arpeggio + a held shimmer
    [523, 659, 784, 1046].forEach((f, i) => auTone(d, 'triangle', f, 0, 0.34, 0.13, { at: i * 0.095 }));
    [1046, 1318, 1568].forEach(f => auTone(d, 'sine', f, f * 1.003, 1.1, 0.035, { at: 0.38, atk: 0.05, hold: 0.3 }));
    auDuck(0.5, 1.2);
  },
  waystone: d => {                                                     // warm D chord, detuned pairs shimmer
    [146.83, 220, 293.66, 369.99, 440].forEach((f, i) => {
      auTone(d, 'sine', f, 0, 3.2, 0.04, { at: i * 0.06, atk: 0.4, hold: 1.4, det: -5 });
      auTone(d, 'sine', f, 0, 3.2, 0.03, { at: i * 0.06, atk: 0.4, hold: 1.4, det: 6 });
    });
    [1174.66, 1479.98, 1760].forEach((f, i) => auTone(d, 'triangle', f, 0, 0.6, 0.025, { at: 0.35 + i * 0.28 + rnd(0, 0.08) }));
    auNz(d, 2.4, 0.025, 5000, 9000, 'bandpass', 3, { atk: 0.8, hold: 0.8 });
    auDuck(0.35, 2.5);
  },
  discover: d => {                                                     // D  A  G  D' — a small fanfare
    const notes = [587.33, 880, 783.99, 1174.66];
    notes.forEach((f, i) => {
      const last = i === notes.length - 1, dur = last ? 1.8 : 0.5;
      auTone(d, 'triangle', f, 0, dur, 0.1, { at: i * 0.2, hold: last ? 0.5 : 0.08 });
      auTone(d, 'sine', f / 2, 0, dur, 0.05, { at: i * 0.2, hold: last ? 0.5 : 0.08 });
    });
    auTone(d, 'sine', 880, 0, 1.8, 0.04, { at: 0.6, atk: 0.1, hold: 0.5 });
    auDuck(0.35, 2.2);
  },
  /* tells — the most important sounds in the game: they must cut through */
  tell: d => {                                                         // bright inharmonic 'tink' (1 : 1.5 : 2.76)
    const k = auVar(1, 0.02);
    auNz(d, 0.02, 0.14, 7000, 0, 'highpass', 0.7, { atk: 0.001 });
    auTone(d, 'triangle', 1760 * k, 0, 0.2, 0.13, { atk: 0.002 });
    auTone(d, 'sine', 2640 * k, 0, 0.24, 0.07, { atk: 0.002 });
    auTone(d, 'sine', 4858 * k, 0, 0.09, 0.05, { atk: 0.002 });
    auDuck(0.55, 0.22);
  },
  tellHeavy: d => {                                                    // low swell + a tritone that sits mid-range
    auTone(d, 'sawtooth', 98, 82, 0.65, 0.12, { atk: 0.03, lp: 700, lp1: 180 });
    auTone(d, 'sine', 196, 147, 0.6, 0.14, { atk: 0.02 });
    auTone(d, 'triangle', 277.18, 0, 0.4, 0.06, { atk: 0.01 });
    auTone(d, 'triangle', 392, 0, 0.4, 0.05, { atk: 0.01 });
    auNz(d, 0.45, 0.12, 260, 110, 'lowpass', 1);
    auDuck(0.45, 0.5);
  },
  /* interface */
  uiMove: d => auTone(d, 'triangle', 760, 0, 0.035, 0.04),
  uiSelect: d => { auTone(d, 'triangle', 660, 0, 0.06, 0.07); auTone(d, 'triangle', 990, 0, 0.1, 0.06, { at: 0.05 }); },
  uiBack: d => auTone(d, 'triangle', 700, 460, 0.09, 0.06),
  page: d => {                                                         // paper rustle
    auNz(d, 0.09, 0.1, auVar(3200), 2200, 'bandpass', 0.8, { atk: 0.005 });
    auNz(d, 0.14, 0.08, 5200, 3000, 'highpass', 0.7, { at: 0.05 });
    auNz(d, 0.06, 0.06, 2000, 1500, 'bandpass', 1, { at: 0.12 });
  },
};
const AUDIO_PRIO = new Set(['bossIntro', 'tell', 'tellHeavy', 'break', 'reform', 'parry', 'hurt', 'learn', 'levelUp', 'discover', 'waystone', 'meteorImpact']);
// minimum seconds between two of the same id (same-frame duplicates always merge)
const AUDIO_GAP = { 'break': 0.5, reform: 0.5, levelUp: 0.4, discover: 1, waystone: 1, learn: 0.3, howl: 0.35, tell: 0.06, tellHeavy: 0.08 };

function auPlay(id, e = AUDIO_NOOPT) {
  // 'unlock' means two things upstream: the lock-on click, and a spell learned
  // (which always follows a "Learned — …" toast in the same call)
  if (id === 'unlock' && AUDIO.learned) { AUDIO.learned = false; id = 'learn'; }
  if (!auReady() || !(SETTINGS.sfx > 0)) return;
  const def = AUDIO_SFX[id];
  if (!def) return;
  try {
    const now = AUDIO.ctx.currentTime;
    if (now - (AUDIO.last[id] ?? -9) < (AUDIO_GAP[id] ?? 0.03)) return;
    const pos = e.pos || null;
    if (pos) {
      const cp = camera.position, dx = pos.x - cp.x, dy = pos.y - cp.y, dz = pos.z - cp.z;
      if (dx * dx + dy * dy + dz * dz > 90 * 90) return;               // out of earshot
    }
    AUDIO.last[id] = now;
    const tellish = id === 'tell' || id === 'tellHeavy';
    const d = auDest(AUDIO.sfx, pos, tellish ? 9 : 4, AUDIO_PRIO.has(id) ? 2 : 1);
    def(d, e);
    auRelease(d);
  } catch (err) { auWarn(err); }
}
function auWarn(err) { if (!AUDIO.warned) { AUDIO.warned = true; console.warn('[audio]', err); } }

/* ───────────── footsteps, landings, glide ───────────── */
function auSurface(x, z) {
  if (GAME.inCave) return 'gravel';
  if (waterAt(x, z) > heightAt(x, z)) return 'water';
  if (x > 1400 && roaPaved(x, z, roadDistAt(x, z)) > 0.5) return 'stone';
  if (roadDistAt(x, z) < 3.5) return 'gravel';
  return 'grass';
}
function auStep(kind, L) {
  if (!(SETTINGS.sfx > 0)) return;
  const d = auDest(AUDIO.sfx);
  if (kind === 'water') {
    auNz(d, 0.2, 0.09 * L, rnd(900, 1400), 350, 'bandpass', 0.8, { atk: 0.02 });
    const f = rnd(450, 650);
    auTone(d, 'sine', f, f * 0.5, 0.07, 0.025 * L, { at: 0.03 });
    auNz(d, 0.14, 0.04 * L, 3500, 2000, 'highpass', 0.7, { at: 0.05 });
  } else if (kind === 'stone') {
    // laid stone: a hard heel-tap and a little scuff
    auNz(d, 0.035, 0.085 * L, rnd(1800, 2400), 1100, 'bandpass', 2.2, { atk: 0.002 });
    auTone(d, 'sine', auVar(170, 0.1), 85, 0.045, 0.035 * L);
    auNz(d, 0.06, 0.02 * L, 4200, 2500, 'highpass', 0.8, { at: 0.02 });
  } else if (kind === 'gravel') {
    auNz(d, 0.07, 0.07 * L, rnd(1100, 1500), 600, 'bandpass', 1.3, { atk: 0.004 });
    for (let i = 0; i < 3; i++) auNz(d, 0.012, 0.04 * L, rnd(2500, 5000), 0, 'bandpass', 5, { at: rnd(0, 0.05), atk: 0.002 });
    auTone(d, 'sine', auVar(110, 0.1), 60, 0.05, 0.04 * L);
  } else {
    const f = rnd(1800, 2600);
    auNz(d, auVar(0.09, 0.15), 0.05 * L, f, f * 0.55, 'bandpass', 0.9, { atk: 0.012 });
    auNz(d, 0.05, 0.03 * L, 300, 150, 'lowpass', 1, { atk: 0.004 });
  }
  auRelease(d);
}
function auFootsteps() {
  const S = AUDIO.step;
  if (!G || GAME.state !== 'play' || !TER.H) { S.init = false; return; }
  const b = PL.body, p = b.pos;
  if (!S.init) { S.init = true; S.x = p.x; S.z = p.z; S.acc = 0.5; return; }
  const moved = Math.hypot(p.x - S.x, p.z - S.z);
  S.x = p.x; S.z = p.z;
  if (moved > 4) return;                                               // teleport / respawn, not a stride
  if (!b.grounded || (PL.state !== 'move' && PL.state !== 'dodge')) return;
  S.acc += moved;
  const sp = Math.hypot(b.vel.x, b.vel.z);
  const stride = PL.sprinting ? AUDIO_STRIDE_SPRINT : lerp(AUDIO_STRIDE_WALK, AUDIO_STRIDE_SPRINT, smooth(WALK_SPEED, SPRINT_SPEED, sp));
  if (S.acc < stride) return;
  S.acc %= stride;
  auStep(auSurface(p.x, p.z), clamp(0.45 + sp / SPRINT_SPEED * 0.6, 0.45, 1.05));
}
function auLand(v) {
  if (!auReady() || !(SETTINGS.sfx > 0)) return;
  try {
    const k = clamp((v - 6) / 12, 0.25, 1), d = auDest(AUDIO.sfx);
    auTone(d, 'sine', 120, 42, 0.24, 0.26 * k);
    auNz(d, 0.22, 0.22 * k, 700, 90, 'lowpass', 1);
    auRelease(d);
    auStep(G && TER.H ? auSurface(PL.body.pos.x, PL.body.pos.z) : 'grass', 0.8 + k * 0.5);
  } catch (err) { auWarn(err); }
}
// Gale Step: a looping wind rush for as long as the glide lasts
function auGlide(on) {
  const c = AUDIO.ctx;
  if (!c) return;
  const t = c.currentTime;
  if (on && !AUDIO.glide && auReady()) {
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = AUDIO.noiseBuf; s.loop = true;
    f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.35);
    s.connect(f); f.connect(g); g.connect(AUDIO.sfx);
    s.start(t, Math.random() * 2);
    AUDIO.glide = { s, f, g };
  } else if (!on && AUDIO.glide) {
    const { s, f, g } = AUDIO.glide;
    AUDIO.glide = null;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.4);
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
    s.stop(t + 0.45);
  }
}
function auGlideUpdate(tick) {
  const gl = AUDIO.glide;
  if (!gl) return;
  // landing clears PL.gliding without a 'glide' event — don't leave the wind running
  if (!PL.gliding || GAME.state !== 'play') { auGlide(false); return; }
  if (tick) auSet(gl.f.frequency, 420 + PL.body.vel.length() * 110, 0.1);
}

/* ───────────── ambience beds ─────────────
   Continuous loops whose levels are damped toward targets every frame:
   wind, river (+ the falls), rain, crickets, cave drone. Birds and drips
   are one-shots on their own timers.                                    */
function auBuildBeds() {
  const c = AUDIO.ctx;
  const noiseBed = (type, freq, q) => {
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = AUDIO.noiseBuf; s.loop = true;
    f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(AUDIO.amb);
    s.start(0, Math.random() * (AUDIO_NOISE_SEC - 0.5));
    return { g, f, lvl: 0, set: 0, tgt: 0 };
  };
  const B = AUDIO.beds = {
    wind: noiseBed('bandpass', 420, 0.55),
    river: noiseBed('lowpass', 1300, 0.5),
    rain: noiseBed('bandpass', 3200, 0.35),
    crickets: auCricketBed(),
    cave: auCaveBed(),
  };
  AUDIO.bedList = [B.wind, B.river, B.rain, B.crickets, B.cave];
}
// three crickets: a high sine chopped by a fast square, gated into chirps by a shaped slow LFO
function auCricketBed() {
  const c = AUDIO.ctx, out = c.createGain();
  out.gain.value = 0; out.connect(AUDIO.amb);
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; curve[i] = x > 0.3 ? Math.sqrt((x - 0.3) / 0.7) : 0; }
  for (const [f, pulse, chirp, pan] of [[4350, 29, 1.15, -0.6], [4720, 33, 1.62, 0.55], [3980, 25, 0.83, 0.1]]) {
    const o = c.createOscillator(), am = c.createGain(), p = c.createOscillator(), pg = c.createGain();
    const gate = c.createGain(), l = c.createOscillator(), sh = c.createWaveShaper();
    o.frequency.value = f; am.gain.value = 0.5;
    p.type = 'square'; p.frequency.value = pulse; pg.gain.value = 0.5;
    p.connect(pg); pg.connect(am.gain);                                  // am: 0 ↔ 1 at `pulse` Hz
    gate.gain.value = 0; l.frequency.value = chirp; sh.curve = curve;
    l.connect(sh); sh.connect(gate.gain);                                // gate: silent most of each cycle
    o.connect(am); am.connect(gate);
    if (c.createStereoPanner) { const sp = c.createStereoPanner(); sp.pan.value = pan; gate.connect(sp); sp.connect(out); }
    else gate.connect(out);
    o.start(); p.start(); l.start();
  }
  return { g: out, lvl: 0, set: 0, tgt: 0 };
}
function auCaveBed() {
  const c = AUDIO.ctx, out = c.createGain(), lp = c.createBiquadFilter();
  out.gain.value = 0; out.connect(AUDIO.amb);
  lp.type = 'lowpass'; lp.frequency.value = 170; lp.Q.value = 0.7; lp.connect(out);
  for (const [type, f, v] of [['sawtooth', 55, 0.5], ['sawtooth', 55.35, 0.4], ['sine', 82.41, 0.6]]) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v;
    o.connect(g); g.connect(lp); o.start();
  }
  const lfo = c.createOscillator(), lg = c.createGain();
  lfo.frequency.value = 0.04; lg.gain.value = 60;
  lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  return { g: out, lvl: 0, set: 0, tgt: 0 };
}
function auBird(cp) {
  const a = rnd(0, TAU), r = rnd(8, 30);
  const d = auDest(AUDIO.amb, AUDIO_TMP.set(cp.x + Math.cos(a) * r, cp.y + rnd(2, 9), cp.z + Math.sin(a) * r), 7, 0);
  const base = rnd(2300, 4000), kind = Math.random(), v = rnd(0.05, 0.09);
  if (kind < 0.4) {                                                    // whistled phrase of 2–4 glides
    let at = 0;
    for (let i = 0, n = 2 + (Math.random() * 3 | 0); i < n; i++) {
      const f = base * rnd(0.85, 1.2);
      auTone(d, 'sine', f, f * rnd(1.15, 1.5), rnd(0.06, 0.11), v, { at });
      at += rnd(0.1, 0.17);
    }
  } else if (kind < 0.7) {                                             // trill
    for (let i = 0, n = 6 + (Math.random() * 7 | 0); i < n; i++) auTone(d, 'triangle', base * 1.2, base * 1.02, 0.035, v * 0.6, { at: i * 0.048, atk: 0.004 });
  } else {                                                             // tee-oo
    auTone(d, 'sine', base * 1.05, base * 1.15, 0.15, v, { atk: 0.02 });
    auTone(d, 'sine', base * 0.8, base * 0.68, 0.22, v * 0.9, { at: 0.2, atk: 0.02 });
  }
  auRelease(d);
}
function auDrip(cp) {
  const a = rnd(0, TAU), r = rnd(3, 14);
  const d = auDest(AUDIO.caveIn, AUDIO_TMP.set(cp.x + Math.cos(a) * r, cp.y + rnd(1, 4), cp.z + Math.sin(a) * r), 4, 0);
  const f = rnd(1400, 2700);
  auTone(d, 'sine', f, f * 0.72, 0.09, rnd(0.08, 0.14), { atk: 0.003 });
  if (Math.random() < 0.4) auTone(d, 'sine', f * 1.5, f * 1.1, 0.06, 0.04, { at: 0.012, atk: 0.003 });
  auRelease(d);
}
function auAmbience(dt, tick) {
  const B = AUDIO.beds;
  if (!B) return;
  const cp = camera.position, cave = !!GAME.inCave, out = cave ? 0 : 1;
  const night = SKY_NOW.night, rain = WEATHER.cur.rain, cloud = WEATHER.cur.cloud;
  const T = AUDIO.clock;
  const gust = 0.7 + 0.3 * Math.sin(T * 0.29) * Math.sin(T * 0.107 + 1.3);
  const alt = smooth(70, 160, cp.y);
  let river = 0, falls = 0;
  if (!cave && TER.RIVD) {
    river = 1 - smooth(4, 60, riverDistAt(cp.x, cp.z));
    falls = 1 - smooth(20, 180, Math.hypot(cp.x - PLACES.falls.x, cp.z - PLACES.falls.z));
  }
  B.wind.tgt = out * (0.035 + cloud * 0.045 + rain * 0.02 + alt * 0.1 + DUST.k * (0.05 + DUST.storm * 0.09)) * gust;
  B.river.tgt = Math.max(river * 0.11, falls * 0.26);                   // the falls: louder, and lower (below)
  B.rain.tgt = out * rain * 0.13;
  B.crickets.tgt = out * smooth(0.5, 0.8, night) * (1 - smooth(0.2, 0.5, rain)) * 0.014;
  B.cave.tgt = cave ? 0.07 : 0;
  for (const b of AUDIO.bedList) b.lvl = damp(b.lvl, b.tgt, 1.3, dt);
  if (tick) {
    for (const b of AUDIO.bedList) if (Math.abs(b.lvl - b.set) > 1e-4) { b.set = b.lvl; auSet(b.g.gain, b.lvl, 0.06); }
    auSet(B.wind.f.frequency, 260 + 420 * gust + alt * 300, 0.3);
    auSet(B.river.f.frequency, lerp(1350, 420, falls), 0.4);
  }
  // birds by day — busier in the forest, quiet at altitude, gone in rain and at night
  if ((AUDIO.birdT -= dt) <= 0) {
    const ok = !cave && night < 0.5 && rain < 0.3;
    const forest = Math.hypot(cp.x - PLACES.forest.x, cp.z - PLACES.forest.z) < PLACES.forest.r;
    const rate = ok ? (forest ? 1 : 0.35) * (1 - smooth(0.3, 0.5, night)) * (1 - alt * 0.7) : 0;
    if (rate > 0.02) { auBird(cp); AUDIO.birdT = Math.min(12, rnd(1, 4) / rate); } else AUDIO.birdT = 2;
  }
  // cave drips, echoing
  if ((AUDIO.dripT -= dt) <= 0) { AUDIO.dripT = rnd(0.5, 2.6); if (cave) auDrip(cp); }
}

/* ───────────── adaptive music ─────────────
   v2's MOOD idea: a detuned saw drone under a slow filter LFO, and a sparse
   pentatonic melody on a timer. One layer per REGION, crossfaded over 4 s.
   Night keeps the region but darkens it (lower cutoff, slower melody).
   The COMBAT layer (drum + ostinato) fades in over it when enemies close in. */
const AUDIO_MOODS = {
  field:   { root: 146.83, scale: [0, 2, 5, 7, 9],  step: 2.5, cut: 500, drone: 0.042 },
  village: { root: 130.81, scale: [0, 2, 4, 7, 9],  step: 2.1, cut: 560, drone: 0.04 },
  forest:  { root: 110.00, scale: [0, 3, 5, 7, 10], step: 1.9, cut: 420, drone: 0.046 },
  cave:    { root: 87.31,  scale: [0, 2, 3, 7, 8],  step: 3.0, cut: 260, drone: 0.05 },
  // Roa: a city's bright major, quicker steps; the outskirts: dry, hollow, sparse
  roa:     { root: 146.83, scale: [0, 4, 7, 9, 11], step: 1.8, cut: 640, drone: 0.036 },
  outskirts: { root: 98.0, scale: [0, 1, 5, 7, 8],  step: 2.8, cut: 380, drone: 0.048 },
};
// eighth-note ostinati in semitones from the region root (null = rest)
const AUDIO_OSTINATO = [[0, 0, 7, 0, 3, 0, 7, 10], [0, 0, 7, 0, 8, 7, 3, 2]];
const AUDIO_OSTINATO_BOSS = [0, 1, 0, 6, 0, 1, 7, 6];

function auRegionAt(x, z) {
  if (GAME.inCave) return 'cave';
  const cur = AUDIO.mus.region;
  const inside = (P, key) => Math.hypot(x - P.x, z - P.z) < P.r * (cur === key ? 1.12 : 1);   // hysteresis
  if (inside(PLACES.village, 'village')) return 'village';
  if (inside(PLACES.forest, 'forest')) return 'forest';
  if (x > 900) {
    if (rectDist(x, z, ROA_CITY) < (cur === 'roa' ? 40 : 25)) return 'roa';
    if (outskirtsW(x, z) > (cur === 'outskirts' ? 0.3 : 0.5)) return 'outskirts';
  }
  return 'field';
}
function auMakeLayer(key) {
  const c = AUDIO.ctx, M = AUDIO_MOODS[key], t = c.currentTime;
  const bus = c.createGain(), lp = c.createBiquadFilter();
  bus.gain.setValueAtTime(0.0001, t); bus.gain.linearRampToValueAtTime(1, t + 4);
  bus.connect(AUDIO.explore);
  lp.type = 'lowpass'; lp.frequency.value = M.cut; lp.Q.value = 0.6; lp.connect(bus);
  const srcs = [], nodes = [bus, lp];
  for (const [mul, det] of [[1, 0], [1, 7], [1.5, -6]]) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = M.root * mul; o.detune.value = det; g.gain.value = M.drone;
    o.connect(g); g.connect(lp); o.start(t);
    srcs.push(o); nodes.push(o, g);
  }
  const lfo = c.createOscillator(), lg = c.createGain();
  lfo.frequency.value = 0.055; lg.gain.value = M.cut * 0.42;
  lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t);
  srcs.push(lfo); nodes.push(lfo, lg);
  return { key, M, bus, lp, lg, srcs, nodes, next: rnd(1, 3), end: Infinity };
}
function auKillLayer(L, fade) {
  const t = AUDIO.ctx.currentTime, g = L.bus.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.linearRampToValueAtTime(0.0001, t + fade);
  for (const s of L.srcs) { try { s.stop(t + fade + 0.05); } catch (e) { /* already stopped */ } }
  L.srcs[0].onended = () => { for (const n of L.nodes) n.disconnect(); };
  L.end = t + fade + 0.1;
}
function auMelody(L, night) {
  if (Math.random() < 0.32) return;                                    // v2: leave space
  const M = L.M, step = M.step * lerp(1, 1.4, night);
  const d = auDest(L.bus, null, 4, 0);
  const note = () => M.root * Math.pow(2, pick(M.scale) / 12 + (Math.random() < lerp(0.4, 0.15, night) ? 2 : 1));
  const f = note();
  auTone(d, Math.random() < 0.5 ? 'triangle' : 'sine', f, 0, step * 1.5, 0.055, { atk: 0.05, send: AUDIO.echoIn });
  if (Math.random() < 0.2) { const g = note(); auTone(d, 'sine', g, 0, step, 0.035, { at: step * 0.5, atk: 0.05, send: AUDIO.echoIn }); }
}
function auMusic(dt, tick) {
  const M = AUDIO.mus, now = AUDIO.ctx.currentTime;
  const p = G && GAME.state === 'play' ? PL.body.pos : camera.position;
  const want = SETTINGS.music > 0.001 && GAME.state !== 'boot' ? auRegionAt(p.x, p.z) : null;
  if (want !== M.region) {
    if (M.layer) { auKillLayer(M.layer, 4); M.dying.push(M.layer); }
    M.layer = want ? auMakeLayer(want) : null;
    M.region = want;
  }
  if (M.dying.length) {
    if (M.dying[0].end <= now) M.dying = M.dying.filter(L => L.end > now);
    while (M.dying.length > 2) auKillLayer(M.dying.shift(), 0.3);    // flapping at a border: don't stack drones
  }
  const L = M.layer;
  if (L) {
    const night = SKY_NOW.night;
    if (tick) { const cut = L.M.cut * lerp(1, 0.55, night); auSet(L.lp.frequency, cut, 1.5); auSet(L.lg.gain, cut * 0.42, 1.5); }
    if ((L.next -= dt) <= 0) { L.next = Math.max(0.2, L.next + L.M.step * lerp(1, 1.4, night)); auMelody(L, night); }
  }
  auCombatMusic(dt, tick);
}
function auCombatMusic(dt, tick) {
  const C = AUDIO.cb;
  let fight = false, boss = false;
  if (G && GAME.state === 'play' && PL.state !== 'dead') {
    const p = PL.body.pos;
    for (const e of ENT.enemies) {
      if (!e.aggro || e.dead || Math.hypot(e.pos.x - p.x, e.pos.z - p.z) > 35) continue;
      fight = true;
      if (e.def && e.def.boss) boss = true;
    }
  }
  if (fight) { C.hold = 4; C.wantBoss = boss; } else C.hold -= dt;   // linger ~4 s after the last foe
  const on = C.hold > 0 && SETTINGS.music > 0.001;
  C.lvl = damp(C.lvl, on ? 1 : 0, on ? 2.2 : 1.1, dt);                // ~1.5 s in, ~2.5 s out
  if (tick) { auSet(AUDIO.combat.gain, C.lvl * 0.95, 0.05); auSet(AUDIO.explore.gain, 1 - 0.6 * C.lvl, 0.2); }
  if (!on && C.lvl < 0.01) { C.next = 0; return; }
  // look-ahead scheduler: queue every eighth that falls in the next 0.2 s
  const t = AUDIO.ctx.currentTime;
  if (C.next < t) { C.next = t + 0.05; C.i = 0; C.boss = C.wantBoss; }
  while (C.next < t + 0.2) {
    if (C.i % 8 === 0) C.boss = C.wantBoss;                            // change variant on the bar line
    const spe = 60 / (C.boss ? 88 : 104) / 2;
    auCombatStep(C.i, C.next - t, C.boss, spe);
    C.next += spe; C.i = (C.i + 1) % 32;
  }
}
function auCombatStep(i, at, boss, spe) {
  const d = AUDIO.cbDest, b = i % 8, bar = i >> 3;
  const root = AUDIO_MOODS[AUDIO.mus.region || 'field'].root;
  if (!boss) {
    if (b === 0 || b === 3 || b === 4) {                               // kick
      auTone(d, 'sine', 120, 42, 0.22, b === 0 ? 0.34 : 0.24, { at, atk: 0.003 });
      auNz(d, 0.05, 0.08, 900, 200, 'lowpass', 1, { at, atk: 0.002 });
    }
    if (b === 2 || b === 6) auNz(d, 0.22, 0.2, 240, 120, 'lowpass', 1.2, { at, atk: 0.004 });   // low noise tom
    if (b & 1) auNz(d, 0.04, 0.022, 6000, 5000, 'highpass', 0.7, { at, atk: 0.002 });
    const s = AUDIO_OSTINATO[bar & 1][b];
    if (s !== null) { const f = root * Math.pow(2, s / 12); auTone(d, 'sawtooth', f, 0, 0.2, 0.05, { at, atk: 0.005, lp: 1100, lp1: 280, q: 3 }); }
  } else {
    if (b === 0 || b === 3 || b === 6) {                               // taiko, 3+3+2
      auTone(d, 'sine', 90, 34, 0.5, b === 0 ? 0.44 : 0.34, { at, atk: 0.003 });
      auNz(d, 0.35, 0.3, 300, 80, 'lowpass', 1.4, { at, atk: 0.003 });
    } else auNz(d, 0.05, 0.03, 4000, 3000, 'bandpass', 2, { at, atk: 0.002 });
    if (b === 0 && (bar & 1) === 0) {                                  // a minor-second pad under every two bars
      const len = spe * 16;
      auTone(d, 'sawtooth', root / 2, 0, len, 0.04, { at, atk: 0.6, hold: len * 0.7, lp: 320 });
      auTone(d, 'sawtooth', root / 2 * Math.pow(2, 1 / 12), 0, len, 0.028, { at, atk: 0.6, hold: len * 0.7, lp: 320 });
    }
    const f = root / 2 * Math.pow(2, AUDIO_OSTINATO_BOSS[b] / 12);
    auTone(d, 'sawtooth', f, 0, 0.24, 0.06, { at, atk: 0.005, lp: 700, lp1: 200, q: 4 });
  }
}

/* ───────────── per-frame ───────────── */
function auListener() {
  const L = AUDIO.ctx.listener, p = camera.position, q = camera.quaternion;
  AUDIO_FWD.set(0, 0, -1).applyQuaternion(q);
  AUDIO_UP.set(0, 1, 0).applyQuaternion(q);
  if (L.positionX) {
    L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
    L.forwardX.value = AUDIO_FWD.x; L.forwardY.value = AUDIO_FWD.y; L.forwardZ.value = AUDIO_FWD.z;
    L.upX.value = AUDIO_UP.x; L.upY.value = AUDIO_UP.y; L.upZ.value = AUDIO_UP.z;
  } else {
    L.setPosition(p.x, p.y, p.z);
    L.setOrientation(AUDIO_FWD.x, AUDIO_FWD.y, AUDIO_FWD.z, AUDIO_UP.x, AUDIO_UP.y, AUDIO_UP.z);
  }
}
function updateAudio(dt) {
  AUDIO.learned = false;
  const c = AUDIO.ctx;
  if (!c) return;
  if (c.state !== 'running') { if (!AUDIO.hidden) auArm(); return; }   // suspended: schedule nothing
  try {
    dt = clamp(+dt || 0, 0, 0.1);
    AUDIO.clock += dt;
    const tick = (AUDIO.tick += dt) >= 0.05;                          // params update at ~20 Hz
    if (tick) AUDIO.tick = 0;
    auSyncVolumes();
    auListener();
    auFootsteps();
    auGlideUpdate(tick);
    auAmbience(dt, tick);
    auMusic(dt, tick);
  } catch (err) { auWarn(err); }
}

/* ───────────── events ───────────── */
BUS.on('sfx', e => { if (e && e.id) auPlay(e.id, e); });
BUS.on('toast', t => { if (t && typeof t.text === 'string' && t.text.startsWith('Learned')) AUDIO.learned = true; });
BUS.on('vesselBreak', () => auPlay('break'));                           // merges with the 'break' sfx fired alongside
BUS.on('levelUp', () => auPlay('levelUp'));
BUS.on('pickup', kind => auPlay('pickup', { kind }));
BUS.on('tell', p => { if (p) auPlay(p.unblockable ? 'tellHeavy' : 'tell', { pos: p.e && p.e.pos }); });
BUS.on('land', v => { if (+v > 6) auLand(+v); });
BUS.on('glide', on => { try { auGlide(!!on); } catch (err) { auWarn(err); } });
BUS.on('discover', () => auPlay('discover'));
BUS.on('waystone', () => auPlay('waystone'));

if (DEV) window.__mvAudio = AUDIO;
initAudio();         // arms the gesture listener; the context itself waits for a click or key
