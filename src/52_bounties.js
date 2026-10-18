/* ═══════════════════════════════════════════════════════════════════════
   BOUNTIES — the board by the Adventurer Guild's door. Take a job, find
   the thing, come back for the coin. Three hunts reuse the basin's own
   packs; three are new: a pack denning in the pass, Old Scar on the
   south-east downs, and Sir Edric, who will not stay buried at the
   Sunken Chapel. The two named ones are field bosses, paid in more than
   experience: a boon to body or vessel.

   State lives in G.bounties[id]: 'taken' → 'done' (killed) → 'paid'.
   G.trackBounty puts one on the compass and the map.
   ═══════════════════════════════════════════════════════════════════════ */
const BOUNTIES = [
  { id: 'north', title: 'Jackals on the North Road', where: 'The dry hills north of Wagonbreak Camp', enc: 'jackalsNorth', xp: 70,
    text: 'A pack has taken to the hills above the trade road. Two carters bitten this week. Thin them.' },
  { id: 'watch', title: 'Watch on the Trade Road', where: 'The trade road, east of the walls', enc: 'roadWatch', xp: 80,
    text: 'Brigand lookouts on the road at the bend. They signal the camp when a wagon comes. Put out their eyes.' },
  { id: 'gardens', title: 'The Night Gardens', where: 'Roa Market Gardens — after dark', enc: 'jackalsGardens', xp: 60, night: true,
    text: 'Something digs up the gardens by night and takes the hens. Tracks like a dog\'s, but more of them. Wait for dark.' },
  { id: 'boars', title: 'Boars in the Barley', where: 'The fields past the market gardens', enc: 'boarsFarms', xp: 75,
    text: 'Two tuskers have been rooting through the south fields. Joss lost a fence and nearly a leg. Mind the charge.' },
  { id: 'pass', title: 'Wolves in the Pass', where: 'The hills north of the pass road', enc: 'passWolves', xp: 130, newEnc: true,
    text: 'A grey pack dens above the pass, and a big one leads it. The post\'s lost a horse. Next it\'ll be a rider.' },
  { id: 'scar', title: 'Old Scar', where: 'The downs south-east of the city', enc: 'oldScar', xp: 260, newEnc: true, named: true,
    boon: { hp: 15 }, text: 'A one-eared jackal the size of a calf. Three hunters went after it. One came back. Bounty doubled.' },
  { id: 'edric', title: 'The Unburied Knight', where: 'The Sunken Chapel, Buena Forest — after dark', enc: 'edric', xp: 300, newEnc: true, named: true, night: true,
    boon: { mana: 15 }, text: 'Forwarded from Buena: a knight in rusted armour walks the old chapel at night. The priest asks that he be laid to rest. Firmly.' },
];
const BOUNTY = Object.fromEntries(BOUNTIES.map(b => [b.id, b]));

/* The new hunts' quarry. */
ENEMY_DEFS.scar = {
  ...ENEMY_DEFS.jackal, name: 'Old Scar', scale: 1.4, tint: '#7d6440', hp: 440, poise: 80, r: 0.72, h: 1.15, run: 10.4, sight: 32, hear: 22,
  xp: 160, weight: 2.5, flinchAt: 40, knockRes: 0.55, boss: true,
  attacks: [
    { name: 'bite',   range: [0, 2.8], windup: 0.4, active: 0.15, recover: 0.55, reach: 2.6, arc: 0.95, dmg: 19, poise: 28, lunge: 4.5 },
    { name: 'pounce', range: [3.5, 11], windup: 0.6, active: 0.42, recover: 0.95, reach: 2.3, arc: 1.1, dmg: 27, poise: 48, leap: 15, unblockable: true },
  ],
  phase2: { at: 0.45, speedMul: 1.2, summon: { key: 'jackal', n: 3, dist: 12 },
    attacks: [{ name: 'bite', range: [0, 2.8], windup: 0.28, active: 0.15, recover: 0.4, reach: 2.6, arc: 1.1, dmg: 16, poise: 24, lunge: 5 }] },
};
ENEMY_DEFS.edric = {
  ...ENEMY_DEFS.knight, name: 'Sir Edric, the Unburied', scale: 1.3, r: 0.58, h: 2.3, hp: 680, poise: 150, xp: 220, weight: 3, flinchAt: 999, knockRes: 0.85,
  boss: true, shield: 0.85, sight: 26,
  phase2: { at: 0.45, speedMul: 1.15, summon: { key: 'thrall', n: 3, dist: 7, rise: true },
    attacks: [{ clip: '1H_Melee_Attack_Slice_Diagonal', speed: 1.1, hitAt: 0.4, range: [0, 3.1], reach: 3.1, arc: 1.2, dmg: 26, poise: 38, lunge: 3.5 }] },
};
const BOUNTY_CARDS = { scar: ['Old Scar', 'The terror of the downs'], edric: ['Sir Edric, the Unburied', 'He swore to guard the chapel. He meant it.'] };

