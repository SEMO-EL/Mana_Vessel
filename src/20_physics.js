/* ═══════════════════════════════════════════════════════════════════════
   PHYSICS — a kinematic character world, not a rigid-body simulator.

   Static colliders live in a 16 m spatial hash:
     circle  { x, z, r, y0, y1 }                  trunks, pillars, posts
     box     { x, z, hx, hz, rot, y0, y1 }        buildings, walls (oriented)
   A collider whose top is within STEP of your feet is ground, not a wall
   — that one rule gives bridges, stairs, rooftops and earth pillars.

   moveBody() is the only way anything moves: slide against walls, stick
   to terrain, refuse slopes steeper than MAX_SLOPE, refuse deep water,
   integrate gravity, report ground contact.
   ═══════════════════════════════════════════════════════════════════════ */
const PHYS = {
  CELL: 16, grid: new Map(), all: [],
  GRAVITY: -24, STEP: 0.55, MAX_SLOPE_TAN: Math.tan(48 * Math.PI / 180), WADE: 1.15,
};

function _cellsFor(c) {
  const r = c.kind === 'circle' ? c.r : Math.hypot(c.hx, c.hz);
  const x0 = Math.floor((c.x - r) / PHYS.CELL), x1 = Math.floor((c.x + r) / PHYS.CELL);
  const z0 = Math.floor((c.z - r) / PHYS.CELL), z1 = Math.floor((c.z + r) / PHYS.CELL);
  const keys = [];
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) keys.push(i + ',' + j);
  return keys;
}
function addCollider(c) {
  if (c.kind === 'box') { c.cos = Math.cos(c.rot || 0); c.sin = Math.sin(c.rot || 0); }
  c.keys = _cellsFor(c);
  for (const k of c.keys) { if (!PHYS.grid.has(k)) PHYS.grid.set(k, []); PHYS.grid.get(k).push(c); }
  PHYS.all.push(c);
  return c;
}
function removeCollider(c) {
  for (const k of c.keys || []) { const l = PHYS.grid.get(k); if (l) { const i = l.indexOf(c); if (i >= 0) l.splice(i, 1); } }
  const i = PHYS.all.indexOf(c); if (i >= 0) PHYS.all.splice(i, 1);
}
const addCircle = (x, z, r, y0, y1, tag) => addCollider({ kind: 'circle', x, z, r, y0, y1, tag });
const addBox = (x, z, hx, hz, rot, y0, y1, tag) => addCollider({ kind: 'box', x, z, hx, hz, rot, y0, y1, tag });

const _near = [];
function nearColliders(x, z, r) {
  _near.length = 0;
  const x0 = Math.floor((x - r) / PHYS.CELL), x1 = Math.floor((x + r) / PHYS.CELL);
  const z0 = Math.floor((z - r) / PHYS.CELL), z1 = Math.floor((z + r) / PHYS.CELL);
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
    const l = PHYS.grid.get(i + ',' + j);
    if (l) for (const c of l) if (!_near.includes(c)) _near.push(c);
  }
  return _near;
}

