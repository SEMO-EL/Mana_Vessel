/* ═══════════════════════════════════════════════════════════════════════
   THE RAIDERS' NOTCH — a camp of horned raiders under the north mesas.

   They took a caravan before the nest took the rest, and kept the trader
   who ran it, in a cage. Ghoro the Horned keeps the camp (a field boss:
   he calls the camp to him at half). Clear it, open the cage, and Okkah
   the trader walks back to the Migurd with you in spirit and sets up shop
   by the square: a demon-glass lens for your staff, a waste-forged edge
   for your sword, a horn amulet, draughts.
   ═══════════════════════════════════════════════════════════════════════ */
DC_SPOTS.raiders = { x: 780, z: 1560, r: 34 };
Object.assign(PLACES, { dcRaiders: { x: 780, z: 1560, r: 55, name: 'The Raiders\' Notch', sub: 'Horns, and whatever they took' } });
Object.assign(MAP_LABELS, { dcRaiders: { dz: -50, size: 'mid' } });

const demonHorns = (k = 1) => a => {
  const head = a.bones.head; if (!head) return;
  const m = toonMat({ color: '#2a2224', rim: true });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.09 * k, 0.44 * k, 6), m);
    h.position.set(s * 0.27, 0.96, 0.12); h.rotation.set(-0.35, 0, s * -0.5); h.castShadow = true; head.add(h);
  }
};
const RAIDER_SKIN = { 0: '#8a7aa0', 23: '#8a7aa0' };
ENEMY_DEFS.raider = {
  name: 'Waste Raider', base: 'Barbarian', show: ['1H_Axe'], hide: ['Barbarian_Hat', 'Barbarian_Cape'], extra: [demonHorns(1)],
  recolor: { barbarian: { ...RAIDER_SKIN, 1: '#2a2224' } },
  hp: 150, poise: 40, r: 0.42, h: 1.8, walk: 1.9, run: 5.4, sight: 26, hear: 13, xp: 52, weight: 1, flinchAt: 10,
  idle: 'Idle', walkClip: 'Walking_B', runClip: 'Running_A',
  attacks: [
    { clip: '1H_Melee_Attack_Slice_Diagonal', speed: 1.1, hitAt: 0.42, range: [0, 2.6], reach: 2.4, arc: 1.0, dmg: 18, poise: 22, lunge: 2.5 },
    { clip: '1H_Melee_Attack_Chop',           speed: 1.0, hitAt: 0.45, range: [0, 2.6], reach: 2.3, arc: 0.8, dmg: 22, poise: 28, lunge: 2 },
  ],
};
ENEMY_DEFS.raiderBow = {
  name: 'Raider Crossbow', base: 'Rogue', show: ['1H_Crossbow'], extra: [demonHorns(0.85)],
  recolor: { rogue: { ...RAIDER_SKIN, 1: '#2a2224', 8: '#4a3a4e', 21: '#4a3a4e', 9: '#2e2830' } },
  hp: 100, poise: 22, r: 0.4, h: 1.7, walk: 1.8, run: 4.6, sight: 34, hear: 12, xp: 46, weight: 1, flinchAt: 8, keepDist: 13,
  idle: 'Idle', walkClip: 'Walking_B', runClip: 'Running_A',
  attacks: [{ clip: '1H_Ranged_Shoot', speed: 0.8, hitAt: 0.35, range: [4, 32], ranged: { spd: 44, dmg: 18, r: 0.1, col: '#e8d8b0', gravity: 1.5 }, aimClip: '1H_Ranged_Aiming' }],
};
ENEMY_DEFS.raiderChief = {
  name: 'Ghoro the Horned', base: 'Barbarian', show: ['2H_Axe'], hide: ['Barbarian_Hat'], extra: [demonHorns(1.5)], scale: 1.3,
  recolor: { barbarian: { 0: '#8a4a3a', 23: '#8a4a3a', 1: '#1e1a1c' } },
  hp: 900, poise: 170, r: 0.6, h: 2.3, walk: 1.6, run: 4.4, sight: 30, hear: 18, xp: 340, weight: 3, flinchAt: 40, knockRes: 0.6, boss: true, armorWindup: true,
  idle: '2H_Melee_Idle', walkClip: 'Walking_B', runClip: 'Running_A',
  attacks: [
    { clip: '2H_Melee_Attack_Chop',  speed: 0.8,  hitAt: 0.5,  range: [0, 3.4], reach: 3.1, arc: 0.9, dmg: 30, poise: 55, lunge: 2.5 },
    { clip: '2H_Melee_Attack_Slice', speed: 0.85, hitAt: 0.45, range: [0, 3.4], reach: 3.3, arc: 1.8, dmg: 24, poise: 40, lunge: 2 },
    { clip: '1H_Melee_Attack_Jump_Chop', speed: 0.85, hitAt: 0.5, range: [3, 7], reach: 2.8, arc: 0.8, dmg: 34, poise: 60, lunge: 7, unblockable: true },
  ],
  phase2: { at: 0.5, speedMul: 1.15, summon: { key: 'raider', n: 2, dist: 8 }, attacks: [] },
};

