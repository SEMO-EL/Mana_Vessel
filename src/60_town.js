/* ═══════════════════════════════════════════════════════════════════════
   ROA, A LITTLE MORE LIVED IN — the Red Hearth, where Marga rents rooms
   by the night and ladles stew by the bowl; and the street kid by the
   plaza who has been begging every mage in Roa for a BIG fireball.
   ═══════════════════════════════════════════════════════════════════════ */
const INN_WARES = [
  { id: 'roomMorning', name: 'A room till morning', price: 10, sold: () => false,
    desc: () => 'A bed upstairs and a door that locks. You wake at dawn, rested and whole. The roads outside are as busy as ever.', buy: () => innRest(7) },
  { id: 'roomEvening', name: 'A room till nightfall', price: 10, sold: () => false,
    desc: () => 'The same bed, the shutters drawn. You wake at dusk, rested and whole — the city lamps already lit.', buy: () => innRest(20) },
  { id: 'stew', name: 'Marga\'s stew', price: 6, sold: () => G.hp >= G.maxHp, soldTag: () => 'Not hungry',
    desc: () => 'A bowl of whatever\'s in the pot today. Closes your wounds. Doesn\'t ask how you got them.', buy: () => { const h = Math.round(G.maxHp - G.hp); G.hp = G.maxHp; if (h > 0) BUS.emit('healNumber', h); } },
];
// a night at the inn: the same rest a waystone gives (the world wakes up too), paid in silver
function innRest(h) {
  resumeGame();
  passTime(h);
}
const MARGA_LINES = ['Rooms upstairs, ale downstairs, and no brawling unless the Lady starts it.', 'You look like you\'ve been sleeping in ditches. Ten silver says you won\'t tonight.',
  'Stew\'s hot. It\'s always hot. I don\'t let it be anything else.'];
async function talkMarga(n) {
  await npcSay(n, [{ s: n.name, t: pick(MARGA_LINES) }]);
  openShop('marga');
}

// "Do a fireball! Do a BIG one!" — an incanted fire spell where he can see it, and he'll give you his treasure
BUS.on('cast', ({ spell, incanted }) => {
  const K = NPCS.roa5;
  if (!G || !K || !K.visible || G.flags.kidFire || spell.school !== 'fire' || !incanted) return;
  if (PL.body.pos.distanceTo(K.pos) > 22) return;
  G.flags.kidFire = true;
  G.maxMana += 6; G.mana = G.maxMana; autosave();             // yours at once; the telling takes a moment
  later(1.4, () => {
    bark('A Street Kid', 'WHOAAA! That was the BIGGEST! Here — my lucky stone. It glows sometimes. It\'s yours now.');
    later(2.6, () => { toast('The street kid\'s lucky stone · Max mana +6', 'good'); BUS.emit('sfx', { id: 'pickup' }); autosave(); });
  });
});
function buildTown() {
  if (NPCS.roa7) NPCS.roa7.talk = talkMarga;
  if (NPCS.roa5) NPCS.roa5.talk = n => npcSay(n, [{ s: n.name, t: G.flags.kidFire ? pick(['That fireball was the best thing that ever happened in Roa. EVER.', 'Teach me magic! Tomorrow? The day after?']) : 'Are you the mage? Do a fireball! Hold it and say the words — do a BIG one!' }]);
}
