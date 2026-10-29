// Clean Slate 风格小样「她睁眼」（分镜 v2 · 28.3–43.8 s）
// 每帧 = 歌曲时间 t 的纯函数：随机数只在初始化时用固定种子；动画全在着色器里按 uT 算。
// 模式：默认 = 实时（点一下跟歌播放）；?t=36.5 = 静帧；?render=1 = 逐帧交给 serve.py 出 mp4。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const Q = new URLSearchParams(location.search);
const RENDER = Q.has('render');
const T0 = +(Q.get('t0') ?? 28.3), T1 = +(Q.get('t1') ?? 43.8), FPS = +(Q.get('fps') ?? 30);
const STILL = Q.has('t') ? +Q.get('t') : null;
const W = RENDER ? 1920 : innerWidth, H = RENDER ? 1080 : innerHeight;
const log = (...a) => { console.log(...a); if (RENDER) fetch('/log', { method: 'POST', body: a.join(' ') }); };
addEventListener('error', e => log('ERROR', e.message, e.filename, e.lineno));

// ---------- 时间锚点（_分析/歌词.json、节拍.json） ----------
const T_LAYERS = [28.33, 29.29, 30.25, 31.23];   // layer, layer, line, line → 穿过一层网
const T_THOUSAND = 32.17, T_ONE = 34.17, T_MINE = 35.05;
const T_BLOW = 36.06;                             // 副歌第一拍
const T_BRAND = 36.295, T_NEW = 36.535, T_EYES = 40.20, T_SEA = 41.46;
const DEFS = `
#define TBLOW ${T_BLOW.toFixed(3)}
#define TMINE ${T_MINE.toFixed(3)}
#define TSEA ${T_SEA.toFixed(3)}
`;

// ---------- 颜色 ----------
const C = {
  bone: new THREE.Vector3(0.93, 0.90, 0.84), pink: new THREE.Vector3(1.0, 0.35, 0.62),
  gold: new THREE.Vector3(1.0, 0.74, 0.30), blue: new THREE.Vector3(0.36, 0.60, 1.0),
  orange: new THREE.Vector3(1.0, 0.46, 0.14),
};

// ---------- 小工具 ----------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ss = x => { x = Math.min(Math.max(x, 0), 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, u) => a + (b - a) * u;
const lerp3 = (a, b, u) => a.map((v, i) => lerp(v, b[i], u));
function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * r()); }
function interp(x, xs, ys) { if (x <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return lerp(ys[i - 1], ys[i], (x - xs[i - 1]) / (xs[i] - xs[i - 1])); return ys[ys.length - 1]; }

// ---------- 渲染器 ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: RENDER });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(33, W / H, 0.05, 400);
const O = [0, 0.2, 8];

// ---------- 点的通用着色器 ----------
const COMMON_U = { uT: { value: 0 }, uPx: { value: H / 1080 }, uSize: { value: 2.4 } };
const VERT_TAIL = `
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float z = max(-mv.z, 0.001);
  gl_Position = projectionMatrix * mv;
  float near = clamp(3.0 / z, 0.3, 4.0);
  float sz = clamp(uSize * uPx * (0.6 + near), 1.0, 16.0 * uPx);
  gl_PointSize = sz;
  vI = b * near * (2.4 / sz) * (2.4 / sz) * 2.2;   // 点变大时总能量不变
  vI *= uPx * uPx * 2.25;                            // 每块屏幕面积的亮度与分辨率无关（按 720p 调的）
  vI *= mix(1.0, 0.18, smoothstep(14.0, 70.0, z));  // 远处的雾：地平线别糊成一条亮线
  vC = col;
}`;
const FRAG = `
varying float vI; varying vec3 vC;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = exp(-dot(d, d) * 14.0);
  gl_FragColor = vec4(vC * vI * a, 1.0);
}`;
function pointsMat(uniforms, body) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uPx: { value: COMMON_U.uPx.value }, uSize: { value: COMMON_U.uSize.value }, ...uniforms },   // 每个材质各一份
    vertexShader: DEFS + `uniform float uT, uPx, uSize;\nvarying float vI; varying vec3 vC;\n` + body + VERT_TAIL,
    fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
function geom(attrs) {
  const g = new THREE.BufferGeometry();
  for (const [k, [arr, n]] of Object.entries(attrs)) g.setAttribute(k, new THREE.BufferAttribute(arr, n));
  return g;
}

