/* ═══════════════════════════════════════════════════════════════════════
   GAME DATA — races, sword styles, schools, spells. Ported from v2 into
   metres and seconds. The engine never hardcodes any of this.
   ═══════════════════════════════════════════════════════════════════════ */
const RACES = {
  human:  { name: 'Human',  desc: 'Unremarkable, adaptable, and hungry. The world was built for you.', stat: '+10% XP · balanced',
            hp: 100, mana: 120, spd: 1.00, xp: 1.10, magic: 1.00, sword: 1.00, hair: '#5a3a24' },
  migurd: { name: 'Migurd', desc: 'Blue hair, a child\'s face for a century. Minds touch without mouths.', stat: '+40% mana · frail',
            hp: 80, mana: 168, spd: 1.02, xp: 1.00, magic: 1.18, sword: 0.85, hair: '#4d8fd6' },
  superd: { name: 'Superd', desc: 'Green hair, a third eye, and a name that empties streets.', stat: 'Tough · poor magic',
            hp: 130, mana: 96, spd: 1.06, xp: 1.00, magic: 0.86, sword: 1.30, hair: '#3f9a5c', gem: true },
  beast:  { name: 'Beast',  desc: 'Doldia blood. Muscle before incantation, always.', stat: 'Fast & tough · poor mana',
            hp: 135, mana: 72, spd: 1.12, xp: 0.95, magic: 0.72, sword: 1.28, hair: '#8a5a2e', ears: 'beast' },
  elf:    { name: 'Elf',    desc: 'Long-lived, long-sighted, and slightly bored by all of this.', stat: '+Magic control',
            hp: 88, mana: 144, spd: 1.04, xp: 1.00, magic: 1.12, sword: 0.95, hair: '#e6dcbe', ears: 'elf' },
};

/* Sword styles. Each combo step: clip, speed, hit window (normalised clip
   time), reach (m), arc (rad half-angle), damage multiplier, stamina,
   lunge (m/s during windup), cancel (normalised time after which the next
   input, a dodge, or a cast can interrupt).                              */
const STYLES = {
  sword: { name: 'Sword God', desc: 'Speed is the only virtue. Strike first, strike once, do not be struck.', stat: 'Fast, heavy hits · no guard bonus',
    col: '#e0562b', dmg: 1.35, parryWindow: 0.14,
    combo: [
      { clip: '1H_Melee_Attack_Slice_Diagonal',   speed: 1.55, hit: [0.30, 0.52], reach: 2.3, arc: 1.1, dmg: 1.0, st: 13, lunge: 4.5, cancel: 0.62 },
      { clip: '1H_Melee_Attack_Slice_Horizontal', speed: 1.55, hit: [0.30, 0.50], reach: 2.4, arc: 1.3, dmg: 1.05, st: 13, lunge: 4.0, cancel: 0.60 },
      { clip: '1H_Melee_Attack_Stab',             speed: 1.7,  hit: [0.34, 0.50], reach: 2.8, arc: 0.5, dmg: 1.5, st: 16, lunge: 7.0, cancel: 0.70 },
    ],
    heavy: { clip: '1H_Melee_Attack_Jump_Chop', speed: 1.35, hit: [0.42, 0.60], reach: 3.0, arc: 0.9, dmg: 2.6, st: 26, lunge: 6.5, cancel: 0.82, poise: 60 },
  },
  water: { name: 'Water God', desc: 'Do not meet the blow. Turn it, and give it back.', stat: 'Wide parry window · counters',
    col: '#3fa9d6', dmg: 0.95, parryWindow: 0.34, counter: true,
    combo: [
      { clip: '1H_Melee_Attack_Chop',             speed: 1.5,  hit: [0.32, 0.52], reach: 2.2, arc: 0.9, dmg: 1.0, st: 11, lunge: 3.0, cancel: 0.6 },
      { clip: '1H_Melee_Attack_Slice_Horizontal', speed: 1.5,  hit: [0.30, 0.50], reach: 2.3, arc: 1.4, dmg: 1.0, st: 11, lunge: 3.0, cancel: 0.6 },
    ],
    heavy: { clip: 'Block_Attack', speed: 1.3, hit: [0.30, 0.55], reach: 2.4, arc: 1.2, dmg: 2.0, st: 20, lunge: 3.0, cancel: 0.75, poise: 45 },
  },
  north: { name: 'North God', desc: 'Whatever wins. There are no rules, only survivors.', stat: 'Knockback · kicks · poise damage',
    col: '#b5834a', dmg: 1.1, parryWindow: 0.16, knock: 1.8,
    combo: [
      { clip: '1H_Melee_Attack_Chop',       speed: 1.45, hit: [0.32, 0.52], reach: 2.3, arc: 1.0, dmg: 1.0, st: 14, lunge: 4.0, cancel: 0.62, poise: 22 },
      { clip: 'Unarmed_Melee_Attack_Kick',  speed: 1.5,  hit: [0.30, 0.55], reach: 2.0, arc: 0.8, dmg: 0.7, st: 12, lunge: 3.5, cancel: 0.60, poise: 40, knock: 3 },
      { clip: '2H_Melee_Attack_Chop',       speed: 1.5,  hit: [0.34, 0.52], reach: 2.6, arc: 1.0, dmg: 1.6, st: 18, lunge: 5.0, cancel: 0.72, poise: 35 },
    ],
    heavy: { clip: '2H_Melee_Attack_Spin', speed: 1.5, hit: [0.25, 0.70], reach: 3.0, arc: 3.14, dmg: 1.9, st: 28, lunge: 2.5, cancel: 0.85, poise: 55, knock: 4 },
  },
};

