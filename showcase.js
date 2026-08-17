// ===== PourMatch 3D 展示 =====
// 技法：程式化生成旋轉體幾何 + MeshPhysicalMaterial 透射折射 + 程式化環境貼圖 + 捲動驅動運鏡
import * as THREE from './vendor/three.module.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';

const canvas = document.getElementById('scene');
const isCoarse = window.matchMedia('(pointer: coarse)').matches;
const isSmall = window.innerWidth < 820;
const lowPower = isCoarse || isSmall;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 載入進度 ----------
const loader = document.getElementById('loader');
const loaderRing = document.getElementById('loaderRing');
const loaderPct = document.getElementById('loaderPct');
const RING_LEN = 2 * Math.PI * 130;
loaderRing.style.strokeDasharray = String(RING_LEN);

let progress = 0;
function setProgress(v) {
  progress = Math.max(progress, Math.min(1, v));
  loaderRing.style.strokeDashoffset = String(RING_LEN * (1 - progress));
  loaderPct.textContent = Math.round(progress * 100) + '%';
}
setProgress(0);

// 讓每個實際完成的步驟推進進度，而不是假的計時器
const STEPS = 5;
let done = 0;
const step = () => setProgress(++done / STEPS);

// ---------- 渲染器 ----------
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !lowPower,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.32;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060d);
scene.fog = new THREE.Fog(0x05060d, 26, 54);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 5.4, 16);

// ---------- 環境貼圖：用程式生成攝影棚環境，取代 HDR 檔 ----------
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRT.texture;
// RoomEnvironment 是明亮的攝影棚，直接用會把玻璃洗白，壓低到只留反射細節
scene.environmentIntensity = 0.62;
step();

// ---------- 酒杯輪廓 ----------
// LatheGeometry 會把這條 2D 輪廓線繞 Y 軸旋轉。輪廓從杯底中心出發，
// 沿外壁上行越過杯口，再沿內壁下行回到軸線，這樣旋轉出來的杯子才有真實壁厚。
const OUTER = [
  [0.00, 0.00], [1.55, 0.00], [2.62, 0.06], [2.72, 0.20], [2.60, 0.34],
  [1.30, 0.58], [0.62, 0.94], [0.44, 1.45], [0.40, 2.60], [0.42, 3.30],
  [0.72, 3.86], [1.35, 4.22], [2.15, 4.72], [2.92, 5.42], [3.46, 6.24],
  [3.80, 7.06], [3.97, 7.72], [4.02, 8.10],
];
const INNER = [
  [3.80, 8.10], [3.74, 7.70], [3.58, 7.04], [3.24, 6.24], [2.70, 5.44],
  [1.95, 4.76], [1.20, 4.34], [0.70, 4.16], [0.00, 4.12],
];

function toVec2(pairs) {
  return pairs.map(([x, y]) => new THREE.Vector2(x, y));
}
const glassProfile = toVec2(OUTER.concat(INNER));

const SEGMENTS = lowPower ? 96 : 192;
const glassGeo = new THREE.LatheGeometry(glassProfile, SEGMENTS);
glassGeo.computeVertexNormals();

// 酒液：沿杯子內壁生成，液面高度可調
const LIQUID_FLOOR = 4.12;
const LIQUID_TOP = 7.55;
function liquidProfileAt(level) {
  // level: 0..1，決定液面停在內壁的哪個高度
  const topY = LIQUID_FLOOR + (LIQUID_TOP - LIQUID_FLOOR) * level;
  const pts = [new THREE.Vector2(0, LIQUID_FLOOR)];
  const inner = INNER.slice().reverse(); // 由內底往上
  for (const [x, y] of inner) {
    if (y > topY) break;
    pts.push(new THREE.Vector2(x * 0.985, y));
  }
  // 液面半徑：在內壁上內插
  let r = 0.7;
  for (let i = 0; i < inner.length - 1; i++) {
    const [x1, y1] = inner[i], [x2, y2] = inner[i + 1];
    if (topY >= y1 && topY <= y2) {
      const t = (topY - y1) / Math.max(1e-6, y2 - y1);
      r = (x1 + (x2 - x1) * t) * 0.985;
      break;
    }
  }
  pts.push(new THREE.Vector2(r, topY));
  pts.push(new THREE.Vector2(0, topY));
  return pts;
}

