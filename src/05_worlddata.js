/* ═══════════════════════════════════════════════════════════════════════
   WORLD LAYOUT — Buena & the Fittoa Borderlands.  Units are metres.
   +X is east, +Z is south (so -Z is north).

   Two basins, one heightfield: Buena (±800 around the origin, ringed by
   mountains) and, through the eastern pass, the Roa basin. The field is a
   rectangle so the mountains have somewhere to be on every side; the
   playable rectangle is a soft wall inside it — the mountains do the rest.

   Design rule: every landmark can see at least two others. The river is
   the spine — follow it and you pass village, ridge, falls and cliffs.
   ═══════════════════════════════════════════════════════════════════════ */
const WORLD = {
  half: 800,                       // Buena's half-extent (its ring, its map frame)
  x0: -1100, x1: 1100,             // heightfield bounds (metres)
  z0: -1100, z1: 1100,
  px0: -780, px1: 780,             // playable rectangle (soft wall)
  pz0: -780, pz1: 780,
  cell: 2,                         // heightfield spacing
  seed: 20260930,
  lakeLevel: 18,
};

// River control points: [x, z, water surface height]. The pair at the
// cliff line is the waterfall — a 44 m drop in 27 m of run.
const RIVER = [
  [-240, -790, 96], [-280, -640, 92], [-300, -575, 90],
  [-312, -548, 46], [-380, -420, 42], [-440, -240, 37], [-420, -60, 32],
  [-380, 120, 28], [-336, 280, 24], [-350, 440, 21.5], [-470, 565, 19], [-545, 612, 18],
];
const RIVER_WIDTH = 14;        // channel width at the surface

// The road: village west → bridge → east to the Roa pass.
const ROAD = [
  [-600, 330], [-520, 345], [-420, 362], [-345, 388], [-250, 408], [-120, 420],
  [0, 402], [160, 430], [320, 420], [460, 398], [620, 382], [760, 380], [880, 380], [1060, 380],
];
const ROAD_WIDTH = 7;

// Named places. `r` is the discovery radius for the place-name banner.
const PLACES = {
  village:   { x: -420, z: 360, r: 150, name: 'Buena Village',        sub: 'Fittoa Region' },
  lake:      { x: -560, z: 620, r: 110, name: 'Lake Buena' },
  roxyHill:  { x: -250, z: 520, r: 60,  name: 'The Tutor\'s Hill' },
  ridge:     { x: -110, z: 150, r: 90,  name: 'Watchtower Ridge' },
  forest:    { x: 400,  z: -140, r: 320, name: 'Buena Forest' },
  grove:     { x: 430,  z: -200, r: 55,  name: 'The Heart Grove' },
  falls:     { x: -306, z: -560, r: 70,  name: 'Whitewater Falls' },
  cave:      { x: -60,  z: -540, r: 60,  name: 'The Weeping Cave' },
  camp:      { x: 190,  z: 565, r: 60,  name: 'Brigands\' Rest' },
  ruinsE:    { x: 560,  z: -390, r: 50,  name: 'Sunken Chapel' },
  gate:      { x: 780,  z: 380, r: 60,  name: 'The Roa Road',         sub: 'Sealed — Milestone 2' },
};

// Terrain sculpt features.
const LAKE = { x: -560, z: 620, r: 115, bed: 9 };
// a small island mid-lake — no way there on foot; you freeze your own path
const ISLAND = { x: -598, z: 648, r: 10, h: 21 };
// a ledge under the falls, 4.2 m up the cliff: an earth pillar plus a jump reaches it
const FALLS_LEDGE = { x: -272, z: -532, w: 5, d: 3.5, up: 4.2 };
const VILLAGE_BASIN = { x: -420, z: 370, r: 170, h: 24 };
const RIDGE = { ax: -240, az: 30, bx: 30, bz: 262, h: 52, w: 95 };   // watchtower on top
const ROXY_HILL = { x: -250, z: 520, h: 20, r: 75 };
const CLIFF = { z0: -522, z1: -578, h: 74 };          // northern escarpment
const GROVE = { x: 430, z: -200, r: 60 };             // shallow bowl
const EAST_PASS = { z: 380, w: 70 };                  // gap in the mountain ring for the road
const FOREST_ZONE = { x0: 90, x1: 780, z0: -640, z1: 310 };

// Waystones — rest, respawn, fast travel. Order matters for the map.
const WAYSTONES = [
  { id: 'village', x: -392, z: 332, name: 'Buena Village' },
  { id: 'forest',  x: 300,  z: -46, name: 'Forest Clearing' },
  { id: 'cave',    x: -66,  z: -498, name: 'Below the Cliffs' },
];
