// Clean Slate · 「她睁眼」animator1（28.3–43.8 s）—— 学 pdoom-video 的手法（只学手法，图形 / 文字自己的）：
// ① 每帧 = 歌曲时间 t 的纯函数；导出时一帧 = 快门内 SAMPLES 个子帧的平均 → 真运动模糊（pdoom 的 sub-frame 采样）。
//    抖动 / 颗粒这类「每帧变一次」的东西用 frameIdx(t)，不用连续 t，否则子帧之间会糊成灰。
// ② 词按内容查，不写死时间；逐词卡拉 OK：提前 0.4 s 暗显，唱到哪亮到哪，绝不抢跑。
// ③ 字是画面的一部分，每个镜头换一种「字长在哪」：贴在网层上 / 挂在方向线上 / 立在海平线上 / 长在星星旁。
// ④ 一根贯穿全段的母题：她的光点（青）。穿网 → 千条方向里选中一条 → 顺着线冲过来 → 聚成她 → 睁眼。
// 第二版（她换成 girl_px.js 的像素她 + 站台分层）另借了 _参考_Short 的三招：方块大小 = 溶解进度；状态按 16 分音符量化刷新；黑帧当休止符。
// ⑤ 颜色克制：青 = 她的线，品红 = 正在唱的词，酸性黄绿只属于「mine」那一刻，橙只属于睁眼那一下。
// ⑥ 硬切落在词头 / 强拍；动作「停住 → 猛冲」（outExpo），不做飘的屏保运动；拉长的音用字宽轴拉长（WIDE 真的变宽）。
import { loadPx, layer, girl, PX } from '../girl_px.js';   // 第二版：主会话的像素她 + 站台分层（不改它）

const Q = new URLSearchParams(location.search);
const RENDER = Q.has('render');
const T0 = +(Q.get('t0') ?? 28.3), T1 = +(Q.get('t1') ?? 43.8), FPS = +(Q.get('fps') ?? 30);
const SAMPLES = +(Q.get('samples') ?? (RENDER ? 8 : 1)), SHUTTER = +(Q.get('shutter') ?? 0.5);
const STILL = Q.has('t') ? +Q.get('t') : null;
const SHEET = Q.get('sheet');
const W = 1920, H = 1080;
const log = (...a) => { console.log(...a); if (RENDER) fetch('/log', { method: 'POST', body: a.join(' ') }); };
addEventListener('error', e => log('ERROR', e.message, e.lineno));

// ---------- 画布：cv 显示 / 累加，fc 画子帧 ----------
const cv = document.createElement('canvas'); cv.width = W; cv.height = H; document.body.appendChild(cv);
const out = cv.getContext('2d', { willReadFrequently: RENDER });
const fc = document.createElement('canvas'); fc.width = W; fc.height = H;
const ctx = fc.getContext('2d');
const glow = document.createElement('canvas'); glow.width = W / 4; glow.height = H / 4;
const gctx = glow.getContext('2d');

// ---------- 数据（按内容查词） ----------
const WORDS = (await (await fetch('../words.json')).json()).map(([w, s, e]) => ({ w: w.replace(/'/g, '’'), s, e, k: w.toLowerCase().replace(/[^a-z']/g, '') }));
const AUD = await (await fetch('../audio.json')).json();
const BEATS = AUD.beats;
const word = (k, after) => { const w = WORDS.find(x => x.k === k && x.s >= after); if (!w) throw new Error('word? ' + k); return w; };
const wp = (w, t) => clamp((t - w.s) / Math.max(0.05, w.e - w.s));
const span = (a, b) => WORDS.filter(x => x.s >= a && x.s < b);

const LAYER1 = word('layer', 28), BY1 = word('by', 28.9), LAYER2 = word('layer', 29.2), LINE1 = word('line', 30), BY2 = word('by', 30.6), LINE2 = word('line', 31.1);
const THOUSAND = word('thousand', 32), DIRS = word('directions', 32.5), ONE = word('one', 34), OF = word('of', 34.3), THEMS = word("them's", 34.5), MINE = word('mine', 35);
const BRAND = word('brand', 36), NEW = word('new', 36.4), GIRL = word('girl', 36.9);
const EDGE_PHRASE = span(37.6, 39.95), EDGE = word('edge', 37.6), WAIT = word('wait', 39.5);
const EYES = word('eyes', 40), WIDE = word('wide', 40.3), OPEN = word('open', 40.9);
const SEA_PHRASE = span(41.4, 42.5), STAR_PHRASE = span(42.5, 43.5), WAKE = word('wake', 43.4);

// 镜头：硬切落在词头（≈ 强拍）
const CUT_B = THOUSAND.s - 0.01, CUT_C = 36.06, CUT_D = 39.92, CUT_E = SEA_PHRASE[0].s - 0.1;
const CUTS = [CUT_B, CUT_C, CUT_D, CUT_E];

// ---------- 颜色 ----------
const C = {
  ink: [12, 9, 30], night: [20, 15, 52], indigo: [30, 22, 92], violet: [86, 56, 190], lav: [176, 160, 236],
  bone: [246, 242, 252], white: [255, 255, 255], pink: [255, 61, 154], cyan: [61, 224, 255], lime: [214, 255, 74], orange: [255, 138, 42],
};
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mixc = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * clamp(u)));

// ---------- 工具（照 pdoom util.ts 的思路：全是 t 的纯函数） ----------
function clamp(x, a = 0, b = 1) { return x < a ? a : x > b ? b : x; }
const lerp = (a, b, u) => a + (b - a) * u;
const hash = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const outExpo = u => (u = clamp(u)) >= 1 ? 1 : 1 - Math.pow(2, -10 * u);
const inExpo = u => (u = clamp(u)) <= 0 ? 0 : Math.pow(2, 10 * u - 10);
const inOutCubic = u => (u = clamp(u)) < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const outBack = (u, s = 1.7) => { u = clamp(u) - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
const pulse = (t, t0, hl) => t < t0 ? 0 : Math.pow(0.5, (t - t0) / hl);
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i) * 2 - 1, hash(i + 1) * 2 - 1, u); }
const frameIdx = t => Math.round((t - T0) * FPS);          // 快门内不变：抖动 / 颗粒用它
const beatIdx = t => { let i = -1; for (let k = 0; k < BEATS.length; k++) if (BEATS[k] <= t) i = k; return i; };
const lastBeat = t => BEATS[Math.max(0, beatIdx(t))];

