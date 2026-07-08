import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5fbff);
scene.fog = new THREE.Fog(0xf5fbff, 13, 42);

const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
camera.position.set(11, 15, 12);

const hemi = new THREE.HemisphereLight(0xfaffff, 0x8ea0a7, 2.3);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff1d6, 3.6);
sun.position.set(-7, 13, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -24;
sun.shadow.camera.right = 24;
sun.shadow.camera.top = 24;
sun.shadow.camera.bottom = -24;
scene.add(sun);

const rim = new THREE.DirectionalLight(0x8ddaff, 0.9);
rim.position.set(6, 7, -8);
scene.add(rim);

const mats = {
  snow: makeMat(0xf3f8fb, 0.72),
  packedSnow: makeMat(0xd1dee5, 0.62),
  groundDark: makeMat(0x3a3c47, 0.86),
  groundTile: makeMat(0x484a56, 0.88),
  dirt: makeMat(0xd4a161, 0.82),
  cliff: makeMat(0xb96943, 0.86),
  cliffDark: makeMat(0x78452f, 0.9),
  wood: makeMat(0xd39a42, 0.86),
  woodDark: makeMat(0x7e4f2d, 0.9),
  coal: makeMat(0x20252c, 0.9),
  flameA: makeMat(0xffd13b, 0.5, 0.02, 0xffa12e, 0.75),
  flameB: makeMat(0xff5b2f, 0.58, 0.02, 0xff4f25, 0.5),
  hero: makeMat(0x24b8db, 0.64),
  redCoat: makeMat(0xc75345, 0.74),
  fur: makeMat(0xffffff, 0.56),
  skin: makeMat(0xf0bf83, 0.62),
  black: makeMat(0x282d35, 0.86),
  monster: makeMat(0x674937, 0.92),
  brute: makeMat(0x855342, 0.92),
  iceFur: makeMat(0xbad8df, 0.54),
  green: makeMat(0x38ed4e, 0.62),
  red: makeMat(0xff5145, 0.62),
  slash: makeMat(0x7beeff, 0.35, 0.02, 0x32dbff, 0.6),
  med: makeMat(0xf7f7f7, 0.54),
  spawnMist: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }),
  dangerMist: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }),
  whiteoutMist: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false }),
  fogCurtain: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }),
};

function makeMat(color, roughness = 0.8, metalness = 0.02, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity, flatShading: true });
}

function mesh(geometry, material, position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function box(size, material, position, rotation, scale) {
  return mesh(new THREE.BoxGeometry(...size), material, position, rotation, scale);
}

function cyl(radiusTop, radiusBottom, height, segments, material, position, rotation = [0, 0, 0]) {
  return mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material, position, rotation);
}

function prepareModel(source, targetSize) {
  const model = source.clone(true);
  const box3 = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box3.getSize(size);
  box3.getCenter(center);
  const scale = targetSize / Math.max(size.x, size.y, size.z, 0.001);
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -box3.min.y * scale, -center.z * scale);
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child.material) {
      child.material = child.material.clone();
      child.material.flatShading = true;
      child.material.roughness = 0.78;
      child.material.needsUpdate = true;
    }
  });
  return model;
}

const SCENERY_SPECS = {
  snowLarge: { file: 'block-snow-large.glb', size: 4.7 },
  snowLargeTall: { file: 'block-snow-large-tall.glb', size: 5.2 },
  snowOverhangLarge: { file: 'block-snow-overhang-large.glb', size: 4.9 },
  snowOverhangLong: { file: 'block-snow-overhang-long.glb', size: 4.7 },
  snowOverhangCorner: { file: 'block-snow-overhang-corner.glb', size: 3.25 },
  snowCorner: { file: 'block-snow-corner.glb', size: 3.2 },
  snowCurve: { file: 'block-snow-curve.glb', size: 3.1 },
  snowSlope: { file: 'block-snow-large-slope.glb', size: 4.7 },
  snow: { file: 'block-snow.glb', size: 2.35 },
  snowLow: { file: 'block-snow-low.glb', size: 2.35 },
  snowLong: { file: 'block-snow-long.glb', size: 4.4 },
  grassLarge: { file: 'block-grass-large.glb', size: 4.7 },
  grass: { file: 'block-grass.glb', size: 2.35 },
  grassLow: { file: 'block-grass-low.glb', size: 2.35 },
  pineSnow: { file: 'tree-pine-snow.glb', size: 1.8 },
  pineSnowSmall: { file: 'tree-pine-snow-small.glb', size: 1.15 },
  tree: { file: 'tree.glb', size: 1.55 },
  treeSnow: { file: 'tree-snow.glb', size: 1.45 },
  rocks: { file: 'rocks.glb', size: 1.05 },
  stones: { file: 'stones.glb', size: 0.78 },
  crate: { file: 'crate.glb', size: 0.74 },
  barrel: { file: 'barrel.glb', size: 0.78 },
  fence: { file: 'fence-low-straight.glb', size: 1.35 },
  fenceCorner: { file: 'fence-low-corner.glb', size: 1.35 },
  ladder: { file: 'ladder.glb', size: 1.2 },
  flowers: { file: 'flowers.glb', size: 0.78 },
  mushrooms: { file: 'mushrooms.glb', size: 0.7 },
  sign: { file: 'sign.glb', size: 0.92 },
};

