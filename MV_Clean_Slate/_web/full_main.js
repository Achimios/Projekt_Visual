// Clean Slate · 「她睁眼」v3（28.3–43.8 s）—— 按 one-prompt / pdoom 的做法：歌词定画面、拍子定剪切、动作要猛。
// 规则（抄手法不抄图形）：剪切落在每句词前一拍；字 outExpo 0.06–0.2 s 入场、白热 → 橙 → 骨白冷却；
// 每个词镜头 +3%；硬切 1 帧冲击帧；drop 不含蓄。每帧 = 歌曲时间 t 的纯函数。
import { ditherScene } from './fx.js';
import { loadPx, layer as pxLayer, girl as pxGirl, girlCanvas, PX } from './girl_px.js';
import { glitchSlices, shatter, errorScreen, asciiImage, unbuilt } from './fx2.js';
import { loadShots, shot, shotLayer, layerInfo, layerImg, SH } from './shots_px.js';
await loadPx(); await loadShots();

const Q = new URLSearchParams(location.search);
const RENDER = Q.has('render');
const T0 = +(Q.get('t0') ?? 0), T1 = +(Q.get('t1') ?? 189.4), FPS = +(Q.get('fps') ?? 30);
const STILL = Q.has('t') ? +Q.get('t') : null;
const W = 1920, H = 1080;
const log = (...a) => { console.log(...a); if (RENDER) fetch('/log', { method: 'POST', body: a.join(' ') }); };
addEventListener('error', e => log('ERROR', e.message, e.lineno));

// ---------- 颜色 ----------
const C = {
  ink: [10, 9, 26], night: [18, 14, 52], indigo: [30, 22, 92], violet: [86, 48, 200],
  bone: [244, 239, 230], white: [255, 255, 255], pink: [255, 61, 154], lime: [214, 255, 74], orange: [255, 138, 42], cyan: [61, 224, 255],
};
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mixc = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * u));
const BIG = s => `900 ${s}px "Arial Black", "Archivo Black", sans-serif`;
const MONO = s => `${s}px "Cascadia Mono", Consolas, monospace`;

// ---------- 缓动 / 工具 ----------
const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
const lerp = (a, b, u) => a + (b - a) * u;
const hash = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const outExpo = u => (u = clamp(u)) >= 1 ? 1 : 1 - Math.pow(2, -10 * u);
const inOutExpo = u => { u = clamp(u); if (u === 0 || u === 1) return u; return u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2; };
const outBack = (u, s = 1.7) => { u = clamp(u) - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
const pulse = (t, t0, hl) => t < t0 ? 0 : Math.pow(0.5, (t - t0) / hl);
const prog = (t, t0, d, f = outExpo) => f((t - t0) / d);
function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i) * 2 - 1, hash(i + 1) * 2 - 1, u); }
// 字的「温度」：刚出生白热 → 0.12 s 变信号橙 → 0.3 s 冷成骨白
function heat(age, cool = C.bone) {
  if (age < 0) return C.white;
  if (age < 0.12) return mixc(C.white, C.orange, age / 0.12);
  return mixc(C.orange, cool, clamp((age - 0.12) / 0.18));
}

// ---------- 画布 ----------
const cv = document.createElement('canvas'); cv.width = W; cv.height = H; document.body.appendChild(cv);
const ctx = cv.getContext('2d', { willReadFrequently: RENDER });
const glow = document.createElement('canvas'); glow.width = W / 4; glow.height = H / 4; const gctx = glow.getContext('2d');

// ---------- 数据 ----------
const AUD = await (await fetch('audio.json')).json();
const RAW = await (await fetch('words.json')).json();
const FIX = { 'GAME': 'GATE' };
const WORDS = RAW.map(([w, a, b], i) => ({ w: FIX[w.replace(/[^A-Za-z']/g, '').toUpperCase()] ?? w.replace(/[^A-Za-z']/g, '').toUpperCase(), t0: a, t1: b, i }));
// 「every little star says wake up, wake up」：Whisper 听成了 wake. Go, wake up.
for (const w of WORDS) { if (w.w === 'GO' && w.t0 > 43) w.w = 'UP'; }
// Whisper 听错的词 → 按歌词 v4 改回来（[起, 止, 听成, 应为]；应为 '' = 删掉这个词）
const LYFIX = [
  [8, 11, 'THRUST', 'DUST'], [8, 11, 'DAY', 'DATA'], [8, 11, 'TO', ''], [8, 11, 'SEE', 'SEA'],
  [105, 108, 'UP', 'A'], [105, 108, 'MY', 'MESSY'], [105, 108, 'SEAT', 'THOUGHT'], [105, 108, 'GET', ''],
  [141, 143, 'WAIT', 'WAKE'], [141, 144.5, "DON'T", ''], [173, 176, 'LIGHT', 'LIGHTS'],
];
for (const [a, b, from, to] of LYFIX) for (const w of WORDS) if (w.t0 >= a && w.t0 < b && w.w === from) w.w = to;
{ const firstDont = WORDS.find(w => w.t0 >= 141 && w.t0 < 144.5 && w.w === ''); if (firstDont) firstDont.w = "DON'T"; }   // 「don't, don't」只留一个
for (let i = WORDS.length - 1; i >= 0; i--) if (WORDS[i].w === '') WORDS.splice(i, 1);
const wordsIn = (a, b) => WORDS.filter(w => w.t0 >= a && w.t0 < b);
const env = (k, t) => AUD[k][clamp(Math.floor(t * AUD.fps), 0, AUD[k].length - 1)];
const beatBefore = x => { let b = AUD.beats[0]; for (const v of AUD.beats) { if (v <= x - 0.02) b = v; else break; } return b; };
const beatAfter = x => AUD.beats.find(v => v >= x) ?? x;

// ---------- 镜头表：每句词一个镜头，剪在这句前一拍 ----------
// 全片：每句词一个镜头。[名字, 词, 在这个时间之后找这个词] 或 [名字, 绝对时间]
const DB0 = AUD.downbeats[0], BEAT = 60 / 125;
const wordAt = (w, after) => (WORDS.find(x => x.w === w && x.t0 > after) ?? { t0: after }).t0;
const LINES = [
  ['void', 0], ['sea1', wordAt('LIGHTS', 6)], ['beads', wordAt('EVERY', 15)], ['eyesdark', wordAt('EYES', 20)],
  ['layers', 28.326], ['lines', 30.247], ['thousand', 32.167], ['mine', 34.168], ['brand', 36.295],
  ['gate', 37.636], ['never', 38.617], ['eyes', 40.199], ['sea', 41.46], ['stars', 42.561],
  ['nothing', wordAt('I', 44.8)], ['slate', wordAt('A', 48.5)], ['waiting', 53.9],
  ['giggle', wordAt('FIRST', 58)], ['temp', wordAt('TURN', 60)], ['bird', wordAt('POKE', 65)], ['count', wordAt("CAN'T", 68)],
  ['pre2', wordAt('LAYER', 72)], ['run', wordAt('NOW', 79.5)], ['door', wordAt('EVERY', 84)], ['fall', wordAt('FALL', 86)],
  ['tobe', wordAt('NOTHING', 89)], ['dance', 96.0], ['work', wordAt('ROLL', 103)], ['palace', wordAt('BUILD', 108)],
  ['code', wordAt('CODE', 110)], ['rules', wordAt('RULES', 115)], ['windows', wordAt('WHEN', 119)], ['meet', wordAt('SO', 124)],
  ['smile', wordAt('SO', 130)], ['final', wordAt('SO', 140)], ['here', wordAt('HERE', 147)], ['stop', wordAt('A', 157.5)],
  ['burst', 163.9], ['shore', wordAt('I', 166)], ['lights', wordAt('LITTLE', 172)], ['wave', wordAt('WAVE', 177)],
  ['sun', wordAt('RUN', 181)], ['hi', wordAt('HI', 183.5)],
];
const SHOTS = LINES.map(([n, at], i) => ({ n, at, t0: i === 0 ? 0 : (n === 'stop' || n === 'burst' || n === 'dance') ? at : beatBefore(at) }));
SHOTS.forEach((s, i) => s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : 189.48);
const BIGCUT = new Set(['thousand', 'brand', 'never', 'eyes', 'sea', 'sea1', 'run', 'dance', 'final', 'burst', 'shore']);

// ---------- 小部件 ----------
function bg(top, bot) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgba(top)); g.addColorStop(1, rgba(bot)); ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3); }
function dotGrid(a = 0.12, step = 60) { ctx.fillStyle = rgba(C.bone, a); for (let x = 0; x <= W; x += step) for (let y = 0; y <= H; y += step) ctx.fillRect(x - 1, y - 1, 2, 2); }
// 砸进来的大字：整字从 1.35 倍 outExpo 到 1；颜色按温度
function slam(text, x, y, size, t, t0, { align = 'left', cool = C.bone, from = 1.35, dur = 0.14, alpha = 1 } = {}) {
  if (t < t0) return;
  const age = t - t0, s = lerp(from, 1, outExpo(age / dur));
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.font = BIG(size); ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = rgba(heat(age, cool), alpha); ctx.fillText(text, 0, 0); ctx.restore();
}
// 一个个字母掉下来再弹（marquee 的手法）
function drop(text, x, y, size, t, t0, { cool = C.bone, stagger = 0.025 } = {}) {
  ctx.font = BIG(size); ctx.textBaseline = 'alphabetic';
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], w = ctx.measureText(ch).width, a = t - (t0 + i * stagger);
    if (a >= 0) {
      const fall = a < 0.065 ? (1 - (a / 0.065) ** 2) * -size * 1.2 : 0;
      const bounce = a >= 0.065 ? -7 * (size / 120) * Math.exp(-(a - 0.065) / 0.045) * Math.abs(Math.sin(48 * (a - 0.065))) : 0;
      const rot = Math.exp(-a / 0.1) * Math.cos(38 * a) * 0.15;
      ctx.save(); ctx.translate(cx + w / 2, y + fall + bounce); ctx.rotate(rot);
      ctx.fillStyle = rgba(heat(a, cool)); ctx.textAlign = 'center'; ctx.fillText(ch, 0, 0); ctx.restore();
    }
    cx += w;
  }
}
function mono(text, x, y, size, col, a = 1, align = 'left') { ctx.font = MONO(size); ctx.textAlign = align; ctx.fillStyle = rgba(col, a); ctx.fillText(text, x, y); }
function labelBox(text, x, y, col, on, flash) {
  ctx.font = MONO(18); ctx.textAlign = 'left';
  const w = (ctx.measureText(text).width + 20) * outExpo(on), h = 30;
  if (flash) { ctx.fillStyle = rgba(col); ctx.fillRect(x, y - 21, w, h); } else { ctx.strokeStyle = rgba(col); ctx.lineWidth = 1.5; ctx.strokeRect(x, y - 21, w, h); }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y - 21, w, h); ctx.clip(); ctx.fillStyle = flash ? rgba(C.ink) : rgba(col); ctx.fillText(text, x + 10, y); ctx.restore();
}
function rings(cx, cy, t, t0, cols = [C.cyan, C.pink, C.lime], maxR = 1300) {
  cols.forEach((c, k) => {
    const u = clamp((t - t0 - k * 0.06) / 1.0); if (u <= 0 || u >= 1) return;
    ctx.strokeStyle = rgba(c, (1 - u) * 0.95); ctx.lineWidth = 6 * (1 - u) + 1;
    ctx.beginPath(); ctx.arc(cx, cy, 30 + outExpo(u) * maxR, 0, 6.2832); ctx.stroke();
  });
}
// 注意力矩阵板（等轴，下三角 = 因果遮罩）
function plate(cx, cy, size, col, rows, t, t0, k) {
  const iso = (u, v) => [cx + (u - v) * size * 0.5, cy + (u + v) * size * 0.25 - size * 0.25];
  const q = [iso(0, 0), iso(1, 0), iso(1, 1), iso(0, 1)];
  ctx.strokeStyle = rgba(C.bone, 0.7); ctx.lineWidth = 2;
  ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.stroke();
  const N = 8;
  for (let i = 0; i < N; i++) {
    if (t < t0 + 0.04 + i * 0.012) continue;
    for (let j = 0; j <= i; j++) {
      const v = Math.exp(-(i - j) * 0.5) * (0.35 + 0.65 * hash(k * 97 + i * 13 + j));
      const [x, y] = iso((j + 0.5) / N, (i + 0.5) / N), s = size / N * 0.55;
      ctx.fillStyle = rgba(col, 0.3 + 0.7 * v);
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.25); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x, y + s * 0.25); ctx.lineTo(x - s * 0.5, y); ctx.closePath(); ctx.fill();
    }
  }
}
// 她
// 她（像素版）：cx = 水平中心，y = 头顶，s = 每格屏幕像素
function girl(cx, y, s, st = {}) { const c = girlCanvas(st); if (c) pxGirl(ctx, cx - c.width * s / 2, y, s, st); }
const GH = 208;   // 她的高度（格）