const RANKS = ['Elementary', 'Intermediate', 'Advanced', 'Saint', 'King', 'Emperor', 'God'];
const RANK_NEED = [0, 12, 34, 70, 120];
const SCHOOLS = {
  fire:  { name: 'Fire',    col: '#ff6a2a', glow: '#ff8840' },
  water: { name: 'Water',   col: '#3fb8e6', glow: '#7fd8ff' },
  wind:  { name: 'Wind',    col: '#7de0a0', glow: '#a8ffc8' },
  earth: { name: 'Earth',   col: '#c48c4f', glow: '#e0b070' },
  heal:  { name: 'Healing', col: '#f0dc7a', glow: '#fff0a0' },
};
/* kind: bolt | beam | nova | burst | wall | self | meteor | field | prison | aura
   spd m/s · radius m (projectile) · area m (novas/fields) · range m        */
const SPELLS = [
  { id: 'fireball',  school: 'fire',  rank: 0, name: 'Fireball',      kind: 'bolt',  cost: 12, dmg: 22, spd: 34, radius: 0.32, cd: 0.45, life: 2.2, burn: 5, gravity: 2 },
  { id: 'flame',     school: 'fire',  rank: 1, name: 'Flamethrower',  kind: 'beam',  cost: 26, dmg: 38, range: 9, cd: 1.1, life: 0.9, burn: 9 },
  { id: 'firestorm', school: 'fire',  rank: 2, name: 'Fire Storm',    kind: 'nova',  cost: 52, dmg: 66, area: 6.5, cd: 2.4, life: 0.8, burn: 14, range: 30 },
  { id: 'meteor',    school: 'fire',  rank: 3, name: 'Meteor',        kind: 'meteor',cost: 86, dmg: 150, area: 7, cd: 4.2, delay: 1.1, burn: 22, range: 40 },

  { id: 'waterball', school: 'water', rank: 0, name: 'Water Ball',    kind: 'bolt',  cost: 10, dmg: 17, spd: 38, radius: 0.34, cd: 0.36, life: 2.0, slow: 0.45, freezes: true, gravity: 3 },
  { id: 'icicle',    school: 'water', rank: 1, name: 'Icicle',        kind: 'bolt',  cost: 22, dmg: 40, spd: 60, radius: 0.22, cd: 0.62, life: 1.6, pierce: 3, slow: 0.55, freezes: true },
  { id: 'cumulus',   school: 'water', rank: 2, name: 'Cumulonimbus',  kind: 'nova',  cost: 48, dmg: 48, area: 7.5, cd: 2.2, life: 1.2, slow: 0.65, range: 30 },
  { id: 'zero',      school: 'water', rank: 3, name: 'Absolute Zero', kind: 'field', cost: 78, dmg: 16, area: 6.5, cd: 4.0, life: 4.2, slow: 0.85, range: 30 },

  { id: 'windblade', school: 'wind',  rank: 0, name: 'Wind Blade',    kind: 'bolt',  cost: 9,  dmg: 15, spd: 55, radius: 0.28, cd: 0.26, life: 1.2 },
  { id: 'gust',      school: 'wind',  rank: 1, name: 'Gale Push',     kind: 'burst', cost: 20, dmg: 22, area: 5, cd: 0.95, life: 0.35, knock: 14 },
  { id: 'tempest',   school: 'wind',  rank: 2, name: 'Tempest',       kind: 'bolt',  cost: 40, dmg: 32, spd: 70, radius: 0.45, cd: 0.5, life: 1.4, pierce: 99, knock: 6 },
  { id: 'vacuum',    school: 'wind',  rank: 3, name: 'Vacuum Cannon', kind: 'bolt',  cost: 72, dmg: 90, spd: 110, radius: 0.7, cd: 2.6, life: 1.0, pierce: 99, knock: 12 },

  { id: 'stone',     school: 'earth', rank: 0, name: 'Stone Cannon',  kind: 'bolt',  cost: 14, dmg: 30, spd: 30, radius: 0.36, cd: 0.55, life: 2.2, knock: 5, gravity: 5, poise: 30 },
  { id: 'wall',      school: 'earth', rank: 1, name: 'Earth Wall',    kind: 'wall',  cost: 18, dmg: 0,  cd: 1.6, life: 20, range: 14 },
  { id: 'barrage',   school: 'earth', rank: 2, name: 'Rock Barrage',  kind: 'bolt',  cost: 44, dmg: 26, spd: 40, radius: 0.3, cd: 0.8, life: 1.8, shots: 5, spread: 0.22, knock: 3, gravity: 4 },
  { id: 'prison',    school: 'earth', rank: 3, name: 'Stone Prison',  kind: 'prison',cost: 70, dmg: 55, area: 6, cd: 3.6, life: 3.0, root: 2.8, range: 30 },
  // taught, not studied: Magister Wenna's lesson in Roa (gift: learned by her flag, not by rank)
  { id: 'quagmire',  school: 'earth', rank: 1, name: 'Quagmire',      kind: 'field', cost: 30, dmg: 7,  area: 5.5, cd: 2.4, life: 5.0, slow: 0.8, range: 26, gift: 'quagmire' },

  { id: 'healing',   school: 'heal',  rank: 0, name: 'Healing',       kind: 'self',  cost: 20, heal: 34, cd: 1.5 },
  { id: 'greatheal', school: 'heal',  rank: 1, name: 'Great Healing', kind: 'self',  cost: 38, heal: 80, cd: 2.6, cleanse: true },
  { id: 'fieldheal', school: 'heal',  rank: 3, name: 'Field Healing', kind: 'aura',  cost: 64, heal: 150, area: 4.5, cd: 5.0, life: 6.0, cleanse: true },
];
const SPELL = Object.fromEntries(SPELLS.map(s => [s.id, s]));

// Chant rules, unchanged from v1: tap = instant & expensive, hold = cheap & strong.
const CHANT = { need: 0.68, chantlessCost: 1.6, incantCost: 0.55, incantPower: 1.45 };

// Adventurer ranks by level
const GUILD_RANKS = [[1, 'F'], [4, 'E'], [8, 'D'], [13, 'C'], [19, 'B'], [26, 'A'], [34, 'S']];

// Difficulty scales damage taken and dealt.
const DIFFICULTY = {
  story:      { name: 'Story',      taken: 0.45, dealt: 1.35, desc: 'The world is kind. Enemies hit softly and fall quickly.' },
  adventurer: { name: 'Adventurer', taken: 1.0,  dealt: 1.0,  desc: 'As intended. Read the tells; the Vessel is your way out.' },
  deadend:    { name: 'Dead End',   taken: 1.5,  dealt: 0.85, desc: 'Punishing. Every mistake is a lesson you pay for.' },
};