// ---------- 字 ----------
const STRETCH = ['ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed', 'normal', 'semi-expanded', 'expanded'];
// wd = 字宽 62..125：取最近一档 font-stretch，剩下的差用横向缩放补，动画才是连续的
function font(c, size, wght = 900, wd = 100) {
  const i = clamp(Math.round((wd - 50) / 12.5), 1, 6);
  c.fontStretch = STRETCH[i];
  c.font = `${Math.round(wght)} ${size}px A1Archivo`;
  return wd / (50 + i * 12.5);
}
const mono = (s, x, y, size, col, a = 1, align = 'left', wght = 400) => {
  ctx.fontStretch = 'normal'; ctx.font = `${wght} ${size}px A1Mono, Consolas, monospace`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = rgba(col, a); ctx.fillText(s, x, y);
};
function textW(s, size, wght, wd) { const sx = font(ctx, size, wght, wd); return ctx.measureText(s).width * sx; }
// 卡拉 OK 一个词：提前 pre 秒暗显 → 唱到哪亮到哪（左→右擦亮，品红）→ 唱完冷却成 cool
function kword(w, t, x, y, size, o = {}) {
  const { wght = 900, wd = 100, align = 'left', cool = C.bone, pre = 0.4, dim = 0.28, dimCol = C.bone, text = w.w, sung = C.pink, upper = false } = o;
  if (t < w.s - pre) return 0;
  const s = upper ? text.toUpperCase() : text;
  const sx = font(ctx, size, wght, wd);
  const tw = ctx.measureText(s).width * sx;
  const x0 = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  ctx.save(); ctx.translate(x0, y); ctx.scale(sx, 1); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const p = wp(w, t);
  if (p < 1) { ctx.fillStyle = rgba(dimCol, dim * smooth(w.s - pre, w.s, t)); ctx.fillText(s, 0, 0); }
  if (p > 0) {
    ctx.beginPath(); ctx.rect(-size, -size * 1.5, (tw / sx) * p + size * (p >= 1 ? 2 : 1), size * 3); ctx.clip();
    const col = t < w.e ? sung : mixc(sung, cool, (t - w.e) / 0.35);
    ctx.fillStyle = rgba(col); ctx.fillText(s, 0, 0);
  }
  ctx.restore();
  return tw;
}

// ---------- 她（第二版：主会话的 girl_px.js —— Seedream 分层像素化的她 + 站台；不改它，只在外面包一层） ----------
await loadPx();
const GL = PX.layers.girl;
// 把整张站台图（176×222 格）放到屏幕上：第 (fx, fy) 格对准屏幕 (sx, sy)，每格 s 像素
const stage = (s, fx, fy, sx, sy) => ({ s, ox: sx - fx * s, oy: sy - fy * s });
const at = (st, key, depth = 1, cam = [0, 0]) => { const L = PX.layers[key]; return [st.ox + L.x * st.s + cam[0] * depth, st.oy + L.y * st.s + cam[1] * depth]; };
const cell = (st, gx, gy) => [st.ox + gx * st.s, st.oy + gy * st.s];          // 全图坐标的一格 → 屏幕
const EYE_C = GL.eyes.map(([x0, y0, x1, y1]) => [GL.x + (x0 + x1) / 2, GL.y + (y0 + y1) / 2]);   // 两只眼的中心（全图格）
const CHEST = [GL.x + 62, GL.y + 128];
// 聚成人形用：闭眼那张的每个不透明格
const PIX = (() => {
  const c = document.createElement('canvas'); c.width = GL.w; c.height = GL.h; const g = c.getContext('2d');
  girl(g, 0, 0, 1, { eyes: 'closed', glow: 0 });
  const d = g.getImageData(0, 0, GL.w, GL.h).data, a = [];
  for (let y = 0; y < GL.h; y++) for (let x = 0; x < GL.w; x++) { const i = (y * GL.w + x) * 4; if (d[i + 3] > 40) a.push([x, y, `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`, hash(a.length * 3.7 + 1)]); }
  return a;
})();
// 站台各层（远 → 近）。show(key) = 这一层出现了多少；strip(k) = 第 k 条星空切片的 [横移, 亮度]
const ORDER = ['bg', 'frame', 'screen', 'mini', 'rail', 'girl', 'strip1', 'strip2', 'strip3', 'strip4', 'strip5'];
function world(t, st, o = {}) {
  const { cam = [0, 0], show = () => 1, lit = 1, strip = () => [0, 1, 0], face = {}, bob = 0, drawGirl = true } = o;
  const put = (key, depth, a = 1, dx = 0, dy = 0) => { a *= show(key); if (a <= 0.01) return; const [x, y] = at(st, key, depth, cam); layer(ctx, key, x + dx, y + dy, st.s, { alpha: clamp(a) }); };
  put('bg', 0.3); put('frame', 0.5); put('screen', 0.5, lit);
  if (lit > 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; put('screen', 0.5, lit - 1); ctx.restore(); }
  put('mini', 0.5, frameIdx(t) % 9 ? 1 : 0.2); put('rail', 0.8);
  if (drawGirl && show('girl') > 0) { const [x, y] = at(st, 'girl', 1, cam); girl(ctx, x, y + bob, st.s, { alpha: show('girl'), ...face }); }
  for (let k = 1; k <= 5; k++) {
    const [dx, a, hot] = strip(k); put('strip' + k, 1, a, dx, bob);
    if (hot > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; put('strip' + k, 1, hot, dx, bob); ctx.restore(); }
  }
}
// 图的左右边缘融进墨色（图是竖的，16:9 两边留给字）
function sideFade(st, w = 140) {
  const L = st.ox, R = st.ox + PX.size[0] * st.s;
  ctx.fillStyle = rgba(C.ink); ctx.fillRect(0, 0, Math.max(0, L), H); ctx.fillRect(R, 0, Math.max(0, W - R), H);
  for (const [x0, x1] of [[L + w, L], [R - w, R]]) { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, rgba(C.ink, 0)); g.addColorStop(1, rgba(C.ink)); ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), 0, w, H); }
}
// 拍上跳半格（像素的「呼吸」，整格对齐才不糊）
const hop = (t, s) => (pulse(t, lastBeat(t), 0.12) > 0.5 ? -Math.round(s * 0.5) : 0);

