/* ═══════════════════════════════════════════════════════════════════════
   WATER — the river (a ribbon down the carved channel) and the lake.

   One shader for both. It reads the terrain height texture to know how
   deep the water is at every pixel: shallow water is clear and turquoise
   with foam at the edge, deep water goes dark teal and reflects the sky.
   The river's UVs run along its length, so the ripples flow downstream,
   and faster where the channel drops (the falls).
   ═══════════════════════════════════════════════════════════════════════ */
const WATER = { meshes: [], mat: null };

function waterMaterial() {
  const u = {
    uHeight: { value: TER.heightTex }, uN: { value: TER.N }, uExt: { value: WORLD.ext }, uCell: { value: WORLD.cell },
    uTime: { value: 0 }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
    uSunCol: { value: new THREE.Color() }, uSunVis: { value: 1 },
  };
  Object.assign(u, WFOG);
  return new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      attribute float aSteep; attribute float aFlow;
      varying vec3 vWFPos; varying vec2 vUv; varying float vSteep; varying float vFlow;
      void main(){
        vUv = uv; vSteep = aSteep; vFlow = aFlow;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWFPos = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uHeight; uniform float uN, uExt, uCell, uTime, uSunVis;
      uniform vec3 uZen, uHor, uSunCol;
      ${FOG_FRAG_DECL}
      varying vec2 vUv; varying float vSteep; varying float vFlow;
      float wh(vec2 p){ return fract(sin(dot(p, vec2(12.99, 78.23))) * 43758.55); }
      float wn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(wh(i),wh(i+vec2(1,0)),f.x), mix(wh(i+vec2(0,1)),wh(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float ground = texture2D(uHeight, ((vWFPos.xz + uExt) / uCell + 0.5) / uN).r;
        float depth = max(vWFPos.y - ground, 0.0);
        // flowing ripple normals: two noise layers scrolled downstream
        float spd = mix(0.05, 1.0 + vSteep * 6.0, vFlow);
        vec2 p1 = vec2(vUv.x * 2.0, vUv.y * 0.35 - uTime * spd * 0.8);
        vec2 p2 = vec2(vUv.x * 5.0 + 3.0, vUv.y * 0.9 - uTime * spd * 1.5);
        if (vFlow < 0.5) { p1 = vWFPos.xz * 0.12 + uTime * vec2(0.02, 0.01); p2 = vWFPos.xz * 0.37 - uTime * vec2(0.015, 0.03); }
        float e = 0.08;
        float n0 = wn(p1) * 0.6 + wn(p2) * 0.4;
        float nx = (wn(p1 + vec2(e,0)) * 0.6 + wn(p2 + vec2(e,0)) * 0.4) - n0;
        float nz = (wn(p1 + vec2(0,e)) * 0.6 + wn(p2 + vec2(0,e)) * 0.4) - n0;
        vec3 n = normalize(vec3(-nx * 3.0, 1.0, -nz * 3.0));
        vec3 V = normalize(cameraPosition - vWFPos);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
        vec3 shallow = vec3(0.10, 0.24, 0.20);
        vec3 deep = vec3(0.02, 0.07, 0.09);
        vec3 col = mix(shallow, deep, smoothstep(0.2, 3.0, depth));
        vec3 R = reflect(-V, n);
        vec3 sky = mix(uHor, uZen, smoothstep(0.0, 0.6, R.y));
        col = mix(col, sky * 0.85, 0.08 + fres * 0.5);
        float spec = pow(max(dot(R, wfSunDir), 0.0), 220.0) * 6.0 * uSunVis;
        col += uSunCol * spec;
        // foam: at the shoreline, and wherever the river drops steeply
        float fn = wn(p2 * 2.3) * 0.6 + wn(p1 * 4.0) * 0.4;
        float foam = smoothstep(0.55, 0.0, depth) * smoothstep(0.45, 0.8, fn);
        foam = max(foam, smoothstep(0.08, 0.35, vSteep) * smoothstep(0.35, 0.7, fn));
        col = mix(col, vec3(0.92, 0.95, 0.94) * (0.35 + 0.65 * uSunVis + 0.2), foam * 0.85);
        float alpha = mix(0.45, 0.93, smoothstep(0.0, 2.2, depth));
        alpha = max(alpha, foam * 0.9);
        gl_FragColor = vec4(wfApply(col), alpha);
      }`,
  });
}

function buildWater() {
  const mat = WATER.mat = waterMaterial();

  /* river ribbon */
  const P = TER.riverPath;                 // [x, z, level]
  const half = RIVER_WIDTH / 2 + 2.5;
  const pos = [], uv = [], steep = [], flow = [], idx = [];
  let along = 0, rows = 0;
  for (let i = 0; i < P.length; i++) {
    const [x, z, L] = P[i];
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r - 12) break;    // hand over to the lake
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const nx = -tz, nz = tx;
    if (i > 0) along += Math.hypot(x - P[i - 1][0], z - P[i - 1][1]);
    const drop = Math.max(0, a[2] - b[2]) / Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (const s of [-1, 1]) {
      pos.push(x + nx * half * s, L, z + nz * half * s);
      uv.push(s, along);
      steep.push(clamp(drop, 0, 1));
      flow.push(1);
    }
    if (rows > 0) {
      const r0 = (rows - 1) * 2, r1 = rows * 2;
      idx.push(r0, r0 + 1, r1, r0 + 1, r1 + 1, r1);
    }
    rows++;
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  rg.setAttribute('aSteep', new THREE.Float32BufferAttribute(steep, 1));
  rg.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 1));
  rg.setIndex(idx);
  // ribbons are wound by path direction; render both faces rather than guess
  const river = new THREE.Mesh(rg, mat);
  river.material.side = THREE.DoubleSide;
  river.renderOrder = 2;

  /* lake disc */
  const lg = new THREE.CircleGeometry(LAKE.r + 10, 72);
  lg.rotateX(-Math.PI / 2);
  const n = lg.attributes.position.count;
  lg.setAttribute('aSteep', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  lg.setAttribute('aFlow', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  const lake = new THREE.Mesh(lg, mat);
  lake.position.set(LAKE.x, WORLD.lakeLevel, LAKE.z);
  lake.renderOrder = 2;

  WATER.meshes.push(river, lake);
  scene.add(river, lake);
}

function updateWater(time) {
  if (!WATER.mat) return;
  const u = WATER.mat.uniforms;
  u.uTime.value = time;
  u.uZen.value.copy(SKY_NOW.zen);
  u.uHor.value.copy(SKY_NOW.hor);
  u.uSunCol.value.copy(SKY_NOW.sun);
  u.uSunVis.value = (1 - SKY_NOW.night * 0.85) * (1 - WEATHER.cur.cloud * 0.7);
}
