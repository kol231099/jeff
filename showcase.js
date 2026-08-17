// ===== THE POUR — 捲動驅動的 3D 調酒解構 =====
// 構成：可拆解的旋轉體幾何 + 透射玻璃 + 粒子流場 + 明暗場景轉換 + 3D 標籤投影
import * as THREE from './vendor/three.module.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';

const canvas = document.getElementById('scene');
const lowPower = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- 載入進度 ---------------- */
const loader = document.getElementById('loader');
const loaderRing = document.getElementById('loaderRing');
const loaderPct = document.getElementById('loaderPct');
const RING_LEN = 2 * Math.PI * 130;
loaderRing.style.strokeDasharray = String(RING_LEN);
let progress = 0;
const setProgress = v => {
  progress = Math.max(progress, Math.min(1, v));
  loaderRing.style.strokeDashoffset = String(RING_LEN * (1 - progress));
  loaderPct.textContent = Math.round(progress * 100) + '%';
};
const STEPS = 7;
let doneSteps = 0;
const step = () => setProgress(++doneSteps / STEPS);
setProgress(0);

/* ---------------- 渲染器 ---------------- */
// alpha 讓畫布透明：背景與巨型字體交給 DOM，3D 物件才能自然遮住文字
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: !lowPower, alpha: true, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearAlpha(0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 300);

const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.6;
step();

/* ---------------- 幾何：杯子拆成三段，才能攤開 ---------------- */
const V = (x, y) => new THREE.Vector2(x, y);
const SEG = lowPower ? 88 : 176;

// 每段都用「外壁上行 → 內壁下行」的封閉輪廓，旋轉後才有真實壁厚
const BOWL_OUT = [[0.62, 3.86], [1.35, 4.22], [2.15, 4.72], [2.92, 5.42], [3.46, 6.24],
                  [3.80, 7.06], [3.97, 7.72], [4.02, 8.10]];
const BOWL_IN  = [[3.80, 8.10], [3.74, 7.70], [3.58, 7.04], [3.24, 6.24], [2.70, 5.44],
                  [1.95, 4.76], [1.20, 4.34], [0.70, 4.16], [0.00, 4.12]];
const STEM = [[0.00, 1.02], [0.44, 1.10], [0.42, 2.60], [0.46, 3.30], [0.62, 3.86],
              [0.50, 3.88], [0.34, 3.30], [0.30, 2.60], [0.32, 1.12], [0.00, 1.06]];
const FOOT = [[0.00, 0.00], [1.55, 0.00], [2.62, 0.06], [2.72, 0.20], [2.60, 0.34],
              [1.30, 0.58], [0.62, 0.96], [0.40, 0.96], [1.10, 0.54], [2.30, 0.30],
              [2.40, 0.18], [1.50, 0.12], [0.00, 0.12]];

const lathe = pts => new THREE.LatheGeometry(pts.map(([x, y]) => V(x, y)), SEG);

const LIQ_FLOOR = 4.12, LIQ_TOP = 7.45;
function liquidProfile(level) {
  const topY = LIQ_FLOOR + (LIQ_TOP - LIQ_FLOOR) * level;
  const inner = BOWL_IN.slice().reverse();
  const pts = [V(0, LIQ_FLOOR)];
  for (const [x, y] of inner) { if (y > topY) break; pts.push(V(x * 0.985, y)); }
  let r = 0.7;
  for (let i = 0; i < inner.length - 1; i++) {
    const [x1, y1] = inner[i], [x2, y2] = inner[i + 1];
    if (topY >= y1 && topY <= y2) {
      r = (x1 + (x2 - x1) * (topY - y1) / Math.max(1e-6, y2 - y1)) * 0.985;
      break;
    }
  }
  pts.push(V(r, topY), V(0, topY));
  return new THREE.LatheGeometry(pts, SEG);
}

const C_TOP = new THREE.Color('#FFC46B'), C_MID = new THREE.Color('#FF4D8D'), C_LOW = new THREE.Color('#7B5CFF');
function paintLiquid(geo) {
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - LIQ_FLOOR) / (LIQ_TOP - LIQ_FLOOR), 0, 1);
    t < 0.5 ? c.copy(C_LOW).lerp(C_MID, t / 0.5) : c.copy(C_MID).lerp(C_TOP, (t - 0.5) / 0.5);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