// ---------- 背景 ----------
function bg(top = C.ink, bot = C.night) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgba(top)); g.addColorStop(1, rgba(bot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
// 光点：亮核 + 一圈晕
function spark(x, y, r, col = C.cyan, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 6); g.addColorStop(0, rgba(C.white, a)); g.addColorStop(0.18, rgba(col, 0.8 * a)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 6, 0, 6.2832); ctx.fill();
}

// =====================================================================
// A · 28.3–32.16「Layer by layer, line by line」：一拍穿一层网。前半是网格层，后半网退化成一条条横线。
// =====================================================================
const D = 520, FOCAL = 760;
const A_BEATS = BEATS.filter(b => b >= 28.3 && b < CUT_B - 0.2);
const camZ = t => A_BEATS.reduce((z, b) => z + D * outExpo((t - b) / 0.3), 0) + 60 * (t - T0);
const thread = z => [140 * noise1(z / 900 + 3), 90 * noise1(z / 1100 + 9) + 40];   // 她的线在世界里的路径
const A_WORDS = [LAYER1, BY1, LAYER2, LINE1, BY2];
function shotA(t) {
  bg(C.ink, C.night);
  const cz = camZ(t), sz = cz + 330;
  const P = (x, y, z) => { const s = FOCAL / (z - cz); return [W / 2 + x * s, H / 2 + y * s, s]; };
  // 网层（远 → 近）
  for (let i = 14; i >= 0; i--) {
    const zp = D * (i + 0.55), dz = zp - cz;
    if (dz < 25 || dz > D * 5.5) continue;
    const [cx, cy, s] = P(0, 0, zp);
    const a = clamp(1 - dz / (D * 5.5)) * clamp((dz - 25) / 160);
    const hw = 1500 * s, hh = 860 * s;
    ctx.lineWidth = 1.2;
    const lines = i < 4;   // 前四层是网，之后只剩横线（line by line）
    ctx.strokeStyle = rgba(i < 4 ? C.lav : C.violet, 0.5 * a); ctx.beginPath();
    const n = i < 4 ? 8 + i * 4 : 14 + (i - 4) * 7;
    for (let k = 0; k <= n; k++) { const y = cy - hh + (2 * hh * k) / n; ctx.moveTo(cx - hw, y); ctx.lineTo(cx + hw, y); }
    if (lines) for (let k = 0; k <= n; k++) { const x = cx - hw + (2 * hw * k) / n; ctx.moveTo(x, cy - hh); ctx.lineTo(x, cy + hh); }
    ctx.stroke();
    // 层号 + 角标（冷面小注释）
    ctx.strokeStyle = rgba(C.bone, 0.7 * a); ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = cx + sx * hw, y = cy + sy * hh; ctx.moveTo(x, y + -sy * 30 * s); ctx.lineTo(x, y); ctx.lineTo(x + -sx * 30 * s, y); }
    ctx.stroke();
    ctx.save(); ctx.translate(cx - hw + 18 * s, cy - hh + 52 * s); ctx.scale(s, s);
    mono(`L${String(i + 1).padStart(2, '0')}`, 0, 0, 44, C.bone, 0.85 * a, 'left', 500);
    mono(i < 4 ? `layer · attn.${i}` : `line · ${n} rows`, 0, 40, 26, C.lav, 0.7 * a);
    ctx.restore();
    // 她穿过去留下的孔：光点经过之后孔向外扩一圈
    const [tx, ty] = thread(zp), [hx, hy] = P(tx, ty, zp), passed = sz - zp;
    if (passed > 0) {
      const r = (40 + passed * 0.9) * s;
      ctx.strokeStyle = rgba(C.cyan, 0.9 * a * clamp(1 - passed / 900)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy, r, 0, 6.2832); ctx.stroke();
    } else { ctx.fillStyle = rgba(C.cyan, 0.5 * a); ctx.beginPath(); ctx.arc(hx, hy, 6 * s, 0, 6.2832); ctx.fill(); }
  }
  // 词：每个词贴在自己的一张透明层上，开唱时在 1.5 层之外，镜头一拍拍撞过去
  A_WORDS.forEach((w, j) => {
    const zw = camZ(w.s - 0.4) + D * 1.75, dz = zw - cz;
    if (t < w.s - 0.4 || dz < 30) return;
    const [x, y, s] = P(j % 2 ? 60 : -620, j % 2 ? 140 : -60, zw);
    ctx.save(); ctx.globalAlpha = clamp((dz - 30) / 200); ctx.translate(x, y); ctx.scale(s, s);
    kword(w, t, 0, 0, 300, { upper: true, wd: w.k === 'by' ? 62 : 112, wght: w.k === 'by' ? 300 : 900 });
    ctx.restore();
  });
  // 她的线：从镜头前一路连到光点
  ctx.strokeStyle = rgba(C.cyan, 0.85); ctx.lineWidth = 2; ctx.beginPath();
  for (let k = 0; k <= 40; k++) { const z = cz + 40 + (sz - cz - 40) * (k / 40), [x, y] = P(...thread(z), z); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
  const [px, py] = P(...thread(sz), sz);
  // 最后一个 line（长音）：光点向右拉出一条横线，字跟着宽度轴拉长
  if (t > LINE2.s - 0.4) {
    const p = wp(LINE2, t), L = outExpo(p) * 1250;
    ctx.strokeStyle = rgba(C.cyan, 0.95); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + L, py); ctx.stroke();
    spark(px + L, py, 5, C.cyan);
    kword(LINE2, t, px - 40, py - 40, 230, { upper: true, align: 'right', wd: lerp(62, 125, inOutCubic(p)), wght: lerp(500, 900, p) });
  }
  spark(px, py, 7, C.cyan);
  mono(`LAYER ${String(Math.min(14, Math.floor(cz / D) + 1)).padStart(2, '0')} / ∞`, 96, H - 96, 22, C.lav, 0.8);
}

