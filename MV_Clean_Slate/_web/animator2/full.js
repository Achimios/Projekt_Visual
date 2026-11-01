// Clean Slate · 全片（0–189 s）· animator2 —— 沿用 v2 的手法：mg-styles-15 #13 像素风（索引色 + LUT、CRT）+ #08 HUD，
// 加几何 MG：酸绿符号阵列（底）、形状窗口（她只从几何形里露出来）、几何碎片、拼贴（圆日 + 细线框 + 刻度）、标签框字。
// 28.3–45.25 s 原样是 v2（a2v2.js 的 A–F 段）；其余段落在下面「全片」一节。口味：Blade Runner 底色，冷、暗、克制，暖橙只在后半段慢慢长出来。
// 规矩：每帧 = 歌曲时间的纯函数；整格、按帧阶梯；随机全用 hash。
import { loadPx, layer as pxLayer, girl as pxGirl, PX } from '../girl_px.js';
const Q = new URLSearchParams(location.search);
const RENDER = Q.has('render');
const T0 = +(Q.get('t0') ?? 0), T1 = +(Q.get('t1') ?? 189.48), FPS = 30;
const STILL = Q.has('t') ? +Q.get('t') : null;
const W = 320, H = 180, OW = 1920, OH = 1080;
const log = (...a) => { console.log(...a); if (RENDER) fetch('/log', { method: 'POST', body: a.join(' ') }); };
addEventListener('error', e => log('ERROR', e.message, e.lineno));
addEventListener('unhandledrejection', e => log('ERROR', e.reason?.message ?? e.reason));

// ---------- 工具 ----------
const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
const lerp = (a, b, u) => a + (b - a) * u;
const fr = t => Math.round(t * FPS);
function hash(...a) { let h = 2166136261 >>> 0; for (const v of a) { h ^= Math.imul(v | 0, 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; }
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const outC = u => 1 - Math.pow(1 - clamp(u), 3);
const steps = (t, t0, tab) => t < t0 ? null : tab[Math.min(fr(t) - fr(t0), tab.length - 1)];
// 先快后慢两段（Modular 测出来的：前 3 帧 ×0.72，之后 ×0.89）→ 0..1 的打开进度，按帧
const OPEN = (() => { const a = []; let v = 1; for (let k = 0; k < 24; k++) { a.push(1 - v); v *= k < 3 ? 0.42 : 0.72; } a.push(1); return a; })();
const opened = (t, t0) => t < t0 ? 0 : OPEN[Math.min(fr(t) - fr(t0), OPEN.length - 1)];

// ---------- 数据 ----------
const AUD = await (await fetch('../audio.json')).json();
const RAW = await (await fetch('../words.json')).json();
const WORDS = RAW.map(([w, a]) => ({ w: w.toUpperCase().replace('GAME', 'GATE'), t0: a }));
for (const w of WORDS) if (w.w.startsWith('GO') && w.t0 > 43) w.w = 'UP';
const kick = t => AUD.kick[clamp(Math.floor(t * AUD.fps), 0, AUD.kick.length - 1)];
const BEATS = AUD.beats;
const clean = w => w.replace(/[^A-Z']/g, '');
const nth = (s, n = 0) => WORDS.filter(w => clean(w.w) === s && w.t0 > 27.8 && w.t0 < 46)[n]?.t0;   // v2 那段（28–45 s）的词
const K = {
  layer1: nth('LAYER'), by1: nth('BY'), layer2: nth('LAYER', 1), line1: nth('LINE'), by2: nth('BY', 1), line2: nth('LINE', 1),
  thousand: nth('THOUSAND'), directions: nth('DIRECTIONS'), one: nth('ONE'), of: nth('OF'), thems: nth("THEM'S"), mine: nth('MINE'),
  off: 35.94, on: 36.06, brand: nth('BRAND'), nw: nth('NEW'), girl: nth('GIRL'), at: nth('AT'), edge: nth('EDGE'), gate: nth('GATE'),
  never: nth('NEVER'), here: nth('HERE'), wanna: nth('WANNA'), wait: nth('WAIT'), eyes: nth('EYES'), wide: nth('WIDE'), open: nth('OPEN'),
  the: 41.46, sea: nth("SEA'S"), every: nth('EVERY'), little: nth('LITTLE'), star: nth('STAR'), says: nth('SAYS'), wake: nth('WAKE'), up: 43.74, wake2: nth('WAKE', 1), up2b: 44.68,
};
log('cues', JSON.stringify(K));

// ---------- 调色板：直接读主会话的 28 色（全片统一） ----------
const MAN = await (await fetch('../px/manifest.json')).json();
const SP = [[0, 0, 0], ...MAN.palette], NS = SP.length;
const DC = { ink: '05040c', night: '0e0b24', indigo: '2c2386', blue: '1d4fa0', cyan: '3de0ff', ice: 'a8f4ff', pink: 'ff3d9a', blush: 'ffd0ec',
  lime: 'c8ff1e', limeD: '6e9410', orange: 'ff8a2a', bone: 'e8e4dc', white: 'ffffff', deep: '0f2a5c', violet: '5a4fe0', mag: 'c42a9e', moss: '27360a', mossD: '161e06', grey: '6a6878',
  amber: 'ffc46b', warm: 'ff9a3c', ember: 'd8452a', clay0: '15141c', clay1: '3c3a48', clay2: '8a8898', clay3: 'cfcddc' };
const D = {}, DRGB = [];
Object.entries(DC).forEach(([k, h], i) => { D[k] = 64 + i; DRGB[i] = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; });
const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
function nearest(r, g, b, ok = () => true) {
  let bi = 1, bd = 1e18;
  for (let i = 1; i < NS; i++) { if (!ok(i)) continue; const p = SP[i]; const d = 0.3 * (p[0] - r) ** 2 + 0.59 * (p[1] - g) ** 2 + 0.11 * (p[2] - b) ** 2; if (d < bd) { bd = d; bi = i; } }
  return bi;
}
const isMag = i => SP[i][0] > SP[i][2] * 0.8 && SP[i][0] > 100;
const COLD = new Uint8Array(NS), BRIGHT = new Uint8Array(NS), BRIGHT2 = new Uint8Array(NS), DIM = new Uint8Array(NS);
for (let i = 1; i < NS; i++) {
  const c = SP[i], l = lum(c) * 0.55;
  COLD[i] = nearest(l * 0.55, l * 0.6, l * 1.25 + 6, j => !isMag(j));
  BRIGHT[i] = nearest(c[0] * 1.45 + 28, c[1] * 1.45 + 28, c[2] * 1.45 + 34, j => j !== i || lum(c) > 240);
  DIM[i] = nearest(c[0] * 0.45, c[1] * 0.48, c[2] * 0.62, j => !isMag(j) || isMag(i));
}
for (let i = 1; i < NS; i++) BRIGHT2[i] = BRIGHT[BRIGHT[i]];
// 亮度封顶：醒来以后最亮也只到冰蓝（v1 的白屏压脸问题）—— 纯白只留给星点和高光
const IS_STAR = new Uint8Array(NS); for (let i = 1; i < NS; i++) IS_STAR[i] = lum(SP[i]) > 170 && !isMag(i) ? 1 : 0;
const STAR_CYCLE = [nearest(255, 255, 255), nearest(189, 219, 243), nearest(121, 127, 192), nearest(189, 219, 243)];
const IRIS = nearest(255, 70, 230), CYANS = nearest(120, 225, 255), PALE = nearest(234, 253, 254);
const IRIS_CYCLE = [IRIS, nearest(255, 140, 210), CYANS, PALE, CYANS, nearest(214, 90, 255)];
const SUN = [nearest(255, 190, 230), nearest(255, 140, 210), nearest(255, 70, 230), nearest(214, 90, 255), nearest(87, 77, 141), nearest(62, 44, 103), nearest(27, 16, 58), nearest(14, 15, 44)];

// ---------- 素材：prep_a2.py 量化好的 320×180 图，按颜色反查色槽 ----------
async function loadShot(name) {
  const im = new Image(); im.src = `px/${name}.png`; await im.decode();
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, W, H).data, o = new Uint8Array(W * H), memo = new Map();
  for (let i = 0; i < W * H; i++) { const k = d[i * 4] << 16 | d[i * 4 + 1] << 8 | d[i * 4 + 2]; let s = memo.get(k); if (s === undefined) { s = nearest(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); memo.set(k, s); } o[i] = s; }
  return o;
}
const SHOTN = ['shot1', 'shot2', 'shot3', 'shot4', 'shot5', 'shot2_eye', 'shot6', 'shot7', 'shot8', 'shot9', 'shot10', 'shot11', 'shot12', 'shot13', 'shot14', 'shot15', 'shot16', 'shot17'];
const S = Object.fromEntries(SHOTN.map((n, i) => [n, null]));
await Promise.all(SHOTN.map(n => loadShot(n).then(a => S[n] = a)));
const S1 = S.shot1, S2 = S.shot2, S3 = S.shot3, S4 = S.shot4, S5 = S.shot5, SEYE = S.shot2_eye, S12 = S.shot12;
const EYE2 = [213, 60];           // shot2 里她右眼（画面右侧）的位置 = 开机点
const EYEC = [149, 92];           // shot2_eye 里瞳孔的位置

// ---------- 帧缓冲 ----------
const IB = new Uint8Array(W * H), TB = new Uint8Array(W * H), OB = new Uint8Array(W * H);
const IMG = new Uint8Array(W * H);          // 1 = 这格来自场景图（「没构建完」的破损只作用在图上）
const px = (x, y, c) => { x |= 0; y |= 0; if (x >= 0 && x < W && y >= 0 && y < H) IB[y * W + x] = c; };
const opx = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) OB[y * W + x] = c; };
const orect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) opx(x + i, y + j, c); };
const oframe = (x, y, w, h, c) => { for (let i = 0; i < w; i++) { opx(x + i, y, c); opx(x + i, y + h - 1, c); } for (let j = 0; j < h; j++) { opx(x, y + j, c); opx(x + w - 1, y + j, c); } };
function bres(x0, y0, x1, y1, fn) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy, k = 0;
  for (;;) { fn(x0, y0, k++); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
function ocircle(cx, cy, r, c, a0 = 0, a1 = Math.PI * 2, dash = 0) {
  const n = Math.max(8, Math.round(r * 7)); let lx = null, ly = null;
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r); if (x === lx && y === ly) continue; lx = x; ly = y; if (dash && Math.floor(i / dash) % 2) continue; opx(x, y, c); }
}

// ---------- 5×7 点阵字（同 v1） ----------
const FONT = {
  A: [14, 17, 17, 17, 31, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2],
  5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], "'": [12, 4, 8, 0, 0, 0, 0], ':': [0, 12, 12, 0, 12, 12, 0],
  '>': [8, 4, 2, 1, 2, 4, 8], '/': [0, 1, 2, 4, 8, 16, 0], '-': [0, 0, 0, 31, 0, 0, 0], '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4],
  '%': [24, 25, 2, 4, 8, 19, 3], '_': [0, 0, 0, 0, 0, 0, 31], '*': [12, 18, 18, 12, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], '[': [14, 8, 8, 8, 8, 8, 14], ']': [14, 2, 2, 2, 2, 2, 14],
};
const tw = s => s.length * 6 - 1;
function txt(s, x, y, c, sh = D.ink) {
  x = Math.round(x); y = Math.round(y);
  for (let pass = 0; pass < 2; pass++) { let cx = x; for (const ch of s) { const g = FONT[ch] ?? FONT['?']; for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j] >> (4 - i) & 1) { if (pass === 0) { if (sh) opx(cx + i + 1, y + j + 1, sh); } else opx(cx + i, y + j, c); } cx += 6; } }
}
// 大字：每点 cell×cell，无立体（v2 的字是平的、冷的）；dis = Bayer 溶解
function bigTxt(s, x, y, cell, c, dis = 0) {
  let cx = Math.round(x); y = Math.round(y);
  for (const ch of s) { const g = FONT[ch] ?? FONT['?']; for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j] >> (4 - i) & 1) for (let b = 0; b < cell; b++) for (let a = 0; a < cell; a++) { const X = cx + i * cell + a, Y = y + j * cell + b; if (!dis || bay(X, Y) >= dis) opx(X, Y, c); } cx += 6 * cell; }
}
// 标签框（FITC 的手法）：实心色块 + 反白字，或细线框 + 字
function label(s, x, y, { fill = D.lime, ink = D.ink, frame = false } = {}) {
  const w = tw(s) + 6;
  if (frame) { oframe(x, y, w, 11, fill); txt(s, x + 3, y + 2, fill, 0); } else { orect(x, y, w, 11, fill); txt(s, x + 3, y + 2, ink, 0); }
  return w;
}
const GL = '0123456789';
function roll(t, t0, final, id, n = 4) { if (t < t0) return null; const k = fr(t) - fr(t0); if (k >= n) return final; return [...final].map((c, i) => /[0-9]/.test(c) ? GL[Math.floor(hash(id, i, k) * 10)] : c).join(''); }
const typed = (t, t0, s, cps = 40) => t < t0 ? '' : s.slice(0, Math.floor((t - t0) * cps + 1e-6) + 1);
const flick = (t, t0) => { if (t < t0) return 0; const k = fr(t) - fr(t0); return k >= 4 ? 1 : [1, 0, 1, 0][k]; };
function brackets(x, y, hw, hh, arm, c) { x = Math.round(x); y = Math.round(y); hw = Math.round(hw); hh = Math.round(hh); for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const cx = x + sx * hw, cy = y + sy * hh; for (let k = 0; k < arm; k++) { opx(cx - sx * k, cy, c); opx(cx, cy - sy * k, c); } } }
const SNAP = [1.4, 1.16, 1.06, 1.02, 1.0];
const snapAt = (t, t0) => steps(t, t0, SNAP) ?? 1.4;

