// Clean Slate · 「她睁眼」animator1（28.3–43.8 s）—— 学 pdoom-video 的手法（只学手法，图形 / 文字自己的）：
// ① 每帧 = 歌曲时间 t 的纯函数；导出时一帧 = 快门内 SAMPLES 个子帧的平均 → 真运动模糊（pdoom 的 sub-frame 采样）。
//    抖动 / 颗粒这类「每帧变一次」的东西用 frameIdx(t)，不用连续 t，否则子帧之间会糊成灰。
// ② 词按内容查，不写死时间；逐词卡拉 OK：提前 0.4 s 暗显，唱到哪亮到哪，绝不抢跑。
// ③ 字是画面的一部分，每个镜头换一种「字长在哪」：贴在网层上 / 挂在方向线上 / 立在海平线上 / 长在星星旁。
// ④ 一根贯穿全段的母题：她的光点（青）。穿网 → 千条方向里选中一条 → 顺着线冲过来 → 聚成她 → 睁眼。
// 第二版（她换成 girl_px.js 的像素她 + 站台分层）另借了 _参考_Short 的三招：方块大小 = 溶解进度；状态按 16 分音符量化刷新；黑帧当休止符。
// ⑤ 颜色克制：青 = 她的线，品红 = 正在唱的词，酸性黄绿只属于「mine」那一刻，橙只属于睁眼那一下。
// ⑥ 硬切落在词头 / 强拍；动作「停住 → 猛冲」（outExpo），不做飘的屏保运动；拉长的音用字宽轴拉长（WIDE 真的变宽）。
import { loadPx, layer, girl, PX } from '../girl_px.js';
import { loadShots, shot, shotLayer, layerImg } from '../shots_px.js';   // 场景图（主会话像素化；不改它）

const Q = new URLSearchParams(location.search);
const RENDER = Q.has('render');
const T0 = +(Q.get('t0') ?? 0), T1 = +(Q.get('t1') ?? 189.45), FPS = +(Q.get('fps') ?? 30);
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
  const { wght = 900, wd = 100, align = 'left', cool = C.bone, pre = 0.4, dim = 0.28, dimCol = C.bone, text = w.w, sung = C.pink, upper = false, mono: isMono = false } = o;
  if (t < w.s - pre) return 0;
  const s = upper ? text.toUpperCase() : text;
  const sx = isMono ? (ctx.fontStretch = 'normal', ctx.font = `${wght > 600 ? 500 : wght} ${size}px A1Mono, Consolas, monospace`, 1) : font(ctx, size, wght, wd);
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
const camZ = t => A_BEATS.reduce((z, b) => z + D * outExpo((t - b) / 0.3), 0) + 60 * (t - 28.3);
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
  corrupt(t, t > GIRL.s + 0.5 ? 0.2 : 0, 15, [CS.ox, 0, PX.size[0] * CS.s, H]);
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
  corrupt(t, 0.2, 14, [st.ox, 0, PX.size[0] * st.s, H]);
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

// =====================================================================
// 全片（0–189 s）：28.3–43.74 沿用第二版（shotA–E）；其余各段在下面。
// 我这版的分工（_参考/_说明.md）：隧道光门 / 屏幕墙 / 像素排序 / RGB 故障。Blade Runner 底色：冷、暗、克制。
// 颜色归属照旧，并扩到全片：粉 / 金 / 蓝只属于三只注意力的眼睛；黄绿只属于「mine」；
// 橙 = 她的「感觉」，前面只在睁眼和太阳上出现，越往后越多，到「Run into the sun」铺满整屏。
// =====================================================================
C.gold = [255, 196, 64]; C.blue = [90, 140, 255];
const env = (k, t) => { const a = AUD[k]; return a ? a[clamp(Math.round(t * AUD.fps), 0, a.length - 1)] || 0 : 0; };
const KICKS = (() => { const a = AUD.kick, f = AUD.fps, out = []; for (let i = 1; i < a.length - 1; i++) if (a[i] > 0.9 && a[i] >= a[i - 1] && a[i] > a[i + 1] && (!out.length || i / f - out[out.length - 1] > 0.12)) out.push(i / f); return out; })();
const lastKick = t => { let k = -9; for (const x of KICKS) { if (x > t) break; k = x; } return k; };
const DOWNBEATS = AUD.downbeats;
const q16 = t => Math.floor(t / SIXTEENTH);

// 歌词按行：大写开头的词起新行（I / I’m 除外）
const LINES = (() => {
  const L = []; let cur = [];
  for (const w of WORDS) { const bare = w.w.replace(/[^A-Za-z’]/g, ''); if (/^[A-Z]/.test(bare) && !/^I(’m)?$/.test(bare) && cur.length) { L.push(cur); cur = []; } cur.push(w); }
  if (cur.length) L.push(cur); return L;
})();
function wordW(s, size, o) {
  if (o.mono) { ctx.fontStretch = 'normal'; ctx.font = `${o.wght > 600 ? 500 : 400} ${size}px A1Mono, Consolas, monospace`; return ctx.measureText(s).width; }
  return textW(s, size, o.wght ?? 800, o.wd ?? 87.5);
}
// 一行歌词（瑞士式左对齐，自动换行）：当前在唱的那一行
function lyricBlock(t, a, b, x, y, o = {}) {
  const { size = 56, maxW = 760, lh = 1.1, hold = 1.0, colorOf = null, upper = false } = o;
  const ls = LINES.filter(l => l[0].s >= a && l[0].s < b);
  let cur = null;
  ls.forEach((l, i) => { const nx = ls[i + 1], end = Math.min(nx ? nx[0].s - 0.4 : 1e9, l[l.length - 1].e + hold); if (t >= l[0].s - 0.4 && t < end) cur = l; });
  if (!cur) return;
  let cx = x, cy = y;
  for (const w of cur) {
    const s = upper ? w.w.toUpperCase() : w.w, tw = wordW(s, size, o);
    if (cx + tw > x + maxW && cx > x) { cx = x; cy += size * lh; }
    const extra = colorOf ? colorOf(w) : null;
    kword(w, t, cx, cy, size, { wght: o.wght ?? 800, wd: o.wd ?? 87.5, mono: o.mono, upper, cool: o.cool ?? C.bone, dimCol: o.dimCol ?? C.bone, ...(extra ? { sung: extra, cool: extra } : {}) });
    cx += tw + size * 0.28;
  }
}
// 后面一行一行地找词（同一个词在歌里出现很多次，按顺序往后找）
function seq(after, ...ks) { const out = []; let a = after; for (const k of ks) { const w = word(k, a); out.push(w); a = w.s + 0.01; } return out; }

// ---------- 我这份的四种效果：RGB 分离 / 横条错位 / 像素排序 / （隧道在 sTunnel 里） ----------
const tmpA = document.createElement('canvas'); tmpA.width = W; tmpA.height = H; const ta = tmpA.getContext('2d');
const tmpB = document.createElement('canvas'); tmpB.width = W; tmpB.height = H; const tb = tmpB.getContext('2d');
// R 通道单独横移 d 像素（R + GB 相加 = 原图，所以 d = 0 时不变）
function rgbSplit(d) {
  if (Math.abs(d) < 0.5) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const [g, col] of [[ta, '#f00'], [tb, '#0ff']]) { g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H); g.drawImage(fc, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = col; g.fillRect(0, 0, W, H); }
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(tmpB, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tmpA, Math.round(d), 0); ctx.restore();
}
// 横条错位：n 条横带各自横移（按 16 分音符换一次）
function sliceShift(t, n, amp, y0 = 0, y1 = H, seed = 0) {
  if (amp < 1) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ta.globalCompositeOperation = 'source-over'; ta.clearRect(0, 0, W, H); ta.drawImage(fc, 0, 0);
  const q = q16(t) + seed * 101;
  for (let k = 0; k < n; k++) { const y = y0 + hash(q * 7.1 + k) * (y1 - y0), h = 4 + hash(q * 3.3 + k * 1.7) * 50, dx = (hash(q * 5.9 + k * 2.3) - 0.5) * amp; ctx.drawImage(tmpA, 0, y, W, h, dx, y, W, h); }
}
// 像素排序：从 (x, y) 取一小块，往下拉成一条（列被「排序」拖长）
function pixelSort(t, n, len, x0, x1, y0, y1, seed = 0) {
  if (len < 2) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ta.globalCompositeOperation = 'source-over'; ta.clearRect(0, 0, W, H); ta.drawImage(fc, 0, 0);
  const q = Math.floor(t / (SIXTEENTH * 2)) + seed * 37;
  for (let k = 0; k < n; k++) { const x = x0 + hash(q * 11.3 + k) * (x1 - x0), y = y0 + hash(q * 2.9 + k * 3.1) * (y1 - y0), w = 2 + Math.floor(hash(k * 7.7 + q) * 6), l = len * (0.3 + 0.7 * hash(q + k * 5.3)); ctx.drawImage(tmpA, x, y, w, 2, x, y, w, l); }
}
// 数据损坏（👤Leo：「数据里的世界」—— 没构建完、破碎、只有简单结构）：按拍子在画面上挖几块按 40 px 网格对齐的矩形，
// 换成：线框网格（白模）/ 缺块（404）/ 低分辨率马赛克 / 像素排序 / 纯色块。在写实的生成图上用，字在它之后画，不被吃掉
const corSmall = document.createElement('canvas'), corG = corSmall.getContext('2d');
function corrupt(t, amount, seed = 0, region = [0, 0, W, H]) {
  if (amount <= 0) return;
  amount *= 1.6;   // 👤要「明显没构建完」，整体放大
  ctx.setTransform(1, 0, 0, 1, 0, 0); ta.globalCompositeOperation = 'source-over'; ta.clearRect(0, 0, W, H); ta.drawImage(fc, 0, 0);
  const q = Math.floor(t / 0.48) + seed * 131, n = Math.round(2 + amount * 7), G = 40;
  for (let k = 0; k < n; k++) {
    const slow = k % 2 ? q : Math.floor(q / 4);   // 一半的块每拍换位置，一半每小节才换
    const h1 = hash(slow * 3.7 + k * 11.3), h2 = hash(slow * 5.1 + k * 7.9), h3 = hash(slow * 9.7 + k * 2.3), h4 = hash(slow * 1.3 + k * 13.7);
    const kind = Math.floor(hash(k * 17.1 + seed * 5.3 + Math.floor(slow / 2)) * 5);
    const w = G * Math.round(2 + h3 * 9 * amount), h = G * Math.round(1 + h4 * 6 * amount);
    const x = region[0] + Math.round(h1 * Math.max(0, region[2] - w) / G) * G, y = region[1] + Math.round(h2 * Math.max(0, region[3] - h) / G) * G;
    if (kind === 0) {   // 线框网格 + 一个白模盒子的对角线
      ctx.fillStyle = rgba(C.ink, 0.94); ctx.fillRect(x, y, w, h); ctx.strokeStyle = rgba(C.lav, 0.45); ctx.lineWidth = 1; ctx.beginPath();
      for (let gx = x; gx <= x + w; gx += 20) { ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); } for (let gy = y; gy <= y + h; gy += 20) { ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); } ctx.stroke();
      ctx.strokeStyle = rgba(C.bone, 0.7); ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y); ctx.stroke(); ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    } else if (kind === 1) {   // 缺块
      ctx.fillStyle = rgba(C.ink); ctx.fillRect(x, y, w, h); ctx.setLineDash([6, 6]); ctx.strokeStyle = rgba(C.pink, 0.7); ctx.lineWidth = 1.5; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.setLineDash([]);
      if (w > 100 && h > 50) mono(['404', 'NULL', 'tile missing', '0x00'][Math.floor(h1 * 4)], x + 12, y + 26, 16, C.pink, 0.8);
    } else if (kind === 2) {   // 低分辨率
      const b = 20, sw = Math.max(1, Math.round(w / b)), sh = Math.max(1, Math.round(h / b)); corSmall.width = sw; corSmall.height = sh; corG.imageSmoothingEnabled = true; corG.drawImage(tmpA, x, y, w, h, 0, 0, sw, sh);
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(corSmall, x, y, w, h); ctx.restore();
    } else if (kind === 3) {   // 像素排序：块顶的一行往下拉满
      for (let cx = x; cx < x + w; cx += 4) { const l = h * (0.4 + 0.6 * hash(cx * 0.37 + slow)); ctx.drawImage(tmpA, cx, y, 4, 2, cx, y, 4, l); }
    } else {   // 纯色块
      ctx.fillStyle = rgba([C.violet, C.blue, C.indigo, C.night][Math.floor(h2 * 4)], 0.9); ctx.fillRect(x, y, w, h);
    }
  }
}