// ---------- 海：权重的点阵 ----------
const sea = (() => {
  const r = rng(7), nx = 520, nz = 380, N = nx * nz;
  const pos = new Float32Array(N * 3), ph = new Float32Array(N), tw = new Float32Array(N);
  let i = 0;
  for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++, i++) {
    pos[i * 3] = -42 + 84 * a / (nx - 1) + (r() - 0.5) * 0.12;
    pos[i * 3 + 1] = -1.7;
    pos[i * 3 + 2] = -18 + 108 * b / (nz - 1) + (r() - 0.5) * 0.18;
    ph[i] = r() * 6.2832; tw[i] = r();
  }
  const mat = pointsMat({ uBass: { value: 0 }, uCol: { value: C.bone } }, `
uniform float uBass; uniform vec3 uCol;
attribute float aPh, aTw;
void main() {
  vec3 p = position;
  p.y += 0.10 * sin(p.x * 0.35 + p.z * 0.22 + uT * 1.6 + aPh * 0.2) * (0.5 + 0.8 * uBass);   // 低频是浪
  float b = 0.16 + 0.12 * step(0.92, sin(uT * 2.0 + aPh)) * aTw;                          // 偶尔闪
  float r = length(vec2(p.x, p.z - 8.0));
  if (uT > TBLOW) { float dt = uT - TBLOW; b += 2.6 * exp(-pow(r - 11.0 * dt, 2.0) / 0.9) * exp(-dt * 0.7); }  // 冲击波：一圈，打在海上
  if (uT > TSEA) {                                                                          // 海一圈圈亮起来
    float front = 9.0 * (uT - TSEA);
    b += 0.7 * exp(-pow(r - front, 2.0) / 1.5) + 0.10 * step(r, front);
    float beat = (uT - 41.84) / 0.48;
    if (beat > 0.0) { float k = floor(beat); float sel = floor(aTw * 8.0) == mod(k, 8.0) ? 1.0 : 0.0; b += sel * step(r, front) * 0.8 * exp(-(beat - k) * 4.0); }
  }
  b *= 1.7;
  vec3 col = uCol;
  float hue = fract(aTw * 37.0);
  if (hue < 0.06) { col = hue < 0.02 ? vec3(1.0, 0.45, 0.7) : hue < 0.04 ? vec3(1.0, 0.8, 0.4) : vec3(0.5, 0.7, 1.0); b *= 1.8; }   // 少数点是彩色的`);
  const pts = new THREE.Points(geom({ position: [pos, 3], aPh: [ph, 1], aTw: [tw, 1] }), mat);
  pts.frustumCulled = false; scene.add(pts);
  return { mat };
})();

// ---------- 网：4 层，每个 layer / line 词穿过一层 ----------
const net = (() => {
  const P = [], L = [];
  [-12, -9, -6, -3].forEach((zc, k) => {
    for (let a = 0; a <= 280; a++) for (let b = 0; b <= 180; b++) {
      if (a % 20 && b % 20) continue;
      P.push(-7 + a * 0.05, -4.5 + b * 0.05 + 0.6, zc); L.push(k);
    }
  });
  const mat = pointsMat({ uLA: { value: [0, 0, 0, 0] }, uLC: { value: [C.blue, C.pink, C.gold, C.bone] } }, `
uniform float uLA[4]; uniform vec3 uLC[4];
attribute float aL;
void main() {
  int k = int(aL + 0.5);
  vec3 p = position;
  float b = 1.4 * uLA[k];
  vec3 col = uLC[k];`);
  const pts = new THREE.Points(geom({ position: [new Float32Array(P), 3], aL: [new Float32Array(L), 1] }), mat);
  pts.frustumCulled = false; scene.add(pts);
  return { mat, pts };
})();