/* ───────────── the camp ───────────── */
const RAID = { cage: null, busy: false };
function buildRaiderCamp() {
  const C = DC_SPOTS.raiders, out = [], R = mulberry32(8181);
  const y0 = C.lv ?? heightAt(C.x, C.z);
  // a palisade across the open side (the mesa wall is the back), gap in the middle
  for (let i = -5; i <= 5; i++) {
    if (Math.abs(i) < 1) continue;
    placeProp('fence_wood_straight', C.x + i * 4.4, C.z + 26, { s: 3.8, rot: Math.PI / 2, pad: 0.6 });
  }
  for (const [dx, dz, rot] of [[-14, -6, 0.6], [12, -9, -0.5], [-6, -16, 0.1], [16, 4, -1.2]]) placeProp('tent', C.x + dx, C.z + dz, { s: 7, rot });
  for (const [dx, dz, k] of [[6, 10, 'crate_A_big'], [8, 11.5, 'barrel'], [-10, 8, 'crate_B_big'], [-11.5, 9.6, 'sack'], [3, -12, 'barrel'], [-2, 14, 'crate_A_small']]) placeProp(k, C.x + dx, C.z + dz, { s: 2.5, rot: R() * TAU, pad: 0.8 });
  // the fire, ringed with horned skulls on stakes
  const fx = C.x - 1, fz = C.z + 2, fy = heightAt(fx, fz);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; out.push([new THREE.DodecahedronGeometry(0.34, 0), '#3a3230', fx + Math.cos(a) * 1.2, fy + 0.15, fz + Math.sin(a) * 1.2]); }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + 0.4, x = fx + Math.cos(a) * 3.2, z = fz + Math.sin(a) * 3.2, y = heightAt(x, z);
    out.push([new THREE.CylinderGeometry(0.05, 0.07, 2.2, 5), '#3e3028', x, y + 1.1, z]);
    out.push([new THREE.SphereGeometry(0.28, 8, 6), '#d9cdb2', x, y + 2.3, z, 1, 0.85, 1.2]);
    for (const s of [-1, 1]) out.push([new THREE.ConeGeometry(0.06, 0.4, 5), '#c8b998', x + s * 0.24, y + 2.55, z, 1, 1, 1, 0, 0, -s * 0.6]);
  }
  RAID.fire = new THREE.Vector3(fx, fy + 0.4, fz);
  // the cage: a timber floor, eight bars, a lid — the trader inside
  const cx = C.x + 9, cz = C.z - 2, cy = heightAt(cx, cz);
  out.push([new THREE.BoxGeometry(2.6, 0.2, 2.6), '#4a3a2c', cx, cy + 0.1, cz], [new THREE.BoxGeometry(2.8, 0.2, 2.8), '#3e3028', cx, cy + 2.6, cz]);
  const bars = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, x = cx + Math.cos(a) * 1.25, z = cz + Math.sin(a) * 1.25; bars.push([new THREE.CylinderGeometry(0.05, 0.05, 2.5, 5), '#2a2420', x, cy + 1.35, z]); }
  const barMesh = mergedPart(bars, dcMat('vc', { vertexColors: true }));
  STRUCT.group.add(barMesh);
  RAID.cage = { x: cx, z: cz, y: cy, bars: barMesh, col: addCircle(cx, cz, 1.35, cy - 1, cy + 2.7, 'cage') };
  const m = mergedPart(out, dcMat('vc', { vertexColors: true })); m.receiveShadow = true;
  STRUCT.group.add(m);
  // the trader, and the camp's strongbox
  new NPC('dcOkkah', { base: 'Rogue', scale: 0.95, recolor: { rogue: { 0: '#b48a6a', 23: '#b48a6a', 1: '#5a3a2a', 8: '#7a6a3a', 21: '#7a6a3a', 9: '#4a3a2c' } } }, cx, cz,
    { name: 'Okkah, Trader', idle: 'Sit_Floor_Idle', face: Math.PI, talk: n => talkOkkah(n) });
  buildCacheAt({ id: 'dcRaid', x: C.x - 16, z: C.z + 2, boon: { hp: 8 }, who: 'Ghoro\'s strongbox',
    t: 'A raider\'s idea of treasure: a gold tooth, three wedding rings, and a stoppered horn of something that burns all the way down and leaves you feeling sturdier for it.' });
  defineEncounter('dcRaiders', C.x, C.z, [
    ['raider', -6, 6], ['raider', 7, 8], ['raider', -12, -2], ['raider', 4, -6],
    ['raiderBow', -14, 18], ['raiderBow', 14, 18], ['raiderChief', 0, -6, { face: Math.PI }],
  ], { boss: true, onClear: () => { G.flags.raiders = true; G.flags.dcRaiders = true; banner('Field Boss Felled', 'Ghoro the Horned'); later(2, () => hint('The trader in the cage is still alive.', 3)); } });
  resetRaiders();
}
const OKKAH_LINES = {
  caged: [{ s: 'Okkah, Trader', t: 'Psst! Outsiders! Get me out of — no, wait, kill the big horned one FIRST, then get me out. Order matters!' }],
  freed: [
    { s: 'Okkah, Trader', t: 'Free! Free, and only slightly robbed. Okkah, trader, of the Rikarisu road — or I was, till the nest ate my wagons and that lot ate my dignity.' },
    { s: 'Okkah, Trader', t: 'The Migurd will put up with me. I\'ll set out what the raiders didn\'t smash, by their square. For you, a fair price. For everyone else, a Rikarisu price.' },
  ],
  shop: ['Fair prices for Dead End! Unfair prices for everyone else.', 'Demon-glass, horn, good steel. All of it honestly recovered.', 'The raiders had taste, I\'ll give them that. My taste.'],
};
async function talkOkkah(n) {
  if (RAID.busy) return;
  if (G.flags.okkah === 'freed') { await npcSay(n, [{ s: n.name, t: pick(OKKAH_LINES.shop) }]); openShop('okkah'); return; }
  if (!G.flags.raiders) return npcSay(n, OKKAH_LINES.caged);
  RAID.busy = true;
  try {
    // the cage door gives; he shakes your hand, and he's off to the Migurd
    RAID.cage.bars.visible = false; if (!RAID.cage.gone) { removeCollider(RAID.cage.col); RAID.cage.gone = true; }
    n.actor.loop('Idle', { fade: 0.2 });
    await npcSay(n, OKKAH_LINES.freed);
    G.flags.okkah = 'freed'; gainXp(120);
    toast('Okkah will trade by the Migurd square', 'good');
    await fadeOut(0.4); resetRaiders(); await fadeIn(0.4);
    autosave();
  } finally { RAID.busy = false; }
}
// his stall: what he saved, and what he "recovered"
const OKKAH_WARES = [
  { id: 'okDraught', name: 'Healing Draught', price: 30, desc: () => `A real Milis draught, a long way from Milis. Drink it (${IN.label('drink')}). You can carry ${draughtCap()}.`,
    sold: () => (G.draughts || 0) >= draughtCap(), soldTag: () => 'Flasks full', have: () => (G.draughts || 0) + ' / ' + draughtCap(), buy: () => { G.draughts = (G.draughts || 0) + 1; } },
  { id: 'okBandolier', name: 'Draught Bandolier', price: 160, desc: () => 'Leather, loops for five flasks instead of three. The raiders were using it to hold knives.', sold: () => !!gear().bandolier, buy: () => { gear().bandolier = 1; } },
  { id: 'okLens', name: 'Demon-Glass Lens', price: 150, desc: () => 'A lens of black demon-glass set into your staff\'s head. Spells strike — and heal — 10% harder, on top of any other core.', sold: () => !!gear().lens, buy: () => { gear().lens = 1; } },
  { id: 'okEdge', name: 'Waste-Forged Edge', price: 150, desc: () => 'Your blade reground on Rikarisu stone. Sword blows strike 12% harder, on top of any other edge.', sold: () => !!gear().wasteEdge, buy: () => { gear().wasteEdge = 1; } },
  { id: 'okHorn', name: 'Horn Amulet', price: 120, desc: () => 'A sliver of raider horn on a thong. The Migurd say it keeps a body stubborn. Max health +15.', sold: () => !!gear().horn, buy: () => { gear().horn = 1; G.maxHp += 15; G.hp = G.maxHp; } },
];
VENDORS.okkah = { title: 'Okkah\'s Recovered Goods', wares: () => OKKAH_WARES, price: p => p };
// where he is: caged at the Notch, or at his stall by the Migurd square
function resetRaiders() {
  RAID.busy = false;
  const n = NPCS.dcOkkah, C = RAID.cage; if (!n || !C) return;
  const freed = G && G.flags.okkah === 'freed';
  C.bars.visible = !freed;
  if (freed && !C.gone) { removeCollider(C.col); C.gone = true; }
  if (!freed && C.gone) { C.col = addCircle(C.x, C.z, 1.35, C.y - 1, C.y + 2.7, 'cage'); C.gone = false; }
  if (freed) {
    const M = DC_SPOTS.migurd;
    n.moveTo(M.x + 16.5, M.z + 6.5, -2.0); n.actor.loop('Idle', { fade: 0 }); n.idle = 'Idle';
  } else {
    n.moveTo(C.x, C.z, Math.PI); n.actor.loop('Sit_Floor_Idle', { fade: 0 }); n.idle = 'Sit_Floor_Idle';
  }
}
