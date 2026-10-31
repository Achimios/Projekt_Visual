// animator2 · 环境层模块（ES module）—— 虚拟世界的坐标地面 / 律动山脉 / moving walls / 鸟群 / 关窗的塔。
// 用法：import { Px, makeCamera, createEnv } from './env.js'
//   const buf = new Px(320, 180);              // 低分辨率 RGBA（透明底），像素风靠「画在 320×180、最近邻放大」
//   const env = createEnv(AUD, opts);          // AUD = _web/audio.json（kick / bass 包络 60 fps + beats）
//   env.draw(buf, t, cam, state)               // 画进 buf；没画到的格子 alpha = 0 → 能叠在任何人的 RGB 画面上：
//   overlay(ctx2d, buf)                        // 叠到别人的 1920×1080 canvas 上（关平滑，整格放大）
// 规则：每帧 = 歌曲时间 t 的纯函数（鸟群是加载时按固定步长预先算好的，也是纯函数）；随机全走 hash。
// 音乐只作用在有形的东西上：拍子 = 地面上往前跑的一道光、墙一节节升起；贝斯 = 山的高度；没有全屏抖动。

// ---------- 工具 ----------
export const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
export const lerp = (a, b, u) => a + (b - a) * u;
export function hash(...a) { let h = 2166136261 >>> 0; for (const v of a) { h ^= Math.imul(v | 0, 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h ^= h >>> 16; } return (h >>> 0) / 4294967296; }
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bay = (x, y) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
export const stepq = (u, n) => Math.floor(clamp(u) * n) / n;          // 量化成 n 档（运动一格格走）

// 调色（同 full.js 的直接色）
const HEX = { ink: '05040c', night: '0e0b24', indigo: '2c2386', blue: '1d4fa0', cyan: '3de0ff', ice: 'a8f4ff', pink: 'ff3d9a', blush: 'ffd0ec',
  lime: 'c8ff1e', limeD: '6e9410', orange: 'ff8a2a', bone: 'e8e4dc', white: 'ffffff', deep: '0f2a5c', violet: '5a4fe0', mag: 'c42a9e', grey: '6a6878',
  amber: 'ffc46b', moss: '27360a', dusk: '1a1440' };
export const PAL = Object.fromEntries(Object.entries(HEX).map(([k, h]) => [k, [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))]));
export const mixc = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * clamp(u)));

// ---------- 字 ----------
const F5 = {
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
  '/': [0, 1, 2, 4, 8, 16, 0], '-': [0, 0, 0, 31, 0, 0, 0], '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4], '_': [0, 0, 0, 0, 0, 0, 31], '+': [0, 4, 4, 31, 4, 4, 0],
};
const F3 = {
  0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 3, 1, 7], 4: [5, 5, 7, 1, 1], 5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 1, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7],
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7],
  J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
  ' ': [0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 2], '+': [0, 2, 7, 2, 0], '-': [0, 0, 7, 0, 0], '/': [1, 1, 2, 4, 4], ':': [0, 2, 0, 2, 0], '%': [5, 1, 2, 4, 5], '_': [0, 0, 0, 0, 7],
  '>': [4, 2, 1, 2, 4], '#': [5, 7, 5, 7, 5], '[': [6, 4, 4, 4, 6], ']': [3, 1, 1, 1, 3], ',': [0, 0, 0, 2, 4], '=': [0, 7, 0, 7, 0],
};
export const tw5 = s => s.length * 6 - 1, tw3 = s => s.length * 4 - 1;

