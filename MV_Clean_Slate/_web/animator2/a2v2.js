// Clean Slate · 「她睁眼」animator2 v2（28.3–43.8 s）—— 底子同 v1（mg-styles-15 #13 像素风 + #08 HUD），
// 这版加几何 MG：酸绿符号阵列（底）、形状窗口（她只从几何形里露出来）、几何碎片（千条方向 = 几百块窗口碎片）、拼贴（圆日 + 细线框 + 刻度条）。
// 口味：Blade Runner 底色，冷、忧郁，别太可爱 → 不用 shot5（挥手眨眼），字改成标签框，品红只留给她的眼睛和日。
// 规矩同 v1：每帧 = 歌曲时间的纯函数；整格、按帧阶梯；随机全用 hash。
const Q = new URLSearchParams(location.search);
const RENDER = Q.has('render');
const T0 = +(Q.get('t0') ?? 28.3), T1 = +(Q.get('t1') ?? 43.8), FPS = 30;
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
const nth = (s, n = 0) => WORDS.filter(w => clean(w.w) === s && w.t0 > T0 - 0.5)[n]?.t0;
const K = {
  layer1: nth('LAYER'), by1: nth('BY'), layer2: nth('LAYER', 1), line1: nth('LINE'), by2: nth('BY', 1), line2: nth('LINE', 1),
  thousand: nth('THOUSAND'), directions: nth('DIRECTIONS'), one: nth('ONE'), of: nth('OF'), thems: nth("THEM'S"), mine: nth('MINE'),
  off: 35.94, on: 36.06, brand: nth('BRAND'), nw: nth('NEW'), girl: nth('GIRL'), at: nth('AT'), edge: nth('EDGE'), gate: nth('GATE'),
  never: nth('NEVER'), here: nth('HERE'), wanna: nth('WANNA'), wait: nth('WAIT'), eyes: nth('EYES'), wide: nth('WIDE'), open: nth('OPEN'),
  the: 41.46, sea: nth("SEA'S"), every: nth('EVERY'), little: nth('LITTLE'), star: nth('STAR'), says: nth('SAYS'), wake: nth('WAKE'), up: 43.74,
};
log('cues', JSON.stringify(K));

// ---------- 调色板：直接读主会话的 28 色（全片统一） ----------
const MAN = await (await fetch('../px/manifest.json')).json();
const SP = [[0, 0, 0], ...MAN.palette], NS = SP.length;
const DC = { ink: '05040c', night: '0e0b24', indigo: '2c2386', blue: '1d4fa0', cyan: '3de0ff', ice: 'a8f4ff', pink: 'ff3d9a', blush: 'ffd0ec',
  lime: 'c8ff1e', limeD: '6e9410', orange: 'ff8a2a', bone: 'e8e4dc', white: 'ffffff', deep: '0f2a5c', violet: '5a4fe0', mag: 'c42a9e', moss: '27360a', mossD: '161e06', grey: '6a6878' };
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
const [S1, S2, S3, S4, SEYE] = await Promise.all(['shot1', 'shot2', 'shot3', 'shot4', 'shot2_eye'].map(loadShot));
const EYE2 = [213, 60];           // shot2 里她右眼（画面右侧）的位置 = 开机点
const EYEC = [149, 92];           // shot2_eye 里瞳孔的位置

// ---------- 帧缓冲 ----------
const IB = new Uint8Array(W * H), TB = new Uint8Array(W * H), OB = new Uint8Array(W * H);
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
const fill = c => { IB.fill(c); TB.fill(0); };

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
    IB[y * W + x] = src[sy * W + sx]; TB[y * W + x] = twinkle;
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
function secC(t) { IB.set(S2); TB.fill(1); }
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
function secE(t) { IB.set(SEYE); TB.fill(1); }
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

// ---------- 歌词：左对齐、标签式（新词亮绿 2 帧再回骨白） ----------
const LINES = [[T0, 30.2], [30.2, 32.1], [32.1, 34.1], [34.1, 35.94], [37.6, 38.58], [38.58, 40.15], [40.15, 41.42], [41.42, 43.2], [43.2, 43.5]];
function lyrics(t) {
  const L = LINES.find(([a, b]) => t >= a && t < b); if (!L) return;
  const ws = WORDS.filter(w => w.t0 >= L[0] - 0.08 && w.t0 < L[1] - 0.08); if (!ws.length) return;
  let x = 12; const y = 166;
  if (t >= ws[0].t0) orect(8, y - 2, 2, 11, D.lime);
  x = 14;
  for (const w of ws) { if (t >= w.t0) { const age = fr(t) - fr(w.t0); txt(w.w, x, y, age < 2 ? D.lime : D.bone); } x += (w.w.length + 1) * 6; }
}