// Is (x,z) inside a collider's footprint (grown by pad)? Returns true/false.
function insideFootprint(c, x, z, pad) {
  if (c.kind === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + pad;
  const dx = x - c.x, dz = z - c.z;
  const lx = dx * c.cos + dz * c.sin, lz = -dx * c.sin + dz * c.cos;
  return Math.abs(lx) < c.hx + pad && Math.abs(lz) < c.hz + pad;
}

// Ground under a point: terrain, or the top of anything walkable that the
// feet are already at (or just above). `feetY` decides what counts.
// The walkable base surface: the outdoor terrain, or the cave floor when inside.
function floorAt(x, z) { return GAME.inCave ? caveFloorAt(x, z) : heightAt(x, z); }
function groundAt(x, z, feetY, pad = 0.2) {
  let g = floorAt(x, z);
  for (const c of nearColliders(x, z, 1)) {
    if (c.noGround) continue;
    if (c.y1 <= feetY + PHYS.STEP && c.y1 > g && insideFootprint(c, x, z, pad)) g = c.y1;
  }
  return g;
}

// Push a circle (x,z,r) out of every wall it overlaps. Mutates p.
function pushOut(p, r, feetY, height) {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const c of nearColliders(p.x, p.z, r + 2)) {
      if (c.y1 <= feetY + PHYS.STEP || c.y0 >= feetY + height) continue;   // stepped on, or overhead
      if (c.kind === 'circle') {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
        if (d < m && d > 1e-5) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; moved = true; }
      } else {
        const dx = p.x - c.x, dz = p.z - c.z;
        let lx = dx * c.cos + dz * c.sin, lz = -dx * c.sin + dz * c.cos;
        const cx = clamp(lx, -c.hx, c.hx), cz = clamp(lz, -c.hz, c.hz);
        let ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez);
        if (d < r) {
          if (d < 1e-5) {                       // centre inside the box: leave by the nearest face
            const ox = c.hx - Math.abs(lx), oz = c.hz - Math.abs(lz);
            if (ox < oz) { lx = Math.sign(lx || 1) * (c.hx + r); } else { lz = Math.sign(lz || 1) * (c.hz + r); }
          } else { lx = cx + ex / d * r; lz = cz + ez / d * r; }
          p.x = c.x + lx * c.cos - lz * c.sin;
          p.z = c.z + lx * c.sin + lz * c.cos;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

/* A body: { pos: Vector3 (feet), vel: Vector3, r, h, grounded, groundY, inWater, flying } */
const _p = { x: 0, z: 0 };
function moveBody(b, dt) {
  const ox = b.pos.x, oz = b.pos.z;
  // wading, you can haul yourself out onto anything at the waterline (an ice
  // floe, a jetty): step tests measure from the surface, not the riverbed
  const feet = b.pos.y + (b.inWater || 0);
  _p.x = ox + b.vel.x * dt; _p.z = oz + b.vel.z * dt;

  // steepness: refuse to walk UP a too-steep slope (sliding along it is fine)
  if (!b.flying) {
    const g0 = groundAt(ox, oz, feet), g1 = groundAt(_p.x, _p.z, feet);
    const run = Math.hypot(_p.x - ox, _p.z - oz);
    if (run > 1e-4 && g1 - g0 > PHYS.STEP * 0.5 && (g1 - g0) / run > PHYS.MAX_SLOPE_TAN && g1 > feet + PHYS.STEP) {
      // try each axis alone so you slide along the contour instead of sticking
      const gx = groundAt(_p.x, oz, feet), gz = groundAt(ox, _p.z, feet);
      const okX = (gx - g0) / Math.max(Math.abs(_p.x - ox), 1e-4) <= PHYS.MAX_SLOPE_TAN || gx <= feet + PHYS.STEP;
      const okZ = (gz - g0) / Math.max(Math.abs(_p.z - oz), 1e-4) <= PHYS.MAX_SLOPE_TAN || gz <= feet + PHYS.STEP;
      if (okX && !okZ) _p.z = oz; else if (okZ && !okX) _p.x = ox; else { _p.x = ox; _p.z = oz; }
      b.blocked = true;
    } else b.blocked = false;
  }

  // deep water: no swimming animations exist, so wading depth is the limit for
  // WALKING (a jump may carry you over it, onto a floe)
  if (!b.flying && !b.canSwim && !GAME.inCave && b.grounded) {
    const w = waterAt(_p.x, _p.z);
    if (w > NO_WATER && w - heightAt(_p.x, _p.z) > PHYS.WADE && !b.onPlatform && !(groundAt(_p.x, _p.z, feet) > w - 0.3)) {
      const w0 = waterAt(ox, oz);
      const deeperThanBefore = !(w0 > NO_WATER) || (w - heightAt(_p.x, _p.z)) > (w0 - heightAt(ox, oz));
      if (deeperThanBefore) { _p.x = ox; _p.z = oz; b.hitDeepWater = true; }
    }
  }

  pushOut(_p, b.r, feet, b.h);

  // playable boundary — a soft wall well inside the mountains
  if (!b.noBounds) { _p.x = clamp(_p.x, WORLD.px0, WORLD.px1); _p.z = clamp(_p.z, WORLD.pz0, WORLD.pz1); }

  b.pos.x = _p.x; b.pos.z = _p.z;

  // vertical
  const ground = groundAt(b.pos.x, b.pos.z, feet);
  b.onPlatform = ground > floorAt(b.pos.x, b.pos.z) + 0.05;
  if (b.flying) { b.pos.y += b.vel.y * dt; b.grounded = false; b.groundY = ground; return; }
  if (b.grounded && b.vel.y <= 0 && b.pos.y - ground < PHYS.STEP + 0.25) {
    // stick to the ground when walking downhill instead of bouncing off it
    b.pos.y = ground; b.vel.y = 0;
  } else {
    b.vel.y += PHYS.GRAVITY * (b.gravityScale ?? 1) * dt;
    b.vel.y = Math.max(b.vel.y, b.maxFall ?? -45);
    b.pos.y += b.vel.y * dt;
    if (b.pos.y <= ground) {
      b.landSpeed = -b.vel.y;
      b.pos.y = ground; b.vel.y = 0;
      if (!b.grounded) b.justLanded = true;
      b.grounded = true;
    } else b.grounded = false;
  }
  b.groundY = ground;
  const w = GAME.inCave ? NO_WATER : waterAt(b.pos.x, b.pos.z);
  b.inWater = w > NO_WATER && w > b.pos.y + 0.1 ? w - b.pos.y : 0;
}

/* ───────────── raycasts (spell aim, camera, line of sight) ───────────── */
// Returns distance along the ray to the terrain, or Infinity.
function rayTerrain(o, d, maxDist) {
  // "above" = distance to the nearest surface along y: floor below, ceiling above (cave)
  const clearance = (x, y, z) => { const f = y - floorAt(x, z); return GAME.inCave ? Math.min(f, caveCeilAt(x, z) - y) : f; };
  let t = 0, step = 1.0, prevAbove = clearance(o.x, o.y, o.z);
  if (prevAbove < 0) return 0;
  while (t < maxDist) {
    const nt = Math.min(t + step, maxDist);
    const x = o.x + d.x * nt, y = o.y + d.y * nt, z = o.z + d.z * nt;
    const above = clearance(x, y, z);
    if (above < 0) {
      // bisect for the crossing
      let a = t, b = nt;
      for (let i = 0; i < 12; i++) {
        const m = (a + b) / 2;
        if (clearance(o.x + d.x * m, o.y + d.y * m, o.z + d.z * m) < 0) b = m; else a = m;
      }
      return (a + b) / 2;
    }
    t = nt; step = Math.min(8, Math.max(0.5, above * 0.5));
  }
  return Infinity;
}
// Ray vs static colliders (treated as vertical prisms). Returns distance or Infinity.
function rayColliders(o, d, maxDist) {
  let best = Infinity;
  const steps = Math.ceil(maxDist / PHYS.CELL) + 1;
  const seen = new Set();
  for (let s = 0; s <= steps; s++) {
    const t = Math.min(s * PHYS.CELL, maxDist);
    for (const c of nearColliders(o.x + d.x * t, o.z + d.z * t, PHYS.CELL)) {
      if (seen.has(c)) continue; seen.add(c);
      const hit = rayVsCollider(o, d, c);
      if (hit < best && hit <= maxDist) best = hit;
    }
  }
  return best;
}
function rayVsCollider(o, d, c) {
  // 2D slab/circle intersection, then check the height span at the hit
  let tEnter, tExit;
  if (c.kind === 'circle') {
    const fx = o.x - c.x, fz = o.z - c.z, a = d.x * d.x + d.z * d.z;
    if (a < 1e-8) return Infinity;
    const b = 2 * (fx * d.x + fz * d.z), cc = fx * fx + fz * fz - c.r * c.r;
    const disc = b * b - 4 * a * cc;
    if (disc < 0) return Infinity;
    const sq = Math.sqrt(disc);
    tEnter = (-b - sq) / (2 * a); tExit = (-b + sq) / (2 * a);
  } else {
    const dx = o.x - c.x, dz = o.z - c.z;
    const lx = dx * c.cos + dz * c.sin, lz = -dx * c.sin + dz * c.cos;
    const ldx = d.x * c.cos + d.z * c.sin, ldz = -d.x * c.sin + d.z * c.cos;
    let t0 = -Infinity, t1 = Infinity;
    for (const [p, v, h] of [[lx, ldx, c.hx], [lz, ldz, c.hz]]) {
      if (Math.abs(v) < 1e-8) { if (Math.abs(p) > h) return Infinity; continue; }
      let a = (-h - p) / v, b = (h - p) / v; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return Infinity;
    }
    tEnter = t0; tExit = t1;
  }
  if (tExit < 0) return Infinity;
  const t = Math.max(tEnter, 0);
  const y = o.y + d.y * t;
  if (y >= c.y0 && y <= c.y1) return t;
  // could enter through the top/bottom — check the plane crossing
  if (Math.abs(d.y) > 1e-6) {
    for (const py of [c.y1, c.y0]) {
      const tp = (py - o.y) / d.y;
      if (tp >= t && tp <= tExit) return tp;
    }
  }
  return Infinity;
}
function raycastWorld(o, d, maxDist) {
  return Math.min(rayTerrain(o, d, maxDist), rayColliders(o, d, maxDist));
}
