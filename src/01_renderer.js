/* ═══════════════════════════════════════════════════════════════════════
   RENDERER — renderer, camera, post chain, and the shared material system.

   The painterly look is three decisions applied to EVERY surface:
     1. a soft three-band toon ramp instead of physical shading
     2. height fog that takes the sky's colour and glows toward the sun,
        so distance reads as paint rather than as grey haze
     3. a thin rim light, so characters separate from busy backgrounds
   All of it lives in toonMat()/patchWorld(); nothing else touches shading.
   ═══════════════════════════════════════════════════════════════════════ */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1300);

/* ───────────── world fog (shared uniforms, one object per value) ───────────── */
const WFOG = {
  wfColor:    { value: new THREE.Color('#9bb0c8') },
  wfSunColor: { value: new THREE.Color('#ffd9a0') },
  wfSunDir:   { value: new THREE.Vector3(0, 1, 0) },
  // x density, y height falloff, z fog base height, w sun-scatter strength
  wfParams:   { value: new THREE.Vector4(0.0026, 0.012, 10, 0.8) },
  // x rim strength, y time (s), z wind strength, w wetness
  wfMisc:     { value: new THREE.Vector4(0.35, 0, 1, 0) },
};

const FOG_VERT_DECL = /* glsl */`varying vec3 vWFPos;`;
const FOG_VERT_CALC = /* glsl */`
  { vec4 wfp = vec4( transformed, 1.0 );
    #ifdef USE_INSTANCING
      wfp = instanceMatrix * wfp;
    #endif
    vWFPos = ( modelMatrix * wfp ).xyz; }`;
const FOG_FRAG_DECL = /* glsl */`
  varying vec3 vWFPos;
  uniform vec3 wfColor; uniform vec3 wfSunColor; uniform vec3 wfSunDir;
  uniform vec4 wfParams; uniform vec4 wfMisc;
  vec3 wfApply( vec3 col ) {
    vec3 V = vWFPos - cameraPosition;
    float d = length( V );
    vec3 dir = V / max( d, 1e-4 );
    float fall = wfParams.y;
    float h0 = cameraPosition.y - wfParams.z;
    float dy = V.y;
    // analytic integral of an exponential height-fog along the view ray
    float k = abs( dy ) > 0.05 ? ( 1.0 - exp( -fall * dy ) ) / ( fall * dy ) : 1.0;
    float amt = 1.0 - exp( -max( wfParams.x * exp( -fall * h0 ) * k * d, 0.0 ) );
    float sun = pow( max( dot( dir, wfSunDir ), 0.0 ), 6.0 ) * wfParams.w;
    return mix( col, mix( wfColor, wfSunColor, clamp( sun, 0.0, 1.0 ) ), clamp( amt, 0.0, 1.0 ) );
  }`;

// Patch a built-in material's shader. flags: { rim, fog }
function patchWorld(shader, flags) {
  Object.assign(shader.uniforms, WFOG);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + FOG_VERT_DECL)
    .replace('#include <fog_vertex>', '#include <fog_vertex>\n' + FOG_VERT_CALC);
  let fs = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + FOG_FRAG_DECL);
  if (flags.rim) {
    fs = fs.replace('#include <opaque_fragment>', /* glsl */`
      { float rimF = 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
        outgoingLight += wfSunColor * pow( rimF, 3.0 ) * wfMisc.x; }
      #include <opaque_fragment>`);
  }
  if (flags.fog !== false) fs = fs.replace('#include <fog_fragment>', 'gl_FragColor.rgb = wfApply( gl_FragColor.rgb );');
  shader.fragmentShader = fs;
}

/* soft three-band toon ramp: deep shade / terminator band / lit */
const RAMP = (() => {
  const n = 256, d = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const a = smooth(0.40, 0.50, x) * 0.55;
    const b = smooth(0.58, 0.70, x) * 0.45;
    d[i] = Math.round((0.10 + (a + b) * 0.90) * 255);
  }
  const t = new THREE.DataTexture(d, n, 1, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
})();

/* Every lit, opaque surface in the game is made here. */
function toonMat(opts = {}) {
  const { rim = false, fog = true, onShader = null, ...rest } = opts;
  const m = new THREE.MeshToonMaterial({ gradientMap: RAMP, ...rest });
  m.onBeforeCompile = shader => { patchWorld(shader, { rim, fog }); if (onShader) onShader(shader); };
  m.customProgramCacheKey = () => 'toon' + (rim ? 'R' : '') + (fog ? 'F' : '') + (onShader ? onShader.key || 'x' : '');
  return m;
}
// Unlit / custom materials opt into the same fog with this.
function fogChunkFor(shader) { patchWorld(shader, { rim: false, fog: true }); }

/* ───────────── post chain ───────────── */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uLift: { value: new THREE.Color(0, 0, 0) },
    uGain: { value: new THREE.Color(1, 1, 1) },
    uSat: { value: 1.08 },
    uContrast: { value: 1.04 },
    uVignette: { value: 0.32 },
    uTime: { value: 0 },
    uFlash: { value: new THREE.Vector4(0, 0, 0, 0) },   // rgb + amount
    uDesat: { value: 0 },                               // vessel collapse / death
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec3 uLift; uniform vec3 uGain;
    uniform float uSat; uniform float uContrast; uniform float uVignette; uniform float uTime;
    uniform vec4 uFlash; uniform float uDesat;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      col = col * uGain + uLift * (1.0 - col);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat * (1.0 - uDesat));
      col = (col - 0.18) * uContrast + 0.18;
      col = mix(col, uFlash.rgb, uFlash.a);
      vec2 q = vUv - 0.5;
      col *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(q * vec2(1.25, 1.0)) * 1.3);
      col += (hash(vUv * 1000.0 + uTime) - 0.5) * 0.012;
      gl_FragColor = vec4(max(col, 0.0), c.a);
    }`,
};

let composer, bloomPass, gradePass, renderPass;
function buildComposer() {
  const q = Q();
  if (composer) composer.dispose();
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: q.msaa });
  composer = new EffectComposer(renderer, rt);
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.5, 0.92);
  bloomPass.enabled = q.bloom;
  composer.addPass(bloomPass);
  gradePass = new ShaderPass(GradeShader);
  composer.addPass(gradePass);
  composer.addPass(new OutputPass());
  resize();
}

/* ───────────── sizing ─────────────
   Driven by a ResizeObserver, never by a one-off innerWidth read: a page
   that loads while hidden or minimised reports 0×0 and must recover.   */
let viewW = 1, viewH = 1;
function resize() {
  const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
  viewW = w; viewH = h;
  const pr = Math.min(devicePixelRatio || 1, 2) * Q().scale;
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); }
}
new ResizeObserver(resize).observe(canvas);

function applyQuality() {
  const q = Q();
  camera.far = q.far;
  camera.fov = SETTINGS.fov;
  camera.updateProjectionMatrix();
  buildComposer();
  BUS.emit('quality', q);
}
