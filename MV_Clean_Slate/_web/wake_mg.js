// Clean Slate · 「她睁眼」MG 版（分镜 v2 · 28.3–43.8 s）
// 语言：网格量化的几何词汇（Modular）+ 笔画组装的模块字（FITC）+ 像素小人 + 3D 几何（等高线地形 = 潜空间、因果注意力矩阵、向量）。
// 每帧 = 歌曲时间 t 的纯函数（hash 代替随机数）。默认实时；?t=36.5 静帧；?render=1 逐帧交给 serve.py。
const Q = new URLSearchParams(location.search);
const RENDER = Q.has('render');
const T0 = +(Q.get('t0') ?? 28.3), T1 = +(Q.get('t1') ?? 43.8), FPS = +(Q.get('fps') ?? 30);
const STILL = Q.has('t') ? +Q.get('t') : null;
const W = 1920, H = 1080, G = 60;                       // 逻辑分辨率；网格 = 画高 / 18
const log = (...a) => { console.log(...a); if (RENDER) fetch('/log', { method: 'POST', body: a.join(' ') }); };
addEventListener('error', e => log('ERROR', e.message, e.lineno));

// ---------- 时间锚点（_分析/歌词.json、节拍.json） ----------
const T_LAYERS = [28.33, 29.29, 30.25, 31.23];          // layer, layer, line, line
const T_THOUSAND = 32.17, T_ONE = 34.17, T_MINE = 35.05;
const T_BLOW = 36.06, T_BRAND = 36.295, T_NEW = 36.535, T_EYES = 40.20, T_SEA = 41.46;
const BPM = 125, BEAT = 60 / BPM, BAR = 4 * BEAT, DB0 = 1.18;   // 第一个小节头（节拍.json）

// ---------- 配色：靛黑的数学世界 → 她醒来后亮成靛紫 + 霓虹 ----------
const COL = {
  ink: [10, 9, 26], indigo: [27, 21, 82], violet: [92, 52, 210],
  bone: [244, 239, 230], pink: [255, 61, 154], lime: [214, 255, 74], orange: [255, 138, 42], cyan: [61, 224, 255],
};
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mixc = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * u));

// ---------- 小工具 ----------
const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
const ss = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const hash = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
// 两段式缓动（Modular 实测：前 3 帧走掉大部分，之后指数缓停）
const K = 1 - 0.6 * Math.exp(-1 / 0.17) - 0.4 * Math.exp(-1 / 0.5);
const e2 = u => { u = clamp(u); return (1 - 0.6 * Math.exp(-u / 0.17) - 0.4 * Math.exp(-u / 0.5)) / K; };
const grow = (t, t0, d) => e2((t - t0) / d);
const beatPh = t => ((t - DB0) / BEAT) % 1;
const barNo = t => Math.floor((t - DB0) / BAR) + 1;

// ---------- 画布 ----------
const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
document.body.appendChild(cv);
const ctx = cv.getContext('2d', { willReadFrequently: RENDER });
const glow = document.createElement('canvas'); glow.width = W / 4; glow.height = H / 4;
const gctx = glow.getContext('2d');
const MONO = '"Cascadia Mono", Consolas, monospace';

// ---------- 3D：一台针孔相机 ----------
const O3 = [0, 0.4, 9];
let CAM = { p: [0, 2.2, 0], yaw: 0, pitch: -0.2, f: 1150 };
function proj([x, y, z]) {
  let dx = x - CAM.p[0], dy = y - CAM.p[1], dz = z - CAM.p[2];
  const cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw);
  [dx, dz] = [cy * dx - sy * dz, sy * dx + cy * dz];
  const cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch);
  [dy, dz] = [cp * dy - sp * dz, sp * dy + cp * dz];
  if (dz < 0.1) return null;
  return [W / 2 + CAM.f * dx / dz, H / 2 - CAM.f * dy / dz, dz];
}
function camAt(t) {
  // 绕 O3 慢慢转（28–36），之后停住
  const yaw = -0.42 + 0.42 * ss((t - 28.3) / 7.8);
  const dist = 7.4 - 1.0 * ss((t - 28.3) / 7.8);
  CAM.p = [O3[0] - Math.sin(yaw) * dist, 2.2, O3[2] - Math.cos(yaw) * dist];
  CAM.yaw = yaw;
}