const SCENERY_PLACEMENTS = [
  { key: 'snowLarge', pos: [-10.2, -1.66, -6.8], rot: 0.15, scale: 0.62, collider: 1.75 },
  { key: 'snowLarge', pos: [9.4, -1.7, 6.9], rot: 0.15, scale: 0.62, collider: 1.75 },
  { key: 'snowLarge', pos: [9.5, -1.7, -7.0], rot: 0.15, scale: 0.58, collider: 1.6 },
  { key: 'snowLong', pos: [-10.1, -1.64, 6.7], rot: 0.15, scale: 0.62, collider: 1.5 },
  { key: 'snow', pos: [9.1, -1.72, -4.6], rot: 0.15, scale: 0.62, collider: 1.2 },
  { key: 'snowLow', pos: [-6.2, -1.7, 7.3], rot: 0.15, scale: 0.7, collider: 1.25 },
  { key: 'grassLarge', pos: [-10.8, -1.8, 0.6], rot: 0.15, scale: 0.68, collider: 1.75 },
  { key: 'grassLarge', pos: [10.9, -1.82, -0.8], rot: 0.15, scale: 0.68, collider: 1.75 },
  { key: 'grass', pos: [-11.3, -1.78, 6.1], rot: 0.15, scale: 0.68, collider: 1.15 },
  { key: 'grassLow', pos: [11.4, -1.76, -6.0], rot: 0.15, scale: 0.66, collider: 1.1 },

  { key: 'pineSnow', pos: [-5.8, 0.02, -5.9], rot: -0.45, scale: 1, collider: 0.55 },
  { key: 'pineSnow', pos: [5.7, 0.02, 5.9], rot: 0.25, scale: 0.96, collider: 0.55 },
  { key: 'pineSnowSmall', pos: [6.7, 0.02, 2.7], rot: 0.9, scale: 1, collider: 0.42 },
  { key: 'pineSnowSmall', pos: [-6.5, 0.02, -2.8], rot: -0.2, scale: 1, collider: 0.42 },
  { key: 'treeSnow', pos: [-7.6, 0.02, 1.6], rot: 0.2, scale: 1.1, collider: 0.55 },
  { key: 'treeSnow', pos: [7.8, 0.02, -2.2], rot: 0.2, scale: 1.05, collider: 0.55 },
  { key: 'tree', pos: [-10.5, 0.02, 5.25], rot: 0.6, scale: 1, collider: 0.55 },
  { key: 'tree', pos: [10.25, 0.02, -5.7], rot: -0.4, scale: 1.05, collider: 0.55 },

  { key: 'rocks', pos: [-4.8, 0.02, -4.65], rot: 0.6, scale: 1.15, collider: 0.7 },
  { key: 'rocks', pos: [4.9, 0.02, 4.2], rot: -0.1, scale: 1, collider: 0.65 },
  { key: 'stones', pos: [-6.9, 0.02, 5.25], rot: 0.3, scale: 1, collider: 0.46 },
  { key: 'stones', pos: [6.8, 0.02, -5.2], rot: 0.3, scale: 1, collider: 0.46 },
  { key: 'crate', pos: [4.4, 0.02, -5.4], rot: 0.45, scale: 1, collider: 0.52 },
  { key: 'crate', pos: [5.05, 0.02, -5.95], rot: -0.18, scale: 0.82, collider: 0.45 },
  { key: 'barrel', pos: [-5.6, 0.02, 5.6], rot: 0.2, scale: 1, collider: 0.46 },
  { key: 'sign', pos: [-2.4, 0.02, 6.4], rot: -0.7, scale: 1, collider: 0.34 },
  { key: 'ladder', pos: [6.3, 0.02, -5.05], rot: -0.95, scale: 1 },
  { key: 'fence', pos: [-3.1, 0.02, -6.45], rot: 0.18, scale: 1, collider: 0.58 },
  { key: 'fence', pos: [-1.75, 0.02, -6.2], rot: 0.18, scale: 1, collider: 0.58 },
  { key: 'fenceCorner', pos: [4.95, 0.02, 5.7], rot: -0.15, scale: 1, collider: 0.58 },
  { key: 'flowers', pos: [-6.45, 0.02, 5.95], rot: 0.1, scale: 1 },
  { key: 'flowers', pos: [7.1, 0.02, -4.85], rot: 0.7, scale: 1 },
  { key: 'mushrooms', pos: [-5.3, 0.02, -1.95], rot: -0.2, scale: 1 },
];

function loadKenneyScenery() {
  for (const [key, spec] of Object.entries(SCENERY_SPECS)) {
    gltfLoader.load(`${KENNEY_BASE}${spec.file}`, (gltf) => {
      artAssets.scenery[key] = prepareModel(gltf.scene, spec.size);
      instantiateScenery(key);
    });
  }
}

function instantiateScenery(key) {
  const source = artAssets.scenery[key];
  if (!source) return;
  for (const placement of SCENERY_PLACEMENTS) {
    if (placement.key !== key) continue;
    placeSceneryInstance(placement);
  }
}

function placeSceneryInstance(placement) {
  const source = artAssets.scenery[placement.key];
  if (!source) return;
  const instance = source.clone(true);
  instance.position.set(...placement.pos);
  instance.rotation.y = placement.rot ?? 0;
  instance.scale.multiplyScalar(placement.scale ?? 1);
  world.add(instance);
  if (placement.collider) {
    terrainColliders.push({
      position: new THREE.Vector3(placement.pos[0], 0, placement.pos[2]),
      radius: placement.collider * (placement.scale ?? 1),
    });
  }
}

const world = new THREE.Group();
scene.add(world);

const artAssets = {
  scenery: {},
};
const terrainColliders = [];
let initialWaveStarted = false;
const gltfLoader = new GLTFLoader();
const PUBLIC_BASE = import.meta.env.BASE_URL;
const KENNEY_BASE = `${PUBLIC_BASE}assets/vendor/kenney-platformer-kit/Models/GLB%20format/`;
const QUATERNIUS_CHARACTER_BASE = `${PUBLIC_BASE}assets/vendor/quaternius-zombie-apocalypse-kit/Characters/glTF/`;
const ANIMATED_HERO_MODEL = `${QUATERNIUS_CHARACTER_BASE}Characters_Lis.gltf`;
const MONSTER_MODELS = {
  1: `${QUATERNIUS_CHARACTER_BASE}Zombie_Basic.gltf`,
  2: `${QUATERNIUS_CHARACTER_BASE}Zombie_Chubby.gltf`,
  3: `${QUATERNIUS_CHARACTER_BASE}Zombie_Arm.gltf`,
};
const HERO_VISIBLE_WEAPON = 'Pistol';
const HERO_WEAPON_NODES = new Set(['Axe', 'Guitar', 'Knife', 'Pistol', 'Rifle', 'Shotgun', 'SMG', 'Spear', 'WoodenBat_Barbed', 'WoodenBat_Saw']);
const monsterModelCache = new Map();
setTimeout(() => startInitialWave(), 250);
loadKenneyScenery();

buildTerrain();
const campfire = buildCampfire();
campfire.root.position.set(0, 0, 0);
world.add(campfire.root);

const player = buildHumanoid({ color: mats.hero });
player.root.position.set(0, 0, 3.2);
world.add(player.root);
loadHeroModel(ANIMATED_HERO_MODEL);

const monsters = [];
const medpacks = [];
const slashes = [];
const snow = buildSnow();
scene.add(snow.group);

const COLLISION = {
  player: 0.52,
  camp: 1.42,
  monster: 0.78,
};

const state = {
  clock: new THREE.Clock(),
  velocity: new THREE.Vector3(),
  targetYaw: Math.PI,
  keys: new Set(),
  elapsed: 0,
  campHp: 50,
  playerHp: 100,
  kills: 0,
  attackCd: 0,
  attackTimer: 0,
  attackDuration: 0.26,
  nextSpawn: 0,
  nextMed: 7,
  gameOver: false,
  lastBossWarningAt: -99,
  bossWarningShown: false,
  warningPaused: false,
};

const ui = {
  timer: document.querySelector('#timer'),
  kills: document.querySelector('#kills'),
  campHp: document.querySelector('#camp-hp'),
  heroHp: document.querySelector('#hero-hp'),
  hint: document.querySelector('#hint'),
  message: document.querySelector('#message'),
  bossWarning: document.querySelector('#boss-warning'),
  stick: document.querySelector('#stick'),
  knob: document.querySelector('#stick span'),
};

const pointer = { active: false, id: null, x: 0, y: 0, vec: new THREE.Vector2() };

