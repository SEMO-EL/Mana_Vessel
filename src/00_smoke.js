// Pipeline smoke test — replaced by the real engine once the loader is proven.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

window.__mv = { modules: true };
document.getElementById('bootMsg').textContent = 'MV-MODULES-OK';

const parseGLB = bytes => new Promise((ok, bad) =>
  new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', ok, bad));

const [chars, anims] = await Promise.all([
  parseGLB(MV_ASSET('models/characters.glb')),
  parseGLB(MV_ASSET('models/anims.glb')),
]);
window.__mv.clips = anims.animations.length;
window.__mv.chars = chars.scene.children.map(c => c.name);

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1c2244');
const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
cam.position.set(0, 1.6, 4.5); cam.lookAt(0, 1, 0);
scene.add(new THREE.HemisphereLight('#bcd', '#432', 1.4));
const sun = new THREE.DirectionalLight('#ffe8c0', 2.2); sun.position.set(3, 5, 2); scene.add(sun);

const tex = new THREE.TextureLoader().load(URL.createObjectURL(new Blob([MV_ASSET('textures/mage_texture.png')], { type: 'image/png' })));
tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace;
const mage = SkeletonUtils.clone(chars.scene.getObjectByName('Mage'));
mage.traverse(o => { if (o.isMesh) o.material = new THREE.MeshToonMaterial({ map: tex }); });
scene.add(mage);
const mixer = new THREE.AnimationMixer(mage);
mixer.clipAction(THREE.AnimationClip.findByName(anims.animations, 'Spellcasting')).play();

const box = new THREE.Box3().setFromObject(mage);
window.__mv.mageHeight = +(box.max.y - box.min.y).toFixed(3);
document.getElementById('boot').classList.add('gone');
document.title = 'MV-OK';
window.__mv.ok = true;

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => { mixer.update(clock.getDelta()); renderer.render(scene, cam); });