// =====================================================================
// B · 32.16–36.06「Thousand directions, one of them’s mine」：一千根方向线炸开（海胆），只剩一根亮。
// =====================================================================
const NR = 1000, RAYS = [];
for (let i = 0; i < NR; i++) {   // 斐波那契球面：均匀的一千个方向
  const y = 1 - (2 * (i + 0.5)) / NR, r = Math.sqrt(1 - y * y), th = i * 2.39996;
  RAYS.push([Math.cos(th) * r, y, Math.sin(th) * r, 0.55 + 0.45 * hash(i + 11)]);
}
const yawB = t => 1.3 * inOutCubic((t - CUT_B) / (MINE.s + 0.3 - CUT_B)) + 0.25;
const ROT = (d, yaw) => { const c = Math.cos(yaw), s = Math.sin(yaw), x = d[0] * c + d[2] * s, z = -d[0] * s + d[2] * c, cp = Math.cos(0.42), sp = Math.sin(0.42); return [x, d[1] * cp - z * sp, d[1] * sp + z * cp]; };
const BC = [W * 0.56, H * 0.52];
const projB = (v, r) => { const s = 820 / (900 + v[2] * r); return [BC[0] + v[0] * r * s, BC[1] + v[1] * r * s, s]; };
// 选中的那一根：静止时朝右下（让开左上的大字）、朝向镜头
const CHOSEN = (() => { let best = 0, bd = -9; RAYS.forEach((d, i) => { const v = ROT(d, yawB(MINE.s + 0.3)); const sc = v[0] * 0.8 + v[1] * 0.45 - v[2] * 0.3; if (sc > bd && d[3] > 0.8) { bd = sc; best = i; } }); return best; })();
const TAGS = [37, 151, 288, 402, 517, 640, 777, 905].filter(i => i !== CHOSEN);
function shotB(t) {
  bg(C.ink, C.ink);
  const yaw = yawB(t), grow = outExpo((t - THOUSAND.s) / 0.55);
  const dimOthers = lerp(1, 0.13, outExpo((t - ONE.s) / 0.3));
  const shrink = 1 - inExpo((t - (MINE.e + 0.05)) / 0.55);   // 收紧：其余的线缩回中心
  const buckets = [[], [], [], []];
  RAYS.forEach((d, i) => {
    if (i === CHOSEN) return;
    const v = ROT(d, yaw), r1 = 40 + 520 * d[3] * grow * shrink;
    if (r1 < 42) return;
    const b = clamp(Math.floor((-v[2] + 1) * 2), 0, 3);
    buckets[b].push([projB(v, 34), projB(v, r1)]);
  });
  buckets.forEach((arr, b) => {
    ctx.strokeStyle = rgba(b > 1 ? C.bone : C.lav, (0.1 + b * 0.14) * dimOthers); ctx.lineWidth = 1 + b * 0.25; ctx.beginPath();
    for (const [[x0, y0], [x1, y1]] of arr) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
    ctx.stroke();
  });
  // 标签：几根线挂着冷面的编号 + 概率
  TAGS.forEach((i, j) => {
    const a = smooth(DIRS.s + j * 0.07, DIRS.s + j * 0.07 + 0.15, t) * dimOthers * shrink;
    if (a <= 0.01) return;
    const v = ROT(RAYS[i], yaw), [x, y] = projB(v, 40 + 520 * RAYS[i][3] * grow);
    ctx.fillStyle = rgba(C.bone, a); ctx.fillRect(x - 2, y - 2, 4, 4);
    mono(`d.${String(i).padStart(4, '0')}  p=.00${1 + (i % 9)}`, x + 10, y - 8, 18, C.lav, a);
  });
  // 选中的一根：one 时变白，mine 时变酸性黄绿；收紧时一路伸出画外
  const vC = ROT(RAYS[CHOSEN], yaw);
  const rC = 40 + 520 * RAYS[CHOSEN][3] * grow + 2400 * inExpo((t - (MINE.e + 0.05)) / 0.7);
  const [cx0, cy0] = projB(vC, 34), [cx1, cy1] = projB(vC, rC);
  const isMine = t >= MINE.s, hot = t >= ONE.s;
  const colC = isMine ? C.lime : hot ? C.bone : C.lav;
  if (isMine) { ctx.strokeStyle = rgba(C.lime, 0.25); ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx1, cy1); ctx.stroke(); }
  ctx.strokeStyle = rgba(colC, hot ? 1 : 0.4); ctx.lineWidth = isMine ? 4 : hot ? 2.5 : 1.2; ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx1, cy1); ctx.stroke();
  // 概率计数器：one → mine 之间从 .001 滚到 1.000
  if (t > ONE.s - 0.1) {
    const p = isMine ? 1 : lerp(0.001, 0.42, inExpo((t - ONE.s) / (MINE.s - ONE.s)));
    const [lx, ly] = projB(vC, 40 + 520 * RAYS[CHOSEN][3] * grow);
    mono(`d.${String(CHOSEN).padStart(4, '0')}  p = ${p.toFixed(3)}`, lx + 18, ly + 34, 24, isMine ? C.lime : C.bone, 1, 'left', 500);
    // 「mine」写在那根线上，顺着线的角度
    if (t > MINE.s - 0.4) {
      ctx.save(); ctx.translate(lerp(cx0, lx, 0.2), lerp(cy0, ly, 0.2)); ctx.rotate(Math.atan2(ly - cy0, lx - cx0));
      kword(MINE, t, 0, -22, 120, { sung: C.lime, cool: C.lime, wd: 87.5 });
      ctx.restore();
    }
  }
  // 光点：在中心按拍子跳；收紧之后顺着那根线冲出去（加速）
  const run = inExpo((t - (MINE.e + 0.25)) / (CUT_C - MINE.e - 0.25));
  const [sx, sy] = projB(vC, 34 + run * 2600);
  spark(BC[0], BC[1], 5 + 4 * pulse(t, lastBeat(t), 0.12), C.cyan, 1 - run);
  if (run > 0) spark(sx, sy, 9, C.cyan);
  // 字：瑞士网格、左对齐，大字配小注释
  kword(THOUSAND, t, 110, 300, 210, { upper: true, wd: lerp(62, 125, outExpo(wp(THOUSAND, t))), pre: 0.01 });
  kword(DIRS, t, 116, 400, 96, { upper: true, wd: 62, wght: 400 });
  mono('1000 sampled · fibonacci sphere · T = 1.0', 118, 450, 20, C.lav, 0.7 * smooth(DIRS.s, DIRS.s + 0.3, t));
  let x = 116;
  for (const w of [ONE, OF, THEMS]) x += kword(w, t, x, 860, 110, { wd: 87.5, wght: w === ONE ? 900 : 400 }) + 30;
}

