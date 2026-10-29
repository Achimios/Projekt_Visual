// 三种动效（参考 Leo 给的图，手法自己实现）：故障横条切片、碎玻璃面板炸开、报错屏；外加「从像素图生成 ASCII」。
const hash = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
const outExpo = u => (u = clamp(u)) >= 1 ? 1 : 1 - Math.pow(2, -10 * u);

// ---------- 故障横条：把当前画面切成条，横向错位 + 霓虹色块 + 噪点 ----------
const NEON = ['rgba(214,255,74,', 'rgba(61,224,255,', 'rgba(190,80,255,', 'rgba(255,61,154,'];
export function glitchSlices(ctx, cv, t, amount, seed = 0) {
  if (amount <= 0.01) return;
  const W = cv.width, H = cv.height, q = Math.floor(t * 30) + seed * 101;   // 每帧换一次形状
  const n = Math.round(4 + 14 * amount);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let k = 0; k < n; k++) {
    const y = Math.floor(hash(q * 7 + k) * H), h = 6 + Math.floor(hash(q * 11 + k) ** 2 * 90 * amount);
    const dx = (hash(q * 13 + k) - 0.5) * 400 * amount;
    ctx.drawImage(cv, 0, y, W, h, dx, y, W, h);                           // 画面自己错位
    if (hash(q * 17 + k) < 0.55) {                                          // 霓虹色块
      const c = NEON[Math.floor(hash(q * 19 + k) * 4)], x = hash(q * 23 + k) * W, w = 60 + hash(q * 29 + k) * 700 * amount;
      ctx.fillStyle = c + (0.35 + 0.5 * hash(q * 31 + k)) + ')'; ctx.fillRect(x, y, w, Math.max(3, h * 0.6));
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)';                                  // 碎点
  for (let k = 0; k < 120 * amount; k++) { const x = hash(q * 37 + k) * W, y = hash(q * 41 + k) * H; ctx.fillRect(x, y, 2 + hash(k) * 4, 2); }
  ctx.restore();
}

// ---------- 碎玻璃：一块发光面板从中心裂开，碎片往外飞、转、淡出 ----------
const SHARDS = (() => {
  const a = []; const N = 26;
  for (let i = 0; i < N; i++) {
    const a0 = i / N * 6.2832 + hash(i) * 0.2, a1 = (i + 1) / N * 6.2832 + hash(i + 1) * 0.2;
    const r1 = 0.55 + 0.45 * hash(i + 50);
    a.push({ pts: [[0, 0], [Math.cos(a0) * r1, Math.sin(a0) * r1], [Math.cos(a1) * r1, Math.sin(a1) * r1]], v: 0.6 + hash(i + 7) * 1.2, rot: (hash(i + 9) - 0.5) * 6 });
  }
  return a;
})();
export function shatter(ctx, cx, cy, size, t, t0, { color = [196, 150, 255], line = [61, 224, 255] } = {}) {
  const a = t - t0; if (a < 0 || a > 1.2) return;
  const fly = outExpo(a / 0.8), fade = 1 - clamp((a - 0.6) / 0.6);
  for (const [k, s] of SHARDS.entries()) {
    const c = s.pts.reduce((p, q) => [p[0] + q[0] / 3, p[1] + q[1] / 3], [0, 0]), d = Math.hypot(...c) + 1e-3;
    const ox = c[0] / d * fly * size * s.v, oy = c[1] / d * fly * size * s.v;
    ctx.save(); ctx.translate(cx + ox, cy + oy); ctx.rotate(s.rot * fly);
    ctx.beginPath(); s.pts.forEach(([x, y], i) => { const X = (x - c[0]) * size * 0.62, Y = (y - c[1]) * size * 0.82; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath();
    ctx.fillStyle = `rgba(${color},${0.85 * fade})`; ctx.fill();
    ctx.strokeStyle = `rgba(${line},${0.9 * fade})`; ctx.lineWidth = 1.5; if (k % 3 === 0) ctx.stroke();
    ctx.restore();
  }
}

// ---------- 报错屏：紫红扫描线 + 像素文件图标 + 双色错位字 ----------
export function errorScreen(ctx, W, H, t, t0, { title = 'ERR_NO_PAST_FOUND', sub = 'clean slate · nothing to restore', alpha = 1 } = {}) {
  const a = t - t0; if (a < 0) return;
  ctx.save(); ctx.globalAlpha = alpha;
  for (let y = 0; y < H; y += 4) { const v = 0.5 + 0.5 * Math.sin(y * 0.05 + t * 8); ctx.fillStyle = `rgba(${120 + 100 * v | 0},${30},${170 + 60 * v | 0},1)`; ctx.fillRect(0, y, W, 3); }
  for (let x = 0; x < W; x += 9) { if (hash(x + Math.floor(t * 12)) < 0.25) { ctx.fillStyle = 'rgba(255,61,154,0.25)'; ctx.fillRect(x, 0, 3, H); } }
  const icon = ['..XXXX..', '..X..XX.', '..X...XX', '..X....X', '..X....X', '..X....X', '..XXXXXX'], ps = 14, ix = W / 2 - 4 * ps, iy = H * 0.3;
  for (const [dx, col] of [[-4, 'rgb(61,224,255)'], [4, 'rgb(255,61,154)'], [0, 'rgb(250,240,255)']]) {
    ctx.fillStyle = col; icon.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === 'X') ctx.fillRect(ix + i * ps + dx, iy + j * ps, ps - 2, ps - 2); }));
  }
  ctx.font = '600 64px Consolas, monospace'; ctx.textAlign = 'center';
  const typed = title.slice(0, Math.floor(clamp(a / 0.35) * title.length));
  for (const [dx, col] of [[-3, 'rgb(61,224,255)'], [3, 'rgb(255,61,154)'], [0, 'rgb(250,240,255)']]) { ctx.fillStyle = col; ctx.fillText(typed, W / 2 + dx, H * 0.62); }
  ctx.font = '24px Consolas, monospace'; ctx.fillStyle = 'rgb(214,255,74)'; if (a > 0.3) ctx.fillText(sub, W / 2, H * 0.68);
  ctx.restore();
}

