/* ═══════════════════════════════════════════════════════════════════════
   SKY, TIME OF DAY, WEATHER, and the two lights that light the world.

   One function — skyState() — decides every colour in the frame from the
   hour and the weather: sky gradient, fog colour, sun colour, ambient,
   and the colour grade. The fog's colour IS the sky's horizon colour, so
   distant terrain melts into the sky instead of into grey.
   ═══════════════════════════════════════════════════════════════════════ */
const TOD = { hour: 17.2, speed: 1 / 60, frozen: false };   // 1 in-game hour per real minute
const WEATHER = {
  // weights for the current and target state; transitions over ~40 s
  cur: { cloud: 0.25, rain: 0, fog: 0 },
  tgt: { cloud: 0.25, rain: 0, fog: 0 },
  timer: 90,
  wet: 0,
};
const WEATHER_STATES = {
  clear:    { cloud: 0.15, rain: 0, fog: 0 },
  fair:     { cloud: 0.35, rain: 0, fog: 0 },
  overcast: { cloud: 0.80, rain: 0, fog: 0.15 },
  rain:     { cloud: 0.95, rain: 1, fog: 0.25 },
  mist:     { cloud: 0.45, rain: 0, fog: 1 },
};

const SUN = new THREE.DirectionalLight('#fff0d8', 2.6);
SUN.castShadow = true;
SUN.shadow.bias = -0.0005;
SUN.shadow.normalBias = 0.04;
scene.add(SUN, SUN.target);
const HEMI = new THREE.HemisphereLight('#9bc0e8', '#6a6048', 1.1);
scene.add(HEMI);

/* palette keys, sRGB in / linear out */
const SKYP = {
  night:  { zen: '#070b1c', hor: '#1a2340', fog: '#18203a', sun: '#8fa8e0', sunI: 0.45, sky: '#26345e', gnd: '#0c0e16', hemiI: 0.55, lift: '#05081a', gain: '#9ab0ff' },
  dawn:   { zen: '#34447c', hor: '#f09d6a', fog: '#c8957e', sun: '#ffac70', sunI: 1.7,  sky: '#8b7fae', gnd: '#4a3a36', hemiI: 0.9,  lift: '#140810', gain: '#ffe0c8' },
  day:    { zen: '#3a74bd', hor: '#b9d2e8', fog: '#a8c1d8', sun: '#fff1dc', sunI: 2.7,  sky: '#9cc2ea', gnd: '#6b6049', hemiI: 1.15, lift: '#000000', gain: '#ffffff' },
};
for (const k in SKYP) for (const f in SKYP[k]) if (typeof SKYP[k][f] === 'string') SKYP[k][f] = new THREE.Color(SKYP[k][f]);

const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const SKY_NOW = {
  zen: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(),
  sky: new THREE.Color(), gnd: new THREE.Color(), lift: new THREE.Color(), gain: new THREE.Color(),
  sunI: 1, hemiI: 1, sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), elev: 0, night: 0,
};

function sunDirection(hour, out) {
  // 06:00 sunrise in the east (+X), 18:00 sunset in the west, slight southern arc
  const a = (hour - 6) / 12 * Math.PI;
  return out.set(Math.cos(a), Math.sin(a) * 0.92, 0.38).normalize();
}

function skyState() {
  const S = SKY_NOW;
  sunDirection(TOD.hour, S.sunDir);
  S.elev = S.sunDir.y;
  S.moonDir.copy(S.sunDir).negate(); S.moonDir.y = Math.abs(S.moonDir.y) * 0.8 + 0.25; S.moonDir.normalize();
  const e = S.elev;
  const wDay = smooth(0.06, 0.42, e);            // full day above ~25°
  const wTw = (1 - smooth(0.05, 0.3, Math.abs(e - 0.02))) * (1 - wDay * 0.6);   // twilight band around the horizon
  const wNight = smooth(0.02, -0.18, e);
  const W = WEATHER.cur;
  for (const f of ['zen', 'hor', 'fog', 'sun', 'sky', 'gnd', 'lift', 'gain']) {
    S[f].copy(SKYP.night[f]).lerp(SKYP.day[f], 1 - wNight).lerp(SKYP.dawn[f], wTw);
  }
  S.sunI = lerp(lerp(SKYP.night.sunI, SKYP.day.sunI, 1 - wNight), SKYP.dawn.sunI, wTw);
  S.hemiI = lerp(lerp(SKYP.night.hemiI, SKYP.day.hemiI, 1 - wNight), SKYP.dawn.hemiI, wTw);
  S.night = wNight;
  // cloud cover greys the sky and softens the sun; rain darkens everything
  const grey = W.cloud * 0.55 + W.rain * 0.3;
  _c1.setRGB(S.hor.r, S.hor.g, S.hor.b).lerp(_c2.set(0x8a8f99).multiplyScalar(lerp(1, 0.18, wNight)), grey);
  S.hor.copy(_c1);
  S.zen.lerp(_c2.set(0x6d737e).multiplyScalar(lerp(1, 0.15, wNight)), grey * 0.9);
  S.fog.lerp(S.hor, 0.55);
  S.sunI *= 1 - W.cloud * 0.55 - W.rain * 0.2;
  S.hemiI *= 1 + W.cloud * 0.12;
  return S;
}

