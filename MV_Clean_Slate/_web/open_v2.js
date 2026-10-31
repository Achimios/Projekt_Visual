// Clean Slate · 开场 v2（0–28.3 s）—— 按 Leo 的反馈（_反馈/Leo_反馈_全片v1.md）重做：
//   0101 时背景数据流在滚 → Lights On 世界由下往上展开 → 她蜷着漂在「数字组成的海」里（particle_sea.py 的 JS 版：
//   拉格朗日标记点跟着 Gerstner 波走，亮度靠投影密度 + 坡度）→ 一行 prompt 从天上掉进海里砸出环形波 →
//   七个 token 浮在海面、海说 hi → token 碎成 embedding 珠子、珠子变问题、问题沉下去成种子 →
//   三个注意力头（粉 / 金 / 蓝）睁眼，注意力线连到每个 token，右边是真算出来的 softmax 热图；
//   搜索光束扫海 → 找到她 → 逐行扫描她（clue）→ 推进到她身上，接 28.3 s 的 Layer by layer。
// 规则：每帧 = 歌曲时间 t 的纯函数；鼓点不推全局抖动，运动都有指向（镜头跟着下落的那行字、光束朝目标收拢）。
// 素材是插槽：她 = ASSET.girl（任何图，加载时按 ROWS 行像素化；黑底自动抠），换图不改动画。
const Q = new URLSearchParams(location.search);
const RENDER = Q.has('render');
const T0 = +(Q.get('t0') ?? 0), T1 = +(Q.get('t1') ?? 28.4), FPS = +(Q.get('fps') ?? 30);
const STILL = Q.has('t') ? +Q.get('t') : null;
const W = 1920, H = 1080;
const log = (...a) => { console.log(...a); if (RENDER) fetch('/log', { method: 'POST', body: a.join(' ') }); };
addEventListener('error', e => log('ERROR', e.message, e.lineno));

// ---------- 素材插槽 ----------
// 默认用 Seedream 生成的蜷缩漂浮图（黑底，加载时抠）；?girl=px2/shot1_L2.png 换回旧 proxy
const ASSET = Q.has('girl') ? { girl: Q.get('girl'), rows: +(Q.get('rows') ?? 94), keyBlack: Q.has('key') }
  : { girl: '../素材/生成_场景_3/float_a.png', rows: +(Q.get('rows') ?? 110), keyBlack: true };

