// Clean Slate · 「Now I can walk, now I can run … no fall at all」81.3–89.1 s · animator1 小样 v1
// 照 Leo 对全片 v1 的反馈（_反馈/Leo_反馈_全片v1.md）：
//   · 长镜头是她的时候她一定在动 → Seedream 出 5 种动作（走 / 跑 / 飞跃 / 翻滚下坠 / 落地，素材/生成_动作_a1/），
//     按拍子换姿势（动画的「一拍一张」），身体本身再加起伏、挤压、旋转。
//   · 85 s 的跳跃帧做成「agent 在各个 domain 之间穿梭」：编辑器（代码）→ 音轨（DAW）→ 工作流节点图 → 一路摔穿几层数据 → 落在节拍格上。
//     每个 domain 用一扇窗的边框隔开，她穿过边框的那一刻正好在拍子上。
//   · 鼓点不推全局抖动：每个运动都有指向 —— 镜头跟着她跑（向右）、摔下去（向下）、落地往下一沉再回弹；碎片只往一个方向飞。
//   · 符号说真话：音轨里的波形就是这首歌的 kick / bass 包络，人声轨的方块就是歌词的真实时长，标尺是真的小节号，BPM 125。
// 参考库里新试的手法：
//   · 前方「还没加载完」：画面右边按距离分三档马赛克（24 / 12 / 6 px），越靠近她越清楚 —— 方块大小 = 加载进度（_参考_Short #1）。
//   · 撞击 = 1 帧白 + 1 帧反相异物帧，不抖镜头（分析_参考片.md「我们能学的」2）；碎片两极化：尘埃 + 整条扫描条，没有中等碎片（3）；只往一个方向飞（4）。
// 规则照旧：每帧 = 歌曲时间 t 的纯函数，导出时一帧 = 快门内 SAMPLES 个子帧的平均（运动模糊）；颗粒按帧号取值。

const Q = new URLSearchParams(location.search);
const RENDER = Q.has('render');
const T0 = +(Q.get('t0') ?? 80.9), T1 = +(Q.get('t1') ?? 89.6), FPS = +(Q.get('fps') ?? 30);
const SAMPLES = +(Q.get('samples') ?? (RENDER ? 6 : 1)), SHUTTER = +(Q.get('shutter') ?? 0.5);
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
const lod = document.createElement('canvas'); lod.width = W; lod.height = H;
const lctx = lod.getContext('2d');

// ---------- 工具 ----------
function clamp(x, a = 0, b = 1) { return x < a ? a : x > b ? b : x; }
const lerp = (a, b, u) => a + (b - a) * u;
const hash = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const outExpo = u => (u = clamp(u)) >= 1 ? 1 : 1 - Math.pow(2, -10 * u);
const inExpo = u => (u = clamp(u)) <= 0 ? 0 : Math.pow(2, 10 * u - 10);
const inOut = u => { u = clamp(u); return u * u * (3 - 2 * u); };
const outBack = (u, s = 1.7) => { u = clamp(u) - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
const pulse = (t, t0, hl) => t < t0 ? 0 : Math.pow(0.5, (t - t0) / hl);
const spring = (u, w) => u <= 0 ? 0 : Math.exp(-w * u * 0.6) * Math.sin(w * u);   // 落地回弹：先沉后弹，越来越小
const frameIdx = t => Math.round((t - T0) * FPS);

// ---------- 颜色（和全片 v1 同一套；一个颜色只属于一件事） ----------
const C = {
  ink: [12, 9, 30], night: [20, 15, 52], indigo: [30, 22, 92], violet: [86, 56, 190], lav: [176, 160, 236],
  bone: [246, 242, 252], white: [255, 255, 255], pink: [255, 61, 154], cyan: [61, 224, 255], lime: [214, 255, 74], orange: [255, 138, 42],
};
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const ARCH = (s, wt = 900) => `${wt} ${s}px A1Archivo, "Arial Black", sans-serif`;
const MONO = (s, wt = 400) => `${wt} ${s}px A1Mono, Consolas, monospace`;
function mono(s, x, y, size, col, a = 1, align = 'left', wt = 400) { ctx.font = MONO(size, wt); ctx.textAlign = align; ctx.fillStyle = rgba(col, a); ctx.fillText(s, x, y); }

// ---------- 数据（按内容查词，不写死秒数） ----------
const WORDS = (await (await fetch('../words.json')).json()).map(([w, s, e]) => ({ w: w.replace(/'/g, '’'), s, e, k: w.toLowerCase().replace(/[^a-z']/g, '') }));
const AUD = await (await fetch('../audio.json')).json();
const BEATS = AUD.beats, DOWN = AUD.downbeats;
const env = (k, t) => AUD[k][clamp(Math.floor(t * AUD.fps), 0, AUD[k].length - 1)];
const word = (k, after) => { const w = WORDS.find(x => x.k === k && x.s >= after); if (!w) throw new Error('word? ' + k); return w; };
const beatAfter = t => BEATS.find(b => b >= t - 0.02);
const lastBeat = t => { let b = BEATS[0]; for (const x of BEATS) if (x <= t) b = x; return b; };
const BEAT = BEATS[BEATS.findIndex(b => b > 85) + 1] - BEATS[BEATS.findIndex(b => b > 85)];   // ≈ 0.48 s，125 BPM

const NOW = word('now', 81), WALK = word('walk', 81.5), RUN = word('run', 82.5), COUNT = word('count', 83), FOUR = word('four', 83.5);
const CHASING = word('chasing', 84), SUN = word('sun', 84.5), EVERY = word('every', 85), MISTAKE = word('mistake', 85), DOOR = word('door', 85.5);
const NOT = word('not', 86), WALL = word('wall', 86.5), FALL = word('fall', 87), BEATW = word('beat', 87.5), FALL2 = word('fall', 88), ALL = word('all', 88.8);
// 关键拍（都从 audio.json 的拍点里取）
const B_CROSS1 = beatAfter(COUNT.s);          // 进音轨
const COUNT4 = [0, 1, 2, 3].map(i => BEATS[BEATS.indexOf(B_CROSS1) + i]);   // count to four：连续四拍
const B_CROSS2 = beatAfter(MISTAKE.s);        // 进工作流节点图（同一拍错误框砸下来）
const LEAP = MISTAKE.e;                        // 起跳
const B_DOOR = beatAfter(DOOR.s);             // 门开
const B_THRU = BEATS[BEATS.indexOf(B_DOOR) + 1];   // 穿过门
const B_FALL = FALL.s;                         // 开始摔
const CRASH = [beatAfter(BEATW.s), beatAfter(BEATW.s + 0.3)];   // 摔穿两层
const B_LAND = BEATS[BEATS.indexOf(CRASH[1]) + 1];                // 落在节拍格上
const B_LOOK = BEATS[BEATS.indexOf(B_LAND) + 1];                  // 抬头笑

