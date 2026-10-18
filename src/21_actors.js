/* ═══════════════════════════════════════════════════════════════════════
   ACTORS — KayKit characters: cloning, recolouring, animation.

   All nine characters share one 41-bone rig and one clip library, so any
   clip plays on anyone. Characters are ~3 units tall in the source; the
   game scales them to 1.7 m.

   Recolouring: each texture is an 8×4 grid of gradient swatches; a body
   part samples one swatch. Repainting a swatch (keeping its light→dark
   gradient) recolours every part that uses it. Hair is swatch 1 on every
   humanoid; robe 8/9 on the mage; skin 0/23.

   Animation layers: a full-body BASE (locomotion, attacks, dodges) and an
   optional UPPER overlay (casting while you walk). When the overlay is on,
   the base switches to the lower-body half of the same clip, so legs keep
   walking while arms cast — without the two fighting over the spine.
   ═══════════════════════════════════════════════════════════════════════ */
const CHAR_SCALE = 0.57;
const CHARS = { lib: new Map(), clips: new Map(), lower: new Map(), upper: new Map(), images: new Map() };
const UPPER_BONES = new Set(['spine', 'chest', 'head', 'upperarml', 'lowerarml', 'wristl', 'handl', 'handslotl',
  'upperarmr', 'lowerarmr', 'wristr', 'handr', 'handslotr']);
const TEX_OF = { mage_texture: 'mage', knight_texture: 'knight', rogue_texture: 'rogue', barbarian_texture: 'barbarian', skeleton: 'skeleton' };

async function loadCharacters() {
  const [chars, anims] = await Promise.all([parseGLB('models/characters.glb'), parseGLB('models/anims.glb')]);
  for (const c of [...chars.scene.children]) {
    c.position.set(0, 0, 0);
    // All nine rigs share bone names, so GLTFLoader made them unique across the
    // file ("upperarml_1", "upperarml_2"…). The shared clips target the plain
    // names — undo the suffix inside each character or only the first one moves.
    c.traverse(o => { if (o !== c) o.name = o.name.replace(/_\d+$/, ''); });
    CHARS.lib.set(c.name, c);
  }
  for (const clip of anims.animations) {
    if (clip.name.startsWith('Dodge_')) {
      // dodges carry ~0.4 m of root travel; the controller moves you instead
      for (const t of clip.tracks) if (t.name === 'root.position') {
        const v = t.values; for (let i = 3; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; }
      }
    }
    CHARS.clips.set(clip.name, clip);
  }
  // decoded palette images, for recolouring
  await Promise.all(Object.values(TEX_OF).map(async k => {
    const file = k === 'skeleton' ? 'skeleton_texture' : k + '_texture';
    const blob = new Blob([MV_ASSET('textures/' + file + '.png')], { type: 'image/png' });
    CHARS.images.set(k, await createImageBitmap(blob));
  }));
}

function clipPart(name, part) {
  const store = part === 'upper' ? CHARS.upper : CHARS.lower;
  if (store.has(name)) return store.get(name);
  const src = CHARS.clips.get(name);
  if (!src) return null;
  const c = src.clone();
  c.name = name + '#' + part;
  c.tracks = c.tracks.filter(t => {
    const bone = t.name.slice(0, t.name.lastIndexOf('.'));
    return part === 'upper' ? UPPER_BONES.has(bone) : !UPPER_BONES.has(bone);
  });
  store.set(name, c);
  return c;
}

/* recoloured texture variants, cached by (texture, recipe) */
const _variantCache = new Map();
function paletteTexture(texKey, recolor) {
  const key = texKey + JSON.stringify(recolor || {});
  if (_variantCache.has(key)) return _variantCache.get(key);
  const img = CHARS.images.get(texKey);
  // The source is 1024² but only 8×4 smooth gradients: 256² keeps every swatch
  // (32×64 texels each) at a sixteenth of the memory per recoloured character.
  const cv = document.createElement('canvas');
  cv.width = Math.min(256, img.width); cv.height = Math.min(256, img.height);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  if (recolor) {
    const sw = cv.width / 8, sh = cv.height / 4;
    for (const [idx, hex] of Object.entries(recolor)) {
      const sx = (idx % 8) * sw, sy = Math.floor(idx / 8) * sh;
      const d = ctx.getImageData(sx, sy, sw, sh);
      const target = new THREE.Color(hex);          // linear
      // mean luminance of the swatch, so its gradient keeps its relative shading
      let mean = 0;
      for (let i = 0; i < d.data.length; i += 4) mean += 0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2];
      mean = Math.max(1, mean / (d.data.length / 4));
      const tc = target.clone().convertLinearToSRGB();
      for (let i = 0; i < d.data.length; i += 4) {
        const l = (0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2]) / mean;
        d.data[i] = clamp(tc.r * 255 * l, 0, 255);
        d.data[i + 1] = clamp(tc.g * 255 * l, 0, 255);
        d.data[i + 2] = clamp(tc.b * 255 * l, 0, 255);
      }
      ctx.putImageData(d, sx, sy);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4;
  _variantCache.set(key, t);
  return t;
}
const _matCache = new Map();
function charMaterial(texKey, recolor, emissive) {
  const key = texKey + JSON.stringify(recolor || {}) + (emissive || '');
  if (_matCache.has(key)) return _matCache.get(key);
  const m = toonMat({ map: paletteTexture(texKey, recolor), rim: true });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 0.0; }
  _matCache.set(key, m);
  return m;
}

