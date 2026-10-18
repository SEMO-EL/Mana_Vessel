/* ═══════════════════════════════════════════════════════════════════════
   BLADE TRAILS — a ribbon of light that follows the edge through a swing,
   yours in your sword school's colour, Eris's in Boreas red. It's laid
   down only while the attack plays and fades from the tail as it ends.
   ═══════════════════════════════════════════════════════════════════════ */
const TRAIL_N = 16;
const TRAILS = [];
class BladeTrail {
  constructor(getBone, active, colour) {
    this.getBone = getBone; this.active = active; this.colour = colour;
    this.base = []; this.tip = []; this.fade = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(TRAIL_N * 2 * 3); this.col = new Float32Array(TRAIL_N * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 6;
    scene.add(this.mesh);
  }
  update(dt) {
    const on = this.active();
    this.fade = on ? Math.min(1, this.fade + dt * 12) : Math.max(0, this.fade - dt * 5);
    if (this.fade <= 0) { this.mesh.visible = false; this.base.length = this.tip.length = 0; return; }
    const bone = this.getBone();
    if (!bone) return;
    const span = bone.span || [0.25, 1.35];
    const b = bone.localToWorld(new THREE.Vector3(0, span[0], 0)), t = bone.localToWorld(new THREE.Vector3(0, span[1], 0));
    if (on) { this.base.unshift(b); this.tip.unshift(t); }
    else { this.base.unshift(this.base[0] || b); this.tip.unshift(this.tip[0] || t); }      // the tail catches up with the head
    if (this.base.length > TRAIL_N) { this.base.length = TRAIL_N; this.tip.length = TRAIL_N; }
    const n = this.base.length, c = this.colour();
    for (let i = 0; i < TRAIL_N; i++) {
      const k = Math.min(i, n - 1), B = this.base[k], T = this.tip[k];
      this.pos.set([B.x, B.y, B.z, T.x, T.y, T.z], i * 6);
      const a = Math.pow(1 - i / (TRAIL_N - 1), 1.6) * this.fade;
      this.col.set([c.r * a * 0.35, c.g * a * 0.35, c.b * a * 0.35, c.r * a * 1.3, c.g * a * 1.3, c.b * a * 1.3], i * 6);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
    this.mesh.visible = true;
  }
}
const _trailCol = new THREE.Color();
function initTrails() {
  // yours: the staff or the sword, whichever is in your hand
  TRAILS.push(new BladeTrail(() => {
    if (!PL.actor) return null;
    const hs = PL.actor.bones.handslotr; if (!hs) return null;
    const staff = PL.actor.meshes && PL.actor.meshes['2H_Staff'] && PL.actor.meshes['2H_Staff'].visible;
    hs.span = staff ? [0.5, 1.25] : [0.25, 1.38];
    return hs;
  }, () => PL.state === 'attack' && !!PL.actor && PL.actor.root.visible, () => _trailCol.set(STYLES[G ? G.style : 'sword'].col)));
  // Eris's sword
  TRAILS.push(new BladeTrail(() => ALLY.eris && ALLY.eris.actor.bones.handslotr, () => !!ALLY.eris && ALLY.eris.active && ALLY.eris.state === 'attack', () => _trailCol.set('#e8606f')));
}
function updateTrails(dt) { for (const t of TRAILS) t.update(dt); }