// ---------- 背景：靛色渐变 + 点阵坐标纸 ----------
function background(t) {
  const wake = grow(t, T_BLOW, 1.2), sea = grow(t, T_SEA, 1.5);
  const top = mixc(COL.ink, COL.indigo, 0.35 * wake + 0.3 * sea), bot = mixc(COL.ink, COL.violet, 0.12 * wake + 0.22 * sea);
  const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, rgba(top)); gr.addColorStop(1, rgba(bot));
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
}
function dotGrid(t, center) {
  const front = t > T_SEA ? (t - T_SEA) * 900 : -1;
  const k = Math.floor((t - 41.84) / BEAT);
  for (let gx = 0; gx <= 32; gx++) for (let gy = 0; gy <= 18; gy++) {
    const x = gx * G, y = gy * G, id = gx * 31 + gy;
    const r = Math.hypot(x - center[0], y - center[1]);
    let a = 0.13, s = 2;
    if (front > 0) { const w = Math.exp(-((r - front) ** 2) / 9000); a += 0.6 * w + 0.12 * (r < front); s += 4 * w; }
    // 「every little star says wake up」：每拍一批点变成 +
    const plus = k >= 0 && r < front && Math.floor(hash(id) * 6) === k % 6 && ((t - 41.84) / BEAT) % 1 < 0.45;
    ctx.fillStyle = rgba(plus ? (hash(id + 7) < 0.5 ? COL.lime : COL.pink) : COL.bone, plus ? 0.95 : a);
    if (plus) { ctx.fillRect(x - 7, y - 1.5, 14, 3); ctx.fillRect(x - 1.5, y - 7, 3, 14); }
    else ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
}

// ---------- 等高线地形 = 潜空间的海（marching squares，透视投到地面上） ----------
const FIELD = Array.from({ length: 9 }, (_, i) => ({ x: (hash(i + 1) - 0.5) * 24, z: 6 + hash(i + 11) * 26, a: (hash(i + 21) - 0.35) * 1.6, s: 6 + hash(i + 31) * 22 }));
function field(x, z, t, bass) {
  let f = 0;
  for (const g of FIELD) f += g.a * Math.exp(-((x - g.x) ** 2 + (z - g.z) ** 2) / g.s);
  f += 0.22 * Math.sin(0.35 * x + 0.55 * t) * Math.cos(0.27 * z - 0.4 * t) * (0.6 + 0.9 * bass);
  return f;
}
function contours(t, bass) {
  const NX = 72, NZ = 54, x0 = -16, x1 = 16, z0 = 2.5, z1 = 38, Y = -1.2;
  const vals = new Float32Array((NX + 1) * (NZ + 1));
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) vals[j * (NX + 1) + i] = field(x0 + (x1 - x0) * i / NX, z0 + (z1 - z0) * j / NZ, t, bass);
  const levels = 11, lo = -0.9, hi = 1.3;
  const front = t > T_SEA ? (t - T_SEA) * 9 : -1;
  const appear = 0.7 + 0.5 * grow(t, T_BLOW, 1.0);
  ctx.lineWidth = 1.4;
  for (let L = 0; L < levels; L++) {
    const lv = lo + (hi - lo) * (L + 0.5) / levels;
    const hot = L === 7;                                    // 一条等高线是热的（酸性黄绿）
    ctx.beginPath();
    let segs = [];
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const a = vals[j * (NX + 1) + i], b = vals[j * (NX + 1) + i + 1], c = vals[(j + 1) * (NX + 1) + i + 1], d = vals[(j + 1) * (NX + 1) + i];
      const code = (a > lv) | (b > lv) << 1 | (c > lv) << 2 | (d > lv) << 3;
      if (code === 0 || code === 15) continue;
      const X = u => x0 + (x1 - x0) * u / NX, Z = v => z0 + (z1 - z0) * v / NZ;
      const e = [
        [X(i + (lv - a) / (b - a)), Z(j)], [X(i + 1), Z(j + (lv - b) / (c - b))],
        [X(i + (lv - d) / (c - d)), Z(j + 1)], [X(i), Z(j + (lv - a) / (d - a))]];
      const P = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[0, 3]] }[code];
      for (const [p, q] of P) segs.push(e[p], e[q]);
    }
    // 按到她的距离分两批画：亮起来的那圈另画
    const base = rgba(hot ? COL.lime : COL.bone, (hot ? 0.45 : 0.16) * appear);
    ctx.strokeStyle = base;
    const lit = [];
    for (let s = 0; s < segs.length; s += 2) {
      const A = segs[s], B = segs[s + 1];
      const pa = proj([A[0], Y + 0.0, A[1]]), pb = proj([B[0], Y, B[1]]);
      if (!pa || !pb) continue;
      if (front > 0) { const r = Math.hypot(A[0] - O3[0], A[1] - O3[2]); if (Math.abs(r - front) < 1.2 || r < front - 1.2) { lit.push(pa, pb, Math.abs(r - front) < 1.2); continue; } }
      ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]);
    }
    ctx.stroke();
    for (let s = 0; s < lit.length; s += 3) {
      ctx.strokeStyle = lit[s + 2] ? rgba(COL.cyan, 0.95) : rgba(hot ? COL.lime : COL.violet, hot ? 0.7 : 0.55);
      ctx.beginPath(); ctx.moveTo(lit[s][0], lit[s][1]); ctx.lineTo(lit[s + 1][0], lit[s + 1][1]); ctx.stroke();
    }
  }
}