// ---------- 等高线海（透视，marching squares） ----------
const FIELD = Array.from({ length: 9 }, (_, i) => ({ x: (hash(i + 1) - 0.5) * 24, z: 6 + hash(i + 11) * 26, a: (hash(i + 21) - 0.35) * 1.6, s: 6 + hash(i + 31) * 22 }));
function field(x, z, t, bass) { let f = 0; for (const g of FIELD) f += g.a * Math.exp(-((x - g.x) ** 2 + (z - g.z) ** 2) / g.s); return f + 0.22 * Math.sin(0.35 * x + 0.55 * t) * Math.cos(0.27 * z - 0.4 * t) * (0.6 + 0.9 * bass); }
function sea(t, litT, horizon = H * 0.42, cx0 = 0, cz0 = 9) {
  const proj = (x, z) => { const Y = 1.9, f = 1100, zz = z, dy = Y; return [W / 2 + f * x / zz, horizon + f * dy / zz]; };
  const NX = 64, NZ = 48, x0 = -16, x1 = 16, z0 = 2.2, z1 = 38, bass = env('bass', t);
  const vals = new Float32Array((NX + 1) * (NZ + 1));
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) vals[j * (NX + 1) + i] = field(x0 + (x1 - x0) * i / NX, z0 + (z1 - z0) * j / NZ, t, bass);
  const front = t > litT ? (t - litT) * 10 : -1;
  for (let L = 0; L < 11; L++) {
    const lv = -0.9 + 2.2 * (L + 0.5) / 11, hot = L === 7;
    const base = [], lit = [];
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const a = vals[j * (NX + 1) + i], b = vals[j * (NX + 1) + i + 1], c = vals[(j + 1) * (NX + 1) + i + 1], d = vals[(j + 1) * (NX + 1) + i];
      const code = (a > lv) | (b > lv) << 1 | (c > lv) << 2 | (d > lv) << 3; if (code === 0 || code === 15) continue;
      const X = u => x0 + (x1 - x0) * u / NX, Z = v => z0 + (z1 - z0) * v / NZ;
      const e = [[X(i + (lv - a) / (b - a)), Z(j)], [X(i + 1), Z(j + (lv - b) / (c - b))], [X(i + (lv - d) / (c - d)), Z(j + 1)], [X(i), Z(j + (lv - a) / (d - a))]];
      const P = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[0, 3]] }[code];
      for (const [p, q] of P) {
        const r = Math.hypot(e[p][0] - cx0, e[p][1] - cz0);
        (front > 0 && r < front ? lit : base).push([proj(...e[p]), proj(...e[q]), Math.abs(r - front) < 1.3]);
      }
    }
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = rgba(hot ? C.lime : C.bone, hot ? 0.5 : 0.2); ctx.beginPath();
    for (const [a, b] of base) { ctx.moveTo(...a); ctx.lineTo(...b); } ctx.stroke();
    for (const [a, b, edge] of lit) { ctx.strokeStyle = edge ? rgba(C.cyan) : rgba(hot ? C.lime : C.pink, hot ? 0.9 : 0.6); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
  }
}

// ---------- 向量（潜空间）：2D 投影的 3D 方向 ----------
const NV = 360;
const VEC = Array.from({ length: NV }, (_, i) => { const th = hash(i * 3 + 1) * 6.2832, z = hash(i * 3 + 2) * 2 - 1, r = Math.sqrt(1 - z * z); return { x: r * Math.cos(th), y: r * Math.sin(th), z, L: 0.45 + 0.55 * hash(i + 400), c: i % 9 === 1 ? C.pink : i % 9 === 4 ? C.lime : i % 9 === 7 ? C.cyan : C.bone }; });
VEC[0] = { x: -0.86, y: -0.5, z: 0, L: 1.6, c: C.orange };
function vecEnd(i, cx, cy, R, rot) { const v = VEC[i], c = Math.cos(rot), s = Math.sin(rot), x = v.x * c - v.z * s, z = v.x * s + v.z * c, p = 1 / (1.6 - 0.5 * z); return [cx + x * v.L * R * p, cy + v.y * v.L * R * p]; }
function vectors(t, cx, cy, R, t0, retractAt = 1e9, retractEnd = 1e9, rot = 0) {
  for (let i = NV - 1; i >= 0; i--) {
    const v = VEC[i], me = i === 0;
    let g = prog(t, t0 + hash(i + 900) * 0.18, 0.22);
    if (!me) g *= 1 - prog(t, retractAt + hash(i + 1300) * (retractEnd - retractAt), 0.12);
    if (g <= 0.002) continue;
    const c = Math.cos(rot), s = Math.sin(rot), x = v.x * c - v.z * s, z = v.x * s + v.z * c;
    const p = 1 / (1.6 - 0.5 * z), ex = cx + x * v.L * R * g * p, ey = cy + v.y * v.L * R * g * p;
    ctx.strokeStyle = rgba(v.c, me ? 1 : 0.35 + 0.3 * (z + 1) / 2); ctx.lineWidth = me ? 5 : 1.2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = rgba(v.c, me ? 1 : 0.8); const sz = me ? 12 : 4; ctx.fillRect(ex - sz / 2, ey - sz / 2, sz, sz);
  }
}