// ---------- 几千个方向；只有一根是她的 ----------
const MINE = (() => { const v = [-0.72, 0.46, 0.52], n = Math.hypot(...v); return v.map(x => x / n); })();
const dirs = (() => {
  const r = rng(11), nd = 1400, ns = 90, dense = 900;
  const N = nd * ns + dense;
  const dir = new Float32Array(N * 3), len = new Float32Array(N), seg = new Float32Array(N), col = new Float32Array(N * 3), mine = new Float32Array(N);
  const pal = [C.pink, C.gold, C.blue];
  let i = 0;
  for (let d = 0; d < nd; d++) {
    let v = d === 0 ? MINE : [gauss(r), gauss(r), gauss(r)];
    const n = Math.hypot(...v); v = v.map(x => x / n);
    const L = d === 0 ? 30 : 6 + r() * 24, c = d === 0 ? C.bone : pal[d % 3];
    for (let s = 0; s < ns; s++, i++) {
      dir.set(v, i * 3); len[i] = L; seg[i] = s / (ns - 1); col.set([c.x, c.y, c.z], i * 3); mine[i] = d === 0 ? 1 : 0;
    }
  }
  for (let s = 0; s < dense; s++, i++) { dir.set(MINE, i * 3); len[i] = 30; seg[i] = s / (dense - 1); col.set([C.bone.x, C.bone.y, C.bone.z], i * 3); mine[i] = 1; }
  const mat = pointsMat({ uGrow: { value: 0 }, uFO: { value: 1 }, uFA: { value: 1 }, uMA: { value: 0 }, uO: { value: new THREE.Vector3(...O) } }, `
uniform float uGrow, uFO, uFA, uMA; uniform vec3 uO;
attribute vec3 aDir, aCol; attribute float aLen, aSeg, aMine;
void main() {
  vec3 p = uO + aDir * aLen * uGrow * aSeg;
  float b = aMine > 0.5 ? (0.25 + 1.4 * uMA) * uFA : 0.32 * uFO * uFA;
  vec3 col = aCol;`);
  const pts = new THREE.Points(geom({ position: [new Float32Array(N * 3), 3], aDir: [dir, 3], aLen: [len, 1], aSeg: [seg, 1], aCol: [col, 3], aMine: [mine, 1] }), mat);
  pts.frustumCulled = false; scene.add(pts);
  return { mat, pts };
})();

// ---------- 她：原创轮廓（短发、宽毛衣、漂浮），粒子从海里被叫来 ----------
function silhouette(n) {
  const Wc = 400, Hc = 640, cv = document.createElement('canvas'); cv.width = Wc; cv.height = Hc;
  // 先在小画布上画（会糊一点），再阈值化 → 边缘圆润，不像机器人
  const sk = document.createElement('canvas'); sk.width = Wc; sk.height = Hc;
  const k = sk.getContext('2d'); k.fillStyle = '#fff'; k.strokeStyle = '#fff'; k.lineCap = 'round'; k.lineJoin = 'round';
  const blob = (cx, cy, rx, ry, rot = 0) => { k.beginPath(); k.ellipse(cx, cy, rx, ry, rot, 0, 6.2832); k.fill(); };
  const limb = (pts, w) => { k.lineWidth = w; k.beginPath(); pts.forEach(([x, y], i) => i ? k.lineTo(x, y) : k.moveTo(x, y)); k.stroke(); };
  // 头：圆脸 + 蓬蓬的短发（Q 版比例，头大）
  blob(200, 150, 92, 98);
  blob(200, 120, 108, 92);                         // 头发顶
  blob(118, 175, 30, 52, 0.25); blob(282, 175, 30, 52, -0.25);   // 两侧发梢往里卷
  blob(150, 92, 34, 24, -0.5);                     // 一撮翘起来的呆毛底
  limb([[168, 52], [150, 22], [176, 12]], 9);     // 呆毛
  // 身子：宽大的毛衣，下摆圆
  k.beginPath(); k.moveTo(150, 236); k.quadraticCurveTo(116, 300, 128, 382); k.quadraticCurveTo(200, 404, 272, 382); k.quadraticCurveTo(284, 300, 250, 236); k.closePath(); k.fill();
  // 袖子：一只手往外张开、一只贴着身子（不对称才自然），袖口盖住手
  limb([[156, 252], [118, 312], [96, 352]], 38); blob(92, 360, 22, 20);
  limb([[246, 252], [270, 318], [262, 372]], 36); blob(262, 378, 20, 19);
  // 腿：短，一条直、一条弯起来（漂浮）
  limb([[176, 380], [172, 470], [168, 520]], 30); blob(166, 530, 20, 13);
  limb([[226, 380], [244, 448], [278, 478]], 30); blob(286, 482, 19, 13, -0.6);
  const g = cv.getContext('2d'); g.filter = 'blur(3px)'; g.drawImage(sk, 0, 0); g.filter = 'none';
  const d = g.getImageData(0, 0, Wc, Hc).data, inside = (x, y) => x >= 0 && y >= 0 && x < Wc && y < Hc && d[(y * Wc + x) * 4] > 127;
  const all = [], edge = [];
  for (let y = 0; y < Hc; y++) for (let x = 0; x < Wc; x++) if (inside(x, y)) {
    all.push([x, y]);
    if (!inside(x - 3, y) || !inside(x + 3, y) || !inside(x, y - 3) || !inside(x, y + 3)) edge.push([x, y]);
  }
  const r = rng(3), s = 2.8 / Hc, out = new Float32Array(n * 3), isEdge = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const src = i < n * 0.45 ? edge : all, [x, y] = src[Math.floor(r() * src.length)];
    isEdge[i] = i < n * 0.45 ? 1 : 0;
    out[i * 3] = (x + r() - Wc / 2) * s + O[0];
    out[i * 3 + 1] = -(y + r() - Hc / 2) * s + 0.15 + O[1] - 0.2;
    out[i * 3 + 2] = (r() - 0.5) * 0.25 + O[2];
  }
  const eye = (x, y) => [(x - Wc / 2) * s + O[0], -(y - Hc / 2) * s + 0.15 + O[1] - 0.2, O[2]];
  return { pts: out, edge: isEdge, face: { eyes: [eye(170, 168), eye(230, 168)], blush: [eye(146, 196), eye(254, 196)], mouth: eye(200, 206) } };
}