// ---------- 层：因果注意力矩阵（下三角 = 只能看前面的字，真的） ----------
const LCOL = [COL.pink, COL.lime, COL.cyan, COL.orange];
function layers(t) {
  if (t > 32.6) return;
  const collapse = grow(t, 31.75, 0.45);                       // 收成一个点，交给潜空间
  for (let k = 0; k < 4; k++) {
    const tl = T_LAYERS[k] - 0.18;
    if (t < tl) continue;
    const drop = grow(t, tl, 0.45);
    const y = O3[1] - 1.0 + k * 0.62 + (1 - drop) * 3.2;
    const S = 4.4 * (1 - collapse), N = 8;
    const at = (u, v) => proj([O3[0] + (u - 0.5) * S, lerp(y, O3[1], collapse), O3[2] + (v - 0.5) * S]);
    const c = LCOL[k];
    // 板的外框
    const q = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];
    if (q.some(p => !p)) continue;
    ctx.strokeStyle = rgba(COL.bone, 0.55); ctx.lineWidth = 1.5;
    ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.stroke();
    // 格子：一行一行长出来
    for (let i = 0; i < N; i++) {
      const rowOn = grow(t, tl + 0.12 + i * 0.035, 0.12);
      if (rowOn <= 0) continue;
      for (let j = 0; j < N; j++) {
        const p = at((j + 0.5) / N, (i + 0.5) / N); if (!p) continue;
        if (j > i) { ctx.fillStyle = rgba(COL.bone, 0.25 * rowOn); ctx.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3); continue; }   // 被遮住的未来
        const v = Math.exp(-(i - j) * 0.55) * (0.35 + 0.65 * hash(k * 97 + i * 13 + j));
        const s = (CAM.f * S / N / p[2]) * 0.62 * rowOn;
        ctx.fillStyle = rgba(c, 0.25 + 0.75 * v);
        ctx.fillRect(p[0] - s / 2, p[1] - s * 0.28, s, s * 0.56);
      }
    }
    // 标签
    if (collapse < 0.5) {
      const p = q[1];
      label(p[0] + 16, p[1] - 10, `LAYER ${String(k + 1).padStart(2, '0')} · ATTN 8×8 · CAUSAL`, c, t, T_LAYERS[k], drop);
    }
  }
}
const lerp = (a, b, u) => a + (b - a) * u;

