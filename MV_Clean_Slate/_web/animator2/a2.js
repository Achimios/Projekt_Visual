// Clean Slate · 「她睁眼」animator2（28.3–43.8 s）—— 学 mg-styles-15 的 13 像素风 + 08 HUD。
// 像素风的手法：320×180 索引色帧（格子里存「色槽」，不存颜色）→ 每帧一张 LUT 把色槽映射成调色板颜色
//   （冷 / 醒 / 提亮 / 星星色彩循环都只是换 LUT）→ WebGL2 CRT（锐利放大 ×6、扫描线、桶形、辉光、开机序列）。
// HUD 的手法：线框分层错帧生长、数字乱跳 3–5 帧落定、打字机 + 光标、锁定框 1.4 → 1.0 快出缓入、从目标点往外「重新上色」的波。
// 规矩：每帧 = 歌曲时间的纯函数；动作按整格、按帧阶梯走（不平滑缓动）；随机全部用 hash。
import { loadPx, layer, girl, PX } from '../girl_px.js';

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
const fr = t => Math.round(t * FPS);                                // 帧号（歌曲时间）
function hash(...a) { let h = 2166136261 >>> 0; for (const v of a) { h ^= Math.imul(v | 0, 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; }
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const outC = u => 1 - Math.pow(1 - clamp(u), 3);
// 阶梯：t0 之后第 k 帧取表里第 k 个值（表尾保持）
const steps = (t, t0, tab) => t < t0 ? null : tab[Math.min(fr(t) - fr(t0), tab.length - 1)];

// ---------- 数据 ----------
const AUD = await (await fetch('../audio.json')).json();
const RAW = await (await fetch('../words.json')).json();
const WORDS = RAW.map(([w, a]) => ({ w: w.toUpperCase().replace('GAME', 'GATE'), t0: a }));
for (const w of WORDS) if (w.w.startsWith('GO') && w.t0 > 43) w.w = 'UP';
const kick = t => AUD.kick[clamp(Math.floor(t * AUD.fps), 0, AUD.kick.length - 1)];
const BEATS = AUD.beats;
const lastBeat = t => { let b = -1; for (const v of BEATS) { if (v <= t) b = v; else break; } return b; };

// ---------- 调色板 ----------
// 场景色槽 1..28 = 主会话像素化她时定的 28 色（girl_px 的 manifest），保证她和站台的颜色不被我改。
await loadPx();
const SP = [[0, 0, 0], ...PX.palette];
const NS = SP.length;
// 直接色（HUD / 字 / 光）：槽号 64 + k，不过 LUT。
const DC = { ink: '07061a', night: '120e34', indigo: '2c2386', blue: '1d4fa0', cyan: '3de0ff', ice: 'a8f4ff', pink: 'ff3d9a', blush: 'ffd0ec',
  lime: 'd6ff4a', limeD: '7fa312', orange: 'ff8a2a', bone: 'f4efe6', white: 'ffffff', deep: '0f2a5c', violet: '5a4fe0', mag: 'c42a9e', moss: '2e3d0a' };
const D = {}, DRGB = [];
Object.entries(DC).forEach(([k, h], i) => { D[k] = 64 + i; DRGB[i] = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; });
const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
function nearest(r, g, b, ok = () => true) {
  let bi = 1, bd = 1e18;
  for (let i = 1; i < NS; i++) { if (!ok(i)) continue; const p = SP[i]; const d = 0.3 * (p[0] - r) ** 2 + 0.59 * (p[1] - g) ** 2 + 0.11 * (p[2] - b) ** 2; if (d < bd) { bd = d; bi = i; } }
  return bi;
}
const isMag = i => SP[i][0] > SP[i][2] * 0.8 && SP[i][0] > 100;
// 冷（还没醒）：一律压成暗的靛蓝；醒：原色；提亮：往亮的方向挪一档
const COLD = new Uint8Array(NS), BRIGHT = new Uint8Array(NS), BRIGHT2 = new Uint8Array(NS);
for (let i = 1; i < NS; i++) {
  const c = SP[i], l = lum(c) * 0.55;
  COLD[i] = nearest(l * 0.55, l * 0.6, l * 1.25 + 6, j => !isMag(j));
  BRIGHT[i] = nearest(c[0] * 1.45 + 28, c[1] * 1.45 + 28, c[2] * 1.45 + 34, j => j !== i || lum(c) > 240);
  BRIGHT2[i] = BRIGHT[BRIGHT[i]];
}
const DIM = new Uint8Array(NS); for (let i = 1; i < NS; i++) { const c = SP[i]; DIM[i] = nearest(c[0] * 0.42, c[1] * 0.45, c[2] * 0.6, j => !isMag(j) || isMag(i)); }
const DEEPD = new Uint8Array(NS); for (let i = 1; i < NS; i++) { const c = SP[i]; DEEPD[i] = nearest(c[0] * 0.2, c[1] * 0.22, c[2] * 0.42 + 6, j => !isMag(j)); }
const IRIS = nearest(255, 70, 230), CYANS = nearest(120, 225, 255), PALE = nearest(234, 253, 254);
const STAR_CYCLE = [nearest(255, 255, 255), nearest(189, 219, 243), nearest(121, 127, 192), nearest(189, 219, 243)];
const IS_STAR = new Uint8Array(NS); for (let i = 1; i < NS; i++) IS_STAR[i] = lum(SP[i]) > 170 && !isMag(i) ? 1 : 0;
const IRIS_CYCLE = [IRIS, nearest(255, 140, 210), CYANS, PALE, CYANS, nearest(214, 90, 255)];

// ---------- 帧缓冲 ----------
// 世界层（可被阶梯缩放裁切）：IB 色槽，TB = 1 表示这格参与星星色彩循环（只给背景 / 星空，不给她）
const IB = new Uint8Array(W * H), TB = new Uint8Array(W * H);
// 叠加层（HUD / 字，永远 ×6，不跟着缩放）：OB = 直接色槽，0 = 透明
const OB = new Uint8Array(W * H);
const px = (x, y, c) => { x |= 0; y |= 0; if (x >= 0 && x < W && y >= 0 && y < H) IB[y * W + x] = c; };
const opx = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) OB[y * W + x] = c; };
const orect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) opx(x + i, y + j, c); };
function bres(x0, y0, x1, y1, fn) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy, k = 0;
  for (;;) { fn(x0, y0, k++); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
// 中点画圆（可只画一段弧、可虚线）
function ocircle(cx, cy, r, c, a0 = 0, a1 = Math.PI * 2, dash = 0) {
  const n = Math.max(8, Math.round(r * 7));
  let lx = null, ly = null;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
    if (x === lx && y === ly) continue; lx = x; ly = y;
    if (dash && Math.floor(i / dash) % 2) continue;
    opx(x, y, c);
  }
}