// ---------- 她：Seedream 的黑底动作图 → 抠图 → 裁边 → 按行数像素化 ----------
const POSE_DIR = '../../素材/生成_动作_a1/';
async function sprite(name, rows = 132) {
  const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = POSE_DIR + name + '.png'; });
  const w0 = im.width, h0 = im.height, c0 = document.createElement('canvas'); c0.width = w0; c0.height = h0;
  const g0 = c0.getContext('2d', { willReadFrequently: true }); g0.drawImage(im, 0, 0);
  const d = g0.getImageData(0, 0, w0, h0), px = d.data;
  // 黑底：从四边往里洪泛，只抠和边缘连通的暗色（她的黑外套被亮轮廓围住，不会被抠掉）
  const dark = i => Math.max(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) < 30;
  const seen = new Uint8Array(w0 * h0), st = [];
  for (let x = 0; x < w0; x++) st.push(x, (h0 - 1) * w0 + x);
  for (let y = 0; y < h0; y++) st.push(y * w0, y * w0 + w0 - 1);
  while (st.length) {
    const i = st.pop(); if (seen[i] || !dark(i)) continue; seen[i] = 1; px[i * 4 + 3] = 0;
    const x = i % w0, y = (i / w0) | 0;
    if (x > 0) st.push(i - 1); if (x < w0 - 1) st.push(i + 1); if (y > 0) st.push(i - w0); if (y < h0 - 1) st.push(i + w0);
  }
  // 脚下的青色地光不是她：低饱和的暗青、和人物分开的那一团也去掉（只留亮度够的）
  let x0 = w0, y0 = h0, x1 = 0, y1 = 0;
  for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) {
    const i = (y * w0 + x) * 4; if (!px[i + 3]) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (g > r * 1.6 && g > 70 && b > 120 && r < 60 && Math.max(r, g, b) < 170 && y > h0 * 0.55) { px[i + 3] = 0; continue; }   // 地光
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  g0.putImageData(d, 0, 0);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, h = rows, w = Math.round(bw * rows / bh);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high';
  g.filter = 'brightness(1.55) contrast(1.12) saturate(1.1)';   // 生成图偏暗，压在深色背景上要提一档
  g.drawImage(c0, x0, y0, bw, bh, 0, 0, w, h); g.filter = 'none';
  const dd = g.getImageData(0, 0, w, h); for (let i = 3; i < dd.data.length; i += 4) dd.data[i] = dd.data[i] > 120 ? 255 : 0; g.putImageData(dd, 0, 0);   // 硬边
  const sil = document.createElement('canvas'); sil.width = w; sil.height = h;
  const sg = sil.getContext('2d'); sg.drawImage(c, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#fff'; sg.fillRect(0, 0, w, h);
  return { img: c, sil, w, h };
}
const NAMES = ['walk_a', 'walk_b', 'walk_c', 'run_a', 'run_b', 'run_c', 'leap_a', 'leap_c', 'tumble_a', 'tumble_b', 'tumble_c', 'land_a', 'land_b'];
const SP = Object.fromEntries(await Promise.all(NAMES.map(async n => [n, await sprite(n)])));

// 画她：anchor = 'feet'（脚底中点对准 x,y）或 'center'；hgt = 屏幕上的身高（像素）
function drawGirl(name, x, y, hgt, o = {}) {
  const { anchor = 'feet', rot = 0, sx = 1, sy = 1, alpha = 1, rim = 0.55, block = 0 } = o;
  const s = SP[name], k = hgt / s.h, w = s.w * k, h = s.h * k;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, sy);
  const ox = -w / 2, oy = anchor === 'feet' ? -h : -h / 2;
  ctx.imageSmoothingEnabled = false; ctx.globalAlpha = alpha;
  // 青色边光：剪影往后错 1 格（像素风的描边，不用模糊）
  if (rim > 0) { ctx.globalAlpha = alpha * rim; ctx.filter = 'none'; tint(s.sil, C.cyan); ctx.drawImage(TINT, 0, 0, s.w, s.h, ox - k * 1.2, oy, w, h); ctx.globalAlpha = alpha; }
  if (block > 1) {   // 方块大小 = 出现进度：先缩到 block 分之一再放大
    const bw = Math.max(1, Math.round(s.w / block)), bh = Math.max(1, Math.round(s.h / block));
    BLK.width = bw; BLK.height = bh; const bg = BLK.getContext('2d'); bg.imageSmoothingEnabled = true; bg.clearRect(0, 0, bw, bh); bg.drawImage(s.img, 0, 0, bw, bh);
    ctx.drawImage(BLK, 0, 0, bw, bh, ox, oy, w, h);
  } else ctx.drawImage(s.img, ox, oy, w, h);
  ctx.restore(); ctx.imageSmoothingEnabled = true;
  return { x0: x + ox, y0: y + oy, w, h };
}
const TINT = document.createElement('canvas'), BLK = document.createElement('canvas');
function tint(src, col) { TINT.width = src.width; TINT.height = src.height; const g = TINT.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = rgba(col); g.fillRect(0, 0, src.width, src.height); }

// ---------- 镜头：水平速度（跑）→ 积分出 camX；竖直速度（摔）→ camY ----------
const G_X = W * 0.36, FLOOR_Y = H * 0.82, HGT = 600;
function speed(t) {
  if (t < NOW.s) return 0;
  let v = t < RUN.s ? 300 : 300 + 1300 * outExpo((t - RUN.s) / 0.4);
  if (t > B_THRU) v = lerp(1600, 380, inOut((t - B_THRU) / (B_FALL - B_THRU)));
  if (t > B_FALL) v = 260 * (1 - clamp((t - B_LAND) / 0.1));
  return v;
}
const vfall = t => t < B_FALL || t > B_LAND ? 0 : 500 + 2900 * inOut((t - B_FALL) / 0.45);
const DT = 0.001, TAB0 = 80, NTAB = 11000, CX = new Float64Array(NTAB), CY = new Float64Array(NTAB);
for (let i = 1; i < NTAB; i++) { const t = TAB0 + i * DT; CX[i] = CX[i - 1] + speed(t) * DT; CY[i] = CY[i - 1] + vfall(t) * DT; }
const look = (A, t) => { const f = clamp((t - TAB0) / DT, 0, NTAB - 2), i = Math.floor(f); return lerp(A[i], A[i + 1], f - i); };
const camX = t => look(CX, t), camY = t => look(CY, t);
// 世界里一个「她在 tb 时刻到达」的东西，在 t 时刻的屏幕 x
const aheadX = (tb, t, off = 0) => G_X + off + (camX(tb) - camX(t));