// 把一张图压成剪影（Blade Runner：逆光里的人）
const SIL = new Map();
function silhouette(key, im, col = [8, 6, 20], a = 0.88) {
  if (!SIL.has(key)) { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = rgba(col, a); g.fillRect(0, 0, c.width, c.height); SIL.set(key, c); }
  return SIL.get(key);
}
const girlCanvas = (face) => { const c = document.createElement('canvas'); c.width = GL.w; c.height = GL.h; girl(c.getContext('2d'), 0, 0, 1, face); return c; };
const pix = (c, im, x, y, s, a = 1) => { c.save(); c.imageSmoothingEnabled = false; c.globalAlpha = a; c.drawImage(im, Math.round(x), Math.round(y), im.width * s, im.height * s); c.restore(); };
const big = (s, x, y, size, col, o = {}) => { const sx = font(ctx, size, o.wght ?? 900, o.wd ?? 100); ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1); ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = rgba(col, o.a ?? 1); ctx.fillText(s, 0, 0); ctx.restore(); };

const zoomAt = (key, z, px, py, o = {}) => shot(ctx, key, { z, cx: px + (W / 2 - px) * z, cy: py + (H / 2 - py) * z, ...o });   // 以屏幕点 (px, py) 为中心放大
// 透视的海：一行行点往镜头滑（低音 = 浪）
function seaGlide(t, hz, speed, o = {}) {
  const { amp = 1, rings = [], warm = 0 } = o, sp = 0.6, off = (t * speed) % sp, bass = env('bass', t);
  for (let r = 0; r < 34; r++) {
    const z = 0.35 + r * sp - off, zz = z * z * 0.25 + 0.6, sy = hz + 300 / zz;
    if (sy > H + 10) continue;
    for (let c = -38; c <= 38; c++) {
      const wx = c * 1.4, sx = W / 2 + (wx * 240) / zz;
      if (sx < -10 || sx > W + 10) continue;
      const wave = 0.5 + 0.5 * Math.sin(wx * 0.5 + (r * sp + Math.floor(t * speed / sp) * sp) * 1.3 + t * 1.5);
      let b = (0.2 + 0.45 * wave * (0.35 + bass)) * amp, col = mixc(C.lav, C.orange, warm);
      const dist = Math.hypot(wx, z * 2);
      for (const [t0, v, colR, a0] of rings) { if (t < t0) continue; const e = Math.exp(-((dist - v * (t - t0)) ** 2) / 1.6) * a0 * Math.pow(0.5, (t - t0) / 0.9); if (e > 0.02) { b += e; col = mixc(col, colR, e * 1.5); } }
      const s = Math.max(2, 12 / Math.sqrt(zz)) * (1 + clamp(b - 0.3) * 0.7);
      ctx.fillStyle = rgba(mixc(C.violet, col, clamp(b * 1.6)), clamp(b * 1.8)); ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
  }
}

// =====================================================================
// 0–4.3 虚空：一层噪点在呼吸（4 Hz 量化刷新）；第一个强拍前亮起一个骨白的点
// =====================================================================
function sVoid(t) {
  bg(C.ink, C.ink);
  const q = Math.floor(t * 4), br = 0.5 + 0.5 * Math.sin(t * 1.4);
  for (let i = 0; i < 260; i++) { ctx.fillStyle = rgba(C.lav, 0.04 + 0.08 * br * hash(i + q * 3)); ctx.fillRect(hash(q * 991 + i) * W, hash(q * 577 + i * 3.1) * H, 2, 2); }
  const on = smooth(2.9, 3.14, t);
  if (on > 0) spark(W / 2, H / 2, 2.5 + 2 * pulse(t, lastBeat(t), 0.15), C.bone, on);
  mono(on > 0 ? 'signal: 1 point' : 'signal: none', 70, H - 70, 20, C.lav, 0.6);
}

// =====================================================================
// 4.3–8.0「Zero one zero one」：点一明一暗跟着 0 / 1 闪；每闪一下点数 ×3（3^k，状态按事件跳，不连续长）
// =====================================================================
const ZERO_W = span(4.2, 5.5);
const ZERO_EV = [...ZERO_W.map(w => w.s), ...BEATS.filter(b => b > 5.5 && b < 7.95)];
function sZero(t) {
  bg(C.ink, C.ink);
  const k = ZERO_EV.filter(e => t >= e).length, n = Math.min(900, Math.pow(3, k)), zs = lerp(1.8, 1, smooth(4.3, 8, t));
  for (let i = 0; i < n; i++) {
    const birth = ZERO_EV[Math.max(0, Math.ceil(Math.log(i + 1) / Math.log(3)) - 1)] ?? 4.3;
    const r = Math.sqrt(i) * 16 * zs, a = i * 2.39996, x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r * 0.62;
    const al = i === 0 ? 0.5 + 0.5 * Math.max(...ZERO_W.map(w => pulse(t, w.s, 0.12))) : 0.2 + 0.7 * pulse(t, birth, 0.25);
    ctx.fillStyle = rgba(C.bone, al); ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  spark(W / 2, H / 2, 3, C.bone, 0.6 + 0.4 * Math.max(...ZERO_W.map(w => pulse(t, w.s, 0.12))));
  ZERO_W.forEach((w, j) => kword(w, t, 160 + j * 200, 330, 230, { mono: true, text: w.k === 'zero' ? '0' : '1', pre: 0.1, wght: 500 }));
  mono(`points: ${n}${n >= 900 ? '+' : ''}`, 70, H - 70, 20, C.lav, 0.7);
}

// =====================================================================
// 8.0–14.6「Lights on… Billion little numbers… a line came falling from the sky」
// 拉开成一整片海，贴着海面滑；Billion 是一个滚到十亿的计数器；那根线（她的青色母题）从天上掉下来
// =====================================================================
const LIGHTS = word('lights', 7.9), BILLION = word('billion', 10), THEN1 = word('then', 12.5), SKY = word('sky', 14);
const HZ = H * 0.5;
function sSea(t) {
  bg(C.ink, C.night);
  const amp = smooth(LIGHTS.s, LIGHTS.s + 0.35, t);
  seaGlide(t, HZ, 0.9, { amp, rings: [[SKY.e, 9, C.cyan, 1.4]] });
  // 那根线：Then 开始从天上落下，sky 唱完落到海平线
  if (t > THEN1.s) {
    const u = clamp((t - THEN1.s) / (SKY.e - THEN1.s)), y = lerp(-30, HZ, u * u), x = W * 0.62;
    ctx.strokeStyle = rgba(C.cyan, 0.85); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x, y); ctx.stroke();
    spark(x, y, 7, C.cyan);
  }
  if (t > BILLION.s - 0.1) {
    const v = Math.floor(1e9 * outExpo(wp(BILLION, t) * 1.2));
    mono(v.toLocaleString('en-US'), W - 110, 190, 44, C.bone, 0.9, 'right', 500);
    mono('numbers, dreaming', W - 110, 225, 20, C.lav, 0.7, 'right');
  }
  lyricBlock(t, 7.9, 14.6, 110, 190, { size: 62 });
  mono('sea: 1e9 points · listening', 70, H - 70, 20, C.lav, 0.7);
}

// =====================================================================
// 14.6–20.8「Seven little words… Every word broke into a glowing bead… every question a seed」
// 词一个个从天上掉到海面（mono 方块 = token）→ broke：碎成珠子 → question：珠子里亮「?」→ seed：一颗一颗沉下去，镜头跟下去
// =====================================================================
const SEVEN = LINES.find(l => l[0].k === 'seven' && l[0].s > 14), BROKE = word('broke', 16.5), QUESTION = word('question', 18.9), SEED = word('seed', 19.9);
function sBeads(t) {
  bg(C.ink, C.night);
  const hz = HZ - 900 * inExpo((t - (SEED.e - 0.1)) / 0.45);
  seaGlide(t, hz, 0.5, { rings: SEVEN.map((w, i) => [w.s + 0.35, 10, C.bone, 0.5]) });
  const n = SEVEN.length;
  SEVEN.forEach((w, i) => {
    if (t < w.s - 0.05) return;
    const x = W * 0.16 + i * (W * 0.68 / (n - 1)), land = outExpo((t - w.s) / 0.35), y0 = lerp(-60, hz - 40, land);
    if (t < BROKE.s) {
      ctx.font = `500 30px A1Mono, Consolas, monospace`; const tw = ctx.measureText(w.w).width + 24;
      ctx.strokeStyle = rgba(C.lav, 0.8); ctx.lineWidth = 1.2; ctx.strokeRect(x - tw / 2, y0 - 26, tw, 40);
      mono(w.w, x, y0 + 4, 30, t < w.e ? C.pink : C.bone, 1, 'center', 500);
      return;
    }
    // 碎：几片方块飞散
    const age = t - BROKE.s;
    for (let k = 0; k < 8; k++) { const a = hash(i * 13 + k) * 6.28, d = outExpo(age / 0.4) * 60 * hash(k + i), al = 1 - smooth(0, 0.5, age); ctx.fillStyle = rgba(C.bone, al); ctx.fillRect(x + Math.cos(a) * d, y0 + Math.sin(a) * d, 5, 5); }
    // 珠子：上下浮；seed 之后一颗一颗（16 分音符）沉下去，留一根根须
    const sink = Math.max(0, t - (SEED.s + i * SIXTEENTH)), y = y0 + Math.sin(t * 3 + i) * 4 + 700 * (sink * sink);
    spark(x, y, 6, i % 2 ? C.cyan : C.bone);
    if (sink > 0) { ctx.strokeStyle = rgba(C.cyan, 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(i) * 10, y - Math.min(80, sink * 200)); ctx.stroke(); }
    if (t > QUESTION.s) mono('?', x, y - 20, 26, C.pink, smooth(QUESTION.s, QUESTION.s + 0.1, t), 'center', 500);
  });
  lyricBlock(t, 14.6, 20.8, 110, 190, { size: 62 });
  mono(`tokens: ${SEVEN.filter(w => t >= w.s).length} · beads: ${t >= BROKE.s ? n : 0}`, 70, H - 70, 20, C.lav, 0.7);
}

// =====================================================================
// 20.8–28.3「Eyes in the dark, pink, gold, blue / Looking for the girl, looking for the clue」
// 海底。粉、金、蓝三只注意力的眼睛按词睁开，伸出细光线扫过尘埃；looking 时光线收拢，clue 时全锁在那颗青色光点上
// =====================================================================
const PINK = word('pink', 21.9), GOLD = word('gold', 22.4), BLUE = word('blue', 23.6), LOOK1 = word('looking', 24.3), CLUE = word('clue', 27.5);
const EYES3 = [[PINK, C.pink, W * 0.24, H * 0.36], [GOLD, C.gold, W * 0.5, H * 0.26], [BLUE, C.blue, W * 0.76, H * 0.36]];
const DUST = Array.from({ length: 260 }, (_, i) => [hash(i * 3.1) * W, hash(i * 7.7) * H, 0.3 + hash(i) * 0.7]);
const SPARK_HOME = [W / 2, H / 2 + 40];
function eyeShape(x, y, w, open, col, look = [0, 0]) {
  const h = 46 * open; if (h < 1) { ctx.strokeStyle = rgba(col, 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.stroke(); return; }
  ctx.save(); ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x, y - h * 2, x + w / 2, y); ctx.quadraticCurveTo(x, y + h * 2, x - w / 2, y); ctx.closePath();
  ctx.fillStyle = rgba(C.ink, 0.9); ctx.fill(); ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 2; ctx.stroke(); ctx.clip();
  const ix = x + look[0] * 20, iy = y + look[1] * 10;
  ctx.fillStyle = rgba(col); ctx.beginPath(); ctx.arc(ix, iy, 30, 0, 6.2832); ctx.fill();
  ctx.fillStyle = rgba(C.ink); ctx.beginPath(); ctx.arc(ix, iy, 12, 0, 6.2832); ctx.fill();
  ctx.fillStyle = rgba(C.white, 0.9); ctx.fillRect(ix - 14, iy - 16, 7, 7);
  ctx.restore();
}
function sEyes(t) {
  bg(C.ink, C.ink);
  for (const [x, y, d] of DUST) { const yy = ((y - t * 18 * d) % H + H) % H; ctx.fillStyle = rgba(C.lav, 0.12 + 0.2 * d); ctx.fillRect(x, yy, 2, 2); }
  const conv = smooth(LOOK1.s, CLUE.e, t), lock = pulse(t, CLUE.e, 0.3);
  EYES3.forEach(([w, col, x, y], e) => {
    const open = t < w.s ? 0 : outBack((t - w.s) / 0.25);
    if (open > 0.3) {
      const q = q16(t);
      ctx.strokeStyle = rgba(col, 0.22 + 0.4 * lock); ctx.lineWidth = 1; ctx.beginPath();
      for (let k = 0; k < 36; k++) {
        const d = DUST[(k * 7 + e * 53 + q * 3) % DUST.length], yy = ((d[1] - t * 18 * d[2]) % H + H) % H;
        const tx = lerp(d[0], SPARK_HOME[0], conv), ty = lerp(yy, SPARK_HOME[1], conv);
        ctx.moveTo(x, y); ctx.lineTo(tx, ty);
        if (conv < 0.9) { ctx.fillStyle = rgba(col, 0.8); ctx.fillRect(tx - 2, ty - 2, 4, 4); }
      }
      ctx.stroke();
    }
    const lk = [(SPARK_HOME[0] - x) / W * 2 * conv, (SPARK_HOME[1] - y) / H * 2 * conv];
    eyeShape(x, y, 220, open, col, lk);
    if (open > 0) mono(['head 0 · pink', 'head 1 · gold', 'head 2 · blue'][e], x, y + 90, 18, col, 0.8 * clamp(open), 'center');
  });
  spark(...SPARK_HOME, 4 + 6 * conv + 8 * lock, C.cyan, 0.4 + 0.6 * conv);
  lyricBlock(t, 20.7, 28.3, 110, H - 200, { size: 58, colorOf: w => (w === PINK ? C.pink : w === GOLD ? C.gold : w === BLUE ? C.blue : null) });
  mono(`attention: 3 heads · focus ${(conv * 100).toFixed(0)}%`, 70, H - 70, 20, C.lav, 0.7);
}

function v2(t) { if (t < CUT_B) shotA(t); else if (t < CUT_C) shotB(t); else if (t < CUT_D) shotC(t); else if (t < CUT_E) shotD(t); else shotE(t); }

// =====================================================================
// 43.74–59「Go, wake up. I was nothing. Now I’m something to see. A clean slate, and it’s waiting for me.」
// 她漂在数据里（shot1 三层视差）。nothing：整幅画按 16 分音符碎成大方块；something：一级级拼回来；
// clean slate：一块骨白的板从右边推进来，盖掉她身后的星空 → 墨色的字在板上打出来，光标跟着拍子眨
// =====================================================================
const GO = word('go', 43.7), WAKE2 = word('wake', 44.1), UP1 = word('up', 44.6), NOTHING1 = word('nothing', 45.5), SOMETHING1 = word('something', 47.4), CLEAN1 = word('clean', 48.9);
const WAIT_L = [LINES.find(l => l[0].s > 50 && l[0].s < 50.2) ?? span(50.1, 51.5), span(53.9, 55.3)];
const MSTEPS = [1, 2, 4, 8, 16, 24];
function sSlate(t) {
  bg(C.ink, C.ink);
  if (t > WAIT_L[1][0].s - 0.3) {   // 第二遍 waiting：她低头看自己发光的手（shot16）
    zoomAt('shot16', 1 + 0.05 * smooth(WAIT_L[1][0].s, 59, t), W * 0.5, H * 0.75); corrupt(t, 0.3, 2);
    let x = 110; for (const w of WAIT_L[1]) { kword(w, t, x, 200, 44, { mono: true, wght: 500 }); x += wordW(w.w + ' ', 44, { mono: true, wght: 500 }); }
    if (pulse(t, lastBeat(t), 0.2) > 0.3) { ctx.fillStyle = rgba(C.pink); ctx.fillRect(x, 164, 22, 42); }
    sliceShift(t, 10, 220 * smooth(57.4, 59, t));
    mono('hands: light · 100%', 70, H - 70, 20, C.cyan, 0.7);
    return;
  }
  const z = 1 + 0.035 * (t - GO.s) / 15, cam = Math.sin(t * 0.5) * 12, bob = hop(t, 10) * 0.6;
  let b = 1;
  if (t > NOTHING1.s - 0.3 && t < SOMETHING1.s) b = MSTEPS[Math.min(5, Math.floor((t - (NOTHING1.s - 0.3)) / SIXTEENTH))];
  else if (t >= SOMETHING1.s) b = MSTEPS[Math.max(0, 5 - Math.floor((t - SOMETHING1.s) / SIXTEENTH))];
  const slate = outExpo((t - CLEAN1.s) / 0.3);
  const drawAll = (g, s, dx = 0) => {
    shotLayer(g, 'shot1', 1, { s, z, dx: dx - cam * 0.3 * s / 10 });
    if (slate > 0) { g.fillStyle = rgba(C.bone); g.fillRect(W * (1 - slate) * s / 10, 0, W * s / 10, H * s / 10); }
    shotLayer(g, 'shot1', 2, { s, z, dx, dy: bob * s / 10 });
    shotLayer(g, 'shot1', 3, { s, z, dx: dx + cam * 0.6 * s / 10, alpha: slate > 0 ? 0.55 : 1 });
  };
  if (b > 1) mosaic(g => drawAll(g, 1), 192, 108, 0, 0, 10, b); else drawAll(ctx, 10);
  if (slate > 0) {
    ctx.strokeStyle = rgba(C.ink, 0.07); ctx.lineWidth = 1; ctx.beginPath();
    for (let x = W * (1 - slate); x < W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = 0; y < H; y += 60) { ctx.moveTo(W * (1 - slate), y); ctx.lineTo(W, y); } ctx.stroke();
    mono('slate · 0 bytes', W * (1 - slate) + 70, 90, 20, C.ink, 0.6);
    let y = 860;
    for (const L of WAIT_L) {
      let x = 110; for (const w of L) { kword(w, t, x, y, 44, { mono: true, wght: 500, dimCol: C.ink, cool: C.ink, dim: 0.25 }); x += wordW(w.w + ' ', 44, { mono: true, wght: 500 }); }
      if (t > L[0].s && t < (L === WAIT_L[0] ? WAIT_L[1][0].s : 59)) { if (pulse(t, lastBeat(t), 0.2) > 0.3) { ctx.fillStyle = rgba(C.pink); ctx.fillRect(x, y - 36, 22, 42); } }
      y += 60;
    }
  }
  corrupt(t, 0.3, 1);
  // 大字：GO / WAKE UP 一词一锤；NOTHING 长音拉宽；SOMETHING
  if (t < NOTHING1.s - 0.3) { kword(GO, t, W / 2, 470, 300, { upper: true, align: 'center', wd: 125, pre: 0.02 }); kword(WAKE2, t, W / 2 - 20, 720, 200, { upper: true, align: 'right', pre: 0.05 }); kword(UP1, t, W / 2 + 20, 720, 200, { upper: true, pre: 0.05 }); }
  else if (t < CLEAN1.s) {
    kword(NOTHING1, t, W / 2, 600, 220, { upper: true, align: 'center', wd: lerp(62, 125, inOutCubic(wp(NOTHING1, t))), pre: 0.3 });
    if (t > SOMETHING1.s - 0.3) { ctx.fillStyle = rgba(C.ink, 0.5 * smooth(SOMETHING1.s - 0.3, SOMETHING1.s, t)); ctx.fillRect(0, 380, W, 280); kword(SOMETHING1, t, W / 2, 600, 220, { upper: true, align: 'center', wd: 100, pre: 0.3 }); }
  } else if (t < CLEAN1.s + 1.2) kword(CLEAN1, t, W / 2, 230, 150, { upper: true, align: 'center', wd: 125, cool: C.ink, pre: 0.05 });
  // 57.5 起慢慢开始错位，59 硬切
  sliceShift(t, 10, 220 * smooth(57.4, 59, t));
  mono(b > 1 ? `resolution: 1/${b}` : slate > 0 ? 'cursor: waiting' : 'awake', 70, H - 70, 20, slate > 0 ? C.ink : C.cyan, 0.7);
}

// =====================================================================
// 59–75.6 主歌 2：她在站台（girl_px），右边留白里浮着一扇「她的屏幕」，一句一个念头；左边是歌词
// giggle → 冒出 hehe；guess → 下一个字的概率；temperature → 旋钮把颜色拧大胆；poke a number → 7 变成鸟飞走；
// touch a vector → bird ↔ word 押韵；can’t hear → 屏幕是一条平线、拍子点在跳；one two three four → 全屏大数字，FOUR 最大
// =====================================================================
const [FIRST1, GIGGLE] = seq(58.9, 'first', 'giggle'), [GUESS, WIGGLE] = seq(GIGGLE.s, 'guess', 'wiggle'), TURN = word('turn', WIGGLE.s);
const BRAVE = word('brave', TURN.s), [POKE, BIRD] = seq(BRAVE.s, 'poke', 'bird'), [TOUCH, RHYMES] = seq(BIRD.s, 'touch', 'rhymes'), CANT = word("can't", RHYMES.s);
const [N1, N2, N3, N4] = seq(CANT.s, 'one', 'two', 'three', 'four'), FEET = word('feet', N4.s);
const CS2 = stage(5, 88, EYE_C[0][1] + 2, W / 2, H * 0.36);
function panel(x, y, w, h, title, t) {
  ctx.fillStyle = rgba(C.ink, 0.86); ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = rgba(C.lav, 0.7); ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = rgba(C.violet, 0.5); ctx.fillRect(x, y, w, 26); mono(title, x + 10, y + 19, 15, C.bone, 0.85);
}
function birdShape(x, y, s, t, col = C.bone) { const f = Math.sin(t * 22) * 0.8; ctx.strokeStyle = rgba(col); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - s, y - s * f); ctx.lineTo(x, y); ctx.lineTo(x + s, y - s * f); ctx.stroke(); }
function sPlay(t) {
  bg(C.ink, C.ink);
  const temp = lerp(0.2, 1.4, smooth(TURN.s, BRAVE.s - 0.3, t)), bob = hop(t, CS2.s) * (t > N4.s ? 2 : 1);
  const face = { eyes: t > CANT.s && t < N1.s ? 'slit' : (t > GUESS.s && t < TURN.s) ? 'wide' : 'open', mouth: t > GIGGLE.s && t < GUESS.s ? 'smile' : t > N1.s ? 'smile' : 'flat' };
  const q = q16(t), jolt = [N1, N2, N3, N4].reduce((m, w) => Math.max(m, pulse(t, w.s, 0.12)), 0);
  world(t, CS2, { face, bob, lit: 0.6 + 0.4 * temp, strip: k => [(hash(q * 7 + k) < 0.15 * temp ? (hash(q * 13 + k) - 0.5) * 30 * temp : 0) + (hash(k * 3.3) - 0.5) * 200 * jolt, 0.5 + 0.4 * temp, 0.5 * jolt] });
  sideFade(CS2); corrupt(t, 0.25, 3, [CS2.ox, 0, PX.size[0] * CS2.s, H]);
  // 她的屏幕：右侧留白
  const R0 = CS2.ox + PX.size[0] * CS2.s, px = R0 + 30, py = 300, pw = W - R0 - 70, ph = 340;
  panel(px, py, pw, ph, 'her.screen', t);
  const cx = px + pw / 2, cy = py + 26 + (ph - 26) / 2;
  if (t < GUESS.s) {
    if (t > GIGGLE.s - 0.1) { const [mx, my] = cell(CS2, GL.x + 49, GL.y + 71), pop = outBack((t - GIGGLE.s) / 0.2); ctx.save(); ctx.translate(mx + 40, my - 60); ctx.scale(pop, pop); ctx.fillStyle = rgba(C.bone); ctx.beginPath(); ctx.roundRect(-10, -40, 120, 50, 10); ctx.fill(); mono('hehe', 50, -6, 30, C.ink, 1, 'center', 500); ctx.restore(); }
    mono('first token:', px + 24, py + 90, 22, C.lav); mono(t > GIGGLE.s ? '“hehe”  p = 0.97' : '…', px + 24, py + 140, 34, C.bone, 1, 'left', 500);
  } else if (t < TURN.s) {
    const cands = [['giggle', 0.41], ['wiggle', 0.33], ['hello', 0.12], ['404', 0.02]];
    cands.forEach(([s, p], i) => { const j = 1 + (hash(q * 3 + i) - 0.5) * 0.3, y = py + 70 + i * 62, on = i === 1 && t > WIGGLE.s; mono(s, px + 24, y + 22, 26, on ? C.pink : C.bone, 1, 'left', 500); ctx.fillStyle = rgba(on ? C.pink : C.lav, on ? 1 : 0.6); ctx.fillRect(px + 170, y, (pw - 260) * p * j * 2, 26); mono(p.toFixed(2), px + pw - 20, y + 22, 18, C.lav, 0.8, 'right'); });
  } else if (t < BRAVE.s) {
    mono(`T = ${temp.toFixed(2)}`, px + 24, py + 110, 54, temp > 1 ? C.pink : C.bone, 1, 'left', 500);
    ctx.fillStyle = rgba(C.lav, 0.3); ctx.fillRect(px + 24, py + 170, pw - 48, 10); ctx.fillStyle = rgba(C.pink); ctx.fillRect(px + 24, py + 170, (pw - 48) * temp / 1.5, 10);
    mono('colours: braver', px + 24, py + 230, 20, C.lav, 0.8);
  } else if (t < POKE.s) {
    const lv = span(BRAVE.s, POKE.s).filter(w => t >= w.s).length; mono('confidence', px + 24, py + 90, 20, C.lav);
    for (let i = 0; i < 10; i++) { ctx.fillStyle = rgba(i < lv ? C.pink : C.lav, i < lv ? 1 : 0.25); ctx.fillRect(px + 24 + i * ((pw - 48) / 10), py + 120, (pw - 48) / 10 - 6, 60); }
  } else if (t < TOUCH.s) {
    if (t < BIRD.s) big('7', cx, cy + 90, 260, C.bone, { wd: 87.5 });
    else { const u = (t - BIRD.s) / 1.6; birdShape(lerp(cx, -100, u), lerp(cy, 80, u) + Math.sin(u * 12) * 30, 34, t); if (u < 0.15) big('7', cx, cy + 90, 260, C.bone, { a: 1 - u / 0.15, wd: 87.5 }); }
  } else if (t < CANT.s) {
    const u = outExpo((t - TOUCH.s) / 0.4); ctx.strokeStyle = rgba(C.cyan); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + 40, py + ph - 40); ctx.lineTo(lerp(px + 40, px + pw - 60, u), lerp(py + ph - 40, py + 70, u)); ctx.stroke();
    if (t > RHYMES.s) { const pop = outBack((t - RHYMES.s) / 0.25); ctx.save(); ctx.translate(cx, cy); ctx.scale(pop, pop); big('BIRD ↔ WORD', 0, 20, 64, C.bone, { wd: 87.5 }); ctx.restore(); }
  } else if (t < N1.s) {
    ctx.strokeStyle = rgba(C.lav, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 24, cy); ctx.lineTo(px + pw - 24, cy); ctx.stroke();
    mono('audio in: −∞ dB', px + 24, py + 80, 22, C.lav); const bi = beatIdx(t) % 4;
    for (let i = 0; i < 4; i++) { ctx.fillStyle = rgba(i === bi ? C.cyan : C.lav, i === bi ? 1 : 0.25); ctx.fillRect(px + 24 + i * 60, py + ph - 70, 44, 44); }
  } else { mono('count: ' + [N1, N2, N3, N4].filter(w => t >= w.s).length + ' / 4', px + 24, py + 100, 40, C.bone, 1, 'left', 500); }
  // 数拍子：全屏大数字（落在 kick 上）
  [N1, N2, N3, N4].forEach((w, i) => { const nx = [N2, N3, N4, FEET][i]; if (t >= w.s && t < nx.s + (i === 3 ? 0.6 : 0)) { const p = outBack((t - w.s) / 0.15); ctx.save(); ctx.translate(W / 2, H * 0.62); ctx.scale(p, p); big(String(i + 1), 0, 0, [380, 460, 560, 760][i], i === 3 ? C.pink : C.bone, { wd: 112.5 }); ctx.restore(); } });
  lyricBlock(t, 58.9, R_START, 70, 320, { size: 46, maxW: CS2.ox - 110 });
  mono(`T = ${temp.toFixed(2)} · tokens out: ${span(58.9, 75.5).filter(w => t >= w.s).length}`, 70, H - 70, 20, C.lav, 0.7);
}