const her = (() => {
  const n = 26000, sil = silhouette(n), r = rng(5);
  const src = new Float32Array(n * 3), mid = new Float32Array(n * 3), jit = new Float32Array(n * 3), del = new Float32Array(n), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    src.set([(r() - 0.5) * 24, -1.7, 2 + r() * 22], i * 3);                        // 从她脚下那片海里来
    const k = 4 + r() * 14;                                                          // 经过「她的那根线」
    mid.set([O[0] + MINE[0] * k + (r() - 0.5) * 0.4, O[1] + MINE[1] * k + (r() - 0.5) * 0.4, O[2] + MINE[2] * k + (r() - 0.5) * 0.4], i * 3);
    jit.set([r() - 0.5, r() - 0.5, r() - 0.5], i * 3); del[i] = r() * 0.35; ph[i] = r() * 6.2832;
  }
  const g = geom({ position: [sil.pts, 3], aSrc: [src, 3], aMid: [mid, 3], aJit: [jit, 3], aDelay: [del, 1], aPh: [ph, 1], aEdge: [sil.edge, 1] });
  const mats = [[0, 1], [1 / 90, 0.35], [2 / 90, 0.35]].map(([lag, tr]) => {
    const m = pointsMat({ uLag: { value: lag }, uTrail: { value: tr }, uKick: { value: 0 }, uO: { value: new THREE.Vector3(...O) }, uCol: { value: C.bone } }, `
uniform float uLag, uTrail, uKick; uniform vec3 uO, uCol;
attribute vec3 aSrc, aMid, aJit; attribute float aDelay, aPh, aEdge;
void main() {
  float ts = uT - uLag;
  float u = clamp((ts - TBLOW - aDelay) / 0.45, 0.0, 1.0); u = u * u * (3.0 - 2.0 * u);
  float lift = smoothstep(TMINE, TBLOW, uT);
  vec3 s = aSrc + vec3(0.0, 0.6 * lift, 0.0);
  vec3 p = (1.0 - u) * (1.0 - u) * s + 2.0 * (1.0 - u) * u * aMid + u * u * position;   // 海 → 那根线 → 她
  float formed = step(1.0, u);
  float breathe = 1.0 + 0.012 * sin(uT * 6.2832 / 3.84);                                // 两小节一次呼吸
  if (formed > 0.5) p = uO + (p - uO) * breathe + 0.006 * sin(aPh + uT * 3.0) * aJit;
  p.y += 0.06 * sin(uT * 6.2832 / 3.84) * smoothstep(TBLOW + 0.5, TBLOW + 2.0, uT);                    // 漂浮
  float b = (0.10 + 0.07 * uKick) * mix(0.45, 1.4, aEdge) * mix(7.0, 1.0, formed) * uTrail;   // 拍子只打在她身上；边亮里淡
  if (uT < TBLOW) b = 0.35 * lift * uTrail;
  vec3 col = uCol;`);
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
    return { m, pts };
  });
  return { mats, face: sil.face };
})();

