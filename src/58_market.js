/* ═══════════════════════════════════════════════════════════════════════
   SILVER & THE ROA MARKET — Asura silver from brigands' purses, bounties
   and hidden chests; Merchant Hilde, by the plaza in daylight, sells what
   the trade road still brings in: healing draughts (drink with R), better
   steel, an Ironwood staff core, boots, oat-cakes for Kestrel, and a
   smuggler's chart of every hidden chest.

   Beasts carry no purses: silver comes from people, the Guild, and luck.
   ═══════════════════════════════════════════════════════════════════════ */
const gear = () => G.gear || (G.gear = {});
const draughtCap = () => gear().bandolier ? 5 : 3;
const swordGearMul = () => 1 + 0.12 * (G && G.gear && G.gear.blade || 0);
const staffGearMul = () => 1 + 0.10 * (G && G.gear && G.gear.staff || 0);

function gainCoin(n, at) {
  n = Math.round(n); if (!G || n <= 0) return;
  G.coin = (G.coin || 0) + n;
  if (at) floatText(at, '+' + n + ' silver', 'coin'); else toast('+' + n + ' silver', 'good');
}
// what a fallen foe had on them: people carry purses, beasts don't; the great ones carry more
function enemyPurse(e) {
  const d = e.def;
  if (d.spar || d.magicOnly || ['wolf', 'stone', 'golem', 'treant', 'wisp'].includes(d.rig)) return 0;   // beasts, stone and wood
  if (d.boss) return 60 + (d.xp || 0) * 0.5;
  return (d.xp || 10) * 0.35 * rnd(0.7, 1.3);
}
BUS.on('enemyKilled', e => { const c = enemyPurse(e); if (c >= 1) gainCoin(c, e.pos.clone().setY(e.pos.y + (e.h || 1.7) + 0.6)); });

const WARES = [
  { id: 'draught', name: 'Healing Draught', price: 30, desc: () => `Milis holy water and honey. Drink it (${IN.label('drink')}) and nearly half your wounds close in a breath. You can carry ${draughtCap()}.`,
    sold: () => (G.draughts || 0) >= draughtCap(), soldTag: () => 'Flasks full', have: () => (G.draughts || 0) + ' / ' + draughtCap(), buy: () => { G.draughts = (G.draughts || 0) + 1; } },
  { id: 'bandolier', name: 'Draught Bandolier', price: 160, desc: () => 'Leather, with loops for five flasks instead of three.', sold: () => !!gear().bandolier, buy: () => { gear().bandolier = 1; } },
  { id: 'edge', name: 'Boreas Steel Edge', price: 120, desc: () => 'Your blade reground and edged in Boreas steel. Sword blows strike 12% harder.', sold: () => gear().blade >= 1, buy: () => { gear().blade = Math.max(gear().blade || 0, 1); } },
  { id: 'blade', name: 'Master-Forged Blade', price: 320, desc: () => 'A sword from the keep\'s own smith, balanced like a thought. Another 12% on every blow.', needs: () => gear().blade >= 1, needsTag: 'After the steel edge', sold: () => gear().blade >= 2, buy: () => { gear().blade = 2; } },
  { id: 'staff', name: 'Ironwood Staff Core', price: 150, desc: () => 'A core of Ironwood from the Great Forest, set in your staff. Spells strike — and heal — 10% harder.', sold: () => !!gear().staff, buy: () => { gear().staff = 1; } },
  { id: 'boots', name: 'Traveller\'s Boots', price: 90, desc: () => 'Good boots from the south. Max stamina +10.', sold: () => !!gear().boots, buy: () => { gear().boots = 1; G.maxStamina += 10; G.stamina = G.maxStamina; } },
  { id: 'oats', name: 'Oat-Cakes for Kestrel', price: 70, desc: () => 'She gallops on them like a dream: galloping costs 30% less stamina.', needs: () => horseUnlocked(), needsTag: 'Once you have a horse', sold: () => !!gear().oats, buy: () => { gear().oats = 1; } },
  { id: 'chart', name: 'Smuggler\'s Chart', price: 220, desc: () => 'A greasy chart with eleven crosses on it, bought off a man who didn\'t want it found on him. Every hidden chest, marked on your map.', sold: () => !!gear().chart, buy: () => { gear().chart = 1; } },
];
const HILDE_LINES = {
  first: 'Hilde. Everything the trade road still brings in that the brigands didn\'t get first: draughts, boots, good steel. Silver first, mind — I\'m not the Guild.',
  again: ['Back again? Good. Everything\'s honest. Mostly.', 'Silver talks, tutor. Let\'s hear it.', 'Fresh draughts this morning. Well, this week.', 'The trade road\'s open a crack. More stock soon, if it stays that way.'],
};
async function talkHilde(n) {
  await npcSay(n, [{ s: n.name, t: G.flags.metHilde ? pick(HILDE_LINES.again) : HILDE_LINES.first }]);
  G.flags.metHilde = true;
  openShop();
}
// a vendor: a title, a list of wares, a way of pricing them
const VENDORS = {
  hilde: { title: 'Hilde\'s Wares', wares: () => WARES, price: p => hildePrice(p) },
  marga: { title: 'The Red Hearth', wares: () => INN_WARES, price: p => p },
};
function openShop(vendor = 'hilde') {
  const V = VENDORS[vendor], body = $('shopBody');
  $('shop').querySelector('.h').textContent = V.title;
  let html = `<p class="flavor" style="margin:0 auto 12px;text-align:center">Your purse: <b class="silver">${G.coin || 0} silver</b> · Healing draughts ${(G.draughts || 0)} / ${draughtCap()}</p>`;
  for (const w of V.wares()) {
    const price = V.price(w.price), sold = w.sold(), locked = w.needs && !w.needs(), poor = (G.coin || 0) < price;
    const btn = sold ? `<span class="tag">${w.soldTag ? w.soldTag() : 'Bought'}</span>` : locked ? `<span class="tag">${w.needsTag}</span>`
      : `<button data-buy="${w.id}"${poor ? ' disabled' : ''}>${poor ? 'Not enough silver' : 'Buy'}</button>`;
    html += `<div class="bounty ware ${sold ? 'paid' : ''}"><div class="bh"><b>${w.name}</b><span>${price} silver${price < w.price ? ' (a friend\'s price)' : ''}${w.have ? ' · ' + w.have() : ''}</span></div>
      <p>${w.desc()}</p><div class="bb">${btn}</div></div>`;
  }
  body.innerHTML = html;
  for (const el of body.querySelectorAll('[data-buy]')) el.onclick = () => { buyWare(el.dataset.buy, vendor); if (GAME.state === 'shop') openShop(vendor); };
  if (GAME.state !== 'shop') { GAME._suppressPause = true; GAME.state = 'shop'; setTimeout(() => GAME._suppressPause = false, 50); }
  openScreen('shop');
}
function buyWare(id, vendor = 'hilde') {
  const V = VENDORS[vendor], w = V && V.wares().find(x => x.id === id);
  if (!w) return false;
  const price = V.price(w.price);
  if (w.sold() || (w.needs && !w.needs()) || (G.coin || 0) < price) return false;
  G.coin -= price; w.buy();
  BUS.emit('sfx', { id: 'pickup' });
  if (id === 'draught' && !G.flags.toldDrink) { G.flags.toldDrink = true; later(0.3, () => hint(IN.label('drink') + ' to drink a healing draught', 4)); }
  autosave();
  return true;
}

