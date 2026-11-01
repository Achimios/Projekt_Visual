// look.js —— 「显贵的最后一层」：bloom / halation / 色散 / 影调肩 / 颗粒 / 暗角。
//
// 为什么要有这个：Canvas2D 直接画出来的东西是「平的」——没有高光溢出、没有镜头色散、
// 没有胶片颗粒，所以再好的构图也像 PPT。外部参考库 `openfilm-examples/one-prompt/src/px/post.js`
// 用的就是这一串（线性 HDR bloom + halation + CA + shoulder + grain + vignette），
// 这里换成 Canvas2D 能做的事 + 一遍像素后处理，接口保持一样的手感。
//
// 用法（页面里）：
//   import { makeLook } from './look.js';
//   const look = makeLook(W, H, { render: RENDER });
//   // 每帧：把场景画到 look.src（一个离屏 canvas，ctx2d），然后
//   look.finish(ctx, t, { bloom: .5, grain: .05 });            // 实时 / 静帧 / 接触表
//   const data = look.pixels(ctx, t);                          // 渲染：拿修好的 ImageData.data
//
// 约定：
//   - look.src 是你要画场景的地方（尺寸 W×H），别直接用主 canvas 画。
//   - bloom 在 Canvas2D 里做（低分辨率，本来就不该是锐的）；色散 / 肩 / 颗粒在像素上做。
//   - 纯函数：所有随机都由 t 和像素坐标 hash 出来，不存跨帧状态。

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