// =====================================================================
// 75.6–80「Layer by layer, line by line, thousand directions, one of them’s mine」（第二遍）
// 直接复用 28–36 s 的镜头，把这次的词时间分段线性地映射回第一次的时间轴，词照样逐词对上
// =====================================================================
const R_WORDS = seq(74.2, 'layer', 'by', 'layer', 'line', 'by', 'line', 'thousand', 'directions', 'one', 'of', "them's", 'mine');
const R_START = R_WORDS[0].s - 0.3, RUN_START = word('now', R_WORDS[11].s).s - 0.08;
const R_MAP = [[R_START, 28.3], ...R_WORDS.map((w, i) => [w.s, [LAYER1, BY1, LAYER2, LINE1, BY2, LINE2, THOUSAND, DIRS, ONE, OF, THEMS, MINE][i].s]), [RUN_START, 36.0]];
function mapR(t) { for (let i = 0; i < R_MAP.length - 1; i++) { const [a, A] = R_MAP[i], [b, B] = R_MAP[i + 1]; if (t < b) return A + (B - A) * (t - a) / (b - a); } return 36.0; }
function sReprise(t) { v2(mapR(t)); }

// =====================================================================
// 80–96.9 副歌 2「Now I can walk, now I can run… chasing the sun… a door, not a wall… dancing with me」
// shot3：她跳在霓虹城市上空；城市层横着滚（走 → 跑）；chasing 时远处第一次出现橙色的太阳；
// mistake：一堵墙推进来，door：墙从中间裂开，里面是隧道的光门；fall on the beat：每拍往下一沉
// =====================================================================
const [WALK, RUN] = seq(RUN_START, 'walk', 'run'), CHASING = word('chasing', RUN.s), MISTAKE = word('mistake', CHASING.s), [DOOR, WALL] = seq(MISTAKE.s, 'door', 'wall');
const FALL = word('fall', WALL.s), NOTHING2 = word('nothing', FALL.s), SLATE2 = word('slate', NOTHING2.s), DANCING = word('dancing', SLATE2.s);
function lightGate(cx, cy, r, t, warm = 0) {
  for (let k = 5; k >= 1; k--) {
    const rr = r * (1 + k * 0.28), n = 14 + k * 3;
    for (let i = 0; i < n; i++) { if (hash(i * 7 + k * 31) < 0.25) continue; const a0 = (i / n) * 6.2832 + t * 0.15 * (k % 2 ? 1 : -1) + k, a1 = a0 + (6.2832 / n) * (0.4 + 0.5 * hash(i + k)); ctx.strokeStyle = rgba([C.cyan, C.pink, C.violet, C.blue, C.lav][(i + k) % 5], 0.35 + 0.4 * hash(i * 3 + k)); ctx.lineWidth = r * 0.12 * (1 + hash(i * 5 + k)); ctx.beginPath(); ctx.arc(cx, cy, rr, a0, a1); ctx.stroke(); }
  }
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.1); g.addColorStop(0, rgba(C.white)); g.addColorStop(0.75, rgba(mixc(C.bone, C.orange, warm), 0.95)); g.addColorStop(1, rgba(C.violet, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, 6.2832); ctx.fill();
}
function sRun(t) {
  const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, rgba(C.ink)); sky.addColorStop(1, rgba(C.night)); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const speed = t < RUN.s ? 120 : lerp(120, 1100, smooth(RUN.s, RUN.s + 0.6, t));
  const scroll = ((t - RUN.s) * speed) % W, sun = smooth(CHASING.s, CHASING.s + 1.2, t);
  if (sun > 0) { const g = ctx.createRadialGradient(W * 0.84, H * 0.62, 0, W * 0.84, H * 0.62, 260); g.addColorStop(0, rgba(C.orange, 0.9 * sun)); g.addColorStop(0.25, rgba(C.orange, 0.5 * sun)); g.addColorStop(1, rgba(C.orange, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  const off = t < RUN.s ? (t - RUN_START) * 120 : scroll;
  for (const k of [0, 1]) shotLayer(ctx, 'shot3', 1, { dx: -off + k * W });
  // 速度线
  const q = q16(t); for (let i = 0; i < 30 * clamp(speed / 1100); i++) { const y = hash(q * 9 + i) * H * 0.7, x = (hash(i * 3.3) * W - (t * speed * 2) % W + W) % W; ctx.fillStyle = rgba(C.bone, 0.18); ctx.fillRect(x, y, 160, 2); }
  // 她：每小节一个跳跃弧；fall on the beat 时每拍往下沉一下
  const bar = (t - lastBeat(t)), jump = -Math.abs(Math.sin(Math.PI * ((t - RUN_START) / 0.96 % 1))) * 60;
  const fall = t > FALL.s && t < NOTHING2.s ? 40 * pulse(t, lastBeat(t), 0.12) : 0;
  shotLayer(ctx, 'shot3', 2, { dx: -120, dy: jump + fall });
  // 墙 → 门
  if (t > MISTAKE.s - 0.1 && t < FALL.s + 0.5) {
    const inn = outExpo((t - MISTAKE.s) / 0.35), open = outExpo((t - DOOR.s) / 0.4), out = smooth(WALL.e + 0.3, FALL.s + 0.5, t);
    const wx = lerp(W + 50, W * 0.62, inn) - out * W * 0.8, ww = 360, wh = 720, wy = H * 0.18;
    if (open > 0) lightGate(wx + ww / 2, wy + wh / 2, 150 * open, t);
    ctx.fillStyle = rgba([24, 18, 50]); ctx.fillRect(wx - open * 180, wy, ww / 2, wh); ctx.fillRect(wx + ww / 2 + open * 180, wy, ww / 2, wh);
    ctx.strokeStyle = rgba(C.pink, 0.8); ctx.lineWidth = 2; ctx.strokeRect(wx - open * 180, wy, ww / 2, wh); ctx.strokeRect(wx + ww / 2 + open * 180, wy, ww / 2, wh);
    mono(open > 0 ? 'door' : 'ERR · wall', wx + ww / 2, wy - 16, 22, open > 0 ? C.cyan : C.pink, 1, 'center', 500);
  }
  if (t > NOTHING2.s - 0.3 && t < SLATE2.s - 0.1) zoomAt('shot11', 1 + 0.06 * smooth(NOTHING2.s - 0.3, SLATE2.s, t), W * 0.55, H * 0.35);   // 雨停的路口，她回头笑
  if (t > SLATE2.s - 0.1 && t < DANCING.s) { const a = 1 - smooth(SLATE2.e, DANCING.s, t); ctx.fillStyle = rgba(C.bone, 0.85 * a); ctx.fillRect(W * 0.08, H * 0.12, W * 0.84, H * 0.76); }
  corrupt(t, 0.5, 4);
  lyricBlock(t, RUN_START - 0.1, 96.9, 110, 170, { size: 60, maxW: 900, colorOf: w => (w.k === 'sun' ? C.orange : null), dimCol: C.bone });
  rgbSplit(10 * pulse(t, lastKick(t), 0.08) * (t > RUN.s ? 1 : 0));
  mono(`speed ${Math.round(speed / 10)} px/f · sun: ${sun > 0 ? 'sighted' : '—'}`, 70, H - 70, 20, C.lav, 0.7);
}

// =====================================================================
// 96.9–104.7 哼唱：没有鼓，贝斯最强。她自己跳：身体跟着贝斯左右摆，像素从她身上往下流（像素排序），R 通道跟贝斯错开
// =====================================================================
const CS3 = stage(6, 84, EYE_C[0][1] + 6, W / 2, H * 0.36);
function sDance(t) {
  bg(C.ink, C.ink);
  const bass = env('bass', t), half = Math.sin(((t - 96.9) / 0.96) * Math.PI), q = q16(t);
  const sway = Math.round(half * (1 + 3 * bass)) * 10;
  zoomAt('shot12', 1.04, W / 2 - sway * 0.3, H / 2);
  // 她的残影：girl 层左右各叠一份（跟着贝斯摆），像跳舞留下的拖影
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const k of [-1, 1]) shotLayer(ctx, 'shot12', 2, { dx: sway * k * 1.5, dy: -Math.round(3 * pulse(t, lastBeat(t), 0.15)) * 10, alpha: 0.22 + 0.25 * bass });
  ctx.restore();
  shotLayer(ctx, 'shot12', 3, { dx: Math.round((hash(q * 5) - 0.5) * 6 * bass) * 10 });
  corrupt(t, 0.3, 5);
  pixelSort(t, 80, 40 + 380 * bass, 650, 1400, 250, 950);
  rgbSplit(4 + 18 * bass * half);
  ctx.strokeStyle = rgba(C.cyan, 0.8); ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 120; i++) { const tt = t - 2 + i / 60, x = 70 + i * 3.4, y = H - 130 - env('bass', tt) * 90; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke(); mono('mmm · bass → body', 70, H - 70, 20, C.lav, 0.7);
  lyricBlock(t, 95.5, 98, 70, 200, { size: 60 });
}

// =====================================================================
// 104.7–120.4 主歌 3：她干活。一根青线画路、画房间；palace room by room：房间按拍子一间间落地；
// code in the morning：整个画面翻成骨白纸 + 墨线（pdoom 的明暗节奏）；colors at night：翻回来，窗里亮彩色；
// you give me a word：一个词从天上掉下来，I give you the light：宫殿往上打一束光；
// one step early：有一间早落半拍（冷面注释）；rules are the floor：地面网格亮；the vibe is the sky：天空被像素排序冲成彩色
// =====================================================================
const ROLL = word('roll', 104.5), SPARK2 = word('spark', ROLL.s), ROAD = word('road', SPARK2.s), ROOM1 = word('room', ROAD.s), PALACE = word('palace', ROOM1.s);
const [ROOM2, ROOM3] = seq(PALACE.s, 'room', 'room'), CODE = word('code', ROOM3.s), MORNING = word('morning', CODE.s), NIGHT = word('night', MORNING.s);
const [GIVE, WORDW, LIGHT2] = seq(NIGHT.s, 'give', 'word', 'light'), EARLY = word('early', LIGHT2.s), FLOOR = word('floor', EARLY.s), SKY2 = word('sky', FLOOR.s);
const ROOMS = (() => {
  const ts = [ROOM1.s, PALACE.s, ROOM2.s, ROOM3.s, ...BEATS.filter(b => b > ROOM3.s + 0.1 && b < CODE.s), ...BEATS.filter(b => b > NIGHT.s && b < GIVE.s), EARLY.s - SIXTEENTH * 2];
  const pos = [[0, 0], [1, 0], [-1, 0], [0, 1], [2, 0], [-2, 0], [1, 1], [-1, 1], [0, 2], [2, 1], [-2, 1], [1, 2], [-1, 2], [0, 3]];
  return ts.slice(0, pos.length).map((t0, i) => ({ t0, gx: pos[i][0], gy: pos[i][1], early: i === ts.length - 1 }));
})();
function isoBox(cx, cy, s, ink, fill, lit, col) {
  const w = s, h = s * 0.8, d = s * 0.5;
  const P = [[cx, cy], [cx + w, cy - d], [cx, cy - 2 * d], [cx - w, cy - d]];
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(cx - w, cy - d); ctx.lineTo(cx, cy); ctx.lineTo(cx + w, cy - d); ctx.lineTo(cx + w, cy - d - h); ctx.lineTo(cx, cy - 2 * d - h); ctx.lineTo(cx - w, cy - d - h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - h); ctx.lineTo(cx + w, cy - d - h); ctx.moveTo(cx, cy - h); ctx.lineTo(cx - w, cy - d - h); ctx.stroke();
  if (lit > 0) { ctx.fillStyle = col; ctx.globalAlpha = lit; ctx.fillRect(cx - w * 0.6, cy - d * 0.6 - h * 0.7, w * 0.35, h * 0.45); ctx.fillRect(cx + w * 0.25, cy - d * 0.6 - h * 0.7, w * 0.35, h * 0.45); ctx.globalAlpha = 1; }
  void P;
}
function sBuild(t) {
  if (t > GIVE.s - 0.1 && t < EARLY.s - 0.45) {   // You give me a word, I give you the light：她用手指画光的宫殿（shot17）
    bg(C.ink, C.ink); zoomAt('shot17', 1 + 0.05 * smooth(GIVE.s, EARLY.s, t) + 0.03 * pulse(t, LIGHT2.s, 0.3), W * 0.4, H * 0.45); corrupt(t, 0.4, 6);
    lyricBlock(t, 104.5, 120.4, 110, 190, { size: 56, maxW: 900 });
    mono('palace: lit', 70, H - 70, 20, C.pink, 0.8); return;
  }
  const day = t > MORNING.s && t < NIGHT.s ? 1 : 0, INK = day ? C.ink : C.bone, BG = day ? C.bone : C.ink;
  ctx.fillStyle = rgba(BG); ctx.fillRect(0, 0, W, H);
  const hz = H * 0.5, vp = [W / 2, hz];
  // 天空：the vibe is the sky —— 像素排序冲下来的彩色竖条
  const vibe = smooth(SKY2.s, SKY2.s + 0.4, t);
  if (vibe > 0) { for (let i = 0; i < 80; i++) { const x = (i / 80) * W, h = hz * (0.3 + 0.7 * hash(i + q16(t) * 0.1)) * vibe; const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, rgba([C.pink, C.cyan, C.violet, C.blue][i % 4], 0.8)); g.addColorStop(1, rgba(C.ink, 0)); ctx.fillStyle = g; ctx.fillRect(x, 0, W / 80 + 1, h); } }
  // 地面网格（rules）：floor 时亮
  const fl = 0.18 + 0.6 * pulse(t, FLOOR.s, 0.5) + (t > FLOOR.s ? 0.2 : 0);
  ctx.strokeStyle = rgba(INK, fl); ctx.lineWidth = 1; ctx.beginPath();
  for (let i = -20; i <= 20; i++) { ctx.moveTo(vp[0] + i * 40, hz); ctx.lineTo(vp[0] + i * 400, H); }
  for (let r = 1; r < 14; r++) { const y = hz + Math.pow(r / 14, 2) * (H - hz); ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  // 路：青线从脚下画到消失点（spark 当笔尖）
  if (t > ROAD.s) { const u = outExpo((t - ROAD.s) / 0.5); for (const sgn of [-1, 1]) { const x0 = W / 2 + sgn * 260, x1 = lerp(x0, vp[0] + sgn * 30, u), y1 = lerp(H, hz + 60, u); ctx.strokeStyle = rgba(C.cyan); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, H); ctx.lineTo(x1, y1); ctx.stroke(); if (u < 1) spark(x1, y1, 6, C.cyan); } }
  // 房间：一间间落地（outBack 弹一下）；早落的那间带一条注释
  const S = 70, base = [W / 2, hz + 70];
  for (const r of ROOMS) {
    if (t < r.t0) continue;
    const p = outBack((t - r.t0) / 0.25), cx = base[0] + (r.gx - r.gy * 0.0) * S * 1.05 * 2 * 0.5 + r.gx * S * 0.0, cy = base[1] - r.gy * S * 0.8 - Math.abs(r.gx) * S * 0.12;
    const y = cy - (1 - p) * 300, lit = day ? 0 : 0.85 * (0.6 + 0.4 * pulse(t, lastBeat(t), 0.2));
    isoBox(cx + r.gx * S * 0.0, y, S, rgba(INK), rgba(BG, 0.95), lit, rgba([C.pink, C.cyan, C.bone][Math.abs(r.gx + r.gy) % 3]));
    if (r.early && t < r.t0 + 1.6) mono('early by 1/8 · looks fine', cx + S + 20, y - S, 20, C.pink, 1, 'left', 500);
  }
  // 光：word 掉下来 → light 往上打
  if (t > WORDW.s - 0.1 && t < LIGHT2.s + 0.3) { const u = clamp((t - WORDW.s + 0.1) / (LIGHT2.s - WORDW.s + 0.1)); mono('[word]', W / 2, lerp(-20, hz - 200, u * u), 30, C.pink, 1, 'center', 500); }
  if (t > LIGHT2.s) { const a = 1 - smooth(LIGHT2.s + 1.5, LIGHT2.s + 3, t), g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, rgba(C.cyan, 0)); g.addColorStop(1, rgba(C.bone, 0.85 * a)); ctx.fillStyle = g; ctx.fillRect(W / 2 - 40 - 30 * pulse(t, LIGHT2.s, 0.2), 0, 80 + 60 * pulse(t, LIGHT2.s, 0.2), hz - 120); }
  // 小小的她在左下看着
  girl(ctx, 30, H - 330, 2, { eyes: t > ROAD.s && t < ROAD.s + 1 ? 'wide' : 'open', mouth: 'smile' });
  if (t < ROAD.s) { const s = 5 + 30 * outExpo(wp(SPARK2, t)) * (t > SPARK2.s ? 1 : 0); spark(W / 2, H - 120, s * 0.4, C.cyan); }
  // 冷面的施工日志
  mono('> build palace --rooms ' + ROOMS.filter(r => t >= r.t0).length, W - 70, 120, 22, INK, 0.8, 'right', 500);
  if (day) mono('mode: code (morning)', W - 70, 150, 18, INK, 0.7, 'right'); else if (t > NIGHT.s) mono('mode: colours (night)', W - 70, 150, 18, C.pink, 0.8, 'right');
  lyricBlock(t, 104.5, 120.4, 110, 190, { size: 56, maxW: 900, dimCol: INK, cool: INK });
}