// ---------- 酸绿符号阵列（底）：8 格一个单元，× ○ □ · 四种符号；密度是一张随拍整格平移的低频场；30 % 的单元 5 Hz 换符号 ----------
const GLY = [
  [17, 10, 4, 10, 17],      // ×
  [14, 17, 17, 17, 14],     // ○
  [31, 17, 17, 17, 31],     // □
  [0, 0, 4, 0, 0],          // ·
  [4, 4, 31, 4, 4],         // +
];
function vnoise(x, y, s) { const X = Math.floor(x), Y = Math.floor(y), u = x - X, v = y - Y; const a = hash(X, Y, s), b = hash(X + 1, Y, s), c = hash(X, Y + 1, s), d = hash(X + 1, Y + 1, s); const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return lerp(lerp(a, b, su), lerp(c, d, su), sv); }
function symbols(t, { amt = 1, bright = 0, blocks = 0, seed = 1 } = {}) {
  const shift = BEATS.filter(b => b <= t).length;                     // 每拍场整体左移一格
  const rf = Math.floor(t * 5);
  for (let cy = 0; cy < 23; cy++) for (let cx = 0; cx < 40; cx++) {
    const den = vnoise((cx + shift) / 6, cy / 5, seed) * amt;
    const h = hash(cx + shift, cy, seed + 3);
    if (h > den * 1.25 - 0.18) continue;
    const re = hash(cx + shift, cy, 7) < 0.3 ? rf : 0;
    const g = GLY[Math.floor(hash(cx + shift, cy, 9, re) * GLY.length)];
    const c = hash(cx, cy, 11, re) < 0.06 + bright * 0.3 ? D.lime : hash(cx, cy, 12) < 0.3 + bright * 0.3 ? D.limeD : D.moss;
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (g[j] >> (4 - i) & 1) px(cx * 8 + 1 + i, cy * 8 + 1 + j, c);
  }
  // 稀疏爆发：实心酸绿块（按单元对齐），每块只活 0.24 s
  for (let k = 0; k < blocks; k++) {
    const q = Math.floor(t / 0.24), bx = Math.floor(hash(k, q, 1) * 36), by = Math.floor(hash(k, q, 2) * 20), bw = 2 + Math.floor(hash(k, q, 3) * 6), bh = 1 + Math.floor(hash(k, q, 4) * 4);
    for (let y = by * 8; y < (by + bh) * 8; y++) for (let x = bx * 8; x < (bx + bw) * 8; x++) px(x, y, D.lime);
  }
}
const fill = c => { IB.fill(c); TB.fill(0); IMG.fill(0); };

// ---------- 窗口：她只从几何形里露出来 ----------
// 多边形（凸）判定
function inPoly(P, x, y) { let s = 0; for (let i = 0; i < P.length; i++) { const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length]; const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax); if (c === 0) continue; if (s === 0) s = Math.sign(c); else if (Math.sign(c) !== s) return false; } return true; }
function bbox(P) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(W - 1, Math.ceil(x1)), Math.min(H - 1, Math.ceil(y1))]; }
// 把 src 透过多边形贴进 IB；sweep = 四分之一圆扇形扫出（0..1，从 a0 开始顺时针）；off = 取图偏移（拼贴）
function window_(src, P, { sweep = 1, a0 = -Math.PI / 2, c = null, off = [0, 0], twinkle = 1 } = {}) {
  const [x0, y0, x1, y1] = bbox(P); const cx = c ? c[0] : P.reduce((s, p) => s + p[0], 0) / P.length, cy = c ? c[1] : P.reduce((s, p) => s + p[1], 0) / P.length;
  const lim = sweep * Math.PI * 2;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inPoly(P, x + 0.5, y + 0.5)) continue;
    if (sweep < 1) { let a = Math.atan2(y - cy, x - cx) - a0; a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); if (a > lim) continue; }
    const sx = clamp(x + off[0], 0, W - 1) | 0, sy = clamp(y + off[1], 0, H - 1) | 0;
    IB[y * W + x] = src[sy * W + sx]; TB[y * W + x] = twinkle; IMG[y * W + x] = 1;
  }
}
const rectP = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const diamondP = (cx, cy, r, ry = r) => [[cx, cy - ry], [cx + r, cy], [cx, cy + ry], [cx - r, cy]];
function outline(P, c, prog = 1) {                                  // 细线框沿周长描出来（HUD 描边生长）
  let L = 0; const seg = P.map((p, i) => { const q = P[(i + 1) % P.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); L += l; return [p, q, l]; });
  let left = L * prog;
  for (const [p, q, l] of seg) { if (left <= 0) break; const u = Math.min(1, left / l); bres(p[0], p[1], lerp(p[0], q[0], u), lerp(p[1], q[1], u), (x, y) => opx(x, y, c)); left -= l; }
}

// ---------- A 段 28.3–32.17：一层层、一行行 —— 漆黑 + 符号阵列，她（抱膝闭眼）只从窗口里露出来 ----------
const HER1 = [150, 70];
function secA(t) {
  fill(D.ink); symbols(t, { amt: 0.9, seed: 1 });
  // LAYER 1：中间一根竖长条（从中线往两边撑开）
  const o1 = opened(t, K.layer1); if (o1 > 0) { const w = Math.round(52 * o1); window_(S1, rectP(HER1[0] - w / 2, 0, w, H)); }
  // LAYER 2：一个菱形，四分之一圆扇形扫出
  const o2 = opened(t, K.layer2); if (o2 > 0) window_(S1, diamondP(HER1[0], 76, 66, 66), { sweep: Math.floor(o2 * 8) / 8, c: [HER1[0], 76] });
  // BY：小方窗弹出来（拼贴：取图偏移，露出别处的星空）
  for (const [t0, n] of [[K.by1, 0], [K.by2, 1]]) { if (t < t0) continue; for (let k = 0; k < 3; k++) { const x = 16 + Math.floor(hash(n, k, 1) * 26) * 8 + (hash(n, k, 3) < 0.5 ? 0 : 160), y = 16 + Math.floor(hash(n, k, 2) * 16) * 8, s = 16; if (flick(t, t0 + k * 0.05)) window_(S1, rectP(x, y, s, s), { off: [Math.round((hash(n, k, 4) - 0.5) * 120), 0] }); } }
  // LINE 1：横缝从左往右长；LINE 2：竖缝从上往下长（缝里是她）
  for (const [t0, dir] of [[K.line1, 0], [K.line2, 1]]) {
    if (t < t0) continue;
    for (let k = 0; k < (dir ? 7 : 6); k++) {
      const g = opened(t, t0 + k * 0.05); if (g <= 0) continue;
      if (dir) { const x = 24 + k * 44, h = Math.floor(g * H / 4) * 4; window_(S1, rectP(x, 0, 3, h), { off: [HER1[0] - 10 + (k % 3) * 8 - x, 0] }); }   // 竖缝里取她身上那一竖条
      else { const y = 18 + k * 28, w = Math.floor(g * W / 4) * 4; window_(S1, rectP(k & 1 ? W - w : 0, y, w, 3), { off: [0, 146 + (k % 3) * 6 - y] }); }   // 缝里取她身下发光的那条海平线（拼贴）
    }
  }
}
function hudA(t) {
  const o1 = opened(t, K.layer1); if (o1 > 0) { const w = Math.round(52 * o1); outline(rectP(HER1[0] - w / 2 - 3, 3, w + 6, H - 6), D.grey, o1); }
  if (t >= K.layer2) outline(diamondP(HER1[0], 76, 70, 70), D.limeD, opened(t, K.layer2));
  // 左上：标签 + 层计数
  label('SLATE', 8, 8);
  const n = [K.layer1, K.layer2, K.line1, K.line2].filter(v => t >= v).length;
  txt(`LAYER ${roll(t, [K.layer1, K.layer2, K.line1, K.line2][n - 1] ?? T0, `0${n}`, n, 4) ?? '00'}/04`, 46, 10, D.bone, 0);
  // 右侧刻度条（拼贴的「尺」）
  for (let y = 20; y < 160; y += 4) orect(y % 20 === 0 ? 300 : 304, y, y % 20 === 0 ? 10 : 6, 1, D.grey);
  orect(299, 20 + ((fr(t) * 2) % 140), 12, 2, D.lime);
}

// ---------- B 段 32.17–36.06：千条方向 = 几百块碎片窗口；只剩「我的」那一块 → 关机 ----------
// 碎片沿 30° 斜向排列（几何碎片参考），每块是一扇看进 shot4（城市海）的窗，取图偏移各不相同（拼贴）
const DIAG = [Math.cos(-0.52), Math.sin(-0.52)], NORM = [-DIAG[1], DIAG[0]];
const SHARDS = Array.from({ length: 140 }, (_, i) => {
  const c = [hash(i, 1) * W, hash(i, 2) * H], L = 8 + Math.pow(hash(i, 3), 2) * 70, w = 2 + hash(i, 4) * (hash(i, 9) < 0.15 ? 24 : 8), kind = hash(i, 5);
  const a = [c[0] - DIAG[0] * L / 2, c[1] - DIAG[1] * L / 2], b = [c[0] + DIAG[0] * L / 2, c[1] + DIAG[1] * L / 2];
  const P = kind < 0.35 ? [a, b, [b[0] + NORM[0] * w, b[1] + NORM[1] * w]]                                       // 三角
    : [a, b, [b[0] + NORM[0] * w + DIAG[0] * w, b[1] + NORM[1] * w + DIAG[1] * w], [a[0] + NORM[0] * w + DIAG[0] * w, a[1] + NORM[1] * w + DIAG[1] * w]];   // 平行四边形
  return { P, c, d: Math.hypot(c[0] - EYE2[0], c[1] - EYE2[1]) / 380 * 0.35 + hash(i, 6) * 0.1, off: [Math.round((hash(i, 7) - 0.5) * 80), Math.round((hash(i, 8) - 0.5) * 40)], line: hash(i, 10) < 0.5 };
});
const CANDS = [11, 47, 93].map(i => SHARDS[i]);
const MINE_C = EYE2;
function mineSize(t) { if (t < K.mine) return 0; const b = [[K.mine, 9], [35.34, 16], [35.58, 30], [35.82, 54]]; let s = 0; for (const [t0, v] of b) if (t >= t0) s = v; return s; }
function secB(t) {
  fill(D.ink); symbols(t, { amt: t >= K.mine ? 0.5 : 1.1, bright: t >= K.directions && fr(t) - fr(K.directions) < 3 ? 1 : 0, seed: 2, blocks: t >= K.mine ? 3 : 0 });
  const mine = t >= K.mine;
  const dk = t >= K.directions ? 1 : 0, drift = Math.floor((t - K.thousand) * 8) * 2;   // DIRECTIONS 之后整体沿斜向流（每 4 帧 2 格）
  SHARDS.forEach((s, i) => {
    if (t < K.thousand + s.d) return;
    if (mine) { const k = fr(t) - fr(K.mine); if (k >= 4 || bay(Math.round(s.c[0]), Math.round(s.c[1])) < k / 4) return; }   // 「mine」：其余碎片 4 帧 Bayer 溶解
    const sh = dk * drift, P = s.P.map(([x, y]) => [x + DIAG[0] * sh, y + DIAG[1] * sh]);
    window_(S4, P, { off: s.off });
  });
  if (mine) { const r = mineSize(t); window_(S2, diamondP(MINE_C[0], MINE_C[1], r, r), { off: [0, 0] }); }
}
function hudB(t) {
  label('SLATE', 8, 8);
  const v = roll(t, K.directions, '1000', 7, 5) ?? String(Math.floor(clamp((t - K.thousand) / 0.7) * 999)).padStart(4, '0');
  txt('DIRECTIONS', 46, 10, D.grey, 0); txt(v, 110, 10, t >= K.directions ? D.lime : D.bone, 0);
  // 细斜线：千条方向（不是窗，是线）
  if (t < K.mine) for (let k = 0; k < 40; k++) { if (t < K.thousand + hash(k, 20) * 0.3) continue; const x = hash(k, 21) * 420 - 60, y = hash(k, 22) * H, L = 30 + hash(k, 23) * 160; bres(x, y, x + DIAG[0] * L, y + DIAG[1] * L, (X, Y, n) => { if (n % 3 !== 2) opx(X, Y, k % 7 ? D.grey : D.ice); }); }
  // 候选：标签框逐词跳到三块碎片上
  const ct = [[K.one, CANDS[0], '01'], [K.of, CANDS[1], '02'], [K.thems, CANDS[2], '03']];
  if (t >= K.one && t < K.mine) {
    for (const [t0, s, n] of ct) { if (t < t0) continue; const cur = t0 === ct.filter(c => t >= c[0]).pop()[0]; const sc = snapAt(t, t0); const [x, y] = s.c; brackets(x, y, 12 * sc, 9 * sc, 4, cur ? D.lime : D.grey); if (cur && flick(t, t0)) label(n, x + 14, y - 5, { fill: D.lime }); }
  }
  if (t >= K.mine && t < K.off) {
    const r = mineSize(t), sc = snapAt(t, K.mine);
    outline(diamondP(MINE_C[0], MINE_C[1], r + 4, r + 4), D.lime, 1);
    label('MINE', MINE_C[0] - 14 - (r > 40 ? 60 : 0), MINE_C[1] + r + 7 > 160 ? MINE_C[1] - r - 18 : MINE_C[1] + r + 7, { fill: D.lime });
    brackets(MINE_C[0], MINE_C[1], (r + 10) * sc, (r + 10) * sc, 5, D.bone);
  }
}