step();

/* ---------------- 材質 ---------------- */
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, metalness: 0, roughness: 0.04, transmission: 1, thickness: 1.0,
  ior: 1.52, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6,
  transparent: true, side: THREE.DoubleSide,
});
const liquidMat = new THREE.MeshPhysicalMaterial({
  vertexColors: true, metalness: 0, roughness: 0.12, transmission: 0.34, thickness: 1.8,
  ior: 1.36, emissive: new THREE.Color('#FF3D82'), emissiveIntensity: 0.22,
  attenuationDistance: 9, attenuationColor: new THREE.Color('#FF5FA0'),
  envMapIntensity: 1.1, transparent: true, side: THREE.DoubleSide,
});
const iceMat = new THREE.MeshPhysicalMaterial({
  color: 0xdff2ff, metalness: 0, roughness: 0.09, transmission: 0.96, thickness: 0.9,
  ior: 1.31, envMapIntensity: 1.3, transparent: true,
});
const citrusMat = new THREE.MeshPhysicalMaterial({
  color: 0xFFC24A, roughness: 0.42, transmission: 0.45, thickness: 0.35,
  emissive: new THREE.Color('#FF9A2E'), emissiveIntensity: 0.18, side: THREE.DoubleSide,
});
const cherryMat = new THREE.MeshPhysicalMaterial({
  color: 0xC01A3E, roughness: 0.18, clearcoat: 1,
  emissive: new THREE.Color('#7A0E26'), emissiveIntensity: 0.2,
});

/* ---------------- 可拆解的零件 ---------------- */
// 每個零件記住原位與攤開位，explode 進度在兩者之間內插
const drink = new THREE.Group();
scene.add(drink);
const parts = [];
function addPart(mesh, { home, apart, label, spec }) {
  mesh.userData = { home: new THREE.Vector3(...home), apart: new THREE.Vector3(...apart), label, spec };
  drink.add(mesh);
  parts.push(mesh);
  return mesh;
}

const bowl = addPart(new THREE.Mesh(lathe(BOWL_OUT.concat(BOWL_IN)), glassMat),
  { home: [0, 0, 0], apart: [0, 6.2, 0], label: '杯體', spec: 'Coupe · 210ml' });
const liquid = addPart(new THREE.Mesh(paintLiquid(liquidProfile(0.001)), liquidMat),
  { home: [0, 0, 0], apart: [0, 2.4, 0], label: '酒液', spec: '基酒 45ml · 利口酒 15ml' });
const ice = addPart(new THREE.Mesh(new THREE.IcosahedronGeometry(0.92, 1), iceMat),
  { home: [0.7, 5.5, 0.35], apart: [0, -1.6, 0], label: '冰', spec: '單顆大冰 · 緩融' });
const citrus = addPart(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.08, 48), citrusMat),
  { home: [-1.5, 6.4, 0.9], apart: [0, -4.4, 0], label: '柑橘', spec: '檸檬皮油 · 表面噴附' });
const cherry = addPart(new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), cherryMat),
  { home: [1.6, 6.6, -0.7], apart: [0, -6.8, 0], label: '裝飾', spec: '酒漬櫻桃' });
const stem = addPart(new THREE.Mesh(lathe(STEM), glassMat),
  { home: [0, 0, 0], apart: [0, -9.4, 0], label: '杯腳', spec: '手工拉製' });
const foot = addPart(new THREE.Mesh(lathe(FOOT), glassMat),
  { home: [0, 0, 0], apart: [0, -12.2, 0], label: '底座', spec: 'Ø 54mm' });

citrus.rotation.z = 0.5;
step();