// =====================================================================
// domain A：编辑器 —— 她走在一行代码上；前面是灰色的补全建议（模型的预测），她踩过去就「提交」成亮字
// =====================================================================
const CODE = [
  'async function agent(goal) {', '  const plan = await think(goal);', '  for (const step of plan) {', '    const out = await tool(step);',
  '    if (out.error) retry(step);   // a door, not a wall', '    memory.push(out);', '  }', '  return walk(beat) ?? run(beat);', '}',
  'const bpm = 125, bar = 4 * 60 / bpm;   // 1.92 s', 'tracks.render({ from: 81.3, to: 89.1 });', 'sun.chase();  // orange, far right',
  'while (alive) step(beat);', 'export default { walk, run, fall: null };',
];
const FLOOR_CODE = 'now.walk();   now.run();   count(4);   chase(sun);   ';
function domEditor(t, ox) {
  ctx.fillStyle = rgba([10, 8, 26]); ctx.fillRect(0, 0, W, H);
  // 远：整屏代码（视差 0.25），行号槽
  ctx.font = MONO(20); ctx.textAlign = 'left';
  const p = ox * 0.25, colW = 760;
  for (let c = Math.floor(p / colW) - 1; c < Math.floor(p / colW) + 4; c++) {
    const x = c * colW - p + 90;
    for (let r = 0; r < 30; r++) {
      const s = CODE[(r + c * 5 + 140) % CODE.length], y = 40 + r * 30;
      ctx.fillStyle = rgba(C.violet, 0.28); ctx.fillText(String(r + 1 + c * 30).padStart(3, ' '), x - 60, y);
      ctx.fillStyle = rgba(s.includes('//') ? C.lav : C.violet, s.includes('//') ? 0.35 : 0.5); ctx.fillText(s, x, y);
    }
  }
  // 中：编辑器的标签页条（视差 0.6）
  const p2 = ox * 0.6;
  for (let k = Math.floor(p2 / 520) - 1; k < Math.floor(p2 / 520) + 5; k++) {
    const x = k * 520 - p2, name = ['agent.js', 'tools.py', 'tracks.daw', 'memory.json', 'sun.glsl'][(k % 5 + 5) % 5];
    ctx.fillStyle = rgba(C.indigo, 0.55); ctx.fillRect(x, 120, 300, 46); ctx.strokeStyle = rgba(C.lav, 0.25); ctx.strokeRect(x + 0.5, 120.5, 300, 46);
    mono(name, x + 20, 151, 20, C.lav, 0.6);
  }
  // 地面：一行大代码。她身后 = 已提交（亮），前面 = 补全建议（灰）
  ctx.font = MONO(54, 500); const cw = ctx.measureText('M').width, y = FLOOR_Y + 66;
  ctx.fillStyle = rgba(C.cyan, 0.5); ctx.fillRect(0, FLOOR_Y, W, 2);
  const i0 = Math.floor(ox / cw) - 2;
  for (let i = i0; i < i0 + W / cw + 4; i++) {
    const ch = FLOOR_CODE[((i % FLOOR_CODE.length) + FLOOR_CODE.length) % FLOOR_CODE.length], x = i * cw - ox;
    const done = x < G_X + 30;
    ctx.fillStyle = done ? rgba(C.bone, 0.92) : rgba(C.lav, 0.22); ctx.fillText(ch, x, y);
  }
  // 光标 = 她脚下（按帧号眨，不跟连续 t）
  if (frameIdx(t) % 16 < 10) { ctx.fillStyle = rgba(C.cyan, 0.9); ctx.fillRect(G_X + 32, y - 46, 5, 58); }
  // 脚印：每一步落地时在代码行上留一个光块，世界坐标固定
  for (const b of STEPS) if (b <= t && t - b < 1.2) { const x = aheadX(b, t, 10); ctx.fillStyle = rgba(C.cyan, 0.5 * (1 - (t - b) / 1.2)); ctx.fillRect(x - 30, FLOOR_Y - 3, 60, 6); }
}
const STEPS = [...BEATS.filter(b => b >= NOW.s && b < RUN.s), ...BEATS.filter(b => b >= RUN.s - 0.1 && b < 85.7).flatMap(b => [b, b + BEAT / 2])];