// ---------- 5×7 像素字（手写点阵，大写 + 数字 + 标点） ----------
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
  for (let pass = 0; pass < 2; pass++) {
    let cx = x;
    for (const ch of s) {
      const g = FONT[ch] ?? FONT['?'];
      for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j] >> (4 - i) & 1) { if (pass === 0) { if (sh) opx(cx + i + 1, y + j + 1, sh); } else opx(cx + i, y + j, c); }
      cx += 6;
    }
  }
}
// 大字（logo）：每个点 = cell×cell 方块；顶边亮、底边暗、1 格描边 + 2 格投影；shine = 斜向扫光；dis = Bayer 溶解进度
function bigTxt(s, cx, y, cell, col, { dis = 0, shine = -999 } = {}) {
  const gw = 5 * cell, adv = gw + cell, wTot = s.length * adv - cell, x0 = Math.round(cx - wTot / 2);
  const mw = wTot + 8, mh = 7 * cell + 8, M = new Uint8Array(mw * mh);
  let gx = 4;
  for (const ch of s) { const g = FONT[ch] ?? FONT['?']; for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j] >> (4 - i) & 1) for (let b = 0; b < cell; b++) for (let a = 0; a < cell; a++) M[(4 + j * cell + b) * mw + gx + i * cell + a] = 1; gx += adv; }
  const at = (i, j) => i >= 0 && j >= 0 && i < mw && j < mh && M[j * mw + i];
  const ox = x0 - 4, oy = Math.round(y) - 4;
  for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
    const X = ox + i, Y = oy + j;
    if (dis > 0 && bay(X, Y) < dis) continue;
    if (at(i, j)) {
      let c = col.fill;
      if (!at(i, j - 1)) c = col.hi; else if (!at(i, j + 1) || !at(i, j + 2)) c = col.lo;
      const sd = X + Y - shine; if (sd >= 0 && sd < 4) c = D.white;
      opx(X, Y, c);
    } else if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1) || at(i - 1, j - 1) || at(i + 1, j + 1) || at(i + 1, j - 1) || at(i - 1, j + 1)) opx(X, Y, D.ink);
    else if (at(i - 1, j - 2) || at(i, j - 2) || at(i - 2, j - 2)) opx(X, Y, col.drop ?? D.night);
  }
}

// ---------- HUD 小部件 ----------
const GL = '0123456789';
// 数字乱跳 n 帧后落定（HUD 手法）
function roll(t, t0, final, id, n = 4) {
  if (t < t0) return null;
  const k = fr(t) - fr(t0); if (k >= n) return final;
  return [...final].map((c, i) => /[0-9A-Z]/.test(c) ? GL[Math.floor(hash(id, i, k) * GL.length)] : c).join('');
}
const typed = (t, t0, s, cps = 40) => t < t0 ? '' : s.slice(0, Math.floor((t - t0) * cps + 1e-6) + 1);
const flick = (t, t0) => { if (t < t0) return 0; const k = fr(t) - fr(t0); return k >= 4 ? 1 : [1, 0, 1, 0][k]; };
// 锁定框：四角括号，s 是半宽，arm 是角长
function brackets(x, y, hw, hh, arm, c) {
  x = Math.round(x); y = Math.round(y); hw = Math.round(hw); hh = Math.round(hh);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = x + sx * hw, cy = y + sy * hh;
    for (let k = 0; k < arm; k++) { opx(cx - sx * k, cy, c); opx(cx, cy - sy * k, c); }
  }
}
// 1.4 → 1.0 快出缓入，按帧阶梯（5 帧到位）
const SNAP = [1.4, 1.16, 1.06, 1.02, 1.0];
const snapAt = (t, t0) => steps(t, t0, SNAP) ?? 1.4;

