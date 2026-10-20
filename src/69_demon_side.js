/* ═══════════════════════════════════════════════════════════════════════
   THE WASTE, OFF THE TRACK — things to find and do on the Demon Continent
   besides the road home.

   Five chests (the same iron-bound kind, the waste's own notes); a Migurd
   trader by the square who barters bitter-root draughts and a cloak woven
   for the waste; and THE LOST HUNTER — a Migurd woman whose husband went
   into the canyon after a rock-scorpion nest two days ago. He's alive,
   cornered in the canyon's bed. Bring him home.
   ═══════════════════════════════════════════════════════════════════════ */
const DC_CACHE_SPOTS = [
  { id: 'dcSpire', x: 262, z: 2020, boon: { prof: 'fire' }, who: 'A scorched satchel',
    t: 'Whoever carried this was a fire-mage, and not a careful one: half the pages are ash. The half that is left is about how fire breathes. You understand it a little better than you did.' },
  { id: 'dcCanyon', x: 560, z: 1785, boon: { stamina: 5 }, who: 'A Migurd hunter\'s cache',
    t: 'Dried meat, sinew thread, and a pair of soft hide boots too small for anyone but a Migurd — or a child. They fit you.' },
  { id: 'dcBones', x: 668, z: 1912, boon: { prof: 'earth' }, who: 'A scholar\'s notes',
    t: 'Measurements of every rib, a sketch of the skull, and a conclusion underlined three times: "NOT a dragon. Then WHAT?" The way the bones lie in the stone tells you something about weight.' },
  { id: 'dcGlass', x: 1118, z: 1598, boon: { prof: 'wind' }, who: 'A knot of lightning-glass',
    t: 'Where the bolts strike most, the sand has fused into glass branches. One is hollow, and it hums. Holding it, you feel the air move a moment before it does.' },
  { id: 'dcCaravan', x: 1145, z: 1930, boon: { hp: 8 }, who: 'A caravan master\'s strongbox',
    t: 'The ledger stops mid-line, the week the nest woke. Under it, a flask of Rikarisu brandy with a merchant\'s blessing scratched into the cork. You drink to him.' },
];

/* ───────────── the Migurd trader ───────────── */
const MIGURD_WARES = [
  { id: 'migDraught', name: 'Bitter-Root Draught', price: 32, desc: () => `Migurd medicine: a root tea so bitter it makes your eyes water. Drink it (${IN.label('drink')}) and it closes wounds like any draught. You can carry ${draughtCap()}.`,
    sold: () => (G.draughts || 0) >= draughtCap(), soldTag: () => 'Flasks full', have: () => (G.draughts || 0) + ' / ' + draughtCap(), buy: () => { G.draughts = (G.draughts || 0) + 1; } },
  { id: 'migMeat', name: 'Smoked Waste-Hare', price: 6, sold: () => G.hp >= G.maxHp, soldTag: () => 'Not hungry',
    desc: () => 'Tough, salty, better than it looks. Closes your wounds.', buy: () => { const h = Math.round(G.maxHp - G.hp); G.hp = G.maxHp; if (h > 0) BUS.emit('healNumber', h); } },
  { id: 'migCloak', name: 'Waste Cloak', price: 150, desc: () => 'Woven from ogre-hair and dyed with ash: ugly, warm, and it turns a claw. Max health +12.',
    sold: () => !!gear().wasteCloak, buy: () => { gear().wasteCloak = 1; G.maxHp += 12; G.hp = G.maxHp; } },
  { id: 'migQuiet', name: 'Quiet-Mind Charm', price: 120, desc: () => 'A bead the Migurd children wear to sleep through the mind-voice. On you it does something else: Max stamina +8.',
    sold: () => !!gear().quietCharm, buy: () => { gear().quietCharm = 1; G.maxStamina += 8; G.stamina = G.maxStamina; } },
];
VENDORS.migurd = { title: 'Migurd Barter', wares: () => MIGURD_WARES, price: p => p };
const TRADER_LINES = ['Silver? Here? ...Oh, the caravans used to take it. When there were caravans. Yes, all right.',
  'Bitter-root, smoked hare, a good cloak. Everything a person needs, and nothing they want.', 'You trade like an outsider: with your mouth. It\'s charming.'];

/* ───────────── the lost hunter ───────────── */
const HUNTER_AT = { x: 562, z: 1658 };              // (in the canyon's bed)
const HUNTER_LINES = {
  ask: [
    { s: 'Migurd Woman', t: 'You\'re the outsiders who came with Ruijerd. ...You fight. I saw your hands.' },
    { s: 'Migurd Woman', t: 'My husband went into the dry canyon two days ago, after a rock-scorpion nest. His voice stopped yesterday. Not gone — just very quiet. Too quiet to hear from here.' },
    { s: 'Migurd Woman', t: 'Please. The canyon runs down the west of the waste, past the village gate and south. If he\'s alive, he\'s in its bed.' },
  ],
  found: [
    { s: 'Migurd Hunter', t: '...Outsiders? In the canyon? Then the world really has ended.' },
    { s: 'Migurd Hunter', t: 'I can walk. Badly. Tell my wife I\'m coming — no, she knows already. She\'ll have heard me the moment you stepped in. She\'ll be furious.' },
  ],
  thanks: [
    { s: 'Migurd Woman', t: 'He\'s home. He\'s furious with himself, and I\'m furious with him, and we\'re both so glad we can\'t stop shouting. Inside our heads. You can\'t hear it. Lucky you.' },
    { s: 'Migurd Woman', t: 'Take this — hunting tea. We brew it for the long hunts. It makes a body tougher than it has any right to be.' },
  ],
};
const DCSIDE = { busy: false };