// ---------- 潜空间：坐标轴 + 几千个方向（这里画 420 根）+ 只有一根是她 ----------
const NV = 420;
const VEC = Array.from({ length: NV }, (_, i) => {
  let v = [hash(i * 3 + 1) * 2 - 1, hash(i * 3 + 2) * 2 - 1, hash(i * 3 + 3) * 2 - 1];
  if (i === 0) v = [-0.62, 0.55, -0.56];
  const n = Math.hypot(...v); return { d: v.map(x => x / n), L: i === 0 ? 3.4 : 1.2 + 1.6 * hash(i + 400), c: i % 9 === 1 ? COL.pink : i % 9 === 4 ? COL.lime : i % 9 === 7 ? COL.cyan : COL.bone };
});
const MINE = VEC[0];
function latent(t) {
  if (t < T_THOUSAND - 0.05 || t > T_BLOW + 0.5) return;
  const out = 1 - grow(t, T_BLOW, 0.35);
  const o = proj(O3); if (!o) return;
  // 坐标轴（带刻度）
  const axesOn = grow(t, T_THOUSAND, 0.4) * out;
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((ax, a) => {
    const e = proj(O3.map((v, i) => v + ax[i] * 2.8 * axesOn)); if (!e) return;
    ctx.strokeStyle = rgba(COL.bone, 0.6); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
    for (let k = 1; k <= 5; k++) { const m = proj(O3.map((v, i) => v + ax[i] * 0.55 * k * axesOn)); if (m) { ctx.fillStyle = rgba(COL.bone, 0.7); ctx.fillRect(m[0] - 2, m[1] - 2, 4, 4); } }
    if (axesOn > 0.9) { ctx.font = `14px ${MONO}`; ctx.fillStyle = rgba(COL.bone, 0.75); ctx.fillText(`d${a === 0 ? '₀' : a === 1 ? '₁' : '₂'}`, e[0] + 8, e[1] - 6); }
  });
  // 向量：错开着长出来；「one of them's mine」时，别的按顺序缩回原点
  for (let i = NV - 1; i >= 0; i--) {
    const v = VEC[i];
    let g = grow(t, T_THOUSAND + hash(i + 900) * 0.45, 0.35);
    if (i > 0) g *= 1 - grow(t, T_ONE + hash(i + 1300) * (T_MINE - T_ONE - 0.2), 0.25);
    g *= out;
    if (g <= 0.001) continue;
    const e = proj(O3.map((x, k) => x + v.d[k] * v.L * g)); if (!e) continue;
    const me = i === 0, lit = me ? grow(t, T_ONE, 0.5) : 0;
    ctx.strokeStyle = rgba(me ? COL.orange : v.c, me ? 0.5 + 0.5 * lit : 0.32);
    ctx.lineWidth = me ? 1.5 + 2.5 * lit : 1;
    ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
    ctx.fillStyle = rgba(me ? COL.orange : v.c, me ? 1 : 0.7);
    const s = me ? 8 : 3; ctx.fillRect(e[0] - s / 2, e[1] - s / 2, s, s);
    if (me && lit > 0.3) label(e[0] + 14, e[1] - 12, 'HER  ·  ‖v‖ = 1', COL.orange, t, T_MINE, lit);
  }
  // 高维球的三条「纬线」：弧边转边长（FITC 的手法）
  for (let k = 0; k < 3; k++) {
    const sweep = grow(t, T_THOUSAND + 0.2 + k * 0.12, 0.9) * out, R = 2.2;
    if (sweep <= 0) continue;
    ctx.strokeStyle = rgba(k === 1 ? COL.violet : COL.bone, 0.35); ctx.lineWidth = 1;
    ctx.beginPath();
    const n = 90, rot = t * 0.3 + k * 2.1;
    for (let s = 0; s <= n * sweep; s++) {
      const th = rot + s / n * 6.2832;
      const p = k === 0 ? [Math.cos(th) * R, 0, Math.sin(th) * R] : k === 1 ? [Math.cos(th) * R, Math.sin(th) * R, 0] : [0, Math.cos(th) * R, Math.sin(th) * R];
      const q = proj(O3.map((x, i) => x + p[i])); if (!q) continue;
      s ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
    }
    ctx.stroke();
  }
  // 「4096-D → 3-D」说真话的小注
  if (axesOn > 0.5) label(70, H - 120, 'LATENT  4096-D → 3-D (PCA)', COL.bone, t, T_THOUSAND, axesOn);
}