window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => state.keys.add(event.code));
window.addEventListener('keyup', (event) => state.keys.delete(event.code));
canvas.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
document.querySelector('#play-button').addEventListener('click', () => window.location.reload());

resize();
animate();
if (new URLSearchParams(window.location.search).has('showWarning')) {
  window.setTimeout(() => ui.bossWarning?.classList.add('preview'), 300);
}

function buildTerrain() {
  const ground = box([42, 0.12, 52], mats.groundDark, [0, -0.13, 0]);
  ground.castShadow = false;
  world.add(ground);

  const grid = new THREE.Group();
  grid.position.y = -0.08;
  for (let x = -18; x <= 18; x += 4) {
    for (let z = -22; z <= 22; z += 4) {
      const tile = box([3.55, 0.025, 3.55], mats.groundTile, [x, 0, z]);
      tile.castShadow = false;
      tile.receiveShadow = true;
      tile.material = mats.groundTile;
      grid.add(tile);
    }
  }
  grid.rotation.y = 0.15;
  world.add(grid);

  const snowField = box([62, 0.08, 68], mats.snow, [0, -0.035, 0], [0, 0.15, 0]);
  snowField.castShadow = false;
  snowField.receiveShadow = true;
  world.add(snowField);

  const snowInset = box([54, 0.018, 60], mats.packedSnow, [0, 0.012, 0], [0, 0.15, 0]);
  snowInset.castShadow = false;
  snowInset.receiveShadow = true;
  world.add(snowInset);

  buildMountainRing();
}

function buildMountainRing() {
  const ring = new THREE.Group();
  const boundaryScale = 1.12;
  const chunks = [
    ['snowOverhangLarge', -16.8, -13.4, 4.8, 3.7, 0.42, 1.28],
    ['snowLargeTall', -11.4, -16.2, 5.7, 4.3, 0.05, 1.16],
    ['snowSlope', -4.8, -17.4, 5.2, 4.9, -0.22, 1.2],
    ['snowOverhangLong', 2.2, -17.8, 6.6, 4.0, 0.18, 1.26],
    ['snowCorner', 8.8, -16.3, 5.1, 4.6, -0.12, 1.3],
    ['snowOverhangCorner', 15.2, -13.6, 5.9, 3.9, -0.36, 1.34],
    ['snowLargeTall', 18.5, -7.2, 4.4, 5.0, 0.2, 1.12],
    ['snowOverhangLarge', 19.4, -0.9, 5.3, 4.3, -0.08, 1.22],
    ['snowCurve', 17.9, 5.8, 4.8, 4.8, 0.28, 1.36],
    ['snowOverhangLong', 14.7, 12.0, 6.1, 4.1, -0.2, 1.3],
    ['snowLargeTall', 8.5, 15.5, 5.4, 4.7, 0.1, 1.22],
    ['snowOverhangLarge', 1.5, 17.3, 6.5, 4.0, -0.18, 1.34],
    ['snowSlope', -5.9, 16.8, 5.2, 4.5, 0.22, 1.24],
    ['snowCorner', -12.8, 14.5, 6.0, 4.2, -0.05, 1.36],
    ['snowOverhangCorner', -17.5, 9.0, 4.9, 4.8, 0.32, 1.34],
    ['snowLargeTall', -19.4, 2.1, 5.8, 4.0, -0.16, 1.12],
    ['snowOverhangLong', -18.8, -5.7, 5.1, 4.6, 0.12, 1.24],
  ];

  for (let i = 0; i < chunks.length; i++) {
    const [key, x, z, width, depth, rot, scale] = chunks[i];
    const sx = x * boundaryScale;
    const sz = z * boundaryScale;
    const y = key === 'snowLargeTall' ? -2.05 : -1.66;
    const placement = { key, pos: [sx, y, sz], rot, scale, collider: Math.max(width, depth) * 0.5 };
    SCENERY_PLACEMENTS.push(placement);
    placeSceneryInstance(placement);
    addMountainForestPlacements(sx, sz, width, depth, rot, i);
  }

  addMistRing(ring, 9.8, 18.5, mats.spawnMist, 0.05);
  addMistRing(ring, 15.2, 26.5, mats.dangerMist, 0.06);
  addMistRing(ring, 22.0, 42.0, mats.whiteoutMist, 0.07);
  addFogCurtain(ring, 19.5, 6.5, 0.25);
  addFogCurtain(ring, 27.0, 9.5, 0.52);

  world.add(ring);
}

function addMistRing(parent, innerRadius, outerRadius, material, y) {
  const mist = mesh(
    new THREE.RingGeometry(innerRadius, outerRadius, 128, 1),
    material,
    [0, y, 0],
    [-Math.PI / 2, 0, 0],
  );
  mist.castShadow = false;
  mist.receiveShadow = false;
  parent.add(mist);
}

function addFogCurtain(parent, radius, height, opacity) {
  const material = mats.fogCurtain.clone();
  material.opacity = opacity;
  const curtain = mesh(
    new THREE.CylinderGeometry(radius, radius, height, 96, 1, true),
    material,
    [0, height * 0.5, 0],
  );
  curtain.castShadow = false;
  curtain.receiveShadow = false;
  parent.add(curtain);
}

function addMountainForestPlacements(centerX, centerZ, width, depth, rotation, index) {
  const treeCount = 8 + (index % 5);
  for (let i = 0; i < treeCount; i++) {
    const seed = index * 17 + i * 7;
    const localX = ((seed * 37) % 100 / 100 - 0.5) * width * 0.7;
    const localZ = ((seed * 53 + 19) % 100 / 100 - 0.5) * depth * 0.66;
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    const placement = {
      key: i % 3 === 0 ? 'pineSnowSmall' : 'pineSnow',
      pos: [centerX + localX * c - localZ * s, 0.04, centerZ + localX * s + localZ * c],
      rot: rotation + ((seed * 11) % 100 / 100 - 0.5) * 1.4,
      scale: 0.72 + ((seed * 29) % 100 / 100) * 0.34,
    };
    SCENERY_PLACEMENTS.push(placement);
    placeSceneryInstance(placement);
  }
}

