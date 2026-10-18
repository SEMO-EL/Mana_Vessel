/* ═══════════════════════════════════════════════════════════════════════
   SIDE QUESTS & RUMOURS — small stories off the main road.

   "The Old Tongue": Old Tomas, Roa's scribe, wants the words cut into the
   Sunstones' altar and the Fallen Colossus' breastplate. Read both, bring
   them back: he pays in experience and an old breathing discipline that
   deepens the vessel.
   Rumours: what people in Roa say about the basin, some of it true.
   ═══════════════════════════════════════════════════════════════════════ */
const INSCRIPTIONS = {
  sun: { at: () => ({ x: LANDMARKS.sunstones.x, z: LANDMARKS.sunstones.z + 1.6 }), label: 'Read the altar',
    lines: [{ t: 'Cut into the altar in a script older than the Asura Kingdom: "When the sun stands in the ninth stone, the land remembers what it was."' },
      { t: 'Below it, newer and much clumsier: "BRAM WAS HERE."' }] },
  col: { at: () => ({ x: LANDMARKS.colossus.x - 1.5, z: LANDMARKS.colossus.z + 3.3 }), label: 'Read the breastplate',
    lines: [{ t: 'Across the stone breastplate, worn almost smooth: "He held the wall until the wall was gone. Let him lie where he held it."' }] },
};
const SCRIBE_LINES = {
  offer: [
    { s: 'Old Tomas, Scribe', t: 'You walk the basin, mage. Will you read for an old man whose knees have retired? There are words cut into the Sunstones\' altar, south-east of the gardens.' },
    { s: 'Old Tomas, Scribe', t: 'And on the stone giant in the north meadows — the Colossus, the children call him. Bring me what they say. Exactly what they say.' },
  ],
  waiting: [{ s: 'Old Tomas, Scribe', t: 'The Sunstones, south-east. The Colossus, north of the walls. Read them both — I\'ve waited fifty years, I can wait a few days more. Barely.' }],
  done: [
    { s: 'Old Tomas, Scribe', t: '"The land remembers what it was"... and "he held the wall until the wall was gone." So the First Wall had a keeper before it had a golem.' },
    { s: 'Old Tomas, Scribe', t: 'Roa\'s history just got a thousand years older, and I have a book to rewrite. Here — a breathing discipline from the same age. It will widen what you carry.' },
  ],
  after: [{ s: 'Old Tomas, Scribe', t: 'Chapter four, "The Keeper of the Wall." Chapter five is going to be your fault, I can feel it.' }],
};