// =====================================================================
// C · 36.06–39.92「Brand new girl. At the edge of the game…」（第二版）
// 线从左上砸到她胸口 → 她从大方块「解码」出来（方块大小 = 进度，按 16 分音符一级级变小，不用透明度：_参考_Short #1）
// → girl：睁眼，站台一层层亮起来（bg → 屏框 → 屏幕 → 栏杆 → 星空切片，「layer by layer」的回声）。
// =====================================================================
const SIXTEENTH = 0.12;
const CS = stage(5, 88, EYE_C[0][1] + 2, W / 2, H * 0.36);
// 马赛克画法：先缩到 1/b 再放大，b = 一块几格
const mosaicTmp = document.createElement('canvas'), mosaicSmall = document.createElement('canvas');
function mosaic(drawAt1, w, h, x, y, s, b, alpha = 1) {
  if (b <= 1) return false;
  mosaicTmp.width = w; mosaicTmp.height = h; const tg = mosaicTmp.getContext('2d'); tg.clearRect(0, 0, w, h); drawAt1(tg);
  const sw = Math.max(1, Math.ceil(w / b)), sh = Math.max(1, Math.ceil(h / b));
  mosaicSmall.width = sw; mosaicSmall.height = sh; const sg = mosaicSmall.getContext('2d'); sg.imageSmoothingEnabled = true; sg.drawImage(mosaicTmp, 0, 0, sw, sh);
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = alpha; ctx.drawImage(mosaicSmall, Math.round(x), Math.round(y), sw * b * s, sh * b * s); ctx.restore();
  return true;
}
const BLOCKS = [24, 12, 6, 3, 1];
const blockAt = (t, t0) => t < t0 ? 0 : BLOCKS[Math.min(BLOCKS.length - 1, Math.floor((t - t0) / SIXTEENTH))];
const HORIZON_C = CS.oy + PX.layers.rail.y * CS.s;   // 栏杆顶 = 「the edge」
function sea(t, rings, horizon) {
  const cols = 64, rows = 26;
  for (let r = 1; r <= rows; r++) {
    const z = 1 + r * r * 0.06, sy = horizon + 380 / z - 380 / 1.06 + 12;
    if (sy > H + 10) continue;
    for (let c = -cols / 2; c <= cols / 2; c++) {
      const wx = c * 1.6, sx = W / 2 + (wx * 260) / z;
      if (sx < -10 || sx > W + 10) continue;
      const dist = Math.hypot(wx, z * 1.3);
      let b = 0.14 + 0.05 * Math.sin(c * 1.7 + r * 2.3 + t * 2), col = C.lav;
      for (const [t0, v, colR, amp] of rings) {
        if (t < t0) continue;
        const e = Math.exp(-((dist - v * (t - t0)) ** 2) / 1.6) * amp * Math.pow(0.5, (t - t0) / 0.9);
        if (e > 0.02) { b += e; col = mixc(col, colR, e * 1.5); }
      }
      const s = Math.max(1.5, 7 / Math.sqrt(z)) * (1 + clamp(b - 0.3) * 0.8);
      ctx.fillStyle = rgba(mixc(C.violet, col, b), clamp(b)); ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
  }
}
const RINGS_C = [[GIRL.s, 16, C.orange, 1.6], ...BEATS.filter(b => b > GIRL.s + 0.2 && b < CUT_D + 0.1).map((b, i) => [b, 14, i % 2 ? C.pink : C.cyan, 0.8])];
function faceC(t) {
  const blink = t > 38.94 && t < 39.06;
  return { eyes: t < GIRL.s ? 'closed' : t < GIRL.s + 0.3 ? 'wide' : blink ? 'blink' : 'open', mouth: t > 38.4 ? 'smile' : 'flat', glow: t < GIRL.s ? 0 : 1 };
}
function shotC(t) {
  bg(C.ink, C.ink);
  const shake = 18 * pulse(t, GIRL.s, 0.08) + 8 * pulse(t, CUT_C, 0.06), fi = frameIdx(t);
  ctx.save(); ctx.translate((hash(fi) - 0.5) * shake, (hash(fi + 50) - 0.5) * shake);
  // 站台：girl 那一下起，每 1/32 拍（0.06 s）亮一层，每层自己也从方块解码出来
  const tLayer = key => GIRL.s + 0.02 + ORDER.indexOf(key) * 0.06;
  ['bg', 'frame', 'screen', 'mini', 'rail'].forEach(key => {
    const t0 = tLayer(key); if (t < t0) return;
    const L = PX.layers[key], [x, y] = at(CS, key), b = BLOCKS[Math.min(4, Math.floor((t - t0) / 0.04) + 1)];
    if (!mosaic(g => g.drawImage(PX.img[key], 0, 0), L.w, L.h, x, y, CS.s, b)) layer(ctx, key, x, y, CS.s, { alpha: key === 'screen' ? 0.85 + 0.15 * pulse(t, lastBeat(t), 0.1) : 1 });
  });
  sideFade(CS);
  sea(t, RINGS_C, HORIZON_C);
  // 海平线 = 栏杆顶的延长线；唱到 edge 亮成青色
  const eg = pulse(t, EDGE.s, 0.25);
  ctx.strokeStyle = rgba(mixc(C.lav, C.cyan, eg), 0.35 + 0.6 * eg); ctx.lineWidth = 1.2 + 2 * eg; ctx.beginPath(); ctx.moveTo(0, HORIZON_C); ctx.lineTo(W, HORIZON_C); ctx.stroke();
  // 上一镜头那根线从右下冲出 → 这里从左上砸进她胸口
  const [IX, IY] = cell(CS, ...CHEST), hit = outExpo((t - CUT_C) / 0.12), fade = 1 - smooth(CUT_C + 0.15, CUT_C + 0.5, t);
  if (fade > 0) { ctx.strokeStyle = rgba(C.lime, fade); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-40, -40); ctx.lineTo(lerp(-40, IX, hit), lerp(-40, IY, hit)); ctx.stroke(); }
  // 她：撞击后像素先炸开飞向各自的位置（运动模糊拖成线），然后从大方块一级级解码成清晰的她
  const T_ASM = CUT_C + 0.06, T_DEC = CUT_C + 0.42, [gx, gy] = at(CS, 'girl'), bob = hop(t, CS.s), face = faceC(t);
  if (t < T_DEC) {
    for (const [x, y, col, h] of PIX) {
      if ((x + y) % 2) continue;   // 隔格画：一半的格就够看出形，省一半时间
      const tx = gx + x * CS.s, ty = gy + y * CS.s, d = Math.hypot(tx - IX, ty - IY) / 700;
      const u = outExpo((t - T_ASM - 0.2 * h * d) / (0.18 + 0.2 * h));
      if (u <= 0) continue;
      const ang = h * 40, fl = 160 * (1 - u) * h;
      ctx.fillStyle = col; ctx.fillRect(lerp(IX, tx, u) + Math.cos(ang) * fl, lerp(IY, ty, u) + Math.sin(ang) * fl, CS.s * 1.4, CS.s * 1.4);
    }
  } else {
    const b = blockAt(t, T_DEC);
    if (!mosaic(g => girl(g, 0, 0, 1, face), GL.w, GL.h, gx, gy + bob, CS.s, b)) girl(ctx, gx, gy + bob, CS.s, face);
  }
  const sp = 1 - smooth(CUT_C, CUT_C + 0.3, t); spark(IX, IY, 10 * sp, C.cyan, sp);
  // 睁眼那一下：两只眼闪一道橙（只属于这一刻）
  if (t >= GIRL.s) { const k = pulse(t, GIRL.s, 0.1); for (const e of EYE_C) { const [ex, ey] = cell(CS, ...e); spark(ex, ey + bob, 14 * k, C.orange, k); } }
  // BRAND / NEW 在两侧留白里；GIRL. 压在她的黑外套上
  const L0 = CS.ox, R0 = CS.ox + PX.size[0] * CS.s;
  kword(BRAND, t, L0 - 10, 420, 120, { upper: true, align: 'right', wd: lerp(62, 87.5, outExpo(wp(BRAND, t))), pre: 0.15 });
  kword(NEW, t, R0 + 10, 420, 120, { upper: true, wd: lerp(62, 125, outExpo(wp(NEW, t))), pre: 0.15 });
  kword(GIRL, t, W / 2, 1010, 200, { upper: true, align: 'center', wd: 125, pre: 0.2 });
  // 后半句：mono 打字，立在海平线（栏杆延长线）上；左边一段、右边一段
  const blocks = [[EDGE_PHRASE.filter(w => w.s < word('never', 37.6).s), 70], [EDGE_PHRASE.filter(w => w.s >= word('never', 37.6).s), R0 + 40]];
  for (const [ws, x0] of blocks) {
    let x = x0, row = 0;
    for (const w of ws) {
      const s = w.k === 'edge' || w.k === 'wait' ? 40 : 30;
      ctx.font = `500 ${s}px A1Mono, Consolas, monospace`; const ww = ctx.measureText(w.w + ' ').width;
      if (x + ww > (x0 < W / 2 ? L0 - 20 : W - 40)) { x = x0; row++; }
      if (t >= w.s - 0.05) {
        const col = t - w.s < 0.06 ? C.white : t < w.e ? C.pink : mixc(C.pink, C.bone, (t - w.e) / 0.3);
        mono(w.w, x, HORIZON_C - 18 + row * 44, s, col, 1, 'left', 500);
      }
      x += ww;
    }
  }
  ctx.restore();
  mono(t < GIRL.s ? 'decode · weights loaded · eyes: closed' : 'boot ok · eyes: open · hello', 70, H - 70, 22, t < GIRL.s ? C.lav : C.cyan, 0.85);
}