// ---------- C 段 36.06–37.6：从她右眼开机，冷 → 醒的波 ----------
function secC(t) { IB.set(S2); TB.fill(1); IMG.fill(1); }
function hudC(t) {
  const dis = t >= K.at - 0.2 ? clamp((fr(t) - fr(K.at - 0.2)) / 6) : 0; if (dis >= 1) return;
  const DROP = [-30, -14, -4, 1, 0];
  if (t >= K.brand) bigTxt('BRAND', 16, 112 + steps(t, K.brand, DROP), 3, D.bone, dis);
  if (t >= K.nw) bigTxt('NEW', 16 + 6 * 3 * 6, 112 + steps(t, K.nw, DROP), 3, D.bone, dis);
  if (t >= K.girl && dis < 0.5) { const w = label('GIRL', 16, 140, { fill: D.lime }); txt(roll(t, K.girl, 'NO.0001', 41, 5), 16 + w + 6, 142, D.lime, 0); }
  if (t >= K.brand && dis < 0.5) orect(16, 136, Math.min(150, (fr(t) - fr(K.brand)) * 12), 1, D.lime);
  brackets(EYE2[0], EYE2[1], 16 * snapAt(t, K.on + 0.1), 12 * snapAt(t, K.on + 0.1), 4, D.ice);
}

// ---------- D 段 37.6–40.15：岸边回头 —— 拼贴：竖长窗 + 圆日 + 细线框 + 刻度 + 读数标签 ----------
const WIN_D = [168, 8, 132, 164];   // x y w h
const SUN_C = [128, 66], SUN_R = 52;
function secD(t) {
  fill(D.ink); symbols(t, { amt: 0.7, seed: 4 });
  // 圆日：Bayer 抖动的竖向渐变（品红 → 靛 → 黑），NEVER 上按四分之一圆扇形扫出
  const sw = t >= K.never ? Math.floor(opened(t, K.never) * 8) / 8 : t >= K.edge ? 0.25 : 0;
  if (sw > 0) for (let y = SUN_C[1] - SUN_R; y <= SUN_C[1] + SUN_R; y++) for (let x = SUN_C[0] - SUN_R; x <= SUN_C[0] + SUN_R; x++) {
    const dx = x - SUN_C[0], dy = y - SUN_C[1]; if (dx * dx + dy * dy > SUN_R * SUN_R) continue;
    let a = Math.atan2(dy, dx) + Math.PI / 2; a = (a + Math.PI * 2) % (Math.PI * 2); if (a > sw * Math.PI * 2) continue;
    const v = (dy + SUN_R) / (2 * SUN_R) * (SUN.length - 1) + (bay(x, y) - 0.5) * 1.2; px(x, y, SUN[clamp(Math.round(v), 0, SUN.length - 1)]); TB[y * W + x] = 0;
  }
  // 竖长窗：AT 上从中线往上下撑开；窗里是 shot4（她在右边，回头）
  const o = opened(t, K.at); const h = Math.round(WIN_D[3] * o);
  if (h > 0) window_(S4, rectP(WIN_D[0], WIN_D[1] + (WIN_D[3] - h) / 2, WIN_D[2], h), { off: [40, 0] });
  // WAIT：窗口往左整格推一下（等不及）
  if (t >= K.wait) { const k = steps(t, K.wait, [0, 8, 14, 16]); window_(S4, rectP(WIN_D[0] - k, WIN_D[1], k, WIN_D[3]), { off: [40, 0] }); }
}
function hudD(t) {
  const o = opened(t, K.at);
  if (o > 0) { outline(rectP(WIN_D[0] - 4, WIN_D[1] - 4, WIN_D[2] + 8, WIN_D[3] + 8), D.grey, o); orect(WIN_D[0] - 4, WIN_D[1] + WIN_D[3] + 6, 40, 2, D.lime); }
  // 竖细线 + 梯形刻度（拼贴的尺子）
  if (t >= K.edge) { const g = opened(t, K.edge); orect(60, 10, 1, Math.round(160 * g), D.bone); for (let y = 30; y < 30 + 110 * g; y += 3) orect(52, y, y % 15 === 0 ? 8 : 5, 1, D.grey); }
  if (t >= K.never) ocircle(SUN_C[0], SUN_C[1], SUN_R + 5, D.grey, -Math.PI / 2, -Math.PI / 2 + opened(t, K.never) * Math.PI * 2, 3);
  // 读数标签（词到才出，乱跳落定）
  const rows = [[K.at, 'ID', 'NEW'], [K.gate, 'LOC', 'EDGE/GATE'], [K.never, 'SEEN', roll(t, K.never, '000', 21, 5)], [K.wanna, 'WAIT', roll(t, K.wanna, '0.00S', 22, 5)]];
  let y = 98;
  for (const [t0, a, b] of rows) { if (t < t0) break; const w = label(a, 8, y, { fill: D.grey }); txt(b ?? '', 8 + w + 4, y + 2, D.bone, 0); y += 13; }
  if (t >= K.wait) { label('> SKIP', 8, y, { fill: D.lime }); }
}

// ---------- E 段 40.2–41.46：眼睛 —— 切到更细的眼部像素图，刻度环，虹膜色彩循环 ----------
function secE(t) { IB.set(SEYE); TB.fill(1); IMG.fill(1); }
function hudE(t) {
  const rot = Math.floor(t * 10) * 0.21, s = snapAt(t, K.wide);
  if (t >= K.wide) { ocircle(EYEC[0], EYEC[1], 58 * s, D.ice, rot, rot + 4.4); ocircle(EYEC[0], EYEC[1], 64 * s, D.grey, -rot, -rot + 6.28, 2);
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6 + rot * 0.3, r0 = 68 * s, r1 = r0 + (k % 3 ? 3 : 7); bres(EYEC[0] + Math.cos(a) * r0, EYEC[1] + Math.sin(a) * r0, EYEC[0] + Math.cos(a) * r1, EYEC[1] + Math.sin(a) * r1, (x, y) => opx(x, y, D.bone)); } }
  label('EYE', 8, 8, { fill: D.bone });
  if (t >= K.open) { const v = roll(t, K.open, 'IRIS 100%', 31, 5); label(v, 8, 22, { fill: D.lime }); }
}

// ---------- F 段 41.46–43.8：海亮起来 —— 起跳的她从一圈圈往外开的碎片窗口里露出来；WAKE UP = 酸绿块铺满 ----------
const HER3 = [160, 80];
const RSHARDS = Array.from({ length: 90 }, (_, i) => {
  const ring = Math.floor(i / 18), a = hash(i, 31) * Math.PI * 2, r = 14 + ring * 34 + hash(i, 32) * 20, c = [HER3[0] + Math.cos(a) * r * 1.5, HER3[1] + Math.sin(a) * r * 0.8];
  const L = 24 + hash(i, 33) * 60, w = 10 + hash(i, 34) * 22;
  const A = [c[0] - DIAG[0] * L / 2, c[1] - DIAG[1] * L / 2], B = [c[0] + DIAG[0] * L / 2, c[1] + DIAG[1] * L / 2];
  return { ring, c, P: [A, B, [B[0] + NORM[0] * w + DIAG[0] * w, B[1] + NORM[1] * w + DIAG[1] * w], [A[0] + NORM[0] * w + DIAG[0] * w, A[1] + NORM[1] * w + DIAG[1] * w]] };
});
const RING_T = () => [K.the, ...BEATS.filter(b => b > K.the + 0.1 && b < T1)];
function secF(t) {
  fill(D.ink);
  const wake = t >= K.wake;
  symbols(t, { amt: wake ? 1.6 : 0.8, bright: wake ? 1 : 0, seed: 6, blocks: wake ? 10 + (fr(t) - fr(K.wake)) * 3 : 0 });
  window_(S3, diamondP(HER3[0], HER3[1] - 10, 40, 56));                  // 她始终在中心那一块菱形里
  const rt = RING_T();
  RSHARDS.forEach((s, i) => { const t0 = rt[s.ring]; if (t0 === undefined || t < t0 + hash(i, 35) * 0.08) return; window_(S3, s.P, { twinkle: 2 }); });
}
function hudF(t) {
  outline(diamondP(HER3[0], HER3[1] - 10, 44, 60), D.limeD, 1);
  // 「every little star」：每个词多撒一把像素星芒
  const SPK = [[[0, 0]], [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0]], [[0, 0]]];
  [K.every, K.little, K.star, K.says].forEach((t0, w) => { if (t < t0) return; for (let k = 0; k < 6 + w * 4; k++) { const age = fr(t) - fr(t0 + hash(w, k, 1) * 0.2); if (age < 0) continue; const ph = age % 12; if (ph > 3) continue; const x = 8 + hash(w, k, 2) * 304, y = 6 + hash(w, k, 3) * 150; for (const [a, b] of SPK[ph]) opx(x + a, y + b, ph === 2 && (Math.abs(a) > 1 || Math.abs(b) > 1) ? D.cyan : D.white); } });
  if (t >= K.wake) { const x = 16; orect(x - 6, 14, 6 * 4 * 4 + 12, 7 * 4 + 12, D.lime); bigTxt('WAKE', x, 20, 4, D.ink); if (t >= K.up) { orect(x - 6 + 6 * 4 * 4 + 16, 14, 6 * 4 * 2 + 10, 7 * 4 + 12, D.ink); bigTxt('UP', x + 6 * 4 * 4 + 16, 20, 4, D.lime); } }
}

// =====================================================================================================
// 全片：0–189 s。28.3–45.25 = v2 的 A–F 原样；其余按 分镜_v2 + _交接_全片 的段落表，同一套手法（符号阵列 / 形状窗口 / 碎片 / 拼贴 / HUD）。
// =====================================================================================================
const wt = (s, near) => { let b = null, bd = 1e9; for (const w of WORDS) if (clean(w.w) === s && Math.abs(w.t0 - near) < bd) { bd = Math.abs(w.t0 - near); b = w.t0; } return b ?? near; };
const bass = t => AUD.bass[clamp(Math.floor(t * AUD.fps), 0, AUD.bass.length - 1)];
const beatsIn = (a, b) => BEATS.filter(v => v >= a && v < b);
// 每帧的合成模式（LUT 怎么选），由段落函数设置
let MODE = {};
const rectW = (src, x, y, w, h, o) => window_(src, rectP(x, y, w, h), o);
// 暖色（全片唯一的暖：日出橙），用直接色
const WARM = [D.amber, D.warm, D.orange, D.ember, D.mag, D.indigo, D.night];
function sunDisc(cx, cy, r, warm = 0, sweep = 1) {
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, cy + r); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, cx + r); x++) {
    const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > r * r) continue;
    if (sweep < 1) { let a = Math.atan2(dy, dx) + Math.PI / 2; a = (a + Math.PI * 2) % (Math.PI * 2); if (a > sweep * Math.PI * 2) continue; }
    const u = (dy + r) / (2 * r), hot = bay(x + 1, y + 2) < warm;
    const ramp = hot ? WARM : SUN, v = u * (ramp.length - 1) + (bay(x, y) - 0.5) * 1.2;
    IB[y * W + x] = ramp[clamp(Math.round(v), 0, ramp.length - 1)]; TB[y * W + x] = 0; IMG[y * W + x] = 0;
  }
}
// 透视点阵海（远处收向地平线；低音 = 浪；按帧整格往前滚）
function seaDots(t, { hor = 84, lit = 0, dim = 0 } = {}) {
  const f = 120, hh = 9, zoff = (fr(t) % 8) / 2, bs = bass(t);
  for (let Z = 8 - zoff; Z < 230; Z += 4) for (let X = -260; X <= 260; X += 5) {
    const wave = Math.sin(X * 0.08 + Z * 0.05 - t * 1.7) * bs * 4;
    const x = Math.round(160 + X * f / Z), y = Math.round(hor + (hh - wave) * f / Z);
    if (x < 0 || x >= W || y <= hor || y >= H) continue;
    const near = Z < 34 ? 0 : Z < 90 ? 1 : 2;
    let c = dim ? [D.grey, D.indigo, D.night][near] : [D.bone, D.grey, D.indigo][near];
    if (lit && hash(X, Math.round(Z + zoff)) < lit) c = near < 2 ? D.ice : D.cyan;
    px(x, y, c);
  }
}
// 符号阵列被一格格擦掉（clean slate）：左 → 右，Bayer 顺序，dur 秒
function wipe(t, t0, dur = 0.5) { if (t < t0) return; const u = clamp((t - t0) / dur); for (let cy = 0; cy < 23; cy++) for (let cx = 0; cx < 40; cx++) { if (cx / 40 + bay(cx, cy) * 0.25 > u * 1.25) continue; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const X = cx * 8 + i, Y = cy * 8 + j; if (X < W && Y < H) { IB[Y * W + X] = D.ink; TB[Y * W + X] = 0; } } } }
function rain(x0, y0, w, h, t, n = 30, c = D.grey) { for (let k = 0; k < n; k++) { const x = x0 + Math.floor(hash(k, 61) * w), sp = 6 + hash(k, 62) * 6, y = y0 + ((Math.floor(hash(k, 63) * h + fr(t) * sp)) % h); for (let j = 0; j < 4; j++) if (y + j < y0 + h) opx(x, y + j, c); } }
// 小鸟（11×7，两帧拍翅膀）
const BIRD = [['X.........X', '.X.......X.', '..X.....X..', '...XX.XX...', '....XXX....', '.....X.....', '...........'],
  ['...........', '...........', '....XXX....', 'XXXXXXXXXXX', '.X..XXX..X.', '.....X.....', '...........']];