function buildCampfire() {
  const root = new THREE.Group();
  root.add(cyl(1.25, 1.25, 0.08, 18, mats.coal, [0, 0.06, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 5; i++) {
    const log = box([1.65, 0.22, 0.26], mats.wood, [0, 0.18, 0], [0.08, (Math.PI * 2 * i) / 5, 0.1]);
    root.add(log);
  }
  const flame = new THREE.Group();
  flame.add(cyl(0, 0.5, 1.35, 7, mats.flameB, [0, 0.86, 0]));
  flame.add(cyl(0, 0.34, 1.05, 7, mats.flameA, [0, 0.95, 0.05]));
  root.add(flame);
  const light = new THREE.PointLight(0xff9138, 5.2, 9, 1.7);
  light.position.set(0, 1.45, 0);
  root.add(light);
  return { root, flame, light };
}

function buildHumanoid({ color }) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  addShadow(root, 0.78, 0.52);

  body.add(cyl(0.34, 0.45, 0.78, 7, color, [0, 0.82, 0]));
  body.add(cyl(0.38, 0.47, 0.18, 7, mats.fur, [0, 1.23, 0]));
  body.add(mesh(new THREE.DodecahedronGeometry(0.34, 0), mats.skin, [0, 1.6, 0.04], [0, 0, 0], [0.95, 1.05, 0.86]));
  body.add(cyl(0.4, 0.5, 0.46, 7, mats.fur, [0, 1.58, -0.03], [Math.PI / 2, 0, 0]));
  body.add(box([0.08, 0.06, 0.12], mats.black, [0, 1.58, 0.32]));

  const leftArm = box([0.16, 0.52, 0.16], color, [-0.45, 0.9, 0.03], [0, 0, -0.22]);
  const rightArm = box([0.16, 0.52, 0.16], color, [0.45, 0.9, 0.03], [0, 0, 0.22]);
  const leftLeg = box([0.18, 0.42, 0.2], mats.black, [-0.19, 0.3, 0.04], [0, 0, 0.06]);
  const rightLeg = box([0.18, 0.42, 0.2], mats.black, [0.19, 0.3, 0.04], [0, 0, -0.06]);
  body.add(leftArm, rightArm, leftLeg, rightLeg);

  const weapon = new THREE.Group();
  weapon.visible = false;
  weapon.position.set(0.43, 1.02, 0.26);
  weapon.rotation.set(0.25, 0, -0.9);
  weapon.add(box([0.11, 0.11, 1.05], mats.woodDark, [0, 0, 0.3], [Math.PI / 2, 0, 0]));
  weapon.add(cyl(0, 0.2, 0.42, 4, mats.slash, [0, 0, 0.95], [Math.PI / 2, 0, 0]));
  body.add(weapon);

  const modelSlot = new THREE.Group();
  body.add(modelSlot);

  return {
    root,
    body,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weapon,
    modelSlot,
    mixer: null,
    actions: {},
    activeAction: null,
    attackAction: null,
    fallbackActionName: null,
    heroModel: null,
    heroModelBase: null,
    gunNode: null,
    gunBaseRotation: null,
    gunBasePosition: null,
    walkPhase: 0,
  };
}

function loadHeroModel(url) {
  gltfLoader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      const useStaticPose = url.includes('lacrimosa');
      fitModelToHeight(model, 1.85);
      player.gunNode = null;
      player.gunBaseRotation = null;
      player.gunBasePosition = null;
      model.traverse((child) => {
        if (HERO_WEAPON_NODES.has(child.name)) {
          child.visible = child.name === HERO_VISIBLE_WEAPON;
        }
        if (child.name === HERO_VISIBLE_WEAPON) {
          player.gunNode = child;
        }
        if (!child.isMesh && !child.isSkinnedMesh) return;
        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.roughness = 0.78;
          child.material.needsUpdate = true;
        }
      });
      player.body.children.forEach((child) => {
        if (child !== player.modelSlot) child.visible = false;
      });
      player.modelSlot.clear();
      player.modelSlot.add(model);
      if (player.gunNode) {
        player.gunBaseRotation = player.gunNode.rotation.clone();
        player.gunBasePosition = player.gunNode.position.clone();
      }
      player.heroModel = model;
      player.heroModelBase = {
        position: model.position.clone(),
        rotation: model.rotation.clone(),
        scale: model.scale.clone(),
      };
      if (useStaticPose) {
        player.mixer = null;
        player.actions = {};
        player.activeAction = null;
        player.attackAction = null;
        player.fallbackActionName = null;
        return;
      }
      player.mixer = new THREE.AnimationMixer(model);
      player.actions = {};
      for (const clip of gltf.animations) {
        const action = player.mixer.clipAction(clip);
        action.enabled = true;
        player.actions[clip.name] = action;
        player.fallbackActionName ??= clip.name;
      }
      playHeroAction(findHeroAction('Idle_Gun', 'idle', 'Idle') ?? player.fallbackActionName, 0);
    },
    undefined,
    (error) => console.warn('Hero model could not be loaded', error),
  );
}

function playHeroAction(name, fade = 0.12, once = false) {
  const action = player.actions?.[name];
  if (!action || player.activeAction === action) return;
  action.reset();
  action.setEffectiveWeight(1);
  action.setEffectiveTimeScale(1);
  if (once) {
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;
  } else {
    action.loop = THREE.LoopRepeat;
    action.clampWhenFinished = false;
  }
  if (player.activeAction) player.activeAction.fadeOut(fade);
  action.fadeIn(fade).play();
  player.activeAction = action;
}

function findHeroAction(...names) {
  for (const name of names) {
    if (player.actions?.[name]) return name;
  }
  const lowerNames = names.map((name) => name.toLowerCase());
  return Object.keys(player.actions ?? {}).find((name) => lowerNames.includes(name.toLowerCase()));
}

function updateHeroAnimation(dt, moving, attacking) {
  if (!player.mixer) {
    animateHumanoid(player, dt, moving, Math.min(1.25, state.velocity.length() / 4.8), state.attackTimer / state.attackDuration);
    return;
  }

  player.mixer.update(dt);
  keepHeroModelAnchored();
  const attackProgress = THREE.MathUtils.clamp(1 - state.attackTimer / state.attackDuration, 0, 1);
  const attackSwing = attacking ? Math.sin(attackProgress * Math.PI) : 0;
  const recoil = attacking ? Math.pow(1 - attackProgress, 2.8) * 1.25 : 0;
  player.modelSlot.rotation.x = THREE.MathUtils.lerp(player.modelSlot.rotation.x, -recoil * 0.34, 1 - Math.pow(0.0008, dt));
  player.modelSlot.rotation.z = THREE.MathUtils.lerp(player.modelSlot.rotation.z, -recoil * 0.18, 1 - Math.pow(0.0008, dt));
  player.modelSlot.position.z = THREE.MathUtils.lerp(player.modelSlot.position.z, attackSwing * 0.08, 1 - Math.pow(0.0008, dt));
  if (player.gunNode && player.gunBaseRotation && player.gunBasePosition) {
    player.gunNode.rotation.copy(player.gunBaseRotation);
    player.gunNode.position.copy(player.gunBasePosition);
    player.gunNode.rotation.x += recoil * 0.72;
    player.gunNode.position.y += recoil * 0.035;
  }

  if (attacking) {
    if (!player.attackAction || !player.attackAction.isRunning()) {
      const attackName = findHeroAction('Idle_Gun', 'Punch', 'Slash', 'Stab', 'attack-melee-right', 'attack-kick-right') ?? player.fallbackActionName;
      playHeroAction(attackName, 0.04, true);
      player.attackAction = player.activeAction;
    }
    return;
  }
  player.attackAction = null;
  const locomotionName = moving
    ? findHeroAction('Run_Gun', 'Walk_Gun', 'Run', 'Walk', 'walk') ?? player.fallbackActionName
    : findHeroAction('Idle_Gun', 'Idle', 'idle') ?? player.fallbackActionName;
  playHeroAction(locomotionName, 0.12);
}