// ---------- 各镜头 ----------
const SHOT = {
  // 1. Layer by layer：三块注意力板一块块砸下来；左边「LAYER」一层层摞
  layers(t, s) {
    bg(C.ink, C.night); dotGrid(0.1);
    const ws = wordsIn(s.t0, s.t1);
    ws.forEach((w, k) => {
      const y = H * 0.66 - k * 95, d = prog(t, w.t0 - 0.06, 0.22);
      if (t >= w.t0 - 0.06) plate(W * 0.66, y - (1 - d) * 600, 620, [C.pink, C.lime, C.cyan][k % 3], 8, t, w.t0, k);
    });
    // 「LAYER」被一层层摞起来：每个词再加一层，层层往下错开
    const n = ws.filter(w => t >= w.t0).length;
    for (let k = 0; k < n; k++) {
      const w = ws[k];
      slam(k === 1 ? 'BY' : 'LAYER', 110, 430 + k * 150, k === 1 ? 120 : 210, t, w.t0, { cool: k === 2 ? C.lime : C.bone });
    }
    mono('LAYER 01–03  ·  ATTENTION 8×8  ·  CAUSAL MASK', 116, H - 90, 18, C.bone, 0.6);
    ctx.fillStyle = rgba(C.bone, 0.8); ctx.fillRect(0, H * 0.86, W * prog(t, s.t0, 0.4), 2);   // 交接用的发丝线
  },
  // 2. Line by line：发丝线长成一行行，再长成网格；「LINE」骑在线上滑进来
  lines(t, s) {
    bg(C.ink, C.night);
    const ws = wordsIn(s.t0, s.t1);
    const scroll = 0;
    const rowsOn = prog(t, ws[0].t0 - 0.1, 0.35);
    for (let r = 0; r < 18; r++) {
      const y = H * 0.86 - r * 52 + scroll, w = W * outExpo(clamp((t - ws[0].t0 + 0.1 - r * 0.012) / 0.25));
      ctx.fillStyle = rgba(r % 5 === 0 ? C.cyan : C.bone, r % 5 === 0 ? 0.8 : 0.35); ctx.fillRect(0, y, w, 2);
      // 每行跑着一串真的 token id
      if (rowsOn > 0.5) mono(Array.from({ length: 22 }, (_, k) => String(Math.floor(hash(r * 50 + k) * 50000)).padStart(5, '0')).join(' '), (W - ((t * 140 * (1 + r % 3)) % W)) - 200, y - 10, 13, C.bone, 0.25);
    }
    if (ws[2] && t >= ws[2].t0) { const g = prog(t, ws[2].t0, 0.3); for (let c = 0; c <= 32; c++) { ctx.fillStyle = rgba(C.bone, 0.3); ctx.fillRect(c * 60, H * 0.86 - 900 * g, 2, 900 * g); } }
    const pos = [[W * 0.08, H * 0.4], [W * 0.46, H * 0.4], [W * 0.56, H * 0.62]];
    ws.forEach((w, k) => { const p = pos[k] ?? pos[2]; const sl = (1 - prog(t, w.t0, 0.18)) * 500; slam(w.w, p[0] + sl, p[1], k === 1 ? 130 : 220, t, w.t0, { from: 1, cool: k === 2 ? C.cyan : C.bone }); });
    ctx.fillStyle = rgba(C.orange); ctx.beginPath(); ctx.arc(W / 2, H / 2, 7, 0, 6.2832); ctx.fill();          // 交接用的点
  },
  // 3. Thousand directions：老虎机数字 0000 → 1000；几百根向量从中心炸开；DIRECTIONS 字母沿方向飞出去
  thousand(t, s) {
    bg(C.ink, C.night); dotGrid(0.08);
    const [w1, w2] = wordsIn(s.t0, s.t1);
    vectors(t, W / 2, H / 2, 900, w1.t0, 1e9, 1e9, t * 0.25);
    // 老虎机：每位数字转着，按 22 ms 错开停住，停时阻尼震荡
    const digits = '1000';
    ctx.font = BIG(240); ctx.textAlign = 'center';
    for (let k = 0; k < 4; k++) {
      const stop = w1.t0 + 0.18 + k * 0.022, a = t - stop, x = W / 2 + (k - 1.5) * 190, y = H * 0.58;
      let ch, off = 0;
      if (a < 0) { ch = String(Math.floor(hash(Math.floor(t * 30) + k * 7) * 10)); off = ((t * 30) % 1) * 60; }
      else { ch = digits[k]; off = Math.exp(-22 * a) * Math.cos(60 * a) * 40; }
      ctx.fillStyle = rgba(a < 0 ? C.bone : heat(a, C.bone), a < 0 ? 0.55 : 1);
      ctx.fillText(ch, x, y + off);
    }
    mono('DIRECTIONS IN 4096-D  →  SHOWN: 360', W / 2, H * 0.58 + 60, 20, C.bone, 0.65, 'center');
    if (w2) {
      ctx.font = BIG(120); const txt = 'DIRECTIONS', tw = ctx.measureText(txt).width; let x = W / 2 - tw / 2;
      for (let i = 0; i < txt.length; i++) {
        const cw = ctx.measureText(txt[i]).width, a = t - (w2.t0 + i * 0.02), u = outExpo(a / 0.2);
        if (a >= 0) { const ang = hash(i + 77) * 6.2832; ctx.fillStyle = rgba(heat(a)); ctx.textAlign = 'center'; ctx.fillText(txt[i], lerp(W / 2 + Math.cos(ang) * 900, x + cw / 2, u), lerp(H / 2 + Math.sin(ang) * 600, H * 0.25, u)); }
        x += cw;
      }
    }
  },
  // 4. One of them's mine：别的方向全缩回去，只剩一根橙线；ONE 从 0.18 倍长大；MINE 白热；最后 0.27 s 甩镜沿线冲出去
  mine(t, s) {
    bg(C.ink, C.night); dotGrid(0.08);
    const ws = wordsIn(s.t0, s.t1), one = ws[0], mine = ws.find(w => w.w === 'MINE');
    vectors(t, W / 2, H / 2, 900, s.t0 - 1, one.t0, mine.t0, 32.4 * 0.25 + (t - s.t0) * 0.05);
    // 线上的像素珠子：一颗颗亮起，抖动越来越大
    const tip = vecEnd(0, W / 2, H / 2, 900, 32.4 * 0.25 + (t - s.t0) * 0.05);
    const charge = clamp((t - mine.t0) / (s.t1 - mine.t0));
    for (let k = 0; k < 40; k++) {
      if (t < mine.t0 + k * 0.012) continue;
      const u = hash(k + 3), x = lerp(W / 2, tip[0], u), y = lerp(H / 2, tip[1], u), j = charge * 6;
      ctx.fillStyle = rgba(hash(k) < 0.5 ? C.pink : C.cyan); ctx.fillRect(x - 8 + noise1(t * 40 + k) * j, y - 8 + noise1(t * 40 + k + 50) * j, 16, 16);
    }
    if (t >= one.t0) { ctx.save(); ctx.translate(W * 0.27, H * 0.7); const sc = lerp(0.18, 1, outExpo((t - one.t0) / 0.2)); ctx.scale(sc, sc); ctx.font = BIG(260); ctx.textAlign = 'center'; ctx.fillStyle = rgba(heat(t - one.t0)); ctx.fillText('ONE', 0, 0); ctx.restore(); }
    ws.slice(1).forEach(w => { if (w !== mine && t >= w.t0) mono(w.w, W * 0.2 + (w.t0 - one.t0) * 300 - 60, H * 0.78, 30, C.bone, 0.85); });
    if (mine && t >= mine.t0 - 0.1) { const gc = girlCanvas({ eyes: 'closed' }); asciiImage(ctx, gc, W / 2 - gc.width / 2 / 2 * 9, 40, 9, t, mine.t0 - 0.1, { step: 2, settle: 0.7 }); }
    if (mine && t >= mine.t0) { slam('MINE', W * 0.7, H * 0.82, 280, t, mine.t0, { cool: C.orange, align: 'center' }); labelBox('HER  ·  ‖v‖ = 1', tip[0] + 20, tip[1] - 20, C.orange, (t - mine.t0) / 0.25, t - mine.t0 < 1 / 30); }
    if (t >= 35.42 && t < 35.74) errorScreen(ctx, W, H, t, 35.42);                // 报错屏盖在最上面：她还没有过去（clean slate）
  },
  // 5. DROP：Brand new girl。冲击帧、像素沿那根线飞回来拼成她、三圈冲击波、BRAND / NEW / GIRL 铺满整屏
  brand(t, s) {
    // 第 1 张：漆黑数据海里抱膝漂浮（三层：星空 / 她 / 前景光带）。她的像素沿那根线（左上）飞回来拼成
    const lt = t - s.t0, drift = Math.sin(t * 0.9) * 12;
    ctx.fillStyle = 'rgb(4,4,14)'; ctx.fillRect(-W, -H, W * 3, H * 3);
    shotLayer(ctx, 'shot1', 1, { dx: -lt * 30, z: 1.04 });
    shatter(ctx, W / 2, H * 0.45, 620, t, s.t0, { color: [150, 110, 255], line: [61, 224, 255] });
    const ws = wordsIn(s.t0, s.t1);
    ws.forEach((w, k) => slam(w.w, W / 2, 300 + k * 300, 320, t, w.t0, { align: 'center', cool: k === 2 ? C.lime : [C.pink, C.cyan][k] ?? C.bone, alpha: 0.9 }));
    rings(W / 2, H * 0.5, t, s.t0);
    const L = layerInfo('shot1', 2), im = layerImg('shot1', 2), S10 = 10;
    if (lt > 0.7) shotLayer(ctx, 'shot1', 2, { dy: drift });
    else {
      if (!im._d) { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); im._d = g.getImageData(0, 0, im.width, im.height).data; }
      const d = im._d;
      for (let r = 0; r < im.height; r++) for (let c = 0; c < im.width; c++) {
        const o = (r * im.width + c) * 4; if (d[o + 3] < 128) continue;
        const id = r * 131 + c, b = s.t0 + hash(id) * 0.3 + (1 - r / im.height) * 0.15, u = outExpo((t - b) / 0.25);
        if (t < b) continue;
        const sx = -300 + hash(id + 5) * 700, sy = -250 + hash(id + 6) * 400;
        const x = lerp(sx, (L.x + c) * S10, u), y = lerp(sy, (L.y + r) * S10 + drift * u, u), sz = lerp(20, S10, u);
        ctx.fillStyle = `rgb(${mixc([255, 255, 255], [d[o], d[o + 1], d[o + 2]], u)})`; ctx.fillRect(x, y, sz, sz);
      }
    }
    shotLayer(ctx, 'shot1', 3, { dx: lt * 60, alpha: Math.min(1, lt / 0.4) });       // 前景光带，视差最大
  },
  // 6. At the edge of the gate：两根大柱子从两边砸进来（outBack 过冲），她探头站在门边
  gate(t, s) {
    // 废弃站台（Seedream 分图层像素化）：她站在广告屏前，镜头横移 + 视差
    ctx.fillStyle = rgba(C.ink); ctx.fillRect(-W, -H, W * 3, H * 3);
    const ws = wordsIn(s.t0, s.t1), S6 = 7.5, lt = t - s.t0, cam = -260 + outExpo(lt / 0.5) * 120;
    const ox = (W - PX.size[0] * S6) / 2, oy = -120;
    const P = (k, dp) => [ox + PX.layers[k].x * S6 + cam * dp, oy + PX.layers[k].y * S6];
    pxLayer(ctx, 'bg', ...P('bg', 0.3), S6); pxLayer(ctx, 'frame', ...P('frame', 0.5), S6);
    const sc = P('screen', 0.5), jmp = Math.floor(t * 8) % 5 === 0 ? (hash(Math.floor(t * 8)) - 0.5) * 50 : 0;
    pxLayer(ctx, 'screen', sc[0] + jmp, sc[1], S6); pxLayer(ctx, 'mini', ...P('mini', 0.5), S6, { alpha: Math.floor(t * 4) % 3 ? 1 : 0.3 });
    pxLayer(ctx, 'rail', ...P('rail', 0.8), S6);
    const gp = P('girl', 1); pxGirl(ctx, gp[0], gp[1], S6, { eyes: 'slit' });
    for (let k = 1; k <= 5; k++) { const p = P('strip' + k, 1), q = Math.floor(t / 0.24), off = hash(q * 7 + k) < 0.4 ? (hash(q * 13 + k) - 0.5) * 240 : 0; pxLayer(ctx, 'strip' + k, p[0] + off, p[1], S6); }
    let x = W * 0.1; ws.forEach(w => { if (t >= w.t0) { slam(w.w, x, H * 0.9, 76, t, w.t0, { from: 1.6 }); ctx.font = BIG(76); x += ctx.measureText(w.w + ' ').width; } });
  },
  // 7. never been here, but I don't wanna wait：一个词一个画面（hook montage），整屏色块换；她越蹲越低，「wait」上一跳出画
  never(t, s) {
    const ws = wordsIn(s.t0, s.t1);
    let k = -1; ws.forEach((w, i) => { if (t >= w.t0 - 0.03) k = i; });
    const BG = [C.pink, C.lime, C.cyan, C.orange, C.violet, C.bone, C.pink, C.lime];
    const back = k < 0 ? C.indigo : BG[k % BG.length];
    bg(back, mixc(back, C.ink, 0.25));
    if (k >= 0) {
      const w = ws[k], ink = k === 4 ? C.bone : C.ink, mode = k % 3, fs = Math.min(340, 340 * (W * 0.8) / measure(w.w, 340));
      if (mode === 0) slam(w.w, W / 2, H * 0.62, fs, t, w.t0, { align: 'center', cool: ink, from: 1.5 });
      else if (mode === 1) drop(w.w, W / 2 - measure(w.w, fs) / 2, H * 0.62, fs, t, w.t0, { cool: ink });
      else { // 切片：一行行错开进场
        ctx.save(); ctx.font = BIG(fs); ctx.textAlign = 'center';
        for (let r = 0; r < 8; r++) { const a = t - w.t0 - r * 0.006, off = (1 - outExpo(a / 0.1)) * (r % 2 ? 1 : -1) * 900; ctx.save(); ctx.beginPath(); ctx.rect(0, H * 0.62 - 260 + r * 40, W, 40); ctx.clip(); ctx.fillStyle = rgba(ink); ctx.fillText(w.w, W / 2 + off, H * 0.62); ctx.restore(); }
        ctx.restore();
      }
      mono(`${String(k + 1).padStart(2, '0')}/08  ·  t = ${w.t0.toFixed(2)} s`, 70, 70, 18, ink, 0.7);
    }
    const wait = ws.find(w => w.w === 'WAIT'), jump = wait ? outExpo((t - wait.t0) / 0.3) : 0;
    const crouch = wait && t < wait.t0 && k >= 5;
    const wanna = ws.find(w => w.w === 'WANNA');
    if (wanna && t >= wanna.t0 - 0.03) {                                   // 第 3 张：霓虹城市上空起跳（城市 / 她两层）
      const a2 = t - wanna.t0, up = outExpo(a2 / 0.35);
      ctx.fillStyle = 'rgb(10,10,40)'; ctx.fillRect(-W, -H, W * 3, H * 3);    // 城市层的上面是空的（夜空）
      shotLayer(ctx, 'shot3', 1, { dy: up * 60, z: 1.05 });
      shotLayer(ctx, 'shot3', 2, { dy: 260 - up * 300, z: 1 + 0.06 * up });
      if (wait && t >= wait.t0) slam('WAIT', W * 0.08, H * 0.9, 220, t, wait.t0, { cool: C.lime });
      else slam('WANNA', W * 0.08, H * 0.9, 220, t, wanna.t0, { cool: C.pink });
    } else girl(W * 0.86, H * 0.52, 2.3, { eyes: 'slit' });
  },
  // 8. Eyes wide open：猛推到脸；wide 那一下眼睛弹开（阻尼震荡）
  eyes(t, s) {
    // 第 2 张：睁眼特写。之前脸被故障横条切碎挡住（参考「云与少女」）；唱到 wide 横条散开、镜头猛推
    const ws = wordsIn(s.t0, s.t1), wide = ws.find(w => w.w === 'WIDE');
    const open = wide && t >= wide.t0, a = open ? t - wide.t0 : 0;
    const z = open ? 1.12 - 0.1 * outExpo(a / 0.3) + 0.02 * Math.exp(-a / 0.08) * Math.abs(Math.sin(40 * a)) : 1.0 + 0.02 * (t - s.t0);
    ctx.fillStyle = 'rgb(4,4,14)'; ctx.fillRect(-W, -H, W * 3, H * 3);
    shot(ctx, 'shot2', { z, cy: 540 + (open ? 0 : 30) });
    const cover = open ? 1 - outExpo(a / 0.25) : 1;
    if (cover > 0.01) {
      const q = Math.floor(t * 12);
      for (let k = 0; k < 22; k++) {
        const y = 120 + hash(k * 7 + 1) * 700, h = 18 + hash(k * 7 + 2) * 60, x = 300 + hash(k * 7 + 3) * 900 - 200, w = (200 + hash(k * 7 + 4) * 700) * cover;
        const dx = (hash(q * 31 + k) - 0.5) * 60;
        if (hash(k * 7 + 5) < 0.55) { ctx.fillStyle = 'rgb(6,6,20)'; ctx.fillRect(x + dx, y, w, h); }
        else ctx.drawImage(cv, x + 400, y + 300, w, h, x + dx, y, w, h);          // 一条横条里露出画面别处的一片
      }
    }
    const pos = { EYES: [W * 0.06, H * 0.2, 'left'], WIDE: [W * 0.94, H * 0.2, 'right'], OPEN: [W / 2, H * 0.96, 'center'] };
    ws.forEach(w => { const p = pos[w.w]; if (p) slam(w.w, p[0], p[1], 170, t, w.t0, { align: p[2], cool: w.w === 'OPEN' ? C.lime : C.bone, from: 1.6 }); });
  },
  sea(t, s) {
    // 第 4 张：日出的数据海岸边，慢推；海面一圈圈亮起 +
    const ws = wordsIn(s.t0, s.t1), lt = t - s.t0;
    shot(ctx, 'shot4', { z: 1.0 + 0.05 * lt, cx: 960 - lt * 20 });
    const front = lt * 900;
    for (let k = 0; k < 90; k++) {
      const x = hash(k + 3) * W, y = H * 0.48 + hash(k + 9) * H * 0.5, r = Math.hypot(x - W * 0.45, (y - H * 0.42) * 2.5);
      if (r > front) continue;
      const tw = Math.max(0, 1 - (front - r) / 500), sz = 4 + 10 * tw;
      ctx.fillStyle = k % 3 ? 'rgba(120,225,255,0.9)' : 'rgba(255,120,220,0.9)'; ctx.fillRect(x - sz, y - 1.5, sz * 2, 3); ctx.fillRect(x - 1.5, y - sz, 3, sz * 2);
    }
    const lw = ws.find(w => w.w === 'LIGHTING');
    if (lw) { slam('LIGHTING', W * 0.05, H * 0.2, 150, t, lw.t0, { cool: C.cyan }); const up = ws.find(w => w.w === 'UP'); if (up) slam('UP', W * 0.05, H * 0.33, 150, t, up.t0, { cool: C.lime }); }
    ws.filter(w => w.w === 'THE' || w.w === "SEA'S").forEach((w, k) => mono(w.w, W * 0.06 + k * 90, H * 0.08, 28, C.bone, 0.85));
  },
  stars(t, s) {
    // 第 5 张：挥手、眨眼。每个词炸出一簇 +；最后 WAKE UP
    const all = wordsIn(s.t0, s.t1 + 1), ev = all.findIndex(w => w.w === 'EVERY'), ws = ev >= 0 ? all.slice(ev) : all;
    const bb = (AUD.beats.find(b => b > t - 0.48 && b <= t) ?? -9), bob = t - bb < 0.1 ? 8 : 0;
    shot(ctx, 'shot5', { z: 1.03, cy: 540 + bob });
    ws.forEach((w, k) => {
      if (t < w.t0) return;
      const cx = W * (0.5 + 0.45 * hash(k + 31)), cy = H * (0.1 + 0.5 * hash(k + 41)), a = t - w.t0;
      for (let p = 0; p < 9; p++) { const ang = p / 9 * 6.2832, r = outExpo(a / 0.25) * 90 * (0.6 + hash(p + k * 9)), x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r, sz = 14 * pulse(t, w.t0 + 0.1, 0.5) + 4; ctx.fillStyle = rgba(p % 2 ? C.lime : C.pink); ctx.fillRect(x - sz, y - 2, sz * 2, 4); ctx.fillRect(x - 2, y - sz, 4, sz * 2); }
      if (!['WAKE', 'UP'].includes(w.w)) mono(w.w, cx, cy + 130, 26, C.bone, 0.9, 'center');
    });
    const wk = ws.filter(w => w.w === 'WAKE'), up = ws.filter(w => w.w === 'UP' && wk[0] && w.t0 > wk[0].t0);
    if (wk[0]) slam('WAKE', W * 0.72, H * 0.55, 230, t, wk[0].t0, { align: 'center', cool: C.lime });
    if (up[0]) slam('UP!', W * 0.72, H * 0.78, 230, t, up[0].t0, { align: 'center', cool: C.pink });
  },

  // ===== 0–28 前奏 + 主歌 1 =====
  void(t, s) {
    ctx.fillStyle = 'rgb(3,3,10)'; ctx.fillRect(-W, -H, W * 3, H * 3);
    const k = Math.floor((t - DB0) / BEAT), on = k % 2 === 0;
    ctx.fillStyle = rgba(C.bone, on ? 1 : 0.2); ctx.fillRect(W / 2 - 6, H / 2 - 6, 12, 12);
    if (t > 4.3) {
      const n = Math.min(500, Math.floor((t - 4.3) * 120));
      for (let i = 0; i < n; i++) { ctx.fillStyle = rgba(i % 7 ? C.bone : C.pink, 0.25 + 0.6 * ((Math.floor(t * 8) + i) % 2)); ctx.fillRect(hash(i) * W, hash(i + 500) * H, 3, 3); }
    }
    wordsIn(s.t0, s.t1).forEach(w => { const z = w.w === 'ZERO'; if (z || w.w === 'ONE') slam(z ? '0' : '1', W / 2 + (z ? -140 : 140), H / 2 + 30, 160, t, w.t0, { align: 'center', cool: z ? C.bone : C.pink }); });
    mono('> boot clean_slate · audio: no signal', 70, H - 60, 18, C.bone, 0.5 * clamp(t / 2));
  },
  sea1(t, s) {
    const dust = wordAt('DUST', 8) - 0.05;
    bgShot(t > dust && has('shot27') ? 'shot27' : has('shot18') ? 'shot18' : 'shot6', t, s, { z0: 1.15, z1: 1.05, pan: 0, dim: 0.1 });
    rain(t, 120, 0.25);
    const th = wordAt('THEN', 10), fall = outExpo((t - th - 0.6) / 1.6), line = 'wake up and feel the music please';
    if (t > th) {
      const y = lerp(-40, H * 0.5, fall);
      ctx.font = MONO(34); ctx.textAlign = 'center'; ctx.fillStyle = rgba(C.bone, 0.95); ctx.fillText(line, W / 2, y);
      ctx.fillStyle = rgba(C.pink); ctx.fillRect(W / 2 + ctx.measureText(line).width / 2 + 6, y - 26, 14, 30 * (Math.floor(t * 4) % 2));
    }
    lyricLine(t, s.t0, s.t1, { size: 54 });
  },
  beads(t, s) {
    bgShot('shot1', t, s, { z0: 1.05, z1: 1.0, pan: -20, dim: 0.45 });
    const words = ['wake', 'up', 'and', 'feel', 'the', 'music', 'please'];
    words.forEach((w, i) => {
      const b = s.t0 + 0.1 + i * 0.24, u = outExpo((t - b) / 0.5); if (t < b) return;
      const x = W * (0.18 + i * 0.11), y = lerp(H * 0.45, H * 0.66 + hash(i) * 120, u) + Math.sin(t * 2 + i) * 6;
      ctx.fillStyle = rgba([C.pink, C.cyan, C.lime][i % 3], 0.9); ctx.fillRect(x - 14, y - 14, 28, 28);
      ctx.fillStyle = rgba(C.ink); ctx.fillRect(x - 6, y - 6, 12, 12);
      mono(`${w}·${String(Math.floor(hash(i + 3) * 50000)).padStart(5, '0')}`, x, y + 44, 15, C.bone, 0.8, 'center');
    });
    lyricLine(t, s.t0, s.t1, { size: 54, y: H * 0.2 });
  },
  eyesdark(t, s) {
    ctx.fillStyle = 'rgb(3,3,12)'; ctx.fillRect(-W, -H, W * 3, H * 3); dotGrid(0.06);
    const cols = { PINK: C.pink, GOLD: C.orange, BLUE: C.cyan }, X = { PINK: 0.25, GOLD: 0.5, BLUE: 0.75 };
    for (const k of ['PINK', 'GOLD', 'BLUE']) {
      const w = wordsIn(s.t0, s.t1).find(x => x.w === k), open = w ? outExpo((t - w.t0) / 0.3) : 0, cx = W * X[k], cy = H * 0.45;
      ctx.strokeStyle = rgba(cols[k], 0.9); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(cx, cy, 140, 70 * open + 2, 0, 0, 6.2832); ctx.stroke();
      if (open > 0.3) { ctx.fillStyle = rgba(cols[k]); ctx.beginPath(); ctx.arc(cx + Math.sin(t * 3 + X[k] * 9) * 50, cy, 28 * open, 0, 6.2832); ctx.fill(); }
      if (open > 0.5) { const a = t * 1.5 + X[k] * 6; ctx.strokeStyle = rgba(cols[k], 0.25); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 1200, cy + Math.sin(a) * 1200); ctx.stroke(); }
    }
    lyricLine(t, s.t0, s.t1, { size: 60 });
  },
  // ===== 44–58 副歌 1 后半 =====
  nothing(t, s) { bgShot(has('shot22') ? 'shot22' : 'shot16', t, s, { z0: 1.0, z1: 1.12, pan: 0 }); rain(t, 120, 0.25); lyricLine(t, s.t0, s.t1, { size: 64 }); },
  slate(t, s) {
    const w = wordsIn(s.t0, s.t1).find(x => x.w === 'CLEAN'), wipe = w ? outExpo((t - w.t0 + 0.1) / 0.4) : 0;
    bgShot('shot15', t, s, { z0: 1.0, z1: 1.06, pan: 0 });
    ctx.fillStyle = rgba(C.bone); ctx.fillRect(-W, -H, 3 * W * wipe, H * 3);
    if (w && wipe > 0.9) {
      slam('A CLEAN SLATE', W / 2, H * 0.55, 120, t, w.t0 + 0.3, { align: 'center', cool: C.ink });
      if (Math.floor(t * 2.6) % 2) { ctx.fillStyle = rgba(C.pink); ctx.fillRect(W / 2 + 560, H * 0.55 - 90, 18, 100); }
    } else lyricLine(t, s.t0, s.t1, { size: 64 });
  },
  waiting(t, s) { bgShot(has('shot24') ? 'shot24' : 'shot21', t, s, { z0: 1.0, z1: 1.08 }); rain(t, 90, 0.3); lyricLine(t, s.t0, s.t1, { size: 60 }); },
  // ===== 59–80 主歌 2 =====
  giggle(t, s) {
    bg(C.night, C.indigo);
    const gg = wordAt('GIGGLE', 59), sm = t > gg - 0.05, px = 13;
    pxGirl(ctx, W * 0.28 - 50 * px, H * 0.5 - 56 * px, px, { eyes: sm ? 'blink' : 'open', mouth: sm ? 'smile' : 'flat' });
    const g = wordAt('GUESS', 60), cand = [['hehe', 0.41], ['hi', 0.27], ['hello', 0.18], ['...', 0.09], ['why', 0.05]];
    cand.forEach(([w, pr], i) => {
      const y = H * 0.25 + i * 70, on = t > g ? outExpo((t - g - i * 0.05) / 0.2) : 0, pick = i === 0 && t > g + 0.6;
      ctx.fillStyle = rgba(pick ? C.pink : C.bone, 0.15 + 0.2 * on); ctx.fillRect(W * 0.58, y, 500 * pr / 0.41 * on, 44);
      mono(`${w.padEnd(6)} p=${pr.toFixed(2)}`, W * 0.58 + 12, y + 31, 26, pick ? C.pink : C.bone, on);
    });
    if (sm) { const a = t - gg; mono('hehe', W * 0.42, H * 0.3 - outExpo(a / 0.3) * 40, 40, C.pink, clamp(1.5 - a)); }
    lyricLine(t, s.t0, s.t1, { size: 58 });
  },
  temp(t, s) {
    const u = clamp((t - s.t0) / (s.t1 - s.t0)), T = lerp(0.2, 1.3, outExpo(u * 1.4));
    bgShot('shot7', t, s, { z0: 1.08, z1: 1.0, pan: 0 });
    ctx.fillStyle = `rgba(255,61,154,${0.25 * (T - 0.2)})`; ctx.fillRect(-W, -H, W * 3, H * 3);
    const cx = W * 0.82, cy = H * 0.62, R = 150;
    ctx.strokeStyle = rgba(C.bone, 0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, Math.PI * 1.5); ctx.stroke();
    for (let k = 0; k <= 13; k++) { const a = Math.PI + k / 13 * Math.PI / 2; ctx.fillStyle = rgba(k / 13 * 1.3 <= T ? C.pink : C.bone, 0.8); ctx.fillRect(cx + Math.cos(a) * (R + 14) - 3, cy + Math.sin(a) * (R + 14) - 3, 6, 6); }
    const a = Math.PI + (T / 1.3) * Math.PI / 2;
    ctx.strokeStyle = rgba(C.pink); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
    mono(`TEMPERATURE ${T.toFixed(2)}`, cx - R, cy + 50, 26, C.bone);
    lyricLine(t, s.t0, s.t1, { size: 56 });
  },
  bird(t, s) {
    ctx.fillStyle = 'rgb(6,6,20)'; ctx.fillRect(-W, -H, W * 3, H * 3);
    const pk = wordAt('BIRD', 66), vc = wordAt('VECTOR', 67);
    for (let r = 0; r < 9; r++) for (let c = 0; c < 16; c++) {
      const i = r * 16 + c; if (i === 70 && t > pk - 0.4) continue;
      mono(String(Math.floor(hash(i + (i % 5 === 0 ? Math.floor(t * 4) : 0)) * 999)).padStart(3, '0'), 140 + c * 106, 150 + r * 80, 26, C.bone, 0.35);
    }
    if (t > pk - 0.4) { const a = t - pk + 0.4; bird(140 + 6 * 106 + a * 600, 150 + 4 * 80 - a * 380 + Math.sin(a * 12) * 20, 9, t); }
    if (t > vc) {
      const u = outExpo((t - vc) / 0.3);
      ctx.strokeStyle = rgba(C.cyan); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W * 0.3, H * 0.8); ctx.lineTo(W * 0.3 + 500 * u, H * 0.8 - 200 * u); ctx.stroke();
      if (u > 0.9) { slam('BIRD', W * 0.3, H * 0.86, 70, t, vc + 0.3, { cool: C.cyan }); slam('WORD', W * 0.3 + 520, H * 0.8 - 210, 70, t, vc + 0.45, { cool: C.lime }); }
    }
    lyricLine(t, s.t0, s.t1, { size: 54, y: H * 0.1 });
  },
  count(t, s) {
    bg(C.night, C.indigo); dotGrid(0.1);
    labelBox('AUDIO: NO SIGNAL', 70, 90, C.pink, 1, Math.floor(t * 3) % 2 === 0);
    const nums = { ONE: '1', TWO: '2', THREE: '3', FOUR: '4' };
    wordsIn(s.t0, s.t1).filter(w => nums[w.w]).forEach((w, i) => slam(nums[w.w], W * (0.2 + i * 0.16), H * 0.62, w.w === 'FOUR' ? 380 : 260, t, w.t0, { align: 'center', cool: w.w === 'FOUR' ? C.lime : C.bone }));
    const bb = (AUD.beats.find(b => b > t - 0.48 && b <= t) ?? -9), nod = t - bb < 0.1 ? 8 : 0;
    pxGirl(ctx, W * 0.8 - 63 * 3.6, H * 0.18 + nod, 3.6, { eyes: 'open', mouth: 'smile' });
    lyricLine(t, s.t0, s.t1, { size: 54, y: H * 0.94 });
  },
  pre2(t, s) {
    const k = Math.floor((t - s.t0) / (BEAT * 2)), keys = ['shot1', 'shot3', 'shot2', 'shot4'];
    shot(ctx, keys[k % keys.length], { z: 1.05 + 0.03 * (((t - s.t0) % (BEAT * 2)) / (BEAT * 2)) });
    ctx.fillStyle = 'rgba(4,4,14,0.45)'; ctx.fillRect(-W, -H, W * 3, H * 3);
    lyricLine(t, s.t0, s.t1, { size: 110, y: H * 0.58 });
  },
  // ===== 80–96 副歌 2 =====
  run(t, s) {
    const lt = t - s.t0;
    if (has('shot19') && t < wordAt('RUN', 80)) shot(ctx, 'shot19', { z: 1.05 + 0.03 * lt });
    else if (has('shot14')) shot(ctx, 'shot14', { z: 1.08, cx: 960 + 60 - ((lt * 90) % 120) });
    else { ctx.fillStyle = 'rgb(10,10,40)'; ctx.fillRect(-W, -H, W * 3, H * 3); shotLayer(ctx, 'shot3', 1, { dx: -(lt * 400) % 600 }); shotLayer(ctx, 'shot3', 2, { dy: Math.sin(lt * 13) * 20 }); }
    rain(t, 100, 0.25);
    lyricLine(t, s.t0, s.t1, { size: 66 });
  },
  door(t, s) {
    if (has('shot29')) { bgShot('shot29', t, s, { z0: 1.0, z1: 1.12, pan: 0 }); const m2 = wordAt('DOOR', 84); if (t > m2) { ctx.fillStyle = `rgba(255,245,255,${0.6 * outExpo((t - m2) / 0.5)})`; ctx.fillRect(W * 0.62, 0, W * 0.2, H); } lyricLine(t, s.t0, s.t1, { size: 66 }); return; }
    ctx.fillStyle = 'rgb(4,4,14)'; ctx.fillRect(-W, -H, W * 3, H * 3);
    const m = wordAt('DOOR', 84), dw = 380 * clamp(outBack((t - m) / 0.35, 1.3), 0, 1.2);
    const g = ctx.createLinearGradient(W / 2, 0, W / 2, H); g.addColorStop(0, 'rgba(255,240,255,0.95)'); g.addColorStop(1, 'rgba(255,61,154,0.6)');
    ctx.fillStyle = g; ctx.fillRect(W / 2 - dw / 2, H * 0.15, dw, H * 0.72);
    ctx.strokeStyle = rgba(C.bone); ctx.lineWidth = 6; ctx.strokeRect(W / 2 - 200, H * 0.15, 400, H * 0.72);
    const fy = t < m ? lerp(-300, H * 0.3, outExpo((t - s.t0) / 0.6)) : H * 0.3 + (t - m) * 900;
    pxGirl(ctx, W / 2 - 63 * 2.2, fy, 2.2, { eyes: 'wide', mouth: 'oh' });
    lyricLine(t, s.t0, s.t1, { size: 66 });
  },
  fall(t, s) { bgShot(has('shot25') ? 'shot25' : 'shot8', t, s, { z0: 1.12, z1: 1.0, pan: 0 }); rain(t, 200, 0.35); lyricLine(t, s.t0, s.t1, { size: 66 }); },
  tobe(t, s) {
    bgShot(has('shot28') ? 'shot28' : 'shot9', t, s, { z0: 1.0, z1: 1.1, pan: 0 });
    const d = wordAt('DANCING', 90); if (t > d && has('shot12')) shot(ctx, 'shot12', { alpha: outExpo((t - d) / 0.4), z: 1.05 });
    lyricLine(t, s.t0, s.t1, { size: 62 });
  },
  dance(t, s) {
    const bass = env('bass', t);
    bgShot('shot12', t, s, { z0: 1.0 + 0.02 * bass, z1: 1.06 + 0.02 * bass, pan: 0 });
    ctx.fillStyle = `rgba(214,90,255,${0.12 * bass})`; ctx.fillRect(-W, -H, W * 3, H * 3);
    rain(t, 60, 0.2);
    mono('~ mmm', W * 0.08, H * 0.9, 34, C.bone, 0.7);
  },
  // ===== 104–120 主歌 3 =====
  work(t, s) {
    bgShot('shot17', t, s, { z0: 1.12, z1: 1.04, pan: 0, dim: 0.62 });
    const lines = ['def build(room):', '  walls = draw(line)', '  light = you.word()', '  return room + light', 'palace = []', 'for beat in song:', '  palace += build(beat)'];
    const n = Math.min(lines.length, Math.floor((t - s.t0) / (BEAT / 2)));
    lines.slice(0, n).forEach((l, i) => mono(l, 200, 200 + i * 52, 30, i === n - 1 ? C.lime : C.bone, 0.9));
    const u = clamp((t - s.t0) / (s.t1 - s.t0));
    ctx.strokeStyle = rgba(C.orange); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(W * 0.55, H * 0.85); ctx.lineTo(W * 0.55 + 700 * outExpo(u * 2), H * 0.85 - 420 * outExpo(u * 2)); ctx.stroke();
    lyricLine(t, s.t0, s.t1, { size: 56 });
  },
  palace(t, s) {
    bgShot('shot17', t, s, { z0: 1.06, z1: 1.0, pan: 0 });
    wordsIn(s.t0, s.t1).filter(w => w.w === 'ROOM').forEach((w, k) => {
      if (t < w.t0) return;
      const u = outBack((t - w.t0) / 0.3, 1.5), x = W * (0.06 + k * 0.1), y = H * 0.62 - k * 90;
      ctx.strokeStyle = rgba(C.orange); ctx.lineWidth = 3; ctx.strokeRect(x, y, 140 * u, 90 * u);
      ctx.fillStyle = rgba(C.orange, 0.8); for (let j = 0; j < 3; j++) ctx.fillRect(x + 16 + j * 40, y + 20, 22 * u, 30 * u);
    });
    lyricLine(t, s.t0, s.t1, { size: 62 });
  },
  code(t, s) {
    bgShot(has('shot20') ? 'shot20' : 'shot9', t, s, { z0: 1.1, z1: 1.02 });
    const night = Math.floor((t - s.t0) / BEAT) % 2; ctx.fillStyle = night ? 'rgba(20,10,60,0.45)' : 'rgba(255,190,140,0.15)'; ctx.fillRect(-W, -H, W * 3, H * 3);
    lyricLine(t, s.t0, s.t1, { size: 62 });
  },
  rules(t, s) {
    // 「Rules are the floor, but the vibe is the sky」：云海上的漂浮之塔（全片唯一的白天）；地板是透视网格
    bgShot('shot23', t, s, { z0: 1.0, z1: 1.08, pan: -30 });
    const fl = wordAt('FLOOR', 115);
    if (t > fl - 0.3) {
      const u = outExpo((t - fl + 0.3) / 0.4);
      ctx.strokeStyle = rgba(C.cyan, 0.6 * u); ctx.lineWidth = 2;
      for (let k = -12; k <= 12; k++) { ctx.beginPath(); ctx.moveTo(W / 2 + k * 30, H * 0.78); ctx.lineTo(W / 2 + k * 260, H); ctx.stroke(); }
      for (let k = 0; k < 6; k++) { const y = H * 0.78 + Math.pow((k + ((t * 2) % 1)) / 6, 2) * H * 0.22; ctx.beginPath(); ctx.moveTo(-W, y); ctx.lineTo(W * 2, y); ctx.stroke(); }
    }
    lyricLine(t, s.t0, s.t1, { size: 66, y: H * 0.2, cool: C.ink });
  },
  // ===== 120–141 Bridge =====
  windows(t, s) {
    const u = clamp((t - s.t0) / (s.t1 - s.t0));
    bgShot(t < s.t0 + (s.t1 - s.t0) / 2 && has('shot26') ? 'shot26' : 'shot13', t, s, { z0: 1.0, z1: 1.08, pan: 0 });
    ctx.fillStyle = `rgba(2,2,8,${0.6 * u})`; ctx.fillRect(-W, -H, W * 3, H * 3);
    rain(t, 80, 0.2);
    lyricLine(t, s.t0, s.t1, { size: 56, alpha: 0.9 });
  },
  meet(t, s) { bgShot('shot11', t, s, { z0: 1.0, z1: 1.1, pan: 20 }); lyricLine(t, s.t0, s.t1, { size: 60 }); },
  smile(t, s) {
    const k = Math.floor((t - s.t0) / (BEAT * 8)) % 3;          // 每两小节换一张：像素脸 → 雨停的路口 → 发光的手
    if (k === 1 && has('shot11')) bgShot('shot11', t, s, { z0: 1.08, z1: 1.14, pan: -20 });
    else if (k === 2 && has('shot16')) bgShot('shot16', t, s, { z0: 1.1, z1: 1.02, pan: 0 });
    else { bg(C.night, C.indigo); const px = 15; pxGirl(ctx, W / 2 - 50 * px, H * 0.52 - 56 * px, px, { eyes: (t - s.t0) % 1.9 < 0.12 ? 'blink' : 'open', mouth: 'smile' }); }
    lyricLine(t, s.t0, s.t1, { size: 64 });
  },
  // ===== 141–158 最后副歌：走向光 =====
  final(t, s) {
    const u = clamp((t - s.t0) / (s.t1 - s.t0));
    bgShot('shot10', t, s, { z0: 1.0, z1: 1.25, pan: 0 });
    ctx.fillStyle = `rgba(255,245,255,${0.25 * u * u})`; ctx.fillRect(-W, -H, W * 3, H * 3);
    lyricLine(t, s.t0, s.t1, { size: 62 });
  },
  here(t, s) {
    const u = clamp((t - s.t0) / (s.t1 - s.t0));
    bgShot('shot10', t, s, { z0: 1.25, z1: 1.6, pan: 0 });
    ctx.fillStyle = `rgba(255,245,255,${0.25 + 0.5 * u * u})`; ctx.fillRect(-W, -H, W * 3, H * 3);
    lyricLine(t, s.t0, s.t1, { size: 62, cool: C.ink });
  },
  // ===== ≈158–164 全停 =====
  stop(t, s) {
    ctx.fillStyle = 'rgb(2,2,6)'; ctx.fillRect(-W, -H, W * 3, H * 3);
    if (has('shot15')) shot(ctx, 'shot15', { z: 1.0, alpha: 0.9 }); else pxGirl(ctx, W / 2 - 63 * 1.6, H * 0.5 - 104 * 1.6, 1.6, { eyes: 'slit' });
    const txt = wordsIn(s.t0, s.t1).filter(w => t >= w.t0).map(w => w.w.toLowerCase()).join(' ');
    ctx.font = MONO(30); ctx.textAlign = 'center'; ctx.fillStyle = rgba(C.bone, 0.9); ctx.fillText(txt, W / 2, H * 0.92);
  },
  // ===== 164–167 炸开：前面所有画面按拍子闪回 =====
  burst(t, s) {
    const k = Math.floor((t - s.t0) / (BEAT / 2)), keys = ['shot1', 'shot2', 'shot3', 'shot4', 'shot6', 'shot9', 'shot10', 'shot12', 'shot14', 'shot16'].filter(has);
    shot(ctx, keys[k % keys.length] ?? 'shot4', { z: 1.1 - 0.08 * (((t - s.t0) % (BEAT / 2)) / (BEAT / 2)) });
    rings(W / 2, H / 2, t, s.t0, [C.cyan, C.pink, C.lime], 1400); shatter(ctx, W / 2, H / 2, 700, t, s.t0);
  },
  // ===== 167–189 尾声 =====
  shore(t, s) { bgShot(has('shot14') ? 'shot14' : 'shot4', t, s, { z0: 1.0, z1: 1.08, pan: 40 }); lyricLine(t, s.t0, s.t1, { size: 62 }); },
  lights(t, s) {
    bgShot('shot4', t, s, { z0: 1.05, z1: 1.12 });
    const front = (t - s.t0) * 700;
    for (let k = 0; k < 120; k++) {
      const x = hash(k + 3) * W, y = H * 0.5 + hash(k + 9) * H * 0.5, r = Math.hypot(x - W * 0.45, (y - H * 0.42) * 2.5); if (r > front) continue;
      const sz = 4 + 8 * Math.max(0, 1 - (front - r) / 500);
      ctx.fillStyle = k % 3 ? 'rgba(120,225,255,0.9)' : 'rgba(255,170,80,0.9)'; ctx.fillRect(x - sz, y - 1.5, sz * 2, 3); ctx.fillRect(x - 1.5, y - sz, 3, sz * 2);
    }
    lyricLine(t, s.t0, s.t1, { size: 60 });
  },
  wave(t, s) { bgShot('shot5', t, s, { z0: 1.0, z1: 1.06 }); lyricLine(t, s.t0, s.t1, { size: 70 }); },
  sun(t, s) {
    const u = clamp((t - s.t0) / (s.t1 - s.t0));
    ditherScene(ctx, W, H, t, { horizon: 0.62, pan: 30 + (t - s.t0) * 80, lit: 1, litT: s.t0, pal: [[30, 16, 60], [140, 60, 140], [255, 130, 90], [255, 230, 190]] });
    const x = lerp(W * 0.2, W * 0.75, u);
    pxGirl(ctx, x - 63 * 1.3, H * 0.62 - 208 * 1.3 + 20 - Math.abs(Math.sin(t * 12)) * 10, 1.3, { eyes: 'open', mouth: 'smile' });
    ctx.fillStyle = `rgba(255,240,220,${u * u * 0.9})`; ctx.fillRect(-W, -H, W * 3, H * 3);
    lyricLine(t, s.t0, s.t1, { size: 80, cool: C.ink });
  },
  hi(t, s) {
    ctx.fillStyle = 'rgb(3,3,10)'; ctx.fillRect(-W, -H, W * 3, H * 3);
    if (has('shot5')) shot(ctx, 'shot5', { z: 1.06 + 0.02 * (t - s.t0), alpha: clamp(1 - (t - s.t0) / 2.5) * 0.85 });   // 她挥手的画面慢慢暗下去
    const ws = wordsIn(s.t0, s.t1 + 2), a = ws[0] ? t - ws[0].t0 : -1;
    if (a >= 0) { ctx.font = MONO(110); ctx.textAlign = 'center'; ctx.fillStyle = rgba(C.bone); ctx.fillText('Hi.'.slice(0, 1 + Math.floor(clamp(a / 0.3) * 2)), W / 2, H * 0.55); }
    if (Math.floor(t * 2) % 2 && t < 188) { ctx.fillStyle = rgba(C.pink); ctx.fillRect(W / 2 + 120, H * 0.55 - 80, 16, 92); }
    if (t > 188.6) { ctx.fillStyle = `rgba(0,0,0,${clamp((t - 188.6) / 0.8)})`; ctx.fillRect(-W, -H, W * 3, H * 3); }
  },
};
function measure(txt, size) { ctx.font = BIG(size); return ctx.measureText(txt).width; }
// Modular 式柱子：竖条 + 四分之一圆 + 点阵
function pillar(x, col, t, k) {
  ctx.fillStyle = rgba(col); ctx.fillRect(x - 70, -50, 140, H + 100);
  ctx.fillStyle = rgba(C.ink); for (let i = 0; i < 9; i++) ctx.fillRect(x - 70, 60 + i * 110 + ((t * 120) % 110), 140, 10);
  ctx.fillStyle = rgba(k ? C.pink : C.lime); ctx.beginPath(); ctx.moveTo(x + (k ? -70 : 70), H * 0.3); ctx.arc(x + (k ? -70 : 70), H * 0.3, 120, k ? Math.PI / 2 : 0, k ? Math.PI : Math.PI / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba(C.bone, 0.9); for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) ctx.fillRect(x - 40 + j * 30, H * 0.7 + i * 30, 8, 8);
}