// ---------- 像素缓冲（RGBA，透明底）----------
export class Px {
  constructor(W = 320, H = 180) { this.W = W; this.H = H; this.d = new Uint8ClampedArray(W * H * 4); }
  clear() { this.d.fill(0); }
  // a < 1：按 Bayer 阈值决定画不画（像素风的「半透明」= 抖动，不混色）
  px(x, y, c, a = 1) {
    x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    if (a < 1 && bay(x, y) >= a) return;
    const o = (y * this.W + x) * 4; this.d[o] = c[0]; this.d[o + 1] = c[1]; this.d[o + 2] = c[2]; this.d[o + 3] = 255;
  }
  get(x, y) { const o = (y * this.W + x) * 4; return [this.d[o], this.d[o + 1], this.d[o + 2], this.d[o + 3]]; }
  rect(x, y, w, h, c, a = 1) { x = Math.round(x); y = Math.round(y); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a); }
  frame(x, y, w, h, c, a = 1) { for (let i = 0; i < w; i++) { this.px(x + i, y, c, a); this.px(x + i, y + h - 1, c, a); } for (let j = 0; j < h; j++) { this.px(x, y + j, c, a); this.px(x + w - 1, y + j, c, a); } }
  line(x0, y0, x1, y1, c, a = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    if (Math.max(Math.abs(x0), Math.abs(x1), Math.abs(y0), Math.abs(y1)) > 4000) return;
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) { this.px(x0, y0, c, a); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  // 扫描线填充（凹多边形也行），取像素中心
  poly(P, c, a = 1) {
    if (P.length < 3) return;
    let y0 = Infinity, y1 = -Infinity; for (const p of P) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    y0 = Math.max(0, Math.ceil(y0 - 0.5)); y1 = Math.min(this.H - 1, Math.floor(y1 - 0.5));
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5; xs.length = 0;
      for (let i = 0; i < P.length; i++) { const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length]; if ((ay <= yc) !== (by <= yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax)); }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) { const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(this.W - 1, Math.floor(xs[k + 1] - 0.5)); for (let x = xa; x <= xb; x++) this.px(x, y, c, a); }
    }
  }
  text(s, x, y, c, { small = false, sh = PAL.ink, cell = 1, a = 1 } = {}) {
    const F = small ? F3 : F5, gw = small ? 3 : 5, gh = small ? 5 : 7, adv = (gw + 1) * cell;
    x = Math.round(x); y = Math.round(y);
    for (let pass = sh ? 0 : 1; pass < 2; pass++) {
      let cx = x;
      for (const ch of String(s).toUpperCase()) {
        const g = F[ch] ?? F['?'] ?? F[' '];
        for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if (g[j] >> (gw - 1 - i) & 1)
          for (let b = 0; b < cell; b++) for (let q = 0; q < cell; q++) this.px(cx + i * cell + q + (pass ? 0 : 1), y + j * cell + b + (pass ? 0 : 1), pass ? c : sh, a);
        cx += adv;
      }
    }
  }
  // 把另一张 Px 盖上来（只盖不透明的格子）
  over(o) { const d = this.d, s = o.d; for (let i = 0; i < d.length; i += 4) if (s[i + 3]) { d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; d[i + 3] = 255; } }
}
// 叠到别人的画布上：低分辨率整格放大，透明处露出底下的画面
const OVC = document.createElement('canvas');
export function overlay(ctx, buf, x = 0, y = 0, w = ctx.canvas.width, h = ctx.canvas.height) {
  OVC.width = buf.W; OVC.height = buf.H; OVC.getContext('2d').putImageData(new ImageData(buf.d, buf.W, buf.H), 0, 0);
  const s = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(OVC, x, y, w, h); ctx.imageSmoothingEnabled = s;
}

