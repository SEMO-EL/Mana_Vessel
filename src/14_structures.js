/* ═══════════════════════════════════════════════════════════════════════
   STRUCTURES — KayKit medieval set pieces placed into the world.
   All 61 pieces share one 15 KB gradient atlas, so they share ONE material.
   ═══════════════════════════════════════════════════════════════════════ */
const PROPS_LIB = new Map();       // name -> Object3D template (at origin)
let _propMat = null;
function propMaterial() {
  if (!_propMat) _propMat = toonMat({ map: assetTexture('textures/hexagons_medieval.png') });
  return _propMat;
}

async function loadPropsLibrary() {
  const g = await parseGLB('models/props.glb');
  const mat = propMaterial();
  for (const child of [...g.scene.children]) {
    child.position.set(0, 0, 0);
    child.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = true; o.receiveShadow = true; } });
    child.updateMatrixWorld(true);
    PROPS_LIB.set(child.name, child);
  }
}

// Measured once: footprint (x/z half-extents) and height of each template.
const PROP_SIZE = new Map();
function propSize(name) {
  if (PROP_SIZE.has(name)) return PROP_SIZE.get(name);
  const b = new THREE.Box3().setFromObject(PROPS_LIB.get(name));
  const s = { hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2, h: b.max.y - b.min.y, minY: b.min.y,
              cx: (b.max.x + b.min.x) / 2, cz: (b.max.z + b.min.z) / 2 };
  PROP_SIZE.set(name, s);
  return s;
}