// ---------- 素材：数据海的星空切片（主会话的 strip1–5 太小，海用原图量化到同一调色板、同样 2 像素一格） ----------
const SRC = '../../素材/图片_分图层_1/';
async function quantImg(name, gw) {
  const im = new Image(); im.src = encodeURI(SRC + name); await im.decode();
  const gh = Math.round(im.height * gw / im.width), c = document.createElement('canvas'); c.width = gw; c.height = gh;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, gw, gh);
  const d = g.getImageData(0, 0, gw, gh).data, o = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = (y * gw + x) * 4; if (d[i + 3] < 128) continue;
    const e = (bay(x, y) - 0.5) * 34;                                 // 有序抖动
    o[y * gw + x] = nearest(d[i] + e, d[i + 1] + e, d[i + 2] + e);
  }
  return { w: gw, h: gh, d: o };
}
const STRIPS = await Promise.all(['图片_EPa-0202-10.png', '图片_EPa-0202-6.png', '图片_EPa-0202-8.png', '图片_EPa-0202-9.png', '图片_EPa-0202-7.png'].map(n => quantImg(n, 200)));
// 2 像素一格地贴（和站台、她同一颗粒）
function blit2(L, x, y, twinkle = 1, rows = L.h, r0 = 0) {
  x = Math.round(x); y = Math.round(y);
  const minY = 0, maxY = H;
  for (let j = r0; j < Math.min(L.h, r0 + rows); j++) for (let i = 0; i < L.w; i++) {
    const c = L.d[j * L.w + i]; if (!c) continue;
    for (let b = 0; b < 2; b++) { const Y = y + (j - r0) * 2 + b; if (Y < minY || Y >= maxY) continue; for (let a = 0; a < 2; a++) { const X = x + i * 2 + a; if (X >= 0 && X < W) { IB[Y * W + X] = c; TB[Y * W + X] = twinkle; } } }
  }
}

// ---------- 站台：用 girl_px 画进一张 320×180 的小画布，再按颜色反查成色槽 ----------
const SC = document.createElement('canvas'); SC.width = W; SC.height = H;
const sctx = SC.getContext('2d', { willReadFrequently: true });
const RGB2SLOT = new Map();
function grab(twinkle) {                                              // 小画布 → IB（透明的格子不覆盖）
  const d = sctx.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) {
    if (d[i * 4 + 3] < 128) continue;
    const k = d[i * 4] << 16 | d[i * 4 + 1] << 8 | d[i * 4 + 2];
    let s = RGB2SLOT.get(k); if (s === undefined) { s = nearest(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); RGB2SLOT.set(k, s); }
    IB[i] = s; TB[i] = twinkle;
  }
}
const CELL = 2, CAM0 = [16, 72];                                      // 站台：一格 = 2 内部像素；窗口左上角（内部像素）
const GL_ = PX.layers.girl;
const EYES = GL_.eyes.map(([x0, y0, x1, y1]) => [(GL_.x + (x0 + x1) / 2) * CELL - CAM0[0], (GL_.y + (y0 + y1) / 2) * CELL - CAM0[1]]);
const E = [Math.round((EYES[0][0] + EYES[1][0]) / 2), Math.round((EYES[0][1] + EYES[1][1]) / 2)];   // 两眼中点 = 整段的焦点
const P = E;                                                          // 数据海里「那一个方向」的原点 = 她睁眼的位置（match cut）