// 依高度給頂點顏色，做出金→粉→紫的漸層酒液
const C_TOP = new THREE.Color('#FFC46B');
const C_MID = new THREE.Color('#FF4D8D');
const C_LOW = new THREE.Color('#7B5CFF');
function paintLiquid(geo) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - LIQUID_FLOOR) / (LIQUID_TOP - LIQUID_FLOOR), 0, 1);
    if (t < 0.5) c.copy(C_LOW).lerp(C_MID, t / 0.5);
    else c.copy(C_MID).lerp(C_TOP, (t - 0.5) / 0.5);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

let liquidGeo = new THREE.LatheGeometry(liquidProfileAt(0.001), SEGMENTS);
paintLiquid(liquidGeo);
step();

// ---------- 材質 ----------
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  metalness: 0,
  roughness: 0.045,
  transmission: 1,        // 真正的折射，不是靠透明度假裝
  thickness: 1.1,
  ior: 1.52,              // 鈉鈣玻璃的折射率
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  envMapIntensity: 1.5,
  transparent: true,
  side: THREE.DoubleSide,
});

const liquidMat = new THREE.MeshPhysicalMaterial({
  vertexColors: true,
  metalness: 0,
  roughness: 0.14,
  transmission: 0.55,
  thickness: 2.2,
  ior: 1.36,
  emissive: new THREE.Color('#FF3D82'),
  emissiveIntensity: 0.16,
  attenuationDistance: 4.5,
  attenuationColor: new THREE.Color('#FF5FA0'),
  envMapIntensity: 1.1,
  transparent: true,
  side: THREE.DoubleSide,
});

const glass = new THREE.Mesh(glassGeo, glassMat);
const liquid = new THREE.Mesh(liquidGeo, liquidMat);
const drink = new THREE.Group();
drink.add(glass, liquid);
scene.add(drink);

// ---------- 地面、投影與焦散光池 ----------
function radialTexture(stops, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(40, 64),
  new THREE.MeshStandardMaterial({
    color: 0x04050c, roughness: 0.62, metalness: 0.35, envMapIntensity: 0.35,
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.001;
scene.add(ground);

// 接觸陰影：深色不透明度貼圖，貼在地面上
const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(13, 13),
  new THREE.MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(0,0,0,0.85)'], [0.42, 'rgba(0,0,0,0.32)'], [1, 'rgba(0,0,0,0)']]),
    transparent: true, depthWrite: false,
  })
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = 0.012;
scene.add(shadowPlane);

// 焦散光池：酒液透光後灑在地面的彩色光斑，用加法混合疊上去
const caustic = new THREE.Mesh(
  new THREE.PlaneGeometry(11, 11),
  new THREE.MeshBasicMaterial({
    map: radialTexture([
      [0, 'rgba(255,196,107,0.85)'], [0.3, 'rgba(255,77,141,0.42)'],
      [0.62, 'rgba(123,92,255,0.16)'], [1, 'rgba(123,92,255,0)'],
    ]),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })
);
caustic.rotation.x = -Math.PI / 2;
caustic.position.y = 0.02;
scene.add(caustic);

// ---------- 燈光：環境貼圖負責反射，這些負責造型與品牌色 ----------
const key = new THREE.DirectionalLight(0xffffff, 3.1);
key.position.set(-6, 12, 8);
scene.add(key);

const rimGold = new THREE.PointLight(0xFFB547, 90, 30, 2);
rimGold.position.set(6.5, 7.5, -4);
scene.add(rimGold);

const rimPink = new THREE.PointLight(0xFF4D8D, 70, 28, 2);
rimPink.position.set(-7, 4.5, -5);
scene.add(rimPink);

const rimPurple = new THREE.PointLight(0x7B5CFF, 55, 26, 2);
rimPurple.position.set(0, 2.2, 9);
scene.add(rimPurple);

// 杯內的小燈：讓酒液像從內部被點亮，是這種鏡頭最有效的一招
const inner = new THREE.PointLight(0xFF9A4D, 26, 9, 2);
inner.position.set(0, 5.4, 0);
scene.add(inner);
step();

// ---------- 後製 ----------
let composer = null;
if (!lowPower) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.42,  // strength
    0.85,  // radius
    0.72   // threshold：只讓高光溢出，不讓整體發灰
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(window.innerWidth, window.innerHeight);
}
step();