/* ───────────── sky dome ───────────── */
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGnd: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
    uMoonDir: { value: new THREE.Vector3() }, uNight: { value: 0 },
    uCloud: { value: 0.3 }, uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform vec3 uZen, uHor, uGnd, uSunDir, uSunCol, uMoonDir; uniform float uNight, uCloud, uTime;
    varying vec3 vDir;
    float h2(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=vn(p)*a; p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
    void main(){
      vec3 d = normalize(vDir);
      float y = d.y;
      // gradient: ground haze below the horizon, horizon band, zenith
      vec3 col = mix(uHor, uZen, smoothstep(0.0, 0.55, y));
      col = mix(col, mix(uHor, uGnd, 0.35), smoothstep(0.0, -0.25, y));
      // sun: disk (HDR, blooms), glow, and warm horizon wash toward it
      float sd = max(dot(d, uSunDir), 0.0);
      col += uSunCol * (pow(sd, 900.0) * 30.0 + pow(sd, 18.0) * 0.55 + pow(sd, 3.0) * 0.18 * (1.0 - smoothstep(0.0, 0.6, y)));
      // moon + stars at night
      float md = max(dot(d, uMoonDir), 0.0);
      col += vec3(0.75, 0.82, 1.0) * (pow(md, 1600.0) * 6.0 + pow(md, 40.0) * 0.12) * uNight;
      if (y > 0.0) {
        vec3 sp = d * 180.0; vec2 cell = floor(sp.xz / (0.4 + y)) ;
        float st = h2(cell + floor(sp.y));
        float tw = 0.6 + 0.4 * sin(uTime * 2.0 + st * 60.0);
        col += vec3(0.9, 0.95, 1.0) * step(0.9965, st) * tw * uNight * smoothstep(0.0, 0.2, y) * 1.8;
      }
      // painted clouds on a dome projection
      if (y > 0.01) {
        vec2 uv = d.xz / (y + 0.12) * 1.3 + vec2(uTime * 0.004, uTime * 0.0015);
        float n = fbm(uv * 1.6);
        float cov = mix(0.62, 0.30, uCloud);
        float c = smoothstep(cov, cov + 0.22, n);
        vec3 lit = mix(uHor * 1.15, vec3(1.0), 0.35) * (1.0 - uNight * 0.85);
        vec3 shade = mix(uZen, uHor, 0.5) * 0.75;
        vec3 cc = mix(shade, lit, smoothstep(0.3, 0.9, fbm(uv * 1.6 + uSunDir.xz * 0.35)));
        cc += uSunCol * pow(sd, 6.0) * 0.6 * (1.0 - uNight);
        col = mix(col, cc, c * smoothstep(0.01, 0.12, y) * 0.9);
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
  side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
skyDome.renderOrder = -10;
skyDome.frustumCulled = false;
scene.add(skyDome);

/* ───────────── per-frame ───────────── */
const _snap = new THREE.Vector3(), _lsx = new THREE.Vector3(), _lsy = new THREE.Vector3(), _lsz = new THREE.Vector3();
function updateSky(dt, focus, time) {
  if (!TOD.frozen) TOD.hour = (TOD.hour + dt * TOD.speed + 24) % 24;

  // weather: drift toward a target state, pick a new one now and then
  WEATHER.timer -= dt;
  if (WEATHER.timer <= 0) {
    const r = Math.random();
    const next = r < 0.35 ? 'clear' : r < 0.62 ? 'fair' : r < 0.78 ? 'overcast' : r < 0.92 ? 'rain' : 'mist';
    Object.assign(WEATHER.tgt, WEATHER_STATES[next]);
    WEATHER.timer = rnd(120, 260);
  }
  for (const k of ['cloud', 'rain', 'fog']) WEATHER.cur[k] = damp(WEATHER.cur[k], WEATHER.tgt[k], 0.05, dt);
  WEATHER.wet = clamp(WEATHER.wet + (WEATHER.cur.rain > 0.3 ? dt / 20 : -dt / 90), 0, 1);

  const S = skyState();

  skyMat.uniforms.uZen.value.copy(S.zen);
  skyMat.uniforms.uHor.value.copy(S.hor);
  skyMat.uniforms.uGnd.value.copy(S.gnd);
  skyMat.uniforms.uSunDir.value.copy(S.sunDir);
  skyMat.uniforms.uSunCol.value.copy(S.sun).multiplyScalar(1 - S.night);
  skyMat.uniforms.uMoonDir.value.copy(S.moonDir);
  skyMat.uniforms.uNight.value = S.night;
  skyMat.uniforms.uCloud.value = WEATHER.cur.cloud;
  skyMat.uniforms.uTime.value = time;
  skyDome.position.copy(camera.position);
  skyDome.scale.setScalar(camera.far * 0.95);

  // fog matches the horizon; morning mist and rain thicken it
  WFOG.wfColor.value.copy(S.fog);
  WFOG.wfSunColor.value.copy(S.sun).lerp(S.fog, S.night * 0.8);
  WFOG.wfSunDir.value.copy(S.night > 0.5 ? S.moonDir : S.sunDir);
  const dens = 0.0021 + WEATHER.cur.fog * 0.009 + WEATHER.cur.rain * 0.003 + S.night * 0.0008;
  WFOG.wfParams.value.set(dens, 0.011 - WEATHER.cur.fog * 0.004, 12, 0.85 * (1 - WEATHER.cur.cloud * 0.6));
  WFOG.wfMisc.value.y = time;
  WFOG.wfMisc.value.w = WEATHER.wet;

  // key light: the sun by day, the moon by night, never below the horizon
  const keyDir = S.night > 0.5 ? S.moonDir : S.sunDir;
  const keyUp = Math.max(keyDir.y, 0.08);
  SUN.color.copy(S.sun);
  SUN.intensity = S.sunI * smooth(-0.02, 0.1, keyUp);
  HEMI.color.copy(S.sky);
  HEMI.groundColor.copy(S.gnd);
  HEMI.intensity = S.hemiI;

  // shadow camera follows the focus, snapped to whole texels (no shimmer)
  const q = Q();
  const half = q.shadowDist * 0.5;
  if (SUN.shadow.mapSize.x !== q.shadow) {
    SUN.shadow.mapSize.set(q.shadow, q.shadow);
    if (SUN.shadow.map) { SUN.shadow.map.dispose(); SUN.shadow.map = null; }
  }
  const sc = SUN.shadow.camera;
  sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
  sc.near = 1; sc.far = 600;
  sc.updateProjectionMatrix();
  _lsz.copy(keyDir).normalize();
  _lsx.set(0, 1, 0).cross(_lsz).normalize();
  _lsy.copy(_lsz).cross(_lsx);
  const texel = (half * 2) / q.shadow;
  const fx = Math.round(focus.dot(_lsx) / texel) * texel;
  const fy = Math.round(focus.dot(_lsy) / texel) * texel;
  const fz = focus.dot(_lsz);
  _snap.copy(_lsx).multiplyScalar(fx).addScaledVector(_lsy, fy).addScaledVector(_lsz, fz);
  SUN.target.position.copy(_snap);
  SUN.position.copy(_snap).addScaledVector(_lsz, 300);
  SUN.target.updateMatrixWorld();

  // colour grade follows the sky
  if (gradePass) {
    gradePass.uniforms.uLift.value.copy(S.lift).multiplyScalar(0.6);
    gradePass.uniforms.uGain.value.copy(S.gain);
    gradePass.uniforms.uSat.value = 1.1 - WEATHER.cur.cloud * 0.12 - S.night * 0.25;
    gradePass.uniforms.uTime.value = time % 100;
  }
  renderer.toneMappingExposure = lerp(1.0, 1.35, S.night) * (1 + WEATHER.cur.cloud * 0.1);
}