// ---------- 镜头：真 3D 机位，Catmull-Rom 关键帧 + 歌词点上「进」一下（同 open_v2.js 的做法）----------
// keys: [时刻, 机位 xyz, 看向 xyz, 侧倾 rad, 焦距 px（相对 320 宽）]；pushes: [[时刻, 往前冲多少世界单位], …]
const cr = (p0, p1, p2, p3, u) => { const u2 = u * u, u3 = u2 * u; return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3); };
const norm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
export function makeCamera(keys, pushes = [], W = 320, H = 180) {
  const keyAt = t => {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
    const u = clamp((t - k1[0]) / (k2[0] - k1[0])), v = j => k1[j].map((_, n) => cr(k0[j][n], k1[j][n], k2[j][n], k3[j][n], u));
    return { pos: v(1), tgt: v(2), roll: cr(k0[3], k1[3], k2[3], k3[3], u), F: cr(k0[4], k1[4], k2[4], k3[4], u) };
  };
  const at = t => {
    const k = keyAt(t), f = norm(k.tgt.map((v, j) => v - k.pos[j]));
    let push = 0; for (const [ta, amt] of pushes) if (t > ta) push += amt * (1 - Math.exp(-(t - ta) / 0.1)) * Math.exp(-(t - ta) / 1.4);
    const pos = k.pos.map((v, j) => v + f[j] * push);
    const r = norm([f[2], 0, -f[0]]), u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    return { t, pos, f, r, u, F: k.F, roll: k.roll, W, H, cs: Math.cos(k.roll), sn: Math.sin(k.roll) };
  };
  return t => { const c = at(t), p = at(t - 1 / 30); c.vel = c.pos.map((v, j) => v - p.pos[j]); return c; };
}
export const toCam = (c, p) => { const d = [p[0] - c.pos[0], p[1] - c.pos[1], p[2] - c.pos[2]]; return [d[0] * c.r[0] + d[1] * c.r[1] + d[2] * c.r[2], d[0] * c.u[0] + d[1] * c.u[1] + d[2] * c.u[2], d[0] * c.f[0] + d[1] * c.f[1] + d[2] * c.f[2]]; };
export const scr = (c, q) => { const x = q[0] * c.F / q[2], y = -q[1] * c.F / q[2]; return [c.W / 2 + x * c.cs - y * c.sn, c.H / 2 + x * c.sn + y * c.cs, c.F / q[2]]; };
export const project = (c, p) => { const q = toCam(c, p); return q[2] > 0.3 ? scr(c, q) : null; };
const NEAR = 0.3;
export function seg3(buf, c, a, b, col, al = 1) {
  let p = toCam(c, a), q = toCam(c, b);
  if (p[2] < NEAR && q[2] < NEAR) return;
  if (p[2] < NEAR || q[2] < NEAR) { const u = (NEAR - p[2]) / (q[2] - p[2]), m = p.map((v, i) => v + (q[i] - v) * u); if (p[2] < NEAR) p = m; else q = m; }
  const A = scr(c, p), B = scr(c, q); buf.line(A[0], A[1], B[0], B[1], col, al);
}
export function poly3(buf, c, P, col, al = 1) {          // 近平面裁剪（Sutherland–Hodgman）后填充
  const Q = P.map(p => toCam(c, p)), out = [];
  for (let i = 0; i < Q.length; i++) {
    const a = Q[i], b = Q[(i + 1) % Q.length], ia = a[2] >= NEAR, ib = b[2] >= NEAR;
    if (ia) out.push(a);
    if (ia !== ib) { const u = (NEAR - a[2]) / (b[2] - a[2]); out.push(a.map((v, k) => v + (b[k] - v) * u)); }
  }
  if (out.length >= 3) buf.poly(out.map(q => scr(c, q)), col, al);
}
// 屏幕上一个像素的视线打到平面 z = Z 的世界坐标（贴图到正对镜头的面上用）
export function rayZ(c, sx, sy, Z) {
  const x0 = sx + 0.5 - c.W / 2, y0 = sy + 0.5 - c.H / 2, x = x0 * c.cs + y0 * c.sn, y = -x0 * c.sn + y0 * c.cs;
  const d = [0, 1, 2].map(j => c.f[j] * c.F + c.r[j] * x - c.u[j] * y);
  if (Math.abs(d[2]) < 1e-6) return null; const s = (Z - c.pos[2]) / d[2]; if (s <= 0) return null;
  return [c.pos[0] + d[0] * s, c.pos[1] + d[1] * s];
}