// =====================================================================
// domain B：音轨 —— 她就是播放头。五条轨的内容全是真的：人声 = 歌词时长，KICK / BASS = audio.json 的包络
// =====================================================================
const LANES = [['VOX', C.pink], ['KICK', C.cyan], ['BASS', C.violet], ['BEATS', C.lav], ['SUN', C.orange]];
const LANE_Y = 200, LANE_H = 108, PPS = 1600;   // 横向 1 s = 1600 px，正好等于她跑的速度：轨道和地面一起走
const xOfTime = (tau, t) => G_X + (tau - t) * PPS;
function domTracks(t, ox) {
  ctx.fillStyle = rgba([9, 7, 24]); ctx.fillRect(0, 0, W, H);
  // 标尺：小节.拍（第 1 拍 = 歌里第一个强拍）
  ctx.fillStyle = rgba(C.indigo, 0.8); ctx.fillRect(0, 130, W, 50);
  for (const b of BEATS) {
    const x = xOfTime(b, t); if (x < -40 || x > W + 40) continue;
    const bi = BEATS.indexOf(b), bar = DOWN.filter(d => d <= b + 0.01).length, isDown = DOWN.some(d => Math.abs(d - b) < 0.02);
    ctx.fillStyle = rgba(C.lav, isDown ? 0.7 : 0.3); ctx.fillRect(x, isDown ? 130 : 160, 2, isDown ? 50 : 20);
    if (isDown) mono(String(bar), x + 8, 162, 22, C.bone, 0.75, 'left', 500);
    ctx.fillStyle = rgba(C.violet, isDown ? 0.2 : 0.09); ctx.fillRect(x, LANE_Y, 1, LANE_H * LANES.length);
    void bi;
  }
  // 轨道
  LANES.forEach(([name, col], k) => {
    const y = LANE_Y + k * LANE_H;
    ctx.fillStyle = rgba(k % 2 ? [16, 12, 40] : [13, 10, 34]); ctx.fillRect(0, y, W, LANE_H);
    ctx.fillStyle = rgba(C.violet, 0.35); ctx.fillRect(0, y + LANE_H - 1, W, 1);
    if (name === 'VOX') for (const w of WORDS) {
      const x0 = xOfTime(w.s, t), x1 = xOfTime(w.e, t); if (x1 < 0 || x0 > W) continue;
      const on = t >= w.s; ctx.fillStyle = rgba(col, on ? 0.75 : 0.25); ctx.fillRect(x0, y + 14, Math.max(4, x1 - x0 - 3), LANE_H - 28);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y, Math.max(4, x1 - x0 - 3), LANE_H); ctx.clip(); mono(w.w, x0 + 8, y + 46, 22, on ? C.ink : C.bone, 0.9, 'left', 500); ctx.restore();
    }
    if (name === 'KICK' || name === 'BASS') {
      ctx.fillStyle = rgba(col, 0.85); const key = name.toLowerCase();
      for (let x = 0; x < W; x += 4) { const tau = t + (x - G_X) / PPS, v = env(key, tau); const hh = v * (LANE_H - 20); ctx.globalAlpha = x < G_X ? 0.9 : 0.4; ctx.fillRect(x, y + LANE_H / 2 - hh / 2, 3, Math.max(1, hh)); }
      ctx.globalAlpha = 1;
    }
    if (name === 'BEATS') for (const b of BEATS) { const x = xOfTime(b, t); if (x < -20 || x > W + 20) continue; const lit = COUNT4.includes(b) && t >= b; ctx.fillStyle = rgba(lit ? C.bone : col, lit ? 0.95 : 0.35); ctx.fillRect(x, y + 24, 26, LANE_H - 48); }
    if (name === 'SUN') { const x = xOfTime(SUN.s, t); ctx.fillStyle = rgba(col, t >= CHASING.s ? 0.8 : 0.3); ctx.fillRect(x, y + 14, W, LANE_H - 28); mono('sun.wav  ▸ ∞', x + 12, y + 46, 22, C.ink, 0.9, 'left', 500); }
  });
  // 轨道头（固定在左边，像 DAW）
  ctx.fillStyle = rgba([7, 5, 20], 0.94); ctx.fillRect(0, LANE_Y, 150, LANE_H * LANES.length);
  LANES.forEach(([name, col], k) => { const y = LANE_Y + k * LANE_H; ctx.fillStyle = rgba(col, 0.9); ctx.fillRect(0, y, 6, LANE_H - 1); mono(name, 22, y + 60, 22, C.bone, 0.85, 'left', 500); });
  // count to four：四个大数字长在时间轴上 —— 每个数字钉在自己那一拍的位置，在她脚下（播放头）弹出来，然后跟着轨道往后退
  COUNT4.forEach((b, i) => {
    if (t < b - 0.02) return; const u = outBack((t - b) / 0.22), x = xOfTime(b, t) + 60, y = LANE_Y + 3 * LANE_H + 40;
    ctx.save(); ctx.translate(x, y); ctx.scale(u, u); ctx.font = ARCH(i === 3 ? 150 : 110); ctx.textAlign = 'center'; ctx.fillStyle = rgba(i === 3 ? C.bone : C.lav, i === 3 ? 1 : 0.8); ctx.fillText(String(i + 1), 0, 0); ctx.restore();
  });
  // 地面：KICK 轨下沿就是她踩的地方 → 给一根亮线
  ctx.fillStyle = rgba(C.cyan, 0.45); ctx.fillRect(150, FLOOR_Y, W, 2);
  // 太阳：chasing the sun 时从右边地平线升起（橙 = 她的感觉，只在这里出现）
  const sun = inOut((t - CHASING.s) / 0.9);
  if (sun > 0) {
    const sx = W * 0.86, sy = lerp(FLOOR_Y + 140, FLOOR_Y - 150, sun);
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 420); g.addColorStop(0, rgba(C.orange, 0.55 * sun)); g.addColorStop(1, rgba(C.orange, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, FLOOR_Y); ctx.clip(); ctx.fillStyle = rgba(C.orange, 0.95 * sun); ctx.beginPath(); ctx.arc(sx, sy, 110, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 6; k++) { ctx.fillStyle = rgba([9, 7, 24]); ctx.fillRect(sx - 120, sy + 20 + k * 16, 240, 2 + k); }   // 落日条纹
    ctx.restore();
  }
}