// Ghislaine, once she's tested you, will go again whenever you take a blade from her rack
const GHIS_BOUT = {
  ask: ['Again? Good. Take a blade.', 'Shoulders, not the sword. Begin.', 'Eris is watching. Don\'t embarrass me.'],
  win: ['Better. Your feet listened this time.', 'Hm. You hit me. Remember how.', 'Good. Again tomorrow.'],
  lose: ['Dead. Twice. Breathe, then come back.', 'You watched the blade. Watch the shoulders.', 'Too slow. Faster costs nothing.'],
};
const pastFirstSpar = () => !!G && (G.quest === 'done' || ROA_STEPS.indexOf(G.quest) > ROA_STEPS.indexOf('ghislaine'));
function buildBoutRack() {
  const Y = ROA.spots.yard, x = Y.x + 11.5, z = Y.z + 1;
  INTERACTABLES.push({ pos: new THREE.Vector3(x, heightAt(x, z), z), r: 3, label: () => 'Take a practice blade — spar with Ghislaine',
    enabled: () => pastFirstSpar() && !UI.spar && NPCS.ghislaine && NPCS.ghislaine.visible && G.quest !== 'birthday',
    action: async () => {
      const n = NPCS.ghislaine;
      await npcSay(n, [{ p: 'ghislaine', s: 'Ghislaine Dedoldia', t: pick(GHIS_BOUT.ask) }]);
      startSpar('ghislaine', 'ghisSpar', {
        yieldAt: 0.5,
        onWin: () => {
          G.flags.ghisBouts = (G.flags.ghisBouts || 0) + 1;
          gainXp(Math.max(15, 45 - G.flags.ghisBouts * 5));
          npcSay(NPCS.ghislaine, [{ p: 'ghislaine', s: 'Ghislaine Dedoldia', t: pick(GHIS_BOUT.win) }]);
        },
        onLose: () => npcSay(NPCS.ghislaine, [{ p: 'ghislaine', s: 'Ghislaine Dedoldia', t: pick(GHIS_BOUT.lose) }]),
      });
    } });
}
// The world answers what you did: a merchant back at Wagonbreak once the brigands are gone,
// a scholar at the First Wall once the golem's down (by day), the dead in its ring by night.
function buildAftermath() {
  const W = WAGON_CAMP, F = FIRST_WALL;
  new NPC('oswin', { base: 'Barbarian', recolor: { barbarian: { 1: '#6a4a2a', 6: '#4a5a6a' } }, hide: ['Barbarian_Hat'] }, W.x - 3, W.z + 5,
    { name: 'Oswin, Merchant', face: 2.4, idle: 'Use_Item', talk: n => npcSay(n, [{ s: 'Oswin, Merchant', t: pick([
      'You\'re the one who cleared them out? The road\'s moving again. Three wagons through this week, and not one robbed.',
      'Brannoc took my best cart. I\'m told you took Brannoc. Seems fair.',
      'If you\'re headed east, mind the jackals. If you\'re headed west, mind the prices in Roa.']) }]) });
  new NPC('scholar', { base: 'Mage', recolor: { mage: { 1: '#3a2418', 8: '#5a4a3a', 9: '#4a3a2a' } }, hide: ['Mage_Hat'] }, F.x + 14, F.z + 30,
    { name: 'Marit, Tomas\'s apprentice', face: Math.PI, idle: 'Interact', talk: n => npcSay(n, [{ s: 'Marit, Tomas\'s apprentice', t: pick([
      'The masonry\'s older than the Asura Kingdom. Older than anything with a name. And you broke its guardian. Tomas is furious. Also thrilled.',
      'There are marks on the stones — the same hand as the Sunstones. Somebody built both. Somebody tall.',
      'I come by day. By night the old dead walk the ring. I take notes from a very long way off.']) }]) });
  NPCS.oswin.setVisible(false); NPCS.scholar.setVisible(false);
  defineEncounter('firstWallNight', F.x, F.z, [['knight', 0, 4], ['thrall', 7, 0], ['thrall', -7, 2], ['archer', 2, -14]], { night: true, flag: 'firstWall' });
}
function updateAftermath() {
  if (!G || !NPCS.oswin) return;
  const day = TOD.hour > 6.5 && TOD.hour < 19.5;
  const want = { oswin: !!G.flags.wagons, scholar: !!G.flags.firstWall && day };
  for (const [id, on] of Object.entries(want)) {
    const n = NPCS[id];
    if (n.visible === on) continue;
    if (n.pos.distanceTo(camera.position) > 40 || behindCamera(n.pos)) n.setVisible(on);
  }
}
function buildSideQuests() {
  buildBoutRack();
  buildAftermath();
  for (const [k, I] of Object.entries(INSCRIPTIONS)) {
    const a = I.at(), pos = new THREE.Vector3(a.x, heightAt(a.x, a.z), a.z);
    INTERACTABLES.push({ pos, r: 3.2, label: () => I.label,
      enabled: () => !!G,
      action: async () => {
        await say(I.lines);
        if (G.flags.scribe === 'asked' && !G.flags['insc_' + k]) {
          G.flags['insc_' + k] = true;
          const n = (G.flags.insc_sun ? 1 : 0) + (G.flags.insc_col ? 1 : 0);
          toast(n === 2 ? 'Both inscriptions read — back to Tomas in Roa' : 'Inscription read for Tomas (1 / 2)');
        }
      } });
  }
  if (NPCS.roa4) NPCS.roa4.talk = talkScribe;
}
async function talkScribe(n) {
  const f = G.flags;
  if (!f.scribe) { await npcSay(n, SCRIBE_LINES.offer); f.scribe = 'asked'; toast('The Old Tongue', 'big'); later(0.7, () => toast('Read the inscriptions at the Sunstones and the Fallen Colossus')); return; }
  if (f.scribe === 'asked' && !(f.insc_sun && f.insc_col)) return npcSay(n, SCRIBE_LINES.waiting);
  if (f.scribe === 'asked') {
    await npcSay(n, SCRIBE_LINES.done);
    f.scribe = 'done';
    gainXp(150);
    G.maxMana += 10; G.mana = G.maxMana;
    toast('Max mana +10', 'good'); BUS.emit('sfx', { id: 'learn' });
    autosave();
    return;
  }
  return npcSay(n, SCRIBE_LINES.after);
}
// the journal's line for it
function sideQuestRows() {
  const f = G.flags, out = [];
  if (f.scribe === 'asked') out.push(['The Old Tongue', (f.insc_sun && f.insc_col) ? 'Return to Tomas in Roa' : 'Inscriptions read: ' + ((f.insc_sun ? 1 : 0) + (f.insc_col ? 1 : 0)) + ' / 2']);
  if (f.scribe === 'done') out.push(['The Old Tongue', 'Done']);
  return out;
}

// What Roa says about the basin. Mostly true.
const ROA_RUMOURS = [
  'My grandad swore there\'s a glowing stone on top of Hermit\'s Rock, out in the badlands. Climbed after it, he said. Came down without it, and without his hat.',
  'There\'s a giant made of stone lying in the north meadows. The children dare each other to climb onto his chest. The brave ones say it\'s warm up there.',
  'Shepherds say the Sunstones hum at dusk. Shepherds say a lot of things after dusk.',
  'The broken tower at the First Wall\'s half fallen. Something glitters on the top, if you squint. Nobody squints that long out there.',
  'There\'s a crag over the pass road the hawks sit on. Nothing up there but sky and whatever the hawks leave. And, my cousin says, a blue light.',
  'They say the old golem guarded something, out at the First Wall. Whatever it was, it\'s still there. Golems don\'t take things with them.',
  'Saw a blue glint behind the windmill in the gardens, coming home late. Probably the miller\'s lamp. Probably.',
];