// ---------- 天上的星星（很远、很淡、慢慢眨） ----------
const sky = (() => {
  const r = rng(21), n = 9000, pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const az = (r() - 0.5) * 2.6, el = Math.pow(r(), 1.6) * 0.75 + 0.02, R = 120;
    pos.set([Math.sin(az) * Math.cos(el) * R, Math.sin(el) * R - 1.7, Math.cos(az) * Math.cos(el) * R + 8], i * 3); ph[i] = r() * 6.2832;
  }
  const mat = pointsMat({ uCol: { value: C.bone } }, `
uniform vec3 uCol;
attribute float aPh;
void main() {
  vec3 p = position;
  float b = 2.2 * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uT * 1.3 + aPh * 7.0), 4.0)) * fract(aPh * 13.0);
  vec3 col = fract(aPh * 5.0) < 0.1 ? vec3(1.0, 0.75, 0.55) : uCol;`);
  const pts = new THREE.Points(geom({ position: [pos, 3], aPh: [ph, 1] }), mat);
  pts.frustumCulled = false; scene.add(pts);
  return { mat };
})();

// ---------- 她身边绕着的小光尘（成形后才有，转得很慢） ----------
const dust = (() => {
  const r = rng(31), n = 420, a = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { a.set([0.9 + r() * 1.3, (r() - 0.35) * 2.6, 0.15 + r() * 0.5], i * 3); ph[i] = r() * 6.2832; }
  const mat = pointsMat({ uO: { value: new THREE.Vector3(...O) }, uCol: { value: C.bone } }, `
uniform vec3 uO, uCol;
attribute vec3 aOrb; attribute float aPh;
void main() {
  float th = aPh + uT * aOrb.z;
  vec3 p = uO + vec3(cos(th) * aOrb.x, aOrb.y * 0.5 + 0.1 * sin(uT * 0.8 + aPh) + 0.06 * sin(uT * 6.2832 / 3.84), sin(th) * aOrb.x * 0.6);
  float b = 0.5 * smoothstep(TBLOW + 0.6, TBLOW + 2.5, uT) * (0.4 + 0.6 * pow(0.5 + 0.5 * sin(uT * 2.0 + aPh * 3.0), 3.0));
  vec3 col = fract(aPh * 3.0) < 0.15 ? vec3(1.0, 0.7, 0.45) : uCol;`);
  const pts = new THREE.Points(geom({ position: [new Float32Array(n * 3), 3], aOrb: [a, 3], aPh: [ph, 1] }), mat);
  pts.frustumCulled = false; scene.add(pts);
  return { mat };
})();

// ---------- 脸：眼睛（全片第一处暖色）+ 高光 + 腮红 + 慢慢出现的小微笑 ----------
const eyes = (() => {
  const r = rng(13), P = [], OFF = [], K = [];
  const add = (base, kind, n) => { for (let i = 0; i < n; i++) { P.push(...base); OFF.push(gauss(r), gauss(r), r()); K.push(kind); } };
  her.face.eyes.forEach(e => { add(e, 0, 500); add([e[0] + 0.012, e[1] + 0.012, e[2] - 0.01], 1, 60); });
  her.face.blush.forEach(e => add(e, 2, 500));
  add(her.face.mouth, 3, 260);
  const mat = pointsMat({ uOpen: { value: 0 }, uSmile: { value: 0 }, uEye: { value: C.orange }, uHi: { value: C.bone }, uBlush: { value: C.pink } }, `
uniform float uOpen, uSmile; uniform vec3 uEye, uHi, uBlush;
attribute vec3 aOff; attribute float aK;
void main() {
  vec3 p = position; float b = 0.0; vec3 col = uEye;
  p.y += 0.06 * sin(uT * 6.2832 / 3.84) * smoothstep(TBLOW + 0.5, TBLOW + 2.0, uT);
  if (aK < 0.5) { p += aOff * vec3(0.0075, 0.0012 + 0.0105 * uOpen, 0.0); b = 0.32 * uOpen; }                 // 眼：竖椭圆，从一条缝睁开
  else if (aK < 1.5) { p += aOff * vec3(0.0018, 0.0018, 0.0); b = 0.9 * smoothstep(0.5, 1.0, uOpen); col = uHi; }  // 高光
  else if (aK < 2.5) { p += aOff * vec3(0.022, 0.008, 0.0); b = 0.05 * uOpen; col = uBlush; }                 // 腮红
  else { float th = 3.14159 * (0.5 + (aOff.z - 0.5) * 0.62 * uSmile); p += vec3(cos(th) * 0.05, -sin(th) * 0.022 + 0.022, 0.0) + aOff * 0.0012; b = 0.35 * step(0.01, uSmile); col = uHi; }  // 微笑
  vec3 colOut = col;
  col = colOut;`);
  mat.uniforms.uSize.value = 1.5;
  const pts = new THREE.Points(geom({ position: [new Float32Array(P), 3], aOff: [new Float32Array(OFF), 3], aK: [new Float32Array(K), 1] }), mat);
  pts.frustumCulled = false; scene.add(pts);
  return { mat, pts };
})();

