// Clean Slate · 「她睁眼」animator1（28.3–43.8 s）—— 学 pdoom-video 的手法（只学手法，图形 / 文字自己的）：
// ① 每帧 = 歌曲时间 t 的纯函数；导出时一帧 = 快门内 SAMPLES 个子帧的平均 → 真运动模糊（pdoom 的 sub-frame 采样）。
//    抖动 / 颗粒这类「每帧变一次」的东西用 frameIdx(t)，不用连续 t，否则子帧之间会糊成灰。
// ② 词按内容查，不写死时间；逐词卡拉 OK：提前 0.4 s 暗显，唱到哪亮到哪，绝不抢跑。
// ③ 字是画面的一部分，每个镜头换一种「字长在哪」：贴在网层上 / 挂在方向线上 / 立在海平线上 / 长在星星旁。
// ④ 一根贯穿全段的母题：她的光点（青）。穿网 → 千条方向里选中一条 → 顺着线冲过来 → 聚成她 → 睁眼。
// ⑤ 颜色克制：青 = 她的线，品红 = 正在唱的词，酸性黄绿只属于「mine」那一刻，橙只属于睁眼那一下。
// ⑥ 硬切落在词头 / 强拍；动作「停住 → 猛冲」（outExpo），不做飘的屏保运动；拉长的音用字宽轴拉长（WIDE 真的变宽）。
import { drawCyberGirl, blitGirl, SIZE } from '../cybergirl.js';

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

