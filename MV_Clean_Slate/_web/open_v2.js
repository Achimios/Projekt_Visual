// Clean Slate · 开场 v2（0–28.3 s）—— 按 Leo 的反馈（_反馈/Leo_反馈_全片v1.md）重做：
//   0101 时背景数据流在滚 → Lights On 世界由下往上展开 → 她蜷着漂在「数字组成的海」里（particle_sea.py 的 JS 版：
//   拉格朗日标记点跟着 Gerstner 波走，亮度靠投影密度 + 坡度）→ 一行 prompt 从天上掉进海里砸出环形波 →
//   七个 token 浮在海面、海说 hi → token 碎成 embedding 珠子、珠子变问题、问题沉下去成种子 →
//   三个注意力头（粉 / 金 / 蓝）睁眼，注意力线连到每个 token，右边是真算出来的 softmax 热图；
//   搜索光束扫海 → 找到她 → 逐行扫描她（clue）→ 推进到她身上，接 28.3 s 的 Layer by layer。
// 规则：每帧 = 歌曲时间 t 的纯函数；鼓点不推全局抖动，运动都有指向（镜头跟着下落的那行字、光束朝目标收拢）。
// 素材是插槽：她 = ASSET.girl（任何图，加载时按 ROWS 行像素化；黑底自动抠），换图不改动画。
import { makeLook } from './look.js';
const Q = new URLSearchParams(location.search);
const RENDER = Q.has('render');
const T0 = +(Q.get('t0') ?? 0), T1 = +(Q.get('t1') ?? 28.4), FPS = +(Q.get('fps') ?? 30);
const STILL = Q.has('t') ? +Q.get('t') : null;
const W = 1920, H = 1080;
const log = (...a) => { console.log(...a); if (RENDER) fetch('/log', { method: 'POST', body: a.join(' ') }); };
addEventListener('error', e => log('ERROR', e.message, e.lineno));

// ---------- 素材插槽 ----------
// 默认用 Seedream 生成的蜷缩漂浮图（黑底，加载时抠）；?girl=px2/shot1_L2.png 换回旧 proxy
const ASSET = Q.has('girl') ? { girl: Q.get('girl'), rows: +(Q.get('rows') ?? 94), keyBlack: Q.has('key') }
  : { girl: '../素材/生成_场景_3/float_a.png', rows: +(Q.get('rows') ?? 110), keyBlack: true };