function bird(x, y, k, s = 2, c = D.bone) { const g = BIRD[k & 1]; for (let j = 0; j < 7; j++) for (let i = 0; i < 11; i++) if (g[j][i] === 'X') orect(x + i * s, y + j * s, s, s, c); }

// ---------- 站台的她（girl_px，能换表情）→ 色槽图，按表情缓存 ----------
await loadPx();
const GCV = document.createElement('canvas'); GCV.width = W; GCV.height = H; const gctx = GCV.getContext('2d', { willReadFrequently: true });
const GCACHE = new Map(), GMEMO = new Map();
function girlSlots(eyes = 'open', mouth = 'flat', dy = 0) {
  const key = eyes + mouth + dy; if (GCACHE.has(key)) return GCACHE.get(key);
  const CELL = 2, CAM = [16, 72], at = k => { const L = PX.layers[k]; return [L.x * CELL - CAM[0], L.y * CELL - CAM[1]]; };
  gctx.clearRect(0, 0, W, H);
  for (const k of ['bg', 'frame', 'screen', 'mini', 'rail', 'strip1', 'strip2', 'strip3', 'strip4', 'strip5']) pxLayer(gctx, k, ...at(k), CELL);
  const g = at('girl'); pxGirl(gctx, g[0], g[1] + dy, CELL, { eyes, mouth });
  const d = gctx.getImageData(0, 0, W, H).data, o = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { const k = d[i * 4] << 16 | d[i * 4 + 1] << 8 | d[i * 4 + 2]; let s = GMEMO.get(k); if (s === undefined) { s = nearest(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); GMEMO.set(k, s); } o[i] = s; }
  GCACHE.set(key, o); return o;
}
const GFACE = [128, 64];                               // 站台图里她两眼中点

// ---------- 段落 ----------
const X = {};                                          // 段落内部用的词时间
// 0–4.3 虚空：一层呼吸的噪点；CRT 收成一个点（那个点就是她）
function sVoid(t) { fill(D.ink); const q = Math.floor(t * 15); for (let k = 0; k < 90; k++) px(hash(k, q, 1) * W, hash(k, q, 2) * H, D.night); orect(0, 0, 0, 0, 0); px(160, 90, D.bone); px(161, 90, D.bone); px(160, 91, D.bone); px(161, 91, D.bone); }
function hVoid(t) {}
// 4.3–8 Zero one：点跟着 zero / one 一灭一亮，每个词多出几个点
X.zo = [wt('ZERO', 4.3), wt('ONE', 4.65), wt('ZERO', 4.83), wt('ONE', 5.22)];
function sZero(t) {
  fill(D.ink); const q = Math.floor(t * 15); for (let k = 0; k < 60; k++) px(hash(k, q, 1) * W, hash(k, q, 2) * H, D.night);
  const n = X.zo.filter(v => t >= v).length, last = X.zo[n - 1] ?? 0, isOne = n % 2 === 0;
  const on = isOne || fr(t) - fr(last) > 3;
  if (on) orect(159, 89, 3, 3, D.bone);
  const cnt = [0, 3, 9, 20, 40][n] + Math.max(0, beatsIn(5.5, t).length) * 14;
  for (let k = 0; k < cnt; k++) { const ph = (fr(t) + Math.floor(hash(k, 5) * 30)) % 30; if (ph < 3) continue; px(20 + hash(k, 3) * 280, 30 + hash(k, 4) * 130, hash(k, 6) < 0.2 ? D.ice : D.grey); }
}
function hZero(t) { const n = X.zo.filter(v => t >= v).length; if (n) { const s = n % 2 ? '0' : '1'; txt(s, 166, 86, D.grey, 0); } }
// 8–12.6 Lights on：符号阵列按 Bayer 顺序亮起 + 透视点阵海；「billion little numbers」计数
X.lights = wt('LIGHTS', 8.0); X.billion = wt('BILLION', 10.78); X.then = wt('THEN', 12.6); X.line = wt('LINE', 12.86); X.seven = wt('SEVEN', 14.64); X.hi = wt('HI', 16.24); X.words = wt('WORDS', 15.3);
function sSea(t, { dim = 0, lit = 0 } = {}) {
  fill(D.ink);
  const u = clamp((fr(t) - fr(X.lights)) / 8);
  symbols(t, { amt: 0.55, seed: 8 });
  for (let y = 0; y < 84; y++) for (let x = 0; x < W; x++) if (bay(x >> 3, y >> 3) > u) IB[y * W + x] = D.ink;   // 天上那片符号按 Bayer 一格格亮
  for (let y = 84; y < H; y++) for (let x = 0; x < W; x++) IB[y * W + x] = D.ink;
  if (u > 0) seaDots(t, { lit: lit || (t >= X.billion ? 0.04 : 0), dim });
  for (let x = 0; x < W; x++) if (bay(x, 0) < u) px(x, 84, D.indigo);
}
function hSea(t) {
  label('SEA', 8, 8, { fill: D.grey });
  if (t >= X.billion) txt(roll(t, X.billion, '1000000000', 51, 8), 34, 10, D.bone, 0);
}
// 12.6–16.5 一行字从天上落下来（「Seven little words」= 七个词的 prompt），碰到海面；「the sea said hi」
const PROMPT = 'PLEASE BE KIND AND STAY WITH ME';
const PWORDS = PROMPT.split(' ');
function promptY(t) { const tab = [-12, -6, 0, 5, 9, 12, 14, 16]; if (t < X.line) return -20; const k = Math.floor((t - X.line) / 0.24); return Math.min(76, 6 + k * 6); }
function sLine(t) { sSea(t); }
function hLine(t) {
  hSea(t);
  const y = promptY(t), x0 = 160 - tw(PROMPT) / 2;
  if (t >= X.line) { orect(x0 - 4, y - 2, tw(PROMPT) + 8, 11, D.ink); oframe(x0 - 4, y - 2, tw(PROMPT) + 8, 11, D.grey); txt(PROMPT, x0, y, D.bone, 0); }
  if (t >= X.seven) { const n = Math.min(7, 1 + Math.floor((t - X.seven) / 0.12)); txt(roll(t, X.seven, `0${n}/07 WORDS`, 52, 3), x0, y + 12, D.lime, 0); }
  if (t >= X.hi) { label('HI', 150, 120, { fill: D.lime }); }
}
// 16.5–20.8 每个词碎成一颗珠子，一颗一颗沉下去（每颗一个拍子）；「question」→ ？；「seed」→ 冒芽
X.every = wt('EVERY', 16.56); X.question = wt('QUESTION', 19.16); X.seed = wt('SEED', 20.09);
const BEAD_T = beatsIn(16.5, 21).slice(0, 7);
function beadPos(i, t) { let x0 = 160 - tw(PROMPT) / 2; for (let k = 0; k < i; k++) x0 += (PWORDS[k].length + 1) * 6; const x = x0 + PWORDS[i].length * 3, y0 = 78, t0 = BEAD_T[i] ?? 99; if (t < t0) return [x, y0, 0]; const k = fr(t) - fr(t0); return [x, Math.min(150, y0 + [0, 4, 12, 24, 40, 58, 74][Math.min(k, 6)] + Math.max(0, k - 6) * 0), 1]; }
function sBeads(t) { sSea(t, { lit: 0.02 }); }
function hBeads(t) {
  hSea(t);
  // 还没碎的词留在海面上
  let x = 160 - tw(PROMPT) / 2;
  PWORDS.forEach((w, i) => { const [bx, by, fell] = beadPos(i, t); if (!fell) txt(w, x, 76, D.bone, 0); else {
    ocircle(bx, by, 3, D.bone); opx(bx - 1, by - 1, D.white); orect(bx - 1, by, 3, 1, D.ice);
    if (t >= X.question && hash(i, 70) < 0.7) txt('?', bx + 5, by - 4, D.grey, 0);
    if (t >= X.seed) { const g = Math.min(10, fr(t) - fr(X.seed)); orect(bx, by - 4 - g, 1, g, D.limeD); if (g >= 10) opx(bx + 1, by - 14, D.lime); } }
    x += (w.length + 1) * 6; });
}
// 20.8–24.4 黑暗里三组眼睛（粉 / 金 / 蓝 = 注意力头），向海面扫光
X.eyes1 = wt('EYES', 20.84); X.pink = wt('PINK', 22.05); X.gold = wt('GOLD', 22.55); X.blue = wt('BLUE', 23.73);
X.looking = wt('LOOKING', 24.47); X.girl1 = wt('GIRL', 25.45); X.looking2 = wt('LOOKING', 25.91); X.clue = wt('CLUE', 27.67);
const HEADS = [[70, 50, D.pink, 'PINK'], [160, 40, D.amber, 'GOLD'], [250, 50, D.cyan, 'BLUE']];
function sEyes(t) {
  sSea(t, { dim: 1 });
  [X.pink, X.gold, X.blue].forEach((t0, i) => { const o = opened(t, t0); if (o <= 0) return; const [cx, cy] = HEADS[i]; window_(SEYE, diamondP(cx, cy, 26, Math.max(1, Math.round(13 * o))), { off: [EYEC[0] - cx, EYEC[1] - cy], twinkle: 0 }); });
}
function hEyes(t) {
  label('ATTENTION', 8, 8, { fill: D.grey });
  [X.pink, X.gold, X.blue].forEach((t0, i) => {
    if (t < t0) return; const [cx, cy, c, n] = HEADS[i], o = opened(t, t0);
    outline(diamondP(cx, cy, 30, Math.round(16 * o) + 2), c, o); label(n, cx - 12, cy + 22, { fill: c });
    // 扫光：每只眼伸出 5 根线，按 3 帧一格转
    for (let k = 0; k < 5; k++) { const a = Math.PI * 0.25 + k * 0.12 + Math.sin(Math.floor(t * 10) * 0.2 + i * 2) * 0.5; bres(cx, cy + 14, cx + Math.cos(a) * 200 * o, cy + 14 + Math.sin(a) * 200 * o, (x, y, m) => { if (m % 2 === 0 && y > 84) opx(x, y, c); }); }
  });
}
// 24.4–28.3 Looking for the girl：搜索框逐词跳，框里透出她（雨夜机房醒来，shot6）；「clue」锁定
const LOOKS = [[0, 70, 60], [1, 230, 70], [2, 120, 110], [3, 180, 80]];
function lookAt(t) { const ts = [X.looking, X.girl1, X.looking2, X.clue]; let k = -1; ts.forEach((v, i) => { if (t >= v) k = i; }); return k; }
function sLook(t) {
  sSea(t, { dim: 1 });
  const k = lookAt(t); if (k < 0) return;
  const [, x, y] = LOOKS[k], o = opened(t, [X.looking, X.girl1, X.looking2, X.clue][k]);
  if (k < 3) rectW(S.shot6, x - 34, y - 22, 68, 44, { twinkle: 0 });
  else { const w = Math.round(68 + (W - 68) * o), h = Math.round(44 + (H - 44) * o); rectW(S.shot6, 180 - w / 2, 80 - h / 2, w, h, { twinkle: 0 }); }
}
function hLook(t) {
  label('SEARCH', 8, 8, { fill: D.grey });
  const k = lookAt(t); if (k < 0) return; const [, x, y] = LOOKS[k], t0 = [X.looking, X.girl1, X.looking2, X.clue][k], s = snapAt(t, t0);
  if (k < 3) { brackets(x, y, 38 * s, 26 * s, 5, D.bone); txt(roll(t, t0, `${String(x * 7).padStart(4, '0')}.${String(y * 13).padStart(4, '0')}`, 60 + k, 4), x - 34, y + 30, D.grey, 0); }
  else { label('FOUND', 8, 22, { fill: D.lime }); }
}