// =====================================================================
// D · 39.92–41.36「Eyes wide open.」：眼睛大特写（一格 = 二十多像素），虹膜里亮着星点；WIDE 唱多长字就拉多宽。
// 「open.」唱完留 3 帧黑当休止符（_参考_Short #3），再切到亮的海。
// =====================================================================
const MID_EYE = [(EYE_C[0][0] + EYE_C[1][0]) / 2, (EYE_C[0][1] + EYE_C[1][1]) / 2];
function shotD(t) {
  bg(C.ink, C.ink);
  if (t > OPEN.e) return;   // 休止符
  const u = (t - CUT_D) / (CUT_E - CUT_D), s = Math.round(lerp(22, 25, u) + 2 * outExpo((t - WIDE.s) / 0.3));
  const st = stage(s, MID_EYE[0], MID_EYE[1], W / 2, H * 0.5);
  const eyes = t < EYES.s ? 'slit' : t < WIDE.s ? 'open' : 'wide';
  world(t, st, { drawGirl: false, cam: [0, 0] });
  const [gx, gy] = at(st, 'girl');
  girl(ctx, gx, gy, s, { eyes, mouth: 'flat' });
  // 虹膜里的星点：按 16 分音符整体换一次位置（状态量化），拍点上更亮
  const q = Math.floor((t - CUT_D) / SIXTEENTH), h = eyes === 'wide' ? 4 : eyes === 'open' ? 3 : 1, lit = pulse(t, lastBeat(t), 0.15);
  GL.eyes.forEach(([x0, y0, x1, y1], e) => {
    const by = y1 - 1, rx = gx + (x0 + 1) * s, ry = gy + (by - h) * s, rw = (x1 - x0 - 2) * s, rh = h * s;
    for (let k = 0; k < 7; k++) {
      const px = rx + hash(q * 31 + k * 7 + e * 101) * rw, py = ry + hash(q * 17 + k * 13 + e * 59) * rh, z = s * (k < 2 ? 0.35 : 0.2);
      ctx.fillStyle = rgba(k % 3 ? C.cyan : C.white, 0.5 + 0.5 * lit); ctx.fillRect(px - z / 2, py - z / 2, z, z);
    }
  });
  let x = 120;
  x += kword(EYES, t, x, 190, 150, { upper: true, wd: 87.5 }) + 36;
  kword(WIDE, t, x, 190, 150, { upper: true, wd: lerp(62, 125, inOutCubic(wp(WIDE, t))) });
  kword(OPEN, t, W - 120, 1010, 150, { upper: true, align: 'right', wd: 100 });
  mono(`eyes: ${eyes} · fov ${(60 + 60 * outExpo((t - WIDE.s) / 0.3)).toFixed(0)}°`, 70, H - 70, 22, C.cyan, 0.8);
}