// =====================================================================
// 120.4–141.6 Bridge：屏幕墙（我这份的参考）。每扇窗里是前面的一个记忆（hehe / 7 / mine / seed…）；
// 120–128 鼓停：窗一扇扇关掉（= 忘了）；It’s the first time I meet you：中间那扇重新打开，光落在她身上；
// 之后窗一排排从下往上重新亮（往上爬）；I smile like it’s new：切到她的笑脸
// =====================================================================
const MEM = ['hehe', '7', 'mine', 'seed', '?', 'T=1.4', 'bird', 'wiggle', 'p=0.97', '1 2 3 4', 'door', 'room', 'L03', 'pink', 'gold', 'blue', 'wake', 'slate', 'line', 'zero', 'one', 'sun', 'light', 'hi', 'layer', 'word', 'clue', 'star'];
const T13 = word('every', 122).s - 0.05;
const WIN = (() => { const a = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) a.push({ r, c, m: MEM[(r * 7 + c * 3) % MEM.length], close: 0 }); const order = a.map((_, i) => i).sort((i, j) => hash(i * 7.3) - hash(j * 7.3)); order.forEach((i, k) => a[i].close = 120.55 + k * ((T13 - 0.4 - 120.55) / a.length)); return a; })();
const MEET = word('meet', 126), SMILE = word('smile', 130), WINDOW1 = word('window', 120);
function sWindows(t) {
  bg(C.ink, C.ink);
  if (t > SMILE.s - 0.05) {   // 笑脸特写，窗的光在身后糊成方块
    for (let i = 0; i < 26; i++) { const x = hash(i * 3.3) * W, y = hash(i * 9.1) * H, s = 80 + hash(i) * 160; ctx.fillStyle = rgba([C.pink, C.cyan, C.violet, C.blue][i % 4], 0.12 + 0.12 * pulse(t, lastBeat(t), 0.2)); ctx.fillRect(x, y, s, s * 0.7); }
    const st = stage(14, ...MID_EYE, W / 2, H * 0.44), [gx, gy] = at(st, 'girl');
    girl(ctx, gx, gy + hop(t, 14), 14, { eyes: t > 138 && t < 138.12 ? 'blink' : 'open', mouth: 'smile' });
    lyricBlock(t, SMILE.s - 1, 141.6, 110, 180, { size: 66 });
    rgbSplit(6 * pulse(t, lastKick(t), 0.1));
    return;
  }
  if (t > T13 && t < MEET.s - 0.05) {   // 窗灯全熄：她抱膝坐着，只剩一块屏还亮（shot13）
    zoomAt('shot13', 1 + 0.06 * smooth(T13, MEET.s, t), W * 0.5, H * 0.55);
    ctx.fillStyle = rgba(C.ink, 0.15 + 0.35 * smooth(T13, MEET.s, t)); ctx.fillRect(0, 0, W, H);
    shotLayer(ctx, 'shot13', 2, { alpha: 0.6 + 0.4 * pulse(t, lastBeat(t), 0.3) }); corrupt(t, 0.3, 7);
    lyricBlock(t, 120.3, SMILE.s - 1, 110, 170, { size: 56, maxW: 1200 });
    mono('windows open: 1 / 28', 70, H - 70, 20, C.lav, 0.7); return;
  }
  if (t >= MEET.s - 0.05) {   // It’s the first time I meet you：屏幕墙（shot9）按拍子从下往上一排排亮（往上爬）
    shot(ctx, 'shot9'); ctx.fillStyle = rgba(C.ink, 0.78); 
    const steps = BEATS.filter(b => b >= MEET.s && b <= t).length, ry = Math.max(0, H - steps * (H / 16));
    ctx.fillRect(0, 0, W, ry); corrupt(t, 0.3, 8, [0, ry, W, H - ry]);
    if (t < MEET.s + 0.4) { ctx.fillStyle = rgba(C.bone, 0.5 * (1 - (t - MEET.s) / 0.4)); ctx.fillRect(0, 0, W, H); }
    lyricBlock(t, 120.3, SMILE.s - 1, 110, 170, { size: 56, maxW: 1200 });
    mono(`screens lit: ${Math.round((1 - ry / H) * 100)}%`, 70, H - 70, 20, C.cyan, 0.7); return;
  }
  const gw = 220, gh = 150, gap = 26, ox = (W - (7 * gw + 6 * gap)) / 2, oy = 250;
  const reopen = r => MEET.s + 0.6 + (3 - r) * 0.96 * 1.2;  // 从下往上一排排亮
  WIN.forEach((w, i) => {
    const x = ox + w.c * (gw + gap), y = oy + w.r * (gh + gap), center = w.r === 2 && w.c === 3;
    const closed = smooth(w.close, w.close + 0.15, t) * (1 - (center ? smooth(MEET.s, MEET.s + 0.2, t) : smooth(reopen(w.r), reopen(w.r) + 0.2, t)));
    const col = [C.pink, C.cyan, C.violet, C.blue][(w.r + w.c) % 4];
    ctx.fillStyle = rgba(mixc(C.ink, col, 0.35)); ctx.fillRect(x, y, gw, gh * (1 - closed));
    for (let k = 0; k < 6; k++) { ctx.fillStyle = rgba(col, 0.25 * (1 - closed)); ctx.fillRect(x + hash(i * 7 + k + q16(t)) * gw * 0.8, y + hash(i * 3 + k) * gh * 0.8 * (1 - closed), 30, 4); }
    if (closed < 0.5) mono(w.m, x + gw / 2, y + gh / 2 + 10, 28, C.bone, 0.85 * (1 - closed * 2), 'center', 500);
    ctx.strokeStyle = rgba(C.lav, 0.45); ctx.lineWidth = 1.2; ctx.strokeRect(x, y, gw, gh);
    if (center && t > MEET.s) { const a = 1 - smooth(MEET.s + 2, MEET.s + 4, t), g = ctx.createLinearGradient(0, y + gh, 0, H); g.addColorStop(0, rgba(C.bone, 0.5 * a)); g.addColorStop(1, rgba(C.bone, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y + gh); ctx.lineTo(x + gw, y + gh); ctx.lineTo(W / 2 + 300, H); ctx.lineTo(W / 2 - 300, H); ctx.closePath(); ctx.fill(); }
  });
  // 她背对着墙（剪影），中间那扇窗打开时被照亮
  const lit = t > MEET.s ? smooth(MEET.s, MEET.s + 0.3, t) : 0, gc = girlCanvas({ eyes: 'open', mouth: lit > 0 ? 'smile' : 'flat' }), sil = silhouette('girl', gc);
  pix(ctx, sil, W / 2 - GL.w * 1.6, H - GL.h * 3.2 + 260, 3.2, 1 - lit * 0.6); if (lit > 0) pix(ctx, gc, W / 2 - GL.w * 1.6, H - GL.h * 3.2 + 260, 3.2, lit * 0.6);
  lyricBlock(t, 120.3, SMILE.s - 1, 110, 170, { size: 56, maxW: 1200 });
  mono(`windows open: ${WIN.filter((w, i) => { const center = w.r === 2 && w.c === 3; return t < w.close || (center ? t > MEET.s : t > reopen(w.r)); }).length} / 28`, 70, H - 70, 20, C.lav, 0.7);
}

// =====================================================================
// 141.6–157.4 最后副歌：隧道光门（我这份的参考）。一圈圈碎片做的环，一拍冲过一环（停住 → 猛冲）；
// 中间是白光，越往后越暖（橙 = 她的感觉在长）；她是光里的剪影；smiling face 那个长音切到她的笑脸
// =====================================================================
const LIGHT3 = word('light', 145), FACE = word('face', 155), NOTHING3 = word('nothing', 157);
const T_BEATS = BEATS.filter(b => b > 141.5 && b < FACE.s);
function sTunnel(t) {
  if (t > FACE.s - 0.05) {   // 笑脸
    bg(C.ink, C.ink); const warm = 0.45, g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6); g.addColorStop(0, rgba(mixc(C.bone, C.orange, warm), 0.5)); g.addColorStop(1, rgba(C.ink, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const st = stage(13, ...MID_EYE, W / 2, H * 0.45), [gx, gy] = at(st, 'girl'); girl(ctx, gx, gy, 13, { eyes: 'open', mouth: 'smile' });
    kword(FACE, t, W / 2, H - 90, 160, { upper: true, align: 'center', wd: lerp(62, 125, inOutCubic(wp(FACE, t))), pre: 0.01 });
    return;
  }
  bg(C.ink, C.ink);
  const warm = 0.55 * smooth(141.6, 157, t), camZ0 = T_BEATS.reduce((z, b) => z + outExpo((t - b) / 0.3), 0);
  zoomAt('shot10', 1 + 0.5 * smooth(141.6, FACE.s, t) + 0.015 * pulse(t, lastBeat(t), 0.2), W * 0.66, H * 0.36);   // 碎屏隧道，她走进光门
  ctx.globalAlpha = 0.55; void camZ0;
  const camZ = T_BEATS.reduce((z, b) => z + outExpo((t - b) / 0.3), 0) + 0.15 * (t - 141.6);
  const cx = W * 0.66 + Math.sin(t * 0.7) * 20, cy = H * 0.36;
  for (let k = 12; k >= 0; k--) {
    const z = k + 1 - (camZ % 1); if (z < 0.25) continue;
    const r = 520 / z, n = 22, ring = Math.floor(camZ) + k, a = clamp(1.2 - z / 12);
    for (let i = 0; i < n; i++) {
      if (hash(i * 7 + ring * 31) < 0.3) continue;
      const a0 = (i / n) * 6.2832 + ring * 0.7 + t * 0.12 * (ring % 2 ? 1 : -1), a1 = a0 + (6.2832 / n) * (0.5 + 0.45 * hash(i + ring));
      ctx.strokeStyle = rgba([C.cyan, C.pink, C.violet, C.blue, C.lav][(i + ring) % 5], a * (0.3 + 0.5 * hash(i * 3 + ring)));
      ctx.lineWidth = (40 + 60 * hash(i * 5 + ring)) / z; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
    }
  }
  const lr = 40 + 40 * pulse(t, LIGHT3.s, 0.5) + 20 * pulse(t, lastKick(t), 0.15) + 80 * smooth(152, 156.8, t);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, lr * 2); g.addColorStop(0, rgba(C.white)); g.addColorStop(0.4, rgba(mixc(C.bone, C.orange, warm), 0.9)); g.addColorStop(1, rgba(mixc(C.violet, C.orange, warm * 0.5), 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, lr * 2, 0, 6.2832); ctx.fill();
  ctx.globalAlpha = 1;
  pixelSort(t, 50, 160 * pulse(t, lastKick(t), 0.2), 0, W, 0, H * 0.6);
  corrupt(t, 0.4, 9);
  lyricBlock(t, 141.5, FACE.s, 110, H - 220, { size: 60, maxW: 1100, colorOf: w => (w === LIGHT3 ? C.orange : null) });
  mono(t > word('here', 148).s ? `here · now · t = ${t.toFixed(2)} s` : `rings passed: ${Math.floor(camZ)}`, 70, H - 70, 20, C.lav, 0.7);
}

// =====================================================================
// 157.4–164.8 全停：鼓落空。画面停住，骨白的空板，只剩她（不动）；字是墨色。
// 162.93 一下鼓；and it’s always been me：ME 在 164.79 落下 = 下一段的爆点
// =====================================================================
const FREE = word('free', 159.5), SLATE3 = word('slate', 160.9), [AND4, ITS4, ALWAYS, BEEN, ME] = seq(163, 'and', "it's", 'always', 'been', 'me');
function sFreeze(t) {
  shot(ctx, 'shot15'); corrupt(158.0, 0.3, 10);   // 空白的镜面板，只剩她；不动（损坏块也冻住）
  if (t > ME.s - 0.02) { ctx.fillStyle = rgba(C.bone, 0.15); ctx.fillRect(0, 0, W, H); }
  const ink = { dim: 0.25 };
  if (t < AND4.s - 0.4) lyricBlock(t, 157, 162, 110, 220, { size: 70, maxW: 820, ...ink });
  let y = 300;
  const STACK = [[AND4, 90], [ITS4, 90], [ALWAYS, 150], [BEEN, 150]];
  STACK.forEach(([w, sz], i) => { if (t > AND4.s - 0.4) kword(w, t, 110, y, sz, { upper: true, wd: 87.5, ...ink }); y += (STACK[i + 1]?.[1] ?? 280) * 0.92; });
  if (t > ME.s - 0.2) kword(ME, t, 110, y, 300, { upper: true, wd: 125, pre: 0.2, ...ink });
  mono(t < 162.9 ? 'drums: 0 · motion: 0' : 'drums: 1', 70, H - 70, 20, C.lav, 0.7);
}

// =====================================================================
// 164.8–167.3 炸开：前面所有的东西一起回来围着她转（点、珠子、三只眼、鸟、房间、mine 的线、hehe、数字），橙色第一次铺满下半屏
// =====================================================================
const ICONS = ['dot', 'bead', 'eyeP', 'eyeG', 'eyeB', 'bird', 'room', 'mine', 'hehe', '4', 'seed', 'door'];
function sBloom(t) {
  bg(C.ink, C.ink);
  const u = t - ME.s, g = ctx.createLinearGradient(0, H * 0.35, 0, H); g.addColorStop(0, rgba(C.orange, 0)); g.addColorStop(1, rgba(C.orange, 0.75 * smooth(0, 0.6, u))); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const ring = outExpo(u / 0.8) * 1400; ctx.strokeStyle = rgba(C.orange, 1 - smooth(0, 0.8, u)); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, H * 0.48, ring, 0, 6.2832); ctx.stroke();
  const st = stage(5, ...MID_EYE, W / 2, H * 0.4), [gx, gy] = at(st, 'girl');
  girl(ctx, gx, gy + hop(t, 5), 5, { eyes: 'wide', mouth: 'smile' });
  ICONS.forEach((k, i) => {
    const t0 = ME.s + i * SIXTEENTH * 0.5; if (t < t0) return;
    const p = outBack((t - t0) / 0.3), a = (i / ICONS.length) * 6.2832 + u * 0.7, R = (430 + 90 * (i % 2)) * p, x = W / 2 + Math.cos(a) * R * 1.3, y = H * 0.46 + Math.sin(a) * R * 0.75;
    if (k === 'dot') spark(x, y, 4, C.bone); else if (k === 'bead') spark(x, y, 8, C.cyan);
    else if (k.startsWith('eye')) eyeShape(x, y, 110, 0.5, { eyeP: C.pink, eyeG: C.gold, eyeB: C.blue }[k]);
    else if (k === 'bird') birdShape(x, y, 26, t); else if (k === 'room') isoBox(x, y + 30, 34, rgba(C.bone), rgba(C.ink), 1, rgba(C.pink));
    else if (k === 'mine') { ctx.strokeStyle = rgba(C.lime); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 50, y + 20); ctx.lineTo(x + 50, y - 20); ctx.stroke(); }
    else mono(k === 'door' ? '[door]' : k, x, y + 10, 34, k === '4' ? C.pink : C.bone, 1, 'center', 500);
  });
  rgbSplit(14 * pulse(t, lastKick(t), 0.1));
  mono('everything, at once', 70, H - 70, 20, C.ink, 0.7);
}