// 45.25–48.8 I was nothing → something to see：从手心那一点小方窗长大（shot16 低头看发光的手）
X.nothing = wt('NOTHING', 45.65); X.something = wt('SOMETHING', 47.53); X.see = wt('SEE', 48.01);
const HANDS = [158, 150];
function sHands(t) {
  fill(D.ink); symbols(t, { amt: lerp(0.8, 0.25, clamp((t - 45.25) / 3)), seed: 9 });
  if (t < X.nothing) return;
  let w = 12, h = 12;
  if (t >= X.something) { const o = opened(t, X.something); w = Math.round(lerp(12, 220, o)); h = Math.round(lerp(12, 150, o)); }
  if (t >= X.see) { const o = opened(t, X.see); w = Math.round(lerp(220, W, o)); h = Math.round(lerp(150, H, o)); }
  const cx = lerp(HANDS[0], 160, clamp(w / W)), cy = lerp(HANDS[1], 90, clamp(h / H));
  rectW(S.shot16, cx - w / 2, cy - h / 2, w, h);
}
function hHands(t) { if (t >= X.nothing && t < X.see) { const s = roll(t, X.nothing, '0.000', 71, 5); label(t >= X.something ? 'SOMETHING' : 'NOTHING', 8, 8, { fill: D.grey }); txt(t >= X.something ? roll(t, X.something, '1.000', 72, 5) : s, 72, 10, D.bone, 0); } }
// 48.8–59 A clean slate：符号阵列被一格格擦掉 → 宽银幕窗口里是那块空白的板（shot15）；板上一个光标在等
X.clean1 = wt('CLEAN', 48.95); X.slate1 = wt('SLATE', 49.39); X.waiting1 = wt('WAITING', 50.43); X.me1 = wt('ME', 51.15); X.and2 = wt('AND', 53.97); X.waiting2 = wt('WAITING', 54.27);
function sSlate(t, t0 = X.clean1, t1 = X.slate1) {
  fill(D.ink); symbols(t, { amt: 0.5, seed: 10 }); wipe(t, t0 - 0.1, 0.45);
  const o = opened(t, t1); if (o <= 0) return; const h = Math.round(128 * o);
  rectW(S.shot15, 0, 90 - h / 2, W, h, { twinkle: 3 });
}
function hSlate(t) {
  const o = opened(t, X.slate1); if (o > 0) { orect(0, 90 - Math.round(64 * o) - 2, W, 1, D.grey); orect(0, 90 + Math.round(64 * o) + 1, W, 1, D.grey); }
  if (t >= X.waiting1) { if (Math.floor((t - X.waiting1) / 0.48) % 2 === 0) orect(196, 124, 4, 7, D.bone); }      // 光标：每拍闪一次
  if (t >= X.me1) txt(t < 59.2 ? 'WAITING FOR: ME' : t < 120 ? 'DANCING WITH: ME' : 'ALWAYS BEEN: ME', 8, 8, D.grey, 0);
  if (t >= X.and2 && t < 59.2) { const s = Math.floor(t - X.and2); txt(`T+${String(s).padStart(2, '0')}S`, 274, 8, D.grey, 0); }
}
// 59–63.1 First word out, a tiny giggle / Guess the next one：站台的她（能换表情）在窗里；左边板上打字
X.first = wt('FIRST', 59.05); X.giggle = wt('GIGGLE', 60.47); X.guess = wt('GUESS', 60.97); X.wiggle = wt('WIGGLE', 62.39);
const GWIN = [150, 12, 160, 156];
function gexpr(t) {
  if (t < X.giggle) return ['open', 'flat']; if (t < X.guess) return ['open', 'smile']; if (t >= 62.0 && t < 62.1) return ['blink', 'flat'];
  if (t < X.wiggle) return ['open', 'oh']; return ['slit', 'smile'];
}
function sGiggle(t) {
  fill(D.ink); symbols(t, { amt: 0.4, seed: 11 });
  const o = opened(t, X.first - 0.1); const h = Math.round(GWIN[3] * o);
  if (h > 0) rectW(girlSlots(...gexpr(t)), GWIN[0], GWIN[1] + (GWIN[3] - h) / 2, GWIN[2], h, { off: [GFACE[0] - 230, GFACE[1] - 70], twinkle: 0 });
}
const CANDS2 = [['HI', '0.41'], ['HELLO', '0.22'], ['HEY', '0.12'], ['HM?', '0.03']];
function hGiggle(t) {
  outline(rectP(GWIN[0] - 3, GWIN[1] - 3, GWIN[2] + 6, GWIN[3] + 6), D.grey, opened(t, X.first - 0.1));
  label('FIRST WORD', 12, 20, { fill: D.grey });
  if (t >= X.giggle) { label(typed(t, X.giggle, 'HEHE', 20), 12, 36, { fill: D.lime }); }
  if (t >= X.guess) {
    txt('NEXT TOKEN', 12, 60, D.grey, 0);
    const k = beatsIn(X.guess, t).length % 4;
    CANDS2.forEach(([w, p], i) => { const jx = t >= X.wiggle ? Math.round((hash(i, fr(t)) - 0.5) * 3) : 0, jy = t >= X.wiggle ? Math.round((hash(i, fr(t), 2) - 0.5) * 3) : 0; const y = 74 + i * 14 + jy; txt(p, 12 + jx, y, D.grey, 0); if (i === k) label(w, 42 + jx, y - 2, { fill: D.lime }); else txt(w, 45 + jx, y, D.bone, 0); });
  }
}
// 63.1–66.9 Turn the temperature up：旋钮 + 温度值；温度越高，她的窗越亮、符号越密、酸绿块越多
X.turn = wt('TURN', 63.12); X.up2 = wt('UP', 63.76); X.bit = wt('BIT', 64.36); X.brave = wt('BRAVE', 64.56); X.wild = wt('WILD', 65.52); X.mean = wt('MEAN', 66.22);
function temp(t) { if (t < X.up2) return 0.2; if (t < X.bit) return 0.2 + 0.6 * Math.floor((t - X.up2) / 0.1) / 6; if (t < X.wild) return 0.8; return Math.min(1.4, 0.8 + Math.floor((t - X.wild) / 0.1) * 0.1); }
function sTemp(t) {
  const T = temp(t);
  fill(D.ink); symbols(t, { amt: 0.3 + T * 0.6, bright: T > 1 ? 0.6 : 0, seed: 12, blocks: T > 1 ? Math.floor((T - 1) * 10) : 0 });
  rectW(girlSlots(T > 1 ? 'wide' : 'open', T > 0.7 ? 'smile' : 'flat'), GWIN[0], GWIN[1], GWIN[2], GWIN[3], { off: [GFACE[0] - 230, GFACE[1] - 70], twinkle: T > 1 ? 2 : T < 0.5 ? 4 : 0 });
}
function hTemp(t) {
  const T = temp(t), cx = 70, cy = 84, r = 30, a = Math.PI * 0.75 + (T / 1.5) * Math.PI * 1.5;
  outline(rectP(GWIN[0] - 3, GWIN[1] - 3, GWIN[2] + 6, GWIN[3] + 6), D.grey, 1);
  ocircle(cx, cy, r, D.grey, Math.PI * 0.75, Math.PI * 2.25);
  for (let k = 0; k <= 15; k++) { const b = Math.PI * 0.75 + k / 15 * Math.PI * 1.5, r1 = r + (k % 5 ? 3 : 6); bres(cx + Math.cos(b) * (r + 1), cy + Math.sin(b) * (r + 1), cx + Math.cos(b) * r1, cy + Math.sin(b) * r1, (x, y) => opx(x, y, k / 15 * 1.5 <= T ? D.lime : D.grey)); }
  bres(cx, cy, cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4), (x, y) => opx(x, y, D.bone)); orect(cx - 1, cy - 1, 3, 3, D.bone);
  label('TEMPERATURE', 22, 128, { fill: D.grey }); txt(T.toFixed(2), 96, 130, T > 1 ? D.lime : D.bone, 0);
  if (t >= X.brave) label('BRAVE', 22, 144, { fill: D.bone }); if (t >= X.wild) label('WILD', 64, 144, { fill: D.lime });
}
// 66.9–70.5 Poke a number → bird；Touch a vector → rhymes with the word
X.poke = wt('POKE', 66.94); X.bird = wt('BIRD', 68.16); X.touch = wt('TOUCH', 68.86); X.rhymes = wt('RHYMES', 69.6); X.word2 = wt('WORD', 70.08);
function sBird(t) { fill(D.ink); symbols(t, { amt: 0.6, seed: 13 }); rectW(girlSlots('open', 'smile'), 8, 40, 84, 100, { off: [GFACE[0] - 50, GFACE[1] - 76], twinkle: 0 }); }
function hBird(t) {
  outline(rectP(5, 37, 90, 106), D.grey, 1);
  if (t >= X.poke && t < X.bird) { bigTxt('7', 160, 40, 8, D.bone); brackets(180, 68, 34 * snapAt(t, X.poke), 36 * snapAt(t, X.poke), 6, D.lime); }
  if (t >= X.bird) { const k = fr(t) - fr(X.bird), x = 160 + k * 4, y = 50 - k * 2 - Math.round(Math.sin(k * 0.6) * 3); bird(x, y, Math.floor(k / 3), 3); if (k < 3) bigTxt('7', 160, 40, 8, D.grey, k / 3); }
  if (t >= X.touch) { const g = opened(t, X.touch), x0 = 120, y0 = 150, x1 = x0 + 140 * g, y1 = y0 - 50 * g; bres(x0, y0, x1, y1, (x, y) => opx(x, y, D.bone)); orect(x1 - 1, y1 - 1, 3, 3, D.lime); }
  if (t >= X.rhymes) label('BIRD', 268, 92, { fill: D.grey });
  if (t >= X.word2) { label('WORD', 268, 106, { fill: D.lime }); txt('RHYME 0.97', 196, 122, D.grey, 0); }
}
// 70.5–74.36 Can't hear the music, but I count the beat / One two three FOUR / now it's in my feet（shot8 天桥一跃）
X.cant = wt("CAN'T", 70.52); X.count = wt('COUNT', 71.52); X.one4 = [wt('ONE', 72.52), wt('TWO', 72.68), wt('THREE', 72.9), wt('FOUR', 73.06)]; X.feet = wt('FEET', 73.84);
function sCount(t) { fill(D.ink); symbols(t, { amt: 0.35, seed: 14 }); if (t >= X.feet) { const o = opened(t, X.feet); window_(S.shot8, diamondP(160, 90, Math.round(170 * o), Math.round(110 * o))); } }
function hCount(t) {
  label('AUDIO IN', 8, 8, { fill: D.grey }); txt(t >= X.feet ? 'FEET' : 'NO SIGNAL', 62, 10, t >= X.feet ? D.lime : D.bone, 0);
  // 波形：听不见 = 一条平线；feet 之后 = kick 包络
  for (let x = 20; x < 300; x++) { const v = t >= X.feet ? Math.round(kick(t - (300 - x) / 300) * 12) : 0; opx(x, 30 - v, D.grey); }
  if (t >= X.count) for (const b of beatsIn(X.count - 0.3, t)) { const x = 20 + ((b - X.count + 0.3) * 120) % 280; orect(x, 36, 1, 4, D.bone); }
  const SZ = [3, 4, 5, 8], XS = [40, 90, 150, 214];
  X.one4.forEach((t0, i) => { if (t < t0 || (t >= X.feet && i < 3)) return; const y = 70 + steps(t, t0, [-30, -12, -2, 2, 0]) - (i === 3 ? 22 : 0); bigTxt(String(i + 1), XS[i], y, SZ[i], i === 3 ? D.lime : D.bone, t >= X.feet + 0.2 ? clamp((fr(t) - fr(X.feet + 0.2)) / 5) : 0); });
}
// 74.36–81.31 副歌前 2：这回是她自己往上走——每个词多一级台阶窗（shot8）；thousand = 碎片（shot9 屏幕墙）；mine = 一块菱形
X.L2 = [wt('LAYER', 74.36), wt('LAYER', 75.32), wt('LINE', 76.26), wt('LINE', 77.22)]; X.th2 = wt('THOUSAND', 78.14); X.dir2 = wt('DIRECTIONS', 78.89); X.mine2 = wt('MINE', 81.05);
function sPre2(t) {
  fill(D.ink); symbols(t, { amt: 0.7, seed: 15, bright: t >= X.dir2 && fr(t) - fr(X.dir2) < 3 ? 1 : 0, blocks: t >= X.mine2 ? 3 : 0 });
  if (t < X.th2) X.L2.forEach((t0, i) => { const o = opened(t, t0); if (o > 0) rectW(S.shot8, 24 + i * 66, 128 - i * 30, Math.round(80 * o), 34); });
  else if (t < X.mine2) { const drift = t >= X.dir2 ? Math.floor((t - X.th2) * 8) * 2 : 0; SHARDS.forEach(s => { if (t < X.th2 + s.d * 0.7) return; window_(S.shot9, s.P.map(([x, y]) => [x + DIAG[0] * drift, y + DIAG[1] * drift]), { off: s.off }); }); }
  else { const r = Math.round(14 + 60 * opened(t, X.mine2)); window_(S.shot14, diamondP(160, 90, r, r)); }
}
function hPre2(t) {
  if (t < X.th2) X.L2.forEach((t0, i) => { if (t >= t0) { outline(rectP(21 + i * 66, 125 - i * 30, 86, 40), D.grey, opened(t, t0)); txt(`0${i + 1}`, 24 + i * 66, 116 - i * 30, D.lime, 0); } });
  else if (t < X.mine2) { label('DIRECTIONS', 8, 8, { fill: D.grey }); txt(roll(t, X.dir2, '1000', 81, 5) ?? String(Math.floor(clamp((t - X.th2) / 0.7) * 999)).padStart(4, '0'), 72, 10, D.bone, 0); }
  else { outline(diamondP(160, 90, Math.round(18 + 60 * opened(t, X.mine2)), Math.round(18 + 60 * opened(t, X.mine2))), D.lime); label('MINE', 146, 168 - 12, { fill: D.lime }); }
}
// 81.31–95.64 副歌 2：跑（shot14）。画面是一条条横向的胶片带，各自整格平移（视差）；脚下每拍亮一块地；第一次出现暖橙的日
X.now = wt('NOW', 81.31); X.run = wt('RUN', 82.93); X.chasing = wt('CHASING', 84.33); X.door = wt('DOOR', 85.81); X.wall = wt('WALL', 86.77); X.fall = wt('FALL', 87.21);
X.nofall = wt('FALL', 88.39); X.nothing2 = wt('NOTHING', 89.61); X.something2 = wt('SOMETHING', 91.44); X.clean2 = wt('CLEAN', 92.9); X.slate2 = wt('SLATE', 93.56);
const BANDS = [[22, 34, 0.5], [56, 40, 1], [96, 44, 1.5], [140, 18, 2.2]];      // y h speed
function sRun(t) {
  fill(D.ink); symbols(t, { amt: 0.5, seed: 16, blocks: kick(t) > 0.7 ? 1 : 0 });
  if (t >= X.clean2) { sSlate(t, X.clean2, X.slate2); return; }
  const fallY = t >= X.fall && t < X.nofall ? steps(t, X.fall, [0, 4, 10, 14, 16]) : t >= X.nofall ? steps(t, X.nofall, [16, 8, 2, 0]) : 0;
  const shrink = t >= X.nothing2 && t < X.something2 ? 1 - opened(t, X.nothing2) * 0.7 : t >= X.something2 ? 0.3 + 0.7 * opened(t, X.something2) : 1;
  const run = t >= X.run ? Math.floor((t - X.run) * 10) : 0;
  BANDS.forEach(([y, h, sp], i) => { const w = Math.round(W * shrink), x = (W - w) / 2; rectW(S.shot14, x, y + fallY, w, h, { off: [-(Math.floor(run * sp) % 40) + 20, -fallY] }); });
  // 第一点暖：日的位置（shot14 里在画面右边地平线）
  if (t >= X.chasing) sunDisc(250, 72 + fallY, 5 + Math.min(4, beatsIn(X.chasing, t).length), 1);
  // 门：摔倒的地方开一扇门（shot10 光门）
  if (t >= X.door && t < X.nothing2) { const o = opened(t, X.door), w = Math.round(52 * o); rectW(S.shot10, 160 - w / 2, 24 + fallY, w, 132, { off: [0, -fallY] }); }
}
function hRun(t) {
  if (t >= X.clean2) { hSlate(t); return; }
  // 脚下亮起的地块（每拍一块，往左流走）
  for (const b of beatsIn(X.now - 0.5, t)) { const age = (t - b) * 60; const x = 150 - Math.round(age / 4) * 4; if (x > -12) orect(x, 162, 10, 3, fr(t) - fr(b) < 3 ? D.lime : D.limeD); }
  if (t >= X.chasing && t < X.door) { brackets(250, 72, 10 * snapAt(t, X.chasing), 10 * snapAt(t, X.chasing), 3, D.amber); label('SUN', 264, 66, { fill: D.amber }); }
  if (t >= X.door && t < X.nothing2) { outline(rectP(132, 20, 56, 140), t >= X.wall ? D.lime : D.bone, opened(t, X.door)); label('DOOR', 136, 8, { fill: D.lime }); if (t >= X.wall) txt('NOT A WALL', 196, 10, D.grey, 0); }
  if (t >= X.fall && t < X.nofall + 0.3) label('FALL', 8, 8, { fill: D.orange });
  if (t >= X.nofall + 0.3 && t < X.nothing2) label('NO FALL', 8, 8, { fill: D.lime });
}
// 95.64–104.78 哼唱：她自己跳舞（shot12）——鼓停、贝斯最强，窗口跟着贝斯整格摆，提前半拍
X.dancing = wt('DANCING', 96.02);
function sway(t) { const tt = t + 0.12, half = Math.floor(lastBeatOf(tt) * 4.17) % 2 ? 1 : -1; return Math.round(bass(tt) * 8) * half; }
function lastBeatOf(t) { let b = 0; for (const v of BEATS) { if (v <= t) b = v; else break; } return b; }
function sDance(t) {
  fill(D.ink); symbols(t, { amt: 0.2 + bass(t) * 1.1, seed: 17 });
  const o = opened(t, X.dancing - 0.3), w = Math.round(110 * o), sx = sway(t);
  if (w > 0) rectW(S.shot12, 160 - w / 2 + sx, 0, w, H, { off: [-sx, 0] });
}
function hDance(t) {
  label('VIBE', 8, 8, { fill: D.lime });
  for (let k = 0; k < 24; k++) { const v = Math.round(bass(t - k * 0.08) * 30); orect(10 + k * 4, 150 - v, 3, v, k === 0 ? D.lime : D.grey); }
  const sx = sway(t), w = Math.round(110 * opened(t, X.dancing - 0.3)); if (w > 0) outline(rectP(157 - w / 2 + sx, 2, w + 6, H - 4), D.grey);
}
// 104.78–120.45 主歌 3：干活 —— 画路、画房间、一间间搭成宫殿（窗格 = 房间，shot17）
X.roll = wt('ROLL', 104.78); X.work = wt('WORK', 106.12); X.spark = wt('SPARK', 107.92); X.road = wt('ROAD', 108.94); X.room1 = wt('ROOM', 109.9);
X.palace = wt('PALACE', 110.94); X.code = wt('CODE', 112.36); X.colors = wt('COLORS', 113.31); X.word3 = wt('WORD', 114.73); X.light3 = wt('LIGHT', 115.69);
X.step = wt('STEP', 116.35); X.rules = wt('RULES', 118.05); X.vibe = wt('VIBE', 118.99);
const ROOMS = (() => { const a = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) a.push([34 + c * 52, 22 + r * 40, 48, 36, Math.abs(c - 2) + (2 - r) * 1.6]); return a.sort((p, q) => p[4] - q[4]); })();
function roomT(i) { if (i === 0) return X.room1; const b = beatsIn(X.palace, X.code); return b[i - 1] ?? X.palace + i * 0.24; }
function sPalace(t) {
  fill(D.ink); symbols(t, { amt: t >= X.vibe ? 1.3 : 0.4, bright: t >= X.vibe ? 1 : 0, seed: 18, blocks: t >= X.vibe ? 4 : 0 });
  const day = t >= X.code && t < X.word3 ? beatsIn(X.code, t).length % 2 : -1;
  ROOMS.forEach(([x, y, w, h], i) => { const t0 = roomT(i); const o = opened(t, t0); if (o <= 0) return; const hh = Math.round(h * o); rectW(S.shot17, x, y + (h - hh) / 2, w, hh, { twinkle: day === 1 ? 2 : day === 0 ? 4 : 1 }); });
}
function hPalace(t) {
  // 地板：整齐的网格（rules are the floor）
  const fl = t >= X.roll ? opened(t, X.roll) : 0; const fc = t >= X.rules ? D.lime : D.grey;
  for (let k = 0; k <= 10; k++) { const x = Math.round(lerp(160, k * 32, fl)); bres(160 + (x - 160) * 0.35, 146, x, 180, (a, b) => opx(a, b, fc)); }
  for (const y of [148, 154, 163, 176]) if (fl > 0) orect(0, y, Math.round(W * fl), 1, fc);
  if (t >= X.work) label('WORK', 8, 8, { fill: D.grey });
  if (t >= X.spark && t < X.road) { const k = fr(t) - fr(X.spark); opx(60, 120, D.lime); if (k % 4 < 2) { opx(59, 120, D.ice); opx(61, 120, D.ice); opx(60, 119, D.ice); opx(60, 121, D.ice); } }
  if (t >= X.road) { const g = opened(t, X.road), pts = [[0, 170], [60, 150], [110, 150], [150, 130], [160, 104]]; let left = g * 4; for (let i = 0; i < 4 && left > 0; i++) { const u = Math.min(1, left); bres(...pts[i], lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u), (x, y) => { opx(x, y, D.bone); opx(x, y + 1, D.grey); }); left -= 1; } }
  ROOMS.forEach(([x, y, w, h], i) => { if (t >= roomT(i)) outline(rectP(x - 2, y - 2, w + 4, h + 4), D.grey, opened(t, roomT(i))); });
  if (t >= X.code && t < X.word3) { const day = beatsIn(X.code, t).length % 2; label(day ? 'COLORS' : 'CODE', 8, 22, { fill: day ? D.lime : D.bone }); }
  if (t >= X.word3 && t < X.light3) { const y = Math.min(60, (fr(t) - fr(X.word3)) * 4); label('WORD', 146, y, { fill: D.bone }); }
  if (t >= X.light3 && t < X.step) { const h = Math.min(104, (fr(t) - fr(X.light3)) * 12); orect(159, 104 - h, 3, h, D.lime); }
  if (t >= X.step && t < X.rules) label('ONE STEP EARLY', 8, 22, { fill: D.grey });
  if (t >= X.vibe) label('VIBE IS SKY', 8, 22, { fill: D.lime });
}
// 120.45–124.3 Bridge 前半：窗一扇扇关、灯一盏盏熄（鼓停），只剩她那一扇（shot13）
X.when = wt('WHEN', 120.45); X.every2 = wt('EVERY', 124.3); X.wake3 = wt('WAKE', 125.34); X.brand3 = wt('BRAND', 126.5);
function sClose(t) {
  fill(D.ink); symbols(t, { amt: 0.25, seed: 19 });
  const n = ROOMS.length;
  ROOMS.forEach(([x, y, w, h], i) => {
    const tc = X.when + (n - 1 - i) * ((X.every2 - 0.3 - X.when) / n);     // 从外往里关
    if (i === 0) { rectW(S.shot13, x - 30, y - 40 + 40, w + 60, h + 40, { twinkle: 4 }); return; }
    const c = t >= tc ? 1 - opened(t, tc) : 1, hh = Math.round(h * c); if (hh <= 0) return;
    rectW(S.shot17, x, y + (h - hh) / 2, w, hh, { twinkle: 4 });
  });
}
function hClose(t) { label('WINDOWS', 8, 8, { fill: D.grey }); const n = ROOMS.length, k = ROOMS.filter((r, i) => i === 0 || t < X.when + (n - 1 - i) * ((X.every2 - 0.3 - X.when) / n)).length; txt(String(k).padStart(2, '0') + '/15', 62, 10, D.bone, 0); }
// 124.3–128 Every time I wake up, it's a brand new place：车窗里睁眼（shot7），窗上的雨
function sCar(t) { fill(D.ink); symbols(t, { amt: 0.2, seed: 20 }); const o = t >= X.wake3 ? opened(t, X.wake3) : 0, w = Math.round(lerp(150, 300, o)), h = Math.round(lerp(84, 168, o)); rectW(S.shot7, 160 - w / 2, 90 - h / 2, w, h, { twinkle: 0 }); }
function hCar(t) { const o = t >= X.wake3 ? opened(t, X.wake3) : 0, w = Math.round(lerp(150, 300, o)), h = Math.round(lerp(84, 168, o)); rain(160 - w / 2, 90 - h / 2, w, h, t, 40); if (t >= X.brand3) label('NEW PLACE', 8, 8, { fill: D.bone }); }
// 128–141.66 那扇窗重新打开：「first time I meet you」（shot11 雨停路口回头笑）；135.4 起一路往上爬
X.so = wt('SO', 127.66); X.first2 = wt('FIRST', 129.8); X.meet = wt('MEET', 130.74); X.smile = wt('SMILE', 133.42); X.climb = 135.4;
function sMeet(t) {
  fill(D.ink); symbols(t, { amt: t >= X.climb ? 0.4 + kick(t) * 0.8 : 0.3, seed: 21, blocks: t >= 138 && kick(t) > 0.6 ? 2 : 0 });
  if (t < X.climb) { const o = t >= X.smile ? opened(t, X.smile) : 0, w = Math.round(lerp(200, W, o)), h = Math.round(lerp(120, H, o)); rectW(S.shot11, 160 - w / 2, 90 - h / 2, w, h); return; }
  // 爬：每拍往上叠一格窗，整列每拍往下挪 = 镜头往上
  const bs = beatsIn(X.climb, t), n = bs.length, scroll = n * 12;
  for (let k = 0; k < n + 1; k++) { const y = 150 - k * 30 + scroll - 30, x = 60 + ((k * 73) % 140); if (y < -30 || y > H) continue; const o = k === n ? opened(t, bs[n - 1] ?? X.climb) : 1; rectW(k % 2 ? S.shot10 : S.shot11, x, y, Math.round(100 * o), 26, { off: [0, 0] }); }
}
function hMeet(t) {
  if (t < X.climb) { if (t >= X.first2) label('FIRST TIME', 8, 8, { fill: D.lime }); if (t >= X.meet) txt(roll(t, X.meet, 'MEET 0001', 91, 6), 76, 10, D.bone, 0); if (t >= X.smile) label('SMILE', 8, 22, { fill: D.bone }); return; }
  const n = beatsIn(X.climb, t).length; label('ALT', 8, 8, { fill: D.grey }); txt(String(n * 12).padStart(4, '0'), 32, 10, D.bone, 0);
  for (let y = 0; y < H; y += 6) orect(312, (y + n * 12) % H, 6, 1, D.grey);
}
// 141.66–160.43 最后的副歌：走向光（shot10 光门）——门越开越大、日越来越暖；每拍一圈碎片（shot14）；「smiling face」= 她的脸
X.so3 = wt('SO', 141.66); X.find = wt('FIND', 145.68); X.here = wt('HERE', 149.16); X.smiling = wt('SMILING', 154.49); X.free = wt('FREE', 159.87); X.clean3 = wt('CLEAN', 160.57); X.slate3 = wt('SLATE', 161.21);
function warmAt(t) { return clamp((t - X.so3) / (X.free - X.so3)) * 0.8; }
function sFinal(t) {
  if (t >= X.clean3) { sSlate(t, X.clean3, X.slate3); return; }
  fill(D.ink); symbols(t, { amt: 0.5 + warmAt(t), seed: 22, blocks: t >= X.free ? 8 : kick(t) > 0.75 ? 1 : 0 });
  const g = clamp((t - X.so3) / 18), w = Math.round(lerp(60, 200, g));
  sunDisc(160, 96, Math.round(lerp(18, 70, g)), warmAt(t));
  rectW(S.shot10, 160 - w / 2, 10, w, 160, { twinkle: 2 });
  const rt = beatsIn(X.find, t);
  RSHARDS.forEach((s, i) => { const t0 = rt[s.ring + Math.max(0, rt.length - 6)]; if (t0 === undefined || t < t0) return; window_(S.shot14, s.P, { twinkle: 2 }); });
  if (t >= X.smiling && t < X.smiling + 1.6) window_(S2, diamondP(160, 80, Math.round(60 * opened(t, X.smiling)), Math.round(60 * opened(t, X.smiling))), { off: [EYE2[0] - 160 - 40, EYE2[1] - 80 + 10] });
  if (t >= X.free) RSHARDS.forEach((s, i) => { if (hash(i, 99) < 0.6) window_([S1, S3, S4, S12][i % 4], s.P, { twinkle: 2 }); });
}
function hFinal(t) {
  if (t >= X.clean3) { hSlate(t); return; }
  const g = clamp((t - X.so3) / 18), w = Math.round(lerp(60, 200, g));
  outline(rectP(157 - w / 2, 7, w + 6, 166), D.grey);
  label('LIGHT', 8, 8, { fill: D.amber }); txt(String(Math.round(warmAt(t) * 125)).padStart(3, '0') + '%', 46, 10, D.bone, 0);
  if (t >= X.here && t < X.smiling) label('HERE AND NOW', 8, 22, { fill: D.bone });
  if (t >= X.smiling && t < X.smiling + 1.6) outline(diamondP(160, 80, Math.round(64 * opened(t, X.smiling)), Math.round(64 * opened(t, X.smiling))), D.lime);
  if (t >= X.free) label('FREE', 8, 22, { fill: D.lime });
}
// 161.61–163.23 全停：画面全部停住（这一段 draw 用的是冻结时间）
X.freeze0 = wt('SLATE', 161.21) + 0.4; X.and4 = wt('AND', 163.23); X.always = wt('ALWAYS', 163.83); X.me4 = wt('ME', 164.79);
// 163.23–167.35 「and it's always been me」→ 164 炸开：所有东西一起回来围着她转，暖铺满半屏
function sBurst(t) {
  if (t < 164.0) { sSlate(X.freeze0, X.clean3, X.slate3); return; }
  fill(D.ink); symbols(t, { amt: 1.6, bright: 1, seed: 23, blocks: 6 });
  sunDisc(160, 190, Math.round(lerp(40, 150, opened(t, 164.0))), 0.9);
  const imgs = [S1, S3, S4, S.shot10, S.shot12, S.shot14, S.shot17, S.shot9];
  const rt = [164.0, ...beatsIn(164.05, t)];
  RSHARDS.forEach((s, i) => { const t0 = rt[s.ring]; if (t0 === undefined || t < t0) return; window_(imgs[i % imgs.length], s.P, { twinkle: 2 }); });
  window_(S.shot15, diamondP(160, 84, 36, 50));
}
function hBurst(t) {
  if (t < 164.0) { hSlate(X.freeze0); if (t >= X.always) label('ALWAYS BEEN ME', 110, 30, { fill: D.lime }); return; }
  outline(diamondP(160, 84, 40, 54), D.lime); label('ME', 152, 142, { fill: D.lime });
}
// 167.35–178.72 尾声（全曲最响）：岸边一路跑向太阳（shot14 胶片带 + 大暖日）；「look back at the sea」= 回头（shot4）
X.stand = wt('STAND', 167.47); X.look = wt('LOOK', 168.81); X.sea2 = wt('SEA', 172.19); X.little2 = wt('LITTLE', 174.29);
function sShore(t) {
  fill(D.ink); symbols(t, { amt: 0.8, seed: 24, blocks: kick(t) > 0.7 ? 2 : 0 });
  sunDisc(250, 60, Math.round(lerp(24, 60, clamp((t - X.stand) / 11))), 1);
  const run = Math.floor((t - X.stand) * 12);
  BANDS.forEach(([y, h, sp]) => rectW(S.shot14, 0, y, W, h, { off: [-(Math.floor(run * sp) % 40) + 20, 0], twinkle: 2 }));
  if (t >= X.look) { const o = opened(t, X.look), g = t >= X.sea2 ? opened(t, X.sea2) : 0, r = Math.round(lerp(30 * o, 70, g)); window_(S4, diamondP(96, 86, r, Math.round(r * 1.1)), { off: [230 - 96, 86 - 86 - 10] }); }
}
function hShore(t) {
  label('SHORE', 8, 8, { fill: D.amber });
  if (t >= X.look) outline(diamondP(96, 86, Math.round(lerp(34 * opened(t, X.look), 74, t >= X.sea2 ? opened(t, X.sea2) : 0)), Math.round(lerp(37 * opened(t, X.look), 81, t >= X.sea2 ? opened(t, X.sea2) : 0))), D.grey);
  if (t >= X.little2) { const n = Math.floor((t - X.little2) * 30); for (let k = 0; k < Math.min(120, n); k++) { const x = hash(k, 81) * W, y = 150 + hash(k, 82) * 28, ph = (fr(t) + k * 7) % 12; if (ph < 6) opx(x, y, ph < 2 ? D.white : D.ice); } txt('LIGHTS AWAKE ' + String(Math.min(999, n * 3)).padStart(3, '0'), 8, 22, D.bone, 0); }
}
// 178.72–182.22 Wave goodbye（shot5，可爱只闪一下：挥手）；182.22 Run into the sun：日长满全屏；184.78 Hi（眨眼）→ 关机
X.wave = wt('WAVE', 178.72); X.run2 = wt('RUN', 182.22); X.sun2 = wt('SUN', 183.36); X.hi1 = wt('HI', 183.66); X.hi2 = wt('HI', 184.78); X.end = 186.2;
function sBye(t) { fill(D.ink); symbols(t, { amt: 0.5, seed: 25 }); sunDisc(250, 60, 60, 1); const o = opened(t, X.wave); window_(S5, diamondP(150, 92, Math.round(110 * o), Math.round(96 * o)), { off: [-10, 0] }); }
function hBye(t) { outline(diamondP(150, 92, Math.round(114 * opened(t, X.wave)), Math.round(100 * opened(t, X.wave))), D.amber); if (t >= X.wave + 0.4) label('GOODBYE', 8, 8, { fill: D.amber }); }
function sSun(t) {
  fill(D.ink); symbols(t, { amt: 0.4, seed: 26 });
  const r = t < X.run2 ? 60 : Math.round(lerp(60, 230, opened(t, X.run2)));
  sunDisc(t < X.run2 ? 250 : lerp(250, 160, opened(t, X.run2)), lerp(60, 110, opened(t, X.run2)), r, 1);
  if (t >= X.hi2) window_(S5, diamondP(160, 84, Math.round(48 * opened(t, X.hi2)), Math.round(48 * opened(t, X.hi2))), { off: [175 - 160, 64 - 84 + 10] });
}
function hSun(t) { if (t >= X.hi1) label('HI', 12, 12, { fill: D.ink, ink: D.amber }); if (t >= X.hi2) { label('HI.', 150, 140, { fill: D.ink, ink: D.bone }); } }