// =====================================================================
// E · 41.36–43.8「The sea’s lighting up, every little star says wake.」：拉远到整个站台。
// 「sea’s lighting up」= 大屏幕从暗亮到过曝；五条星空切片各认一个词（every / little / star / says / wake），
// 唱到哪条哪条就跳、就亮；切片平时按 16 分音符量化地轻轻错位（连续运动 + 量化刷新 + 稀疏爆发：_参考_Short #2）。
// =====================================================================
const STRIP_WORDS = [...STAR_PHRASE, WAKE];
function shotE(t) {
  bg(C.ink, C.ink);
  const pull = outExpo((t - CUT_E) / 0.5), s = Math.round(lerp(7, 5, pull));
  const st = stage(s, 88, 104, W / 2, H * 0.5 + 20), bob = hop(t, s);
  const LIGHT = SEA_PHRASE.find(w => w.k === 'lighting');
  const lit = lerp(0.25, 1, smooth(LIGHT.s, LIGHT.e, t)) + 0.6 * pulse(t, lastBeat(t), 0.1) * (t > LIGHT.s ? 1 : 0) + 0.8 * pulse(t, WAKE.s, 0.2);
  const q = Math.floor(t / SIXTEENTH);
  const strip = k => {
    const w = STRIP_WORDS[k - 1], on = t >= w.s, kick = on ? pulse(t, w.s, 0.15) : 0, wake = pulse(t, WAKE.s, 0.2);
    const idle = hash(q * 7 + k) < 0.25 ? (hash(q * 13 + k) - 0.5) * 6 * s : 0;
    const dx = idle + (hash(k * 9.1) - 0.5) * 40 * s * (kick + wake);
    return [dx, on ? 1 : 0.45, 0.9 * kick + 0.9 * wake];
  };
  const blink = t > 42.3 && t < 42.42;
  world(t, st, { lit, strip, bob, face: { eyes: t > WAKE.s ? 'wide' : blink ? 'blink' : 'open', mouth: t > LIGHT.s ? 'smile' : 'flat' } });
  sideFade(st);
  // 五条切片各挂一个词：引线从切片右端拉到右侧留白，词按唱的顺序竖着排
  const R0 = st.ox + PX.size[0] * st.s;
  STRIP_WORDS.forEach((w, i) => {
    if (w === WAKE || t < w.s - 0.4) return;
    const L = PX.layers['strip' + (i + 1)], [sx, sy] = cell(st, L.x + L.w, L.y + L.h / 2), on = t >= w.s;
    const lx = R0 + 50, ly = 470 + i * 78;
    ctx.strokeStyle = rgba(on ? C.bone : C.lav, on ? 0.85 : 0.35); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx + 6, sy); ctx.lineTo(R0 + 20, ly - 12); ctx.lineTo(lx - 10, ly - 12); ctx.stroke();
    ctx.fillStyle = rgba(on ? C.bone : C.lav, on ? 1 : 0.4); ctx.fillRect(sx + 3, sy - 3, 6, 6);
    kword(w, t, lx, ly, 52, { wght: 800, wd: 100, dim: 0.45 });
    mono(`strip.${i + 1}`, lx + 2, ly + 22, 15, C.lav, 0.7);
  });
  // 「The sea’s / lighting up,」在左边留白里，瑞士式两行
  ctx.save(); ctx.globalAlpha = 1 - smooth(WAKE.s - 0.3, WAKE.s, t);
  let x = 70;
  SEA_PHRASE.forEach((w, i) => { if (i === 2) x = 70; x += kword(w, t, x, i < 2 ? 260 : 345, 78, { wd: w.k === 'lighting' ? lerp(62, 87.5, wp(w, t)) : 62 }) + 20; });
  ctx.restore();
  if (t > WAKE.s - 0.05) kword(WAKE, t, W / 2, H * 0.25, 260 * lerp(0.85, 1, outBack((t - WAKE.s) / 0.25)), { upper: true, align: 'center', wd: 125, pre: 0.05 });
  mono('stars awake: ' + STRIP_WORDS.filter(w => t >= w.s).length + ' / 5', 70, H - 70, 22, C.cyan, 0.8);
}

// ---------- 一个子帧 ----------
function scene(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (t < CUT_B) shotA(t); else if (t < CUT_C) shotB(t); else if (t < CUT_D) shotC(t); else if (t < CUT_E) shotD(t); else shotE(t);
}