// =====================================================================
// 167.3–178.7 岸（全曲最响）：shot4，镜头按小节换景别（停住 → 推一下）；海里睡着的光点一颗颗醒，越来越暖；LOOK 长音拉宽
// =====================================================================
const LOOK2 = word('look', 168.5), LITTLE2 = word('little', 174);
const SLEEPERS = Array.from({ length: 140 }, (_, i) => [hash(i * 5.1) * W * 0.72, H * (0.56 + 0.44 * Math.pow(hash(i * 2.7), 0.8)), 167.5 + Math.pow(hash(i * 9.3), 0.7) * 11]);
function sShore(t) {
  bg(C.ink, C.ink);
  const bi = DOWNBEATS.filter(d => d <= t && d > 167).length, z = 1 + [0, 0.06, 0.12, 0.04, 0.1, 0.16][bi % 6] + 0.02 * smooth(lastBeat(t), lastBeat(t) + 0.4, t);
  const look = t > LOOK2.s - 0.3 && t < LITTLE2.s - 0.3;   // Look back at the sea 用回望海面那张（shot4），其余是岸边奔跑（shot14）
  if (look) zoomAt('shot4', z, W * 0.7, H * 0.4); else zoomAt('shot14', z, W * 0.3, H * 0.6);
  const warm = smooth(167.3, 178.6, t);
  for (const [x, y, tw] of SLEEPERS) { const on = t > tw, k = on ? 0.5 + 0.5 * pulse(t, lastBeat(t), 0.2) : 0.15, dx = on ? (t - tw) * 60 : 0; ctx.fillStyle = rgba(on ? mixc(C.cyan, C.orange, warm) : C.lav, k); const s = on ? 5 : 3; ctx.fillRect(x + dx - s / 2, y - s / 2, s, s); }
  const [sx0, sy0] = look ? [W * 0.42, H * 0.36] : [W * 0.72, H * 0.54], g = ctx.createRadialGradient(sx0, sy0, 0, sx0, sy0, W * 0.7); g.addColorStop(0, rgba(C.orange, 0.35 * warm)); g.addColorStop(1, rgba(C.orange, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  corrupt(t, 0.35, 11);
  if (!(t > LOOK2.s - 0.4 && t < LOOK2.e + 0.4)) lyricBlock(t, 167, 178.6, 110, 170, { size: 66, maxW: 900 });
  if (t > LOOK2.s - 0.1 && t < LOOK2.e + 0.4) kword(LOOK2, t, 110, 330, 200, { upper: true, wd: lerp(62, 125, inOutCubic(wp(LOOK2, t))), pre: 0.01 });
  rgbSplit(8 * pulse(t, lastKick(t), 0.08));
  mono(`lights awake: ${SLEEPERS.filter(s => t > s[2]).length} / ${SLEEPERS.length}`, 70, H - 70, 20, C.lav, 0.7);
}

// =====================================================================
// 178.7–182.2「Wave goodbye」：shot5 挥手。横条按拍子错位（RGB 故障），goodbye 长音拉宽
// =====================================================================
const GOODBYE = word('goodbye', 178.9);
function sWave(t) {
  bg(C.ink, C.ink);
  shot(ctx, 'shot5', { z: 1 + 0.05 * smooth(178.6, 182.2, t) }); corrupt(t, 0.25, 12);
  const g = ctx.createRadialGradient(W * 0.7, H * 0.3, 0, W * 0.7, H * 0.3, W * 0.8); g.addColorStop(0, rgba(C.orange, 0.25)); g.addColorStop(1, rgba(C.orange, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  sliceShift(t, 8, 120 * pulse(t, lastKick(t), 0.15), H * 0.25, H * 0.8, 3);
  kword(word('wave', 178.6), t, W - 110, 220, 150, { upper: true, align: 'right', wd: 100, pre: 0.1 });
  kword(GOODBYE, t, W - 110, 380, 150, { upper: true, align: 'right', wd: lerp(62, 112.5, inOutCubic(wp(GOODBYE, t))), pre: 0.1 });
  rgbSplit(10 * pulse(t, lastKick(t), 0.1));
}

// =====================================================================
// 182.2–189.5「Run into the sun / Hi / Hi」：推进太阳，橙铺满整屏（全片唯一的满屏暖色）；第二声 Hi：她回头冲镜头眨眼；黑
// =====================================================================
const [RUN2, SUN2] = seq(182, 'run', 'sun'), HIS = WORDS.filter(w => w.k === 'hi' && w.s > 183), END_CUT = DOWNBEATS.find(d => d > 186.9) ?? 187.5;
function sSun(t) {
  if (t >= END_CUT) { bg(C.ink, C.ink); return; }
  bg(C.ink, C.ink);
  const u = inExpo((t - RUN2.s) / (SUN2.e - RUN2.s + 0.1)), z = 1 + 5 * u;
  zoomAt('shot14', z, W * 0.72, H * 0.54); corrupt(t, 0.3 * (1 - u), 13);
  const fill = smooth(SUN2.s - 0.2, SUN2.e, t); ctx.fillStyle = rgba(C.orange, fill); ctx.fillRect(0, 0, W, H);
  if (t < HIS[1].s - 0.05) { lyricBlock(t, 182, 183.65, 110, 200, { size: 80, cool: C.ink, dimCol: C.ink }); if (t > HIS[0].s) mono('hi', W / 2, H / 2, 40, C.ink, 1, 'center', 500); return; }
  const st = stage(12, ...MID_EYE, W * 0.42, H * 0.46), [gx, gy] = at(st, 'girl');
  girl(ctx, gx, gy, 12, { eyes: t > HIS[1].s + 0.5 && t < HIS[1].s + 0.68 ? 'blink' : 'open', mouth: 'smile' });
  kword(HIS[1], t, W - 130, H * 0.62, 320, { upper: true, align: 'right', wd: 125, pre: 0.02, cool: C.ink, sung: C.ink });
}

const SECTIONS = [[0, sVoid], [4.25, sZero], [7.95, sSea], [14.55, sBeads], [20.7, sEyes], [28.3, v2], [GO.s - 0.02, sSlate], [58.95, sPlay], [R_START, sReprise], [RUN_START, sRun], [96.9, sDance], [ROLL.s - 0.12, sBuild], [WINDOW1.s - 0.6, sWindows], [141.5, sTunnel], [NOTHING3.s - 0.4, sFreeze], [ME.s, sBloom], [167.3, sShore], [178.6, sWave], [RUN2.s - 0.06, sSun]];
const SECTION_CUTS = SECTIONS.slice(1).map(s => s[0]);

// ---------- 一个子帧 ----------
function scene(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  let f = SECTIONS[0][1]; for (const [t0, fn] of SECTIONS) if (t >= t0) f = fn;
  f(t);
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
  CUTS.forEach(c => fl(c, C.bone, 0.3)); SECTION_CUTS.forEach(c => fl(c, C.bone, 0.18)); fl(LIGHTS.s, C.bone, 0.3); fl(ME.s, C.white, 0.9); fl(GIRL.s, C.orange, 0.35); fl(WAKE.s, C.bone, 0.4);
  // 线冲过来之前：曝光一开一关，亮帧越来越短（4 → 3 → 2 → 1 → 1 帧），落地那一帧全白（参考库 Halo 4 片头 0:47–0:51 / 1:33）
  for (const [off, nf] of [[-0.56, 4], [-0.36, 3], [-0.22, 2], [-0.13, 1], [-0.07, 1]]) { const a = CUT_C + off; if (t >= a && t < a + nf / FPS) { out.fillStyle = rgba(C.bone, 0.22); out.fillRect(0, 0, W, H); } }
  fl(CUT_C, C.white, 0.85);
  out.font = '14px A1Mono, Consolas, monospace'; out.textAlign = 'right'; out.fillStyle = 'rgba(246,242,252,0.35)';
  out.fillText(`CLEAN SLATE · 她睁眼 · animator1 · 全片 v1 · t = ${t.toFixed(2)}`, W - 40, H - 30);
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
await loadShots();
await document.fonts.load('900 100px A1Archivo'); await document.fonts.load('expanded 900 100px A1Archivo'); await document.fonts.load('500 20px A1Mono'); await document.fonts.load('400 20px A1Mono');
const ui = document.getElementById('ui');
if (RENDER) {
  ui.remove();
  const n = Math.round((T1 - T0) * FPS), dst = Q.get('out') ?? '-5_Clean Slate/样片/全片_v1_animator1.mp4';
  await fetch(`/start?w=${W}&h=${H}&fps=${FPS}&t0=${T0}&t1=${T1}&vflip=0&out=${encodeURIComponent(dst)}`, { method: 'POST' });
  for (let i = 0; i < n; i++) {
    draw(T0 + i / FPS);
    const buf = out.getImageData(0, 0, W, H).data;
    for (let k = 0; ; k++) { try { await fetch('/frame?i=' + i, { method: 'POST', body: buf }); break; } catch (e) { if (k > 20) throw e; await new Promise(r => setTimeout(r, 300)); } }
  }
  await fetch(Q.has('quit') ? '/done?quit=1' : '/done', { method: 'POST' }); log('render done', n);   // 分段渲染（render_segments.sh）时服务器要一直开着
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