function buildDemonSide() {
  for (const s of DC_CACHE_SPOTS) buildCacheAt(s);
  resetCaches();
  const M = DC_SPOTS.migurd;
  new NPC('migTrader', MIGURD_SPEC('#5a86c8', '#8a6a42', '#4a3a2c', 'Rogue', 0.84), M.x + 12.5, M.z - 8.5, { name: 'Migurd Trader', idle: 'Idle', face: -2.4,
    talk: async n => { await npcSay(n, [{ s: n.name, t: pick(TRADER_LINES) }]); openShop('migurd'); } });
  new NPC('migWife', MIGURD_SPEC('#4a7ad0', '#6a6a8a', '#3a3446', 'Mage', 0.82), M.x - 15.5, M.z + 10.5, { name: 'Migurd Woman', idle: 'Idle', face: 0.9, talk: n => talkHunterWife(n) });
  new NPC('migHunter', MIGURD_SPEC('#4572c0', '#7a6a52', '#3e352c', 'Rogue', 0.86), HUNTER_AT.x, HUNTER_AT.z, { name: 'Migurd Hunter', idle: 'Sit_Floor_Idle', face: 0.4, talk: n => talkHunter(n) });
  // the scorpions that have him pinned (they come when you've been asked to look)
  defineEncounter('dcHunter', HUNTER_AT.x, HUNTER_AT.z + 4, [['rustScorp', 0, 0], ['rustScorp', 5, 3], ['rustScorp', -5, 4]], { flag: 'lostHunterAsked' });
  resetDemonSide();
}
async function talkHunterWife(n) {
  if (DCSIDE.busy) return;
  const st = G.flags.lostHunter;
  if (!dcAt('dcRest')) return npcSay(n, [{ s: n.name, t: 'Welcome, outsider. The elder is in the longhouse.' }]);
  DCSIDE.busy = true;
  try {
    if (!st) {
      await npcSay(n, HUNTER_LINES.ask);
      G.flags.lostHunter = 'asked'; G.flags.lostHunterAsked = true;
      resetDemonSide();                                   // he's out there now, in the canyon's bed
      toast('Request — The Lost Hunter', 'big'); later(0.7, () => toast('Find the Migurd hunter in the dry canyon, south-west of the village.'));
      autosave();
    } else if (st === 'asked') await npcSay(n, [{ s: n.name, t: 'The canyon. Please. His voice is still there — just.' }]);
    else if (st === 'found') {
      await npcSay(n, HUNTER_LINES.thanks);
      G.flags.lostHunter = 'done';
      G.maxHp += 10; G.hp = G.maxHp; G.coin = (G.coin || 0) + 60; gainXp(220);
      toast('Migurd hunting tea — Max health +10  ·  60 silver', 'good');
      resetDemonSide(); autosave();
    } else await npcSay(n, [{ s: n.name, t: pick(['He\'s mending. Slowly. He says thank you; I say it louder.', 'Come by when you like. The fire\'s always lit.']) }]);
  } finally { DCSIDE.busy = false; }
}
async function talkHunter(n) {
  if (DCSIDE.busy || G.flags.lostHunter !== 'asked') return;
  const E = ENCOUNTERS.find(e => e.id === 'dcHunter');
  if (E && (E.active && E.live.some(e => !e.dead))) { hint('Clear the scorpions first.', 2.5); return; }
  DCSIDE.busy = true;
  try {
    await npcSay(n, HUNTER_LINES.found);
    G.flags.lostHunter = 'found';
    await fadeOut(0.5);
    resetDemonSide();
    await fadeIn(0.5);
    hint('Take the news back to the village. (She already knows. Go anyway.)', 4);
    autosave();
  } finally { DCSIDE.busy = false; }
}
// who stands where for the request's state
function resetDemonSide() {
  DCSIDE.busy = false;
  const H = NPCS.migHunter, W = NPCS.migWife; if (!H || !W) return;
  const st = G && G.flags.lostHunter;
  if (st === 'found' || st === 'done') {
    H.moveTo(W.pos.x + 1.4, W.pos.z + 0.8, 2.2); H.actor.loop('Idle', { fade: 0 }); H.idle = 'Idle';
  } else { H.moveTo(HUNTER_AT.x, HUNTER_AT.z, 0.4); H.actor.loop('Sit_Floor_Idle', { fade: 0 }); H.idle = 'Sit_Floor_Idle'; }
  H.setVisible(!!st);                                   // (no one in the canyon until you're told to look)
}
// the journal's "Requests"
function dcQuestRows() {
  const st = G && G.flags.lostHunter;
  if (!st) return [];
  return [['The Lost Hunter', st === 'asked' ? 'Find him in the dry canyon' : st === 'found' ? 'Tell his wife' : 'Done — hunting tea']];
}
