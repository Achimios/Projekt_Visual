// 她 v2：赛博像素动漫肖像（原创）。先在 200×250 的小画布上用矢量画，再按调色板量化 → 像素质感（VA-11 Hall-A 的路子，不画任何现成角色）。
// 设定：不对称的蓝紫波波头 + 青色轮廓光；左边品红光打脸；耳边是赛博耳机（听不见，LED 显示 NO SIGNAL）；
// 脖子上有接口和线缆；高领技术风外套（白灰 + 粉内衬）；头发旁边漂着几块半透明 HUD 小屏。

export const PAL = [
  [12, 9, 30], [26, 20, 62], [48, 34, 110], [80, 50, 170], [58, 92, 220], [108, 160, 255], [61, 224, 255],
  [255, 61, 154], [255, 142, 200], [255, 222, 214], [234, 176, 204], [166, 104, 176], [246, 242, 252], [176, 178, 214], [92, 92, 146], [255, 138, 42],
];
const LW = 200, LH = 250;
const low = document.createElement('canvas'); low.width = LW; low.height = LH;
const g = low.getContext('2d', { willReadFrequently: true });
const out = document.createElement('canvas'); out.width = LW; out.height = LH;
const og = out.getContext('2d');

const hex = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };
const blob = (cx, cy, rx, ry, col, rot = 0) => { g.fillStyle = col; g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, 6.2832); g.fill(); };
const curve = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length - 1; i += 2) g.quadraticCurveTo(...pts[i], ...pts[i + 1]); g.stroke(); };