function keepHeroModelAnchored() {
  if (!player.heroModel || !player.heroModelBase) return;
  player.heroModel.position.copy(player.heroModelBase.position);
  player.heroModel.rotation.copy(player.heroModelBase.rotation);
  player.heroModel.scale.copy(player.heroModelBase.scale);
}

function fitModelToHeight(model, targetHeight) {
  model.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box3.getSize(size);
  box3.getCenter(center);
  const scale = targetHeight / Math.max(size.y, 0.001);
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  const fitted = new THREE.Box3().setFromObject(model);
  fitted.getCenter(center);
  model.position.x -= center.x;
  model.position.y -= fitted.min.y;
  model.position.z -= center.z;
}

function buildMonster(power = 1) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  addShadow(root, 0.95, 1.28);
  const material = power >= 3 ? mats.brute : mats.monster;
  const legs = [];

  body.add(mesh(new THREE.DodecahedronGeometry(0.66, 0), material, [0, 0.78, 0], [0, 0, 0], [1.08, 0.74, 1.38]));
  body.add(mesh(new THREE.DodecahedronGeometry(0.42, 0), material, [0, 1.25, 0.66], [0, 0, 0], [0.9, 0.84, 0.9]));
  body.add(cyl(0.15, 0.15, 0.32, 7, mats.iceFur, [-0.24, 1.52, 0.56], [Math.PI / 2, 0, 0]));
  body.add(cyl(0.15, 0.15, 0.32, 7, mats.iceFur, [0.24, 1.52, 0.56], [Math.PI / 2, 0, 0]));
  for (const x of [-0.37, 0.37]) {
    for (const z of [-0.42, 0.42]) {
      const leg = box([0.24, 0.42, 0.28], material, [x, 0.28, z]);
      body.add(leg);
      legs.push(leg);
    }
  }
  const monster = {
    root,
    body,
    legs,
    mixer: null,
    actions: {},
    activeAction: null,
    visualModel: null,
    modelReady: false,
    hp: 55 + power * 22,
    maxHp: 55 + power * 22,
    power,
    target: 'camp',
    attackCd: 0,
    hitFlash: 0,
    phase: Math.random() * 10,
    avoidSide: Math.random() < 0.5 ? -1 : 1,
    avoidHold: 0,
    stuckTime: 0,
    lastPosition: new THREE.Vector3(),
  };
  loadMonsterModel(monster, MONSTER_MODELS[Math.min(power, 3)], power >= 3 ? 2.45 : power >= 2 ? 1.85 : 1.55);
  return monster;
}

function loadMonsterModel(monster, url, targetHeight) {
  const cached = monsterModelCache.get(url);
  if (cached) {
    applyMonsterModel(monster, cached, targetHeight);
    return;
  }
  gltfLoader.load(
    url,
    (gltf) => {
      const asset = { scene: gltf.scene, animations: gltf.animations };
      monsterModelCache.set(url, asset);
      applyMonsterModel(monster, asset, targetHeight);
    },
    undefined,
    (error) => console.warn('Monster model could not be loaded', url, error),
  );
}

function applyMonsterModel(monster, asset, targetHeight) {
  const model = SkeletonUtils.clone(asset.scene);
  fitModelToHeight(model, targetHeight);
  model.traverse((child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;
    child.frustumCulled = false;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child.material) {
      child.material = child.material.clone();
      child.material.roughness = 0.82;
      child.material.needsUpdate = true;
    }
  });
  monster.body.clear();
  monster.body.add(model);
  monster.legs.length = 0;
  monster.visualModel = model;
  monster.modelReady = true;
  monster.mixer = new THREE.AnimationMixer(model);
  monster.actions = {};
  monster.activeAction = null;
  for (const clip of asset.animations) {
    const action = monster.mixer.clipAction(clip);
    action.enabled = true;
    monster.actions[clip.name] = action;
  }
  playMonsterAction(monster, 'Idle', 0);
}

function findMonsterAction(monster, ...names) {
  for (const name of names) {
    if (monster.actions?.[name]) return name;
  }
  const lowerNames = names.map((name) => name.toLowerCase());
  return Object.keys(monster.actions ?? {}).find((name) => lowerNames.includes(name.toLowerCase()));
}

function playMonsterAction(monster, name, fade = 0.12) {
  const action = monster.actions?.[name];
  if (!action || monster.activeAction === action) return;
  action.reset();
  action.setEffectiveWeight(1);
  action.setEffectiveTimeScale(1);
  action.loop = THREE.LoopRepeat;
  action.clampWhenFinished = false;
  if (monster.activeAction) monster.activeAction.fadeOut(fade);
  action.fadeIn(fade).play();
  monster.activeAction = action;
}

function addShadow(parent, sx, sz) {
  const shadow = mesh(
    new THREE.CircleGeometry(0.7, 18),
    new THREE.MeshBasicMaterial({ color: 0x29313a, transparent: true, opacity: 0.22 }),
    [0, 0.018, 0],
    [-Math.PI / 2, 0, 0],
    [sx, 1, sz],
  );
  shadow.castShadow = false;
  shadow.receiveShadow = false;
  parent.add(shadow);
}

function spawnMonster(delay = 0, close = false) {
  setTimeout(() => {
    if (state.gameOver) return;
    const power = state.elapsed > 40 ? 3 : state.elapsed > 20 ? 2 : 1;
    const monster = buildMonster(power);
    const angle = Math.random() * Math.PI * 2;
    const radius = close ? 6 + Math.random() * 1.8 : 10 + Math.random() * 4;
    monster.root.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    monster.root.scale.setScalar(power >= 3 ? 1.18 : power >= 2 ? 1.08 : 1);
    for (let i = 0; i < 5; i++) resolveMonsterCollisions(monster);
    monster.lastPosition.copy(monster.root.position);
    monsters.push(monster);
    world.add(monster.root);
    if (power >= 3) triggerBossWarning();
  }, delay * 1000);
}

function triggerBossWarning(force = false) {
  if (!ui.bossWarning || (!force && state.bossWarningShown)) return;
  if (!force) {
    state.bossWarningShown = true;
    state.warningPaused = true;
  }
  state.lastBossWarningAt = state.elapsed;
  ui.bossWarning.classList.remove('active');
  void ui.bossWarning.offsetWidth;
  ui.bossWarning.classList.add('active');
  window.setTimeout(() => {
    ui.bossWarning?.classList.remove('active');
    if (!force) state.warningPaused = false;
  }, 2400);
}

function startInitialWave() {
  if (initialWaveStarted) return;
  initialWaveStarted = true;
  spawnMonster(0, true);
  spawnMonster(0.8, true);
}