// =====================================================================
// domain C：工作流节点图 —— agent 的一次 tool call 出错；错误框砸下来，被她当成门撞开
// =====================================================================
const NODES = ['goal', 'plan', 'search', 'write', 'test', '✕ error', 'retry', 'commit'];
function domGraph(t, ox) {
  ctx.fillStyle = rgba([10, 8, 28]); ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = rgba(C.violet, 0.12); ctx.lineWidth = 1;   // 点阵底
  const p0 = ox * 0.2; for (let x = -(p0 % 60); x < W; x += 60) for (let y = 30; y < H; y += 60) ctx.strokeRect(x, y, 1, 1);
  const p = ox * 0.5, sp = 420, q = Math.floor(t * 8);   // 节点内的数据包按 8 分音符跳格（状态量化，运动连续）
  for (let k = Math.floor(p / sp) - 1; k < Math.floor(p / sp) + 6; k++) {
    const name = NODES[((k % NODES.length) + NODES.length) % NODES.length], x = k * sp - p + 100, y = 260 + (k % 2 ? 160 : 0), err = name.startsWith('✕');
    const nx = (k + 1) * sp - p + 100, ny = 260 + ((k + 1) % 2 ? 160 : 0);
    ctx.strokeStyle = rgba(C.lav, 0.3); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 220, y + 40); ctx.bezierCurveTo(x + 320, y + 40, nx - 100, ny + 40, nx, ny + 40); ctx.stroke();
    const u = ((q + k * 3) % 6) / 6; ctx.fillStyle = rgba(C.cyan, 0.9); ctx.fillRect(lerp(x + 220, nx, u) - 4, lerp(y + 40, ny + 40, u) - 4, 8, 8);
    ctx.fillStyle = rgba(err ? [60, 12, 40] : C.indigo, 0.85); ctx.fillRect(x, y, 220, 80); ctx.strokeStyle = rgba(err ? C.pink : C.lav, err ? 0.9 : 0.45); ctx.strokeRect(x + 0.5, y + 0.5, 220, 80);
    mono(name, x + 20, y + 50, 26, err ? C.pink : C.bone, 0.9, 'left', 500);
  }
  ctx.fillStyle = rgba(C.cyan, 0.45); ctx.fillRect(0, FLOOR_Y, W, 2);
  for (let x = -((ox) % 80); x < W; x += 80) { ctx.fillStyle = rgba(C.lav, 0.3); ctx.fillRect(x, FLOOR_Y + 14, 30, 3); }
}
// 错误框 / 门（世界里固定在「她 B_THRU 时到达」的位置）
const DLG_W = 600, DLG_H = 760;
function errorDoor(t) {
  if (t < MISTAKE.s - 0.05 || t > B_FALL) return;
  const cx = aheadX(B_THRU, t, 70), drop = outExpo((t - MISTAKE.s) / 0.28), y = lerp(-DLG_H - 40, (H - DLG_H) / 2 - 30, drop);
  const open = outExpo((t - B_DOOR) / 0.45), gap = open * (DLG_W * 0.5 + 40);
  // 门里的光
  if (open > 0) {
    const g = ctx.createLinearGradient(cx - gap, 0, cx + gap, 0); g.addColorStop(0, rgba(C.cyan, 0)); g.addColorStop(0.5, rgba(C.white, 0.95 * open)); g.addColorStop(1, rgba(C.cyan, 0));
    ctx.fillStyle = g; ctx.fillRect(cx - gap, y, gap * 2, DLG_H);
  }
  const half = (side) => {   // side = -1 左扇 / +1 右扇
    const x = cx + side * gap - (side < 0 ? DLG_W / 2 : 0);
    if (x > W || x + DLG_W / 2 < 0) return;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, DLG_W / 2, DLG_H); ctx.clip();
    const bx = x - (side < 0 ? 0 : DLG_W / 2);   // 整个对话框的左边（两扇各画一半）
    ctx.fillStyle = rgba([34, 10, 34], 0.96); ctx.fillRect(bx, y, DLG_W, DLG_H);
    ctx.fillStyle = rgba(C.pink, 0.95); ctx.fillRect(bx, y, DLG_W, 56); mono('✕  mistake.js — error', bx + 22, y + 37, 24, C.ink, 1, 'left', 500);
    mono('Unexpected token', bx + 40, y + 150, 30, C.bone, 0.9, 'left', 500);
    ctx.font = ARCH(92); ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.pink); ctx.fillText('‘mistake’', bx + 36, y + 270);
    mono(`at beat ${(B_CROSS2).toFixed(2)} · bar ${DOWN.filter(d => d <= B_CROSS2 + 0.01).length}`, bx + 40, y + 330, 22, C.lav, 0.8);
    for (let r = 0; r < 8; r++) mono(`  at agent.step (tool.js:${85 + r * 7})`, bx + 40, y + 400 + r * 34, 20, C.lav, 0.45);
    ctx.strokeStyle = rgba(C.bone, 0.7); ctx.lineWidth = 2; ctx.strokeRect(bx + 60, y + DLG_H - 110, 200, 64); ctx.strokeRect(bx + DLG_W - 260, y + DLG_H - 110, 200, 64);
    mono('Retry', bx + 160, y + DLG_H - 68, 26, C.bone, 0.9, 'center', 500); mono(open > 0 ? 'Open ▸' : 'Ignore', bx + DLG_W - 160, y + DLG_H - 68, 26, open > 0 ? C.cyan : C.bone, 0.9, 'center', 500);
    ctx.restore();
    ctx.strokeStyle = rgba(C.pink, 0.9); ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, DLG_W / 2 - 3, DLG_H - 3);
  };
  if (t < B_THRU) { half(-1); half(1); }
  if (open > 0 && t < B_THRU + 0.05) mono('door', cx, y - 24, 30, C.cyan, open, 'center', 500);
}
// not a wall：两扇门碎掉，只往左飞（她往右冲，碎片被甩在身后）。尘埃 + 整条扫描条，没有中等大小的
const SHARDS = Array.from({ length: 90 }, (_, i) => {
  const strip = i < 12;
  return { strip, x: hash(i * 3.1) * DLG_W - DLG_W / 2, y: hash(i * 7.7) * DLG_H, w: strip ? 120 + hash(i * 1.3) * 380 : 3 + hash(i * 2.9) * 6, h: strip ? 4 + hash(i * 5.3) * 10 : 3 + hash(i * 4.1) * 6, v: 700 + hash(i * 9.1) * 1600, col: hash(i * 6.6) < 0.7 ? C.pink : C.bone };
});
function wallShards(t) {
  if (t < B_THRU || t > B_FALL + 0.6) return;
  const u = t - B_THRU, cx = aheadX(B_THRU, t, 70), y0 = (H - DLG_H) / 2 - 30;
  for (const s of SHARDS) {
    const x = cx + s.x - s.v * u * (1 + u), a = clamp(1 - u / 1.4);
    ctx.fillStyle = rgba(s.col, (s.strip ? 0.8 : 0.95) * a); ctx.fillRect(x, y0 + s.y + (s.strip ? 0 : -60 * u), s.w * (s.strip ? 1 + u : 1), s.h);
  }
}

// =====================================================================
// domain D：摔 —— 镜头转成竖直向下追她；几层 domain 的切片从下面冲上来，她在拍上一层层摔穿；最后落在节拍格上
// =====================================================================
const SLABS = [{ tb: CRASH[0], name: 'agent.js', kind: 'code' }, { tb: CRASH[1], name: 'tracks.daw', kind: 'wave' }];
const girlBottom = t => lerp(H * 0.62, FLOOR_Y, inOut((t - (B_LAND - 0.5)) / 0.5));
const slabY = (tb, t) => girlBottom(t) + (camY(tb) - camY(t));
function slab(t, s) {
  const y = slabY(s.tb, t); if (t > s.tb) return; if (y > H + 200 || y < -200) return;
  const x0 = -200, w = W + 400, hh = 90;
  ctx.fillStyle = rgba(C.indigo, 0.92); ctx.fillRect(x0, y, w, hh); ctx.fillStyle = rgba(C.cyan, 0.7); ctx.fillRect(x0, y, w, 2);
  if (s.kind === 'code') { ctx.font = MONO(30, 500); ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.lav, 0.75); let x = -120; for (let k = 0; x < W + 200; k++) { const s2 = CODE[(k + 2) % CODE.length].trim(); ctx.fillText(s2, x, y + 56); x += ctx.measureText(s2).width + 60; } }
  else { ctx.fillStyle = rgba(C.cyan, 0.8); for (let x = -200; x < W + 200; x += 5) { const v = env('kick', s.tb - 0.6 + x / PPS); ctx.fillRect(x, y + 45 - v * 36, 3, Math.max(1, v * 72)); } }
  mono(s.name, 40, y - 12, 22, C.bone, 0.8, 'left', 500);
}
// 摔穿的碎片：往上飞（她往下，碎片被甩在上面）
const DEBRIS = Array.from({ length: 80 }, (_, i) => ({ strip: i < 10, x: hash(i * 2.3 + 1) * W, w: i < 10 ? 160 + hash(i * 3.7) * 520 : 3 + hash(i * 1.9) * 7, h: i < 10 ? 5 + hash(i * 8.1) * 10 : 3 + hash(i * 4.4) * 6, v: 900 + hash(i * 5.5) * 1800 }));
function debris(t) {
  for (const s of SLABS) {
    const u = t - s.tb; if (u < 0 || u > 1.0) continue;
    const y0 = girlBottom(t) + (camY(s.tb) - camY(t));   // 碎片原本在板的位置（跟世界走）
    for (const d of DEBRIS) {
      const near = Math.abs(d.x - G_X) < 520 || d.strip; if (!near) continue;
      ctx.fillStyle = rgba(d.strip ? C.lav : C.cyan, (d.strip ? 0.7 : 0.95) * (1 - u)); ctx.fillRect(d.x + (d.x - G_X) * 0.4 * u, y0 - d.v * u * 0.6, d.w, d.h);
    }
  }
}
// 节拍格地面（16 格步进器）：落地前从下面冲上来；落地后每拍亮一格，落地那一拍冲击波沿地面往两边推
function beatFloor(t) {
  const y = t < B_LAND ? slabY(B_LAND, t) : FLOOR_Y + landDip(t); if (y > H + 50) return;
  ctx.fillStyle = rgba([8, 6, 22]); ctx.fillRect(-W, y, W * 3, H * 2);
  const cells = 16, cw = W / cells;
  const lit = t >= B_LAND ? Math.floor((t - B_LAND) / (BEAT / 2)) : -1;
  for (let i = 0; i < cells; i++) {
    const on = i === ((lit % cells) + cells) % cells && lit >= 0;
    ctx.fillStyle = rgba(on ? C.cyan : i % 4 === 0 ? C.violet : C.indigo, on ? 0.9 : 0.75); ctx.fillRect(i * cw + 4, y + 8, cw - 8, 70);
  }
  ctx.fillStyle = rgba(C.cyan, 0.85); ctx.fillRect(0, y, W, 3);
  mono('beat grid · 16 steps · 125 bpm', 40, y + 120, 22, C.lav, 0.7);
  if (t >= B_LAND) { const u = (t - B_LAND) / 0.6, r = outExpo(u) * W * 0.7; ctx.strokeStyle = rgba(C.bone, 0.8 * (1 - clamp(u))); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(G_X, y + 2, r, r * 0.06, 0, 0, Math.PI * 2); ctx.stroke(); }
}
const landDip = t => 26 * spring(t - B_LAND, 14);   // 落地：地面（= 镜头）先往下沉再弹回 —— 运动有方向：吸收冲击
function domFall(t) {
  // 背景：深色里一排排往上冲的速度线（只往一个方向）
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgba([8, 6, 22])); g.addColorStop(1, rgba(C.night)); ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3);   // 镜头会歪，背景铺大一点
  const vy = vfall(t);
  for (let i = 0; i < 70; i++) { const x = hash(i * 1.7) * W, len = 40 + vy * 0.08, y = ((hash(i * 9.3) * H * 2 - camY(t) * (0.5 + hash(i) * 0.6)) % (H + len) + H + len) % (H + len) - len; ctx.fillStyle = rgba(C.lav, 0.12 + 0.2 * hash(i * 3)); ctx.fillRect(x, y, 2, len); }
  for (const s of SLABS) slab(t, s);
  beatFloor(t);
  debris(t);
}