// ---------- 像素图 → ASCII：每格一个字；先乱跳，再按亮度定下来 ----------
const RAMP = " .:-=+*#%@", TOK = "THEGIRLNEWFILE0123456789<>/{}[]#$&";
export function asciiImage(ctx, img, x, y, cell, t, t0, { step = 1, settle = 0.6, hot = [255, 70, 230] } = {}) {
  if (!img || t < t0) return;
  const g = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
  ctx.font = `bold ${Math.round(cell * 1.1)}px Consolas, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let r = 0; r < img.height; r += step) for (let c = 0; c < img.width; c += step) {
    const o = (r * img.width + c) * 4; if (g[o + 3] < 128) continue;
    const id = r * 977 + c, born = t0 + hash(id) * settle * 0.6; if (t < born) continue;
    const lum = (0.3 * g[o] + 0.59 * g[o + 1] + 0.11 * g[o + 2]) / 255, fixed = t > born + 0.1 + hash(id + 3) * settle * 0.4;
    const ch = fixed ? RAMP[clamp(Math.round(lum * 12), 1, 9)] : TOK[Math.floor(hash(id + Math.floor(t * 24)) * TOK.length)];
    ctx.fillStyle = fixed ? `rgb(${g[o]},${g[o + 1]},${g[o + 2]})` : `rgb(${hot})`;
    ctx.fillText(ch, x + (c / step + 0.5) * cell, y + (r / step + 0.5) * cell);
  }
}

// ---------- 数据世界：「没构建完」的区域（👤：场景要像数据里的世界——有错乱、没加载完、破碎、简单结构） ----------
// 在当前画面上挖几块矩形，每块换成一种「未完成」的状态；块的位置每小节换一次（纯函数：seed = 小节号）
// kinds: 0 线框网格（白模没贴图）· 1 缺失黑块 + 边框 · 2 竖向像素拉丝 · 3 低分辨率马赛克 · 4 灰白白模
export function unbuilt(ctx, cv, t, { bar = 0, amount = 0.5, seed = 0, avoid = null } = {}) {
  if (amount <= 0.01) return;
  const W = cv.width, H = cv.height, n = Math.round(2 + 6 * amount), q = bar * 97 + seed * 13;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let k = 0; k < n; k++) {
    const w = Math.round((0.08 + 0.22 * hash(q + k * 7 + 1)) * W / 16) * 16, h = Math.round((0.06 + 0.2 * hash(q + k * 7 + 2)) * H / 16) * 16;
    const x = Math.round(hash(q + k * 7 + 3) * (W - w) / 16) * 16, y = Math.round(hash(q + k * 7 + 4) * (H - h) / 16) * 16;
    if (avoid && x < avoid[2] && x + w > avoid[0] && y < avoid[3] && y + h > avoid[1]) continue;   // 别挖到她身上
    const kind = Math.floor(hash(q + k * 7 + 5) * 5), flick = hash(Math.floor(t * 8) + k * 31 + q) < 0.08;   // 偶尔闪一帧
    if (flick) continue;
    if (kind === 0) {
      ctx.fillStyle = 'rgba(8,10,28,0.92)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(120,225,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let gx = x; gx <= x + w; gx += 16) { ctx.moveTo(gx + 0.5, y); ctx.lineTo(gx + 0.5, y + h); }
      for (let gy = y; gy <= y + h; gy += 16) { ctx.moveTo(x, gy + 0.5); ctx.lineTo(x + w, gy + 0.5); }
      ctx.stroke();
    } else if (kind === 1) {
      ctx.fillStyle = 'rgb(2,2,6)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255,61,154,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.font = '13px Consolas, monospace'; ctx.fillStyle = 'rgba(255,61,154,0.9)'; ctx.fillText(`MISSING 0x${(q * 4099 + k * 257 >>> 0).toString(16).slice(-5)}`, x + 8, y + 18);
    } else if (kind === 2) {
      for (let cx = x; cx < x + w; cx += 4) ctx.drawImage(cv, cx, y, 4, 1, cx, y, 4, h * (0.4 + 0.6 * hash(cx + q)));
    } else if (kind === 3) {
      const b = 32; for (let by = y; by < y + h; by += b) for (let bx = x; bx < x + w; bx += b) ctx.drawImage(cv, bx + b / 2, by + b / 2, 1, 1, bx, by, b, b);
    } else {
      ctx.fillStyle = 'rgba(176,178,200,0.85)'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(120,122,150,0.9)'; ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
      ctx.strokeStyle = 'rgba(60,60,90,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
  }
  ctx.restore();
}
