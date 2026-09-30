/* ═══════════════════════════════════════════════════════════════════════
   CAMERA — third person, over the shoulder.

   yaw/pitch come straight from input (no smoothing on the look itself —
   smoothing mouse-look feels like steering a boat). The PIVOT follows the
   player with damping, and the arm length is clipped by a raycast so the
   lens never ends up inside a hill or a house.
   ═══════════════════════════════════════════════════════════════════════ */
const CAM = {
  yaw: 0, pitch: -0.18, dist: 4.4, distT: 4.4, minDist: 1.6, maxDist: 7.5,
  pivot: new THREE.Vector3(), arm: 4.4, shoulder: 0.0, shoulderT: 0.0,
  trauma: 0, fovKick: 0, lockTarget: null, aiming: false,
  override: null,           // { pos, look, fov } for dialogue / cutscenes (lerped)
  ovBlend: 0,
};
const _cf = new THREE.Vector3(), _cr = new THREE.Vector3(), _cd = new THREE.Vector3(), _cp = new THREE.Vector3(), _cl = new THREE.Vector3();

function shake(amount) { if (SETTINGS.shake) CAM.trauma = Math.min(1, CAM.trauma + amount); }

function updateCamera(dt, target, opts = {}) {
  const sens = 0.0021 * SETTINGS.sens;
  const lookEnabled = !CAM.override && !opts.noLook;
  if (lookEnabled) {
    CAM.yaw -= IN.lookX * sens;
    CAM.pitch -= IN.lookY * sens * (SETTINGS.invertY ? -1 : 1);
  }
  CAM.pitch = clamp(CAM.pitch, -1.15, 0.72);
  if (IN.wheel && !opts.wheelUsed) CAM.distT = clamp(CAM.distT + IN.wheel * 0.5, CAM.minDist, CAM.maxDist);

  // lock-on: drift yaw/pitch to frame the target over your shoulder
  if (CAM.lockTarget && lookEnabled) {
    const tp = CAM.lockTarget.lockPoint();
    const dx = tp.x - target.x, dz = tp.z - target.z;
    const want = Math.atan2(-dx, -dz);
    CAM.yaw = dampAngle(CAM.yaw, want, 7, dt);
    // floor the distance: aiming at a chest 0.8 m away would pitch straight down
    const flat = Math.max(Math.hypot(dx, dz), 4);
    const wantP = clamp(-Math.atan2(target.y + 1.6 - tp.y, flat) - 0.16, -0.42, 0.1);
    CAM.pitch = damp(CAM.pitch, wantP, 4, dt);
  }

  CAM.shoulderT = CAM.aiming ? 0.62 : (CAM.lockTarget ? 0.35 : 0.0);
  CAM.shoulder = damp(CAM.shoulder, CAM.shoulderT, 8, dt);
  const wantDist = CAM.aiming ? Math.min(CAM.distT, 2.7) : CAM.distT;
  CAM.dist = damp(CAM.dist, wantDist, 6, dt);

  // pivot: chest height, damped a little so steps and landings don't jolt the frame
  _cp.set(target.x, target.y + 1.55, target.z);
  CAM.pivot.x = damp(CAM.pivot.x, _cp.x, 18, dt);
  CAM.pivot.z = damp(CAM.pivot.z, _cp.z, 18, dt);
  CAM.pivot.y = damp(CAM.pivot.y, _cp.y, 10, dt);

  // camera basis
  // forward: yaw 0 looks north (-Z); negative pitch looks down
  _cf.set(-Math.sin(CAM.yaw) * Math.cos(CAM.pitch), Math.sin(CAM.pitch), -Math.cos(CAM.yaw) * Math.cos(CAM.pitch));
  _cr.set(Math.cos(CAM.yaw), 0, -Math.sin(CAM.yaw));
  // where the arm starts: pivot pushed out sideways for the shoulder view
  const start = _cl.copy(CAM.pivot).addScaledVector(_cr, CAM.shoulder);
  _cd.copy(_cf).negate();
  // clip the arm against the world (terrain + buildings), keep a margin
  let arm = CAM.dist;
  const hit = raycastWorld(start, _cd, CAM.dist + 0.4);
  if (hit < arm + 0.4) arm = Math.max(0.5, hit - 0.4);
  CAM.arm = arm < CAM.arm ? arm : damp(CAM.arm, arm, 5, dt);   // snap in, ease out
  camera.position.copy(start).addScaledVector(_cd, CAM.arm);
  // never below the ground under the lens
  const gy = heightAt(camera.position.x, camera.position.z) + 0.35;
  if (camera.position.y < gy) camera.position.y = gy;
  const look = _cp.copy(start).addScaledVector(_cf, 10);
  camera.lookAt(look);

  // override (dialogue framing, cutscenes): blend toward a fixed shot
  if (CAM.override) {
    CAM.ovBlend = Math.min(1, CAM.ovBlend + dt * 2.2);
  } else CAM.ovBlend = Math.max(0, CAM.ovBlend - dt * 3);
  if (CAM.ovBlend > 0 && (CAM.override || CAM._lastOv)) {
    const o = CAM.override || CAM._lastOv;
    CAM._lastOv = o;
    const b = smooth(0, 1, CAM.ovBlend);
    camera.position.lerp(o.pos, b);
    const q0 = camera.quaternion.clone();
    camera.lookAt(o.look);
    camera.quaternion.copy(q0.slerp(camera.quaternion, b));
  }

  // shake: trauma² so small hits whisper and big ones shout
  if (CAM.trauma > 0) {
    const s = CAM.trauma * CAM.trauma, t = GAME.time;
    camera.rotation.x += (Math.sin(t * 43) * 0.5 + Math.sin(t * 71) * 0.5) * 0.035 * s;
    camera.rotation.y += (Math.sin(t * 37 + 2) * 0.5 + Math.sin(t * 59) * 0.5) * 0.035 * s;
    camera.rotation.z += Math.sin(t * 29 + 5) * 0.02 * s;
    CAM.trauma = Math.max(0, CAM.trauma - dt * 1.6);
  }
  CAM.fovKick = damp(CAM.fovKick, opts.fovKick || 0, 5, dt);
  const fov = (CAM.override && CAM.override.fov) ? lerp(SETTINGS.fov, CAM.override.fov, CAM.ovBlend) : SETTINGS.fov + CAM.fovKick;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

// Camera-relative movement basis on the ground plane.
function camForward(out) { return out.set(-Math.sin(CAM.yaw), 0, -Math.cos(CAM.yaw)); }
function camRight(out) { return out.set(Math.cos(CAM.yaw), 0, -Math.sin(CAM.yaw)); }