function defineBountyEncounters() {
  const pass = { x: 1160, z: 296 }, scar = { x: 2100, z: 480 }, ch = PLACES.ruinsE;
  defineEncounter('passWolves', pass.x, pass.z, [['alpha', 0, 0], ['wolf', 5, 3], ['wolf', -5, 2], ['wolf', 1, -6]], { flag: 'bt_pass' });
  defineEncounter('oldScar', scar.x, scar.z, [['scar', 0, 0, { face: 2.4 }], ['jackal', 6, 4], ['jackal', -5, 5]],
    { flag: 'bt_scar', boss: true, onClear: () => { G.flags.oldScar = true; banner('Field Boss Felled', 'Old Scar'); } });
  defineEncounter('edric', ch.x + 6, ch.z + 4, [['edric', 0, 0, { face: Math.PI }]],
    { flag: 'bt_edric', boss: true, night: true, onClear: () => { G.flags.edric = true; banner('Field Boss Felled', 'Sir Edric, the Unburied'); } });
}

/* ───────────── the board ───────────── */
function buildBountyBoard() {
  const gd = ROA.spots.guildDoor, P = ROA.spots.plaza;
  const a = Math.atan2(P.x - gd.x, P.z - gd.z), sx = Math.cos(a), sz = -Math.sin(a);     // to the door's side
  const x = gd.x + sx * 5.5, z = gd.z + sz * 5.5, y = heightAt(x, z);
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = a;
  const wood = toonMat({ color: '#5a3e28' });
  for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), wood); post.position.set(s * 1.25, 1.3, 0); g.add(post); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 0.7), toonMat({ color: '#7a2a22' })); roof.position.set(0, 2.62, 0.05); roof.rotation.x = -0.18; g.add(roof);
  // the board, papered with notices
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
  const c = cv.getContext('2d'), R = mulberry32(77);
  c.fillStyle = '#6b4a2e'; c.fillRect(0, 0, 256, 160);
  for (let i = 0; i < 9; i++) {
    const w = 46 + R() * 22, h = 52 + R() * 20, px = 10 + (i % 4) * 60 + R() * 8, py = 8 + Math.floor(i / 4) * 52 + R() * 6;
    c.save(); c.translate(px + w / 2, py + h / 2); c.rotate((R() - 0.5) * 0.18);
    c.fillStyle = ['#e9dfc6', '#ddd0b2', '#efe6d0'][i % 3]; c.fillRect(-w / 2, -h / 2, w, h);
    c.fillStyle = 'rgba(60,40,24,.75)'; for (let l = 0; l < 5; l++) c.fillRect(-w / 2 + 6, -h / 2 + 10 + l * 8, w - 12 - R() * 14, 2);
    c.fillStyle = '#8b2635'; c.beginPath(); c.arc(0, -h / 2 + 4, 2.5, 0, TAU); c.fill();
    c.restore();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 0.1), [wood, wood, wood, wood, toonMat({ map: tex }), wood]);
  board.position.set(0, 1.75, 0); g.add(board);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  STRUCT.group.add(g);
  addBox(x, z, 1.4, 0.2, -a, y - 0.5, y + 2.7, 'board');
  ROA.spots.board = { x: x + Math.sin(a) * 1.6, z: z + Math.cos(a) * 1.6 };
  INTERACTABLES.push({ pos: new THREE.Vector3(ROA.spots.board.x, y, ROA.spots.board.z), r: 3, label: () => bountiesReady() ? 'Collect a bounty' : 'Read the bounty board',
    action: () => openBounties() });
}
const bountiesReady = () => !!G && !!G.bounties && Object.values(G.bounties).includes('done');