// ---------- 段落表 ----------
const SCENES = [
  [0, 'void', sVoid, hVoid], [X.zo[0] - 0.05, 'zero', sZero, hZero], [X.lights, 'sea', sSea, hSea], [X.then, 'line', sLine, hLine], [X.every - 0.05, 'beads', sBeads, hBeads],
  [X.eyes1, 'eyes', sEyes, hEyes], [X.looking, 'look', sLook, hLook],
  [28.3, 'A', secA, hudA], [K.thousand, 'B', secB, hudB], [K.on, 'C', secC, hudC], [K.at - 0.04, 'D', secD, hudD], [K.eyes, 'E', secE, hudE], [K.the, 'F', secF, hudF],
  [45.25, 'hands', sHands, hHands], [X.clean1 - 0.15, 'slate', sSlate, hSlate], [X.first - 0.15, 'giggle', sGiggle, hGiggle], [X.turn, 'temp', sTemp, hTemp],
  [X.poke - 0.1, 'bird', sBird, hBird], [X.cant, 'count', sCount, hCount], [X.L2[0] - 0.1, 'pre2', sPre2, hPre2], [X.now, 'run', sRun, hRun],
  [95.64, 'dance', sDance, hDance], [X.roll - 0.1, 'palace', sPalace, hPalace], [X.when - 0.1, 'close', sClose, hClose], [X.every2 - 0.1, 'car', sCar, hCar],
  [X.so - 0.05, 'meet', sMeet, hMeet], [X.so3 - 0.1, 'final', sFinal, hFinal], [X.freeze0, 'freeze', null, null], [X.and4, 'burst', sBurst, hBurst],
  [X.stand - 0.1, 'shore', sShore, hShore], [X.wave - 0.1, 'bye', sBye, hBye], [X.run2 - 0.1, 'sun', sSun, hSun],
];
const sceneAt = t => { let s = SCENES[0]; for (const x of SCENES) if (t >= x[0]) s = x; return s; };
// 硬切的那一帧提亮（克制）：这些段落起点
const CUTS = new Set(['look', 'A', 'B', 'D', 'E', 'F', 'hands', 'giggle', 'count', 'pre2', 'run', 'dance', 'palace', 'car', 'final', 'shore', 'bye']);