// ---------- 大字（屏幕空间叠层，进 bloom 之前） ----------
const overlay = new THREE.Scene(), ocam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -1, 1);
// 小号、宽字距、放在她脚下的一行：字是这个世界里的东西，不抢她
const FS = Math.round(H * 0.052), SP = Math.round(FS * 0.45);
function word(text) {
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  const font = `600 ${FS}px Bahnschrift, "Segoe UI", sans-serif`;
  g.font = font; g.letterSpacing = `${SP}px`;
  cv.width = Math.ceil(g.measureText(text).width) + 40; cv.height = FS + 40;
  g.font = font; g.letterSpacing = `${SP}px`; g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(text, 20, cv.height / 2);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, color: new THREE.Color(0.93, 0.90, 0.84), opacity: 0 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(cv.width, cv.height), mat);
  overlay.add(m); m.userData.w = cv.width;
  return m;
}
const wB = word('BRAND'), wN = word('NEW'), gap = FS * 0.9, tot = wB.userData.w + gap + wN.userData.w;
wB.position.set(-tot / 2 + wB.userData.w / 2, -H * 0.36, 0); wN.position.set(tot / 2 - wN.userData.w / 2, -H * 0.36, 0);
const words = [[wB, T_BRAND], [wN, T_NEW]];

// ---------- 后期：bloom + 色调 + 暖色光晕 + 颗粒 + 暗角 ----------
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const op = new RenderPass(overlay, ocam); op.clear = false; composer.addPass(op);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.85, 0.55, 0.12));
const finalPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
uniform sampler2D tDiffuse; uniform float uT; uniform vec2 uRes; varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 x = texture2D(tDiffuse, vUv).rgb;
  vec3 y = 1.0 - exp(-1.25 * x);
  y += max(x - 0.8, 0.0) * vec3(0.22, 0.06, 0.02);                 // 高光边上一点暖色（胶片光晕）
  vec2 q = vUv * 2.0 - 1.0; q.x *= uRes.x / uRes.y;
  y *= clamp(1.0 - 0.35 * dot(q, q) / 2.0, 0.0, 1.0);
  y += vec3(0.010, 0.011, 0.016);                                   // 墨黑底
  float n = hash(floor(vUv * uRes / 2.0) + fract(uT * 37.0) * 91.0) - 0.5;
  y += 0.045 * n * (1.2 - dot(y, vec3(0.333)));
  gl_FragColor = vec4(clamp(y, 0.0, 1.0), 1.0);
}`,
});
composer.addPass(finalPass);

// ---------- 相机 ----------
function cam(t) {
  const sway = 0.13 * Math.sin(t * 0.6);
  if (t < 33.2) {
    const z = interp(t, [28.3, ...T_LAYERS, 33.2], [-15, -12, -9, -6, -3, -0.6]);
    return [[sway, 0.9, z], [0, -0.1, z + 10]];        // 贴着海面上方滑行，海占下面三分之二
  }
  if (t < T_EYES) return [[sway, 0.9, lerp(-0.6, 0, ss((t - 33.2) / 3))], [0, lerp(-0.1, 0.2, ss((t - 33.2) / 2)), 8]];
  if (t < T_SEA) { const u = ss((t - T_EYES) / 1.0); return [lerp3([0.13 * Math.sin(T_EYES * 0.6), 0.9, 0], [0, 1.32, 5.6], u), lerp3(O, [0, 1.0, 8], u)]; }
  const u = ss((t - T_SEA) / 2.0);
  return [lerp3([0, 1.32, 5.6], [0, 2.6, -2.5], u), lerp3([0, 1.0, 8], [0, -0.4, 14], u)];
}

// ---------- 一帧 ----------
let AUD = null;
const env = (k, t) => AUD ? AUD[k][Math.min(Math.max(Math.floor(t * AUD.fps), 0), AUD[k].length - 1)] : 0;
function draw(t) {
  const [p, tg] = cam(t); camera.position.set(...p); camera.lookAt(...tg);
  const kick = env('kick', t), bass = env('bass', t);
  for (const m of [sea.mat, net.mat, dirs.mat, eyes.mat, sky.mat, dust.mat, ...her.mats.map(h => h.m)]) m.uniforms.uT.value = t;
  sea.mat.uniforms.uBass.value = bass;
  net.mat.uniforms.uLA.value = T_LAYERS.map(tl => ss((t - (tl - 1.6)) / 0.8) * (1 - ss((t - tl - 0.15) / 0.3)));
  dirs.pts.visible = t > T_THOUSAND - 0.05 && t < T_BLOW + 0.6;
  dirs.mat.uniforms.uGrow.value = ss((t - T_THOUSAND) / 0.55);
  dirs.mat.uniforms.uFO.value = 1 - ss((t - T_ONE) / (T_MINE - T_ONE));
  dirs.mat.uniforms.uFA.value = 1 - ss((t - T_BLOW) / 0.4);
  dirs.mat.uniforms.uMA.value = ss((t - T_ONE) / 0.6);
  for (const h of her.mats) { h.pts.visible = t > T_MINE; h.m.uniforms.uKick.value = kick; }
  eyes.pts.visible = t > T_EYES - 0.05;
  eyes.mat.uniforms.uOpen.value = ss((t - T_EYES) / 0.5);
  eyes.mat.uniforms.uSmile.value = ss((t - T_SEA + 0.2) / 0.8);   // 「the sea's lighting up」时笑
  for (const [m, tw] of words) {
    const a = t >= tw && t < 38.4 ? ss((t - tw) / 0.06) * (1 - ss((t - 37.9) / 0.5)) : 0;
    m.material.opacity = a; m.visible = a > 0.001;
    m.scale.setScalar(1 + 0.08 * (1 - ss((t - tw) / 0.12)));
  }
  finalPass.uniforms.uT.value = t;
  composer.render();
}

// ---------- 启动 ----------
AUD = await (await fetch('audio.json')).json();
const ui = document.getElementById('ui');
if (RENDER) {
  ui.remove();
  const n = Math.round((T1 - T0) * FPS), gl = renderer.getContext(), buf = new Uint8Array(W * H * 4);
  const out = Q.get('out') ?? '-5_Clean Slate/样片/风格小样_她睁眼_v1.mp4';
  await fetch(`/start?w=${W}&h=${H}&fps=${FPS}&t0=${T0}&t1=${T1}&out=${encodeURIComponent(out)}`, { method: 'POST' });
  for (let i = 0; i < n; i++) {
    draw(T0 + i / FPS);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    for (let k = 0; ; k++) {                       // 偶发的连接失败：重试同一帧（服务器按帧号去重）
      try { await fetch('/frame?i=' + i, { method: 'POST', body: buf }); break; }
      catch (e) { if (k > 20) throw e; await new Promise(r => setTimeout(r, 300)); }
    }
  }
  await fetch('/done?quit=' + (Q.has('quit') ? 1 : ''), { method: 'POST' });
  log('render done', n);
} else if (STILL !== null) {
  draw(STILL); ui.innerHTML = `<b>${STILL.toFixed(2)} s</b>`;
} else {
  const audio = new Audio('../-5_Clean Slate/Clean Slate.wav');
  let playing = false;
  const start = () => { audio.currentTime = T0; audio.play(); playing = true; };
  addEventListener('click', () => playing ? null : start());
  addEventListener('keydown', e => {
    if (e.code === 'Space') { audio.paused ? audio.play() : audio.pause(); }
    if (e.code === 'ArrowRight') audio.currentTime += 1;
    if (e.code === 'ArrowLeft') audio.currentTime -= 1;
  });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  const loop = () => {
    let t = playing ? audio.currentTime : T0 + (performance.now() / 1000) % 0.001;
    if (playing && t > T1) { audio.currentTime = T0; t = T0; }
    draw(t); ui.innerHTML = `<b>${t.toFixed(2)} s</b> · 空格暂停 · ←/→ 跳 1 s`;
    requestAnimationFrame(loop);
  };
  loop();
}