// ---------- 她在每一刻的样子（姿势按拍子换：动画的「一拍一张」） ----------
function girlNow(t) {
  if (t < NOW.s) return null;
  if (t < RUN.s) {   // 走：每一步换一张，落脚那一下身体往下沉一点
    const k = BEATS.filter(b => b >= NOW.s - 0.3 && b <= t).length, ph = (t - lastBeat(t)) / BEAT;
    return { name: ['walk_a', 'walk_b', 'walk_c'][k % 3], x: G_X, y: FLOOR_Y + 6 * Math.sin(Math.PI * clamp(ph)), hgt: HGT, block: t < NOW.s + 0.5 ? [24, 12, 6, 3, 1][Math.floor((t - NOW.s) / (BEAT / 4))] ?? 1 : 0 };
  }
  if (t < LEAP) {   // 跑：8 分音符换一张；腾空相位抬起来；起跑那一下往前倾
    const k = Math.floor((t - RUN.s) / (BEAT / 2)), ph = ((t - RUN.s) / (BEAT / 2)) % 1, lean = outBack((t - RUN.s) / 0.3);
    return { name: ['run_a', 'run_b', 'run_c'][k % 3], x: G_X + 40 * lean, y: FLOOR_Y - 34 * Math.sin(Math.PI * ph), hgt: HGT * 0.98, sx: 1 + 0.04 * (1 - ph), sy: 1 - 0.04 * (1 - ph) };
  }
  if (t < B_FALL) {   // 飞跃：一条抛物线，最高点在门开之后；穿门后在光里滑翔、慢慢往下
    const u = (t - LEAP) / (B_FALL - LEAP), arc = Math.sin(Math.PI * clamp((t - LEAP) / (B_THRU + 0.3 - LEAP)));
    return { name: t < B_THRU ? 'leap_a' : 'leap_c', x: G_X + 70 + 60 * u, y: FLOOR_Y - 250 * arc - 60 * clamp((t - B_THRU) / 0.9), hgt: HGT * 1.02, rot: -0.08 * arc + 0.25 * inOut((t - B_THRU - 0.4) / 0.6) };
  }
  if (t < B_LAND) {   // 翻滚下坠：每摔穿一层换一张；转整一圈，落地前正好转回来
    const k = t < CRASH[0] ? 0 : t < CRASH[1] ? 1 : 2, u = (t - B_FALL) / (B_LAND - B_FALL);
    return { name: ['tumble_a', 'tumble_b', 'tumble_c'][k], x: G_X + 40 * Math.sin(u * 5), y: girlBottom(t) - HGT * 0.45, hgt: HGT * 0.92, anchor: 'center', rot: Math.PI * 2 * inOut(u) + 0.3 * Math.sin(u * 9) };
  }
  // 落地：先蹲（挤压）→ 下一拍抬头笑
  const sq = 1 - 0.1 * pulse(t, B_LAND, 0.08);
  return { name: t < B_LOOK ? 'land_a' : 'land_b', x: G_X, y: FLOOR_Y + landDip(t), hgt: HGT * 0.72, sx: 2 - sq, sy: sq };
}

// ---------- 歌词：左上角一行一行，正在唱的词品红；FALL 两个词真的往下掉 ----------
const LINES = [[NOW.s - 0.1, COUNT.s - 0.05], [COUNT.s - 0.05, EVERY.s - 0.05], [EVERY.s - 0.05, FALL.s - 0.05], [FALL.s - 0.05, 89.12]];
function lyric(t, dark) {
  const L = LINES.find(([a, b]) => t >= a && t < b); if (!L) return;
  const ws = WORDS.filter(w => w.s >= L[0] && w.s < L[1]);
  let x = 110, y = 118, size = 64; ctx.font = ARCH(size); ctx.textAlign = 'left';
  for (const w of ws) {
    const s = w.w.replace(/[,.]$/, '') , ww = ctx.measureText(s + ' ').width;
    if (t < w.s - 0.4) { x += ww; continue; }
    const sung = t >= w.s, cur = sung && t < w.e + 0.05;
    let dy = 0, rot = 0;
    if (w.k === 'fall' && t > w.e) { const u = t - w.e; dy = 1400 * u * u; rot = 0.6 * u; }   // fall：唱完就掉下去
    ctx.save(); ctx.translate(x, y + dy); ctx.rotate(rot);
    ctx.fillStyle = cur ? rgba(C.pink) : sung ? rgba(dark ? C.ink : C.bone, 0.95) : rgba(C.lav, 0.3); ctx.fillText(s, 0, 0); ctx.restore();
    x += ww;
  }
}