/* ---------------- 粒子流場 ---------------- */
// 沿數條封閉曲線灑點，shader 讓每顆點各自緩慢漂移，形成流動的緞帶
function buildParticles(count) {
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const size = new Float32Array(count);
  const curves = [];
  for (let c = 0; c < 7; c++) {
    const cp = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * Math.PI * 2 + c * 0.9;
      const r = 9 + Math.sin(c * 2.1 + i) * 4.5;
      cp.push(new THREE.Vector3(Math.cos(a) * r, 2 + Math.sin(i * 1.7 + c) * 5.5, Math.sin(a) * r * 0.75));
    }
    curves.push(new THREE.CatmullRomCurve3(cp, true, 'catmullrom', 0.6));
  }
  for (let i = 0; i < count; i++) {
    const p = curves[i % curves.length].getPoint(Math.random());
    const s = 0.85;
    pos[i * 3] = p.x + (Math.random() - 0.5) * s;
    pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * s;
    pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * s;
    phase[i] = Math.random() * Math.PI * 2;
    size[i] = 0.6 + Math.random() * 1.9;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  return g;
}

const particleMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: {
    uTime: { value: 0 }, uOpacity: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uColorA: { value: new THREE.Color('#FFD9A0') },
    uColorB: { value: new THREE.Color('#9B7BFF') },
  },
  vertexShader: `
    attribute float aPhase;
    attribute float aSize;
    uniform float uTime;
    uniform float uPixelRatio;
    varying float vMix;
    void main() {
      vec3 p = position;
      float t = uTime * 0.22 + aPhase;
      p.x += sin(t) * 0.9;
      p.y += cos(t * 0.8) * 0.7;
      p.z += sin(t * 0.6 + 1.3) * 0.9;
      vMix = 0.5 + 0.5 * sin(aPhase + uTime * 0.4);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = aSize * uPixelRatio * (46.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform float uOpacity;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    varying float vMix;
    void main() {
      vec2 d = gl_PointCoord - 0.5;
      float a = smoothstep(0.5, 0.06, length(d));
      if (a <= 0.001) discard;
      gl_FragColor = vec4(mix(uColorA, uColorB, vMix), a * uOpacity);
    }`,
});

const particles = new THREE.Points(buildParticles(lowPower ? 2600 : 7000), particleMat);
particles.position.y = 4;
scene.add(particles);
step();

/* ---------------- 燈光 ---------------- */
const key = new THREE.DirectionalLight(0xffffff, 3.0);
key.position.set(-6, 12, 8);
scene.add(key);
const fillLight = new THREE.DirectionalLight(0xBFD0FF, 1.1);
fillLight.position.set(7, 5, -6);
scene.add(fillLight);
const rimGold = new THREE.PointLight(0xFFB547, 80, 30, 2); rimGold.position.set(6.5, 7.5, -4); scene.add(rimGold);
const rimPink = new THREE.PointLight(0xFF4D8D, 62, 28, 2); rimPink.position.set(-7, 4.5, -5); scene.add(rimPink);
const innerLight = new THREE.PointLight(0xFF9A4D, 24, 9, 2); innerLight.position.set(0, 5.4, 0); scene.add(innerLight);