// ---------- 合成 ----------
const SECS = [[K.on, 'A'], [K.on, 'B'], [K.at - 0.2, 'C'], [K.eyes, 'D'], [K.the, 'E'], [99, 'F']];
const secOf = t => t < K.thousand ? 'A' : t < K.on ? 'B' : t < K.at - 0.04 ? 'C' : t < K.eyes ? 'D' : t < K.the ? 'E' : 'F';
const RGBA_W = new Uint8Array(W * H * 4), RGBA_O = new Uint8Array(W * H * 4);
function resolve(t, sec) {
  const f = fr(t), sp = Math.floor(f / 3);
  const waveR = sec === 'C' ? 7 + (f - fr(K.on)) * 12 : 1e9;
  const eyeCyc = sec === 'E' && t >= K.open;
  for (let i = 0; i < W * H; i++) {
    let s = IB[i], rgb; const X = i % W, Y = (i / W) | 0;
    if (s >= 64) rgb = DRGB[s - 64];
    else {
      if (sec === 'C') { const d = Math.hypot(X - EYE2[0], Y - EYE2[1]); if (d > waveR - 10 * bay(X, Y)) s = COLD[s]; else if (d > waveR - 16) s = BRIGHT[s]; }
      if (TB[i] === 2) s = BRIGHT[s];                                               // 亮起来的碎片：整块提一档
      if (TB[i] && IS_STAR[s] && sec !== 'E') s = STAR_CYCLE[(sp + Math.floor(hash(X >> 1, Y >> 1) * 4)) & 3];
      if (eyeCyc && s === IRIS && Math.hypot(X - EYEC[0], Y - EYEC[1]) < 50) s = IRIS_CYCLE[(sp + (X >> 2)) % IRIS_CYCLE.length];
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

const SEC = { A: [secA, hudA], B: [secB, hudB], C: [secC, hudC], D: [secD, hudD], E: [secE, hudE], F: [secF, hudF] };
function draw(t) {
  OB.fill(0);
  const sec = secOf(t);
  SEC[sec][0](t); SEC[sec][1](t);
  lyrics(t);
  resolve(t, sec);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, TW_); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, RGBA_W);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, TO_); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, RGBA_O);
  let on = 1, onx = 1, wh = 0, gain = 1, C = [0.5, 0.5];
  if (t >= K.off && t < K.on) { const k = Math.min(fr(t) - fr(K.off), 5); on = PWR_OFF.on[k]; onx = PWR_OFF.onx[k]; wh = PWR_OFF.wh[k]; C = [MINE_C[0] / W, MINE_C[1] / H]; }
  if (t >= K.on && t < K.at) { const k = fr(t) - fr(K.on), g = (a, d) => a[Math.min(k, a.length - 1)] ?? d; on = g(PWR_ON.on, 1); onx = g(PWR_ON.onx, 1); wh = g(PWR_ON.wh, 0); gain = g(PWR_ON.gain, 1); C = [EYE2[0] / W, EYE2[1] / H]; }
  // 段与段之间：1 帧提亮（硬切的冲击帧，克制）
  for (const tc of [K.thousand, K.at - 0.04, K.eyes, K.the]) if (fr(t) === fr(tc)) { wh = 0.22; gain = 1.15; }
  if (t >= K.mine && fr(t) - fr(K.mine) < 2) gain = 1.25;
  if (t >= K.wake && fr(t) - fr(K.wake) < 2) gain = 1.2;
  if (t >= K.up && fr(t) - fr(K.up) < 2) { gain = 1.3; wh = 0.1; }
  const shake = t >= K.on && kick(t) > 0.7 ? (fr(t) % 2 ? 1 : -1) : 0;
  gl.uniform1f(U('uOn'), on); gl.uniform1f(U('uOnX'), onx); gl.uniform1f(U('uWhite'), wh); gl.uniform1f(U('uGain'), gain + (t >= K.on ? 0.04 * kick(t) : 0));
  gl.uniform2f(U('uC'), C[0], C[1]); gl.uniform2f(U('uShake'), 0, shake); gl.uniform1f(U('uCA'), 1.2 + (gain > 1.1 ? 2 : 0));
  gl.viewport(0, 0, OW, OH); gl.drawArrays(gl.TRIANGLES, 0, 3);
}
window.renderAt = t => { draw(t); gl.finish(); };

// ---------- 启动 ----------
const ui = document.getElementById('ui');
if (RENDER) {
  ui.remove();
  const n = Math.round((T1 - T0) * FPS), out = Q.get('out') ?? '-5_Clean Slate/样片/风格小样_她睁眼_animator2_v2.mp4';
  await fetch(`/start?w=${OW}&h=${OH}&fps=${FPS}&t0=${T0}&t1=${T1}&vflip=1&out=${encodeURIComponent(out)}`, { method: 'POST' });
  const buf = new Uint8Array(OW * OH * 4);
  for (let i = 0; i < n; i++) {
    draw(T0 + i / FPS); gl.readPixels(0, 0, OW, OH, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    for (let k = 0; ; k++) { try { await fetch('/frame?i=' + i, { method: 'POST', body: buf }); break; } catch (e) { if (k > 20) throw e; await new Promise(r => setTimeout(r, 300)); } }
  }
  await fetch('/done' + (Q.has('quit') ? '?quit=1' : ''), { method: 'POST' }); log('render done', n);
} else if (STILL !== null) {
  draw(STILL); ui.textContent = `${STILL.toFixed(2)} s`; window.__ready = true;
} else {
  ui.textContent = '点击播放 · 空格暂停 · ←/→ 跳 1 s · ?t=36.5 看静帧';
  const audio = new Audio('../../-5_Clean Slate/Clean Slate.wav'); let playing = false;
  addEventListener('click', () => { if (!playing) { audio.currentTime = T0; audio.play(); playing = true; } });
  addEventListener('keydown', e => { if (e.code === 'Space') audio.paused ? audio.play() : audio.pause(); if (e.code === 'ArrowRight') audio.currentTime += 1; if (e.code === 'ArrowLeft') audio.currentTime -= 1; });
  const loop = () => { let t = playing ? audio.currentTime : T0; if (playing && t > T1) { audio.currentTime = T0; t = T0; } draw(t); ui.textContent = `${t.toFixed(2)} s · 空格暂停 · ←/→ 跳 1 s`; requestAnimationFrame(loop); };
  loop();
}