// ---------- HUD：一行真话 ----------
function hud(t) {
  let s;
  if (t < NOW.s) s = 'agent · boot · editor/agent.js';
  else if (t < B_CROSS1) s = `agent · domain: editor · ${Math.round(speed(t))} px/s · committed ${Math.max(0, Math.floor(camX(t) / 32))} chars`;
  else if (t < B_CROSS2) s = `agent · domain: tracks · playhead ${t.toFixed(2)} s · bar ${DOWN.filter(d => d <= t).length} · kick ${env('kick', t).toFixed(2)}`;
  else if (t < B_FALL) s = `agent · domain: workflow · tool_call → ERR · ${t < B_DOOR ? 'retry?' : 'treat as door'}`;
  else if (t < B_LAND) s = `agent · falling · layers passed ${CRASH.filter(c => c <= t).length} / 2 · v ${Math.round(vfall(t))} px/s`;
  else s = `agent · landed on beat · error ${Math.abs(B_LAND - lastBeat(t + 0.001)) < 1 ? '0.000' : '—'} s · fall: none`;
  mono(s, 110, H - 64, 20, C.lav, 0.75);
}

// ---------- 两个 domain 之间的窗框：她跨过去的那一刻在拍上 ----------
function frameEdge(x, label) {
  ctx.fillStyle = rgba(C.bone, 0.85); ctx.fillRect(x - 2, 0, 4, H);
  ctx.fillStyle = rgba(C.bone, 0.9); ctx.fillRect(x, 60, 260, 40); mono('▸ ' + label, x + 14, 88, 22, C.ink, 1, 'left', 500);
  const g = ctx.createLinearGradient(x, 0, x + 60, 0); g.addColorStop(0, rgba(C.ink, 0.6)); g.addColorStop(1, rgba(C.ink, 0)); ctx.fillStyle = g; ctx.fillRect(x, 0, 60, H);
}
function split(t, tb, drawOld, drawNew, label) {
  const bx = aheadX(tb, t, 30);
  if (bx >= W) { drawOld(); return; }
  if (bx <= -80) { drawNew(); return; }
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Math.max(0, bx), H); ctx.clip(); drawOld(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(bx, 0, W - bx, H); ctx.clip(); drawNew(); ctx.restore();
  frameEdge(bx, label);
}

// 前方还没加载完：右边三档马赛克（越远越粗）—— 方块大小 = 加载进度
function lodAhead(strength) {
  if (strength <= 0) return;
  const bands = [[W - 300, W, 24], [W - 620, W - 300, 12], [W - 900, W - 620, 6]];
  lctx.imageSmoothingEnabled = false; ctx.imageSmoothingEnabled = false;
  for (const [x0, x1, b] of bands) {
    const bw = Math.ceil((x1 - x0) / b), bh = Math.ceil(H / b);
    lctx.clearRect(0, 0, bw, bh); lctx.drawImage(fc, x0, 0, x1 - x0, H, 0, 0, bw, bh);
    ctx.globalAlpha = strength; ctx.drawImage(lod, 0, 0, bw, bh, x0, 0, bw * b, bh * b); ctx.globalAlpha = 1;
  }
  ctx.imageSmoothingEnabled = true;
}

// ---------- 一个子帧 ----------
function scene(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = rgba(C.ink); ctx.fillRect(0, 0, W, H);
  // 镜头：跑起来时轻微拉远；跃起时往前推 + 一点倾斜；摔的时候镜头先被拽歪再慢慢摆正（都是跟着她的动作，不随鼓点抖）
  const zoom = 1.06 - 0.06 * outExpo((t - RUN.s) / 0.5) + 0.12 * inOut((t - LEAP) / 0.5) * (1 - inOut((t - B_THRU) / 0.4)) - 0.1 * outExpo((t - B_FALL) / 0.3) * (1 - inOut((t - B_LAND + 0.3) / 0.5)) + CRASH.reduce((z, c) => z + 0.05 * pulse(t, c, 0.07), 0);
  const roll = -0.05 * inOut((t - LEAP) / 0.4) * (1 - inOut((t - B_THRU) / 0.3)) + (t > B_FALL ? -0.22 * outBack((t - B_FALL) / 0.35) * (1 - inOut((t - B_FALL - 0.35) / (B_LAND - B_FALL - 0.35))) : 0);
  const fx = t > B_FALL ? G_X : G_X + 120, fy = t > B_FALL ? H * 0.5 : FLOOR_Y - 300;
  ctx.translate(fx, fy); ctx.rotate(roll); ctx.scale(zoom, zoom); ctx.translate(-fx, -fy);
  const ox = camX(t);
  const inWorld = t < B_FALL;
  if (t < NOW.s) {   // 开窗：一条横线展开成编辑器窗口（MG），窗里先只有光标
    const u = outExpo((t - T0) / 0.35), hh = H * u;
    ctx.save(); ctx.beginPath(); ctx.rect(0, (H - hh) / 2, W, hh); ctx.clip(); domEditor(t, ox); ctx.restore();
    ctx.fillStyle = rgba(C.bone, 0.9); ctx.fillRect(0, (H - hh) / 2 - 2, W, 3); ctx.fillRect(0, (H + hh) / 2 - 1, W, 3);
  } else if (t < B_CROSS2 + 2) {
    if (t < B_CROSS1 + 2) split(t, B_CROSS1, () => domEditor(t, ox), () => domTracks(t, ox), 'tracks.daw');
    else split(t, B_CROSS2, () => domTracks(t, ox), () => domGraph(t, ox), 'workflow.graph');
  } else if (inWorld) domGraph(t, ox);
  if (!inWorld) domFall(t);
  if (inWorld && t > NOW.s - 0.4) lodAhead(clamp((t - NOW.s + 0.4) / 0.4) * (1 - clamp((t - B_DOOR) / 0.3)));
  // 穿门之后：光从门里溢出来，世界被冲成骨白再沉回去
  if (t > B_THRU - 0.02 && t < B_FALL + 0.3) {
    const a = t < B_THRU + 0.1 ? 1 : 1 - inOut((t - B_THRU - 0.1) / (B_FALL - B_THRU));
    const cx = aheadX(B_THRU, t, 70), g = ctx.createRadialGradient(cx, H / 2, 0, cx, H / 2, W * 0.9);
    g.addColorStop(0, rgba(C.white, 0.95 * a)); g.addColorStop(0.4, rgba(C.bone, 0.5 * a)); g.addColorStop(1, rgba(C.cyan, 0.08 * a)); ctx.fillStyle = g; ctx.fillRect(-200, -200, W + 400, H + 400);
  }
  errorDoor(t);
  wallShards(t);
  // 她
  const gNow = girlNow(t);
  if (gNow) {
    // 速度拖影：跑和摔的时候身后两张淡的残影（按方向：跑 → 往左，摔 → 往上）
    if ((t > RUN.s && t < B_THRU) || (t > B_FALL && t < B_LAND)) {
      const falling = t > B_FALL;
      for (let k = 2; k >= 1; k--) drawGirl(gNow.name, gNow.x - (falling ? 0 : 70 * k), gNow.y - (falling ? -60 * k : 0), gNow.hgt, { ...gNow, alpha: 0.18 / k, rim: 0, block: 0 });
    }
    drawGirl(gNow.name, gNow.x, gNow.y, gNow.hgt, gNow);
  }
  // 摔的时候：狼狈的冷面注释
  if (t > B_FALL + 0.15 && t < B_LAND) mono('!?', G_X + 230, girlBottom(t) - HGT * 0.9, 54, C.bone, 0.9, 'left', 500);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const whiteish = t > B_THRU - 0.02 && t < B_THRU + 0.4;
  lyric(t, whiteish);
  hud(t);
}