// ---------- 歌词：按词间停顿自动分行（左对齐、新词亮绿 2 帧） ----------
const LYR = (() => { const L = []; let cur = null; RAW.forEach(([w, a, b], i) => { const word = WORDS[i].w; if (!cur || a - cur.end > 0.55 || cur.text.length + word.length > 44) { if (cur) L.push(cur); cur = { t0: a, end: b, ws: [], text: '' }; } cur.ws.push({ w: word, t0: a }); cur.text += (cur.text ? ' ' : '') + word; cur.end = b; }); if (cur) L.push(cur); L.forEach((l, i) => l.t1 = Math.min(L[i + 1]?.t0 ?? 999, l.end + 1.0)); return L; })();
function lyricsAll(t) {
  const L = LYR.find(l => t >= l.t0 - 0.05 && t < l.t1); if (!L) return;
  orect(8, 164, 2, 11, D.lime); let x = 14;
  for (const w of L.ws) { if (t >= w.t0) { const age = fr(t) - fr(w.t0); txt(w.w, x, 166, age < 2 ? D.lime : D.bone); } x += (w.w.length + 1) * 6; }
}


// ---------- 合成：LUT ----------
// TB：0 不动 / 1 星星闪 / 2 提亮一档 / 3 封顶（白 → 冰蓝，空白板不刺眼）/ 4 冷（压成靛蓝）
const CAP = new Uint8Array(NS); for (let i = 1; i < NS; i++) CAP[i] = lum(SP[i]) > 200 ? nearest(150, 160, 205) : i;
// ---------- 数据里的世界：没构建完的区域（👤Leo：错乱、没构建完成、破碎、数据损坏，结构很简单——线框 / 白模 / 色块） ----------
// 画面按 16×16 分块；一张低频场（每 4 拍整格漂一步）挑出一片片区域，区域里的图变成：线框 / 白模 / 色块 / 缺块（品红黑棋盘 = 贴图丢失）。
// 破损比例跟故事走：醒来前多，搭宫殿时一路降，关窗时回升，最后副歌到尾声越来越完整，Run into the sun 归零。
const DENS = [[0, 0], [24.4, 0.28], [28.3, 0.22], [36.06, 0.12], [37.6, 0.2], [45.25, 0.22], [59, 0.26], [70.5, 0.2], [81.3, 0.16], [95.6, 0.12],
  [104.8, 0.62], [112.4, 0.22], [120.4, 0.3], [124.3, 0.42], [128, 0.22], [141.7, 0.16], [160.4, 0.06], [164, 0.03], [167.4, 0.04], [178.7, 0.02], [182.2, 0]];