// ---------- 她（cybergirl.js 不改，只在外面缓存一层） ----------
const GIRL_CACHE = new Map();
function girlImg(eyes, mouth = 'flat', sway = 0, glowv = 1) {
  const key = `${eyes}|${mouth}|${sway}|${glowv > 0.5 ? 1 : 0}`;
  if (!GIRL_CACHE.has(key)) {
    const src = drawCyberGirl({ eyes, mouth, sway, glow: glowv, hud: 0 });
    const c = document.createElement('canvas'); c.width = SIZE[0]; c.height = SIZE[1]; c.getContext('2d').drawImage(src, 0, 0);
    GIRL_CACHE.set(key, c);
  }
  return GIRL_CACHE.get(key);
}
// 聚成人形用：闭眼那张图的每个不透明像素
const PIX = (() => {
  const c = girlImg('closed', 'flat', 0, 0), d = c.getContext('2d').getImageData(0, 0, SIZE[0], SIZE[1]).data, a = [];
  for (let y = 0; y < SIZE[1]; y++) for (let x = 0; x < SIZE[0]; x++) { const i = (y * SIZE[0] + x) * 4; if (d[i + 3] > 0) a.push([x, y, `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`, hash(a.length * 3.7 + 1)]); }
  return a;
})();

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
// C · 36.06–39.92「Brand new girl. At the edge of the game…」：线冲到中心 → 像素聚成她 → girl 时睁眼。
// =====================================================================
const HORIZON = H * 0.6;
const GX = W / 2 - 300, GY = 300, GPX = 3;   // 她：3 倍像素，胸像
// 海：透视点阵；圈从她脚下往外亮
function sea(t, rings, oy = 0) {
  const cols = 64, rows = 30;
  for (let r = 1; r <= rows; r++) {
    const z = 1 + r * r * 0.06, sy = HORIZON + oy + 420 / z;
    if (sy > H + 10) continue;
    for (let c = -cols / 2; c <= cols / 2; c++) {
      const wx = c * 1.6, sx = W / 2 + (wx * 260) / z;
      if (sx < -10 || sx > W + 10) continue;
      const dist = Math.hypot(wx, z * 1.3);
      let b = 0.16 + 0.06 * Math.sin(c * 1.7 + r * 2.3 + t * 2);
      let col = C.lav;
      for (const [t0, v, colR, amp] of rings) {
        if (t < t0) continue;
        const front = v * (t - t0), e = Math.exp(-((dist - front) ** 2) / 1.6) * amp * Math.pow(0.5, (t - t0) / 0.9);
        if (e > 0.02) { b += e; col = mixc(col, colR, e * 1.5); }
      }
      const s = Math.max(1.5, 7 / Math.sqrt(z)) * (1 + clamp(b - 0.3) * 0.8);
      ctx.fillStyle = rgba(mixc(C.violet, col, b), clamp(b)); ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
  }
}
const ringsC = () => {
  const r = [[GIRL.s, 16, C.orange, 1.6]];   // 橙：只这一下
  BEATS.filter(b => b > GIRL.s + 0.2 && b < CUT_D + 0.1).forEach((b, i) => r.push([b, 14, i % 2 ? C.pink : C.cyan, 0.8]));
  return r;
};
function girlState(t) {
  const bi = beatIdx(t), sway = Math.round(2 * Math.sin((bi % 4) * 1.5708 + (t - lastBeat(t)) * 3)) / 2;
  return { sway, bob: -8 * pulse(t, lastBeat(t), 0.1) };
}
function shotC(t) {
  bg(C.ink, C.night);
  const shake = 18 * pulse(t, GIRL.s, 0.08) + 8 * pulse(t, CUT_C, 0.06);
  const fi = frameIdx(t);
  ctx.save(); ctx.translate((hash(fi) - 0.5) * shake, (hash(fi + 50) - 0.5) * shake);
  sea(t, ringsC());
  // 海平线 = 「the edge」：唱到 edge 时亮成青色
  const eg = pulse(t, EDGE.s, 0.25);
  ctx.strokeStyle = rgba(mixc(C.lav, C.cyan, eg), 0.35 + 0.6 * eg); ctx.lineWidth = 1.2 + 2 * eg; ctx.beginPath(); ctx.moveTo(0, HORIZON); ctx.lineTo(W, HORIZON); ctx.stroke();
  // 上一镜头那根线从右下冲出画 → 这里从左上角砸进来（画面方向连贯）
  const hit = outExpo((t - CUT_C) / 0.12), fade = 1 - smooth(CUT_C + 0.15, CUT_C + 0.5, t);
  const IX = W / 2, IY = GY + 150 * GPX;
  if (fade > 0) {
    ctx.strokeStyle = rgba(C.lime, fade); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-40, -40); ctx.lineTo(lerp(-40, IX, hit), lerp(-40, IY, hit)); ctx.stroke();
  }
  // 聚成人形：像素从撞击点飞到各自位置（运动模糊会把它们拖成线）
  const T_ASM = CUT_C + 0.08, { sway, bob } = girlState(t);
  if (t < T_ASM + 0.62) {
    for (const [x, y, col, h] of PIX) {
      const tx = GX + x * GPX, ty = GY + y * GPX, d = Math.hypot(tx - IX, ty - IY) / 700;
      const u = outExpo((t - T_ASM - 0.25 * h * d) / (0.22 + 0.25 * h));
      if (u <= 0) continue;
      const ang = h * 40, fl = 180 * (1 - u) * h;
      ctx.fillStyle = col; ctx.fillRect(lerp(IX, tx, u) + Math.cos(ang) * fl, lerp(IY, ty, u) + Math.sin(ang) * fl, GPX, GPX);
    }
  } else {
    const eyes = t < GIRL.s ? 'closed' : t < GIRL.s + 0.3 ? 'wide' : 'open';
    blitGirl(ctx, girlImg(eyes, t > 38.4 ? 'smile' : 'flat', sway, t < GIRL.s ? 0 : 1), GX, GY + bob, GPX);
  }
  spark(IX, IY, 10 * (1 - smooth(CUT_C, CUT_C + 0.3, t)), C.cyan, 1 - smooth(CUT_C, CUT_C + 0.3, t));
  // 睁眼那一下：眼睛位置闪一道橙
  if (t >= GIRL.s) { const k = pulse(t, GIRL.s, 0.1); for (const ex of [86, 116]) spark(GX + ex * GPX, GY + 98 * GPX + bob, 14 * k, C.orange, k); }
  // BRAND / NEW：一词一锤，长音时字宽拉开
  kword(BRAND, t, GX - 20, 470, 150, { upper: true, align: 'right', wd: lerp(62, 100, outExpo(wp(BRAND, t))), pre: 0.15 });
  kword(NEW, t, GX + 600 + 20, 470, 150, { upper: true, wd: lerp(62, 112, outExpo(wp(NEW, t))), pre: 0.15 });
  kword(GIRL, t, W / 2, 1010, 200, { upper: true, align: 'center', wd: 125, pre: 0.2 });
  // 「at the edge of the game, never been here, but I don’t wanna wait.」：打字一样立在海平线上
  let x = 110, row = 0;
  EDGE_PHRASE.forEach(w => {
    if (w.k === 'never') { x = W / 2 + 330; row = 0; }
    if (t < w.s - 0.05) return;
    const y = HORIZON - 18 + row * 38, s = w.k === 'edge' || w.k === 'wait' ? 40 : 30;
    const age = t - w.s, col = age < 0.06 ? C.white : t < w.e ? C.pink : mixc(C.pink, C.bone, (t - w.e) / 0.3);
    mono(w.w, x, y, s, col, 1, 'left', 500);
    ctx.font = `500 ${s}px A1Mono, Consolas, monospace`; x += ctx.measureText(w.w + ' ').width;
    if (x > W / 2 - 330 && row === 0 && x < W / 2) { x = 110; row = 1; }
  });
  ctx.restore();
  mono(t < GIRL.s ? 'boot · weights loaded · eyes: closed' : 'boot ok · eyes: open · hello', 96, H - 96, 22, t < GIRL.s ? C.lav : C.cyan, 0.85);
}