// ---------- 时间表（全部挂在词和拍上） ----------
const WT = s => WORDS.find(w => w.w.replace(/[^A-Z']/g, '') === s && w.t0 > T0 - 0.5)?.t0;
const nth = (s, n) => WORDS.filter(w => w.w.replace(/[^A-Z']/g, '') === s && w.t0 > T0 - 0.5)[n]?.t0;
const K = {
  layer1: nth('LAYER', 0), layer2: nth('LAYER', 1), line1: nth('LINE', 0), line2: nth('LINE', 1),
  thousand: WT('THOUSAND'), directions: WT('DIRECTIONS'), one: WT('ONE'), of: WT('OF'), thems: WT("THEM'S"), mine: WT('MINE'),
  off: 35.94, on: 36.06, brand: WT('BRAND'), nw: WT('NEW'), girl: WT('GIRL'), at: WT('AT'), edge: WT('EDGE'), gate: WT('GATE'),
  never: WT('NEVER'), here: WT('HERE'), wanna: WT('WANNA'), wait: WT('WAIT'), eyes: WT('EYES'), wide: WT('WIDE'), open: WT('OPEN'),
  the: 41.46, sea: WT("SEA'S"), every: WT('EVERY'), little: WT('LITTLE'), star: WT('STAR'), says: WT('SAYS'), wake: nth('WAKE', 0), up: 43.74,
};
log('cues', JSON.stringify(K), 'E', E);
const SEA_END = K.on;                                                 // 36.06 之前 = 数据海，之后 = 站台

// ---------- 数据海（28.3–36.06）：一层层、一行行 → 千条方向线 → 只亮一根 → 光点顺着它冲回原点 ----------
const STRIP_PLAN = [   // 哪条切片、贴在哪一行、从哪边滑进来、哪个词触发
  { s: 0, y: 4, r0: 4, rows: 16, from: 0, t: -1 },          // 开场就在（钩子：第一帧不是黑的）
  { s: 1, y: 44, r0: 20, rows: 12, from: -1, t: 'layer1' },
  { s: 4, y: 76, r0: 10, rows: 10, from: 1, t: 'layer2' },
  { s: 2, y: 104, r0: 26, rows: 12, from: -1, t: 'line1' },
  { s: 3, y: 136, r0: 14, rows: 11, from: 1, t: 'line2' },
];
const SLIDE = [-340, -210, -96, -28, 6, 2, 0];                        // 滑入：每帧走的格子（带一点过冲）
const NR = 300;
const RAYS = Array.from({ length: NR }, (_, i) => ({ a: hash(i, 1) * Math.PI * 2, len: 30 + Math.pow(hash(i, 2), 0.7) * 260, d: hash(i, 3) * 0.32, c: hash(i, 4) < 0.12 ? 1 : 0 }));
// 三个候选 + 「我的」那一根（终点坐标，内部像素）
const CAND = [[P[0] - 96, P[1] + 62], [P[0] + 58, P[1] + 92], [P[0] - 70, P[1] - 46]];
const MINE = [P[0] + 158, P[1] - 50];
for (const [x, y] of [...CAND, MINE]) RAYS.push({ a: Math.atan2(y - P[1], x - P[0]), len: Math.hypot(x - P[0], y - P[1]), d: 0.05, c: 1, special: 1 });
const MINE_I = RAYS.length - 1;
const DOT = t => { const u = clamp((t - (K.mine + 0.06)) / (K.off - 0.04 - (K.mine + 0.06))); const q = Math.floor(u * 24) / 24; return [lerp(MINE[0], P[0], q * q), lerp(MINE[1], P[1], q * q), u]; };

function drawSea(t) {
  // 底：靛蓝的抖动渐变（4×4 Bayer），越往下越亮一点，跟着 kick 呼吸一档
  const k = kick(t) > 0.55 ? 0.25 : 0;
  const ramp = [nearest(3, 4, 14), nearest(9, 9, 25), nearest(13, 24, 56), nearest(14, 39, 104)];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = (y / H) * 1.6 + k + (bay(x, y) - 0.5) * 0.8; IB[y * W + x] = ramp[clamp(Math.floor(v), 0, 3)]; TB[y * W + x] = 0; }
  // 一层层：切片按词滑进来；每条按自己的速度整格平移（视差）
  STRIP_PLAN.forEach((p, i) => {
    const t0 = typeof p.t === 'string' ? K[p.t] : T0 - 1; if (t < t0) return;
    const sl = p.from ? (steps(t, t0, SLIDE) ?? 0) * p.from : 0;
    const pan = Math.floor((t - T0) * (3 + i * 2)) % 40;                // 整格、匀速 = 机械感（像素风不缓动）
    const L = STRIPS[p.s]; blit2(L, -20 - pan + sl, p.y, 1, p.rows, p.r0);
  });
  // 一行行：「line」画横线、第二个「line」画竖线；按层级错帧从一端长到另一端（HUD 的描边生长，按 2 格一跳）
  for (const [t0, dir] of [[K.line1, 0], [K.line2, 1]]) {
    if (t < t0) continue;
    const n = dir ? 9 : 6;
    for (let k = 0; k < n; k++) {
      const g = outC((t - t0 - k * 0.04) / 0.3); if (g <= 0) continue;
      const pos = dir ? 18 + k * 36 : 20 + k * 28, len = Math.floor(g * (dir ? H : W) / 2) * 2, major = k % 3 === 0;
      for (let q = 0; q < len; q++) { if (!major && q % 4 > 1) continue; const c = major ? D.blue : D.deep; dir ? px(pos, (k & 1 ? H - 1 - q : q), c) : px((k & 1 ? W - 1 - q : q), pos, c); }
    }
  }
  // 千条方向：从 P 往外按长短错帧长出来（HUD 的「层级错帧」）
  if (t >= K.thousand) {
    const mineOn = t >= K.mine, pulse = t >= K.directions && fr(t) - fr(K.directions) < 3;
    const rot = Math.floor((t - K.thousand) * 10) * 0.004;              // 每 3 帧转一小格
    RAYS.forEach((r, i) => {
      const g = outC((t - K.thousand - r.d) / 0.35); if (g <= 0) return;
      const a = r.a + (r.special ? 0 : rot), L = r.len * Math.floor(g * 12) / 12, isMine = i === MINE_I;
      if (mineOn && !isMine) { if (hash(i, 9) > 0.35) return; }        // 「one of them's mine」：其余几乎全灭
      const c = isMine && mineOn ? D.lime : mineOn ? D.deep : pulse ? D.cyan : r.c ? D.cyan : D.blue;
      const x1 = P[0] + Math.cos(a) * L, y1 = P[1] + Math.sin(a) * L;
      bres(P[0] + Math.cos(a) * 5, P[1] + Math.sin(a) * 5, x1, y1, (x, y, n) => { if (isMine && mineOn) { px(x, y, c); px(x, y + 1, D.limeD); } else if ((n & 1) === 0 || r.c) px(x, y, c); });
    });
  }
  // 光点顺着那一根冲回原点（拖尾 = 前几格位置）
  if (t >= K.mine + 0.06 && t < K.on) {
    for (let k2 = 5; k2 >= 0; k2--) { const [x, y] = DOT(t - k2 / FPS); const c = k2 === 0 ? D.white : k2 < 3 ? D.ice : D.cyan; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (!k2 || (!a || !b)) px(x + a, y + b, c); }
  }
}

// 阶梯缩放（像素风：整数倍 6 → 8 → 10 → 12 → 15，不平滑）
function zoomAt(t) {
  if (t < K.on) { if (t >= 35.82) return 12; if (t >= 35.58) return 10; if (t >= 35.34) return 8; return 6; }
  if (t >= K.eyes && t < K.the) { if (t >= K.open) return 15; if (t >= K.wide) return 12; return 10; }
  return 6;
}

function seaHUD(t) {
  // 四角框：开场 6 帧画出来
  const g = Math.min(14, (fr(t) - fr(T0)) * 3);
  if (g > 0) for (const [x, y, sx, sy] of [[5, 5, 1, 1], [314, 5, -1, 1], [5, 174, 1, -1], [314, 174, -1, -1]]) for (let k = 0; k < g; k++) { opx(x + sx * k, y, D.cyan); opx(x, y + sy * k, D.cyan); }
  // 开机日志：每个词打一行
  const LOG = [[T0 + 0.02, 'SLATE//BOOT'], [K.layer1, 'LAYER 01   OK'], [K.layer2, 'LAYER 02   OK'], [K.line1, 'LINE 001   OK'], [K.line2, 'LINE 002   OK'],
    [K.thousand, 'SCAN DIR   ...'], [K.one, 'CANDIDATE  3'], [K.mine, 'MINE       LOCK']];
  let y = 10; const shown = LOG.filter(([t0]) => t >= t0);
  shown.forEach(([t0, s], i) => { const s2 = typed(t, t0, s, 60); txt(s2, 10, y, s.includes('LOCK') ? D.lime : i === shown.length - 1 ? D.ice : D.violet); if (i === shown.length - 1 && (s2.length < s.length || Math.floor(t * 4) % 2)) orect(10 + s2.length * 6 + 1, y, 5, 7, D.cyan); y += 9; });
  // 右上：方向计数（乱跳后落定）
  if (t >= K.thousand) { const v = roll(t, K.directions, '1000', 7, 5) ?? String(Math.floor(clamp((t - K.thousand) / 0.7) * 999)).padStart(4, '0'); txt('DIR', 250, 10, D.cyan); txt(v, 274, 10, t >= K.directions ? D.white : D.ice); }
  // 右边：刻度尺整格上滚（「数据活着」）
  for (let y2 = 24; y2 < 156; y2++) { const v = (y2 + Math.floor((t - T0) * 15)) % 6; if (v === 0) orect(v === 0 && (y2 + Math.floor((t - T0) * 15)) % 30 === 0 ? 306 : 309, y2, 4, 1, D.blue); }
  // 候选框：词一到就跳过去、1.4 → 1.0 吸附；「mine」= 绿色双框锁定
  const z = zoomAt(t), crop = cropOf(z, t);
  const proj = ([x, y]) => [(x - crop[0]) * z / 6, (y - crop[1]) * z / 6];
  const ct = [[K.one, CAND[0]], [K.of, CAND[1]], [K.thems, CAND[2]]];
  if (t >= K.one && t < K.mine) {
    let cur = ct[0]; for (const c of ct) if (t >= c[0]) cur = c;
    const s = snapAt(t, cur[0]), [x, y] = proj(cur[1]);
    if (flick(t, cur[0])) { brackets(x, y, 9 * s, 9 * s, 4, D.ice); txt(roll(t, cur[0], `${String(Math.round(cur[1][0] * 3.1)).padStart(3, '0')}.${String(Math.round(cur[1][1] * 7.3)).padStart(3, '0')}`, 11 + ct.indexOf(cur), 4), x + 13, y - 3, D.cyan); }
  }
  if (t >= K.mine && t < K.off) {
    const s = snapAt(t, K.mine), [x, y] = proj(fr(t) - fr(K.mine) < 8 ? MINE : DOT(t));
    brackets(x, y, 12 * s, 12 * s, 5, D.lime); brackets(x, y, 7 * s, 7 * s, 3, D.white);
    if (x < 270) txt('MINE', x + 17, y - 3, D.lime);
  }
}

// ---------- 站台（36.06–43.8）：开机 → 从她眼睛往外重新上色 → BRAND NEW → HUD 读数 → 眼睛特写 → 海一圈圈亮起来 → WAKE UP ----------
function expr(t) {
  if (t < K.on + 0.1) return { eyes: 'closed', mouth: 'flat' };
  if (t < K.brand) return { eyes: 'slit', mouth: 'flat' };
  if (t < K.nw) return { eyes: 'open', mouth: 'flat' };
  if (t < K.girl) return { eyes: 'wide', mouth: 'oh' };
  if (t < K.at) return { eyes: 'open', mouth: 'smile' };
  if (t >= K.here && t < K.here + 0.1) return { eyes: 'blink', mouth: 'flat' };
  if (t < K.wait) return { eyes: 'open', mouth: 'flat' };
  if (t < K.eyes) return { eyes: 'open', mouth: 'smile' };
  if (t < K.wide) return { eyes: 'open', mouth: 'flat' };
  if (t < K.the) return { eyes: 'wide', mouth: t >= K.open ? 'oh' : 'flat' };
  if (t >= 42.42 && t < 42.52) return { eyes: 'blink', mouth: 'smile' };
  if (t >= K.wake) return { eyes: 'wide', mouth: 'smile' };
  return { eyes: 'open', mouth: 'smile' };
}
function drawStation(t) {
  IB.fill(0); TB.fill(0);
  // 镜头：整格漂移（按 15 fps 走），每层不同倍率 = 视差
  const lt = t - K.on, drift = Math.round(-6 + 12 * clamp(lt / 7.7)), dY = Math.round(2 * clamp(lt / 7.7));
  const breath = Math.floor(t * 2.08) % 2;                              // 呼吸：2 帧循环，跟着 125 BPM 的半拍
  const at = (key, depth) => { const L = PX.layers[key]; return [L.x * CELL - CAM0[0] - Math.round(drift * depth), L.y * CELL - CAM0[1] - Math.round(dY * depth)]; };
  sctx.clearRect(0, 0, W, H);
  layer(sctx, 'bg', ...at('bg', 0.3), CELL);
  layer(sctx, 'frame', ...at('frame', 0.5), CELL);
  // 屏幕内容：每到小节头整块横向错一格（故障）
  if (Math.floor(t * 3) % 4) layer(sctx, 'mini', ...at('mini', 0.5), CELL);
  grab(1); sctx.clearRect(0, 0, W, H);
  // 广告屏 = 屏里的那片海：先压暗（还没醒），「The sea's lighting up」之后被亮环一圈圈点亮
  const sc = at('screen', 0.5), bar = lastBeat(t), jump = hash(Math.round(bar * 100), 3) < 0.3 && t - bar < 0.1 ? 6 : 0;
  layer(sctx, 'screen', sc[0] + jump, sc[1], CELL);
  grab(2); sctx.clearRect(0, 0, W, H);
  layer(sctx, 'rail', ...at('rail', 0.8), CELL);
  for (let k = 1; k <= 5; k++) { const p = at('strip' + k, 0.85), q = Math.floor(t / 0.24), off = hash(q, k) < 0.3 ? Math.round((hash(q, k, 5) - 0.5) * 20) * 2 : 0; layer(sctx, 'strip' + k, p[0] + off, p[1], CELL); }
  grab(1);
  sctx.clearRect(0, 0, W, H);
  const g = at('girl', 1);
  girl(sctx, g[0], g[1] + breath, CELL, expr(t));
  grab(0);
  return { drift, breath };
}
// 站台 HUD
function stationHUD(t, cam) {
  const z = zoomAt(t), crop = cropOf(z, t), proj = ([x, y]) => [(x - crop[0]) * z / 6, (y - crop[1]) * z / 6];
  const eyeW = EYES.map(e => [e[0] - cam.drift, e[1] + cam.breath]);
  // BRAND NEW / GIRL：逐词从上面整格砸下来（阶梯落位），扫光，然后 Bayer 溶解掉
  const DROP = [-44, -26, -10, 4, 1, 0];
  const dis = t >= K.at - 0.2 ? clamp((fr(t) - fr(K.at - 0.2)) / 6) : 0;
  if (t >= K.brand && dis < 1) {
    const shine = t >= K.girl + 0.18 ? (fr(t) - fr(K.girl + 0.18)) * 14 : -999;
    const pink = { fill: D.pink, hi: D.blush, lo: D.mag, drop: D.indigo }, lime = { fill: D.lime, hi: D.white, lo: D.limeD, drop: D.moss };
    bigTxt('BRAND', 98, 112 + steps(t, K.brand, DROP), 3, pink, { dis, shine });
    if (t >= K.nw) bigTxt('NEW', 178, 112 + steps(t, K.nw, DROP), 3, pink, { dis, shine });
    if (t >= K.girl) bigTxt('GIRL', 128, 138 + steps(t, K.girl, DROP), 3, lime, { dis, shine });
  }
  // 读数面板：她的身份 = 歌词的数据版
  if (t >= K.at && t < K.eyes) {
    const s = snapAt(t, K.at);
    const hx = 128 - cam.drift, hy = 34;
    if (flick(t, K.at)) brackets(hx, hy, 62 * s, 44 * s, 7, D.cyan);
    const rows = [[K.at, 'ID   ', 'NEW', D.lime], [K.edge, 'LOC  ', 'EDGE/GATE', D.ice], [K.never, 'SEEN ', roll(t, K.never, '000', 21, 5), D.ice], [K.wanna, 'WAIT ', roll(t, K.wanna, '0.00S', 22, 5), D.orange], [K.wait, '>    ', 'SKIP', D.lime]];
    let y = 100;
    for (const [t0, a, b, c] of rows) { if (t < t0) break; orect(8, y - 1, 98, 9, D.ink); txt(a, 10, y, D.cyan, 0); txt(b ?? '', 40, y, c, 0); y += 10; }
    if (t >= K.wait && Math.floor(t * 6) % 2) orect(64, y - 10, 5, 7, D.lime);
  }
  // 眼睛特写：两只眼各一个旋转的刻度环（按 3 帧一格转），中间写 OPEN
  if (t >= K.eyes && t < K.the) {
    const rot = Math.floor(t * 10) * 0.21;
    eyeW.forEach((e, i) => {
      const [x, y] = proj(e), r = 2.2 * z, s = snapAt(t, i ? K.wide : K.eyes);
      ocircle(x, y, r * s, D.cyan, rot + i, rot + i + 4.6, 0);
      ocircle(x, y, r * s + 4, D.blue, -rot, -rot + 6.28, 2);
      for (let k = 0; k < 4; k++) { const a = rot * 0.5 + k * Math.PI / 2; bres(x + Math.cos(a) * (r * s + 6), y + Math.sin(a) * (r * s + 6), x + Math.cos(a) * (r * s + 10), y + Math.sin(a) * (r * s + 10), (X, Y) => opx(X, Y, D.ice)); }
    });
    if (t >= K.open) { const s = roll(t, K.open, 'IRIS 100%', 31, 4); txt(s, 160 - tw(s) / 2, 150, D.lime); }
  }
  // 「every little star」：每个词多撒一把像素星芒（4 帧：点 → 十字 → 大十字 → 点），只落在屏和地面上
  const SPK = [[[0, 0]], [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0]], [[0, 0]]];
  [K.every, K.little, K.star, K.says, K.wake].forEach((t0, w) => {
    if (t < t0) return;
    for (let k = 0; k < 6 + w * 4; k++) {
      const age = fr(t) - fr(t0 + hash(w, k, 1) * 0.2); if (age < 0) continue;
      const ph = age % 12; if (ph > 3) continue;
      const x = 8 + hash(w, k, 2) * 304, y = 6 + hash(w, k, 3) * 150; if (Math.abs(x - 128) < 60 && y > 20) continue;   // 别落在她脸和身上
      for (const [a, b] of SPK[ph]) opx(x + a, y + b, ph === 2 && (Math.abs(a) > 1 || Math.abs(b) > 1) ? D.cyan : D.white);
    }
  });
  // WAKE UP
  if (t >= K.wake) {
    const lime = { fill: D.lime, hi: D.white, lo: D.limeD, drop: D.moss };
    bigTxt('WAKE', 134, 18 + steps(t, K.wake, DROP), 4, lime);
    if (t >= K.up) bigTxt('UP', 212, 18 + steps(t, K.up, DROP), 4, { fill: D.pink, hi: D.blush, lo: D.mag, drop: D.indigo });
  }
}

// ---------- 歌词（卡拉 OK：词到才出现，新词先亮绿 2 帧再回骨白） ----------
const LINES = [[T0, 30.2], [30.2, 32.1], [32.1, 34.1], [34.1, 36.0], [37.6, 38.58], [38.58, 40.15], [40.15, 41.42], [41.42, 43.2], [43.2, 43.5]];
function lyrics(t) {
  const L = LINES.find(([a, b]) => t >= a && t < b); if (!L) return;
  const ws = WORDS.filter(w => w.t0 >= L[0] - 0.08 && w.t0 < L[1] - 0.08);
  const str = ws.map(w => w.w).join(' '); if (!str) return;
  let x = Math.round(160 - tw(str) / 2); const y = 166;
  for (const w of ws) { if (t >= w.t0) { const age = fr(t) - fr(w.t0); txt(w.w, x, y, age < 2 ? D.lime : D.bone); } x += (w.w.length + 1) * 6; }
}

// ---------- 合成：LUT ----------
function cropOf(z, t) {
  const cw = OW / z, ch = OH / z;
  const c = t < K.on ? P : t < K.the ? [E[0] - (t >= K.at ? Math.round(-6 + 12 * clamp((t - K.on) / 7.7)) : 0), E[1]] : E;
  return [clamp(Math.round(c[0] - cw / 2), 0, W - cw), clamp(Math.round(c[1] - ch / 2), 0, H - ch), cw, ch];
}
const RGBA_W = new Uint8Array(W * H * 4), RGBA_O = new Uint8Array(W * H * 4);
// 海的亮环：从她往外，每拍一圈，Bayer 抖动的边
const RINGS = () => BEATS.filter(b => b >= K.the - 0.05 && b < T1 + 0.5);
function resolve(t, crop) {
  const [ox, oy, cw, ch] = crop, f = fr(t);
  const station = t >= K.on;
  const waveR = station ? 7 + (f - fr(K.on)) * 13 : -1;                   // 重新上色的波，每帧 13 格
  const rings = station && t >= K.the - 0.05 ? RINGS().filter(b => b <= t).map(b => (t - b) * 230) : [];
  const sp = Math.floor(f / 3);                                         // 色彩循环 10 fps
  const eyeBox = t >= K.eyes ? EYES : null;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const X = x + ox, Y = y + oy, i = Y * W + X; let s = IB[i]; let rgb;
    if (s >= 64) rgb = DRGB[s - 64];
    else {
      if (station) {
        const d = Math.hypot(X - E[0], Y - E[1]);
        if (TB[i] === 2 && !IS_STAR[s] && !(rings.length && d < rings[0] - 4 * bay(X, Y))) s = DEEPD[s];   // 屏里的海：最早那圈亮环扫过之前一直暗着
        if (d > waveR - 10 * bay(X, Y)) s = COLD[s];
        else if (d > waveR - 16) s = BRIGHT2[s];                            // 波前一圈最亮
        if (TB[i]) for (const r of rings) { const u = Math.abs(d - r); if (u < 7 && bay(X + 1, Y) > u / 7) { s = u < 2.5 ? BRIGHT2[s] : BRIGHT[s]; break; } }
      }
      else if (TB[i] && !IS_STAR[s]) s = DIM[s];
      if (TB[i] && IS_STAR[s]) s = STAR_CYCLE[(sp + Math.floor(hash(X >> 1, Y >> 1) * 4)) & 3];
      if (eyeBox && s === IRIS) for (const e of eyeBox) if (Math.abs(X - e[0]) < 10 && Math.abs(Y - e[1]) < 8) s = IRIS_CYCLE[(sp + (X >> 1)) % IRIS_CYCLE.length];
      rgb = SP[s];
    }
    const o = (y * cw + x) * 4; RGBA_W[o] = rgb[0]; RGBA_W[o + 1] = rgb[1]; RGBA_W[o + 2] = rgb[2]; RGBA_W[o + 3] = 255;
  }
  for (let i = 0; i < W * H; i++) { const s = OB[i], o = i * 4; if (s) { const c = DRGB[s - 64]; RGBA_O[o] = c[0]; RGBA_O[o + 1] = c[1]; RGBA_O[o + 2] = c[2]; RGBA_O[o + 3] = 255; } else RGBA_O[o + 3] = RGBA_O[o] = RGBA_O[o + 1] = RGBA_O[o + 2] = 0; }
}

// ---------- WebGL2 CRT ----------
const cv = document.createElement('canvas'); cv.width = OW; cv.height = OH; document.body.appendChild(cv);
const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uW, uO; uniform vec2 uWs, uOs, uOut, uC, uShake; uniform float uOn, uOnX, uWhite, uGain, uCA, uRoll;
out vec4 o;
// 锐利放大：格子内部取最近邻，只在格子边缘 1 个输出像素里线性过渡 → 不糊也不闪
vec4 sharpT(sampler2D tx, vec2 sz, vec2 uv){ vec2 t = uv * sz, fl = floor(t), s = t - fl; float sc = uOut.y / sz.y, reg = 0.5 - 0.5 / sc;
  vec2 cd = s - 0.5; vec2 f = (cd - clamp(cd, -reg, reg)) * sc + 0.5; return texture(tx, (fl + f) / sz); }
vec3 comp(vec2 uv){ vec4 ov = sharpT(uO, uOs, uv); vec3 w = sharpT(uW, uWs, uv + uShake / uWs).rgb; return mix(w, ov.rgb, ov.a); }
void main(){
  vec2 uv = gl_FragCoord.xy / uOut; uv.y = 1.0 - uv.y;
  vec2 c = uv * 2.0 - 1.0; float k = 0.028; vec2 u = (c * (1.0 + k * dot(c, c)) / (1.0 + k)) * 0.5 + 0.5;
  vec2 e = min(u, 1.0 - u); float bez = smoothstep(0.0, 0.002, e.x) * smoothstep(0.0, 0.0035, e.y);
  // 开机 / 关机：画面先压成一个点、一条线，再撑开（中心可以不在正中 = 她的眼睛）
  vec2 d = u - uC;
  vec2 ext = max(uC, 1.0 - uC);   // 中心偏了，撑开时按远的那一侧算
  float on = smoothstep(uOn * ext.y + 0.0015, uOn * ext.y - 0.0015, abs(d.y)) * smoothstep(uOnX * ext.x + 0.002, uOnX * ext.x - 0.002, abs(d.x));
  u.y = uC.y + d.y / max(uOn, 0.004);
  if (uRoll > 0.0) u.y = fract(u.y + uRoll);
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
  float r = length(c) / 1.4142; col *= 1.0 - 0.26 * pow(r, 2.6);
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
gl.uniform1i(U('uW'), 0); gl.uniform1i(U('uO'), 1); gl.uniform2f(U('uOut'), OW, OH); gl.uniform2f(U('uOs'), W, H);
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

// 开 / 关机序列（逐帧表；学像素片的 PWR 表）
const PWR_ON = { on: [0.012, 0.007, 0.006, 0.04, 0.34, 1], onx: [0.02, 1, 1, 1, 1, 1], wh: [1, 1, 0.8, 0.55, 0.3, 0.14, 0.05, 0], gain: [1, 1.5, 1.25, 1.12, 1.06, 1.03, 1] };
const PWR_OFF = { on: [0.4, 0.05, 0.008, 0.008, 0.006, 0], onx: [1, 1, 1, 0.3, 0.02, 0], wh: [0.2, 0.6, 0.9, 1, 1, 0] };

function draw(t) {
  OB.fill(0);
  let cam = { drift: 0, breath: 0 };
  if (t < SEA_END) drawSea(t); else cam = drawStation(t);
  if (t < SEA_END) seaHUD(t); else stationHUD(t, cam);
  lyrics(t);
  const z = zoomAt(t), crop = cropOf(z, t);
  resolve(t, crop);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, TW_); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, crop[2], crop[3], 0, gl.RGBA, gl.UNSIGNED_BYTE, RGBA_W.subarray(0, crop[2] * crop[3] * 4));
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, TO_); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, RGBA_O);
  gl.uniform2f(U('uWs'), crop[2], crop[3]);
  // CRT 状态
  let on = 1, onx = 1, wh = 0, gain = 1, C = [0.5, 0.5], roll = 0;
  if (t >= K.off && t < K.on) { const k = Math.min(fr(t) - fr(K.off), 5); on = PWR_OFF.on[k]; onx = PWR_OFF.onx[k]; wh = PWR_OFF.wh[k]; C = [(P[0] - crop[0]) / crop[2], (P[1] - crop[1]) / crop[3]]; }
  if (t >= K.on) { const k = fr(t) - fr(K.on), g = (a, d) => a[Math.min(k, a.length - 1)] ?? d; on = g(PWR_ON.on, 1); onx = g(PWR_ON.onx, 1); wh = g(PWR_ON.wh, 0); gain = g(PWR_ON.gain, 1); C = [E[0] / W, E[1] / H]; }
  // 词 / 拍上的小冲击：缩放跳档那一帧提亮；kick 上整格震 1 格（只在站台）
  if (fr(t) === fr(K.the)) { wh = 0.35; gain = 1.2; }
  if (t >= K.wake && fr(t) - fr(K.wake) < 2) gain = 1.25;
  if (t >= K.up && fr(t) - fr(K.up) < 2) { gain = 1.35; wh = 0.15; }
  if (t >= K.mine && fr(t) - fr(K.mine) < 2) gain = 1.3;
  const shake = t >= K.on && kick(t) > 0.7 ? (fr(t) % 2 ? 1 : -1) : 0;
  if (t >= K.on && t < K.on + 0.08) roll = 0;
  gl.uniform1f(U('uOn'), on); gl.uniform1f(U('uOnX'), onx); gl.uniform1f(U('uWhite'), wh); gl.uniform1f(U('uGain'), gain + (t >= K.on ? 0.05 * kick(t) : 0));
  gl.uniform2f(U('uC'), C[0], C[1]); gl.uniform2f(U('uShake'), 0, shake); gl.uniform1f(U('uCA'), 1.2 + (gain > 1.1 ? 2 : 0)); gl.uniform1f(U('uRoll'), roll);
  gl.viewport(0, 0, OW, OH); gl.drawArrays(gl.TRIANGLES, 0, 3);
}
window.renderAt = t => { draw(t); gl.finish(); };

// ---------- 启动 ----------
const ui = document.getElementById('ui');
if (RENDER) {
  ui.remove();
  const n = Math.round((T1 - T0) * FPS), out = Q.get('out') ?? '-5_Clean Slate/样片/风格小样_她睁眼_animator2.mp4';
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