export function makeLook(W, H, opt = {}) {
  const RENDER = !!opt.render;
  const mk = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };
  const src = mk(W, H);
  const sctx = src.getContext('2d', { willReadFrequently: RENDER });
  sctx.imageSmoothingEnabled = false;

  // 三级 mip：1/4, 1/8, 1/16
  const lv = [
    { c: mk(W >> 2, H >> 2) },
    { c: mk(W >> 3, H >> 3) },
    { c: mk(W >> 4, H >> 4) },
  ];
  for (const l of lv) l.g = l.c.getContext('2d');

  // 色散直接在像素上做，不需要通道缓冲

  const P = {
    bloom: 0.55,          // 溢出强度
    threshold: 0.62,      // 多亮才溢（0–1，按平方律近似）
    halation: 0.22,       // 高光边缘的橙红晕（胶片的味道）
    ca: 1.0,              // 色散（像素）；只在渲染路径生效
    grain: 0.05,          // 颗粒
    vignette: 0.38,       // 暗角
    exposure: 1.0,
    fade: 0,              // 0–1 压黑
    flash: 0,             // 0–1 白闪
    ...opt,
  };

  /** 亮部提取：把 src 缩小画进这一级，再乘自己两次（≈ 亮度过阈值才留下）。 */
  function brightPass(g, level, threshold) {
    const w = level.c.width, h = level.c.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, w, h);
    // 平方两次 ≈ 阈值：暗的一半变 1/16，亮的基本保留
    g.globalCompositeOperation = 'multiply';
    const k = clamp((0.5 - threshold) / 0.5 + 0.5, 1, 2);   // threshold 越低，留下越多
    for (let i = 0; i < 2; i++) g.drawImage(level.c, 0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    return k;
  }

  /** 场景 → bloom/halation 叠回 sctx。返回后 sctx 里就是「上了光」的画面。 */
  function grade(t, over = {}) {
    const p = { ...P, ...over };
    sctx.save();
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'lighter';

    // ---- 1/4：主 bloom
    const g0 = lv[0].g;
    brightPass(g0, lv[0], p.threshold);
    g0.filter = 'blur(3px)';
    g0.drawImage(lv[0].c, 0, 0);
    g0.filter = 'none';
    sctx.globalAlpha = clamp(p.bloom * 0.85);
    sctx.drawImage(lv[0].c, 0, 0, W, H);

    // ---- 1/8：大范围柔光（让亮的地方「有空气」）
    const g1 = lv[1].g;
    brightPass(g1, lv[1], p.threshold + 0.08);
    g1.filter = 'blur(4px)';
    g1.drawImage(lv[1].c, 0, 0);
    g1.filter = 'none';
    sctx.globalAlpha = clamp(p.bloom * 0.6);
    sctx.drawImage(lv[1].c, 0, 0, W, H);

    // ---- halation：最模糊一级染橙，只在高光周围留下一点体温
    const g2 = lv[2].g;
    brightPass(g2, lv[2], p.threshold + 0.02);
    g2.filter = 'blur(6px)';
    g2.drawImage(lv[2].c, 0, 0);
    g2.filter = 'none';
    g2.globalCompositeOperation = 'multiply';
    g2.fillStyle = 'rgb(255,150,72)';
    g2.fillRect(0, 0, lv[2].c.width, lv[2].c.height);
    g2.globalCompositeOperation = 'source-over';
    sctx.globalAlpha = clamp(p.halation);
    sctx.drawImage(lv[2].c, 0, 0, W, H);

    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = 'source-over';

    // ---- 暗角 + 淡出 + 闪白
    const vg = sctx.createRadialGradient(W / 2, H * 0.5, H * 0.30, W / 2, H * 0.5, H * 1.02);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.62, `rgba(0,0,0,${0.10 * p.vignette})`);
    vg.addColorStop(1, `rgba(0,0,0,${0.88 * p.vignette})`);
    sctx.fillStyle = vg;
    sctx.fillRect(0, 0, W, H);
    if (p.fade > 0) { sctx.fillStyle = `rgba(0,0,0,${clamp(p.fade)})`; sctx.fillRect(0, 0, W, H); }
    if (p.flash > 0) { sctx.fillStyle = `rgba(236,242,255,${clamp(p.flash) * 0.85})`; sctx.fillRect(0, 0, W, H); }
    sctx.restore();
    return p;
  }

  /** 把 sctx 的结果画到主 canvas（实时 / 静帧 / 接触表用）。 */
  function finish(ctx, t, over = {}) {
    const p = grade(t, over);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(src, 0, 0);
    if (p.scan != null && p.scan > 0) {
      // 极轻的横纹（CRT / 屏幕感），按像素行 1 px
      ctx.fillStyle = `rgba(0,0,0,${0.05 * p.scan})`;
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    }
    return p;
  }

  /**
   * 渲染路径：colour 已经 grade 过；这里做像素级的一遍
   * 色散 → 影调肩 → 颗粒 → 抖动。返回可直接 POST 的 Uint8ClampedArray。
   */
  function pixels(ctx, t, over = {}) {
    const p = grade(t, over);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(src, 0, 0);

    let id = ctx.getImageData(0, 0, W, H);
    let d = id.data;

    // ---- 色散：径向偏移，边角最强，中心不动（镜头该有的样子）。
    // 直接在像素上取样：R 往外偏、B 往里偏，绿不动。相邻行拷一份，避免踩到已改的像素。
    const caAmt = p.ca;
    if (caAmt > 0.01) {
      const prev = new Uint8ClampedArray(d);   // 只读源
      const cx = W * 0.5, cy = H * 0.5;
      const inv2 = 1 / (W * W * 0.25 + H * H * 0.25);
      for (let y = 0; y < H; y++) {
        const dy = (y - cy);
        for (let x = 0; x < W; x++) {
          const dx = (x - cx);
          const r2 = (dx * dx + dy * dy) * inv2;              // 0 中心 → 1 角
          const off = r2 * caAmt * 3.0;
          if (off < 0.35) continue;                            // 中心不动
          const rx = Math.round(x + dx * off * 0.0006), ry = Math.round(y + dy * off * 0.0006);
          const bx = Math.round(x - dx * off * 0.0006), by = Math.round(y - dy * off * 0.0006);
          const i = (y * W + x) << 2;
          if (rx >= 0 && rx < W && ry >= 0 && ry < H) d[i] = prev[((ry * W + rx) << 2)];
          if (bx >= 0 && bx < W && by >= 0 && by < H) d[i + 2] = prev[((by * W + bx) << 2) + 2];
        }
      }
    }

    // ---- 影调肩 + 颗粒 + 抖动（线性近似用 x²，省掉 pow）
    const inv = 1 / 255;
    const ex = p.exposure;
    const gr = p.grain;
    const k = 0.72;
    const invK = 1 / (1 - k);
    const tGrain = (t * 60) | 0;
    let s = (tGrain * 2654435761) >>> 0;      // 每帧换一次种子
    const seed = s;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let i = (y * W + x) << 2;
        // 线性化（x² 近似 gamma 2）
        let r = d[i] * inv, g = d[i + 1] * inv, b = d[i + 2] * inv;
        r = ex * r * r; g = ex * g * g; b = ex * b * b;
        // 肩
        if (r > k) r = k + (1 - k) * (1 - Math.exp(-(r - k) * invK));
        if (g > k) g = k + (1 - k) * (1 - Math.exp(-(g - k) * invK));
        if (b > k) b = k + (1 - k) * (1 - Math.exp(-(b - k) * invK));
        // 过曝去饱和（亮到发白才是镜头，不是霓虹）
        const ov = r > g ? (r > b ? r : b) : (g > b ? g : b);
        if (ov > 1.15) {
          const m = clamp((ov - 1.15) / 2.6) * 0.8;
          const L = (r + g + b) * (1 / 3);
          r += (L - r) * m; g += (L - g) * m; b += (L - b) * m;
        }
        // 回到 sRGB（开方）
        r = Math.sqrt(r < 0 ? 0 : r > 1 ? 1 : r);
        g = Math.sqrt(g < 0 ? 0 : g > 1 ? 1 : g);
        b = Math.sqrt(b < 0 ? 0 : b > 1 ? 1 : b);
        // 颗粒：两个尺度，中间调最重
        const lm = (r + g + b) * (1 / 3);
        const amt = gr * (0.55 + 1.2 * lm * (1 - lm));
        // 便宜的 hash（Wang hash 的两轮）
        let h = (x * 374761393 + y * 668265263 + seed) >>> 0;
        h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
        const n1 = ((h & 65535) / 65535 - 0.5);
        let h2 = (x * 1597334677 + y * 2654435761 + (seed ^ 0x9e3779b9)) >>> 0;
        h2 = ((h2 ^ (h2 >>> 15)) * 2246822519) >>> 0;
        const n2 = ((h2 & 65535) / 65535 - 0.5);
        const gn = (n1 * 0.6 + n2 * 0.4) * amt;
        d[i] = (r + gn) * 255;
        d[i + 1] = (g + gn) * 255;
        d[i + 2] = (b + gn) * 255;
      }
    }
    return d;
  }

  return { src, sctx, finish, pixels, grade, P };
}