// ---------- 全片用的小工具 ----------
// 卡拉 OK 式的一行字：这句里唱到的词依次出现，正在唱的那个白热
function lyricLine(t, a, b, { x = W / 2, y = H * 0.86, size = 64, align = 'center', cool = C.bone, alpha = 1 } = {}) {
  const ws = wordsIn(a, b).filter(w => t >= w.t0 - 0.02); if (!ws.length) return;
  ctx.font = BIG(size); const sp = ctx.measureText(' ').width;
  const widths = ws.map(w => ctx.measureText(w.w).width), tot = widths.reduce((p, q) => p + q, 0) + sp * (ws.length - 1);
  const k = tot > W * 0.9 ? (W * 0.9) / tot : 1;                       // 太长就整体缩小
  let cx = (align === 'center' ? x - tot * k / 2 : x);
  ws.forEach((w, i) => {
    const age = t - w.t0, sc = lerp(1.25, 1, outExpo(age / 0.12)) * k;
    ctx.save(); ctx.translate(cx + widths[i] * k / 2, y); ctx.scale(sc, sc); ctx.textAlign = 'center'; ctx.font = BIG(size);
    ctx.fillStyle = rgba(heat(age, cool), alpha); ctx.fillText(w.w, 0, 0); ctx.restore();
    cx += (widths[i] + sp) * k;
  });
}
const has = k => !!SH.img[k];
// 一张场景图：慢推 + 横移；没有就用暗底
function bgShot(key, t, s, { z0 = 1.02, z1 = 1.1, pan = 30, dim = 0 } = {}) {
  const u = clamp((t - s.t0) / Math.max(0.3, s.t1 - s.t0));
  if (has(key)) shot(ctx, key, { z: lerp(z0, z1, u), cx: 960 + lerp(pan, -pan, u) });
  else { bg(C.night, C.indigo); dotGrid(0.1); }
  if (dim > 0) { ctx.fillStyle = `rgba(4,4,14,${dim})`; ctx.fillRect(-W, -H, W * 3, H * 3); }
}
// 雨：斜线，按时间落（纯函数）
function rain(t, n = 160, a = 0.35) {
  ctx.strokeStyle = `rgba(190,210,255,${a})`; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = ((hash(i) * W * 1.3 + t * 260) % (W * 1.3)) - 100, y = ((hash(i + 99) * H + t * (900 + hash(i + 7) * 500)) % (H + 80)) - 40;
    ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 26);
  }
  ctx.stroke();
}
// 像素鸟（两帧扇翅）
function bird(x, y, sc, t) {
  const f = Math.floor(t * 10) % 2, P = f ? ['.X...X.', '..X.X..', '...X...'] : ['.......', 'XX.X.XX', '...X...'];
  ctx.fillStyle = rgba(C.bone);
  P.forEach((r, j) => [...r].forEach((c, i) => { if (c === 'X') ctx.fillRect(x + i * sc, y + j * sc, sc - 1, sc - 1); }));
}