// ---------- 颜色 / 工具 ----------
const C = {
  ink: [6, 7, 16], night: [12, 14, 38], indigo: [30, 22, 92], violet: [110, 70, 230],
  bone: [236, 232, 222], white: [255, 255, 255], pink: [255, 61, 154], gold: [255, 196, 64], blue: [70, 150, 255],
  cyan: [61, 224, 255], orange: [255, 138, 42], lime: [214, 255, 74],
};
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mixc = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * u));
const BIG = s => `900 ${s}px "Arial Black", "Archivo Black", sans-serif`;
const MONO = s => `${s}px "Cascadia Mono", Consolas, monospace`;
const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
const lerp = (a, b, u) => a + (b - a) * u;
const hash = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const hash2 = (a, b) => hash(a * 127.1 + b * 311.7);
const outExpo = u => (u = clamp(u)) >= 1 ? 1 : 1 - Math.pow(2, -10 * u);
const inExpo = u => (u = clamp(u)) <= 0 ? 0 : Math.pow(2, 10 * u - 10);
const inOut = u => { u = clamp(u); return u * u * (3 - 2 * u); };
const outBack = (u, s = 1.7) => { u = clamp(u) - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
const prog = (t, t0, d, f = outExpo) => f((t - t0) / d);
const pulse = (t, t0, hl) => t < t0 ? 0 : Math.pow(0.5, (t - t0) / hl);
// 临界阻尼弹簧（particle_sea.py 同款）：从 e0 出发、无初速，u 秒后剩下的偏移比例
const spring = (u, w) => u <= 0 ? 1 : (1 + w * u) * Math.exp(-w * u);
function heat(age, cool = C.bone) {
  if (age < 0) return C.white;
  if (age < 0.12) return mixc(C.white, C.orange, age / 0.12);
  return mixc(C.orange, cool, clamp((age - 0.12) / 0.18));
}

// ---------- 画布 ----------
const cv = document.createElement('canvas'); cv.width = W; cv.height = H; document.body.appendChild(cv);
const ctx = cv.getContext('2d', { willReadFrequently: RENDER });

// ---------- 数据 ----------
const AUD = await (await fetch('audio.json')).json();
const RAW = await (await fetch('words.json')).json();
const WORDS = RAW.map(([w, a, b]) => ({ w: w.replace(/[^A-Za-z']/g, '').toUpperCase(), t0: a, t1: b }));
const LYFIX = [[8, 11, 'THRUST', 'DUST'], [8, 11, 'DAY', 'DATA'], [8, 11, 'TO', ''], [8, 11, 'SEE', 'SEA']];
for (const [a, b, from, to] of LYFIX) for (const w of WORDS) if (w.t0 >= a && w.t0 < b && w.w === from) w.w = to;
for (let i = WORDS.length - 1; i >= 0; i--) if (WORDS[i].w === '') WORDS.splice(i, 1);
const env = (k, t) => AUD[k][clamp(Math.floor(t * AUD.fps), 0, AUD[k].length - 1)];
const wt = (w, after) => (WORDS.find(x => x.w === w && x.t0 > after) ?? { t0: after }).t0;

// 关键时刻（都从歌词里查，不写死秒数）
const T = {
  z1: wt('ZERO', 4), o1: wt('ONE', 4.5), z2: wt('ZERO', 4.75), o2: wt('ONE', 5),
  lights: wt('LIGHTS', 7), dust: wt('DUST', 9), billion: wt('BILLION', 10), me: wt('ME', 12),
  then: wt('THEN', 12.5), falling: wt('FALLING', 13), sky: wt('SKY', 14), seven: wt('SEVEN', 14.4),
  sea: wt('SEA', 15.6), hi: wt('HI', 16), broke: wt('BROKE', 16.8), bead: wt('BEAD', 18), question: wt('QUESTION', 19),
  seed: wt('SEED', 20), eyes: wt('EYES', 20.5), pink: wt('PINK', 21.8), gold: wt('GOLD', 22.3), blue: wt('BLUE', 23.5),
  looking: wt('LOOKING', 24.3), girl: wt('GIRL', 25), looking2: wt('LOOKING', 25.6), clue: wt('CLUE', 27.4), layer: 28.326,
};
// 歌词分行（行首时刻）
const LINE_STARTS = [T.lights, T.dust - 0.25, T.billion, T.then, T.seven, wt('EVERY', 16.4), wt('EVERY', 18.4), T.eyes, T.looking, T.layer];

// ---------- 她：任意图 → 按行数像素化的精灵 ----------
async function sprite(src, rows, keyBlack) {
  const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  const h = Math.min(rows, im.height), w = Math.round(im.width * h / im.height);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h);
  if (keyBlack) {                       // 黑底：从四边往里洪泛，只抠和边缘连通的暗色（她的黑外套被轮廓围住，不会被抠掉）
    const dark = i => Math.max(d.data[i * 4], d.data[i * 4 + 1], d.data[i * 4 + 2]) < 26;
    const seen = new Uint8Array(w * h), st = [];
    for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
    while (st.length) {
      const i = st.pop(); if (seen[i] || !dark(i)) continue; seen[i] = 1; d.data[i * 4 + 3] = 0;
      const x = i % w, y = (i / w) | 0;
      if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1); if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w);
    }
  }
  for (let i = 0; i < d.data.length; i += 4) d.data[i + 3] = d.data[i + 3] > 140 ? 255 : 0;   // 硬边
  g.putImageData(d, 0, 0);
  // 再做一张纯色剪影（给发光 / 选中描边用）
  const sil = document.createElement('canvas'); sil.width = w; sil.height = h;
  const sg = sil.getContext('2d'); sg.drawImage(c, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#fff'; sg.fillRect(0, 0, w, h);
  return { img: c, sil, w, h };
}
const GIRL = await sprite(ASSET.girl, ASSET.rows, ASSET.keyBlack);

// ---------- 数字字模（三种亮度色，各 10 个数字）----------
const GW = 20, GH = 32;
const atlas = [C.cyan, C.bone, C.white].map(col => {
  const c = document.createElement('canvas'); c.width = GW * 10; c.height = GH;
  const g = c.getContext('2d'); g.font = MONO(28); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = rgba(col);
  for (let d = 0; d < 10; d++) g.fillText(String(d), d * GW + GW / 2, GH / 2 + 1);
  return c;
});

// ---------- 「hi」的字形遮罩（海面上一块区域里的点会升起来拼出 hi）----------
const HI = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.font = BIG(30); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('hi', 32, 17);
  const d = g.getImageData(0, 0, 64, 32).data; return (u, v) => u >= 0 && u < 64 && v >= 0 && v < 32 && d[(v * 64 + u) * 4 + 3] > 100;
})();

// ---------- 世界：镜头 + 海 ----------
const F = 900, CAMH = 2.6;
const travel = t => 0.6 * t;                                   // 镜头一直慢慢往前漂（不从静止开始）
const Z_IMP = travel(T.sky) + 15;                              // 那行字砸进海的位置（世界 z）
const Z_TOK = Z_IMP - 3;                                       // 七个 token 浮着的那一排
const TOKX = [-7.2, -4.8, -2.4, 0, 2.4, 4.8, 7.2];
const PROMPT = ['hello', 'world', 'are', 'you', 'there', 'little', 'one'];
const TOKID = [31373, 995, 389, 345, 612, 1310, 530];
const WAVES = [[0.34, 0.05, 0.30, 1.05, 0], [0.20, -0.24, 0.21, 1.45, 1.3], [0.11, 0.38, 0.47, 2.1, 2.1], [0.05, -0.62, 0.88, 2.9, 0.7]];
function ring(x, z, t) {                                       // 砸出来的环形波：色散的波包，短波跑在前面
  if (t < T.sky) return 0;
  const a = t - T.sky, r = Math.hypot(x, z - Z_IMP), front = 5.5 * a;
  const q = r - front;
  return 0.9 * Math.exp(-a * 0.45) * Math.exp(-(q * q) / (1.4 + a * 0.8)) * Math.cos(2.4 * q + 3 * a);
}
function sea(x, z, t) {
  let y = 0, sz = 0;
  for (const [A, kx, kz, w, p] of WAVES) { const ph = kx * x + kz * z - w * t + p; y += A * Math.sin(ph); sz += A * kz * Math.cos(ph); }
  return { y: y + ring(x, z, t), sz };
}
function camera(t) {
  let hy = H * 0.40;
  // 那行字掉下来：先抬头看天，再跟着它一起落回海面
  if (t > T.then && t < T.sky + 0.8) {
    const fy = lineY(t), dz = Z_IMP - travel(t);
    const want = H * 0.36 + Math.max(0, fy - CAMH) * F / dz * 0.8;
    const k = inOut((t - T.then) / 0.35) * (1 - inOut((t - T.sky) / 0.8));
    hy = lerp(hy, Math.max(hy, want), k);
  }
  // 眼睛出现：镜头微微抬起，给夜空留位置
  hy += H * 0.05 * inOut((t - T.eyes) / 1.2);
  return { hy, s: travel(t), x: 0, t };
}
const lineY = t => t < T.falling - 0.3 ? 15 : Math.max(0, 15 * (1 - ((t - (T.falling - 0.3)) / (T.sky - T.falling + 0.3)) ** 2));
function project(cam, x, y, z) {
  const dz = z - cam.s; if (dz < 0.6) return null;
  return { x: W / 2 + (x - cam.x) * F / dz, y: cam.hy + (CAMH - y) * F / dz, k: F / dz, dz };
}

// 海里每个点：世界网格上的固定标记（跟着水走，不跟镜头），远处隔一行取一行
function drawSea(t, cam, { hiAmt = 0, glowX = null } = {}) {
  const s = cam.s, zStart = Math.ceil((s + 1) / 0.5), zEnd = Math.floor((s + 62) / 0.5);
  for (let iz = zEnd; iz >= zStart; iz--) {                     // 远到近，近的盖住远的
    const z = iz * 0.5, dz = z - s, far = dz > 20;
    if (far && iz % 2) continue;
    const step = far ? 1 : 0.5, hw = (W / 2 + 40) / F * dz + 1;
    const fade = clamp(1 - dz / 62) ** 0.8 * clamp((dz - 0.8) / 2);
    for (let x = -Math.ceil(hw / step) * step; x <= hw; x += step) {
      const ix = Math.round(x * 2);
      const w = sea(x, z, t);
      let y = w.y, bright = 0.42 + 1.6 * Math.max(0, w.sz) + 0.35 * Math.abs(ring(x, z, t));
      const zz = z;
      if (glowX !== null) { const g = Math.exp(-((x - glowX.x) ** 2 + (z - glowX.z) ** 2) / 6); bright += g * glowX.a; }
      const p = project(cam, x, y, zz); if (!p || p.y < -20 || p.y > H + 20) continue;
      const a = clamp(fade * bright * 0.9); if (a < 0.03) continue;
      const size = clamp(0.36 * p.k, 1.5, 30), tier = bright > 1.5 ? 2 : bright > 0.85 ? 1 : 0;
      ctx.globalAlpha = a;
      if (size < 6) { ctx.fillStyle = rgba(tier === 0 ? C.cyan : tier === 1 ? C.bone : C.white); ctx.fillRect(p.x - size * 0.35, p.y - size * 0.35, size * 0.7, size * 0.7); }
      else {
        const d = Math.floor(hash2(ix, iz + Math.floor(t * 1.5 + hash2(iz, ix) * 7)) * 10);   // 数字慢慢变（一秒一两次）
        ctx.drawImage(atlas[tier], d * GW, 0, GW, GH, p.x - size * 0.31, p.y - size * 0.5, size * 0.62, size);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function sky(cam) {
  const g = ctx.createLinearGradient(0, cam.hy - H, 0, cam.hy);
  g.addColorStop(0, rgba(C.ink)); g.addColorStop(1, rgba(C.night));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 天上很远的数字星：屏幕上固定在地平线上方，随镜头俯仰一起移
  for (let i = 0; i < 160; i++) {
    const x = hash(i) * W, y = cam.hy - 40 - hash(i + 500) * H * 1.2;
    if (y < -10 || y > H) continue;
    ctx.fillStyle = rgba(C.bone, 0.08 + 0.25 * hash(i + 900)); ctx.fillRect(x, y, 2, 2);
  }
  // 天上还在下的 0101（开场那场数据雨没停，只是退远了）：只在地平线以上
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, cam.hy); ctx.clip(); ctx.globalAlpha = 0.28; rain(cam.t, 0.45); ctx.restore(); ctx.globalAlpha = 1;
  // 地平线：一条很细的冷光
  ctx.fillStyle = rgba(C.cyan, 0.18); ctx.fillRect(0, cam.hy - 1, W, 2);
}

// ---------- 她 ----------
function girlPos(t) {
  const x = lerp(0, 3.6, inOut((t - T.seven) / 2)) + 0.5 * Math.sin(t * 0.31);
  return { x, y: 2.5 + 0.22 * Math.sin(t * 1.05), z: travel(t) + 8 - 0.6 * Math.sin(t * 0.2), rot: 0.06 * Math.sin(t * 0.7) };
}
function drawGirl(t, cam, { alpha = 1, glow = 0.4, found = 0 } = {}) {
  const g = girlPos(t), p = project(cam, g.x, g.y, g.z); if (!p) return null;
  const hpx = 4.6 * p.k, wpx = hpx * GIRL.w / GIRL.h;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(g.rot); ctx.imageSmoothingEnabled = false;
  if (glow > 0) { ctx.shadowColor = rgba(C.cyan, glow); ctx.shadowBlur = 40; ctx.globalAlpha = alpha * 0.5; ctx.drawImage(GIRL.sil, -wpx / 2, -hpx / 2, wpx, hpx); ctx.shadowBlur = 0; }
  ctx.globalAlpha = alpha; ctx.drawImage(GIRL.img, -wpx / 2, -hpx / 2, wpx, hpx);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * 0.45; ctx.drawImage(GIRL.img, -wpx / 2, -hpx / 2, wpx, hpx);   // 原图很暗，提一档
  ctx.globalCompositeOperation = 'source-over';
  if (found > 0) { ctx.globalAlpha = found * 0.22; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(GIRL.sil, -wpx / 2, -hpx / 2, wpx, hpx); }
  ctx.restore();
  // 她正下方海面上的一道倒影光（光从下面照她）
  return { x: p.x, y: p.y, w: wpx, h: hpx, wx: g.x, wz: g.z };
}

// 「billion little numbers dreaming of me」：海里的数字一个个升起来飞向她（临界阻尼，不过冲）
function dreamers(t, cam, gb) {
  if (t < T.billion - 0.2 || t > T.then + 1.5 || !gb) return;
  const g = girlPos(t);
  for (let i = 0; i < 140; i++) {
    const t0 = T.billion - 0.2 + hash(i) * 1.7, u = t - t0; if (u < 0) continue;
    const sx = (hash(i + 7) - 0.5) * 16, sz = g.z + (hash(i + 13) - 0.5) * 8;
    const tx = g.x + (hash(i + 21) - 0.5) * 1.6, ty = g.y + (hash(i + 33) - 0.5) * 2.6, tz = g.z;
    const e = spring(u, 2.6), sy = sea(sx, sz, t).y;
    const x = tx + (sx - tx) * e, y = ty + (sy - ty) * e + Math.sin(u * 3 + i) * 0.1 * e, z = tz + (sz - tz) * e;
    const p = project(cam, x, y, z); if (!p) continue;
    const a = clamp(u / 0.3) * clamp(e / 0.25);                // 越靠近她越淡 = 被她吸收
    const size = clamp(0.36 * p.k, 4, 26);
    ctx.globalAlpha = a; ctx.drawImage(atlas[2], Math.floor(hash(i + 3) * 10) * GW, 0, GW, GH, p.x - size * 0.31, p.y - size * 0.5, size * 0.62, size);
  }
  ctx.globalAlpha = 1;
}

// 「the sea said hi」：token 那排前面，海里的数字一颗颗站起来，立成一面朝镜头的「hi」，碎开时落回海里
function hiWord(t, cam, amt) {
  if (amt <= 0) return;
  for (let v = 0; v < 32; v += 1.5) for (let u = 0; u < 64; u += 1.5) {
    if (!HI(Math.floor(u), Math.floor(v))) continue;
    const id = u * 97 + v * 13, d = hash(id) * 0.3, k = clamp((amt - d) / 0.7, 0, 1.15);
    const x = -7.5 + u / 64 * 9, z0 = Z_TOK - 2.5 - (32 - v) / 32 * 2, sy = sea(x, z0, t).y;
    const p = project(cam, x, lerp(sy, 0.5 + (1 - v / 32) * 3.4, k), lerp(z0, Z_TOK - 3, k)); if (!p) continue;
    const size = clamp(0.3 * p.k, 4, 22);
    ctx.globalAlpha = clamp(k * 1.4); ctx.drawImage(atlas[2], Math.floor(hash(id + 1) * 10) * GW, 0, GW, GH, p.x - size * 0.31, p.y - size * 0.5, size * 0.62, size);
  }
  ctx.globalAlpha = 1;
}

// ---------- 那行 prompt ----------
function promptLine(t, cam) {
  if (t < T.then - 0.1 || t > T.sky + 0.06) return;
  const y = lineY(t), p = project(cam, 0, y, Z_IMP); if (!p) return;
  const size = 0.55 * p.k, text = PROMPT.join(' ');
  ctx.font = MONO(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const vel = t > T.falling - 0.3 ? (t - (T.falling - 0.3)) / (T.sky - T.falling + 0.3) : 0;
  // 拖尾：往上的速度线（越快越长）
  for (let k = 1; k <= 6; k++) { ctx.fillStyle = rgba(C.cyan, 0.12 * (1 - k / 7)); ctx.fillText(text, p.x, p.y - k * vel * 22); }
  ctx.shadowColor = rgba(C.cyan); ctx.shadowBlur = 18; ctx.fillStyle = rgba(C.white); ctx.fillText('> ' + text, p.x, p.y); ctx.shadowBlur = 0;
}

// ---------- token 筹码 / 珠子 / 种子 ----------
function tokenSpot(j, t, cam, lift = 0.35) {
  const x = TOKX[j], w = sea(x, Z_TOK, t);
  return project(cam, x, w.y + lift, Z_TOK);
}
function tokens(t, cam) {
  if (t < T.seven) return [];
  const spots = [];
  for (let j = 0; j < 7; j++) {
    const born = T.seven + j * 0.11, a = t - born; if (a < 0) continue;
    const p = tokenSpot(j, t, cam); if (!p) continue; spots.push(p);
    const brk = clamp((t - T.broke - j * 0.05) / 0.25);         // 碎开
    if (brk < 1) {                                              // 筹码：从砸落点飞出来落位
      const k = outExpo(a / 0.45), imp = project(cam, 0, 0.3, Z_IMP);
      const x = lerp(imp.x, p.x, k), y = lerp(imp.y, p.y, k) - Math.sin(k * Math.PI) * 60;
      const fs = clamp(0.3 * p.k, 14, 34); ctx.font = MONO(fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(PROMPT[j]).width + fs * 0.8;
      ctx.globalAlpha = 1 - brk;
      ctx.fillStyle = rgba(C.ink, 0.7); ctx.fillRect(x - tw / 2, y - fs * 0.75, tw, fs * 1.5);
      ctx.strokeStyle = rgba(heat(a, C.bone)); ctx.lineWidth = 1.5; ctx.strokeRect(x - tw / 2, y - fs * 0.75, tw, fs * 1.5);
      ctx.fillStyle = rgba(heat(a, C.bone)); ctx.fillText(PROMPT[j], x, y);
      ctx.font = MONO(fs * 0.5); ctx.fillStyle = rgba(C.cyan, 0.8); ctx.fillText('#' + TOKID[j], x, y + fs * 1.15);
      ctx.globalAlpha = 1;
    }
    if (t > T.broke) beads(j, t, cam, p);
  }
  return spots;
}
// embedding：每个 token 碎成一串 8 颗珠子（亮度 = 向量分量），然后每颗变成问号，再沉下去成种子
function beads(j, t, cam, p) {
  const n = 8, bornAll = T.broke + j * 0.05;
  const sinkT = T.seed - 0.45 + j * 0.04;
  for (let i = 0; i < n; i++) {
    const u = t - bornAll - i * 0.06; if (u < 0) continue;
    const val = hash2(j, i) * 2 - 1;
    const col = val > 0 ? mixc(C.cyan, C.white, val) : mixc(C.cyan, C.violet, -val);
    const r = clamp(0.1 * p.k, 4, 14) * (0.7 + 0.5 * Math.abs(val));
    let x = p.x, y = p.y - (i + 1) * r * 2.6 * outBack(u / 0.35);
    let a = 1;
    if (t > sinkT) { const v = t - sinkT - i * 0.03; if (v > 0) { y = lerp(y, p.y + 6, inExpo(v / 0.4)); a = 1 - clamp((v - 0.35) / 0.15); } }
    if (a <= 0) continue;
    ctx.globalAlpha = a; ctx.shadowColor = rgba(col); ctx.shadowBlur = 14;
    ctx.fillStyle = rgba(col); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0;
    if (t > T.question - 0.25 + i * 0.03 && r > 6) { ctx.fillStyle = rgba(C.ink); ctx.font = BIG(r * 1.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', x, y + 1); }
  }
  ctx.globalAlpha = 1;
  // 种子：沉下去的地方冒出一根细芽（之后注意力线就连在这）
  if (t > T.seed - 0.1) {
    const g = outExpo((t - T.seed + 0.1 - j * 0.04) / 0.5), hgt = clamp(0.5 * p.k, 10, 40) * g;
    ctx.strokeStyle = rgba(C.lime, 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y + 4); ctx.lineTo(p.x, p.y + 4 - hgt); ctx.stroke();
    ctx.fillStyle = rgba(C.lime); ctx.fillRect(p.x - 3, p.y + 1 - hgt, 6, 4);
    ctx.font = MONO(14); ctx.textAlign = 'center'; ctx.fillStyle = rgba(C.bone, 0.55 * g); ctx.fillText(PROMPT[j], p.x, p.y + 22);
  }
}

// ---------- 多头注意力 ----------
const HEADS = [
  { name: 'head 0', col: C.pink, word: 'pink', x: 600 },
  { name: 'head 1', col: C.gold, word: 'gold', x: 960 },
  { name: 'head 2', col: C.blue, word: 'blue', x: 1320 },
];
const COLS = [...PROMPT, 'girl'];
// 每个头的打分（logits）：粉 = 位置扫描（局部），金 = 盯第一个 token，蓝 = 发散；「looking for the girl」时 girl 这一列被拉高
function logits(h, t) {
  const L = [];
  for (let j = 0; j < 8; j++) {
    let v;
    if (j === 7) v = -5;
    else if (h === 0) { const p = (t * 1.3) % 7; v = -((j - p) ** 2) / 1.6; }
    else if (h === 1) v = j === 0 ? 2.2 : -0.8 + 0.6 * Math.sin(t * 0.9 + j);
    else v = 0.8 * Math.sin(t * 0.7 + j * 1.9) + 0.4 * Math.sin(t * 1.7 + j);
    if (j === 7) v = lerp(-5, 7, inOut((t - T.looking) / (T.girl - T.looking + 0.1)));
    else v -= 4 * inOut((t - T.looking) / (T.girl - T.looking + 0.1));
    L.push(v);
  }
  return L;
}
const softmax = L => { const m = Math.max(...L), e = L.map(v => Math.exp(v - m)), s = e.reduce((a, b) => a + b); return e.map(v => v / s); };
function eyeY(cam) { return clamp(cam.hy - H * 0.33, 120, 260); }
function drawEye(h, t, cam, look) {
  const E = HEADS[h], t0 = T[E.word], y = eyeY(cam);
  if (t < t0 - 0.1) return null;
  const open = outBack((t - t0) / 0.35, 1.2) * (1 - 0.95 * pulse(t, t0 + 2.6 + h * 0.9, 0.04) * (t > t0 + 2.6 + h * 0.9 ? 1 : 0));
  const w = 150, hh = 58 * clamp(open, 0, 1.15);
  ctx.save(); ctx.translate(E.x, y);
  ctx.strokeStyle = rgba(E.col, 0.95); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(0, -hh * 2, w, 0); ctx.quadraticCurveTo(0, hh * 2, -w, 0); ctx.closePath();
  ctx.stroke(); ctx.save(); ctx.clip();
  const dx = clamp((look.x - E.x) / 12, -60, 60), dy = clamp((look.y - y) / 30, -10, 26);
  ctx.fillStyle = rgba(E.col, 0.9); ctx.beginPath(); ctx.arc(dx, dy, 40, 0, 6.2832); ctx.fill();
  ctx.fillStyle = rgba(C.ink); ctx.beginPath(); ctx.arc(dx, dy, 17, 0, 6.2832); ctx.fill();
  ctx.fillStyle = rgba(C.white, 0.9); ctx.fillRect(dx + 10, dy - 22, 9, 9);
  ctx.restore();
  ctx.font = MONO(15); ctx.textAlign = 'center'; ctx.fillStyle = rgba(E.col, 0.85 * clamp((t - t0) / 0.3)); ctx.fillText(`${E.name} · ${E.word}`, 0, -hh - 22 - 20);
  ctx.restore();
  return { x: E.x + dx, y: y + dy };
}
function attention(t, cam, seeds, gb) {
  if (t < T.eyes - 0.1) return null;
  const look = gb && t > T.looking ? gb : { x: W / 2, y: H * 0.8 };
  const eyes = HEADS.map((_, h) => drawEye(h, t, cam, look));
  // 注意力线：粗细 = 权重
  eyes.forEach((e, h) => {
    if (!e) return; const wts = softmax(logits(h, t)), age = t - T[HEADS[h].word];
    const targets = [...seeds.slice(0, 7), gb];
    targets.forEach((p, j) => {
      if (!p) return; const wv = wts[j] * clamp(age / 0.5); if (wv < 0.02) return;
      ctx.strokeStyle = rgba(HEADS[h].col, 0.15 + 0.75 * wv); ctx.lineWidth = 0.8 + 7 * wv;
      ctx.beginPath(); ctx.moveTo(e.x, e.y + 30); ctx.lineTo(p.x, p.y - (j === 7 ? 0 : 30)); ctx.stroke();
    });
  });
  // 搜索光束（looking for the girl）：每个头一束锥光扫海，到 girl 时收拢到她身上
  if (t > T.looking - 0.1 && t < T.clue + 0.6) {
    eyes.forEach((e, h) => {
      if (!e) return;
      const conv = inOut((t - T.girl + 0.25) / 0.45);
      const sx = W / 2 + Math.sin((t - T.looking) * 2.4 + h * 2.1) * W * 0.36, sy = H * 0.86;
      const tx = lerp(sx, gb ? gb.x : sx, conv), ty = lerp(sy, gb ? gb.y + gb.h * 0.25 : sy, conv), r = lerp(140, gb ? gb.w * 0.6 : 140, conv);
      const g = ctx.createLinearGradient(e.x, e.y, tx, ty); g.addColorStop(0, rgba(HEADS[h].col, 0.0)); g.addColorStop(1, rgba(HEADS[h].col, 0.16));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(e.x, e.y + 30); ctx.lineTo(tx - r, ty); ctx.lineTo(tx + r, ty); ctx.closePath(); ctx.fill();
    });
  }
  return eyes;
}
// 右侧热图：三行（头）× 八列（七个 token + girl），格子亮度 = softmax 权重（真算的，不是装饰）
function heatmap(t) {
  if (t < T.eyes + 0.2) return;
  const a = clamp((t - T.eyes - 0.2) / 0.5), x0 = 110, y0 = 470, cw = 46, ch = 36;
  ctx.globalAlpha = a;
  ctx.font = MONO(15); ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.bone, 0.75);
  ctx.fillText('MULTI-HEAD ATTENTION  softmax(QKᵀ/√d)', x0, y0 - 64);
  COLS.forEach((c, j) => { ctx.save(); ctx.translate(x0 + j * cw + cw / 2, y0 - 10); ctx.rotate(-0.9); ctx.textAlign = 'left'; ctx.fillStyle = rgba(j === 7 ? C.white : C.bone, j === 7 ? 0.95 : 0.55); ctx.fillText(c, 0, 0); ctx.restore(); });
  HEADS.forEach((E, h) => {
    if (t < T[E.word]) return;
    const wts = softmax(logits(h, t));
    wts.forEach((wv, j) => {
      ctx.fillStyle = rgba(E.col, 0.08 + 0.92 * wv); ctx.fillRect(x0 + j * cw + 2, y0 + h * ch + 2, cw - 4, ch - 4);
    });
    ctx.fillStyle = rgba(E.col); ctx.textAlign = 'right'; ctx.fillText(`h${h}`, x0 - 10, y0 + h * ch + 26);
    ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.bone, 0.6); ctx.fillText(`max ${COLS[wts.indexOf(Math.max(...wts))]} ${Math.max(...wts).toFixed(2)}`, x0 + 8 * cw + 12, y0 + h * ch + 26);
  });
  ctx.globalAlpha = 1;
}
// 找到她：角标框 + 逐行扫描（clue）+ 读数
function found(t, gb) {
  if (!gb || t < T.girl - 0.05) return;
  const k = outExpo((t - T.girl + 0.05) / 0.3), pad = 30 + 120 * (1 - k);
  const x0 = gb.x - gb.w / 2 - pad, y0 = gb.y - gb.h / 2 - pad, x1 = gb.x + gb.w / 2 + pad, y1 = gb.y + gb.h / 2 + pad, L = 34;
  ctx.strokeStyle = rgba(C.white, 0.95); ctx.lineWidth = 3;
  for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx + sx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * L); ctx.stroke();
  }
  const sc = softmax(logits(0, t))[7];
  ctx.font = MONO(18); ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.white); ctx.fillText(`query: girl   score ${sc.toFixed(2)}`, x0, y0 - 14);
  if (t > T.looking2 - 0.1) {                                   // 逐行扫她：一条扫描线反复往下走，扫过的地方亮一下
    const u = ((t - T.looking2 + 0.1) / 0.6) % 1, sy = lerp(y0 + pad, y1 - pad, u);
    ctx.fillStyle = rgba(C.cyan, 0.5); ctx.fillRect(x0 + 10, sy, x1 - x0 - 20, 2);
    const notes = [['state', 'asleep'], ['dreaming', 'yes'], ['tokens', '7 → 1'], ['name', '—']];
    notes.forEach(([k2, v], i) => {
      const ti = T.looking2 + i * 0.45; if (t < ti) return;
      ctx.fillStyle = rgba(heat(t - ti, C.bone), 0.9); ctx.font = MONO(17);
      ctx.fillText(`${k2.padEnd(9)} ${v}`, x1 + 18, y0 + 30 + i * 28);
    });
  }
}

// ---------- 0101：背景数据流 ----------
function rain(t, dens) {
  const cols = 80, cw = W / cols, fs = 20;
  ctx.font = MONO(fs); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const kick = env('kick', t);
  for (let c = 0; c < cols; c++) {
    if (hash(c * 3.1) > dens) continue;
    const v = 70 + 220 * hash(c + 40), len = 8 + Math.floor(hash(c + 80) * 22), head = (t * v + hash(c + 9) * 3000) % (H + len * fs + 200);
    for (let r = 0; r < len; r++) {
      const y = head - r * fs * 1.1; if (y < -fs || y > H) continue;
      const ch = hash2(c, Math.floor((head - r * fs * 1.1) / (fs * 1.1)) + Math.floor(t * 4) * (r === 0 ? 1 : 0)) > 0.5 ? '1' : '0';
      const a = r === 0 ? 0.85 + 0.15 * kick : 0.5 * (1 - r / len);
      ctx.fillStyle = r === 0 ? rgba(C.white, a) : rgba(C.cyan, a * 0.7);
      ctx.fillText(ch, c * cw + cw / 2, y);
    }
  }
  ctx.textBaseline = 'alphabetic';
}
function binary(t) {
  ctx.fillStyle = rgba(C.ink); ctx.fillRect(0, 0, W, H);
  rain(t, clamp(0.05 + t / 7, 0, 0.75));
  // 大字：zero / one / zero / one 一个个砸到中央，后一个替换前一个
  const seq = [[T.z1, '0'], [T.o1, '1'], [T.z2, '0'], [T.o2, '1']];
  let cur = null; for (const s of seq) if (t >= s[0] - 0.02) cur = s;
  if (cur) {
    const age = t - cur[0] + 0.02, s = lerp(1.5, 1, outExpo(age / 0.12));
    ctx.save(); ctx.translate(W / 2, H / 2 + 120); ctx.scale(s, s);
    ctx.fillStyle = rgba(C.ink, 0.85); ctx.fillRect(-150, -330, 300, 380);
    ctx.font = BIG(380); ctx.textAlign = 'center'; ctx.fillStyle = rgba(heat(age)); ctx.fillText(cur[1], 0, 0); ctx.restore();
  } else {                                                    // 之前：中央一个闪烁的光标
    if (Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = rgba(C.bone, 0.9); ctx.fillRect(W / 2 - 14, H / 2 - 30, 28, 60); }
  }
  // 5.6 s 起敲一行命令：lights.on()
  const cmd = '> lights.on()', n = Math.floor(clamp((t - (T.o2 + 0.7)) / 1.2) * cmd.length);
  if (n > 0) { ctx.font = MONO(30); ctx.textAlign = 'center'; ctx.fillStyle = rgba(C.bone, 0.9); ctx.fillText(cmd.slice(0, n) + (Math.floor(t * 3) % 2 ? '_' : ' '), W / 2, H / 2 + 230); }
}

// ---------- Lights on：世界从下往上展开 ----------
const BARS = Array.from({ length: 11 }, (_, k) => ({ x: hash(k + 1) * W * 0.8, w: 120 + hash(k + 20) * 700, h: 4 + hash(k + 40) * 26, d: k * 0.035, col: [C.cyan, C.violet, C.bone, C.pink, C.lime][k % 5] }));
function unfold(t, drawWorld) {
  const u = (t - T.lights) / 0.9, rev = H * (1 - outExpo(u));
  binary(t);
  ctx.save(); ctx.beginPath(); ctx.rect(0, rev, W, H - rev); ctx.clip(); drawWorld(); ctx.restore();
  ctx.fillStyle = rgba(C.cyan); ctx.fillRect(0, rev - 2, W, 3);
  for (const b of BARS) {                                      // 跟在边缘后面往上冲的色条（错开起跑）
    const y = H - (H + 80) * outExpo((t - T.lights - b.d) / 0.8); if (y > H) continue;
    ctx.fillStyle = rgba(b.col, 0.9 * (1 - clamp((t - T.lights - b.d - 0.5) / 0.4))); ctx.fillRect(b.x, y, b.w, b.h);
  }
  ctx.font = MONO(16); ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.bone, 0.8);
  ['render: sea', 'markers: 5 210', 'lights: on'].forEach((s, i) => ctx.fillText(s, 60, rev - 18 - i * 22));
}

// ---------- 歌词（底部一行，逐词变热）----------
function lyric(t) {
  if (t < T.lights - 0.05) return;
  let a = LINE_STARTS[0], b = LINE_STARTS[1];
  for (let i = 0; i < LINE_STARTS.length - 1; i++) if (t >= LINE_STARTS[i] - 0.05) { a = LINE_STARTS[i]; b = LINE_STARTS[i + 1]; }
  const ws = WORDS.filter(w => w.t0 >= a - 0.06 && w.t0 < b - 0.06 && w.t0 <= t + 0.02); if (!ws.length) return;
  let size = 56; ctx.font = BIG(size);
  const full = WORDS.filter(w => w.t0 >= a - 0.06 && w.t0 < b - 0.06).map(w => w.w).join(' ');
  const fw = ctx.measureText(full).width; if (fw > W - 240) { size *= (W - 240) / fw; ctx.font = BIG(size); }
  let x = W / 2 - ctx.measureText(full).width / 2; const y = H - 72;
  ctx.textAlign = 'left';
  for (const w of WORDS.filter(w => w.t0 >= a - 0.06 && w.t0 < b - 0.06)) {
    const age = t - w.t0, s = w.w + ' ', ww = ctx.measureText(s).width;
    if (age >= -0.02) { ctx.fillStyle = rgba(C.ink, 0.6); ctx.fillText(w.w, x + 3, y + 3); ctx.fillStyle = rgba(heat(age)); ctx.fillText(w.w, x, y); }
    x += ww;
  }
}

function post(t) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.font = MONO(13); ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.bone, 0.35); ctx.fillText(`CLEAN SLATE · 开场 v2 · t = ${t.toFixed(2)}`, 40, H - 24);
}

// ---------- 一帧 ----------
function draw(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (t < T.lights) { binary(t); post(t); return; }
  const cam = camera(t);
  // 推进到她身上（clue 之后）：以她为中心放大
  const push = inExpo((t - T.clue) / (T.layer - T.clue));
  let gbox = null, seeds = [];
  const world = () => {
    sky(cam);
    const gp = girlPos(t);
    drawSea(t, cam, { glowX: { x: gp.x, z: gp.z, a: 0.6 } });
    hiWord(t, cam, outExpo((t - T.sea) / 0.6) * (1 - inExpo((t - T.broke) / 0.5)));
    promptLine(t, cam);
    const searching = t > T.eyes;
    gbox = drawGirl(t, cam, { alpha: searching && t < T.girl ? 0.55 : 1, glow: t > T.girl ? 0.9 : 0.45, found: t > T.girl ? 1 - clamp((t - T.girl) / 0.6) * 0.7 : 0 });
    dreamers(t, cam, gbox);
    seeds = tokens(t, cam);
    if (t > T.sky && t < T.sky + 0.05) { ctx.fillStyle = rgba(C.white, 0.5); ctx.fillRect(0, 0, W, H); }   // 砸进海的 1 帧冲击
  };
  if (t < T.lights + 1.0) { unfold(t, world); lyric(t); post(t); return; }
  if (push > 0 && gbox === null) { /* 先画一遍拿到她的位置 */ }
  ctx.save();
  if (push > 0) { const g = girlPos(t), p = project(cam, g.x, g.y, g.z); const z = 1 + 7 * push; ctx.translate(p.x, p.y); ctx.scale(z, z); ctx.translate(-p.x, -p.y); }
  world();
  attention(t, cam, seeds, gbox);
  found(t, gbox);
  ctx.restore();
  heatmap(t);
  lyric(t);
  if (t > T.layer - 0.08) { ctx.fillStyle = rgba(C.white, clamp((t - T.layer + 0.08) / 0.08)); ctx.fillRect(0, 0, W, H); }
  post(t);
}
window.DRAW = draw;

// ---------- 启动 ----------
const ui = document.getElementById('ui');
if (RENDER) {
  ui.remove();
  const n = Math.round((T1 - T0) * FPS), out = Q.get('out') ?? '-5_Clean Slate/样片/开场_v2.mp4';
  await fetch(`/start?w=${W}&h=${H}&fps=${FPS}&t0=${T0}&t1=${T1}&vflip=0&out=${encodeURIComponent(out)}`, { method: 'POST' });
  for (let i = 0; i < n; i++) {
    draw(T0 + i / FPS);
    const buf = ctx.getImageData(0, 0, W, H).data;
    for (let k = 0; ; k++) { try { await fetch('/frame?i=' + i, { method: 'POST', body: buf }); break; } catch (e) { if (k > 20) throw e; await new Promise(r => setTimeout(r, 300)); } }
  }
  await fetch('/done', { method: 'POST' }); log('render done', n);
} else if (Q.has('sheet')) {
  const [a, b, st] = Q.get('sheet').split(',').map(Number), ts = [];
  for (let t = a; t < b; t += st) ts.push(t);
  const cols = 6, tw = 320, th = 180, rows = Math.ceil(ts.length / cols);
  const sh = document.createElement('canvas'); sh.width = cols * tw; sh.height = rows * (th + 16);
  const g = sh.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, sh.width, sh.height);
  ts.forEach((t, i) => { draw(t); g.drawImage(cv, (i % cols) * tw, Math.floor(i / cols) * (th + 16), tw, th); g.fillStyle = '#ff0'; g.font = '12px monospace'; g.fillText(t.toFixed(1), (i % cols) * tw + 4, Math.floor(i / cols) * (th + 16) + th + 12); });
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