// ---------- 捲動驅動的運鏡 ----------
// 每個關鍵影格 = 一個章節的鏡位；捲動進度在影格之間內插
const KEYS = [
  { p: 0.00, cam: [0.0,  7.0, 26.0], look: [0, 4.4, 0], spin: 0.0, fill: 0.55 },
  { p: 0.28, cam: [0.0,  8.4, 15.5], look: [0, 6.2, 0], spin: 0.9, fill: 1.0  },
  { p: 0.55, cam: [11.5, 5.2, 13.5], look: [0, 4.0, 0], spin: 2.1, fill: 1.0  },
  { p: 0.78, cam: [-9.0, 1.9, 14.5], look: [0, 1.5, 0], spin: 3.2, fill: 1.0  },
  { p: 1.00, cam: [0.0,  7.4, 30.0], look: [0, 4.2, 0], spin: 4.0, fill: 1.0  },
];

const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function sampleKeys(p) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (p >= KEYS[i].p && p <= KEYS[i + 1].p) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const span = Math.max(1e-6, b.p - a.p);
  const t = easeInOut(THREE.MathUtils.clamp((p - a.p) / span, 0, 1));
  const lerp3 = (u, v) => [0, 1, 2].map(i => u[i] + (v[i] - u[i]) * t);
  return {
    cam: lerp3(a.cam, b.cam),
    look: lerp3(a.look, b.look),
    spin: a.spin + (b.spin - a.spin) * t,
    fill: a.fill + (b.fill - a.fill) * t,
  };
}

const scroller = document.getElementById('scroller');
let targetP = 0, smoothP = 0, lastFill = -1;

function readScroll() {
  const max = scroller.scrollHeight - window.innerHeight;
  targetP = max > 0 ? THREE.MathUtils.clamp(window.scrollY / max, 0, 1) : 0;
  document.getElementById('railFill').style.transform = `scaleY(${targetP})`;
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

// 液面高度改變需要重建幾何，所以只在變化量夠大時才重建
function updateLiquid(level) {
  const q = Math.round(level * 40) / 40;
  if (q === lastFill) return;
  lastFill = q;
  const geo = new THREE.LatheGeometry(liquidProfileAt(Math.max(0.001, q)), SEGMENTS);
  paintLiquid(geo);
  liquid.geometry.dispose();
  liquid.geometry = geo;
}

const lookTarget = new THREE.Vector3();
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  // 阻尼讓捲動有慣性，這是「順」的來源
  smoothP += (targetP - smoothP) * Math.min(1, dt * (reduceMotion ? 20 : 4.2));

  const k = sampleKeys(smoothP);
  camera.position.set(k.cam[0], k.cam[1], k.cam[2]);
  lookTarget.set(k.look[0], k.look[1], k.look[2]);
  camera.lookAt(lookTarget);

  const idle = reduceMotion ? 0 : clock.elapsedTime * 0.14;
  drink.rotation.y = k.spin + idle;

  // 杯子隨呼吸微幅起伏，影子反向呼應（升高時縮小變淡）
  const bob = reduceMotion ? 0 : Math.sin(clock.elapsedTime * 0.9) * 0.06;
  drink.position.y = bob;
  const s = 1 - bob * 0.9;
  shadowPlane.scale.setScalar(s);
  caustic.scale.setScalar(s);
  caustic.material.opacity = 0.75 + bob * 1.2;

  updateLiquid(k.fill);

  if (composer) composer.render(); else renderer.render(scene, camera);
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (composer) composer.setSize(w, h);
  readScroll();
}
window.addEventListener('resize', onResize);

// 先渲染一格，確認畫面真的出得來，再收掉載入畫面
renderer.render(scene, camera);
step();

requestAnimationFrame(() => {
  frame();
  loader.classList.add('done');
  document.body.classList.add('ready');
  setTimeout(() => { loader.style.display = 'none'; }, 900);
});

// ---------- 文字章節進場 ----------
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => e.target.classList.toggle('in', e.isIntersecting));
}, { threshold: 0.35 });
document.querySelectorAll('.act').forEach(el => io.observe(el));