// =====================================================================
// D · 39.92–41.36「Eyes wide open.」：眼睛大特写，虹膜里映着那片海。WIDE 唱多长字就拉多宽。
// =====================================================================
function shotD(t) {
  bg(C.ink, C.ink);
  const u = (t - CUT_D) / (CUT_E - CUT_D), px = lerp(11, 12.5, u) + 1.2 * outExpo((t - WIDE.s) / 0.3);
  const eyes = t < EYES.s ? 'half' : t < WIDE.s ? 'open' : 'wide';
  const ox = W / 2 - 101 * px, oy = H * 0.52 - 98 * px;
  blitGirl(ctx, girlImg(eyes, 'flat', 0, 1), ox, oy, px);
  // 虹膜里的海：三圈小点，按拍子一圈圈亮
  const h = eyes === 'half' ? 4 : 7;
  for (const ex of [86.5, 115.5]) {
    const cx = ox + ex * px, cy = oy + 99 * px;
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, 6 * px, Math.min(h, 7.5) * px, 0, 0, 6.2832); ctx.clip();
    for (let ring = 1; ring <= 3; ring++) {
      const n = 10 + ring * 6, rr = ring * 1.6 * px, lit = pulse(t, lastBeat(t) + ring * 0.05, 0.18);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 6.2832 + t * 0.3 * (ring % 2 ? 1 : -1);
        ctx.fillStyle = rgba(k % 3 ? C.cyan : C.white, 0.35 + 0.6 * lit); ctx.fillRect(cx + Math.cos(a) * rr - 3, cy + Math.sin(a) * rr * 0.8 - 3, 6, 6);
      }
    }
    ctx.restore();
  }
  // 字压在头发上：头发是亮蓝，字用墨色（不加描边 / 光晕，pdoom 的规矩）
  const inkT = { dimCol: C.ink, dim: 0.3, cool: C.ink };
  let x = 350;
  x += kword(EYES, t, x, 220, 150, { ...inkT, upper: true, wd: 87.5 }) + 36;
  kword(WIDE, t, x, 220, 150, { ...inkT, upper: true, wd: lerp(62, 125, inOutCubic(wp(WIDE, t))) });
  kword(OPEN, t, 1640, 1030, 150, { upper: true, align: 'right', wd: 100 });   // 右下是暗紫的发梢：这里用骨白
  mono(`eyes: ${eyes} · fov ${(60 + 60 * outExpo((t - WIDE.s) / 0.3)).toFixed(0)}°`, 96, H - 96, 22, C.cyan, 0.8);
}