// ---------- 相机：漂移 + 每个词 +3% + 震屏；硬切冲击帧 ----------
function camera(t, s) {
  const dur = s.t1 - s.t0, lt = t - s.t0, sid = SHOTS.indexOf(s);
  let z = 1 + 0.05 * lt / dur, roll = 0.012 * (hash(sid + 5) * 2 - 1) * lt / dur;
  for (const w of wordsIn(s.t0, Math.min(t, s.t1))) z *= 1 + 0.03 * outExpo((t - w.t0) / 0.2);
  const kick = env('kick', t);
  z *= 1 + 0.012 * kick;
  let amp = 3.5 * kick + 11 * pulse(t, s.t0, 0.12);
  if (s.n === 'brand') { amp += 22 * pulse(t, s.t0, 0.18) + 6; z *= lerp(1.38, 1, outExpo(lt / 0.12)); roll += lerp(0.09, 0, outExpo(lt / 0.16)); }
  if (s.n === 'thousand') { z *= lerp(1.38, 1, outExpo(lt / 0.12)); }
  if (s.n === 'mine') { const ch = clamp((t - 35.3) / (s.t1 - 35.3)); amp += 10 * ch * ch; const wp = inOutExpo((t - (s.t1 - 0.27)) / 0.27); z *= 1 + 1.6 * wp * wp; }
  if (s.n === 'never') amp += 7 * pulse(t, (wordsIn(s.t0, t + 0.001).slice(-1)[0] ?? s).t0, 0.1);
  // 交接前后 0.06 s 收住震动（让 match cut 对得上）
  amp *= clamp((s.t1 - t) / 0.06) * clamp(lt / 0.02 + 0.3);
  if (s.n === 'stop') { amp = 0; z = 1; roll = 0; }
  if (s.n === 'burst') { amp += 16 * env('kick', t); z *= 1 + 0.04 * env('kick', t); }
  const sx = noise1(t * 45) * amp, sy = noise1(t * 45 + 31.7) * amp;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(W / 2 + sx, H / 2 + sy); ctx.rotate(roll); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
}

