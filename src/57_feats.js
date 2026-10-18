/* ═══════════════════════════════════════════════════════════════════════
   FEATS — the long goals, for whoever wants them: every place found,
   every chest opened, five travellers saved, a Saint-rank spell, five
   kilometres in the saddle. Checked once a second; a toast when one
   lands; the journal lists them all (the ones still ahead too, so you
   know what there is to do).
   ═══════════════════════════════════════════════════════════════════════ */
const FEATS = [
  { id: 'blood',     name: 'First Blood',        desc: 'Fell your first foe.',                        test: () => G.kills >= 1 },
  { id: 'veteran',   name: 'Veteran',            desc: 'Fell a hundred foes.',                        test: () => G.kills >= 100 },
  { id: 'seasoned',  name: 'Seasoned',           desc: 'Reach level 10.',                             test: () => G.lvl >= 10 },
  { id: 'riposte',   name: 'Riposte',            desc: 'Parry ten blows.',                            test: () => (G.flags.parries || 0) >= 10 },
  { id: 'schools',   name: 'Five Schools',       desc: 'Learn an Intermediate spell in every school.', test: () => Object.keys(SCHOOLS).every(s => SPELLS.some(sp => sp.school === s && sp.rank >= 1 && isLearned(sp))) },
  { id: 'saint',     name: 'Saint-Rank',         desc: 'Learn a Saint-rank spell.',                   test: () => SPELLS.some(sp => sp.rank >= 3 && isLearned(sp)) },
  { id: 'student',   name: 'Roxy\'s Student',    desc: 'Find all five of Roxy\'s pages.',             test: () => G.pages.length >= 5 },
  { id: 'mapper',    name: 'Cartographer',       desc: 'Discover every named place.',                 test: () => Object.keys(PLACES).every(k => G.discovered[k]) },
  { id: 'wayfarer',  name: 'Wayfarer',           desc: 'Awaken every waystone.',                      test: () => WSTONE.list.every(w => G.waystones[w.id]) },
  { id: 'vessel',    name: 'Brimming Vessel',    desc: 'Take every mana crystal.',                    test: () => CRYSTALS.list.length > 0 && crystalsGot() >= CRYSTALS.list.length },
  { id: 'chests',    name: 'Treasure Hunter',    desc: 'Open every hidden chest.',                    test: () => CACHES.list.length > 0 && cachesGot() >= CACHES.list.length },
  { id: 'samaritan', name: 'Good Samaritan',     desc: 'Save five travellers on the road.',           test: () => (G.flags.helped || 0) >= 5 },
  { id: 'board',     name: 'Clean Board',        desc: 'Claim every bounty: the Guild\'s board and Buena\'s.',      test: () => !!G.bounties && BOUNTIES.every(b => G.bounties[b.id] === 'paid') },
  { id: 'scholar',   name: 'The Old Tongue',     desc: 'Read the old stones for Roa\'s scribe.',      test: () => G.flags.scribe === 'done' },
  { id: 'errands',   name: 'Good Neighbour',     desc: 'See all four errands through (Gerard, Lilia, Gerd, Hilde).', test: () => ['flock', 'moon', 'ashback', 'caravan'].every(k => G.flags[k] === 'done') },
  { id: 'bestiary',  name: 'Bestiary',           desc: 'Fell one of every beast of the wilds: wolf, jackal, boar, bear, scorpion, wisp.', test: () => bestiaryGot() === BESTIARY.length },
  { id: 'mud',       name: 'Mudslinger',         desc: 'Learn Quagmire from Magister Wenna.',          test: () => !!G.flags.spell_quagmire },
  { id: 'rider',     name: 'Horselord',          desc: 'Ride Kestrel for five kilometres.',           test: () => (G.flags.rideM || 0) >= 5000 },
  { id: 'chapter2',  name: 'The Boreas Girl',    desc: 'See Chapter II through.',                     test: () => G.quest === 'done' },
];
// the wilds' beasts, one of each, for the bestiary (kill counts kept by kind)
const BESTIARY = [['wolf', 'Wolf'], ['jackal', 'Dust Jackal'], ['boar', 'Tusked Boar'], ['bear', 'Forest Bear'], ['scorpion', 'Sand Scorpion'], ['wisp', 'Marsh Wisp']];
BUS.on('enemyKilled', e => { if (!G) return; const kc = G.flags.kc || (G.flags.kc = {}); kc[e.key] = (kc[e.key] || 0) + 1; });
const bestiaryGot = () => BESTIARY.filter(([k]) => G.flags.kc && G.flags.kc[k]).length;
const FEATS_T = { t: 1 };
BUS.on('parry', () => { if (G) G.flags.parries = (G.flags.parries || 0) + 1; });

function featHeld(f) { try { return !!f.test(); } catch (e) { return false; } }
function updateFeats(dt) {
  if (!G) return;
  if (PL.state === 'ride' && typeof HORSE !== 'undefined') G.flags.rideM = (G.flags.rideM || 0) + Math.abs(HORSE.speed) * dt;
  if ((FEATS_T.t -= dt) > 0) return;
  FEATS_T.t = 1;
  // a save from before feats: what's already done is done, quietly
  if (!G.feats) { G.feats = FEATS.filter(featHeld).map(f => f.id); return; }
  if (UI.dlg) return;                                     // after the conversation, not over it
  for (const f of FEATS) {
    if (G.feats.includes(f.id) || !featHeld(f)) continue;
    G.feats.push(f.id);
    toast('Feat — ' + f.name, 'big');
    BUS.emit('sfx', { id: 'discover' });
    break;                                                // one at a time
  }
}
function featRows() {
  const got = G.feats || [];
  return FEATS.map(f => [f, got.includes(f.id)]);
}