function openBounties() {
  G.bounties = G.bounties || {};
  const body = $('bountyBody');
  const registered = !!G.flags.guildF;
  let html = `<p class="flavor" style="margin:0 auto 12px;text-align:center">${registered
    ? `${G.name} · Adventurer Rank ${guildRank(G.lvl)}. Take a notice, do the work, come back for the coin.`
    : 'The notices are for registered adventurers. The clerk inside keeps the book.'}</p>`;
  for (const b of BOUNTIES) {
    const st = G.bounties[b.id] || 'open', tracked = G.trackBounty === b.id && st === 'taken';
    const boon = b.boon ? (b.boon.hp ? ` · <b>+${b.boon.hp} max health</b>` : ` · <b>+${b.boon.mana} max mana</b>`) : '';
    const btn = !registered ? '' : st === 'open' ? `<button data-take="${b.id}">Take the job</button>`
      : st === 'taken' ? (tracked ? '<span class="tag">On your compass</span>' : `<button data-track="${b.id}">Track</button>`)
      : st === 'done' ? `<button class="hot" data-claim="${b.id}">Claim the reward</button>` : '<span class="tag">Paid</span>';
    html += `<div class="bounty ${st}"><div class="bh"><b>${b.title}</b><span>${b.named ? 'Named' : 'Hunt'} · ${b.xp} xp${boon}</span></div>
      <div class="bw">${b.where}</div><p>${b.text}</p><div class="bb">${btn}</div></div>`;
  }
  body.innerHTML = html;
  for (const el of body.querySelectorAll('[data-take]')) el.onclick = () => { takeBounty(el.dataset.take); openBounties(); };
  for (const el of body.querySelectorAll('[data-track]')) el.onclick = () => { G.trackBounty = el.dataset.track; BUS.emit('sfx', { id: 'uiSelect' }); openBounties(); };
  for (const el of body.querySelectorAll('[data-claim]')) el.onclick = () => { claimBounty(el.dataset.claim); openBounties(); };
  if (GAME.state !== 'bounties') { GAME._suppressPause = true; GAME.state = 'bounties'; setTimeout(() => GAME._suppressPause = false, 50); }
  openScreen('bounties');
}
function takeBounty(id) {
  const b = BOUNTY[id]; if (!b) return;
  G.bounties[id] = 'taken'; G.trackBounty = id;
  if (b.newEnc) G.flags['bt_' + id] = true;
  // a pack already thinned this cycle comes back for the job
  const enc = ENCOUNTERS.find(e => e.id === b.enc);
  if (enc && enc.cleared && !enc.opts.boss) enc.cleared = false;
  toast('Bounty taken: ' + b.title, 'big');
  BUS.emit('sfx', { id: 'page' });
}
function claimBounty(id) {
  const b = BOUNTY[id]; if (!b || G.bounties[id] !== 'done') return;
  G.bounties[id] = 'paid';
  gainXp(b.xp);
  if (b.boon && b.boon.hp) { G.maxHp += b.boon.hp; G.hp = G.maxHp; toast('Max health +' + b.boon.hp, 'good'); }
  if (b.boon && b.boon.mana) { G.maxMana += b.boon.mana; G.mana = G.maxMana; toast('Max mana +' + b.boon.mana, 'good'); }
  if (G.trackBounty === id) G.trackBounty = null;
  BUS.emit('sfx', { id: 'levelUp' });
  saveGame(true);
}
BUS.on('encounterClear', id => {
  if (!G || !G.bounties) return;
  for (const b of BOUNTIES) if (b.enc === id && G.bounties[b.id] === 'taken') {
    G.bounties[b.id] = 'done';
    later(1.2, () => { banner('Bounty Fulfilled', b.title); later(1.6, () => toast('Return to the Guild\'s board for the reward')); });
  }
});
// a named quarry announces itself the first time it turns on you
function updateBounties() {
  if (!G) return;
  for (const e of ENT.enemies) {
    const card = BOUNTY_CARDS[e.key];
    if (card && e.aggro && !e.dead && !G.flags['card_' + e.key]) {
      G.flags['card_' + e.key] = true;
      bossCard(card[0], card[1]); BUS.emit('sfx', { id: 'bossIntro' });
    }
  }
}
// for the compass and the map: where the tracked job is (or the board, once it's done)
function bountyMarker() {
  if (!G || !G.trackBounty || !G.bounties) return null;
  const b = BOUNTY[G.trackBounty], st = G.bounties[G.trackBounty];
  if (!b) return null;
  if (st === 'done') return ROA.spots.board ? { x: ROA.spots.board.x, z: ROA.spots.board.z, label: 'Claim: ' + b.title } : null;
  if (st !== 'taken') return null;
  const enc = ENCOUNTERS.find(e => e.id === b.enc);
  return enc ? { x: enc.x, z: enc.z, label: b.title } : null;
}