// =====================================================================
// E · 41.36–43.8「The sea’s lighting up, every little star says wake.」：拉远，海一圈圈亮；五个词各挂一颗星。
// =====================================================================
const STARS = STAR_PHRASE.map((w, i) => [W * (0.14 + 0.18 * i) + 40 * Math.sin(i * 2.1), H * (0.7 + 0.09 * ((i * 3) % 4) / 3)]);
function shotE(t) {
  bg(C.ink, C.night);
  const pull = outExpo((t - CUT_E) / 0.5);
  const rings = BEATS.filter(b => b >= CUT_E - 0.05 && b < T1 + 0.1).map((b, i) => [b, 16, i % 2 ? C.pink : C.cyan, 1]);
  rings.push([WAKE.s, 22, C.bone, 1.4]);
  sea(t, rings, 40);
  // 她小一点，浮在海平线上
  const px = lerp(3.2, 2, pull), { sway, bob } = girlState(t);
  const gx = W / 2 - 100 * px, gy = HORIZON + 40 - 190 * px;
  blitGirl(ctx, girlImg(t > WAKE.s ? 'wide' : 'open', 'smile', sway, 1), gx, gy + bob, px);
  const fade = ctx.createLinearGradient(0, HORIZON - 60, 0, HORIZON + 110); fade.addColorStop(0, 'rgba(12,9,30,0)'); fade.addColorStop(1, rgba(C.night));
  ctx.fillStyle = fade; ctx.fillRect(gx - 10, HORIZON - 60, 200 * px + 20, 300);
  // 「The sea’s lighting up,」左上，瑞士式两行
  let x = 110;
  ctx.save(); ctx.globalAlpha = 1 - smooth(WAKE.s - 0.3, WAKE.s, t);
  SEA_PHRASE.forEach((w, i) => { if (i === 2) x = 110; x += kword(w, t, x, i < 2 ? 210 : 330, 110, { wd: w.k === 'lighting' ? lerp(87.5, 125, wp(w, t)) : 87.5 }) + 28; });
  ctx.restore();
  // 五颗星，各挂一个词：唱到就亮，引线连到 mono 标签
  STAR_PHRASE.forEach((w, i) => {
    if (t < w.s - 0.4) return;
    const [sx, sy] = STARS[i], on = t >= w.s, k = on ? 0.6 + 0.4 * pulse(t, w.s, 0.2) : 0.25;
    if (on) { ctx.strokeStyle = rgba(C.bone, 0.9 * k); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx - 24 * k, sy); ctx.lineTo(sx + 24 * k, sy); ctx.moveTo(sx, sy - 24 * k); ctx.lineTo(sx, sy + 24 * k); ctx.stroke(); }
    spark(sx, sy, 4 + 6 * k, i % 2 ? C.pink : C.cyan, k);
    ctx.strokeStyle = rgba(C.lav, 0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy - 30); ctx.lineTo(sx, sy - 90); ctx.lineTo(sx + 20, sy - 90); ctx.stroke();
    kword(w, t, sx + 28, sy - 80, w === WAKE ? 64 : 40, { wght: 500, wd: 100, dim: 0.4 });
    mono(`★ ${String(i + 1).padStart(2, '0')}`, sx + 28, sy - 52, 16, C.lav, 0.7);
  });
  // wake：最后一锤，全场大字
  if (t > WAKE.s - 0.05) kword(WAKE, t, W / 2, H * 0.36, 260 * lerp(0.85, 1, outBack((t - WAKE.s) / 0.25)), { upper: true, align: 'center', wd: 125, pre: 0.05 });
  mono('stars awake: ' + STAR_PHRASE.filter(w => t >= w.s).length + ' / ∞', 96, H - 96, 22, C.cyan, 0.8);
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
  const n = Math.round((T1 - T0) * FPS), dst = Q.get('out') ?? '-5_Clean Slate/样片/风格小样_她睁眼_animator1.mp4';
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