// ---------- 环境 ----------
// opts.tower = { z, rows, cols, ww, wh, gap, y0, names[] }；state 由调用方逐帧给（closeT[] 每扇窗关的时刻、front 关机波前 z、lime 0–1 地面变绿……）
export function createEnv(AUD, opts = {}) {
  const env = (k, t) => AUD[k][clamp(Math.floor(t * AUD.fps), 0, AUD[k].length - 1)];
  const kick = t => env('kick', t), bass = t => env('bass', t);
  const BEATS = AUD.beats, DOWN = AUD.downbeats;
  // 贝斯 / 底鼓平滑一点（0.15 s 窗口取均值）当山的「呼吸」
  const smooth = (k, t, w = 0.15) => { let s = 0, n = 0; for (let x = t - w; x <= t; x += 1 / AUD.fps) { s += env(k, x); n++; } return s / n; };
  const TW = Object.assign({ z: 82, cols: 5, rows: 3, ww: 3.2, wh: 1.8, gap: 0.8, y0: 10, top: 34 }, opts.tower ?? {});
  TW.w = TW.cols * TW.ww + (TW.cols + 1) * TW.gap; TW.h = TW.rows * TW.wh + (TW.rows + 1) * TW.gap;
  TW.win = (i, j) => { const x0 = -TW.w / 2 + TW.gap + i * (TW.ww + TW.gap), y0 = TW.y0 + TW.gap + j * (TW.wh + TW.gap); return { x0, y0, x1: x0 + TW.ww, y1: y0 + TW.wh, cx: x0 + TW.ww / 2, cy: y0 + TW.wh / 2 }; };
  const WCOL = [PAL.cyan, PAL.pink, PAL.lime, PAL.amber, PAL.ice, PAL.violet, PAL.blush];

  // ---- 山：每一排是「过去某一刻」的音乐（近 = 现在，远 = 越早的声音），所以山脉会把刚才的鼓点一排排往远处推走 ----
  const MR = 13, MZ0 = 100, MDZ = 3.6, MDT = 0.16;
  const RIDGE = Array.from({ length: MR }, (_, j) => {          // 每排固定的山形：几座高斯峰的最大值
    const pk = Array.from({ length: 7 }, (_, k) => [-80 + hash(j, k, 3) * 160, 5 + hash(j, k, 4) * 14, 0.4 + hash(j, k, 5) * 0.6]);
    return x => { let m = 0.08; for (const [c, w, a] of pk) m = Math.max(m, a * Math.exp(-(((x - c) / w) ** 2))); return m; };
  });
  function mountains(buf, t, c, st) {
    const dim = st.mDim ?? 0;
    for (let j = MR - 1; j >= 0; j--) {
      const th = t - j * MDT, z = MZ0 + j * MDZ;
      const amp = (1.2 + 13 * smooth('bass', th) + 9 * smooth('kick', th, 0.08)) * (1 - 0.85 * dim);
      const P = [[-110, -1, z]];
      for (let x = -110; x <= 110; x += 2.5) P.push([x, amp * RIDGE[j](x) + 0.3 * Math.sin(x * 0.7 + j), z]);
      P.push([110, -1, z]);
      poly3(buf, c, P, PAL.ink);
      const near = 1 - j / MR, col = mixc(mixc(PAL.indigo, j < 2 ? PAL.cyan : PAL.violet, near * 0.9), PAL.night, dim * (0.6 + 0.4 * (1 - near)));
      for (let k = 1; k < P.length - 2; k++) seg3(buf, c, P[k], P[k + 1], col, 0.35 + 0.65 * near);
    }
  }

  // ---- 地面：虚拟世界的坐标网格。每拍从镜头脚下往塔的方向跑出一道光（信号送出去），关机时波前后面的格子熄灭 ----
  function grid(buf, t, c, st) {
    const front = st.front ?? -1e9, lime = st.lime ?? 0;
    const z0 = Math.max(0, Math.floor((c.pos[2] - 4) / 2) * 2), z1 = TW.z - 2, xr = 36;   // 网格止于塔前（塔后面的格子会被塔挡住）
    const pulse = z => { let b = 0; for (const bt of BEATS) { if (bt > t) break; if (t - bt > 2.5 || bt > (st.kickOff ?? 1e9)) continue; const zf = c.pos[2] - 2 + (t - bt) * 34; b = Math.max(b, Math.exp(-(((z - zf) / 2.2) ** 2)) * (1 - (t - bt) / 2.5)); } return b; };
    const base = mixc(PAL.deep, PAL.limeD, lime), hot = mixc(PAL.cyan, PAL.lime, lime);
    for (let z = z0; z <= z1; z += 2) {                         // 横线
      const fade = clamp(1 - (z - c.pos[2]) / 70), off = z < front, p = off ? 0 : pulse(z);
      const col = off ? PAL.dusk : p > 0.5 ? PAL.white : p > 0.15 ? hot : base;
      seg3(buf, c, [-xr, 0, z], [xr, 0, z], col, off ? 0.25 * fade : (0.3 + 0.7 * p) * fade + 0.15);
    }
    for (let x = -xr; x <= xr; x += 2) {                        // 纵线（分段画，好按距离淡出 / 按波前熄灭）
      for (let z = z0; z < z1; z += 6) {
        const fade = clamp(1 - (z - c.pos[2]) / 70), off = z + 6 <= front;
        seg3(buf, c, [x, 0, z], [x, 0, z + 6], off ? PAL.dusk : base, (off ? 0.2 : x === 0 ? 0.9 : 0.45) * fade + 0.1);
      }
    }
    // 坐标读数：只标镜头前方最近的几个交点（x = -8 / 0 / 8，z 每 8 一格）
    for (let z = Math.ceil((c.pos[2] + 6) / 8) * 8; z < c.pos[2] + 30; z += 8) for (const x of (z / 8) % 2 ? [-8, 8] : [0]) {   // 交错标，别挤成一团
      const p = project(c, [x, 0, z]); if (!p || p[0] < 2 || p[0] > c.W - 30 || p[1] < 20 || p[1] > c.H - 34) continue;
      const off = z < front, col = off ? PAL.grey : lime > 0.5 ? PAL.lime : PAL.ice;
      buf.px(p[0], p[1], col); buf.px(p[0] - 1, p[1], col); buf.px(p[0] + 1, p[1], col); buf.px(p[0], p[1] - 1, col); buf.px(p[0], p[1] + 1, col);
      buf.text(off ? '--,--' : `${x >= 0 ? '+' : '-'}${String(Math.abs(x)).padStart(2, '0')},${String(z).padStart(3, '0')}`, p[0] + 3, p[1] - 6, col, { small: true, sh: null });
    }
  }

  // ---- moving walls：走廊两边一节节的墙。拍子 = 一道升起的浪从脚下往塔推过去；每个强拍墙整体换一次排布（像软件在重新排窗）----
  const NS = 18, SZ0 = 4, SL = 3.6, SG = 0.6;
  function walls(buf, t, c, st) {
    const front = st.front ?? -1e9, frontT = st.frontT ?? (() => 1e9);
    const db = DOWN.filter(d => d <= t && d <= (st.kickOff ?? 1e9)).length;
    const list = [];
    for (const s of [-1, 1]) for (let i = 0; i < NS; i++) {
      const z = SZ0 + i * (SL + SG);
      let h = 1.2 + 2.2 * smooth('bass', t - i * 0.03);
      for (const bt of BEATS) { if (bt > t) break; if (t - bt > 2 || bt > (st.kickOff ?? 1e9)) continue; const zf = c.pos[2] - 2 + (t - bt) * 34; h += 4.5 * Math.exp(-(((z + SL / 2 - zf) / 3) ** 2)) * (1 - (t - bt) / 2); }
      h = Math.round(h * 2) / 2;                                 // 半格量化：墙是一格格升的
      const shift = (hash(i, s, db) > 0.5 ? 1 : 0) * 1.6;        // 强拍换排布
      const lastDb = DOWN.filter(d => d <= t && d <= (st.kickOff ?? 1e9)).pop() ?? -9;
      const prevShift = (hash(i, s, db - 1) > 0.5 ? 1 : 0) * 1.6, ue = stepq((t - lastDb) / 0.2, 4);
      const x = s * (7 + lerp(prevShift, shift, ue));
      const tp = frontT(z), sink = stepq((t - tp) / 0.4, 5);    // 关机波前扫过：墙一节节沉进地里
      h *= 1 - sink;
      if (h < 0.05) continue;
      list.push({ s, i, z, x, h, off: z < front });
    }
    list.sort((a, b) => b.z - a.z);
    for (const w of list) {
      const xi = w.x, xo = w.x + w.s * 1.4, z0 = w.z, z1 = w.z + SL;
      const face = w.off ? PAL.ink : PAL.night, edge = w.off ? PAL.dusk : PAL.cyan;
      poly3(buf, c, [[xi, 0, z0], [xi, w.h, z0], [xi, w.h, z1], [xi, 0, z1]], face);           // 朝走廊的面
      poly3(buf, c, [[xi, w.h, z0], [xo, w.h, z0], [xo, w.h, z1], [xi, w.h, z1]], w.off ? PAL.ink : PAL.indigo); // 顶面
      seg3(buf, c, [xi, w.h, z0], [xi, w.h, z1], edge); seg3(buf, c, [xi, 0, z0], [xi, w.h, z0], w.off ? PAL.dusk : PAL.deep);
      if (!w.off) for (let k = 0; k < 6; k++) {                  // 墙面上的数据灯：亮几个随贝斯变
        const yy = 0.5 + hash(w.i, w.s, k) * Math.max(0.1, w.h - 1), zz = z0 + 0.4 + hash(w.i, k, w.s) * (SL - 0.8);
        if (hash(w.i, k, Math.floor(t * 6)) < 0.25 + bass(t)) { const p = project(c, [xi, yy, zz]); if (p) buf.px(p[0], p[1], k % 3 ? PAL.ice : PAL.pink); }
      }
    }
  }

  // ---- 塔：15 扇窗 = 她这一段建起来的 15 样东西（软件 / 文件 / 想法）。关窗 = 卷帘一格格落下、灯灭 ----
  function tower(buf, t, c, st) {
    const z = TW.z, x0 = -TW.w / 2 - 1.2, x1 = TW.w / 2 + 1.2;
    poly3(buf, c, [[x0, 0, z], [x0, TW.top, z], [x1, TW.top, z], [x1, 0, z]], PAL.ink);
    for (const [a, b] of [[[x0, 0, z], [x0, TW.top, z]], [[x1, 0, z], [x1, TW.top, z]], [[x0, TW.top, z], [x1, TW.top, z]]]) seg3(buf, c, a, b, PAL.deep);
    // 顶上的天线灯：按拍闪（拍子停了就慢慢闪）
    const ap = project(c, [0, TW.top + 3, z]); seg3(buf, c, [0, TW.top, z], [0, TW.top + 3, z], PAL.deep);
    if (ap) { const on = t < (st.kickOff ?? 1e9) ? kick(t) > 0.5 : Math.floor(t * 1.5) % 2 === 0; if (on) buf.rect(ap[0] - 1, ap[1] - 1, 2, 2, PAL.pink); }
    for (let j = 0; j < TW.rows; j++) for (let i = 0; i < TW.cols; i++) {
      const k = j * TW.cols + i, w = TW.win(i, j), ct = st.closeT?.[k] ?? 1e9;
      const shut = t < ct ? 0 : stepq((t - ct) / 0.2, 6);       // 卷帘落下的比例
      const P = [[w.x0, w.y0, z - 0.01], [w.x0, w.y1, z - 0.01], [w.x1, w.y1, z - 0.01], [w.x1, w.y0, z - 0.01]];
      if (st.imgWin === k) { st.imgDraw?.(buf, t, c, w, z - 0.01, shut); }
      else {
        const col = WCOL[k % WCOL.length], lit = t < ct ? 0.55 + 0.45 * kick(t) * (t < (st.kickOff ?? 1e9) ? 1 : 0) : 0;
        poly3(buf, c, P, mixc(PAL.night, col, t < ct ? 0.35 : 0));
        if (t < ct) for (let r = 0; r < 4; r++) {                // 窗里的「内容」：几行长短不一的条（这扇窗在跑的软件）
          const len = 0.3 + hash(k, r, Math.floor(t * 4)) * 0.6, yy = w.y1 - 0.35 - r * 0.38;
          seg3(buf, c, [w.x0 + 0.25, yy, z - 0.02], [w.x0 + 0.25 + (TW.ww - 0.5) * len, yy, z - 0.02], col, lit);
        }
      }
      if (shut > 0) {                                            // 卷帘：从上往下
        const yb = w.y1 - (w.y1 - w.y0) * shut;
        poly3(buf, c, [[w.x0, yb, z - 0.03], [w.x0, w.y1, z - 0.03], [w.x1, w.y1, z - 0.03], [w.x1, yb, z - 0.03]], PAL.ink);
        seg3(buf, c, [w.x0, yb, z - 0.04], [w.x1, yb, z - 0.04], shut < 1 ? PAL.bone : PAL.dusk);
      }
      const fr = (t - ct) * 30; if (fr >= 0 && fr < 2) { const p = project(c, [w.cx, w.cy, z]); if (p) buf.rect(p[0] - 1, p[1] - 1, 3, 3, PAL.white); }  // 关的那一下：中心一个白点
      for (const [a, b] of [[P[0], P[1]], [P[1], P[2]], [P[2], P[3]], [P[3], P[0]]]) seg3(buf, c, a, b, shut >= 1 ? PAL.dusk : PAL.deep);
    }
  }

  // ---- 鸟群：48 只 = 活跃的 token / 注意力。平时绕着塔盘旋（boids：聚拢 + 对齐 + 分离 + 绕塔），vibe is the sky 冲上天，
  //      窗开始关后一只只离队，往山后面飞走。加载时按 60 Hz 固定步长从 SIM0 算到 SIM1，之后按 t 查表 ----
  const NB = opts.birds ?? 48, SIM0 = opts.sim0 ?? 110, SIM1 = opts.sim1 ?? 126, DT = 1 / 60, NSTEP = Math.ceil((SIM1 - SIM0) / DT) + 1;
  const BP = new Float32Array(NSTEP * NB * 3), BV = new Float32Array(NSTEP * NB * 3);
  const skyT = opts.skyT ?? 1e9, leave0 = opts.leaveT ?? 1e9, leaveDur = opts.leaveDur ?? 1.8;
  const LEAVE = Array.from({ length: NB }, (_, i) => leave0 + (hash(i, 77) * 0.85 + i / NB * 0.15) * leaveDur);
  {
    const p = new Float32Array(NB * 3), v = new Float32Array(NB * 3);
    for (let i = 0; i < NB; i++) { const a = hash(i, 1) * 6.283; p[i * 3] = Math.cos(a) * 14; p[i * 3 + 1] = 22 + hash(i, 2) * 10; p[i * 3 + 2] = TW.z + Math.sin(a) * 10; v[i * 3] = -Math.sin(a) * 8; v[i * 3 + 2] = Math.cos(a) * 8; }
    for (let s = 0; s < NSTEP; s++) {
      const t = SIM0 + s * DT; BP.set(p, s * NB * 3); BV.set(v, s * NB * 3);
      for (let i = 0; i < NB; i++) {
        const ix = i * 3, gone = t > LEAVE[i];
        let ch = [0, 0, 0], al = [0, 0, 0], se = [0, 0, 0], n = 0;
        for (let k = 0; k < NB; k++) { if (k === i || (t > LEAVE[k]) !== gone) continue; const kx = k * 3, d = [p[kx] - p[ix], p[kx + 1] - p[ix + 1], p[kx + 2] - p[ix + 2]], r = Math.hypot(...d);
          if (r < 9) { n++; for (let q = 0; q < 3; q++) { ch[q] += d[q]; al[q] += v[kx + q]; } if (r < 1.6) for (let q = 0; q < 3; q++) se[q] -= d[q] / (r * r + 0.05); } }
        let tg;
        if (gone) tg = [(hash(i, 9) - 0.5) * 160, 30 + hash(i, 10) * 25, 260];
        else if (t > skyT) tg = [Math.cos(t * 1.4 + i) * 7, 30 + 5 * Math.sin(i), 58 + Math.sin(t * 1.4 + i) * 6];
        else { const a = t * 0.55 + hash(i, 3) * 1.2; tg = [Math.cos(a) * 15, 24 + 4 * Math.sin(a * 2 + i), TW.z - 4 + Math.sin(a) * 11]; }
        const acc = [0, 0, 0];
        for (let q = 0; q < 3; q++) acc[q] = (n ? ch[q] / n * 0.5 + (al[q] / n - v[ix + q]) * 1.2 : 0) + se[q] * 6 + (tg[q] - p[ix + q]) * (gone ? 0.9 : t > skyT ? 1.6 : 0.7);
        for (let q = 0; q < 3; q++) v[ix + q] += acc[q] * DT;
        const sp = Math.hypot(v[ix], v[ix + 1], v[ix + 2]), lo = 6, hi = gone ? 22 : t > skyT ? 26 : 13;
        const k2 = sp < lo ? lo / sp : sp > hi ? hi / sp : 1; for (let q = 0; q < 3; q++) { v[ix + q] *= k2; p[ix + q] += v[ix + q] * DT; }
      }
    }
  }
  const BIRD = [['X.....X', '.X...X.', '..X.X..', '...X...'], ['.......', '.......', 'XXXXXXX', '...X...']];
  function birds(buf, t, c, st) {
    const s = clamp(Math.floor((t - SIM0) / DT), 0, NSTEP - 1);
    for (let i = 0; i < NB; i++) {
      const o = (s * NB + i) * 3, P = [BP[o], BP[o + 1], BP[o + 2]], p = project(c, P); if (!p) continue;
      const flap = Math.floor(t * 9 + hash(i, 5) * 2) & 1, gone = t > LEAVE[i];
      const col = p[2] > 14 ? PAL.white : gone ? PAL.grey : PAL.bone;
      if (p[2] > 9) { const g = BIRD[flap]; for (let y = 0; y < 4; y++) for (let x = 0; x < 7; x++) if (g[y][x] === 'X') buf.px(p[0] - 3 + x, p[1] - 2 + y, col); }
      else if (p[2] > 3) { buf.px(p[0], p[1], col); buf.px(p[0] - 1, p[1] - flap, col); buf.px(p[0] + 1, p[1] - flap, col); }
      else buf.px(p[0], p[1], col, clamp(p[2] / 2 + 0.3));
    }
  }

  // ---- 天空 + 近处的数据尘（速度线：尘点按镜头速度拖尾，镜头冲的时候线变长）----
  function sky(buf, t, c) {
    const hz = project(c, [c.pos[0] + c.f[0] * 1e4, c.pos[1], c.pos[2] + c.f[2] * 1e4]);
    const hy = hz ? hz[1] : -1e3;
    for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) {
      const d = (hy - y) * c.cs + (x - c.W / 2) * c.sn;          // 离地平线多高（考虑侧倾）
      const u = clamp(d / 140), col = u < 0.08 ? (bay(x, y) < 1 - u / 0.08 ? PAL.dusk : PAL.night) : (bay(x, y) < clamp(1 - (u - 0.08) / 0.5) ? PAL.night : PAL.ink);
      buf.px(x, y, col);
    }
    for (let i = 0; i < 140; i++) {                              // 远处的星（数字星：在无穷远，转镜头时横着划过）
      const dir = norm([Math.cos(hash(i, 21) * 6.283) * 2, 0.1 + hash(i, 22) * 1.2, Math.sin(hash(i, 21) * 6.283) * 0.4 + 1.2]);
      const p = project(c, c.pos.map((v, j) => v + dir[j] * 5e3)); if (p) buf.px(p[0], p[1], hash(i, 23) > 0.8 ? PAL.ice : PAL.grey, 0.5 + 0.5 * hash(i, Math.floor(t * 3)));
    }
  }
  function dust(buf, t, c) {
    const cs = 3, [cx, cy, cz] = c.pos.map(v => Math.floor(v / cs)), vlen = Math.hypot(...c.vel);
    for (let k = -1; k <= 4; k++) for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) {
      const X = cx + i, Y = cy + j, Z = cz + k; if (hash(X, Y, Z, 5) > 0.45) continue;
      const P = [(X + hash(X, Y, Z, 1)) * cs, (Y + hash(X, Y, Z, 2)) * cs, (Z + hash(X, Y, Z, 3)) * cs];
      if (P[1] < 0.2) continue;
      const q = toCam(c, P); if (q[2] < 0.6 || q[2] > 12) continue;
      const a = clamp(1 - q[2] / 12), col = hash(X, Y, Z, 4) > 0.85 ? PAL.pink : PAL.ice;
      if (vlen > 0.05) seg3(buf, c, P, P.map((v, n) => v - c.vel[n] * 2.5), col, a * 0.8);
      else { const p = scr(c, q); buf.px(p[0], p[1], col, a); }
    }
  }

  return {
    TW, kick, bass, smooth, BEATS, DOWN, LEAVE,
    draw(buf, t, c, st = {}) {
      if (st.sky !== false) sky(buf, t, c);
      mountains(buf, t, c, st); tower(buf, t, c, st); grid(buf, t, c, st); walls(buf, t, c, st); birds(buf, t, c, st); dust(buf, t, c);
    },
    sky, mountains, grid, walls, tower, birds, dust,
  };
}