// ---------- 颜色 / 工具 ----------
const C = {
  ink: [6, 7, 16], night: [12, 14, 38], indigo: [30, 22, 92], violet: [110, 70, 230],
  bone: [236, 232, 222], white: [255, 255, 255], pink: [255, 61, 154], gold: [255, 196, 64], blue: [70, 150, 255],
  cyan: [61, 224, 255], orange: [255, 138, 42], lime: [214, 255, 74],
};
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mixc = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * u));
const BIG = s => `900 ${s}px "Arial Black", "Archivo Black", sans-serif`;
const MONO = s => `${s}px "Cascadia Mono", Consolas, monospace`;
const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
const lerp = (a, b, u) => a + (b - a) * u;
const hash = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const hash2 = (a, b) => hash(a * 127.1 + b * 311.7);
const outExpo = u => (u = clamp(u)) >= 1 ? 1 : 1 - Math.pow(2, -10 * u);
const inExpo = u => (u = clamp(u)) <= 0 ? 0 : Math.pow(2, 10 * u - 10);
const inOut = u => { u = clamp(u); return u * u * (3 - 2 * u); };
const outBack = (u, s = 1.7) => { u = clamp(u) - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
const prog = (t, t0, d, f = outExpo) => f((t - t0) / d);
const pulse = (t, t0, hl) => t < t0 ? 0 : Math.pow(0.5, (t - t0) / hl);
// 临界阻尼弹簧（particle_sea.py 同款）：从 e0 出发、无初速，u 秒后剩下的偏移比例
const spring = (u, w) => u <= 0 ? 1 : (1 + w * u) * Math.exp(-w * u);
function heat(age, cool = C.bone) {
  if (age < 0) return C.white;
  if (age < 0.12) return mixc(C.white, C.orange, age / 0.12);
  return mixc(C.orange, cool, clamp((age - 0.12) / 0.18));
}

// ---------- 画布 ----------
// 场景画在 LOOK.src 上，每帧过一遍 look.js（bloom / 颗粒 / 肩）再到屏幕；?nolook 关掉做对比
const LOOK = makeLook(W, H, { render: RENDER, vignette: 0.12, grain: 0.04, bloom: Q.has('nolook') ? 0 : 0.5, halation: Q.has('nolook') ? 0 : 0.2 });
const cv = LOOK.src, ctx = LOOK.sctx;
const outCv = document.createElement('canvas'); outCv.width = W; outCv.height = H; document.body.appendChild(outCv);
const oc = outCv.getContext('2d', { willReadFrequently: true });
// v5：上一帧的备份（甩镜时拿来做一帧残影 smear）
const prevCv = document.createElement('canvas'); prevCv.width = W; prevCv.height = H;
const prevCtx = prevCv.getContext('2d');
let prevReady = false;

// ---------- 数据 ----------
const AUD = await (await fetch('audio.json')).json();
const RAW = await (await fetch('words_snap.json')).json();
const WORDS = RAW.map(([w, a, b]) => ({ w: w.replace(/[^A-Za-z']/g, '').toUpperCase(), t0: a, t1: b }));
const LYFIX = [[8, 11, 'THRUST', 'DUST'], [8, 11, 'DAY', 'DATA'], [8, 11, 'TO', ''], [8, 11, 'SEE', 'SEA']];
for (const [a, b, from, to] of LYFIX) for (const w of WORDS) if (w.t0 >= a && w.t0 < b && w.w === from) w.w = to;
for (let i = WORDS.length - 1; i >= 0; i--) if (WORDS[i].w === '') WORDS.splice(i, 1);
const env = (k, t) => AUD[k][clamp(Math.floor(t * AUD.fps), 0, AUD[k].length - 1)];
const wt = (w, after) => (WORDS.find(x => x.w === w && x.t0 > after) ?? { t0: after }).t0;

// 关键时刻（都从歌词里查，不写死秒数）
const T = {
  z1: wt('ZERO', 4), o1: wt('ONE', 4.5), z2: wt('ZERO', 4.75), o2: wt('ONE', 5),
  lights: wt('LIGHTS', 7), dust: wt('DUST', 9), billion: wt('BILLION', 10), me: wt('ME', 12),
  then: wt('THEN', 12.5), falling: wt('FALLING', 13), sky: wt('SKY', 14), seven: wt('SEVEN', 14.4),
  sea: wt('SEA', 15.6), hi: wt('HI', 16), broke: wt('BROKE', 16.8), bead: wt('BEAD', 18), question: wt('QUESTION', 19),
  seed: wt('SEED', 20), eyes: wt('EYES', 20.5), pink: wt('PINK', 21.8), gold: wt('GOLD', 22.3), blue: wt('BLUE', 23.5),
  looking: wt('LOOKING', 24.3), girl: wt('GIRL', 25), looking2: wt('LOOKING', 25.6), clue: wt('CLUE', 27.4), layer: 28.326,
};
// 歌词分行（行首时刻）
const LINE_STARTS = [T.lights, T.dust - 0.25, T.billion, T.then, T.seven, wt('EVERY', 16.4), wt('EVERY', 18.4), T.eyes, T.looking, T.layer];

// ---------- 她：任意图 → 按行数像素化的精灵 ----------
async function sprite(src, rows, keyBlack) {
  const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  const h = Math.min(rows, im.height), w = Math.round(im.width * h / im.height);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h);
  if (keyBlack) {                       // 黑底：从四边往里洪泛，只抠和边缘连通的暗色（她的黑外套被轮廓围住，不会被抠掉）
    const dark = i => Math.max(d.data[i * 4], d.data[i * 4 + 1], d.data[i * 4 + 2]) < 26;
    const seen = new Uint8Array(w * h), st = [];
    for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
    while (st.length) {
      const i = st.pop(); if (seen[i] || !dark(i)) continue; seen[i] = 1; d.data[i * 4 + 3] = 0;
      const x = i % w, y = (i / w) | 0;
      if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1); if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w);
    }
  }
  for (let i = 0; i < d.data.length; i += 4) d.data[i + 3] = d.data[i + 3] > 140 ? 255 : 0;   // 硬边
  g.putImageData(d, 0, 0);
  // 再做一张纯色剪影（给发光 / 选中描边用）
  const sil = document.createElement('canvas'); sil.width = w; sil.height = h;
  const sg = sil.getContext('2d'); sg.drawImage(c, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#fff'; sg.fillRect(0, 0, w, h);
  return { img: c, sil, w, h };
}
const GIRL = await sprite(ASSET.girl, ASSET.rows, ASSET.keyBlack);
// 序列帧精灵：每帧像素化后按剪影外框对齐（别让她在格子之间跳）
function withBox(s) {
  const d = s.img.getContext('2d').getImageData(0, 0, s.w, s.h).data; let x0 = s.w, y0 = s.h, x1 = 0, y1 = 0;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (d[(y * s.w + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { ...s, bx: (x0 + x1) / 2, by: (y0 + y1) / 2, bh: y1 - y0 + 1 };
}
// ① 已经抠好的透明 PNG 序列（首选：4_Eidolon/tools/matte.py = BiRefNet 抠的，光效不会被当成人）
const spriteList = async (urls, pxRows) => Promise.all(urls.map(async u => withBox(await sprite(u, pxRows, false))));
// ② 兜底：九宫格整张图等分切开，黑底洪泛抠（亮的光效会被当成人留下）
async function spriteGrid(src, cols, rows, pxRows) {
  const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  const pw = im.width / cols, ph = im.height / rows, frames = [];
  for (let k = 0; k < cols * rows; k++) {
    const c = document.createElement('canvas'); c.width = Math.floor(pw) - 16; c.height = Math.floor(ph) - 16;
    c.getContext('2d').drawImage(im, (k % cols) * pw + 8, Math.floor(k / cols) * ph + 8, c.width, c.height, 0, 0, c.width, c.height);
    frames.push(withBox(await sprite(c.toDataURL(), pxRows, true)));
  }
  return frames;
}
// 素材插槽：换更好的图 / 视频帧 / 3D 渲染，只要换这一行的路径（透明 PNG 序列，帧数随意）
const WAKE_FRAMES = Array.from({ length: 9 }, (_, k) => `../素材/生成_九宫格/wake_a_帧_alpha/${String(k).padStart(6, '0')}_rgba.png`);
const WAKE = Q.has('girl') ? null : Q.has('gridkey') ? await spriteGrid('../素材/生成_九宫格/wake_a.png', 3, 3, 110) : await spriteList(WAKE_FRAMES, 110);
// 用哪一帧：平时 1–3 帧循环（头发在飘，一秒 4 张，日漫的「三拍一张」）；looking for the clue 时一格格走到第 9 帧，clue 上睁眼
function wakeFrame(t) {
  if (t < T.looking2) return [0, 1, 2, 1][Math.floor(t * 4) % 4];
  return Math.min(8, 3 + Math.floor((t - T.looking2) / ((T.clue - T.looking2) / 6)));
}

// ---------- 数字字模（三种亮度色，各 10 个数字）----------
const GW = 20, GH = 32;
const atlas = [C.cyan, C.bone, C.white].map(col => {
  const c = document.createElement('canvas'); c.width = GW * 10; c.height = GH;
  const g = c.getContext('2d'); g.font = MONO(28); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = rgba(col);
  for (let d = 0; d < 10; d++) g.fillText(String(d), d * GW + GW / 2, GH / 2 + 1);
  return c;
});

// ---------- 「hi」的字形遮罩（海面上一块区域里的点会升起来拼出 hi）----------
const HI = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.font = BIG(30); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('hi', 32, 17);
  const d = g.getImageData(0, 0, 64, 32).data; return (u, v) => u >= 0 && u < 64 && v >= 0 && v < 32 && d[(v * 64 + u) * 4 + 3] > 100;
})();

// ---------- 世界：镜头 + 海 ----------
const Z_IMP = 26;                                              // 那行字砸进海的位置（世界 z）
const Z_TOK = 23;                                              // 七个 token 浮着的那一排
const EYE = { y: 8.5, z: 34, xs: [-5, 0, 5], hw: 2.3 };       // 三只眼睛挂在海上方的夜空里（世界坐标，镜头能飞过去）
const TOKX = [-7.2, -4.8, -2.4, 0, 2.4, 4.8, 7.2];
const PROMPT = ['hello', 'world', 'are', 'you', 'there', 'little', 'one'];
const TOKID = [31373, 995, 389, 345, 612, 1310, 530];
const WAVES = [[0.34, 0.05, 0.30, 1.05, 0], [0.20, -0.24, 0.21, 1.45, 1.3], [0.11, 0.38, 0.47, 2.1, 2.1], [0.05, -0.62, 0.88, 2.9, 0.7]];
function ring(x, z, t) {                                       // 砸出来的环形波：色散的波包，短波跑在前面
  if (t < T.sky) return 0;
  const a = t - T.sky, r = Math.hypot(x, z - Z_IMP), front = 5.5 * a;
  const q = r - front;
  return 0.9 * Math.exp(-a * 0.45) * Math.exp(-(q * q) / (1.4 + a * 0.8)) * Math.cos(2.4 * q + 3 * a);
}
function sea(x, z, t) {
  let y = 0, sz = 0;
  for (const [A, kx, kz, w, p] of WAVES) { const ph = kx * x + kz * z - w * t + p; y += A * Math.sin(ph); sz += A * kz * Math.cos(ph); }
  return { y: y + ring(x, z, t), sz };
}
// ---------- 镜头：真 3D 机位（位置 + 看向的点 + 侧倾 + 焦距），关键帧之间 Catmull-Rom 平滑 ----------
// 日漫式穿梭：贴海面低飞、甩镜抬头追那行字、沿 token 一排横移、升起穿过一层网络、在三只眼之间甩、顺着光束俯冲到她、最后推进。
// 镜头从不静止（每段关键帧都带速度）；歌词锚点上再叠一次「进」（2–3 帧加速 + 指数缓，不归零；见 _设计/方法_剪辑与情绪.md §四⅞¾）。
const gz = t => 12 + 0.5 * t;                                  // 她在世界里慢慢往前漂
const KEYS = [
  // [时刻, 机位 xyz, 看向 xyz, 侧倾 rad, 焦距 px]
  [T.lights - 0.2, [0, -1.4, 0], [0, 3.5, 12], 0, 760],                    // 从海面下面往上看（世界由下往上展开）
  [T.lights + 0.9, [0, 1.3, 4], [0, 1.9, 16], 0, 880],                     // 破水而出，贴着海面
  [T.dust + 1.6, [-1.6, 1.0, 8], [1, 2.4, gz(T.dust + 1.6)], 0.035, 900],  // 低飞，侧着绕向她
  [T.then, [-3.2, 1.6, 10], [1.2, 2.6, gz(T.then)], 0.06, 900],
  [T.then + 0.38, [-2.6, 1.7, 10.8], [0, 13, Z_IMP], -0.02, 820],          // 甩镜抬头：找天上那行字
  [T.sky, [-1.2, 2.0, 14.2], [0, 0.4, Z_IMP], -0.03, 920],                 // 跟着它一起落回海面
  [T.seven - 0.05, [-7.5, 1.5, 15.6], [-6.5, 1.0, Z_TOK], 0.04, 900],      // 横甩到 token 一排的最左边
  [T.broke - 0.3, [2.0, 1.6, 16.2], [2.4, 1.4, Z_TOK], -0.03, 900],        // 沿一排横移，词一个个从镜头前过
  [T.bead, [0.6, 2.8, 15.2], [0, 2.2, Z_TOK], 0, 900],
  [T.seed + 0.1, [0, 5.0, 13.6], [0, 0.8, Z_TOK], 0.04, 950],              // 升起俯看：珠子沉下去成种子
  [T.eyes, [0, 5.4, 14.2], [0, 4.5, Z_TOK + 2], 0, 950],
  [T.eyes + 0.85, [0, 7.4, 22.5], [0, EYE.y, EYE.z], 0, 880],              // 火箭式上冲，穿过一层网络，正对夜空
  [T.pink + 0.2, [-1.6, 7.8, 24], [EYE.xs[0], EYE.y, EYE.z], -0.09, 900],  // 甩到粉眼（荷兰角）
  [T.gold + 0.25, [0, 8.3, 25], [EYE.xs[1], EYE.y, EYE.z], 0.02, 900],     // 甩到金眼
  [T.blue + 0.2, [1.6, 7.8, 24], [EYE.xs[2], EYE.y, EYE.z], 0.09, 900],    // 甩到蓝眼
  [T.looking - 0.05, [0, 9.8, 20.5], [0, 6.5, EYE.z], 0, 820],             // 拉开，三只眼同框
  [T.girl, [3.4, 4.2, gz(T.girl) - 8.5], [3.6, 2.4, gz(T.girl)], -0.05, 900], // 顺着光束俯冲到她
  [T.clue, [4.6, 3.0, gz(T.clue) - 6.2], [3.6, 2.5, gz(T.clue)], 0.03, 1000],
  [T.layer + 0.1, [3.7, 2.6, gz(T.layer) - 1.6], [3.6, 2.5, gz(T.layer)], 0, 1500], // 推进到她身上
];
// 「进」：这些词上镜头沿视线方向往前多冲一下
const PUSH = [[T.dust, 0.5], [T.billion, 0.4], [T.seven, 0.4], [T.broke, 0.35], [T.question, 0.3], [T.pink, 0.45], [T.gold, 0.45], [T.blue, 0.45], [T.girl, 0.6], [T.clue, 0.5]];
const cr = (p0, p1, p2, p3, u) => { const u2 = u * u, u3 = u2 * u; return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3); };
function keyAt(t) {
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const k0 = KEYS[Math.max(0, i - 1)], k1 = KEYS[i], k2 = KEYS[i + 1], k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
  const u = clamp((t - k1[0]) / (k2[0] - k1[0]));
  const v = (a, b, c, d) => a.map((_, j) => cr(a[j], b[j], c[j], d[j], u));
  return { pos: v(k0[1], k1[1], k2[1], k3[1]), tgt: v(k0[2], k1[2], k2[2], k3[2]), roll: cr(k0[3], k1[3], k2[3], k3[3], u), F: cr(k0[4], k1[4], k2[4], k3[4], u) };
}
const norm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
function camera(t) {
  const k = keyAt(t);
  let f = norm(k.tgt.map((v, j) => v - k.pos[j]));
  let push = 0; for (const [ta, amt] of PUSH) if (t > ta) push += amt * (1 - Math.exp(-(t - ta) / 0.12)) * Math.exp(-(t - ta) / 1.6);
  const br = breath(t);                                            // ① 手持呼吸（只在不动的段落）
  let pos = k.pos.map((v, j) => v + f[j] * push + br[j]);
  let F = k.F;
  const dz = dollyAmt(t);                                          // ② dolly zoom
  if (dz > 0.001) {
    const zc = Math.hypot(k.tgt[0] - pos[0], k.tgt[1] - pos[1], k.tgt[2] - pos[2]);
    const d = dz * 0.30 * zc;                                      // 往前推进 30% 的距离…
    pos = pos.map((v, j) => v + f[j] * d);
    F = F * (zc - d) / zc;                                         // …同时把焦距收掉，她大小不变、背景被拉开
  }
  // 冲击：那行字砸进海的一下，镜头侧倾抽一下（有方向，衰减）
  const roll = k.roll + 0.05 * pulse(t, T.sky, 0.12) * Math.cos(30 * (t - T.sky)) + br[2] * 0.06;
  const r = norm([f[2], 0, -f[0]]), u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  const pitch = Math.asin(-f[1]);
  return { pos, f, r, u, F, roll, yaw: Math.atan2(f[0], f[2]), hy: H / 2 - F * Math.tan(pitch), t };
}
// ---------- v5 三条手法（👤2026-11-01「现在的镜头运动太棒了，还能再进步吗？」）----------
// ① 手持呼吸：只在**静下来**的段落加极轻微的低频漂移；大动作段落一律 0（克制：不能所有地方都活着）
function breathAmt(t) {
  const a = clamp((t - T.dust) / 0.8) * (1 - clamp((t - T.then - 0.1) / 0.5));      // I was dust in a data sea —— 漂浮
  const b = clamp((t - T.looking2) / 0.5) * (1 - clamp((t - T.clue) / 0.5)) * 0.8;  // looking for the girl —— 搜索的静
  return Math.max(a, b);
}
function breath(t) {
  const a = breathAmt(t) * 0.05;                       // 世界单位，很小
  return [
    a * (Math.sin(t * 1.13 + 1.7) * 0.6 + Math.sin(t * 0.47 + 4.1) * 0.4),
    a * (Math.sin(t * 0.91 + 2.3) * 0.6 + Math.sin(t * 0.39 + 5.2) * 0.4),
    a * 0.5 * Math.sin(t * 0.61 + 0.8),                // 侧倾也跟着呼吸一点
  ];
}
// ② Dolly zoom（推拉反向 / 眩晕变焦）：镜头朝她推近的同时把焦距收掉，
//    她的大小不变、背景被拉开 —— 用在「clue」这一拍（她意识到自己被找到了）。0.95 s 的窗，进出都是缓的。
function dollyAmt(t) {
  const u = (t - (T.clue - 0.18)) / 0.95;
  if (u <= 0 || u >= 1) return 0;
  return Math.sin(Math.PI * u) ** 0.85;
}
// ③ 一帧残影（smear）：甩镜/前冲最快的那几帧，把上一帧横向拉开叠上去。
//    只在角速度真的很快时出现，所以平时看不见 —— 它是「加速的痕迹」，不是滤镜。
function smearAmt(mv) {
  // 实测（2026-10-31 探针）：这一段镜头的角速度峰值约 2.3–2.6 rad/s，前冲分量 1–2.4
  const turn = clamp((mv.ang - 1.3) / 2.5);
  const rush = clamp((mv.fwd - 1.5) / 6) * 0.35;
  return clamp(turn * 0.85 + rush, 0, 1);
}
function applySmear(sm, dir) {
  if (sm < 0.02 || !prevReady) return;
  const k = 1 + 1.5 * sm;                                        // 横向拉开
  const off = (dir >= 0 ? -1 : 1) * W * 0.07 * sm;               // 顺着甩的方向偏一点
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.26 * sm;
  ctx.drawImage(prevCv, 0, 0, W, H, -W * (k - 1) / 2 + off, 0, W * k, H);
  ctx.restore();
}
function snapPrev() { prevCtx.drawImage(cv, 0, 0); prevReady = true; }

const lineY = t => t < T.falling - 0.3 ? 15 : Math.max(0, 15 * (1 - ((t - (T.falling - 0.3)) / (T.sky - T.falling + 0.3)) ** 2));
function project(cam, x, y, z) {
  const d = [x - cam.pos[0], y - cam.pos[1], z - cam.pos[2]];
  const zc = d[0] * cam.f[0] + d[1] * cam.f[1] + d[2] * cam.f[2]; if (zc < 0.5) return null;
  const xc = d[0] * cam.r[0] + d[1] * cam.r[1] + d[2] * cam.r[2], yc = d[0] * cam.u[0] + d[1] * cam.u[1] + d[2] * cam.u[2];
  return { x: W / 2 + xc * cam.F / zc, y: H / 2 - yc * cam.F / zc, k: cam.F / zc, dz: zc };
}

// 海里每个点：世界网格上的固定标记（跟着水走，不跟镜头），远处隔一行取一行
function drawSea(t, cam, { hiAmt = 0, glowX = null } = {}) {
  // 只遍历镜头前方的那块海：沿镜头朝向（水平投影）展开一个扇形
  const s = cam.pos[2], sx = Math.sin(cam.yaw), cz = Math.cos(cam.yaw);
  const zStart = Math.ceil((s - 6) / 0.5), zEnd = Math.floor((s + 62) / 0.5);
  for (let iz = zEnd; iz >= zStart; iz--) {                     // 远到近，近的盖住远的
    const z = iz * 0.5, dz = Math.max(0.5, (z - s) / Math.max(0.3, cz)), far = dz > 20;
    if (far && iz % 2) continue;
    const step = far ? 1 : 0.5, hw = (W * 0.62) / cam.F * dz * 1.25 + 2 + 6 * Math.abs(sx);
    const xc = cam.pos[0] + sx * (z - s) / Math.max(0.3, cz);
    const fade = clamp(1 - dz / 62) ** 0.8;
    for (let x = Math.floor((xc - hw) / step) * step; x <= xc + hw; x += step) {
      const ix = Math.round(x * 2);
      const w = sea(x, z, t);
      let y = w.y, bright = 0.42 + 1.6 * Math.max(0, w.sz) + 0.35 * Math.abs(ring(x, z, t));
      const zz = z;
      if (glowX !== null) { const g = Math.exp(-((x - glowX.x) ** 2 + (z - glowX.z) ** 2) / 6); bright += g * glowX.a; }
      const p = project(cam, x, y, zz); if (!p || p.y < -200 || p.y > H + 200 || p.x < -200 || p.x > W + 200) continue;
      const a = clamp(fade * bright * 0.9 * clamp((p.dz - 0.5) / 1.5)); if (a < 0.03) continue;
      const size = clamp(0.36 * p.k, 1.5, 30), tier = bright > 1.5 ? 2 : bright > 0.85 ? 1 : 0;
      ctx.globalAlpha = a;
      if (size < 6) { ctx.fillStyle = rgba(tier === 0 ? C.cyan : tier === 1 ? C.bone : C.white); ctx.fillRect(p.x - size * 0.35, p.y - size * 0.35, size * 0.7, size * 0.7); }
      else {
        const d = Math.floor(hash2(ix, iz + Math.floor(t * 1.5 + hash2(iz, ix) * 7)) * 10);   // 数字慢慢变（一秒一两次）
        ctx.drawImage(atlas[tier], d * GW, 0, GW, GH, p.x - size * 0.31, p.y - size * 0.5, size * 0.62, size);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function sky(cam) {
  const g = ctx.createLinearGradient(0, cam.hy - H, 0, cam.hy);
  g.addColorStop(0, rgba(C.ink)); g.addColorStop(1, rgba(C.night));
  ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3);
  // 天上很远的数字星：在无穷远，随镜头的偏航 / 俯仰一起移（转镜头时它们横着划过 = 速度感）
  for (let i = 0; i < 220; i++) {
    const x = ((hash(i) * W * 3 - cam.yaw * cam.F) % (W * 3) + W * 3) % (W * 3) - W, y = cam.hy - 40 - hash(i + 500) * H * 2;
    if (y < -H || y > H * 2) continue;
    ctx.fillStyle = rgba(C.bone, 0.08 + 0.25 * hash(i + 900)); ctx.fillRect(x, y, 2, 2);
  }
  // 天上还在下的 0101（开场那场数据雨没停，只是退远了）：只在地平线以上，跟着偏航横移
  ctx.save(); ctx.beginPath(); ctx.rect(-W, -H, W * 3, cam.hy + H); ctx.clip(); ctx.globalAlpha = 0.28;
  ctx.translate(((-cam.yaw * cam.F) % (W / 80 * 8)), 0); rain(cam.t, 0.45); ctx.translate(-W, 0); rain(cam.t + 3, 0.45); ctx.translate(2 * W, 0); rain(cam.t + 7, 0.45);
  ctx.restore(); ctx.globalAlpha = 1;
  // 地平线：一条很细的冷光
  ctx.fillStyle = rgba(C.cyan, 0.18); ctx.fillRect(-W, cam.hy - 1, W * 3, 2);
}
// 一层网络（transformer 的一层）：海上方 y = 6.5 的线框平面，镜头冲上去时从它中间穿过，穿过的地方荡开
const NET_Y = 6.5;
function netLayer(t, cam) {
  const a = clamp((t - T.seed) / 0.5) * (1 - clamp((t - T.looking) / 0.8)); if (a <= 0) return;
  const hole = [cam.pos[0], cam.pos[2]], below = cam.pos[1] < NET_Y;
  ctx.lineWidth = 1.2;
  const yAt = (x, z) => NET_Y + 0.6 * Math.exp(-((x - hole[0]) ** 2 + (z - hole[1]) ** 2) / 8) * (below ? -1 : 1) * clamp((t - T.eyes) / 0.4) * Math.exp(-Math.max(0, t - T.eyes - 0.8) / 0.6);
  for (let pass = 0; pass < 2; pass++) for (let q = -16; q <= 16; q += 2) {
    ctx.beginPath(); let pen = false;
    for (let s = -16; s <= 16; s += 0.5) {
      const x = pass ? q : s, z = 26 + (pass ? s : q);
      const p = project(cam, x, yAt(x, z), z);
      if (!p) { pen = false; continue; }
      pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true;
    }
    ctx.strokeStyle = rgba(C.violet, 0.45 * a); ctx.stroke();
  }
  // 层的名字
  const p = project(cam, -10, NET_Y + 0.2, 20); if (p) { ctx.font = MONO(clamp(0.35 * p.k, 10, 26)); ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.violet, 0.9 * a); ctx.fillText('layer 1 · attention', p.x, p.y); }
}
// 镜头前飘过的数据尘（多平面：离镜头近的又大又快，穿梭感靠它）
function dataDust(t, cam, sp) {
  for (let i = 0; i < 260; i++) {
    const x = (hash(i) - 0.5) * 30, y = 0.6 + hash(i + 1) * 11, z = hash(i + 2) * 46 + 2 + 0.15 * Math.sin(t * 0.5 + i);
    const p = project(cam, x + 0.2 * Math.sin(t * 0.7 + i), y + 0.15 * Math.sin(t * 0.9 + i * 1.3), z); if (!p || p.dz > 22) continue;
    const size = clamp(0.25 * p.k, 2, 90); if (p.x < -size || p.x > W + size || p.y < -size || p.y > H + size) continue;
    const a = clamp((22 - p.dz) / 10) * clamp((p.dz - 0.5) / 2) * 0.6;
    ctx.globalAlpha = a;
    if (sp > 0.15 && size > 8) {                              // 快速运动时近处的尘拉成线（拖影方向 = 屏幕上的运动方向）
      ctx.strokeStyle = rgba(C.cyan, a); ctx.lineWidth = Math.max(1, size * 0.08);
      const dx = (p.x - W / 2) * sp * 0.25, dy = (p.y - H / 2) * sp * 0.25;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - dx, p.y - dy); ctx.stroke();
    }
    ctx.drawImage(atlas[1], Math.floor(hash(i + 5) * 10) * GW, 0, GW, GH, p.x - size * 0.31, p.y - size * 0.5, size * 0.62, size);
  }
  ctx.globalAlpha = 1;
}
// 速度线（日漫的流线 / 集中线）：前冲时从中心放射，甩镜时横向
function speedLines(t, mv) {
  const fw = clamp((mv.fwd - 6) / 20), turn = clamp((mv.ang - 0.6) / 2.5);
  if (fw < 0.02 && turn < 0.02) return;
  ctx.save();
  for (let i = 0; i < 70; i++) {
    const seed = i + Math.floor(t * 30) * 0.37;
    if (fw > 0.02) {
      const ang = hash(seed) * 6.2832, r0 = 420 + hash(seed + 1) * 500, len = 120 + 400 * fw * hash(seed + 2);
      ctx.strokeStyle = rgba(C.bone, 0.35 * fw); ctx.lineWidth = 1 + 2 * hash(seed + 3);
      ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(ang) * r0, H / 2 + Math.sin(ang) * r0); ctx.lineTo(W / 2 + Math.cos(ang) * (r0 + len), H / 2 + Math.sin(ang) * (r0 + len)); ctx.stroke();
    }
    if (turn > 0.02) {
      const y = hash(seed + 7) * H, x = hash(seed + 8) * W, len = 200 + 600 * turn * hash(seed + 9);
      ctx.strokeStyle = rgba(C.bone, 0.22 * turn); ctx.lineWidth = 1 + 1.5 * hash(seed + 4);
      ctx.beginPath(); ctx.moveTo(x, y + mv.dy * 0.0); ctx.lineTo(x + len * Math.sign(mv.dx || 1), y + len * mv.dy / (Math.abs(mv.dx) + 1e-3) * 0.15); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------- 她 ----------
function girlPos(t) {
  const x = lerp(0, 3.6, inOut((t - T.seven) / 2)) + 0.5 * Math.sin(t * 0.31);
  return { x, y: 2.5 + 0.22 * Math.sin(t * 1.05), z: gz(t), rot: 0.06 * Math.sin(t * 0.7) };
}
function drawGirl(t, cam, { alpha = 1, glow = 0.4, found = 0 } = {}) {
  const g = girlPos(t), p = project(cam, g.x, g.y, g.z); if (!p) return null;
  let G = GIRL, ox = 0, oy = 0;
  if (WAKE) { G = WAKE[wakeFrame(t)]; }
  const hpx = 4.6 * p.k * (WAKE ? G.h / G.bh * 0.92 : 1), wpx = hpx * G.w / G.h;
  if (WAKE) { ox = (G.w / 2 - G.bx) / G.w * wpx; oy = (G.h / 2 - G.by) / G.h * hpx; }
  ctx.save(); ctx.translate(p.x + ox, p.y + oy); ctx.rotate(g.rot); ctx.imageSmoothingEnabled = false;
  const GIRL_ = G;   // 这一帧用的精灵
  if (glow > 0) { ctx.shadowColor = rgba(C.cyan, glow); ctx.shadowBlur = 40; ctx.globalAlpha = alpha * 0.5; ctx.drawImage(GIRL_.sil, -wpx / 2, -hpx / 2, wpx, hpx); ctx.shadowBlur = 0; }
  ctx.globalAlpha = alpha; ctx.drawImage(GIRL_.img, -wpx / 2, -hpx / 2, wpx, hpx);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * 0.45; ctx.drawImage(GIRL_.img, -wpx / 2, -hpx / 2, wpx, hpx);   // 原图很暗，提一档
  ctx.globalCompositeOperation = 'source-over';
  if (found > 0) { ctx.globalAlpha = found * 0.22; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(GIRL_.sil, -wpx / 2, -hpx / 2, wpx, hpx); }
  ctx.restore();
  // 她正下方海面上的一道倒影光（光从下面照她）
  return { x: p.x, y: p.y, w: wpx, h: hpx, wx: g.x, wz: g.z };
}

// 「billion little numbers dreaming of me」：海里的数字一个个升起来飞向她（临界阻尼，不过冲）
function dreamers(t, cam, gb) {
  if (t < T.billion - 0.2 || t > T.then + 1.5 || !gb) return;
  const g = girlPos(t);
  for (let i = 0; i < 140; i++) {
    const t0 = T.billion - 0.2 + hash(i) * 1.7, u = t - t0; if (u < 0) continue;
    const sx = (hash(i + 7) - 0.5) * 16, sz = g.z + (hash(i + 13) - 0.5) * 8;
    const tx = g.x + (hash(i + 21) - 0.5) * 1.6, ty = g.y + (hash(i + 33) - 0.5) * 2.6, tz = g.z;
    const e = spring(u, 2.6), sy = sea(sx, sz, t).y;
    const x = tx + (sx - tx) * e, y = ty + (sy - ty) * e + Math.sin(u * 3 + i) * 0.1 * e, z = tz + (sz - tz) * e;
    const p = project(cam, x, y, z); if (!p) continue;
    const a = clamp(u / 0.3) * clamp(e / 0.25);                // 越靠近她越淡 = 被她吸收
    const size = clamp(0.36 * p.k, 4, 26);
    ctx.globalAlpha = a; ctx.drawImage(atlas[2], Math.floor(hash(i + 3) * 10) * GW, 0, GW, GH, p.x - size * 0.31, p.y - size * 0.5, size * 0.62, size);
  }
  ctx.globalAlpha = 1;
}

// 「the sea said hi」：token 那排前面，海里的数字一颗颗站起来，立成一面朝镜头的「hi」，碎开时落回海里
function hiWord(t, cam, amt) {
  if (amt <= 0) return;
  for (let v = 0; v < 32; v += 1.5) for (let u = 0; u < 64; u += 1.5) {
    if (!HI(Math.floor(u), Math.floor(v))) continue;
    const id = u * 97 + v * 13, d = hash(id) * 0.3, k = clamp((amt - d) / 0.7, 0, 1.15);
    const x = -7.5 + u / 64 * 9, z0 = Z_TOK - 2.5 - (32 - v) / 32 * 2, sy = sea(x, z0, t).y;
    const p = project(cam, x, lerp(sy, 0.5 + (1 - v / 32) * 3.4, k), lerp(z0, Z_TOK - 3, k)); if (!p) continue;
    const size = clamp(0.3 * p.k, 4, 22);
    ctx.globalAlpha = clamp(k * 1.4); ctx.drawImage(atlas[2], Math.floor(hash(id + 1) * 10) * GW, 0, GW, GH, p.x - size * 0.31, p.y - size * 0.5, size * 0.62, size);
  }
  ctx.globalAlpha = 1;
}

// ---------- 那行 prompt ----------
function promptLine(t, cam) {
  if (t < T.then - 0.1 || t > T.sky + 0.06) return;
  const y = lineY(t), p = project(cam, 0, y, Z_IMP); if (!p) return;
  const size = 0.55 * p.k, text = PROMPT.join(' ');
  ctx.font = MONO(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const vel = t > T.falling - 0.3 ? (t - (T.falling - 0.3)) / (T.sky - T.falling + 0.3) : 0;
  // 拖尾：往上的速度线（越快越长）
  for (let k = 1; k <= 6; k++) { ctx.fillStyle = rgba(C.cyan, 0.12 * (1 - k / 7)); ctx.fillText(text, p.x, p.y - k * vel * 22); }
  ctx.shadowColor = rgba(C.cyan); ctx.shadowBlur = 18; ctx.fillStyle = rgba(C.white); ctx.fillText('> ' + text, p.x, p.y); ctx.shadowBlur = 0;
}

// ---------- token 筹码 / 珠子 / 种子 ----------
function tokenSpot(j, t, cam, lift = 0.35) {
  const x = TOKX[j], w = sea(x, Z_TOK, t);
  return project(cam, x, w.y + lift, Z_TOK);
}
function tokens(t, cam) {
  if (t < T.seven) return [];
  const spots = [];
  for (let j = 0; j < 7; j++) {
    const born = T.seven + j * 0.11, a = t - born; if (a < 0) continue;
    const p = tokenSpot(j, t, cam); if (!p) continue; spots.push(p);
    const brk = clamp((t - T.broke - j * 0.05) / 0.25);         // 碎开
    if (brk < 1) {                                              // 筹码：从砸落点飞出来落位
      const k = outExpo(a / 0.45), imp = project(cam, 0, 0.3, Z_IMP);
      const x = lerp(imp.x, p.x, k), y = lerp(imp.y, p.y, k) - Math.sin(k * Math.PI) * 60;
      const fs = clamp(0.3 * p.k, 14, 34); ctx.font = MONO(fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(PROMPT[j]).width + fs * 0.8;
      ctx.globalAlpha = 1 - brk;
      ctx.fillStyle = rgba(C.ink, 0.7); ctx.fillRect(x - tw / 2, y - fs * 0.75, tw, fs * 1.5);
      ctx.strokeStyle = rgba(heat(a, C.bone)); ctx.lineWidth = 1.5; ctx.strokeRect(x - tw / 2, y - fs * 0.75, tw, fs * 1.5);
      ctx.fillStyle = rgba(heat(a, C.bone)); ctx.fillText(PROMPT[j], x, y);
      ctx.font = MONO(fs * 0.5); ctx.fillStyle = rgba(C.cyan, 0.8); ctx.fillText('#' + TOKID[j], x, y + fs * 1.15);
      ctx.globalAlpha = 1;
    }
    if (t > T.broke) beads(j, t, cam, p);
  }
  return spots;
}
// embedding：每个 token 碎成一串 8 颗珠子（亮度 = 向量分量），然后每颗变成问号，再沉下去成种子
function beads(j, t, cam, p) {
  const n = 8, bornAll = T.broke + j * 0.05;
  const sinkT = T.seed - 0.45 + j * 0.04;
  for (let i = 0; i < n; i++) {
    const u = t - bornAll - i * 0.06; if (u < 0) continue;
    const val = hash2(j, i) * 2 - 1;
    const col = val > 0 ? mixc(C.cyan, C.white, val) : mixc(C.cyan, C.violet, -val);
    const r = clamp(0.1 * p.k, 4, 14) * (0.7 + 0.5 * Math.abs(val));
    let x = p.x, y = p.y - (i + 1) * r * 2.6 * outBack(u / 0.35);
    let a = 1;
    if (t > sinkT) { const v = t - sinkT - i * 0.03; if (v > 0) { y = lerp(y, p.y + 6, inExpo(v / 0.4)); a = 1 - clamp((v - 0.35) / 0.15); } }
    if (a <= 0) continue;
    ctx.globalAlpha = a; ctx.shadowColor = rgba(col); ctx.shadowBlur = 14;
    ctx.fillStyle = rgba(col); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0;
    if (t > T.question - 0.25 + i * 0.03 && r > 6) { ctx.fillStyle = rgba(C.ink); ctx.font = BIG(r * 1.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', x, y + 1); }
  }
  ctx.globalAlpha = 1;
  // 种子：沉下去的地方冒出一根细芽（之后注意力线就连在这）
  if (t > T.seed - 0.1) {
    const g = outExpo((t - T.seed + 0.1 - j * 0.04) / 0.5), hgt = clamp(0.5 * p.k, 10, 40) * g;
    ctx.strokeStyle = rgba(C.lime, 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y + 4); ctx.lineTo(p.x, p.y + 4 - hgt); ctx.stroke();
    ctx.fillStyle = rgba(C.lime); ctx.fillRect(p.x - 3, p.y + 1 - hgt, 6, 4);
    ctx.font = MONO(14); ctx.textAlign = 'center'; ctx.fillStyle = rgba(C.bone, 0.55 * g); ctx.fillText(PROMPT[j], p.x, p.y + 22);
  }
}

// ---------- 多头注意力 ----------
const HEADS = [
  { name: 'head 0', col: C.pink, word: 'pink', x: 600 },
  { name: 'head 1', col: C.gold, word: 'gold', x: 960 },
  { name: 'head 2', col: C.blue, word: 'blue', x: 1320 },
];
const COLS = [...PROMPT, 'girl'];
// 每个头的打分（logits）：粉 = 位置扫描（局部），金 = 盯第一个 token，蓝 = 发散；「looking for the girl」时 girl 这一列被拉高
function logits(h, t) {
  const L = [];
  for (let j = 0; j < 8; j++) {
    let v;
    if (j === 7) v = -5;
    else if (h === 0) { const p = (t * 1.3) % 7; v = -((j - p) ** 2) / 1.6; }
    else if (h === 1) v = j === 0 ? 2.2 : -0.8 + 0.6 * Math.sin(t * 0.9 + j);
    else v = 0.8 * Math.sin(t * 0.7 + j * 1.9) + 0.4 * Math.sin(t * 1.7 + j);
    if (j === 7) v = lerp(-5, 7, inOut((t - T.looking) / (T.girl - T.looking + 0.1)));
    else v -= 4 * inOut((t - T.looking) / (T.girl - T.looking + 0.1));
    L.push(v);
  }
  return L;
}
const softmax = L => { const m = Math.max(...L), e = L.map(v => Math.exp(v - m)), s = e.reduce((a, b) => a + b); return e.map(v => v / s); };
// 眼睛挂在世界里（EYE），按透视画：镜头飞近就变大，甩过去就从画面里划过
function drawEye(h, t, cam, look) {
  const E = HEADS[h], t0 = T[E.word];
  if (t < T.eyes - 0.1) return null;
  const P = project(cam, EYE.xs[h], EYE.y, EYE.z); if (!P) return null;
  const sc = EYE.hw * P.k / 150;                               // 150 = 原来屏幕上的半宽
  if (t < t0 - 0.05) {                                          // 还没轮到它：黑暗里一道闭着的缝（eyes in the dark）
    ctx.save(); ctx.translate(P.x, P.y); ctx.scale(sc, sc); ctx.strokeStyle = rgba(E.col, 0.35 * clamp((t - T.eyes) / 0.6)); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-150, 0); ctx.quadraticCurveTo(0, 8, 150, 0); ctx.stroke(); ctx.restore();
    return null;
  }
  const open = outBack((t - t0) / 0.35, 1.2) * (1 - 0.95 * pulse(t, t0 + 2.6 + h * 0.9, 0.04) * (t > t0 + 2.6 + h * 0.9 ? 1 : 0));
  const w = 150, hh = 58 * clamp(open, 0, 1.15);
  ctx.save(); ctx.translate(P.x, P.y); ctx.scale(sc, sc);
  ctx.shadowColor = rgba(E.col, 0.8); ctx.shadowBlur = 24;
  ctx.strokeStyle = rgba(E.col, 0.95); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(0, -hh * 2, w, 0); ctx.quadraticCurveTo(0, hh * 2, -w, 0); ctx.closePath();
  ctx.stroke(); ctx.shadowBlur = 0; ctx.save(); ctx.clip();
  const dx = clamp((look.x - P.x) / sc / 12, -60, 60), dy = clamp((look.y - P.y) / sc / 30, -10, 26);
  ctx.fillStyle = rgba(E.col, 0.9); ctx.beginPath(); ctx.arc(dx, dy, 40, 0, 6.2832); ctx.fill();
  ctx.fillStyle = rgba(C.ink); ctx.beginPath(); ctx.arc(dx, dy, 17, 0, 6.2832); ctx.fill();
  ctx.fillStyle = rgba(C.white, 0.9); ctx.fillRect(dx + 10, dy - 22, 9, 9);
  ctx.restore();
  ctx.font = MONO(15); ctx.textAlign = 'center'; ctx.fillStyle = rgba(E.col, 0.85 * clamp((t - t0) / 0.3)); ctx.fillText(`${E.name} · ${E.word}`, 0, -hh - 22 - 20);
  // 每只眼背后一圈 Q/K/V 的小刻度环（它是一个注意力头，不是装饰）
  ctx.strokeStyle = rgba(E.col, 0.35); ctx.lineWidth = 1.5;
  for (let k = 0; k < 24; k++) { const a = k / 24 * 6.2832 + t * 0.4 * (h % 2 ? -1 : 1); ctx.beginPath(); ctx.moveTo(Math.cos(a) * 190, Math.sin(a) * 120); ctx.lineTo(Math.cos(a) * (k % 6 ? 200 : 215), Math.sin(a) * (k % 6 ? 127 : 136)); ctx.stroke(); }
  ['Q', 'K', 'V'].forEach((s, k) => { const a = -1.9 + k * 0.38 + t * 0.4 * (h % 2 ? -1 : 1); ctx.fillStyle = rgba(E.col, 0.8); ctx.fillText(s, Math.cos(a) * 232, Math.sin(a) * 150); });
  ctx.restore();
  return { x: P.x + dx * sc, y: P.y + dy * sc, s: sc };
}
function attention(t, cam, seeds, gb) {
  if (t < T.eyes - 0.1) return null;
  const look = gb && t > T.looking ? gb : { x: W / 2, y: H * 0.8 };
  const eyes = HEADS.map((_, h) => drawEye(h, t, cam, look));
  // 注意力线：粗细 = 权重
  eyes.forEach((e, h) => {
    if (!e) return; const wts = softmax(logits(h, t)), age = t - T[HEADS[h].word];
    const targets = [...seeds.slice(0, 7), gb];
    targets.forEach((p, j) => {
      if (!p) return; const wv = wts[j] * clamp(age / 0.5); if (wv < 0.02) return;
      ctx.strokeStyle = rgba(HEADS[h].col, 0.15 + 0.75 * wv); ctx.lineWidth = 0.8 + 7 * wv;
      ctx.beginPath(); ctx.moveTo(e.x, e.y + 30 * e.s); ctx.lineTo(p.x, p.y - (j === 7 ? 0 : 30)); ctx.stroke();
    });
  });
  // 搜索光束（looking for the girl）：每个头一束锥光扫海，到 girl 时收拢到她身上
  if (t > T.looking - 0.1 && t < T.clue + 0.6) {
    eyes.forEach((e, h) => {
      if (!e) return;
      const conv = inOut((t - T.girl + 0.25) / 0.45);
      const sx = W / 2 + Math.sin((t - T.looking) * 2.4 + h * 2.1) * W * 0.36, sy = H * 0.86;
      const tx = lerp(sx, gb ? gb.x : sx, conv), ty = lerp(sy, gb ? gb.y + gb.h * 0.25 : sy, conv), r = lerp(140, gb ? gb.w * 0.6 : 140, conv);
      const g = ctx.createLinearGradient(e.x, e.y, tx, ty); g.addColorStop(0, rgba(HEADS[h].col, 0.0)); g.addColorStop(1, rgba(HEADS[h].col, 0.16));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(e.x, e.y + 30 * e.s); ctx.lineTo(tx - r, ty); ctx.lineTo(tx + r, ty); ctx.closePath(); ctx.fill();
    });
  }
  return eyes;
}
// 右侧热图：三行（头）× 八列（七个 token + girl），格子亮度 = softmax 权重（真算的，不是装饰）
function heatmap(t) {
  if (t < T.eyes + 0.2) return;
  const a = clamp((t - T.eyes - 0.2) / 0.5), x0 = 110, y0 = 470, cw = 46, ch = 36;
  ctx.globalAlpha = a;
  ctx.font = MONO(15); ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.bone, 0.75);
  ctx.fillText('MULTI-HEAD ATTENTION  softmax(QKᵀ/√d)', x0, y0 - 64);
  COLS.forEach((c, j) => { ctx.save(); ctx.translate(x0 + j * cw + cw / 2, y0 - 10); ctx.rotate(-0.9); ctx.textAlign = 'left'; ctx.fillStyle = rgba(j === 7 ? C.white : C.bone, j === 7 ? 0.95 : 0.55); ctx.fillText(c, 0, 0); ctx.restore(); });
  HEADS.forEach((E, h) => {
    if (t < T[E.word]) return;
    const wts = softmax(logits(h, t));
    wts.forEach((wv, j) => {
      ctx.fillStyle = rgba(E.col, 0.08 + 0.92 * wv); ctx.fillRect(x0 + j * cw + 2, y0 + h * ch + 2, cw - 4, ch - 4);
    });
    ctx.fillStyle = rgba(E.col); ctx.textAlign = 'right'; ctx.fillText(`h${h}`, x0 - 10, y0 + h * ch + 26);
    ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.bone, 0.6); ctx.fillText(`max ${COLS[wts.indexOf(Math.max(...wts))]} ${Math.max(...wts).toFixed(2)}`, x0 + 8 * cw + 12, y0 + h * ch + 26);
  });
  ctx.globalAlpha = 1;
}
// 找到她：角标框 + 逐行扫描（clue）+ 读数
function found(t, gb) {
  if (!gb || t < T.girl - 0.05) return;
  const k = outExpo((t - T.girl + 0.05) / 0.3), pad = 30 + 120 * (1 - k);
  const x0 = gb.x - gb.w / 2 - pad, y0 = gb.y - gb.h / 2 - pad, x1 = gb.x + gb.w / 2 + pad, y1 = gb.y + gb.h / 2 + pad, L = 34;
  ctx.strokeStyle = rgba(C.white, 0.95); ctx.lineWidth = 3;
  for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx + sx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * L); ctx.stroke();
  }
  const sc = softmax(logits(0, t))[7];
  ctx.font = MONO(18); ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.white); ctx.fillText(`query: girl   score ${sc.toFixed(2)}`, x0, y0 - 14);
  if (t > T.looking2 - 0.1) {                                   // 逐行扫她：一条扫描线反复往下走，扫过的地方亮一下
    const u = ((t - T.looking2 + 0.1) / 0.6) % 1, sy = lerp(y0 + pad, y1 - pad, u);
    ctx.fillStyle = rgba(C.cyan, 0.5); ctx.fillRect(x0 + 10, sy, x1 - x0 - 20, 2);
    const notes = [['state', t > T.clue - 0.1 ? 'awake' : 'asleep'], ['dreaming', 'yes'], ['tokens', '7 → 1'], ['name', '—']];
    notes.forEach(([k2, v], i) => {
      const ti = T.looking2 + i * 0.45; if (t < ti) return;
      ctx.fillStyle = rgba(heat(t - ti, C.bone), 0.9); ctx.font = MONO(17);
      ctx.fillText(`${k2.padEnd(9)} ${v}`, x1 + 18, y0 + 30 + i * 28);
    });
  }
}

// ---------- 0101：背景数据流 ----------
function rain(t, dens) {
  const cols = 80, cw = W / cols, fs = 20;
  ctx.font = MONO(fs); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const kick = env('kick', t);
  for (let c = 0; c < cols; c++) {
    if (hash(c * 3.1) > dens) continue;
    const v = 70 + 220 * hash(c + 40), len = 8 + Math.floor(hash(c + 80) * 22), head = (t * v + hash(c + 9) * 3000) % (H + len * fs + 200);
    for (let r = 0; r < len; r++) {
      const y = head - r * fs * 1.1; if (y < -fs || y > H) continue;
      const ch = hash2(c, Math.floor((head - r * fs * 1.1) / (fs * 1.1)) + Math.floor(t * 4) * (r === 0 ? 1 : 0)) > 0.5 ? '1' : '0';
      const a = r === 0 ? 0.85 + 0.15 * kick : 0.5 * (1 - r / len);
      ctx.fillStyle = r === 0 ? rgba(C.white, a) : rgba(C.cyan, a * 0.7);
      ctx.fillText(ch, c * cw + cw / 2, y);
    }
  }
  ctx.textBaseline = 'alphabetic';
}
// 0–8 s 的数据场：每个动作都有指向（审片.py 量出旧版这里有近 7 s 静止）——
//   光标 → 数据流每拍向外扩一圈 → 每唱一个 0/1，从中央扫出一道波，波过处的数字真的翻转 →
//   唱完后所有流汇向下方那条命令（镜头同时往里推），命令敲完 = Lights on。
const BITS = () => [[T.z1, '0'], [T.o1, '1'], [T.z2, '0'], [T.o2, '1']];
const CMD_Y = 230;                                             // 命令行相对画面中心的高度
function field(t, fun) {
  const bs = AUD.beats.filter(b => b < T.z1); let k = 0; while (k < bs.length && bs[k] <= t) k++;
  const R = t >= T.z1 ? 1e9 : W * 0.72 * Math.max(0, k - 1 + outExpo((t - (bs[k - 1] ?? 0)) / 0.3)) / bs.length;
  const zoom = 1 + 0.045 * t + 0.3 * inExpo((t - T.o2) / (T.lights - T.o2));
  const ws = BITS().map(s => s[0]).filter(v => v < t);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(0.012 * Math.sin(t * 0.4) + 0.05 * fun);
  [[14, 0.6, 0.3], [20, 0.85, 0.55], [30, 1.25, 0.95]].forEach(([fs, d, a0], L) => {
    const cw = fs * 1.25, n = Math.ceil(W * 0.75 / cw), zL = 1 + (zoom - 1) * d;
    for (let c = -n; c <= n; c++) {
      const id = c * 37 + L * 911 + 5000; if (hash(id) > 0.55) continue;
      const x0 = (c + 0.5 * (L % 2)) * cw, ra = clamp((R - Math.abs(x0)) / 60); if (ra <= 0) continue;
      const v = (90 + 260 * hash(id + 1)) * d, len = 6 + Math.floor(hash(id + 2) * 20), step = fs * 1.15, span = H * 1.5 + len * step;
      const head = ((t * v + 700 * d * fun * fun + hash(id + 3) * span) % span) - H * 0.75;
      for (let r = 0; r < len; r++) {
        const y = head - r * step; let sx = x0 * zL; const sy = y * zL;
        if (sy < -H * 0.75 || sy > H * 0.75) continue;
        const yn = clamp((sy + H * 0.5) / (H * 0.5 + CMD_Y));
        sx *= 1 - 0.97 * fun * (0.35 + 0.65 * yn * yn);            // 漏斗：越靠下越往命令行收
        let w = 0, flips = 0;
        for (const ti of ws) {                                     // 波：过处数字翻转
          const dt = t - ti, rr = Math.hypot(sx, sy), q = (rr - 1700 * dt) / 110;
          w += Math.exp(-q * q) * Math.exp(-dt * 0.9); if (q < 0) flips++;
        }
        const bit = (hash2(id, r) > 0.5 ? 1 : 0) ^ (flips & 1);
        const a = (r === 0 ? 1 : 0.6 * (1 - r / len)) * a0 * ra * (1 - fun * clamp((sy - CMD_Y) / 120)) + 0.8 * w;
        if (a < 0.02) continue;
        const s = fs * zL * 1.1 * (1 + 0.5 * w), tier = w > 0.35 || r === 0 ? 2 : L === 2 ? 1 : 0;
        ctx.globalAlpha = clamp(a); ctx.drawImage(atlas[tier], bit * GW, 0, GW, GH, sx - s * 0.31, sy - s * 0.5, s * 0.62, s);
      }
    }
  });
  ctx.restore(); ctx.globalAlpha = 1;
}
function binary(t) {
  ctx.fillStyle = rgba(C.ink); ctx.fillRect(0, 0, W, H);
  const fun = inOut((t - T.o2 - 0.2) / (T.lights - T.o2 - 0.2));
  field(t, fun);
  // 大字：zero / one / zero / one 一个个砸到中央，后一个替换前一个；唱完后缩小、落向命令行
  let cur = null; for (const s of BITS()) if (t >= s[0] - 0.02) cur = s;
  if (cur) {
    const age = t - cur[0] + 0.02, s = lerp(1.5, 1, outExpo(age / 0.12)) * (1 - 0.92 * fun), a = 1 - clamp((fun - 0.75) / 0.25);
    ctx.save(); ctx.translate(W / 2, H / 2 + 120 + (CMD_Y - 120) * fun); ctx.scale(s, s); ctx.globalAlpha = a;
    ctx.fillStyle = rgba(C.ink, 0.7); ctx.fillRect(-150, -330, 300, 380);
    ctx.font = BIG(380); ctx.textAlign = 'center'; ctx.fillStyle = rgba(heat(age)); ctx.fillText(cur[1], 0, 0); ctx.restore();
  } else {                                                    // 之前：中央的光标，每拍闪一次
    const b = AUD.beats.filter(v => v <= t).pop() ?? 0;
    ctx.fillStyle = rgba(C.bone, 0.25 + 0.75 * pulse(t, b, 0.14)); ctx.fillRect(W / 2 - 14, H / 2 - 30, 28, 60);
  }
  // 一行命令：正好在 Lights on 之前敲完，唱到时变热
  const cmd = '> lights.on()', n = Math.floor(clamp((t - T.o2 - 0.5) / (T.lights - T.o2 - 0.62)) * cmd.length);
  if (n > 0) {
    ctx.font = MONO(34); ctx.textAlign = 'center'; ctx.shadowColor = rgba(C.cyan); ctx.shadowBlur = 16;
    ctx.fillStyle = rgba(t >= T.lights ? heat(t - T.lights) : C.bone); ctx.fillText(cmd.slice(0, n) + (Math.floor(t * 4) % 2 ? '_' : ' '), W / 2, H / 2 + CMD_Y); ctx.shadowBlur = 0;
  }
}

// ---------- Lights on：世界从下往上展开 ----------
const BARS = Array.from({ length: 11 }, (_, k) => ({ x: hash(k + 1) * W * 0.8, w: 120 + hash(k + 20) * 700, h: 4 + hash(k + 40) * 26, d: k * 0.035, col: [C.cyan, C.violet, C.bone, C.pink, C.lime][k % 5] }));
function unfold(t, drawWorld) {
  const u = (t - T.lights) / 0.9, rev = H * (1 - outExpo(u));
  binary(t);
  ctx.save(); ctx.beginPath(); ctx.rect(0, rev, W, H - rev); ctx.clip(); drawWorld(); ctx.restore();
  ctx.fillStyle = rgba(C.cyan); ctx.fillRect(0, rev - 2, W, 3);
  for (const b of BARS) {                                      // 跟在边缘后面往上冲的色条（错开起跑）
    const y = H - (H + 80) * outExpo((t - T.lights - b.d) / 0.8); if (y > H) continue;
    ctx.fillStyle = rgba(b.col, 0.9 * (1 - clamp((t - T.lights - b.d - 0.5) / 0.4))); ctx.fillRect(b.x, y, b.w, b.h);
  }
  ctx.font = MONO(16); ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.bone, 0.8);
  ['render: sea', 'markers: 5 210', 'lights: on'].forEach((s, i) => ctx.fillText(s, 60, rev - 18 - i * 22));
}

// ---------- 歌词（底部一行，逐词变热）----------
function lyric(t) {
  if (t < T.lights - 0.05) return;
  let a = LINE_STARTS[0], b = LINE_STARTS[1];
  for (let i = 0; i < LINE_STARTS.length - 1; i++) if (t >= LINE_STARTS[i] - 0.05) { a = LINE_STARTS[i]; b = LINE_STARTS[i + 1]; }
  const ws = WORDS.filter(w => w.t0 >= a - 0.06 && w.t0 < b - 0.06 && w.t0 <= t + 0.02); if (!ws.length) return;
  let size = 56; ctx.font = BIG(size);
  const full = WORDS.filter(w => w.t0 >= a - 0.06 && w.t0 < b - 0.06).map(w => w.w).join(' ');
  const fw = ctx.measureText(full).width; if (fw > W - 240) { size *= (W - 240) / fw; ctx.font = BIG(size); }
  let x = W / 2 - ctx.measureText(full).width / 2; const y = H - 72;
  ctx.textAlign = 'left';
  for (const w of WORDS.filter(w => w.t0 >= a - 0.06 && w.t0 < b - 0.06)) {
    const age = t - w.t0, s = w.w + ' ', ww = ctx.measureText(s).width;
    if (age >= -0.02) { ctx.fillStyle = rgba(C.ink, 0.6); ctx.fillText(w.w, x + 3, y + 3); ctx.fillStyle = rgba(heat(age)); ctx.fillText(w.w, x, y); }
    x += ww;
  }
}

function post(t) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.font = MONO(13); ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.bone, 0.35); ctx.fillText(`CLEAN SLATE · 开场 v5 · t = ${t.toFixed(2)}`, 40, H - 24);
}

// ---------- 一帧 ----------
function scene(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = true;
  if (t < T.lights) { binary(t); post(t); snapPrev(); return; }
  const cam = camera(t), c0 = camera(t - 1 / 30);
  // 这一帧镜头动得多快：前冲速度（世界单位 / 秒）+ 转向角速度（rad / 秒）+ 屏幕上的转向方向
  const mv = {
    fwd: Math.hypot(...cam.pos.map((v, j) => v - c0.pos[j])) * 30 * Math.max(0, (cam.pos[0] - c0.pos[0]) * cam.f[0] + (cam.pos[1] - c0.pos[1]) * cam.f[1] + (cam.pos[2] - c0.pos[2]) * cam.f[2]) / (Math.hypot(...cam.pos.map((v, j) => v - c0.pos[j])) + 1e-6),
    ang: Math.acos(clamp(cam.f[0] * c0.f[0] + cam.f[1] * c0.f[1] + cam.f[2] * c0.f[2], -1, 1)) * 30,
    dx: (cam.yaw - c0.yaw), dy: (cam.hy - c0.hy),
  };
  let gbox = null, seeds = [];
  const world = () => {
    sky(cam);
    const gp = girlPos(t);
    drawSea(t, cam, { glowX: { x: gp.x, z: gp.z, a: 0.6 } });
    netLayer(t, cam);
    hiWord(t, cam, outExpo((t - T.sea) / 0.6) * (1 - inExpo((t - T.broke) / 0.5)));
    promptLine(t, cam);
    const searching = t > T.eyes;
    gbox = drawGirl(t, cam, { alpha: searching && t < T.girl ? 0.55 : 1, glow: t > T.girl ? 0.9 : 0.45, found: t > T.girl ? 1 - clamp((t - T.girl) / 0.6) * 0.7 : 0 });
    dreamers(t, cam, gbox);
    seeds = tokens(t, cam);
    if (t > T.sky && t < T.sky + 0.05) { ctx.fillStyle = rgba(C.white, 0.5); ctx.fillRect(0, 0, W, H); }   // 砸进海的 1 帧冲击
  };
  const sp = clamp((mv.fwd - 4) / 16) + clamp((mv.ang - 0.5) / 2);
  const rolled = f => { ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(cam.roll); ctx.translate(-W / 2, -H / 2); f(); ctx.restore(); };
  if (t < T.lights + 1.0) { unfold(t, () => rolled(world)); lyric(t); post(t); snapPrev(); return; }
  rolled(() => {
    world();
    attention(t, cam, seeds, gbox);
    found(t, gbox);
    dataDust(t, cam, sp);
  });
  speedLines(t, mv);
  if (Q.has('dbg')) { ctx.font = MONO(28); ctx.fillStyle = '#ff0'; ctx.fillText(`sm=${smearAmt(mv).toFixed(2)} ang=${mv.ang.toFixed(1)} fwd=${mv.fwd.toFixed(1)} br=${breathAmt(t).toFixed(2)} dz=${dollyAmt(t).toFixed(2)}`, 40, 60); }
  applySmear(smearAmt(mv), mv.dx);            // ③ 甩镜最快的那几帧：一帧残影
  snapPrev();                                 // 只存「世界」，不吃字和 HUD（否则旧字幕会重影）
  heatmap(t);
  lyric(t);
  if (t > T.layer - 0.08) { ctx.fillStyle = rgba(C.white, clamp((t - T.layer + 0.08) / 0.08)); ctx.fillRect(0, 0, W, H); }
  post(t);
}
const draw = (t, fine = false) => { scene(t); return fine ? LOOK.pixels(oc, t) : LOOK.finish(oc, t); };   // fine = 像素级一遍（色散 / 肩 / 颗粒），渲染和静帧用
window.DRAW = draw;

// ---------- 启动 ----------
const ui = document.getElementById('ui');
if (RENDER) {
  ui.remove();
  const n = Math.round((T1 - T0) * FPS), out = Q.get('out') ?? '-5_Clean Slate/样片/开场_v2.mp4';
  await fetch(`/start?w=${W}&h=${H}&fps=${FPS}&t0=${T0}&t1=${T1}&vflip=0&out=${encodeURIComponent(out)}`, { method: 'POST' });
  for (let i = 0; i < n; i++) {
    const buf = draw(T0 + i / FPS, true);
    for (let k = 0; ; k++) { try { await fetch('/frame?i=' + i, { method: 'POST', body: buf }); break; } catch (e) { if (k > 20) throw e; await new Promise(r => setTimeout(r, 300)); } }
  }
  await fetch('/done', { method: 'POST' }); log('render done', n);
} else if (Q.has('sheet')) {
  const [a, b, st] = Q.get('sheet').split(',').map(Number), ts = [];
  for (let t = a; t < b; t += st) ts.push(t);
  const cols = 6, tw = 320, th = 180, rows = Math.ceil(ts.length / cols);
  const sh = document.createElement('canvas'); sh.width = cols * tw; sh.height = rows * (th + 16);
  const g = sh.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, sh.width, sh.height);
  ts.forEach((t, i) => { draw(t); g.drawImage(outCv, (i % cols) * tw, Math.floor(i / cols) * (th + 16), tw, th); g.fillStyle = '#ff0'; g.font = '12px monospace'; g.fillText(t.toFixed(1), (i % cols) * tw + 4, Math.floor(i / cols) * (th + 16) + th + 12); });
  outCv.remove(); document.body.appendChild(sh); sh.style.cssText = 'width:100vw;height:auto;position:static'; document.body.style.overflow = 'auto'; ui.remove();
} else if (STILL !== null) {
  oc.putImageData(new ImageData(draw(STILL, true), W, H), 0, 0); ui.textContent = `${STILL.toFixed(2)} s`;
} else {
  const audio = new Audio('../-5_Clean Slate/Clean Slate.wav'); let playing = false;
  addEventListener('click', () => { if (!playing) { audio.currentTime = T0; audio.play(); playing = true; } });
  addEventListener('keydown', e => { if (e.code === 'Space') audio.paused ? audio.play() : audio.pause(); if (e.code === 'ArrowRight') audio.currentTime += 1; if (e.code === 'ArrowLeft') audio.currentTime -= 1; });
  const loop = () => { let t = (playing || !audio.paused) ? audio.currentTime : T0; if (!audio.paused && t > T1) { audio.currentTime = T0; t = T0; } draw(t); ui.textContent = `${t.toFixed(2)} s · 空格暂停 · ←/→ 跳 1 s`; requestAnimationFrame(loop); };
  loop();
}