/* ---------------- 地面陰影與焦散 ---------------- */
function radialTex(stops, size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const groundGroup = new THREE.Group();
scene.add(groundGroup);
const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(14, 14),
  new THREE.MeshBasicMaterial({
    map: radialTex([[0, 'rgba(0,0,0,0.8)'], [0.42, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]),
    transparent: true, depthWrite: false,
  }));
shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.y = 0.012; groundGroup.add(shadowPlane);
const caustic = new THREE.Mesh(new THREE.PlaneGeometry(12, 12),
  new THREE.MeshBasicMaterial({
    map: radialTex([[0, 'rgba(255,196,107,0.8)'], [0.3, 'rgba(255,77,141,0.4)'],
      [0.62, 'rgba(123,92,255,0.15)'], [1, 'rgba(123,92,255,0)']]),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
caustic.rotation.x = -Math.PI / 2; caustic.position.y = 0.02; groundGroup.add(caustic);
step();

/* ---------------- 後製 ---------------- */
let composer = null, bloom = null;
if (!lowPower) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.9, 0.7);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
}
step();

/* ---------------- 捲動關鍵影格 ---------------- */
// bg 頁面底色（明暗交替）／ink 文字色／explode 拆解程度／dust 粒子濃度／ground 地面存在感
const KEYS = [
  { p: 0.00, cam: [0, 7.2, 27], look: [0, 4.4, 0], spin: 0.0, fill: 0.55, explode: 0,    dust: 0.12, bg: '#05060d', ink: '#EEF0FF', env: 0.60, ground: 1 },
  { p: 0.13, cam: [0, 8.6, 15], look: [0, 6.1, 0], spin: 0.7, fill: 1.00, explode: 0,    dust: 0.10, bg: '#05060d', ink: '#EEF0FF', env: 0.60, ground: 1 },
  { p: 0.30, cam: [13, 5.0, 15], look: [0, 4.2, 0], spin: 1.9, fill: 1.00, explode: 0,    dust: 0.05, bg: '#E8E8EA', ink: '#14141A', env: 1.35, ground: 0.35 },
  { p: 0.50, cam: [0, 4.6, 30], look: [0, 3.4, 0], spin: 2.6, fill: 1.00, explode: 1,    dust: 0.05, bg: '#E8E8EA', ink: '#14141A', env: 1.35, ground: 0 },
  { p: 0.66, cam: [7, 3.2, 22], look: [0, 2.6, 0], spin: 3.4, fill: 1.00, explode: 1,    dust: 0.10, bg: '#D8D8DC', ink: '#14141A', env: 1.25, ground: 0 },
  { p: 0.80, cam: [0, 5.4, 13], look: [0, 5.2, 0], spin: 4.2, fill: 1.00, explode: 0.18, dust: 1.00, bg: '#020308', ink: '#EEF0FF', env: 0.42, ground: 0 },
  { p: 0.92, cam: [-8, 4.4, 17], look: [0, 4.0, 0], spin: 5.0, fill: 1.00, explode: 0,   dust: 0.55, bg: '#05060d', ink: '#EEF0FF', env: 0.62, ground: 0.8 },
  { p: 1.00, cam: [0, 7.6, 31], look: [0, 4.2, 0], spin: 5.6, fill: 1.00, explode: 0,    dust: 0.25, bg: '#05060d', ink: '#EEF0FF', env: 0.62, ground: 1 },
];

const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const cA = new THREE.Color(), cB = new THREE.Color();

function sample(p) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (p >= KEYS[i].p && p <= KEYS[i + 1].p) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const t = easeInOut(THREE.MathUtils.clamp((p - a.p) / Math.max(1e-6, b.p - a.p), 0, 1));
  const l3 = (u, v) => [0, 1, 2].map(i => u[i] + (v[i] - u[i]) * t);
  const l = (u, v) => u + (v - u) * t;
  cA.set(a.bg); cB.set(b.bg);
  const bg = '#' + cA.lerp(cB, t).getHexString();
  cA.set(a.ink); cB.set(b.ink);
  const ink = '#' + cA.lerp(cB, t).getHexString();
  return {
    cam: l3(a.cam, b.cam), look: l3(a.look, b.look), spin: l(a.spin, b.spin),
    fill: l(a.fill, b.fill), explode: l(a.explode, b.explode), dust: l(a.dust, b.dust),
    env: l(a.env, b.env), ground: l(a.ground, b.ground), bg, ink,
  };
}

/* ---------------- 捲動 ---------------- */
const scroller = document.getElementById('scroller');
const railFill = document.getElementById('railFill');
const bgLayer = document.getElementById('bgLayer');
const typeLayer = document.getElementById('typeLayer');
const labelLayer = document.getElementById('labelLayer');
const scrim = document.querySelector('.scrim');
const cLum = new THREE.Color();
let targetP = 0, smoothP = 0;

function readScroll() {
  const max = scroller.scrollHeight - innerHeight;
  targetP = max > 0 ? THREE.MathUtils.clamp(scrollY / max, 0, 1) : 0;
  railFill.style.transform = `scaleY(${targetP})`;
}
addEventListener('scroll', readScroll, { passive: true });
readScroll();

/* ---------------- 零件標籤：3D 座標投影到畫面 ---------------- */
const labels = parts.map(m => {
  const el = document.createElement('div');
  el.className = 'part-label';
  el.innerHTML = `<span class="pl-dot"></span><span class="pl-text"><b>${m.userData.label}</b>${m.userData.spec}</span>`;
  labelLayer.appendChild(el);
  return el;
});
const projected = new THREE.Vector3();

/* ---------------- 液面重建 ---------------- */
let lastFill = -1;
function updateLiquid(level) {
  const q = Math.round(level * 36) / 36;
  if (q === lastFill) return;
  lastFill = q;
  liquid.geometry.dispose();
  liquid.geometry = paintLiquid(liquidProfile(Math.max(0.001, q)));
}

/* ---------------- 主迴圈 ---------------- */
const lookAt = new THREE.Vector3();
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  smoothP += (targetP - smoothP) * Math.min(1, dt * (reduceMotion ? 20 : 3.6));

  const k = sample(smoothP);
  camera.position.set(k.cam[0], k.cam[1], k.cam[2]);
  lookAt.set(k.look[0], k.look[1], k.look[2]);
  camera.lookAt(lookAt);

  const idle = reduceMotion ? 0 : clock.elapsedTime * 0.12;
  drink.rotation.y = k.spin + idle;
  const bob = reduceMotion ? 0 : Math.sin(clock.elapsedTime * 0.85) * 0.05;
  drink.position.y = bob;

  // 拆解：零件在原位與攤開位之間內插
  const e = k.explode;
  for (const m of parts) {
    m.position.lerpVectors(m.userData.home, m.userData.apart, e);
    if (m === ice || m === citrus || m === cherry) m.rotation.y = e * 1.2;
  }
  updateLiquid(k.fill);

  scene.environmentIntensity = k.env;
  groundGroup.visible = k.ground > 0.02;
  shadowPlane.material.opacity = k.ground;
  caustic.material.opacity = k.ground * (0.75 + bob * 1.2);
  groundGroup.scale.setScalar(1 - bob * 0.9);

  particleMat.uniforms.uTime.value = clock.elapsedTime;
  particleMat.uniforms.uOpacity.value = k.dust;
  particles.rotation.y = clock.elapsedTime * 0.035;
  if (bloom) bloom.strength = 0.5 + k.dust * 0.35;

  bgLayer.style.backgroundColor = k.bg;
  document.documentElement.style.setProperty('--ink', k.ink);
  // 場景越亮，暗角與文字光暈就越收斂
  const lum = (cLum.set(k.bg).r * 0.299 + cLum.set(k.bg).g * 0.587 + cLum.set(k.bg).b * 0.114);
  scrim.style.opacity = String(THREE.MathUtils.clamp(1 - lum * 1.9, 0, 1));
  document.documentElement.style.setProperty('--halo',
    lum > 0.4 ? 'rgba(232,232,234,0.75)' : 'rgba(5,6,13,0.7)');
  typeLayer.style.setProperty('--type-shift', `${(smoothP - 0.5) * -260}px`);

  // 標籤只在拆解時出現，每格重新投影
  const show = e > 0.55;
  labelLayer.style.opacity = show ? String((e - 0.55) / 0.45) : '0';
  if (show) {
    for (let i = 0; i < parts.length; i++) {
      parts[i].getWorldPosition(projected);
      projected.project(camera);
      labels[i].style.transform =
        `translate3d(${(projected.x * 0.5 + 0.5) * innerWidth}px, ${(-projected.y * 0.5 + 0.5) * innerHeight}px, 0)`;
      labels[i].style.opacity = projected.z < 1 ? '1' : '0';
    }
  }

  composer ? composer.render() : renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
  particleMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  readScroll();
});

renderer.render(scene, camera);
step();

requestAnimationFrame(() => {
  frame();
  loader.classList.add('done');
  document.body.classList.add('ready');
  setTimeout(() => { loader.style.display = 'none'; }, 900);
});

/* ---------------- 章節文字進場 ---------------- */
const io = new IntersectionObserver(
  es => es.forEach(e => e.target.classList.toggle('in', e.isIntersecting)),
  { threshold: 0.3 }
);
document.querySelectorAll('.act').forEach(el => io.observe(el));
