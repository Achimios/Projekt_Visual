// 场景图（Seedream 生成 → prep_shots.py 像素化）：整张 + 分图层。网格 192×108，s = 每格屏幕像素（10 = 1920×1080）。
const BASE = new URL('./px2/', import.meta.url);
export const SH = { man: null, img: {} };
const load = src => new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = src; });

export async function loadShots() {
  SH.man = await (await fetch(new URL('manifest.json', BASE))).json();
  const jobs = [];
  for (const [k, e] of Object.entries(SH.man.shots)) {
    jobs.push(load(new URL(e.full, BASE)).then(im => SH.img[k] = im));
    for (const L of e.layers) jobs.push(load(new URL(L.file, BASE)).then(im => SH.img[L.file] = im));
  }
  await Promise.all(jobs);
}
// 整张：以 (cx, cy) 为中心、缩放 z 画（s = 10 时正好铺满）
export function shot(ctx, key, { s = 10, z = 1, cx = 960, cy = 540, alpha = 1 } = {}) {
  const im = SH.img[key]; if (!im) return;
  const w = im.width * s * z, h = im.height * s * z;
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = alpha; ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h); ctx.restore();
}
// 分图层：layer = 第几层（1 起）；dx / dy = 屏幕偏移（做视差 / 动作）
export function shotLayer(ctx, key, layer, { s = 10, dx = 0, dy = 0, z = 1, alpha = 1 } = {}) {
  const L = SH.man.shots[key].layers[layer - 1]; if (!L) return;
  const im = SH.img[L.file], w = im.width * s * z, h = im.height * s * z;
  const cx = (L.x + L.w / 2) * s, cy = (L.y + L.h / 2) * s;
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = alpha; ctx.drawImage(im, cx - w / 2 + dx, cy - h / 2 + dy, w, h); ctx.restore();
}
export function layerInfo(key, layer) { return SH.man.shots[key].layers[layer - 1]; }
export function layerImg(key, layer) { return SH.img[SH.man.shots[key].layers[layer - 1].file]; }