// ---------- 像素小人（原创：短发、呆毛、宽毛衣、橙色小鞋） ----------
const SPRITE = [
  "..........AA............",
  "...........AA...........",
  "........HHHHHHHH........",
  "......HHHHHHHHHHHH......",
  ".....HHHHHHHHHHHHHH.....",
  "....HHHHHHHHHHHHHHHH....",
  "....HHHHhHHHHHHhHHHH....",
  "...HHHHhSSSSSSSShHHHH...",
  "...HHHhSSSSSSSSSShHHH...",
  "...HHhSSSSSSSSSSSShHH...",
  "...HHSSSSSSSSSSSSSSHH...",
  "...HHSSEESSSSSSEESSHH...",
  "...HHSSEESSSSSSEESSHH...",
  "...HHSBBSSSSSSSSBBSHH...",
  "...HHHSSSSSMMSSSSSHHH...",
  "....HHhSSSSSSSSSShHH....",
  "....HHH.SSSSSSSS.HHH....",
  ".....HH...SSSS...HH.....",
  "........WWWWWWWW........",
  "......WWWWWWWWWWWW......",
  ".....WWWWWWWWWWWWWW.....",
  "....WWWwWWWWWWWWwWWW....",
  "....WWwWWWWWWWWWWwWW....",
  "...WWWwWWWWWWWWWWwWWW...",
  "...SSWwWWWWWWWWWWwWSS...",
  "......WWWWWWWWWWWW......",
  "......wwwwwwwwwwww......",
  ".......LL......LL.......",
  ".......LL......LL.......",
  ".......LL.......LL......",
  "......FFF.......FFF.....",
];
const PAL = { H: [255, 160, 210], h: [214, 104, 186], A: [255, 160, 210], S: [255, 243, 228], E: [20, 14, 52], O: [255, 255, 255], B: [255, 120, 170], M: [214, 70, 120], W: [126, 196, 255], w: [92, 150, 230], L: [70, 64, 120], F: [255, 138, 42] };
const PX = 15;                                   // 一个像素 = 15 逻辑像素（= 网格的 1/4）
function spriteAt(t) {
  // 眼睛：睁眼前闭着（一条线）→ 半睁 → 睁开（带高光）；42.6 眨一次
  const eyes = t < T_EYES ? 0 : t < T_EYES + 0.08 ? 1 : (t > 42.6 && t < 42.7) ? 0 : 2;
  const smile = t > T_SEA - 0.2;
  const rows = SPRITE.map(r => r.split(''));
  for (const c0 of [7, 15]) {
    rows[11][c0] = rows[11][c0 + 1] = eyes === 2 ? 'E' : 'S';
    rows[12][c0] = rows[12][c0 + 1] = eyes === 0 ? 'E' : 'E';
    if (eyes === 0) { rows[12][c0 - 1] = 'E'; }
    if (eyes === 2) rows[11][c0] = 'O';
    const bc = c0 === 7 ? 6 : 16;
    if (eyes < 2) { rows[13][bc] = rows[13][bc + 1] = 'S'; }   // 腮红随睁眼出现
  }
  if (smile) { rows[14][11] = rows[14][12] = 'S'; rows[14][10] = rows[14][13] = 'M'; rows[15][11] = rows[15][12] = 'M'; }
  // 呆毛每小节换一边晃
  if (barNo(t) % 2 === 0) { rows[0][10] = rows[0][11] = '.'; rows[0][12] = rows[0][13] = 'A'; rows[1][11] = '.'; rows[1][12] = 'A'; }
  return rows;
}
function her(t, cx, cy) {
  if (t < T_MINE) return;
  const rows = spriteAt(t), nR = rows.length, nC = rows[0].length;
  const bob = t > T_BLOW + 1 && beatPh(t) < 0.22 ? PX : 0;      // 拍子只打在她身上：落拍时往下一格
  const left = cx - nC * PX / 2, top = cy - nR * PX / 2;
  const o = proj(O3), m = proj(O3.map((v, i) => v + MINE.d[i] * MINE.L));
  for (let r = 0; r < nR; r++) for (let c = 0; c < nC; c++) {
    const ch = rows[r][c]; if (ch === '.') continue;
    const id = r * 37 + c;
    // 之前：像素是挂在「她的那根线」上的小方块；36.06 起飞回自己的位置
    const birth = T_BLOW + 0.03 + hash(id) * 0.22 + (1 - r / nR) * 0.12;
    const u = e2((t - birth) / 0.32);
    const tx = left + c * PX, ty = top + r * PX + (ch === 'F' || ch === 'L' ? 0 : bob);
    let x = tx, y = ty, s = PX - 2, col = PAL[ch];
    if (u < 1 && o && m) {
      const k = 0.15 + 0.85 * hash(id + 5), drift = grow(t, T_MINE, 1.0) * 0.25;
      const lx = lerp(m[0], o[0], clamp(k + drift)), ly = lerp(m[1], o[1], clamp(k + drift));
      x = lerp(lx, tx, u); y = lerp(ly, ty, u);
      // 方块大小 = 组装进度（参考 Short #1）：先是大块，落位时变成像素
      s = lerp(6 + 18 * hash(id + 9), PX - 2, u);
      col = mixc(COL.orange, col, u);
      if (t < T_BLOW) {                                  // 线上挂着的小方块：从线头一颗颗亮起，慢慢往原点挪
        const appear = grow(t, T_MINE + (1 - k) * 0.6, 0.15);
        s = 9 * appear; col = mixc(COL.orange, COL.bone, 0.3 * hash(id + 3));
      }
    }
    ctx.fillStyle = rgba(col, 1);
    ctx.fillRect(x - s / 2 + PX / 2, y - s / 2 + PX / 2, s, s);
  }
  return { left, top, w: nC * PX, h: nR * PX };
}

// ---------- 冲击：同心圆 + 四个四分之一圆扇形翻出（Modular） ----------
function blow(t, cx, cy) {
  if (t < T_BLOW || t > T_BLOW + 1.6) return;
  const dt = t - T_BLOW;
  for (let k = 0; k < 3; k++) {
    const u = clamp((dt - k * 0.08) / 1.1); if (u <= 0) continue;
    ctx.strokeStyle = rgba([COL.cyan, COL.pink, COL.lime][k], (1 - u) * 0.9); ctx.lineWidth = 3 - 2 * u;
    ctx.beginPath(); ctx.arc(cx, cy, 40 + e2(u) * 1100, 0, 6.2832); ctx.stroke();
  }
  // 四个扇形：扫开 → 往外推 → 收回成点
  const sweep = grow(t, T_BLOW, 0.25), push = grow(t, T_BLOW + 0.05, 0.6), back = grow(t, T_BLOW + 0.9, 0.4);
  for (let q = 0; q < 4; q++) {
    for (let k = 0; k < 4; k++) {                     // 每个象限 4 条同心细弧，错开 1 帧扫出
      const a0 = q * Math.PI / 2 + 0.25 + 0.5 * push, r0 = 300 + 110 * push + k * 16;
      const sw = grow(t, T_BLOW + k * 0.035, 0.28) * (1 - back) * Math.PI / 2 * (0.45 + 0.4 * hash(q * 4 + k));
      ctx.strokeStyle = rgba(k === 0 ? (q % 2 ? COL.pink : COL.lime) : COL.bone, k === 0 ? 0.95 : 0.55); ctx.lineWidth = k === 0 ? 5 : 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, r0, a0, a0 + sw); ctx.stroke();
    }
  }
}