// ---------- 后期：每帧一次（pdoom：post 在快门里只读一个点） ----------
const GRAIN = Array.from({ length: 6 }, (_, k) => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), im = g.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (hash(i * 0.37 + k * 999) - 0.5) * 120; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); return c;
});
function post(t) {
  out.setTransform(1, 0, 0, 1, 0, 0); out.globalAlpha = 1;
  gctx.clearRect(0, 0, glow.width, glow.height); gctx.filter = 'blur(6px)'; gctx.drawImage(cv, 0, 0, glow.width, glow.height); gctx.filter = 'none';
  out.save(); out.globalCompositeOperation = 'lighter'; out.globalAlpha = 0.32; out.drawImage(glow, 0, 0, W, H); out.restore();
  out.save(); out.globalCompositeOperation = 'overlay'; out.globalAlpha = 0.16; const g = GRAIN[((frameIdx(t) % 6) + 6) % 6]; for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) out.drawImage(g, x, y); out.restore();
  const v = out.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)'); out.fillStyle = v; out.fillRect(0, 0, W, H);
  // 冲击帧：硬切的第一帧压一层亮；睁眼那一帧是橙
  const fl = (t0, col, a) => { if (t >= t0 && t - t0 < 1 / FPS) { out.fillStyle = rgba(col, a); out.fillRect(0, 0, W, H); } };
  CUTS.forEach(c => fl(c, C.bone, 0.3)); fl(GIRL.s, C.orange, 0.35); fl(WAKE.s, C.bone, 0.4);
  // 线冲过来之前：曝光一开一关，亮帧越来越短（4 → 3 → 2 → 1 → 1 帧），落地那一帧全白（参考库 Halo 4 片头 0:47–0:51 / 1:33）
  for (const [off, nf] of [[-0.56, 4], [-0.36, 3], [-0.22, 2], [-0.13, 1], [-0.07, 1]]) { const a = CUT_C + off; if (t >= a && t < a + nf / FPS) { out.fillStyle = rgba(C.bone, 0.22); out.fillRect(0, 0, W, H); } }
  fl(CUT_C, C.white, 0.85);
  out.font = '14px A1Mono, Consolas, monospace'; out.textAlign = 'right'; out.fillStyle = 'rgba(246,242,252,0.35)';
  out.fillText(`CLEAN SLATE · 她睁眼 · animator1 (pdoom 手法) · t = ${t.toFixed(2)}`, W - 40, H - 30);
}

// 一帧 = 快门内 n 个子帧的平均（逐个按 1/(k+1) 叠，等价于算术平均）
function draw(t, n = SAMPLES) {
  out.setTransform(1, 0, 0, 1, 0, 0); out.globalCompositeOperation = 'source-over';
  for (let k = 0; k < n; k++) {
    const tk = n === 1 ? t : t + ((k + 0.5) / n - 0.5) * SHUTTER / FPS;
    scene(tk);
    out.globalAlpha = 1 / (k + 1); out.drawImage(fc, 0, 0);
  }
  out.globalAlpha = 1;
  post(t);
}

// ---------- 启动 ----------
await document.fonts.load('900 100px A1Archivo'); await document.fonts.load('expanded 900 100px A1Archivo'); await document.fonts.load('500 20px A1Mono'); await document.fonts.load('400 20px A1Mono');
const ui = document.getElementById('ui');
if (RENDER) {
  ui.remove();
  const n = Math.round((T1 - T0) * FPS), dst = Q.get('out') ?? '-5_Clean Slate/样片/风格小样_她睁眼_animator1_v2.mp4';
  await fetch(`/start?w=${W}&h=${H}&fps=${FPS}&t0=${T0}&t1=${T1}&vflip=0&out=${encodeURIComponent(dst)}`, { method: 'POST' });
  for (let i = 0; i < n; i++) {
    draw(T0 + i / FPS);
    const buf = out.getImageData(0, 0, W, H).data;
    for (let k = 0; ; k++) { try { await fetch('/frame?i=' + i, { method: 'POST', body: buf }); break; } catch (e) { if (k > 20) throw e; await new Promise(r => setTimeout(r, 300)); } }
  }
  await fetch('/done?quit=1', { method: 'POST' }); log('render done', n);
} else if (SHEET) {
  // 接触表：给只看静帧的人
  const [a, b, m] = SHEET.split(',').map(Number), cols = 4, rows = Math.ceil(m / cols), tw = W / cols, th = H / cols;
  const sheet = document.createElement('canvas'); sheet.width = W; sheet.height = th * rows; const sg = sheet.getContext('2d');
  for (let i = 0; i < m; i++) { const t = a + ((b - a) * i) / (m - 1); draw(t); sg.drawImage(cv, (i % cols) * tw, Math.floor(i / cols) * th, tw, th); sg.font = '16px Consolas'; sg.fillStyle = '#fff'; sg.fillText(t.toFixed(2), (i % cols) * tw + 8, Math.floor(i / cols) * th + 20); }
  cv.height = sheet.height; out.drawImage(sheet, 0, 0); ui.remove();
  cv.style.height = 'auto'; cv.style.maxHeight = 'none'; cv.style.position = 'static';
} else if (STILL !== null) {
  draw(STILL); ui.textContent = `${STILL.toFixed(2)} s`; if (Q.has('clean')) ui.remove();
} else {
  // serve.py 不支持 Range 请求 → 直接给 wav 的网址浏览器跳不了位置（currentTime 会回到 0）。整个读成 blob 就能跳。
  ui.textContent = '载入音频…';
  const wav = await (await fetch('../../-5_Clean Slate/Clean Slate.wav')).blob();
  const audio = new Audio(URL.createObjectURL(wav)); let playing = false;
  await new Promise(r => audio.readyState >= 1 ? r() : audio.addEventListener('loadedmetadata', r, { once: true }));
  addEventListener('click', () => { if (!playing) { audio.currentTime = T0; audio.play(); playing = true; } });
  addEventListener('keydown', e => { if (e.code === 'Space') audio.paused ? audio.play() : audio.pause(); if (e.code === 'ArrowRight') audio.currentTime += 1; if (e.code === 'ArrowLeft') audio.currentTime -= 1; });
  const loop = () => { let t = playing ? audio.currentTime : T0; if (playing && t > T1) { audio.currentTime = T0; t = T0; } draw(t, 1); ui.textContent = `${t.toFixed(2)} s · 空格暂停 · ←/→ 跳 1 s`; requestAnimationFrame(loop); };
  loop();
}
window.__ready = true;
