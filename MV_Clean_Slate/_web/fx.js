// 两种质感：ASCII 字符拼成的她（token 做的身体）+ 抖动像素风景（Bayer 抖动、3–4 色、多层视差）
import { PAL, COLS } from './girl.js';

const hash = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);

// ---------- ASCII：每个精灵像素 = 2×2 个字符；先乱跳，按时间一格格定下来 ----------
const RAMP = " .:-=+*#%@";
const TOK = "THEGIRLNEWFILE0123456789<>/{}[]#$&";
export function asciiGirl(ctx, g, x, y, px, t, t0, { settle = 0.5, color = [244, 239, 230], hot = [255, 138, 42], alpha = 1 } = {}) {
  const cell = px / 2;
  ctx.font = `bold ${Math.round(cell * 1.15)}px "Cascadia Mono", Consolas, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let r = 0; r < g.length; r++) for (let c = 0; c < COLS; c++) {
    const ch = g[r][c]; if (ch === '.' || !PAL[ch]) continue;
    const col = PAL[ch], lum = (0.3 * col[0] + 0.59 * col[1] + 0.11 * col[2]) / 255;
    for (let k = 0; k < 4; k++) {
      const id = r * 997 + c * 13 + k, born = t0 + hash(id) * settle * 0.6;
      if (t < born) continue;
      const fixed = t > born + 0.12 + hash(id + 3) * settle * 0.4;
      const glyph = fixed ? RAMP[clamp(Math.round(lum * 9 + (hash(id + 9) - 0.5)), 1, 9)] : TOK[Math.floor(hash(id + Math.floor(t * 24)) * TOK.length)];
      const u = fixed ? 0.25 : 0.9;
      ctx.fillStyle = `rgba(${Math.round(color[0] + (hot[0] - color[0]) * u)},${Math.round(color[1] + (hot[1] - color[1]) * u)},${Math.round(color[2] + (hot[2] - color[2]) * u)},${alpha})`;
      ctx.fillText(glyph, x + c * px + (k % 2 + 0.5) * cell, y + r * px + (Math.floor(k / 2) + 0.5) * cell);
    }
  }
}

// ---------- 抖动像素风景：先在 240×135 上算一个 0–1 的值，再按 4×4 Bayer 抖成调色板 ----------
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const LW = 240, LH = 135;
const low = document.createElement('canvas'); low.width = LW; low.height = LH;
const lctx = low.getContext('2d'); const img = lctx.createImageData(LW, LH);
// 远处赛博城市：每一栋楼的宽 / 高 / 窗
const TOWERS = (() => { const a = []; let x = -40; for (let i = 0; x < LW * 2 + 40; i++) { const w = 4 + Math.floor(hash(i + 3) * 10), h = 8 + Math.floor(hash(i + 7) ** 2 * 34); a.push({ x, w, h, i }); x += w + (hash(i + 11) < 0.3 ? 2 : 0); } return a; })();
export function ditherScene(ctx, W, H, t, { pal, horizon = 0.55, pan = 0, lit = 0, litT = 1e9, cx = 0.5 } = {}) {
  const P = pal ?? [[20, 16, 48], [54, 44, 124], [255, 92, 150], [255, 196, 160]];
  const n = P.length - 1, hy = LH * horizon, d = img.data;
  // 城市的高度图（视差：pan * 0.3）
  const city = new Float32Array(LW), win = [];
  for (const tw of TOWERS) {
    const sx = Math.round(tw.x - pan * 0.3) % (LW * 2);
    for (let k = 0; k < tw.w; k++) { const px = sx + k; if (px >= 0 && px < LW) city[px] = Math.max(city[px], tw.h); }
  }
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    let v;
    if (y < hy) {
      const glow = Math.exp(-(((hy - y) / 22) ** 2)) * 0.85 + Math.exp(-(((hy - y) / 60) ** 2)) * 0.25;
      v = 0.08 + glow;
      if (hy - y < city[x]) {                                  // 楼：暗，带窗灯
        v = 0.12;
        const wx = x % 3, wy = (y | 0) % 3, id = x * 131 + y * 7;
        if (wx === 1 && wy === 1 && hash(id) < 0.35) v = 0.62 + 0.4 * (hash(id + Math.floor(t * 2.08)) > 0.85);
      }
      if (hash(x * 7 + y * 131) > 0.9965 && y < hy - 20) v = 0.95 * (0.5 + 0.5 * Math.sin(t * 3 + x));   // 星
    } else {                                                    // 海：倒影 + 横向断开的波纹
      const ry = hy - (y - hy) * 1.6, glow = Math.exp(-(((hy - ry) / 22) ** 2)) * 0.85;
      const streak = 0.5 + 0.5 * Math.sin(x * 0.09 + y * 1.7 + t * 2.2 + Math.sin(y * 0.6) * 3);
      v = 0.06 + glow * streak * 0.9 + 0.05 * (y - hy) / (LH - hy);
      if (lit > 0) { const r = Math.hypot((x - LW * cx) * 0.5, (y - hy) * 2.2), front = (t - litT) * 60; v += 0.55 * Math.exp(-((r - front) ** 2) / 30) * lit; }
    }
    const q = clamp(Math.floor(v * n + BAYER[(y & 3) * 4 + (x & 3)]), 0, n), c = P[q], o = (y * LW + x) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  lctx.putImageData(img, 0, 0);
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(low, 0, 0, W, H); ctx.restore();
}