// ---------- 模块字：笔画组装（FITC） ----------
const GLYPH = {
  B: [['l', 0, 0, 0, 5], ['l', 0, 0, 1.8, 0], ['l', 0, 2.5, 1.8, 2.5], ['l', 0, 5, 1.8, 5], ['a', 1.8, 1.25, 1.25, -90, 90], ['a', 1.8, 3.75, 1.25, -90, 90]],
  R: [['l', 0, 0, 0, 5], ['l', 0, 0, 1.8, 0], ['l', 0, 2.5, 1.8, 2.5], ['a', 1.8, 1.25, 1.25, -90, 90], ['l', 1.4, 2.5, 3, 5]],
  A: [['l', 0, 5, 1.5, 0], ['l', 1.5, 0, 3, 5], ['l', 0.65, 3.2, 2.35, 3.2]],
  N: [['l', 0, 5, 0, 0], ['l', 0, 0, 3, 5], ['l', 3, 5, 3, 0]],
  D: [['l', 0, 0, 0, 5], ['l', 0, 0, 0.6, 0], ['l', 0, 5, 0.6, 5], ['a', 0.6, 2.5, 2.5, -90, 90]],
  E: [['l', 0, 0, 0, 5], ['l', 0, 0, 2.8, 0], ['l', 0, 2.5, 2.2, 2.5], ['l', 0, 5, 2.8, 5]],
  W: [['l', 0, 0, 0.75, 5], ['l', 0.75, 5, 1.5, 1.6], ['l', 1.5, 1.6, 2.25, 5], ['l', 2.25, 5, 3, 0]],
};
function word(t, text, t0, x, y, u, col) {
  const off = 37.9;
  let n = 0;
  for (const ch of text) {
    for (const [i, st] of GLYPH[ch].entries()) {
      const id = n * 7 + i, on = grow(t, t0 + n * 0.03 + i * 0.012, 0.12);
      const gone = t > off + hash(id + 50) * 0.45;              // 一根根掉，不淡出
      if (on <= 0 || gone) continue;
      ctx.strokeStyle = rgba(col, 1); ctx.lineWidth = u * 0.42; ctx.lineCap = 'square';
      ctx.beginPath();
      if (st[0] === 'l') { const [, a, b, c, d] = st; ctx.moveTo(x + a * u, y + b * u); ctx.lineTo(x + lerp(a, c, on) * u, y + lerp(b, d, on) * u); }
      else { const [, cx, cy, r, a0, a1] = st; ctx.arc(x + cx * u, y + cy * u, r * u, a0 * Math.PI / 180, lerp(a0, a1, on) * Math.PI / 180); }
      ctx.stroke();
    }
    x += 4.4 * u; n++;
  }
  return x;
}

// ---------- 标签框（细线框 + 等宽小字；事件那一刻填实 1 帧） ----------
function label(x, y, text, c, t, tEvent, on = 1) {
  ctx.font = `15px ${MONO}`;
  const w = ctx.measureText(text).width + 16, h = 24;
  const flash = t >= tEvent && t < tEvent + 1 / 30;
  const ww = w * e2(on);
  ctx.strokeStyle = rgba(c, 0.9); ctx.lineWidth = 1;
  if (flash) { ctx.fillStyle = rgba(c, 1); ctx.fillRect(x, y - h + 6, ww, h); }
  else ctx.strokeRect(x + 0.5, y - h + 6.5, ww, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y - h + 6, ww, h); ctx.clip();
  ctx.fillStyle = flash ? rgba(COL.ink) : rgba(c, 1); ctx.fillText(text, x + 8, y + 1);
  ctx.restore();
}