function spawnMedpack() {
  const pack = new THREE.Group();
  pack.position.set(-5 + Math.random() * 10, 0.12, -4 + Math.random() * 10);
  pack.add(box([0.58, 0.18, 0.48], mats.med, [0, 0.12, 0]));
  pack.add(box([0.14, 0.2, 0.52], mats.red, [0, 0.24, 0]));
  pack.add(box([0.62, 0.2, 0.13], mats.red, [0, 0.25, 0]));
  medpacks.push(pack);
  world.add(pack);
}

function buildSnow() {
  const count = 280;
  const positions = new Float32Array(count * 3);
  const speeds = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = -18 + Math.random() * 36;
    positions[i * 3 + 1] = 2 + Math.random() * 14;
    positions[i * 3 + 2] = -22 + Math.random() * 44;
    speeds.push(0.75 + Math.random() * 1.35);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, opacity: 0.86, depthWrite: false });
  return { group: new THREE.Points(geometry, material), positions, speeds };
}

function onPointerDown(event) {
  pointer.active = true;
  pointer.id = event.pointerId;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  updatePointerVector();
  canvas.setPointerCapture(event.pointerId);
  ui.stick.classList.add('active');
  ui.hint.classList.add('hidden');
}

function onPointerMove(event) {
  if (!pointer.active || event.pointerId !== pointer.id) return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  updatePointerVector();
}

function updatePointerVector() {
  const anchor = getScreenPosition(player.root.position);
  ui.stick.style.left = `${anchor.x}px`;
  ui.stick.style.top = `${anchor.y}px`;
  const dx = pointer.x - anchor.x;
  const dy = pointer.y - anchor.y;
  const length = Math.hypot(dx, dy);
  const max = 96;
  const clamped = Math.min(length, max);
  const nx = length > 0 ? dx / length : 0;
  const ny = length > 0 ? dy / length : 0;
  const power = length < 18 ? 0 : Math.min(length / max, 1);
  pointer.vec.set(nx * power, ny * power);
  ui.knob.style.transform = `translate3d(${nx * clamped}px, ${ny * clamped}px, 0)`;
}

function onPointerUp(event) {
  if (!pointer.active || event.pointerId !== pointer.id) return;
  pointer.active = false;
  pointer.id = null;
  pointer.vec.set(0, 0);
  ui.stick.classList.remove('active');
  ui.knob.style.transform = 'translate3d(0, 0, 0)';
}

function getInputVector() {
  if (pointer.active) updatePointerVector();
  const v = new THREE.Vector2(pointer.vec.x, pointer.vec.y);
  if (state.keys.has('KeyA') || state.keys.has('ArrowLeft')) v.x -= 1;
  if (state.keys.has('KeyD') || state.keys.has('ArrowRight')) v.x += 1;
  if (state.keys.has('KeyW') || state.keys.has('ArrowUp')) v.y -= 1;
  if (state.keys.has('KeyS') || state.keys.has('ArrowDown')) v.y += 1;
  if (v.lengthSq() > 1) v.normalize();
  if (v.length() < 0.12) v.set(0, 0);
  return v;
}

function update(dt, elapsed) {
  if (state.warningPaused) {
    updateUI();
    return;
  }

  if (!state.gameOver) {
    state.elapsed += dt;
    handlePlayer(dt);
    handlePlayerAttack(dt);
    handleMonsters(dt, elapsed);
    handleMedpacks(dt, elapsed);
    handleSpawns();
    checkEndState();
  }

  animateCampfire(elapsed);
  updateSnow(dt, elapsed);
  updateCamera(dt);
  updateUI();
}

function handlePlayer(dt) {
  state.attackTimer = Math.max(0, state.attackTimer - dt);
  const input = getInputVector();
  const desired = screenVectorToWorld(input);
  const moving = desired.lengthSq() > 0.001;
  if (moving) {
    desired.normalize().multiplyScalar(4.8);
    state.targetYaw = Math.atan2(desired.x, desired.z);
  }
  state.velocity.lerp(desired, 1 - Math.pow(0.0007, dt));
  if (!moving) state.velocity.multiplyScalar(Math.pow(0.018, dt));
  player.root.position.addScaledVector(state.velocity, dt);
  player.root.position.x = THREE.MathUtils.clamp(player.root.position.x, -8.2, 8.2);
  player.root.position.z = THREE.MathUtils.clamp(player.root.position.z, -8.2, 8.2);
  resolvePlayerCollisions();
  player.root.rotation.y = dampAngle(player.root.rotation.y, state.targetYaw, 28, dt);
  updateHeroAnimation(dt, state.velocity.length() > 0.2, state.attackTimer > 0);
}

function handlePlayerAttack(dt) {
  state.attackCd -= dt;
  if (state.attackCd > 0) return;
  let target = null;
  let best = 2.05;
  for (const monster of monsters) {
    const distance = flatDistance(player.root.position, monster.root.position) - monsterRadius(monster);
    if (distance < best) {
      best = distance;
      target = monster;
    }
  }
  if (!target) return;
  state.attackCd = 0.42;
  state.attackTimer = state.attackDuration;
  target.hp -= 28;
  target.target = 'player';
  target.hitFlash = 0.12;
  state.targetYaw = Math.atan2(target.root.position.x - player.root.position.x, target.root.position.z - player.root.position.z);
  spawnSlash(target.root.position);
  if (target.hp <= 0) killMonster(target);
}