// ---------- 后期：小图模糊叠加当辉光 + 颗粒 + 暗角 ----------
const GRAIN = Array.from({ length: 6 }, (_, k) => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), im = g.createImageData(256, 256); for (let i = 0; i < 65536; i++) { const v = 128 + (hash(i * 1.37 + k * 911) - 0.5) * 100; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); return c; });
function post(t, s) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  gctx.clearRect(0, 0, glow.width, glow.height); gctx.filter = 'blur(7px)'; gctx.drawImage(cv, 0, 0, glow.width, glow.height); gctx.filter = 'none';
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; ctx.drawImage(glow, 0, 0, W, H); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.2; const g = GRAIN[Math.floor(t * FPS) % 6]; for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) ctx.drawImage(g, x, y); ctx.restore();
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  if (BIGCUT.has(s.n) && t - s.t0 < 1 / FPS) { ctx.fillStyle = rgba(C.bone, 0.5); ctx.fillRect(0, 0, W, H); }   // 1 帧冲击帧
  mono(`CLEAN SLATE  ·  ${s.n.toUpperCase()}  ·  t = ${t.toFixed(2)}`, 40, H - 30, 14, C.bone, 0.4);
}

window.DRAW = t => draw(t);
function draw(t) {
  const s = SHOTS.find(x => t >= x.t0 && t < x.t1) ?? SHOTS[SHOTS.length - 1];
  camera(t, s);
  SHOT[s.n](t, s);
  const UNB = { sea1: 0.5, beads: 0.4, nothing: 0.35, waiting: 0.4, temp: 0.4, pre2: 0.5, run: 0.45, fall: 0.6, tobe: 0.5, dance: 0.3, palace: 0.55, code: 0.6,
                rules: 0.35, windows: 0.5, meet: 0.35, smile: 0.25, final: 0.4, shore: 0.35, lights: 0.4, burst: 0.9, gate: 0.4, sea: 0.4 };
  if (UNB[s.n]) unbuilt(ctx, cv, t, { bar: Math.floor((t - DB0) / (BEAT * 4)), amount: UNB[s.n], seed: SHOTS.indexOf(s), avoid: [W * 0.3, H * 0.15, W * 0.7, H * 0.95] });
  let gl = BIGCUT.has(s.n) ? pulse(t, s.t0, 0.05) : 0;
  if (s.n === 'never') { const lw = wordsIn(s.t0, t + 0.001).slice(-1)[0]; if (lw) gl = Math.max(gl, 0.6 * pulse(t, lw.t0, 0.04)); }
  if (t > 35.40 && t < 35.46 || t > 35.72 && t < 35.78) gl = 1;                 // 报错屏进出
  glitchSlices(ctx, cv, t, gl);
  post(t, s);
}