/* ───────────── drinking ───────────── */
function startDrink() {
  if (!(G.draughts > 0)) { hint('No healing draughts. Merchant Hilde sells them, by Roa\'s plaza.', 2.5); return false; }
  if (G.hp >= G.maxHp) { hint('You\'re not hurt.', 1.5); return false; }
  G.draughts--; PL.drank = false; PL.guarding = false;
  setPlayerState('drink');
  PL.actor.setUpper(null);
  PL.actor.once('Use_Item', { speed: 1.25, fade: 0.1 });
  BUS.emit('sfx', { id: 'uiMove' });
  return true;
}
// a breath to drink it (a blow before it's down wastes it), then it works at once
function stDrink(dt) {
  const b = PL.body;
  b.vel.x = damp(b.vel.x, 0, 10, dt); b.vel.z = damp(b.vel.z, 0, 10, dt);
  if (!PL.drank && PL.stateT > 0.55) {
    PL.drank = true;
    const h = Math.round(G.maxHp * 0.45);
    G.hp = Math.min(G.maxHp, G.hp + h);
    BUS.emit('healNumber', h);
    BUS.emit('sfx', { id: 'cast_heal' });
    emit(16, { pos: b.pos.clone().setY(b.pos.y + 1.1), col: '#ffe9a0', spread: 0.45, velSpread: 0.6, upBias: 1.6, life: 0.9, size: 0.12, size2: 0.02, gravity: -0.4, bright: 1.6 });
  }
  if (PL.stateT > 1.15) { setPlayerState('move'); PL.actor.loop('Idle', { fade: 0.2 }); }
}

/* ───────────── HUD: the purse and the flasks ───────────── */
function updateMarketHUD() {
  const c = G.coin || 0, n = G.draughts || 0, f = $('flask');
  $('whoCoin').textContent = c || G.gear ? c + ' silver' : '';
  const show = n > 0 || !!G.flags.toldDrink;
  f.classList.toggle('on', show);
  if (show) { $('flaskN').textContent = n + ' / ' + draughtCap(); $('flaskK').textContent = IN.usingPad ? '▲' : IN.label('drink'); f.classList.toggle('empty', n === 0); }
}

function buildMarket() {
  if (NPCS.roa3) NPCS.roa3.talk = talkHilde;
  $('shBack').onclick = () => resumeGame();
}