function handleMonsters(dt, elapsed) {
  for (const monster of monsters) {
    const targetPosition = monster.target === 'player' ? player.root.position : campfire.root.position;
    const targetRadius = monster.target === 'player' ? COLLISION.player : COLLISION.camp;
    const stopDistance = monsterRadius(monster) + targetRadius + 0.12;
    const toTarget = targetPosition.clone().sub(monster.root.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    const beforeMove = monster.root.position.clone();
    let moving = false;
    let attacking = false;
    if (distance > stopDistance) {
      toTarget.normalize();
      monster.avoidHold = Math.max(0, monster.avoidHold - dt);
      const moveDirection = steerAroundTerrain(monster, toTarget, targetPosition);
      const speed = 1.25 + monster.power * 0.22;
      monster.root.position.addScaledVector(moveDirection, Math.min(dt * speed, distance - stopDistance));
      monster.root.rotation.y = dampAngle(monster.root.rotation.y, Math.atan2(moveDirection.x, moveDirection.z), 7, dt);
      moving = true;
    } else {
      monster.attackCd -= dt;
      attacking = true;
      if (monster.attackCd <= 0) {
        monster.attackCd = 1.05;
        monster.body.position.z = 0.16;
        if (monster.target === 'player') state.playerHp -= 4 + monster.power * 2;
        else state.campHp -= monster.power;
      }
    }
    monster.phase += dt;
    monster.body.position.y = monster.modelReady ? 0 : Math.sin(elapsed * 8 + monster.phase) * 0.035;
    monster.body.position.z *= Math.pow(0.001, dt);
    if (monster.mixer) {
      monster.mixer.update(dt);
      const actionName = attacking
        ? findMonsterAction(monster, 'Idle_Attack', 'Run_Attack', 'HitReact', 'Idle')
        : moving
          ? findMonsterAction(monster, 'Run_Arms', 'Run', 'Walk')
          : findMonsterAction(monster, 'Idle');
      playMonsterAction(monster, actionName);
    } else {
      monster.legs.forEach((leg, i) => {
        leg.rotation.x = Math.sin(elapsed * 8 + i * Math.PI + monster.phase) * 0.42;
      });
    }
    if (monster.hitFlash > 0) {
      monster.hitFlash -= dt;
      monster.body.scale.setScalar(1.08);
    } else {
      monster.body.scale.setScalar(1);
    }
    resolveMonsterCollisions(monster);
    const moved = flatDistance(monster.root.position, beforeMove);
    if (distance > stopDistance && moved < 0.018) {
      monster.stuckTime += dt;
      if (monster.stuckTime > 0.18) {
        monster.avoidSide *= -1;
        monster.avoidHold = 0.75;
        const rescueDirection = rotateFlatDirection(toTarget, monster.avoidSide * Math.PI * 0.5)
          .add(toTarget.clone().multiplyScalar(0.25))
          .normalize();
        monster.root.position.addScaledVector(rescueDirection, 0.14);
        resolveMonsterCollisions(monster);
        monster.stuckTime = 0;
      }
    } else {
      monster.stuckTime = Math.max(0, monster.stuckTime - dt * 2.5);
    }
    monster.lastPosition.copy(monster.root.position);
  }
  resolveMonsterCrowding();
  for (const monster of monsters) resolveMonsterCollisions(monster);
}

function handleMedpacks(dt, elapsed) {
  if (state.elapsed > state.nextMed) {
    state.nextMed += 9 + Math.random() * 4;
    spawnMedpack();
  }
  for (let i = medpacks.length - 1; i >= 0; i--) {
    const pack = medpacks[i];
    pack.position.y = 0.12 + Math.sin(elapsed * 4 + i) * 0.08;
    pack.rotation.y += dt * 1.4;
    if (flatDistance(pack.position, player.root.position) < 0.88) {
      state.playerHp = Math.min(100, state.playerHp + 26);
      world.remove(pack);
      medpacks.splice(i, 1);
    }
  }
  for (let i = slashes.length - 1; i >= 0; i--) {
    const slash = slashes[i];
    slash.life -= dt;
    slash.mesh.scale.multiplyScalar(1 + dt * 3.2);
    slash.mesh.material.opacity = Math.max(0, slash.life / 0.18);
    if (slash.life <= 0) {
      world.remove(slash.mesh);
      slashes.splice(i, 1);
    }
  }
}

function handleSpawns() {
  if (state.elapsed < state.nextSpawn) return;
  state.nextSpawn = state.elapsed + Math.max(1.1, 3.1 - state.elapsed * 0.025);
  spawnMonster(0);
}

function checkEndState() {
  if (state.campHp <= 0) endGame('\u71df\u706b\u7184\u6ec5');
  if (state.playerHp <= 0) endGame('\u89d2\u8272\u5012\u4e0b');
  if (state.elapsed >= 60) endGame('\u6210\u529f\u5b88\u4f4f');
}

function killMonster(monster) {
  const index = monsters.indexOf(monster);
  if (index >= 0) monsters.splice(index, 1);
  world.remove(monster.root);
  state.kills += 1;
  if (Math.random() < 0.22) spawnMedpack();
}

function spawnSlash(position) {
  const slash = mesh(new THREE.TorusGeometry(0.75, 0.035, 6, 18, Math.PI * 1.15), mats.slash.clone(), [position.x, 0.82, position.z], [Math.PI / 2, 0, Math.random() * Math.PI]);
  slash.castShadow = false;
  slash.material.transparent = true;
  slash.material.opacity = 0.88;
  slashes.push({ mesh: slash, life: 0.18 });
  world.add(slash);
}

function animateHumanoid(character, dt, moving, speedFactor = 1, attackRatio = 0) {
  character.walkPhase += dt * (moving ? 9.5 * speedFactor : 2.4);
  const p = character.walkPhase;
  const attacking = attackRatio > 0;
  const attackProgress = attacking ? 1 - attackRatio : 0;
  const wind = attacking ? Math.sin(attackProgress * Math.PI) : 0;
  const cut = attacking ? easeOutCubic(attackProgress) : 0;
  character.body.position.y = Math.sin(p * 2) * (moving ? 0.045 : 0.018);
  character.body.position.z = wind * 0.22;
  character.body.rotation.x = -wind * 0.18;
  character.body.rotation.z = Math.sin(p) * (moving ? 0.055 : 0.016) - wind * 0.08;
  character.leftLeg.rotation.x = Math.sin(p) * (moving ? 0.55 : 0.04) - wind * 0.18;
  character.rightLeg.rotation.x = -Math.sin(p) * (moving ? 0.55 : 0.04) + wind * 0.18;
  character.leftArm.rotation.x = -Math.sin(p) * (moving ? 0.45 : 0.05) - wind * 0.35;
  character.rightArm.rotation.x = Math.sin(p) * (moving ? 0.45 : 0.05) - wind * 0.95;
  const restWeaponZ = -0.9;
  const swingWeaponZ = THREE.MathUtils.lerp(-1.85, -0.1, cut);
  character.weapon.rotation.z = attacking ? swingWeaponZ : THREE.MathUtils.lerp(character.weapon.rotation.z, restWeaponZ, 1 - Math.pow(0.001, dt));
  character.weapon.position.z = 0.26 + wind * 0.18;
}

function animateCampfire(elapsed) {
  const pulse = 1 + Math.sin(elapsed * 9) * 0.08;
  campfire.flame.scale.set(pulse, 1 + Math.sin(elapsed * 7) * 0.12, pulse);
  campfire.flame.rotation.y += 0.035;
  campfire.light.intensity = 4.2 + Math.sin(elapsed * 10) * 0.9;
}

function updateSnow(dt, elapsed) {
  const attr = snow.group.geometry.attributes.position;
  for (let i = 0; i < snow.speeds.length; i++) {
    const index = i * 3;
    snow.positions[index] += Math.sin(elapsed * 0.8 + i) * dt * 0.26;
    snow.positions[index + 1] -= snow.speeds[i] * dt;
    snow.positions[index + 2] += dt * 0.42;
    if (snow.positions[index + 1] < -0.2) {
      snow.positions[index] = player.root.position.x - 17 + Math.random() * 34;
      snow.positions[index + 1] = 8 + Math.random() * 7;
      snow.positions[index + 2] = player.root.position.z - 20 + Math.random() * 38;
    }
  }
  attr.needsUpdate = true;
}

function updateCamera(dt) {
  const targetCam = new THREE.Vector3(player.root.position.x + 11, 15, player.root.position.z + 12);
  camera.position.lerp(targetCam, 1 - Math.pow(0.0012, dt));
  camera.lookAt(player.root.position.x, 0, player.root.position.z);
}

function updateUI() {
  const remain = Math.max(0, Math.ceil(60 - state.elapsed));
  ui.timer.textContent = remain;
  ui.kills.textContent = state.kills;
  ui.campHp.style.width = `${THREE.MathUtils.clamp(state.campHp / 50, 0, 1) * 100}%`;
  ui.heroHp.style.width = `${THREE.MathUtils.clamp(state.playerHp / 100, 0, 1) * 100}%`;
  ui.heroHp.style.background = state.playerHp < 35 ? '#ff5145' : '#39ef4a';
}

function endGame(text) {
  state.gameOver = true;
  ui.message.textContent = text;
}

function steerAroundTerrain(monster, desiredDirection, targetPosition) {
  const radius = monsterRadius(monster);
  const lookAhead = 1.55 + radius;
  const toGoal = targetPosition.clone().sub(monster.root.position).setY(0);
  if (toGoal.lengthSq() > 0.0001) toGoal.normalize();

  const side = monster.avoidSide >= 0 ? 1 : -1;
  const angles = monster.avoidHold > 0
    ? [0.52 * side, 0.95 * side, 1.35 * side, -0.65 * side, 0, 1.95 * side, -1.45 * side]
    : [0, 0.42, -0.42, 0.82, -0.82, 1.24, -1.24, 1.82, -1.82];

  let bestDirection = desiredDirection;
  let bestScore = -Infinity;
  let bestAngle = 0;

  for (const angle of angles) {
    const candidate = rotateFlatDirection(desiredDirection, angle);
    const penalty = terrainPathPenalty(monster.root.position, candidate, radius, lookAhead);
    const sideBias = monster.avoidHold > 0 ? Math.sign(angle || side) * side * 0.18 : 0;
    const score = candidate.dot(desiredDirection) * 1.15 + candidate.dot(toGoal) * 1.35 + sideBias - penalty * 2.35;
    if (score > bestScore) {
      bestScore = score;
      bestDirection = candidate;
      bestAngle = angle;
    }
  }

  if (Math.abs(bestAngle) > 0.01) monster.avoidSide = bestAngle > 0 ? 1 : -1;
  return bestDirection;
}

function rotateFlatDirection(direction, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new THREE.Vector3(direction.x * c - direction.z * s, 0, direction.x * s + direction.z * c).normalize();
}

function terrainPathPenalty(position, direction, radius, lookAhead) {
  let penalty = 0;
  const sampleNear = position.clone().addScaledVector(direction, lookAhead * 0.48);
  const sampleFar = position.clone().addScaledVector(direction, lookAhead);

  for (const collider of terrainColliders) {
    const dangerDistance = radius + collider.radius + 0.58;
    const currentDistance = flatDistance(position, collider.position);
    const nearDistance = flatDistance(sampleNear, collider.position);
    const farDistance = flatDistance(sampleFar, collider.position);

    if (currentDistance < dangerDistance) penalty += Math.pow((dangerDistance - currentDistance) / dangerDistance, 2) * 1.4;
    if (nearDistance < dangerDistance) penalty += Math.pow((dangerDistance - nearDistance) / dangerDistance, 2) * 1.8;
    if (farDistance < dangerDistance) penalty += Math.pow((dangerDistance - farDistance) / dangerDistance, 2);
  }

  return penalty;
}

function screenVectorToWorld(input) {
  if (input.lengthSq() === 0) return new THREE.Vector3();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  right.y = 0;
  up.y = 0;
  right.normalize();
  up.normalize();
  return right.multiplyScalar(input.x).add(up.multiplyScalar(-input.y));
}

function getScreenPosition(worldPosition) {
  const projected = worldPosition.clone();
  projected.y = 0.7;
  projected.project(camera);
  return {
    x: (projected.x * 0.5 + 0.5) * window.innerWidth,
    y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
  };
}

function resolvePlayerCollisions() {
  let hit = pushOutOfCircle(player.root.position, COLLISION.player, campfire.root.position, COLLISION.camp);
  for (const monster of monsters) {
    hit = pushOutOfCircle(player.root.position, COLLISION.player, monster.root.position, monsterRadius(monster)) || hit;
  }
  for (const collider of terrainColliders) {
    hit = pushOutOfCircle(player.root.position, COLLISION.player, collider.position, collider.radius) || hit;
  }
  if (hit) state.velocity.multiplyScalar(0.18);
  player.root.position.x = THREE.MathUtils.clamp(player.root.position.x, -8.2, 8.2);
  player.root.position.z = THREE.MathUtils.clamp(player.root.position.z, -8.2, 8.2);
}

function resolveMonsterCollisions(monster) {
  pushOutOfCircle(monster.root.position, monsterRadius(monster), campfire.root.position, COLLISION.camp);
  pushOutOfCircle(monster.root.position, monsterRadius(monster), player.root.position, COLLISION.player);
  for (const collider of terrainColliders) {
    pushOutOfCircle(monster.root.position, monsterRadius(monster), collider.position, collider.radius);
  }
}

function resolveMonsterCrowding() {
  for (let i = 0; i < monsters.length; i++) {
    for (let j = i + 1; j < monsters.length; j++) {
      const a = monsters[i];
      const b = monsters[j];
      const minDistance = monsterRadius(a) + monsterRadius(b) + 0.08;
      const dx = a.root.position.x - b.root.position.x;
      const dz = a.root.position.z - b.root.position.z;
      const distance = Math.hypot(dx, dz) || 0.0001;
      if (distance >= minDistance) continue;
      const push = (minDistance - distance) * 0.5;
      const nx = dx / distance;
      const nz = dz / distance;
      a.root.position.x += nx * push;
      a.root.position.z += nz * push;
      b.root.position.x -= nx * push;
      b.root.position.z -= nz * push;
    }
  }
}

function pushOutOfCircle(subjectPosition, subjectRadius, obstaclePosition, obstacleRadius) {
  const minDistance = subjectRadius + obstacleRadius;
  const dx = subjectPosition.x - obstaclePosition.x;
  const dz = subjectPosition.z - obstaclePosition.z;
  let distance = Math.hypot(dx, dz);
  if (distance >= minDistance) return false;
  if (distance < 0.0001) {
    distance = 0.0001;
    subjectPosition.x += minDistance;
    return true;
  }
  const push = minDistance - distance;
  subjectPosition.x += (dx / distance) * push;
  subjectPosition.z += (dz / distance) * push;
  return true;
}

function monsterRadius(monster) {
  return COLLISION.monster * monster.root.scale.x;
}

function flatDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function dampAngle(current, target, lambda, dt) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-lambda * dt));
}

function animate() {
  const dt = Math.min(state.clock.getDelta(), 0.05);
  update(dt, state.clock.elapsedTime);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  const aspect = width / height;
  const view = height > width ? 8.3 : 11.6;
  camera.left = -view * aspect;
  camera.right = view * aspect;
  camera.top = view;
  camera.bottom = -view;
  camera.updateProjectionMatrix();
}