// ---------- 后期：每帧一次 ----------
const GRAIN = Array.from({ length: 6 }, (_, k) => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), im = g.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (hash(i * 0.37 + k * 999) - 0.5) * 120; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); return c;
});
function post(t) {
  out.setTransform(1, 0, 0, 1, 0, 0); out.globalAlpha = 1;
  gctx.clearRect(0, 0, glow.width, glow.height); gctx.filter = 'blur(6px)'; gctx.drawImage(cv, 0, 0, glow.width, glow.height); gctx.filter = 'none';
  out.save(); out.globalCompositeOperation = 'lighter'; out.globalAlpha = 0.3; out.drawImage(glow, 0, 0, W, H); out.restore();
  out.save(); out.globalCompositeOperation = 'overlay'; out.globalAlpha = 0.14; const g = GRAIN[((frameIdx(t) % 6) + 6) % 6]; for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) out.drawImage(g, x, y); out.restore();
  const v = out.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)'); out.fillStyle = v; out.fillRect(0, 0, W, H);
  const at = (t0, k = 0) => frameIdx(t) === frameIdx(t0) + k;
  // 撞击 = 1 帧白 + 1 帧反相（异物帧），不抖镜头
  for (const c of [B_THRU, ...CRASH, B_LAND]) {
    if (at(c)) { out.fillStyle = rgba(C.white, c === B_THRU ? 0.9 : 0.55); out.fillRect(0, 0, W, H); }
    if (at(c, 1)) { out.save(); out.globalCompositeOperation = 'difference'; out.fillStyle = rgba(C.bone, 0.85); out.fillRect(0, 0, W, H); out.restore(); }
  }
  for (const c of [B_CROSS1, B_CROSS2]) if (at(c)) { out.fillStyle = rgba(C.bone, 0.22); out.fillRect(0, 0, W, H); }
  out.font = '14px A1Mono, Consolas, monospace'; out.textAlign = 'right'; out.fillStyle = 'rgba(246,242,252,0.35)';
  out.fillText(`CLEAN SLATE · now I can run · animator1 · v1 · t = ${t.toFixed(2)}`, W - 40, H - 30);
}

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
await document.fonts.load('900 100px A1Archivo'); await document.fonts.load('500 20px A1Mono'); await document.fonts.load('400 20px A1Mono');
const ui = document.getElementById('ui');
if (RENDER) {
  ui.remove();
  const n = Math.round((T1 - T0) * FPS), dst = Q.get('out') ?? '-5_Clean Slate/样片/小样_now_i_can_run_animator1_v1.mp4';
  await fetch(`/start?w=${W}&h=${H}&fps=${FPS}&t0=${T0}&t1=${T1}&vflip=0&out=${encodeURIComponent(dst)}`, { method: 'POST' });
  for (let i = 0; i < n; i++) {
    draw(T0 + i / FPS);
    const buf = out.getImageData(0, 0, W, H).data;
    for (let k = 0; ; k++) { try { await fetch('/frame?i=' + i, { method: 'POST', body: buf }); break; } catch (e) { if (k > 20) throw e; await new Promise(r => setTimeout(r, 300)); } }
  }
  await fetch(Q.has('quit') ? '/done?quit=1' : '/done', { method: 'POST' }); log('render done', n);
} else if (SHEET) {
  const [a, b, m] = SHEET.split(',').map(Number), cols = 4, rows = Math.ceil(m / cols), tw = W / cols, th = H / cols;
  const sheet = document.createElement('canvas'); sheet.width = W; sheet.height = th * rows; const sg = sheet.getContext('2d');
  for (let i = 0; i < m; i++) { const t = a + ((b - a) * i) / (m - 1); draw(t); sg.drawImage(cv, (i % cols) * tw, Math.floor(i / cols) * th, tw, th); sg.font = '16px Consolas'; sg.fillStyle = '#ff0'; sg.fillText(t.toFixed(2), (i % cols) * tw + 8, Math.floor(i / cols) * th + 20); }
  cv.height = sheet.height; out.drawImage(sheet, 0, 0); ui.remove();
  cv.style.height = 'auto'; cv.style.maxHeight = 'none'; cv.style.position = 'static';
} else if (STILL !== null) {
  draw(STILL); ui.textContent = `${STILL.toFixed(2)} s`; if (Q.has('clean')) ui.remove();
} else {
  ui.textContent = '载入音频…';
  const wav = await (await fetch('../../-5_Clean Slate/Clean Slate.wav')).blob();
  const audio = new Audio(URL.createObjectURL(wav)); let playing = false;
  await new Promise(r => audio.readyState >= 1 ? r() : audio.addEventListener('loadedmetadata', r, { once: true }));
  addEventListener('click', () => { if (!playing) { audio.currentTime = T0; audio.play(); playing = true; } });
  addEventListener('keydown', e => { if (e.code === 'Space') audio.paused ? audio.play() : audio.pause(); if (e.code === 'ArrowRight') audio.currentTime += 1; if (e.code === 'ArrowLeft') audio.currentTime -= 1; });
  const loop = () => { let t = playing ? audio.currentTime : T0; if (playing && t > T1) { audio.currentTime = T0; t = T0; } draw(t, 1); ui.textContent = `${t.toFixed(2)} s · 空格暂停 · ←/→ 跳 1 s`; requestAnimationFrame(loop); };
  loop();
}
window.DRAW = draw;
window.__ready = true;