/* ───────────── Actor ───────────── */
class Actor {
  /* spec: { base, recolor, hide:[meshNames], show:[meshNames], scale, extra:[fn(actor)] } */
  constructor(spec) {
    const tpl = CHARS.lib.get(spec.base);
    if (!tpl) throw new Error('unknown character ' + spec.base);
    this.spec = spec;
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(tpl);
    this.model.scale.setScalar(CHAR_SCALE * (spec.scale || 1));
    this.root.add(this.model);
    this.meshes = {};
    this.bones = {};
    this.model.traverse(o => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isMesh) {
        this.meshes[o.name] = o;
        const texKey = TEX_OF[o.material.name] || 'mage';
        // recolour recipes are keyed by texture: { mage: { 1: '#hex' }, knight: {...} }
        o.material = charMaterial(texKey, (spec.recolor && spec.recolor[texKey]) || null);
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;          // skinned bounds are stale under animation
      }
    });
    // accessories: everything attached to a hand/head/chest slot starts hidden
    // unless listed in `show`; body parts stay visible unless listed in `hide`
    for (const [n, m] of Object.entries(this.meshes)) {
      if (!m.isSkinnedMesh) m.visible = (spec.show || []).includes(n);
      if ((spec.hide || []).includes(n)) m.visible = false;
    }
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = new Map();
    this.base = null; this.baseName = null; this.upper = null; this.upperName = null;
    this.oneShot = null;
    this.mixer.addEventListener('finished', e => {
      if (this.oneShot && e.action === this.oneShot.action) {
        const cb = this.oneShot.onEnd; this.oneShot = null; if (cb) cb();
      }
    });
    if (spec.extra) for (const f of spec.extra) f(this);
  }

  action(clip) {
    let a = this.actions.get(clip);
    if (!a) { a = this.mixer.clipAction(clip); this.actions.set(clip, a); }
    return a;
  }
  _clip(name, part) {
    if (part) return clipPart(name, part);
    const c = CHARS.clips.get(name);
    if (!c) console.warn('missing clip', name);
    return c;
  }

  /* Loop a base clip (locomotion, idles). No-op if it's already playing. */
  loop(name, { fade = 0.2, speed = 1 } = {}) {
    const part = this.upper ? 'lower' : null;
    const clip = this._clip(name, part);
    if (!clip) return;
    const a = this.action(clip);
    a.timeScale = speed;
    if (this.base === a) return;
    a.reset().setLoop(THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = false;
    a.play();
    if (this.base) a.crossFadeFrom(this.base, fade, false);
    // keep the gait phase when swapping full <-> lower-body of the same clip
    if (this.base && this.baseName === name) a.time = this.base.time;
    this.base = a; this.baseName = name;
    this.oneShot = null;
  }
  /* Play once, hold the last frame, call onEnd. */
  once(name, { fade = 0.12, speed = 1, onEnd = null, from = 0 } = {}) {
    const clip = this._clip(name);
    if (!clip) { if (onEnd) onEnd(); return null; }
    const a = this.action(clip);
    a.reset().setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = speed;
    a.time = from * clip.duration;
    a.play();
    if (this.base && this.base !== a) a.crossFadeFrom(this.base, fade, false);
    this.base = a; this.baseName = name;
    this.oneShot = { action: a, onEnd };
    return a;
  }
  /* Upper-body overlay on/off (casting while moving). */
  setUpper(name, { speed = 1, loop = true } = {}) {
    if (name === this.upperName) return;
    if (this.upper) this.upper.fadeOut(0.15);
    this.upperName = name;
    if (!name) {
      this.upper = null;
      if (this.baseName && this.base && this.base.loop === THREE.LoopRepeat) { const n = this.baseName; this.base = null; this.loop(n, { fade: 0.15 }); }
      return;
    }
    const clip = this._clip(name, 'upper');
    const a = this.action(clip);
    a.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    a.clampWhenFinished = !loop;
    a.timeScale = speed;
    a.fadeIn(0.15).play();
    this.upper = a;
    if (this.baseName && this.base && this.base.loop === THREE.LoopRepeat) { const n = this.baseName; this.base = null; this.loop(n, { fade: 0.15 }); }
  }
  progress() {
    const a = this.base; if (!a) return 0;
    return a.getClip().duration ? a.time / a.getClip().duration : 1;
  }
  show(meshName, on) { const m = this.meshes[meshName]; if (m) m.visible = on; }
  // world position of a bone (e.g. 'handslotr' for spell origins, 'head' for the lock marker)
  bonePos(name, out = new THREE.Vector3()) { const b = this.bones[name]; return b ? b.getWorldPosition(out) : out.copy(this.root.position); }
  update(dt) { this.mixer.update(dt); }
}

// Attach a clone of another character's accessory mesh to this actor's bone
// (e.g. give the mage the knight's sword). Same rig, so the offset carries over.
function borrowMesh(actor, fromBase, meshName, boneName) {
  let src = null;
  CHARS.lib.get(fromBase).traverse(o => { if (o.name === meshName) src = o; });
  if (!src) return null;
  const m = new THREE.Mesh(src.geometry, charMaterial(TEX_OF[src.material.name] || 'knight', null));
  m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale);
  m.name = meshName; m.castShadow = true; m.visible = false;
  actor.bones[boneName].add(m);
  actor.meshes[meshName] = m;
  return m;
}
