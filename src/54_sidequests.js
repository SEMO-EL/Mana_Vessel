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

function buildSideQuests() {
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
