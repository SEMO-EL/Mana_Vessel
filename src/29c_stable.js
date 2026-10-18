/* ═══════════════════════════════════════════════════════════════════════
   THE BOREAS STABLES — a timber stable in the north-west corner of the
   estate terrace, three stalls under a red roof. Kestrel lives in the
   middle one: you'll find her there whenever she isn't out with you (a
   fast travel, a fall, a night left far behind all send her home), and
   Old Bertram, the stablemaster, will lead her out or take her in.
   ═══════════════════════════════════════════════════════════════════════ */
const STABLE = { x: 1522, z: 292, built: false, stall: null, door: null, group: null };

function buildStable() {
  const S = STABLE, y = heightAt(S.x, S.z);
  const mat = toonMat({ vertexColors: true, rim: true }), box = new THREE.BoxGeometry(1, 1, 1);
  const wood = '#6a4a2e', dark = '#4a3220', post = '#3e2a1a', roof = '#8b3a2a', straw = '#b89a5a', hay = '#d6b45a';
  const P = [
    [box, straw, 0, 0.05, 0, 14, 0.1, 8],                                     // straw floor
    [box, wood, 0, 1.7, -3.85, 14, 3.4, 0.3],                                 // back wall
    [box, wood, -6.85, 1.6, 0, 0.3, 3.2, 8], [box, wood, 6.85, 1.6, 0, 0.3, 3.2, 8],
    [box, dark, 0, 3.25, 3.85, 14.2, 0.35, 0.35],                             // front beam
    [box, roof, 0, 3.85, 0.1, 15.2, 0.25, 9.8, 0.104, 0, 0],                  // the roof, falling to the front
    [box, dark, -2.3, 0.75, -1.3, 0.2, 1.5, 4.9], [box, dark, 2.3, 0.75, -1.3, 0.2, 1.5, 4.9],   // stall partitions
    [box, hay, -4.9, 0.32, -3.0, 1.3, 0.62, 0.85], [box, hay, -5.4, 0.94, -3.0, 1.1, 0.6, 0.8], [box, hay, -4.3, 0.32, -1.9, 1.2, 0.62, 0.8],
    [box, '#5a4630', 4.6, 0.3, -3.1, 2.2, 0.55, 0.65], [box, '#3f7fa0', 4.6, 0.56, -3.1, 1.9, 0.05, 0.45],   // trough
    [box, hay, 0, 0.18, -3.2, 1.6, 0.36, 0.9],                                // Kestrel's hay
  ];
  for (const x of [-6.85, -2.3, 2.3, 6.85]) P.push([box, post, x, 1.75, 3.85, 0.42, 3.5, 0.42]);
  for (const x of [-6.85, 6.85]) P.push([box, post, x, 1.85, -3.85, 0.42, 3.7, 0.42]);
  const m = mergedPart(P, mat); m.receiveShadow = true;
  const g = new THREE.Group(); g.position.set(S.x, y - 0.02, S.z); g.add(m);
  STRUCT.group.add(g);
  S.group = g;
  // walls, partitions and posts hold; the straw and the hay are walked on
  addBox(S.x, S.z - 3.85, 7, 0.2, 0, y - 1, y + 3.4, 'stable');
  for (const sx of [-6.85, 6.85]) addBox(S.x + sx, S.z, 0.2, 4, 0, y - 1, y + 3.2, 'stable');
  for (const sx of [-2.3, 2.3]) addBox(S.x + sx, S.z - 1.3, 0.12, 2.45, 0, y - 1, y + 1.5, 'stable');
  for (const sx of [-2.3, 2.3]) addCircle(S.x + sx, S.z + 3.85, 0.24, y - 1, y + 3.5, 'stable');
  addBox(S.x + 4.6, S.z - 3.1, 1.1, 0.33, 0, y - 1, y + 0.58, 'stable');
  placeProp('flag_red', S.x + 8.2, S.z + 4.6, { s: 7, collide: false });
  S.stall = new THREE.Vector3(S.x, y, S.z - 0.6);                            // the middle stall, facing out
  S.door = new THREE.Vector3(S.x + 9.5, y, S.z + 6);                         // where Bertram stands
  S.built = true;
}

const STABLE_LINES = {
  locked: ['These are Lord Sauros\'s horses, young master. He lends them to those the Guild vouches for. Register there, and I\'ll have one saddled for you.'],
  out: ['Kestrel\'s fed and saddled. Mind her left side, she shies at nothing at all.', 'Here she comes. Bring her back in one piece — yourself too.', 'She\'s been stamping all morning. Take her out before she kicks the door in.'],
  in: ['I\'ll take her in and give her a rub down. Whistle and she\'ll find you, wherever you are.', 'In you go, girl. She\'ll come to your whistle any time.'],
  away: ['She\'s still out with you somewhere. Give a whistle — she knows it.'],
};
async function talkStable(n) {
  if (!horseUnlocked()) return npcSay(n, [{ s: n.name, t: pick(STABLE_LINES.locked) }]);
  const H = HORSE, home = H.mode === 'gone' || H.mode === 'stall' || H.mode === 'home';
  if (home) { await npcSay(n, [{ s: n.name, t: pick(STABLE_LINES.out) }]); leadOutHorse(); return; }
  if (H.rig && H.body.pos.distanceTo(PL.body.pos) < 30) { await npcSay(n, [{ s: n.name, t: pick(STABLE_LINES.in) }]); sendHorseHome(); return; }
  return npcSay(n, [{ s: n.name, t: pick(STABLE_LINES.away) }]);
}
// out of her stall and over to you
function leadOutHorse() {
  if (HORSE.mode === 'gone' || !HORSE.rig) spawnHorse(STABLE.stall.x, STABLE.stall.z, 0);
  HORSE.leaving = true; HORSE.mode = 'come'; HORSE.stuckT = 0; HORSE.lastD = 1e9;
  later(0.4, () => BUS.emit('sfx', { id: 'whinny', pos: HORSE.body.pos }));
}
// back she walks, into the middle stall
function sendHorseHome() {
  if (!HORSE.rig || HORSE.mode === 'ride') return;
  HORSE.mode = 'home'; HORSE.stuckT = 0; HORSE.lastD = 1e9;
}
// near the estate and not out with you: she's in her stall
function stableWants() {
  return STABLE.built && horseUnlocked() && !GAME.inCave && Math.hypot(PL.body.pos.x - STABLE.x, PL.body.pos.z - STABLE.z) < 110;
}