// ---------- 启动 ----------
const ui = document.getElementById('ui');
if (RENDER) {
  ui.remove();
  const n = Math.round((T1 - T0) * FPS), out = Q.get('out') ?? '-5_Clean Slate/样片/全片_v2_main.mp4';
  await fetch(`/start?w=${W}&h=${H}&fps=${FPS}&t0=${T0}&t1=${T1}&vflip=0&out=${encodeURIComponent(out)}`, { method: 'POST' });
  for (let i = 0; i < n; i++) {
    draw(T0 + i / FPS);
    const buf = ctx.getImageData(0, 0, W, H).data;
    for (let k = 0; ; k++) { try { await fetch('/frame?i=' + i, { method: 'POST', body: buf }); break; } catch (e) { if (k > 20) throw e; await new Promise(r => setTimeout(r, 300)); } }
  }
  await fetch('/done', { method: 'POST' }); log('render done', n);
} else if (Q.has('sheet')) {                       // 接触表：?sheet=起,止,步长（秒）
  const [a, b, st] = Q.get('sheet').split(',').map(Number), ts = [];
  for (let t = a; t < b; t += st) ts.push(t);
  const cols = 6, tw = 320, th = 180, rows = Math.ceil(ts.length / cols);
  const sh = document.createElement('canvas'); sh.width = cols * tw; sh.height = rows * (th + 16);
  const g = sh.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, sh.width, sh.height);
  ts.forEach((t, i) => { draw(t); g.drawImage(cv, (i % cols) * tw, Math.floor(i / cols) * (th + 16), tw, th); g.fillStyle = '#ff0'; g.font = '12px monospace'; g.fillText(`${t.toFixed(1)} ${(SHOTS.find(x => t >= x.t0 && t < x.t1) ?? {}).n}`, (i % cols) * tw + 4, Math.floor(i / cols) * (th + 16) + th + 12); });
  cv.remove(); document.body.appendChild(sh); sh.style.cssText = 'width:100vw;height:auto;position:static'; document.body.style.overflow = 'auto'; ui.remove();
} else if (STILL !== null) {
  draw(STILL); ui.textContent = `${STILL.toFixed(2)} s`;
} else {
  const audio = new Audio('../-5_Clean Slate/Clean Slate.wav'); let playing = false;
  addEventListener('click', () => { if (!playing) { audio.currentTime = T0; audio.play(); playing = true; } });
  addEventListener('keydown', e => { if (e.code === 'Space') audio.paused ? audio.play() : audio.pause(); if (e.code === 'ArrowRight') audio.currentTime += 1; if (e.code === 'ArrowLeft') audio.currentTime -= 1; });
  const loop = () => { let t = playing ? audio.currentTime : T0; if (playing && t > T1) { audio.currentTime = T0; t = T0; } draw(t); ui.textContent = `${t.toFixed(2)} s · 空格暂停 · ←/→ 跳 1 s`; requestAnimationFrame(loop); };
  loop();
}