// st: { eyes: 'closed'|'half'|'open'|'wide', glow: 0–1（眼睛 / LED 亮度）, mouth: 'flat'|'smile'|'oh', sway: -1..1（发梢晃）, hud: 0–1 }
export function drawCyberGirl(st = {}) {
  const { eyes = 'open', glow = 1, mouth = 'flat', sway = 0, hud = 1, t = 0 } = st;
  g.clearRect(0, 0, LW, LH);
  const P = i => hex(PAL[i]);
  // 后面的头发（波波头，右边长一点 = 不对称）
  poly([[52, 70], [60, 40], [100, 22], [142, 38], [152, 78], [156, 128 + sway * 3], [146, 150 + sway * 4], [134, 132], [128, 150], [118, 120], [84, 120], [72, 146 + sway * 3], [62, 128], [50, 138 - sway * 2], [48, 100]], P(2));
  // 外套：高领、宽肩
  poly([[18, 250], [26, 196], [58, 172], [78, 160], [122, 160], [144, 172], [176, 196], [184, 250]], P(13));
  poly([[18, 250], [26, 196], [58, 172], [70, 168], [64, 250]], P(14));                     // 左侧暗部
  poly([[78, 160], [100, 176], [122, 160], [118, 150], [100, 160], [82, 150]], P(8));         // 粉色内衬
  poly([[70, 168], [84, 186], [100, 176], [78, 160]], P(12)); poly([[130, 168], [116, 186], [100, 176], [122, 160]], P(12));   // 翻领
  // 脖子 + 接口环 + 线缆
  poly([[88, 128], [112, 128], [114, 158], [86, 158]], P(10));
  poly([[86, 140], [114, 140], [114, 148], [86, 148]], P(1)); blob(100, 144, 4, 3, P(6)); blob(92, 144, 1.6, 1.6, P(7)); blob(108, 144, 1.6, 1.6, P(7));
  curve([[90, 148], [70, 170], [62, 210]], P(1), 3); curve([[108, 148], [134, 176], [150, 214]], P(1), 3); curve([[100, 150], [96, 190], [104, 230]], P(14), 2);
  // 脸：右亮左品红
  poly([[70, 72], [130, 72], [131, 100], [122, 120], [100, 132], [78, 120], [69, 100]], P(9));
  poly([[70, 72], [86, 72], [84, 104], [92, 132], [76, 122], [68, 100]], P(10));              // 左脸被品红光染
  poly([[124, 96], [132, 100], [124, 122], [116, 128]], P(11));                                 // 右下阴影
  // 眼睛
  const eyeY = 97, E = [[86, eyeY], [116, eyeY]];
  E.forEach(([x, y], k) => {
    if (eyes === 'closed') { curve([[x - 8, y + 1], [x, y + 5], [x + 8, y + 1]], P(0), 2); return; }
    const h = eyes === 'half' ? 4.5 : eyes === 'wide' ? 10 : 8.5;                  // 大一点、圆一点
    blob(x, y + 1, 8, h, P(12));                                                   // 眼白
    blob(x + (k ? -0.5 : 0.5), y + 2, 6, Math.min(h, 7.5), glow > 0.5 ? P(7) : P(3));   // 虹膜：上线后品红
    blob(x + (k ? -0.5 : 0.5), y + 4, 4, Math.min(h, 4), P(8));                     // 虹膜下半亮一点
    blob(x + (k ? -0.5 : 0.5), y + 2, 2.4, Math.min(h, 3.8), P(0));                 // 瞳孔
    blob(x + (k ? -3 : -1.5), y - 1.5, 2.2, 2.2, P(12)); blob(x + 3, y + 5, 1, 1, P(12));   // 两颗高光
    curve([[x - 9, y - h + 3], [x, y - h - 1], [x + 9, y - h + 3]], P(0), 2.6);     // 上睫毛：弧线，不压眼
    if (eyes === 'wide') { curve([[x - 7, y - h - 6], [x, y - h - 9], [x + 7, y - h - 6]], P(3), 1.6); }   // 眉毛挑起
  });
  // 鼻、嘴
  blob(101, 112, 1.2, 1.2, P(11));
  if (mouth === 'smile') curve([[93, 121], [100, 126], [107, 121]], P(7), 2);
  else if (mouth === 'oh') blob(100, 123, 3, 3.5, P(7));
  else curve([[95, 123], [100, 124], [105, 123]], P(11), 1.6);
  // 前面的刘海：一缕缕尖
  poly([[56, 74], [62, 44], [100, 26], [140, 42], [148, 76], [140, 92], [134, 70], [128, 96], [118, 70], [110, 86], [102, 64], [94, 88], [86, 66], [78, 96], [72, 72], [64, 104]], P(4));
  poly([[66, 60], [88, 40], [108, 36], [96, 48], [80, 64]], P(5));                              // 头发高光
  poly([[140, 42], [148, 76], [152, 120 + sway * 3], [146, 108], [142, 80]], P(6));            // 右侧青色轮廓光
  // 赛博耳机：左耳罩 + LED 条；右耳罩 + 天线
  blob(60, 104, 9, 13, P(1)); blob(60, 104, 6, 10, P(14)); poly([[58, 96], [62, 96], [62, 112], [58, 112]], glow > 0.3 ? P(15) : P(2));
  blob(142, 104, 9, 13, P(1)); blob(142, 104, 6, 10, P(14)); poly([[140, 96], [144, 96], [144, 112], [140, 112]], glow > 0.3 ? P(6) : P(2));
  curve([[146, 92], [158, 70], [160, 46]], P(13), 2); blob(160, 44, 3, 3, glow > 0.3 ? P(7) : P(14));
  // 头发旁边漂着的 HUD 小屏
  if (hud > 0) {
    const boxes = [[30, 56, 22, 14], [150, 132, 26, 16], [36, 132, 18, 11], [158, 26, 20, 12]];
    boxes.forEach(([x, y, w, h], i) => {
      const dy = Math.sin(t * 2 + i) * 2;
      g.globalAlpha = 0.8 * hud; g.fillStyle = P(i % 2 ? 6 : 7); g.fillRect(x, y + dy, w, h);
      g.fillStyle = P(0); for (let r = 0; r < 3; r++) g.fillRect(x + 2, y + dy + 3 + r * 3, (w - 4) * (0.4 + 0.6 * ((i * 7 + r * 3) % 5) / 5), 1);
      g.globalAlpha = 1;
    });
  }
  quantize();
  return out;
}

// 量化到调色板（最近色），透明的保持透明
function quantize() {
  const im = g.getImageData(0, 0, LW, LH), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
    let best = 0, bd = 1e9;
    for (let k = 0; k < PAL.length; k++) { const c = PAL[k], e = (c[0] - d[i]) ** 2 * 0.3 + (c[1] - d[i + 1]) ** 2 * 0.59 + (c[2] - d[i + 2]) ** 2 * 0.11; if (e < bd) { bd = e; best = k; } }
    d[i] = PAL[best][0]; d[i + 1] = PAL[best][1]; d[i + 2] = PAL[best][2]; d[i + 3] = 255;
  }
  og.clearRect(0, 0, LW, LH); og.putImageData(im, 0, 0);
}

// 贴到主画布：px = 每个小像素放大几倍
export function blitGirl(ctx, img, x, y, px) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, x, y, LW * px, LH * px); ctx.restore(); }
export const SIZE = [LW, LH];