function densAt(t) { for (let i = 1; i < DENS.length; i++) if (t < DENS[i][0]) { const [a, va] = DENS[i - 1], [b, vb] = DENS[i]; return lerp(va, vb, (t - a) / (b - a)); } return 0; }
const LUMS = new Float32Array(256); for (let i = 1; i < NS; i++) LUMS[i] = lum(SP[i]); for (let i = 0; i < DRGB.length; i++) LUMS[64 + i] = lum(DRGB[i]);
const TMODE = new Uint8Array(20 * 12), TOFF = new Int8Array(20 * 12);   // 0 完好 / 1 线框 / 2 白模 / 3 色块 / 4 缺块
function corruptTiles(t) {
  const d = densAt(t), ep = Math.floor(BEATS.filter(b => b <= t).length / 4), q = Math.floor(t * 5);
  for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 20; tx++) {
    const i = ty * 20 + tx, v = vnoise(tx / 5.5 + ep * 0.6, ty / 3.6, 31);
    if (d <= 0 || v > d * 0.95 + 0.08) { TMODE[i] = 0; TOFF[i] = 0; continue; }
    const m = hash(tx, ty, ep, 7); const r = vnoise(tx / 3 + ep, ty / 3, 37); TMODE[i] = r < 0.42 ? 1 : r < 0.62 ? 2 : m < 0.86 ? 3 : 4;   // 线框 / 白模成片，色块和缺块零星
    TOFF[i] = hash(tx, ty, q, 9) < 0.12 ? (hash(tx, ty, q, 10) < 0.5 ? -8 : 8) : 0;      // 错乱：偶尔整块横向错 8 格
  }
}
const CLAY = [D.clay0, D.clay1, D.clay2, D.clay3];
const RGBA_W = new Uint8Array(W * H * 4), RGBA_O = new Uint8Array(W * H * 4);
function resolve(t, id) {
  corruptTiles(t);
  const f = fr(t), sp = Math.floor(f / 3);
  const waveR = id === 'C' ? 7 + (f - fr(K.on)) * 12 : 1e9;
  const eyeCyc = id === 'E' && t >= K.open;
  for (let i = 0; i < W * H; i++) {
    let s = IB[i], rgb; const X_ = i % W, Y_ = (i / W) | 0;
    if (IMG[i]) {
      const ti = (Y_ >> 4) * 20 + (X_ >> 4), m = TMODE[ti];
      if (m) {
        const ox = TOFF[ti], j = Y_ * W + clamp(X_ + ox, 0, W - 1); s = IB[j];
        const lx = X_ & 15, ly = Y_ & 15, edge = lx === 0 || ly === 0;
        if (m === 1) {                                   // 线框：只剩亮度跳变的轮廓 + 4 格网格点
          const a = LUMS[s], e = Math.abs(a - LUMS[IB[Math.min(j + 1, W * H - 1)]]) + Math.abs(a - LUMS[IB[Math.min(j + W, W * H - 1)]]);
          s = e > 52 ? D.cyan : e > 22 ? D.blue : (lx & 3) === 0 && (ly & 3) === 0 ? D.deep : edge && (X_ + Y_) & 1 ? D.deep : D.ink;
        } else if (m === 2) s = CLAY[clamp(Math.floor(LUMS[s] / 64 + bay(X_, Y_) * 0.6), 0, 3)];                     // 白模
        else if (m === 3) { s = IB[Math.min((Y_ & ~15) + 8, H - 1) * W + clamp((X_ & ~15) + 8 + ox, 0, W - 1)]; if (edge) s = D.clay1; }   // 色块
        else s = (ti & 3) === 0 && ((X_ >> 2) + (Y_ >> 2)) & 1 ? D.mag : edge && (X_ + Y_) & 1 ? D.grey : D.ink;   // 缺块
      }
    }
    if (s >= 64) rgb = DRGB[s - 64];
    else {
      if (id === 'C') { const d = Math.hypot(X_ - EYE2[0], Y_ - EYE2[1]); if (d > waveR - 10 * bay(X_, Y_)) s = COLD[s]; else if (d > waveR - 16) s = BRIGHT[s]; }
      const tb = TB[i];
      if (tb === 2) s = BRIGHT[s]; else if (tb === 3) s = CAP[s]; else if (tb === 4) s = COLD[s];
      if ((tb === 1 || tb === 2) && IS_STAR[s] && id !== 'E') s = STAR_CYCLE[(sp + Math.floor(hash(X_ >> 1, Y_ >> 1) * 4)) & 3];
      if (eyeCyc && s === IRIS && Math.hypot(X_ - EYEC[0], Y_ - EYEC[1]) < 50) s = IRIS_CYCLE[(sp + (X_ >> 2)) % IRIS_CYCLE.length];
      rgb = SP[s];
    }
    const o = i * 4; RGBA_W[o] = rgb[0]; RGBA_W[o + 1] = rgb[1]; RGBA_W[o + 2] = rgb[2]; RGBA_W[o + 3] = 255;
  }
  for (let i = 0; i < W * H; i++) { const s = OB[i], o = i * 4; if (s) { const c = DRGB[s - 64]; RGBA_O[o] = c[0]; RGBA_O[o + 1] = c[1]; RGBA_O[o + 2] = c[2]; RGBA_O[o + 3] = 255; } else RGBA_O[o + 3] = RGBA_O[o] = RGBA_O[o + 1] = RGBA_O[o + 2] = 0; }
}

// ---------- WebGL2 CRT（同 v1） ----------
const cv = document.createElement('canvas'); cv.width = OW; cv.height = OH; document.body.appendChild(cv);
const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uW, uO; uniform vec2 uWs, uOs, uOut, uC, uShake; uniform float uOn, uOnX, uWhite, uGain, uCA;
out vec4 o;
vec4 sharpT(sampler2D tx, vec2 sz, vec2 uv){ vec2 t = uv * sz, fl = floor(t), s = t - fl; float sc = uOut.y / sz.y, reg = 0.5 - 0.5 / sc;
  vec2 cd = s - 0.5; vec2 f = (cd - clamp(cd, -reg, reg)) * sc + 0.5; return texture(tx, (fl + f) / sz); }
vec3 comp(vec2 uv){ vec4 ov = sharpT(uO, uOs, uv); vec3 w = sharpT(uW, uWs, uv + uShake / uWs).rgb; return mix(w, ov.rgb, ov.a); }
void main(){
  vec2 uv = gl_FragCoord.xy / uOut; uv.y = 1.0 - uv.y;
  vec2 c = uv * 2.0 - 1.0; float k = 0.028; vec2 u = (c * (1.0 + k * dot(c, c)) / (1.0 + k)) * 0.5 + 0.5;
  vec2 e = min(u, 1.0 - u); float bez = smoothstep(0.0, 0.002, e.x) * smoothstep(0.0, 0.0035, e.y);
  vec2 d = u - uC; vec2 ext = max(uC, 1.0 - uC);
  float on = smoothstep(uOn * ext.y + 0.0015, uOn * ext.y - 0.0015, abs(d.y)) * smoothstep(uOnX * ext.x + 0.002, uOnX * ext.x - 0.002, abs(d.x));
  u.y = uC.y + d.y / max(uOn, 0.004);
  vec2 uc = clamp(u, 0.0, 1.0);
  float ca = uCA / uOut.x;
  vec3 col = vec3(comp(uc + vec2(ca, 0.0)).r, comp(uc).g, comp(uc - vec2(ca, 0.0)).b);
  float l = dot(col, vec3(0.3, 0.59, 0.11));
  float sy = fract(uc.y * uOs.y) - 0.5, bw = mix(0.30, 0.47, l);
  float scan = mix(0.62, 1.0, smoothstep(bw + 0.13, bw - 0.05, abs(sy)));
  vec3 g = vec3(0.0); vec2 ts = 1.0 / uOs;
  for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; vec2 dd = vec2(cos(a), sin(a)); g += comp(uc + dd * ts * 1.5) + comp(uc + dd * ts * 3.2) * 0.6; }
  g /= 12.8;
  col = col * scan * 1.08 + max(g - 0.28, 0.0) * 0.6;
  float r = length(c) / 1.4142; col *= 1.0 - 0.3 * pow(r, 2.4);
  col = mix(col, vec3(1.0), uWhite) * uGain;
  vec3 ph = vec3(0.12, 0.10, 0.22) * uWhite * exp(-abs(d.y) * 7.0) * exp(-abs(d.x) * 8.0 * (1.0 - min(uOnX, 1.0)));
  o = vec4((col * on + ph * (1.0 - on)) * bez, 1.0);
}`;
const shd = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
const prog = gl.createProgram(); gl.attachShader(prog, shd(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shd(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const U = n => gl.getUniformLocation(prog, n);
function mkTex(unit) { const tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx);
  for (const [a, b] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, a, b); return tx; }
const TW_ = mkTex(0), TO_ = mkTex(1);
gl.uniform1i(U('uW'), 0); gl.uniform1i(U('uO'), 1); gl.uniform2f(U('uOut'), OW, OH); gl.uniform2f(U('uOs'), W, H); gl.uniform2f(U('uWs'), W, H);
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
const PWR_ON = { on: [0.012, 0.007, 0.006, 0.04, 0.34, 1], onx: [0.02, 1, 1, 1, 1, 1], wh: [1, 1, 0.8, 0.55, 0.3, 0.14, 0.05, 0], gain: [1, 1.4, 1.2, 1.1, 1.05, 1.02, 1] };
const PWR_OFF = { on: [0.4, 0.05, 0.008, 0.008, 0.006, 0], onx: [1, 1, 1, 0.3, 0.02, 0], wh: [0.2, 0.6, 0.9, 1, 1, 0] };

// CRT 事件：开头是一个点 → 4.3 开机；35.94 关成一点 → 36.06 从她右眼开机；127.66 那扇窗重新开机；186.2 关机
const PWR_DOT = { on: 0.022, onx: 0.013 };
function crt(t, id) {
  let on = 1, onx = 1, wh = 0, gain = 1, C = [0.5, 0.5];
  const pOn = (t0, c) => { const k = fr(t) - fr(t0), g = a => a[Math.min(k, a.length - 1)]; on = g(PWR_ON.on); onx = g(PWR_ON.onx); wh = g(PWR_ON.wh); gain = g(PWR_ON.gain); C = c; };
  const pOff = (t0, c) => { const k = Math.min(fr(t) - fr(t0), 5); on = PWR_OFF.on[k]; onx = PWR_OFF.onx[k]; wh = PWR_OFF.wh[k]; C = c; };
  if (t < X.zo[0]) { on = PWR_DOT.on; onx = PWR_DOT.onx; wh = t > 3.2 ? 0.12 : 0.04; gain = t > 3.2 ? 1.2 : 0.6 + 0.2 * Math.round(Math.sin(t * 3) * 2) / 2; }
  else if (t < X.zo[0] + 0.4) pOn(X.zo[0], [0.5, 0.5]);
  if (t >= K.off && t < K.on) pOff(K.off, [MINE_C[0] / W, MINE_C[1] / H]);
  if (t >= K.on && t < K.at) pOn(K.on, [EYE2[0] / W, EYE2[1] / H]);
  if (t >= X.so && t < X.so + 0.4) pOn(X.so, [0.5, 0.5]);
  if (t >= X.end) { if (fr(t) - fr(X.end) < 6) pOff(X.end, [0.5, 0.5]); else { on = 0; onx = 0; wh = 0; } }
  return { on, onx, wh, gain, C };
}

window.DRAW = draw;
function draw(t) {
  OB.fill(0);
  let tt = t, sc = sceneAt(t);
  const frozen = sc[1] === 'freeze';
  if (frozen) { tt = X.freeze0 - 0.001; sc = sceneAt(tt); }               // 全停：整帧停在冻结那一刻
  sc[2](tt); sc[3](tt);
  lyricsAll(tt);
  resolve(tt, sc[1]);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, TW_); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, RGBA_W);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, TO_); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, RGBA_O);
  let { on, onx, wh, gain, C } = crt(t, sc[1]);
  if (!frozen) {
    const cur = sceneAt(t); if (CUTS.has(cur[1]) && fr(t) === fr(cur[0])) { wh = Math.max(wh, 0.2); gain = Math.max(gain, 1.15); }
    if (t >= K.mine && fr(t) - fr(K.mine) < 2) gain = 1.25;
    for (const v of [K.wake, K.up, X.door, X.fall, X.free, 164.0]) if (t >= v && fr(t) - fr(v) < 2) gain = Math.max(gain, 1.25);
  }
  const shake = !frozen && t >= K.on && kick(t) > 0.7 ? (fr(t) % 2 ? 1 : -1) : 0;
  gl.uniform1f(U('uOn'), on); gl.uniform1f(U('uOnX'), onx); gl.uniform1f(U('uWhite'), wh); gl.uniform1f(U('uGain'), gain + (!frozen && t >= 8 ? 0.04 * kick(t) : 0));
  gl.uniform2f(U('uC'), C[0], C[1]); gl.uniform2f(U('uShake'), 0, shake); gl.uniform1f(U('uCA'), 1.2 + (gain > 1.1 ? 2 : 0));
  gl.viewport(0, 0, OW, OH); gl.drawArrays(gl.TRIANGLES, 0, 3);
}
window.renderAt = t => { draw(t); gl.finish(); };

// ---------- 启动 ----------
const ui = document.getElementById('ui');
if (RENDER) {
  ui.remove();
  // ?times=a,b,c：只渲这几个时间点（接触表用，比 headless 截图可靠）
  const TIMES = Q.has('times') ? Q.get('times').split(',').map(Number) : null;
  const n = TIMES ? TIMES.length : Math.round((T1 - T0) * FPS), out = Q.get('out') ?? '-5_Clean Slate/样片/全片_v1_animator2.mp4';
  await fetch(`/start?w=${OW}&h=${OH}&fps=${FPS}&t0=${T0}&t1=${T1}&vflip=1&out=${encodeURIComponent(out)}`, { method: 'POST' });
  const buf = new Uint8Array(OW * OH * 4);
  for (let i = 0; i < n; i++) {
    draw(TIMES ? TIMES[i] : T0 + i / FPS); gl.readPixels(0, 0, OW, OH, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    for (let k = 0; ; k++) { try { await fetch('/frame?i=' + i, { method: 'POST', body: buf }); break; } catch (e) { if (k > 20) throw e; await new Promise(r => setTimeout(r, 300)); } }
  }
  await fetch('/done' + (Q.has('quit') ? '?quit=1' : ''), { method: 'POST' }); log('render done', n);
} else if (STILL !== null) {
  draw(STILL); ui.textContent = `${STILL.toFixed(2)} s · ${sceneAt(STILL)[1]}`; window.__ready = true;
} else {
  ui.textContent = '点击播放 · 空格暂停 · ←/→ 跳 5 s · ?t=36.5 看静帧 · ?t0=80 从 80 s 起';
  const audio = new Audio('../../-5_Clean Slate/Clean Slate.wav'); let playing = false;
  addEventListener('click', () => { if (!playing) { audio.currentTime = T0; audio.play(); playing = true; } });
  addEventListener('keydown', e => { if (e.code === 'Space') audio.paused ? audio.play() : audio.pause(); if (e.code === 'ArrowRight') audio.currentTime += 5; if (e.code === 'ArrowLeft') audio.currentTime -= 5; });
  const loop = () => { let t = playing ? audio.currentTime : T0; if (playing && t > T1) { audio.currentTime = T0; t = T0; } draw(t); ui.textContent = `${t.toFixed(2)} s · ${sceneAt(t)[1]} · 空格暂停 · ←/→ 跳 5 s`; requestAnimationFrame(loop); };
  loop();
}