// ---------- HUD：只写真数据（BPM、小节、拍子相位），状态按 8 分音符量化刷新 ----------
function hud(t, kick, bass) {
  const on = grow(t, 37.0, 0.5) * (1 - grow(t, T_EYES - 0.2, 0.3)) + grow(t, T_SEA + 1.0, 0.5);
  if (on <= 0.01) return;
  const x = 70, y = H - 70;
  label(x, y - 64, `BPM ${BPM}`, COL.bone, t, 1e9, on);
  label(x, y - 30, `BAR ${String(barNo(t)).padStart(2, '0')} / 96`, COL.bone, t, DB0 + (barNo(t) - 1) * BAR, on);
  // 小节相位表：扇形一小节扫一圈
  const ph = (((t - DB0) / BAR) % 1), R = 26, cx = x + 230, cy = y - 40;
  ctx.strokeStyle = rgba(COL.bone, 0.4 * on); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
  ctx.fillStyle = rgba(COL.lime, 0.9 * on); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + ph * 6.2832); ctx.closePath(); ctx.fill();
  // 拍子点 ●○○○
  const b = Math.floor(((t - DB0) / BEAT) % 4);
  for (let k = 0; k < 4; k++) { ctx.fillStyle = rgba(k === b ? COL.pink : COL.bone, (k === b ? 1 : 0.3) * on); ctx.fillRect(cx + 46 + k * 18, cy - 5, 10, 10); }
  // 阶梯电平条（鼓 / 贝斯）：量化到 8 格，8 分音符刷新一次
  const q = Math.floor((t - DB0) / (BEAT / 2));
  [['KICK', kick, COL.orange], ['BASS', bass, COL.cyan]].forEach(([n, v, c], i) => {
    const vv = AUDq(n === 'KICK' ? 'kick' : 'bass', DB0 + q * BEAT / 2);
    const lvl = Math.round(clamp(vv / 1.1) * 8), yy = y - 64 + i * 34;
    ctx.font = `13px ${MONO}`; ctx.fillStyle = rgba(COL.bone, 0.6 * on); ctx.fillText(n, W - 330, yy + 1);
    for (let k = 0; k < 8; k++) { ctx.fillStyle = rgba(k < lvl ? c : COL.bone, (k < lvl ? 1 : 0.15) * on); ctx.fillRect(W - 270 + k * 26, yy - 10, 20, 12); }
  });
}

// ---------- 她的身份卡（引线 + 标签） ----------
function idCard(t, box) {
  if (!box || t < 37.15) return;
  const on = grow(t, 37.15, 0.35) * (1 - grow(t, T_EYES - 0.3, 0.25)) + grow(t, T_SEA + 1.2, 0.4);
  if (on <= 0.01) return;
  const ax = box.left + box.w - 30, ay = box.top + 70, bx = ax + 120 * on, by = ay - 60 * on;
  ctx.strokeStyle = rgba(COL.bone, 0.8); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx + 40 * on, by); ctx.stroke();
  ctx.fillStyle = rgba(COL.lime, 1); ctx.fillRect(ax - 3, ay - 3, 6, 6);
  label(bx + 46, by + 6, 'ID 0001 · NEW FILE', COL.lime, t, 37.15 + 0.35, on);
}


