// 她（像素版，来自 Seedream 分图层 → prep_px.py）。所有场景、所有 Animator 都从这里拿她和站台的图层。
// 用法：
//   import { loadPx, layer, girl, PX } from './girl_px.js';   // PX 路径相对于本文件
//   await loadPx();
//   girl(ctx, x, y, s, { eyes: 'open'|'closed'|'slit'|'wide'|'blink', mouth: 'flat'|'smile'|'oh', glow: 0–1 });
//   layer(ctx, 'screen', x, y, s);   // 其它图层：bg / frame / screen / rail / mini / strip1–5
// 坐标单位：一格像素；s = 每格画多大（屏幕像素）。整张原图 = 176×222 格。图层自己的位置在 PX.layers[key].x/y。

const BASE = new URL('./px/', import.meta.url);
export const PX = { layers: {}, img: {}, size: [176, 222], palette: [] };
const cache = new Map();

export async function loadPx() {
  const man = await (await fetch(new URL('manifest.json', BASE))).json();
  PX.size = man.size; PX.palette = man.palette;
  await Promise.all(man.layers.map(L => new Promise((ok, bad) => {
    const im = new Image(); im.onload = () => { PX.layers[L.key] = L; PX.img[L.key] = im; ok(); }; im.onerror = bad; im.src = new URL(`${L.key}.png`, BASE);
  })));
}

export function layer(ctx, key, x, y, s, { alpha = 1 } = {}) {
  const im = PX.img[key]; if (!im) return;
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = alpha;
  ctx.drawImage(im, Math.round(x), Math.round(y), im.width * s, im.height * s); ctx.restore();
}

// 表情 = 在像素层上改眼睛 / 嘴那几格（按状态缓存一张小画布）
function variant(st) {
  const key = `${st.eyes}|${st.mouth}|${Math.round((st.glow ?? 1) * 4)}`;
  if (cache.has(key)) return cache.get(key);
  const L = PX.layers.girl, im = PX.img.girl;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const skin = `rgb(${L.skin})`, shade = `rgb(${L.skin.map(v => Math.round(v * 0.62))})`, ink = 'rgb(20,14,48)';
  const glow = st.glow ?? 1, mag = glow > 0.5 ? 'rgb(255,70,230)' : 'rgb(150,80,200)';
  for (const [x0, y0, x1, y1] of L.eyes) {
    const cx = Math.round((x0 + x1) / 2), w = x1 - x0, by = y1 - 1;            // by = 眼睛底行
    g.fillStyle = skin; g.fillRect(x0, y0, w, y1 - y0);                       // 先抹掉原来的眼睛
    if (st.eyes === 'closed' || st.eyes === 'blink') { g.fillStyle = shade; g.fillRect(x0 + 1, by, w - 1, 1); g.fillStyle = ink; g.fillRect(x0 + 1, by - 1, w - 1, 1); }
    else if (st.eyes === 'slit') { g.fillStyle = ink; g.fillRect(x0, by - 2, w, 1); g.fillStyle = mag; g.fillRect(x0 + 1, by - 1, w - 2, 1); }
    else {
      const h = st.eyes === 'wide' ? 4 : 3;
      g.fillStyle = ink; g.fillRect(x0, by - h - 1, w, 1);                     // 上睫毛
      g.fillStyle = mag; g.fillRect(x0 + 1, by - h, w - 2, h);                  // 发光的虹膜
      g.fillStyle = 'rgb(255,190,240)'; g.fillRect(x0 + 1, by - 1, w - 2, 1);    // 下沿亮一点
      g.fillStyle = ink; g.fillRect(cx - 1, by - h + 1, 2, h - 1);              // 瞳孔
      g.fillStyle = '#fff'; g.fillRect(x0 + 1, by - h, 1, 1);                   // 高光
    }
  }
  const [mx0, my0, mx1] = L.mouth;
  if (st.mouth === 'smile') { g.fillStyle = skin; g.fillRect(mx0, my0, mx1 - mx0, 3); g.fillStyle = 'rgb(214,70,150)'; g.fillRect(mx0, my0, 1, 1); g.fillRect(mx1 - 1, my0, 1, 1); g.fillRect(mx0 + 1, my0 + 1, mx1 - mx0 - 2, 1); }
  else if (st.mouth === 'oh') { g.fillStyle = skin; g.fillRect(mx0, my0, mx1 - mx0, 3); g.fillStyle = 'rgb(150,40,110)'; g.fillRect(mx0 + 2, my0, 2, 2); }
  cache.set(key, c);
  return c;
}

export function girl(ctx, x, y, s, st = {}) {
  if (!PX.img.girl) return;
  const c = variant({ eyes: 'open', mouth: 'flat', ...st });
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = st.alpha ?? 1;
  ctx.drawImage(c, Math.round(x), Math.round(y), c.width * s, c.height * s); ctx.restore();
}