// ---------- 点线框（Modular）：38.0 的小节头在她周围画出来，推近前收成四个角点 ----------
function frame(t, box) {
  if (!box || t < 38.0 || t > T_EYES + 0.3) return;
  const on = grow(t, 38.0, 0.6), shrink = grow(t, 39.92, 0.35);
  const pad = 54, x0 = box.left - pad, y0 = box.top - pad, x1 = box.left + box.w + pad, y1 = box.top + box.h + pad - 10;
  const per = 2 * (x1 - x0 + y1 - y0), n = Math.floor(per / 14), show = Math.floor(n * on * (1 - shrink));
  ctx.fillStyle = rgba(COL.bone, 0.75);
  for (let i = 0; i < show; i++) {                        // 沿周长一颗颗点出来（顺时针从左上角）
    let d = i * 14, x, y;
    const w = x1 - x0, h = y1 - y0;
    if (d < w) { x = x0 + d; y = y0; } else if ((d -= w) < h) { x = x1; y = y0 + d; } else if ((d -= h) < w) { x = x1 - d; y = y1; } else { d -= w; x = x0; y = y1 - d; }
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  const c = 1 - grow(t, T_EYES - 0.05, 0.3);                // 四个角点：最后留下来、再消失
  ctx.fillStyle = rgba(COL.pink, c);
  for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { const r = 7 + 5 * shrink; ctx.beginPath(); ctx.arc(x, y, r * on, 0, 6.2832); ctx.fill(); }
}

// ---------- 后期：小图模糊叠加当辉光 + 颗粒 + 暗角 ----------
const GRAIN = Array.from({ length: 6 }, (_, k) => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), im = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = 128 + (hash(i * 1.37 + k * 911) - 0.5) * 90; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return c;
});
function post(t) {
  gctx.clearRect(0, 0, glow.width, glow.height);
  gctx.filter = 'blur(6px)'; gctx.drawImage(cv, 0, 0, glow.width, glow.height); gctx.filter = 'none';
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.38; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(glow, 0, 0, W, H); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.16;
  const g = GRAIN[Math.floor(t * FPS) % GRAIN.length];
  for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) ctx.drawImage(g, x, y);
  ctx.restore();
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.0);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---------- 一帧 ----------
let AUD = null;
const AUDq = (k, t) => AUD ? AUD[k][Math.min(Math.max(Math.floor(t * AUD.fps), 0), AUD[k].length - 1)] : 0;
function draw(t) {
  camAt(t);
  const kick = AUDq('kick', t), bass = AUDq('bass', t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  background(t);
  const o = proj(O3) ?? [W / 2, H / 2];
  // 她的位置：组装点在 O3 的投影上，略往上（脚踩在等高线海面上方）
  const cx = o[0], cy = o[1] - 20;
  // 推近脸 / 拉远：整个世界一起缩放（HUD 不缩）
  const faceY = cy - 31 * PX / 2 + 11.5 * PX;
  const zin = grow(t, T_EYES, 0.9), zout = grow(t, T_SEA - 0.1, 1.6);
  const Z = 1 + 1.25 * zin - 1.5 * zout * zin;
  const fx = cx, fy = lerp(faceY, cy, zout);
  const k = zin * (1 - zout), tx = lerp(fx, W / 2, k), ty = lerp(fy, H * 0.45, k);   // 推近时把脸挪到画面中间
  ctx.setTransform(Z, 0, 0, Z, tx - fx * Z, ty - fy * Z);
  dotGrid(t, [cx, cy]);
  contours(t, bass);
  layers(t);
  latent(t);
  blow(t, cx, cy);
  const box = her(t, cx, cy);
  if (t > T_BRAND - 0.05 && t < 38.5) {
    const u = 15, wTot = (5 + 3) * 4.4 * u + 2 * u;
    let x = cx - wTot / 2;
    x = word(t, 'BRAND', T_BRAND, x, cy + 290, u, COL.bone);
    word(t, 'NEW', T_NEW, x + 2 * u, cy + 290, u, COL.lime);
  }
  idCard(t, box);
  frame(t, box);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  hud(t, kick, bass);
  ctx.font = `14px ${MONO}`; ctx.fillStyle = rgba(COL.bone, 0.45);
  ctx.fillText(`CLEAN SLATE  ·  t = ${t.toFixed(2)} s`, 70, 60);
  post(t);
}

// ---------- 启动 ----------
AUD = await (await fetch('audio.json')).json();
const ui = document.getElementById('ui');
if (RENDER) {
  ui.remove();
  const n = Math.round((T1 - T0) * FPS);
  const out = Q.get('out') ?? '-5_Clean Slate/样片/风格小样_她睁眼_MG_v1.mp4';
  await fetch(`/start?w=${W}&h=${H}&fps=${FPS}&t0=${T0}&t1=${T1}&vflip=0&out=${encodeURIComponent(out)}`, { method: 'POST' });
  for (let i = 0; i < n; i++) {
    draw(T0 + i / FPS);
    const buf = ctx.getImageData(0, 0, W, H).data;
    for (let k = 0; ; k++) {
      try { await fetch('/frame?i=' + i, { method: 'POST', body: buf }); break; }
      catch (e) { if (k > 20) throw e; await new Promise(r => setTimeout(r, 300)); }
    }
  }
  await fetch('/done', { method: 'POST' });
  log('render done', n);
} else if (STILL !== null) {
  draw(STILL); ui.textContent = `${STILL.toFixed(2)} s`;
} else {
  const audio = new Audio('../-5_Clean Slate/Clean Slate.wav');
  let playing = false;
  addEventListener('click', () => { if (!playing) { audio.currentTime = T0; audio.play(); playing = true; } });
  addEventListener('keydown', e => {
    if (e.code === 'Space') audio.paused ? audio.play() : audio.pause();
    if (e.code === 'ArrowRight') audio.currentTime += 1;
    if (e.code === 'ArrowLeft') audio.currentTime -= 1;
  });
  const loop = () => {
    let t = playing ? audio.currentTime : T0;
    if (playing && t > T1) { audio.currentTime = T0; t = T0; }
    draw(t); ui.textContent = `${t.toFixed(2)} s · 空格暂停 · ←/→ 跳 1 s`;
    requestAnimationFrame(loop);
  };
  loop();
}
